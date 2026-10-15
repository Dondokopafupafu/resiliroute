import { expect, test } from "@playwright/test";

test("earthquake demo updates real KPIs, map, charts and grounded brief; reset works", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const browserAnalysisResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/analysis") && response.request().method() === "POST",
  );
  await page.goto("/");
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("14.2");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  expect((await browserAnalysisResponse).status()).toBe(200);
  await page.getByTestId("run-demo").click();
  await expect(page.getByText("DEMO COMPLETE", { exact: true })).toBeVisible();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("20.9");
  await expect(page.getByTestId("value-accessibility")).toHaveText("78.9");
  await expect(page.getByTestId("value-resilienceScore")).toHaveText("69");
  await expect(page.locator(".closed-edge")).toHaveCount(3);
  // Flow animation must preserve the dotted rail pattern from the map legend.
  const railDash = await page
    .locator('.network-edge[stroke-dasharray="3 5"]')
    .first()
    .evaluate((element) => getComputedStyle(element).strokeDasharray);
  expect(railDash).toMatch(/3(?:px)?[, ]+5(?:px)?/);
  await expect(
    page.getByRole("button", { name: "Restore Harbor Bridge", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("ai-summary")).toContainText("14.2 to 20.9");
  await expect(page.locator(".chart .recharts-wrapper > svg.recharts-surface")).toHaveCount(2);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("14.2");
  await expect(page.locator(".closed-edge")).toHaveCount(0);
});

