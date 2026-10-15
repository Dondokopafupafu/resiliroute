import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import fixture from "../fixtures/osm-small.json";
import { buildRealCityNetwork } from "../../lib/osm/network-builder";

test.beforeEach(async ({ page }) => {
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
});
async function tab(page: Page, name: string) {
  await page.getByTestId("decision-workspace").getByRole("tab", { name, exact: true }).click();
}
async function earthquake(page: Page) {
  await page.goto("/");
  await page.getByTestId("scenario-earthquake").click();
  await expect(page.getByTestId("decision-workspace")).toContainText("3 links closed");
}

test("batch failures, heatmap, baseline map and cascading evidence stay consistent", async ({
  page,
}) => {
  await page.goto("/");
  const workspace = page.getByTestId("decision-workspace");
  await page.getByLabel("Add disruption link").selectOption("harbor-bridge");
  await page.getByLabel("Add disruption link").selectOption("east-rail");
  await expect(page.locator(".closed-edge")).toHaveCount(0);
  await page.getByTestId("run-multi-failure").click();
  await expect(page.locator(".closed-edge")).toHaveCount(2);
  await expect(workspace).toContainText("2 links closed");
  await expect(page.getByTestId("value-resilienceScore")).not.toHaveText("100");
  await workspace.getByRole("button", { name: "Show criticality heatmap", exact: true }).click();
  await expect(page.getByTestId("decision-map-legend")).toContainText("40 of 42 links tested");
  await page.getByLabel("Inspect network link").selectOption("north-avenue");
  await page.getByTestId("map-critical-detail").locator("summary").click();
  await expect(page.getByTestId("map-critical-detail")).toContainText("Extra disconnected demand");
  await page.getByRole("button", { name: "Before", exact: true }).click();
  await expect(page.locator(".closed-edge")).toHaveCount(0);
  await expect(workspace).toContainText("2 links closed");
  await page.getByRole("button", { name: "After", exact: true }).click();
  await expect(page.locator(".closed-edge")).toHaveCount(2);
  await workspace.getByRole("button", { name: "Show stress layer", exact: true }).click();
  await expect(page.getByTestId("decision-map-legend")).toContainText("Utilization increase");
  await workspace.getByRole("button", { name: "Restore all", exact: true }).click();
  await expect(page.getByTestId("value-resilienceScore")).toHaveText("100");
});

test("budget alternatives, sequence, uncertainty, robust shortlist and report use live results", async ({
  page,
}) => {
  await earthquake(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const workspace = page.getByTestId("decision-workspace");
  await tab(page, "Recover");
  await page.getByTestId("recovery-budget").fill("6");
  await page.getByTestId("optimize-budget").click();
  await expect(workspace).toContainText("Exact enumeration");
  await expect(workspace.locator(".decision-plan")).toHaveCount(3);
  await expect(workspace.locator(".decision-sequence-chart")).toBeVisible();
  await tab(page, "Uncertainty");
  await page.getByTestId("uncertainty-runs").fill("30");
  await page.getByTestId("run-uncertainty").click();
  await expect(page.getByTestId("run-robust-recovery")).toBeEnabled();
  await page.getByTestId("run-robust-recovery").click();
  await expect(workspace).toContainText("Worst sampled");
  await tab(page, "Report");
  await page.getByLabel("Report scenario name").fill("Earthquake budget comparison");
  const downloadEvent = page.waitForEvent("download");
  await page.getByTestId("generate-resilience-report").click();
  const download = await downloadEvent;
  const html = await readFile((await download.path())!, "utf8");
  expect(download.suggestedFilename()).toBe("resiliroute-resilience-report.html");
  expect(html).toContain("Earthquake budget comparison");
  expect(html).toContain("Recovery budget plans");
  expect(html).toContain("Uncertainty experiment");
  expect(html).toContain("69.4");
  expect(html).not.toMatch(/NaN|Infinity|undefined%/);
  expect(errors).toEqual([]);
});

test("saved scenarios survive reload, compare, import and reject malformed input", async ({
  page,
}) => {
  await earthquake(page);
  const workspace = page.getByTestId("decision-workspace");
  await tab(page, "Compare");
  await page.getByLabel("Scenario name", { exact: true }).fill("Bridge and rail");
  await page.getByTestId("save-decision-scenario").click();
  const downloadEvent = page.waitForEvent("download");
  await workspace.getByRole("button", { name: "Export", exact: true }).click();
  const downloaded = await downloadEvent;
  const path = (await downloaded.path())!;
  await page.reload();
  await tab(page, "Compare");
  await expect(workspace.locator(".decision-saved-list")).toContainText("Bridge and rail");
  await workspace.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.locator(".closed-edge")).toHaveCount(3);
  await page.getByTestId("scenario-flood").click();
  await page.getByLabel("Scenario name", { exact: true }).fill("Flood corridor");
  await page.getByTestId("save-decision-scenario").click();
  await page.getByTestId("compare-decision-scenarios").click();
  await expect(workspace.locator(".decision-table")).toContainText("Flood corridor");
  await page.getByLabel("Import scenario JSON").setInputFiles(path);
  await expect(page.locator(".closed-edge")).toHaveCount(3);
  await page.getByLabel("Import scenario JSON").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":999}'),
  });
  await expect(workspace.getByRole("alert")).toContainText("Scenario import rejected");
  await expect(page.locator(".closed-edge")).toHaveCount(3);
  await workspace
    .getByRole("button", { name: "Delete scenario: Flood corridor", exact: true })
    .click();
  await expect(workspace.locator(".decision-saved-list li")).toHaveCount(1);
});

