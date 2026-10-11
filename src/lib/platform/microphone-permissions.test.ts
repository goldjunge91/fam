import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useMicrophonePermission } from './microphone-permissions';

type PermissionResponse = { granted: boolean; canAskAgain?: boolean };
type PermissionModule = {
  getMicrophonePermissionsAsync: () => Promise<PermissionResponse>;
  requestMicrophonePermissionsAsync: () => Promise<PermissionResponse>;
};

const mockGetPermission = jest.fn<Promise<PermissionResponse>, []>();
const mockRequestPermission = jest.fn<Promise<PermissionResponse>, []>();
const mockRemoveSubscription = jest.fn();

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    getMicrophonePermissionsAsync: () => mockGetPermission(),
    requestMicrophonePermissionsAsync: () => mockRequestPermission(),
  },
}));

const speechModule = jest.requireMock<{
  ExpoSpeechRecognitionModule: PermissionModule | null;
}>('expo-speech-recognition');
const mockSubscription = { remove: mockRemoveSubscription } as ReturnType<
  typeof AppState.addEventListener
>;
let appStateListener: ((state: AppStateStatus) => void) | undefined;

beforeEach(() => {
  mockGetPermission.mockReset().mockResolvedValue({ granted: false });
  mockRequestPermission.mockReset().mockResolvedValue({ granted: false });
  speechModule.ExpoSpeechRecognitionModule = {
    getMicrophonePermissionsAsync: () => mockGetPermission(),
    requestMicrophonePermissionsAsync: () => mockRequestPermission(),
  };
  appStateListener = undefined;
  mockRemoveSubscription.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return mockSubscription;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('refreshes and requests permission while normalizing an omitted ask-again flag', async () => {
  mockGetPermission.mockResolvedValue({ granted: true });
  mockRequestPermission.mockResolvedValue({ granted: false, canAskAgain: false });

  const { result, unmount } = await renderHook(() => useMicrophonePermission());
  await act(async () => {
    await Promise.resolve();
  });

  expect(result.current[0]).toEqual({ granted: true, canAskAgain: true });
  await act(async () => {
    await result.current[1]();
  });
  expect(result.current[0]).toEqual({ granted: false, canAskAgain: false });
  expect(mockGetPermission).toHaveBeenCalledTimes(1);
  expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  await unmount();
});

test('returns unavailable permissions when the native module or request methods fail', async () => {
  speechModule.ExpoSpeechRecognitionModule = null;

  const unavailable = await renderHook(() => useMicrophonePermission());
  await act(async () => {
    await Promise.resolve();
  });
  expect(unavailable.result.current[0]).toEqual({ granted: false, canAskAgain: false });
  await act(async () => {
    await unavailable.result.current[1]();
  });
  expect(unavailable.result.current[0]).toEqual({ granted: false, canAskAgain: false });
  await unavailable.unmount();

  speechModule.ExpoSpeechRecognitionModule = {
    getMicrophonePermissionsAsync: () => mockGetPermission(),
    requestMicrophonePermissionsAsync: () => mockRequestPermission(),
  };
  mockGetPermission.mockRejectedValueOnce(new Error('permission lookup failed'));
  const failed = await renderHook(() => useMicrophonePermission());
  await act(async () => {
    await Promise.resolve();
  });
  expect(failed.result.current[0]).toEqual({ granted: false, canAskAgain: false });
  mockRequestPermission.mockRejectedValue(new Error('permission request failed'));
  await act(async () => {
    await failed.result.current[1]();
  });
  expect(failed.result.current[0]).toEqual({ granted: false, canAskAgain: false });
  await failed.unmount();
});

test('refreshes only when the app becomes active and removes the listener on unmount', async () => {
  const { unmount } = await renderHook(() => useMicrophonePermission());
  await act(async () => {
    await Promise.resolve();
  });

  await act(async () => appStateListener?.('background'));
  expect(mockGetPermission).toHaveBeenCalledTimes(1);
  await act(async () => appStateListener?.('active'));
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockGetPermission).toHaveBeenCalledTimes(2);

  await unmount();
  expect(mockRemoveSubscription).toHaveBeenCalledTimes(1);
});
