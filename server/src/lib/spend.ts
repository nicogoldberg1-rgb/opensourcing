import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CYCLE_DIRS_GLOB_ROOT,
  NSP_STATE_DIR,
} from "../paths.js";
import { getAnthropicUsage, type AnthropicUsage } from "./anthropic-usage.js";
import { getLobSummary, type LobSummary } from "./lob.js";

const INVEN_CACHE = path.join(NSP_STATE_DIR, "inven-credits.json");
const CYCLE_DIR_RE = /^run-cycle-(.+)-(\d{4}-\d{2}-\d{2})(?:-.+)?$/;

export type InvenBalance = {
  fetched_at: string | null;
  balance: {
    export_credits: number;
    contact_credits: number;
    ai_enrichment_credits: number;
  } | null;
};

export type MonthSpend = {
  month: string; // "YYYY-MM"
  export: number;
  contact: number;
  ai: number;
  verifalia: number;
  cycles: number;
};

export type SpendPayload = {
  inven: {
    balance: InvenBalance;
    by_month: MonthSpend[]; // newest first
    this_month: MonthSpend;
  };
  lob: LobSummary;
  anthropic: {
    note: string;
    settings_url: string;
    usage: AnthropicUsage | null;
  };
};

async function readJsonSafe<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readInvenBalance(): Promise<InvenBalance> {
  const data = await readJsonSafe<{
    fetched_at?: string;
    balance?: InvenBalance["balance"];
  }>(INVEN_CACHE);
  return {
    fetched_at: data?.fetched_at ?? null,
    balance: data?.balance ?? null,
  };
}

type CycleSpendBucket = {
  export: number;
  contact: number;
  ai: number;
  verifalia: number;
};

async function readCycleSpend(dirPath: string): Promise<CycleSpendBucket> {
  const bucket: CycleSpendBucket = { export: 0, contact: 0, ai: 0, verifalia: 0 };

  // state.json.credits_spent
  const state = await readJsonSafe<{
    credits_spent?: { export?: number; contact?: number; ai?: number };
  }>(path.join(dirPath, "state.json"));
  if (state?.credits_spent) {
    bucket.export += state.credits_spent.export ?? 0;
    bucket.contact += state.credits_spent.contact ?? 0;
    bucket.ai += state.credits_spent.ai ?? 0;
  }

  // credit-spend.json.total_spent_so_far (richer when present)
  const cs = await readJsonSafe<{
    total_spent_so_far?: {
      export?: number;
      contact?: number;
      ai?: number;
      verifalia_emails?: number;
    };
  }>(path.join(dirPath, "credit-spend.json"));
  if (cs?.total_spent_so_far) {
    const t = cs.total_spent_so_far;
    // prefer the credit-spend file when both exist (it's the more detailed view)
    bucket.export = Math.max(bucket.export, t.export ?? 0);
    bucket.contact = Math.max(bucket.contact, t.contact ?? 0);
    bucket.ai = Math.max(bucket.ai, t.ai ?? 0);
    bucket.verifalia += t.verifalia_emails ?? 0;
  }

  return bucket;
}

async function buildMonthly(): Promise<MonthSpend[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(CYCLE_DIRS_GLOB_ROOT);
  } catch {
    return [];
  }
  const byMonth = new Map<string, MonthSpend>();
  for (const name of entries) {
    const m = name.match(CYCLE_DIR_RE);
    if (!m) continue;
    const date = m[2]; // YYYY-MM-DD
    const month = date.slice(0, 7);
    const dirPath = path.join(CYCLE_DIRS_GLOB_ROOT, name);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const spend = await readCycleSpend(dirPath);
    const existing =
      byMonth.get(month) ?? {
        month,
        export: 0,
        contact: 0,
        ai: 0,
        verifalia: 0,
        cycles: 0,
      };
    existing.export += spend.export;
    existing.contact += spend.contact;
    existing.ai += spend.ai;
    existing.verifalia += spend.verifalia;
    existing.cycles += 1;
    byMonth.set(month, existing);
  }
  return Array.from(byMonth.values()).sort((a, b) =>
    a.month < b.month ? 1 : -1,
  );
}

export async function getSpend(): Promise<SpendPayload> {
  const [balance, byMonth, anthropicUsage, lob] = await Promise.all([
    readInvenBalance(),
    buildMonthly(),
    getAnthropicUsage().catch(() => null),
    getLobSummary(),
  ]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = byMonth.find((m) => m.month === currentMonth) ?? {
    month: currentMonth,
    export: 0,
    contact: 0,
    ai: 0,
    verifalia: 0,
    cycles: 0,
  };
  return {
    inven: { balance, by_month: byMonth, this_month: thisMonth },
    lob,
    anthropic: {
      note: "Token counts derived from your local Claude Code session logs (~/.claude/projects). Max plan rate-limit ceilings aren't exposed by the API — for the exact 5h/weekly limits, check the settings page.",
      settings_url: "https://claude.ai/settings/usage",
      usage: anthropicUsage,
    },
  };
}
