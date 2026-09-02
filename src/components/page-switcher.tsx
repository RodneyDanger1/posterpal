import type { PageRow } from "@/lib/posterpal/types";
import { savePrefs } from "@/lib/posterpal/fns";
import { useShellStore } from "@/lib/store";
import { formatFanCount } from "@/lib/utils";
import { PageAvatar } from "./page-avatar";

export function PageSwitcher({ pages, selected }: { pages: PageRow[]; selected: PageRow | null }) {
  const setSelectedPageId = useShellStore((s) => s.setSelectedPageId);
  if (pages.length === 0) return null;
  return (
    <label className="flex min-w-0 max-w-[220px] items-center gap-2 md:max-w-[280px]">
      <span className="sr-only">Selected Page</span>
      {selected ? (
        <PageAvatar id={selected.id} name={selected.name} pictureUrl={selected.picture_url} size={28} ring />
      ) : null}
      <select
        className="h-9 min-w-0 flex-1 truncate rounded-md border-0 bg-transparent text-[13px] font-semibold outline-none"
        value={selected?.id ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          setSelectedPageId(id);
          void savePrefs({ data: { defaultPageId: id } });
        }}
        title="Composer, Calendar, and Inbox follow this Page"
      >
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.is_practice ? " · practice" : ""} · {formatFanCount(p.fan_count)}
          </option>
        ))}
      </select>
    </label>
  );
}
