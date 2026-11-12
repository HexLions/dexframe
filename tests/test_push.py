#!/usr/bin/env python3
"""tools/push.py: the frames it makes must decode with the firmware decoder, for every
ink set (text and picture).

  pip install pillow && python3 tests/test_push.py        needs g++
"""
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import push  # noqa: E402

fails = 0
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    dec = tmp / 'dec'
    subprocess.run(['g++', '-std=c++14', '-O1', '-o', str(dec), str(ROOT / 'tests/decode_host.cpp')], check=True)
    pic = push.Image.open(ROOT / 'docs/colour.png').convert('RGB')
    for palette in (['white', 'black'], ['white', 'black', 'red'], ['white', 'black', 'red', 'yellow'],
                    ['white', 'black', 'red', 'yellow', 'blue', 'green']):
        bpp = 3 if len(palette) > 4 else 2 if len(palette) > 2 else 1
        for name, img in (('text', push.text_image(400, 300, 'Hello from a script', 'Test')),
                          ('picture', push.ImageOps.pad(pic, (400, 300), color='white'))):
            px = push.to_inks(img, palette)
            f = tmp / 'f.bin'
            f.write_bytes(push.encode_frame(px, 400, 300, bpp))
            r = subprocess.run([str(dec), str(f)], capture_output=True)
            ok = r.returncode == 0 and r.stdout == bytes(px)
            fails += not ok
            print(f"{'ok  ' if ok else 'FAIL'} {name:8} {'/'.join(palette):34} {f.stat().st_size:6} bytes")
sys.exit(1 if fails else 0)
