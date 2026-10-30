# Ridgeboundia niche-Page network — business model & plan

> **Scope note:** this is the business analysis you asked for. It deliberately excludes the
> Ridgeboundia website build and personal-site content. Numbers marked **(assumption)** are planning
> figures, not verified quotes; terms marked **UNVERIFIED** must be confirmed with each supplier
> before you rely on them.

---

## 1. The model in one sentence

Run **5–10 genuinely distinct nature/education Pages** (each with 1–3 Groups), publish native-feeling
content with a human in the loop, and monetise attention through **low-friction merch drops**
(`Ridgeboundia × {Page}` collabs) fulfilled by **Fourthwall** — which is Merchant of Record, so you
carry no inventory and no upfront product cost, and get paid as profit.

Why this shape:
- You already have the content machine (PosterPal: compose → policy → schedule → inbox → analytics).
- Fourthwall's zero-upfront model means the floor on a failed drop is **$0**, not dead inventory.
- Niche Pages with real audiences convert better than one general store, and a *page-specific*
  product ("Garvin Heights Guides trail tee") is a community artifact, not generic merch.

## 2. Portfolio design (5–10 Pages)

| Slot | Page archetype | Audience | Collab product | Group(s) |
|---|---|---|---|---|
| 1 | Regional hiking/trails | local hikers | trail tee, sticker sheet | "Trail Conditions" group |
| 2 | Nature education | parents/teachers | kids tee, poster, flashcards | "Nature Study" group |
| 3 | Animals/wildlife facts | animal lovers | socks, hoodie, sticker pack | "Wild Neighbours" group |
| 4 | World science news | curious adults | poster, mug, tee | "Science Weekly" group |
| 5 | Life science / biology | students | tote, notebook, poster | "Bio Club" group |
| 6 | Travel + outdoors | roadtrippers | all-over tee, cap, blanket | "Weekend Trips" group |
| 7 | Local history/geology | regional pride | poster, mug | "Local Geology" group |
| 8 | Birding | birders | cap, patch, sticker | "Backyard Birds" group |

