// DexFrame — e-paper Pokémon showcase (HexLions, GPL-3.0)
// The browser renders every page; the ESP32 stores them, rotates them, keeps a
// day counter up to date and can deep-sleep between page changes.
#include <Arduino.h>
#include <vector>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <time.h>
#include <sys/time.h>
#include <driver/rtc_io.h>
#include <esp_sleep.h>
#include <DNSServer.h>
#include <Update.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <GxEPD2_BW.h>
#include <GxEPD2_3C.h>
#include "dexframe_types.h"
#include "setup_page.h"
// Optional compile-time defaults; Wi-Fi is normally set from the setup page (stored in NVS).
#if __has_include("secrets.h")
#include "secrets.h"
#endif
#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASS
#define WIFI_PASS ""
#endif
#ifndef DEVICE_HOSTNAME
#define DEVICE_HOSTNAME "dexframe"
#endif
#define FW_VERSION "1.4.0"
#define AP_NAME "DexFrame-Setup"

// ---- wiring (ESP32 DevKit, VSPI): SCK=18 MOSI=23 CS=5 DC=17 RST=16 BUSY=4 ----
#define EPD_CS   5
#define EPD_DC   17
#define EPD_RST  16
#define EPD_BUSY 4
#define BTN_BOOT 0     // on-board BOOT button (DevKit; the LOLIN32 Lite has none): next page
#define BTN_WAKE 33    // external button to GND: next page + wakes from deep sleep
// Holding either button for 8 s forgets Wi-Fi and the admin key (setup mode).
#ifndef BAT_PIN
#define BAT_PIN  35    // battery via 100k/100k divider; -1 = no battery sensing
#endif
#define BAT_DIVIDER 2.0f
#define BAT_LOW_MV  3500

#if defined(EPD_BWR)
GxEPD2_3C<GxEPD2_420c_GDEY042Z98, GxEPD2_420c_GDEY042Z98::HEIGHT>
  display(GxEPD2_420c_GDEY042Z98(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY));
static const bool HAS_RED = true;
#else
GxEPD2_BW<GxEPD2_420_GDEY042T81, GxEPD2_420_GDEY042T81::HEIGHT>
  display(GxEPD2_420_GDEY042T81(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY));
static const bool HAS_RED = false;
#endif

constexpr int W = 400, H = 300;
constexpr size_t PLANE = W * H / 8;      // 15000 bytes, 1 bit/px, MSB first
constexpr size_t FRAME = PLANE * 2;      // black plane + red plane (red ignored on B/W)
constexpr size_t MAX_STATE = 64 * 1024;
constexpr int MAX_SLOTS = 28;            // fits the 1.4 MB LittleFS next to the web UI
constexpr int FULL_EVERY = 10;           // B/W: full refresh after this many partial ones
const char* DEFAULT_TZ = "CET-1CEST,M3.5.0,M10.5.0/3";

WebServer server(80);
DNSServer dns;
Preferences prefs;

// ---- configuration (NVS) ----
int slotCount = 1;            // regular pages in rotation (slots 0..slotCount-1)
int dailyCount = 0;           // "of the day" pool, slots slotCount..slotCount+dailyCount-1
uint32_t intervalMin = 10;    // 0 = manual only (button / API)
bool sleepEnabled = false;
uint32_t awakeMin = 3;        // stay online this long after a button wake / power-on
String tz = DEFAULT_TZ;
String wifiSsid, wifiPass, hostName, adminKey;

// ---- survives deep sleep ----
RTC_DATA_ATTR int rtcEntry = 0;        // rotation entry on screen
RTC_DATA_ATTR int32_t rtcDrawnDay = -1;
RTC_DATA_ATTR int rtcPartials = 0;
RTC_DATA_ATTR time_t rtcLastSync = 0;
RTC_DATA_ATTR time_t rtcPageDueAt = 0;   // epoch of the next page change while sleeping

int current = 0;              // rotation entry: 0..slotCount-1, slotCount = daily page
uint32_t lastSwitch = 0, lastActivity = 0;
volatile bool pendingDraw = false;
bool pendingFull = true;
bool busy = false;
bool online = false;
bool apActive = false;          // setup access point + captive DNS running
uint32_t restartAt = 0;         // deferred restart (after the HTTP reply went out)
bool otaOk = false;
String otaErr;

bool lastBoot = HIGH, lastWake = HIGH;

File uploadFile;
bool uploadOk = false;
String uploadPath;

// ---------------------------------------------------------------- time
// Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm).
int32_t daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + (int32_t)doe - 719468;
}

bool timeValid() { return time(nullptr) > 1700000000; }   // after Nov 2023

int32_t todayLocal() {
  if (!timeValid()) return -1;
  time_t now = time(nullptr);
  struct tm lt;
  localtime_r(&now, &lt);
  return daysFromCivil(lt.tm_year + 1900, lt.tm_mon + 1, lt.tm_mday);
}

void applyTz() { setenv("TZ", tz.c_str(), 1); tzset(); }

// ---------------------------------------------------------------- storage
String slotPath(int slot, const char* ext) { return "/f" + String(slot) + ext; }

int entryCount() { return slotCount + (dailyCount > 0 ? 1 : 0); }

// Rotation entry -> file slot. The daily entry picks one page of the pool per day.
int entrySlot(int entry) {
  if (entry < slotCount) return entry;
  int32_t day = todayLocal();
  int k = day >= 0 ? (int)(day % dailyCount) : 0;
  return slotCount + k;
}

