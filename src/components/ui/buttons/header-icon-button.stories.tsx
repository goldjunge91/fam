import type { Meta, StoryObj } from '@storybook/react-native';
import { fn } from 'storybook/test';
import { FilterIcon, SearchIcon } from '@/components/icons/fam-icon';
import { useTheme } from '@/hooks/use-theme';
import { HeaderIconButton } from './header-icon-button';

const meta = {
  title: 'UI/Buttons/HeaderIconButton',
  component: HeaderIconButton,
  // children: null nur zur Typerfuellung -- render() liefert das echte Icon,
  // die Args-Type-Inferenz bekommt so keinen JSX-Baum zum Rekursieren.
  args: { onPress: fn(), children: null },
} satisfies Meta<typeof HeaderIconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

// children als JSX gehoert nicht in args (siehe widget-row/jiggle-wrapper): Storybooks
// Args-Type-Inferenz rekursiert sonst in Fiber-/Context-Referenzen und crasht beim Start.
export const Search: Story = {
  args: { label: 'Suchen' },
  render: function SearchRender(args) {
    const theme = useTheme();
    return (
      <HeaderIconButton {...args}>
        <SearchIcon color={theme.text} />
      </HeaderIconButton>
    );
  },
};

export const Filter: Story = {
  args: { label: 'Filtern' },
  render: function FilterRender(args) {
    const theme = useTheme();
    return (
      <HeaderIconButton {...args}>
        <FilterIcon color={theme.text} />
      </HeaderIconButton>
    );
  },
};
