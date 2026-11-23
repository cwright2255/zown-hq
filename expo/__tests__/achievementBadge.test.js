// The maths of the achievement badge (lib/achievementBadge.js): its outline, the slices that give it thickness, and the number read at
// every angle for every part of it.
import {
  ANGLE_STEPS, DEG_PER_PX, ICON_LIFT_RATIO, INTRO, RELIEF_LAYERS, RELIEF_LEAN, RELIEF_SHADOW, RELIEF_WALL_DARK, RELIEF_WALL_LIGHT, RIM_DARK, RIM_LIGHT,
  SLICE_COUNT, SPARKLES, badgeSize, dragAngle, faceScaleTable, faceVisibleTable, facesBack, facesFront, glossOpacity, glossTable, layerDepths,
  medallionBox, mixHex, reliefHeight, reliefLayers, reliefShiftTable, replayAngle, settleAngle, shadowScaleTable, shieldPath, shiftTable,
  sliceColor, sliceScaleTable, sliceThickness, sparklePath, spineScaleTable, turnDuration, zMarkBox,
} from '../lib/achievementBadge';
import { Z_MARK_HEIGHT, Z_MARK_PATH, Z_MARK_WIDTH } from '../lib/zownMark';

const at = (tbl, deg) => tbl.output[tbl.input.indexOf(deg)];
const numbersIn = (path) => (path.match(/-?\d+(\.\d+)?/g) || []).map(Number);

describe('the shield outline', () => {
  it('is one closed shape that starts at a corner and ends with Z', () => {
    const d = shieldPath(100, 112);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/M /g) || []).length).toBe(1);
  });

  it('stays inside its box, and reaches all four sides of it', () => {
    const nums = numbersIn(shieldPath(100, 112));
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(100);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(112);
  });

  it('ends in a point in the middle of the bottom', () => {
    expect(shieldPath(100, 112)).toContain('50 112');
  });

  it('shrinks toward its centre by the inset on every side', () => {
    const nums = numbersIn(shieldPath(100, 112, 0.1));
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(10);
    expect(Math.max(...xs)).toBe(90);
    expect(Math.min(...ys)).toBeCloseTo(11.2, 5);
    expect(Math.max(...ys)).toBeCloseTo(100.8, 5);
  });
});

describe('the size', () => {
  it('is taller than it is wide, and has a depth in proportion', () => {
    expect(badgeSize(200)).toEqual({ width: 200, height: 224, depth: 26 });
  });

  it('is never smaller than a pixel wide or two deep', () => {
    expect(badgeSize(0)).toEqual({ width: 1, height: 1, depth: 2 });
  });
});

describe('the slices', () => {
  it('run from the back to the front, evenly, and are SLICE_COUNT of them', () => {
    const z = layerDepths(26);
    expect(z).toHaveLength(SLICE_COUNT);
    expect(z[0]).toBe(-13);
    expect(z[z.length - 1]).toBe(13);
    for (let i = 1; i < z.length; i += 1) expect(z[i]).toBeGreaterThan(z[i - 1]);
    const gaps = z.slice(1).map((v, i) => Math.round((v - z[i]) * 100) / 100);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.02);
  });

  it('are each thicker than the gap to the next, so edge-on there are no gaps', () => {
    const z = layerDepths(26);
    expect(sliceThickness(26)).toBeGreaterThan(z[1] - z[0]);
  });

  it('shade from dark gold at the back to light gold at the front', () => {
    expect(sliceColor(0)).toBe(RIM_DARK.toLowerCase());
    expect(sliceColor(SLICE_COUNT - 1)).toBe(RIM_LIGHT.toLowerCase());
    expect(sliceColor(5)).not.toBe(sliceColor(6));
  });

  it('mix two colours, a fraction of the way', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#000000', '#ffffff', 7)).toBe('#ffffff');
  });
});

