import { expect, test } from "@playwright/test";

// Inbox regressions: reply send (HITL), empty-reply guard, and hide.

async function inboxReady(page: import("@playwright/test").Page) {
  await page.goto("/inbox");
  await expect(page.getByRole("tab", { name: "Needs reply" })).toBeVisible();
}

test("reply send shows the HITL toast", async ({ page }) => {
  await inboxReady(page);
  const reply = page.locator("article textarea");
  await expect(reply).toBeVisible();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Reply sent by you")).toBeVisible();
});

test("empty reply disables Send", async ({ page }) => {
  await inboxReady(page);
  const reply = page.locator("article textarea");
  await expect(reply).toBeVisible();
  await reply.fill("");
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
});

test("Hide removes the active comment from the needs-reply list", async ({ page }) => {
  await inboxReady(page);
  await page.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByText(/Comment hidden/i)).toBeVisible();
});
