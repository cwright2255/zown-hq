// lib/achievementBadge.js
//
// The maths of the achievement badge (components/AchievementBadge.jsx): a ring frame (lib/badgeFrames.js) in bronze, silver or gold with a
// thickness that turns about its vertical axis, the way the badge on an achievement's screen does. Pure functions, no React, no Firebase.
//
// React Native cannot move a flat view toward or away from the viewer, so the thickness is built from slices: the frame's outline
// drawn SLICE_COUNT times, one behind the other. Turning the badge by `deg` degrees moves a slice that is `z` in front of the middle
// sideways by z * sin(deg) and squeezes it to cos(deg) of its width. Together the slices make the rim, and the front and back faces
// (the black disc and ring, with the icon) sit on the two outer ones. Looking straight at the badge (0 degrees) the slices are hidden behind
// the front face; edge-on (90) only the rim shows. These functions give the numbers for every angle, in the tables the animation
// reads (Animated's interpolate takes a list of angles and the value wanted at each).
//
// The Z on the back and the icon on the front stand out of their faces in the same way: they sit beyond the face as a short stack of
// layers (the relief, with the shadow it throws on the face under it), so as the badge turns they move further than the face does and
// seem to stand up from it.

import { FRAME_GRID, getFrame, getMetal, iconPlacement } from './badgeFrames';
import { Z_MARK_HEIGHT, Z_MARK_WIDTH } from './zownMark';

export const BADGE_RATIO = 1; // the badge is as tall as it is wide
export const DEPTH_RATIO = 0.13; // how thick it is, as a fraction of its width
export const SLICE_COUNT = 12;

const rad = (deg) => (deg * Math.PI) / 180;
const round2 = (n) => Math.round(n * 100) / 100;

/** The badge's size in pixels for a given width: { width, height, depth }. */
export function badgeSize(width) {
  const w = Math.max(1, Math.round(width));
  return { width: w, height: Math.round(w * BADGE_RATIO), depth: Math.max(2, Math.round(w * DEPTH_RATIO)) };
}

/** How far in front of the middle each slice is (negative is behind): `count` values from -depth/2 (the back) to +depth/2 (the front). */
export function layerDepths(depth, count = SLICE_COUNT) {
  if (count < 2) return [0];
  return Array.from({ length: count }, (_, i) => round2(-depth / 2 + (depth * i) / (count - 1)));
}

/** How thick one slice is: a little more than the gap to the next, so edge-on the slices run together with no gaps between them. */
export const sliceThickness = (depth, count = SLICE_COUNT) => (depth / Math.max(1, count - 1)) * 1.25;

// ---- the angles the animation is read at -----------------------------------------------------------------------------------------
// Every 10 degrees, which is close enough that straight lines between the values are within half a percent of a true sine; plus two
// angles a half degree either side of 90 and 270, where a face switches from showing to hidden.
export const ANGLE_STEPS = (() => {
  const steps = [];
  for (let d = 0; d <= 360; d += 10) steps.push(d);
  steps.push(89.5, 90.5, 269.5, 270.5);
  return steps.sort((a, b) => a - b);
})();

const EDGE_ON = 1e-9; // |cos| below this is edge-on: neither face is showing

/** True when the front of the badge is turned toward the viewer. */
export const facesFront = (deg) => Math.cos(rad(deg)) > EDGE_ON;
/** True when the back is. */
export const facesBack = (deg) => Math.cos(rad(deg)) < -EDGE_ON;

const table = (fn) => ({ input: ANGLE_STEPS, output: ANGLE_STEPS.map((d) => Math.round(fn(d) * 1000) / 1000) });

/** How far a slice `z` in front of the middle has moved sideways, in pixels, at each angle. */
export const shiftTable = (z) => table((d) => z * Math.sin(rad(d)));

/** The width of a slice as a fraction of the badge's width at each angle: cos, but never thinner than the slice's own thickness. */
export const sliceScaleTable = (thickness, width) => table((d) => Math.abs(Math.cos(rad(d))) + (thickness / Math.max(1, width)) * Math.abs(Math.sin(rad(d))));

/**
 * The width of the spine as a fraction of its own full width (the badge's depth), at each angle: sin, which is negative on the far side so
 * the spine's shading turns over with it. The spine is a plain rectangle that sits in the middle of the slices (a frame says how much of
 * the badge's height it spans, see spineBox). It is there for the top and bottom of the frame: seen edge-on a real badge is as thick
 * there as anywhere, but a slice squeezed to cos(deg) of its width is almost nothing wide there, so without the spine the rim would
 * fray into lines toward the top and bottom.
 */
