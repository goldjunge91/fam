import type { BetaPreviewItem, ParsedShoppingItem, RoutingDecision } from '../types';
import { getClarificationSummary, shouldBundleClarification } from './clarification';

function previewItem(
  itemId: string,
  kind: RoutingDecision['kind'],
  suggestionCount: number,
): BetaPreviewItem {
  const item: ParsedShoppingItem = {
    name: itemId,
    quantity: 1,
    unit: null,
    brand: null,
  };
  const suggestions = Array.from({ length: suggestionCount }, (_, index) => ({
    listId: `${itemId}-list-${index}`,
    listName: `Liste ${index + 1}`,
    confidence: 0.5,
  }));
  const routing: RoutingDecision =
    kind === 'resolved'
      ? {
          kind,
          item,
          listId: suggestions[0]?.listId ?? `${itemId}-list`,
          confidence: 0.95,
          bestMatch: suggestions[0] ?? {
            listId: `${itemId}-list`,
            listName: 'Liste',
            confidence: 0.95,
          },
          suggestions,
          needsClarification: false,
        }
      : {
          kind,
          item,
          listId: null,
          confidence: 0.5,
          bestMatch: suggestions[0] ?? null,
          suggestions,
          needsClarification: true,
        };

  return { itemId, item, routing, reviewState: 'pending' };
}

describe('clarification threshold', () => {
  it('bundles three unclear suggested articles when uncertainty reaches 30 percent', () => {
    const items = [
      previewItem('milch', 'uncertain', 1),
      previewItem('joghurt', 'conflict', 1),
      previewItem('kaese', 'uncertain', 1),
      previewItem('brot', 'resolved', 1),
      previewItem('saft', 'resolved', 1),
      previewItem('reis', 'resolved', 1),
      previewItem('oel', 'resolved', 1),
      previewItem('mehl', 'resolved', 1),
      previewItem('salz', 'resolved', 1),
      previewItem('pfeffer', 'resolved', 1),
    ];

    expect(getClarificationSummary(items)).toEqual({
      itemCount: 10,
      unclearItemCount: 3,
      suggestedUnclearItemCount: 3,
      uncertaintyRatio: 0.3,
      shouldBundle: true,
    });
    expect(shouldBundleClarification(items)).toBe(true);
  });

  it('does not bundle only because one item has several list choices', () => {
    const items = [
      previewItem('milch', 'uncertain', 3),
      previewItem('brot', 'resolved', 1),
      previewItem('saft', 'resolved', 1),
    ];

    expect(shouldBundleClarification(items)).toBe(false);
  });

  it('does not interrupt one or two article inputs', () => {
    expect(
      shouldBundleClarification([
        previewItem('milch', 'uncertain', 1),
        previewItem('brot', 'uncertain', 1),
      ]),
    ).toBe(false);
  });

  it('requires the uncertainty ratio in addition to three suggested articles', () => {
    const items = [
      previewItem('milch', 'uncertain', 1),
      previewItem('joghurt', 'uncertain', 1),
      previewItem('kaese', 'uncertain', 1),
      ...Array.from({ length: 8 }, (_, index) => previewItem(`sicher-${index}`, 'resolved', 1)),
    ];

    expect(shouldBundleClarification(items)).toBe(false);
  });
});
