import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { Router } from "express";
import { AUTOPILOT_REPO, DEMO_INVESTIGATE_JSON, NSP_STATE_DIR } from "../paths.js";
import { addProposed, applyInvestigation, isValidStatus, loadTracker, setBuyBox, setStatus, type Investigation } from "../lib/state-cli.js";
import { executeRunCycle } from "../lib/executors.js";
import { resolveIdentity } from "../lib/roles.js";
import { createRequest } from "../lib/requests.js";
import { FIXTURE_MODE } from "../config.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const nichesRouter = Router();
// Demo investigate: pre-authored research for known seeds (e.g. pest-control),
// generic but believable development for anything a visitor invents.
async function loadReveal(slug: string, name: string): Promise<Investigation> {
  try {
    const raw = await fs.readFile(DEMO_INVESTIGATE_JSON, "utf8");
    const map = JSON.parse(raw) as Record<string, Investigation>;
    if (map[slug]) return map[slug];
  } catch {
    // fall through to generic
  }
  return {
    notes: `${name} looks like a promising search-fund target: a fragmented market of owner-operated businesses with recurring revenue, aging founders, and little consolidation. The opportunity is to acquire one strong operator, keep what customers love, and add the systems and software it never had. Tailwinds: fragmentation, demographic succession gaps, and steady underlying demand.`,
    scores: { growth: 3, size: 4, criticality: 4, penetration: 4, quality: 3 },
    buy_box: {
      revenue_min: 1000000, revenue_max: 10000000,
      ebitda_min: 300000, ebitda_max: 2500000,
      headcount_min: 10, headcount_max: 80,
      geography: "US", ownership: "Founder / owner-operated",
      notes: "Recurring revenue; fragmented market",
    },
  };
}



nichesRouter.get("/", async (_req, res) => {
  try {
    res.json(await loadTracker());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "failed_to_read_tracker", message });
  }
});

