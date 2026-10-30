import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/commerce/fourthwall/checkout?connectionId=…&variantId=…
 *
 * The on-site buy link. Fourthwall is the Merchant of Record, so the payment page
 * itself is Fourthwall-hosted — this endpoint is the documented handoff:
 *   303 → https://{shop-domain}/cart/checkout?products={variantId}:1&utm_*=…
 *
 * It also records the click against the desk so Page/post attribution survives the
 * redirect (Fourthwall echoes fbclid/_fbp/_fbc/utm_* into checkout metadata).
 */
export const Route = createFileRoute("/api/commerce/fourthwall/checkout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const connectionId = (url.searchParams.get("connectionId") ?? "").trim();
        const variantId = (url.searchParams.get("variantId") ?? "").trim();
        if (!connectionId || !variantId) {
          return new Response("Missing connectionId or variantId.", {
            status: 400,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
        const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID.test(variantId)) {
          return new Response("variantId must be a Fourthwall variant UUID.", {
            status: 400,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }

        const [{ buildCheckoutUrl, FOURTHWALL_TRACKING_KEYS }, store] = await Promise.all([
          import("@/lib/commerce/fourthwall"),
          import("@/lib/commerce/store"),
        ]);

        const connection = await store.getConnectionPublic(connectionId);
        if (!connection) {
          return new Response("Unknown commerce connection (or no shop domain saved).", {
            status: 404,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }

        const tracking: Record<string, string> = {};
        for (const key of FOURTHWALL_TRACKING_KEYS) {
          const value = url.searchParams.get(key);
          if (value && value.trim()) tracking[key] = value.trim();
        }
        const productName = url.searchParams.get("productName");
        const pageId = url.searchParams.get("pageId");

        let target: string;
        try {
          target = buildCheckoutUrl({
            shopDomain: connection.shopDomain,
            items: [{ variantId, quantity: 1 }],
            tracking: tracking as Parameters<typeof buildCheckoutUrl>[0]["tracking"],
          });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Could not build the checkout link.", {
            status: 400,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }

        // Attribution is best-effort: a logging failure must not block the buyer.
        try {
          await store.recordCheckoutClick({
            userId: connection.userId,
            connectionId,
            variantId,
            productName,
            pageId,
            utm: tracking,
          });
        } catch {
          // swallow — the redirect below is the user-visible contract
        }

        return new Response(null, {
          status: 303,
          headers: {
            location: target,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer-when-downgrade",
          },
        });
      },
    },
  },
});