describe('the angles the animation is read at', () => {
  it('go up from 0 to 360 with none out of order and none twice', () => {
    expect(ANGLE_STEPS[0]).toBe(0);
    expect(ANGLE_STEPS[ANGLE_STEPS.length - 1]).toBe(360);
    for (let i = 1; i < ANGLE_STEPS.length; i += 1) expect(ANGLE_STEPS[i]).toBeGreaterThan(ANGLE_STEPS[i - 1]);
    expect(ANGLE_STEPS).toEqual(expect.arrayContaining([89.5, 90, 90.5, 269.5, 270, 270.5]));
  });

  it('every table has a value for every angle', () => {
    for (const tbl of [shiftTable(10), sliceScaleTable(2, 100), faceScaleTable(true), faceScaleTable(false), faceVisibleTable(true), spineScaleTable(), glossTable(true), shadowScaleTable(13, 100)]) {
      expect(tbl.input).toBe(ANGLE_STEPS);
      expect(tbl.output).toHaveLength(ANGLE_STEPS.length);
      expect(tbl.output.every(Number.isFinite)).toBe(true);
    }
  });

  it('says which face is toward the viewer', () => {
    expect(facesFront(0)).toBe(true);
    expect(facesFront(80)).toBe(true);
    expect(facesFront(300)).toBe(true);
    expect(facesFront(100)).toBe(false);
    expect(facesBack(180)).toBe(true);
    expect(facesBack(0)).toBe(false);
    for (const edgeOn of [90, 270]) {
      expect(facesFront(edgeOn)).toBe(false);
      expect(facesBack(edgeOn)).toBe(false);
    }
  });
});

describe('a slice as the badge turns', () => {
  const z = 13;

  it('does not move sideways when it faces you, and moves out to its own depth when edge-on', () => {
    const t = shiftTable(z);
    expect(at(t, 0)).toBe(0);
    expect(at(t, 90)).toBe(13);
    expect(at(t, 180)).toBeCloseTo(0, 5);
    expect(at(t, 270)).toBe(-13);
    expect(at(t, 30)).toBeCloseTo(6.5, 2);
  });

  it('a slice at the back moves the opposite way to one at the front', () => {
    expect(at(shiftTable(-z), 90)).toBe(-at(shiftTable(z), 90));
  });

  it('is its full width facing you (or facing away) and only as thick as itself edge-on', () => {
    const t = sliceScaleTable(2.8, 140);
    expect(at(t, 0)).toBe(1);
    expect(at(t, 180)).toBe(1);
    expect(at(t, 90)).toBeCloseTo(0.02, 3);
    expect(at(t, 270)).toBeCloseTo(0.02, 3);
    expect(at(t, 60)).toBeCloseTo(0.5 + 0.02 * 0.866, 2);
  });
});

describe('the two faces', () => {
  it('the front is full width facing you, edge-on at 90 and turned away (negative, hidden) at 180', () => {
    const t = faceScaleTable(true);
    expect(at(t, 0)).toBe(1);
    expect(at(t, 90)).toBeCloseTo(0, 5);
    expect(at(t, 180)).toBe(-1);
  });

  it('the back is the front turned half way round', () => {
    const t = faceScaleTable(false);
    expect(at(t, 0)).toBe(-1);
    expect(at(t, 180)).toBe(1);
  });

  it('shows the front from 270.5 round to 89.5, the back between, and neither edge-on', () => {
    const front = faceVisibleTable(true);
    const back = faceVisibleTable(false);
    for (const d of [0, 30, 60, 89.5, 270.5, 300, 330, 360]) {
      expect(at(front, d)).toBe(1);
      expect(at(back, d)).toBe(0);
    }
    for (const d of [90.5, 120, 180, 240, 269.5]) {
      expect(at(front, d)).toBe(0);
      expect(at(back, d)).toBe(1);
    }
    for (const d of [90, 270]) {
      expect(at(front, d)).toBe(0);
      expect(at(back, d)).toBe(0);
    }
  });

  it('is never both at once', () => {
    const front = faceVisibleTable(true);
    const back = faceVisibleTable(false);
    ANGLE_STEPS.forEach((d) => expect(at(front, d) + at(back, d)).toBeLessThanOrEqual(1));
  });
});

describe('the spine', () => {
  it('is nothing facing you or away, its full width edge-on, and turned over on the far side', () => {
    const t = spineScaleTable();
    expect(at(t, 0)).toBe(0);
    expect(at(t, 180)).toBeCloseTo(0, 5);
    expect(at(t, 90)).toBe(1);
    expect(at(t, 270)).toBe(-1);
  });
});

