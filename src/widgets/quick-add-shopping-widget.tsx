import { Link, Text, VStack } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { getWidgetTheme } from '@/components/theme';

export type QuickAddShoppingWidgetProps = {
  articleName: string;
};

const QuickAddShoppingWidgetLayout = (
  props: QuickAddShoppingWidgetProps,
  environment: Pick<WidgetEnvironment, 'colorScheme' | 'widgetFamily'>,
) => {
  'widget';

  const { colors, spacing, typography } = getWidgetTheme(environment.colorScheme);

  return (
    <VStack modifiers={[padding({ all: spacing.inset }), background(colors.background)]}>
      <Text
        modifiers={[
          font({ weight: 'bold', size: typography.title }),
          foregroundStyle(colors.title),
        ]}>
        Schnell hinzufügen
      </Text>
      <Link label={props.articleName} destination="fam:///shopping-list-add-item" />
    </VStack>
  );
};

export default createWidget('QuickAddShoppingWidget', QuickAddShoppingWidgetLayout);
