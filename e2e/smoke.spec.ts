import { expect, test } from "@playwright/test";

// Smoke test: every route renders content without an uncaught JS error.
// This is the canary — if it fails, the app shell or a route broke.
//
// NOTE: not every route shows the left nav rail (/pair, /setup are standalone),
// so we assert on "the page rendered *something* and threw no page error"
// rather than on a shell element that some routes legitimately don't have.

const ROUTES = [
  "/",
  "/composer",
  "/later",
  "/drafts",
  "/calendar",
  "/inbox",
  "/agent",
  "/analytics",
  "/media",
  "/merchandise",
  "/vault",
  "/settings",
  "/pair",
  "/setup",
] as const;

test("every route renders without a JS error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    // The shell hydrates client-side; give it a beat to run effects.
    await page.waitForTimeout(1500);

    expect(errors, `JS error on ${route}`).toEqual([]);

    const text = (await page.locator("body").innerText()).trim();
    expect(text.length, `blank page on ${route}`).toBeGreaterThan(10);
  }
});
