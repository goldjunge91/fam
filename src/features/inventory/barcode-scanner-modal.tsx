import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Txt } from '@/constants/ui';
import { debugLog } from '@/lib/debug-log';

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  modalBox: {
    height: '80%',
    padding: theme.space.xl + theme.space.xs,
    gap: theme.space.lg,
    borderTopLeftRadius: theme.radius.famLarge,
    borderTopRightRadius: theme.radius.famLarge,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.lg,
    paddingHorizontal: theme.space.lg,
  },
  camera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: theme.radius.md,
  },
  targetFrame: {
    width: 220,
    height: 140,
    borderWidth: theme.borderWidth.strong,
    borderRadius: theme.radius.sm,
    borderColor: theme.accent,
    backgroundColor: 'transparent',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
  },
}));

// Defensiver Import: Verhindert App-Crashes ("Cannot find native module ExpoCamera"),
// wenn der Native Dev Build noch nicht kompiliert wurde oder Expo Go genutzt wird.
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

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Meldet den rohen Code. Den Produkt-Lookup besitzt das aufrufende Feature. */
  onBarcodeDetected: (barcode: string) => void;
  /** Laeuft im Aufrufer gerade ein Lookup? Nur Anzeige. */
  looking?: boolean;
  /** Fehlertext des Aufrufers, z. B. "Kein Produkt gefunden". */
  errorMessage?: string | null;
}

export function BarcodeScannerModal({
  visible,
  onClose,
  onBarcodeDetected,
  looking = false,
  errorMessage = null,
}: BarcodeScannerModalProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissionsHook();
  // Ref statt State: die Kamera feuert onBarcodeScanned pro erkanntem Frame,
  // oft mehrfach bevor ein State-Update im naechsten Render sichtbar wird.
  // Ohne synchronen Guard rutschen mehrere Aufrufe durch und loesen mehrfache
  // Navigation (mehrfach gestapeltes Modal) aus. Das ist Kamera-Verhalten und
  // bleibt deshalb hier, obwohl der Lookup selbst nochmal entprellt.
  const scannedRef = useRef<string | null>(null);

  // Jedes Oeffnen ist ein neuer Scanversuch: sonst bliebe derselbe Code nach
  // einem "nicht gefunden" dauerhaft gesperrt.
  useEffect(() => {
    if (!visible) return;
    scannedRef.current = null;
    if (__DEV__) {
      debugLog('[InventorySheet] inventory.barcode-modal.open', {
        sheetId: 'inventory.barcode-modal',
      });
    }
  }, [visible]);

  function handleBarcodeScanned({ data }: { data: string }) {
    if (!data || scannedRef.current === data) return;
    scannedRef.current = data;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onBarcodeDetected(data);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <Txt variant="title">📷 Barcode scannen</Txt>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              style={styles.closeButton}>
              <Txt variant="subheading" tone="secondary">
                ✕
              </Txt>
            </Pressable>
          </View>

          {!isCameraSupported ? (
            <View style={styles.permission}>
              <Txt tone="secondary" center>
                Der Kamera-Barcode-Scanner benötigt ein natives Build (`bun run ios` oder `bun run
                android`). Im Simulator (kein Kamerazugriff) oder ohne Kamera gib den Barcode
                stattdessen direkt in die Suche ein.
              </Txt>
            </View>
          ) : !permission?.granted ? (
            <View style={styles.permission}>
              <Txt center>
                Kamera-Berechtigung ist erforderlich, um Produkt-Barcodes zu scannen.
              </Txt>
              <Button title="Kamera erlauben" onPress={requestPermission} />
            </View>
          ) : (
            <View style={styles.camera}>
              {/* CameraViewComp (expo-camera) ist nicht NativeWind-registriert. */}
              <CameraViewComp
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'qr'],
                }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View style={styles.targetFrame} />
            </View>
          )}

          {looking && (
            <View style={styles.status}>
              <ActivityIndicator color={colors.accent} />
              <Txt variant="body">Suche Produktdaten...</Txt>
            </View>
          )}

          {errorMessage && (
            <Txt variant="body" tone="danger" center>
              {errorMessage}
            </Txt>
          )}

          <Button title="Schließen" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
