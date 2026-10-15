"""Reproducible local edit: actual web recordings + title plates + audio + bilingual captions."""
import json
import os
from pathlib import Path
import subprocess
import sys

TOOLS_ROOT = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('RESILIROUTE_VIDEO_DIR', str(TOOLS_ROOT))).resolve()
sys.path.insert(0, str(TOOLS_ROOT / 'tools/python'))
import imageio_ffmpeg

FFMPEG = os.environ.get('FFMPEG_PATH') or imageio_ffmpeg.get_ffmpeg_exe()
PROJECT = json.loads((ROOT / 'project.json').read_text(encoding='utf-8'))
PLAN = json.loads((ROOT / 'edit-plan.json').read_text(encoding='utf-8'))
RECORDINGS = json.loads((ROOT / 'assets/recordings.json').read_text(encoding='utf-8'))
BUILD = ROOT / 'build'
BUILD.mkdir(exist_ok=True)
assert abs(sum(p['duration'] for p in PLAN) - PROJECT['duration']) < .001
assert PROJECT['duration'] < PROJECT.get('maxDuration', 240)


def encode_part(part):
    target = BUILD / f"{part['id']}.mp4"
    signature_path = target.with_suffix('.source.json')
    signature = json.dumps(part,sort_keys=True) + str((ROOT / f"assets/frames/{part['background']}.png").stat().st_mtime_ns)
    if 'recording' in part:
        signature += str((ROOT / RECORDINGS[part['recording']]['path']).stat().st_mtime_ns)
    if 'overlay' in part:
        signature += str((ROOT / f"assets/frames/{part['overlay']}.png").stat().st_mtime_ns)
    if '--resume' in sys.argv and target.exists() and signature_path.exists() and signature_path.read_text()==signature:
        return target
    duration = part['duration']
    args = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '30', '-i', str(ROOT / f"assets/frames/{part['background']}.png")]
    output_label = '0:v'
    chain = []
    if 'recording' in part:
        recording = RECORDINGS[part['recording']]
        seek = recording['trim'] + part.get('offset', 0)
        args += ['-ss', str(seek), '-i', str(ROOT / recording['path'])]
        x, y, width, height = part['crop']
        left, top, box_width, box_height = part['box']
        scale = min(box_width / width, box_height / height)
        scaled_width = round(width * scale / 2) * 2
        scaled_height = round(height * scale / 2) * 2
        at_x = round(left + (box_width - scaled_width) / 2)
        at_y = round(top + (box_height - scaled_height) / 2)
        assert at_y + scaled_height <= 858, 'Product UI would overlap the reserved subtitle area'
        chain += [f'[1:v]crop={width}:{height}:{x}:{y},scale={scaled_width}:{scaled_height}:flags=lanczos,setsar=1,fps=30,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=2[app]', f'[0:v][app]overlay={at_x}:{at_y}:shortest=1[composite]']
        output_label = 'composite'
        if 'overlay' in part:
            args += ['-loop','1','-framerate','30','-i',str(ROOT / f"assets/frames/{part['overlay']}.png")]
            chain += ['[composite][2:v]overlay=0:0[graphic]']
            output_label = 'graphic'
    fades = []
    if part.get('fadeIn'):
        fades.append('fade=t=in:st=0:d=0.18:color=0x102a39')
    if part.get('fadeOut'):
        fades.append(f'fade=t=out:st={duration-.18}:d=0.18:color=0x102a39')
    if fades:
        chain.append(f'[{output_label}]'+','.join(fades)+'[finished]')
        output_label = 'finished'
    if chain:
        args += ['-filter_complex', ';'.join(chain), '-map', f'[{output_label}]']
    else:
        args += ['-map', '0:v']
    args += ['-an','-t',str(duration),'-c:v','libx264','-crf','17','-preset','fast','-threads','4','-pix_fmt','yuv420p','-r','30','-fps_mode','cfr','-video_track_timescale','30000',str(target)]
    print(f"Rendering {part['id']} ({duration}s)",flush=True)
    subprocess.run(args, check=True, cwd=ROOT)
    signature_path.write_text(signature)
    return target


if __name__ == '__main__':
    files = [encode_part(p) for p in PLAN]
    concat = BUILD / 'concat.txt'
    concat.write_text('\n'.join("file '"+f.as_posix()+"'" for f in files),encoding='utf-8')
    silent = BUILD / 'picture.mp4'
    subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(silent)],check=True)
    target = ROOT / 'deliverables' / PROJECT.get('outputFile', 'final-impacthack-resiliroute.mp4')
    # Relative ASS path avoids Windows drive-letter escaping in the filter graph.
    args = [FFMPEG,'-hide_banner','-y','-i',str(silent),'-i',str(ROOT/'assets/audio/final-mix.wav'),'-vf','scale=in_color_matrix=bt601:out_color_matrix=bt709:out_range=tv,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,ass=assets/subtitles.ass','-map','0:v','-map','1:a','-c:v','libx264','-crf','18','-preset','fast','-threads','4','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-r','30','-fps_mode','cfr','-c:a','aac','-b:a','192k','-ar','48000','-t',str(PROJECT['duration']),'-movflags','+faststart','-metadata','title=ResiliRoute — Urban Mobility Resilience Simulator','-metadata','comment='+PROJECT.get('comment', 'Actual app demonstration. Synthetic educational network. English voice; English and Japanese burned-in subtitles.'),str(target)]
    print('Burning bilingual captions and muxing final audio…',flush=True)
    with (BUILD/'final-encode.log').open('w',encoding='utf-8') as log:
        subprocess.run(args,check=True,cwd=ROOT,stderr=log)
    print(f'Final MP4 ready: {target}',flush=True)
