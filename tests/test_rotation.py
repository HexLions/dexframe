#!/usr/bin/env python3
"""Rotation engine (include/rotation.h) on the host: parsing of the pool list, slot
numbering, shuffled order (a permutation per round, no repeat across rounds).

  python3 tests/test_rotation.py        needs g++
"""
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory() as tmp:
    exe = Path(tmp) / 'rot'
    subprocess.run(['g++', '-std=c++14', '-Wall', '-Werror', '-o', str(exe), str(ROOT / 'tests/rotation_host.cpp')], check=True)
    sys.exit(subprocess.run([str(exe)]).returncode)
