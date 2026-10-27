import { applyPinchZoom, toggleDoubleTapZoom } from './brochure-zoom';

describe('brochure zoom transforms', () => {
  it('keeps the pinch focal point under the fingers', () => {
    expect(
      applyPinchZoom({ scale: 1, translateX: 0, translateY: 0 }, 2, { x: 120, y: 240 }),
    ).toEqual({ scale: 2, translateX: -120, translateY: -240 });
  });

  it('does not cap repeated pinch zoom', () => {
    const firstZoom = applyPinchZoom({ scale: 9, translateX: 0, translateY: 0 }, 9, {
      x: 0,
      y: 0,
    });

    expect(firstZoom.scale).toBe(81);
  });

  it('toggles double tap between 2x at the tap point and the original size', () => {
    const zoomed = toggleDoubleTapZoom(
      { scale: 1, translateX: 0, translateY: 0 },
      { x: 80, y: 50 },
    );

    expect(zoomed).toEqual({ scale: 2, translateX: -80, translateY: -50 });
    expect(toggleDoubleTapZoom(zoomed, { x: 80, y: 50 })).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });
});
