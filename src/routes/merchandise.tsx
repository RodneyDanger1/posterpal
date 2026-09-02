import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyUtm } from "@/lib/posterpal/operator";
import { deleteMerchFn, listPagesFn, merchFn, saveMerchFn } from "@/lib/posterpal/fns";
import type { MerchRow, PageRow } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { copyText } from "@/lib/utils";

export const Route = createFileRoute("/merchandise")({ component: () => <Guard><Merch /></Guard> });

function Merch() {
  const pageId = useShellStore((s) => s.selectedPageId);
  const setPrefill = useShellStore((s) => s.setComposerPrefill);
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [rows, setRows] = useState<MerchRow[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("Shopify");
  const [cta, setCta] = useState("");
  const [utm, setUtm] = useState("utm_source=facebook&utm_medium=social&utm_campaign={slug}");

  const load = () => {
    void listPagesFn()
      .then(setPages)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load Pages"));
    void merchFn({ data: { pageId: pageId ?? undefined } })
      .then(setRows)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load merch"));
  };
  useEffect(load, [pageId]);

  const page = pages.find((p) => p.id === pageId) ?? (pageId ? undefined : pages[0]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader
          title="Merchandise"
          hint="Shop links inserted from Composer with UTM. If a merch URL is present, the policy checklist requires a branded-content disclosure (#ad or similar). Nothing is auto-posted."
        />
        <ul className="space-y-2">
          {rows.length === 0 ? (
            <li className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">
              No shop links on this Page. Add one on the right. Practice merch lives on North Shore Books.
            </li>
          ) : null}
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl bg-card p-4 shadow-card">
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="text-[13px] text-muted-foreground">{r.platform} · {r.url}</div>
                {r.utm_template ? (
                  <div className="mt-1 text-[12px] text-muted-foreground">UTM {r.utm_template}</div>
                ) : null}
                {r.cta_override ? <div className="mt-1 text-sm">{r.cta_override}</div> : null}
              </div>
              <div className="flex shrink-0 flex-col gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setPrefill({
                    message: r.cta_override || `Shop ${r.title}`,
                    pageId: r.page_id,
                    mediaType: "Text",
                    link: applyUtm(r.url, r.utm_template),
                  });
                  void navigate({ to: "/composer" });
                }}
              >
                Use in Composer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const href = applyUtm(r.url, r.utm_template);
                  void copyText(href).then((ok) =>
                    toast[ok ? "success" : "error"](ok ? "URL copied." : "Could not copy."),
                  );
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
          if (!page) {
            toast.error("Pick a Page from the rail first. Merch is not remapped onto another Page.");
            return;
          }
          void saveMerchFn({ data: { pageId: page.id, title, url, platform, cta, utm } })
            .then(() => {
              toast.success("Saved");
              setTitle("");
              setUrl("");
              setCta("");
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
          <div className="space-y-1">
            <Label>UTM template</Label>
            <Input
              value={utm}
              onChange={(e) => setUtm(e.target.value)}
              placeholder="utm_source=facebook&utm_medium=social&utm_campaign={slug}"
            />
            <p className="text-[11px] text-muted-foreground">
              Preview: {url ? applyUtm(url, utm, "post") : "add a URL"}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={!page}>
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
