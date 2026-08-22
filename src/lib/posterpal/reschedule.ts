import { reschedule } from "./ops";

/** Calendar drag-drop and Composer reschedule share the Graph-aware path in ops. */
export async function rescheduleExisting(userId: string, postId: string, scheduledAt: string) {
  return reschedule(userId, { postId, scheduledAt });
}
