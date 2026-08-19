import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hint } from "@/components/ui/tooltip";
import { calendarFn, rescheduleFn } from "@/lib/posterpal/fns";
import { nextEmptyDay, toLocalInput } from "@/lib/posterpal/desk";
import { useShellStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({ component: () => <Guard><CalendarView /></Guard> });

type CalPost = {
  id: string;
  page_id: string;
  page_name: string;
  message: string | null;
  status: string;
  media_type: string;
  scheduled_publish_time: string | null;
  published_time: string | null;
  created_at: string;
  reactions_count: number;
  comments_count: number;
  engagement_score: number;
};

function whenOf(p: CalPost) {
  return new Date(p.scheduled_publish_time ?? p.published_time ?? p.created_at);
}

function CalendarView() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState<"month" | "week" | "heat">("month");
  const [dragId, setDragId] = useState<string | null>(null);
  const [pick, setPick] = useState<{ postId: string; when: string } | null>(null);

  const load = () => {
    void calendarFn({ data: { pageId } }).then(setPosts);
  };
  useEffect(load, [pageId]);

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor, mode]);

  const heat = useMemo(() => {
    const map = new Map<string, { count: number; eng: number }>();
    for (const p of posts) {
      const key = format(whenOf(p), "yyyy-MM-dd");
      const cur = map.get(key) ?? { count: 0, eng: 0 };
      cur.count += 1;
      cur.eng += p.engagement_score || p.reactions_count + p.comments_count;
      map.set(key, cur);
    }
    return map;
  }, [posts]);

  const composeOn = (day: Date) => {
    const slot = new Date(day);
    slot.setHours(10, 0, 0, 0);
    if (slot.getTime() < Date.now() + 15 * 60 * 1000) slot.setTime(Date.now() + 15 * 60 * 1000);
    setPrefill({ message: "", pageId, when: toLocalInput(slot) });
    void navigate({ to: "/composer" });
  };

  const dropOn = (day: Date) => {
    if (!dragId) return;
    const iso = new Date(day);
    iso.setHours(10, 0, 0, 0);
    if (iso.getTime() < Date.now() + 10 * 60 * 1000) {
      iso.setTime(Date.now() + 15 * 60 * 1000);
    }
    setPick({ postId: dragId, when: toLocalInput(iso) });
    setDragId(null);
  };

  const confirmPick = () => {
    if (!pick) return;
    void rescheduleFn({ data: { postId: pick.postId, scheduledAt: new Date(pick.when).toISOString() } })
      .then((r) => {
        toast.message(r.warning ?? "Scheduled.");
        setPick(null);
        load();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not reschedule"));
  };

  const shift = (dir: -1 | 1) => {
    setCursor((d) => (mode === "week" ? addDays(d, dir * 7) : addMonths(d, dir)));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        hint="Drag a post onto a day, then pick the time. Click an empty day to open Composer at 10am. Facebook accepts 10 minutes–30 days. Outside that window the local scheduler keeps it until this desk is open."
      >
        <Hint label="Previous month or week">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>Prev</Button>
        </Hint>
        <Hint label="Jump to today">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
        </Hint>
        <Hint label="Next month or week">
          <Button variant="outline" size="sm" onClick={() => shift(1)}>Next</Button>
        </Hint>
        <Hint label="First day with no scheduled or published post">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = nextEmptyDay(posts.map((p) => whenOf(p).toISOString()));
              setCursor(d);
              toast.message(`Next empty day is ${format(d, "EEE MMM d")}.`);
            }}
          >
            Next empty day
          </Button>
        </Hint>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList>
            <TabsTrigger value="month" title="Full month grid">Month</TabsTrigger>
            <TabsTrigger value="week" title="Seven days, larger drop targets">Week</TabsTrigger>
            <TabsTrigger value="heat" title="Last 120 days of posting cadence — darker means more posts that day">Heatmap</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <p className="text-[12px] text-muted-foreground">
        {format(cursor, mode === "week" ? "'Week of' MMM d, yyyy" : "MMMM yyyy")}
        {" · "}
        <span className="text-primary">FacebookScheduled</span>
        {" · LocalScheduled · Published"}
      </p>

      {mode === "heat" ? (
        <Heatmap posts={posts} heat={heat} />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card shadow-card">
          <div className="grid grid-cols-7 border-b border-border text-center text-[12px] font-semibold text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const items = posts.filter((p) => isSameDay(whenOf(p), day));
              const heatVal = heat.get(format(day, "yyyy-MM-dd"));
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(day)}
                  onDoubleClick={() => {
                    if (items.length === 0) composeOn(day);
                  }}
                  className={cn(
                    "min-h-28 border-b border-r border-border p-1.5",
                    day.getMonth() !== cursor.getMonth() && mode === "month" ? "bg-muted/40" : "",
                    isSameDay(day, new Date()) ? "bg-accent/40" : "",
                  )}
                >
                  <div className="flex items-center justify-between text-[12px] tabular-nums">
                    <span>{format(day, "d")}</span>
                    {heatVal ? <span className="text-muted-foreground">{heatVal.count}</span> : (
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline"
                        onClick={() => composeOn(day)}
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {items.map((p) => (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => setDragId(p.id)}
                        title={`${p.status} · ${p.media_type} · ${format(whenOf(p), "h:mm a")}`}
                        className="cursor-grab rounded-md bg-chip px-1.5 py-1 text-[11px] leading-tight"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-medium">{p.page_name}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="tabular-nums text-muted-foreground">{format(whenOf(p), "h:mm a")}</div>
                        <div className="line-clamp-2 text-muted-foreground">{p.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={Boolean(pick)} onOpenChange={(open) => { if (!open) setPick(null); }}>
        <DialogContent>
          <DialogTitle>Set publish time</DialogTitle>
          <DialogDescription>
            Facebook Graph only accepts 10 minutes to 30 days from now. Anything else stays on the local scheduler and goes out when this desk is open.
          </DialogDescription>
          <Input
            type="datetime-local"
            className="mt-3"
            value={pick?.when ?? ""}
            onChange={(e) => setPick((p) => (p ? { ...p, when: e.target.value } : p))}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPick(null)}>Cancel</Button>
            <Button onClick={confirmPick}>Schedule</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Heatmap({ posts, heat }: { posts: CalPost[]; heat: Map<string, { count: number; eng: number }> }) {
  const end = new Date();
  const start = addDays(end, -119);
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const max = Math.max(1, ...[...heat.values()].map((v) => v.count));
  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <div className="text-[13px] text-muted-foreground">{posts.length} posts · last 120 days</div>
      <div className="mt-3 flex flex-wrap gap-1">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const v = heat.get(key);
          const t = v ? v.count / max : 0;
          return (
            <div
              key={key}
              title={`${key}: ${v?.count ?? 0} posts, ${Math.round(v?.eng ?? 0)} engagement`}
              className="size-3.5 rounded-sm"
              style={{ background: t === 0 ? "var(--color-muted)" : `color-mix(in oklab, var(--color-primary) ${Math.round(30 + t * 70)}%, var(--color-muted))` }}
            />
          );
        })}
      </div>
    </div>
  );
}
