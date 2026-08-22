import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { aiAvailable, chatWithProvider, generateCaptionVariants } from "./ai";
import { getPage, getSetting } from "./repo";
import type { TextProviderId } from "./providers";
import {
  asSources,
  buildPageProfile,
  mapBriefForPage,
  parseResearchJson,
  planSearchQueries,
  researchUserPrompt,
  type PageResearchProfile,
  type ResearchNote,
} from "./research";

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
  topics: string[];
  queries: string[];
  notes: ResearchNote[];
  pagePurpose: string;
  profile: PageResearchProfile | null;
};

const REFUSE_RE =
  /\b(post (this |it )?now|publish (it|this|now|for me)|auto[- ]?(post|reply|like|comment|follow|share)|send (all|the replies|replies)|reply to (every|all)|go live without me)\b/i;

const AGENT_SYSTEM = `You are the research desk for a Facebook Page operator. You draft. A human clicks Publish and Send.

Hard limits (Meta Platform Policy):
- Never like, follow, share, or post comments.
- Never tell the operator you will publish. You only draft.
- Do not scrape Facebook. Use public web search and the operator's desk data (Page name, category, brand voice, merch, recent captions already in the database).
- Do not invent quotes, vote totals, court outcomes, hours, or events. If a fact is unverified, say so.
- Do not write captions that claim an AI still is a documentary photo of a real event.
- Do not add "written by AI", "made with ChatGPT", "#AIart", or similar to captions. The operator edits and owns the send button. They will disclose if Meta requires it (realistic AI people, branded content #ad).
- Write in the Page's brand voice. Specific, human, no corporate filler, no hashtag dumps (max 3).
- Return ONLY JSON.`;

export function agentWouldRefuse(prompt: string): string | null {
  if (!REFUSE_RE.test(prompt)) return null;
  return "The desk will not publish, reply, like, or follow for you. That is banned automation. Research and draft here, then you click Publish or Send.";
}

function emptyResult(partial: Partial<AgentResult> & { summary: string }): AgentResult {
  return {
    sources: [],
    captions: { storytelling: "", cta: "", question: "" },
    imagePrompt: "",
    laterTitle: "",
    refused: null,
    liveSearch: false,
    runId: "",
    topics: [],
    queries: [],
    notes: [],
    pagePurpose: "",
    profile: null,
    ...partial,
  };
}

export async function loadPageProfile(userId: string, pageId: string): Promise<PageResearchProfile> {
  const page = await getPage(userId, pageId);
  if (!page) throw new Error("Select a Page first.");
  return buildPageProfile(userId, page);
}

export async function runDeskAgent(
  userId: string,
  input: { pageId: string; prompt: string; provider?: string; mapPage?: boolean },
): Promise<AgentResult> {
  const refused = agentWouldRefuse(input.prompt);
  if (refused) {
    return emptyResult({ summary: refused, refused });
  }

  const page = await getPage(userId, input.pageId);
  if (!page) throw new Error("Select a Page first.");
  const profile = await buildPageProfile(userId, page);

  const provider = (input.provider || (await getSetting(userId, "default_text_provider")) || "grok") as TextProviderId;
  const apiKey = await providerKey(userId, provider);
  const canGrok = aiAvailable();
  if (provider === "grok" && !canGrok && !apiKey) {
    throw new Error("No caption model available. Grok is off in this environment — add a key in Settings.");
  }

  const brief = (input.mapPage ? mapBriefForPage(profile) : input.prompt).trim().slice(0, 2000);
  const queries = planSearchQueries(profile, brief);
  const researched = await liveResearch(profile, brief, queries);

  let captions = { storytelling: "", cta: "", question: "" };
  try {
    captions = await generateCaptionVariants({
      brief: `${brief}\n\nPage purpose: ${profile.purpose}\n\nResearch notes:\n${researched.summary.slice(0, 1800)}`,
      brandVoice: page.brand_voice,
      pageName: page.name,
      merchCta: profile.merch[0] ? `${profile.merch[0].title} ${profile.merch[0].url}` : null,
      provider,
      apiKey,
    });
  } catch (e) {
    captions = {
      storytelling: researched.summary.slice(0, 500),
      cta: "",
      question: "",
    };
    if (!researched.summary) throw e;
  }

  let imagePrompt = researched.imageHint || "";
  if (!imagePrompt) {
    imagePrompt = await imagePromptFromBrief(page.name, brief, researched.summary, provider, apiKey);
  }
  const laterTitle = (brief.split(/[\n.?!]/)[0] ?? "Idea").trim().slice(0, 60) || "Idea";
  const runId = randomUUID();
  const topics = (researched.topics.length ? researched.topics : profile.topics).slice(0, 8);
  const sql = await getSql();
  const draftsPayload = JSON.stringify({
    ...captions,
    topics,
    queries,
    notes: researched.notes,
    pagePurpose: profile.purpose,
  });
  await sql`
    insert into agent_runs (id, user_id, page_id, prompt, summary, drafts_json, sources_json, image_prompt)
    values (
      ${runId}, ${userId}, ${input.pageId}, ${brief.slice(0, 2000)}, ${researched.summary.slice(0, 4000)},
      ${draftsPayload}, ${JSON.stringify(researched.sources)}, ${imagePrompt}
    )
  `;

  return {
    summary: researched.summary,
    sources: researched.sources,
    captions,
    imagePrompt,
    laterTitle,
    refused: null,
    liveSearch: researched.liveSearch,
    runId,
    topics,
    queries,
    notes: researched.notes,
    pagePurpose: profile.purpose,
    profile,
  };
}

