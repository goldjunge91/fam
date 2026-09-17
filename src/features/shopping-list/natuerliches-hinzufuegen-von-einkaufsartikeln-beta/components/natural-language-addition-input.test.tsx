import { act, render, screen, userEvent } from '@testing-library/react-native';
import type {
  SpeechRecognitionAdapter,
  SpeechRecognitionSession,
} from '../services/speech-recognition-adapter';
import { DEFAULT_SPEECH_LOCALE } from '../services/speech-recognition-adapter';
import type {
  NaturalLanguageAdditionInput as NaturalLanguageAdditionInputContract,
  SpeechInputResult,
} from '../types';
import { NaturalLanguageAdditionInput } from './natural-language-addition-input';

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

describe('NaturalLanguageAdditionInput', () => {
  it('starts and stops speech from the microphone action', async () => {
    const speech = createSpeechSession();
    const speechAdapter: SpeechRecognitionAdapter = {
      start: jest.fn(() => speech.session),
    };
    const onSubmit = jest.fn<void, [NaturalLanguageAdditionInputContract]>();
    const user = userEvent.setup();

    await render(
      <NaturalLanguageAdditionInput speechAdapter={speechAdapter} onSubmit={onSubmit} />,
    );

    await user.press(screen.getByRole('button', { name: 'Spracheingabe' }));
    expect(speechAdapter.start).toHaveBeenCalledWith({
      locale: DEFAULT_SPEECH_LOCALE,
      networkRecognitionConsent: false,
    });
    expect(screen.getByRole('button', { name: 'Aufnahme stoppen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Aufnahme stoppen' }));
    expect(speech.session.stop).toHaveBeenCalledTimes(1);

    await act(async () => {
      speech.result.resolve({
        status: 'transcript',
        text: '3 Äpfel und Brot',
        locale: DEFAULT_SPEECH_LOCALE,
        onDevice: false,
        error: null,
        segments: [
          {
            startTimeMillis: 100,
            endTimeMillis: 480,
            segment: '3 Äpfel',
            confidence: 0.96,
          },
          {
            startTimeMillis: 900,
            endTimeMillis: 1_240,
            segment: 'und Brot',
            confidence: 0.9,
          },
        ],
      });
      await speech.result.promise;
    });

    expect(onSubmit).toHaveBeenCalledWith({
      source: 'speech',
      text: '3 Äpfel und Brot',
      locale: DEFAULT_SPEECH_LOCALE,
      onDevice: false,
      segments: [
        {
          startTimeMillis: 100,
          endTimeMillis: 480,
          segment: '3 Äpfel',
          confidence: 0.96,
        },
        {
          startTimeMillis: 900,
          endTimeMillis: 1_240,
          segment: 'und Brot',
          confidence: 0.9,
        },
      ],
    });
    expect(screen.getByRole('button', { name: 'Spracheingabe' })).toBeOnTheScreen();
  });

  it('keeps text input available when the native capability is unavailable', async () => {
    const speech = createSpeechSession();
    const speechAdapter: SpeechRecognitionAdapter = {
      start: jest.fn(() => speech.session),
    };
    const onSubmit = jest.fn<void, [NaturalLanguageAdditionInputContract]>();
    const user = userEvent.setup();

    await render(
      <NaturalLanguageAdditionInput speechAdapter={speechAdapter} onSubmit={onSubmit} />,
    );

    await user.press(screen.getByRole('button', { name: 'Spracheingabe' }));
    await act(async () => {
      speech.result.resolve({
        status: 'capability-unavailable',
        text: null,
        locale: DEFAULT_SPEECH_LOCALE,
        onDevice: false,
        error: 'Spracherkennung nicht verfügbar',
      });
      await speech.result.promise;
    });

    expect(screen.getByText('Spracherkennung nicht verfügbar')).toBeOnTheScreen();
    expect(screen.getByLabelText('Artikel hinzufügen')).toBeOnTheScreen();
  });
});
