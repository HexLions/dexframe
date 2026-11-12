#!/usr/bin/env python3
"""Pushes an image or a short text to a DexFrame: it is shown at once, for --min
minutes (default: until the next page change), then the rotation goes on.

  pip install pillow
  python3 tools/push.py --host dexframe.local --image photo.jpg --min 30
  python3 tools/push.py --host 192.168.1.50 --text "Dinner is ready" --title "Kitchen"
  python3 tools/push.py --host dexframe.local --clear          # back to the rotation now

The size and the inks come from the board (/api/info); the picture is fitted,
dithered to the panel's inks and sent as a DXF1 frame (include/frame_codec.h).
Use --key if the board has an admin key, --out frame.bin to save instead of sending.
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request
import uuid

try:
    from PIL import Image, ImageDraw, ImageFont, ImageOps
except ImportError:
    sys.exit('needs Pillow: pip install pillow')

INKS = {'white': (255, 255, 255), 'black': (17, 17, 17), 'red': (200, 30, 30), 'yellow': (236, 196, 20),
        'blue': (30, 70, 180), 'green': (40, 130, 60), 'orange': (225, 120, 30)}
INK_CODE = {name: i for i, name in enumerate(INKS)}


def encode_frame(px, w, h, bpp):
    """DXF1 encoder, same rules as encodeFrame() in the web UI."""
    out = bytearray(b'DXF1' + w.to_bytes(2, 'little') + h.to_bytes(2, 'little') + bytes([bpp, 0, 0, 0]))
    min_run = max(3, -(-16 // bpp) + 1)
    lit = []

    def varint(v):
        while v > 127:
            out.append((v & 127) | 128)
            v >>= 7
        out.append(v)

    def flush():
        if not lit:
            return
        if len(lit) < 128:
            out.append(0x80 | (len(lit) - 1))
        else:
            out.append(0xFF)
            varint(len(lit) - 128)
        acc = bits = 0
        for c in lit:
            acc = ((acc << bpp) | c) & 0xFFF
            bits += bpp
            while bits >= 8:
                out.append((acc >> (bits - 8)) & 255)
                bits -= 8
        if bits:
            out.append((acc << (8 - bits)) & 255)
        lit.clear()

    i, n = 0, w * h
    while i < n:
        c, j = px[i], i + 1
        while j < n and px[j] == c:
            j += 1
        run = j - i
        if run >= min_run:
            flush()
            if run < 16:
                out.append((c << 4) | (run - 1))
            else:
                out.append((c << 4) | 15)
                varint(run - 16)
        else:
            lit.extend([c] * run)
        i = j
    flush()
    return bytes(out)


def to_inks(img, palette):
    """Fit, then Floyd-Steinberg dither to the panel's inks: list of ink codes."""
    pal = Image.new('P', (1, 1))
    flat = [v for name in palette for v in INKS[name]]
    pal.putpalette(flat + flat[:3] * (256 - len(palette)))
    q = img.convert('RGB').quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG)
    codes = [INK_CODE[name] for name in palette]
    return [codes[min(v, len(codes) - 1)] for v in q.tobytes()]


def text_image(w, h, text, title):
    img = Image.new('RGB', (w, h), 'white')
    dr = ImageDraw.Draw(img)
    def font(size):
        try:
            return ImageFont.load_default(size=size)
        except TypeError:          # Pillow < 10.1: one small bitmap font
            return ImageFont.load_default()
    top = 0
    if title:
        dr.rectangle([0, 0, w, 30], fill='black')
        dr.text((10, 6), title.upper(), font=font(18), fill='white')
        top = 34
    # largest size at which the text fits, wrapped on spaces
    for size in range(48, 11, -2):
        f, lines, line = font(size), [], ''
        for word in text.split():
            cand = (line + ' ' + word).strip()
            if dr.textlength(cand, font=f) <= w - 20:
                line = cand
            else:
                lines.append(line)
                line = word
        lines.append(line)
        lh = int(size * 1.25)
        if lh * len(lines) <= h - top - 10 and all(dr.textlength(x, font=f) <= w - 20 for x in lines):
            break
    y = top + (h - top - lh * len(lines)) // 2
    for x in lines:
        dr.text(((w - dr.textlength(x, font=f)) / 2, y), x, font=f, fill='black')
        y += lh
    return img


def post(url, data=None, files=None):
    body, headers = data, {}
    if files:
        b = uuid.uuid4().hex
        body = b''.join(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\n'
                        f'Content-Type: application/octet-stream\r\n\r\n'.encode() + v + b'\r\n'
                        for k, (fn, v) in files.items()) + f'--{b}--\r\n'.encode()
        headers['Content-Type'] = f'multipart/form-data; boundary={b}'
    req = urllib.request.Request(url, data=body or b'', headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--host', required=True, help='dexframe.local, an IP, or http://…')
    ap.add_argument('--key', default='', help='admin key, if the board has one')
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--image', help='any picture Pillow can read')
    src.add_argument('--text', help='a short message')
    src.add_argument('--clear', action='store_true', help='stop showing the pushed page')
    ap.add_argument('--title', default='', help='header bar above --text')
    ap.add_argument('--min', type=int, default=0, help='minutes on screen (0 = until the next page change)')
    ap.add_argument('--fit', choices=['cover', 'contain'], default='contain', help='crop to fill, or fit whole')
    ap.add_argument('--out', help='write the frame to this file instead of sending it')
    a = ap.parse_args()

    base = a.host if a.host.startswith('http') else 'http://' + a.host
    base = base.rstrip('/')
    key = {'key': a.key} if a.key else {}
    if a.clear:
        print('cleared', post(f'{base}/api/push/clear?' + urllib.parse.urlencode(key)))
        return
    info = json.load(urllib.request.urlopen(base + '/api/info', timeout=15)) if not a.out else {}
    if not a.out and 'push' not in str(info.get('features', '')).split(','):
        sys.exit('this firmware has no /api/push: update the board to 2.0 or later')
    w, h = info.get('w', 400), info.get('h', 300)
    palette = [p for p in info.get('palette', ['white', 'black']) if p in INKS]
    bpp = 3 if max(INK_CODE[p] for p in palette) > 3 else 2 if max(INK_CODE[p] for p in palette) > 1 else 1

    if a.image:
        img = Image.open(a.image)
        img = ImageOps.exif_transpose(img).convert('RGB')
        img = ImageOps.fit(img, (w, h)) if a.fit == 'cover' else ImageOps.pad(img, (w, h), color='white')
    else:
        img = text_image(w, h, a.text, a.title)
    frame = encode_frame(to_inks(img, palette), w, h, bpp)
    if a.out:
        open(a.out, 'wb').write(frame)
        print(a.out, len(frame), 'bytes')
        return
    q = urllib.parse.urlencode({'min': a.min, **key})
    print('pushed', len(frame), 'bytes:', post(f'{base}/api/push?{q}', files={'frame': ('frame.bin', frame)}))


if __name__ == '__main__':
    main()
