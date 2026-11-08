// DexFrame — 3D-printable case for a 4.2" SPI e-paper module + ESP32 DevKit
// HexLions, GPL-3.0. All sizes in mm.
//
// MEASURE YOUR MODULE FIRST: breakout boards differ. The defaults are for a
// 4.2" module board with four corner mounting holes; the panel (GDEY042T81 /
// GDEY042Z98) outline is 91.0 x 77.0 mm, active area 84.8 x 63.6 mm.
//
// Parts (set `part` or use the Customizer): "front", "back", "stand", "all" (exploded preview).
// Print: front face-down, back with its flat side down, stand on its side. PLA/PETG, 0.2 mm, no supports.
// Assembly: 4x M2.5 screws (12-16 mm) from the back, through the module holes, into the front posts.

part = "all"; // [all, front, back, stand]

/* [Module board] */
pcb_w = 103.0;          // board width
pcb_h = 78.5;           // board height
pcb_t = 1.6;            // board thickness
hole_inset = 3.0;       // mounting-hole centre distance from the board edges
hole_d = 3.0;           // mounting-hole diameter on the board
panel_t = 1.4;          // panel + adhesive thickness above the board
/* [Display window] */
aa_w = 84.8;            // active area
aa_h = 63.6;
aa_off_x = 0.0;         // active-area centre offset from the board centre (+ = right)
aa_off_y = 0.0;         // (+ = up, towards the side opposite the FPC)
window_margin = 0.6;    // extra opening around the active area
/* [Case] */
wall = 2.0;
front_t = 1.6;          // front plate in front of the panel
clear = 0.4;            // fit clearance around the board
back_d = 24.0;          // inner depth behind the board (DevKit + LiPo)
corner_r = 3.0;
screw_pilot = 2.2;      // M2.5 self-tapping pilot hole in the front posts
screw_clear = 2.8;      // M2.5 clearance hole in the back
/* [Battery and board holders] */
bat = [50, 34, 9];      // LiPo cell w, h, thickness (e.g. 103450, 1500-2000 mAh), top half
devkit = [50.5, 26];    // board footprint, bottom half, USB end towards the right side
                        // WEMOS LOLIN32 Lite ~50 x 25.5 mm (default); ESP32 DevKit: [52, 29]
devkit_raise = 3.0;     // rail height under the DevKit (raise it if its header pins point down)
/* [Openings (back part)] */
usb_w = 13.0;           // USB cut-out in the right side, in front of the DevKit connector
usb_h = 8.0;
usb_z = 6.0;            // cut-out centre above the back plate inner face
btn_x = 30.0;           // button hole on the top side, from the centre (6x6 tactile, GPIO33 to GND)
btn_d = 4.2;
btn_z = 8.0;
/* [Stand] */
tilt = 15;              // backward tilt from vertical, degrees
stand_depth = 60;

$fn = 48;
outer_w = pcb_w + 2 * (clear + wall);
outer_h = pcb_h + 2 * (clear + wall);
inner_w = pcb_w + 2 * clear;
inner_h = pcb_h + 2 * clear;
lip = panel_t + pcb_t;                 // the front part holds panel + board
bat_cy = inner_h / 2 - bat[1] / 2 - 6; // battery centre (y), leaves room for the hanging slot
dk_cy = -inner_h / 4;                  // DevKit centre (y)
holes = [for (sx = [-1, 1], sy = [-1, 1]) [sx * (pcb_w / 2 - hole_inset), sy * (pcb_h / 2 - hole_inset)]];

module rounded(w, h, z, r = corner_r) {
  linear_extrude(z) offset(r) offset(-r) square([w, h], center = true);
}

