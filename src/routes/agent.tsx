import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  bootstrapApp,
  imaginePhotoFn,
  listAgentRunsFn,
  pageProfileFn,
  runAgentFn,
  saveIdeaFn,
} from "@/lib/posterpal/fns";
import type { AgentResult, PageRow, ResearchNote } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";

export const Route = createFileRoute("/agent")({
  component: () => (
    <Guard>
      <AgentDesk />
    </Guard>
  ),
});

type HistoryRow = {
  id: string;
  prompt: string;
  summary: string | null;
  drafts_json: string | null;
  sources_json: string | null;
  image_prompt: string | null;
  created_at: string;
};

type PageProfile = NonNullable<AgentResult["profile"]>;

function parseDrafts(raw: string | null): {
  captions: AgentResult["captions"];
  topics: string[];
  queries: string[];
  notes: ResearchNote[];
  pagePurpose: string;
} {
  const captions = { storytelling: "", cta: "", question: "" };
  let topics: string[] = [];
  let queries: string[] = [];
  let notes: ResearchNote[] = [];
  let pagePurpose = "";
  if (!raw) return { captions, topics, queries, notes, pagePurpose };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    captions.storytelling = String(parsed.storytelling ?? "");
    captions.cta = String(parsed.cta ?? "");
    captions.question = String(parsed.question ?? "");
    if (Array.isArray(parsed.topics)) topics = parsed.topics.map(String).filter(Boolean);
    if (Array.isArray(parsed.queries)) queries = parsed.queries.map(String).filter(Boolean);
    if (typeof parsed.pagePurpose === "string") pagePurpose = parsed.pagePurpose;
    if (Array.isArray(parsed.notes)) {
      for (const n of parsed.notes) {
        if (!n || typeof n !== "object") continue;
        const rec = n as Record<string, unknown>;
        const body = String(rec.body ?? "").trim();
        if (!body) continue;
        const url = String(rec.url ?? "");
        notes.push({
          heading: String(rec.heading ?? "Note"),
          body,
          url: url.startsWith("http") ? url : undefined,
          confidence: rec.confidence === "verified" ? "verified" : "unverified",
        });
      }
    }
  } catch {
    /* keep empty */
  }
  return { captions, topics, queries, notes, pagePurpose };
}

