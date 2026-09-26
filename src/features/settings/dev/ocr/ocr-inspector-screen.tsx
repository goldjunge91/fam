import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { Screen } from '@/components/layout/screen';
import { font, type Palette, radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Card, Row, SegmentedControl, TextField, Txt } from '@/constants/ui';
import { captureReceipt, createExpoFileSystemAdapter } from '@/features/ocr/capture/api';
import type { ReceiptCaptureFileAdapter } from '@/features/ocr/capture/capture/contracts';
import {
  getReceiptOcrAvailability,
  mapReceiptOcrError,
  prepareReceiptOcr,
  type ReceiptOcrBoundingBox,
  type ReceiptOcrLine,
  type ReceiptOcrModelAvailability,
  type ReceiptOcrResult,
  recognizeReceiptOcr,
} from '@/features/ocr/processing/native';
import { formatBytes, Zeile } from '../dev-screen-shared';
import {
  type InspectorColorMode,
  type InspectorContrast,
  type InspectorCrop,
  type InspectorImageSettings,
  type InspectorLanguage,
  type InspectorNativeOcrSettings,
  type InspectorQuality,
  type InspectorRecognitionLevel,
  type InspectorResize,
  type InspectorSharpen,
  parseInspectorCustomWords,
  prepareInspectorImage,
  recognizeReceiptOcrForInspector,
} from './ocr-inspector-pipeline';

type InspectorImage = {
  originalUri: string;
  localUri: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
};

type InspectorPhase =
  | 'idle'
  | 'picking'
  | 'preparing'
  | 'preparing-image'
  | 'recognizing'
  | 'ready'
  | 'error';

type InspectorSettings = InspectorImageSettings & {
  language: InspectorLanguage;
  recognitionLevel: InspectorRecognitionLevel;
  usesLanguageCorrection: boolean;
  customWords: string;
};

const INITIAL_SETTINGS: InspectorSettings = {
  language: 'auto',
  recognitionLevel: 'accurate',
  usesLanguageCorrection: true,
  customWords: '',
  resize: 'source',
  crop: 'none',
  colorMode: 'color',
  contrast: 'none',
  sharpen: 'off',
  quality: 'source',
};

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto / Gerät' },
  { value: 'de-DE', label: 'Deutsch · de-DE' },
  { value: 'en-US', label: 'Englisch · en-US' },
  { value: 'fr-FR', label: 'Französisch · fr-FR' },
] as const satisfies ReadonlyArray<{ value: InspectorLanguage; label: string }>;

const RESIZE_OPTIONS = [
  { value: 'source', label: 'Quelle behalten' },
  { value: '1600', label: '1600 px · kleiner' },
  { value: '2400', label: '2400 px · Standard' },
  { value: '3200', label: '3200 px · hochskalieren' },
] as const satisfies ReadonlyArray<{ value: InspectorResize; label: string }>;

const CROP_OPTIONS = [
  { value: 'none', label: 'Kein Zuschnitt' },
  { value: 'edges-2', label: 'Ränder 2 % entfernen' },
  { value: 'edges-5', label: 'Ränder 5 % entfernen' },
] as const satisfies ReadonlyArray<{ value: InspectorCrop; label: string }>;

const QUALITY_OPTIONS = [
  { value: 'source', label: 'Quelle behalten' },
  { value: 'low', label: 'JPEG 55 · stark komprimiert' },
  { value: 'standard', label: 'JPEG 82 · Standard' },
  { value: 'max', label: 'JPEG 100 · maximale Qualität' },
] as const satisfies ReadonlyArray<{ value: InspectorQuality; label: string }>;

const COLOR_OPTIONS = [
  { value: 'color', label: 'Farbe' },
  { value: 'grayscale', label: 'Graustufen' },
] as const satisfies ReadonlyArray<{ value: InspectorColorMode; label: string }>;

const CONTRAST_OPTIONS = [
  { value: 'none', label: 'Normal' },
  { value: 'low', label: '+20 %' },
  { value: 'high', label: '+45 %' },
] as const satisfies ReadonlyArray<{ value: InspectorContrast; label: string }>;

