// Host checks of include/rotation.h. Exit code = number of failures.
#include <cstdio>
#include <cstring>
#include <set>
#include "../include/rotation.h"

static int fails = 0;
#define CHECK(c) do { if (!(c)) { printf("FAIL line %d: %s\n", __LINE__, #c); fails++; } } while (0)

int main() {
  rot::Rotation r;
  CHECK(rot::parse("1,1,7d,5v", r, 48));
  CHECK(r.n == 4 && r.totalSlots() == 14 && r.base(2) == 2 && r.base(3) == 9);
  CHECK(r.pools[2].mode == 'd' && r.pools[3].mode == 'v' && r.scheduled(2) && !r.scheduled(3) && !r.scheduled(0));
  char buf[64];
  rot::format(r, buf, sizeof buf);
  CHECK(strcmp(buf, "1,1,7d,5v") == 0);
  CHECK(rot::parse("3", r, 48) && r.n == 1 && r.pools[0].mode == 'd');       // bare size: scheduled pool
  rot::Rotation keep = r;
  for (const char* bad : {"", ",", "1,", "0", "1,,2", "1x", "-1", "256", "a", "40,9"}) {
    r = keep;
    CHECK(!rot::parse(bad, r, 48));
    CHECK(r.n == keep.n);                                                     // untouched on error
  }
  // order: in order without shuffle; with shuffle every round is a permutation and a new
  // round never starts with the entry the previous one ended on
  CHECK(rot::orderAt(5, 3, 10, false) == 3 && rot::orderAt(0, -1, 10, false) == 9);
  for (int n = 3; n <= 48; n++) {
    int last = -1;
    for (uint32_t c = 0; c < 200; c++) {
      std::set<int> seen;
      for (int p = 0; p < n; p++) seen.insert(rot::orderAt(c, p, n, true));
      CHECK((int)seen.size() == n);
      int first = rot::orderAt(c, 0, n, true);
      if (c) CHECK(first != last);
      last = rot::orderAt(c, n - 1, n, true);
    }
  }
  CHECK(rot::orderAt(7, 1, 2, true) == 1);                                    // 2 entries: just alternate
  printf("%s rotation: %d failures\n", fails ? "FAIL" : "ok  ", fails);
  return fails;
}
