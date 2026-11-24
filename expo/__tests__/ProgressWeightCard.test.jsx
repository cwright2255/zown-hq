// Progress tab > Weight: the latest weight with how old it is, Log Weight at the top of the card, how far to the target, and the chart
// once there are two weigh-ins. The first case is the screen as it was found: one August weigh-in of 230 lbs, a 181 lb target, on 23 Nov.
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Line: 'Line' }), { virtual: true });

import ProgressWeightCard from '../components/ProgressWeightCard';
import ProgressWeightChart, { LABEL_ROOM, TOP, chartLayout, chartSummary } from '../components/ProgressWeightChart';
import { weightChartModel, weightEntries } from '../lib/progressInsights';

const NOW = new Date(2026, 10, 23, 21, 40);
const log = (id, kg, date) => ({ id, weightKg: kg, createdAtLocal: date.toISOString() });
const AUG = log('aug', 104.3, new Date(2026, 7, 12, 9, 30)); // 230 lbs
const TARGET_KG = 82.1; // 181 lbs
const text = (el) => [el.props.children].flat().join('');

function draw(props = {}) {
  const handlers = { onLog: jest.fn(), onSetTarget: jest.fn() };
  const utils = render(<ProgressWeightCard logs={[AUG]} targetKg={TARGET_KG} now={NOW} {...handlers} {...props} />);
  return { ...utils, ...handlers };
}

