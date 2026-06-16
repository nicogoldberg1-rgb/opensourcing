import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, ExternalLink, Info, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import type { SpendPayload } from "../lib/types";
import { Button } from "../components/ui/Button";
import { absoluteFromIso, relativeFromIso } from "../lib/format";
import { cn } from "../lib/cn";
import type { HomeContext } from "./Home";

const POOL_CAPS = {
  export_credits: 50_000,
  contact_credits: 50_000,
  ai_enrichment_credits: 15_000,
};

const MONTH_LABEL = (m: string) => {
  const [y, mm] = m.split("-");
  const d = new Date(Number(y), Number(mm) - 1, 1);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
};

// Inven balance is a manually-refreshed cache; warn once it's older than this.
const INVEN_STALE_DAYS = 3;

function isStale(fetchedIso: string | null): boolean {
  if (!fetchedIso) return false;
  const t = new Date(fetchedIso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > INVEN_STALE_DAYS * 86_400_000;
}

export default function SpendPage() {
  const ctx = useOutletContext<HomeContext>();
  const [data, setData] = useState<SpendPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setData(await api.getSpend());
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    ctx.setSubtitle("Spend");
    return () => ctx.setSubtitle(undefined);
  }, [ctx]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
          Spend
        </h1>
        <Button size="sm" variant="secondary" onClick={refresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <div data-tour="spend-usage" className="flex flex-col gap-5">
          <InvenSection data={data.inven} />
          <AnthropicSection data={data.anthropic} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {data && <LobSection data={data.lob} />}
      </div>
    </div>
  );
}

