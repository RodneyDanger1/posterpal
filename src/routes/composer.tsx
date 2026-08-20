import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/ui/tooltip";
import {
  cadenceFn,
  composeFn,
  generateVariantsFn,
  getSettingsFn,
  hashtagsFn,
  bootstrapApp,
  merchFn,
  mediaLibraryFn,
  policyFn,
  saveIdeaFn,
  saveSnippetFn,
  snippetsFn,
  imaginePhotoFn,
} from "@/lib/posterpal/fns";
import { applyUtm, captionHint, captionStats, countHashtags, hasCallToAction, isQuietHour, suggestedIndustrySlot, trimHashtags } from "@/lib/posterpal/operator";
import { IMAGE_PROVIDERS, TEXT_PROVIDERS } from "@/lib/posterpal/providers";
import type { CadenceResult, MediaLibraryItem, MerchRow, PageRow, PolicyResult, SettingsBag, SnippetRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { validateReel } from "@/lib/posterpal/policy";
import { copyText } from "@/lib/utils";

export const Route = createFileRoute("/composer")({ component: ComposerPage });

type Mode = "now" | "schedule" | "local-draft" | "fb-draft";
type MediaKind = "Text" | "Photo" | "Carousel" | "Video" | "Reel" | "Story";

type MediaFile = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  width?: number;
  height?: number;
  durationMs?: number;
  altText: string;
  createdWithAi: boolean;
};

function ComposerPage() {
  return (
    <Guard>
      <Composer />
    </Guard>
  );
}

