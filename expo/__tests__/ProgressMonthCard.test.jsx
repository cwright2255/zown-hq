// Progress tab > the month: this month's workouts, runs and calories against last month's, the level and what is left to the next one, and
// six months of bars. Today is 23 Nov 2026. Sessions: Jun 1, Jul 0, Aug 2, Sep 3, Oct 6 (4 workouts, 2 runs), Nov 5 (4 workouts, 1 run).
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import ProgressMonthCard, { barLayout, compact } from '../components/ProgressMonthCard';
import { GOOD, INK, QUIET, WORSE } from '../components/progressStyles';
import { monthlyTotals } from '../lib/progressInsights';

const NOW = new Date(2026, 10, 23, 21, 40);
const w = (m, d, cal) => ({ completedAt: new Date(2026, m, d, 8).toISOString(), caloriesBurned: cal });
const r = (m, d, cal) => ({ startTime: new Date(2026, m, d, 7).toISOString(), calories: cal });
const WORKOUTS = [
  w(5, 3, 100),
  w(7, 2, 100), w(7, 9, 100),
  w(8, 1, 100), w(8, 8, 100), w(8, 15, 100),
  w(9, 1, 100), w(9, 8, 100), w(9, 15, 100), w(9, 22, 100),
  w(10, 2, 250), w(10, 9, 250), w(10, 16, 250), w(10, 18, 250),
];
const RUNS = [r(9, 5, 300), r(9, 12, 300), r(10, 20, 400)];

const text = (el) => [el.props.children].flat().join('');
const style = (el) => StyleSheet.flatten(el.props.style);

function draw({ workouts = WORKOUTS, runs = RUNS, level = 24, levelLine = '1,245 XP to Level 25' } = {}) {
  const totals = monthlyTotals({ workouts, runs, now: NOW });
  return render(<ProgressMonthCard totals={totals} monthName="November" level={level} levelLine={levelLine} />);
}

describe('the month so far, against last month', () => {
  it('has a November Summary and a Last 6 Months heading', () => {
    const { getByText } = draw();
    expect(getByText('November Summary')).toBeTruthy();
    expect(getByText('Last 6 Months')).toBeTruthy();
  });

  it('shows workouts, runs and calories with how each compares, and says so when it is the same', () => {
    const { getByTestId } = draw();
    expect(text(getByTestId('month-workouts'))).toBe('4');
    expect(text(getByTestId('month-workouts-line'))).toBe('Same as last month');
    expect(text(getByTestId('month-runs'))).toBe('1');
    expect(text(getByTestId('month-runs-line'))).toBe('-1 vs last month');
    expect(text(getByTestId('month-calories'))).toBe('1,400');
    expect(text(getByTestId('month-calories-line'))).toBe('+400 vs last month');
  });

  it('colours more than last month green, less orange and the same grey', () => {
    const { getByTestId } = draw();
    expect(style(getByTestId('month-calories-line')).color).toBe(GOOD);
    expect(style(getByTestId('month-runs-line')).color).toBe(WORSE);
    expect(style(getByTestId('month-workouts-line')).color).toBe(QUIET);
  });

  it('shows the level, with what is left to the next, where the XP box used to be', () => {
    const { getByTestId, queryByText } = draw();
    expect(text(getByTestId('month-level'))).toBe('24');
    expect(text(getByTestId('month-level-line'))).toBe('1,245 XP to Level 25');
    expect(queryByText('XP Earned')).toBeNull();
    expect(style(getByTestId('month-level-line')).color).toBe(QUIET);
  });

  it('shows the top level as it is told', () => {
    expect(text(draw({ level: 100, levelLine: 'Top level' }).getByTestId('month-level-line'))).toBe('Top level');
  });

  it('describes each tile to a screen reader', () => {
    const { getByLabelText } = draw();
    expect(getByLabelText('Calories: 1,400. +400 vs last month')).toBeTruthy();
    expect(getByLabelText('Level: 24. 1,245 XP to Level 25')).toBeTruthy();
  });
});

