import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { deleteIdeaFn, ideasFn, saveIdeaFn } from "@/lib/posterpal/fns";
import type { IdeaRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/later")({
  component: () => (
    <Guard>
      <Later />
    </Guard>
  ),
});

function Later() {
  const pageId = useShellStore((s) => s.selectedPageId);
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const navigate = useNavigate();
  const [rows, setRows] = useState<IdeaRow[]>([]);
  const [draft, setDraft] = useState("");

  const load = () => {
    void ideasFn({ data: {} }).then(setRows);
  };
  useEffect(load, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Later"
        hint="Scratch pad — not a Facebook post. Save captions and ideas here, then send them to Composer when you are ready. Nothing on this board is published."
      />

      <form
        className="rounded-xl bg-card p-4 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          void saveIdeaFn({
            data: { pageId: pageId ?? null, body: draft, mediaType: "Text" },
          })
            .then(() => {
              setDraft("");
              toast.success("Saved for later.");
              load();
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not save"));
        }}
      >
        <label className="text-[13px] font-medium" htmlFor="idea">
          New idea
        </label>
        <textarea
          id="idea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="A caption, a photo concept, a Saturday story-hour note…"
          className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="mt-3">
          <Hint label="Stores this locally. Does not send anything to Facebook.">
            <Button type="submit" size="sm">
              <BookmarkPlus className="mr-1.5 size-4" />
              Save for later
            </Button>
          </Hint>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing parked yet. Save from here or from Composer.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((idea) => (
            <li key={idea.id} className="rounded-xl bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] text-muted-foreground">
                    {idea.page_name ?? "Any Page"} · {idea.media_type} · {relativeTime(idea.created_at)}
                  </div>
                  <h2 className="mt-1 font-semibold">{idea.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{idea.body}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Hint label="Opens Composer with this text so you can attach media, run policy, and publish.">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (idea.page_id) setPage(idea.page_id);
                        setPrefill({
                          message: idea.body,
                          pageId: idea.page_id,
                          mediaType: idea.media_type,
                        });
                        void navigate({ to: "/composer" });
                      }}
                    >
                      Open in Composer
                    </Button>
                  </Hint>
                  <Hint label="Removes this idea from Later. Does not affect Facebook.">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void deleteIdeaFn({ data: { id: idea.id } }).then(load);
                      }}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      Delete
                    </Button>
                  </Hint>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
