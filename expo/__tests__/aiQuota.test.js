import { tierOf, checkFeature, takeAiQuota, takeDailyCap, giveBackAiQuota, aiRequestPlan, NUTRITION_DAILY_CAP } from '../functions/src/aiQuota';

// A small stand-in for Firestore: documents in a map, doc(path).get(), and runTransaction(fn) with tx.get / tx.set (merge). Transactions
// run one at a time, as in the real database, where a transaction whose document changed under it is run again.
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

const NOW = new Date('2026-10-20T15:00:00.000Z'); // the day is 2026-10-20 in New York
const pro = { tier: 'pro', status: 'active', expiresAt: null };
const legend = { tier: 'legend', status: 'active', expiresAt: null };
const take = (db, kind, over = {}) => takeAiQuota({ db, uid: 'u1', kind, now: NOW, ...over });

describe('tierOf', () => {
  it('is free for a person with no plan document', async () => {
    expect(await tierOf(makeDb(), 'u1', NOW)).toBe('free');
  });

  it('is the plan in their document, and only theirs', async () => {
    const db = makeDb({ 'entitlements/u1': pro, 'entitlements/u2': legend });
    expect(await tierOf(db, 'u1', NOW)).toBe('pro');
    expect(await tierOf(db, 'u2', NOW)).toBe('legend');
    expect(await tierOf(db, 'u3', NOW)).toBe('free');
  });

  it('is free when the plan has ended', async () => {
    const db = makeDb({ 'entitlements/u1': { ...pro, expiresAt: '2026-10-19T00:00:00.000Z' } });
    expect(await tierOf(db, 'u1', NOW)).toBe('free');
  });
});

describe('checkFeature', () => {
  it('turns a free person away from Pro and Legend features, and says what is needed', async () => {
    const db = makeDb();
    expect(await checkFeature({ db, uid: 'u1', feature: 'aiWorkoutPlan', now: NOW })).toEqual({ ok: false, tier: 'free', needs: 'pro' });
    expect(await checkFeature({ db, uid: 'u1', feature: 'bodyScan', now: NOW })).toEqual({ ok: false, tier: 'free', needs: 'legend' });
  });

  it('lets Pro into Pro features and turns it away from Legend ones', async () => {
    const db = makeDb({ 'entitlements/u1': pro });
    expect(await checkFeature({ db, uid: 'u1', feature: 'aiWorkoutPlan', now: NOW })).toEqual({ ok: true, tier: 'pro', needs: 'pro' });
    expect(await checkFeature({ db, uid: 'u1', feature: 'bodyScan', now: NOW })).toEqual({ ok: false, tier: 'pro', needs: 'legend' });
  });

  it('turns a free person away from the meal photo scan and recipe import, and says Pro is needed', async () => {
    for (const feature of ['mealPhotoScan', 'recipeImport']) {
      expect(await checkFeature({ db: makeDb(), uid: 'u1', feature, now: NOW })).toEqual({ ok: false, tier: 'free', needs: 'pro' });
      expect(await checkFeature({ db: makeDb({ 'entitlements/u1': pro }), uid: 'u1', feature, now: NOW })).toEqual({ ok: true, tier: 'pro', needs: 'pro' });
    }
  });

  it('lets Free into nothing that is locked, and still into the daily Today brief, which is not', async () => {
    expect(await checkFeature({ db: makeDb(), uid: 'u1', feature: 'aiWorkoutPlan', now: NOW })).toEqual({ ok: false, tier: 'free', needs: 'pro' });
    expect((await checkFeature({ db: makeDb(), uid: 'u1', feature: 'todayBrief', now: NOW })).ok).toBe(true);
  });

  it('lets Legend into everything', async () => {
    const db = makeDb({ 'entitlements/u1': legend });
    for (const feature of ['aiWorkoutPlan', 'analytics', 'mealPhotoScan', 'recipeImport', 'bodyScan']) {
      expect((await checkFeature({ db, uid: 'u1', feature, now: NOW })).ok).toBe(true);
    }
  });

  it('lets anyone into a feature that is not locked', async () => {
    expect((await checkFeature({ db: makeDb(), uid: 'u1', feature: 'logWorkout', now: NOW })).ok).toBe(true);
  });
});

