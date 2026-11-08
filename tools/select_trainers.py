#!/usr/bin/env python3
"""Copy a few trainers from your pack into data/www/trainers/ for the ESP32.

The whole pack (~2.8 MB of PNG) does not fit the ESP32's LittleFS; the web UI
served by the board only needs the trainers you actually use.

  python3 tools/select_trainers.py ~/my-trainer-pack cynthia lucas-gen4 red
  python3 tools/select_trainers.py ~/my-trainer-pack --list keys.txt

Keys match the pack's "key" or "showdown_file" (without .png). Re-running adds to
the existing selection.
"""
import argparse, json, pathlib, shutil, sys

ap = argparse.ArgumentParser()
ap.add_argument('pack', help='folder containing legend.json and png/')
ap.add_argument('keys', nargs='*')
ap.add_argument('--list', help='text file with one key per line')
ap.add_argument('--out', default=str(pathlib.Path(__file__).resolve().parent.parent / 'data' / 'www' / 'trainers'))
args = ap.parse_args()

pack, out = pathlib.Path(args.pack).expanduser(), pathlib.Path(args.out)
legend = json.loads((pack / 'legend.json').read_text(encoding='utf-8'))
wanted = [k.strip().lower() for k in args.keys]
if args.list:
    wanted += [l.strip().lower() for l in pathlib.Path(args.list).read_text().splitlines() if l.strip()]
if not wanted:
    sys.exit('no keys given')

norm = lambda s: s.lower().removesuffix('.png')
by_key = {}
for e in legend:
    by_key[norm(e.get('key', ''))] = e
    by_key[norm(e.get('showdown_file', ''))] = e

out_legend_path = out / 'legend.json'
current = json.loads(out_legend_path.read_text(encoding='utf-8')) if out_legend_path.exists() else []
have = {e['png'] for e in current}
missing = []
for k in wanted:
    e = by_key.get(k) or by_key.get(k.replace('-', '_'))
    if not e:
        missing.append(k)
        continue
    dst = out / e['png']
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(pack / e['png'], dst)
    if e['png'] not in have:
        current.append({k2: e[k2] for k2 in ('key', 'png', 'name', 'variant', 'showdown_file') if k2 in e})
        have.add(e['png'])

out_legend_path.parent.mkdir(parents=True, exist_ok=True)
out_legend_path.write_text(json.dumps(current, ensure_ascii=False, indent=1), encoding='utf-8')
size = sum((out / e['png']).stat().st_size for e in current if (out / e['png']).exists())
print(f'{len(current)} trainers in {out} ({size / 1024:.0f} KB)')
if missing:
    print('not found:', ', '.join(missing), file=sys.stderr)
    sys.exit(1)
