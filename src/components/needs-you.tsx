import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { publishNowFn } from "@/lib/posterpal/fns";
import type { NeedsItem } from "@/lib/posterpal/types";
import { publishToast } from "@/lib/posterpal/operator";
import { useShellStore } from "@/lib/store";
import { Button } from "./ui/button";

export function NeedsYou({
  items,
  onChange,
}: {
  items: NeedsItem[];
  onChange?: () => void;
}) {
  const navigate = useNavigate();
  const setPrefill = useShellStore((s) => s.setComposerPrefill);

  if (!items.length) {
    return (
      <div className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Needs you</h2>
        <p className="mt-1 text-sm text-muted-foreground">Inbox zero. No overdue slots, failed publishes, or comments waiting.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Needs you</h2>
        <span className="text-[12px] text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        The desk drafts and queues. You click Publish and Send. Local scheduler only fires while this desk is open.
      </p>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 8).map((item) => (
          <li key={item.id} className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">
                  {item.urgency === "now" ? "Now · " : item.urgency === "soon" ? "Soon · " : ""}
                  {item.title}
                </div>
                {item.pageName ? <div className="text-[11px] text-muted-foreground">{item.pageName}</div> : null}
                <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{item.detail}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.action?.type === "publish" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      void publishNowFn({ data: { postId: item.action!.id } })
                        .then((r) => {
                          const outcome = publishToast(r.status, r.warning);
                          toast[outcome.ok ? "success" : "error"](outcome.text);
                          onChange?.();
                        })
                        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Publish failed"));
                    }}
                  >
                    Publish
                  </Button>
                ) : null}
                {item.action?.type === "open-inbox" ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/inbox">Inbox</Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (item.href === "/composer") setPrefill({ message: "" });
                      void navigate({ to: item.href });
                    }}
                  >
                    Open
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
