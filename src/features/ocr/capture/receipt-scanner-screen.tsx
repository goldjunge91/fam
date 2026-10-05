import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { goBackTo } from '@/components/layout/back-button';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, IconButton, Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useResumableReceiptDraft } from '@/features/ocr/capture/api';
import type { ReceiptPickerAsset } from '@/features/ocr/capture/capture/contracts';
import { ReceiptCaptureReviewFlow } from '@/features/ocr/processing/review/receipt-capture-review-flow';

// Defensiver Import wie im Barcode-Scanner: verhindert App-Crashes
// ("Cannot find native module ExpoCamera"), wenn der Native Dev Build noch
// nicht kompiliert ist oder Expo Go genutzt wird.
// biome-ignore lint/suspicious/noExplicitAny: Dynamic Expo Camera Module
let CameraViewComp: any = null;
// biome-ignore lint/suspicious/noExplicitAny: Dynamic Expo Camera Hook
let useCameraPermissionsHook: any = () => [null, async () => ({ granted: false })];
let isCameraSupported = false;

try {
  const ExpoCamera = require('expo-camera');
  if (ExpoCamera?.CameraView) {
    CameraViewComp = ExpoCamera.CameraView;
    useCameraPermissionsHook = ExpoCamera.useCameraPermissions;
    isCameraSupported = true;
  }
} catch {
  isCameraSupported = false;
}

const SCAN_FRAME_ASPECT_RATIO = 3 / 4;
const CORNER_SIZE = 30;
const CORNER_BORDER = 3;

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: theme.space.sm,
  },
  headerSpacer: {
    flex: 1,
  },
  titleBlock: {
    gap: theme.space.xs,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.md,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
  },
  frame: {
    width: '100%',
    aspectRatio: SCAN_FRAME_ASPECT_RATIO,
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.viewerBackground,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: theme.warning,
  },
  cornerTopLeft: {
    top: theme.space.md,
    left: theme.space.md,
    borderTopWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderTopLeftRadius: theme.radius.sm,
  },
  cornerTopRight: {
    top: theme.space.md,
    right: theme.space.md,
    borderTopWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderTopRightRadius: theme.radius.sm,
  },
  cornerBottomLeft: {
    bottom: theme.space.md,
    left: theme.space.md,
    borderBottomWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderBottomLeftRadius: theme.radius.sm,
  },
  cornerBottomRight: {
    bottom: theme.space.md,
    right: theme.space.md,
    borderBottomWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderBottomRightRadius: theme.radius.sm,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.xl,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.space.md,
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.xxl,
  },
  done: {
    minHeight: 52,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.danger,
  },
  galleryButton: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  },
  error: {
    paddingBottom: theme.space.sm,
  },
  resume: {
    gap: theme.space.xs,
    marginBottom: theme.space.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  },
}));

type LiveShot = Pick<ReceiptPickerAsset, 'uri' | 'mimeType' | 'width' | 'height'>;

type InitialCapture = {
  source: 'camera' | 'gallery';
  sourceAsset?: LiveShot;
  sourceAssets?: readonly LiveShot[];
};

