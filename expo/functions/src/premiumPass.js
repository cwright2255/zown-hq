// The Premium side of the Battle Pass, decided on the server: a person with the Premium Pass claims the reward on a tier (every fifth one,
// lib/premiumRewards.js lists them) once their level has reached it, and gets what it is, here and nowhere else.
//
//   users/{uid}/data/premiumPass      the person's Premium Pass: { active: true, expiresAt: ISO text | null, source, updatedAt }. The person can
//                                     read it and nobody can write it from the app (firestore.rules): it is set from the Firebase console now
//                                     and by the function that hears from RevenueCat once purchases are connected.
//   users/{uid}/data/premiumRewards   what they have claimed, and the bonus messages and free scans they have left (rewardsWallet.js). Same rules.
//   rewardCodes/{CODE}                one document for every single-use code handed out: { uid, tier, kind, percent?, number?, createdAt,
//                                     redeemed: false }. No rule names it, so the app cannot touch it; the shop checks a code against it.
//   entitlements/{uid}                a week (or a month) of Legend, written the way a plan is everywhere else (lib/entitlements.js), with the
//                                     source 'battlepass', so every Legend check on the phone and in the other functions works on it.
//
// What stops it being claimed twice or by the wrong person: a tier is claimed once (the second ask says so and gives nothing), the level in the XP
// ledger has to have reached it (the phone can show a level a little ahead of the server's), and the pass has to be active. Nobody's plan is
// replaced: Legend days are only given to a person on Free, or added to a Battle Pass trial they already have. A person who has bought a plan, or
// been given one by hand, claims nothing and loses nothing: the reward stays there for when it can be used.
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.
import { randomInt } from 'node:crypto';
import { effectiveTier, plainEntitlement } from './entitlements.js';
import { CODE_KINDS, isPremiumTier, premiumPassActive, premiumRewardAt } from './premiumRewards.js';
import { count, rewardsPath } from './rewardsWallet.js';
import { LEDGER_DOC } from './unlocks.js';
import { normalizeLedger } from './xpRules.js';

const PASS_DOC = (uid) => `users/${uid}/data/premiumPass`;
const DAY_MS = 86400000;
// No I, L, O, 0 or 1: they are read and typed wrong (the same letters as an invite code).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_TAIL = 8;
const CODE_TRIES = 5;

/** A new single-use code for a reward: what it is for, a dash and eight letters and digits, such as 'Z20-K7P2QX4M'. `random(n)` is a whole number from 0 to n - 1. */
export function makeRewardCode(reward, random = randomInt) {
  const lead = { discount: `Z${reward.percent}`, shipping: 'ZSHIP', colorway: 'ZCOLOR', shirt: 'ZSHIRT' }[reward.kind];
  let tail = '';
  for (let i = 0; i < CODE_TAIL; i += 1) tail += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return `${lead}-${tail}`;
}

/**
 * The plan document that gives `days` of Legend to a person, or null when nothing should change for them.
 * A person on Free gets a Legend plan that ends `days` from now; a person already on a Battle Pass trial has it made longer; a person on any other
 * plan (bought, given by hand, a referral's Pro days) keeps it as it is.
 */
export function planLegendGrant({ raw, days, now = new Date() }) {
  if (!(Number.isFinite(days) && days > 0)) return null;
  const tier = effectiveTier(raw, now);
  const current = plainEntitlement(raw);
  const stamp = now.toISOString();
  if (tier === 'free') {
    return { tier: 'legend', status: 'trialing', expiresAt: new Date(now.getTime() + days * DAY_MS).toISOString(), source: 'battlepass', updatedAt: stamp };
  }
  if (tier === 'legend' && current && current.source === 'battlepass' && current.expiresAt) {
    // A trial that has run out is Free above, so this one ends in the future: the new days go on the end of it.
    const from = Date.parse(current.expiresAt);
    return { tier: 'legend', status: 'trialing', expiresAt: new Date(from + days * DAY_MS).toISOString(), source: 'battlepass', updatedAt: stamp };
  }
  return null;
}

