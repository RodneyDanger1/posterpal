import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import type { IdeaRow, SnippetRow } from "./types";

export async function listIdeas(userId: string, pageId?: string): Promise<IdeaRow[]> {
  const { ensureMemory } = await import("./seed");
  await ensureMemory(userId);
  const sql = await getSql();
  const rows = pageId
    ? await sql<IdeaRow>`
        select i.id, i.page_id, i.title, i.body, i.media_type, i.notes, i.created_at, p.name as page_name
        from saved_ideas i
        left join pages p on p.id = i.page_id
        where i.user_id = ${userId} and (i.page_id = ${pageId} or i.page_id is null)
        order by i.created_at desc
        limit 80
      `
    : await sql<IdeaRow>`
        select i.id, i.page_id, i.title, i.body, i.media_type, i.notes, i.created_at, p.name as page_name
        from saved_ideas i
        left join pages p on p.id = i.page_id
        where i.user_id = ${userId}
        order by i.created_at desc
        limit 80
      `;
  return rows;
}

export async function saveIdea(
  userId: string,
  data: { pageId?: string | null; title?: string; body: string; mediaType?: string; notes?: string | null },
) {
  const body = data.body.trim();
  if (!body) throw new Error("Write something before saving it for later.");
  const title = (data.title?.trim() || body.split("\n")[0] || "Idea").slice(0, 80);
  const sql = await getSql();
  const id = randomUUID();
  await sql`
    insert into saved_ideas (id, user_id, page_id, title, body, media_type, notes)
    values (
      ${id}, ${userId}, ${data.pageId ?? null}, ${title}, ${body},
      ${data.mediaType ?? "Text"}, ${data.notes ?? null}
    )
  `;
  return { id };
}

export async function deleteIdea(userId: string, id: string) {
  const sql = await getSql();
  await sql`delete from saved_ideas where id = ${id} and user_id = ${userId}`;
  return { ok: true as const };
}

export async function updateIdea(
  userId: string,
  data: { id: string; notes?: string | null },
) {
  const sql = await getSql();
  await sql`
    update saved_ideas set notes = ${data.notes ?? null}
    where id = ${data.id} and user_id = ${userId}
  `;
  return { ok: true as const };
}

export async function listSnippets(userId: string, pageId?: string): Promise<SnippetRow[]> {
  // Do not re-seed when the operator deleted every snippet — ensureMemory already
  // stamps memory_seeded_once on first desk boot.
  const sql = await getSql();
  const rows = pageId
    ? await sql<SnippetRow>`
        select id, page_id, label, body, created_at
        from caption_snippets
        where user_id = ${userId} and (page_id = ${pageId} or page_id is null)
        order by created_at desc
        limit 40
      `
    : await sql<SnippetRow>`
        select id, page_id, label, body, created_at
        from caption_snippets
        where user_id = ${userId}
        order by created_at desc
        limit 40
      `;
  return rows;
}

export async function saveSnippet(userId: string, data: { pageId?: string | null; label: string; body: string }) {
  const body = data.body.trim();
  const label = data.label.trim() || body.slice(0, 40) || "Snippet";
  if (!body) throw new Error("Snippet is empty.");
  const sql = await getSql();
  const id = randomUUID();
  await sql`
    insert into caption_snippets (id, user_id, page_id, label, body)
    values (${id}, ${userId}, ${data.pageId ?? null}, ${label.slice(0, 60)}, ${body})
  `;
  return { id };
}

export async function deleteSnippet(userId: string, id: string) {
  const sql = await getSql();
  await sql`delete from caption_snippets where id = ${id} and user_id = ${userId}`;
  return { ok: true as const };
}
