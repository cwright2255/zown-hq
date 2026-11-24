// The Health screen: only real readings (a dash or a prompt to connect a device when there are none), each compared with the person's own
// usual when there is one, today's steps, sleep and water at the top, the Trends charts drawn from the daily record, the Body Composition
// card marked with the plan it needs and saying what changed since the last scan, pulling down to read Apple Health again, and the AI
// comment on the training load asked for once the numbers settle, only for someone signed in.
import React from 'react';
import { Text } from 'react-native';
import { act, render, fireEvent, within } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
const mockPush = jest.fn();
// Looked up when a button is pressed, not when the mock is made: the imports below run before this file's own lines do.
jest.mock('expo-router', () => ({ router: { push: (...args) => mockPush(...args), canGoBack: () => false } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
// The body map stands in as a plain view that says what it was given.
jest.mock('@/components/MuscleHeatmapCard', () => (props) => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return mockReact.createElement(mockRn.View, { testID: 'muscle-heatmap', accessibilityLabel: props.title, style: props.style });
});
// What the muscles' fatigue is, decided here.
let mockFatigue;
jest.mock('@/lib/muscleRecovery', () => ({ calculateMuscleRecovery: () => ({}), fatigueFromRecovery: () => mockFatigue }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }), { virtual: true });
jest.mock('@/services/rookService', () => ({ rookService: { getTodayRecovery: jest.fn(async () => null) } }));

const mockHealth = {
  loadAllHealth: jest.fn(), loadAppleHealthActivity: jest.fn(), loadRookRecovery: jest.fn(), syncReadings: jest.fn(),
  steps: 4200, stepsHistory: {}, sleep: { hours: 0, quality: null }, hydration: { glasses: 3, target: 8 }, rookRecovery: null, readingsHistory: {},
};
jest.mock('@/store/healthStore', () => ({ useHealthStore: () => mockHealth }));
const mockUser = { user: { uid: 'u1', name: 'Cj' } };
jest.mock('@/store/userStore', () => ({ useUserStore: () => mockUser }));
const mockBody = { scans: [], loadScans: jest.fn() };
jest.mock('@/store/bodyCompositionStore', () => ({ useBodyCompositionStore: () => mockBody }));
const mockWorkouts = { completedWorkouts: [], loadWorkouts: jest.fn(), getExerciseHistory: jest.fn(async () => []) };
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => mockWorkouts }));
const mockRuns = { runs: [], loadRuns: jest.fn() };
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => mockRuns }));
const mockHikes = { completedHikes: [], loadCompletedHikes: jest.fn() };
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => mockHikes }));
const mockWeight = { logs: [], loadLogs: jest.fn() };
jest.mock('@/store/weightLogStore', () => ({ useWeightLogStore: () => mockWeight }));
const mockSettings = { weightUnits: 'imperial' };
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: (select) => select(mockSettings) }));

// The training numbers are decided here, so a test can say what they are and when they change.
let mockLoad;
let mockDaily; // the load of each day the training load is worked out from
jest.mock('@/lib/trainingLoad', () => ({ aggregateDailyLoad: () => mockDaily, calculateTrainingLoad: () => mockLoad }));

let mockPlan;
jest.mock('@/hooks/useEntitlement', () => ({ useEntitlement: () => mockPlan }));

const mockGetInsight = jest.fn();
jest.mock('@/services/insightService', () => ({ getTrainingLoadInsight: (...args) => mockGetInsight(...args) }));

import HealthScreen from '../app/health';
import { usePremiumStore } from '../store/premiumStore';
import { INSIGHT_SETTLE_MS } from '../lib/insightCache';
import { shiftDateKey } from '../lib/localDate';
import { h, TONE_COLOR } from '../components/healthStyles';

const STEADY = { zone: 'sweet_spot', zoneLabel: 'In your typical training range', ratio: 1.1, acuteLoad: 2100, chronicWeeklyAvg: 1900 };
const HARDER = { zone: 'elevated', zoneLabel: 'Higher than usual', ratio: 1.4, acuteLoad: 2800, chronicWeeklyAvg: 2000 };
const TOO_EARLY = { zone: 'insufficient_data', zoneLabel: 'Not enough history yet', ratio: 0, acuteLoad: 0, chronicWeeklyAvg: 0 };
const APPLE = { restingHeartRate: 58, hrv: 42, sleepEfficiency: null, sleepHours: null, source: 'Apple Health' };
const PLANS = { pathname: '/paywall', params: { feature: 'bodyScan' } };
const DASH = String.fromCharCode(8212);
const pickStyle = (node, key) => [...[].concat(...[].concat(node.props.style).map((st) => (Array.isArray(st) ? st : [st]))).filter(Boolean)].reverse().find((st) => st[key] !== undefined)?.[key];

// Legend has the body scan and, as far as these tests go, nothing else: a screen that asks about a different feature is told no.
const LEGEND = { ready: true, can: (feature) => feature === 'bodyScan' };
const FREE = { ready: true, can: () => false };
const UNKNOWN_YET = { ready: false, can: () => false };

beforeEach(() => {
  jest.useFakeTimers();
  mockLoad = STEADY;
  mockDaily = {};
  mockFatigue = {};
  mockHealth.stepsHistory = {};
  mockHealth.steps = 4200;
  mockHealth.hydration = { glasses: 3, target: 8 };
  mockHealth.loadRookRecovery.mockClear();
  mockPlan = LEGEND;
  mockHealth.rookRecovery = null;
  mockHealth.readingsHistory = {};
  mockHealth.syncReadings.mockClear();
  mockWeight.logs = [];
  mockWeight.loadLogs.mockClear();
  mockSettings.weightUnits = 'imperial';
  mockUser.user = { uid: 'u1', name: 'Cj' };
  mockBody.scans = [];
  mockWorkouts.completedWorkouts = [];
  mockRuns.runs = [];
  mockHikes.completedHikes = [];
  usePremiumStore.setState({ scanCredits: 0 });
  mockPush.mockClear();
  mockHealth.loadAppleHealthActivity.mockClear();
  mockHealth.loadAllHealth.mockClear();
  mockGetInsight.mockReset();
  mockGetInsight.mockResolvedValue('A steady week.');
});
afterEach(() => { jest.useRealTimers(); });

