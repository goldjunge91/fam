# Ausführungsplan: ProductInformation lokale Layouttokens

Status: Contract-/Owner-Gate in Arbeit
Beads: `fam-eepx` mit den Kind-Tasks `fam-eepx.1` bis `fam-eepx.4`

## Ziel und Scope

`src/features/inventory/components/product-information.tsx` soll wiederkehrende
app-eigene Radien und Abstände an bereits vorhandene Theme-Tokens anbinden. Das
ist eine strukturelle Konsolidierung ohne sichtbares Redesign. Einmalige
Sheet-Geometrie, Laufzeitwerte wie Safe Area und die native Modal-Grenze bleiben
lokal, wenn die Komponente sie unmittelbar benötigt.

Android ist ausdrücklich nicht Teil dieses Vorhabens. Datenmodell, Open-Food-
Facts-Abfrage, Supabase, SQLite, Outbox und die bestehende Produktinformation
bleiben unverändert.

## Owner-Register

| Verantwortung | Owner | Grenze |
| --- | --- | --- |
| Wiederverwendbare Theme-Tokens und Paletten | `src/components/theme/index.ts` | Bestehende Tokens verwenden; kein neues Token nur für einen einzelnen Wert |
| Aktive Palette und Theme-Auflösung | `src/components/theme/ThemeProvider.tsx` | `useTheme()` liefert die Laufzeitwerte; keine zweite Auflösung im Feature |
| Semantische UI-Rezepte | `src/constants/ui.tsx` | Keine neue allgemeine Card-/Badge-Darstellung in ProductInformation |
| ProductInformation-Sheet | `src/features/inventory/components/product-information.tsx` | Verhalten, Komposition, Accessibility und lokales nichtsemantisches Layout |
| Offizielle Nutri-Score-Kennzeichnung | lokale `NUTRI_BADGE_COLORS`-Map in ProductInformation | Open-Food-Facts-A–E-Werte ausschließlich für die Nutri-Score-Badge-Fläche |

## Verbindliche Reihenfolge

1. `fam-eepx.1`: diesen Owner-/Integrationsvertrag und das fokussierte Gate
   fertigstellen.
2. `fam-eepx.3`: Verhaltenstests als RED-Slice für Render-, Fallback- und
   Nutri-Score-Grenzen ergänzen.
3. `fam-eepx.4`: nur wiederkehrende Maße auf bestehende Tokens umstellen;
   keine neue globale Palette, kein neuer Wrapper.
4. `fam-eepx.2`: gezielte Tests, Check, Typecheck und iOS-Light-/Dark-Prüfung
   durchführen. Android bleibt offen und wird nicht als Nachweis behauptet.

## Erlaubt und verboten

- Erlaubt: `colors.*` aus `useTheme()`, bestehende `StyleSheet`-Callbacks,
  einmalige lokale Geometrie, `insets.bottom` und die unveränderte offizielle
  Nutri-Score-A–E-Palette in ihrer lokalen Badge-Verwendung.
- Verboten: freie app-eigene semantische Farben, Kopien der Nutri-Score-Werte in
  einem zentralen Theme-Owner oder einer zweiten Map, neue Surface-/Badge-
  Rezepte und eine pauschale Umwandlung jeder Zahl in einen globalen Token.

## Nachweise und Abschluss

Der Contract-Test muss den eindeutigen Nutri-Score-Owner und die Begrenzung der
offiziellen Hexwerte deterministisch erkennen. Der Verhaltenstest prüft die
sichtbare Grade-/Fallback-Ausgabe und die bestehende Datenquelle. Der finale
Beads-Abschluss enthält je ein Ergebnis für Korrektheit, Lesbarkeit,
Architektur, Sicherheit und Performance sowie fokussierte Test-, Biome-,
Typecheck- und iOS-Nachweise.
