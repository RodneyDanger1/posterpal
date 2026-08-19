import { Badge } from "@/components/ui/badge";
import type { PostStatus } from "@/lib/posterpal/types";

const MAP: Record<PostStatus, { label: string; variant: "default" | "success" | "warning" | "danger" | "muted" | "outline" }> = {
  LocalDraft: { label: "Local draft", variant: "muted" },
  FacebookDraft: { label: "Facebook draft", variant: "outline" },
  LocalScheduled: { label: "Local schedule", variant: "warning" },
  FacebookScheduled: { label: "Scheduled", variant: "default" },
  Publishing: { label: "Publishing", variant: "default" },
  Published: { label: "Published", variant: "success" },
  Failed: { label: "Failed", variant: "danger" },
  Cancelled: { label: "Cancelled", variant: "muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status as PostStatus] ?? { label: status, variant: "muted" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
