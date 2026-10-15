// Actual Chromium interactions with the production app; only a visible cursor is added.
// No simulation metric, ranking, map path, label, or app layout is injected or replaced.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve("video/assets/recordings");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const clips = only ? JSON.parse(await readFile("video/assets/recordings.json", "utf8")) : {};
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = process.env.RESILIROUTE_URL ?? "http://127.0.0.1:3001";

async function moveTo(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Recording target is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 38 });
  await sleep(380);
}
async function click(page, locator) {
  await moveTo(page, locator);
  await locator.click();
}
async function scrollTo(page, selector, margin = 32) {
  await page.locator(selector).evaluate(
    (el, offset) =>
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - offset,
        behavior: "smooth",
      }),
    margin,
  );
  await sleep(850);
}
async function record(id, seconds, prepare, actions) {
  if (only && only !== id) return;
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: directory, size: { width: 1920, height: 1080 } },
  });
  await context.addInitScript(() => {
    localStorage.setItem("resiliroute-language", "en");
    addEventListener("DOMContentLoaded", () => {
      const cursor = document.createElement("div");
      cursor.id = "recording-cursor";
      cursor.style.cssText =
        "position:fixed;width:22px;height:28px;pointer-events:none;z-index:2147483647;left:1700px;top:100px;filter:drop-shadow(0 2px 2px #0006);transition:left .2s linear,top .2s linear;";
      cursor.innerHTML =
        '<svg viewBox="0 0 22 28" width="22" height="28"><path d="M2 2v21l5-5 5 8 4-2-5-8 8-1z" fill="white" stroke="#102a39" stroke-width="1.5"/></svg>';
      document.body.append(cursor);
      addEventListener("mousemove", (e) => {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
      });
      addEventListener("mousedown", () => {
        const ring = document.createElement("div");
        ring.style.cssText =
          "position:absolute;left:-16px;top:-15px;width:46px;height:46px;border:3px solid #c85c35;border-radius:50%;background:#c85c3518";
        cursor.append(ring);
        ring.animate(
          [
            { transform: "scale(.65)", opacity: 1 },
            { transform: "scale(1.6)", opacity: 0 },
          ],
          { duration: 650 },
        ).onfinish = () => ring.remove();
      });
    });
  });
  const started = Date.now();
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push({ clip: id, error: err.message }));
  await page.goto(url);
  await page.locator(".leaflet-container").waitFor();
  await page.getByTestId("ai-summary").waitFor();
  await page
    .locator(".leaflet-tile-loaded")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  await prepare(page);
  await sleep(1000);
  const clipStart = Date.now();
  const trim = (clipStart - started) / 1000;
  const crop = await page.evaluate(() => {
    const main = document.querySelector("main").getBoundingClientRect();
    return { x: Math.round(main.x + 26), width: Math.round(main.width - 52) };
  });
  await page.screenshot({ path: `video/assets/stills/${id}.png` });
  console.info(`Recording ${id}: ${seconds}s, trim ${trim.toFixed(2)}s`);
  await actions(page);
  const remaining = seconds * 1000 - (Date.now() - clipStart);
  if (remaining > 0) await sleep(remaining);
  await sleep(700);
  const video = page.video();
  await context.close();
  await video.saveAs(resolve(directory, `${id}.webm`));
  await video.delete();
  clips[id] = { path: `assets/recordings/${id}.webm`, trim, duration: seconds, ...crop };
  await writeFile("video/assets/recordings.json", JSON.stringify(clips, null, 2));
}

