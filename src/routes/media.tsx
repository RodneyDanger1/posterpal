import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { imaginePhotoFn, mediaLibraryFn } from "@/lib/posterpal/fns";
import type { MediaLibraryItem } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";

export const Route = createFileRoute("/media")({ component: () => <Guard><Media /></Guard> });

function Media() {
  const pageId = useShellStore((s) => s.selectedPageId) ?? undefined;
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const navigate = useNavigate();
  const [rows, setRows] = useState<MediaLibraryItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"all" | "photo" | "video">("all");

  useEffect(() => {
    void mediaLibraryFn({ data: { pageId } }).then(setRows);
  }, [pageId]);

  const visible = useMemo(() => {
    if (kind === "all") return rows;
    if (kind === "photo") {
      return rows.filter((r) => {
        const mime = String(r.mime_type ?? "");
        const k = String(r.media_kind ?? "").toLowerCase();
        return mime.startsWith("image/") || k.includes("photo") || k.includes("image");
      });
    }
    return rows.filter((r) => {
      const mime = String(r.mime_type ?? "");
      const k = String(r.media_kind ?? "").toLowerCase();
      return mime.startsWith("video/") || k.includes("video") || k.includes("reel");
    });
  }, [rows, kind]);

  const reuse = (r: MediaLibraryItem) => {
    const dataUrl = typeof r.data_url === "string" ? r.data_url : "";
    if (!dataUrl) {
      toast.error("This file has no local copy to reuse.");
      return;
    }
    setPrefill({
      message: "",
      pageId,
      mediaType: "Photo",
      media: [
        {
          fileName: String(r.file_name),
          mimeType: String(r.mime_type ?? "image/jpeg"),
          dataUrl,
          altText: String(r.alt_text ?? ""),
          createdWithAi: false,
        },
      ],
    });
    void navigate({ to: "/composer" });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Media library"
        hint="Files attached to posts on this desk. Generate a still with Grok Imagine, then open Composer to caption and publish. AI images must be disclosed (policy checklist flags created-with-AI)."
      >
        <Button size="sm" variant={kind === "all" ? "default" : "outline"} onClick={() => setKind("all")}>
          All
        </Button>
        <Button size="sm" variant={kind === "photo" ? "default" : "outline"} onClick={() => setKind("photo")}>
          Photos
        </Button>
        <Button size="sm" variant={kind === "video" ? "default" : "outline"} onClick={() => setKind("video")}>
          Video
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
        <Hint label="One image per click via grok-imagine-image. Spends your xAI quota. Nothing is posted until you send it from Composer.">
          <Button
            disabled={busy}
            onClick={() => {
              if (prompt.trim().length < 8) {
                toast.error("Describe the photo.");
                return;
              }
              setBusy(true);
              void imaginePhotoFn({ data: { prompt } })
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
                  toast.success("Image ready in Composer.");
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
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media yet. Drop files in Composer or generate one above.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((r) => (
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
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => reuse(r)}>
                  Reuse in Composer
                </Button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
