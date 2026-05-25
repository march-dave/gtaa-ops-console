import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../docs/screenshots");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.SCREENSHOT_BASE_URL ?? "https://gtaa-ops-a04931.azurewebsites.net";

const PAGES = [
  { path: "/forecast",       file: "01-forecast.png",       label: "Passenger Forecast" },
  { path: "/gate-approval",  file: "02-gate-approval.png",  label: "Gate Approval" },
  { path: "/apron-cv",       file: "03-apron-cv.png",       label: "Apron CV" },
  { path: "/sensors",        file: "04-sensors.png",        label: "Sensors" },
  { path: "/insights",       file: "05-insights.png",       label: "Operations Insights (Fabric)" },
  { path: "/reports",        file: "06-reports.png",        label: "Reports (Power BI)" },
  { path: "/audit",          file: "07-audit.png",          label: "Audit Log" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, // retina-quality
});
const page = await ctx.newPage();

// Pre-seed localStorage so the auth provider boots as Duty Manager.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("gtaa.mockUser", "duty");
  } catch {
    /* ignore */
  }
});

for (const { path, file, label } of PAGES) {
  const url = `${BASE}${path}`;
  console.log(`→ ${label.padEnd(36)} ${url}`);
  // Use "load" not "networkidle" — Apron CV holds an SSE connection open and
  // would never go idle. A fixed settle delay handles the post-load paint.
  await page.goto(url, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(3000);
  const out = resolve(OUT, file);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`  saved ${file}`);
}

await browser.close();
console.log(`\nAll screenshots written to ${OUT}`);
