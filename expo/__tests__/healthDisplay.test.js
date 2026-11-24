// What the Health screen shows for recovery readings and the Body Composition card (lib/healthDisplay.js).
import { NO_READING, recoveryTiles, recoveryCaption, bodyScanCard, hrvTitle } from '../lib/healthDisplay';

const APPLE = { restingHeartRate: 58.4, hrv: 41.6, sleepEfficiency: null, sleepHours: null, source: 'Apple Health' };
const WHOOP = { restingHeartRate: 52, hrv: 88, sleepHours: 7.4, source: 'WHOOP' };

describe('NO_READING', () => {
  it('is a dash', () => {
    expect(NO_READING).toBe(String.fromCharCode(8212));
  });
});

describe('recoveryTiles', () => {
  it('gives the resting heart rate and the HRV, rounded, with their units', () => {
    expect(recoveryTiles(WHOOP)).toEqual([
      { key: 'restingHeartRate', icon: 'heart-outline', label: 'Resting HR', value: '52', unit: 'bpm' },
      { key: 'hrv', icon: 'pulse-outline', label: 'HRV (RMSSD)', value: '88', unit: 'ms' },
    ]);
    const apple = recoveryTiles(APPLE);
    expect(apple.map((t) => t.value)).toEqual(['58', '42']);
  });

  it('names the kind of HRV after where it came from: Apple Health measures SDNN, the wearables RMSSD', () => {
    expect(recoveryTiles(APPLE)[1].label).toBe('HRV (SDNN)');
    expect(recoveryTiles({ ...APPLE, source: 'apple health' })[1].label).toBe('HRV (SDNN)');
    expect(recoveryTiles(WHOOP)[1].label).toBe('HRV (RMSSD)');
    expect(recoveryTiles({ hrv: 60 })[1].label).toBe('HRV (RMSSD)');
    expect(recoveryTiles({ hrv: 60, source: '   ' })[1].label).toBe('HRV (RMSSD)');
    expect(recoveryTiles({ hrv: 60, source: 7 })[1].label).toBe('HRV (RMSSD)');
  });

  it('shows a dash, with no unit, for a reading that is not there', () => {
    const tiles = recoveryTiles({ restingHeartRate: 61, source: 'WHOOP' });
    expect(tiles[0]).toMatchObject({ value: '61', unit: 'bpm' });
    expect(tiles[1]).toMatchObject({ label: 'HRV', value: NO_READING, unit: '' });
  });

  it.each([
    ['nothing at all', null],
    ['nothing yet', undefined],
    ['a text', 'x'],
    ['an empty reading', {}],
    ['zeros', { restingHeartRate: 0, hrv: 0 }],
    ['negative numbers', { restingHeartRate: -3, hrv: -1 }],
    ['text that is not a number', { restingHeartRate: 'n/a', hrv: 'high' }],
    ['empty text', { restingHeartRate: '', hrv: '' }],
    ['nulls', { restingHeartRate: null, hrv: null }],
    ['true', { restingHeartRate: true, hrv: true }],
    ['numbers that are not finite', { restingHeartRate: NaN, hrv: Infinity }],
  ])('never makes a number up from %s', (_name, recovery) => {
    expect(recoveryTiles(recovery)).toEqual([
      { key: 'restingHeartRate', icon: 'heart-outline', label: 'Resting HR', value: NO_READING, unit: '' },
      { key: 'hrv', icon: 'pulse-outline', label: 'HRV', value: NO_READING, unit: '' },
    ]);
  });

  it('reads a number that came in as text', () => {
    expect(recoveryTiles({ restingHeartRate: '64', hrv: '45.4' }).map((t) => t.value)).toEqual(['64', '45']);
  });
});

describe('hrvTitle', () => {
  it('says which kind of HRV once it knows where the reading is from', () => {
    expect(hrvTitle(APPLE)).toBe('HRV (SDNN)');
    expect(hrvTitle({ source: 'apple health' })).toBe('HRV (SDNN)');
    expect(hrvTitle(WHOOP)).toBe('HRV (RMSSD)');
  });

  it('is plain HRV before it knows', () => {
    for (const recovery of [null, undefined, {}, { hrv: 50 }, { source: '   ' }, { source: 7 }]) expect(hrvTitle(recovery)).toBe('HRV');
  });

  it('is the same words as the Recovery tile', () => {
    expect(hrvTitle(APPLE)).toBe(recoveryTiles(APPLE)[1].label);
    expect(hrvTitle(WHOOP)).toBe(recoveryTiles(WHOOP)[1].label);
  });
});