Rules that keep this legal and durable (from `META-SETUP.md` §7):
- Each Page has distinct name, art, voice, and content — **no cross-posting identical captions**
  (PosterPal's cross-Page Jaccard policy blocks it; that is a feature, not friction).
- Groups: you can own them and post **manually**. Graph cannot post to Groups. Never buy group
  members or engagement.
- AI drafts; you click Publish/Send. No auto-DMs, no auto-comments, no "AI posts while you sleep".

## 3. Funnel

```
Page post (merch CTA + UTM)
  → on-site buy link  /api/commerce/fourthwall/checkout?…&fbclid=…&utm_*
  → Fourthwall hosted checkout  (MoR: payment, tax, fraud, refunds)
  → Fourthwall fulfillment + shipping
  → ORDER_PLACED webhook → PosterPal orders + click attribution
```

Attribution survives the off-site handoff because Fourthwall captures `fbclid`, `_fbp`, `_fbc`,
`utm_*` from the checkout URL into order metadata (verified in the cart-checkout endpoint docs and
the `trackingParams` field of the Order API).

Optional second surface: **Facebook/Instagram Shop** via Fourthwall's native app. Meta asks for a
checkout URL; you paste Fourthwall's. A Shop tab is discovery, Fourthwall is checkout. Setup is
documented step-by-step in `COMMERCE-FOURTHWALL.md` §4.

## 4. Unit economics (planning model — assumptions labelled)

Assumptions per drop per Page:
- Page audience 1,000–5,000 engaged followers.
- 0.5–1.5% buy-link click rate on a good post = 5–75 clicks (use 20 as the planning number).
- 3–5% click → purchase (merch page is external, so expect low) = ~1 buyer per drop for small pages.
- Fourthwall profit per apparel item **$10–18** (price $32–38 minus base cost; **UNVERIFIED** —
  read live base prices from `GET /product-templates`).

| Scenario | Pages | Buyers/page/drop | Profit/order | Monthly drops | Gross profit/mo |
|---|---|---|---|---|---|
| Conservative | 5 | 1 | $12 | 2 | **$120** |
| Base | 8 | 2 | $14 | 3 | **$672** |
| Good | 10 | 3 | $15 | 4 | **$1,800** |

These are modest on purpose — merch is a **monetisation layer**, not the growth engine. The real
leverage is audience size and repeat drops; a single viral Page changes the math far more than
another product.

## 5. Supplier strategy — the truth about "never charge me anything"

There are only four cost models for physical products:

| Model | Who pays first | Zero upfront? | Examples | Reality |
|---|---|---|---|---|
| **Merchant of Record POD** | customer pays platform; platform pays you profit | ✅ **Yes** | **Fourthwall** (verified) | You own no inventory, no card on file, no float. Exactly your requirement. |
| POD with your account balance | you pay per order from balance/card | ❌ No | Printify, Printful, Gooten, SPOD, Printbest, CustomCat, Apliiq, Gelato, Prodigi | You must top up; profit = sale − cost, but you front the cost. |
| Dropship | supplier charges your card when the order comes | ❌ No (float + risk) | Spocket, Zendrop, CJdropshipping, AutoDS, DSers/AliExpress | Margin thinner, shipping slower, quality variable. |
| Wholesale / private label | you buy inventory up front | ❌ No | Faire, Abound, Creoate, Maker's Row, ThomasNet, Alibaba, Global Sources | Best margins and uniqueness; capital + storage + shipping ops. |

**Conclusion:** for graphic tees/hoodies/mugs/socks/pillows/posters, Fourthwall is the *only* option
that meets "no cost to me". Candles/soap/other non-graphic goods **cannot** be done at zero cost —
either you buy inventory or you dropship with a card on file.

### Candidate supplier register (30 platforms — verify every term yourself)

**Zero-upfront / MoR**
1. **Fourthwall** — POD MoR, no upfront, checkout hosted. **VERIFIED** (docs fetched 2026-10-29).

**POD platforms (you fund orders)**
2. Printful — wide catalog; docs login-gated (**UNVERIFIED** in this session).
3. Printify — public OpenAPI verified: `https://api.printify.com/v1/`, Bearer PAT, 600 req/min,
   server-side only (no CORS). Order creation spends your balance.
4. Gooten — catalog + API.
5. SPOD (Spreadshirt POD) — EU/US fulfilment.
6. Printbest — cheap basics.
7. CustomCat — US bulk POD.
8. Apliiq — private-label apparel, custom labels.
9. Teelaunch — US POD.
10. Gelato — global print network, strong posters.
11. Prodigi — global print/framing.
12. Contrado — UK/EU, fabric + home.
13. AOI/Printful Enterprise (via Printify docs) — enterprise brand surface.

**Dropship (card on file, margin thin)**
14. Spocket — US/EU suppliers.
15. Zendrop — fast shipping, POD + general.
16. CJdropshipping — sourcing + fulfilment.
17. AutoDS — automation layer over suppliers.
18. DSers / AliExpress — cheapest, slowest, quality risk.
19. SaleHoo — supplier directory (paid).

**Wholesale / private-label marketplaces (inventory required)**
20. Faire — wholesale marketplace, low minimums, net-30 terms after approval.
21. Abound — curated US wholesale.
22. Creoate — UK/EU wholesale.
23. Maker's Row — US manufacturers (apparel, home, candles/soap).
24. ThomasNet — US contract manufacturers directory (candles, soap, packaging).
25. Alibaba — contract manufacturing, MOQ + tooling.
26. Global Sources — Alibaba alternative, vetted suppliers.
27. IndiaMART — low-MOQ manufacturing.
28. Qogita — EU beauty/personal care wholesale (verify).
29. The/Studio — small-batch patches/pins (merch adjacent).
30. Local makers / farmers-market co-packers — candles/soap, consignment or revenue split.

**How to turn 30 names into 20–50 vetted suppliers:** pick 3 per category, request samples +
line sheets, score on (moq, landed cost, lead time, defect rate, white-label packaging, shipping
to your customers, payment terms). Only survivors go in the ops sheet. Never list a supplier as
"zero cost" until their actual invoice terms say so.

## 6. Merch strategy (what to make first)

Start narrow — three products, two Pages:
1. **Sticker sheet** (300 DPI, cheap, impulse buy, great for groups) — highest conversion.
2. **Tee** (DTG, 3–6 colour flat graphic) — the identity product.
3. **Mug or poster** (sublimation/300 DPI) — gift/seasonal.

Then, only after a product sells 3+ times: hoodie, socks, all-over apparel, cap (embroidery ≤6
colours). Private-label packaging/labels = later, via Apliiq/Fourthwall inside-label print area.

Collab framing: `Ridgeboundia × {Page}` limited drop, 7–14 days, then archive. Scarcity without
fake urgency; no auto-ads required to start.

## 7. Content → commerce operating loop (weekly)

| Day | Action | PosterPal surface |
|---|---|---|
| Mon | Choose weekly angle per Page; generate 1 still per Page | Agent + Imagine |
| Tue | Compose 5–8 posts (1 per Page), schedule across the week | Composer + Calendar |
| Wed | Ship print-ready file for the drop product | Commerce → Print-ready export |
| Thu | Publish drop post with buy link + UTM + `#ad` if branded | Composer |
| Daily | Reply to comments/DMs (HITL) | Inbox + Messenger |
| Fri | Review clicks/orders per Page | Commerce + Analytics |
| Sun | Keep or kill the product; log learnings | Later / notes |

## 8. 90-day plan

**Days 1–14 — connect and prove**
- Meta app + Connect (Dev Mode) → publish one real Page post.
- Fourthwall connection → Test → create one hidden tee from an AI still → order a sample.
- Register Fourthwall webhook.

**Days 15–30 — first drop**
- 3 Pages live, 1 Group each (manual posting for Groups).
- Sticker sheet + tee on one Page; buy links with UTM per Page.
- Measure clicks per post; kill anything below 0.3% click rate after 5 posts.

**Days 31–60 — portfolio**
- Grow to 6 Pages; repeatable weekly loop; 2 drops.
- Add mug/poster; test Meta Shop via Fourthwall if eligible in your country.
- Ask: which Page produces buyers, not just reach? Double down there.

**Days 61–90 — scale what works**
- 8–10 Pages; one collab drop/month; consider a small ad budget only on proven posts.
- Decide on candles/soap: only with a supplier whose terms you've verified and a sample in hand.
- Revisit owning checkout (Stripe) **only** if merch revenue justifies inventory risk.

## 9. KPIs (weekly)

- Reach per Page, engagement rate, **buy-link click rate** (target ≥0.5% of reach)
- Click → order rate (target ≥3%)
- Profit per drop, per Page; repeat-buyer count
- Group growth and comment-to-DM conversion
- Content uniqueness across Pages (PosterPal `uniqueness` metric — keep high)
- Policy blocks per week (should trend down; if high you're near spam behaviour)

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Meta treats a Page network as inauthentic behaviour | Genuinely different Pages/audiences/voices; no identical captions (policy blocks); no bought engagement; no Group spam |
| Account/app suspension | Development Mode, operator-only; you don't depend on App Review; keep tokens encrypted; back up the desk |
| AI content backlash / disclosure rules | Human review, `createdWithAi` flag, no fake documentary claims, disclose branded content `#ad` |
| POD print quality | Sample every product; pipeline refuses >4× upscales; mockup review before publish |
| Platform concentration (Fourthwall-only) | Keep a second POD account (Printful/Printify) for optionality, even if unused |
| Non-graphic goods need capital | Start with POD only; add inventory categories only after merch proves demand |
| Tax/refund handling | Fourthwall is MoR — they handle it; do not take payments yourself unless you accept that burden |

## 11. What PosterPal still needs for this plan (ranked)

1. Live Facebook connection + one real Page post (credentials) — **blocked on you**.
2. Fourthwall credentials + first hidden product (credentials) — **blocked on you**.
3. Media files on disk instead of data URLs (before volume) — **not done**.
4. Storefront page with cart (Storefront API) — optional; buy links already work.
5. Instagram connector (second surface) — optional, separate App Review.
