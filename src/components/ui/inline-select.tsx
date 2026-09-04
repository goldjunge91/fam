import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Txt } from '@/constants/ui';

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
        <Txt variant="body" weight="700" numberOfLines={1} className="flex-1">
          {selected?.icon ? `${selected.icon} ` : ''}
          {selected?.label ?? value}
        </Txt>
        <Txt variant="detail" tone="secondary">
          {open ? '︿' : '⌄'}
        </Txt>
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
                <Txt
                  variant="body"
                  weight="600"
                  tone={active ? 'onAccent' : 'primary'}
                  numberOfLines={1}
                  className="flex-1">
                  {option.icon ? `${option.icon} ` : ''}
                  {option.label}
                </Txt>
                {option.disabled && option.disabledHint ? (
                  <Txt variant="caption" tone={active ? 'onAccent' : 'secondary'}>
                    {option.disabledHint}
                  </Txt>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
