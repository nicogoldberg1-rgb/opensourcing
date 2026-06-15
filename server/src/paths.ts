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
    path.join(HOME, "autopilot");

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

// Single source of truth for fixture/demo external-API data (formerly hard-coded
// in the reply/lob/anthropic libs). Demo mode reads these JSON files.
export const DEMO_DIR = path.join(FIXTURES_ROOT, "demo");
export const DEMO_SEQUENCES_JSON = path.join(DEMO_DIR, "sequences.json");
export const DEMO_LOB_JSON = path.join(DEMO_DIR, "lob.json");
export const DEMO_ANTHROPIC_JSON = path.join(DEMO_DIR, "anthropic-usage.json");
export const DEMO_INVESTIGATE_JSON = path.join(DEMO_DIR, "investigate.json");
