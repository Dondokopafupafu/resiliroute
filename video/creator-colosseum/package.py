"""Bundle reviewed deliverables without recordings, environment files or credentials."""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'deliverables'
FILES = [
    'final-creator-colosseum-resiliroute.mp4',
    'THUMBNAIL.png',
    'narration-en.txt',
    'subtitles-en.srt',
    'subtitles-ja.srt',
    'VIDEO_SCRIPT.md',
    'VIDEO_QA.json',
    'PLAYBACK_QA.json',
    'CONTACT_SHEET.png',
    'DELIVERY_README.md',
]
for name in FILES:
    assert (OUT / name).is_file(), f'Missing deliverable: {name}'
target = OUT / 'resiliroute-creator-colosseum-submission.zip'
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    for name in FILES:
        compression = zipfile.ZIP_STORED if name.endswith(('.mp4', '.png')) else zipfile.ZIP_DEFLATED
        bundle.write(OUT / name, name, compress_type=compression)
print(f'Submission bundle ready: {target.name} ({target.stat().st_size / 1_000_000:.1f} MB)')
