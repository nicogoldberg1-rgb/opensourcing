import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { SequenceLink } from "../components/SequenceLink";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Circle,
  ExternalLink,
  Loader2,
  Pause,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type {
  CycleActivity,
  CycleDetail,
  CyclePhase,
  CycleSummary,
} from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  absoluteFromIso,
  relativeFromIso,
} from "../lib/format";
import { cn } from "../lib/cn";
import type { HomeContext } from "./Home";

export default function CyclePage() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const ctx = useOutletContext<HomeContext>();
  const [cycles, setCycles] = useState<CycleSummary[]>([]);
  const [detail, setDetail] = useState<CycleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const targetId = idParam ?? cycles[0]?.id;

  useEffect(() => {
    let cancelled = false;
    api
      .getCycles()
      .then((d) => {
        if (cancelled) return;
        setCycles(d.cycles);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async (id: string) => {
    setLoading(true);
    try {
      const d = await api.getCycle(id);
      setDetail(d);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!targetId) return;
    refresh(targetId);
    const interval = detail?.is_active ? 3_000 : 30_000;
    const t = setInterval(() => refresh(targetId), interval);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, detail?.is_active]);

  useEffect(() => {
    ctx.setSubtitle(
      detail
        ? `${detail.niche_slug} · ${detail.date}`
        : cycles.length
          ? `${cycles.length} cycles`
          : undefined,
    );
    return () => ctx.setSubtitle(undefined);
  }, [detail, cycles, ctx]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/cycle"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <ArrowLeft size={13} />
          All cycles
        </Link>
        <CycleSwitcher
          cycles={cycles}
          activeId={targetId}
          onChange={(id) => navigate(`/cycle/${id}`)}
        />
        <div className="ml-auto flex items-center gap-2">
          {detail && (
            <span className="text-[11px] text-neutral-400" title={absoluteFromIso(detail.modified_at)}>
              Updated {relativeFromIso(detail.modified_at)}
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => targetId && refresh(targetId)}
            disabled={loading || !targetId}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!detail ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm text-neutral-500 shadow-sm">
          {cycles.length === 0 ? "No cycles found." : "Loading…"}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <CycleHeader detail={detail} />
            <PhaseTimeline phases={detail.phases} />
            {detail.summary_md && <SummaryCard md={detail.summary_md} />}
          </main>
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {detail.g4_pending && (
              <G4PendingCard data={detail.g4_pending} />
            )}
            <CreditsCard detail={detail} />
            {detail.state.resume_action && (
              <ResumeCard text={detail.state.resume_action} />
            )}
            <ActivityCard events={detail.activity} />
          </aside>
        </div>
      )}
    </div>
  );
}

function CycleSwitcher({
  cycles,
  activeId,
  onChange,
}: {
  cycles: CycleSummary[];
  activeId?: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={activeId ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 min-w-[300px] rounded-md border border-neutral-200 bg-white px-2 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    >
      {cycles.length === 0 && <option value="">No cycles</option>}
      {cycles.map((c) => (
        <option key={c.id} value={c.id}>
          {c.niche_slug} · {c.date} {c.is_active ? "· LIVE" : ""}
        </option>
      ))}
    </select>
  );
}

function CycleHeader({ detail }: { detail: CycleDetail }) {
  const s = detail.state;
  const phaseStr = s.phase ?? "";
  const isHalted = /halt/i.test(phaseStr) || s.status === "halted";
  const isComplete = /complete/i.test(phaseStr);
  const statusTone = detail.is_active
    ? "blue"
    : isHalted
      ? "amber"
      : isComplete
        ? "green"
        : "neutral";
  const statusLabel = detail.is_active
    ? "Active"
    : isHalted
      ? "Halted"
      : isComplete
        ? "Complete"
        : "Idle";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-neutral-900">
              {s.name ?? detail.niche_slug}
            </h2>
            <Badge tone={statusTone}>{statusLabel}</Badge>
            {s.mode && <Badge>{`Mode ${s.mode}`}</Badge>}
            {s.conviction && <Badge tone="accent">{s.conviction}</Badge>}
            {detail.is_active && (
              <span className="inline-flex items-center gap-1 text-[11px] text-blue-700">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                live
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-neutral-400">
            {detail.id}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs md:grid-cols-4">
        {s.started_at && (
          <Pair label="Started" value={relativeFromIso(s.started_at)} title={absoluteFromIso(s.started_at)} />
        )}
        {s.halted_at && (
          <Pair label="Halted" value={relativeFromIso(s.halted_at)} title={absoluteFromIso(s.halted_at)} />
        )}
        {s.phase && (
          <Pair label="Phase" value={s.phase} mono />
        )}
        {s.status && <Pair label="Status" value={s.status} mono />}
        {s.halt_reason && (
          <Pair label="Halt reason" value={s.halt_reason} mono full />
        )}
      </dl>
    </div>
  );
}

function Pair({
  label,
  value,
  mono,
  full,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
  title?: string;
}) {
  return (
    <div className={cn("flex flex-col", full && "col-span-2 md:col-span-4")}>
      <dt className="text-[10.5px] uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd
        className={cn(
          "text-neutral-800",
          mono && "font-mono text-[11px]",
        )}
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}

function PhaseTimeline({ phases }: { phases: CyclePhase[] }) {
  return (
    <div data-tour="cycle-phases" className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-neutral-900">Pipeline</h3>
      <ol className="relative space-y-1">
        {phases.map((p, i) => (
          <PhaseRow key={p.num} phase={p} isLast={i === phases.length - 1} />
        ))}
      </ol>
    </div>
  );
}

const STATE_STYLES: Record<
  CyclePhase["state"],
  {
    iconBg: string;
    iconRing: string;
    text: string;
    icon: React.ReactNode;
    pulse: boolean;
  }
> = {
  pending: {
    iconBg: "bg-white",
    iconRing: "ring-neutral-200",
    text: "text-neutral-400",
    icon: <Circle size={12} className="text-neutral-300" />,
    pulse: false,
  },
  active: {
    iconBg: "bg-indigo-50",
    iconRing: "ring-indigo-300",
    text: "text-indigo-700",
    icon: <Loader2 size={12} className="animate-spin text-indigo-600" />,
    pulse: true,
  },
  complete: {
    iconBg: "bg-emerald-50",
    iconRing: "ring-emerald-200",
    text: "text-neutral-700",
    icon: <Check size={12} className="text-emerald-600" />,
    pulse: false,
  },
  halted: {
    iconBg: "bg-amber-50",
    iconRing: "ring-amber-300",
    text: "text-amber-800",
    icon: <Pause size={12} className="text-amber-600" />,
    pulse: false,
  },
};

function PhaseRow({ phase, isLast }: { phase: CyclePhase; isLast: boolean }) {
  const styles = STATE_STYLES[phase.state];
  return (
    <li className="relative flex gap-3 py-2">
      <div className="relative flex w-6 shrink-0 justify-center">
        <span
          className={cn(
            "z-10 inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 transition-all",
            styles.iconBg,
            styles.iconRing,
            styles.pulse && "ring-2 shadow-[0_0_0_4px_rgba(99,102,241,0.1)]",
          )}
        >
          {styles.icon}
        </span>
        {!isLast && (
          <span
            className={cn(
              "absolute left-1/2 top-6 h-[calc(100%+0.5rem)] w-px -translate-x-1/2",
              phase.state === "complete" ? "bg-emerald-200" : "bg-neutral-200",
            )}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10.5px] text-neutral-400">{phase.num}</span>
          <span className={cn("text-sm font-medium", styles.text)}>
            {phase.name}
          </span>
          {phase.state === "active" && (
            <Badge tone="blue">running</Badge>
          )}
          {phase.state === "halted" && (
            <Badge tone="amber">halted</Badge>
          )}
        </div>
        {phase.metric && (
          <div className="mt-0.5 text-[12px] text-neutral-600">
            {phase.metric}
          </div>
        )}
      </div>
    </li>
  );
}

function CreditsCard({ detail }: { detail: CycleDetail }) {
  const cs = detail.state.credits_spent ?? {};
  const fromSpend = detail.credit_spend as
    | {
        total_spent_so_far?: {
          export?: number;
          contact?: number;
          ai?: number;
          verifalia_emails?: number;
        };
      }
    | null;
  const totals = fromSpend?.total_spent_so_far ?? {};

  const exp = totals.export ?? cs.export ?? 0;
  const contact = totals.contact ?? cs.contact ?? 0;
  const ai = totals.ai ?? cs.ai ?? 0;
  const verifalia = totals.verifalia_emails ?? null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">Spend</h3>
      <dl className="space-y-1.5 text-xs">
        <SpendRow label="Inven export" value={exp} cap={200} />
        <SpendRow label="Inven contact" value={contact} cap={50} />
        <SpendRow label="Inven AI" value={ai} />
        {verifalia !== null && <SpendRow label="Verifalia emails" value={verifalia} />}
      </dl>
      <p className="mt-3 text-[11px] text-neutral-400">
        Anthropic Max usage isn't exposed via API —{" "}
        <a
          className="text-accent hover:underline"
          href="https://claude.ai/settings/usage"
          target="_blank"
          rel="noreferrer"
        >
          check manually
        </a>
        .
      </p>
    </div>
  );
}

function SpendRow({
  label,
  value,
  cap,
}: {
  label: string;
  value: number;
  cap?: number;
}) {
  const pct = cap ? Math.min(100, (value / cap) * 100) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <dt className="text-neutral-500">{label}</dt>
        <dd className="font-mono tabular-nums text-neutral-800">
          {value}
          {cap !== undefined && (
            <span className="text-neutral-400"> / {cap}</span>
          )}
        </dd>
      </div>
      {pct !== null && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-indigo-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function G4PendingCard({ data }: { data: Record<string, unknown> }) {
  const seqId = data.sequence_id as number | undefined;
  const seqName = data.sequence_name as string | undefined;
  const status = data.sequence_status as string | undefined;
  const count = data.contact_count as number | undefined;
  const steps = data.steps as string | undefined;
  const tier = data.tier as string | undefined;
  const conviction = data.conviction as string | undefined;

  return (
    <div className="rounded-lg border-l-4 border-amber-300 bg-amber-50/60 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-900">
          Awaiting your activation in Reply.io
        </h3>
      </div>
      <p className="mt-1.5 text-xs text-amber-900/80">
        Sequence built but not started. Activation is always your manual click.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {seqName && (
          <>
            <dt className="text-amber-800/70">Name</dt>
            <dd className="truncate text-amber-900" title={seqName}>{seqName}</dd>
          </>
        )}
        {status && (
          <>
            <dt className="text-amber-800/70">Status</dt>
            <dd className="font-mono text-amber-900">{status}</dd>
          </>
        )}
        {count !== undefined && (
          <>
            <dt className="text-amber-800/70">Contacts</dt>
            <dd className="font-mono text-amber-900">{count}</dd>
          </>
        )}
        {tier && (
          <>
            <dt className="text-amber-800/70">Tier</dt>
            <dd className="font-mono text-amber-900">{tier} ({conviction})</dd>
          </>
        )}
        {steps && (
          <>
            <dt className="text-amber-800/70">Steps</dt>
            <dd className="col-span-1 text-amber-900">{steps}</dd>
          </>
        )}
      </dl>
      {seqId && (
        <SequenceLink
          id={seqId}
          data-tour="view-sequence"
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200"
        >
          View the built sequence <ExternalLink size={11} />
        </SequenceLink>
      )}
    </div>
  );
}

function ResumeCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-neutral-900">
        Resume action
      </h3>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">
        {text}
      </p>
    </div>
  );
}

function ActivityCard({ events }: { events: CycleActivity[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-400 shadow-sm">
        No activity logged.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">Activity</h3>
      <ul className="space-y-2">
        {events.map((e, i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span
              className={cn(
                "mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                e.kind === "approval" && "bg-emerald-400",
                e.kind === "halt" && "bg-amber-500",
                e.kind === "subskill" && "bg-indigo-400",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-neutral-800">{e.text}</div>
              {e.at && (
                <div
                  className="text-[10.5px] text-neutral-400"
                  title={absoluteFromIso(e.at)}
                >
                  {relativeFromIso(e.at)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryCard({ md }: { md: string }) {
  return (
    <details className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
        Cycle summary
      </summary>
      <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-700">
        {md}
      </pre>
    </details>
  );
}