nichesRouter.post("/", async (req, res) => {
  const { name, notes } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name_required" });
    return;
  }
  const cleanName = name.trim();
  const baseSlug = slugify(cleanName);
  if (!baseSlug) {
    res.status(400).json({ error: "name_unslugifiable", name: cleanName });
    return;
  }

  // Ensure unique slug
  try {
    const tracker = (await loadTracker()) as unknown as {
      industries: { id?: string; slug?: string }[];
    };
    const existing = new Set(
      tracker.industries.map((n) => n.id ?? n.slug).filter(Boolean),
    );
    let slug = baseSlug;
    let suffix = 2;
    while (existing.has(slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const cleanNotes = typeof notes === "string" ? notes.trim() : "";
    // state.py's add-proposed always sets status=proposed; flip to seed after.
    await addProposed(slug, cleanName, cleanNotes, "dashboard-manual");
    const niche = await setStatus(slug, "seed", "added as seed via dashboard");
    res.json({ ok: true, niche, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "add_seed_failed", message });
  }
});


nichesRouter.post("/bulk/status", async (req, res) => {
  const { slugs, status, reason } = req.body ?? {};
  if (!Array.isArray(slugs) || slugs.length === 0 || !slugs.every((s) => typeof s === "string")) {
    res.status(400).json({ error: "slugs_required" });
    return;
  }
  if (typeof status !== "string" || !isValidStatus(status)) {
    res.status(400).json({ error: "invalid_status", status });
    return;
  }
  if (status === "rejected" && (!reason || typeof reason !== "string" || !reason.trim())) {
    res.status(400).json({ error: "reason_required_for_rejection" });
    return;
  }
  const results: { slug: string; ok: boolean; error?: string }[] = [];
  for (const slug of slugs) {
    try {
      await setStatus(slug, status, reason);
      results.push({ slug, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ slug, ok: false, error: message });
    }
  }
  res.json({ results });
});

nichesRouter.post("/bulk/investigate", async (req, res) => {
  const { slugs } = req.body ?? {};
  if (!Array.isArray(slugs) || slugs.length === 0 || !slugs.every((s) => typeof s === "string")) {
    res.status(400).json({ error: "slugs_required" });
    return;
  }
  try {
    const tracker = (await loadTracker()) as unknown as {
      industries: { id: string; slug?: string; name: string; notes?: string; status: string }[];
    };
    const targets = slugs.map((slug) => {
      const n = tracker.industries.find((x) => x.id === slug || x.slug === slug);
      if (!n) throw new Error(`niche_not_found: ${slug}`);
      if (n.status !== "seed") throw new Error(`not_a_seed: ${slug} is ${n.status}`);
      return n;
    });
    if (FIXTURE_MODE) {
      for (const n of targets) {
        await applyInvestigation(n.id, await loadReveal(n.id, n.name));
      }
      res.json({ ok: true, count: targets.length, message: `Investigated ${targets.length} seeds → developed proposals (demo simulation).` });
      return;
    }

    const claudeBin =
      process.env.CLAUDE_BIN ?? path.join(os.homedir(), ".local/bin/claude");
    try {
      await fs.access(claudeBin);
    } catch {
      res.status(500).json({ error: "claude_bin_not_found", path: claudeBin });
      return;
    }
    const items = targets
      .map(
        (n, i) =>
          `${i + 1}. slug: ${n.id}  name: "${n.name}"  current notes: ${n.notes ?? "(none)"}`,
      )
      .join("\n");
    const prompt = [
      `Use the /industry-ideation skill in drill-down mode to develop ${targets.length} seed niches into proper proposed-level entries.`,
      ``,
      `Process them ONE AT A TIME, sequentially. Do not parallelize tracker writes.`,
      ``,
      `Seeds to investigate:`,
      items,
      ``,
      `For each one, in order:`,
      `1. Research the niche (web search, knowledge) — fragmentation, tailwinds, adjacencies, owner profile, search-fund fit.`,
      `2. Generate: thesis, 4+1 scores (G/S/C/P/Q), tailwinds line, adjacencies, Inven-ready description, full buy_box block.`,
      `3. Update the tracker entry at ~/Library/Application Support/nsp-autopilot/industry-tracker.json directly: set notes to the developed content, add the buy_box.`,
      `4. Run: python3 ${path.join(AUTOPILOT_REPO, "lib/state.py")} set-status <slug> proposed --reason "investigated from seed via dashboard (bulk)"`,
      `5. Move on to the next seed only after the current one is fully written and flipped.`,
      ``,
      `When all ${targets.length} are done, Telegram me a one-line summary listing what was promoted.`,
      ``,
      `Important: do not run /run-cycle, do not pull from Inven (no credits), do not contact anyone. Research + write notes only.`,
    ].join("\n");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: process.env.HOME ?? "",
      PATH:
        process.env.PATH ??
        "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    };
    const child = spawn(
      claudeBin,
      ["--dangerously-skip-permissions", "-p", prompt],
      { env, cwd: AUTOPILOT_REPO, detached: true, stdio: "ignore" },
    );
    child.unref();
    res.json({
      ok: true,
      pid: child.pid,
      count: targets.length,
      message: `Investigating ${targets.length} seeds — Claude is researching them one at a time. Telegram will ping you when done.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "bulk_investigate_failed", message });
  }
});

nichesRouter.post("/:slug/status", async (req, res) => {
  const { slug } = req.params;
  const { status, reason } = req.body ?? {};
  if (typeof status !== "string" || !isValidStatus(status)) {
    res.status(400).json({ error: "invalid_status", status });
    return;
  }
  if (status === "rejected" && !reason) {
    res.status(400).json({ error: "reason_required_for_rejection" });
    return;
  }
  try {
    const niche = await setStatus(slug, status, reason);
    res.json({ ok: true, niche });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "state_cli_failed", message });
  }
});

nichesRouter.post("/:slug/investigate", async (req, res) => {
  const { slug } = req.params;
  try {
    // Look up the seed niche so we can pass its current name + notes as context
    const tracker = (await loadTracker()) as unknown as {
      industries: { id: string; slug?: string; name: string; notes?: string; status: string }[];
    };
    const niche = tracker.industries.find((n) => n.id === slug || n.slug === slug);
    if (!niche) {
      res.status(404).json({ error: "niche_not_found", slug });
      return;
    }

    if (FIXTURE_MODE) {
      await applyInvestigation(slug, await loadReveal(slug, niche.name));
      res.json({
        ok: true,
        message: `Investigated "${niche.name}" — developed a full proposal with thesis, scores, and a buy box. (Demo: simulated, no Claude spawn or spend.)`,
      });
      return;
    }

    const claudeBin =
      process.env.CLAUDE_BIN ?? path.join(os.homedir(), ".local/bin/claude");
    try {
      await fs.access(claudeBin);
    } catch {
      res.status(500).json({ error: "claude_bin_not_found", path: claudeBin });
      return;
    }

    const prompt = [
      `Use the /industry-ideation skill in drill-down mode to develop the seed niche "${niche.name}" (slug: ${slug}) into a proper proposed-level entry.`,
      ``,
      `Current notes: ${niche.notes ?? "(none)"}`,
      ``,
      `Steps:`,
      `1. Research the niche (web search, knowledge) — fragmentation, tailwinds, adjacencies, owner profile, search-fund fit.`,
      `2. Write the structured output the skill normally produces: thesis, 4+1 scores (G/S/C/P/Q), tailwinds line, adjacencies, Inven-ready business description, and a complete buy_box block (with business_type if software).`,
      `3. Update the tracker entry at ~/Library/Application Support/nsp-autopilot/industry-tracker.json directly: set notes to the developed content, add the buy_box, and persist any new fields.`,
      `4. Then run: python3 ${path.join(AUTOPILOT_REPO, "lib/state.py")} set-status ${slug} proposed --reason "investigated from seed via dashboard"`,
      `5. Telegram me a one-line confirmation when done.`,
      ``,
      `Important: do not run /run-cycle, do not pull from Inven (no credits), do not contact anyone. Research + write notes only.`,
    ].join("\n");

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: process.env.HOME ?? "",
      PATH:
        process.env.PATH ??
        "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    };

    const child = spawn(
      claudeBin,
      ["--dangerously-skip-permissions", "-p", prompt],
      { env, cwd: AUTOPILOT_REPO, detached: true, stdio: "ignore" },
    );
    child.unref();
    res.json({
      ok: true,
      pid: child.pid,
      message: `Investigating "${niche.name}" — Claude is researching now. It'll flip to Proposed with rich notes when done (a few minutes). Telegram will ping you.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "investigate_failed", message });
  }
});

nichesRouter.post("/:slug/run-cycle-now", async (req, res) => {
  const { slug } = req.params;
  const id = await resolveIdentity(req);

  // Operators request; owners execute.
  if (id.role !== "owner") {
    if (id.role === "viewer") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const request = await createRequest({
      kind: "run-cycle",
      slug,
      label: `Run a cycle on "${slug}"`,
      requested_by: id.email ?? "local",
    });
    res.json({
      ok: true,
      queued_for_approval: true,
      request,
      message: `Requested — Nico will approve the run on "${slug}".`,
    });
    return;
  }

  const result = await executeRunCycle(slug);
  if (!result.ok) {
    res.status(500).json({ error: "run_cycle_failed", message: result.error });
    return;
  }
  res.json({ ok: true, message: result.message });
});


const NUM_FIELDS = ["revenue_min","revenue_max","ebitda_min","ebitda_max","headcount_min","headcount_max"] as const;
const STR_FIELDS = ["geography","ownership","notes","business_type"] as const;

nichesRouter.patch("/:slug/buy-box", async (req, res) => {
  const { slug } = req.params;
  const id = await resolveIdentity(req);
  if (id.role === "viewer") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const buyBox: Record<string, unknown> = {};
  for (const f of NUM_FIELDS) {
    if (f in body) {
      const v = body[f];
      if (v === null || v === "") { buyBox[f] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        res.status(400).json({ error: "invalid_number", field: f });
        return;
      }
      buyBox[f] = n;
    }
  }
  for (const f of STR_FIELDS) {
    if (f in body) {
      const v = body[f];
      if (v !== null && typeof v !== "string") {
        res.status(400).json({ error: "invalid_string", field: f });
        return;
      }
      buyBox[f] = v === "" ? null : v;
    }
  }
  if (Object.keys(buyBox).length === 0) {
    res.status(400).json({ error: "no_fields" });
    return;
  }
  try {
    const niche = await setBuyBox(slug, buyBox);
    res.json({ ok: true, niche });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "set_buy_box_failed", message });
  }
});
