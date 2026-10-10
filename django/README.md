# CODE: ADRIFT — Django

The React site at the repository root is unchanged and still runs with `npm run dev`.

This app serves the landing page, the story introduction, the deck plan, the coding terminal, and the finale. It loads LeetCode titles and links, and sends solutions to Piston for grading. An accepted hidden-test submit opens the next compartment. The React app remains in the repository as the visual reference.

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

`/` is the landing page. `/intro/` is the four-scene briefing. `/ship/` is the deck plan. `/room/1/` through `/room/5/` are the coding terminals. `/finale/` is the escape card. `/health/` stays a JSON check. `/admin/` is Django's admin site.

**Begin Your Escape** opens the briefing. The last scene saves a player and a five-room mission, then opens the deck. Without that mission, the deck, rooms, and finale send you home. A finished mission on the deck goes to the finale. The landing page shows **Continue Journey** while a mission is active and **Review Your Escape** after it is complete.

Crew Quarters starts open. Each later door stays sealed until the previous room's hidden tests are accepted. Run grades the visible samples through Piston and does not unlock anything. Submit grades the hidden tests through Piston. A pass records the attempt, opens the next compartment, and, on the fifth room, freezes the escape timer. Restart Journey and Play Again abandon the active mission and assign a new five, skipping problems this player has already solved when another match exists. Hints are remembered, and a repeated reveal does not increase the hint count. Draft code stays in this browser under `adrift.draft.<slug>`. The editor loads Monaco from the jsDelivr CDN.

The public Piston host is whitelist-only, so a live solution cannot be accepted until `PISTON_URL` points at a Piston instance you run. This app does not run submitted code itself.

LeetCode metadata is cached in the Django SQLite database. If LeetCode is unavailable, the last cache or the built-in seed titles are used. Problem statements are the original briefs, not LeetCode's text.

Set `PISTON_URL` when you have a Piston API. The public `https://emkc.org/api/v2/piston/execute` host is whitelist-only, and this app does not fall back to running code on the Django machine.
