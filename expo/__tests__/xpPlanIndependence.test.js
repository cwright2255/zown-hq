// XP is the same for everyone. A person on the Free plan, on Pro, on Legend, or holding the Premium Pass earns XP at the same rate at the
// same level: the multiplier (levelMultiplier in lib/xpRules.js) is worked out from the level alone, and nothing that is bought or given
// can raise it. Nobody can pay to level faster.
//
// This file is the guard on that. If one of these fails, a plan or the Premium Pass has found its way into the XP rules, the ledger or the
// multiplier. Take the plan check back out; do not change the test to let it through.
//
// Three kinds of check, because each catches what the others cannot:
//   - behaviour: the same claims, filed by people on every plan, give exactly the same ledger, and no plan document is read to get there;
//   - arity and wording: the multiplier functions take the level and nothing else, and no plan perk or Premium reward talks about XP;
//   - source: the XP files do not import anything about plans, and do not name the things that read one.
import { emptyLedger, levelMultiplier, dailyCap, xpRequiredForLevel, LEVEL_CAP } from '../lib/xpRules';
import { levelUpFacts } from '../lib/levelUp';
import { FEATURES, FEATURE_NAMES, TIERS } from '../lib/entitlements';
import { PREMIUM_KINDS, PREMIUM_REWARDS, premiumBenefits } from '../lib/premiumRewards';
import { handleClaim } from '../functions/src/xpLedger';

const fs = require('fs');
const path = require('path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
// The file's code without its comments, so a comment that explains why plans are kept out cannot trip the check that keeps them out.
const code = (relative) => read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');

// ---- behaviour ---------------------------------------------------------------------------------------------------------------

const NOW = Date.UTC(2026, 9, 19, 15, 0, 0);
const TODAY = '2026-10-19';
const STAMP = '2026-10-19T15:00:00.000Z';
const LEDGER = 'users/alice/stats/xp';
const claimPath = (id) => `users/alice/xpClaims/${id}`;

// Where a plan or the Premium Pass would be kept. Nothing about XP may read any of them.
const PLAN_PATHS = /^entitlements\/|\/data\/premiumPass$|\/data\/premiumRewards$|^rewardCodes\//;

// A small in-memory Firestore (the pieces xpLedger.js uses) that also writes down every document it is asked for.
function makeDb(seed) {
  const docs = new Map(Object.entries(seed).map(([p, data]) => [p, JSON.parse(JSON.stringify(data))]));
  const reads = [];
  const snap = (p) => {
    reads.push(p);
    return { exists: docs.has(p), data: () => (docs.has(p) ? JSON.parse(JSON.stringify(docs.get(p))) : undefined) };
  };
  return {
    docs,
    reads,
    doc: (p) => ({
      path: p,
      get: async () => snap(p),
      set: async (data, options) => {
        const next = options && options.mergeFields ? { ...(docs.get(p) || {}) } : {};
        const fields = options && options.mergeFields ? options.mergeFields : Object.keys(data);
        fields.forEach((f) => { next[f] = data[f]; });
        docs.set(p, next);
      },
    }),
    runTransaction: async (fn) => {
      const writes = [];
      const tx = {
        get: async (ref) => snap(ref.path),
        set: (ref, data) => writes.push(() => docs.set(ref.path, JSON.parse(JSON.stringify(data)))),
        update: (ref, data) => writes.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...data })),
      };
      const result = await fn(tx);
      writes.forEach((write) => write());
      return result;
    },
  };
}

const PASS = { active: true, expiresAt: null, source: 'manual' };
const plan = (tier) => ({ 'entitlements/alice': { tier, status: 'active', expiresAt: null } });
const PEOPLE = {
  'Free': {},
  'Pro': plan('pro'),
  'Legend': plan('legend'),
  'Free with the Premium Pass': { 'users/alice/data/premiumPass': PASS },
  'Legend with the Premium Pass': { ...plan('legend'), 'users/alice/data/premiumPass': PASS },
};

