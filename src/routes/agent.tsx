import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  bootstrapApp,
  deskHealthFn,
  deskSnapshotFn,
  getSettingsFn,
  imaginePhotoFn,
  listAgentRunsFn,
  pageProfileFn,
  runAgentFn,
  saveIdeaFn,
  savePrefs,
} from "@/lib/posterpal/fns";
import { IMAGE_PROVIDERS, TEXT_PROVIDERS } from "@/lib/posterpal/providers";
import type { DeskSnapshot } from "@/lib/posterpal/desk-context";
import { scheduleWhenForPage } from "@/lib/posterpal/slots";
import { PERSONAS, parsePersona, skillLabel, type AgentPersonaId } from "@/lib/posterpal/agent-skills";
import { isHopKind } from "@/lib/posterpal/agent-hops";
import { Happenings } from "@/components/happenings";
import { happeningScopeLabel } from "@/lib/posterpal/desk-context";
import type { AgentResult, PageRow, ResearchNote, SettingsBag } from "@/lib/posterpal/types";
import { useAgentBriefStore, useInspectorStore, useShellStore } from "@/lib/store";
import { relativeTime } from "@/lib/utils";

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
  opsBrief: string;
  hops: AgentResult["hops"];
  inboxDrafts: AgentResult["inboxDrafts"];
  captionPolicy: AgentResult["captionPolicy"];
  nextSlot: string | null;
  merchUrl: string | null;
  persona: string;
  skills: string[];
} {
  const captions = { storytelling: "", cta: "", question: "" };
  let topics: string[] = [];
  let queries: string[] = [];
  const notes: ResearchNote[] = [];
  let pagePurpose = "";
  let opsBrief = "";
  let hops: AgentResult["hops"] = [];
  let inboxDrafts: AgentResult["inboxDrafts"] = [];
  let captionPolicy: AgentResult["captionPolicy"] = null;
  let nextSlot: string | null = null;
  let merchUrl: string | null = null;
  let persona = "research";
  let skills: string[] = [];
  if (!raw) return { captions, topics, queries, notes, pagePurpose, opsBrief, hops, inboxDrafts, captionPolicy, nextSlot, merchUrl, persona, skills };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    captions.storytelling = String(parsed.storytelling ?? "");
    captions.cta = String(parsed.cta ?? "");
    captions.question = String(parsed.question ?? "");
    if (Array.isArray(parsed.topics)) topics = parsed.topics.map(String).filter(Boolean);
    if (Array.isArray(parsed.queries)) queries = parsed.queries.map(String).filter(Boolean);
    if (typeof parsed.pagePurpose === "string") pagePurpose = parsed.pagePurpose;
    if (typeof parsed.opsBrief === "string") opsBrief = parsed.opsBrief;
    if (typeof parsed.nextSlot === "string") nextSlot = parsed.nextSlot;
    if (typeof parsed.merchUrl === "string") merchUrl = parsed.merchUrl;
    if (typeof parsed.persona === "string") persona = parsed.persona;
    if (Array.isArray(parsed.skills)) skills = parsed.skills.map(String);
    if (parsed.captionPolicy && typeof parsed.captionPolicy === "object") {
      const p = parsed.captionPolicy as { canPublish?: boolean; flags?: unknown };
      captionPolicy = {
        canPublish: Boolean(p.canPublish),
        flags: Array.isArray(p.flags)
          ? p.flags
              .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
              .map((f) => ({ id: String(f.id ?? ""), severity: String(f.severity ?? ""), title: String(f.title ?? "") }))
          : [],
      };
    }
    if (Array.isArray(parsed.hops)) {
      hops = parsed.hops
        .filter((h): h is Record<string, unknown> => Boolean(h) && typeof h === "object")
        .map((h) => ({
          id: String(h.id ?? h.label ?? ""),
          kind: (isHopKind(String(h.kind)) ? String(h.kind) : "composer") as AgentResult["hops"][number]["kind"],
          label: String(h.label ?? "Open"),
          href: String(h.href ?? "/composer"),
          caption: typeof h.caption === "string" ? h.caption : undefined,
          commentId: typeof h.commentId === "string" ? h.commentId : undefined,
          postId: typeof h.postId === "string" ? h.postId : undefined,
          ideaId: typeof h.ideaId === "string" ? h.ideaId : undefined,
        }));
    }
    if (Array.isArray(parsed.inboxDrafts)) {
      inboxDrafts = parsed.inboxDrafts
        .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
        .map((d) => ({
          commentId: String(d.commentId ?? ""),
          author: String(d.author ?? "Visitor"),
          comment: String(d.comment ?? ""),
          pageName: String(d.pageName ?? ""),
          pageId: String(d.pageId ?? ""),
          buyingIntent: Boolean(d.buyingIntent),
          drafts: Array.isArray(d.drafts) ? d.drafts.map(String) : [],
        }))
        .filter((d) => d.commentId);
    }
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
  return { captions, topics, queries, notes, pagePurpose, opsBrief, hops, inboxDrafts, captionPolicy, nextSlot, merchUrl, persona, skills };
}

