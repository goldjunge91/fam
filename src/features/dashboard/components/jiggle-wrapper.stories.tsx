import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { fn } from 'storybook/test';
import { ThemedText } from '@/components/theme/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { withAlpha } from '@/constants/theme';
import type { CardSize } from '@/features/dashboard/registry';
import { useTheme } from '@/hooks/use-theme';
import { JiggleWrapper } from './jiggle-wrapper';

// Nachgebaut aus einer echten Dashboard-Card (z.B. ExpiryDashboardCard), damit die
// Story so aussieht wie eine echte Karte auf dem Dashboard statt eines grauen Platzhalters.
function DemoWidgetCard({ size }: { size: CardSize }) {
  const theme = useTheme();
  const glassStyle = { borderRadius: 28, padding: 16, gap: 8 };

  if (size === 'large') {
    return (
      <GlassCard
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel="Demo-Karte"
        fallbackClassName="dashboard-planned-card"
        glassStyle={{ ...glassStyle, flexDirection: 'column' as const }}
        outerStyle={{
          height: 140,
          borderRadius: 28,
          borderCurve: 'continuous',
          boxShadow: `0 8px 22px ${withAlpha(theme.shadowCard, 0.1)}`,
        }}>
        <View className="flex-row items-center gap-three">
          <View className="dashboard-widget-badge bg-accent/20">
            <ThemedText type="smallBold" themeColor="accent">
              3
            </ThemedText>
          </View>
          <ThemedText type="smallBold">Beispiel-Karte</ThemedText>
        </View>
        <View className="flex-1 justify-center gap-[2px]">
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Eintrag A
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Eintrag B
          </ThemedText>
        </View>
        <ThemedText type="smallBold" className="dashboard-widget-action">
          Öffnen
        </ThemedText>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel="Demo-Karte"
      fallbackClassName="dashboard-widget"
      glassStyle={glassStyle}
      outerStyle={{
        width: '100%',
        height: 138,
        borderRadius: 28,
        borderCurve: 'continuous',
        boxShadow: `0 8px 20px ${withAlpha(theme.shadowCard, 0.08)}`,
      }}>
      <View className="dashboard-widget-badge bg-accent/20">
        <ThemedText type="smallBold" themeColor="accent">
          3
        </ThemedText>
      </View>
      <View className="flex-1" />
      <ThemedText type="small" themeColor="textSecondary" className="dashboard-widget-label">
        Beispiel-Karte
      </ThemedText>
      <ThemedText type="smallBold" className="dashboard-widget-action">
        Öffnen
      </ThemedText>
    </GlassCard>
  );
}

const meta = {
  title: 'Dashboard/JiggleWrapper',
  component: JiggleWrapper,
  args: {
    id: 'demo-card',
    index: 0,
    totalCards: 1,
    onToggleSize: fn(),
    onDelete: fn(),
  },
  argTypes: {
    size: {
      options: ['large', 'small'],
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof JiggleWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Static: Story = {
  args: {
    isEditing: false,
    size: 'large',
    // children: null nur zur Typerfuellung -- render() liefert den echten Inhalt.
    children: null,
  },
  // children als JSX in args statt render() lässt Storybooks Args-Type-Inferenz
  // (Controls-Addon) in Fiber-/Context-Referenzen rekursieren und crashen.
  render: (args) => <JiggleWrapper {...args}>{<DemoWidgetCard size="large" />}</JiggleWrapper>,
};

export const EditModeWackeln: Story = {
  storyName: 'Edit-Modus (wackelnd, mit Badges)',
  args: {
    isEditing: true,
    size: 'large',
    children: null,
  },
  render: (args) => <JiggleWrapper {...args}>{<DemoWidgetCard size="large" />}</JiggleWrapper>,
};

export const EditModeSmall: Story = {
  storyName: 'Edit-Modus, klein',
  args: {
    isEditing: true,
    size: 'small',
  },
  render: (args) => (
    <View style={{ width: 160, height: 138 }}>
      <JiggleWrapper {...args}>
        <DemoWidgetCard size="small" />
      </JiggleWrapper>
    </View>
  ),
};
