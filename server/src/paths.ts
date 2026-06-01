import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_MODE } from "./config.js";

const HOME = os.homedir();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// <repo>/fixtures (server/src -> server -> repo root)
const FIXTURES_ROOT = path.resolve(__dirname, "../../fixtures");

export const AUTOPILOT_REPO = FIXTURE_MODE
  ? path.join(FIXTURES_ROOT, "autopilot")
  : process.env.AUTOPILOT_REPO ??
    path.join(HOME, "conductor/workspaces/open-sourcing/porto");

export const NSP_STATE_DIR = FIXTURE_MODE
  ? path.join(FIXTURES_ROOT, "nsp-state")
  : process.env.NSP_STATE_DIR ??
    path.join(HOME, "Library/Application Support/nsp-autopilot");

export const TRACKER_JSON = path.join(NSP_STATE_DIR, "industry-tracker.json");
export const ORCH_STATE_JSON = path.join(NSP_STATE_DIR, "orchestrator-state.json");
export const ORCH_LOCK = path.join(NSP_STATE_DIR, "orchestrator.lock");
export const ORCH_LOGS_DIR = path.join(NSP_STATE_DIR, "orchestrator-logs");

export const STATE_PY = path.join(AUTOPILOT_REPO, "lib/state.py");
export const CYCLE_DIRS_GLOB_ROOT = path.join(AUTOPILOT_REPO, ".context");
