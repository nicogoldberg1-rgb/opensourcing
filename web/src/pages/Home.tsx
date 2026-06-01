import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import type {
  Niche,
  NicheStatus,
  OrchestratorLastRun,
  Priorities,
  Tracker,
} from "../lib/types";
import { NicheList } from "../components/NicheList";
import { NicheDrawer } from "../components/NicheDrawer";
import { DigestPanel } from "../components/DigestPanel";
import { useToast } from "../components/ui/Toaster";
import type { TabKey } from "../components/StatusTabs";

type QuickAction =
  | { kind: "set-status"; status: NicheStatus; reason?: string }
  | { kind: "run-cycle-now" }
  | { kind: "investigate" };

export type HomeContext = {
  setSubtitle: (s: string | undefined) => void;
};

export default function HomePage() {
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [lastRun, setLastRun] = useState<OrchestratorLastRun | null>(null);
  const [priorities, setPriorities] = useState<Priorities>({
    approved: [],
    queued: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [openNicheId, setOpenNicheId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("proposed");
  const { push } = useToast();
  const ctx = useOutletContext<HomeContext>();

  const refresh = useCallback(async () => {
    try {
      const [t, r, p] = await Promise.all([
        api.getTracker(),
        api.getLastRun(),
        api.getPriorities(),
      ]);
      setTracker(t);
      setLastRun(r);
      setPriorities(p);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    ctx.setSubtitle(
      tracker ? `${tracker.industries.length} niches` : undefined,
    );
    return () => ctx.setSubtitle(undefined);
  }, [tracker, ctx]);

  const openNiche = useMemo(
    () => tracker?.industries.find((n) => n.id === openNicheId) ?? null,
    [tracker, openNicheId],
  );

  const applyAction = useCallback(
    async (n: Niche, action: QuickAction) => {
      if (!tracker) return;
      const prev = tracker;

      const optimisticStatus: NicheStatus | null =
        action.kind === "set-status"
          ? action.status
          : action.kind === "run-cycle-now"
            ? "queued"
            : null;

      if (optimisticStatus) {
        setTracker({
          ...tracker,
          industries: tracker.industries.map((x) =>
            x.id === n.id ? { ...x, status: optimisticStatus } : x,
          ),
        });
      }

      try {
        if (action.kind === "set-status") {
          await api.setStatus(n.id, action.status, action.reason);
          push(`"${n.name}" → ${action.status.replace("_", " ")}`, "success");
        } else if (action.kind === "run-cycle-now") {
          const res = await api.runCycleNow(n.id);
          push(res.message, "success");
        } else if (action.kind === "investigate") {
          const res = await api.investigateSeed(n.id);
          push(res.message, "success");
        }
        void refresh();
      } catch (e) {
        setTracker(prev);
        push(`Action failed: ${String(e)}`, "error");
      }
    },
    [tracker, push, refresh],
  );

  const handleReorder = useCallback(
    async (lane: "approved" | "queued", order: string[]) => {
      const prev = priorities;
      setPriorities({ ...priorities, [lane]: order });
      try {
        const updated = await api.setLaneOrder(lane, order);
        setPriorities(updated);
      } catch (e) {
        setPriorities(prev);
        push(`Reorder failed: ${String(e)}`, "error");
      }
    },
    [priorities, push],
  );

  return (
    <>
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-5 lg:grid-cols-2">
        <main className="min-h-0 overflow-hidden">
          <DigestPanel data={lastRun} niches={tracker?.industries ?? []} />
        </main>
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-3 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Niches</h2>
            <span className="text-[11px] text-neutral-400">
              hover a row for actions
            </span>
          </div>
          {tracker ? (
            <NicheList
              niches={tracker.industries}
              approvedOrder={priorities.approved}
              queuedOrder={priorities.queued}
              onReorder={handleReorder}
              onOpenNiche={(n) => setOpenNicheId(n.id)}
              onQuickAction={applyAction}
              onSeedAdded={() => {
                void refresh();
                push("Seed added", "success");
              }}
              onBulkActionDone={() => {
                void refresh();
              }}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              Loading…
            </div>
          )}
        </aside>
      </div>

      <NicheDrawer
        niche={openNiche}
        onClose={() => setOpenNicheId(null)}
        onAction={async (n, action) => {
          await applyAction(n, action);
          setOpenNicheId(null);
        }}
      />
    </>
  );
}
