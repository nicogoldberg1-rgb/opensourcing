import { Router } from "express";
import {
  loadPriorities,
  savePriorities,
  type Lane,
} from "../lib/priorities.js";

const LANES: Lane[] = ["approved", "queued"];

export const prioritiesRouter = Router();

prioritiesRouter.get("/", async (_req, res) => {
  try {
    res.json(await loadPriorities());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "load_failed", message });
  }
});

prioritiesRouter.put("/:lane", async (req, res) => {
  const lane = req.params.lane as Lane;
  if (!LANES.includes(lane)) {
    res.status(404).json({ error: "unknown_lane", lane });
    return;
  }
  const { order } = req.body ?? {};
  if (!Array.isArray(order) || !order.every((s) => typeof s === "string")) {
    res.status(400).json({ error: "invalid_order" });
    return;
  }
  try {
    const current = await loadPriorities();
    const next = { ...current, [lane]: order };
    await savePriorities(next);
    res.json(next);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "save_failed", message });
  }
});
