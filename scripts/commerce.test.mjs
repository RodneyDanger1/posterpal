import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  buildCheckoutUrl,
  fetchProductTemplates,
  normalizeOrder,
  normalizeProduct,
  parseFourthwallWebhook,
  verifyFourthwallSignature,
} from "../src/lib/commerce/fourthwall.ts";
import {
  appSecretProof,
  messagingWindow,
  parseMessengerWebhook,
  validateReplyText,
  verifyMetaSignature,
} from "../src/lib/posterpal/messenger.ts";

const VARIANT = "11111111-1111-1111-1111-111111111111";
const VARIANT_B = "22222222-2222-2222-2222-222222222222";

// ─── Fourthwall checkout links ────────────────────────────────────────────────

test("buildCheckoutUrl emits the documented products=variant:qty form", () => {
  const url = new URL(
    buildCheckoutUrl({ shopDomain: "shop.fourthwall.com", items: [{ variantId: VARIANT, quantity: 1 }] }),
  );
  assert.equal(url.origin, "https://shop.fourthwall.com");
  assert.equal(url.pathname, "/cart/checkout");
  assert.equal(url.searchParams.get("products"), `${VARIANT}:1`);
});

test("buildCheckoutUrl strips protocol/slash from the shop domain and joins items", () => {
  const url = new URL(
    buildCheckoutUrl({
      shopDomain: "https://my-shop.fourthwall.com/",
      items: [
        { variantId: VARIANT, quantity: 2 },
        { variantId: VARIANT_B, quantity: 3 },
      ],
    }),
  );
  assert.equal(url.host, "my-shop.fourthwall.com");
  assert.equal(url.searchParams.get("products"), `${VARIANT}:2,${VARIANT_B}:3`);
});

test("buildCheckoutUrl carries attribution (fbclid, utm_*, _fbp) and coupon", () => {
  const url = new URL(
    buildCheckoutUrl({
      shopDomain: "shop.fourthwall.com",
      items: [{ variantId: VARIANT }],
      coupon: "TRAIL10",
      currency: "usd",
      tracking: { fbclid: "abc123", utm_source: "facebook", utm_campaign: "trailhead", _fbp: "fb.1.1.1" },
    }),
  );
  assert.equal(url.searchParams.get("coupon"), "TRAIL10");
  assert.equal(url.searchParams.get("currency"), "USD");
  assert.equal(url.searchParams.get("fbclid"), "abc123");
  assert.equal(url.searchParams.get("utm_source"), "facebook");
  assert.equal(url.searchParams.get("_fbp"), "fb.1.1.1");
});

test("buildCheckoutUrl rejects a non-UUID variant and an empty cart", () => {
  assert.throws(
    () => buildCheckoutUrl({ shopDomain: "shop.fourthwall.com", items: [{ variantId: "not-a-uuid" }] }),
    /variant UUID/,
  );
  assert.throws(() => buildCheckoutUrl({ shopDomain: "shop.fourthwall.com", items: [] }), /at least one variant/);
});

test("buildCheckoutUrl clamps junk quantities to 1", () => {
  const url = new URL(
    buildCheckoutUrl({
      shopDomain: "shop.fourthwall.com",
      items: [{ variantId: VARIANT, quantity: Number.NaN }],
    }),
  );
  assert.equal(url.searchParams.get("products"), `${VARIANT}:1`);
});

// ─── Fourthwall webhook signatures ────────────────────────────────────────────

test("verifyFourthwallSignature accepts the documented base64 HMAC-SHA256", () => {
  const secret = "e3f93c7c-c92b-4b8f-a9b1-5b70e0891abc";
  const body = Buffer.from(JSON.stringify({ id: "weve_1", type: "ORDER_PLACED" }), "utf8");
  const header = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyFourthwallSignature(body, header, secret), true);
});