test("long experiments cancel and invalid inputs do not leave frozen progress", async ({
  page,
}) => {
  await page.goto("/");
  const ids = [
    "harbor-bridge",
    "east-rail",
    "coastal-road",
    "north-avenue",
    "riverside-crossing",
    "west-lane",
    "harbor-rail",
    "east-riverside",
    "port-bypass",
    "southern-crossing",
    "old-town-road",
    "central-avenue",
  ];
  for (const id of ids) await page.getByLabel("Add disruption link").selectOption(id);
  await tab(page, "Uncertainty");
  await page.getByTestId("uncertainty-runs").fill("1000");
  await page.getByTestId("run-uncertainty").click();
  await page.getByRole("button", { name: "Cancel analysis", exact: true }).click();
  await expect(page.getByTestId("run-uncertainty")).toBeEnabled();
  await page.getByTestId("uncertainty-runs").fill("1001");
  await page.getByTestId("run-uncertainty").click();
  await expect(page.getByTestId("decision-workspace").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.getByRole("tab", { name: "不確実性", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  await page.getByRole("tab", { name: "不確実性", exact: true }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "レポート", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("real-city batch closure, comparison, budget and reset reuse the same network", async ({
  page,
}) => {
  const snapshot = buildRealCityNetwork(
    fixture,
    { south: 35, west: 139, north: 35.02, east: 139.02 },
    "2026-10-10T00:00:00Z",
  );
  await page.route("**/api/osm/network", (route) =>
    route.fulfill({ json: { snapshot, cached: false } }),
  );
  await page.goto("/real-city");
  await page.getByLabel("Try an example area").selectOption("0");
  await page.getByTestId("build-network").click();
  await expect(page.getByText("Full stress test:", { exact: false })).toBeVisible();
  await expect(
    page.getByLabel("Add disruption link").locator('option[value^="connector-"]'),
  ).toHaveCount(0);
  await page.getByLabel("Add disruption link").selectOption("osm-way-102-0");
  const second = snapshot.network.edges.find((edge) => edge.osm && edge.id !== "osm-way-102-0")!.id;
  await page.getByLabel("Add disruption link").selectOption(second);
  await page.getByTestId("run-multi-failure").click();
  await expect(page.getByTestId("run-multi-failure")).toBeEnabled();
  await expect(page.locator(".closed-edge")).toHaveCount(2);
  await expect(page.getByTestId("value-resilienceScore")).not.toHaveText("100");
  await tab(page, "Compare");
  await page.getByLabel("Scenario name", { exact: true }).fill("Two real roads");
  await page.getByTestId("save-decision-scenario").click();
  await expect(page.getByTestId("decision-workspace")).toContainText("Scenario collection saved");
  await page.getByTestId("compare-decision-scenarios").click();
  await expect(page.locator(".decision-table")).toContainText("Two real roads");
  await tab(page, "Recover");
  await page.getByTestId("optimize-budget").click();
  await expect(page.getByTestId("decision-workspace")).toContainText("Exact enumeration");
  await page.getByRole("button", { name: "Reset closures", exact: true }).click();
  await expect(page.getByTestId("value-resilienceScore")).toHaveText("100");
  await expect(page.locator(".closed-edge")).toHaveCount(0);
});

test("navigating between city modes keeps both Leaflet maps and decision tools usable", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const snapshot = buildRealCityNetwork(
    fixture,
    { south: 35, west: 139, north: 35.02, east: 139.02 },
    "2026-10-10T00:00:00Z",
  );
  await page.route("**/api/osm/network", (route) =>
    route.fulfill({ json: { snapshot, cached: false } }),
  );
  await page.goto("/");
  await expect(page.getByTestId("network-map")).toBeVisible();
  await page.getByRole("link", { name: "Real City Lab", exact: true }).click();
  await page.getByLabel("Try an example area").selectOption("0");
  await page.getByTestId("build-network").click();
  await expect(page.getByText("Full stress test:", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Demo City", exact: true }).click();
  await page.getByTestId("scenario-earthquake").click();
  await expect(page.locator(".closed-edge")).toHaveCount(3);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("value-resilienceScore")).toHaveText("100");
  await page.getByRole("link", { name: "Real City Lab", exact: true }).click();
  await expect(page.getByTestId("real-map")).toBeVisible();
  expect(failures).toEqual([]);
});
