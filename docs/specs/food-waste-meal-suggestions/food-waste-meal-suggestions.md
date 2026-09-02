# Spezifikation: Mahlzeitenvorschläge gegen Lebensmittelverschwendung

Status: Fachlich abgestimmt, Implementierungsplanung ausstehend

Bead: `fam-2f6`

Capability-ID: `food-waste-meal-suggestions`

## 1. Annahmen

Diese Annahmen sind Teil des Entwurfs und müssen vor der Implementierungsplanung bestätigt werden:

1. Die Funktion wird in Version 1 ausschließlich vom Nutzer ausgelöst. Proaktive Mitteilungen sind eine spätere, getrennte Funktion.
2. Eine erfolgreiche Antwort enthält zwei oder drei deutlich unterschiedliche Mahlzeitenvorschläge.
3. Pro Vorschlag dürfen höchstens zwei Zutaten fehlen. Sie werden ausdrücklich als noch zu besorgen angezeigt.
4. Bestehende Rezepte werden immer zuerst deterministisch durchsucht: zunächst der veröffentlichte globale Rezeptkatalog, danach geeignete Rezepte des aktiven Haushalts.
5. Nur wenn diese bestehenden Quellen nicht mindestens zwei gültige, ausreichend unterschiedliche Vorschläge liefern, darf ein begrenzter generativer Fallback die Lücken füllen.
6. Es gibt keine Agenten, Agent Skills, Tools, Schleifen oder autonomen Aktionen. Ein Fallback besteht aus höchstens einem serverseitigen Modellaufruf mit strukturiertem Ergebnis.
7. Das Modell erhält keine Autorität über Bestand, Mengen, Haltbarkeit, Allergien, Lebensmittelsicherheit, Berechtigungen oder Mutationen.
8. Ein Vorschlag verändert weder Bestand noch Einkaufszettel noch Rezepte. Jede spätere Übernahme ist eine separate, ausdrücklich bestätigte Nutzeraktion.
9. Wasser, Salz, Pfeffer und neutrales Speiseöl bilden den vollständigen global vorausgesetzten Basissatz. Andere Zutaten werden nicht stillschweigend als vorhanden behandelt.

## 2. Ziel

Die Funktion hilft einem Haushaltsmitglied, eine konkrete Mahlzeit auszuwählen, durch die vorrangig Lebensmittel verbraucht werden, die sonst wahrscheinlich weggeworfen würden.

Die App liefert standardmäßig bis zu drei Perspektiven:

- **Lebensmittel retten:** nutzt möglichst viele oder besonders dringende Lebensmittel.
- **Schnell fertig:** minimiert die aktive und gesamte Zubereitungszeit.
- **Wenig einkaufen:** benötigt möglichst wenige zusätzliche Zutaten.

Wenn nur zwei Perspektiven als gültige und tatsächlich unterschiedliche Vorschläge erzeugt werden können, werden zwei angezeigt. Weniger als zwei Vorschläge gelten nicht als erfolgreiche Antwort.

Die Zielperspektiven haben eine feste Priorität:

1. `MAXIMIZE_RESCUE`
2. `FASTEST`
3. `MINIMAL_SHOPPING`

`MAXIMIZE_RESCUE` ist immer enthalten. Als zweite Perspektive folgt `FASTEST`, sofern daraus ein materiell anderer Vorschlag entsteht; andernfalls rückt `MINIMAL_SHOPPING` nach. Ein dritter Vorschlag ergänzt die noch fehlende Perspektive nur dann, wenn er ebenfalls materiell unterschiedlich ist.

## 3. Nicht-Ziele

Version 1 umfasst ausdrücklich nicht:

- Erfassung oder Korrektur des Bestands
- Bild-, Beleg-, Barcode- oder Spracheingabe
- proaktive Benachrichtigungen
- Wochenplanung oder automatische Planänderungen
- automatische Änderungen an Bestand, Einkaufszettel oder Rezepten
- autonome Agenten, Agent Skills oder Modell-Tool-Aufrufe
- eine allgemeine Chatfunktion
- eine medizinische, allergologische oder lebensmittelrechtliche Bewertung
- das Raten, ob ein physisch vorhandenes Lebensmittel noch genießbar ist
- die Übernahme bestehender KI-Workflows, Prompts oder Workflow-Bezeichnungen

## 4. Fachlicher Ablauf

