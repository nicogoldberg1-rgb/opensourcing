import { Router } from "express";
import { verifyEmail, verifyEmails, type VerifyResult, type VerifyStatus } from "../lib/verify.js";

export const verifyRouter = Router();

function summarize(results: VerifyResult[]): Record<VerifyStatus, number> {
  const s = { deliverable: 0, "catch-all": 0, undeliverable: 0, unconfirmed: 0, unknown: 0 } as Record<VerifyStatus, number>;
  for (const r of results) s[r.status] += 1;
  return s;
}

// GET /api/verify?email=foo@bar.com — single address
verifyRouter.get("/", async (req, res) => {
  const email = String(req.query.email ?? "").trim();
  if (!email) {
    res.status(400).json({ error: "missing_email", message: "pass ?email=foo@bar.com" });
    return;
  }
  try {
    res.json(await verifyEmail(email));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "verify_failed", message });
  }
});

// POST /api/verify  { emails: string[] } — batch (max 500)
verifyRouter.post("/", async (req, res) => {
  const emails = (req.body as { emails?: unknown })?.emails;
  if (!Array.isArray(emails) || emails.some((e) => typeof e !== "string")) {
    res.status(400).json({ error: "bad_input", message: "body must be { emails: string[] }" });
    return;
  }
  if (emails.length > 500) {
    res.status(400).json({ error: "too_many", message: "max 500 emails per request" });
    return;
  }
  try {
    const results = await verifyEmails(emails as string[]);
    res.json({ count: results.length, summary: summarize(results), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "verify_failed", message });
  }
});
