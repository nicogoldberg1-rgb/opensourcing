// Fixture mode: when NSP_FIXTURE_MODE=1, the backend reads bundled fake data
// from <repo>/fixtures and never touches the operator's real autopilot state,
// real external APIs, or spawns Claude. This is what the CS intern develops
// against — a fully interactive dashboard with zero blast radius.
export const FIXTURE_MODE = process.env.NSP_FIXTURE_MODE === "1";
