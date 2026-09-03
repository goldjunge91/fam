import type { Meta, StoryObj } from '@storybook/react-native';
import { fn } from 'storybook/test';
import { ThemedText } from '@/components/theme/themed-text';
import { GlassCard } from './glass-card';

const meta = {
  title: 'UI/GlassCard',
  component: GlassCard,
  args: {
    onPress: fn(),
    accessibilityRole: 'button',
    accessibilityLabel: 'Demo-Karte',
    fallbackClassName: 'dashboard-widget',
    glassStyle: { borderRadius: 28, padding: 16, gap: 8 },
    // children: null nur zur Typerfuellung -- render() liefert den echten Inhalt.
    children: null,
  },
} satisfies Meta<typeof GlassCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// children als JSX gehoert nicht in args (siehe widget-row/jiggle-wrapper): Storybooks
// Args-Type-Inferenz rekursiert sonst in Fiber-/Context-Referenzen und crasht beim Start.
export const Default: Story = {
  render: (args) => (
    <GlassCard {...args} outerStyle={{ width: 200, height: 138, borderRadius: 28 }}>
      <ThemedText type="smallBold">Ablaufend</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        3 Artikel
      </ThemedText>
    </GlassCard>
  ),
};
