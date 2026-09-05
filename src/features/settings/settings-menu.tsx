import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

type SettingsGroupProps = {
  title?: string;
  children: ReactNode;
};

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const { colors } = useTheme();

  return (
    <View className="gap-one">
      {title ? (
        <Txt variant="caption" tone="secondary" className="settings-group-title" weight="700">
          {title.toUpperCase()}
        </Txt>
      ) : null}
      <View className="settings-group-body" style={{ backgroundColor: colors.surface }}>
        {children}
      </View>
    </View>
  );
}

type SettingsRowProps = {
  /** Kurzes Emoji links. Bewusst kein Icon-Set — das Projekt hat keines. */
  icon?: string;
  label: string;
  /** Aktueller Wert oder kurze Erlaeuterung, rechts bzw. unter dem Label. */
  value?: string;
  hint?: string;
  onPress?: () => void;
  /** Faerbt das Label — fuer Abmelden und andere Aktionen mit Folgen. */
  tone?: 'default' | 'danger';
  /** Letzte Zeile einer Gruppe: keine Trennlinie darunter. */
  last?: boolean;
  disabled?: boolean;
};

export function SettingsRow({
  icon,
  label,
  value,
  hint,
  onPress,
  tone = 'default',
  last = false,
  disabled = false,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const isNavigable = Boolean(onPress) && !disabled;

  const content = (
    <View
      className={`settings-row ${disabled ? 'settings-row-disabled' : ''}`}
      style={{
        borderBottomColor: colors.border,
        borderBottomWidth: last ? 0 : 1,
        opacity: disabled ? 0.45 : 1,
      }}>
      {icon ? (
        <View className="settings-icon-tile">
          <Txt variant="body" center>
            {icon}
          </Txt>
        </View>
      ) : null}

      <View className="settings-label-block">
        <Txt variant="body" tone={tone === 'danger' ? 'danger' : 'primary'}>
          {label}
        </Txt>
        {hint ? (
          <Txt variant="caption" tone="secondary">
            {hint}
          </Txt>
        ) : null}
      </View>

      {value ? (
        <Txt
          variant="caption"
          tone="secondary"
          numberOfLines={1}
          className="flex-shrink text-right max-w-[45%]">
          {value}
        </Txt>
      ) : null}

      {isNavigable ? (
        <Txt variant="title" tone="secondary">
          ›
        </Txt>
      ) : null}
    </View>
  );

  if (!isNavigable) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      className="active:opacity-60">
      {content}
    </Pressable>
  );
}
