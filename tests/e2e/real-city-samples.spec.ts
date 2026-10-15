import { expect, test } from "@playwright/test";
for (const city of ["okayama", "matsumoto"]) {
  test(`${city}: actual OSM snapshot, closure, recovery and localized mobile layout`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.route("**/api/osm/network", (route) => route.abort());
    await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
    await page.goto("/real-city");
    await page.getByLabel("Load a saved OSM example (no API)").selectOption(city);
    await expect(page.locator(".screening-note")).toContainText("35 candidate", { timeout: 30000 });
    await expect(page.getByTestId("network-summary")).toContainText("Saved actual OSM sample");
    await page.locator(".ranking-row").first().click();
    await expect(page.getByTestId("real-inspector")).toBeVisible();
    const before = await page.getByTestId("value-resilienceScore").innerText();
    await page.getByRole("button", { name: "Simulate closure", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen road", exact: true })).toBeEnabled({
      timeout: 30000,
    });
    expect(Number(await page.getByTestId("value-resilienceScore").innerText())).toBeLessThan(
      Number(before),
    );
    await expect(page.getByTestId("ai-summary")).toContainText("1 real-road");
    await expect(page.locator("#recovery-analysis")).toContainText("HIGHEST-IMPACT RECOVERY");
    await page.getByRole("button", { name: "日本語", exact: true }).click();
    await expect(page.getByTestId("ai-summary")).toContainText("実道路");
    await expect(page.locator(".screening-note")).toContainText("35候補");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
    await page.getByRole("button", { name: "閉鎖をリセット", exact: true }).click();
    await expect(page.getByTestId("value-resilienceScore")).toHaveText("100", { timeout: 30000 });
    await expect(page.locator(".closed-edge")).toHaveCount(0);
    expect(failures).toEqual([]);
  });
}
