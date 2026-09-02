import { Link } from "@tanstack/react-router";
import { mixAdvice, type Collision } from "@/lib/posterpal/briefing";
import { formatSlotLabel, hourHeatmap, topSlots } from "@/lib/posterpal/operator";
import type { HomeSnapshot, PageRow } from "@/lib/posterpal/types";
import { useInspectorStore, useShellStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function FleetPulse({
  data,
  selected,
}: {
  data: HomeSnapshot;
  selected: PageRow | undefined;
}) {
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const openInspector = useInspectorStore((s) => s.open);
  const pm = selected ? data.pageMetrics[selected.id] : undefined;
  const pagePosts = selected
    ? data.recentPosts.filter((p) => p.page_id === selected.id)
    : data.recentPosts;
  const heat = hourHeatmap(pagePosts, data.settings.timezone);
  const slots = topSlots(heat, 3);
  const silent = data.pages.filter((p) => {
    const m = data.pageMetrics[p.id];
    if (!m) return false;
    if (m.nextScheduledAt) return false;
    if (!m.lastPublishedAt) return !p.is_practice;
    const t = new Date(m.lastPublishedAt).getTime();
    return Number.isFinite(t) && Date.now() - t > 7 * 86_400_000;
  });
  const collisions: Collision[] = data.collisions ?? [];
  const due = [...(data.dueSoon ?? [])]
    .sort(
      (a, b) =>
        new Date(a.scheduled_publish_time ?? 0).getTime() - new Date(b.scheduled_publish_time ?? 0).getTime(),
    )
    .slice(0, 6);
  const mix = selected ? (pm?.mix ?? data.mix) : data.mix;
  const mixTotal = Object.values(mix ?? {}).reduce((a, n) => a + Number(n ?? 0), 0);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>This week{selected ? ` · ${selected.name}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[13px] text-muted-foreground">{mixAdvice(mix ?? {})}</p>
          {mixTotal > 0 ? (
            <ul className="flex flex-wrap gap-1.5 text-[11px]">
              {Object.entries(mix ?? {})
                .filter(([, n]) => Number(n) > 0)
                .map(([k, n]) => (
                  <li key={k} className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                    {k} {n}
                  </li>
                ))}
            </ul>
          ) : null}
          {slots.length > 0 ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Hours this Page actually earned
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <span
                    key={`${s.day}-${s.hour}`}
                    className="rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-foreground"
                  >
                    {formatSlotLabel(s.day, s.hour)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No published hours yet on {selected?.name ?? "this Page"}. After a few live posts this card fills in from Graph sync — not a generic blog chart.
            </p>
          )}
          {silent.length > 0 ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Quiet Pages (7+ days, nothing queued)
              </div>
              <ul className="mt-1 space-y-1">
                {silent.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setPage(p.id)}
                    >
                      {p.name}
                      {p.is_practice ? " · practice" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Every Page has a recent live post or a queued slot.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming queue</CardTitle>
        </CardHeader>
        <CardContent>
          {due.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled. Open Composer and pick a time 10 minutes–30 days out, or park it locally. The desk ticker fires LocalScheduled while PosterPal.exe is open.
            </p>
          ) : (
            <ul className="space-y-2">
              {due.map((p) => (
                <li key={p.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                  <button type="button" className="w-full text-left hover:bg-muted/40" onClick={() => openInspector(p.id)}>
                    <div className="text-[12px] text-muted-foreground">{p.page_name}</div>
                    <p className="line-clamp-2 text-sm">{p.message || "(no caption)"}</p>
                    <div className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                      {p.scheduled_publish_time
                        ? new Date(p.scheduled_publish_time).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                      {p.status === "LocalScheduled" ? " · local ticker" : " · Facebook"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-3 min-h-11">
            <Link to="/drafts">Open queue</Link>
          </Button>
        </CardContent>
      </Card>
      {collisions.length > 0 ? (
        <Card className="border-warning/40 lg:col-span-2">
          <CardHeader>
            <CardTitle>Cross-Page overlap</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-[13px] text-muted-foreground">
              Meta treats identical copy across Pages as inauthentic. Rewrite before you publish.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[13px]">
              {collisions.slice(0, 5).map((c, i) => (
                <li key={`${c.pageA}-${c.pageB}-${i}`}>
                  <span className="font-medium">{c.pageA}</span> ↔ <span className="font-medium">{c.pageB}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {(c.score * 100).toFixed(0)}% · “{c.excerpt}”
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-3 min-h-11">
              <Link to="/drafts">Rewrite in Drafts</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
