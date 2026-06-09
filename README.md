# Open Sourcing by NSP

**Search on easy mode.** An end-to-end, multi-channel outreach system for
search-fund entrepreneurs — niche ideation → company sourcing → screening →
personalized email, LinkedIn, and physical mail — all run by [Claude Code](https://claude.com/claude-code)
agents.

Spend your time on the things that actually move a search forward — building
industry theses, talking to owners, diligencing deals — and leave the rest to the
agents.

> Built by a searcher, for the searcher community.
> _Open Sourcing_ is built by [NSP (Nico's Search Partners)](https://partnerwithnico.com).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-5b5bd6.svg)](https://nsp-dashboard-demo.onrender.com)
[![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-d97757.svg)](https://claude.com/claude-code)

> **Disclaimer:** today this is wired to the specific tools one searcher (Nico)
> uses — Inven for sourcing, Reply.io for email sequencing, Lob for mail. The plan
> is to open source it so others can see how the whole thing fits together and
> adapt it to their own tools. Making the tools and templates pluggable (bring
> your own) is on the [roadmap](#roadmap).

---

## Try the live demo

**→ [nsp-dashboard-demo.onrender.com](https://nsp-dashboard-demo.onrender.com)**

The demo runs in **fixture mode**: 100% fake sample data, no API keys, no spend,
no agents spawned. Click everything freely.

Landing page: **[opensourcing.dev](https://opensourcing.dev)**

Want the version you can run with your *own* playbook when it ships? **[Join the waitlist →](https://opensourcing.dev/#waitlist)**

---

## What it does

This is the **control surface** for an autonomous search-fund outreach pipeline.
The pipeline itself is a set of Claude Code skills that do everything from
suggesting industry theses to building ready-to-send outreach completely
autonomously.

Claude Agents:

1. **Ideate** a niche and shape the company search.
2. **Source** matching companies (via [Inven](https://inven.ai) MCP) and **screen**
   them against acquisition criteria.
3. **Find** owner/CEO contacts and **personalize** the outreach.
4. **Build** a multi-channel sequence — email ([Reply.io](https://reply.io)) +
   LinkedIn + physical ([Lob](https://lob.com)) letters — staged with sensible
   cadence.

The dashboard lets you watch and steer that pipeline: see live cycles,
approve queued industries, and approve spend before it happens.

### Search on easy mode

- **End-to-end, multi-channel.** One pipeline from "I have a thesis" to "the
  sequence is built and ready to send" across email, LinkedIn, and mail.
- **Agent-run, human-steered.** Claude Code agents do the legwork; you make the
  judgment calls.
- **Collaborative workflows.** Teammates or interns can plug in and build
  industry theses that the searcher can then approve from the Open Sourcing UI.

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
fixtures: a complete, runnable demo of how the system works — designed to sit in
front of an autopilot "brain." (A documented way to bring your own brain is on
the [roadmap](#roadmap).)

**Make it yours.** Everything that reflects a particular search is meant to be
customized, not copied. My buy-box criteria, niche scoring, and outreach
templates fit *my* fund — yours may be different! The point isn't to run my
playbook; it's to give you a working system to make your own.

**Want the runnable, customizable version?** That's what I'm building next — a
release you can point at your own playbook (or shared, generic skills) instead of
mine. **[Join the waitlist →](https://opensourcing.dev/#waitlist)** and I'll let you know the moment it's ready.

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
and tell me what you'd want it to do. And if you want the customizable version
when it ships, **[join the waitlist](https://opensourcing.dev/#waitlist)**.

---

## License

[MIT](./LICENSE) © 2026 Nicolas Goldberg.

Built with [Claude Code](https://claude.com/claude-code).
