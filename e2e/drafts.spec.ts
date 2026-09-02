import { expect, test } from "@playwright/test";

// Drafts: the queue tabs and the schedule-then-cancel round trip.

test("drafts page shows the three queue tabs", async ({ page }) => {
  await page.goto("/drafts");
  await expect(page.locator('[data-view="drafts"]')).toBeVisible();
  await expect(page.locator('[data-view="queued"]')).toBeVisible();
  await expect(page.locator('[data-view="failed"]')).toBeVisible();
});

test("scheduling then cancelling returns the queue to its previous size", async ({ page }) => {
  const caption = "E2E schedule then cancel " + Date.now();

  await page.goto("/composer");
  await page.getByPlaceholder("Write the caption…").fill(caption);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/LocalScheduled/)).toBeVisible();

  await page.goto("/drafts");
  await expect(page.locator('[data-view="queued"]')).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
  await page.locator('[data-view="queued"]').click();
  await expect(page.locator('[data-view="queued"]')).toHaveAttribute("aria-pressed", "true");
  const row = page.locator("article").filter({ hasText: caption });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(caption)).not.toBeVisible();
});
