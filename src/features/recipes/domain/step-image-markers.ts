export type StepImageTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'image'; imageIndex: number };

const IMAGE_MARKER_PATTERN = /\[\[Bild (\d+)\]\]/g;

export function createStepImageMarker(imageIndex: number): string {
  return `[[Bild ${imageIndex + 1}]]`;
}

export function splitStepImageMarkers(text: string, imageCount: number): StepImageTextSegment[] {
  const segments: StepImageTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(IMAGE_MARKER_PATTERN)) {
    const matchText = match[0];
    const matchIndex = match.index ?? 0;
    const imageIndex = Number(match[1]) - 1;
    if (imageIndex < 0 || imageIndex >= imageCount) continue;

    if (matchIndex > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, matchIndex) });
    }
    segments.push({ kind: 'image', imageIndex });
    cursor = matchIndex + matchText.length;
  }

  if (cursor < text.length || segments.length === 0) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }

  return segments;
}

export function removeStepImageMarker(text: string, removedImageIndex: number): string {
  return text.replace(IMAGE_MARKER_PATTERN, (marker, oneBasedIndex: string) => {
    const imageIndex = Number(oneBasedIndex) - 1;
    if (imageIndex === removedImageIndex) return '';
    if (imageIndex > removedImageIndex) return createStepImageMarker(imageIndex - 1);
    return marker;
  });
}

export function stripStepImageMarkers(text: string): string {
  return text.replace(IMAGE_MARKER_PATTERN, '');
}