Overlay readOverlay(int slot) {
  Overlay o{};
  File f = LittleFS.open(slotPath(slot, ".ov"), "r");
  if (!f) return o;
  String s = f.readString(); f.close();
  long v[8]; int n = 0, from = 0;
  while (n < 8) {
    int c = s.indexOf(',', from);
    v[n++] = s.substring(from, c < 0 ? s.length() : c).toInt();
    if (c < 0) break;
    from = c + 1;
  }
  if (n < 7) return o;
  o = {(int)v[0], (int)v[1], (int)v[2], (int)v[3], (int)v[4], (int32_t)v[5], (int)v[6], n > 7 ? (int)v[7] : 0, true};
  o.ok = o.w > 0 && o.h > 0 && o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H;
  return o;
}

// ---------------------------------------------------------------- glyphs
Glyphs glyphs;

void loadGlyphs() {
  free(glyphs.bits); glyphs = Glyphs();
  File f = LittleFS.open("/glyphs.bin", "r");
  if (!f || f.size() < 3) { if (f) f.close(); return; }
  uint8_t hdr[3];
  f.read(hdr, 3);
  if (hdr[2] == 0 || hdr[2] > 16) { f.close(); return; }
  size_t stride = (hdr[0] + 7) / 8, bytes = (size_t)hdr[2] * hdr[1] * stride;
  if (f.size() != 3 + hdr[2] + bytes) { f.close(); return; }
  glyphs.gw = hdr[0]; glyphs.gh = hdr[1]; glyphs.n = hdr[2];
  f.read(glyphs.adv, glyphs.n);
  glyphs.bits = (uint8_t*)malloc(bytes);
  if (!glyphs.bits || f.read(glyphs.bits, bytes) != bytes) { free(glyphs.bits); glyphs = Glyphs(); }
  f.close();
}

inline void setPx(uint8_t* plane, int x, int y, bool on) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  size_t i = (size_t)y * W + x;
  if (on) plane[i >> 3] |= 0x80 >> (i & 7); else plane[i >> 3] &= ~(0x80 >> (i & 7));
}

// Writes the day count into the frame buffer, inside the overlay box.
bool renderOverlay(uint8_t* buf, const Overlay& o) {
  int32_t today = todayLocal();
  if (!o.ok || today < 0 || !glyphs.bits || glyphs.n < 10) return false;
  long days = today - o.start;
  if (days < 0) days = 0;
  char digits[16];
  snprintf(digits, sizeof digits, "%ld", days);
  int idx[24], k = 0, len = strlen(digits);
  for (int i = 0; i < len; i++) {
    if (o.sep && glyphs.n > 10 && i > 0 && (len - i) % 3 == 0) idx[k++] = 10;
    idx[k++] = digits[i] - '0';
  }
  int total = 0;
  for (int i = 0; i < k; i++) total += glyphs.adv[idx[i]];
  int x = o.align == 2 ? o.x + o.w - total : o.align == 1 ? o.x + (o.w - total) / 2 : o.x;
  for (int yy = o.y; yy < o.y + o.h; yy++)              // clear the box
    for (int xx = o.x; xx < o.x + o.w; xx++) { setPx(buf, xx, yy, false); setPx(buf + PLANE, xx, yy, false); }
  uint8_t* plane = (o.color == 1 && HAS_RED) ? buf + PLANE : buf;
  size_t stride = (glyphs.gw + 7) / 8;
  for (int i = 0; i < k; i++) {
    const uint8_t* g = glyphs.bits + (size_t)idx[i] * glyphs.gh * stride;
    for (int gy = 0; gy < glyphs.gh && o.y + gy < o.y + o.h; gy++)
      for (int gx = 0; gx < glyphs.gw; gx++)
        if (g[gy * stride + (gx >> 3)] & (0x80 >> (gx & 7))) {
          int px = x - 2 + gx;                           // glyphs carry a 2 px left pad
          if (px >= o.x && px < o.x + o.w) setPx(plane, px, o.y + gy, true);
        }
    x += glyphs.adv[idx[i]];
  }
  return true;
}

// ---------------------------------------------------------------- battery
int batteryMv() {
#if BAT_PIN >= 0
  uint32_t acc = 0;
  for (int i = 0; i < 8; i++) acc += analogReadMilliVolts(BAT_PIN);
  return (int)(acc / 8 * BAT_DIVIDER);
#else
  return -1;
#endif
}

// Small low-battery mark, bottom-left corner (only when sensing is wired).
void markLowBattery(uint8_t* buf) {
  int mv = batteryMv();
  if (mv < 1000 || mv > BAT_LOW_MV) return;   // <1 V = no battery connected
  const int x0 = 4, y0 = 289;
  for (int x = x0; x < x0 + 14; x++) { setPx(buf, x, y0, true); setPx(buf, x, y0 + 7, true); }
  for (int y = y0; y < y0 + 8; y++) { setPx(buf, x0, y, true); setPx(buf, x0 + 13, y, true); }
  for (int y = y0 + 2; y < y0 + 6; y++) { setPx(buf, x0 + 14, y, true); setPx(buf, x0 + 2, y, true); }
}

