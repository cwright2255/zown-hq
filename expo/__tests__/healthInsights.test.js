// What the Health screen says about a reading besides the reading (lib/healthInsights.js): how old it is, how it compares with the
// person's usual, how close the training load is to having enough history, and what changed on the last body scan.
// jest.global-setup.js pins the zone to America/New_York. Today in these tests is Tuesday 20 October 2026.
import {
  TRAINING_LOAD_MIN_DAYS, againstUsual, bodyChangeLine, dayWords, readingDay, trainingDaysLogged, usualFor,
} from '../lib/healthInsights';
import { MIN_BASELINE_READINGS, BASELINE_DAYS } from '../lib/readiness';
import { calculateTrainingLoad } from '../lib/trainingLoad';
import { localDateKey, shiftDateKey } from '../lib/localDate';

const TODAY = '2026-10-20';

describe('readingDay', () => {
  it('is the day of the Apple Health sample, in the person\'s own time', () => {
    // 01:30Z on the 20th is 9:30 PM on the 19th in New Jersey.
    expect(readingDay({ source: 'Apple Health', hrv: 42, hrvAt: '2026-10-20T01:30:00Z' }, 'hrv', TODAY)).toBe('2026-10-19');
    expect(readingDay({ source: 'Apple Health', hrv: 42, hrvAt: '2026-10-20T15:00:00Z' }, 'hrv', TODAY)).toBe('2026-10-20');
  });

  it('keeps the two readings apart', () => {
    const recovery = { source: 'Apple Health', restingHeartRateAt: '2026-10-20T12:00:00Z', hrvAt: '2026-10-17T12:00:00Z' };
    expect(readingDay(recovery, 'restingHeartRate', TODAY)).toBe('2026-10-20');
    expect(readingDay(recovery, 'hrv', TODAY)).toBe('2026-10-17');
  });

  it('is today for a wearable, because the health store files its readings under today', () => {
    expect(readingDay({ source: 'WHOOP', hrv: 88 }, 'hrv', TODAY)).toBe(TODAY);
    expect(readingDay({ source: ' Oura ', hrv: 88 }, 'hrv', TODAY)).toBe(TODAY);
  });

  it('is not known for an Apple Health reading with no usable time, rather than guessed', () => {
    expect(readingDay({ source: 'Apple Health', hrv: 42 }, 'hrv', TODAY)).toBeNull();
    expect(readingDay({ source: 'apple health', hrv: 42, hrvAt: 'nope' }, 'hrv', TODAY)).toBeNull();
    expect(readingDay({ source: 'Apple Health', hrv: 42, hrvAt: null }, 'hrv', TODAY)).toBeNull();
  });

  it('is not known without a source or a reading', () => {
    expect(readingDay({ hrv: 42 }, 'hrv', TODAY)).toBeNull();
    expect(readingDay({ hrv: 42, source: '  ' }, 'hrv', TODAY)).toBeNull();
    expect(readingDay({ hrv: 42, source: 7 }, 'hrv', TODAY)).toBeNull();
    expect(readingDay(null, 'hrv', TODAY)).toBeNull();
    expect(readingDay('x', 'hrv', TODAY)).toBeNull();
  });
});

describe('dayWords', () => {
  it.each([
    ['2026-10-20', 'today'],
    ['2026-10-19', 'yesterday'],
    ['2026-10-18', '2 days ago'],
    ['2026-10-14', '6 days ago'],
    ['2026-10-13', 'Oct 13'],
    ['2026-09-30', 'Sep 30'],
    ['2026-10-21', 'today'], // a clock a little ahead is still today
  ])('writes %s as %s', (day, words) => {
    expect(dayWords(day, TODAY)).toBe(words);
  });

  it('counts calendar days across a clock change', () => {
    expect(dayWords('2026-11-01', '2026-11-02')).toBe('yesterday'); // the clocks went back in the night
    expect(dayWords('2026-03-07', '2026-03-09')).toBe('2 days ago'); // and forward
  });

  it('is null for something that is not a day', () => {
    expect(dayWords('soon', TODAY)).toBeNull();
    expect(dayWords(TODAY, 'now')).toBeNull();
    expect(dayWords(null, TODAY)).toBeNull();
  });
});

