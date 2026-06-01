import { promises as fs } from "node:fs";
import path from "node:path";
import { CYCLE_DIRS_GLOB_ROOT, ORCH_LOCK } from "../paths.js";

const CYCLE_DIR_RE = /^run-cycle-(.+)-(\d{4}-\d{2}-\d{2})(?:-(.+))?$/;

export type PhaseState = "pending" | "active" | "complete" | "halted";

export type PhaseSummary = {
  num: number;
  name: string;
  state: PhaseState;
  metric?: string;
  files: string[];
};

export type ActivityEvent = {
  at: string | null;
  kind: "approval" | "halt" | "subskill";
  text: string;
  raw: Record<string, unknown>;
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

export type CycleDetail = CycleSummary & {
  phases: PhaseSummary[];
  activity: ActivityEvent[];
  g4_pending: unknown | null;
  credit_spend: unknown | null;
  summary_md: string | null;
};

const PHASE_NAMES: Record<number, string> = {
  1: "Search",
  2: "Pull",
  3: "Screen",
  4: "Contacts",
  5: "Personalize",
  6: "Sequence build",
  7: "Letters",
};

function parseDirName(name: string) {
  const m = name.match(CYCLE_DIR_RE);
  if (!m) return null;
  return { niche_slug: m[1], date: m[2], variant: m[3] };
}

function currentPhaseNum(phase?: string): number {
  if (!phase) return 0;
  const m = phase.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function readJsonSafe<T>(p: string): Promise<T | null> {
  return fs
    .readFile(p, "utf8")
    .then((raw) => JSON.parse(raw) as T)
    .catch(() => null);
}

async function listCycleDirs(): Promise<{ id: string; dirPath: string; mtime: Date }[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(CYCLE_DIRS_GLOB_ROOT);
  } catch {
    return [];
  }
  const out: { id: string; dirPath: string; mtime: Date }[] = [];
  for (const name of entries) {
    if (!CYCLE_DIR_RE.test(name)) continue;
    const dirPath = path.join(CYCLE_DIRS_GLOB_ROOT, name);
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) continue;
      out.push({ id: name, dirPath, mtime: stat.mtime });
    } catch {
      // ignore
    }
  }
  out.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return out;
}

async function lockActive(): Promise<boolean> {
  try {
    const stat = await fs.stat(ORCH_LOCK);
    return (Date.now() - stat.mtime.getTime()) / 3_600_000 < 4;
  } catch {
    return false;
  }
}

async function buildSummary(entry: {
  id: string;
  dirPath: string;
  mtime: Date;
}): Promise<CycleSummary | null> {
  const parsed = parseDirName(entry.id);
  if (!parsed) return null;
  const state = (await readJsonSafe<CycleState>(path.join(entry.dirPath, "state.json"))) ?? {};
  const phaseNum = currentPhaseNum(state.phase);
  const recent = Date.now() - entry.mtime.getTime() < 30 * 60_000;
  const halted = /halt/i.test(state.phase ?? "") || state.status === "halted";
  const complete = /complete/i.test(state.phase ?? "");
  const active = recent && !complete && !halted;
  const needsActivation = await fs
    .stat(path.join(entry.dirPath, "g4-pending.json"))
    .then(() => true)
    .catch(() => false);
  return {
    id: entry.id,
    niche_slug: parsed.niche_slug,
    date: parsed.date,
    variant: parsed.variant,
    modified_at: entry.mtime.toISOString(),
    is_active: active,
    needs_activation: needsActivation,
    state,
    current_phase_num: phaseNum,
  };
}

export async function listCycles(): Promise<CycleSummary[]> {
  const entries = await listCycleDirs();
  const summaries = await Promise.all(entries.map(buildSummary));
  return summaries.filter((s): s is CycleSummary => s !== null);
}