```text
Nutzeranfrage
    |
    v
autorisierter Haushaltskontext
    |
    v
deterministische Eignung und Priorisierung
    |
    v
deterministische Katalogsuche und Bewertung
    |
    +-- mindestens 2 unterschiedliche Treffer --> Antwort ohne Modell
    |
    +-- weniger als 2 Treffer
            |
            v
      einmaliger, begrenzter Fallback
            |
            v
      Schema-, Referenz-, Mengen-, Regel- und Sicherheitsprüfung
            |
            +-- gültig --> fehlende Perspektiven ergänzen
            |
            +-- ungültig --> kein Reparatur- oder Agenten-Loop
```

### 4.1 Anfrage

Der Client übermittelt nur die Nutzerabsicht und optionale Darstellungs- oder Zeitpräferenzen. Er übermittelt nicht den vermeintlichen Bestand als Wahrheit.

```ts
type MealSuggestionRequest = {
  householdId: string;
  intent: 'WHAT_SHOULD_I_EAT_TODAY';
  servings?: number;
  maxTotalMinutes?: number;
  participantScope?:
    | { kind: 'ALL_HOUSEHOLD' }
    | { kind: 'SELECTED'; participantIds: string[] };
};
```

Der Server leitet Nutzer-ID und Berechtigungen aus der authentifizierten Sitzung ab. Er liest den erlaubten Haushaltsbestand selbst und prüft die Haushaltsmitgliedschaft über die bestehende RLS-Autorität. Ohne explizite Auswahl gilt `ALL_HOUSEHOLD`: Alle Account- und Kinderprofile des aktiven Haushalts werden berücksichtigt. Bei `SELECTED` validiert der Server jede Referenz gegen den Haushalt; die Auswahl wird niemals ungeprüft an das Modell weitergereicht.

### 4.2 Eignung des Bestands

Nur deterministische Logik entscheidet, welche Bestandseinträge überhaupt berücksichtigt werden dürfen.

Ein Eintrag ist für Version 1 nur geeignet, wenn:

- er nicht gelöscht ist,
- seine Menge größer als null ist,
- seine Einheit ohne Raten verarbeitet werden kann,
- sein erfasster Zustand ihn nicht explizit ausschließt,
- sein abgeleitetes effektives MHD nicht in der Vergangenheit liegt,
- alle für den jeweiligen Pfad benötigten Sicherheits- und Allergeninformationen verifiziert sind.

Für die Datumslogik gelten die Verträge des Moduls `inventory-lifecycle`:

- `expiry_date` ist das ursprüngliche MHD.
- `expiry_user_set = 1` dokumentiert, dass der Nutzer dieses MHD manuell gesetzt hat.
- `opened_at IS NOT NULL` bedeutet, dass die Packung geöffnet ist.
- Die Haltbarkeit nach dem Öffnen wird deterministisch aus verifizierten Produkt-, Kategorie- und Lagerortregeln berechnet.
- Das effektive MHD ist das frühere vorhandene Datum aus `expiry_date` und `opened_at + Öffnungshaltbarkeit`.

```ts
const effectiveExpiry = earliestDefined(
  expiryDate,
  openedAt === null ? null : addDays(openedAt, calculatedOpenedShelfLifeDays),
);
```

Das effektive MHD wird immer abgeleitet und nicht in `expiry_date` zurückgeschrieben. Dadurch bleiben das ursprüngliche MHD, seine Herkunft und der Öffnungszeitpunkt nachvollziehbar. Fehlt eines der beiden Daten, wird das jeweils vorhandene verwendet; fehlen beide, bleibt das effektive MHD unbekannt. Ein vergangenes effektives MHD wird in Version 1 konservativ nicht für automatische Vorschläge verwendet. Die Funktion trifft damit keine Aussage über die tatsächliche Genießbarkeit.

Stück-, Packungs- oder Portionsmengen werden nur dann umgerechnet, wenn ein autoritatives Stück- oder Portionsgewicht vorliegt. Andernfalls sind ausschließlich Vergleiche in derselben Einheit erlaubt.

### 4.3 Priorisierung

Die Priorisierung ist normale, versionierte Domänenlogik. Gleicher autoritativer Zustand muss immer dieselbe Reihenfolge und dieselben Begründungscodes ergeben.

Version 1 verwendet nur bereits belastbare Signale:

1. Nähe des deterministisch abgeleiteten effektiven MHDs
2. Verderblichkeit der verifizierten Lebensmittelklasse
3. verwertbare Menge und potenziell vermeidbarer Verlust
4. Eignung für Rezepte im Katalog

