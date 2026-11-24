// Everything stored under a person's own users/{uid} folder: their profile, devices, settings, recipes, history and so on.
// The rule for all of it is the same: the person it belongs to, and nobody else, not even someone who is signed in.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

// Each row: the path as written in firestore.rules, and one real document at that path that belongs to alice.
const OWNER_ONLY = [
  ['/users/{userId}', 'users/alice'],
  ['/users/{userId}/devices/{deviceId}', 'users/alice/devices/watch-1'],
  ['/users/{userId}/data/{docId}', 'users/alice/data/settings'],
  ['/users/{userId}/recipes/{recipeId}', 'users/alice/recipes/r1'],
  ['/users/{userId}/fastingHistory/{fastId}', 'users/alice/fastingHistory/2026-10-14'],
  ['/users/{userId}/workoutTemplates/{templateId}', 'users/alice/workoutTemplates/t1'],
  ['/users/{userId}/following/{otherUid}', 'users/alice/following/bob'],
];

// History that can be added and removed but never edited, so it cannot be rewritten afterwards.
const ADD_AND_REMOVE_ONLY = [
  ['/users/{userId}/formSessions/{sessionId}', 'users/alice/formSessions/s1'],
  ['/users/{userId}/weightLogs/{logId}', 'users/alice/weightLogs/w1'],
  ['/users/{userId}/challengeJoins/{challengeId}', 'users/alice/challengeJoins/c1'],
  ['/users/{userId}/groupMemberships/{groupId}', 'users/alice/groupMemberships/g1'],
];

const theirs = (docPath) => docPath.replace('users/alice', 'users/bob');

describe.each(OWNER_ONLY)('%s', (rulePath, docPath) => {
  it('lets its owner create, read, change and delete it', async () => {
    const mine = env.as('alice').doc(docPath);
    await ok(mine.set({ n: 1 }));
    await ok(mine.get());
    await ok(mine.update({ n: 2 }));
    await ok(mine.delete());
  });

  it('turns away another signed-in person from reading, changing or deleting it', async () => {
    await env.seed({ [docPath]: { n: 1 } });
    const notBobs = env.as('bob').doc(docPath);
    await no(notBobs.get());
    await no(notBobs.set({ n: 9 }));
    await no(notBobs.update({ n: 9 }));
    await no(notBobs.delete());
  });

  it('does not let one person write into, or read from, another person\'s', async () => {
    await env.seed({ [theirs(docPath)]: { n: 1 } });
    await no(env.as('alice').doc(theirs(docPath)).get());
    await no(env.as('alice').doc(theirs(docPath)).set({ n: 9 }));
  });

  it('turns away a visitor who is not signed in', async () => {
    await env.seed({ [docPath]: { n: 1 } });
    const doc = env.anon().doc(docPath);
    await no(doc.get());
    await no(doc.set({ n: 9 }));
    await no(doc.update({ n: 9 }));
    await no(doc.delete());
  });
});

describe.each(ADD_AND_REMOVE_ONLY)('%s', (rulePath, docPath) => {
  it('lets its owner add, read and delete one, but never change it', async () => {
    const mine = env.as('alice').doc(docPath);
    await ok(mine.set({ n: 1 }));
    await ok(mine.get());
    await no(mine.update({ n: 2 }));
    await no(mine.set({ n: 3 })); // writing over one that is there is a change too
    await ok(mine.delete());
  });

  it('turns away another signed-in person from reading, adding to, or deleting it', async () => {
    await env.seed({ [docPath]: { n: 1 } });
    const notBobs = env.as('bob').doc(docPath);
    await no(notBobs.get());
    await no(notBobs.delete());
    await no(env.as('bob').doc(`${docPath}-by-bob`).set({ n: 1 }));
  });

  it('does not let one person add to another person\'s', async () => {
    await no(env.as('alice').doc(theirs(docPath)).set({ n: 1 }));
  });

  it('turns away a visitor who is not signed in', async () => {
    await env.seed({ [docPath]: { n: 1 } });
    const doc = env.anon().doc(docPath);
    await no(doc.get());
    await no(doc.set({ n: 9 }));
    await no(doc.delete());
  });
});

