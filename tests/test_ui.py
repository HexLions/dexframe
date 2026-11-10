#!/usr/bin/env python3
"""End-to-end check of the web UI against a fake board, one run per panel type.

Opens data/www/index.html in headless Chromium, answers the /api/* calls like the
firmware would, presses "Send all pages" and checks every frame that arrives:
right format for the firmware, decodable by the firmware decoder, only inks the
panel has, and a day counter the board can redraw pixel for pixel.

  pip install playwright && playwright install chromium
  python3 tests/test_ui.py            (CHROME=/path/to/chrome to use an installed browser)

No network needed: requests to other hosts are blocked, every image is a made-up sprite.
"""
import asyncio
import datetime
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
W, H = 400, 300
INKS = ['white', 'black', 'red', 'yellow', 'blue', 'green', 'orange']
PANELS = [  # id, palette, firmware API level (None = firmware 1.4.0: raw two-plane pages)
    ('bw', ['white', 'black'], 2),
    ('bwr', ['white', 'black', 'red'], 2),
    ('bwry', ['white', 'black', 'red', 'yellow'], 2),
    ('bwr', ['white', 'black', 'red'], None),
]


def fake_sprite(size=64):
    """A shaded ball with an outline and a red patch, as a PNG: stands in for every sprite."""
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            d = ((x - size / 2) ** 2 + (y - size / 2) ** 2) ** 0.5
            if d > size * 0.42:
                rows += bytes(4)
            elif d > size * 0.38:
                rows += bytes((20, 20, 30, 255))
            elif x > size * 0.55 and y > size * 0.55:
                rows += bytes((220, 40, 40, 255))
            else:
                v = 90 + int(150 * (1 - d / (size * 0.4)))
                rows += bytes((v // 2, v, min(255, v + 20), 255))
    chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) +
            chunk(b'IDAT', zlib.compress(bytes(rows))) + chunk(b'IEND', b''))


SPRITE = fake_sprite()


def file_part(req):
    boundary = re.search(r'boundary=(.+)', req.headers.get('content-type', '')).group(1).encode()
    part = req.post_data_buffer.split(b'--' + boundary)[1]
    return part.split(b'\r\n\r\n', 1)[1].rsplit(b'\r\n', 1)[0]


def paint_overlay(px, ov, g, today):
    """Mirror of layoutOverlay() + paintOverlay() in src/main.cpp."""
    x0, y0, w, h, align, start, color, sep = map(int, ov.split(','))
    gw, gh, n = g[0], g[1], g[2]
    adv, bits, stride = g[3:3 + n], g[3 + n:], (g[0] + 7) // 8
    digits, idx = str(max(0, today - start)), []
    for i, c in enumerate(digits):
        if sep and n > 10 and i > 0 and (len(digits) - i) % 3 == 0:
            idx.append(10)
        idx.append(int(c))
    total = sum(adv[i] for i in idx)
    x = x0 + w - total if align == 2 else x0 + (w - total) // 2 if align == 1 else x0
    out = bytearray(px)
    for yy in range(y0, y0 + h):
        out[yy * W + x0:yy * W + x0 + w] = bytes(w)
    for k in idx:
        glyph = bits[k * gh * stride:(k + 1) * gh * stride]
        for gy in range(min(gh, h)):
            for gx in range(gw):
                if glyph[gy * stride + (gx >> 3)] & (0x80 >> (gx & 7)):
                    p = x - 2 + gx
                    if x0 <= p < x0 + w:
                        out[(y0 + gy) * W + p] = color + 1
        x += adv[k]
    return bytes(out)


