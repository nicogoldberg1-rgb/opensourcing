import type { NicheScores } from "../../lib/types";
import { cn } from "../../lib/cn";

const LABELS: { key: keyof NicheScores; letter: string; name: string }[] = [
  { key: "growth", letter: "G", name: "Growth" },
  { key: "size", letter: "S", name: "Size" },
  { key: "criticality", letter: "C", name: "Criticality" },
  { key: "penetration", letter: "P", name: "Penetration" },
  { key: "quality", letter: "Q", name: "Quality" },
];

function pillColor(v: number): string {
  if (v >= 5) return "bg-emerald-100 text-emerald-800";
  if (v >= 4) return "bg-emerald-50 text-emerald-700";
  if (v >= 3) return "bg-amber-50 text-amber-800";
  return "bg-neutral-100 text-neutral-600";
}

export function ScorePills({ scores }: { scores: NicheScores }) {
  return (
    <div className="flex gap-1">
      {LABELS.map(({ key, letter, name }) => (
        <span
          key={key}
          title={`${name}: ${scores[key]}/5`}
          className={cn(
            "inline-flex h-5 min-w-[26px] items-center justify-center rounded px-1 font-mono text-[10px] font-medium tabular-nums",
            pillColor(scores[key]),
          )}
        >
          {letter}
          {scores[key]}
        </span>
      ))}
    </div>
  );
}
