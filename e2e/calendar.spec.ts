import { expect, test } from "@playwright/test";

// Calendar: the three views switch, and Published posts are not draggable.

test("Month / Week / Heatmap tabs all activate", async ({ page }) => {
  await page.goto("/calendar");
  // SSR paints the view buttons before hydration. Wait for client data so
  // React owns the buttons — otherwise the click hits a dead SSR node.
  await expect(page.locator("[draggable]").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#cal-view-month")).toBeVisible();

  await page.locator("#cal-view-week").click();
  await expect(page.locator("#cal-view-week")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Week of/)).toBeVisible();

  await page.locator("#cal-view-heat").click();
  await expect(page.locator("#cal-view-heat")).toHaveAttribute("aria-pressed", "true");
});

test("Published posts are not draggable; scheduled posts are", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.locator("[draggable]").first()).toBeVisible({ timeout: 15_000 });
  // The seed publishes at least one post; Published rows must be draggable=false.
  await expect(page.locator('[draggable="false"]').first()).toBeVisible();
  await expect(page.locator('[draggable="true"]').first()).toBeVisible();
});
