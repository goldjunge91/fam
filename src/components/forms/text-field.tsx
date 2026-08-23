import type { ReactNode } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  size?: 'default' | 'large';
  error?: string;
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
  const theme = useTheme();

  return (
    <View className="gap-one">
      {label ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          className={size === 'large' ? 'text-body' : ''}>
          {label}
        </ThemedText>
      ) : null}

      <View className="relative">
        <TextInput
          {...rest}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={label || rest.placeholder}
          accessibilityHint={error}
          className={`input-field ${
            error ? 'input-field-error' : ''
          } ${size === 'large' ? 'text-body-lg' : ''} ${trailing ? 'pr-[52px]' : ''} ${className}`.trim()}
          style={style}
        />
        {trailing ? (
          <View className="absolute z-10 right-[2px] top-[2px] bottom-[2px] items-center justify-center">
            {trailing}
          </View>
        ) : null}
      </View>

      {error ? (
        <ThemedText
          type="small"
          themeColor="danger"
          className={size === 'large' ? 'text-body' : ''}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
