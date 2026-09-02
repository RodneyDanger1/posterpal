import { useRef, useState } from "react";
import { toast } from "sonner";
import { bulkScheduleFn } from "@/lib/posterpal/fns";
import { mapBulkCsvRows, parseCsv } from "@/lib/posterpal/csv";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type ParsedRow = { message: string; when: string; pageId: string };

export function BulkScheduler({ selectedPageId }: { selectedPageId: string }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Array<{ ok: boolean; caption: string; error?: string }> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parse() {
    const next = mapBulkCsvRows(parseCsv(csv));
    setRows(next);
    setResults(null);
    if (next.length === 0) toast.error("No rows found. Header can be caption, when, page in any order.");
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await bulkScheduleFn({
        data: {
          rows: rows.map((r) => ({
            message: r.message,
            when: r.when || null,
            pageId: r.pageId || null,
          })),
          defaultPageId: selectedPageId,
        },
      });
      setResults(res.results);
      if (res.failed) toast.warning(res.warning ?? `${res.failed} rows failed.`);
      else toast.success(`Queued ${res.ok} post${res.ok === 1 ? "" : "s"}.`);
      setRows([]);
      setCsv("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk schedule failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Bulk schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <div className="space-y-1.5">
          <DialogTitle>Bulk schedule from CSV</DialogTitle>
          <DialogDescription>
            One post per line — columns: <code>caption</code> (required),{" "}
            <code>when</code> (optional date, e.g. 2026-09-01 16:00), <code>page</code> (optional
            Page name). Rows without a date save as local drafts. Every row passes the same
            policy + cadence checks as the composer.
          </DialogDescription>
        </div>

        <Textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          placeholder={
            '"Staff pick Tuesday: a novel that starts on a train...", 2026-09-01 16:00, North Shore Books\n"Flash sale on totes — 20% off", , Winona Weekend'
          }
        />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Upload .csv
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void f.text().then(setCsv);
            }}
          />
          <Button size="sm" onClick={parse} disabled={!csv.trim()}>
            Parse
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-md border border-border">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2">Caption</th>
                  <th className="p-2">When</th>
                  <th className="p-2">Page</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="max-w-64 truncate p-2">{r.message}</td>
                    <td className="p-2 text-muted-foreground">{r.when || "draft"}</td>
                    <td className="p-2 text-muted-foreground">{r.pageId || "(selected)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {results && (
          <ul className="max-h-40 space-y-1 overflow-auto text-[12px]">
            {results.map((r, i) => (
              <li key={i} className={r.ok ? "text-success" : "text-destructive"}>
                {r.ok ? "✓" : "✗"} {r.caption.slice(0, 60) || "(empty)"}
                {r.ok ? " — queued" : ` — ${r.error ?? "failed"}`}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
          <Button onClick={() => void submit()} disabled={rows.length === 0 || busy}>
            {busy ? "Scheduling…" : `Schedule ${rows.length} row${rows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
