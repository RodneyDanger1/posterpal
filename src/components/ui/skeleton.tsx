import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  // `.skeleton` is the shimmer surface from styles.css (reduced-motion aware).
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}
