import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

export type InlineSelectOption = {
  value: string;
  label: string;
  icon?: string;
  /** Zeigt die Option an, aber deaktiviert sie (z. B. noch nicht gebaute Filter). */
  disabled?: boolean;
  /** Kurzer Hinweistext neben einer deaktivierten Option, z. B. "bald". */
  disabledHint?: string;
};

type InlineSelectProps = {
  value: string;
  options: readonly InlineSelectOption[];
  onChange: (value: string) => void;
  accessibilityLabel: string;
};

/**
 * Kompaktes Dropdown fuer 2-4 Optionen direkt unter einem Suchfeld (#Vorrat-
 * Redesign, angelehnt an die Einkaufen-Vorschlaege): ein Button mit
 * aktuellem Wert + Chevron, das Optionsfeld klappt darunter auf statt ein
 * natives Rad zu oeffnen (anders als `WheelPickerField`, das fuer feste,
 * laengere Listen gedacht ist).
 */
export function InlineSelect({ value, options, onChange, accessibilityLabel }: InlineSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View className="relative flex-1">
      <Pressable
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        className={`inline-select-btn ${open ? 'inline-select-btn-open' : ''}`}>
        <ThemedText type="small" numberOfLines={1} className="flex-1 font-bold">
          {selected?.icon ? `${selected.icon} ` : ''}
          {selected?.label ?? value}
        </ThemedText>
        <ThemedText themeColor="textSecondary" className="text-[10px]">
          {open ? '︿' : '⌄'}
        </ThemedText>
      </Pressable>

      {open ? (
        <View className="inline-select-panel">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                disabled={option.disabled}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: active, disabled: option.disabled }}
                className={`inline-select-option ${active ? 'inline-select-option-active' : ''} ${
                  option.disabled ? 'opacity-40' : ''
                }`}>
                <ThemedText
                  type="small"
                  themeColor={active ? 'onAccent' : 'text'}
                  numberOfLines={1}
                  className="font-semibold flex-1">
                  {option.icon ? `${option.icon} ` : ''}
                  {option.label}
                </ThemedText>
                {option.disabled && option.disabledHint ? (
                  <ThemedText type="caption" themeColor={active ? 'onAccent' : 'textSecondary'}>
                    {option.disabledHint}
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
