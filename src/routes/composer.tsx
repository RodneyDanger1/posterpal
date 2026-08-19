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
  hashtagsFn,
  bootstrapApp,
  merchFn,
  policyFn,
  saveIdeaFn,
  saveSnippetFn,
  snippetsFn,
  imaginePhotoFn,
} from "@/lib/posterpal/fns";
import type { CadenceResult, MerchRow, PageRow, PolicyResult, SnippetRow } from "@/lib/posterpal/types";
import { adoptLivePageId, useShellStore } from "@/lib/store";
import { validateReel } from "@/lib/posterpal/policy";

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
  const setSelectedPageId = useShellStore((s) => s.setSelectedPageId);
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
  const [policy, setPolicy] = useState<PolicyResult | null>(null);
  const [cadence, setCadence] = useState<CadenceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState<{ storytelling: string; cta: string; question: string } | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");

  useEffect(() => {
    void bootstrapApp()
      .then((snap) => {
        setPages(snap.pages);
        adoptLivePageId(
          snap.pages.map((p) => p.id),
          snap.settings.defaultPageId,
        );
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load Composer"));
  }, []);

  useEffect(() => {
    if (!prefill) return;
    setMessage(prefill.message);
    if (prefill.pageId) setSelectedPageId(prefill.pageId);
    if (
      prefill.mediaType === "Photo" ||
      prefill.mediaType === "Carousel" ||
      prefill.mediaType === "Video" ||
      prefill.mediaType === "Reel" ||
      prefill.mediaType === "Story" ||
      prefill.mediaType === "Text"
    ) {
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
    setPrefill(null);
  }, [prefill, setPrefill, setSelectedPageId]);

  const selected = pages.find((p) => p.id === pageId) ?? pages[0];

  useEffect(() => {
    if (!selected) return;
    void merchFn({ data: { pageId: selected.id } })
      .then(setMerch)
      .catch(() => setMerch([]));
    void cadenceFn({ data: { pageId: selected.id } })
      .then(setCadence)
      .catch(() => setCadence(null));
    void snippetsFn({ data: { pageId: selected.id } })
      .then(setSnippets)
      .catch(() => setSnippets([]));
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const t = window.setTimeout(() => {
      void policyFn({
        data: {
          pageId: selected.id,
          message,
          link: link || null,
          merchUrl: merch[0]?.url ?? null,
          hasImages: media.length > 0,
          missingAlt: media.some((m) => !m.altText.trim()),
          createdWithAi: media.some((m) => m.createdWithAi),
        },
      })
        .then(setPolicy)
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(t);
  }, [message, link, media, merch, selected?.id]);

  return {
    pages,
    selected,
    setSelectedPageId,
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
    policy,
    cadence,
    busy,
    setBusy,
    variants,
    setVariants,
    imagePrompt,
    setImagePrompt,
  };
}

function sendLabel(mode: Mode) {
  if (mode === "now") return "Publish now";
  if (mode === "schedule") return "Schedule";
  if (mode === "fb-draft") return "Save Facebook draft";
  return "Save local draft";
}

function Composer() {
  const s = useComposerState();

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
          line={`Posting as ${s.selected.name}${s.selected.is_read_only ? " · analyze-only" : ""}`}
          hint="Ctrl+Enter runs the selected mode. Ctrl+S saves a local draft. Esc clears. Publish now hits Graph immediately. Schedule uses Facebook if the time is 10 minutes–30 days out; otherwise the local scheduler keeps it. Local draft never leaves this machine. Facebook draft is unpublished (published=false, no time)."
        >
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Page</span>
            <select
              aria-label="Posting as"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm transition-colors duration-150"
              value={s.selected.id}
              onChange={(e) => s.setSelectedPageId(e.target.value)}
            >
              {s.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_practice ? " (practice)" : ""}
                  {p.is_read_only ? " (analyze only)" : ""}
                </option>
              ))}
            </select>
          </label>
        </PageHeader>

        {s.cadence?.level !== "ok" && s.cadence ? (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              s.cadence.level === "block" ? "bg-destructive/10 text-destructive" : "bg-warning/20"
            }`}
          >
            {s.cadence.postedLast24h} posts in 24h (warn {s.cadence.warnAt}, block {s.cadence.blockAt}). Identical
            high-frequency posts are a spam risk.
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
                  <Button size="sm" variant={s.mediaType === k ? "default" : "outline"} onClick={() => s.setMediaType(k)}>
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
              <div className="flex flex-wrap gap-2">
                {s.merch.map((m) => (
                  <Button
                    key={m.id}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      s.setLink(applyUtm(m.url, m.utm_template));
                      if (m.cta_override) s.setMessage((prev) => (prev ? `${prev}\n\n${m.cta_override}` : m.cta_override!));
                      toast.message("Merch CTA inserted. Add a branded-content disclosure if this is commercial.");
                    }}
                  >
                    Insert {m.title}
                  </Button>
                ))}
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

            {s.mediaType !== "Text" ? (
              <MediaDrop
                media={s.media}
                setMedia={s.setMedia}
                mediaType={s.mediaType}
                imagePrompt={s.imagePrompt}
                setImagePrompt={s.setImagePrompt}
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
                  <Button size="sm" variant={s.mode === m ? "default" : "secondary"} onClick={() => s.setMode(m)}>
                    {label}
                  </Button>
                </Hint>
              ))}
              {s.mode === "schedule" ? (
                <Hint label="Must be 10 minutes to 30 days from now for Facebook. Sooner or later stays on the local scheduler.">
                  <Input type="datetime-local" className="w-auto" value={s.when} onChange={(e) => s.setWhen(e.target.value)} />
                </Hint>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Hint label="Runs the selected mode: publish, schedule, local draft, or Facebook draft.">
                <Button disabled={s.busy || s.cadence?.level === "block"} onClick={() => void submit(s, s.mode)}>
                  {s.busy ? "Working…" : sendLabel(s.mode)}
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
              <Hint label="Grok writes three variants (story, CTA, question). You pick one. Nothing is posted.">
                <Button
                  variant="outline"
                  disabled={s.busy || !s.message.trim()}
                  onClick={() => {
                    s.setBusy(true);
                    void generateVariantsFn({
                      data: { pageId: s.selected!.id, brief: s.message, merchCta: s.merch[0]?.cta_override },
                    })
                      .then((v) => {
                        s.setVariants(v);
                        if (!v.ai) toast.message("AI key not available — showing local variants.");
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
                    void hashtagsFn({ data: { pageId: s.selected!.id, caption: s.message } })
                      .then((r) => {
                        s.setMessage((m) => `${m.trim()} ${r.tags.join(" ")}`.trim());
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Hashtags failed"));
                  }}
                >
                  Hashtags
                </Button>
              </Hint>
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
                    className="rounded-lg border border-border p-3 text-left text-sm transition-colors duration-150 hover:bg-muted"
                    onClick={() => s.setMessage(text)}
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
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round(p.score * 100)}% · {p.engagement} eng
                  </span>
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
  if (mode === "schedule" && !s.when) {
    toast.error("Pick a date and time to schedule.");
    return;
  }
  s.setBusy(true);
  try {
    const scheduledAt = s.when ? new Date(s.when).toISOString() : null;
    const result = await composeFn({
      data: {
        pageId: s.selected.id,
        message: s.message,
        link: s.link || null,
        firstComment: s.firstComment || null,
        mediaType: s.mediaType,
        mode,
        scheduledAt,
        merchUrl: s.merch[0]?.url ?? null,
        media: s.media,
        variantLabel: undefined,
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

function applyUtm(url: string, template?: string | null) {
  if (!template) return url;
  const u = new URL(url, "https://example.invalid");
  for (const part of template.split("&")) {
    const [k, v] = part.split("=");
    if (k) u.searchParams.set(k, (v ?? "").replace("{slug}", "post"));
  }
  return u.toString();
}

function MediaDrop({
  media,
  setMedia,
  mediaType,
  imagePrompt,
  setImagePrompt,
  caption,
  busy,
  setBusy,
}: {
  media: MediaFile[];
  setMedia: (m: MediaFile[]) => void;
  mediaType: MediaKind;
  imagePrompt: string;
  setImagePrompt: (v: string) => void;
  caption: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  return (
    <div
      className="rounded-lg border border-dashed border-input p-4 transition-colors duration-150"
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
        Local files upload to Graph as multipart (photos/videos) or rupload (Reels/Stories). Public https URLs also work.
        Reels: 9:16, 3–60s, min 540×960. Max 12MB per file.
      </p>
      {mediaType === "Photo" || mediaType === "Carousel" ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label htmlFor="imagine-prompt">Generate with Grok Imagine</Label>
            <Input
              id="imagine-prompt"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder={caption.slice(0, 80) || "A quiet bookstore window at dusk, no text"}
            />
          </div>
          <Hint label="Creates one still image with grok-imagine-image. Marked as AI media. You still click Send to post.">
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
                void imaginePhotoFn({ data: { prompt } })
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
    if (file.size > 12_000_000) {
      toast.error(`${file.name} is over 12MB. Compress it, or paste a public https URL as the Link for Graph to fetch.`);
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
