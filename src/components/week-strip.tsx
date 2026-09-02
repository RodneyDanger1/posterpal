import { useNavigate } from "@tanstack/react-router";
import { toLocalInput } from "@/lib/posterpal/slots";
import type { HomeSnapshot } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function WeekStrip({ week, pageId }: { week: HomeSnapshot["week"]; pageId?: string | null }) {
  const navigate = useNavigate();
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  if (!week?.length) return null;

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[520px] grid-cols-7 gap-1">
        {week.map((d) => {
          const empty = d.scheduled === 0 && d.published === 0;
          return (
            <button
              key={d.iso}
              type="button"
              className={cn(
                "min-h-16 rounded-lg px-2 py-2 text-left transition-colors duration-150",
                d.isToday ? "bg-accent text-accent-foreground" : "bg-card shadow-card hover:bg-muted/60",
              )}
              onClick={() => {
                const when = `${d.iso}T13:00`;
                setPrefill({
                  message: "",
                  pageId,
                  when: toLocalInput(new Date(when)),
                });
                void navigate({ to: "/composer" });
              }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d.weekday}</div>
              <div className="text-[17px] font-semibold tabular-nums">{d.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                {empty ? "Open" : `${d.scheduled} queued · ${d.published} live`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