const CLAIMS = [
  { kind: 'workout', day: TODAY, baseExp: 200 },
  { kind: 'run', day: TODAY, activity: 'run', distanceKm: 6.3, durationSec: 2000 },
  { kind: 'meal', day: TODAY, baseExp: 55, foodKey: 'rice' },
];

// Files every claim, one after another, as the XP trigger does, for someone whose level is 40.
async function fileAll(seed, claims = CLAIMS, ledgerExtras = {}) {
  const ledger = { ...emptyLedger(), ...ledgerExtras, total: xpRequiredForLevel(40), level: 40 };
  const db = makeDb({ ...seed, [LEDGER]: ledger, ...Object.fromEntries(claims.map((c, i) => [claimPath(`c${i}`), c])) });
  for (let i = 0; i < claims.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await handleClaim({ db, uid: 'alice', claimId: `c${i}`, now: NOW, stamp: STAMP });
  }
  return { ledger: db.docs.get(LEDGER), board: db.docs.get('leaderboard/alice'), reads: db.reads };
}

describe('XP is the same on every plan', () => {
  it('files the same claims into the same ledger and leaderboard entry, whatever the person has', async () => {
    const results = {};
    for (const [name, seed] of Object.entries(PEOPLE)) {
      // eslint-disable-next-line no-await-in-loop
      results[name] = await fileAll(seed);
    }
    const free = results.Free;
    // Not an empty comparison: the claims really were applied, on top of a level-40 ledger.
    expect(free.ledger.ids).toEqual(['c0', 'c1', 'c2']);
    expect(free.ledger.total).toBeGreaterThan(xpRequiredForLevel(40));
    expect(free.board.xp).toBe(free.ledger.total);
    Object.entries(results).forEach(([name, result]) => {
      expect({ name, ledger: result.ledger }).toEqual({ name, ledger: free.ledger });
      expect({ name, board: result.board }).toEqual({ name, board: free.board });
    });
  });

  it('never reads a plan or a Premium Pass to do it', async () => {
    const { reads } = await fileAll(PEOPLE['Legend with the Premium Pass']);
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.filter((p) => PLAN_PATHS.test(p))).toEqual([]);
  });

  it('ignores a plan, a pass or a multiplier written on the claim or in the ledger', async () => {
    const dressed = { tier: 'legend', plan: 'legend', entitlement: { tier: 'legend' }, premiumPass: true, hasPass: true, multiplier: 5, xpMultiplier: 5, level: 100 };
    const clean = await fileAll({});
    const claims = CLAIMS.map((c) => ({ ...c, ...dressed }));
    const withExtras = await fileAll({}, claims, dressed);
    expect(withExtras.ledger.total).toBe(clean.ledger.total);
    expect(withExtras.ledger.level).toBe(clean.ledger.level);
    expect(withExtras.board.xp).toBe(clean.board.xp);
  });
});

describe('the multiplier is a function of the level alone', () => {
  const OTHER_ARGUMENTS = ['free', 'pro', 'legend', { tier: 'legend' }, { premiumPass: true }, true, 5];

  it('takes one thing, the level', () => {
    expect(levelMultiplier).toHaveLength(1);
    expect(dailyCap).toHaveLength(1);
    expect(levelUpFacts).toHaveLength(2); // (level, totalXp)
  });

  // The pop-up shows the multiplier to two decimals.
  const shown = (level) => Math.round(levelMultiplier(level) * 100) / 100;

  it('gives the same answer however many plans or passes it is handed, at every level', () => {
    const different = [];
    for (let level = 1; level <= LEVEL_CAP; level += 1) {
      OTHER_ARGUMENTS.forEach((extra) => {
        if (levelMultiplier(level, extra) !== levelMultiplier(level)) different.push(['levelMultiplier', level, extra]);
        if (dailyCap(level, extra) !== dailyCap(level)) different.push(['dailyCap', level, extra]);
        if (levelUpFacts(level, 1234, extra).multiplier !== shown(level)) different.push(['levelUpFacts', level, extra]);
      });
    }
    expect(different).toEqual([]);
  });

  it('is what the level-up pop-up shows, at every level', () => {
    for (let level = 1; level <= LEVEL_CAP; level += 1) {
      expect(levelUpFacts(level, xpRequiredForLevel(level)).multiplier).toBe(shown(level));
    }
  });
});

