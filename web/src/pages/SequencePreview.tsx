import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, UserPlus, Mail, FileText } from "lucide-react";
import { api } from "../lib/api";
import type { SequenceDetail, SequenceStep } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";

function cleanName(name: string): string {
  return name.replace(/^TEST[_-]/i, "").replace(/[-_]\d{4}-\d{2}-\d{2}.*$/, "");
}

const CHANNEL_META: Record<
  SequenceStep["channel"],
  { label: string; Icon: typeof Mail; tone: string }
> = {
  linkedin: { label: "LinkedIn", Icon: UserPlus, tone: "text-sky-600" },
  email: { label: "Email", Icon: Mail, tone: "text-indigo-600" },
  letter: { label: "Letter", Icon: FileText, tone: "text-amber-600" },
};

export default function SequencePreview() {
  const { id } = useParams();
  const [detail, setDetail] = useState<SequenceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getSequenceDetail(Number(id))
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  const contact = detail?.sample_contact;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto p-5">
      <Link
        to="/sequences"
        className="inline-flex w-fit items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft size={13} /> Back to sequences
      </Link>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn't load this sequence preview. {error}
        </div>
      )}

      {!detail && !error && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {detail && (
        <>
          <header className="rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-sm">
            <h1 className="text-lg font-semibold text-neutral-900">
              {cleanName(detail.name)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <Badge tone="blue">Sequence #{detail.id}</Badge>
              {detail.niche_slug && (
                <span className="font-mono">{detail.niche_slug}</span>
              )}
              <span>· {detail.steps.length} steps</span>
            </div>
            {contact && (
              <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                Previewed for sample recipient{" "}
                <span className="font-medium text-neutral-800">
                  {contact.first_name} {contact.last_name}
                </span>
                {contact.title ? `, ${contact.title}` : ""}
                {contact.company ? ` at ${contact.company}` : ""}
                {contact.location ? ` (${contact.location})` : ""}. Merge fields
                are filled in as the recipient would see them.
              </p>
            )}
          </header>

          {detail.steps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-5 py-10 text-center text-sm text-neutral-500">
              This sequence is mid-flight — the outreach copy isn't shown in the
              demo. See the HIPAA or Legal sequences for a full preview.
            </div>
          ) : (
            <ol className="space-y-3">
              {detail.steps.map((step) => {
                const meta = CHANNEL_META[step.channel];
                const Icon = meta.Icon;
                return (
                  <li
                    key={step.step}
                    className="rounded-lg border border-neutral-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2">
                      <span className="inline-flex h-6 min-w-[3rem] items-center justify-center rounded bg-neutral-100 px-1.5 font-mono text-[11px] font-medium tabular-nums text-neutral-600">
                        Day {step.day}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.tone}`}>
                        <Icon size={13} /> {meta.label}
                      </span>
                      <span className="ml-auto text-[11px] text-neutral-400">
                        Step {step.step}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      {step.subject && (
                        <p className="mb-1.5 text-sm font-semibold text-neutral-900">
                          {step.subject}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                        {step.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
