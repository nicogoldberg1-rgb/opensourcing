# NSP Autopilot Dashboard

Local web dashboard for Nico's search-fund outreach autopilot. Reads autopilot
state files and shells out to `lib/state.py` for mutations. Runs on
`localhost` — single user, no auth.

## Run

```bash
npm install            # installs root, web, and server (workspaces)
npm run dev            # starts Express on :4000 and Vite on :5173
```

Open <http://localhost:5173>.

## Env

A `.env` in `server/` (optional — sensible defaults if omitted):

```
AUTOPILOT_REPO=/Users/nicolasgoldberg/conductor/workspaces/open-sourcing/porto
NSP_STATE_DIR=/Users/nicolasgoldberg/Library/Application Support/nsp-autopilot
REPLY_IO_API_KEY=...   # falls back to ~/.claude.json mcpServers["reply-io"]
PORT=4000
```

## Layout

- `server/` — Express + TypeScript. Reads autopilot state, shells out to
  `lib/state.py`, calls Reply.io / Inven / Lob.
- `web/` — Vite + React + TypeScript + Tailwind. Frontend.
- `docs/data-shapes.md` — the JSON shapes this dashboard consumes.

## What it doesn't do

- Activate Reply.io sequences (always Nico's manual click in Reply.io UI).
- Send Lob LIVE letters (always `/send-letter --live` in Claude chat).
- Write to autopilot state files directly (always via `lib/state.py`).
- Edit autopilot source, skills, or the launchd plist.
