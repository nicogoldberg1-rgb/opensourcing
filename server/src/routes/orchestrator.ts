import { promises as fs } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { ORCH_LOCK, ORCH_LOGS_DIR, ORCH_STATE_JSON } from "../paths.js";
import { executeOrchestrator } from "../lib/executors.js";
import { resolveIdentity } from "../lib/roles.js";
import { createRequest } from "../lib/requests.js";

export const orchestratorRouter = Router();

orchestratorRouter.post("/trigger", async (req, res) => {
  const id = await resolveIdentity(req);

  // Operators can't fire spend directly — their click becomes a request.
  if (id.role !== "owner") {
    if (id.role === "viewer") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const request = await createRequest({
      kind: "orchestrator",
      label: "Run the nightly orchestrator now",
      requested_by: id.email ?? "local",
    });
    res.json({
      ok: true,
      queued_for_approval: true,
      request,
      message: "Requested — Nico will approve the run from his inbox.",
    });
    return;
  }

  const result = await executeOrchestrator();
  if (!result.ok) {
    const code = result.error.includes("already running") ? 409 : 500;
    res.status(code).json({ error: "orchestrator_failed", message: result.error });
    return;
  }
  res.json({ ok: true, pid: result.pid, message: result.message });
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
