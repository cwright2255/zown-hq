// Progress tab > Body Scans: one card with the latest scan's body fat, lean mass and BMI, what changed since the one before, the New Scan
// button and the scan viewer. The first case is the screen as it was found: two scans, 8/12/2026 and 11/23/2026, both 24.2% and BMI 35.
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('@/components/ScanMeshPreview', () => ({ __esModule: true, default: 'ScanMeshPreview' }));

import { router } from 'expo-router';
import ProgressScansCard from '../components/ProgressScansCard';

const scan = (id, date, extra = {}) => ({
  id, createdAtLocal: date.toISOString(), bodyFatPercent: 24.2, weightKg: 104.3, bmi: 35, measurements: {}, ...extra,
});
const AUG = scan('aug', new Date(2026, 7, 12, 10));
const NOV = scan('nov', new Date(2026, 10, 23, 10));
const text = (el) => [el.props.children].flat().join('');
const colorOf = (el) => StyleSheet.flatten(el.props.style).color;

beforeEach(() => router.push.mockClear());

describe('the two identical scans', () => {
  it('shows the latest scan, with its date', () => {
    const { getByTestId, getByText } = render(<ProgressScansCard scans={[AUG, NOV]} />);
    expect(getByText('Latest Scan')).toBeTruthy();
    expect(text(getByTestId('scan-date'))).toBe('11/23/2026');
    expect(text(getByTestId('scan-bodyFat'))).toBe('24.2%');
    expect(text(getByTestId('scan-leanMass'))).toBe('174 lbs');
    expect(text(getByTestId('scan-bmi'))).toBe('35');
  });

  it('says "No change" for each, in grey, and which scan it compares with', () => {
    const { getByTestId } = render(<ProgressScansCard scans={[AUG, NOV]} />);
    ['bodyFat', 'leanMass', 'bmi'].forEach((key) => {
      expect(text(getByTestId(`scan-${key}-change`))).toBe('No change');
      expect(colorOf(getByTestId(`scan-${key}-change`))).toBe('#999999');
    });
    expect(text(getByTestId('scan-caption'))).toBe('Change since your scan on 8/12/2026');
  });

  it('is one card: a single Body Scans heading, with the viewer inside it and no second history list', () => {
    const { getAllByText, getByTestId, queryByText } = render(<ProgressScansCard scans={[AUG, NOV]} />);
    expect(getAllByText('Body Scans')).toHaveLength(1);
    expect(getByTestId('scan-viewer')).toBeTruthy();
    expect(queryByText('Scan History')).toBeNull();
    expect(queryByText('Compare Scans')).toBeNull();
    ['Current', 'Pick one', 'Compare'].forEach((label) => expect(getAllByText(label)).toHaveLength(1));
  });
});

describe('what changed', () => {
  it('shows body fat and BMI going down in green, and lean mass going down in orange', () => {
    const before = scan('a', new Date(2026, 8, 1), { bodyFatPercent: 25.4, bmi: 36.2, weightKg: 108 });
    const { getByTestId } = render(<ProgressScansCard scans={[before, NOV]} />);
    expect(text(getByTestId('scan-bodyFat-change'))).toBe('↓ 1.2%');
    expect(colorOf(getByTestId('scan-bodyFat-change'))).toBe('#22C55E');
    expect(text(getByTestId('scan-bmi-change'))).toBe('↓ 1.2');
    expect(colorOf(getByTestId('scan-bmi-change'))).toBe('#22C55E');
    expect(text(getByTestId('scan-leanMass-change'))).toBe('↓ 4 lbs');
    expect(colorOf(getByTestId('scan-leanMass-change'))).toBe('#F97316');
  });

  it('compares with the scan just before the latest, not the first', () => {
    const first = scan('a', new Date(2026, 6, 1), { bodyFatPercent: 30 });
    const second = scan('b', new Date(2026, 8, 1), { bodyFatPercent: 25.2 });
    const { getByTestId } = render(<ProgressScansCard scans={[first, second, NOV]} />);
    expect(text(getByTestId('scan-bodyFat-change'))).toBe('↓ 1.0%');
    expect(text(getByTestId('scan-caption'))).toBe('Change since your scan on 9/1/2026');
  });
});

describe('a first scan', () => {
  it('shows the values with nothing to compare, and says what the next scan will do', () => {
    const { getByTestId } = render(<ProgressScansCard scans={[NOV]} />);
    expect(text(getByTestId('scan-bodyFat'))).toBe('24.2%');
    expect(text(getByTestId('scan-bodyFat-change')).trim()).toBe('');
    expect(text(getByTestId('scan-caption'))).toBe('Your first scan. Scan again to see what changed.');
  });

  it('shows a dash for a reading the scan does not have', () => {
    const { getByTestId } = render(<ProgressScansCard scans={[scan('x', new Date(2026, 10, 1), { weightKg: undefined })]} />);
    expect(text(getByTestId('scan-leanMass'))).toBe('—');
  });
});

describe('no scans yet', () => {
  it('has a plain empty state, the New Scan button and no viewer', () => {
    const { getByTestId, queryByTestId, getByText } = render(<ProgressScansCard scans={[]} />);
    expect(getByTestId('scan-empty')).toBeTruthy();
    expect(getByText('Scan your body to track body fat, lean mass and BMI over time.')).toBeTruthy();
    expect(queryByTestId('scan-viewer')).toBeNull();
    expect(queryByTestId('scan-open')).toBeNull();
    fireEvent.press(getByTestId('scan-new'));
    expect(router.push).toHaveBeenCalledWith('/body-scan/capture');
  });

  it('copes with scans that are not a list', () => {
    expect(render(<ProgressScansCard scans={undefined} />).getByTestId('scan-empty')).toBeTruthy();
  });
});

describe('where the buttons go', () => {
  it('opens the latest scan from the stats, and a new scan from New Scan', () => {
    const { getByTestId } = render(<ProgressScansCard scans={[AUG, NOV]} />);
    fireEvent.press(getByTestId('scan-open'));
    expect(router.push).toHaveBeenLastCalledWith('/body-scan/nov');
    fireEvent.press(getByTestId('scan-new'));
    expect(router.push).toHaveBeenLastCalledWith('/body-scan/capture');
  });

  it('picks any past scan in the viewer and shows its numbers', () => {
    const old = scan('old', new Date(2026, 5, 1), { bodyFatPercent: 28.5, bmi: 38 });
    const { getByText, getByTestId } = render(<ProgressScansCard scans={[old, NOV]} />);
    fireEvent.press(getByText('Pick one'));
    expect(text(getByTestId('scan-picked-line'))).toBe('24.2% body fat · 174 lbs lean · BMI 35');
    fireEvent.press(getByText('6/1/2026'));
    expect(text(getByTestId('scan-picked-line'))).toBe('28.5% body fat · 164 lbs lean · BMI 38');
  });

  it('compares two scans in the viewer and opens the full comparison', () => {
    const { getByText } = render(<ProgressScansCard scans={[AUG, NOV]} />);
    fireEvent.press(getByText('Compare'));
    fireEvent.press(getByText('Open Full Comparison'));
    expect(router.push).toHaveBeenLastCalledWith('/body-scan/compare?a=aug&b=nov');
  });
});
