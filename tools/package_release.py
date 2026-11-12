#!/usr/bin/env python3
"""Packs ready-made binaries for one panel variant.

  dist/dexframe-<env>-ota.bin       app only: Firmware update from the web UI / setup page
  dist/dexframe-<env>-factory.bin   bootloader + partitions + app + web UI, flash at 0x0
                                    (ESP web flasher or esptool) on a new board

Inputs are the usual build outputs (PlatformIO: .pio/build/<env>/). Default ESP32
partition table (partitions.csv, from 2.0.0): app0 at 0x10000, LittleFS at 0x310000 (0xF0000 bytes).

  python3 tools/package_release.py bw --build .pio/build/bw --fs .pio/build/bw/littlefs.bin \
      --boot-app0 ~/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('env', help='panel build: a PlatformIO env name (bw, bwr, bwry, ...)')
ap.add_argument('--build', type=Path, required=True, help='folder with bootloader.bin, partitions.bin, firmware.bin')
ap.add_argument('--fs', type=Path, required=True, help='LittleFS image (0xF0000 bytes)')
ap.add_argument('--boot-app0', type=Path, required=True)
ap.add_argument('--out', type=Path, default=Path('dist'))
a = ap.parse_args()


def pick(*names):
    for n in names:
        if (a.build / n).exists():
            return a.build / n
    sys.exit(f'missing in {a.build}: {names[0]}')


boot = pick('bootloader.bin', 'dexframe.ino.bootloader.bin')
parts = pick('partitions.bin', 'dexframe.ino.partitions.bin')
app = pick('firmware.bin', 'dexframe.ino.bin')
FS_OFFSET, FS_SIZE = 0x310000, 0xF0000
if a.fs.stat().st_size != FS_SIZE:
    sys.exit(f'{a.fs}: {a.fs.stat().st_size} bytes, expected {FS_SIZE} (partitions.csv)')

a.out.mkdir(parents=True, exist_ok=True)
ota = a.out / f'dexframe-{a.env}-ota.bin'
factory = a.out / f'dexframe-{a.env}-factory.bin'
shutil.copyfile(app, ota)
subprocess.run([sys.executable, '-m', 'esptool', '--chip', 'esp32', 'merge_bin', '-o', str(factory),
                '--flash_mode', 'dio', '--flash_freq', '40m', '--flash_size', '4MB',
                '0x1000', str(boot), '0x8000', str(parts), '0xe000', str(a.boot_app0),
                '0x10000', str(app), hex(FS_OFFSET), str(a.fs)], check=True)
print(ota, ota.stat().st_size, '\n' + str(factory), factory.stat().st_size)
