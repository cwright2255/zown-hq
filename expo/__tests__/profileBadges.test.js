import { PROFILE_BADGE_LIMIT, profileBadges } from '../lib/profileBadges';

const list = (prefix, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}` }));

describe('the badges the Profile strip draws', () => {
  it('are the earned ones first, then the ones still to earn, each in the order given', () => {
    const out = profileBadges(list('e', 2), list('l', 2));
    expect(out.map((b) => [b.achievement.id, b.earned])).toEqual([['e-0', true], ['e-1', true], ['l-0', false], ['l-1', false]]);
  });

  it('stop at 20, the earned ones kept ahead of the rest', () => {
    expect(PROFILE_BADGE_LIMIT).toBe(20);
    const out = profileBadges(list('e', 3), list('l', 300));
    expect(out).toHaveLength(20);
    expect(out.slice(0, 3).every((b) => b.earned)).toBe(true);
    expect(out.slice(3).every((b) => !b.earned)).toBe(true);
    expect(profileBadges(list('e', 25), list('l', 5)).every((b) => b.earned)).toBe(true);
  });

  it('can be given another limit, and a limit of nothing draws nothing', () => {
    expect(profileBadges(list('e', 5), list('l', 5), 7)).toHaveLength(7);
    expect(profileBadges(list('e', 5), list('l', 5), 0)).toEqual([]);
    expect(profileBadges(list('e', 5), list('l', 5), -3)).toEqual([]);
  });

  it('are none when there is nothing to draw, or what was given is not a list', () => {
    expect(profileBadges([], [])).toEqual([]);
    expect(profileBadges(undefined, null)).toEqual([]);
    expect(profileBadges('x', { length: 3 })).toEqual([]);
  });
});
