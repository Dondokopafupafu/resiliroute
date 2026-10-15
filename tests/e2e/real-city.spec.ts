import { expect, test } from "@playwright/test";
import fixture from "../fixtures/osm-small.json";
import { buildRealCityNetwork } from "../../lib/osm/network-builder";

const bbox = { south: 35, west: 139, north: 35.02, east: 139.02 };
const snapshot = buildRealCityNetwork(fixture, bbox, "2026-10-10T00:00:00Z");

test("clearing or invalidating a coordinate keeps the map and form usable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/real-city");
  await page.getByLabel("Try an example area").selectOption("0");
  await page.getByText("Edit bounding coordinates", { exact: true }).click();
  await page.getByLabel("north", { exact: true }).fill("");
  await expect(page.getByTestId("build-network")).toBeDisabled();
  await expect(page.locator(".real-map")).toBeVisible();
  await expect(page.locator(".area-stats")).not.toContainText("NaN");
  await page.getByLabel("north", { exact: true }).fill("999");
  await expect(page.getByTestId("build-network")).toBeDisabled();
  await page.getByLabel("Try an example area").selectOption("0");
  await expect(page.getByTestId("build-network")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("cancelled saved examples cannot replace a later import", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/real-city/okayama.json", async (route) => {
    await pending;
    await route.fulfill({ json: snapshot }).catch(() => {});
  });
  await page.goto("/real-city");
  await page.getByLabel("Load a saved OSM example (no API)").selectOption("okayama");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".real-error[role=alert]")).toContainText("cancelled");
  await page.getByLabel("Import Snapshot", { exact: true }).setInputFiles({
    name: "snapshot.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  await expect(page.getByText("Full stress test:", { exact: false })).toBeVisible();
  release();
  // Allow the cancelled request to settle, then inspect its user-visible provenance.
  await page.waitForTimeout(500);
  await expect(page.getByTestId("network-summary")).toContainText("Imported snapshot");
  await expect(page.getByTestId("network-summary")).not.toContainText("Saved actual OSM sample");
});
test.beforeEach(async ({ page }) => {
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/analysis/real-city", (route) =>
    route.fulfill({ json: { source: "local", useBrowserEvidence: true } }),
  );
  await page.route("**/api/osm/network", (route) =>
    route.fulfill({ json: { snapshot, cached: false } }),
  );
});
async function build(page: import("@playwright/test").Page) {
  await page.goto("/real-city");
  await page.getByLabel("Try an example area").selectOption("0");
  await page.getByTestId("build-network").click();
  await expect(page.getByTestId("network-summary")).toBeVisible();
  await expect(page.getByText("Full stress test:", { exact: false })).toBeVisible();
}
test("builds, closes a real road, redistributes, recovers and resets", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await build(page);
  const before = Number(await page.getByTestId("value-averageTravelTime").innerText());
  await page.locator(".road-osm-way-102-0").click({ force: true });
  await expect(page.getByTestId("real-inspector")).toContainText("Fixture Bridge");
  await page.getByRole("button", { name: "Simulate closure", exact: true }).click();
  await expect(page.locator(".closed-edge")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Reopen road", exact: true })).toBeEnabled();
  expect(Number(await page.getByTestId("value-averageTravelTime").innerText())).toBeGreaterThan(
    before,
  );
  await expect(page.getByTestId("ai-summary")).toContainText("1 real-road");
  await expect(page.locator("#recovery-analysis")).toContainText("Fixture Bridge");
  await page.getByRole("button", { name: "Restore Fixture Bridge", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText(before.toFixed(1));
  await expect(page.locator(".closed-edge")).toHaveCount(0);
  await page.getByLabel("Inspect real road").selectOption("osm-way-102-0");
  await page.getByRole("button", { name: "Simulate closure", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen road", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Reset closures", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText(before.toFixed(1));
  expect(errors).toEqual([]);
});
test("snapshot import/export, routes and Japanese UI work without the data API", async ({
  page,
}) => {
  await page.goto("/real-city");
  await page.getByLabel("Import Snapshot", { exact: true }).setInputFiles({
    name: "snapshot.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  await expect(page.getByText("Full stress test:", { exact: false })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Network Snapshot" }).click();
  expect((await download).suggestedFilename()).toBe("resiliroute-real-city-snapshot.json");
  await page.getByLabel("Destination", { exact: true }).selectOption("osm-facility-node-12");
  await expect(page.getByTestId("real-route-time")).toContainText("Scenario:");
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.getByRole("button", { name: "閉鎖をリセット", exact: true })).toBeVisible();
  await expect(page.getByTestId("network-summary")).toContainText("交差点");
  await expect(page.getByTestId("ai-summary")).toContainText("実在する道路");
  await page.getByRole("button", { name: "計算方法", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("実都市データの処理手順");
  await page.getByRole("dialog").press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  await page.getByRole("link", { name: "デモ都市", exact: true }).click();
  await expect(page.getByTestId("run-demo")).toContainText("地震デモ");
});
test("bbox selection and oversized area stop before an API request", async ({ page }) => {
  await page.goto("/real-city");
  await page.getByRole("button", { name: "Select area on map", exact: true }).click();
  const map = page.locator(".real-map");
  const bounds = await map.boundingBox();
  await map.click({ position: { x: bounds!.width * 0.3, y: bounds!.height * 0.3 } });
  await map.click({ position: { x: bounds!.width * 0.65, y: bounds!.height * 0.65 } });
  await expect(page.getByTestId("build-network")).toBeEnabled();
  await page.getByText("Edit bounding coordinates").click();
  await page.getByLabel("north", { exact: true }).fill("37");
  await expect(page.getByText("Selected area is too large.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("build-network")).toBeDisabled();
});
test("data errors never replace Harbor City with a fake network", async ({ page }) => {
  await page.goto("/real-city");
  await page.getByLabel("Try an example area").selectOption("0");
  for (const failure of [
    { error: "TIMEOUT", message: "timed out", status: 504 },
    { error: "UPSTREAM_UNAVAILABLE", message: "temporarily unavailable", status: 503 },
    { error: "INVALID_RESPONSE", message: "incomplete data", status: 502 },
    { error: "EMPTY_ROADS", message: "No usable connected road", status: 422 },
    { error: "TOO_COMPLEX", message: "too many roads", status: 422 },
  ]) {
    await page.route("**/api/osm/network", (route) =>
      route.fulfill({ status: failure.status, json: { error: failure.error } }),
    );
    await page.getByTestId("build-network").click();
    await expect(page.locator(".real-error[role=alert]")).toContainText(failure.message);
    await expect(page.getByTestId("network-summary")).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Use Demo City Instead", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("14.2");
  await page.getByTestId("run-demo").click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("20.9");
});

test("areas with no essential facilities show N/A rather than invented accessibility", async ({
  page,
}) => {
  const withoutFacilities = buildRealCityNetwork(
    {
      ...fixture,
      elements: fixture.elements.filter(
        (e) => !e.tags?.amenity && !e.tags?.railway && !e.tags?.emergency,
      ),
    },
    bbox,
  );
  await page.goto("/real-city");
  await page.getByLabel("Import Snapshot", { exact: true }).setInputFiles({
    name: "no-facilities.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(withoutFacilities)),
  });
  await expect(page.getByText("Full stress test:", { exact: false })).toBeVisible();
  await expect(page.getByTestId("value-accessibility")).toHaveText("N/A");
  await expect(
    page.getByRole("status").filter({ hasText: "No supported facilities were imported" }),
  ).toBeVisible();
  await expect(page.getByTestId("value-resilienceScore")).toHaveText("100");
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.getByTestId("value-accessibility")).toHaveText("対象データなし");
});

test("an unreachable app server has a distinct bilingual error and can be retried", async ({
  page,
}) => {
  await page.goto("/real-city");
  await page.getByLabel("Try an example area").selectOption("0");
  await page.route("**/api/osm/network", (route) => route.abort("connectionrefused"));
  await page.getByTestId("build-network").click();
  const alert = page.locator(".real-error[role=alert]");
  await expect(alert).toContainText("Cannot reach the ResiliRoute server");
  await expect(alert).not.toContainText("OpenStreetMap is temporarily unavailable");
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(alert).toContainText("ResiliRouteのサーバーに接続できません");
  await page.route("**/api/osm/network", (route) =>
    route.fulfill({ json: { snapshot, cached: false } }),
  );
  await page.getByTestId("build-network").click();
  await expect(page.getByTestId("network-summary")).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test("a dense selection can be shrunk without silently fetching or replacing the network", async ({
  page,
}) => {
  await build(page);
  await page.getByText("Change analysis area", { exact: true }).click();
  await page.getByLabel("Try an example area").selectOption("0");
  const requests: { south: number; west: number; north: number; east: number }[] = [];
  await page.route("**/api/osm/network", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 422, json: { error: "TOO_COMPLEX" } });
  });
  await page.getByTestId("build-network").click();
  await expect(page.locator(".real-error")).toContainText("too many roads");
  await page.getByRole("button", { name: "Shrink selected area", exact: true }).click();
  expect(requests).toHaveLength(1);
  await expect(page.getByTestId("network-summary")).toBeVisible();
  await expect(page.getByTestId("value-resilienceScore")).toHaveText("100");
  await page.getByTestId("build-network").click();
  await expect(page.locator(".real-error")).toContainText("too many roads");
  expect(requests).toHaveLength(2);
  const [before, after] = requests;
  expect(after.north - after.south).toBeCloseTo((before.north - before.south) / 2, 8);
  expect(after.east - after.west).toBeCloseTo((before.east - before.west) / 2, 8);
  expect(after.north + after.south).toBeCloseTo(before.north + before.south, 8);
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.getByRole("button", { name: "範囲を小さくする", exact: true })).toBeVisible();
});
