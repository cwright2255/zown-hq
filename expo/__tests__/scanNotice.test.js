// The notice before a person's first body scan (lib/scanNotice.js): when it is shown, what is saved when they agree, and that its points
// match what the app does.
import { SCAN_NOTICE_VERSION, SCAN_NOTICE_POINTS, hasAcceptedScanNotice, acceptedScanNotice } from '../lib/scanNotice';

describe('hasAcceptedScanNotice', () => {
  it('is false for someone who has not agreed, and for no one', () => {
    expect(hasAcceptedScanNotice(null)).toBe(false);
    expect(hasAcceptedScanNotice(undefined)).toBe(false);
    expect(hasAcceptedScanNotice({})).toBe(false);
    expect(hasAcceptedScanNotice({ bodyScanNotice: {} })).toBe(false);
    expect(hasAcceptedScanNotice({ bodyScanNotice: { version: 'abc' } })).toBe(false);
  });

  it('is true once they have agreed to the current notice', () => {
    expect(hasAcceptedScanNotice({ bodyScanNotice: { version: SCAN_NOTICE_VERSION, at: '2026-11-23T12:00:00.000Z' } })).toBe(true);
  });

  it('is true for a newer notice than this one, and false for an older one', () => {
    expect(hasAcceptedScanNotice({ bodyScanNotice: { version: SCAN_NOTICE_VERSION + 1 } })).toBe(true);
    expect(hasAcceptedScanNotice({ bodyScanNotice: { version: SCAN_NOTICE_VERSION - 1 } })).toBe(false);
  });
});

describe('acceptedScanNotice', () => {
  it('records the version agreed to and the time', () => {
    expect(acceptedScanNotice(new Date('2026-11-23T17:00:00.000Z'))).toEqual({ version: SCAN_NOTICE_VERSION, at: '2026-11-23T17:00:00.000Z' });
  });

  it('counts as agreed once saved on the profile', () => {
    expect(hasAcceptedScanNotice({ bodyScanNotice: acceptedScanNotice() })).toBe(true);
  });
});

describe('the points of the notice', () => {
  it('say that the images stay on the phone, that only numbers are saved, that they go to OpenAI, and how to erase them', () => {
    const all = SCAN_NOTICE_POINTS.map((p) => `${p.title} ${p.body}`).join(' ');
    expect(all).toMatch(/stay on your phone/i);
    expect(all).toMatch(/not saved and not uploaded/i);
    expect(all).toMatch(/only the numbers are saved/i);
    expect(all).toMatch(/OpenAI/);
    expect(all).toMatch(/do not sell your data/i);
    expect(all).toMatch(/Danger Zone/);
  });

  it('each has an icon, a title and a body', () => {
    for (const point of SCAN_NOTICE_POINTS) {
      expect(point.icon).toBeTruthy();
      expect(point.title).toBeTruthy();
      expect(point.body).toBeTruthy();
    }
  });
});
