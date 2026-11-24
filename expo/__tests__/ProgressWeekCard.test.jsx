// Progress tab > This Week: the workouts, runs, calories and streak since Monday, and the seven days with the trained ones filled in.
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import ProgressWeekCard from '../components/ProgressWeekCard';
import { weekStrip, weekSummary } from '../lib/progressInsights';

const at = (d, h = 12) => new Date(2026, 10, d, h, 0);
const NOW = at(26); // Thursday 26 Nov 2026
const text = (el) => [el.props.children].flat().join('');

function draw({ workouts = [], runs = [], hikes = [], streak = 0 } = {}) {
  const props = { summary: weekSummary({ workouts, runs, now: NOW }), strip: weekStrip({ workouts, runs, hikes, now: NOW }), streak };
  return render(<ProgressWeekCard {...props} />);
}

describe('ProgressWeekCard', () => {
  it('shows the four numbers for the week', () => {
    const { getByTestId, getByText } = draw({
      workouts: [{ completedAt: at(23, 8).toISOString(), caloriesBurned: 300 }, { completedAt: at(25, 8).toISOString(), caloriesBurned: 1000 }],
      runs: [{ startTime: at(24, 7).toISOString(), calories: 450 }],
      streak: 4,
    });
    expect(getByText('This Week')).toBeTruthy();
    expect(text(getByTestId('week-workouts'))).toBe('2');
    expect(text(getByTestId('week-runs'))).toBe('1');
    expect(text(getByTestId('week-calories'))).toBe('1,750');
    expect(text(getByTestId('week-streak'))).toBe('4');
    ['Workouts', 'Runs', 'Calories', 'Day streak'].forEach((label) => expect(getByText(label)).toBeTruthy());
  });

  it('marks the days trained, today, and the days still to come, for a screen reader too', () => {
    const { getByTestId, getByText } = draw({
      workouts: [{ completedAt: at(23, 8).toISOString() }],
      hikes: [{ completedAt: at(25, 8).toISOString() }],
    });
    const label = (key) => getByTestId(`week-day-${key}`).props.accessibilityLabel;
    expect(label('2026-11-23')).toBe('Monday: trained');
    expect(label('2026-11-24')).toBe('Tuesday: no session');
    expect(label('2026-11-25')).toBe('Wednesday: trained');
    expect(label('2026-11-26')).toBe('Thursday, today: no session');
    expect(label('2026-11-27')).toBe('Friday: still to come');
    expect(label('2026-11-29')).toBe('Sunday: still to come');
    expect(getByText('2 of 7 days trained this week')).toBeTruthy();
  });

  it('says so when nothing has been done yet, with zeros and no fuss', () => {
    const { getByTestId } = draw();
    expect(text(getByTestId('week-workouts'))).toBe('0');
    expect(text(getByTestId('week-calories'))).toBe('0');
    expect(text(getByTestId('week-caption'))).toBe('Nothing yet this week. A workout or a run fills in a day.');
  });

  it('does not count last week', () => {
    const { getByTestId } = draw({ workouts: [{ completedAt: at(22, 23).toISOString(), caloriesBurned: 500 }] });
    expect(text(getByTestId('week-workouts'))).toBe('0');
    expect(text(getByTestId('week-caption'))).toMatch(/^Nothing yet/);
  });
});
