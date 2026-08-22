import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bookmark,
  CalendarDays,
  ImageIcon,
  Inbox,
  KeyRound,
  LayoutGrid,
  Menu,
  PenSquare,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  FileText,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bootstrapApp, savePrefs, searchFn, syncNowFn, tickFn } from "@/lib/posterpal/fns";
import type { HomeSnapshot, PageRow } from "@/lib/posterpal/types";
import { adoptLivePageId, useShellStore } from "@/lib/store";
import { cn, formatFanCount } from "@/lib/utils";
import { PageAvatar } from "./page-avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Hint } from "./ui/tooltip";
import { CommandPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { NeedsBell } from "./needs-bell";
import { PostInspector } from "./post-inspector";
import { ShortcutHelp } from "./shortcut-help";

const NAV = [
  { to: "/", label: "Pages", icon: LayoutGrid, hint: "All Pages you administer. Switch here; Composer, Calendar, and Inbox follow the selected Page." },
  { to: "/composer", label: "Composer", icon: PenSquare, hint: "Write a caption, attach media, run policy, then publish, schedule, or save a draft." },
  { to: "/later", label: "Later", icon: Bookmark, hint: "Idea board. Park captions for later — nothing here is posted to Facebook." },
  { to: "/drafts", label: "Drafts", icon: FileText, hint: "Local drafts, Facebook drafts, the scheduler queue, and failed Graph publishes." },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, hint: "Month/week view. Drag a post onto a day, then pick the time. Graph window is 10 minutes–30 days." },
  { to: "/inbox", label: "Inbox", icon: Inbox, hint: "Comments that need a human reply. AI may draft; you click Send. Never auto-comments." },
  { to: "/agent", label: "Agent", icon: Sparkles, hint: "Researches the public web and drafts captions. Cannot publish, like, follow, or reply." },
  { to: "/analytics", label: "Analytics", icon: BarChart3, hint: "Reactions, comments, shares. Page Insights metrics need 100+ likes on the Page." },
  { to: "/media", label: "Media", icon: ImageIcon, hint: "Files attached to posts, plus Imagine (Grok) image generation." },
  { to: "/merchandise", label: "Merchandise", icon: ShoppingBag, hint: "Product links with UTM. Inserted into Composer as a CTA — you still add a branded-content disclosure." },
  { to: "/vault", label: "Token vault", icon: KeyRound, hint: "Encrypted Facebook user tokens and the scheduler log. Graph 190 means reconnect." },
  { to: "/settings", label: "Settings", icon: Settings, hint: "Facebook App ID/Secret, BYO AI keys (OpenAI, Gemini, DeepSeek, Flux), cadence caps, brand voice." },
] as const;

