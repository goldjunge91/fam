import {
  buildCategoryFeedbackPayload,
  type CategoryFeedbackInput,
  categoryFeedbackMutation,
} from './feedback';

const baseInput: CategoryFeedbackInput = {
  eventId: 'event-1',
  eventType: 'manual_reassign',
  inputMethod: 'edit_form',
  householdId: 'household-1',
  actorUserId: 'user-1',
  shoppingListItemId: 'item-1',
  productId: null,
  productName: '  Hafermilch  ',
  storeId: 'store-1',
  preferenceScope: 'store',
  oldPlacementZone: 'ambient_milk_drinks',
  newPlacementZone: 'chilled_plant_based',
  predictedPlacementZone: 'ambient_milk_drinks',
  oldCategorySource: 'name_fallback',
  newCategorySource: 'store_preference',
  predictedProductFamily: 'plant_drink',
  predictedProductForm: 'ambient',
  classifierVersion: 'placement-v2.0.0',
  platform: 'ios',
  appVersion: '1.0.0',
  buildChannel: 'development',
  clientCreatedAt: '2026-08-24T05:00:00.000Z',
};

describe('category feedback contract', () => {
  it('builds the canonical barcode payload with store scope', () => {
    const payload = buildCategoryFeedbackPayload({ ...baseInput, barcode: '4006381333931' });

    expect(payload).toMatchObject({
      schema_version: 1,
      taxonomy_version: 'placement-taxonomy-v2',
      product_key_type: 'barcode',
      product_key: '4006381333931',
      barcode: '4006381333931',
      product_name: 'Hafermilch',
      store_id: 'store-1',
      preference_scope: 'store',
    });
  });

  it('uses normalized product name when no product id or barcode exists', () => {
    const payload = buildCategoryFeedbackPayload({
      ...baseInput,
      storeId: null,
      preferenceScope: 'household',
    });

    expect(payload).toMatchObject({
      product_key_type: 'name',
      product_key: 'hafermilch',
      product_id: null,
      barcode: null,
      store_id: null,
      preference_scope: 'household',
    });
  });

  it('treats an empty barcode as absent and falls back to product id or name', () => {
    expect(
      buildCategoryFeedbackPayload({
        ...baseInput,
        barcode: '   ',
        productId: 'product-1',
      }),
    ).toMatchObject({
      product_key_type: 'product',
      product_key: 'product-1',
      barcode: null,
    });

    expect(
      buildCategoryFeedbackPayload({
        ...baseInput,
        barcode: '',
        storeId: null,
        preferenceScope: 'household',
      }),
    ).toMatchObject({
      product_key_type: 'name',
      product_key: 'hafermilch',
      barcode: null,
    });
  });

  it('rejects invalid scope and unchanged manual assignments', () => {
    expect(() => buildCategoryFeedbackPayload({ ...baseInput, storeId: null })).toThrow(
      'Store-Präferenz',
    );

    expect(() =>
      buildCategoryFeedbackPayload({
        ...baseInput,
        oldPlacementZone: 'bakery',
        newPlacementZone: 'bakery',
      }),
    ).toThrow('unterschiedliche');
  });

  it('creates a push-only mutation with the event id as entity id', () => {
    const mutation = categoryFeedbackMutation(baseInput);

    expect(mutation).toMatchObject({
      entity: 'shopping_category_feedback_events',
      entityId: 'event-1',
      op: 'insert',
    });
  });
});
