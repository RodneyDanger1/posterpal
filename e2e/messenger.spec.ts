import { expect, test } from "@playwright/test";

// Messenger — HITL contract and webhook setup surface. No Meta credentials are
// needed: these assert the guard rails and the stored verify token.

/**
 * The desk hydrates client-side. Filling before React owns the input means
 * hydration resets the DOM value and the submit button stays disabled, so wait
 * for a real interaction round-trip instead of a fixed timeout.
 */
async function ready(page: import("@playwright/test").Page) {
  await page.goto("/messenger");
  await expect(page.getByRole("heading", { name: "Webhook setup" })).toBeVisible();
  const input = page.getByLabel("Verify token");
  const save = page.getByRole("button", { name: "Save verify token" });
  await expect(async () => {
    await input.fill("warmup_token_1234");
    await expect(save).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
}

test("messenger page shows webhook setup and the 24-hour policy", async ({ page }) => {
  await page.goto("/messenger");
  await expect(page.getByRole("heading", { name: "Messenger", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Webhook setup" })).toBeVisible();
  await expect(page.getByText(/24-hour standard messaging window/).first()).toBeVisible();
  await expect(page.getByText(/Nothing here auto-replies, auto-likes/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save verify token" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Threads" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy endpoint" })).toBeVisible();
});

test("messenger rejects a too-short verify token with a specific error", async ({ page }) => {
  await ready(page);
  await page.getByLabel("Verify token").fill("short");
  await page.getByRole("button", { name: "Save verify token" }).click();
  await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
});

test("messenger saves a valid verify token and flips the status badge", async ({ page }) => {
  await ready(page);
  const token = `e2e_messenger_${Date.now()}`;
  await page.getByLabel("Verify token").fill(token);
  await page.getByRole("button", { name: "Save verify token" }).click();
  // Exact match: the success toast contains "Verify token saved — …" too.
  await expect(page.getByText("verify token saved", { exact: true })).toBeVisible();
});

test("messenger reply box is disabled until a thread with an open window exists", async ({ page }) => {
  await page.goto("/messenger");
  // Fresh desk: no threads, so the detail pane shows the empty state and there is
  // no Send button to mis-click.
  await expect(page.getByText(/No threads yet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send reply" })).toHaveCount(0);
});
