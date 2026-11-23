// The badge (components/AchievementBadge.jsx): its parts are all there, and as the angle moves each part does what the maths says:
// the front shows facing you and the back facing away, the rim comes out sideways edge-on, and the whole badge is dim until it is lit.
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, render, within } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import AchievementBadge, { UNLIT_OPACITY } from '../components/AchievementBadge';
import { RELIEF_LAYERS, SLICE_COUNT, badgeSize, medallionBox, reliefLayers, zMarkBox } from '../lib/achievementBadge';

const flat = (el) => StyleSheet.flatten(el.props.style) || {};
const transformOf = (el, key) => {
  const entry = (flat(el).transform || []).find((t) => key in t);
  return entry ? entry[key] : undefined;
};

function setup({ deg = 0, lit = 1, locked = false, bob } = {}) {
  const theta = new Animated.Value(deg);
  const litValue = new Animated.Value(lit);
  const utils = render(<AchievementBadge icon="🏆" size={200} theta={theta} lit={litValue} locked={locked} bob={bob} />);
  const turnTo = (d) => act(() => { theta.setValue(d); });
  return { ...utils, theta, lit: litValue, turnTo };
}

describe('the parts', () => {
  it('has the slices, a spine, a front, a back and a shadow', () => {
    const { getByTestId, queryByTestId } = setup();
    for (let i = 0; i < SLICE_COUNT; i += 1) expect(getByTestId(`badge-slice-${i}`)).toBeTruthy();
    expect(queryByTestId(`badge-slice-${SLICE_COUNT}`)).toBeNull();
    for (const id of ['badge-spine', 'badge-front', 'badge-back', 'badge-shadow']) expect(getByTestId(id)).toBeTruthy();
  });

  it('shows the icon on the front, and on the back the Z alone, not the word', () => {
    const { getByText, queryByText, getByTestId } = setup();
    expect(getByText('🏆')).toBeTruthy();
    expect(queryByText('ZOWN')).toBeNull();
    expect(getByTestId('badge-back-relief-top')).toBeTruthy(); // the Z
    expect(getByTestId('badge-front-relief-icon')).toBeTruthy();
  });

  it('has a lock on the front only when it is locked', () => {
    expect(setup({ locked: true }).UNSAFE_queryAllByType('Ionicons')).toHaveLength(1);
    expect(setup({ locked: false }).UNSAFE_queryAllByType('Ionicons')).toHaveLength(0);
  });

  it('takes no touches itself (the card around it does)', () => {
    expect(setup().getByTestId('achievement-badge').props.pointerEvents).toBe('none');
  });

  it('is as wide as it was asked to be and has room under it for the shadow', () => {
    const { getByTestId } = setup();
    const box = flat(getByTestId('achievement-badge'));
    expect(box.width).toBe(200);
    expect(box.height).toBeGreaterThan(badgeSize(200).height);
  });
});

describe('facing you (0 degrees)', () => {
  it('shows the front at full width and hides the back', () => {
    const { getByTestId } = setup({ deg: 0 });
    expect(flat(getByTestId('badge-front')).opacity).toBe(1);
    expect(transformOf(getByTestId('badge-front'), 'scaleX')).toBe(1);
    expect(flat(getByTestId('badge-back')).opacity).toBe(0);
  });

  it('keeps every slice behind the front face', () => {
    const { getByTestId } = setup({ deg: 0 });
    for (let i = 0; i < SLICE_COUNT; i += 1) {
      expect(transformOf(getByTestId(`badge-slice-${i}`), 'translateX')).toBeCloseTo(0, 5);
      expect(transformOf(getByTestId(`badge-slice-${i}`), 'scaleX')).toBe(1);
    }
  });
});

describe('turned away (180 degrees)', () => {
  it('shows the back and hides the front', () => {
    const { getByTestId } = setup({ deg: 180 });
    expect(flat(getByTestId('badge-front')).opacity).toBe(0);
    expect(flat(getByTestId('badge-back')).opacity).toBe(1);
    expect(transformOf(getByTestId('badge-back'), 'scaleX')).toBe(1);
  });
});

describe('edge-on (90 degrees)', () => {
  it('shows neither face, only the rim: slices spread across the depth and the spine at its full width', () => {
    const { getByTestId } = setup({ deg: 90 });
    const { depth } = badgeSize(200);
    expect(flat(getByTestId('badge-front')).opacity).toBe(0);
    expect(flat(getByTestId('badge-back')).opacity).toBe(0);
    expect(transformOf(getByTestId('badge-slice-0'), 'translateX')).toBeCloseTo(-depth / 2, 1);
    expect(transformOf(getByTestId(`badge-slice-${SLICE_COUNT - 1}`), 'translateX')).toBeCloseTo(depth / 2, 1);
    expect(transformOf(getByTestId('badge-spine'), 'scaleX')).toBe(1);
  });

  it('turns the other way at 270', () => {
    const { getByTestId } = setup({ deg: 270 });
    const { depth } = badgeSize(200);
    expect(transformOf(getByTestId('badge-slice-0'), 'translateX')).toBeCloseTo(depth / 2, 1);
    expect(transformOf(getByTestId('badge-spine'), 'scaleX')).toBe(-1);
  });
});

