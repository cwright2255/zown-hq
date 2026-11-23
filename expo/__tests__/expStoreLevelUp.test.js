// When the XP store announces a level-up (store/expStore.js _file, store/levelUpStore.js): only for XP the person has just earned, and not for a
// level that is only loaded. jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
jest.mock('../src/config/firebase', () => ({ db: { stand: 'in' }, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useExpStore } from '../store/expStore';
import { announceLevelUp, useLevelUpStore } from '../store/levelUpStore';
import { applyClaim, emptyLedger, xpRequiredForLevel } from '../lib/xpRules';

const NOW = new Date('2026-10-15T01:30:00Z').getTime();
const TODAY = '2026-10-14';
const INITIAL = useExpStore.getState();

const state = () => useExpStore.getState();
const pending = () => useLevelUpStore.getState().pending;
const settle = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

let warn;
beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useExpStore.setState(INITIAL, true);
  useLevelUpStore.setState({ pending: null });
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  doc.mockReset();
  doc.mockImplementation((_db, ...parts) => ({ path: parts.join('/') }));
  setDoc.mockReset();
  setDoc.mockImplementation(async () => undefined);
  getDoc.mockReset();
  getDoc.mockImplementation(async () => ({ exists: () => false }));
});
afterEach(() => { warn.mockRestore(); jest.useRealTimers(); });

const workout = (id, baseExp) => ({ id, type: 'workout', baseExp, multiplier: 1, date: TODAY });
// A run is worth 30 XP a km (lib/xpRules.js), worked out from the distance and time, not from a base.
const run = (id, km) => ({ id, type: 'running', activity: 'run', baseExp: Math.round(km * 30), multiplier: 1, distanceKm: km, durationSec: km * 360, date: TODAY });
const signIn = async (uid = 'u1', options) => { state().beginXpSync(uid, options); await settle(); };

describe('a level crossed by XP just earned', () => {
  it('is announced, with the levels, what earned it and the total XP', async () => {
    await signIn();
    // Level 2 starts at 1,000 XP, and a level-1 award is not multiplied.
    state().addExpActivity(workout('w1', 1000), 'u1');
    expect(state().expSystem.level).toBe(2);
    expect(pending()).toEqual({ from: 1, to: 2, kind: 'workout', totalXp: 1000 });
  });

  it('is announced for a run the same way', async () => {
    await signIn();
    state().addExpActivity(run('r1', 40), 'u1'); // 40 km is 1,200 XP
    expect(state().expSystem.level).toBe(2);
    expect(pending()).toEqual({ from: 1, to: 2, kind: 'run', totalXp: 1200 });
  });

  it('is announced for a meal that tips the person over, with the meal as what earned it', async () => {
    useExpStore.setState({ expSystem: { ...state().expSystem, totalExp: 990, level: 1, expToNextLevel: 10 } });
    await signIn();
    expect(state().expSystem.level).toBe(1);
    state().awardMealXp('egg', { id: 'm1', type: 'meal', baseExp: 22, multiplier: 1, date: TODAY }, 'u1');
    expect(pending()).toMatchObject({ from: 1, to: 2, kind: 'meal' });
  });

  it('is announced once for an award that crosses several levels, from where the person was', async () => {
    await signIn();
    state().addExpActivity(workout('w1', 3000), 'u1');
    expect(state().expSystem.level).toBeGreaterThanOrEqual(3);
    expect(pending()).toMatchObject({ from: 1, to: state().expSystem.level, kind: 'workout' });
  });

  it('is one pop-up when two awards in a row each cross a level', async () => {
    await signIn();
    state().addExpActivity(workout('w1', 1000), 'u1');
    state().addExpActivity(workout('w2', 1200), 'u1');
    expect(state().expSystem.level).toBeGreaterThanOrEqual(3);
    expect(pending()).toMatchObject({ from: 1, to: state().expSystem.level, kind: 'workout' });
  });

  it('is announced again for the next level after the pop-up was dismissed', async () => {
    await signIn();
    state().addExpActivity(workout('w1', 1000), 'u1');
    useLevelUpStore.getState().dismiss();
    expect(pending()).toBeNull();
    state().addExpActivity(workout('w2', 1100), 'u1');
    expect(pending()).toMatchObject({ from: 2, to: 3, kind: 'workout' });
  });
});

describe('XP that does not take the person into a new level', () => {
  it('announces nothing', async () => {
    await signIn();
    state().addExpActivity(workout('w1', 400), 'u1');
    expect(state().expSystem.level).toBe(1);
    expect(pending()).toBeNull();
  });

  it('announces nothing for a claim the rules turn down', async () => {
    await signIn();
    state().addExpActivity(workout('w1', 1000), 'u1');
    useLevelUpStore.getState().dismiss();
    state().addExpActivity(workout('w1', 1000), 'u1'); // the same id again
    expect(pending()).toBeNull();
  });

  it('announces nothing for XP counted on the phone alone, with nobody signed in', () => {
    state().addExpActivity({ type: 'workout', baseExp: 1500, multiplier: 1 });
    expect(state().expSystem.level).toBe(2);
    expect(pending()).toBeNull();
  });
});

describe('a level that is only loaded', () => {
  it('is not announced when the server\'s record arrives', async () => {
    await signIn();
    let ledger = emptyLedger();
    ledger = applyClaim({ ledger, id: 'old-1', claim: { kind: 'workout', day: TODAY, baseExp: 3000 }, now: NOW }).ledger;
    state().applyLedger('u1', ledger);
    expect(state().expSystem.level).toBeGreaterThanOrEqual(3);
    expect(pending()).toBeNull();
  });

  it('is not announced when the XP the phone already had is sent to the server on signing in', async () => {
    useExpStore.setState({ expSystem: { ...state().expSystem, totalExp: xpRequiredForLevel(6) + 10, level: 1 } });
    await signIn('u1', { activeDays: [TODAY] });
    expect(state().expSystem.level).toBeGreaterThanOrEqual(6);
    expect(pending()).toBeNull();
  });

  it('is not announced when another person signs in on the same phone', async () => {
    await signIn('u1');
    state().addExpActivity(workout('w1', 1000), 'u1');
    useLevelUpStore.getState().dismiss();
    await signIn('u2');
    expect(state().expSystem.level).toBe(1);
    expect(pending()).toBeNull();
  });
});

describe('announceLevelUp', () => {
  beforeEach(() => useLevelUpStore.setState({ pending: null }));

  it('keeps nothing for a move that is not a gain, or for nothing at all', () => {
    announceLevelUp({ from: 3, to: 3, kind: 'run', totalXp: 1 });
    announceLevelUp({ from: 4, to: 3, kind: 'run', totalXp: 1 });
    announceLevelUp(null);
    announceLevelUp(undefined);
    expect(pending()).toBeNull();
  });

  it('keeps a gain until it is dismissed', () => {
    announceLevelUp({ from: 3, to: 4, kind: 'run', totalXp: 1234 });
    expect(pending()).toEqual({ from: 3, to: 4, kind: 'run', totalXp: 1234 });
    useLevelUpStore.getState().dismiss();
    expect(pending()).toBeNull();
  });
});
