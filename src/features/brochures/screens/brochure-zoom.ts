export type ZoomTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type Point = { x: number; y: number };

/** Updates scale while keeping the point between the fingers stationary. */
export function applyPinchZoom(
  current: ZoomTransform,
  scaleChange: number,
  focalPoint: Point,
): ZoomTransform {
  'worklet';
  return {
    scale: current.scale * scaleChange,
    translateX: focalPoint.x - (focalPoint.x - current.translateX) * scaleChange,
    translateY: focalPoint.y - (focalPoint.y - current.translateY) * scaleChange,
  };
}

/** Double tap zooms to 2x at the tapped point, then restores the original view. */
export function toggleDoubleTapZoom(current: ZoomTransform, point: Point): ZoomTransform {
  'worklet';
  if (current.scale > 1) return { scale: 1, translateX: 0, translateY: 0 };

  return {
    scale: 2,
    translateX: point.x - (point.x - current.translateX) * 2,
    translateY: point.y - (point.y - current.translateY) * 2,
  };
}