export const spineScaleTable = () => table((d) => Math.sin(rad(d)));

/** The width of the front face (negative when it faces away, where it is hidden) or of the back face, as a fraction of the badge's width. */
export const faceScaleTable = (front) => table((d) => (front ? 1 : -1) * Math.cos(rad(d)));

/** 1 where a face is showing, 0 where it is not, at each angle. */
export const faceVisibleTable = (front) => table((d) => ((front ? facesFront(d) : facesBack(d)) ? 1 : 0));

/**
 * How much the gloss (a pale diagonal band across the face) shows at an angle: a little when the face is square on, most when it is
 * about 45 degrees to either side, where a real badge would catch the light.
 */
export const glossOpacity = (deg) => round2(0.12 + 0.43 * Math.abs(Math.sin(rad(2 * deg))));

/** The gloss as a table. The back face is the front turned 180 degrees, so it catches the light at its own angles. */
export const glossTable = (front) => table((d) => glossOpacity(front ? d : d - 180));

/** The width of the badge's shadow on the ground as a fraction of its widest: wide when it faces you, a sliver edge-on. */
export const shadowScaleTable = (depth, width) => table((d) => Math.max(0.16, Math.abs(Math.cos(rad(d))) + (depth / Math.max(1, width)) * Math.abs(Math.sin(rad(d)))));

// ---- the relief: the Z on the back and the icon on the front ------------------------------------------------------------------------
export const RELIEF_LAYERS = 6; // layers from the face to the top of the Z; the last one is the top itself, the rest are its sides
export const RELIEF_RATIO = 0.3; // how far the Z and the icon stand out of their faces, as a fraction of the badge's depth
// The light comes from the top left. The top of the Z (and the icon) leans that way by this fraction of the badge's width (x, y: negative
// is left and up), which shows the sides of the Z on the bottom right even face-on; the shadow either throws on the face falls the other way.
export const RELIEF_LEAN = { x: -0.012, y: -0.018 };
export const RELIEF_SHADOW = { x: 0.012, y: 0.018 };
/** How far the relief stands out of its face, in pixels. */
export const reliefHeight = (depth) => Math.max(2, round2(depth * RELIEF_RATIO));

/** The icon on the front: how wide and tall its box is (a square) and where its middle is, for a frame. */
export function iconBox(width, height, frameId) {
  const side = Math.round((width * iconPlacement(getFrame(frameId)).side) / FRAME_GRID);
  return { size: side, cx: width / 2, cy: Math.round(height / 2) };
}

/** The Z on the back: how wide and tall it is (the shape of the traced logo), and where its middle is, for a frame. */
export function zMarkBox(width, height, frameId) {
  const w = Math.round(((width * 2 * getFrame(frameId).inner) / FRAME_GRID) * 0.64);
  return { width: w, height: Math.round((w * Z_MARK_HEIGHT) / Z_MARK_WIDTH), cx: width / 2, cy: Math.round(height / 2) };
}

/** How much of the badge's height its edge shows, as { top, height } in pixels, for a frame (see badgeFrames). */
export function spineBox(height, frameId) {
  const [from, to] = getFrame(frameId).spine;
  return { top: Math.round(height * from), height: Math.round(height * (to - from)) };
}

/**
 * Every layer of the relief on one face, from the one on the face outward. `front` is the face with the icon; the other is the back,
 * with the Z. A layer is { key, kind, z, leanX, leanY, ... }: where it is in front of the middle of the badge (z, negative for the
 * back), and how far it is moved sideways and down in pixels for the light (leanX, leanY). The kinds are
 *   shadow  what the icon or the Z throws on the face (two, one softer and wider; `alpha` is how dark); on the face, so no higher than it
 *   wall    the side of the icon or the Z, dark metal low down to lighter metal higher up (`color`)
 *   top     the top of it, the one that is drawn with its lit edge and its shaded edge
 */
export function reliefLayers(width, height, depth, front, metalId = 'gold') {
  const metal = getMetal(metalId);
  const side = front ? 1 : -1;
  const h = reliefHeight(depth);
  const faceZ = side * (depth / 2);
  const leanAt = (k) => ({ leanX: round2((RELIEF_LEAN.x * width * k) / h), leanY: round2((RELIEF_LEAN.y * width * k) / h) });
  const layers = [1, 1.9].map((spread, i) => ({
    key: `shadow-${i}`,
    kind: 'shadow',
    z: faceZ,
    leanX: round2(RELIEF_SHADOW.x * width * spread),
    leanY: round2(RELIEF_SHADOW.y * width * spread),
    alpha: i === 0 ? 0.5 : 0.22,
  }));
  for (let i = 0; i < RELIEF_LAYERS; i += 1) {
    const k = (h * (i + 1)) / RELIEF_LAYERS;
    const top = i === RELIEF_LAYERS - 1;
    layers.push({
      key: top ? 'top' : `wall-${i}`,
      kind: top ? 'top' : 'wall',
      z: round2(faceZ + side * k),
      ...leanAt(k),
      color: mixHex(metal.wallDark, metal.wallLight, i / (RELIEF_LAYERS - 1)),
    });
  }
  return layers;
}

