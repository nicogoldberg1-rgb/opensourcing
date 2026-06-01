# Data shapes the dashboard consumes

Everything below is **read-only** from the dashboard's perspective unless a
`lib/state.py` mutation path is noted. Sources of truth:

- Autopilot repo: `/Users/nicolasgoldberg/conductor/workspaces/open-sourcing/porto`
  (referred to as `$AUTOPILOT_REPO` below)
- Autopilot state dir: `~/Library/Application Support/nsp-autopilot/`
  (referred to as `$NSP_STATE` below)

---

## 1. Industry tracker (`$NSP_STATE/industry-tracker.json`)

The canonical niche state machine. Used by the home-screen kanban.

```ts
type Tracker = {
  metadata: {
    search_start: string;        // "2025-10"
    last_updated: string;        // "2026-03-24"
    principal: string;
    fund: string;
    q1_stats?: { total_companies_contacted: number; avg_response_rate: number; note: string };
  };
  industries: Niche[];
  meta?: { created_at?: string; updated_at?: string }; // written by lib/state.py
};

type Niche = {
  id: string;                    // slug, e.g. "compliance-software"
  slug?: string;                 // duplicate of id on newer entries
  name: string;                  // "Compliance Software"
  status: NicheStatus;           // see below
  type?: "industry" | "geo-industry";
  region?: string;
  notes?: string;                // free text; often contains `Tailwind: ...` line + 4+1 inline scores
  source?: string;               // e.g. "orchestrator-brainstorm"
  scores?: { growth: number; size: number; criticality: number; penetration: number; quality: number }; // 1–5 each
  adjacencies?: string[];        // sibling slug ids
  sequence_id?: number | null;   // Reply.io sequence id once built
  companies_contacted?: number;
  response_rate?: number | null;
  calls?: number | null;
  pipeline_deals?: number | null;
  business_type?: string;
  buy_box?: { business_type?: string; notes?: string; headcount_min?: number; headcount_max?: number };
  created?: string;              // "2025-10"
  completed?: string | null;
  // status-transition timestamps written by lib/state.py:
  proposed_at?: string;
  approved_at?: string;
  queued_at?: string;
  in_progress_at?: string;
  cycle_complete_at?: string;
  rejected_at?: string;
  paused_at?: string;
  history?: { at: string; status: NicheStatus; reason?: string }[];
};

type NicheStatus =
  // active orchestrator state machine (per lib/state.py VALID_STATES):
  | "seed" | "proposed" | "approved" | "queued"
  | "in_progress" | "cycle_complete" | "activated" | "paused"
  // legacy /industry-tracker skill states still in the file:
  | "completed" | "partial" | "rejected"
  | "ready" | "researched" | "in_conversation";
```

**Kanban mapping (home screen):**
- Primary columns left→right: `seed`, `proposed`, `approved`, `queued`,
  `in_progress`, `cycle_complete`.
- Collapsible side lane: `rejected`, `paused`.
- Archive lane (legacy statuses): `completed`, `partial`, `ready`,
  `researched`, `in_conversation`. Don't lose them, but they're not part of
  the active state machine.

**Mutations** — never write directly. Shell out:

```bash
python3 $AUTOPILOT_REPO/lib/state.py set-status <slug> <new_status> [--reason ...]
python3 $AUTOPILOT_REPO/lib/state.py add-proposed <slug> --name "..." --notes "..."
python3 $AUTOPILOT_REPO/lib/state.py list-queued
python3 $AUTOPILOT_REPO/lib/state.py summary
```

`set-status` rejects unknown statuses (see `VALID_STATES` in `state.py`).

---

## 2. Orchestrator state (`$NSP_STATE/orchestrator-state.json`)

Thin log of the most recent autopilot run. Used by the home-screen "Last
night's digest" panel.

```ts
type OrchestratorState = {
  last_run_at: string;           // ISO8601
  last_run_id: string;           // uuid
  last_run_outcome: "success" | "partial" | "failed" | "idle_brainstorm";
  last_niche: string;            // slug or "none" (idle_brainstorm)
  last_summary?: string;         // short human-readable line
  current_run_id?: string;       // present only while a run is actively in progress
};
```

The richer digest text lives in `$NSP_STATE/orchestrator-logs/run-<YYYYMMDD-HHMMSS>.log`.
The newest file is the one to render — it contains the markdown digest emitted
by `/autonomous-orchestrator` between `----- begin claude output -----` and
end-of-file.

A run is "in progress" iff `orchestrator-state.json.current_run_id` is set or
`$NSP_STATE/orchestrator.lock` exists (mtime < 4h).

---

## 3. Per-cycle artifacts (`$AUTOPILOT_REPO/.context/run-cycle-<slug>-<YYYY-MM-DD>/`)

