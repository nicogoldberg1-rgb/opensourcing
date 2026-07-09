import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { FIXTURE_MODE } from "../config.js";
import { DEMO_SEQUENCES_JSON } from "../paths.js";

const REPLY_BASE = "https://api.reply.io";
const CACHE_TTL_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 3_000;

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

export type SequenceStep = {
  step: number;
  day: number;
  channel: "linkedin" | "email" | "letter";
  subject: string | null;
  body: string;
};

// A demo sequence is a ReplyCampaign plus the preview-only fields the in-app
// sequence preview renders (the actual outreach copy + a sample recipient).
type DemoSequence = ReplyCampaign & {
  niche_slug?: string;
  sample_contact?: Record<string, string> | null;
  steps?: SequenceStep[];
};

export type SequenceDetail = {
  id: number;
  name: string;
  niche_slug?: string;
  sample_contact: Record<string, string> | null;
  steps: SequenceStep[];
};

async function loadDemoSequences(): Promise<DemoSequence[]> {
  const raw = await fs.readFile(DEMO_SEQUENCES_JSON, "utf8");
  const parsed = JSON.parse(raw) as { sequences: DemoSequence[] };
  return parsed.sequences ?? [];
}

function stripDemoExtras(s: DemoSequence): ReplyCampaign {
  const { niche_slug: _n, sample_contact: _s, steps: _t, ...campaign } = s;
  return campaign;
}

// Preview content for one sequence. Only available in fixture/demo mode; in real
// mode the dashboard links out to the actual Reply.io UI instead.
export async function getSequenceDetail(id: number): Promise<SequenceDetail | null> {
  if (!FIXTURE_MODE) return null;
  const found = (await loadDemoSequences()).find((s) => s.id === id);
  if (!found) return null;
  return {
    id: found.id,
    name: found.name,
    niche_slug: found.niche_slug,
    sample_contact: found.sample_contact ?? null,
    steps: found.steps ?? [],
  };
}

let cache: { at: number; value: ReplyCampaign[] } | null = null;

export async function fetchCampaigns(): Promise<ReplyCampaign[]> {
  if (FIXTURE_MODE) {
    return (await loadDemoSequences()).map(stripDemoExtras);
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const key = await getKey();
  if (!key) throw new Error("reply_io_key_not_found");
  try {
    const res = await fetch(`${REPLY_BASE}/v1/campaigns`, {
      headers: { "X-Api-Key": key, accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`reply.io ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as ReplyCampaign[];
    cache = { at: Date.now(), value: data };
    return data;
  } catch (err) {
    // Serve stale stats rather than dropping enrichment when Reply.io is
    // slow or briefly down; callers only see an error on a true cold miss.
    if (cache) return cache.value;
    throw err;
  }
}

export function invalidateCache(): void {
  cache = null;
}
