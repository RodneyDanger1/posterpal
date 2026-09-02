import { expect, test } from "@playwright/test";

test("Later saves an idea and shows it in Inbox column", async ({ page }) => {
  await page.goto("/later");
  await expect(page.getByRole("heading", { name: "Later" })).toBeVisible();
  await expect(page.getByText("River rug photo")).toBeVisible();
  const body = "E2E later idea " + Date.now();
  await page.locator("#idea").fill(body);
  await expect(page.locator("#idea")).toHaveValue(body);
  await page.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByRole("heading", { name: body })).toBeVisible();
});
