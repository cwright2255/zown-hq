// lib/badgeTitles.js: the hand-written names of the 300 achievements and of Battle Pass tiers 21 to 100. Each is a joke about something the app
// has (never about a sport it lacks, though an idiom may wink at the sport on the badge), so the list has to be whole, with no name used
// twice, short enough to sit on its card, and free of the sports the app does not have.
import { ACHIEVEMENT_TITLES, TIER_TITLES } from '../lib/badgeTitles';
import { ACHIEVEMENT_CATALOGUE } from '../lib/achievementCatalogue';
import { TIER_REWARDS } from '../lib/battlePassTiers';

const plain = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const ach = Object.entries(ACHIEVEMENT_TITLES);
const tiers = Object.entries(TIER_TITLES);

describe('the achievement names', () => {
  it('are one for each of the 300 achievements, no more and no fewer', () => {
    expect(ach).toHaveLength(300);
    expect(Object.keys(ACHIEVEMENT_TITLES).sort()).toEqual(ACHIEVEMENT_CATALOGUE.map((a) => a.id).sort());
  });

  it('are used by the catalogue, in its order', () => {
    expect(ACHIEVEMENT_CATALOGUE.map((a) => a.name)).toEqual(ACHIEVEMENT_CATALOGUE.map((a) => ACHIEVEMENT_TITLES[a.id]));
  });

  it('are short enough to fit a card: 30 characters or fewer', () => {
    ach.forEach(([id, name]) => expect({ id, ok: name.length <= 30 }).toEqual({ id, ok: true }));
  });
});

describe('the Battle Pass badge names', () => {
  it('are one for each of tiers 21 to 100', () => {
    expect(tiers).toHaveLength(80);
    expect(Object.keys(TIER_TITLES).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 80 }, (_, i) => i + 21));
  });

  it('are used by the tiers, and the first twenty tiers keep their reward names', () => {
    TIER_REWARDS.slice(20).forEach((r) => expect(r.name).toBe(TIER_TITLES[r.t]));
    expect(TIER_REWARDS[0].name).toBe('Profile Badge');
    expect(TIER_REWARDS[19].name).toBe('OWN THE DAY Title');
  });

  it('are short enough to fit under a tier badge in two lines: 26 characters or fewer', () => {
    tiers.forEach(([tier, name]) => expect({ tier, ok: name.length <= 26 }).toEqual({ tier, ok: true }));
  });
});

describe('all the names', () => {
  const all = [...ach.map(([, n]) => n), ...tiers.map(([, n]) => n)];

  it('are all different, ignoring capitals and punctuation, across both lists', () => {
    const seen = new Map();
    all.forEach((name) => {
      const key = plain(name);
      expect({ name, taken: seen.has(key) }).toEqual({ name, taken: false });
      seen.set(key, name);
    });
    expect(seen.size).toBe(380);
  });

  it('are written as names: no stray spaces, no empty or placeholder text', () => {
    all.forEach((name) => {
      expect(typeof name).toBe('string');
      expect(name).toBe(name.trim());
      expect(name).not.toMatch(/\s{2,}/);
      expect(name.length).toBeGreaterThanOrEqual(4);
      expect(name).not.toMatch(/\b(todo|tbd|xxx|lorem|undefined|null)\b/i);
    });
  });

  it('are not the old plain names: none ends in Badge or Club', () => {
    all.forEach((name) => expect(name).not.toMatch(/ (Badge|Club)$/));
  });

  // The icon set has swimmers, boxers, fencers, skiers and so on, but the app has none of those sports, so no name says one. An idiom is
  // fine ("Going Swimmingly" on a finished race, "Uphill Both Ways" on a ski slope): what is not is the sport itself.
  const NOT_IN_THE_APP = new RegExp(
    '\\b(swim(?!mingly)\\w*|pool|boxing|boxer|kickbox\\w*|golf\\w*|tennis|basketball|soccer|baseball|volleyball|hockey|rugby|cricket|badminton|netball'
    + '|fenc(?:e|er|ers|ing)|epee|kayak\\w*|canoe\\w*|surf(?:er|ers|ing)?|ski(?:ing|er|ers|s)?|snowboard\\w*|skat(?:e|er|ers|ing|eboard\\w*)'
    + '|sail(?:ing|board\\w*)|windsurf\\w*|bowling|archery|judo|karate|wrestl\\w*|biathlon|polo|cycling|cyclist|bike|bicycle|football|lacrosse'
    + '|curling|rowing|sculling|handball|ping.?pong)\\b',
    'i',
  );

  it('do not name a sport the app does not have', () => {
    all.forEach((name) => expect({ name, sport: (name.match(NOT_IN_THE_APP) || [])[0] }).toEqual({ name, sport: undefined }));
  });

  it('catch a sport when one slips in (the check itself)', () => {
    ['Swim Lanes', 'Boxing Ring', 'Fencing Duel', 'Downhill Ski', 'Pool Party', 'Golf Putt', 'Snowboard Carve'].forEach((name) => {
      expect(name).toMatch(NOT_IN_THE_APP);
    });
    ['Going Swimmingly', 'Surface of the Sun', 'Skip the Excuses', 'Bowled Over', 'Uphill Both Ways'].forEach((name) => {
      expect(name).not.toMatch(NOT_IN_THE_APP);
    });
  });

  it('wink at an icon the app has no sport for, with an idiom about a run or a workout', () => {
    expect(ACHIEVEMENT_TITLES['races-5']).toBe('Going Swimmingly');
    expect(ACHIEVEMENT_TITLES['hike-miles-400']).toBe('Uphill Both Ways');
  });
});
