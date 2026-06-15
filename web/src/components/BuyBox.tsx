import { useState } from "react";
import { Pencil } from "lucide-react";
import type { BuyBox as BuyBoxData, Niche } from "../lib/types";
import { Button } from "./ui/Button";
import { useSession } from "../lib/session";
import { useToast } from "./ui/Toaster";
import { api } from "../lib/api";

function fmtUsd(n?: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function rangeUsd(min?: number | null, max?: number | null): string | null {
  const lo = fmtUsd(min);
  const hi = fmtUsd(max);
  if (lo && hi) return `${lo}–${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `up to ${hi}`;
  return null;
}

function rangeNum(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `${min}+`;
  if (max != null) return `up to ${max}`;
  return null;
}

type Draft = {
  revenue_min: string;
  revenue_max: string;
  ebitda_min: string;
  ebitda_max: string;
  headcount_min: string;
  headcount_max: string;
  geography: string;
  ownership: string;
  business_type: string;
  notes: string;
};

const toM = (n?: number | null) => (n == null ? "" : String(n / 1_000_000));
const toCount = (n?: number | null) => (n == null ? "" : String(n));

function seed(bb?: BuyBoxData): Draft {
  return {
    revenue_min: toM(bb?.revenue_min),
    revenue_max: toM(bb?.revenue_max),
    ebitda_min: toM(bb?.ebitda_min),
    ebitda_max: toM(bb?.ebitda_max),
    headcount_min: toCount(bb?.headcount_min),
    headcount_max: toCount(bb?.headcount_max),
    geography: bb?.geography ?? "",
    ownership: bb?.ownership ?? "",
    business_type: bb?.business_type ?? "",
    notes: bb?.notes ?? "",
  };
}

export function BuyBox({
  niche,
  onSaved,
}: {
  niche: Niche;
  onSaved?: (n: Niche) => void;
}) {
  const { me } = useSession();
  const { push } = useToast();
  const canEdit = !!me && me.role !== "viewer";
  const [bb, setBb] = useState<BuyBoxData | undefined>(niche.buy_box);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => seed(niche.buy_box));
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(seed(bb));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const numM = (v: string) => (v.trim() === "" ? null : Number(v) * 1_000_000);
    const numC = (v: string) => (v.trim() === "" ? null : Number(v));
    try {
      const res = await api.updateBuyBox(niche.id, {
        revenue_min: numM(draft.revenue_min),
        revenue_max: numM(draft.revenue_max),
        ebitda_min: numM(draft.ebitda_min),
        ebitda_max: numM(draft.ebitda_max),
        headcount_min: numC(draft.headcount_min),
        headcount_max: numC(draft.headcount_max),
        geography: draft.geography.trim() || null,
        ownership: draft.ownership.trim() || null,
        business_type: draft.business_type.trim() || null,
        notes: draft.notes.trim() || null,
      });
      setBb(res.niche.buy_box);
      setEditing(false);
      push("Buy box updated", "success");
      onSaved?.(res.niche);
    } catch (e) {
      push(`Save failed: ${String(e)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const rows: [string, string | null][] = [
    ["Revenue", rangeUsd(bb?.revenue_min, bb?.revenue_max)],
    ["EBITDA", rangeUsd(bb?.ebitda_min, bb?.ebitda_max)],
    ["Headcount", rangeNum(bb?.headcount_min, bb?.headcount_max)],
    ["Geography", bb?.geography ?? null],
    ["Ownership", bb?.ownership ?? null],
    ["Business type", bb?.business_type ?? null],
  ];
  const hasAny = rows.some(([, v]) => v) || bb?.notes;

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Buy box
        </h3>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          >
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        !hasAny ? (
          <p className="text-xs text-neutral-400">No buy box yet.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {rows.map(([label, value]) =>
              value ? (
                <div key={label} className="contents">
                  <dt className="text-neutral-500">{label}</dt>
                  <dd className="font-mono tabular-nums text-neutral-800">{value}</dd>
                </div>
              ) : null,
            )}
            {bb?.notes && (
              <div className="col-span-2 mt-1">
                <dt className="text-neutral-500">Notes</dt>
                <dd className="text-neutral-700">{bb.notes}</dd>
              </div>
            )}
          </dl>
        )
      ) : (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50/60 p-2.5">
          <PairRow label="Revenue ($M)" a={draft.revenue_min} b={draft.revenue_max}
            onA={(v) => setDraft({ ...draft, revenue_min: v })}
            onB={(v) => setDraft({ ...draft, revenue_max: v })} />
          <PairRow label="EBITDA ($M)" a={draft.ebitda_min} b={draft.ebitda_max}
            onA={(v) => setDraft({ ...draft, ebitda_min: v })}
            onB={(v) => setDraft({ ...draft, ebitda_max: v })} />
          <PairRow label="Headcount" a={draft.headcount_min} b={draft.headcount_max} step="1"
            onA={(v) => setDraft({ ...draft, headcount_min: v })}
            onB={(v) => setDraft({ ...draft, headcount_max: v })} />
          <TextRow label="Geography" value={draft.geography} onChange={(v) => setDraft({ ...draft, geography: v })} />
          <TextRow label="Ownership" value={draft.ownership} onChange={(v) => setDraft({ ...draft, ownership: v })} />
          <TextRow label="Business type" value={draft.business_type} onChange={(v) => setDraft({ ...draft, business_type: v })} />
          <div>
            <label className="mb-0.5 block text-[11px] text-neutral-500">Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-0.5">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function PairRow({
  label, a, b, onA, onB, step = "0.5",
}: {
  label: string; a: string; b: string;
  onA: (v: string) => void; onB: (v: string) => void; step?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 text-[11px] text-neutral-500">{label}</label>
      <input type="number" min="0" step={step} value={a} onChange={(e) => onA(e.target.value)}
        placeholder="min"
        className="w-full rounded border border-neutral-300 px-2 py-1 text-xs tabular-nums" />
      <span className="text-neutral-400">–</span>
      <input type="number" min="0" step={step} value={b} onChange={(e) => onB(e.target.value)}
        placeholder="max"
        className="w-full rounded border border-neutral-300 px-2 py-1 text-xs tabular-nums" />
    </div>
  );
}

function TextRow({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 text-[11px] text-neutral-500">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
    </div>
  );
}
