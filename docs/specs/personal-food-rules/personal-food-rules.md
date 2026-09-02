# Spezifikation: Persönliche Lebensmittelregeln

Status: Fachlich freigegeben; UI-Variante A ausgewählt

Bead: `fam-3mw`

Capability-ID: `personal-food-rules`

Ideengrundlage: [`docs/ideas/persoenliche-lebensmittelregeln.md`](../../ideas/persoenliche-lebensmittelregeln.md)

## 1. Annahmen

1. Die Spezifikation beschreibt eine einzelne Fähigkeit: Ein Account-Nutzer verwaltet seine persönlichen Lebensmittelregeln im vorhandenen Profil.
2. Der vorhandene Screen „Profil & Account-Daten“ wird überarbeitet. Es entsteht weder ein neuer Haupteinstieg noch eine neue Profilroute.
3. Die Regeln gelten ausschließlich für Account-Profile. Kinderprofile sind nicht Teil dieser Fähigkeit.
4. Allergien, Unverträglichkeiten und Abneigungen bleiben drei getrennte Kategorien. Es entsteht kein allgemeines Regelmodell mit Schweregrad oder Übersteuerbarkeit.
5. Die Daten gelten accountweit und damit unabhängig vom aktuell gewählten Haushalt.
6. Rezeptfilter, KI, Haushaltsaggregation und medizinische Bewertung sind keine Bestandteile dieser Fähigkeit.
7. Profiländerungen folgen dem bestehenden direkten Supabase- und React-Query-Pfad. Für diese Profileigenschaft wird kein neuer SQLite- oder Outbox-Unterbau eingeführt.
8. Vor der UI-Implementierung werden mehrere statische Mocks für die Überarbeitung der vorhandenen Profilansicht erstellt und vom Maintainer ausgewählt.

Ausgewählt wurde Variante A: eine kompakte Übersicht im vorhandenen Profil mit separaten Auswahl-Sheets pro Kategorie.

## 2. Objective

Nutzer sollen an genau einer vertrauten Stelle festhalten können:

- worauf sie allergisch reagieren,
- was sie nicht vertragen,
- welche Lebensmittel sie nicht mögen.

Die Angaben sind private Profildaten. Sie werden einmal erfasst und stehen dem Account unabhängig vom aktuell gewählten Haushalt zur Verfügung. Diese Spezifikation beschreibt ausschließlich ihre Erfassung und Verwaltung.

### 2.1 User Stories

- Als Nutzer kann ich häufige Allergien auswählen und eigene Allergien ergänzen.
- Als Nutzer kann ich häufige Unverträglichkeiten auswählen und eigene Unverträglichkeiten ergänzen.
- Als Nutzer kann ich frei Lebensmittel angeben, die ich nicht mag.
- Als Nutzer kann ich jeden Eintrag wieder entfernen.
- Als Nutzer sehe ich nach erneutem Öffnen des Profils meine gespeicherten Angaben.
- Als Nutzer eines weiteren Haushalts muss ich dieselben Angaben nicht erneut erfassen.
- Als Haushaltsmitglied kann ich die Angaben anderer Account-Nutzer weder lesen noch verändern.

## 3. Nicht-Ziele

Diese Fähigkeit umfasst ausdrücklich nicht:

- Rezeptsuche, Rezeptfilterung oder Rezeptbewertung
- KI-Kontext, Prompts oder Modellaufrufe
- Vereinigung der Regeln mehrerer Haushaltsmitglieder
- Anzeige fremder Regeln innerhalb eines Haushalts
- Regeln für Kinderprofile
- Schweregrade, verträgliche Mengen oder medizinische Diagnosen
- temporäre Ausnahmen innerhalb des Profils
- aus Bewertungen oder Verhalten gelernte Präferenzen
- feste Verknüpfungen zu `Product`-Datensätzen
- einen neuen Profil-Hub, eine neue Route oder zusätzliche Hauptnavigation

## 4. Fachlicher Vertrag

### 4.1 Kategorien

Das Profil stellt logisch genau diese drei Sammlungen bereit:

```ts
type ProfileFoodRules = {
  allergies: FoodSelection<AllergyCode>[];
  intolerances: FoodSelection<IntoleranceCode>[];
  dislikedFoods: CustomFoodSelection[];
};

type CustomFoodSelection = {
  source: 'custom';
  label: string;
  normalizedLabel: string;
};

type FoodSelection<Code extends string> =
  | { source: 'preset'; code: Code }
  | CustomFoodSelection;
```

