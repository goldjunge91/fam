import type { ReactNode } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { font } from '@/components/theme/index';
import { Txt } from '@/constants/ui';

type TextFieldProps = TextInputProps & {
  label?: string;
  size?: 'default' | 'large';
  /** Fehlermeldung fuer genau dieses Feld — nicht fuer das ganze Formular. */
  error?: string;
  /** Interaktive Aktion innerhalb des Felds, z. B. Scanner oder Löschen. */
  trailing?: ReactNode;
  className?: string;
};

export function TextField({
  label,
  size = 'default',
  error,
  trailing,
  style,
  className = '',
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();

  return (
    <View className="gap-one">
      {label ? (
        <Txt variant="label" tone="secondary">
          {label}
        </Txt>
      ) : null}

      <View className="relative">
        <TextInput
          {...rest}
          placeholderTextColor={colors.textSecondary}
          // accessibilityLabel setzt das Label mit dem Feld in Beziehung; ohne das
          // liest ein Screenreader nur "Textfeld".
          accessibilityLabel={label || rest.placeholder}
          // Bei einem Fehler wird die Meldung mit vorgelesen, statt sie nur
          // farblich zu markieren.
          accessibilityHint={error}
          className={`input-field ${
            error ? 'input-field-error' : ''
          } ${trailing ? 'pr-[52px]' : ''} ${className}`.trim()}
          style={[
            {
              color: colors.text,
              fontSize: size === 'large' ? font.sizes.bodyLarge : font.sizes.base,
              lineHeight: size === 'large' ? font.lineHeights.bodyLarge : font.lineHeights.body,
            },
            style,
          ]}
        />
        {trailing ? (
          <View className="absolute z-10 right-[2px] top-[2px] bottom-[2px] items-center justify-center">
            {trailing}
          </View>
        ) : null}
      </View>

      {error ? (
        <Txt variant="bodySmall" tone="danger">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
