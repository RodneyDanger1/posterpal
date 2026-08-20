#!/usr/bin/env node
/**
 * Prove the desk still paints when third-party cookies / localStorage throw
 * (the Grok live-preview iframe case).
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const blockStorage = process.argv.includes("--block-storage");
const suffix = blockStorage ? "blocked" : "ok";
const pageErrors = [];
const consoleErrors = [];

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();
page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

if (blockStorage) {
  await page.addInitScript(() => {
    const boom = () => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    };
    const blocked = {
      getItem: boom,
      setItem: boom,
      removeItem: boom,
      clear: boom,
      key: boom,
      length: 0,
    };
    Object.defineProperty(window, "localStorage", { configurable: true, get: boom });
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => blocked });
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: () => undefined,
    });
  });
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1500);

const skip = page.getByRole("button", { name: /practice Pages/i });
if (await skip.count()) {
  await skip.first().click();
  await page.waitForTimeout(2000);
}

const title = await page.title();
const body = (await page.locator("body").innerText().catch(() => "")).trim();
await page.screenshot({ path: `/workspace/screenshots/cookie-${suffix}-home.png`, fullPage: false });

for (const path of ["/composer", "/later", "/settings", "/analytics"]) {
  await page.goto(`http://127.0.0.1:8080${path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const name = path.slice(1) || "home";
  await page.screenshot({
    path: `/workspace/screenshots/cookie-${suffix}-${name}.png`,
    fullPage: false,
  });
}

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const mpage = await mobile.newPage();
if (blockStorage) {
  await mpage.addInitScript(() => {
    const boom = () => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { configurable: true, get: boom });
  });
}
await mpage.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 45000 });
await mpage.waitForTimeout(1000);
await mpage.screenshot({ path: `/workspace/screenshots/cookie-${suffix}-mobile.png`, fullPage: false });
const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);

const result = {
  blockStorage,
  title,
  bodySample: body.slice(0, 240),
  bodyLen: body.length,
  pageErrors,
  consoleErrors: consoleErrors.slice(0, 12),
  mobileOverflow: overflow,
};
console.log(JSON.stringify(result, null, 2));

await browser.close();
if (pageErrors.length) process.exit(2);
if (body.length < 40) process.exit(1);