describe('aiRequestPlan', () => {
  it('counts the daily Today brief with the comments the app asks for by itself, for every plan', () => {
    expect(aiRequestPlan('brief')).toEqual({ bucket: 'insight', feature: null });
  });

  it('counts the Coach\'s notes about a person with those comments too, for every plan', () => {
    expect(aiRequestPlan('memory')).toEqual({ bucket: 'insight', feature: null });
  });

  it('counts recipe import with the other AI helpers, and needs Pro for it', () => {
    expect(aiRequestPlan('recipe')).toEqual({ bucket: 'assist', feature: 'recipeImport' });
  });

  it('counts the meal photo scan with the other AI helpers, and needs Pro for it', () => {
    expect(aiRequestPlan('mealScan')).toEqual({ bucket: 'assist', feature: 'mealPhotoScan' });
  });

  it('counts every other kind where bucketOf says, and needs no feature', () => {
    expect(aiRequestPlan('coach')).toEqual({ bucket: 'coach', feature: null });
    expect(aiRequestPlan('assist')).toEqual({ bucket: 'assist', feature: null });
    expect(aiRequestPlan('insight')).toEqual({ bucket: 'insight', feature: null });
  });

  it('counts a request that says nothing, or something unknown, as the Coach\'s, the strictest, with no feature', () => {
    for (const kind of [undefined, null, '', 'whatever', 'Brief', 'briefs', 'Memory', 'memories', 'Recipe', 'recipes', 'MealScan', 'mealscan', 'meal', 7]) expect(aiRequestPlan(kind)).toEqual({ bucket: 'coach', feature: null });
  });

  it('is taken from the Free allowance of insight comments when a Free person somehow gets as far as the count', async () => {
    const db = makeDb();
    const first = await take(db, aiRequestPlan('brief').bucket);
    expect(first).toMatchObject({ ok: true, bucket: 'insight', limit: 3, used: 1 });
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', insight: 1 });
  });
});

