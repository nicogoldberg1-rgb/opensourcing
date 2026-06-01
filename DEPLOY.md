# Deploy guide — public landing page + live fixture demo

Two independent pieces, two hosts:

| Piece | What it is | Host | URL |
|-------|------------|------|-----|
| **Landing page** | Static front door (`landing/`) | **Vercel** | `opensourcing.dev` |
| **Live demo** | The dashboard in **fixture mode** (Express + built SPA, one port) | **Render** | `nsp-dashboard-demo.onrender.com` |

The landing page links to the demo. Neither touches real data — the demo runs
fixture mode only (fake data, no keys, no spend, no Claude). **Never deploy real
mode to a public host.**

---

## 1. Live demo on Render (the dashboard, fixture mode)

The blueprint is committed at repo root: [`render.yaml`](./render.yaml).

It builds both halves (`npm run build` → `server/dist` + `web/dist`) and at boot
serves the SPA and `/api/*` from **one port** via Express. Env is locked to
`NSP_FIXTURE_MODE=1`, so there is nothing to spend and no secrets to set.

**One-time setup (Nico clicks):**
1. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
2. Connect the GitHub repo `nicogoldberg1-rgb/nsp-dashboard` (authorize Render to
   read it; the repo is private).
3. Render detects `render.yaml` and proposes a web service named
   **`nsp-dashboard-demo`** on the **Free** plan. Confirm/apply.
4. First build takes ~2–4 min. When it's live, the URL is
   **`https://nsp-dashboard-demo.onrender.com`**.

**Verify:** open the URL — the app loads with the amber *"Fixture mode — demo
data"* banner and the role pill shows **owner**. Every page (Home, Sequences,
Live cycle, Spend, Roadmap, Requests) has data. `…/api/health` returns
`{"ok":true,"fixture":true,...}`.

**Notes / knobs:**
- **Default role:** `NSP_DEFAULT_ROLE=owner` in `render.yaml` shows the full app
  incl. the approval inbox. To show the sales-intern view instead, change it to
  `operator` (spend buttons become *"Request run"*) and redeploy.
- **Free-tier sleep:** the service spins down after ~15 min idle; the first hit
  after that takes ~30–50s to wake. Fine for a demo.
- **No persistence:** fixture writes (e.g. approving a niche) don't survive a
  restart — the demo self-resets from the committed seed on every boot. That's
  intended.
- If a build ever fails on Node version, the blueprint pins `NODE_VERSION=22`.

---

## 2. Landing page on Vercel (`opensourcing.dev`)

The landing page is a single self-contained static file: `landing/index.html`
(no build step). `opensourcing.dev` is already registered on Nico's Vercel.

**One-time setup (Nico clicks):**
1. <https://vercel.com> → **Add New** → **Project** → import
   `nicogoldberg1-rgb/nsp-dashboard`.
2. **IMPORTANT — set Root Directory to `landing`** (Project Settings → Build &
   Output, or in the import screen). Framework Preset: **Other**. No build
   command, no install command — it serves the static dir as-is.
3. Deploy. Vercel gives a `*.vercel.app` URL first.
4. **Attach the domain:** Project → **Settings → Domains** → add
   `opensourcing.dev` (and `www.opensourcing.dev` → redirect to apex). Since the
   domain is already on Nico's Vercel account, it attaches without DNS changes.

**Verify:** `https://opensourcing.dev` renders the hero + two cards; "Open the
demo" goes to the Render URL; "View on GitHub" + the clone command resolve.

> If you later move `opensourcing.dev`'s DNS to Cloudflare (for Handoff 2's
> tunnel on `app.opensourcing.dev`), keep the apex/`www` records pointing at
> Vercel — only the `app.` subdomain goes to the Cloudflare tunnel.

---

## 3. Optional: `demo.opensourcing.dev` → Render

Nicer than the raw `onrender.com` URL.
1. In Render: service → **Settings → Custom Domains** → add
   `demo.opensourcing.dev`. Render shows a CNAME target.
2. Add that CNAME wherever `opensourcing.dev` DNS lives (Vercel DNS now, or
   Cloudflare later).
3. Update the demo link in `landing/index.html` (the `Open the demo` href and the
   hero pill) from `nsp-dashboard-demo.onrender.com` to `demo.opensourcing.dev`,
   commit, and Vercel redeploys the landing automatically.

---

## Updating after first deploy
Both hosts auto-deploy on push to `main`:
- Push that touches `server/`, `web/`, or `render.yaml` → Render rebuilds the demo.
- Push that touches `landing/` → Vercel redeploys the landing page.

## Local production smoke test (before pushing)
```bash
npm install
npm run build
npm run fixture:seed
NSP_FIXTURE_MODE=1 NSP_DEFAULT_ROLE=owner PORT=4100 node server/dist/index.js
# open http://localhost:4100  → full app, fixture banner, one port serves SPA + /api
```
