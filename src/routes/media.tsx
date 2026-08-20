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
import { useShellStore } from "@/lib/store";

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

  useEffect(() => {
    void mediaLibraryFn({ data: { pageId } }).then(setRows);
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
        hint="Files attached to posts on this desk. Generate a still with Grok, Gemini Nano Banana, OpenAI Images, or Flux Schnell — then open Composer to caption and publish. AI images must be disclosed."
      />
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
              void imaginePhotoFn({ data: { prompt, provider } })
                .then((r) => {
                  if ("error" in r) {
                    toast.error(r.error);
                    return;
                  }
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
                      },
                    ],
                  });
                  toast.success("Image attached — opening Composer.");
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
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
                            createdWithAi: false,
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
      )}
    </div>
  );
}
