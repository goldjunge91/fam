import { clearCards, type DashboardCardDef, getCards, registerCard } from './registry';

function card(id: string, order: number): DashboardCardDef {
  return { id, order, defaultSize: 'small', component: () => null };
}

describe('dashboard card registry', () => {
  beforeEach(() => clearCards());

  test('keeps cards ordered and ignores duplicate ids', () => {
    const later = card('later', 2);
    const earlier = card('earlier', 1);
    registerCard(later);
    registerCard(earlier);
    registerCard(card('later', 0));

    expect(getCards()).toEqual([earlier, later]);
  });
});
