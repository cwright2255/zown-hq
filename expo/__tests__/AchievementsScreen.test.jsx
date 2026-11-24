// The Achievements screen (app/profile/achievements.jsx), which Profile > Achievements > View All now opens. Before this build View All
// opened a different page, app/achievements.jsx, that was typed in ("12 / 20 Achievements Unlocked", "2,550 XP Earned") and was
// deleted. The real screen had problems of its own, found when it was first read end to end: it took its XP and level from user
// fields that nothing fills in (so it said 0 XP, level 1), its photo from a field that does not exist, showed only nine badges, and
// made up "Challenge 1" cards at 50%. These look at it with the real stores.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Image, ScrollView, StyleSheet } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
const mockUser = { current: null };
jest.mock('@/store/userStore', () => ({ useUserStore: (sel) => sel({ user: mockUser.current }) }));
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...p) => ({ path: p.join('/') })),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));

import { router as mockRouter } from 'expo-router';
import { useAchievementStore } from '../store/achievementStore';
import { useBadgeStore } from '../store/badgeStore';
import { useExpStore } from '../store/expStore';
import AchievementsScreen from '../app/profile/achievements';
import BadgeMedal from '../components/BadgeMedal';

const ROOT = path.join(__dirname, '..');
const BADGE_COUNT = 15;
const ACHIEVEMENT_COUNT = 300;
const PAGE = 30; // the list shows 30 achievements at a time

let loadXP;
let loadAchievements;
let loadBadges;
const withXp = (totalExp) => {
  const level = useExpStore.getState().calculateLevelFromExp(totalExp);
  const base = useExpStore.getState().expSystem;
  useExpStore.setState({ expSystem: { ...base, totalExp, level } });
  return level;
};
const signIn = (user) => { mockUser.current = user; };
// Opens the list to the end: presses "Show more" until it is gone.
const showAll = (utils) => {
  for (let i = 0; i < ACHIEVEMENT_COUNT && utils.queryByTestId('achievements-show-more'); i++) fireEvent.press(utils.getByTestId('achievements-show-more'));
};

beforeEach(() => {
  jest.clearAllMocks();
  loadXP = jest.fn();
  loadAchievements = jest.fn();
  loadBadges = jest.fn();
  useExpStore.setState({ loadXP });
  useAchievementStore.setState({ loadAchievements });
  useBadgeStore.setState({ loadBadges });
  useAchievementStore.getState().clearServerUnlocks();
  useBadgeStore.getState().initializeDefaultBadges();
  useBadgeStore.getState().clearServerUnlocks();
  withXp(0);
  signIn({ uid: 'u1', name: 'Cj', photoURL: '' });
});

describe('XP and level', () => {
  it('are the ones Profile shows (the XP store), not fields on the user that nothing fills in', () => {
    const level = withXp(2500);
    signIn({ uid: 'u1', name: 'Cj', xp: 27975, level: 12 });
    const utils = render(<AchievementsScreen />);
    expect(utils.getByText('2,500 XP')).toBeTruthy();
    expect(utils.getByText(`Level ${level}`)).toBeTruthy();
    expect(utils.queryByText(/27,975/)).toBeNull();
    expect(utils.queryByText('Level 12')).toBeNull();
  });

  it('start at 0 XP and Level 1 for a new account', () => {
    const utils = render(<AchievementsScreen />);
    expect(utils.getByText('0 XP')).toBeTruthy();
    expect(utils.getByText('Level 1')).toBeTruthy();
  });

  it('are rounded to whole XP', () => {
    withXp(1234.6);
    expect(render(<AchievementsScreen />).getByText('1,235 XP')).toBeTruthy();
  });
});

describe('the ring around the photo', () => {
  // The ring is drawn as two half circles that turn: the first up to 180 degrees, the second for what is past half way.
  const turns = (utils) => utils.UNSAFE_root
    .findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.transform?.[0]?.rotate)
    .map((n) => StyleSheet.flatten(n.props.style).transform[0].rotate);
  const atShare = (share) => {
    const { getExpForLevel } = useExpStore.getState();
    const start = getExpForLevel(3);
    withXp(start + (getExpForLevel(4) - start) * share);
  };

  it('is empty at the start of a level', () => {
    atShare(0);
    expect(turns(render(<AchievementsScreen />))).toEqual(['0deg']);
  });

  it('is half full half way to the next level', () => {
    atShare(0.5);
    expect(turns(render(<AchievementsScreen />))).toEqual(['180deg']);
  });

  it('is three quarters full three quarters of the way', () => {
    atShare(0.75);
    expect(turns(render(<AchievementsScreen />))).toEqual(['180deg', '270deg']);
  });

  it('is a quarter full a quarter of the way', () => {
    atShare(0.25);
    expect(turns(render(<AchievementsScreen />))).toEqual(['90deg']);
  });
});