const SHARPEN_OPTIONS = [
  { value: 'off', label: 'Aus' },
  { value: 'medium', label: 'Mittel' },
] as const satisfies ReadonlyArray<{ value: InspectorSharpen; label: string }>;

type AvailabilityState =
  | { status: 'checking' }
  | { status: 'error'; code: string; message: string }
  | ReceiptOcrModelAvailability;

const INITIAL_AVAILABILITY: AvailabilityState = { status: 'checking' };

const CONFIDENCE_LEGEND = [
  { label: 'hoch', colorKey: 'success' },
  { label: 'mittel', colorKey: 'warning' },
  { label: 'niedrig', colorKey: 'danger' },
  { label: 'unbekannt', colorKey: 'accent' },
] as const satisfies ReadonlyArray<{
  label: string;
  colorKey: keyof Pick<Palette, 'accent' | 'danger' | 'success' | 'warning'>;
}>;

const styles = StyleSheet.create((theme) => ({
  actionStack: {
    gap: theme.space.sm,
  },
  settingsCard: {
    gap: theme.space.lg,
  },
  settingsGroup: {
    gap: theme.space.sm,
  },
  settingsHint: {
    marginTop: -theme.space.xs,
  },
  customWords: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    marginTop: theme.space.xs,
  },
  previewCard: {
    padding: 0,
    overflow: 'hidden',
  },
  previewFrame: {
    width: '100%',
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSoft,
  },
  imageCanvas: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: theme.backgroundElement,
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlayBox: {
    position: 'absolute',
    borderWidth: theme.borderWidth.strong,
    borderRadius: radius.s,
  },
  overlayLabel: {
    position: 'absolute',
    top: space.xs / 4,
    left: space.xs / 4,
    maxWidth: '100%',
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
    fontSize: font.sizes.micro,
    lineHeight: 12,
  },
  previewEmpty: {
    minHeight: 220,
    padding: theme.space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
    padding: theme.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
  },
  outputCard: {
    gap: theme.space.sm,
  },
  output: {
    minHeight: 220,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
  },
  segmentList: {
    gap: theme.space.xs,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.sm,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  segmentIndex: {
    width: 28,
    textAlign: 'right',
  },
  segmentContent: {
    flex: 1,
    gap: space.xs,
  },
  segmentMeta: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
}));

function boundedProgress(progress: number): number {
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

function formatConfidence(confidence: number | null): string {
  return confidence === null ? 'unbekannt' : `${Math.round(confidence * 100)} %`;
}

function averageConfidence(lines: readonly ReceiptOcrLine[]): number | null {
  const known = lines.flatMap((line) => (line.confidence === null ? [] : [line.confidence]));
  if (known.length === 0) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function lineColor(
  confidence: number | null,
  colors: Pick<Palette, 'accent' | 'danger' | 'success' | 'warning'>,
): string {
  if (confidence === null) return colors.accent;
  if (confidence >= 0.85) return colors.success;
  if (confidence >= 0.6) return colors.warning;
  return colors.danger;
}

function availabilityLabel(availability: AvailabilityState): string {
  switch (availability.status) {
    case 'checking':
      return 'wird geprüft';
    case 'available':
      return 'bereit';
    case 'downloadable':
      return 'Download erforderlich';
    case 'downloading':
      return 'wird geladen';
    case 'unavailable':
      return `nicht verfügbar (${availability.reason})`;
    case 'error':
      return `${availability.code}: ${availability.message}`;
  }
}

function phaseLabel(phase: InspectorPhase): string {
  switch (phase) {
    case 'idle':
      return 'Kein Bild ausgewählt';
    case 'picking':
      return 'Bild wird ausgewählt …';
    case 'preparing':
      return 'OCR-Modell wird vorbereitet …';
    case 'preparing-image':
      return 'Bildvariante wird erstellt …';
    case 'recognizing':
      return 'OCR läuft …';
    case 'ready':
      return 'Erkennung abgeschlossen';
    case 'error':
      return 'Fehler bei der Verarbeitung';
  }
}

function settingsSignature(settings: InspectorSettings): string {
  return JSON.stringify(settings);
}

function languageTags(settings: InspectorSettings): string[] {
  return settings.language === 'auto' ? [] : [settings.language];
}

function requiresInspectorNativePath(settings: InspectorSettings): boolean {
  return (
    settings.recognitionLevel !== 'accurate' ||
    !settings.usesLanguageCorrection ||
    parseInspectorCustomWords(settings.customWords).length > 0
  );
}

function errorDetails(error: unknown): { code: string; message: string } {
  const mapped = mapReceiptOcrError(error);
  return { code: mapped.code, message: mapped.message };
}

function overlayStyle(box: ReceiptOcrBoundingBox) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  } as const;
}

