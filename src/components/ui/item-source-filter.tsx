import { View } from 'react-native';

import { InlineSelect } from '@/components/ui/inline-select';

// `dish` bleibt deaktiviert, bis Produktsuche und Datenmodell Gerichte unterstuetzen.
export type ItemSource = 'food' | 'dish';

export type SuggestionFilter = 'frequent' | 'recent' | 'favorites';

type ItemSourceFilterRowProps = {
  source: ItemSource;
  onSourceChange: (source: ItemSource) => void;
  sourceAccessibilityLabel: string;
  suggestionFilter: SuggestionFilter;
  onSuggestionFilterChange: (filter: 'frequent' | 'recent') => void;
  suggestionAccessibilityLabel: string;
};

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