describe('the card with the one weigh-in from August', () => {
  it('shows 230 lbs with its age and the date, so it is not read as today', () => {
    const { getByTestId, getByText } = draw();
    expect(getByText('Weight')).toBeTruthy();
    expect(text(getByTestId('weight-current'))).toBe('230 lbs');
    expect(text(getByTestId('weight-freshness'))).toBe('Logged Aug 12 · 3 months ago');
  });

  it('calls out that it is out of date, and the nudge opens Log Weight', () => {
    const { getByTestId, onLog } = draw();
    fireEvent.press(getByTestId('weight-nudge'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('shows 49 lbs to go to the 181 lb target, with the bar at nothing', () => {
    const { getByTestId } = draw();
    expect(text(getByTestId('weight-togo'))).toBe('49 lbs to go');
    expect(StyleSheet.flatten(getByTestId('weight-progress-fill').props.style).width).toBe('0%');
    expect(getByTestId('weight-target')).toBeTruthy();
  });

  it('is a short card: no tall empty chart, no range buttons, a line that says what unlocks the chart', () => {
    const { queryByTestId, getByTestId } = draw();
    expect(queryByTestId('weight-chart')).toBeNull();
    expect(queryByTestId('weight-range-3m')).toBeNull();
    expect(text(getByTestId('weight-first'))).toBe('Log one more weigh-in and your trend chart appears here.');
  });

  it('has Log Weight in the header, and tapping it logs', () => {
    const { getByTestId, onLog } = draw();
    fireEvent.press(getByTestId('weight-log'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('opens the target prompt from the target line', () => {
    const { getByTestId, onSetTarget } = draw();
    fireEvent.press(getByTestId('weight-target-edit'));
    expect(onSetTarget).toHaveBeenCalledTimes(1);
  });
});

describe('without a target, a weigh-in or both', () => {
  it('offers to set a target when there is a weigh-in and no target', () => {
    const { getByTestId, queryByTestId, onSetTarget } = draw({ targetKg: null });
    expect(queryByTestId('weight-target')).toBeNull();
    fireEvent.press(getByTestId('weight-set-target'));
    expect(onSetTarget).toHaveBeenCalledTimes(1);
  });

  it('says nothing is logged yet and still has the Log Weight button', () => {
    const { getByTestId, queryByTestId, onLog } = draw({ logs: [], targetKg: TARGET_KG });
    expect(text(getByTestId('weight-none'))).toBe('No weight logged yet.');
    expect(queryByTestId('weight-current')).toBeNull();
    expect(queryByTestId('weight-nudge')).toBeNull();
    expect(queryByTestId('weight-target')).toBeNull();
    expect(queryByTestId('weight-set-target')).toBeNull();
    expect(queryByTestId('weight-first')).toBeNull();
    fireEvent.press(getByTestId('weight-log'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });
});

describe('a weigh-in from today', () => {
  it('says logged today and has no nudge', () => {
    const { getByTestId, queryByTestId } = draw({ logs: [log('now', 104.3, new Date(2026, 10, 23, 8, 0))] });
    expect(text(getByTestId('weight-freshness'))).toBe('Logged today');
    expect(queryByTestId('weight-nudge')).toBeNull();
  });
});

describe('with several weigh-ins', () => {
  const logs = [
    log('a', 104.3, new Date(2026, 7, 12)), // 230
    log('b', 102.1, new Date(2026, 9, 20)), // 225
    log('c', 100, new Date(2026, 10, 12)), // 220
    log('d', 98.9, new Date(2026, 10, 22)), // 218
  ];

  it('shows the change from the start, the change in the past 30 days, and how far to go', () => {
    const { getByTestId } = draw({ logs });
    expect(text(getByTestId('weight-current'))).toBe('218 lbs');
    expect(text(getByTestId('weight-change'))).toBe('↓ 12 lbs from start');
    expect(text(getByTestId('weight-recent'))).toBe('Down 2 lbs in the past 30 days');
    expect(text(getByTestId('weight-togo'))).toBe('37 lbs to go');
    expect(StyleSheet.flatten(getByTestId('weight-progress-fill').props.style).width).toBe('24%'); // 12 of 49
  });

  it('draws the chart with ranges, opening on three months, with the target as a dashed line and the latest dot', () => {
    const { getByTestId, queryByTestId } = draw({ logs });
    expect(getByTestId('weight-chart')).toBeTruthy();
    expect(getByTestId('weight-chart-target')).toBeTruthy();
    expect(getByTestId('weight-dot-latest')).toBeTruthy();
    expect(getByTestId('weight-range-3m').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('weight-range-all').props.accessibilityState.selected).toBe(false);
    expect(queryByTestId('weight-range-empty')).toBeNull();
  });

  it('changes the range, and says so when a range has too few weigh-ins', () => {
    const { getByTestId, queryByTestId } = draw({ logs });
    fireEvent.press(getByTestId('weight-range-1w'));
    expect(getByTestId('weight-range-1w').props.accessibilityState.selected).toBe(true);
    expect(queryByTestId('weight-chart')).toBeNull();
    expect(text(getByTestId('weight-range-empty'))).toBe('Not enough weigh-ins in this range. Try a longer one.');
    fireEvent.press(getByTestId('weight-range-all'));
    expect(getByTestId('weight-chart')).toBeTruthy();
    expect(getByTestId('weight-range-all').props.accessibilityState.selected).toBe(true);
  });

  it('opens on everything when the last three months hold fewer than two weigh-ins', () => {
    const { getByTestId } = draw({ logs: [logs[0], logs[3]] });
    expect(getByTestId('weight-range-all').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('weight-chart')).toBeTruthy();
  });

  it('colours a move away from the target orange, and a move towards it green', () => {
    const colorOf = (id) => StyleSheet.flatten(id.props.style).color;
    const up = [log('a', 100, new Date(2026, 8, 1)), log('b', 103, new Date(2026, 10, 1))]; // up 7 lbs, target below
    expect(colorOf(draw({ logs: up }).getByTestId('weight-change'))).toBe('#F97316');
    expect(colorOf(draw({ logs }).getByTestId('weight-change'))).toBe('#22C55E');
    const gaining = draw({ logs: [log('a', 70, new Date(2026, 8, 1)), log('b', 72, new Date(2026, 10, 1))], targetKg: 75 });
    expect(colorOf(gaining.getByTestId('weight-change'))).toBe('#22C55E'); // gaining towards a higher target
  });

  it('says no change from the start when the weight is where it began', () => {
    const { getByTestId } = draw({ logs: [log('a', 100, new Date(2026, 8, 1)), log('b', 100, new Date(2026, 10, 1))] });
    expect(text(getByTestId('weight-change'))).toBe('No change from start');
  });

  it('shows the target reached in green', () => {
    const { getByTestId } = draw({ logs: [log('a', 104.3, new Date(2026, 8, 1)), log('b', 80, new Date(2026, 10, 1))] });
    expect(text(getByTestId('weight-togo'))).toBe('Target reached');
    expect(StyleSheet.flatten(getByTestId('weight-progress-fill').props.style).width).toBe('100%');
    expect(StyleSheet.flatten(getByTestId('weight-togo').props.style).color).toBe('#22C55E');
  });
});

describe('ProgressWeightChart', () => {
  const entries = weightEntries([
    log('a', 104.3, new Date(2026, 8, 1)),
    log('b', 100, new Date(2026, 9, 1)),
    log('c', 95, new Date(2026, 10, 1)),
  ]);
  const model = weightChartModel({ entries, rangeKey: 'all', now: NOW, targetLbs: 181 });

  it('draws nothing without a model', () => {
    expect(render(<ProgressWeightChart model={null} />).toJSON()).toBeNull();
  });

  it('keeps every dot, the line and the target inside the plot', () => {
    const layout = chartLayout(model, 300, 150);
    layout.dots.forEach((d) => {
      expect(d.x).toBeGreaterThanOrEqual(layout.left);
      expect(d.x).toBeLessThanOrEqual(layout.right);
      expect(d.y).toBeGreaterThanOrEqual(TOP);
      expect(d.y).toBeLessThanOrEqual(150 - LABEL_ROOM);
    });
    expect(layout.path.startsWith('M')).toBe(true);
    expect(layout.path.split('L')).toHaveLength(3);
    expect(layout.targetY).toBe(layout.bottom); // the target is the lowest value on the scale
    expect(layout.dots[0].x).toBe(layout.left); // "All" starts at the first weigh-in
  });

  it('has no target line when there is no target', () => {
    const plain = weightChartModel({ entries, rangeKey: 'all', now: NOW });
    expect(chartLayout(plain, 300, 150).targetY).toBeNull();
    const { queryByTestId } = render(<ProgressWeightChart model={plain} now={NOW} />);
    expect(queryByTestId('weight-chart-target')).toBeNull();
  });

  it('describes itself to a screen reader', () => {
    expect(chartSummary(model, NOW)).toBe('Weight chart. 230 lbs on Sep 1, 209 lbs on Nov 1, 3 weigh-ins. Target 181 lbs.');
    const { getByTestId } = render(<ProgressWeightChart model={model} now={NOW} />);
    expect(getByTestId('weight-chart').props.accessibilityLabel).toMatch(/^Weight chart\. 230 lbs on Sep 1/);
  });

  it('leaves out the grey dots when there are too many, and keeps the latest one', () => {
    const many = weightEntries(Array.from({ length: 40 }, (_, i) => log(`l${i}`, 100 - i * 0.1, new Date(2026, 9, 1, 12, i))));
    const crowded = weightChartModel({ entries: many, rangeKey: 'all', now: NOW });
    const { queryByTestId } = render(<ProgressWeightChart model={crowded} now={NOW} />);
    expect(queryByTestId('weight-dot-0')).toBeNull();
    expect(queryByTestId('weight-dot-latest')).toBeTruthy();
  });
});