function AgentDesk() {
  const pageId = useShellStore((s) => s.selectedPageId);
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [imagineBusy, setImagineBusy] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [profile, setProfile] = useState<PageProfile | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const runLock = useRef(false);

  const selected = pages.find((p) => p.id === pageId) ?? (pageId ? undefined : pages[0]);

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
      .then((snap) => {
        setPages(snap.pages);
        if (!pageId && snap.pages[0]) setPage(snap.pages[0].id);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setProfile(null);
      return;
    }
    reloadHistory(selected.id);
    void pageProfileFn({ data: { pageId: selected.id } })
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [selected?.id]);

  const run = (opts?: { mapPage?: boolean; brief?: string }) => {
    if (!selected || runLock.current) return;
    const text = (opts?.brief ?? prompt).trim();
    if (!opts?.mapPage && !text) return;
    runLock.current = true;
    setBusy(true);
    void runAgentFn({
      data: {
        pageId: selected.id,
        prompt: opts?.mapPage ? "Map this Page" : text,
        mapPage: Boolean(opts?.mapPage),
      },
    })
      .then((r) => {
        setResult(r);
        if (r.profile) setProfile(r.profile);
        if (r.refused) toast.message(r.refused);
        else toast.success(r.liveSearch ? "Researched. Drafts are yours to edit." : "Drafted without live search — verify facts.");
        reloadHistory(selected.id);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Agent failed"))
      .finally(() => {
        runLock.current = false;
        setBusy(false);
      });
  };

  const generateStill = (caption: string, still: string) => {
    if (!still.trim()) {
      toast.error("No still prompt on this run.");
      return;
    }
    if (imagineBusy) return;
    setImagineBusy(true);
    void imaginePhotoFn({ data: { prompt: still } })
      .then((r) => {
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        setPrefill({
          message: caption,
          pageId: selected?.id,
          mediaType: "Photo",
          imagePrompt: still,
          media: [
            {
              fileName: r.fileName,
              mimeType: "image/png",
              dataUrl: r.dataUrl,
              altText: still.slice(0, 200),
              createdWithAi: true,
            },
          ],
        });
        toast.success("Still attached. You still click Send.");
        void navigate({ to: "/composer" });
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Imagine failed"))
      .finally(() => setImagineBusy(false));
  };

  const restoreRun = (h: HistoryRow) => {
    const parsed = parseDrafts(h.drafts_json);
    let sources: AgentResult["sources"] = [];
    try {
      const raw = h.sources_json ? JSON.parse(h.sources_json) : [];
      if (Array.isArray(raw)) {
        sources = raw
          .map((s: { title?: string; url?: string }) => ({ title: String(s.title ?? s.url ?? ""), url: String(s.url ?? "") }))
          .filter((s: { url: string }) => s.url);
      }
    } catch {
      sources = [];
    }
    setResult({
      summary: h.summary ?? "",
      sources,
      captions: parsed.captions,
      imagePrompt: h.image_prompt ?? "",
      laterTitle: h.prompt.slice(0, 60),
      refused: null,
      liveSearch: false,
      runId: h.id,
      topics: parsed.topics,
      queries: parsed.queries,
      notes: parsed.notes,
      pagePurpose: parsed.pagePurpose,
      profile,
    });
    setPrompt(h.prompt);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <PageHeader
        title="Desk agent"
        hint="Profiles this Page from your desk (not a Facebook scrape), searches the public web, takes notes, then drafts captions. It cannot publish, like, follow, or reply. You click Publish and Send."
      />

      <div className="rounded-xl border border-border bg-card p-4 text-[13px] shadow-card">
        <p className="font-semibold">How research works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Read this Page’s purpose, topics, merch, and recent captions from the desk.</li>
          <li>Plan 3–5 public-web queries. Never scrape Facebook.</li>
          <li>Live-search (Grok) and take sourced notes. Unverified stays labeled.</li>
          <li>Draft 3 captions in this Page’s voice. You edit, then you click Send.</li>
        </ol>
        <p className="mt-3 font-semibold">What it will refuse</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Auto-post, auto-reply, auto-like, auto-follow, or auto-share.</li>
          <li>Invented hours, quotes, or events. Those stay unverified until you check.</li>
          <li>Claiming a generated still is a documentary photo of a real event.</li>
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

      {profile ? (
        <div className="rounded-xl bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">This Page’s purpose</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{profile.purpose}</p>
              {profile.localeHint ? (
                <p className="mt-1 text-[12px] text-muted-foreground">Locale: {profile.localeHint}</p>
              ) : null}
            </div>
            <Button type="button" variant="outline" size="sm" disabled={busy || !selected} onClick={() => run({ mapPage: true })}>
              {busy ? "Mapping…" : "Map this Page"}
            </Button>
          </div>
          {profile.topics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[12px] hover:bg-muted"
                  onClick={() =>
                    setPrompt(`Research ${t} for ${profile.name}. Timely, local if possible, facts only.`)
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
          {profile.merch.length > 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Shop: {profile.merch.map((m) => m.title).join(" · ")}
            </p>
          ) : null}
          {profile.suggestedBriefs.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested briefs</div>
              {profile.suggestedBriefs.map((b) => (
                <button
                  key={b}
                  type="button"
                  className="block w-full rounded-md border border-border px-3 py-2 text-left text-[12px] hover:bg-muted/50"
                  onClick={() => setPrompt(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
            disabled={busy || !selected}
            onClick={() =>
              run({
                brief:
                  profile?.suggestedBriefs[0] ||
                  "Find a timely local or national angle I can post today in this Page’s voice. Facts only. One image idea.",
              })
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
              {result.pagePurpose ? (
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">Purpose: </span>
                  {result.pagePurpose}
                </p>
              ) : null}
              {result.queries.length > 0 ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Queries</div>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[13px] text-muted-foreground">
                    {result.queries.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {result.topics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.topics.map((t) => (
                    <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-[12px]">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {result.notes.length > 0 ? (
                <ul className="space-y-2">
                  {result.notes.map((n, i) => (
                    <li key={`${n.heading}-${i}`} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium">{n.heading}</span>
                        <span
                          className={
                            n.confidence === "verified"
                              ? "text-[11px] text-emerald-700"
                              : "text-[11px] text-amber-700"
                          }
                        >
                          {n.confidence}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-muted-foreground">{n.body}</p>
                      {n.url ? (
                        <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] text-primary underline">
                          Source
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
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
                            imagePrompt: result.imagePrompt || undefined,
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
                <p className="text-[13px] text-muted-foreground">Still prompt: {result.imagePrompt}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!result.imagePrompt || imagineBusy}
                  onClick={() => generateStill(result.captions.storytelling || result.captions.cta, result.imagePrompt)}
                >
                  {imagineBusy ? "Generating still…" : "Generate still & open Composer"}
                </Button>
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
                <button type="button" className="w-full text-left" onClick={() => restoreRun(h)}>
                  <div className="text-[13px] font-medium">{h.prompt}</div>
                  <p className="line-clamp-2 text-[12px] text-muted-foreground">{h.summary}</p>
                  <span className="text-[11px] text-primary">Open this run</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
