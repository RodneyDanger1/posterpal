/**
 * Read-only desk snapshot for the Agent. Aggregates every operator surface
 * (queue, vault, inbox, Graph quota, worker, failures) without tokens or App Secret.
 */
import { getSql } from "@/lib/db";
import { isBuyingIntent, vaultAlarm } from "./operator";
import type { DeskSnapshot } from "./desk-context";

export async function buildDeskSnapshot(userId: string, pageId?: string | null): Promise<DeskSnapshot> {
  const generatedAt = new Date().toISOString();
  const empty: DeskSnapshot = {
    generatedAt,
    health: null,
    pages: { total: 0, live: 0, practice: 0, readOnly: 0, selectedName: null, selectedPractice: false },
    queue: {
      localDraft: 0,
      localScheduled: 0,
      facebookScheduled: 0,
      publishing: 0,
      failed: 0,
      overdue: 0,
      published24h: 0,
    },
    inbox: { needsReply: 0 },
    vault: { valid: 0, invalid: 0, alarm: "none", expiresAt: null },
    quota: { callCountPct: null, regainMinutes: null, source: null, capturedAt: null },
    cadence: null,
    needs: [],
    failed: [],
    scheduler: [],
    logs: [],
    lastSync: null,
    facebookLastError: null,
    merchCount: 0,
    rssFeeds: 0,
    devices: 0,
    waitingComments: [],
    overduePosts: [],
    ideas: [],
    snippets: [],
    recentRuns: [],
    week: [],
    collisions: [],
    stills: 0,
    slots: [],
    voice: null,
  };

  try {
    const { readDeskHealth, listDeskLogs } = await import("./log");
    const { needsYou } = await import("./devices");
    const { cadenceForPage, getPage, getSetting, inboxCount, latestQuota, listPages, listVault } = await import("./repo");
    const { findCollisions } = await import("./briefing");
    const { parseSlots, buildWeekStrip } = await import("./slots");
    const sql = await getSql();

    const [health, needs, logs, pages, vault, quota, lastSync, facebookLastError, inboxN] = await Promise.all([
      readDeskHealth(userId).catch(() => null),
      needsYou(userId).catch(() => []),
      listDeskLogs(userId, 8).catch(() => []),
      listPages(userId).catch(() => []),
      listVault(userId).catch(() => []),
      latestQuota(userId).catch(() => null),
      getSetting(userId, "last_graph_sync").catch(() => null),
      getSetting(userId, "facebook_last_error").catch(() => null),
      inboxCount(userId).catch(() => 0),
    ]);

    const selected = pageId ? await getPage(userId, pageId).catch(() => null) : pages[0] ?? null;
    const cadence = selected ? await cadenceForPage(userId, selected.id).catch(() => null) : null;

    const [queueRows, overdueRows, pub24Rows, failedRows, overduePostRows, schedRows, merchRows, rssRows, deviceRows, commentRows, ideaRows, snippetRows, runRows, stillRows, collisionSrc] = await Promise.all([
      sql<{ status: string; n: number }>`
        select status, count(*)::int as n
        from posts
        where user_id = ${userId}
        group by status
      `.catch(() => []),
      sql<{ n: number }>`
        select count(*)::int as n from posts
        where user_id = ${userId}
          and status = 'LocalScheduled'
          and scheduled_publish_time is not null
          and scheduled_publish_time < now()
      `.catch(() => []),
      sql<{ n: number }>`
        select count(*)::int as n from posts
        where user_id = ${userId}
          and status = 'Published'
          and coalesce(published_time, created_at) > now() - interval '24 hours'
      `.catch(() => []),
      sql<{ id: string; page_name: string; error_message: string | null; updated_at: string; message: string | null }>`
        select po.id, pa.name as page_name, po.error_message, po.updated_at, po.message
        from posts po join pages pa on pa.id = po.page_id
        where po.user_id = ${userId} and po.status = 'Failed'
        order by po.updated_at desc
        limit 5
      `.catch(() => []),
      sql<{ id: string; page_name: string; message: string | null; scheduled_publish_time: string }>`
        select po.id, pa.name as page_name, po.message, po.scheduled_publish_time
        from posts po join pages pa on pa.id = po.page_id
        where po.user_id = ${userId}
          and po.status = 'LocalScheduled'
          and po.scheduled_publish_time is not null
          and po.scheduled_publish_time < now()
        order by po.scheduled_publish_time
        limit 5
      `.catch(() => []),
      sql<{
        status: string;
        error_message: string | null;
        request_path: string | null;
        graph_error_code: number | null;
        attempt_time: string;
      }>`
        select status, error_message, request_path, graph_error_code, attempt_time
        from scheduler_logs
        where user_id = ${userId}
        order by attempt_time desc
        limit 6
      `.catch(() => []),
      sql<{ n: number }>`select count(*)::int as n from merchandise_links where user_id = ${userId}`.catch(() => []),
      sql<{ n: number }>`
        select count(*)::int as n from pages
        where user_id = ${userId} and rss_feed_url is not null and rss_feed_url <> ''
      `.catch(() => []),
      sql<{ n: number }>`
        select count(*)::int as n from devices where user_id = ${userId} and revoked_at is null
      `.catch(() => []),
      sql<{
        id: string;
        message: string;
        author_name: string | null;
        page_name: string;
        page_id: string;
      }>`
        select c.id, c.message, c.author_name, pa.name as page_name, pa.id as page_id
        from comments c
        join posts po on po.id = c.post_id
        join pages pa on pa.id = po.page_id
        where c.user_id = ${userId} and c.needs_reply = true and c.is_hidden = false and c.is_from_page = false
        order by c.created_at desc
        limit 6
      `.catch(() => []),
      sql<{ id: string; title: string; body: string; notes: string | null; page_name: string | null }>`
        select i.id, i.title, i.body, i.notes, p.name as page_name
        from saved_ideas i
        left join pages p on p.id = i.page_id
        where i.user_id = ${userId}
        order by i.created_at desc
        limit 6
      `.catch(() => []),
      sql<{ label: string; body: string }>`
        select label, body from caption_snippets
        where user_id = ${userId}
        order by created_at desc
        limit 4
      `.catch(() => []),
      sql<{ prompt: string; drafts_json: string | null; created_at: string }>`
        select prompt, drafts_json, created_at from agent_runs
        where user_id = ${userId}
        order by created_at desc
        limit 4
      `.catch(() => []),
      sql<{ n: number }>`select count(*)::int as n from media_assets where user_id = ${userId}`.catch(() => []),
      sql<{ page_id: string; page_name: string; message: string }>`
        select po.page_id, pa.name as page_name, po.message
        from posts po join pages pa on pa.id = po.page_id
        where po.user_id = ${userId}
          and po.message is not null and po.message <> ''
          and po.status in ('Published', 'FacebookScheduled', 'LocalScheduled', 'LocalDraft')
        order by po.created_at desc
        limit 40
      `.catch(() => []),
    ]);

    const queue = { ...empty.queue };
    for (const r of queueRows) {
      const n = Number(r.n ?? 0);
      if (r.status === "LocalDraft") queue.localDraft = n;
      else if (r.status === "LocalScheduled") queue.localScheduled = n;
      else if (r.status === "FacebookScheduled") queue.facebookScheduled = n;
      else if (r.status === "Publishing") queue.publishing = n;
      else if (r.status === "Failed") queue.failed = n;
    }
    queue.overdue = Number(overdueRows[0]?.n ?? 0);
    queue.published24h = Number(pub24Rows[0]?.n ?? 0);

    const valid = vault.filter((v) => v.is_valid);
    const invalid = vault.filter((v) => !v.is_valid);
    let alarm: DeskSnapshot["vault"]["alarm"] = vault.length ? "ok" : "none";
    let expiresAt: string | null = valid[0]?.expires_at ?? vault[0]?.expires_at ?? null;
    for (const v of valid) {
      const a = vaultAlarm(v.expires_at);
      if (a === "expired") {
        alarm = "expired";
        expiresAt = v.expires_at;
        break;
      }
      if (a === "soon") {
        alarm = "soon";
        expiresAt = v.expires_at;
      }
    }

    return {
      generatedAt,
      health,
      pages: {
        total: pages.length,
        live: pages.filter((p) => !p.is_practice && p.facebook_page_id).length,
        practice: pages.filter((p) => p.is_practice).length,
        readOnly: pages.filter((p) => p.is_read_only).length,
        selectedName: selected?.name ?? null,
        selectedPractice: Boolean(selected?.is_practice),
      },
      queue,
      inbox: { needsReply: inboxN },
      vault: {
        valid: valid.length,
        invalid: invalid.length,
        alarm,
        expiresAt,
      },
      quota: {
        callCountPct: quota?.call_count_pct ?? null,
        regainMinutes: quota?.estimated_regain_minutes ?? null,
        source: quota?.source_header ?? null,
        capturedAt: quota?.captured_at ?? null,
      },
      cadence: cadence
        ? {
            postedLast24h: cadence.postedLast24h,
            warnAt: cadence.warnAt,
            blockAt: cadence.blockAt,
            level: cadence.level,
            reelLast24h: cadence.reelLast24h,
            reelLevel: cadence.reelLevel,
          }
        : null,
      needs: needs.map((n) => ({
        title: n.title,
        kind: n.kind,
        urgency: n.urgency,
        pageName: n.pageName,
        detail: n.detail,
      })),
      failed: failedRows.map((f) => ({
        id: f.id,
        pageName: f.page_name,
        error: f.error_message || "Failed — retry from Drafts.",
        when: f.updated_at,
        message: (f.message ?? "").slice(0, 280),
      })),
      scheduler: schedRows.map((s) => ({
        status: s.status,
        error: s.error_message,
        path: s.request_path,
        code: s.graph_error_code,
        when: s.attempt_time,
      })),
      logs: logs.map((l) => ({
        level: l.level,
        scope: l.scope,
        message: l.message,
        createdAt: l.created_at,
      })),
      lastSync,
      facebookLastError,
      merchCount: Number(merchRows[0]?.n ?? 0),
      rssFeeds: Number(rssRows[0]?.n ?? 0),
      devices: Number(deviceRows[0]?.n ?? 0),
      overduePosts: overduePostRows.map((p) => ({
        id: p.id,
        pageName: p.page_name,
        message: (p.message ?? "").slice(0, 280),
        when: p.scheduled_publish_time,
      })),
      waitingComments: commentRows.map((c) => ({
        id: c.id,
        author: c.author_name || "Visitor",
        message: c.message.slice(0, 220),
        pageName: c.page_name,
        pageId: c.page_id,
        buyingIntent: isBuyingIntent(c.message),
      })),
      ideas: ideaRows.map((i) => ({
        id: i.id,
        title: i.title,
        body: (i.body ?? "").slice(0, 280),
        column: i.notes === "photo-needed" || i.notes === "caption-ready" || i.notes === "offer-this-week" ? i.notes : "inbox",
        pageName: i.page_name,
      })),
      snippets: snippetRows.map((s) => ({ label: s.label, body: (s.body ?? "").slice(0, 160) })),
      recentRuns: runRows.map((r) => {
        let persona: string | null = null;
        try {
          const parsed = r.drafts_json ? (JSON.parse(r.drafts_json) as { persona?: string }) : null;
          persona = typeof parsed?.persona === "string" ? parsed.persona : null;
        } catch {
          persona = null;
        }
        return { prompt: r.prompt.slice(0, 160), persona, when: r.created_at };
      }),
      week: await (async () => {
        try {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setDate(end.getDate() + 7);
          const rows = await sql<{
            scheduled_publish_time: string | null;
            published_time: string | null;
            created_at: string;
            status: string;
          }>`
            select scheduled_publish_time, published_time, created_at, status
            from posts
            where user_id = ${userId}
              and status not in ('Cancelled')
              and coalesce(scheduled_publish_time, published_time, created_at) >= ${start.toISOString()}
              and coalesce(scheduled_publish_time, published_time, created_at) < ${end.toISOString()}
          `.catch(() => []);
          return buildWeekStrip(rows, start).map((d) => ({
            label: d.label,
            weekday: d.weekday,
            scheduled: d.scheduled,
            published: d.published,
            isToday: d.isToday,
          }));
        } catch {
          return [];
        }
      })(),
      collisions: findCollisions(
        collisionSrc.map((r) => ({ pageId: r.page_id, pageName: r.page_name, message: r.message })),
      ).slice(0, 3),
      stills: Number(stillRows[0]?.n ?? 0),
      slots: parseSlots(selected?.posting_slots_json).slice(0, 6),
      voice: selected?.brand_voice ? selected.brand_voice.slice(0, 220) : null,
    };
  } catch (e) {
    try {
      const { deskLog } = await import("./log");
      await deskLog({
        level: "error",
        scope: "desk.snapshot",
        userId,
        message: e instanceof Error ? e.message : String(e),
      });
    } catch {
      /* logging must not throw */
    }
    return empty;
  }
}
