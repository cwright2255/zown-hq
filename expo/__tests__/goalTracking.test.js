// Goals on the Progress tab: kept by hand, or counted by the app from workouts, runs and calories over this week or this month.
import {
  GOAL_METRICS, GOAL_PERIODS, goalFormValues, goalSections, goalView, isTracked, parseGoalForm, periodStart, trackedGoalUpdates, trackedProgress,
} from '../lib/goalTracking';

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const NOW = at(2026, 11, 23, 21, 40); // Monday 23 Nov 2026
const iso = (date) => date.toISOString();

const workouts = [
  { completedAt: iso(at(2026, 11, 23, 8)), caloriesBurned: 300 },
  { completedAt: iso(at(2026, 11, 22, 23)), caloriesBurned: 100 }, // Sunday night: last week, this month
  { completedAt: iso(at(2026, 11, 2)), caloriesBurned: 200 },
  { completedAt: iso(at(2026, 10, 31, 23)), caloriesBurned: 999 }, // last month
  { completedAt: iso(at(2026, 11, 24, 8)), caloriesBurned: 999 }, // has not happened yet
];
const runs = [
  { startTime: iso(at(2026, 11, 23, 7)), distance: 5, calories: 450 },
  { startTime: iso(at(2026, 11, 10, 7)), distance: 3.2, calories: 300 },
  { startTime: iso(at(2026, 10, 10, 7)), distance: 10, calories: 900 },
];
const activity = { workouts, runs, now: NOW };
const goal = (extra) => ({ id: 'g1', title: 'Goal', target: 3, unit: '', current: 0, completed: false, ...extra });

describe('what a goal can count', () => {
  it('has workouts, run distance and calories, over a week or a month', () => {
    expect(Object.keys(GOAL_METRICS)).toEqual(['workouts', 'runDistance', 'calories']);
    expect(Object.keys(GOAL_PERIODS)).toEqual(['week', 'month']);
  });

  it('isTracked needs both a metric and a period it knows', () => {
    expect(isTracked(goal({ metric: 'workouts', period: 'week' }))).toBe(true);
    expect(isTracked(goal({ metric: 'calories', period: 'month' }))).toBe(true);
    expect(isTracked(goal({ metric: 'workouts' }))).toBe(false);
    expect(isTracked(goal({ period: 'week' }))).toBe(false);
    expect(isTracked(goal({ metric: 'steps', period: 'week' }))).toBe(false);
    expect(isTracked(goal({ metric: null, period: null }))).toBe(false);
    expect(isTracked(null)).toBe(false);
  });
});

describe('periodStart', () => {
  it('is Monday midnight for a week, whatever day it is', () => {
    expect(periodStart('week', NOW)).toEqual(at(2026, 11, 23, 0));
    expect(periodStart('week', at(2026, 11, 26, 15))).toEqual(at(2026, 11, 23, 0)); // Thursday
    expect(periodStart('week', at(2026, 11, 22, 15))).toEqual(at(2026, 11, 16, 0)); // Sunday
  });

  it('is the 1st for a month', () => {
    expect(periodStart('month', NOW)).toEqual(at(2026, 11, 1, 0));
  });
});

