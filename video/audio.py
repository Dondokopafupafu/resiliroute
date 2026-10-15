"""Generate English speech, a quiet original score, and synchronized bilingual captions.

The script only sends the public English narration to the selected speech service.
No API key or app data is sent. All mixing and subtitle timing are performed locally.
"""
import asyncio
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import textwrap
import wave

TOOLS_ROOT = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('RESILIROUTE_VIDEO_DIR', str(TOOLS_ROOT))).resolve()
sys.path.insert(0, str(TOOLS_ROOT / 'tools/python'))
import edge_tts
import imageio_ffmpeg
import numpy as np

FFMPEG = os.environ.get('FFMPEG_PATH') or imageio_ffmpeg.get_ffmpeg_exe()
PROJECT = json.loads((ROOT / 'project.json').read_text(encoding='utf-8'))
OUTPUT = ROOT / 'deliverables'
AUDIO = ROOT / 'assets/audio'
OUTPUT.mkdir(parents=True, exist_ok=True)
AUDIO.mkdir(parents=True, exist_ok=True)
RATE = 48000


def run(args):
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def read_wave(path):
    with wave.open(str(path), 'rb') as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768


def write_wave(path, samples):
    channels = 1 if samples.ndim == 1 else samples.shape[1]
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes())


def stamp(seconds, ass=False):
    ms = round(seconds * (100 if ass else 1000))
    base = 100 if ass else 1000
    h, rem = divmod(ms, 3600 * base)
    m, rem = divmod(rem, 60 * base)
    s, part = divmod(rem, base)
    return f'{h}:{m:02}:{s:02}.{part:02}' if ass else f'{h:02}:{m:02}:{s:02},{part:03}'


def wrap_ja(text, width=48):
    # Prefer natural punctuation boundaries; punctuation is never put alone on a line.
    if len(text) <= width:
        return text
    midpoint = len(text) // 2
    candidates = [i + 1 for i, c in enumerate(text) if c in '、。' and 20 < i < len(text) - 16]
    split = min(candidates, key=lambda i: abs(i - midpoint)) if candidates else midpoint
    return text[:split] + '\n' + text[split:]


