import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { inGoldenHour, isBuyingIntent } from "@/lib/posterpal/operator";
import { commentsFn, generateReplyDraftsFn, hideCommentFn, markCommentHandledFn, sendReplyFn, syncNowFn } from "@/lib/posterpal/fns";
import type { CommentRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { relativeTime, copyText } from "@/lib/utils";

export const Route = createFileRoute("/inbox")({ component: () => <Guard><Inbox /></Guard> });

function draftsOf(c: CommentRow): string[] {
  try {
    const parsed = c.reply_drafts_json ? (JSON.parse(c.reply_drafts_json) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function Inbox() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const [filter, setFilter] = useState<"needs" | "hidden" | "all" | "intent">("needs");
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [active, setActive] = useState<CommentRow | null>(null);
  const [draft, setDraft] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [phoneDetail, setPhoneDetail] = useState(false);

  const load = () => {
    const serverFilter = filter === "intent" ? "all" : filter;
    void commentsFn({ data: { filter: serverFilter, pageId } })
      .then((list) => {
      const next = filter === "intent" ? list.filter((c) => isBuyingIntent(c.message)) : list;
      setRows(next);
      setActive((cur) => next.find((c) => c.id === cur?.id) ?? next[0] ?? null);
    })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load inbox"));
  };
  useEffect(load, [filter, pageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActive((cur) => {
          const i = rows.findIndex((c) => c.id === cur?.id);
          return rows[Math.min(rows.length - 1, i + 1)] ?? cur;
        });
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((cur) => {
          const i = rows.findIndex((c) => c.id === cur?.id);
          return rows[Math.max(0, i - 1)] ?? cur;
        });
      }
      if (e.key === "e" && active) {
        void markCommentHandledFn({ data: { commentId: active.id } })
          .then(load)
          .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not mark handled"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, active?.id, filter, pageId]);

  useEffect(() => {
    if (!active) {
      setDraft("");
      return;
    }
    setDraft(draftsOf(active)[0] ?? "");
  }, [active?.id]);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className={phoneDetail ? "hidden lg:block" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <PageHeader
            title="Inbox"
            hint="AI may draft replies. A human must click Send. PosterPal never auto-likes, auto-follows, or auto-posts comments. j/k moves the list. e marks handled without a Graph reply."
          />
          <Button
            size="sm"
            variant="outline"
            disabled={syncing}
            onClick={() => {
              setSyncing(true);
              void syncNowFn()
                .then((r) => {
                  toast.success(`Pulled ${r.commentsImported} new comments, updated ${r.postsUpdated} posts.`);
                  if (r.errors[0]) toast.message(r.errors[0]);
                  load();
                })
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Sync failed"))
                .finally(() => setSyncing(false));
            }}
          >
            {syncing ? "Pulling…" : "Pull from Facebook"}
          </Button>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="needs" title="Comments that still need a human reply">Needs reply</TabsTrigger>
            <TabsTrigger value="intent" title="Local filter for price, shop, size, and order questions">Buying intent</TabsTrigger>
            <TabsTrigger value="hidden" title="Comments you hid on Graph (is_hidden=true)">Hidden</TabsTrigger>
            <TabsTrigger value="all" title="Every imported comment for the selected Page">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <ul className="mt-3 space-y-1">
          {rows.length === 0 ? (
            <li className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">Inbox zero for this filter on the selected Page.</li>
          ) : (
            rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(c);
                    setPhoneDetail(true);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left ${active?.id === c.id ? "bg-accent" : "bg-card hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">{c.author_name ?? "Visitor"}</span>
                    <span className="text-[11px] text-muted-foreground">{relativeTime(c.created_at)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{c.page_name}</div>
                  <p className="line-clamp-2 text-sm">{c.message}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.sentiment ? <Badge variant="muted">{c.sentiment}</Badge> : null}
                    {c.needs_reply ? <Badge variant="warning">Needs reply</Badge> : null}
                    {isBuyingIntent(c.message) ? <Badge variant="success">Intent</Badge> : null}
                    {inGoldenHour(c.created_at) ? <Badge variant="danger">60-min</Badge> : null}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {active ? (
        <article className={`rounded-xl bg-card p-4 shadow-card ${phoneDetail ? "" : "hidden lg:block"}`}>
          <Button
            size="sm"
            variant="outline"
            className="mb-3 lg:hidden"
            onClick={() => setPhoneDetail(false)}
          >
            Back to list
          </Button>
          <div className="text-[12px] text-muted-foreground">
            {active.page_name} · on “{active.post_message?.slice(0, 80)}”
          </div>
          <h2 className="mt-1 font-semibold">{active.author_name}</h2>
          <p className="mt-2 text-[15px]">{active.message}</p>
          {isBuyingIntent(active.message) ? (
            <p className="mt-2 rounded-md bg-success/10 px-3 py-2 text-[13px]">
              Sounds like a shop question. Answer price, size, or link here — then drop the UTM merch URL if you have one. Do not auto-DM.
            </p>
          ) : null}
          {inGoldenHour(active.created_at) ? (
            <p className="mt-2 rounded-md bg-warning/20 px-3 py-2 text-[13px]">
              Still inside the first hour. A human reply now tells the ranking system the post is fresh.
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {draftsOf(active).map((d, i) => (
                <button
                  key={i}
                  type="button"
                  className="max-w-full rounded-lg border border-border px-3 py-2 text-left text-[13px] hover:bg-muted"
                  onClick={() => setDraft(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-28" />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  void sendReplyFn({ data: { commentId: active.id, message: draft } })
                    .then(() => {
                      toast.success("Reply sent by you — not by a bot.");
                      load();
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Send failed"));
                }}
                disabled={!draft.trim()}
              >
                Send
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void generateReplyDraftsFn({ data: { commentId: active.id } })
                    .then((r) => {
                      setDraft(r.drafts[0] ?? "");
                      setActive({ ...active, reply_drafts_json: JSON.stringify(r.drafts) });
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Drafts failed"));
                }}
              >
                3 drafts
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void hideCommentFn({ data: { commentId: active.id, hidden: !active.is_hidden } })
                    .then(load)
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Hide failed"));
                }}
              >
                {active.is_hidden ? "Unhide" : "Hide"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void markCommentHandledFn({ data: { commentId: active.id } })
                    .then(() => {
                      toast.success("Marked handled. Nothing sent to Facebook.");
                      load();
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not mark handled"));
                }}
              >
                Mark handled
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void copyText(active.message).then((ok) =>
                    toast[ok ? "success" : "error"](ok ? "Comment copied." : "Could not copy."),
                  );
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </article>
      ) : (
        <div className="hidden rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-card lg:block">Select a comment.</div>
      )}
    </div>
  );
}
