import { View } from 'react-native';

import { InlineSelect } from '@/components/ui/inline-select';

/**
 * Quelle eines gesuchten/hinzuzufuegenden Artikels. "Gerichte" (Rezepte als
 * Vorrats- bzw. Tagebuch-Eintrag) ist im Dropdown sichtbar, aber bewusst
 * deaktiviert — der Datenbezug (nur Name uebernehmen vs. echte Rezept-
 * Verknuepfung) ist noch offen, s. Migrations-/Redesign-Absprache. Nicht
 * ohne Ruecksprache aktivieren.
 */
export type ItemSource = 'food' | 'dish';

/** "Favoriten" ist im Dropdown sichtbar, aber app-weit noch nicht gebaut. */
export type SuggestionFilter = 'frequent' | 'recent' | 'favorites';

type ItemSourceFilterRowProps = {
  source: ItemSource;
  onSourceChange: (source: ItemSource) => void;
  sourceAccessibilityLabel: string;
  suggestionFilter: SuggestionFilter;
  onSuggestionFilterChange: (filter: 'frequent' | 'recent') => void;
  suggestionAccessibilityLabel: string;
};

/**
 * Dropdown-Paar ueber Vorschlagslisten beim Hinzufuegen eines Artikels:
 * links die Quelle (Lebensmittel/Gerichte), rechts der Vorschlagsfilter
 * (Haeufig/Zuletzt/Favoriten). Gemeinsam fuer Vorrat (add-item-screen.tsx)
 * und Tagebuch (food-search-screen.tsx) — beide Filter wirken auf jeweils
 * eigene Datenquellen des Aufrufers, nur die Auswahl-UI ist geteilt (#164).
 */
export function ItemSourceFilterRow({
  source,
  onSourceChange,
  sourceAccessibilityLabel,
  suggestionFilter,
  onSuggestionFilterChange,
  suggestionAccessibilityLabel,
}: ItemSourceFilterRowProps) {
  return (
    <View className="flex-row gap-two">
      <InlineSelect
        value={source}
        accessibilityLabel={sourceAccessibilityLabel}
        options={[
          { value: 'food', label: 'Lebensmittel', icon: '🥕' },
          {
            value: 'dish',
            label: 'Gerichte',
            icon: '🍽️',
            disabled: true,
            disabledHint: 'bald',
          },
        ]}
        onChange={(next) => {
          if (next === 'food' || next === 'dish') onSourceChange(next);
        }}
      />
      <InlineSelect
        value={suggestionFilter}
        accessibilityLabel={suggestionAccessibilityLabel}
        options={[
          { value: 'frequent', label: 'Häufig', icon: '🕘' },
          { value: 'recent', label: 'Zuletzt', icon: '🔁' },
          {
            value: 'favorites',
            label: 'Favoriten',
            icon: '⭐',
            disabled: true,
            disabledHint: 'bald',
          },
        ]}
        onChange={(next) => {
          if (next === 'frequent' || next === 'recent') onSuggestionFilterChange(next);
        }}
      />
    </View>
  );
}
