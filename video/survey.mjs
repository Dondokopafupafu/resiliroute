import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("video/assets/stills", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:3001");
await page.locator(".leaflet-container").waitFor();
await page.getByTestId("ai-summary").waitFor();
await page.waitForTimeout(1000);
await page.screenshot({ path: "video/assets/stills/survey.png" });
const boxes = {};
for (const selector of [
  "main",
  ".metric-grid",
  "#network-workspace",
  ".map-wrapper",
  ".scenario-panel",
  "#impact-dashboard",
  ".charts-grid",
  ".analysis-grid",
  ".services-panel",
  "#ai-brief",
]) {
  boxes[selector] = await page.locator(selector).boundingBox();
}
await writeFile("video/assets/stills/layout.json", JSON.stringify(boxes, null, 2));
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export analysis" }).click(),
]);
await download.saveAs("video/assets/normal-results.json");
await page.getByTestId("scenario-earthquake").click();
await page.getByTestId("value-averageTravelTime").filter({ hasText: "20.9" }).waitFor();
const [quake] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export analysis" }).click(),
]);
await quake.saveAs("video/assets/earthquake-results.json");
console.info(boxes);
await browser.close();
