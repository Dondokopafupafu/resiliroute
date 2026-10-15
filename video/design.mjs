// Editable, native HTML/SVG title cards and diagrams. Product images are actual captures.
import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const project = JSON.parse(await readFile("video/project.json", "utf8"));
const report = JSON.parse(await readFile("video/assets/earthquake-results.json", "utf8"));
const logo = await readFile("public/favicon.svg", "utf8");
const frames = resolve("video/assets/frames");
await mkdir(frames, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const escape = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const format = (number, digits = 1) => number.toFixed(digits);
const style = `
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden}body{font-family:'Segoe UI',Arial,sans-serif;background:#102a39;color:#f3f8fa;-webkit-font-smoothing:antialiased}
.canvas{position:relative;width:1920px;height:1080px;background:#102a39}.texture{position:absolute;inset:0;background:linear-gradient(#e2f1f305 1px,transparent 1px),linear-gradient(90deg,#e2f1f305 1px,transparent 1px);background-size:88px 88px;opacity:.5}
.top{position:absolute;left:64px;right:64px;top:32px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:12px;font-size:23px;font-weight:650}.brand svg{width:34px;height:34px}.brand em{font-style:normal;color:#65bac3}.chapter{position:absolute;top:74px;left:64px;font-size:30px;letter-spacing:-.6px;font-weight:600}.eyebrow{font-size:15px;letter-spacing:2.4px;color:#8fadb9;text-transform:uppercase}.pill{font-size:13px;letter-spacing:1.4px;border:1px solid #54727e;padding:9px 14px;border-radius:5px;color:#9fc2ca}
.captions{position:absolute;top:888px;left:34px;right:34px;height:181px;background:#071823e8;border:1px solid #58747e40;border-radius:12px}.rule{position:absolute;bottom:0;left:0;width:1920px;height:4px;background:#087d89}.foot{position:absolute;top:863px;left:66px;font-size:13px;letter-spacing:.7px;color:#90abb7}
.side{position:absolute;top:193px;right:68px;width:340px}.side-label{font-size:15px;letter-spacing:2.2px;color:#92b3bf;margin-bottom:20px}.stat{padding:23px 0 27px;border-top:1px solid #78909b40}.stat-label{font-size:19px;color:#bfd1d8}.stat-value{font-size:60px;line-height:1.3;font-weight:600;letter-spacing:-2px}.stat-value small{font-size:25px;letter-spacing:0;color:#9ab6c3;font-weight:400}.stat-note{font-size:16px;color:#93b0bd;margin-top:4px;line-height:1.5}.teal{color:#7ac7d0}.orange{color:#df936c}.green{color:#89c5ac}.muted{color:#8ba7b4}.arrow{font-size:30px;font-weight:300;color:#819faa}.side h2{font-size:34px;margin:12px 0 30px;font-weight:550;line-height:1.2}.aside-copy{font-size:21px;line-height:1.55;color:#afc7d1}
.full-title{position:absolute;left:110px;top:151px;font-size:64px;letter-spacing:-2.5px;font-weight:600;line-height:1.15}.subtitle{font-size:28px;line-height:1.5;color:#a6c0cc;letter-spacing:0}.problem-grid{position:absolute;top:363px;left:110px;right:110px;display:flex;align-items:center;gap:43px}.problem-card{width:493px;height:293px;border:1px solid #446471;border-radius:18px;padding:38px 34px;background:#173545}.problem-card svg{width:64px;height:64px;stroke-width:1.4;fill:none;stroke:currentColor;margin-bottom:30px}.problem-card h2{font-size:32px;font-weight:550;margin:0 0 11px}.problem-card p{font-size:22px;color:#a5c0cb;margin:0}.flow-arrow{font-size:39px;color:#698895}.chain{position:absolute;top:735px;left:110px;font-size:24px;word-spacing:5px;color:#9fb9c7}.intro-brand{position:absolute;left:100px;top:223px}.intro-brand>.logo svg{width:104px;height:104px;margin-bottom:40px}.intro-brand h1{font-size:96px;line-height:1;letter-spacing:-4px;margin:0 0 28px;font-weight:650}.intro-brand h1 span{color:#70c5ce}.intro-brand p{font-size:28px;color:#a9c5d0;margin:0 0 60px}.intro-brand h2{font-size:38px;font-weight:450;line-height:1.4;margin:0;color:#eff9fc}
.hero-overlay{position:absolute;top:260px;left:95px;width:980px;padding:40px 42px;background:#0a202beF;border:1px solid #4d6b7550;border-radius:16px}.hero-overlay .kicker{font-size:20px;color:#79c6cf;letter-spacing:2px;margin-bottom:20px}.hero-overlay h1{font-size:69px;font-weight:550;line-height:1.16;letter-spacing:-2px;margin:0}.hero-overlay p{font-size:26px;line-height:1.5;color:#a6c1cc;margin:23px 0 0}
.pipeline{position:absolute;left:92px;right:92px;top:397px;display:flex;gap:18px;align-items:center}.pipeline .node{width:254px;height:190px;padding:26px 20px;border-radius:13px;border:1px solid #4a6874;background:#193645;color:#8ba7b4;opacity:.55}.pipeline .node.active{opacity:1;border-color:#72b4bf;color:#eef7f9;background:#204552}.pipeline .number{font-size:18px;letter-spacing:1.5px;color:#65b4c0;margin-bottom:24px}.pipeline h2{font-size:24px;line-height:1.3;font-weight:550;margin:0}.pipeline .connector{color:#819eac;font-size:27px}.tech-foot{position:absolute;top:697px;left:95px;font-size:30px;color:#c1d5de}.tech-note{position:absolute;top:764px;left:95px;font-size:20px;color:#85a5b6}.end{position:absolute;inset:180px 0 auto;text-align:center}.end svg{width:100px;height:100px;margin-bottom:29px}.end h1{font-size:96px;letter-spacing:-3px;margin:0 0 33px}.end h1 span{color:#74c4cf}.end h2{font-size:44px;font-weight:450;letter-spacing:-1px;margin:0 0 33px}.end p{font-size:24px;color:#a1bdc9;margin:0}.end small{display:block;font-size:19px;color:#7e9fae;margin-top:45px}
`;
function base(scene, content = "") {
  const credit = ["app", "hook", "intro"].includes(scene.kind)
    ? "ACTUAL APP CAPTURE · Map © OpenStreetMap contributors · Synthetic network overlay"
    : "SYNTHETIC DEMONSTRATION NETWORK · EDUCATIONAL DECISION SUPPORT";
  return `<div class="canvas"><div class="texture"></div><div class="top"><div class="brand">${logo}<span>Resili<em>Route</em></span></div><span class="pill">IMPACTHACK 2026 · PRODUCT DEMO</span></div><div class="chapter">${escape(scene.title)}</div>${content}<div class="foot">${credit}</div><div class="captions"></div><div class="rule"></div></div>`;
}
const stat = (name, value, note, color = "teal") =>
  `<div class="stat"><div class="stat-label">${name}</div><div class="stat-value ${color}">${value}</div><div class="stat-note">${note}</div></div>`;
async function save(name, html, transparent = false) {
  if (process.argv.includes("--thumbnail-only")) return;
  await page.setContent(
    `<html><head><style>${style}${transparent ? "html,body{background:transparent}.canvas{background:transparent}" : ""}</style></head><body>${html}</body></html>`,
  );
  await page.screenshot({ path: resolve(frames, `${name}.png`), omitBackground: transparent });
}
for (const scene of project.scenes) {
  let content = "";
  if (scene.id === "normal")
    content = `<aside class="side"><div class="side-label">NORMAL CONDITIONS</div>${stat("Average travel time", `${format(report.baseline.averageTravelTime)} <small>min</small>`, "Demand-weighted mean")}${stat("Essential access", `${format(report.baseline.accessibility)}<small>%</small>`, "Population-weighted reachability")}${stat("Resilience", `${format(report.baseline.resilienceScore, 0)}<small> / 100</small>`, "Baseline reference")}</aside>`;
  if (scene.id === "earthquake")
    content = `<aside class="side"><div class="side-label">BEFORE → AFTER</div>${stat("Average travel time", `<span class="muted" style="font-size:38px">${format(report.baseline.averageTravelTime)}</span> <span class="arrow">→</span> ${format(report.current.averageTravelTime)}`, "minutes · +46.6%", "orange")}${stat("Essential access", `<span class="muted" style="font-size:35px">${format(report.baseline.accessibility)}</span> <span class="arrow">→</span> <span style="font-size:50px">${format(report.current.accessibility)}</span>`, "percent · −15.5 points", "orange")}${stat("Resilience", `<span class="muted" style="font-size:38px">100</span> <span class="arrow">→</span> ${format(report.current.resilienceScore, 0)}`, "out of 100 · baseline-relative", "orange")}</aside>`;
  if (scene.id === "cascade")
    content = `<aside class="side"><div class="side-label">PORT BYPASS</div><h2>Demand moves.<br>Impact spreads.</h2>${stat("Person-trips / model hour", '426 <span class="arrow">→</span> <span style="font-size:53px">3,674</span>', "Computed traffic redistribution", "orange")}${stat("Capacity utilization", "141<small>%</small>", "At or above synthetic capacity", "orange")}<div class="aside-copy">Closed links carry zero flow.<br>Alternative corridors bear the load.</div></aside>`;
  if (scene.id === "problem")
    content = `<div class="full-title">One failure.<br>Citywide consequences.</div><div class="problem-grid"><div class="problem-card orange"><svg viewBox="0 0 64 64"><path d="M5 46h54M13 46V17M51 46V17M13 21c9 16 29 16 38 0M13 46l12-11M51 46 39 35M5 52h54"/></svg><h2>Bridge closure</h2><p>One critical link fails.</p></div><span class="flow-arrow">→</span><div class="problem-card teal"><svg viewBox="0 0 64 64"><path d="M12 51V34a13 13 0 0 1 13-13h22M38 12l10 9-10 9M24 51V40a8 8 0 0 1 8-8h10"/><circle cx="12" cy="54" r="4"/><circle cx="49" cy="42" r="4"/></svg><h2>Traffic redistribution</h2><p>Other corridors take the load.</p></div><span class="flow-arrow">→</span><div class="problem-card"><svg viewBox="0 0 64 64"><path d="M13 54V13h38v41M7 54h50M27 54V42h10v12M25 20h14M32 13v21M20 37h4M40 37h4"/></svg><h2>Essential access loss</h2><p>Communities feel the impact.</p></div></div><div class="chain">Failure <span class="flow-arrow">→</span> Rerouting <span class="flow-arrow">→</span> Congestion <span class="flow-arrow">→</span> Accessibility loss</div>`;
  if (scene.id === "intro")
    content = `<div class="intro-brand"><div class="logo">${logo}</div><h1>Resili<span>Route</span></h1><p>Urban Mobility Resilience Simulator</p><h2>When one link fails,<br>how does the whole city change?</h2></div>`;
  if (scene.id === "end")
    content = `<div class="end">${logo}<h1>Resili<span>Route</span></h1><h2>Understand disruption before it happens.</h2><p>Urban Mobility Resilience Simulator</p><small>A solo student civic-tech project · ImpactHack 2026</small></div>`;
  await save(scene.id, base(scene, content));
  if (scene.id === "earthquake") {
    const waiting = `<aside class="side"><div class="side-label">REFERENCE CONDITIONS</div>${stat("Average travel time", `${format(report.baseline.averageTravelTime)} <small>min</small>`, "Before the earthquake")}${stat("Essential access", `${format(report.baseline.accessibility)}<small>%</small>`, "Before the earthquake")}${stat("Resilience", "100<small> / 100</small>", "Baseline reference")}</aside>`;
    await save("earthquake-normal", base(scene, waiting));
  }
}
// Alpha overlays on actual footage, so the opening has a live network behind the question.
await save(
  "hook-question",
  `<div class="hero-overlay"><div class="kicker">URBAN MOBILITY RESILIENCE</div><h1>What happens<br>when one link fails?</h1></div>`,
  true,
);
await save(
  "hook-impact",
  `<div class="hero-overlay" style="top:325px"><div class="kicker" style="color:#df936c">CASCADING IMPACT</div><h1>The impact<br>doesn't stop there.</h1></div>`,
  true,
);
const labels = [
  "Network model",
  "Shortest-path routing",
  "Traffic demand assignment",
  "Congestion modeling",
  "Accessibility analysis",
  "Evidence-based brief",
];
for (let stage = 0; stage < 6; stage++) {
  const content = `<div class="full-title" style="font-size:53px;top:194px">Graph algorithms + mobility analytics + AI interpretation</div><div class="pipeline">${labels.map((label, i) => `${i ? '<span class="connector">→</span>' : ""}<div class="node ${i <= stage ? "active" : ""}"><div class="number">0${i + 1}</div><h2>${label}</h2></div>`).join("")}</div><div class="tech-foot">A transparent simulation. A human-readable explanation.</div><div class="tech-note">Synthetic data · Simplified traffic assignment · Educational decision support</div>`;
  await save(
    `technical-${stage}`,
    base(
      project.scenes.find((s) => s.id === "technical"),
      content,
    ),
  );
}
// Thumbnail uses the actual map with the earthquake closures, plus real exported metrics.
const map = await readFile("docs/screenshots/earthquake-overview.png");
const dataUrl = "data:image/png;base64," + map.toString("base64");
const thumbnail = `<div class="canvas"><div class="texture"></div><div style="position:absolute;left:60px;top:170px;width:1025px;height:570px;overflow:hidden;border:1px solid #607984;border-radius:18px"><img src="${dataUrl}" style="position:absolute;width:1590px;max-width:none;left:-38px;top:-545px"></div><div style="position:absolute;left:60px;top:782px;width:1025px;display:flex;gap:86px"><div><p style="font-size:20px;color:#a8c3ce;margin:0 0 15px">Essential service access</p><strong style="font-size:48px;font-weight:550;color:#de946e">${format(report.baseline.accessibility)} → ${format(report.current.accessibility)}%</strong></div><div><p style="font-size:20px;color:#a8c3ce;margin:0 0 15px">Resilience / 100</p><strong style="font-size:48px;font-weight:550;color:#de946e">100 → ${format(report.current.resilienceScore, 0)}</strong></div></div><div style="position:absolute;top:90px;left:1150px;right:60px">${logo.replace("<svg ", '<svg style="width:85px;height:85px;margin-bottom:32px" ')}<h1 style="font-size:83px;letter-spacing:-3px;margin:0">Resili<span style="color:#76c4cc">Route</span></h1><p style="font-size:25px;color:#a8c3ce;line-height:1.5;margin:22px 0 47px">Urban Mobility<br>Resilience Simulator</p><h2 style="font-size:34px;font-weight:450;line-height:1.4">One failure.<br>Citywide consequences.</h2><div style="padding-top:23px;border-top:1px solid #597785;margin-top:30px">${stat("Average travel time", `${format(report.baseline.averageTravelTime)} <span class="arrow">→</span> ${format(report.current.averageTravelTime)} <small>min</small>`, "Actual earthquake simulation", "orange")}</div></div><div style="position:absolute;bottom:114px;left:60px;color:#bdcfd7;font-size:30px">Failure → Redistribution → Congestion → Access loss</div><div style="position:absolute;bottom:60px;left:60px;font-size:18px;color:#86a8b8">Map © OpenStreetMap contributors · Synthetic network · Actual computed results</div><div class="rule"></div></div>`;
await page.setContent(`<html><head><style>${style}</style></head><body>${thumbnail}</body></html>`);
await page.screenshot({ path: resolve("video/deliverables/THUMBNAIL.png") });
await browser.close();
console.info("English title cards, pipeline frames and actual-data thumbnail rendered.");
