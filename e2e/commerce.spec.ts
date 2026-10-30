import { expect, test } from "@playwright/test";

// Commerce (Fourthwall) — the parts that must work without credentials:
// the page renders, the connect form validates, and it never claims a
// connection it does not have.

test("commerce page renders the Fourthwall connection form without claiming a connection", async ({ page }) => {
  await page.goto("/commerce");
  await expect(page.getByRole("heading", { name: "Commerce", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fourthwall connection" })).toBeVisible();
  await expect(page.getByText("not connected")).toBeVisible();
  await expect(page.getByLabel("Open API username")).toBeVisible();
  await expect(page.getByLabel("Open API password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save connection" })).toBeVisible();
  // Checkout reality is stated on the page, not hidden.
  await expect(page.getByText(/Merchant of Record/i).first()).toBeVisible();
});

test("commerce save refuses half-filled credentials instead of storing a broken connection", async ({ page }) => {
  await page.goto("/commerce");
  await expect(page.getByLabel("Open API username")).toBeVisible();
  await page.getByLabel("Label").fill("Fourthwall");
  await page.getByLabel("Open API username").fill("api-user");
  await page.getByRole("button", { name: "Save connection" }).click();
  // Native required validation on the password field keeps the form open; the
  // connection must NOT be created.
  await expect(page.getByText("not connected")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fourthwall connection" })).toBeVisible();
});

test("commerce templates button exists and print export explains Fourthwall's raster-only rule", async ({ page }) => {
  await page.goto("/commerce");
  await expect(page.getByRole("button", { name: /Load templates/ })).toBeVisible();
  await expect(page.getByText(/never PDF, SVG, AI, EPS, PSD, or TIFF/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Export print file" })).toBeVisible();
});

test("rail exposes Commerce and Messenger destinations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Commerce" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Messenger" }).first()).toBeVisible();
});