describe('as the angle moves', () => {
  it('follows it: the front narrows, then the back comes round', () => {
    const { getByTestId, turnTo } = setup({ deg: 0 });
    turnTo(60);
    expect(transformOf(getByTestId('badge-front'), 'scaleX')).toBeCloseTo(0.5, 2);
    expect(flat(getByTestId('badge-front')).opacity).toBe(1);
    turnTo(120);
    expect(flat(getByTestId('badge-front')).opacity).toBe(0);
    expect(flat(getByTestId('badge-back')).opacity).toBe(1);
    expect(transformOf(getByTestId('badge-back'), 'scaleX')).toBeCloseTo(0.5, 2);
  });

  it('takes any number of turns: 1080 is the same as 0, and a negative angle turns it the other way', () => {
    const { getByTestId, turnTo } = setup({ deg: 0 });
    turnTo(1080);
    expect(transformOf(getByTestId('badge-front'), 'scaleX')).toBe(1);
    expect(flat(getByTestId('badge-back')).opacity).toBe(0);
    turnTo(-60);
    expect(transformOf(getByTestId('badge-front'), 'scaleX')).toBeCloseTo(0.5, 2);
    expect(transformOf(getByTestId('badge-slice-0'), 'translateX')).toBeGreaterThan(0); // the other way round from +60
    turnTo(60);
    expect(transformOf(getByTestId('badge-slice-0'), 'translateX')).toBeLessThan(0);
  });
});

describe('lit and dim', () => {
  it('is dim until lit, and shining when lit', () => {
    const { getByTestId, lit } = setup({ lit: 0 });
    expect(flat(getByTestId('badge-group')).opacity).toBeCloseTo(UNLIT_OPACITY, 5);
    expect(flat(getByTestId('badge-shadow')).opacity).toBeCloseTo(UNLIT_OPACITY, 5);
    act(() => { lit.setValue(0.5); });
    expect(flat(getByTestId('badge-group')).opacity).toBeCloseTo((UNLIT_OPACITY + 1) / 2, 5);
    act(() => { lit.setValue(1); });
    expect(flat(getByTestId('badge-group')).opacity).toBe(1);
    expect(flat(getByTestId('badge-shadow')).opacity).toBe(1);
  });

  it('is a little smaller when dim', () => {
    const { getByTestId, lit } = setup({ lit: 0 });
    expect(transformOf(getByTestId('badge-group'), 'scale')).toBeCloseTo(0.94, 5);
    act(() => { lit.setValue(1); });
    expect(transformOf(getByTestId('badge-group'), 'scale')).toBe(1);
  });
});

describe('the float', () => {
  it('lifts the badge when bob is up, and dims the shadow as it goes', () => {
    const bob = new Animated.Value(0);
    const { getByTestId } = setup({ bob });
    expect(transformOf(getByTestId('badge-group'), 'translateY')).toBeCloseTo(0, 5);
    expect(flat(getByTestId('badge-shadow')).opacity).toBe(1);
    act(() => { bob.setValue(1); });
    expect(transformOf(getByTestId('badge-group'), 'translateY')).toBeLessThan(-4);
    expect(flat(getByTestId('badge-shadow')).opacity).toBeCloseTo(0.72, 5);
  });

  it('does not float without bob', () => {
    const { getByTestId } = setup();
    expect(transformOf(getByTestId('badge-group'), 'translateY')).toBe(0);
  });
});

