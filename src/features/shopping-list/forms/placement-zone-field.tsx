import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { debugLog } from '@/lib/debug-log';
import {
  normalizePlacementOrder,
  normalizePlacementZoneIdNullable,
  PLACEMENT_ZONES,
  type PlacementZoneId,
  placementZoneForId,
  type StoredPlacementZoneId,
} from '../classification/placement-taxonomy';
import type { CategorySource } from '../classification/types';

export type PlacementZoneSelection =
  | { mode: 'automatic' }
  | { mode: 'manual'; zoneId: PlacementZoneId };

export type PlacementZoneFieldProps = {
  label?: string;
  selection: PlacementZoneSelection;
  /** Effektive Zone, wenn `selection.mode` automatisch ist. */
  effectiveZoneId?: PlacementZoneId | null;
  /** Store-specific order. Legacy IDs and duplicates are normalized on read. */
  categoryOrder?: readonly string[] | null;
  onSelectionChange: (selection: { mode: 'manual'; zoneId: PlacementZoneId }) => void;
  onSelectAutomatic: () => void;
};

const DEFAULT_LABEL = 'Einkaufsbereich';

/** Form field for the V2 placement taxonomy. Persistence belongs to the form save handler. */
export function PlacementZoneField({
  label = DEFAULT_LABEL,
  selection,
  effectiveZoneId = null,
  categoryOrder,
  onSelectionChange,
  onSelectAutomatic,
}: PlacementZoneFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const visibleZoneId = selection.mode === 'manual' ? selection.zoneId : effectiveZoneId;
  const zone = placementZoneForId(visibleZoneId);
  const zoneLabel = zone?.label ?? (selection.mode === 'automatic' ? 'Automatisch' : 'Sonstiges');
  const options = orderedZones(categoryOrder);

  function selectZone(zoneId: PlacementZoneId) {
    debugLog(` [Placement]  ℹ️ placement-zone-field selectZone: ${zoneId}`);
    onSelectionChange({ mode: 'manual', zoneId });
    setIsOpen(false);
  }

  function selectAutomatic() {
    debugLog(' [Placement]  ℹ️ placement-zone-field selectAutomatic', { effectiveZoneId });
    onSelectAutomatic();
    setIsOpen(false);
  }

  return (
    <View className="gap-one">
      <Txt variant="body" tone="secondary">
        {label}
      </Txt>
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${zoneLabel}. Ändern`}
        className="flex-row items-center gap-two rounded-control border-hairline border-border bg-background-element px-three py-two active:opacity-70">
        {zone ? (
          <View
            className="w-[10px] h-[10px] rounded-pill"
            style={{ backgroundColor: zone.color }}
          />
        ) : null}
        <View className="flex-1 min-w-0">
          <Txt variant="body" numberOfLines={1}>
            {zoneLabel}
          </Txt>
        </View>
        <Txt tone="secondary">⌄</Txt>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View className="modal-backdrop">
          <View className="modal-sheet">
            <Txt variant="heading" weight="700">
              {label}
            </Txt>
            <ScrollView style={{ maxHeight: 420 }} className="gap-[2px]">
              <PlacementZoneOption
                label="Automatisch"
                checked={selection.mode === 'automatic'}
                onPress={selectAutomatic}
              />
              {options.map((option) => (
                <PlacementZoneOption
                  key={option.id}
                  label={option.label}
                  color={option.color}
                  checked={selection.mode === 'manual' && selection.zoneId === option.id}
                  onPress={() => selectZone(option.id)}
                />
              ))}
            </ScrollView>
            <Button label="Schließen" variant="secondary" onPress={() => setIsOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function orderedZones(categoryOrder: readonly string[] | null | undefined) {
  const ids = categoryOrder?.length
    ? normalizePlacementOrder(categoryOrder)
    : PLACEMENT_ZONES.map((zone) => zone.id);
  return ids.flatMap((id) => {
    const zone = PLACEMENT_ZONES.find((candidate) => candidate.id === id);
    return zone ? [zone] : [];
  });
}

function PlacementZoneOption({
  label,
  color,
  checked,
  onPress,
}: {
  label: string;
  color?: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: checked }}
      className="flex-row items-center gap-two py-two px-one active:opacity-70">
      {color ? (
        <View className="w-[10px] h-[10px] rounded-pill" style={{ backgroundColor: color }} />
      ) : (
        <View className="w-[10px] h-[10px]" />
      )}
      <Txt variant="body" className="flex-1">
        {label}
      </Txt>
      {checked ? <Txt tone="success">✓</Txt> : null}
    </Pressable>
  );
}

/** Compatibility adapter for the old snapshot-shaped field props. */
export type LegacyCategoryFieldProps = {
  label?: string;
  categoryId: StoredPlacementZoneId | null;
  source: CategorySource | null;
  categoryOrder?: readonly string[] | null;
  onSelectCategory: (categoryId: PlacementZoneId) => void;
  onReset: () => void;
};

export function LegacyCategoryField({
  categoryId,
  source,
  onSelectCategory,
  onReset,
  categoryOrder,
  label,
}: LegacyCategoryFieldProps) {
  const normalizedZoneId = normalizePlacementZoneIdNullable(categoryId);
  const selection: PlacementZoneSelection =
    source === 'user'
      ? { mode: 'manual', zoneId: normalizedZoneId ?? 'other' }
      : { mode: 'automatic' };

  return (
    <PlacementZoneField
      label={label}
      selection={selection}
      effectiveZoneId={normalizedZoneId}
      categoryOrder={categoryOrder}
      onSelectionChange={({ zoneId }) => onSelectCategory(zoneId)}
      onSelectAutomatic={onReset}
    />
  );
}
