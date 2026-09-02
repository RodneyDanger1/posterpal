import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { reportClientErrorFn } from "@/lib/posterpal/fns";
import { copyText } from "@/lib/utils";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  if (typeof window !== "undefined") {
    void reportClientErrorFn({
      data: {
        message: error.message || "render error",
        scope: "error-boundary",
        extra: error.stack,
      },
    }).catch(() => undefined);
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <span className="text-destructive" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">The desk hit an error</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">
        {error.message || "An unexpected error occurred. The details were written to Token vault → Desk log."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Reload the desk
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 text-sm"
          onClick={() => void copyText(error.message || "desk error")}
        >
          Copy error
        </button>
        <Link to="/vault" className="rounded-md border border-border px-4 py-2 text-sm">
          Open desk log
        </Link>
      </div>
    </main>
  );
}
