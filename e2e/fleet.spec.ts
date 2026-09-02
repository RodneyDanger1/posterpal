import { expect, test } from "@playwright/test";

test("practice fleet loads 10 unique Pages on the home rail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pages" })).toBeVisible();
  await expect(page.getByPlaceholder("Filter Pages")).toBeVisible();
  const railPages = page.locator("aside button").filter({ hasText: "likes" });
  await expect(railPages).toHaveCount(10);
  await expect(page.getByRole("button", { name: "North Shore Books 2.8K likes" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sugar Loaf Ceramics/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Garvin Heights Guides/ }).first()).toBeVisible();
});
