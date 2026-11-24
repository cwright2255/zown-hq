// Progress tab > Goals: every goal with its bar and what is left, a goal the app counts says what it counts, and every goal can be edited,
// deleted or (when kept by hand) marked complete. Done goals sit under the others. The week is Mon 23 to Sun 29 Nov 2026, today is Thursday.
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import ProgressGoals from '../components/ProgressGoals';
import { GOOD, INK } from '../components/progressStyles';

const NOW = new Date(2026, 10, 26, 12, 0);
const workout = (m, d) => ({ completedAt: new Date(2026, m, d, 8).toISOString(), caloriesBurned: 300 });
const activity = {
  now: NOW,
  workouts: [workout(10, 23), workout(10, 3), workout(10, 10)], // one this week, three this month
  runs: [{ startTime: new Date(2026, 10, 24, 7).toISOString(), distance: 8.04672, calories: 500 }], // five miles
};

const HAND = { id: 'hand', title: 'Lose 10 lbs', target: 10, unit: 'lbs', current: 4, completed: false };
const WEEK = { id: 'week', title: '2 workouts a week', target: 2, unit: 'workouts', current: 0, metric: 'workouts', period: 'week' };
const MILES = { id: 'miles', title: 'Run 20 miles', target: 20, unit: 'mi', current: 0, metric: 'runDistance', period: 'month' };
const BOOKS = { id: 'books', title: 'Read 5 books', target: 5, unit: 'books', current: 5, completed: true };

const text = (el) => [el.props.children].flat().join('');
const fill = (el) => StyleSheet.flatten(el.props.style);

function draw(goals, props = {}) {
  const handlers = { onAdd: jest.fn(), onEdit: jest.fn(), onComplete: jest.fn(), onDelete: jest.fn() };
  const utils = render(<ProgressGoals goals={goals} activity={activity} {...handlers} {...props} />);
  return { ...utils, ...handlers };
}

describe('the goals', () => {
  it('has an Active Goals heading and an Add Goal link', () => {
    const { getByText, getByTestId, onAdd } = draw([HAND]);
    expect(getByText('Active Goals')).toBeTruthy();
    fireEvent.press(getByTestId('goal-add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows a goal kept by hand with its bar and what is left, and no tag', () => {
    const { getByTestId, queryByTestId, getByText } = draw([HAND]);
    expect(getByText('Lose 10 lbs')).toBeTruthy();
    expect(text(getByTestId('goal-progress-hand'))).toBe('4/10 lbs (40%)');
    expect(text(getByTestId('goal-detail-hand'))).toBe('6 lbs to go');
    expect(fill(getByTestId('goal-fill-hand')).width).toBe('40%');
    expect(queryByTestId('goal-tag-hand')).toBeNull();
  });

  it('shows goals the app counts from the records, and says what they count and over when', () => {
    const { getByTestId } = draw([WEEK, MILES]);
    expect(text(getByTestId('goal-tag-week'))).toBe('Workouts · This week');
    expect(text(getByTestId('goal-progress-week'))).toBe('1/2 workouts (50%)');
    expect(text(getByTestId('goal-detail-week'))).toBe('1 workout to go');
    expect(fill(getByTestId('goal-fill-week')).width).toBe('50%');
    expect(text(getByTestId('goal-tag-miles'))).toBe('Run distance · This month');
    expect(text(getByTestId('goal-progress-miles'))).toBe('5/20 mi (25%)');
    expect(text(getByTestId('goal-detail-miles'))).toBe('15 mi to go');
  });

  it('offers Mark complete only on a goal kept by hand that is not done', () => {
    const { getByTestId, queryByTestId, onComplete } = draw([HAND, WEEK, BOOKS]);
    expect(queryByTestId('goal-complete-week')).toBeNull();
    expect(queryByTestId('goal-complete-books')).toBeNull();
    fireEvent.press(getByTestId('goal-complete-hand'));
    expect(onComplete).toHaveBeenCalledWith('hand');
  });

  it('edits and deletes any goal by its id, and names the goal for a screen reader', () => {
    const { getByTestId, getByLabelText, onEdit, onDelete } = draw([HAND, WEEK]);
    fireEvent.press(getByTestId('goal-edit-week'));
    expect(onEdit).toHaveBeenCalledWith('week');
    fireEvent.press(getByTestId('goal-delete-hand'));
    expect(onDelete).toHaveBeenCalledWith('hand');
    expect(getByLabelText('Edit Lose 10 lbs')).toBeTruthy();
    expect(getByLabelText('Delete 2 workouts a week')).toBeTruthy();
    expect(getByLabelText('Mark Lose 10 lbs complete')).toBeTruthy();
    expect(getByLabelText('Add Goal')).toBeTruthy();
  });
});

describe('done goals', () => {
  it('put a finished goal under a Completed heading, green and still editable', () => {
    const { getByTestId, getByText } = draw([HAND, BOOKS]);
    expect(getByText('Completed')).toBeTruthy();
    expect(getByTestId('goals-done')).toBeTruthy();
    expect(text(getByTestId('goal-detail-books'))).toBe('Complete');
    expect(fill(getByTestId('goal-fill-books')).backgroundColor).toBe(GOOD);
    expect(fill(getByTestId('goal-fill-hand')).backgroundColor).toBe(INK);
    expect(getByTestId('goal-edit-books')).toBeTruthy();
    expect(getByTestId('goal-delete-books')).toBeTruthy();
  });

  it('call a tracked goal done for the week or month, not for good', () => {
    const { getByTestId } = draw([{ ...WEEK, id: 'easy', target: 1 }]);
    expect(text(getByTestId('goal-detail-easy'))).toBe('Done this week');
    expect(getByTestId('goals-done')).toBeTruthy();
  });

  it('show no Completed block while nothing is done', () => {
    const { queryByTestId, queryByText } = draw([HAND, WEEK]);
    expect(queryByTestId('goals-done')).toBeNull();
    expect(queryByText('Completed')).toBeNull();
  });
});

describe('no goals to do', () => {
  it('tells a person with none how to start', () => {
    const { getByTestId } = draw([]);
    expect(text(getByTestId('goals-empty'))).toBe('No goals yet. Tap "Add Goal" to set one, like 3 workouts a week.');
  });

  it('says so when every goal is done, and still shows them', () => {
    const { getByTestId } = draw([BOOKS]);
    expect(text(getByTestId('goals-empty'))).toBe('Every goal is done. Add another to keep going.');
    expect(getByTestId('goal-books')).toBeTruthy();
  });

  it('copes with goals that are not a list', () => {
    expect(draw(undefined).getByTestId('goals-empty')).toBeTruthy();
  });
});
