// The first body scan opens with a notice (components/ScanNotice.jsx) before anything else. Until the person has agreed to it the camera
// is not shown and not asked for, so the phone's camera prompt never comes before they know what a scan keeps. Once they have agreed,
// the scan screen is as it always was.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUpdateUser = jest.fn();
const mockSaveProfile = jest.fn();
const mockRequestPermission = jest.fn();
let mockUser;
let mockHasPermission;

jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, replace: jest.fn(), push: mockPush }) }), { virtual: true });
jest.mock('react-native-vision-camera', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    Camera: (props) => mockReact.createElement(mockRn.View, { testID: 'camera', style: props.style }),
    useCameraDevice: () => ({ id: 'front' }),
    useCameraPermission: () => ({ hasPermission: mockHasPermission, requestPermission: mockRequestPermission }),
    useFrameProcessor: () => ({}),
  };
}, { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, props) };
}, { virtual: true });
jest.mock('react-native-worklets-core', () => ({ useRunOnJS: (fn) => fn }), { virtual: true });
jest.mock('react-native-mediapipe', () => ({
  usePoseDetection: () => ({ cameraDevice: { id: 'front' }, cameraViewLayoutChangeHandler: () => {}, frameProcessor: { frameProcessor: () => {} }, fpsMode: 15 }),
  Delegate: { GPU: 'GPU' },
  RunningMode: { LIVE_STREAM: 'LIVE_STREAM' },
  KnownPoseLandmarks: { nose: 0, leftShoulder: 11, rightShoulder: 12, leftHip: 23, rightHip: 24, leftAnkle: 27, rightAnkle: 28 },
}), { virtual: true });
jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const Plain = () => mockReact.createElement(mockRn.View);
  return { __esModule: true, default: Plain, Circle: Plain };
}, { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }), { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress }) => mockReact.createElement(mockRn.Pressable, { onPress }, mockReact.createElement(mockRn.Text, null, title)),
  };
});
jest.mock('@/components/PaywallGate', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('@/store/userStore', () => ({
  useUserStore: () => ({ user: mockUser, updateUser: mockUpdateUser, saveProfile: mockSaveProfile }),
}));
jest.mock('@/store/bodyCompositionStore', () => ({
  useBodyCompositionStore: () => ({ runScan: jest.fn(), isScanning: false, error: null }),
}));
jest.mock('@/lib/rotationTracker', () => ({
  createRotationTracker: () => ({
    processFrame: () => ({ step: 'front', progress: 0, ratio: 1, noseVisibility: 0.9 }),
    forceAdvanceStep: () => ({ step: 'front', progress: 0, ratio: 1, noseVisibility: 0.9 }),
    getCapturedLandmarks: () => ({}),
    reset: jest.fn(),
  }),
}));
jest.mock('@/lib/userProfileData', () => ({ getGoalLabels: () => [] }));
jest.mock('@/services/voiceGuidanceService', () => ({
  loadVoiceGuidancePreference: () => Promise.resolve(true),
  setVoiceGuidanceEnabled: jest.fn(),
  speakPrompt: jest.fn(),
  stopSpeaking: jest.fn(),
}));

import BodyScanCaptureGate from '../app/body-scan/capture';

const profile = { uid: 'u1', heightCm: 180, weightKg: 80, age: 30, gender: 'male' };
const agreed = { bodyScanNotice: { version: 1, at: '2026-10-01T12:00:00.000Z' } };

const renderScreen = async () => {
  const utils = render(<BodyScanCaptureGate />);
  await act(async () => {});
  return utils;
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  [mockBack, mockPush, mockUpdateUser, mockSaveProfile, mockRequestPermission].forEach((fn) => fn.mockClear());
  mockUser = { ...profile };
  mockHasPermission = false;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('a person who has not seen the notice', () => {
  it('is shown the notice, and no camera', async () => {
    mockHasPermission = true;
    const utils = await renderScreen();
    expect(utils.getByTestId('scan-notice')).toBeTruthy();
    expect(utils.getByText('Before your first body scan')).toBeTruthy();
    expect(utils.queryByTestId('camera')).toBeNull();
  });

  it('is not asked for the camera while the notice is up', async () => {
    await renderScreen();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('agrees by tapping continue: the time and version are saved on the profile', async () => {
    const utils = await renderScreen();
    await act(async () => { fireEvent.press(utils.getByText('I understand, continue')); });
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    const { bodyScanNotice } = mockUpdateUser.mock.calls[0][0];
    expect(bodyScanNotice.version).toBe(1);
    expect(Number.isNaN(Date.parse(bodyScanNotice.at))).toBe(false);
    expect(mockSaveProfile).toHaveBeenCalledWith('u1');
  });

  it('goes back on not now, saves nothing and still does not ask for the camera', async () => {
    const utils = await renderScreen();
    await act(async () => { fireEvent.press(utils.getByText('Not now')); });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('can read the privacy policy first, without agreeing', async () => {
    const utils = await renderScreen();
    await act(async () => { fireEvent.press(utils.getByText('Read the Privacy Policy')); });
    expect(mockPush).toHaveBeenCalledWith('/profile/privacy-policy');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('can still go on to the scan when there is no profile to save the agreement on', async () => {
    mockUser = null;
    mockHasPermission = true;
    const utils = await renderScreen();
    expect(utils.getByTestId('scan-notice')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByText('I understand, continue')); });
    expect(utils.queryByTestId('scan-notice')).toBeNull();
    expect(utils.getByText('Continue to Camera')).toBeTruthy(); // with no profile, the scan goes on to ask for height first, as it always did
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });

  it('does not save a profile when nobody is signed in to save it for', async () => {
    mockUser = { ...profile, uid: undefined };
    const utils = await renderScreen();
    await act(async () => { fireEvent.press(utils.getByText('I understand, continue')); });
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });
});

describe('a person who has agreed to the notice', () => {
  it('goes straight to the camera, with no notice', async () => {
    mockUser = { ...profile, ...agreed };
    mockHasPermission = true;
    const utils = await renderScreen();
    expect(utils.queryByTestId('scan-notice')).toBeNull();
    expect(utils.getByTestId('camera')).toBeTruthy();
  });

  it('is asked for the camera, as before, if it has not been allowed yet', async () => {
    mockUser = { ...profile, ...agreed };
    await renderScreen();
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('is shown the notice again if it was agreed to an older version', async () => {
    mockUser = { ...profile, bodyScanNotice: { version: 0, at: '2026-01-01T00:00:00.000Z' } };
    const utils = await renderScreen();
    expect(utils.getByTestId('scan-notice')).toBeTruthy();
  });
});
