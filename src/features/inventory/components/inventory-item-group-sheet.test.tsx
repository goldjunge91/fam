import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getExpiryInfo } from '@/features/inventory/expiry';
import { groupInventoryItems } from '@/features/inventory/grouped-items';
import type { LocalInventoryItem } from '@/features/inventory/use-inventory-items';
import { formatStateSubtitle, InventoryItemGroupSheet } from './inventory-item-group-sheet';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      accent: '#76566c',
      background: '#fffaf7',
      border: '#ddd',
      danger: '#b23',
      onDanger: '#fff',
      success: '#286',
      warning: '#a75',
    },
  }),
}));
jest.mock('@/hooks/use-sheet-shadow-style', () => ({ useSheetShadowStyle: () => ({}) }));

const today = new Date();
const expiration = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 12)
  .toISOString()
  .slice(0, 10);

function lot(id: string, overrides: Partial<LocalInventoryItem> = {}): LocalInventoryItem {
  return {
    id,
    household_id: 'household-1',
    location_id: 'pantry',
    product_id: 'product-1',
    name: 'Hafermilch',
    quantity: 1,
    unit: 'l',
    package_size: 1,
    package_size_unit: 'l',
    expiry_date: expiration,
    opened_at: null,
    added_by: 'user-1',
    created_at: '2026-10-01T00:00:00.000Z',
    location_kind: 'pantry',
    location_name: 'Vorrat',
    ...overrides,
  };
}

function testGroup(lots: LocalInventoryItem[]) {
  const [group] = groupInventoryItems(lots, today);
  if (!group) throw new Error('Expected inventory lots to form a group');
  return group;
}

function renderSheet(element: ReactNode) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      {element}
    </SafeAreaProvider>,
  );
}

