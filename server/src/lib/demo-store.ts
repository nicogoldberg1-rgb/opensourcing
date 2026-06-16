// Per-visitor demo state. In fixture/demo mode every browser gets its own
// private, in-memory copy of the mutable data (niche board, priorities, the
// approval inbox, roadmap), cloned fresh from the committed seed. So one
// visitor's edits never leak to another, and everyone starts clean.
//
// State lives in memory (perfect for the single free-tier instance). If the
// demo is ever scaled to multiple instances, this would need sticky sessions
// or a shared store (Redis); see the README/DEPLOY notes.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import type { Request, Response, NextFunction } from "express";
import { TRACKER_SEED_JSON } from "../paths.js";

export type Tracker = { metadata?: unknown; industries: Record<string, unknown>[] };
export type Priorities = { approved: string[]; queued: string[] };
export type RoadmapBoard = { cards: unknown[] };

type SessionState = {
  tracker: Tracker;
  priorities: Priorities;
  requests: unknown[];
  roadmap: RoadmapBoard;
  lastSeen: number;
};

const COOKIE = "nsp_demo_sid";
const TTL_MS = 2 * 60 * 60 * 1000; // evict after 2h idle
const MAX_SESSIONS = 5000; // hard cap (LRU) as a backstop

const als = new AsyncLocalStorage<{ sid: string }>();
const sessions = new Map<string, SessionState>();

function currentSid(): string {
  return als.getStore()?.sid ?? "__shared__";
}

// ---- seeds (each session starts from these) -------------------------------
let seedTrackerCache: Tracker | null = null;
async function freshTracker(): Promise<Tracker> {
  if (!seedTrackerCache) {
    const raw = await fs.readFile(TRACKER_SEED_JSON, "utf8");
    seedTrackerCache = JSON.parse(raw) as Tracker;
  }
  return structuredClone(seedTrackerCache);
}
function freshPriorities(): Priorities {
  return {
    approved: ["veterinary-practice-mgmt-software"],
    queued: ["hipaa-compliance-software"],
  };
}
function freshRequests(): unknown[] {
  return [
    {
      id: "demo-intern-request",
      kind: "run-cycle",
      slug: "veterinary-practice-mgmt-software",
      label: 'Run a cycle on "Veterinary Practice Mgmt Software"',
      requested_by: "intern@demo.example",
      requested_at: "2026-06-15T09:00:00Z",
      status: "pending",
    },
  ];
}

function sweep() {
  const now = Date.now();
  for (const [sid, st] of sessions) {
    if (now - st.lastSeen > TTL_MS) sessions.delete(sid);
  }
  if (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (let i = 0; i < oldest.length - MAX_SESSIONS; i++) sessions.delete(oldest[i][0]);
  }
}

async function state(): Promise<SessionState> {
  const sid = currentSid();
  let st = sessions.get(sid);
  if (!st) {
    st = {
      tracker: await freshTracker(),
      priorities: freshPriorities(),
      requests: freshRequests(),
      roadmap: { cards: [] },
      lastSeen: Date.now(),
    };
    sessions.set(sid, st);
    sweep();
  }
  st.lastSeen = Date.now();
  return st;
}

// ---- accessors used by the fixture-mode libs ------------------------------
export async function getSessionTracker(): Promise<Tracker> {
  return (await state()).tracker;
}
export async function setSessionTracker(t: Tracker): Promise<void> {
  (await state()).tracker = t;
}
export async function getSessionPriorities(): Promise<Priorities> {
  return (await state()).priorities;
}
export async function setSessionPriorities(p: Priorities): Promise<void> {
  (await state()).priorities = p;
}
export async function getSessionRequests(): Promise<unknown[]> {
  return (await state()).requests;
}
export async function setSessionRequests(r: unknown[]): Promise<void> {
  (await state()).requests = r;
}
export async function getSessionRoadmap(): Promise<RoadmapBoard> {
  return (await state()).roadmap;
}
export async function setSessionRoadmap(b: RoadmapBoard): Promise<void> {
  (await state()).roadmap = b;
}

// ---- middleware: assign a cookie + run the request in the session context --
function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function demoSessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  let sid = cookies[COOKIE];
  if (!sid || !/^[a-f0-9-]{8,}$/i.test(sid)) {
    sid = randomUUID();
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${sid}; Path=/; Max-Age=86400; SameSite=Lax`,
    );
  }
  als.run({ sid }, () => next());
}
