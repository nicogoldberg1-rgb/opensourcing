import { createReadStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { FIXTURE_MODE } from "../config.js";
import { DEMO_ANTHROPIC_JSON } from "../paths.js";

const PROJECTS_DIR = path.join(os.homedir(), ".claude/projects");
const SCAN_DAYS = 60; // only consider files modified in last N days
const CACHE_TTL_MS = 60_000;

type Bucket = {
  input: number;
  cache_create: number;
  cache_read: number;
  output: number;
  messages: number;
};

const ZERO_BUCKET: Bucket = {
  input: 0,
  cache_create: 0,
  cache_read: 0,
  output: 0,
  messages: 0,
};

export type AnthropicUsage = {
  scanned_at: string;
  files_scanned: number;
  last_24h: Bucket;
  last_5h: Bucket;
  this_week: Bucket;
  this_month: Bucket;
  by_day: { day: string; output: number; total_input: number; messages: number }[];
  top_projects: { project: string; output: number; messages: number }[];
};

let cache: { at: number; value: AnthropicUsage } | null = null;

function emptyBucket(): Bucket {
  return { ...ZERO_BUCKET };
}

function addUsage(b: Bucket, u: RawUsage) {
  b.input += u.input_tokens ?? 0;
  b.cache_create += u.cache_creation_input_tokens ?? 0;
  b.cache_read += u.cache_read_input_tokens ?? 0;
  b.output += u.output_tokens ?? 0;
  b.messages += 1;
}

type RawUsage = {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
};

async function listRecentJsonl(): Promise<{ filePath: string; project: string }[]> {
  let projects: string[];
  try {
    projects = await fs.readdir(PROJECTS_DIR);
  } catch {
    return [];
  }
  const out: { filePath: string; project: string }[] = [];
  const cutoff = Date.now() - SCAN_DAYS * 24 * 3_600_000;
  for (const p of projects) {
    const dir = path.join(PROJECTS_DIR, p);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (!f.endsWith(".jsonl")) continue;
      const full = path.join(dir, f);
      try {
        const stat = await fs.stat(full);
        if (stat.mtime.getTime() < cutoff) continue;
        out.push({ filePath: full, project: p });
      } catch {
        // skip
      }
    }
  }
  return out;
}

async function scanFile(
  filePath: string,
  visit: (ts: Date | null, usage: RawUsage) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.includes('"usage"')) return;
      try {
        const obj = JSON.parse(line);
        const usage =
          obj?.message?.usage ?? obj?.usage ?? null;
        if (!usage || typeof usage !== "object") return;
        const tsRaw = obj?.timestamp ?? obj?.message?.timestamp ?? null;
        const ts = tsRaw ? new Date(tsRaw) : null;
        visit(ts && !isNaN(ts.getTime()) ? ts : null, usage as RawUsage);
      } catch {
        // skip malformed lines
      }
    });
    rl.on("close", () => resolve());
    rl.on("error", reject);
  });
}

export async function getAnthropicUsage(): Promise<AnthropicUsage> {
  if (FIXTURE_MODE) {
    const raw = await fs.readFile(DEMO_ANTHROPIC_JSON, "utf8");
    const data = JSON.parse(raw) as Omit<AnthropicUsage, "scanned_at">;
    return { ...data, scanned_at: new Date().toISOString() };
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const files = await listRecentJsonl();
  const now = new Date();
  const t5h = new Date(now.getTime() - 5 * 3_600_000);
  const t24h = new Date(now.getTime() - 24 * 3_600_000);
  const tWeek = new Date(now.getTime() - 7 * 24 * 3_600_000);
  const tMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );

  const last_5h = emptyBucket();
  const last_24h = emptyBucket();
  const this_week = emptyBucket();
  const this_month = emptyBucket();
  const byDay = new Map<string, Bucket>();
  const byProject = new Map<string, Bucket>();

  for (const { filePath, project } of files) {
    let projBucket = byProject.get(project);
    if (!projBucket) {
      projBucket = emptyBucket();
      byProject.set(project, projBucket);
    }
    await scanFile(filePath, (ts, usage) => {
      addUsage(projBucket!, usage);
      if (!ts) return;
      if (ts >= t5h) addUsage(last_5h, usage);
      if (ts >= t24h) addUsage(last_24h, usage);
      if (ts >= tWeek) addUsage(this_week, usage);
      if (ts >= tMonth) addUsage(this_month, usage);
      const day = ts.toISOString().slice(0, 10);
      let bd = byDay.get(day);
      if (!bd) {
        bd = emptyBucket();
        byDay.set(day, bd);
      }
      addUsage(bd, usage);
    });
  }

  const byDayArr = Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 14)
    .map(([day, b]) => ({
      day,
      output: b.output,
      total_input: b.input + b.cache_create + b.cache_read,
      messages: b.messages,
    }));

  const topProjects = Array.from(byProject.entries())
    .map(([project, b]) => ({
      project: project.replace(/^-/, "").replace(/-/g, "/"),
      output: b.output,
      messages: b.messages,
    }))
    .sort((a, b) => b.output - a.output)
    .slice(0, 5);

  const value: AnthropicUsage = {
    scanned_at: now.toISOString(),
    files_scanned: files.length,
    last_5h,
    last_24h,
    this_week,
    this_month,
    by_day: byDayArr,
    top_projects: topProjects,
  };
  cache = { at: Date.now(), value };
  return value;
}
