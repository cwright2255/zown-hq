// components/PremiumRewards.jsx: the Premium Pass card and the twenty rewards under it. It draws what it is given; every claim is the server's.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import PremiumRewards from '../components/PremiumRewards';
import { PREMIUM_REWARDS, premiumBenefits } from '../lib/premiumRewards';

const PASS = { active: true, expiresAt: null };
const show = (over = {}) => {
  const props = {
    level: 100, hasPass: true, pass: PASS, claims: {}, claiming: null, onClaim: jest.fn(), onOpenRewards: jest.fn(), onGetPass: jest.fn(), ...over,
  };
  return { ...render(<PremiumRewards {...props} />), props };
};
const iconsOf = (node) => node.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);

describe('the list', () => {
  it('shows all twenty rewards, in order, each with its level, name and line', () => {
    const { getByTestId, getAllByText, getByText } = show();
    PREMIUM_REWARDS.forEach((r) => {
      const row = getByTestId(`premium-reward-${r.tier}`);
      expect(row).toBeTruthy();
      expect(getAllByText(r.name).length).toBeGreaterThan(0);
    });
    expect(getAllByText('Level 5')).toHaveLength(1);
    expect(getByText('10% Off Gear')).toBeTruthy();
    expect(getByText('7 Days of Legend')).toBeTruthy();
    expect(getByText('Free Sale Shirt')).toBeTruthy();
    expect(getByText('One code for 20% off a gear order.')).toBeTruthy();
  });

  it('draws one icon for the kind of reward on each row', () => {
    const { getByTestId } = show();
    expect(iconsOf(getByTestId('premium-reward-5'))).toContain('chatbubbles-outline');
    expect(iconsOf(getByTestId('premium-reward-10'))).toContain('pricetag-outline');
    expect(iconsOf(getByTestId('premium-reward-15'))).toContain('body-outline');
    expect(iconsOf(getByTestId('premium-reward-20'))).toContain('cube-outline');
    expect(iconsOf(getByTestId('premium-reward-25'))).toContain('diamond-outline');
    expect(iconsOf(getByTestId('premium-reward-40'))).toContain('color-palette-outline');
    expect(iconsOf(getByTestId('premium-reward-75'))).toContain('shirt-outline');
  });
});

describe('a person with the pass', () => {
  it('can claim the tiers their level has reached, and only those', () => {
    const { queryByTestId } = show({ level: 27 });
    [5, 10, 15, 20, 25].forEach((t) => expect(queryByTestId(`premium-claim-${t}`)).toBeTruthy());
    [30, 50, 100].forEach((t) => expect(queryByTestId(`premium-claim-${t}`)).toBeNull());
  });

  it('shows the level on a tier that is out of reach, with a lock', () => {
    const { getByTestId } = show({ level: 27 });
    expect(iconsOf(getByTestId('premium-reward-30'))).toContain('lock-closed');
  });

  it('asks to claim the tier that was pressed', () => {
    const { getByTestId, props } = show({ level: 12 });
    fireEvent.press(getByTestId('premium-claim-10'));
    expect(props.onClaim).toHaveBeenCalledTimes(1);
    expect(props.onClaim).toHaveBeenCalledWith(10);
  });

  it('sees a tier as claimed, with what it gave, and no button', () => {
    const claims = { 5: { kind: 'aiMessages', amount: 25 }, 10: { kind: 'discount', percent: 10, code: 'Z10-K7P2QX4M' } };
    const { queryByTestId, getAllByText, getByText } = show({ level: 12, claims });
    expect(getAllByText('CLAIMED')).toHaveLength(2);
    expect(queryByTestId('premium-claim-5')).toBeNull();
    expect(queryByTestId('premium-claim-10')).toBeNull();
    expect(getByText('+25 bonus AI messages')).toBeTruthy();
    expect(getByText('Code Z10-K7P2QX4M')).toBeTruthy();
  });

  it('sees the end of a Legend trial when it was claimed', () => {
    const until = new Date(2026, 11, 1, 12).toISOString();
    const { getByText } = show({ level: 30, claims: { 25: { kind: 'legendTrial', days: 7, until } } });
    expect(getByText(/^Legend until /)).toBeTruthy();
  });

  it('turns the button off while the claim is on its way', () => {
    const { getByTestId } = show({ level: 12, claiming: 10 });
    expect(getByTestId('premium-claim-10').props.accessibilityState?.disabled ?? getByTestId('premium-claim-10').props.disabled).toBe(true);
    expect(getByTestId('premium-claim-5').props.accessibilityState?.disabled ?? getByTestId('premium-claim-5').props.disabled).not.toBe(true);
  });

  it('sees the pass as active, with its end date, and a way to My Rewards instead of a way to get it', () => {
    const { getByTestId, queryByTestId, getByText, props } = show({ pass: { active: true, expiresAt: new Date(2026, 11, 20, 12).toISOString() } });
    expect(getByText('Premium Pass')).toBeTruthy();
    expect(getByTestId('premium-pass-line').props.children).toMatch(/^Premium Pass active until /);
    expect(queryByTestId('get-premium-pass')).toBeNull();
    fireEvent.press(getByTestId('open-my-rewards'));
    expect(props.onOpenRewards).toHaveBeenCalledTimes(1);
    expect(props.onGetPass).not.toHaveBeenCalled();
  });

  it('sees an active pass with no end date as just active', () => {
    expect(show().getByTestId('premium-pass-line').props.children).toBe('Premium Pass active');
  });

  it('lists what the pass gives, worked out from the rewards', () => {
    const { getByText } = show();
    premiumBenefits().forEach((line) => expect(getByText(line)).toBeTruthy());
  });
});

describe('a person without the pass', () => {
  it('is offered it, and cannot claim anything, whatever their level', () => {
    const { getByText, getByTestId, queryByTestId, props } = show({ hasPass: false, pass: null });
    expect(getByText('Premium Pass')).toBeTruthy();
    expect(getByText('Get the Premium Pass')).toBeTruthy();
    expect(getByText('$9.99 / season')).toBeTruthy();
    PREMIUM_REWARDS.forEach((r) => expect(queryByTestId(`premium-claim-${r.tier}`)).toBeNull());
    expect(queryByTestId('open-my-rewards')).toBeNull();
    fireEvent.press(getByTestId('get-premium-pass'));
    expect(props.onGetPass).toHaveBeenCalledTimes(1);
    expect(props.onOpenRewards).not.toHaveBeenCalled();
  });

  it('sees a lock and "Pass" on every reward', () => {
    const { getByTestId, getAllByText } = show({ hasPass: false, pass: null });
    expect(iconsOf(getByTestId('premium-reward-5'))).toContain('lock-closed');
    expect(getAllByText('Pass')).toHaveLength(20);
  });

  it('still sees what was claimed before the pass ran out, as claimed', () => {
    const { getAllByText, queryByTestId } = show({ hasPass: false, pass: { active: false, expiresAt: null }, claims: { 5: { kind: 'aiMessages', amount: 25 } } });
    expect(getAllByText('CLAIMED')).toHaveLength(1);
    expect(queryByTestId('premium-claim-5')).toBeNull();
    expect(getAllByText('Pass')).toHaveLength(19);
  });
});