// ---------------------------------------------------------------- drawing
// full=true: whole-screen refresh. full=false (B/W only): partial refresh of the
// overlay box, used for the daily counter update without the full-screen flash.
bool drawEntry(int entry, bool full) {
  int slot = entrySlot(entry);
  File f = LittleFS.open(slotPath(slot, ".bin"), "r");
  if (!f) return false;
  if (f.size() != FRAME) { f.close(); return false; }
  uint8_t* buf = (uint8_t*)malloc(FRAME);
  if (!buf) { f.close(); return false; }
  size_t n = f.read(buf, FRAME);
  f.close();
  if (n != FRAME) { free(buf); return false; }

  Overlay ov = readOverlay(slot);
  bool hasOv = renderOverlay(buf, ov);
  markLowBattery(buf);

  bool partial = !full && !HAS_RED && hasOv && rtcPartials < FULL_EVERY;
  busy = true;
  if (partial) {
    display.setPartialWindow(ov.x & ~7, ov.y, ((ov.x + ov.w + 7) & ~7) - (ov.x & ~7), ov.h);
    rtcPartials++;
  } else {
    display.setFullWindow();
    rtcPartials = 0;
  }
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.drawBitmap(0, 0, buf, W, H, GxEPD_BLACK);
    if (HAS_RED) display.drawBitmap(0, 0, buf + PLANE, W, H, GxEPD_RED);
  } while (display.nextPage());
  // hibernate loses the controller RAM (next update is a full refresh); powerOff keeps it,
  // so later partial refreshes of the counter are clean. Deep sleep always hibernates.
  if (sleepEnabled) display.hibernate(); else display.powerOff();
  busy = false;
  free(buf);
  rtcDrawnDay = todayLocal();
  return true;
}

void goTo(int entry) {
  int n = entryCount();
  current = ((entry % n) + n) % n;
  rtcEntry = current;
  rtcPageDueAt = 0;
  lastSwitch = millis();
  pendingDraw = true;
  pendingFull = true;
}

// ---------------------------------------------------------------- HTTP
void touch() { lastActivity = millis(); }

// Optional admin key (?key=…) for everything that changes the device.
bool keyOk() { return adminKey.isEmpty() || server.arg("key") == adminKey; }
bool authorized() {
  if (keyOk()) return true;
  server.send(403, "text/plain", "key");
  return false;
}

String jsonEscape(const String& in) {
  String o;
  o.reserve(in.length() + 4);
  for (size_t i = 0; i < in.length(); i++) {
    char c = in[i];
    if (c == '"' || c == '\\') { o += '\\'; o += c; }
    else if ((uint8_t)c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); o += b; }
    else o += c;
  }
  return o;
}

void handleUpload() {
  HTTPUpload& up = server.upload();
  switch (up.status) {
    case UPLOAD_FILE_START: {
      touch();
      uploadOk = false;
      uploadPath = "";
      if (!keyOk()) break;
      if (server.uri() == "/api/glyphs") uploadPath = "/glyphs";
      else {
        int slot = server.hasArg("slot") ? server.arg("slot").toInt() : -1;
        if (slot < 0 || slot >= MAX_SLOTS) break;
        uploadPath = "/f" + String(slot);
      }
      uploadFile = LittleFS.open(uploadPath + ".tmp", "w");
      uploadOk = (bool)uploadFile;
      break;
    }
    case UPLOAD_FILE_WRITE:
      if (uploadOk && uploadFile.write(up.buf, up.currentSize) != up.currentSize) uploadOk = false;
      break;
    case UPLOAD_FILE_END:
      if (uploadFile) uploadFile.close();
      if (uploadPath.startsWith("/f") && up.totalSize != FRAME) uploadOk = false;
      if (uploadPath == "/glyphs" && (up.totalSize < 3 || up.totalSize > 16384)) uploadOk = false;
      break;
    default:  // aborted
      if (uploadFile) uploadFile.close();
      uploadOk = false;
  }
}

// POST /api/frame?slot=N[&ov=x,y,w,h,align,startDay,color,sep]  (multipart file)
void handleFrameDone() {
  if (!authorized()) return;
  if (!uploadOk) {
    if (uploadPath.length()) LittleFS.remove(uploadPath + ".tmp");
    server.send(400, "text/plain", "bad frame");
    return;
  }
  LittleFS.remove(uploadPath + ".bin");
  LittleFS.rename(uploadPath + ".tmp", uploadPath + ".bin");
  int slot = server.arg("slot").toInt();
  if (server.hasArg("ov") && server.arg("ov").length()) {
    File o = LittleFS.open(slotPath(slot, ".ov"), "w");
    if (o) { o.print(server.arg("ov")); o.close(); }
  } else {
    LittleFS.remove(slotPath(slot, ".ov"));
  }
  server.send(204);
}

// POST /api/glyphs  (multipart file)
void handleGlyphsDone() {
  if (!authorized()) return;
  if (!uploadOk) { LittleFS.remove("/glyphs.tmp"); server.send(400, "text/plain", "bad glyphs"); return; }
  LittleFS.remove("/glyphs.bin");
  LittleFS.rename("/glyphs.tmp", "/glyphs.bin");
  loadGlyphs();
  server.send(204);
}

