export type Size = { width: number; height: number };
type ImageFrame = Size & { left: number; top: number };

/** Positioniert Hotspots exakt über dem mit `contentFit="contain"` gerenderten Bild. */
export function calculateContainedImageFrame(container: Size, image: Size): ImageFrame | null {
  if (container.width <= 0 || container.height <= 0 || image.width <= 0 || image.height <= 0) {
    return null;
  }

  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  };
}
