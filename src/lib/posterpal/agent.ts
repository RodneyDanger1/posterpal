import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { aiAvailable, chatWithProvider, draftReplies, generateCaptionVariants, localSentiment } from "./ai";
import { getPage, getSetting } from "./repo";
import type { TextProviderId } from "./providers";
import {
  asSources,
  browsePublicPages,
  buildPageProfile,
  mapBriefForPage,
  parseResearchJson,
  planSearchQueries,
  researchUserPrompt,
  urlsFromBrief,
  type PageResearchProfile,
  type ResearchNote,
} from "./research";
import { formatDeskSnapshot, snapshotLooksLikeOpsBrief, type DeskSnapshot } from "./desk-context";
import { hopsFromDesk, rankHops, wantsConnect, wantsFailedFix, wantsInboxDrafts, type AgentHop, type AgentInboxDraft, type AgentCaptionPolicy } from "./agent-hops";
import {
  pickPersona,
  parsePersona,
  skillsForRun,
  personaSystemOverlay,
  PERSONAS,
  type AgentPersonaId,
  type AgentSkillId,
} from "./agent-skills";
import { remixCaption } from "./briefing";
import { scheduleWhenForPage } from "./slots";
import { isBuyingIntent } from "./operator";
import type { PageRow } from "./types";

export { formatDeskSystemContext, formatDeskSnapshot } from "./desk-context";
export type { DeskContextBits, DeskSnapshot } from "./desk-context";

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
  opsBrief: string;
  hops: AgentHop[];
  inboxDrafts: AgentInboxDraft[];
  captionPolicy: AgentCaptionPolicy | null;
  nextSlot: string | null;
  merchUrl: string | null;
  persona: AgentPersonaId;
  skills: AgentSkillId[];
  profile: PageResearchProfile | null;
};

const REFUSE_RE =
  /\b(post (this |it )?now|publish (it|this|now|for me)|auto[- ]?(post|reply|like|comment|follow|share)|send (all|the replies|replies)|reply to (every|all)|go live without me)\b/i;

