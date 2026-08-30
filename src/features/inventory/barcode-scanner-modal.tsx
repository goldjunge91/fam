import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
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
    if (visible) scannedRef.current = null;
  }, [visible]);

  function handleBarcodeScanned({ data }: { data: string }) {
    if (!data || scannedRef.current === data) return;
    scannedRef.current = data;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onBarcodeDetected(data);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="scanner-backdrop">
        <View className="scanner-modal-box bg-background">
          <View className="modal-header-row">
            <ThemedText type="subtitle">📷 Barcode scannen</ThemedText>
            <Pressable onPress={onClose} hitSlop={10}>
              <ThemedText themeColor="textSecondary" className="text-[18px]">
                ✕
              </ThemedText>
            </Pressable>
          </View>

          {!isCameraSupported ? (
            <View className="scanner-permission-box">
              <ThemedText className="text-center" themeColor="textSecondary">
                Der Kamera-Barcode-Scanner benötigt ein natives Build (`bun run ios` oder `bun run
                android`). Im Simulator (kein Kamerazugriff) oder ohne Kamera gib den Barcode
                stattdessen direkt in die Suche ein.
              </ThemedText>
            </View>
          ) : !permission?.granted ? (
            <View className="scanner-permission-box">
              <ThemedText className="text-center">
                Kamera-Berechtigung ist erforderlich, um Produkt-Barcodes zu scannen.
              </ThemedText>
              <Button label="Kamera erlauben" onPress={requestPermission} />
            </View>
          ) : (
            <View className="scanner-camera-container">
              {/* CameraViewComp (expo-camera) ist nicht NativeWind-registriert. */}
              <CameraViewComp
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'qr'],
                }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View className="scanner-target-frame" />
            </View>
          )}

          {looking && (
            <View className="scanner-status-box">
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small">Suche Produktdaten...</ThemedText>
            </View>
          )}

          {errorMessage && (
            <ThemedText type="smallDanger" className="text-center">
              {errorMessage}
            </ThemedText>
          )}

          <Button label="Schließen" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
