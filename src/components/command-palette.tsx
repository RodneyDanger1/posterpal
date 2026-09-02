import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { PageRow } from "@/lib/posterpal/types";
import { nextGoodSlot } from "@/lib/posterpal/desk";
import { useAgentBriefStore, useInspectorStore, useShellStore } from "@/lib/store";

type SearchResult = {
  pages: { id: string; name: string }[];
  posts: { id: string; message: string | null; status: string }[];
  comments: { id: string; message: string; author_name: string | null; page_id?: string | null }[];
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
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const openInspector = useInspectorStore((s) => s.open);
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
              ["/connect", "Connect Facebook"],
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
            <Command.Item
              value="go schedule next good slot"
              onSelect={() => {
                setPrefill({ message: "", when: nextGoodSlot() });
                go("/composer");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Schedule at next good slot
            </Command.Item>
            <Command.Item
              value="go new photo post"
              onSelect={() => {
                setPrefill({ message: "", mediaType: "Photo" });
                go("/composer");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              New photo post
            </Command.Item>
            <Command.Item
              value="go pair phone apk"
              onSelect={() => go("/pair")}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Phone / APK pairing
            </Command.Item>
            <Command.Item
              value="go buying intent inbox"
              onSelect={() => {
                setOpen(false);
                void navigate({ to: "/inbox" });
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Inbox — buying intent
            </Command.Item>
            <Command.Item
              value="fix failed publishes desk agent rewrite"
              onSelect={() => {
                useAgentBriefStore.getState().queue(
                  "Fix failed publishes on this desk. Rewrite each failed caption. Do not publish.",
                  "rewrite",
                );
                go("/agent");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Fix failed publishes (Agent)
            </Command.Item>
            <Command.Item
              value="draft inbox replies desk agent"
              onSelect={() => {
                useAgentBriefStore.getState().queue(
                  "Draft inbox replies for waiting comments. Buying-intent first. A human still clicks Send.",
                  "inbox",
                );
                go("/agent");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Draft inbox replies (Agent)
            </Command.Item>
            <Command.Item
              value="what's happening desk agent ops"
              onSelect={() => {
                useAgentBriefStore.getState().queue(
                  "What's happening on this desk? Using DESK OPS, summarize queue, fails, inbox, vault, and ticker. Do not invent Graph calls.",
                  "ops",
                );
                go("/agent");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              What’s happening (Agent)
            </Command.Item>
            <Command.Item
              value="plan week slots desk agent calendar"
              onSelect={() => {
                useAgentBriefStore.getState().queue(
                  "Plan this week's posting slots using DESK OPS. Flag overdue LocalScheduled and cadence. Do not publish.",
                  "calendar",
                );
                go("/agent");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Plan this week (Agent)
            </Command.Item>
            <Command.Item
              value="connect meta facebook app id desk agent"
              onSelect={() => {
                useAgentBriefStore.getState().queue(
                  "Help me connect this desk to my Meta developer app. Graph v26.0 only. Explain App ID, Redirect URI, Development Mode, and Facebook Login. Do not invent a secret. Do not complete Login for me.",
                  "connect",
                );
                go("/agent");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Connect Meta app (Agent)
            </Command.Item>
            <Command.Item
              value="recall later ideas desk agent memory"
              onSelect={() => {
                useAgentBriefStore.getState().queue(
                  "Recall parked Later ideas and recent Agent runs. Turn the best one into three captions. Do not publish.",
                  "memory",
                );
                go("/agent");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Recall Later (Agent)
            </Command.Item>
            <Command.Item
              value="restock merch caption desk agent shop"
              onSelect={() => {
                useAgentBriefStore.getState().queue(
                  "Write a restock caption in this Page’s voice with the merch CTA. Facts only. Add a place for #ad.",
                  "shop",
                );
                go("/agent");
              }}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Restock caption (Agent)
            </Command.Item>
            <Command.Item
              value="go failed drafts retry"
              onSelect={() => go("/drafts")}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Failed publishes
            </Command.Item>
            <Command.Item
              value="go unique pages identity"
              onSelect={() => go("/")}
              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-muted"
            >
              Fleet identity planner
            </Command.Item>
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
          {hits?.posts.length ? (
            <Command.Group heading="Posts" className="text-[11px] font-semibold text-muted-foreground">
              {hits.posts.map((p) => (
                <Command.Item
                  key={p.id}
                  value={`post ${p.message ?? ""}`}
                  onSelect={() => {
                    openInspector(p.id);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                >
                  <span className="truncate">{p.message || "(no caption)"}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          {hits?.comments.length ? (
            <Command.Group heading="Comments" className="text-[11px] font-semibold text-muted-foreground">
              {hits.comments.map((c) => (
                <Command.Item
                  key={c.id}
                  value={`comment ${c.author_name ?? ""} ${c.message}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({
                      to: "/inbox",
                      search: { comment: c.id, page: c.page_id ?? undefined },
                    });
                  }}
                  className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                >
                  <span className="truncate">
                    {c.author_name ?? "Visitor"}: {c.message}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
}
