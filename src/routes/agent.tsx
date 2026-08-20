import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { bootstrapApp, listAgentRunsFn, runAgentFn, saveIdeaFn } from "@/lib/posterpal/fns";
import type { AgentResult, PageRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";

export const Route = createFileRoute("/agent")({
  component: () => (
    <Guard>
      <AgentDesk />
    </Guard>
  ),
});

function AgentDesk() {
  const pageId = useShellStore((s) => s.selectedPageId);
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [history, setHistory] = useState<{ id: string; prompt: string; summary: string | null; created_at: string }[]>([]);

  const selected = pages.find((p) => p.id === pageId) ?? pages[0];

  const reloadHistory = (id?: string) => {
    void listAgentRunsFn({ data: { pageId: id } })
      .then(setHistory)
      .catch((e: unknown) => {
        setHistory([]);
        toast.error(e instanceof Error ? e.message : "Could not load agent history");
      });
  };

  useEffect(() => {
    void bootstrapApp()
      .then((snap) => setPages(snap.pages))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    reloadHistory(selected?.id);
  }, [selected?.id]);

  const run = () => {
    if (!selected || !prompt.trim()) return;
    setBusy(true);
    void runAgentFn({ data: { pageId: selected.id, prompt } })
      .then((r) => {
        setResult(r);
        if (r.refused) toast.message(r.refused);
        else toast.success(r.liveSearch ? "Researched. Drafts are yours to edit." : "Drafted without live search — verify facts.");
        reloadHistory(selected.id);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Agent failed"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <PageHeader
        title="Desk agent"
        hint="Researches the public web and drafts captions. It cannot publish, like, follow, or reply. You click Publish and Send. Captions do not say they were drafted here."
      />

      <div className="rounded-xl border border-border bg-card p-4 text-[13px] shadow-card">
        <p className="font-semibold">What this agent is allowed to do</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Search the public web and draft 3 captions in this Page’s voice.</li>
          <li>Park an idea on Later, or open Composer with the draft. You still click Send / Publish.</li>
          <li>Write like you. It will not add “written by AI” to the caption — Meta does not require that for text you edit and post.</li>
        </ul>
        <p className="mt-3 font-semibold">What it will refuse</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Auto-post, auto-reply, auto-like, auto-follow, or auto-share. That is banned automation.</li>
          <li>Scraping Facebook. Page data comes from Graph when you connect.</li>
          <li>Stripping watermarks, or claiming a generated still is a documentary photo of a real event.</li>
        </ul>
      </div>

      {pages.length > 1 ? (
        <label className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Page</span>
          <select
            value={selected?.id ?? ""}
            onChange={(e) => setPage(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <form
        className="rounded-xl bg-card p-4 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label className="text-[13px] font-medium" htmlFor="brief">
          Brief
        </label>
        <Textarea
          id="brief"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. What’s the Winona angle on this weekend’s weather / a tote restock caption from the shop voice / research Saturday’s farmers market hours"
          className="mt-2 min-h-28"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !prompt.trim() || !selected}>
            {busy ? "Researching…" : "Research & draft"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setPrompt("Find a timely local or national angle I can post today in this Page’s voice. Facts only. One image idea.")
            }
          >
            Today’s angle
          </Button>
        </div>
      </form>

      {result ? (
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-card">
          {result.refused ? (
            <p className="text-sm text-destructive">{result.refused}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span>{result.liveSearch ? "Live web search" : "No live search — verify before you post"}</span>
                {result.runId ? <span className="tabular-nums">run {result.runId.slice(0, 8)}</span> : null}
              </div>
              <p className="whitespace-pre-wrap text-sm">{result.summary}</p>
              {result.sources.length > 0 ? (
                <ul className="space-y-1 text-[13px]">
                  {result.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-primary underline">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="grid gap-2">
                {(
                  [
                    ["Story", result.captions.storytelling],
                    ["CTA", result.captions.cta],
                    ["Question", result.captions.question],
                  ] as const
                ).map(([label, text]) =>
                  text ? (
                    <div key={label} className="rounded-lg border border-border p-3">
                      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
                      <p className="mt-1 text-sm">{text}</p>
                      <Button
                        size="sm"
                        className="mt-2"
                        variant="outline"
                        onClick={() => {
                          setPrefill({
                            message: text,
                            pageId: selected?.id,
                            mediaType: "Photo",
                          });
                          void navigate({ to: "/composer" });
                        }}
                      >
                        Open in Composer
                      </Button>
                    </div>
                  ) : null,
                )}
              </div>
              {result.imagePrompt ? (
                <p className="text-[13px] text-muted-foreground">
                  Still prompt: {result.imagePrompt}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!result.captions.storytelling}
                  onClick={() => {
                    void saveIdeaFn({
                      data: {
                        pageId: selected?.id,
                        title: result.laterTitle,
                        body: result.captions.storytelling,
                        mediaType: "Photo",
                        notes: "caption-ready",
                      },
                    })
                      .then(() => toast.success("Parked on Later. Nothing posted."))
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"));
                  }}
                >
                  Save to Later
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="rounded-xl bg-card p-4 shadow-card">
          <h2 className="font-semibold">Recent runs</h2>
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="text-[13px] font-medium">{h.prompt}</div>
                <p className="line-clamp-2 text-[12px] text-muted-foreground">{h.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
