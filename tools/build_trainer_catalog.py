#!/usr/bin/env python3
"""Builds data/www/pkx/trainers.json.gz: the list of trainer sprite file names on
Pokémon Showdown (names only, no images). The picker shows them as thumbnails;
when you pick one, the ESP32 downloads that single PNG into /www/trainers/sd/
(the Showdown server sends no CORS header, so the browser can't read it directly).

  python3 tools/build_trainer_catalog.py            # reads the live directory listing
  python3 tools/build_trainer_catalog.py --html listing.html
"""
import argparse, gzip, json, re, urllib.request
from pathlib import Path

URL = 'https://play.pokemonshowdown.com/sprites/trainers/'
ap = argparse.ArgumentParser()
ap.add_argument('--html', type=Path, help='saved copy of the directory listing')
ap.add_argument('--out', type=Path, default=Path(__file__).resolve().parent.parent / 'data/www/pkx/trainers.json.gz')
a = ap.parse_args()
html = a.html.read_text(encoding='utf-8') if a.html else \
    urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent': 'DexFrame catalog'}), timeout=30).read().decode()
files = sorted(set(re.findall(r'href="(?:\./)?([a-z0-9][a-z0-9._-]*\.png)"', html)))
out = []
for f in files:
    stem = f[:-4]
    name, _, variant = stem.partition('-')
    gen = re.search(r'gen(\d+)', variant)
    out.append([f, name, variant, int(gen.group(1)) if gen else None])
raw = json.dumps(out, separators=(',', ':')).encode()
a.out.write_bytes(gzip.compress(raw, 9, mtime=0))
print(a.out, len(out), 'trainers,', len(raw) // 1024, 'KB ->', a.out.stat().st_size // 1024, 'KB gz')