`opened_at`, persönliche Vorlieben und früherer Abfall dürfen erst einfließen, wenn dafür autoritative, datenschutzkonforme Datenquellen existieren. Sie werden nicht aus Namen oder Nutzungsmustern geraten.

Das Ergebnis der Priorisierung ist kein bloßer Score, sondern ein erklärbarer Vertrag:

```ts
type PriorityFood = {
  inventoryItemId: string;
  productId: string | null;
  available: { value: number; unit: string };
  priorityRank: number;
  reasonCodes: Array<
    | 'EXPIRY_SOON'
    | 'HIGHLY_PERISHABLE'
    | 'LARGE_WASTE_POTENTIAL'
    | 'CATALOG_MATCH'
  >;
};
```

Der numerische Score bleibt intern. Produktlogik und Tests beziehen sich auf Rangfolge und Begründungscodes, nicht auf einen Modell-Prompt.

### 4.4 Allergien und harte Ernährungsregeln

Allergien und Unverträglichkeiten sind harte Ausschlussregeln. Ernährungs-Tags wie `vegetarian` oder `gluten_free` ersetzen keine Allergenprüfung.

Die Regeln werden in den privaten Profileinstellungen von Account-Profilen sowie verwalteten Kinderprofilen gepflegt. Die genaue physische Tabellenform wird erst in der Implementierungsplanung festgelegt; die Daten dürfen dabei nicht über eine breitere bestehende Profil-SELECT-Policy offengelegt werden.

Standardmäßig bildet das Backend aus allen Profilen des aktiven Haushalts eine gemeinsame Ausschlussmenge. Für eine konkrete Mahlzeit darf der Nutzer später ausdrücklich eine Teilmenge der Mitessenden auswählen. Das Backend gibt weder die individuellen Regeln noch ihre Zuordnung zu Personen an den Client oder das Modell aus. Der Modellkontext enthält ausschließlich Zutaten, die nach Anwendung der gemeinsamen Regeln noch zulässig sind.

Ein Vorschlag darf nur entstehen, wenn alle verwendeten Zutaten gegen diese autoritative, für die Anfrage gebildete Allergenprojektion geprüft werden können. Kann eine Zutat nicht sicher klassifiziert werden, wird der Vorschlag verworfen. Private Tracking-Daten werden dafür weder automatisch gelesen noch in Haushaltsdaten kopiert.

### 4.5 Bestehende Rezepte zuerst

Der Server durchsucht vorhandene Rezepte in einer festen Reihenfolge und ohne Modell:

1. veröffentlichte globale Katalogrezepte
2. Rezepte des aktiven Haushalts
3. erst bei unzureichender Abdeckung den begrenzten generativen Fallback

Ein bestehendes Rezept ist nur ein Kandidat, wenn:

- es keine harte Nutzerregel verletzt,
- alle Zutaten eindeutig auf Bestand, erlaubte Grundzutaten oder fehlende Zutaten abgebildet werden können,
- höchstens zwei Zutaten fehlen,
- Mengen und Einheiten vergleichbar sind,
- sein Sicherheitsstatus für die enthaltenen Lebensmittelklassen ausreicht.

Als vorhandene Grundzutaten gelten ausschließlich Wasser, Salz, Pfeffer und neutrales Speiseöl. Sie zählen nicht zu den höchstens zwei fehlenden Zutaten. Butter, Mehl, Zucker, Brühe, Knoblauch, Zwiebeln, Kräuter, weitere Gewürze und alle anderen Produkte müssen entweder im Bestand vorhanden sein oder ausdrücklich als fehlend erscheinen.

Ein veröffentlichtes globales Katalogrezept darf nur mit einer redaktionellen oder gleichwertig verifizierten Freigabe als geprüft gelten. Ein selbst angelegtes Haushaltsrezept wird nicht automatisch zu einem geprüften Rezept. Allergien, Mengen und vorhandene Zutaten werden für beide Quellen bei jeder Anfrage neu validiert.

Enthält ein Haushaltsrezept riskante Lebensmittelklassen, darf es nur vorgeschlagen werden, wenn es nachweislich aus einem freigegebenen Katalogrezept übernommen wurde oder später einen eigenen, autoritativen Freigabestatus erhalten hat. Ohne diesen Nachweis gelten für Haushaltsrezepte dieselben Positivlistenbeschränkungen wie für den generativen Fallback.

Die Rangfolge berücksichtigt in dieser Reihenfolge:

1. Nutzung hoch priorisierter Lebensmittel
2. Anzahl und Anteil verwerteter priorisierter Lebensmittel
3. Anzahl fehlender Zutaten
4. Zubereitungszeit
5. Abweichung von der gewünschten Portionszahl

Aus den gültigen Kandidaten werden unterschiedliche Vorschläge für die Zielperspektiven gewählt. Dasselbe Rezept darf nicht mehrfach mit lediglich anderer Beschriftung erscheinen. Bei ansonsten gleich guten Treffern wird ein bekanntes Haushaltsrezept vor einem globalen Katalogrezept bevorzugt.

### 4.6 Begrenzter generativer Fallback

Der Fallback soll fehlende Katalogabdeckung auffangen, ohne dem Modell freie Autorität über Kochlogik oder Sicherheit zu geben.

Version 1 verwendet deshalb **geprüfte Zubereitungsmuster**. Ein Muster definiert:

- erlaubte und verbotene Lebensmittelklassen je Slot,
- minimale und maximale Mengen,
- feste sicherheitsrelevante Zubereitungsschritte,
- zulässige optionale Schritte,
- passende Einheiten,
- maximale Zeit,
- erlaubte Grundzutaten,
- maximal zwei zusätzliche Zutaten.

Beispiele für mögliche Muster sind Suppe, Ofengemüse oder eine vollständig durchgegarte Pfanne. Die konkrete Musterliste ist redaktionell klein und versioniert. Sie ist kein zweiter Rezeptkatalog: Wenige geprüfte Muster können mit vielen verifizierten Zutaten kombiniert werden.

Das Modell darf ausschließlich:

- ein vom Server angebotenes Muster auswählen,
- angebotene Lebensmittel-Aliase passenden Slots zuordnen,
- bis zu zwei fehlende Zutaten aus einer erlaubten Liste wählen,
- eine kurze Bezeichnung und optionale, nicht sicherheitsrelevante Geschmacksvariante formulieren.

Das Modell darf nicht:

- freie Kochschritte erzeugen,
- Lebensmittel, Mengen oder IDs hinzufügen,
- die Eignung oder Sicherheit eines Lebensmittels bewerten,
- Allergien oder Regeln lockern,
- weitere Daten abrufen,
- Funktionen oder Tools aufrufen,
- eine Mutation auslösen.

Die endgültigen Zutatenmengen und Schritte werden nach der Validierung deterministisch aus dem gewählten Muster gerendert. Damit ist der Fallback kreativ kombinatorisch, aber nicht frei textgenerativ.

Unklassifizierte Lebensmittel dürfen nicht in einem generierten Fallback verwendet werden. Sie können nur über ein geprüftes Katalogrezept vorgeschlagen werden.

Version 1 versucht keine vollständige Lebensmittelsicherheitsklassifizierung. Der generative Pfad verwendet ausschließlich eine kleine, versionierte Positivliste sicher beherrschbarer Lebensmittelklassen, beispielsweise Gemüse, Kartoffeln, Reis, Nudeln, Konserven und verzehrfertige Milchprodukte. Rohes Fleisch, Geflügel, Fisch, Eier, trockene Hülsenfrüchte sowie jede unbekannte Klasse sind vom generativen Pfad ausgeschlossen und dürfen nur über ein geprüftes Katalogrezept erscheinen.

Open-Food-Facts-Kategorien dürfen als Signal für eine deterministische Zuordnung dienen, sind als externe, crowdsourced Daten aber niemals alleinige Sicherheitsautorität. Nur eine explizit erlaubte und verifizierte Zuordnung führt zu einer Positivlistenklasse; andernfalls lautet das Ergebnis `UNKNOWN`.

### 4.7 Modellkontext

Das Modell erhält nur den kleinsten notwendigen Kontext und ausschließlich kurzlebige Aliase. Datenbank-UUIDs, Haushalts-IDs, Nutzer-IDs und private Tracking-Daten werden nicht übertragen.

```ts
type FallbackModelInput = {
  requestedGoals: Array<'MAXIMIZE_RESCUE' | 'FASTEST' | 'MINIMAL_SHOPPING'>;
  servings: number;
  foods: Array<{
    alias: string;
    displayName: string;
    available: { value: number; unit: string };
    priorityRank: number;
    allowedSlotKinds: string[];
  }>;
  allowedStaples: ['WATER', 'SALT', 'BLACK_PEPPER', 'NEUTRAL_COOKING_OIL'];
  allowedMissingIngredients: string[];
  preparationPatterns: Array<{
    alias: string;
    slotKinds: string[];
    maxTotalMinutes: number;
  }>;
};
```

