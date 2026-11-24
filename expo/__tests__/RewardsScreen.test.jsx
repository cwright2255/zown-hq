// app/rewards.jsx: My Rewards, where the codes from the Premium Pass are kept, with the bonus messages and free scans that are left.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a) => mockPush(...a), back: jest.fn(), canGoBack: () => true } }), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };
});
const mockSetString = jest.fn(async () => true);
jest.mock('expo-clipboard', () => ({ setStringAsync: (...a) => mockSetString(...a) }), { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('../services/callProxy', () => ({ callProxy: jest.fn() }));

import RewardsScreen from '../app/rewards';
import { usePremiumStore } from '../store/premiumStore';
import { CODE_HELP } from '../lib/premiumRewardText';

const CLAIMS = {
  5: { kind: 'aiMessages', amount: 25 },
  10: { kind: 'discount', percent: 10, code: 'Z10-K7P2QX4M' },
  75: { kind: 'shirt', code: 'ZSHIRT-ABCDEFGH' },
  40: { kind: 'colorway', number: 1, code: 'ZCOLOR-MNPQRSTU' },
};

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.getState().clearServerRewards();
});

describe('with nothing claimed', () => {
  it('says there are no codes yet, and points to the Battle Pass', () => {
    const { getByText, getByTestId, queryByTestId } = render(<RewardsScreen />);
    expect(getByText('My Rewards')).toBeTruthy();
    expect(getByTestId('rewards-empty')).toBeTruthy();
    expect(getByText('No codes yet')).toBeTruthy();
    expect(queryByTestId('rewards-left')).toBeNull();
    fireEvent.press(getByText('Go to the Battle Pass'));
    expect(mockPush).toHaveBeenCalledWith('/battlepass');
  });

  it('does not show the help for codes when there are none', () => {
    expect(render(<RewardsScreen />).queryByText(CODE_HELP)).toBeNull();
  });
});

describe('the codes', () => {
  beforeEach(() => { usePremiumStore.getState().applyServerRewards({ claims: CLAIMS, aiMessages: 0, scanCredits: 0 }); });

  it('are listed with what each is for, lowest tier first, and rewards that give no code are left out', () => {
    const { getByTestId, getByText, getAllByTestId, queryByText, queryByTestId } = render(<RewardsScreen />);
    expect(getByTestId('reward-code-10')).toBeTruthy();
    expect(getByText('Discount code')).toBeTruthy();
    expect(getByText('10% off a gear order')).toBeTruthy();
    expect(getByText('Z10-K7P2QX4M')).toBeTruthy();
    expect(getByText('Exclusive Colorway 1')).toBeTruthy();
    expect(getByText('A free shirt from the sale rack')).toBeTruthy();
    expect(queryByTestId('reward-code-5')).toBeNull();
    expect(queryByText('No codes yet')).toBeNull();
    expect(getAllByTestId(/^reward-code-/).map((n) => n.props.testID)).toEqual(['reward-code-10', 'reward-code-40', 'reward-code-75']);
  });

  it('can be selected, so they can be copied by hand', () => {
    expect(render(<RewardsScreen />).getByText('Z10-K7P2QX4M').props.selectable).toBe(true);
  });

  it('say how a code is used', () => {
    expect(render(<RewardsScreen />).getByText(CODE_HELP)).toBeTruthy();
  });

  it('are copied with Copy, which then says Copied for that code only', async () => {
    const { getByTestId, getAllByText } = render(<RewardsScreen />);
    await act(async () => { fireEvent.press(getByTestId('copy-code-10')); });
    expect(mockSetString).toHaveBeenCalledTimes(1);
    expect(mockSetString).toHaveBeenCalledWith('Z10-K7P2QX4M');
    expect(getAllByText('Copied')).toHaveLength(1);
    expect(getAllByText('Copy')).toHaveLength(2);
    await act(async () => { fireEvent.press(getByTestId('copy-code-75')); });
    expect(mockSetString).toHaveBeenLastCalledWith('ZSHIRT-ABCDEFGH');
    expect(getAllByText('Copied')).toHaveLength(1);
  });

  it('are not marked copied when the copy fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockSetString.mockRejectedValueOnce(new Error('no clipboard'));
    const { getByTestId, queryByText } = render(<RewardsScreen />);
    await act(async () => { fireEvent.press(getByTestId('copy-code-10')); });
    expect(queryByText('Copied')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[Rewards] could not copy the code:', 'no clipboard');
    warn.mockRestore();
  });

  it('follow the server: a new claim appears, and a code that is gone disappears', async () => {
    const { queryByText } = render(<RewardsScreen />);
    expect(queryByText('ZSHIRT-ABCDEFGH')).toBeTruthy();
    await act(async () => { usePremiumStore.getState().applyServerRewards({ claims: { 10: CLAIMS[10] }, aiMessages: 0, scanCredits: 0 }); });
    expect(queryByText('ZSHIRT-ABCDEFGH')).toBeNull();
    expect(queryByText('Z10-K7P2QX4M')).toBeTruthy();
  });
});

describe('what is left to use', () => {
  it('shows the bonus messages and the free scans', () => {
    usePremiumStore.getState().applyServerRewards({ claims: CLAIMS, aiMessages: 75, scanCredits: 2 });
    const { getByTestId, getByText } = render(<RewardsScreen />);
    expect(getByTestId('rewards-left')).toBeTruthy();
    expect(getByText('75 bonus AI messages left')).toBeTruthy();
    expect(getByText('2 free body scans left')).toBeTruthy();
  });

  it('shows only what is left, and shows them even when there are no codes', () => {
    usePremiumStore.getState().applyServerRewards({ claims: { 5: CLAIMS[5] }, aiMessages: 25, scanCredits: 0 });
    const { getByText, queryByText, getByTestId } = render(<RewardsScreen />);
    expect(getByText('25 bonus AI messages left')).toBeTruthy();
    expect(queryByText(/free body scan/)).toBeNull();
    expect(getByTestId('rewards-empty')).toBeTruthy();
  });

  it('shows nothing when there is nothing left', () => {
    usePremiumStore.getState().applyServerRewards({ claims: CLAIMS, aiMessages: 0, scanCredits: 0 });
    expect(render(<RewardsScreen />).queryByTestId('rewards-left')).toBeNull();
  });
});
