// Actual production UI footage. Only a visible pointer and click ring are added.
// No network response, result, road geometry, ranking or product label is injected.
import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("video/creator-colosseum");
const evidence = JSON.parse(await readFile(`${root}/assets/evidence.json`, "utf8"));
const snapshot = JSON.parse(
  (await readFile(`${root}/assets/network.json`, "utf8")).replace(/^\uFEFF/, ""),
);
const url = process.env.RESILIROUTE_URL ?? "http://127.0.0.1:3001";
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const clips = only ? JSON.parse(await readFile(`${root}/assets/recordings.json`, "utf8")) : {};
const errors = [];
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
await mkdir(`${root}/assets/recordings`, { recursive: true });
await mkdir(`${root}/assets/stills`, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: `${root}/assets/recordings`, size: { width: 1920, height: 1080 } },
});
await context.addInitScript(() => {
  localStorage.setItem("resiliroute-language", "en");
  addEventListener("DOMContentLoaded", () => {
    const pointer = document.createElement("div");
    pointer.style.cssText =
      "position:fixed;left:1750px;top:80px;pointer-events:none;z-index:2147483647;filter:drop-shadow(0 2px 2px #0005)";
    pointer.innerHTML =
      '<svg viewBox="0 0 22 28" width="22" height="28"><path d="M2 2v21l5-5 5 8 4-2-5-8 8-1z" fill="white" stroke="#102a39" stroke-width="1.5"/></svg>';
    document.body.append(pointer);
    addEventListener("mousemove", (e) => {
      pointer.style.left = e.clientX + "px";
      pointer.style.top = e.clientY + "px";
    });
    addEventListener("mousedown", () => {
      const ring = document.createElement("div");
      ring.style.cssText =
        "position:absolute;left:-16px;top:-15px;width:46px;height:46px;border:3px solid #c85c35;border-radius:50%;background:#c85c3518";
      pointer.append(ring);
      ring.animate(
        [
          { transform: "scale(.6)", opacity: 1 },
          { transform: "scale(1.6)", opacity: 0 },
        ],
        { duration: 600 },
      ).onfinish = () => ring.remove();
    });
  });
});
let cursor = { x: 1750, y: 80 };
async function move(page, x, y) {
  const from = { ...cursor };
  for (let i = 1; i <= 25; i++) {
    const t = i / 25;
    await page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
    await sleep(15);
  }
  cursor = { x, y };
}
async function point(page, loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error("Missing filming target");
  await move(page, b.x + b.width / 2, b.y + b.height / 2);
  await sleep(250);
}
async function click(page, loc) {
  await point(page, loc);
  await loc.click();
}
async function scroll(page, selector, margin = 40) {
  await page
    .locator(selector)
    .evaluate(
      (el, m) =>
        window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - m, behavior: "smooth" }),
      margin,
    );
  await sleep(1000);
}
async function settled(page) {
  await expect(page.locator(".screening-note")).toContainText("35 candidate", { timeout: 60000 });
  await expect(
    page.getByRole("button", { name: "Analyze candidate links", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
}
async function imported(page, closed = []) {
  await page.getByLabel("Import Snapshot", { exact: true }).setInputFiles({
    name: "okayama-osm-2026-10-11.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  await settled(page);
  for (const id of closed) {
    await page.getByLabel("Inspect real road", { exact: true }).selectOption(id);
    await page.getByRole("button", { name: "Simulate closure", exact: true }).click();
    await settled(page);
  }
}
async function closeSelected(page) {
  await click(page, page.getByRole("button", { name: "Simulate closure", exact: true }));
  await settled(page);
}
async function route(page) {
  const r = evidence.routes[0];
  await page.getByLabel("Origin", { exact: true }).selectOption(r.od.origin);
  await page.getByLabel("Destination", { exact: true }).selectOption(r.od.destination);
  await expect(page.getByTestId("real-route-time")).toContainText(
    evidence.routes[0].after.travelTime.toFixed(1),
  );
  const before = evidence.routes[0].before.travelTime.toFixed(1);
  const after = evidence.routes[0].after.travelTime.toFixed(1);
  const text = await page.getByTestId("real-route-time").innerText();
  expect(text).toContain(`Baseline: ${before} min`);
  expect(text).toContain(`Scenario: ${after} min`);
  await writeFile(
    `${root}/assets/route-ui-proof.json`,
    JSON.stringify({ origin: r.od.origin, destination: r.od.destination, text }, null, 2),
  );
}
async function record(id, seconds, prepare, actions, home = false) {
  if (only && only !== id) return;
  const page = await context.newPage();
  cursor = { x: 1750, y: 80 };
  const started = performance.now();
  page.on("pageerror", (e) => errors.push({ clip: id, error: e.message }));
  await page.goto(home ? url : `${url}/real-city`);
  await page.locator(".leaflet-container").waitFor();
  await prepare(page);
  await page
    .locator(".leaflet-tile-loaded")
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  await sleep(700);
  const trim = (performance.now() - started) / 1000;
  const begin = performance.now();
  const main = await page.locator("main").boundingBox();
  await page.screenshot({ path: `${root}/assets/stills/${id}.png` });
  console.info(`Recording ${id}, ${seconds}s`);
  await actions(page);
  await sleep(Math.max(0, seconds * 1000 - (performance.now() - begin)));
  await page.screenshot({ path: `${root}/assets/stills/${id}-end.png` });
  const actual = (performance.now() - begin) / 1000;
  await sleep(500);
  const video = page.video();
  await page.close();
  await video.saveAs(`${root}/assets/recordings/${id}.webm`);
  await video.delete();
  clips[id] = {
    path: `assets/recordings/${id}.webm`,
    trim,
    duration: actual,
    x: Math.round(main.x),
    width: Math.round(main.width),
  };
  await writeFile(`${root}/assets/recordings.json`, JSON.stringify(clips, null, 2));
}
try {
  await record(
    "hook",
    25,
    async (p) => {
      await imported(p);
      await p.getByLabel("Inspect real road").selectOption(evidence.closed.id);
      await scroll(p, ".real-controls", 25);
    },
    async (p) => {
      await sleep(7000);
      await closeSelected(p);
      await scroll(p, ".real-kpi-strip", 25);
    },
  );
  await record(
    "problem-map",
    18,
    async (p) => {
      await imported(p, [evidence.closed.id]);
      await route(p);
      await scroll(p, ".real-controls", 25);
    },
    async (p) => {
      await sleep(5500);
      await click(p, p.getByLabel("Route overlay", { exact: true }));
      await sleep(3000);
      await click(p, p.getByLabel("Route overlay", { exact: true }));
    },
  );
  await record(
    "harbor",
    12,
    async (p) => {
      await p.getByTestId("ai-summary").waitFor();
      await scroll(p, "#network-workspace", 32);
    },
    async (p) => {
      await point(p, p.getByTestId("run-demo"));
      await sleep(1500);
      await click(p, p.getByTestId("run-demo"));
    },
    true,
  );
  await record(
    "welcome",
    13,
    async () => {},
    async (p) => {
      await point(p, p.getByRole("button", { name: "Select area on map", exact: true }));
    },
  );
  await record(
    "select",
    16,
    async (p) => {
      await p.getByLabel("Try an example area").selectOption("0");
      await scroll(p, "#real-workspace", 20);
    },
    async (p) => {
      await click(p, p.getByRole("button", { name: "Select area on map", exact: true }));
      const b = await p.locator(".real-map").boundingBox();
      await move(p, b.x + b.width * 0.29, b.y + b.height * 0.24);
      await p.mouse.click(cursor.x, cursor.y);
      await sleep(2000);
      await move(p, b.x + b.width * 0.73, b.y + b.height * 0.8);
      await p.mouse.click(cursor.x, cursor.y);
      await sleep(1500);
      // Demonstrate both supported selection methods; the following shot builds the named example.
      await point(p, p.getByLabel("Try an example area"));
      await p.getByLabel("Try an example area").selectOption("0");
    },
  );
  await record(
    "build",
    26,
    async (p) => {
      await p.getByLabel("Try an example area").selectOption("0");
      await scroll(p, "#real-workspace", 20);
    },
    async (p) => {
      const response = p.waitForResponse(
        (r) => r.url().endsWith("/api/osm/network") && r.request().method() === "POST",
      );
      await click(p, p.getByTestId("build-network"));
      const body = await (await response).json();
      if (!body.snapshot) throw new Error("Live OSM import did not succeed");
      // Public API data must match the evidence; no response is intercepted or mocked.
      expect(body.snapshot.network).toEqual(snapshot.network);
      expect(body.snapshot.odPairs).toEqual(snapshot.odPairs);
      await settled(p);
      await scroll(p, "#real-workspace", 25);
      await sleep(1500);
      await scroll(p, ".real-kpi-strip", 25);
      await writeFile(
        `${root}/assets/live-build-proof.json`,
        JSON.stringify(
          {
            success: true,
            cached: body.cached,
            createdAt: body.snapshot.createdAt,
            stats: body.snapshot.stats,
          },
          null,
          2,
        ),
      );
    },
  );
  await record(
    "closure",
    21,
    async (p) => {
      await imported(p);
      await scroll(p, ".real-controls", 25);
    },
    async (p) => {
      const road = p.locator(`.road-${evidence.closed.id}`);
      await point(p, road);
      await road.click({ force: true });
      await expect(p.getByTestId("real-inspector")).toContainText(evidence.closed.name);
      await sleep(2000);
      await closeSelected(p);
      await scroll(p, ".real-kpi-strip", 25);
      await expect(p.getByTestId("value-averageTravelTime")).toHaveText(
        evidence.current.averageTravelTime.toFixed(1),
      );
    },
  );
  await record(
    "reroute",
    16,
    async (p) => {
      await imported(p, [evidence.closed.id]);
      await route(p);
      await scroll(p, ".real-controls", 25);
    },
    async (p) => {
      await point(p, p.getByTestId("real-route-time"));
      await sleep(4000);
      await point(p, p.locator(`.road-${evidence.closed.id}`));
    },
  );
  await record(
    "flow",
    12,
    async (p) => {
      await imported(p, [evidence.closed.id]);
      await p.getByLabel("Inspect real road").selectOption(evidence.flows[0].id);
      await scroll(p, ".real-controls", 25);
    },
    async (p) => {
      await point(p, p.getByTestId("real-inspector"));
      await sleep(2500);
      await scroll(p, ".real-impact", 25);
    },
  );
  await record(
    "critical",
    16,
    async (p) => {
      await imported(p, [evidence.closed.id]);
      await scroll(p, ".real-analysis", 25);
    },
    async (p) => {
      await point(p, p.locator(".ranking-row").first());
      await sleep(3500);
      await click(p, p.locator(".ranking-row").first());
    },
  );
  await record(
    "recovery",
    25,
    async (p) => {
      await imported(p, [evidence.closed.id]);
      await p.getByLabel("Inspect real road").selectOption(evidence.secondary.id);
      await scroll(p, ".real-controls", 25);
    },
    async (p) => {
      await closeSelected(p);
      await scroll(p, ".real-analysis", 25);
      await sleep(3500);
      await expect(p.getByTestId("value-resilienceScore")).toHaveText(
        evidence.multiple.resilienceScore.toFixed(0),
      );
      await point(p, p.locator(".best-recovery .button"));
      await sleep(1800);
      await click(p, p.locator(".best-recovery .button"));
      await settled(p);
      await scroll(p, ".real-kpi-strip", 25);
    },
  );
  await record(
    "methodology",
    13,
    async (p) => {
      await imported(p);
      await p.getByRole("button", { name: "Methodology", exact: true }).click();
    },
    async (p) => {
      await point(p, p.getByRole("dialog"));
      await sleep(4000);
      await p.getByRole("dialog").evaluate((el) => el.scrollBy({ top: 350, behavior: "smooth" }));
    },
  );
  await record(
    "ai",
    15,
    async (p) => {
      await imported(p, [evidence.closed.id, evidence.secondary.id]);
      await scroll(p, "#ai-brief", 25);
    },
    async (p) => {
      await point(p, p.getByTestId("ai-summary"));
      await sleep(5500);
      await scroll(p, ".recommendations", 110);
    },
  );
  await record(
    "assumptions",
    12,
    async (p) => {
      await imported(p);
      await scroll(p, ".provenance-panel", 25);
    },
    async (p) => {
      await point(p, p.locator(".coverage-grid"));
    },
  );
  await record(
    "snapshot",
    11,
    async (p) => {
      await imported(p);
      await scroll(p, "#real-workspace", 25);
    },
    async (p) => {
      const dl = p.waitForEvent("download");
      await click(p, p.getByRole("button", { name: "Export Network Snapshot", exact: true }));
      await (await dl).saveAs(`${root}/assets/exported-network.json`);
    },
  );
  await record(
    "bilingual",
    12,
    async (p) => {
      await imported(p, [evidence.closed.id]);
      await scroll(p, ".real-kpi-strip", 25);
    },
    async (p) => {
      await click(p, p.getByRole("button", { name: "日本語", exact: true }));
      await sleep(3500);
      await click(p, p.getByRole("button", { name: "English", exact: true }));
    },
  );
  await record(
    "closing",
    12,
    async (p) => {
      await imported(p, [evidence.closed.id]);
      await scroll(p, ".real-kpi-strip", 25);
    },
    async (p) => {
      await point(p, p.locator(".real-map"));
    },
  );
} finally {
  await context.close();
  await browser.close();
  await writeFile(`${root}/assets/recording-errors.json`, JSON.stringify(errors, null, 2));
}
if (errors.length) throw new Error(`Recording had ${errors.length} browser errors`);
console.info("Actual product capture complete. No browser errors.");
