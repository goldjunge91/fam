# Inventory Feature Codebase Explanation

This document provides a line-by-line and section-by-section breakdown of every non-test source file in the `src/features/inventory` directory of the application. 

The **Inventory Feature** manages household storage locations (such as fridge, freezer, pantry), item addition flows, product barcode scanning via Expo Camera, Open Food Facts product integration (live search and barcode lookup), offline synchronization via SQLite outbox mutations, and rich product detail views (nutrition, macros, allergens, and Nutri-Score).

---

## Table of Contents
1. [add-item-screen.tsx](#add-item-screentsx)
2. [api.ts](#apits)
3. [barcode-scanner-modal.tsx](#barcode-scanner-modaltsx)
4. [inventory-screen.tsx](#inventory-screentsx)
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
import { useAddFridgeItemMutation } from '@/features/inventory/use-inventory-mutations';
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
export { useInventoryItems } from '@/features/inventory/use-inventory-items';
```
- **Line 1**: Re-exports `useInventoryItems` hook from the fridge feature module (`@/features/inventory/use-inventory-items`), creating a clean external module API for the inventory feature.

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

## inventory-screen.tsx

**File Path:** `src/features/inventory/inventory-screen.tsx`  
**Total Lines:** 2

### Overview
`inventory-screen.tsx` acts as an export facade alias pointing to the fridge feature module.

---

### Line-by-Line Breakdown

```typescript
export { InventoryScreen } from '@/features/inventory/inventory-screen';
```
- **Line 1**: Re-exports `InventoryScreen` component from `@/features/inventory/inventory-screen`.

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
import type { FridgeItem } from '@/features/inventory/use-inventory-mutations';
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
# Comprehensive Codebase Explanation: `src/features/inventory`

This document provides a line-by-line and section-by-section walkthrough of all non-test source code files in the `/src/features/inventory` directory.

---

## Directory Overview

The `fridge` feature manages household inventory/fridge items. It provides:
1. **Local Database & Offline First Sync**: Querying and updating local SQLite database tables (`fridge_items`, `storage_locations`) with mutations queued to an outbox queue (`use-inventory-items.ts`, `use-inventory-mutations.ts`).
2. **Best-Before Date (MHD) Calculation**: Calculating remaining days, expiry status buckets (`expired`, `critical`, `soon`, `ok`, `none`), and sorting items accordingly (`expiry.ts`).
3. **Expiry Notifications**: Background sync scheduling local push notifications when items are close to expiring (`use-expiry-notifications.ts`).
4. **UI Components**:
   - `InventoryItemRow`: Individual row item displaying MHD ampel color indicator, name, location, expiry badge, and quantity stepper controls.
   - `InventoryTabBar`: Horizontal tab bar allowing users to filter inventory by storage location (e.g., Fridge, Freezer, Pantry).
   - `InventoryScreen`: Main container screen uniting tab filtering, item lists, quantity adjustments, deletion confirmation alerts, and empty states.

---

## Table of Contents
1. [`src/features/inventory/expiry.ts`](#1-srcfeaturesfridgeexpiryts)
2. [`src/features/inventory/use-inventory-items.ts`](#2-srcfeaturesfridgeuse-inventory-itemsts)
3. [`src/features/inventory/use-inventory-mutations.ts`](#3-srcfeaturesfridgeuse-inventory-mutationsts)
4. [`src/features/inventory/use-expiry-notifications.ts`](#4-srcfeaturesfridgeuse-expiry-notificationsts)
5. [`src/features/inventory/components/inventory-item-row.tsx`](#5-srcfeaturesfridgecomponentsinventory-item-rowtsx)
6. [`src/features/inventory/components/inventory-tab-bar.tsx`](#6-srcfeaturesfridgecomponentsinventory-tab-bartsx)
7. [`src/features/inventory/inventory-screen.tsx`](#7-srcfeaturesfridgeinventory-screentsx)

---

## 1. `src/features/inventory/expiry.ts`

This module contains utility functions and types for calculating Best Before Date (Mindesthaltbarkeitsdatum / MHD) buckets, human-readable status labels, color mappings, and sorting rules.

### Line-by-Line Breakdown

```typescript
1: import type { ThemeColor } from '@/constants/theme';
```
- **Line 1**: Imports the `ThemeColor` type from `@/constants/theme` so that expiry status results can specify theme palette color keys (e.g., `'danger'`, `'warning'`, `'textSecondary'`).

```typescript
3: export type ExpiryBucket = 'expired' | 'critical' | 'soon' | 'ok' | 'none';
```
- **Line 3**: Exports `ExpiryBucket` type defining 5 urgency categories:
  - `'expired'`: Best-before date has passed (< 0 days).
  - `'critical'`: Best-before date is today or within 1 to 3 days.
  - `'soon'`: Expiring within 4 to 7 days.
  - `'ok'`: Expiring in more than 7 days.
  - `'none'`: Item has no expiry date set.

```typescript
5: export type ExpiryInfo = {
6:   bucket: ExpiryBucket;
7:   /** Tage bis zum MHD. Negativ = bereits abgelaufen. `null`, wenn kein MHD gesetzt ist. */
8:   daysLeft: number | null;
9:   label: string;
10:  themeColor: ThemeColor;
11: };
```
- **Lines 5–11**: Defines `ExpiryInfo` object structure returned by `getExpiryInfo`.
  - `bucket`: Category bucket (`ExpiryBucket`).
  - `daysLeft`: Signed integer count of calendar days until expiration, or `null` if no date is provided.
  - `label`: Human-readable localized German label string.
  - `themeColor`: Palette key for UI styling.

```typescript
13: const MS_PER_DAY = 86_400_000;
```
- **Line 13**: Constant declaring milliseconds in one day ($24 \times 60 \times 60 \times 1000 = 86,400,000$).

```typescript
15: /**
16:  * Tage zwischen zwei Kalendertagen — bewusst ueber die Datumsanteile, nicht
17:  * ueber die Millisekunden-Differenz.
18:  *
19:  * Sonst waere das Ergebnis von der Uhrzeit abhaengig: "heute 23:00" gegen
20:  * "morgen 01:00" sind zwei Stunden, aber ein Kalendertag. Bei einem
21:  * Mindesthaltbarkeitsdatum zaehlt der Tag, nicht der Zeitpunkt.
22:  */
23: function calendarDaysBetween(from: Date, to: Date): number {
24:   const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
25:   const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
26:   return Math.round((b - a) / MS_PER_DAY);
27: }
```
- **Lines 15–27**: `calendarDaysBetween(from, to)` computes the difference between two `Date` objects in calendar days.
  - **Why**: Standard millisecond difference calculation depends on time-of-day (e.g. 23:00 today vs 01:00 tomorrow is only 2 hours, but represents a calendar day transition). By converting year, month, and date parts to UTC timestamps at 00:00:00, it guarantees pure calendar-day calculations regardless of timezones or time of day.

```typescript
29: /**
30:  * Stuft ein Mindesthaltbarkeitsdatum ein (#71).
31:  *
32:  * `today` wird uebergeben statt intern `new Date()` aufzurufen. Nur so ist die
33:  * Funktion deterministisch und ohne Testdoubles pruefbar — und nur so haengt
34:  * das Ergebnis nicht davon ab, wann der Test zufaellig laeuft.
35:  */
36: export function getExpiryInfo(
37:   expiryDate: Date | string | null | undefined,
38:   today: Date,
39: ): ExpiryInfo {
```
- **Lines 29–39**: Exported function `getExpiryInfo`. Accepts flexible input types for `expiryDate` and explicitly accepts `today: Date` as a parameter to ensure pure deterministic calculation without hidden clock side-effects.

```typescript
40:   if (expiryDate === null || expiryDate === undefined || expiryDate === '') {
41:     return { bucket: 'none', daysLeft: null, label: 'ohne MHD', themeColor: 'textSecondary' };
42:   }
```
- **Lines 40–42**: Edge case handler for missing/empty date inputs. Returns `'none'` bucket with `null` `daysLeft` and `'textSecondary'` color.

```typescript
44:   const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
45: 
46:   if (Number.isNaN(date.getTime())) {
47:     return { bucket: 'none', daysLeft: null, label: 'ohne MHD', themeColor: 'textSecondary' };
48:   }
```
- **Lines 44–48**: Parses string inputs into `Date` objects. If parsing yields an invalid date (`NaN` timestamp), safely falls back to `'none'`.

```typescript
50:   const daysLeft = calendarDaysBetween(today, date);
```
- **Line 50**: Computes calendar day difference.

```typescript
52:   if (daysLeft < 0) {
53:     const days = Math.abs(daysLeft);
54:     return {
55:       bucket: 'expired',
56:       daysLeft,
57:       label: days === 1 ? 'seit gestern abgelaufen' : `seit ${days} Tagen abgelaufen`,
58:       themeColor: 'danger',
59:     };
60:   }
```
- **Lines 52–60**: Handles abgelaufene (expired) items (`daysLeft < 0`). Returns `'expired'` bucket with `'danger'` theme color and formatted string (`"seit gestern abgelaufen"` for 1 day, `"seit X Tagen abgelaufen"` for >1 day).

```typescript
62:   if (daysLeft === 0) {
63:     return { bucket: 'critical', daysLeft, label: 'läuft heute ab', themeColor: 'danger' };
64:   }
```
- **Lines 62–64**: Handles items expiring today (`daysLeft === 0`). Returns `'critical'` bucket with `'danger'` theme color.

```typescript
66:   if (daysLeft <= 3) {
67:     return {
68:       bucket: 'critical',
69:       daysLeft,
70:       label: daysLeft === 1 ? 'noch 1 Tag' : `noch ${daysLeft} Tage`,
71:       themeColor: 'warning',
72:     };
73:   }
```
- **Lines 66–73**: Handles items expiring in 1 to 3 days (`daysLeft <= 3`). Returns `'critical'` bucket with `'warning'` theme color.

```typescript
75:   if (daysLeft <= 7) {
76:     return { bucket: 'soon', daysLeft, label: `noch ${daysLeft} Tage`, themeColor: 'warning' };
77:   }
```
- **Lines 75–77**: Handles items expiring in 4 to 7 days (`daysLeft <= 7`). Returns `'soon'` bucket with `'warning'` theme color.

```typescript
79:   return { bucket: 'ok', daysLeft, label: `noch ${daysLeft} Tage`, themeColor: 'textSecondary' };
80: }
```
- **Lines 79–80**: Default case for items expiring in > 7 days. Returns `'ok'` bucket with `'textSecondary'` color.

```typescript
82: /** Sortierreihenfolge: was zuerst verbraucht werden muss, steht oben. */
83: const BUCKET_ORDER: Record<ExpiryBucket, number> = {
84:   expired: 0,
85:   critical: 1,
86:   soon: 2,
87:   ok: 3,
88:   none: 4,
89: };
```
- **Lines 82–89**: Defines bucket priority numerical values to ensure most urgent items appear at the top.

```typescript
91: export function compareByExpiry(a: ExpiryInfo, b: ExpiryInfo): number {
92:   const byBucket = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
93:   if (byBucket !== 0) return byBucket;
94: 
95:   // Innerhalb einer Stufe: das fruehere Datum zuerst. Artikel ohne MHD ans Ende.
96:   if (a.daysLeft === null) return b.daysLeft === null ? 0 : 1;
97:   if (b.daysLeft === null) return -1;
98:   return a.daysLeft - b.daysLeft;
99: }
```
- **Lines 91–99**: `compareByExpiry` sorting comparator. Compares bucket ranks first; if equal, compares `daysLeft` ascending. Items without expiry dates (`null`) are pushed to the end.

---

## 2. `src/features/inventory/use-inventory-items.ts`

This module defines the hook `useInventoryItems` for reading inventory items from SQLite, enriched with JOINed storage location details and seeded with sample data when an empty household is first opened.

### Line-by-Line Breakdown

```typescript
1: import { useQuery } from '@tanstack/react-query';
2: import * as Crypto from 'expo-crypto';
3: 
4: import { getDatabase } from '@/lib/db/client';
5: import { enqueueMutation } from '@/lib/db/outbox';
```
- **Lines 1–5**: Imports React Query's `useQuery`, Expo Crypto for UUID generation, SQLite database getter `getDatabase`, and outbox synchronization utility `enqueueMutation`.

```typescript
7: export type LocalInventoryItem = {
8:   id: string;
9:   household_id: string;
10:  location_id: string | null;
11:  product_id: string | null;
12:  name: string;
13:  quantity: number;
14:  unit: string;
15:  expiry_date: string | null;
16:  added_by: string | null;
17:  created_at: string;
18:  // JOIN-Felder aus storage_locations
19:  location_kind: string | null;
20:  location_name: string | null;
21: };
```
- **Lines 7–21**: Exports `LocalInventoryItem` interface representing the shape of items returned by the SQL query joining `fridge_items` with `storage_locations`.

```typescript
23: /**
24:  * Liest alle Vorrats-Artikel fuer den Haushalt aus SQLite, mit JOIN
25:  * auf `storage_locations` fuer Lagerort-Name und -Kind (#67).
26:  *
27:  * Sortierung: Ablaufdatum aufsteigend, NULL ans Ende — nutzt die
28:  * Bucket-Logik aus `expiry.ts` implizit (kritische Items stehen oben).
29:  */
30: export function useInventoryItems(householdId: string | undefined) {
31:   return useQuery({
32:     queryKey: ['fridge_items', householdId],
33:     queryFn: async (): Promise<LocalInventoryItem[]> => {
34:       if (!householdId) return [];
```
- **Lines 23–34**: Hook definition `useInventoryItems(householdId)`. Queries items using React Query key `['fridge_items', householdId]`. Immediately returns empty array if `householdId` is undefined.

```typescript
36:       const db = await getDatabase();
37:       const items = await db.getAllAsync<LocalInventoryItem>(
38:         `select
39:            fi.id, fi.household_id, fi.location_id, fi.product_id,
40:            fi.name, fi.quantity, fi.unit, fi.expiry_date, fi.added_by, fi.created_at,
41:            sl.kind as location_kind,
42:            sl.name as location_name
43:          from fridge_items fi
44:          left join storage_locations sl on fi.location_id = sl.id
45:          where fi.household_id = ? and fi.deleted_at is null
46:          order by fi.expiry_date asc nulls last`,
47:         [householdId],
48:       );
```
- **Lines 36–48**: Opens SQLite connection and performs SQL query joining `fridge_items` with `storage_locations`. Filters out soft-deleted items (`fi.deleted_at is null`) and sorts by `expiry_date asc nulls last`.

```typescript
50:       if (items.length > 0) return items;
```
- **Line 50**: If items exist, returns them immediately.

```typescript
52:       // Prüfe ob jemals Artikel da waren
53:       const allRows = await db.getAllAsync<{ id: string }>(
54:         'select id from fridge_items where household_id = ? limit 1',
55:         [householdId],
56:       );
```
- **Lines 52–56**: If `items` is empty, checks if any item (including deleted ones) has ever existed for this household to determine if initial sample data seeding is required.

```typescript
58:       if (allRows.length === 0) {
59:         // Hol den ersten Lagerort
60:         const locations = await db.getAllAsync<{ id: string }>(
61:           'select id from storage_locations where household_id = ? and deleted_at is null order by sort_order limit 1',
62:           [householdId],
63:         );
64:         const locationId = locations[0]?.id ?? null;
```
- **Lines 58–64**: If no items ever existed, queries the first active storage location ID for the household to associate with sample items.

```typescript
66:         const sampleItems = [
67:           { name: 'Vollmilch', quantity: 1, unit: 'l', daysOffset: 2 },
68:           { name: 'Bio-Spinat', quantity: 200, unit: 'g', daysOffset: 1 },
69:           { name: 'Griechischer Joghurt', quantity: 500, unit: 'g', daysOffset: 6 },
70:           { name: 'Hähnchenbrust', quantity: 400, unit: 'g', daysOffset: 1 },
71:           { name: 'Gouda', quantity: 180, unit: 'g', daysOffset: 14 },
72:           { name: 'Orangen-Saft', quantity: 1, unit: 'l', daysOffset: 4 },
73:         ];
```
- **Lines 66–73**: Predefines 6 standard sample household items with varying expiration offsets (`daysOffset`).

```typescript
75:         for (const item of sampleItems) {
76:           const id = Crypto.randomUUID();
77:           const now = new Date().toISOString();
78:           const expDate = new Date(Date.now() + item.daysOffset * 86400000)
79:             .toISOString()
80:             .split('T')[0];
```
- **Lines 75–80**: Iterates over sample items, generating a random UUID and calculating ISO date strings formatted as `YYYY-MM-DD`.

```typescript
82:           await enqueueMutation(db, {
83:             entity: 'fridge_items',
84:             entityId: id,
85:             op: 'insert',
86:             payload: {
87:               id,
88:               household_id: householdId,
89:               location_id: locationId,
90:               name: item.name,
91:               quantity: item.quantity,
92:               unit: item.unit,
93:               expiry_date: expDate,
94:               created_at: now,
95:               updated_at: now,
96:             },
97:             applyLocally: async (txn) => {
98:               await txn.runAsync(
99:                 'insert into fridge_items (id, household_id, location_id, name, quantity, unit, expiry_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
100:                [
101:                  id,
102:                  householdId,
103:                  locationId,
104:                  item.name,
105:                  item.quantity,
106:                  item.unit,
107:                  expDate,
108:                  now,
109:                  now,
110:                ],
111:              );
112:            },
113:          });
114:        }
```
- **Lines 82–114**: Enqueues insertion mutations to the outbox for server sync and executes local SQLite insert queries via `applyLocally`.

```typescript
116:        return db.getAllAsync<LocalInventoryItem>(
117:          `select
118:             fi.id, fi.household_id, fi.location_id, fi.product_id,
119:             fi.name, fi.quantity, fi.unit, fi.expiry_date, fi.added_by, fi.created_at,
120:             sl.kind as location_kind,
121:             sl.name as location_name
122:            from fridge_items fi
123:            left join storage_locations sl on fi.location_id = sl.id
124:            where fi.household_id = ? and fi.deleted_at is null
125:            order by fi.expiry_date asc nulls last`,
126:           [householdId],
127:         );
128:       }
```
- **Lines 116–128**: Re-queries SQLite and returns newly seeded sample items.

```typescript
130:       return items;
131:     },
132:     enabled: !!householdId,
133:   });
134: }
```
- **Lines 130–134**: Returns items and sets query `enabled` flag to `!!householdId` so queries execute only when a valid household ID exists.

---

## 3. `src/features/inventory/use-inventory-mutations.ts`

This module exports React Query mutation hooks for creating new fridge items and updating item quantities or soft-deleting items.

### Line-by-Line Breakdown

```typescript
1: import { useMutation, useQueryClient } from '@tanstack/react-query';
2: import * as Crypto from 'expo-crypto';
3: 
4: import { getDatabase } from '@/lib/db/client';
5: import { enqueueMutation } from '@/lib/db/outbox';
6: import { normalizeUnit } from '@/lib/units';
```
- **Lines 1–6**: Imports dependencies for React Query mutations, UUID creation, SQLite access, offline mutation queuing, and unit normalization (`normalizeUnit`).

```typescript
8: export type FridgeItem = {
9:   id: string;
10:  household_id: string;
11:  location_id: string | null;
12:  name: string;
13:  quantity: number;
14:  unit: string;
15:  expiry_date: string | null;
16: };
```
- **Lines 8–16**: Exports `FridgeItem` interface for mutation payloads.

```typescript
18: export function useAddFridgeItemMutation() {
19:   const queryClient = useQueryClient();
20: 
21:   return useMutation({
22:     mutationFn: async (item: Omit<FridgeItem, 'id'>) => {
23:       const db = await getDatabase();
24:       const id = Crypto.randomUUID();
25:       const now = new Date().toISOString();
26:       const normUnit = normalizeUnit(item.unit);
```
- **Lines 18–26**: Hook `useAddFridgeItemMutation()`. Prepares database client, generates item UUID, captures ISO timestamp, and normalizes item unit (e.g. standardizing unit casing/symbols).

```typescript
28:       await enqueueMutation(db, {
29:         entity: 'fridge_items',
30:         entityId: id,
31:         op: 'insert',
32:         payload: {
33:           id,
34:           ...item,
35:           unit: normUnit,
36:           created_at: now,
37:           updated_at: now,
38:         },
39:         applyLocally: async (txn) => {
40:           await txn.runAsync(
41:             'insert into fridge_items (id, household_id, location_id, name, quantity, unit, expiry_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
42:             [
43:               id,
44:               item.household_id,
45:               item.location_id ?? null,
46:               item.name,
47:               item.quantity,
48:               normUnit,
49:               item.expiry_date ?? null,
50:               now,
51:               now,
52:             ],
53:           );
54:         },
55:       });
56: 
57:       return id;
58:     },
```
- **Lines 28–58**: Enqueues insertion mutation to outbox and performs local SQLite insert inside transaction. Returns new item ID.

```typescript
59:     onSuccess: (_, variables) => {
60:       queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
61:       queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
62:       queryClient.invalidateQueries({ queryKey: ['sync-status'] });
63:     },
64:   });
65: }
```
- **Lines 59–65**: `onSuccess` callback invalidates fridge item queries and outbox sync status queries to refresh UI components across the application.

```typescript
67: export function useUpdateInventoryItemQuantityMutation() {
68:   const queryClient = useQueryClient();
69: 
70:   return useMutation({
71:     mutationFn: async ({
72:       id,
73:       household_id,
74:       delta,
75:     }: {
76:       id: string;
77:       household_id: string;
78:       delta: number;
79:     }) => {
```
- **Lines 67–79**: Hook `useUpdateInventoryItemQuantityMutation()`. Accepts `id`, `household_id`, and numerical `delta` (+1, -1, or negative full quantity).

```typescript
80:       const db = await getDatabase();
81:       const now = new Date().toISOString();
82:       const existing = await db.getFirstAsync<{ quantity: number; name: string }>(
83:         'select quantity, name from fridge_items where id = ?',
84:         [id],
85:       );
86:       if (!existing) return;
```
- **Lines 80–86**: Retrieves existing item from SQLite. If non-existent, exits early.

```typescript
88:       const newQty = Math.max(0, existing.quantity + delta);
```
- **Line 88**: Computes new quantity bound to minimum 0 (`Math.max(0, ...)`).

```typescript
90:       if (newQty === 0) {
91:         await enqueueMutation(db, {
92:           entity: 'fridge_items',
93:           entityId: id,
94:           op: 'delete',
95:           payload: { id, household_id, deleted_at: now, updated_at: now },
96:           applyLocally: async (txn) => {
97:             await txn.runAsync(
98:               'update fridge_items set deleted_at = ?, updated_at = ? where id = ?',
99:               [now, now, id],
100:            );
101:          },
102:        });
```
- **Lines 90–102**: When `newQty === 0`, item is considered consumed/deleted. Enqueues `'delete'` mutation to outbox and sets `deleted_at = now` locally in SQLite.

```typescript
103:      } else {
104:        await enqueueMutation(db, {
105:          entity: 'fridge_items',
106:          entityId: id,
107:          op: 'update',
108:          payload: { id, household_id, quantity: newQty, updated_at: now },
109:          applyLocally: async (txn) => {
110:            await txn.runAsync(
111:              'update fridge_items set quantity = ?, updated_at = ? where id = ?',
112:              [newQty, now, id],
113:            );
114:          },
115:        });
116:      }
117:      return { id, newQty };
118:    },
```
- **Lines 103–118**: When `newQty > 0`, enqueues `'update'` mutation with updated quantity and updates SQLite row locally.

```typescript
119:    onSuccess: (_, variables) => {
120:      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
121:      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
122:      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
123:    },
124:  });
125: }
```
- **Lines 119–125**: Invalidates React Query caches on success.

---

## 4. `src/features/inventory/use-expiry-notifications.ts`

This module provides the `useExpiryNotifications` hook, which monitors fridge items for upcoming or past expiration dates and synchronizes local push notification schedules.

### Line-by-Line Breakdown

```typescript
1: import { useEffect } from 'react';
2: 
3: import { getExpiryInfo } from '@/features/inventory/expiry';
4: import { useInventoryItems } from '@/features/inventory/use-inventory-items';
5: import { getNotificationSettings, scheduleExpiryNotificationReminder } from '@/lib/notifications';
```
- **Lines 1–5**: Imports React's `useEffect`, expiry classification helper `getExpiryInfo`, fridge item hook `useInventoryItems`, and notification system helpers.

```typescript
7: export function useExpiryNotifications(householdId: string | undefined) {
8:   const { data: fridgeItems = [] } = useInventoryItems(householdId);
```
- **Lines 7–8**: Hook declaration taking optional `householdId`. Fetches current fridge items using `useInventoryItems`.

```typescript
10:  useEffect(() => {
11:    if (!householdId || fridgeItems.length === 0) return;
12:
13:    let isMounted = true;
```
- **Lines 10–13**: `useEffect` trigger on `householdId` or `fridgeItems` change. Early returns if no household ID is active or if items list is empty. Sets `isMounted` flag for async safety.

```typescript
15:    async function syncNotifications() {
16:      const settings = await getNotificationSettings();
17:      if (!isMounted || !settings.enabled) return;
```
- **Lines 15–17**: Asynchronous helper `syncNotifications`. Fetches user notification preferences. Exits if unmounted or if notification reminders are disabled in user settings.

```typescript
19:      const now = new Date();
20:      // Filtere Artikel, die in <= daysThreshold Tagen ablaufen oder bereits abgelaufen sind
21:      const expiringCount = fridgeItems.filter((item) => {
22:        if (!item.expiry_date) return false;
23:        const info = getExpiryInfo(item.expiry_date, now);
24:        if (info.bucket === 'expired' || info.bucket === 'critical') return true;
25:        if (info.daysLeft !== null && info.daysLeft <= settings.daysThreshold) {
26:          return true;
27:        }
28:        return false;
29:      }).length;
```
- **Lines 19–29**: Filters `fridgeItems` to count how many items are expired, critical, or expiring within the user-configured `settings.daysThreshold`.

```typescript
31:      await scheduleExpiryNotificationReminder(expiringCount, settings);
32:    }
33:
34:    syncNotifications();
```
- **Lines 31–34**: Schedules or updates system push notification reminders with total `expiringCount`.

```typescript
36:    return () => {
37:      isMounted = false;
38:    };
39:  }, [householdId, fridgeItems]);
40: }
```
- **Lines 36–40**: Cleanup handler setting `isMounted = false`. Dependency array watches `[householdId, fridgeItems]`.

---

## 5. `src/features/inventory/components/inventory-item-row.tsx`

This component renders an individual fridge inventory row item, including a colored MHD status indicator bar on the left, item details, location name, expiry badge, and interactive stepper controls (+ / -).

### Line-by-Line Breakdown

```typescript
1: import { Pressable, StyleSheet, View } from 'react-native';
2: 
3: import { ThemedText } from '@/components/themed-text';
4: import { Spacing } from '@/constants/theme';
5: import { useTheme } from '@/hooks/use-theme';
6: 
7: import { type ExpiryBucket, getExpiryInfo } from '../expiry';
8: import type { LocalInventoryItem } from '../use-inventory-items';
```
- **Lines 1–8**: Imports React Native UI components, theme hooks/tokens, and local domain types (`ExpiryBucket`, `LocalInventoryItem`, `getExpiryInfo`).

```typescript
10: const EXPIRY_LEFT_BORDER: Record<ExpiryBucket, string> = {
11:   expired: '#C62828',
12:   critical: '#C62828',
13:   soon: '#B26A00',
14:   ok: '#1A7F4B',
15:   none: 'transparent',
16: };
```
- **Lines 10–16**: Constant record mapping each expiry bucket to a specific left border color:
  - `expired` & `critical`: Dark Red (`#C62828`)
  - `soon`: Amber/Orange (`#B26A00`)
  - `ok`: Forest Green (`#1A7F4B`)
  - `none`: `transparent`

```typescript
18: interface InventoryItemRowProps {
19:   item: LocalInventoryItem;
20:   onDecrement: () => void;
21:   onIncrement: () => void;
22:   onDelete: () => void;
23: }
```
- **Lines 18–23**: Prop interface definition for `InventoryItemRow`.

```typescript
25: export function InventoryItemRow({ item, onDecrement, onIncrement, onDelete }: InventoryItemRowProps) {
26:   const theme = useTheme();
27:   const expiry = getExpiryInfo(item.expiry_date, new Date());
28:   const borderColor = EXPIRY_LEFT_BORDER[expiry.bucket];
```
- **Lines 25–28**: Component setup. Obtains current theme palette, calculates `expiry` info relative to `new Date()`, and retrieves indicator `borderColor`.

```typescript
30:   return (
31:     <Pressable
32:       onLongPress={onDelete}
33:       accessibilityRole="button"
34:       accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
35:       accessibilityHint="Lang drücken zum Löschen"
36:       style={[styles.itemRow, { borderBottomColor: theme.border }]}>
```
- **Lines 30–36**: Root `Pressable` row container. Supports long press to trigger `onDelete`, provides accessibility labels for screen readers, and styles bottom divider border color dynamically.

```typescript
37:       {/* MHD-Ampel — linker farbiger Streifen */}
38:       <View style={[styles.expiryBar, { backgroundColor: borderColor }]} />
```
- **Lines 37–38**: Vertical 4px left strip (`styles.expiryBar`) showing the MHD status color.

```typescript
40:       {/* Inhalt */}
41:       <View style={styles.itemMain}>
42:         <ThemedText type="smallBold">{item.name}</ThemedText>
43:         <View style={styles.itemMeta}>
44:           {item.location_name ? (
45:             <ThemedText type="small" themeColor="textSecondary">
46:               {item.location_name}
47:             </ThemedText>
48:           ) : null}
```
- **Lines 40–48**: Main row body. Renders item name in `smallBold` font, followed by storage location name (`location_name`) in secondary text color if present.

```typescript
49:           {expiry.bucket !== 'none' ? (
50:             <View style={[styles.mhdBadge, { backgroundColor: `${theme[expiry.themeColor]}22` }]}>
51:               <ThemedText type="small" style={{ color: theme[expiry.themeColor], fontSize: 11 }}>
52:                 {item.expiry_date
53:                   ? new Date(item.expiry_date).toLocaleDateString('de-DE', {
54:                       day: '2-digit',
55:                       month: '2-digit',
56:                       year: 'numeric',
57:                     })
58:                   : ''}
59:                 {' · '}
60:                 {expiry.bucket === 'critical' || expiry.bucket === 'expired' ? 'Kritisch' : 'Bald'}
61:               </ThemedText>
62:             </View>
63:           ) : null}
64:         </View>
65:       </View>
```
- **Lines 49–65**: Conditionally renders MHD badge pill if `expiry.bucket !== 'none'`. Uses semi-transparent background color (`22` hex opacity). Displays formatted date in `de-DE` locale (`DD.MM.YYYY`) alongside urgency text ("Kritisch" or "Bald").

```typescript
67:       {/* Mengen-Stepper */}
68:       <View style={styles.stepper}>
69:         <Pressable
70:           onPress={onDecrement}
71:           accessibilityRole="button"
72:           accessibilityLabel="Menge reduzieren"
73:           hitSlop={8}
74:           style={[styles.stepperButton, { borderColor: theme.border }]}>
75:           <ThemedText style={styles.stepperIcon}>−</ThemedText>
76:         </Pressable>
```
- **Lines 67–76**: Quantity decrement button with minus symbol (`−`), expanded touch area (`hitSlop={8}`), and accessibility accessibilityLabel `"Menge reduzieren"`.

```typescript
78:         <ThemedText type="smallBold" style={styles.quantity}>
79:           {item.quantity} {item.unit}
80:         </ThemedText>
```
- **Lines 78–80**: Displays current item quantity and unit (e.g. "1 l" or "200 g").

```typescript
82:         <Pressable
83:           onPress={onIncrement}
84:           accessibilityRole="button"
85:           accessibilityLabel="Menge erhöhen"
86:           hitSlop={8}
87:           style={[
88:             styles.stepperButton,
89:             styles.stepperButtonPlus,
90:             { borderColor: theme.success, backgroundColor: `${theme.success}18` },
91:           ]}>
92:           <ThemedText style={[styles.stepperIcon, { color: theme.success }]}>+</ThemedText>
93:         </Pressable>
94:       </View>
95:     </Pressable>
96:   );
97: }
```
- **Lines 82–97**: Quantity increment button formatted in green success theme accent with plus symbol (`+`), triggering `onIncrement`.

```typescript
99: const styles = StyleSheet.create({
100:   itemRow: {
101:     flexDirection: 'row',
102:     alignItems: 'center',
103:     paddingRight: Spacing.three,
104:     paddingVertical: Spacing.three,
105:     borderBottomWidth: StyleSheet.hairlineWidth,
106:     gap: Spacing.three,
107:   },
108:   expiryBar: {
109:     width: 4,
110:     height: '100%',
111:     minHeight: 44,
112:     borderRadius: 2,
113:   },
114:   itemMain: {
115:     flex: 1,
116:     gap: Spacing.half,
117:   },
118:   itemMeta: {
119:     flexDirection: 'row',
120:     alignItems: 'center',
121:     gap: Spacing.two,
122:     flexWrap: 'wrap',
123:   },
124:   mhdBadge: {
125:     paddingHorizontal: Spacing.two,
126:     paddingVertical: 2,
127:     borderRadius: 6,
128:   },
129:   stepper: {
130:     flexDirection: 'row',
131:     alignItems: 'center',
132:     gap: Spacing.two,
133:   },
134:   stepperButton: {
135:     width: 30,
136:     height: 30,
137:     borderRadius: 15,
138:     borderWidth: 1,
139:     alignItems: 'center',
140:     justifyContent: 'center',
141:   },
142:   stepperButtonPlus: {
143:     borderWidth: 1,
144:   },
145:   stepperIcon: {
146:     fontSize: 18,
147:     lineHeight: 22,
148:   },
149:   quantity: {
150:     minWidth: 54,
151:     textAlign: 'center',
152:   },
153: });
```
- **Lines 99–153**: Component stylesheet defining layout geometry, flex direction, badge padding, circular stepper button dimensions ($30 \times 30$, `borderRadius: 15`), and text alignment.

---

## 6. `src/features/inventory/components/inventory-tab-bar.tsx`

This component renders a horizontally scrollable tab bar for filtering inventory by storage location (e.g. All, Fridge, Freezer, Pantry).

### Line-by-Line Breakdown

```typescript
1: import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
2: 
3: import { ThemedText } from '@/components/themed-text';
4: import { Spacing } from '@/constants/theme';
5: import type { StorageLocation } from '@/features/inventory/use-storage-locations';
6: import { useTheme } from '@/hooks/use-theme';
7: import type { LocalInventoryItem } from '../use-inventory-items';
```
- **Lines 1–7**: Imports UI primitives, types for storage locations and fridge items, theme hooks, and design system constants.

```typescript
9: export function getIconForLocation(kind?: string | null, name?: string | null): string {
10:   const k = (kind ?? '').toLowerCase();
11:   const n = (name ?? '').toLowerCase();
12:   if (k === 'fridge') return '🫙';
13:   if (k === 'freezer') return '❄️';
14:   if (k === 'pantry') return '🥫';
15:   if (
16:     n.includes('tief') ||
17:     n.includes('frost') ||
18:     n.includes('eis') ||
19:     n.includes('frier') ||
20:     n.includes('freezer')
21:   )
22:     return '❄️';
23:   if (n.includes('kühl') || n.includes('fridge')) return '🫙';
24:   if (n.includes('kammer') || n.includes('schrank') || n.includes('regal') || n.includes('pantry'))
25:     return '🥫';
26:   return '📦';
27: }
```
- **Lines 9–27**: Exported helper `getIconForLocation`. Determines an emoji icon representation for a location based on location `kind` or keyword matching in location `name`:
  - Freezer/Ice keywords (`tief`, `frost`, `eis`, `frier`, `freezer`) $\rightarrow$ ❄️
  - Fridge keywords (`kühl`, `fridge`) $\rightarrow$ 🫙
  - Pantry/Cabinet keywords (`kammer`, `schrank`, `regal`, `pantry`) $\rightarrow$ 🥫
  - Default fallback $\rightarrow$ 📦

```typescript
29: interface InventoryTabBarProps {
30:   activeTab: string; // 'all' or location.id
31:   onTabChange: (id: string) => void;
32:   locations: StorageLocation[];
33:   items: LocalInventoryItem[];
34: }
```
- **Lines 29–34**: Prop interface for `InventoryTabBar`.

```typescript
36: export function InventoryTabBar({ activeTab, onTabChange, locations, items }: InventoryTabBarProps) {
37:   const theme = useTheme();
38: 
39:   return (
40:     <ScrollView
41:       horizontal
42:       showsHorizontalScrollIndicator={false}
43:       contentContainerStyle={[styles.tabBar, { backgroundColor: theme.backgroundElement }]}>
```
- **Lines 36–43**: Component signature and root horizontal `ScrollView` container with hidden scroll indicators.

```typescript
44:       <Pressable
45:         onPress={() => onTabChange('all')}
46:         accessibilityRole="tab"
47:         accessibilityState={{ selected: activeTab === 'all' }}
48:         style={[
49:           styles.tab,
50:           activeTab === 'all' && {
51:             backgroundColor: theme.background,
52:             borderColor: theme.accent,
53:             borderWidth: 1,
54:           },
55:         ]}>
56:         <ThemedText style={styles.tabIcon}>📦</ThemedText>
57:         <ThemedText
58:           type="small"
59:           style={{
60:             color: activeTab === 'all' ? theme.text : theme.textSecondary,
61:             fontWeight: activeTab === 'all' ? '600' : '400',
62:           }}>
63:           Alle
64:         </ThemedText>
65:         {items.length > 0 && (
66:           <View
67:             style={[
68:               styles.tabBadge,
69:               { backgroundColor: activeTab === 'all' ? theme.accent : theme.textSecondary },
70:             ]}>
71:             <ThemedText style={styles.tabBadgeText}>{items.length}</ThemedText>
72:           </View>
73:         )}
74:       </Pressable>
```
- **Lines 44–74**: Renders the "Alle" (All items) tab button. Shows package emoji 📦, total items count badge, and applies active selection border styling when `activeTab === 'all'`.

```typescript
76:       {locations.map((loc) => {
77:         const isActive = activeTab === loc.id;
78:         const icon = getIconForLocation(loc.kind, loc.name);
79:         const count = items.filter((i) => i.location_id === loc.id).length;
```
- **Lines 76–79**: Maps over dynamic `locations` array, evaluating active state, location icon, and filtered item count (`count`).

```typescript
81:         return (
82:           <Pressable
83:             key={loc.id}
84:             onPress={() => onTabChange(loc.id)}
85:             accessibilityRole="tab"
86:             accessibilityState={{ selected: isActive }}
87:             style={[
88:               styles.tab,
89:               isActive && {
90:                 backgroundColor: theme.background,
91:                 borderColor: theme.accent,
92:                 borderWidth: 1,
93:               },
94:             ]}>
95:             <ThemedText style={styles.tabIcon}>{icon}</ThemedText>
96:             <ThemedText
97:               type="small"
98:               style={{
99:                 color: isActive ? theme.text : theme.textSecondary,
100:                fontWeight: isActive ? '600' : '400',
101:              }}>
102:              {loc.name}
103:            </ThemedText>
104:            {count > 0 && (
105:              <View
106:                style={[
107:                  styles.tabBadge,
108:                  { backgroundColor: isActive ? theme.accent : theme.textSecondary },
109:                ]}>
110:                <ThemedText style={styles.tabBadgeText}>{count}</ThemedText>
111:              </View>
112:            )}
113:          </Pressable>
114:        );
115:      })}
116:    </ScrollView>
117:  );
118: }
```
- **Lines 81–118**: Renders tab pressable button for each location with appropriate accessibility role, active styles, icon, location name, and location item count badge.

```typescript
120: const styles = StyleSheet.create({
121:   tabBar: {
122:     flexDirection: 'row',
123:     borderRadius: Spacing.three,
124:     padding: Spacing.half,
125:     gap: Spacing.half,
126:     alignItems: 'center',
127:   },
128:   tab: {
129:     flexDirection: 'row',
130:     alignItems: 'center',
131:     justifyContent: 'center',
132:     gap: Spacing.one,
133:     paddingHorizontal: Spacing.three,
134:     paddingVertical: Spacing.two,
135:     borderRadius: Spacing.two + 2,
136:   },
137:   tabIcon: {
138:     fontSize: 14,
139:   },
140:   tabBadge: {
141:     minWidth: 18,
142:     height: 18,
143:     borderRadius: 9,
144:     alignItems: 'center',
145:     justifyContent: 'center',
146:     paddingHorizontal: 4,
147:   },
148:   tabBadgeText: {
149:     color: '#fff',
150:     fontSize: 11,
151:     fontWeight: '700',
152:   },
153: });
```
- **Lines 120–153**: Stylesheet defining horizontal row tab bar layout, pill shapes, badge dimensions, and typography.

---

## 7. `src/features/inventory/inventory-screen.tsx`

This file implements the main `InventoryScreen` component. It brings together active household data, storage locations, fridge items, tab filtering, step handlers, item deletion confirmation alerts, and empty state fallbacks.

### Line-by-Line Breakdown

```typescript
1: import { useState } from 'react';
2: import { Alert, FlatList, StyleSheet, View } from 'react-native';
3: 
4: import { Card } from '@/components/card';
5: import { EmptyState } from '@/components/empty-state';
6: import { Screen } from '@/components/screen';
7: import { ThemedText } from '@/components/themed-text';
8: import { Spacing } from '@/constants/theme';
9: import { useActiveHousehold } from '@/features/household/active-household-provider';
10: import { useStorageLocations } from '@/features/inventory/use-storage-locations';
11: 
12: import { InventoryItemRow } from './components/inventory-item-row';
13: import { InventoryTabBar } from './components/inventory-tab-bar';
14: import { getExpiryInfo } from './expiry';
15: import { type LocalInventoryItem, useInventoryItems } from './use-inventory-items';
16: import { useUpdateInventoryItemQuantityMutation } from './use-inventory-mutations';
```
- **Lines 1–16**: Imports React state management, React Native UI components (`Alert`, `FlatList`), global UI components (`Screen`, `Card`, `EmptyState`, `ThemedText`), household & location hooks, and fridge feature subcomponents.

```typescript
18: /**
19:  * Vorrat-Bestand, dynamisch gefiltered nach Lagerort (#67).
20:  *
21:  * - Dynamische Tab-Filter basierend auf den Lagerorten aus den Einstellungen
22:  * - Farbiger linker Rand als MHD-Ampel (#71, expiry.ts)
23:  * - MHD-Badge + Stepper (− / + )
24:  * - Lang drücken = Löschen-Bestätigung
25:  */
26: export function InventoryScreen() {
27:   const [activeTab, setActiveTab] = useState<string>('all');
```
- **Lines 18–27**: Declares `InventoryScreen` component and initializes `activeTab` state to `'all'`.

```typescript
29:   const { activeHouseholdId } = useActiveHousehold();
30:   const householdId = activeHouseholdId ?? undefined;
31: 
32:   const { data: locations = [] } = useStorageLocations(householdId);
33:   const { data: allItems = [], isLoading } = useInventoryItems(householdId);
34:   const updateQty = useUpdateInventoryItemQuantityMutation();
```
- **Lines 29–34**: Retrieves current household ID, fetches storage locations and fridge items, and initializes the quantity mutation hook.

```typescript
36:   const expiringCount = allItems.filter((item) => {
37:     if (!item?.expiry_date) return false;
38:     const info = getExpiryInfo(item.expiry_date, new Date());
39:     return info.bucket === 'critical' || info.bucket === 'expired';
40:   }).length;
```
- **Lines 36–40**: Computes `expiringCount` by checking items whose expiry bucket is `'critical'` or `'expired'`.

```typescript
42:   const visibleItems =
43:     activeTab === 'all' ? allItems : allItems.filter((item) => item.location_id === activeTab);
```
- **Lines 42–43**: Filters items displayed in the list according to `activeTab`.

```typescript
45:   function handleDecrement(item: LocalInventoryItem) {
46:     if (!householdId) return;
47:     if (item.quantity <= 1) {
48:       Alert.alert('Artikel verbraucht?', `"${item.name}" aus dem Vorrat entfernen?`, [
49:         { text: 'Behalten', style: 'cancel' },
50:         {
51:           text: 'Entfernen',
52:           style: 'destructive',
53:           onPress: () => updateQty.mutate({ id: item.id, household_id: householdId, delta: -1 }),
54:         },
55:       ]);
56:     } else {
57:       updateQty.mutate({ id: item.id, household_id: householdId, delta: -1 });
58:     }
59:   }
```
- **Lines 45–59**: Decrement button handler `handleDecrement`. If quantity is 1, displays an explicit native confirmation alert asking if the item should be removed. If confirmed or quantity > 1, fires quantity update mutation with `delta: -1`.

```typescript
61:   function handleIncrement(item: LocalInventoryItem) {
62:     if (!householdId) return;
63:     updateQty.mutate({ id: item.id, household_id: householdId, delta: 1 });
64:   }
```
- **Lines 61–64**: Increment button handler `handleIncrement`. Fires quantity update mutation with `delta: 1`.

```typescript
66:   function handleDeletePress(item: LocalInventoryItem) {
67:     if (!householdId) return;
68:     Alert.alert('Artikel löschen', `"${item.name}" sofort aus dem Vorrat entfernen?`, [
69:       { text: 'Abbrechen', style: 'cancel' },
70:       {
71:         text: 'Löschen',
72:         style: 'destructive',
73:         onPress: () =>
74:           updateQty.mutate({
75:             id: item.id,
76:             household_id: householdId,
77:             delta: -item.quantity,
78:           }),
79:       },
80:     ]);
81:   }
```
- **Lines 66–81**: Long press delete handler `handleDeletePress`. Presents confirmation dialog asking to delete item immediately. If confirmed, mutates quantity by `-item.quantity`, reducing total quantity to 0 and triggering soft deletion.

```typescript
83:   if (!householdId) {
84:     return (
85:       <Screen title="Vorrat" subtitle="Für alle im Haushalt sichtbar">
86:         <Card>
87:           <EmptyState
88:             symbol="archivebox"
89:             title="Noch kein Haushalt"
90:             hint="Lege im Profil einen Haushalt an oder tritt einem bei. Danach teilt ihr Vorrat und Einkaufsliste in Echtzeit."
91:           />
92:         </Card>
93:       </Screen>
94:     );
95:   }
```
- **Lines 83–95**: Renders an empty state screen if user has not selected/joined an active household yet.

```typescript
97:   const subtitle =
98:     allItems.length > 0
99:       ? `${allItems.length} Artikel gesamt · Tippe für Nährwerte`
100:      : 'Für alle im Haushalt sichtbar';
101:
102:  const activeLocationName =
103:    activeTab === 'all'
104:      ? 'Vorrat'
105:      : (locations.find((l) => l.id === activeTab)?.name ?? 'Lagerort');
```
- **Lines 97–105**: Computes screen header subtitle text and active storage location name.

```typescript
107:  return (
108:    <Screen
109:      title="Vorrat"
110:      subtitle={subtitle}
111:      action={
112:        expiringCount > 0 ? (
113:          <View style={styles.expiringBadge}>
114:            <ThemedText style={styles.expiringBadgeText}>⚠ {expiringCount} ablaufend</ThemedText>
115:          </View>
116:        ) : undefined
117:      }>
```
- **Lines 107–117**: Primary `Screen` wrapper. Displays title, subtitle, and an action badge (`⚠ X ablaufend`) if items are expiring.

```typescript
118:      {/* Dynamic Tab-Leiste für alle Lagerorte aus den Einstellungen */}
119:      <InventoryTabBar
120:        activeTab={activeTab}
121:        onTabChange={setActiveTab}
122:        locations={locations}
123:        items={allItems}
124:      />
```
- **Lines 118–124**: Renders `InventoryTabBar` for location tab switching.

```typescript
126:      {/* Artikel-Liste des aktiven Tabs */}
127:      {isLoading ? null : visibleItems.length === 0 ? (
128:        <Card style={{ marginTop: Spacing.two }}>
129:          <EmptyState
130:            symbol="archivebox"
131:            title={`${activeLocationName} ist leer`}
132:            hint="Schließe einen Einkauf ab oder füge Artikel manuell hinzu."
133:          />
134:        </Card>
135:      ) : (
136:        <FlatList
137:          data={visibleItems}
138:          keyExtractor={(item) => item.id}
139:          scrollEnabled={false}
140:          style={{ marginTop: Spacing.two }}
141:          renderItem={({ item }) => (
142:            <InventoryItemRow
143:              item={item}
144:              onDecrement={() => handleDecrement(item)}
145:              onIncrement={() => handleIncrement(item)}
146:              onDelete={() => handleDeletePress(item)}
147:            />
148:          )}
149:        />
150:      )}
151:    </Screen>
152:  );
153: }
```
- **Lines 126–153**: Renders main inventory contents: displays an empty state card if no items exist in the active tab, or renders a non-scrollable `FlatList` of `InventoryItemRow` components.

```typescript
155: const styles = StyleSheet.create({
156:   expiringBadge: {
157:     backgroundColor: '#FFF3E0',
158:     paddingHorizontal: Spacing.two,
159:     paddingVertical: Spacing.one,
160:     borderRadius: Spacing.two,
161:   },
162:   expiringBadgeText: {
163:     color: '#B26A00',
164:     fontSize: 12,
165:     fontWeight: '600',
166:   },
167: });
```
- **Lines 155–167**: Stylesheet for the header expiring warning badge container and text.