Dieser Typ beschreibt den fachlichen Vertrag und schreibt noch keine konkrete Tabellenform vor. Die Implementierungsplanung wählt die kleinste Profilrepräsentation, die Preset-Schlüssel, benutzerlesbare freie Angaben, Validierung und private Zugriffsregeln zuverlässig erhält.

Die Kategorie eines Eintrags ist seine Bedeutung:

- `allergies` dokumentiert eine vom Nutzer angegebene Allergie.
- `intolerances` dokumentiert eine vom Nutzer angegebene Unverträglichkeit.
- `dislikedFoods` dokumentiert ein Lebensmittel, das der Nutzer nicht mag.

Ein gleicher Begriff darf bewusst in mehreren Kategorien vorkommen. Innerhalb derselben Kategorie sind semantisch gleiche Duplikate nicht erlaubt.

### 4.2 Allergie-Presets

Die Allergieauswahl verwendet stabile interne Codes für die 14 Stoffgruppen aus Anhang II der EU-Lebensmittelinformationsverordnung:

```ts
const ALLERGY_CODES = [
  'gluten-containing-cereals',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree-nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphur-dioxide-sulphites',
  'lupin',
  'molluscs',
] as const;
```

Die deutsche Oberfläche zeigt verständliche Bezeichnungen. `milk` wird als „Milch / Milcheiweiß“ bezeichnet, damit es nicht mit Laktoseintoleranz verwechselt wird. Die Auswahl enthält zusätzlich einen Weg, eine eigene Allergie einzutragen.

Preset-Codes sind persistierte Verträge und dürfen später nicht durch übersetzte Anzeigenamen ersetzt werden. Neue Presets dürfen ergänzt werden; bestehende Codes dürfen nicht still umbenannt oder in ihrer Bedeutung verändert werden.

### 4.3 Unverträglichkeits-Presets

Die erste Auswahl bleibt bewusst klein:

```ts
const INTOLERANCE_CODES = [
  'lactose',
  'fructose-malabsorption',
  'sorbitol-malabsorption',
  'celiac-gluten',
] as const;
```

Die Oberfläche bezeichnet `celiac-gluten` als „Zöliakie / Gluten strikt meiden“ und stellt es nicht als klassische Intoleranz dar. Eine Weizenallergie bleibt davon getrennt.

„Histaminintoleranz“ ist kein prominentes Preset. Nutzer können Histamin als eigene Unverträglichkeit eintragen. Die App diagnostiziert, bestätigt oder verwirft diese Angabe nicht.

### 4.4 Eigene Einträge und Normalisierung

Eigene Angaben erfüllen folgende Regeln:

- Führende und nachfolgende Leerzeichen werden entfernt.
- Mehrere aufeinanderfolgende Leerzeichen werden zu einem Leerzeichen zusammengeführt.
- Der Vergleichsschlüssel verwendet Unicode-NFKC und `toLocaleLowerCase('de-DE')`.
- Der eingegebene Anzeigename bleibt für die Oberfläche erhalten.
- Ein Eintrag muss nach dem Trimmen zwischen 1 und 80 Zeichen lang sein.
- Derselbe normalisierte Begriff kann innerhalb einer Kategorie nur einmal vorkommen.
- Es gibt keine unscharfe oder synonymbasierte Zusammenführung. „Erdnuss“ und „Peanut“ werden nicht geraten oder automatisch gleichgesetzt.
- Leere oder ausschließlich aus Leerzeichen bestehende Angaben werden nicht gespeichert.

Presets werden über ihren Code dedupliziert. Wenn eine Eingabe eindeutig exakt einem bekannten deutschen Preset-Namen entspricht, soll die Oberfläche das Preset anbieten, anstatt eine zweite freie Variante anzulegen.

### 4.5 Speichern und Fehlerzustände

- Die drei Kategorien werden gemeinsam mit den übrigen bearbeitbaren Profildaten über die vorhandene Aktion „Änderungen speichern“ persistiert.
- Bestehende Account- und Passwortfunktionen behalten ihr aktuelles Verhalten.
- Ein Speichervorgang ist für die Lebensmittelregeln atomar: Entweder sind alle drei Kategorien gespeichert oder keine davon.
- Bei einem Fehler bleiben die Eingaben im Formular erhalten und eine verständliche Fehlermeldung wird angezeigt.
- Nach erfolgreichem Speichern wird die Profilquery invalidiert, sodass ein erneutes Öffnen den Serverzustand zeigt.
- Bestehende Profile ohne diese Daten werden als drei leere Sammlungen behandelt.

## 5. UX-Vertrag

