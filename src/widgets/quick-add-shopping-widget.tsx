import { Link, Text, VStack } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

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
      <Link label={props.articleName} destination="fam:///shopping-list-add-item" />
    </VStack>
  );
};

export default createWidget('QuickAddShoppingWidget', QuickAddShoppingWidgetLayout);
