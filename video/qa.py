"""Inspect the rendered deliverables and preserve reproducible evidence."""
import hashlib
import json
import re
from pathlib import Path
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools/python'))
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
PROJECT = json.loads((ROOT/'project.json').read_text(encoding='utf-8'))
CUES = json.loads((ROOT/'assets/cues.json').read_text(encoding='utf-8'))
REPORT = json.loads((ROOT/'assets/earthquake-results.json').read_text(encoding='utf-8'))
NORMAL = json.loads((ROOT/'assets/normal-results.json').read_text(encoding='utf-8'))
PLAN = json.loads((ROOT/'edit-plan.json').read_text(encoding='utf-8'))
OUT = ROOT/'deliverables'
BUILD = ROOT/'build'
QA = BUILD/'qa'
QA.mkdir(parents=True,exist_ok=True)
FINAL = OUT/'final-impacthack-resiliroute.mp4'


def run(args):
    result = subprocess.run([FFMPEG,'-hide_banner',*args],capture_output=True,text=True,encoding='utf-8',errors='replace')
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return result


def timecode(t):
    return f'{int(t)//60}:{int(t)%60:02}'


def script():
    visual = {
        'hook':'Actual normal map. At about 0:06, close Harbor Bridge using its real inspector. Change the English hook overlay at 0:09.5.',
        'problem':'English cascade diagram: bridge closure → traffic redistribution → essential access loss. Quiet navy title card.',
        'intro':'Existing SVG brand and name on the left; moving actual Harbor City map on the right. No invented city illustration.',
        'normal':'Actual normal-condition map and controls. Inspect Harbor Bridge, then deselect it. Large baseline callouts use the downloaded normal report.',
        'earthquake':'Click Run Earthquake Demo. Show real staged closure animation and recalculated KPIs. Keep reference callouts initially; show computed before/after after the disruption. Cut closer to the completed map at 1:18.',
        'cascade':'Inspect Port Bypass and its actual volume/capacity values. Deselect it, click Route overlay, and highlight the baseline/scenario hospital route comparison.',
        'analytics':'Actual before/after charts and district accessibility. Hover a chart, then open View district travel time & isolation.',
        'critical':'Click Analyze all available links. Click the top Harbor Rail ranking row; the app scrolls to and highlights that link. Return to ranking/recovery and hover Restore Harbor Bridge without changing the scenario.',
        'equity':'Actual most-affected East district insight and expanded district table. Scroll to the essential-services panel showing Emergency Hospital access 61.4% → 27.0%.',
        'ai':'Actual AI Resilience Brief in local-analysis mode. First crop the summary, evidence and explanation cards; then crop the possible actions and limitations. Do not imply that a live LLM was called.',
        'technical':'Six native architecture blocks highlight sequentially every two seconds: network model, shortest path, demand assignment, congestion, accessibility, evidence-based brief.',
        'end':'English brand/end card. Last narration finishes before the final fade. End precisely at 3:50.'
    }
    text = ['# ResiliRoute — Official ImpactHack Product Film','', '**Master:** 3:50 / 1920×1080 / 30 fps / H.264 + AAC. English narration at 143 words per voiced minute. English subtitles above Japanese subtitles; both are burned in throughout. All title-card text is English.','', '493 narrated words. Original quiet ambient score; no external song, siren or explosion effects. Actual app capture is visible for 196 seconds (85% of the film).','', '## Source evidence','', f"Normal → Earthquake: travel {NORMAL['current']['averageTravelTime']:.1f} → {REPORT['current']['averageTravelTime']:.1f} min; access {NORMAL['current']['accessibility']:.1f} → {REPORT['current']['accessibility']:.1f}%; efficiency {NORMAL['current']['networkEfficiency']:.1f} → {REPORT['current']['networkEfficiency']:.1f}; congestion delay {NORMAL['current']['congestion']:.1f} → {REPORT['current']['congestion']:.1f}%; resilience 100 → {REPORT['current']['resilienceScore']:.0f}. Source: actual downloaded `assets/normal-results.json` and `assets/earthquake-results.json`.", '', f"Next critical remaining link: {REPORT['criticalLinks'][0]['name']} ({REPORT['criticalLinks'][0]['score']:.1f} impact index). Best independent repair: {REPORT['recovery'][0]['name']} (+{REPORT['recovery'][0]['resilienceGain']:.1f} resilience points). Most affected district: East. All OD pairs remain connected; timely access still falls.", '', '## Editing rules','', 'Record the production app in English at 1920×1080, browser scale 100%. Keep the actual cursor visible and move only to relevant controls. Never replace map paths, rankings or app metrics. Crops/light enlargement focus attention; no 3D or dramatic effects. Product content stays above y=858; the caption plate begins at y=888. Scene-boundary fades are 0.18 seconds. Map attribution remains visible in the edit.', '']
    for scene in PROJECT['scenes']:
        text += [f"## {timecode(scene['start'])}–{timecode(scene['end'])} · {scene['title']}",'', '**Visual / actual operation:** '+visual[scene['id']],'', '**Narration and subtitle cues:**','']
        for cue in [c for c in CUES if c['scene']==scene['id']]:
            text += [f"- {cue['start']:.2f}–{cue['end']:.2f}s · English: {cue['en']}",f"  Japanese: {cue['ja']}",'']
        text += ['**Editing:** Retain the actual product state. Align voice to the cue timing; captions begin slightly before speech and continue through the short pause. Do not cover controls with captions.','']
    text += ['## Submission notes','', 'The local analyst is deterministic; the optional language model is server-side and has automatic local fallback. The film uses synthetic mobility data and a simplified traffic model. This is educational decision support, not official emergency guidance or verified safe navigation.','', 'Use `THUMBNAIL.png` for the video/Devpost cover. Upload the MP4 as the demo. Separate SRTs and this script are supplied for accessibility and future editing.']
    (OUT/'VIDEO_SCRIPT.md').write_text('\n'.join(text)+'\n',encoding='utf-8')


