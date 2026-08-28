# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: composer.spec.ts >> Photo mode with two files offers Switch to Carousel (#25)
- Location: e2e\composer.spec.ts:37:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Photo mode posts one image. You attached 2/)
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText(/Photo mode posts one image. You attached 2/)

```

```yaml
- complementary:
  - text: PosterPal Every Page. One desk.
  - textbox "Filters the Page list in this rail":
    - /placeholder: Filter Pages
  - button "North Shore Books 2.8K likes · Practice"
  - button "Winona Weekend 1.2K likes · Practice"
  - navigation:
    - link "Pages":
      - /url: /
    - link "Composer":
      - /url: /composer
    - link "Later":
      - /url: /later
    - link "Drafts":
      - /url: /drafts
    - link "Calendar":
      - /url: /calendar
    - link "Inbox 5":
      - /url: /inbox
    - link "Agent":
      - /url: /agent
    - link "Analytics":
      - /url: /analytics
    - link "Media":
      - /url: /media
    - link "Merchandise":
      - /url: /merchandise
    - link "Token vault":
      - /url: /vault
    - link "Settings":
      - /url: /settings
- banner:
  - button "Search posts, comments, Pages Ctrl+K"
  - text: Quota 12%
  - button "Sync"
  - button "Needs you"
  - button "Keyboard shortcuts": "?"
  - button "Toggle theme"
- main:
  - heading "Composer" [level=1]
  - button "About Composer"
  - text: Posting as
  - combobox "Posting as":
    - option "North Shore Books (practice)" [selected]
    - option "Winona Weekend (practice)"
  - text: Also post to
  - paragraph: Same caption and media, a separate row per Page. Each Page still has its own cadence and policy. You click Send once.
  - checkbox "Winona Weekend (practice)"
  - text: Winona Weekend (practice)
  - button "Text"
  - button "Photo"
  - button "Carousel"
  - button "Video"
  - button "Reel"
  - button "Story"
  - textbox "Write the caption…"
  - text: "0 chars · 0 words · 0 # Write a caption. Best hours on this Page"
  - button "Thu 8pm"
  - button "Tue 8pm"
  - button "Mon 2am"
  - text: Link
  - textbox "https://"
  - text: First comment (posted on Graph right after a live publish)
  - textbox
  - text: Product for this post
  - button "Winona canvas tote"
  - button "Staff-pick subscription"
  - checkbox "Drop the shop URL in the first comment (keeps the caption clean; Graph posts it after a live publish)"
  - text: Drop the shop URL in the first comment (keeps the caption clean; Graph posts it after a live publish)
  - button "Hours block"
  - button "Staff pick closer"
  - text: Drop media or browse
  - button "Drop media or browse"
  - paragraph: "Local files upload to Graph as multipart (photos/videos) or rupload (Reels/Stories). Public https URLs also work. Reels: 9:16, 3–60s, min 540×960. Max 6MB per file in Composer (bigger files: paste a public https URL as the Link)."
  - text: Generate a still
  - textbox "Generate a still":
    - /placeholder: A quiet bookstore window at dusk, no text
  - button "Generate image"
  - list:
    - listitem:
      - text: a.png
      - textbox "Alt text"
      - button "Remove"
    - listitem:
      - text: b.png
      - textbox "Alt text"
      - button "Remove"
  - button "Publish now"
  - button "Schedule"
  - button "Local draft"
  - button "Facebook draft"
  - button "Send"
  - button "Save for later" [disabled]
  - button "Remember caption" [disabled]
  - button "Copy" [disabled]
  - button "3 variants" [disabled]
  - button "Check caption" [disabled]
  - button "Research" [disabled]
  - button "Hashtags" [disabled]
  - text: Caption model
  - combobox:
    - option "Grok (xAI)" [selected]
    - option "OpenAI — add key"
    - option "Google Gemini — add key"
    - option "DeepSeek — add key"
  - text: Image model
  - combobox:
    - option "Grok Imagine" [selected]
    - option "OpenAI Images — add key"
    - option "Gemini Nano Banana — add key"
    - option "Flux Schnell (fal) — add key"
  - complementary:
    - text: Feed preview
    - article:
      - text: North Shore Books Just now
      - paragraph: Write a caption to see it on the Page.
      - text: Like Comment Share
    - heading "Policy checklist" [level=2]
    - list:
      - listitem: Empty caption Write a caption before publishing. Empty feed posts look unfinished and underperform.
      - listitem: Missing alt text Add alt text so screen-reader users and Graph photo uploads stay accessible.
    - heading "Cadence" [level=2]
    - paragraph: 3 / warn 8 / block 20 in 24h
