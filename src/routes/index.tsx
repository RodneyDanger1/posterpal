import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { PageAvatar } from "@/components/page-avatar";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { bootstrapApp, startPractice, syncNowFn } from "@/lib/posterpal/fns";
import type { HomeSnapshot } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { formatFanCount, relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <Guard>
      <PagesHome />
    </Guard>
  );
}

function PagesHome() {
  const navigate = useNavigate();
  const selectedPageId = useShellStore((s) => s.selectedPageId);
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const [data, setData] = useState<HomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const reload = () => {
    return bootstrapApp()
      .then((snap) => {
        setData(snap);
        if (snap.pages.length === 0 && !snap.settings.setupComplete) {
          void navigate({ to: "/setup" });
        }
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Load failed"));
  };

  useEffect(() => {
    let c = false;
    bootstrapApp()
      .then((snap) => {
        if (c) return;
        setData(snap);
        if (snap.pages.length === 0 && !snap.settings.setupComplete) {
          void navigate({ to: "/setup" });
        }
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [navigate]);

  if (loading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    );
  }

  if (data.pages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Pages yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect a Development Mode Facebook app, or start with practice Pages to learn Composer, Calendar, and Inbox.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/setup">Open setup</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void startPractice()
                  .then(() => window.location.reload())
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"));
              }}
            >
              Create practice Pages
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pages"
        hint="Unlimited Pages you administer. The left rail selects the Page for Composer, Calendar, Inbox, and Analytics. Practice Pages never hit Graph."
      >
          <Button
            variant="outline"
            disabled={syncing}
            onClick={() => {
              setSyncing(true);
              void syncNowFn()
                .then((r) => {
                  toast.success(`Synced ${r.postsUpdated} posts · ${r.commentsImported} comments.`);
                  if (r.errors[0]) toast.message(r.errors[0]);
                  return reload();
                })
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Sync failed"))
                .finally(() => setSyncing(false));
            }}
          >
            {syncing ? "Syncing…" : "Sync from Facebook"}
          </Button>
          <Button asChild>
            <Link to="/composer">New post</Link>
          </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPage(p.id)}
            className={`rounded-xl bg-card p-4 text-left shadow-card transition-colors ${
              selectedPageId === p.id ? "ring-2 ring-primary" : "hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <PageAvatar id={p.id} name={p.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-[13px] text-muted-foreground">
                  {p.category ?? "Page"} · {formatFanCount(p.fan_count)} likes
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  {p.is_practice ? <span className="rounded-full bg-muted px-2 py-0.5">Practice</span> : null}
                  {p.is_read_only ? <span className="rounded-full bg-muted px-2 py-0.5">Analyze only</span> : null}
                  {p.fan_count < 100 ? (
                    <span className="rounded-full bg-muted px-2 py-0.5">Insights need 100+ likes</span>
                  ) : null}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet. Open Composer.</p>
            ) : (
              data.recentPosts.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-[12px] text-muted-foreground">{p.page_name}</div>
                    <p className="line-clamp-2 text-sm">{p.message || "(no caption)"}</p>
                    <div className="mt-1 text-[12px] text-muted-foreground tabular-nums">
                      {relativeTime(p.published_time ?? p.scheduled_publish_time ?? p.created_at)}
                      {p.status === "Published"
                        ? ` · ${p.reactions_count} reactions · ${p.comments_count} comments`
                        : null}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coming up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dueSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled posts. Local scheduler runs every 60s while the desk is open.</p>
            ) : (
              data.dueSoon.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] text-muted-foreground">{p.page_name}</div>
                    <p className="line-clamp-2 text-sm">{p.message}</p>
                    <div className="text-[12px] text-muted-foreground">{relativeTime(p.scheduled_publish_time)}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/calendar">Open calendar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
