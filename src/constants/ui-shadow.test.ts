import { boxShadowValue, colorsLight, shadow, withAlpha } from '@/components/theme';

import { uiShadowStyles } from './ui-shadow';

describe('uiShadowStyles', () => {
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
    expect(uiShadowStyles.cardBottom.boxShadow).toBe(
      boxShadowValue(shadow.sm, colorsLight.shadowCard),
    );
    expect(uiShadowStyles.raisedCardBottom.boxShadow).toBe(
      boxShadowValue(shadow.md, colorsLight.shadowCard),
    );
    expect(uiShadowStyles.modalBottom.boxShadow).toBe(
      boxShadowValue(shadow.lg, colorsLight.shadowCard),
    );
    expect(uiShadowStyles.prominentCard.boxShadow).toBe(
      boxShadowValue(shadow.prominent, colorsLight.shadowCard),
    );
    expect(uiShadowStyles.floatingControlBottom.boxShadow).toBe(
      boxShadowValue(shadow.md, colorsLight.shadowCard),
    );
    expect(uiShadowStyles.floatingPanelBottom.boxShadow).toBe(
      boxShadowValue(shadow.lg, colorsLight.shadowSheet),
    );
    expect(uiShadowStyles.bottomSheetTop.boxShadow).toBe(
      boxShadowValue(shadow.lg, colorsLight.shadowSheet, 'up'),
    );
    expect(uiShadowStyles.leftDrawerRight.boxShadow).toBe(
      boxShadowValue(shadow.lg, colorsLight.shadowSheet, 'right'),
    );
  });

  it('keeps the documented hotspot and accent-note geometries and reset', () => {
    expect(uiShadowStyles.hotspotBottom.boxShadow).toBe('0px 1px 2px rgba(89, 64, 89, 0.2)');
    expect(uiShadowStyles.accentNoteBottomRight.boxShadow).toBe(
      `4px 5px 0px ${withAlpha(colorsLight.accent, 0.18)}`,
    );
    expect(uiShadowStyles.none.boxShadow).toBe('none');
  });
});
