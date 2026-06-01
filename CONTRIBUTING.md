# Contributing (dev guide)

This dashboard is the control surface for an outreach autopilot. In normal
operation the backend reads the operator's real autopilot state, calls real
APIs (Reply.io, Inven, Lob), and can spawn Claude. **You do not need any of
that to develop.** Use fixture mode.

## Fixture mode (start here)

```bash
npm install
npm run dev:fixture     # server on :4000 (fake data), web on :5173
```

Open http://localhost:5173 — you'll see an amber **"Fixture mode"** banner.

In fixture mode the backend:
- reads bundled fake data from `fixtures/` instead of the operator's machine,
- returns canned Reply.io / Inven / Lob / Anthropic data (no network calls, no keys),
- **never spawns Claude and never spends money** — investigate/run-cycle/orchestrator are simulated.

So you can click everything freely. Mutations (status changes, seeds, roadmap,
reorders, the approval inbox) all work and persist to local files you can reset:

```bash
git checkout fixtures/                 # reset the fake tracker
rm -f server/data/*.json               # reset roadmap/priorities/requests
```

## Previewing roles

Add `?role=operator` (or `?role=viewer`) to the URL to see the intern/limited
experience. Default is `owner`. (In production, roles come from the
authenticated email — see `server/src/lib/roles.ts`.)

## Layout

- `server/` — Express + TS. One file per concern in `src/lib`, one per endpoint
  group in `src/routes`. The fixture switch is `src/config.ts` (`FIXTURE_MODE`);
  each external touchpoint checks it and returns canned data.
- `web/` — Vite + React + TS + Tailwind. Pages in `src/pages`, shared UI in
  `src/components`, API client in `src/lib/api.ts`, types in `src/lib/types.ts`.

## Before opening a PR

```bash
cd web && npx tsc -b           # web typecheck
cd ../server && npx tsc -p tsconfig.json --noEmit   # server typecheck
```

Open PRs against `main`. Nico reviews and merges — nothing you push runs against
real data until merged and deployed on his machine.

## What NOT to touch

- Anything outside this repo (the autopilot lives in a separate repo; you get a
  read-only view of it to propose changes, not edit it here).
- Real credentials — there are none in this repo; fixture mode needs none.
