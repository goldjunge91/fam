import { render, screen, userEvent } from '@testing-library/react-native';

import { borderWidth } from '@/components/theme';
import { i18n } from '@/i18n';
import { StoreSummaryCard } from './store-summary-card';

jest.mock('@/lib/platform/haptics', () => ({
  heavy: jest.fn(),
  light: jest.fn(),
  medium: jest.fn(),
  selection: jest.fn(),
  success: jest.fn(),
}));

describe('StoreSummaryCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('zeigt die Marktfarbe als kräftigen Kartenakzent', async () => {
    const onPress = jest.fn();
    await render(
      <StoreSummaryCard
        name="REWE"
        color="#B5623F"
        totalCount={3}
        checkedCount={1}
        totalEstimate={8.4}
        openCategoryColors={['#748C5B']}
        onPress={onPress}
      />,
    );

    const card = screen.getByRole('button', { name: /REWE/ });
    expect(card).toHaveStyle({
      backgroundColor: '#B5623F16',
      borderColor: '#B5623F66',
      borderWidth: borderWidth.base,
      minHeight: 92,
    });

    await userEvent.setup().press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