describe('trackedProgress', () => {
  it('is null for a goal kept by hand', () => {
    expect(trackedProgress(goal({}), activity)).toBeNull();
    expect(trackedProgress(null, activity)).toBeNull();
  });

  it('counts workouts this week and this month, and not ones that have not happened', () => {
    expect(trackedProgress(goal({ metric: 'workouts', period: 'week' }), activity)).toBe(1);
    expect(trackedProgress(goal({ metric: 'workouts', period: 'month' }), activity)).toBe(3);
  });

  it('adds up the calories of workouts and runs together', () => {
    expect(trackedProgress(goal({ metric: 'calories', period: 'week' }), activity)).toBe(750);
    expect(trackedProgress(goal({ metric: 'calories', period: 'month' }), activity)).toBe(300 + 100 + 200 + 450 + 300);
  });

  it('adds up the distance run, kept in kilometres, in the goal\'s own unit', () => {
    expect(trackedProgress(goal({ metric: 'runDistance', period: 'month', unit: 'km' }), activity)).toBe(8.2);
    expect(trackedProgress(goal({ metric: 'runDistance', period: 'month', unit: 'mi' }), activity)).toBe(5.1);
    expect(trackedProgress(goal({ metric: 'runDistance', period: 'week', unit: 'km' }), activity)).toBe(5);
  });

  it('counts a run by when it ended, and is not fooled by bad records', () => {
    const odd = {
      workouts: [null, {}, { completedAt: 'never', caloriesBurned: 5 }],
      runs: [{ startTime: iso(at(2026, 11, 22, 23, 30)), endTime: iso(at(2026, 11, 23, 0, 20)), distance: -4, calories: 'lots' }, { startTime: iso(at(2026, 11, 23, 6)), distance: 'far', calories: 80 }],
      now: NOW,
    };
    expect(trackedProgress(goal({ metric: 'runDistance', period: 'week', unit: 'km' }), odd)).toBe(0);
    expect(trackedProgress(goal({ metric: 'calories', period: 'week' }), odd)).toBe(80);
    expect(trackedProgress(goal({ metric: 'workouts', period: 'week' }), odd)).toBe(0);
  });

  it('is zero with no records at all', () => {
    expect(trackedProgress(goal({ metric: 'workouts', period: 'week' }), { now: NOW })).toBe(0);
    expect(trackedProgress(goal({ metric: 'workouts', period: 'week' }))).toBe(0);
  });
});

describe('goalView', () => {
  it('shows a goal kept by hand: how far, how much is left', () => {
    expect(goalView(goal({ title: 'Lose 10 lbs', current: 4, target: 10, unit: 'lbs' }), activity)).toEqual({
      id: 'g1', title: 'Lose 10 lbs', tag: '', current: 4, target: 10, unit: 'lbs', percent: 40, done: false, tracked: false,
      detail: '6 lbs to go', progressLine: '4/10 lbs (40%)',
    });
  });

  it('is complete when marked complete, or when the progress reaches the target', () => {
    expect(goalView(goal({ current: 3, target: 10, completed: true }))).toMatchObject({ done: true, detail: 'Complete', percent: 30 });
    expect(goalView(goal({ current: 10, target: 10 }))).toMatchObject({ done: true, detail: 'Complete', percent: 100 });
  });

  it('shows a tracked goal from the records, not the stored number', () => {
    expect(goalView(goal({ metric: 'workouts', period: 'week', current: 99 }), activity)).toMatchObject({
      tag: 'Workouts · This week', current: 1, percent: 33, done: false, tracked: true, unit: 'workouts', detail: '2 workouts to go', progressLine: '1/3 workouts (33%)',
    });
  });

  it('says "workout" for exactly one, and "workouts" for every other number', () => {
    expect(goalView(goal({ metric: 'workouts', period: 'week', target: 2 }), activity)).toMatchObject({ detail: '1 workout to go', progressLine: '1/2 workouts (50%)' });
    expect(goalView(goal({ metric: 'workouts', period: 'week', target: 1, current: 0 }), {})).toMatchObject({ detail: '1 workout to go', progressLine: '0/1 workout (0%)' });
    expect(goalView(goal({ metric: 'workouts', period: 'week', target: 3 }), activity).detail).toBe('2 workouts to go');
    expect(goalView(goal({ unit: 'reps', current: 0, target: 1 })).detail).toBe('1 reps to go'); // a unit the person typed is left as written
  });

  it('says a tracked goal is done for the period, not for good', () => {
    const view = goalView(goal({ metric: 'workouts', period: 'month', target: 3 }), activity);
    expect(view).toMatchObject({ current: 3, done: true, percent: 100, detail: 'Done this month' });
    expect(goalView(goal({ metric: 'workouts', period: 'week', target: 1 }), activity).detail).toBe('Done this week');
  });

  it('writes distance with a decimal only when it needs one', () => {
    const view = goalView(goal({ metric: 'runDistance', period: 'month', target: 20, unit: 'mi' }), activity);
    expect(view).toMatchObject({ tag: 'Run distance · This month', current: 5.1, detail: '14.9 mi to go', progressLine: '5.1/20 mi (26%)' });
    expect(goalView(goal({ metric: 'runDistance', period: 'week', target: 5, unit: 'km' }), activity).progressLine).toBe('5/5 km (100%)');
  });

  it('copes with a goal that is missing things', () => {
    expect(goalView({ id: 'x' })).toMatchObject({ title: 'Goal', target: 0, current: 0, percent: 0, done: false, detail: '' });
    expect(goalView({ id: 'x', target: 'ten', current: 'four', title: '' })).toMatchObject({ target: 0, current: 0, title: 'Goal' });
    expect(goalView({ id: 'x', target: 10, current: -5 }).percent).toBe(0);
    expect(goalView({ id: 'x', target: 10, current: 50 }).percent).toBe(100);
  });
});