// A body scan (store/bodyCompositionStore.js). Like the other history above it can be added and removed but never edited, and it is
// private to its owner. It also has a shape: the photos a scan is made from are never kept, so a scan can only hold the numbers the
// app writes, and nothing like a photo, a picture's address or free text can be saved in one.
describe('/users/{userId}/bodyScans/{scanId}', () => {
  const scanPath = 'users/alice/bodyScans/b1';

  // A scan exactly as the app saves it (the fields of scanRecord in store/bodyCompositionStore.js, and the measurements and
  // working figures that services/bodyCompositionService.js returns).
  const measurements = () => ({
    shoulderWidthCm: 44.2,
    waistCircumferenceCm: 82.5,
    hipCircumferenceCm: 98.1,
    profileShotsUsed: 2,
    neckCm: 37.6,
    neckWasEstimated: true,
    _debug: {
      frontRawPixelSpan: 0.812,
      frontScaleClamped: false,
      shoulderBasedScale: 213.4,
      verticalSpanBasedScale: 215.9,
      frontNoseY: 0.131,
      frontAnkleY: 0.943,
      shoulderPixelWidth: 0.207,
      shoulderRatioUsed: 0.259,
      hipWidthCm: 33.1,
      waistWidthCm: 30.4,
      finalClampApplied: false,
      rawShoulderWidthCm: 44.2,
      rawWaistCircumferenceCm: 82.5,
      rawHipCircumferenceCm: 98.1,
    },
  });
  const scan = (over = {}) => ({
    measurements: measurements(),
    bodyFatPercent: 18.4,
    method: 'pose-landmark + Navy circumference formula (Hodgdon-Beckett 1984), neck estimated from shoulder width',
    heightCm: 178,
    weightKg: 80.5,
    age: 34,
    bmi: 25.4,
    gender: 'male',
    createdAt: new Date('2026-10-20T12:00:00Z'),
    createdAtLocal: '2026-10-20T12:00:00.000Z',
    ...over,
  });
  const without = (key) => { const s = scan(); delete s[key]; return s; };
  const withMeasurement = (over) => scan({ measurements: { ...measurements(), ...over } });
  const withDebug = (over) => scan({ measurements: { ...measurements(), _debug: { ...measurements()._debug, ...over } } });

  it('lets its owner add a scan as the app writes it, read it, and delete it, but never change it', async () => {
    const mine = env.as('alice').doc(scanPath);
    await ok(mine.set(scan()));
    await ok(mine.get());
    await no(mine.update({ bodyFatPercent: 10 }));
    await no(mine.set(scan({ bodyFatPercent: 10 }))); // writing over one that is there is a change too
    await ok(mine.delete());
  });

  it('accepts a scan with the optional figures left empty or out', async () => {
    const empty = scan({ bodyFatPercent: null, weightKg: null, age: null, bmi: null, gender: null });
    empty.measurements.neckCm = null;
    await ok(env.as('alice').doc('users/alice/bodyScans/empty').set(empty));
    const bare = { measurements: { shoulderWidthCm: 44, waistCircumferenceCm: 82, hipCircumferenceCm: 98 }, heightCm: 178,
      createdAt: new Date('2026-10-20T12:00:00Z'), createdAtLocal: '2026-10-20T12:00:00.000Z' };
    await ok(env.as('alice').doc('users/alice/bodyScans/bare').set(bare));
  });

  it('refuses a scan that carries a photo, a picture\'s address, landmarks or anything else the app does not save', async () => {
    const extras = {
      photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ',
      photoUrl: 'https://example.com/me.jpg',
      imageBase64: '/9j/4AAQSkZJRgABAQ',
      frontPhoto: 'gs://bucket/users/alice/front.jpg',
      landmarks: [{ x: 0.5, y: 0.1 }],
      notes: 'free text',
    };
    for (const [key, value] of Object.entries(extras)) {
      await no(env.as('alice').doc(`users/alice/bodyScans/${key}`).set(scan({ [key]: value })));
    }
  });

  it('refuses a photo hidden inside the measurements or the working figures', async () => {
    await no(env.as('alice').doc('users/alice/bodyScans/m1').set(withMeasurement({ photo: 'data:image/jpeg;base64,/9j/4AAQ' })));
    await no(env.as('alice').doc('users/alice/bodyScans/m2').set(withMeasurement({ landmarks: [0.1, 0.2] })));
    await no(env.as('alice').doc('users/alice/bodyScans/m3').set(withDebug({ photo: 'data:image/jpeg;base64,/9j/4AAQ' })));
    await no(env.as('alice').doc('users/alice/bodyScans/m4').set(withMeasurement({ waistCircumferenceCm: '/9j/4AAQSkZJRgABAQ' })));
    await no(env.as('alice').doc('users/alice/bodyScans/m5').set(withMeasurement({ neckCm: '/9j/4AAQSkZJRgABAQ' })));
    await no(env.as('alice').doc('users/alice/bodyScans/m6').set(withMeasurement({ profileShotsUsed: 'two' })));
    await no(env.as('alice').doc('users/alice/bodyScans/m7').set(withMeasurement({ neckWasEstimated: 'yes' })));
    await no(env.as('alice').doc('users/alice/bodyScans/d1').set(withDebug({ frontNoseY: '/9j/4AAQSkZJRgABAQ' })));
    await no(env.as('alice').doc('users/alice/bodyScans/d2').set(withDebug({ frontScaleClamped: 'maybe' })));
    await no(env.as('alice').doc('users/alice/bodyScans/d3').set(withMeasurement({ _debug: 'big text' })));
    await no(env.as('alice').doc('users/alice/bodyScans/d4').set(withMeasurement({ _debug: [1, 2, 3] })));
  });

  it('refuses a scan with the measurements missing, or not a set of measurements', async () => {
    await no(env.as('alice').doc('users/alice/bodyScans/a1').set(without('measurements')));
    await no(env.as('alice').doc('users/alice/bodyScans/a2').set(scan({ measurements: 'text' })));
    await no(env.as('alice').doc('users/alice/bodyScans/a3').set(scan({ measurements: [1, 2, 3] })));
    await no(env.as('alice').doc('users/alice/bodyScans/a4').set(scan({ measurements: {} })));
    const noWaist = measurements();
    delete noWaist.waistCircumferenceCm;
    await no(env.as('alice').doc('users/alice/bodyScans/a5').set(scan({ measurements: noWaist })));
  });

  it('refuses a scan with a required field missing', async () => {
    await no(env.as('alice').doc('users/alice/bodyScans/r1').set(without('heightCm')));
    await no(env.as('alice').doc('users/alice/bodyScans/r2').set(without('createdAt')));
    await no(env.as('alice').doc('users/alice/bodyScans/r3').set(without('createdAtLocal')));
  });

  it('refuses a figure of the wrong kind or outside any real body', async () => {
    const refused = [
      scan({ heightCm: '178' }),
      scan({ heightCm: 0 }),
      scan({ heightCm: 301 }),
      scan({ weightKg: '80' }),
      scan({ weightKg: -1 }),
      scan({ weightKg: 701 }),
      scan({ age: '34' }),
      scan({ age: 131 }),
      scan({ bmi: 'high' }),
      scan({ bmi: 301 }),
      scan({ bodyFatPercent: 101 }),
      scan({ bodyFatPercent: -1 }),
      scan({ bodyFatPercent: '18' }),
      withMeasurement({ waistCircumferenceCm: -5 }),
      withMeasurement({ hipCircumferenceCm: 100001 }),
    ];
    for (const [i, bad] of refused.entries()) {
      await no(env.as('alice').doc(`users/alice/bodyScans/f${i}`).set(bad));
    }
  });

  it('refuses text where the app writes a short label, and a long one', async () => {
    await no(env.as('alice').doc('users/alice/bodyScans/t1').set(scan({ method: 'x'.repeat(201) })));
    await no(env.as('alice').doc('users/alice/bodyScans/t2').set(scan({ method: 42 })));
    await no(env.as('alice').doc('users/alice/bodyScans/t3').set(scan({ gender: 'x'.repeat(21) })));
    await no(env.as('alice').doc('users/alice/bodyScans/t4').set(scan({ gender: 1 })));
    await no(env.as('alice').doc('users/alice/bodyScans/t5').set(scan({ createdAtLocal: 'x'.repeat(41) })));
    await no(env.as('alice').doc('users/alice/bodyScans/t6').set(scan({ createdAtLocal: 1 })));
    await no(env.as('alice').doc('users/alice/bodyScans/t7').set(scan({ createdAt: '2026-10-20T12:00:00.000Z' }))); // a time, not text
  });

  it('turns away another signed-in person from reading, adding to, or deleting it', async () => {
    await env.seed({ [scanPath]: scan() });
    const notBobs = env.as('bob').doc(scanPath);
    await no(notBobs.get());
    await no(notBobs.delete());
    await no(env.as('bob').doc('users/alice/bodyScans/by-bob').set(scan()));
    await no(env.as('alice').doc('users/bob/bodyScans/by-alice').set(scan()));
    await no(env.as('bob').collection('users/alice/bodyScans').get());
  });

  it('turns away a visitor who is not signed in', async () => {
    await env.seed({ [scanPath]: scan() });
    const doc = env.anon().doc(scanPath);
    await no(doc.get());
    await no(doc.set(scan()));
    await no(doc.delete());
    await no(env.anon().collection('users/alice/bodyScans').get());
  });
});

