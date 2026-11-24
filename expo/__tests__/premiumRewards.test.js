// lib/premiumRewards.js: the twenty Premium rewards on the Battle Pass, one on every fifth tier. The server hands out exactly these
// (premiumRewardsParity.test.js, premiumPass.test.js).
import {
  PREMIUM_TIER_STEP, PREMIUM_KINDS, CODE_KINDS, PREMIUM_REWARDS, isPremiumTier, premiumRewardAt, CODE_LABELS, premiumPassActive, premiumBenefits,
} from '../lib/premiumRewards';
import { TIER_COUNT } from '../lib/battlePassTiers';

const ofKind = (kind) => PREMIUM_REWARDS.filter((r) => r.kind === kind);

describe('the Premium rewards', () => {
  it('are twenty, one on every fifth tier from 5 to 100, in order', () => {
    expect(PREMIUM_TIER_STEP).toBe(5);
    expect(PREMIUM_REWARDS).toHaveLength(20);
    expect(PREMIUM_REWARDS.map((r) => r.tier)).toEqual(Array.from({ length: 20 }, (_, i) => (i + 1) * 5));
  });

  it('sit on tiers the Battle Pass has', () => {
    PREMIUM_REWARDS.forEach((r) => expect(r.tier).toBeLessThanOrEqual(TIER_COUNT));
  });

  it('are only the kinds the server knows how to give, and use every one of them', () => {
    PREMIUM_REWARDS.forEach((r) => expect(PREMIUM_KINDS).toContain(r.kind));
    PREMIUM_KINDS.forEach((kind) => expect(ofKind(kind).length).toBeGreaterThan(0));
  });

  it('give what was asked for: percent off, exclusive colorways, a week of Legend, more AI messages, a free body scan and one free shirt', () => {
    expect(ofKind('discount').map((r) => r.percent)).toContain(20);
    expect(ofKind('colorway').length).toBeGreaterThanOrEqual(1);
    expect(ofKind('legendTrial').map((r) => r.days)).toContain(7);
    expect(ofKind('aiMessages').length).toBeGreaterThanOrEqual(1);
    expect(ofKind('scanCredit').length).toBeGreaterThanOrEqual(1);
    expect(ofKind('shipping')).toHaveLength(1);
    expect(ofKind('shirt')).toHaveLength(1);
  });

  it('get bigger as the tiers do: the discounts and the bonus messages only go up', () => {
    const percents = ofKind('discount').map((r) => r.percent);
    expect(percents).toEqual([10, 15, 20, 25, 30]);
    const messages = ofKind('aiMessages').map((r) => r.amount);
    expect(messages).toEqual([...messages].sort((a, b) => a - b));
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('number the colorways 1, 2, 3 and make each one once', () => {
    expect(ofKind('colorway').map((r) => r.number)).toEqual([1, 2, 3]);
  });

  it('make the month of Legend the last reward, and a week of it the first of the big ones', () => {
    expect(PREMIUM_REWARDS[19]).toMatchObject({ tier: 100, kind: 'legendTrial', days: 30 });
    expect(premiumRewardAt(25)).toMatchObject({ kind: 'legendTrial', days: 7 });
  });

  it('mark every 25th tier as big, and no other', () => {
    expect(PREMIUM_REWARDS.filter((r) => r.big).map((r) => r.tier)).toEqual([25, 50, 75, 100]);
  });

  it('each have a name and a line about it, in plain words', () => {
    PREMIUM_REWARDS.forEach((r) => {
      expect(r.name.length).toBeGreaterThan(3);
      expect(r.name.length).toBeLessThanOrEqual(26);
      expect(r.blurb.length).toBeGreaterThan(10);
      expect(`${r.name} ${r.blurb}`).not.toMatch(/\b(undefined|null|NaN)\b/);
    });
    expect(premiumRewardAt(5).name).toBe('25 Bonus AI Messages');
    expect(premiumRewardAt(10).name).toBe('10% Off Gear');
    expect(premiumRewardAt(15).name).toBe('Free Body Scan');
    expect(premiumRewardAt(20).name).toBe('Free Shipping');
    expect(premiumRewardAt(25).name).toBe('7 Days of Legend');
    expect(premiumRewardAt(40).name).toBe('Exclusive Colorway 1');
    expect(premiumRewardAt(75).name).toBe('Free Sale Shirt');
  });

  it('carry only the numbers their kind uses', () => {
    PREMIUM_REWARDS.forEach((r) => {
      const numbers = ['amount', 'percent', 'days', 'number'].filter((k) => r[k] !== undefined);
      const expected = { aiMessages: ['amount'], scanCredit: ['amount'], legendTrial: ['days'], discount: ['percent'], shipping: [], colorway: ['number'], shirt: [] }[r.kind];
      expect({ tier: r.tier, numbers }).toEqual({ tier: r.tier, numbers: expected });
      numbers.forEach((k) => expect(Number.isInteger(r[k]) && r[k] > 0).toBe(true));
    });
  });
});

describe('isPremiumTier and premiumRewardAt', () => {
  it('know the twenty tiers, and nothing else', () => {
    [5, 50, 100].forEach((t) => expect(isPremiumTier(t)).toBe(true));
    [0, 1, 4, 7, 99, 105, -5, 5.5, '5', null, undefined, NaN, {}].forEach((t) => expect(isPremiumTier(t)).toBe(false));
  });

  it('give the reward on a tier, or null', () => {
    expect(premiumRewardAt(50)).toBe(PREMIUM_REWARDS[9]);
    expect(premiumRewardAt(51)).toBeNull();
  });
});

describe('the codes', () => {
  it('are the four kinds that give one, each with a name on My Rewards', () => {
    expect(CODE_KINDS).toEqual(['discount', 'shipping', 'colorway', 'shirt']);
    CODE_KINDS.forEach((kind) => expect(CODE_LABELS[kind]).toMatch(/code$/));
    expect(Object.keys(CODE_LABELS).sort()).toEqual([...CODE_KINDS].sort());
  });
});

describe('premiumPassActive', () => {
  const NOW = new Date('2026-11-23T12:00:00.000Z');
  const soon = '2026-12-23T12:00:00.000Z';
  const past = '2026-10-23T12:00:00.000Z';

  it('is true for a pass that says active and has no end', () => {
    expect(premiumPassActive({ active: true, expiresAt: null }, NOW)).toBe(true);
    expect(premiumPassActive({ active: true }, NOW)).toBe(true);
  });

  it('is true until the end date and false from it', () => {
    expect(premiumPassActive({ active: true, expiresAt: soon }, NOW)).toBe(true);
    expect(premiumPassActive({ active: true, expiresAt: past }, NOW)).toBe(false);
    expect(premiumPassActive({ active: true, expiresAt: NOW.toISOString() }, NOW)).toBe(false);
  });

  it('reads an end date typed in the console as a timestamp, a date or a number of milliseconds', () => {
    const later = Date.parse(soon);
    expect(premiumPassActive({ active: true, expiresAt: { toMillis: () => later } }, NOW)).toBe(true);
    expect(premiumPassActive({ active: true, expiresAt: { seconds: later / 1000 } }, NOW)).toBe(true);
    expect(premiumPassActive({ active: true, expiresAt: new Date(later) }, NOW)).toBe(true);
    expect(premiumPassActive({ active: true, expiresAt: later }, NOW)).toBe(true);
    expect(premiumPassActive({ active: true, expiresAt: { toMillis: () => Date.parse(past) } }, NOW)).toBe(false);
  });

  it('is false when it does not say active: true, so a damaged document never gives the pass', () => {
    [null, undefined, 'yes', 1, {}, { active: false }, { active: 'true' }, { active: 1 }, { expiresAt: soon }].forEach((raw) => {
      expect(premiumPassActive(raw, NOW)).toBe(false);
    });
  });

  it('counts an end date that cannot be read as already passed', () => {
    ['someday', {}, true, NaN].forEach((expiresAt) => expect(premiumPassActive({ active: true, expiresAt }, NOW)).toBe(false));
  });
});

describe('premiumBenefits', () => {
  it('lists what the rewards really give, worked out from them', () => {
    expect(premiumBenefits()).toEqual([
      '20 rewards, one every 5 levels',
      'Up to 30% off gear, and free shipping',
      'A free shirt from the sale rack',
      '3 exclusive colorways',
      '7 and 30 days of Legend',
      '3 free body scans and 400 bonus AI messages',
    ]);
  });

  it('add up from the list: 25 + 50 + 75 + 100 + 150 messages, three scans', () => {
    expect(ofKind('aiMessages').reduce((n, r) => n + r.amount, 0)).toBe(400);
    expect(ofKind('scanCredit').reduce((n, r) => n + r.amount, 0)).toBe(3);
  });
});