describe('goalSections', () => {
  it('splits the ones to do from the ones done and keeps the order', () => {
    const goals = [
      goal({ id: 'a', current: 1, target: 10 }),
      goal({ id: 'b', current: 10, target: 10 }),
      goal({ id: 'c', current: 2, target: 10 }),
      goal({ id: 'd', completed: true }),
    ];
    const { active, done } = goalSections(goals, activity);
    expect(active.map((g) => g.id)).toEqual(['a', 'c']);
    expect(done.map((g) => g.id)).toEqual(['b', 'd']);
  });

  it('is empty with no goals', () => {
    expect(goalSections(null)).toEqual({ active: [], done: [] });
    expect(goalSections([null, undefined])).toEqual({ active: [], done: [] });
  });
});

describe('parseGoalForm', () => {
  it('saves a goal kept by hand, trimmed', () => {
    expect(parseGoalForm({ title: '  Lose 10 lbs ', target: '10', unit: ' lbs ', current: '4' })).toEqual({
      goal: { title: 'Lose 10 lbs', target: 10, unit: 'lbs', current: 4, completed: false, metric: null, period: null },
    });
  });

  it('marks a goal kept by hand complete when its progress has reached the target', () => {
    expect(parseGoalForm({ title: 'Read', target: '10', current: '10' }).goal.completed).toBe(true);
    expect(parseGoalForm({ title: 'Read', target: '10', current: '12' }).goal.completed).toBe(true);
  });

  it('starts at nothing, and the unit may be empty', () => {
    expect(parseGoalForm({ title: 'Read', target: '10' }).goal).toMatchObject({ current: 0, unit: '', completed: false });
    expect(parseGoalForm({ title: 'Read', target: 10 }).goal.target).toBe(10);
  });

  it('asks for a name and a target above zero', () => {
    expect(parseGoalForm({ title: '   ', target: '10' })).toEqual({ error: 'Give the goal a name.' });
    expect(parseGoalForm({ target: '10' })).toEqual({ error: 'Give the goal a name.' });
    ['0', '-3', 'abc', '', undefined].forEach((target) => {
      expect(parseGoalForm({ title: 'Read', target })).toEqual({ error: 'Enter a target above zero.' });
    });
  });

  it('refuses progress that is not a number or is below zero', () => {
    expect(parseGoalForm({ title: 'Read', target: '10', current: '-1' })).toEqual({ error: 'Progress has to be zero or more.' });
    expect(parseGoalForm({ title: 'Read', target: '10', current: 'lots' })).toEqual({ error: 'Progress has to be zero or more.' });
  });

  it('saves a tracked goal with its own unit and no progress of its own', () => {
    expect(parseGoalForm({ title: 'Train', target: '3', unit: 'ignored', current: '2', metric: 'workouts', period: 'month' }).goal).toEqual({
      title: 'Train', target: 3, unit: 'workouts', current: 0, completed: false, metric: 'workouts', period: 'month',
    });
    expect(parseGoalForm({ title: 'Burn', target: '2000', metric: 'calories', period: 'week' }).goal).toMatchObject({ unit: 'cal', period: 'week' });
  });

  it('counts a tracked goal over a week when the period is missing or not one', () => {
    expect(parseGoalForm({ title: 'Train', target: '3', metric: 'workouts' }).goal.period).toBe('week');
    expect(parseGoalForm({ title: 'Train', target: '3', metric: 'workouts', period: 'decade' }).goal.period).toBe('week');
  });

  it('treats a metric it does not know as a goal kept by hand', () => {
    expect(parseGoalForm({ title: 'Read', target: '3', metric: 'steps', period: 'week', current: '1' }).goal).toMatchObject({ metric: null, period: null, current: 1 });
  });

  it('keeps a distance goal in the unit of the person\'s Settings, and an edited one in its own', () => {
    expect(parseGoalForm({ title: 'Run', target: '20', metric: 'runDistance', period: 'month' }, { units: 'imperial' }).goal.unit).toBe('mi');
    expect(parseGoalForm({ title: 'Run', target: '30', metric: 'runDistance', period: 'month' }, { units: 'metric' }).goal.unit).toBe('km');
    const existing = { id: 'g', metric: 'runDistance', period: 'month', unit: 'km', target: 30 };
    expect(parseGoalForm({ title: 'Run', target: '40', metric: 'runDistance', period: 'month' }, { units: 'imperial', existing }).goal.unit).toBe('km');
  });

  it('keeps the progress of the goal being edited when the field is left empty', () => {
    expect(parseGoalForm({ title: 'Read', target: '10', current: '' }, { existing: { current: 4 } }).goal.current).toBe(4);
    expect(parseGoalForm({ title: 'Read', target: '10', current: '6' }, { existing: { current: 4 } }).goal.current).toBe(6);
  });
});