describe('takeAiQuota', () => {
  it('takes one message and says how many have been used and what the limit is', async () => {
    const db = makeDb();
    expect(await take(db, 'coach')).toEqual({ ok: true, used: 1, tier: 'free', bucket: 'coach', limit: 3, day: '2026-10-20' });
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 2 });
  });

  it('records the count for that person and day, with the person and the day on it', async () => {
    const db = makeDb();
    await take(db, 'coach');
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', coach: 1 });
  });

  it('gives a free person 3 Coach messages and refuses the fourth without changing the count', async () => {
    const db = makeDb();
    for (let i = 1; i <= 3; i += 1) expect(await take(db, 'coach')).toMatchObject({ ok: true, used: i });
    const fourth = await take(db, 'coach');
    expect(fourth).toMatchObject({ ok: false, used: 3, limit: 3, tier: 'free', bucket: 'coach' });
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(3);
  });

  it('counts the Coach and the other helpers separately', async () => {
    const db = makeDb();
    for (let i = 0; i < 3; i += 1) await take(db, 'coach');
    expect((await take(db, 'coach')).ok).toBe(false);
    expect(await take(db, 'assist')).toMatchObject({ ok: true, used: 1, bucket: 'assist' });
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', coach: 3, assist: 1 });
  });

  it('counts the comment the Health screen asks for on its own, so it cannot use up the messages a person sends', async () => {
    const db = makeDb();
    for (let i = 1; i <= 3; i += 1) expect(await take(db, 'insight')).toMatchObject({ ok: true, used: i, bucket: 'insight', limit: 3 });
    expect(await take(db, 'insight')).toMatchObject({ ok: false, used: 3 });
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 1 });
    expect(await take(db, 'assist')).toMatchObject({ ok: true, used: 1 });
  });

  it('counts a request that says nothing, or something else, against the Coach', async () => {
    const db = makeDb();
    await take(db, undefined);
    await take(db, 'banana');
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toMatchObject({ coach: 2 });
    expect(db.docs.get('aiUsage/u1_2026-10-20').assist).toBeUndefined();
  });

  it('gives Pro 12 Coach messages and 8 helper uses, and Legend 25 and 15', async () => {
    const proDb = makeDb({ 'entitlements/u1': pro, 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 11, assist: 7, insight: 7 } });
    expect(await take(proDb, 'coach')).toMatchObject({ ok: true, used: 12, limit: 12, tier: 'pro' });
    expect((await take(proDb, 'coach')).ok).toBe(false);
    expect(await take(proDb, 'assist')).toMatchObject({ ok: true, used: 8, limit: 8 });
    expect((await take(proDb, 'assist')).ok).toBe(false);
    expect(await take(proDb, 'insight')).toMatchObject({ ok: true, used: 8, limit: 8 });
    expect((await take(proDb, 'insight')).ok).toBe(false);

    const legendDb = makeDb({ 'entitlements/u1': legend, 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 24, assist: 14, insight: 14 } });
    expect(await take(legendDb, 'coach')).toMatchObject({ ok: true, used: 25, limit: 25, tier: 'legend' });
    expect((await take(legendDb, 'coach')).ok).toBe(false);
    expect(await take(legendDb, 'assist')).toMatchObject({ ok: true, used: 15, limit: 15 });
    expect(await take(legendDb, 'insight')).toMatchObject({ ok: true, used: 15, limit: 15 });
  });

  it('uses the limit of the plan the person has when they ask, so an upgrade takes effect at once', async () => {
    const db = makeDb({ 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 3 } });
    expect((await take(db, 'coach')).ok).toBe(false);
    db.docs.set('entitlements/u1', pro);
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 4, limit: 12 });
  });

  it('falls back to the free limit when the plan has ended', async () => {
    const db = makeDb({ 'entitlements/u1': { ...pro, status: 'expired' }, 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 3 } });
    expect(await take(db, 'coach')).toMatchObject({ ok: false, tier: 'free', limit: 3 });
  });

  it('starts a new count at midnight in New York, and keeps each day\'s count', async () => {
    const db = makeDb();
    const late = new Date('2026-10-20T03:30:00.000Z'); // 11:30 PM on the 19th in New York
    const early = new Date('2026-10-20T04:30:00.000Z'); // 12:30 AM on the 20th
    for (let i = 0; i < 3; i += 1) await take(db, 'coach', { now: late });
    expect((await take(db, 'coach', { now: late })).ok).toBe(false);
    expect(await take(db, 'coach', { now: early })).toMatchObject({ ok: true, used: 1, day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-19').coach).toBe(3);
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(1);
  });

  it('counts each person on their own', async () => {
    const db = makeDb();
    for (let i = 0; i < 3; i += 1) await take(db, 'coach');
    expect((await take(db, 'coach')).ok).toBe(false);
    expect(await take(db, 'coach', { uid: 'u2' })).toMatchObject({ ok: true, used: 1 });
  });

  it('lets exactly the allowance through when many messages arrive at once', async () => {
    const db = makeDb();
    const results = await Promise.all(Array.from({ length: 12 }, () => take(db, 'coach')));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok)).toHaveLength(9);
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(3);
  });

  it('reads a damaged count as zero rather than failing, and never as a negative', async () => {
    for (const bad of ['many', -3, null, NaN, {}]) {
      const db = makeDb({ 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: bad } });
      expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 1 });
    }
    const half = makeDb({ 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 2.9 } });
    expect(await take(half, 'coach')).toMatchObject({ ok: true, used: 3 });
  });

  it('passes a database failure on, so the request fails instead of getting a free message', async () => {
    const db = makeDb();
    db.runTransaction = async () => { throw new Error('unavailable'); };
    await expect(take(db, 'coach')).rejects.toThrow('unavailable');
    const noRead = makeDb();
    noRead.doc = () => ({ get: async () => { throw new Error('read failed'); } });
    await expect(take(noRead, 'coach')).rejects.toThrow('read failed');
  });
});

