// lib/battlePassTiers.js: the 100 Battle Pass tiers and the badge on each. The server lets exactly these be claimed (unlockRulesParity.test.js).
import { TIER_COUNT, TIER_REWARDS, tierBadge, tierMetal } from '../lib/battlePassTiers';
import { FRAME_IDS, METAL_IDS } from '../lib/badgeFrames';
import { getSportIcon } from '../lib/sportIcons';

describe('the tiers', () => {
  it('are 100, numbered 1 to 100 in order', () => {
    expect(TIER_COUNT).toBe(100);
    expect(TIER_REWARDS).toHaveLength(100);
    expect(TIER_REWARDS.map((r) => r.t)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('keep the rewards the first twenty always had', () => {
    expect(TIER_REWARDS.slice(0, 20).map((r) => r.name)).toEqual([
      'Profile Badge', '100 Bonus XP', 'Dark Gold Theme', 'HIIT Elite', 'Power Smoothie', '200 Bonus XP', 'Avatar Frame', 'Beach 10K Route',
      '300 Bonus XP', 'Titan Core', 'Fire Streak Badge', 'Meal Prep Pack', '500 Bonus XP', '20% Gear Discount', 'Pro Running Plan', '750 Bonus XP',
      'Neon Theme', '1000 Bonus XP', 'Champion Badge', 'OWN THE DAY Title',
    ]);
  });

  it('name the rest after their icon, every tenth a Level medal, and the last the Legend', () => {
    for (const r of TIER_REWARDS.slice(20)) {
      if (r.t === 100) expect(r.name).toBe('Level 100 Legend');
      else if (r.t % 10 === 0) expect(r.name).toBe(`Level ${r.t} Medal`);
      else expect(r.name).toBe(`${getSportIcon(r.badge.icon).name} Badge`);
    }
  });

  it('give each tier its own name', () => {
    expect(new Set(TIER_REWARDS.map((r) => r.name)).size).toBe(100);
  });
});

describe('the badges', () => {
  it('are a frame, a metal and an icon that exist, and nothing else', () => {
    TIER_REWARDS.forEach(({ badge }) => {
      expect(Object.keys(badge).sort()).toEqual(['frame', 'icon', 'metal']);
      expect(FRAME_IDS).toContain(badge.frame);
      expect(METAL_IDS).toContain(badge.metal);
      expect(getSportIcon(badge.icon)).toBeTruthy();
    });
  });

  it('are bronze for tiers 1 to 33, silver for 34 to 66 and gold for 67 to 100', () => {
    for (let t = 1; t <= 100; t += 1) expect(tierMetal(t)).toBe(t <= 33 ? 'bronze' : t <= 66 ? 'silver' : 'gold');
    TIER_REWARDS.forEach((r) => expect(r.badge.metal).toBe(tierMetal(r.t)));
  });

  it('are a star for every tenth tier, and one of the other seven frames for the rest', () => {
    TIER_REWARDS.forEach((r) => {
      if (r.t % 10 === 0) expect(r.badge.frame).toBe('star');
      else expect(r.badge.frame).not.toBe('star');
    });
    expect(new Set(TIER_REWARDS.filter((r) => r.t % 10).map((r) => r.badge.frame)).size).toBe(7);
  });

  it('share no icon: each of the 100 tiers has its own', () => {
    expect(new Set(TIER_REWARDS.map((r) => r.badge.icon)).size).toBe(100);
  });

  it('are the same on every call', () => {
    expect(tierBadge(37)).toEqual(tierBadge(37));
    const { iconName, ...rest } = tierBadge(37);
    expect(TIER_REWARDS[36].badge).toEqual(rest);
    expect(iconName).toBe(getSportIcon(rest.icon).name);
  });
});
