/**
 * Page-aware research for the Agent tab.
 *
 * Pattern (how serious research agents work, scoped to this desk):
 *   1. Profile  — Page purpose from OUR data only (name, category, voice, merch, recent captions).
 *                 Never scrape Facebook. Graph-imported comments/posts are already in SQLite.
 *   2. Plan     — turn the operator brief + profile into 3–5 public-web search queries.
 *   3. Retrieve — xAI live search (search_parameters + web_search tool). No Facebook domains.
 *   4. Note     — structured notes with citations, topics, verified vs unverified.
 *   5. Draft    — captions happen in agent.ts AFTER this packet. Human clicks Publish.
 *
 * Spend: one live-search LLM call here. Caption variants are a second call. No loops.
 */

import type { PageRow } from "./types";

export type PageResearchProfile = {
  pageId: string;
  name: string;
  category: string | null;
  brandVoice: string | null;
  purpose: string;
  localeHint: string | null;
  topics: string[];
  merch: Array<{ title: string; url: string }>;
  recentCaptions: string[];
  suggestedBriefs: string[];
};

export type ResearchNote = {
  heading: string;
  body: string;
  url?: string;
  confidence: "verified" | "unverified";
};

export type AgentSource = { title: string; url: string };

export type ResearchPacket = {
  profile: PageResearchProfile;
  queries: string[];
  notes: ResearchNote[];
  topics: string[];
  summary: string;
  sources: AgentSource[];
  liveSearch: boolean;
  imageHint: string;
};

const EXTRA_STOP = new Set([
  "this", "that", "with", "from", "have", "will", "just", "your", "our", "the",
  "and", "for", "are", "was", "were", "been", "being", "into", "over", "out",
  "back", "then", "than", "also", "more", "some", "can", "not", "but", "all",
  "saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday",
  "today", "tomorrow", "tonight", "week", "weekend", "hours", "open", "come",
  "bring", "need", "like", "love", "post", "page", "facebook",
]);

function tokenizeLocal(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9#]+/)
    .filter((w) => w.length > 1);
}

export function inferLocale(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bwinona\b/.test(t)) return "Winona, Minnesota";
  if (/\bminnesota\b|\bmn\b/.test(t)) return "Minnesota";
  const city = text.match(/\bin ([A-Z][a-z]+(?:, [A-Z]{2})?)/);
  return city ? city[1]! : null;
}

export function inferPagePurpose(page: PageRow, topics: string[], merchTitles: string[]): string {
  const voice = (page.brand_voice ?? "").trim();
  const firstVoice = voice.split(/(?<=\.)\s/)[0]?.trim() ?? "";
  const cat = page.category?.trim();
  const topicBit = topics.slice(0, 3).join(", ");
  const merchBit = merchTitles.slice(0, 2).join(", ");
  const parts: string[] = [];
  if (firstVoice) parts.push(firstVoice);
  else if (cat) parts.push(`${page.name} is a ${cat} Page.`);
  else parts.push(`${page.name} is a Facebook Page the operator administers.`);
  if (topicBit) parts.push(`Recurring topics: ${topicBit}.`);
  if (merchBit) parts.push(`Shop: ${merchBit}.`);
  parts.push("Content exists to serve that audience and, when honest, to sell — not to farm engagement.");
  return parts.join(" ");
}

