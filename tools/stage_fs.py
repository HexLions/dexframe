#!/usr/bin/env python3
"""Copies data/ into the folder the LittleFS image is built from, with the text files
of the web UI gzipped (the board serves x.gz for x): index.html shrinks from ~270 KB
to ~70 KB on the board. data/ itself stays readable in the repository.

  python3 tools/stage_fs.py --out .pio/fsdata

PlatformIO runs it by itself before buildfs/uploadfs (tools/pio_stage_fs.py).
"""
import argparse
import gzip
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GZIP = {'.html', '.css', '.js', '.ttf', '.json', '.svg'}

ap = argparse.ArgumentParser()
ap.add_argument('--src', type=Path, default=ROOT / 'data')
ap.add_argument('--out', type=Path, required=True)
a = ap.parse_args()

if a.out.exists():
    shutil.rmtree(a.out)
total = 0
for f in sorted(a.src.rglob('*')):
    if f.is_dir() or f.name.startswith('.'):
        continue
    rel = f.relative_to(a.src)
    dst = a.out / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    if f.suffix.lower() in GZIP and not (a.out / (str(rel) + '.gz')).exists():
        data = gzip.compress(f.read_bytes(), compresslevel=9, mtime=0)
        dst = dst.with_name(dst.name + '.gz')
        dst.write_bytes(data)
    else:
        shutil.copyfile(f, dst)
    total += dst.stat().st_size
print(f'{a.out}: {total // 1024} KB')
