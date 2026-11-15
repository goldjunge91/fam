import { parseCookingVoiceCommand } from './cooking-voice-commands';

describe('parseCookingVoiceCommand', () => {
  it.each([
    ['Weiter!', { kind: 'next' }],
    ['NÄCHSTER SCHRITT', { kind: 'next' }],
    ['einen Schritt zurück.', { kind: 'previous' }],
    ['Noch einmal', { kind: 'repeat' }],
    ['Zutaten dieses Schritts vorlesen', { kind: 'read-ingredients' }],
    ['Starte den Timer!', { kind: 'start-timer' }],
    ['Vorlesen stoppen.', { kind: 'stop-reading' }],
    ['Pause', { kind: 'pause' }],
    ['Mach eine Pause!', { kind: 'pause' }],
    ['Kochvorgang beenden', { kind: 'finish' }],
  ] as const)('parses the supported phrase %s', (transcript, expected) => {
    expect(parseCookingVoiceCommand(transcript)).toEqual(expected);
  });

  it.each([
    ['Timer für 5 Minuten starten', { kind: 'start-timer', durationSeconds: 300 }],
    ['STARTE EINEN TIMER FÜR 30 SEKUNDEN!', { kind: 'start-timer', durationSeconds: 30 }],
    ['Starte den Timer für zehn Minuten', { kind: 'start-timer', durationSeconds: 600 }],
    ['Timer für eine Sekunde starten.', { kind: 'start-timer', durationSeconds: 1 }],
  ] as const)('extracts a numeric timer duration from %s', (transcript, expected) => {
    expect(parseCookingVoiceCommand(transcript)).toEqual(expected);
  });

  it.each([
    'weiter bitte',
    'lies den aktuellen Schritt',
    'Was mache ich jetzt?',
    'Timer für null Minuten starten',
    'Timer für viele Minuten starten',
    'Timer für 1 Stunde starten',
    'Timer für 1,5 Minuten starten',
    'Timer für 5 Minuten',
    '',
  ])('ignores an unsupported or ambiguous phrase: %s', (transcript) => {
    expect(parseCookingVoiceCommand(transcript)).toBeNull();
  });
});
