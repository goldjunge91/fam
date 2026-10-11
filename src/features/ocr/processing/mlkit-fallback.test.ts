describe('ML Kit OCR fallback', () => {
  it('reports the native recognizer unavailable and rejects recognition requests', async () => {
    const fallback = jest.requireActual<typeof import('./mlkit')>('./mlkit.ts');

    expect(fallback.isGoogleMlKitAvailable()).toBe(false);
    await expect(fallback.recognizeWithGoogleMlKit('file:///receipt.jpg')).rejects.toThrow(
      'Google ML Kit OCR is only available in the iOS receipt test build.',
    );
  });
});
