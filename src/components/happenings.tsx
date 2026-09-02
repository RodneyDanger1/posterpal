import { happeningScopeLabel } from "@/lib/posterpal/desk-context";
import { relativeTime } from "@/lib/utils";
import { Button } from "./ui/button";

export type HappeningRow = {
  id?: string;
  level: string;
  scope: string;
  message: string;
  created_at?: string | null;
  createdAt?: string | null;
};

function whenOf(row: HappeningRow): string | null {
  return row.created_at ?? row.createdAt ?? null;
}

function levelClass(level: string): string {
  if (level === "error") return "text-destructive";
  if (level === "warn") return "text-amber-700";
  return "text-muted-foreground";
}

export function Happenings({
  logs,
  title = "Happenings",
  empty = "Quiet so far.",
  onAsk,
  limit = 8,
}: {
  logs: HappeningRow[];
  title?: string;
  empty?: string;
  onAsk?: (row: HappeningRow) => void;
  limit?: number;
}) {
  const rows = logs.slice(0, limit);
  return (
    <div>
      {title ? (
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-1 text-[12px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {rows.map((l, i) => {
            const when = whenOf(l);
            return (
              <li key={l.id ?? `${l.scope}-${i}`} className="flex flex-wrap items-start justify-between gap-2 text-[12px]">
                <div className="min-w-0">
                  <span className={`font-medium ${levelClass(l.level)}`}>{happeningScopeLabel(l.scope)}</span>
                  <span className="text-muted-foreground"> {l.message.slice(0, 140)}</span>
                  {when ? <span className="ml-1 tabular-nums text-muted-foreground">{relativeTime(when)}</span> : null}
                </div>
                {onAsk ? (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => onAsk(l)}
                  >
                    Ask agent
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
