import { expect, test } from "@playwright/test";

// Composer regressions: draft save, schedule autofill, the Round 3 stale-policy
// fix, and the Round 4 #25 Photo-multi-file guard.

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/composer");
  await expect(page.getByPlaceholder("Write the caption…")).toBeVisible();
}

test("local draft save shows the LocalDraft toast", async ({ page }) => {
  await ready(page);
  await page.getByPlaceholder("Write the caption…").fill("E2E draft caption " + Date.now());
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("LocalDraft", { exact: true })).toBeVisible();
});

test("Schedule mode auto-fills a date and time", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  const dt = page.locator('input[type="datetime-local"]');
  await expect(dt).toBeVisible();
  await expect(dt).not.toHaveValue("");
});

test("fast Send after typing is not blocked by a stale policy (Round 3 fix)", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByPlaceholder("Write the caption…").fill("Unique otter caption " + Date.now());
  // Send immediately, inside the policy debounce window — the client must
  // re-check fresh instead of trusting the stale empty-caption block.
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Published — Practice Page")).toBeVisible();
  await expect(page.getByText("Policy checklist blocked")).not.toBeVisible();
});

test("Photo mode with two files offers Switch to Carousel (#25)", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Photo" }).click();

  // The file input is non-multiple in Photo mode, so set files directly via a
  // DataTransfer (the same way the real ingest path receives them) — this is the
  // exact condition the #25 guard protects against.
  await page.locator('input[type="file"]').evaluate((el) => {
    const png = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
      (c) => c.charCodeAt(0),
    );
    const dt = new DataTransfer();
    dt.items.add(new File([png], "a.png", { type: "image/png" }));
    dt.items.add(new File([png], "b.png", { type: "image/png" }));
    const input = el as HTMLInputElement;
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Photo mode posts one image. You attached 2/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to Carousel" }).first()).toBeVisible();
});
