import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { getWidgetTheme } from '@/components/theme';

export type ShoppingListWidgetProps = {
  openCount: number;
  nextItem?: string;
};

const ShoppingListWidgetLayout = (
  props: ShoppingListWidgetProps,
  environment: Pick<WidgetEnvironment, 'colorScheme' | 'widgetFamily'>,
) => {
  'widget';

  const { colors, spacing, typography } = getWidgetTheme(environment.colorScheme);

  const title = 'Einkaufsliste';
  const countLabel = props.openCount === 1 ? 'offener Artikel' : 'offene Artikel';

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack modifiers={[padding({ all: spacing.inset }), background(colors.background)]}>
        <Text
          modifiers={[
            font({ weight: 'bold', size: typography.title }),
            foregroundStyle(colors.title),
          ]}>
          {title}
        </Text>
        <Text
          modifiers={[
            font({ weight: 'bold', size: typography.count }),
            foregroundStyle(colors.accent),
          ]}>
          {props.openCount}
        </Text>
        <Text modifiers={[font({ size: typography.secondary }), foregroundStyle(colors.secondary)]}>
          {countLabel}
        </Text>
      </VStack>
    );
  }

  return (
    <HStack modifiers={[padding({ all: spacing.inset }), background(colors.background)]}>
      <VStack>
        <Text
          modifiers={[
            font({ weight: 'bold', size: typography.mediumTitle }),
            foregroundStyle(colors.title),
          ]}>
          {title}
        </Text>
        <Text
          modifiers={[
            font({ size: typography.mediumSecondary }),
            foregroundStyle(colors.secondary),
          ]}>
          {props.nextItem ?? 'Keine offenen Artikel'}
        </Text>
      </VStack>
      <Text
        modifiers={[
          font({ weight: 'bold', size: typography.count }),
          foregroundStyle(colors.accent),
        ]}>
        {props.openCount}
      </Text>
    </HStack>
  );
};

export default createWidget('ShoppingListWidget', ShoppingListWidgetLayout);
