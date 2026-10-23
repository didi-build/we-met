import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2] ?? "/opt/cursor/artifacts/screenshots/didi-758";
const url = process.argv[3];
const label = process.argv[4] ?? "shot";

if (!url) {
  console.error(
    "Usage: node scripts/capture-hi-didi-screenshots.mjs <outDir> <url> [label]",
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({
    viewport: { width: 420, height: 900 },
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.setAttribute("data-palette", "mono");
  }, theme);
  await page.waitForTimeout(800);

  const topPath = path.join(outDir, `${label}-${theme}-card-top.png`);
  await page.locator(".hi-card-page").first().screenshot({ path: topPath });

  const aboutHeading = page.getByRole("heading", { name: /about/i }).first();
  if (await aboutHeading.count()) {
    await aboutHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  const midPath = path.join(outDir, `${label}-${theme}-about-services-links.png`);
  await page.locator(".hi-card-page").first().screenshot({ path: midPath });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.setAttribute("data-palette", "mono");
  }, theme);
  await page.waitForTimeout(500);
  const exchangeBtn = page.getByRole("button", { name: /Exchange contact/i }).first();
  await exchangeBtn.click();
  await page.waitForTimeout(600);
  const sheetPath = path.join(outDir, `${label}-${theme}-exchange-sheet.png`);
  await page.screenshot({ path: sheetPath, fullPage: true });

  await page.close();
}

await browser.close();
console.log(`Saved screenshots to ${outDir} (${label})`);
