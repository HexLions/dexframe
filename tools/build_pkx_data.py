#!/usr/bin/env python3
"""Builds data/www/pkx/*.json.gz (used by the .pk4-.pk9 import) from a PKHeX checkout.

PKHeX (https://github.com/kwsch/PKHeX, GPL-3.0) is the reference for the file
formats; this script only extracts offsets, ribbon bits, string tables and the
game text lists, so DexFrame never needs PKHeX at runtime.

  git clone --depth 1 https://github.com/kwsch/PKHeX.git /tmp/PKHeX
  python3 tools/build_pkx_data.py /tmp/PKHeX
"""
import argparse
import gzip
import json
import re
from pathlib import Path

LANGS = ['it', 'en', 'es', 'fr', 'de']
# format -> source file with the ribbon bit properties
RIBBON_SRC = {'pk4': 'PK4.cs', 'pk5': 'PK5.cs', 'pk6': 'PK6.cs', 'pk7': 'PK7.cs', 'pk8': 'Shared/G8PKM.cs', 'pk9': 'PK9.cs'}
# format -> location text files (prefix, offsets)
LOC_SRC = {
    'g4': ('gen4/text_hgss', ['00000', '02000', '03000']),
    'g5': ('gen5/text_bw2', ['00000', '30000', '40000', '60000']),
    'g6': ('gen6/text_xy', ['00000', '30000', '40000', '60000']),
    'g7': ('gen7/text_sm', ['00000', '30000', '40000', '60000']),
    'g8': ('gen8/text_swsh', ['00000', '30000', '40000', '60000']),
    'g9': ('gen9/text_sv', ['00000', '30000', '40000', '60000']),
}


def read_lines(path):
    return path.read_text(encoding='utf-8-sig').splitlines()


def ribbons(src):
    """[(property, byte offset, bit)] from `Ribbon* { get => (RIBx & (1 << n))` or `FlagUtil.GetFlag(Data, 0x.., n)`."""
    rib_vars = dict(re.findall(r'private byte (RIB\w+)\s*\{ get => Data\[(0x[0-9A-Fa-f]+)\]', src))
    out = []
    for m in re.finditer(r'bool (Ribbon\w+)\s*\{ get => \((RIB\w+) & \(1 << (\d)\)\)', src):
        out.append([m.group(1), int(rib_vars[m.group(2)], 16), int(m.group(3))])
    for m in re.finditer(r'bool (Ribbon\w+)\s*\{ get => FlagUtil\.GetFlag\(Data, (0x[0-9A-Fa-f]+), (\d)\)', src):
        out.append([m.group(1), int(m.group(2), 16), int(m.group(3))])
    return out


def g4_table(src):
    body = re.search(r'TableINT =>\s*\[(.*?)\];', src, re.S).group(1)
    body = re.sub(r'//[^\n]*', '', body)
    consts = {'NUL': 0xFFFF, 'EMP': 0xFFFF, 'HGM': ord('♂'), 'HGF': ord('♀')}
    out = []
    for tok in re.findall(r"'(?:\\'|[^'])'|NUL|EMP|HGM|HGF", body):
        out.append(consts[tok] if tok in consts else ord(tok[1:-1].replace("\\'", "'")))
    return out


def sbyte_table(src, name):
    body = re.search(name + r' =>\s*\[(.*?)\];', src, re.S).group(1)
    return [int(x) for x in re.findall(r'-?\d+', re.sub(r'//[^\n]*', '', body))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pkhex', type=Path, help='PKHeX checkout')
    ap.add_argument('--out', type=Path, default=Path(__file__).resolve().parent.parent / 'data/www/pkx')
    a = ap.parse_args()
    core_dir = a.pkhex / 'PKHeX.Core'
    pkm, text = core_dir / 'PKM', core_dir / 'Resources/text'
    a.out.mkdir(parents=True, exist_ok=True)

    conv = (pkm / 'Util/Conversion/SpeciesConverter.cs').read_text(encoding='utf-8')
    core = {
        'g4chars': g4_table((pkm / 'Strings/StringConverter4Util.cs').read_text(encoding='utf-8')),
        'species9': {'first': int(re.search(r'FirstUnalignedNational9 = (\d+)', conv).group(1)),
                     'delta': sbyte_table(conv, 'Table9InternalToNational')},
        'ribbons': {fmt: ribbons((pkm / f).read_text(encoding='utf-8')) for fmt, f in RIBBON_SRC.items()},
    }
    files = {'core.json.gz': core}
    for lang in LANGS:
        other = text / 'other' / lang
        lst = lambda name: read_lines(other / f'text_{name}_{lang}.txt')
        rib = dict(l.split('\t', 1) for l in lst('Ribbons') if '\t' in l)
        locs = {}
        for g, (prefix, offs) in LOC_SRC.items():
            locs[g] = {}
            for off in offs:
                f = text / 'locations' / f'{prefix}_{off}_{lang}.txt'
                if f.exists():
                    locs[g][str(int(off))] = read_lines(f)
        files[f'{lang}.json.gz'] = {
            'species': lst('Species'), 'moves': lst('Moves'), 'abilities': lst('Abilities'),
            'natures': lst('Natures'), 'games': lst('Games'), 'characteristics': lst('Character'),
            'items': read_lines(text / 'items' / f'text_Items_{lang}.txt'), 'ribbons': rib, 'locations': locs,
        }
    for name, data in files.items():
        raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
        (a.out / name).write_bytes(gzip.compress(raw, 9, mtime=0))
        print(f'{name}: {len(raw) // 1024} KB -> {(a.out / name).stat().st_size // 1024} KB gz')


if __name__ == '__main__':
    main()
