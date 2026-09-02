import { Globe, MessageCircle, Share2, ThumbsUp } from "lucide-react";
import { PageAvatar } from "@/components/page-avatar";
import type { PageRow } from "@/lib/posterpal/types";
import { cn, relativeTime } from "@/lib/utils";

export type PreviewMedia = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  altText?: string;
};

export function FacebookPreview({
  page,
  message,
  link,
  firstComment,
  mediaType,
  media,
  when,
  mode,
}: {
  page: Pick<PageRow, "id" | "name" | "picture_url"> | null;
  message: string;
  link?: string;
  firstComment?: string;
  mediaType: string;
  media: PreviewMedia[];
  when?: string;
  mode: "now" | "schedule" | "local-draft" | "fb-draft";
}) {
  const timeLabel =
    mode === "schedule" && when
      ? relativeTime(new Date(when).toISOString())
      : mode === "fb-draft"
        ? "Draft"
        : mode === "local-draft"
          ? "Draft"
          : "Just now";
  const images = media.filter((m) => m.mimeType.startsWith("image/") && m.dataUrl);
  const video = media.find((m) => m.mimeType.startsWith("video/"));

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Feed preview
      </div>
      <article className="p-3">
        <div className="flex items-start gap-2">
          <PageAvatar id={page?.id ?? "page"} name={page?.name ?? "Page"} pictureUrl={page?.picture_url} size={40} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-tight">{page?.name ?? "Page"}</div>
            <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <span>{timeLabel}</span>
              <span aria-hidden>·</span>
              <Globe className="size-3" />
            </div>
          </div>
        </div>
        {message.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-snug">{message}</p>
        ) : (
          <p className="mt-3 text-[15px] text-muted-foreground">Write a caption to see it on the Page.</p>
        )}
        {link?.trim() ? (
          <a
            href={link}
            className="mt-2 block truncate text-[13px] text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {link}
          </a>
        ) : null}
        {images.length > 0 ? (
          <div
            className={cn(
              "mt-3 overflow-hidden rounded-lg bg-muted",
              images.length === 1 ? "aspect-video" : "grid grid-cols-2 gap-0.5",
            )}
          >
            {images.slice(0, 4).map((img, i) => (
              <img
                key={`${img.fileName}-${i}`}
                src={img.dataUrl}
                alt={img.altText || ""}
                className={cn("h-full w-full object-cover", images.length === 1 ? "aspect-video" : "aspect-square")}
              />
            ))}
          </div>
        ) : video ? (
          <div className="mt-3 grid aspect-video place-items-center rounded-lg bg-muted text-[13px] text-muted-foreground">
            {mediaType} · {video.fileName}
          </div>
        ) : mediaType !== "Text" ? (
          <div className="mt-3 grid aspect-video place-items-center rounded-lg border border-dashed border-border text-[13px] text-muted-foreground">
            {mediaType} attachment
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-1 text-[13px] font-semibold text-muted-foreground">
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2">
            <ThumbsUp className="size-4" /> Like
          </span>
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2">
            <MessageCircle className="size-4" /> Comment
          </span>
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2">
            <Share2 className="size-4" /> Share
          </span>
        </div>
        {firstComment?.trim() ? (
          <div className="mt-2 rounded-lg bg-muted px-3 py-2">
            <div className="text-[11px] font-semibold text-muted-foreground">First comment (after publish)</div>
            <p className="mt-0.5 text-[13px]">{firstComment}</p>
          </div>
        ) : null}
      </article>
    </section>
  );
}
