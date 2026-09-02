/** Pure Agent HITL hops — no I/O. A human still clicks Send. */

import type { DeskSnapshot } from "./desk-context";
import type { AgentPersonaId } from "./agent-skills";

export const HOP_KINDS = [
  "composer",
  "schedule",
  "later",
  "inbox",
  "drafts",
  "vault",
  "failed",
  "calendar",
  "merch",
  "settings",
  "analytics",
  "media",
  "pair",
  "connect",
  "home",
] as const;

export type AgentHopKind = (typeof HOP_KINDS)[number];

export type AgentHop = {
  id: string;
  kind: AgentHopKind;
  label: string;
  href: string;
  caption?: string;
  commentId?: string;
  postId?: string;
  ideaId?: string;
};

export type AgentInboxDraft = {
  commentId: string;
  author: string;
  comment: string;
  pageName: string;
  pageId: string;
  buyingIntent: boolean;
  drafts: string[];
};

export type AgentCaptionPolicy = {
  canPublish: boolean;
  flags: Array<{ id: string; severity: string; title: string }>;
};

export function isHopKind(value: string): value is AgentHopKind {
  return (HOP_KINDS as readonly string[]).includes(value);
}

export function wantsInboxDrafts(brief: string): boolean {
  return /\b(inbox|repl(y|ies)|comment|buying intent|needs you)\b/i.test(brief);
}

export function wantsFailedFix(brief: string): boolean {
  return /\b(failed|retry|fix (the )?publish|error_message|graph \d+)\b/i.test(brief);
}

