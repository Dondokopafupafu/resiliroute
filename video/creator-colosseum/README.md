# ResiliRoute — Creator Colosseum pitch & demo

This folder documents the historical version 2.0 film, not the latest submission package. The source end card now uses the current repository URL. Previously rendered local videos and contact sheets must be regenerated before reuse; the historical contact sheet is retained locally and excluded from publication.

A **4:54** product pitch with **611 English narrated words**, synchronized English/Japanese captions, original ambient music and actual 1080p application footage. Real City Lab is the focus: select a region, import real OSM roads, close a river crossing, follow redistribution, compare access and recovery, and inspect the assumptions.

The film includes 255 seconds of actual app capture (86.7%), including 243 seconds of Real City Lab and 12 seconds of Harbor City. Slides occupy 39 seconds. It uses the same visual palette as the product, a separate lower caption strip and restrained cuts/fades.

## Submission files

Generated local media is in `deliverables/`:

- `final-creator-colosseum-resiliroute.mp4` — 1920×1080, 30fps, H.264, AAC stereo, fast-start container.
- `narration-en.txt` — complete English voice text.
- `subtitles-en.srt` and `subtitles-ja.srt` — editable captions; both languages are also burned into the MP4.
- `VIDEO_SCRIPT.md` — timecoded narration, natural Japanese translations, screen actions and editing instructions.
- `THUMBNAIL.png` — actual Okayama post-closure UI with a verified hospital-route comparison.
- `VIDEO_QA.json`, `PLAYBACK_QA.json` and `CONTACT_SHEET.png` — exported-file checks and review frames.
- `resiliroute-creator-colosseum-submission.zip` — reviewed media, captions, script and a Japanese delivery guide in one package.

Large MP4/WAV/WEBM/ZIP files and intermediates are ignored by Git. Upload the video to your chosen video host for the competition; no public video upload or contest submission is performed by the local scripts.

## Verified case

The server successfully fetched the 2.75 km² Okayama example from Overpass on 11 October 2026. Its model contains 687 road decision nodes, 983 road segments, two real hospital facilities, 18 modeled origins and 54 OD pairs. The first closed road is **相生橋**, OSM way **83697074**.

| Model output           | Baseline |            Bridge closed |
| ---------------------- | -------: | -----------------------: |
| Average modeled travel |  2.8 min |                  3.4 min |
| Hospital route shown   |  4.4 min |                  7.2 min |
| Essential access       |   100.0% |                   100.0% |
| Resilience             |      100 |                       91 |
| Alternative road flow  |      595 | 3,010 modeled units/hour |

The second closure is road segment `osm-way-436640413-1`: modeled access falls to 95.9%, resilience to 74. Reopening that road independently gains 17.4 resilience points and 4.1 access points. These are actual calculations. Citywide congestion decreases in this case even though one alternative corridor gains load; the narration does not claim every indicator deteriorates.

`assets/network.json` preserves the actual import. `survey.test.ts` calls the existing pure simulation functions to write `assets/evidence.json`; it is a separate film evidence task, excluded from the normal 63-unit-test suite. `live-build-proof.json` verifies the filmed server import matches the survey inputs. `route-ui-proof.json` verifies the destination is the real hospital and the displayed comparison is 4.4 → 7.2 min.

## Editable production

From the repository root, start the production app at port 3001. The dependencies from the original film remain in `video/tools/python`; the requirements are in `video/requirements.txt`.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm start --port 3001
```

In another terminal:

```powershell
pnpm exec vitest run --config video/creator-colosseum/survey.config.ts
$env:RESILIROUTE_VIDEO_DIR = Join-Path (Get-Location) 'video/creator-colosseum'
python video/audio.py
node video/creator-colosseum/record.mjs
node video/creator-colosseum/design.mjs
python video/render.py --resume
python video/creator-colosseum/qa.py
node video/creator-colosseum/playback-qa.mjs
python video/creator-colosseum/package.py
```

The final file decoded all 8,820 frames without errors. It contains 41 bilingual cues, each held for at least three seconds. Measured voice/music loudness is −17.2/−36.0 LUFS. Chromium playback checks at closure, recovery and the brief each reported zero dropped frames. Use `node video/creator-colosseum/preview.mjs` to open the local player at `http://127.0.0.1:3002`; it exposes only the video and thumbnail.

Use Python 3.12+ and FFmpeg with libx264/libass; `imageio-ffmpeg` supplies the executable. `RESILIROUTE_VIDEO_DIR` selects this project without overwriting the existing ImpactHack film. Set `RESILIROUTE_URL` if the app runs on another local address. Record one process at a time so the recording manifest is not overwritten by concurrent jobs.

`project.json` controls scenes, narration and captions. `edit-plan.json` controls cuts and crops. To recapture one shot, use `node video/creator-colosseum/record.mjs --only reroute`. Recording follows real UI operations and adds only the pointer/click ring. The live import must succeed; a failed API is never replaced with fake data. Later shots explicitly use the imported actual snapshot for reproducibility.

`audio.py` uses `en-US-GuyNeural` via `edge-tts`; only the public English narration is sent for synthesis. The score is original synthesized ambient music without external samples. Voice and music target −17 and −36 LUFS respectively. Speech caches allow repeated local renders without another request.

## Honest scope

Geometry and facilities are OSM data, credited to **© OpenStreetMap contributors** under ODbL. Demand, capacity, residential weights and connectors are modeled; some speed/lane information is estimated. Hospital access uses the educational 20-minute threshold. Routes outside the selected rectangle are excluded. No measured traffic, population, disaster prediction or verified safe evacuation is claimed.

The recorded brief uses deterministic local analysis. An optional server-side language model interprets the same numerical evidence and falls back locally. No live paid model call is presented in the film.

Education/professional/organization tiers and workshop pilots are **future proposals**, pending customer validation. The film discloses the earlier ImpactHack 2026 version and AI-assisted implementation, debugging and testing. Product direction and evaluation are creator-led.

The current public source is [Dondokopafupafu/resiliroute](https://github.com/Dondokopafupafu/resiliroute). The film scripts do not publish videos or submit competition entries. Historical footage should not be presented as a recording of the latest application version.

[Official competition overview](https://creatorcolosseumshowdown.devpost.com/) · [Rules and prior-work disclosure](https://creatorcolosseumshowdown.devpost.com/rules)
