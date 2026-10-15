# ResiliRoute — 3-minute product demonstration

Target: **3:00**, with a comfortable range of 2:45–3:15. Read naturally at approximately 135–145 words per minute. The screen actions below are part of the recording; pause the narration briefly while moving between sections. The app is the visual subject throughout.

## Recording setup

- Use the production app: `pnpm build`, then `pnpm start`. Close or stop the dev server first if port 3000 is already used. This removes Next.js development overlays.
- Record at 1440×1000 or 1920×1080. Use browser zoom appropriate to your recording size; keep map attribution and the synthetic-data disclosure visible.
- Choose **English** in the header, then click **Reset**. Use **日本語** for your own checks before recording; switching preserves the current scenario. Keep Origin = **East Riverside**, Destination = **General Hospital**. Enable presentation mode using the expand icon in the header if desired.
- No API key is required. If using local analysis, say “local analyst”; say “language model” only if the interface actually shows OpenAI.
- Do a rehearsal. Values below match the shipped dataset. If data or parameters change, recalculate them before recording.

## 0:00–0:20 · Problem

**Screen:** Start on the product’s header and normal network. Use a slow digital crop toward Harbor Bridge, keeping enough of the city visible. Avoid opening unrelated slides.

**Narration:**

> A bridge fails. We usually ask which route to take instead. But the bigger question is: what happens to the whole city? Traffic moves elsewhere. Another corridor fills up. A hospital becomes harder to reach—and some communities feel much more of the impact than others.

## 0:20–0:35 · Product

**Screen:** Show the headline, synthetic-data label and normal KPI cards. Place the pointer on **Run Earthquake Demo**.

**Narration:**

> This is ResiliRoute, an urban mobility resilience simulator. Harbor City is a synthetic, Japan-inspired network. We can close transport links and calculate the ripple effect, from individual routes to essential services and citywide performance.

## 0:35–1:20 · Earthquake demonstration

**Screen actions:**

1. Click **Run Earthquake Demo** at 0:35.
2. Let the roughly six-second timeline finish. Show the red dashed closures and updated KPIs.
3. Scroll just enough to fill the frame with the map and controls. Pause on Harbor Bridge’s **Closed** state.
4. Toggle **Route overlay**. Digitally crop toward the gold scenario route and pale dashed baseline route. Do not claim the displayed route is safe.
5. Hover Port Bypass or select it using **Inspect link**. Show its assigned volume and utilization.

**Narration:**

> The earthquake scenario removes Harbor Bridge, the East Rail Connector and Coastal Road. These are modeled failures, not an earthquake prediction.
>
> Average travel time rises from fourteen point two to twenty point nine minutes. Essential-service accessibility falls from ninety-four point four to seventy-eight point nine percent. The resilience score falls from its baseline of one hundred to sixty-nine.
>
> Demand has not simply disappeared. It moves onto remaining corridors. Port Bypass carries substantially more trips and exceeds its synthetic capacity. The route overlay compares the normal and disrupted paths to General Hospital. The important result is the cascade: one closure changes conditions elsewhere.

## 1:20–1:55 · Data analytics & social impact

**Screen actions:**

1. Scroll to **A local failure. A citywide impact.** Show both charts together.
2. Hover East’s scenario bar in **District accessibility**.
3. Show the **Most affected district** insight. Open **View district travel time & isolation** if time allows.
4. Briefly show the **Essential services access** table below the infrastructure cards, focusing on Emergency Hospital’s access loss.

**Narration:**

> Citywide averages do not tell the whole story. East is the most affected district: its average modeled trip grows from fourteen point eight to twenty-nine point two minutes, while its essential access falls from one hundred to about sixty-seven percent.
>
> Notice that every modeled origin-destination pair is still connected. A path exists, but timely access has declined. The facility table makes hospital and shelter impacts visible separately, instead of hiding them inside a single score.

## 1:55–2:20 · Critical links & recovery

**Screen actions:**

1. Scroll slightly upward to show **Where would the next failure hurt?** and **What should recover first?** together.
2. Click **Analyze all available links**. Hold until the completion status appears.
3. Point to Harbor Rail in the post-earthquake ranking.
4. Point to Harbor Bridge’s **+16.2 resilience points** recovery card. Wait to restore it until the final segment.

**Narration:**

> Every available link is removed individually and the model reruns. After this disruption, Harbor Rail becomes the most critical remaining link. This ranking changes with the scenario.
>
> The recovery optimizer asks a different question: which single repair helps most? Reopening Harbor Bridge gives the largest modeled improvement—about sixteen resilience points. These are independent repair comparisons, not a guaranteed operational recovery plan.

## 2:20–2:45 · AI Resilience Brief

**Screen actions:**

1. Scroll to **AI Resilience Brief**. Digitally crop to its summary and evidence strip.
2. Move through **Why does it matter?**, **Who is most affected?** and **Possible planning actions**.
3. Keep the analyst source badge visible.

**Narration, local mode:**

> The local analyst turns those computed results into a structured brief: what changed, why it matters, who is affected and possible actions to investigate. It changes with the simulation.
>
> An optional server-side OpenAI model can explain the same evidence. If it fails, the local analyst remains available. Exact numbers come from the simulation, and the methodology explains every formula and limitation.

**If the source badge shows OpenAI:** replace the first sentence with “The language model turns the supplied simulation evidence into a structured planning brief.” Retain the fallback and grounding explanation.

## 2:45–3:00 · Impact & close

**Screen actions:**

1. Return to the Recovery Optimizer and click **Restore Harbor Bridge**.
2. Show the improved KPI cards or the updated district chart.
3. End on the product, with its responsible-use note visible in the final crop or closing frame.

**Narration:**

> Restore the bridge, and the model updates. ResiliRoute helps communities understand resilience before disruption. It is educational, not emergency navigation. Next: validated local data and uncertainty analysis.

## Editing notes

- Keep almost the entire video on the working application. Use digital zooms for small details rather than long pointer searches.
- If narration runs long, omit the expanded district table and the optional source-mode sentence; retain the problem, computed cascade, unequal access, stress test, recovery and limitations.
- Add captions for “synthetic data,” “all OD pairs connected,” and “possible planning strategies.” Do not add award, safety or prediction claims.
- Exports and methodology can appear as a short supplementary clip; they are not essential to the three-minute main cut.
