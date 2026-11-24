// The achievement screen (app/achievement/[id].jsx): what it says for an earned and for a locked achievement, the intro that lights the badge
// and spins it (earned ones only), turning it with a finger, a tap to spin it again, and that someone with Reduce Motion on gets it still.
import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

// The screen's animations run on the phone's native side. There is none in a test, so they are run in JavaScript here, which is what lets the
// test read where the badge is part-way through a turn.
jest.mock('react-native/src/private/animated/NativeAnimatedHelper', () => {
  const actual = jest.requireActual('react-native/src/private/animated/NativeAnimatedHelper');
  return { __esModule: true, default: { ...actual.default, shouldUseNativeDriver: () => false } };
});
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => global.__params,
}));
jest.mock('@/store/achievementStore', () => ({
  useAchievementStore: (select) => select({ achievements: global.__achievements }),
}));

import { router } from 'expo-router';
import AchievementScreen from '../app/achievement/[id]';
import { SPARKLES } from '../lib/achievementBadge';

const EARNED = { id: 'workouts-10', name: 'Dedicated Athlete', description: 'Complete 10 workouts', icon: '🏆', category: 'workout', xpReward: 300, unlockedAt: '2026-10-27T15:04:00.000Z' };
const LOCKED = { id: 'workout-streak-30', name: 'Monthly Master', description: 'Maintain a 30-day workout streak', icon: '💪', category: 'streak', xpReward: 500, unlockedAt: undefined };