describe('the relief (the Z on the back, the medallion and icon on the front)', () => {
  const { width, height, depth } = badgeSize(200);
  const frontLayers = reliefLayers(width, height, depth, true);
  const backLayers = reliefLayers(width, height, depth, false);
  const ids = (side, layers) => layers.map((l) => `badge-${side}-relief-${l.key}`);

  it('has every layer of both stacks', () => {
    const { getByTestId } = setup();
    for (const id of [...ids('front', frontLayers), ...ids('back', backLayers)]) expect(getByTestId(id)).toBeTruthy();
    expect(frontLayers).toHaveLength(2 + RELIEF_LAYERS + 1);
    expect(backLayers).toHaveLength(2 + RELIEF_LAYERS);
  });

  it('shows the front relief with the front and the back relief with the back, and each is hidden when its face is', () => {
    const { getByTestId, turnTo } = setup({ deg: 0 });
    for (const id of ids('front', frontLayers)) expect(flat(getByTestId(id)).opacity).toBe(1);
    for (const id of ids('back', backLayers)) expect(flat(getByTestId(id)).opacity).toBe(0);
    turnTo(180);
    for (const id of ids('front', frontLayers)) expect(flat(getByTestId(id)).opacity).toBe(0);
    for (const id of ids('back', backLayers)) expect(flat(getByTestId(id)).opacity).toBe(1);
    turnTo(90);
    for (const id of [...ids('front', frontLayers), ...ids('back', backLayers)]) expect(flat(getByTestId(id)).opacity).toBeLessThan(1);
  });

  it('narrows with its face as the badge turns', () => {
    const { getByTestId, turnTo } = setup({ deg: 0 });
    turnTo(60);
    for (const id of ids('front', frontLayers)) expect(transformOf(getByTestId(id), 'scaleX')).toBeCloseTo(0.5, 2);
    turnTo(120);
    for (const id of ids('back', backLayers)) expect(transformOf(getByTestId(id), 'scaleX')).toBeCloseTo(0.5, 2);
  });

  it('is only leaning toward the light when the badge faces you, so its sides show a little', () => {
    const { getByTestId } = setup({ deg: 0 });
    const top = frontLayers.find((l) => l.kind === 'top');
    expect(transformOf(getByTestId('badge-front-relief-top'), 'translateX')).toBeCloseTo(top.leanX, 2);
    expect(transformOf(getByTestId('badge-front-relief-top'), 'translateX')).toBeLessThan(0);
    expect(transformOf(getByTestId('badge-front-relief-shadow-0'), 'translateX')).toBeGreaterThan(0);
  });

  it('stands further out of the face than the face is as the badge turns, the icon furthest', () => {
    const { getByTestId, turnTo } = setup({ deg: 0 });
    turnTo(40);
    const face = transformOf(getByTestId('badge-front'), 'translateX');
    const top = transformOf(getByTestId('badge-front-relief-top'), 'translateX');
    const icon = transformOf(getByTestId('badge-front-relief-icon'), 'translateX');
    const shadow = transformOf(getByTestId('badge-front-relief-shadow-0'), 'translateX');
    const lean = frontLayers.find((l) => l.kind === 'top').leanX;
    expect(top - lean).toBeGreaterThan(face + 1); // out of the face by about the height of the relief times sin(40)
    expect(icon).toBeGreaterThan(top); // (even with the little further lean to the left the icon has)
    expect(shadow).toBeLessThan(top);
  });

  it('turns the other way on the back', () => {
    const { getByTestId, turnTo } = setup({ deg: 0 });
    turnTo(140);
    const face = transformOf(getByTestId('badge-back'), 'translateX');
    const top = transformOf(getByTestId('badge-back-relief-top'), 'translateX');
    const lean = backLayers.find((l) => l.kind === 'top').leanX;
    expect(top - lean).toBeLessThan(face - 1);
  });

  it('sits a little up from its base for the light, and the shadow a little down, on both faces', () => {
    const { getByTestId } = setup();
    const middle = (id) => { const st = flat(getByTestId(id)); return st.top + st.height / 2; };
    const m = medallionBox(width, height);
    const zb = zMarkBox(width, height);
    expect(middle('badge-front-relief-top')).toBeLessThan(m.cy);
    expect(middle('badge-front-relief-top')).toBeCloseTo(m.cy + frontLayers.find((l) => l.kind === 'top').leanY, 1);
    expect(middle('badge-front-relief-shadow-0')).toBeGreaterThan(m.cy);
    expect(middle('badge-back-relief-top')).toBeLessThan(zb.cy);
    expect(middle('badge-back-relief-top')).toBeCloseTo(zb.cy + backLayers.find((l) => l.kind === 'top').leanY, 1);
    expect(middle('badge-back-relief-shadow-0')).toBeGreaterThan(zb.cy);
  });

  it('puts the layers in the middle across the badge, so they narrow about its middle', () => {
    const { getByTestId } = setup();
    for (const id of [...ids('front', frontLayers), ...ids('back', backLayers)]) {
      const style = flat(getByTestId(id));
      expect(style.left + style.width / 2).toBeCloseTo(width / 2, 1);
    }
  });

  it('is part of the group that is dim until lit, locked or not, and the icon is still on its medallion when locked', () => {
    const { getByTestId } = setup({ lit: 0, locked: true });
    expect(flat(getByTestId('badge-group')).opacity).toBeCloseTo(UNLIT_OPACITY, 5);
    expect(within(getByTestId('badge-front-relief-icon')).getByText('🏆')).toBeTruthy();
  });
});
