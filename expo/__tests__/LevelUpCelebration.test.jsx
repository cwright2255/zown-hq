// The level-up pop-up itself (components/LevelUpCelebration.jsx): what it says, that "Keep going" is the way out and comes on only at the
// end, and that someone with Reduce Motion on gets it finished, with no confetti.
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success' },
}));

import LevelUpCelebration from '../components/LevelUpCelebration';
import { formatXp, levelUpFacts } from '../lib/levelUp';
import { LEVEL_CAP, xpRequiredForLevel } from '../lib/xpRules';

const INFO = { from: 7, to: 8, kind: 'run', totalXp: xpRequiredForLevel(8) + 120 };

let reduce;
beforeEach(() => {
  reduce = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  Haptics.notificationAsync.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// Renders it and lets the phone's answer about Reduce Motion come back.
async function show(info = INFO, { reduceMotion = false } = {}) {
  reduce.mockResolvedValue(reduceMotion);
  const onClose = jest.fn();
  const utils = render(<LevelUpCelebration info={info} onClose={onClose} />);
  await act(async () => { await Promise.resolve(); });
  return { ...utils, onClose };
}

// Moves the fake clock on in steps of 100 ms, letting what each step starts finish. (The clock is moved outside an async act: React's
// "was this act awaited?" check is itself a timer, and it would fire early inside one.)
const play = async (ms) => {
  for (let t = 0; t < ms; t += 100) {
    act(() => { jest.advanceTimersByTime(100); });
    await act(async () => { await Promise.resolve(); });
  }
};

describe('with Reduce Motion on', () => {
  it('shows it finished: the new level, what it gives and the way out', async () => {
    const { getByText, getByTestId, queryByTestId } = await show(INFO, { reduceMotion: true });
    const facts = levelUpFacts(8, INFO.totalXp);
    expect(getByText('LEVEL UP')).toBeTruthy();
    expect(getByTestId('level-up-number').props.children).toBe(8);
    expect(getByText('You reached Level 8')).toBeTruthy();
    expect(getByText('Run complete')).toBeTruthy();
    expect(getByText(`×${facts.multiplier.toFixed(2)}`)).toBeTruthy();
    expect(getByText('XP multiplier')).toBeTruthy();
    expect(getByText('To Level 9')).toBeTruthy();
    expect(getByText(`${formatXp(facts.xpToNext)} XP`)).toBeTruthy();
    expect(getByText('Keep going')).toBeTruthy();
    expect(queryByTestId('level-up-confetti')).toBeNull();
  });

  it('buzzes once', async () => {
    await show(INFO, { reduceMotion: true });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('closes when the person taps Keep going, and only then', async () => {
    const { getByText, onClose } = await show(INFO, { reduceMotion: true });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(getByText('Keep going'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says what happened aloud for a screen reader', async () => {
    await show(INFO, { reduceMotion: true });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Level up. You reached Level 8.');
  });
});

describe('what it says for the different levels', () => {
  it('says how many levels were jumped when it was more than one', async () => {
    const { getByText } = await show({ from: 7, to: 10, kind: 'workout', totalXp: xpRequiredForLevel(10) + 5 }, { reduceMotion: true });
    expect(getByText('You jumped 3 levels, to Level 10')).toBeTruthy();
    expect(getByText('Workout complete')).toBeTruthy();
  });

  it('leaves the line out when it does not know what earned it', async () => {
    const { queryByText } = await show({ from: 7, to: 8, kind: null, totalXp: INFO.totalXp }, { reduceMotion: true });
    expect(queryByText('Workout complete')).toBeNull();
    expect(queryByText('Run complete')).toBeNull();
    expect(queryByText('Mission complete')).toBeNull();
  });

  it('has nothing left to go for at the top level', async () => {
    const { getByText, queryByText } = await show({ from: LEVEL_CAP - 1, to: LEVEL_CAP, kind: 'workout', totalXp: 700000 }, { reduceMotion: true });
    expect(getByText(`You reached Level ${LEVEL_CAP}, the top level`)).toBeTruthy();
    expect(getByText('Highest level')).toBeTruthy();
    expect(getByText('Max')).toBeTruthy();
    expect(queryByText(/^To Level/)).toBeNull();
    expect(getByText('×5.00')).toBeTruthy();
  });
});

describe('with motion', () => {
  beforeEach(() => { jest.useFakeTimers(); });

  it('starts on the level the person came from, with no confetti and the button not yet on', async () => {
    const { getByTestId, getByText, queryByTestId, onClose } = await show(INFO);
    expect(getByTestId('level-up-number').props.children).toBe(7);
    expect(queryByTestId('level-up-confetti')).toBeNull();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    fireEvent.press(getByText('Keep going'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('turns the number over to the new level with a buzz and a burst of confetti, then the button comes on', async () => {
    const { getByTestId, getByText, queryByTestId, onClose } = await show(INFO);
    await play(5000);
    expect(getByTestId('level-up-number').props.children).toBe(8);
    expect(queryByTestId('level-up-confetti')).not.toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText('Keep going'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops its animations when it is taken off the screen', async () => {
    const { unmount } = await show(INFO);
    await play(300);
    unmount();
    await play(5000);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});

describe('when the phone cannot answer or cannot buzz', () => {
  it('still shows it, in motion, if the Reduce Motion question fails', async () => {
    reduce.mockRejectedValue(new Error('no accessibility service'));
    const { getByText } = render(<LevelUpCelebration info={INFO} onClose={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(getByText('LEVEL UP')).toBeTruthy();
    expect(getByText('You reached Level 8')).toBeTruthy();
  });

  it('shows it all the same if the buzz throws', async () => {
    Haptics.notificationAsync.mockImplementationOnce(() => { throw new Error('no haptics'); });
    const { getByText } = await show(INFO, { reduceMotion: true });
    expect(getByText('Keep going')).toBeTruthy();
  });

  it('shows it all the same if the buzz is refused', async () => {
    Haptics.notificationAsync.mockImplementationOnce(() => Promise.reject(new Error('refused')));
    const { getByText } = await show(INFO, { reduceMotion: true });
    expect(getByText('Keep going')).toBeTruthy();
  });
});
