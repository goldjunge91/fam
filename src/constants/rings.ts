/** Standardisierte Größen-Presets für Ring- und Fortschrittsanzeigen (#164). */
export const RingPresetSize = {
  /** Kompakter Ring für Zusammenfassungs-Karten (z. B. Vorrat / Expiry) */
  compact: { size: 58, strokeWidth: 7 },
  /** Widget-Ring für das Dashboard ("Kalorien heute") */
  dashboard: { size: 94, strokeWidth: 10 },
  /** Mittlerer Ring für Tagebuch & Bilanzen */
  medium: { size: 128, strokeWidth: 12 },
  /** Großer Ring für detaillierte Ziel-Visualisierungen */
  large: { size: 160, strokeWidth: 14 },
} as const;

export type RingPreset = keyof typeof RingPresetSize;

/**
 * Berechnet Radius und Umfang für SVG-Kreise basierend auf Durchmesser und Strichstärke.
 */
export function computeRingMetrics(size: number, strokeWidth: number) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return { radius, circumference };
}
