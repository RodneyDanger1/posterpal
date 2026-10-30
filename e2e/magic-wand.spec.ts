import { expect, test } from "@playwright/test";

// Magic wand: works with NO AI key (deterministic fallback), never claims a model
// when it used local rules, and Accept writes into the editor.

async function ensureDeskSeed(page: import("@playwright/test").Page) {
  const railPractice = page.getByRole("button", { name: /· Practice/ }).first();
  await page.goto("/setup");
  const skip = page.getByRole("button", { name: /start with 10 unique practice Pages/i });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  } else {
    await page.goto("/");
    const homeSeed = page.getByRole("button", { name: /Create practice Pages/i });
    if (await homeSeed.isVisible().catch(() => false)) await homeSeed.click();
  }
  // Seeding is async and lands on Pages; the rail is the proof.
  await expect(railPractice).toBeVisible({ timeout: 60_000 });
}

async function composerReady(page: import("@playwright/test").Page) {
  await ensureDeskSeed(page);
  await page.goto("/composer");
  const ta = page.getByPlaceholder("Write the caption…");
  await expect(ta).toBeVisible();
  // Hydration round-trip: a pre-hydration fill is wiped by React.
  await expect(async () => {
    await ta.fill("warmup text");
    await expect(ta).toHaveValue("warmup text", { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await ta.fill("");
  return ta;
}

test("caption wand improves a cliché locally and Accept applies the result", async ({ page }) => {
  const composer = await composerReady(page);
  await composer.fill("we are excited to elevate your game-changer tote for our shop");
  await page.getByLabel("Improve this caption prompt with the magic wand").click();
  const panel = page.getByRole("dialog", { name: "Magic wand prompt improver" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Improve prompt" }).click();
  await expect(panel.getByText(/Local rewrite|Model rewrite/)).toBeVisible({ timeout: 30_000 });
  const preview = panel.getByLabel("Improved prompt preview");
  await expect(preview).toBeVisible();
  const improved = await preview.inputValue();
  expect(improved.length).toBeGreaterThan(10);
  expect(improved.toLowerCase()).not.toContain("game-changer");
  await panel.getByRole("button", { name: "Accept" }).click();
  await expect(composer).toHaveValue(/Details on the Page|Details on the page/);
});

test("wand refuses an empty prompt with a specific message", async ({ page }) => {
  await composerReady(page);
  await page.getByLabel("Improve this caption prompt with the magic wand").click();
  await page.getByRole("button", { name: "Improve prompt" }).click();
  await expect(page.getByText(/Write something first/)).toBeVisible();
});

test("image wand structures a risky prompt and strips logo wording", async ({ page }) => {
  await ensureDeskSeed(page);
  await page.goto("/media");
  const input = page.getByLabel("Generate a photo");
  await expect(input).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await input.fill("warmup");
    await expect(input).toHaveValue("warmup", { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await input.fill("canvas tote bag with our logo at the farmers market");
  await page.getByLabel("Improve this image prompt with the magic wand").click();
  const panel = page.getByRole("dialog", { name: "Magic wand prompt improver" });
  await panel.getByRole("button", { name: "Improve prompt" }).click();
  await expect(panel.getByLabel("Improved prompt preview")).toBeVisible({ timeout: 30_000 });
  await panel.getByRole("button", { name: "Accept" }).click();
  const value = await input.inputValue();
  expect(value).toContain("Constraints:");
  expect(value.toLowerCase()).not.toContain("our logo");
});