// POST /api/rotation  count interval [daily sleep awake tz now]
void handleRotation() {
  touch();
  if (!authorized()) return;
  int count = server.arg("count").toInt();
  long interval = server.arg("interval").toInt();
  int daily = server.hasArg("daily") ? server.arg("daily").toInt() : 0;
  if (count < 1 || daily < 0 || count + daily > MAX_SLOTS || interval < 0 || interval > 24 * 60) {
    server.send(400, "text/plain", "bad rotation");
    return;
  }
  slotCount = count;
  dailyCount = daily;
  intervalMin = (uint32_t)interval;
  if (server.hasArg("sleep")) sleepEnabled = server.arg("sleep") == "1";
  if (server.hasArg("awake")) awakeMin = constrain(server.arg("awake").toInt(), 1, 60);
  if (server.hasArg("tz") && server.arg("tz").length() && server.arg("tz").length() < 64) tz = server.arg("tz");
  if (server.hasArg("now")) {          // browser clock: works without NTP (e.g. AP mode)
    long long now = atoll(server.arg("now").c_str());
    if (now > 1700000000LL) { struct timeval tv = {(time_t)now, 0}; settimeofday(&tv, nullptr); }
  }
  applyTz();
  prefs.putInt("count", slotCount);
  prefs.putInt("daily", dailyCount);
  prefs.putUInt("interval", intervalMin);
  prefs.putBool("sleep", sleepEnabled);
  prefs.putUInt("awake", awakeMin);
  prefs.putString("tz", tz);
  for (int s = slotCount + dailyCount; s < MAX_SLOTS; s++) {   // drop pages no longer used
    LittleFS.remove(slotPath(s, ".bin"));
    LittleFS.remove(slotPath(s, ".ov"));
  }
  goTo(0);  // reply now, refresh in loop(): a B/W/R refresh takes ~16 s
  server.send(202);
}

// How many pages fit in LittleFS next to the web UI and your images: each page
// takes 8 blocks (30000 B) + 1 for its counter box, plus room for one .tmp upload.
int slotsFit() {
  const long per = 9 * 4096L;
  long frames = 0;
  File root = LittleFS.open("/");
  for (File f = root.openNextFile(); f; f = root.openNextFile()) {
    String n = f.name();
    if (n.startsWith("/")) n = n.substring(1);
    if (n.startsWith("f") && n.endsWith(".bin")) frames++;
  }
  long avail = (long)LittleFS.totalBytes() - (long)LittleFS.usedBytes() + frames * per - 8 * 4096L - 4 * 4096L;
  return constrain((int)(avail / per), 1, MAX_SLOTS);
}

void handleInfo() {
  touch();
  int mv = batteryMv();
  String j = "{\"w\":" + String(W) + ",\"h\":" + String(H) +
             ",\"red\":" + (HAS_RED ? "true" : "false") +
             ",\"maxSlots\":" + String(MAX_SLOTS) +
             ",\"slotsFit\":" + String(slotsFit()) +
             ",\"count\":" + String(slotCount) +
             ",\"daily\":" + String(dailyCount) +
             ",\"entries\":" + String(entryCount()) +
             ",\"current\":" + String(current) +
             ",\"interval\":" + String(intervalMin) +
             ",\"sleep\":" + (sleepEnabled ? "true" : "false") +
             ",\"awake\":" + String(awakeMin) +
             ",\"timeValid\":" + (timeValid() ? "true" : "false") +
             ",\"today\":" + String(todayLocal()) +
             ",\"batteryMv\":" + String(mv) +
             ",\"fsUsed\":" + String(LittleFS.usedBytes()) +
             ",\"fsTotal\":" + String(LittleFS.totalBytes()) +
             ",\"version\":\"" FW_VERSION "\"" +
             ",\"ap\":" + (apActive ? "true" : "false") +
             ",\"ssid\":\"" + jsonEscape(wifiSsid) + "\"" +
             ",\"host\":\"" + jsonEscape(hostName) + "\"" +
             ",\"keySet\":" + (adminKey.isEmpty() ? "false" : "true") +
             ",\"busy\":" + ((busy || pendingDraw) ? "true" : "false") + "}";
  server.send(200, "application/json", j);
}

void handleStateGet() {
  touch();
  File f = LittleFS.open("/state.json", "r");
  if (!f) { server.send(200, "application/json", "{}"); return; }
  server.streamFile(f, "application/json");
  f.close();
}

void handleStatePost() {
  touch();
  if (!authorized()) return;
  const String& body = server.arg("plain");
  if (body.length() == 0 || body.length() > MAX_STATE) {
    server.send(400, "text/plain", "bad state");
    return;
  }
  File f = LittleFS.open("/state.json", "w");
  if (!f || f.print(body) != body.length()) {
    if (f) f.close();
    server.send(500, "text/plain", "write failed");
    return;
  }
  f.close();
  server.send(204);
}

// ---------------------------------------------------------------- OTA + files
void handleOtaUpload() {
  HTTPUpload& up = server.upload();
  if (up.status == UPLOAD_FILE_START) {
    touch();
    otaErr = "";
    otaOk = keyOk();
    if (!otaOk) { otaErr = "key"; return; }
    Serial.printf("OTA: %s\n", up.filename.c_str());
    if (!Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH)) { otaOk = false; otaErr = Update.errorString(); }
  } else if (up.status == UPLOAD_FILE_WRITE) {
    if (otaOk && Update.write(up.buf, up.currentSize) != up.currentSize) { otaOk = false; otaErr = Update.errorString(); Update.abort(); }
  } else if (up.status == UPLOAD_FILE_END) {
    if (otaOk && !Update.end(true)) { otaOk = false; otaErr = Update.errorString(); }
  } else {
    if (otaOk) Update.abort();
    otaOk = false; otaErr = "aborted";
  }
}