Die vorhandene Profilbearbeitung erhält die Gruppe „Lebensmittel & Verträglichkeit“. Ihre genaue visuelle Komposition wird erst durch die vorgeschriebenen statischen Mocks festgelegt.

Unabhängig vom gewählten Mock muss die Oberfläche:

- Allergien, Unverträglichkeiten und „Mag ich nicht“ deutlich getrennt darstellen,
- vorhandene Einträge ohne Öffnen eines zweiten Screens erkennen lassen,
- Presets ohne Texteingabe auswählbar machen,
- eigene Angaben mit wenigen Schritten hinzufügen lassen,
- für jeden Eintrag eine eindeutig beschriftete Entfernen-Aktion anbieten,
- Auswahl und Entfernen mit Screenreader verständlich ankündigen,
- leere Zustände ohne warnende oder diagnostizierende Sprache darstellen,
- knapp erklären, dass es sich um persönliche Angaben und nicht um eine medizinische Diagnose handelt.

Die Oberfläche darf nicht behaupten, ein Nutzer sei durch diese Erfassung vor allergenen Lebensmitteln geschützt. Diese Fähigkeit erfasst nur Selbstauskünfte und prüft keine Rezepte.

## 6. Datenschutz- und Datenbankgrenzen

- Lebensmittelregeln sind private Accountdaten und niemals Haushaltsdaten.
- Lesen und Schreiben ist ausschließlich für `auth.uid() = user_id` beziehungsweise das eigene `profiles.id` erlaubt.
- Die bestehende Profil-RLS darf nicht erweitert werden.
- `public.household_member_profiles(uuid)` darf weiterhin nur die ausdrücklich freigegebenen öffentlichen Profilfelder liefern. Keine Lebensmittelregel darf in ihren Rückgabetyp oder ihre Abfrage gelangen.
- Anonyme Nutzer dürfen keine Lebensmittelregeln lesen oder verändern.
- Service-Role-Zugriff folgt den bestehenden Backendgrenzen und ist keine Berechtigung für neue Produktflüsse.
- Freie Angaben werden als Nutzerdaten behandelt und weder als Anweisungen noch als vertrauenswürdige medizinische Fakten interpretiert.

Die Datenbankänderung beginnt im deklarativen Schema unter `supabase/schemas/`. Eine Migration wird ausschließlich mit `bun run db:diff` erzeugt und niemals von Hand geschrieben oder editiert. Nach der Änderung werden die generierten Supabase-Typen aktualisiert.

## 7. Tech Stack

- Expo SDK 57 und Expo Router 57
- React Native 0.86 und React 19.2
- TypeScript 6
- React Hook Form und Zod 4 für Formularzustand und Validierung
- TanStack React Query 5 für Profilquery und Invalidierung
- Supabase Postgres und RLS für Persistenz und Isolation
- NativeWind 4 und bestehende Theme-Tokens für Styling
- Jest 29 und React Native Testing Library 14 für Komponenten- und Vertragstests
- pgTAP für Datenbank- und RLS-Verträge
- Biome für Formatierung und statische Prüfung

Es werden keine neuen Abhängigkeiten und keine nativen Module benötigt.

## 8. Commands

Vor einer späteren Implementierung werden die versionierten Expo-SDK-57-Dokumente gelesen. Für die Umsetzung und Verifikation gelten diese ausführbaren Befehle:

```bash
# Deklaratives Datenbankschema in Migration überführen
bun run db:diff -- -f personal_food_rules

# Gezielte Datenbanktests
bun run test:db supabase/tests/02_profiles.test.sql

# Supabase-Typen nach Schemaänderung aktualisieren
bun run db:types

# Gezielte Jest-Tests
bun run test src/lib/db/zod/profile.contract.test.ts
bun run test src/features/profile/edit-profile-screen.test.tsx
bun run test src/features/profile/food-rules.test.ts

# Repository-Prüfungen
bun run check
bun run typecheck

# Nachweis, dass kein weiterer Schema-Drift verbleibt
bun run db:diff

# Manueller Lauf im vorhandenen Dev Client
bun run ios:development
bun run android:development
```

Die vollständige Jest-Suite wird für diese Änderung nicht ausgeführt. Datenbankprozesse, Metro, Simulatoren und Container werden nicht eigenmächtig gestartet oder beendet.

## 9. Project Structure

Die genaue Dateiliste wird in der Implementierungsplanung festgelegt. Die Spec erwartet folgende Verantwortungsorte:

