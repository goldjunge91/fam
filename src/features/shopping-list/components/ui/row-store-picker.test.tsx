import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import { RowStorePicker } from './row-store-picker';

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

// Das Dropdown misst seine Position beim Oeffnen per `measureInWindow`
// (siehe row-store-picker.tsx, gleicher Mechanismus wie
// store-picker-menu.tsx) — im RNTL-Testrenderer feuert die native Bridge
// dafuer nie zurueck, das eigentliche Oeffnen ist damit hier nicht
// abbildbar (gilt ebenso fuer store-picker-menu.tsx, siehe
// store-picker.test.tsx). Getestet wird daher der Trigger-Zustand: welche
// Beschriftung/welcher Markt je nach `storeId` angezeigt wird.
describe('RowStorePicker', () => {
  it('zeigt "Ohne Markt" wenn storeId null ist', async () => {
    await render(<RowStorePicker householdId="hh-1" storeId={null} onChange={jest.fn()} />, {
      wrapper,
    });
    expect(screen.getByText('Ohne Markt')).toBeOnTheScreen();
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
});
