import { combineSpeechTranscript } from './speech-transcript';

describe('combineSpeechTranscript', () => {
  it('combines committed and in-progress text for the shared transcript surface', () => {
    expect(combineSpeechTranscript('Reisnudeln, Couscous,', 'Bulgur')).toBe(
      'Reisnudeln, Couscous, Bulgur',
    );
  });

  it('handles either stream portion being empty', () => {
    expect(combineSpeechTranscript('', 'Bulgur')).toBe('Bulgur');
    expect(combineSpeechTranscript('Bulgur', '')).toBe('Bulgur');
    expect(combineSpeechTranscript('', '')).toBe('');
  });
});