describe('the photo', () => {
  it('is the profile photo (photoURL), the one Profile shows', () => {
    signIn({ uid: 'u1', name: 'Cj', photoURL: 'https://img/cj.png' });
    const utils = render(<AchievementsScreen />);
    expect(utils.UNSAFE_getAllByType(Image).map((i) => i.props.source.uri)).toEqual(['https://img/cj.png']);
  });

  it('is not taken from an "avatar" field, which nothing fills in', () => {
    signIn({ uid: 'u1', name: 'Cj', avatar: 'https://img/not-this.png' });
    const utils = render(<AchievementsScreen />);
    expect(utils.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(utils.getByText('C')).toBeTruthy();
  });

  it('is the first letter of the name when there is none', () => {
    const utils = render(<AchievementsScreen />);
    expect(utils.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(utils.getByText('C')).toBeTruthy();
  });
});

describe('the badges', () => {
  it('shows every badge, not only the first nine', () => {
    const utils = render(<AchievementsScreen />);
    const names = useBadgeStore.getState().badges.map((b) => b.name);
    expect(names).toHaveLength(BADGE_COUNT);
    // "Fitness Legend" and "Trailblazer" are later than the ninth.
    for (const name of names) expect(utils.getAllByText(name).length).toBeGreaterThan(0);
    expect(utils.getByText('Trailblazer')).toBeTruthy();
  });

  it('shows the ones the server has unlocked in full and the rest faded', () => {
    const faded = (utils) => utils.UNSAFE_root.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.opacity === 0.4);
    const first = render(<AchievementsScreen />);
    expect(faded(first)).toHaveLength(BADGE_COUNT);
    first.unmount();
    useBadgeStore.getState().applyServerUnlocks({ 'badge-1': '2026-10-01T00:00:00Z', 'badge-2': '2026-10-02T00:00:00Z' });
    expect(faded(render(<AchievementsScreen />))).toHaveLength(BADGE_COUNT - 2);
  });
});

describe('the achievements', () => {
  it('lists every one in the catalog with what it asks for, and none that were made up', () => {
    const utils = render(<AchievementsScreen />);
    showAll(utils);
    const { achievements } = useAchievementStore.getState();
    expect(achievements).toHaveLength(ACHIEVEMENT_COUNT);
    // A name can be a badge's too, and two rungs can read alike, so each is found by what it says, at least once.
    for (const a of achievements) {
      expect(utils.getAllByText(a.description).length).toBeGreaterThan(0);
      expect(utils.getAllByText(a.name).length).toBeGreaterThan(0);
    }
    expect(utils.UNSAFE_getAllByType(BadgeMedal.type)).toHaveLength(ACHIEVEMENT_COUNT);
    for (const made of [/Challenge \d/, /Season \d/i, /^\d+%$/, /12 \/ 20/, /Achievements Unlocked/, /2,550/]) {
      expect(utils.queryByText(made)).toBeNull();
    }
  }, 60000);

  it('shows thirty at first, then thirty more each time Show more is pressed, until all 300 are shown', () => {
    const utils = render(<AchievementsScreen />);
    const shown = () => utils.UNSAFE_getAllByType(BadgeMedal.type).length;
    expect(shown()).toBe(PAGE);
    expect(utils.getByText(`Show more (${ACHIEVEMENT_COUNT - PAGE} left)`)).toBeTruthy();
    fireEvent.press(utils.getByTestId('achievements-show-more'));
    expect(shown()).toBe(PAGE * 2);
    expect(utils.getByText(`Show more (${ACHIEVEMENT_COUNT - PAGE * 2} left)`)).toBeTruthy();
    showAll(utils);
    expect(shown()).toBe(ACHIEVEMENT_COUNT);
    expect(utils.queryByTestId('achievements-show-more')).toBeNull();
  });

  it('draws each one\'s own badge, from the frame, metal and icon the catalog gives it', () => {
    const utils = render(<AchievementsScreen />);
    const { achievements } = useAchievementStore.getState();
    const medals = utils.UNSAFE_getAllByType(BadgeMedal.type);
    medals.forEach((m, i) => {
      expect(m.props.frame).toBe(achievements[i].badge.frame);
      expect(m.props.metal).toBe(achievements[i].badge.metal);
      expect(m.props.icon).toBe(achievements[i].badge.icon);
    });
  });

  it('counts the ones the server has unlocked, and says which', () => {
    useAchievementStore.getState().applyServerUnlocks({ 'first-workout': '2026-09-01T00:00:00Z', 'level-5': '2026-10-14T10:00:00Z' });
    const utils = render(<AchievementsScreen />);
    expect(utils.getByText(`2 OF ${ACHIEVEMENT_COUNT} UNLOCKED`)).toBeTruthy();
    expect(utils.getAllByText('Unlocked')).toHaveLength(2);
    expect(utils.getAllByText('Locked')).toHaveLength(PAGE - 2);
    showAll(utils);
    expect(utils.getAllByText('Unlocked')).toHaveLength(2);
    expect(utils.getAllByText('Locked')).toHaveLength(ACHIEVEMENT_COUNT - 2);
  });

  it('puts the unlocked ones first, and fades the badges of the rest', () => {
    useAchievementStore.getState().applyServerUnlocks({ 'xp-5000': '2026-10-01T00:00:00Z' });
    const utils = render(<AchievementsScreen />);
    showAll(utils);
    const { achievements } = useAchievementStore.getState();
    const descriptions = achievements.map((a) => a.description);
    const order = utils.UNSAFE_root.findAll((n) => n.type === 'Text' && descriptions.includes(n.props.children)).map((n) => n.props.children);
    expect(order).toHaveLength(ACHIEVEMENT_COUNT);
    expect(order[0]).toBe(achievements.find((a) => a.id === 'xp-5000').description);
    // The rest stay in the catalog's order.
    expect(order.slice(1)).toEqual(achievements.filter((a) => a.id !== 'xp-5000').map((a) => a.description));
    const dim = utils.UNSAFE_getAllByType(BadgeMedal.type).map((m) => !!m.props.dim);
    expect(dim[0]).toBe(false);
    expect(dim.slice(1).every(Boolean)).toBe(true);
  });

  it('says 0 unlocked, with everything locked, for someone who has unlocked nothing', () => {
    const utils = render(<AchievementsScreen />);
    expect(utils.getByText(`0 OF ${ACHIEVEMENT_COUNT} UNLOCKED`)).toBeTruthy();
    expect(utils.queryAllByText('Unlocked')).toHaveLength(0);
  });
});

describe('tapping an achievement', () => {
  it('opens its own screen, where the description says how to unlock it, for a locked one and an earned one', () => {
    useAchievementStore.getState().applyServerUnlocks({ 'xp-5000': '2026-10-01T00:00:00Z' });
    const utils = render(<AchievementsScreen />);
    const { achievements } = useAchievementStore.getState();
    const locked = achievements.find((a) => !a.unlockedAt);
    expect(utils.getByTestId('achievement-row-xp-5000').props.accessibilityRole).toBe('button');
    fireEvent.press(utils.getByTestId('achievement-row-xp-5000'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/achievement/[id]', params: { id: 'xp-5000' } });
    fireEvent.press(utils.getByTestId(`achievement-row-${locked.id}`));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/achievement/[id]', params: { id: locked.id } });
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
  });

  it('works on the ones that Show more brings in, not only the first thirty', () => {
    const utils = render(<AchievementsScreen />);
    const { achievements } = useAchievementStore.getState();
    const late = achievements[PAGE + 4];
    expect(utils.queryByTestId(`achievement-row-${late.id}`)).toBeNull();
    fireEvent.press(utils.getByTestId('achievements-show-more'));
    fireEvent.press(utils.getByTestId(`achievement-row-${late.id}`));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/achievement/[id]', params: { id: late.id } });
  });

  it('says in its label which one it is and whether it is unlocked', () => {
    useAchievementStore.getState().applyServerUnlocks({ 'xp-5000': '2026-10-01T00:00:00Z' });
    const utils = render(<AchievementsScreen />);
    const { achievements } = useAchievementStore.getState();
    expect(utils.getByLabelText(`${achievements.find((a) => a.id === 'xp-5000').name}, unlocked`)).toBeTruthy();
    expect(utils.getByLabelText(`${achievements.find((a) => !a.unlockedAt).name}, locked`)).toBeTruthy();
  });
});

describe('tapping a badge in the BADGES grid', () => {
  const card = (utils) => utils.queryByTestId('badge-card');
  const first = () => useBadgeStore.getState().badges[0];

  it('makes every badge a button', () => {
    const utils = render(<AchievementsScreen />);
    for (const b of useBadgeStore.getState().badges) {
      expect(utils.getByTestId(`badge-cell-${b.id}`).props.accessibilityRole).toBe('button');
      expect(utils.getByTestId(`badge-cell-${b.id}`).props.accessibilityLabel).toBe(`${b.name}, locked`);
    }
    useBadgeStore.getState().applyServerUnlocks({ 'badge-1': '2026-10-01T00:00:00Z' });
    expect(render(<AchievementsScreen />).getAllByLabelText('First Workout, unlocked')).toHaveLength(1);
  });

  it('opens a card with the badge\'s name, that it is locked and how to unlock it, without leaving the page', () => {
    const utils = render(<AchievementsScreen />);
    expect(card(utils)).toBeNull();
    fireEvent.press(utils.getByTestId(`badge-cell-${first().id}`));
    // An achievement in the list below can say the same thing, so the card is looked at on its own.
    const inCard = within(card(utils));
    expect(inCard.getByText(first().name)).toBeTruthy();
    expect(inCard.getByText('Locked')).toBeTruthy();
    expect(inCard.getByText('HOW TO UNLOCK')).toBeTruthy();
    expect(inCard.getByText(first().description)).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('shows the card of the badge that was tapped, whichever it is', () => {
    const utils = render(<AchievementsScreen />);
    const last = useBadgeStore.getState().badges[BADGE_COUNT - 1];
    expect(last.description).not.toBe(first().description);
    fireEvent.press(utils.getByTestId(`badge-cell-${last.id}`));
    const inCard = within(card(utils));
    expect(inCard.getByText(last.name)).toBeTruthy();
    expect(inCard.getByText(last.description)).toBeTruthy();
    expect(inCard.queryByText(first().description)).toBeNull();
  });

  it('says when an unlocked one was unlocked, and how it was earned', () => {
    useBadgeStore.getState().applyServerUnlocks({ [first().id]: '2026-10-01T15:00:00.000Z' });
    const utils = render(<AchievementsScreen />);
    fireEvent.press(utils.getByTestId(`badge-cell-${first().id}`));
    const inCard = within(card(utils));
    expect(inCard.getByText('Unlocked 10/1/2026')).toBeTruthy();
    expect(inCard.getByText('HOW YOU EARNED IT')).toBeTruthy();
    expect(inCard.queryByText('HOW TO UNLOCK')).toBeNull();
  });

  it('closes with Close and by a tap behind the card, but not by a tap on the card itself', () => {
    const utils = render(<AchievementsScreen />);
    fireEvent.press(utils.getByTestId(`badge-cell-${first().id}`));
    fireEvent.press(utils.getByTestId('badge-card'));
    expect(card(utils)).toBeTruthy();
    fireEvent.press(utils.getByTestId('badge-card-close'));
    expect(card(utils)).toBeNull();
    fireEvent.press(utils.getByTestId(`badge-cell-${first().id}`));
    fireEvent.press(utils.getByTestId('badge-card-backdrop'));
    expect(card(utils)).toBeNull();
  });
});

describe('room for the floating bottom bar', () => {
  // The bar (components/BottomNavigation.jsx) floats about 100 points over the bottom edge, so the end of the list needs at least that
  // much room under it: before this, "Show more" and the last row stopped 48 points above the edge and sat behind the bar.
  const bottomRoom = (utils) => StyleSheet.flatten(utils.UNSAFE_getByType(ScrollView).props.contentContainerStyle).paddingBottom;

  it('is left under the list, so "Show more" and the last row can be scrolled clear of it', () => {
    const utils = render(<AchievementsScreen />);
    expect(bottomRoom(utils)).toBeGreaterThanOrEqual(100);
    expect(utils.getByTestId('achievements-show-more')).toBeTruthy();
  });

  it('is still left when the whole list is open', () => {
    const utils = render(<AchievementsScreen />);
    showAll(utils);
    expect(bottomRoom(utils)).toBeGreaterThanOrEqual(100);
  }, 60000);
});

describe('opening the screen', () => {
  it('asks for this person\'s XP, achievements and badges', () => {
    render(<AchievementsScreen />);
    expect(loadXP).toHaveBeenCalledWith('u1');
    expect(loadAchievements).toHaveBeenCalledWith('u1');
    expect(loadBadges).toHaveBeenCalledWith('u1');
  });

  it('asks for nothing when nobody is signed in', () => {
    signIn(null);
    render(<AchievementsScreen />);
    expect(loadXP).not.toHaveBeenCalled();
    expect(loadAchievements).not.toHaveBeenCalled();
    expect(loadBadges).not.toHaveBeenCalled();
  });

  it('goes back with the arrow', () => {
    const utils = render(<AchievementsScreen />);
    fireEvent.press(utils.getByLabelText('Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});

describe('getting to it', () => {
  const profile = fs.readFileSync(path.join(ROOT, 'app', 'profile.jsx'), 'utf8');

  it('is where View All on Profile goes', () => {
    expect(profile).toContain("router.push('/profile/achievements')");
  });

  it('is the only Achievements page: the typed-in one is gone and nothing sends anyone to it', () => {
    expect(fs.existsSync(path.join(ROOT, 'app', 'achievements.jsx'))).toBe(false);
    expect(profile).not.toMatch(/router\.(push|replace)\(['"]\/achievements['"]\)/);
  });
});