```text
docs/ideas/persoenliche-lebensmittelregeln.md
  Produktidee, Recherche und bewusst verworfener Umfang

docs/specs/personal-food-rules/personal-food-rules.md
  Fachlicher und technischer Vertrag dieser Fähigkeit

supabase/schemas/02_profiles.sql
  Deklarative, private Profilpersistenz

supabase/tests/02_profiles.test.sql
  Datenconstraints und RLS-Isolation

src/lib/database.types.ts
  Generierter Supabase-Vertrag

src/lib/db/zod/profile.zod.ts
  Eingabevalidierung und Abbildung auf den Datenbankvertrag

src/features/profile/food-rules.ts
  Presets, Typen und reine Normalisierungslogik

src/features/profile/edit-profile-screen.tsx
src/features/profile/edit-profile-screen.android.tsx
  Überarbeitete vorhandene Profilbearbeitung, als eigenständige Plattformdateien

src/features/profile/edit-profile-screen.test.tsx
src/features/profile/food-rules.test.ts
  Nutzerverhalten und reine Domänenverträge
```

Falls die UI-Felder als eigener Formularbaustein ausgelagert werden, liegen Original und harte Android-Kopie unter `src/features/profile/forms/`. Es entsteht keine neue Datei unter `src/app/`, weil sich die Route nicht ändert.

## 10. Code Style

Preset-Werte werden einmal als `as const` definiert und daraus typisiert. Normalisierung bleibt eine kleine reine Funktion. Es gibt keine doppelten String-Unionen, kein `any` und keine Casting-Wrapper.

```ts
export const ALLERGY_CODES = ['eggs', 'fish', 'peanuts'] as const;

export type AllergyCode = (typeof ALLERGY_CODES)[number];

export function normalizeFoodRuleLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('de-DE');
}
```

UI-Labels werden getrennt von persistierten Codes gepflegt. Kommentare erklären Sicherheits- oder Datenschutzgrenzen, nicht die Änderungshistorie.

## 11. Testing Strategy

Vor Änderungen an React-Native-Komponententests werden die lokalen RNTL-Regeln und die installierten RNTL-14-Dokumente gelesen.

### 11.1 Reine Domänentests

`src/features/profile/food-rules.test.ts` prüft mindestens:

- stabile Preset-Codes und eindeutige Labels,
- Trimmen, Whitespace-Kollaps, Unicode-NFKC und deutsche Kleinschreibung,
- Ablehnung leerer und zu langer Eingaben,
- Duplikaterkennung innerhalb einer Kategorie,
- erlaubte Gleichheit über verschiedene Kategorien hinweg,
- Hinzufügen und Entfernen als Gegenaktionen.

### 11.2 Zod- und Datenbankvertrag

`src/lib/db/zod/profile.contract.test.ts` prüft:

- partielle Profilupdates ohne unbeabsichtigtes Löschen bestehender Werte,
- leere Defaults für ältere Profile,
- Abbildung aller drei Kategorien auf den generierten Datenbanktyp,
- Ablehnung unbekannter Preset-Codes und ungültiger eigener Einträge.

### 11.3 Komponententests

`src/features/profile/edit-profile-screen.test.tsx` prüft beobachtbares Nutzerverhalten:

- gespeicherte Werte werden in allen drei Kategorien angezeigt,
- ein Preset kann ausgewählt und wieder entfernt werden,
- eine eigene Angabe kann hinzugefügt und wieder entfernt werden,
- ein Duplikat erzeugt verständliches Feedback und keinen zweiten Eintrag,
- Speichern übermittelt alle drei Kategorien gemeinsam,
- ein Serverfehler erhält die Formulareingaben und zeigt einen Fehler,
- Account-, Avatar- und Passwortfunktionen bleiben erreichbar.

Tests prüfen Rollen, Labels und sichtbares Verhalten. Sie greifen nicht auf interne Komponenteninstanzen oder Implementierungsdetails zu.

### 11.4 pgTAP

`supabase/tests/02_profiles.test.sql` weist nach:

- neue Profile erhalten leere Sammlungen,
- erlaubte Preset- und eigene Werte können am eigenen Profil gespeichert werden,
- ungültige Daten verletzen die vorgesehenen Constraints,
- Nutzer können die Lebensmittelregeln anderer Profile weder lesen noch verändern,
- anonyme Clients erhalten keinen Zugriff,
- `household_member_profiles()` gibt die neuen privaten Felder nicht zurück.

### 11.5 Manuelle Verifikation

Nach Auswahl eines statischen Mocks wird der Profilfluss auf iOS und Android geprüft:

1. Profil mit leeren Listen öffnen.
2. Je ein Preset und einen eigenen Eintrag pro Kategorie hinzufügen.
3. Einen Eintrag jeder Kategorie wieder entfernen.
4. Speichern, Ansicht verlassen und erneut öffnen.
5. Prüfen, dass nur die verbleibenden Einträge erscheinen.
6. Den aktiven Haushalt wechseln und prüfen, dass dieselben Accountdaten sichtbar bleiben.
7. Mit einem zweiten Nutzer prüfen, dass fremde Angaben nicht sichtbar sind.

## 12. Boundaries

### Always

- Deklaratives Schema zuerst ändern und Migration ausschließlich per `bun run db:diff` erzeugen.
- Private RLS-Isolation und `household_member_profiles()` mit pgTAP absichern.
- Nach Datenbankänderungen `src/lib/database.types.ts` mit `bun run db:types` aktualisieren.
- Original und harte Android-Kopie jeder betroffenen plattformübergreifenden Datei synchron halten.
- Vor UI-Code mehrere statische Mocks erstellen und die Auswahl des Maintainers abwarten.
- Formulareingaben mit Zod und Datenbankconstraints validieren.
- Hinzufügen und Entfernen vollständig und symmetrisch umsetzen.
- Nur gezielte, relevante Jest- und pgTAP-Tests ausführen.

### Ask First

- Eine neue Route oder einen neuen Haupteinstieg anlegen.
- Die Daten in eine haushaltsweite Tabelle verschieben oder RLS verbreitern.
- Schweregrad, Menge, Diagnose oder medizinische Hinweise ergänzen.
- Neue Abhängigkeiten oder native Module hinzufügen.
- Rezept-, KI- oder Haushaltsverbraucher anbinden.
- Den bestehenden direkten Profilpfad durch eine neue lokale Sync-Entität ersetzen.

### Never

- Migrationen manuell schreiben oder editieren.
- Lebensmittelregeln über `household_member_profiles()` oder Haushalts-RLS offenlegen.
- Kinderprofile stillschweigend in den Scope aufnehmen.
- Eine freie Angabe als medizinisch bestätigt behandeln.
- Ein `Product` als Identität eines allgemeinen Lebensmittelbegriffs verwenden.
- `bun test` oder die vollständige Jest-Suite für diese Änderung ausführen.
- Aktive Metro-, Simulator- oder Datenbankprozesse eigenmächtig beenden.

## 13. Success Criteria

Die Fähigkeit ist abnahmebereit, wenn:

1. die vorhandene Profilbearbeitung die drei klar getrennten Kategorien Allergien, Unverträglichkeiten und „Mag ich nicht“ enthält,
2. kein neuer Haupteinstieg und keine neue Profilroute entstanden ist,
3. alle 14 Allergie-Presets mit stabilen Codes verfügbar sind,
4. Laktose, Fruktosemalabsorption, Sorbitmalabsorption und Zöliakie als getrennte Unverträglichkeits-Presets verfügbar sind,
5. Nutzer in jeder Kategorie eigene Angaben von 1 bis 80 Zeichen hinzufügen und jeden Eintrag entfernen können,
6. Normalisierung Duplikate innerhalb einer Kategorie verhindert, ohne unterschiedliche Kategorien zusammenzuführen,
7. alle drei Kategorien mit der bestehenden Speicheraktion atomar persistiert werden,
8. gespeicherte Angaben nach erneutem Öffnen und nach einem Haushaltswechsel unverändert erscheinen,
9. bestehende Profile ohne Werte fehlerfrei drei leere Kategorien erhalten,
10. kein anderer Haushaltsnutzer und kein anonymer Client diese Angaben lesen oder verändern kann,
11. `household_member_profiles()` keine Lebensmittelregeln offenlegt,
12. keine Rezept-, KI-, Haushaltsaggregations- oder Kinderprofillogik hinzugefügt wurde,
13. die ausgewählte UI auf iOS und Android funktional gleichwertig umgesetzt ist,
14. die gezielten Domänen-, Zod-, Komponenten- und pgTAP-Tests bestehen,
15. `bun run check`, `bun run typecheck` und ein abschließendes leeres `bun run db:diff` erfolgreich sind.

## 14. Open Questions

Für die Profilerfassung bestehen keine offenen fachlichen Fragen. Vor der Implementierung bleibt genau eine UI-Freigabe notwendig:

- Welcher statische Mock soll die vorhandene Profilbearbeitung bestimmen?

## 15. Freigaberegel

Diese Spezifikation autorisiert noch keine Planung oder Implementierung. Nach ausdrücklicher fachlicher Freigabe folgt Phase 2 des `spec-driven-development`-Workflows: ein technischer Implementierungsplan nach `planning-and-task-breakdown`.
