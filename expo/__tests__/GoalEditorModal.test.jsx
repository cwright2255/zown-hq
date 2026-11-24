// Progress tab > the goal form: add a goal, or change one. It collects text; lib/goalTracking.js parseGoalForm decides what may be saved.
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import GoalEditorModal from '../components/GoalEditorModal';

const text = (el) => [el.props.children].flat().join('');

function draw(props = {}) {
  const handlers = { onCancel: jest.fn(), onSave: jest.fn().mockResolvedValue(undefined) };
  const utils = render(<GoalEditorModal visible goal={null} units="imperial" {...handlers} {...props} />);
  return { ...utils, ...handlers };
}
const type = (utils, id, value) => fireEvent.changeText(utils.getByTestId(id), value);

describe('a new goal kept by hand', () => {
  it('opens empty, as New Goal, with the fields for a goal kept by hand', () => {
    const u = draw();
    expect(u.getByText('New Goal')).toBeTruthy();
    expect(u.getByText('Save Goal')).toBeTruthy();
    expect(u.getByTestId('goal-title').props.value).toBe('');
    expect(u.getByTestId('goal-track-hand').props.accessibilityState.selected).toBe(true);
    expect(text(u.getByTestId('goal-track-help'))).toBe('You update how far along it is yourself.');
    expect(u.getByTestId('goal-unit')).toBeTruthy();
    expect(u.getByTestId('goal-current')).toBeTruthy();
    expect(u.queryByTestId('goal-period-week')).toBeNull();
  });

  it('saves what was typed', async () => {
    const u = draw();
    type(u, 'goal-title', '  Lose 10 lbs ');
    type(u, 'goal-target', '10');
    type(u, 'goal-unit', 'lbs');
    type(u, 'goal-current', '4');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalledTimes(1));
    expect(u.onSave).toHaveBeenCalledWith({ title: 'Lose 10 lbs', target: 10, unit: 'lbs', current: 4, completed: false, metric: null, period: null });
  });

  it('is complete on save when the progress already reaches the target', async () => {
    const u = draw();
    type(u, 'goal-title', 'Read 5 books');
    type(u, 'goal-target', '5');
    type(u, 'goal-current', '5');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalled());
    expect(u.onSave.mock.calls[0][0]).toMatchObject({ current: 5, completed: true });
  });
});

describe('what the form refuses', () => {
  it.each([
    ['no name', { target: '5' }, 'Give the goal a name.'],
    ['no target', { title: 'Run' }, 'Enter a target above zero.'],
    ['a target of zero', { title: 'Run', target: '0' }, 'Enter a target above zero.'],
    ['a target that is not a number', { title: 'Run', target: 'lots' }, 'Enter a target above zero.'],
    ['progress below zero', { title: 'Run', target: '5', current: '-1' }, 'Progress has to be zero or more.'],
  ])('says what is wrong with %s, and saves nothing', (name, fields, message) => {
    const u = draw();
    Object.entries({ 'goal-title': fields.title, 'goal-target': fields.target, 'goal-current': fields.current }).forEach(([id, value]) => {
      if (value !== undefined) type(u, id, value);
    });
    fireEvent.press(u.getByTestId('goal-save'));
    expect(text(u.getByTestId('goal-error'))).toBe(message);
    expect(u.onSave).not.toHaveBeenCalled();
  });

  it('clears the message once the form is good', async () => {
    const u = draw();
    fireEvent.press(u.getByTestId('goal-save'));
    expect(u.getByTestId('goal-error')).toBeTruthy();
    type(u, 'goal-title', 'Run');
    type(u, 'goal-target', '3');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalled());
    expect(u.queryByTestId('goal-error')).toBeNull();
  });

  it('shows the reason when saving fails, and lets the person try again', async () => {
    const onSave = jest.fn().mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce(undefined);
    const u = draw({ onSave });
    type(u, 'goal-title', 'Run');
    type(u, 'goal-target', '3');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(text(u.getByTestId('goal-error'))).toBe('Network down'));
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(u.queryByTestId('goal-error')).toBeNull());
  });
});

describe('a goal the app counts', () => {
  it('shows This week / This month and drops the fields for a goal kept by hand', () => {
    const u = draw();
    fireEvent.press(u.getByTestId('goal-track-workouts'));
    expect(u.getByTestId('goal-track-workouts').props.accessibilityState.selected).toBe(true);
    expect(u.getByTestId('goal-period-week').props.accessibilityState.selected).toBe(true);
    expect(u.getByTestId('goal-period-month').props.accessibilityState.selected).toBe(false);
    expect(u.queryByTestId('goal-unit')).toBeNull();
    expect(u.queryByTestId('goal-current')).toBeNull();
    expect(u.getByText('Target (workouts)')).toBeTruthy();
    expect(text(u.getByTestId('goal-track-help'))).toBe('The app counts it from your workouts and runs, so it moves on its own.');
  });

  it('saves workouts over a month', async () => {
    const u = draw();
    fireEvent.press(u.getByTestId('goal-track-workouts'));
    fireEvent.press(u.getByTestId('goal-period-month'));
    type(u, 'goal-title', '12 workouts a month');
    type(u, 'goal-target', '12');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalled());
    expect(u.onSave).toHaveBeenCalledWith({ title: '12 workouts a month', target: 12, unit: 'workouts', current: 0, completed: false, metric: 'workouts', period: 'month' });
  });

  it('keeps a run distance goal in miles or kilometres, as Settings has it', async () => {
    const miles = draw({ units: 'imperial' });
    fireEvent.press(miles.getByTestId('goal-track-runDistance'));
    expect(miles.getByText('Target (mi)')).toBeTruthy();
    type(miles, 'goal-title', 'Run 20 miles');
    type(miles, 'goal-target', '20');
    fireEvent.press(miles.getByTestId('goal-save'));
    await waitFor(() => expect(miles.onSave).toHaveBeenCalled());
    expect(miles.onSave.mock.calls[0][0]).toMatchObject({ unit: 'mi', metric: 'runDistance', period: 'week' });

    const km = draw({ units: 'metric' });
    fireEvent.press(km.getByTestId('goal-track-runDistance'));
    expect(km.getByText('Target (km)')).toBeTruthy();
  });

  it('saves calories', async () => {
    const u = draw();
    fireEvent.press(u.getByTestId('goal-track-calories'));
    expect(u.getByText('Target (cal)')).toBeTruthy();
    type(u, 'goal-title', 'Burn 3000');
    type(u, 'goal-target', '3000');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalled());
    expect(u.onSave.mock.calls[0][0]).toMatchObject({ unit: 'cal', metric: 'calories', target: 3000 });
  });

  it('goes back to the fields for a goal kept by hand', () => {
    const u = draw();
    fireEvent.press(u.getByTestId('goal-track-calories'));
    fireEvent.press(u.getByTestId('goal-track-hand'));
    expect(u.getByTestId('goal-unit')).toBeTruthy();
    expect(u.queryByTestId('goal-period-week')).toBeNull();
  });
});