const open = async () => {
  const utils = render(<HealthScreen />);
  await act(async () => {});
  return utils;
};
const settle = async (ms = INSIGHT_SETTLE_MS) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
// The button sits inside the card, which is a button too; its press must not reach the card as well.
const pressWithoutBubbling = (node) => {
  const stopPropagation = jest.fn();
  fireEvent.press(node, { stopPropagation });
  expect(stopPropagation).toHaveBeenCalledTimes(1);
};

describe('what the screen loads when it opens', () => {
  it('syncs the steps from Apple Health for the signed-in person, so they are saved to their account and earn their XP', async () => {
    await open();
    expect(mockHealth.loadAppleHealthActivity).toHaveBeenCalledTimes(1);
    expect(mockHealth.loadAppleHealthActivity).toHaveBeenCalledWith('u1');
  });

  it('keeps the daily record of sleep, HRV and resting heart rate up to date, and loads the weight log, for the signed-in person', async () => {
    await open();
    expect(mockHealth.syncReadings).toHaveBeenCalledTimes(1);
    expect(mockHealth.syncReadings).toHaveBeenCalledWith('u1');
    expect(mockWeight.loadLogs).toHaveBeenCalledTimes(1);
    expect(mockWeight.loadLogs).toHaveBeenCalledWith('u1');
  });

  it('loads nothing without a signed-in person', async () => {
    mockUser.user = null;
    await open();
    expect(mockHealth.loadAppleHealthActivity).not.toHaveBeenCalled();
    expect(mockHealth.loadAllHealth).not.toHaveBeenCalled();
    expect(mockHealth.syncReadings).not.toHaveBeenCalled();
    expect(mockWeight.loadLogs).not.toHaveBeenCalled();
  });
});

describe('the Trends section', () => {
  // Tuesday 20 October 2026, 3 PM in the person's own time.
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });
  const RECORD = {
    '2026-10-20': { restingHeartRate: 60, hrv: 46, sleepHours: 6.8 },
    '2026-10-19': { restingHeartRate: 58, hrv: 44, sleepHours: 7.2 },
  };

  it('comes after Today and before Wearable Sync, with the five readings', async () => {
    const { getByText, getByTestId, UNSAFE_getAllByType } = await open();
    const texts = UNSAFE_getAllByType(Text).map((node) => node.props.children).filter((c) => typeof c === 'string'); // top to bottom
    const at = (title) => texts.indexOf(title);
    expect(at('Today')).toBeGreaterThan(-1);
    expect(at('Today')).toBeLessThan(at('Trends'));
    expect(at('Trends')).toBeLessThan(at('Wearable Sync'));
    for (const id of ['steps', 'sleep', 'hrv', 'restingHeartRate', 'weight']) expect(getByTestId(`trend-${id}`)).toBeTruthy();
    expect(getByText('7 days')).toBeTruthy();
    expect(getByText('28 days')).toBeTruthy();
  });

  it('draws the daily record the phone has kept', async () => {
    mockHealth.readingsHistory = RECORD;
    mockHealth.stepsHistory = { '2026-10-20': 5000, '2026-10-19': 9000 };
    const { getByTestId } = await open();
    expect(getByTestId('trend-steps-average').props.children).toBe('7,000 steps');
    expect(getByTestId('trend-sleep-average').props.children).toBe('7.0 h');
    expect(getByTestId('trend-hrv-average').props.children).toBe('45 ms');
    expect(getByTestId('trend-restingHeartRate-average').props.children).toBe('59 bpm');
    expect(getByTestId('trend-restingHeartRate-coverage').props.children).toBe('2 of 7 days');
  });

  it('shows the weight log in pounds, or in kilograms when Settings says so', async () => {
    mockWeight.logs = [{ id: 'w1', weightKg: 80, createdAtLocal: new Date(2026, 9, 19, 8).toISOString() }];
    const pounds = await open();
    expect(pounds.getByTestId('trend-weight-average').props.children).toBe('176.4 lb');
    pounds.unmount();
    mockSettings.weightUnits = 'metric';
    const kilos = await open();
    expect(kilos.getByTestId('trend-weight-average').props.children).toBe('80.0 kg');
  });

  it('says which kind of HRV it is once the source is known', async () => {
    const before = await open();
    expect(within(before.getByTestId('trend-hrv')).getByText('HRV')).toBeTruthy();
    before.unmount();
    mockHealth.rookRecovery = APPLE;
    const apple = await open();
    expect(apple.getAllByText('HRV (SDNN)')).toHaveLength(2); // the Recovery tile and the chart
    apple.unmount();
    mockHealth.rookRecovery = { ...APPLE, source: 'WHOOP' };
    const whoop = await open();
    expect(whoop.getAllByText('HRV (RMSSD)')).toHaveLength(2);
  });

  it('says there is nothing, rather than drawing something, when nothing has been recorded', async () => {
    const { getByTestId } = await open();
    expect(getByTestId('trend-steps-empty').props.children).toBe('No step counts in the last 7 days');
    for (const id of ['sleep', 'hrv', 'restingHeartRate']) expect(getByTestId(`trend-${id}-empty`).props.children).toBe('No readings in the last 7 days');
    expect(getByTestId('trend-weight-empty').props.children).toBe('No weigh-ins in the last 7 days');
  });

  it('counts the days from today, in the person\'s own time', async () => {
    jest.setSystemTime(new Date(2026, 9, 20, 23, 59));
    mockHealth.readingsHistory = RECORD;
    const late = await open();
    expect(late.getByTestId('trend-sleep-readout').props.children).toBe('Latest, Oct 20: 6.8 h');
    late.unmount();
    jest.setSystemTime(new Date(2026, 9, 21, 0, 1));
    const next = await open();
    expect(next.getByTestId('trend-sleep-readout').props.children).toBe('Latest, Oct 20: 6.8 h');
    expect(next.getByTestId('trend-sleep-coverage').props.children).toBe('2 of 7 days');
  });
});