void handleOtaDone() {
  if (!otaOk) { server.send(otaErr == "key" ? 403 : 500, "text/plain", otaErr); return; }
  server.send(200, "text/plain", "ok");
  restartAt = millis() + 800;
}

// Web UI files, only below /www/ (pages, state and settings are never touched).
bool validWwwPath(const String& p) {
  return p.startsWith("/www/") && p.length() < 96 && p.indexOf("..") < 0 && !p.endsWith("/");
}

void handleFsUpload() {
  HTTPUpload& up = server.upload();
  if (up.status == UPLOAD_FILE_START) {
    touch();
    uploadPath = server.arg("path");
    uploadOk = keyOk() && validWwwPath(uploadPath);
    if (uploadOk) {
      uploadFile = LittleFS.open(uploadPath + ".tmp", "w", true);   // creates missing folders
      uploadOk = (bool)uploadFile;
    }
  } else if (up.status == UPLOAD_FILE_WRITE) {
    if (uploadOk && uploadFile.write(up.buf, up.currentSize) != up.currentSize) uploadOk = false;
  } else if (up.status == UPLOAD_FILE_END) {
    if (uploadFile) uploadFile.close();
  } else {
    if (uploadFile) uploadFile.close();
    uploadOk = false;
  }
}

void handleFsDone() {
  if (!authorized()) return;
  const String p = server.arg("path");
  if (!uploadOk || !validWwwPath(p)) {
    if (validWwwPath(p)) LittleFS.remove(p + ".tmp");
    server.send(400, "text/plain", "bad file (path must be /www/…, or disk full)");
    return;
  }
  LittleFS.remove(p);
  if (p.endsWith(".json")) LittleFS.remove(p + ".gz");      // keep one copy of the pkx data
  LittleFS.rename(p + ".tmp", p);
  server.send(204);
}

void listDir(const String& dir, String& out) {
  File d = LittleFS.open(dir);
  if (!d || !d.isDirectory()) return;
  for (File f = d.openNextFile(); f; f = d.openNextFile()) {
    String path = f.path();
    if (f.isDirectory()) { listDir(path, out); continue; }
    if (out.length() > 1) out += ',';
    out += "{\"path\":\"" + jsonEscape(path) + "\",\"size\":" + String(f.size()) + "}";
  }
}

void handleFsList() {
  String out = "[";
  listDir(server.hasArg("dir") ? server.arg("dir") : "/www", out);
  out += "]";
  server.send(200, "application/json", out);
}

void handleFsDelete() {
  touch();
  if (!authorized()) return;
  const String p = server.arg("path");
  if (!validWwwPath(p) || !LittleFS.remove(p)) { server.send(400, "text/plain", "bad path"); return; }
  server.send(204);
}

// ---------------------------------------------------------------- network
bool connectWifi(uint32_t timeoutMs) {
  if (wifiSsid.isEmpty()) return false;
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(hostName.c_str());
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < timeoutMs) delay(100);
  return WiFi.status() == WL_CONNECTED;
}

void syncTime() {
  configTzTime(tz.c_str(), "pool.ntp.org", "time.google.com");
  for (int i = 0; i < 50 && !timeValid(); i++) delay(100);
  if (timeValid()) rtcLastSync = time(nullptr);
  applyTz();
}

// Open access point "DexFrame-Setup" with a captive DNS: phones open /setup by themselves.
// With a saved network the station keeps retrying in the background (AP+STA).
void startAP() {
  WiFi.mode(wifiSsid.isEmpty() ? WIFI_AP : WIFI_AP_STA);
  WiFi.softAP(AP_NAME);
  if (!wifiSsid.isEmpty()) WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  dns.setErrorReplyCode(DNSReplyCode::NoError);
  dns.start(53, "*", WiFi.softAPIP());
  apActive = true;
  Serial.printf("Setup AP \"%s\": http://%s/setup\n", AP_NAME, WiFi.softAPIP().toString().c_str());
}

void stopAP() {
  dns.stop();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  apActive = false;
}

// Text-only screens (built-in GFX font): setup instructions, or the address to open
// when the board is online but has no pages yet.
void drawTextScreen(const char* const* big, int nBig, const char* const* small, int nSmall) {
  busy = true;
  display.setFullWindow();
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.fillRect(0, 0, W, 44, GxEPD_BLACK);
    display.setTextColor(GxEPD_WHITE);
    display.setTextSize(3);
    display.setCursor(14, 11);
    display.print("DexFrame");
    display.setTextColor(GxEPD_BLACK);
    display.setTextSize(2);
    for (int i = 0; i < nBig; i++) { display.setCursor(14, 62 + i * 26); display.print(big[i]); }
    display.setTextSize(1);
    for (int i = 0; i < nSmall; i++) { display.setCursor(14, 62 + nBig * 26 + 14 + i * 16); display.print(small[i]); }
  } while (display.nextPage());
  display.hibernate();
  busy = false;
}

void drawSetupScreen() {
  const char* big[] = {"1. Wi-Fi:", "   " AP_NAME, "2. http://192.168.4.1"};
  const char* small[] = {"Collega il telefono a questa rete e scegli il tuo Wi-Fi.",
                         "Connect your phone to this network and pick your Wi-Fi."};
  drawTextScreen(big, 3, small, 2);
}

