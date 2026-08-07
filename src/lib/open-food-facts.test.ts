import { formatOFFProduct, parseQuantityAndUnit } from './open-food-facts';

describe('Open Food Facts Helper', () => {
  it('sollte Mengen und Einheiten korrekt parsen', () => {
    expect(parseQuantityAndUnit('500 g')).toEqual({ quantity: 500, unit: 'g' });
    expect(parseQuantityAndUnit('1.5 L')).toEqual({ quantity: 1.5, unit: 'l' });
    expect(parseQuantityAndUnit('1 kg')).toEqual({ quantity: 1, unit: 'kg' });
    expect(parseQuantityAndUnit('250 ml')).toEqual({ quantity: 250, unit: 'ml' });
    expect(parseQuantityAndUnit('1 Stück')).toEqual({ quantity: 1, unit: 'piece' });
    expect(parseQuantityAndUnit(undefined)).toEqual({ quantity: 1, unit: 'piece' });
  });

  it('sollte Open Food Facts Rohdaten ordentlich formatieren', () => {
    const raw = {
      code: '4008400401027',
      product_name_de: 'Hafermilch Barista',
      brands: 'Oatly, Oatly AB',
      categories: 'Pflanzliche Lebensmittel, Getränke',
      quantity: '1 L',
      image_front_small_url: 'https://images.openfoodfacts.org/1.jpg',
      nutriments: {
        'energy-kcal_100g': 59,
        proteins_100g: 1.1,
        carbohydrates_100g: 6.6,
        fat_100g: 3.0,
      },
    };

    const formatted = formatOFFProduct(raw);
    expect(formatted).toEqual({
      barcode: '4008400401027',
      name: 'Hafermilch Barista',
      brand: 'Oatly',
      category: 'Pflanzliche Lebensmittel',
      quantity: 1,
      unit: 'l',
      imageUrl: 'https://images.openfoodfacts.org/1.jpg',
      caloriesPer100g: 59,
      proteinsPer100g: 1.1,
      carbsPer100g: 6.6,
      fatPer100g: 3.0,
    });
  });

  it('sollte null zurückgeben wenn kein Produktname vorhanden ist', () => {
    expect(formatOFFProduct(null)).toBeNull();
    expect(formatOFFProduct({ product_name: '' })).toBeNull();
  });
});
