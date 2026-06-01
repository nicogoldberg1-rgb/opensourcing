import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROLES_FILE = path.resolve(__dirname, "../../data/roles.json");

export type Role = "owner" | "operator" | "viewer";

const VALID: Role[] = ["owner", "operator", "viewer"];

// Header Cloudflare Access injects once the user is authenticated.
const CF_EMAIL_HEADER = "cf-access-authenticated-user-email";

type RolesConfig = {
  // email (lowercased) -> role
  allowlist: Record<string, Role>;
  // role applied when no email matches but a CF header IS present
  default_authenticated: Role;
  // role applied for local/no-auth access (no CF header)
  default_local: Role;
};

const DEFAULT_CONFIG: RolesConfig = {
  allowlist: {},
  default_authenticated: "viewer",
  default_local: "owner",
};

let cache: { at: number; cfg: RolesConfig } | null = null;

async function loadConfig(): Promise<RolesConfig> {
  if (cache && Date.now() - cache.at < 5_000) return cache.cfg;
  let cfg = DEFAULT_CONFIG;
  try {
    const raw = await fs.readFile(ROLES_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<RolesConfig>;
    cfg = {
      allowlist: parsed.allowlist ?? {},
      default_authenticated: parsed.default_authenticated ?? "viewer",
      default_local: parsed.default_local ?? "owner",
    };
  } catch {
    // no config file — use defaults
  }
  cache = { at: Date.now(), cfg };
  return cfg;
}

export type Identity = { role: Role; email: string | null; source: string };

export async function resolveIdentity(req: Request): Promise<Identity> {
  const cfg = await loadConfig();
  const headerEmail = (req.headers[CF_EMAIL_HEADER] as string | undefined)?.toLowerCase();

  if (headerEmail) {
    const role = cfg.allowlist[headerEmail] ?? cfg.default_authenticated;
    return { role, email: headerEmail, source: "cloudflare-access" };
  }

  // Local / no auth header. Allow a header / query-param / env override for
  // previewing non-owner views during development. This ONLY applies when there
  // is no Cloudflare header, so it can't be used to escalate in production.
  const override =
    (req.headers["x-nsp-role"] as string | undefined) ??
    (req.query.role as string | undefined) ??
    process.env.NSP_DEFAULT_ROLE;
  if (override && (VALID as string[]).includes(override)) {
    return { role: override as Role, email: null, source: "local-override" };
  }
  return { role: cfg.default_local, email: null, source: "local-default" };
}

export function roleRank(role: Role): number {
  return role === "owner" ? 3 : role === "operator" ? 2 : 1;
}

export function atLeast(role: Role, min: Role): boolean {
  return roleRank(role) >= roleRank(min);
}
