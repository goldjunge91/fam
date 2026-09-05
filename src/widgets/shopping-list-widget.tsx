import { Button, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type ShoppingListWidgetProps = {
  openCount: number;
  nextItem?: string;
};

const ShoppingListWidgetLayout = (props: ShoppingListWidgetProps, environment: { widgetFamily: string }) => {
  'widget';

  const title = 'Einkaufsliste';
  const countLabel = props.openCount === 1 ? 'offener Artikel' : 'offene Artikel';

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack modifiers={[padding({ all: 16 }), background('#F8F4EF')]}> 
        <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#3D2A38')]}>{title}</Text>
        <Text modifiers={[font({ weight: 'bold', size: 34 }), foregroundStyle('#8B5E83')]}>{props.openCount}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle('#6D5A67')]}>{countLabel}</Text>
      </VStack>
    );
  }

  return (
    <HStack modifiers={[padding({ all: 16 }), background('#F8F4EF')]}> 
      <VStack>
        <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle('#3D2A38')]}>{title}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#6D5A67')]}>
          {props.nextItem ?? 'Keine offenen Artikel'}
        </Text>
      </VStack>
      <Text modifiers={[font({ weight: 'bold', size: 32 }), foregroundStyle('#8B5E83')]}>{props.openCount}</Text>
    </HStack>
  );
};

export const ShoppingListWidget = createWidget('ShoppingListWidget', ShoppingListWidgetLayout);

export type QuickAddShoppingWidgetProps = {
  articleName: string;
};

const QuickAddShoppingWidgetLayout = (
  props: QuickAddShoppingWidgetProps,
  _environment: { widgetFamily: string },
) => {
  'widget';

  return (
    <VStack modifiers={[padding({ all: 16 }), background('#F8F4EF')]}> 
      <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#3D2A38')]}>Schnell hinzufügen</Text>
      <Button label={`+ ${props.articleName}`} target="add-milk" />
    </VStack>
  );
};

export const QuickAddShoppingWidget = createWidget(
  'QuickAddShoppingWidget',
  QuickAddShoppingWidgetLayout,
);