describe('the gloss and the shadow', () => {
  it('shows a little face-on and most about 45 degrees to either side', () => {
    expect(glossOpacity(0)).toBe(0.12);
    expect(glossOpacity(45)).toBe(0.55);
    expect(glossOpacity(315)).toBe(0.55);
    expect(glossOpacity(90)).toBe(0.12);
  });

  it('stays between those however far it has turned', () => {
    for (let d = -720; d <= 1080; d += 7) {
      expect(glossOpacity(d)).toBeGreaterThanOrEqual(0.12);
      expect(glossOpacity(d)).toBeLessThanOrEqual(0.55);
    }
  });

  it('the back catches the light where the front would, half a turn on', () => {
    expect(at(glossTable(false), 180)).toBe(glossOpacity(0));
    expect(at(glossTable(false), 220)).toBe(glossOpacity(40));
  });

  it('the shadow is widest facing you and never thinner than a sliver', () => {
    const t = shadowScaleTable(13, 100);
    expect(at(t, 0)).toBe(1);
    expect(at(t, 90)).toBe(0.16);
    expect(Math.min(...t.output)).toBeGreaterThanOrEqual(0.16);
  });
});

describe('turning it with a finger', () => {
  it('turns by DEG_PER_PX degrees for each pixel', () => {
    expect(dragAngle(0, 100)).toBe(100 * DEG_PER_PX);
    expect(dragAngle(360, -50)).toBe(360 - 50 * DEG_PER_PX);
  });

  it('comes to rest on the nearest angle that faces you', () => {
    expect(settleAngle(0)).toBe(0);
    expect(settleAngle(100)).toBe(0);
    expect(settleAngle(200)).toBe(360);
    expect(settleAngle(700)).toBe(720);
    expect(settleAngle(-200)).toBe(-360);
    expect(settleAngle(-100)).toBe(0);
  });

  it('is carried on by a flick before it settles', () => {
    expect(settleAngle(100, 0)).toBe(0);
    expect(settleAngle(100, 1)).toBe(360); // 100 + 1 * 0.8 * 260 = 308
    expect(settleAngle(100, -1)).toBe(0); // 100 - 208 = -108, nearest face-on angle is 0
    expect(settleAngle(10, -2)).toBe(-360); // 10 - 416 = -406
    expect(settleAngle(10, -5)).toBe(-1080); // 10 - 1040 = -1030: a hard flick goes round more than once
  });

  it('treats a speed that is not a number as standing still, and never answers minus zero', () => {
    expect(settleAngle(100, NaN)).toBe(0);
    expect(settleAngle(100, undefined)).toBe(0);
    expect(Object.is(settleAngle(-100), 0)).toBe(true);
  });

  it('sends a tap on once more round, to a face-on angle', () => {
    expect(replayAngle(0)).toBe(360);
    expect(replayAngle(360)).toBe(720);
    expect(replayAngle(100)).toBe(720);
    expect(replayAngle(1080)).toBe(1440);
    expect(replayAngle(-200)).toBe(360);
    for (const a of [0, 1, 99, 360, 500, -50]) expect(replayAngle(a) % 360).toBe(0);
  });

  it('takes longer for a longer turn, within limits', () => {
    expect(turnDuration(0)).toBe(450);
    expect(turnDuration(100)).toBeLessThan(turnDuration(360));
    expect(turnDuration(-360)).toBe(turnDuration(360));
    expect(turnDuration(100000)).toBe(1500);
  });

  it('opens with a spin of three turns', () => {
    expect(INTRO.turns).toBe(3);
    expect(INTRO.spinMs).toBeGreaterThan(INTRO.litMs);
  });
});