describe('/users/{userId}/stats/{docId}', () => {
  const stats = 'users/alice/stats/summary';

  it('can be read by its owner and written by no one, not even the owner', async () => {
    await env.seed({ [stats]: { workouts: 3 } });
    const mine = env.as('alice').doc(stats);
    await ok(mine.get());
    await no(mine.set({ workouts: 99 }));
    await no(mine.update({ workouts: 99 }));
    await no(mine.delete());
    await no(env.as('alice').doc('users/alice/stats/another').set({ workouts: 1 }));
  });

  it('cannot be read by another person or a visitor', async () => {
    await env.seed({ [stats]: { workouts: 3 } });
    await no(env.as('bob').doc(stats).get());
    await no(env.anon().doc(stats).get());
  });

  // The invite record (functions/src/referrals.js) says how many friends joined and how many Pro days were earned: the person can read it and
  // nothing they send can change it, or they could give themselves days or reset the limit on their code.
  it('holds the invite record, which its owner can read and nobody can write', async () => {
    const invite = 'users/alice/stats/invite';
    await env.seed({ [invite]: { code: 'K7P2QX4M', joined: 1, rewarded: 1, daysEarned: 7 } });
    await ok(env.as('alice').doc(invite).get());
    await no(env.as('bob').doc(invite).get());
    for (const db of [env.as('alice'), env.as('bob'), env.anon()]) {
      await no(db.doc(invite).set({ code: 'K7P2QX4M', joined: 0, rewarded: 0, daysEarned: 700 }));
      await no(db.doc(invite).update({ rewarded: 0 }));
      await no(db.doc(invite).delete());
    }
  });
});

