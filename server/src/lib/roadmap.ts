import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const FILE = path.join(DATA_DIR, "roadmap.json");

export type RoadmapColumn = "idea" | "next_up" | "in_progress" | "shipped";

export type RoadmapCard = {
  id: string;
  column: RoadmapColumn;
  title: string;
  description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
};

export type RoadmapBoard = {
  cards: RoadmapCard[];
};

const EMPTY: RoadmapBoard = { cards: [] };

export async function loadBoard(): Promise<RoadmapBoard> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as RoadmapBoard;
    return { cards: parsed.cards ?? [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY, cards: [] };
    throw err;
  }
}

export async function saveBoard(board: RoadmapBoard): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(board, null, 2));
}