void drawAddressScreen() {
  static String ip, host;
  ip = "http://" + WiFi.localIP().toString() + "/";
  host = "http://" + hostName + ".local/";
  const char* big[] = {"Online:", ip.c_str(), host.c_str()};
  const char* small[] = {"Apri l'indirizzo e premi \"Invia tutte le pagine\".",
                         "Open the address and press \"Send all pages\"."};
  drawTextScreen(big, 3, small, 2);
}

bool captiveRedirect() {
  if (!apActive) return false;
  const String host = server.hostHeader(), ip = WiFi.softAPIP().toString();
  if (host == ip || host.startsWith(hostName + ".local")) return false;
  server.sendHeader("Location", "http://" + ip + "/setup", true);
  server.send(302, "text/plain", "");
  return true;
}

void handleRoot() {
  if (captiveRedirect()) return;
  const char* idx = LittleFS.exists("/www/index.html") ? "/www/index.html"
                  : LittleFS.exists("/www/index.html.gz") ? "/www/index.html.gz" : nullptr;
  if (!idx) {   // empty file system (first flash of a ready-made binary): setup page
    server.sendHeader("Location", "/setup", true);
    server.send(302, "text/plain", "");
    return;
  }
  File f = LittleFS.open(idx, "r");
  server.sendHeader("Cache-Control", "no-cache");
  server.streamFile(f, "text/html");
  f.close();
}

void handleScan() {
  touch();
  if (WiFi.getMode() == WIFI_AP) WiFi.mode(WIFI_AP_STA);
  int n = WiFi.scanNetworks();
  String out = "[";
  for (int i = 0; i < n; i++) {
    const String ssid = WiFi.SSID(i);
    if (ssid.isEmpty() || out.indexOf("\"ssid\":\"" + jsonEscape(ssid) + "\"") >= 0) continue;   // hidden / duplicates
    if (out.length() > 1) out += ',';
    out += "{\"ssid\":\"" + jsonEscape(ssid) + "\",\"rssi\":" + String(WiFi.RSSI(i)) +
           ",\"secure\":" + (WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "false" : "true") + "}";
  }
  WiFi.scanDelete();
  server.send(200, "application/json", out + "]");
}

void handleWifiSave() {
  touch();
  if (!authorized()) return;
  const String ssid = server.arg("ssid"), host = server.arg("host");
  if (ssid.isEmpty() || ssid.length() > 32 || server.arg("pass").length() > 64) { server.send(400, "text/plain", "ssid/pass"); return; }
  prefs.putString("ssid", ssid);
  prefs.putString("pass", server.arg("pass"));
  if (host.length() && host.length() < 32) prefs.putString("host", host);
  server.send(200, "text/plain", "ok");
  restartAt = millis() + 800;
}

// Trainer sprites: Showdown sends no CORS header, so the browser can't read the
// pixels. The board downloads the one PNG you picked into /www/trainers/sd/ and
// the page loads it from here (same origin). Only that host, only *.png names.
void handleTrainerFetch() {
  touch();
  if (!authorized()) return;
  const String f = server.arg("f");
  bool ok = f.length() > 4 && f.length() < 48 && f.endsWith(".png");
  for (size_t i = 0; ok && i < f.length(); i++) {
    const char c = f[i];
    ok = isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.';
  }
  if (!ok || f.indexOf("..") >= 0) { server.send(400, "text/plain", "bad name"); return; }
  const String path = "/www/trainers/sd/" + f;
  if (LittleFS.exists(path)) { server.send(200, "text/plain", "trainers/sd/" + f); return; }
  if (WiFi.status() != WL_CONNECTED) { server.send(503, "text/plain", "no internet"); return; }
  WiFiClientSecure tls;
  tls.setInsecure();   // public image, not secret: no CA bundle on the board
  HTTPClient http;
  http.setTimeout(8000);
  http.setUserAgent("DexFrame/" FW_VERSION);
  if (!http.begin(tls, "https://play.pokemonshowdown.com/sprites/trainers/" + f)) { server.send(502, "text/plain", "connect"); return; }
  const int code = http.GET();
  const int len = http.getSize();
  if (code != 200 || len > 65536) { http.end(); server.send(502, "text/plain", "HTTP " + String(code)); return; }
  File out = LittleFS.open(path + ".tmp", "w", true);
  const int n = out ? http.writeToStream(&out) : -1;
  if (out) out.close();
  http.end();
  if (n <= 0 || (len > 0 && n != len)) { LittleFS.remove(path + ".tmp"); server.send(502, "text/plain", "download"); return; }
  LittleFS.rename(path + ".tmp", path);
  server.send(200, "text/plain", "trainers/sd/" + f);
}

// Total reset: settings, Wi-Fi, key, pages, saved card data and downloaded trainer
// sprites. The web UI files (and your ribbon/trainer images) stay.
void factoryReset() {
  prefs.clear();
  File root = LittleFS.open("/");
  std::vector<String> gone;
  for (File f = root.openNextFile(); f; f = root.openNextFile())
    if (!f.isDirectory()) gone.push_back(String(f.path()));
  File sd = LittleFS.open("/www/trainers/sd");
  if (sd && sd.isDirectory())
    for (File f = sd.openNextFile(); f; f = sd.openNextFile()) gone.push_back(String(f.path()));
  for (const String& p : gone) LittleFS.remove(p);
  rtcDrawnDay = -1;
  rtcEntry = 0;
}

void forgetNetwork() {
  prefs.putString("ssid", "");
  prefs.putString("pass", "");
  prefs.putString("key", "");
}

