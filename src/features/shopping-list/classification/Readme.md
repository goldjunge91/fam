Die Dateien bilden zwei Ebenen: eine ältere Kategorie-Klassifikation und darüber eine neue V2-Einordnung in Einkaufszonen. Ich prüfe jetzt noch die Aufrufstellen, damit ich nicht nur den Codeblock, sondern auch den tatsächlichen Zeitpunkt in der App erklären kann.

Searched for regex `classifyPlacement|explainPlacement|classifyCategory|explainCategory|resolvePlacement|normalizeCategoryClassification` (`**/src/**`), 151 results

No matches found. Your search pattern might be excluded completely by either the search.exclude settings or .*ignore files.
If you believe that it should have results, you can check into the .*ignore files and the exclude setting (here are some excluded patterns for reference:[**/node_modules,**/bower_components,**/*.code-search]).
Then if you want to include those files you can call the tool again by setting "includeIgnoredFiles" to true.

Searched for regex `categoryTags|off_category_tags|productFamilyId|productFormId|placementZoneId` (`**/src/features/shopping-list/**`), 295 results

Die Aufrufkette ist jetzt sichtbar: Formulare rufen nicht direkt den Klassifikator auf, sondern `preferences/api.ts`, das Produktdaten ergänzt und anschließend globale Klassifikation plus Haushalts-/Marktregeln auflöst. Ich lese diese kurze Brücke und die fokussierten Tests noch, um konkrete Beispiele wie „Haferdrink“ und „Tiefkühlpizza“ korrekt nachzuvollziehen.

Die Tests bestätigen die wichtigsten Regeln: OFF-Tags gewinnen normalerweise vor Namen, ein echter Gleichstand bleibt unklassifiziert, explizite Tiefkühlmarker gewinnen vor allgemeinen Signalen, und unbekannte Artikel landen in V2 sicher bei `other`. Ich strukturiere die Erklärung deshalb als Ablauf plus Datei-für-Datei-Syntax, statt jede Produktregel einzeln abzuschreiben.

Created 3 todos

Completed: *Syntax und Dateien verständlich erklären* (2/3)

## Wofür ist dieser Code?

Diese Dateien entscheiden automatisch:

> „In welche Einkaufslisten-Zone gehört dieser Artikel?“

Beispiele:

- `Apfel` → **Obst & Gemüse**
- `Joghurt` → **Milchprodukte & Eier**
- `Tiefkühlpizza` → **Tiefkühl**
- `Spülmittel` → **Haushalt & Reinigung**
- unbekannter Artikel → **Sonstiges**

Der Code verwendet dafür drei Informationsquellen:

1. Produktname: `„500g Nudeln“`
2. Open-Food-Facts-Tags: `en:pastas`
3. persönliche Regeln des Haushalts oder Marktes

---

## Der Ablauf in einfacher Sprache

### 1. Der Benutzer gibt einen Artikel ein

Das passiert zum Beispiel in:

- `add-item-form.tsx`
- `edit-item-form.tsx`

Diese Formulare rufen letztlich `resolvePlacementForItem()` aus `preferences/api.ts` auf.

Dabei wird:

- der Produktname geprüft,
- eventuell ein Produkt aus der lokalen Datenbank geladen,
- Open-Food-Facts-Tags geladen,
- nach persönlichen Haushalts- und Marktregeln gesucht.

Danach geht es weiter zu:

```ts
resolveCategory(...)
```

in `preferences/resolve-category.ts`.

---

### 2. Die globale automatische Klassifikation startet

`resolveCategory()` ruft auf:

```ts
const globalClassification = classifyPlacement(input);
```

Das ist die wichtigste öffentliche Funktion in:

```text
placement-classifier.ts
```

---

### 3. Der Name wird normalisiert

Zuerst wird aus:

```text
"500g Nudeln"
```

etwa:

```ts
['nudeln']
```

Die Funktion dafür ist:

```ts
normalizeShoppingName()
```

Sie:

- macht Großbuchstaben klein,
- trennt Wörter an Leerzeichen und Sonderzeichen,
- entfernt Mengen wie `500g`, `2`, `1,5l`,
- entfernt Einheiten wie `kg`, `ml`, `Packung`,
- gibt die übrigen Wörter zurück.

Beispiel:

```text
"2 Packungen Bio-Nudeln"
```

wird ungefähr zu:

```ts
['bio', 'nudeln']
```

---

### 4. OFF-Tags und Namensregeln werden verglichen

Es gibt zwei Regelquellen:

#### Open-Food-Facts-Regeln

In `off-category-rules.ts`:

```ts
{ tag: 'en:porks', categoryId: 'meat_poultry', priority: 100 }
```

Das bedeutet:

> Wenn Open Food Facts den Tag `en:porks` liefert, ist der Artikel wahrscheinlich Fleisch.

#### Namensregeln

In `name-category-rules.ts`:

```ts
{
  value: 'nudeln',
  categoryId: 'pantry_staples',
  match: 'word',
  score: 100
}
```

Das bedeutet:

> Wenn ein vollständiges Wort `nudeln` vorkommt, gehört es zur Kategorie `pantry_staples`.

---

### 5. Die beste Kategorie gewinnt

Die Regeln bekommen Gewichte:

- `120`: eindeutiger Spezialmarker
- `100`: normale Produktregel
- `98`: Milchprodukte
- `95`: Fleisch und Fisch
- `90`: Obst und Gemüse
- `85`: Wortende in zusammengesetzten Wörtern
- `20`: schwaches Wortanfangssignal

Beispiel:

```text
"Apfelsaft"
```

Darin stecken:

- `apfel`
- `saft`

`saft` ist die wichtigere Aussage. Deshalb wird der Artikel als Getränk erkannt, nicht als Obst.

Ein echter Gleichstand führt bewusst zu keiner Kategorie:

```text
en:porks       → Fleisch
en:milks       → Milch
```

Beide haben dieselbe Priorität. Das Ergebnis ist dann:

```ts
categoryId: null
```

---

## Die einzelnen Dateien

## `normalize-shopping-name.ts`

Diese Datei zerlegt und bereinigt Produktnamen.

Wichtige Teile:

```ts
const UNIT_TOKENS = new Set([...]);
```

`Set` ist eine Sammlung eindeutiger Werte. Hier stehen Einheiten wie `kg`, `ml` oder `Packung`.

```ts
const QUANTITY_TOKEN = /^\d+([.,]\d+)?[a-zäöüß]*$/;
```

Das ist ein regulärer Ausdruck. Er erkennt zum Beispiel:

- `2`
- `500g`
- `1,5l`

Die Funktion:

```ts
export function normalizeShoppingName(name: string): string[]
```

bedeutet:

- exportierte Funktion,
- Eingabe ist normalerweise ein Text,
- Ausgabe ist eine Liste von Texten.

Die Schleife:

```ts
for (const char of normalized)
```

geht Zeichen für Zeichen durch den Namen.

```ts
if (WORD_CHAR.test(char))
```

prüft, ob das Zeichen ein Buchstabe oder eine Zahl ist.

Am Ende werden Mengen und Einheiten entfernt:

```ts
return tokens.filter(
  (token) => !UNIT_TOKENS.has(token) && !QUANTITY_TOKEN.test(token),
);
```

---

## `shopping-category-classifier.ts`

Das ist der ältere beziehungsweise grundlegende Klassifikator.

### `matchOffTagCandidates()`

Sucht passende Open-Food-Facts-Tags.

```ts
for (const tag of categoryTags)
```

geht durch alle gelieferten Tags.

```ts
for (const rule of OFF_CATEGORY_RULES)
```

geht durch alle bekannten Regeln.

Wenn beides passt, entsteht ein Kandidat:

```ts
{
  kind: 'off_tag',
  categoryId,
  value: tag,
  weight: rule.priority
}
```

Ein Kandidat bedeutet:

> „Diese Kategorie ist möglich, weil dieses Signal gefunden wurde.“

---

### `matchNameCandidates()`

Sucht passende Wörter im Produktnamen.

Es gibt drei Sucharten:

```ts
match: 'word'
```

Das ganze Wort muss passen.

```ts
match: 'word-start'
```

Das Wort muss am Anfang stehen.

Beispiel:

```text
schwein → schweinefilet
```

```ts
match: 'word-end'
```

Das Wort muss am Ende stehen.

Beispiel:

```text
brot → vollkornbrot
```

So werden deutsche zusammengesetzte Wörter erkannt.

---

### `resolvePhase()`

Diese Funktion entscheidet, welches Signal innerhalb einer Gruppe am stärksten ist.

Zuerst wird pro Kategorie nur das beste Signal behalten:

```ts
const bestByCategory = new Map(...)
```

Danach werden die Kategorien nach Gewicht sortiert:

```ts
.sort((a, b) => b.weight - a.weight)
```

Das bedeutet:

> Höhere Werte kommen zuerst.

Bei einem Gleichstand:

```ts
const tied = runnerUp !== undefined && runnerUp.weight === top.weight;
```

wird kein Gewinner gesetzt.

---

### `resolve()`

Hier wird die eigentliche Reihenfolge festgelegt:

1. Eindeutige Namensmarker ab Gewicht `120`
2. Gewinner aus Open-Food-Facts-Tags
3. Gewinner aus Namensregeln
4. Keine Klassifikation

Daher gewinnt zum Beispiel:

```text
"Tiefkühlpizza"
```

gegen allgemeine Tags wie Obst oder Gemüse, wenn der Name einen eindeutigen Tiefkühlmarker enthält.

---

### `classifyCategory()`

Gibt nur das kurze Ergebnis zurück:

```ts
{
  categoryId: 'bakery',
  source: 'name_fallback',
  classifierVersion: 'placement-v2.0.0',
  evidence: {
    kind: 'name_rule',
    value: 'brot'
  }
}
```

Diese Funktion ist für normalen Produktionscode gedacht.

---

### `explainCategory()`

Gibt zusätzlich eine vollständige Erklärung zurück:

- normalisierter Produktname,
- alle Kandidaten,
- verworfene Kandidaten,
- Gewinner,
- Konfliktgrund,
- verwendete Version.

Das ist vor allem für Debugging und Analyse nützlich.

---

## `name-category-rules.ts`

Diese Datei enthält nur Regeln, keine aktive Logik.

Beispiel:

```ts
{
  value: 'apfel',
  categoryId: 'produce',
  match: 'word',
  score: 90
}
```

Die langen Blöcke wie:

```ts
[
  'apfel',
  'banane',
  'orange',
].map(...)
```

erzeugen viele ähnliche Regelobjekte automatisch.

`map()` bedeutet:

> Für jeden Eintrag in der Liste wird ein neues Objekt erzeugt.

---

## `off-category-rules.ts`

Enthält die Zuordnung von Open-Food-Facts-Tags zu Kategorien.

Beispiel:

```ts
{
  tag: 'en:vegetables',
  categoryId: 'produce',
  priority: 50
}
```

Die Prioritäten sind:

```ts
const SPECIFIC = 100;
const MID = 50;
const GENERIC = 10;
```

Ein spezifischer Tag schlägt also einen allgemeinen Tag.

Die Schreibweise:

```ts
readonly OffCategoryRule[]
```

bedeutet:

> Die Liste ist nur zum Lesen gedacht und soll nicht verändert werden.

---

## `placement-classifier.ts`

Das ist der neue V2-Klassifikator.

Er bestimmt nicht nur eine alte Kategorie, sondern drei Dinge:

```ts
productFamilyId
productFormId
placementZoneId
```

Beispiel:

```ts
{
  productFamilyId: 'plant_drink',
  productFormId: 'ambient',
  placementZoneId: 'ambient_milk_drinks'
}
```

Das bedeutet:

- Produktfamilie: Pflanzendrink
- Form: haltbar beziehungsweise ungekühlt
- Einkaufszone: Haltbare Milch und Pflanzendrinks

### `descriptorFromOffTags()`

Versucht, aus OFF-Tags eine genaue Produktfamilie und Verkaufsform zu bestimmen.

Beispiel:

```text
en:plant-milks
```

wird zu:

```ts
family: 'plant_drink'
form: 'ambient'
```

### `descriptorFromName()`

Versucht dasselbe anhand des Namens.

Die Reihenfolge lautet:

1. vollständige Wörter
2. Präfixe zusammengesetzter Wörter
3. Tiefkühl-Erkennung
4. kein Treffer

### `classifyPlacementInternal()`

Das ist die zentrale interne Funktion.

Die Priorität der Produktbeschreibung lautet:

1. ausdrücklich übergebene `productFamilyId` und `productFormId`
2. passende OFF-Regel
3. passende Namensregel
4. Standardwert anhand der alten Kategorie
5. `other`

Danach wird mit:

```ts
resolvePlacementZone(chosen.family, chosen.form)
```

die endgültige Einkaufszone bestimmt.

---

### `classifyPlacement()`

Öffentliche Funktion für normalen App-Code:

```ts
const result = classifyPlacement({
  name: 'Joghurt',
});
```

Sie liefert immer eine gültige V2-Zone.

---

### `explainPlacement()`

Wie `classifyPlacement()`, aber mit vollständigem Trace.

Ein Trace beantwortet später die Frage:

> Warum wurde dieser Artikel genau dort eingeordnet?

---

### `classifyPlacementZone()`

Kompatibilitätsfunktion für alten Code, der nur die Zone benötigt:

```ts
const zone = classifyPlacementZone({ name: 'Brot' });
```

Ergebnis:

```ts
'bakery'
```

---

## `placement-taxonomy.ts`

Diese Datei ist die zentrale Definition der Einkaufszonen.

Sie enthält:

- Produktfamilien,
- Produktformen,
- 27 Einkaufszonen,
- Farben,
- Sortierreihenfolge,
- Lagerort,
- Umwandlung alter Kategorien in neue Kategorien.

Beispiel einer Zone:

```ts
{
  id: 'frozen',
  label: 'Tiefkühl',
  rank: 220,
  storageKind: 'freezer'
}
```

### Typen

```ts
export type PlacementZoneId =
  (typeof PLACEMENT_ZONE_DEFINITIONS)[number]['id'];
```

Das erzeugt automatisch einen Typ aus allen erlaubten IDs.

Dadurch kann TypeScript zum Beispiel erkennen, dass:

```ts
'frozen'
```

gültig ist, aber:

```ts
'unknown-zone'
```

nicht.

### `normalizePlacementZoneId()`

Wandelt alte Kategorien in neue Zonen um.

Beispiel:

```ts
'produce' → 'fresh_produce'
```

Unbekannte Werte werden zu:

```ts
'other'
```

### `normalizePlacementZoneIdNullable()`

Ähnlich, aber unbekannte Werte werden nicht automatisch zu `other`, sondern zu:

```ts
null
```

Das ist beim Lesen alter oder fehlerhafter Daten wichtig.

### `normalizePlacementOrder()`

Bereinigt eine Reihenfolge:

- unbekannte Zonen entfernen,
- doppelte Zonen entfernen,
- fehlende Zonen ergänzen.

### `resolvePlacementZone()`

Ordnet Produktfamilie und Produktform einer Einkaufszone zu.

Beispiele:

```ts
resolvePlacementZone('pasta', 'dry')
```

ergibt:

```ts
'pasta_tomato'
```

```ts
resolvePlacementZone('fruit', 'frozen')
```

ergibt:

```ts
'frozen'
```

Die Tiefkühlform hat also Vorrang.

---

## `placement-resolver.ts`

Dieser Code entscheidet, ob automatische Klassifikation durch persönliche Einstellungen überschrieben wird.

Die Reihenfolge ist:

1. automatische globale Klassifikation
2. Haushaltspräferenz
3. Marktpräferenz
4. gespeicherter Snapshot

Beispiel:

```ts
const householdZone = normalizePlacementZoneIdNullable(
  input.householdPreference,
);
```

Der gespeicherte Wert wird zunächst normalisiert.

Dann:

```ts
if (householdZone) {
  zone = householdZone;
}
```

Wenn eine Haushaltspräferenz existiert, ersetzt sie die automatische Zone.

Eine Marktpräferenz überschreibt danach die Haushaltspräferenz.

`resolvePlacement()` verändert aber nicht die ursprüngliche Klassifikation dauerhaft. Es gibt ein neues Objekt zurück:

```ts
return {
  ...globalClassification,
  placementZoneId: zone,
};
```

`...globalClassification` bedeutet:

> Kopiere alle bisherigen Eigenschaften in ein neues Objekt.

---

## `classifier-version.ts`

```ts
export const CLASSIFIER_VERSION = PLACEMENT_CLASSIFIER_VERSION;
```

Die Datei gibt der Klassifikationslogik eine Versionsnummer.

Das ist wichtig, weil später nachvollziehbar bleibt:

> Mit welcher Regelversion wurde dieser Artikel klassifiziert?

---

## `placement-classifier-fixtures.ts`

Das sind Testdaten, keine Produktionslogik.

Beispiel:

```ts
{
  name: 'Apfel',
  expected: {
    productFamilyId: 'fruit',
    productFormId: 'fresh',
    placementZoneId: 'fresh_produce',
  },
}
```

Die Liste beschreibt erwartete Ergebnisse für typische Produkte.

`fixtureInput()` baut daraus eine Eingabe für den Klassifikator.

---

## `shopping-category-id.ts`

Diese Datei exportiert hauptsächlich Typnamen weiter:

```ts
StoredPlacementZoneId as ShoppingCategoryId
```

Das ist ein Alias.

Alter Code darf also weiterhin `ShoppingCategoryId` verwenden, obwohl technisch inzwischen `PlacementZoneId` verwendet wird.

Zur Laufzeit passiert hier praktisch nichts.

---

## `types.ts`

Diese Datei enthält TypeScript-Typen.

Sie definieren die Form der Daten, zum Beispiel:

```ts
export type PlacementClassification = {
  productFamilyId: ProductFamilyId;
  productFormId: ProductFormId;
  placementZoneId: PlacementZoneId;
  classifierVersion: string;
  confidence: number;
  trace: PlacementTrace;
};
```

Das bedeutet:

Eine Klassifikation muss diese Eigenschaften besitzen.

Wichtig:

> Types existieren normalerweise nur während der Entwicklung und werden nicht als JavaScript ausgeführt.

---

## Wichtige TypeScript-Syntax

### Import

```ts
import { classifyCategory } from './shopping-category-classifier';
```

Lädt eine Funktion aus einer anderen Datei.

```ts
import type { PlacementZoneId } from './placement-taxonomy';
```

Lädt nur einen Typ, keine laufbare Funktion.

---

### Export

```ts
export function classifyPlacement() {}
```

Die Funktion darf von anderen Dateien importiert werden.

---

### Optionales Feld

```ts
categoryTags?: readonly string[];
```

Das Feld darf fehlen.

Wenn es vorhanden ist, enthält es eine nicht veränderbare Liste von Texten.

---

### Nullish Coalescing

```ts
input.categoryTags ?? []
```

Bedeutet:

> Verwende `input.categoryTags`, außer es ist `null` oder `undefined`. Dann verwende `[]`.

---

### Optional Chaining

```ts
input.snapshot?.categoryId
```

Bedeutet:

> Greife nur auf `categoryId` zu, wenn `snapshot` existiert.

---

### Ternärer Operator

```ts
const result = condition ? valueA : valueB;
```

Bedeutet:

```text
Wenn condition wahr ist, nimm valueA,
sonst nimm valueB.
```

---

### Union-Typ

```ts
type CategorySource = 'user' | 'off_taxonomy' | 'name_fallback';
```

Erlaubt ist nur einer dieser Texte.

---

### Generics und `Record`

```ts
Record<PlacementZoneId, ZoneDescriptor>
```

bedeutet:

> Ein Objekt, dessen Schlüssel gültige Zonen-IDs sind und dessen Werte `ZoneDescriptor` entsprechen.

---

### `find`, `some`, `filter`, `map`

```ts
tokens.some(...)
```

Prüft, ob mindestens ein Token passt.

```ts
rules.find(...)
```

Gibt die erste passende Regel zurück.

```ts
candidates.filter(...)
```

behält nur passende Kandidaten.

```ts
values.map(...)
```

wandelt jeden Wert in einen neuen Wert um.

---

## Kurzfassung

Die Architektur funktioniert so:

```text
Benutzer gibt Artikel ein
        ↓
Name und Produktdaten werden geladen
        ↓
Mengen und Einheiten werden entfernt
        ↓
OFF-Tags und Namensregeln werden gesucht
        ↓
Gewichte und Konflikte werden ausgewertet
        ↓
Produktfamilie und Verkaufsform werden bestimmt
        ↓
Familie + Form werden einer Einkaufszone zugeordnet
        ↓
Haushalts- oder Marktpräferenzen überschreiben automatisch
        ↓
Artikel erscheint in der richtigen Einkaufskategorie
```

Der Code wird also nicht einfach beim Start der App für alle Artikel ausgeführt. Er läuft, wenn ein Einkaufslistenartikel klassifiziert oder seine Kategorie neu berechnet werden muss, etwa beim Eingeben, Auswählen, Bearbeiten oder Speichern eines Artikels.