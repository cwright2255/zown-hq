// The Progress tab, whole: This Week, Weight, Body Scans, Goals, Measurements and the month, fed from the stores, and what each button does
// (log a weight, set a target, add, edit, complete and delete a goal). The data is the screen as it was found: one 230 lbs weigh-in from
// August, a 181 lb target and two body scans, on Monday 23 Nov 2026.
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args) => mockPush(...args), canGoBack: () => false } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Line: 'Line' }), { virtual: true });
jest.mock('@/components/ScanMeshPreview', () => ({ __esModule: true, default: 'ScanMeshPreview' }));
jest.mock('@/src/components/LoadingSkeleton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/src/components/EmptyState', () => ({ __esModule: true, default: () => null }));

const mockHealth = { loadAllHealth: jest.fn() };
jest.mock('@/store/healthStore', () => ({ useHealthStore: () => mockHealth }));
const mockUser = { user: null, updateUser: jest.fn(), saveProfile: jest.fn() };
jest.mock('@/store/userStore', () => ({ useUserStore: () => mockUser }));
const mockBody = { scans: [], loadScans: jest.fn() };
jest.mock('@/store/bodyCompositionStore', () => ({ useBodyCompositionStore: () => mockBody }));
const mockGoals = { goals: [], loadGoals: jest.fn(), addGoal: jest.fn(), updateGoal: jest.fn(), updateGoalProgress: jest.fn(), deleteGoal: jest.fn() };
jest.mock('@/store/goalsStore', () => ({ useGoalsStore: () => mockGoals }));
const mockWorkouts = { completedWorkouts: [] };
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => mockWorkouts }));
const mockRuns = { runs: [] };
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => mockRuns }));
const mockWeight = { logs: [], loadLogs: jest.fn(), addLog: jest.fn() };
jest.mock('@/store/weightLogStore', () => ({ useWeightLogStore: () => mockWeight }));
const mockHikes = { completedHikes: [] };
jest.mock('@/store/hikingStore', () => ({ useHikingStore: (select) => select(mockHikes) }));
const mockSettings = { units: 'imperial' };
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: (select) => select(mockSettings) }));
const mockExp = { level: 24, toNext: 1244.6 };
jest.mock('@/store/expStore', () => ({ useExpStore: () => ({ getLevel: () => mockExp.level, getExpToNextLevel: () => mockExp.toNext }) }));
const mockStreak = { current: 0, longest: 0 };
jest.mock('@/services/streakService', () => ({ useActivityStreak: () => mockStreak }));

import ProgressScreen from '../app/progress';
import { LEVEL_CAP } from '../lib/xpRules';

const NOW = new Date(2026, 10, 23, 21, 40);
const AUG = { id: 'w1', weightKg: 104.3, createdAtLocal: new Date(2026, 7, 12, 9, 30).toISOString() };
const scan = (id, date, measurements = {}) => ({ id, createdAtLocal: date.toISOString(), bodyFatPercent: 24.2, weightKg: 104.3, bmi: 35, measurements });
const TWO_SCANS = [
  scan('aug', new Date(2026, 7, 12, 10), { waistCircumferenceCm: 100, hipCircumferenceCm: 110, shoulderWidthCm: 45 }),
  scan('nov', new Date(2026, 10, 23, 10), { waistCircumferenceCm: 98.5, hipCircumferenceCm: 110, shoulderWidthCm: 45 }),
];
const HAND = { id: 'hand', title: 'Lose 10 lbs', target: 10, unit: 'lbs', current: 4, completed: false };
const WEEKLY = { id: 'weekly', title: '3 workouts a week', target: 3, unit: 'workouts', current: 0, metric: 'workouts', period: 'week' };
const workout = (d, cal = 300) => ({ completedAt: new Date(2026, 10, d, 8).toISOString(), caloriesBurned: cal });

