# CODE: ADRIFT

Lost at sea. Trapped aboard. Code your way home.

A single-player coding escape room. You wake up on an abandoned cargo ship, solve real LeetCode problems at damaged terminals, and unlock compartments until you reach the bridge.

## What InterVue contributes

[InterVue](https://github.com/rssalwekar/intervue) is the reference for three integrations:

- **LeetCode.** `ai_interview/leetcode_service.py` posts to the unofficial `https://leetcode.com/graphql` endpoint (`problemsetQuestionList` / `question`). There is no official public problem API. CODE: ADRIFT uses that endpoint for titles, question ids, difficulty, topic tags, and links. Metadata is cached in SQLite. A seed of last-known metadata is used if the site is down.
- **Monaco.** InterVue loads Monaco from a CDN. This app uses `@monaco-editor/react` for Python editing.
- **Piston.** InterVue calls `https://emkc.org/api/v2/piston/execute` with `language: python3` and `version: 3.10.0`. This app keeps that request shape on the server so hidden tests never reach the browser.

LeetCode problem statements are not copied. Each room shows the official title and link, plus an original brief and original tests. The server only assigns problems it can actually grade. Submissions are not sent to LeetCode.

## The voyage

Five compartments, in order:

1. Crew Quarters — Easy arrays
2. Engine Room — Easy strings or hash maps
3. Communications Room — Medium strings or stacks
4. Navigation Room — Medium search or graph traversal
5. The Bridge — Medium graphs

Run checks the visible samples and does not unlock anything. Submit runs the hidden tests. The next compartment opens only when the server accepts the solution. Progress, selected problem ids, hints, and elapsed time live in the database. Code drafts stay in the browser.

The Django app stores that progress in `django/db.sqlite3`. The React reference uses `data/glitchlab.db`. `supabase/schema.sql` is a Postgres sketch and is not required to run locally.

## Open it locally

You need Python 3.11 or newer, and Docker Desktop. The page you open is the Django app on port 8000. Submitted code is graded by a Piston container you run yourself. Django does not run that code on your machine, and the public Piston host rejects these requests.

From the repository root:

1. Install the app and create the database.

```bash
python3 -m venv django/.venv
django/.venv/bin/pip install -r django/requirements.txt
cp django/.env.example django/.env
django/.venv/bin/python django/manage.py migrate
```

2. In `django/.env`, set the judge URL:

```bash
PISTON_URL=http://127.0.0.1:2000/api/v2/execute
PISTON_LANGUAGE=python3
PISTON_VERSION=3.10.0
```

3. Start Piston. Leave this terminal open. The extra flags are required: a plain `docker run -p 2000:2000` exits on Docker Desktop because the image cannot create its sandbox directories, and the default 3 second limit rejects the app's 8 second runs.

```bash
docker run --rm --privileged -p 2000:2000 \
  -v piston-data:/piston \
  --tmpfs /run:rw,nosuid,nodev,exec,mode=755 \
  -e PISTON_RUN_TIMEOUT=10000 \
  -e PISTON_RUN_CPU_TIME=10000 \
  --name piston \
  ghcr.io/engineer-man/piston
```

4. In a second terminal, install the Python runtime once. Wait until the command prints the language and version.

```bash
curl -X POST http://127.0.0.1:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language":"python","version":"3.10.0"}'
```

5. Start the site.

```bash
django/.venv/bin/python django/manage.py runserver 127.0.0.1:8000
```

6. Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/). Choose **Begin Your Escape**, skip or click through the briefing, then **Enter the First Room**.

`curl http://127.0.0.1:8000/health/` should return `{"ok": true, "service": "code-adrift"}`.

Run checks the samples and does not unlock the next door. Submit checks the hidden tests. A pass opens the next compartment. The fifth pass ends the voyage.

## React reference

The original React site is still in this repository. It is not the app on port 8000.

```bash
cp .env.example .env
npm install
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:8787`

That API tries Piston, then falls back to a local `python3` process. The Django app has no local fallback. `npm run check:judge` runs the reference solutions through the React API's judge.
