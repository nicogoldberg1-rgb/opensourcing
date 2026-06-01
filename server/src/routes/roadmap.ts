import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  loadBoard,
  saveBoard,
  type RoadmapCard,
  type RoadmapColumn,
} from "../lib/roadmap.js";

export const roadmapRouter = Router();

const VALID_COLUMNS: RoadmapColumn[] = ["idea", "next_up", "in_progress", "shipped"];

function isValidColumn(s: unknown): s is RoadmapColumn {
  return typeof s === "string" && (VALID_COLUMNS as string[]).includes(s);
}

roadmapRouter.get("/", async (_req, res) => {
  try {
    res.json(await loadBoard());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "load_failed", message });
  }
});

// Full-board replace (used after drag-reorders so the frontend can ship the
// authoritative order in one shot).
roadmapRouter.put("/", async (req, res) => {
  const { cards } = req.body ?? {};
  if (!Array.isArray(cards)) {
    res.status(400).json({ error: "cards_required" });
    return;
  }
  for (const c of cards) {
    if (
      !c ||
      typeof c.id !== "string" ||
      typeof c.title !== "string" ||
      !isValidColumn(c.column)
    ) {
      res.status(400).json({ error: "invalid_card", card: c });
      return;
    }
  }
  try {
    await saveBoard({ cards });
    res.json({ cards });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "save_failed", message });
  }
});

roadmapRouter.post("/cards", async (req, res) => {
  const { title, description, column, tags } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title_required" });
    return;
  }
  if (!isValidColumn(column)) {
    res.status(400).json({ error: "invalid_column", column });
    return;
  }
  try {
    const board = await loadBoard();
    const now = new Date().toISOString();
    const card: RoadmapCard = {
      id: randomUUID(),
      column,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() || undefined : undefined,
      tags: Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : undefined,
      created_at: now,
      updated_at: now,
    };
    board.cards.unshift(card); // newest at top of its column
    await saveBoard(board);
    res.json({ card });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "save_failed", message });
  }
});

roadmapRouter.patch("/cards/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body ?? {};
  try {
    const board = await loadBoard();
    const card = board.cards.find((c) => c.id === id);
    if (!card) {
      res.status(404).json({ error: "card_not_found", id });
      return;
    }
    if (typeof patch.title === "string") card.title = patch.title.trim();
    if (typeof patch.description === "string")
      card.description = patch.description.trim() || undefined;
    if (Array.isArray(patch.tags))
      card.tags = patch.tags.filter((t: unknown) => typeof t === "string");
    if (isValidColumn(patch.column)) card.column = patch.column;
    card.updated_at = new Date().toISOString();
    await saveBoard(board);
    res.json({ card });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "save_failed", message });
  }
});

roadmapRouter.delete("/cards/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const board = await loadBoard();
    const before = board.cards.length;
    board.cards = board.cards.filter((c) => c.id !== id);
    if (board.cards.length === before) {
      res.status(404).json({ error: "card_not_found", id });
      return;
    }
    await saveBoard(board);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "save_failed", message });
  }
});
