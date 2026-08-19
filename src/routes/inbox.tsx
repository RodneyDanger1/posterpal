import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { commentsFn, generateReplyDraftsFn, hideCommentFn, sendReplyFn, syncNowFn } from "@/lib/posterpal/fns";
import { markCommentHandledFn } from "@/lib/posterpal/fns-handled";
import { isBuyingIntent, isStaleComment } from "@/lib/posterpal/desk";
import type { CommentRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { copyText, relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/inbox")({
  component: () => (
    <Guard>
      <Inbox />
    </Guard>
  ),
});

function draftsOf(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function Inbox() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const [filter, setFilter] = useState<"needs" | "hidden" | "all">("needs");
  const [buyingOnly, setBuyingOnly] = useState(false);
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [active, setActive] = useState<CommentRow | null>(null);
  const [draft, setDraft] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = () => {
    void commentsFn({ data: { filter, pageId } })
      .then((list) => {
        setRows(list);
        setActive((cur) => list.find((c) => c.id === cur?.id) ?? list[0] ?? null);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load inbox"));
  };
  useEffect(load, [filter, pageId]);

  useEffect(() => {
    if (!active) {
      setDraft("");
      return;
    }
    setDraft(draftsOf(active.reply_drafts_json)[0] ?? "");
  }, [active?.id]);

  const visible = useMemo(
    () => (buyingOnly ? rows.filter((c) => isBuyingIntent(c.message)) : rows),
    [rows, buyingOnly],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key !== "j" && e.key !== "k") return;
      e.preventDefault();
      setActive((cur) => {
        if (visible.length === 0) return cur;
        const i = Math.max(0, visible.findIndex((c) => c.id === cur?.id));
        const next = e.key === "j" ? Math.min(visible.length - 1, i + 1) : Math.max(0, i - 1);
        return visible[next] ?? cur;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const buyCount = rows.filter((c) => isBuyingIntent(c.message)).length;
  const staleCount = rows.filter((c) => c.needs_reply && isStaleComment(c.created_at)).length;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <PageHeader
            title="Inbox"
            line="AI may draft. You click Send — nothing auto-comments."
            hint="j/k moves the list. Mark handled clears the queue without a Graph reply. Pull from Facebook imports live comments on posts this desk knows about."
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
        {buyCount > 0 || staleCount > 0 ? (
          <p className="mb-2 text-[12px] text-muted-foreground">
            {buyCount > 0 ? `${buyCount} look like buying questions. ` : ""}
            {staleCount > 0 ? `${staleCount} waiting more than a day.` : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="needs" title="Comments that still need a human reply">
                Needs reply
              </TabsTrigger>
              <TabsTrigger value="hidden" title="Comments you hid on Graph (is_hidden=true)">
                Hidden
              </TabsTrigger>
              <TabsTrigger value="all" title="Every imported comment for the selected Page">
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            variant={buyingOnly ? "default" : "outline"}
            onClick={() => setBuyingOnly((v) => !v)}
            title="Show only comments that look like shop questions"
          >
            Buying only
          </Button>
        </div>
        <ul className="mt-3 space-y-1">
          {visible.length === 0 ? (
            <li className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">Inbox zero for this filter.</li>
          ) : (
            visible.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActive(c)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors duration-150 ${active?.id === c.id ? "bg-accent" : "bg-card hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">{c.author_name ?? "Visitor"}</span>
                    <span className="text-[11px] text-muted-foreground">{relativeTime(c.created_at)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm">{c.message}</p>
                  <div className="mt-1 flex gap-1">
                    {c.sentiment ? <Badge variant="muted">{c.sentiment}</Badge> : null}
                    {c.needs_reply ? <Badge variant="warning">Needs reply</Badge> : null}
                    {isBuyingIntent(c.message) ? <Badge variant="warning">Buying?</Badge> : null}
                    {c.needs_reply && isStaleComment(c.created_at) ? <Badge variant="danger">24h+</Badge> : null}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {active ? (
        <article className="rounded-xl bg-card p-4 shadow-card">
          <div className="text-[12px] text-muted-foreground">
            {active.page_name} · on “{active.post_message?.slice(0, 80)}”
          </div>
          <h2 className="mt-1 font-semibold">{active.author_name}</h2>
          <p className="mt-2 text-[15px]">{active.message}</p>
          {isBuyingIntent(active.message) ? (
            <p className="mt-2 rounded-md bg-warning/20 px-2 py-1 text-[12px]">
              Sounds like a shop question. A merch link in the reply often closes it.
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {draftsOf(active.reply_drafts_json).map((d, i) => (
                <button
                  key={i}
                  type="button"
                  className="max-w-full rounded-lg border border-border px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-muted"
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
              {active.needs_reply ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    void markCommentHandledFn({ data: { commentId: active.id } })
                      .then(() => {
                        toast.success("Marked handled. No reply sent.");
                        load();
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"));
                  }}
                >
                  Mark handled
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void copyText(active.message).then((ok) =>
                    toast[ok ? "message" : "error"](ok ? "Comment copied." : "Could not copy."),
                  );
                }}
              >
                Copy comment
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!draft.trim()}
                onClick={() => {
                  void copyText(draft).then((ok) =>
                    toast[ok ? "message" : "error"](ok ? "Reply copied." : "Could not copy."),
                  );
                }}
              >
                Copy reply
              </Button>
            </div>
          </div>
        </article>
      ) : (
        <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-card">Select a comment.</div>
      )}
    </div>
  );
}
