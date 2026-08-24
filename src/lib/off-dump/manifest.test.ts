import { fetchManifest, parseManifest } from './manifest';

const VALID_MANIFEST = {
  schemaVersion: 2,
  latestVersion: '2026-08-02T00:00:00.000Z',
  baseline: {
    version: '2026-08-01T00:00:00.000Z',
    url: 'https://example/baseline.db',
    size: 100,
    checksum: 'abc',
  },
  patches: [
    {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-02T00:00:00.000Z',
      url: 'https://example/patch.db',
      size: 10,
      checksum: 'def',
      upserts: 3,
      deletes: 1,
    },
  ],
};

describe('parseManifest', () => {
  it('akzeptiert ein vollständig gültiges Manifest', () => {
    expect(parseManifest(VALID_MANIFEST)).toEqual(VALID_MANIFEST);
  });

  it('akzeptiert ein Manifest ohne Patches (frische Baseline)', () => {
    const manifest = { ...VALID_MANIFEST, patches: [] };
    expect(parseManifest(manifest)).toEqual(manifest);
  });

  it.each([
    ['kein Objekt', null],
    ['kein Objekt (String)', 'kaputt'],
    ['schemaVersion fehlt', { ...VALID_MANIFEST, schemaVersion: undefined }],
    ['schemaVersion falscher Typ', { ...VALID_MANIFEST, schemaVersion: '2' }],
    ['latestVersion fehlt', { ...VALID_MANIFEST, latestVersion: undefined }],
    ['baseline fehlt', { ...VALID_MANIFEST, baseline: undefined }],
    [
      'baseline.version fehlt',
      { ...VALID_MANIFEST, baseline: { ...VALID_MANIFEST.baseline, version: undefined } },
    ],
    [
      'baseline.checksum fehlt',
      { ...VALID_MANIFEST, baseline: { ...VALID_MANIFEST.baseline, checksum: undefined } },
    ],
    ['patches kein Array', { ...VALID_MANIFEST, patches: 'kaputt' }],
    [
      'ein Patch-Eintrag ohne "to"',
      { ...VALID_MANIFEST, patches: [{ ...VALID_MANIFEST.patches[0], to: undefined }] },
    ],
  ])('lehnt ein ungültiges Manifest ab: %s', (_label, raw) => {
    expect(parseManifest(raw)).toBeNull();
  });
});

describe('parseManifest — Uebergangs-Kompatibilitaet zu Commit 106c18a', () => {
  // Vor 106c18a hiess das Asset-Feld `sha256` statt `checksum`. Bereits
  // veroeffentlichte GitHub-Release-Manifeste tragen bis zum naechsten
  // `update_dump.yml`-Lauf noch den alten Namen.
  const LEGACY_MANIFEST = {
    ...VALID_MANIFEST,
    baseline: { ...VALID_MANIFEST.baseline, checksum: undefined, sha256: 'abc' },
    patches: [{ ...VALID_MANIFEST.patches[0], checksum: undefined, sha256: 'def' }],
  };

  it('akzeptiert das alte `sha256`-Feld und normalisiert es auf `checksum`', () => {
    const parsed = parseManifest(LEGACY_MANIFEST);
    expect(parsed?.baseline.checksum).toBe('abc');
    expect(parsed?.patches[0]?.checksum).toBe('def');
  });

  it('bevorzugt `checksum`, falls beide Felder vorhanden sind', () => {
    const manifest = {
      ...VALID_MANIFEST,
      baseline: { ...VALID_MANIFEST.baseline, checksum: 'abc', sha256: 'veraltet' },
    };
    expect(parseManifest(manifest)?.baseline.checksum).toBe('abc');
  });
});

describe('fetchManifest', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lädt und parst ein gültiges Manifest', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => VALID_MANIFEST,
    }) as unknown as typeof fetch;

    expect(await fetchManifest('https://example/manifest.json')).toEqual(VALID_MANIFEST);
  });

  it('liefert null bei einer Nicht-2xx-Antwort statt zu werfen', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await fetchManifest('https://example/manifest.json')).toBeNull();
  });

  it('liefert null bei einem Netzwerkfehler statt zu werfen', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await fetchManifest('https://example/manifest.json')).toBeNull();
  });

  it('liefert null bei einem strukturell ungültigen Body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nonsense: true }),
    }) as unknown as typeof fetch;
    expect(await fetchManifest('https://example/manifest.json')).toBeNull();
  });
});