function InvenSection({ data }: { data: SpendPayload["inven"] }) {
  const balance = data.balance.balance;
  const fetched = data.balance.fetched_at;
  const stale = isStale(fetched);
  const tm = data.this_month;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Inven credits</h2>
        {fetched ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              stale ? "text-amber-600" : "text-neutral-400",
            )}
            title={
              stale
                ? `Cached balance is over ${INVEN_STALE_DAYS} days old — ask Claude to refresh it (see Spend docs).`
                : absoluteFromIso(fetched)
            }
          >
            {stale && <AlertTriangle size={11} className="-mt-px" />}
            Balance as of {relativeFromIso(fetched)}
            {stale && " · stale"}
          </span>
        ) : (
          <span className="text-[11px] text-neutral-400">No balance cached</span>
        )}
      </header>

      {balance ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PoolCard
            label="Export"
            remaining={balance.export_credits}
            cap={POOL_CAPS.export_credits}
            spentThisMonth={tm.export}
          />
          <PoolCard
            label="Contact"
            remaining={balance.contact_credits}
            cap={POOL_CAPS.contact_credits}
            spentThisMonth={tm.contact}
          />
          <PoolCard
            label="AI enrichment"
            remaining={balance.ai_enrichment_credits}
            cap={POOL_CAPS.ai_enrichment_credits}
            spentThisMonth={tm.ai}
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          <Info size={14} className="-mt-0.5 mr-1 inline text-neutral-400" />
          Balance not cached yet. Ask Claude to run{" "}
          <code className="rounded bg-neutral-100 px-1 font-mono text-xs">
            mcp__inven__get_credit_balance
          </code>
          , then{" "}
          <code className="rounded bg-neutral-100 px-1 font-mono text-xs">
            node scripts/write-inven-balance.mjs &lt;export&gt; &lt;contact&gt; &lt;ai&gt;
          </code>
          .
        </div>
      )}

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Spend by month (from cycle logs)
        </h3>
        {data.by_month.length === 0 ? (
          <p className="text-sm text-neutral-500">No cycle spend recorded.</p>
        ) : (
          <table className="min-w-full text-xs">
            <thead className="text-[10.5px] uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="py-1.5 pr-3 text-left">Month</th>
                <th className="px-3 py-1.5 text-right">Cycles</th>
                <th className="px-3 py-1.5 text-right">Export</th>
                <th className="px-3 py-1.5 text-right">Contact</th>
                <th className="px-3 py-1.5 text-right">AI</th>
                <th className="px-3 py-1.5 text-right">Verifalia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.by_month.map((m) => (
                <tr key={m.month}>
                  <td className="py-2 pr-3 text-neutral-700">
                    {MONTH_LABEL(m.month)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-700">
                    {m.cycles}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-900">
                    {m.export}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-900">
                    {m.contact}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-900">
                    {m.ai}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-900">
                    {m.verifalia}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function PoolCard({
  label,
  remaining,
  cap,
  spentThisMonth,
}: {
  label: string;
  remaining: number;
  cap: number;
  spentThisMonth: number;
}) {
  const used = Math.max(0, cap - remaining);
  const pctRemaining = Math.min(100, (remaining / cap) * 100);
  const low = pctRemaining < 20;
  return (
    <div className={cn("rounded-md border bg-neutral-50/40 p-4", low ? "border-amber-200" : "border-neutral-200")}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tabular-nums text-neutral-900">
          {remaining.toLocaleString()}
        </span>
        <span className="text-[11px] text-neutral-400">
          / {cap.toLocaleString()}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            low ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${pctRemaining}%` }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between text-[11px] text-neutral-500">
        <span>{used.toLocaleString()} used lifetime</span>
        <span>
          <span className="font-mono tabular-nums text-neutral-700">
            {spentThisMonth}
          </span>{" "}
          this month
        </span>
      </div>
    </div>
  );
}

function LobSection({ data }: { data: SpendPayload["lob"] }) {
  const tm = data.this_month;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm md:col-span-2">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Lob letters</h2>
        <span
          className={cn(
            "text-[11px]",
            !data.configured && "text-neutral-400",
            data.configured && data.mode === "live" && "text-emerald-600",
            data.configured && data.mode === "test" && "text-amber-600",
          )}
        >
          {!data.configured
            ? "not connected"
            : data.mode === "live"
              ? "Live mode"
              : data.mode === "test"
                ? "Test mode"
                : "connected"}
        </span>
      </header>

      {data.note && (
        <div className="mb-4 rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
          <Info size={12} className="-mt-0.5 mr-1 inline text-neutral-400" />
          {data.note}
        </div>
      )}

      {data.configured && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
              <div className="text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">
                This month
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-neutral-900">
                {tm.count}
              </div>
              <div className="text-[10.5px] text-neutral-400">letters sent</div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
              <div className="text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">
                Spend
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-neutral-900">
                {tm.total_usd > 0 ? `$${tm.total_usd.toFixed(2)}` : "—"}
              </div>
              <div className="text-[10.5px] text-neutral-400">
                {tm.total_usd > 0 ? (
                  "this month"
                ) : (
                  <a
                    href="https://dashboard.lob.com/billing"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    see Lob dashboard
                  </a>
                )}
              </div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
              <div className="text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">
                Avg / piece
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-neutral-900">
                {tm.avg_usd != null ? `$${tm.avg_usd.toFixed(2)}` : "—"}
              </div>
              <div className="text-[10.5px] text-neutral-400">postage + render</div>
            </div>
          </div>

          {data.recent.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Recent letters
              </h3>
              <ul className="space-y-1">
                {data.recent.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-baseline gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-neutral-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-neutral-800">
                      {r.to_name || <em className="text-neutral-400">no name</em>}
                      {r.to_city && (
                        <span className="ml-1.5 text-neutral-500">
                          · {r.to_city}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-neutral-900">
                      ${r.price_usd.toFixed(2)}
                    </span>
                    <span className="shrink-0 text-[10.5px] text-neutral-400">
                      {relativeFromIso(r.date_created)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function AnthropicSection({ data }: { data: SpendPayload["anthropic"] }) {
  const u = data.usage;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm md:col-span-2">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Anthropic (Claude Code usage)
        </h2>
        <a
          href={data.settings_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
        >
          Settings · check Max limits <ExternalLink size={10} />
        </a>
      </header>

      {!u ? (
        <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          No local session logs found.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <UsageStat label="Last 5h" bucket={u.last_5h} />
            <UsageStat label="Last 24h" bucket={u.last_24h} />
            <UsageStat label="This week" bucket={u.this_week} />
            <UsageStat label="This month" bucket={u.this_month} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Last 14 days (output tokens)
              </h3>
              <DayBars days={u.by_day} />
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Top projects this month
              </h3>
              <ul className="space-y-1.5 text-xs">
                {u.top_projects.map((p) => (
                  <li
                    key={p.project}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span
                      className="min-w-0 truncate font-mono text-[11px] text-neutral-600"
                      title={p.project}
                    >
                      {p.project.split("/").slice(-3).join("/")}
                    </span>
                    <span className="shrink-0">
                      <span className="font-mono tabular-nums text-neutral-900">
                        {fmtTokens(p.output)}
                      </span>
                      <span className="ml-1 text-[10.5px] text-neutral-400">
                        out · {p.messages} msgs
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-4 border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
            <Info size={11} className="-mt-0.5 mr-1 inline" />
            Output tokens are the dimension the Max plan rate-limits on. Computed from{" "}
            {u.files_scanned} local session files in <code className="font-mono">~/.claude/projects</code>. Plan ceilings aren't in the
            API — open Settings to check headroom.
          </p>
        </>
      )}
    </section>
  );
}

function UsageStat({
  label,
  bucket,
}: {
  label: string;
  bucket: { output: number; input: number; cache_create: number; cache_read: number; messages: number };
}) {
  const totalIn = bucket.input + bucket.cache_create + bucket.cache_read;
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-neutral-900">
        {fmtTokens(bucket.output)}
      </div>
      <div className="text-[10.5px] text-neutral-400">output</div>
      <div className="mt-1.5 flex items-baseline justify-between text-[10.5px] text-neutral-500">
        <span>{bucket.messages} msgs</span>
        <span title={`${totalIn.toLocaleString()} input + cache tokens`}>
          {fmtTokens(totalIn)} in
        </span>
      </div>
    </div>
  );
}

function DayBars({
  days,
}: {
  days: { day: string; output: number; messages: number }[];
}) {
  const max = Math.max(1, ...days.map((d) => d.output));
  const reversed = [...days].reverse(); // oldest left → newest right
  return (
    <div className="flex h-24 items-end gap-0.5">
      {reversed.map((d) => {
        const h = (d.output / max) * 100;
        return (
          <div
            key={d.day}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${d.day} · ${d.output.toLocaleString()} output · ${d.messages} msgs`}
          >
            <div
              className="w-full rounded-sm bg-indigo-300 transition-colors group-hover:bg-indigo-500"
              style={{ height: `${Math.max(2, h)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
