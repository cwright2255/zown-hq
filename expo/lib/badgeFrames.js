// lib/badgeFrames.js
//
// The eight ring frames the achievement and Battle Pass badges are made in, and the three metals each one comes in. Pure functions and
// data, no React: components/BadgeMedal.jsx (the flat badge in lists) and components/AchievementBadge.jsx (the one that turns) both draw
// from these.
//
// A badge is only ever a metal and black. The frame is the metal; its middle is a black disc; the sports icon on the disc is the metal
// again. So there are three looks, gold and black, silver and black, bronze and black, and eight shapes of frame to tell badges apart.
//
// Everything is drawn on a 100 x 100 grid with the middle at (50, 50), and scaled by the component. A frame is
//   outline  the whole badge's edge as one closed path (the ring, with its ornaments); this is also what the 3D badge is cut to
//   inner    the radius of the black disc in the middle
//   marks    the small things on the ring: grooves and sockets (black), gems (the metal's light colour); see MARK_KINDS
//   spine    how much of the badge's height its edge shows when it turns edge-on (a fraction from the top, and one from the bottom)
export const FRAME_GRID = 100;
export const CENTRE = 50;

export const METAL_IDS = ['bronze', 'silver', 'gold'];

export const BLACK = '#0A0A0C';
export const BLACK_TOP = '#2A2A2E';

// light/mid/dark shade the ring and the icon; rimDark/rimLight shade the edge of the 3D badge from its back to its front; wallDark/
// wallLight are the sides of the icon and the Z where they stand out of the face.
export const METALS = {
  gold: { id: 'gold', name: 'Gold', light: '#FFE27A', mid: '#E5B100', dark: '#8A5E00', rimDark: '#6B4E00', rimLight: '#F2C230', wallDark: '#5E4300', wallLight: '#D9A400', shine: '#FFF6C2' },
  silver: { id: 'silver', name: 'Silver', light: '#F5F7FA', mid: '#B9C0CC', dark: '#5F6672', rimDark: '#454C58', rimLight: '#DDE2EA', wallDark: '#3E4551', wallLight: '#B4BBC7', shine: '#FFFFFF' },
  bronze: { id: 'bronze', name: 'Bronze', light: '#F0B27A', mid: '#B8702F', dark: '#6A3A12', rimDark: '#4A2709', rimLight: '#D98F4E', wallDark: '#3F1F06', wallLight: '#B4682A', shine: '#FFD9B0' },
};

export const getMetal = (id) => METALS[id] || METALS.bronze;

const rad = (deg) => (deg * Math.PI) / 180;
const r1 = (n) => Math.round(n * 10) / 10;
const pt = (x, y) => `${r1(x)} ${r1(y)}`;
const polar = (radius, deg) => [CENTRE + radius * Math.cos(rad(deg)), CENTRE - radius * Math.sin(rad(deg))]; // 0 degrees is right, 90 is up

const gauss = (x, w) => Math.exp(-(x * x) / (2 * w * w));
// How far `deg` is from the nearest multiple of `step` (0 to step / 2).
const stepDistance = (deg, step) => {
  const m = ((deg % step) + step) % step;
  return Math.min(m, step - m);
};

/** The closed path of a shape given by its radius at each degree: one point per degree, so points and spikes keep their tips. */
export function polarPath(radiusAt, stepDeg = 1) {
  const pts = [];
  for (let d = 0; d < 360; d += stepDeg) pts.push(polar(radiusAt(d), d));
  return `M ${pts.map(([x, y]) => pt(x, y)).join(' L ')} Z`;
}

/** A radius function smoothed over `span` degrees either side, to round the corners of a blocky shape. */
const smoothed = (fn, span) => (d) => {
  let sum = 0;
  let n = 0;
  for (let k = -span; k <= span; k += 1) {
    sum += fn(d + k);
    n += 1;
  }
  return sum / n;
};

const circlePath = (radius) => {
  const [x, y] = polar(radius, 0);
  return `M ${pt(x, y)} A ${r1(radius)} ${r1(radius)} 0 1 0 ${pt(2 * CENTRE - x, y)} A ${r1(radius)} ${r1(radius)} 0 1 0 ${pt(x, y)} Z`;
};