const text = (el) => [el.props.children].flat().join('');
// Every testID on the screen, in the order it is drawn.
function idsInOrder(tree) {
  const out = [];
  const walk = (node) => {
    if (!node || typeof node === 'string') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.props && node.props.testID) out.push(node.props.testID);
    walk(node.children);
  };
  walk(tree);
  return out;
}

let alertSpy;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  [mockHealth.loadAllHealth, mockUser.updateUser, mockUser.saveProfile, mockBody.loadScans, mockWeight.loadLogs, mockWeight.addLog,
    mockGoals.loadGoals, mockGoals.addGoal, mockGoals.updateGoal, mockGoals.updateGoalProgress, mockGoals.deleteGoal, mockPush].forEach((fn) => fn.mockReset());
  mockGoals.addGoal.mockResolvedValue(undefined);
  mockGoals.updateGoal.mockResolvedValue(undefined);
  mockGoals.updateGoalProgress.mockResolvedValue(undefined);
  mockGoals.deleteGoal.mockResolvedValue(undefined);
  mockWeight.addLog.mockResolvedValue(undefined);
  mockUser.user = { uid: 'u1', targetWeightKg: 82.1, weightKg: 104.3 };
  mockBody.scans = TWO_SCANS;
  mockGoals.goals = [HAND];
  mockWorkouts.completedWorkouts = [];
  mockRuns.runs = [];
  mockHikes.completedHikes = [];
  mockWeight.logs = [AUG];
  mockSettings.units = 'imperial';
  mockExp.level = 24;
  mockExp.toNext = 1244.6;
  mockStreak.current = 0;
});
afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

describe('the page', () => {
  it('shows the sections in order: week, weight, scans, goals, measurements, the month', () => {
    const utils = render(<ProgressScreen />);
    const ids = idsInOrder(utils.toJSON());
    const at = (id) => ids.indexOf(id);
    const order = ['progress-week', 'progress-weight', 'progress-scans', 'progress-goals', 'progress-month'].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(utils.getByText('Progress')).toBeTruthy();
    expect(utils.getByText('Measurements')).toBeTruthy();
    expect(utils.getByText('November Summary')).toBeTruthy();
  });

  it('shows the person\'s weight with its age, how far to the target, and the latest scan with no change', () => {
    const { getByTestId } = render(<ProgressScreen />);
    expect(text(getByTestId('weight-current'))).toBe('230 lbs');
    expect(text(getByTestId('weight-freshness'))).toBe('Logged Aug 12 · 3 months ago');
    expect(text(getByTestId('weight-togo'))).toBe('49 lbs to go');
    expect(text(getByTestId('scan-bodyFat'))).toBe('24.2%');
    expect(text(getByTestId('scan-bodyFat-change'))).toBe('No change');
  });

  it('fills the week from the workouts and runs, and the streak from the streak service', () => {
    mockWorkouts.completedWorkouts = [workout(23, 300)];
    mockRuns.runs = [{ startTime: new Date(2026, 10, 23, 7).toISOString(), distance: 5, calories: 450 }];
    mockStreak.current = 6;
    const { getByTestId } = render(<ProgressScreen />);
    expect(text(getByTestId('week-workouts'))).toBe('1');
    expect(text(getByTestId('week-runs'))).toBe('1');
    expect(text(getByTestId('week-calories'))).toBe('750');
    expect(text(getByTestId('week-streak'))).toBe('6');
    expect(getByTestId('week-day-2026-11-23').props.accessibilityLabel).toBe('Monday, today: trained');
  });

  it('shows the level and what is left to the next one', () => {
    const { getByTestId } = render(<ProgressScreen />);
    expect(text(getByTestId('month-level'))).toBe('24');
    expect(text(getByTestId('month-level-line'))).toBe('1,245 XP to Level 25');
  });

  it('says "Top level" at the level cap', () => {
    mockExp.level = LEVEL_CAP;
    mockExp.toNext = 0;
    expect(text(render(<ProgressScreen />).getByTestId('month-level-line'))).toBe('Top level');
  });

  it('keeps the Measurements card: waist, hip and shoulder with what changed, in cm', () => {
    const { getByText } = render(<ProgressScreen />);
    expect(getByText('Waist')).toBeTruthy();
    expect(getByText('98.5 cm')).toBeTruthy();
    expect(getByText('↓ 1.5 cm')).toBeTruthy();
    expect(getByText('Shoulder width')).toBeTruthy();
  });

  it('says there is no scan yet, in Measurements and in the scans card', () => {
    mockBody.scans = [];
    const { getByText, getByTestId } = render(<ProgressScreen />);
    expect(getByText('No scan yet.')).toBeTruthy();
    expect(getByTestId('scan-empty')).toBeTruthy();
  });

  it('asks for the data it does not have yet, for the person who is signed in', () => {
    mockBody.scans = [];
    mockGoals.goals = [];
    mockWeight.logs = [];
    render(<ProgressScreen />);
    expect(mockBody.loadScans).toHaveBeenCalledWith('u1');
    expect(mockGoals.loadGoals).toHaveBeenCalledWith('u1');
    expect(mockWeight.loadLogs).toHaveBeenCalledWith('u1');
  });

  it('asks for nothing it already has, and nothing when nobody is signed in', () => {
    render(<ProgressScreen />);
    expect(mockBody.loadScans).not.toHaveBeenCalled();
    expect(mockWeight.loadLogs).not.toHaveBeenCalled();
    mockUser.user = null;
    mockGoals.goals = [];
    render(<ProgressScreen />);
    expect(mockGoals.loadGoals).not.toHaveBeenCalled();
  });
});

