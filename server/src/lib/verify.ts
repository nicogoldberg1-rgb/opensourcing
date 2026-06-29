// Free email verifier — MX lookup + SMTP RCPT probe, no paid API.
//
// Why this exists: the autopilot's deliverability gate (lib/deliverability_gate.py
// in the engine repo) consumes a per-contact verdict and hard-stops the email push
// when undeliverable/unconfirmed addresses are in the set. Today those verdicts come
// from Verifalia (paid, per-email). This module produces the SAME verdict vocabulary
// for free, using only DNS + a direct SMTP conversation — a drop-in replacement.
//
// The verdict taxonomy mirrors deliverability_gate exactly:
//   deliverable   — MX accepts mail for this specific mailbox (RCPT 2xx, and a random
//                   address at the same domain is rejected → not catch-all)
//   catch-all     — server accepts ALL mail (random address also 2xx); mostly safe but
//                   a minority bounce async — the gate allows by default, blocks --strict
//   undeliverable — mailbox/domain rejected (RCPT 5xx, or no MX/A record at all)
//   unconfirmed   — server reachable but wouldn't confirm (greylist 4xx / timeout); these
//                   bounce at a high rate → the gate suppresses them
//   unknown       — we could not reach any MX (port 25 blocked from this host, or the
//                   server is unreachable). NOT the address's fault → never email blind.
//
// Each result also carries a `verifalia` string whose value is what the engine's
// deliverability_gate._classify() maps to the same bucket, so a JSON array of these
// results feeds `python3 lib/deliverability_gate.py check <file>` unchanged.
//
// Honest limitations (documented, not hidden): outbound port 25 is blocked on most
// residential/cloud networks → expect `unknown` there; some big providers (Gmail,
// Outlook) accept-then-bounce or greylist, so they often land in catch-all/unconfirmed
// rather than a clean deliverable. Set VERIFY_FROM_DOMAIN to a real domain you own for
// the best acceptance rates.

import net from "node:net";
import { promises as dns } from "node:dns";
import { FIXTURE_MODE } from "../config.js";

export type VerifyStatus =
  | "deliverable"
  | "catch-all"
  | "undeliverable"
  | "unconfirmed"
  | "unknown";

export type VerifyResult = {
  email: string;
  status: VerifyStatus;
  /** A Verifalia-shaped string the engine's deliverability_gate understands.
   *  Lets the gate enforce on our output with zero changes. */
  verifalia: string;
  reason: string;
  mx: string | null;
  smtp_code: number | null;
  catch_all: boolean;
  checked_at: string;
};

export type VerifyOptions = {
  /** Domain presented in EHLO and used for the MAIL FROM probe address.
   *  A real domain you control improves acceptance — defaults to env. */
  fromDomain?: string;
  fromAddress?: string;
  /** Per-command socket timeout (ms). */
  timeoutMs?: number;
  /** Max domains probed in parallel (we serialize within a domain). */
  concurrency?: number;
  port?: number;
};

const DEFAULT_FROM_DOMAIN = process.env.VERIFY_FROM_DOMAIN || "verify.opensourcing.dev";
const DEFAULT_TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS || 10_000);
const DEFAULT_CONCURRENCY = Number(process.env.VERIFY_CONCURRENCY || 6);
const SMTP_PORT = 25;

// status -> a verifalia value that deliverability_gate._classify() buckets identically.
// (verified against the engine's classifier: 'Deliverable'->deliverable,
//  'ServerIsCatchAll'->catchall, 'Undeliverable'->undeliverable,
//  'Risky-Timeout'->unconfirmed, 'Unknown'->unknown)
export const STATUS_TO_VERIFALIA: Record<VerifyStatus, string> = {
  deliverable: "Deliverable",
  "catch-all": "ServerIsCatchAll",
  undeliverable: "Undeliverable",
  unconfirmed: "Risky-Timeout",
  unknown: "Unknown",
};

// Deliberately permissive but not silly. Rejects obvious junk; the SMTP probe is the
// real test. (RFC 5322 in full is not worth it here.)
const EMAIL_RE = /^[^\s@"]+(?:\.[^\s@"]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function checkSyntax(email: string): boolean {
  if (!email || email.length > 254) return false;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;
  if (email.slice(0, at).length > 64) return false;
  return EMAIL_RE.test(email);
}

function result(
  email: string,
  status: VerifyStatus,
  reason: string,
  extra: Partial<VerifyResult> = {},
): VerifyResult {
  return {
    email,
    status,
    verifalia: STATUS_TO_VERIFALIA[status],
    reason,
    mx: extra.mx ?? null,
    smtp_code: extra.smtp_code ?? null,
    catch_all: extra.catch_all ?? false,
    checked_at: new Date().toISOString(),
  };
}

