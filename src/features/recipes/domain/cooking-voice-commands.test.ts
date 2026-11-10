import { parseCookingVoiceCommand } from './cooking-voice-commands';

describe('parseCookingVoiceCommand', () => {
  it.each([
    ['Weiter!', 'next'],
    ['NÄCHSTER SCHRITT', 'next'],
    ['einen Schritt zurück.', 'previous'],
    ['Noch einmal', 'repeat'],
    ['Zutaten dieses Schritts vorlesen', 'read-ingredients'],
    ['Starte den Timer!', 'start-timer'],
    ['Vorlesen stoppen.', 'stop-reading'],
    ['Kochvorgang beenden', 'finish'],
  ] as const)('parses the supported phrase %s', (transcript, expected) => {
    expect(parseCookingVoiceCommand(transcript)).toBe(expected);
  });

  it.each(['weiter bitte', 'lies den aktuellen Schritt', 'Was mache ich jetzt?', ''])(
    'ignores an unsupported phrase: %s',
    (transcript) => {
      expect(parseCookingVoiceCommand(transcript)).toBeNull();
    },
  );
});
