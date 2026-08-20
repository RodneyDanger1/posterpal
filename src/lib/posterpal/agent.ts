import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { aiAvailable, chatWithProvider, generateCaptionVariants } from "./ai";
import { getPage, getSetting } from "./repo";
import type { TextProviderId } from "./providers";

export type AgentSource = { title: string; url: string };
export type AgentResult = {
  summary: string;
  sources: AgentSource[];
  captions: { storytelling: string; cta: string; question: string };
  imagePrompt: string;
  laterTitle: string;
  refused: string | null;
  liveSearch: boolean;
  runId: string;
};

const REFUSE_RE =
  /\b(post (this |it )?now|publish (it|this|now|for me)|auto[- ]?(post|reply|like|comment|follow|share)|send (all|the replies|replies)|reply to (every|all)|go live without me)\b/i;

const AGENT_SYSTEM = `You are the research desk for a Facebook Page operator. You draft. A human clicks Publish and Send.

Hard limits (Meta Platform Policy):
- Never like, follow, share, or post comments.
- Never tell the operator you will publish. You only draft.
- Do not scrape Facebook. Use public web search and the operator's brief.
- Do not invent quotes, vote totals, or court outcomes. If a fact is unverified, say so.
- Do not write captions that claim an AI still is a documentary photo of a real event.
- Do not add "written by AI", "made with ChatGPT", "#AIart", or similar to captions. The operator edits and owns the send button. They will disclose if Meta requires it (realistic AI people, branded content #ad).
- Write in the Page's brand voice. Specific, human, no corporate filler, no hashtag dumps (max 3).
- Return ONLY JSON.`;

export function agentWouldRefuse(prompt: string): string | null {
  if (!REFUSE_RE.test(prompt)) return null;
  return "The desk will not publish, reply, like, or follow for you. That is banned automation. Research and draft here, then you click Publish or Send.";
}

export async function runDeskAgent(
  userId: string,
  input: { pageId: string; prompt: string; provider?: string },
): Promise<AgentResult> {
  const refused = agentWouldRefuse(input.prompt);
  if (refused) {
    return {
      summary: refused,
      sources: [],
      captions: { storytelling: "", cta: "", question: "" },
      imagePrompt: "",
      laterTitle: "",
      refused,
      liveSearch: false,
      runId: "",
    };
  }

  const page = await getPage(userId, input.pageId);
  if (!page) throw new Error("Select a Page first.");
  const provider = (input.provider || (await getSetting(userId, "default_text_provider")) || "grok") as TextProviderId;
  const apiKey = await providerKey(userId, provider);
  const canGrok = aiAvailable();
  if (provider === "grok" && !canGrok && !apiKey) {
    throw new Error("No caption model available. Grok is off in this environment — add a key in Settings.");
  }

  const brief = input.prompt.trim().slice(0, 2000);
  const { text: researchText, sources, liveSearch } = await liveResearch(brief, page.name);

  const captions = await generateCaptionVariants({
    brief: `${brief}\n\nResearch notes:\n${researchText.slice(0, 1800)}`,
    brandVoice: page.brand_voice,
    pageName: page.name,
    provider,
    apiKey,
  });

  const imagePrompt = await imagePromptFromBrief(page.name, brief, researchText, provider, apiKey);
  const laterTitle = (brief.split(/[\n.?!]/)[0] ?? "Idea").trim().slice(0, 60) || "Idea";
  const runId = randomUUID();
  const sql = await getSql();
  await sql`
    insert into agent_runs (id, user_id, page_id, prompt, summary, drafts_json, sources_json, image_prompt)
    values (
      ${runId}, ${userId}, ${input.pageId}, ${brief}, ${researchText.slice(0, 4000)},
      ${JSON.stringify(captions)}, ${JSON.stringify(sources)}, ${imagePrompt}
    )
  `;

  return {
    summary: researchText,
    sources,
    captions,
    imagePrompt,
    laterTitle,
    refused: null,
    liveSearch,
    runId,
  };
}

async function providerKey(userId: string, provider: string): Promise<string | null> {
  if (provider === "openai") return getSetting(userId, "openai_api_key");
  if (provider === "gemini") return getSetting(userId, "google_api_key");
  if (provider === "deepseek") return getSetting(userId, "deepseek_api_key");
  return null;
}

async function liveResearch(
  brief: string,
  pageName: string,
): Promise<{ text: string; sources: AgentSource[]; liveSearch: boolean }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return {
      text: `No live web search in this environment. Draft from the brief only. Operator should verify facts before publishing.\n\nBrief: ${brief}`,
      sources: [],
      liveSearch: false,
    };
  }

  const user = `Page: ${pageName}. Operator brief:\n${brief}\n\nSearch the public web. Return JSON:
{"summary":"8–14 sentences of usable notes, dated where possible","sources":[{"title":"...","url":"https://..."}],"image_prompt":"photoreal still, no text overlay, no logos"}
Ignore Facebook/Instagram/Threads as sources. Prefer primary reporting.`;

  const attempted = await grokSearchJson(apiKey, user);
  if (attempted) return attempted;

  const fallback = await chatWithProvider({
    provider: "grok",
    system: AGENT_SYSTEM,
    user: `${user}\nLive search failed. Be explicit about what you cannot verify.`,
    maxTokens: 900,
  });
  const json = extractJson(fallback);
  return {
    text: String(json.summary ?? fallback).slice(0, 4000),
    sources: asSources(json.sources),
    liveSearch: false,
  };
}

async function grokSearchJson(
  apiKey: string,
  user: string,
): Promise<{ text: string; sources: AgentSource[]; liveSearch: boolean } | null> {
  const bodies = [
    {
      model: "grok-4.5",
      temperature: 0.3,
      max_tokens: 1100,
      messages: [
        { role: "system", content: AGENT_SYSTEM },
        { role: "user", content: user },
      ],
      search_parameters: { mode: "on", return_citations: true },
    },
    {
      model: "grok-4.5",
      temperature: 0.3,
      max_tokens: 1100,
      messages: [
        { role: "system", content: AGENT_SYSTEM },
        { role: "user", content: user },
      ],
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
    },
  ];

  for (const body of bodies) {
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        citations?: unknown;
      };
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) continue;
      const parsed = extractJson(content);
      const fromCitations = asSources(json.citations);
      const fromJson = asSources(parsed.sources);
      return {
        text: String(parsed.summary ?? content).slice(0, 4000),
        sources: (fromJson.length ? fromJson : fromCitations).slice(0, 8),
        liveSearch: true,
      };
    } catch {
      /* try the next search shape */
    }
  }
  return null;
}

async function imagePromptFromBrief(
  pageName: string,
  brief: string,
  research: string,
  provider: TextProviderId,
  apiKey: string | null,
): Promise<string> {
  try {
    const raw = await chatWithProvider({
      provider,
      apiKey,
      maxTokens: 180,
      system:
        "Write one image-generation prompt for a Facebook Page still. Photoreal, no text overlay, no logos, no watermarks, no celebrity likeness unless the brief names a public figure in a clearly illustrated/editorial (not fake-photo) style. Return plain text only.",
      user: `Page ${pageName}. Brief: ${brief}\nNotes: ${research.slice(0, 600)}`,
    });
    return raw.replace(/^["']|["']$/g, "").slice(0, 500);
  } catch {
    return `Photoreal still for ${pageName}. ${brief.slice(0, 200)}. No text overlay, no logos.`;
  }
}

function asSources(raw: unknown): AgentSource[] {
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

function extractJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