describe('the six months of bars', () => {
  it('draws a bar for each month with something in it, and a label for every month', () => {
    const { getByTestId, queryByTestId } = draw();
    [0, 2, 3, 4, 5].forEach((i) => expect(getByTestId(`month-bar-${i}`)).toBeTruthy());
    expect(queryByTestId('month-bar-1')).toBeNull(); // July: nothing
    expect(queryByTestId('month-value-1')).toBeNull();
    ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].forEach((label, i) => expect(text(getByTestId(`month-label-${i}`))).toBe(label));
  });

  it('shows sessions to begin with, the number over each bar, on a tidy scale', () => {
    const { getByTestId, queryByTestId } = draw();
    expect(getByTestId('month-measure-sessions').props.accessibilityState.selected).toBe(true);
    expect([0, 2, 3, 4, 5].map((i) => text(getByTestId(`month-value-${i}`)))).toEqual(['1', '2', '3', '6', '5']);
    expect(['0', '3', '6'].map((t) => text(getByTestId(`month-tick-${t}`)))).toEqual(['0', '3', '6']);
    expect(queryByTestId('month-tick-4')).toBeNull();
  });

  it('draws this month in black and the earlier ones in grey, with taller bars for more', () => {
    const { getByTestId } = draw();
    expect(style(getByTestId('month-bar-5')).backgroundColor).toBe(INK);
    expect(style(getByTestId('month-bar-4')).backgroundColor).toBe('#B5B5B5');
    expect(style(getByTestId('month-bar-4')).height).toBeGreaterThan(style(getByTestId('month-bar-5')).height);
    expect(style(getByTestId('month-bar-5')).height).toBeGreaterThan(style(getByTestId('month-bar-0')).height);
  });

  it('names the best month', () => {
    expect(text(draw().getByTestId('month-best'))).toBe('Best month: Oct · 6 sessions');
  });

  it('switches to calories, with its own scale, numbers and best month', () => {
    const { getByTestId } = draw();
    fireEvent.press(getByTestId('month-measure-calories'));
    expect(getByTestId('month-measure-calories').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('month-measure-sessions').props.accessibilityState.selected).toBe(false);
    expect(text(getByTestId('month-value-5'))).toBe('1.4k');
    expect(text(getByTestId('month-tick-1500'))).toBe('1.5k');
    expect(text(getByTestId('month-tick-750'))).toBe('750');
    expect(text(getByTestId('month-best'))).toBe('Best month: Nov · 1,400 calories');
  });

  it('describes the chart to a screen reader, whichever measure is shown', () => {
    const { getByTestId } = draw();
    expect(getByTestId('month-chart').props.accessibilityLabel).toBe('Sessions by month: Jun 1, Jul 0, Aug 2, Sep 3, Oct 6, Nov 5.');
    fireEvent.press(getByTestId('month-measure-calories'));
    expect(getByTestId('month-chart').props.accessibilityLabel).toBe('Calories by month: Jun 100, Jul 0, Aug 200, Sep 300, Oct 1000, Nov 1400.');
  });

  it('says "1 session" for a single one', () => {
    expect(text(draw({ workouts: [w(10, 2, 100)], runs: [] }).getByTestId('month-best'))).toBe('Best month: Nov · 1 session');
  });
});

describe('nothing in six months', () => {
  it('shows zeros, an empty chart with its labels, and says so', () => {
    const { getByTestId, queryByTestId } = draw({ workouts: [], runs: [] });
    expect(text(getByTestId('month-workouts'))).toBe('0');
    expect(text(getByTestId('month-calories'))).toBe('0');
    expect(text(getByTestId('month-calories-line'))).toBe('Same as last month');
    expect(queryByTestId('month-bar-5')).toBeNull();
    expect(text(getByTestId('month-label-5'))).toBe('Nov');
    expect(text(getByTestId('month-best'))).toBe('No sessions in the last 6 months yet.');
    fireEvent.press(getByTestId('month-measure-calories'));
    expect(text(getByTestId('month-best'))).toBe('No calories in the last 6 months yet.');
  });
});

describe('compact', () => {
  it.each([[0, '0'], [950, '950'], [1000, '1k'], [1500, '1.5k'], [9999, '10k'], [10000, '10k'], [12400, '12k']])('writes %s as %s', (n, shown) => {
    expect(compact(n)).toBe(shown);
  });
});

describe('barLayout', () => {
  it('scales each bar to the top of the scale, with nothing for a month with nothing', () => {
    const bars = barLayout([0, 5, 10], 10, 300, 110);
    expect(bars.map((b) => b.h)).toEqual([0, 55, 110]);
  });

  it('gives a small value a bar you can see, and never one taller than the plot', () => {
    const [tiny, over] = barLayout([0.01, 50], 10, 300, 110);
    expect(tiny.h).toBe(3);
    expect(over.h).toBe(110);
  });

  it('keeps every bar inside the plot, right of the numbers, with the same room each', () => {
    const bars = barLayout([1, 2, 3, 4, 5, 6], 6, 300, 110);
    bars.forEach((b) => {
      expect(b.x).toBeGreaterThanOrEqual(34);
      expect(b.x + b.w).toBeLessThanOrEqual(300);
    });
    const gaps = bars.slice(1).map((b, i) => Math.round(b.center - bars[i].center));
    expect(new Set(gaps).size).toBe(1);
  });

  it('copes with no values', () => {
    expect(barLayout([], 4, 300)).toEqual([]);
  });
});
