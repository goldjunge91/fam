import type { AssistantAttachmentInput } from '../types';
import { encodeAssistantAttachments } from './assistant-attachments';

const mockFiles = new Map<string, { exists: boolean; size: number; data: string; error?: Error }>();

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return mockFiles.get(this.uri)?.exists ?? false;
    }
    get size() {
      return mockFiles.get(this.uri)?.size;
    }
    async base64() {
      const error = mockFiles.get(this.uri)?.error;
      if (error) throw error;
      return mockFiles.get(this.uri)?.data ?? '';
    }
  },
}));

const input = (uri: string, name = ' Rezept.pdf '): AssistantAttachmentInput => ({
  uri,
  name,
  mimeType: 'application/pdf',
});

describe('encodeAssistantAttachments', () => {
  beforeEach(() => mockFiles.clear());

  it('returns no attachments for an empty selection and enforces the item limit', async () => {
    await expect(encodeAssistantAttachments([])).resolves.toEqual([]);
    await expect(
      encodeAssistantAttachments(Array.from({ length: 6 }, (_, i) => input(String(i)))),
    ).rejects.toThrow('Füge höchstens fünf Anhänge hinzu.');
  });

  it('rejects files that disappeared or exceed the single-file size limit', async () => {
    await expect(encodeAssistantAttachments([input('missing')])).rejects.toThrow(
      'Der ausgewählte Anhang ist nicht mehr verfügbar.',
    );
    mockFiles.set('oversized', { exists: true, size: 5_500_001, data: '' });
    await expect(encodeAssistantAttachments([input('oversized')])).rejects.toThrow(
      'Anhänge dürfen zusammen höchstens 8 MB groß sein.',
    );
  });

  it('measures the encoded payload before reading files so the gateway limit cannot be exceeded', async () => {
    mockFiles.set('one', { exists: true, size: 3_100_000, data: '' });
    mockFiles.set('two', { exists: true, size: 3_100_000, data: '' });

    await expect(encodeAssistantAttachments([input('one'), input('two')])).rejects.toThrow(
      'Anhänge dürfen zusammen höchstens 8 MB groß sein.',
    );
  });

  it('encodes an accepted file and bounds its display name', async () => {
    mockFiles.set('ok', { exists: true, size: 12, data: 'aGVsbG8=' });

    await expect(
      encodeAssistantAttachments([input('ok', ` ${'x'.repeat(110)} `)]),
    ).resolves.toEqual([
      { filename: 'x'.repeat(100), mimeType: 'application/pdf', data: 'aGVsbG8=' },
    ]);
  });

  it('rejects empty files', async () => {
    mockFiles.set('empty', { exists: true, size: 0, data: '' });
    await expect(encodeAssistantAttachments([input('empty')])).rejects.toThrow(
      'Anhänge dürfen zusammen höchstens 8 MB groß sein.',
    );
  });

  it('checks the actual encoded size and propagates local file read errors', async () => {
    mockFiles.set('unexpectedly-large', {
      exists: true,
      size: 3,
      data: 'x'.repeat(8_000_001),
    });
    await expect(encodeAssistantAttachments([input('unexpectedly-large')])).rejects.toThrow(
      'Anhänge dürfen zusammen höchstens 8 MB groß sein.',
    );

    mockFiles.set('read-error', {
      exists: true,
      size: 4,
      data: '',
      error: new Error('read failed'),
    });
    await expect(encodeAssistantAttachments([input('read-error')])).rejects.toThrow('read failed');
  });
});
