import type { ReactNode } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText, Typography } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  size?: 'default' | 'large';
  /** Fehlermeldung fuer genau dieses Feld — nicht fuer das ganze Formular. */
  error?: string;
  /** Interaktive Aktion innerhalb des Felds, z. B. Scanner oder Löschen. */
  trailing?: ReactNode;
};

export function TextField({
  label,
  size = 'default',
  error,
  trailing,
  style,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={size === 'large' && styles.largeSupportingText}>
          {label}
        </ThemedText>
      ) : null}

      <View style={styles.field}>
        <TextInput
          {...rest}
          placeholderTextColor={theme.textSecondary}
          // accessibilityLabel setzt das Label mit dem Feld in Beziehung; ohne das
          // liest ein Screenreader nur "Textfeld".
          accessibilityLabel={label || rest.placeholder}
          // Bei einem Fehler wird die Meldung mit vorgelesen, statt sie nur
          // farblich zu markieren.
          accessibilityHint={error}
          style={[
            styles.input,
            size === 'large' && styles.largeInput,
            trailing ? styles.inputWithTrailing : undefined,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: error ? theme.danger : theme.border,
            },
            style,
          ]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>

      {error ? (
        <ThemedText
          type="small"
          themeColor="danger"
          style={size === 'large' && styles.largeSupportingText}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  field: {
    position: 'relative',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    ...Typography.bodyRelaxed,
  },
  inputWithTrailing: {
    paddingRight: 52,
  },
  largeInput: {
    ...Typography.bodyLarge,
  },
  largeSupportingText: {
    ...Typography.body,
  },
  trailing: {
    position: 'absolute',
    zIndex: 1,
    right: 2,
    top: 2,
    bottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