describe('recoveryCaption', () => {
  it('says where the readings are from, and that they are the latest rather than today\'s', () => {
    expect(recoveryCaption(APPLE)).toBe('Latest readings from Apple Health');
    expect(recoveryCaption(WHOOP)).toBe('Latest readings from WHOOP');
  });

  it('trims the source and names a device when it has none', () => {
    expect(recoveryCaption({ ...WHOOP, source: '  Oura  ' })).toBe('Latest readings from Oura');
    expect(recoveryCaption({ restingHeartRate: 60 })).toBe('Latest readings from a connected device');
    expect(recoveryCaption({ restingHeartRate: 60, source: '' })).toBe('Latest readings from a connected device');
  });

  it('is the same with just one reading', () => {
    expect(recoveryCaption({ hrv: 50, source: 'Garmin' })).toBe('Latest readings from Garmin');
  });

  it('points to Wearable Sync when there is no reading at all', () => {
    const none = 'No readings yet. Connect a device under Wearable Sync below.';
    expect(recoveryCaption(null)).toBe(none);
    expect(recoveryCaption({})).toBe(none);
    expect(recoveryCaption({ restingHeartRate: 0, hrv: 0, source: 'Apple Health' })).toBe(none);
  });
});

describe('bodyScanCard', () => {
  const SCAN = { id: 's9', bodyFatPercent: 18.5 };
  const PLANS = { pathname: '/paywall', params: { feature: 'bodyScan' } };

  it('is the camera for someone whose plan includes it and who has not scanned yet', () => {
    expect(bodyScanCard({ latestScan: null, locked: false })).toEqual({
      pill: null,
      subtitle: 'AI-powered body analysis using your camera',
      primaryLabel: 'Scan now',
      primaryRoute: '/body-scan/capture',
      cardRoute: '/body-scan/capture',
      change: null,
      progressRoute: '/progress',
      showViewProgress: false,
    });
  });

  it('shows the last scan and a new scan for someone whose plan includes it', () => {
    expect(bodyScanCard({ latestScan: SCAN, locked: false })).toEqual({
      pill: null,
      subtitle: 'Last scan: 18.5% body fat',
      primaryLabel: 'New scan',
      primaryRoute: '/body-scan/capture',
      cardRoute: '/body-scan/s9',
      change: null,
      progressRoute: '/progress',
      showViewProgress: true,
    });
  });

  it('says a scan that was saved without a body fat figure is saved', () => {
    expect(bodyScanCard({ latestScan: { id: 's1' }, locked: false }).subtitle).toBe('Last scan: saved');
    expect(bodyScanCard({ latestScan: { id: 's1', bodyFatPercent: 0 }, locked: false }).subtitle).toBe('Last scan: 0% body fat');
  });

  it('is marked Legend, and goes to the plans, for someone whose plan does not include it', () => {
    expect(bodyScanCard({ latestScan: null, locked: true })).toEqual({
      pill: 'Legend',
      subtitle: 'Body scan is part of Legend',
      primaryLabel: 'See plans',
      primaryRoute: PLANS,
      cardRoute: PLANS,
      change: null,
      progressRoute: '/progress',
      showViewProgress: false,
    });
  });

  it('opens the camera, with the count in the pill, when the plan does not include it but a free scan from the Premium Pass is left', () => {
    expect(bodyScanCard({ latestScan: null, locked: true, freeScans: 1 })).toEqual({
      pill: '1 free scan',
      subtitle: '1 free scan from your Premium Pass',
      primaryLabel: 'Scan now',
      primaryRoute: '/body-scan/capture',
      cardRoute: '/body-scan/capture',
      change: null,
      progressRoute: '/progress',
      showViewProgress: false,
    });
    expect(bodyScanCard({ latestScan: null, locked: true, freeScans: 3 })).toMatchObject({ pill: '3 free scans', subtitle: '3 free scans from your Premium Pass' });
  });

  it('keeps the last scan on show next to a free scan, and opens the camera for a new one', () => {
    expect(bodyScanCard({ latestScan: SCAN, locked: true, freeScans: 2 })).toEqual({
      pill: '2 free scans',
      subtitle: 'Last scan: 18.5% body fat',
      primaryLabel: 'New scan',
      primaryRoute: '/body-scan/capture',
      cardRoute: '/body-scan/s9',
      change: null,
      progressRoute: '/progress',
      showViewProgress: true,
    });
  });

  it('is still locked with no free scans, or a count that is not a whole scan', () => {
    for (const freeScans of [0, undefined, -1, 0.5, NaN]) {
      expect(bodyScanCard({ latestScan: null, locked: true, freeScans })).toMatchObject({ pill: 'Legend', primaryLabel: 'See plans', primaryRoute: PLANS });
    }
  });

  it('shows no free scans when the plan includes the body scan, however many are held', () => {
    expect(bodyScanCard({ latestScan: null, locked: false, freeScans: 3 })).toEqual({
      pill: null,
      subtitle: 'AI-powered body analysis using your camera',
      primaryLabel: 'Scan now',
      primaryRoute: '/body-scan/capture',
      cardRoute: '/body-scan/capture',
      change: null,
      progressRoute: '/progress',
      showViewProgress: false,
    });
  });

  it('still opens a scan that was taken, even when the plan does not include a new one', () => {
    expect(bodyScanCard({ latestScan: SCAN, locked: true })).toEqual({
      pill: 'Legend',
      subtitle: 'Last scan: 18.5% body fat',
      primaryLabel: 'See plans',
      primaryRoute: PLANS,
      cardRoute: '/body-scan/s9',
      change: null,
      progressRoute: '/progress',
      showViewProgress: true,
    });
  });
});

