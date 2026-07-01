import { Router } from "express";
import { fetchCampaigns, getSequenceDetail, type ReplyCampaign } from "../lib/reply.js";

export const sequencesRouter = Router();

const STATUS_LABELS: Record<number, string> = {
  0: "Draft",
  1: "Active",
  2: "Paused",
  3: "Stopped",
  4: "Completed",
};

// Strip the TEST_ prefix and trailing -YYYY-MM-DD if any; lowercase + slugify.
function inferNicheSlug(name: string): string | undefined {
  if (!name) return undefined;
  let s = name.trim();
  s = s.replace(/^TEST[_-]/i, "");
  s = s.replace(/[-_]\d{4}-\d{2}-\d{2}.*$/, "");
  s = s.replace(/\s+/g, "-").toLowerCase();
  s = s.replace(/[^a-z0-9-]+/g, "");
  s = s.replace(/^-+|-+$/g, "");
  return s || undefined;
}

export type Sequence = {
  id: number;
  name: string;
  is_test: boolean;
  niche_slug?: string;
  created: string;
  status: number;
  status_label: string;
  email_account?: string;
  contacts: {
    total: number;
    active: number;
    paused: number;
    finished: number;
  };
  deliveries: number;
  opens: number;
  replies: number;
  bounces: number;
  out_of_office: number;
  opt_outs: number;
  open_rate: number | null;
  reply_rate: number | null;
};

function normalize(c: ReplyCampaign): Sequence {
  const deliveries = c.deliveriesCount ?? 0;
  return {
    id: c.id,
    name: c.name,
    is_test: /^TEST[_-]/i.test(c.name ?? ""),
    niche_slug: inferNicheSlug(c.name),
    created: c.created,
    status: c.status,
    status_label: STATUS_LABELS[c.status] ?? `status_${c.status}`,
    email_account: c.emailAccount,
    contacts: {
      total: c.peopleCount ?? 0,
      active: c.peopleActive ?? 0,
      paused: c.peoplePaused ?? 0,
      finished: c.peopleFinished ?? 0,
    },
    deliveries,
    opens: c.opensCount ?? 0,
    replies: c.repliesCount ?? 0,
    bounces: c.bouncesCount ?? 0,
    out_of_office: c.outOfOfficeCount ?? 0,
    opt_outs: c.optOutsCount ?? 0,
    open_rate: deliveries > 0 ? (c.opensCount ?? 0) / deliveries : null,
    reply_rate: deliveries > 0 ? (c.repliesCount ?? 0) / deliveries : null,
  };
}

sequencesRouter.get("/", async (_req, res) => {
  try {
    const raw = await fetchCampaigns();
    const sequences = raw
      .map(normalize)
      .sort((a, b) => (a.created < b.created ? 1 : -1));
    res.json({ sequences, fetched_at: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message.includes("reply_io_key_not_found") ? 503 : 500;
    res.status(code).json({ error: "reply_io_failed", message });
  }
});


sequencesRouter.get("/:id/detail", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid_sequence_id" });
    return;
  }
  try {
    const detail = await getSequenceDetail(id);
    if (!detail) {
      res.status(404).json({ error: "sequence_detail_not_found", id });
      return;
    }
    res.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "sequence_detail_failed", message });
  }
});

export type QACheckStatus = "pass" | "fail" | "warn";
export type QACheck = { id: string; label: string; status: QACheckStatus; detail?: string };
export type QAResult = { checks: QACheck[]; passed: number; failed: number; warned: number };

function runQA(campaign: ReplyCampaign, detail: Awaited<ReturnType<typeof getSequenceDetail>>): QAResult {
  const checks: QACheck[] = [];

  const steps = detail?.steps ?? [];
  const contacts = campaign.peopleCount ?? 0;

  checks.push(steps.length > 0
    ? { id: "has_steps", label: "Sequence has steps", status: "pass" }
    : { id: "has_steps", label: "Sequence has steps", status: "fail", detail: "No steps found — sequence is empty." });

  checks.push(contacts > 0
    ? { id: "has_contacts", label: `Contacts loaded (${contacts})`, status: "pass" }
    : { id: "has_contacts", label: "Contacts loaded", status: "fail", detail: "No contacts in this sequence — import them before activating." });

  const hasEmail = steps.some((s) => s.channel === "email");
  checks.push(hasEmail
    ? { id: "has_email_step", label: "Has at least one email step", status: "pass" }
    : { id: "has_email_step", label: "Has at least one email step", status: "fail", detail: "No email steps found." });

  const hasLinkedIn = steps.some((s) => s.channel === "linkedin");
  checks.push(hasLinkedIn
    ? { id: "has_linkedin_step", label: "Has LinkedIn connection step", status: "pass" }
    : { id: "has_linkedin_step", label: "Has LinkedIn connection step", status: "warn", detail: "No LinkedIn step — consider adding one as step 1." });

  const days = steps.map((s) => s.day);
  const uniqueDays = new Set(days);
  checks.push(uniqueDays.size === days.length
    ? { id: "unique_days", label: "No duplicate step days", status: "pass" }
    : { id: "unique_days", label: "No duplicate step days", status: "fail", detail: `Duplicate days found: ${days.filter((d, i) => days.indexOf(d) !== i).join(", ")}` });

  const sorted = [...days].sort((a, b) => a - b);
  const inOrder = days.every((d, i) => d === sorted[i]);
  checks.push(inOrder
    ? { id: "steps_ordered", label: "Steps in ascending day order", status: "pass" }
    : { id: "steps_ordered", label: "Steps in ascending day order", status: "warn", detail: "Steps are not in day order — double-check sequencing." });

  const brokenMerge: string[] = [];
  for (const step of steps) {
    const allBraces = step.body.match(/\{[^}]*\}|\{[^{]*/g) ?? [];
    for (const m of allBraces) {
      if (!m.startsWith("{{") || !m.endsWith("}}")) brokenMerge.push(`Step ${step.step}: "${m}"`);
    }
    if (/\{\{\s*\}\}/.test(step.body)) brokenMerge.push(`Step ${step.step}: empty merge field`);
  }
  checks.push(brokenMerge.length === 0
    ? { id: "merge_fields", label: "No broken merge fields", status: "pass" }
    : { id: "merge_fields", label: "No broken merge fields", status: "fail", detail: brokenMerge.join("; ") });

  checks.push(detail?.sample_contact
    ? { id: "sample_contact", label: "Sample contact present (preview works)", status: "pass" }
    : { id: "sample_contact", label: "Sample contact present", status: "warn", detail: "No sample contact — preview won't render merge fields." });

  const isDraft = campaign.status === 0;
  checks.push(isDraft
    ? { id: "is_draft", label: "Sequence is in Draft (not yet live)", status: "pass" }
    : { id: "is_draft", label: "Sequence is in Draft", status: "warn", detail: `Status is "${STATUS_LABELS[campaign.status] ?? campaign.status}" — QA before activation only.` });

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  return { checks, passed, failed, warned };
}

sequencesRouter.get("/:id/qa", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid_sequence_id" });
    return;
  }
  try {
    const [campaigns, detail] = await Promise.all([fetchCampaigns(), getSequenceDetail(id)]);
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) {
      res.status(404).json({ error: "sequence_not_found", id });
      return;
    }
    res.json(runQA(campaign, detail));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "qa_failed", message });
  }
});
