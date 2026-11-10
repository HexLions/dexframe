#!/usr/bin/env python3
"""Frame codec round trip: the web UI encoder (JavaScript, taken from data/www/index.html)
against the firmware decoder (include/frame_codec.h, built for the host).

  python3 tests/test_codec.py        needs node and g++
"""
import json
import random
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / 'data/www/index.html').read_text(encoding='utf-8')
m = re.search(r'// <codec>.*?\n(.*?)// </codec>', html, re.S)
if not m:
    sys.exit('codec markers not found in index.html')

rng = random.Random(7)


def cases():
    yield 'white', 400, 300, 1, [0] * 120000
    yield 'black', 400, 300, 1, [1] * 120000
    yield 'checker', 400, 300, 1, [(x + y) & 1 for y in range(300) for x in range(400)]
    yield 'noise-bw', 400, 300, 1, [rng.randrange(2) for _ in range(120000)]
    yield 'noise-bwr', 400, 300, 2, [rng.randrange(3) for _ in range(120000)]
    yield 'noise-4c', 400, 300, 2, [rng.randrange(4) for _ in range(120000)]
    yield 'noise-6c', 800, 480, 3, [rng.randrange(6) for _ in range(384000)]
    yield 'tiny', 3, 1, 1, [1, 0, 1]
    yield 'run-15-16-17', 48, 1, 1, [1] * 15 + [0] * 16 + [1] * 17
    yield 'run-long', 800, 480, 3, [5] * 200000 + [0] * 184000
    # page-like: big flat areas, a dithered block, thin lines, some red
    px = [0] * 120000
    for y in range(300):
        for x in range(400):
            i = y * 400 + x
            if y < 30 or x in (0, 399):
                px[i] = 1
            elif 60 <= y < 200 and 40 <= x < 180:
                px[i] = (x ^ y) & 1 if (x // 8 + y // 8) % 3 else 1
            elif 250 <= y < 256:
                px[i] = 2
    yield 'page', 400, 300, 2, px


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    exe = tmp / 'decode'
    subprocess.run(['g++', '-std=c++14', '-O1', '-Wall', '-Werror', '-o', str(exe), str(ROOT / 'tests/decode_host.cpp')], check=True)
    js = tmp / 'enc.js'
    js.write_text(m.group(1) + '''
const fs = require('fs');
const c = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.writeFileSync(process.argv[3], encodeFrame(Uint8Array.from(c.px), c.w, c.h, c.bpp));
''')
    failed = 0
    good = None
    for name, w, h, bpp, px in cases():
        src, out = tmp / 'in.json', tmp / 'frame.bin'
        src.write_text(json.dumps({'w': w, 'h': h, 'bpp': bpp, 'px': px}))
        subprocess.run(['node', str(js), str(src), str(out)], check=True)
        r = subprocess.run([str(exe), str(out)], capture_output=True)
        size, raw = out.stat().st_size, 12 + (w * h * bpp + 7) // 8
        ok = r.returncode == 0 and r.stdout == bytes(px) and size <= raw + raw // 64 + 64
        failed += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {name:14} {w}x{h} {bpp} bpp  {size:7} bytes  ({100 * size / raw:.0f}% of raw)")
        if name == 'page':
            good = out.read_bytes()

    # damaged files must be rejected, not drawn
    bad = {
        'truncated': good[:-1],
        'trailing byte': good + b'\x00',
        'bad magic': b'DXF2' + good[4:],
        'bpp 0': good[:8] + b'\x00' + good[9:],
        'ink 7 run': good[:12] + b'\x7f\xff\xff\x07',
        'literal past the end': good[:12] + b'\xff\xff\xff\x7f' + good[12:],
        'empty': b'',
    }
    for name, data in bad.items():
        f = tmp / 'bad.bin'
        f.write_bytes(data)
        ok = subprocess.run([str(exe), str(f)], capture_output=True).returncode == 1
        failed += not ok
        print(f"{'ok  ' if ok else 'FAIL'} rejects {name}")

sys.exit(1 if failed else 0)
