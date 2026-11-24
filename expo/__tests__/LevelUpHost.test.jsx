// When the level-up pop-up comes up (components/LevelUpHost.jsx): after a short wait, above whatever screen the person is on, never before
// onboarding, and once for each level.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// The pop-up itself is tested on its own; here it is a line of text that can be tapped.
jest.mock('../components/LevelUpCelebration', () => {
  const mockReact = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ info, onClose, rewardLine }) => mockReact.createElement(
      Text,
      { onPress: onClose },
      `celebration ${info.from}-${info.to}${rewardLine ? ` | ${rewardLine}` : ''}`,
    ),
  };
});

import LevelUpHost from '../components/LevelUpHost';
import { LEVEL_UP_DELAY_MS } from '../lib/levelUp';
import { announceLevelUp, useLevelUpStore } from '../store/levelUpStore';
import { usePremiumStore } from '../store/premiumStore';

beforeEach(() => {
  jest.useFakeTimers();
  useLevelUpStore.setState({ pending: null });
  usePremiumStore.getState().clearServerRewards();
});
afterEach(() => { jest.useRealTimers(); });

const announce = (from, to, kind = 'workout') => act(() => { announceLevelUp({ from, to, kind, totalXp: 1000 }); });
const wait = (ms) => act(() => { jest.advanceTimersByTime(ms); });

describe('LevelUpHost', () => {
  it('shows nothing when no level has been reached', () => {
    const { toJSON } = render(<LevelUpHost />);
    wait(LEVEL_UP_DELAY_MS * 3);
    expect(toJSON()).toBeNull();
  });

  it('waits a moment after the XP lands, then shows the pop-up', () => {
    const { queryByText } = render(<LevelUpHost />);
    announce(4, 5);
    expect(queryByText('celebration 4-5')).toBeNull();
    wait(LEVEL_UP_DELAY_MS - 1);
    expect(queryByText('celebration 4-5')).toBeNull();
    wait(1);
    expect(queryByText('celebration 4-5')).not.toBeNull();
  });

  it('clears the level when the person taps Keep going, and the pop-up goes', () => {
    const { queryByText, getByText } = render(<LevelUpHost />);
    announce(4, 5);
    wait(LEVEL_UP_DELAY_MS);
    fireEvent.press(getByText('celebration 4-5'));
    expect(useLevelUpStore.getState().pending).toBeNull();
    expect(queryByText('celebration 4-5')).toBeNull();
    wait(LEVEL_UP_DELAY_MS * 3);
    expect(queryByText('celebration 4-5')).toBeNull();
  });

  it('waits again before the next level\'s pop-up', () => {
    const { queryByText, getByText } = render(<LevelUpHost />);
    announce(4, 5);
    wait(LEVEL_UP_DELAY_MS);
    fireEvent.press(getByText('celebration 4-5'));
    announce(5, 6);
    expect(queryByText('celebration 5-6')).toBeNull();
    wait(LEVEL_UP_DELAY_MS);
    expect(queryByText('celebration 5-6')).not.toBeNull();
  });

  it('moves the pop-up on, rather than showing a second one, when more XP lands while it is up', () => {
    const { queryByText } = render(<LevelUpHost />);
    announce(4, 5);
    wait(LEVEL_UP_DELAY_MS);
    announce(5, 6, 'meal');
    expect(queryByText('celebration 4-5')).toBeNull();
    expect(queryByText('celebration 4-6')).not.toBeNull();
  });

  it('shows nothing before onboarding is done, and shows it once it is', () => {
    const { queryByText, rerender } = render(<LevelUpHost enabled={false} />);
    announce(4, 5);
    wait(LEVEL_UP_DELAY_MS * 3);
    expect(queryByText('celebration 4-5')).toBeNull();
    rerender(<LevelUpHost enabled />);
    wait(LEVEL_UP_DELAY_MS);
    expect(queryByText('celebration 4-5')).not.toBeNull();
  });

  it('does not show a level that was cleared during the wait', () => {
    const { queryByText } = render(<LevelUpHost />);
    announce(4, 5);
    wait(LEVEL_UP_DELAY_MS - 100);
    act(() => useLevelUpStore.getState().dismiss());
    wait(500);
    expect(queryByText('celebration 4-5')).toBeNull();
  });

  it('can be told to wait a different time', () => {
    const { queryByText } = render(<LevelUpHost delayMs={50} />);
    announce(4, 5);
    wait(50);
    expect(queryByText('celebration 4-5')).not.toBeNull();
  });
});

// A milestone (every fifth level) names the Premium reward it opens, but only for someone with the Premium Pass.
describe('LevelUpHost at a milestone', () => {
  const pass = (data) => act(() => { usePremiumStore.getState().applyServerPass(data); });

  it('gives the pop-up the Premium reward when the person has the pass', () => {
    pass({ active: true, expiresAt: null });
    const { queryByText } = render(<LevelUpHost />);
    announce(24, 25);
    wait(LEVEL_UP_DELAY_MS);
    expect(queryByText('celebration 24-25 | Premium reward ready: 7 Days of Legend')).not.toBeNull();
  });

  it('names every reward when a jump passes more than one milestone', () => {
    pass({ active: true, expiresAt: null });
    const { queryByText } = render(<LevelUpHost />);
    announce(3, 11);
    wait(LEVEL_UP_DELAY_MS);
    expect(queryByText('celebration 3-11 | Premium rewards ready: 25 Bonus AI Messages and 10% Off Gear')).not.toBeNull();
  });

  it('gives it nothing when the person does not have the pass', () => {
    const { queryByText } = render(<LevelUpHost />);
    announce(24, 25);
    wait(LEVEL_UP_DELAY_MS);
    expect(queryByText('celebration 24-25')).not.toBeNull();
    expect(queryByText(/Premium/)).toBeNull();
  });

  it('gives it nothing when the pass has run out', () => {
    pass({ active: true, expiresAt: '2020-01-01T00:00:00.000Z' });
    const { queryByText } = render(<LevelUpHost />);
    announce(24, 25);
    wait(LEVEL_UP_DELAY_MS);
    expect(queryByText(/Premium/)).toBeNull();
  });

  it('gives it nothing at a level that is not a milestone, pass or not', () => {
    pass({ active: true, expiresAt: null });
    const { queryByText } = render(<LevelUpHost />);
    announce(25, 26);
    wait(LEVEL_UP_DELAY_MS);
    expect(queryByText('celebration 25-26')).not.toBeNull();
    expect(queryByText(/Premium/)).toBeNull();
  });
});
