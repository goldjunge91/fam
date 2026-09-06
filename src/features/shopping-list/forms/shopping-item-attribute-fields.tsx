import { View } from 'react-native';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { TextField } from '@/constants/ui';
import { UNIT_OPTIONS } from '@/lib/units';
import type { PlacementZoneId } from '../classification/placement-taxonomy';
import { PACKAGE_SIZE_UNIT_OPTIONS } from './placement-form-helpers';
import { PlacementZoneField, type PlacementZoneSelection } from './placement-zone-field';

export interface ShoppingItemAttributeFieldsProps {
  unit: string;
  onUnitChange: (unit: string) => void;
  packageSizeInput: string;
  onPackageSizeInputChange: (input: string) => void;
  packageSizeUnit: string;
  onPackageSizeUnitChange: (unit: string) => void;
  price: string;
  onPriceChange: (price: string) => void;
  placementSelection: PlacementZoneSelection;
  effectiveZoneId: PlacementZoneId | null;
  categoryOrder?: string[];
  onSelectCategory: (zoneId: PlacementZoneId) => void;
  onSelectAutomatic: () => void;
  onInteraction?: () => void;
}

export function ShoppingItemAttributeFields({
  unit,
  onUnitChange,
  packageSizeInput,
  onPackageSizeInputChange,
  packageSizeUnit,
  onPackageSizeUnitChange,
  price,
  onPriceChange,
  placementSelection,
  effectiveZoneId,
  categoryOrder,
  onSelectCategory,
  onSelectAutomatic,
  onInteraction,
}: ShoppingItemAttributeFieldsProps) {
  return (
    <View className="gap-[10px] pb-one">
      <WheelPickerField
        label="Einheit"
        value={unit}
        options={UNIT_OPTIONS}
        onChange={(next) => {
          onInteraction?.();
          onUnitChange(next);
        }}
        size="large"
      />

      {unit === 'package' ? (
        <View className="flex-row items-end gap-two">
          <View className="flex-[1.3]">
            <TextField
              label="Inhalt je Packung"
              value={packageSizeInput}
              onChangeText={onPackageSizeInputChange}
              keyboardType="decimal-pad"
              placeholder="z. B. 500"
            />
          </View>
          <View className="flex-1">
            <WheelPickerField
              label="Einheit"
              value={packageSizeUnit}
              options={PACKAGE_SIZE_UNIT_OPTIONS}
              onChange={(next) => {
                onInteraction?.();
                onPackageSizeUnitChange(next);
              }}
              size="large"
            />
          </View>
        </View>
      ) : null}

      <PlacementZoneField
        selection={placementSelection}
        effectiveZoneId={effectiveZoneId}
        categoryOrder={categoryOrder}
        onSelectionChange={({ zoneId }) => onSelectCategory(zoneId)}
        onSelectAutomatic={onSelectAutomatic}
      />

      <TextField
        label="Geschätzter Preis (optional)"
        value={price}
        onChangeText={onPriceChange}
        keyboardType="decimal-pad"
        placeholder="z. B. 2,49 €"
        size="large"
        textAlignVertical="center"
      />
    </View>
  );
}