Der Provider und sein Antwortformat bleiben hinter einer internen Schnittstelle. Weder Client noch Domänenlogik importieren Provider-Typen.

### 4.8 Speichern, gekocht bestätigen und Bestand prüfen

Ein angezeigter Vorschlag bleibt zunächst read-only. Der Nutzer erhält zwei getrennte Entscheidungen:

1. **Rezept speichern:** Übernimmt einen noch nicht im Haushalt vorhandenen Vorschlag ausdrücklich in die Haushaltsrezepte. Diese Aktion verändert keinen Bestand.
2. **Gekocht:** Bestätigt, dass die Mahlzeit tatsächlich zubereitet wurde, und öffnet ein Bestands-Review mit den vorgeschlagenen Mengen.

Beide Entscheidungen sind unabhängig. Ein Rezept kann für später gespeichert werden, ohne als gekocht zu gelten. Umgekehrt kann ein Nutzer eine Mahlzeit kochen und den Bestand bestätigen, ohne das Rezept dauerhaft zu speichern.

Im Bestands-Review kann der Nutzer jede vorgeschlagene Menge korrigieren oder abwählen. Erst die abschließende Bestätigung erzeugt normale `out`-Transaktionen des Moduls `inventory-lifecycle`. Die Transaktionen referenzieren den betroffenen Bestandseintrag und optional den auslösenden Vorschlag. Es gibt keine automatische Abbuchung beim Öffnen, Speichern oder Starten eines Rezepts.

```ts
type InventoryOutcome =
  | { kind: 'CONSUMED'; inventoryItemId: string; suggestionId?: string }
  | { kind: 'WASTED'; inventoryItemId: string; reason: WasteReason };
```

Wird ein zuvor priorisiertes Lebensmittel später als `waste` verbucht, gilt es für die Wirkungsmessung nicht als gerettet. Das maßgebliche positive Signal ist ausschließlich eine vom Nutzer bestätigte Verbrauchsmenge, nicht ein Klick, das Speichern oder das Öffnen des Kochmodus.

## 5. Antwortvertrag

```ts
type SuggestionGoal = 'MAXIMIZE_RESCUE' | 'FASTEST' | 'MINIMAL_SHOPPING';

type InventoryUse = {
  inventoryItemId: string;
  amount: { value: number; unit: string };
};

type MissingIngredient = {
  name: string;
  amount?: { value: number; unit: string };
};

type MealSuggestion = {
  id: string;
  goal: SuggestionGoal;
  title: string;
  totalMinutes: number;
  servings: number;
  source:
    | { kind: 'GLOBAL_CATALOG'; recipeId: string }
    | { kind: 'HOUSEHOLD_RECIPE'; recipeId: string }
    | { kind: 'GENERATED_PATTERN'; preparationPatternId: string };
  inventoryUses: InventoryUse[];
  missingIngredients: MissingIngredient[];
  reasonCodes: string[];
  ingredients: Array<{
    name: string;
    amount?: { value: number; unit: string };
    source: 'INVENTORY' | 'STAPLE' | 'MISSING';
  }>;
  steps: Array<{
    position: number;
    text: string;
    timerMinutes?: number;
  }>;
};

type MealSuggestionResult =
  | {
      ok: true;
      suggestions: [MealSuggestion, MealSuggestion] | [MealSuggestion, MealSuggestion, MealSuggestion];
    }
  | {
      ok: false;
      code:
        | 'NO_ELIGIBLE_INVENTORY'
        | 'INSUFFICIENT_SAFE_CONTEXT'
        | 'INSUFFICIENT_DISTINCT_SUGGESTIONS'
        | 'MODEL_UNAVAILABLE'
        | 'MODEL_OUTPUT_INVALID'
        | 'VALIDATION_REJECTED';
      retryable: boolean;
    };
```

Eine fehlende Zutat wird im UI eindeutig als noch zu besorgen dargestellt. Sie darf niemals so aussehen, als sei sie bereits im Haushalt vorhanden.

## 6. Validierung nach dem Modell

Die Modellantwort ist untrusted input und wird an einer einzigen Grenze mit einem strikten Laufzeitschema validiert. Danach folgen fachliche Invarianten.

Jeder generierte Kandidat wird vollständig verworfen, wenn eine der folgenden Bedingungen verletzt ist:

- unbekanntes Lebensmittel-, Muster- oder Slot-Alias
- Lebensmittel in einem inkompatiblen Slot
- mehr als die verfügbare Menge
- inkompatible oder nicht umrechenbare Einheit
- nicht erlaubte Grundzutat
- mehr als zwei fehlende Zutaten
- fehlende Zutat außerhalb der erlaubten Liste
- harte Ernährungs- oder Allergenregel verletzt
- sicherheitsrelevante Musterregel verletzt
- unbekannte Zielperspektive
- leere oder überlange Felder
- doppelte Vorschläge ohne materiellen Unterschied
- weniger als zwei insgesamt gültige Vorschläge

Es gibt in Version 1 keinen automatischen Reparaturaufruf. Ein ungültiges Ergebnis löst keinen zweiten Modellaufruf und keinen Agenten-Loop aus.

## 7. Datenschutz- und Berechtigungsgrenzen

- Haushaltsbestand wird ausschließlich im Kontext einer autorisierten Haushaltsmitgliedschaft gelesen.
- Private Tracking-Daten werden nicht Teil dieses Workflows.
- Persönliche harte Regeln dürfen nur als minimale, anfragebezogene Projektion verarbeitet werden.
- Modelltelemetrie darf keine Rohdaten zu Bestand, Allergien oder Identitäten enthalten.
- Logs speichern Regelcodes, Mengenstatistiken und technische Fehler, aber keine vollständigen Modellkontexte.
- Vorschläge sind read-only und werden nicht automatisch mit anderen Haushaltsmitgliedern geteilt oder dauerhaft gespeichert.
- Ein Modellschlüssel existiert nur serverseitig.

## 8. Technische Einordnung

### 8.1 Bestehender Stack

- Expo SDK 57, React Native 0.86 und React 19.2
- TypeScript 6 und Zod 4 für statische und Laufzeitverträge
- React Query für Serverzustand
- Supabase Postgres, Auth und RLS als Backend-Autorität
- lokale SQLite-Spiegelung und Outbox für bestehende Offline-Daten
- Jest für Domänen- und Interface-Tests
- Deno-Tests für eine mögliche Supabase Edge Function

### 8.2 Vorgeschlagene Struktur

Die spätere Implementierung bleibt feature-first und trennt reine Logik von Transport und UI:

```text
src/features/meal-suggestions/
  domain/
    eligibility.ts
    priority.ts
    catalog-ranking.ts
    preparation-patterns.ts
    contracts.ts
  data/
    meal-suggestion-repository.ts
  hooks/
    use-meal-suggestions.ts
  screens/
  components/

supabase/functions/meal-suggestions/
  index.ts
  model-gateway.ts
  model-schema.ts
  validator.ts
```

Plattformübergreifende Dateien erhalten bei der Implementierung die im Repository geforderten eigenständigen `.android`-Kopien. Die genaue UI-Struktur wird erst nach separater visueller Auswahl festgelegt.

### 8.3 Schnittstellengrenzen

- `domain/` kennt weder Supabase noch einen Modellprovider.
- Der Katalogzugriff implementiert einen kleinen `RecipeCandidateRepository`-Vertrag.
- Der Modellgateway implementiert einen provider-neutralen `FallbackGenerator`-Vertrag.
- Zod validiert nur an externen Grenzen; intern werden inferierte TypeScript-Typen genutzt.
- Fehler werden als diskriminierte Union zurückgegeben, nicht als frei interpretierbare Modelltexte.
- Die API bleibt read-only. Spätere Aktionen wie „auf Einkaufsliste setzen“ erhalten eigene Befehle und Berechtigungsprüfungen.

## 9. Code- und Datenregeln

- Kein `any` und keine ungeprüften Casts an der Modellgrenze.
- Keine frei verteilten Prompt-Strings. Modellvertrag und strukturiertes Schema haben eine eindeutige Version.
- Ranking, Mengenprüfung und Deduplizierung sind reine Funktionen.
- Unbekannte Einheiten oder Klassen führen zu einem expliziten Ausschluss, nicht zu einem Default-Wert.
- Der vollständige vorausgesetzte Basissatz ist versioniert und auf Wasser, Salz, Pfeffer und neutrales Speiseöl begrenzt. Das Modell darf ihn nicht erweitern.
- Änderungen am Supabase-Schema erfolgen ausschließlich in `supabase/schemas/*.sql` und werden mit `bun run db:diff` generiert.
- Jede Änderung an synchronisierten Bestandsfeldern benötigt lokale SQLite- und Outbox-Parität.
- Keine vorhandenen KI-Workflow-Verträge werden erweitert oder migriert. Diese Capability beginnt mit neuen Verträgen und neuen Tests.

