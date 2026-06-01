import { Router } from "express";
import { resolveIdentity } from "../lib/roles.js";
import { pendingCount } from "../lib/requests.js";

export const meRouter = Router();

meRouter.get("/", async (req, res) => {
  const id = await resolveIdentity(req);
  // Only owners care about the pending-approvals badge.
  const pending = id.role === "owner" ? await pendingCount() : 0;
  res.json({ role: id.role, email: id.email, source: id.source, pending_requests: pending });
});
