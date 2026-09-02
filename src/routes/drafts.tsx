import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViewTabs } from "@/components/view-tabs";
import { cancelPostFn, exportQueueFn, getPostBundle, listPostsFn, publishNowFn } from "@/lib/posterpal/fns";
import { isOverdue, publishToast, toLocalInput } from "@/lib/posterpal/operator";
import { isRemixDraft } from "@/lib/posterpal/briefing";
import type { PostRow } from "@/lib/posterpal/types";
import { relativeTime, copyText } from "@/lib/utils";
import { useAgentBriefStore, useInspectorStore, useShellStore } from "@/lib/store";

export const Route = createFileRoute("/drafts")({
  validateSearch: (s: Record<string, unknown>): { tab?: "drafts" | "queued" | "failed" } => {
    const tab = s.tab;
    if (tab === "queued" || tab === "failed" || tab === "drafts") return { tab };
    return {};
  },
  component: () => (
    <Guard>
      <Drafts />
    </Guard>
  ),
});

function Drafts() {
  const search = Route.useSearch();
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const openInspector = useInspectorStore((s) => s.open);
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [tab, setTab] = useState<"drafts" | "queued" | "failed">(search.tab ?? "drafts");
  useEffect(() => {
    if (search.tab) setTab(search.tab);
  }, [search.tab]);
  const [q, setQ] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const load = () => {
    void listPostsFn({ data: { pageId, limit: 100 } })
      .then(setPosts)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load drafts"));
  };
  useEffect(load, [pageId]);

  const needle = q.trim().toLowerCase();
  const matches = (p: PostRow) =>
    !needle ||
    (p.message ?? "").toLowerCase().includes(needle) ||
    (p.page_name ?? "").toLowerCase().includes(needle) ||
    (p.error_message ?? "").toLowerCase().includes(needle);
  const allGroups = {
    drafts: posts.filter((p) => p.status === "LocalDraft" || p.status === "FacebookDraft"),
    queued: posts.filter((p) => p.status === "LocalScheduled" || p.status === "FacebookScheduled" || p.status === "Publishing"),
    failed: posts.filter((p) => p.status === "Failed"),
  };
  const groups = {
    drafts: allGroups.drafts.filter(matches),
    queued: allGroups.queued.filter(matches),
    failed: allGroups.failed.filter(matches),
  };
  const visible = groups[tab];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveId((cur) => {
          const i = visible.findIndex((p) => p.id === cur);
          return visible[Math.min(visible.length - 1, i + 1)]?.id ?? cur;
        });
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveId((cur) => {
          const i = visible.findIndex((p) => p.id === cur);
          return visible[Math.max(0, i - 1)]?.id ?? visible[0]?.id ?? cur;
        });
      }
      if (e.key === "Enter" && activeId) {
        e.preventDefault();
        openInspector(activeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, activeId, openInspector]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Drafts & queue"
        line="Local drafts, Facebook slots, and failed Graph publishes for the selected Page."
        hint="Local drafts stay here until you publish. FacebookScheduled is already on Graph. Failed posts keep their media — Publish now retries the same row, it does not clone a new one. Recycle/clone drafts say rewrite needed until you edit them. The desk ticker fires LocalScheduled while PosterPal is open. j/k moves the list."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void exportQueueFn({ data: { pageId } })
              .then((csv) => {
                const blob = new Blob([csv], { type: "text/csv" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "posterpal-queue.csv";
                a.click();
              })
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Export failed"));
          }}
        >
          Export queue CSV
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by caption, Page, or error"
          className="h-11 max-w-sm"
          aria-label="Filter drafts"
        />
        {allGroups.failed.length > 0 && tab === "failed" ? (
          <Button
            variant="outline"
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              void (async () => {
                let ok = 0;
                let fail = 0;
                for (const p of allGroups.failed) {
                  try {
                    const r = await publishNowFn({ data: { postId: p.id } });
                    if (r.status === "Failed") fail += 1;
                    else ok += 1;
                  } catch {
                    fail += 1;
                  }
                }
                toast.message(`Retry finished: ${ok} moved, ${fail} still failed.`);
                load();
              })().finally(() => setRetrying(false));
            }}
          >
            {retrying ? "Retrying…" : `Retry all failed (${allGroups.failed.length})`}
          </Button>
        ) : null}
      </div>
      <ViewTabs
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        tabs={[
          { value: "drafts", label: `Drafts (${allGroups.drafts.length})` },
          { value: "queued", label: `Scheduled (${allGroups.queued.length})` },
          { value: "failed", label: `Failed (${allGroups.failed.length})` },
        ]}
      />
      <div className="mt-4 space-y-2">
        {(["drafts", "queued", "failed"] as const)
          .filter((key) => key === tab)
          .map((key) => (
          <div key={key} className="space-y-2">
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
                <article key={p.id} className={`rounded-xl bg-card p-4 shadow-card ${activeId === p.id ? "ring-2 ring-primary" : ""}`}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-start justify-between gap-2 text-left"
                    onClick={() => openInspector(p.id)}
                  >
                    <div>
                      <div className="text-[12px] text-muted-foreground">
                        {p.page_name} · {p.media_type} · {relativeTime(p.scheduled_publish_time ?? p.created_at)}
                        {isRemixDraft(p.message) ? " · rewrite needed" : ""}
                      </div>
                      <p className="mt-1 text-sm">{p.message || "(no caption)"}</p>
                      {p.status === "LocalScheduled" && isOverdue(p.scheduled_publish_time) ? (
                        <p className="mt-1 text-[13px] text-warning">Overdue — in-tab ticker missed it. The worker will pick it up, or Publish now from here.</p>
                      ) : null}
                      {p.error_message ? <p className="mt-2 text-[13px] text-destructive">{p.error_message}</p> : null}
                    </div>
                    <StatusBadge status={p.status} />
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.status === "Failed" || p.status === "LocalDraft" || p.status === "FacebookDraft" ? (
                      isRemixDraft(p.message) ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setPrefill({
                              message: p.message ?? "",
                              pageId: p.page_id,
                              mediaType: p.media_type,
                            });
                            void navigate({ to: "/composer" });
                          }}
                        >
                          Rewrite in Composer
                        </Button>
                      ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          void publishNowFn({ data: { postId: p.id } })
                            .then((r) => {
                              const outcome = publishToast(r.status, r.warning);
                              toast[outcome.ok ? "success" : "error"](outcome.text);
                              load();
                            })
                            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"));
                        }}
                      >
                        Publish now
                      </Button>
                      )
                    ) : p.status === "LocalScheduled" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          void publishNowFn({ data: { postId: p.id } })
                            .then((r) => {
                              const outcome = publishToast(r.status, r.warning);
                              toast[outcome.ok ? "success" : "error"](outcome.text);
                              load();
                            })
                            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"));
                        }}
                      >
                        Publish now
                      </Button>
                    ) : p.status === "Publishing" ? (
                      <p className="text-[12px] text-muted-foreground">Waiting on Graph. If this hangs past 2 minutes the ticker marks it Failed — retry from the Failed tab.</p>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void getPostBundle({ data: { postId: p.id } })
                          .then((bundle) => {
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
                        })
                          .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not open post"));
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
                    {p.status === "Failed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (p.page_id) useShellStore.getState().setSelectedPageId(p.page_id);
                          useAgentBriefStore.getState().queue(
                            `Fix failed publish on ${p.page_name ?? "this Page"}: ${p.error_message ?? "unknown error"}. Rewrite this caption in this Page's voice: “${(p.message ?? "").slice(0, 280)}”. Do not publish.`,
                            "rewrite",
                          );
                          void navigate({ to: "/agent" });
                        }}
                      >
                        Ask agent
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void cancelPostFn({ data: { postId: p.id } })
                          .then(() => {
                            toast.message("Cancelled.");
                            load();
                          })
                          .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not cancel"));
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
