# CODE: ADRIFT — Django

The React site at the repository root is unchanged and still runs with `npm run dev`.

This app serves the landing page, the deck plan, and the coding terminal. Sample judging is a later phase.

## Setup

From the repository root:

```bash
python3 -m venv django/.venv
django/.venv/bin/pip install -r django/requirements.txt
cp django/.env.example django/.env
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

The story introduction is still the React app on port 5173. **Begin Your Escape** links to `/intro/`, which is not built yet. On the deck plan, Crew Quarters is open and the other rooms are sealed. Restart Journey clears that on-page state only. Opening Crew Quarters goes to `/room/1/`. Rooms 2–5 show a sealed compartment if you open the URL directly. Each terminal currently shows one seed diagnostic. Run and Submit do not judge code yet. A saved voyage's Continue Journey button stays on the React site. The editor loads Monaco from the jsDelivr CDN.
