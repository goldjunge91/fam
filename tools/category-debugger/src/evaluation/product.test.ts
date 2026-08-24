import { describe, expect, it } from 'vitest';
import { canonicalProductSnapshot, evaluationProductOf, parseCategoryTags, splitForHash } from './product';

describe('evaluation products', () => {
  it('normalisiert den Snapshot und sortiert OFF-Tags deterministisch', () => {
    const snapshot = canonicalProductSnapshot({
      code: ' 4000000000001 ',
      product_name: '  Apfelmus ',
      brand: ' Beispiel ',
      quantity: '',
      categories_tags: '["en:compotes","en:applesauces"]',
    });

    expect(JSON.parse(snapshot)).toEqual({
      barcode: '4000000000001',
      name: 'Apfelmus',
      brand: 'Beispiel',
      quantity: null,
      categoryTags: ['en:applesauces', 'en:compotes'],
    });
    expect(parseCategoryTags('kein json')).toEqual([]);
  });

  it('leitet Produktidentitaet und 80/20-Split stabil aus dem Inhalt ab', async () => {
    const input = {
      code: '4000000000001',
      product_name: 'Apfelmus',
      brand: null,
      quantity: null,
      categories_tags: '["en:compotes"]',
    };
    const first = await evaluationProductOf(input);
    const second = await evaluationProductOf(input);

    expect(first).toEqual(second);
    expect(first.productKey).toBe('barcode:4000000000001');
    expect(first.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(['calibration', 'holdout']).toContain(first.split);
    expect(splitForHash('00000000')).toBe('holdout');
    expect(splitForHash('00000001')).toBe('calibration');
  });
});
