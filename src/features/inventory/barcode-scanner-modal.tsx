import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { useTheme } from '@/hooks/use-theme';
import { fetchProductByBarcode, type OpenFoodFactsProduct } from '@/lib/open-food-facts';

// Verhindert einen App-Crash, wenn das native Kameramodul fehlt.
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
  onProductFound: (product: OpenFoodFactsProduct) => void;
}

export function BarcodeScannerModal({
  visible,
  onClose,
  onProductFound,
}: BarcodeScannerModalProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissionsHook();
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Der synchrone Guard blockiert Mehrfachtreffer vor dem naechsten Render.
  const scanningRef = useRef(false);

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanningRef.current || !data) return;
    scanningRef.current = true;
    setScanning(true);
    setErrorMsg(null);

    try {
      const product = await fetchProductByBarcode(data);
      if (product) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onProductFound(product);
        onClose();
      } else {
        setErrorMsg(`Kein Produkt für Barcode ${data} gefunden.`);
      }
    } catch {
      setErrorMsg('Fehler beim Abrufen der Produktdaten.');
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
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

          {scanning && (
            <View className="scanner-status-box">
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small">Suche Produktdaten...</ThemedText>
            </View>
          )}

          {errorMsg && (
            <ThemedText type="smallDanger" className="text-center">
              {errorMsg}
            </ThemedText>
          )}

          <Button label="Schließen" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
