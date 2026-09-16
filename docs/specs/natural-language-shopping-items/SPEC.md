# Spec: Natürliche Eingabe von Einkaufsartikeln

**Status:** Entwurf, Maintainer-Review erforderlich
**Version:** 0.1
**Stand:** 2026-09-16
**Bead:** `fam-pa0g`
**Capability Map:** [CAPABILITY_MAP.md](./CAPABILITY_MAP.md)

## Objective

Haushaltsmitglieder sollen in einer isolierten Beta mehrere Artikel schnell
über einen natürlich formulierten Text oder per Speech-to-Text zur gemeinsamen
Einkaufsliste hinzufügen können.

Die Beta lebt vollständig außerhalb des bestehenden manuellen Add-Item-Flows.
`AddItemForm`, `AddItemModal` und `ShoppingListScreen` bleiben unverändert.
Die einzige erlaubte Verbindung zur bestehenden Einkaufslistenimplementierung
ist die freigegebene Schreibgrenze über `useAddShoppingItem` und die bestehende
Outbox.

Beispiel:

```text
2 Liter Milch, 6 Eier und eine Packung Nudeln, Skyr von ja
```

Die App erzeugt daraus einzelne Artikel. Sie erkennt Mengen und Einheiten,
nutzt Marken für die Händlerzuordnung und ordnet `Skyr von ja` der REWE-Liste
zu. Eine explizite Händlerangabe überschreibt ein automatisches Markenmapping.

Die lokale Erkennung ist immer der erste Verarbeitungsschritt und muss offline
funktionieren. Nach zehn eindeutigen positiven Artikelzuordnungen fragt die App
einmalig, ob eindeutige lokale Ergebnisse automatisch verarbeitet werden
dürfen. KI ist eine getrennte, optionale Verbesserung: Sie wird nur bei aktivem
AI-Abo und ausdrücklicher Einwilligung eingesetzt und arbeitet in drei Stufen.

## User Stories

- Als Haushaltsmitglied möchte ich mehrere Artikel in einer Eingabe nennen,
  damit ich die Liste schneller befüllen kann.
- Als Nutzer möchte ich Mengen, Einheiten und Marken nicht einzeln in
  Formularfelder übertragen müssen.
- Als Nutzer möchte ich vor falschen Händlerzuordnungen geschützt sein und
  unklare Artikel in einer Vorschau korrigieren können.
- Als Nutzer ohne AI-Abo möchte ich die Funktion vollständig lokal verwenden.
- Als Nutzer mit AI-Abo möchte ich KI-Unterstützung freiwillig und in einer von
  drei Intensitäten aktivieren können.

## Tech Stack

- Expo `~57.0.19`, React Native `0.86.3`, React `19.2.3`
- TypeScript `~6.0.3`
- React Query für server-/cachebezogene Zustände
- Zustand oder accountgebundener Storage nur für lokalen UI-/Nutzerzustand,
  nicht als zweite Quelle für Haushaltslisten
- `expo-sqlite` und Drizzle für den lokalen SQLite-Spiegel und die Outbox
- Bestehende Shopping-List-Mutation `useAddShoppingItem` und
  `shopping-list-merge.ts` für das Schreiben
- RevenueCat `react-native-purchases` für den bestehenden Abo-Status
- Speech-to-Text über eine zu prüfende native Geräte-/Betriebssystemgrenze;
  keine neue Bibliothek ist durch diese Spec vorab freigegeben

## Commands

```bash
# Format, Lint und statische Konventionen
bun run check

# Typecheck
bun run typecheck

# Fokussierte Jest-Tests, niemals bun test direkt
bun run test src/features/shopping-list/natural-language/parse-shopping-input.test.ts

# Fokussierte Integrations- oder RNTL-Tests nach Bedarf
bun run test src/features/shopping-list/natural-language/<test-file>.test.tsx

# Falls der lokale SQLite-Spiegel erweitert wird
bun run db:local:generate

# Nur falls das deklarative Supabase-Schema betroffen ist
bun run db:diff -- -f natural_language_shopping_items
bun run db:types
bun run test:db
```

Für die Speech-to-Text-Grenze ist zusätzlich ein iOS- und Android-Dev-Client-
Nachweis erforderlich. Die konkrete native Verifikation wird im Plan festgelegt.