/** Resolve the ordered list of mail hosts for a domain.
 *  MX records sorted by preference; falls back to the domain's A/AAAA (implicit MX,
 *  RFC 5321 §5.1). Empty array = no mail server → undeliverable. */
export async function resolveMailHosts(domain: string): Promise<string[]> {
  try {
    const mx = await dns.resolveMx(domain);
    const hosts = mx
      .filter((m) => m.exchange)
      .sort((a, b) => a.priority - b.priority)
      .map((m) => m.exchange);
    if (hosts.length) return hosts;
  } catch {
    // fall through to A/AAAA
  }
  try {
    await dns.resolve4(domain);
    return [domain];
  } catch {
    /* no A */
  }
  try {
    await dns.resolve6(domain);
    return [domain];
  } catch {
    /* no AAAA */
  }
  return [];
}

type SmtpClient = {
  send: (line: string) => Promise<{ code: number; text: string }>;
  close: () => void;
};

/** Open an SMTP connection and wait for the 220 greeting. Rejects on any
 *  connect/timeout error so the caller can classify "couldn't reach the server". */
function connectSmtp(host: string, port: number, timeoutMs: number): Promise<SmtpClient> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    let buffer = "";
    const replyLines: string[] = [];
    let onReply: ((r: { code: number; text: string }) => void) | null = null;
    let onError: ((e: Error) => void) | null = (e) => reject(e); // until greeting arrives
    let settled = false;

    const fail = (e: Error) => {
      const cb = onError;
      onError = null;
      onReply = null;
      try { socket.destroy(); } catch { /* noop */ }
      if (cb) cb(e);
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let nl: number;
      while ((nl = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        replyLines.push(line);
        // A reply is complete when a line is "NNN <text>" (space after the code);
        // "NNN-<text>" lines are continuations (e.g. multi-line EHLO).
        if (/^\d{3} /.test(line)) {
          const code = Number(line.slice(0, 3));
          const text = replyLines.join("\n");
          replyLines.length = 0;
          const cb = onReply;
          onReply = null;
          if (cb) cb({ code, text });
        }
      }
    });
    socket.on("error", (e) => fail(e instanceof Error ? e : new Error(String(e))));
    socket.on("timeout", () => fail(new Error("smtp_timeout")));
    socket.on("close", () => {
      if (!settled) fail(new Error("smtp_closed"));
    });

    // First reply must be the 220 greeting.
    onReply = (r) => {
      if (r.code !== 220) {
        fail(new Error(`smtp_greeting_${r.code}`));
        return;
      }
      settled = true;
      onError = null;
      resolve({
        send: (line: string) =>
          new Promise((res, rej) => {
            onReply = res;
            onError = rej;
            socket.write(line + "\r\n");
          }),
        close: () => {
          try { socket.write("QUIT\r\n"); } catch { /* noop */ }
          try { socket.destroy(); } catch { /* noop */ }
        },
      });
    };
  });
}

export function classifyFromCodes(
  realCode: number | null,
  randomCode: number | null,
): { status: VerifyStatus; catchAll: boolean; reason: string } {
  if (realCode === null) {
    return { status: "unknown", catchAll: false, reason: "no SMTP response from server" };
  }
  if (realCode >= 200 && realCode < 300) {
    if (randomCode !== null && randomCode >= 200 && randomCode < 300) {
      return {
        status: "catch-all",
        catchAll: true,
        reason: "server accepts all recipients (catch-all) — mailbox not individually confirmable",
      };
    }
    return { status: "deliverable", catchAll: false, reason: `mailbox accepted (SMTP ${realCode})` };
  }
  if (realCode >= 500 && realCode < 600) {
    return { status: "undeliverable", catchAll: false, reason: `mailbox rejected (SMTP ${realCode})` };
  }
  if (realCode >= 400 && realCode < 500) {
    return {
      status: "unconfirmed",
      catchAll: false,
      reason: `temporary/greylist response (SMTP ${realCode}) — could not confirm`,
    };
  }
  return { status: "unknown", catchAll: false, reason: `unexpected SMTP code ${realCode}` };
}

