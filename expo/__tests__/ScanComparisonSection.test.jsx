// The scan viewer (Current / Pick one / Compare). On its own it is a titled card; inside the Progress scan card (embedded) it has no title
// and no card of its own, and the stats above it are the way to the latest scan, so it has no second button for that.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }), { virtual: true });
jest.mock('@/components/ScanMeshPreview', () => ({ __esModule: true, default: 'ScanMeshPreview' }));

import { router } from 'expo-router';
import ScanComparisonSection from '../components/ScanComparisonSection';

const scan = (id, date) => ({ id, createdAtLocal: date.toISOString(), bodyFatPercent: 24.2, weightKg: 104.3, bmi: 35, measurements: {} });
const SCANS = [scan('aug', new Date(2026, 7, 12)), scan('nov', new Date(2026, 10, 23))];

beforeEach(() => router.push.mockClear());

describe('on its own', () => {
  it('has the Body Scans title and a View Full Scan button for the latest scan', () => {
    const { getByText } = render(<ScanComparisonSection scans={SCANS} />);
    expect(getByText('Body Scans')).toBeTruthy();
    fireEvent.press(getByText('View Full Scan'));
    expect(router.push).toHaveBeenCalledWith('/body-scan/nov');
  });

  it('shows nothing without scans', () => {
    expect(render(<ScanComparisonSection scans={[]} />).toJSON()).toBeNull();
  });
});

describe('embedded in the Progress scan card', () => {
  it('has no title of its own and no second button for the latest scan', () => {
    const { queryByText, getByText } = render(<ScanComparisonSection scans={SCANS} embedded />);
    expect(queryByText('Body Scans')).toBeNull();
    expect(queryByText('View Full Scan')).toBeNull();
    ['Current', 'Pick one', 'Compare'].forEach((label) => expect(getByText(label)).toBeTruthy());
  });

  it('still opens whichever scan is picked, which the stats above do not', () => {
    const { getByText } = render(<ScanComparisonSection scans={SCANS} embedded />);
    fireEvent.press(getByText('Pick one'));
    fireEvent.press(getByText(new Date(2026, 7, 12).toLocaleDateString()));
    fireEvent.press(getByText('View Full Scan'));
    expect(router.push).toHaveBeenCalledWith('/body-scan/aug');
  });
});
