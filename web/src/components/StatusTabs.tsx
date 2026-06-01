import { useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { NicheStatus } from "../lib/types";
import { cn } from "../lib/cn";

export type TabKey = NicheStatus | "archive";

type TabDef = { key: TabKey; label: string; matches: NicheStatus[] };

const PRIMARY: TabDef[] = [
  { key: "seed", label: "Seed", matches: ["seed"] },
  { key: "proposed", label: "Proposed", matches: ["proposed"] },
  { key: "approved", label: "Approved", matches: ["approved"] },
  { key: "queued", label: "Queued", matches: ["queued"] },
  { key: "in_progress", label: "In progress", matches: ["in_progress"] },
  { key: "cycle_complete", label: "Complete", matches: ["cycle_complete"] },
];

const SECONDARY: TabDef[] = [
  { key: "paused", label: "Paused", matches: ["paused"] },
  { key: "rejected", label: "Rejected", matches: ["rejected"] },
  {
    key: "archive",
    label: "Archive",
    matches: [
      "completed",
      "partial",
      "ready",
      "researched",
      "in_conversation",
      "activated",
    ],
  },
];

const ALL: TabDef[] = [...PRIMARY, ...SECONDARY];

export function tabFor(status: NicheStatus): TabKey {
  for (const g of ALL) if (g.matches.includes(status)) return g.key;
  return "archive";
}

export const ALL_TAB_KEYS: TabKey[] = ALL.map((g) => g.key);

export function StatusTabs({
  counts,
  active,
  onChange,
  expanded,
  onExpandToggle,
}: {
  counts: Record<TabKey, number>;
  active: TabKey;
  onChange: (k: TabKey) => void;
  expanded: boolean;
  onExpandToggle: (next: boolean) => void;
}) {
  const activeInSecondary = SECONDARY.some((t) => t.key === active);

  useEffect(() => {
    if (activeInSecondary && !expanded) onExpandToggle(true);
  }, [activeInSecondary, expanded, onExpandToggle]);

  return (
    <div className="-mx-1 flex flex-wrap items-center gap-x-0.5 gap-y-1">
      {PRIMARY.map((g) => (
        <Tab
          key={g.key}
          def={g}
          n={counts[g.key] ?? 0}
          active={active === g.key}
          onClick={() => onChange(g.key)}
        />
      ))}

      <button
        onClick={() => onExpandToggle(!expanded)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
        )}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {expanded ? "Less" : "More"}
      </button>

      {expanded &&
        SECONDARY.map((g) => (
          <Tab
            key={g.key}
            def={g}
            n={counts[g.key] ?? 0}
            active={active === g.key}
            onClick={() => onChange(g.key)}
          />
        ))}
    </div>
  );
}

function Tab({
  def,
  n,
  active,
  onClick,
}: {
  def: TabDef;
  n: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
        n === 0 && !active && "text-neutral-400",
      )}
    >
      {def.label}
      <span
        className={cn(
          "inline-flex h-4 min-w-[18px] items-center justify-center rounded px-1 font-mono text-[10px] tabular-nums",
          active
            ? "bg-white/20 text-white"
            : "bg-neutral-200/70 text-neutral-600",
          n === 0 && !active && "bg-transparent",
        )}
      >
        {n}
      </span>
    </button>
  );
}
