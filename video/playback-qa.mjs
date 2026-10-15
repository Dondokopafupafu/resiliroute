// Test the exported file in Chromium's actual H.264 media decoder.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(
    pathToFileURL(resolve("video/deliverables/final-impacthack-resiliroute.mp4")).href,
  );
  await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
  const metadata = await page.evaluate(() => {
    const video = document.querySelector("video");
    video.pause();
    video.muted = true;
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  });
  assert.equal(metadata.duration, 230);
  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  await page.evaluate(async () => {
    const video = document.querySelector("video");
    await new Promise((resolve) => {
      video.addEventListener("seeked", resolve, { once: true });
      video.currentTime = 190;
    });
    await video.play();
  });
  const before = await page.evaluate(() => {
    const quality = document.querySelector("video").getVideoPlaybackQuality();
    return {
      totalVideoFrames: quality.totalVideoFrames,
      droppedVideoFrames: quality.droppedVideoFrames,
    };
  });
  await page.waitForTimeout(6200);
  const playback = await page.evaluate(() => {
    const video = document.querySelector("video");
    const quality = video.getVideoPlaybackQuality();
    video.pause();
    return {
      currentTime: video.currentTime,
      readyState: video.readyState,
      error: video.error?.message ?? null,
      totalVideoFrames: quality.totalVideoFrames,
      droppedVideoFrames: quality.droppedVideoFrames,
    };
  });
  assert.equal(playback.error, null);
  assert.ok(playback.currentTime >= 196);
  assert.ok(playback.totalVideoFrames - before.totalVideoFrames >= 150);
  const result = {
    ...metadata,
    ...playback,
    playbackSegment: "3:10–3:16",
    browser: "Chromium",
    testedAt: new Date().toISOString(),
  };
  await writeFile("video/deliverables/PLAYBACK_QA.json", JSON.stringify(result, null, 2));
  const qaPath = "video/deliverables/VIDEO_QA.json";
  const qa = JSON.parse(await readFile(qaPath, "utf8"));
  qa.chromiumPlayback = result;
  await writeFile(qaPath, JSON.stringify(qa, null, 2));
  console.info(result);
} finally {
  await browser.close();
}
