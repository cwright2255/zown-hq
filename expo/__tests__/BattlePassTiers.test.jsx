// The Battle Pass screen (app/battlepass.jsx) with its 100 tiers, a badge on each, and its 300 achievements shown a few at a time with the
// badge of each, closest to earned first.
import React from 'react';
import { FlatList } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

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
    getLevel: () => global.__level, getExpForLevel: (l) => l * 1000, getExpToNextLevel: () => 1000, getTotalExp: () => global.__level * 1000, loadXP: () => {},
  }),
}));
jest.mock('@/store/battlePassStore', () => ({
  useBattlePassStore: () => ({ claimedTiers: global.__claimed, claimTier: global.__claimTier, claiming: null, loadBattlePass: () => {} }),
}));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => ({ completedWorkouts: [], loadWorkouts: () => {} }) }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => ({ runs: [], loadRuns: () => {} }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => ({ completedHikes: global.__hikes, loadCompletedHikes: () => {} }) }));
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
import BadgeMedal from '../components/BadgeMedal';
import { newCatalogue } from '../lib/achievementCatalogue';
import { TIER_REWARDS } from '../lib/battlePassTiers';

const medals = (utils) => utils.UNSAFE_getAllByType(BadgeMedal.type);
const medal = (utils, testID) => medals(utils).find((m) => m.props.testID === testID);
const showAllAchievements = (utils) => {
  for (let i = 0; i < 20 && utils.queryByText(/Show More Achievements/); i++) fireEvent.press(utils.getByText(/Show More Achievements/));
};

// The list batches its drawing on a timer; the timers are the test's, and run inside act.
beforeEach(() => {
  jest.useFakeTimers();
  router.push.mockClear();
  global.__level = 3;
  global.__claimed = [];
  global.__claimTier = jest.fn(async () => 'claimed');
  global.__hikes = [];
  global.__achievements = newCatalogue();
});
afterEach(() => {
  act(() => { jest.runOnlyPendingTimers(); });
  jest.useRealTimers();
});

describe('the tiers', () => {
  it('are 100 in one row, and the screen says the season runs to level 100', () => {
    const utils = render(<BattlePassScreen />);
    const row = utils.UNSAFE_getAllByType(FlatList).find((l) => l.props.testID === 'tier-list');
    expect(row.props.data).toHaveLength(100);
    expect(row.props.data.map((t) => t.t)).toEqual(TIER_REWARDS.map((r) => r.t));
    expect(utils.getByText('Level 3 / 100')).toBeTruthy();
  });

  it('draw only the tiers near the start to begin with, so the row is quick to open', () => {
    const utils = render(<BattlePassScreen />);
    expect(utils.queryByTestId('tier-badge-1')).toBeTruthy();
    expect(utils.queryByTestId('tier-badge-8')).toBeTruthy();
    expect(utils.queryByTestId('tier-badge-100')).toBeNull();
  });

  it('put the tier\'s own badge on it: the frame, metal and icon in the list', () => {
    const utils = render(<BattlePassScreen />);
    for (const t of [1, 2, 3, 8]) {
      const m = medal(utils, `tier-badge-${t}`);
      expect(m.props.frame).toBe(TIER_REWARDS[t - 1].badge.frame);
      expect(m.props.metal).toBe(TIER_REWARDS[t - 1].badge.metal);
      expect(m.props.icon).toBe(TIER_REWARDS[t - 1].badge.icon);
    }
  });

  it('show a tier out of reach faded, with the XP it needs, and one the level has reached in full', () => {
    const utils = render(<BattlePassScreen />);
    for (const t of [1, 2, 3]) expect(medal(utils, `tier-badge-${t}`).props.dim).toBe(false);
    for (const t of [4, 5, 8]) expect(medal(utils, `tier-badge-${t}`).props.dim).toBe(true);
    expect(utils.getByText('4000 XP')).toBeTruthy();
  });

  it('offer Claim on the first tier not yet claimed, and claim that tier when it is pressed', () => {
    const utils = render(<BattlePassScreen />);
    expect(utils.getAllByText('CLAIM')).toHaveLength(1);
    fireEvent.press(utils.getByText('CLAIM'));
    expect(global.__claimTier).toHaveBeenCalledTimes(1);
    expect(global.__claimTier).toHaveBeenCalledWith(1);
  });

  it('say Claimed for the tiers that are, and offer the next', () => {
    global.__claimed = [1, 2];
    const utils = render(<BattlePassScreen />);
    expect(utils.getAllByText('CLAIMED')).toHaveLength(2);
    fireEvent.press(utils.getByText('CLAIM'));
    expect(global.__claimTier).toHaveBeenCalledWith(3);
  });

  it('open the row at the next tier to claim when many are claimed, not back at the first', () => {
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    global.__level = 40;
    global.__claimed = Array.from({ length: 30 }, (_, i) => i + 1);
    render(<BattlePassScreen />);
    expect(scroll).toHaveBeenCalledWith({ index: 29, animated: false });
    scroll.mockRestore();
  });

  it('stay at the start for someone who has claimed nothing', () => {
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    render(<BattlePassScreen />);
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
  });
});

