import { calculateContainedImageFrame } from './brochure-page-layout';

describe('calculateContainedImageFrame', () => {
  it('richtet eine hochformatige Prospektseite mittig im verfügbaren Bereich aus', () => {
    expect(
      calculateContainedImageFrame({ width: 390, height: 844 }, { width: 1500, height: 1950 }),
    ).toEqual({
      left: 0,
      top: 168.5,
      width: 390,
      height: 507,
    });
  });

  it('verwendet bei ungültigen Bildmaßen noch kein Hotspot-Overlay', () => {
    expect(
      calculateContainedImageFrame({ width: 390, height: 844 }, { width: 0, height: 0 }),
    ).toBeNull();
  });
});