Live cycle progress. Polled every 2–3s by the live-cycle screen.

```
run-cycle-<slug>-<date>/
├── state.json                   # overall phase + niche + sequence_id
├── phase-1-search.json          # phase outputs as they complete
├── phase-2-pull.json
├── phase-3-screen.json
├── phase-4-contacts.json
├── phase-5-personalize.json
├── auto-approvals.log           # JSONL — one line per auto-approved gate
├── auto-halts.log               # JSONL — halts requiring human action
├── g4-pending.json              # present iff cycle halted at Reply.io activation gate
├── theses/                      # per-tier thesis email drafts
├── outreach/                    # per-contact sign-offs + LinkedIn messages
└── seq/                         # final Reply.io sequence payload
```

```ts
type CycleState = {
  phase: string;                 // e.g. "3-screen", "6-complete-halted-G4"
  mode: "A" | "B";               // A = thesis-first niche, B = saved-list mode
  niche: string;                 // slug
  sequence_id?: number;          // present once Reply.io sequence is built
  contacts?: number;             // contact count once known
};

type Phase3Screen = {
  keep: string[];                // kept domains
  decisions: Record<string, ["KEEP" | "DROP", string /* reason */]>;
};

// auto-approvals.log (JSONL):
type ApprovalEvent =
  | { gate: "G0" | "G1" | "G2" | "G3"; amount: number; cap: number | "unconditional"; at: string }
  | { sub_skill: string; mode?: string; thesis_subject?: string; n_contacts?: number; at: string; run_id?: string }
  | { sub_skill: string; n_contacts?: number; n_risks_flagged?: number; websites_failed?: number; at: string };

// g4-pending.json:
type G4Pending = {
  gate: "G4";
  status: "halted_awaiting_human_activation";
  sequence_id: number;
  sequence_name: string;
  sequence_status: string;       // typically "new"
  contact_count: number;
  conviction: "Low" | "Med" | "High";
  tier: "A" | "B" | "C";
  steps: string;                 // e.g. "LinkedIn Day0 + 6 emails (D3/D6/D11/D17/D23/D27)"
  sample: { name: string; company: string; email: string }[];
  // ...plus tier-specific fields (tier_c_question, email3_identity, lob_test)
};
```

**Phase order** (for the timeline UI):
1. Preview / Search
2. Sample
3. Pull
4. Screen
5. Contacts
6. Personalize
7. Sequence build
8. Letters (optional)

**Active vs. recent cycles:** the most recent `run-cycle-*` dir whose
`state.json.phase` does NOT start with `6-complete-` is the live cycle.

---

## 4. Reply.io (REST API)

API key: `X-Api-Key` header (stored under `mcpServers["reply-io"].headers["X-Api-Key"]`
in `~/.claude.json`). Base URL: `https://api.reply.io`.

Endpoints we use (read-only):
- `GET /api/v1/sequences` — list sequences with counts.
- `GET /api/v1/sequences/{id}` — single sequence detail (steps, contacts).
- `GET /api/v1/sequences/{id}/statistics` — opens, replies, clicks per step.

Sequence shape (subset):
```ts
type ReplySequence = {
  id: number;
  name: string;                  // e.g. "TEST_compliance-software-2026-05-21"
  status: "New" | "Active" | "Paused" | "Completed";
  contactsCount: number;
  opensCount?: number;
  repliesCount?: number;
  clicksCount?: number;
  createdDate: string;           // ISO
  modifiedDate?: string;
};
```

Niche slug is recoverable from the sequence name pattern
`[TEST_]<slug>-<YYYY-MM-DD>` — we'll prefix-match the niche `id` to surface
the niche → sequence link.

---

## 5. Dashboard-local state (`<dashboard-repo>/data/roadmap.json`)

Owned by the dashboard, not autopilot.

```ts
type RoadmapBoard = {
  columns: { id: "idea" | "next_up" | "in_progress" | "shipped"; label: string }[];
  cards: {
    id: string;                  // uuid
    column: "idea" | "next_up" | "in_progress" | "shipped";
    title: string;
    description?: string;
    tags?: string[];
    created_at: string;          // ISO
    updated_at: string;
  }[];
};
```

---

## 6. Spend sources

- **Inven credits** — `mcp__inven__get_credit_balance` (deferred MCP tool).
  Fallback: read cached file if the autopilot writes one (TBD; placeholder
  acceptable in V1).
- **Lob** — `GET https://api.lob.com/v1/letters?date_created[gte]=<month-start>`
  with Basic auth. We don't have the Lob key yet; placeholder until provided.
- **Anthropic Max plan** — no clean API. Render a placeholder card linking to
  `https://claude.ai/settings/usage`. **Never fabricate a number.**
