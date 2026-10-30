import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-32 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-ring/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