function lineKey(line: ReceiptOcrLine): string {
  const { boundingBox } = line;
  return [
    line.text,
    line.confidence,
    boundingBox.x,
    boundingBox.y,
    boundingBox.width,
    boundingBox.height,
  ].join('|');
}

function providerLabel(): string {
  if (process.env.EXPO_OS === 'ios') return 'expo-ai-kit · Apple Vision';
  if (process.env.EXPO_OS === 'android') return 'expo-ai-kit · Google ML Kit';
  return 'expo-ai-kit · native Vision Provider';
}

export function OcrInspectorScreen() {
  const { colors } = useTheme();
  const [image, setImage] = useState<InspectorImage | null>(null);
  const [settings, setSettings] = useState<InspectorSettings>(INITIAL_SETTINGS);
  const [result, setResult] = useState<ReceiptOcrResult | null>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [phase, setPhase] = useState<InspectorPhase>('idle');
  const [availability, setAvailability] = useState<AvailabilityState>(INITIAL_AVAILABILITY);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [lastRunSignature, setLastRunSignature] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);
  const ownedImageUrisRef = useRef<Set<string>>(new Set());
  const fileSystemRef = useRef<ReceiptCaptureFileAdapter | null>(null);
  const isIos = process.env.EXPO_OS === 'ios';

  useEffect(() => {
    let active = true;
    void getReceiptOcrAvailability()
      .then((nextAvailability) => {
        if (active) setAvailability(nextAvailability);
      })
      .catch((nextError: unknown) => {
        if (!active) return;
        setAvailability({ status: 'error', ...errorDetails(nextError) });
      });

    return () => {
      active = false;
      mountedRef.current = false;
      const fileSystem = fileSystemRef.current;
      const ownedUris = [...ownedImageUrisRef.current];
      ownedImageUrisRef.current.clear();
      if (fileSystem) {
        void Promise.all(
          ownedUris.map((localUri) => fileSystem.deleteLocalFile(localUri).catch(() => undefined)),
        );
      }
    };
  }, []);

  function getFileSystem() {
    const existing = fileSystemRef.current;
    if (existing) return existing;
    const created = createExpoFileSystemAdapter();
    fileSystemRef.current = created;
    return created;
  }

  async function cleanupImage(uri: string): Promise<void> {
    try {
      await getFileSystem().deleteLocalFile(uri);
      ownedImageUrisRef.current.delete(uri);
    } catch {
      // Diagnostic tooling should keep the OCR output visible after cleanup errors.
    }
  }

  function ownImage(uri: string): void {
    ownedImageUrisRef.current.add(uri);
  }

  async function cleanupOwnedImages(): Promise<void> {
    const ownedUris = [...ownedImageUrisRef.current];
    await Promise.all(ownedUris.map((uri) => cleanupImage(uri)));
  }

  async function refreshAvailability() {
    setAvailability({ status: 'checking' });
    try {
      setAvailability(await getReceiptOcrAvailability());
    } catch (nextError: unknown) {
      if (!mountedRef.current) return;
      setAvailability({ status: 'error', ...errorDetails(nextError) });
    }
  }

  async function recognize(
    imageToInspect: InspectorImage,
    operation: number,
    runSettings: InspectorSettings,
  ) {
    const startedAt = Date.now();
    setResult(null);
    setRecognizedText('');
    setError(null);
    setElapsedMs(null);
    setModelProgress(null);
    setPhase('preparing');

    try {
      const languages = languageTags(runSettings);
      const prepared = await prepareReceiptOcr({
        languages,
        onProgress: (progress) => {
          if (mountedRef.current && operationRef.current === operation) {
            setModelProgress(boundedProgress(progress));
          }
        },
      });
      if (!mountedRef.current || operationRef.current !== operation) return;
      setAvailability(prepared);
      setPhase('preparing-image');

      const preparedImage = await prepareInspectorImage(
        imageToInspect.originalUri,
        runSettings,
        getFileSystem(),
      );
      if (!mountedRef.current || operationRef.current !== operation) {
        if (preparedImage.ownsFile) await cleanupImage(preparedImage.localUri);
        return;
      }

      const previousWorkingUri = imageToInspect.localUri;
      const nextImage: InspectorImage = {
        ...imageToInspect,
        localUri: preparedImage.localUri,
        byteSize: preparedImage.byteSize || imageToInspect.byteSize,
        width: preparedImage.width || imageToInspect.width,
        height: preparedImage.height || imageToInspect.height,
      };
      if (preparedImage.ownsFile) ownImage(preparedImage.localUri);
      if (
        previousWorkingUri !== imageToInspect.originalUri &&
        previousWorkingUri !== preparedImage.localUri
      ) {
        void cleanupImage(previousWorkingUri);
      }
      setImage(nextImage);
      setPhase('recognizing');

      const nativeSettings: InspectorNativeOcrSettings = {
        languages,
        recognitionLevel: runSettings.recognitionLevel,
        usesLanguageCorrection: runSettings.usesLanguageCorrection,
        customWords: parseInspectorCustomWords(runSettings.customWords),
      };
      const nextResult = requiresInspectorNativePath(runSettings)
        ? await recognizeReceiptOcrForInspector(nextImage.localUri, nativeSettings)
        : await recognizeReceiptOcr(
            nextImage.localUri,
            languages.length > 0 ? { languages } : undefined,
          );
      if (!mountedRef.current || operationRef.current !== operation) return;
      setResult(nextResult);
      setRecognizedText(nextResult.lines.map((line) => line.text).join('\n'));
      setImage((currentImage) =>
        currentImage
          ? {
              ...currentImage,
              width: nextResult.imageSize.width,
              height: nextResult.imageSize.height,
            }
          : currentImage,
      );
      setLastRunSignature(settingsSignature(runSettings));
      setElapsedMs(Date.now() - startedAt);
      setPhase('ready');
    } catch (nextError: unknown) {
      if (!mountedRef.current || operationRef.current !== operation) return;
      setError(errorDetails(nextError));
      setElapsedMs(Date.now() - startedAt);
      setPhase('error');
    } finally {
      if (mountedRef.current && operationRef.current === operation) {
        setModelProgress(null);
      }
    }
  }

  async function selectImage() {
    if (isBusy) return;

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setPhase('picking');
    setError(null);
    setCopyStatus(null);

    try {
      const currentFileSystem = getFileSystem();
      const capture = await captureReceipt(
        {
          captureId: `dev-ocr-${Date.now()}`,
          source: 'gallery',
        },
        { fileSystem: currentFileSystem },
      );

      if (!mountedRef.current || operationRef.current !== operation) {
        if (capture.kind === 'captured') {
          await Promise.all(capture.draft.pages.map((page) => cleanupImage(page.localUri)));
        }
        return;
      }

      if (capture.kind === 'cancelled') {
        setPhase(image ? 'ready' : 'idle');
        return;
      }
      if (capture.kind === 'permission_denied') {
        setError({
          code: 'MEDIA_PERMISSION_DENIED',
          message: 'Der Zugriff auf die Fotomediathek wurde nicht freigegeben.',
        });
        setPhase('error');
        return;
      }
      if (capture.kind === 'failed') {
        setError(capture.failure);
        setPhase('error');
        return;
      }

      const [page, ...unusedPages] = capture.draft.pages;
      if (!page) {
        setError({ code: 'NO_IMAGE', message: 'Die Auswahl enthielt kein Bild.' });
        setPhase('error');
        return;
      }

      await Promise.all(unusedPages.map((unusedPage) => cleanupImage(unusedPage.localUri)));
      await cleanupOwnedImages();
      const nextImage: InspectorImage = {
        originalUri: page.localUri,
        localUri: page.localUri,
        mimeType: page.mimeType,
        byteSize: page.byteSize ?? 0,
        width: 0,
        height: 0,
      };

      setImage(nextImage);
      ownImage(page.localUri);

      await recognize(nextImage, operation, settings);
    } catch (nextError: unknown) {
      if (!mountedRef.current || operationRef.current !== operation) return;
      setError(errorDetails(nextError));
      setPhase('error');
    }
  }

  async function rerunRecognition() {
    if (!image || isBusy) return;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    await recognize(image, operation, settings);
  }

  async function removeImage() {
    operationRef.current += 1;
    setImage(null);
    setResult(null);
    setRecognizedText('');
    setError(null);
    setElapsedMs(null);
    setCopyStatus(null);
    setLastRunSignature(null);
    setPhase('idle');
    await cleanupOwnedImages();
  }

  async function copyRecognizedText() {
    if (!recognizedText) return;
    await Clipboard.setStringAsync(recognizedText);
    setCopyStatus('Text kopiert');
  }

  const average = result ? averageConfidence(result.lines) : null;
  const isBusy =
    phase === 'picking' ||
    phase === 'preparing' ||
    phase === 'preparing-image' ||
    phase === 'recognizing';
  const settingsDirty = Boolean(image) && lastRunSignature !== settingsSignature(settings);
  const runtimeImage = image && result ? { ...image, ...result.imageSize } : image;
  const previewRatio =
    runtimeImage && runtimeImage.height > 0 ? runtimeImage.width / runtimeImage.height : 1;

  return (
    <Screen
      title="OCR-Pipeline"
      subtitle="Bild, native Erkennung und Segmentierung prüfen"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <Card>
        <View style={styles.actionStack}>
          <Button
            title="Bild für OCR auswählen"
            icon="image"
            full
            loading={phase === 'picking'}
            disabled={isBusy}
            onPress={() => void selectImage()}
          />
          {image ? (
            <Row gap={8}>
              <Button
                title={settingsDirty ? 'Mit Einstellungen ausführen' : 'OCR erneut ausführen'}
                variant="secondary"
                icon="refresh-cw"
                style={{ flex: 1 }}
                loading={isBusy}
                disabled={isBusy}
                onPress={() => void rerunRecognition()}
              />
              <Button
                title="Bild entfernen"
                variant="ghost"
                icon="x"
                style={{ flex: 1 }}
                disabled={isBusy}
                onPress={() => void removeImage()}
              />
            </Row>
          ) : null}
        </View>
        <Txt variant="caption" tone="secondary" style={styles.hint} selectable>
          Das Bild wird für diesen Lauf normalisiert und nach dem Verlassen des Screens wieder
          entfernt. OCR-Rohtext wird nicht als Receipt-Daten gespeichert.
        </Txt>
      </Card>

      <Card style={styles.settingsCard}>
        <View style={styles.settingsGroup}>
          <Txt variant="heading">Lauf-Konfiguration</Txt>
          <Txt variant="caption" tone="secondary" selectable>
            Jede Änderung wirkt nur auf den nächsten Inspector-Lauf. Die Produktionspipeline und das
            gespeicherte Bild bleiben unverändert.
          </Txt>
        </View>

        <View
          pointerEvents={isBusy ? 'none' : 'auto'}
          style={isBusy ? { opacity: 0.55 } : undefined}>
          <View style={styles.settingsGroup}>
            <Txt variant="subheading">Bildvorverarbeitung</Txt>
            <WheelPickerField
              label="Auflösung"
              value={settings.resize}
              options={RESIZE_OPTIONS}
              onChange={(resize) =>
                setSettings((current) => ({ ...current, resize: resize as InspectorResize }))
              }
            />
            <WheelPickerField
              label="Zuschnitt"
              value={settings.crop}
              options={CROP_OPTIONS}
              onChange={(crop) =>
                setSettings((current) => ({ ...current, crop: crop as InspectorCrop }))
              }
            />
            <WheelPickerField
              label="JPEG-Qualität"
              value={settings.quality}
              options={QUALITY_OPTIONS}
              onChange={(quality) =>
                setSettings((current) => ({ ...current, quality: quality as InspectorQuality }))
              }
            />
            <SegmentedControl
              label="Farbmodus"
              selected={settings.colorMode}
              options={COLOR_OPTIONS}
              onSelect={(colorMode) => setSettings((current) => ({ ...current, colorMode }))}
              size="compact"
            />
            <SegmentedControl
              label="Kontrast"
              selected={settings.contrast}
              options={CONTRAST_OPTIONS}
              onSelect={(contrast) => setSettings((current) => ({ ...current, contrast }))}
              size="compact"
            />
            <SegmentedControl
              label="Schärfen"
              selected={settings.sharpen}
              options={SHARPEN_OPTIONS}
              onSelect={(sharpen) => setSettings((current) => ({ ...current, sharpen }))}
              size="compact"
            />
          </View>

          <View style={styles.settingsGroup}>
            <Txt variant="subheading">Native OCR</Txt>
            <WheelPickerField
              label="OCR-Sprache"
              value={settings.language}
              options={LANGUAGE_OPTIONS}
              onChange={(language) =>
                setSettings((current) => ({
                  ...current,
                  language: language as InspectorLanguage,
                }))
              }
            />
            <SegmentedControl
              label="Erkennungsmodus"
              selected={settings.recognitionLevel}
              options={[
                { value: 'accurate', label: 'Genau' },
                { value: 'fast', label: 'Schnell', disabled: !isIos },
              ]}
              onSelect={(recognitionLevel) =>
                setSettings((current) => ({ ...current, recognitionLevel }))
              }
              size="compact"
            />
            <SegmentedControl
              label="Sprachkorrektur"
              selected={settings.usesLanguageCorrection ? 'on' : 'off'}
              options={[
                { value: 'on', label: 'An', disabled: !isIos },
                { value: 'off', label: 'Aus', disabled: !isIos },
              ]}
              onSelect={(usesLanguageCorrection) =>
                setSettings((current) => ({
                  ...current,
                  usesLanguageCorrection: usesLanguageCorrection === 'on',
                }))
              }
              size="compact"
            />
            <TextField
              accessibilityLabel="Eigene OCR-Wörter"
              label="Eigene OCR-Wörter"
              value={settings.customWords}
              editable={isIos && !isBusy}
              multiline
              placeholder="Optional, getrennt durch Komma oder neue Zeile"
              onChangeText={(customWords) =>
                setSettings((current) => ({ ...current, customWords }))
              }
              style={styles.customWords}
            />
            <Txt variant="caption" tone="secondary" style={styles.settingsHint} selectable>
              Fast, Sprachkorrektur und eigene Wörter werden derzeit nur von Apple Vision
              ausgewertet. Auf Android bleiben diese Felder sichtbar, aber deaktiviert.
            </Txt>
          </View>
        </View>
      </Card>

      <Card style={styles.previewCard} padded={false}>
        {runtimeImage ? (
          <View style={styles.previewFrame}>
            <View style={[styles.imageCanvas, { aspectRatio: previewRatio }]}>
              <Image
                source={{ uri: runtimeImage.localUri }}
                style={styles.image}
                contentFit="contain"
              />
              {result ? (
                <View pointerEvents="none" style={styles.overlay}>
                  {result.lines.map((line, index) => {
                    const color = lineColor(line.confidence, colors);
                    return (
                      <View
                        key={lineKey(line)}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={`OCR-Segment ${index + 1}: ${line.text}`}
                        style={[
                          styles.overlayBox,
                          overlayStyle(line.boundingBox),
                          { borderColor: color },
                        ]}>
                        <Txt
                          variant="caption"
                          tone="onAccent"
                          numberOfLines={1}
                          style={[styles.overlayLabel, { backgroundColor: color }]}>
                          {index + 1} · {formatConfidence(line.confidence)}
                        </Txt>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.previewEmpty}>
            <Txt variant="heading" center>
              Noch kein Prüfbild
            </Txt>
            <Txt variant="body" tone="secondary" center>
              Wähle einen Bon aus, um Bildgeometrie, erkannte Segmente und den vollständigen OCR-
              Text zu sehen.
            </Txt>
          </View>
        )}
        {result ? (
          <View style={styles.legend}>
            {CONFIDENCE_LEGEND.map(({ label, colorKey }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors[colorKey] }]} />
                <Txt variant="caption" tone="secondary">
                  {label}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <Txt variant="heading">Pipeline-Diagnose</Txt>
        <Zeile
          label="Status"
          wert={phaseLabel(phase)}
          tone={phase === 'error' ? 'danger' : phase === 'ready' ? 'accent' : undefined}
        />
        <Zeile label="Provider" wert={providerLabel()} />
        <Zeile
          label="OCR-Modell"
          wert={availabilityLabel(availability)}
          tone={
            availability.status === 'error' || availability.status === 'unavailable'
              ? 'danger'
              : availability.status === 'available'
                ? 'accent'
                : 'warning'
          }
        />
        {modelProgress !== null ? (
          <Zeile label="Modellfortschritt" wert={`${modelProgress} %`} />
        ) : null}
        {runtimeImage ? (
          <>
            <Zeile
              label="Arbeitsbild"
              wert={`${runtimeImage.width || '—'} × ${runtimeImage.height || '—'} px`}
            />
            <Zeile
              label="Datei"
              wert={`${runtimeImage.mimeType}, ${formatBytes(runtimeImage.byteSize)}`}
            />
          </>
        ) : null}
        {result ? (
          <>
            <Zeile label="Erkannte Segmente" wert={`${result.lines.length}`} tone="accent" />
            <Zeile label="Ø Konfidenz" wert={formatConfidence(average)} />
            <Zeile label="OCR-Laufzeit" wert={elapsedMs === null ? '—' : `${elapsedMs} ms`} />
          </>
        ) : null}
        {error ? (
          <Txt variant="caption" tone="danger" selectable accessibilityRole="alert">
            {error.code}: {error.message}
          </Txt>
        ) : null}
        <Button
          title="Modellstatus aktualisieren"
          variant="secondary"
          icon="refresh-cw"
          loading={availability.status === 'checking'}
          disabled={isBusy}
          onPress={() => void refreshAvailability()}
        />
      </Card>

      <Card style={styles.outputCard}>
        <Row justify="space-between" align="center">
          <Txt variant="heading">Gesamter erkannter Text</Txt>
          <Button
            title={copyStatus ?? 'Kopieren'}
            variant="link"
            size="sm"
            disabled={!recognizedText}
            onPress={() => void copyRecognizedText()}
          />
        </Row>
        <TextField
          accessibilityLabel="Gesamter erkannter Text"
          value={recognizedText}
          editable={false}
          multiline
          placeholder="Nach der Erkennung erscheint hier jede OCR-Zeile in ihrer Reihenfolge."
          style={styles.output}
        />
      </Card>

      {result ? (
        <Card>
          <Txt variant="heading">Erkannte Segmente</Txt>
          <View style={styles.segmentList}>
            {result.lines.map((line, index) => {
              const color = lineColor(line.confidence, colors);
              return (
                <View key={lineKey(line)} style={styles.segmentRow}>
                  <Txt variant="caption" tone="secondary" style={styles.segmentIndex}>
                    {index + 1}
                  </Txt>
                  <View style={styles.segmentContent}>
                    <Txt variant="body" selectable>
                      {line.text}
                    </Txt>
                    <View style={styles.segmentMeta}>
                      <Txt variant="caption" color={color}>
                        Konfidenz: {formatConfidence(line.confidence)}
                      </Txt>
                      <Txt variant="caption" tone="secondary">
                        Box: {Math.round(line.boundingBox.x * 100)} %,{' '}
                        {Math.round(line.boundingBox.y * 100)} %
                      </Txt>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
