/**
 * Agent personas + named skills. Pure — no I/O.
 *
 * Personas only change voice and which skills/hops fire. Skills name what
 * this run actually did. A human still clicks Send.
 */

import { snapshotLooksLikeOpsBrief } from "./desk-context";
import { wantsFailedFix, wantsInboxDrafts, wantsCalendar, wantsMemory, wantsConnect } from "./agent-hops";

export const AGENT_PERSONAS = ["research", "ops", "inbox", "shop", "rewrite", "calendar", "memory", "connect"] as const;
export type AgentPersonaId = (typeof AGENT_PERSONAS)[number];

export const AGENT_SKILLS = [
  "research-web",
  "map-page",
  "diagnose-desk",
  "draft-captions",
  "draft-inbox",
  "rewrite-failed",
  "merch-cta",
  "policy-check",
  "schedule-slot",
  "week-plan",
  "cadence-watch",
  "vault-watch",
  "quota-watch",
  "rss-remix",
  "recall-later",
  "recall-runs",
  "meta-docs",
  "browse-web",
] as const;
export type AgentSkillId = (typeof AGENT_SKILLS)[number];

export type AgentPersona = {
  id: AgentPersonaId;
  label: string;
  hint: string;
  starter: string;
  system: string;
};

export const PERSONAS: Record<AgentPersonaId, AgentPersona> = {
  research: {
    id: "research",
    label: "Research",
    hint: "Public web notes + three captions in this Page’s voice.",
    starter: "Find a timely local angle I can post today. Facts only. One image idea.",
    system:
      "Persona: research desk. Plan public-web queries, take sourced notes, draft three captions. Unverified stays labeled.",
  },
  ops: {
    id: "ops",
    label: "Ops",
    hint: "Read DESK OPS (ticker, queue, vault, fails). Do not invent Graph calls.",
    starter:
      "What's happening on this desk? Using the DESK OPS snapshot, summarize queue, fails, inbox, vault, and ticker. Do not invent Graph calls.",
    system:
      "Persona: ops desk. Use only the attached DESK OPS snapshot. Never invent Graph, hours, or worker status. Draft three short operator notes.",
  },
  inbox: {
    id: "inbox",
    label: "Inbox",
    hint: "Draft replies for waiting comments. You still click Send.",
    starter:
      "Draft inbox replies for waiting comments on this Page. Buying-intent first. A human still clicks Send.",
    system:
      "Persona: inbox desk. Draft short human replies. Never send, hide, or like. Buying-intent comments come first.",
  },
  shop: {
    id: "shop",
    label: "Shop",
    hint: "Merch CTA captions. Warn for #ad. Do not invent stock.",
    starter: "Write a restock caption in this Page’s voice with the merch CTA. Facts only. Add a place for #ad.",
    system:
      "Persona: shop desk. Use merch titles/URLs from the Page profile. Do not invent stock or prices. Leave room for #ad.",
  },
  rewrite: {
    id: "rewrite",
    label: "Rewrite",
    hint: "Remix failed/clone captions so they are not identical.",
    starter:
      "Fix failed publishes on this desk. Rewrite each failed caption in this Page's voice. Do not publish.",
    system:
      "Persona: rewrite desk. Failed and clone drafts must be rewritten in this Page’s voice. Identical copy is a spam risk.",
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    hint: "Week slots, overdue LocalScheduled, cadence. You still click Publish.",
    starter:
      "Plan this week's posting slots using DESK OPS. Flag overdue LocalScheduled and cadence. Suggest the next good slot. Do not publish.",
    system:
      "Persona: calendar desk. Use desk slots, overdue queue, and cadence only. Never invent Graph scheduled times. A human still clicks Publish.",
  },
  memory: {
    id: "memory",
    label: "Memory",
    hint: "Draft from Later, snippets, and previous Agent runs. You still click Send.",
    starter:
      "Recall parked Later ideas and recent Agent runs for this Page. Turn the best one into three captions. Do not invent facts that were not parked. Do not publish.",
    system:
      "Persona: memory desk. Use Later ideas, snippets, and previous run summaries from DESK OPS. Do not invent facts that were not parked. A human still clicks Send.",
  },
  connect: {
    id: "connect",
    label: "Connect",
    hint: "Walk Meta app setup. You paste App ID/Secret and click Facebook Login.",
    starter:
      "Help me connect this desk to my Meta developer app. Graph v26.0 only. Explain App ID, Redirect URI, Development Mode, and Facebook Login. Do not invent a secret. Do not complete Login for me.",
    system:
      "Persona: connect desk. Official Graph + Facebook Login only. Never scrape facebook.com. Never invent App Secret. Never claim you logged in. A human pastes credentials and clicks Connect.",
  },
};

export function parsePersona(raw?: string | null): AgentPersonaId | null {
  if (!raw) return null;
  return (AGENT_PERSONAS as readonly string[]).includes(raw) ? (raw as AgentPersonaId) : null;
}

