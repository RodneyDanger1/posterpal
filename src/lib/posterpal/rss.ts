/**
 * Minimal RSS 2.0 parsing + fetch — no dependencies. The worker uses this to
 * draft new feed items; a human approves and schedules every draft.
 */

export type RssItem = { title: string; link: string | null; pubDate: string | null };

/** Extract <item> entries from an RSS 2.0 / Atom-flavored feed document using
 * conservative tag scanning (no XML parser dependency). */
export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  // Match both RSS <item> and Atom <entry> blocks.
  const blocks = xml.match(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks) {
    const title = tag(block, "title");
    const link = tag(block, "link") ?? tagAttr(block, "link", "href");
    if (!title) continue;
    items.push({ title: decodeEntities(title), link, pubDate: tag(block, "pubDate") ?? tag(block, "published") });
  }
  return items;
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1]!.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim() : null;
}

function tagAttr(block: string, name: string, attr: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*${attr}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m?.[1] ?? null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Fetch a feed and return its newest items (max 5). Throws on network/HTTP
 * failure so the caller can log it — never silently returns "no items". */
export async function fetchFeedItems(feedUrl: string): Promise<RssItem[]> {
  const res = await fetch(feedUrl, {
    headers: { accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Feed ${feedUrl} returned HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseRssItems(xml);
  return items.slice(0, 5);
}