let reduce;
beforeEach(() => {
  global.__achievements = [EARNED, LOCKED];
  global.__params = { id: EARNED.id };
  reduce = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  Haptics.impactAsync.mockClear();
  router.back.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const flat = (el) => StyleSheet.flatten(el.props.style) || {};
const scaleX = (el) => (flat(el).transform || []).find((t) => 'scaleX' in t).scaleX;

// Renders it and lets the phone's answer about Reduce Motion come back.
async function show({ reduceMotion = false, params, achievements } = {}) {
  jest.useFakeTimers();
  reduce.mockResolvedValue(reduceMotion);
  if (params) global.__params = params;
  if (achievements) global.__achievements = achievements;
  const utils = render(<AchievementScreen />);
  await act(async () => { await Promise.resolve(); });
  return utils;
}

// Moves the fake clock on in steps of 100 ms, letting what each step starts finish (see __tests__/LevelUpCelebration.test.jsx).
const play = async (ms) => {
  for (let t = 0; t < ms; t += 100) {
    act(() => { jest.advanceTimersByTime(100); });
    await act(async () => { await Promise.resolve(); });
  }
};

let clock = 1000;
const touch = (el, type, x, y, dt = 16) => {
  clock += dt;
  fireEvent(el, type, { nativeEvent: { pageX: x, pageY: y, timestamp: clock } });
};
const drag = (el, from, to, { y = 100, steps = 10, dt = 16 } = {}) => {
  touch(el, 'touchStart', from, y, 0);
  for (let i = 1; i <= steps; i += 1) touch(el, 'touchMove', from + ((to - from) * i) / steps, y, dt);
};

describe('what it says', () => {
  it('for an earned achievement: the name, what it is for, the date, the XP and the category', async () => {
    const { getByText, getByTestId, queryByTestId } = await show();
    expect(getByText('DEDICATED ATHLETE')).toBeTruthy();
    expect(getByText('Complete 10 workouts')).toBeTruthy();
    expect(getByTestId('achievement-earned').props.children).toBe('Earned 10/27/2026');
    expect(getByText('+300 XP')).toBeTruthy();
    expect(getByText('XP earned')).toBeTruthy();
    expect(getByText('WORKOUT')).toBeTruthy();
    expect(getByText('Category')).toBeTruthy();
    expect(queryByTestId('achievement-progress')).toBeNull();
  });

  it('for a locked one: that it is not earned yet, the XP it will give, and the progress it was opened with', async () => {
    const { getByText, getByTestId } = await show({ params: { id: LOCKED.id, current: '12', target: '30' } });
    expect(getByText('MONTHLY MASTER')).toBeTruthy();
    expect(getByTestId('achievement-earned').props.children).toBe('Not earned yet');
    expect(getByText('+500 XP')).toBeTruthy();
    expect(getByText('XP reward')).toBeTruthy();
    expect(getByText('STREAK')).toBeTruthy();
    expect(getByTestId('achievement-progress')).toBeTruthy();
    expect(getByText('12 / 30')).toBeTruthy();
    expect(getByText('18 to go')).toBeTruthy();
  });

  it('shows no progress for a locked one that was opened without any', async () => {
    const { queryByTestId } = await show({ params: { id: LOCKED.id } });
    expect(queryByTestId('achievement-progress')).toBeNull();
  });

  it('shows no progress for an earned one even if it was opened with some', async () => {
    const { queryByTestId } = await show({ params: { id: EARNED.id, current: '3', target: '30' } });
    expect(queryByTestId('achievement-progress')).toBeNull();
  });

  it('describes the badge for a screen reader, and says it can be turned', async () => {
    const { getByTestId } = await show();
    const hero = getByTestId('achievement-hero');
    expect(hero.props.accessibilityLabel).toBe('Dedicated Athlete badge, earned');
    expect(hero.props.accessibilityHint).toMatch(/Drag sideways to turn/);
    expect(hero.props.accessibilityHint).toMatch(/tap to spin/);
  });

  it('describes a locked badge, with no tap to spin', async () => {
    const { getByTestId } = await show({ params: { id: LOCKED.id } });
    expect(getByTestId('achievement-hero').props.accessibilityLabel).toBe('Monthly Master badge, locked');
    expect(getByTestId('achievement-hero').props.accessibilityHint).not.toMatch(/tap to spin/);
  });

  it('goes back from the back arrow', async () => {
    const { getByLabelText } = await show();
    fireEvent.press(getByLabelText('Back'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('says so, with a way back, when there is no such achievement', async () => {
    const { getByText, getByLabelText, queryByTestId } = await show({ params: { id: 'nope' } });
    expect(getByText('This achievement could not be found.')).toBeTruthy();
    expect(queryByTestId('achievement-hero')).toBeNull();
    fireEvent.press(getByLabelText('Back'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('takes a name that came as a list', async () => {
    const { getByText } = await show({ params: { id: [EARNED.id, 'x'] } });
    expect(getByText('DEDICATED ATHLETE')).toBeTruthy();
  });
});

describe('the intro for an earned achievement', () => {
  it('waits a moment, then buzzes once as the badge lights up', async () => {
    await show();
    await play(300);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await play(300);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
    await play(5000);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('starts dim, lights up, spins, and comes to rest facing you', async () => {
    const { getByTestId } = await show();
    expect(flat(getByTestId('badge-group')).opacity).toBeCloseTo(0.3, 5);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
    await play(600);
    const mid = flat(getByTestId('badge-group')).opacity;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1);
    await play(700);
    expect(flat(getByTestId('badge-group')).opacity).toBe(1);
    expect(scaleX(getByTestId('badge-front'))).not.toBe(1); // part way through the spin
    await play(3000);
    expect(scaleX(getByTestId('badge-front'))).toBeCloseTo(1, 5);
    expect(flat(getByTestId('badge-front')).opacity).toBe(1);
    expect(flat(getByTestId('badge-back')).opacity).toBe(0);
  });

  it('floats once it has settled', async () => {
    const { getByTestId } = await show();
    const lift = () => ((flat(getByTestId('badge-group')).transform || []).find((t) => 'translateY' in t) || {}).translateY;
    await play(3000); // the spin runs from 450 ms to 3,050 ms: no float before it has stopped
    expect(lift()).toBeCloseTo(0, 5);
    await play(1500); // about as high as it goes, 1,300 ms after the spin ends
    expect(lift()).toBeLessThan(-6);
  });

  it('has the sparkles', async () => {
    const { getAllByTestId } = await show();
    expect(getAllByTestId('sparkle')).toHaveLength(SPARKLES.length);
  });

  it('does nothing if the person leaves before the badge lights', async () => {
    const { unmount } = await show();
    await play(300);
    unmount();
    await play(5000);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('stops cleanly when the person leaves in the middle of the spin', async () => {
    const { unmount } = await show();
    await play(1500);
    unmount();
    await play(5000);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });
});

describe('a locked achievement', () => {
  it('stays dim, never buzzes and never spins', async () => {
    const { getByTestId } = await show({ params: { id: LOCKED.id, current: '12', target: '30' } });
    await play(6000);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(flat(getByTestId('badge-group')).opacity).toBeCloseTo(0.3, 5);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
    const lift = ((flat(getByTestId('badge-group')).transform || []).find((t) => 'translateY' in t) || {}).translateY;
    expect(lift).toBeCloseTo(0, 5);
  });

  it('has a lock on its badge', async () => {
    const { UNSAFE_queryAllByType } = await show({ params: { id: LOCKED.id } });
    expect(UNSAFE_queryAllByType('Ionicons').filter((i) => i.props.name === 'lock-closed')).toHaveLength(1);
  });

  it('a tap does not spin it', async () => {
    const { getByTestId } = await show({ params: { id: LOCKED.id } });
    await play(1000);
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    touch(hero, 'touchEnd', 100, 100, 50);
    await play(500);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
  });
});

describe('with Reduce Motion on', () => {
  it('is lit and facing you at once, with one buzz and no waiting', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(flat(getByTestId('badge-group')).opacity).toBe(1);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
    await play(5000);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
    const lift = ((flat(getByTestId('badge-group')).transform || []).find((t) => 'translateY' in t) || {}).translateY;
    expect(lift).toBeCloseTo(0, 5); // no float
  });

  it('does not buzz for a locked one, which stays dim', async () => {
    const { getByTestId } = await show({ reduceMotion: true, params: { id: LOCKED.id } });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(flat(getByTestId('badge-group')).opacity).toBeCloseTo(0.3, 5);
  });

  it('a tap does not spin it', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    touch(hero, 'touchEnd', 100, 100, 50);
    await play(300);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
  });

  it('a finger still turns it, with no animation, and it rests facing you when let go', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    drag(hero, 100, 250, { steps: 10, dt: 100 });
    // 150 px, less the first 15 that only started the turn: about 108 degrees, so the back is coming round
    expect(flat(getByTestId('badge-back')).opacity).toBe(1);
    expect(flat(getByTestId('badge-front')).opacity).toBe(0);
    touch(hero, 'touchEnd', 250, 100, 100);
    expect(flat(getByTestId('badge-front')).opacity).toBe(1);
    expect(scaleX(getByTestId('badge-front'))).toBeCloseTo(1, 5);
  });
});

describe('turning it with a finger', () => {
  it('follows the finger sideways, and the back comes round', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    touch(hero, 'touchMove', 140, 100, 100); // past the slop: the turn begins here
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
    touch(hero, 'touchMove', 240, 100, 100); // 100 px: 80 degrees
    expect(scaleX(getByTestId('badge-front'))).toBeCloseTo(Math.cos((80 * Math.PI) / 180), 2);
    expect(flat(getByTestId('badge-front')).opacity).toBe(1);
    touch(hero, 'touchMove', 340, 100, 100); // 200 px: 160 degrees
    expect(flat(getByTestId('badge-front')).opacity).toBe(0);
    expect(flat(getByTestId('badge-back')).opacity).toBe(1);
  });

  it('turns the other way when dragged the other way', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 300, 100, 0);
    touch(hero, 'touchMove', 260, 100, 100);
    touch(hero, 'touchMove', 160, 100, 100);
    const rim = (flat(getByTestId('badge-slice-0')).transform || []).find((t) => 'translateX' in t).translateX;
    expect(rim).toBeGreaterThan(0); // the back edge goes the opposite way to a turn to the right
  });

  it('is not a turn until the finger has gone a few pixels sideways', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    touch(hero, 'touchMove', 104, 101, 50);
    touch(hero, 'touchMove', 106, 102, 50);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
  });

  it('leaves a finger that goes mostly up or down to the page scrolling', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    touch(hero, 'touchMove', 108, 140, 50);
    touch(hero, 'touchMove', 200, 190, 50); // even if it then goes sideways, it began as a scroll
    touch(hero, 'touchMove', 300, 200, 50);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
    touch(hero, 'touchEnd', 300, 200, 50);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
  });

  it('ignores a touch that comes with no position (it must never turn the badge into NaN)', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    fireEvent(hero, 'touchMove', { nativeEvent: {} });
    fireEvent(hero, 'touchMove', { nativeEvent: { pageX: NaN, pageY: 5 } });
    touch(hero, 'touchMove', 140, 100, 100);
    touch(hero, 'touchMove', 240, 100, 100);
    const x = scaleX(getByTestId('badge-front'));
    expect(Number.isFinite(x)).toBe(true);
    expect(x).toBeCloseTo(Math.cos((80 * Math.PI) / 180), 2);
  });

  it('reads the position from the touch list when a browser puts it there', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    const at = (x) => ({ nativeEvent: { touches: [{ pageX: x, pageY: 100 }], timestamp: (clock += 100) } });
    fireEvent(hero, 'touchStart', at(100));
    fireEvent(hero, 'touchMove', at(140));
    fireEvent(hero, 'touchMove', at(240));
    expect(scaleX(getByTestId('badge-front'))).toBeCloseTo(Math.cos((80 * Math.PI) / 180), 2);
  });

  it('takes over from the intro spin, and leaves the badge lit', async () => {
    const { getByTestId } = await show();
    await play(1500); // in the middle of the spin, and lit
    const hero = getByTestId('achievement-hero');
    drag(hero, 100, 200, { steps: 5, dt: 100 });
    const held = scaleX(getByTestId('badge-front'));
    await play(500);
    expect(scaleX(getByTestId('badge-front'))).toBe(held); // the spin does not carry on under the finger
    expect(flat(getByTestId('badge-group')).opacity).toBe(1);
  });

  it('settles facing you after being let go, easing round rather than jumping', async () => {
    const { getByTestId } = await show();
    await play(4200); // the intro is over
    const hero = getByTestId('achievement-hero');
    drag(hero, 100, 260, { steps: 8, dt: 100 });
    touch(hero, 'touchEnd', 260, 100, 100);
    await play(200);
    expect(scaleX(getByTestId('badge-front'))).not.toBe(1); // still moving
    await play(2000);
    expect(scaleX(getByTestId('badge-front'))).toBeCloseTo(1, 5);
    expect(flat(getByTestId('badge-front')).opacity).toBe(1);
  });

  it('also settles when the touch is taken away (the page started to scroll, or a call came in)', async () => {
    const { getByTestId } = await show({ reduceMotion: true });
    const hero = getByTestId('achievement-hero');
    drag(hero, 100, 220, { steps: 6, dt: 100 });
    fireEvent(hero, 'touchCancel', { nativeEvent: { pageX: 220, pageY: 100, timestamp: (clock += 50) } });
    expect(scaleX(getByTestId('badge-front'))).toBeCloseTo(1, 5);
    expect(flat(getByTestId('badge-front')).opacity).toBe(1);
  });
});

describe('a tap on an earned badge', () => {
  it('spins it once more, and it comes to rest facing you', async () => {
    const { getByTestId } = await show();
    await play(4200);
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    touch(hero, 'touchEnd', 100, 100, 60);
    await play(300);
    expect(scaleX(getByTestId('badge-front'))).not.toBe(1);
    await play(2000);
    expect(scaleX(getByTestId('badge-front'))).toBeCloseTo(1, 5);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1); // the buzz is for lighting up only
  });

  it('does nothing while the badge is still doing its opening spin: it carries on exactly as if it had not been touched', async () => {
    const frontAfter = async (tapped) => {
      const { getByTestId, unmount } = await show();
      await play(1500); // in the middle of the opening spin
      if (tapped) {
        const hero = getByTestId('achievement-hero');
        touch(hero, 'touchStart', 100, 100, 0);
        touch(hero, 'touchEnd', 100, 100, 60);
      }
      await play(700);
      const x = scaleX(getByTestId('badge-front'));
      unmount();
      return x;
    };
    const untouched = await frontAfter(false);
    const tapped = await frontAfter(true);
    expect(untouched).not.toBe(1); // (still turning, so the two are being compared part way through)
    expect(tapped).toBeCloseTo(untouched, 5);
  });

  it('starts the float once, however many times the badge has come to rest', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    const { getByTestId } = await show();
    await play(4200); // the opening spin is over: the float has started
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    touch(hero, 'touchEnd', 100, 100, 60);
    await play(2500); // and the badge has come to rest again after the tap
    expect(loop).toHaveBeenCalledTimes(SPARKLES.length + 1); // the sparkles twinkle in a loop each, and the float is one more
  });

  it('is not a tap if the touch was cancelled', async () => {
    const { getByTestId } = await show();
    await play(4200);
    const hero = getByTestId('achievement-hero');
    touch(hero, 'touchStart', 100, 100, 0);
    fireEvent(hero, 'touchCancel', { nativeEvent: { pageX: 100, pageY: 100, timestamp: (clock += 50) } });
    await play(300);
    expect(scaleX(getByTestId('badge-front'))).toBe(1);
  });
});
