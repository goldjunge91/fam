import { render, screen, userEvent } from '@testing-library/react-native';
import { DatePicker } from './date-picker';

// Wichtig für userEvent (was wir später für Klicks/Eingaben nutzen werden)
jest.useFakeTimers();

describe('DatePicker', () => {
  describe('rendering', () => {
    it('renders corrrectly with default props', async () => {
      // 1. Rendere die Komponente (in v14 immer mit await!)
      await render(<DatePicker value="" onChangeText={jest.fn()} />);
      // 2. Prüfe, ob das Feld mit dem Standard-Platzhalter existiert
      expect(screen.getByPlaceholderText('JJJJ-MM-TT (z.B. 2020-05-14)')).toBeOnTheScreen();
      // 3. Prüfe, ob das Standard-Label angezeigt wird
      expect(screen.getByText('Geburtsdatum')).toBeOnTheScreen();
    });
  });

  describe('Texteingabe', () => {
    it('displays the formatted date when a valid ISO date is provided', async () => {
      // Rendere die Komponente mit einem konkreten Wert
      await render(<DatePicker value="2020-05-14" onChangeText={jest.fn()} />);

      // Prüfe, ob das formatierte Datum auf dem Bildschirm erscheint
      expect(screen.getByText('📅 14. Mai 2020')).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    it('calls onChangeText when typing in the text field', async () => {
      // Setup: Ein Mock-Funktion erstellen, um zu prüfen, ob sie gerufen wird
      const onChangeTextMock = jest.fn();
      const user = userEvent.setup();

      await render(<DatePicker value="" onChangeText={onChangeTextMock} />);
      // Das Textfeld anhand des Platzhalters finden
      const input = screen.getByPlaceholderText('JJJJ-MM-TT (z.B. 2020-05-14)');

      // Benutzerinteraktion simulieren: Der User tippt "2023" ein
      await user.type(input, '2023');
      // Erwartung: Unsere Mock-Funktion wurde aufgerufen, da der User getippt hat
      expect(onChangeTextMock).toHaveBeenCalled();
    });
  });
});