describe('the Readiness card', () => {
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });
  // 28 days of HRV 50 and resting heart rate 60 before today: as usual.
  const usual = () => {
    const out = {};
    for (let i = 1; i <= 28; i += 1) out[shiftDateKey('2026-10-20', -i)] = { hrv: 50, restingHeartRate: 60 };
    return out;
  };

  it('shows the score, worked out from the daily record and the training load, when there is enough to go on', async () => {
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { getByTestId } = await open();
    expect(getByTestId('readiness-score').props.children).toBe('94'); // HRV 100 x 35, resting HR 100 x 25, sleep 75 x 25, load 100 x 15
    expect(getByTestId('readiness-label').props.children).toBe('High');
    fireEvent.press(getByTestId('readiness-toggle'));
    expect(getByTestId('readiness-detail-load').props.children).toBe('1.10 this week against your usual week');
    expect(getByTestId('readiness-detail-hrv').props.children).toBe('55 ms today, 50 ms usual (+10%)');
  });

  it('leaves the training load out until there is enough history to work it out', async () => {
    mockLoad = TOO_EARLY;
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { getByTestId } = await open();
    expect(getByTestId('readiness-score').props.children).toBe('93');
    fireEvent.press(getByTestId('readiness-toggle'));
    expect(getByTestId('readiness-detail-load').props.children).toBe('Needs about a week of workouts, runs or hikes');
  });

  it('follows the training load when it changes', async () => {
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 50, restingHeartRate: 60, sleepHours: 8 } };
    const utils = await open();
    expect(utils.getByTestId('readiness-score').props.children).toBe('85'); // (35 x 75 + 25 x 75 + 25 x 100 + 15 x 100) / 100
    fireEvent.press(utils.getByTestId('readiness-toggle'));
    mockLoad = HARDER; // 1.4
    mockWorkouts.completedWorkouts = [{ id: 'w1' }];
    utils.rerender(<HealthScreen />);
    await act(async () => {});
    expect(utils.getByTestId('readiness-detail-load').props.children).toBe('1.40 this week against your usual week');
    expect(utils.getByTestId('readiness-score').props.children).toBe('81'); // load now 75: (35 x 75 + 25 x 75 + 25 x 100 + 15 x 75) / 100 = 81.25
  });

  it('uses the name of the HRV the connected source gives', async () => {
    mockHealth.rookRecovery = APPLE;
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 50, sleepHours: 8 } };
    const { getByTestId } = await open();
    fireEvent.press(getByTestId('readiness-toggle'));
    expect(within(getByTestId('readiness-row-hrv')).getByText('HRV (SDNN)')).toBeTruthy();
  });

  it('says what it is waiting for, with no number, before there is enough history', async () => {
    mockHealth.readingsHistory = { '2026-10-20': { sleepHours: 7 }, '2026-10-19': { hrv: 48 } };
    const { getByTestId, queryByTestId } = await open();
    expect(getByTestId('readiness-not-ready')).toBeTruthy();
    expect(queryByTestId('readiness-score')).toBeNull();
  });

  it('shows the score and its band first, with the working behind \'How it\'s worked out\'', async () => {
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { getByTestId, queryByTestId, getByText } = await open();
    expect(getByTestId('readiness-score').props.children).toBe('94');
    expect(getByText('How it\'s worked out')).toBeTruthy();
    expect(queryByTestId('readiness-row-hrv')).toBeNull();
    expect(queryByTestId('readiness-formula')).toBeNull();
    fireEvent.press(getByTestId('readiness-toggle'));
    expect(getByTestId('readiness-row-hrv')).toBeTruthy();
    expect(getByTestId('readiness-formula')).toBeTruthy();
  });

  it('is not on the page at all with no readings', async () => {
    const { queryByTestId } = await open();
    expect(queryByTestId('readiness-card')).toBeNull();
  });

  it('sits between Recovery and Training Load', async () => {
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { UNSAFE_getAllByType } = await open();
    const texts = UNSAFE_getAllByType(Text).map((node) => node.props.children).filter((c) => typeof c === 'string');
    const at = (title) => texts.indexOf(title);
    expect(at('Recovery')).toBeGreaterThan(-1);
    expect(at('Recovery')).toBeLessThan(at('Readiness'));
    expect(at('Readiness')).toBeLessThan(at('Training Load'));
  });

  it('counts today in the person\'s own time', async () => {
    jest.setSystemTime(new Date(2026, 9, 21, 0, 5));
    mockHealth.readingsHistory = { ...usual(), '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    const { queryByTestId } = await open();
    expect(queryByTestId('readiness-score')).toBeNull(); // 21 October has no readings yet
  });
});

