import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateWheelField } from '@/components/date-wheel-field';
import { QuantityStepper } from '@/components/quantity-stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { WheelPickerField } from '@/components/wheel-picker-field';
import { Spacing, withAlpha } from '@/constants/theme';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';
import { UNIT_OPTIONS } from '@/lib/units';

import type { LocalFridgeItem } from '../use-fridge-items';
import { useUpdateFridgeItemMutation } from '../use-fridge-mutations';

type EditFridgeItemSheetProps = {
  visible: boolean;
  item: LocalFridgeItem | null;
  locations: StorageLocation[];
  onClose: () => void;
};

export function EditFridgeItemSheet({
  visible,
  item,
  locations,
  onClose,
}: EditFridgeItemSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const updateItem = useUpdateFridgeItemMutation();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('piece');
  const [locationId, setLocationId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !item) return;
    setName(item.name);
    setQuantity(item.quantity);
    setUnit(item.unit);
    setLocationId(item.location_id ?? '');
    setExpiryDate(item.expiry_date ?? '');
    setDetailsOpen(false);
    setNameError(null);
  }, [item, visible]);

  if (!item) return null;
  const currentItem = item;

  const locationOptions = [
    { value: '', label: 'Kein Lagerort' },
    ...locations.map((location) => ({ value: location.id, label: location.name })),
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
    await updateItem.mutateAsync({
      id: currentItem.id,
      household_id: currentItem.household_id,
      product_id: currentItem.product_id,
      name: trimmedName,
      quantity,
      unit,
      package_size: currentItem.package_size,
      package_size_unit: currentItem.package_size_unit,
      location_id: locationId || null,
      expiry_date: expiryDate || null,
    });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="edit-fridge-modal-root">
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Artikel bearbeiten schließen"
        />

        <View
          className="edit-fridge-sheet"
          // paddingBottom (Safe-Area-Insets), boxShadow (dynamische
          // Opazitaet) und borderCurve sind Ausnahmen.
          style={{
            paddingBottom: Math.max(insets.bottom, Spacing.three),
            boxShadow: `0 -16px 48px ${withAlpha(theme.shadowSheet, 0.2)}`,
            borderCurve: 'continuous',
          }}>
          <View className="fridge-actions-handle" />

          <ScrollView
            contentContainerClassName="edit-fridge-content"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="edit-fridge-header">
              <ThemedText type="subtitle">Artikel bearbeiten</ThemedText>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Schließen"
                className="edit-fridge-close-button">
                <ThemedText themeColor="textSecondary">×</ThemedText>
              </Pressable>
            </View>

            <TextField
              label="Artikelname"
              value={name}
              onChangeText={setName}
              error={nameError ?? undefined}
              placeholder="z. B. Vollmilch"
            />

            <View className="edit-fridge-product-card">
              <View className="edit-fridge-product-copy">
                <ThemedText type="smallBold">{name.trim() || currentItem.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {locationName}
                </ThemedText>
              </View>
              <View className="edit-fridge-product-quantity">
                <ThemedText type="smallBold">
                  {quantity} {unit}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  aktuelle Menge
                </ThemedText>
              </View>
            </View>

            <View className="edit-fridge-controls-row">
              <View className="edit-fridge-control-column">
                <ThemedText type="small" themeColor="textSecondary">
                  Menge
                </ThemedText>
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
              <ThemedText themeColor="accent">{detailsOpen ? '⌄' : '›'}</ThemedText>
              <ThemedText type="small" themeColor="accent">
                Weitere Angaben
              </ThemedText>
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
                  onChange={setExpiryDate}
                />
              </View>
            ) : null}

            <Button
              label="Änderungen speichern"
              size="large"
              onPress={save}
              loading={updateItem.isPending}
              disabled={!name.trim()}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
