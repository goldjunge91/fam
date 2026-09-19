export const SPEECH_GOLD_LABEL_SCHEMA_VERSION = 1 as const;

export type SpeechGoldLabelItem = Readonly<{
  name: string;
  quantity: number;
  unit: string | null;
  brand: string | null;
}>;

export type SpeechGoldLabel = Readonly<{
  schemaVersion: typeof SPEECH_GOLD_LABEL_SCHEMA_VERSION;
  fixtureSetVersion: string;
  audio: string;
  referenceFile: string;
  referenceLine: number;
  targetListId: null;
  mentionedMarket: string | null;
  expectedUnparsedText: string | null;
  items: readonly SpeechGoldLabelItem[];
}>;
