import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { AUTOPILOT_REPO, STATE_PY, TRACKER_JSON } from "../paths.js";
import { FIXTURE_MODE } from "../config.js";

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

// ---- Fixture-mode mutators: edit the bundled tracker JSON directly in JS.
// No python, no real autopilot. Mirrors lib/state.py's shape closely enough
// for the dashboard. Only used when NSP_FIXTURE_MODE=1.
async function fixtureLoad(): Promise<{ industries: Record<string, unknown>[]; [k: string]: unknown }> {
  const raw = await fs.readFile(TRACKER_JSON, "utf8");
  return JSON.parse(raw);
}
async function fixtureSave(data: unknown): Promise<void> {
  await fs.writeFile(TRACKER_JSON, JSON.stringify(data, null, 2));
}
function nowIso(): string {
  return new Date().toISOString();
}

async function fixtureSetStatus(slug: string, newStatus: string, reason?: string) {
  const data = await fixtureLoad();
  const item = data.industries.find((n) => n.id === slug || n.slug === slug);
  if (!item) throw new Error(`no niche with slug/id: ${slug}`);
  item.status = newStatus;
  item[`${newStatus}_at`] = nowIso();
  if (reason) {
    const hist = (item.history as unknown[]) ?? [];
    hist.push({ at: nowIso(), status: newStatus, reason });
    item.history = hist;
  }
  await fixtureSave(data);
  return item;
}

async function fixtureAddProposed(slug: string, name: string, notes: string, source: string) {
  const data = await fixtureLoad();
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
  await fixtureSave(data);
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
  const raw = await fs.readFile(TRACKER_JSON, "utf8");
  const data = JSON.parse(raw) as { industries: Record<string, unknown>[] };
  const item = data.industries.find((n) => n.id === slug || n.slug === slug);
  if (!item) throw new Error(`no niche with slug/id: ${slug}`);
  item.buy_box = { ...((item.buy_box as Record<string, unknown>) ?? {}), ...buyBox };
  await fs.writeFile(TRACKER_JSON, JSON.stringify(data, null, 2));
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
