import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { AUTOPILOT_REPO, STATE_PY, TRACKER_JSON } from "../paths.js";
import { FIXTURE_MODE } from "../config.js";
import { getSessionTracker, setSessionTracker, type Tracker } from "./demo-store.js";

const execFileP = promisify(execFile);

const VALID_STATES = new Set([
  "seed",
  "proposed",
  "approved",
  "queued",
  "in_progress",
  "cycle_complete",
  "activated",
  "paused",
  "completed",
  "partial",
  "rejected",
]);

export function isValidStatus(s: string): boolean {
  return VALID_STATES.has(s);
}

// Tracker access. In fixture/demo mode this is the visitor's private per-session
// copy (demo-store); in real mode it's the on-disk tracker JSON. All fixture
// mutators below go through these so each demo visitor stays isolated.
export async function loadTracker(): Promise<Tracker> {
  if (FIXTURE_MODE) return getSessionTracker();
  const raw = await fs.readFile(TRACKER_JSON, "utf8");
  return JSON.parse(raw) as Tracker;
}
async function saveTracker(data: Tracker): Promise<void> {
  if (FIXTURE_MODE) {
    await setSessionTracker(data);
    return;
  }
  await fs.writeFile(TRACKER_JSON, JSON.stringify(data, null, 2));
}
function nowIso(): string {
  return new Date().toISOString();
}

async function fixtureSetStatus(slug: string, newStatus: string, reason?: string) {
  const data = await loadTracker();
  const item = data.industries.find((n) => n.id === slug || n.slug === slug);
  if (!item) throw new Error(`no niche with slug/id: ${slug}`);
  item.status = newStatus;
  item[`${newStatus}_at`] = nowIso();
  if (reason) {
    const hist = (item.history as unknown[]) ?? [];
    hist.push({ at: nowIso(), status: newStatus, reason });
    item.history = hist;
  }
  await saveTracker(data);
  return item;
}

async function fixtureAddProposed(slug: string, name: string, notes: string, source: string) {
  const data = await loadTracker();
  if (data.industries.find((n) => n.id === slug || n.slug === slug)) {
    throw new Error(`slug already exists: ${slug}`);
  }
  const item = {
    id: slug,
    slug,
    name,
    status: "proposed",
    proposed_at: nowIso(),
    notes,
    source,
  };
  data.industries.push(item);
  await saveTracker(data);
  return item;
}

export async function setStatus(
  slug: string,
  newStatus: string,
  reason?: string,
): Promise<unknown> {
  if (!isValidStatus(newStatus)) {
    throw new Error(`invalid status: ${newStatus}`);
  }
  if (FIXTURE_MODE) return fixtureSetStatus(slug, newStatus, reason);
  const args = ["lib/state.py", "set-status", slug, newStatus];
  if (reason) args.push("--reason", reason);
  const { stdout } = await execFileP("python3", args, {
    cwd: AUTOPILOT_REPO,
    timeout: 15_000,
  });
  return JSON.parse(stdout);
}

// Update a niche's buy_box (descriptive acquisition criteria — not pipeline
// status, so it doesn't go through state.py's status machine). Read-merge-write
// on the tracker JSON the dashboard reads, in both fixture and real mode.
export async function setBuyBox(
  slug: string,
  buyBox: Record<string, unknown>,
): Promise<unknown> {
  const data = await loadTracker();
  const item = data.industries.find((n) => n.id === slug || n.slug === slug);
  if (!item) throw new Error(`no niche with slug/id: ${slug}`);
  item.buy_box = { ...((item.buy_box as Record<string, unknown>) ?? {}), ...buyBox };
  await saveTracker(data);
  return item;
}

export type Investigation = {
  notes?: string;
  scores?: Record<string, number>;
  adjacencies?: string[];
  business_type?: string;
  buy_box?: Record<string, unknown>;
};

// Demo-only: "develop" a seed into a proposed-level entry by writing the
// pre-authored (or generic) research onto the niche and flipping it to proposed.
// Real mode investigates via a spawned Claude run instead (see routes/niches).
export async function applyInvestigation(
  slug: string,
  data: Investigation,
): Promise<unknown> {
  const tracker = await loadTracker();
  const item = tracker.industries.find((n) => n.id === slug || n.slug === slug);
  if (!item) throw new Error(`no niche with slug/id: ${slug}`);
  if (data.notes) item.notes = data.notes;
  if (data.scores) item.scores = data.scores;
  if (data.adjacencies) item.adjacencies = data.adjacencies;
  if (data.business_type) item.business_type = data.business_type;
  if (data.buy_box) item.buy_box = data.buy_box;
  const at = nowIso();
  item.status = "proposed";
  item.proposed_at = at;
  const hist = (item.history as unknown[]) ?? [];
  hist.push({ at, status: "proposed", reason: "investigated from seed (demo)" });
  item.history = hist;
  await saveTracker(tracker);
  return item;
}

export async function summary(): Promise<unknown> {
  const { stdout } = await execFileP("python3", [STATE_PY, "summary"], {
    timeout: 15_000,
  });
  return JSON.parse(stdout);
}

export async function addProposed(
  slug: string,
  name: string,
  notes: string,
  source: string,
): Promise<unknown> {
  if (FIXTURE_MODE) return fixtureAddProposed(slug, name, notes, source);
  const args = [
    "lib/state.py",
    "add-proposed",
    slug,
    "--name",
    name,
    "--notes",
    notes,
    "--source",
    source,
  ];
  const { stdout } = await execFileP("python3", args, {
    cwd: AUTOPILOT_REPO,
    timeout: 15_000,
  });
  return JSON.parse(stdout);
}
