# Fourthwall + Facebook Shops — what is actually possible

**Sources (official, retrieved 2026-10-29):**
[Platform Open API](https://help.fourthwall.com/manage-my-shop/apps-features-and-integrations/platform-open-api) ·
[Storefront API](https://help.fourthwall.com/manage-my-shop/apps-features-and-integrations/storefront-api-for-custom-storefronts) ·
[Integration options](https://help.fourthwall.com/manage-my-shop/apps-features-and-integrations/integration-options-for-fourthwall-with-other-platforms) ·
[Cart checkout endpoint](https://docs.fourthwall.com/shop-apis/cart-checkout-endpoint) ·
[Create design products](https://docs.fourthwall.com/guides/create-design-products) ·
[Webhooks](https://help.fourthwall.com/manage-my-shop/apps-features-and-integrations/webhooks-for-memberships-and-orders) ·
[Design file guidelines](https://help.fourthwall.com/create-and-sell-products/best-practices/design-file-guidelines-and-templates-for-merchandise/) ·
[IG/FB Shopping setup](https://help.fourthwall.com/manage-my-shop/apps-features-and-integrations/set-up-instagram-and-facebook-shopping)

---

## 1. The one constraint that decides everything

Fourthwall is the **Merchant of Record (MoR)**. Their docs say it four different ways:

> "Checkout is handled by Fourthwall. You redirect customers to the Fourthwall checkout page
> using a cart token. **You cannot build a custom checkout flow.**" — Storefront API

> "Full functionality (such as navigation, cart, and checkout) won't carry over into the embed.
> **Customers will eventually be redirected to your Fourthwall storefront to complete checkout.**" — Integration options

> "Customers browse products on your custom site and are **redirected to Fourthwall to complete
> payment**, so you keep all the benefits of Fourthwall as your Merchant of Record." — Headless commerce

**Therefore:** with Fourthwall you can own the storefront, product pages, cart, and buy button —
you **cannot** own the payment page. The payment step is theirs. That is the price of
zero upfront cost, no inventory, and them handling tax/fraud/refunds.

The only way to keep payment 100% on your domain is to **be your own MoR**: Stripe on your site,
then pay a supplier per order (Printify/Printful bill your account/balance). You'd carry cash-flow
float, chargebacks, sales tax, and refunds. You already told me you don't want that — so the plan
below is Fourthwall-first.

## 2. The three Fourthwall surfaces (all real, all usable)

### A. Platform Open API — your back office
- Base `https://api.fourthwall.com/open-api/v1.0/`
- Auth: **HTTP Basic** (Open API username+password from Settings → For developers). Not Bearer.
- Scopes: `offer_read/write`, `media_read/write`, `order_read`, `webhook_read/write`…
- Endpoints used by PosterPal: `GET /shops/current`, `GET /products`, `GET /order`,
  `GET /product-templates/page/{page}`, `POST /media/upload-url`, `POST /media/images`,
  `POST /products`.
- Rate limits: 100 req / 10 s generally; **5 req/min** for `POST /products`; 20/min media uploads.

### B. Storefront API — headless browsing
- `https://storefront-api.fourthwall.com/v1/` with `storefront_token` query param.
- `GET /collections/all/products?page=&size=` returns `{results, paging}`.
- **Read + cart only.** Checkout redirect is the end of the road (see §1).
- PosterPal does **not** ship a Storefront cart UI yet — deliberately, because your website is out
  of scope for this pass. The API is documented here for when you build the storefront.

### C. Cart checkout endpoint — the buy button
```
https://{shop-domain}/cart/checkout
  ?products={variantUUID}:{qty}[,{variantUUID}:{qty}]
  &coupon=CODE&currency=USD
  &utm_source=…&utm_medium=…&utm_campaign=…&fbclid=…&_fbp=…&_fbc=…
```
- Responds `303 → /checkout/{checkoutId}`.
- Captures and propagates marketing params into checkout metadata — **this is how Meta attribution
  survives the handoff**.
- PosterPal wraps it: `/api/commerce/fourthwall/checkout?connectionId=…&variantId=…` logs the click
  (Page + UTM), then 303s to the Fourthwall URL. Paste that link anywhere.

## 3. Creating products from AI images (5-step pipeline, implemented)

```
1. GET  /product-templates/page/1            → productTemplateId (+ productionMethod, basePrice)
2. POST /media/upload-url  {fileName, contentType, size}
   → { uploadUrl (GCS, ~6h), fileUrl }
3. PUT  {uploadUrl}  raw bytes
   headers: Content-Type: <same as step 2>
            x-goog-content-length-range: 0,<same size>   ← required, baked into signature
4. POST /media/images  {fileUrl, width, height} → { id: imageId }
5. POST /products { type:"design", productTemplateId, name, description,
                    regions:[{region:"front", imageId, placementStrategy:"AUTO"}],
                    colors?, sizes?, profitMargin?, publishOnCreate:false }
   → { productId, customizationId, images[] }
```

Products are **hidden** unless `publishOnCreate: true` — good default: review mockups first.
`supportsBackendRendering: false` templates (e.g. knitwear) **cannot** use this pipeline; knitwear
needs a production-ready BMP template. PosterPal refuses those with an explicit message instead of
guessing.

## 4. Facebook Shops, finally explained

A **Shop** is not a website. It is a storefront tab on your Facebook Page / Instagram profile,
powered by **Commerce Manager**:

- **Catalog** = the product list (images, titles, prices, links, availability).
- **Shop** = the container that attaches catalog + sales channel (Page/IG) + shipping profile +
  checkout URL.
- Meta does **not** hold inventory and (in the checkout-URL model Fourthwall uses) does **not**
  process the payment. It displays products and sends the buyer to the checkout URL.

**Fourthwall's supported flow** (their official guide):
1. Commerce Manager → create a **Business account** → **Create shop** → sales channel = your Page.
2. Create/select a **catalog**.
3. Business details: support email (Meta sends a code; Fourthwall forwards it to your super-admin
   email within 5–10 min), return window (leave default), policy URLs.
4. Submit for review.
5. Fourthwall dashboard → **Apps → Instagram & Facebook Shop → Connect** → pick portfolio →
   pick catalog → Save → back in Fourthwall pick the catalog → **Confirm**.
6. **Configure Meta checkout URL** → Fourthwall shows *their* checkout URL → Meta Commerce Manager
   → Start building URL → paste it → "I've built a checkout URL" → Next → preview checkout with 2
   live products → confirm → Submit.
7. Shipping profile: name, country, locations, 3–5 day standard shipping → save.
8. Optimize catalog: **Skip** "add product variants" (Fourthwall syncs its own). Optimize shop →
   show offers → Confirm.
9. **Publish shop.**

Net effect: your Page/IG profile gets a Shop tab; clicks land on Fourthwall checkout (the URL you
pasted). You are not building a second storefront and you are not taking payments yourself.

**Eligibility:** country must support FB/IG shopping; account must meet Commerce Eligibility
Requirements. Personal profiles cannot sell — it must be a Page/IG business account tied to a
Business portfolio.

## 5. Decision matrix

| Goal | Possible with Fourthwall? | How |
|---|---|---|
| Product pages on my own domain | ✅ | Storefront API or PosterPal product data |
| Cart on my domain | ✅ | Storefront API carts |
| **Payment on my domain** | ❌ | Would require being MoR (Stripe + supplier billing) |
| Zero upfront cost to me | ✅ | Fourthwall MoR |
| Money to my bank account | ✅ | Fourthwall payouts |
| Create products from AI stills programmatically | ✅ | 5-step design pipeline (built) |
| Read orders / fulfillment status | ✅ | `GET /order` + webhooks |
| Facebook/Instagram Shop tab | ✅ | Fourthwall's native Meta app (§4) |
| Custom checkout design | ❌ | Not offered |
| Vector/SVG artwork upload | ❌ | Raster JPG/PNG only |

## 6. Webhooks (implemented)

- Header `X-Fourthwall-Hmac-SHA256` = base64(HMAC-SHA256(webhook secret, raw body)).
  Platform apps use `X-Fourthwall-Hmac-Apps-SHA256`.
- Respond **200 within 2 s**; Fourthwall retries up to 5 times, 5 s timeout each.
- Idempotency on the event `id` — PosterPal stores `unique(provider, event_id)` and ignores repeats.
- Events: `ORDER_PLACED`, `ORDER_UPDATED`, `SUBSCRIPTION_*`, `PRODUCT_CREATED/UPDATED`,
  `CART_ABANDONED_{1,24,72}H`, `NEWSLETTER_SUBSCRIBED`, `PROMOTION_*`, `COLLECTION_UPDATED`, …
- PosterPal endpoint: `POST /api/commerce/fourthwall/webhook` (401 on bad signature, 503 if it
  cannot verify, 500 if it cannot persist so Fourthwall retries).

## 7. What is deliberately NOT built

| Thing | Why not |
|---|---|
| Printify order submission | User decision: messy spec; and it spends *your* balance, opposite of the Fourthwall model |
| Printful client | Official docs are login-gated → could not verify endpoints in this session |
| Custom checkout | Does not exist in Fourthwall's API surface |
| Storefront cart UI | Website work is out of scope for this pass |
| Card data anywhere | PosterPal never sees it — Fourthwall handles payment |

## 8. How to verify the connection in 5 minutes

1. Fourthwall → Settings → For developers → **Open API → Create API user** (Super Admin).
2. PosterPal → Commerce → paste username+password → **Save connection** → **Test connection**.
   Success writes the shop name + shop domain.
3. **Load templates** (public endpoint) → pick a tee → create a *hidden* product from an AI still.
4. **Sync products** → copy a buy link → open it in a private window → fourthwall.com checkout
   shows your item.
5. Register the webhook URL + signing secret → run a test event in the Fourthwall dashboard →
   PosterPal shows the delivery in **Webhook deliveries**.