void startServer() {
  if (connectWifi(20000)) {
    Serial.printf("WiFi OK: http://%s/  (http://%s.local/)\n", WiFi.localIP().toString().c_str(), hostName.c_str());
    syncTime();
  } else {
    // Setup AP: the UI and fonts work, sprites need internet (PokeAPI).
    startAP();
    if (wifiSsid.isEmpty()) drawSetupScreen();
  }
  if (MDNS.begin(hostName.c_str())) MDNS.addService("http", "tcp", 80);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/setup", HTTP_GET, [] { touch(); server.send_P(200, "text/html", SETUP_PAGE); });
  server.on("/api/info", HTTP_GET, handleInfo);
  server.on("/api/state", HTTP_GET, handleStateGet);
  server.on("/api/state", HTTP_POST, handleStatePost);
  server.on("/api/frame", HTTP_POST, handleFrameDone, handleUpload);
  server.on("/api/glyphs", HTTP_POST, handleGlyphsDone, handleUpload);
  server.on("/api/rotation", HTTP_POST, handleRotation);
  server.on("/api/next", HTTP_POST, [] { touch(); if (authorized()) { goTo(current + 1); server.send(202); } });
  server.on("/api/show", HTTP_POST, [] { touch(); if (authorized()) { goTo(server.arg("slot").toInt()); server.send(202); } });
  server.on("/api/ota", HTTP_POST, handleOtaDone, handleOtaUpload);
  server.on("/api/fs", HTTP_GET, handleFsList);
  server.on("/api/fs", HTTP_POST, handleFsDone, handleFsUpload);
  server.on("/api/fs/delete", HTTP_POST, handleFsDelete);
  server.on("/api/wifi/scan", HTTP_GET, handleScan);
  server.on("/api/wifi", HTTP_POST, handleWifiSave);
  server.on("/api/wifi/forget", HTTP_POST, [] {
    touch();
    if (!authorized()) return;
    prefs.putString("ssid", ""); prefs.putString("pass", "");
    server.send(200, "text/plain", "ok");
    restartAt = millis() + 800;
  });
  server.on("/api/key", HTTP_POST, [] {
    touch();
    if (!authorized()) return;
    const String k = server.arg("new");
    if (k.length() > 64) { server.send(400, "text/plain", "key too long"); return; }
    adminKey = k;
    prefs.putString("key", k);
    server.send(204);
  });
  server.on("/api/trainer", HTTP_POST, handleTrainerFetch);
  server.on("/api/reset", HTTP_POST, [] {
    touch();
    if (!authorized()) return;
    if (server.arg("confirm") != "RESET") { server.send(400, "text/plain", "confirm=RESET"); return; }
    factoryReset();
    server.send(200, "text/plain", "ok");
    restartAt = millis() + 800;
  });
  server.on("/api/reboot", HTTP_POST, [] { if (authorized()) { server.send(204); restartAt = millis() + 500; } });
  server.serveStatic("/", LittleFS, "/www/", "max-age=300");
  // CORS: lets dexframe.html opened from a PC (file://) drive the display.
  server.enableCORS(true);
  server.onNotFound([] {
    if (server.method() == HTTP_OPTIONS) {
      server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
      server.send(204);
      return;
    }
    if (captiveRedirect()) return;   // OS connectivity checks -> setup page
    server.send(404, "text/plain", "not found");
  });
  server.begin();
  online = true;
  touch();
}

// ---------------------------------------------------------------- sleep
// Seconds until the next page change, or until just after midnight when the
// page on screen carries a day counter (whichever comes first).
uint64_t secondsToNextWake() {
  uint64_t s = 0;
  if (intervalMin > 0 && entryCount() > 1) {
    time_t now = time(nullptr);
    if (rtcPageDueAt <= now) rtcPageDueAt = now + intervalMin * 60;
    s = rtcPageDueAt - now;
  }
  // midnight: the counter changes, and so does the Pokémon of the day
  if ((readOverlay(entrySlot(current)).ok || current >= slotCount) && timeValid()) {
    time_t now = time(nullptr);
    struct tm lt;
    localtime_r(&now, &lt);
    uint64_t toMidnight = (uint64_t)(24 * 3600 - (lt.tm_hour * 3600 + lt.tm_min * 60 + lt.tm_sec)) + 60;
    if (s == 0 || toMidnight < s) s = toMidnight;
  }
  return s;   // 0 = no timer, button only
}

void goToSleep() {
  Serial.println("deep sleep");
  Serial.flush();
  if (online) { server.stop(); WiFi.disconnect(true); WiFi.mode(WIFI_OFF); }
  display.hibernate();
  uint64_t s = secondsToNextWake();
  if (s) esp_sleep_enable_timer_wakeup(s * 1000000ULL);
  rtc_gpio_pullup_en((gpio_num_t)BTN_WAKE);
  rtc_gpio_pulldown_dis((gpio_num_t)BTN_WAKE);
  esp_sleep_enable_ext0_wakeup((gpio_num_t)BTN_WAKE, 0);
  esp_deep_sleep_start();
}