describe('logging a weight', () => {
  const open = () => {
    const utils = render(<ProgressScreen />);
    fireEvent.press(utils.getByTestId('weight-log'));
    return utils;
  };

  it('opens the Log Weight prompt from the card header, and saves the weight in kilograms', async () => {
    const { getByText, getByPlaceholderText, queryByText } = open();
    expect(getByText('Enter your current weight (lbs)')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('e.g. 175'), '228');
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(mockWeight.addLog).toHaveBeenCalledWith('u1', 103.4));
    expect(mockUser.updateUser).toHaveBeenCalledWith({ weightKg: 103.4 });
    expect(mockUser.saveProfile).toHaveBeenCalledWith('u1');
    await waitFor(() => expect(queryByText('Enter your current weight (lbs)')).toBeNull());
  });

  it('goes on to ask for a target when there is none', async () => {
    mockUser.user = { uid: 'u1', targetWeightKg: null };
    const { getByText, getByPlaceholderText } = open();
    fireEvent.changeText(getByPlaceholderText('e.g. 175'), '228');
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(getByText('What weight are you working towards? (lbs)')).toBeTruthy());
  });

  it('refuses a weight that is not a number', async () => {
    const { getByText, getByPlaceholderText } = open();
    fireEvent.changeText(getByPlaceholderText('e.g. 175'), 'heavy');
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Invalid weight', 'Please enter a number.'));
    expect(mockWeight.addLog).not.toHaveBeenCalled();
  });

  it('says so when the weight could not be saved', async () => {
    mockWeight.addLog.mockRejectedValue(new Error('Offline'));
    const { getByText, getByPlaceholderText } = open();
    fireEvent.changeText(getByPlaceholderText('e.g. 175'), '228');
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't log weight", 'Offline'));
    expect(mockUser.updateUser).not.toHaveBeenCalled();
  });

  it('sets the target from the target line, in kilograms', async () => {
    const { getByTestId, getByText, getByPlaceholderText } = render(<ProgressScreen />);
    fireEvent.press(getByTestId('weight-target-edit'));
    fireEvent.changeText(getByPlaceholderText('e.g. 170'), '175');
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(mockUser.updateUser).toHaveBeenCalledWith({ targetWeightKg: 79.4 }));
    expect(mockUser.saveProfile).toHaveBeenCalledWith('u1');
  });
});

