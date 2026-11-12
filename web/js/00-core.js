"use strict";
const W = 400, H = 300, PLANE = W * H / 8;

// Inks, by global code (the same numbers the firmware uses, see include/frame_codec.h).
// rgb: how the ink looks (preview, colour matching); css: the pure colour pages draw
// with on the work canvas, which canvasToInk() turns back into the ink code.
const INKS = [
  {name: 'white', rgb: [255, 255, 255], css: '#fff'}, {name: 'black', rgb: [17, 17, 17], css: '#000'},
  {name: 'red', rgb: [200, 30, 30], css: '#f00'}, {name: 'yellow', rgb: [236, 196, 20], css: '#ff0'},
  {name: 'blue', rgb: [30, 70, 180], css: '#00f'}, {name: 'green', rgb: [40, 130, 60], css: '#0f0'},
  {name: 'orange', rgb: [225, 120, 30], css: '#f80'}];
const inkCode = name => INKS.findIndex(k => k.name === name);
// Panels this page knows; a connected board describes its own in /api/info.
const PANELS = {
  bw: {palette: ['white', 'black']},
  bwr: {palette: ['white', 'black', 'red']},
  bwry: {palette: ['white', 'black', 'red', 'yellow']},
  spectra73: {palette: ['white', 'black', 'red', 'yellow', 'blue', 'green']},           // 7.3" 800x480: pages scaled to fit
  color6: {palette: ['white', 'black', 'red', 'yellow', 'blue', 'green'], previewOnly: true}};
const panelOf = s => PANELS[s.panel] || PANELS.bw;
const hasInk = (s, name) => panelOf(s).palette.includes(name);
const isColour = s => panelOf(s).palette.length > 3;      // yellow and beyond: coloured sprites and type colours
const accent = s => hasInk(s, 'red') ? '#f00' : '#000';
// Bits per pixel of a frame for a palette: enough for its highest ink code.
const paletteBpp = pal => { const top = Math.max(...pal.map(n => INKS.findIndex(k => k.name === n))); return top > 3 ? 3 : top > 1 ? 2 : 1; };

