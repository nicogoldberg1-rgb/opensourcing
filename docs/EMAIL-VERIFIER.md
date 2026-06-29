# Free email verifier (MX + SMTP)

A no-cost email-deliverability verifier built into the server. It produces the **same
verdicts the autopilot already acts on** — the engine's `lib/deliverability_gate.py`
classifies each contact as deliverable / catch-all / undeliverable / unconfirmed /
unknown, and today those verdicts come from **Verifalia (paid, per email)**. This module
produces them from **DNS + a direct SMTP conversation, for free**, as a drop-in source.

No new dependencies — just Node's built-in `node:dns` and `node:net`.

## How it works

For each address: syntax check → resolve the domain's **MX** (falls back to A/AAAA) →
open SMTP to the best mail host → `EHLO` / `MAIL FROM` / **`RCPT TO`** and read the
response code. It also sends one `RCPT TO` for a **random** local-part per domain to
detect **catch-all** servers (which accept everything). Catch-all is a domain property,
so it's probed once per domain and reused across that domain's addresses.

```
RCPT 2xx + random rejected   → deliverable
RCPT 2xx + random also 2xx   → catch-all      (accepts all; minority bounce async)
RCPT 5xx                      → undeliverable  (mailbox/domain rejected)
RCPT 4xx / greylist / timeout → unconfirmed    (reachable, not confirmable; bounces often)
no MX/A record                → undeliverable  (domain can't receive mail)
can't reach any MX (port 25)  → unknown        (our network blocked, not the address)
```

## Verdict taxonomy (mirrors `deliverability_gate.py`)

| status | meaning | `verifalia` field emitted | gate bucket |
|---|---|---|---|
| `deliverable` | mailbox accepts mail | `Deliverable` | deliverable |
| `catch-all` | server accepts all recipients | `ServerIsCatchAll` | catchall |
| `undeliverable` | mailbox/domain rejects | `Undeliverable` | undeliverable |
| `unconfirmed` | reachable but unconfirmable (greylist/timeout) | `Risky-Timeout` | unconfirmed |
| `unknown` | couldn't reach the server | `Unknown` | unknown |

Every result carries a `verifalia` string whose value `deliverability_gate._classify()`
buckets identically — so the verifier's JSON output feeds the **existing gate unchanged**:

```bash
# in the dashboard repo
npm --prefix server run verify -- --gate a@x.com b@y.com > contacts.json
# in the engine repo
python3 lib/deliverability_gate.py check contacts.json   # exits non-zero if unsafe to send
```

That's the point: **free verifier → existing gate → no Verifalia required.**

## Usage

**HTTP**
```
GET  /api/verify?email=foo@bar.com           # single
POST /api/verify   { "emails": ["a@x.com"] } # batch (max 500)
                                             # -> { count, summary, results: VerifyResult[] }
```

**CLI**
```bash
npm run verify -- a@x.com b@y.com      # pretty table
npm run verify -- --json a@x.com       # full JSON
npm run verify -- --gate a@x.com       # gate-shaped contact list (feed deliverability_gate.py)
```

**Library**
```ts
import { verifyEmail, verifyEmails } from "./lib/verify.js";
const results = await verifyEmails(["a@x.com", "b@y.com"]);
```

## Configuration (env)

| var | default | notes |
|---|---|---|
| `VERIFY_FROM_DOMAIN` | `verify.opensourcing.dev` | EHLO/`MAIL FROM` domain. **Set to a real domain you control** for the best acceptance rates. |
| `VERIFY_TIMEOUT_MS` | `10000` | per-command SMTP socket timeout |
| `VERIFY_CONCURRENCY` | `6` | domains probed in parallel (we serialize within a domain to stay polite) |

## Honest limitations

This is a strong free signal, not a Verifalia-grade oracle. Be aware:

- **Outbound port 25 is blocked on most residential/cloud networks** (incl. many CI
  runners). When it is, every probe lands in `unknown` — by design we never guess
  deliverable. Run it from a host/VPS with port 25 open for real results.
- **Large providers (Gmail, Outlook, Yahoo) obscure mailbox existence** — they accept-
  then-bounce or greylist, so they often come back `catch-all` or `unconfirmed` rather
  than a clean `deliverable`. The gate already treats catch-all as send-OK and unconfirmed
  as suppress, which is the safe behavior.
- It does not detect spam-traps, role accounts, or reputation — Verifalia does more. This
  covers the highest-value 80%: dead domains, dead mailboxes, and catch-all detection.

## Fixture mode

With `NSP_FIXTURE_MODE=1` the verifier makes **no network calls** and returns
deterministic verdicts keyed off the local-part (`bounce*`→undeliverable,
`catchall*`→catch-all, `greylist*`/`timeout*`→unconfirmed, `blocked*`→unknown, else
deliverable). Lets the dashboard and interns develop with zero blast radius.

## Tests

```bash
npm test    # node:test, no network — syntax, code→verdict mapping, gate compatibility
```

The `gate compatibility` test mirrors `deliverability_gate._classify()` and asserts every
verdict string we emit lands in the matching bucket, so the handoff can't silently drift.

## Files

- `server/src/lib/verify.ts` — core (DNS + SMTP probe + classification)
- `server/src/routes/verify.ts` — `GET`/`POST /api/verify`
- `server/src/verify-cli.ts` — standalone CLI
- `server/src/lib/verify.test.ts` — pure-logic tests
