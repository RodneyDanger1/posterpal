import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { commentsFn, generateReplyDraftsFn, hideCommentFn, sendReplyFn, syncNowFn } from "@/lib/posterpal/fns";
import type { CommentRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/inbox")({ component: () => <Guard><Inbox /></Guard> });

function Inbox() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const [filter, setFilter] = useState<"needs" | "hidden" | "all">("needs");
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [active, setActive] = useState<CommentRow | null>(null);
  const [draft, setDraft] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = () => {
    void commentsFn({ data: { filter, pageId } }).then((list) => {
      setRows(list);
      setActive((cur) => list.find((c) => c.id === cur?.id) ?? list[0] ?? null);
    });
  };
  useEffect(load, [filter, pageId]);

  useEffect(() => {
    if (!active) {
      setDraft("");
      return;
    }
    const parsed = active.reply_drafts_json ? (JSON.parse(active.reply_drafts_json) as string[]) : [];
    setDraft(parsed[0] ?? "");
  }, [active?.id]);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <PageHeader
            title="Inbox"
            hint="AI may draft replies. A human must click Send. PosterPal never auto-likes, auto-follows, or auto-posts comments. Pull from Facebook imports live comments on posts this desk knows about."
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
            <TabsTrigger value="hidden" title="Comments you hid on Graph (is_hidden=true)">Hidden</TabsTrigger>
            <TabsTrigger value="all" title="Every imported comment for the selected Page">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <ul className="mt-3 space-y-1">
          {rows.length === 0 ? (
            <li className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">Inbox zero for this filter.</li>
          ) : (
            rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActive(c)}
                  className={`w-full rounded-lg px-3 py-2 text-left ${active?.id === c.id ? "bg-accent" : "bg-card hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">{c.author_name ?? "Visitor"}</span>
                    <span className="text-[11px] text-muted-foreground">{relativeTime(c.created_at)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm">{c.message}</p>
                  <div className="mt-1 flex gap-1">
                    {c.sentiment ? <Badge variant="muted">{c.sentiment}</Badge> : null}
                    {c.needs_reply ? <Badge variant="warning">Needs reply</Badge> : null}
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
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {(active.reply_drafts_json ? (JSON.parse(active.reply_drafts_json) as string[]) : []).map((d, i) => (
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
                  void hideCommentFn({ data: { commentId: active.id, hidden: !active.is_hidden } }).then(load);
                }}
              >
                {active.is_hidden ? "Unhide" : "Hide"}
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
