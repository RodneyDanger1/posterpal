import { useEffect, useState } from "react";

const ROWS = [
  ["Ctrl + K", "Search Pages, posts, comments"],
  ["Ctrl + Enter", "Send from Composer (selected mode)"],
  ["Ctrl + S", "Save a local draft"],
  ["Esc", "Clear Composer (when not typing)"],
  ["N", "New post in Composer"],
  ["J / K", "Move inbox selection"],
  ["E", "Mark inbox comment handled"],
  ["?", "This cheat sheet"],
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onCustom = () => setOpen((v) => !v);
    window.addEventListener("keydown", onKey);
    window.addEventListener("posterpal:shortcuts", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("posterpal:shortcuts", onCustom);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="w-[min(420px,calc(100vw-24px))] rounded-xl bg-card p-5 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Keyboard</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">A human still has to click Send and Publish.</p>
        <dl className="mt-4 space-y-2">
          {ROWS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-sm">
              <dt>
                <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[12px] font-semibold">{key}</kbd>
              </dt>
              <dd className="text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="mt-4 text-[13px] text-primary" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
}
