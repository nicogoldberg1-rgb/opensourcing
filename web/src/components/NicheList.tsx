import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Plus, Search, X } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { confirmDialog, promptDialog } from "./ui/Dialog";
import { useToast } from "./ui/Toaster";
import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Niche, NicheStatus } from "../lib/types";
import {
  ALL_TAB_KEYS,
  StatusTabs,
  tabFor,
  type TabKey,
} from "./StatusTabs";
import { NicheRow } from "./NicheRow";
import { SortableNicheRow } from "./SortableNicheRow";
import { statusAddedTimestamp } from "../lib/format";
import { cn } from "../lib/cn";

type QuickAction =
  | { kind: "set-status"; status: NicheStatus; reason?: string }
  | { kind: "run-cycle-now" }
  | { kind: "investigate" };

type RankableLane = "approved" | "queued";

const LANE_FOR_TAB: Partial<Record<TabKey, RankableLane>> = {
  approved: "approved",
  queued: "queued",
};

const LANE_STATUS: Record<RankableLane, NicheStatus> = {
  approved: "approved",
  queued: "queued",
};

const BULK_TABS: TabKey[] = ["seed", "proposed", "approved"];

export function NicheList({
  niches,
  approvedOrder,
  queuedOrder,
  onReorder,
  onOpenNiche,
  onQuickAction,
  onSeedAdded,
  onBulkActionDone,
  activeTab,
  onTabChange,
}: {
  niches: Niche[];
  approvedOrder: string[];
  queuedOrder: string[];
  onReorder: (lane: RankableLane, order: string[]) => Promise<void>;
  onOpenNiche: (n: Niche) => void;
  onQuickAction: (n: Niche, a: QuickAction) => Promise<void>;
  onSeedAdded: () => void;
  onBulkActionDone: () => void;
  activeTab: TabKey;
  onTabChange: (k: TabKey) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [addingSeed, setAddingSeed] = useState(false);
  const [seedName, setSeedName] = useState("");
  const [seedNotes, setSeedNotes] = useState("");
  const [seedSubmitting, setSeedSubmitting] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const { push } = useToast();

  // Clear selection when switching tabs (tab-scoped selection).
  useEffect(() => {
    setSelected(new Set());
    setSelectionMode(false);
  }, [activeTab]);

  const submitSeed = async () => {
    if (!seedName.trim()) return;
    setSeedSubmitting(true);
    setSeedError(null);
    try {
      await api.addSeed(seedName.trim(), seedNotes.trim() || undefined);
      setSeedName("");
      setSeedNotes("");
      setAddingSeed(false);
      onSeedAdded();
    } catch (e) {
      setSeedError(String(e));
    } finally {
      setSeedSubmitting(false);
    }
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = Object.fromEntries(
      ALL_TAB_KEYS.map((k) => [k, 0]),
    ) as Record<TabKey, number>;
    for (const n of niches) c[tabFor(n.status)] = (c[tabFor(n.status)] ?? 0) + 1;
    return c;
  }, [niches]);

  const lane: RankableLane | undefined = LANE_FOR_TAB[activeTab];

  const inTab = useMemo(
    () => niches.filter((n) => tabFor(n.status) === activeTab),
    [niches, activeTab],
  );

  const sortedAll = useMemo(() => {
    if (lane) {
      const order = lane === "approved" ? approvedOrder : queuedOrder;
      const indexOf = new Map(order.map((slug, i) => [slug, i]));
      return [...inTab].sort((a, b) => {
        const ai = indexOf.has(a.id)
          ? indexOf.get(a.id)!
          : Number.MAX_SAFE_INTEGER;
        const bi = indexOf.has(b.id)
          ? indexOf.get(b.id)!
          : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return a.name.localeCompare(b.name);
      });
    }
    return [...inTab].sort((a, b) => {
      const ta = statusAddedTimestamp(a) ?? "";
      const tb = statusAddedTimestamp(b) ?? "";
      return tb.localeCompare(ta);
    });
  }, [inTab, lane, approvedOrder, queuedOrder]);

  const rankBySlug = useMemo(() => {
    const m = new Map<string, number>();
    if (lane) sortedAll.forEach((n, i) => m.set(n.id, i + 1));
    return m;
  }, [sortedAll, lane]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedAll;
    return sortedAll.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.slug ?? n.id).toLowerCase().includes(q) ||
        (n.notes?.toLowerCase() ?? "").includes(q),
    );
  }, [sortedAll, query]);

  const handleDragEnd = (e: DragEndEvent) => {
    if (!lane) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = filtered.map((n) => n.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const nextVisible = arrayMove(ids, from, to);
    const targetStatus = LANE_STATUS[lane];
    const allLaneIds = niches
      .filter((n) => n.status === targetStatus)
      .map((n) => n.id);
    const visibleSet = new Set(nextVisible);
    const tail = allLaneIds.filter((id) => !visibleSet.has(id));
    void onReorder(lane, [...nextVisible, ...tail]);
  };

  const toggleSelected = (n: Niche) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n.id)) next.delete(n.id);
      else next.add(n.id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filtered.map((n) => n.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };

  const bulkSetStatus = async (
    status: NicheStatus,
    confirmTitle: string,
    options?: { destructive?: boolean; reasonRequired?: boolean; confirmLabel?: string },
  ) => {
    const slugs = Array.from(selected);
    if (slugs.length === 0) return;

    let reason: string | undefined;
    if (options?.reasonRequired) {
      const r = await promptDialog({
        title: confirmTitle,
        description: `Apply to ${slugs.length} niche${slugs.length === 1 ? "" : "s"}. Reason required.`,
        placeholder: "e.g. too cyclical, PE-saturated, owners too young…",
        confirmLabel: options.confirmLabel ?? "Reject all",
        destructive: true,
      });
      if (!r) return;
      reason = r;
    } else {
      const ok = await confirmDialog({
        title: confirmTitle,
        description: `Apply to ${slugs.length} niche${slugs.length === 1 ? "" : "s"}.`,
        confirmLabel: options?.confirmLabel ?? "Apply",
        destructive: options?.destructive,
      });
      if (!ok) return;
    }

    setBulkSubmitting(true);
    try {
      const { results } = await api.bulkSetStatus(slugs, status, reason);
      const failures = results.filter((r) => !r.ok);
      const successes = results.length - failures.length;
      if (failures.length === 0) {
        push(`${successes} niche${successes === 1 ? "" : "s"} → ${status.replace("_", " ")}`, "success");
      } else {
        push(
          `${successes} succeeded, ${failures.length} failed (${failures.map((f) => f.slug).join(", ")})`,
          "error",
        );
      }
      exitSelectionMode();
      onBulkActionDone();
    } catch (e) {
      push(`Bulk action failed: ${String(e)}`, "error");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const bulkInvestigate = async () => {
    const slugs = Array.from(selected);
    if (slugs.length === 0) return;
    const ok = await confirmDialog({
      title: `Investigate ${slugs.length} seed${slugs.length === 1 ? "" : "s"}?`,
      description:
        "Claude will research each one (no Inven credits) and promote to Proposed when done. Processed sequentially in one session. Telegram pings when complete.",
      confirmLabel: "Investigate",
    });
    if (!ok) return;
    setBulkSubmitting(true);
    try {
      const res = await api.bulkInvestigate(slugs);
      push(res.message, "success");
      exitSelectionMode();
      onBulkActionDone();
    } catch (e) {
      push(`Bulk investigate failed: ${String(e)}`, "error");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const canBulk = BULK_TABS.includes(activeTab);
  const allInTabSelected = selected.size > 0 && selected.size === filtered.length;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-2.5">
        <StatusTabs
          counts={counts}
          active={activeTab}
          onChange={onTabChange}
          expanded={expanded}
          onExpandToggle={setExpanded}
        />

        {!selectionMode && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                placeholder="Search niche, slug, notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-full rounded-md border border-neutral-200 bg-white pl-7 pr-2 text-xs placeholder:text-neutral-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            {canBulk && filtered.length > 0 && (
              <button
                onClick={() => setSelectionMode(true)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              >
                <CheckSquare size={12} /> Select
              </button>
            )}
          </div>
        )}

        {selectionMode && (
          <div className="flex items-center gap-2 rounded-md border border-accent bg-indigo-50/40 px-2 py-1.5">
            <span className="text-xs font-medium text-neutral-700">
              {selected.size} selected
            </span>
            <button
              onClick={allInTabSelected ? clearSelection : selectAll}
              className="text-[11px] text-accent hover:underline"
            >
              {allInTabSelected ? "Clear" : `Select all (${filtered.length})`}
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <BulkActions
                activeTab={activeTab}
                count={selected.size}
                disabled={bulkSubmitting || selected.size === 0}
                onInvestigate={bulkInvestigate}
                onApprove={() =>
                  bulkSetStatus("approved", `Approve ${selected.size} niche${selected.size === 1 ? "" : "s"}?`, {
                    confirmLabel: "Approve all",
                  })
                }
                onQueue={() =>
                  bulkSetStatus("queued", `Queue ${selected.size} niche${selected.size === 1 ? "" : "s"}?`, {
                    confirmLabel: "Queue all",
                  })
                }
                onReject={() =>
                  bulkSetStatus("rejected", `Reject ${selected.size} niche${selected.size === 1 ? "" : "s"}?`, {
                    destructive: true,
                    reasonRequired: true,
                    confirmLabel: "Reject all",
                  })
                }
              />
              <button
                onClick={exitSelectionMode}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
                title="Exit selection mode"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {!selectionMode && lane && filtered.length > 0 && (
          <p className="text-[11px] text-neutral-400">
            Drag the handle to rank{" "}
            {lane === "queued" ? "(visual order — orchestrator uses its own priority field)" : ""}
            . #1 = top.
          </p>
        )}

        {!selectionMode && activeTab === "seed" && (
          <div className="rounded-md border border-dashed border-neutral-200 bg-white p-2">
            {addingSeed ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={seedName}
                  onChange={(e) => setSeedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setAddingSeed(false);
                      setSeedError(null);
                    }
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitSeed();
                  }}
                  placeholder="Niche name (e.g. 'Industrial bakeries')"
                  className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <textarea
                  value={seedNotes}
                  onChange={(e) => setSeedNotes(e.target.value)}
                  placeholder="Optional: a sentence or two of context — what got you curious, who buys, why now."
                  rows={3}
                  className="w-full resize-y rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                {seedError && (
                  <p className="text-[11px] text-red-600">{seedError}</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] text-neutral-400">
                    Lands in Seed. Click Investigate later to flesh it out.
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingSeed(false);
                        setSeedError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!seedName.trim() || seedSubmitting}
                      onClick={submitSeed}
                    >
                      {seedSubmitting ? "Adding…" : "Add seed"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingSeed(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <Plus size={13} /> Add a seed idea
              </button>
            )}
          </div>
        )}
      </div>

      <div className="-mr-2 flex-1 space-y-1.5 overflow-y-auto pr-2">
        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-neutral-200 text-xs text-neutral-400">
            {query ? "No matches." : "Empty."}
          </div>
        ) : selectionMode ? (
          filtered.map((n) => (
            <NicheRow
              key={n.id}
              niche={n}
              showStatusBadge={activeTab === "archive"}
              onOpen={onOpenNiche}
              onQuickAction={onQuickAction}
              selectable
              selected={selected.has(n.id)}
              onToggleSelected={toggleSelected}
            />
          ))
        ) : lane ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filtered.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              {filtered.map((n) => (
                <SortableNicheRow
                  key={n.id}
                  niche={n}
                  rank={rankBySlug.get(n.id)}
                  onOpen={onOpenNiche}
                  onQuickAction={onQuickAction}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          filtered.map((n, i) => (
            <NicheRow
              key={n.id}
              niche={n}
              anchor={i === 0}
              showStatusBadge={activeTab === "archive"}
              onOpen={onOpenNiche}
              onQuickAction={onQuickAction}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BulkActions({
  activeTab,
  count,
  disabled,
  onInvestigate,
  onApprove,
  onQueue,
  onReject,
}: {
  activeTab: TabKey;
  count: number;
  disabled: boolean;
  onInvestigate: () => void;
  onApprove: () => void;
  onQueue: () => void;
  onReject: () => void;
}) {
  const hint = count === 0 ? " (pick rows first)" : "";
  return (
    <div className="flex items-center gap-1.5">
      {activeTab === "seed" && (
        <Button size="sm" variant="primary" disabled={disabled} onClick={onInvestigate} title={`Investigate${hint}`}>
          Investigate
        </Button>
      )}
      {activeTab === "proposed" && (
        <Button size="sm" variant="primary" disabled={disabled} onClick={onApprove} title={`Approve${hint}`}>
          Approve
        </Button>
      )}
      {activeTab === "approved" && (
        <Button size="sm" variant="primary" disabled={disabled} onClick={onQueue} title={`Queue${hint}`}>
          Queue
        </Button>
      )}
      <Button size="sm" variant="danger" disabled={disabled} onClick={onReject} title={`Reject${hint}`}>
        Reject
      </Button>
    </div>
  );
}

// Silence eslint about unused cn import if any
void cn;