- region "Notifications alt+T"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | // Composer regressions: draft save, schedule autofill, the Round 3 stale-policy
  4  | // fix, and the Round 4 #25 Photo-multi-file guard.
  5  | 
  6  | async function ready(page: import("@playwright/test").Page) {
  7  |   await page.goto("/composer");
  8  |   await expect(page.getByPlaceholder("Write the caption…")).toBeVisible();
  9  | }
  10 | 
  11 | test("local draft save shows the LocalDraft toast", async ({ page }) => {
  12 |   await ready(page);
  13 |   await page.getByPlaceholder("Write the caption…").fill("E2E draft caption " + Date.now());
  14 |   await page.getByRole("button", { name: "Send" }).click();
  15 |   await expect(page.getByText("LocalDraft")).toBeVisible();
  16 | });
  17 | 
  18 | test("Schedule mode auto-fills a date and time", async ({ page }) => {
  19 |   await ready(page);
  20 |   await page.getByRole("button", { name: "Schedule" }).click();
  21 |   const dt = page.locator('input[type="datetime-local"]');
  22 |   await expect(dt).toBeVisible();
  23 |   await expect(dt).not.toHaveValue("");
  24 | });
  25 | 
  26 | test("fast Send after typing is not blocked by a stale policy (Round 3 fix)", async ({ page }) => {
  27 |   await ready(page);
  28 |   await page.getByRole("button", { name: "Publish now" }).click();
  29 |   await page.getByPlaceholder("Write the caption…").fill("Unique otter caption " + Date.now());
  30 |   // Send immediately, inside the policy debounce window — the client must
  31 |   // re-check fresh instead of trusting the stale empty-caption block.
  32 |   await page.getByRole("button", { name: "Send" }).click();
  33 |   await expect(page.getByText("Published — Practice Page")).toBeVisible();
  34 |   await expect(page.getByText("Policy checklist blocked")).not.toBeVisible();
  35 | });
  36 | 
  37 | test("Photo mode with two files offers Switch to Carousel (#25)", async ({ page }) => {
  38 |   await ready(page);
  39 |   await page.getByRole("button", { name: "Photo" }).click();
  40 | 
  41 |   // The file input is non-multiple in Photo mode, so set files directly via a
  42 |   // DataTransfer (the same way the real ingest path receives them) — this is the
  43 |   // exact condition the #25 guard protects against.
  44 |   await page.locator('input[type="file"]').evaluate((el) => {
  45 |     const png = Uint8Array.from(
  46 |       atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
  47 |       (c) => c.charCodeAt(0),
  48 |     );
  49 |     const dt = new DataTransfer();
  50 |     dt.items.add(new File([png], "a.png", { type: "image/png" }));
  51 |     dt.items.add(new File([png], "b.png", { type: "image/png" }));
  52 |     const input = el as HTMLInputElement;
  53 |     input.files = dt.files;
  54 |     input.dispatchEvent(new Event("change", { bubbles: true }));
  55 |   });
  56 | 
  57 |   await page.getByRole("button", { name: "Publish now" }).click();
  58 |   await page.getByRole("button", { name: "Send" }).click();
> 59 |   await expect(page.getByText(/Photo mode posts one image. You attached 2/)).toBeVisible();
     |                                                                              ^ Error: expect(locator).toBeVisible() failed
  60 |   await expect(page.getByRole("button", { name: "Switch to Carousel" })).toBeVisible();
  61 | });
  62 | 
```