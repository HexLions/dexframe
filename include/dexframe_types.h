// DexFrame shared types (kept in a header so Arduino IDE prototypes see them)
#pragma once
#include <stdint.h>

// Day-counter overlay of a slot: "x,y,w,h,align,startDay,color,sep"
struct Overlay { int x, y, w, h, align; int32_t start; int color, sep; bool ok; };


// /glyphs.bin from the browser: [gw, gh, n] then n advances, then n bitmaps of
// gh rows x ceil(gw/8) bytes (MSB first). Glyphs 0-9 are digits, 10 is the
// thousands separator. Each glyph has a 2 px left pad (as drawn by the page).
struct Glyphs { uint8_t gw = 0, gh = 0, n = 0; uint8_t adv[16]; uint8_t* bits = nullptr; };
