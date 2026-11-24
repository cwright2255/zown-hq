// store/premiumStore.js: the Premium side of the Battle Pass as the server holds it. The phone follows two documents the server writes (the
// Premium Pass, and what has been claimed with the bonus messages and free scans left) and asks the server to claim; it decides nothing.
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('../services/callProxy', () => ({ callProxy: (...a) => global.__call(...a) }));

import { usePremiumStore } from '../store/premiumStore';

const store = () => usePremiumStore.getState();
const NOW = new Date('2026-11-23T12:00:00.000Z');

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.__call = jest.fn(async () => ({ status: 'claimed' }));
  store().clearServerRewards();
});
afterEach(() => warn.mockRestore());

describe('the Premium Pass', () => {
  it('starts as nothing: no pass', () => {
    expect(store().pass).toBeNull();
    expect(store().hasPass(NOW)).toBe(false);
  });

  it('is what the server document says, and has the pass while it is active', () => {
    store().applyServerPass({ active: true, expiresAt: null, source: 'manual', updatedAt: 'x' });
    expect(store().pass).toEqual({ active: true, expiresAt: null });
    expect(store().hasPass(NOW)).toBe(true);
  });

  it('keeps the end date and stops having the pass once it has passed', () => {
    store().applyServerPass({ active: true, expiresAt: '2026-12-01T00:00:00.000Z' });
    expect(store().pass).toEqual({ active: true, expiresAt: '2026-12-01T00:00:00.000Z' });
    expect(store().hasPass(NOW)).toBe(true);
    expect(store().hasPass(new Date('2026-12-02T00:00:00.000Z'))).toBe(false);
  });

  it('is not the pass unless the document says active: true', () => {
    store().applyServerPass({ active: 'true' });
    expect(store().pass).toEqual({ active: false, expiresAt: null });
    expect(store().hasPass(NOW)).toBe(false);
  });

  it('is gone when the document is gone or is not a document', () => {
    store().applyServerPass({ active: true });
    store().applyServerPass(null);
    expect(store().pass).toBeNull();
    store().applyServerPass({ active: true });
    store().applyServerPass('nope');
    expect(store().pass).toBeNull();
    expect(store().hasPass(NOW)).toBe(false);
  });
});

describe('what has been claimed, and what is left', () => {
  it('starts empty', () => {
    expect(store()).toMatchObject({ claims: {}, aiMessages: 0, scanCredits: 0, claiming: null });
  });

  it('shows the claims by tier, the bonus messages and the free scans from the server document', () => {
    const claims = { 5: { kind: 'aiMessages', amount: 25 }, 10: { kind: 'discount', percent: 10, code: 'Z10-K7P2QX4M' } };
    store().applyServerRewards({ claims, aiMessages: 25, scanCredits: 2, updatedAt: 'x' });
    expect(store().claims).toEqual(claims);
    expect(store().aiMessages).toBe(25);
    expect(store().scanCredits).toBe(2);
  });

  it('replaces everything each time, so a code that is gone from the server is gone from the phone', () => {
    store().applyServerRewards({ claims: { 5: { kind: 'aiMessages', amount: 25 } }, aiMessages: 25, scanCredits: 1 });
    store().applyServerRewards({ claims: {}, aiMessages: 0, scanCredits: 0 });
    expect(store()).toMatchObject({ claims: {}, aiMessages: 0, scanCredits: 0 });
  });

  it('reads damaged counts as nothing, never as negative or fractional', () => {
    store().applyServerRewards({ claims: {}, aiMessages: -3, scanCredits: 'two' });
    expect(store()).toMatchObject({ aiMessages: 0, scanCredits: 0 });
    store().applyServerRewards({ claims: {}, aiMessages: 7.9, scanCredits: NaN });
    expect(store()).toMatchObject({ aiMessages: 7, scanCredits: 0 });
  });

  it('keeps only claims that are a tier number with an object', () => {
    store().applyServerRewards({ claims: { 5: { kind: 'aiMessages' }, tier: { kind: 'x' }, 10: 'nope', 15: null, 20: { kind: 'shipping' } } });
    expect(Object.keys(store().claims).sort()).toEqual(['20', '5']);
  });

  it('is empty when the document is gone or is not one', () => {
    store().applyServerRewards({ claims: { 5: { kind: 'aiMessages' } }, aiMessages: 3, scanCredits: 1 });
    store().applyServerRewards(null);
    expect(store()).toMatchObject({ claims: {}, aiMessages: 0, scanCredits: 0 });
    store().applyServerRewards({ claims: { 5: { kind: 'aiMessages' } } });
    store().applyServerRewards(42);
    expect(store().claims).toEqual({});
  });

  it('is forgotten when the person signs out', () => {
    store().applyServerPass({ active: true });
    store().applyServerRewards({ claims: { 5: { kind: 'aiMessages' } }, aiMessages: 3, scanCredits: 1 });
    store().clearServerRewards();
    expect(store()).toMatchObject({ pass: null, claims: {}, aiMessages: 0, scanCredits: 0, claiming: null });
  });
});

describe('claiming a reward', () => {
  it('asks the server to claim the tier, and says what it said', async () => {
    expect(await store().claimReward(25)).toBe('claimed');
    expect(global.__call).toHaveBeenCalledWith('claimPremiumReward', { tier: 25 });
  });

  it('passes on every answer the server can give for a claim', async () => {
    for (const status of ['claimed', 'already', 'locked', 'needs-pass', 'has-plan']) {
      global.__call = jest.fn(async () => ({ status }));
      // eslint-disable-next-line no-await-in-loop
      expect(await store().claimReward(5)).toBe(status);
    }
  });

  it('does not show the reward as claimed itself: only what the server writes shows', async () => {
    await store().claimReward(5);
    expect(store().claims).toEqual({});
    expect(store().aiMessages).toBe(0);
  });

  it('says failed for an answer it does not know, one that is not an answer, or an error, and warns about the error', async () => {
    for (const answer of [{ status: 'invalid' }, { status: 'whatever' }, {}, null, undefined, 'claimed']) {
      global.__call = jest.fn(async () => answer);
      // eslint-disable-next-line no-await-in-loop
      expect(await store().claimReward(5)).toBe('failed');
    }
    global.__call = jest.fn(async () => { throw new Error('offline'); });
    expect(await store().claimReward(5)).toBe('failed');
    expect(warn).toHaveBeenCalledWith('[premiumStore] claimReward error:', 'offline');
  });

  it('marks the tier as on its way until the server answers, then clears it', async () => {
    let release;
    global.__call = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const pending = store().claimReward(30);
    expect(store().claiming).toBe(30);
    release({ status: 'claimed' });
    await pending;
    expect(store().claiming).toBeNull();
  });

  it('clears the mark when the claim fails too', async () => {
    global.__call = jest.fn(async () => { throw new Error('offline'); });
    await store().claimReward(30);
    expect(store().claiming).toBeNull();
  });

  it('makes a second tap on the same tier wait for the first, and does not ask the server twice', async () => {
    let release;
    global.__call = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const first = store().claimReward(30);
    expect(await store().claimReward(30)).toBe('busy');
    expect(global.__call).toHaveBeenCalledTimes(1);
    release({ status: 'claimed' });
    expect(await first).toBe('claimed');
    expect(store().claiming).toBeNull();
  });
});
