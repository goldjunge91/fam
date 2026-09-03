import type { Meta, StoryObj } from '@storybook/react-native';
import { fn } from 'storybook/test';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from './card';

const meta = {
  title: 'UI/Card',
  component: Card,
  // children: null nur zur Typerfuellung -- render() liefert den echten Inhalt,
  // die Args-Type-Inferenz bekommt so keinen JSX-Baum zum Rekursieren.
  args: { children: null },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

// children/footer als JSX gehoert nicht in args (siehe widget-row/jiggle-wrapper):
// Storybooks Args-Type-Inferenz rekursiert sonst in Fiber-/Context-Referenzen und crasht.
export const Basic: Story = {
  render: () => (
    <Card title="Haushalt">
      <ThemedText type="small" themeColor="textSecondary">
        3 Mitglieder, 2 offene Einladungen
      </ThemedText>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card
      title="Einkaufsliste"
      footer={
        <ThemedText type="caption" themeColor="textSecondary">
          Zuletzt aktualisiert vor 5 Minuten
        </ThemedText>
      }>
      <ThemedText type="small">12 Artikel offen</ThemedText>
    </Card>
  ),
};

export const Pressable: Story = {
  render: () => (
    <Card title="Rezept des Tages" onPress={fn()}>
      <ThemedText type="small" themeColor="textSecondary">
        Antippen für Details
      </ThemedText>
    </Card>
  ),
};
