import { createFileRoute } from "@tanstack/react-router";
import { bearerFrom, corsPreflight, jsonErr, jsonOk, resolveDeviceToken } from "@/lib/posterpal/devices";
import type { ComposerInput } from "@/lib/posterpal/types";

const MEDIA = ["Text", "Photo", "Carousel", "Video", "Reel", "Story"] as const;
const MODES = ["now", "schedule", "local-draft", "fb-draft"] as const;

function parseComposePayload(p: Record<string, unknown>): ComposerInput {
  const pageId = String(p.pageId ?? "").trim();
  const message = String(p.message ?? "").trim();
  const mediaType = String(p.mediaType ?? "Text");
  const mode = String(p.mode ?? "local-draft");
  if (!pageId) throw new Error("compose requires pageId.");
  if (!message) throw new Error("compose requires a caption.");
  if (!MEDIA.includes(mediaType as (typeof MEDIA)[number])) {
    throw new Error("compose requires a valid mediaType (Text, Photo, Carousel, Video, Reel, Story).");
  }
  if (!MODES.includes(mode as (typeof MODES)[number])) {
    throw new Error("compose requires a valid mode (now, schedule, local-draft, fb-draft).");
  }
  const recycle = p.recycleAfterDays == null ? null : Number(p.recycleAfterDays);
  return {
    pageId,
    message,
    mediaType: mediaType as ComposerInput["mediaType"],
    mode: mode as ComposerInput["mode"],
    link: p.link == null ? null : String(p.link),
    firstComment: p.firstComment == null ? null : String(p.firstComment),
    scheduledAt: p.scheduledAt == null ? null : String(p.scheduledAt),
    merchUrl: p.merchUrl == null ? null : String(p.merchUrl),
    recycleAfterDays: Number.isFinite(recycle) && recycle && recycle > 0 ? recycle : null,
  };
}

/**
 * Mobile sync action endpoint for paired devices (APK / PWA / remote desk).
 * Authenticated via device Bearer token (`Authorization: Bearer ppd_…`).
 * Supports: compose, reply, hide, handled.
 */
export const Route = createFileRoute("/api/sync/action")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      POST: async ({ request }) => {
        const token = bearerFrom(request);
        if (!token) return jsonErr("Missing Authorization: Bearer ppd_…", 401);
        const device = await resolveDeviceToken(token);
        if (!device) return jsonErr("Unknown or revoked device token.", 401);

        let body: {
          action: "compose" | "reply" | "hide" | "handled";
          payload: Record<string, unknown>;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonErr("Send JSON { action, payload }.");
        }

        const ops = await import("@/lib/posterpal/ops");
        const userId = device.userId;

        try {
          switch (body.action) {
            case "compose": {
              const input = parseComposePayload(body.payload ?? {});
              const res = await ops.compose(userId, input);
              return jsonOk({ ok: true, post: res });
            }
            case "reply": {
              const commentId = String(body.payload?.commentId ?? "");
              const message = String(body.payload?.message ?? "");
              if (!commentId || !message) return jsonErr("reply requires commentId and message.");
              const res = await ops.sendReply(userId, { commentId, message });
              return jsonOk({ ok: true, result: res });
            }
            case "hide": {
              const commentId = String(body.payload?.commentId ?? "");
              const hidden = Boolean(body.payload?.hidden ?? true);
              if (!commentId) return jsonErr("hide requires commentId.");
              const res = await ops.hideComment(userId, { commentId, hidden });
              return jsonOk({ ok: true, result: res });
            }
            case "handled": {
              const commentId = String(body.payload?.commentId ?? "");
              if (!commentId) return jsonErr("handled requires commentId.");
              const res = await ops.markCommentHandled(userId, commentId);
              return jsonOk({ ok: true, result: res });
            }
            default:
              return jsonErr("Unknown action. Use compose, reply, hide, or handled.", 400);
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : "Action failed";
          const { deskLog } = await import("@/lib/posterpal/log");
          await deskLog({ level: "error", scope: "sync.action", userId, message, extra: body.action });
          return jsonErr(message, 400);
        }
      },
    },
  },
});