test("verifyFourthwallSignature rejects wrong secret, wrong body, empty header", () => {
  const body = Buffer.from('{"id":"weve_1"}', "utf8");
  const header = createHmac("sha256", "right-secret").update(body).digest("base64");
  assert.equal(verifyFourthwallSignature(body, header, "wrong-secret"), false);
  assert.equal(verifyFourthwallSignature(Buffer.from('{"id":"weve_2"}'), header, "right-secret"), false);
  assert.equal(verifyFourthwallSignature(body, null, "right-secret"), false);
  assert.equal(verifyFourthwallSignature(body, "", "right-secret"), false);
  assert.equal(verifyFourthwallSignature(body, header, ""), false);
});

test("parseFourthwallWebhook keeps envelope fields and refuses a body without id/type", () => {
  const parsed = parseFourthwallWebhook({
    id: "weve_geAva6c1RAuyb9HQxbSlmA",
    type: "ORDER_PLACED",
    shopId: "sh_1",
    testMode: true,
    data: { id: "order-1" },
  });
  assert.equal(parsed.id, "weve_geAva6c1RAuyb9HQxbSlmA");
  assert.equal(parsed.type, "ORDER_PLACED");
  assert.equal(parsed.testMode, true);
  assert.deepEqual(parsed.data, { id: "order-1" });
  assert.throws(() => parseFourthwallWebhook({ type: "ORDER_PLACED" }), /id or type/);
  assert.throws(() => parseFourthwallWebhook("nope"), /JSON object/);
});

// ─── Fourthwall normalisation ─────────────────────────────────────────────────

test("normalizeProduct maps Money, picks the cheapest variant, keeps the render image", () => {
  const p = normalizeProduct({
    id: "off_1",
    name: "Trailhead Tee",
    description: "desc",
    slug: "trailhead-tee",
    state: { type: "AVAILABLE" },
    access: { type: "PUBLIC" },
    images: [{ transformedUrl: "https://cdn/x.png", url: "https://cdn/x-orig.png" }],
    variants: [
      {
        id: VARIANT,
        name: "Black / M",
        sku: "SKU-1",
        unitPrice: { value: 24.99, currency: "USD" },
        attributes: { description: "Black, M", color: { name: "Black" }, size: { name: "M" } },
        stock: { type: "UNLIMITED" },
      },
      {
        id: VARIANT_B,
        name: "Black / L",
        unitPrice: { value: 27.5, currency: "USD" },
        attributes: { description: "Black, L" },
        stock: { type: "LIMITED", inStock: 0 },
      },
    ],
  });
  assert.equal(p.external_id, "off_1");
  assert.equal(p.state, "AVAILABLE");
  assert.equal(p.access, "PUBLIC");
  assert.equal(p.price_cents, 2499);
  assert.equal(p.currency, "USD");
  assert.equal(p.image_url, "https://cdn/x.png");
  assert.equal(p.variants.length, 2);
  assert.equal(p.variants[1].in_stock, false);
});

