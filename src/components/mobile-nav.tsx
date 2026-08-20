import { Link, useRouterState } from "@tanstack/react-router";
import { Inbox, LayoutGrid, MoreHorizontal, PenSquare, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { to: "/", label: "Pages", icon: LayoutGrid },
  { to: "/composer", label: "Compose", icon: PenSquare },
  { to: "/agent", label: "Agent", icon: Sparkles },
  { to: "/inbox", label: "Inbox", icon: Inbox },
] as const;

const MORE = [
  { to: "/later", label: "Later" },
  { to: "/drafts", label: "Drafts" },
  { to: "/calendar", label: "Calendar" },
  { to: "/analytics", label: "Analytics" },
  { to: "/media", label: "Media" },
  { to: "/merchandise", label: "Merchandise" },
  { to: "/pair", label: "Pair phone" },
  { to: "/settings", label: "Settings" },
] as const;

export function MobileNav({ inboxCount = 0 }: { inboxCount?: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [more, setMore] = useState(false);
  const moreActive = MORE.some((i) => pathname === i.to || pathname.startsWith(i.to));

  return (
    <>
      {more ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
          aria-label="Close more"
          onClick={() => setMore(false)}
        />
      ) : null}
      {more ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 rounded-t-2xl border-t border-border bg-card p-3 shadow-lift md:hidden">
          <div className="grid grid-cols-2 gap-1">
            {MORE.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMore(false)}
                className={cn(
                  "rounded-lg px-3 py-3 text-sm font-medium",
                  pathname === item.to ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon className="size-5" />
                {item.to === "/inbox" && inboxCount > 0 ? (
                  <span className="absolute -top-1 -right-2 rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
                    {inboxCount > 9 ? "9+" : inboxCount}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
            more || moreActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
    </>
  );
}
