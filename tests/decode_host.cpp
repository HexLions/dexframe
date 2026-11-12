// Host build of the firmware frame decoder: reads a DXF1 file, writes one ink code per
// pixel to stdout. Exit code 1 = rejected. Used by tests/test_codec.py.
#include <cstdio>
#include <vector>
#include "../include/frame_codec.h"

int main(int argc, char** argv) {
  if (argc < 2) return 2;
  FILE* f = fopen(argv[1], "rb");
  if (!f) return 2;
  if (argc > 2) {   // any second argument: print the CRC-32 of the file instead
    uint8_t b[300];
    uint32_t crc = 0;
    size_t n;
    while ((n = fread(b, 1, sizeof b, f)) > 0) crc = dxf::crc32(crc, b, n);
    printf("%u\n", (unsigned)crc);
    return 0;
  }
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
