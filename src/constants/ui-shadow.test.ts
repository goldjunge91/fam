import { colorsLight, withAlpha } from '@/components/theme';

import { uiShadowStyles } from './ui-shadow';

describe('uiShadowStyles', () => {
  it('exports only the finished styles and keeps geometry private', () => {
    expect(Object.keys(require('./ui-shadow'))).toEqual(['uiShadowStyles']);
  });

  it('exposes the eleven agreed app-wide shadow styles', () => {
    expect(uiShadowStyles).toEqual(
      expect.objectContaining({
        cardBottom: expect.any(Object),
        raisedCardBottom: expect.any(Object),
        modalBottom: expect.any(Object),
        prominentCard: expect.any(Object),
        floatingControlBottom: expect.any(Object),
        floatingPanelBottom: expect.any(Object),
        bottomSheetTop: expect.any(Object),
        leftDrawerRight: expect.any(Object),
        hotspotBottom: expect.any(Object),
        accentNoteBottomRight: expect.any(Object),
        none: expect.any(Object),
      }),
    );
  });

  it('uses the existing card and sheet tokens with their assigned directions', () => {
    expect(uiShadowStyles.cardBottom.boxShadow).toBe('0px 2px 6px rgba(89, 64, 89, 0.08)');
    expect(uiShadowStyles.raisedCardBottom.boxShadow).toBe('0px 6px 14px rgba(89, 64, 89, 0.1)');
    expect(uiShadowStyles.modalBottom.boxShadow).toBe('0px 12px 24px rgba(89, 64, 89, 0.14)');
    expect(uiShadowStyles.prominentCard.boxShadow).toBe('0px 0px 18px rgba(89, 64, 89, 0.7)');
    expect(uiShadowStyles.floatingControlBottom.boxShadow).toBe(
      '0px 6px 14px rgba(89, 64, 89, 0.1)',
    );
    expect(uiShadowStyles.floatingPanelBottom.boxShadow).toBe(
      '0px 12px 24px rgba(42, 31, 44, 0.14)',
    );
    expect(uiShadowStyles.bottomSheetTop.boxShadow).toBe('0px -12px 24px rgba(42, 31, 44, 0.14)');
    expect(uiShadowStyles.leftDrawerRight.boxShadow).toBe('12px 0px 24px rgba(42, 31, 44, 0.14)');
  });

  it('keeps the documented hotspot and accent-note geometries and reset', () => {
    expect(uiShadowStyles.hotspotBottom.boxShadow).toBe('0px 1px 2px rgba(89, 64, 89, 0.2)');
    expect(uiShadowStyles.accentNoteBottomRight.boxShadow).toBe(
      `4px 5px 0px ${withAlpha(colorsLight.accent, 0.18)}`,
    );
    expect(uiShadowStyles.none.boxShadow).toBe('none');
  });
});
