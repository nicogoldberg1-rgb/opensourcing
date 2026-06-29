// Standalone CLI for the free email verifier — handy for demos and one-off checks.
//
//   tsx src/verify-cli.ts a@x.com b@y.com          # pretty table
//   tsx src/verify-cli.ts --json a@x.com           # full JSON results
//   tsx src/verify-cli.ts --gate a@x.com > c.json  # shape for the engine's gate:
//       python3 lib/deliverability_gate.py check c.json
//
// Set VERIFY_FROM_DOMAIN to a real domain you control for the best acceptance rates.
import { verifyEmails, type VerifyStatus } from "./lib/verify.js";

const ICON: Record<VerifyStatus, string> = {
  deliverable: "✅",
  "catch-all": "🟡",
  undeliverable: "❌",
  unconfirmed: "⚠️ ",
  unknown: "❔",
};

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const asGate = args.includes("--gate");
  const emails = args.filter((a) => !a.startsWith("--"));
  if (!emails.length) {
    console.error("usage: tsx src/verify-cli.ts <email...> [--json] [--gate]");
    return 2;
  }

  const results = await verifyEmails(emails);

  if (asGate) {
    // The exact shape deliverability_gate.py accepts (a flat contact list).
    console.log(JSON.stringify(results.map((r) => ({ email: r.email, verifalia: r.verifalia })), null, 2));
    return 0;
  }
  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return 0;
  }

  for (const r of results) {
    const mx = r.mx ? `  (${r.mx}${r.smtp_code ? ` · ${r.smtp_code}` : ""})` : "";
    console.log(`${ICON[r.status]} ${r.status.padEnd(13)} ${r.email}${mx}  — ${r.reason}`);
  }
  const summary = results.reduce<Record<string, number>>((a, r) => {
    a[r.status] = (a[r.status] ?? 0) + 1;
    return a;
  }, {});
  console.error(`\n${results.length} checked — ${JSON.stringify(summary)}`);
  return 0;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error(e);
  process.exit(1);
});
