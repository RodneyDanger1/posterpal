import { chromium } from "@playwright/test";

/**
 * Seed the practice desk once per e2e server.
 *
 * Specs run alphabetically and `fleet.spec` asserts the 10-Page rail before any
 * other spec has created those Pages, so relying on the wizard inside a spec is
 * order-dependent. This runs before the suite: if the rail already has practice
 * Pages it does nothing, otherwise it uses the official first-run skip path.
 */
export default async function globalSetup(): Promise<void> {
  const base = process.env.E2E_BASE_URL ?? "http://localhost:8081";
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const rail = page.getByRole("button", { name: /· Practice/ }).first();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    if (await rail.isVisible().catch(() => false)) return;

    await page.goto(`${base}/setup`, { waitUntil: "domcontentloaded" });
    const skip = page.getByRole("button", { name: /start with 10 unique practice Pages/i });
    await skip.waitFor({ timeout: 90_000 });
    // Retry the click until hydration takes it and the fleet is on the rail.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await skip.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      if (await rail.isVisible().catch(() => false)) return;
    }
    await rail.waitFor({ timeout: 90_000 });
  } finally {
    await browser.close();
  }
}
