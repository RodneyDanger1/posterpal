import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsFn, exportCsvFn } from "@/lib/posterpal/fns";
import { bestHourSlot, contentMix, dayLabel, hourHeatmap, shopLinkShare } from "@/lib/posterpal/operator";
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
    void analyticsFn({ data: { pageId, days } })
      .then(setPack)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Analytics failed"));
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

  const bestCaption = useMemo(() => {
    return [...series].sort((a, b) => b.reactions + b.comments - (a.reactions + a.comments))[0] ?? null;
  }, [series]);
  const heat = useMemo(() => hourHeatmap(pack?.rows ?? []), [pack]);
  const best = bestHourSlot(heat);
  const maxHeat = Math.max(1, ...heat.map((c) => c.score / Math.max(1, c.n)));
  const mix = useMemo(() => contentMix(pack?.rows ?? []), [pack]);
  const shop = useMemo(() => shopLinkShare(pack?.rows ?? []), [pack]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        hint="Post-level reactions, comments, and media views from Graph sync. The heatmap is this Page's own hours — not a generic blog tip. Insights metrics need 100+ likes. A/B winners compare AI variant labels."
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
            void exportCsvFn({ data: { pageId, days } })
              .then((csv) => {
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "posterpal-analytics.csv";
              a.click();
            })
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Export failed"));
          }}
        >
          Export CSV
        </Button>
        {bestCaption?.message ? (
          <Button
            size="sm"
            variant="outline"
            title="Open Composer with the highest-engagement caption from this window"
            onClick={() => {
              setPrefill({ message: bestCaption.message, pageId, mediaType: "Text" });
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
          <CardTitle>This Page's best hours</CardTitle>
        </CardHeader>
        <CardContent>
          {heat.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not enough published posts yet. Until then, Sprout's 2026 Facebook peak is Tuesday–Wednesday 12–8pm local — Composer has a Suggested hour button.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {best
                  ? `Hottest slot: ${dayLabel(best.day)} ${String(best.hour).padStart(2, "0")}:00 · ${Math.round(best.score / Math.max(1, best.n))} avg engagement from ${best.n} post${best.n === 1 ? "" : "s"}.`
                  : "No peak yet."}
              </p>
              <div className="overflow-x-auto">
                <div className="grid min-w-[520px] grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-0.5">
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="text-center text-[9px] text-muted-foreground">
                      {h}
                    </div>
                  ))}
                  {Array.from({ length: 7 }, (_, day) => (
                    <HeatRow key={day} day={day} heat={heat} max={maxHeat} />
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Content mix</CardTitle>
          </CardHeader>
          <CardContent>
            {mix.total === 0 ? (
              <p className="text-sm text-muted-foreground">No published posts in this window.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {Object.entries(mix.counts).map(([k, n]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {n} · {Math.round((n / mix.total) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[12px] text-muted-foreground">
              {mix.diversity < 3
                ? "Mix Reels, photos, and text. One format stalls reach and Content Monetization eligibility."
                : `${mix.diversity} formats — healthy mix for a Page trying to monetize.`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shop-link posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {shop.withLink}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ {shop.total}</span>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Posts with a URL or merch hint. Pair with a first-comment shop link and a branded-content disclosure — don't stuff every caption.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Media views & reactions</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {series.length === 0 ? (
            <p className="grid h-full place-items-center text-sm text-muted-foreground">
              No published posts in this window for the selected Page.
            </p>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="views" name="Views" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="reactions" name="Reactions" stroke="var(--color-success)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="h-52">
          {series.length === 0 ? (
            <p className="grid h-full place-items-center text-sm text-muted-foreground">No comments in this window.</p>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="comments" name="Comments" fill="var(--color-primary)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
          )}
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

function HeatRow({ day, heat, max }: { day: number; heat: ReturnType<typeof hourHeatmap>; max: number }) {
  return (
    <>
      <div className="pr-1 text-right text-[10px] text-muted-foreground">{dayLabel(day)}</div>
      {Array.from({ length: 24 }, (_, hour) => {
        const cell = heat.find((c) => c.day === day && c.hour === hour);
        const intensity = cell ? cell.score / Math.max(1, cell.n) / max : 0;
        return (
          <div
            key={hour}
            title={
              cell
                ? `${dayLabel(day)} ${hour}:00 · ${cell.n} posts · ${Math.round(cell.score / cell.n)} avg`
                : `${dayLabel(day)} ${hour}:00 · no posts`
            }
            className="h-4 rounded-sm bg-primary"
            style={{ opacity: 0.08 + intensity * 0.92 }}
          />
        );
      })}
    </>
  );
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] shadow-lift">
      <div className="font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.name}>
          {p.name}: {Number(p.value ?? 0).toLocaleString()}
        </div>
      ))}
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
