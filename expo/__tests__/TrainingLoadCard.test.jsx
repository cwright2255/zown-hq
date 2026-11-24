// The Training Load card (components/TrainingLoadCard.jsx) on the Health screen: the ratio with a scale under the bar once there is a
// reading, and before there is one, how many of the days it needs have something logged so far.
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import TrainingLoadCard from '../components/TrainingLoadCard';

const STEADY = { zone: 'sweet_spot', zoneLabel: 'In your typical training range', ratio: 1.1, acuteLoad: 2100, chronicWeeklyAvg: 1900 };
const TOO_EARLY = { zone: 'insufficient_data', zoneLabel: 'Not enough history yet', ratio: 0, acuteLoad: 0, chronicWeeklyAvg: 0 };

const flat = (node) => [].concat(...[].concat(node.props.style).map((s) => (Array.isArray(s) ? s : [s]))).filter(Boolean);
const pick = (node, key) => [...flat(node)].reverse().find((s) => s[key] !== undefined)?.[key];

describe('with no reading at all', () => {
  it('draws nothing', () => {
    expect(render(<TrainingLoadCard trainingLoad={null} />).toJSON()).toBeNull();
    expect(render(<TrainingLoadCard trainingLoad={undefined} daysLogged={3} />).toJSON()).toBeNull();
  });
});

describe('before there is enough history', () => {
  it('keeps saying it needs about a week of history', () => {
    const { getByText } = render(<TrainingLoadCard trainingLoad={TOO_EARLY} />);
    expect(getByText('Training Load')).toBeTruthy();
    expect(getByText(/needs about a week of history/)).toBeTruthy();
  });

  it('says how many of the 5 days it needs have a workout, run or hike so far, with a bar for it', () => {
    const { getByTestId } = render(<TrainingLoadCard trainingLoad={TOO_EARLY} daysLogged={2} daysNeeded={5} />);
    expect(getByTestId('training-load-days').props.children).toBe('2 of 5 days with a workout, run or hike so far');
    expect(pick(getByTestId('training-load-unlock'), 'width')).toBe('40%');
  });

  it('starts at none of them, with an empty bar', () => {
    const { getByTestId } = render(<TrainingLoadCard trainingLoad={TOO_EARLY} daysLogged={0} />);
    expect(getByTestId('training-load-days').props.children).toBe('0 of 5 days with a workout, run or hike so far');
    expect(pick(getByTestId('training-load-unlock'), 'width')).toBe('0%');
  });

  it('never shows more days than it needs', () => {
    const { getByTestId } = render(<TrainingLoadCard trainingLoad={TOO_EARLY} daysLogged={9} daysNeeded={5} />);
    expect(getByTestId('training-load-days').props.children).toBe('5 of 5 days with a workout, run or hike so far');
    expect(pick(getByTestId('training-load-unlock'), 'width')).toBe('100%');
  });

  it('says nothing about days when it was not told how many there are', () => {
    for (const props of [{}, { daysLogged: null }]) {
      const { queryByTestId } = render(<TrainingLoadCard trainingLoad={TOO_EARLY} {...props} />);
      expect(queryByTestId('training-load-days')).toBeNull();
      expect(queryByTestId('training-load-unlock')).toBeNull();
    }
  });

  it('shows no scale, because there is no ratio to place on it', () => {
    const { queryByTestId } = render(<TrainingLoadCard trainingLoad={TOO_EARLY} daysLogged={2} />);
    expect(queryByTestId('training-load-scale')).toBeNull();
  });
});

describe('with a reading', () => {
  it('shows the ratio, the zone and the kcal behind it', () => {
    const { getByText } = render(<TrainingLoadCard trainingLoad={STEADY} daysLogged={20} />);
    expect(getByText('1.10')).toBeTruthy();
    expect(getByText('In your typical training range')).toBeTruthy();
    expect(getByText('2100 kcal this week vs. 1900 kcal your usual week')).toBeTruthy();
  });

  it('labels the three stretches of the bar: below usual, typical, higher, in the widths the bar draws them', () => {
    const { getByTestId, getByText } = render(<TrainingLoadCard trainingLoad={STEADY} />);
    expect(getByTestId('training-load-scale')).toBeTruthy();
    expect(pick(getByText('Below usual'), 'flex')).toBe(40);
    expect(pick(getByText('Typical'), 'flex')).toBe(25);
    expect(pick(getByText('Higher'), 'flex')).toBe(35);
    const text = JSON.stringify(getByTestId('training-load-scale').props.children.map((c) => c.props.children));
    expect(text.indexOf('Below usual')).toBeLessThan(text.indexOf('Typical'));
    expect(text.indexOf('Typical')).toBeLessThan(text.indexOf('Higher'));
  });

  it('does not show the days it needed, which it has now', () => {
    const { queryByTestId } = render(<TrainingLoadCard trainingLoad={STEADY} daysLogged={20} />);
    expect(queryByTestId('training-load-days')).toBeNull();
    expect(queryByTestId('training-load-unlock')).toBeNull();
  });

  it('shows the comment on the week when there is one, and nothing when there is none', () => {
    expect(render(<TrainingLoadCard trainingLoad={STEADY} aiInsight="A steady week." />).getByText('A steady week.')).toBeTruthy();
    expect(render(<TrainingLoadCard trainingLoad={STEADY} aiInsight={null} />).queryByText('A steady week.')).toBeNull();
  });
});
