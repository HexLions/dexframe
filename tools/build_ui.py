#!/usr/bin/env python3
"""Builds data/www/index.html (the single-file web UI) from the sources in web/.

  web/index.template.html   markup, with /*@css*/ and /*@js*/ where the code goes
  web/style.css
  web/js/NN-name.js         concatenated in file-name order into one <script>

  python3 tools/build_ui.py            write data/www/index.html
  python3 tools/build_ui.py --check    fail if data/www/index.html is not up to date (CI)

No bundler and no minifier: the output is the sources joined together, so it stays
readable and what the board serves can be debugged directly.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB, OUT = ROOT / 'web', ROOT / 'data/www/index.html'


def build():
    html = (WEB / 'index.template.html').read_text(encoding='utf-8')
    css = (WEB / 'style.css').read_text(encoding='utf-8')
    js = ''.join(p.read_text(encoding='utf-8') for p in sorted((WEB / 'js').glob('*.js')))
    for mark in ('/*@css*/', '/*@js*/'):
        if html.count(mark) != 1:
            sys.exit(f'{mark} must appear exactly once in index.template.html')
    return html.replace('/*@css*/', css).replace('/*@js*/', js)


if __name__ == '__main__':
    out = build()
    if '--check' in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != out:
            sys.exit('data/www/index.html is out of date: run python3 tools/build_ui.py')
        print('data/www/index.html is up to date')
    else:
        OUT.write_text(out, encoding='utf-8')
        print(f'{OUT.relative_to(ROOT)}: {len(out.encode())} bytes')
