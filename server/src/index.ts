import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { nichesRouter } from "./routes/niches.js";
import { orchestratorRouter } from "./routes/orchestrator.js";
import { prioritiesRouter } from "./routes/priorities.js";
import { sequencesRouter } from "./routes/sequences.js";
import { cyclesRouter } from "./routes/cycles.js";
import { spendRouter } from "./routes/spend.js";
import { roadmapRouter } from "./routes/roadmap.js";
import { meRouter } from "./routes/me.js";
import { requestsRouter } from "./routes/requests.js";
import { AUTOPILOT_REPO, NSP_STATE_DIR } from "./paths.js";
import { FIXTURE_MODE } from "./config.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    fixture: FIXTURE_MODE,
    autopilot_repo: AUTOPILOT_REPO,
    nsp_state_dir: NSP_STATE_DIR,
  });
});

app.use("/api/niches", nichesRouter);
app.use("/api/orchestrator", orchestratorRouter);
app.use("/api/priorities", prioritiesRouter);
app.use("/api/sequences", sequencesRouter);
app.use("/api/cycles", cyclesRouter);
app.use("/api/spend", spendRouter);
app.use("/api/roadmap", roadmapRouter);
app.use("/api/me", meRouter);
app.use("/api/requests", requestsRouter);

// Production: serve the built SPA from web/dist on the same origin as the API.
// In dev, web/dist doesn't exist (Vite serves the frontend and proxies /api),
// so this block is skipped and dev behaviour is unchanged.
// server/dist/index.js -> server -> repo root -> web/dist
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, "../../web/dist");
if (fs.existsSync(path.join(WEB_DIST, "index.html"))) {
  app.use(express.static(WEB_DIST));
  // SPA fallback: any non-API GET returns index.html so client-side
  // (BrowserRouter) routes like /spend or /cycle/123 resolve on hard refresh.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(WEB_DIST, "index.html"));
  });
  console.log(`[nsp-dashboard] serving SPA from ${WEB_DIST}`);
} else {
  console.log(`[nsp-dashboard] no web/dist build found — API only (dev mode)`);
}

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(
    `[nsp-dashboard] api listening on http://localhost:${port}` +
      (FIXTURE_MODE ? " (fixture mode)" : ""),
  );
});
