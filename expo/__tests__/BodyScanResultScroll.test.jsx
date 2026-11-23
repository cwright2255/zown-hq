// The result page of a body scan (app/body-scan/[id].jsx): the 3D model stays put at the top and everything under it scrolls, so a long
// insight or the comparison is never cut off at the bottom of the screen, and the last button clears the phone's bottom edge.
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { act, render, within } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 's2' }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}), { virtual: true });
jest.mock('expo-gl', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { GLView: (props) => mockReact.createElement(mockRn.View, { testID: 'gl-view', style: props.style }) };
}, { virtual: true });
jest.mock('expo-three', () => ({ Renderer: class {} }), { virtual: true });
jest.mock('three', () => ({}), { virtual: true });
jest.mock('@/lib/loadScanMesh', () => ({ loadScanMesh: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    SafeAreaView: (props) => mockReact.createElement(mockRn.View, props),
    useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
  };
}, { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));

const scan = (id, waist, createdAtLocal) => ({
  id, bodyFatPercent: 24.2, bmi: 35, createdAtLocal,
  measurements: { shoulderWidthCm: 44, waistCircumferenceCm: waist, hipCircumferenceCm: 75.5 },
});
const mockScans = [scan('s1', 95.1, '2026-10-01T12:00:00.000Z'), scan('s2', 94.6, '2026-11-23T12:00:00.000Z')];
jest.mock('@/store/bodyCompositionStore', () => ({
  useBodyCompositionStore: () => ({
    scans: mockScans,
    loadScans: jest.fn(),
    latestInsight: {
      trend: 'stable',
      summary: 'The body composition scans show that your waist circumference has decreased slightly, while hip circumference is stable.',
      suggestion: 'To promote weight loss, consider incorporating a combination of strength training and cardiovascular exercises.',
    },
    getComparisonPair: () => ({ latest: mockScans[1], previous: mockScans[0] }),
  }),
}));

import BodyScanViewerScreen from '../app/body-scan/[id]';

const renderScreen = async () => {
  const utils = render(<BodyScanViewerScreen />);
  await act(async () => {});
  return utils;
};

describe('the body scan result page', () => {
  it('scrolls, with the stats, the insight, the comparison and the button inside the scrolling part', async () => {
    const utils = await renderScreen();
    const scroll = within(utils.getByTestId('scan-result-scroll'));
    expect(utils.UNSAFE_getAllByType(ScrollView).length).toBeGreaterThan(0);
    expect(scroll.getByText('Est. body fat')).toBeTruthy();
    expect(scroll.getAllByText('Waist')).toHaveLength(2); // the stat, and its row in the comparison
    expect(scroll.getByText(/Navy circumference method/)).toBeTruthy();
    expect(scroll.getByText(/waist circumference has decreased slightly/)).toBeTruthy();
    expect(scroll.getByText(/strength training and cardiovascular/)).toBeTruthy();
    expect(scroll.getByText(/days ago/)).toBeTruthy();
    expect(scroll.getByText('Shoulder width')).toBeTruthy();
    expect(scroll.getByText('View Progress')).toBeTruthy();
  });

  it('keeps the 3D model out of the scrolling part, so turning it never fights the scroll', async () => {
    const utils = await renderScreen();
    const scroll = within(utils.getByTestId('scan-result-scroll'));
    expect(utils.getByTestId('gl-view')).toBeTruthy();
    expect(scroll.queryByTestId('gl-view')).toBeNull();
    expect(scroll.queryByText('Drag to rotate')).toBeNull();
    expect(utils.getByText('Drag to rotate')).toBeTruthy();
  });

  it('takes the room left under the model, and leaves the bottom edge of the phone clear', async () => {
    const utils = await renderScreen();
    const scroll = utils.getByTestId('scan-result-scroll');
    expect(StyleSheet.flatten(scroll.props.style).flex).toBe(1);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(34);
  });
});