const earthquake = async (page) => {
  await page.getByTestId("scenario-earthquake").click();
  await page.getByTestId("value-averageTravelTime").filter({ hasText: "20.9" }).waitFor();
};
try {
  await record(
    "hook",
    14,
    async (page) => {
      await page.getByLabel("Inspect network link").selectOption("harbor-bridge");
      await scrollTo(page, "#network-workspace", 45);
    },
    async (page) => {
      await sleep(5300);
      await click(page, page.getByRole("button", { name: "Close link", exact: true }));
      await sleep(4000);
      await page.mouse.move(1180, 700, { steps: 30 });
    },
  );
  await record(
    "normal",
    25,
    async (page) => {
      await scrollTo(page, ".metric-grid", 22);
    },
    async (page) => {
      await sleep(5200);
      await moveTo(page, page.locator(".map-wrapper"));
      await sleep(4500);
      await page.getByLabel("Inspect network link").selectOption("harbor-bridge");
      await sleep(4500);
      await page.getByRole("button", { name: "Deselect link" }).click();
      await sleep(4500);
      await page.mouse.move(1050, 770, { steps: 30 });
    },
  );
  await record(
    "earthquake",
    31,
    async (page) => {
      await page.locator(".logo-link").click();
    },
    async (page) => {
      await sleep(1000);
      await click(page, page.getByTestId("run-demo"));
      await sleep(6500);
      await page.getByTestId("value-averageTravelTime").filter({ hasText: "20.9" }).waitFor();
      await scrollTo(page, ".metric-grid", 22);
      await sleep(9500);
      await page.mouse.move(1055, 640, { steps: 30 });
    },
  );
  await record(
    "cascade",
    24,
    async (page) => {
      await earthquake(page);
      await page.getByLabel("Inspect network link").selectOption("port-bypass");
      await scrollTo(page, "#network-workspace", 28);
    },
    async (page) => {
      await sleep(8500);
      await click(page, page.getByRole("button", { name: "Deselect link" }));
      await sleep(1000);
      await click(page, page.getByRole("button", { name: "Route overlay", exact: true }));
      await sleep(4000);
      await moveTo(page, page.getByTestId("route-time"));
    },
  );
  await record(
    "analytics",
    23,
    async (page) => {
      await earthquake(page);
      await scrollTo(page, "#impact-dashboard", 32);
    },
    async (page) => {
      await sleep(6500);
      await page.mouse.move(1110, 285, { steps: 30 });
      await sleep(4800);
      await click(page, page.getByText("View district travel time & isolation", { exact: true }));
      await sleep(2500);
      await page.mouse.move(1100, 80, { steps: 30 });
    },
  );
  await record(
    "critical",
    23,
    async (page) => {
      await earthquake(page);
      await scrollTo(page, ".analysis-grid", 42);
    },
    async (page) => {
      await sleep(1500);
      await click(
        page,
        page.getByRole("button", { name: "Analyze all available links", exact: true }),
      );
      await sleep(5200);
      await click(page, page.getByRole("button", { name: /Inspect Harbor Rail, criticality/ }));
      await sleep(4600);
      await scrollTo(page, ".analysis-grid", 42);
      await sleep(2500);
      await moveTo(page, page.getByRole("button", { name: "Restore Harbor Bridge", exact: true }));
    },
  );
  await record(
    "equity",
    20,
    async (page) => {
      await earthquake(page);
      await page.getByText("View district travel time & isolation", { exact: true }).click();
      await scrollTo(page, ".district-insight", 42);
    },
    async (page) => {
      await sleep(7800);
      await scrollTo(page, ".services-panel", 42);
      await sleep(4300);
      await page.mouse.move(1285, 235, { steps: 30 });
    },
  );
  await record(
    "ai",
    23,
    async (page) => {
      await earthquake(page);
      await scrollTo(page, "#ai-brief", 28);
    },
    async (page) => {
      await sleep(5600);
      await page.mouse.move(1110, 345, { steps: 30 });
      await sleep(5000);
      await page.mouse.move(1080, 580, { steps: 30 });
      await sleep(3500);
      await moveTo(page, page.locator(".ai-limitations"));
    },
  );
  await writeFile(
    "video/assets/recording-qa.json",
    JSON.stringify(
      {
        errors,
        resolution: "1920x1080",
        deviceScaleFactor: 1,
        language: "en",
        source: url,
        cursor: "Actual mouse positions with a capture-visible SVG cursor",
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error("Recorded app had page errors");
  console.info("All actual app recordings complete. No page errors.");
} finally {
  await browser.close();
}