describe('goals', () => {
  it('adds a goal for the signed-in person, from the Add Goal link', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<ProgressScreen />);
    fireEvent.press(getByTestId('goal-add'));
    expect(getByText('New Goal')).toBeTruthy();
    fireEvent.changeText(getByTestId('goal-title'), '3 runs a week');
    fireEvent.press(getByTestId('goal-track-workouts'));
    fireEvent.changeText(getByTestId('goal-target'), '3');
    fireEvent.press(getByTestId('goal-save'));
    await waitFor(() => expect(mockGoals.addGoal).toHaveBeenCalledTimes(1));
    expect(mockGoals.addGoal).toHaveBeenCalledWith({ uid: 'u1', title: '3 runs a week', target: 3, unit: 'workouts', current: 0, completed: false, metric: 'workouts', period: 'week' });
    expect(mockGoals.updateGoal).not.toHaveBeenCalled();
    await waitFor(() => expect(queryByTestId('goal-editor')).toBeNull());
  });

  it('keeps the form open, with the reason, when the goal could not be saved', async () => {
    mockGoals.addGoal.mockRejectedValue(new Error('Not signed in'));
    const { getByTestId } = render(<ProgressScreen />);
    fireEvent.press(getByTestId('goal-add'));
    fireEvent.changeText(getByTestId('goal-title'), 'Run');
    fireEvent.changeText(getByTestId('goal-target'), '3');
    fireEvent.press(getByTestId('goal-save'));
    await waitFor(() => expect(text(getByTestId('goal-error'))).toBe('Not signed in'));
    expect(getByTestId('goal-editor')).toBeTruthy();
  });

  it('edits a goal in place', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<ProgressScreen />);
    fireEvent.press(getByTestId('goal-edit-hand'));
    expect(getByText('Edit Goal')).toBeTruthy();
    expect(getByTestId('goal-title').props.value).toBe('Lose 10 lbs');
    fireEvent.changeText(getByTestId('goal-current'), '6');
    fireEvent.press(getByTestId('goal-save'));
    await waitFor(() => expect(mockGoals.updateGoal).toHaveBeenCalledTimes(1));
    expect(mockGoals.updateGoal).toHaveBeenCalledWith('hand', { title: 'Lose 10 lbs', target: 10, unit: 'lbs', current: 6, completed: false, metric: null, period: null });
    expect(mockGoals.addGoal).not.toHaveBeenCalled();
    await waitFor(() => expect(queryByTestId('goal-editor')).toBeNull());
  });

  it('closes the form without saving when it is cancelled', () => {
    const { getByTestId, queryByTestId } = render(<ProgressScreen />);
    fireEvent.press(getByTestId('goal-edit-hand'));
    fireEvent.press(getByTestId('goal-cancel'));
    expect(queryByTestId('goal-editor')).toBeNull();
    expect(mockGoals.updateGoal).not.toHaveBeenCalled();
  });

  it('marks a goal complete, with the progress at the target', async () => {
    const { getByTestId } = render(<ProgressScreen />);
    fireEvent.press(getByTestId('goal-complete-hand'));
    await waitFor(() => expect(mockGoals.updateGoal).toHaveBeenCalledWith('hand', { completed: true, current: 10 }));
  });

  it('has no Mark complete on a goal whose progress already reached the target: it is done', () => {
    mockGoals.goals = [{ ...HAND, current: 12 }];
    const { queryByTestId, getByTestId } = render(<ProgressScreen />);
    expect(queryByTestId('goal-complete-hand')).toBeNull();
    expect(getByTestId('goals-done')).toBeTruthy();
  });

  it('says so when a goal could not be completed', async () => {
    mockGoals.updateGoal.mockRejectedValue(new Error('Offline'));
    fireEvent.press(render(<ProgressScreen />).getByTestId('goal-complete-hand'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't update goal", 'Offline'));
  });

  it('asks before deleting, and deletes only when told to', async () => {
    const { getByTestId } = render(<ProgressScreen />);
    fireEvent.press(getByTestId('goal-delete-hand'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Delete goal');
    expect(message).toBe('Delete "Lose 10 lbs"? This can\'t be undone.');
    expect(buttons.map((b) => [b.text, b.style])).toEqual([['Cancel', 'cancel'], ['Delete', 'destructive']]);
    expect(mockGoals.deleteGoal).not.toHaveBeenCalled();
    await act(async () => { await buttons[1].onPress(); });
    expect(mockGoals.deleteGoal).toHaveBeenCalledWith('hand');
  });

  it('says so when a goal could not be deleted', async () => {
    mockGoals.deleteGoal.mockRejectedValue(new Error('Offline'));
    const { getByTestId } = render(<ProgressScreen />);
    fireEvent.press(getByTestId('goal-delete-hand'));
    await act(async () => { await alertSpy.mock.calls[0][2][1].onPress(); });
    expect(alertSpy).toHaveBeenLastCalledWith("Couldn't delete goal", 'Offline');
  });

  it('counts a goal from the workouts done this week, not from the number stored', () => {
    mockGoals.goals = [{ ...WEEKLY, current: 99 }];
    mockWorkouts.completedWorkouts = [workout(23), workout(22), workout(1)];
    const { getByTestId } = render(<ProgressScreen />);
    expect(text(getByTestId('goal-progress-weekly'))).toBe('1/3 workouts (33%)');
    expect(text(getByTestId('goal-tag-weekly'))).toBe('Workouts · This week');
  });
});

describe('keeping a counted goal\'s stored number up to date', () => {
  it('writes what the records say, once, for a goal the app counts', async () => {
    mockGoals.goals = [HAND, WEEKLY];
    mockWorkouts.completedWorkouts = [workout(23)];
    const { rerender } = render(<ProgressScreen />);
    await waitFor(() => expect(mockGoals.updateGoalProgress).toHaveBeenCalledWith('weekly', 1));
    expect(mockGoals.updateGoalProgress).toHaveBeenCalledTimes(1); // not the goal kept by hand
    mockGoals.goals = [HAND, { ...WEEKLY }];
    rerender(<ProgressScreen />);
    expect(mockGoals.updateGoalProgress).toHaveBeenCalledTimes(1); // the same number is not written again
  });

  it('writes nothing when the stored number is already right', () => {
    mockGoals.goals = [{ ...WEEKLY, current: 1 }];
    mockWorkouts.completedWorkouts = [workout(23)];
    render(<ProgressScreen />);
    expect(mockGoals.updateGoalProgress).not.toHaveBeenCalled();
  });

  it('writes the new number when another workout is done', async () => {
    mockGoals.goals = [WEEKLY];
    mockWorkouts.completedWorkouts = [workout(23)];
    const { rerender } = render(<ProgressScreen />);
    await waitFor(() => expect(mockGoals.updateGoalProgress).toHaveBeenCalledWith('weekly', 1));
    mockWorkouts.completedWorkouts = [workout(23), workout(23, 200)];
    mockGoals.goals = [{ ...WEEKLY, current: 1 }];
    rerender(<ProgressScreen />);
    await waitFor(() => expect(mockGoals.updateGoalProgress).toHaveBeenLastCalledWith('weekly', 2));
  });

  it('tries again later when a write fails', async () => {
    mockGoals.goals = [WEEKLY];
    mockWorkouts.completedWorkouts = [workout(23)];
    mockGoals.updateGoalProgress.mockRejectedValueOnce(new Error('Offline'));
    const { rerender } = render(<ProgressScreen />);
    await waitFor(() => expect(mockGoals.updateGoalProgress).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    mockGoals.goals = [{ ...WEEKLY }];
    rerender(<ProgressScreen />);
    await waitFor(() => expect(mockGoals.updateGoalProgress).toHaveBeenCalledTimes(2));
  });
});
