import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cancelPostFn, getPostBundle, listPostsFn, publishNowFn } from "@/lib/posterpal/fns";
import { isOverdue, toLocalInput } from "@/lib/posterpal/operator";
import type { PostRow } from "@/lib/posterpal/types";
import { relativeTime, copyText } from "@/lib/utils";
import { useShellStore } from "@/lib/store";

export const Route = createFileRoute("/drafts")({ component: () => <Guard><Drafts /></Guard> });

function Drafts() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const load = () => {
    void listPostsFn({ data: { pageId, limit: 100 } }).then(setPosts);
  };
  useEffect(load, [pageId]);

  const groups = {
    drafts: posts.filter((p) => p.status === "LocalDraft" || p.status === "FacebookDraft"),
    queued: posts.filter((p) => p.status === "LocalScheduled" || p.status === "FacebookScheduled" || p.status === "Publishing"),
    failed: posts.filter((p) => p.status === "Failed"),
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Drafts & queue"
        hint="Local drafts stay here until you publish. FacebookScheduled is already on Graph. Failed posts keep their media — Publish now retries the same row, it does not clone a new one."
      />
      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts">Drafts ({groups.drafts.length})</TabsTrigger>
          <TabsTrigger value="queued">Scheduled ({groups.queued.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({groups.failed.length})</TabsTrigger>
        </TabsList>
        {(["drafts", "queued", "failed"] as const).map((key) => (
          <TabsContent key={key} value={key} className="mt-4 space-y-2">
            {groups[key].length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {key === "drafts"
                  ? "No drafts on this Page. Save one from Composer (Local draft)."
                  : key === "queued"
                    ? "Nothing scheduled. Drag a draft onto the Calendar or pick Schedule in Composer."
                    : "No failed publishes. Graph errors land here with the original media intact."}
              </p>
            ) : (
              groups[key].map((p) => (
                <article key={p.id} className="rounded-xl bg-card p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[12px] text-muted-foreground">
                        {p.page_name} · {p.media_type} · {relativeTime(p.scheduled_publish_time ?? p.created_at)}
                      </div>
                      <p className="mt-1 text-sm">{p.message || "(no caption)"}</p>
                      {p.status === "LocalScheduled" && isOverdue(p.scheduled_publish_time) ? (
                        <p className="mt-1 text-[13px] text-warning">Overdue — local scheduler only fires while this desk is open.</p>
                      ) : null}
                      {p.error_message ? <p className="mt-2 text-[13px] text-destructive">{p.error_message}</p> : null}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.status === "Failed" || p.status === "LocalDraft" || p.status === "FacebookDraft" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          void publishNowFn({ data: { postId: p.id } })
                            .then((r) => {
                              toast.success(`${r.status}${r.warning ? " — " + r.warning : ""}`);
                              load();
                            })
                            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"));
                        }}
                      >
                        Publish now
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void getPostBundle({ data: { postId: p.id } }).then((bundle) => {
                          setPrefill({
                            message: p.message ?? "",
                            pageId: p.page_id,
                            mediaType: p.media_type,
                            media: (bundle?.media ?? [])
                              .filter((m) => m.data_url)
                              .map((m) => ({
                                fileName: m.file_name,
                                mimeType: m.mime_type ?? "application/octet-stream",
                                dataUrl: m.data_url as string,
                                altText: m.alt_text ?? "",
                                createdWithAi: m.created_with_ai,
                              })),
                            when: p.scheduled_publish_time
                              ? toLocalInput(new Date(p.scheduled_publish_time))
                              : undefined,
                          });
                          void navigate({ to: "/composer" });
                        });
                      }}
                    >
                      Open in Composer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void copyText(p.message ?? "").then((ok) =>
                          toast[ok ? "success" : "error"](ok ? "Caption copied." : "Could not copy."),
                        );
                      }}
                    >
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void cancelPostFn({ data: { postId: p.id } }).then(load);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </article>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
