import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { DateWheelField } from '@/components/forms/date-wheel-field';
import { TextField } from '@/components/forms/text-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { Button } from '@/components/ui/buttons';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Txt } from '@/constants/ui';
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
  const sheetStyle = useSheetShadowStyle();
  const updateItem = useUpdateFridgeItemMutation();
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

  useEffect(() => {
    if (!visible || !item) return;
    setName(item.name);
    setQuantity(item.quantity);
    setUnit(item.unit);
    setLocationId(item.location_id ?? '');
    setExpiryDate(item.expiry_date ?? '');
    setOpenedAt(item.opened_at ?? null);
    setVacuumSealed(item.vacuum_sealed ?? false);
    setExpiryUserSet(item.expiry_user_set ?? false);
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
      opened_at: openedAt,
      vacuum_sealed: vacuumSealed,
      expiry_user_set: expiryUserSet || !!expiryDate,
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

        <View className="edit-fridge-sheet" style={sheetStyle}>
          <View className="fridge-actions-handle" />

          <ScrollView
            contentContainerClassName="edit-fridge-content"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="edit-fridge-header">
              <Txt variant="title">Artikel bearbeiten</Txt>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Schließen"
                className="edit-fridge-close-button">
                <Txt variant="body" tone="secondary">
                  ×
                </Txt>
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
                  onChange={setExpiryDate}
                />
                {openedAt ? (
                  <View className="gap-one">
                    <Txt variant="caption" tone="secondary">
                      Dieses Los ist seit {new Date(openedAt).toLocaleDateString('de-DE')} geöffnet.
                    </Txt>
                    <Button
                      variant="secondary"
                      label="Wieder versiegeln"
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
