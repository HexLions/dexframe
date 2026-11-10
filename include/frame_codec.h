// DexFrame frame format "DXF1" — palette-indexed pixels, run-length compressed.
// No Arduino dependencies: the same decoder runs on the board and in the host tests.
//
//   header (12 bytes): "DXF1", width u16le, height u16le, bpp u8 (1..4), 3 reserved (0)
//   then tokens until width*height pixels are covered, row-major:
//     0cccllll            run of ink c (0..7); llll < 15 -> llll+1 pixels,
//                         llll == 15 -> 16 + LEB128 varint that follows
//     1nnnnnnn + data     literal of n+1 pixels (n == 127 -> 128 + LEB128 varint),
//                         packed at bpp bits per pixel, MSB first, padded to a whole byte
//
// Ink codes are global: 0 white, 1 black, 2 red, 3 yellow, 4 blue, 5 green, 6 orange.
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace dxf {

constexpr size_t HEADER_SIZE = 12;
constexpr uint8_t INK_COUNT = 7;

struct Header { uint16_t w = 0, h = 0; uint8_t bpp = 0; };

inline bool parseHeader(const uint8_t* b, size_t n, Header& h) {
  if (n < HEADER_SIZE || b[0] != 'D' || b[1] != 'X' || b[2] != 'F' || b[3] != '1') return false;
  h.w = (uint16_t)(b[4] | (b[5] << 8));
  h.h = (uint16_t)(b[6] | (b[7] << 8));
  h.bpp = b[8];
  return h.w > 0 && h.h > 0 && h.bpp >= 1 && h.bpp <= 4;
}

// Largest valid file for a panel: everything as literals, plus slack.
inline size_t maxSize(uint32_t w, uint32_t h, uint8_t bpp) {
  size_t raw = ((size_t)w * h * bpp + 7) / 8;
  return HEADER_SIZE + raw + raw / 64 + 64;
}

// read(buf, n) -> bytes read (0 at end of data). sink(ink, count) gets every run in
// order. True only if the stream covers exactly `pixels` pixels and then ends.
template <typename Read, typename Sink>
bool decode(Read&& read, uint32_t pixels, uint8_t bpp, Sink&& sink) {
  uint8_t buf[256];
  size_t len = 0, pos = 0;
  auto get = [&]() -> int {
    if (pos == len) { len = read(buf, sizeof buf); pos = 0; if (len == 0) return -1; }
    return buf[pos++];
  };
  auto varint = [&](uint32_t& v) -> bool {
    v = 0;
    int shift = 0, b;
    do {
      b = get();
      if (b < 0 || shift > 28) return false;
      v |= (uint32_t)(b & 0x7F) << shift; shift += 7;
    } while (b & 0x80);
    return true;
  };
  uint32_t done = 0;
  while (done < pixels) {
    int t = get();
    if (t < 0) return false;
    if (t & 0x80) {
      uint32_t n = (uint32_t)(t & 0x7F) + 1, v;
      if (n == 128) { if (!varint(v) || v > pixels) return false; n += v; }
      if (n > pixels - done) return false;
      uint32_t acc = 0; int bits = 0;
      for (uint32_t i = 0; i < n; i++) {
        if (bits < bpp) { int b = get(); if (b < 0) return false; acc = (acc << 8) | (uint32_t)b; bits += 8; }
        uint8_t c = (acc >> (bits - bpp)) & ((1u << bpp) - 1);
        bits -= bpp;
        if (c >= INK_COUNT) return false;
        sink(c, (uint32_t)1);
      }
      done += n;
    } else {
      uint8_t c = (uint8_t)(t >> 4);
      uint32_t n = (uint32_t)(t & 15) + 1;
      if (n == 16) { uint32_t v; if (!varint(v) || v > pixels) return false; n += v; }
      if (c >= INK_COUNT || n > pixels - done) return false;
      sink(c, n);
      done += n;
    }
  }
  return get() < 0;
}

}  // namespace dxf
