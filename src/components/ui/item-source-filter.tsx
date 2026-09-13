import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { space } from '@/components/theme/index';
import { InlineSelect } from '@/components/ui/inline-select';

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    gap: space.sm,
  },
});

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

export function ItemSourceFilterRow({
  source,
  onSourceChange,
  sourceAccessibilityLabel,
  suggestionFilter,
  onSuggestionFilterChange,
  suggestionAccessibilityLabel,
}: ItemSourceFilterRowProps) {
  return (
    <View style={styles.root}>
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
