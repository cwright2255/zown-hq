// lib/goalTracking.js
//
// Goals on the Progress tab. A goal is either kept by hand (the person says how far along it is) or tracked by the app: a number of
// workouts, a distance run, or calories burned, counted over this week or this month from the records the app already holds. This file
// is everything about that which is not a picture: what a goal looks like right now, what a goal form may save, and which tracked goals
// have a stored number that needs bringing up to date. Pure functions, no React, no stores, no Firebase.
//
// A tracked goal repeats: "3 workouts this week" is a new goal every Monday, so it is never marked complete for good, it is "Done this
// week". A goal kept by hand is complete when its progress reaches the target.
import { KM_PER_MILE, distanceUnitLabel } from './distanceUnits';
import { timedRuns, timedWorkouts } from './progressInsights';
import { startOfWeek } from './workoutWeek';

export const GOAL_METRICS = {
  workouts: { label: 'Workouts', unit: 'workouts' },
  runDistance: { label: 'Run distance', unit: null }, // 'mi' or 'km', whichever the person's Settings use when the goal is made
  calories: { label: 'Calories burned', unit: 'cal' },
};
export const GOAL_PERIODS = {
  week: { label: 'This week' },
  month: { label: 'This month' },
};

const num = (value) => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const show = (n) => String(round1(n));
/** " workouts", or " workout" for exactly one; any other unit as it is. */
const unitAfter = (unit, n) => (unit ? ` ${unit === 'workouts' && round1(n) === 1 ? 'workout' : unit}` : '');

/** Whether the app tracks this goal from the person's records. */
export const isTracked = (goal) => Boolean(goal && GOAL_METRICS[goal.metric] && GOAL_PERIODS[goal.period]);

/** When a goal's period began: Monday 00:00 for a week, the 1st for a month (local time). */
export function periodStart(period, now = new Date()) {
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return startOfWeek(now);
}

/**
 * How far a tracked goal is, from the records: a count, a distance in the goal's own unit, or calories. Null for a goal kept by hand.
 * @param {object} activity { workouts, runs, now }
 */
export function trackedProgress(goal, { workouts, runs, now = new Date() } = {}) {
  if (!isTracked(goal)) return null;
  const from = periodStart(goal.period, now).getTime();
  const inPeriod = (list) => list.filter((r) => r.ms >= from && r.ms <= now.getTime());
  const w = inPeriod(timedWorkouts(workouts));
  const r = inPeriod(timedRuns(runs));
  if (goal.metric === 'workouts') return w.length;
  if (goal.metric === 'calories') {
    const sum = (list, key) => list.reduce((total, x) => total + Math.max(0, num(x.item[key]) || 0), 0);
    return Math.round(sum(w, 'caloriesBurned') + sum(r, 'calories'));
  }
  // Runs keep their distance in kilometres.
  const km = r.reduce((total, x) => total + Math.max(0, num(x.item.distance) || 0), 0);
  return round1(goal.unit === 'mi' ? km / KM_PER_MILE : km);
}

/**
 * A goal as the screen draws it: { id, title, tag, current, target, unit, percent, done, tracked, detail, progressLine }.
 *   tag           what a tracked goal counts and over when ("Workouts · This week"), empty for a goal kept by hand
 *   done          the target is reached (for a tracked goal, in this period)
 *   detail        "3 workouts to go", "Complete" or "Done this week"
 *   progressLine  "2/3 workouts (67%)"
 */
export function goalView(goal, activity = {}) {
  const tracked = isTracked(goal);
  const target = Math.max(0, num(goal.target) || 0);
  const current = tracked ? trackedProgress(goal, activity) : Math.max(0, num(goal.current) || 0);
  const percent = target > 0 ? clamp(Math.round((current / target) * 100), 0, 100) : 0;
  const reached = target > 0 && current >= target;
  const done = tracked ? reached : Boolean(goal.completed) || reached;
  const unit = tracked && !goal.unit ? GOAL_METRICS[goal.metric].unit || '' : goal.unit || '';
  let detail = '';
  if (done) detail = tracked ? `Done ${GOAL_PERIODS[goal.period].label.toLowerCase()}` : 'Complete';
  else if (target > 0) detail = `${show(target - current)}${unitAfter(unit, target - current)} to go`;
  return {
    id: goal.id,
    title: String(goal.title || 'Goal'),
    tag: tracked ? `${GOAL_METRICS[goal.metric].label} · ${GOAL_PERIODS[goal.period].label}` : '',
    current,
    target,
    unit,
    percent,
    done,
    tracked,
    detail,
    progressLine: `${show(current)}/${show(target)}${unitAfter(unit, target)} (${percent}%)`,
  };
}

/** The goals as views, split into the ones still to do and the ones done, each in the order the store keeps them (newest first). */
export function goalSections(goals, activity = {}) {
  const views = (Array.isArray(goals) ? goals : []).filter(Boolean).map((g) => goalView(g, activity));
  return { active: views.filter((v) => !v.done), done: views.filter((v) => v.done) };
}

/**
 * What a goal form may save. `values` are the form's text fields: title, target, unit, current, metric ('workouts' | 'runDistance' |
 * 'calories' | '' for by hand) and period. Returns { goal } with the fields to store, or { error } with what to tell the person.
 * `existing` is the goal being edited: its progress is kept when the field is left empty, and a distance goal keeps its unit.
 */
export function parseGoalForm(values = {}, { units = 'imperial', existing = null } = {}) {
  const title = String(values.title || '').trim();
  if (!title) return { error: 'Give the goal a name.' };
  const target = typeof values.target === 'number' ? values.target : parseFloat(values.target);
  if (!Number.isFinite(target) || target <= 0) return { error: 'Enter a target above zero.' };

  const metric = GOAL_METRICS[values.metric] ? values.metric : null;
  const period = metric ? (GOAL_PERIODS[values.period] ? values.period : 'week') : null;

  let unit;
  if (metric === 'runDistance') unit = existing && existing.metric === 'runDistance' && existing.unit ? existing.unit : distanceUnitLabel(units);
  else if (metric) unit = GOAL_METRICS[metric].unit;
  else unit = String(values.unit || '').trim();

  let current = 0;
  if (!metric) {
    const typed = values.current === undefined || values.current === null || String(values.current).trim() === '';
    current = typed ? (existing ? Math.max(0, num(existing.current) || 0) : 0) : parseFloat(values.current);
    if (!Number.isFinite(current) || current < 0) return { error: 'Progress has to be zero or more.' };
  }
  return { goal: { title, target, unit, current, completed: !metric && current >= target, metric, period } };
}

/** The goal as the form starts: text for each field. */
export function goalFormValues(goal) {
  if (!goal) return { title: '', target: '', unit: '', current: '', metric: '', period: 'week' };
  return {
    title: String(goal.title || ''),
    target: goal.target == null ? '' : String(goal.target),
    unit: goal.unit || '',
    current: isTracked(goal) || goal.current == null ? '' : String(goal.current),
    metric: isTracked(goal) ? goal.metric : '',
    period: isTracked(goal) ? goal.period : 'week',
  };
}

/**
 * The tracked goals whose stored number is not what the records say now: [{ id, current }]. The calendar and the Coach read the stored
 * number, so the Progress tab brings it up to date whenever it is open.
 */
export function trackedGoalUpdates(goals, activity = {}) {
  const out = [];
  (Array.isArray(goals) ? goals : []).forEach((goal) => {
    if (!goal || !goal.id || !isTracked(goal)) return;
    const live = trackedProgress(goal, activity);
    if (live !== null && live !== num(goal.current)) out.push({ id: goal.id, current: live });
  });
  return out;
}
