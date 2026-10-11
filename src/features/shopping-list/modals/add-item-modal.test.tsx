import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { i18n } from '@/i18n';
import { AddItemModal } from './add-item-modal';

const mockCloseSearch = jest.fn();

jest.mock('expo-image', () => {
  return { Image: () => null };
});

jest.mock('../forms/add-item-form', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  type MockFormProps = {
    householdId: string;
    initialStoreId: string | null;
    initialProduct: { name: string } | null;
    onDismiss: () => void;
    onItemAdded?: () => void;
  };

  return {
    AddItemForm: React.forwardRef(
      (props: MockFormProps, ref: React.ForwardedRef<{ closeSearch: () => void }>) => {
        React.useImperativeHandle(ref, () => ({ closeSearch: mockCloseSearch }), []);

        return React.createElement(
          View,
          null,
          React.createElement(Text, null, `${props.householdId}:${props.initialStoreId ?? 'none'}`),
          React.createElement(
            Pressable,
            {
              accessibilityRole: 'button',
              accessibilityLabel: 'Artikel hinzugefügt',
              onPress: props.onItemAdded,
            },
            React.createElement(Text, null, 'Formularaktion'),
          ),
        );
      },
    ),
  };
});

describe('AddItemModal', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
  });

  it('shows the form with default item options and forwards header and add actions', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const onItemAdded = jest.fn();

    await render(
      <AddItemModal
        visible
        householdId="household-1"
        onDismiss={onDismiss}
        onItemAdded={onItemAdded}
      />,
    );

    expect(screen.getByText('household-1:none')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Artikel hinzufügen'));
    expect(mockCloseSearch).toHaveBeenCalledTimes(1);

    await user.press(screen.getByRole('button', { name: 'Artikel hinzugefügt' }));
    await user.press(screen.getByRole('button', { name: 'Schließen' }));

    expect(onItemAdded).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render the form while hidden', async () => {
    await render(<AddItemModal visible={false} householdId="household-1" onDismiss={jest.fn()} />);

    expect(screen.queryByText('household-1:none')).not.toBeOnTheScreen();
  });
});
