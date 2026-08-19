import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMerchFn, listPagesFn, merchFn, saveMerchFn } from "@/lib/posterpal/fns";
import type { MerchRow, PageRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { copyText } from "@/lib/utils";

export const Route = createFileRoute("/merchandise")({ component: () => <Guard><Merch /></Guard> });

function Merch() {
  const pageId = useShellStore((s) => s.selectedPageId);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [rows, setRows] = useState<MerchRow[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("Shopify");
  const [cta, setCta] = useState("");

  const load = () => {
    void listPagesFn().then(setPages);
    void merchFn({ data: { pageId: pageId ?? undefined } }).then(setRows);
  };
  useEffect(load, [pageId]);

  const page = pages.find((p) => p.id === pageId) ?? pages[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader
          title="Merchandise"
          hint="Shop links inserted from Composer with UTM. If a merch URL is present, the policy checklist requires a branded-content disclosure (#ad or similar). Nothing is auto-posted."
        />
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl bg-card p-4 shadow-card">
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="text-[13px] text-muted-foreground">{r.platform} · {r.url}</div>
                {r.cta_override ? <div className="mt-1 text-sm">{r.cta_override}</div> : null}
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void copyText(r.url).then((ok) => toast[ok ? "success" : "error"](ok ? "URL copied." : "Could not copy."));
                  }}
                >
                  Copy URL
                </Button>
                <Button size="sm" variant="outline" onClick={() => void deleteMerchFn({ data: { id: r.id } }).then(load)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <form
        className="rounded-xl bg-card p-4 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!page) return;
          void saveMerchFn({ data: { pageId: page.id, title, url, platform, cta } })
            .then(() => {
              toast.success("Saved");
              setTitle("");
              setUrl("");
              load();
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"));
        }}
      >
        <h2 className="font-semibold">Add link {page ? `· ${page.name}` : ""}</h2>
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://" />
          </div>
          <div className="space-y-1">
            <Label>Platform</Label>
            <Input value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CTA</Label>
            <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Get the tote" />
          </div>
          <Button type="submit" className="w-full" disabled={!page}>
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
