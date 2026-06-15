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
