// The badge (components/AchievementBadge.jsx): its parts are all there, and as the angle moves each part does what the maths says:
// the front shows facing you and the back facing away, the rim comes out sideways edge-on, and the whole badge is dim until it is lit.
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import AchievementBadge, { UNLIT_OPACITY } from '../components/AchievementBadge';
import { SLICE_COUNT, badgeSize } from '../lib/achievementBadge';

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

  it('shows the icon on the front and the ZOWN mark on the back', () => {
    const { getByText } = setup();
    expect(getByText('🏆')).toBeTruthy();
    expect(getByText('ZOWN')).toBeTruthy();
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
