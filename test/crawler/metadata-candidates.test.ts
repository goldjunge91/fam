import { describe, expect, it } from '@jest/globals';
import {
  buildMetadataCandidateIndex,
  buildMetadataCandidateReport,
  parseMetadataCandidateArguments,
  parseMetadataCandidateIndex,
  parsePage1HashesFromVerification,
} from '../../tools/crawler/brochures/listing-only/metadata-candidates';
import type { CanonicalGroup } from '../../tools/crawler/brochures/listing-only/group-canonical';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);

function makeGroups(validUntil = '2026-10-07'): CanonicalGroup[] {
  return [
    {
      storeName: 'Lidl',
      validFrom: '2026-10-01',
      validUntil,
      detailPageCount: 2,
      brns: ['brn-a', 'brn-b', 'brn-c'],
      availableZipCodes: ['10000', '10100'],
      sightingCount: 5,
    },
  ];
}

describe('listing-only metadata candidates', () => {
  it('uses local listing-only inputs and accepts explicit path overrides', () => {
    expect(parseMetadataCandidateArguments([])).toEqual({
      groupsPath: 'tools/crawler/data/listing-only/canonical-groups.json',
      page1VerificationPath: 'tools/crawler/data/listing-only/canonical-verification.json',
      previousIndexPath: 'tools/crawler/data/listing-only/metadata-candidate-index.json',
      indexOutputPath: 'tools/crawler/data/listing-only/metadata-candidate-index.json',
      reportOutputPath: 'tools/crawler/data/listing-only/metadata-candidate-report.json',
    });
    expect(
      parseMetadataCandidateArguments([
        '--groups=fixtures/groups.json',
        '--verification', 'fixtures/hashes.json',
        '--previous-index', 'fixtures/old-index.json',
        '--index-output', 'out/index.json',
        '--report-output', 'out/report.json',
      ]),
    ).toEqual({
      groupsPath: 'fixtures/groups.json',
      page1VerificationPath: 'fixtures/hashes.json',
      previousIndexPath: 'fixtures/old-index.json',
      indexOutputPath: 'out/index.json',
      reportOutputPath: 'out/report.json',
    });
  });

  it('extracts and validates page-1 hashes from the saved verification report', () => {
    expect(parsePage1HashesFromVerification({ byBrn: { 'brn-a': { sha256: hashA } } })).toEqual({
      'brn-a': hashA,
    });
    expect(() => parsePage1HashesFromVerification({ byBrn: { 'brn-a': {} } })).toThrow(
      'Page-1 SHA-256 for BRN brn-a must be a lowercase SHA-256 hex digest',
    );
  });

  it('selects a deterministic, bounded top-group pilot and only the representative cover bucket', () => {
    const groups: CanonicalGroup[] = [
      { ...makeGroups()[0]!, storeName: 'XXXLutz', sightingCount: 90, brns: ['brn-z', 'brn-a'] },
      { ...makeGroups()[0]!, storeName: 'Kaufland', sightingCount: 90, brns: ['brn-c', 'brn-b'] },
      { ...makeGroups()[0]!, storeName: 'REWE', sightingCount: 30, brns: ['brn-d'] },
      { ...makeGroups()[0]!, storeName: 'Lidl', sightingCount: 1000, brns: ['brn-e'] },
    ];
    const hashes = {
      'brn-a': hashA,
      'brn-z': hashA,
      'brn-b': hashB,
      'brn-c': hashC,
      'brn-d': hashA,
      'brn-e': hashA,
    };

    const report = buildMetadataCandidateReport(groups, hashes);

    expect(report.pilotSelection).toEqual({
      groupLimit: 32,
      selectedGroupCount: 3,
      representativeBrnCount: 3,
      representativePageCount: 6,
      fullVectorCandidateBrnCount: 4,
      fullVectorCandidatePageCount: 8,
      groups: [
        {
          storeName: 'Kaufland',
          validFrom: '2026-10-01',
          validUntil: '2026-10-07',
          detailPageCount: 2,
          sightingCount: 90,
          representativeBrn: 'brn-b',
          representativePage1Sha256: hashB,
          fullVectorCandidateBrns: ['brn-b'],
          fullVectorPageCount: 2,
        },
        {
          storeName: 'XXXLutz',
          validFrom: '2026-10-01',
          validUntil: '2026-10-07',
          detailPageCount: 2,
          sightingCount: 90,
          representativeBrn: 'brn-a',
          representativePage1Sha256: hashA,
          fullVectorCandidateBrns: ['brn-a', 'brn-z'],
          fullVectorPageCount: 4,
        },
        {
          storeName: 'REWE',
          validFrom: '2026-10-01',
          validUntil: '2026-10-07',
          detailPageCount: 2,
          sightingCount: 30,
          representativeBrn: 'brn-d',
          representativePage1Sha256: hashA,
          fullVectorCandidateBrns: ['brn-d'],
          fullVectorPageCount: 2,
        },
      ],
    });
  });

  it('keeps same-cover BRNs as full-vector candidates and distinct covers unverified', () => {
    const report = buildMetadataCandidateReport(makeGroups(), {
      'brn-a': hashA,
      'brn-b': hashA,
      'brn-c': hashB,
    });

    expect(report.identity.confirmed).toBe(false);
    expect(report.skippedFullPageDownloads).toBe(0);
    expect(report.fullVectorCandidateBrns).toEqual(['brn-a', 'brn-b']);
    expect(report.pageOneDistinctUnverifiedBrns).toEqual(['brn-c']);
    expect(report.groups[0]?.page1HashBuckets).toEqual([
      { page1Sha256: hashA, brns: ['brn-a', 'brn-b'] },
      { page1Sha256: hashB, brns: ['brn-c'] },
    ]);
  });

  it('treats a validity extension matching the previous family and cover as a candidate only', () => {
    const previousIndex = buildMetadataCandidateIndex(makeGroups('2026-10-07'), {
      'brn-a': hashA,
      'brn-b': hashA,
      'brn-c': hashB,
    });
    const report = buildMetadataCandidateReport(
      makeGroups('2026-10-14'),
      { 'brn-a': hashA, 'brn-b': hashA, 'brn-c': hashB },
      previousIndex,
    );

    expect(report.previousRun).toEqual({
      indexAvailable: true,
      candidates: [
        {
          brn: 'brn-a',
          classification: 'validity-extension',
          matchFamilyMatches: true,
          page1Matches: true,
          candidateOnly: true,
        },
        {
          brn: 'brn-b',
          classification: 'validity-extension',
          matchFamilyMatches: true,
          page1Matches: true,
          candidateOnly: true,
        },
        {
          brn: 'brn-c',
          classification: 'validity-extension',
          matchFamilyMatches: true,
          page1Matches: true,
          candidateOnly: true,
        },
      ],
    });
    expect(report.identity.confirmed).toBe(false);
    expect(report.skippedFullPageDownloads).toBe(0);
  });

  it('represents a missing previous index as a safe fallback and rejects corrupt indexes', () => {
    const hashes = { 'brn-a': hashA, 'brn-b': hashA, 'brn-c': hashC };
    const report = buildMetadataCandidateReport(makeGroups(), hashes);
    expect(report.previousRun).toEqual({ indexAvailable: false, candidates: [] });

    expect(() => parseMetadataCandidateIndex({ version: 2, byBrn: {} })).toThrow(
      'Metadata candidate index must have version 1 and a byBrn object',
    );
    expect(() =>
      parseMetadataCandidateIndex({
        version: 1,
        byBrn: { 'brn-a': { ...makeGroups()[0], page1Sha256: 'bad' } },
      }),
    ).toThrow('Metadata candidate index entry for BRN brn-a has an invalid shape');
  });

  it('rejects missing and invalid current original-byte hashes', () => {
    expect(() => buildMetadataCandidateReport(makeGroups(), { 'brn-a': hashA })).toThrow(
      'Missing page-1 SHA-256 for BRN brn-b',
    );
    expect(() =>
      buildMetadataCandidateReport(makeGroups(), {
        'brn-a': hashA,
        'brn-b': 'not-a-sha256',
        'brn-c': hashC,
      }),
    ).toThrow('Page-1 hash for BRN brn-b must be a lowercase SHA-256 hex digest');
  });

  it('builds and parses a deterministic per-BRN index round trip', () => {
    const groups = makeGroups();
    const hashes = { 'brn-c': hashC, 'brn-a': hashA, 'brn-b': hashB };
    const index = buildMetadataCandidateIndex(groups, hashes);

    expect(Object.keys(index.byBrn)).toEqual(['brn-a', 'brn-b', 'brn-c']);
    expect(parseMetadataCandidateIndex(index)).toEqual(index);
    expect(
      buildMetadataCandidateIndex([...groups].reverse(), {
        'brn-b': hashB,
        'brn-c': hashC,
        'brn-a': hashA,
      }),
    ).toEqual(index);
  });
});
