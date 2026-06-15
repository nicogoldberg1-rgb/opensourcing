import type { NicheScores } from "../../lib/types";
import { cn } from "../../lib/cn";

// Compact at-a-glance fit score for dense list rows — the average of the 4+1
// dimensions. Hover shows the full breakdown; the drawer has the detailed view.
const DIMS: [keyof NicheScores, string][] = [
  ["growth", "Growth"],
  ["size", "Market size"],
  ["criticality", "Criticality"],
  ["penetration", "Penetration"],
  ["quality", "Business quality"],
];

export function scoreAverage(scores: NicheScores): number {
  const vals = DIMS.map(([k]) => scores[k] ?? 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function tone(avg: number): string {
  if (avg >= 4) return "bg-emerald-50 text-emerald-700";
  if (avg >= 3) return "bg-amber-50 text-amber-800";
  return "bg-neutral-100 text-neutral-600";
}

export function ScoreAverage({ scores }: { scores: NicheScores }) {
  const avg = scoreAverage(scores);
  const tip = DIMS.map(([k, n]) => `${n}: ${scores[k]}/5`).join("\n");
  return (
    <span
      title={`Fit score (avg of 4+1)\n${tip}`}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded px-1.5 font-mono text-[10px] font-medium tabular-nums",
        tone(avg),
      )}
    >
      Fit {avg.toFixed(1)}
    </span>
  );
}
