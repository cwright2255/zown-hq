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
import { MILESTONE_CONFETTI_COUNT, formatXp, levelUpFacts } from '../lib/levelUp';
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

// Every fifth level is a milestone: a bigger pop-up (lib/levelUp.js says which levels, and what it says).
describe('a milestone', () => {
  const MILESTONE = { from: 24, to: 25, kind: 'workout', totalXp: xpRequiredForLevel(25) + 40 };
  const styleOf = (node) => [].concat(node.props.style).flat(Infinity).filter(Boolean).reduce((all, one) => ({ ...all, ...one }), {});

  it('says MILESTONE instead of LEVEL UP, and which milestone it is', async () => {
    const { getByText, queryByText, getByTestId } = await show(MILESTONE, { reduceMotion: true });
    expect(getByText('MILESTONE')).toBeTruthy();
    expect(queryByText('LEVEL UP')).toBeNull();
    expect(getByText('You reached Level 25')).toBeTruthy();
    expect(getByTestId('level-up-milestone').props.children).toBe('Level 25 is a milestone');
    expect(getByText('Workout complete')).toBeTruthy();
  });

  it('is gold: the pill, with dark writing on it, and the edge of the card', async () => {
    const { getByText, getByTestId } = await show(MILESTONE, { reduceMotion: true });
    expect(styleOf(getByText('MILESTONE').parent.parent)).toMatchObject({ backgroundColor: '#FFD700' });
    expect(styleOf(getByText('MILESTONE'))).toMatchObject({ color: '#000000' });
    const card = getByTestId('level-up').findAll((n) => styleOf(n).borderColor === '#FFD700');
    expect(card.length).toBeGreaterThan(0);
  });

  it('keeps every level in between as the ordinary pop-up, with no gold', async () => {
    const { getByText, queryByTestId, getByTestId } = await show(INFO, { reduceMotion: true });
    expect(getByText('LEVEL UP')).toBeTruthy();
    expect(queryByTestId('level-up-milestone')).toBeNull();
    expect(getByTestId('level-up').findAll((n) => styleOf(n).borderColor === '#FFD700')).toHaveLength(0);
    expect(styleOf(getByText('LEVEL UP').parent.parent).backgroundColor).not.toBe('#FFD700');
  });

  it('is a milestone for a jump that lands past one, and says so', async () => {
    const { getByText, getByTestId } = await show({ from: 22, to: 27, kind: 'run', totalXp: xpRequiredForLevel(27) + 5 }, { reduceMotion: true });
    expect(getByText('MILESTONE')).toBeTruthy();
    expect(getByText('You jumped 5 levels, to Level 27')).toBeTruthy();
    expect(getByTestId('level-up-milestone').props.children).toBe('You passed the Level 25 milestone');
  });

  it('is the milestone at the top level too, with the top level\'s own words', async () => {
    const { getByText } = await show({ from: LEVEL_CAP - 1, to: LEVEL_CAP, kind: 'workout', totalXp: 700000 }, { reduceMotion: true });
    expect(getByText('MILESTONE')).toBeTruthy();
    expect(getByText(`You reached Level ${LEVEL_CAP}, the top level`)).toBeTruthy();
    expect(getByText('Max')).toBeTruthy();
  });

  it('names the Premium reward when it is given one, and only on a milestone', async () => {
    const line = 'Premium reward ready: 7 Days of Legend';
    const given = render(<LevelUpCelebration info={MILESTONE} onClose={jest.fn()} rewardLine={line} />);
    await act(async () => { await Promise.resolve(); });
    expect(given.getByTestId('level-up-reward')).toBeTruthy();
    expect(given.getByText(line)).toBeTruthy();
    given.unmount();
    const none = await show(MILESTONE, { reduceMotion: true });
    expect(none.queryByTestId('level-up-reward')).toBeNull();
    none.unmount();
    const ordinary = render(<LevelUpCelebration info={INFO} onClose={jest.fn()} rewardLine={line} />);
    await act(async () => { await Promise.resolve(); });
    expect(ordinary.queryByTestId('level-up-reward')).toBeNull();
  });

  it('says it aloud as a milestone', async () => {
    await show(MILESTONE, { reduceMotion: true });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Milestone level up. You reached Level 25.');
  });

  it('is still closed only by Keep going', async () => {
    const { getByText, onClose } = await show(MILESTONE, { reduceMotion: true });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(getByText('Keep going'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('buzzes once for someone with Reduce Motion on', async () => {
    await show(MILESTONE, { reduceMotion: true });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  describe('with motion', () => {
    beforeEach(() => { jest.useFakeTimers(); });

    it('throws a bigger burst of confetti than an ordinary level, mostly gold', async () => {
      const ordinary = await show(INFO);
      await play(5000);
      const few = ordinary.getByTestId('level-up-confetti').children.length;
      ordinary.unmount();
      const { getByTestId } = await show(MILESTONE);
      await play(5000);
      const confetti = getByTestId('level-up-confetti');
      expect(confetti.children.length).toBeGreaterThan(few);
      expect(confetti.children).toHaveLength(MILESTONE_CONFETTI_COUNT);
      const gold = confetti.children.filter((piece) => styleOf(piece).backgroundColor === '#FFD700').length;
      expect(gold).toBeGreaterThan(MILESTONE_CONFETTI_COUNT / 4);
    });

    it('buzzes twice, the second a moment after the first', async () => {
      await show(MILESTONE);
      await play(5000);
      expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
      expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(1, 'success');
      expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(2, 'success');
    });

    it('buzzes once, not twice, for an ordinary level', async () => {
      await show(INFO);
      await play(5000);
      expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    });

    it('does not buzz the second time once it has been taken off the screen', async () => {
      const { unmount } = await show(MILESTONE);
      // Until the number has turned over (the first buzz), and no further: the second is still waiting.
      for (let i = 0; i < 30 && Haptics.notificationAsync.mock.calls.length === 0; i += 1) await play(100);
      expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
      unmount();
      await play(5000);
      expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    });
  });
});
