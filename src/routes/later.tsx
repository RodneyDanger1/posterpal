import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { deleteIdeaFn, ideasFn, saveIdeaFn } from "@/lib/posterpal/fns";
import type { IdeaRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { copyText, relativeTime } from "@/lib/utils";

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
  const [thisPageOnly, setThisPageOnly] = useState(false);
  const [q, setQ] = useState("");

  const load = () => {
    void ideasFn({ data: {} })
      .then(setRows)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load Later"));
  };
  useEffect(load, []);

  const sorted = useMemo(() => {
    const mine = rows.filter((r) => r.page_id && r.page_id === pageId);
    const rest = rows.filter((r) => !r.page_id || r.page_id !== pageId);
    const ordered = [...mine, ...rest];
    const needle = q.trim().toLowerCase();
    const scoped = thisPageOnly ? mine : ordered;
    if (!needle) return scoped;
    return scoped.filter(
      (r) =>
        r.body.toLowerCase().includes(needle) ||
        r.title.toLowerCase().includes(needle) ||
        (r.page_name ?? "").toLowerCase().includes(needle),
    );
  }, [rows, pageId, thisPageOnly, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Later"
        line="Scratch pad for captions. Nothing here is posted."
        hint="Save captions and ideas here, then send them to Composer when you are ready. This board never touches Facebook."
      >
        <Button size="sm" variant={thisPageOnly ? "default" : "outline"} onClick={() => setThisPageOnly((v) => !v)}>
          This Page only
        </Button>
      </PageHeader>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search parked ideas"
        className="max-w-md"
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

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing parked yet. Save from here or from Composer.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((idea) => (
            <li key={idea.id} className="rounded-xl bg-card p-4 shadow-card transition-shadow duration-150 hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] text-muted-foreground">
                    {idea.page_name ?? "Any Page"} · {idea.media_type} · {relativeTime(idea.created_at)}
                    {idea.page_id && idea.page_id === pageId ? " · this Page" : ""}
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
                  <Hint label="Copy the idea text.">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void copyText(idea.body).then((ok) =>
                          toast[ok ? "success" : "error"](ok ? "Copied." : "Could not copy."),
                        );
                      }}
                    >
                      Copy
                    </Button>
                  </Hint>
                  <Hint label="Removes this idea from Later. Does not affect Facebook.">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void deleteIdeaFn({ data: { id: idea.id } })
                          .then(load)
                          .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not delete"));
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
