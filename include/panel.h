// DexFrame — panel selection. One build per panel: pick it with a build flag
// (platformio.ini env, or a #define before this include in the Arduino IDE).
//
//   -DPANEL_BW     4.2" 400x300 black/white            GDEY042T81   (default)
//   -DPANEL_BWR    4.2" 400x300 black/white/red        GDEY042Z98
//   -DPANEL_BWRY   4.2" 400x300 black/white/red/yellow GDEY0420F51  (experimental)
//   -DPANEL_SPECTRA73  7.3" 800x480 Spectra 6 (black/white/red/yellow/blue/green) GDEP073E01
//                  (experimental; the web UI fits the 400x300 pages to the panel)
//
// To add a panel: its GxEPD2 class, the inks it can show (bit n = ink code n, see
// frame_codec.h) and whether it has a fast partial refresh. Width and height come
// from the class; the web UI reads all of this from /api/info.
#pragma once
#include <GxEPD2_BW.h>
#include <GxEPD2_3C.h>
#include <GxEPD2_4C.h>
#include <GxEPD2_7C.h>

#if defined(EPD_BWR) && !defined(PANEL_BWR)   // flag names used up to 1.4.0
#define PANEL_BWR
#endif

#define INK_BIT(n) (1u << (n))

#if defined(PANEL_SPECTRA73)
#define PANEL_ID      "spectra73"
#define PANEL_NAME    "GDEP073E01"
#define PANEL_DRIVER  GxEPD2_7C
#define PANEL_CLASS   GxEPD2_730c_GDEP073E01
#define PANEL_INKS    (INK_BIT(0) | INK_BIT(1) | INK_BIT(2) | INK_BIT(3) | INK_BIT(4) | INK_BIT(5))
#define PANEL_PARTIAL false   // partial updates fade the colours on this panel: full refresh only
#ifndef PANEL_PAGES
#define PANEL_PAGES 4         // 4 bits per pixel: the whole screen (192 KB) does not fit in RAM
#endif
#elif defined(PANEL_BWRY)
#define PANEL_ID      "bwry"
#define PANEL_NAME    "GDEY0420F51"
#define PANEL_DRIVER  GxEPD2_4C
#define PANEL_CLASS   GxEPD2_420c_GDEY0420F51
#define PANEL_INKS    (INK_BIT(0) | INK_BIT(1) | INK_BIT(2) | INK_BIT(3))
#define PANEL_PARTIAL false
#elif defined(PANEL_BWR)
#define PANEL_ID      "bwr"
#define PANEL_NAME    "GDEY042Z98"
#define PANEL_DRIVER  GxEPD2_3C
#define PANEL_CLASS   GxEPD2_420c_GDEY042Z98
#define PANEL_INKS    (INK_BIT(0) | INK_BIT(1) | INK_BIT(2))
#define PANEL_PARTIAL false
#else
#define PANEL_ID      "bw"
#define PANEL_NAME    "GDEY042T81"
#define PANEL_DRIVER  GxEPD2_BW
#define PANEL_CLASS   GxEPD2_420_GDEY042T81
#define PANEL_INKS    (INK_BIT(0) | INK_BIT(1))
#define PANEL_PARTIAL true
#endif

// Rows buffered per refresh pass (GxEPD2 paging): 1 = whole screen in RAM.
#ifndef PANEL_PAGES
#define PANEL_PAGES 1
#endif

static const char* const INK_NAMES[] = {"white", "black", "red", "yellow", "blue", "green", "orange"};
static const uint16_t INK_COLORS[] = {GxEPD_WHITE, GxEPD_BLACK, GxEPD_RED, GxEPD_YELLOW,
                                      GxEPD_BLUE, GxEPD_GREEN, GxEPD_ORANGE};

inline bool panelHasInk(uint8_t ink) { return ink < 7 && (PANEL_INKS & INK_BIT(ink)); }
// Inks the panel lacks fall back to black, so a page made for another panel stays readable.
inline uint16_t inkColor(uint8_t ink) { return panelHasInk(ink) ? INK_COLORS[ink] : GxEPD_BLACK; }
