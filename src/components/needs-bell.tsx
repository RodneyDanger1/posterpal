import { Bell } from "lucide-react";
import { useState } from "react";
import { NeedsYou } from "@/components/needs-you";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import type { NeedsItem } from "@/lib/posterpal/types";

export function NeedsBell({ items, onChange }: { items: NeedsItem[]; onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const nowCount = items.filter((i) => i.urgency === "now" || i.urgency === "soon").length;
  return (
    <div className="relative">
      <Hint label="Comments, overdue slots, and failed publishes that need a human.">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Needs you"
          onClick={() => setOpen((v) => !v)}
        >
          <Bell className="size-4" />
          {nowCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
          ) : null}
        </Button>
      </Hint>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 z-50 w-[min(380px,calc(100vw-24px))]">
            <NeedsYou
              items={items}
              onChange={() => {
                onChange?.();
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
