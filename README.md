# Open Sourcing by NSP

**Searching on easy mode.** An end-to-end, multi-channel outreach system for
search-fund entrepreneurs — niche ideation → company sourcing → screening →
personalized email, LinkedIn, and physical mail — run by [Claude Code](https://claude.com/claude-code)
agents.

Spend your time on the things that actually move a search forward — talking to
owners, diligencing deals, building industry theses — and leave the rest to the
agents.

> Built by a searcher, for the searcher community.
> _Open Sourcing_ is by [NSP (Nico's Search Partners)](https://partnerwithnico.com).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-5b5bd6.svg)](https://nsp-dashboard-demo.onrender.com)
[![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-d97757.svg)](https://claude.com/claude-code)

---

## Try the live demo

**→ [nsp-dashboard-demo.onrender.com](https://nsp-dashboard-demo.onrender.com)**

The demo runs in **fixture mode**: 100% fake sample data, no API keys, no spend,
no agents spawned. Click everything freely. (It's on a free tier, so the first
load after it's been idle can take ~30–50s to wake up.)

Landing page: **[opensourcing.dev](https://opensourcing.dev)**

---

## What it does

This is the **control surface** for an autonomous search-fund outreach pipeline.
The pipeline itself is a set of Claude Code agents that take a niche thesis all
the way to ready-to-send outreach:

1. **Ideate** a niche and shape the company search.
2. **Source** matching companies (via [Inven](https://inven.ai)) and **screen**
   them against acquisition criteria.
3. **Find** owner/CEO contacts and **personalize** the outreach.
4. **Build** a multi-channel sequence — email ([Reply.io](https://reply.io)) +
   LinkedIn + physical ([Lob](https://lob.com)) letters — staged with sensible
   cadence.

The dashboard lets you watch and steer that pipeline: see live cycles, review
what's queued, manage the roadmap, and approve spend before it happens.

### Searching on easy mode

- **End-to-end, multi-channel.** One pipeline from "I have a thesis" to "the
  sequence is built and ready to send" across email, LinkedIn, and mail.
- **Agent-run, human-steered.** Claude Code agents do the legwork; you make the
  judgment calls.
- **Safe to demo and develop.** Fixture mode swaps every external touchpoint for
  canned data, so the whole app runs with zero keys and zero blast radius.
- **A human approves every dollar.** Operators (e.g. a teammate) can take any
  action up to "built and ready," but anything that *spends* — running a cycle,
  exporting contacts, sending mail — becomes a request the owner approves in an
  inbox. No agent and no teammate spends money on its own.

> **Heads up:** today this is wired to the specific tools one searcher (me) uses —
> Inven for sourcing, Reply.io for email sequencing, Lob for mail. It's open
> sourced so others can see how the whole thing fits together and adapt it.
> Making the tools and templates pluggable (bring your own) is on the
> [roadmap](#roadmap).

---

## Run it locally (no keys needed)

```bash
git clone https://github.com/nicogoldberg1-rgb/opensourcing.git
cd opensourcing
npm install
npm run dev:fixture
```

Open **http://localhost:5173** — you'll see an amber **"Fixture mode"** banner
and a fully populated app. This is the same thing the live demo runs: fake data,
no network calls, no spend, no agents.

Want to preview the limited "operator" view? Add `?role=operator` (or
`?role=viewer`) to the URL. Default is `owner`.

To run against a real autopilot instead of fixtures, see
**[CONTRIBUTING.md](./CONTRIBUTING.md)** and **[DEPLOY.md](./DEPLOY.md)**.

---

## Architecture

```
server/    Express + TypeScript. Reads autopilot state, calls Reply.io / Inven / Lob,
           and exposes a small REST API under /api/*. One file per concern in src/lib,
           one per endpoint group in src/routes. The fixture switch is src/config.ts.
web/       Vite + React + TypeScript + Tailwind. Pages in src/pages, shared UI in
           src/components, API client in src/lib/api.ts.
fixtures/  Bundled fake data that powers fixture mode (the demo + local dev).
landing/   Static landing page (opensourcing.dev).
```

- **Roles.** `owner` / `operator` / `viewer`, resolved from an authenticated
  email in production (or `?role=` locally). Operators are limited to non-spend
  actions; the owner holds the approval inbox.
- **Spend approval inbox.** Spend actions raise a request that the owner approves
  before anything executes.

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the dev guide and
**[DEPLOY.md](./DEPLOY.md)** for how the demo + landing page are deployed.

---

## What it deliberately does NOT do

These are guardrails, not gaps:

- It never **activates** an email sequence on its own — that stays a deliberate
  human action in the outreach tool's own UI.
- It never sends **live physical mail** on its own.
- It never writes autopilot state directly or edits the agent "brain."
- In fixture mode it makes **no** network calls and spends **no** money.

### Where the "brain" lives (and what doesn't ship here)

This repo is the **control surface** — and nothing else. It ships with **fake
sample data and no outreach copy of its own.** The pieces that make outreach
actually land — the voice rules, email and message templates, and industry
theses — live in a **separate private repo** (the "brain") and are **not part of
this project.** Clone this and you get the dashboard, the wiring, and fake
fixtures, ready to be pointed at a brain you bring yourself.

---

## Roadmap

- **Bring your own templates & sequences.** Today the dashboard expects *my*
  private brain. The plan is a supported, customizable layer where you plug in
  **your own** templates and sequences — with shared, generic helpers (like a
  writing "humanizer") available to everyone — without anyone having to adopt, or
  even see, my exact playbook.
- **More tool integrations.** Generalize the sourcing / email / mail channels
  beyond the specific tools wired up today.

Have ideas? Open an issue.

---

## Contributing

Contributions are welcome. The fastest path: run `npm run dev:fixture`, make your
change, and open a PR against `main`. See **[CONTRIBUTING.md](./CONTRIBUTING.md)**
for the dev guide (fixture mode, role preview, typecheck commands).

This is actively maintained, though as a solo project it may lag a little behind
issues — thanks for your patience.

---

## About / contact

Built by **Nicolas Goldberg**, a search-fund entrepreneur, as part of
**[NSP (Nico's Search Partners)](https://partnerwithnico.com)**.

- Open Sourcing: **[opensourcing.dev](https://opensourcing.dev)**
- About me / my search: **[partnerwithnico.com](https://partnerwithnico.com)**
- LinkedIn (me): **[nicolas-goldberg](https://www.linkedin.com/in/nicolas-goldberg/)**
- LinkedIn (NSP): **[nicossearchpartners](https://www.linkedin.com/company/nicossearchpartners/)**

If you're a fellow searcher (or an investor who knows a few), take it for a spin
and tell me what you'd want it to do.

---

## License

[MIT](./LICENSE) © 2026 Nicolas Goldberg.

Built with [Claude Code](https://claude.com/claude-code).