/** Connects the scanner presentation to the existing capture, OCR, and review flow. */
export function ReceiptScannerScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [flowOpen, setFlowOpen] = useState(false);
  const [shots, setShots] = useState<readonly LiveShot[]>([]);
  // Stabiler Zeiger fuer den Flow: neu gesetzt bei jedem Oeffnen, damit der
  // Direkteinstieg nicht bei jedem Render erneut startet.
  const [initialCapture, setInitialCapture] = useState<InitialCapture | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const cameraRef = useRef<{ takePictureAsync?: () => Promise<LiveShot & { uri: string }> }>(null);
  const { session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const userId = session?.user.id;
  const resumableDraft = useResumableReceiptDraft(userId);
  const [permission, requestPermission] = useCameraPermissionsHook();

  const livePreviewAvailable = isCameraSupported && Boolean(permission?.granted);
  function closeFlow() {
    setFlowOpen(false);
    setShots([]);
    setInitialCapture(null);
  }

  function openFlow(source: 'camera' | 'gallery', capturedShots: readonly LiveShot[] = []) {
    setCaptureError(null);
    setInitialCapture(
      source === 'camera' && capturedShots.length > 0
        ? { source: 'camera', sourceAssets: capturedShots }
        : { source },
    );
    setFlowOpen(true);
  }

  async function handleShutter() {
    if (!livePreviewAvailable) {
      // Ohne Live-Vorschau uebernimmt der bestehende Systemkamera-Pfad im Flow.
      openFlow('camera');
      return;
    }
    setCaptureError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync?.();
      const uri = typeof photo?.uri === 'string' ? photo.uri : '';
      if (uri.length === 0) throw new Error(t('ocr.scanner.captureFailed'));
      // Mehrere Seiten desselben Belegs sammeln; erst "Fertig" startet die
      // Erkennung mit allen Aufnahmen in Reihenfolge.
      setShots((current) => [
        ...current,
        { uri, mimeType: 'image/jpeg', width: photo?.width, height: photo?.height },
      ]);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : t('ocr.scanner.captureFailed'));
    }
  }

  return (
    <>
      <View style={styles.root}>
        <View style={styles.body}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <IconButton
              icon="x"
              onPress={() => goBackTo('/shopping-list')}
              accessibilityLabel={t('ocr.scanner.close')}
              color={colors.text}
              bg={colors.backgroundElement}
            />
          </View>

          <View style={styles.titleBlock}>
            <Txt variant="title">{t('ocr.scanner.title')}</Txt>
          </View>

          <View style={styles.stage}>
            <View style={styles.frame}>
              {livePreviewAvailable ? (
                <CameraViewComp ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
              ) : (
                <View style={styles.fallback}>
                  <Txt variant="body" tone="secondary" center>
                    {permission && !permission.granted
                      ? t('ocr.scanner.cameraPermissionTitle')
                      : t('ocr.scanner.cameraUnavailable')}
                  </Txt>
                  {permission && !permission.granted ? (
                    <Button
                      title={t('ocr.scanner.cameraPermissionAction')}
                      onPress={() => void requestPermission()}
                    />
                  ) : null}
                </View>
              )}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
          </View>

          {captureError ? (
            <View style={styles.error}>
              <Txt variant="body" tone="danger" accessibilityRole="alert">
                {captureError}
              </Txt>
            </View>
          ) : null}

          {resumableDraft.data ? (
            <Press
              onPress={() => {
                setCaptureError(null);
                setShots([]);
                setInitialCapture(null);
                setFlowOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('ocr.scanner.resumeDraft')}
              style={styles.resume}>
              <Txt variant="label">{t('ocr.scanner.resumeDraft')}</Txt>
              <Txt variant="caption" tone="secondary">
                {t('ocr.scanner.resumeHint')}
              </Txt>
            </Press>
          ) : null}

          <View style={styles.footer}>
            <Press
              onPress={() => void handleShutter()}
              accessibilityRole="button"
              accessibilityLabel={t('ocr.scanner.shutter')}
              style={styles.shutter}>
              <Feather name="camera" size={28} color={colors.onDanger} />
            </Press>
            {shots.length === 0 ? (
              <Press
                onPress={() => openFlow('gallery')}
                accessibilityRole="button"
                accessibilityLabel={t('ocr.scanner.gallery')}
                style={styles.galleryButton}>
                <Feather name="image" size={22} color={colors.text} />
              </Press>
            ) : (
              <Press
                onPress={() => openFlow('camera', shots)}
                accessibilityRole="button"
                accessibilityLabel={t('ocr.scanner.doneCount', { count: shots.length })}
                style={styles.done}>
                <Txt variant="label" weight="700" tone="inverse">
                  {t('ocr.scanner.doneCount', { count: shots.length })}
                </Txt>
              </Press>
            )}
          </View>
        </View>
      </View>

      {userId && activeHouseholdId ? (
        <ReceiptCaptureReviewFlow
          visible={flowOpen}
          householdId={activeHouseholdId}
          createdBy={userId}
          onDismiss={closeFlow}
          initialCapture={initialCapture ?? undefined}
        />
      ) : null}
    </>
  );
}
