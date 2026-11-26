import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Surface, Txt } from '@/constants/ui';

export type ComponentCategory = 'surfaces' | 'controls' | 'feedback';

const styles = StyleSheet.create((theme) => ({
  container: {
    padding: theme.space.lg,
  },
  stack: {
    gap: theme.space.sm,
  },
}));

export function ComponentsShowcase({ category }: { category: ComponentCategory }) {
  const { t } = useTranslation();

  return (
    <Surface tone="soft" style={styles.container}>
      <View style={styles.stack}>
        <Txt variant="heading">{t('dev.design.components.webTitle')}</Txt>
        <Txt tone="secondary">{t('dev.design.components.webHint')}</Txt>
        <Txt variant="caption" tone="secondary">
          {t('dev.design.components.categoryValue', { category })}
        </Txt>
      </View>
    </Surface>
  );
}
