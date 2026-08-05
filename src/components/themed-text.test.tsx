import { render, screen } from '@testing-library/react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

// Wichtig fuer alle weiteren Tests im Projekt: In @testing-library/react-native
// v14 ist `render` asynchron (React 19 Concurrent Rendering) und MUSS awaited
// werden. Ohne `await` liefert es ein Promise, `screen` bleibt leer und die
// Fehlermeldung lautet irrefuehrend "`render` function has not been called".

describe('ThemedText', () => {
  it('gibt den uebergebenen Text aus', async () => {
    await render(<ThemedText>Hallo Haushalt</ThemedText>);

    expect(screen.getByText('Hallo Haushalt')).toBeTruthy();
  });

  it('faellt ohne themeColor auf die Textfarbe des Themes zurueck', async () => {
    await render(<ThemedText>Bestand</ThemedText>);

    // Prueft nebenbei, dass der Alias `@/constants/theme` aufloesbar ist —
    // ohne einen festen Hex-Wert zu verdrahten.
    expect(screen.getByText('Bestand')).toHaveStyle({ color: Colors.light.text });
  });

  it('uebernimmt die Schriftgroesse des gewaehlten Typs', async () => {
    await render(<ThemedText type="title">Kuehlschrank</ThemedText>);

    expect(screen.getByText('Kuehlschrank')).toHaveStyle({ fontSize: 48 });
  });
});
