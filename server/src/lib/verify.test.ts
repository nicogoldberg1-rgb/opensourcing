// Pure-logic tests for the email verifier — no network. Run: npm test (server/).
//
// The load-bearing test is `gate compatibility`: it mirrors the engine's
// deliverability_gate._classify() and proves every verdict string we emit lands in
// the matching bucket, so our output feeds `deliverability_gate.py check` unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkSyntax,
  classifyFromCodes,
  fixtureVerdict,
  STATUS_TO_VERIFALIA,
  type VerifyStatus,
} from "./verify.js";

test("checkSyntax accepts normal addresses", () => {
  for (const ok of ["a@b.com", "first.last@example.com", "x+tag@sub.example.co.uk"]) {
    assert.equal(checkSyntax(ok), true, ok);
  }
});

test("checkSyntax rejects junk", () => {
  for (const bad of ["", "noatsign", "a@", "@b.com", "a b@c.com", "a@b", "a@@b.com", "a@b..com"]) {
    assert.equal(checkSyntax(bad), false, bad);
  }
});

test("classifyFromCodes maps SMTP codes to the right verdict", () => {
  assert.equal(classifyFromCodes(250, 550).status, "deliverable"); // mailbox yes, random no
  assert.equal(classifyFromCodes(251, 550).status, "deliverable"); // 251 "will forward" counts
  assert.equal(classifyFromCodes(250, 250).status, "catch-all"); // random also accepted
  assert.equal(classifyFromCodes(250, 250).catchAll, true);
  assert.equal(classifyFromCodes(550, 550).status, "undeliverable");
  assert.equal(classifyFromCodes(451, null).status, "unconfirmed"); // greylist
  assert.equal(classifyFromCodes(null, null).status, "unknown"); // no response
  // only 250/251 confirm a mailbox — other 2xx (e.g. 221 "closing channel") must not
  assert.equal(classifyFromCodes(221, null).status, "unknown");
  assert.equal(classifyFromCodes(250, 221).status, "deliverable"); // weird 2xx on the random probe isn't catch-all proof
});

// Mirror of engine repo lib/deliverability_gate.py `_classify` (June 2026 version).
function gateClassify(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v.startsWith("deliverable") || v === "success") return "deliverable";
  if (v.startsWith("undeliverable")) return "undeliverable";
  if (["mailboxdoesnotexist", "domainismisconfigured", "mailboxisdisabled", "smtpconnectiontimeout"].includes(v))
    return "undeliverable";
  if (v === "serveriscatchall" || v === "risky-catchall" || v === "catchallvalidationtimeout") return "catchall";
  if (v.includes("timeout") || v.includes("temporarilyunavailable") || v.includes("localendpointrejected") ||
      ["risky-timeout", "risky-unavailable"].includes(v)) return "unconfirmed";
  if (v.startsWith("risky")) return "unconfirmed";
  if (v.startsWith("unknown")) return "unknown";
  return "unknown";
}

test("gate compatibility: every verdict string buckets correctly in deliverability_gate", () => {
  // our status -> the gate's internal bucket name it must land in
  const expected: Record<VerifyStatus, string> = {
    deliverable: "deliverable",
    "catch-all": "catchall",
    undeliverable: "undeliverable",
    unconfirmed: "unconfirmed",
    unknown: "unknown",
  };
  for (const status of Object.keys(expected) as VerifyStatus[]) {
    const verifalia = STATUS_TO_VERIFALIA[status];
    assert.equal(
      gateClassify(verifalia),
      expected[status],
      `status '${status}' emits verifalia='${verifalia}' which the gate must bucket as '${expected[status]}'`,
    );
  }
});

test("fixtureVerdict returns deterministic verdicts (powers FIXTURE_MODE, no network)", () => {
  assert.equal(fixtureVerdict("real.person@example.com").status, "deliverable");
  assert.equal(fixtureVerdict("bounce@example.com").status, "undeliverable");
  assert.equal(fixtureVerdict("anything@catchall-domain.com").status, "catch-all");
  assert.equal(fixtureVerdict("user@greylist-co.com").status, "unconfirmed");
  assert.equal(fixtureVerdict("blocked@somewhere.com").status, "unknown");
  assert.equal(fixtureVerdict("not-an-email").status, "undeliverable");
  // verdicts are gate-shaped end to end
  assert.equal(fixtureVerdict("real.person@example.com").verifalia, "Deliverable");
});
