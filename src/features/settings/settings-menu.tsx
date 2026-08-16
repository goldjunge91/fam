import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Menuezeilen fuer die Einstellungen.
 *
 * Die Einstellungen waren eine einzige lange Seite, auf der Anzeige, Aktion
 * und Formular durcheinanderliefen. Hier ist die Uebersicht nur noch ein
 * Verzeichnis: eine Zeile je Thema, das Thema selbst liegt auf einer eigenen
 * Seite. Was auf der Uebersicht bleibt, ist der aktuelle Wert rechts — damit
 * man das Wichtigste sieht, ohne irgendwo hineinzugehen.
 */

type SettingsGroupProps = {
  title?: string;
  children: ReactNode;
};

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <View style={styles.group}>
      {title ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
          {title.toUpperCase()}
        </ThemedText>
      ) : null}
      <ThemedView type="backgroundElement" style={styles.groupBody}>
        {children}
      </ThemedView>
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
  const theme = useTheme();
  const isNavigable = Boolean(onPress) && !disabled;

  const content = (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        disabled && styles.disabled,
      ]}>
      {icon ? (
        <View style={[styles.iconTile, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.icon}>{icon}</ThemedText>
        </View>
      ) : null}

      <View style={styles.labelBlock}>
        <ThemedText themeColor={tone === 'danger' ? 'danger' : 'text'}>{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>

      {value ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </ThemedText>
      ) : null}

      {isNavigable ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.chevron}>
          ›
        </ThemedText>
      ) : null}
    </View>
  );

  if (!isNavigable) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.one,
  },
  groupTitle: {
    paddingHorizontal: Spacing.two,
    letterSpacing: 0.5,
  },
  groupBody: {
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    ...FontSize[14],
    textAlign: 'center',
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  value: {
    flexShrink: 1,
    maxWidth: '45%',
    textAlign: 'right',
  },
  chevron: {
    ...FontSize[20],
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.5,
  },
});
