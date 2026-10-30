import { createFileRoute } from "@tanstack/react-router";

/**
 * Facebook Messenger webhook.
 *
 * GET  — subscription handshake: hub.mode=subscribe & hub.verify_token must equal
 *        the operator's saved verify token; replies with the challenge.
 * POST — event delivery: the raw bytes are authenticated with
 *        X-Hub-Signature-256 (HMAC-SHA256 of the body, keyed with the App Secret)
 *        BEFORE anything is stored. Echoes are recorded as outbound so the desk
 *        never looks like it is talking to itself.
 *
 * Always returns 200 for an authentic delivery: Meta retries non-200 responses,
 * and re-delivery is idempotent on the message id anyway.
 */
export const Route = createFileRoute("/api/facebook/messenger")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token") ?? "";
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const { getMessengerVerifyToken } = await import("@/lib/posterpal/messenger");
        const expected = await getMessengerVerifyToken();
        if (!expected) {
          return new Response(
            "No Messenger verify token is configured on this desk yet. Open Messenger in PosterPal and save one.",
            { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } },
          );
        }
        if (mode !== "subscribe" || token !== expected) {
          return new Response("Forbidden", {
            status: 403,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
        return new Response(challenge, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
      POST: async ({ request }) => {
        const header = request.headers.get("x-hub-signature-256");
        if (!header) return Response.json({ error: "missing signature" }, { status: 401 });
        let raw: Buffer;
        try {
          raw = Buffer.from(await request.arrayBuffer());
        } catch {
          return Response.json({ error: "unreadable body" }, { status: 400 });
        }
        if (raw.byteLength === 0) return Response.json({ error: "empty body" }, { status: 400 });
        if (raw.byteLength > 2 * 1024 * 1024) {
          return Response.json({ error: "body too large" }, { status: 413 });
        }

        const m = await import("@/lib/posterpal/messenger");
        let secrets: Array<{ userId: string; secret: string }> = [];
        try {
          secrets = await m.listAppSecrets();
        } catch {
          return Response.json({ error: "verification unavailable" }, { status: 503 });
        }
        const authentic = secrets.some((s) => m.verifyMetaSignature(raw, header, s.secret));
        if (!authentic) return Response.json({ error: "invalid signature" }, { status: 401 });

        let payload: unknown;
        try {
          payload = JSON.parse(raw.toString("utf8"));
        } catch {
          return Response.json({ error: "bad payload" }, { status: 400 });
        }

        const events = m.parseMessengerWebhook(payload);
        for (const ev of events) {
          if (ev.kind !== "message" && ev.kind !== "postback") continue;
          try {
            const page = await m.pageForFacebookId(ev.pageId);
            if (!page) continue; // a Page this desk does not manage — ignore, do not retry
            await m.recordInbound({
              userId: page.userId,
              pageDbId: page.id,
              psid: ev.psid,
              mid: ev.mid,
              text: ev.text,
              attachments: ev.attachments,
              sentAt: ev.timestamp ? new Date(ev.timestamp) : new Date(),
              isEcho: ev.isEcho,
            });
          } catch (e) {
            // One bad event must not lose the whole batch; log and continue.
            console.error("[messenger] failed to store event", ev.mid, e instanceof Error ? e.message : e);
          }
        }
        return Response.json({ received: true });
      },
    },
  },
});