describe('the Sleep row under Today', () => {
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });

  it('is a dash when no sleep has been read', async () => {
    const { getByTestId } = await open();
    expect(getByTestId('metric-sleep').props.children).toBe(DASH);
  });

  it('shows last night\'s sleep from the daily record when the wearable has none, which is the case for Apple Health', async () => {
    mockHealth.rookRecovery = APPLE;
    mockHealth.readingsHistory = { '2026-10-20': { sleepHours: 7.44 }, '2026-10-19': { sleepHours: 5 } };
    const { getByTestId } = await open();
    expect(getByTestId('metric-sleep').props.children).toBe('7.4h');
    expect(pickStyle(getByTestId('metric-bar-sleep'), 'width')).toBe('93%'); // 7.44 of 8 hours
  });

  it('shows the wearable\'s sleep when it has one', async () => {
    mockHealth.rookRecovery = { sleepHours: 8.26, source: 'WHOOP' };
    mockHealth.readingsHistory = { '2026-10-20': { sleepHours: 7.44 } };
    const { getByTestId } = await open();
    expect(getByTestId('metric-sleep').props.children).toBe('8.3h');
    expect(pickStyle(getByTestId('metric-bar-sleep'), 'width')).toBe('100%'); // a full night fills the bar and no more
  });

  it('does not show an earlier day\'s sleep as today\'s', async () => {
    mockHealth.readingsHistory = { '2026-10-19': { sleepHours: 6.5 } };
    const { getByTestId } = await open();
    expect(getByTestId('metric-sleep').props.children).toBe(DASH);
    expect(pickStyle(getByTestId('metric-bar-sleep'), 'width')).toBe('0%');
  });
});

describe('the readings', () => {
  it('has none of the numbers and words it used to show without measuring anything', async () => {
    const { queryByText } = await open();
    for (const text of ['Your Health Score', '82', 'Good', 'Updated today at 9:15 AM', 'Heart Rate', 'Blood Oxygen', 'Stress Level',
      '72 bpm', '98 %', 'Low', 'AI Coach', 'Get Your First Insight', 'Get More Insights']) {
      expect(queryByText(text)).toBeNull();
    }
    expect(queryByText(/consider adding a 10-minute stretch/)).toBeNull();
  });

  it('shows the resting heart rate and the HRV the phone read, and where they are from', async () => {
    mockHealth.rookRecovery = APPLE;
    const { getByText, getByTestId } = await open();
    expect(getByText('Recovery')).toBeTruthy();
    expect(getByText('58 bpm')).toBeTruthy();
    expect(getByText('Resting HR')).toBeTruthy();
    expect(getByText('42 ms')).toBeTruthy();
    expect(within(getByTestId('recovery-hrv')).getByText('HRV (SDNN)')).toBeTruthy();
    expect(getByTestId('recovery-caption').props.children).toBe('Latest readings from Apple Health');
  });

  it('shows a dash for a reading it does not have, and asks to connect a device when it has none', async () => {
    const { getByTestId, getAllByText, queryByText } = await open();
    expect(getAllByText(DASH).length).toBeGreaterThanOrEqual(2);
    expect(getByTestId('recovery-restingHeartRate')).toBeTruthy();
    expect(getByTestId('recovery-hrv')).toBeTruthy();
    expect(getByTestId('recovery-caption').props.children).toBe('No readings yet. Connect a device under Wearable Sync below.');
    expect(queryByText(/bpm/)).toBeNull();
  });

  it('still lists the steps, sleep and water that were logged', async () => {
    const { getByText } = await open();
    expect(getByText('4,200')).toBeTruthy();
    expect(getByText('3/8')).toBeTruthy();
  });
});

