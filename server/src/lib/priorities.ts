import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const PRIORITIES_FILE = path.join(DATA_DIR, "priorities.json");

export type Priorities = {
  approved: string[];
  queued: string[];
};

export type Lane = keyof Priorities;

const EMPTY: Priorities = { approved: [], queued: [] };

export async function loadPriorities(): Promise<Priorities> {
  try {
    const raw = await fs.readFile(PRIORITIES_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Priorities>;
    return {
      approved: parsed.approved ?? [],
      queued: parsed.queued ?? [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
    throw err;
  }
}

export async function savePriorities(p: Priorities): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PRIORITIES_FILE, JSON.stringify(p, null, 2));
}
