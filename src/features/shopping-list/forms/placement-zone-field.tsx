import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius } from '@/components/theme/index';
import { Button, Press, Txt } from '@/constants/ui';
import { debugLog } from '@/lib/observability/debug-log';
import {
  normalizePlacementOrder,
  normalizePlacementZoneIdNullable,
  PLACEMENT_ZONES,
  type PlacementZoneId,
  placementZoneForId,
  type StoredPlacementZoneId,
} from '../classification/placement-taxonomy';
import type { CategorySource } from '../classification/types';

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundElement,
  },
  dot: {
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: radius.xs,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.space.lg,
    backgroundColor: theme.scrim,
  },
  sheet: {
    gap: theme.space.lg,
    padding: theme.space.lg,
    borderRadius: theme.radius.famLarge,
    backgroundColor: theme.background,
  },
  options: {
    gap: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  optionSelected: {
    backgroundColor: theme.backgroundSoft,
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
  },
}));

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

/** Form field for the V2 placement taxonomy. Persistence belongs to the form save handler. */
export function PlacementZoneField({
  label,
  selection,
  effectiveZoneId = null,
  categoryOrder,
  onSelectionChange,
  onSelectAutomatic,
}: PlacementZoneFieldProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('shoppingList.placementZoneField.defaultLabel');
  const [isOpen, setIsOpen] = useState(false);
  const visibleZoneId = selection.mode === 'manual' ? selection.zoneId : effectiveZoneId;
  const zone = placementZoneForId(visibleZoneId);
  const zoneLabel =
    zone?.label ??
    (selection.mode === 'automatic'
      ? t('shoppingList.placementZoneField.automatic')
      : t('shoppingList.placementZoneField.other'));
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
    <View style={styles.root}>
      <Txt variant="body" tone="secondary">
        {resolvedLabel}
      </Txt>
      <Press
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('shoppingList.placementZoneField.changeAccessibility', {
          label: resolvedLabel,
          zone: zoneLabel,
        })}
        style={styles.field}>
        {zone ? <View style={[styles.dot, { backgroundColor: zone.color }]} /> : null}
        <View style={styles.flex}>
          <Txt variant="body" numberOfLines={1}>
            {zoneLabel}
          </Txt>
        </View>
        <Txt tone="secondary">⌄</Txt>
      </Press>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Txt variant="heading" weight="700">
              {resolvedLabel}
            </Txt>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.options}>
              <PlacementZoneOption
                label={t('shoppingList.placementZoneField.automatic')}
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
            <Button
              title={t('shoppingList.placementZoneField.close')}
              variant="secondary"
              onPress={() => setIsOpen(false)}
            />
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
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: checked }}
      haptic="selection"
      style={[styles.option, checked && styles.optionSelected]}>
      {color ? (
        <View style={[styles.dot, { backgroundColor: color }]} />
      ) : (
        <View style={styles.dot} />
      )}
      <Txt variant="body" style={styles.optionLabel}>
        {label}
      </Txt>
      {checked ? <Txt tone="success">✓</Txt> : null}
    </Press>
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
