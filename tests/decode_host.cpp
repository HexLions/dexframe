// Host build of the firmware frame decoder: reads a DXF1 file, writes one ink code per
// pixel to stdout. Exit code 1 = rejected. Used by tests/test_codec.py.
#include <cstdio>
#include <vector>
#include "../include/frame_codec.h"

int main(int argc, char** argv) {
  if (argc < 2) return 2;
  FILE* f = fopen(argv[1], "rb");
  if (!f) return 2;
  uint8_t hdr[dxf::HEADER_SIZE];
  dxf::Header h;
  if (fread(hdr, 1, sizeof hdr, f) != sizeof hdr || !dxf::parseHeader(hdr, sizeof hdr, h)) return 1;
  std::vector<uint8_t> px;
  bool ok = dxf::decode([&](uint8_t* b, size_t n) { return fread(b, 1, n, f); }, (uint32_t)h.w * h.h, h.bpp,
                        [&](uint8_t ink, uint32_t n) { px.insert(px.end(), n, ink); });
  fclose(f);
  if (!ok) return 1;
  fwrite(px.data(), 1, px.size(), stdout);
  return 0;
}