// Which achievements and badges are unlocked and which Battle Pass tiers are claimed are written by Cloud Functions only
// (functions/src/unlocks.js), and so are the Premium Pass and the Premium rewards (functions/src/premiumPass.js). The person can read them;
// nothing they send can change them. The other documents in the same folder stay theirs.
describe.each(['achievements', 'badges', 'battlePass', 'premiumPass', 'premiumRewards'])('/users/{userId}/data/%s, written only by the server', (name) => {
  const docPath = `users/alice/data/${name}`;
  const SEEDS = {
    battlePass: { claimedTiers: [1] },
    premiumPass: { active: true, expiresAt: null },
    premiumRewards: { claims: { 5: { kind: 'aiMessages' } }, aiMessages: 25, scanCredits: 0 },
  };
  const seeded = SEEDS[name] || { unlocked: { x: '2026-10-21T12:00:00.000Z' } };

  it('can be read by its owner', async () => {
    await env.seed({ [docPath]: seeded });
    await ok(env.as('alice').doc(docPath).get());
  });

  it('cannot be created, changed, merged into or deleted by its owner', async () => {
    const mine = env.as('alice').doc(docPath);
    await no(mine.set(seeded));
    await no(mine.set(seeded, { merge: true }));
    await env.seed({ [docPath]: seeded });
    await no(mine.set({ claimedTiers: [1, 2, 3, 4, 5], unlocked: { y: 'now' }, active: true, aiMessages: 9999, scanCredits: 99 }));
    await no(mine.set({ claimedTiers: [1, 2, 3, 4, 5], unlocked: { y: 'now' }, active: true, aiMessages: 9999, scanCredits: 99 }, { merge: true }));
    await no(mine.update({ claimedTiers: [1, 2, 3, 4, 5], active: true, aiMessages: 9999 }));
    await no(mine.delete());
  });

  it('cannot be read by another person or a visitor, or written by them', async () => {
    await env.seed({ [docPath]: seeded });
    await no(env.as('bob').doc(docPath).get());
    await no(env.anon().doc(docPath).get());
    await no(env.as('bob').doc(docPath).set(seeded));
    await no(env.anon().doc(docPath).set(seeded));
  });

  it('leaves the owner free to write their other documents in the same folder', async () => {
    await ok(env.as('alice').doc('users/alice/data/settings').set({ n: 1 }));
    await ok(env.as('alice').doc('users/alice/data/hikes').set({ hikes: [] }));
    await ok(env.as('alice').doc(`users/alice/data/${name}s`).set({ n: 1 })); // a name that only starts like it
  });
});

describe('who can list people', () => {
  it('nobody can list every profile, only open their own', async () => {
    await env.seed({ 'users/alice': { name: 'Alice' }, 'users/bob': { name: 'Bob' } });
    await no(env.as('alice').collection('users').get());
    await no(env.anon().collection('users').get());
  });

  it('nobody can list another person\'s folder', async () => {
    await env.seed({ 'users/alice/recipes/r1': { name: 'Soup' } });
    await ok(env.as('alice').collection('users/alice/recipes').get());
    await no(env.as('bob').collection('users/alice/recipes').get());
  });
});
