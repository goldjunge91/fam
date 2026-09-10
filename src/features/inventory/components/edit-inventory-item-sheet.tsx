import { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateWheelField } from '@/components/forms/date-wheel-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Button, IconButton, TextField, Txt } from '@/constants/ui';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { UNIT_OPTIONS } from '@/lib/units';

import type { LocalInventoryItem } from '../use-inventory-items';
import { useUpdateFridgeItemMutation } from '../use-inventory-mutations';

type EditInventoryItemSheetProps = {
  visible: boolean;
  item: LocalInventoryItem | null;
  locations: StorageLocation[];
  onClose: () => void;
};

export function EditInventoryItemSheet({
  visible,
  item,
  locations,
  onClose,
}: EditInventoryItemSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sheetStyle = useSheetShadowStyle();
  const updateItem = useUpdateFridgeItemMutation();
  const topInset = insets.top > 0 ? insets.top : space.xl;
  const maxSheetHeight = Dimensions.get('window').height - topInset - space.sm;
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('piece');
  const [locationId, setLocationId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [vacuumSealed, setVacuumSealed] = useState(false);
  const [expiryUserSet, setExpiryUserSet] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  // Feste Momentaufnahme vom Öffnen der Sheet. save() vergleicht dagegen statt
  // gegen das live aktualisierte `item`-Prop: sonst würde eine fremde
  // Änderung an einem vom Nutzer nicht bearbeiteten Feld (z. B. Realtime
  // während die Sheet offen bleibt) fälschlich als eigene Bearbeitung erkannt
  // und beim Speichern zurückgesetzt.
  const [baseline, setBaseline] = useState({
    name: '',
    quantity: 1,
    unit: 'piece',
    locationId: '',
    expiryDate: '',
    openedAt: null as string | null,
    vacuumSealed: false,
    expiryUserSet: false,
  });
  // Merkt sich, für welches Item der Entwurf zuletzt initialisiert wurde.
  const initializedItemId = useRef<string | null>(null);
  const itemId = item?.id ?? null;
  const hasItem = Boolean(item);

  useEffect(() => {
    if (!__DEV__ || !visible) return;
    console.log('[InventorySheet] inventory.edit-sheet.open', {
      sheetId: 'inventory.edit-sheet',
      itemId,
      hasItem,
    });
  }, [hasItem, itemId, visible]);

  useEffect(() => {
    if (!visible || !item) {
      initializedItemId.current = null;
      return;
    }
    if (initializedItemId.current === item.id) return;
    initializedItemId.current = item.id;
    const nextBaseline = {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      locationId: item.location_id ?? '',
      expiryDate: item.expiry_date ?? '',
      openedAt: item.opened_at ?? null,
      vacuumSealed: item.vacuum_sealed ?? false,
      expiryUserSet: item.expiry_user_set ?? false,
    };
    setBaseline(nextBaseline);
    setName(nextBaseline.name);
    setQuantity(nextBaseline.quantity);
    setUnit(nextBaseline.unit);
    setLocationId(nextBaseline.locationId);
    setExpiryDate(nextBaseline.expiryDate);
    setOpenedAt(nextBaseline.openedAt);
    setVacuumSealed(nextBaseline.vacuumSealed);
    setExpiryUserSet(nextBaseline.expiryUserSet);
    setDetailsOpen(false);
    setNameError(null);
  }, [item, visible]);

  if (!item) return null;
  const currentItem = item;

  const locationOptions = [
    { value: '', label: 'Kein Lagerort' },
    ...locations.map((location) => ({
      value: location.id,
      label: location.name,
    })),
  ];
  const locationName =
    locations.find((location) => location.id === locationId)?.name ?? 'Kein Lagerort';

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Bitte einen Artikelnamen eingeben.');
      return;
    }

    setNameError(null);
    const nextLocationId = locationId || null;
    const nextExpiryDate = expiryDate || null;
    const baselineLocationId = baseline.locationId || null;
    const baselineExpiryDate = baseline.expiryDate || null;
    await updateItem.mutateAsync({
      id: currentItem.id,
      household_id: currentItem.household_id,
      patch: {
        ...(trimmedName !== baseline.name ? { name: trimmedName } : {}),
        ...(unit !== baseline.unit ? { unit } : {}),
        ...(nextLocationId !== baselineLocationId ? { location_id: nextLocationId } : {}),
        ...(nextExpiryDate !== baselineExpiryDate ? { expiry_date: nextExpiryDate } : {}),
        ...(openedAt !== baseline.openedAt ? { opened_at: openedAt } : {}),
        ...(vacuumSealed !== baseline.vacuumSealed ? { vacuum_sealed: vacuumSealed } : {}),
        ...(expiryUserSet !== baseline.expiryUserSet ? { expiry_user_set: expiryUserSet } : {}),
      },
      // Menge nur als bewusste Korrektur übergeben, wenn der Stepper wirklich
      // bewegt wurde — sonst würde ein zwischenzeitlicher Verbrauch beim
      // Speichern eines reinen Namens-/MHD-Edits überschrieben.
      ...(quantity !== baseline.quantity
        ? {
            quantityCorrection: {
              expectedQuantity: baseline.quantity,
              newQuantity: quantity,
            },
          }
        : {}),
    });
    onClose();
  }

  function handleExpiryDateChange(value: string) {
    setExpiryDate(value);
    setExpiryUserSet(true);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Artikel bearbeiten schließen"
        />

        <View
          className="edit-fridge-sheet"
          style={[
            sheetStyle,
            {
              width: '100%',
              height: maxSheetHeight,
              maxHeight: maxSheetHeight,
              backgroundColor: colors.backgroundElement,
            },
          ]}>
          <View className="fridge-actions-handle" />

          <View
            className="flex-row items-center justify-between"
            style={{
              paddingHorizontal: space.lg,
              paddingTop: space.xs,
              paddingBottom: space.sm,
            }}>
            <Txt variant="title">Artikel bearbeiten</Txt>
            <IconButton
              icon="x"
              onPress={onClose}
              accessibilityLabel="Schließen"
              // bg={colors.backgroundSoft}
              bg={withAlpha(colors.tomato, 1)}
              size={40}
              iconSize={22}
              style={{
                borderRadius: radius.lg,
                shadowOpacity: 0,
                elevation: 0,
              }}
            />
          </View>

          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: space.lg,
              paddingBottom: space.md,
              gap: space.md,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bottomOffset={24}>
            <TextField
              label="Artikelname"
              value={name}
              onChangeText={setName}
              error={nameError ?? undefined}
              placeholder="z. B. Vollmilch"
            />

            <View className="edit-fridge-product-card">
              <View className="edit-fridge-product-copy">
                <Txt variant="body" weight="700">
                  {name.trim() || currentItem.name}
                </Txt>
                <Txt variant="body" tone="secondary">
                  {locationName}
                </Txt>
              </View>
              <View className="edit-fridge-product-quantity">
                <Txt variant="body" weight="700">
                  {quantity} {unit}
                </Txt>
                <Txt variant="body" tone="secondary">
                  aktuelle Menge
                </Txt>
              </View>
            </View>

            <View className="edit-fridge-controls-row">
              <View className="edit-fridge-control-column">
                <Txt variant="body" tone="secondary">
                  Menge
                </Txt>
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  label="Menge"
                  size="large"
                />
              </View>

              <View className="edit-fridge-control-column">
                <WheelPickerField
                  label="Lagerort"
                  value={locationId}
                  options={locationOptions}
                  onChange={setLocationId}
                />
              </View>
            </View>

            <Pressable
              onPress={() => setDetailsOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={`${detailsOpen ? 'Weitere Angaben schließen' : 'Weitere Angaben öffnen'}`}
              accessibilityState={{ expanded: detailsOpen }}
              className="edit-fridge-details-toggle">
              <Txt tone="secondary">{detailsOpen ? '⌄' : '›'}</Txt>
              <Txt variant="body" tone="primary">
                Weitere Angaben
              </Txt>
            </Pressable>

            {detailsOpen ? (
              <View className="gap-three">
                <WheelPickerField
                  label="Einheit"
                  value={unit}
                  options={UNIT_OPTIONS}
                  onChange={setUnit}
                />
                <DateWheelField
                  label="Mindesthaltbarkeitsdatum"
                  value={expiryDate}
                  onChange={handleExpiryDateChange}
                />
                {openedAt ? (
                  <View className="gap-one">
                    <Txt variant="caption" tone="secondary">
                      Dieses Los ist seit {new Date(openedAt).toLocaleDateString('de-DE')} geöffnet.
                    </Txt>
                    <Button
                      variant="secondary"
                      title="Wieder versiegeln"
                      onPress={() => {
                        setOpenedAt(null);
                        setVacuumSealed(false);
                        setExpiryUserSet(true);
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <Button
              title="Änderungen speichern"
              size="lg"
              onPress={save}
              loading={updateItem.isPending}
              disabled={!name.trim()}
            />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}
