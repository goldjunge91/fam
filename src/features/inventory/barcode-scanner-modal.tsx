import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchProductByBarcode, type OpenFoodFactsProduct } from '@/lib/open-food-facts';

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

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanning || !data) return;
    setScanning(true);
    setErrorMsg(null);

    try {
      const product = await fetchProductByBarcode(data);
      if (product) {
        onProductFound(product);
        onClose();
      } else {
        setErrorMsg(`Kein Produkt für Barcode ${data} gefunden.`);
      }
    } catch {
      setErrorMsg('Fehler beim Abrufen der Produktdaten.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">📷 Barcode scannen</ThemedText>
            <Pressable onPress={onClose} hitSlop={10}>
              <ThemedText style={{ fontSize: 18, color: theme.textSecondary }}>✕</ThemedText>
            </Pressable>
          </View>

          {!isCameraSupported ? (
            <View style={styles.permissionBox}>
              <ThemedText style={{ textAlign: 'center' }} themeColor="textSecondary">
                Der Kamera-Barcode-Scanner benötigt ein natives Build (`bun run ios` oder `bun run
                android`). In Web/Expo Go kannst du Produkte direkt über die Live-Produktsuche
                eingeben.
              </ThemedText>
            </View>
          ) : !permission?.granted ? (
            <View style={styles.permissionBox}>
              <ThemedText style={{ textAlign: 'center' }}>
                Kamera-Berechtigung ist erforderlich, um Produkt-Barcodes zu scannen.
              </ThemedText>
              <Button label="Kamera erlauben" onPress={requestPermission} />
            </View>
          ) : (
            <View style={styles.cameraContainer}>
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

          {scanning && (
            <View style={styles.statusBox}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small">Suche Produktdaten...</ThemedText>
            </View>
          )}

          {errorMsg && (
            <ThemedText type="small" themeColor="danger" style={{ textAlign: 'center' }}>
              {errorMsg}
            </ThemedText>
          )}

          <Button label="Schließen" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    height: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetFrame: {
    width: 220,
    height: 140,
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
