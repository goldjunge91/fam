import { render, screen, userEvent } from '@testing-library/react-native';
import type { CorrelationSeriesPoint } from '@/features/glp1/domain/correlation-series';
import { CorrelationSection } from './correlation-section';

const POINT: CorrelationSeriesPoint = {
  date: '2026-08-24',
  daysSinceInjection: 0,
  calories: 1540,
  weightKg: 91.4,
  injection: {
    administeredAt: '2026-08-24T10:00:00.000Z',
    medicationName: 'Mounjaro',
    dose: 5,
    unit: 'mg',
    injectionSite: 'Bauch rechts',
  },
  doseChanged: true,
};

describe('CorrelationSection', () => {
  it('stellt Injektion, Zyklustag, Kalorien und Gewicht gemeinsam dar', async () => {
    await render(<CorrelationSection series={[POINT]} />);

    expect(screen.getByText('Injektion 5 mg')).toBeOnTheScreen();
    expect(screen.getByText('Dosis geändert')).toBeOnTheScreen();
    expect(screen.getByText('Tag 0')).toBeOnTheScreen();
    expect(screen.getByText('1.540 kcal')).toBeOnTheScreen();
    expect(screen.getByText('91,4 kg')).toBeOnTheScreen();
  });

  it('wechselt den sichtbaren Zeitraum im lokalen Komponenten-State', async () => {
    const user = userEvent.setup();
    const series = Array.from(
      { length: 20 },
      (_, index): CorrelationSeriesPoint => ({
        ...POINT,
        date: `2026-08-${String(index + 1).padStart(2, '0')}`,
        calories: index === 0 ? 777 : null,
        injection: null,
        doseChanged: false,
      }),
    );

    await render(<CorrelationSection series={series} />);

    expect(screen.getByRole('tab', { name: '14 Tage' })).toBeSelected();
    expect(screen.queryByText('777 kcal')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: '30 Tage' }));

    expect(screen.getByRole('tab', { name: '30 Tage' })).toBeSelected();
    expect(screen.getByText('777 kcal')).toBeOnTheScreen();
  });
});
