import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { Check, Pause, Play, Plus, Search, Sparkles, User, X } from "lucide-react";
import type { Niche, NicheStatus } from "../lib/types";
import {
  extractScores,
  extractTailwind,
  originFor,
  originLabel,
  relativeFromIso,
  statusAddedTimestamp,
  truncate,
} from "../lib/format";
import { ScoreAverage } from "./ui/ScoreAverage";
import { Badge } from "./ui/Badge";
import { confirmDialog, promptDialog } from "./ui/Dialog";
import { cn } from "../lib/cn";

export type QuickAction =
  | { kind: "set-status"; status: NicheStatus; reason?: string }
  | { kind: "run-cycle-now" }
  | { kind: "investigate" };

type NicheRowProps = {
  niche: Niche;
  showStatusBadge?: boolean;
  onOpen: (n: Niche) => void;
  onQuickAction: (n: Niche, action: QuickAction) => Promise<void>;
  leadingSlot?: ReactNode;
  isDragging?: boolean;
  style?: CSSProperties;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: (n: Niche) => void;
};

export const NicheRow = forwardRef<HTMLDivElement, NicheRowProps>(
  function NicheRow(
    {
      niche,
      showStatusBadge = false,
      onOpen,
      onQuickAction,
      leadingSlot,
      isDragging = false,
      style,
      selectable = false,
      selected = false,
      onToggleSelected,
    },
    ref,
  ) {
    const scores = extractScores(niche);
    const tailwind = extractTailwind(niche.notes);
    const slug = niche.slug ?? niche.id;
    const ts = statusAddedTimestamp(niche);

    return (
      <div
        ref={ref}
        style={style}
        onClick={() => {
          if (isDragging) return;
          if (selectable) {
            onToggleSelected?.(niche);
            return;
          }
          onOpen(niche);
        }}
        className={cn(
          "group relative flex cursor-pointer gap-2 rounded-md border border-neutral-200 bg-white py-2.5 pl-2 pr-3 text-left shadow-sm",
          "transition-all hover:border-neutral-300 hover:shadow-md",
          isDragging && "z-10 rotate-[0.5deg] shadow-lg ring-2 ring-accent",
          selectable && selected && "border-accent bg-indigo-50/40 ring-1 ring-accent",
        )}
      >
        {selectable && (
          <div className="flex shrink-0 items-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelected?.(niche)}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 cursor-pointer rounded border-neutral-300 text-accent focus:ring-1 focus:ring-accent focus:ring-offset-0"
            />
          </div>
        )}
        {!selectable && leadingSlot && (
          <div className="flex shrink-0 items-center">{leadingSlot}</div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold text-neutral-900">
              <OriginIcon source={niche.source} />
              <span className="truncate">{niche.name}</span>
            </h3>
            <div className="flex shrink-0 items-center gap-2 transition-opacity group-hover:invisible group-hover:opacity-0">
              {showStatusBadge && <Badge tone="neutral">{niche.status}</Badge>}
              {scores && <ScoreAverage scores={scores} />}
            </div>
          </div>

          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-neutral-500">
            <span className="truncate font-mono text-neutral-400">{slug}</span>
            {ts && <span className="text-neutral-300">·</span>}
            {ts && <span className="shrink-0">{relativeFromIso(ts)}</span>}
            {tailwind && (
              <>
                <span className="text-neutral-300">·</span>
                <span
                  className="min-w-0 truncate text-indigo-600"
                  title={tailwind}
                >
                  ↗ {truncate(tailwind, 80)}
                </span>
              </>
            )}
          </div>

          {niche.notes && !tailwind && (
            <p className="mt-1 line-clamp-1 text-[11.5px] text-neutral-500">
              {truncate(niche.notes, 120)}
            </p>
          )}
        </div>

        {!selectable && <QuickActions niche={niche} onAction={onQuickAction} />}
      </div>
    );
  },
);

function OriginIcon({ source }: { source?: string }) {
  const origin = originFor(source);
  if (origin === "unknown") return null;
  const label = originLabel(origin);
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        origin === "user" ? "text-blue-500" : "text-indigo-500",
      )}
    >
      {origin === "user" ? <User size={11} /> : <Sparkles size={11} />}
    </span>
  );
}

