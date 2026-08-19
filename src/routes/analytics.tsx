import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsFn, exportCsvFn } from "@/lib/posterpal/fns";
import type { AnalyticsPoint } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { format } from "date-fns";

export const Route = createFileRoute("/analytics")({ component: () => <Guard><Analytics /></Guard> });

function Analytics() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const navigate = useNavigate();
  const [days, setDays] = useState(28);
  const [pack, setPack] = useState<{
    rows: AnalyticsPoint[];
    insightsLocked: boolean;
    fanCount: number | null;
    days: number;
  } | null>(null);

  useEffect(() => {
    void analyticsFn({ data: { pageId, days } }).then(setPack);
  }, [pageId, days]);

  const series = useMemo(() => {
    const rows = pack?.rows ?? [];
    return rows.map((r) => ({
      t: format(new Date(String(r.published_time ?? r.created_at)), "MMM d"),
      reactions: Number(r.reactions_count ?? 0),
      comments: Number(r.comments_count ?? 0),
      views: Number(r.media_view_unique ?? 0),
      variant: String(r.ai_variant_label ?? ""),
      message: String(r.message ?? ""),
    }));
  }, [pack]);

  const totals = series.reduce(
    (a, r) => ({
      reactions: a.reactions + r.reactions,
      comments: a.comments + r.comments,
      views: a.views + r.views,
    }),
    { reactions: 0, comments: 0, views: 0 },
  );

  const winners = useMemo(() => {
    const groups = new Map<string, { label: string; n: number; reactions: number }>();
    for (const r of series) {
      if (!r.variant) continue;
      const g = groups.get(r.variant) ?? { label: r.variant, n: 0, reactions: 0 };
      g.n += 1;
      g.reactions += r.reactions;
      groups.set(r.variant, g);
    }
    return [...groups.values()].sort((a, b) => b.reactions / Math.max(1, b.n) - a.reactions / Math.max(1, a.n));
  }, [series]);

  const best = useMemo(() => {
    return [...series].sort((a, b) => b.reactions + b.comments - (a.reactions + a.comments))[0] ?? null;
  }, [series]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        hint="Post-level reactions, comments, and media views from Graph sync. Page Insights metrics (impressions) need 100+ likes. A/B winners compare AI variant labels."
      >
        {[7, 28, 90].map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} title={`${d}-day window`} onClick={() => setDays(d)}>
            {d}d
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          title="Download the visible window as CSV"
          onClick={() => {
            void exportCsvFn({ data: { pageId, days } }).then((csv) => {
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "posterpal-analytics.csv";
              a.click();
            });
          }}
        >
          Export CSV
        </Button>
        {best?.message ? (
          <Button
            size="sm"
            variant="outline"
            title="Open Composer with the highest-engagement caption from this window"
            onClick={() => {
              setPrefill({ message: best.message, pageId, mediaType: "Text" });
              void navigate({ to: "/composer" });
            }}
          >
            Reuse top caption
          </Button>
        ) : null}
      </PageHeader>

      {pack?.insightsLocked ? (
        <div className="rounded-lg bg-warning/20 px-3 py-2 text-sm">
          Insights require 100+ likes (this Page has {pack.fanCount}). Showing post-level engagement from Graph fields that do not need the Page insights edge.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Reactions" value={totals.reactions} />
        <Stat label="Comments" value={totals.comments} />
        <Stat label="Media views" value={totals.views} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Media views & reactions</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="views" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="reactions" stroke="var(--color-success)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="comments" fill="var(--color-primary)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {winners.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>A/B variant winner</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Leading variant: <strong>{winners[0]?.label}</strong> ({Math.round((winners[0]?.reactions ?? 0) / Math.max(1, winners[0]?.n ?? 1))} avg reactions).
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {winners.map((w) => (
                <li key={w.label}>
                  {w.label}: {w.n} posts, {w.reactions} reactions
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
