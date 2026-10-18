import { expect, test } from "@playwright/test";
import fixture from "../fixtures/osm-small.json";
import { buildRealCityNetwork } from "../../lib/osm/network-builder";

const snapshot = buildRealCityNetwork(
  fixture,
  {
    south: 35,
    west: 139,
    north: 35.02,
    east: 139.02,
  },
  "2026-10-10T00:00:00Z",
);

test.beforeEach(async ({ page }) => {
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/analysis/real-city", (route) =>
    route.fulfill({ json: { source: "local", useBrowserEvidence: true } }),
  );
});

test("regional data stays in-app and downloads only after the size preview is confirmed", async ({
  page,
}) => {
  let preflights = 0;
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/osm/region", (route) => {
    preflights++;
    return route.fulfill({
      json: {
        region: {
          id: "test-region",
          name: "Test regional source",
          bytes: 9000000,
          cached: false,
          available: true,
          maxBytes: 600 * 1024 * 1024,
        },
      },
    });
  });
  await page.route("**/api/osm/network", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "progress",
            stage: "downloading",
            profile: "detailed",
            bytesReceived: 9000000,
            totalBytes: 9000000,
          },
          { type: "progress", stage: "building", profile: "detailed" },
          { type: "result", snapshot, cached: false },
        ]
          .map((event) => JSON.stringify(event))
          .join("\n") + "\n",
    });
  });
  await page.goto("/real-city");
  await page.getByRole("button", { name: "Use visible map area", exact: true }).click();
  const panel = page.getByTestId("regional-data-panel");
  await panel.getByRole("button", { name: "Check region and download size", exact: true }).click();
  await expect(page.getByTestId("regional-download-preview")).toContainText("9.0 MB");
  expect(preflights).toBe(1);
  expect(requests).toHaveLength(0);
  await panel
    .getByRole("button", { name: "Download regional data and build", exact: true })
    .click();
  await expect(page.getByTestId("impact-cue")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ source: "regional-extract", regionId: "test-region" });
  expect(page.context().pages()).toHaveLength(1);
});

test("oversized regional downloads are rejected without a network build", async ({ page }) => {
  let builds = 0;
  await page.route("**/api/osm/region", (route) =>
    route.fulfill({
      json: {
        region: {
          id: "large-region",
          name: "Large regional source",
          bytes: 800000000,
          cached: false,
          available: false,
          maxBytes: 600 * 1024 * 1024,
        },
      },
    }),
  );
  await page.route("**/api/osm/network", (route) => {
    builds++;
    return route.abort();
  });
  await page.goto("/real-city");
  await page.getByRole("button", { name: "Use visible map area", exact: true }).click();
  await page.getByRole("button", { name: "Check region and download size", exact: true }).click();
  await expect(page.getByTestId("regional-download-preview")).toContainText("exceeds");
  await expect(
    page.getByRole("button", { name: "Download regional data and build", exact: true }),
  ).toBeDisabled();
  expect(builds).toBe(0);
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.getByTestId("regional-download-preview")).not.toContainText("exceeds");
});
