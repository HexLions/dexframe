// DexFrame shared types (kept in a header so Arduino IDE prototypes see them)
#pragma once
#include <stdint.h>

// Day-counter overlay of a slot: "x,y,w,h,align,day,color,sep[,mode[,scale]]"
// mode 0: days since `day` (counter); mode 1: days until `day` (countdown, stops at 0).
// scale: glyph pixels drawn as scale x scale blocks (1..4), for big numbers.
struct Overlay { int x, y, w, h, align; int32_t start; int color, sep; bool ok; int mode, scale; };

// Day count laid out for drawing: glyph indexes and the x of the first one.
struct OverlayRun { int idx[24]; int k = 0; int x = 0; };


// /glyphs.bin from the browser: [gw, gh, n] then n advances, then n bitmaps of
// gh rows x ceil(gw/8) bytes (MSB first). Glyphs 0-9 are digits, 10 is the
// thousands separator. Each glyph has a 2 px left pad (as drawn by the page).
struct Glyphs { uint8_t gw = 0, gh = 0, n = 0; uint8_t adv[16]; uint8_t* bits = nullptr; };
