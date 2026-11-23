// lib/sportIcons.js: the sports icons the badges are made with. Each is one path on a 100 x 100 grid, and each has a name and a kind of sport.
import { ICON_GROUPS, SPORT_ICONS, SPORT_ICON_VIEWBOX, getSportIcon, iconsInGroup } from '../lib/sportIcons';

describe('the icon set', () => {
  it('has 284 icons', () => {
    expect(SPORT_ICONS).toHaveLength(284);
  });

  it('gives each a different id, and a different name', () => {
    expect(new Set(SPORT_ICONS.map((i) => i.id)).size).toBe(SPORT_ICONS.length);
    expect(new Set(SPORT_ICONS.map((i) => i.name)).size).toBe(SPORT_ICONS.length);
  });

  it('numbers the ids from sp001 in order', () => {
    SPORT_ICONS.forEach((icon, i) => expect(icon.id).toBe(`sp${String(i + 1).padStart(3, '0')}`));
  });

  it('names every icon in words', () => {
    SPORT_ICONS.forEach((icon) => {
      expect(typeof icon.name).toBe('string');
      expect(icon.name.trim()).toBe(icon.name);
      expect(icon.name.length).toBeGreaterThan(2);
    });
  });

  it('puts every icon in one of the listed kinds of sport, and uses every kind', () => {
    SPORT_ICONS.forEach((icon) => expect(ICON_GROUPS).toContain(icon.group));
    ICON_GROUPS.forEach((group) => expect(iconsInGroup(group).length).toBeGreaterThan(0));
    expect(new Set(ICON_GROUPS).size).toBe(ICON_GROUPS.length);
  });

  it('draws on a 100 x 100 grid', () => {
    expect(SPORT_ICON_VIEWBOX).toBe(100);
  });
});

describe('each icon\'s path', () => {
  it('is only moves, lines, curves and closes, with plain numbers', () => {
    SPORT_ICONS.forEach((icon) => expect(icon.d).toMatch(/^M[-0-9.\sLCQZM]+Z$/));
  });

  it('starts and ends every shape properly: each move is closed', () => {
    SPORT_ICONS.forEach((icon) => {
      expect(icon.d.split('M').length - 1).toBe(icon.d.split('Z').length - 1);
    });
  });

  it('keeps to the grid: no coordinate is a long way outside it', () => {
    SPORT_ICONS.forEach((icon) => {
      for (const m of icon.d.matchAll(/-?\d+(?:\.\d+)?/g)) {
        const v = Number(m[0]);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(-20);
        expect(v).toBeLessThan(120);
      }
    });
  });

  it('is not a blank: every icon has some drawing in it', () => {
    SPORT_ICONS.forEach((icon) => expect(icon.d.length).toBeGreaterThan(60));
  });

  it('is not the same drawing as another icon', () => {
    expect(new Set(SPORT_ICONS.map((i) => i.d)).size).toBe(SPORT_ICONS.length);
  });
});

describe('getSportIcon and iconsInGroup', () => {
  it('finds an icon by its id', () => {
    const icon = getSportIcon('sp001');
    expect(icon).toBe(SPORT_ICONS[0]);
    expect(getSportIcon(SPORT_ICONS[283].id)).toBe(SPORT_ICONS[283]);
  });

  it('gives null for an id there is no icon for', () => {
    for (const id of ['sp000', 'sp285', '', undefined, null, 'trophy', 42]) expect(getSportIcon(id)).toBeNull();
  });

  it('lists the icons of a kind, and none for a kind there is not', () => {
    const gym = iconsInGroup('gym');
    expect(gym.length).toBeGreaterThan(0);
    gym.forEach((icon) => expect(icon.group).toBe('gym'));
    expect(iconsInGroup('curling')).toEqual([]);
    expect(ICON_GROUPS.reduce((n, g) => n + iconsInGroup(g).length, 0)).toBe(SPORT_ICONS.length);
  });
});
