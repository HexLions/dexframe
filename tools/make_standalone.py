#!/usr/bin/env python3
"""Build a single-file dexframe.html for opening without a server.

Embeds the Silkscreen fonts and, if present, your own images as data: URIs.
Each image set is a folder with a legend.json listing PNGs ("png" paths are
relative to that folder):

  python3 tools/make_standalone.py .                         # data/www/ribbons, data/www/trainers
  python3 tools/make_standalone.py . --trainers ~/pack-dir   # embed a set kept outside the project

Opened from a PC, the page drives the display through "Display address".
"""
import argparse, base64, gzip, json, pathlib

ap = argparse.ArgumentParser()
ap.add_argument('root', nargs='?', default='.')
ap.add_argument('--ribbons', help='folder with legend.json (default: data/www/ribbons)')
ap.add_argument('--trainers', help='folder with legend.json (default: data/www/trainers)')
args = ap.parse_args()

root = pathlib.Path(args.root)
www = root / 'data' / 'www'
html = (www / 'index.html').read_text(encoding='utf-8')

for w in ('Regular', 'Bold'):
    b64 = base64.b64encode((www / 'fonts' / f'Silkscreen-{w}.ttf').read_bytes()).decode()
    html = html.replace(f'url(fonts/Silkscreen-{w}.ttf)', f'url(data:font/ttf;base64,{b64})')
assert 'url(fonts/' not in html, 'font not embedded'


def embed_folder(folder, label):
    """legend.json + the PNGs it lists, as {'legend': [...], 'files': {png: data-uri}}."""
    folder = pathlib.Path(folder).expanduser()
    legend_path = folder / 'legend.json'
    if not legend_path.exists():
        return None
    legend = json.loads(legend_path.read_text(encoding='utf-8'))
    if isinstance(legend, dict):
        legend = legend.get('items') or legend.get('legend') or []
    files, missing = {}, 0
    for e in legend:
        f = folder / e['png']
        if f.exists():
            files[e['png']] = 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode()
        else:
            missing += 1
    print(f'{label}: embedded {len(files)} images' + (f', {missing} missing' if missing else ''))
    return {'legend': legend, 'files': files}


ribbons = embed_folder(args.ribbons or www / 'ribbons', 'ribbons')
trainers = embed_folder(args.trainers or www / 'trainers', 'trainers')
# data for the .pk4-.pk9 import (tools/build_pkx_data.py)
pkx = {f.name.split('.')[0]: json.loads(gzip.decompress(f.read_bytes()))
       for f in sorted((www / 'pkx').glob('*.json.gz'))}
if pkx:
    print(f'pkx: embedded {", ".join(pkx)}')
if ribbons or trainers or pkx:
    data = dict(ribbons or {'legend': [], 'files': {}})
    if trainers:
        data['trainers'] = trainers
    if pkx:
        data['pkx'] = pkx
    embed = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    html = html.replace('<script>\n"use strict";', f'<script>window.DEXFRAME_EMBED = {embed};</script>\n<script>\n"use strict";', 1)
    assert 'DEXFRAME_EMBED = ' in html, 'embed marker not found'

out = root / 'dexframe.html'
out.write_text(html, encoding='utf-8')
print(out, f'{out.stat().st_size / 1e6:.1f} MB')
