import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { AUTOPILOT_REPO, NSP_STATE_DIR, ORCH_LOCK } from "../paths.js";
import { setStatus } from "./state-cli.js";
import { FIXTURE_MODE } from "../config.js";

export type ExecResult = { ok: true; message: string; pid?: number } | { ok: false; error: string };

// Spawn the same nightly orchestrator script launchd uses.
export async function executeOrchestrator(): Promise<ExecResult> {
  if (FIXTURE_MODE) {
    return { ok: true, message: "[fixture] orchestrator run simulated — no real spawn." };
  }
  // Refuse if a run is already in progress (lock < 4h old).
  try {
    const stat = await fs.stat(ORCH_LOCK);
    const ageH = (Date.now() - stat.mtime.getTime()) / 3_600_000;
    if (ageH < 4) {
      return { ok: false, error: `Orchestrator already running (lock held ${ageH.toFixed(1)}h ago).` };
    }
  } catch {
    // no lock — proceed
  }

  const script = path.join(AUTOPILOT_REPO, "bin/run-orchestrator.sh");
  try {
    await fs.access(script);
  } catch {
    return { ok: false, error: `script_not_found: ${script}` };
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    REPO_ROOT: AUTOPILOT_REPO,
    CLAUDE_BIN: process.env.CLAUDE_BIN ?? `${process.env.HOME}/.local/bin/claude`,
    HOME: process.env.HOME ?? "",
    PATH:
      process.env.PATH ??
      "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    ORCH_MAX_NICHES: process.env.ORCH_MAX_NICHES ?? "1",
    ORCH_BRAINSTORM_ONLY: process.env.ORCH_BRAINSTORM_ONLY ?? "false",
    ORCH_TELEGRAM_CHAT_ID: process.env.ORCH_TELEGRAM_CHAT_ID ?? "",
  };

  try {
    const child = spawn(script, [], { env, cwd: AUTOPILOT_REPO, detached: true, stdio: "ignore" });
    child.unref();
    return {
      ok: true,
      pid: child.pid,
      message: "Orchestrator started. The digest will refresh when it finishes (a few minutes).",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Queue a niche and drop a manual-trigger file (does not spawn — the actual
// cycle runs when /run-cycle is invoked or the 10pm fire picks it up).
export async function executeRunCycle(slug: string): Promise<ExecResult> {
  if (FIXTURE_MODE) {
    try {
      await setStatus(slug, "queued", "fixture run-cycle");
      return { ok: true, message: `[fixture] queued "${slug}" (no trigger file written).` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  try {
    await setStatus(slug, "queued", "manual run-cycle trigger from dashboard");
    const triggerPath = path.join(NSP_STATE_DIR, `manual-trigger-${slug}.json`);
    await fs.writeFile(
      triggerPath,
      JSON.stringify({ slug, triggered_at: new Date().toISOString() }, null, 2),
    );
    return {
      ok: true,
      message: `Queued "${slug}". Run /run-cycle ${slug} to start now, or wait for the 10pm fire.`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
