export type CookingVoiceCommand =
  | { kind: 'next' }
  | { kind: 'previous' }
  | { kind: 'repeat' }
  | { kind: 'read-ingredients' }
  | { kind: 'start-timer'; durationSeconds?: number }
  | { kind: 'stop-reading' }
  | { kind: 'pause' }
  | { kind: 'finish' };

type SimpleCookingVoiceCommand = Exclude<CookingVoiceCommand, { kind: 'start-timer' }>;

function normalizeTranscript(transcript: string): string {
  return transcript
    .toLocaleLowerCase('de-DE')
    .replace(/[.,!?;:]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const SIMPLE_COMMANDS: readonly [SimpleCookingVoiceCommand['kind'], readonly string[]][] = [
  ['next', ['weiter', 'nächster schritt', 'zum nächsten schritt']],
  ['previous', ['zurück', 'einen schritt zurück', 'vorheriger schritt']],
  ['repeat', ['wiederholen', 'nochmal', 'noch einmal', 'wiederhole']],
  [
    'read-ingredients',
    ['zutaten vorlesen', 'zutaten dieses schritts vorlesen', 'lies die zutaten vor'],
  ],
  ['stop-reading', ['vorlesen stoppen', 'stop vorlesen', 'hör auf vorzulesen']],
  ['pause', ['pause', 'pausieren', 'mach eine pause']],
  [
    'finish',
    ['kochvorgang abschließen', 'kochvorgang beenden', 'kochen abschließen', 'fertig kochen'],
  ],
];

const GERMAN_NUMBER_VALUES: Readonly<Record<string, number>> = {
  null: 0,
  ein: 1,
  eine: 1,
  einen: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
  dreißig: 30,
  vierzig: 40,
  fünfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
  hundert: 100,
};

function parseDurationNumber(value: string): number | null {
  if (/^\d+$/u.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  return GERMAN_NUMBER_VALUES[value] ?? null;
}

function parseTimerDuration(normalized: string): CookingVoiceCommand | null {
  const match = normalized.match(
    /^(?:timer für (.+) (minuten?|sekunden?) starten|starte (?:den|einen) timer für (.+) (minuten?|sekunden?))$/u,
  );
  if (!match) return null;

  const value = match[1] ?? match[3];
  const unit = match[2] ?? match[4];
  if (!value || !unit) return null;

  const amount = parseDurationNumber(value);
  if (amount === null || amount <= 0) return null;

  return {
    kind: 'start-timer',
    durationSeconds: unit.startsWith('minute') ? amount * 60 : amount,
  };
}

/** Maps only complete, supported cooking phrases to a structured action. */
export function parseCookingVoiceCommand(transcript: string): CookingVoiceCommand | null {
  const normalized = normalizeTranscript(transcript);
  if (!normalized) return null;

  if (
    normalized === 'timer starten' ||
    normalized === 'starte den timer' ||
    normalized === 'timer an'
  ) {
    return { kind: 'start-timer' };
  }

  const timerCommand = parseTimerDuration(normalized);
  if (timerCommand) return timerCommand;

  for (const [kind, phrases] of SIMPLE_COMMANDS) {
    if (phrases.includes(normalized)) return { kind };
  }
  return null;
}