describe('the Body Composition card', () => {
  it('is the camera for someone whose plan includes the body scan, with no plan marked', async () => {
    const { getByText, queryByTestId, getByTestId } = await open();
    expect(getByText('Scan now')).toBeTruthy();
    expect(getByText('AI-powered body analysis using your camera')).toBeTruthy();
    expect(queryByTestId('body-composition-plan')).toBeNull();
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenCalledWith('/body-scan/capture');
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/capture');
  });

  it('says Legend, and goes to the plans, for someone on Free or Pro', async () => {
    mockPlan = FREE;
    const { getByText, getByTestId, queryByText } = await open();
    expect(getByTestId('body-composition-plan')).toBeTruthy();
    expect(getByText('Legend')).toBeTruthy();
    expect(getByText('Body scan is part of Legend')).toBeTruthy();
    expect(queryByText('Scan now')).toBeNull();
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenCalledWith(PLANS);
    expect(mockPush).not.toHaveBeenCalledWith('/body-scan/capture');
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith(PLANS);
  });

  it('opens the camera, and says how many free scans are left, for someone on Free who has some from the Premium Pass', async () => {
    mockPlan = FREE;
    usePremiumStore.setState({ scanCredits: 2 });
    const { getByText, getByTestId, queryByText } = await open();
    expect(getByText('2 free scans')).toBeTruthy();
    expect(getByText('2 free scans from your Premium Pass')).toBeTruthy();
    expect(getByText('Scan now')).toBeTruthy();
    expect(queryByText('See plans')).toBeNull();
    expect(queryByText('Legend')).toBeNull();
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenCalledWith('/body-scan/capture');
    expect(mockPush).not.toHaveBeenCalledWith(PLANS);
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/capture');
  });

  it('goes back to the plans when the last free scan has been used', async () => {
    mockPlan = FREE;
    usePremiumStore.setState({ scanCredits: 1 });
    const { getByText, queryByText, rerender } = await open();
    expect(getByText('1 free scan')).toBeTruthy();
    await act(async () => { usePremiumStore.setState({ scanCredits: 0 }); });
    rerender(<HealthScreen />);
    expect(queryByText('1 free scan')).toBeNull();
    expect(getByText('Body scan is part of Legend')).toBeTruthy();
    expect(getByText('See plans')).toBeTruthy();
  });

  it('says nothing about free scans to someone whose plan includes the body scan, whatever they hold', async () => {
    usePremiumStore.setState({ scanCredits: 3 });
    const { getByText, queryByTestId, queryByText } = await open();
    expect(queryByTestId('body-composition-plan')).toBeNull();
    expect(queryByText('3 free scans')).toBeNull();
    expect(getByText('AI-powered body analysis using your camera')).toBeTruthy();
  });

  it('does not mark anything while it is still finding out the plan, so nobody who has it sees a lock flash up', async () => {
    mockPlan = UNKNOWN_YET;
    const { queryByTestId, getByText } = await open();
    expect(queryByTestId('body-composition-plan')).toBeNull();
    expect(getByText('Scan now')).toBeTruthy();
  });

  it('still opens the scan that was taken for someone whose plan does not include another', async () => {
    mockPlan = FREE;
    mockBody.scans = [{ id: 'old', bodyFatPercent: 22 }, { id: 'new', bodyFatPercent: 18.5 }];
    const { getByText, getByTestId } = await open();
    expect(getByText('Last scan: 18.5% body fat')).toBeTruthy();
    expect(getByText('View progress')).toBeTruthy();
    expect(getByText('See plans')).toBeTruthy();
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/new');
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenLastCalledWith(PLANS);
  });

  it('opens the camera from New scan, and the scan that was taken from the card, for someone whose plan includes it', async () => {
    mockBody.scans = [{ id: 'new', bodyFatPercent: 18.5 }];
    const { getByText, getByTestId, queryByTestId } = await open();
    expect(getByText('New scan')).toBeTruthy();
    expect(queryByTestId('body-composition-plan')).toBeNull();
    pressWithoutBubbling(getByTestId('body-composition-primary'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/capture');
    fireEvent.press(getByTestId('body-composition-card'));
    expect(mockPush).toHaveBeenLastCalledWith('/body-scan/new');
  });
});

describe('the AI comment on the training load', () => {
  it('is asked for once the numbers have settled, and shown', async () => {
    const { queryByText, getByText } = await open();
    expect(mockGetInsight).not.toHaveBeenCalled();
    await settle(INSIGHT_SETTLE_MS - 1);
    expect(mockGetInsight).not.toHaveBeenCalled();
    expect(queryByText('A steady week.')).toBeNull();
    await settle(1);
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
    expect(mockGetInsight).toHaveBeenCalledWith({ uid: 'u1', trainingLoad: STEADY });
    expect(getByText('A steady week.')).toBeTruthy();
  });

  it('is not asked again when the screen draws again with the same numbers', async () => {
    const utils = await open();
    await settle();
    utils.rerender(<HealthScreen />);
    await settle(INSIGHT_SETTLE_MS * 3);
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
  });

  it('is asked for only the final numbers when they change before it is time', async () => {
    const utils = await open();
    await settle(INSIGHT_SETTLE_MS - 100);
    mockLoad = HARDER;
    mockWorkouts.completedWorkouts = [{ id: 'w1' }];
    utils.rerender(<HealthScreen />);
    await settle(INSIGHT_SETTLE_MS - 1);
    expect(mockGetInsight).not.toHaveBeenCalled();
    await settle(1);
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
    expect(mockGetInsight).toHaveBeenCalledWith({ uid: 'u1', trainingLoad: HARDER });
  });

  it('takes the new numbers\' comment, not the old one, when the old answer arrives late', async () => {
    let answerOld;
    mockGetInsight.mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }));
    const utils = await open();
    await settle();
    expect(mockGetInsight).toHaveBeenCalledTimes(1);

    mockLoad = HARDER;
    mockRuns.runs = [{ id: 'r1' }];
    mockGetInsight.mockResolvedValueOnce('A harder week.');
    utils.rerender(<HealthScreen />);
    await settle();
    expect(utils.getByText('A harder week.')).toBeTruthy();

    await act(async () => { answerOld('A steady week.'); });
    expect(utils.queryByText('A steady week.')).toBeNull();
    expect(utils.getByText('A harder week.')).toBeTruthy();
  });

  it('takes the old comment off while the new numbers\' one is on its way', async () => {
    const utils = await open();
    await settle();
    expect(utils.getByText('A steady week.')).toBeTruthy();
    mockLoad = HARDER;
    mockHikes.completedHikes = [{ id: 'h1' }];
    mockGetInsight.mockResolvedValueOnce('A harder week.');
    utils.rerender(<HealthScreen />);
    await act(async () => {});
    expect(utils.queryByText('A steady week.')).toBeNull();
    await settle();
    expect(utils.getByText('A harder week.')).toBeTruthy();
  });

  it('is never asked for when the person leaves before it is time', async () => {
    const utils = await open();
    await settle(INSIGHT_SETTLE_MS - 1);
    utils.unmount();
    await settle(INSIGHT_SETTLE_MS * 2);
    expect(mockGetInsight).not.toHaveBeenCalled();
  });

  it('shows the card with no comment when there is none to give', async () => {
    mockGetInsight.mockResolvedValue(null);
    const { getByText, queryByText } = await open();
    await settle();
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
    expect(getByText('Training Load')).toBeTruthy();
    expect(getByText('1.10')).toBeTruthy();
    expect(queryByText('A steady week.')).toBeNull();
  });

  it('is not asked for before there is enough history to read', async () => {
    mockLoad = TOO_EARLY;
    const { getByText } = await open();
    await settle(INSIGHT_SETTLE_MS * 3);
    expect(mockGetInsight).not.toHaveBeenCalled();
    expect(getByText(/needs about a week of history/)).toBeTruthy();
  });

  it('is not asked for without a signed-in person', async () => {
    mockUser.user = null;
    await open();
    await settle(INSIGHT_SETTLE_MS * 3);
    expect(mockGetInsight).not.toHaveBeenCalled();
  });

  it('is asked for once the person has signed in, if they had not when the screen opened', async () => {
    mockUser.user = null;
    const utils = await open();
    await settle(INSIGHT_SETTLE_MS * 2);
    expect(mockGetInsight).not.toHaveBeenCalled();
    mockUser.user = { uid: 'u2', name: 'Sam' };
    utils.rerender(<HealthScreen />);
    await settle();
    expect(mockGetInsight).toHaveBeenCalledTimes(1);
    expect(mockGetInsight).toHaveBeenCalledWith({ uid: 'u2', trainingLoad: STEADY });
  });

  it('is not asked for by a person with no id', async () => {
    mockUser.user = { name: 'Guest' };
    await open();
    await settle(INSIGHT_SETTLE_MS * 3);
    expect(mockGetInsight).not.toHaveBeenCalled();
  });
});

