/** Pure desk-ops formatter. Safe on client or in unit tests — no DB import. */

export type DeskContextBits = {
  health: {
    status: string;
    db: string;
    workerFresh: boolean;
    schedulerFresh: boolean;
    workerLastTick: string | null;
    schedulerLastTick: string | null;
  } | null;
  needs: Array<{ title: string; kind?: string; urgency?: string }>;
  logs: Array<{ scope: string; message: string }>;
  cadence?: { postedLast24h: number; warnAt: number; blockAt: number; level: string } | null;
  dueSoon?: number;
};

export type DeskSnapshot = {
  generatedAt: string;
  health: DeskContextBits["health"];
  pages: {
    total: number;
    live: number;
    practice: number;
    readOnly: number;
    selectedName: string | null;
    selectedPractice: boolean;
  };
  queue: {
    localDraft: number;
    localScheduled: number;
    facebookScheduled: number;
    publishing: number;
    failed: number;
    overdue: number;
    published24h: number;
  };
  inbox: { needsReply: number };
  vault: {
    valid: number;
    invalid: number;
    alarm: "ok" | "soon" | "expired" | "none";
    expiresAt: string | null;
  };
  quota: {
    callCountPct: number | null;
    regainMinutes: number | null;
    source: string | null;
    capturedAt: string | null;
  };
  cadence: {
    postedLast24h: number;
    warnAt: number;
    blockAt: number;
    level: string;
    reelLast24h: number;
    reelLevel: string;
  } | null;
  needs: Array<{ title: string; kind?: string; urgency?: string; pageName?: string | null; detail?: string }>;
  failed: Array<{ id: string; pageName: string; error: string; when: string; message: string }>;
  overduePosts: Array<{ id: string; pageName: string; message: string; when: string }>;
  scheduler: Array<{ status: string; error: string | null; path: string | null; code: number | null; when: string }>;
  logs: Array<{ level: string; scope: string; message: string; createdAt?: string | null }>;
  lastSync: string | null;
  facebookLastError: string | null;
  merchCount: number;
  rssFeeds: number;
  devices: number;
  waitingComments: Array<{
    id: string;
    author: string;
    message: string;
    pageName: string;
    pageId: string;
    buyingIntent: boolean;
  }>;
  ideas: Array<{ id: string; title: string; body: string; column: string; pageName: string | null }>;
  snippets: Array<{ label: string; body: string }>;
  recentRuns: Array<{ prompt: string; persona: string | null; when: string }>;
  week: Array<{ label: string; weekday: string; scheduled: number; published: number; isToday: boolean }>;
  collisions: Array<{ pageA: string; pageB: string; excerpt: string }>;
  stills: number;
  slots: Array<{ day: number; hour: number }>;
  voice: string | null;
};

/** Compact health/needs/logs block (legacy Diagnose shape). */
export function formatDeskSystemContext(bits: DeskContextBits): string {
  if (!bits.health && bits.needs.length === 0 && bits.logs.length === 0 && !bits.cadence) return "";
  const lines = ["", "Server & Desk Context:"];
  if (bits.health) {
    lines.push(`- Server status: ${bits.health.status} (DB: ${bits.health.db})`);
    lines.push(
      `- In-tab ticker: ${bits.health.schedulerFresh ? "Active" : "Idle/Pending"} (last: ${bits.health.schedulerLastTick || "none"})`,
    );
    lines.push(
      `- Background worker: ${bits.health.workerFresh ? "Active" : "Idle/Pending"} (last: ${bits.health.workerLastTick || "none"})`,
    );
  }
  lines.push(
    `- Active desk items: ${bits.needs.length} (${bits.needs.map((n) => n.title).slice(0, 3).join("; ") || "none"})`,
  );
  if (bits.dueSoon != null) lines.push(`- Needs-you now/overdue: ${bits.dueSoon}`);
  if (bits.cadence) {
    lines.push(
      `- Cadence this Page: ${bits.cadence.postedLast24h} in 24h (warn ${bits.cadence.warnAt}, block ${bits.cadence.blockAt}, ${bits.cadence.level})`,
    );
  }
  lines.push(
    `- Recent logs: ${bits.logs.map((l) => `${l.scope}:${l.message}`).slice(0, 3).join(" | ") || "none"}`,
  );
  return lines.join("\n");
}

function rel(iso: string | null | undefined): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const mins = Math.round((Date.now() - t) / 60_000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return mins > 0 ? `${mins}m ago` : `in ${Math.abs(mins)}m`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return hours > 0 ? `${hours}h ago` : `in ${Math.abs(hours)}h`;
  return iso.slice(0, 16);
}

