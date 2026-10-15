import { chromium, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Actual production UI and calculated results. No fabricated metrics or DOM overlays.
const directory = fileURLToPath(new URL("../docs/screenshots/ultimate/", import.meta.url));
await mkdir(directory, { recursive: true });
const base = process.env.RESILIROUTE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByTestId("scenario-earthquake").click();
  const workspace = page.getByTestId("decision-workspace");
  const tab = (name) => workspace.getByRole("tab", { name, exact: true }).click();
  await tab("Recover");
  await page.getByTestId("recovery-budget").fill("6");
  await page.getByTestId("optimize-budget").click();
  await expect(workspace).toContainText("Exact enumeration");
  await expect(workspace.locator(".decision-plan")).toHaveCount(3);
  await workspace.screenshot({ path: resolve(directory, "recovery-plans.png") });
  await tab("Uncertainty");
  await page.getByTestId("uncertainty-runs").fill("100");
  await page.getByTestId("run-uncertainty").click();
  await expect(page.getByTestId("run-robust-recovery")).toBeEnabled();
  await page.getByTestId("run-robust-recovery").click();
  await expect(workspace).toContainText("Worst sampled");
  await workspace.screenshot({ path: resolve(directory, "uncertainty.png") });
  await tab("Report");
  await page.getByLabel("Report scenario name").fill("Earthquake recovery comparison");
  const downloadEvent = page.waitForEvent("download");
  await page.getByTestId("generate-resilience-report").click();
  const download = await downloadEvent;
  const html = await readFile(await download.path(), "utf8");
  const reportPage = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await reportPage.setContent(html);
  await reportPage.screenshot({ path: resolve(directory, "report-preview.png") });
  await reportPage.close();

  // Keep the complete map and its OpenStreetMap attribution inside the capture.
  await page.setViewportSize({ width: 1440, height: 1500 });
  await page.goto(`${base}/real-city`);
  await page.getByLabel("Load a saved OSM example (no API)").selectOption("okayama");
  await expect(page.locator(".screening-note")).toContainText("35 candidate", { timeout: 45000 });
  await page.locator(".ranking-row").first().click();
  await page.getByRole("button", { name: "Simulate closure", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen road", exact: true })).toBeEnabled({
    timeout: 45000,
  });
  await expect(page.getByTestId("value-resilienceScore")).not.toHaveText("100");
  await page.getByLabel("Map analysis layer").selectOption("criticality");
  await page.locator(".real-hero").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(directory, "real-city-criticality.png") });
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await workspace.getByRole("tab", { name: "復旧計画", exact: true }).click();
  await page.getByTestId("optimize-budget").click();
  await expect(workspace).toContainText("厳密な全組み合わせ探索");
  await workspace.screenshot({ path: resolve(directory, "real-city-recovery-ja.png") });
  expect(errors).toEqual([]);
  console.info("Saved five actual decision-workspace captures, including the generated report.");
} finally {
  await browser.close();
}
