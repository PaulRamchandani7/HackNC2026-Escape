import io
import json
import urllib.error
from unittest.mock import patch

from django.test import TestCase

from .judge import matches, run_tests
from .rooms import BY_SLUG


def _offline(_query, _variables=None):
    raise RuntimeError("offline")


class CatalogTests(TestCase):
    def setUp(self):
        patcher = patch("config.leetcode.graphql", side_effect=_offline)
        self.addCleanup(patcher.stop)
        patcher.start()

    def test_room_page_keeps_hidden_tests_on_the_server(self):
        response = self.client.get("/room/1/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sample A")
        self.assertNotContains(response, "Hidden A")
        self.assertNotIn("hidden_tests", response.context["plan"])
        voyage = self.client.session["adrift_voyage"]
        self.assertEqual([room["difficulty"] for room in voyage["rooms"]], ["Easy", "Easy", "Medium", "Medium", "Medium"])

    def test_restart_assigns_a_new_voyage(self):
        self.client.get("/ship/")
        response = self.client.post("/ship/restart/")
        self.assertRedirects(response, "/ship/?notice=assigned")
        page = self.client.get("/ship/?notice=assigned")
        self.assertContains(page, "A new diagnostic sequence has been assigned.")
        self.assertEqual(len(self.client.session["adrift_voyage"]["rooms"]), 5)

    def test_sealed_room_is_not_judged(self):
        response = self.client.get("/room/2/")
        self.assertContains(response, "Compartment sealed")
        denied = self.client.post(
            "/room/2/run/",
            data=json.dumps({"code": "pass"}),
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)

    @patch("config.judge.run_piston")
    def test_submit_does_not_open_the_next_room(self, piston):
        self.client.get("/room/1/")
        piston.return_value = {
            "executor": "piston",
            "stdout": json.dumps({"results": [{"got": 1}], "stdout": "", "stderr": ""}) + "\n",
            "stderr": "",
            "error": None,
            "piston_blocked": False,
        }
        response = self.client.post(
            "/room/1/submit/",
            data=json.dumps({"code": "def solution():\n    return 1\n"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["completed"])
        self.assertIsNone(body["unlockedNext"])
        self.assertTrue(all("expected" not in row for row in body["results"]))
        sealed = self.client.get("/room/2/")
        self.assertContains(sealed, "Compartment sealed")


class ProgressTests(CatalogTests):
    @patch("config.views.run_tests")
    def test_passing_all_rooms_unlocks_leaderboard(self, run):
        run.return_value = {"ok": True, "passedAll": True, "results": []}
        self.assertContains(self.client.get("/room/1/"), "Easy")
        for number in range(1, 6):
            self.client.get(f"/room/{number}/")
            body = self.client.post(
                f"/room/{number}/submit/", data=json.dumps({"code": "x"}), content_type="application/json"
            ).json()
            if number < 5:
                self.assertEqual(body["unlockedNext"], number + 1)
            else:
                self.assertTrue(body["completed"])
        self.assertContains(self.client.get("/room/5/"), "Extreme")
        page = self.client.get("/leaderboard/")
        self.assertContains(page, "Post my time")
        self.client.post("/leaderboard/", {"name": "Ada"})
        page = self.client.get("/leaderboard/")
        self.assertContains(page, "Ada")
        self.assertNotContains(page, "Post my time")

    def test_leaderboard_rejects_unfinished_runs(self):
        response = self.client.post("/leaderboard/", {"name": "Cheat"})
        self.assertContains(response, "Finish all rooms")


class JudgeTests(TestCase):
    def test_compare_modes(self):
        self.assertTrue(matches(2, 2, "exact"))
        self.assertFalse(matches(1, 2, "exact"))
        self.assertTrue(matches([3, 1, 2], [1, 2, 3], "sorted"))
        self.assertTrue(matches([["b", "a"], ["c"]], [["c"], ["a", "b"]], "groups"))

    def test_piston_rejection_does_not_grade_locally(self):
        def blocked(request, timeout=15):
            raise urllib.error.HTTPError(
                request.full_url,
                401,
                "Unauthorized",
                hdrs=None,
                fp=io.BytesIO(b'{"message":"whitelist only"}'),
            )

        with patch("config.judge.urlopen", side_effect=blocked):
            result = run_tests(
                code="def search_insert(nums, target):\n    return 2\n",
                function_name="search_insert",
                tests=BY_SLUG["search-insert-position"]["sampleTests"],
                compare="exact",
                reveal_expected=True,
            )
        self.assertFalse(result["ok"])
        self.assertFalse(result["passedAll"])
        self.assertEqual(result["executor"], "piston")
        self.assertIn("does not run submitted code", result["error"])

    @patch("config.judge.run_piston")
    def test_sample_results_include_expected_values(self, piston):
        piston.return_value = {
            "executor": "piston",
            "stdout": json.dumps(
                {"results": [{"got": 2}, {"got": 1}], "stdout": "seen", "stderr": ""}
            )
            + "\n",
            "stderr": "",
            "error": None,
            "piston_blocked": False,
        }
        result = run_tests(
            code="def search_insert(nums, target):\n    return 0\n",
            function_name="search_insert",
            tests=BY_SLUG["search-insert-position"]["sampleTests"],
            compare="exact",
            reveal_expected=True,
        )
        self.assertTrue(result["passedAll"])
        self.assertEqual(result["results"][0]["expected"], 2)
        self.assertEqual(result["stdout"], "seen")
        sent = piston.call_args.args[0]
        self.assertIn("search_insert", sent)
        self.assertNotIn("hiddenTests", sent)
