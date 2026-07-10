export type NicheStatus =
  | "seed"
  | "proposed"
  | "approved"
  | "queued"
  | "in_progress"
  | "cycle_complete"
  | "activated"
  | "paused"
  | "completed"
  | "partial"
  | "rejected"
  | "ready"
  | "researched"
  | "in_conversation";

export type NicheScores = {
  growth: number;
  size: number;
  criticality: number;
  penetration: number;
  quality: number;
};

export type BuyBox = {
  business_type?: string | null;
  revenue_min?: number | null;
  revenue_max?: number | null;
  ebitda_min?: number | null;
  ebitda_max?: number | null;
  headcount_min?: number | null;
  headcount_max?: number | null;
  geography?: string | null;
  ownership?: string | null;
  notes?: string | null;
};

export type Niche = {
  id: string;
  slug?: string;
  name: string;
  status: NicheStatus;
  type?: string;
  region?: string;
  notes?: string;
  source?: string;
  scores?: NicheScores;
  adjacencies?: string[];
  sequence_id?: number | null;
  companies_contacted?: number;
  response_rate?: number | null;
  deliveries?: number;
  replies?: number;
  opens?: number;
  reply_rate?: number | null;
  open_rate?: number | null;
  business_type?: string;
  buy_box?: BuyBox;
  created?: string;
  completed?: string | null;
  proposed_at?: string;
  approved_at?: string;
  queued_at?: string;
  in_progress_at?: string;
  cycle_complete_at?: string;
  rejected_at?: string;
  paused_at?: string;
  history?: { at: string; status: string; reason?: string }[];
};

export type SequenceStep = {
  step: number;
  day: number;
  channel: "linkedin" | "email" | "letter";
  subject: string | null;
  body: string;
};

export type SequenceDetail = {
  id: number;
  name: string;
  niche_slug?: string;
  sample_contact: Record<string, string> | null;
  steps: SequenceStep[];
};

export type Tracker = {
  metadata?: Record<string, unknown>;
  industries: Niche[];
};

export type Priorities = {
  approved: string[];
  queued: string[];
};

export type Sequence = {
  id: number;
  name: string;
  is_test: boolean;
  niche_slug?: string;
  created: string;
  status: number;
  status_label: string;
  email_account?: string;
  contacts: {
    total: number;
    active: number;
    paused: number;
    finished: number;
  };
  deliveries: number;
  opens: number;
  replies: number;
  bounces: number;
  out_of_office: number;
  opt_outs: number;
  open_rate: number | null;
  reply_rate: number | null;
};

export type SequencesPayload = {
  sequences: Sequence[];
  fetched_at: string;
};

export type CycleState = {
  slug?: string;
  niche?: string;
  name?: string;
  mode?: string;
  conviction?: string;
  phase?: string;
  status?: string;
  halt_reason?: string | null;
  resume_action?: string;
  auto?: boolean;
  started_at?: string;
  halted_at?: string;
  sequence_id?: number;
  contacts?: number;
  credits_spent?: { export?: number; contact?: number; ai?: number };
  approvals?: Record<string, string>;
  keepers_at_halt?: number;
};

export type CyclePhase = {
  num: number;
  name: string;
  state: "pending" | "active" | "complete" | "halted";
  metric?: string;
  files: string[];
};

export type CycleActivity = {
  at: string | null;
  kind: "approval" | "halt" | "subskill";
  text: string;
  raw: Record<string, unknown>;
};

export type CycleSummary = {
  id: string;
  niche_slug: string;
  date: string;
  variant?: string;
  modified_at: string;
  is_active: boolean;
  needs_activation: boolean;
  state: CycleState;
  current_phase_num: number;
};

export type QACheckStatus = "pass" | "fail" | "warn";
export type QACheck = { id: string; label: string; status: QACheckStatus; detail?: string };
export type QAResult = { checks: QACheck[]; passed: number; failed: number; warned: number };

export type RoadmapColumn = "idea" | "next_up" | "in_progress" | "shipped";

export type RoadmapCard = {
  id: string;
  column: RoadmapColumn;
  title: string;
  description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
};

export type RoadmapBoard = {
  cards: RoadmapCard[];
};

export type LobSummary = {
  configured: boolean;
  mode: "test" | "live" | null;
  fetched_at: string;
  this_month: {
    count: number;
    total_usd: number;
    avg_usd: number | null;
  };
  recent: {
    id: string;
    to_name: string;
    to_city: string;
    price_usd: number;
    date_created: string;
    description: string | null;
  }[];
  note?: string;
};

export type SpendPayload = {
  inven: {
    balance: {
      fetched_at: string | null;
      balance: {
        export_credits: number;
        contact_credits: number;
        ai_enrichment_credits: number;
      } | null;
    };
    by_month: {
      month: string;
      export: number;
      contact: number;
      ai: number;
      verifalia: number;
      cycles: number;
    }[];
    this_month: {
      month: string;
      export: number;
      contact: number;
      ai: number;
      verifalia: number;
      cycles: number;
    };
  };
  lob: LobSummary;
  anthropic: {
    note: string;
    settings_url: string;
    usage: AnthropicUsage | null;
  };
};

export type AnthropicBucket = {
  input: number;
  cache_create: number;
  cache_read: number;
  output: number;
  messages: number;
};

export type AnthropicUsage = {
  scanned_at: string;
  files_scanned: number;
  last_5h: AnthropicBucket;
  last_24h: AnthropicBucket;
  this_week: AnthropicBucket;
  this_month: AnthropicBucket;
  by_day: { day: string; output: number; total_input: number; messages: number }[];
  top_projects: { project: string; output: number; messages: number }[];
};

export type CycleDetail = CycleSummary & {
  phases: CyclePhase[];
  activity: CycleActivity[];
  g4_pending: Record<string, unknown> | null;
  credit_spend: Record<string, unknown> | null;
  summary_md: string | null;
};

export type OrchestratorLastRun = {
  state: {
    last_run_at?: string;
    last_run_id?: string;
    last_run_outcome?:
      | "success"
      | "partial"
      | "failed"
      | "idle_brainstorm";
    last_niche?: string;
    last_summary?: string;
    current_run_id?: string;
  };
  latestLog: {
    name: string;
    mtime: string;
    digest: string;
  } | null;
  lockActive: boolean;
};

export type Role = "owner" | "operator" | "viewer";

export type Me = {
  role: Role;
  email: string | null;
  source: string;
  pending_requests: number;
  fixture: boolean;
};

export type RequestKind = "run-cycle" | "orchestrator";
export type RequestStatus = "pending" | "approved" | "denied" | "executed" | "failed";

export type ActionRequest = {
  id: string;
  kind: RequestKind;
  slug?: string;
  label: string;
  requested_by: string;
  requested_at: string;
  note?: string;
  status: RequestStatus;
  decided_by?: string;
  decided_at?: string;
  decision_note?: string;
  result_message?: string;
};

export type RequestsPayload = {
  role: Role;
  requests: ActionRequest[];
  weekly_inven_export: { week_start: string; export: number } | null;
};
