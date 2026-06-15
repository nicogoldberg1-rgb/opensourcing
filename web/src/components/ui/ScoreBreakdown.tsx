import type { NicheScores } from "../../lib/types";
import { cn } from "../../lib/cn";

// The "4+1" framework: four market signals plus overall business quality, each
// scored 1–5. Shown as labeled meters so it reads clearly to someone seeing it
// for the first time (vs. the compact G4/S4/… pills used in dense list rows).
const ROWS: { key: keyof NicheScores; name: string; hint: string }[] = [
  { key: "growth", name: "Growth", hint: "Is the market expanding?" },
  { key: "size", name: "Market size", hint: "Enough targets to matter?" },
  { key: "criticality", name: "Criticality", hint: "How essential to customers?" },
  { key: "penetration", name: "Penetration", hint: "Still fragmented / un-rolled-up?" },
  { key: "quality", name: "Business quality", hint: "Margins, recurring revenue, stickiness" },
];

function barColor(v: number): string {
  if (v >= 4) return "bg-emerald-500";
  if (v >= 3) return "bg-amber-400";
  return "bg-neutral-300";
}

export function ScoreBreakdown({ scores }: { scores: NicheScores }) {
  const avg =
    ROWS.reduce((sum, r) => sum + (scores[r.key] ?? 0), 0) / ROWS.length;
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-neutral-500">
          Four market signals + business quality, scored 1–5
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums text-neutral-700">
          {avg.toFixed(1)}/5 avg
        </span>
      </div>
      <div className="space-y-1.5">
        {ROWS.map((r) => {
          const v = scores[r.key] ?? 0;
          return (
            <div key={r.key} className="flex items-center gap-2" title={r.hint}>
              <span className="w-28 shrink-0 text-xs text-neutral-600">
                {r.name}
              </span>
              <div className="flex flex-1 gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-sm",
                      i <= v ? barColor(v) : "bg-neutral-200",
                    )}
                  />
                ))}
              </div>
              <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-neutral-700">
                {v}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
