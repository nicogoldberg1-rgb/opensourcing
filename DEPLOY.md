# Deploy guide — public landing page + live fixture demo

Two independent pieces, two hosts:

| Piece | What it is | Host | URL |
|-------|------------|------|-----|
| **Landing page** | Static front door (`landing/`) | **Vercel** | `opensourcing.dev` |
| **Live demo** | The dashboard in **fixture mode** (Express + built SPA, one port) | **Render** | `nsp-dashboard-demo.onrender.com` |

The landing page links to the demo. Neither touches real data — the demo runs
fixture mode only (fake data, no keys, no spend, no Claude). **Never deploy real
mode to a public host.**

> **Live status:** Landing page is **deployed** — `https://opensourcing.dev`
> (Vercel project `opensourcing`, www → apex 308). **Render demo is NOT yet
> connected** — that's the one remaining manual step (§1); until then the landing
> page's "Open the demo" button 404s.

---

## 1. Live demo on Render (the dashboard, fixture mode)

The blueprint is committed at repo root: [`render.yaml`](./render.yaml).

It builds both halves (`npm run build` → `server/dist` + `web/dist`) and at boot
serves the SPA and `/api/*` from **one port** via Express. Env is locked to
`NSP_FIXTURE_MODE=1`, so there is nothing to spend and no secrets to set.

**One-time setup (Nico clicks):**
1. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
2. Connect the GitHub repo `nicogoldberg1-rgb/opensourcing` (authorize Render to
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
- **If the service shows "Running" but every request hangs / times out:** the
  Blueprint may have created the service without kicking off a first build (it has
  zero deploys + no logs). Fix: open the service → **Manual Deploy → Deploy latest
  commit**. After one successful deploy, pushes to `main` auto-redeploy normally.

---

## 2. Landing page on Vercel (`opensourcing.dev`) — DONE

Already deployed via the Vercel CLI (no dashboard import needed):
- Project: **`opensourcing`** (scope `nicos-projects-143561fc`), static, no build.
- Production: `https://opensourcing.vercel.app`, custom domain
  **`https://opensourcing.dev`** attached (verified), `www.opensourcing.dev` → apex
  308 redirect.

**It is CLI-deployed, not Git-connected**, so pushes to `main` do NOT auto-redeploy
the landing page. To ship a landing change:
```bash
cd landing && vercel deploy --prod --yes
```
(Or, if you'd rather have push-to-deploy: in the Vercel dashboard open the
`opensourcing` project → Settings → Git, connect the GitHub repo, and set
**Root Directory = `landing`**.)

**Verify:** `https://opensourcing.dev` renders the hero + two cards; "View on
GitHub" + the clone command resolve. "Open the demo" only works once §1 (Render)
is connected.

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
- **Demo (Render):** once connected, auto-deploys on push to `main` that touches
  `server/`, `web/`, or `render.yaml`.
- **Landing (Vercel):** CLI-deployed, so it does **not** auto-deploy. Redeploy with
  `cd landing && vercel deploy --prod --yes` (or connect Git per §2).

## Local production smoke test (before pushing)
```bash
npm install
npm run build
npm run fixture:seed
NSP_FIXTURE_MODE=1 NSP_DEFAULT_ROLE=owner PORT=4100 node server/dist/index.js
# open http://localhost:4100  → full app, fixture banner, one port serves SPA + /api
```
