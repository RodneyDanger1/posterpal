import { initials, pageHue } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function PageAvatar({
  id,
  name,
  size = 40,
  pictureUrl,
  className,
  ring,
}: {
  id: string;
  name: string;
  size?: number;
  pictureUrl?: string | null;
  className?: string;
  ring?: boolean;
}) {
  const src = pictureUrl?.trim() || null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-primary-foreground",
        ring ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : null,
        className,
      )}
      style={{ width: size, height: size, background: src ? undefined : pageHue(id), fontSize: size * 0.36 }}
      aria-hidden
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
