// lib/premiumRewards.js
//
// The Premium side of the Battle Pass: twenty real-world rewards, one on every fifth tier (5, 10, 15 ... 100), for people who have the
// Premium Pass. The free side keeps its hundred tiers (lib/battlePassTiers.js); this is a second row of rewards on top of it.
//
// This file is used by the app AND by the Cloud Function that hands the rewards out (functions/src/premiumRewards.js is an exact copy:
// a deployed function cannot import from the app, and __tests__/premiumRewardsParity.test.js makes sure the two never differ). So it must
// stay free of imports.
//
// What each kind of reward gives (functions/src/premiumPass.js does it, here nothing is a rule but the list):
//   aiMessages   `amount` bonus AI messages. They are used only when the day's own messages run out, and they do not expire.
//   scanCredit   `amount` free body scans (a scan and its AI insight) on a plan that does not include them.
//   legendTrial  `days` days of the Legend plan, starting when it is claimed. Only for a person on Free (or already on one of these trials):
//                a plan that was bought or given by hand is never replaced, so the reward stays unclaimed until it can be used.
//   discount     one single-use code for `percent` % off a gear order.
//   shipping     one single-use code for free shipping on a gear order.
//   colorway     one single-use code to buy exclusive colorway number `number`.
//   shirt        one single-use code for a free shirt from the sale rack.
// A single-use code is made when the reward is claimed and shown under My Rewards. The shop has to know the code to honour it: every code is
// also kept at rewardCodes/{code} for it to check against.
//
// The Premium Pass itself is a document the person can read and nobody can write from the app: users/{uid}/data/premiumPass,
// { active: true, expiresAt: ISO text | null, source: 'manual' | 'revenuecat' }. It is set from the Firebase console now, and by the function
// that hears from RevenueCat once purchases are connected, the same way plans are (lib/entitlements.js).

export const PREMIUM_TIER_STEP = 5;
export const PREMIUM_KINDS = ['aiMessages', 'scanCredit', 'legendTrial', 'discount', 'shipping', 'colorway', 'shirt'];
/** The kinds that give a single-use code. */
export const CODE_KINDS = ['discount', 'shipping', 'colorway', 'shirt'];

// tier -> what it gives. Small ones most of the way up; the big ones (every 25th tier) are a week of Legend, 20% off, a free shirt and a
// month of Legend.
const SCHEDULE = [
  [5, { kind: 'aiMessages', amount: 25 }],
  [10, { kind: 'discount', percent: 10 }],
  [15, { kind: 'scanCredit', amount: 1 }],
  [20, { kind: 'shipping' }],
  [25, { kind: 'legendTrial', days: 7 }],
  [30, { kind: 'aiMessages', amount: 50 }],
  [35, { kind: 'discount', percent: 15 }],
  [40, { kind: 'colorway', number: 1 }],
  [45, { kind: 'scanCredit', amount: 1 }],
  [50, { kind: 'discount', percent: 20 }],
  [55, { kind: 'aiMessages', amount: 75 }],
  [60, { kind: 'colorway', number: 2 }],
  [65, { kind: 'discount', percent: 25 }],
  [70, { kind: 'aiMessages', amount: 100 }],
  [75, { kind: 'shirt' }],
  [80, { kind: 'scanCredit', amount: 1 }],
  [85, { kind: 'colorway', number: 3 }],
  [90, { kind: 'discount', percent: 30 }],
  [95, { kind: 'aiMessages', amount: 150 }],
  [100, { kind: 'legendTrial', days: 30 }],
];

function nameOf(r) {
  switch (r.kind) {
    case 'aiMessages': return `${r.amount} Bonus AI Messages`;
    case 'scanCredit': return r.amount === 1 ? 'Free Body Scan' : `${r.amount} Free Body Scans`;
    case 'legendTrial': return `${r.days} Days of Legend`;
    case 'discount': return `${r.percent}% Off Gear`;
    case 'shipping': return 'Free Shipping';
    case 'colorway': return `Exclusive Colorway ${r.number}`;
    default: return 'Free Sale Shirt';
  }
}

function blurbOf(r) {
  switch (r.kind) {
    case 'aiMessages': return 'Extra Coach and AI helper messages for the days you use up your own. They never expire.';
    case 'scanCredit': return 'A body scan and its AI insight, even on a plan that does not include them.';
    case 'legendTrial': return `Every Legend feature for ${r.days} days, starting when you claim it.`;
    case 'discount': return `One code for ${r.percent}% off a gear order.`;
    case 'shipping': return 'One code for free shipping on a gear order.';
    case 'colorway': return 'One code to buy a colorway that only Premium Pass holders can get.';
    default: return 'One code for a free shirt from the sale rack.';
  }
}

/** All the Premium rewards, in order: { tier, kind, amount | percent | days | number, name, blurb, big }. `big` is every 25th tier. */
export const PREMIUM_REWARDS = SCHEDULE.map(([tier, spec]) => ({
  tier, ...spec, name: nameOf(spec), blurb: blurbOf(spec), big: tier % 25 === 0,
}));

/** Whether a tier has a Premium reward (every fifth tier, 5 to 100). */
export const isPremiumTier = (tier) => Number.isInteger(tier) && PREMIUM_REWARDS.some((r) => r.tier === tier);

/** The Premium reward on a tier, or null. */
export const premiumRewardAt = (tier) => PREMIUM_REWARDS.find((r) => r.tier === tier) || null;

/** What a kind of code is called on the My Rewards screen. */
export const CODE_LABELS = { discount: 'Discount code', shipping: 'Free shipping code', colorway: 'Colorway code', shirt: 'Free shirt code' };

// A time as milliseconds: ISO text, a Date, a number, or a Firestore Timestamp (typed in by hand in the console, or read by the server).
const millisOf = (v) => {
  if (typeof v === 'string') return Date.parse(v);
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v && typeof v.seconds === 'number') return v.seconds * 1000;
  return Number.NaN;
};

/**
 * Whether the Premium Pass document says the person has the pass right now: it has to say `active: true`, and any end date has to be in the
 * future. A date that cannot be read counts as already passed, so a damaged document never gives the pass.
 */
export function premiumPassActive(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object' || raw.active !== true) return false;
  if (raw.expiresAt == null) return true;
  const ends = millisOf(raw.expiresAt);
  return !Number.isNaN(ends) && ends > now.getTime();
}

/** The lines the Premium Pass card lists, worked out from the rewards above so the card cannot promise what the list does not give. */
export function premiumBenefits() {
  const of = (kind) => PREMIUM_REWARDS.filter((r) => r.kind === kind);
  const percents = of('discount').map((r) => r.percent);
  const days = of('legendTrial').map((r) => r.days);
  const scans = of('scanCredit').reduce((sum, r) => sum + r.amount, 0);
  const messages = of('aiMessages').reduce((sum, r) => sum + r.amount, 0);
  return [
    `${PREMIUM_REWARDS.length} rewards, one every ${PREMIUM_TIER_STEP} levels`,
    `Up to ${Math.max(...percents)}% off gear, and free shipping`,
    'A free shirt from the sale rack',
    `${of('colorway').length} exclusive colorways`,
    `${days.join(' and ')} days of Legend`,
    `${scans} free body scans and ${messages} bonus AI messages`,
  ];
}