describe('usualFor', () => {
  const record = (days, hrv, from = TODAY) => {
    const out = {};
    for (let i = 1; i <= days; i += 1) out[shiftDateKey(from, -i)] = { hrv, restingHeartRate: 60 };
    return out;
  };

  it('is the average of the readings in the 28 days before the day', () => {
    expect(usualFor(record(28, 50), 'hrv', TODAY)).toBe(50);
    const mixed = { ...record(14, 40), ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [shiftDateKey(TODAY, -(i + 15)), { hrv: 60 }])) };
    expect(usualFor(mixed, 'hrv', TODAY)).toBe(50);
  });

  it('needs enough readings to be a usual, not an average of a few', () => {
    expect(MIN_BASELINE_READINGS).toBe(10);
    expect(usualFor(record(MIN_BASELINE_READINGS - 1, 50), 'hrv', TODAY)).toBeNull();
    expect(usualFor(record(MIN_BASELINE_READINGS, 50), 'hrv', TODAY)).toBe(50);
  });

  it('leaves out the reading\'s own day and anything later', () => {
    const history = { ...record(28, 50), [TODAY]: { hrv: 90 }, [shiftDateKey(TODAY, 1)]: { hrv: 95 } };
    expect(usualFor(history, 'hrv', TODAY)).toBe(50);
  });

  it('leaves out readings older than 28 days', () => {
    const history = { ...record(10, 50), [shiftDateKey(TODAY, -(BASELINE_DAYS + 1))]: { hrv: 200 } };
    expect(usualFor(history, 'hrv', TODAY)).toBe(50);
  });

  it('is null for no record, or a bad day', () => {
    expect(usualFor({}, 'hrv', TODAY)).toBeNull();
    expect(usualFor(null, 'hrv', TODAY)).toBeNull();
    expect(usualFor(record(28, 50), 'hrv', 'soon')).toBeNull();
  });
});

describe('againstUsual', () => {
  it('says which way and how far, in the whole numbers that are shown', () => {
    expect(againstUsual('hrv', 56.4, 50.4)).toEqual({ text: '↑ 6 vs your usual 50', tone: 'good', usual: 50 });
    expect(againstUsual('hrv', 41, 50)).toEqual({ text: '↓ 9 vs your usual 50', tone: 'worse', usual: 50 });
    expect(againstUsual('restingHeartRate', 57, 60)).toEqual({ text: '↓ 3 vs your usual 60', tone: 'good', usual: 60 });
    expect(againstUsual('restingHeartRate', 66, 60)).toEqual({ text: '↑ 6 vs your usual 60', tone: 'worse', usual: 60 });
  });

  it('is the same when the whole numbers are the same, even if the decimals are not', () => {
    expect(againstUsual('hrv', 50.4, 49.6)).toEqual({ text: 'About your usual', tone: 'same', usual: 50 });
    expect(againstUsual('restingHeartRate', 60, 60)).toMatchObject({ tone: 'same' });
  });

  it('is nothing without a reading or a usual', () => {
    expect(againstUsual('hrv', 0, 50)).toBeNull();
    expect(againstUsual('hrv', null, 50)).toBeNull();
    expect(againstUsual('hrv', 'n/a', 50)).toBeNull();
    expect(againstUsual('hrv', 50, null)).toBeNull();
    expect(againstUsual('hrv', 50, undefined)).toBeNull();
    expect(againstUsual('hrv', 50, NaN)).toBeNull();
  });
});

