import { render, screen } from '@testing-library/react-native';

import { ThemedText } from '@/components/theme/themed-text';

// Wichtig fuer alle weiteren Tests im Projekt: In @testing-library/react-native
// v14 ist `render` asynchron (React 19 Concurrent Rendering) und MUSS awaited
// werden. Ohne `await` liefert es ein Promise, `screen` bleibt leer und die
// Fehlermeldung lautet irrefuehrend "`render` function has not been called".

describe('ThemedText', () => {
  it('gibt den uebergebenen Text aus', async () => {
    await render(<ThemedText>Hallo Haushalt</ThemedText>);

    expect(screen.getByText('Hallo Haushalt')).toBeTruthy();
  });

  it('rendert Standard-Rolle mit Textklasse', async () => {
    await render(<ThemedText>Bestand</ThemedText>);

    expect(screen.getByText('Bestand')).toBeTruthy();
  });

  it('unterstuetzt Titel-Typ und semantische Rollen', async () => {
    await render(<ThemedText type="title">Kuehlschrank</ThemedText>);

    expect(screen.getByText('Kuehlschrank')).toBeTruthy();
  });
});