// Face-down: z=0 is the visible front.
module front() {
  difference() {
    rounded(outer_w, outer_h, front_t + lip);
    translate([0, 0, front_t]) rounded(inner_w, inner_h, lip + 1, max(0.5, corner_r - wall));
    // display window with a 45-degree chamfer towards the viewer
    translate([aa_off_x, aa_off_y, -0.01])
      hull() {
        linear_extrude(0.01) square([aa_w + 2 * window_margin + 2 * front_t, aa_h + 2 * window_margin + 2 * front_t], center = true);
        translate([0, 0, front_t]) linear_extrude(0.02) square([aa_w + 2 * window_margin, aa_h + 2 * window_margin], center = true);
      }
  }
  // posts from the front plate to the board surface, outside the panel outline
  for (p = holes) translate([p.x, p.y, front_t]) difference() {
    cylinder(d = hole_d + 3, h = panel_t);
    translate([0, 0, -front_t + 0.6]) cylinder(d = screw_pilot, h = panel_t + front_t);
  }
}

// Flat side down: z=0 is the back of the case.
module back() {
  difference() {
    union() {
      difference() {
        rounded(outer_w, outer_h, wall + back_d);
        translate([0, 0, wall]) rounded(inner_w, inner_h, back_d + 1, max(0.5, corner_r - wall));
      }
      // bosses that press the board against the front posts
      for (p = holes) translate([p.x, p.y, 0]) cylinder(d = hole_d + 3, h = wall + back_d);
      // LiPo cradle: two low rails along the cell (add a strip of foam tape under it)
      for (s = [-1, 1]) translate([-bat[0] / 2, bat_cy + s * (bat[1] / 2 + 1) - 1, wall]) cube([bat[0], 2, 4]);
      // DevKit rails, USB end against the right wall
      for (s = [-1, 1]) translate([inner_w / 2 - devkit[0] - 0.5, dk_cy + s * (devkit[1] / 2 + 1) - 1, wall]) cube([devkit[0], 2, devkit_raise]);
    }
    for (p = holes) translate([p.x, p.y, -0.01]) {
      cylinder(d = screw_clear, h = wall + back_d + 1);
      cylinder(d1 = screw_clear + 2.6, d2 = screw_clear, h = 1.3);   // countersink
    }
    // USB (right side) and button (top side)
    translate([outer_w / 2, dk_cy, wall + usb_z]) cube([wall * 4, usb_w, usb_h], center = true);
    translate([btn_x, outer_h / 2, wall + btn_z]) rotate([90, 0, 0]) cylinder(d = btn_d, h = wall * 4, center = true);
    // hanging slot
    translate([0, inner_h / 2 - 3.5, -0.01]) hull() for (dx = [-4, 4]) translate([dx, 0, 0]) cylinder(d = 4.5, h = wall + 1);
  }
}

// Desk stand (side profile extruded): base, a low front lip that stays below the
// display window, and a back rest tilted by `tilt`. The case stands in between.
module stand() {
  depth = wall + back_d + front_t + lip;   // case thickness
  gap = depth / cos(tilt) + 0.8;           // slot width at the base for the tilted case
  lip_h = 8;                               // below the window: the case border is ~7.5 mm + panel margin
  rest_h = 45;
  w = outer_w * 0.6;
  rotate([90, 0, 0]) linear_extrude(w, center = true) union() {
    square([gap + 4 + 6 + rest_h * tan(tilt) + 10, 4]);                    // base
    square([4, lip_h]);                                                    // front lip
    translate([4 + gap, 0]) hull() {                                       // back rest + gusset
      rotate(-tilt) square([5, rest_h]);
      square([5 + rest_h * tan(tilt) + 10, 4]);
    }
  }
}

if (part == "front") front();
else if (part == "back") back();
else if (part == "stand") stand();
else {
  color("white") translate([0, 0, wall + back_d + front_t + lip + 20]) rotate([180, 0, 0]) translate([0, 0, 0]) front();
  color("gray") back();
  color("orange") translate([-outer_w * 0.3, -outer_h / 2 - 70, 0]) rotate([0, 0, 90]) stand();
}
