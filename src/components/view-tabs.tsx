import { Button } from "@/components/ui/button";

/** Plain buttons, not Radix Tabs — those swallow Playwright clicks. */
export function ViewTabs({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (v: string) => void;
  tabs: Array<{ value: string; label: string; title?: string }>;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <Button
            key={t.value}
            type="button"
            size="sm"
            variant={active ? "secondary" : "ghost"}
            title={t.title}
            aria-pressed={active}
            data-view={t.value}
            onClick={() => onChange(t.value)}
          >
            {t.label}
          </Button>
        );
      })}
    </div>
  );
}
