import { expect, test } from "@playwright/test";
import fixture from "../fixtures/osm-small.json";
import { buildRealCityNetwork } from "../../lib/osm/network-builder";

const bbox = { south: 35, west: 139, north: 35.02, east: 139.02 };
const snapshot = buildRealCityNetwork(fixture, bbox, "2026-10-10T00:00:00Z");

test.beforeEach(async ({ page }) => {
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/analysis/real-city", (route) =>
    route.fulfill({ json: { source: "local", useBrowserEvidence: true } }),
  );
});

test("selects the visible map, resizes the crop, and builds inside the app", async ({ page }) => {
  const requests: (typeof bbox)[] = [];
  await page.route("**/api/osm/network", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { snapshot, cached: false } });
  });
  await page.goto("/real-city");
  await page.getByRole("button", { name: "Use visible map area", exact: true }).click();
  await expect(page.getByTestId("build-network")).toBeEnabled();
  await page.getByText("Edit bounding coordinates", { exact: true }).click();
  const initial = Number(await page.getByLabel("south", { exact: true }).inputValue());
  // A freshly drawn smaller crop puts all four handles well inside the viewport.
  await page.getByRole("button", { name: "Select area on map", exact: true }).click();
  const map = page.locator(".real-map");
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.3, y: box.height * 0.3 } });
  await map.click({ position: { x: box.width * 0.65, y: box.height * 0.65 } });
  const corners = page.getByTitle("Drag corner to resize area", { exact: true });
  await expect(corners).toHaveCount(4);
  const before = await page.getByLabel("south", { exact: true }).inputValue();
  const handle = (await corners.first().boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 25, handle.y + handle.height / 2 - 25, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(page.getByLabel("south", { exact: true })).not.toHaveValue(before);
  expect(Number(before)).not.toBe(initial);
  expect(requests).toHaveLength(0);
  const expectedSouth = Number(await page.getByLabel("south", { exact: true }).inputValue());
  await page.getByTestId("build-network").click();
  await expect(page.getByTestId("network-summary")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].south).toBe(expectedSouth);
  await expect(page.getByTestId("impact-cue")).toContainText("Choose a road, close it");
});

test("closing a map road shows the consequence beside the map and identifies redirected flow", async ({
  page,
}) => {
  await page.route("**/api/osm/network", (route) =>
    route.fulfill({ json: { snapshot, cached: false } }),
  );
  await page.goto("/real-city");
  await page.getByRole("button", { name: "Use visible map area", exact: true }).click();
  await page.getByTestId("build-network").click();
  await expect(page.getByTestId("impact-cue")).toBeVisible();
  await expect(page.getByRole("button", { name: "See what changed ↓", exact: true })).toHaveCount(
    0,
  );
  await page.locator(".road-osm-way-102-0").click({ force: true });
  await expect(page.getByRole("button", { name: "Simulate closure", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Simulate closure", exact: true }).click();
  const cue = page.getByTestId("impact-cue");
  await expect(cue).toContainText("WHAT CHANGED AFTER THE CLOSURE?");
  await expect(cue).toContainText("modeled routes changed");
  await expect(cue).toContainText("from baseline");
  await expect(page.locator(".closed-edge")).toHaveCount(1);
  await page.getByRole("button", { name: "See what changed ↓", exact: true }).click();
  await expect(cue).toBeFocused();
  await expect
    .poll(async () => {
      const position = await cue.boundingBox();
      return position !== null && position.y >= 0 && position.y < 120;
    })
    .toBe(true);
  await cue.getByRole("button", { name: /Show the road taking the most extra traffic/ }).click();
  await expect(page.getByRole("button", { name: "Simulate closure", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "何が変わったかを見る ↓", exact: true }).click();
  await expect(cue).toBeFocused();
  await expect(cue).not.toContainText("WHAT CHANGED AFTER THE CLOSURE?");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  await page.getByRole("button", { name: "閉鎖をリセット", exact: true }).click();
  await expect(page.locator(".closed-edge")).toHaveCount(0);
  await expect(page.getByTestId("value-resilienceScore")).toHaveText("100");
  await expect(
    page.getByRole("button", { name: "何が変わったかを見る ↓", exact: true }),
  ).toHaveCount(0);
});

test("a failed build brings the actionable error into view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/osm/network", (route) =>
    route.fulfill({ status: 504, json: { error: "TIMEOUT" } }),
  );
  await page.goto("/real-city");
  await page.getByRole("button", { name: "Use visible map area", exact: true }).click();
  await page.getByTestId("build-network").click();
  const error = page.locator("#real-city-operation-error");
  await expect(error).toBeFocused();
  await expect(error).toContainText("timed out");
  await expect(error).toBeInViewport();
  await expect(
    error.getByRole("button", { name: "Shrink selected area", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("network-summary")).toHaveCount(0);
});

test("a wider valid area remains intact and discloses its regional road profile", async ({
  page,
}) => {
  const wide = { south: 35, west: 139, north: 35.07, east: 139.08 };
  const regional = buildRealCityNetwork(fixture, wide, "2026-10-10T00:00:00Z");
  let submitted: typeof bbox | undefined;
  await page.route("**/api/osm/network", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { snapshot: regional, cached: false } });
  });
  await page.goto("/real-city");
  await page.getByText("Edit bounding coordinates", { exact: true }).click();
  for (const [key, value] of Object.entries(wide))
    await page.getByLabel(key, { exact: true }).fill(String(value));
  await expect(page.getByTestId("build-network")).toBeEnabled();
  await page.getByTestId("build-network").click();
  await expect(page.getByTestId("network-summary")).toContainText("Regional view · major roads");
  expect(submitted).toEqual(wide);
  await expect(page.getByTestId("network-summary")).toContainText(
    "Local residential streets are excluded",
  );
});
