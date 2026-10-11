import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useSpeechRecognizerPermission } from './speech-recognizer-permissions';

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();

jest.mock('./native-speech-recognition', () => ({
  getSpeechRecognizerPermissions: (...args: unknown[]) => mockGetPermissions(...args),
  requestSpeechRecognizerPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
}));

describe('useSpeechRecognizerPermission', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const removeListener = jest.fn();
  let addListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = undefined;
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ granted: true });
    addListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: removeListener };
      });
  });

  afterEach(() => addListenerSpy.mockRestore());

  it('refreshes on mount and app activation, requests permission, and removes its listener', async () => {
    mockGetPermissions
      .mockResolvedValueOnce({ granted: false, canAskAgain: true })
      .mockResolvedValueOnce({ granted: true, canAskAgain: false });
    const { result, unmount } = await renderHook(() => useSpeechRecognizerPermission());

    await waitFor(() => expect(result.current[0]).toEqual({ granted: false, canAskAgain: true }));
    expect(mockGetPermissions).toHaveBeenCalledTimes(1);

    await act(async () => {
      appStateListener?.('background');
    });
    expect(mockGetPermissions).toHaveBeenCalledTimes(1);

    await act(async () => {
      appStateListener?.('active');
    });
    await waitFor(() => expect(result.current[0]).toEqual({ granted: true, canAskAgain: false }));
    expect(mockGetPermissions).toHaveBeenCalledTimes(2);

    let requested: { granted: boolean; canAskAgain: boolean } | undefined;
    await act(async () => {
      requested = await result.current[1]();
    });
    expect(requested).toEqual({ granted: true, canAskAgain: true });
    expect(result.current[0]).toEqual({ granted: true, canAskAgain: true });
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);

    await unmount();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
