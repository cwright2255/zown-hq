// The numbers and words on the Progress tab: the weight card, the scan card, the week so far and the last six months.
// jest.global-setup.js pins the zone to America/New_York; every date here is built in local time, so the tests do not depend on it.
import {
  KG_TO_LB, STALE_AFTER_DAYS, WEIGHT_RANGES, bestMonth, changeFromStart, changeWords, defaultRange, entriesInRange, leanMassLbs, monthDay,
  monthlyTotals, niceMax, recentChange, scanChanges, scanLine, trendSeries, versusLastMonth, weekStrip, weekSummary, weightChartModel,
  weightEntries, weightFreshness, weightGoalLine, weightProgress,
} from '../lib/progressInsights';

const DAY = 86400000;
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const NOW = at(2026, 11, 23, 21, 40); // Monday 23 Nov 2026, 9:40 PM
const iso = (date) => date.toISOString();
const log = (id, kg, date) => ({ id, weightKg: kg, createdAtLocal: iso(date) });
// Entries as weightEntries gives them, for the functions that only read weight and time.
const entry = (lbs, ms, id = String(ms)) => ({ id, lbs, kg: lbs / KG_TO_LB, ms });

describe('weightEntries', () => {
  it('turns kilograms into pounds the way the screen always has, and puts the oldest first', () => {
    const entries = weightEntries([log('b', 100, at(2026, 8, 12)), log('a', 90.5, at(2026, 7, 1))]);
    expect(entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(entries.map((e) => e.lbs)).toEqual([200, 220]);
    expect(entries[1].kg).toBe(100);
  });

  it('leaves out an entry with no weight, a zero weight or no readable time, and a record that is not there', () => {
    expect(weightEntries([null, undefined, { id: 'a', createdAtLocal: iso(NOW) }, log('b', 0, NOW), log('c', 'heavy', NOW), { id: 'd', weightKg: 80 }, { id: 'e', weightKg: 80, createdAtLocal: 'never' }])).toEqual([]);
    expect(weightEntries(null)).toEqual([]);
    expect(weightEntries(undefined)).toEqual([]);
  });

  it('reads the time from the local stamp, and from a Firestore Timestamp when that is all there is', () => {
    const stamp = { toDate: () => at(2026, 9, 1) };
    const entries = weightEntries([{ id: 'a', weightKg: 80, createdAt: stamp }, { id: 'b', weightKg: 81, createdAt: stamp, createdAtLocal: iso(at(2026, 10, 1)) }]);
    expect(entries.find((e) => e.id === 'a').ms).toBe(at(2026, 9, 1).getTime());
    expect(entries.find((e) => e.id === 'b').ms).toBe(at(2026, 10, 1).getTime());
  });
});

describe('monthDay', () => {
  it('writes "Aug 12", and adds the year when it is not this one', () => {
    expect(monthDay(at(2026, 8, 12).getTime(), NOW)).toBe('Aug 12');
    expect(monthDay(at(2025, 12, 30).getTime(), NOW)).toBe('Dec 30, 2025');
  });
});

describe('weightFreshness', () => {
  const fresh = (date) => weightFreshness([entry(200, date.getTime())], NOW);

  it('is null with no weigh-ins', () => {
    expect(weightFreshness([], NOW)).toBeNull();
    expect(weightFreshness(null, NOW)).toBeNull();
  });

  it('says today and yesterday by the calendar day, not by 24 hours', () => {
    expect(fresh(at(2026, 11, 23, 0, 5))).toEqual({ days: 0, stale: false, label: 'Logged today' });
    expect(fresh(at(2026, 11, 22, 23, 50))).toEqual({ days: 1, stale: false, label: 'Logged yesterday' });
  });

  it('counts days, then weeks', () => {
    expect(fresh(at(2026, 11, 18)).label).toBe('Logged 5 days ago');
    expect(fresh(at(2026, 11, 10)).label).toBe('Logged 13 days ago');
    expect(fresh(at(2026, 11, 9))).toEqual({ days: 14, stale: false, label: 'Logged 2 weeks ago' });
  });

  it('is stale after two weeks, and then names the date', () => {
    expect(STALE_AFTER_DAYS).toBe(14);
    expect(fresh(at(2026, 11, 8))).toEqual({ days: 15, stale: true, label: 'Logged Nov 8 · 2 weeks ago' });
    expect(fresh(at(2026, 10, 31, 23))).toEqual({ days: 23, stale: true, label: 'Logged Oct 31 · 3 weeks ago' }); // across the clocks going back
  });

  it('counts months for an old one, the August weigh-in on a 23 November screen', () => {
    expect(fresh(at(2026, 8, 12))).toEqual({ days: 103, stale: true, label: 'Logged Aug 12 · 3 months ago' });
    expect(fresh(at(2025, 12, 30))).toEqual({ days: 328, stale: true, label: 'Logged Dec 30, 2025 · 10 months ago' });
  });

  it('goes by the latest weigh-in', () => {
    expect(weightFreshness([entry(230, at(2026, 8, 12).getTime()), entry(225, at(2026, 11, 22).getTime())], NOW).label).toBe('Logged yesterday');
  });
});

describe('weightProgress', () => {
  const T = 82.1; // 181 lbs
  const run = (lbsList, targetKg = T) => weightProgress(lbsList.map((lbs, i) => entry(lbs, i + 1)), targetKg);

  it('is null with no weigh-ins or no usable target', () => {
    expect(weightProgress([], T)).toBeNull();
    expect(weightProgress(null, T)).toBeNull();
    expect(run([230], null)).toBeNull();
    expect(weightProgress([entry(230, 1)], undefined)).toBeNull();
    expect(run([230], 0)).toBeNull();
    expect(run([230], 'soon')).toBeNull();
  });

  it('starts at nothing done: 230 lbs towards 181 is 49 to go', () => {
    expect(run([230])).toEqual({ startLbs: 230, currentLbs: 230, targetLbs: 181, toGoLbs: 49, progress: 0, direction: 'lose', reached: false });
  });

  it('measures how far along from the first weigh-in', () => {
    const p = run([230, 215, 200]);
    expect(p).toMatchObject({ startLbs: 230, currentLbs: 200, toGoLbs: 19, direction: 'lose', reached: false });
    expect(p.progress).toBeCloseTo(30 / 49, 5);
  });

  it('is reached at the target or past it', () => {
    expect(run([230, 181])).toMatchObject({ reached: true, toGoLbs: 0, progress: 1 });
    expect(run([230, 175])).toMatchObject({ reached: true, toGoLbs: 0, progress: 1 });
  });

  it('does not go below nothing when the weight moves the wrong way', () => {
    expect(run([230, 235])).toMatchObject({ progress: 0, toGoLbs: 54, reached: false });
  });

  it('works for gaining too', () => {
    expect(run([150, 155], 72.6)).toMatchObject({ targetLbs: 160, direction: 'gain', toGoLbs: 5, progress: 0.5, reached: false });
    expect(run([150, 162], 72.6)).toMatchObject({ direction: 'gain', reached: true, toGoLbs: 0, progress: 1 });
  });

  it('holds when the target is where the person started', () => {
    expect(run([181])).toMatchObject({ direction: 'hold', reached: true, toGoLbs: 0, progress: 1 });
    expect(run([181, 183])).toMatchObject({ direction: 'hold', reached: false, toGoLbs: 2, progress: 0 });
  });
});

describe('weightGoalLine', () => {
  it('says what is left, or that the target is reached', () => {
    expect(weightGoalLine(weightProgress([entry(230, 1)], 82.1))).toBe('49 lbs to go');
    expect(weightGoalLine(weightProgress([entry(230, 1), entry(180, 2)], 82.1))).toBe('Target reached');
    expect(weightGoalLine(null)).toBe('');
  });
});

describe('changes in weight', () => {
  const entries = [entry(230, NOW.getTime() - 40 * DAY), entry(228, NOW.getTime() - 20 * DAY), entry(225, NOW.getTime() - DAY)];

  it('changeFromStart is the latest minus the first, and null with one weigh-in', () => {
    expect(changeFromStart(entries)).toBe(-5);
    expect(changeFromStart([entry(200, 1)])).toBeNull();
    expect(changeFromStart([])).toBeNull();
    expect(changeFromStart(null)).toBeNull();
  });

  it('recentChange looks only at the last 30 days, and needs two weigh-ins in them', () => {
    expect(recentChange(entries, NOW)).toEqual({ lbs: -3, days: 30 });
    expect(recentChange(entries.slice(1, 2).concat(entries.slice(0, 1)), NOW)).toBeNull(); // 20 and 40 days ago: only one inside
    expect(recentChange([entries[2]], NOW)).toBeNull();
    expect(recentChange(entries, NOW, 60)).toEqual({ lbs: -5, days: 60 });
  });

  it('changeWords', () => {
    expect(changeWords(-3)).toBe('Down 3 lbs');
    expect(changeWords(2)).toBe('Up 2 lbs');
    expect(changeWords(0)).toBe('No change');
  });
});

describe('ranges', () => {
  const entries = [
    entry(230, at(2026, 8, 12).getTime()),
    entry(228, at(2026, 10, 20).getTime()),
    entry(226, at(2026, 11, 12).getTime()),
    entry(225, at(2026, 11, 22).getTime()),
  ];

  it('offers a week, a month, three months and everything', () => {
    expect(WEIGHT_RANGES.map((r) => r.label)).toEqual(['1W', '1M', '3M', 'All']);
  });

  it('keeps the weigh-ins inside a range, counting back from now', () => {
    expect(entriesInRange(entries, '1w', NOW).map((e) => e.lbs)).toEqual([225]);
    expect(entriesInRange(entries, '1m', NOW).map((e) => e.lbs)).toEqual([226, 225]);
    expect(entriesInRange(entries, '3m', NOW).map((e) => e.lbs)).toEqual([228, 226, 225]);
    expect(entriesInRange(entries, 'all', NOW)).toHaveLength(4);
    expect(entriesInRange(entries, 'nonsense', NOW)).toHaveLength(4);
    expect(entriesInRange(null, 'all', NOW)).toEqual([]);
  });

  it('opens on three months when it has two weigh-ins or more, and on everything when it does not', () => {
    expect(defaultRange(entries, NOW)).toBe('3m');
    expect(defaultRange(entries.slice(0, 2), NOW)).toBe('all'); // only one is in the last three months
    expect(defaultRange([], NOW)).toBe('all');
  });
});

describe('trendSeries', () => {
  it('averages each weigh-in with the ones in the seven days before it', () => {
    const entries = [entry(200, 0), entry(210, DAY), entry(220, 2 * DAY)];
    expect(trendSeries(entries).map((t) => t.lbs)).toEqual([200, 205, 210]);
  });

  it('leaves a weigh-in alone when nothing came before it in the window', () => {
    expect(trendSeries([entry(200, 0), entry(210, 10 * DAY)]).map((t) => t.lbs)).toEqual([200, 210]);
  });

  it('is empty with nothing', () => {
    expect(trendSeries([])).toEqual([]);
    expect(trendSeries(null)).toEqual([]);
  });
});

describe('weightChartModel', () => {
  const entries = [
    entry(230, at(2026, 8, 12).getTime(), 'a'),
    entry(228, at(2026, 10, 20).getTime(), 'b'),
    entry(226, at(2026, 11, 20).getTime(), 'c'),
  ];

  it('is null with fewer than two weigh-ins in the range', () => {
    expect(weightChartModel({ entries, rangeKey: '1m', now: NOW })).toBeNull();
    expect(weightChartModel({ entries: [entries[0]], rangeKey: 'all', now: NOW })).toBeNull();
    expect(weightChartModel({ entries: [], now: NOW })).toBeNull();
  });

  it('draws the weigh-ins in the range as fractions, with the target as part of the scale', () => {
    const model = weightChartModel({ entries, rangeKey: '3m', now: NOW, targetLbs: 181 });
    expect(model.points.map((p) => p.id)).toEqual(['b', 'c']);
    expect(model.minLbs).toBe(181);
    expect(model.maxLbs).toBe(228);
    expect(model.points[0].y).toBe(0); // the highest, at the top
    expect(model.points[1].y).toBeCloseTo(2 / 47, 5);
    expect(model.target).toEqual({ lbs: 181, y: 1 });
    expect(model.points[0].x).toBeGreaterThan(0);
    expect(model.points[0].x).toBeLessThan(model.points[1].x);
    expect(model.points[1].x).toBeLessThan(1); // the gap since the last weigh-in shows
    expect(model.startMs).toBe(NOW.getTime() - 90 * DAY);
    expect(model.endMs).toBe(NOW.getTime());
  });

  it('spreads "All" from the first weigh-in to now', () => {
    const model = weightChartModel({ entries, rangeKey: 'all', now: NOW });
    expect(model.points[0].x).toBe(0);
    expect(model.points[2].x).toBeLessThan(1);
    expect(model.target).toBeNull();
  });

  it('puts the line in the middle when the weight has not changed', () => {
    const flat = [entry(200, 1), entry(200, 2)];
    const model = weightChartModel({ entries: flat, rangeKey: 'all', now: new Date(3) });
    expect(model.points.map((p) => p.y)).toEqual([0.5, 0.5]);
  });

  it('gives a trend for the weigh-ins in the range', () => {
    const model = weightChartModel({ entries, rangeKey: '3m', now: NOW });
    expect(model.trend).toHaveLength(2);
  });
});

describe('scans', () => {
  // 24.2% body fat at 230 lbs (104.3 kg) leaves 174 lbs of lean mass, as on the screen.
  const latest = { bodyFatPercent: 24.2, weightKg: 104.3, bmi: 35 };

  it('leanMassLbs', () => {
    expect(leanMassLbs(latest)).toBe(174);
    expect(leanMassLbs({ bodyFatPercent: 24.2 })).toBeNull();
    expect(leanMassLbs({ weightKg: 100 })).toBeNull();
    expect(leanMassLbs(null)).toBeNull();
  });

  it('shows the three stats and "No change" when nothing moved', () => {
    const rows = scanChanges(latest, { ...latest });
    expect(rows.map((r) => [r.label, r.value, r.text, r.tone])).toEqual([
      ['Body Fat', '24.2%', 'No change', 'same'],
      ['Lean Mass', '174 lbs', 'No change', 'same'],
      ['BMI', '35', 'No change', 'same'],
    ]);
  });

  it('shows what went down, which is the good way for body fat and BMI', () => {
    const rows = scanChanges(latest, { bodyFatPercent: 25.4, weightKg: 104.3, bmi: 36.2 });
    expect(rows[0]).toMatchObject({ delta: -1.2, text: '↓ 1.2%', tone: 'good' });
    expect(rows[2]).toMatchObject({ delta: -1.2, text: '↓ 1.2', tone: 'good' });
  });

  it('shows what went up as the other way for them, and lean mass the opposite: up is good, down is not', () => {
    const rows = scanChanges(latest, { bodyFatPercent: 23, weightKg: 108, bmi: 33 });
    expect(rows[0]).toMatchObject({ delta: 1.2, text: '↑ 1.2%', tone: 'worse' });
    expect(rows[1]).toMatchObject({ text: expect.stringMatching(/^↓ \d+ lbs$/), tone: 'worse' }); // 108 kg at 23% is the heavier lean mass
    expect(scanChanges({ ...latest, weightKg: 110 }, latest)[1]).toMatchObject({ text: '↑ 10 lbs', tone: 'good' });
  });

  it('counts a change too small to read as no change', () => {
    const rows = scanChanges({ ...latest, bodyFatPercent: 24.2 }, { ...latest, bodyFatPercent: 24.16 });
    expect(rows[0]).toMatchObject({ text: 'No change', tone: 'same', delta: 0 });
  });

  it('has nothing to compare with for a first scan, and still shows the values', () => {
    const rows = scanChanges(latest, null);
    expect(rows.map((r) => [r.value, r.text, r.delta, r.tone])).toEqual([['24.2%', '', null, null], ['174 lbs', '', null, null], ['35', '', null, null]]);
  });

  it('shows a dash for a reading the scan does not have, and compares nothing for it', () => {
    const rows = scanChanges({ bodyFatPercent: 20, bmi: 25 }, { bodyFatPercent: 22, weightKg: 80, bmi: 26 });
    expect(rows[1]).toEqual({ key: 'leanMass', label: 'Lean Mass', value: '—', delta: null, text: '', tone: null });
    expect(rows[0].text).toBe('↓ 2.0%');
  });

  it('writes one scan as a line, leaving out what it lacks', () => {
    expect(scanLine(latest)).toBe('24.2% body fat · 174 lbs lean · BMI 35');
    expect(scanLine({ bmi: 30 })).toBe('BMI 30');
    expect(scanLine({})).toBe('');
    expect(scanLine(null)).toBe('');
  });
});

describe('weekSummary', () => {
  it('counts the week from Monday, with the calories of workouts and runs together', () => {
    const workouts = [
      { completedAt: iso(at(2026, 11, 23, 8)), caloriesBurned: 300 },
      { completedAt: iso(at(2026, 11, 22, 23)), caloriesBurned: 999 }, // Sunday: last week
    ];
    const runs = [{ startTime: iso(at(2026, 11, 23, 7)), calories: 450 }];
    expect(weekSummary({ workouts, runs, now: NOW })).toEqual({ workouts: 1, runs: 1, calories: 750 });
  });

  it('runs from Monday to Sunday and counts a run by when it ended', () => {
    const now = at(2026, 11, 26, 12); // Thursday
    const workouts = [{ completedAt: iso(at(2026, 11, 23, 6)), caloriesBurned: 100 }, { date: iso(at(2026, 11, 25, 6)), caloriesBurned: 50 }];
    const runs = [{ startTime: iso(at(2026, 11, 22, 23, 30)), endTime: iso(at(2026, 11, 23, 0, 20)), calories: 200 }];
    expect(weekSummary({ workouts, runs, now })).toEqual({ workouts: 2, runs: 1, calories: 350 });
  });

  it('ignores a record that is not one, with no time, and lists that are missing', () => {
    expect(weekSummary({ workouts: [null, 5, {}, { completedAt: 'never' }], runs: undefined, now: NOW })).toEqual({ workouts: 0, runs: 0, calories: 0 });
    expect(weekSummary({ now: NOW })).toEqual({ workouts: 0, runs: 0, calories: 0 });
  });

  it('does not count calories that are missing, negative or not numbers', () => {
    const workouts = [{ completedAt: iso(at(2026, 11, 23, 8)), caloriesBurned: -50 }, { completedAt: iso(at(2026, 11, 23, 9)), caloriesBurned: 'lots' }, { completedAt: iso(at(2026, 11, 23, 10)) }];
    expect(weekSummary({ workouts, now: NOW })).toEqual({ workouts: 3, runs: 0, calories: 0 });
  });
});

describe('weekStrip', () => {
  const now = at(2026, 11, 26, 12); // Thursday

  it('is Monday to Sunday with the days trained marked, today marked and the rest of the week still to come', () => {
    const strip = weekStrip({
      workouts: [{ completedAt: iso(at(2026, 11, 23, 6)) }],
      runs: [{ startTime: iso(at(2026, 11, 25, 21, 30)) }], // 9:30 PM is still Wednesday
      hikes: [{ completedAt: iso(at(2026, 11, 24, 9)) }],
      now,
    });
    expect(strip.map((d) => d.letter).join('')).toBe('MTWTFSS');
    expect(strip.map((d) => d.key)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    expect(strip.map((d) => d.active)).toEqual([true, true, true, false, false, false, false]);
    expect(strip.map((d) => d.today)).toEqual([false, false, false, true, false, false, false]);
    expect(strip.map((d) => d.future)).toEqual([false, false, false, false, true, true, true]);
  });

  it('does not mark last week', () => {
    const strip = weekStrip({ workouts: [{ completedAt: iso(at(2026, 11, 22, 12)) }], now });
    expect(strip.some((d) => d.active)).toBe(false);
  });

  it('works with nothing at all', () => {
    expect(weekStrip({ now })).toHaveLength(7);
  });
});

describe('monthlyTotals', () => {
  it('gives the last six months, oldest first, this month last and still running', () => {
    const totals = monthlyTotals({ workouts: [], runs: [], now: NOW });
    expect(totals.map((m) => m.label)).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
    expect(totals.map((m) => m.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(totals.map((m) => m.current)).toEqual([false, false, false, false, false, true]);
  });

  it('crosses a year', () => {
    const totals = monthlyTotals({ now: at(2027, 2, 10) });
    expect(totals.map((m) => m.key)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('counts workouts and runs and adds up their calories by month', () => {
    const workouts = [
      { completedAt: iso(at(2026, 11, 2)), caloriesBurned: 300 },
      { completedAt: iso(at(2026, 11, 20)), caloriesBurned: 200 },
      { completedAt: iso(at(2026, 10, 31, 23)), caloriesBurned: 100 },
      { completedAt: iso(at(2026, 5, 31)), caloriesBurned: 777 }, // before the six months
    ];
    const runs = [{ startTime: iso(at(2026, 11, 5)), calories: 500 }, { startTime: iso(at(2026, 12, 5)), calories: 900 }]; // the second has not happened yet
    const totals = monthlyTotals({ workouts, runs, now: NOW });
    const nov = totals[5];
    expect(nov).toMatchObject({ workouts: 2, runs: 1, sessions: 3, calories: 1000 });
    expect(totals[4]).toMatchObject({ workouts: 1, runs: 0, sessions: 1, calories: 100 });
    expect(totals.slice(0, 4).every((m) => m.sessions === 0 && m.calories === 0)).toBe(true);
  });

  it('keeps the months the caller asks for', () => {
    expect(monthlyTotals({ now: NOW, months: 3 }).map((m) => m.label)).toEqual(['Sep', 'Oct', 'Nov']);
  });
});

describe('niceMax', () => {
  it('rounds up to a tidy top for a bar chart', () => {
    expect([0, -3, NaN, undefined].map(niceMax)).toEqual([4, 4, 4, 4]);
    expect([1, 2, 3, 4, 5, 7, 9, 10].map(niceMax)).toEqual([1, 2, 3, 4, 5, 8, 10, 10]);
    expect([11, 14, 21, 35, 61].map(niceMax)).toEqual([15, 15, 30, 40, 80]);
    expect([950, 1840, 3400, 12500].map(niceMax)).toEqual([1000, 2000, 4000, 15000]);
  });

  it('never goes below the biggest bar', () => {
    for (let n = 1; n <= 5000; n += 7) expect(niceMax(n)).toBeGreaterThanOrEqual(n);
  });
});

describe('versusLastMonth and bestMonth', () => {
  it('versusLastMonth', () => {
    expect(versusLastMonth(5, 3)).toBe('+2 vs last month');
    expect(versusLastMonth(3, 5)).toBe('-2 vs last month');
    expect(versusLastMonth(4, 4)).toBe('Same as last month');
    expect(versusLastMonth(12000, 1000)).toBe('+11,000 vs last month');
  });

  it('bestMonth is the month with the most, the latest on a tie, and none when every month is empty', () => {
    const totals = [{ label: 'Sep', sessions: 4, calories: 0 }, { label: 'Oct', sessions: 9, calories: 0 }, { label: 'Nov', sessions: 9, calories: 0 }];
    expect(bestMonth(totals, 'sessions').label).toBe('Nov');
    expect(bestMonth(totals, 'calories')).toBeNull();
    expect(bestMonth([], 'sessions')).toBeNull();
    expect(bestMonth(null, 'sessions')).toBeNull();
  });
});
