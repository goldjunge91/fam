import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WidgetRow } from './widget-row';

// Nachgebaut aus einer echten Dashboard-Card (z.B. ExpiryDashboardCard, small), damit
// die Story so aussieht wie eine echte Zeile auf dem Dashboard statt grauer Platzhalter.
function DemoWidgetCard({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <GlassCard
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={label}
      fallbackClassName="dashboard-widget"
      glassStyle={{ borderRadius: 28, padding: 16, gap: 8 }}
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
        {label}
      </ThemedText>
      <ThemedText type="smallBold" className="dashboard-widget-action">
        Öffnen
      </ThemedText>
    </GlassCard>
  );
}

const meta = {
  title: 'Dashboard/WidgetRow',
  component: WidgetRow,
} satisfies Meta<typeof WidgetRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TwoSmallCards: Story = {
  // children als JSX in args statt render() lässt Storybooks Args-Type-Inferenz
  // (Controls-Addon) in Fiber-/Context-Referenzen rekursieren und crashen.
  render: () => (
    <WidgetRow>
      <DemoWidgetCard label="Karte 1" />
      <DemoWidgetCard label="Karte 2" />
    </WidgetRow>
  ),
};

export const SingleCardWithEmptySlot: Story = {
  render: () => (
    <WidgetRow>
      <DemoWidgetCard label="Karte 1" />
      <View style={{ flex: 1 }} />
    </WidgetRow>
  ),
};
