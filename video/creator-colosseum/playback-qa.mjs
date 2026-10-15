import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve("video/creator-colosseum");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(
    pathToFileURL(`${root}/deliverables/final-creator-colosseum-resiliroute.mp4`).href,
  );
  await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
  const meta = await page.evaluate(() => {
    const v = document.querySelector("video");
    v.pause();
    v.muted = true;
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
  });
  assert.equal(meta.duration, 294);
  assert.equal(meta.width, 1920);
  assert.equal(meta.height, 1080);
  const checks = [];
  for (const start of [112, 172, 215]) {
    await page.evaluate(async (t) => {
      const v = document.querySelector("video");
      await new Promise((done) => {
        v.addEventListener("seeked", done, { once: true });
        v.currentTime = t;
      });
      await v.play();
    }, start);
    const before = await page.evaluate(() => {
      const q = document.querySelector("video").getVideoPlaybackQuality();
      return { total: q.totalVideoFrames, dropped: q.droppedVideoFrames };
    });
    await page.waitForTimeout(6200);
    const after = await page.evaluate(() => {
      const v = document.querySelector("video"),
        q = v.getVideoPlaybackQuality();
      v.pause();
      return {
        time: v.currentTime,
        total: q.totalVideoFrames,
        dropped: q.droppedVideoFrames,
        error: v.error?.message ?? null,
      };
    });
    assert.equal(after.error, null);
    assert.ok(after.time >= start + 6);
    assert.ok(after.total - before.total >= 150);
    assert.equal(after.dropped - before.dropped, 0);
    checks.push({
      start,
      end: after.time,
      decoded: after.total - before.total,
      dropped: after.dropped - before.dropped,
      error: after.error,
    });
  }
  const result = { ...meta, browser: "Chromium", checks, testedAt: new Date().toISOString() };
  await writeFile(`${root}/deliverables/PLAYBACK_QA.json`, JSON.stringify(result, null, 2) + "\n");
  const qa = JSON.parse(await readFile(`${root}/deliverables/VIDEO_QA.json`, "utf8"));
  qa.chromiumPlayback = result;
  await writeFile(`${root}/deliverables/VIDEO_QA.json`, JSON.stringify(qa, null, 2) + "\n");
  console.info(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