function useComposerState() {
  const pageId = useShellStore((s) => s.selectedPageId);
  const setPageId = useShellStore((s) => s.setSelectedPageId);
  const prefill = useShellStore((s) => s.composerPrefill);
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [mode, setMode] = useState<Mode>("local-draft");
  const [when, setWhen] = useState("");
  const [mediaType, setMediaType] = useState<MediaKind>("Text");
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [merch, setMerch] = useState<MerchRow[]>([]);
  const [snippets, setSnippets] = useState<SnippetRow[]>([]);
  const [library, setLibrary] = useState<MediaLibraryItem[]>([]);
  const [policy, setPolicy] = useState<PolicyResult | null>(null);
  const [cadence, setCadence] = useState<CadenceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState<{ storytelling: string; cta: string; question: string } | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [selectedMerchId, setSelectedMerchId] = useState<string | null>(null);
  const [shopInFirstComment, setShopInFirstComment] = useState(false);
  const [textProvider, setTextProvider] = useState("grok");
  const [imageProvider, setImageProvider] = useState("grok");
  const [variantLabel, setVariantLabel] = useState<string | null>(null);
  const [variantGroupId, setVariantGroupId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsBag | null>(null);

  useEffect(() => {
    void bootstrapApp().then((snap) => setPages(snap.pages));
    void getSettingsFn().then((s) => {
      setSettings(s);
      setTextProvider(s.defaultTextProvider);
      setImageProvider(s.defaultImageProvider);
    });
  }, []);

  useEffect(() => {
    if (!prefill) return;
    setMessage(prefill.message);
    if (prefill.pageId) setPageId(prefill.pageId);
    if (prefill.mediaType === "Photo" || prefill.mediaType === "Carousel" || prefill.mediaType === "Video" || prefill.mediaType === "Reel" || prefill.mediaType === "Story" || prefill.mediaType === "Text") {
      setMediaType(prefill.mediaType);
    }
    if (prefill.media?.length) {
      setMedia(
        prefill.media.map((m) => ({
          fileName: m.fileName,
          mimeType: m.mimeType,
          dataUrl: m.dataUrl,
          altText: m.altText,
          createdWithAi: m.createdWithAi,
        })),
      );
    }
    if (prefill.when) {
      setWhen(prefill.when);
      setMode("schedule");
    }
    setPrefill(null);
  }, [prefill, setPrefill, setPageId]);

  const selected = pages.find((p) => p.id === pageId) ?? pages[0];

  useEffect(() => {
    if (!selected) return;
    void merchFn({ data: { pageId: selected.id } }).then(setMerch);
    void cadenceFn({ data: { pageId: selected.id } }).then(setCadence);
    void snippetsFn({ data: { pageId: selected.id } }).then(setSnippets);
    void mediaLibraryFn({ data: { pageId: selected.id } })
      .then(setLibrary)
      .catch(() => setLibrary([]));
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const t = window.setTimeout(() => {
      void policyFn({
        data: {
          pageId: selected.id,
          message,
          link: link || null,
          merchUrl: (merch.find((m) => m.id === selectedMerchId) ?? merch[0])?.url ?? null,
          hasImages: media.length > 0,
          missingAlt: media.some((m) => !m.altText.trim()),
          createdWithAi: media.some((m) => m.createdWithAi),
        },
      }).then(setPolicy);
    }, 250);
    return () => window.clearTimeout(t);
  }, [message, link, media, merch, selected?.id, selectedMerchId]);

  return {
    pages,
    selected,
    setPageId,
    message,
    setMessage,
    link,
    setLink,
    firstComment,
    setFirstComment,
    mode,
    setMode,
    when,
    setWhen,
    mediaType,
    setMediaType,
    media,
    setMedia,
    merch,
    snippets,
    setSnippets,
    library,
    policy,
    cadence,
    busy,
    setBusy,
    variants,
    setVariants,
    imagePrompt,
    setImagePrompt,
    selectedMerchId,
    setSelectedMerchId,
    shopInFirstComment,
    setShopInFirstComment,
    textProvider,
    setTextProvider,
    imageProvider,
    setImageProvider,
    variantLabel,
    setVariantLabel,
    variantGroupId,
    setVariantGroupId,
    settings,
  };
}

function Composer() {
  const s = useComposerState();
  const stats = captionStats(s.message);
  const tags = countHashtags(s.message);
  const reuse = s.library.filter((r) => typeof r.data_url === "string" && r.data_url).slice(0, 6);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit(s, s.mode);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void submit(s, "local-draft");
      }
      if (e.key === "Escape") {
        const el = e.target as HTMLElement | null;
        if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable)) return;
        s.setMessage("");
        s.setMedia([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!s.selected) {
    return (
      <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-card">
        No Pages yet. Open Settings to connect Facebook, or seed practice Pages from the home screen.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto w-full max-w-3xl space-y-4 xl:mx-0">
      <PageHeader
        title="Composer"
        hint={`${s.selected.name}${s.selected.is_read_only ? " · analyze-only" : ""}. Ctrl+Enter sends the selected mode. Ctrl+S saves a local draft. Esc clears. Publish now hits Graph immediately. Schedule uses Facebook if the time is 10 minutes–30 days out; otherwise the local scheduler keeps it. Local draft never leaves this machine. Facebook draft is unpublished (published=false, no time) per the Pages API.`}
      />
      {s.pages.length > 1 ? (
        <label className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Posting as</span>
          <select
            value={s.selected.id}
            onChange={(e) => s.setPageId(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {s.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_practice ? " (practice)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {s.cadence?.level !== "ok" && s.cadence ? (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            s.cadence.level === "block" ? "bg-destructive/10 text-destructive" : "bg-warning/20"
          }`}
        >
          {s.cadence.postedLast24h} posts in 24h (warn {s.cadence.warnAt}, block {s.cadence.blockAt}). Identical high-frequency posts are a spam risk.
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-1">
            {(["Text", "Photo", "Carousel", "Video", "Reel", "Story"] as MediaKind[]).map((k) => (
              <Hint
                key={k}
                label={
                  k === "Text"
                    ? "Caption only, optional link."
                    : k === "Photo"
                      ? "One image. Multipart source or a public https URL."
                      : k === "Carousel"
                        ? "Two or more images, unpublished then attached_media."
                        : k === "Video"
                          ? "/{page}/videos. Needs publish_video."
                          : k === "Reel"
                            ? "9:16, 3–60s, min 540×960. rupload."
                            : "24h Story via photo_stories or video_stories."
                }
              >
                <Button
                  size="sm"
                  variant={s.mediaType === k ? "default" : "outline"}
                  onClick={() => s.setMediaType(k)}
                >
                  {k}
                </Button>
              </Hint>
            ))}
          </div>
          <Textarea
            value={s.message}
            onChange={(e) => s.setMessage(e.target.value)}
            placeholder="Write the caption…"
            className="min-h-40 text-[15px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
            <span className="tabular-nums">
              {stats.chars} chars · {stats.words} words · {tags} #
            </span>
            <span>{captionHint(stats.level)}</span>
          </div>
          {s.message.trim() && !hasCallToAction(s.message) ? (
            <p className="text-[12px] text-muted-foreground">No question or CTA yet. Optional.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Link</Label>
              <Input value={s.link} onChange={(e) => s.setLink(e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label>First comment (posted on Graph right after a live publish)</Label>
              <Input value={s.firstComment} onChange={(e) => s.setFirstComment(e.target.value)} />
            </div>
          </div>
          {s.merch.length > 0 ? (
            <div className="space-y-2">
              <Label>Product for this post</Label>
              <div className="flex flex-wrap gap-2">
                {s.merch.map((m) => (
                  <Button
                    key={m.id}
                    size="sm"
                    variant={s.selectedMerchId === m.id ? "default" : "outline"}
                    onClick={() => {
                      s.setSelectedMerchId(m.id);
                      s.setLink(applyUtm(m.url, m.utm_template));
                      if (m.cta_override) s.setMessage((prev) => (prev ? `${prev}\n\n${m.cta_override}` : m.cta_override!));
                      if (s.shopInFirstComment) {
                        s.setFirstComment(applyUtm(m.url, m.utm_template, "first-comment"));
                      }
                      toast.message("Merch CTA inserted. Add a branded-content disclosure if this is commercial.");
                    }}
                  >
                    {m.title}
                  </Button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={s.shopInFirstComment}
                  onChange={(e) => {
                    const on = e.target.checked;
                    s.setShopInFirstComment(on);
                    const m = s.merch.find((x) => x.id === s.selectedMerchId) ?? s.merch[0];
                    if (on && m) s.setFirstComment(applyUtm(m.url, m.utm_template, "first-comment"));
                  }}
                />
                Drop the shop URL in the first comment (keeps the caption clean; Graph posts it after a live publish)
              </label>
            </div>
          ) : null}

          {s.snippets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {s.snippets.map((sn) => (
                <Hint key={sn.id} label="Insert this remembered caption into the box.">
                  <Button size="sm" variant="outline" onClick={() => s.setMessage(sn.body)}>
                    {sn.label}
                  </Button>
                </Hint>
              ))}
            </div>
          ) : null}

          {s.mediaType !== "Text" && reuse.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {reuse.map((r) => (
                <button
                  key={String(r.id)}
                  type="button"
                  className="overflow-hidden rounded-md border border-border"
                  title={`Reuse ${String(r.file_name)}`}
                  onClick={() => {
                    s.setMedia([
                      ...s.media,
                      {
                        fileName: String(r.file_name),
                        mimeType: String(r.mime_type ?? "image/jpeg"),
                        dataUrl: String(r.data_url),
                        altText: String(r.alt_text ?? ""),
                        createdWithAi: false,
                      },
                    ]);
                    toast.message("Attached from the library. Review alt text.");
                  }}
                >
                  {String(r.data_url).startsWith("data:image") || String(r.data_url).startsWith("http") ? (
                    <img src={String(r.data_url)} alt="" className="size-12 object-cover" />
                  ) : (
                    <span className="grid size-12 place-items-center text-[10px]">file</span>
                  )}
                </button>
              ))}
            </div>
          ) : null}

          {s.mediaType !== "Text" ? (
            <MediaDrop
              media={s.media}
              setMedia={s.setMedia}
              mediaType={s.mediaType}
              imagePrompt={s.imagePrompt}
              setImagePrompt={s.setImagePrompt}
              imageProvider={s.imageProvider}
              caption={s.message}
              busy={s.busy}
              setBusy={s.setBusy}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["now", "Publish now", "POST to Graph immediately using the Page token."],
                ["schedule", "Schedule", "Facebook if 10 minutes–30 days; otherwise LocalScheduled until the desk is open."],
                ["local-draft", "Local draft", "Stay on this desk. Never sent until you click Publish now."],
                ["fb-draft", "Facebook draft", "unpublished Graph post (published=false, no scheduled time)."],
              ] as const
            ).map(([m, label, hint]) => (
              <Hint key={m} label={hint}>
                <Button
                  size="sm"
                  variant={s.mode === m ? "default" : "secondary"}
                  onClick={() => {
                    s.setMode(m);
                    if (m === "schedule" && !s.when) s.setWhen(suggestedIndustrySlot());
                  }}
                >
                  {label}
                </Button>
              </Hint>
            ))}
            {s.mode === "schedule" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Hint label="Must be 10 minutes to 30 days from now for Facebook. Sooner or later stays on the local scheduler.">
                  <Input
                    type="datetime-local"
                    className="w-auto"
                    value={s.when}
                    onChange={(e) => s.setWhen(e.target.value)}
                  />
                </Hint>
                <Hint label="Fills the next midweek 1pm local slot — Sprout's 2026 Facebook peak (Tue/Wed 12–8pm). Replace with this Page's own best hour from Analytics once you have history.">
                  <Button size="sm" variant="outline" type="button" onClick={() => s.setWhen(suggestedIndustrySlot())}>
                    Suggested hour
                  </Button>
                </Hint>
              </div>
            ) : null}
            {s.mode === "schedule" && s.when && isQuietHour(s.when) ? (
              <p className="w-full text-[12px] text-warning">Quiet hours (11pm–6am). Reach is usually thinner then.</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Hint label="Runs the selected mode: publish, schedule, local draft, or Facebook draft.">
              <Button disabled={s.busy || s.cadence?.level === "block"} onClick={() => void submit(s, s.mode)}>
                {s.busy ? "Working…" : "Send"}
              </Button>
            </Hint>
            <Hint label="Park this caption on the Later board. Does not create a post and does not touch Facebook.">
              <Button
                variant="outline"
                disabled={s.busy || !s.message.trim()}
                onClick={() => {
                  void saveIdeaFn({
                    data: { pageId: s.selected!.id, body: s.message, mediaType: s.mediaType },
                  })
                    .then(() => toast.success("Saved to Later."))
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"));
                }}
              >
                Save for later
              </Button>
            </Hint>
            <Hint label="Remember this caption as a reusable snippet for this Page.">
              <Button
                variant="outline"
                disabled={s.busy || !s.message.trim()}
                onClick={() => {
                  void saveSnippetFn({
                    data: { pageId: s.selected!.id, label: s.message.slice(0, 40), body: s.message },
                  })
                    .then(() => {
                      toast.success("Snippet remembered.");
                      return snippetsFn({ data: { pageId: s.selected!.id } }).then(s.setSnippets);
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Snippet failed"));
                }}
              >
                Remember caption
              </Button>
            </Hint>
            <Hint label="Copy the caption without posting.">
              <Button
                variant="outline"
                disabled={!s.message.trim()}
                onClick={() => {
                  void copyText(s.message).then((ok) =>
                    toast[ok ? "success" : "error"](ok ? "Caption copied." : "Could not copy."),
                  );
                }}
              >
                Copy
              </Button>
            </Hint>
            <Hint label="Writes three variants (story, CTA, question) with the selected caption model. You pick one. Nothing is posted.">
              <Button
                variant="outline"
                disabled={s.busy || !s.message.trim()}
                onClick={() => {
                  s.setBusy(true);
                  const merch = s.merch.find((m) => m.id === s.selectedMerchId) ?? s.merch[0];
                  void generateVariantsFn({
                    data: {
                      pageId: s.selected!.id,
                      brief: s.message,
                      merchCta: merch?.cta_override,
                      provider: s.textProvider,
                    },
                  })
                    .then((v) => {
                      s.setVariants(v);
                      if (!s.variantGroupId) s.setVariantGroupId(crypto.randomUUID());
                      if (!v.ai) toast.message("No key for that model — showing local variants. Add a key in Settings.");
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Variant failed"))
                    .finally(() => s.setBusy(false));
                }}
              >
                3 variants
              </Button>
            </Hint>
            <Hint label="Appends up to 6 relevant hashtags. Max 3 in a live caption is the policy default.">
              <Button
                variant="outline"
                disabled={s.busy || !s.message.trim()}
                onClick={() => {
                  void hashtagsFn({ data: { pageId: s.selected!.id, caption: s.message, provider: s.textProvider } })
                    .then((r) => {
                      s.setMessage((m) => `${m.trim()} ${r.tags.join(" ")}`.trim());
                    })
                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Hashtags failed"));
                }}
              >
                Hashtags
              </Button>
            </Hint>
            {tags > 3 ? (
              <Hint label="Keeps the first 3 hashtags. Policy default.">
                <Button variant="outline" onClick={() => s.setMessage(trimHashtags(s.message, 3))}>
                  Trim extra #
                </Button>
              </Hint>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Caption model</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={s.textProvider}
                onChange={(e) => s.setTextProvider(e.target.value)}
              >
                {TEXT_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {s.settings?.providers[p.id as keyof NonNullable<typeof s.settings>["providers"]] ? "" : p.needsKey ? " — add key" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Image model</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={s.imageProvider}
                onChange={(e) => s.setImageProvider(e.target.value)}
              >
                {IMAGE_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {s.settings?.providers[p.id as keyof NonNullable<typeof s.settings>["providers"]] ? "" : p.needsKey ? " — add key" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {s.variants ? (
            <div className="grid gap-2">
              {(
                [
                  ["Storytelling", s.variants.storytelling],
                  ["Direct CTA", s.variants.cta],
                  ["Question", s.variants.question],
                ] as const
              ).map(([label, text]) => (
                <button
                  key={label}
                  type="button"
                  className="rounded-lg border border-border p-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    s.setMessage(text);
                    s.setVariantLabel(label);
                    if (!s.variantGroupId) s.setVariantGroupId(crypto.randomUUID());
                  }}
                >
                  <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
                  {text}
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>
      <aside className="rounded-xl bg-card p-4 shadow-card xl:sticky xl:top-4">
        <h2 className="text-[13px] font-semibold">Policy checklist</h2>
        {!s.policy ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Flags appear as you write.</p>
        ) : s.policy.flags.length === 0 ? (
          <p className="mt-2 text-[13px] text-success">Clear to publish.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {s.policy.flags.map((f) => (
              <li key={f.id} className="text-[13px]">
                <span className="font-semibold">{f.title}</span>
                <span className="mt-0.5 block text-muted-foreground">{f.detail}</span>
              </li>
            ))}
          </ul>
        )}
        {s.policy && s.policy.similar.length > 0 ? (
          <section className="mt-4">
            <h2 className="text-[13px] font-semibold">Similar past posts</h2>
            <ul className="mt-2 space-y-2">
              {s.policy.similar.map((p) => (
                <li key={p.id} className="text-[13px]">
                  <span className="tabular-nums text-muted-foreground">{Math.round(p.score * 100)}% · {p.engagement} eng</span>
                  <span className="mt-0.5 line-clamp-3 block">{p.message}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {s.cadence ? (
          <section className="mt-4">
            <h2 className="text-[13px] font-semibold">Cadence</h2>
            <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
              {s.cadence.postedLast24h} / warn {s.cadence.warnAt} / block {s.cadence.blockAt} in 24h
            </p>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

async function submit(s: ReturnType<typeof useComposerState>, mode: Mode) {
  if (!s.selected) return;
  if (s.policy && !s.policy.canPublish && mode !== "local-draft") {
    toast.error("Policy checklist blocked this publish. Fix the blocking flags or save a local draft.");
    return;
  }
  if (s.cadence?.level === "block" && mode !== "local-draft") {
    toast.error("Cadence hard cap reached.");
    return;
  }
  s.setBusy(true);
  try {
    const scheduledAt = s.when ? new Date(s.when).toISOString() : null;
    const merch = s.merch.find((m) => m.id === s.selectedMerchId) ?? s.merch[0];
    const result = await composeFn({
      data: {
        pageId: s.selected.id,
        message: s.message,
        link: s.link || null,
        firstComment:
          s.firstComment ||
          (s.shopInFirstComment && merch ? applyUtm(merch.url, merch.utm_template, "first-comment") : null),
        mediaType: s.mediaType,
        mode,
        scheduledAt,
        merchUrl: merch?.url ?? null,
        media: s.media,
        variantLabel: s.variantLabel,
        variantGroupId: s.variantGroupId,
      },
    });
    toast.success(`${result.status}${result.warning ? " — " + result.warning : ""}`);
    if (mode !== "local-draft") {
      s.setMessage("");
      s.setMedia([]);
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Publish failed");
  } finally {
    s.setBusy(false);
  }
}

function MediaDrop({
  media,
  setMedia,
  mediaType,
  imagePrompt,
  setImagePrompt,
  imageProvider,
  caption,
  busy,
  setBusy,
}: {
  media: MediaFile[];
  setMedia: (m: MediaFile[]) => void;
  mediaType: MediaKind;
  imagePrompt: string;
  setImagePrompt: (v: string) => void;
  imageProvider: string;
  caption: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  return (
    <div
      className="rounded-lg border border-dashed border-input p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void ingestFiles(Array.from(e.dataTransfer.files), media, setMedia, mediaType);
      }}
    >
      <Label className="block cursor-pointer">
        Drop media or browse
        <input
          type="file"
          className="sr-only"
          accept={mediaType === "Video" || mediaType === "Reel" ? "video/*,image/*" : "image/*"}
          multiple={mediaType === "Carousel"}
          onChange={(e) => {
            void ingestFiles(Array.from(e.target.files ?? []), media, setMedia, mediaType);
            e.target.value = "";
          }}
        />
      </Label>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Local files upload to Graph as multipart (photos/videos) or rupload (Reels/Stories). Public https URLs also work. Reels: 9:16, 3–60s, min 540×960. Max 6MB per file in Composer (bigger files: paste a public https URL as the Link).
      </p>
      {mediaType === "Photo" || mediaType === "Carousel" ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label htmlFor="imagine-prompt">Generate a still</Label>
            <Input
              id="imagine-prompt"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder={caption.slice(0, 80) || "A quiet bookstore window at dusk, no text"}
            />
          </div>
          <Hint label="Creates one still with the selected image model. Marked as AI media. You still click Send to post.">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                const prompt = imagePrompt.trim() || caption.trim();
                if (!prompt) {
                  toast.error("Describe the photo first.");
                  return;
                }
                setBusy(true);
                void imaginePhotoFn({ data: { prompt, provider: imageProvider } })
                  .then((r) => {
                    if ("error" in r) {
                      toast.error(r.error);
                      return;
                    }
                    setMedia([
                      ...media,
                      {
                        fileName: r.fileName,
                        mimeType: "image/png",
                        dataUrl: r.dataUrl,
                        altText: prompt.slice(0, 200),
                        createdWithAi: true,
                      },
                    ]);
                    toast.success("Image added. Review alt text, then send.");
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Imagine failed"))
                  .finally(() => setBusy(false));
              }}
            >
              Generate image
            </Button>
          </Hint>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {media.map((m, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {m.mimeType.startsWith("image") && m.dataUrl.startsWith("data:image") ? (
              <img src={m.dataUrl} alt="" className="size-12 rounded-md object-cover" />
            ) : (
              <span className="grid size-12 place-items-center rounded-md bg-muted text-[11px]">file</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate">{m.fileName}</div>
              <Input
                className="mt-1 h-8"
                placeholder="Alt text"
                value={m.altText}
                onChange={(e) => {
                  const next = media.slice();
                  next[i] = { ...m, altText: e.target.value };
                  setMedia(next);
                }}
              />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setMedia(media.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function ingestFiles(
  files: File[],
  current: MediaFile[],
  setMedia: (m: MediaFile[]) => void,
  mediaType: MediaKind,
) {
  const next = [...current];
  for (const file of files) {
    if (file.size > 6_000_000) {
      toast.error(`${file.name} is over 6MB. Compress it, or paste a public https URL as the Link for Graph to fetch.`);
      continue;
    }
    const dataUrl = await readDataUrl(file);
    const meta = await probeMedia(file, dataUrl);
    if (mediaType === "Reel") {
      const err = validateReel(meta);
      if (err) {
        toast.error(err);
        continue;
      }
    }
    next.push({
      fileName: file.name,
      mimeType: file.type,
      dataUrl,
      width: meta.width,
      height: meta.height,
      durationMs: meta.durationMs,
      altText: "",
      createdWithAi: false,
    });
  }
  setMedia(next);
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function probeMedia(file: File, dataUrl: string): Promise<{ width?: number; height?: number; durationMs?: number }> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = dataUrl;
      return;
    }
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        resolve({
          width: v.videoWidth,
          height: v.videoHeight,
          durationMs: Math.round((v.duration || 0) * 1000),
        });
      };
      v.onerror = () => resolve({});
      v.src = dataUrl;
      return;
    }
    resolve({});
  });
}