describe('trainingDaysLogged', () => {
  const NOW = new Date(2026, 9, 20, 15, 0);
  const on = (...ago) => Object.fromEntries(ago.map((n) => [shiftDateKey(TODAY, -n), 300]));

  it('counts the days with a workout, run or hike in the last 28, today included', () => {
    expect(trainingDaysLogged({}, NOW)).toBe(0);
    expect(trainingDaysLogged(on(0, 3, 9), NOW)).toBe(3);
    expect(trainingDaysLogged(on(27), NOW)).toBe(1);
  });

  it('leaves out days before the 28 and days that are not in the list', () => {
    expect(trainingDaysLogged(on(28, 40), NOW)).toBe(0);
    expect(trainingDaysLogged(null, NOW)).toBe(0);
    expect(trainingDaysLogged(undefined, NOW)).toBe(0);
  });

  it('counts days the way calculateTrainingLoad does: it has enough exactly at TRAINING_LOAD_MIN_DAYS', () => {
    jest.useFakeTimers().setSystemTime(NOW);
    try {
      const four = on(0, 2, 5, 11);
      const five = on(0, 2, 5, 11, 20);
      expect(TRAINING_LOAD_MIN_DAYS).toBe(5);
      expect(trainingDaysLogged(four, NOW)).toBe(TRAINING_LOAD_MIN_DAYS - 1);
      expect(calculateTrainingLoad(four).zone).toBe('insufficient_data');
      expect(trainingDaysLogged(five, NOW)).toBe(TRAINING_LOAD_MIN_DAYS);
      expect(calculateTrainingLoad(five).zone).not.toBe('insufficient_data');
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts today in the person\'s own time', () => {
    const late = new Date(2026, 9, 20, 23, 50);
    expect(trainingDaysLogged({ [localDateKey(late)]: 100 }, late)).toBe(1);
  });
});

describe('bodyChangeLine', () => {
  const NOW = new Date(2026, 10, 24, 9, 0);
  const scan = (fat, date, extra = {}) => ({ id: 's', bodyFatPercent: fat, createdAtLocal: date.toISOString(), ...extra });
  const before = scan(25.4, new Date(2026, 7, 12));

  it('says body fat down, in green, with the date of the scan it is measured against', () => {
    expect(bodyChangeLine(scan(24.2, new Date(2026, 10, 23)), before, NOW)).toEqual({ text: 'Body fat down 1.2% since Aug 12', tone: 'good' });
  });

  it('says body fat up, in orange', () => {
    expect(bodyChangeLine(scan(26.1, new Date(2026, 10, 23)), before, NOW)).toEqual({ text: 'Body fat up 0.7% since Aug 12', tone: 'worse' });
  });

  it('says no change, in grey, when it moved by less than a twentieth of a point', () => {
    expect(bodyChangeLine(scan(25.42, new Date(2026, 10, 23)), before, NOW)).toEqual({ text: 'No change in body fat since Aug 12', tone: 'same' });
  });

  it('puts the year on a scan from another year', () => {
    expect(bodyChangeLine(scan(24, new Date(2026, 10, 23)), scan(25, new Date(2025, 11, 30)), NOW).text).toBe('Body fat down 1.0% since Dec 30, 2025');
  });

  it('says "your last scan" when the scan before has no usable date', () => {
    expect(bodyChangeLine(scan(24, new Date(2026, 10, 23)), scan(25, new Date(2026, 7, 12), { createdAtLocal: 'never' }), NOW).text).toBe('Body fat down 1.0% since your last scan');
  });

  it('is nothing without two scans, or without body fat on both', () => {
    const latest = scan(24, new Date(2026, 10, 23));
    expect(bodyChangeLine(latest, null, NOW)).toBeNull();
    expect(bodyChangeLine(null, before, NOW)).toBeNull();
    expect(bodyChangeLine({ id: 'x', createdAtLocal: latest.createdAtLocal }, before, NOW)).toBeNull();
    expect(bodyChangeLine(latest, { id: 'y', createdAtLocal: before.createdAtLocal }, NOW)).toBeNull();
  });
});
