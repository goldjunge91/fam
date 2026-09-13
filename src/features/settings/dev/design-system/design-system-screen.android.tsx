import { useState } from 'react';
import { View } from 'react-native';
import { KeyboardToolbar } from 'react-native-keyboard-controller';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { FilterChipBar, type FilterChipOption } from '@/components/ui/filter-chip-bar';
import { Badge, Txt } from '@/constants/ui';
import { type ComponentCategory, ComponentsShowcase } from './showcase-components';
import { type FoundationCategory, FoundationsShowcase } from './showcase-foundations';
import { type PatternCategory, PatternsShowcase } from './showcase-patterns';

type ShowcaseCategory = FoundationCategory | ComponentCategory | PatternCategory;

const CATEGORIES = [
  { value: 'theme', label: 'Theme' },
  { value: 'colors', label: 'Farben' },
  { value: 'typography', label: 'Typografie' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'surfaces', label: 'Flächen' },
  { value: 'controls', label: 'Bedienung' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'screens', label: 'Screens' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'accessibility', label: 'Zustände' },
] as const satisfies readonly FilterChipOption<ShowcaseCategory>[];

const FOUNDATION_CATEGORIES: readonly ShowcaseCategory[] = [
  'theme',
  'colors',
  'typography',
  'tokens',
];

const COMPONENT_CATEGORIES: readonly ShowcaseCategory[] = ['surfaces', 'controls', 'feedback'];

const styles = StyleSheet.create((theme) => ({
  screenContent: {
    gap: theme.space.xl,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
}));

function isFoundation(category: ShowcaseCategory): category is FoundationCategory {
  return FOUNDATION_CATEGORIES.includes(category);
}

function isComponent(category: ShowcaseCategory): category is ComponentCategory {
  return COMPONENT_CATEGORIES.includes(category);
}

export function DesignSystemScreen() {
  const [category, setCategory] = useState<ShowcaseCategory>('theme');
  const { mode } = useTheme();
  const categoryIndex = CATEGORIES.findIndex((item) => item.value === category) + 1;

  return (
    <>
      <Screen
        title="Design-System"
        subtitle="Lebende Referenz mit Vertragsbeispielen"
        back={{ label: 'Entwickler', href: '/settings/dev' }}
        backStyle="icon"
        contentStyle={styles.screenContent}>
        <View style={styles.categoryRow}>
          <Txt variant="caption" tone="secondary">
            Kategorie {categoryIndex} von {CATEGORIES.length}
          </Txt>
          <Badge label={mode === 'dark' ? 'Dunkel' : 'Hell'} tone="saved" />
        </View>

        <FilterChipBar
          label="Design-System-Kategorie"
          options={CATEGORIES}
          selected={category}
          onSelect={setCategory}
        />

        {isFoundation(category) ? (
          <FoundationsShowcase category={category} />
        ) : isComponent(category) ? (
          <ComponentsShowcase category={category} />
        ) : (
          <PatternsShowcase category={category} />
        )}
      </Screen>
      <KeyboardToolbar>
        <KeyboardToolbar.Done text="Fertig" />
      </KeyboardToolbar>
    </>
  );
}
