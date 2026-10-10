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

Anonymous guest sessions are stored in local SQLite (`data/glitchlab.db`). `supabase/schema.sql` is a matching Postgres sketch for a later hosted store. This demo does not require Supabase credentials.

## Execution

The API tries Piston first. The public emkc.org host currently answers **401 whitelist only**, so a failed Piston call falls back to a local `python3 -I` process with an 8-second timeout. Responses include `executor: "piston"` or `executor: "local-python"`. A result is accepted only when that process returns matching outputs. The local process is real execution, not a container sandbox.

To use Piston:

```bash
docker run --rm -p 2000:2000 ghcr.io/engineer-man/piston
# PISTON_URL=http://127.0.0.1:2000/api/v2/execute
```

Set `PISTON_ONLY=true` to disable the local fallback.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

- API: `http://localhost:8787`
- Web: `http://localhost:5173`

`npm run check:judge` runs the reference solutions through the judge and requests a live LeetCode list.
