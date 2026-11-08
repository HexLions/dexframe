#!/usr/bin/env python3
"""Builds data/www/pkx/sprites.json.gz: the list of ribbon, mark and badge images
in PokeAPI/sprites (file names only, no images). The browser loads the images
from raw.githubusercontent.com at runtime, like the Pokémon sprites.

  git clone --depth 1 --filter=blob:none --no-checkout https://github.com/PokeAPI/sprites.git /tmp/sprites
  python3 tools/build_sprite_catalog.py /tmp/sprites
"""
import argparse, gzip, json, re, subprocess
from pathlib import Path

GENS = {'generation-iii': 3, 'generation-iv': 4, 'generation-v': 5, 'generation-vi': 6,
        'generation-vii': 7, 'generation-viii': 8, 'generation-ix': 9}
REGIONS = {'hoenn', 'sinnoh'}


def title(stem):
    """beauty-ribbon-great-sinnoh -> Beauty Ribbon Great (Sinnoh)"""
    words = stem.split('-')
    region = words.pop() if words[-1] in REGIONS and len(words) > 2 else None
    out = ' '.join(w.capitalize() for w in words).replace('Absent Minded', 'Absent-Minded')
    return f'{out} ({region.capitalize()})' if region else out


ap = argparse.ArgumentParser()
ap.add_argument('sprites', type=Path, help='PokeAPI/sprites checkout (a treeless clone is enough)')
ap.add_argument('--out', type=Path, default=Path(__file__).resolve().parent.parent / 'data/www/pkx/sprites.json.gz')
a = ap.parse_args()
files = subprocess.run(['git', '-C', str(a.sprites), 'ls-tree', '-r', '--name-only', 'HEAD', 'sprites/ribbons', 'sprites/marks', 'sprites/badges'],
                       capture_output=True, text=True, check=True).stdout.split()
cat = {'ribbons': [], 'marks': [], 'badges': []}
for f in files:
    parts = f.split('/')
    if parts[1] == 'badges':
        m = re.match(r'(\d+)\.png$', parts[2])
        if m: cat['badges'].append(int(m.group(1)))
        continue
    if len(parts) != 4 or parts[2] not in GENS or not f.endswith('.png'):
        continue
    stem = parts[3][:-4]
    cat[parts[1]].append([f'{parts[1]}/{parts[2]}/{parts[3]}', GENS[parts[2]], title(stem)])
for k in ('ribbons', 'marks'):
    cat[k].sort(key=lambda e: (e[1], e[2]))
cat['badges'].sort()
raw = json.dumps(cat, separators=(',', ':')).encode()
a.out.write_bytes(gzip.compress(raw, 9, mtime=0))
print(a.out, {k: len(v) for k, v in cat.items()}, len(raw) // 1024, 'KB')
