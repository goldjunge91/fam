# ProductInformation: lokale Layouttokens konsolidieren

Status: Plan zur Freigabe. Produktionscode wurde für diesen Slice nicht geändert.

## Ziel und Abgrenzung

`src/features/inventory/components/product-information.tsx` soll seine app-eigenen, wiederkehrenden
Radien, Abstände, Flächen, Konturen und Schatten über die bestehende
Unistyles-Theme-Struktur beziehen. Das ist eine strukturelle Konsolidierung mit
unverändertem sichtbarem Layout, kein Redesign.

Die offizielle Nutri-Score-Kennzeichnung bleibt eine externe Integrationsausnahme.
Ihre Farben werden nicht zu fam-semantischen Farben und nicht zu einem globalen
UI-Rezept gemacht.

Der laufende Plan `tasks/ui-consolidation-v2/plan.md` bleibt unangetastet. Dieser
konkrete Befund erhält wegen der bereits laufenden und nicht abgeschlossenen
Migration einen eigenen, ausführbaren Slice.

## Kontext und Owner-Grenzen

Geprüfte Grundlagen:

- `CONSTRAINTS.md`
- `src/features/inventory/components/product-information.tsx`
- `src/components/theme/index.ts`
- `src/components/theme/ThemeProvider.tsx`
- `src/constants/ui.tsx`
- `docs/design-system/contracts/01-theme-and-colors.md`
- `docs/design-system/contracts/03-spacing-and-layout.md`
- `docs/design-system/contracts/04-radius-shadow-gradient.md`
- `docs/design-system/contracts/05-unistyles-and-stylesheet.md`
- bestehende RNTL- und Inventory-Testmuster

Verbindliche Aufteilung:

| Entscheidung | Owner | Umsetzung im Slice |
| --- | --- | --- |
| Wiederverwendbare Werte für Abstand, Radius, Palette, Schatten | `src/components/theme/index.ts` | Nur bestehende Tokens verwenden; kein neuer globaler Token |
| Semantische fam-UI-Rezepte und gemeinsame Interaktionsdarstellung | `src/constants/ui.tsx` | Keine neue ProductInformation-Abstraktion, solange kein zweiter Consumer existiert |
| Lokales Layout und Komposition des Produktdaten-Sheets | `product-information.tsx` | Benannte `StyleSheet.create((theme) => ...)`-Styles; echte Einzelgeometrie bleibt lokal |
| Nutri-Score-Farben | ProductInformation als externer Anzeigeadapter | Lokale Sonderpalette, nur für das Open-Food-Facts-Nutri-Score-Badge |

## Architekturentscheidungen

### 1. Bestehende Tokens, keine neue globale Token-Schicht

Äquivalente Werte werden direkt an bestehende Tokens gebunden, zum Beispiel:

| Bisheriger Wert | Bestehender Token | Verwendung |
| --- | --- | --- |
| `borderRadius: 20` | `theme.radius.lg` | Detail-, Inhalts- und Nutri-Score-Flächen |
| `borderRadius: 16` | `theme.radius.md` | Nährwertzellen und Badge |
| `borderRadius: 28` | `theme.radius.famLarge` | Sheet |
| `borderRadius: 999` | `theme.radius.pill` | Handle |
| `padding: 20` | `theme.space.xl` | Scroll-Content |
| `gap: 12` / `padding: 12` | `theme.space.md` | Header- und Score-Komposition |
| `gap: 8` | `theme.space.sm` | Nährwert-Grid |

`14`, `11`, `10`, `42x4`, `34` und `62` sind nicht stillschweigend auf den
nächstliegenden Token zu runden. Wo die exakte Sheet- oder Badge-Geometrie für
die visuelle Stabilität nötig ist, bleiben sie als benannte lokale Styles bzw.
lokale Einzelwerte erhalten und werden im Code/Plan begründet. So wird aus der
Tokenisierung keine unbeabsichtigte Layoutänderung.

Theme-abhängige Werte wie Sheet-Fläche, Scrim, Border, Handle, Close-Fläche und
Shadow werden aus dem Theme-Callback bezogen. Inline-Styles bleiben nur für
echte Laufzeitwerte, Safe-Area-Berechnung oder native Integrationsgrenzen.

### 2. Nutri-Score ist eine externe Kennzeichnungspalette

`CatalogProduct.nutriScore` stammt aus dem Open-Food-Facts-Feld
`nutriscore_grade`. Die Zuordnung A–E zu den offiziellen Badge-Farben ist eine
Anzeigeentscheidung des ProductInformation-Adapters, nicht ein fam-Theme-Token.

Erlaubt:

- die lokale Palette in `product-information.tsx`;
- Nutzung ausschließlich am Nutri-Score-Badge;
- der bestehende app-eigene Fallback für fehlenden Score;
- kontrastgeprüfte inverse Badge-Beschriftung.

Nicht erlaubt:

- Kopieren der Farben nach `theme/index.ts` oder `src/constants/ui.tsx`;
- Nutzung für Buttons, Links, Statusmeldungen oder andere fam-Zustände;
- Umdeuten der offiziellen Grade in app-eigene semantische Rollen.

`docs/design-system/contracts/05-unistyles-and-stylesheet.md` erhält dazu einen
Eintrag mit Pfad, Quelle, Owner, erlaubter Nutzung und Testnachweis. Das
statische Gate prüft die Sonderpalette gezielt, ohne Domain- oder
Integrationswerte pauschal zu verbieten.

Der Grund, die Farben nicht in `ui.tsx` zu verschieben, ist damit bewusst
architektonisch: `ui.tsx` ist Owner der gemeinsamen fam-Semantik. Eine dort
abgelegte Nutri-Score-Palette würde die externe Produktkennzeichnung als
wiederverwendbare App-Semantik ausgeben und ihre falsche Nutzung wahrscheinlicher
machen.

## Geordnete Umsetzung

Die Reihenfolge ist in Beads als Abhängigkeiten hinterlegt:

1. **fam-eepx.1 – Vertrag und Owner-Gate**
   - Integrationsausnahme dokumentieren.
   - Deterministisches Gate für Style-Owner und Palette ergänzen.
   - Noch keine Produktionsänderung.

2. **fam-eepx.3 – RED-Tests**
   - Fokussierte RNTL-Tests für Produktdaten mit Nutri-Score, fehlenden Score
     und `onClose` schreiben.
   - Semantische Queries und isolierte OFF-/Query-Mocks verwenden.
   - Keine Snapshots als Hauptnachweis.

3. **fam-eepx.4 – Tokenisierung**
   - Inline-Styles in eine theme-aware Unistyles-StyleSheet überführen.
   - Bestehende Space-/Radius-/Palette-/Shadow-Tokens anwenden.
   - Verhalten und sichtbare Geometrie erhalten; Einzelmaße nur begründet lokal
     lassen.

4. **fam-eepx.2 – Geräte- und Qualitätsprüfung**
   - Fokussierte Tests, `bun run check` und `bun run typecheck` ausführen.
   - iOS-Gerät/Dev-Build mit dem vereinbarten Pfad öffnen:
     `agent-device open com.goldjunge91.fam1 --foreground`
   - Sheet, Close-Interaktion, Nutri-Score-Kontrast sowie Light/Dark prüfen.

Die Implementierung startet erst nach Freigabe dieses Plans. Die Beads-Aufgaben
bleiben bis zur tatsächlichen Umsetzung offen.

## Akzeptanzkriterien

- `product-information.tsx` verwendet für wiederkehrende app-eigene Werte die
  bestehenden Theme-Owner und keine neue vierte Style-/Theme-Quelle.
- Keine sichtbare Änderung an Sheet-Radius, Abständen, Badge-Größe,
  Nährwert-Grid oder Close-Interaktion ohne gesonderte Designfreigabe.
- Nutri-Score-Farben sind als Open-Food-Facts-Integrationsausnahme dokumentiert
  und bleiben aus globalen fam-Semantik-Ownern heraus.
- Der direkte ProductInformation-Test deckt Score, Fallback und Close ab; der
  bestehende Inventory-Long-Press-Test bleibt grün.
- `bun run check`, `bun run typecheck` und die fokussierten Tests sind grün.
- Die Geräteprüfung bestätigt Light/Dark-Lesbarkeit und keine Regression der
  nativen Sheet-Darstellung.

## Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
| --- | --- |
| `14` wird auf `12` gerundet und verändert den visuellen Rhythmus | Exakte Einzelgeometrie lokal belassen oder erst nach Mock-/Geräteprüfung ändern |
| Nutri-Score-Farben werden als allgemeine Statusfarben missbraucht | Vertragsabschnitt plus fokussiertes Owner-Gate |
| Inline-Style-Entfernung verschluckt Laufzeitwerte | Safe Area, berechnete Werte und native Grenzen explizit ausnehmen |
| Asynchrone OFF-Abfrage macht Tests flaky | Query-Client ohne Retries und deterministische Quellen-Mocks |

## Verifikation

Nach der Implementierung nur fokussiert prüfen:

```bash
bun run test src/features/inventory/components/product-information.test.tsx src/features/inventory/inventory-screen.test.tsx --watchman=false --runInBand
bun run check
bun run typecheck
```

Die vollständige Testsuite ist für diesen kleinen Slice nicht erforderlich und
wird gemäß Repository-Vertrag nicht pauschal gestartet.