export function AppShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { selectedPageId, setSelectedPageId, setCommandOpen, theme, setTheme } = useShellStore();
  const [data, setData] = useState<HomeSnapshot | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    bootstrapApp()
      .then((snap) => {
        if (cancelled) return;
        setData(snap);
        if (snap.settings.theme && snap.settings.theme !== theme) setTheme(snap.settings.theme);
        adoptLivePageId(snap.pages.map((p) => p.id), snap.settings.defaultPageId);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load workspace"));
    const t = window.setInterval(() => {
      void tickFn().catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Local scheduler stalled. Due posts are in Needs you.");
      });
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  const pages = data?.pages ?? [];
  const selected = pages.find((p) => p.id === selectedPageId) ?? pages[0] ?? null;
  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
  }, [pages, query]);

  if (isPending) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden w-[280px] border-r border-border bg-rail p-4 md:block">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-6 h-10 w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-10 w-64" />
        </div>
      </div>
    );
  }

  const quotaPct = data?.quota?.call_count_pct;

  return (
    <div className="flex min-h-screen bg-background">
      {railOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-foreground/30 md:hidden"
          aria-label="Close navigation"
          onClick={() => setRailOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] shrink-0 flex-col border-r border-border bg-rail md:static md:translate-x-0",
          railOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <PosterPalMark />
          <div>
            <div className="text-[15px] font-semibold leading-none">PosterPal</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Every Page. One desk.</div>
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter Pages"
              title="Filters the Page list in this rail"
              className="h-9 bg-chip pl-8"
            />
          </div>
        </div>

        <ScrollArea className="max-h-52 px-2">
          {filteredPages.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-muted-foreground">
              {pages.length === 0 ? "No Pages yet. Connect Facebook in Settings, or use practice Pages." : "No match."}
            </p>
          ) : (
            filteredPages.map((p) => (
              <PageRowButton
                key={p.id}
                page={p}
                active={selected?.id === p.id}
                onClick={() => {
                  setSelectedPageId(p.id);
                  setRailOpen(false);
                  void savePrefs({ data: { defaultPageId: p.id } });
                }}
              />
            ))
          )}
        </ScrollArea>

        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const badge = item.to === "/inbox" && data && data.inboxCount > 0 ? data.inboxCount : null;
            return (
              <Hint key={item.to} label={item.hint} side="right">
                <Link
                  to={item.to}
                  onClick={() => setRailOpen(false)}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium",
                    active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {badge ? (
                    <span className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground tabular-nums">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </Hint>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-3 md:px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setRailOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            title="Search posts, comments, and Pages"
            className="hidden min-w-0 flex-1 items-center gap-2 rounded-lg bg-chip px-3 py-2 text-left text-[13px] text-muted-foreground sm:flex"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate">Search posts, comments, Pages</span>
            <kbd className="rounded-sm border border-border bg-card px-1.5 text-[11px]">Ctrl+K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setCommandOpen(true)} aria-label="Search">
            <Search className="size-5" />
          </Button>
          <Hint
            label="Live Graph quota from X-App-Usage / X-Business-Use-Case-Usage. Page tokens use Pages BUC (4800 × engaged users / 24h). There is no invented 100-posts/day cap."
            side="bottom"
          >
            <div className="hidden items-center gap-2 rounded-full bg-chip px-3 py-1.5 text-[12px] font-medium md:flex">
              <span className="size-2 rounded-full bg-success" />
              <span className="text-muted-foreground">Quota</span>
              <span className="tabular-nums">{quotaPct == null ? "—" : `${Math.round(quotaPct)}%`}</span>
            </div>
          </Hint>
          <Hint label="Pulls published posts, comments, and engagement from Graph for connected Pages. Practice Pages stay local.">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              disabled={syncing}
              onClick={() => {
                setSyncing(true);
                void syncNowFn()
                  .then((r) => {
                    toast.success(`Synced ${r.postsUpdated} posts · ${r.commentsImported} comments`);
                    if (r.errors[0]) toast.message(r.errors[0]);
                    return bootstrapApp().then(setData);
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Sync failed"))
                  .finally(() => setSyncing(false));
              }}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
          </Hint>
          <div className="ml-auto flex items-center gap-2">
            <NeedsBell items={data?.needs ?? []} onChange={() => void bootstrapApp().then(setData)} />
            <Hint label="Keyboard shortcuts (?)">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Keyboard shortcuts"
                onClick={() => {
                  window.dispatchEvent(new Event("posterpal:shortcuts"));
                }}
                className="hidden sm:inline-flex"
              >
                <span className="text-[13px] font-semibold">?</span>
              </Button>
            </Hint>
            <Hint label={theme === "dark" ? "Light theme" : "Dark theme"}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Toggle theme"
                onClick={() => {
                  const next = theme === "dark" ? "light" : "dark";
                  setTheme(next);
                  void savePrefs({ data: { theme: next } });
                }}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </Hint>
            <UserButton />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-auto p-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-4 md:pb-4">{children}</main>
          {right ? (
            <aside className="hidden w-[320px] shrink-0 overflow-auto border-l border-border bg-card p-4 xl:block">
              {right}
            </aside>
          ) : null}
        </div>
      </div>

      <CommandPalette pages={pages} onSearch={(q) => searchFn({ data: { q } })} />
      <MobileNav inboxCount={data?.inboxCount ?? 0} />
      <PostInspector />
      <ShortcutHelp />
    </div>
  );
}

function PageRowButton({
  page,
  active,
  onClick,
}: {
  page: PageRow;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Hint
      label={
        page.is_practice
          ? "Practice Page — publishes stay on this desk, never Graph."
          : page.is_read_only
            ? "Analyze only — this Page is missing CREATE_CONTENT, so you cannot publish."
            : `${page.name}. Composer, Calendar, and Inbox use the selected Page.`
      }
      side="right"
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
          active ? "bg-accent" : "hover:bg-muted",
        )}
      >
        <PageAvatar id={page.id} name={page.name} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{page.name}</span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">
            {formatFanCount(page.fan_count)} likes
            {page.is_practice ? " · Practice" : ""}
            {page.is_read_only ? " · Analyze only" : ""}
          </span>
        </span>
      </button>
    </Hint>
  );
}

export function PosterPalMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <rect width="100" height="100" rx="22" fill="#1877F2" />
      <path
        d="M32 20h26c15 0 26 9 26 22s-11 22-26 22H48v20H32V20zm16 14v16h12c7 0 12-3.5 12-8s-5-8-12-8H48z"
        fill="#fff"
      />
    </svg>
  );
}
