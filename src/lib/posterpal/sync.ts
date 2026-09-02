import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { localSentiment } from "./ai";
import { decryptSecret } from "./crypto";
import { GraphRequestError, graphFetch } from "./graph";
import { getPageToken, getSetting, listPages, recordLog, recordQuota } from "./repo";
import type { PageRow, SyncResult } from "./types";

type GraphFrom = { id?: string; name?: string };
type GraphComment = {
  id?: string;
  message?: string;
  created_time?: string;
  is_hidden?: boolean;
  from?: GraphFrom;
};
type GraphPost = {
  id?: string;
  message?: string;
  created_time?: string;
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number }; data?: GraphComment[] };
  attachments?: { data?: Array<{ type?: string; media_type?: string }> };
};

export async function syncFromGraph(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    pagesUpdated: 0,
    postsUpdated: 0,
    commentsImported: 0,
    errors: [],
  };
  const appSecret = await getSetting(userId, "facebook_app_secret");
  if (!appSecret) {
    result.errors.push("Save your Facebook App Secret in Settings, then connect Facebook.");
    return result;
  }

  try {
    const n = await refreshPagesFromVault(userId, appSecret);
    result.pagesUpdated += n;
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
    if (e instanceof GraphRequestError && e.mapped.kind === "token") {
      const sql = await getSql();
      await sql`update token_vault set is_valid = false where user_id = ${userId}`;
    }
  }

  const pages = await listPages(userId);
  for (const page of pages) {
    if (page.is_practice || !page.facebook_page_id) continue;
    const token = await getPageToken(userId, page.id);
    if (!token) {
      result.errors.push(`${page.name}: no Page token — reconnect Facebook.`);
      continue;
    }
    try {
      await syncOnePage(userId, page, token, appSecret, result);
    } catch (e) {
      if (e instanceof GraphRequestError && e.quota) {
        await recordQuota(userId, page.id, e.quota);
      }
      result.errors.push(`${page.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await recordLog({
    userId,
    status: "graph_sync",
    error: result.errors.length ? result.errors.join(" | ") : null,
    path: "sync",
  });
  return result;
}

async function refreshPagesFromVault(userId: string, appSecret: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ long_lived_token_enc: string | null }>`
    select long_lived_token_enc from token_vault
    where user_id = ${userId} and is_valid = true
    order by created_at desc limit 1
  `;
  const token = decryptSecret(rows[0]?.long_lived_token_enc);
  if (!token) return 0;
  const { importFacebookAccounts } = await import("./facebook-oauth");
  return importFacebookAccounts(userId, token, appSecret);
}

async function syncOnePage(
  userId: string,
  page: PageRow,
  token: string,
  appSecret: string,
  result: SyncResult,
) {
  const fbPageId = page.facebook_page_id!;
  const meta = await graphFetch<{
    name?: string;
    fan_count?: number;
    category?: string;
    picture?: { data?: { url?: string; is_silhouette?: boolean } };
  }>({
    path: `/${fbPageId}`,
    token,
    appSecret,
    query: { fields: "name,fan_count,category,picture{url,is_silhouette}" },
  });
  const sql = await getSql();
  const pictureUrl =
    meta.data.picture?.data?.url && !meta.data.picture.data.is_silhouette
      ? meta.data.picture.data.url
      : null;
  await sql`
    update pages set
      name = coalesce(${meta.data.name ?? null}, name),
      fan_count = coalesce(${meta.data.fan_count ?? null}, fan_count),
      category = coalesce(${meta.data.category ?? null}, category),
      picture_url = coalesce(${pictureUrl}, picture_url),
      updated_at = now()
    where id = ${page.id} and user_id = ${userId}
  `;
  result.pagesUpdated += 1;

  const posts = await graphFetch<{ data?: GraphPost[] }>({
    path: `/${fbPageId}/published_posts`,
    token,
    appSecret,
    query: {
      fields:
        "id,message,created_time,shares,reactions.summary(total_count).limit(0),comments.limit(25).summary(total_count){id,from,message,created_time,is_hidden}",
      limit: 40,
    },
  });

  for (const gp of posts.data.data ?? []) {
    if (!gp.id) continue;
    const reactions = Number(gp.reactions?.summary?.total_count ?? 0);
    const comments = Number(gp.comments?.summary?.total_count ?? 0);
    const shares = Number(gp.shares?.count ?? 0);
    const score = reactions + comments * 2 + shares * 3;
    const altId = gp.id.includes("_") ? gp.id.split("_").pop() ?? null : null;
    const existing = await sql<{
      id: string;
      status: string;
      first_comment: string | null;
      created_by_this_app: boolean | string | number;
    }>`
      select id, status, first_comment, created_by_this_app from posts
      where user_id = ${userId}
        and (facebook_post_id = ${gp.id} or (${altId}::text is not null and facebook_post_id = ${altId}))
      limit 1
    `;
    let postId = existing[0]?.id;
    const wasScheduled =
      existing[0]?.status === "FacebookScheduled" || existing[0]?.status === "LocalScheduled";
    if (postId) {
      await sql`
        update posts set
          message = coalesce(${gp.message ?? null}, message),
          reactions_count = ${reactions},
          comments_count = ${comments},
          shares_count = ${shares},
          engagement_score = ${score},
          last_insights_at = now(),
          published_time = coalesce(published_time, ${gp.created_time ?? null}),
          status = case when status in ('LocalDraft','Failed','Publishing','FacebookScheduled','LocalScheduled') then 'Published' else status end,
          updated_at = now()
        where id = ${postId} and user_id = ${userId}
      `;
    } else {
      postId = randomUUID();
      await sql`
        insert into posts (
          id, user_id, page_id, facebook_post_id, message, media_type, status,
          published_time, created_by_this_app, reactions_count, comments_count, shares_count,
          engagement_score, last_insights_at
        ) values (
          ${postId}, ${userId}, ${page.id}, ${gp.id}, ${gp.message ?? null}, ${"Text"}, ${"Published"},
          ${gp.created_time ?? new Date().toISOString()}, false,
          ${reactions}, ${comments}, ${shares}, ${score}, now()
        )
      `;
    }
    result.postsUpdated += 1;

    const pendingComment = existing[0]?.first_comment?.trim();
    const fromThisApp =
      existing[0]?.created_by_this_app === true ||
      existing[0]?.created_by_this_app === "t" ||
      existing[0]?.created_by_this_app === 1 ||
      existing[0]?.created_by_this_app === "1";
    if (wasScheduled && fromThisApp && pendingComment && gp.id) {
      try {
        await graphFetch({
          path: `/${gp.id}/comments`,
          method: "POST",
          token,
          appSecret,
          form: { message: pendingComment },
        });
        await recordLog({ userId, postId, status: "first_comment_posted", path: `/${gp.id}/comments` });
      } catch (e) {
        await recordLog({
          userId,
          postId,
          status: "first_comment_failed",
          error: e instanceof Error ? e.message : String(e),
          path: "first_comment",
        });
      }
    }

    for (const c of gp.comments?.data ?? []) {
      const n = await upsertComment(userId, postId, fbPageId, c);
      result.commentsImported += n;
    }
  }

  const ourPosts = await sql<{ id: string; facebook_post_id: string }>`
    select id, facebook_post_id from posts
    where user_id = ${userId} and page_id = ${page.id}
      and facebook_post_id is not null
      and facebook_post_id not like 'practice_%'
    order by coalesce(published_time, created_at) desc
    limit 30
  `;
  for (const row of ourPosts) {
    try {
      const pack = await graphFetch<{
        id?: string;
        shares?: { count?: number };
        reactions?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number }; data?: GraphComment[] };
        insights?: { data?: Array<{ name?: string; values?: Array<{ value?: number }> }> };
      }>({
        path: `/${row.facebook_post_id}`,
        token,
        appSecret,
        query: {
          fields:
            "id,shares,reactions.summary(total_count).limit(0),comments.limit(50).summary(total_count){id,from,message,created_time,is_hidden},insights.metric(post_media_view,post_total_media_view)",
        },
      });
      const reactions = Number(pack.data.reactions?.summary?.total_count ?? 0);
      const comments = Number(pack.data.comments?.summary?.total_count ?? 0);
      const shares = Number(pack.data.shares?.count ?? 0);
      const insightRows = pack.data.insights?.data ?? [];
      const views =
        Number(insightRows.find((r) => r.name === "post_total_media_view")?.values?.[0]?.value ?? 0) ||
        Number(insightRows.find((r) => r.name === "post_media_view")?.values?.[0]?.value ?? 0) ||
        Number(insightRows[0]?.values?.[0]?.value ?? 0) ||
        null;
      await sql`
        update posts set
          reactions_count = ${reactions},
          comments_count = ${comments},
          shares_count = ${shares},
          media_view_unique = coalesce(${views}, media_view_unique),
          engagement_score = ${reactions + comments * 2 + shares * 3},
          last_insights_at = now(),
          updated_at = now()
        where id = ${row.id} and user_id = ${userId}
      `;
      result.postsUpdated += 1;
      for (const c of pack.data.comments?.data ?? []) {
        const n = await upsertComment(userId, row.id, fbPageId, c);
        result.commentsImported += n;
      }
    } catch (e) {
      if (e instanceof GraphRequestError && e.mapped.kind === "token") throw e;
      continue;
    }
  }
}

async function upsertComment(
  userId: string,
  postId: string,
  fbPageId: string,
  c: GraphComment,
): Promise<number> {
  if (!c.id) return 0;
  const sql = await getSql();
  const fromPage = c.from?.id === fbPageId;
  const existing = await sql<{ id: string }>`
    select id from comments where user_id = ${userId} and facebook_comment_id = ${c.id} limit 1
  `;
  const message = c.message ?? "";
  const hidden = Boolean(c.is_hidden);
  if (existing[0]) {
    await sql`
      update comments set
        message = ${message},
        is_hidden = ${hidden},
        author_name = coalesce(${c.from?.name ?? null}, author_name),
        author_id = coalesce(${c.from?.id ?? null}, author_id)
      where id = ${existing[0].id}
    `;
    return 0;
  }
  await sql`
    insert into comments (
      id, user_id, facebook_comment_id, post_id, message, author_name, author_id,
      sentiment, needs_reply, is_hidden, is_from_page, created_at
    ) values (
      ${randomUUID()}, ${userId}, ${c.id}, ${postId}, ${message},
      ${c.from?.name ?? null}, ${c.from?.id ?? null},
      ${localSentiment(message)}, ${!fromPage && !hidden}, ${hidden}, ${fromPage},
      ${c.created_time ?? new Date().toISOString()}
    )
  `;
  return 1;
}