function metricFor(num: number, files: Record<string, unknown>): string | undefined {
  try {
    if (num === 1) {
      const search = files["phase-1-search.json"] as
        | { estimated_total_results?: number; filters?: unknown }
        | undefined;
      const sample = files["phase-1-sample.json"] as
        | { rows?: unknown[] }
        | undefined;
      if (sample?.rows) return `Sampled ${sample.rows.length} rows`;
      if (search?.estimated_total_results)
        return `~${search.estimated_total_results.toLocaleString()} total matches`;
    }
    if (num === 2) {
      // Sum any phase-2-*.json rows
      let total = 0;
      for (const [k, v] of Object.entries(files)) {
        if (!k.startsWith("phase-2")) continue;
        const obj = v as { rows?: unknown[] };
        if (Array.isArray(obj?.rows)) total += obj.rows.length;
      }
      if (total > 0) return `Pulled ${total.toLocaleString()} companies`;
    }
    if (num === 3) {
      for (const [k, v] of Object.entries(files)) {
        if (!k.startsWith("phase-3")) continue;
        const obj = v as {
          keep?: unknown[];
          decisions?: Record<string, unknown>;
        };
        const kept = obj?.keep?.length ?? 0;
        const total = obj?.decisions ? Object.keys(obj.decisions).length : kept;
        if (kept || total) return `Kept ${kept} of ${total}`;
      }
    }
    if (num === 4) {
      for (const [k, v] of Object.entries(files)) {
        if (!k.startsWith("phase-4")) continue;
        const obj = v as { contacts?: unknown[] };
        if (Array.isArray(obj?.contacts))
          return `${obj.contacts.length} contacts found`;
      }
    }
    if (num === 5) {
      for (const [k, v] of Object.entries(files)) {
        if (!k.startsWith("phase-5")) continue;
        const obj = v as { contacts?: unknown[]; count?: number };
        if (typeof obj?.count === "number")
          return `Personalized ${obj.count}`;
        if (Array.isArray(obj?.contacts))
          return `Personalized ${obj.contacts.length}`;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

function deriveState(
  num: number,
  current: number,
  cycleState: CycleState,
): PhaseState {
  if (current === 0) return "pending";
  if (current > num) return "complete";
  if (current < num) return "pending";
  // current === num
  const phaseStr = cycleState.phase ?? "";
  if (/halt/i.test(phaseStr) || cycleState.status === "halted") return "halted";
  if (/complete/i.test(phaseStr)) return "complete";
  return "active";
}

function parseJsonl(content: string): Record<string, unknown>[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((x): x is Record<string, unknown> => x !== null);
}

function approvalEventText(e: Record<string, unknown>): string {
  if (typeof e.gate === "string") {
    const amt = e.amount;
    const cap = e.cap;
    return `${e.gate} auto-approved · spend ${amt} of ${cap}`;
  }
  if (typeof e.sub_skill === "string") {
    const ss = e.sub_skill;
    const n = e.n_contacts;
    const risks = e.n_risks_flagged;
    if (typeof n === "number" && typeof risks === "number") {
      return `${ss} · ${n} contacts · ${risks} risks flagged`;
    }
    if (typeof n === "number") return `${ss} · ${n} contacts`;
    return `${ss} ran`;
  }
  return JSON.stringify(e);
}

function haltEventText(e: Record<string, unknown>): string {
  const gate = e.gate ?? e.phase ?? "halt";
  const reason = e.reason ?? e.halt_reason ?? "";
  return `${gate} halted${reason ? ` — ${reason}` : ""}`;
}

export async function getCycleDetail(id: string): Promise<CycleDetail | null> {
  const parsed = parseDirName(id);
  if (!parsed) return null;
  const dirPath = path.join(CYCLE_DIRS_GLOB_ROOT, id);
  const stat = await fs.stat(dirPath).catch(() => null);
  if (!stat?.isDirectory()) return null;

  const summary = await buildSummary({ id, dirPath, mtime: stat.mtime });
  if (!summary) return null;
  if (await lockActive()) summary.is_active = summary.is_active || true;

  // Read all phase-*.json files in parallel
  const allFiles = await fs.readdir(dirPath);
  const phaseFiles = allFiles.filter((f) => /^phase-\d+/.test(f) && f.endsWith(".json"));
  const phaseFileContents: Record<string, unknown> = {};
  await Promise.all(
    phaseFiles.map(async (f) => {
      const v = await readJsonSafe<unknown>(path.join(dirPath, f));
      if (v !== null) phaseFileContents[f] = v;
    }),
  );

  const phases: PhaseSummary[] = [];
  for (let num = 1; num <= 7; num++) {
    const files = phaseFiles.filter((f) => f.startsWith(`phase-${num}`));
    const lettersDir = path.join(dirPath, "letters");
    const hasLetters = num === 7 && (await fs.stat(lettersDir).then(() => true).catch(() => false));
    if (num === 7 && files.length === 0 && !hasLetters && summary.current_phase_num < 7) {
      continue; // skip letters phase if no evidence
    }
    const state = deriveState(num, summary.current_phase_num, summary.state);
    let metric = metricFor(num, phaseFileContents);
    if (num === 6) {
      if (summary.state.sequence_id) {
        metric = `Sequence #${summary.state.sequence_id} · ${summary.state.contacts ?? "?"} contacts`;
      }
    }
    phases.push({ num, name: PHASE_NAMES[num], state, metric, files });
  }

  // Activity stream
  const approvalsLog =
    (await fs
      .readFile(path.join(dirPath, "auto-approvals.log"), "utf8")
      .catch(() => null)) ?? "";
  const haltsLog =
    (await fs
      .readFile(path.join(dirPath, "auto-halts.log"), "utf8")
      .catch(() => null)) ?? "";

  const activity: ActivityEvent[] = [
    ...parseJsonl(approvalsLog).map((e): ActivityEvent => {
      const isGate = typeof e.gate === "string";
      return {
        at: (e.at as string) ?? null,
        kind: isGate ? "approval" : "subskill",
        text: approvalEventText(e),
        raw: e,
      };
    }),
    ...parseJsonl(haltsLog).map(
      (e): ActivityEvent => ({
        at: (e.at as string) ?? null,
        kind: "halt",
        text: haltEventText(e),
        raw: e,
      }),
    ),
  ].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

  const g4Pending = await readJsonSafe<unknown>(path.join(dirPath, "g4-pending.json"));
  const creditSpend = await readJsonSafe<unknown>(path.join(dirPath, "credit-spend.json"));
  const summaryMd =
    (await fs.readFile(path.join(dirPath, "summary.md"), "utf8").catch(() => null)) ?? null;

  return {
    ...summary,
    phases,
    activity,
    g4_pending: g4Pending,
    credit_spend: creditSpend,
    summary_md: summaryMd,
  };
}