async def synthesize():
    voice_track = np.zeros(PROJECT['duration'] * RATE)
    cues = []
    diagnostics = []
    for scene in PROJECT['scenes']:
        targets = [len(c['en'].split()) * 60 / PROJECT['speakingRate'] for c in scene['cues']]
        spare = scene['end'] - scene['start'] - sum(targets)
        assert spare > 0, f"Too much narration in {scene['id']}"
        gap = spare / (len(targets) + 1)
        offset = scene['start']
        for i, (cue, duration) in enumerate(zip(scene['cues'], targets)):
            stem = f"{scene['id']}-{i+1:02}"
            raw = AUDIO / f'{stem}.mp3'
            source = AUDIO / f'{stem}.source.txt'
            source_text = PROJECT['voice'] + '|-5%|' + cue['en']
            decoded = AUDIO / f'{stem}-raw.wav'
            voiced = AUDIO / f'{stem}.wav'
            if not raw.exists() or not source.exists() or source.read_text(encoding='utf-8') != source_text:
                for attempt in range(3):
                    try:
                        await edge_tts.Communicate(cue['en'], PROJECT['voice'], rate='-5%').save(str(raw))
                        source.write_text(source_text,encoding='utf-8')
                        break
                    except Exception:
                        if attempt == 2:
                            raise
                        await asyncio.sleep(1 + attempt)
            run(['-i', str(raw), '-af', 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB,areverse', '-ar', str(RATE), '-ac', '1', str(decoded)])
            actual = len(read_wave(decoded)) / RATE
            tempo = actual / duration
            assert .5 < tempo < 2, (stem, tempo)
            run(['-i', str(decoded), '-af', f'atempo={tempo:.8f},apad,atrim=duration={duration:.8f}', '-ar', str(RATE), '-ac', '1', str(voiced)])
            samples = read_wave(voiced)
            audio_start = offset + gap
            start_sample = round(audio_start * RATE)
            voice_track[start_sample:start_sample + len(samples)] = samples
            caption_start = scene['start'] if i == 0 else offset + gap / 2
            caption_end = scene['end'] if i == len(targets) - 1 else offset + gap + duration + gap / 2
            cues.append({**cue, 'scene': scene['id'], 'start': caption_start, 'end': caption_end, 'audioStart': audio_start, 'audioEnd': audio_start + duration})
            diagnostics.append({'cue': stem, 'rawDuration': actual, 'finalDuration': duration, 'tempoFactor': tempo, 'wordsPerMinute': PROJECT['speakingRate']})
            offset += duration + gap
            print(f'Speech: {stem}', flush=True)
    write_wave(AUDIO / 'narration.wav', voice_track)
    run(['-i', str(AUDIO / 'narration.wav'), '-af', 'loudnorm=I=-17:TP=-2:LRA=7', '-ar', str(RATE), '-ac', '1', str(AUDIO / 'narration-normalized.wav')])
    (ROOT / 'assets/cues.json').write_text(json.dumps(cues, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'assets/voice-diagnostics.json').write_text(json.dumps(diagnostics, indent=2), encoding='utf-8')
    (OUTPUT / 'narration-en.txt').write_text('\n\n'.join(' '.join(c['en'] for c in s['cues']) for s in PROJECT['scenes']) + '\n', encoding='utf-8')
    for lang in ['en', 'ja']:
        strings = []
        for i, cue in enumerate(cues, 1):
            display = '\n'.join(textwrap.wrap(cue[lang], width=88)) if lang == 'en' else wrap_ja(cue[lang])
            strings.append(f"{i}\n{stamp(cue['start'])} --> {stamp(cue['end'])}\n{display}\n")
        (OUTPUT / f'subtitles-{lang}.srt').write_text('\n'.join(strings), encoding='utf-8')
    header = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: EN,Segoe UI,33,&H00FFFFFF,&H00FFFFFF,&H90000000,&H00000000,0,0,0,0,100,100,0,0,1,0.6,0,8,65,65,0,1
Style: JA,Yu Gothic,29,&H00D7E4EC,&H00D7E4EC,&H90000000,&H00000000,0,0,0,0,100,100,0,0,1,0.6,0,8,65,65,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    lines = []
    for cue in cues:
        for lang, y in [('en', 906), ('ja', 986)]:
            display = '\n'.join(textwrap.wrap(cue[lang], width=94)) if lang == 'en' else wrap_ja(cue[lang])
            display = display.replace('\n', r'\N')
            lines.append(f"Dialogue: 0,{stamp(cue['start'], True)},{stamp(cue['end'], True)},{lang.upper()},,0,0,0,,{{\\pos(960,{y})}}{display}")
    (ROOT / 'assets/subtitles.ass').write_text(header + '\n'.join(lines) + '\n', encoding='utf-8-sig')


def compose_score():
    """Original ambient instrumental. No samples or third-party musical work."""
    duration = PROJECT['duration']
    count = duration * RATE
    music = np.zeros((count, 2), dtype=np.float64)
    rng = np.random.default_rng(2026)
    # Warm, restrained suspended chords: D / B minor / G / A. No prominent melody.
    chords = [(146.832, 220.0, 329.628), (123.471, 184.997, 293.665), (98.0, 146.832, 220.0), (110.0, 164.814, 293.665)]
    bar = 16.0
    for index, start in enumerate(np.arange(0, duration, bar)):
        length = min(bar + 3, duration - start)
        t = np.arange(round(length * RATE)) / RATE
        env = np.minimum(t / 2.8, 1) * np.minimum((length - t) / 3.5, 1)
        signal = np.zeros((len(t), 2))
        for note in chords[index % len(chords)]:
            for channel, detune in enumerate([.9992, 1.0008]):
                phase = rng.uniform(0, math.tau)
                signal[:, channel] += env * (.032 * np.sin(math.tau * note * detune * t + phase) + .006 * np.sin(math.tau * 2 * note * t + phase))
        a = round(start * RATE)
        music[a:a + len(t)] += signal
    # Soft sparse bell accents. Rounded exponential envelope prevents clicks.
    for index, start in enumerate(np.arange(4, duration - 4, 8)):
        t = np.arange(3 * RATE) / RATE
        f = [587.33, 659.26, 440, 493.88][index % 4]
        pulse = .017 * np.sin(math.tau * f * t) * (1 - np.exp(-t * 24)) * np.exp(-t * 1.8)
        a = round(start * RATE)
        music[a:a + len(t), 0] += pulse
        music[a:a + len(t), 1] += pulse * .85
    fade = np.minimum(np.arange(count) / (RATE * 3), 1) * np.minimum(np.arange(count)[::-1] / (RATE * 4), 1)
    write_wave(AUDIO / 'original-score.wav', music * fade[:, None])
    run(['-i', str(AUDIO / 'original-score.wav'), '-af', 'loudnorm=I=-36:TP=-3:LRA=5', '-ar', str(RATE), '-ac', '2', str(AUDIO / 'bgm.wav')])
    run(['-i', str(AUDIO / 'narration-normalized.wav'), '-i', str(AUDIO / 'bgm.wav'), '-filter_complex', '[0:a]pan=stereo|c0=c0|c1=c0[v];[v][1:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false[m]', '-map', '[m]', '-ar', str(RATE), '-ac', '2', str(AUDIO / 'final-mix.wav')])


if __name__ == '__main__':
    asyncio.run(synthesize())
    compose_score()
    print('Narration, original BGM, bilingual SRT and burned-in ASS are ready.')
