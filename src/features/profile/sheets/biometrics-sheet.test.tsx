import { render, screen, userEvent } from '@testing-library/react-native';

import type { ProfileBiometrics } from '@/features/profile/domain/biometrics';
import { BiometricsSheet } from '@/features/profile/sheets/biometrics-sheet';

const emptyBiometrics: ProfileBiometrics = {
  birthDate: null,
  heightCm: null,
  weightKg: null,
  sex: null,
  activityLevel: null,
};

describe('BiometricsSheet', () => {
  test('übernimmt validierte Werte und Auswahlwerte', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const onClose = jest.fn();

    await render(
      <BiometricsSheet visible value={emptyBiometrics} onApply={onApply} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText('Körpergröße (cm)'), '180');
    await user.type(screen.getByLabelText('Profilgewicht (kg)'), '80');
    await user.press(screen.getByRole('radio', { name: 'Männlich' }));
    await user.press(screen.getByRole('radio', { name: 'Mäßig aktiv' }));

    expect(screen.getByRole('radio', { name: 'Männlich' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Mäßig aktiv' })).toBeSelected();
    await user.press(screen.getByRole('button', { name: 'Angaben übernehmen' }));

    expect(onApply).toHaveBeenCalledWith({
      birthDate: null,
      heightCm: 180,
      weightKg: 80,
      sex: 'male',
      activityLevel: 'moderate',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('bewahrt das bestehende einmalige Profilgewicht', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const onClose = jest.fn();

    await render(
      <BiometricsSheet
        visible
        value={{ ...emptyBiometrics, weightKg: 80 }}
        onApply={onApply}
        onClose={onClose}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Angaben übernehmen' }));

    expect(onApply).toHaveBeenCalledWith({
      birthDate: null,
      heightCm: null,
      weightKg: 80,
      sex: null,
      activityLevel: null,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('zeigt Feldfehler und blockiert ungültige Eingaben', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const onClose = jest.fn();

    await render(
      <BiometricsSheet visible value={emptyBiometrics} onApply={onApply} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText('Körpergröße (cm)'), '300');
    await user.press(screen.getByRole('button', { name: 'Angaben übernehmen' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Bitte eine verlässliche Größe unter 300 cm eingeben.',
    );
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('schließt ohne Apply über den zugänglichen Dismiss-Button', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const onClose = jest.fn();

    await render(
      <BiometricsSheet visible value={emptyBiometrics} onApply={onApply} onClose={onClose} />,
    );

    await user.press(screen.getByRole('button', { name: 'Körper & Aktivität schließen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  test('bewahrt den Apply- und Auswahlvertrag ohne Plattformspiegel', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const onClose = jest.fn();

    await render(
      <BiometricsSheet visible value={emptyBiometrics} onApply={onApply} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText('Körpergröße (cm)'), '180');
    await user.press(screen.getByRole('radio', { name: 'Weiblich' }));
    await user.press(screen.getByRole('button', { name: 'Angaben übernehmen' }));

    expect(onApply).toHaveBeenCalledWith({
      birthDate: null,
      heightCm: 180,
      weightKg: null,
      sex: 'female',
      activityLevel: null,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
