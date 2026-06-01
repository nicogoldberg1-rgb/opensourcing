import "dotenv/config";
import cors from "cors";
import express from "express";
import { nichesRouter } from "./routes/niches.js";
import { orchestratorRouter } from "./routes/orchestrator.js";
import { prioritiesRouter } from "./routes/priorities.js";
import { sequencesRouter } from "./routes/sequences.js";
import { cyclesRouter } from "./routes/cycles.js";
import { spendRouter } from "./routes/spend.js";
import { roadmapRouter } from "./routes/roadmap.js";
import { AUTOPILOT_REPO, NSP_STATE_DIR } from "./paths.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
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

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[nsp-dashboard] api listening on http://localhost:${port}`);
});
