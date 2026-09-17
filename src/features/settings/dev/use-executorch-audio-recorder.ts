import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

export interface ExecuTorchAudioRecorderState {
  isRecording: boolean;
  startRecording: (
    sampleRate: number,
    onAudioChunk: (samples: Float32Array) => void,
    bufferLength?: number,
  ) => Promise<void>;
  stopRecording: () => Promise<void>;
}

export function useExecuTorchAudioRecorder(): ExecuTorchAudioRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<AudioRecorder | null>(null);

  useEffect(() => {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'spokenAudio',
      iosOptions: ['allowBluetoothHFP', 'defaultToSpeaker'],
    });

    void AudioManager.requestRecordingPermissions().catch(() => undefined);

    return () => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) {
        void recorder.stop().catch(() => undefined);
      }
    };
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;

    if (recorder) {
      await recorder.stop().catch(() => undefined);
    }

    setIsRecording(false);
  }, []);

  const startRecording = useCallback(
    async (
      sampleRate: number,
      onAudioChunk: (samples: Float32Array) => void,
      bufferLength = 4096,
    ) => {
      await stopRecording();

      const permission = await AudioManager.requestRecordingPermissions();
      if (permission !== 'Granted') {
        throw new Error('Mikrofonberechtigung wurde nicht erteilt.');
      }

      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      recorder.onAudioReady({ sampleRate, bufferLength, channelCount: 1 }, (event) => {
        const channelData = event.buffer.getChannelData(0);
        onAudioChunk(new Float32Array(channelData));
      });

      const result = await recorder.start();
      if (result.status === 'error') {
        recorderRef.current = null;
        throw new Error(result.message || 'Mikrofonaufnahme konnte nicht gestartet werden.');
      }

      setIsRecording(true);
    },
    [stopRecording],
  );

  return { isRecording, startRecording, stopRecording };
}