test("normalizeOrder flattens offers into line items with cents", () => {
  const o = normalizeOrder({
    id: "ord_1",
    friendlyId: "D3XZFWPP",
    status: "CONFIRMED",
    email: "buyer@example.com",
    amounts: { total: { value: 49.98, currency: "USD" } },
    offers: [
      {
        id: "off_1",
        name: "Tee",
        variant: { id: VARIANT, name: "Black / M", quantity: 2, unitPrice: { value: 24.99, currency: "USD" } },
      },
    ],
    trackingParams: { utm_source: "facebook", fbclid: "x" },
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  assert.equal(o.total_cents, 4998);
  assert.equal(o.friendly_id, "D3XZFWPP");
  assert.equal(o.items.length, 1);
  assert.equal(o.items[0].quantity, 2);
  assert.equal(o.items[0].unit_price_cents, 2499);
  assert.equal(o.tracking.utm_source, "facebook");
});

// ─── Messenger ────────────────────────────────────────────────────────────────

test("verifyMetaSignature accepts sha256=<hex> and rejects tampering", () => {
  const secret = "app-secret";
  const body = Buffer.from(JSON.stringify({ entry: [] }), "utf8");
  const good = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(verifyMetaSignature(body, good, secret), true);
  assert.equal(verifyMetaSignature(Buffer.from('{"entry":[1]}'), good, secret), false);
  assert.equal(verifyMetaSignature(body, good.replace("sha256=", "sha1="), secret), false);
  assert.equal(verifyMetaSignature(body, good, "other"), false);
});

test("parseMessengerWebhook flattens inbound messages and echoes with the right PSID", () => {
  const events = parseMessengerWebhook({
    object: "page",
    entry: [
      {
        id: "PAGE_ID",
        time: 1,
        messaging: [
          {
            sender: { id: "PSID_USER" },
            recipient: { id: "PAGE_ID" },
            timestamp: 1700000000000,
            message: { mid: "m_1", text: "Do you ship to Canada?" },
          },
          {
            sender: { id: "PAGE_ID" },
            recipient: { id: "PSID_USER" },
            timestamp: 1700000001000,
            message: { mid: "m_2", text: "Yes — 6 days.", is_echo: true },
          },
        ],
      },
    ],
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, "message");
  assert.equal(events[0].psid, "PSID_USER");
  assert.equal(events[0].text, "Do you ship to Canada?");
  assert.equal(events[0].isEcho, false);
  // Echo: the Page is the sender, so the thread's PSID is the recipient.
  assert.equal(events[1].psid, "PSID_USER");
  assert.equal(events[1].isEcho, true);
});

test("parseMessengerWebhook survives junk without throwing", () => {
  assert.deepEqual(parseMessengerWebhook(null), []);
  assert.deepEqual(parseMessengerWebhook({ entry: "nope" }), []);
  const noIds = parseMessengerWebhook({ entry: [{ messaging: [{ message: { mid: "m" } }] }] });
  assert.deepEqual(noIds, []);
});

test("messagingWindow is strictly 24 hours from the last inbound message", () => {
  const now = Date.parse("2026-10-29T12:00:00.000Z");
  const open = messagingWindow("2026-10-29T06:00:00.000Z", now);
  assert.equal(open.open, true);
  assert.equal(open.hoursLeft, 18);
  const closed = messagingWindow("2026-10-27T06:00:00.000Z", now);
  assert.equal(closed.open, false);
  assert.equal(messagingWindow(null, now).open, false);
});

test("validateReplyText enforces non-empty and the 2000-char limit", () => {
  assert.equal(validateReplyText("  hi there  "), "hi there");
  assert.throws(() => validateReplyText("   "), /Write a reply/);
  assert.throws(() => validateReplyText("x".repeat(2001)), /2000/);
});

test("appSecretProof is the hex HMAC Graph expects", () => {
  const proof = appSecretProof("secret", "EAAtoken");
  assert.equal(proof, createHmac("sha256", "secret").update("EAAtoken").digest("hex"));
});

// ─── Public template catalogue ───────────────────────────────────────────────

test("fetchProductTemplates normalises the public template page", async (t) => {
  const realFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  let calledUrl = "";
  globalThis.fetch = (async (input) => {
    calledUrl = String(input);
    return new Response(
      JSON.stringify({
        results: [
          {
            productId: "pro_1",
            name: "Classic T-Shirt",
            category: "apparel/t-shirts",
            brand: "Bella+Canvas",
            thumbnail: "https://cdn/thumb.png",
            basePrice: { amount: 24.99, currency: "USD" },
            productionMethod: "DTG",
            supportsBackendRendering: true,
          },
        ],
        total: 1,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  const res = await fetchProductTemplates(2);
  assert.match(calledUrl, /\/product-templates\/page\/2$/);
  assert.equal(res.total, 1);
  assert.equal(res.results[0].base_price_cents, 2499);
  assert.equal(res.results[0].production_method, "DTG");
  assert.equal(res.results[0].supports_backend_rendering, true);
});
