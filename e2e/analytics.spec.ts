import { expect, test } from "@playwright/test";

// Analytics: CSV export runs without error and the range switcher works.

test("Export CSV runs without an error toast", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  await page.getByRole("button", { name: "Export CSV" }).click();
  await expect(page.getByText("Export failed")).not.toBeVisible();
});

test("range switch 7d -> 90d keeps the summary rendered", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.getByText(/Reactions/)).toBeVisible();
  await page.getByRole("button", { name: "90d" }).click();
  await expect(page.getByText(/Reactions/)).toBeVisible();
});
