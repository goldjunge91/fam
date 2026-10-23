import { describe, expect, it } from '@jest/globals';
import {
  parseAllStoresFullArguments,
  partitionLocations,
  type BrochureLocation,
} from '../../tools/crawler/brochures/listing-only/all-stores-full';

const locations: BrochureLocation[] = [
  { zipCode: '30000', latitude: 3, longitude: 3 },
  { zipCode: '10000', latitude: 1, longitude: 1 },
  { zipCode: '20000', latitude: 2, longitude: 2 },
  { zipCode: '40000', latitude: 4, longitude: 4 },
  { zipCode: '50000', latitude: 5, longitude: 5 },
];

describe('full brochure listing scan shards', () => {
  it('partitions sorted ZIP locations deterministically without overlap or gaps', () => {
    const shards = [0, 1, 2, 3].map((shardIndex) =>
      partitionLocations(locations, shardIndex, 4).map(({ zipCode }) => zipCode),
    );

    expect(shards).toEqual([
      ['10000', '50000'],
      ['20000'],
      ['30000'],
      ['40000'],
    ]);
    expect(shards.flat().sort()).toEqual(locations.map(({ zipCode }) => zipCode).sort());
  });

  it('keeps the existing default output and requires a complete shard pair', () => {
    expect(parseAllStoresFullArguments([])).toEqual({
      outputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
    });
    expect(parseAllStoresFullArguments([
      '--shard-index=2',
      '--shard-count=4',
      '--output=fixtures/shard.json',
    ])).toEqual({ shardIndex: 2, shardCount: 4, outputPath: 'fixtures/shard.json' });
    expect(() => parseAllStoresFullArguments(['--shard-index=0'])).toThrow(
      '--shard-index and --shard-count are required together',
    );
  });
});