// ---------------------------------------------------------------- main
void loadConfig() {
  prefs.begin("dexframe", false);
  slotCount = constrain(prefs.getInt("count", 1), 1, MAX_SLOTS);
  dailyCount = constrain(prefs.getInt("daily", 0), 0, MAX_SLOTS - slotCount);
  intervalMin = prefs.getUInt("interval", 10);
  sleepEnabled = prefs.getBool("sleep", false);
  awakeMin = prefs.getUInt("awake", 3);
  tz = prefs.getString("tz", DEFAULT_TZ);
  wifiSsid = prefs.getString("ssid", WIFI_SSID);
  wifiPass = prefs.getString("pass", WIFI_PASS);
  hostName = prefs.getString("host", DEVICE_HOSTNAME);
  adminKey = prefs.getString("key", "");
  applyTz();
}

void setup() {
  Serial.begin(115200);
  rtc_gpio_deinit((gpio_num_t)BTN_WAKE);   // back to a normal GPIO after an ext0 wake
  pinMode(BTN_BOOT, INPUT_PULLUP);
  pinMode(BTN_WAKE, INPUT_PULLUP);
  lastBoot = digitalRead(BTN_BOOT);
  lastWake = digitalRead(BTN_WAKE);         // a button still held after waking is not a new press
  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  loadConfig();
  loadGlyphs();
  display.init(115200, true, 2, false);

  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  current = rtcEntry < entryCount() ? rtcEntry : 0;

  if (sleepEnabled && cause == ESP_SLEEP_WAKEUP_TIMER) {
    // Quiet wake: no WiFi, unless the clock needs a daily NTP resync.
    if (!timeValid() || time(nullptr) - rtcLastSync > 24 * 3600) {
      if (connectWifi(8000)) syncTime();
      WiFi.disconnect(true); WiFi.mode(WIFI_OFF);
    }
    // The RTC keeps system time across deep sleep: the interval elapsed -> next page,
    // otherwise this is the midnight wake that only updates the day counter.
    bool pageDue = intervalMin > 0 && entryCount() > 1 && time(nullptr) + 30 >= rtcPageDueAt;
    if (pageDue) {
      current = (current + 1) % entryCount();
      rtcEntry = current;
      rtcPageDueAt = 0;
      drawEntry(current, true);
    } else {
      drawEntry(current, false);   // same page, refresh the day counter
    }
    goToSleep();
  }

  if (cause == ESP_SLEEP_WAKEUP_EXT0) {   // button: next page right away, then go online
    current = (current + 1) % entryCount();
    rtcEntry = current;
    pendingDraw = true;
  } else if (cause == ESP_SLEEP_WAKEUP_UNDEFINED) {
    pendingDraw = rtcDrawnDay < 0;         // power-on: redraw only if nothing is on screen yet
  }
  startServer();
  lastSwitch = millis();
}

void loop() {
  server.handleClient();
  if (apActive) dns.processNextRequest();
  if (restartAt && (int32_t)(millis() - restartAt) >= 0) ESP.restart();

  // Saved network back while in setup mode: drop the access point.
  if (apActive && !wifiSsid.isEmpty() && WiFi.status() == WL_CONNECTED) {
    stopAP();
    Serial.printf("WiFi OK: http://%s/\n", WiFi.localIP().toString().c_str());
    syncTime();
    MDNS.end();
    if (MDNS.begin(hostName.c_str())) MDNS.addService("http", "tcp", 80);
  }

  // A button held 8 s: forget Wi-Fi and the admin key, restart into setup mode.
  static uint32_t bootDownSince = 0;
  if (digitalRead(BTN_BOOT) == LOW || digitalRead(BTN_WAKE) == LOW) {
    if (!bootDownSince) bootDownSince = millis();
    else if (millis() - bootDownSince > 8000) { Serial.println("network reset"); forgetNetwork(); ESP.restart(); }
  } else bootDownSince = 0;

  // Buttons: BOOT (GPIO0) and the external one (GPIO33), active low, debounced.
  static uint32_t lastBtnMs = 0;
  bool b0 = digitalRead(BTN_BOOT), b1 = digitalRead(BTN_WAKE);
  if ((b0 != lastBoot || b1 != lastWake) && millis() - lastBtnMs > 50) {
    lastBtnMs = millis();
    bool pressed = (b0 == LOW && lastBoot == HIGH) || (b1 == LOW && lastWake == HIGH);
    lastBoot = b0; lastWake = b1;
    if (pressed && !busy) { touch(); goTo(current + 1); }
  }

  if (intervalMin > 0 && entryCount() > 1 && millis() - lastSwitch >= intervalMin * 60000UL) {
    goTo(current + 1);
  }

  // New day: refresh the counter on the page shown (partial on B/W).
  static uint32_t lastDayCheck = 0;
  if (millis() - lastDayCheck > 30000) {
    lastDayCheck = millis();
    int32_t today = todayLocal();
    if (today >= 0 && today != rtcDrawnDay && !pendingDraw && !busy) {
      pendingDraw = true;
      // the daily page changes Pokémon at midnight -> full refresh; counters -> partial
      pendingFull = current >= slotCount;
    }
  }

  if (pendingDraw && !busy) {
    pendingDraw = false;
    if (!drawEntry(current, pendingFull)) {
      Serial.printf("draw failed: entry %d\n", current);
      if (!LittleFS.exists("/f0.bin") && !apActive && WiFi.status() == WL_CONNECTED) drawAddressScreen();   // nothing sent yet
    }
    pendingFull = true;
  }

  if (sleepEnabled && !apActive && !restartAt && !busy && !pendingDraw && millis() - lastActivity > awakeMin * 60000UL) {
    goToSleep();
  }
}
