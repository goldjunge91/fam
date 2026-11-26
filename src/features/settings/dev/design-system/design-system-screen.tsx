import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { KeyboardToolbar } from 'react-native-keyboard-controller';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { FilterChipBar, type FilterChipOption } from '@/components/ui/filter-chip-bar';
import { Badge, Txt } from '@/constants/ui';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { type ComponentCategory, ComponentsShowcase } from './showcase-components';
import { type FoundationCategory, FoundationsShowcase } from './showcase-foundations';
import { type ModalCategory, ModalsShowcase } from './showcase-modals';
import { type PatternCategory, PatternsShowcase } from './showcase-patterns';
import { type ReanimatedCategory, ReanimatedShowcase } from './showcase-reanimated';
import { ShadowsShowcase } from './showcase-shadows';

type ShowcaseCategory =
  | FoundationCategory
  | ComponentCategory
  | PatternCategory
  | ReanimatedCategory
  | ModalCategory
  | 'shadows';

const CATEGORIES = [
  { value: 'theme', labelKey: 'dev.design.categories.theme' },
  { value: 'colors', labelKey: 'dev.design.categories.colors' },
  { value: 'typography', labelKey: 'dev.design.categories.typography' },
  { value: 'tokens', labelKey: 'dev.design.categories.tokens' },
  { value: 'shadows', labelKey: 'dev.design.categories.shadows' },
  { value: 'surfaces', labelKey: 'dev.design.categories.surfaces' },
  { value: 'controls', labelKey: 'dev.design.categories.controls' },
  { value: 'feedback', labelKey: 'dev.design.categories.feedback' },
  { value: 'screens', labelKey: 'dev.design.categories.screens' },
  { value: 'hybrid', labelKey: 'dev.design.categories.hybrid' },
  { value: 'accessibility', labelKey: 'dev.design.categories.accessibility' },
  { value: 'reanimated', labelKey: 'dev.design.categories.reanimated' },
  { value: 'modal-comparison', labelKey: 'dev.design.categories.modalComparison' },
] as const satisfies ReadonlyArray<{
  value: ShowcaseCategory;
  labelKey: string;
}>;

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
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();
  const [category, setCategory] = useState<ShowcaseCategory>('theme');
  const { mode } = useTheme();
  const categoryIndex = CATEGORIES.findIndex((item) => item.value === category) + 1;
  const categoryOptions = CATEGORIES.map(({ value, labelKey }) => ({
    value,
    label: t(labelKey),
  })) as readonly FilterChipOption<ShowcaseCategory>[];

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <>
      <Screen
        title={t('dev.design.title')}
        subtitle={t('dev.design.subtitle')}
        back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
        backStyle="icon"
        contentStyle={styles.screenContent}>
        <View style={styles.categoryRow}>
          <Txt variant="caption" tone="secondary">
            {t('dev.design.categoryCount', { current: categoryIndex, total: CATEGORIES.length })}
          </Txt>
          <Badge
            label={mode === 'dark' ? t('dev.design.dark') : t('dev.design.light')}
            tone="saved"
          />
        </View>

        <FilterChipBar
          label={t('dev.design.categoryLabel')}
          options={categoryOptions}
          selected={category}
          onSelect={setCategory}
        />

        {category === 'shadows' ? (
          <ShadowsShowcase />
        ) : category === 'modal-comparison' ? (
          <ModalsShowcase />
        ) : category === 'reanimated' ? (
          <ReanimatedShowcase />
        ) : isFoundation(category) ? (
          <FoundationsShowcase category={category} />
        ) : isComponent(category) ? (
          <ComponentsShowcase category={category} />
        ) : (
          <PatternsShowcase category={category} />
        )}
      </Screen>
      <KeyboardToolbar>
        <KeyboardToolbar.Done text={t('common.done')} />
      </KeyboardToolbar>
    </>
  );
}