## Project Structure

Die vorhandene Feature-First-Struktur bleibt erhalten:

```text
src/features/shopping-list-natural-language-beta/
├── forms/                         # Beta-Eingabefläche und Vorschau
├── natural-language/
│   ├── speech-input.*             # native Speech-to-Text-Grenze
│   ├── parse-shopping-input.*     # reine lokale Parserlogik
│   ├── retailer-routing.*         # Händler- und Markenauflösung
│   ├── automation-preferences.*  # Lernzähler und lokale Zustimmung
│   └── ai-assist.*                # KI-Vertrag und Stufensteuerung
└── components/ui/                 # Beta-Vorschau-/Statusdarstellung

src/app/
└── shopping-list-natural-language-beta.tsx  # isolierter Beta-Einstieg

src/lib/db/
├── shopping-list-merge.ts         # bestehende freigegebene Schreibgrenze
└── ...

docs/specs/natural-language-shopping-items/
├── CAPABILITY_MAP.md
├── SPEC.md
└── SPEC-<module-id>.md
```

Die endgültigen Dateinamen werden im Plan festgelegt. Reine Parser- und
Routinglogik bleibt React-, Netzwerk- und Datenbank-frei. Die Beta darf keine
Importe aus bestehenden Shopping-List-UI-Komponenten benötigen.

## Code Style

Domänenlogik wird als typisierte, reine Funktion geschrieben. Ergebnisse
tragen Unsicherheit explizit, statt `null` oder impliziten Fallbacks zu nutzen.

```ts
export type ParsedShoppingItem = {
  rawText: string;
  name: string;
  quantity: number;
  unit: ShoppingUnit;
  brand: string | null;
  confidence: 'high' | 'review';
};

export function parseShoppingInput(text: string): readonly ParsedShoppingItem[] {
  const normalized = normalizeShoppingText(text);
  return splitShoppingItems(normalized).map(parseShoppingItem);
}
```

- Kein `any`, keine unnötigen Wrapper und keine versteckten Seiteneffekte.
- Bestehende Typen und Normalisierer werden wiederverwendet.
- Unistyles bleibt die einzige Styling-Runtime. Neue UI verwendet Theme-Tokens
  und Style-Arrays, keine neuen Hexfarben oder NativeWind-APIs.
- Neue Listen verwenden `FlashList`; nicht scrollende Unterlisten werden direkt
  gemappt.
- Tests liegen neben der Quelldatei.
- UI-Texte und Accessibility-Labels laufen über die bestehende i18n-Struktur.

## Functional Contract

### Eingabe und Parsing

1. Text und fertiger Speech-to-Text-Transcript werden identisch verarbeitet.
2. Eine Eingabe kann mehrere Artikel enthalten.
3. Der MVP erkennt mindestens Artikelname, Menge, Einheit und Marke in den
   bestätigten Beispielen `2 Liter Milch`, `6 Eier`, `eine Packung Nudeln` und
   `Skyr von ja`.
4. Jeder erkannte Artikel erhält einen expliziten Bearbeitungs-/Sicherheits-
   status.
5. Sprachaufnahmen führen nach dem Stop direkt zur Artikelvorschau. Ein
   separater editierbarer Transcript-Schritt ist nicht Teil des Flows.
6. Wenn Speech-to-Text nicht verfügbar oder verweigert ist, bleibt die
   Texteingabe nutzbar und die App zeigt einen verständlichen Fehlerzustand.

### Händlerauflösung

1. Eine explizite Händlerangabe hat Vorrang vor einem Markenmapping.
2. `ja!` bzw. `ja` als REWE-Eigenmarke routet den Artikel auf die REWE-Liste,
   sofern die Zuordnung eindeutig ist.
3. Unbekannte Marken, fehlende Mappings und widersprüchliche Angaben werden
   nicht automatisch einer Händlerliste zugeordnet.
4. Solche Ergebnisse werden in der Vorschau als unklar markiert und müssen
   bearbeitet oder bestätigt werden.

### Vorschau und Automatisierung

1. Die Vorschau zeigt jeden Artikel separat und erlaubt Änderungen an Name,
   Menge, Einheit, Marke und Händlerliste.
2. Eine bestätigte oder korrigierte eindeutige Zuordnung zählt als positives
   Lernsignal.
