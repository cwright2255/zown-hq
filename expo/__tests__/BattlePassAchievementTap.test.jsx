// Tapping an achievement on the Battle Pass opens its own screen (app/achievement/[id].jsx), with how far along the person is when the
// achievement is one that can be counted.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/expStore', () => ({
  useExpStore: () => ({
    getLevel: () => 3, getExpForLevel: (l) => l * 1000, getExpToNextLevel: () => 1000, getTotalExp: () => 3000, loadXP: () => {},
  }),
}));
jest.mock('@/store/battlePassStore', () => ({
  useBattlePassStore: () => ({ claimedTiers: [], claimTier: jest.fn(), claiming: null, loadBattlePass: () => {} }),
}));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => ({ completedWorkouts: [], loadWorkouts: () => {} }) }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => ({ runs: [], loadRuns: () => {} }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => ({ completedHikes: [], loadCompletedHikes: () => {} }) }));
jest.mock('@/store/nutritionStore', () => ({
  useNutritionStore: () => ({ getMealsByDate: () => [], loadNutritionData: () => {}, meals: [] }),
}));
jest.mock('@/store/healthStore', () => ({ useHealthStore: () => ({ steps: 0, stepsDate: null, loadAllHealth: () => {} }) }));
jest.mock('@/store/achievementStore', () => ({
  useAchievementStore: () => ({
    achievements: global.__achievements,
    getUnlockedAchievements: () => global.__achievements.filter((a) => a.unlockedAt),
    getLockedAchievements: () => global.__achievements.filter((a) => !a.unlockedAt),
    loadAchievements: () => {},
  }),
}));

import { router } from 'expo-router';
import BattlePassScreen from '../app/battlepass';

const ach = (id, type, target, over = {}) => ({ id, name: `Name of ${id}`, icon: '🏆', category: 'workout', xpReward: 10, condition: { type, target }, description: 'd', ...over });

beforeEach(() => {
  router.push.mockClear();
  global.__achievements = [
    ach('earned-one', 'level', 2, { unlockedAt: '2026-10-27T15:04:00.000Z' }),
    ach('locked-level', 'level', 5),
    ach('locked-social', 'social_interactions', 10),
  ];
});

describe('an achievement on the Battle Pass', () => {
  it('is a button', () => {
    const { getByTestId } = render(<BattlePassScreen />);
    for (const id of ['earned-one', 'locked-level', 'locked-social']) expect(getByTestId(`achievement-${id}`).props.accessibilityRole).toBe('button');
  });

  it('opens its screen when it is tapped, with how far along the person is', () => {
    const { getByTestId } = render(<BattlePassScreen />);
    fireEvent.press(getByTestId('achievement-locked-level'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/achievement/[id]', params: { id: 'locked-level', current: '3', target: '5' } });
  });

  it('opens an earned one too', () => {
    const { getByTestId } = render(<BattlePassScreen />);
    fireEvent.press(getByTestId('achievement-earned-one'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push.mock.calls[0][0].params.id).toBe('earned-one');
    expect(router.push.mock.calls[0][0].pathname).toBe('/achievement/[id]');
  });

  it('opens one that cannot be counted with no progress', () => {
    const { getByTestId } = render(<BattlePassScreen />);
    fireEvent.press(getByTestId('achievement-locked-social'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/achievement/[id]', params: { id: 'locked-social' } });
  });

  it('still shows what it showed: the earned XP, the count so far, or what it is for', () => {
    const { getByText } = render(<BattlePassScreen />);
    expect(getByText('+10 XP')).toBeTruthy();
    expect(getByText('3/5')).toBeTruthy();
    expect(getByText('d')).toBeTruthy();
  });

  it('opens nothing until it is tapped', () => {
    render(<BattlePassScreen />);
    expect(router.push).not.toHaveBeenCalled();
  });
});
