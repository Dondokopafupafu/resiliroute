import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const directory = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  await page.goto(process.env.RESILIROUTE_URL ?? "http://127.0.0.1:3000");
  await page.locator(".leaflet-container").waitFor();
  await page
    .locator(".leaflet-tile-loaded")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  await page.getByTestId("ai-summary").waitFor();
  await page.screenshot({ path: resolve(directory, "hero-map.png") });
  await page
    .locator("#network-workspace")
    .screenshot({ path: resolve(directory, "normal-network.png") });
  await page.getByTestId("scenario-earthquake").click();
  await page.getByLabel("Inspect network link").selectOption("harbor-bridge");
  await page.getByTestId("value-averageTravelTime").filter({ hasText: "20.9" }).waitFor();
  await page.locator(".logo-link").click();
  await page.screenshot({ path: resolve(directory, "earthquake-overview.png") });
  await page
    .locator("#impact-dashboard")
    .screenshot({ path: resolve(directory, "impact-dashboard.png") });
  await page
    .locator(".analysis-grid")
    .screenshot({ path: resolve(directory, "critical-recovery.png") });
  await page.locator("#ai-brief").screenshot({ path: resolve(directory, "ai-brief.png") });
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await page.locator(".logo-link").click();
  await page.screenshot({ path: resolve(directory, "earthquake-overview-ja.png") });
  await page.locator("#ai-brief").screenshot({ path: resolve(directory, "ai-brief-ja.png") });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await mobile.goto(process.env.RESILIROUTE_URL ?? "http://127.0.0.1:3000");
  await mobile.locator(".leaflet-container").waitFor();
  await mobile.getByTestId("scenario-earthquake").click();
  await mobile.getByTestId("value-averageTravelTime").filter({ hasText: "20.9" }).waitFor();
  await mobile.screenshot({ path: resolve(directory, "mobile-earthquake.png"), fullPage: true });
  await mobile.getByRole("button", { name: "日本語", exact: true }).click();
  await mobile.screenshot({ path: resolve(directory, "mobile-earthquake-ja.png"), fullPage: true });
  console.info(`Saved ten product screenshots to ${directory}`);
} finally {
  await browser.close();
}