const dot = (cx, cy, radius) => `M ${pt(cx + radius, cy)} A ${r1(radius)} ${r1(radius)} 0 1 0 ${pt(cx - radius, cy)} A ${r1(radius)} ${r1(radius)} 0 1 0 ${pt(cx + radius, cy)} Z`;
const diamond = (cx, cy, half) => `M ${pt(cx, cy - half)} L ${pt(cx + half, cy)} L ${pt(cx, cy + half)} L ${pt(cx - half, cy)} Z`;
const roundedSquare = (cx, cy, half, corner) => {
  const c = corner;
  return [
    `M ${pt(cx - half + c, cy - half)}`, `L ${pt(cx + half - c, cy - half)}`, `Q ${pt(cx + half, cy - half)} ${pt(cx + half, cy - half + c)}`,
    `L ${pt(cx + half, cy + half - c)}`, `Q ${pt(cx + half, cy + half)} ${pt(cx + half - c, cy + half)}`,
    `L ${pt(cx - half + c, cy + half)}`, `Q ${pt(cx - half, cy + half)} ${pt(cx - half, cy + half - c)}`,
    `L ${pt(cx - half, cy - half + c)}`, `Q ${pt(cx - half, cy - half)} ${pt(cx - half + c, cy - half)}`, 'Z',
  ].join(' ');
};
const radial = (from, to, deg) => {
  const [x1, y1] = polar(from, deg);
  const [x2, y2] = polar(to, deg);
  return `M ${pt(x1, y1)} L ${pt(x2, y2)}`;
};
// A small curl (a spiral) that starts at (x, y) and winds inward, for the scrollwork.
const curl = (x, y, size, turnDeg, dir) => {
  const pts = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const a = rad(turnDeg + dir * t * 400);
    const rr = size * (1 - 0.85 * t);
    pts.push([x + rr * Math.cos(a) - size * Math.cos(rad(turnDeg)), y - rr * Math.sin(a) + size * Math.sin(rad(turnDeg))]);
  }
  return `M ${pts.map(([px, py]) => pt(px, py)).join(' L ')}`;
};

/**
 * What a mark is, and so how it is drawn:
 *   groove  a thin black line cut into the ring (`width` is its thickness on the grid)
 *   socket  a black shape set into the ring
 *   gem     a shape in the metal's light colour, set on top of a socket
 */
export const MARK_KINDS = ['groove', 'socket', 'gem'];

// ---- the eight frames --------------------------------------------------------------------------------------------------------------
const STONE_BLOCKS = 12;
const stoneRadius = (d) => {
  const block = Math.floor((((d % 360) + 360) % 360) / (360 / STONE_BLOCKS));
  const base = block % 2 === 0 ? 48.8 : 46.2;
  // Within a few degrees of a seam the stone dips, so each block stands as its own stone with a rounded top.
  const dip = Math.max(0, 1 - stepDistance(d, 360 / STONE_BLOCKS) / 2.8);
  return base - dip ** 0.7 * (base - 43.2);
};

const lobeSockets = (angles, radius, half) => angles.map((a) => {
  const [x, y] = polar(radius, a);
  return { kind: 'socket', d: diamond(x, y, half) };
});
const lobeGems = (angles, radius, half) => angles.map((a) => {
  const [x, y] = polar(radius, a);
  return { kind: 'gem', d: diamond(x, y, half * 0.55) };
});

const padRadius = (d, centreAngle, centreRadius, half) => {
  // The distance from the middle, along `d`, to the edge of a rounded square (a superellipse) of half-size `half` centred on the pad.
  const [cx, cy] = [centreRadius * Math.cos(rad(centreAngle)), centreRadius * Math.sin(rad(centreAngle))];
  let lo = 0;
  let hi = 60;
  const inside = (rr) => {
    const x = rr * Math.cos(rad(d)) - cx;
    const y = rr * Math.sin(rad(d)) - cy;
    return (Math.abs(x) / half) ** 4 + (Math.abs(y) / half) ** 4 <= 1;
  };
  if (!inside(centreRadius) && !(Math.abs(((d - centreAngle + 540) % 360) - 180) < 40)) return 0;
  for (let i = 0; i < 22; i += 1) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) lo = mid;
    else hi = mid;
  }
  return lo > 0.5 ? lo : 0;
};

const PADS = [45, 135, 225, 315];
const gemRadius = (d) => {
  let rr = 44.2;
  PADS.forEach((a) => {
    const pr = padRadius(d, a, 38.6, 9.4);
    if (pr > rr) rr = pr;
  });
  return rr;
};