async function providerKey(userId: string, provider: string): Promise<string | null> {
  if (provider === "openai") return getSetting(userId, "openai_api_key");
  if (provider === "gemini") return getSetting(userId, "google_api_key");
  if (provider === "deepseek") return getSetting(userId, "deepseek_api_key");
  return null;
}

async function liveResearch(
  profile: PageResearchProfile,
  brief: string,
  queries: string[],
): Promise<{
  summary: string;
  sources: AgentSource[];
  liveSearch: boolean;
  imageHint: string;
  notes: ResearchNote[];
  topics: string[];
}> {
  const user = researchUserPrompt(profile, brief, queries);
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return {
      summary: [
        `No live web search in this environment. Draft from the Page profile and brief only. Verify facts before publishing.`,
        ``,
        `Purpose: ${profile.purpose}`,
        `Topics: ${profile.topics.join(", ") || "none"}`,
        `Queries I would have run:`,
        ...queries.map((q) => `- ${q}`),
        ``,
        `Brief: ${brief}`,
      ].join("\n"),
      sources: [],
      liveSearch: false,
      imageHint: "",
      notes: profile.topics.slice(0, 4).map((t) => ({
        heading: t,
        body: `Desk topic from recent captions. Confirm anything timely on the public web before you post.`,
        confidence: "unverified" as const,
      })),
      topics: profile.topics,
    };
  }

  const attempted = await grokSearchJson(apiKey, user);
  if (attempted) return attempted;

  const fallback = await chatWithProvider({
    provider: "grok",
    system: AGENT_SYSTEM,
    user: `${user}\nLive search failed. Be explicit about what you cannot verify.`,
    maxTokens: 1100,
  });
  const parsed = parseResearchJson(fallback);
  return {
    summary: parsed.summary,
    sources: parsed.sources,
    liveSearch: false,
    imageHint: parsed.imageHint,
    notes: parsed.notes,
    topics: parsed.topics,
  };
}

async function grokSearchJson(
  apiKey: string,
  user: string,
): Promise<{
  summary: string;
  sources: AgentSource[];
  liveSearch: boolean;
  imageHint: string;
  notes: ResearchNote[];
  topics: string[];
} | null> {
  const excluded = ["facebook.com", "instagram.com", "threads.net", "l.facebook.com"];
  const bodies = [
    {
      model: "grok-4.5",
      temperature: 0.3,
      max_tokens: 1400,
      messages: [
        { role: "system", content: AGENT_SYSTEM },
        { role: "user", content: user },
      ],
      search_parameters: {
        mode: "on",
        return_citations: true,
        max_search_results: 8,
        sources: [
          { type: "web", excluded_websites: excluded },
          { type: "news" },
        ],
      },
    },
    {
      model: "grok-4.5",
      temperature: 0.3,
      max_tokens: 1400,
      messages: [
        { role: "system", content: AGENT_SYSTEM },
        { role: "user", content: user },
      ],
      tools: [{ type: "web_search", filters: { excluded_domains: excluded } }],
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
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        citations?: unknown;
      };
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) continue;
      const parsed = parseResearchJson(content);
      const fromCitations = asSources(json.citations);
      const sources = (parsed.sources.length ? parsed.sources : fromCitations).slice(0, 8);
      return {
        summary: parsed.summary.slice(0, 4000),
        sources,
        liveSearch: true,
        imageHint: parsed.imageHint,
        notes: parsed.notes,
        topics: parsed.topics,
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
