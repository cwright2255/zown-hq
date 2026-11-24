// lib/badgeFrames.js: the eight ring frames and three metals every badge is made from. Pure data and path maths.
import {
  BLACK, CENTRE, FRAMES, FRAME_GRID, FRAME_IDS, MARK_KINDS, METALS, METAL_IDS, corePath, getFrame, getMetal, iconPlacement, innerLinePath, polarPath,
} from '../lib/badgeFrames';

const numbers = (d) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const points = (d) => {
  const n = numbers(d);
  return Array.from({ length: n.length / 2 }, (_, i) => [n[i * 2], n[i * 2 + 1]]);
};
const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('the frames', () => {
  it('are the eight rings: stone, band, crest, scroll, thorn, gem, lace and star', () => {
    expect(FRAME_IDS).toEqual(['stone', 'band', 'crest', 'scroll', 'thorn', 'gem', 'lace', 'star']);
    expect(FRAMES).toHaveLength(8);
    expect(new Set(FRAMES.map((f) => f.name)).size).toBe(8);
  });

  it('each have a closed outline inside the 100 x 100 grid', () => {
    FRAMES.forEach((frame) => {
      expect(frame.outline).toMatch(/^M [-0-9. L]+ Z$/);
      const pts = points(frame.outline);
      expect(pts.length).toBeGreaterThanOrEqual(300);
      pts.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(FRAME_GRID);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(FRAME_GRID);
      });
    });
  });

  it('are round-ish and fill the grid: the outline reaches near the edge and leaves a ring around the black disc', () => {
    FRAMES.forEach((frame) => {
      const radii = points(frame.outline).map(([x, y]) => Math.hypot(x - CENTRE, y - CENTRE));
      expect(Math.max(...radii)).toBeGreaterThan(44);
      expect(Math.max(...radii)).toBeLessThanOrEqual(50.5);
      expect(Math.min(...radii)).toBeGreaterThan(frame.inner + 4);
    });
  });

  it('each have a black disc smaller than the ring, with room for an icon', () => {
    FRAMES.forEach((frame) => {
      expect(frame.inner).toBeGreaterThanOrEqual(30);
      expect(frame.inner).toBeLessThan(42);
    });
  });

  it('differ from one another: no two outlines match', () => {
    expect(new Set(FRAMES.map((f) => f.outline)).size).toBe(8);
  });

  it('have marks of the known kinds, drawn as paths', () => {
    FRAMES.forEach((frame) => {
      expect(frame.marks.length).toBeGreaterThan(0);
      frame.marks.forEach((mark) => {
        expect(MARK_KINDS).toContain(mark.kind);
        expect(typeof mark.d).toBe('string');
        expect(numbers(mark.d).length).toBeGreaterThanOrEqual(4);
        if (mark.kind === 'groove') expect(mark.width).toBeGreaterThan(0);
      });
    });
  });

  it('say how much of the edge shows edge-on: a fraction from the top and one from the bottom, in order', () => {
    FRAMES.forEach(({ spine }) => {
      expect(spine).toHaveLength(2);
      expect(spine[0]).toBeGreaterThan(0);
      expect(spine[1]).toBeLessThan(1);
      expect(spine[0]).toBeLessThan(spine[1]);
      expect(spine[0] + (1 - spine[1])).toBeCloseTo(spine[0] * 2, 1); // the same share is left at both ends
    });
  });
});

describe('getFrame', () => {
  it('finds a frame by id', () => {
    FRAME_IDS.forEach((id) => expect(getFrame(id).id).toBe(id));
  });

  it('gives the first frame for an id it does not know', () => {
    for (const id of ['', 'round', undefined, null, 7]) expect(getFrame(id)).toBe(FRAMES[0]);
  });
});

