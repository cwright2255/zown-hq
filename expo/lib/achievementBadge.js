// lib/achievementBadge.js
//
// The maths of the achievement badge (components/AchievementBadge.jsx): a gold-rimmed shield with a thickness that turns about its
// vertical axis, the way the badge on an achievement's screen does. Pure functions, no React, no Firebase.
//
// React Native cannot move a flat view toward or away from the viewer, so the thickness is built from slices: the shield's outline
// drawn SLICE_COUNT times, one behind the other. Turning the badge by `deg` degrees moves a slice that is `z` in front of the middle
// sideways by z * sin(deg) and squeezes it to cos(deg) of its width. Together the slices make the rim, and the front and back faces
// (the dark shield with the icon) sit on the two outer ones. Looking straight at the badge (0 degrees) the slices are hidden behind
// the front face; edge-on (90) only the rim shows. These functions give the numbers for every angle, in the tables the animation
// reads (Animated's interpolate takes a list of angles and the value wanted at each).

export const SHIELD_RATIO = 1.12; // the shield is this much taller than it is wide
export const DEPTH_RATIO = 0.13; // how thick it is, as a fraction of its width
export const SLICE_COUNT = 12;

const rad = (deg) => (deg * Math.PI) / 180;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The outline of the shield as an SVG path, inside a box of `width` x `height`. `inset` (0 to 0.4) shrinks it toward its centre by that
 * fraction of the box on every side, which is how the dark face and the thin inner line are drawn inside the rim.
 */
export function shieldPath(width, height, inset = 0) {
  const w = width * (1 - 2 * inset);
  const h = height * (1 - 2 * inset);
  const l = (width - w) / 2;
  const t = (height - h) / 2;
  const r = l + w;
  const b = t + h;
  const cx = l + w / 2;
  const rc = 0.07 * w; // the rounded top corners
  const shoulder = t + 0.52 * h; // where the sides start to curve in to the point
  const n = (v) => round2(v);
  return [
    `M ${n(l)} ${n(t + rc)}`,
    `Q ${n(l)} ${n(t)} ${n(l + rc)} ${n(t)}`,
    `L ${n(r - rc)} ${n(t)}`,
    `Q ${n(r)} ${n(t)} ${n(r)} ${n(t + rc)}`,
    `L ${n(r)} ${n(shoulder)}`,
    `C ${n(r)} ${n(t + 0.78 * h)} ${n(cx + 0.28 * w)} ${n(t + 0.92 * h)} ${n(cx)} ${n(b)}`,
    `C ${n(cx - 0.28 * w)} ${n(t + 0.92 * h)} ${n(l)} ${n(t + 0.78 * h)} ${n(l)} ${n(shoulder)}`,
    'Z',
  ].join(' ');
}

/** The badge's size in pixels for a given width: { width, height, depth }. */
export function badgeSize(width) {
  const w = Math.max(1, Math.round(width));
  return { width: w, height: Math.round(w * SHIELD_RATIO), depth: Math.max(2, Math.round(w * DEPTH_RATIO)) };
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
 * the spine's shading turns over with it. The spine is a plain rectangle the badge's full height that sits in the middle of the slices.
 * It is there for the point of the shield: seen edge-on a real badge is as thick at its point as anywhere, but a slice squeezed to
 * cos(deg) of its width is almost nothing wide there, so without the spine the rim would fray into lines toward the point.
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

// ---- the colours of the rim ------------------------------------------------------------------------------------------------------
export const RIM_DARK = '#6B4E00';
export const RIM_LIGHT = '#F2C230';

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** A colour `t` (0 to 1) of the way from one hex colour to another. */
export function mixHex(from, to, t) {
  const a = toRgb(from);
  const b = toRgb(to);
  const k = Math.min(1, Math.max(0, t));
  return toHex(a.map((v, i) => v + (b[i] - v) * k));
}

/** The colour of slice `i` of `count`: dark gold at the back, light gold at the front, so the rim shades as it turns. */
export const sliceColor = (i, count = SLICE_COUNT) => mixHex(RIM_DARK, RIM_LIGHT, count < 2 ? 1 : i / (count - 1));

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
