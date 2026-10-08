import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { goBackTo } from '@/components/layout/back-button';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { Button, Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useResumableReceiptDraft } from '@/features/ocr/capture/api';
import type { ReceiptPickerAsset } from '@/features/ocr/capture/capture/contracts';
import { ReceiptCaptureReviewFlow } from '@/features/ocr/processing/review/receipt-capture-review-flow';
import { debugLogEvent } from '@/lib/observability/debug-log';

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
const CORNER_SIZE = 18;
const CORNER_BORDER = 2;
/** Nach dieser Standzeit faellt der Einmal-Fokus auf Dauerfokus zurueck. */
const FOCUS_HOLD_MS = 900;

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  safeArea: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.md,
  },
  title: {
    flex: 1,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    paddingTop: theme.space.md,
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
    top: theme.space.xxxl,
    left: theme.space.xxxl,
    borderTopWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderTopLeftRadius: theme.radius.xs,
  },
  cornerTopRight: {
    top: theme.space.xxxl,
    right: theme.space.xxxl,
    borderTopWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderTopRightRadius: theme.radius.xs,
  },
  cornerBottomLeft: {
    bottom: theme.space.xxxl,
    left: theme.space.xxxl,
    borderBottomWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderBottomLeftRadius: theme.radius.xs,
  },
  cornerBottomRight: {
    bottom: theme.space.xxxl,
    right: theme.space.xxxl,
    borderBottomWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderBottomRightRadius: theme.radius.xs,
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
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'auto' | 'on'>('off');
  const [focusRequested, setFocusRequested] = useState(false);
  const cameraRef = useRef<{ takePictureAsync?: () => Promise<LiveShot & { uri: string }> }>(null);
  const { session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const userId = session?.user.id;
  const resumableDraft = useResumableReceiptDraft(userId);
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissionsHook();

  const livePreviewAvailable = isCameraSupported && Boolean(permission?.granted);

  // Einmal-Fokus: 'on' loest genau einen Fokuslauf aus, danach faellt die
  // Kamera wieder in den Dauerfokus zurueck (expo-camera kennt kein
  // Tap-to-Focus; 'on' ist der einzige Fokushebel).
  useEffect(() => {
    if (!focusRequested) return;
    const timer = setTimeout(() => setFocusRequested(false), FOCUS_HOLD_MS);
    return () => clearTimeout(timer);
  }, [focusRequested]);

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
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.body}>
            <View style={styles.header}>
              <Txt variant="title" style={styles.title}>
                {t('ocr.scanner.title')}
              </Txt>
              <HeaderIconButton
                label={t('ocr.scanner.close')}
                onPress={() => {
                  debugLogEvent('receipt.capture.button_pressed', { button: 'close_scanner' });
                  goBackTo('/shopping-list');
                }}>
                <Feather name="x" size={20} color={colors.text} />
              </HeaderIconButton>
            </View>

            <View style={styles.stage}>
              <View style={styles.frame} testID="scan-frame">
                {livePreviewAvailable ? (
                  <CameraViewComp
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    autofocus={focusRequested ? 'on' : 'off'}
                    flash={flash}
                  />
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
                        onPress={() => {
                          debugLogEvent('receipt.capture.button_pressed', {
                            button: 'request_camera_permission',
                          });
                          void requestPermission();
                        }}
                      />
                    ) : null}
                  </View>
                )}
                <View testID="scan-corner-top-left" style={[styles.corner, styles.cornerTopLeft]} />
                <View
                  testID="scan-corner-top-right"
                  style={[styles.corner, styles.cornerTopRight]}
                />
                <View
                  testID="scan-corner-bottom-left"
                  style={[styles.corner, styles.cornerBottomLeft]}
                />
                <View
                  testID="scan-corner-bottom-right"
                  style={[styles.corner, styles.cornerBottomRight]}
                />
              </View>
            </View>

            {livePreviewAvailable ? (
              <View style={styles.cameraControls}>
                <HeaderIconButton
                  label={t('ocr.scanner.switchCamera')}
                  onPress={() => {
                    debugLogEvent('receipt.capture.button_pressed', { button: 'switch_camera' });
                    setFacing((current) => (current === 'back' ? 'front' : 'back'));
                  }}>
                  <Feather name="refresh-cw" size={20} color={colors.text} />
                </HeaderIconButton>
                <HeaderIconButton
                  label={t('ocr.scanner.focus')}
                  onPress={() => {
                    debugLogEvent('receipt.capture.button_pressed', { button: 'focus_camera' });
                    setFocusRequested(true);
                  }}>
                  <Feather name="crosshair" size={20} color={colors.text} />
                </HeaderIconButton>
                <HeaderIconButton
                  label={t(`ocr.scanner.flash.${flash}`)}
                  onPress={() => {
                    debugLogEvent('receipt.capture.button_pressed', { button: 'cycle_flash' });
                    setFlash((current) =>
                      current === 'off' ? 'auto' : current === 'auto' ? 'on' : 'off',
                    );
                  }}>
                  <Feather
                    name={flash === 'off' ? 'zap-off' : 'zap'}
                    size={20}
                    color={flash === 'off' ? colors.text : colors.warning}
                  />
                </HeaderIconButton>
              </View>
            ) : null}

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
                  debugLogEvent('receipt.capture.button_pressed', { button: 'resume_draft' });
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
                onPress={() => {
                  debugLogEvent('receipt.capture.button_pressed', { button: 'take_photo' });
                  void handleShutter();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('ocr.scanner.shutter')}
                style={styles.shutter}>
                <Feather name="camera" size={28} color={colors.onDanger} />
              </Press>
              {shots.length === 0 ? (
                <Press
                  onPress={() => {
                    debugLogEvent('receipt.capture.button_pressed', { button: 'open_gallery' });
                    openFlow('gallery');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('ocr.scanner.gallery')}
                  style={styles.galleryButton}>
                  <Feather name="image" size={22} color={colors.text} />
                </Press>
              ) : (
                <Press
                  onPress={() => {
                    debugLogEvent('receipt.capture.button_pressed', {
                      button: 'finish_capture',
                      page_count: shots.length,
                    });
                    openFlow('camera', shots);
                  }}
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
        </SafeAreaView>
      </View>

      {userId && activeHouseholdId ? (
        <ReceiptCaptureReviewFlow
          visible={flowOpen}
          householdId={activeHouseholdId}
          createdBy={userId}
          onDismiss={closeFlow}
          onSaved={() => {
            closeFlow();
            queryClient.setQueryData(['receipt-resumable-draft', userId], null);
            router.replace('/shopping-list');
          }}
          initialCapture={initialCapture ?? undefined}
        />
      ) : null}
    </>
  );
}
