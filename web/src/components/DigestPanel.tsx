import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Play } from "lucide-react";
import type { Niche, OrchestratorLastRun } from "../lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import { confirmDialog } from "./ui/Dialog";
import { useToast } from "./ui/Toaster";
import { api } from "../lib/api";
import { absoluteFromIso, relativeFromIso } from "../lib/format";

function outcomeBadge(outcome?: string) {
  if (!outcome) return <Badge>—</Badge>;
  if (outcome === "idle_brainstorm") return <Badge tone="blue">Brainstorm</Badge>;
  if (outcome === "success") return <Badge tone="green">Cycle · success</Badge>;
  if (outcome === "partial") return <Badge tone="amber">Cycle · partial</Badge>;
  if (outcome === "failed") return <Badge tone="red">Cycle · failed</Badge>;
  return <Badge>{outcome}</Badge>;
}

const QUEUE_STATUSES = [
  "proposed",
  "approved",
  "queued",
  "in_progress",
  "cycle_complete",
] as const;

const QUEUE_LABELS: Record<(typeof QUEUE_STATUSES)[number], string> = {
  proposed: "Proposed",
  approved: "Approved",
  queued: "Queued",
  in_progress: "In progress",
  cycle_complete: "Complete",
};

export function DigestPanel({
  data,
  niches,
}: {
  data: OrchestratorLastRun | null;
  niches: Niche[];
}) {
  const { push } = useToast();
  const [triggering, setTriggering] = useState(false);
  const counts = niches.reduce<Record<string, number>>((acc, n) => {
    acc[n.status] = (acc[n.status] ?? 0) + 1;
    return acc;
  }, {});

  const runNow = async () => {
    const ok = await confirmDialog({
      title: "Run the orchestrator now?",
      description:
        "Same script the 10pm cron uses. Picks up the highest-priority queued niche (or brainstorms if the queue is empty). Takes a few minutes; a Telegram digest fires when it finishes.",
      confirmLabel: "Run now",
    });
    if (!ok) return;
    setTriggering(true);
    try {
      const res = await api.triggerOrchestrator();
      push(res.message, "success");
    } catch (e) {
      push(`Trigger failed: ${String(e)}`, "error");
    } finally {
      setTriggering(false);
    }
  };

  const lockActive = data?.lockActive ?? false;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <header className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          {outcomeBadge(data?.state.last_run_outcome)}
          {data?.state.last_niche && data.state.last_niche !== "none" && (
            <span className="font-mono text-neutral-700">
              {data.state.last_niche}
            </span>
          )}
          <span
            className="text-neutral-500"
            title={absoluteFromIso(data?.state.last_run_at)}
          >
            {data?.state.last_run_at
              ? relativeFromIso(data.state.last_run_at)
              : "—"}
          </span>
          {data?.lockActive && (
            <Badge tone="amber">Run in progress</Badge>
          )}
          <span className="ml-auto flex items-center gap-2 text-[11px] text-neutral-500">
            {QUEUE_STATUSES.map((s) => (
              <span key={s} className="inline-flex items-baseline gap-1">
                <span className="text-neutral-400">{QUEUE_LABELS[s]}</span>
                <span className="font-mono tabular-nums text-neutral-800">
                  {counts[s] ?? 0}
                </span>
              </span>
            ))}
          </span>
        </div>
        {data?.state.last_summary && (
          <p className="mt-2 border-t border-neutral-100 pt-2 text-xs leading-relaxed text-neutral-600">
            {data.state.last_summary}
          </p>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-2.5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">
              Last night's digest
            </h2>
            {data?.latestLog && (
              <span className="font-mono text-[11px] text-neutral-400">
                {data.latestLog.name}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={runNow}
            disabled={triggering || lockActive}
            title={
              lockActive
                ? "A run is already in progress"
                : "Trigger the orchestrator manually (same as the 10pm cron)"
            }
          >
            <Play size={12} />
            {lockActive ? "Running…" : triggering ? "Starting…" : "Run now"}
          </Button>
        </div>
        <div className="prose prose-sm flex-1 overflow-y-auto px-6 py-5">
          {data?.latestLog ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.latestLog.digest}
            </ReactMarkdown>
          ) : !data ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No log yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
