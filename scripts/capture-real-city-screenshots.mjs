import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Actual saved OSM data, replayed through the application's normal worker.
// No metrics or road ranking are supplied by this capture script.
const directory = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
await mkdir(directory, { recursive: true });
const base = process.env.RESILIROUTE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1500 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/real-city`);
  await page.getByLabel("Load a saved OSM example (no API)").selectOption("okayama");
  await expect(page.locator(".screening-note")).toContainText("35 candidate", { timeout: 45000 });
  await page
    .locator(".leaflet-tile-loaded")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  await page.locator(".real-hero").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(directory, "real-city-baseline.png") });
  await page.locator(".ranking-row").first().click();
  await page.getByRole("button", { name: "Simulate closure", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen road", exact: true })).toBeEnabled({
    timeout: 45000,
  });
  await expect(page.getByTestId("value-resilienceScore")).not.toHaveText("100");
  await page.locator(".real-hero").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(directory, "real-city-closure.png") });
  await page
    .locator(".real-analysis")
    .screenshot({ path: resolve(directory, "real-city-analysis.png") });
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.getByTestId("ai-summary")).toContainText("実道路");
  await page.locator(".real-hero").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(directory, "real-city-closure-ja.png") });
  expect(errors).toEqual([]);
  console.info("Saved four actual Real City Lab captures in docs/screenshots.");
} finally {
  await browser.close();
}
