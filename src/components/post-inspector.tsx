import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { PageAvatar } from "@/components/page-avatar";
import {
  cancelPostFn,
  clonePostFn,
  deletePublishedFn,
  duplicateNextWeekFn,
  getPostBundle,
  listPagesFn,
  publishNowFn,
  restoreCancelledFn,
} from "@/lib/posterpal/fns";
import { facebookPermalink, isRemixDraft } from "@/lib/posterpal/briefing";
import { publishToast, toLocalInput } from "@/lib/posterpal/operator";
import type { CommentRow, ContentItemRow, PageRow, PostRow } from "@/lib/posterpal/types";
import { useAgentBriefStore, useInspectorStore, useShellStore } from "@/lib/store";
import { copyText, relativeTime } from "@/lib/utils";

export function PostInspector() {
  const postId = useInspectorStore((s) => s.postId);
  const closeInspector = useInspectorStore((s) => s.close);
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<{
    post: PostRow;
    media: ContentItemRow[];
    comments: CommentRow[];
  } | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [cloneIds, setCloneIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!postId) {
      setBundle(null);
      setCloneIds([]);
      return;
    }
    let cancelled = false;
    void getPostBundle({ data: { postId } })
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not open post"));
    void listPagesFn()
      .then((list) => {
        if (!cancelled) setPages(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const post = bundle?.post;
  const media = bundle?.media ?? [];
  const comments = bundle?.comments ?? [];
  const otherPages = pages.filter((p) => p.id !== post?.page_id);

  return (
    <Dialog open={Boolean(postId)} onOpenChange={(open) => { if (!open) closeInspector(); }}>
      <DialogContent className="w-[min(720px,calc(100vw-24px))] max-h-[88vh] overflow-auto" data-testid="post-inspector">
        <DialogTitle>Post</DialogTitle>
        <DialogDescription>
          Inspect media, comments, and engagement. Clone to other Pages as local drafts — you still click Publish.
        </DialogDescription>
        {!post ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <PageAvatar
                  id={post.page_id}
                  name={post.page_name ?? "Page"}
                  pictureUrl={pages.find((p) => p.id === post.page_id)?.picture_url}
                  size={36}
                />
                <div className="min-w-0">
                  <div className="font-semibold">{post.page_name}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {post.media_type} · {relativeTime(post.published_time ?? post.scheduled_publish_time ?? post.created_at)}
                  </div>
                </div>
              </div>
              <StatusBadge status={post.status} />
            </div>
            <p className="whitespace-pre-wrap text-[15px]">{post.message || "(no caption)"}</p>
            {isRemixDraft(post.message) ? (
              <p className="rounded-md bg-warning/20 px-3 py-2 text-[13px]">
                Rewrite this caption in this Page&apos;s voice before sending. Policy blocks the marker text from going live.
              </p>
            ) : null}
            {post.link ? (
              <a href={post.link} className="block truncate text-[13px] text-primary hover:underline" target="_blank" rel="noreferrer">
                {post.link}
              </a>
            ) : null}
            {post.error_message ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{post.error_message}</p> : null}
            {media.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {media.map((m) =>
                  m.data_url && (m.data_url.startsWith("data:image") || m.data_url.startsWith("http")) ? (
                    <img key={m.id} src={m.data_url} alt={m.alt_text ?? m.file_name} className="size-20 rounded-md object-cover" />
                  ) : (
                    <div key={m.id} className="grid size-20 place-items-center rounded-md bg-muted text-[11px] text-muted-foreground">
                      {m.media_kind}
                    </div>
                  ),
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 text-[13px] text-muted-foreground tabular-nums">
              <span>{post.reactions_count} reactions</span>
              <span>{post.comments_count} comments</span>
              <span>{post.shares_count} shares</span>
              {post.media_view_unique != null ? <span>{post.media_view_unique} views</span> : null}
            </div>
            {comments.length > 0 ? (
              <div>
                <h3 className="text-[13px] font-semibold">Comments</h3>
                <ul className="mt-2 space-y-2">
                  {comments.slice(0, 8).map((c) => (
                    <li key={c.id} className="rounded-lg bg-muted/60 px-3 py-2">
                      <div className="text-[12px] font-semibold">
                        {c.author_name ?? "Visitor"}
                        {c.needs_reply ? <span className="ml-2 font-normal text-warning">needs reply</span> : null}
                      </div>
                      <p className="text-[13px]">{c.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {post.status === "Cancelled" ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void restoreCancelledFn({ data: { postId: post.id } })
                    .then(() => {
                      toast.success("Restored as a local draft.");
                      closeInspector();
                      void navigate({ to: "/drafts" });
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not restore"))
                    .finally(() => setBusy(false));
                }}
              >
                Restore draft
              </Button>
            ) : null}
            {post.status === "Published" || post.status === "LocalScheduled" || post.status === "FacebookScheduled" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void duplicateNextWeekFn({ data: { postId: post.id } })
                    .then((r) => {
                      toast.success(`Queued for next week. ${r.warning ?? ""}`);
                      closeInspector();
                      void navigate({ to: "/drafts" });
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not duplicate"))
                    .finally(() => setBusy(false));
                }}
              >
                Duplicate next week
              </Button>
            ) : null}
            {post.status === "Published" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void clonePostFn({ data: { postId: post.id, pageIds: [post.page_id], mode: "local-draft" } })
                    .then((r) => {
                      toast.success(`Remix draft saved. ${r.warning ?? "Rewrite before sending."}`);
                      closeInspector();
                      void navigate({ to: "/drafts" });
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not reshare"))
                    .finally(() => setBusy(false));
                }}
              >
                Reshare as remix draft
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (post.page_id) setPage(post.page_id);
                useAgentBriefStore.getState().queue(
                  post.status === "Failed"
                    ? `Fix failed publish on ${post.page_name ?? "this Page"}: ${post.error_message ?? "unknown error"}. Rewrite: “${(post.message ?? "").slice(0, 280)}”. Do not publish.`
                    : `Rewrite this caption in this Page's voice: “${(post.message ?? "").slice(0, 280)}”. Do not publish.`,
                  post.status === "Failed" ? "rewrite" : "research",
                );
                closeInspector();
                void navigate({ to: "/agent" });
              }}
            >
              Ask agent
            </Button>

            {otherPages.length > 0 ? (
              <div>
                <h3 className="text-[13px] font-semibold">Clone to other Pages</h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Creates a rewrite-marked local draft on each selected Page. Nothing is posted until you click Publish.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {otherPages.map((p) => {
                    const on = cloneIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-[13px]">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setCloneIds((cur) => (on ? cur.filter((id) => id !== p.id) : [...cur, p.id]))
                          }
                        />
                        {p.name}
                      </label>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={busy || cloneIds.length === 0}
                  onClick={() => {
                    setBusy(true);
                    void clonePostFn({ data: { postId: post.id, pageIds: cloneIds, mode: "local-draft" } })
                      .then((r) => {
                        toast.success(`Saved ${r.cloned} local draft${r.cloned === 1 ? "" : "s"}.${r.warning ? ` ${r.warning}` : ""}`);
                        setCloneIds([]);
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Clone failed"))
                      .finally(() => setBusy(false));
                  }}
                >
                  Clone as drafts
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setPage(post.page_id);
                  setPrefill({
                    message: post.message ?? "",
                    pageId: post.page_id,
                    mediaType: post.media_type,
                    link: post.link ?? undefined,
                    when: post.scheduled_publish_time ? toLocalInput(new Date(post.scheduled_publish_time)) : undefined,
                    media: media
                      .filter((m) => m.data_url)
                      .map((m) => ({
                        fileName: m.file_name,
                        mimeType: m.mime_type ?? "application/octet-stream",
                        dataUrl: m.data_url as string,
                        altText: m.alt_text ?? "",
                        createdWithAi: m.created_with_ai,
                      })),
                  });
                  closeInspector();
                  void navigate({ to: "/composer" });
                }}
              >
                Open in Composer
              </Button>
              {post.status === "Failed" || post.status === "LocalDraft" || post.status === "FacebookDraft" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void publishNowFn({ data: { postId: post.id } })
                      .then((r) => {
                        const outcome = publishToast(r.status, r.warning);
                        toast[outcome.ok ? "success" : "error"](outcome.text);
                        return getPostBundle({ data: { postId: post.id } }).then(setBundle);
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Publish failed"))
                      .finally(() => setBusy(false));
                  }}
                >
                  Publish now
                </Button>
              ) : null}
              {comments.some((c) => c.needs_reply) ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPage(post.page_id);
                    closeInspector();
                    void navigate({
                      to: "/inbox",
                      search: { comment: comments.find((c) => c.needs_reply)?.id, page: post.page_id },
                    });
                  }}
                >
                  Open inbox
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void copyText(post.message ?? "").then((ok) =>
                    toast[ok ? "success" : "error"](ok ? "Caption copied." : "Could not copy."),
                  );
                }}
              >
                Copy caption
              </Button>
              {facebookPermalink(post.facebook_post_id) ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={facebookPermalink(post.facebook_post_id)!} target="_blank" rel="noreferrer">
                    Open on Facebook
                  </a>
                </Button>
              ) : null}
              {post.status === "Published" && post.created_by_this_app ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm("Delete this post on Facebook? Only posts this desk created can be removed here.")) return;
                    setBusy(true);
                    void deletePublishedFn({ data: { postId: post.id } })
                      .then(() => {
                        toast.success("Deleted on Facebook and marked Cancelled here.");
                        closeInspector();
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"))
                      .finally(() => setBusy(false));
                  }}
                >
                  Delete on Facebook
                </Button>
              ) : null}
              {post.status !== "Published" && post.status !== "Cancelled" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void cancelPostFn({ data: { postId: post.id } })
                      .then(() => {
                        toast.message("Cancelled.");
                        closeInspector();
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not cancel"))
                      .finally(() => setBusy(false));
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
