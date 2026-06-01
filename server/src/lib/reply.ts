import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const REPLY_BASE = "https://api.reply.io";
const CACHE_TTL_MS = 30_000;

let cachedKey: string | null | undefined;
async function getKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  if (process.env.REPLY_IO_API_KEY) {
    cachedKey = process.env.REPLY_IO_API_KEY;
    return cachedKey;
  }
  try {
    const raw = await fs.readFile(path.join(os.homedir(), ".claude.json"), "utf8");
    const parsed = JSON.parse(raw);
    const k =
      parsed?.mcpServers?.["reply-io"]?.headers?.["X-Api-Key"] ??
      parsed?.mcpServers?.["reply.io"]?.headers?.["X-Api-Key"];
    cachedKey = typeof k === "string" ? k : null;
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

export type ReplyCampaign = {
  id: number;
  name: string;
  created: string;
  status: number;
  emailAccount?: string;
  deliveriesCount: number;
  opensCount: number;
  repliesCount: number;
  bouncesCount: number;
  optOutsCount: number;
  outOfOfficeCount: number;
  peopleCount: number;
  peopleFinished: number;
  peopleActive: number;
  peoplePaused: number;
};

let cache: { at: number; value: ReplyCampaign[] } | null = null;

export async function fetchCampaigns(): Promise<ReplyCampaign[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const key = await getKey();
  if (!key) throw new Error("reply_io_key_not_found");
  const res = await fetch(`${REPLY_BASE}/v1/campaigns`, {
    headers: { "X-Api-Key": key, accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`reply.io ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as ReplyCampaign[];
  cache = { at: Date.now(), value: data };
  return data;
}

export function invalidateCache(): void {
  cache = null;
}
