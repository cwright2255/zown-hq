// The notice shown once before a person's first body scan (components/ScanNotice.jsx).
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }), { virtual: true });

import ScanNotice from '../components/ScanNotice';
import { SCAN_NOTICE_POINTS } from '../lib/scanNotice';

const setup = () => {
  const handlers = { onAgree: jest.fn(), onDecline: jest.fn(), onOpenPolicy: jest.fn() };
  const utils = render(<ScanNotice {...handlers} />);
  return { ...utils, ...handlers };
};

describe('ScanNotice', () => {
  it('shows every point of the notice', () => {
    const { getByText } = setup();
    expect(getByText('Before your first body scan')).toBeTruthy();
    for (const point of SCAN_NOTICE_POINTS) {
      expect(getByText(point.title)).toBeTruthy();
      expect(getByText(point.body)).toBeTruthy();
    }
    expect(getByText('A scan is an estimate, not medical advice.')).toBeTruthy();
  });

  it('agrees when the person taps continue, and does nothing else', () => {
    const { getByText, onAgree, onDecline, onOpenPolicy } = setup();
    fireEvent.press(getByText('I understand, continue'));
    expect(onAgree).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
    expect(onOpenPolicy).not.toHaveBeenCalled();
  });

  it('declines when the person taps not now, and does not agree', () => {
    const { getByText, onAgree, onDecline } = setup();
    fireEvent.press(getByText('Not now'));
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onAgree).not.toHaveBeenCalled();
  });

  it('opens the privacy policy without agreeing', () => {
    const { getByText, onAgree, onOpenPolicy } = setup();
    fireEvent.press(getByText('Read the Privacy Policy'));
    expect(onOpenPolicy).toHaveBeenCalledTimes(1);
    expect(onAgree).not.toHaveBeenCalled();
  });
});
