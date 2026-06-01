import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { FIXTURE_MODE } from "../config.js";

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
  if (FIXTURE_MODE) {
    return [
      { id: 9001, name: "TEST_compliance-software-2026-05-21", created: "2026-05-21T10:00:00", status: 0, emailAccount: "demo@example.com", deliveriesCount: 0, opensCount: 0, repliesCount: 0, bouncesCount: 0, optOutsCount: 0, outOfOfficeCount: 0, peopleCount: 25, peopleFinished: 0, peopleActive: 25, peoplePaused: 0 },
      { id: 9002, name: "Legal Case Mgmt", created: "2026-04-02T10:00:00", status: 4, emailAccount: "demo@example.com", deliveriesCount: 20, opensCount: 9, repliesCount: 4, bouncesCount: 1, optOutsCount: 0, outOfOfficeCount: 1, peopleCount: 20, peopleFinished: 20, peopleActive: 0, peoplePaused: 0 },
      { id: 9003, name: "Mens Health Clinics", created: "2026-03-15T10:00:00", status: 1, emailAccount: "demo@example.com", deliveriesCount: 18, opensCount: 7, repliesCount: 2, bouncesCount: 0, optOutsCount: 1, outOfOfficeCount: 0, peopleCount: 22, peopleFinished: 6, peopleActive: 16, peoplePaused: 0 },
    ];
  }
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