3. Identische normalisierte Zuordnungen zählen nicht mehrfach.
4. `positiveAssignmentThreshold` ist konfigurierbar und beträgt im MVP `10`.
5. Nach Erreichen des Schwellenwerts zeigt die App die Abfrage zur
   automatischen lokalen Verarbeitung einmalig.
6. Bei Ablehnung bleibt die Vorschau für weitere Eingaben aktiv.
7. Bei Zustimmung werden nur vollständig und eindeutig lokal aufgelöste
   Ergebnisse ohne offene Konflikte automatisch verarbeitet.
8. Die lokale Automatisierungsentscheidung kann später widerrufen oder geändert
   werden.

### KI-Unterstützung

1. Die lokale Erkennung läuft vor jedem KI-Aufruf.
2. Ohne aktives AI-Abo oder ohne separate Einwilligung erfolgt kein KI-Aufruf.
3. Die KI ist ein Fallback bzw. eine Verbesserung für unklare oder fehlende
   lokale Ergebnisse, nicht der primäre Parser.
4. **Leicht** korrigiert offensichtliche Tippfehler und normalisiert Artikel,
   Mengen und Einheiten.
5. **Mittel** löst zusätzlich unklare Produktnamen, Marken und
   Händlerzuordnungen auf.
6. **Voll** interpretiert die gesamte Eingabe semantisch, zerlegt komplexe
   Formulierungen und schlägt fehlende Details vor.
7. Die KI liefert strukturierte Vorschläge, schreibt aber nie selbst in die
   Einkaufsliste.
8. Widersprüchliche oder weiterhin unsichere KI-Ergebnisse bleiben in der
   Vorschau und brauchen eine Nutzerentscheidung.
9. Anonymisierte Datensammlung für spätere Modellverbesserungen ist nicht Teil
   dieser Version.

### Persistenz und Sync

1. Bestätigte oder sicher automatisch freigegebene Artikel verwenden die
   bestehende `useAddShoppingItem`-/`shopping-list-merge`-Grenze.
2. Mengen werden über den bestehenden Outbox-/SQLite-Pfad offline geschrieben
   und später synchronisiert.
3. Es gibt keine parallele Schreiblogik nur für natürliche Eingaben.
4. Lokale Lern- und Einwilligungszustände dürfen nicht als haushaltsweite
   Einkaufsliste oder globale Wahrheit behandelt werden.
5. Eine neue Supabase-Tabelle ist für den MVP nicht vorgesehen. Sollte die
   Implementierung eine Schemaänderung benötigen, gelten deklaratives Schema,
   RLS, pgTAP und `db:types` als zusätzliche Gates.

## Testing Strategy

### Unit-Tests

- `local-recognition`: Zerlegung mehrerer deutscher Artikel, Mengen, Einheiten,
  Marken, Dezimalkomma und unklare Sprache.
- `retailer-routing`: expliziter Händler vor Marke, `ja!` zu REWE, unbekannte
  und widersprüchliche Mappings.
- `review-and-automation`: positive Lernsignale, Deduplizierung, variabler
  Schwellenwert `10`, einmalige Abfrage, Widerruf und sichere Freigabe.
- `ai-assist`: Abo-/Einwilligungs-Gate, drei Stufen, Fallback-Verhalten und
  keine direkte Schreiboperation.

### Komponenten- und Integrationstests

- RNTL testet Vorschau, Feldkorrekturen, Bestätigung, unklare Zustände und die
  getrennten Zustimmungsdialoge.
- Bestehende Shopping-List-Mutations- und Merge-Tests verifizieren, dass
  bestätigte Batch-Ergebnisse einzeln bzw. merge-konform in Outbox und SQLite
  landen.
- Speech-to-Text wird mit einem fokussierten Harness-/Gerätetest auf iOS und
  Android geprüft. Simulatoren allein gelten nicht als Nachweis für Mikrofon-
  und native Speech-Verhalten.

### Qualitätsgates

- `bun run check`
- `bun run typecheck`
- fokussierte `bun run test <file>`-Aufrufe
- bei lokaler DB-Änderung zusätzlich die relevanten Integrations-/DB-Tests
- keine Verwendung von `bun test`

## Boundaries

### Always

