import { getSql } from "@/lib/db";

export async function markCommentHandled(userId: string, commentId: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from comments where id = ${commentId} and user_id = ${userId}
  `;
  if (!rows[0]) throw new Error("Comment not found");
  await sql`update comments set needs_reply = false where id = ${commentId} and user_id = ${userId}`;
  return { ok: true as const };
}
