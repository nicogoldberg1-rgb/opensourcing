import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  Pause,
  RefreshCw,
} from "lucide-react";
import { api } from "../lib/api";
import type { CycleSummary } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { absoluteFromIso, relativeFromIso } from "../lib/format";
import { cn } from "../lib/cn";
import type { HomeContext } from "./Home";

const PHASE_NAMES: Record<number, string> = {
  1: "Search",
  2: "Pull",
  3: "Screen",
  4: "Contacts",
  5: "Personalize",
  6: "Sequence build",
  7: "Letters",
};

type CycleVisualState =
  | "active"
  | "awaiting_activation"
  | "stuck"
  | "complete"
  | "idle";

function visualState(c: CycleSummary): CycleVisualState {
  if (c.is_active) return "active";
  if (c.needs_activation) return "awaiting_activation";
  const phase = c.state.phase ?? "";
  if (/halt/i.test(phase) || c.state.status === "halted") return "stuck";
  if (/complete/i.test(phase)) return "complete";
  return "idle";
}

const STATE_BADGE: Record<
  CycleVisualState,
  { tone: "blue" | "amber" | "green" | "neutral" | "red"; label: string }
> = {
  active: { tone: "blue", label: "Active" },
  awaiting_activation: { tone: "amber", label: "Awaiting activation" },
  stuck: { tone: "red", label: "Stuck — needs review" },
  complete: { tone: "green", label: "Complete" },
  idle: { tone: "neutral", label: "Idle" },
};

const STATE_ICON: Record<CycleVisualState, React.ReactNode> = {
  active: <Loader2 size={14} className="animate-spin text-blue-600" />,
  awaiting_activation: <Pause size={14} className="text-amber-600" />,
  stuck: <AlertOctagon size={14} className="text-red-600" />,
  complete: <Check size={14} className="text-emerald-600" />,
  idle: <div className="h-1.5 w-1.5 rounded-full bg-neutral-300" />,
};

export default function CycleListPage() {
  const ctx = useOutletContext<HomeContext>();
  const [cycles, setCycles] = useState<CycleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const d = await api.getCycles();
      setCycles(d.cycles);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    ctx.setSubtitle(cycles ? `${cycles.length} cycles` : undefined);
    return () => ctx.setSubtitle(undefined);
  }, [cycles, ctx]);

  // Priority order: needs_activation → active → halted → complete → idle, then by modified_at desc
  const sorted = useMemo(() => {
    if (!cycles) return [];
    const rank = (c: CycleSummary): number => {
      const v = visualState(c);
      if (v === "stuck") return 0; // problems first — they need eyes
      if (v === "awaiting_activation") return 1;
      if (v === "active") return 2;
      if (v === "complete") return 3;
      return 4;
    };
    return [...cycles].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return b.modified_at.localeCompare(a.modified_at);
    });
  }, [cycles]);

  const counts = useMemo(() => {
    const c = {
      total: 0,
      active: 0,
      awaiting_activation: 0,
      stuck: 0,
      complete: 0,
    };
    for (const x of cycles ?? []) {
      c.total++;
      const v = visualState(x);
      if (v === "active") c.active++;
      if (v === "awaiting_activation") c.awaiting_activation++;
      if (v === "stuck") c.stuck++;
      if (v === "complete") c.complete++;
    }
    return c;
  }, [cycles]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Cycles" value={String(counts.total)} />
        <Stat
          label="Stuck"
          value={String(counts.stuck)}
          tone={counts.stuck > 0 ? "red" : undefined}
        />
        <Stat
          label="Awaiting activation"
          value={String(counts.awaiting_activation)}
          tone={counts.awaiting_activation > 0 ? "amber" : undefined}
        />
        <Stat
          label="Active"
          value={String(counts.active)}
          tone={counts.active > 0 ? "blue" : undefined}
        />
        <div className="flex items-end justify-end">
          <Button size="sm" variant="secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        {!cycles ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
            <div className="text-2xl text-neutral-300">○</div>
            <div className="text-sm font-medium text-neutral-700">
              No cycles yet
            </div>
            <div className="max-w-sm text-xs text-neutral-500">
              Kick one off with <code className="rounded bg-neutral-100 px-1 font-mono">/run-cycle &lt;slug&gt;</code>{" "}
              in a Claude session. Cycle directories show up here as they're created.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {sorted.map((c) => (
              <CycleRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CycleRow({ c }: { c: CycleSummary }) {
  const v = visualState(c);
  const badge = STATE_BADGE[v];
  const phaseName = PHASE_NAMES[c.current_phase_num];
  const seqId = c.state.sequence_id;
  const haltReason = c.state.halt_reason;

  return (
    <li>
      <Link
        to={`/cycle/${c.id}`}
        className={cn(
          "group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-neutral-50",
          v === "awaiting_activation" && "bg-amber-50/40 hover:bg-amber-50/70",
          v === "stuck" && "bg-red-50/40 hover:bg-red-50/70",
        )}
      >
        <div className="flex w-6 shrink-0 items-center justify-center">
          {STATE_ICON[v]}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-neutral-900">{c.niche_slug}</span>
            <span className="font-mono text-[11px] text-neutral-400">{c.date}</span>
            <Badge tone={badge.tone}>
              {v === "stuck" && <AlertTriangle size={10} className="mr-0.5 inline" />}
              {badge.label}
            </Badge>
            {c.is_active && (
              <span className="inline-flex items-center gap-1 text-[11px] text-blue-700">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                live
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-neutral-500">
            {phaseName && (
              <span>
                <span className="font-mono text-neutral-400">Phase {c.current_phase_num}</span>
                <span className="mx-1.5 text-neutral-300">·</span>
                {phaseName}
              </span>
            )}
            {seqId && (
              <>
                <span className="text-neutral-300">·</span>
                <span>
                  Sequence <span className="font-mono">#{seqId}</span>
                  {c.state.contacts != null && ` · ${c.state.contacts} contacts`}
                </span>
              </>
            )}
            <span className="text-neutral-300">·</span>
            <span title={absoluteFromIso(c.modified_at)}>
              {relativeFromIso(c.modified_at)}
            </span>
          </div>
          {v === "stuck" && haltReason && (
            <div className="mt-1 truncate text-[11px] text-red-700" title={haltReason}>
              {haltReason}
            </div>
          )}
        </div>

        {v === "awaiting_activation" && seqId && (
          <a
            href={`https://run.reply.io/sequence/${seqId}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200"
          >
            Activate
          </a>
        )}

        <ArrowRight
          size={14}
          className="shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500"
        />
      </Link>
    </li>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "blue" | "amber" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white px-4 py-3 shadow-sm",
        tone === "blue" && "border-blue-200 bg-blue-50/40",
        tone === "amber" && "border-amber-200 bg-amber-50/40",
        tone === "red" && "border-red-200 bg-red-50/40",
        !tone && "border-neutral-200",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-xl font-semibold tabular-nums",
          tone === "blue" && "text-blue-700",
          tone === "amber" && "text-amber-700",
          tone === "red" && "text-red-700",
          !tone && "text-neutral-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}
