import { formatDistanceToNowStrict, parseISO } from "date-fns";
import type { Niche, NicheScores, NicheStatus } from "./types";

export const PRIMARY_COLUMNS: NicheStatus[] = [
  "seed",
  "proposed",
  "approved",
  "queued",
  "in_progress",
  "cycle_complete",
];

export const SIDE_COLUMNS: NicheStatus[] = ["rejected", "paused"];

export const ARCHIVE_STATUSES: NicheStatus[] = [
  "completed",
  "partial",
  "ready",
  "researched",
  "in_conversation",
  "activated",
];

export const COLUMN_LABELS: Record<NicheStatus, string> = {
  seed: "Seed",
  proposed: "Proposed",
  approved: "Approved",
  queued: "Queued",
  in_progress: "In progress",
  cycle_complete: "Cycle complete",
  activated: "Activated",
  paused: "Paused",
  rejected: "Rejected",
  completed: "Completed (legacy)",
  partial: "Partial (legacy)",
  ready: "Ready (legacy)",
  researched: "Researched (legacy)",
  in_conversation: "In conversation (legacy)",
};

export function statusAddedTimestamp(n: Niche): string | undefined {
  return (
    n.proposed_at ??
    n.approved_at ??
    n.queued_at ??
    n.in_progress_at ??
    n.cycle_complete_at ??
    n.rejected_at ??
    n.paused_at ??
    (n.created && n.created.length >= 7 ? `${n.created}-01T00:00:00Z` : undefined)
  );
}

export function relativeFromIso(iso?: string): string {
  if (!iso) return "—";
  try {
    return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
  } catch {
    return "—";
  }
}

export function absoluteFromIso(iso?: string): string {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const INLINE_SCORE_RE = /\bG([1-5])\s+S([1-5])\s+C([1-5])\s+P([1-5])\s+Q([1-5])\b/;

export function extractScores(n: Niche): NicheScores | undefined {
  if (n.scores) return n.scores;
  if (!n.notes) return undefined;
  const m = n.notes.match(INLINE_SCORE_RE);
  if (!m) return undefined;
  return {
    growth: Number(m[1]),
    size: Number(m[2]),
    criticality: Number(m[3]),
    penetration: Number(m[4]),
    quality: Number(m[5]),
  };
}

/**
 * Find the "Tailwind(s): ..." sentence inside a free-form note. Returns the
 * matched span (start..end offsets into `notes`) plus the tailwind text. We
 * stop at the first period followed by whitespace and a sentence-starting
 * character — that handles the brainstormer's typical "Tailwinds: X, Y, Z.
 * Adjacent: ..." structure without swallowing the next clause.
 */
export function findTailwind(notes?: string): {
  text: string;
  start: number;
  end: number;
} | undefined {
  if (!notes) return undefined;
  const labelRe = /Tailwinds?:\s*/i;
  const m = notes.match(labelRe);
  if (!m || m.index === undefined) return undefined;
  const labelStart = m.index;
  const bodyStart = labelStart + m[0].length;
  const rest = notes.slice(bodyStart);
  // End at: period + whitespace + sentence-starting char, OR a known follow-on
  // label (Adjacencies:, Adjacent:, Why now:, Distinct from, 4+1:, Inven desc:).
  const sentenceEnd = rest.search(/\.\s+[A-Z~$0-9(]/);
  const labelEnd = rest.search(
    /\s+(?:Adjacencies|Adjacent niches|Adjacent|Distinct from|Why now|4\+1|Inven desc|Source|Note)[:\s]/,
  );
  const candidates = [sentenceEnd, labelEnd].filter((i) => i >= 0);
  const cutAt = candidates.length ? Math.min(...candidates) : rest.length;
  const includesPeriod =
    sentenceEnd >= 0 && (labelEnd < 0 || sentenceEnd <= labelEnd);
  const end = bodyStart + (includesPeriod ? cutAt + 1 : cutAt);
  const text = notes.slice(bodyStart, end).trim();
  if (!text) return undefined;
  return { text, start: labelStart, end };
}

export function extractTailwind(notes?: string): string | undefined {
  return findTailwind(notes)?.text;
}

/** Notes with the tailwind sentence (label + body) removed. */
export function stripTailwind(notes?: string): string {
  if (!notes) return "";
  const hit = findTailwind(notes);
  if (!hit) return notes.trim();
  const before = notes.slice(0, hit.start).trimEnd();
  const after = notes.slice(hit.end).trimStart();
  return [before, after].filter(Boolean).join(" ").trim();
}

export type Origin = "user" | "claude" | "unknown";

export function originFor(source?: string): Origin {
  if (!source) return "unknown";
  const s = source.toLowerCase();
  if (s.includes("orchestrator") || s.includes("brainstorm") || s.includes("autopilot")) {
    return "claude";
  }
  if (
    s.includes("dashboard") ||
    s.includes("manual") ||
    s.includes("user") ||
    s.includes("nico") ||
    s.includes("seed")
  ) {
    return "user";
  }
  return "unknown";
}

export function originLabel(origin: Origin): string {
  if (origin === "user") return "Added by you";
  if (origin === "claude") return "Brainstormed by Claude";
  return "Origin unknown";
}

export function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length > n ? `${cleaned.slice(0, n - 1)}…` : cleaned;
}
