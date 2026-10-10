# CODE: ADRIFT — Django

The React site at the repository root is unchanged and still runs with `npm run dev`.

This app serves the landing page, the deck plan, and the coding terminal. It loads LeetCode titles and links, and sends solutions to Piston for grading. Doors still do not unlock.

## Setup

From the repository root:

```bash
python3 -m venv django/.venv
django/.venv/bin/pip install -r django/requirements.txt
cp django/.env.example django/.env
django/.venv/bin/python django/manage.py migrate
```

`.env` is optional for local development. Without it, debug mode stays on and the secret key is the development placeholder.

## Run

```bash
django/.venv/bin/python django/manage.py runserver 127.0.0.1:8000
```

Port 8000 keeps this process away from the existing site on port 5173 and its API on port 8787.

## Check

```bash
curl http://127.0.0.1:8000/health/
```

Expected body:

```json
{"ok": true, "service": "code-adrift"}
```

`/` is the landing page. `/ship/` is the deck plan. `/room/1/` through `/room/5/` are the coding terminals. `/health/` stays a JSON check. `/admin/` is Django's admin site and has no users until a later phase.

The story introduction is still the React app on port 5173. **Begin Your Escape** links to `/intro/`, which is not built yet. On the deck plan, Crew Quarters is open and the other rooms are sealed. Restart Journey asks LeetCode for a new set of five problems. Opening Crew Quarters goes to `/room/1/`. Rooms 2–5 show a sealed compartment if you open the URL directly. Run grades the visible samples through Piston. Submit grades the hidden tests through Piston and does not open the next door. A saved voyage's Continue Journey button stays on the React site. The editor loads Monaco from the jsDelivr CDN.

LeetCode metadata is cached in the Django SQLite database. If LeetCode is unavailable, the last cache or the built-in seed titles are used. Problem statements are the original briefs, not LeetCode's text.

Set `PISTON_URL` when you have a Piston API. The public `https://emkc.org/api/v2/piston/execute` host is whitelist-only, and this app does not fall back to running code on the Django machine.