if __name__=='__main__':
    script()
    assert FINAL.exists() and FINAL.stat().st_size > 1000000
    assert abs(sum(p['duration'] for p in PLAN)-230)<.001
    assert abs(CUES[0]['start'])<.001 and abs(CUES[-1]['end']-230)<.001
    for i,c in enumerate(CUES):
        assert c['end']-c['start'] >= 1.2
        assert c['start'] <= c['audioStart'] < c['audioEnd'] <= c['end']
        if i: assert abs(CUES[i-1]['end']-c['start'])<.001
    narration = (OUT/'narration-en.txt').read_text(encoding='utf-8')
    assert narration.split() == ' '.join(c['en'] for c in CUES).split()
    for lang in ['en','ja']:
        srt=(OUT/f'subtitles-{lang}.srt').read_text(encoding='utf-8')
        blocks=srt.strip().split('\n\n')
        assert len(blocks)==len(CUES)
        for block,cue in zip(blocks,CUES):
            actual=''.join(block.splitlines()[2:])
            assert re.sub(r'\s','',actual)==re.sub(r'\s','',cue[lang])
    assert REPORT['ai']['source']=='local'
    assert REPORT['criticalLinks'][0]['name']=='Harbor Rail'
    assert REPORT['recovery'][0]['name']=='Harbor Bridge'
    assert f"{REPORT['current']['averageTravelTime']:.1f}"=='20.9'
    assert f"{REPORT['baseline']['averageTravelTime']:.1f}"=='14.2'
    assert f"{REPORT['current']['accessibility']:.1f}"=='78.9'
    assert f"{REPORT['baseline']['accessibility']:.1f}"=='94.4'
    assert round(REPORT['current']['resilienceScore'])==69
    assert REPORT['current']['disconnectedDemand']==0
    assert '426 → 3,674' in REPORT['ai']['analysis']['whyItMatters']
    assert '141%' in REPORT['ai']['analysis']['whyItMatters']
    for p in PLAN:
        if 'recording' in p:
            box=p['box'];assert box[1]+box[3] < 888
    with wave.open(str(ROOT/'assets/audio/final-mix.wav'),'rb') as wav:
        assert wav.getnchannels()==2 and wav.getframerate()==48000
        assert wav.getnframes()==230*48000
    print('Decoding all video frames and measuring final audio…',flush=True)
    result=run(['-i',str(FINAL),'-filter_complex','[0:a]ebur128=peak=true[a]','-map','0:v','-map','[a]','-f','null','-','-progress','pipe:1','-nostats'])
    (QA/'decode-and-audio.log').write_text(result.stderr,encoding='utf-8')
    frames=[int(n) for n in re.findall(r'^frame=(\d+)$',result.stdout,re.M)]
    assert frames and frames[-1]==6900, frames[-1:]  # 230 seconds × 30 fps
    assert re.search(r'Duration: 00:03:50\.00',result.stderr)
    assert re.search(r'Video: h264.*1920x1080.*30 fps',result.stderr)
    assert 'bt709' in result.stderr
    assert 'Audio: aac' in result.stderr and 'stereo' in result.stderr
    failures=re.findall(r'(?im)^.*(?:corrupt|invalid|error while|non-monoton).*$' ,result.stderr)
    assert not failures,failures
    times=[3,10,20,38,54,72,76,87,114,132,151,158,166,177,183,199,207,220,228]
    for t in times:
        run(['-loglevel','error','-y','-ss',str(t),'-i',str(FINAL),'-frames:v','1','-update','1',str(QA/f'frame-{t:03}.png')])
    tile_width,tile_height=480,298
    contact=Image.new('RGB',(tile_width*4,tile_height*5),'#102a39')
    draw=ImageDraw.Draw(contact)
    font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
    for i,t in enumerate(times):
        image=Image.open(QA/f'frame-{t:03}.png').resize((480,270),Image.Resampling.LANCZOS)
        x=(i%4)*tile_width;y=(i//4)*tile_height
        contact.paste(image,(x,y));draw.text((x+12,y+274),timecode(t),font=font,fill='white')
    contact.save(OUT/'CONTACT_SHEET.png')
    summary = result.stderr.rsplit('Summary:',1)[-1].strip()
    details={'durationSeconds':230,'resolution':[1920,1080],'framesPerSecond':30,'decodedFrames':frames[-1],'videoCodec':'H.264','audioCodec':'AAC stereo, 48 kHz','bilingualCaptions':'English above Japanese; burned in plus separate SRT','captionCueCount':len(CUES),'minimumCaptionSeconds':min(c['end']-c['start'] for c in CUES),'narrationWordCount':len(narration.split()),'wordsPerVoicedMinute':143,'actualAppVisibleSeconds':196,'actualAppPercentage':196/230*100,'appPageErrors':json.loads((ROOT/'assets/recording-qa.json').read_text())['errors'],'fullDecodeErrors':failures,'audioMeasurement':summary,'sha256':hashlib.sha256(FINAL.read_bytes()).hexdigest(),'fileBytes':FINAL.stat().st_size}
    (OUT/'VIDEO_QA.json').write_text(json.dumps(details,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(details,ensure_ascii=False,indent=2),flush=True)