describe('changing a goal', () => {
  const HAND = { id: 'g1', title: 'Lose 10 lbs', target: 10, unit: 'lbs', current: 4, completed: false };
  const KM = { id: 'g2', title: 'Run 30 km', target: 30, unit: 'km', current: 0, metric: 'runDistance', period: 'month' };

  it('opens with the goal in the form', () => {
    const u = draw({ goal: HAND });
    expect(u.getByText('Edit Goal')).toBeTruthy();
    expect(u.getByText('Save Changes')).toBeTruthy();
    expect(u.getByTestId('goal-title').props.value).toBe('Lose 10 lbs');
    expect(u.getByTestId('goal-target').props.value).toBe('10');
    expect(u.getByTestId('goal-unit').props.value).toBe('lbs');
    expect(u.getByTestId('goal-current').props.value).toBe('4');
  });

  it('saves a new target and progress', async () => {
    const u = draw({ goal: HAND });
    type(u, 'goal-target', '8');
    type(u, 'goal-current', '8');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalled());
    expect(u.onSave).toHaveBeenCalledWith({ title: 'Lose 10 lbs', target: 8, unit: 'lbs', current: 8, completed: true, metric: null, period: null });
  });

  it('keeps the progress when the field is emptied', async () => {
    const u = draw({ goal: HAND });
    type(u, 'goal-current', '');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalled());
    expect(u.onSave.mock.calls[0][0]).toMatchObject({ current: 4, completed: false });
  });

  it('opens a goal the app counts with its tracking and period chosen', () => {
    const u = draw({ goal: KM, units: 'imperial' });
    expect(u.getByTestId('goal-track-runDistance').props.accessibilityState.selected).toBe(true);
    expect(u.getByTestId('goal-period-month').props.accessibilityState.selected).toBe(true);
    expect(u.getByText('Target (km)')).toBeTruthy(); // the unit it was made in, not today's Settings
  });

  it('keeps a distance goal in the unit it was made in, whatever Settings say now', async () => {
    const u = draw({ goal: KM, units: 'imperial' });
    type(u, 'goal-target', '40');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalled());
    expect(u.onSave.mock.calls[0][0]).toMatchObject({ target: 40, unit: 'km', metric: 'runDistance', period: 'month' });
  });

  it('turns a goal kept by hand into one the app counts', async () => {
    const u = draw({ goal: HAND });
    fireEvent.press(u.getByTestId('goal-track-workouts'));
    type(u, 'goal-target', '3');
    fireEvent.press(u.getByTestId('goal-save'));
    await waitFor(() => expect(u.onSave).toHaveBeenCalled());
    expect(u.onSave.mock.calls[0][0]).toEqual({ title: 'Lose 10 lbs', target: 3, unit: 'workouts', current: 0, completed: false, metric: 'workouts', period: 'week' });
  });
});

describe('opening, typing and closing', () => {
  it('keeps what is typed while the form is open', () => {
    const u = draw();
    type(u, 'goal-title', 'Run');
    type(u, 'goal-target', '5');
    expect(u.getByTestId('goal-title').props.value).toBe('Run');
    expect(u.getByTestId('goal-target').props.value).toBe('5');
  });

  it('starts again each time it opens', () => {
    const u = draw();
    type(u, 'goal-title', 'Half written');
    fireEvent.press(u.getByTestId('goal-save'));
    expect(u.getByTestId('goal-error')).toBeTruthy();
    const next = <GoalEditorModal visible={false} goal={null} units="imperial" onCancel={u.onCancel} onSave={u.onSave} />;
    u.rerender(next);
    u.rerender(<GoalEditorModal visible goal={null} units="imperial" onCancel={u.onCancel} onSave={u.onSave} />);
    expect(u.getByTestId('goal-title').props.value).toBe('');
    expect(u.queryByTestId('goal-error')).toBeNull();
  });

  it('cancels', () => {
    const u = draw();
    fireEvent.press(u.getByTestId('goal-cancel'));
    expect(u.onCancel).toHaveBeenCalledTimes(1);
    expect(u.onSave).not.toHaveBeenCalled();
  });

  it('shows nothing while closed', () => {
    expect(render(<GoalEditorModal visible={false} goal={null} onCancel={jest.fn()} onSave={jest.fn()} />).queryByTestId('goal-editor')).toBeNull();
  });
});
