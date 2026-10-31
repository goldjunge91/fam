import { render, screen, userEvent } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { BrochureFilterSheet } from './brochure-filter-sheet';

type FilterSheetProps = ComponentProps<typeof BrochureFilterSheet>;

const groups: FilterSheetProps['groups'] = [
  {
    id: 'groceries',
    label: 'Lebensmittel',
    stores: [
      { id: 'aldi-sued', name: 'Aldi Süd', logoUrl: null, active: true },
      { id: 'rewe', name: 'REWE', logoUrl: null, active: true },
    ],
  },
  {
    id: 'drugstore',
    label: 'Drogeriemarkt',
    stores: [{ id: 'dm', name: 'dm', logoUrl: null, active: true }],
  },
  {
    id: 'other',
    label: 'Weitere Märkte',
    stores: [{ id: 'unknown', name: 'Unbekannter Markt', logoUrl: null, active: true }],
  },
];

function createProps(overrides: Partial<FilterSheetProps> = {}): FilterSheetProps {
  return {
    visible: true,
    groups,
    selectedStoreIds: new Set(['aldi-sued', 'dm']),
    brochureCounts: new Map([
      ['aldi-sued', 4],
      ['rewe', 1],
      ['dm', 2],
    ]),
    resultCount: 5,
    onClose: jest.fn(),
    onReset: jest.fn(),
    onToggleGroup: jest.fn(),
    onToggleStore: jest.fn(),
    onApply: jest.fn(),
    ...overrides,
  };
}

async function renderFilterSheet(overrides: Partial<FilterSheetProps> = {}) {
  const props = createProps(overrides);
  await render(<BrochureFilterSheet {...props} />);
  return props;
}

describe('BrochureFilterSheet', () => {
  it('shows group states, store states, brochure counts, and the result action', async () => {
    await renderFilterSheet();

    expect(screen.getByText('Filter')).toBeOnTheScreen();
    expect(
      screen.getByRole('checkbox', { name: 'Lebensmittel, 1 von 2 Märkten' }),
    ).toBePartiallyChecked();
    expect(screen.getByRole('checkbox', { name: 'Drogeriemarkt, 1 von 1 Märkten' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Weitere Märkte, 0 von 1 Märkten' }),
    ).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Aldi Süd' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'REWE' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'dm' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Unbekannter Markt' })).not.toBeChecked();
    expect(screen.getByText('4')).toBeOnTheScreen();
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByText('0')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '5 Prospekte anzeigen' })).toBeEnabled();
  });

  it('reports the selected group and store when the user toggles either control', async () => {
    const props = await renderFilterSheet();
    const user = userEvent.setup();

    await user.press(screen.getByRole('checkbox', { name: 'Lebensmittel, 1 von 2 Märkten' }));
    await user.press(screen.getByRole('checkbox', { name: 'REWE' }));

    expect(props.onToggleGroup).toHaveBeenCalledWith(['aldi-sued', 'rewe']);
    expect(props.onToggleStore).toHaveBeenCalledWith('rewe');
  });

  it('offers reset and apply actions with the current result count', async () => {
    const props = await renderFilterSheet();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Zurücksetzen' }));
    await user.press(screen.getByRole('button', { name: '5 Prospekte anzeigen' }));

    expect(props.onReset).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledTimes(1);
  });

  it('closes from the backdrop without closing when sheet content is pressed', async () => {
    const props = await renderFilterSheet();
    const user = userEvent.setup();

    await user.press(screen.getByText('Filter'));
    expect(props.onClose).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Filter schließen' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not expose the sheet controls while it is hidden', async () => {
    await renderFilterSheet({ visible: false });

    expect(screen.queryByText('Filter')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeOnTheScreen();
  });
});
