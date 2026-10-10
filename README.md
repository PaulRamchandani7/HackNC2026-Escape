# CODE: ADRIFT

Lost at sea. Trapped aboard. Code your way home.

A single-player coding escape room written in **Python**. You wake up on an abandoned cargo ship, solve real LeetCode problems at damaged terminals, and unlock compartments until you reach the bridge.

Players write **Python** solutions in the browser (Monaco). The FastAPI server grades them with the same Piston / local-`python3` path used by [InterVue](https://github.com/rssalwekar/intervue).

## Stack

| Layer | Technology |
| --- | --- |
| API & game logic | Python 3.11+, FastAPI |
| Persistence | SQLite (`data/glitchlab.db`) |
| Judge | Piston (`python3`) with local `python3 -I` fallback |
| UI | Jinja2 templates + vanilla JS + Monaco CDN |
| Metadata | Unofficial LeetCode GraphQL (titles/ids/tags/links only) |

Problem briefs and tests are original. LeetCode statements are not copied. Submissions are never sent to LeetCode.

## The voyage

Five compartments, in order:

1. Crew Quarters — Easy arrays
2. Engine Room — Easy strings or hash maps
3. Communications Room — Medium strings or stacks
4. Navigation Room — Medium search or graph traversal
5. The Bridge — Medium graphs

**Run** checks the visible samples and does not unlock anything. **Submit** runs the hidden tests. The next compartment opens only when the server accepts the solution. Progress, selected problem ids, hints, and elapsed time live in SQLite. Code drafts stay in the browser (`localStorage`).

`supabase/schema.sql` is a matching Postgres sketch for a later hosted store. This demo does not require Supabase credentials.

## Execution

The API tries Piston first. The public emkc.org host currently answers **401 whitelist only**, so a failed Piston call falls back to a local `python3 -I` process with an 8-second timeout. Responses include `executor: "piston"` or `executor: "local-python"`.

To use a self-hosted Piston:

```bash
docker run --rm -p 2000:2000 ghcr.io/engineer-man/piston
# PISTON_URL=http://127.0.0.1:2000/api/v2/execute
```

Set `PISTON_ONLY=true` to disable the local fallback.

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
python -m code_adrift
```

Open **http://localhost:8787**

Useful commands:

```bash
# same as python -m code_adrift
code-adrift

# run reference solutions through the judge + live LeetCode list
python -m code_adrift.self_check
# or: code-adrift-check
```

## Layout

```
code_adrift/           # Python package (API, judge, LeetCode client, problem data)
  app.py               # FastAPI app + HTML routes
  judge.py             # Piston / local Python harness
  leetcode.py          # metadata fetch + mission room selection
  problems.py          # loads code_adrift/data/problems.json
  references.py        # reference solutions for self-check
  self_check.py
  data/                # problems.json, references.json
templates/             # Jinja pages (home, intro, ship, terminal, finale)
static/                # CSS + client JS (Monaco loaded from CDN)
supabase/schema.sql    # optional Postgres sketch
scripts/               # maintenance helpers (optional data re-export)
```

## Environment

See `.env.example`. Important knobs:

- `PORT` — default `8787`
- `DATABASE_PATH` — default `./data/glitchlab.db`
- `PISTON_URL` / `PISTON_LANGUAGE` / `PISTON_VERSION`
- `PISTON_ONLY` — fail closed when Piston rejects
- `PYTHON` — interpreter for the local fallback (default `python3`)
