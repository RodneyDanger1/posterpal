import { Info } from "lucide-react";
import { Hint } from "./ui/tooltip";

export function PageHeader({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
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
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`About ${title}`}
            >
              <Info className="size-4" />
            </button>
          </Hint>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