/**
 * Claims the Premium reward on a tier.
 * @returns {Promise<{ status: 'claimed'|'already'|'needs-pass'|'locked'|'has-plan'|'invalid', claim?: object, level?: number, tier?: string }>}
 *   'needs-pass': the person does not have the Premium Pass (nothing is changed)
 *   'locked':     the level in the XP ledger has not reached the tier yet
 *   'has-plan':   a week of Legend that cannot be given because the person's plan is one that must not be replaced (nothing is changed, and the
 *                 tier is still theirs to claim); `tier` is the plan they have
 *   'already':    claimed before; `claim` is what it was
 */
export async function claimPremiumReward({ db, uid, tier, now = new Date(), random = randomInt }) {
  if (!isPremiumTier(tier)) return { status: 'invalid' };
  const reward = premiumRewardAt(tier);
  const stamp = now.toISOString();
  const ledgerRef = db.doc(LEDGER_DOC(uid));
  const passRef = db.doc(PASS_DOC(uid));
  const rewardsRef = db.doc(rewardsPath(uid));
  const planRef = db.doc(`entitlements/${uid}`);

  return db.runTransaction(async (tx) => {
    // Every read comes before any write.
    const ledgerSnap = await tx.get(ledgerRef);
    const passSnap = await tx.get(passRef);
    const rewardsSnap = await tx.get(rewardsRef);
    const planSnap = reward.kind === 'legendTrial' ? await tx.get(planRef) : null;

    const have = (rewardsSnap.exists && rewardsSnap.data()) || {};
    const claims = have.claims && typeof have.claims === 'object' ? have.claims : {};
    if (claims[String(tier)]) return { status: 'already', claim: claims[String(tier)] };
    if (!premiumPassActive(passSnap.exists ? passSnap.data() : null, now)) return { status: 'needs-pass' };
    const level = normalizeLedger(ledgerSnap.exists ? ledgerSnap.data() : null).level;
    if (level < tier) return { status: 'locked', level };

    const claim = { at: stamp, kind: reward.kind };
    const wallet = { aiMessages: count(have.aiMessages), scanCredits: count(have.scanCredits) };
    let plan = null;
    let codeRef = null;

    if (reward.kind === 'aiMessages') {
      wallet.aiMessages += reward.amount;
      claim.amount = reward.amount;
    } else if (reward.kind === 'scanCredit') {
      wallet.scanCredits += reward.amount;
      claim.amount = reward.amount;
    } else if (reward.kind === 'legendTrial') {
      const raw = planSnap && planSnap.exists ? planSnap.data() : null;
      plan = planLegendGrant({ raw, days: reward.days, now });
      if (!plan) return { status: 'has-plan', tier: effectiveTier(raw, now) };
      claim.days = reward.days;
      claim.until = plan.expiresAt;
    } else if (CODE_KINDS.includes(reward.kind)) {
      let code = null;
      for (let i = 0; i < CODE_TRIES && !code; i += 1) {
        const tryCode = makeRewardCode(reward, random);
        const taken = await tx.get(db.doc(`rewardCodes/${tryCode}`));
        if (!taken.exists) code = tryCode;
      }
      if (!code) throw new Error('could not make a code that is not already in use');
      claim.code = code;
      if (reward.percent) claim.percent = reward.percent;
      if (reward.number) claim.number = reward.number;
      codeRef = db.doc(`rewardCodes/${code}`);
    }

    tx.set(rewardsRef, { claims: { ...claims, [String(tier)]: claim }, ...wallet, updatedAt: stamp }, { merge: true });
    if (plan) tx.set(planRef, plan);
    if (codeRef) {
      const record = { uid, tier, kind: reward.kind, createdAt: stamp, redeemed: false };
      if (reward.percent) record.percent = reward.percent;
      if (reward.number) record.number = reward.number;
      tx.set(codeRef, record);
    }
    return { status: 'claimed', claim, aiMessages: wallet.aiMessages, scanCredits: wallet.scanCredits };
  });
}
