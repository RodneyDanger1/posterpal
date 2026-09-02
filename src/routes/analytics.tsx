import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsFn, exportCsvFn } from "@/lib/posterpal/fns";
import { bestHourSlot, contentMix, dayLabel, formatSlotLabel, hourHeatmap, nextDatetimeLocal, shopLinkShare, suggestedIndustrySlot } from "@/lib/posterpal/operator";
import type { AnalyticsPoint } from "@/lib/posterpal/types";
import { useInspectorStore, useShellStore } from "@/lib/store";
import { format } from "date-fns";

export const Route = createFileRoute("/analytics")({ component: () => <Guard><Analytics /></Guard> });

function Analytics() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const openInspector = useInspectorStore((s) => s.open);
  const navigate = useNavigate();
  const [days, setDays] = useState(28);
  const [pack, setPack] = useState<{
    rows: AnalyticsPoint[];
    insightsLocked: boolean;
    fanCount: number | null;
    days: number;
  } | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadState("loading");
    setPack(null);
    void analyticsFn({ data: { pageId, days } })
      .then((next) => {
        setPack(next);
        setLoadState("ok");
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Analytics failed";
        setLoadError(msg);
        setLoadState("error");
        toast.error(msg);
      });
  }, [pageId, days]);

  const series = useMemo(() => {
    const rows = pack?.rows ?? [];
    return rows.map((r) => ({
      id: String(r.id),
      t: format(new Date(String(r.published_time ?? r.created_at)), "MMM d"),
      reactions: Number(r.reactions_count ?? 0),
      comments: Number(r.comments_count ?? 0),
      views: Number(r.media_view_unique ?? 0),
      variant: String(r.ai_variant_label ?? ""),
      groupId: String(r.variant_group_id ?? ""),
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

  const experiments = useMemo(() => {
    const byGroup = new Map<
      string,
      Map<string, { label: string; n: number; reactions: number; bestCaption: string; bestId: string; bestScore: number }>
    >();
    for (const r of series) {
      const gid = r.groupId.trim();
      const label = r.variant.trim();
      if (!gid || !label) continue;
      const inner = byGroup.get(gid) ?? new Map();
      const score = r.reactions + r.comments;
      const cur = inner.get(label) ?? {
        label,
        n: 0,
        reactions: 0,
        bestCaption: r.message,
        bestId: r.id,
        bestScore: score,
      };
      cur.n += 1;
      cur.reactions += r.reactions;
      if (score > cur.bestScore) {
        cur.bestScore = score;
        cur.bestCaption = r.message;
        cur.bestId = r.id;
      }
      inner.set(label, cur);
      byGroup.set(gid, inner);
    }
    return [...byGroup.entries()].map(([groupId, inner]) => {
      const variants = [...inner.values()].sort(
        (a, b) => b.reactions / Math.max(1, b.n) - a.reactions / Math.max(1, a.n),
      );
      return { groupId, variants, leader: variants[0] ?? null };
    });
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
        line="Heatmap and A/B are this Page only. Unique-reach Insights were deprecated June 2026 — we show media views."
        hint="Post-level reactions, comments, and media views from Graph sync (post_total_media_view / post_media_view — unique-reach metrics were deprecated June 2026). Heatmap is this Page's own hours. Insights need 100+ likes."
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
        {bestCaption?.message ? (
          <Button
            size="sm"
            title="Open Composer with the winning caption scheduled at this Page's hottest hour"
            onClick={() => {
              setPrefill({
                message: bestCaption.message,
                pageId,
                mediaType: "Text",
                when: best ? nextDatetimeLocal(best.day, best.hour) : suggestedIndustrySlot(),
              });
              void navigate({ to: "/composer" });
            }}
          >
            Schedule winner
          </Button>
        ) : null}
      </PageHeader>

      {loadState === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading this Page’s last {days} days…</p>
      ) : null}
      {loadState === "error" ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError ?? "Analytics failed."} Charts are hidden so you don’t mix this Page with the previous one.
        </div>
      ) : null}

      {pack?.insightsLocked ? (
        <div className="rounded-lg bg-warning/20 px-3 py-2 text-sm">
          Insights require 100+ likes (this Page has {pack.fanCount}). Showing post-level engagement from Graph fields that do not need the Page insights edge.
        </div>
      ) : null}

      {loadState === "ok" ? (
      <>
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
                  ? `Hottest slot: ${dayLabel(best.day)} ${String(best.hour).padStart(2, "0")}:00 · ${Math.round(best.score / Math.max(1, best.n))} avg engagement from ${best.n} post${best.n === 1 ? "" : "s"}. Click a cell to schedule there.`
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
                    <HeatRow
                      key={day}
                      day={day}
                      heat={heat}
                      max={maxHeat}
                      onPick={(d, h) => {
                        setPrefill({ message: "", pageId, when: nextDatetimeLocal(d, h) });
                        void navigate({ to: "/composer" });
                      }}
                    />
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="views" name="Media views" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="comments" name="Comments" fill="var(--color-primary)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {experiments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>A/B variant winner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Grouped by the pair you launched together. PosterPal never auto-picks a winner — you reuse the leading caption.
            </p>
            {experiments.map((ex) => (
              <div key={ex.groupId} className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-sm">
                  Leading: <strong>{ex.leader?.label ?? "—"}</strong>
                  {ex.leader
                    ? ` · ${Math.round(ex.leader.reactions / Math.max(1, ex.leader.n))} avg reactions`
                    : null}
                </p>
                <ul className="mt-1 space-y-0.5 text-[13px] text-muted-foreground">
                  {ex.variants.map((w) => (
                    <li key={w.label}>
                      {w.label}: {w.n} post{w.n === 1 ? "" : "s"}, {w.reactions} reactions
                    </li>
                  ))}
                </ul>
                {ex.leader?.bestCaption ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 min-h-11"
                    onClick={() => {
                      setPrefill({
                        message: ex.leader!.bestCaption,
                        pageId,
                        mediaType: "Text",
                        when: best ? nextDatetimeLocal(best.day, best.hour) : suggestedIndustrySlot(),
                      });
                      void navigate({ to: "/composer" });
                    }}
                  >
                    Reuse leading caption
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {(pack?.rows ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Top posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...(pack?.rows ?? [])]
              .sort(
                (a, b) =>
                  Number(b.reactions_count ?? 0) + Number(b.comments_count ?? 0) -
                  (Number(a.reactions_count ?? 0) + Number(a.comments_count ?? 0)),
              )
              .slice(0, 8)
              .map((r) => (
                <button
                  key={String(r.id)}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                  onClick={() => openInspector(String(r.id))}
                >
                  <p className="line-clamp-2 text-sm">{String(r.message ?? "(no caption)")}</p>
                  <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
                    {Number(r.reactions_count ?? 0)} · {Number(r.comments_count ?? 0)}
                  </span>
                </button>
              ))}
          </CardContent>
        </Card>
      ) : null}
      </>
      ) : null}
    </div>
  );
}

function HeatRow({
  day,
  heat,
  max,
  onPick,
}: {
  day: number;
  heat: ReturnType<typeof hourHeatmap>;
  max: number;
  onPick: (day: number, hour: number) => void;
}) {
  return (
    <>
      <div className="pr-1 text-right text-[10px] text-muted-foreground">{dayLabel(day)}</div>
      {Array.from({ length: 24 }, (_, hour) => {
        const cell = heat.find((c) => c.day === day && c.hour === hour);
        const intensity = cell ? cell.score / Math.max(1, cell.n) / max : 0;
        return (
          <button
            key={hour}
            type="button"
            title={
              cell
                ? `${formatSlotLabel(day, hour)} · ${cell.n} posts · ${Math.round(cell.score / cell.n)} avg — click to schedule`
                : `${formatSlotLabel(day, hour)} · no posts — click to schedule`
            }
            className="h-4 rounded-sm bg-primary"
            style={{ opacity: 0.08 + intensity * 0.92 }}
            onClick={() => onPick(day, hour)}
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
