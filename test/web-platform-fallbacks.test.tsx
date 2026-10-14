const screenshotDriver = jest.requireActual<typeof import('../src/components/ScreenshotDriver.web')>(
  '../src/components/ScreenshotDriver.web.tsx',
);
const adBanner = jest.requireActual<
  typeof import('../src/features/ads/components/ad-banner.web')
>('../src/features/ads/components/ad-banner.web.tsx');
const receiptRectifier = jest.requireActual<
  typeof import('../src/features/ocr/capture/capture/receipt-image-rectifier.web')
>('../src/features/ocr/capture/capture/receipt-image-rectifier.web.ts');
const categoryOrderSheet = jest.requireActual<
  typeof import('../src/features/shopping-list/sheets/category-order-sheet.web')
>('../src/features/shopping-list/sheets/category-order-sheet.web.tsx');
const completeRunSheet = jest.requireActual<
  typeof import('../src/features/shopping-list/sheets/complete-run-sheet.web')
>('../src/features/shopping-list/sheets/complete-run-sheet.web.tsx');
const screenshots = jest.requireActual<typeof import('../src/lib/devtools/screenshots.web')>(
  '../src/lib/devtools/screenshots.web.ts',
);
const quickAddWidget = jest.requireActual<
  typeof import('../src/widgets/quick-add-shopping-widget.web')
>('../src/widgets/quick-add-shopping-widget.web.tsx');
const shoppingListWidget = jest.requireActual<
  typeof import('../src/widgets/shopping-list-widget.web')
>('../src/widgets/shopping-list-widget.web.tsx');
const backgroundSync = jest.requireActual<
  typeof import('../src/lib/sync/remote-background-sync.web')
>('../src/lib/sync/remote-background-sync.web.ts');

describe('web fallbacks for native integrations', () => {
  it('renders no native-only screenshot, ad, or shopping sheets', () => {
    expect(screenshotDriver.ScreenshotDriver()).toBeNull();
    expect(adBanner.AdBanner({ unitId: 'test-banner' })).toBeNull();
    expect(
      categoryOrderSheet.CategoryOrderSheet({
        isOpen: true,
        store: null,
        onClose: jest.fn(),
      }),
    ).toBeNull();
    expect(
      completeRunSheet.CompleteRunSheet({
        isOpen: true,
        checkedItems: [],
        onConfirm: jest.fn(),
        onClose: jest.fn(),
      }),
    ).toBeNull();
  });

  it('returns no native screenshot or image-correction result', async () => {
    await expect(screenshots.loadShotsFlag()).resolves.toBeNull();
    await expect(receiptRectifier.rectifyReceiptImage('file:///receipt.jpg')).resolves.toBeNull();
  });

  it('keeps widget updates and background task registration inert', async () => {
    expect(
      quickAddWidget.default.updateSnapshot({ articleName: 'Milch' }),
    ).toBeUndefined();
    expect(
      shoppingListWidget.default.updateSnapshot({ openCount: 0, nextItem: undefined }),
    ).toBeUndefined();

    expect(backgroundSync.BACKGROUND_SYNC_TASK_NAME).toBe('fam-background-sync');
    backgroundSync.setBackgroundSyncHandler(async () => undefined);
    backgroundSync.defineBackgroundSyncTask();
    await backgroundSync.registerBackgroundSync(60);
    await backgroundSync.unregisterBackgroundSync();
    await expect(backgroundSync.getBackgroundSyncStatus()).resolves.toBeNull();
  });
});
