import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create } from 'react-test-renderer';

import { applyInventoryConsumptionPlan } from '@/features/inventory/apply-inventory-consumption';
import {
  confirmRecipeSuggestionCookReview,
  createRecipeSuggestionCookReview,
} from '../domain/recipe-suggestion-cook-review';
import { createRecipeSuggestionReview } from '../domain/recipe-suggestion-review';
import { useApplyRecipeSuggestionCookReviewMutation } from './use-recipe-suggestion-cook-review';

jest.mock('@/features/inventory/apply-inventory-consumption', () => ({
  applyInventoryConsumptionPlan: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

const suggestionReview = createRecipeSuggestionReview({
  schema_version: 1,
  meals: [
    {
      title: 'Kartoffel-Spinat-Pfanne',
      source: 'catalog',
      recipe_id: 'catalog-potato-spinach',
      servings: 2,
      used_items: [{ inventory_item_id: 'inventory-potatoes', quantity: 1, unit: 'kg' }],
      additional_ingredients: [],
      steps: ['Garen.'],
      notes: [],
    },
  ],
});

describe('useApplyRecipeSuggestionCookReviewMutation', () => {
  let queryClient: QueryClient;
  let mutation: ReturnType<typeof useApplyRecipeSuggestionCookReviewMutation> | undefined;

  function Harness() {
    mutation = useApplyRecipeSuggestionCookReviewMutation();
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  it('applies only the confirmed review and invalidates inventory and sync queries', async () => {
    const review = createRecipeSuggestionCookReview(suggestionReview, 0);
    if (review === null) throw new Error('expected review');
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    act(() => {
      create(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    if (!mutation) throw new Error('expected mutation');

    await act(async () => {
      await mutation?.mutateAsync({
        householdId: 'household-1',
        review: confirmRecipeSuggestionCookReview(review),
        inventory: [
          { id: 'inventory-potatoes', householdId: 'household-1', quantity: 2, unit: 'kg' },
        ],
      });
    });

    expect(applyInventoryConsumptionPlan).toHaveBeenCalledWith([
      {
        id: 'inventory-potatoes',
        household_id: 'household-1',
        delta: -1,
        operation: 'consume',
      },
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['fridge_items', 'household-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['fridge_items_grouped', 'household-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sync-status'] });
  });

  it('rejects an unconfirmed review before any inventory mutation', async () => {
    const review = createRecipeSuggestionCookReview(suggestionReview, 0);
    if (review === null) throw new Error('expected review');
    act(() => {
      create(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    if (!mutation) throw new Error('expected mutation');

    await act(async () => {
      await expect(
        mutation?.mutateAsync({
          householdId: 'household-1',
          review,
          inventory: [
            { id: 'inventory-potatoes', householdId: 'household-1', quantity: 2, unit: 'kg' },
          ],
        }),
      ).rejects.toMatchObject({ name: 'RecipeSuggestionCookReviewError' });
    });

    expect(applyInventoryConsumptionPlan).not.toHaveBeenCalled();
  });
});