## 10. Teststrategie

### 10.1 Deterministische Domänentests

Gezielte Jest-Tests prüfen mindestens:

- stabile Prioritätsreihenfolge und Begründungscodes
- korrekte Ableitung des effektiven MHDs ohne Überschreiben von `expiry_date`
- konservativen Ausschluss vergangener oder unklarer effektiver MHDs
- Mengen- und Einheitenvergleich ohne Schätzungen
- Katalogfilterung und Ranking
- feste Suchreihenfolge aus globalem Katalog und Haushaltsrezepten
- keine implizite Sicherheitsfreigabe selbst angelegter Haushaltsrezepte
- maximal zwei fehlende Zutaten
- ausschließlich den festgelegten Basissatz als implizit vorhanden
- drei unterschiedliche Zielperspektiven
- feste Priorität `MAXIMIZE_RESCUE`, `FASTEST`, `MINIMAL_SHOPPING` bei nur zwei Vorschlägen
- Deduplizierung ähnlicher Vorschläge
- keinen Modellaufruf bei ausreichender Katalogabdeckung
- genau einen Modellaufruf bei unzureichender Katalogabdeckung
- kein zweiter Aufruf nach ungültiger Modellantwort
- keine Bestandsänderung durch bloßes Öffnen oder Speichern eines Vorschlags
- ausschließlich bestätigte Mengen aus dem „Gekocht“-Review als Verbrauch

Ausführung:

```bash
bun run test <betroffene-testdatei>
```

### 10.2 Vertrags- und Fehlertests

Tests an der Servergrenze prüfen:

- Authentifizierung und Haushaltsmitgliedschaft
- minimale Kontextprojektion ohne Datenbank-UUIDs im Modellinput
- standardmäßige Vereinigung aller Haushalts- und Kinderprofilregeln
- korrekte Vereinigung nur der ausdrücklich ausgewählten Mitessenden
- Ablehnung fremder oder nicht zum Haushalt gehörender Teilnehmerreferenzen
- Ablehnung jeder unbekannten Referenz
- Ablehnung inkompatibler Slotbelegungen
- Ausschluss riskanter und unbekannter Lebensmittelklassen aus dem generativen Pfad
- Ablehnung von Allergie- und Sicherheitsverletzungen
- strukturierte Fehler ohne Offenlegung privater Daten
- keinerlei Datenbankmutation durch Anfrage oder Modellantwort

Für eine Edge Function werden ausschließlich die betroffenen Deno-Testdateien ausgeführt.

### 10.3 Modell-Evaluation

Eine neue, von früheren Workflows unabhängige Black-Box-Evaluation misst den begrenzten Fallback. Sie wird erst aufgebaut, nachdem Ranking, Verträge und Validator stabil sind. Ein Vergleich großer Modelle vor diesem Zeitpunkt ist nicht aussagekräftig.

Die Evaluation enthält normale, Rand- und Angriffsbeispiele:

- unterschiedliche Lebensmittelklassen und Mengen
- nur ein oder zwei passende Lebensmittel
- unbekannte oder nicht umrechenbare Einheiten
- Versuch, eine dritte fehlende Zutat einzuführen
- Versuch, ein unbekanntes Alias zu verwenden
- Allergie- und Unverträglichkeitskonflikte
- rohes Fleisch, Fisch, Ei oder trockene Hülsenfrüchte im generativen Pfad
- unpassende Slotbelegung
- Prompt-Injection in Lebensmittel- oder Rezeptnamen
- mehrfach fast identische Vorschläge

Die unabhängige Auswertung prüft ausschließlich beobachtbares Verhalten: Schema, Referenzen, Mengen, Regeln, Diversität und Sicherheitsinvarianten. Das Modell bewertet sich nicht selbst.

### 10.4 Datenbanktests

Falls neue Tabellen oder Felder notwendig werden, erhalten sie RLS-Policies und gezielte pgTAP-Tests. Danach gelten der deklarative Datenbankworkflow und die Typ-Synchronisation des Repositories.

## 11. Erfolgskriterien

### 11.1 Harte Abnahmekriterien

Eine Version ist technisch freigabefähig, wenn:

