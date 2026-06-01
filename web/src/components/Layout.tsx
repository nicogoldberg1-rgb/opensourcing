import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../lib/cn";

const NAV: { to: string; label: string; soon?: boolean }[] = [
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
        <nav className="flex gap-0.5 text-sm">
          {NAV.map((item) =>
            item.soon ? (
              <span
                key={item.to}
                title="Coming next"
                className="rounded px-2 py-1 text-neutral-400"
              >
                {item.label}
              </span>
            ) : (
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
            ),
          )}
        </nav>
      </header>
      <Outlet context={context} />
    </div>
  );
}
