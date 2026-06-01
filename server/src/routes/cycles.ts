import { Router } from "express";
import { getCycleDetail, listCycles } from "../lib/cycles.js";

export const cyclesRouter = Router();

cyclesRouter.get("/", async (_req, res) => {
  try {
    const cycles = await listCycles();
    res.json({ cycles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "list_failed", message });
  }
});

cyclesRouter.get("/:id", async (req, res) => {
  try {
    const detail = await getCycleDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: "cycle_not_found", id: req.params.id });
      return;
    }
    res.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "detail_failed", message });
  }
});
