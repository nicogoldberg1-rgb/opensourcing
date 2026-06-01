import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { Router } from "express";
import {
  AUTOPILOT_REPO,
  ORCH_LOCK,
  ORCH_LOGS_DIR,
  ORCH_STATE_JSON,
} from "../paths.js";

export const orchestratorRouter = Router();

orchestratorRouter.post("/trigger", async (_req, res) => {
  // Refuse if a run is already in progress.
  try {
    const stat = await fs.stat(ORCH_LOCK);
    const ageH = (Date.now() - stat.mtime.getTime()) / 3_600_000;
    if (ageH < 4) {
      res.status(409).json({
        error: "run_in_progress",
        message: `Orchestrator already running (lock held ${ageH.toFixed(1)}h ago).`,
      });
      return;
    }
  } catch {
    // no lock — proceed
  }

  const script = path.join(AUTOPILOT_REPO, "bin/run-orchestrator.sh");
  try {
    await fs.access(script);
  } catch {
    res.status(500).json({ error: "script_not_found", path: script });
    return;
  }

  // Mirror the launchd plist's env so manual triggers run identically to nightly.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    REPO_ROOT: AUTOPILOT_REPO,
    CLAUDE_BIN:
      process.env.CLAUDE_BIN ?? `${process.env.HOME}/.local/bin/claude`,
    HOME: process.env.HOME ?? "",
    PATH:
      process.env.PATH ??
      "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    ORCH_MAX_NICHES: process.env.ORCH_MAX_NICHES ?? "1",
    ORCH_BRAINSTORM_ONLY: process.env.ORCH_BRAINSTORM_ONLY ?? "false",
    ORCH_TELEGRAM_CHAT_ID: process.env.ORCH_TELEGRAM_CHAT_ID ?? "8702070399",
  };

  try {
    const child = spawn(script, [], {
      env,
      cwd: AUTOPILOT_REPO,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    res.json({
      ok: true,
      pid: child.pid,
      message:
        "Orchestrator triggered. Check back in a few minutes — the digest will refresh when it finishes.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "spawn_failed", message });
  }
});

orchestratorRouter.get("/last-run", async (_req, res) => {
  try {
    const stateRaw = await fs.readFile(ORCH_STATE_JSON, "utf8").catch(() => "{}");
    const state = JSON.parse(stateRaw);

    let latestLog: { name: string; mtime: string; digest: string } | null = null;
    try {
      const entries = await fs.readdir(ORCH_LOGS_DIR);
      const runs = entries
        .filter((n) => n.startsWith("run-") && n.endsWith(".log"))
        .sort();
      const latest = runs[runs.length - 1];
      if (latest) {
        const full = path.join(ORCH_LOGS_DIR, latest);
        const stat = await fs.stat(full);
        const content = await fs.readFile(full, "utf8");
        const marker = "----- begin claude output -----";
        const idx = content.indexOf(marker);
        const digest = idx >= 0 ? content.slice(idx + marker.length).trim() : content;
        latestLog = {
          name: latest,
          mtime: stat.mtime.toISOString(),
          digest,
        };
      }
    } catch {
      // logs dir may not exist yet; ignore
    }

    let lockActive = false;
    try {
      const stat = await fs.stat(ORCH_LOCK);
      const ageHours = (Date.now() - stat.mtime.getTime()) / 3_600_000;
      lockActive = ageHours < 4;
    } catch {
      // no lock file
    }

    res.json({ state, latestLog, lockActive });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "failed_to_read_orchestrator_state", message });
  }
});
