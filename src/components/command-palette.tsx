import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { PageRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";

type SearchResult = {
  pages: { id: string; name: string }[];
  posts: { id: string; message: string | null; status: string }[];
  comments: { id: string; message: string; author_name: string | null }[];
};

export function CommandPalette({
  pages,
  onSearch,
}: {
  pages: PageRow[];
  onSearch: (q: string) => Promise<SearchResult>;
}) {
  const open = useShellStore((s) => s.commandOpen);
  const setOpen = useShellStore((s) => s.setCommandOpen);
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      if (q.trim().length < 2) {
        setHits(null);
        return;
      }
      void onSearch(q).then(setHits).catch(() => setHits(null));
    }, 180);
    return () => window.clearTimeout(t);
  }, [q, open, onSearch]);

  if (!open) return null;

  const go = (path: string) => {
    setOpen(false);
    void navigate({ to: path });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 pt-[12vh]" onClick={() => setOpen(false)}>
      <Command
        className="w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-xl bg-card shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder="Jump to a Page, post, or destination…"
          className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none"
        />
        <Command.List className="max-h-[420px] overflow-auto p-2">
          <Command.Empty className="px-3 py-6 text-sm text-muted-foreground">No matches.</Command.Empty>
          <Command.Group heading="Go" className="text-[11px] font-semibold text-muted-foreground">
            {[
              ["/", "Pages home"],
              ["/composer", "Composer"],
              ["/later", "Later — saved ideas"],
              ["/drafts", "Drafts"],
              ["/calendar", "Calendar"],
              ["/inbox", "Inbox"],
              ["/agent", "Desk agent"],
              ["/analytics", "Analytics"],
              ["/media", "Media library"],
              ["/merchandise", "Merchandise"],
              ["/vault", "Token vault"],
              ["/pair", "Pair a phone"],
              ["/settings", "Settings"],
            ].map(([path, label]) => (
              <Command.Item
                key={path}
                value={`go ${label}`}
                onSelect={() => go(path)}
                className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
              >
                {label}
              </Command.Item>
            ))}
          </Command.Group>
          {pages.length > 0 ? (
            <Command.Group heading="Pages" className="text-[11px] font-semibold text-muted-foreground">
              {pages.map((p) => (
                <Command.Item
                  key={p.id}
                  value={`page ${p.name}`}
                  onSelect={() => {
                    setPage(p.id);
                    go("/");
                  }}
                  className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                >
                  {p.name}
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          {hits?.posts.map((p) => (
            <Command.Item
              key={p.id}
              value={`post ${p.message ?? ""}`}
              onSelect={() => go("/drafts")}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
            >
              <span className="truncate">{p.message || "(no caption)"}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
