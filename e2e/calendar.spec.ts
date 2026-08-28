import { expect, test } from "@playwright/test";

// Calendar: the three views switch, and Published posts are not draggable.

test("Month / Week / Heatmap tabs all activate", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("tab", { name: "Month" })).toBeVisible();

  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "Heatmap" }).click();
  await expect(page.getByRole("tab", { name: "Heatmap" })).toHaveAttribute("aria-selected", "true");
});

test("Published posts are not draggable; scheduled posts are", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.locator("[draggable]").first()).toBeVisible({ timeout: 15_000 });
  // The seed publishes at least one post; Published rows must be draggable=false.
  await expect(page.locator('[draggable="false"]').first()).toBeVisible();
  await expect(page.locator('[draggable="true"]').first()).toBeVisible();
});
