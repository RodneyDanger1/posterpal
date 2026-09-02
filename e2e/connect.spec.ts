import { expect, test } from "@playwright/test";

test("Connect coach renders official steps and does not scrape facebook.com", async ({ page }) => {
  await page.goto("/connect");
  await expect(page.getByRole("heading", { name: "Connect Facebook" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How Meta apps work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Easy setup/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask agent" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Facebook Login" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open Your apps dashboard/ }).first()).toBeVisible();
  await expect(page.getByText(/Official Graph API/)).toBeVisible();
  await expect(page.getByText(/never scrapes facebook.com/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "App ID" })).toBeVisible();
  await expect(page.getByLabel("App Secret", { exact: true })).toBeVisible();
});
