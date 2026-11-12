// DexFrame — which page of the "Pokémon of the day" pool is shown in period n.
// No Arduino dependencies: tests/test_daily.py checks it against dailyPickJs() in the web UI.
#pragma once
#include <stdint.h>

// In order, or (shuffle) a fresh permutation for every round of the pool: Fisher-Yates
// driven by an LCG seeded with the round number.
inline int dailyPickOf(int32_t n, int count, bool shuffle) {
  if (count <= 0 || n < 0) return 0;
  int pos = n % count;
  if (!shuffle) return pos;
  uint8_t perm[64];
  if (count > 64) count = 64;
  for (int i = 0; i < count; i++) perm[i] = (uint8_t)i;
  uint32_t r = (uint32_t)(n / count) * 2654435761u + 12345u;
  for (int i = count - 1; i > 0; i--) {
    r = r * 1664525u + 1013904223u;
    int j = (int)(r % (uint32_t)(i + 1));
    uint8_t t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  return perm[pos];
}
