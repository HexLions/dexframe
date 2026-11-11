"use strict";
const W = 400, H = 300, PLANE = W * H / 8;

// Inks, by global code (the same numbers the firmware uses, see include/frame_codec.h).
const INKS = [
  {name: 'white', rgb: [255, 255, 255]}, {name: 'black', rgb: [17, 17, 17]}, {name: 'red', rgb: [200, 30, 30]},
  {name: 'yellow', rgb: [236, 196, 20]}, {name: 'blue', rgb: [30, 70, 180]}, {name: 'green', rgb: [40, 130, 60]},
  {name: 'orange', rgb: [225, 120, 30]}];
// Panels this page knows; a connected board describes its own in /api/info.
const PANELS = {
  bw: {palette: ['white', 'black']},
  bwr: {palette: ['white', 'black', 'red']},
  bwry: {palette: ['white', 'black', 'red', 'yellow']}};
const panelOf = s => PANELS[s.panel] || PANELS.bw;
const hasInk = (s, name) => panelOf(s).palette.includes(name);
// Bits per pixel of a frame for a palette: enough for its highest ink code.
const paletteBpp = pal => { const top = Math.max(...pal.map(n => INKS.findIndex(k => k.name === n))); return top > 3 ? 3 : top > 1 ? 2 : 1; };