// ---- with what the screen also knows: the daily record and today --------------------------------------------------------------

describe('recoveryTiles, against the person\'s usual', () => {
  // 28 days of resting heart rate 60 and HRV 50 before 20 October: the usual.
  const usual = (days = 28, rhr = 60, hrv = 50) => {
    const out = {};
    for (let i = 1; i <= days; i += 1) {
      const d = new Date(2026, 9, 20 - i);
      out[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = { restingHeartRate: rhr, hrv };
    }
    return out;
  };
  const TODAY = '2026-10-20';
  const reading = { restingHeartRate: 57, hrv: 56, source: 'WHOOP' };
  const tiles = (recovery, history = usual()) => recoveryTiles(recovery, { history, today: TODAY });

  it('says how far each reading is from the usual, and whether that is the better way', () => {
    const [hr, hrv] = tiles(reading);
    expect(hr).toMatchObject({ change: '\u2193 3 vs your usual 60', tone: 'good' }); // a lower resting heart rate is better
    expect(hrv).toMatchObject({ change: '\u2191 6 vs your usual 50', tone: 'good' }); // a higher HRV is better
    const [hr2, hrv2] = tiles({ ...reading, restingHeartRate: 66, hrv: 41 });
    expect(hr2).toMatchObject({ change: '\u2191 6 vs your usual 60', tone: 'worse' });
    expect(hrv2).toMatchObject({ change: '\u2193 9 vs your usual 50', tone: 'worse' });
  });

  it('says "About your usual" when the whole numbers are the same', () => {
    const [hr, hrv] = tiles({ ...reading, restingHeartRate: 60.4, hrv: 49.6 });
    expect(hr).toMatchObject({ change: 'About your usual', tone: 'same' });
    expect(hrv).toMatchObject({ change: 'About your usual', tone: 'same' });
  });

  it('keeps the tile as it was, with an empty change, when there is no usual to compare with yet', () => {
    const [hr, hrv] = tiles(reading, usual(9));
    expect(hr).toMatchObject({ key: 'restingHeartRate', value: '57', unit: 'bpm', change: '', tone: null });
    expect(hrv).toMatchObject({ change: '', tone: null });
    expect(tiles(reading, {})[0].change).toBe('');
  });

  it('compares a reading that is not there with nothing', () => {
    const [hr, hrv] = tiles({ restingHeartRate: 57, source: 'WHOOP' });
    expect(hr.change).not.toBe('');
    expect(hrv).toMatchObject({ value: NO_READING, change: '', tone: null });
    expect(tiles(null).map((t) => t.change)).toEqual(['', '']);
  });

  it('compares an older Apple Health reading with the days before it, not with today\'s', () => {
    // The HRV is from 10 October: its usual is the 28 days before that, where the HRV was 40, not the 50 of the last 28 days.
    const history = { ...usual(), ...Object.fromEntries(Array.from({ length: 28 }, (_, i) => {
      const d = new Date(2026, 9, 9 - i);
      return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, { restingHeartRate: 60, hrv: 40 }];
    })) };
    const apple = { restingHeartRate: 58, hrv: 45, source: 'Apple Health', restingHeartRateAt: '2026-10-20T11:00:00Z', hrvAt: '2026-10-10T09:00:00Z' };
    const [hr, hrv] = tiles(apple, history);
    expect(hrv).toMatchObject({ change: '\u2191 5 vs your usual 40', tone: 'good' });
    expect(hr.change).toMatch(/vs your usual 60$/);
  });

  it('leaves the tiles exactly as they were when it is not given the daily record', () => {
    expect(recoveryTiles(WHOOP)).toEqual(recoveryTiles(WHOOP, undefined));
    expect(recoveryTiles(WHOOP)[0]).not.toHaveProperty('change');
  });
});

