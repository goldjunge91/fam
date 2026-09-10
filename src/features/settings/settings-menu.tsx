import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card, Txt } from '@/constants/ui';

type SettingsGroupProps = {
  title?: string;
  children: ReactNode;
};

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.group}>
      {title ? (
        <Txt variant="caption" tone="secondary" style={styles.groupTitle} weight="700">
          {title.toUpperCase()}
        </Txt>
      ) : null}
      <Card
        padded={false}
        elevation="sm"
        style={[styles.groupBody, { backgroundColor: colors.surface }]}>
        {children}
      </Card>
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
      style={[
        styles.row,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          opacity: disabled ? 0.45 : 1,
        },
      ]}>
      {icon ? (
        <View style={[styles.iconTile, { backgroundColor: colors.backgroundSoft }]}>
          <Txt variant="body" center>
            {icon}
          </Txt>
        </View>
      ) : null}

      <View style={styles.labelBlock}>
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
        <Txt variant="caption" tone="secondary" numberOfLines={1} style={styles.value}>
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
      style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: space.xs,
  },
  groupTitle: {
    paddingHorizontal: space.sm,
    letterSpacing: 0.5,
  },
  groupBody: {
    borderRadius: radius.famLarge,
    paddingHorizontal: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.lg,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBlock: {
    flex: 1,
    gap: space.xs / 2,
  },
  value: {
    flexShrink: 1,
    maxWidth: '45%',
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.6,
  },
});