describe('the order of the page', () => {
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });

  it('starts with Today, then Recovery, Readiness, Training Load, Muscle Fatigue, Body Composition, Trends and Wearable Sync', async () => {
    const history = {};
    for (let i = 1; i <= 28; i += 1) history[shiftDateKey('2026-10-20', -i)] = { hrv: 50, restingHeartRate: 60 };
    mockHealth.readingsHistory = { ...history, '2026-10-20': { hrv: 55, restingHeartRate: 57, sleepHours: 7 } };
    mockHealth.rookRecovery = APPLE;
    const { UNSAFE_getAllByType } = await open();
    const texts = UNSAFE_getAllByType(Text).map((node) => node.props.children).filter((c) => typeof c === 'string');
    const order = ['Health', 'Today', 'Recovery', 'Readiness', 'Training Load', 'Muscle Fatigue', 'Body Composition', 'Trends', 'Wearable Sync'].map((t) => texts.indexOf(t));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('has no card called Health Metrics any more', async () => {
    const { queryByText } = await open();
    expect(queryByText('Health Metrics')).toBeNull();
  });
});

describe('Today', () => {
  it('shows the steps with a comma, the sleep and the water, each with its goal', async () => {
    mockHealth.steps = 12345;
    const { getByText, getByTestId } = await open();
    expect(getByTestId('metric-steps').props.children).toBe('12,345');
    expect(getByText('Goal 10,000')).toBeTruthy();
    expect(getByText('Goal 8h')).toBeTruthy();
    expect(getByText('Goal 8 glasses')).toBeTruthy();
    expect(getByTestId('metric-hydration').props.children).toBe('3/8');
    expect(pickStyle(getByTestId('metric-bar-steps'), 'width')).toBe('100%'); // past the goal, the bar is full and no more
  });

  it('names the goal for the water that is set, not a fixed 8', async () => {
    mockHealth.hydration = { glasses: 5, target: 10 };
    const { getByText, getByTestId } = await open();
    expect(getByText('Goal 10 glasses')).toBeTruthy();
    expect(getByTestId('metric-hydration').props.children).toBe('5/10');
    expect(pickStyle(getByTestId('metric-bar-hydration'), 'width')).toBe('50%');
  });

  it('is white like the rest of the cards', async () => {
    const { getByTestId } = await open();
    expect(pickStyle(getByTestId('today-card'), 'backgroundColor')).toBe('#FFF');
    expect(pickStyle(getByTestId('today-card'), 'borderRadius')).toBe(16);
    expect(pickStyle(getByTestId('today-card'), 'marginHorizontal')).toBe(20);
  });
});

