import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';
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
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { formatBytes, Zeile } from '../dev-screen-shared';
import {
  detectInspectorReceiptGeometry,
  type InspectorReceiptGeometry,
} from './ocr-inspector-geometry';
import type { ManualLabelSelection } from './ocr-inspector-manual-labels';
import { ManualLabelAssignment } from './ocr-inspector-manual-labels';
import { OcrInspectorOutputActions } from './ocr-inspector-output-actions';
import {
  type InspectorBrightness,
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
  type InspectorThreshold,
  isGoogleMlKitAvailable,
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
  iosProvider: 'apple-vision' | 'google-mlkit';
  language: InspectorLanguage;
  recognitionLevel: InspectorRecognitionLevel;
  usesLanguageCorrection: boolean;
  customWords: string;
};

const INITIAL_SETTINGS: InspectorSettings = {
  iosProvider: 'apple-vision',
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
  brightness: 'none',
  threshold: 'off',
};

const LANGUAGE_OPTIONS = [
  { value: 'auto', labelKey: 'dev.ocr.languageAuto' },
  { value: 'de-DE', labelKey: 'dev.ocr.languageDe' },
  { value: 'en-US', labelKey: 'dev.ocr.languageEn' },
  { value: 'fr-FR', labelKey: 'dev.ocr.languageFr' },
] as const satisfies ReadonlyArray<{ value: InspectorLanguage; labelKey: string }>;

const RESIZE_OPTIONS = [
  { value: 'source', labelKey: 'dev.ocr.keepSource' },
  { value: '1600', labelKey: 'dev.ocr.smaller1600' },
  { value: '2400', labelKey: 'dev.ocr.standard2400' },
  { value: '3200', labelKey: 'dev.ocr.larger3200' },
] as const satisfies ReadonlyArray<{ value: InspectorResize; labelKey: string }>;

const CROP_OPTIONS = [
  { value: 'none', labelKey: 'dev.ocr.noCrop' },
  { value: 'edges-2', labelKey: 'dev.ocr.crop2' },
  { value: 'edges-5', labelKey: 'dev.ocr.crop5' },
] as const satisfies ReadonlyArray<{ value: InspectorCrop; labelKey: string }>;

const QUALITY_OPTIONS = [
  { value: 'source', labelKey: 'dev.ocr.keepSource' },
  { value: 'low', labelKey: 'dev.ocr.jpegLow' },
  { value: 'standard', labelKey: 'dev.ocr.jpegStandard' },
  { value: 'max', labelKey: 'dev.ocr.jpegMax' },
] as const satisfies ReadonlyArray<{ value: InspectorQuality; labelKey: string }>;

const COLOR_OPTIONS = [
  { value: 'color', labelKey: 'dev.ocr.color' },
  { value: 'grayscale', labelKey: 'dev.ocr.grayscale' },
] as const satisfies ReadonlyArray<{ value: InspectorColorMode; labelKey: string }>;

const CONTRAST_OPTIONS = [
  { value: 'none', labelKey: 'dev.ocr.normal' },
  { value: 'low', labelKey: 'dev.ocr.contrast20' },
  { value: 'high', labelKey: 'dev.ocr.contrast45' },
] as const satisfies ReadonlyArray<{ value: InspectorContrast; labelKey: string }>;

const SHARPEN_OPTIONS = [
  { value: 'off', labelKey: 'dev.ocr.off' },
  { value: 'medium', labelKey: 'dev.ocr.medium' },
] as const satisfies ReadonlyArray<{ value: InspectorSharpen; labelKey: string }>;

const BRIGHTNESS_OPTIONS = [
  { value: 'low', labelKey: 'dev.ocr.brightnessMinus15' },
  { value: 'none', labelKey: 'dev.ocr.normal' },
  { value: 'high', labelKey: 'dev.ocr.brightnessPlus15' },
] as const satisfies ReadonlyArray<{ value: InspectorBrightness; labelKey: string }>;

const THRESHOLD_OPTIONS = [
  { value: 'off', labelKey: 'dev.ocr.off' },
  { value: 'auto', labelKey: 'dev.ocr.auto' },
] as const satisfies ReadonlyArray<{ value: InspectorThreshold; labelKey: string }>;

type AvailabilityState =
  | { status: 'checking' }
  | { status: 'error'; code: string; message: string }
  | ReceiptOcrModelAvailability;

const INITIAL_AVAILABILITY: AvailabilityState = { status: 'checking' };