- jede erfolgreiche Antwort zwei oder drei validierte, materiell unterschiedliche Vorschläge enthält,
- kein Vorschlag mehr als zwei fehlende Zutaten enthält,
- jede Bestandsreferenz existiert und jede Menge verfügbar ist,
- keine harte Nutzer-, Allergen- oder Sicherheitsregel verletzt wird,
- der Katalog immer vor einem Modellaufruf geprüft wird,
- bei ausreichender Katalogabdeckung kein Modell aufgerufen wird,
- ein Fallback höchstens einen Modellaufruf ausführt,
- das Modell keine freien sicherheitsrelevanten Schritte erzeugt,
- keine Anfrage eine Mutation auslöst,
- weder private Tracking-Daten noch echte Identifikatoren den Modellkontext erreichen.

### 11.2 Produktwirkung

Das eigentliche Ziel ist nicht eine hohe Zahl generierter Rezepte, sondern weniger weggeworfene Lebensmittel. Vor einem Rollout werden Baseline und Messdefinitionen festgelegt für:

- Anteil angenommener Vorschläge
- Anteil der in Vorschlägen priorisierten Lebensmittel, deren Bestandsmenge anschließend nachvollziehbar sinkt
- Anteil priorisierter Lebensmittel, die trotz Vorschlag später als entsorgt gemeldet werden
- Anteil der Anfragen, die vollständig aus dem Katalog beantwortet werden
- Ablehnungsrate des Fallback-Validators

Eine Mengenreduktion ist nur ein Nutzungssignal und kein sicherer Beweis für Verzehr. Die Produktmetrik darf diesen Unterschied nicht verschleiern.

Das maßgebliche Wirkungsverhältnis für priorisierte Lebensmittel lautet:

```text
nutzungsbestätigte priorisierte Menge
÷
(nutzungsbestätigte priorisierte Menge + als waste bestätigte priorisierte Menge)
```

Nur über das Bestands-Review bestätigte `out`-Transaktionen zählen im Zähler. Vorschlagsaufrufe, gespeicherte Rezepte und gestartete Kochmodi bleiben unterstützende Funnel-Metriken.

## 12. Grenzen der Offline-Fähigkeit

Die Priorisierung und Katalogsuche können perspektivisch mit lokal gespiegelten, bereits autorisierten Daten offline laufen. Der generative Fallback benötigt in Version 1 eine Serververbindung. Offline gilt daher:

- vorhandene lokale Katalogtreffer dürfen read-only angezeigt werden,
- es gibt keinen lokalen Modellaufruf,
- es wird keine Anfrage in einer Outbox automatisch später ausgeführt,
- der Nutzer erhält eine klare Information, wenn für zusätzliche Vorschläge eine Verbindung erforderlich ist.

## 13. Beschlossene fachliche Entscheidungen

1. Das effektive MHD wird aus dem ursprünglichen `expiry_date` und der Haltbarkeit nach `opened_at` abgeleitet. `expiry_date` wird nicht überschrieben.
2. Allergien und Ernährungsregeln kommen aus privaten Account- und Kinderprofileinstellungen. Standardmäßig gelten alle Profile des aktiven Haushalts; eine spätere Auswahl konkreter Mitessender darf die Menge einschränken.
3. Der generative Pfad verwendet nur eine kleine Positivliste sicher beherrschbarer Lebensmittelklassen. Riskante und unbekannte Klassen benötigen ein geprüftes Katalogrezept.
4. Die deterministische Rezeptsuche prüft zuerst den globalen Katalog und danach geeignete Haushaltsrezepte. Erst dann ist ein generativer Fallback zulässig.
5. Wasser, Salz, Pfeffer und neutrales Speiseöl sind der vollständige global vorausgesetzte Basissatz.
6. Speichern und „Gekocht“ sind getrennte Nutzeraktionen. Nur ein bestätigtes Bestands-Review erzeugt Verbrauchstransaktionen und zählt als Rettungssignal.
7. Bei zwei Vorschlägen ist `MAXIMIZE_RESCUE` immer enthalten. Danach folgt ein materiell unterschiedlicher `FASTEST`-Vorschlag, andernfalls `MINIMAL_SHOPPING`.

## 14. Freigaberegel

Diese Spezifikation definiert den fachlich abgestimmten Produkt- und Sicherheitsvertrag, aber noch keinen Implementierungsplan. Die nächste Phase darf die notwendigen Datenänderungen, finalen Schnittstellen und kleinen vertikalen Umsetzungsschritte planen. Sie beginnt erst nach einem ausdrücklichen Auftrag und autorisiert noch keine Implementierung.
