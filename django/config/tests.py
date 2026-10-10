import io
import json
import urllib.error
from unittest.mock import patch

from django.test import TestCase

from .judge import matches, run_tests
from .models import Mission
from .rooms import BY_SLUG


def _offline(_query, _variables=None):
    raise RuntimeError("offline")


def _accepted():
    return {"ok": True, "passedAll": True, "results": [], "error": None}


class CatalogTests(TestCase):
    def setUp(self):
        patcher = patch("config.leetcode.graphql", side_effect=_offline)
        self.addCleanup(patcher.stop)
        patcher.start()

    def begin(self):
        response = self.client.post("/intro/start/")
        self.assertRedirects(response, "/ship/")
        return Mission.objects.get(id=self.client.session["adrift_mission_id"])

    def test_pages_without_a_mission_return_home(self):
        self.assertRedirects(self.client.get("/ship/"), "/")
        self.assertRedirects(self.client.get("/room/1/"), "/")
        self.assertRedirects(self.client.get("/finale/"), "/")
        self.assertNotContains(self.client.get("/"), "Continue Journey")

    def test_room_page_keeps_hidden_tests_on_the_server(self):
        mission = self.begin()
        response = self.client.get("/room/1/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sample A")
        self.assertNotContains(response, "Hidden A")
        self.assertNotIn("hidden_tests", response.context["plan"])
        difficulties = list(mission.rooms.order_by("room").values_list("difficulty", flat=True))
        self.assertEqual(difficulties, ["Easy", "Easy", "Medium", "Medium", "Medium"])

    def test_restart_assigns_a_new_voyage(self):
        first = self.begin()
        response = self.client.post("/ship/restart/")
        self.assertRedirects(response, "/ship/?notice=assigned")
        page = self.client.get("/ship/?notice=assigned")
        self.assertContains(page, "A new diagnostic sequence has been assigned.")
        second = Mission.objects.get(id=self.client.session["adrift_mission_id"])
        self.assertNotEqual(first.id, second.id)
        self.assertEqual(first.rooms.count(), 5)
        self.assertEqual(second.rooms.count(), 5)
        first.refresh_from_db()
        self.assertEqual(first.status, "abandoned")

    def test_landing_offers_continue_for_an_active_mission(self):
        self.begin()
        self.assertContains(self.client.get("/"), "Continue Journey")

    def test_sealed_room_is_not_judged(self):
        self.begin()
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
        self.begin()
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

    @patch("config.views.run_tests", return_value=_accepted())
    def test_accepted_submit_opens_the_next_room(self, _run_tests):
        self.begin()
        denied = self.client.post(
            "/room/1/run/",
            data=json.dumps({"code": "def solution():\n    return 1\n"}),
            content_type="application/json",
        )
        self.assertTrue(denied.json()["passedAll"])
        self.assertContains(self.client.get("/room/2/"), "Compartment sealed")
        response = self.client.post(
            "/room/1/submit/",
            data=json.dumps({"code": "def solution():\n    return 1\n"}),
            content_type="application/json",
        )
        body = response.json()
        self.assertEqual(body["unlockedNext"], 2)
        self.assertFalse(body["completed"])
        self.assertTrue(body["success"])
        opened = self.client.get("/room/2/")
        self.assertNotContains(opened, "Compartment sealed")
        deck = self.client.get("/ship/")
        self.assertContains(deck, "1 of 5 ship systems restored")
        self.assertContains(deck, "is-solved")

    @patch("config.views.run_tests", return_value=_accepted())
    def test_five_accepted_rooms_reach_the_finale(self, _run_tests):
        self.begin()
        last = None
        for number in range(1, 6):
            last = self.client.post(
                f"/room/{number}/submit/",
                data=json.dumps({"code": "def solution():\n    return 1\n"}),
                content_type="application/json",
            )
        self.assertTrue(last.json()["completed"])
        self.assertIsNone(last.json()["unlockedNext"])
        finale = self.client.get("/finale/")
        self.assertContains(finale, "You made it home")
        self.assertContains(finale, "Problems solved")
        self.assertContains(finale, "COURSE SET FOR HOME. YOU ESCAPED.")
        self.assertRedirects(self.client.get("/ship/"), "/finale/")
        self.assertContains(self.client.get("/"), "Review Your Escape")
        again = self.client.post("/finale/again/")
        self.assertRedirects(again, "/ship/")
        self.assertEqual(Mission.objects.filter(status="completed").count(), 1)
        self.assertEqual(Mission.objects.filter(status="active").count(), 1)

    def test_hints_are_saved_once(self):
        mission = self.begin()
        first = self.client.get("/room/1/hint/?index=0")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["hintsUsed"], 1)
        again = self.client.get("/room/1/hint/?index=0")
        self.assertEqual(again.json()["hintsUsed"], 1)
        self.assertEqual(again.json()["hint"], first.json()["hint"])
        page = self.client.get("/room/1/")
        self.assertContains(page, first.json()["hint"])
        mission.refresh_from_db()
        self.assertEqual(mission.hints_used, 1)
        self.assertRedirects(self.client.get("/finale/"), "/ship/")


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
