import { createFileRoute } from "@tanstack/react-router";

/**
 * Fourthwall webhook endpoint.
 *
 * POST /api/commerce/fourthwall/webhook
 *   Header: X-Fourthwall-Hmac-SHA256 = base64(HMAC-SHA256(secret, raw body))
 *
 * The raw bytes are hashed BEFORE parsing — re-serializing the JSON would break
 * the signature. Deliveries are idempotent on the event id: Fourthwall retries up
 * to 5 times, and a retried ORDER_PLACED must never be processed twice.
 *
 * Responds 200 within the 2s budget Fourthwall documents. Verification failure is
 * a 401 with no detail (never echo the expected signature).
 */
export const Route = createFileRoute("/api/commerce/fourthwall/webhook")({
  server: {
    handlers: {
      GET: () =>
        new Response("Fourthwall webhooks are POST-only. Configure this URL in Settings > For developers > Webhooks.", {
          status: 405,
          headers: { allow: "POST", "content-type": "text/plain; charset=utf-8" },
        }),
      POST: async ({ request }) => {
        const header =
          request.headers.get("x-fourthwall-hmac-sha256") ??
          request.headers.get("x-fourthwall-hmac-apps-sha256");
        if (!header) {
          return Response.json({ error: "missing signature" }, { status: 401 });
        }
        let raw: Buffer;
        try {
          raw = Buffer.from(await request.arrayBuffer());
        } catch {
          return Response.json({ error: "unreadable body" }, { status: 400 });
        }
        if (raw.byteLength === 0) return Response.json({ error: "empty body" }, { status: 400 });
        if (raw.byteLength > 1024 * 1024) {
          return Response.json({ error: "body too large" }, { status: 413 });
        }

        const [{ verifyFourthwallSignature, parseFourthwallWebhook }, store] = await Promise.all([
          import("@/lib/commerce/fourthwall"),
          import("@/lib/commerce/store"),
        ]);

        let matched: { connectionId: string; userId: string; secret: string } | null = null;
        try {
          const candidates = await store.webhookCandidates();
          matched = candidates.find((c) => verifyFourthwallSignature(raw, header, c.secret)) ?? null;
        } catch {
          // DB unavailable — the signature cannot be checked, so refuse the delivery.
          return Response.json({ error: "verification unavailable" }, { status: 503 });
        }
        if (!matched) {
          return Response.json({ error: "invalid signature" }, { status: 401 });
        }

        let event: ReturnType<typeof parseFourthwallWebhook>;
        try {
          event = parseFourthwallWebhook(JSON.parse(raw.toString("utf8")));
        } catch {
          return Response.json({ error: "bad payload" }, { status: 400 });
        }

        try {
          const { duplicate } = await store.recordWebhookEvent({
            userId: matched.userId,
            provider: "fourthwall",
            eventId: event.id,
            type: event.type,
            payload: { type: event.type, shopId: event.shopId, testMode: event.testMode, data: event.data },
          });
          if (!duplicate) await store.markWebhookProcessed("fourthwall", event.id);
          return Response.json({ received: true, duplicate });
        } catch {
          // Ask for a retry rather than acknowledging an event we failed to persist.
          return Response.json({ error: "storage failure" }, { status: 500 });
        }
      },
    },
  },
});
