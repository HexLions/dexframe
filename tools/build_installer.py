#!/usr/bin/env python3
"""Builds the web installer site (GitHub Pages): the page in installer/, the factory
images, one ESP Web Tools manifest per panel and the ESP Web Tools files themselves.

  python3 tools/build_installer.py --dist dist --ewt package/dist/web --version 1.6.0 --out site

--dist  folder with dexframe-<panel>-factory.bin (tools/package_release.py)
--ewt   dist/web folder of the esp-web-tools npm package (`npm pack esp-web-tools`):
        copied next to the page, so the installer loads nothing from a CDN
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# panel build -> (label, note). Builds without an entry are listed by their id.
PANELS = {
    'bw': ('4.2" black / white', 'GDEY042T81 · day counter updates without a flash'),
    'bwr': ('4.2" black / white / red', 'GDEY042Z98'),
    'bwry': ('4.2" black / white / red / yellow', 'GDEY0420F51 · experimental, not tested on hardware'),
}

ap = argparse.ArgumentParser()
ap.add_argument('--dist', type=Path, required=True)
ap.add_argument('--ewt', type=Path, required=True)
ap.add_argument('--version', required=True)
ap.add_argument('--out', type=Path, default=Path('site'))
a = ap.parse_args()

bins = sorted(a.dist.glob('dexframe-*-factory.bin'), key=lambda p: (list(PANELS).index(p.name.split('-')[1]) if p.name.split('-')[1] in PANELS else 99, p.name))
if not bins:
    sys.exit(f'no dexframe-*-factory.bin in {a.dist}')
if not (a.ewt / 'install-button.js').exists():
    sys.exit(f'{a.ewt}: install-button.js not found (expected the dist/web folder of esp-web-tools)')

if a.out.exists():
    shutil.rmtree(a.out)
(a.out / 'firmware').mkdir(parents=True)
shutil.copyfile(ROOT / 'installer/index.html', a.out / 'index.html')
shutil.copytree(a.ewt, a.out / 'ewt')
version = a.version.lstrip('v')
panels = []
for b in bins:
    pid = re.match(r'dexframe-(.+)-factory\.bin$', b.name).group(1)
    label, note = PANELS.get(pid, (pid, ''))
    shutil.copyfile(b, a.out / 'firmware' / b.name)
    manifest = {
        'name': f'DexFrame ({label})', 'version': version, 'new_install_prompt_erase': False,
        # the factory image is the whole flash: bootloader, partitions, firmware, web UI
        'builds': [{'chipFamily': 'ESP32', 'parts': [{'path': f'firmware/{b.name}', 'offset': 0}]}],
    }
    (a.out / f'manifest-{pid}.json').write_text(json.dumps(manifest, indent=2) + '\n')
    panels.append({'id': pid, 'label': label, 'note': note, 'manifest': f'manifest-{pid}.json'})
(a.out / 'panels.json').write_text(json.dumps({'version': version, 'panels': panels}, indent=2) + '\n')
print(f'{a.out}: {len(panels)} panels ({", ".join(p["id"] for p in panels)}), version {version}')