async def run_panel(browser, decoder, tmp, pid, palette, api):
    dev = {'frames': {}, 'glyphs': None, 'rotation': None}
    info = {'w': W, 'h': H, 'red': 'red' in palette, 'maxSlots': 48, 'slotsFit': 28, 'count': 1, 'daily': 0,
            'entries': 1, 'current': 0, 'interval': 10, 'batteryMv': 3912, 'busy': False}
    if api:
        info.update(api=api, panel=pid, palette=palette, bpp=2 if len(palette) > 2 else 1, pageBudget=1_000_000)

    async def device(route):
        req, u = route.request, urlparse(route.request.url)
        q, cors = parse_qs(u.query), {'Access-Control-Allow-Origin': '*'}
        if u.path == '/api/info':
            return await route.fulfill(status=200, headers=cors, content_type='application/json', body=json.dumps(info))
        if u.path == '/api/state':
            return await route.fulfill(status=200 if req.method == 'GET' else 204, headers=cors, content_type='application/json', body='{}')
        if u.path == '/api/glyphs':
            dev['glyphs'] = file_part(req)
            return await route.fulfill(status=204, headers=cors)
        if u.path == '/api/frame':
            dev['frames'][int(q['slot'][0])] = (file_part(req), q.get('ov', [None])[0])
            return await route.fulfill(status=204, headers=cors)
        if u.path == '/api/rotation':
            dev['rotation'] = req.post_data
            return await route.fulfill(status=202, headers=cors)
        await route.fulfill(status=404, headers=cors)

    async def other(route):
        url = route.request.url
        if url.startswith('file:'):
            await route.continue_()
        elif url.endswith('.png'):      # any sprite, ribbon or badge: one made-up picture
            await route.fulfill(status=200, content_type='image/png', headers={'Access-Control-Allow-Origin': '*'}, body=SPRITE)
        else:
            await route.abort()

    ctx = await browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-US')
    await ctx.route('**/*', other)
    await ctx.route('http://fake.esp/**', device)
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    await page.goto((ROOT / 'data/www/index.html').as_uri())
    await page.wait_for_timeout(1500)
    await page.click('#sections button[data-section=display]')
    await page.fill('input[name=deviceUrl]', 'http://fake.esp')
    await page.dispatch_event('input[name=deviceUrl]', 'change')
    await page.wait_for_function("typeof deviceInfo !== 'undefined' && deviceInfo", timeout=15000)
    await page.click('#send')
    await page.wait_for_function("document.querySelector('#status').textContent.match(/Sent|failed|Too|take|draws/)", timeout=120000)
    status = await page.inner_text('#status')
    await ctx.close()

    label = f"{pid}{'' if api else ' (firmware 1.4.0)'}"
    problems = list(errors)
    if 'Sent' not in status:
        problems.append('status: ' + status)
    if not dev['frames'] or dev['rotation'] is None or not dev['glyphs']:
        problems.append('nothing received')
    allowed = {INKS.index(n) for n in palette}
    today = (datetime.date.today() - datetime.date(1970, 1, 1)).days
    sizes, counters = [], 0
    for slot, (frame, ov) in sorted(dev['frames'].items()):
        sizes.append(len(frame))
        if api:
            f = tmp / 'frame.bin'
            f.write_bytes(frame)
            r = subprocess.run([str(decoder), str(f)], capture_output=True)
            if r.returncode or len(r.stdout) != W * H:
                problems.append(f'slot {slot}: firmware decoder rejects the frame')
                continue
            px = r.stdout
        else:
            if len(frame) != W * H // 4:
                problems.append(f'slot {slot}: legacy frame is {len(frame)} bytes')
                continue
            bit = lambda plane, i: frame[plane * (W * H // 8) + (i >> 3)] & (0x80 >> (i & 7))
            px = bytes(1 if bit(0, i) else 2 if bit(1, i) else 0 for i in range(W * H))
        if set(px) - allowed:
            problems.append(f'slot {slot}: inks {sorted(set(px) - allowed)} not on this panel')
        if ov:
            counters += 1
            if paint_overlay(px, ov, dev['glyphs'], today) != px:
                problems.append(f'slot {slot}: counter drawn by the board differs from the page')
    print(f"{'FAIL' if problems else 'ok  '} {label:22} {len(sizes)} pages, {counters} with counter, "
          f"{sum(sizes) // 1024} KB total, largest {max(sizes, default=0)} B")
    for p in problems:
        print('     ', p)
    return not problems


async def main():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        decoder = tmp / 'decode'
        subprocess.run(['g++', '-std=c++14', '-O1', '-o', str(decoder), str(ROOT / 'tests/decode_host.cpp')], check=True)
        async with async_playwright() as p:
            exe = os.environ.get('CHROME')
            browser = await p.chromium.launch(args=['--no-sandbox', '--allow-file-access-from-files'], **({'executable_path': exe} if exe else {}))
            ok = True
            for pid, palette, api in PANELS:
                ok &= await run_panel(browser, decoder, tmp, pid, palette, api)
            await browser.close()
    sys.exit(0 if ok else 1)


asyncio.run(main())
