// The Achievements strip on the Profile tab. It used to draw a black circle for every achievement: it asked each one for an `icon` that the
// 300-achievement catalogue does not give (each one carries a `badge` of frame, metal and icon instead), so nothing showed inside the
// circles. It now draws each one's own badge, earned in full and the rest faded, and a tap opens the achievement's screen.
// The real achievement store and catalogue are used.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../src/config/firebase', () => ({
  __esModule: true, auth: { currentUser: { uid: 'u1' } }, db: {}, storage: {}, functions: {}, isFirebaseConfigured: true, default: {},
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }), { virtual: true });
jest.mock('@/services/spotifyService', () => ({ spotifyService: { clearToken: jest.fn(async () => undefined) } }));
jest.mock('@lomray/react-native-apple-music', () => ({ Auth: {}, MusicKit: {}, Player: {}, isMusicSubscriptionError: () => false }), { virtual: true });
jest.mock('expo-image-picker', () => ({}), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/expStore', () => ({
  useExpStore: () => ({
    loadXP: () => {}, getLevel: () => 1, getExpForLevel: (l) => l * 1000, getExpToNextLevel: () => 1000, getTotalExp: () => 0,
  }),
}));
jest.mock('@/store/userStore', () => {
  const { create } = require('zustand');
  return {
    useUserStore: create(() => ({
      user: { uid: 'u1', name: 'Cj' }, isOnboarded: true, loadProfile: async () => {}, updateUser: () => {}, saveProfile: async () => {},
    })),
  };
});
jest.mock('@/store/workoutStore', () => {
  const { create } = require('zustand');
  return { useWorkoutStore: create(() => ({ completedWorkouts: [], loadWorkouts: () => {} })) };
});
jest.mock('@/store/runningStore', () => {
  const { create } = require('zustand');
  return { useRunningStore: create(() => ({ runs: [] })) };
});
jest.mock('@/store/hikingStore', () => {
  const { create } = require('zustand');
  return { useHikingStore: create(() => ({ completedHikes: [] })) };
});

import { router as mockRouter } from 'expo-router';
import ProfileScreen from '../app/profile';
import BadgeMedal from '../components/BadgeMedal';
import { useAchievementStore } from '../store/achievementStore';

const STRIP = 20;

const open = async () => {
  const utils = render(<ProfileScreen />);
  await act(async () => {});
  return utils;
};

beforeEach(() => {
  jest.clearAllMocks();
  useAchievementStore.setState({ loadAchievements: jest.fn() });
  useAchievementStore.getState().clearServerUnlocks();
});

describe('the badges on the Profile tab', () => {
  it('are each achievement\'s own badge, from the frame, metal and icon the catalogue gives it', async () => {
    const utils = await open();
    const { achievements } = useAchievementStore.getState();
    const medals = utils.UNSAFE_getAllByType(BadgeMedal.type);
    expect(medals).toHaveLength(STRIP);
    medals.forEach((m, i) => {
      expect(m.props.frame).toBe(achievements[i].badge.frame);
      expect(m.props.metal).toBe(achievements[i].badge.metal);
      expect(m.props.icon).toBe(achievements[i].badge.icon);
      expect(m.props.size).toBeGreaterThanOrEqual(56);
    });
  });

  it('show the earned ones first and in full, and the ones still to earn faded', async () => {
    useAchievementStore.getState().applyServerUnlocks({ 'xp-5000': '2026-10-01T00:00:00Z', 'level-5': '2026-10-14T10:00:00Z' });
    const utils = await open();
    const dim = utils.UNSAFE_getAllByType(BadgeMedal.type).map((m) => !!m.props.dim);
    expect(dim.slice(0, 2)).toEqual([false, false]);
    expect(dim.slice(2).every(Boolean)).toBe(true);
    const { achievements } = useAchievementStore.getState();
    expect(utils.getByTestId('profile-badge-xp-5000')).toBeTruthy();
    expect(utils.getByTestId('profile-badge-level-5')).toBeTruthy();
    expect(utils.getByText(achievements.find((a) => a.id === 'level-5').name)).toBeTruthy();
  });

  it('are the first twenty, not all 300, so the tab stays quick; View All has the rest', async () => {
    const utils = await open();
    expect(useAchievementStore.getState().achievements).toHaveLength(300);
    expect(utils.UNSAFE_getAllByType(BadgeMedal.type)).toHaveLength(STRIP);
    fireEvent.press(utils.getByText('View All'));
    expect(mockRouter.push).toHaveBeenCalledWith('/profile/achievements');
  });

  it('are buttons that say what they are and whether they are earned', async () => {
    useAchievementStore.getState().applyServerUnlocks({ 'xp-5000': '2026-10-01T00:00:00Z' });
    const utils = await open();
    const { achievements } = useAchievementStore.getState();
    const earned = achievements.find((a) => a.id === 'xp-5000');
    const locked = achievements.find((a) => !a.unlockedAt);
    expect(utils.getByTestId('profile-badge-xp-5000').props.accessibilityRole).toBe('button');
    expect(utils.getByLabelText(`${earned.name}, earned`)).toBeTruthy();
    expect(utils.getByLabelText(`${locked.name}, locked`)).toBeTruthy();
  });

  it('open the achievement\'s own screen when tapped, a locked one too, where its description says how to unlock it', async () => {
    useAchievementStore.getState().applyServerUnlocks({ 'xp-5000': '2026-10-01T00:00:00Z' });
    const utils = await open();
    const locked = useAchievementStore.getState().achievements.find((a) => !a.unlockedAt);
    fireEvent.press(utils.getByTestId('profile-badge-xp-5000'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/achievement/[id]', params: { id: 'xp-5000' } });
    fireEvent.press(utils.getByTestId(`profile-badge-${locked.id}`));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/achievement/[id]', params: { id: locked.id } });
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
  });

  it('are an empty strip, not a crash, before the catalogue has loaded', async () => {
    useAchievementStore.setState({ achievements: [], unlockedAchievements: [] });
    const utils = await open();
    expect(utils.UNSAFE_queryAllByType(BadgeMedal.type)).toHaveLength(0);
    expect(utils.getByText('Achievements')).toBeTruthy();
  });
});