describe('InventoryItemGroupSheet', () => {
  const originalPlatform = Platform.OS;

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('zeigt Android-MHD-Lose und ruft History, Lot-Auswahl und Close auf', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const user = userEvent.setup();
    const first = lot('lot-1');
    const second = lot('lot-2', { id: 'lot-2', opened_at: '2026-10-25T00:00:00.000Z' });
    const onSelectLot = jest.fn();
    const onHistory = jest.fn();
    const onClose = jest.fn();
    await renderSheet(
      <InventoryItemGroupSheet
        visible
        group={testGroup([first, second])}
        onClose={onClose}
        onSelectLot={onSelectLot}
        onHistory={onHistory}
      />,
    );

    expect(screen.getByText('Versiegelt')).toBeOnTheScreen();
    expect(screen.getByText('Geöffnet')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Hafermilch Verlauf öffnen' }));
    const lotButtons = screen.getAllByRole('button', { name: /Hafermilch, 1 L, MHD/ });
    const firstLotButton = lotButtons[0];
    if (!firstLotButton) throw new Error('Expected the first inventory lot button');
    await user.press(firstLotButton);
    await user.press(screen.getByRole('button', { name: 'Schließen' }));

    expect(onHistory).toHaveBeenCalledTimes(1);
    expect(onSelectLot).toHaveBeenCalledWith(first);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bietet auf iOS Quick-Open und Quick-Consume an und sperrt die laufende Aktion', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const user = userEvent.setup();
    const sealed = lot('sealed');
    const opened = lot('opened', { id: 'opened', opened_at: '2026-10-25T00:00:00.000Z' });
    const onQuickOpen = jest.fn();
    const onQuickConsume = jest.fn();
    const onSelectLot = jest.fn();
    const firstView = await renderSheet(
      <InventoryItemGroupSheet
        visible
        group={testGroup([sealed, opened])}
        onClose={jest.fn()}
        onSelectLot={onSelectLot}
        onHistory={jest.fn()}
        onQuickOpen={onQuickOpen}
        onQuickConsume={onQuickConsume}
        quickActionLoading
      />,
    );

    const consumeAction = screen.getByRole('button', { name: '1 L verbrauchen' });
    expect(consumeAction).toBeDisabled();
    await user.press(screen.getByRole('button', { name: /Versiegelt 1 L anzeigen/ }));
    expect(onSelectLot).toHaveBeenCalledWith(sealed);
    await firstView.unmount();

    const sealedView = await renderSheet(
      <InventoryItemGroupSheet
        visible
        group={testGroup([sealed])}
        onClose={jest.fn()}
        onSelectLot={onSelectLot}
        onHistory={jest.fn()}
        onQuickOpen={onQuickOpen}
      />,
    );
    await user.press(screen.getByRole('button', { name: '1 L öffnen' }));
    expect(onQuickOpen).toHaveBeenCalledWith(sealed);
    await sealedView.unmount();

    await renderSheet(
      <InventoryItemGroupSheet
        visible
        group={testGroup([opened])}
        onClose={jest.fn()}
        onSelectLot={onSelectLot}
        onHistory={jest.fn()}
        onQuickConsume={onQuickConsume}
      />,
    );
    await user.press(screen.getByRole('button', { name: '1 L verbrauchen' }));
    expect(onQuickConsume).toHaveBeenCalledWith(opened);
  });

  it('öffnet den Android-Konflikt und übergibt ihn zum Verwerfen', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const user = userEvent.setup();
    const conflictedLot = lot('conflict-lot');
    const conflict = {
      itemId: conflictedLot.id,
      sourceIds: [12],
      lastError: 'Bestand wurde geändert',
      correction: null,
    };
    const onDiscardConflict = jest.fn();
    await renderSheet(
      <InventoryItemGroupSheet
        visible
        group={testGroup([conflictedLot])}
        onClose={jest.fn()}
        onSelectLot={jest.fn()}
        onHistory={jest.fn()}
        conflictsByLotId={new Map([[conflictedLot.id, conflict]])}
        onDiscardConflict={onDiscardConflict}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Konflikt: Bestand wurde geändert/ }));
    expect(screen.getByText('Korrektur nicht übernommen')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(onDiscardConflict).toHaveBeenCalledWith(conflict);
  });

  it('bestätigt einen eindeutig zugeordneten Mengen-Konflikt erneut', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const user = userEvent.setup();
    const conflictedLot = lot('correctable-lot', {
      expiry_date: null,
      location_name: null,
      package_size: null,
      package_size_unit: null,
    });
    const conflict = {
      itemId: conflictedLot.id,
      sourceIds: [13],
      lastError: 'Bestand wurde geändert',
      correction: {
        operation_id: 'operation-1',
        transaction_id: 'transaction-1',
        item_id: conflictedLot.id,
        household_id: conflictedLot.household_id,
        expected_quantity: 1000,
        new_quantity: 500,
        created_at: '2026-10-26T12:00:00.000Z',
      },
    };
    const onReconfirmConflict = jest.fn();
    await renderSheet(
      <InventoryItemGroupSheet
        visible
        group={testGroup([conflictedLot])}
        onClose={jest.fn()}
        onSelectLot={jest.fn()}
        onHistory={jest.fn()}
        conflictsByLotId={new Map([[conflictedLot.id, conflict]])}
        onReconfirmConflict={onReconfirmConflict}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Konflikt: Bestand wurde geändert/ }));
    await user.press(screen.getByRole('button', { name: /Auf aktuellen Bestand neu bestätigen/ }));
    expect(onReconfirmConflict).toHaveBeenCalledWith(conflict);
  });

  it('fasst das früheste Ablaufdatum zusammen und beschreibt Lose ohne Datum', () => {
    expect(formatStateSubtitle([lot('no-date', { expiry_date: null })])).toBe('unbegrenzt haltbar');
    expect(formatStateSubtitle([lot('dated')])).toBe('noch 6 Tage');
    expect(formatStateSubtitle([])).toBe('unbegrenzt haltbar');
    expect(getExpiryInfo(null, today).bucket).toBe('none');
  });
});