function QuickActions({
  niche,
  onAction,
}: {
  niche: Niche;
  onAction: (n: Niche, a: QuickAction) => Promise<void>;
}) {
  const status = niche.status;

  const can = {
    investigate: status === "seed",
    approve:
      status === "proposed" || status === "rejected" || status === "paused",
    queue:
      status === "approved" || status === "proposed" || status === "paused",
    run: status === "approved" || status === "queued" || status === "proposed",
    pause:
      status === "approved" || status === "queued" || status === "in_progress",
    reject: status !== "rejected",
  };

  const click = async (
    e: React.MouseEvent,
    action: QuickAction,
    confirm?: { title: string; description?: string; destructive?: boolean; label?: string },
  ) => {
    e.stopPropagation();
    if (confirm) {
      const ok = await confirmDialog({
        title: confirm.title,
        description: confirm.description,
        destructive: confirm.destructive,
        confirmLabel: confirm.label,
      });
      if (!ok) return;
    }
    if (
      action.kind === "set-status" &&
      action.status === "rejected" &&
      !action.reason
    ) {
      const reason = await promptDialog({
        title: `Reject "${niche.name}"`,
        description: "Why are you rejecting this niche? Required.",
        placeholder: "e.g. too cyclical, PE-saturated, owners too young…",
        confirmLabel: "Reject niche",
        destructive: true,
      });
      if (!reason) return;
      void onAction(niche, { ...action, reason });
      return;
    }
    void onAction(niche, action);
  };

  return (
    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
      <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-0.5 shadow-md">
        {can.investigate && (
          <IconButton
            title="Investigate (research and promote to Proposed)"
            tone="accent"
            onClick={(e) =>
              click(e, { kind: "investigate" }, {
                title: `Investigate "${niche.name}"?`,
                description:
                  "Claude will research the niche (no Inven credits used) and write rich notes + buy-box, then promote it to Proposed. Takes a few minutes.",
                label: "Investigate",
              })
            }
          >
            <Search size={14} />
          </IconButton>
        )}
        {can.approve && (
          <IconButton
            title="Approve"
            tone="green"
            onClick={(e) =>
              click(e, { kind: "set-status", status: "approved" })
            }
          >
            <Check size={14} />
          </IconButton>
        )}
        {can.queue && (
          <IconButton
            title="Queue"
            tone="blue"
            onClick={(e) => click(e, { kind: "set-status", status: "queued" })}
          >
            <Plus size={14} />
          </IconButton>
        )}
        {can.run && (
          <IconButton
            title="Run cycle now"
            tone="accent"
            onClick={(e) =>
              click(e, { kind: "run-cycle-now" }, {
                title: `Run a cycle on "${niche.name}" now?`,
                description:
                  "Marks the niche queued and writes a trigger file. Run /run-cycle in your Claude session to start it.",
                label: "Queue and trigger",
              })
            }
          >
            <Play size={14} />
          </IconButton>
        )}
        {can.pause && (
          <IconButton
            title="Pause"
            onClick={(e) =>
              click(
                e,
                { kind: "set-status", status: "paused" },
                {
                  title: `Pause "${niche.name}"?`,
                  description: "It will skip the queue until you resume it.",
                  label: "Pause",
                },
              )
            }
          >
            <Pause size={14} />
          </IconButton>
        )}
        {can.reject && (
          <IconButton
            title="Reject"
            tone="red"
            onClick={(e) =>
              click(e, { kind: "set-status", status: "rejected" })
            }
          >
            <X size={14} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

type ToneKey = "green" | "blue" | "accent" | "red" | "neutral";
const TONE_HOVER: Record<ToneKey, string> = {
  green: "hover:bg-emerald-50 hover:text-emerald-700",
  blue: "hover:bg-blue-50 hover:text-blue-700",
  accent: "hover:bg-indigo-50 hover:text-indigo-700",
  red: "hover:bg-red-50 hover:text-red-700",
  neutral: "hover:bg-neutral-100 hover:text-neutral-800",
};

function IconButton({
  children,
  title,
  tone = "neutral",
  onClick,
}: {
  children: ReactNode;
  title: string;
  tone?: ToneKey;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded text-neutral-500 transition-colors",
        TONE_HOVER[tone],
      )}
    >
      {children}
    </button>
  );
}
