import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Check, Clock, Play, RefreshCw, Repeat, X } from "lucide-react";
import { api } from "../lib/api";
import type { ActionRequest, RequestsPayload } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { confirmDialog, promptDialog } from "../components/ui/Dialog";
import { useToast } from "../components/ui/Toaster";
import { useSession } from "../lib/session";
import { absoluteFromIso, relativeFromIso } from "../lib/format";
import { cn } from "../lib/cn";
import type { HomeContext } from "./Home";

const WEEKLY_INVEN_CAP = 500;

const STATUS_TONE: Record<string, "amber" | "green" | "red" | "neutral" | "blue"> = {
  pending: "amber",
  executed: "green",
  approved: "green",
  denied: "red",
  failed: "red",
};

export default function RequestsPage() {
  const ctx = useOutletContext<HomeContext>();
  const { isOwner, refresh: refreshSession } = useSession();
  const { push } = useToast();
  const [data, setData] = useState<RequestsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.getRequests());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    ctx.setSubtitle("Approvals");
    return () => ctx.setSubtitle(undefined);
  }, [ctx]);

  const pending = useMemo(
    () => (data?.requests ?? []).filter((r) => r.status === "pending"),
    [data],
  );
  const history = useMemo(
    () => (data?.requests ?? []).filter((r) => r.status !== "pending"),
    [data],
  );

  const weekly = data?.weekly_inven_export?.export ?? 0;
  const overCap = weekly >= WEEKLY_INVEN_CAP;

  const approve = async (r: ActionRequest) => {
    let msg = `Approve and run: ${r.label}?`;
    if (r.kind !== "run-cycle" && overCap) {
      msg += `\n\nHeads up: this week's Inven export spend is ${weekly}/${WEEKLY_INVEN_CAP} — already at/over the cap.`;
    }
    const ok = await confirmDialog({
      title: "Approve request?",
      description: msg,
      confirmLabel: "Approve & run",
    });
    if (!ok) return;
    setBusy(r.id);
    try {
      const res = await api.approveRequest(r.id);
      if (res.ok) push(res.result.message ?? "Approved and started.", "success");
      else push(`Approve failed: ${res.result.error ?? "unknown"}`, "error");
      await load();
      refreshSession();
    } catch (e) {
      push(`Approve failed: ${String(e)}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const deny = async (r: ActionRequest) => {
    const note = await promptDialog({
      title: "Deny request?",
      description: `Optional reason for denying "${r.label}".`,
      placeholder: "e.g. not this week, pick a different niche…",
      confirmLabel: "Deny",
      destructive: true,
    });
    // promptDialog returns null on cancel; allow empty string? We treat null as cancel.
    if (note === null) return;
    setBusy(r.id);
    try {
      await api.denyRequest(r.id, note || undefined);
      push("Denied.", "success");
      await load();
      refreshSession();
    } catch (e) {
      push(`Deny failed: ${String(e)}`, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
          {isOwner ? "Approval inbox" : "My requests"}
        </h1>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs",
              overCap ? "border-amber-300 bg-amber-50 text-amber-800" : "border-neutral-200 bg-white text-neutral-600",
            )}
            title="Inven export credits spent this week"
          >
            Inven this week:{" "}
            <span className="font-mono font-semibold tabular-nums">
              {weekly}/{WEEKLY_INVEN_CAP}
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Pending {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm text-neutral-400">
            Nothing waiting on you.
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3"
              >
                <RequestIcon kind={r.kind} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-neutral-900">{r.label}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    requested by {r.requested_by} ·{" "}
                    <span title={absoluteFromIso(r.requested_at)}>
                      {relativeFromIso(r.requested_at)}
                    </span>
                    {r.note && ` · "${r.note}"`}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy === r.id}
                      onClick={() => approve(r)}
                    >
                      <Check size={13} /> Approve & run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === r.id}
                      onClick={() => deny(r)}
                    >
                      <X size={13} /> Deny
                    </Button>
                  </div>
                )}
                {!isOwner && <Badge tone="amber">Awaiting Nico</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-h-0 flex-1">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          History
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-neutral-400">No past requests.</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-4 py-2.5"
              >
                <RequestIcon kind={r.kind} muted />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-neutral-800">{r.label}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    {r.requested_by} ·{" "}
                    <span title={absoluteFromIso(r.requested_at)}>
                      {relativeFromIso(r.requested_at)}
                    </span>
                    {r.decided_by && ` · decided by ${r.decided_by}`}
                    {r.result_message && ` · ${r.result_message}`}
                    {r.decision_note && ` · "${r.decision_note}"`}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RequestIcon({ kind, muted }: { kind: string; muted?: boolean }) {
  const c = muted ? "text-neutral-400" : "text-amber-600";
  return (
    <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white", muted ? "border border-neutral-200" : "border border-amber-200")}>
      {kind === "orchestrator" ? <Repeat size={14} className={c} /> : <Play size={14} className={c} />}
    </span>
  );
}

void Clock;
