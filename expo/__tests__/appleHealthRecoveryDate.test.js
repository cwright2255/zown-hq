// The latest resting heart rate and HRV from Apple Health (services/appleHealthService.js getTodayRecovery) come with the time each sample
// was taken, so the Health screen can say how old a reading is. They are the latest samples, not always from today.
import { Platform } from 'react-native';

// The package is native, so tests stand in for it.
const mockHK = { getMostRecentQuantitySample: jest.fn(async () => null) };
jest.mock('@kingstinct/react-native-healthkit', () => mockHK, { virtual: true });

import { appleHealthService } from '../services/appleHealthService';

const RHR = 'HKQuantityTypeIdentifierRestingHeartRate';
const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
const sample = (quantity, endDate, startDate = endDate) => ({ quantity, startDate, endDate });

const answer = (byType) => mockHK.getMostRecentQuantitySample.mockImplementation(async (type) => byType[type] ?? null);

beforeEach(() => {
  Platform.OS = 'ios';
  mockHK.getMostRecentQuantitySample.mockReset().mockResolvedValue(null);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('getTodayRecovery', () => {
  it('returns the readings with the moment each was taken, as an ISO time', async () => {
    answer({ [RHR]: sample(58, new Date('2026-10-20T11:00:00Z')), [HRV]: sample(42, new Date('2026-10-18T06:30:00Z')) });
    expect(await appleHealthService.getTodayRecovery()).toEqual({
      restingHeartRate: 58,
      hrv: 42,
      restingHeartRateAt: '2026-10-20T11:00:00.000Z',
      hrvAt: '2026-10-18T06:30:00.000Z',
      sleepEfficiency: null,
      sleepHours: null,
      source: 'Apple Health',
    });
  });

  it('takes the end of the sample, then its start, and reads times given as text', async () => {
    answer({ [RHR]: sample(58, '2026-10-20T11:00:00Z', '2026-10-20T10:00:00Z'), [HRV]: { quantity: 42, startDate: '2026-10-19T08:00:00Z' } });
    const out = await appleHealthService.getTodayRecovery();
    expect(out.restingHeartRateAt).toBe('2026-10-20T11:00:00.000Z');
    expect(out.hrvAt).toBe('2026-10-19T08:00:00.000Z');
  });

  it('gives no time, rather than a wrong one, for a sample without a usable time', async () => {
    answer({ [RHR]: { quantity: 58 }, [HRV]: sample(42, 'not a time') });
    const out = await appleHealthService.getTodayRecovery();
    expect(out.restingHeartRateAt).toBeNull();
    expect(out.hrvAt).toBeNull();
    expect(out.restingHeartRate).toBe(58);
    expect(out.hrv).toBe(42);
  });

  it('gives a time only for the reading it has', async () => {
    answer({ [HRV]: sample(42, new Date('2026-10-20T11:00:00Z')) });
    const out = await appleHealthService.getTodayRecovery();
    expect(out).toMatchObject({ restingHeartRate: null, restingHeartRateAt: null, hrv: 42, hrvAt: '2026-10-20T11:00:00.000Z' });
  });

  it('returns nothing with neither reading, and nothing off an iPhone', async () => {
    expect(await appleHealthService.getTodayRecovery()).toBeNull();
    Platform.OS = 'android';
    answer({ [RHR]: sample(58, new Date()) });
    expect(await appleHealthService.getTodayRecovery()).toBeNull();
  });
});
