import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AUTOPILOT_REPO, STATE_PY } from "../paths.js";

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

export async function setStatus(
  slug: string,
  newStatus: string,
  reason?: string,
): Promise<unknown> {
  if (!isValidStatus(newStatus)) {
    throw new Error(`invalid status: ${newStatus}`);
  }
  const args = ["lib/state.py", "set-status", slug, newStatus];
  if (reason) args.push("--reason", reason);
  const { stdout } = await execFileP("python3", args, {
    cwd: AUTOPILOT_REPO,
    timeout: 15_000,
  });
  return JSON.parse(stdout);
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
