#!/usr/bin/env python3
"""Pokémon of the day: the web UI (dailyPickJs in web/js/30-dates.js) must predict the
same pool page as the firmware (include/daily_pick.h), in order and shuffled.

  python3 tests/test_daily.py        needs node and g++
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / 'web/js/30-dates.js').read_text(encoding='utf-8')
m = re.search(r'(function dailyPickJs\(.*?\n\})', src, re.S)
if not m:
    sys.exit('dailyPickJs not found')

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    c = tmp / 'pick.cpp'
    c.write_text('#include <cstdio>\n#include "%s"\nint main(){for(int s=0;s<2;s++)for(int c=1;c<=48;c++)for(int n=0;n<400;n++)'
                 'printf("%%d\\n",dailyPickOf(n,c,s));printf("%%d\\n",dailyPickOf(20405,14,1));return 0;}\n' % (ROOT / 'include/daily_pick.h'))
    subprocess.run(['g++', '-std=c++14', '-Wall', '-Werror', '-o', str(tmp / 'pick'), str(c)], check=True)
    fw = subprocess.run([str(tmp / 'pick')], capture_output=True, text=True, check=True).stdout.split()
    js = tmp / 'pick.js'
    js.write_text(m.group(1) + '\nconst o=[];for(let s=0;s<2;s++)for(let c=1;c<=48;c++)for(let n=0;n<400;n++)o.push(dailyPickJs(n,c,!!s));'
                  'o.push(dailyPickJs(20405,14,true));console.log(o.join("\\n"));\n')
    ui = subprocess.run(['node', str(js)], capture_output=True, text=True, check=True).stdout.split()

diff = sum(a != b for a, b in zip(fw, ui)) + abs(len(fw) - len(ui))
# every round of a shuffled pool must show each page exactly once
rounds_ok = all(sorted(int(fw[19200 + (c - 1) * 400 + r * c + k]) for k in range(c)) == list(range(c))
                for c in range(1, 49) for r in range(400 // c))
print(f"{'ok  ' if not diff else 'FAIL'} firmware and web UI agree on {len(fw)} picks ({diff} differ)")
print(f"{'ok  ' if rounds_ok else 'FAIL'} shuffled rounds show every page once")
sys.exit(0 if not diff and rounds_ok else 1)