/** How far a relief layer `z` in front of the middle has moved sideways at each angle: its depth, as for a slice, plus the lean of the light. */
export const reliefShiftTable = (z, leanX) => table((d) => z * Math.sin(rad(d)) + leanX);

// ---- the colours of the rim (each metal's are in badgeFrames.js) ------------------------------------------------------------------------------------------------------
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** A colour `t` (0 to 1) of the way from one hex colour to another. */
export function mixHex(from, to, t) {
  const a = toRgb(from);
  const b = toRgb(to);
  const k = Math.min(1, Math.max(0, t));
  return toHex(a.map((v, i) => v + (b[i] - v) * k));
}

/** The colour of slice `i` of `count`: dark metal at the back, light metal at the front, so the rim shades as it turns. */
export function sliceColor(i, count = SLICE_COUNT, metalId = 'gold') {
  const metal = getMetal(metalId);
  return mixHex(metal.rimDark, metal.rimLight, count < 2 ? 1 : i / (count - 1));
}

// ---- turning it ------------------------------------------------------------------------------------------------------------------
/** How the badge plays when the screen opens: it waits, lights up, and turns TURNS times as it slows to a stop facing the viewer. */
export const INTRO = { waitMs: 450, litMs: 300, spinMs: 2600, turns: 3 };
/** How many degrees the badge turns for each pixel a finger is dragged. */
export const DEG_PER_PX = 0.8;
/** How long a flick carries it before it is taken to the nearest face-on angle. */
export const FLICK_MS = 260;
/** A finger has to move this far sideways (more than it has moved up or down) before it is turning the badge and not scrolling. */
export const TURN_SLOP_PX = 8;

/** The angle after a finger that started at `start` degrees has been dragged `dx` pixels. */
export const dragAngle = (start, dx) => start + dx * DEG_PER_PX;

/**
 * Where a badge let go of at `theta` degrees, moving at `velocity` px per ms, comes to rest: the nearest angle that faces the viewer
 * (a multiple of 360) once the flick has carried it on.
 */
export function settleAngle(theta, velocity = 0) {
  const v = Number.isFinite(velocity) ? velocity : 0;
  const turns = Math.round((theta + v * DEG_PER_PX * FLICK_MS) / 360);
  return turns === 0 ? 0 : turns * 360; // (never -0)
}

/** Where a tap on the badge sends it: forward to the face-on angle after the next full turn, so it spins once more and stops facing the viewer. */
export const replayAngle = (theta) => (Math.ceil(theta / 360 - 1e-9) + 1) * 360;

/** How long a turn of `degrees` takes when it is eased out: quick for a small one, never more than INTRO's long spin. */
export const turnDuration = (degrees) => Math.round(Math.min(1500, 450 + Math.abs(degrees) * 1.1));

// ---- the sparkles around the badge -----------------------------------------------------------------------------------------------
/** Where each sparkle sits, as fractions of the card (x across, y down), how big it is, and how long it waits before it first twinkles. */
export const SPARKLES = [
  { x: 0.14, y: 0.2, size: 12, delayMs: 0 },
  { x: 0.84, y: 0.16, size: 16, delayMs: 350 },
  { x: 0.9, y: 0.5, size: 9, delayMs: 700 },
  { x: 0.1, y: 0.62, size: 10, delayMs: 1000 },
  { x: 0.7, y: 0.78, size: 12, delayMs: 200 },
  { x: 0.3, y: 0.1, size: 8, delayMs: 850 },
];

/** A four-point star as an SVG path in a box of `size`: points at the top, right, bottom and left, pinched in between. */
export function sparklePath(size) {
  const c = size / 2;
  const p = size * 0.12; // how far the pinch sits from the centre
  return `M ${c} 0 Q ${c + p} ${c - p} ${size} ${c} Q ${c + p} ${c + p} ${c} ${size} Q ${c - p} ${c + p} 0 ${c} Q ${c - p} ${c - p} ${c} 0 Z`;
}