const AGENT_SYSTEM = `You are the research desk for a Facebook Page operator. You draft. A human clicks Publish and Send.

Hard limits (Meta Platform Policy):
- Never like, follow, share, or post comments.
- Never tell the operator you will publish. You only draft.
- Do not scrape Facebook. Use public web search, optional https URLs the operator pasted (never facebook.com HTML), official developers.facebook.com docs, and the operator's desk data.
- You may explain Meta App ID / Redirect URI / Facebook Login. You never complete Login, never invent an App Secret, never post.
- The DESK OPS snapshot is live from this operator's database: worker/ticker, queue, failed Graph publishes, inbox, vault, cadence, quota headers, scheduler log. Use it when the brief is about the desk. Never invent Graph calls or claim you queried a diagnostic API.
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
    opsBrief: "",
    hops: [],
    inboxDrafts: [],
    captionPolicy: null,
    nextSlot: null,
    merchUrl: null,
    persona: "research",
    skills: [],
    profile: null,
    ...partial,
  };
}

async function attachPublicWeb(brief: string, persona: AgentPersonaId, notes: ResearchNote[]): Promise<ResearchNote[]> {
  const extra = await browsePublicPages(urlsFromBrief(brief));
  if (persona === "connect" || wantsConnect(brief)) {
    try {
      const { fetchOfficialGuide } = await import("./facebook-docs");
      const { META_LOGIN_FLOW, META_NO_SCRAPE } = await import("./meta-setup");
      for (const url of [META_LOGIN_FLOW, META_NO_SCRAPE]) {
        const g = await fetchOfficialGuide(url);
        extra.push({
          heading: g.title,
          body: g.text.slice(0, 900),
          url: g.url,
          confidence: g.live ? "verified" : "unverified",
        });
      }
    } catch {
      /* official docs are best-effort */
    }
  }
  return [...extra, ...notes].slice(0, 12);
}

async function loadDeskSystemContext(
  userId: string,
  pageId: string,
): Promise<{ text: string; snap: DeskSnapshot | null }> {
  try {
    const { buildDeskSnapshot } = await import("./desk-snapshot");
    const snap = await buildDeskSnapshot(userId, pageId);
    return { text: formatDeskSnapshot(snap), snap };
  } catch {
    return { text: "", snap: null };
  }
}

async function attachAssist(
  userId: string,
  page: PageRow,
  profile: PageResearchProfile,
  brief: string,
  snap: DeskSnapshot | null,
  captions: AgentResult["captions"],
  persona: AgentPersonaId,
): Promise<{
  hops: AgentHop[];
  inboxDrafts: AgentInboxDraft[];
  captionPolicy: AgentCaptionPolicy | null;
  nextSlot: string | null;
  merchUrl: string | null;
}> {
  const merchUrl = profile.merch[0]?.url ?? null;
  const nextSlot = scheduleWhenForPage(page.posting_slots_json);
  let hops = hopsFromDesk({ snap, pageId: page.id, storytelling: captions.storytelling });
  let inboxDrafts: AgentInboxDraft[] = [];
  if (wantsFailedFix(brief) && snap?.failed.length) {
    const extras = snap.failed.slice(0, 3).map((f) => ({
      id: `rewrite-${f.id}`,
      kind: "composer" as const,
      label: `Rewrite failed on ${f.pageName}`,
      href: "/composer",
      caption: remixCaption(f.message || f.error),
      postId: f.id,
    }));
    hops = [...extras, ...hops];
  }
  if (wantsInboxDrafts(brief) && snap?.waitingComments.length) {
    inboxDrafts = await draftWaitingComments(userId, page, snap.waitingComments.slice(0, 3));
    hops = [
      ...inboxDrafts.map((d) => ({
        id: `inbox-${d.commentId}`,
        kind: "inbox" as const,
        label: `Reply to ${d.author}`,
        href: `/inbox?comment=${encodeURIComponent(d.commentId)}`,
        commentId: d.commentId,
      })),
      ...hops,
    ];
  }
  hops = rankHops(persona, hops, 10);
  let captionPolicy: AgentCaptionPolicy | null = null;
  if (captions.storytelling.trim()) {
    try {
      const { policyForComposer } = await import("./publish");
      const pol = await policyForComposer(userId, page.id, captions.storytelling, {
        link: merchUrl,
        merchUrl,
        hasImages: false,
        missingAlt: false,
        createdWithAi: false,
      });
      captionPolicy = {
        canPublish: pol.canPublish,
        flags: pol.flags.map((f) => ({ id: f.id, severity: f.severity, title: f.title })),
      };
    } catch {
      captionPolicy = null;
    }
  }
  return { hops, inboxDrafts, captionPolicy, nextSlot, merchUrl };
}

async function draftWaitingComments(
  userId: string,
  page: PageRow,
  comments: NonNullable<DeskSnapshot["waitingComments"]>,
): Promise<AgentInboxDraft[]> {
  const sql = await getSql();
  const provider = (await getSetting(userId, "default_text_provider") || "grok") as TextProviderId;
  const apiKey = await providerKey(userId, provider);
  const can = provider === "grok" ? aiAvailable() : Boolean(apiKey);
  const out: AgentInboxDraft[] = [];
  for (const c of comments) {
    let drafts: string[];
    try {
      drafts = can
        ? await draftReplies({
            comment: c.message,
            brandVoice: page.brand_voice,
            pageName: c.pageName || page.name,
            provider,
            apiKey,
          })
        : [
            "Thanks for writing in — we saw this and will follow up with the details.",
            "Appreciate the question. Stop by or reply here and we'll sort it out.",
            "Good catch. Let me confirm and get back to you.",
          ];
    } catch {
      drafts = ["Thanks for writing in — we'll follow up with the details."];
    }
    await sql`
      update comments
      set reply_drafts_json = ${JSON.stringify(drafts)}, sentiment = ${localSentiment(c.message)}
      where id = ${c.id} and user_id = ${userId}
    `;
    out.push({
      commentId: c.id,
      author: c.author,
      comment: c.message,
      pageName: c.pageName,
      pageId: c.pageId,
      buyingIntent: c.buyingIntent || isBuyingIntent(c.message),
      drafts,
    });
  }
  return out;
}

export async function loadPageProfile(userId: string, pageId: string): Promise<PageResearchProfile> {
  const page = await getPage(userId, pageId);
  if (!page) throw new Error("Select a Page first.");
  return buildPageProfile(userId, page);
}

export async function runDeskAgent(
  userId: string,
  input: { pageId: string; prompt: string; provider?: string; mapPage?: boolean; persona?: string },
): Promise<AgentResult> {
  const refused = agentWouldRefuse(input.prompt);
  if (refused) {
    const { deskLog } = await import("./log");
    await deskLog({
      level: "info",
      scope: "agent.refuse",
      userId,
      message: refused.slice(0, 200),
    });
    return emptyResult({ summary: refused, refused });
  }

  const page = await getPage(userId, input.pageId);
  if (!page) throw new Error("Select a Page first.");
  const profile = await buildPageProfile(userId, page);

  const provider = (input.provider || (await getSetting(userId, "default_text_provider")) || "grok") as TextProviderId;
  const apiKey = await providerKey(userId, provider);
  const canGrok = aiAvailable();
  const brief = (input.mapPage ? mapBriefForPage(profile) : input.prompt).trim().slice(0, 2000);
  const persona: AgentPersonaId = parsePersona(input.persona) ?? pickPersona(brief, input.mapPage);
  const personaNote = `\n\n${personaSystemOverlay(persona)}`;
  const desk = await loadDeskSystemContext(userId, input.pageId);
  const systemContext = desk.text;
  const persistHealth = snapshotLooksLikeOpsBrief(brief) && Boolean(systemContext);
  if (provider === "grok" && !canGrok && !apiKey) {
    // §17.4: no caption model → still deliver the query plan, Page purpose, and
    // unverified desk-topic notes. Never fake citations; never invent captions.
    // Diagnose Server still gets health/needs/logs in the persisted summary.
    const queries = planSearchQueries(profile, brief);
    const researched = await liveResearch(profile, brief, queries);
    researched.notes = await attachPublicWeb(brief, persona, researched.notes);
    const captions = persona === "connect"
      ? {
          storytelling:
            "Open Connect. Paste App ID (digits) and App Secret from Meta → Settings → Basic. Copy this desk’s Redirect URI into Valid OAuth Redirect URIs. Then you click Connect Facebook Login.",
          cta: "Stay in Development Mode. Add yourself as Admin/Developer/Tester. The Agent cannot complete Login.",
          question: "Redirect URI must match exactly (127.0.0.1 vs localhost). Client OAuth Login ON. App Domains empty on loopback.",
        }
      : offlineCaptions(profile, brief);
    const assist = await attachAssist(userId, page, profile, brief, desk.snap, captions, persona);
    const skills = skillsForRun({
      persona,
      brief,
      mapPage: input.mapPage,
      hasCaptions: Boolean(captions.storytelling),
      draftedInbox: assist.inboxDrafts.length > 0,
      rewroteFailed: wantsFailedFix(brief) && (desk.snap?.failed.length ?? 0) > 0,
      snap: desk.snap,
    });
    const laterTitle = (brief.split(/[\n.?!]/)[0] ?? "Idea").trim().slice(0, 60) || "Idea";
    const runId = randomUUID();
    const summary = persistHealth
      ? `${researched.summary}\n${systemContext}`.slice(0, 4000)
      : researched.summary.slice(0, 4000);
    const sql = await getSql();
    const draftsPayload = JSON.stringify({
      ...captions,
      topics: profile.topics.slice(0, 8),
      queries,
      notes: researched.notes,
      pagePurpose: profile.purpose,
      opsBrief: systemContext,
      hops: assist.hops,
      inboxDrafts: assist.inboxDrafts,
      captionPolicy: assist.captionPolicy,
      nextSlot: assist.nextSlot,
      merchUrl: assist.merchUrl,
      persona,
      skills,
    });
    await sql`
      insert into agent_runs (id, user_id, page_id, prompt, summary, drafts_json, sources_json, image_prompt)
      values (
        ${runId}, ${userId}, ${input.pageId}, ${brief.slice(0, 2000)}, ${summary},
        ${draftsPayload}, '[]', ''
      )
    `;
    await sql`delete from agent_runs where user_id = ${userId} and created_at < now() - interval '30 days'`;
    const { deskLog } = await import("./log");
    await deskLog({
      level: "info",
      scope: "agent.run",
      userId,
      message: `${PERSONAS[persona].label} · ${skills.join(", ") || "none"} · ${assist.hops.length} hops`,
      extra: { runId, pageId: page.id, persona, skills },
    });
    return {
      summary,
      sources: [],
      captions,
      imagePrompt: "",
      laterTitle,
      refused: null,
      liveSearch: false,
      runId,
      topics: profile.topics.slice(0, 8),
      queries,
      notes: researched.notes,
      pagePurpose: profile.purpose,
      opsBrief: systemContext,
      hops: assist.hops,
      inboxDrafts: assist.inboxDrafts,
      captionPolicy: assist.captionPolicy,
      nextSlot: assist.nextSlot,
      merchUrl: assist.merchUrl,
      persona,
      skills,
      profile,
    };
  }

  const queries = planSearchQueries(profile, brief);
  const researched = await liveResearch(profile, brief, queries);
  researched.notes = await attachPublicWeb(brief, persona, researched.notes);

  let captions = { storytelling: "", cta: "", question: "" };
  if (persona === "connect") {
    captions = {
      storytelling:
        "Open Connect. Paste App ID (digits) and App Secret from Meta → Settings → Basic. Copy this desk’s Redirect URI into Valid OAuth Redirect URIs. Then you click Connect Facebook Login.",
      cta: "Stay in Development Mode. Add yourself as Admin/Developer/Tester. The Agent cannot complete Login.",
      question: "Redirect URI must match exactly (127.0.0.1 vs localhost). Client OAuth Login ON. App Domains empty on loopback.",
    };
  } else {
    try {
      captions = await generateCaptionVariants({
        brief: `${brief}${personaNote}\n\nPage purpose: ${profile.purpose}${systemContext}\n\nResearch notes:\n${researched.summary.slice(0, 1800)}`,
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
  }

  let imagePrompt = researched.imageHint || "";
  if (!imagePrompt) {
    imagePrompt = await imagePromptFromBrief(page.name, brief, researched.summary, provider, apiKey);
  }
  const laterTitle = (brief.split(/[\n.?!]/)[0] ?? "Idea").trim().slice(0, 60) || "Idea";
  const runId = randomUUID();
  const topics = (researched.topics.length ? researched.topics : profile.topics).slice(0, 8);
  const assist = await attachAssist(userId, page, profile, brief, desk.snap, captions, persona);
  const skills = skillsForRun({
    persona,
    brief,
    mapPage: input.mapPage,
    hasCaptions: Boolean(captions.storytelling),
    draftedInbox: assist.inboxDrafts.length > 0,
    rewroteFailed: wantsFailedFix(brief) && (desk.snap?.failed.length ?? 0) > 0,
    snap: desk.snap,
  });
  const summary = persistHealth
    ? `${researched.summary}\n${systemContext}`.slice(0, 4000)
    : researched.summary.slice(0, 4000);
  const sql = await getSql();
  const draftsPayload = JSON.stringify({
    ...captions,
    topics,
    queries,
    notes: researched.notes,
    pagePurpose: profile.purpose,
    opsBrief: systemContext,
    hops: assist.hops,
    inboxDrafts: assist.inboxDrafts,
    captionPolicy: assist.captionPolicy,
    nextSlot: assist.nextSlot,
    merchUrl: assist.merchUrl,
    persona,
    skills,
  });
  await sql`
    insert into agent_runs (id, user_id, page_id, prompt, summary, drafts_json, sources_json, image_prompt)
    values (
      ${runId}, ${userId}, ${input.pageId}, ${brief.slice(0, 2000)}, ${summary},
      ${draftsPayload}, ${JSON.stringify(researched.sources)}, ${imagePrompt}
    )
  `;
  await sql`delete from agent_runs where user_id = ${userId} and created_at < now() - interval '30 days'`;
  const { deskLog } = await import("./log");
  await deskLog({
    level: "info",
    scope: "agent.run",
    userId,
    message: `${PERSONAS[persona].label} · ${skills.join(", ") || "none"} · ${assist.hops.length} hops`,
    extra: { runId, pageId: page.id, persona, skills },
  });

  return {
    summary,
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
    opsBrief: systemContext,
    hops: assist.hops,
    inboxDrafts: assist.inboxDrafts,
    captionPolicy: assist.captionPolicy,
    nextSlot: assist.nextSlot,
    merchUrl: assist.merchUrl,
    persona,
    skills,
    profile,
  };
}

async function providerKey(userId: string, provider: string): Promise<string | null> {
  if (provider === "openai") return getSetting(userId, "openai_api_key");
  if (provider === "gemini") return getSetting(userId, "google_api_key");
  if (provider === "deepseek") return getSetting(userId, "deepseek_api_key");
  if (provider === "flux") return getSetting(userId, "fal_api_key");
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

/**
 * No-model fallback drafts (§17.4). Templated from desk data only — never
 * invented facts. The operator edits these before anything goes near a Page.
 */
function offlineCaptions(profile: PageResearchProfile, brief: string) {
  const merch = profile.merch[0];
  const lead = (brief || profile.purpose).slice(0, 220);
  return {
    storytelling: `${profile.name}: ${lead}`,
    cta: merch
      ? `Shop ${merch.title}${merch.url ? ` — ${merch.url}` : ""}. Confirm stock before you post.`
      : `Stop in or reply here — hours and stock get confirmed before this goes live.`,
    question: `What would you like to see from ${profile.name} this week?`,
  };
}
