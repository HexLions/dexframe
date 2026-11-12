# PlatformIO pre-script: the LittleFS image is built from .pio/fsdata (data/ with the
# web UI gzipped, see tools/stage_fs.py) instead of data/.
Import("env")  # noqa: F821  (provided by PlatformIO)
import os
import subprocess
import sys

proj = env.subst("$PROJECT_DIR")  # noqa: F821
out = os.path.join(proj, ".pio", "fsdata")
subprocess.check_call([sys.executable, os.path.join(proj, "tools", "stage_fs.py"), "--out", out])
env.Replace(PROJECT_DATA_DIR=out)  # noqa: F821
