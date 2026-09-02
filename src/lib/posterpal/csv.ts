/** Minimal CSV parser — quotes, escaped quotes (""), and commas inside fields.
 * Dependency-free so it can be unit-tested without dragging in the DB. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export type BulkCsvRow = { message: string; when: string; pageId: string };

/** Map caption/when/page by header name when present, else column order. */
export function mapBulkCsvRows(parsed: string[][]): BulkCsvRow[] {
  const header = parsed[0] ?? [];
  const hasHeader = header.some((h) => /caption|message|when|date|page/i.test(h));
  let messageIdx = 0;
  let whenIdx = 1;
  let pageIdx = 2;
  if (hasHeader) {
    header.forEach((h, i) => {
      const k = h.trim().toLowerCase();
      if (/^(caption|message|text|body)$/.test(k)) messageIdx = i;
      else if (/^(when|date|time|scheduled|at)$/.test(k)) whenIdx = i;
      else if (/^(page|pageid|page_id|pagename|page name)$/.test(k)) pageIdx = i;
    });
  }
  const body = hasHeader ? parsed.slice(1) : parsed;
  return body
    .map((r) => ({
      message: (r[messageIdx] ?? "").trim(),
      when: (r[whenIdx] ?? "").trim(),
      pageId: (r[pageIdx] ?? "").trim(),
    }))
    .filter((r) => r.message);
}
