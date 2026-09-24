import {
  createStepImageMarker,
  removeStepImageMarker,
  splitStepImageMarkers,
  stripStepImageMarkers,
} from './step-image-markers';

describe('step image markers', () => {
  it('splits valid image markers while preserving surrounding text', () => {
    expect(splitStepImageMarkers('Zwiebeln schneiden.\n[[Bild 1]]\nSalz dazu.', 2)).toEqual([
      { kind: 'text', text: 'Zwiebeln schneiden.\n' },
      { kind: 'image', imageIndex: 0 },
      { kind: 'text', text: '\nSalz dazu.' },
    ]);
  });

  it('keeps markers for images that are not available as text', () => {
    expect(splitStepImageMarkers('[[Bild 2]]', 1)).toEqual([{ kind: 'text', text: '[[Bild 2]]' }]);
  });

  it('removes a deleted image marker and shifts following image numbers', () => {
    expect(removeStepImageMarker('A [[Bild 1]] B [[Bild 2]] C [[Bild 3]]', 1)).toBe(
      'A [[Bild 1]] B  C [[Bild 2]]',
    );
  });

  it('creates the human-readable marker for an image slot', () => {
    expect(createStepImageMarker(0)).toBe('[[Bild 1]]');
    expect(createStepImageMarker(2)).toBe('[[Bild 3]]');
  });

  it('blendet Bildmarkierungen in einer reinen Textvorschau aus', () => {
    expect(stripStepImageMarkers('Teig kneten [[Bild 1]] und ruhen lassen.')).toBe(
      'Teig kneten  und ruhen lassen.',
    );
  });
});
