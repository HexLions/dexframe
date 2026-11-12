// DexFrame — the rotation: which entries, how many pages behind each, in which order.
// No Arduino dependencies: tests/test_rotation.py builds it on the host.
//
// An entry is one stop of the rotation. Behind it there is a pool of 1..48 stored pages
// (slots, numbered across all entries in order). Pool modes:
//   'd'  the page changes with the "of the day" schedule (dailyIndex(): change time,
//        every N days, optional shuffle per round)       e.g. Pokémon of the day
//   'v'  the next page of the pool every time the entry comes up    e.g. your images
// A pool of 1 is a plain page. Written as "1,1,7d,5v" (mode after the size, 'd' if
// missing on a pool > 1).
#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include "daily_pick.h"

namespace rot {

constexpr int MAX_ENTRIES = 48;

struct Pool { uint8_t size; char mode; };

struct Rotation {
  Pool pools[MAX_ENTRIES];
  int n = 0;
  int totalSlots() const { int t = 0; for (int i = 0; i < n; i++) t += pools[i].size; return t; }
  int base(int e) const { int t = 0; for (int i = 0; i < e && i < n; i++) t += pools[i].size; return t; }
  bool scheduled(int e) const { return e >= 0 && e < n && pools[e].size > 1 && pools[e].mode == 'd'; }
};

// false (r untouched) on bad input or more than maxSlots slots in total
inline bool parse(const char* s, Rotation& r, int maxSlots) {
  Rotation out;
  int total = 0;
  while (*s) {
    if (out.n >= MAX_ENTRIES || *s < '0' || *s > '9') return false;
    int v = 0;
    while (*s >= '0' && *s <= '9') { v = v * 10 + (*s - '0'); if (v > 255) return false; s++; }
    char mode = 'd';
    if (*s == 'd' || *s == 'v') mode = *s++;
    if (v < 1) return false;
    if (*s == ',') { s++; if (!*s) return false; }
    else if (*s) return false;
    out.pools[out.n++] = {(uint8_t)v, v > 1 ? mode : 'd'};
    total += v;
    if (total > maxSlots) return false;
  }
  if (out.n < 1) return false;
  r = out;
  return true;
}

inline void format(const Rotation& r, char* out, size_t cap) {
  size_t k = 0;
  if (cap) out[0] = 0;
  for (int i = 0; i < r.n && k + 6 < cap; i++) {
    k += snprintf(out + k, cap - k, i ? ",%u" : "%u", r.pools[i].size);
    if (r.pools[i].size > 1 && k + 2 < cap) { out[k++] = r.pools[i].mode; out[k] = 0; }
  }
}

// Entry at position pos of cycle `cycle`: in order, or a fresh shuffle per cycle that
// never starts with the entry the previous cycle ended on.
inline void shuffled(uint32_t cycle, int n, uint8_t* perm) {
  for (int i = 0; i < n; i++) perm[i] = (uint8_t)i;
  uint32_t r = cycle * 2246822519u + 374761393u;
  for (int i = n - 1; i > 0; i--) {
    r = r * 1664525u + 1013904223u;
    int j = (int)(r % (uint32_t)(i + 1));
    uint8_t t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
}
inline int orderAt(uint32_t cycle, int pos, int n, bool shuffle) {
  if (n <= 0) return 0;
  pos = ((pos % n) + n) % n;
  if (!shuffle || n < 3) return pos;
  uint8_t cur[MAX_ENTRIES], prev[MAX_ENTRIES];
  shuffled(cycle, n, cur);
  if (cycle > 0) {
    shuffled(cycle - 1, n, prev);
    // the previous cycle may itself have been fixed up: only its last entry matters,
    // and the fix-up only swaps the first two, so the last stays as computed
    if (cur[0] == prev[n - 1]) { uint8_t t = cur[0]; cur[0] = cur[1]; cur[1] = t; }
  }
  return cur[pos];
}

}  // namespace rot
