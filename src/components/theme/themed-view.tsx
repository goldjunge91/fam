import { View, type ViewProps } from 'react-native';

// TODO: DELETE — maintainer removes this compatibility wrapper after the migration is reviewed.
import type { ThemeColor } from '@/components/theme/index';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  className?: string;
};

const BG_CLASS_MAP: Partial<Record<ThemeColor, string>> = {
  background: 'bg-background',
  backgroundElement: 'bg-background-element',
  backgroundSelected: 'bg-background-selected',
  accent: 'bg-accent',
  onAccent: 'bg-on-accent',
  border: 'bg-border',
  text: 'bg-text',
  textSecondary: 'bg-text-secondary',
  danger: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-success',
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  type = 'background',
  className = '',
  ...otherProps
}: ThemedViewProps) {
  const bgClass = BG_CLASS_MAP[type] ?? 'bg-background';

  return <View className={`${bgClass} ${className}`.trim()} style={style} {...otherProps} />;
}