describe('Recovery against the person\'s own usual', () => {
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });
  // 28 days of resting heart rate 60 and HRV 50 before today.
  const usual = () => {
    const out = {};
    for (let i = 1; i <= 28; i += 1) out[shiftDateKey('2026-10-20', -i)] = { hrv: 50, restingHeartRate: 60 };
    return out;
  };
  const SAMPLED = {
    restingHeartRate: 57, hrv: 55, source: 'Apple Health',
    restingHeartRateAt: new Date(2026, 9, 20, 7, 0).toISOString(),
    hrvAt: new Date(2026, 9, 17, 22, 0).toISOString(),
  };

  it('says how far each reading is from the usual, and which way is better, in green or orange', async () => {
    mockHealth.rookRecovery = SAMPLED;
    mockHealth.readingsHistory = usual();
    const { getByTestId } = await open();
    expect(getByTestId('recovery-change-restingHeartRate').props.children).toBe('↓ 3 vs your usual 60'); // a lower resting heart rate is better
    expect(pickStyle(getByTestId('recovery-change-restingHeartRate'), 'color')).toBe(TONE_COLOR.good);
    expect(getByTestId('recovery-change-hrv').props.children).toBe('↑ 5 vs your usual 50'); // a higher HRV is better
    expect(pickStyle(getByTestId('recovery-change-hrv'), 'color')).toBe(TONE_COLOR.good);
  });

  it('is orange for a reading that is worse than usual', async () => {
    mockHealth.rookRecovery = { ...SAMPLED, restingHeartRate: 66, hrv: 41 };
    mockHealth.readingsHistory = usual();
    const { getByTestId } = await open();
    expect(getByTestId('recovery-change-restingHeartRate').props.children).toBe('↑ 6 vs your usual 60');
    expect(pickStyle(getByTestId('recovery-change-restingHeartRate'), 'color')).toBe(TONE_COLOR.worse);
    expect(getByTestId('recovery-change-hrv').props.children).toBe('↓ 9 vs your usual 50');
    expect(pickStyle(getByTestId('recovery-change-hrv'), 'color')).toBe(TONE_COLOR.worse);
  });

  it('says it is about the usual when it is the same number', async () => {
    mockHealth.rookRecovery = { ...SAMPLED, restingHeartRate: 60, hrv: 50 };
    mockHealth.readingsHistory = usual();
    const { getByTestId } = await open();
    expect(getByTestId('recovery-change-restingHeartRate').props.children).toBe('About your usual');
    expect(pickStyle(getByTestId('recovery-change-restingHeartRate'), 'color')).toBe(TONE_COLOR.same);
  });

  it('says nothing about the usual before there are enough earlier readings to have one', async () => {
    mockHealth.rookRecovery = SAMPLED;
    mockHealth.readingsHistory = { '2026-10-19': { hrv: 50, restingHeartRate: 60 }, '2026-10-18': { hrv: 50, restingHeartRate: 60 } };
    const { queryByTestId, getByText } = await open();
    expect(queryByTestId('recovery-change-restingHeartRate')).toBeNull();
    expect(queryByTestId('recovery-change-hrv')).toBeNull();
    expect(getByText('57 bpm')).toBeTruthy(); // the reading itself is still shown
  });

  it('says nothing about a reading it does not have', async () => {
    mockHealth.rookRecovery = { ...SAMPLED, hrv: null };
    mockHealth.readingsHistory = usual();
    const { queryByTestId, getByTestId } = await open();
    expect(getByTestId('recovery-change-restingHeartRate')).toBeTruthy();
    expect(queryByTestId('recovery-change-hrv')).toBeNull();
  });

  it('compares an older reading with the days before it, not with the days before today', async () => {
    const history = usual();
    // The HRV was taken on 17 October. Every day from the 17th on is much higher, so only the days before it give the usual of 50.
    for (const d of ['2026-10-17', '2026-10-18', '2026-10-19']) history[d] = { hrv: 90, restingHeartRate: 60 };
    mockHealth.rookRecovery = SAMPLED;
    mockHealth.readingsHistory = history;
    const { getByTestId } = await open();
    expect(getByTestId('recovery-change-hrv').props.children).toBe('↑ 5 vs your usual 50');
  });

  it('says how old the readings are under the tiles', async () => {
    mockHealth.rookRecovery = SAMPLED;
    const { getByTestId } = await open();
    expect(getByTestId('recovery-caption').props.children).toBe('From Apple Health · resting HR today, HRV 3 days ago');
  });

  it('says today for both when both were taken today', async () => {
    mockHealth.rookRecovery = { ...SAMPLED, hrvAt: new Date(2026, 9, 20, 6, 0).toISOString() };
    const { getByTestId } = await open();
    expect(getByTestId('recovery-caption').props.children).toBe('From Apple Health · today');
  });

  it('counts a wearable\'s reading as today\'s', async () => {
    mockHealth.rookRecovery = { restingHeartRate: 57, hrv: 55, source: 'WHOOP' };
    const { getByTestId } = await open();
    expect(getByTestId('recovery-caption').props.children).toBe('From WHOOP · today');
  });
});

describe('Muscle Fatigue', () => {
  it('is a short row, not a tall empty box, until there is something to show', async () => {
    const { getByTestId, queryByTestId, getByText } = await open();
    expect(getByTestId('muscle-fatigue-empty')).toBeTruthy();
    expect(getByText('Muscle Fatigue')).toBeTruthy();
    expect(getByText(/Nothing to show yet/)).toBeTruthy();
    expect(queryByTestId('muscle-heatmap')).toBeNull();
  });

  it('shows the body map, in the shared card look, once a muscle has some fatigue', async () => {
    mockFatigue = { chest: 60, quads: 0 };
    const { getByTestId, queryByTestId } = await open();
    expect(getByTestId('muscle-heatmap').props.accessibilityLabel).toBe('Muscle Fatigue');
    expect(getByTestId('muscle-heatmap').props.style).toBe(h.card);
    expect(queryByTestId('muscle-fatigue-empty')).toBeNull();
  });

  it('is the short row when every muscle is at none', async () => {
    mockFatigue = { chest: 0, quads: 0 };
    const { getByTestId, queryByTestId } = await open();
    expect(getByTestId('muscle-fatigue-empty')).toBeTruthy();
    expect(queryByTestId('muscle-heatmap')).toBeNull();
  });
});

describe('Training Load before it has enough history', () => {
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); mockLoad = TOO_EARLY; });

  it('says how many of the 5 days it needs have a workout, run or hike so far', async () => {
    mockDaily = { '2026-10-20': 300, '2026-10-18': 250, '2026-10-02': 400 };
    const { getByTestId } = await open();
    expect(getByTestId('training-load-days').props.children).toBe('3 of 5 days with a workout, run or hike so far');
    expect(pickStyle(getByTestId('training-load-unlock'), 'width')).toBe('60%');
  });

  it('does not count a day more than 28 days back', async () => {
    mockDaily = { '2026-10-20': 300, '2026-09-22': 250, '2026-09-23': 250 }; // 28 days back is 23 September; the 22nd is 29
    const { getByTestId } = await open();
    expect(getByTestId('training-load-days').props.children).toBe('2 of 5 days with a workout, run or hike so far');
  });

  it('starts at none', async () => {
    const { getByTestId } = await open();
    expect(getByTestId('training-load-days').props.children).toBe('0 of 5 days with a workout, run or hike so far');
  });

  it('shows the scale instead once there is a reading', async () => {
    mockLoad = STEADY;
    const { getByTestId, queryByTestId } = await open();
    expect(getByTestId('training-load-scale')).toBeTruthy();
    expect(queryByTestId('training-load-days')).toBeNull();
  });
});

