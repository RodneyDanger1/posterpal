# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: calendar.spec.ts >> Month / Week / Heatmap tabs all activate
- Location: e2e\calendar.spec.ts:5:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('tab', { name: 'Week' })
Expected: "true"
Received: "false"
Timeout:  10000ms

Call log:
  - Expect "toHaveAttribute" with timeout 10000ms
  - waiting for getByRole('tab', { name: 'Week' })
    22 × locator resolved to <button role="tab" type="button" tabindex="-1" aria-selected="false" data-state="inactive" data-orientation="horizontal" data-radix-collection-item="" id="radix-_R_1cb6l6_-trigger-week" title="Seven days, larger drop targets" aria-controls="radix-_R_1cb6l6_-content-week" class="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-semibold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card">Week</button>
       - unexpected value "false"

```

```yaml
- tab "Week"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | // Calendar: the three views switch, and Published posts are not draggable.
  4  | 
  5  | test("Month / Week / Heatmap tabs all activate", async ({ page }) => {
  6  |   await page.goto("/calendar");
  7  |   await expect(page.getByRole("tab", { name: "Month" })).toBeVisible();
  8  | 
  9  |   await page.getByRole("tab", { name: "Week" }).click();
> 10 |   await expect(page.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
     |                                                         ^ Error: expect(locator).toHaveAttribute(expected) failed
  11 | 
  12 |   await page.getByRole("tab", { name: "Heatmap" }).click();
  13 |   await expect(page.getByRole("tab", { name: "Heatmap" })).toHaveAttribute("aria-selected", "true");
  14 | });
  15 | 
  16 | test("Published posts are not draggable; scheduled posts are", async ({ page }) => {
  17 |   await page.goto("/calendar");
  18 |   await expect(page.locator("[draggable]").first()).toBeVisible({ timeout: 15_000 });
  19 |   // The seed publishes at least one post; Published rows must be draggable=false.
  20 |   await expect(page.locator('[draggable="false"]').first()).toBeVisible();
  21 |   await expect(page.locator('[draggable="true"]').first()).toBeVisible();
  22 | });
  23 | 
```