#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err?.message || err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

async function goto(path) {
  const resp = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  return resp?.status() ?? 0;
}

const report = { errors, pages: {} };

report.pages.home = await goto("/");
await page.waitForSelector("text=Pages", { timeout: 20000 });
const homeText = await page.locator("body").innerText();
report.homeHasNeeds = /Needs you/i.test(homeText);
report.homeHasRecent = /Recent activity/i.test(homeText);
report.homeHasPreviewBrand = /PosterPal|BookBoss/.test(homeText);
await shot("qa-home");

const recent = page.locator("text=Recent activity").locator("xpath=ancestor::div[contains(@class,'rounded') or contains(@class,'card')]").locator("button").first();
if ((await recent.count()) === 0) {
  const fallback = page.locator("main button").filter({ hasText: /reactions|comments|story hour|Staff pick|New arrivals/i }).first();
  if (await fallback.count()) await fallback.click();
} else {
  await recent.click();
}
await page.waitForTimeout(600);
report.inspectorOpen = (await page.locator("text=Clone to other Pages").count()) > 0 || (await page.locator('[role="dialog"]').count()) > 0;
await shot("qa-inspector");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

report.pages.composer = await goto("/composer");
await page.waitForTimeout(700);
const composerText = await page.locator("body").innerText();
report.composerPreview = /Feed preview/i.test(composerText);
report.composerAlso = /Also post to/i.test(composerText);
await page.getByRole("button", { name: "Schedule" }).click();
await page.waitForTimeout(400);
const afterSched = await page.locator("body").innerText();
report.composerBestTimes = /am|pm|Suggested hour/i.test(afterSched);
await shot("qa-composer");

report.pages.inbox = await goto("/inbox");
await page.waitForTimeout(600);
const inboxText = await page.locator("body").innerText();
report.inboxSearch = (await page.locator('input[placeholder*="Search comments"]').count()) > 0;
report.inboxHasComments = /Needs reply|Visitor|Inbox zero/i.test(inboxText);
await shot("qa-inbox");

report.pages.analytics = await goto("/analytics");
await page.waitForTimeout(700);
const aText = await page.locator("body").innerText();
report.analyticsTop = /Top posts/i.test(aText);
report.analyticsHeat = /best hours|Hottest slot/i.test(aText);
await shot("qa-analytics");

report.pages.calendar = await goto("/calendar");
await page.waitForTimeout(600);
await shot("qa-calendar");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
mobile.on("pageerror", (err) => errors.push("mobile:" + String(err?.message || err)));
await mobile.goto(`${base}/composer`, { waitUntil: "networkidle", timeout: 45000 });
await mobile.waitForTimeout(700);
await mobile.screenshot({ path: "/workspace/screenshots/qa-composer-mobile.png" });
const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
report.mobileOverflow = mobileOverflow;
await mobile.close();

console.log(JSON.stringify(report, null, 2));
await browser.close();
if (errors.length) process.exit(2);
if (!report.composerPreview || !report.inboxSearch) process.exit(3);
process.exit(0);
