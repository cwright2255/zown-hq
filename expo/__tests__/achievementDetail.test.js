// What the achievement screen says (lib/achievementDetail.js) and the link the Battle Pass opens for it.
// jest.global-setup.js pins the zone to America/New_York.
import { achievementFacts, achievementHref, formatEarnedDate, readProgress } from '../lib/achievementDetail';

const earned = { id: 'workouts-10', name: 'Dedicated Athlete', description: 'Complete 10 workouts', icon: '🏆', category: 'workout', xpReward: 300, unlockedAt: '2026-10-27T15:04:00.000Z' };
const locked = { ...earned, id: 'workout-streak-30', name: 'Monthly Master', category: 'streak', xpReward: 1500, unlockedAt: undefined };

describe('the link the Battle Pass opens', () => {
  it('names the achievement, and its progress when there is some', () => {
    expect(achievementHref(locked, { current: 12, target: 30 })).toEqual({
      pathname: '/achievement/[id]',
      params: { id: 'workout-streak-30', current: '12', target: '30' },
    });
  });

  it('is just the name when there is no progress to show', () => {
    expect(achievementHref(earned, null)).toEqual({ pathname: '/achievement/[id]', params: { id: 'workouts-10' } });
    expect(achievementHref(earned, undefined).params).toEqual({ id: 'workouts-10' });
  });

  it('leaves out progress that is not a real count toward a real target', () => {
    expect(achievementHref(locked, { current: 3, target: 0 }).params).toEqual({ id: 'workout-streak-30' });
    expect(achievementHref(locked, { current: NaN, target: 5 }).params).toEqual({ id: 'workout-streak-30' });
  });
});

describe('reading progress back out of a link', () => {
  it('takes text or numbers', () => {
    expect(readProgress({ current: '3', target: '7' })).toEqual({ current: 3, target: 7 });
    expect(readProgress({ current: 3, target: 7 })).toEqual({ current: 3, target: 7 });
    expect(readProgress({ current: '0', target: '7' })).toEqual({ current: 0, target: 7 });
  });

  it('takes the first of a list (a name that was repeated)', () => {
    expect(readProgress({ current: ['3', '9'], target: ['7'] })).toEqual({ current: 3, target: 7 });
  });

  it('is null for anything that is not a count toward a target above zero', () => {
    for (const bad of [null, undefined, 'x', {}, { current: '3' }, { target: '7' }, { current: '', target: '7' }, { current: '3', target: '' },
      { current: 'abc', target: '7' }, { current: '3', target: 'abc' }, { current: '3', target: '0' }, { current: '3', target: '-5' },
      { current: '-1', target: '7' }, { current: null, target: 7 }, { current: Infinity, target: 7 }]) {
      expect(readProgress(bad)).toBeNull();
    }
  });
});

describe('the date it was earned', () => {
  it('is written the way the phone writes dates, in the phone\'s own zone', () => {
    expect(formatEarnedDate('2026-10-27T15:04:00.000Z')).toBe('10/27/2026');
    expect(formatEarnedDate('2026-10-28T02:30:00.000Z')).toBe('10/27/2026'); // still the 27th in New York
  });

  it('is null when there is no date, or it is not one', () => {
    expect(formatEarnedDate(undefined)).toBeNull();
    expect(formatEarnedDate('')).toBeNull();
    expect(formatEarnedDate('not a date')).toBeNull();
  });
});

describe('what the screen says about an achievement', () => {
  it('for an earned one: its name in capitals, what it is for, when, and the XP it gave', () => {
    expect(achievementFacts(earned)).toEqual({
      earned: true,
      name: 'Dedicated Athlete',
      title: 'DEDICATED ATHLETE',
      description: 'Complete 10 workouts',
      earnedLabel: 'Earned 10/27/2026',
      rewardValue: '+300 XP',
      rewardLabel: 'XP earned',
      category: 'Workout',
      progress: null,
      badgeLabel: 'Dedicated Athlete badge, earned',
    });
  });

  it('for one still to earn: that it is not earned, the XP it will give, and how far along the person is', () => {
    const facts = achievementFacts(locked, { current: 12, target: 30 });
    expect(facts.earned).toBe(false);
    expect(facts.earnedLabel).toBe('Not earned yet');
    expect(facts.rewardValue).toBe('+1,500 XP');
    expect(facts.rewardLabel).toBe('XP reward');
    expect(facts.badgeLabel).toBe('Monthly Master badge, locked');
    expect(facts.progress).toEqual({ current: 12, target: 30, fraction: 0.4, remaining: 18 });
  });

  it('has no progress for one still to earn when it was not given any', () => {
    expect(achievementFacts(locked).progress).toBeNull();
    expect(achievementFacts(locked, { current: 'x', target: 30 }).progress).toBeNull();
  });

  it('never shows progress past the target', () => {
    const facts = achievementFacts(locked, { current: 40, target: 30 });
    expect(facts.progress).toEqual({ current: 30, target: 30, fraction: 1, remaining: 0 });
  });

  it('rounds up what is left when the target is not whole', () => {
    expect(achievementFacts(locked, { current: 0.4, target: 1 }).progress.remaining).toBe(1);
  });

  it('shows no progress for an earned one, whatever it was given', () => {
    expect(achievementFacts(earned, { current: 3, target: 30 }).progress).toBeNull();
  });

  it('says "Earned" with no date when the server\'s time is not a date', () => {
    expect(achievementFacts({ ...earned, unlockedAt: 'garbage' }).earnedLabel).toBe('Earned');
  });

  it('copes with a missing name, description, category and reward', () => {
    const facts = achievementFacts({ id: 'x' });
    expect(facts.name).toBe('Achievement');
    expect(facts.title).toBe('ACHIEVEMENT');
    expect(facts.description).toBe('');
    expect(facts.category).toBe('');
    expect(facts.rewardValue).toBe('+0 XP');
    expect(facts.earned).toBe(false);
  });

  it('trims what it is given', () => {
    const facts = achievementFacts({ ...earned, name: '  First Steps ', description: ' Go. ', category: ' streak' });
    expect(facts.name).toBe('First Steps');
    expect(facts.description).toBe('Go.');
    expect(facts.category).toBe('Streak');
  });
});
