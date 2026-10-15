# ResiliRoute product film

A **3:50** English product demo with English and Japanese captions burned into a reserved lower strip. The app is visible for 196 of 230 seconds (85%). The final film is 1920×1080, 30 fps, H.264 with AAC stereo audio and a fast-start MP4 container.

## Deliverables

All submission files are in `deliverables/`:

- `final-impacthack-resiliroute.mp4`
- `narration-en.txt`
- `subtitles-en.srt`
- `subtitles-ja.srt`
- `VIDEO_SCRIPT.md`
- `THUMBNAIL.png`

The MP4 already contains both subtitle languages. The SRT files are supplied separately for editing and optional upload. The film ends at 3:50; do not append another intro or credit sequence when submitting to a four-minute category.

## Editable source

- `project.json`: the twelve scenes, exact English narration, natural Japanese translations, voice and timing.
- `edit-plan.json`: cuts, real-video crops, presentation rectangles, fades and progressive architecture frames.
- `record.mjs`: actual interactions with the running production app. It adds a visible cursor at actual mouse coordinates; it never injects results or changes app layout.
- `survey.mjs`: exports the app's normal and earthquake analysis JSON and records source geometry.
- `design.mjs`: native HTML/SVG branding, title cards, pipeline diagram and thumbnail using actual product imagery.
- `audio.py`: sentence-level neural speech, timing, bilingual SRT/ASS, original ambient music and local audio mix.
- `render.py`: FFmpeg editing, H.264 encoding and caption/audio composition.
- `qa.py`: final decode, time/frame assertions, keyframe extraction, subtitle/source-data checks and audio measurements.
- `playback-qa.mjs`: plays the exported H.264 file in Chromium and records actual decoder/playback statistics.

This is an editable scripted video project, not a Remotion project. No presentation software, database, cloud video editor or OpenAI key is required to render the film.

## Reproduce

Use Node 22+ with the app's installed Playwright dependency, Python 3.12+, and FFmpeg with libx264/libass. Run commands from the **repository root**.

```text
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm build
pnpm start --port 3001
```

In a second terminal:

```text
python -m pip install --target video/tools/python -r video/requirements.txt
node video/survey.mjs
python video/audio.py
node video/record.mjs
node video/design.mjs
python video/render.py
python video/qa.py
node video/playback-qa.mjs
```

`imageio-ffmpeg` supplies a local FFmpeg executable. Set `FFMPEG_PATH` if you prefer an existing build. Set `RESILIROUTE_URL` for the recording script when the app runs elsewhere. Normal/earthquake results in `assets/` are actual downloaded app reports; a changed dataset requires recording, surveying, updating the narration, and rendering again. The narration is checked against the captured dataset rather than being treated as a prediction.

To resume an interrupted render, reusing valid unchanged parts:

```text
python video/render.py --resume
```

Source signatures compare the edit plan and the recorded/card assets. Changed parts are regenerated automatically. Speech caches also retain their source text and voice, so changed narration is synthesized again.

## Audio and evidence

English speech uses `en-US-GuyNeural` through `edge-tts`. Only the public English narration is sent to that service. Speech synthesis needs internet access; video composition and audio mixing run locally. The existing completed audio assets allow the final render to run without contacting the speech service again.

The ambient score was composed for this film using original synthesized sustained chords and sparse bell tones, without samples or an external song. Narration is normalized around −17 LUFS and BGM around −36 LUFS before mixing: approximately 19 dB lower. No sirens or explosion effects are used.

The filmed app uses the **deterministic local analysis engine**. The optional server-side LLM and automatic fallback are described explicitly; the film does not claim to show a live LLM call. Essential access is threshold-based and population-weighted. Resilience is baseline-relative, with 100 as the normal reference. The link ranking is conditional on the earthquake scenario and does not represent failure probability.

Map imagery is credited to OpenStreetMap contributors in the film and thumbnail. The app imagery, logo and original diagrams come from this repository. Large generated recordings, audio caches, FFmpeg tools and intermediate/final MP4 files are ignored by Git; keep or upload submission media separately.