export function extractTopics(captions: string[], extra: string[] = []): string[] {
  const counts = new Map<string, number>();
  for (const raw of [...captions, ...extra]) {
    for (const tok of tokenizeLocal(raw)) {
      if (EXTRA_STOP.has(tok) || tok.length < 3 || /^\d+$/.test(tok) || tok.startsWith("#")) continue;
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([t]) => t);
}

export function planSearchQueries(profile: PageResearchProfile, brief: string): string[] {
  const year = new Date().getFullYear();
  const locale = profile.localeHint || "";
  const cleaned = brief.replace(/\s+/g, " ").trim().slice(0, 180);
  const topic = profile.topics[0] ?? profile.category ?? profile.name;
  const queries = [
    [cleaned, locale, String(year)].filter(Boolean).join(" "),
    [profile.name, topic, locale, "hours schedule"].filter(Boolean).join(" "),
    [cleaned, profile.category, "news"].filter(Boolean).join(" "),
  ];
  if (profile.merch[0]) {
    queries.push(`${profile.merch[0].title} ${profile.name} ${locale}`.trim());
  }
  if (profile.topics[1]) {
    queries.push(`${profile.topics[1]} ${locale} ${year}`.trim());
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const key = q.toLowerCase();
    if (key.length < 8 || seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out.slice(0, 5);
}

export function suggestedBriefs(profile: PageResearchProfile): string[] {
  const locale = profile.localeHint || "this town";
  const topic = profile.topics[0] ?? profile.category ?? "this Page";
  const merch = profile.merch[0]?.title;
  const briefs = [
    `Find a timely public-web angle for ${profile.name} to post today. Locale: ${locale}. Topic: ${topic}. Facts only. One still idea.`,
    `What is happening in ${locale} this weekend that fits a ${profile.category || "community"} Page? Hours, place, no invented events.`,
  ];
  if (merch) {
    briefs.push(`Draft a restock / shop caption for ${merch} in this Page's voice. No fake scarcity. Disclose if it's commercial.`);
  }
  if (profile.topics[1]) {
    briefs.push(`Research ${profile.topics[1]} for ${profile.name}. What can we say this week that is specific and true?`);
  }
  return briefs.slice(0, 4);
}

export async function buildPageProfile(userId: string, page: PageRow): Promise<PageResearchProfile> {
  const { listMerch, listPosts } = await import("./repo");
  const [posts, merch] = await Promise.all([
    listPosts(userId, { pageId: page.id, limit: 24 }),
    listMerch(userId, page.id),
  ]);
  const recentCaptions = posts
    .filter((p) => p.status === "Published" || p.status === "FacebookScheduled" || p.status === "LocalDraft")
    .map((p) => p.message ?? "")
    .filter((m) => m.trim().length > 12)
    .slice(0, 16);
  const merchTitles = merch.map((m) => m.title);
  const topics = extractTopics(recentCaptions, [
    page.category ?? "",
    page.brand_voice ?? "",
    page.name,
    ...merchTitles,
  ]);
  const localeHint = inferLocale(`${page.name} ${page.brand_voice ?? ""} ${recentCaptions.join(" ")}`);
  const purpose = inferPagePurpose(page, topics, merchTitles);
  const profile: PageResearchProfile = {
    pageId: page.id,
    name: page.name,
    category: page.category,
    brandVoice: page.brand_voice,
    purpose,
    localeHint,
    topics,
    merch: merch.map((m) => ({ title: m.title, url: m.url })),
    recentCaptions: recentCaptions.slice(0, 6),
    suggestedBriefs: [],
  };
  profile.suggestedBriefs = suggestedBriefs(profile);
  return profile;
}

export function mapBriefForPage(profile: PageResearchProfile): string {
  return [
    `Map this Page for content this week.`,
    `Purpose: ${profile.purpose}`,
    profile.topics.length ? `Known topics: ${profile.topics.join(", ")}` : "",
    profile.localeHint ? `Locale: ${profile.localeHint}` : "",
    `Find 3 timely public-web angles that fit. Do not invent events, hours, or quotes. Ignore Facebook/Instagram as sources.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseResearchJson(raw: string): {
  summary: string;
  notes: ResearchNote[];
  topics: string[];
  sources: AgentSource[];
  imageHint: string;
} {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { summary: raw.slice(0, 4000), notes: [], topics: [], sources: [], imageHint: "" };
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return { summary: raw.slice(0, 4000), notes: [], topics: [], sources: [], imageHint: "" };
  }
  const notes: ResearchNote[] = [];
  const rawNotes = Array.isArray(parsed.notes) ? parsed.notes : [];
  for (const item of rawNotes) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const body = String(rec.body ?? rec.text ?? "").trim();
    if (!body) continue;
    const conf = rec.confidence === "verified" ? "verified" : "unverified";
    const url = String(rec.url ?? rec.source ?? "");
    notes.push({
      heading: String(rec.heading ?? rec.title ?? "Note").slice(0, 80),
      body: body.slice(0, 600),
      url: url.startsWith("http") ? url : undefined,
      confidence: conf,
    });
  }
  const topics = Array.isArray(parsed.topics) ? parsed.topics.map(String).filter(Boolean).slice(0, 8) : [];
  const sources = asSources(parsed.sources);
  return {
    summary: String(parsed.summary ?? raw).slice(0, 4000),
    notes: notes.slice(0, 8),
    topics,
    sources,
    imageHint: String(parsed.image_prompt ?? parsed.imagePrompt ?? "").slice(0, 500),
  };
}

export function asSources(raw: unknown): AgentSource[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === "string" && raw.startsWith("http")) return [{ title: raw, url: raw }];
    return [];
  }
  const out: AgentSource[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.startsWith("http")) {
      out.push({ title: item, url: item });
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const url = String(rec.url ?? rec.uri ?? rec.link ?? "");
      if (url.startsWith("http")) {
        out.push({ title: String(rec.title ?? rec.name ?? url), url });
      }
    }
  }
  return out.slice(0, 8);
}

export function researchUserPrompt(profile: PageResearchProfile, brief: string, queries: string[]): string {
  const recent = profile.recentCaptions
    .slice(0, 4)
    .map((c) => `- ${c.slice(0, 140)}`)
    .join("\n");
  const merch = profile.merch.map((m) => `${m.title} (${m.url})`).join("; ");
  return `PAGE PROFILE (from the operator's desk — not scraped):
Name: ${profile.name}
Category: ${profile.category ?? "unknown"}
Locale: ${profile.localeHint ?? "unknown"}
Purpose: ${profile.purpose}
Brand voice: ${profile.brandVoice ?? "Warm, specific, human."}
Topics already on this Page: ${profile.topics.join(", ") || "none yet"}
Merch: ${merch || "none"}
Recent captions:
${recent || "(none)"}

OPERATOR BRIEF:
${brief}

SEARCH QUERIES TO RUN (public web, not Facebook):
${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Rules:
- Search the public web. Ignore facebook.com, instagram.com, threads.net as sources.
- Do not invent hours, dates, quotes, vote totals, or events. Mark anything unconfirmed as unverified.
- Tie every angle back to this Page's purpose. A bookstore does not need a generic "engagement" hook.
- Prefer primary reporting and official .gov / venue / school pages.

Return ONLY JSON:
{
  "summary": "8–14 sentences of usable notes, dated where possible",
  "topics": ["topic", "..."],
  "notes": [{"heading":"...","body":"...","url":"https://...","confidence":"verified|unverified"}],
  "sources": [{"title":"...","url":"https://..."}],
  "image_prompt": "photoreal still, no text overlay, no logos, no celebrity fake-photo"
}`;
}
