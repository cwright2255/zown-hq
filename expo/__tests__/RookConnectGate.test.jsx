// Connecting a wearable (app/rook-connect.jsx) is part of Pro: a Free person sees what it is and is sent to the plans instead of to the
// device's sign-in, while Apple Health, the list of what is already connected and Disconnect stay open to every plan.
import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => global.__router }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('firebase/functions', () => ({ httpsCallable: (_functions, name) => async (data) => global.__callable(name, data) }));
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
  return {
    __esModule: true,
    default: ({ title, onPress, disabled }) => mockReact.createElement(
      mockRn.Pressable,
      { onPress: disabled ? undefined : onPress, accessibilityRole: 'button' },
      mockReact.createElement(mockRn.Text, null, title),
    ),
  };
});
jest.mock('@/services/appleHealthService', () => ({
  appleHealthService: {
    getTodayRecovery: jest.fn(async () => null),
    isAvailable: jest.fn(async () => true),
    requestAuthorization: jest.fn(async () => true),
  },
}));

import RookConnectScreen from '../app/rook-connect';
import { useEntitlementStore } from '../store/entitlementStore';

const as = (tier) => act(() => {
  useEntitlementStore.setState({ plan: tier === 'free' ? null : { tier, status: 'active', expiresAt: null, source: 'manual' }, isLoaded: true });
});
const flush = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
const called = (name) => global.__callable.mock.calls.filter(([n]) => n === name);

const PAYWALL = { pathname: '/paywall', params: { feature: 'wearableSync' } };

let connected;
beforeEach(() => {
  connected = [];
  global.__router = { push: jest.fn(), back: jest.fn() };
  global.__callable = jest.fn(async (name) => {
    if (name === 'getRookConnectedSources') return { data: { dataSources: connected } };
    if (name === 'getRookAuthorizerUrl') return { data: { authorized: false, authorizationUrl: 'https://rook.example/connect' } };
    if (name === 'revokeRookDataSource') return { data: { revoked: true } };
    return { data: {} };
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  act(() => { useEntitlementStore.setState({ plan: null, isLoaded: false }); });
  delete global.__router;
  delete global.__callable;
});

describe('connect a wearable: a Pro feature', () => {
  it('tells a Free person it is part of Pro, and offers Upgrade where Connect was', async () => {
    as('free');
    const utils = render(<RookConnectScreen />);
    await flush();
    expect(utils.getByTestId('wearables-locked')).toBeTruthy();
    expect(utils.getByText('Wearable sync is part of Pro. Apple Health stays free.')).toBeTruthy();
    expect(utils.getAllByText('Upgrade')).toHaveLength(8);
    // Apple Health's own button is not one of them.
    expect(utils.getAllByText('Connect')).toHaveLength(1);
  });

  it('sends a Free person to the plans, for wearable sync, and never asks for a sign-in link', async () => {
    as('free');
    const utils = render(<RookConnectScreen />);
    await flush();
    fireEvent.press(utils.getAllByText('Upgrade')[0]);
    await flush();
    expect(global.__router.push).toHaveBeenCalledWith(PAYWALL);
    expect(called('getRookAuthorizerUrl')).toHaveLength(0);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('still lists what a Free person has connected, and lets them disconnect it', async () => {
    as('free');
    connected = [{ data_source: 'Oura', authorized: true }];
    const utils = render(<RookConnectScreen />);
    await flush();
    expect(utils.getByText('Oura')).toBeTruthy();
    expect(utils.getAllByText('Upgrade')).toHaveLength(7);
    fireEvent.press(utils.getByText('Disconnect'));
    await flush();
    expect(called('revokeRookDataSource')).toEqual([['revokeRookDataSource', { dataSource: 'Oura' }]]);
    expect(global.__router.push).not.toHaveBeenCalled();
  });

  it('keeps Apple Health open to a Free person', async () => {
    as('free');
    const { appleHealthService } = require('@/services/appleHealthService');
    const utils = render(<RookConnectScreen />);
    await flush();
    fireEvent.press(utils.getByText('Connect'));
    await flush();
    expect(appleHealthService.requestAuthorization).toHaveBeenCalledTimes(1);
    expect(global.__router.push).not.toHaveBeenCalled();
  });

  it.each(['pro', 'legend'])('lets %s connect: no lock, and the sign-in link opens', async (tier) => {
    as(tier);
    const utils = render(<RookConnectScreen />);
    await flush();
    expect(utils.queryByTestId('wearables-locked')).toBeNull();
    expect(utils.queryByText('Upgrade')).toBeNull();
    // The first "Connect" is Apple Health's; the next is the first provider in the list, Garmin.
    fireEvent.press(utils.getAllByText('Connect')[1]);
    await flush();
    expect(called('getRookAuthorizerUrl')).toEqual([['getRookAuthorizerUrl', { dataSource: 'Garmin' }]]);
    expect(Linking.openURL).toHaveBeenCalledWith('https://rook.example/connect');
    expect(global.__router.push).not.toHaveBeenCalled();
  });

  it('lets the server decide while the phone does not know the plan yet, and sends a refused person to the plans', async () => {
    useEntitlementStore.setState({ plan: null, isLoaded: false });
    global.__callable.mockImplementation(async (name) => {
      if (name === 'getRookConnectedSources') return { data: { dataSources: [] } };
      throw Object.assign(new Error('Wearable sync needs Pro'), {
        code: 'functions/permission-denied',
        details: { reason: 'plan_required', feature: 'wearableSync', needs: 'pro', tier: 'free' },
      });
    });
    const utils = render(<RookConnectScreen />);
    await flush();
    expect(utils.queryByTestId('wearables-locked')).toBeNull();
    fireEvent.press(utils.getAllByText('Connect')[1]);
    await flush();
    expect(called('getRookAuthorizerUrl')).toHaveLength(1);
    expect(global.__router.push).toHaveBeenCalledWith(PAYWALL);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('still shows an ordinary failure as one', async () => {
    as('pro');
    global.__callable.mockImplementation(async (name) => {
      if (name === 'getRookConnectedSources') return { data: { dataSources: [] } };
      throw new Error('network down');
    });
    const utils = render(<RookConnectScreen />);
    await flush();
    fireEvent.press(utils.getAllByText('Connect')[1]);
    await flush();
    expect(Alert.alert).toHaveBeenCalledWith('Connection failed', 'network down');
    expect(global.__router.push).not.toHaveBeenCalled();
  });
});
