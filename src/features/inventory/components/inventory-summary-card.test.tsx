import { render, screen } from '@testing-library/react-native';

import { InventorySummaryCard } from './inventory-summary-card';

test('shows expiring, due soon, and total inventory counts', async () => {
  await render(<InventorySummaryCard totalCount={10} criticalCount={2} soonCount={3} />);

  expect(
    screen.getByLabelText('2 Artikel laufen bald ab, 3 bald fällig, 10 insgesamt im Vorrat'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Läuft bald ab')).toBeOnTheScreen();
  expect(screen.getByText('Bald fällig')).toBeOnTheScreen();
  expect(screen.getByText('2')).toBeOnTheScreen();
  expect(screen.getByText('3')).toBeOnTheScreen();
});
