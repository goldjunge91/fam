import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChildProfilesScreen } from '@/features/household/child-profiles-screen';

const mockAddMutateAsync = jest.fn().mockResolvedValue({});
const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
const mockDeleteMutateAsync = jest.fn().mockResolvedValue({});
let mockChildProfiles: {
  id: string;
  display_name: string;
  birth_date: string | null;
  sex: string | null;
  height_cm: number | null;
}[] = [];

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: { id: 'hh-1', name: 'Zuhause' } }),
}));

jest.mock('@/features/household/api', () => ({
  useChildProfiles: () => ({ data: mockChildProfiles, isLoading: false }),
  useAddChildProfileMutation: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
  useUpdateChildProfileMutation: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
  useDeleteChildProfileMutation: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <ChildProfilesScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockAddMutateAsync.mockClear();
  mockUpdateMutateAsync.mockReset().mockResolvedValue({});
  mockDeleteMutateAsync.mockReset().mockResolvedValue({});
  mockChildProfiles = [];
});

it('sendet managedBy beim Anlegen eines Kinder-Profils (RLS verlangt managed_by = auth.uid())', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('+ Kinder-Profil anlegen'));
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Paul'), 'Paul');
  await fireEvent.press(screen.getByText('Speichern'));

  expect(mockAddMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      householdId: 'hh-1',
      displayName: 'Paul',
      managedBy: 'user-1',
    }),
  );
});

it('speichert optionale Kinderangaben normalisiert und schließt das Formular danach', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('+ Kinder-Profil anlegen'));
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Paul'), '  Lina  ');
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. 104'), '104 cm');
  await fireEvent.press(screen.getByLabelText('Weiblich'));
  await fireEvent.press(screen.getByText('Speichern'));

  expect(mockAddMutateAsync).toHaveBeenCalledWith({
    householdId: 'hh-1',
    displayName: 'Lina',
    birthDate: null,
    sex: 'female',
    heightCm: 104,
    managedBy: 'user-1',
  });
  expect(screen.queryByPlaceholderText('z. B. Paul')).toBeNull();
});

it('hält das Formular offen und meldet einen fehlgeschlagenen Speicherversuch', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockAddMutateAsync.mockRejectedValueOnce(new Error('Profil konnte nicht gespeichert werden'));
  await renderScreen();
  await fireEvent.press(screen.getByText('+ Kinder-Profil anlegen'));
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Paul'), 'Paul');
  await fireEvent.press(screen.getByText('Speichern'));

  expect(alert).toHaveBeenCalledWith('Fehler', 'Profil konnte nicht gespeichert werden');
  expect(screen.getByPlaceholderText('z. B. Paul')).toBeOnTheScreen();
  alert.mockRestore();
});

it('bearbeitet ein vorhandenes Profil und übergibt die Änderungen', async () => {
  mockChildProfiles = [
    {
      id: 'child-1',
      display_name: 'Paul',
      birth_date: null,
      sex: 'male',
      height_cm: 104,
    },
  ];
  await renderScreen();
  await fireEvent.press(screen.getByText('Bearbeiten'));
  await fireEvent.changeText(screen.getByLabelText('Name des Kindes'), 'Paulchen');
  await fireEvent.press(screen.getByText('Übernehmen'));

  expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
    id: 'child-1',
    householdId: 'hh-1',
    displayName: 'Paulchen',
    birthDate: null,
    sex: 'male',
    heightCm: 104,
  });
});

it('fragt vor dem Löschen nach und entfernt das ausgewählte Profil', async () => {
  mockChildProfiles = [
    {
      id: 'child-1',
      display_name: 'Paul',
      birth_date: null,
      sex: null,
      height_cm: null,
    },
  ];
  let confirm: (() => void) | undefined;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
  });
  await renderScreen();
  await fireEvent.press(screen.getByText('Löschen'));

  expect(alert).toHaveBeenCalledWith(
    'Profil löschen',
    'Möchtest du das Kinder-Profil "Paul" wirklich entfernen?',
    expect.any(Array),
  );
  expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
  await act(async () => {
    await confirm?.();
  });
  expect(mockDeleteMutateAsync).toHaveBeenCalledWith({ id: 'child-1', householdId: 'hh-1' });
  alert.mockRestore();
});

it('zeigt Zusatzangaben eines Profils an und kann die Bearbeitung abbrechen', async () => {
  mockChildProfiles = [
    {
      id: 'child-2',
      display_name: 'Lina',
      birth_date: '2016-04-12',
      sex: 'female',
      height_cm: 120,
    },
  ];
  await renderScreen();

  expect(screen.getByText(/Geboren:/)).toBeOnTheScreen();
  expect(screen.getByText(/120 cm · weiblich/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Bearbeiten'));
  await fireEvent.press(screen.getByText('Abbrechen'));

  expect(screen.getByText(/Lina/)).toBeOnTheScreen();
  expect(screen.queryByLabelText('Name des Kindes')).toBeNull();
});

it('meldet einen Fehler beim Aktualisieren, ohne den Entwurf zu schließen', async () => {
  mockChildProfiles = [
    {
      id: 'child-3',
      display_name: 'Paul',
      birth_date: null,
      sex: null,
      height_cm: null,
    },
  ];
  mockUpdateMutateAsync.mockRejectedValueOnce(new Error('Profil konnte nicht geändert werden'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderScreen();
  await fireEvent.press(screen.getByText('Bearbeiten'));
  await fireEvent.press(screen.getByText('Übernehmen'));

  expect(alert).toHaveBeenCalledWith('Fehler', 'Profil konnte nicht geändert werden');
  expect(screen.getByLabelText('Name des Kindes')).toBeOnTheScreen();
  alert.mockRestore();
});