describe('recoveryCaption, with how old the readings are', () => {
  const TODAY = '2026-10-20';
  const at = (day) => `${day}T11:00:00Z`;
  const apple = (rhrDay, hrvDay) => ({ restingHeartRate: 58, hrv: 42, source: 'Apple Health', restingHeartRateAt: at(rhrDay), hrvAt: at(hrvDay) });
  const caption = (recovery) => recoveryCaption(recovery, { today: TODAY });

  it('says today, yesterday or how many days ago, when both readings are from the same day', () => {
    expect(caption(apple('2026-10-20', '2026-10-20'))).toBe('From Apple Health \u00b7 today');
    expect(caption(apple('2026-10-19', '2026-10-19'))).toBe('From Apple Health \u00b7 yesterday');
    expect(caption(apple('2026-10-17', '2026-10-17'))).toBe('From Apple Health \u00b7 3 days ago');
  });

  it('says each, when they are from different days', () => {
    expect(caption(apple('2026-10-20', '2026-10-17'))).toBe('From Apple Health \u00b7 resting HR today, HRV 3 days ago');
    expect(caption(apple('2026-10-10', '2026-10-20'))).toBe('From Apple Health \u00b7 resting HR Oct 10, HRV today');
  });

  it('is about the one reading there is', () => {
    expect(caption({ hrv: 42, source: 'Apple Health', hrvAt: at('2026-10-19') })).toBe('From Apple Health \u00b7 yesterday');
  });

  it('calls a wearable\'s readings today\'s, as the health store files them', () => {
    expect(caption(WHOOP)).toBe('From WHOOP \u00b7 today');
  });

  it('does not guess how old an Apple Health reading is when it has no time on it', () => {
    expect(caption(APPLE)).toBe('Latest readings from Apple Health');
    expect(caption({ ...apple('2026-10-20', '2026-10-20'), hrvAt: null })).toBe('Latest readings from Apple Health');
  });

  it('asks to connect a device when there is no reading, however it is asked', () => {
    const none = 'No readings yet. Connect a device under Wearable Sync below.';
    expect(caption(null)).toBe(none);
    expect(recoveryCaption(null)).toBe(none);
  });

  it('says what it said before when it is not told the day', () => {
    expect(recoveryCaption(apple('2026-10-20', '2026-10-20'))).toBe('Latest readings from Apple Health');
  });
});

describe('bodyScanCard, with the scan before', () => {
  const NOW = new Date(2026, 10, 24, 9, 0);
  const scan = (id, fat, date) => ({ id, bodyFatPercent: fat, bmi: 35, weightKg: 100, createdAtLocal: date.toISOString() });
  const before = scan('a', 25.4, new Date(2026, 7, 12));
  const latest = scan('b', 24.2, new Date(2026, 10, 23));

  it('says what changed in body fat since the scan before, on a line of its own', () => {
    const card = bodyScanCard({ latestScan: latest, previousScan: before, locked: false, now: NOW });
    expect(card.subtitle).toBe('Last scan: 24.2% body fat');
    expect(card.change).toEqual({ text: 'Body fat down 1.2% since Aug 12', tone: 'good' });
  });

  it('has no change with one scan, or with no scan', () => {
    expect(bodyScanCard({ latestScan: latest, previousScan: null, locked: false }).change).toBeNull();
    expect(bodyScanCard({ latestScan: null, previousScan: before, locked: false }).change).toBeNull();
  });

  it('sends View progress to the Progress tab, not to the latest scan', () => {
    const card = bodyScanCard({ latestScan: latest, locked: false });
    expect(card.progressRoute).toBe('/progress');
    expect(card.cardRoute).toBe('/body-scan/b');
    expect(card.showViewProgress).toBe(true);
  });
});
