import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { imaginePhotoFn, mediaLibraryFn, getSettingsFn } from "@/lib/posterpal/fns";
import { inferMediaKind } from "@/lib/posterpal/operator";
import { IMAGE_PROVIDERS } from "@/lib/posterpal/providers";
import type { MediaLibraryItem, SettingsBag } from "@/lib/posterpal/types";
import { useAgentBriefStore, useShellStore } from "@/lib/store";

export const Route = createFileRoute("/media")({ component: () => <Guard><Media /></Guard> });

function Media() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const navigate = useNavigate();
  const [rows, setRows] = useState<MediaLibraryItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("grok");
  const [settings, setSettings] = useState<SettingsBag | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void mediaLibraryFn({ data: { pageId } })
      .then(setRows)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load media"));
  }, [pageId]);
  useEffect(() => {
    void getSettingsFn().then((s) => {
      setSettings(s);
      setProvider(s.defaultImageProvider);
    });
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Media library"
        hint="Files attached to posts plus generated stills stored on this desk (they survive closing Composer and the phone). Generate with Grok, Gemini, OpenAI, or Flux — then caption in Composer. AI images must be disclosed."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            useAgentBriefStore.getState().queue(
              "Write a photoreal still prompt for this Page, then a matching caption. No text overlay, no logos. Do not publish.",
              "research",
            );
            void navigate({ to: "/agent" });
          }}
        >
          Ask agent
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-card p-4 shadow-card">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-[13px] font-medium" htmlFor="lib-imagine">Generate a photo</label>
          <Input
            id="lib-imagine"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Bookstore window at dusk, no text, no logos"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[13px] font-medium" htmlFor="lib-provider">Model</label>
          <select
            id="lib-provider"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {IMAGE_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {settings?.providers[p.id as keyof NonNullable<typeof settings>["providers"]] ? "" : p.needsKey ? " — add key" : ""}
              </option>
            ))}
          </select>
        </div>
        <Hint label="One image per click. Spends the selected model's quota. Nothing is posted until you send it from Composer.">
          <Button
            disabled={busy}
            onClick={() => {
              if (prompt.trim().length < 8) {
                toast.error("Describe the photo.");
                return;
              }
              setBusy(true);
              void imaginePhotoFn({ data: { prompt, provider, pageId } })
                .then((r) => {
                  if ("error" in r) {
                    toast.error(r.error);
                    return;
                  }
                  void mediaLibraryFn({ data: { pageId } }).then(setRows).catch(() => undefined);
                  setPrefill({
                    message: prompt,
                    pageId,
                    mediaType: "Photo",
                    media: [
                      {
                        fileName: r.fileName,
                        mimeType: "image/png",
                        dataUrl: r.dataUrl,
                        altText: prompt.slice(0, 200),
                        createdWithAi: true,
                        assetId: "assetId" in r ? String(r.assetId ?? "") : undefined,
                      },
                    ],
                  });
                  toast.success("Saved to the library and attached — opening Composer.");
                  void navigate({ to: "/composer" });
                })
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Imagine failed"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Generating…" : "Generate"}
          </Button>
        </Hint>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No files on the selected Page yet. Practice photos appear as tiles (no binary stored). Drop a file in Composer or generate one above.
        </p>
      ) : (
        <>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by file name or alt text"
          className="h-11 max-w-sm"
          aria-label="Filter media"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows
            .filter((r) => {
              const q = filter.trim().toLowerCase();
              if (!q) return true;
              return (
                String(r.file_name).toLowerCase().includes(q) ||
                String(r.alt_text ?? "").toLowerCase().includes(q) ||
                String(r.page_name ?? "").toLowerCase().includes(q)
              );
            })
            .map((r) => (
            <figure key={String(r.id)} className="overflow-hidden rounded-xl bg-card shadow-card">
              {typeof r.data_url === "string" && (String(r.data_url).startsWith("data:image") || String(r.data_url).startsWith("http")) ? (
                <img src={String(r.data_url)} alt={String(r.alt_text ?? r.file_name)} className="aspect-square w-full object-cover" />
              ) : (
                <div className="grid aspect-square place-items-center bg-muted text-sm text-muted-foreground">{String(r.media_kind)}</div>
              )}
              <figcaption className="p-2 text-[12px]">
                <div className="truncate font-medium">{String(r.file_name)}</div>
                <div className="truncate text-muted-foreground">{String(r.page_name)}</div>
                {r.alt_text ? <div className="mt-1 line-clamp-2 text-muted-foreground">{String(r.alt_text)}</div> : <div className="mt-1 text-warning">Missing alt text</div>}
                {typeof r.data_url === "string" && r.data_url ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => {
                      const mime = String(r.mime_type ?? "image/jpeg");
                      setPrefill({
                        message: "",
                        pageId,
                        mediaType: inferMediaKind(mime),
                        media: [
                          {
                            fileName: String(r.file_name),
                            mimeType: mime,
                            dataUrl: String(r.data_url),
                            altText: String(r.alt_text ?? ""),
                            createdWithAi: Boolean(r.created_with_ai),
                          },
                        ],
                      });
                      void navigate({ to: "/composer" });
                    }}
                  >
                    Reuse in Composer
                  </Button>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
