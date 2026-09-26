import { useState } from 'react';
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
  testIDPrefix?: string;
};

export function ItemSourceFilterRow({
  source,
  onSourceChange,
  sourceAccessibilityLabel,
  suggestionFilter,
  onSuggestionFilterChange,
  suggestionAccessibilityLabel,
  testIDPrefix,
}: ItemSourceFilterRowProps) {
  const [openSelect, setOpenSelect] = useState<'source' | 'suggestion' | null>(null);

  const testID = (suffix: string) => (testIDPrefix ? `${testIDPrefix}-${suffix}` : undefined);

  return (
    <View style={styles.root}>
      <InlineSelect
        value={source}
        accessibilityLabel={sourceAccessibilityLabel}
        triggerTestID={testID('source-trigger')}
        open={openSelect === 'source'}
        onOpenChange={(open) => setOpenSelect(open ? 'source' : null)}
        options={[
          {
            value: 'food',
            label: 'Lebensmittel',
            icon: '🥕',
            testID: testID('source-food-option'),
          },
          {
            value: 'dish',
            label: 'Gerichte',
            icon: '🍽️',
            testID: testID('source-dish-option'),
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
        triggerTestID={testID('suggestion-trigger')}
        open={openSelect === 'suggestion'}
        onOpenChange={(open) => setOpenSelect(open ? 'suggestion' : null)}
        options={[
          {
            value: 'frequent',
            label: 'Häufig',
            icon: '🕘',
            testID: testID('suggestion-frequent-option'),
          },
          {
            value: 'recent',
            label: 'Zuletzt',
            icon: '🔁',
            testID: testID('suggestion-recent-option'),
          },
          {
            value: 'favorites',
            label: 'Favoriten',
            icon: '⭐',
            testID: testID('suggestion-favorites-option'),
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
