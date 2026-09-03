import type { Meta, StoryObj } from '@storybook/react-native';
import { EmptyState } from './empty-state';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EmptyInventory: Story = {
  args: {
    symbol: 'refrigerator',
    title: 'Noch nichts im Kühlschrank',
    hint: 'Scanne einen Barcode oder füge Artikel manuell hinzu.',
  },
};

export const EmptyShoppingList: Story = {
  args: {
    symbol: 'cart',
    title: 'Einkaufsliste ist leer',
    hint: 'Artikel aus dem Bestand oder Rezepten landen automatisch hier.',
  },
};

export const NoSearchResults: Story = {
  args: {
    symbol: 'magnifyingglass',
    title: 'Keine Treffer',
    hint: 'Versuch einen anderen Suchbegriff.',
  },
};
