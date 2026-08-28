import { expect, test } from "@playwright/test";

// Agent: offline drafting must stay honest (§17.4) — label notes unverified and
// toast the "no live search" warning instead of throwing.

test("Map this Page drafts offline without a caption model and labels notes unverified", async ({
  page,
}) => {
  await page.goto("/agent");
  await expect(page.getByRole("button", { name: /Map this Page/ })).toBeVisible();

  await page.getByRole("button", { name: /Map this Page/ }).click();
  // Offline path completes and reports the honesty contract.
  await expect(page.getByText(/Drafted without live search/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/unverified/i).first()).toBeVisible({ timeout: 20_000 });
});