describe('the metals', () => {
  it('are bronze, silver and gold, and only those', () => {
    expect(METAL_IDS).toEqual(['bronze', 'silver', 'gold']);
    expect(Object.keys(METALS).sort()).toEqual(['bronze', 'gold', 'silver']);
  });

  it('each have every colour the badge draws with, as a six digit colour', () => {
    METAL_IDS.forEach((id) => {
      const metal = getMetal(id);
      expect(metal.id).toBe(id);
      for (const key of ['light', 'mid', 'dark', 'rimDark', 'rimLight', 'wallDark', 'wallLight', 'shine']) expect(metal[key]).toMatch(HEX);
    });
  });

  it('go from light to dark: the light is lighter than the middle, which is lighter than the dark', () => {
    const lum = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    METAL_IDS.forEach((id) => {
      const m = getMetal(id);
      expect(lum(m.light)).toBeGreaterThan(lum(m.mid));
      expect(lum(m.mid)).toBeGreaterThan(lum(m.dark));
      expect(lum(m.rimLight)).toBeGreaterThan(lum(m.rimDark));
      expect(lum(m.wallLight)).toBeGreaterThan(lum(m.wallDark));
    });
  });

  it('are three different looks', () => {
    expect(new Set(METAL_IDS.map((id) => getMetal(id).mid)).size).toBe(3);
  });

  it('give bronze for a metal it does not know', () => {
    for (const id of ['', 'platinum', undefined, null]) expect(getMetal(id)).toBe(METALS.bronze);
  });

  it('pair with one black only: the discs and the marks are never any other colour', () => {
    expect(BLACK).toMatch(HEX);
    const n = parseInt(BLACK.slice(1), 16);
    expect(Math.max((n >> 16) & 255, (n >> 8) & 255, n & 255)).toBeLessThan(20);
  });
});

describe('polarPath', () => {
  it('draws a circle for a constant radius: one point a degree, all the same distance from the middle', () => {
    const d = polarPath(() => 40);
    const pts = points(d);
    expect(pts).toHaveLength(360);
    pts.forEach(([x, y]) => expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(40, 0));
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
  });

  it('starts to the right of the middle and goes up (0 degrees is right, 90 is up)', () => {
    const pts = points(polarPath((deg) => 30));
    expect(pts[0]).toEqual([80, 50]);
    expect(pts[90][0]).toBeCloseTo(50, 0);
    expect(pts[90][1]).toBeCloseTo(20, 0);
  });

  it('can take bigger steps', () => {
    expect(points(polarPath(() => 30, 10))).toHaveLength(36);
  });

  it('follows the radius it is given, so a spike keeps its tip', () => {
    const pts = points(polarPath((deg) => (deg === 90 ? 49 : 30)));
    expect(pts[90][1]).toBeCloseTo(1, 0);
  });
});

describe('the black disc and the line inside the ring', () => {
  // A circle path is "M x y A r r 0 1 0 x y A r r 0 1 0 x y Z": its radius is the number after each A.
  const radiusOf = (d) => Number(d.match(/A ([\d.]+) /)[1]);

  it('are circles about the middle: the disc as wide as the frame says, the line 2.2 inside its edge', () => {
    FRAMES.forEach((frame) => {
      expect(radiusOf(corePath(frame))).toBe(frame.inner);
      expect(radiusOf(innerLinePath(frame))).toBeCloseTo(frame.inner - 2.2, 5);
      // both start to the right of the middle and come back across to the left of it, so each is centred on (50, 50)
      for (const d of [corePath(frame), innerLinePath(frame)]) {
        const [x1, y1, x2, y2] = [...d.matchAll(/(?:M|A [\d.]+ [\d.]+ 0 1 0) (-?[\d.]+) (-?[\d.]+)/g)].slice(0, 2).flatMap((m) => [Number(m[1]), Number(m[2])]);
        expect(y1).toBe(50);
        expect(y2).toBe(50);
        expect((x1 + x2) / 2).toBeCloseTo(50, 5);
      }
    });
  });

  it('put the line inside the disc', () => {
    FRAMES.forEach((frame) => {
      expect(radiusOf(innerLinePath(frame))).toBeLessThan(radiusOf(corePath(frame)));
    });
  });
});

describe('iconPlacement', () => {
  it('puts the icon in a square that fits inside the black disc', () => {
    FRAMES.forEach((frame) => {
      const { side, scale } = iconPlacement(frame);
      expect(side).toBeGreaterThan(0);
      expect(side).toBeCloseTo((frame.inner - 3.2) * 1.3, 0);
      expect(scale).toBeCloseTo(side / FRAME_GRID, 5);
      // The icon fills most of its square, so its corners reach about 0.7 of the square from the middle: inside the disc.
      expect((side / 2) * Math.SQRT2 * 0.72).toBeLessThan(frame.inner);
    });
  });

  it('turns that into a transform about the middle of the grid', () => {
    const { transform, scale } = iconPlacement(getFrame('crest'));
    expect(transform).toBe(`translate(50 50) scale(${Math.round(scale * 1000) / 1000}) translate(-50 -50)`);
  });

  it('gives a bigger icon to a frame with a bigger disc', () => {
    const band = iconPlacement(getFrame('band'));
    const stone = iconPlacement(getFrame('stone'));
    expect(band.side).toBeGreaterThan(stone.side);
  });
});