/** Full operator snapshot for the Agent — every desk surface, no secrets. */
export function formatDeskSnapshot(snap: DeskSnapshot): string {
  const h = snap.health;
  const lines = [
    "",
    "=== DESK OPS (read-only, live from this operator's database — not a Facebook scrape) ===",
    `Generated ${rel(snap.generatedAt)}`,
    "",
    "Runtime:",
    `- DB ${h?.db ?? "unknown"}; status ${h?.status ?? "unknown"}`,
    `- In-tab ticker: ${h?.schedulerFresh ? "fresh" : "idle"} (last ${rel(h?.schedulerLastTick ?? null)})`,
    `- Background worker: ${h?.workerFresh ? "fresh" : "idle"} (last ${rel(h?.workerLastTick ?? null)})`,
    `- Last Graph sync: ${rel(snap.lastSync)}`,
    snap.facebookLastError ? `- Last Facebook error: ${snap.facebookLastError}` : "- Last Facebook error: none",
    "",
    "Pages:",
    `- ${snap.pages.total} total (${snap.pages.live} live, ${snap.pages.practice} practice, ${snap.pages.readOnly} analyze-only)`,
    `- Selected: ${snap.pages.selectedName ?? "none"}${snap.pages.selectedPractice ? " (practice)" : ""}`,
    "",
    "Queue:",
    `- LocalDraft ${snap.queue.localDraft}; LocalScheduled ${snap.queue.localScheduled}; FacebookScheduled ${snap.queue.facebookScheduled}; Publishing ${snap.queue.publishing}`,
    `- Failed ${snap.queue.failed}; overdue LocalScheduled ${snap.queue.overdue}; Published last 24h ${snap.queue.published24h}`,
    "",
    "Inbox / merch / devices:",
    `- Comments needing a human reply: ${snap.inbox.needsReply}`,
    `- Merch links: ${snap.merchCount}; RSS feeds: ${snap.rssFeeds}; paired devices: ${snap.devices}`,
    "",
    "Vault / Graph quota:",
    `- Tokens: ${snap.vault.valid} valid, ${snap.vault.invalid} invalid; alarm ${snap.vault.alarm}; expires ${rel(snap.vault.expiresAt)}`,
    snap.quota.source
      ? `- ${snap.quota.source}: call_count ${snap.quota.callCountPct ?? "?"}%; regain ${snap.quota.regainMinutes ?? 0}m; captured ${rel(snap.quota.capturedAt)}`
      : "- No Graph usage header stored yet (appears after a live Graph call)",
  ];
  if (snap.cadence) {
    lines.push(
      "",
      "This Page cadence:",
      `- Posts in 24h window: ${snap.cadence.postedLast24h} (warn ${snap.cadence.warnAt}, block ${snap.cadence.blockAt}, ${snap.cadence.level})`,
      `- Reels API 24h: ${snap.cadence.reelLast24h} (${snap.cadence.reelLevel}; Meta cap 30)`,
    );
  }
  if (snap.needs.length) {
    lines.push("", "Needs you:");
    for (const n of snap.needs.slice(0, 8)) {
      lines.push(`- [${n.urgency ?? "info"}] ${n.title}${n.pageName ? ` · ${n.pageName}` : ""}${n.detail ? ` — ${n.detail.slice(0, 120)}` : ""}`);
    }
  } else {
    lines.push("", "Needs you: none");
  }
  if (snap.overduePosts?.length) {
    lines.push("", "Overdue LocalScheduled (desk was closed — publish from Needs you or Drafts):");
    for (const p of snap.overduePosts.slice(0, 5)) {
      lines.push(`- ${p.pageName}: ${(p.message || "(no caption)").slice(0, 80)} (${rel(p.when)})`);
    }
  }
  if (snap.failed.length) {
    lines.push("", "Failed publishes (media still on the row — retry from Drafts):");
    for (const f of snap.failed.slice(0, 5)) {
      lines.push(`- ${f.pageName}: ${f.error.slice(0, 180)}${f.message ? ` — “${f.message.slice(0, 80)}”` : ""} (${rel(f.when)})`);
    }
  }
  if (snap.scheduler.length) {
    lines.push("", "Recent scheduler / Graph attempts:");
    for (const s of snap.scheduler.slice(0, 6)) {
      lines.push(
        `- ${s.status}${s.code != null ? ` Graph ${s.code}` : ""}${s.path ? ` ${s.path}` : ""}${s.error ? ` — ${s.error.slice(0, 140)}` : ""} (${rel(s.when)})`,
      );
    }
  }
  if (snap.waitingComments?.length) {
    lines.push("", "Inbox waiting (human still clicks Send):");
    for (const c of snap.waitingComments.slice(0, 5)) {
      lines.push(
        `- ${c.buyingIntent ? "[buy] " : ""}${c.author} on ${c.pageName}: ${c.message.slice(0, 140)}`,
      );
    }
  }
  if (snap.logs.length) {
    lines.push("", "Desk log:");
    for (const l of snap.logs.slice(0, 8)) {
      lines.push(`- ${formatHappening(l)}`);
    }
  }
  if (snap.ideas?.length) {
    lines.push("", "Later (parked, not posted):");
    for (const idea of snap.ideas.slice(0, 5)) {
      lines.push(`- [${idea.column}] ${idea.title}${idea.pageName ? ` · ${idea.pageName}` : ""} — ${idea.body.slice(0, 80)}`);
    }
  }
  if (snap.snippets?.length) {
    lines.push("", "Caption snippets:");
    for (const s of snap.snippets.slice(0, 4)) {
      lines.push(`- ${s.label}: ${s.body.slice(0, 80)}`);
    }
  }
  if (snap.recentRuns?.length) {
    lines.push("", "Previous Agent runs:");
    for (const r of snap.recentRuns.slice(0, 4)) {
      lines.push(`- ${r.persona ?? "research"}: ${r.prompt.slice(0, 80)} (${rel(r.when)})`);
    }
  }
  if (snap.week?.length) {
    lines.push("", "This week:");
    for (const d of snap.week) {
      lines.push(`- ${d.weekday} ${d.label}: ${d.scheduled} queued, ${d.published} live${d.isToday ? " (today)" : ""}`);
    }
  }
  if (snap.collisions?.length) {
    lines.push("", "Unique Pages collisions (rewrite before sending):");
    for (const c of snap.collisions.slice(0, 3)) {
      lines.push(`- ${c.pageA} ≈ ${c.pageB}: “${c.excerpt.slice(0, 80)}”`);
    }
  }
  if (snap.stills) lines.push("", `Library stills on disk: ${snap.stills} (not posted until you attach them in Composer)`);
  if (snap.voice) lines.push("", `This Page voice: ${snap.voice.slice(0, 180)}`);
  if (snap.slots?.length) {
    lines.push(`Posting slots: ${snap.slots.map((s) => `D${s.day}@${s.hour}`).join(", ")}`);
  }
  lines.push(
    "",
    "Hard limits: you draft only. A human clicks Publish and Send. Do not invent Graph calls, hours, or events.",
  );
  return lines.join("\n");
}

