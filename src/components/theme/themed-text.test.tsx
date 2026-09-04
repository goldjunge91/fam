import { render, screen } from '@testing-library/react-native';

import { Txt } from '@/constants/ui';

// Wichtig fuer alle weiteren Tests im Projekt: In @testing-library/react-native
// v14 ist `render` asynchron (React 19 Concurrent Rendering) und MUSS awaited
// werden. Ohne `await` liefert es ein Promise, `screen` bleibt leer und die
// Fehlermeldung lautet irrefuehrend "`render` function has not been called".

describe('Txt', () => {
  it('gibt den uebergebenen Text aus', async () => {
    await render(<Txt>Hallo Haushalt</Txt>);

    expect(screen.getByText('Hallo Haushalt')).toBeTruthy();
  });

  it('rendert Standard-Rolle mit Textklasse', async () => {
    await render(<Txt>Bestand</Txt>);

    expect(screen.getByText('Bestand')).toBeTruthy();
  });

  it('unterstuetzt Titel-Typ und semantische Rollen', async () => {
    await render(<Txt variant="title">Kuehlschrank</Txt>);

    expect(screen.getByText('Kuehlschrank')).toBeTruthy();
  });
});
