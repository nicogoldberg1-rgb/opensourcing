import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const FILE = path.join(DATA_DIR, "requests.json");

export type RequestKind = "run-cycle" | "orchestrator";
export type RequestStatus = "pending" | "approved" | "denied" | "executed" | "failed";

export type ActionRequest = {
  id: string;
  kind: RequestKind;
  slug?: string; // for run-cycle
  label: string; // human summary
  requested_by: string; // email or "local"
  requested_at: string;
  note?: string;
  status: RequestStatus;
  decided_by?: string;
  decided_at?: string;
  decision_note?: string;
  result_message?: string;
};

type Store = { requests: ActionRequest[] };

async function load(): Promise<Store> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Store;
    return { requests: parsed.requests ?? [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { requests: [] };
    throw err;
  }
}

async function save(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2));
}

export async function listRequests(): Promise<ActionRequest[]> {
  const { requests } = await load();
  return [...requests].sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1));
}

export async function createRequest(
  input: Omit<ActionRequest, "id" | "requested_at" | "status">,
): Promise<ActionRequest> {
  const store = await load();
  const req: ActionRequest = {
    ...input,
    id: randomUUID(),
    requested_at: new Date().toISOString(),
    status: "pending",
  };
  store.requests.unshift(req);
  await save(store);
  return req;
}

export async function getRequest(id: string): Promise<ActionRequest | null> {
  const { requests } = await load();
  return requests.find((r) => r.id === id) ?? null;
}

export async function updateRequest(
  id: string,
  patch: Partial<ActionRequest>,
): Promise<ActionRequest | null> {
  const store = await load();
  const req = store.requests.find((r) => r.id === id);
  if (!req) return null;
  Object.assign(req, patch);
  await save(store);
  return req;
}

export async function pendingCount(): Promise<number> {
  const { requests } = await load();
  return requests.filter((r) => r.status === "pending").length;
}
