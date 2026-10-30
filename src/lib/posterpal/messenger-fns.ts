/**
 * Messenger server functions. HITL only: every send is a human click, and the
 * 24-hour window is enforced here, not just in the UI.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const messengerOverviewFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const m = await import("./messenger");
    const [threads, verifyToken] = await Promise.all([
      m.listThreads(context.userId),
      m.getMessengerVerifyToken(),
    ]);
    return {
      threads,
      verifyTokenConfigured: Boolean(verifyToken),
      rules: m.MESSENGER_RULES,
      windowHours: m.MESSENGER_WINDOW_HOURS,
    };
  });

export const messengerThreadFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { threadId: string }) => d)
  .handler(async ({ context, data }) => {
    const m = await import("./messenger");
    const threadId = data.threadId.trim();
    if (!threadId) throw new Error("threadId is required.");
    const [messages, threads] = await Promise.all([
      m.listMessages(context.userId, threadId),
      m.listThreads(context.userId),
    ]);
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) throw new Error("Messenger thread not found.");
    return {
      thread,
      messages,
      window: m.messagingWindow(thread.last_inbound_at),
    };
  });

export const saveMessengerVerifyTokenFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string }) => d)
  .handler(async ({ context, data }) => {
    const m = await import("./messenger");
    await m.saveMessengerVerifyToken(context.userId, data.token);
    return { ok: true };
  });

export const markMessengerHandledFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { threadId: string }) => d)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update messenger_threads set needs_reply = false
      where id = ${data.threadId.trim()} and user_id = ${context.userId}
    `;
    return { ok: true };
  });

/**
 * Send one human-authored reply.
 *
 * Refuses (with a specific reason) when:
 *   - the thread is a practice Page (no real Graph target),
 *   - the Page token or App Secret is missing,
 *   - the 24-hour standard messaging window has closed.
 * In the closed-window case there is no compliant fallback here — Message Tags are
 * for non-promotional use and this desk does not use them.
 */
export const sendMessengerReplyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { threadId: string; message: string }) => d)
  .handler(async ({ context, data }) => {
    const m = await import("./messenger");
    const text = m.validateReplyText(data.message);
    const ctx = await m.replyContext(context.userId, data.threadId.trim());
    const win = m.messagingWindow(ctx.thread.last_inbound_at);
    if (!win.open) {
      throw new Error(
        `The 24-hour messaging window is closed${win.hoursLeft !== null ? ` (${Math.abs(win.hoursLeft)}h ago)` : ""}. ` +
          "Messenger does not allow a normal reply now, and this desk never uses Message Tags for promotion. " +
          "Wait for the person to message the Page again.",
      );
    }
    if (!ctx.facebookPageId) {
      throw new Error("This thread belongs to a practice Page. Connect Facebook and use a live Page.");
    }
    if (!ctx.pageAccessToken) {
      throw new Error("This Page has no stored access token. Re-run Connect so PosterPal can decrypt a Page token.");
    }
    if (!ctx.appSecret) {
      throw new Error("Save the Facebook App Secret in Settings first — appsecret_proof is required.");
    }
    const sent = await m.sendMessengerMessage({
      pageId: ctx.facebookPageId,
      pageAccessToken: ctx.pageAccessToken,
      appSecret: ctx.appSecret,
      psid: ctx.thread.psid,
      text,
    });
    await m.recordOutbound({
      userId: context.userId,
      threadId: ctx.thread.id,
      mid: sent.messageId,
      body: text,
    });
    return { ok: true, messageId: sent.messageId };
  });
