# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: drafts.spec.ts >> scheduling then cancelling returns the queue to its previous size
- Location: e2e\drafts.spec.ts:12:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('article')
Expected: 1
Received: 3
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('article')
    3 × locator resolved to 4 elements
      - unexpected value "4"
    20 × locator resolved to 3 elements
       - unexpected value "3"

```

# Page snapshot

```yaml
- generic [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - generic [ref=f2e8]:
        - generic [ref=f2e9]: PosterPal
        - generic [ref=f2e10]: Every Page. One desk.
      - textbox "Filters the Page list in this rail" [ref=f2e13]:
        - /placeholder: Filter Pages
      - generic [ref=f2e16]:
        - button "North Shore Books 2.8K likes · Practice" [ref=f2e17] [cursor=pointer]:
          - generic [ref=f2e18]: NB
          - generic [ref=f2e19]:
            - generic [ref=f2e20]: North Shore Books
            - generic [ref=f2e21]: 2.8K likes · Practice
        - button "Winona Weekend 1.2K likes · Practice" [ref=f2e22] [cursor=pointer]:
          - generic [ref=f2e23]: WW
          - generic [ref=f2e24]:
            - generic [ref=f2e25]: Winona Weekend
            - generic [ref=f2e26]: 1.2K likes · Practice
      - navigation [ref=f2e27]:
        - link "Pages" [ref=f2e28] [cursor=pointer]:
          - /url: /
        - link "Composer" [ref=f2e35] [cursor=pointer]:
          - /url: /composer
        - link "Later" [ref=f2e40] [cursor=pointer]:
          - /url: /later
        - link "Drafts" [ref=f2e44] [cursor=pointer]:
          - /url: /drafts
        - link "Calendar" [ref=f2e49] [cursor=pointer]:
          - /url: /calendar
        - link "Inbox 5" [ref=f2e53] [cursor=pointer]:
          - /url: /inbox
          - generic [ref=f2e57]: Inbox
          - generic [ref=f2e58]: "5"
        - link "Agent" [ref=f2e59] [cursor=pointer]:
          - /url: /agent
        - link "Analytics" [ref=f2e63] [cursor=pointer]:
          - /url: /analytics
        - link "Media" [ref=f2e67] [cursor=pointer]:
          - /url: /media
        - link "Merchandise" [ref=f2e73] [cursor=pointer]:
          - /url: /merchandise
        - link "Token vault" [ref=f2e78] [cursor=pointer]:
          - /url: /vault
        - link "Settings" [ref=f2e83] [cursor=pointer]:
          - /url: /settings
    - generic [ref=f2e88]:
      - banner [ref=f2e89]:
        - button "Search posts, comments, Pages Ctrl+K" [ref=f2e90] [cursor=pointer]:
          - generic [ref=f2e94]: Search posts, comments, Pages
          - generic [ref=f2e95]: Ctrl+K
        - generic [ref=f2e96]:
          - generic [ref=f2e98]: Quota
          - generic [ref=f2e99]: 12%
        - button "Sync" [ref=f2e100] [cursor=pointer]
        - generic [ref=f2e106]:
          - button "Needs you" [ref=f2e108] [cursor=pointer]
          - button "Keyboard shortcuts" [ref=f2e113] [cursor=pointer]:
            - generic [ref=f2e114]: "?"
          - button "Toggle theme" [ref=f2e115] [cursor=pointer]
      - main [ref=f2e119]:
        - generic [ref=f2e120]:
          - generic [ref=f2e123]:
            - heading "Drafts & queue" [level=1] [ref=f2e124]
            - button "About Drafts & queue" [ref=f2e125] [cursor=pointer]
          - generic [ref=f2e128]:
            - tablist [ref=f2e129]:
              - tab "Drafts (2)" [ref=f2e130] [cursor=pointer]
              - tab "Scheduled (3)" [active] [selected] [ref=f2e131] [cursor=pointer]
              - tab "Failed (1)" [ref=f2e132] [cursor=pointer]
            - tabpanel "Scheduled (3)" [ref=f2e133]:
              - article [ref=f2e134]:
                - button "North Shore Books · Text · in 6d E2E schedule then cancel 1787385279659 Local schedule" [ref=f2e135] [cursor=pointer]:
                  - generic [ref=f2e136]:
                    - generic [ref=f2e137]: North Shore Books · Text · in 6d
                    - paragraph [ref=f2e138]: E2E schedule then cancel 1787385279659
                  - generic [ref=f2e139]: Local schedule
                - generic [ref=f2e140]:
                  - button "Open in Composer" [ref=f2e141] [cursor=pointer]
                  - button "Copy" [ref=f2e142] [cursor=pointer]
                  - button "Cancel" [ref=f2e143] [cursor=pointer]
              - article [ref=f2e144]:
                - 'button "North Shore Books · Text · in 18h Staff pick Tuesday: a novel that starts on a train and ends in a kitchen you will want to stand in. Ask Maya at the desk — she will put it in your hands. Local schedule" [ref=f2e145] [cursor=pointer]':
                  - generic [ref=f2e146]:
                    - generic [ref=f2e147]: North Shore Books · Text · in 18h
                    - paragraph [ref=f2e148]: "Staff pick Tuesday: a novel that starts on a train and ends in a kitchen you will want to stand in. Ask Maya at the desk — she will put it in your hands."
                  - generic [ref=f2e149]: Local schedule
                - generic [ref=f2e150]:
                  - button "Open in Composer" [ref=f2e151] [cursor=pointer]
                  - button "Copy" [ref=f2e152] [cursor=pointer]
                  - button "Cancel" [ref=f2e153] [cursor=pointer]
              - article [ref=f2e154]:
                - button "North Shore Books · Photo · 2h ago Window-display polaroid from last night — the river light caught the spines. Scheduled while the desk was closed; publish when you open the phone. Overdue — local scheduler only fires while this desk is open. Overdue — desk was closed. Publish from Needs you or Drafts. Local schedule" [ref=f2e155] [cursor=pointer]:
                  - generic [ref=f2e156]:
                    - generic [ref=f2e157]: North Shore Books · Photo · 2h ago
                    - paragraph [ref=f2e158]: Window-display polaroid from last night — the river light caught the spines. Scheduled while the desk was closed; publish when you open the phone.
                    - paragraph [ref=f2e159]: Overdue — local scheduler only fires while this desk is open.
                    - paragraph [ref=f2e160]: Overdue — desk was closed. Publish from Needs you or Drafts.
                  - generic [ref=f2e161]: Local schedule
                - generic [ref=f2e162]:
                  - button "Open in Composer" [ref=f2e163] [cursor=pointer]
                  - button "Copy" [ref=f2e164] [cursor=pointer]
                  - button "Cancel" [ref=f2e165] [cursor=pointer]
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | // Drafts: the queue tabs and the schedule-then-cancel round trip.
  4  | 
  5  | test("drafts page shows the three queue tabs", async ({ page }) => {
  6  |   await page.goto("/drafts");
  7  |   await expect(page.getByRole("tab", { name: /Drafts \(\d+\)/ })).toBeVisible();
  8  |   await expect(page.getByRole("tab", { name: /Scheduled \(\d+\)/ })).toBeVisible();
  9  |   await expect(page.getByRole("tab", { name: /Failed \(\d+\)/ })).toBeVisible();
  10 | });
  11 | 
  12 | test("scheduling then cancelling returns the queue to its previous size", async ({ page }) => {
  13 |   await page.goto("/drafts");
  14 |   await page.getByRole("tab", { name: /Scheduled \(\d+\)/ }).click();
  15 |   const before = await page.locator("article").count();
  16 | 
  17 |   // Schedule a fresh post.
  18 |   await page.goto("/composer");
  19 |   await page.getByPlaceholder("Write the caption…").fill("E2E schedule then cancel " + Date.now());
  20 |   await page.getByRole("button", { name: "Schedule" }).click();
  21 |   await page.getByRole("button", { name: "Send" }).click();
  22 |   await expect(page.getByText(/LocalScheduled/)).toBeVisible();
  23 | 
  24 |   // Cancel it from the queue.
  25 |   await page.goto("/drafts");
  26 |   await page.getByRole("tab", { name: /Scheduled \(\d+\)/ }).click();
> 27 |   await expect(page.locator("article")).toHaveCount(before + 1);
     |                                         ^ Error: expect(locator).toHaveCount(expected) failed
  28 |   await page.locator("article").first().getByRole("button", { name: "Cancel" }).click();
  29 |   await expect(page.locator("article")).toHaveCount(before);
  30 | });
  31 | 
```