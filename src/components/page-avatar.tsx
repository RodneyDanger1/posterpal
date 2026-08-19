import { initials, pageHue } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function PageAvatar({
  id,
  name,
  size = 40,
  className,
}: {
  id: string;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, background: pageHue(id), fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
