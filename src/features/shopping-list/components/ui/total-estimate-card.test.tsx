import { render, screen } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { TotalEstimateCard } from './total-estimate-card';

describe('TotalEstimateCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('zeigt Gesamtsumme und Artikelzusammenfassung', async () => {
    await render(<TotalEstimateCard totalEstimate={12.5} itemCount={3} storeCount={2} />);

    expect(screen.getByText('Gesamtschätzung')).toBeOnTheScreen();
    expect(screen.getByText('12,50 €')).toBeOnTheScreen();
    expect(screen.getByText('3 Artikel in 2 Geschäften')).toBeOnTheScreen();
  });
});
