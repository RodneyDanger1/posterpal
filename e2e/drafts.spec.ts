import { expect, test } from "@playwright/test";

// Drafts: the queue tabs and the schedule-then-cancel round trip.

test("drafts page shows the three queue tabs", async ({ page }) => {
  await page.goto("/drafts");
  await expect(page.getByRole("tab", { name: /Drafts \(\d+\)/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Scheduled \(\d+\)/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Failed \(\d+\)/ })).toBeVisible();
});

test("scheduling then cancelling returns the queue to its previous size", async ({ page }) => {
  await page.goto("/drafts");
  await page.getByRole("tab", { name: /Scheduled \(\d+\)/ }).click();
  const before = await page.locator("article").count();

  // Schedule a fresh post.
  await page.goto("/composer");
  await page.getByPlaceholder("Write the caption…").fill("E2E schedule then cancel " + Date.now());
  await page.getByRole("button", { name: "Schedule" }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/LocalScheduled/)).toBeVisible();

  // Cancel it from the queue.
  await page.goto("/drafts");
  await page.getByRole("tab", { name: /Scheduled \(\d+\)/ }).click();
  await expect(page.locator("article")).toHaveCount(before + 1);
  await page.locator("article").first().getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("article")).toHaveCount(before);
});