export function pickPersona(brief: string, mapPage?: boolean): AgentPersonaId {
  if (mapPage) return "research";
  if (wantsInboxDrafts(brief)) return "inbox";
  if (wantsFailedFix(brief)) return "rewrite";
  if (/\b(merch|shop|tote|restock|cta|#ad|buy now)\b/i.test(brief)) return "shop";
  if (wantsConnect(brief)) return "connect";
  if (wantsMemory(brief)) return "memory";
  if (wantsCalendar(brief)) return "calendar";
  if (snapshotLooksLikeOpsBrief(brief)) return "ops";
  return "research";
}

/** Map a Needs-you kind onto the persona that should draft next. */
export function personaForNeed(kind: string): AgentPersonaId {
  if (kind === "comment") return "inbox";
  if (kind === "failed") return "rewrite";
  if (kind === "overdue" || kind === "cadence") return "calendar";
  return "ops";
}

export type SkillRunInput = {
  persona: AgentPersonaId;
  brief: string;
  mapPage?: boolean;
  hasCaptions: boolean;
  draftedInbox: boolean;
  rewroteFailed: boolean;
  snap?: {
    vault?: { alarm: string };
    cadence?: { level: string; reelLevel: string } | null;
    quota?: { callCountPct: number | null };
    rssFeeds?: number;
    queue?: { overdue: number };
    ideas?: unknown[];
    recentRuns?: unknown[];
  } | null;
};

export function skillsForRun(input: SkillRunInput): AgentSkillId[] {
  const skills = new Set<AgentSkillId>();
  if (input.mapPage) skills.add("map-page");
  if (input.persona === "ops") skills.add("diagnose-desk");
  if (input.persona === "research" || input.mapPage) skills.add("research-web");
  if (input.persona === "shop") skills.add("merch-cta");
  if (input.persona === "calendar") skills.add("week-plan");
  if (input.persona === "memory") {
    skills.add("recall-later");
    skills.add("recall-runs");
  }
  if (input.persona === "connect") skills.add("meta-docs");
  if (/\bhttps:\/\//i.test(input.brief) || /\b(browse|look at this (url|page|site)|news)\b/i.test(input.brief)) {
    skills.add("browse-web");
  }
  if (input.hasCaptions) {
    skills.add("draft-captions");
    skills.add("policy-check");
    skills.add("schedule-slot");
  }
  if (input.draftedInbox) skills.add("draft-inbox");
  if (input.rewroteFailed) skills.add("rewrite-failed");
  if (input.persona === "inbox") skills.add("draft-inbox");
  if (input.persona === "rewrite") skills.add("rewrite-failed");
  const snap = input.snap;
  if (snap?.vault && (snap.vault.alarm === "soon" || snap.vault.alarm === "expired")) {
    skills.add("vault-watch");
  }
  if (snap?.cadence && (snap.cadence.level !== "ok" || snap.cadence.reelLevel !== "ok")) {
    skills.add("cadence-watch");
  }
  if ((snap?.quota?.callCountPct ?? 0) >= 70) skills.add("quota-watch");
  if ((snap?.rssFeeds ?? 0) > 0 && /\b(rss|feed|remix)\b/i.test(input.brief)) {
    skills.add("rss-remix");
  }
  if ((snap?.queue?.overdue ?? 0) > 0 && (input.persona === "calendar" || input.persona === "ops")) {
    skills.add("week-plan");
  }
  if ((snap?.ideas?.length ?? 0) > 0 && (input.persona === "memory" || input.persona === "research")) {
    skills.add("recall-later");
  }
  if ((snap?.recentRuns?.length ?? 0) > 0 && input.persona === "memory") {
    skills.add("recall-runs");
  }
  return AGENT_SKILLS.filter((s) => skills.has(s));
}

export function personaSystemOverlay(persona: AgentPersonaId): string {
  return PERSONAS[persona].system;
}

export function skillLabel(id: AgentSkillId): string {
  switch (id) {
    case "research-web":
      return "Public web research";
    case "map-page":
      return "Map this Page";
    case "diagnose-desk":
      return "Diagnose desk";
    case "draft-captions":
      return "Draft captions";
    case "draft-inbox":
      return "Draft inbox replies";
    case "rewrite-failed":
      return "Rewrite failed";
    case "merch-cta":
      return "Merch CTA";
    case "policy-check":
      return "Policy check";
    case "schedule-slot":
      return "Next slot";
    case "week-plan":
      return "Week plan";
    case "cadence-watch":
      return "Cadence watch";
    case "vault-watch":
      return "Vault watch";
    case "quota-watch":
      return "Quota watch";
    case "rss-remix":
      return "RSS remix";
    case "recall-later":
      return "Recall Later";
    case "recall-runs":
      return "Recall runs";
    case "meta-docs":
      return "Meta developer docs";
    case "browse-web":
      return "Public web browse";
    default:
      return id;
  }
}
