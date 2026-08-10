import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
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
  const [manualBarcode, setManualBarcode] = useState('');

  /**
   * Gemeinsamer Lookup fuer Kamera-Scan und manuelle Eingabe (#Simulator-
   * Fallback): der iOS-Simulator hat grundsaetzlich keinen Kamerazugriff —
   * das ist eine Apple-Einschraenkung, keine Frage der Host-Hardware —,
   * ohne diesen Weg liesse sich der Scanner dort gar nicht testen.
   */
  async function lookupBarcode(barcode: string) {
    if (scanning || !barcode) return;
    setScanning(true);
    setErrorMsg(null);

    try {
      const product = await fetchProductByBarcode(barcode);
      if (product) {
        onProductFound(product);
        onClose();
      } else {
        setErrorMsg(`Kein Produkt für Barcode ${barcode} gefunden.`);
      }
    } catch {
      setErrorMsg('Fehler beim Abrufen der Produktdaten.');
    } finally {
      setScanning(false);
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    lookupBarcode(data);
  }

  function handleManualSubmit() {
    const trimmed = manualBarcode.trim();
    lookupBarcode(trimmed);
    setManualBarcode('');
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
                android`). Gib den Barcode unten manuell ein, oder nutze direkt die
                Live-Produktsuche.
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

          <View style={styles.manualRow}>
            <View style={styles.flex}>
              <TextField
                placeholder="Barcode manuell eingeben"
                value={manualBarcode}
                onChangeText={setManualBarcode}
                keyboardType="numeric"
                onSubmitEditing={handleManualSubmit}
              />
            </View>
            <Button label="Suchen" onPress={handleManualSubmit} disabled={!manualBarcode.trim()} />
          </View>

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
  manualRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
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
