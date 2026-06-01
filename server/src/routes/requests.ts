import { Router } from "express";
import { resolveIdentity } from "../lib/roles.js";
import {
  createRequest,
  getRequest,
  listRequests,
  updateRequest,
  type RequestKind,
} from "../lib/requests.js";
import { executeOrchestrator, executeRunCycle } from "../lib/executors.js";
import { getWeeklyInvenExport } from "../lib/spend.js";

export const requestsRouter = Router();

// List requests. Owners see all; operators see their own.
requestsRouter.get("/", async (req, res) => {
  const id = await resolveIdentity(req);
  const all = await listRequests();
  const weekly = await getWeeklyInvenExport().catch(() => null);
  if (id.role === "owner") {
    res.json({ role: id.role, requests: all, weekly_inven_export: weekly });
    return;
  }
  const mine = all.filter((r) => r.requested_by === (id.email ?? "local"));
  res.json({ role: id.role, requests: mine, weekly_inven_export: weekly });
});

// Create a request (operator path for spend actions).
requestsRouter.post("/", async (req, res) => {
  const id = await resolveIdentity(req);
  const { kind, slug, note } = req.body ?? {};
  if (kind !== "run-cycle" && kind !== "orchestrator") {
    res.status(400).json({ error: "invalid_kind" });
    return;
  }
  if (kind === "run-cycle" && (typeof slug !== "string" || !slug)) {
    res.status(400).json({ error: "slug_required" });
    return;
  }
  const label =
    kind === "orchestrator"
      ? "Run the nightly orchestrator now"
      : `Run a cycle on "${slug}"`;
  const request = await createRequest({
    kind: kind as RequestKind,
    slug: kind === "run-cycle" ? slug : undefined,
    label,
    requested_by: id.email ?? "local",
    note: typeof note === "string" ? note : undefined,
  });
  res.json({ ok: true, request });
});

// Approve (owner only) — executes the action.
requestsRouter.post("/:id/approve", async (req, res) => {
  const id = await resolveIdentity(req);
  if (id.role !== "owner") {
    res.status(403).json({ error: "owner_only" });
    return;
  }
  const request = await getRequest(req.params.id);
  if (!request) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (request.status !== "pending") {
    res.status(409).json({ error: "already_decided", status: request.status });
    return;
  }

  const result =
    request.kind === "orchestrator"
      ? await executeOrchestrator()
      : await executeRunCycle(request.slug!);

  const updated = await updateRequest(request.id, {
    status: result.ok ? "executed" : "failed",
    decided_by: id.email ?? "owner",
    decided_at: new Date().toISOString(),
    result_message: result.ok ? result.message : result.error,
  });
  res.json({ ok: result.ok, request: updated, result });
});

// Deny (owner only).
requestsRouter.post("/:id/deny", async (req, res) => {
  const id = await resolveIdentity(req);
  if (id.role !== "owner") {
    res.status(403).json({ error: "owner_only" });
    return;
  }
  const { note } = req.body ?? {};
  const request = await getRequest(req.params.id);
  if (!request) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (request.status !== "pending") {
    res.status(409).json({ error: "already_decided", status: request.status });
    return;
  }
  const updated = await updateRequest(request.id, {
    status: "denied",
    decided_by: id.email ?? "owner",
    decided_at: new Date().toISOString(),
    decision_note: typeof note === "string" ? note : undefined,
  });
  res.json({ ok: true, request: updated });
});
