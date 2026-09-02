import { expect, test } from "@playwright/test";

// Agent: offline drafting must stay honest (§17.4) — label notes unverified and
// toast the "no live search" warning instead of throwing.

test("Map this Page drafts offline without a caption model and labels notes unverified", async ({
  page,
}) => {
  await page.goto("/agent");
  await expect(page.getByRole("button", { name: /Map this Page/ }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/What’s on this desk|Desk health/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Draft inbox replies/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fix failed publishes/ })).toBeVisible();
  await expect(page.getByText(/^Personas$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Calendar$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Memory$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Connect$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Recall Later/ })).toBeVisible();
  await expect(page.getByText(/Happenings/)).toBeVisible();

  await page.getByRole("button", { name: /Map this Page/ }).first().click();
  // Offline path completes and reports the honesty contract.
  await expect(page.getByText(/Drafted without live search/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/unverified/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Open caption in Composer|Open in Composer/ }).first()).toBeVisible({
    timeout: 10_000,
  });
});