describe('the sparkles', () => {
  it('all sit inside the card and have a size', () => {
    expect(SPARKLES.length).toBeGreaterThanOrEqual(4);
    for (const s of SPARKLES) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(1);
      expect(s.size).toBeGreaterThan(0);
      expect(s.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('are four-point stars, a closed shape inside their box', () => {
    const d = sparklePath(12);
    expect(d.startsWith('M 6 0')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const nums = numbersIn(d);
    expect(Math.min(...nums)).toBe(0);
    expect(Math.max(...nums)).toBe(12);
  });
});

describe('the Z of the logo', () => {
  it('is one closed outline, as one path', () => {
    expect(Z_MARK_PATH.startsWith('M ')).toBe(true);
    expect(Z_MARK_PATH.endsWith('Z')).toBe(true);
    expect((Z_MARK_PATH.match(/M /g) || []).length).toBe(1);
    expect((Z_MARK_PATH.match(/Z/g) || []).length).toBe(1);
  });

  it('is made of curves and lines only, with whole numbers of coordinates', () => {
    const letters = Z_MARK_PATH.replace(/[-\d.\s]/g, '');
    expect(letters).toMatch(/^[MCLZ]+$/);
    // every C has six numbers, every L two, the M two
    for (const part of Z_MARK_PATH.split(/(?=[MCLZ])/)) {
      const want = { M: 2, L: 2, C: 6, Z: 0 }[part[0]];
      expect(numbersIn(part)).toHaveLength(want);
    }
  });

  it('stays inside its box, and reaches all four sides of it', () => {
    const nums = numbersIn(Z_MARK_PATH);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeLessThan(5);
    expect(Math.max(...xs)).toBeGreaterThan(Z_MARK_WIDTH - 5);
    expect(Math.min(...ys)).toBeLessThan(5);
    expect(Math.max(...ys)).toBeGreaterThan(Z_MARK_HEIGHT - 5);
    // (a curve's control points can sit a hair outside its box; the drawing leaves room for that)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-5);
    expect(Math.max(...xs)).toBeLessThanOrEqual(Z_MARK_WIDTH + 5);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-5);
    expect(Math.max(...ys)).toBeLessThanOrEqual(Z_MARK_HEIGHT + 5);
  });

  it('is about twice as wide as it is tall, like the logo', () => {
    expect(Z_MARK_WIDTH / Z_MARK_HEIGHT).toBeGreaterThan(2);
    expect(Z_MARK_WIDTH / Z_MARK_HEIGHT).toBeLessThan(2.4);
  });
});

describe('the relief', () => {
  const { width, height, depth } = badgeSize(200);
  const front = reliefLayers(width, height, depth, true);
  const back = reliefLayers(width, height, depth, false);
  const byKind = (layers, kind) => layers.filter((l) => l.kind === kind);

  it('stands out of its face by a part of the depth, never less than 2 pixels', () => {
    expect(reliefHeight(26)).toBeCloseTo(7.8, 5);
    expect(reliefHeight(26)).toBeLessThan(26 / 2);
    expect(reliefHeight(2)).toBe(2);
  });

  it('puts the medallion on the front and the Z on the back, in the middle across, inside the face', () => {
    const m = medallionBox(width, height);
    const zb = zMarkBox(width, height);
    expect(m.cx).toBe(width / 2);
    expect(zb.cx).toBe(width / 2);
    expect(m.cy - m.diameter / 2).toBeGreaterThan(height * 0.07);
    expect(m.diameter).toBeLessThan(width * 0.86);
    expect(zb.width).toBeLessThan(width * 0.86 - 10);
    expect(zb.width / zb.height).toBeCloseTo(Z_MARK_WIDTH / Z_MARK_HEIGHT, 1);
    expect(zb.cy - zb.height / 2).toBeGreaterThan(height * 0.07);
  });

  it('has a top, RELIEF_LAYERS - 1 walls and two shadows on each face, and the icon on the front only', () => {
    for (const layers of [front, back]) {
      expect(byKind(layers, 'top')).toHaveLength(1);
      expect(byKind(layers, 'wall')).toHaveLength(RELIEF_LAYERS - 1);
      expect(byKind(layers, 'shadow')).toHaveLength(2);
    }
    expect(byKind(front, 'icon')).toHaveLength(1);
    expect(byKind(back, 'icon')).toHaveLength(0);
    expect(new Set(front.map((l) => l.key)).size).toBe(front.length);
    expect(new Set(back.map((l) => l.key)).size).toBe(back.length);
  });

  it('rises from the face outward: the shadows lie on the face, the walls climb to the top and the icon floats above it', () => {
    const h = reliefHeight(depth);
    const stack = (layers, side) => layers.filter((l) => l.kind === 'wall' || l.kind === 'top').map((l) => side * l.z);
    for (const [layers, side] of [[front, 1], [back, -1]]) {
      for (const shadow of byKind(layers, 'shadow')) expect(shadow.z).toBe(side * (depth / 2));
      const zs = stack(layers, side);
      for (let i = 1; i < zs.length; i += 1) expect(zs[i]).toBeGreaterThan(zs[i - 1]);
      expect(zs[0]).toBeGreaterThan(depth / 2);
      expect(zs[zs.length - 1]).toBeCloseTo(depth / 2 + h, 1);
    }
    const [icon] = byKind(front, 'icon');
    expect(icon.z).toBeGreaterThan(byKind(front, 'top')[0].z);
    expect(icon.z).toBeCloseTo(depth / 2 + h + depth * ICON_LIFT_RATIO, 1);
  });

  it('leans toward the light: higher layers further up and left, shadows down and right', () => {
    const walls = byKind(front, 'wall').concat(byKind(front, 'top'));
    for (let i = 1; i < walls.length; i += 1) {
      expect(walls[i].leanX).toBeLessThan(walls[i - 1].leanX);
      expect(walls[i].leanY).toBeLessThan(walls[i - 1].leanY);
    }
    const top = byKind(front, 'top')[0];
    expect(top.leanX).toBeCloseTo(RELIEF_LEAN.x * width, 1);
    expect(top.leanY).toBeCloseTo(RELIEF_LEAN.y * width, 1);
    const [soft, softer] = byKind(front, 'shadow');
    expect(soft.leanX).toBeCloseTo(RELIEF_SHADOW.x * width, 1);
    expect(soft.leanY).toBeCloseTo(RELIEF_SHADOW.y * width, 1);
    expect(softer.leanX).toBeGreaterThan(soft.leanX);
    expect(softer.alpha).toBeLessThan(soft.alpha);
    expect(byKind(front, 'icon')[0].leanX).toBeLessThan(top.leanX); // the icon is higher still
    // the same light on both faces
    expect(byKind(back, 'top')[0].leanX).toBe(top.leanX);
    expect(byKind(back, 'top')[0].leanY).toBe(top.leanY);
  });

  it('shades its walls from dark gold at the bottom to lighter gold at the top', () => {
    const walls = byKind(front, 'wall');
    expect(walls[0].color).toBe(RELIEF_WALL_DARK.toLowerCase());
    expect(walls[walls.length - 1].color).not.toBe(walls[0].color);
    const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16);
    for (let i = 1; i < walls.length; i += 1) expect(lum(walls[i].color)).toBeGreaterThan(lum(walls[i - 1].color));
    expect(lum(walls[walls.length - 1].color)).toBeLessThanOrEqual(lum(RELIEF_WALL_LIGHT.toLowerCase()));
  });

  it('scales with the badge: a smaller one has a lower, less leaning relief', () => {
    const small = badgeSize(100);
    const layers = reliefLayers(small.width, small.height, small.depth, true);
    const smallTop = layers.find((l) => l.kind === 'top');
    const bigTop = front.find((l) => l.kind === 'top');
    expect(Math.abs(smallTop.leanX)).toBeLessThan(Math.abs(bigTop.leanX));
    expect(smallTop.z - small.depth / 2).toBeLessThan(bigTop.z - depth / 2);
  });

  it('moves sideways as the badge turns by its depth plus the lean: just the lean facing you, further edge-on', () => {
    const [top] = byKind(front, 'top');
    const t = reliefShiftTable(top.z, top.leanX);
    expect(at(t, 0)).toBeCloseTo(top.leanX, 2);
    expect(at(t, 90)).toBeCloseTo(top.z + top.leanX, 2);
    expect(at(t, 270)).toBeCloseTo(-top.z + top.leanX, 2);
    expect(at(t, 30)).toBeCloseTo(top.z * 0.5 + top.leanX, 1);
    // further out than the face it stands on
    expect(at(t, 60)).toBeGreaterThan(at(shiftTable(depth / 2), 60) + top.leanX - 0.01);
    expect(top.z).toBeGreaterThan(depth / 2);
  });

  it('a layer on the back moves the other way from one on the front', () => {
    const [frontTop] = byKind(front, 'top');
    const [backTop] = byKind(back, 'top');
    expect(at(reliefShiftTable(backTop.z, 0), 90)).toBe(-at(reliefShiftTable(frontTop.z, 0), 90));
  });
});
