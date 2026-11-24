// The Premium side of the Battle Pass, decided on the server (functions/src/premiumPass.js): who may claim the reward on a tier, what they get,
// and what never happens (a second claim, a claim without the pass, a plan replaced). These run the real logic against a small stand-in for
// Firestore in which transactions run one at a time and commit all at once, as in the real database.
import { claimPremiumReward, makeRewardCode, planLegendGrant } from '../functions/src/premiumPass';
import { xpRequiredForLevel } from '../functions/src/xpRules';
import { PREMIUM_REWARDS } from '../functions/src/premiumRewards';

function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  let queue = Promise.resolve();
  const ref = (path) => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) });
  return {
    docs,
    doc: ref,
    runTransaction: (fn) => {
      const run = queue.then(async () => {
        const writes = [];
        const result = await fn({
          get: async (r) => r.get(),
          set: (r, data, opts) => writes.push([r.path, opts && opts.merge ? { ...docs.get(r.path), ...data } : data]),
        });
        writes.forEach(([path, data]) => docs.set(path, data)); // all or nothing, as a transaction commits
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

const DAY = 86400000;
const NOW = new Date('2026-11-23T15:00:00.000Z');
const STAMP = NOW.toISOString();
const LEDGER = 'users/alice/stats/xp';
const PASS = 'users/alice/data/premiumPass';
const WALLET = 'users/alice/data/premiumRewards';
const PLAN = 'entitlements/alice';
const CODE_TAIL = '[A-HJKMNP-Z2-9]{8}';

const passOn = { active: true, expiresAt: null, source: 'manual' };
const at = (level) => ({ [LEDGER]: { total: xpRequiredForLevel(level) } });
const world = (level = 100, extra = {}) => ({ ...at(level), [PASS]: passOn, ...extra });
const claim = (db, tier, over = {}) => claimPremiumReward({ db, uid: 'alice', tier, now: NOW, ...over });
const wallet = (db) => db.docs.get(WALLET);
const snapshot = (db) => JSON.stringify([...db.docs.entries()]);

describe('a tier that has no Premium reward', () => {
  it('is turned away as invalid, and nothing is read or changed', async () => {
    const db = makeDb(world());
    const before = snapshot(db);
    for (const tier of [0, 1, 7, 99, 105, -5, 5.5, '5', null, undefined, NaN]) {
      expect(await claim(db, tier)).toEqual({ status: 'invalid' });
    }
    expect(snapshot(db)).toBe(before);
  });
});

describe('the Premium Pass', () => {
  it('is needed: without a pass document nothing is given', async () => {
    const db = makeDb(at(100));
    const before = snapshot(db);
    expect(await claim(db, 5)).toEqual({ status: 'needs-pass' });
    expect(snapshot(db)).toBe(before);
  });

  it('is needed to say active: true', async () => {
    for (const pass of [{ active: false }, { active: 'true' }, { expiresAt: null }, {}]) {
      const db = makeDb({ ...at(100), [PASS]: pass });
      expect((await claim(db, 5)).status).toBe('needs-pass');
      expect(wallet(db)).toBeUndefined();
    }
  });

  it('has run out when its end date has passed, so nothing is given', async () => {
    const db = makeDb({ ...at(100), [PASS]: { active: true, expiresAt: new Date(NOW.getTime() - DAY).toISOString() } });
    expect((await claim(db, 5)).status).toBe('needs-pass');
    expect(wallet(db)).toBeUndefined();
  });

  it('still works before its end date, and with an end date typed in as a Firestore timestamp', async () => {
    const soon = NOW.getTime() + DAY;
    const a = makeDb({ ...at(100), [PASS]: { active: true, expiresAt: new Date(soon).toISOString() } });
    expect((await claim(a, 5)).status).toBe('claimed');
    const b = makeDb({ ...at(100), [PASS]: { active: true, expiresAt: { toMillis: () => soon } } });
    expect((await claim(b, 5)).status).toBe('claimed');
  });

  it('is checked for the person who asks, not for anyone else', async () => {
    const db = makeDb({ ...at(100), 'users/bob/data/premiumPass': passOn });
    expect((await claim(db, 5)).status).toBe('needs-pass');
    expect(db.docs.get('users/bob/data/premiumRewards')).toBeUndefined();
  });
});

describe('the level', () => {
  it('has to have reached the tier, in the XP ledger the server holds', async () => {
    const db = makeDb(world(19));
    expect(await claim(db, 20)).toEqual({ status: 'locked', level: 19 });
    expect(wallet(db)).toBeUndefined();
  });

  it('opens at exactly the tier', async () => {
    const db = makeDb(world(20));
    expect((await claim(db, 20)).status).toBe('claimed');
    expect((await claim(db, 25)).status).toBe('locked');
  });

  it('is level 1 for a person with no ledger, so nothing is given', async () => {
    const db = makeDb({ [PASS]: passOn });
    expect(await claim(db, 5)).toEqual({ status: 'locked', level: 1 });
  });

  it('does not trust a claim that says what the level is: only the ledger counts', async () => {
    const db = makeDb(world(3));
    expect((await claim(db, 5, { level: 100 })).status).toBe('locked');
  });
});

describe('bonus AI messages and free body scans', () => {
  it('are added to the wallet, and the claim is recorded with the time', async () => {
    const db = makeDb(world());
    const r = await claim(db, 5);
    expect(r).toEqual({ status: 'claimed', claim: { at: STAMP, kind: 'aiMessages', amount: 25 }, aiMessages: 25, scanCredits: 0 });
    expect(wallet(db)).toEqual({ claims: { 5: { at: STAMP, kind: 'aiMessages', amount: 25 } }, aiMessages: 25, scanCredits: 0, updatedAt: STAMP });
  });

  it('go on top of what is already there', async () => {
    const db = makeDb(world(100, { [WALLET]: { claims: {}, aiMessages: 10, scanCredits: 2 } }));
    const r = await claim(db, 30);
    expect(r).toMatchObject({ status: 'claimed', aiMessages: 60, scanCredits: 2 });
    const s = await claim(db, 15);
    expect(s).toMatchObject({ status: 'claimed', aiMessages: 60, scanCredits: 3 });
  });

  it('read a damaged count as nothing rather than failing or going negative', async () => {
    const db = makeDb(world(100, { [WALLET]: { claims: {}, aiMessages: -40, scanCredits: 'lots' } }));
    expect(await claim(db, 5)).toMatchObject({ aiMessages: 25, scanCredits: 0 });
  });

  it('give one free scan on tiers 15, 45 and 80', async () => {
    const db = makeDb(world());
    for (const tier of [15, 45, 80]) await claim(db, tier);
    expect(wallet(db).scanCredits).toBe(3);
  });

  it('give 400 bonus messages across the five tiers that have them', async () => {
    const db = makeDb(world());
    for (const tier of [5, 30, 55, 70, 95]) await claim(db, tier);
    expect(wallet(db).aiMessages).toBe(400);
  });
});

describe('a tier is claimed once', () => {
  it('says so the second time, shows the first claim, and gives nothing more', async () => {
    const db = makeDb(world());
    const first = await claim(db, 5);
    const second = await claim(db, 5, { now: new Date(NOW.getTime() + DAY) });
    expect(second).toEqual({ status: 'already', claim: first.claim });
    expect(wallet(db).aiMessages).toBe(25);
  });

  it('is still claimed after the pass runs out, and says already rather than needs-pass', async () => {
    const db = makeDb(world());
    await claim(db, 5);
    db.docs.set(PASS, { active: false });
    expect((await claim(db, 5)).status).toBe('already');
  });

  it('gives only once when two requests arrive at the same moment', async () => {
    const db = makeDb(world());
    const results = await Promise.all([claim(db, 5), claim(db, 5), claim(db, 5)]);
    expect(results.map((r) => r.status).sort()).toEqual(['already', 'already', 'claimed']);
    expect(wallet(db).aiMessages).toBe(25);
  });

  it('keeps the claims on other tiers when one more is made', async () => {
    const db = makeDb(world());
    await claim(db, 5);
    await claim(db, 10);
    expect(Object.keys(wallet(db).claims).sort()).toEqual(['10', '5']);
    expect(wallet(db).aiMessages).toBe(25);
  });

  it('does not touch another person', async () => {
    const db = makeDb({ ...world(), 'users/bob/data/premiumRewards': { claims: {}, aiMessages: 7 } });
    await claim(db, 5);
    expect(db.docs.get('users/bob/data/premiumRewards')).toEqual({ claims: {}, aiMessages: 7 });
  });
});

describe('the single-use codes', () => {
  it('are made for a discount: Z, the percent, a dash and eight letters and digits', async () => {
    const db = makeDb(world());
    const r = await claim(db, 10);
    expect(r.status).toBe('claimed');
    expect(r.claim.code).toMatch(new RegExp(`^Z10-${CODE_TAIL}$`));
    expect(r.claim).toEqual({ at: STAMP, kind: 'discount', percent: 10, code: r.claim.code });
    expect(wallet(db).claims[10]).toEqual(r.claim);
  });

  it('are kept where the shop can check them, with whose they are and that they are not used yet', async () => {
    const db = makeDb(world());
    const r = await claim(db, 50);
    expect(db.docs.get(`rewardCodes/${r.claim.code}`)).toEqual({ uid: 'alice', tier: 50, kind: 'discount', percent: 20, createdAt: STAMP, redeemed: false });
  });

  it('are made for free shipping, a colorway and the free shirt, each with its own start', async () => {
    const db = makeDb(world());
    const ship = await claim(db, 20);
    const color = await claim(db, 60);
    const shirt = await claim(db, 75);
    expect(ship.claim.code).toMatch(new RegExp(`^ZSHIP-${CODE_TAIL}$`));
    expect(ship.claim).not.toHaveProperty('percent');
    expect(color.claim.code).toMatch(new RegExp(`^ZCOLOR-${CODE_TAIL}$`));
    expect(color.claim.number).toBe(2);
    expect(shirt.claim.code).toMatch(new RegExp(`^ZSHIRT-${CODE_TAIL}$`));
    expect(db.docs.get(`rewardCodes/${color.claim.code}`)).toMatchObject({ kind: 'colorway', number: 2, redeemed: false });
    expect(db.docs.get(`rewardCodes/${shirt.claim.code}`)).not.toHaveProperty('percent');
  });

  it('are different every time: 20 people claiming the same reward get 20 codes', async () => {
    const seed = {};
    for (let i = 0; i < 20; i += 1) Object.assign(seed, { [`users/u${i}/stats/xp`]: { total: xpRequiredForLevel(50) }, [`users/u${i}/data/premiumPass`]: passOn });
    const db = makeDb(seed);
    const codes = [];
    for (let i = 0; i < 20; i += 1) codes.push((await claimPremiumReward({ db, uid: `u${i}`, tier: 10, now: NOW })).claim.code);
    expect(new Set(codes).size).toBe(20);
  });

  it('are made again when one is taken already, and give up rather than hand out a duplicate', async () => {
    let calls = 0;
    const random = () => { calls += 1; return calls <= 8 ? 0 : 1; };
    const taken = makeDb(world(100, { 'rewardCodes/Z10-AAAAAAAA': { uid: 'someone', redeemed: true } }));
    const r = await claim(taken, 10, { random });
    expect(r.claim.code).toBe('Z10-BBBBBBBB');
    expect(taken.docs.get('rewardCodes/Z10-AAAAAAAA')).toEqual({ uid: 'someone', redeemed: true });

    const stuck = makeDb(world(100, { 'rewardCodes/Z10-AAAAAAAA': { uid: 'someone' } }));
    await expect(claim(stuck, 10, { random: () => 0 })).rejects.toThrow(/code/);
    expect(wallet(stuck)).toBeUndefined();
    expect(stuck.docs.get('rewardCodes/Z10-AAAAAAAA')).toEqual({ uid: 'someone' });
  });

  it('are never made for a reward that gives no code', async () => {
    const db = makeDb(world());
    await claim(db, 5);
    await claim(db, 15);
    await claim(db, 25);
    expect([...db.docs.keys()].filter((k) => k.startsWith('rewardCodes/'))).toEqual([]);
  });
});

describe('makeRewardCode', () => {
  it('starts by what the code is for', () => {
    const lead = (tier) => makeRewardCode(PREMIUM_REWARDS.find((r) => r.tier === tier), () => 0).split('-')[0];
    expect([lead(10), lead(35), lead(90)]).toEqual(['Z10', 'Z15', 'Z30']);
    expect([lead(20), lead(40), lead(75)]).toEqual(['ZSHIP', 'ZCOLOR', 'ZSHIRT']);
  });

  it('takes one random number for each of the eight characters, from 31 letters and digits with no I, L, O, 0 or 1', () => {
    const asked = [];
    const code = makeRewardCode(PREMIUM_REWARDS[1], (n) => { asked.push(n); return asked.length - 1; });
    expect(asked).toEqual(Array(8).fill(31));
    expect(code).toBe('Z10-ABCDEFGH');
    for (let i = 0; i < 300; i += 1) expect(makeRewardCode(PREMIUM_REWARDS[1])).toMatch(new RegExp(`^Z10-${CODE_TAIL}$`));
  });
});

describe('days of Legend', () => {
  const free = { tier: 'free', status: 'active', expiresAt: null };

  it('start a Legend plan for a person on Free, ending that many days from the claim', async () => {
    for (const plan of [undefined, free, { tier: 'pro', status: 'expired', expiresAt: null }, { tier: 'pro', status: 'active', expiresAt: '2026-11-01T00:00:00.000Z' }]) {
      const db = makeDb(world(100, plan ? { [PLAN]: plan } : {}));
      const r = await claim(db, 25);
      const until = new Date(NOW.getTime() + 7 * DAY).toISOString();
      expect(r).toMatchObject({ status: 'claimed', claim: { kind: 'legendTrial', days: 7, until } });
      expect(db.docs.get(PLAN)).toEqual({ tier: 'legend', status: 'trialing', expiresAt: until, source: 'battlepass', updatedAt: STAMP });
      expect(wallet(db).claims[25]).toEqual({ at: STAMP, kind: 'legendTrial', days: 7, until });
    }
  });

  it('are 30 on tier 100', async () => {
    const db = makeDb(world());
    const r = await claim(db, 100);
    expect(r.claim.days).toBe(30);
    expect(db.docs.get(PLAN).expiresAt).toBe(new Date(NOW.getTime() + 30 * DAY).toISOString());
  });

  it('are put on the end of a Battle Pass trial that is still running', async () => {
    const ends = new Date(NOW.getTime() + 3 * DAY).toISOString();
    const db = makeDb(world(100, { [PLAN]: { tier: 'legend', status: 'trialing', expiresAt: ends, source: 'battlepass' } }));
    const r = await claim(db, 25);
    const longer = new Date(NOW.getTime() + 10 * DAY).toISOString();
    expect(r.claim.until).toBe(longer);
    expect(db.docs.get(PLAN)).toMatchObject({ tier: 'legend', expiresAt: longer, source: 'battlepass' });
  });

  it('start again from today when the last Battle Pass trial has ended', async () => {
    const old = new Date(NOW.getTime() - 5 * DAY).toISOString();
    const db = makeDb(world(100, { [PLAN]: { tier: 'legend', status: 'trialing', expiresAt: old, source: 'battlepass' } }));
    expect((await claim(db, 25)).claim.until).toBe(new Date(NOW.getTime() + 7 * DAY).toISOString());
  });

  it('never replace a plan that was bought, given by hand, or earned with a friend: the tier stays to claim', async () => {
    const later = new Date(NOW.getTime() + 20 * DAY).toISOString();
    const plans = [
      { tier: 'pro', status: 'active', expiresAt: null, source: 'revenuecat' },
      { tier: 'legend', status: 'active', expiresAt: null, source: 'manual' },
      { tier: 'pro', status: 'trialing', expiresAt: later, source: 'referral' },
      { tier: 'legend', status: 'active', expiresAt: later },
      { tier: 'pro', status: 'cancelled', expiresAt: later, source: 'revenuecat' }, // cancelled, but paid for until then
    ];
    for (const plan of plans) {
      const db = makeDb(world(100, { [PLAN]: plan }));
      const before = snapshot(db);
      const r = await claim(db, 25);
      expect(r).toEqual({ status: 'has-plan', tier: plan.tier });
      expect(snapshot(db)).toBe(before);
    }
  });

  it('can be claimed later, once the plan that was in the way has ended', async () => {
    const db = makeDb(world(100, { [PLAN]: { tier: 'pro', status: 'active', expiresAt: null, source: 'revenuecat' } }));
    expect((await claim(db, 25)).status).toBe('has-plan');
    db.docs.set(PLAN, { tier: 'pro', status: 'expired', expiresAt: null, source: 'revenuecat' });
    expect((await claim(db, 25)).status).toBe('claimed');
    expect(db.docs.get(PLAN).source).toBe('battlepass');
  });

  it('are not looked up for a reward that is not Legend, so other rewards claim on any plan', async () => {
    const db = makeDb(world(100, { [PLAN]: { tier: 'legend', status: 'active', expiresAt: null, source: 'revenuecat' } }));
    expect((await claim(db, 5)).status).toBe('claimed');
    expect(db.docs.get(PLAN).source).toBe('revenuecat');
  });
});

describe('planLegendGrant', () => {
  it('gives nothing for days that are not a number above zero', () => {
    [0, -3, NaN, undefined, null, '7'].forEach((days) => expect(planLegendGrant({ raw: null, days, now: NOW })).toBeNull());
  });

  it('starts a plan from now for a person with none', () => {
    expect(planLegendGrant({ raw: null, days: 7, now: NOW })).toEqual({
      tier: 'legend', status: 'trialing', expiresAt: new Date(NOW.getTime() + 7 * DAY).toISOString(), source: 'battlepass', updatedAt: STAMP,
    });
  });
});
