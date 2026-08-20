import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { deleteIdeaFn, ideasFn, moveIdeaFn, saveIdeaFn } from "@/lib/posterpal/fns";
import { LATER_COLUMNS, laterColumnOf, type LaterColumnId } from "@/lib/posterpal/operator";
import type { IdeaRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { relativeTime, copyText } from "@/lib/utils";

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
  const [column, setColumn] = useState<LaterColumnId>("inbox");

  const load = () => {
    void ideasFn({ data: {} }).then(setRows);
  };
  useEffect(load, []);

  const grouped = useMemo(() => {
    const g: Record<LaterColumnId, IdeaRow[]> = {
      inbox: [],
      "photo-needed": [],
      "caption-ready": [],
      "offer-this-week": [],
    };
    for (const idea of rows) g[laterColumnOf(idea.notes)].push(idea);
    return g;
  }, [rows]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Later"
        hint="Scratch pad — not a Facebook post. Columns match how operators actually ship: photo still needed, caption ready, offer this week. Nothing here is published."
      />

      <form
        className="rounded-xl bg-card p-4 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          void saveIdeaFn({
            data: { pageId: pageId ?? null, body: draft, mediaType: "Text", notes: column === "inbox" ? null : column },
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {LATER_COLUMNS.map((c) => (
            <Hint key={c.id} label={c.hint}>
              <Button type="button" size="sm" variant={column === c.id ? "default" : "outline"} onClick={() => setColumn(c.id)}>
                {c.label}
              </Button>
            </Hint>
          ))}
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {LATER_COLUMNS.map((col) => (
            <section key={col.id} className="space-y-2">
              <h2 className="text-[13px] font-semibold">
                {col.label}{" "}
                <span className="font-normal text-muted-foreground">({grouped[col.id].length})</span>
              </h2>
              {grouped[col.id].length === 0 ? (
                <p className="rounded-xl bg-card p-3 text-[12px] text-muted-foreground shadow-card">{col.hint}</p>
              ) : (
                grouped[col.id].map((idea) => (
                  <article key={idea.id} className="rounded-xl bg-card p-3 shadow-card">
                    <div className="text-[11px] text-muted-foreground">
                      {idea.page_name ?? "Any Page"} · {idea.media_type} · {relativeTime(idea.created_at)}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold">{idea.title}</h3>
                    <p className="mt-1 line-clamp-5 whitespace-pre-wrap text-[13px]">{idea.body}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
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
                          Open
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
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-[12px]"
                        value={col.id}
                        onChange={(e) => {
                          const next = e.target.value as LaterColumnId;
                          void moveIdeaFn({
                            data: { id: idea.id, notes: next === "inbox" ? null : next },
                          }).then(load);
                        }}
                        aria-label="Move idea"
                      >
                        {LATER_COLUMNS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <Hint label="Removes this idea from Later. Does not affect Facebook.">
                        <Button size="sm" variant="ghost" onClick={() => void deleteIdeaFn({ data: { id: idea.id } }).then(load)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </Hint>
                    </div>
                  </article>
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
