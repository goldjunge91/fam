export type InspectorGeometryPoint = { x: number; y: number };
export type InspectorGeometryQuad = readonly [
  InspectorGeometryPoint,
  InspectorGeometryPoint,
  InspectorGeometryPoint,
  InspectorGeometryPoint,
];

export type InspectorReceiptGeometry = {
  method: 'side-fallback';
  topEdge: 'observed' | 'estimated';
  quad: InspectorGeometryQuad;
};

/** Web and test fallback. The native inspector supplies the pixel-based detector. */
export async function detectInspectorReceiptGeometry(
  _uri: string,
): Promise<InspectorReceiptGeometry | null> {
  return null;
}
