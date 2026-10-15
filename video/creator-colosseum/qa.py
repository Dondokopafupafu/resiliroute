"""Validate the finished film, evidence, audio and bilingual caption timeline."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import textwrap
import wave

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / 'tools/python'))
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
P = json.loads((ROOT/'project.json').read_text(encoding='utf-8'))
E = json.loads((ROOT/'assets/evidence.json').read_text(encoding='utf-8'))
N = json.loads((ROOT/'assets/network.json').read_text(encoding='utf-8-sig'))
C = json.loads((ROOT/'assets/cues.json').read_text(encoding='utf-8'))
PLAN = json.loads((ROOT/'edit-plan.json').read_text(encoding='utf-8'))
OUT = ROOT/'deliverables'
QA = ROOT/'build/qa'
QA.mkdir(parents=True, exist_ok=True)
FINAL = OUT/P['outputFile']

def run(args):
    r = subprocess.run([FFMPEG, '-hide_banner', *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])
    return r

def tc(t):
    return f'{int(t)//60:02}:{int(t)%60:02}'

def write_script():
    visuals = {
        'hook':'Actual Okayama map; inspect the real bridge, close it, and reveal recomputed KPIs. The opening question is visible immediately.',
        'problem':'12-second cascade diagram, then actual rerouting footage. Describe possible effects, without claiming every citywide congestion average increases.',
        'solution':'12 seconds of the working Harbor City earthquake demo, then the Real City Lab welcome interface. Both are the same application.',
        'select':'Demonstrate two-corner selection on the map and choosing the Okayama example. The following build uses the named example bounds, not the provisional rectangle.',
        'build':'Click Build Mobility Network. A real, successful uncached server request is recorded. Cut a portion of the wait, then show the actual imported graph. Large input-count callouts come from the exported snapshot.',
        'closure':'Click the actual bridge SVG path, inspect its real name and OSM ID, then click Simulate closure. Reveal measured before/after callouts only in the results cut.',
        'reroute':'Compare the modeled residential origin and Kawasaki Medical School General Medical Center destination. Gray dashed baseline and solid navy scenario paths. Verify the actual UI says 4.4 → 7.2 minutes.',
        'analytics':'Inspect the actual alternative road and its modeled flow, then show district/access charts. The local increase is real although the citywide congestion index decreases.',
        'critical':'Show the screened critical-road ranking and click its top row to highlight the actual road on the map. A 35-candidate screen is disclosed, not presented as exhaustive.',
        'recovery':'Close the top additional road, compare two independent one-road repairs, then click the leading restoration. Show 95.9% access and the computed +17.4 resilience/+4.1 access gains.',
        'how':'Ten seconds of the eight-stage architecture diagram, followed by the real Methodology dialog. Display the verified 63 unit tests and 42 desktop/mobile browser checks.',
        'ai':'Show the actual local resilience brief, then Data & assumptions. The optional server LLM is described, not portrayed as a live provider call.',
        'business':'Export the real network snapshot, show a short proposed education/professional/organization model, then demonstrate Japanese/English switching. No customers, revenue, existing commercial plans or pilots are claimed.',
        'closing':'Actual disrupted network, then a five-second end card. Show the correct GitHub URL, earlier ImpactHack version and AI-assisted development disclosure.'
    }
    words=sum(len(c['en'].split()) for c in C)
    actual=sum(p['duration'] for p in PLAN if 'recording' in p)
    lines=['# ResiliRoute — Creator Colosseum Pitch & Demo', '',
        f'**Master:** {tc(P["duration"])} · 1920×1080 · 30fps · H.264/AAC · {words} English narrated words at {P["speakingRate"]} words per voiced minute.', '',
        f'Actual app footage: {actual:.0f}/{P["duration"]} seconds ({actual/P["duration"]*100:.1f}%). Harbor City: 12 seconds; Real City Lab: {actual-12:.0f} seconds. English above Japanese captions, in a separate lower strip. Original ambient score approximately 19 dB below speech.', '',
        '## Verified implementation and case selection', '',
        'The filmed production application implements two modes, OSM server import, simplified road graphs with detailed geometry, one-way routing, modeled OD demand, 24-step assignment, bounded BPR costs, essential access, efficiency/resilience, candidate stress tests, independent recoveries, local/optional LLM briefs, bilingual UI and network snapshots.', '',
        'Okayama was chosen because the captured bounds contain a river crossing, real hospitals, a legible road network and measurable detours. The 2.75 km² model has 687 road decision nodes, 983 road segments, 18 modeled origins and 54 OD pairs. Station/shelter categories are absent and are not invented.', '',
        f'Bridge: {E["closed"]["name"]} · OSM way {E["closed"]["osm"]["wayId"]}. Network travel: {E["baseline"]["averageTravelTime"]:.1f} → {E["current"]["averageTravelTime"]:.1f} min. Resilience: 100 → {E["current"]["resilienceScore"]:.0f}. Medical journey: {E["routes"][0]["before"]["travelTime"]:.1f} → {E["routes"][0]["after"]["travelTime"]:.1f} min.', '',
        f'Alternative-road flow: {E["flows"][0]["before"]["volume"]:.0f} → {E["flows"][0]["after"]["volume"]:.0f} modeled units/hour. With two closures: access {E["multiple"]["accessibility"]:.1f}%, resilience {E["multiple"]["resilienceScore"]:.0f}. Leading independent repair adds {E["multiRecovery"][0]["resilienceGain"]:.1f} resilience and {E["multiRecovery"][0]["accessibilityGain"]:.1f} access points.', '',
        'The live import is shown once; later takes import the captured actual OSM snapshot through the product interface. No API response, metric, label or graph geometry is mocked for this film. The cursor/rings are capture overlays at actual pointer positions. Crops and cuts remove waiting; the footage is not sped up.', '',
        '## Timeline, narration, subtitles and shot list', '']
    for scene in P['scenes']:
        lines += [f'### {tc(scene["start"])}–{tc(scene["end"])} · {scene["title"]}', '',
            '**Screen action:** '+visuals[scene['id']], '',
            '**Editing:** Cuts and 0.18-second fades only. Keep product content above y=858; captions start below y=888. All numerical callouts are read from the survey evidence. On-screen slides are English; actual OSM proper names retain their source spelling.', '']
        for c in [x for x in C if x['scene']==scene['id']]:
            lines += [f'**{c["start"]:.2f}–{c["end"]:.2f}s**', '',
                'English narration/subtitle: '+c['en'], '', 'Japanese subtitle: '+c['ja'], '']
    lines += ['## Evidence and disclosures', '',
        'Evidence: `assets/network.json`, `evidence.json`, `live-build-proof.json`, `route-ui-proof.json`, captured UI stills and recording manifest. The survey calls the existing pure simulation functions; it does not implement a second simulator.', '',
        'OpenStreetMap supplies geometry, classification, facilities and available speed/lane tags. Capacity, demand, proxies and connectors are modeled. Boundary clipping excludes detours outside the rectangle. No traffic accuracy, disaster probability or safety certification is claimed.', '',
        'An earlier version was developed for ImpactHack 2026. AI-assisted tools were used for implementation, debugging, testing and iteration; product decisions, evaluation and submission are directed by the creator. The recorded analyst is deterministic local analysis; the optional cloud LLM remains separate.', '',
        'Startup tiers and pilot activities are future proposals pending customer validation. The video does not claim existing municipal use or commercial contracts.', '',
        'The competition recommends a five-minute pitch and asks prior work/tools to be credited: [official overview](https://creatorcolosseumshowdown.devpost.com/) and [rules](https://creatorcolosseumshowdown.devpost.com/rules).']
    (OUT/'VIDEO_SCRIPT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

if __name__=='__main__':
    write_script()
    if '--script-only' in sys.argv:
        print('Timecoded English/Japanese script and shot list ready.')
        sys.exit(0)
    assert P['duration']==294 and sum(p['duration'] for p in PLAN)==294
    assert FINAL.exists() and FINAL.stat().st_size>1_000_000
    words=(OUT/'narration-en.txt').read_text(encoding='utf-8').split()
    assert words==' '.join(c['en'] for c in C).split()
    assert 600<=len(words)<=700
    assert C[0]['start']==0 and C[-1]['end']==294
    en_font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',33)
    caption_lines=[]
    for i,c in enumerate(C):
        assert c['end']-c['start']>=1.2
        assert c['start']<=c['audioStart']<c['audioEnd']<=c['end']
        if i:assert abs(C[i-1]['end']-c['start'])<.001
        lines=textwrap.wrap(c['en'],width=94)
        assert len(lines)<=2, 'English captions would overlap the Japanese row'
        assert all(en_font.getlength(line)<1790 for line in lines)
        caption_lines.append(len(lines))
    for lang in ['en','ja']:
        blocks=(OUT/f'subtitles-{lang}.srt').read_text(encoding='utf-8').strip().split('\n\n')
        assert len(blocks)==len(C)
        for b,c in zip(blocks,C):assert re.sub(r'\s','',''.join(b.splitlines()[2:]))==re.sub(r'\s','',c[lang])
    for p in PLAN:
        if 'recording' in p:assert p['box'][1]+p['box'][3]<888
    proof=json.loads((ROOT/'assets/live-build-proof.json').read_text(encoding='utf-8'))
    assert proof['success'] and proof['stats']==N['stats']
    rp=json.loads((ROOT/'assets/route-ui-proof.json').read_text(encoding='utf-8'))
    destination=next(n for n in N['network']['nodes'] if n['id']==rp['destination'])
    assert destination['type']=='hospital'
    assert rp['destination']==E['routes'][0]['od']['destination']
    assert '4.4 min' in rp['text'] and '7.2 min' in rp['text']
    assert round(E['baseline']['averageTravelTime'],1)==2.8
    assert round(E['current']['averageTravelTime'],1)==3.4
    assert round(E['multiple']['accessibility'],1)==95.9
    assert round(E['multiRecovery'][0]['resilienceGain'],1)==17.4
    assert round(E['multiRecovery'][0]['accessibilityGain'],1)==4.1
    assert not json.loads((ROOT/'assets/recording-errors.json').read_text(encoding='utf-8'))
    with wave.open(str(ROOT/'assets/audio/final-mix.wav')) as w:
        assert w.getframerate()==48000 and w.getnchannels()==2 and w.getnframes()==294*48000
    print('Decoding all 8,820 frames and measuring audio…',flush=True)
    r=run(['-i',str(FINAL),'-filter_complex','[0:a]ebur128=peak=true[a]','-map','0:v','-map','[a]','-f','null','-','-progress','pipe:1','-nostats'])
    (QA/'decode.log').write_text(r.stderr,encoding='utf-8')
    frames=[int(x) for x in re.findall(r'^frame=(\d+)$',r.stdout,re.M)]
    assert frames[-1]==8820
    assert 'Duration: 00:04:54.00' in r.stderr
    assert re.search(r'Video: h264.*1920x1080.*30 fps',r.stderr)
    assert 'Audio: aac' in r.stderr and 'stereo' in r.stderr
    failures=re.findall(r'(?im)^.*(?:corrupt|invalid|error while|non-monoton).*$',r.stderr)
    assert not failures
    def loudness(path):
        log=run(['-i',str(path),'-af','ebur128=peak=true','-f','null','-']).stderr
        summary=log.rsplit('Summary:',1)[-1]
        return float(re.search(r'I:\s*(-?[\d.]+) LUFS',summary).group(1))
    voice=loudness(ROOT/'assets/audio/narration-normalized.wav')
    music=loudness(ROOT/'assets/audio/bgm.wav')
    assert 15<=voice-music<=22
    times=[3,19,30,42,59,72,86,100,108,115,123,132,145,152,162,169,175,183,190,197,208,220,235,246,258,270,281,292]
    contact=Image.new('RGB',(1920,294*7),'#102a39')
    draw=ImageDraw.Draw(contact)
    font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
    for i,t in enumerate(times):
        path=QA/f'frame-{t:03}.png'
        run(['-loglevel','error','-y','-ss',str(t),'-i',str(FINAL),'-frames:v','1',str(path)])
        tile=Image.open(path).resize((480,270),Image.Resampling.LANCZOS)
        x=(i%4)*480;y=(i//4)*294
        contact.paste(tile,(x,y));draw.text((x+12,y+273),tc(t),font=font,fill='white')
    contact.save(OUT/'CONTACT_SHEET.png')
    app=sum(p['duration'] for p in PLAN if 'recording' in p)
    qa={'durationSeconds':294,'resolution':[1920,1080],'framesPerSecond':30,'decodedFrames':frames[-1],'videoCodec':'H.264','audioCodec':'AAC stereo / 48kHz','narrationWords':len(words),'voicedWordsPerMinute':P['speakingRate'],'captionCues':len(C),'minimumCaptionSeconds':min(c['end']-c['start'] for c in C),'maxEnglishCaptionLines':max(caption_lines),'subtitleLanguages':['English','Japanese'],'appFootageSeconds':app,'appFootagePercentage':app/294*100,'realCitySeconds':app-12,'harborCitySeconds':12,'narrationLUFS':voice,'musicLUFS':music,'musicBelowNarrationDB':voice-music,'fullDecodeErrors':failures,'appPageErrors':[],'actualLiveBuildVerified':True,'hospitalRouteVerified':rp,'sha256':hashlib.sha256(FINAL.read_bytes()).hexdigest(),'fileBytes':FINAL.stat().st_size}
    (OUT/'VIDEO_QA.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(qa,ensure_ascii=True,indent=2),flush=True)