describe('the Body Composition card, and what changed', () => {
  beforeEach(() => { jest.setSystemTime(new Date(2026, 9, 20, 15, 0)); });
  const SCANS = [
    { id: 'old', bodyFatPercent: 22, createdAtLocal: new Date(2026, 7, 12, 9).toISOString() },
    { id: 'new', bodyFatPercent: 20.8, createdAtLocal: new Date(2026, 9, 1, 9).toISOString() },
  ];

  it('says what changed in body fat since the scan before, in green when it is down', async () => {
    mockBody.scans = SCANS;
    const { getByTestId, getByText } = await open();
    expect(getByTestId('body-composition-change').props.children).toBe('Body fat down 1.2% since Aug 12');
    expect(pickStyle(getByTestId('body-composition-change'), 'color')).toBe(TONE_COLOR.good);
    expect(getByText('Last scan: 20.8% body fat')).toBeTruthy();
  });

  it('is orange when body fat is up', async () => {
    mockBody.scans = [SCANS[0], { ...SCANS[1], bodyFatPercent: 23.5 }];
    const { getByTestId } = await open();
    expect(getByTestId('body-composition-change').props.children).toBe('Body fat up 1.5% since Aug 12');
    expect(pickStyle(getByTestId('body-composition-change'), 'color')).toBe(TONE_COLOR.worse);
  });

  it('says nothing about a change after the first scan, or with no scan', async () => {
    mockBody.scans = [SCANS[1]];
    const one = await open();
    expect(one.queryByTestId('body-composition-change')).toBeNull();
    one.unmount();
    mockBody.scans = [];
    const none = await open();
    expect(none.queryByTestId('body-composition-change')).toBeNull();
  });

  it('compares the latest scan with the one just before it, whatever came earlier', async () => {
    mockBody.scans = [{ id: 'first', bodyFatPercent: 30, createdAtLocal: new Date(2026, 5, 1).toISOString() }, ...SCANS];
    const { getByTestId } = await open();
    expect(getByTestId('body-composition-change').props.children).toBe('Body fat down 1.2% since Aug 12');
  });
});

describe('View progress', () => {
  it('opens the Progress tab, not the latest scan, and does not open the scan as well', async () => {
    mockBody.scans = [{ id: 'new', bodyFatPercent: 18.5 }];
    const { getByTestId } = await open();
    pressWithoutBubbling(getByTestId('body-composition-progress'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/progress');
    expect(mockPush).not.toHaveBeenCalledWith('/body-scan/new');
  });

  it('is a button, there only once there is a scan', async () => {
    mockBody.scans = [{ id: 'new', bodyFatPercent: 18.5 }];
    const there = await open();
    expect(there.getByTestId('body-composition-progress').props.accessibilityRole).toBe('button');
    there.unmount();
    mockBody.scans = [];
    const none = await open();
    expect(none.queryByTestId('body-composition-progress')).toBeNull();
    expect(none.queryByText('View progress')).toBeNull();
  });
});

describe('pulling down to refresh', () => {
  const pull = async (utils) => {
    await act(async () => { await utils.getByTestId('health-scroll').props.refreshControl.props.onRefresh(); });
  };
  const clearCalls = () => {
    for (const fn of [mockHealth.loadAllHealth, mockHealth.loadAppleHealthActivity, mockHealth.loadRookRecovery, mockHealth.syncReadings]) fn.mockReset();
  };

  it('reads Apple Health again, and the daily record, as well as what is saved', async () => {
    const utils = await open();
    clearCalls();
    await pull(utils);
    expect(mockHealth.loadAllHealth).toHaveBeenCalledWith('u1');
    expect(mockHealth.loadAppleHealthActivity).toHaveBeenCalledWith('u1');
    expect(mockHealth.loadRookRecovery).toHaveBeenCalledTimes(1);
    expect(mockHealth.syncReadings).toHaveBeenCalledWith('u1', { force: true }); // not held back by the once-a-while limit
  });

  it('does not ask for the daily record by force when the screen just opens', async () => {
    await open();
    expect(mockHealth.syncReadings).toHaveBeenCalledTimes(1);
    expect(mockHealth.syncReadings.mock.calls[0]).toEqual(['u1']);
  });

  it('shows the spinner while it reads, and takes it away after', async () => {
    const utils = await open();
    clearCalls();
    let done;
    mockHealth.loadAppleHealthActivity.mockImplementationOnce(() => new Promise((resolve) => { done = resolve; }));
    const control = () => utils.getByTestId('health-scroll').props.refreshControl.props;
    expect(control().refreshing).toBe(false);
    let pulled;
    act(() => { pulled = control().onRefresh(); });
    expect(control().refreshing).toBe(true);
    await act(async () => { done(); await pulled; });
    expect(control().refreshing).toBe(false);
  });

  it('still reads the rest, and still takes the spinner away, when one read fails', async () => {
    const utils = await open();
    clearCalls();
    mockHealth.loadAppleHealthActivity.mockRejectedValueOnce(new Error('no access'));
    await pull(utils);
    expect(mockHealth.loadRookRecovery).toHaveBeenCalledTimes(1);
    expect(mockHealth.syncReadings).toHaveBeenCalledWith('u1', { force: true });
    expect(mockHealth.loadAllHealth).toHaveBeenCalledWith('u1');
    expect(utils.getByTestId('health-scroll').props.refreshControl.props.refreshing).toBe(false);
  });

  it('reads nothing without a signed-in person, and still takes the spinner away', async () => {
    mockUser.user = null;
    const utils = await open();
    clearCalls();
    await pull(utils);
    for (const fn of [mockHealth.loadAllHealth, mockHealth.loadAppleHealthActivity, mockHealth.loadRookRecovery, mockHealth.syncReadings]) expect(fn).not.toHaveBeenCalled();
    expect(utils.getByTestId('health-scroll').props.refreshControl.props.refreshing).toBe(false);
  });
});
