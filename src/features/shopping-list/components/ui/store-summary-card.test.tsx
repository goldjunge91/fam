import { fireEvent, render, screen } from '@testing-library/react-native';

import { StoreSummaryCard } from './store-summary-card';

describe('StoreSummaryCard', () => {
  it('zeigt die Marktfarbe als kräftigen Kartenakzent', async () => {
    await render(
      <StoreSummaryCard
        name="REWE"
        color="#B5623F"
        totalCount={3}
        checkedCount={1}
        totalEstimate={8.4}
        openCategoryColors={['#748C5B']}
        onPress={jest.fn()}
      />,
    );

    const card = screen.getByRole('button', { name: /REWE/ });
    expect(card).toHaveStyle({
      backgroundColor: '#B5623F16',
      borderColor: '#B5623F66',
      borderWidth: 1,
    });

    await fireEvent.press(card);
  });
});
