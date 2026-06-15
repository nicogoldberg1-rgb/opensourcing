import type {
  ActionRequest,
  BuyBox,
  Niche,
  CycleDetail,
  CycleSummary,
  NicheStatus,
  OrchestratorLastRun,
  Me,
  Priorities,
  RequestsPayload,
  RoadmapBoard,
  RoadmapCard,
  RoadmapColumn,
  SequencesPayload,
  SpendPayload,
  Tracker,
} from "./types";

// Dev-only role preview: ?role=operator in the URL flips the whole UI to that
// role (persisted for the tab). In production, Cloudflare Access sets the real
// role server-side and this header is ignored when an authenticated email exists.
function roleOverride(): string | null {
  try {
    const url = new URLSearchParams(window.location.search).get("role");
    if (url) sessionStorage.setItem("nsp-role", url);
    return sessionStorage.getItem("nsp-role");
  } catch {
    return null;
  }
}

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const role = roleOverride();
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(role ? { "x-nsp-role": role } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text();
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getTracker: () => jsonFetch<Tracker>("/api/niches"),
  getLastRun: () => jsonFetch<OrchestratorLastRun>("/api/orchestrator/last-run"),
  triggerOrchestrator: () =>
    jsonFetch<{ ok: true; pid: number; message: string }>(
      "/api/orchestrator/trigger",
      { method: "POST" },
    ),
  setStatus: (slug: string, status: NicheStatus, reason?: string) =>
    jsonFetch<{ ok: true; niche: unknown }>(
      `/api/niches/${encodeURIComponent(slug)}/status`,
      { method: "POST", body: JSON.stringify({ status, reason }) },
    ),
  runCycleNow: (slug: string) =>
    jsonFetch<{ ok: true; message: string; trigger_file: string }>(
      `/api/niches/${encodeURIComponent(slug)}/run-cycle-now`,
      { method: "POST" },
    ),
  investigateSeed: (slug: string) =>
    jsonFetch<{ ok: true; message: string }>(
      `/api/niches/${encodeURIComponent(slug)}/investigate`,
      { method: "POST" },
    ),
  addSeed: (name: string, notes?: string) =>
    jsonFetch<{ ok: true; slug: string; niche: unknown }>("/api/niches", {
      method: "POST",
      body: JSON.stringify({ name, notes }),
    }),
  getSequences: () => jsonFetch<SequencesPayload>("/api/sequences"),
  getCycles: () => jsonFetch<{ cycles: CycleSummary[] }>("/api/cycles"),
  getCycle: (id: string) =>
    jsonFetch<CycleDetail>(`/api/cycles/${encodeURIComponent(id)}`),
  getSpend: () => jsonFetch<SpendPayload>("/api/spend"),
  getPriorities: () => jsonFetch<Priorities>("/api/priorities"),
  setLaneOrder: (lane: "approved" | "queued", order: string[]) =>
    jsonFetch<Priorities>(`/api/priorities/${lane}`, {
      method: "PUT",
      body: JSON.stringify({ order }),
    }),
  getRoadmap: () => jsonFetch<RoadmapBoard>("/api/roadmap"),
  saveRoadmap: (cards: RoadmapCard[]) =>
    jsonFetch<RoadmapBoard>("/api/roadmap", {
      method: "PUT",
      body: JSON.stringify({ cards }),
    }),
  addRoadmapCard: (column: RoadmapColumn, title: string, description?: string) =>
    jsonFetch<{ card: RoadmapCard }>("/api/roadmap/cards", {
      method: "POST",
      body: JSON.stringify({ column, title, description }),
    }),
  updateRoadmapCard: (
    id: string,
    patch: Partial<Pick<RoadmapCard, "title" | "description" | "tags" | "column">>,
  ) =>
    jsonFetch<{ card: RoadmapCard }>(`/api/roadmap/cards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteRoadmapCard: (id: string) =>
    jsonFetch<{ ok: true }>(`/api/roadmap/cards/${id}`, { method: "DELETE" }),
  bulkSetStatus: (slugs: string[], status: NicheStatus, reason?: string) =>
    jsonFetch<{
      results: { slug: string; ok: boolean; error?: string }[];
    }>("/api/niches/bulk/status", {
      method: "POST",
      body: JSON.stringify({ slugs, status, reason }),
    }),
  bulkInvestigate: (slugs: string[]) =>
    jsonFetch<{ ok: true; count: number; message: string }>(
      "/api/niches/bulk/investigate",
      { method: "POST", body: JSON.stringify({ slugs }) },
    ),
  updateBuyBox: (slug: string, buyBox: Partial<BuyBox>) =>
    jsonFetch<{ ok: true; niche: Niche }>(
      `/api/niches/${encodeURIComponent(slug)}/buy-box`,
      { method: "PATCH", body: JSON.stringify(buyBox) },
    ),
  getMe: () => jsonFetch<Me>("/api/me"),
  getRequests: () => jsonFetch<RequestsPayload>("/api/requests"),
  approveRequest: (id: string) =>
    jsonFetch<{ ok: boolean; request: ActionRequest; result: { message?: string; error?: string } }>(
      `/api/requests/${id}/approve`,
      { method: "POST" },
    ),
  denyRequest: (id: string, note?: string) =>
    jsonFetch<{ ok: true; request: ActionRequest }>(`/api/requests/${id}/deny`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
};
