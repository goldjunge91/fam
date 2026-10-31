import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import type React from 'react';
import { i18n } from '@/i18n';
import { RowStorePicker } from './row-store-picker';

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  const View = React.forwardRef<
    {
      measureInWindow: (
        callback: (x: number, y: number, width: number, height: number) => void,
      ) => void;
    },
    React.ComponentProps<typeof Native.View>
  >((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      measureInWindow: (callback) => callback(12, 24, 200, 44),
    }));
    return React.createElement(Native.View, props);
  });
  return new Proxy(
    {},
    {
      get: (_target, key: keyof typeof Native) => (key === 'View' ? View : Native[key]),
    },
  );
});

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({
    data: [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe',
        color: '#E53E3E',
        sort_order: 0,
        category_order: null,
      },
      {
        id: 'store-2',
        household_id: 'hh-1',
        name: 'Aldi',
        color: '#3182CE',
        sort_order: 1,
        category_order: null,
      },
    ],
    isLoading: false,
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Der RN-View-Mock liefert für `measureInWindow` eine feste Position, damit
// das Öffnen des Menüs im Test deterministisch geprüft werden kann.
describe('RowStorePicker', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('zeigt "Ohne Markt" wenn storeId null ist', async () => {
    await render(<RowStorePicker householdId="hh-1" storeId={null} onChange={jest.fn()} />, {
      wrapper,
    });

    const trigger = screen.getByRole('button', { name: /Ohne Markt/ });
    expect(trigger).toBeOnTheScreen();
    expect(trigger).toHaveStyle({ minHeight: 44 });
  });

  it('zeigt den Namen des zugewiesenen Markts', async () => {
    await render(<RowStorePicker householdId="hh-1" storeId="store-1" onChange={jest.fn()} />, {
      wrapper,
    });
    expect(screen.getByText('Rewe')).toBeOnTheScreen();
  });

  it('faellt auf "Markt wählen" zurueck, wenn storeId zu keinem geladenen Markt passt', async () => {
    await render(<RowStorePicker householdId="hh-1" storeId="unbekannt" onChange={jest.fn()} />, {
      wrapper,
    });
    expect(screen.getByText('Markt wählen')).toBeOnTheScreen();
  });

  it('zeigt statt des Store-Namens das optionale label, wenn gesetzt (Bulk-Aktion)', async () => {
    // #342: derselbe Dropdown-Mechanismus dient auch als Bulk-Trigger
    // ("Allen einen Markt zuweisen") statt einer Zeilen-Anzeige.
    await render(
      <RowStorePicker
        householdId="hh-1"
        storeId="store-1"
        label="Allen einen Markt zuweisen"
        onChange={jest.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText('Allen einen Markt zuweisen')).toBeOnTheScreen();
    expect(screen.queryByText('Rewe')).not.toBeOnTheScreen();
  });

  it('öffnet das Menü und weist den ausgewählten Markt zu', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    await render(<RowStorePicker householdId="hh-1" storeId={null} onChange={onChange} />, {
      wrapper,
    });

    await user.press(screen.getByRole('button', { name: 'Markt wählen, aktuell: Ohne Markt' }));
    await user.press(screen.getByText('Rewe'));

    expect(onChange).toHaveBeenCalledWith('store-1');
    expect(screen.queryByText('Rewe')).not.toBeOnTheScreen();
  });
});
