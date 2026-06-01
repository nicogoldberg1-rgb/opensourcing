import { Router } from "express";
import { getSpend } from "../lib/spend.js";

export const spendRouter = Router();

spendRouter.get("/", async (_req, res) => {
  try {
    res.json(await getSpend());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "spend_failed", message });
  }
});
