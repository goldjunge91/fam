import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

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
    <View className="gap-one">
      {title ? (
        <ThemedText type="smallBold" themeColor="textSecondary" className="settings-group-title">
          {title.toUpperCase()}
        </ThemedText>
      ) : null}
      <ThemedView type="backgroundElement" className="settings-group-body">
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
  const isNavigable = Boolean(onPress) && !disabled;

  const content = (
    <View
      className={`settings-row ${!last ? 'settings-row-bordered' : ''} ${disabled ? 'settings-row-disabled' : ''}`}>
      {icon ? (
        <View className="settings-icon-tile">
          <ThemedText className="text-[14px] text-center">{icon}</ThemedText>
        </View>
      ) : null}

      <View className="settings-label-block">
        <ThemedText themeColor={tone === 'danger' ? 'danger' : 'text'}>{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>

      {value ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={1}
          className="flex-shrink text-right max-w-[45%]">
          {value}
        </ThemedText>
      ) : null}

      {isNavigable ? (
        <ThemedText type="small" themeColor="textSecondary" className="text-[20px] leading-[20px]">
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
      className="active:opacity-60">
      {content}
    </Pressable>
  );
}