export function wantsCalendar(brief: string): boolean {
  return /\b(calendar|week plan|this week's slots|posting slots?|heatmap|next (good )?slot)\b/i.test(brief);
}

export function wantsMemory(brief: string): boolean {
  return /\b(parked ideas?|later board|snippets?|recall|previous (agent )?runs?|from memory|remember this)\b/i.test(brief);
}

export { wantsConnect } from "./meta-setup";

/** Persona-first hop order. Unknown kinds sort last, original order as tie-break. */
const PERSONA_KIND_ORDER: Record<AgentPersonaId, AgentHopKind[]> = {
  research: ["composer", "schedule", "later", "calendar", "merch", "media"],
  ops: ["failed", "vault", "drafts", "inbox", "settings", "connect", "analytics", "calendar"],
  inbox: ["inbox", "composer", "later", "drafts"],
  shop: ["merch", "composer", "schedule", "later", "analytics"],
  rewrite: ["failed", "composer", "drafts", "schedule", "later"],
  calendar: ["calendar", "schedule", "drafts", "composer", "analytics"],
  memory: ["later", "composer", "schedule", "media", "calendar"],
  connect: ["connect", "settings", "vault", "home"],
};

export function rankHops(persona: AgentPersonaId, hops: AgentHop[], cap = 10): AgentHop[] {
  const order = PERSONA_KIND_ORDER[persona] ?? [];
  return hops
    .map((h, i) => {
      const idx = order.indexOf(h.kind);
      return { h, score: idx === -1 ? 80 + i : idx, i };
    })
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((row) => row.h)
    .slice(0, cap);
}

export function hopsFromDesk(input: {
  snap: DeskSnapshot | null;
  pageId?: string | null;
  storytelling?: string;
}): AgentHop[] {
  const hops: AgentHop[] = [];
  const pageQ = input.pageId ? `?page=${encodeURIComponent(input.pageId)}` : "";
  const snap = input.snap;

  if (snap?.queue.failed) {
    hops.push({
      id: "failed",
      kind: "failed",
      label: `Open ${snap.queue.failed} failed publish${snap.queue.failed === 1 ? "" : "es"}`,
      href: "/drafts?tab=failed",
    });
    for (const f of (snap.failed ?? []).slice(0, 2)) {
      if (!f.id) continue;
      hops.push({
        id: `failed-${f.id}`,
        kind: "failed",
        label: `Inspect failed: ${(f.message || f.error).slice(0, 40) || f.pageName}`,
        href: "/drafts?tab=failed",
        postId: f.id,
        caption: f.message || undefined,
      });
    }
  }
  if (snap?.queue.overdue) {
    hops.push({
      id: "overdue",
      kind: "drafts",
      label: `Open ${snap.queue.overdue} overdue`,
      href: "/drafts?tab=queued",
    });
    for (const p of (snap.overduePosts ?? []).slice(0, 2)) {
      hops.push({
        id: `overdue-${p.id}`,
        kind: "drafts",
        label: `Inspect overdue: ${(p.message || p.pageName).slice(0, 40)}`,
        href: "/drafts?tab=queued",
        postId: p.id,
      });
    }
  }
  if (snap?.inbox.needsReply) {
    hops.push({
      id: "inbox",
      kind: "inbox",
      label: `Open inbox (${snap.inbox.needsReply} waiting)`,
      href: "/inbox",
    });
  }
  if (snap?.vault.alarm === "expired" || snap?.vault.alarm === "soon") {
    hops.push({
      id: "vault",
      kind: "vault",
      label: snap.vault.alarm === "expired" ? "Reconnect Facebook (token expired)" : "Reconnect Facebook (token soon)",
      href: "/settings",
    });
    if (snap.vault.alarm === "expired") {
      hops.push({
        id: "connect",
        kind: "connect",
        label: "Open Connect",
        href: "/connect",
      });
    }
  }
  if (snap?.vault.alarm === "none") {
    hops.push({
      id: "connect",
      kind: "connect",
      label: "Connect Facebook",
      href: "/connect",
    });
  }
  if (input.storytelling) {
    hops.push({
      id: "composer",
      kind: "composer",
      label: "Open caption in Composer",
      href: "/composer",
      caption: input.storytelling,
    });
    hops.push({
      id: "schedule",
      kind: "schedule",
      label: "Schedule caption in Composer",
      href: "/composer",
      caption: input.storytelling,
    });
    hops.push({
      id: "later",
      kind: "later",
      label: "Park on Later",
      href: "/later",
      caption: input.storytelling,
    });
  }
  hops.push({ id: "calendar", kind: "calendar", label: "Open Calendar", href: "/calendar" });
  for (const idea of (snap?.ideas ?? []).slice(0, 2)) {
    hops.push({
      id: `idea-${idea.id}`,
      kind: "later",
      label: `Open Later: ${idea.title.slice(0, 36)}`,
      href: "/later",
      caption: idea.body,
      ideaId: idea.id,
    });
  }
  if ((snap?.ideas?.length ?? 0) > 0 && !hops.some((h) => h.id === "later-board")) {
    hops.push({ id: "later-board", kind: "later", label: `Later board (${snap?.ideas?.length})`, href: "/later" });
  }
  if ((snap?.stills ?? 0) > 0) {
    hops.push({ id: "stills", kind: "media", label: `Library stills (${snap?.stills})`, href: "/media" });
  }
  if ((snap?.collisions?.length ?? 0) > 0) {
    hops.push({
      id: "collisions",
      kind: "home",
      label: `Unique Pages collision (${snap?.collisions.length})`,
      href: "/",
    });
  }
  if ((snap?.merchCount ?? 0) > 0) {
    hops.push({ id: "merch", kind: "merch", label: `Merchandise (${snap?.merchCount})`, href: "/merchandise" });
  }
  if ((snap?.rssFeeds ?? 0) > 0) {
    hops.push({ id: "rss", kind: "settings", label: `RSS feeds (${snap?.rssFeeds})`, href: "/settings" });
  }
  const cadenceHot = snap?.cadence && (snap.cadence.level !== "ok" || snap.cadence.reelLevel !== "ok");
  const quotaHot = (snap?.quota.callCountPct ?? 0) >= 70;
  if (cadenceHot || quotaHot) {
    hops.push({
      id: "analytics",
      kind: "analytics",
      label: quotaHot ? "Open Analytics (quota hot)" : "Open Analytics (cadence)",
      href: "/analytics",
    });
  }
  if ((snap?.devices ?? 0) === 0) {
    hops.push({ id: "pair", kind: "pair", label: "Pair a phone", href: "/pair" });
  }
  if (!hops.some((h) => h.kind === "composer")) {
    hops.push({ id: "composer-empty", kind: "composer", label: "Open Composer", href: `/composer${pageQ}` });
  }
  if (!hops.some((h) => h.kind === "connect")) {
    hops.push({ id: "connect-help", kind: "connect", label: "Open Connect (Meta app)", href: "/connect" });
  }
  return hops.slice(0, 14);
}