// ---- wording -----------------------------------------------------------------------------------------------------------------

const ABOUT_XP = /\bxp\b|multipl|boost|level faster/i;

describe('no perk of any plan or of the Premium Pass is about XP', () => {
  it('has Free, Pro and Legend, and none of their gated features is an XP feature', () => {
    expect(TIERS).toEqual(['free', 'pro', 'legend']);
    expect(Object.keys(FEATURES).filter((k) => ABOUT_XP.test(k))).toEqual([]);
    expect(Object.values(FEATURE_NAMES).filter((n) => ABOUT_XP.test(n))).toEqual([]);
  });

  it('has Premium rewards that are none of them XP, a multiplier or a boost', () => {
    expect(PREMIUM_KINDS.filter((k) => ABOUT_XP.test(k))).toEqual([]);
    expect(PREMIUM_REWARDS.filter((r) => ABOUT_XP.test(`${r.kind} ${r.name} ${r.blurb}`)).map((r) => r.tier)).toEqual([]);
    expect(premiumBenefits().filter((b) => ABOUT_XP.test(b))).toEqual([]);
  });
});

// ---- source ------------------------------------------------------------------------------------------------------------------

// Everything that works out, files or shows XP and the multiplier. (The pop-up component only draws what lib/levelUp.js gives it.)
const XP_FILES = [
  'lib/xpRules.js',
  'functions/src/xpRules.js',
  'lib/xpClaims.js',
  'functions/src/xpLedger.js',
  'store/expStore.js',
  'store/levelUpStore.js',
];
const PLAN_MODULES = /entitlement|premium|rewardsWallet|aiQuota|PaywallGate|revenuecat|purchases|subscription/i;
const PLAN_NAMES = /\b(?:effectiveTier|canUseFeature|tierAtLeast|dailyLimit|featureTier|plainEntitlement|premiumPassActive|useEntitlementStore|usePremiumStore|hasPass|isPro|isLegend|entitlements?|premiumPass)\b/;

const modulesOf = (source) => [...source.matchAll(/(?:\bfrom|\brequire\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('the files that deal in XP know nothing about plans', () => {
  it.each(XP_FILES)('%s imports nothing about a plan, a pass or a purchase', (file) => {
    expect(modulesOf(code(file)).filter((m) => PLAN_MODULES.test(m))).toEqual([]);
  });

  it.each(XP_FILES)('%s names nothing that reads a plan or a pass', (file) => {
    expect(code(file).match(PLAN_NAMES)).toBeNull();
  });

  it('keeps the XP trigger in the functions free of plans and passes', () => {
    const index = code('functions/src/index.js');
    const start = index.indexOf('export const onXpClaim');
    expect(start).toBeGreaterThan(-1);
    const end = index.indexOf('\nexport const ', start + 1);
    expect(index.slice(start, end).match(PLAN_NAMES)).toBeNull();
  });

  it('keeps the Premium reward claim from touching the XP ledger, except to read the level', () => {
    ['functions/src/premiumPass.js', 'functions/src/rewardsWallet.js'].forEach((file) => {
      const source = code(file);
      expect(source).not.toMatch(/\b(?:applyClaim|levelMultiplier|dailyCap|MAX_MULTIPLIER|xpClaims)\b/);
      expect(source).not.toMatch(/\b(?:tx\.(?:set|update)|\.set|\.update)\(\s*ledgerRef\b/);
    });
  });
});
