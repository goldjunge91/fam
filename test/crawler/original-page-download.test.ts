import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { downloadOriginalImageBytes } from '../../tools/crawler/brochures/r2-storage';

describe('original brochure page download', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the fetched bytes unchanged for content hashing', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4]);
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(bytes));

    const downloaded = await downloadOriginalImageBytes('https://images.example/page-1.jpg');

    expect(Buffer.from(downloaded)).toEqual(Buffer.from(bytes));
    expect(createHash('sha256').update(Buffer.from(downloaded)).digest('hex')).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    expect(fetch).toHaveBeenCalledWith('https://images.example/page-1.jpg', {
      signal: expect.any(AbortSignal),
    });
  });
});
