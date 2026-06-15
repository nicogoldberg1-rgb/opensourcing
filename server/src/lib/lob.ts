import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FIXTURE_MODE } from "../config.js";
import { DEMO_LOB_JSON } from "../paths.js";

const LOB_BASE = "https://api.lob.com/v1";
const CACHE_TTL_MS = 60_000;
const CREDS_PATH = path.join(os.homedir(), ".config/lob/credentials");

let cachedKey: { key: string; mode: "test" | "live" } | null | undefined;

async function loadKey(): Promise<{ key: string; mode: "test" | "live" } | null> {
  if (cachedKey !== undefined) return cachedKey;
  // 1. Explicit env override wins
  if (process.env.LOB_API_KEY) {
    cachedKey = {
      key: process.env.LOB_API_KEY,
      mode: process.env.LOB_API_KEY.startsWith("live_") ? "live" : "test",
    };
    return cachedKey;
  }
  // 2. Fall back to the standard Lob credentials file
  try {
    const raw = await fs.readFile(CREDS_PATH, "utf8");
    const creds: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [k, ...rest] = trimmed.split("=");
      creds[k.trim()] = rest.join("=").trim();
    }
    const live = creds.LOB_LIVE_API_KEY;
    const test = creds.LOB_TEST_API_KEY;
    if (live) {
      cachedKey = { key: live, mode: "live" };
      return cachedKey;
    }
    if (test) {
      cachedKey = { key: test, mode: "test" };
      return cachedKey;
    }
  } catch {
    // file not present or unreadable
  }
  cachedKey = null;
  return cachedKey;
}

export type LobLetter = {
  id: string;
  to: { name?: string; address_city?: string; address_state?: string };
  from?: { name?: string; company?: string };
  price: string;
  date_created: string;
  description?: string | null;
  mode?: "test" | "live";
  carrier?: string;
  expected_delivery_date?: string;
};

export type LobSummary = {
  configured: boolean;
  mode: "test" | "live" | null;
  fetched_at: string;
  this_month: {
    count: number;
    total_usd: number;
    avg_usd: number | null;
  };
  recent: {
    id: string;
    to_name: string;
    to_city: string;
    price_usd: number;
    date_created: string;
    description: string | null;
  }[];
  note?: string;
};

let cache: { at: number; value: LobSummary } | null = null;

async function fetchAllThisMonth(key: string): Promise<LobLetter[]> {
  const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
    .toISOString()
    .slice(0, 10);

  const out: LobLetter[] = [];
  // Lob v1 uses cursor pagination via the `after` param (last item's id).
  let after: string | undefined = undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${LOB_BASE}/letters`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("date_created[gte]", monthStart);
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url, {
      headers: { Authorization: auth, accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`lob ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: LobLetter[];
      next_url?: string | null;
    };
    const data = json.data ?? [];
    out.push(...data);
    if (!json.next_url || data.length < 100) break;
    after = data[data.length - 1]?.id;
    if (!after) break;
  }
  return out;
}

export async function getLobSummary(): Promise<LobSummary> {
  if (FIXTURE_MODE) {
    const raw = await fs.readFile(DEMO_LOB_JSON, "utf8");
    const data = JSON.parse(raw) as Omit<LobSummary, "fetched_at">;
    return { ...data, fetched_at: new Date().toISOString() };
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const creds = await loadKey();
  const now = new Date().toISOString();
  if (!creds) {
    const value: LobSummary = {
      configured: false,
      mode: null,
      fetched_at: now,
      this_month: { count: 0, total_usd: 0, avg_usd: null },
      recent: [],
      note: "Lob credentials not found. Expected at ~/.config/lob/credentials or the LOB_API_KEY env var.",
    };
    cache = { at: Date.now(), value };
    return value;
  }
  try {
    const letters = await fetchAllThisMonth(creds.key);
    const priceSum = letters.reduce((sum, l) => sum + Number(l.price ?? 0), 0);
    const hasPrices = priceSum > 0;
    const recent = [...letters]
      .sort((a, b) => (a.date_created < b.date_created ? 1 : -1))
      .slice(0, 8)
      .map((l) => ({
        id: l.id,
        to_name: l.to?.name ?? "",
        to_city: [l.to?.address_city, l.to?.address_state]
          .filter(Boolean)
          .join(", "),
        price_usd: Number(l.price ?? 0),
        date_created: l.date_created,
        description: l.description ?? null,
      }));
    const value: LobSummary = {
      configured: true,
      mode: creds.mode,
      fetched_at: now,
      this_month: {
        count: letters.length,
        total_usd: hasPrices ? priceSum : 0,
        avg_usd: hasPrices && letters.length > 0 ? priceSum / letters.length : null,
      },
      recent,
      note: hasPrices
        ? undefined
        : letters.length > 0
          ? "Lob's letter API doesn't return per-piece prices on this plan — see the Lob dashboard for billed amounts."
          : undefined,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      mode: creds.mode,
      fetched_at: now,
      this_month: { count: 0, total_usd: 0, avg_usd: null },
      recent: [],
      note: `Lob fetch failed: ${message}`,
    };
  }
}