- Lokale Erkennung zuerst und offline-fähig halten.
- Unklarheit explizit anzeigen und vor dem Speichern bestätigen lassen.
- AI-Abo und KI-Einwilligung getrennt prüfen.
- Bestehende Outbox-, Merge-, Auth- und RLS-Grenzen verwenden.
- Beta-Code vollständig außerhalb des bestehenden Add-Item-Flows halten.
- Nur `useAddShoppingItem` und die bestehende Outbox als Schreibgrenze nutzen.
- Parser- und Routinglogik ohne React, Netzwerk oder Datenbank testen.
- Lokale und private Zustände nicht ungeprüft haushaltsweit synchronisieren.

### Ask first

- Neue native Speech-to-Text-Abhängigkeit oder Config-Plugin.
- Jede Änderung an `supabase/schemas/*.sql`, RLS, Synchronisation oder
  generierten Datenbanktypen.
- Auswahl und Betrieb eines konkreten externen KI-Providers oder einer neuen
  Edge Function.
- Änderungen an RevenueCat-Entitlements oder AI-Abo-Produkten.
- Änderungen an bestehenden Shopping-List-Komponenten oder der Beta-Route-
  Freischaltung.
- Weitergabe von Einkaufsdaten oder Transcripts an externe Dienste.
- Änderung des Lernschwellenwerts oder der drei KI-Stufen.

### Never

- KI oder Speech-to-Text als stillschweigende Pflichtabhängigkeit behandeln.
- Unklare Artikel, Marken oder Händler automatisch speichern.
- Die KI direkt auf die gemeinsame Einkaufsliste schreiben lassen.
- Private Einkaufs- oder Speech-Daten in Analytics, Logs oder Crash-Reports
  schreiben.
- Migrationen manuell verfassen oder `database.types.ts` von Hand ändern.
- `bun test` ausführen.

## Success Criteria

1. Die Eingabe `2 Liter Milch, 6 Eier und eine Packung Nudeln, Skyr von ja`
   erzeugt vier getrennte Vorschauartikel mit den erwarteten Mengen/Einheiten;
   Skyr erhält die REWE-Zuordnung.
2. Eine explizite Händlerangabe überschreibt ein kollidierendes Markenmapping.
3. Unbekannte oder widersprüchliche Zuordnungen bleiben vor dem Speichern in
   einem sichtbaren Review-Zustand.
4. Text und Speech-to-Text führen bei identischem Transcript zum gleichen
   Parsergebnis.
5. Speech-to-Text funktioniert offline, sofern die native Plattform-
   erkennung auf dem Gerät verfügbar ist; bei fehlender Berechtigung oder
   Nichtverfügbarkeit bleibt Textinput verfügbar.
6. Nach zehn eindeutigen positiven Artikelzuordnungen erscheint genau eine
   Abfrage zur automatischen lokalen Verarbeitung.
7. Wiederholungen derselben normalisierten Zuordnung erhöhen den Lernzähler
   nicht.
8. Lokale Automatisierung kann ohne KI aktiviert werden.
9. KI wird nur bei aktivem AI-Abo und separater Einwilligung aufgerufen; alle
   drei Stufen sind auswählbar und widerrufbar.
10. Kein KI-Ergebnis umgeht Vorschau, Konfliktprüfung oder den bestehenden
    Outbox-Schreibpfad.
11. Die fokussierten Parser-, Routing-, Automatisierungs-, KI- und UI-Tests
    sowie `bun run check` und `bun run typecheck` sind erfolgreich.
12. Der bestehende manuelle Add-Item-Flow bleibt ohne Verhaltensänderung; die
    Beta kann unabhängig davon getestet und deaktiviert werden.

## Open Questions

1. Welche konkrete native Speech-to-Text-API bzw. welches bestehende oder neue
   Expo-Modul wird für iOS und Android verwendet?
2. Wie werden personalisierte Marken-/Händlerzuordnungen über mehrere Geräte
   behandelt: rein lokal pro Gerät oder accountgebunden synchronisiert?
3. Welche vorhandene Produktidentität darf ein erkannter Markenname automatisch
   mit `product_id` verknüpfen, wenn mehrere lokale Produkte passen?
4. Welche UI-Texte und Einwilligungsdetails sind für den AI-Datentransfer
   rechtlich und produktseitig verbindlich?