const CONFIDENCE_LEGEND = [
  { labelKey: 'dev.ocr.high', colorKey: 'success' },
  { labelKey: 'dev.ocr.medium', colorKey: 'warning' },
  { labelKey: 'dev.ocr.low', colorKey: 'danger' },
  { labelKey: 'dev.ocr.unknown', colorKey: 'accent' },
] as const satisfies ReadonlyArray<{
  labelKey: string;
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
  geometryOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  manualLabels: {
    gap: theme.space.sm,
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

function availabilityLabel(availability: AvailabilityState, t: TFunction): string {
  switch (availability.status) {
    case 'checking':
      return t('dev.ocr.availabilityChecking');
    case 'available':
      return t('dev.ocr.availabilityReady');
    case 'downloadable':
      return t('dev.ocr.downloadRequired');
    case 'downloading':
      return t('dev.states.loading');
    case 'unavailable':
      return t('dev.ocr.unavailableReason', { reason: availability.reason });
    case 'error':
      return `${availability.code}: ${availability.message}`;
  }
}

function phaseLabel(phase: InspectorPhase, t: TFunction): string {
  switch (phase) {
    case 'idle':
      return t('dev.ocr.phaseIdle');
    case 'picking':
      return t('dev.ocr.phasePicking');
    case 'preparing':
      return t('dev.ocr.phasePreparing');
    case 'preparing-image':
      return t('dev.ocr.phasePreparingImage');
    case 'recognizing':
      return t('dev.ocr.phaseRecognizing');
    case 'ready':
      return t('dev.ocr.phaseReady');
    case 'error':
      return t('dev.ocr.phaseError');
  }
}

function languageTags(settings: InspectorSettings): string[] {
  return settings.language === 'auto' ? [] : [settings.language];
}

function requiresInspectorNativePath(settings: InspectorSettings): boolean {
  return (
    settings.iosProvider !== 'apple-vision' ||
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

function providerLabel(settings: InspectorSettings): string {
  if (process.env.EXPO_OS === 'ios') {
    return settings.iosProvider === 'google-mlkit'
      ? 'expo-mlkit-ocr · Google ML Kit'
      : 'expo-ai-kit · Apple Vision';
  }
  if (process.env.EXPO_OS === 'android') return 'expo-ai-kit · Google ML Kit';
  return 'expo-ai-kit · native Vision Provider';
}

export function OcrInspectorScreen() {
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();
  const { colors } = useTheme();
  const [image, setImage] = useState<InspectorImage | null>(null);
  const [settings, setSettings] = useState<InspectorSettings>(INITIAL_SETTINGS);
  const [result, setResult] = useState<ReceiptOcrResult | null>(null);
  const [geometry, setGeometry] = useState<InspectorReceiptGeometry | null>(null);
  const [manualLabels, setManualLabels] = useState<ManualLabelSelection>({
    article: [],
    quantity: [],
    unitPrice: [],
    price: [],
  });
  const [recognizedText, setRecognizedText] = useState('');
  const [phase, setPhase] = useState<InspectorPhase>('idle');
  const [availability, setAvailability] = useState<AvailabilityState>(INITIAL_AVAILABILITY);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [lastRunSettings, setLastRunSettings] = useState<InspectorSettings | null>(null);
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
    setGeometry(null);
    setManualLabels({ article: [], quantity: [], unitPrice: [], price: [] });
    setRecognizedText('');
    setError(null);
    setElapsedMs(null);
    setModelProgress(null);
    setLastRunSettings(null);
    setPhase('preparing');

    try {
      const languages = languageTags(runSettings);
      if (runSettings.iosProvider === 'google-mlkit') {
        if (!isGoogleMlKitAvailable()) {
          throw new Error(
            'MLKIT_NOT_ENABLED: Google ML Kit ist in diesem iOS-Build nicht enthalten.',
          );
        }
      } else {
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
      }
      if (!mountedRef.current || operationRef.current !== operation) return;
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
      setGeometry(await detectInspectorReceiptGeometry(nextImage.localUri));
      setPhase('recognizing');

      const nativeSettings: InspectorNativeOcrSettings = {
        iosProvider: runSettings.iosProvider,
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
      setLastRunSettings(runSettings);
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
    setGeometry(null);
    setManualLabels({ article: [], quantity: [], unitPrice: [], price: [] });
    setRecognizedText('');
    setError(null);
    setElapsedMs(null);
    setLastRunSettings(null);
    setPhase('idle');
    await cleanupOwnedImages();
  }

  const average = result ? averageConfidence(result.lines) : null;
  const resultUsesMlKit =
    isIos && result !== null && lastRunSettings?.iosProvider === 'google-mlkit';
  const isBusy =
    phase === 'picking' ||
    phase === 'preparing' ||
    phase === 'preparing-image' ||
    phase === 'recognizing';
  const settingsDirty =
    Boolean(image) && JSON.stringify(lastRunSettings) !== JSON.stringify(settings);
  const selectedAvailability: AvailabilityState =
    isIos && settings.iosProvider === 'google-mlkit'
      ? isGoogleMlKitAvailable()
        ? { status: 'available' }
        : { status: 'unavailable', reason: 'not-enabled' }
      : availability;
  const runtimeImage = image && result ? { ...image, ...result.imageSize } : image;
  const previewRatio =
    runtimeImage && runtimeImage.height > 0 ? runtimeImage.width / runtimeImage.height : 1;

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.ocr.title')}
      subtitle={t('dev.ocr.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <Card>
        <View style={styles.actionStack}>
          <Button
            title={t('dev.ocr.selectImage')}
            icon="image"
            full
            loading={phase === 'picking'}
            disabled={isBusy}
            onPress={() => void selectImage()}
          />
          {image ? (
            <Row gap={8}>
              <Button
                title={settingsDirty ? t('dev.ocr.runWithSettings') : t('dev.ocr.rerun')}
                variant="secondary"
                icon="refresh-cw"
                style={{ flex: 1 }}
                loading={isBusy}
                disabled={isBusy}
                onPress={() => void rerunRecognition()}
              />
              <Button
                title={t('dev.ocr.removeImage')}
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
          {t('dev.ocr.hint')}
        </Txt>
      </Card>

      <Card style={styles.settingsCard}>
        <View style={styles.settingsGroup}>
          <Txt variant="heading">{t('dev.ocr.configuration')}</Txt>
          <Txt variant="caption" tone="secondary" selectable>
            {t('dev.ocr.configurationHint')}
          </Txt>
        </View>

        <View
          pointerEvents={isBusy ? 'none' : 'auto'}
          style={isBusy ? { opacity: 0.55 } : undefined}>
          <View style={styles.settingsGroup}>
            <Txt variant="subheading">{t('dev.ocr.preprocessing')}</Txt>
            <WheelPickerField
              label={t('dev.ocr.resolution')}
              value={settings.resize}
              options={RESIZE_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onChange={(resize) =>
                setSettings((current) => ({ ...current, resize: resize as InspectorResize }))
              }
            />
            <WheelPickerField
              label={t('dev.ocr.crop')}
              value={settings.crop}
              options={CROP_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onChange={(crop) =>
                setSettings((current) => ({ ...current, crop: crop as InspectorCrop }))
              }
            />
            <WheelPickerField
              label={t('dev.ocr.jpegQuality')}
              value={settings.quality}
              options={QUALITY_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onChange={(quality) =>
                setSettings((current) => ({ ...current, quality: quality as InspectorQuality }))
              }
            />
            <SegmentedControl
              label={t('dev.ocr.colorMode')}
              selected={settings.colorMode}
              options={COLOR_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onSelect={(colorMode) => setSettings((current) => ({ ...current, colorMode }))}
              size="compact"
            />
            <SegmentedControl
              label={t('dev.ocr.contrast')}
              selected={settings.contrast}
              options={CONTRAST_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onSelect={(contrast) => setSettings((current) => ({ ...current, contrast }))}
              size="compact"
            />
            <SegmentedControl
              label={t('dev.ocr.sharpen')}
              selected={settings.sharpen}
              options={SHARPEN_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onSelect={(sharpen) => setSettings((current) => ({ ...current, sharpen }))}
              size="compact"
            />
            <SegmentedControl
              label={t('dev.ocr.brightness')}
              selected={settings.brightness}
              options={BRIGHTNESS_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onSelect={(brightness) => setSettings((current) => ({ ...current, brightness }))}
              size="compact"
            />
            <SegmentedControl
              label={t('dev.ocr.threshold')}
              selected={settings.threshold}
              options={THRESHOLD_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onSelect={(threshold) => setSettings((current) => ({ ...current, threshold }))}
              size="compact"
            />
          </View>

          <View style={styles.settingsGroup}>
            <Txt variant="subheading">{t('dev.ocr.native')}</Txt>
            {isIos ? (
              <SegmentedControl
                label={t('dev.ocr.ocrEngine')}
                selected={settings.iosProvider}
                options={[
                  { value: 'apple-vision', label: 'Apple Vision' },
                  {
                    value: 'google-mlkit',
                    label: 'Google ML Kit',
                    disabled: !isGoogleMlKitAvailable(),
                  },
                ]}
                onSelect={(iosProvider) =>
                  setSettings((current) => ({
                    ...current,
                    iosProvider: iosProvider as InspectorSettings['iosProvider'],
                  }))
                }
                size="compact"
              />
            ) : null}
            {isIos && !isGoogleMlKitAvailable() ? (
              <Txt variant="caption" tone="secondary" selectable>
                {t('dev.ocr.mlKitUnavailable')}
              </Txt>
            ) : null}
            {isIos && settings.iosProvider === 'google-mlkit' ? (
              <Txt variant="caption" tone="secondary" selectable>
                {t('dev.ocr.mlKitHint')}
              </Txt>
            ) : null}
            <WheelPickerField
              label={t('dev.ocr.ocrLanguage')}
              value={settings.language}
              options={LANGUAGE_OPTIONS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              onChange={(language) =>
                setSettings((current) => ({
                  ...current,
                  language: language as InspectorLanguage,
                }))
              }
            />
            <SegmentedControl
              label={t('dev.ocr.recognitionMode')}
              selected={settings.recognitionLevel}
              options={[
                { value: 'accurate', label: t('dev.ocr.accurate') },
                { value: 'fast', label: t('dev.ocr.fast'), disabled: !isIos },
              ]}
              onSelect={(recognitionLevel) =>
                setSettings((current) => ({ ...current, recognitionLevel }))
              }
              size="compact"
            />
            <SegmentedControl
              label={t('dev.ocr.languageCorrection')}
              selected={settings.usesLanguageCorrection ? 'on' : 'off'}
              options={[
                { value: 'on', label: t('dev.ocr.on'), disabled: !isIos },
                { value: 'off', label: t('dev.ocr.off'), disabled: !isIos },
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
              accessibilityLabel={t('dev.ocr.customWords')}
              label={t('dev.ocr.customWords')}
              value={settings.customWords}
              editable={isIos && !isBusy}
              multiline
              placeholder={t('dev.ocr.customWordsPlaceholder')}
              onChangeText={(customWords) =>
                setSettings((current) => ({ ...current, customWords }))
              }
              style={styles.customWords}
            />
            <Txt variant="caption" tone="secondary" style={styles.settingsHint} selectable>
              {t('dev.ocr.nativeOptionsHint')}
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
              {geometry ? (
                <Svg
                  accessibilityLabel={t('dev.ocr.receiptFrame')}
                  accessible
                  pointerEvents="none"
                  style={styles.geometryOverlay}
                  viewBox="0 0 1 1">
                  <Polygon
                    fill="none"
                    points={geometry.quad.map(({ x, y }) => `${x},${y}`).join(' ')}
                    stroke={colors.warning}
                    strokeDasharray={[0.012, 0.008]}
                    strokeWidth={0.005}
                  />
                  {geometry.quad.map(({ x, y }) => (
                    <Circle key={`${x}-${y}`} cx={x} cy={y} fill={colors.warning} r={0.009} />
                  ))}
                </Svg>
              ) : null}
              {result ? (
                <View pointerEvents="none" style={styles.overlay}>
                  {result.lines.map((line, index) => {
                    const color = lineColor(line.confidence, colors);
                    return (
                      <View
                        key={lineKey(line)}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={t('dev.ocr.segmentAccessibility', {
                          index: index + 1,
                          text: line.text,
                        })}
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
                          {resultUsesMlKit
                            ? index + 1
                            : `${index + 1} · ${formatConfidence(line.confidence)}`}
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
              {t('dev.ocr.emptyPreviewTitle')}
            </Txt>
            <Txt variant="body" tone="secondary" center>
              {t('dev.ocr.emptyPreviewHint')}
            </Txt>
          </View>
        )}
        {result || geometry ? (
          <View style={styles.legend}>
            {result && !resultUsesMlKit
              ? CONFIDENCE_LEGEND.map(({ labelKey, colorKey }) => (
                  <View key={labelKey} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors[colorKey] }]} />
                    <Txt variant="caption" tone="secondary">
                      {t(labelKey)}
                    </Txt>
                  </View>
                ))
              : null}
            {resultUsesMlKit ? (
              <Txt variant="caption" tone="secondary" selectable>
                {t('dev.ocr.mlKitQuality')}
              </Txt>
            ) : null}
            {geometry ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                <Txt variant="caption" tone="secondary">
                  {t('dev.ocr.receiptFrameFallback')}
                </Txt>
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card>
        <Txt variant="heading">{t('dev.ocr.diagnostics')}</Txt>
        <Zeile
          label={t('dev.ocr.status')}
          wert={phaseLabel(phase, t)}
          tone={phase === 'error' ? 'danger' : phase === 'ready' ? 'accent' : undefined}
        />
        <Zeile
          label={t('dev.ocr.runWith')}
          wert={result && lastRunSettings ? providerLabel(lastRunSettings) : t('dev.ocr.noResult')}
        />
        <Zeile
          label={t('dev.ocr.model')}
          wert={availabilityLabel(selectedAvailability, t)}
          tone={
            selectedAvailability.status === 'error' || selectedAvailability.status === 'unavailable'
              ? 'danger'
              : selectedAvailability.status === 'available'
                ? 'accent'
                : 'warning'
          }
        />
        {modelProgress !== null ? (
          <Zeile label={t('dev.ocr.progress')} wert={`${modelProgress} %`} />
        ) : null}
        {runtimeImage ? (
          <>
            <Zeile
              label={t('dev.ocr.workingImage')}
              wert={`${runtimeImage.width || '—'} × ${runtimeImage.height || '—'} px`}
            />
            <Zeile
              label={t('dev.ocr.file')}
              wert={`${runtimeImage.mimeType}, ${formatBytes(runtimeImage.byteSize)}`}
            />
          </>
        ) : null}
        <Zeile
          label={t('dev.ocr.receiptFrameLabel')}
          wert={
            geometry
              ? geometry.topEdge === 'observed'
                ? t('dev.ocr.sidesTop')
                : t('dev.ocr.sidesEstimated')
              : t('dev.ocr.notRecognized')
          }
          tone={geometry ? 'accent' : 'warning'}
        />
        {result ? (
          <>
            <Zeile label={t('dev.ocr.segments')} wert={`${result.lines.length}`} tone="accent" />
            <Zeile
              label={t('dev.ocr.quality')}
              wert={
                resultUsesMlKit && average === null
                  ? t('dev.ocr.qualityUnavailable')
                  : formatConfidence(average)
              }
            />
            <Zeile
              label={t('dev.ocr.runtime')}
              wert={elapsedMs === null ? '—' : `${elapsedMs} ms`}
            />
          </>
        ) : null}
        {error ? (
          <Txt variant="caption" tone="danger" selectable accessibilityRole="alert">
            {error.code}: {error.message}
          </Txt>
        ) : null}
        {settings.iosProvider !== 'google-mlkit' ? (
          <Button
            title={t('dev.ocr.refreshModel')}
            variant="secondary"
            icon="refresh-cw"
            loading={availability.status === 'checking'}
            disabled={isBusy}
            onPress={() => void refreshAvailability()}
          />
        ) : null}
      </Card>

      <Card style={styles.outputCard}>
        <Txt variant="heading">{t('dev.ocr.output')}</Txt>
        <OcrInspectorOutputActions
          result={result}
          text={recognizedText}
          runSettings={lastRunSettings}
          manualLabels={manualLabels}
          geometry={geometry}
        />
        <Txt variant="caption" tone="secondary">
          {t('dev.ocr.jsonHint')}
        </Txt>
        <TextField
          accessibilityLabel={t('dev.ocr.outputLabel')}
          value={recognizedText}
          editable={false}
          multiline
          placeholder={t('dev.ocr.outputPlaceholder')}
          style={styles.output}
        />
      </Card>

      {result ? (
        <Card>
          <Txt variant="heading">{t('dev.ocr.segments')}</Txt>
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
                        {t('dev.ocr.qualityValue')}{' '}
                        {resultUsesMlKit && line.confidence === null
                          ? t('dev.ocr.qualityUnavailable')
                          : formatConfidence(line.confidence)}
                      </Txt>
                      <Txt variant="caption" tone="secondary">
                        {t('dev.ocr.box', {
                          x: Math.round(line.boundingBox.x * 100),
                          y: Math.round(line.boundingBox.y * 100),
                        })}
                      </Txt>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {result ? (
        <Card style={styles.manualLabels}>
          <Txt variant="heading">{t('dev.ocr.manualLabels')}</Txt>
          <ManualLabelAssignment
            lines={result.lines}
            selection={manualLabels}
            onChange={setManualLabels}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
