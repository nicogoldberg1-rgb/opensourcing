import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../lib/cn";
import { useSession } from "../lib/session";

const NAV: { to: string; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/sequences", label: "Sequences" },
  { to: "/cycle", label: "Live cycle" },
  { to: "/spend", label: "Spend" },
  { to: "/roadmap", label: "Roadmap" },
];

export type LayoutContext = {
  setSubtitle: (s: string | undefined) => void;
};

export function Layout({
  subtitle,
  context,
}: {
  subtitle?: string;
  context: LayoutContext;
}) {
  const { me, isOwner } = useSession();
  const pending = me?.pending_requests ?? 0;

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight">
            NSP Autopilot
          </h1>
          {subtitle && (
            <span className="text-xs text-neutral-400">{subtitle}</span>
          )}
        </div>
        <nav className="flex items-center gap-0.5 text-sm">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded px-2 py-1 transition-colors",
                  isActive
                    ? "font-medium text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}

          {/* Requests: owners always see it (with pending badge); operators see
              it labelled "My requests". Viewers don't. */}
          {me && me.role !== "viewer" && (
            <NavLink
              to="/requests"
              className={({ isActive }) =>
                cn(
                  "ml-1 inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors",
                  isActive
                    ? "font-medium text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                )
              }
            >
              {isOwner ? "Requests" : "My requests"}
              {isOwner && pending > 0 && (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white tabular-nums">
                  {pending}
                </span>
              )}
            </NavLink>
          )}

          {/* Role pill */}
          {me && (
            <span
              className={cn(
                "ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                me.role === "owner" && "bg-neutral-100 text-neutral-600",
                me.role === "operator" && "bg-blue-50 text-blue-700",
                me.role === "viewer" && "bg-neutral-100 text-neutral-500",
              )}
              title={me.email ?? "local session"}
            >
              {me.role}
            </span>
          )}
        </nav>
      </header>
      {me?.fixture && (
        <div className="shrink-0 bg-amber-100 px-6 py-1 text-center text-[11px] font-medium text-amber-800">
          Fixture mode — demo data. Nothing here touches real autopilot state, APIs, or spend.
        </div>
      )}
      <Outlet context={context} />
    </div>
  );
}
