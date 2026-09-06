import { getTrackingMethodSettings } from '@/features/profile/tracking-methods';

describe('tracking method overrides', () => {
  it('aktiviert ohne Override nur CICO und GLP-1 standardmäßig', () => {
    const settings = getTrackingMethodSettings(undefined, {});

    expect(settings.standard).toBe(true);
    expect(settings.glp1).toBe(true);
    expect(settings.fasting).toBe(false);
    expect(settings.volumetrics).toBe(false);
  });

  it('wertet PostHog-Flags aus', () => {
    const settings = getTrackingMethodSettings(
      { 'tracking-method-volumetrics': true, 'tracking-method-cgm': false },
      {},
    );

    expect(settings.volumetrics).toBe(true);
    expect(settings.cgm).toBe(false);
  });

  it('setzt lokale Overrides vor PostHog', () => {
    const settings = getTrackingMethodSettings(
      { 'tracking-method-volumetrics': false },
      { volumetrics: true, standard: false },
    );

    expect(settings.volumetrics).toBe(true);
    expect(settings.standard).toBe(false);
  });
});