test("custom closures, route explorer and recovery change the model", async ({ page }) => {
  await page.goto("/");
  await page.locator(".network-edge").first().click();
  await expect(page.getByTestId("selected-link")).toContainText("North Avenue");
  await page.getByRole("button", { name: "General Hospital · hospital", exact: true }).click();
  await expect(page.locator(".leaflet-popup-content")).toContainText("Nearest hospital");
  await page.locator(".leaflet-popup-close-button").click();
  await page.getByLabel("Inspect network link").selectOption("harbor-bridge");
  await expect(page.getByTestId("selected-link")).toContainText("Harbor Bridge");
  await page.getByRole("button", { name: "Close link", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).not.toHaveText("14.2");
  await expect(page.getByTestId("scenario-custom")).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Origin", { exact: true }).selectOption("east-home");
  await page.getByLabel("Destination", { exact: true }).selectOption("general-hospital");
  await expect(page.locator(".scenario-route")).toHaveCount(1);
  await expect(page.locator(".baseline-route")).toHaveCount(1);
  await page.getByRole("button", { name: "Restore Harbor Bridge", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("14.2");
  await page.getByLabel("Destination", { exact: true }).selectOption("east-home");
  await expect(page.getByTestId("route-time")).toHaveText(/^0\.0\s*min$/);
  await expect(page.getByText("Same location", { exact: true })).toBeVisible();
});

test("scenarios and next-link stress testing remain functional", async ({ page }) => {
  await page.goto("/");
  for (const [scenario, count] of [
    ["flood", 4],
    ["rail", 3],
    ["earthquake", 3],
  ] as const) {
    await page.getByTestId(`scenario-${scenario}`).click();
    await expect(page.locator(".closed-edge")).toHaveCount(count);
    await expect(page.getByTestId("value-resilienceScore")).not.toHaveText("100");
  }
  await expect(page.locator(".ranking-list")).toContainText("Harbor Rail");
  await page.getByRole("button", { name: "Analyze all available links", exact: true }).click();
  await expect(
    page.getByText("39 available links analyzed against the current scenario."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.locator(".closed-edge")).toHaveCount(0);
});

test("methodology dialog, export, mobile layout and offline map fallback work", async ({
  page,
}) => {
  await page.route("**/*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText("Basemap unavailable. The schematic network remains fully interactive."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Methodology", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Dijkstra");
  const modalBounds = await page.getByRole("dialog").boundingBox();
  expect(
    Math.abs(modalBounds!.x + modalBounds!.width / 2 - page.viewportSize()!.width / 2),
  ).toBeLessThan(2);
  await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export analysis", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("resiliroute-normal-analysis.json");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});

test("API validates link IDs and ignores forged client metrics", async ({ request, baseURL }) => {
  const result = await request.post("/api/analysis", {
    headers: { Origin: baseURL! },
    data: {
      scenarioId: "earthquake",
      closedEdgeIds: ["harbor-bridge", "east-rail", "coastal-road"],
      averageTravelTime: 9999,
    },
  });
  expect(result.status()).toBe(200);
  const body = await result.json();
  expect(["local", "openai"]).toContain(body.source);
  if (body.source === "local") expect(body.analysis.summary).toContain("14.2 to 20.9");
  expect(body.analysis.summary).not.toContain("9999");
  expect(
    (
      await request.post("/api/analysis", {
        data: { scenarioId: "earthquake", closedEdgeIds: ["unknown-link"] },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/analysis", { data: { scenarioId: "__proto__", closedEdgeIds: [] } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/analysis", {
        headers: { Origin: "https://unrelated.example" },
        data: { scenarioId: "normal", closedEdgeIds: [] },
      })
    ).status(),
  ).toBe(403);
});

test("isolated origins show an explicit unreachable state", async ({ page }) => {
  await page.goto("/");
  for (const id of ["east-avenue", "east-riverside", "community-road"]) {
    await page.getByLabel("Inspect network link").selectOption(id);
    await page.getByRole("button", { name: "Close link", exact: true }).click();
  }
  await expect(
    page.getByText("No route available under the current disruption scenario."),
  ).toBeVisible();
  await expect(page.getByTestId("ai-summary")).toContainText("3 link closures");
  await expect(page.locator(".map-footer")).toContainText("disconnected OD pairs");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("route-time")).toHaveText(/^26\.1\s*min$/);
});

test("demo can be skipped and reset without stale disruption timers", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("run-demo").click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("20.9");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByTestId("run-demo").click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  // A deliberate temporal assertion: the closure timer would fire by 1.85 s.
  await page.waitForTimeout(2200);
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("14.2");
  await expect(page.locator(".closed-edge")).toHaveCount(0);
});

test("language switch preserves scenarios and routes, localizes the full UI and persists across reloads", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByTestId("scenario-earthquake").click();
  await page.getByLabel("Origin", { exact: true }).selectOption("west-home");
  await page.getByLabel("Destination", { exact: true }).selectOption("airport");
  const time = (await page.getByTestId("route-time").innerText()).match(/[\d.]+/)![0];
  const japaneseResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/analysis") &&
      response.request().postDataJSON()?.locale === "ja",
  );
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("20.9");
  await expect(page.locator(".closed-edge")).toHaveCount(3);
  await expect(page.getByLabel("出発地", { exact: true })).toHaveValue("west-home");
  await expect(page.getByLabel("目的地", { exact: true })).toHaveValue("airport");
  await expect(page.getByTestId("route-time")).toContainText(time);
  await expect(page.getByTestId("selected-link")).toHaveCount(0);
  await expect(page.locator(".ranking-list")).toContainText("港鉄道線");
  await expect(page.locator(".node-label").filter({ hasText: "総合病院" })).toBeVisible();
  await expect(page.locator(".recharts-legend-wrapper").first()).toContainText("通常時");
  await expect(page.getByTestId("ai-summary")).toContainText("20.9分");
  expect((await japaneseResponse).status()).toBe(200);
  await page.getByRole("button", { name: "計算方法", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Dijkstra法");
  await expect(page.getByRole("dialog")).toContainText("実際の緊急時は公式情報");
  await page.getByRole("dialog").press("Escape");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("20.9");
  await expect(page.getByLabel("Origin", { exact: true })).toHaveValue("west-home");
  await expect(
    page.getByRole("button", { name: "Restore Harbor Bridge", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("ai-summary")).toContainText("14.2 to 20.9");
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByTestId("run-demo")).toContainText("地震デモを実行");
  await page.getByTestId("run-demo").click();
  await page.getByRole("button", { name: "スキップ", exact: true }).click();
  await expect(page.getByTestId("selected-link")).toContainText("ハーバー橋");
  await page.getByRole("button", { name: "ハーバー橋を復旧", exact: true }).click();
  await expect(page.locator(".closed-edge")).toHaveCount(2);
  await page.getByRole("button", { name: "リセット", exact: true }).click();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("14.2");
  await expect(page.getByRole("button", { name: "日本語", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  expect(errors).toEqual([]);
});

test("Japanese API analysis has a separate language cache and rejects unsupported locales", async ({
  request,
}) => {
  const data = {
    scenarioId: "earthquake",
    closedEdgeIds: ["harbor-bridge", "east-rail", "coastal-road"],
  };
  const japanese = await request.post("/api/analysis", { data: { ...data, locale: "ja" } });
  expect(japanese.status()).toBe(200);
  expect((await japanese.json()).analysis.summary).toMatch(/[ぁ-んァ-ヶ一-龯]/u);
  const english = await request.post("/api/analysis", { data: { ...data, locale: "en" } });
  expect(english.status()).toBe(200);
  expect((await english.json()).analysis.summary).not.toMatch(/[ぁ-んァ-ヶ一-龯]/u);
  expect(
    (await request.post("/api/analysis", { data: { ...data, locale: "invalid" } })).status(),
  ).toBe(400);
});

test("language switching works without browser storage and during an active demo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
  });
  await page.goto("/");
  await page.getByTestId("run-demo").click();
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByText("デモ完了", { exact: true })).toBeVisible();
  await expect(page.getByTestId("value-averageTravelTime")).toHaveText("20.9");
  await expect(page.getByTestId("ai-summary")).toContainText("20.9分");
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByRole("button", { name: "English", exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    .toBe(false);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("DEMO COMPLETE", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    .toBe(false);
});