export const FRAMES = [
  {
    id: 'stone',
    name: 'Stone',
    inner: 33,
    outline: polarPath(smoothed(stoneRadius, 1)),
    marks: Array.from({ length: STONE_BLOCKS }, (_, k) => ({ kind: 'groove', d: radial(35.4, 42.4, k * 30 + 15), width: 1.1 })),
    spine: [0.04, 0.96],
  },
  {
    id: 'band',
    name: 'Band',
    inner: 39,
    outline: polarPath(() => 48),
    marks: [
      ...Array.from({ length: 8 }, (_, k) => ({ kind: 'groove', d: radial(40.4, 47.2, k * 45 + 22.5), width: 1 })),
      { kind: 'groove', d: circlePath(43.6), width: 0.7 },
    ],
    spine: [0.02, 0.98],
  },
  {
    id: 'crest',
    name: 'Crest',
    inner: 34,
    outline: polarPath((d) => 43.5 + 6.2 * gauss(stepDistance(d - 90, 180), 15) + 2.4 * gauss(stepDistance(d, 180), 12)),
    marks: [90, 270].flatMap((a) => {
      const [x, y] = polar(44.4, a);
      return [{ kind: 'socket', d: dot(x, y, 4.6) }, { kind: 'gem', d: dot(x, y, 2.5) }];
    }),
    spine: [0.08, 0.92],
  },
  {
    id: 'scroll',
    name: 'Scroll',
    inner: 35,
    outline: polarPath((d) => 43 + 5.4 * (0.5 + 0.5 * Math.cos(rad(4 * d - 180)))),
    marks: [45, 135, 225, 315].flatMap((a) => {
      const [x, y] = polar(43.4, a);
      return [
        { kind: 'groove', d: curl(x, y, 2.6, a + 90, 1), width: 0.9 },
        { kind: 'groove', d: curl(x, y, 2.6, a - 90, -1), width: 0.9 },
      ];
    }),
    spine: [0.05, 0.95],
  },
  {
    id: 'thorn',
    name: 'Thorn',
    inner: 33.5,
    outline: polarPath((d) => 40 + 9.4 * Math.max(0, 1 - stepDistance(d, 90) / 21) ** 1.4),
    marks: [
      ...lobeSockets([0, 90, 180, 270], 44.8, 3.6),
      ...lobeGems([0, 90, 180, 270], 44.8, 3.6),
      { kind: 'groove', d: circlePath(36.8), width: 0.7 },
    ],
    spine: [0.14, 0.86],
  },
  {
    id: 'gem',
    name: 'Gem',
    inner: 35,
    outline: polarPath(gemRadius),
    marks: PADS.flatMap((a) => {
      const [x, y] = polar(38.6, a);
      return [
        { kind: 'socket', d: roundedSquare(x, y, 5.4, 1.6) },
        { kind: 'gem', d: roundedSquare(x, y, 3.2, 0.9) },
      ];
    }),
    spine: [0.04, 0.96],
  },
  {
    id: 'lace',
    name: 'Lace',
    inner: 36,
    outline: polarPath((d) => 41.6 + 6.4 * Math.abs(Math.cos(rad(4 * d)))),
    marks: [
      ...Array.from({ length: 8 }, (_, k) => {
        const [x, y] = polar(42.2, k * 45 + 22.5);
        return { kind: 'socket', d: dot(x, y, 1.6) };
      }),
      { kind: 'groove', d: circlePath(39.2), width: 0.7 },
    ],
    spine: [0.04, 0.96],
  },
  {
    id: 'star',
    name: 'Star',
    inner: 32,
    outline: (() => {
      // Eight points: straight edges from each tip down to the valley between it and the next.
      const tip = 49.4;
      const valley = 38.6;
      const at = (d) => {
        const dist = stepDistance(d, 45);
        return tip - (tip - valley) * (dist / 22.5);
      };
      return polarPath(at);
    })(),
    marks: [
      ...lobeSockets(Array.from({ length: 8 }, (_, k) => k * 45), 43.4, 3.2),
      ...lobeGems(Array.from({ length: 8 }, (_, k) => k * 45), 43.4, 3.2),
    ],
    spine: [0.14, 0.86],
  },
];

export const FRAME_IDS = FRAMES.map((f) => f.id);
const BY_ID = Object.fromEntries(FRAMES.map((f) => [f.id, f]));

/** One frame by id; an unknown id gives the first frame. */
export const getFrame = (id) => BY_ID[id] || FRAMES[0];

/** The black disc in the middle, as a path. */
export const corePath = (frame) => circlePath(frame.inner);

/** The thin line drawn just inside the ring, on the black disc. */
export const innerLinePath = (frame) => circlePath(frame.inner - 2.2);

/**
 * Where the icon goes: its box on the grid (centred on the middle, the largest square that sits well inside the black disc), and
 * the transform that puts a 100 x 100 icon there.
 */
export function iconPlacement(frame) {
  const side = r1((frame.inner - 3.2) * 1.3);
  const scale = side / FRAME_GRID;
  return { side, scale, transform: `translate(${CENTRE} ${CENTRE}) scale(${r1(scale * 1000) / 1000}) translate(-${CENTRE} -${CENTRE})` };
}
