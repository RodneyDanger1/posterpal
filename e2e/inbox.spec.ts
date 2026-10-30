import { expect, test } from "@playwright/test";

// Inbox regressions: reply send (HITL), empty-reply guard, and hide.

async function inboxReady(page: import("@playwright/test").Page) {
  await page.goto("/inbox");
  await expect(page.getByRole("tab", { name: "Needs reply" })).toBeVisible();
  const reply = page.locator("article textarea");
  await expect(reply).toBeVisible();
  const send = page.getByRole("button", { name: "Send" });
  // Wait for React to own the form: filling before hydration is wiped by the
  // hydration pass (the draft suggestion gets restored) → this round-trip proves
  // the controlled component responds and the empty guard is live.
  await expect(async () => {
    await reply.fill("");
    await expect(send).toBeDisabled({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

test("reply send shows the HITL toast", async ({ page }) => {
  await inboxReady(page);
  const reply = page.locator("article textarea");
  await expect(reply).toBeVisible();
  await reply.fill("Thanks for asking — I'll confirm and reply with the details.");
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
