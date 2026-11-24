// The Premium track on the Battle Pass screen: the twenty rewards, the Premium Pass card, and claiming through the server. What is claimed shows
// up from the premium store, which follows what the server writes; the screen only asks, and says what came of it.
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

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
jest.mock('../services/callProxy', () => ({ callProxy: (...a) => global.__call(...a) }));

jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/expStore', () => ({
  useExpStore: () => ({
    getLevel: () => global.__level, getExpForLevel: (l) => l * 1000, getExpToNextLevel: () => 1000, getTotalExp: () => global.__level * 1000, loadXP: () => {},
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
  useAchievementStore: () => ({ achievements: [], getUnlockedAchievements: () => [], getLockedAchievements: () => [], loadAchievements: () => {} }),
}));

import { router } from 'expo-router';
import BattlePassScreen from '../app/battlepass';
import { usePremiumStore } from '../store/premiumStore';

const openPremium = async (utils) => { await act(async () => { fireEvent.press(utils.getByText('Premium Track')); }); };
const claim = async (utils, tier) => { await act(async () => { fireEvent.press(utils.getByTestId(`premium-claim-${tier}`)); }); };

let alert;
beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  global.__level = 12;
  global.__call = jest.fn(async () => ({ status: 'claimed' }));
  usePremiumStore.getState().clearServerRewards();
});
afterEach(() => alert.mockRestore());

describe('the tracks', () => {
  it('open on the free track, with no Premium rewards in sight', () => {
    const utils = render(<BattlePassScreen />);
    expect(utils.queryByTestId('premium-rewards')).toBeNull();
    expect(utils.getByText('Free Track')).toBeTruthy();
  });

  it('show the twenty Premium rewards on the Premium track, and not the old list of promises', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    expect(utils.getByTestId('premium-rewards')).toBeTruthy();
    expect(utils.getByTestId('premium-reward-5')).toBeTruthy();
    expect(utils.getByTestId('premium-reward-100')).toBeTruthy();
    ['Unlock all 100 tiers', 'Exclusive gear discounts', 'Premium recipes & workouts', 'Custom themes', 'Upgrade to Premium', 'Upgrade Now'].forEach((old) => {
      expect(utils.queryByText(old)).toBeNull();
    });
  });

  it('go back to the free track, which has no Premium rewards', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    await act(async () => { fireEvent.press(utils.getByText('Free Track')); });
    expect(utils.queryByTestId('premium-rewards')).toBeNull();
  });
});

describe('without the Premium Pass', () => {
  it('offers the pass, lets nothing be claimed, and says purchases are not set up yet when it is pressed', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    expect(utils.queryByTestId('premium-claim-5')).toBeNull();
    await act(async () => { fireEvent.press(utils.getByTestId('get-premium-pass')); });
    expect(alert).toHaveBeenCalledWith('Not Available Yet', "Premium purchases aren't set up yet. Check back soon.");
    expect(global.__call).not.toHaveBeenCalled();
  });
});

describe('with the Premium Pass', () => {
  beforeEach(() => { usePremiumStore.getState().applyServerPass({ active: true, expiresAt: null }); });

  it('shows the pass as active and offers a claim on each tier the level has reached', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    expect(utils.getByText('Premium Pass active')).toBeTruthy();
    expect(utils.getByTestId('premium-claim-5')).toBeTruthy();
    expect(utils.getByTestId('premium-claim-10')).toBeTruthy();
    expect(utils.queryByTestId('premium-claim-15')).toBeNull();
  });

  it('asks the server to claim the tier that was pressed, and says what came of it', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    await claim(utils, 10);
    expect(global.__call).toHaveBeenCalledTimes(1);
    expect(global.__call).toHaveBeenCalledWith('claimPremiumReward', { tier: 10 });
    expect(alert).toHaveBeenCalledWith('10% Off Gear Claimed', 'Your code is waiting under My Rewards.');
  });

  it('says what a bonus message claim gave', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    await claim(utils, 5);
    expect(alert).toHaveBeenCalledWith('25 Bonus AI Messages Claimed', "25 bonus AI messages are added. They are used when your day's own messages run out.");
  });

  it('says so when the level has not reached the tier, or the pass is not active on the server', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    global.__call = jest.fn(async () => ({ status: 'locked' }));
    await claim(utils, 5);
    expect(alert).toHaveBeenLastCalledWith('Not Yet', 'Your level has not reached this tier yet.');
    global.__call = jest.fn(async () => ({ status: 'needs-pass' }));
    await claim(utils, 5);
    expect(alert).toHaveBeenLastCalledWith('Premium Pass Needed', 'Premium rewards are for people with the Premium Pass.');
  });

  it('says so when days of Legend cannot be given over the plan the person has', async () => {
    global.__level = 30;
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    global.__call = jest.fn(async () => ({ status: 'has-plan', tier: 'pro' }));
    await claim(utils, 25);
    expect(alert).toHaveBeenLastCalledWith('You Already Have a Plan', expect.stringMatching(/never replaced/));
    // Nothing is shown as claimed: the tier stays to claim.
    expect(utils.getByTestId('premium-claim-25')).toBeTruthy();
  });

  it('says so when the server cannot be reached, and leaves the tier to claim', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    global.__call = jest.fn(async () => { throw new Error('offline'); });
    await claim(utils, 5);
    expect(alert).toHaveBeenLastCalledWith('Could Not Claim', 'The reward could not be claimed. Check your connection and try again.');
    expect(utils.getByTestId('premium-claim-5')).toBeTruthy();
    warn.mockRestore();
  });

  it('shows a tier as claimed once the server has written it, and not before', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    await claim(utils, 5);
    expect(utils.getByTestId('premium-claim-5')).toBeTruthy();
    await act(async () => {
      usePremiumStore.getState().applyServerRewards({ claims: { 5: { at: 'x', kind: 'aiMessages', amount: 25 } }, aiMessages: 25, scanCredits: 0 });
    });
    expect(utils.queryByTestId('premium-claim-5')).toBeNull();
    expect(utils.getByText('+25 bonus AI messages')).toBeTruthy();
  });

  it('opens My Rewards', async () => {
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    await act(async () => { fireEvent.press(utils.getByTestId('open-my-rewards')); });
    expect(router.push).toHaveBeenCalledWith('/rewards');
  });
});

describe('a pass that has ended', () => {
  it('goes back to offering the pass, with what was claimed still shown as claimed', async () => {
    usePremiumStore.getState().applyServerRewards({ claims: { 5: { at: 'x', kind: 'aiMessages', amount: 25 } }, aiMessages: 25, scanCredits: 0 });
    usePremiumStore.getState().applyServerPass({ active: true, expiresAt: '2020-01-01T00:00:00.000Z' });
    const utils = render(<BattlePassScreen />);
    await openPremium(utils);
    expect(utils.getByTestId('get-premium-pass')).toBeTruthy();
    expect(utils.queryByTestId('premium-claim-10')).toBeNull();
    expect(utils.getByText('+25 bonus AI messages')).toBeTruthy();
  });
});
