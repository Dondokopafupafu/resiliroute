// Code-native presentation plates. All product pixels come from actual captures.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve("video/creator-colosseum");
const project = JSON.parse(await readFile(`${root}/project.json`, "utf8"));
const e = JSON.parse(await readFile(`${root}/assets/evidence.json`, "utf8"));
const logo = await readFile("public/favicon.svg", "utf8");
await mkdir(`${root}/assets/frames`, { recursive: true });
await mkdir(`${root}/deliverables`, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const esc = (v) =>
  String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const f = (n, d = 1) => n.toFixed(d);
const style = `
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden}body{font-family:'Segoe UI',Arial,sans-serif;color:#eff7fa;background:#102a39;-webkit-font-smoothing:antialiased}.canvas{position:relative;width:1920px;height:1080px;background:#102a39}.top{position:absolute;left:64px;right:64px;top:27px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:13px;font-size:25px;font-weight:650}.brand svg{width:35px;height:35px}.brand em{font-style:normal;color:#77c6cf}.pill{font-size:14px;letter-spacing:1.4px;border:1px solid #4b6977;padding:9px 14px;border-radius:5px;color:#adcad4}.chapter{position:absolute;left:64px;top:78px;font-size:32px;font-weight:550;letter-spacing:-.7px}.captions{position:absolute;top:888px;left:34px;right:34px;height:181px;border:1px solid #4c657d60;border-radius:12px;background:#061823f4}.foot{position:absolute;top:862px;left:64px;right:64px;font-size:15px;color:#9ebbc8;letter-spacing:.3px}.rule{position:absolute;bottom:0;height:4px;width:100%;background:#087d89}.aside{position:absolute;left:1430px;right:65px;top:164px}.kicker{font-size:17px;letter-spacing:2px;color:#80bdc9;text-transform:uppercase;margin-bottom:25px}.aside h2{font-size:36px;font-weight:550;line-height:1.2;margin:0 0 32px;letter-spacing:-1px}.stat{padding:22px 0;border-top:1px solid #50717b90}.label{font-size:20px;color:#b1ccd7;margin-bottom:9px}.value{font-size:51px;letter-spacing:-1.5px;font-weight:600;color:#77c6cf;line-height:1.25}.value small{font-size:23px;font-weight:400;letter-spacing:0}.note{font-size:19px;color:#a4c1ce;line-height:1.5;margin-top:7px}.warn .value{color:#e4a074}.green .value{color:#87c8ab}.muted{color:#789cab}.arrow{color:#789cab;font-weight:350;font-size:35px}.hero-title{position:absolute;left:100px;top:202px;font-size:67px;line-height:1.15;font-weight:600;letter-spacing:-2px;max-width:1700px}.hero-sub{position:absolute;left:100px;top:360px;font-size:27px;line-height:1.5;color:#a5c4d1}.cards{position:absolute;left:100px;right:100px;top:418px;display:flex;gap:32px}.card{flex:1;min-height:260px;border:1px solid #4d6c78;border-radius:16px;background:#183948;padding:32px}.card b{font-size:16px;color:#85b6c5;letter-spacing:1.5px;display:block;margin-bottom:30px}.card h2{font-size:31px;font-weight:550;margin:0 0 18px}.card p{font-size:24px;color:#a9c5d0;line-height:1.5;margin:0}.chain{position:absolute;left:100px;right:100px;top:765px;font-size:28px;color:#bed4dd;word-spacing:6px}.pipeline{position:absolute;top:343px;left:95px;right:95px;display:grid;grid-template-columns:repeat(4,1fr);gap:22px}.node{border:1px solid #486a79;border-radius:13px;padding:23px 26px;background:#183947;min-height:159px;color:#99b5c3}.node.active{color:#f0f8fa;border-color:#75bcc6;background:#204855}.node b{display:block;color:#76bcc8;margin-bottom:21px;letter-spacing:2px;font-size:19px}.node span{font-size:26px;font-weight:550;line-height:1.3}.pipeline-note{position:absolute;left:100px;top:766px;font-size:23px;color:#acc9d7}.end{position:absolute;top:200px;left:70px;right:70px;text-align:center}.end svg{width:91px;height:91px}.end h1{font-size:80px;letter-spacing:-3px;margin:27px 0 22px}.end h1 span{color:#76c4ce}.end p{font-size:27px;color:#a4c1cf;margin:0 0 34px}.end h2{font-size:40px;font-weight:450;letter-spacing:-1px;margin:28px 0}.end .url{font-size:27px;color:#75c5ce}.credit{font-size:19px;color:#9cb8c5;line-height:1.55;margin-top:30px}.badge{border:1px solid #648088;border-radius:8px;padding:15px 20px;font-size:20px;line-height:1.45;color:#adcbd5;margin-top:25px}
`;
const stat = (label, value, note, kind = "") =>
  `<div class="stat ${kind}"><div class="label">${label}</div><div class="value">${value}</div><div class="note">${note}</div></div>`;
const side = (kicker, content) =>
  `<aside class="aside"><div class="kicker">${kicker}</div>${content}</aside>`;
function base(
  title,
  content = "",
  footer = "ACTUAL APP CAPTURE · © OpenStreetMap contributors · Real infrastructure / modeled mobility demand",
) {
  return `<div class="canvas"><div class="top"><div class="brand">${logo}<span>Resili<em>Route</em></span></div><div class="pill">CREATOR COLOSSEUM · PITCH + DEMO</div></div><div class="chapter">${esc(title)}</div>${content}<div class="foot">${footer}</div><div class="captions"></div><div class="rule"></div></div>`;
}
async function save(name, html) {
  await page.setContent(`<html><head><style>${style}</style></head><body>${html}</body></html>`);
  await page.screenshot({ path: `${root}/assets/frames/${name}.png` });
}
for (const s of project.scenes) await save(s.id, base(s.title));
await save("hook", base("When one link fails, how does the whole city change?"));
await save(
  "problem-slide",
  base(
    "Transportation failures cascade.",
    `<div class="hero-title">One failure.<br>Citywide consequences.</div><div class="cards"><div class="card"><b>01 · DISRUPTION</b><h2>A link becomes unavailable</h2><p>A bridge, road, or rail connection.</p></div><div class="card"><b>02 · REDISTRIBUTION</b><h2>Other corridors take the load</h2><p>Routes and volumes change.</p></div><div class="card"><b>03 · ACCESS</b><h2>Communities feel the effect</h2><p>Essential services can become harder to reach.</p></div></div><div class="chain">Failure → Rerouting → Local pressure → Access loss → Recovery</div>`,
  ),
);
await save(
  "build-stats",
  base(
    "02 / Build a real network",
    side(
      "OKAYAMA · MODEL INPUTS",
      stat("Decision nodes", e.stats.intersections, "Intersections and road endpoints") +
        stat("Road segments", e.stats.roadLinks, "Detailed OSM geometry retained") +
        stat("Modeled origins", e.stats.origins, "Synthetic residential demand"),
    ),
  ),
);
await save(
  "closure-stats",
  base(
    "03 / A bridge closure changes the network",
    side(
      "COMPUTED BEFORE → AFTER",
      stat(
        "Average modeled travel",
        `${f(e.baseline.averageTravelTime)} <span class="arrow">→</span> ${f(e.current.averageTravelTime)} <small>min</small>`,
        "Same origins and destinations",
        "warn",
      ) +
        stat(
          "Resilience / 100",
          `100 <span class="arrow">→</span> ${f(e.current.resilienceScore, 0)}`,
          "Baseline-relative composite",
          "warn",
        ) +
        stat(
          "Essential access",
          `${f(e.current.accessibility)}<small>%</small>`,
          "Still within the 20-minute hospital threshold",
        ),
    ),
  ),
);
await save(
  "route-stats",
  base(
    "04 / The hospital journey becomes a detour",
    side(
      "SAME ORIGIN · SAME HOSPITAL",
      stat(
        "Modeled route time",
        `${f(e.routes[0].before.travelTime)} <span class="arrow">→</span> ${f(e.routes[0].after.travelTime)} <small>min</small>`,
        "Shortest-path route comparison",
        "warn",
      ) +
        stat(
          "Route length",
          `${f(e.routes[0].before.distance)} <span class="arrow">→</span> ${f(e.routes[0].after.distance)} <small>km</small>`,
          "Calculated along real road geometry",
        ) +
        `<div class="badge">Dashed gray: baseline<br>Solid navy: scenario route<br>Red dashed: closed road</div>`,
    ),
  ),
);
await save(
  "flow-stats",
  base(
    "05 / Local pressure grows beyond the closure",
    side(
      "AN ALTERNATIVE CORRIDOR",
      stat(
        "Modeled demand / hour",
        `${f(e.flows[0].before.volume, 0)} <span class="arrow">→</span> ${f(e.flows[0].after.volume, 0)}`,
        "Computed redistribution",
        "warn",
      ) +
        stat(
          "Capacity utilization",
          `${f(e.flows[0].after.utilization * 100, 0)}<small>%</small>`,
          "Estimated capacity; synthetic demand",
          "warn",
        ) +
        `<div class="badge">Citywide congestion can fall while a particular corridor takes more load.</div>`,
    ),
  ),
);
await save(
  "critical-stats",
  base(
    "06 / Stress-test the next failure",
    side(
      "SCREENED ANALYSIS",
      stat(
        "Candidate roads",
        `${e.screened.ids.length} <small>/ ${e.screened.total}</small>`,
        "Each candidate receives a full simulation",
      ) +
        stat(
          "Top impact index",
          `${f(e.ranking[0].score)} <small>/ 100</small>`,
          "Conditional on the current bridge closure",
          "warn",
        ) +
        `<div class="badge">Modeled consequence.<br>Not failure probability.<br>Not an exhaustive ranking.</div>`,
    ),
  ),
);
await save(
  "recovery-stats",
  base(
    "07 / Choose the strongest independent recovery",
    side(
      "TWO ROAD CLOSURES",
      stat(
        "Resilience / 100",
        `${f(e.multiple.resilienceScore, 0)} <span class="arrow">→</span> ${f(e.multiRecovery[0].metrics.resilienceScore, 0)}`,
        `+${f(e.multiRecovery[0].resilienceGain)} points from one restoration`,
        "green",
      ) +
        stat(
          "Essential access",
          `${f(e.multiple.accessibility)} <span class="arrow">→</span> ${f(e.multiRecovery[0].metrics.accessibility)}<small>%</small>`,
          `+${f(e.multiRecovery[0].accessibilityGain)} access points`,
          "green",
        ) +
        `<div class="badge">Independent alternatives.<br>Benefits are not additive.</div>`,
    ),
  ),
);
const pipeline = [
  "Real OSM roads",
  "Simplified graph",
  "Modeled OD demand",
  "Dijkstra routing",
  "24-step assignment",
  "Bounded BPR costs",
  "Access & resilience",
  "Stress tests & recovery",
];
for (let stage = 0; stage < 4; stage++)
  await save(
    `pipeline-${stage}`,
    base(
      "Transparent rules. Reproducible calculations.",
      `<div class="hero-title" style="top:177px;font-size:53px">From real infrastructure to modeled impact</div><div class="pipeline">${pipeline.map((label, i) => `<div class="node ${i <= stage * 2 + 1 ? "active" : ""}"><b>0${i + 1}</b><span>${label}</span></div>`).join("")}</div><div class="pipeline-note">Pure TypeScript simulation · Web Worker analysis · Traceable metric definitions</div>`,
      "OPENSTREETMAP INFRASTRUCTURE + MODELED MOBILITY · EDUCATIONAL DECISION SUPPORT",
    ),
  );
await save(
  "methodology-stats",
  base(
    "Implemented. Tested. Documented.",
    side(
      "CURRENT VERIFIED TEST SUITE",
      stat("Unit tests", "63", "Algorithms, OSM parsing, AI fallback and privacy") +
        stat("Browser checks", "42", "Desktop and mobile interactions") +
        `<div class="badge">Next.js · React · TypeScript<br>Leaflet · Recharts<br>Vitest · Playwright</div>`,
    ),
  ),
);
await save(
  "business-slide",
  base(
    "Proposed adoption model / Customer validation comes first",
    `<div class="hero-title" style="top:179px;font-size:58px">Start with learning.<br>Grow through validated use.</div><div class="cards" style="top:370px"><div class="card"><b>01 · FREE / EDUCATION</b><h2>Teach network resilience</h2><p>Schools, universities and preparedness workshops.</p></div><div class="card"><b>02 · PROFESSIONAL</b><h2>Expand planning analysis</h2><p>Proposed advanced comparisons, reports and exports.</p></div><div class="card"><b>03 · ORGANIZATIONS</b><h2>Support custom data</h2><p>Proposed integrations for planning teams.</p></div></div><div class="chain">Next: workshop pilots → professional feedback → evidence of repeat use</div>`,
    "FUTURE DIRECTIONS · NO CLAIM OF CUSTOMERS, REVENUE OR DEPLOYED GOVERNMENT USE",
  ),
);
const credits =
  "Earlier version developed for ImpactHack 2026; expanded with Real City Lab. AI-assisted implementation, debugging and testing; creator-directed product decisions and evaluation.";
await save("closing", base("Understand disruption before it happens.", "", credits));
await save(
  "end",
  base(
    "ResiliRoute",
    `<div class="end">${logo}<h1>Resili<span>Route</span></h1><p>Urban Mobility Resilience Simulator</p><h2>Select a city. Break a link. Understand the impact.</h2><div class="url">github.com/Dondokopafupafu/resiliroute</div><div class="credit">Earlier version: ImpactHack 2026 · Expanded with Real City Lab<br>AI-assisted development · Creator-directed design and evaluation</div></div>`,
    "EDUCATIONAL WHAT-IF ANALYSIS · © OpenStreetMap contributors · Creator Colosseum: The Startup Showdown",
  ),
);
// The thumbnail is a typography layout around the actual post-closure UI, never invented UI.
const still = await readFile(`${root}/assets/stills/hook-end.png`);
const thumb = `<div class="canvas"><div class="top"><div class="brand">${logo}<span>Resili<em>Route</em></span></div><div class="pill">REAL CITY LAB</div></div><div style="position:absolute;left:60px;top:172px;width:1110px;height:718px;overflow:hidden;border:1px solid #577482;border-radius:17px"><img src="data:image/png;base64,${still.toString("base64")}" style="position:absolute;width:2290px;left:-333px;top:-274px;max-width:none"></div><div style="position:absolute;left:1230px;right:65px;top:158px"><div class="kicker">RESILIROUTE</div><h1 style="font-size:65px;line-height:1.13;letter-spacing:-2px;font-weight:600;margin:28px 0 44px">What happens<br>when one<br>road fails?</h1><p style="font-size:25px;line-height:1.5;color:#a7c7d5">Urban Mobility<br>Resilience Simulator</p>${stat("Modeled hospital route", `${f(e.routes[0].before.travelTime)} <span class="arrow">→</span> ${f(e.routes[0].after.travelTime)} <small>min</small>`, "Same journey. A longer detour.", "warn")}</div><div style="position:absolute;left:62px;bottom:85px;font-size:26px;color:#b6d0da">Real roads. Calculated consequences.</div><div style="position:absolute;left:62px;bottom:43px;font-size:18px;color:#91b2c3">Actual ResiliRoute UI · Okayama · © OpenStreetMap contributors · Modeled demand</div><div class="rule"></div></div>`;
await page.setContent(`<html><head><style>${style}</style></head><body>${thumb}</body></html>`);
await page.screenshot({ path: `${root}/deliverables/THUMBNAIL.png` });
await browser.close();
console.info("English presentation plates and actual-product thumbnail ready.");
