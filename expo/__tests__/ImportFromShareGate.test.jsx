// The screen a link shared into Zown opens (app/recipes/import-from-share.jsx) is part of Pro, like the recipe import inside the app:
// a free person gets the lock and nothing is read or looked up, Pro and Legend get the screen.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => global.__router,
  router: { push: (...a) => global.__router.push(...a), back: (...a) => global.__router.back(...a), replace: (...a) => global.__router.replace(...a), canGoBack: () => global.__router.canGoBack() },
}), { virtual: true });
jest.mock('expo-sharing', () => ({ getSharedPayloads: (...a) => global.__payloads(...a), clearSharedPayloads: jest.fn() }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View, { testID: 'header' }) };
});
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };
});
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/recipeStore', () => ({ useRecipeStore: () => ({ addRecipe: jest.fn() }) }));
jest.mock('@/services/recipeExtractionService', () => ({
  __esModule: true,
  default: { extractFromUrl: jest.fn(), extractRecipe: jest.fn(), getSpoonacularExtraction: jest.fn() },
}));

import ImportFromShare from '../app/recipes/import-from-share';
import recipeExtractionService from '@/services/recipeExtractionService';
import { useEntitlementStore } from '../store/entitlementStore';

const as = (tier) => act(() => {
  useEntitlementStore.setState({ plan: tier === 'free' ? null : { tier, status: 'active', expiresAt: null, source: 'manual' }, isLoaded: true });
});
const flush = () => act(async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__payloads = jest.fn(() => []);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  act(() => { useEntitlementStore.setState({ plan: null, isLoaded: false }); });
  delete global.__router;
  delete global.__payloads;
});

describe('recipes shared into Zown: a Pro feature', () => {
  it('shows a free person the lock, reads nothing that was shared, and sends the button to the plans for recipe import', async () => {
    as('free');
    const utils = render(<ImportFromShare />);
    await flush();
    expect(utils.getByTestId('gate-locked')).toBeTruthy();
    expect(utils.getByText('Recipe import is part of Pro')).toBeTruthy();
    expect(global.__payloads).not.toHaveBeenCalled();
    expect(recipeExtractionService.getSpoonacularExtraction).not.toHaveBeenCalled();
    fireEvent.press(utils.getByTestId('gate-see-plans'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { feature: 'recipeImport' } });
  });

  it.each([['pro'], ['legend']])('shows a %s person the screen and reads what was shared', async (tier) => {
    as(tier);
    const utils = render(<ImportFromShare />);
    await flush();
    expect(utils.queryByTestId('gate-locked')).toBeNull();
    expect(global.__payloads).toHaveBeenCalled();
  });
});
