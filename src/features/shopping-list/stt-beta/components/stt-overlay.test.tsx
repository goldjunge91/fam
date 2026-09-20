import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { debugLog } from '@/lib/observability/debug-log';

import type {
  SpeechRecognitionAdapter,
  SpeechRecognitionSession,
} from '../services/speech-recognition-adapter';
import { DEFAULT_SPEECH_LOCALE } from '../services/speech-recognition-adapter';
import type { SpeechInputResult } from '../types';
import { NaturalLanguageAdditionVoiceOverlay } from './stt-overlay';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const MockView = require('react-native/Libraries/Components/View/View').default;

  return {
    __esModule: true,
    default: ({
      children,
      onShow,
      visible,
      ...props
    }: {
      children: React.ReactNode;
      onShow?: () => void;
      visible: boolean;
    }) =>
      visible
        ? React.createElement(MockView, { ...props, testID: 'speech-modal', onShow }, children)
        : null,
  };
});

jest.mock('../services/native-speech-recognition', () => ({
  nativeSpeechRecognitionAdapter: { start: jest.fn() },
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugLog: jest.fn(),
  debugLogEvent: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createSpeechSession() {
  const result = deferred<SpeechInputResult>();
  const session: SpeechRecognitionSession = {
    result: result.promise,
    stop: jest.fn(),
    cancel: jest.fn(),
  };
  return { result, session };
}

describe('NaturalLanguageAdditionVoiceOverlay', () => {
  it('stops explicitly with Fertig and forwards the completed transcript', async () => {
    const speech = createSpeechSession();
    const speechAdapter: SpeechRecognitionAdapter = {
      start: jest.fn(() => speech.session),
    };
    const onTranscript = jest.fn();
    const user = userEvent.setup();

    await render(
      <NaturalLanguageAdditionVoiceOverlay
        visible
        speechAdapter={speechAdapter}
        onCancel={jest.fn()}
        onTranscript={onTranscript}
        onFallback={jest.fn()}
      />,
    );

    await fireEvent(screen.getByTestId('speech-modal'), 'show');

    expect(speechAdapter.start).toHaveBeenCalledWith({
      locale: DEFAULT_SPEECH_LOCALE,
      onVolumeChange: expect.any(Function),
    });

    await user.press(screen.getByRole('button', { name: 'Fertig' }));

    expect(speech.session.stop).toHaveBeenCalledTimes(1);
    expect(onTranscript).not.toHaveBeenCalled();

    speech.result.resolve({
      status: 'transcript',
      text: '3 Äpfel und Brot',
      locale: DEFAULT_SPEECH_LOCALE,
      onDevice: true,
      error: null,
    });

    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith({
        source: 'speech',
        text: '3 Äpfel und Brot',
        locale: DEFAULT_SPEECH_LOCALE,
        onDevice: true,
      });
    });

    expect(debugLog).toHaveBeenCalledWith(
      '[SpeechRecognition] 🎙️ Transkript erkannt: 3 Äpfel und Brot',
    );
  });
});