const randomLocalPart = () =>
  `no-such-user-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** Probe one domain: connect to the first reachable MX, detect catch-all once, then
 *  test each local-part. Catch-all is a domain property, so we compute it a single time. */
async function verifyDomain(
  domain: string,
  emails: string[],
  opts: Required<VerifyOptions>,
): Promise<VerifyResult[]> {
  const hosts = await resolveMailHosts(domain);
  if (!hosts.length) {
    return emails.map((e) => result(e, "undeliverable", "domain has no MX or A record"));
  }

  // Try MX hosts in preference order until one accepts a connection.
  let client: SmtpClient | null = null;
  let usedHost: string | null = null;
  let lastErr = "";
  for (const host of hosts) {
    try {
      client = await connectSmtp(host, opts.port, opts.timeoutMs);
      usedHost = host;
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  if (!client || !usedHost) {
    // Couldn't open SMTP anywhere — almost always outbound port 25 blocked on this
    // network, or every MX is down. Not the address's fault → unknown, never blind-email.
    const reason = `could not reach any MX on port ${opts.port} (${lastErr || "unreachable"}) — likely port 25 blocked from this host`;
    return emails.map((e) => result(e, "unknown", reason, { mx: usedHost }));
  }

  try {
    await client.send(`EHLO ${opts.fromDomain}`);
    await client.send(`MAIL FROM:<${opts.fromAddress}>`);

    // Catch-all probe: a random local-part. 2xx here means the server accepts anything.
    let randomCode: number | null = null;
    try {
      const r = await client.send(`RCPT TO:<${randomLocalPart()}@${domain}>`);
      randomCode = r.code;
    } catch {
      randomCode = null;
    }

    const out: VerifyResult[] = [];
    for (const email of emails) {
      let realCode: number | null = null;
      try {
        // RSET keeps each RCPT an independent test on the same connection.
        await client.send("RSET");
        await client.send(`MAIL FROM:<${opts.fromAddress}>`);
        const r = await client.send(`RCPT TO:<${email}>`);
        realCode = r.code;
      } catch {
        realCode = null;
      }
      const { status, catchAll, reason } = classifyFromCodes(realCode, randomCode);
      out.push(result(email, status, reason, { mx: usedHost, smtp_code: realCode, catch_all: catchAll }));
    }
    return out;
  } finally {
    client.close();
  }
}

// Deterministic canned verdicts for FIXTURE_MODE — lets the dashboard/intern develop
// with zero network. Encodes intent in the local-part so every status is exercisable.
export function fixtureVerdict(email: string): VerifyResult {
  const lc = email.toLowerCase();
  if (!checkSyntax(email)) return result(email, "undeliverable", "invalid syntax (fixture)");
  if (lc.includes("bounce") || lc.includes("invalid") || lc.includes("noexist"))
    return result(email, "undeliverable", "fixture: undeliverable", { smtp_code: 550 });
  if (lc.includes("catchall")) return result(email, "catch-all", "fixture: catch-all", { smtp_code: 250, catch_all: true });
  if (lc.includes("greylist") || lc.includes("timeout")) return result(email, "unconfirmed", "fixture: unconfirmed", { smtp_code: 451 });
  if (lc.includes("blocked")) return result(email, "unknown", "fixture: port 25 blocked");
  return result(email, "deliverable", "fixture: deliverable", { smtp_code: 250 });
}

/** Verify a single email. Never throws — failures map to unknown/undeliverable. */
export async function verifyEmail(email: string, options: VerifyOptions = {}): Promise<VerifyResult> {
  const [res] = await verifyEmails([email], options);
  return res;
}

/** Verify a batch. Groups by domain (catch-all probed once per domain) and probes
 *  domains with bounded concurrency. Results are returned in input order. */
export async function verifyEmails(emails: string[], options: VerifyOptions = {}): Promise<VerifyResult[]> {
  const opts: Required<VerifyOptions> = {
    fromDomain: options.fromDomain ?? DEFAULT_FROM_DOMAIN,
    fromAddress: options.fromAddress ?? `verify@${options.fromDomain ?? DEFAULT_FROM_DOMAIN}`,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    port: options.port ?? SMTP_PORT,
  };

  const byEmail = new Map<string, VerifyResult>();

  // Syntax-invalid never hit the network.
  const valid: string[] = [];
  for (const email of emails) {
    const e = email.trim();
    if (!checkSyntax(e)) byEmail.set(email, result(email, "undeliverable", "invalid email syntax"));
    else valid.push(e);
  }

  if (FIXTURE_MODE) {
    for (const e of valid) byEmail.set(e, fixtureVerdict(e));
    return emails.map((e) => byEmail.get(e.trim()) ?? byEmail.get(e)!);
  }

  // Group remaining by domain.
  const byDomain = new Map<string, string[]>();
  for (const e of valid) {
    const domain = e.slice(e.lastIndexOf("@") + 1).toLowerCase();
    (byDomain.get(domain) ?? byDomain.set(domain, []).get(domain)!).push(e);
  }

  const domains = [...byDomain.keys()];
  let cursor = 0;
  async function worker() {
    while (cursor < domains.length) {
      const domain = domains[cursor++];
      const list = byDomain.get(domain)!;
      let results: VerifyResult[];
      try {
        results = await verifyDomain(domain, list, opts);
      } catch (e) {
        const reason = `verification error: ${e instanceof Error ? e.message : String(e)}`;
        results = list.map((em) => result(em, "unknown", reason));
      }
      for (const r of results) byEmail.set(r.email, r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, domains.length) }, worker));

  return emails.map((e) => byEmail.get(e.trim()) ?? byEmail.get(e)!);
}
