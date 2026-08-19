import { getSql } from "@/lib/db";
import { facebookScheduleWindow } from "./graph";
import { attemptGraphPublish } from "./publish";
import { getPost, recordLog } from "./repo";

export async function rescheduleExisting(userId: string, postId: string, scheduledAt: string) {
  const post = await getPost(userId, postId);
  if (!post) throw new Error("Post not found");
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Pick a valid date and time.");

  const windowNote = facebookScheduleWindow(when);
  const sql = await getSql();
  await sql`
    update posts set scheduled_publish_time = ${scheduledAt}, status = 'LocalScheduled', updated_at = now()
    where id = ${postId} and user_id = ${userId}
  `;

  if (windowNote) {
    await recordLog({ userId, postId, status: "rescheduled_local", error: windowNote, path: "calendar" });
    return { status: "LocalScheduled" as const, warning: windowNote };
  }

  try {
    const result = await attemptGraphPublish(userId, postId, "schedule");
    return { status: result.status, warning: result.warning };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordLog({ userId, postId, status: "reschedule_graph_failed", error: msg, path: "calendar" });
    return { status: "LocalScheduled" as const, warning: `${msg} Saved on the local scheduler.` };
  }
}
