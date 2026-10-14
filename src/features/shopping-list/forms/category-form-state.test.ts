import { EMPTY_CATEGORY_STATE, isManualCategory } from './category-form-state';

describe('category form state', () => {
  it('starts without a selected category or classification source', () => {
    expect(EMPTY_CATEGORY_STATE).toEqual({
      categoryId: null,
      source: null,
      classifierVersion: null,
    });
  });

  it('identifies only user-selected categories as manual', () => {
    expect(isManualCategory('user')).toBe(true);
    expect(isManualCategory('name_fallback')).toBe(false);
    expect(isManualCategory(null)).toBe(false);
  });
});
