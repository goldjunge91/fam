# Inventory Feature Codebase Explanation

This document provides a line-by-line and section-by-section breakdown of every non-test source file in the `src/features/inventory` directory of the application. 

The **Inventory Feature** manages household storage locations (such as fridge, freezer, pantry), item addition flows, product barcode scanning via Expo Camera, Open Food Facts product integration (live search and barcode lookup), offline synchronization via SQLite outbox mutations, and rich product detail views (nutrition, macros, allergens, and Nutri-Score).

---

## Table of Contents
1. [add-item-screen.tsx](#add-item-screentsx)
2. [api.ts](#apits)
3. [barcode-scanner-modal.tsx](#barcode-scanner-modaltsx)
4. [fridge-screen.tsx](#fridge-screentsx)
5. [product-detail-modal.tsx](#product-detail-modaltsx)
6. [product-details-catalog.ts](#product-details-catalogts)
7. [product-search-dropdown.tsx](#product-search-dropdowntsx)
8. [storage-locations-screen.tsx](#storage-locations-screentsx)
9. [use-storage-locations.ts](#use-storage-locationsts)

---

## add-item-screen.tsx

**File Path:** `src/features/inventory/add-item-screen.tsx`  
**Total Lines:** 287

### Overview
`add-item-screen.tsx` implements the complete form screen for adding a new inventory item to a household. It integrates barcode scanning via modal, live product auto-completion from Open Food Facts, quick expiry date preset calculations, inline creation of storage locations, and local storage mutation dispatching.

---

### Line-by-Line / Section Breakdown

#### Lines 1–19: Imports
```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/buttons';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAddFridgeItemMutation } from '@/features/fridge/use-fridge-mutations';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import {
  useAddStorageLocationMutation,
  useStorageLocations,
} from '@/features/inventory/use-storage-locations';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
```
- **Lines 1–3**: Import Expo Router navigation utility (`router`), React `useState` hook, and React Native primitives (`StyleSheet`, `View`).
- **Lines 5–9**: Import design system components (`Button`, `Screen`, `TextField`, `ThemedText`) and theme constants (`Spacing`).
- **Lines 10–18**: Import feature hooks for adding fridge items, retrieving active household context, scanning barcodes, searching Open Food Facts, and managing storage locations.
- **Line 19**: Import TypeScript type definition for products returned from Open Food Facts.

---

#### Lines 20–30: Date Offset Helper Functions
```tsx
function formatOffsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatOffsetMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}
```
- **Lines 20–24 (`formatOffsetDate`)**: Takes a number of `days`, adds it to the current date, and returns an ISO date string formatted as `YYYY-MM-DD`. Used by quick preset buttons (`+3 Tage`, `+7 Tage`, `+14 Tage`).
- **Lines 26–30 (`formatOffsetMonths`)**: Takes a number of `months`, adds it to the current date, and returns `YYYY-MM-DD`. Used by quick preset button (`+1 Monat`).

---

#### Lines 32–53: Component Declaration & State Setup
```tsx
export function AddItemScreen() {
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;

  const { data: locations, isLoading: locationsLoading } = useStorageLocations(
    currentHousehold?.id,
  );
  const mutation = useAddFridgeItemMutation();
  const addLocationMutation = useAddStorageLocationMutation();

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState('');

  // Scanner & Modal State
  const [showScanner, setShowScanner] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  const activeLocationId = locationId ?? locations?.[0]?.id ?? null;
```
- **Lines 33–34**: Retrieves active household context to ensure operations target the selected household.
- **Lines 36–40**: Loads existing storage locations for the active household and instantiates mutation hooks for item creation and storage location creation.
- **Lines 42–46**: Maintains form field state (`name`, `quantity`, `unit`, `locationId`, `expiryDate`).
- **Lines 49–51**: Manages visibility state for the barcode scanner modal (`showScanner`), inline location creation box (`showAddLocation`), and new location text input (`newLocationName`).
- **Line 53**: Computes `activeLocationId` defaulting to explicit selection `locationId`, or falling back to the first available location ID in `locations`.

---

#### Lines 55–59: Product Selection Handler
```tsx
  function handleSelectProduct(product: OpenFoodFactsProduct) {
    setName(product.name);
    if (product.quantity) setQuantity(String(product.quantity));
    if (product.unit) setUnit(product.unit);
  }
```
- **Lines 55–59**: Called when a product is selected via the search dropdown or barcode scanner. Populates the `name`, `quantity`, and `unit` form fields from the scanned/selected Open Food Facts product metadata.

---

#### Lines 61–74: Storage Location Creation Handler
```tsx
  async function handleAddLocation() {
    if (!currentHousehold || !newLocationName.trim()) return;
    try {
      const created = await addLocationMutation.mutateAsync({
        household_id: currentHousehold.id,
        name: newLocationName.trim(),
      });
      setLocationId(created.id);
      setNewLocationName('');
      setShowAddLocation(false);
    } catch (err) {
      console.error('Fehler beim Erstellen des Lagerorts:', err);
    }
  }
```
- **Lines 61–74**: Asynchronously creates a new storage location inline, sets the newly created location as active (`setLocationId(created.id)`), resets the inline input field, and closes the inline form card.

---

#### Lines 76–92: Item Save Handler
```tsx
  async function handleSave() {
    if (!currentHousehold || !name.trim()) return;

    try {
      await mutation.mutateAsync({
        household_id: currentHousehold.id,
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit: unit,
        location_id: activeLocationId,
        expiry_date: expiryDate.trim() || null,
      });
      router.back();
    } catch (err) {
      console.error(err);
    }
  }
```
- **Lines 76–92**: Validates active household and product name, executes item insertion mutation, and navigates back (`router.back()`) upon success.

---

#### Lines 94–161: Render JSX (Screen, Scanner Trigger, Search, Fields, Quick Dates)
```tsx
  return (
    <Screen title="Artikel hinzufügen">
      <View style={styles.form}>
        <Button
          label="📷 Barcode scannen"
          variant="secondary"
          onPress={() => setShowScanner(true)}
        />

        <ProductSearchDropdown
          label="Name"
          placeholder="z. B. Milch oder Barcode-Name"
          value={name}
          onChangeText={setName}
          onSelectProduct={handleSelectProduct}
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Menge"
              placeholder="1"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Einheit"
              placeholder="piece, l, kg..."
              value={unit}
              onChangeText={setUnit}
            />
          </View>
        </View>

        <ThemedText style={{ fontWeight: 'bold', marginTop: Spacing.two }}>
          Mindesthaltbarkeitsdatum (MHD)
        </ThemedText>
        <TextField
          placeholder="JJJJ-MM-TT (z.B. 2026-08-20)"
          value={expiryDate}
          onChangeText={setExpiryDate}
        />
        <View style={styles.quickDateGroup}>
          <Button
            label="+ 3 Tage"
            variant="secondary"
            onPress={() => setExpiryDate(formatOffsetDate(3))}
          />
          <Button
            label="+ 7 Tage"
            variant="secondary"
            onPress={() => setExpiryDate(formatOffsetDate(7))}
          />
          <Button
            label="+ 14 Tage"
            variant="secondary"
            onPress={() => setExpiryDate(formatOffsetDate(14))}
          />
          <Button
            label="+ 1 Monat"
            variant="secondary"
            onPress={() => setExpiryDate(formatOffsetMonths(1))}
          />
        </View>
```
- **Lines 94–101**: Wraps layout in `<Screen>` and renders top button to open barcode scanner modal.
- **Lines 103–109**: Renders `<ProductSearchDropdown>` for live product queries.
- **Lines 111–129**: Renders horizontal row containing numerical quantity input and unit text input.
- **Lines 131–160**: Renders Expiry Date (MHD) section with input field and four preset buttons (`+ 3 Tage`, `+ 7 Tage`, `+ 14 Tage`, `+ 1 Monat`) that populate formatted ISO dates.

---

#### Lines 162–226: Render JSX (Location Selection & Inline Location Creation)
```tsx
        <View style={styles.locationHeaderRow}>
          <ThemedText style={{ fontWeight: 'bold' }}>Lagerort</ThemedText>
          {!showAddLocation && (
            <Button
              label="+ Neuer Lagerort"
              variant="secondary"
              onPress={() => setShowAddLocation(true)}
            />
          )}
        </View>

        {showAddLocation && (
          <View style={styles.addLocationBox}>
            <TextField
              label="Name des Lagerorts"
              placeholder="z.B. Keller, Regalfach, Gefrierfach"
              value={newLocationName}
              onChangeText={setNewLocationName}
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  label="Erstellen"
                  onPress={handleAddLocation}
                  loading={addLocationMutation.isPending}
                  disabled={!newLocationName.trim()}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Abbrechen"
                  variant="secondary"
                  onPress={() => {
                    setShowAddLocation(false);
                    setNewLocationName('');
                  }}
                />
              </View>
            </View>
          </View>
        )}

        {locationsLoading ? (
          <ThemedText>Lade Lagerorte...</ThemedText>
        ) : (
          <View style={styles.locationGroup}>
            {locations?.map((loc) => {
              const isSelected = activeLocationId === loc.id;
              return (
                <Button
                  key={loc.id}
                  label={loc.name}
                  variant={isSelected ? 'primary' : 'secondary'}
                  onPress={() => setLocationId(loc.id)}
                />
              );
            })}
            {locations?.length === 0 && !showAddLocation && (
              <ThemedText type="small" themeColor="textSecondary">
                Keine Lagerorte vorhanden. Tippe auf &quot;+ Neuer Lagerort&quot; um einen
                anzulegen.
              </ThemedText>
            )}
          </View>
        )}
```
- **Lines 162–171**: Header for location selection containing button to reveal inline location creation form.
- **Lines 173–202**: Conditionally rendered inline card for adding new storage locations.
- **Lines 204–226**: Renders available storage locations as interactive selection chip buttons, showing loading state or empty prompt when appropriate.

---

#### Lines 228–246: Action Buttons & Scanner Modal
```tsx
        <View style={styles.saveButton}>
          <Button
            label="Speichern"
            onPress={handleSave}
            loading={mutation.isPending}
            disabled={!name.trim()}
          />
        </View>
        <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
      </View>

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onProductFound={handleSelectProduct}
      />
    </Screen>
  );
}
```
- **Lines 228–236**: Save button (with loading spinner and validation disable) and Cancel button (`router.back()`).
- **Lines 239–246**: Renders `<BarcodeScannerModal>` controlled by `showScanner`. Passing `handleSelectProduct` auto-fills form fields when product barcode matches.

---

#### Lines 248–287: Stylesheet
```tsx
const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
    marginTop: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  quickDateGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  addLocationBox: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  locationGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  saveButton: {
    marginTop: Spacing.four,
  },
});
```
- **Lines 248–286**: Defines layout styles including flex direction, gap spacing, border styling, wrap layouts for preset chips, and save button margins.

---

## api.ts

**File Path:** `src/features/inventory/api.ts`  
**Total Lines:** 2

### Overview
`api.ts` serves as a feature facade / re-export entrypoint for inventory-related data queries.

---

### Line-by-Line Breakdown

```typescript
export { useFridgeItems } from '@/features/fridge/use-fridge-items';
```
- **Line 1**: Re-exports `useFridgeItems` hook from the fridge feature module (`@/features/fridge/use-fridge-items`), creating a clean external module API for the inventory feature.

---

## barcode-scanner-modal.tsx

**File Path:** `src/features/inventory/barcode-scanner-modal.tsx`  
**Total Lines:** 171

### Overview
`barcode-scanner-modal.tsx` provides a resilient modal dialog for camera-based EAN/UPC/QR barcode scanning. It safely handles platform compatibility (Web / Expo Go vs Native builds) via dynamic runtime imports, requests camera permissions dynamically, queries Open Food Facts API upon scanning, and handles error or loading states cleanly.

---

### Line-by-Line / Section Breakdown

#### Lines 1–9: Imports
```tsx
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/buttons';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchProductByBarcode, type OpenFoodFactsProduct } from '@/lib/open-food-facts';
```
- **Lines 1–2**: Import React `useState` and React Native core components (`ActivityIndicator`, `Modal`, `Pressable`, `StyleSheet`, `View`).
- **Lines 4–7**: Import app components (`Button`, `ThemedText`), theme constants, and `useTheme` hook.
- **Line 8**: Import `fetchProductByBarcode` utility function and `OpenFoodFactsProduct` type from `@/lib/open-food-facts`.

---

#### Lines 10–27: Defensive Native Camera Module Loading
```tsx
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
```
- **Lines 10–16**: Declares dynamic camera references and fallback permission hooks to avoid crashes in non-native environments (such as Expo Go or Web browser).
- **Lines 18–27**: Safely attempts `require('expo-camera')` inside a `try...catch` block. If `CameraView` exists, enables camera support flag (`isCameraSupported = true`); otherwise gracefully flags `isCameraSupported = false`.

---

#### Lines 29–43: Props Interface & Component Initialization
```tsx
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
```
- **Lines 29–33**: Defines component props: `visible` toggle, `onClose` callback, and `onProductFound` payload handler.
- **Lines 35–43**: Declares component state for theme colors, permissions hook, lookup loading state (`scanning`), and user-facing error message (`errorMsg`).

---

#### Lines 45–63: Barcode Scan Callback Handler
```tsx
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
```
- **Lines 45–46**: Prevents duplicate concurrent API queries when a barcode is continuously detected.
- **Lines 47–51**: Sets scanning state to `true` and clears previous errors, then triggers Open Food Facts barcode lookup.
- **Lines 52–57**: On match, invokes `onProductFound` with product data and closes modal (`onClose()`); if unmatched, sets detailed notice (`Kein Produkt für Barcode ... gefunden.`).
- **Lines 58–62**: Catches network/API exceptions and resets `scanning` state in `finally`.

---

#### Lines 65–122: Modal Render Tree
```tsx
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
```
- **Lines 66–74**: Modal container setup with semi-transparent backdrop overlay, themed card, and header row with close icon (`✕`).
- **Lines 76–83**: Fallback UI notice displayed when native camera module is unavailable (`!isCameraSupported`).
- **Lines 84–90**: Permission request prompt displayed when camera permissions are missing (`!permission?.granted`).
- **Lines 91–102**: Live camera viewport rendered via `<CameraViewComp>`, configured for `ean13`, `ean8`, and `qr` codes, with an overlay target frame box.
- **Lines 104–116**: Loading indicator spinner (`scanning`) and error alert display (`errorMsg`).
- **Lines 117–121**: Bottom close button (`Schließen`).

---

#### Lines 124–171: Stylesheet
```tsx
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
```
- **Lines 124–170**: Styles bottom sheet positioning, semi-transparent backdrop, rounded modal edges, camera container clipping (`overflow: 'hidden'`), target alignment box, and status indicator row.

---

## fridge-screen.tsx

**File Path:** `src/features/inventory/fridge-screen.tsx`  
**Total Lines:** 2

### Overview
`fridge-screen.tsx` acts as an export facade alias pointing to the fridge feature module.

---

### Line-by-Line Breakdown

```typescript
export { FridgeScreen } from '@/features/fridge/fridge-screen';
```
- **Line 1**: Re-exports `FridgeScreen` component from `@/features/fridge/fridge-screen`.

---

## product-detail-modal.tsx

**File Path:** `src/features/inventory/product-detail-modal.tsx`  
**Total Lines:** 640

### Overview
`product-detail-modal.tsx` displays a comprehensive product breakdown bottom sheet modal for inventory items. It includes product branding, Nutri-Score badge, macro breakdown progress bars (protein, carbs, sugar, fat, saturated fat, salt), calorie ring visualizer, ingredient listings, allergen badges, and formatted expiration dates.

---

### Line-by-Line / Section Breakdown

#### Lines 1–21: Imports & Nutri-Score Color Configurations
```tsx
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { FridgeItem } from '@/features/fridge/use-fridge-mutations';
import { getProductDetails } from '@/features/inventory/product-details-catalog';

type ProductDetailModalProps = {
  visible: boolean;
  item: FridgeItem | null;
  onClose: () => void;
};

const NUTRI_SCORES = [
  { score: 'A', bg: '#D1FAE5', activeBg: '#10B981', text: '#065F46' },
  { score: 'B', bg: '#E4F4C0', activeBg: '#84CC16', text: '#3F6212' },
  { score: 'C', bg: '#FEF3C7', activeBg: '#F59E0B', text: '#78350F' },
  { score: 'D', bg: '#FFEDD5', activeBg: '#F97316', text: '#7C2D12' },
  { score: 'E', bg: '#FEE2E2', activeBg: '#EF4444', text: '#7F1D1D' },
] as const;
```
- **Lines 1–7**: Import React Native components, `useSafeAreaInsets` for bottom inset handling, themed text component, spacing constants, and `getProductDetails` lookup helper.
- **Lines 9–13**: Defines modal prop structure (`visible`, `item`, `onClose`).
- **Lines 15–21**: Defines `NUTRI_SCORES` array mapping scores A through E to inactive/active background colors and text contrast colors.

---

#### Lines 23–49: Data Normalization & Macro Bar Width Calculations
```tsx
export function ProductDetailModal({ visible, item, onClose }: ProductDetailModalProps) {
  const insets = useSafeAreaInsets();

  if (!item) return null;

  const details = getProductDetails(item.name);

  // Datum formatieren
  let formattedMhd = '—';
  if (item.expiry_date) {
    const parts = item.expiry_date.split('-');
    if (parts.length === 3) {
      formattedMhd = `${parts[2]}.${parts[1]}.${parts[0]}`;
    } else {
      formattedMhd = item.expiry_date;
    }
  }

  // Makronährwert-Balken Prozentwerte (relativ zur Max-Skala von ca. 30g)
  const maxScale = 30;
  const pWidth = Math.min(100, Math.max(8, (details.macros.proteinG / maxScale) * 100));
  const cWidth = Math.min(100, Math.max(8, (details.macros.carbsG / maxScale) * 100));
  const sugWidth = Math.min(100, Math.max(8, (details.macros.sugarG / maxScale) * 100));
  const fWidth = Math.min(100, Math.max(8, (details.macros.fatG / maxScale) * 100));
  const satWidth = Math.min(100, Math.max(8, (details.macros.satFatG / maxScale) * 100));
  const sWidth = Math.min(100, Math.max(4, (details.macros.saltG / maxScale) * 100));
```
- **Lines 24–28**: Guard check returning `null` if `item` is null, and looks up details in catalog via `getProductDetails(item.name)`.
- **Lines 30–39**: Formats expiration date from `YYYY-MM-DD` to German standard `DD.MM.YYYY`.
- **Lines 41–48**: Calculates percentage fill widths for progress bars based on a 30g max scale baseline, ensuring minimum visible bar widths (4–8%) for low values.

---

#### Lines 50–110: Modal Structure & Header Card
```tsx
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlayContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          {/* Top Bar mit Griffbalken & Schließen-Button (✕) */}
          <View style={styles.topBar}>
            <Pressable style={styles.handleBarContainer} onPress={onClose} hitSlop={12}>
              <View style={styles.handleBar} />
            </Pressable>
            <Pressable
              style={styles.closeButtonCircle}
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Schließen">
              <ThemedText style={styles.closeButtonText}>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}>
            {/* Header Card */}
            <View style={styles.headerCard}>
              <View style={styles.headerLeft}>
                <View style={styles.iconBox}>
                  <ThemedText style={styles.iconEmoji}>{details.icon}</ThemedText>
                </View>

                <View style={styles.headerInfo}>
                  <ThemedText type="subtitle" style={styles.headerTitle}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" style={styles.brandText}>
                    {details.brand}
                  </ThemedText>

                  <View style={styles.badgeRow}>
                    <View style={styles.categoryBadge}>
                      <ThemedText type="smallBold" style={styles.categoryBadgeText}>
                        {details.category}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" style={styles.unitText}>
                      {item.quantity} {item.unit}
                    </ThemedText>
                  </View>

                  <ThemedText type="small" style={styles.mhdText}>
                    MHD: {formattedMhd}
                  </ThemedText>
                </View>
              </View>

              {/* Big Nutri-Score Badge Top Right */}
              <View style={styles.nutriBadgeTop}>
                <ThemedText style={styles.nutriBadgeTopText}>{details.nutriScore}</ThemedText>
              </View>
            </View>
```
- **Lines 50–68**: Constructs bottom sheet modal container, drag handle indicator bar, and top-right close icon (`✕`).
- **Lines 70–110**: Header card rendering product icon emoji, title, brand name, category badge, quantity, formatted MHD date, and top-right Nutri-Score badge.

---

#### Lines 112–134: Calories Card & Donut Graphic
```tsx
            {/* Kalorien Card */}
            <View style={styles.card}>
              <View style={styles.kcalRow}>
                <View>
                  <View style={styles.kcalTextGroup}>
                    <ThemedText style={styles.kcalNumber}>{details.kcal}</ThemedText>
                    <ThemedText style={styles.kcalUnit}>kcal</ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {details.unitReference}
                  </ThemedText>
                </View>

                {/* Macro Ring Graphic */}
                <View style={styles.donutRing}>
                  <View style={styles.donutCenter}>
                    <ThemedText type="smallBold" style={styles.donutCenterText}>
                      K/P/F
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
```
- **Lines 112–134**: Renders calorie count per reference unit (e.g. `64 kcal pro 100 ml`) accompanied by a styled multi-color macro ring graphic (`K/P/F`).

---

#### Lines 135–261: Macronutrients Breakdown Card
```tsx
            {/* Makronährstoffe Card */}
            <View style={styles.card}>
              <ThemedText style={styles.sectionHeaderTitle}>MAKRONÄHRSTOFFE</ThemedText>

              <View style={styles.macroList}>
                {/* Protein */}
                <View style={styles.macroRow}>
                  <ThemedText type="small" style={styles.macroLabel}>
                    Protein
                  </ThemedText>
                  <View style={styles.trackContainer}>
                    <View style={styles.trackBackground}>
                      <View
                        style={[
                          styles.trackFill,
                          { width: `${pWidth}%`, backgroundColor: '#3B82F6' },
                        ]}
                      />
                    </View>
                  </View>
                  <ThemedText type="smallBold" style={styles.macroVal}>
                    {details.macros.proteinG}g
                  </ThemedText>
                </View>
                ...
              </View>
            </View>
```
- **Lines 135–261**: Renders section listing each macro nutrient (Protein, Carbs, Sugar, Fat, Saturated Fat, Salt) with label, animated progress track bar, and exact weight in grams (`g`).

---

#### Lines 262–292: Nutri-Score Selector/Display Row
```tsx
            {/* Nutri-Score Card */}
            <View style={styles.card}>
              <ThemedText style={styles.sectionHeaderTitle}>NUTRI-SCORE</ThemedText>
              <View style={styles.nutriRow}>
                {NUTRI_SCORES.map((ns) => {
                  const isActive = details.nutriScore === ns.score;
                  return (
                    <View
                      key={ns.score}
                      style={[
                        styles.nutriPill,
                        {
                          backgroundColor: isActive ? ns.activeBg : ns.bg,
                          transform: isActive ? [{ scale: 1.08 }] : [{ scale: 1.0 }],
                          shadowColor: isActive ? '#000' : 'transparent',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isActive ? 0.2 : 0,
                          shadowRadius: 4,
                          elevation: isActive ? 3 : 0,
                        },
                      ]}>
                      <ThemedText
                        style={[styles.nutriPillText, { color: isActive ? '#FFFFFF' : ns.text }]}>
                        {ns.score}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>
```
- **Lines 262–292**: Maps through A–E Nutri-Score pills, highlighting the active score letter with larger scale (`scale: 1.08`), shadow elevation, and distinct active background color.

---

#### Lines 293–335: Ingredients, Allergens, Footer & Dismiss Button
```tsx
            {/* Zutaten Card */}
            <View style={styles.card}>
              <ThemedText style={styles.sectionHeaderTitle}>ZUTATEN</ThemedText>
              <ThemedText style={styles.ingredientsText}>{details.ingredients}</ThemedText>
            </View>

            {/* Allergene Card */}
            <View style={styles.allergenCard}>
              <ThemedText style={styles.allergenHeaderTitle}>ALLERGENE</ThemedText>
              {details.allergens.length > 0 ? (
                <View style={styles.allergenPillRow}>
                  {details.allergens.map((alg) => (
                    <View key={alg} style={styles.allergenBadge}>
                      <ThemedText type="smallBold" style={styles.allergenBadgeText}>
                        {alg}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText type="small" style={{ color: '#9A3412', marginTop: 4 }}>
                  Keine Allergene deklariert.
                </ThemedText>
              )}
            </View>

            {/* Footer Attribution */}
            <ThemedText type="small" style={styles.footerNote}>
              Daten: Open Food Facts · Nährwerte pro 100 g
            </ThemedText>

            {/* Unterer Schließen Button */}
            <Pressable style={styles.bottomCloseButton} onPress={onClose}>
              <ThemedText type="smallBold" style={styles.bottomCloseButtonText}>
                Schließen
              </ThemedText>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
```
- **Lines 293–297**: Ingredients section text display.
- **Lines 299–317**: Allergen card rendering allergen chips or fallback notice (`Keine Allergene deklariert.`).
- **Lines 319–322**: Open Food Facts attribution text.
- **Lines 324–335**: Full-width bottom close pressable button.

---

#### Lines 337–640: Stylesheet
```tsx
const styles = StyleSheet.create({ ... });
```
- **Lines 337–639**: Defines modal positioning, overlay backdrop opacity, rounded sheet corners (`borderTopLeftRadius: 28`), color fills, badge styles, macro tracks, and shadow properties.

---

## product-details-catalog.ts

**File Path:** `src/features/inventory/product-details-catalog.ts`  
**Total Lines:** 224

### Overview
`product-details-catalog.ts` provides a local fallback catalog and fuzzy lookup function (`getProductDetails`) for common household items (e.g. milk, spinach, chicken breast, yogurt, cheese, orange juice). This guarantees immediate detailed product displays even when offline or if an item is entered manually.

---

### Line-by-Line / Section Breakdown

#### Lines 1–19: Type Definition
```typescript
export type ProductDetails = {
  name: string;
  brand: string;
  category: string;
  nutriScore: 'A' | 'B' | 'C' | 'D' | 'E';
  kcal: number;
  unitReference: string;
  icon: string;
  macros: {
    proteinG: number;
    carbsG: number;
    sugarG: number;
    fatG: number;
    satFatG: number;
    saltG: number;
  };
  ingredients: string;
  allergens: string[];
};
```
- **Lines 1–19**: Defines TypeScript contract for full nutritional and product metadata details.

---

#### Lines 21–174: Static Product Catalog Dictionary
```typescript
const PRODUCT_CATALOG: Record<string, Partial<ProductDetails>> = {
  vollmilch: { ... },
  milch: { ... },
  'bio-spinat': { ... },
  spinat: { ... },
  'griechischer joghurt': { ... },
  hähnchenbrust: { ... },
  gouda: { ... },
  'orangen-saft': { ... },
};
```
- **Lines 21–174**: Pre-populated dictionary containing complete macro, allergen, ingredient, brand, category, Nutri-Score, and emoji icon data for standard groceries.

---

#### Lines 176–224: `getProductDetails` Lookup & Fallback Generator
```typescript
export function getProductDetails(name: string): ProductDetails {
  const normalized = name.toLowerCase().trim();

  for (const [key, details] of Object.entries(PRODUCT_CATALOG)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        name: details.name || name,
        brand: details.brand || 'Hausmarke',
        category: details.category || 'Vorrat',
        nutriScore: details.nutriScore || 'B',
        kcal: details.kcal || 85,
        unitReference: details.unitReference || 'pro 100 g',
        icon: details.icon || '📦',
        macros: details.macros || {
          proteinG: 4.2,
          carbsG: 12.0,
          sugarG: 5.5,
          fatG: 2.1,
          satFatG: 0.8,
          saltG: 0.2,
        },
        ingredients: details.ingredients || `${name}, natürliche Zutaten.`,
        allergens: details.allergens || [],
      };
    }
  }

  // Fallback defaults for custom products
  return {
    name,
    brand: 'Hausmarke',
    category: 'Vorrat',
    nutriScore: 'B',
    kcal: 75,
    unitReference: 'pro 100 g',
    icon: '📦',
    macros: {
      proteinG: 5.0,
      carbsG: 10.0,
      sugarG: 4.0,
      fatG: 2.0,
      satFatG: 0.5,
      saltG: 0.1,
    },
    ingredients: `${name}, frische Zutat.`,
    allergens: [],
  };
}
```
- **Lines 176–177**: Normalizes the query string to lowercase trimmed format.
- **Lines 179–201**: Performs substring matching against `PRODUCT_CATALOG` keys. If matched, merges entry details with safe defaults.
- **Lines 203–223**: Returns default generic `ProductDetails` for uncatalogued items so UI components always receive complete, valid data.

---

## product-search-dropdown.tsx

**File Path:** `src/features/inventory/product-search-dropdown.tsx`  
**Total Lines:** 150

### Overview
`product-search-dropdown.tsx` implements an auto-suggesting search input component. As users type item names, it debounces input, queries Open Food Facts API (`searchOpenFoodFacts`), and renders interactive suggestion rows with product thumbnails, brands, units, and calories per 100g.

---

### Line-by-Line / Section Breakdown

#### Lines 1–16: Imports & Props Interface
```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type OpenFoodFactsProduct, searchOpenFoodFacts } from '@/lib/open-food-facts';

interface ProductSearchDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectProduct: (product: OpenFoodFactsProduct) => void;
}
```
- **Lines 1–8**: Imports React hooks, React Native UI components (`ActivityIndicator`, `Image`, `Pressable`, `StyleSheet`, `View`), app inputs/typography, theme hooks, and Open Food Facts search module.
- **Lines 10–16**: Declares component props interface for input value, text change handler, and selection callback.

---

#### Lines 18–47: Component State & Debounced API Query
```tsx
export function ProductSearchDropdown({
  label = 'Name',
  placeholder = 'z. B. Hafermilch',
  value,
  onChangeText,
  onSelectProduct,
}: ProductSearchDropdownProps) {
  const theme = useTheme();
  const [suggestions, setSuggestions] = useState<OpenFoodFactsProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await searchOpenFoodFacts(value);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);
```
- **Lines 18–28**: Initializes suggestions array, active searching state, and dropdown visibility boolean.
- **Lines 30–46**: Debounces search queries by 300ms to avoid overwhelming external API requests. Requires at least 2 characters before querying `searchOpenFoodFacts(value)`. Clears timeout on input changes or unmounting.

---

#### Lines 48–104: Render Tree (TextField, Loader, Dropdown List)
```tsx
  return (
    <View style={styles.container}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowDropdown(true);
        }}
      />

      {searching && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      )}

      {showDropdown && suggestions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}>
          {suggestions.map((item) => (
            <Pressable
              key={item.barcode || item.name}
              onPress={() => {
                onSelectProduct(item);
                setShowDropdown(false);
              }}
              style={[styles.itemRow, { borderBottomColor: theme.border }]}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.img} />
              ) : (
                <View style={[styles.imgPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={{ fontSize: 14 }}>🥫</ThemedText>
                </View>
              )}

              <View style={styles.itemText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.brand ? `${item.brand} · ` : ''}
                  {item.quantity} {item.unit}
                  {item.caloriesPer100g ? ` · ${item.caloriesPer100g} kcal/100g` : ''}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
```
- **Lines 50–58**: Renders main text field and triggers dropdown opening on text entry.
- **Lines 60–64**: Displays inline loading spinner on the right side of the text field while search is active.
- **Lines 66–101**: Renders floating dropdown list containing matching suggestions. Each item displays a thumbnail image (or fallback canned food emoji `🥫`), product title, brand, quantity unit, and calorie information per 100g. Selecting an item executes `onSelectProduct` and closes dropdown.

---

#### Lines 106–150: Stylesheet
```tsx
const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  loader: {
    position: 'absolute',
    right: 12,
    top: 36,
  },
  dropdown: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    maxHeight: 220,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  img: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  imgPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
});
```
- **Lines 106–149**: Defines relative container positioning with `zIndex: 10` for dropdown overlay, absolute loader positioning, rounded drop shadow box for options, and thumbnail sizing.

---

## storage-locations-screen.tsx

**File Path:** `src/features/inventory/storage-locations-screen.tsx`  
**Total Lines:** 200

### Overview
`storage-locations-screen.tsx` provides a full management interface for household storage locations. Users can create new storage locations, inline edit location names, and soft-delete existing storage locations with confirmation dialogs.

---

### Line-by-Line / Section Breakdown

#### Lines 1–32: Imports & Component Setup
```tsx
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useAddStorageLocationMutation,
  useDeleteStorageLocationMutation,
  useStorageLocations,
  useUpdateStorageLocationMutation,
} from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';

export function StorageLocationsScreen() {
  const theme = useTheme();
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;

  const { data: locations, isLoading } = useStorageLocations(currentHousehold?.id);
  const addMutation = useAddStorageLocationMutation();
  const updateMutation = useUpdateStorageLocationMutation();
  const deleteMutation = useDeleteStorageLocationMutation();

  const [newLocationName, setNewLocationName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
```
- **Lines 1–17**: Imports UI primitives, React hooks, Alert utility, card/screen/input components, active household context provider, and storage location mutation hooks.
- **Lines 19–32**: Initializes hooks for querying storage locations and mutating locations (add, update, delete). Manages state for adding a new location (`newLocationName`) and inline editing state (`editingId`, `editingName`).

---

#### Lines 33–80: Mutation Handlers (Add, Update, Delete)
```tsx
  async function handleAdd() {
    if (!currentHousehold || !newLocationName.trim()) return;
    try {
      await addMutation.mutateAsync({
        household_id: currentHousehold.id,
        name: newLocationName.trim(),
      });
      setNewLocationName('');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Erstellen');
    }
  }

  async function handleUpdate(id: string) {
    if (!currentHousehold || !editingName.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id,
        household_id: currentHousehold.id,
        name: editingName.trim(),
      });
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!currentHousehold) return;
    Alert.alert('Lagerort löschen', `Möchtest du den Lagerort "${name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({
              id,
              household_id: currentHousehold.id,
            });
          } catch (err) {
            Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Löschen');
          }
        },
      },
    ]);
  }
```
- **Lines 33–44 (`handleAdd`)**: Executes `addMutation`, adding a storage location to the active household and resetting the input field. Displays an error alert on failure.
- **Lines 46–59 (`handleUpdate`)**: Executes `updateMutation`, updating the target location's name and clearing the inline edit state. Displays an error alert on failure.
- **Lines 61–80 (`handleDelete`)**: Prompts the user with a destructive native alert modal (`Lagerort löschen`). Upon confirmation, executes `deleteMutation` to soft-delete the storage location.

---

#### Lines 82–164: Render Tree (Add Form Card & Location List Card)
```tsx
  return (
    <Screen title="Lagerorte verwalten" subtitle={currentHousehold?.name} showBackButton>
      <Card title="Neuen Lagerort hinzufügen">
        <View style={styles.addBox}>
          <TextField
            placeholder="z.B. Abstellkammer, Keller, Vorratsschrank..."
            value={newLocationName}
            onChangeText={setNewLocationName}
          />
          <Button
            label="Hinzufügen"
            onPress={handleAdd}
            loading={addMutation.isPending}
            disabled={!newLocationName.trim()}
          />
        </View>
      </Card>

      <Card title="Vorhandene Lagerorte">
        {isLoading ? (
          <ThemedText>Lädt...</ThemedText>
        ) : locations?.length === 0 ? (
          <ThemedText themeColor="textSecondary">Keine Lagerorte vorhanden.</ThemedText>
        ) : (
          <View style={styles.list}>
            {locations?.map((loc) => {
              const isEditing = editingId === loc.id;

              return (
                <View key={loc.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                  {isEditing ? (
                    <View style={styles.editBox}>
                      <TextField value={editingName} onChangeText={setEditingName} autoFocus />
                      <View style={styles.buttonRow}>
                        <View style={styles.flex}>
                          <Button
                            label="Speichern"
                            onPress={() => handleUpdate(loc.id)}
                            loading={updateMutation.isPending}
                            disabled={!editingName.trim()}
                          />
                        </View>
                        <View style={styles.flex}>
                          <Button
                            label="Abbrechen"
                            variant="secondary"
                            onPress={() => {
                              setEditingId(null);
                              setEditingName('');
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <>
                      <ThemedText style={styles.nameText}>{loc.name}</ThemedText>
                      <View style={styles.actionButtons}>
                        <Button
                          label="Umbenennen"
                          variant="secondary"
                          onPress={() => {
                            setEditingId(loc.id);
                            setEditingName(loc.name);
                          }}
                        />
                        <Button
                          label="Löschen"
                          variant="danger"
                          onPress={() => handleDelete(loc.id, loc.name)}
                        />
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </Screen>
  );
}
```
- **Lines 82–98**: Screen wrapper with back button and top `<Card>` for adding new storage locations.
- **Lines 100–161**: Second `<Card>` listing existing locations. Handles loading indicator, empty state text, inline edit mode (with save and cancel buttons), and view mode (with rename and delete action buttons).

---

#### Lines 166–200: Stylesheet
```tsx
const styles = StyleSheet.create({
  addBox: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  nameText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  editBox: {
    gap: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  flex: {
    flex: 1,
  },
});
```
- **Lines 166–199**: Defines layout gap spacing, hair-line bottom borders for list rows, bold text formatting, and action button button rows.

---

## use-storage-locations.ts

**File Path:** `src/features/inventory/use-storage-locations.ts`  
**Total Lines:** 214

### Overview
`use-storage-locations.ts` provides the core database access layer and state hooks for managing household storage locations using React Query, SQLite, and the offline sync outbox mechanism (`enqueueMutation`).

---

### Line-by-Line / Section Breakdown

#### Lines 1–19: Imports, Type Definitions & Default Storage Locations
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';

export type StorageLocation = {
  id: string;
  household_id: string;
  name: string;
  kind: string;
  sort_order: number;
};

export const DEFAULT_STORAGE_LOCATIONS = [
  { name: 'Kühlschrank', kind: 'fridge', sort_order: 0 },
  { name: 'Tiefkühltruhe', kind: 'freezer', sort_order: 1 },
  { name: 'Abställkammer', kind: 'pantry', sort_order: 2 },
] as const;
```
- **Lines 1–5**: Import `@tanstack/react-query` hooks, `expo-crypto` for UUID generation, local database getter `getDatabase`, and offline outbox mutation enqueuer `enqueueMutation`.
- **Lines 7–13**: Defines `StorageLocation` type schema matching local SQLite database structure.
- **Lines 15–19**: Defines default preset locations (`Kühlschrank`, `Tiefkühltruhe`, `Abstellkammer`) automatically populated for new households.

---

#### Lines 21–79: `useStorageLocations` Query Hook
```typescript
export function useStorageLocations(householdId: string | undefined) {
  return useQuery({
    queryKey: ['storage_locations', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const db = await getDatabase();
      const existing = await db.getAllAsync<StorageLocation>(
        'select id, household_id, name, kind, sort_order from storage_locations where household_id = ? and deleted_at is null order by sort_order',
        [householdId],
      );

      if (existing.length > 0) {
        return existing;
      }

      // Prüfe ob überhaupt jemals Daten für diesen Haushalt da waren
      const allRows = await db.getAllAsync<{ id: string }>(
        'select id from storage_locations where household_id = ? limit 1',
        [householdId],
      );

      if (allRows.length === 0) {
        // 3 Standard-Lagerorte automatisch anlegen
        for (const loc of DEFAULT_STORAGE_LOCATIONS) {
          const id = Crypto.randomUUID();
          const now = new Date().toISOString();
          const nowMs = Date.now();
          await enqueueMutation(db, {
            entity: 'storage_locations',
            entityId: id,
            op: 'insert',
            payload: {
              id,
              household_id: householdId,
              name: loc.name,
              kind: loc.kind,
              sort_order: loc.sort_order,
              created_at: now,
              updated_at: now,
            },
            applyLocally: async (txn) => {
              await txn.runAsync(
                'insert into storage_locations (id, household_id, name, kind, sort_order, created_at, updated_at, _dirty) values (?, ?, ?, ?, ?, ?, ?, 1)',
                [id, householdId, loc.name, loc.kind, loc.sort_order, now, nowMs],
              );
            },
          });
        }
        return db.getAllAsync<StorageLocation>(
          'select id, household_id, name, kind, sort_order from storage_locations where household_id = ? and deleted_at is null order by sort_order',
          [householdId],
        );
      }

      return existing;
    },
    enabled: !!householdId,
  });
}
```
- **Lines 21–34**: Queries active non-deleted storage locations from local SQLite database ordered by `sort_order`. If records exist, returns them immediately.
- **Lines 36–40**: Checks if any storage location records (including soft-deleted ones) ever existed for the given household ID.
- **Lines 42–73**: If no records ever existed, automatically seeds the 3 default storage locations (`Kühlschrank`, `Tiefkühltruhe`, `Abstellkammer`) into the local database and enqueues outbox sync operations (`enqueueMutation`), then returns the freshly seeded rows.
- **Lines 77**: Disables query execution if `householdId` is undefined.

---

#### Lines 81–133: `useAddStorageLocationMutation` Mutation Hook
```typescript
export function useAddStorageLocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      household_id,
      name,
      kind = 'pantry',
    }: {
      household_id: string;
      name: string;
      kind?: string;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      const existing = await db.getAllAsync<{ sort_order: number }>(
        'select sort_order from storage_locations where household_id = ? order by sort_order desc limit 1',
        [household_id],
      );
      const nextSortOrder = (existing[0]?.sort_order ?? -1) + 1;

      await enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          household_id,
          name,
          kind,
          sort_order: nextSortOrder,
          created_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'insert into storage_locations (id, household_id, name, kind, sort_order, created_at, updated_at, _dirty) values (?, ?, ?, ?, ?, ?, ?, 1)',
            [id, household_id, name, kind, nextSortOrder, now, nowMs],
          );
        },
      });

      return { id, name, household_id, kind, sort_order: nextSortOrder };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storage_locations', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
```
- **Lines 81–98**: Generates new UUID via `Crypto.randomUUID()` and current ISO / millisecond timestamps.
- **Lines 99–103**: Computes next incremental `sort_order` by querying the highest existing `sort_order` for the household.
- **Lines 105–124**: Enqueues an offline `insert` mutation into the outbox and inserts the location record into SQLite with `_dirty = 1`.
- **Lines 128–132**: On success, invalidates React Query caches for `storage_locations` and `sync-status`.

---

#### Lines 135–177: `useUpdateStorageLocationMutation` Mutation Hook
```typescript
export function useUpdateStorageLocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      household_id,
      name,
    }: {
      id: string;
      household_id: string;
      name: string;
    }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: id,
        op: 'update',
        payload: {
          id,
          household_id,
          name,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update storage_locations set name = ?, updated_at = ?, _dirty = 1 where id = ?',
            [name, nowMs, id],
          );
        },
      });

      return { id, name };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storage_locations', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
```
- **Lines 135–168**: Enqueues an offline `update` mutation into the outbox and updates the location name and timestamp in SQLite (`_dirty = 1`).
- **Lines 172–176**: On success, invalidates React Query caches for `storage_locations` and `sync-status`.

---

#### Lines 179–214: `useDeleteStorageLocationMutation` Mutation Hook
```typescript
export function useDeleteStorageLocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, household_id }: { id: string; household_id: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: id,
        op: 'delete',
        payload: {
          id,
          household_id,
          deleted_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update storage_locations set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
            [nowMs, nowMs, id],
          );
        },
      });

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storage_locations', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
```
- **Lines 179–204**: Enqueues an offline `delete` mutation into the outbox and soft-deletes the location record in SQLite by setting `deleted_at` timestamp and `_dirty = 1`.
- **Lines 208–212**: On success, invalidates React Query caches for `storage_locations` and `sync-status`.
