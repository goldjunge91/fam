export type OcrBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrWord = {
  text: string;
  confidence: number | null;
  boundingBox: OcrBoundingBox;
};

export type OcrLine = {
  text: string;
  confidence: number | null;
  boundingBox: OcrBoundingBox;
  words: readonly OcrWord[];
};

export type ParsedTsv = {
  lines: readonly OcrLine[];
  text: string;
};

type LineAccumulator = {
  words: OcrWord[];
  lineNumber: number;
};

const HEADER_COLUMNS = [
  'level',
  'page_num',
  'block_num',
  'par_num',
  'line_num',
  'word_num',
  'left',
  'top',
  'width',
  'height',
  'conf',
  'text',
] as const;

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseConfidence(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseWord(columns: readonly string[]): OcrWord | null {
  if (columns.length < HEADER_COLUMNS.length || columns[0] !== '5') return null;

  const text = columns.slice(11).join('\t').trim();
  if (text.length === 0) return null;

  return {
    text,
    confidence: parseConfidence(columns[10] ?? ''),
    boundingBox: {
      x: parseNumber(columns[6] ?? '', 0),
      y: parseNumber(columns[7] ?? '', 0),
      width: Math.max(0, parseNumber(columns[8] ?? '', 0)),
      height: Math.max(0, parseNumber(columns[9] ?? '', 0)),
    },
  };
}

function lineKey(columns: readonly string[]): string {
  return [columns[1], columns[2], columns[3], columns[4]].join(':');
}

function combineBoundingBoxes(words: readonly OcrWord[]): OcrBoundingBox {
  const left = Math.min(...words.map((word) => word.boundingBox.x));
  const top = Math.min(...words.map((word) => word.boundingBox.y));
  const right = Math.max(
    ...words.map((word) => word.boundingBox.x + word.boundingBox.width),
  );
  const bottom = Math.max(
    ...words.map((word) => word.boundingBox.y + word.boundingBox.height),
  );

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function averageConfidence(words: readonly OcrWord[]): number | null {
  const confidentWords = words.filter(
    (word): word is OcrWord & { confidence: number } => word.confidence !== null,
  );
  if (confidentWords.length === 0) return null;

  const total = confidentWords.reduce((sum, word) => sum + word.confidence, 0);
  return Number((total / confidentWords.length).toFixed(2));
}

export function parseTesseractTsv(tsv: string): ParsedTsv {
  const lines = new Map<string, LineAccumulator>();
  let lineNumber = 0;

  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const columns = row.split('\t');
    const word = parseWord(columns);
    if (!word) continue;

    const key = lineKey(columns);
    const accumulator = lines.get(key) ?? { words: [], lineNumber: lineNumber++ };
    accumulator.words.push(word);
    lines.set(key, accumulator);
  }

  const parsedLines = [...lines.values()]
    .sort((left, right) => left.lineNumber - right.lineNumber)
    .map(({ words }) => ({
      text: words.map((word) => word.text).join(' '),
      confidence: averageConfidence(words),
      boundingBox: combineBoundingBoxes(words),
      words,
    }));

  return { lines: parsedLines, text: parsedLines.map((line) => line.text).join('\n') };
}

export function normalizeOcrText(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^\p{L}\p{N}%€._-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeOcrText(text: string): string[] {
  return normalizeOcrText(text)
    .split(' ')
    .filter((token) => token.length > 1 || /^\d$/.test(token));
}