describe('the achievements', () => {
  it('start with six, each with its own badge, the unlocked ones first', () => {
    global.__achievements = newCatalogue().map((a) => (a.id === 'xp-5000' ? { ...a, unlockedAt: '2026-10-01T00:00:00Z' } : a));
    const utils = render(<BattlePassScreen />);
    const badges = medals(utils).filter((m) => String(m.props.testID).startsWith('achievement-badge-'));
    expect(badges).toHaveLength(6);
    expect(badges[0].props.testID).toBe('achievement-badge-xp-5000');
    expect(badges[0].props.dim).toBe(false);
    badges.slice(1).forEach((m) => expect(m.props.dim).toBe(true));
    const xp5000 = global.__achievements.find((a) => a.id === 'xp-5000');
    expect(badges[0].props.frame).toBe(xp5000.badge.frame);
    expect(badges[0].props.metal).toBe(xp5000.badge.metal);
    expect(badges[0].props.icon).toBe(xp5000.badge.icon);
    expect(utils.getByText('1/300')).toBeTruthy();
  });

  it('list 24 more each time Show More is pressed, with how many are left, and go back with Show Less', () => {
    const utils = render(<BattlePassScreen />);
    const shown = () => medals(utils).filter((m) => String(m.props.testID).startsWith('achievement-badge-')).length;
    expect(shown()).toBe(6);
    expect(utils.getByText('Show More Achievements (294 left)')).toBeTruthy();
    fireEvent.press(utils.getByText(/Show More Achievements/));
    expect(shown()).toBe(30);
    expect(utils.getByText('Show More Achievements (270 left)')).toBeTruthy();
    showAllAchievements(utils);
    expect(shown()).toBe(300);
    expect(utils.queryByText(/Show More Achievements/)).toBeNull();
    fireEvent.press(utils.getByText('Show Less'));
    expect(shown()).toBe(6);
  });

  it('put the ones closest to earned first among those not earned (by the share of the target reached)', () => {
    // At level 3 with 3,000 XP the level 2 and 3 rungs and the XP rungs up to 3,000 are reached, which is all of the full share; the
    // ladders come in the catalogue's order, so level comes before XP.
    const utils = render(<BattlePassScreen />);
    const ids = medals(utils).filter((m) => String(m.props.testID).startsWith('achievement-badge-')).map((m) => m.props.testID.replace('achievement-badge-', ''));
    expect(ids).toEqual(['level-2', 'level-3', 'xp-100', 'xp-250', 'xp-500', 'xp-750']);
  });

  it('show how far along a hike achievement is, from the hikes recorded on the phone', () => {
    global.__hikes = [{ distanceKm: 8, difficultyTier: 'Strenuous' }];
    const utils = render(<BattlePassScreen />);
    showAllAchievements(utils);
    expect(within(utils.getByTestId('achievement-strenuous-hikes-2')).getByText('1/2')).toBeTruthy();
    expect(within(utils.getByTestId('achievement-hikes-3')).getByText('1/3')).toBeTruthy();
    // 8 km is 4.9 miles
    expect(within(utils.getByTestId('achievement-hike-miles-5')).getByText('4.9/5')).toBeTruthy();
  });

  it('show no progress for a virtual race or a journey, which only the server counts: they say what they ask for', () => {
    const utils = render(<BattlePassScreen />);
    showAllAchievements(utils);
    const race = global.__achievements.find((a) => a.id === 'races-5');
    expect(within(utils.getByTestId('achievement-races-5')).getByText(race.description)).toBeTruthy();
    expect(within(utils.getByTestId('achievement-races-5')).queryByText(/^\d+\/\d+$/)).toBeNull();
  });

  it('open the achievement\'s own screen when one is tapped', () => {
    const utils = render(<BattlePassScreen />);
    showAllAchievements(utils);
    fireEvent.press(utils.getByTestId('achievement-level-10'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/achievement/[id]', params: { id: 'level-10', current: '3', target: '10' } });
  });
});