describe('goalFormValues', () => {
  it('starts a new goal empty, over a week', () => {
    expect(goalFormValues(null)).toEqual({ title: '', target: '', unit: '', current: '', metric: '', period: 'week' });
  });

  it('fills the form from a goal kept by hand', () => {
    expect(goalFormValues(goal({ title: 'Read', target: 10, unit: 'books', current: 4 }))).toEqual({
      title: 'Read', target: '10', unit: 'books', current: '4', metric: '', period: 'week',
    });
  });

  it('fills the form from a tracked goal, with no progress to edit', () => {
    expect(goalFormValues(goal({ metric: 'workouts', period: 'month', unit: 'workouts', current: 2 }))).toMatchObject({ metric: 'workouts', period: 'month', current: '' });
  });
});

describe('trackedGoalUpdates', () => {
  it('lists the tracked goals whose stored number is out of date', () => {
    const goals = [
      goal({ id: 'a', metric: 'workouts', period: 'week', current: 0 }), // really 1
      goal({ id: 'b', metric: 'workouts', period: 'month', current: 3 }), // already right
      goal({ id: 'c', current: 0 }), // by hand: left alone
      goal({ id: 'd', metric: 'calories', period: 'week', current: '750' }), // a stored text number that is right
    ];
    expect(trackedGoalUpdates(goals, activity)).toEqual([{ id: 'a', current: 1 }]);
  });

  it('brings a stale weekly goal back to zero when a new week has begun', () => {
    expect(trackedGoalUpdates([goal({ id: 'a', metric: 'workouts', period: 'week', current: 4 })], { workouts, runs, now: at(2026, 11, 30, 9) })).toEqual([{ id: 'a', current: 0 }]);
  });

  it('skips a goal with no id and a list that is not one', () => {
    expect(trackedGoalUpdates([goal({ id: '', metric: 'workouts', period: 'week' }), null], activity)).toEqual([]);
    expect(trackedGoalUpdates(null, activity)).toEqual([]);
  });
});