describe('takeDailyCap', () => {
  const cap = (db, over = {}) => takeDailyCap({ db, uid: 'u1', field: 'nutrition', limit: 3, now: NOW, ...over });

  it('is 5 nutrition targets a day', () => {
    expect(NUTRITION_DAILY_CAP).toBe(5);
  });

  it('takes one and says how many have been used, the limit, the field and the day', async () => {
    const db = makeDb();
    expect(await cap(db)).toEqual({ ok: true, used: 1, field: 'nutrition', limit: 3, day: '2026-10-20' });
    expect(await cap(db)).toEqual({ ok: true, used: 2, field: 'nutrition', limit: 3, day: '2026-10-20' });
  });

  it('records the count in the person\'s day document, with the person and the day on it', async () => {
    const db = makeDb();
    await cap(db);
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', nutrition: 1 });
  });

  it('refuses once the limit is reached, without changing the count', async () => {
    const db = makeDb();
    for (let i = 0; i < 3; i += 1) expect((await cap(db)).ok).toBe(true);
    expect(await cap(db)).toEqual({ ok: false, used: 3, field: 'nutrition', limit: 3, day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-20').nutrition).toBe(3);
  });

  it('does not look at the plan: Free, Pro and Legend get the same limit', async () => {
    for (const plan of [null, pro, legend]) {
      const db = makeDb(plan ? { 'entitlements/u1': plan } : {});
      for (let i = 0; i < 3; i += 1) expect((await cap(db)).ok).toBe(true);
      expect((await cap(db)).ok).toBe(false);
    }
  });

  it('counts beside the Coach\'s messages in the same document without touching them', async () => {
    const db = makeDb();
    await take(db, 'coach');
    await take(db, 'coach');
    await cap(db);
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', coach: 2, nutrition: 1 });
    for (let i = 0; i < 5; i += 1) await cap(db, { limit: 50 });
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(2);
  });

  it('counts each field on its own', async () => {
    const db = makeDb();
    for (let i = 0; i < 3; i += 1) await cap(db);
    expect((await cap(db)).ok).toBe(false);
    expect(await cap(db, { field: 'other' })).toMatchObject({ ok: true, used: 1 });
  });

  it('starts a new count at midnight in New York, and keeps each day\'s count', async () => {
    const db = makeDb();
    const late = new Date('2026-10-20T03:30:00.000Z'); // 11:30 PM on the 19th in New York
    const early = new Date('2026-10-20T04:30:00.000Z'); // 12:30 AM on the 20th
    for (let i = 0; i < 3; i += 1) await cap(db, { now: late });
    expect((await cap(db, { now: late })).ok).toBe(false);
    expect(await cap(db, { now: early })).toMatchObject({ ok: true, used: 1, day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-19').nutrition).toBe(3);
    expect(db.docs.get('aiUsage/u1_2026-10-20').nutrition).toBe(1);
  });

  it('counts each person on their own', async () => {
    const db = makeDb();
    for (let i = 0; i < 3; i += 1) await cap(db);
    expect((await cap(db)).ok).toBe(false);
    expect(await cap(db, { uid: 'u2' })).toMatchObject({ ok: true, used: 1 });
  });

  it('lets exactly the limit through when many requests arrive at once', async () => {
    const db = makeDb();
    const results = await Promise.all(Array.from({ length: 10 }, () => cap(db)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(db.docs.get('aiUsage/u1_2026-10-20').nutrition).toBe(3);
  });

  it('reads a damaged count as zero rather than failing', async () => {
    for (const bad of ['many', -3, null, NaN, {}]) {
      const db = makeDb({ 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', nutrition: bad } });
      expect(await cap(db)).toMatchObject({ ok: true, used: 1 });
    }
  });

  it('passes a database failure on, so the request fails instead of getting a free one', async () => {
    const db = makeDb();
    db.runTransaction = async () => { throw new Error('unavailable'); };
    await expect(cap(db)).rejects.toThrow('unavailable');
  });

  it('can be given back with giveBackAiQuota, using its field as the bucket', async () => {
    const db = makeDb();
    for (let i = 0; i < 3; i += 1) await cap(db);
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'nutrition', day: '2026-10-20' });
    expect(await cap(db)).toMatchObject({ ok: true, used: 3 });
  });
});

describe('giveBackAiQuota', () => {
  it('gives back one message in the bucket it was taken from', async () => {
    const db = makeDb();
    await take(db, 'coach');
    await take(db, 'coach');
    await take(db, 'assist');
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', coach: 1, assist: 1 });
  });

  it('never goes below zero, and does nothing when there is no count', async () => {
    const db = makeDb();
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(db.docs.size).toBe(0);
    await take(db, 'coach');
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(0);
  });

  it('leaves another day\'s count alone', async () => {
    const db = makeDb({ 'aiUsage/u1_2026-10-19': { uid: 'u1', day: '2026-10-19', coach: 3 } });
    await take(db, 'coach');
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-19').coach).toBe(3);
  });

  it('makes room for another message', async () => {
    const db = makeDb();
    for (let i = 0; i < 3; i += 1) await take(db, 'coach');
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 3 });
  });
});

// Bonus AI messages from the Premium Pass (functions/src/rewardsWallet.js): they take the place of a message only once the day's own are used up.
describe('bonus AI messages', () => {
  const WALLET = 'users/u1/data/premiumRewards';
  const USAGE = 'aiUsage/u1_2026-10-20';
  const spent = (extra = {}) => ({ [USAGE]: { uid: 'u1', day: '2026-10-20', coach: 3, ...extra } });
  const bonus = (db) => db.docs.get(WALLET).aiMessages;

  it('are not used while the day still has messages left', async () => {
    const db = makeDb({ [WALLET]: { aiMessages: 5 } });
    const r = await take(db, 'coach');
    expect(r).toMatchObject({ ok: true, used: 1, limit: 3 });
    expect(r.fromBonus).toBeUndefined();
    expect(bonus(db)).toBe(5);
  });

  it('take the place of a message once the day\'s own are used up, and leave the day\'s count where it was', async () => {
    const db = makeDb({ ...spent(), [WALLET]: { aiMessages: 2 } });
    const r = await take(db, 'coach');
    expect(r).toMatchObject({ ok: true, fromBonus: true, used: 3, limit: 3, bucket: 'coach', day: '2026-10-20' });
    expect(bonus(db)).toBe(1);
    expect(db.docs.get(USAGE).coach).toBe(3);
  });

  it('run out one message at a time, and then the request is refused with nothing changed', async () => {
    const db = makeDb({ ...spent(), [WALLET]: { aiMessages: 2 } });
    expect((await take(db, 'coach')).ok).toBe(true);
    expect((await take(db, 'coach')).ok).toBe(true);
    const third = await take(db, 'coach');
    expect(third).toMatchObject({ ok: false, used: 3 });
    expect(bonus(db)).toBe(0);
    expect(db.docs.get(USAGE).coach).toBe(3);
  });

  it('are not there for a person with no rewards document, or one with none left', async () => {
    expect((await take(makeDb(spent()), 'coach')).ok).toBe(false);
    expect((await take(makeDb({ ...spent(), [WALLET]: { claims: {} } }), 'coach')).ok).toBe(false);
    expect((await take(makeDb({ ...spent(), [WALLET]: { aiMessages: 0 } }), 'coach')).ok).toBe(false);
  });

  it('are read as nothing when the number is damaged, so a bad document never gives messages', async () => {
    for (const aiMessages of [-4, 'many', NaN, null, 0.5, {}]) {
      expect((await take(makeDb({ ...spent(), [WALLET]: { aiMessages } }), 'coach')).ok).toBe(false);
    }
  });

  it('cover the other helpers as well, each bucket by its own allowance', async () => {
    const db = makeDb({ [USAGE]: { uid: 'u1', day: '2026-10-20', coach: 0, assist: 3 }, [WALLET]: { aiMessages: 1 } });
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 1 });
    expect(bonus(db)).toBe(1);
    expect(await take(db, 'assist')).toMatchObject({ ok: true, fromBonus: true, bucket: 'assist' });
    expect(bonus(db)).toBe(0);
  });

  it('are the person\'s own: another person\'s bonus messages do not help', async () => {
    const db = makeDb({ ...spent(), 'users/u2/data/premiumRewards': { aiMessages: 50 } });
    expect((await take(db, 'coach')).ok).toBe(false);
    expect(db.docs.get('users/u2/data/premiumRewards').aiMessages).toBe(50);
  });

  it('let exactly as many through as there are when many requests arrive at once', async () => {
    const db = makeDb({ ...spent(), [WALLET]: { aiMessages: 4 } });
    const results = await Promise.all(Array.from({ length: 10 }, () => take(db, 'coach')));
    expect(results.filter((r) => r.ok)).toHaveLength(4);
    expect(bonus(db)).toBe(0);
  });

  it('keep the rest of the rewards document when one is spent', async () => {
    const db = makeDb({ ...spent(), [WALLET]: { claims: { 5: { kind: 'aiMessages', amount: 25 } }, aiMessages: 3, scanCredits: 2 } });
    await take(db, 'coach');
    expect(db.docs.get(WALLET)).toEqual({ claims: { 5: { kind: 'aiMessages', amount: 25 } }, aiMessages: 2, scanCredits: 2 });
  });

  it('go back when the request fails, and the day\'s count is not changed by it', async () => {
    const db = makeDb({ ...spent(), [WALLET]: { aiMessages: 2 } });
    const r = await take(db, 'coach');
    await giveBackAiQuota({ db, uid: 'u1', bucket: r.bucket, day: r.day, fromBonus: r.fromBonus });
    expect(bonus(db)).toBe(2);
    expect(db.docs.get(USAGE).coach).toBe(3);
  });

  it('are not what a message from the day\'s own allowance is given back to', async () => {
    const db = makeDb({ [WALLET]: { aiMessages: 2 } });
    const r = await take(db, 'coach');
    await giveBackAiQuota({ db, uid: 'u1', bucket: r.bucket, day: r.day, fromBonus: r.fromBonus });
    expect(db.docs.get(USAGE).coach).toBe(0);
    expect(bonus(db)).toBe(2);
  });
});
