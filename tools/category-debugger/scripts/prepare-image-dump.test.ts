import { describe, expect, it } from 'vitest';
import { extractManifestImages } from './image-manifest';

describe('extractManifestImages', () => {
  it('uses OFF selected image metadata instead of the lowest raw image id', () => {
    const result = extractManifestImages({
      code: '4058172433801',
      lc: 'de',
      selected_images: {
        front: {
          display: {
            de: 'https://images.openfoodfacts.org/images/products/405/817/243/3801/front_de.15.400.jpg',
          },
        },
        ingredients: {
          display: {
            de: 'https://images.openfoodfacts.org/images/products/405/817/243/3801/ingredients_de.7.400.jpg',
          },
        },
      },
      images: {
        front_de: { imgid: '4', rev: '15' },
        ingredients_de: { imgid: '2', rev: '7' },
        1: { sizes: { 400: { h: 400, w: 186 } } },
      },
    });

    expect(result).toEqual({
      code: '4058172433801',
      images: [
        {
          kind: 'front',
          language: 'de',
          imgid: '4',
          selectedUrl: 'https://images.openfoodfacts.org/images/products/405/817/243/3801/front_de.15.400.jpg',
          awsUrl: 'https://images.openfoodfacts.org/images/products/405/817/243/3801/front_de.15.400.jpg',
          localPath: 'selected-400/405/817/243/3801/front_de.15.400.jpg',
        },
        {
          kind: 'ingredients',
          language: 'de',
          imgid: '2',
          selectedUrl: 'https://images.openfoodfacts.org/images/products/405/817/243/3801/ingredients_de.7.400.jpg',
          awsUrl: 'https://images.openfoodfacts.org/images/products/405/817/243/3801/ingredients_de.7.400.jpg',
          localPath: 'selected-400/405/817/243/3801/ingredients_de.7.400.jpg',
        },
      ],
    });
  });

  it('prefers German, then the product language, English and a stable fallback', () => {
    const german = extractManifestImages({
      code: '12345678',
      lc: 'fr',
      selected_images: {
        front: { display: { en: 'https://images.openfoodfacts.org/en.jpg', fr: 'https://images.openfoodfacts.org/fr.jpg', de: 'https://images.openfoodfacts.org/de.jpg' } },
      },
      images: { front_de: { imgid: '8' } },
    });
    const productLanguage = extractManifestImages({
      code: '12345679',
      lc: 'fr',
      selected_images: {
        front: { display: { en: 'https://images.openfoodfacts.org/en.jpg', fr: 'https://images.openfoodfacts.org/fr.jpg' } },
      },
      images: { front_fr: { imgid: '4' } },
    });

    expect(german?.images[0]).toMatchObject({ language: 'de', imgid: '8' });
    expect(productLanguage?.images[0]).toMatchObject({ language: 'fr', imgid: '4' });
  });

  it('supports wrapped API-shaped products and rejects unsafe image URLs', () => {
    const result = extractManifestImages({
      product: {
        code: '1234567890123',
        selected_images: {
          front: { display: { de: 'https://evilopenfoodfacts.org/not-off.jpg' } },
          nutrition: { display: { en: 'https://images.openfoodfacts.org/nutrition_en.2.400.jpg' } },
        },
        images: { nutrition_en: { imgid: '9' } },
      },
    });

    expect(result).toMatchObject({ code: '1234567890123' });
    expect(result?.images).toEqual([
      expect.objectContaining({ kind: 'nutrition', language: 'en', imgid: '9' }),
    ]);
  });

  it('reconstructs selected crop URLs from the images metadata used by the JSONL dump', () => {
    const result = extractManifestImages({
      code: '0000140323687',
      lc: 'fr',
      images: {
        1: { sizes: { 400: { h: 400, w: 336 } } },
        front_fr: {
          imgid: '1',
          rev: '4',
          sizes: { 100: { h: 100, w: 84 }, 400: { h: 400, w: 336 } },
        },
        ingredients_fr: {
          imgid: '2',
          rev: '7',
          sizes: { 200: { h: 115, w: 200 }, 400: { h: 229, w: 400 } },
        },
      },
    });

    expect(result?.images).toEqual([
      expect.objectContaining({
        kind: 'front',
        language: 'fr',
        imgid: '1',
        selectedUrl: 'https://images.openfoodfacts.org/images/products/000/014/032/3687/front_fr.4.400.jpg',
      }),
      expect.objectContaining({
        kind: 'ingredients',
        language: 'fr',
        imgid: '2',
        selectedUrl: 'https://images.openfoodfacts.org/images/products/000/014/032/3687/ingredients_fr.7.400.jpg',
      }),
    ]);
  });
});
