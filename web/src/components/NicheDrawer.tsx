import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Niche, NicheStatus } from "../lib/types";
import {
  absoluteFromIso,
  extractScores,
  extractTailwind,
  originFor,
  originLabel,
  relativeFromIso,
  statusAddedTimestamp,
  stripTailwind,
} from "../lib/format";
import { Sparkles, User } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { ScoreBreakdown } from "./ui/ScoreBreakdown";
import { BuyBox } from "./BuyBox";
import { confirmDialog } from "./ui/Dialog";

type Action =
  | { kind: "set-status"; status: NicheStatus; reason?: string }
  | { kind: "run-cycle-now" }
  | { kind: "investigate" };

export function NicheDrawer({
  niche,
  onClose,
  onAction,
}: {
  niche: Niche | null;
  onClose: () => void;
  onAction: (n: Niche, action: Action) => Promise<void>;
}) {
  const open = niche !== null;
  const [pending, setPending] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!open) {
      setPending(null);
      setRejectMode(false);
      setRejectReason("");
    }
  }, [open, niche?.id]);

  if (!niche) return null;

  const slug = niche.slug ?? niche.id;
  const scores = extractScores(niche);
  const tailwind = extractTailwind(niche.notes);
  const notesBody = stripTailwind(niche.notes);

  const fire = async (kind: string, action: Action) => {
    setPending(kind);
    try {
      await onAction(niche, action);
    } finally {
      setPending(null);
    }
  };

  const submitReject = async () => {
    const reason = rejectReason.trim();
    if (!reason) return;
    await fire("reject", { kind: "set-status", status: "rejected", reason });
    setRejectMode(false);
  };

  const confirmPause = async () => {
    const ok = await confirmDialog({
      title: `Pause "${niche.name}"?`,
      description: "It will skip the queue until you resume it.",
      confirmLabel: "Pause",
    });
    if (!ok) return;
    await fire("pause", { kind: "set-status", status: "paused" });
  };

  const confirmRunCycle = async () => {
    const ok = await confirmDialog({
      title: `Run a cycle on "${niche.name}" now?`,
      description:
        "Marks the niche queued and writes a trigger file. Run /run-cycle in your Claude session to start it.",
      confirmLabel: "Queue and trigger",
    });
    if (!ok) return;
    await fire("run-cycle", { kind: "run-cycle-now" });
  };

  const confirmInvestigate = async () => {
    const ok = await confirmDialog({
      title: `Investigate "${niche.name}"?`,
      description:
        "Claude will research this seed niche (no Inven credits used) and write a rich proposed-level entry with thesis, tailwinds, scores, and buy-box. Takes a few minutes; promotes to Proposed when done.",
      confirmLabel: "Investigate",
    });
    if (!ok) return;
    await fire("investigate", { kind: "investigate" });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col border-l border-neutral-200 bg-white shadow-2xl outline-none data-[state=open]:animate-[slideIn_180ms_ease-out]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-semibold">
                {niche.name}
              </Dialog.Title>
              <div className="mt-0.5 font-mono text-[11px] text-neutral-400">{slug}</div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm">
            <section className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{niche.status}</Badge>
              {(() => {
                const origin = originFor(niche.source);
                if (origin === "unknown") {
                  return niche.source ? <Badge>{niche.source}</Badge> : null;
                }
                return (
                  <Badge tone={origin === "user" ? "blue" : "accent"}>
                    {origin === "user" ? (
                      <User size={10} className="mr-1 inline" />
                    ) : (
                      <Sparkles size={10} className="mr-1 inline" />
                    )}
                    {originLabel(origin)}
                  </Badge>
                );
              })()}
              {niche.type && <Badge>{niche.type}</Badge>}
              {niche.business_type && <Badge>{niche.business_type}</Badge>}
            </section>

            {notesBody && (
              <section>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Notes
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {notesBody}
                </p>
              </section>
            )}

            {tailwind && (
              <section>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                  Tailwinds
                </h3>
                <div className="rounded-md border-l-2 border-indigo-300 bg-indigo-50/60 px-3 py-2 text-sm leading-relaxed text-neutral-800">
                  {tailwind}
                </div>
              </section>
            )}

            {scores && (
              <section>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Fit score (4 + 1)
                </h3>
                <ScoreBreakdown scores={scores} />
              </section>
            )}

            {niche.adjacencies && niche.adjacencies.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Adjacencies
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {niche.adjacencies.map((a) => (
                    <Badge key={a}>{a}</Badge>
                  ))}
                </div>
              </section>
            )}

            <BuyBox niche={niche} />

            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Status timestamps
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <Row label="Added" iso={statusAddedTimestamp(niche)} />
                <Row label="Proposed" iso={niche.proposed_at} />
                <Row label="Approved" iso={niche.approved_at} />
                <Row label="Queued" iso={niche.queued_at} />
                <Row label="In progress" iso={niche.in_progress_at} />
                <Row label="Cycle complete" iso={niche.cycle_complete_at} />
                <Row label="Rejected" iso={niche.rejected_at} />
                <Row label="Paused" iso={niche.paused_at} />
              </dl>
            </section>

            {niche.history && niche.history.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  History
                </h3>
                <ul className="space-y-2">
                  {niche.history.map((h, i) => (
                    <li key={i} className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <Badge tone="neutral">{h.status}</Badge>
                        <span className="text-neutral-400" title={absoluteFromIso(h.at)}>
                          {relativeFromIso(h.at)}
                        </span>
                      </div>
                      {h.reason && (
                        <p className="mt-1 text-xs text-neutral-700">{h.reason}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {niche.sequence_id && (
              <section>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Reply.io sequence
                </h3>
                <a
                  href={`https://run.reply.io/sequences/${niche.sequence_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-accent hover:underline"
                >
                  #{niche.sequence_id} ↗
                </a>
              </section>
            )}
          </div>

          <footer className="border-t border-neutral-200 bg-neutral-50/60 px-5 py-3">
            {rejectMode ? (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-neutral-700">
                  Reason for rejection (required)
                </label>
                <input
                  autoFocus
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitReject();
                    if (e.key === "Escape") setRejectMode(false);
                  }}
                  placeholder="e.g. too cyclical, PE-saturated, owners too young…"
                  className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setRejectMode(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!rejectReason.trim() || pending === "reject"}
                    onClick={submitReject}
                  >
                    {pending === "reject" ? "Rejecting…" : "Reject niche"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {niche.status === "seed" && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!!pending}
                    onClick={confirmInvestigate}
                  >
                    {pending === "investigate" ? "Investigating…" : "Investigate"}
                  </Button>
                )}
                {niche.status !== "seed" && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!!pending}
                    onClick={() => fire("approve", { kind: "set-status", status: "approved" })}
                  >
                    Approve
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!!pending}
                  onClick={() => fire("queue", { kind: "set-status", status: "queued" })}
                >
                  Queue
                </Button>
                <Button
                  size="sm"
                  disabled={!!pending}
                  onClick={confirmRunCycle}
                >
                  Run cycle now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!pending}
                  onClick={confirmPause}
                >
                  Pause
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!!pending}
                  onClick={() => setRejectMode(true)}
                >
                  Reject
                </Button>
              </div>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ label, iso }: { label: string; iso?: string }) {
  if (!iso) return null;
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-700" title={absoluteFromIso(iso)}>
        {relativeFromIso(iso)}
      </dd>
    </>
  );
}
