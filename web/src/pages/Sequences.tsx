import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ExternalLink, RefreshCw } from "lucide-react";
import { SequenceLink } from "../components/SequenceLink";
import { api } from "../lib/api";
import type { Sequence } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { absoluteFromIso, relativeFromIso } from "../lib/format";
import { cn } from "../lib/cn";
import type { HomeContext } from "./Home";

const STATUS_TONE: Record<string, "neutral" | "blue" | "green" | "amber" | "red"> = {
  Draft: "neutral",
  Active: "green",
  Paused: "amber",
  Stopped: "red",
  Completed: "blue",
};

type FilterKey = "all" | "Draft" | "Active" | "Paused" | "Completed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Draft", label: "Draft" },
  { key: "Active", label: "Active" },
  { key: "Paused", label: "Paused" },
  { key: "Completed", label: "Completed" },
];

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export default function SequencesPage() {
  const ctx = useOutletContext<HomeContext>();
  const [sequences, setSequences] = useState<Sequence[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await api.getSequences();
      setSequences(data.sequences);
      setFetchedAt(data.fetched_at);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    ctx.setSubtitle(sequences ? `${sequences.length} sequences` : undefined);
    return () => ctx.setSubtitle(undefined);
  }, [sequences, ctx]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: sequences?.length ?? 0,
      Draft: 0,
      Active: 0,
      Paused: 0,
      Completed: 0,
    };
    for (const s of sequences ?? []) {
      if (s.status_label in c) c[s.status_label as FilterKey]++;
    }
    return c;
  }, [sequences]);

  const totals = useMemo(() => {
    const seqs = sequences ?? [];
    const t = seqs.reduce(
      (acc, s) => {
        acc.contacts += s.contacts.total;
        acc.deliveries += s.deliveries;
        acc.opens += s.opens;
        acc.replies += s.replies;
        return acc;
      },
      { contacts: 0, deliveries: 0, opens: 0, replies: 0 },
    );
    return {
      ...t,
      open_rate: t.deliveries > 0 ? t.opens / t.deliveries : null,
      reply_rate: t.deliveries > 0 ? t.replies / t.deliveries : null,
    };
  }, [sequences]);

  const filtered = useMemo(() => {
    if (!sequences) return [];
    if (filter === "all") return sequences;
    return sequences.filter((s) => s.status_label === filter);
  }, [sequences, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Sequences" value={String(counts.all)} sub={`${counts.Active} active · ${counts.Draft} draft`} />
        <Stat label="Contacts" value={totals.contacts.toLocaleString()} sub={`${totals.deliveries.toLocaleString()} delivered`} />
        <Stat label="Opens" value={totals.opens.toLocaleString()} sub={pct(totals.open_rate)} />
        <Stat label="Replies" value={totals.replies.toLocaleString()} sub={pct(totals.reply_rate)} />
        <div className="flex items-end justify-end gap-2">
          {fetchedAt && (
            <span className="text-[11px] text-neutral-400" title={absoluteFromIso(fetchedAt)}>
              Updated {relativeFromIso(fetchedAt)}
            </span>
          )}
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

      <div className="flex items-center gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
            )}
          >
            {f.label}
            <span
              className={cn(
                "inline-flex h-4 min-w-[18px] items-center justify-center rounded px-1 font-mono text-[10px] tabular-nums",
                filter === f.key ? "bg-white/20 text-white" : "bg-neutral-200/70 text-neutral-600",
              )}
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Name</th>
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-right">Contacts</th>
              <th className="px-3 py-2.5 text-right">Delivered</th>
              <th className="px-3 py-2.5 text-right">Opens</th>
              <th className="px-3 py-2.5 text-right">Replies</th>
              <th className="px-3 py-2.5 text-left">Created</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {!sequences && !error && (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk${i}`}>
                    <td colSpan={8} className="px-4 py-2.5">
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))}
              </>
            )}
            {sequences && filtered.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-400">
                  No sequences in this filter.
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <SequenceRow key={s.id} s={s} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SequenceRow({ s }: { s: Sequence }) {
  return (
    <tr className="group transition-colors hover:bg-neutral-50">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {s.is_test && (
            <Badge tone="amber" title="Built by autopilot, awaiting Nico's activation in Reply.io UI">
              TEST
            </Badge>
          )}
          <span className="font-medium text-neutral-900">{s.name.replace(/^TEST[_-]/i, "")}</span>
        </div>
        {s.niche_slug && (
          <div className="mt-0.5 font-mono text-[11px] text-neutral-400">
            {s.niche_slug}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5">
        <Badge tone={STATUS_TONE[s.status_label] ?? "neutral"}>
          {s.status_label}
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
        <div>{s.contacts.total}</div>
        {s.contacts.active > 0 && s.contacts.active !== s.contacts.total && (
          <div className="text-[10px] text-neutral-400">{s.contacts.active} active</div>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-neutral-700">
        {s.deliveries.toLocaleString()}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
        <div>{s.opens.toLocaleString()}</div>
        <div className="text-[10px] text-neutral-400">{pct(s.open_rate)}</div>
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
        <div className={s.replies > 0 ? "font-semibold text-emerald-700" : ""}>
          {s.replies.toLocaleString()}
        </div>
        <div className="text-[10px] text-neutral-400">{pct(s.reply_rate)}</div>
      </td>
      <td className="px-3 py-2.5 text-xs text-neutral-500" title={absoluteFromIso(s.created)}>
        {relativeFromIso(s.created)}
      </td>
      <td className="px-3 py-2.5">
        <SequenceLink
          id={s.id}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-neutral-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
          onClick={(e) => e.stopPropagation()}
        >
          Open <ExternalLink size={11} />
        </SequenceLink>
      </td>
    </tr>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}
