// What the Premium side of the Battle Pass has given a person that is spent a little at a time: bonus AI messages and free body scans.
// They are kept in the person's rewards document, users/{uid}/data/premiumRewards, which only the functions write (firestore.rules), next to
// the record of what they have claimed (premiumPass.js). This file holds the spending, so aiQuota.js and index.js can use it without
// knowing anything else about the rewards. Firestore is passed in, so it is tested without Firebase.
//
//   { claims: { "25": { at, kind, ... } }, aiMessages: n, scanCredits: n, updatedAt }

/** Where a person's rewards are kept. */
export const rewardsPath = (uid) => `users/${uid}/data/premiumRewards`;

/** A whole number of at least 0: what the document says is only believed when it is one. */
export const count = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** How many free body scans the person has left. */
export async function scanCreditsOf(db, uid) {
  const snap = await db.doc(rewardsPath(uid)).get();
  return snap.exists ? count((snap.data() || {}).scanCredits) : 0;
}

/**
 * Uses up one free body scan, in a transaction so two requests at once cannot both take the last one.
 * Resolves to { ok, left }; when ok is false there was none and nothing was changed.
 */
export async function takeScanCredit({ db, uid }) {
  const ref = db.doc(rewardsPath(uid));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const have = snap.exists ? count((snap.data() || {}).scanCredits) : 0;
    if (have < 1) return { ok: false, left: 0 };
    tx.set(ref, { scanCredits: have - 1 }, { merge: true });
    return { ok: true, left: have - 1 };
  });
}

/** Gives back one free body scan taken by takeScanCredit, for a scan that failed before the person got anything. */
export async function giveBackScanCredit({ db, uid }) {
  const ref = db.doc(rewardsPath(uid));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const have = snap.exists ? count((snap.data() || {}).scanCredits) : 0;
    tx.set(ref, { scanCredits: have + 1 }, { merge: true });
  });
}

/** Gives back one bonus AI message taken by takeAiQuota, for a request that failed before the person got anything. */
export async function giveBackBonusMessage({ db, uid }) {
  const ref = db.doc(rewardsPath(uid));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const have = snap.exists ? count((snap.data() || {}).aiMessages) : 0;
    tx.set(ref, { aiMessages: have + 1 }, { merge: true });
  });
}
