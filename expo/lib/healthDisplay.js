// lib/healthDisplay.js
//
// What the Health screen shows for the readings from a watch or Apple Health, and for the Body Composition card. Pure functions, so
// every wording and every route here is checked in a test. Nothing is made up: a reading that is missing, zero or not a number is
// shown as a dash, and when there is no reading at all the screen says so and points to Wearable Sync.
import { featureTier, TIER_NAMES } from './entitlements';
import { againstUsual, bodyChangeLine, dayWords, readingDay, usualFor } from './healthInsights';

/** Shown where there is no reading. */
export const NO_READING = String.fromCharCode(0x2014);

// A reading is a number above zero. Number() makes null, empty text and spaces 0, and text that is not a number NaN, which are
// not above zero; true would be 1, so it is turned away by name.
const positive = (v) => {
  const n = Number(v);
  return typeof v !== 'boolean' && Number.isFinite(n) && n > 0 ? n : null;
};

const sourceOf = (recovery) => (
  typeof recovery?.source === 'string' && recovery.source.trim() ? recovery.source.trim() : 'a connected device'
);

/** SDNN for Apple Health, RMSSD for the wearables behind ROOK: they are different measures of HRV and cannot be compared. */
const hrvKindOf = (recovery) => (/apple/i.test(sourceOf(recovery)) ? 'SDNN' : 'RMSSD');

/** "HRV (SDNN)" or "HRV (RMSSD)" once the source is known, plain "HRV" before. */
export function hrvTitle(recovery) {
  return typeof recovery?.source === 'string' && recovery.source.trim() ? `HRV (${hrvKindOf(recovery)})` : 'HRV';
}

/**
 * The recovery tiles from healthStore.rookRecovery: resting heart rate and HRV. Apple Health reports HRV as SDNN and the
 * wearables behind ROOK as RMSSD, which are different measures, so the tile says which one it is showing. Sleep is not here: the
 * Today card on the Health screen already has it.
 *
 * Given `context` ({ history: the daily record, today: a day key }) each tile also says how the reading compares with the person's
 * own usual (`change`, `tone`), the same usual the Readiness card uses, and nothing when there are not enough earlier readings to
 * have a usual. The usual is made from the days before the reading's own day, so an older reading is compared with what came before it.
 * @returns {{ key: string, icon: string, label: string, value: string, unit: string, change?: string, tone?: 'good'|'worse'|'same'|null }[]}
 */
export function recoveryTiles(recovery, context) {
  const hr = positive(recovery?.restingHeartRate);
  const hrv = positive(recovery?.hrv);
  const hrvKind = hrvKindOf(recovery);
  const tiles = [
    { key: 'restingHeartRate', icon: 'heart-outline', label: 'Resting HR', value: hr !== null ? String(Math.round(hr)) : NO_READING, unit: hr !== null ? 'bpm' : '' },
    { key: 'hrv', icon: 'pulse-outline', label: hrv !== null ? `HRV (${hrvKind})` : 'HRV', value: hrv !== null ? String(Math.round(hrv)) : NO_READING, unit: hrv !== null ? 'ms' : '' },
  ];
  if (!context) return tiles;
  const readings = { restingHeartRate: hr, hrv };
  return tiles.map((tile) => {
    const value = readings[tile.key];
    const day = readingDay(recovery, tile.key, context.today) || context.today;
    const compared = value === null ? null : againstUsual(tile.key, value, usualFor(context.history, tile.key, day));
    return { ...tile, change: compared ? compared.text : '', tone: compared ? compared.tone : null };
  });
}

/**
 * The line under the tiles. Apple Health gives its most recent readings, which are not always from today, so without a time on them it
 * says "Latest readings" and never "today". With no reading at all it says what to do about it.
 * Given `context` ({ today: a day key }) and the day of each reading (see readingDay in lib/healthInsights.js) it says how old they
 * are: "From Apple Health · today", or "From Apple Health · resting HR today, HRV 3 days ago" when they differ.
 */
export function recoveryCaption(recovery, context) {
  const tiles = recoveryTiles(recovery);
  const present = tiles.filter((tile) => tile.value !== NO_READING);
  if (!present.length) return 'No readings yet. Connect a device under Wearable Sync below.';
  const plain = `Latest readings from ${sourceOf(recovery)}`;
  if (!context) return plain;
  const names = { restingHeartRate: 'resting HR', hrv: 'HRV' };
  const when = present.map((tile) => {
    const day = readingDay(recovery, tile.key, context.today);
    return { key: tile.key, words: day ? dayWords(day, context.today) : null };
  });
  if (when.some((w) => w.words === null)) return plain;
  const first = when[0].words;
  const alike = when.every((w) => w.words === first);
  return `From ${sourceOf(recovery)} \u00b7 ${alike ? first : when.map((w) => `${names[w.key]} ${w.words}`).join(', ')}`;
}

const PLANS = { pathname: '/paywall', params: { feature: 'bodyScan' } };
const CAPTURE = '/body-scan/capture';

const PROGRESS = '/progress';

/**
 * The Body Composition card. A scan is part of a higher plan (lib/entitlements.js), so when the person's plan does not include it
 * the card says which plan and the button goes to the plans instead of the camera, unless the person has a free scan from the Premium Pass
 * (`freeScans`), which opens the camera and says how many are left. A scan already taken stays viewable. "View progress" goes to the
 * Progress tab (`progressRoute`), where the scans are tracked over time. With an earlier scan (`previousScan`) the card also says what
 * changed in body fat since then (`change`: { text, tone }), and has no `change` otherwise.
 * @param {{ latestScan: object|null, previousScan?: object|null, locked: boolean, freeScans?: number, now?: Date }} args
 * @returns {{ pill: string|null, subtitle: string, change: { text: string, tone: string }|null, primaryLabel: string, primaryRoute: string|object, cardRoute: string|object, progressRoute: string, showViewProgress: boolean }}
 */
export function bodyScanCard({ latestScan, previousScan = null, locked, freeScans = 0, now = new Date() }) {
  const planName = TIER_NAMES[featureTier('bodyScan')];
  // A plan without body scans is opened by a free scan from the Premium Pass (lib/premiumRewards.js); it is used up when the insight is made.
  const free = locked && freeScans >= 1;
  const shut = locked && !free;
  let subtitle = 'AI-powered body analysis using your camera';
  if (latestScan) subtitle = `Last scan: ${latestScan.bodyFatPercent != null ? `${latestScan.bodyFatPercent}% body fat` : 'saved'}`;
  else if (shut) subtitle = `Body scan is part of ${planName}`;
  else if (free) subtitle = `${freeScans === 1 ? '1 free scan' : `${freeScans} free scans`} from your Premium Pass`;
  return {
    pill: shut ? planName : (free ? (freeScans === 1 ? '1 free scan' : `${freeScans} free scans`) : null),
    subtitle,
    change: latestScan ? bodyChangeLine(latestScan, previousScan, now) : null,
    primaryLabel: shut ? 'See plans' : (latestScan ? 'New scan' : 'Scan now'),
    primaryRoute: shut ? PLANS : CAPTURE,
    cardRoute: latestScan ? `/body-scan/${latestScan.id}` : (shut ? PLANS : CAPTURE),
    progressRoute: PROGRESS,
    showViewProgress: Boolean(latestScan),
  };
}
