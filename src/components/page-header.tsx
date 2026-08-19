import { Info } from "lucide-react";
import { Hint } from "./ui/tooltip";

export function PageHeader({
  title,
  hint,
  line,
  children,
}: {
  title: string;
  hint: string;
  /** Short visible subtitle. Long help stays on the info icon. */
  line?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-2xl">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <Hint label={hint} side="right">
            <button
              type="button"
              className="rounded-full p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              aria-label={`About ${title}`}
            >
              <Info className="size-4" />
            </button>
          </Hint>
        </div>
        {line ? <p className="mt-1 text-[13px] text-muted-foreground">{line}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