/** Operator-facing scope names for Happenings. Unknown scopes stay as-is. */
export function happeningScopeLabel(scope: string): string {
  switch (scope) {
    case "agent.run":
      return "Agent";
    case "agent.refuse":
      return "Agent refused";
    case "tick.done":
      return "Ticker";
    case "tick.scheduler":
      return "Scheduler";
    case "tick.sync":
      return "Graph sync";
    case "tick.rss":
      return "RSS";
    case "tick.recycle":
      return "Recycle";
    case "tick.vault":
      return "Vault refresh";
    case "worker":
      return "Worker";
    case "compose":
      return "Composer";
    case "compose.extra":
      return "Composer extras";
    case "inbox.reply":
      return "Inbox";
    case "inbox.hide":
      return "Inbox hide";
    case "sync.now":
      return "Sync";
    case "graph.publish":
      return "Publish";
    case "clone":
      return "Clone";
    case "client":
      return "Browser";
    case "needs":
      return "Needs you";
    case "shell.bootstrap":
      return "Desk load";
    case "shell.tick":
      return "In-tab ticker";
    case "api.tick":
      return "Tick API";
    case "sync.action":
      return "Phone sync";
    case "weekPlanner":
      return "Week planner";
    case "media.asset":
      return "Media library";
    case "imagine":
      return "Imagine";
    case "memory":
      return "Later / snippets";
    case "desk.snapshot":
      return "Desk snapshot";
    case "facebook.app":
      return "Meta app";
    default:
      return scope;
  }
}

export function formatHappening(log: {
  level: string;
  scope: string;
  message: string;
  createdAt?: string | null;
}): string {
  const when = log.createdAt ? rel(log.createdAt) : "";
  const bits = [when, log.level, happeningScopeLabel(log.scope), log.message.slice(0, 160)].filter(Boolean);
  return bits.join(" · ");
}

export function snapshotLooksLikeOpsBrief(brief: string): boolean {
  return (
    /\bdiagnos/i.test(brief) ||
    /desk ops|rate.?limit|what.?s happening/i.test(brief) ||
    /\b(health|worker|queue|overdue|failed|vault|inbox|cadence|quota|happening|ticker|scheduler)\b/i.test(brief)
  );
}
