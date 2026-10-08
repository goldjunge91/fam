import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fetchImageSha256 } from '../../tools/crawler/brochures/r2-storage';

describe('canonical image identity hash', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hashes the original page bytes', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4]);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(bytes));

    await expect(fetchImageSha256('https://images.example/page-1.jpg')).resolves.toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
  });
});
