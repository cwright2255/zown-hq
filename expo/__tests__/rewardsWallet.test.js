// The free body scans and bonus AI messages the Premium Pass gives (functions/src/rewardsWallet.js): spent one at a time, in a transaction, from the
// person's own rewards document.
import { rewardsPath, count, scanCreditsOf, takeScanCredit, giveBackScanCredit, giveBackBonusMessage } from '../functions/src/rewardsWallet';

function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  let queue = Promise.resolve();
  const ref = (path) => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) });
  return {
    docs,
    doc: ref,
    runTransaction: (fn) => {
      const run = queue.then(() => fn({
        get: async (r) => r.get(),
        set: (r, data, opts) => docs.set(r.path, opts && opts.merge ? { ...docs.get(r.path), ...data } : data),
      }));
      queue = run.catch(() => {});
      return run;
    },
  };
}

const PATH = 'users/u1/data/premiumRewards';

describe('rewardsPath', () => {
  it('is the person\'s own rewards document', () => {
    expect(rewardsPath('u1')).toBe(PATH);
    expect(rewardsPath('abc')).toBe('users/abc/data/premiumRewards');
  });
});

describe('count', () => {
  it('is a whole number of at least 0, and nothing else is believed', () => {
    expect([3, 0, 7.9, 1].map(count)).toEqual([3, 0, 7, 1]);
    [-1, NaN, Infinity, '5', null, undefined, {}, true].forEach((v) => expect(count(v)).toBe(0));
  });
});

describe('scanCreditsOf', () => {
  it('is how many free scans the person has left', async () => {
    expect(await scanCreditsOf(makeDb({ [PATH]: { scanCredits: 3 } }), 'u1')).toBe(3);
  });

  it('is 0 with no document, no count, or a damaged one', async () => {
    expect(await scanCreditsOf(makeDb(), 'u1')).toBe(0);
    expect(await scanCreditsOf(makeDb({ [PATH]: { aiMessages: 9 } }), 'u1')).toBe(0);
    expect(await scanCreditsOf(makeDb({ [PATH]: { scanCredits: 'two' } }), 'u1')).toBe(0);
    expect(await scanCreditsOf(makeDb({ [PATH]: { scanCredits: -2 } }), 'u1')).toBe(0);
  });

  it('is the person\'s own count', async () => {
    const db = makeDb({ 'users/u2/data/premiumRewards': { scanCredits: 5 } });
    expect(await scanCreditsOf(db, 'u1')).toBe(0);
  });
});

describe('takeScanCredit', () => {
  it('uses up one and says how many are left', async () => {
    const db = makeDb({ [PATH]: { claims: { 15: { kind: 'scanCredit' } }, scanCredits: 2, aiMessages: 40 } });
    expect(await takeScanCredit({ db, uid: 'u1' })).toEqual({ ok: true, left: 1 });
    expect(db.docs.get(PATH)).toEqual({ claims: { 15: { kind: 'scanCredit' } }, scanCredits: 1, aiMessages: 40 });
  });

  it('refuses when there are none, and changes nothing', async () => {
    const empty = makeDb();
    expect(await takeScanCredit({ db: empty, uid: 'u1' })).toEqual({ ok: false, left: 0 });
    expect(empty.docs.size).toBe(0);
    const zero = makeDb({ [PATH]: { scanCredits: 0 } });
    expect(await takeScanCredit({ db: zero, uid: 'u1' })).toEqual({ ok: false, left: 0 });
    expect(zero.docs.get(PATH)).toEqual({ scanCredits: 0 });
  });

  it('lets exactly as many through as there are when requests arrive at once', async () => {
    const db = makeDb({ [PATH]: { scanCredits: 1 } });
    const results = await Promise.all([takeScanCredit({ db, uid: 'u1' }), takeScanCredit({ db, uid: 'u1' }), takeScanCredit({ db, uid: 'u1' })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(db.docs.get(PATH).scanCredits).toBe(0);
  });

  it('does not take from another person', async () => {
    const db = makeDb({ 'users/u2/data/premiumRewards': { scanCredits: 5 } });
    expect((await takeScanCredit({ db, uid: 'u1' })).ok).toBe(false);
    expect(db.docs.get('users/u2/data/premiumRewards').scanCredits).toBe(5);
  });
});

describe('giving back', () => {
  it('puts a free scan back', async () => {
    const db = makeDb({ [PATH]: { scanCredits: 0, aiMessages: 4 } });
    await giveBackScanCredit({ db, uid: 'u1' });
    expect(db.docs.get(PATH)).toEqual({ scanCredits: 1, aiMessages: 4 });
  });

  it('puts a bonus message back', async () => {
    const db = makeDb({ [PATH]: { scanCredits: 2, aiMessages: 0 } });
    await giveBackBonusMessage({ db, uid: 'u1' });
    expect(db.docs.get(PATH)).toEqual({ scanCredits: 2, aiMessages: 1 });
  });

  it('starts from nothing when the document or the count is missing or damaged', async () => {
    const a = makeDb();
    await giveBackScanCredit({ db: a, uid: 'u1' });
    expect(a.docs.get(PATH)).toEqual({ scanCredits: 1 });
    const b = makeDb({ [PATH]: { aiMessages: 'lots' } });
    await giveBackBonusMessage({ db: b, uid: 'u1' });
    expect(b.docs.get(PATH)).toEqual({ aiMessages: 1 });
  });

  it('is a take and a give back that leave the person as they were', async () => {
    const db = makeDb({ [PATH]: { scanCredits: 2 } });
    await takeScanCredit({ db, uid: 'u1' });
    await giveBackScanCredit({ db, uid: 'u1' });
    expect(await scanCreditsOf(db, 'u1')).toBe(2);
  });
});
