import { describe, expect, it } from 'vitest';
import { extractManifestImages } from './image-manifest-v2';

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

  /**
   * Regression fuer den aktuellen OFF-Export (Stichprobe 2026-08): `images`
   * traegt jetzt `selected.<kind>.<language>` statt der flachen
   * `<kind>_<language>`-Keys, kein `selected_images` mehr auf Produktebene.
   * Fixture ist ein echter (gekuerzter) Datensatz aus dem Bulk-Dump — die
   * daraus gebaute URL wurde gegen images.openfoodfacts.org verifiziert
   * (HTTP 200, image/jpeg).
   */
  it('liest das aktuelle verschachtelte OFF-Schema (images.selected.<kind>.<language>)', () => {
    const result = extractManifestImages({
      code: '0000204286484',
      images: {
        uploaded: {
          1: {
            sizes: { full: { w: 500, h: 333 }, 400: { w: 400, h: 266 }, 100: { w: 100, h: 67 } },
            uploader: 'allfitnessfactory-de',
            uploaded_t: '1483099987',
          },
        },
        selected: {
          front: {
            de: {
              rev: '3',
              generation: {},
              sizes: { full: { h: 333, w: 500 }, 400: { w: 400, h: 266 }, 200: { h: 133, w: 200 }, 100: { w: 100, h: 67 } },
              imgid: '1',
            },
          },
          ingredients: {},
        },
      },
    });

    expect(result?.images).toEqual([
      expect.objectContaining({
        kind: 'front',
        language: 'de',
        imgid: '1',
        selectedUrl: 'https://images.openfoodfacts.org/images/products/000/020/428/6484/front_de.3.400.jpg',
      }),
    ]);
  });

  it('bevorzugt das verschachtelte Schema, faellt aber auf das flache zurueck, wenn nur dieses vorliegt', () => {
    const nested = extractManifestImages({
      code: '11111111',
      images: { selected: { front: { de: { rev: '9', imgid: '1', sizes: { 400: {} } } } } },
    });
    const flat = extractManifestImages({
      code: '22222222',
      images: { front_de: { rev: '2', imgid: '3', sizes: { 400: {} } } },
    });

    expect(nested?.images[0]).toMatchObject({ language: 'de', imgid: '1' });
    expect(flat?.images[0]).toMatchObject({ language: 'de', imgid: '3' });
  });
});
