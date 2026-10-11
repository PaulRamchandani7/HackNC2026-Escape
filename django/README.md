# CODE: ADRIFT — Django

The React site at the repository root is unchanged and still runs with `npm run dev`.

This app serves the landing page, the story introduction, the deck plan, the coding terminal, and the finale. It loads LeetCode titles and links, and sends solutions to Piston for grading. An accepted hidden-test submit opens the next compartment. The React app remains in the repository as the visual reference.

## Setup

From the repository root, with Python 3.11 or newer and Docker Desktop:

```bash
python3 -m venv django/.venv
django/.venv/bin/pip install -r django/requirements.txt
cp django/.env.example django/.env
django/.venv/bin/python django/manage.py migrate
```

In `django/.env`, point the judge at the container from the next section:

```bash
PISTON_URL=http://127.0.0.1:2000/api/v2/execute
PISTON_LANGUAGE=python3
PISTON_VERSION=3.10.0
```

Without that file, debug mode stays on and the secret key is the development placeholder. The judge then calls the public Piston host, which rejects the request.

## Piston

Start this in its own terminal and leave it running:

```bash
docker run --rm --privileged -p 2000:2000 \
  -v piston-data:/piston \
  --tmpfs /run:rw,nosuid,nodev,exec,mode=755 \
  -e PISTON_RUN_TIMEOUT=10000 \
  -e PISTON_RUN_CPU_TIME=10000 \
  --name piston \
  ghcr.io/engineer-man/piston
```

Then install Python 3.10.0 once:

```bash
curl -X POST http://127.0.0.1:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language":"python","version":"3.10.0"}'
```

`--privileged`, the `/piston` volume, and the writable `/run` tmpfs are what let the sandbox start on Docker Desktop. `PISTON_RUN_TIMEOUT` must be at least 8000. The image's default limit is 3000, and a shorter limit comes back as `Piston error (400)`.

## Run

```bash
django/.venv/bin/python django/manage.py runserver 127.0.0.1:8000
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/). Port 8000 keeps this process away from the React site on port 5173 and its API on port 8787.

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

LeetCode metadata is cached in the Django SQLite database. If LeetCode is unavailable, the last cache or the built-in seed titles are used. Problem statements are the original briefs, not LeetCode's text.
