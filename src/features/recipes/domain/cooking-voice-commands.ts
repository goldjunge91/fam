export type CookingVoiceCommand =
  | 'next'
  | 'previous'
  | 'repeat'
  | 'read-ingredients'
  | 'start-timer'
  | 'stop-reading'
  | 'finish';

function normalizeTranscript(transcript: string): string {
  return transcript
    .toLocaleLowerCase('de-DE')
    .replace(/[.,!?;:]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const COMMANDS: readonly [CookingVoiceCommand, readonly string[]][] = [
  ['next', ['weiter', 'nächster schritt', 'zum nächsten schritt']],
  ['previous', ['zurück', 'einen schritt zurück', 'vorheriger schritt']],
  ['repeat', ['wiederholen', 'nochmal', 'noch einmal', 'wiederhole']],
  [
    'read-ingredients',
    ['zutaten vorlesen', 'zutaten dieses schritts vorlesen', 'lies die zutaten vor'],
  ],
  ['start-timer', ['timer starten', 'starte den timer', 'timer an']],
  ['stop-reading', ['vorlesen stoppen', 'stop vorlesen', 'hör auf vorzulesen']],
  [
    'finish',
    ['kochvorgang abschließen', 'kochvorgang beenden', 'kochen abschließen', 'fertig kochen'],
  ],
];

/** Maps only complete, supported cooking phrases to an action. */
export function parseCookingVoiceCommand(transcript: string): CookingVoiceCommand | null {
  const normalized = normalizeTranscript(transcript);
  if (!normalized) return null;

  for (const [command, phrases] of COMMANDS) {
    if (phrases.includes(normalized)) return command;
  }
  return null;
}
