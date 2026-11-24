// The Muscle Heatmap card takes an optional `style` for the outside of the card, so a screen can give it the margins and look of the cards
// around it (the Health screen does). Without one it looks as it always has. Only the outside is looked at here: the pictures need a scan or
// the diagram service, which are not what is checked.
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/services/muscleVisualizerService', () => ({
  getWorkoutVisualizeImage: jest.fn(async () => null),
  getHeatmapVisualizeImage: jest.fn(async () => null),
}));
jest.mock('@/components/MuscleMeshHighlight', () => () => null);

import MuscleHeatmapCard from '../components/MuscleHeatmapCard';

const flat = (node) => [].concat(...[].concat(node.props.style).map((s) => (Array.isArray(s) ? s : [s]))).filter(Boolean);
const pick = (node, key) => [...flat(node)].reverse().find((s) => s[key] !== undefined)?.[key];

describe('the outside of the card', () => {
  it('takes the style it is given, on top of its own', () => {
    const { toJSON } = render(<MuscleHeatmapCard mode="fatigue" title="Muscle Fatigue" style={{ marginHorizontal: 20, borderRadius: 16 }} />);
    const card = toJSON();
    expect(pick(card, 'marginHorizontal')).toBe(20);
    expect(pick(card, 'borderRadius')).toBe(16); // the given style wins over the card's own corners
    expect(pick(card, 'padding')).toBeDefined(); // what it was not given stays as it was
  });

  it('looks as it always has when it is given none', () => {
    const { toJSON } = render(<MuscleHeatmapCard mode="fatigue" title="Muscle Fatigue" />);
    const card = toJSON();
    expect(pick(card, 'marginHorizontal')).toBeUndefined();
    expect(pick(card, 'padding')).toBeDefined();
    expect(pick(card, 'backgroundColor')).toBeDefined();
  });
});