function AgentDesk() {
  const pageId = useShellStore((s) => s.selectedPageId);
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const setLastPersona = useShellStore((s) => s.setLastAgentPersona);
  const lastPersona = useShellStore((s) => s.lastAgentPersona);
  const queuedBrief = useAgentBriefStore((s) => s.pending);
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [imagineBusy, setImagineBusy] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [profile, setProfile] = useState<PageProfile | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [textProvider, setTextProvider] = useState("grok");
  const [imageProvider, setImageProvider] = useState("grok");
  const [settings, setSettings] = useState<SettingsBag | null>(null);
  const [health, setHealth] = useState<{
    db: string;
    workerLastTick: string | null;
    schedulerLastTick: string | null;
    workerFresh: boolean;
    schedulerFresh: boolean;
  } | null>(null);
  const [snapshot, setSnapshot] = useState<DeskSnapshot | null>(null);
  const [activePersona, setActivePersona] = useState<AgentPersonaId | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const runLock = useRef(false);
  const runGen = useRef(0);

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
    void getSettingsFn()
      .then((s) => {
        setSettings(s);
        setTextProvider(s.defaultTextProvider);
        setImageProvider(s.defaultImageProvider);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load settings"));
    void deskHealthFn()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setProfile(null);
      return;
    }
    reloadHistory(selected.id);
    void pageProfileFn({ data: { pageId: selected.id } })
      .then(setProfile)
      .catch((e: unknown) => {
        setProfile(null);
        toast.error(e instanceof Error ? e.message : "Could not load Page profile");
      });
    void deskSnapshotFn({ data: { pageId: selected.id } })
      .then((snap) => {
        setSnapshot(snap);
        if (snap.health) setHealth(snap.health);
      })
      .catch((e: unknown) => {
        setSnapshot(null);
        toast.error(e instanceof Error ? e.message : "Could not load desk snapshot");
      });
  }, [selected?.id]);

  const run = (opts?: { mapPage?: boolean; brief?: string; persona?: AgentPersonaId }) => {
    if (!selected || runLock.current) return;
    const text = (opts?.brief ?? prompt).trim();
    if (!opts?.mapPage && !text) return;
    const gen = ++runGen.current;
    runLock.current = true;
    setBusy(true);
    setRunError(null);
    if (opts?.persona) {
      setActivePersona(opts.persona);
      setLastPersona(opts.persona);
    }
    void runAgentFn({
      data: {
        pageId: selected.id,
        prompt: opts?.mapPage ? "Map this Page" : text,
        mapPage: Boolean(opts?.mapPage),
        provider: textProvider,
        persona: opts?.persona,
      },
    })
      .then((r) => {
        if (gen !== runGen.current) return;
        setResult(r);
        if (r.profile) setProfile(r.profile);
        if (r.persona) {
          setActivePersona(r.persona as AgentPersonaId);
          setLastPersona(r.persona);
        }
        if (r.refused) toast.message(r.refused);
        else toast.success(r.liveSearch ? "Researched. Drafts are yours to edit." : "Drafted without live search — verify facts.");
        reloadHistory(selected.id);
      })
      .catch((e: unknown) => {
        if (gen !== runGen.current) return;
        const msg = e instanceof Error ? e.message : "Agent failed";
        setRunError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (gen !== runGen.current) return;
        runLock.current = false;
        setBusy(false);
      });
  };

  const stopWaiting = () => {
    runGen.current += 1;
    runLock.current = false;
    setBusy(false);
    toast.message("Stopped waiting. A server run already in flight may still finish.");
  };

  useEffect(() => {
    if (!selected?.id || !queuedBrief) return;
    if (runLock.current || busy) return;
    const pending = useAgentBriefStore.getState().consume();
    if (!pending) return;
    setPrompt(pending.brief);
    const persona = parsePersona(pending.persona) ?? parsePersona(lastPersona) ?? undefined;
    if (persona) setActivePersona(persona);
    run({ brief: pending.brief, persona });
  }, [selected?.id, queuedBrief, busy]);

  const generateStill = (caption: string, still: string) => {
    if (!still.trim()) {
      toast.error("No still prompt on this run.");
      return;
    }
    if (imagineBusy) return;
    setImagineBusy(true);
    void imaginePhotoFn({ data: { prompt: still, provider: imageProvider, pageId: selected?.id } })
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
              assetId: "assetId" in r ? String(r.assetId ?? "") : undefined,
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
      opsBrief: parsed.opsBrief,
      hops: parsed.hops,
      inboxDrafts: parsed.inboxDrafts,
      captionPolicy: parsed.captionPolicy,
      nextSlot: parsed.nextSlot,
      merchUrl: parsed.merchUrl,
      persona: parsed.persona,
      skills: parsed.skills,
      profile,
    });
    setPrompt(h.prompt);
    setActivePersona(parsePersona(parsed.persona));
  };

  const openCaption = (text: string, opts?: { when?: string | null; recycle?: boolean }) => {
    const merch = result?.merchUrl || profile?.merch[0]?.url || undefined;
    setPrefill({
      message: text,
      pageId: selected?.id,
      mediaType: "Photo",
      imagePrompt: result?.imagePrompt || undefined,
      when: opts?.when || undefined,
      link: merch,
      firstComment: merch ? `Shop: ${merch}` : undefined,
      recycleAfterDays: opts?.recycle ? 30 : undefined,
    });
    void navigate({ to: "/composer" });
  };

  const followHop = (hop: AgentResult["hops"][number]) => {
    if (hop.kind === "composer" && hop.caption) {
      openCaption(hop.caption);
      return;
    }
    if (hop.kind === "schedule" && hop.caption) {
      openCaption(hop.caption, { when: result?.nextSlot || scheduleWhenForPage(selected?.posting_slots_json) });
      return;
    }
    if (hop.kind === "later") {
      if (hop.ideaId && hop.caption) {
        openCaption(hop.caption);
        return;
      }
      if (hop.caption) {
        void saveIdeaFn({
          data: {
            pageId: selected?.id,
            title: (hop.caption.split(/[\n.?!]/)[0] ?? "Idea").slice(0, 60),
            body: hop.caption,
            mediaType: "Photo",
            notes: "caption-ready",
          },
        })
          .then(() => {
            toast.success("Parked on Later. Nothing posted.");
            void navigate({ to: "/later" });
          })
          .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"));
        return;
      }
      void navigate({ to: "/later" });
      return;
    }
    if (hop.kind === "inbox") {
      void navigate({ to: "/inbox", search: { comment: hop.commentId, page: selected?.id } });
      return;
    }
    if (hop.kind === "vault" || hop.kind === "settings") {
      void navigate({ to: "/settings" });
      return;
    }
    if (hop.kind === "calendar") {
      void navigate({ to: "/calendar" });
      return;
    }
    if (hop.kind === "merch") {
      void navigate({ to: "/merchandise" });
      return;
    }
    if (hop.kind === "analytics") {
      void navigate({ to: "/analytics" });
      return;
    }
    if (hop.kind === "media") {
      void navigate({ to: "/media" });
      return;
    }
    if (hop.kind === "pair") {
      void navigate({ to: "/pair" });
      return;
    }
    if (hop.kind === "connect") {
      void navigate({ to: "/connect" });
      return;
    }
    if (hop.kind === "home") {
      void navigate({ to: "/" });
      return;
    }
    if (hop.kind === "failed") {
      if (hop.postId) useInspectorStore.getState().open(hop.postId);
      void navigate({ to: "/drafts", search: { tab: "failed" } });
      return;
    }
    if (hop.kind === "drafts") {
      if (hop.postId) useInspectorStore.getState().open(hop.postId);
      void navigate({ to: "/drafts", search: { tab: "queued" } });
      return;
    }
    if (hop.postId) {
      useInspectorStore.getState().open(hop.postId);
    }
    void navigate({ to: "/drafts" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <PageHeader
        title="Desk agent"
        hint="Profiles this Page from your desk (not a Facebook scrape), searches the public web, takes notes, then drafts captions. It cannot publish, like, follow, or reply. You click Publish and Send. Diagnose Server is a research brief that reads desk health — not a separate diagnostic API."
        line="Research and draft. The ops card is this desk — Diagnose reads it; you still click Send."
      >
        {health ? (
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
            DB {health.db} · ticker{" "}
            {health.schedulerFresh ? "fresh" : health.schedulerLastTick ? relativeTime(health.schedulerLastTick) : "idle"}{" "}
            · worker {health.workerFresh ? "fresh" : health.workerLastTick ? relativeTime(health.workerLastTick) : "idle"}
          </span>
        ) : null}
      </PageHeader>

      {snapshot ? (
        <div className="rounded-xl bg-card p-4 text-[13px] shadow-card">
          <div className="font-semibold">What’s on this desk</div>
          <p className="mt-1 text-muted-foreground">
            {snapshot.pages.total} Pages ({snapshot.pages.live} live). Queue: {snapshot.queue.localDraft} drafts,{" "}
            {snapshot.queue.localScheduled} local-scheduled, {snapshot.queue.facebookScheduled} on Facebook,{" "}
            {snapshot.queue.failed} failed, {snapshot.queue.overdue} overdue. Inbox {snapshot.inbox.needsReply}. Vault{" "}
            {snapshot.vault.alarm}.
            {snapshot.cadence
              ? ` This Page cadence ${snapshot.cadence.postedLast24h}/${snapshot.cadence.blockAt} (${snapshot.cadence.level}); Reels ${snapshot.cadence.reelLast24h}/30 (${snapshot.cadence.reelLevel}).`
              : ""}
            {snapshot.quota.source
              ? ` Graph ${snapshot.quota.source} ${snapshot.quota.callCountPct ?? "?"}%`
              : ""}
          </p>
          {snapshot.needs.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {snapshot.needs.slice(0, 5).map((n) => (
                <li key={n.title}>
                  {n.title}
                  {n.pageName ? ` · ${n.pageName}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">Nothing in Needs you.</p>
          )}
          {(snapshot.ideas?.length ?? 0) > 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Later: {snapshot.ideas.slice(0, 3).map((i) => i.title).join(" · ")}
              {snapshot.ideas.length > 3 ? ` (+${snapshot.ideas.length - 3})` : ""}
            </p>
          ) : null}
          {(snapshot.recentRuns?.length ?? 0) > 0 ? (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Last run: {snapshot.recentRuns[0]?.persona ?? "research"} — {snapshot.recentRuns[0]?.prompt.slice(0, 80)}
            </p>
          ) : null}
          {snapshot.waitingComments.length > 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Inbox: {snapshot.waitingComments[0]?.author} — {snapshot.waitingComments[0]?.message.slice(0, 80)}
              {snapshot.waitingComments.length > 1 ? ` (+${snapshot.waitingComments.length - 1})` : ""}
            </p>
          ) : null}
          <div className="mt-3">
            <Happenings
              logs={snapshot.logs.map((l, i) => ({
                id: `${l.scope}-${i}`,
                level: l.level,
                scope: l.scope,
                message: l.message,
                createdAt: l.createdAt,
              }))}
              empty="Nothing in the desk log yet. Ticks, publishes, and Agent runs land here."
              onAsk={(row) => {
                setPrompt(
                  `What's happening with ${happeningScopeLabel(row.scope)}? ${row.message} Use DESK OPS. Do not invent Graph calls.`,
                );
                run({
                  brief: `What's happening with ${happeningScopeLabel(row.scope)}? ${row.message} Use DESK OPS. Do not invent Graph calls.`,
                  persona: "ops",
                });
              }}
            />
          </div>
          {snapshot.failed.length > 0 ? (
            <p className="mt-2 text-[12px] text-destructive">
              Latest fail: {snapshot.failed[0]?.pageName} — {snapshot.failed[0]?.error.slice(0, 160)}
            </p>
          ) : null}
          {snapshot.facebookLastError ? (
            <p className="mt-1 text-[12px] text-destructive">Facebook: {snapshot.facebookLastError}</p>
          ) : null}
          <p className="mt-2 text-[12px] text-muted-foreground">
            Diagnose / What’s happening is a brief that attaches this snapshot. It does not call Graph.
          </p>
        </div>
      ) : !health ? (
        <div className="rounded-xl bg-card p-4 text-[13px] shadow-card">
          <div className="font-semibold">Desk snapshot unavailable</div>
          <p className="mt-1 text-muted-foreground">The Agent can still draft from the Page profile. Retry the snapshot if the desk looks empty.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected?.id) return;
              void deskSnapshotFn({ data: { pageId: selected.id } })
                .then((snap) => {
                  setSnapshot(snap);
                  if (snap.health) setHealth(snap.health);
                })
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load desk snapshot"));
            }}
          >
            Retry snapshot
          </Button>
        </div>
      ) : health ? (
        <div className="rounded-xl bg-card p-4 text-[13px] shadow-card">
          <div className="font-semibold">Desk health</div>
          <p className="mt-1 text-muted-foreground">
            Database {health.db}. In-tab ticker{" "}
            {health.schedulerFresh ? "fresh" : health.schedulerLastTick ? `last ${relativeTime(health.schedulerLastTick)}` : "has not run"}.
            Background worker {health.workerFresh ? "fresh" : "idle"}.
          </p>
        </div>
      ) : null}

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !selected}
              onClick={() => run({ mapPage: true })}
            >
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
          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Personas</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(Object.values(PERSONAS) as (typeof PERSONAS)[AgentPersonaId][]).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-[12px] hover:bg-muted ${
                    (result?.persona ?? activePersona ?? lastPersona) === p.id
                      ? "border-foreground bg-muted font-medium"
                      : "border-border"
                  }`}
                  title={p.hint}
                  disabled={busy || !selected}
                  onClick={() => {
                    setPrompt(p.starter);
                    setActivePersona(p.id);
                    run({ brief: p.starter, persona: p.id });
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
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
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-[13px]">
            <span className="font-medium">Caption model</span>
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={textProvider}
              onChange={(e) => {
                const v = e.target.value;
                setTextProvider(v);
                void savePrefs({ data: { defaultTextProvider: v } });
              }}
            >
              {TEXT_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {settings?.providers[p.id as keyof NonNullable<typeof settings>["providers"]] ? "" : p.needsKey ? " — add key" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[13px]">
            <span className="font-medium">Image model</span>
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={imageProvider}
              onChange={(e) => {
                const v = e.target.value;
                setImageProvider(v);
                void savePrefs({ data: { defaultImageProvider: v } });
              }}
            >
              {IMAGE_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {settings?.providers[p.id as keyof NonNullable<typeof settings>["providers"]] ? "" : p.needsKey ? " — add key" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
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
          {busy ? (
            <Button type="button" variant="outline" onClick={stopWaiting}>
              Stop waiting
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={busy || !selected} onClick={() => run({ mapPage: true })}>
            {busy ? "Mapping…" : "Map this Page"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !selected}
            onClick={() =>
              run({
                persona: "research",
                brief:
                  profile?.suggestedBriefs[0] ||
                  "Find a timely local or national angle I can post today in this Page’s voice. Facts only. One image idea.",
              })
            }
          >
            Today’s angle
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !selected}
            onClick={() =>
              run({
                persona: "ops",
                brief:
                  "Diagnose this desk using the server & desk context already attached to this run. Summarize database, in-tab ticker, background worker, Needs you items, and recent logs. Do not invent Graph calls or claim you queried a diagnostic API. Draft three short operator notes.",
              })
            }
          >
            Diagnose Server
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !selected}
            onClick={() =>
              run({
                persona: "ops",
                brief:
                  "What's happening on this desk? Using the DESK OPS snapshot already attached, summarize queue, failed Graph publishes, inbox, vault, cadence, worker/ticker, and quota. Do not invent Graph calls. Draft three short operator notes.",
              })
            }
          >
            What’s happening
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !selected}
            onClick={() =>
              run({
                persona: "inbox",
                brief:
                  "Draft inbox replies for waiting comments on this Page. Buying-intent first. A human still clicks Send. Do not post comments yourself.",
              })
            }
          >
            Draft inbox replies
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !selected}
            onClick={() =>
              run({
                persona: "rewrite",
                brief:
                  "Fix failed publishes on this desk. Use DESK OPS. Rewrite each failed caption in this Page's voice (remix). Do not publish — hops open Composer or the inspector.",
              })
            }
          >
            Fix failed publishes
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !selected}
            onClick={() =>
              run({
                persona: "memory",
                brief:
                  "Recall parked Later ideas and recent Agent runs for this Page. Turn the best one into three captions. Do not invent facts that were not parked. Do not publish.",
              })
            }
          >
            Recall Later
          </Button>
        </div>
      </form>

      {runError ? (
        <div className="rounded-xl border border-destructive/40 bg-card p-4 text-sm shadow-card">
          <p className="font-medium text-destructive">This run failed</p>
          <p className="mt-1 text-muted-foreground">{runError}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            type="button"
            disabled={busy || !selected}
            onClick={() => run()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-card">
          {result.refused ? (
            <p className="text-sm text-destructive">{result.refused}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span>{result.liveSearch ? "Live web search" : "No live search — verify before you post"}</span>
                {result.persona ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                    {PERSONAS[result.persona as AgentPersonaId]?.label ?? result.persona}
                  </span>
                ) : null}
                {result.runId ? <span className="tabular-nums">run {result.runId.slice(0, 8)}</span> : null}
              </div>
              {result.skills?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.skills.map((s) => (
                    <span key={s} className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                      {skillLabel(s as Parameters<typeof skillLabel>[0])}
                    </span>
                  ))}
                </div>
              ) : null}
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
              {result.hops.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {result.hops.map((hop) => (
                    <Button key={hop.id} size="sm" variant="outline" type="button" onClick={() => followHop(hop)}>
                      {hop.label}
                    </Button>
                  ))}
                </div>
              ) : null}
              {result.captionPolicy ? (
                <p
                  className={
                    result.captionPolicy.canPublish
                      ? "text-[12px] text-muted-foreground"
                      : "text-[12px] text-destructive"
                  }
                >
                  Policy on Story caption: {result.captionPolicy.canPublish ? "can publish after you edit" : "blocked until rewritten"}
                  {result.captionPolicy.flags.length
                    ? ` — ${result.captionPolicy.flags.map((f) => f.title).join("; ")}`
                    : ""}
                  . You still click Send.
                </p>
              ) : null}
              {result.inboxDrafts.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Inbox drafts (not sent)
                  </div>
                  {result.inboxDrafts.map((d) => (
                    <div key={d.commentId} className="rounded-lg border border-border p-3">
                      <div className="text-[13px] font-medium">
                        {d.author} on {d.pageName}
                        {d.buyingIntent ? " · buying intent" : ""}
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">{d.comment}</p>
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px]">
                        {d.drafts.map((r) => (
                          <li key={r.slice(0, 40)}>{r}</li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        type="button"
                        onClick={() =>
                          void navigate({ to: "/inbox", search: { comment: d.commentId, page: d.pageId || selected?.id } })
                        }
                      >
                        Open in Inbox
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              {result.opsBrief ? (
                <details className="rounded-lg border border-border p-3">
                  <summary className="cursor-pointer text-[13px] font-medium">Desk ops snapshot used for this run</summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {result.opsBrief}
                  </pre>
                </details>
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
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCaption(text)}
                        >
                          Open in Composer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openCaption(text, {
                              when: result.nextSlot || scheduleWhenForPage(selected?.posting_slots_json),
                            })
                          }
                        >
                          Schedule in Composer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openCaption(text, {
                              when: result.nextSlot || scheduleWhenForPage(selected?.posting_slots_json),
                              recycle: true,
                            })
                          }
                        >
                          Schedule + recycle 30d
                        </Button>
                      </div>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[13px] font-medium">{h.prompt}</div>
                    {(() => {
                      const parsed = parseDrafts(h.drafts_json);
                      const persona = parsePersona(parsed.persona);
                      return persona ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                          {PERSONAS[persona].label}
                        </span>
                      ) : null;
                    })()}
                  </div>
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
