# Neuer Umsetzungsplan: AI-Rezeptvorschläge

**Status:** Planentwurf zur Prüfung, fachliche Entscheidungen ergänzt  
**Planbasis:** `docs/referenced-chatgpt-conversation-this-is-an/work/ai-rezeptvorschlaege-kompakt.md`  
**Task-Tracking:** Beads, nicht `tasks/todo.md`  
**Wichtig:** Dieser Plan ersetzt keinen bestehenden Plan durch Überschreiben. Er ist ein eigener Plan.

## Ziel

Ein read-only Rezeptvorschlags-Workflow für zwei Einstiege:

1. Der Nutzer nennt vorhandene Lebensmittel. Der Text löst nur den Workflow aus;
   Lebensmittel und Mengen kommen aus dem autoritativen Zustand.
2. Der Nutzer fragt, was er heute essen sollte. Das Backend priorisiert die
   Lebensmittel und gibt nur den relevanten Ausschnitt weiter.

Der Nutzer soll nach einem Monat merken: **„Ich werfe weniger Lebensmittel weg.“**
Das ist der primäre Produktwert. Modellqualität, Tokenkosten und technische
Eleganz sind nachgeordnet, solange sie diesem Ergebnis nicht dienen.

## Getroffene Entscheidungen

1. **Eigenes erlaubtes `recipe-suggestions`-Modul:** Die Rezeptvorschläge
   erhalten einen eigenen Feature-Bereich. Der konkrete App-/Backend-Pfad wird
   vor der Implementierung freigegeben. Unfertige Feature-Entwürfe werden nicht
   geprüft oder verwendet.
2. **Katalog plus Templates:** Ein autoritativer Rezeptkatalog wird mit
   deterministischen Zutaten-Templates ergänzt. Die aktuell vorhandenen
   Alias-/Katalogartefakte sind nur Import- oder Testinput und keine
   Laufzeitabhängigkeit der App.
3. **Food-Waste-Messung:** Explizite Wegwerf-Ereignisse sind die primäre
   Messung. Eine wöchentliche Kurzabfrage ist eine getrennte, grobe
   Plausibilitätskontrolle.

## Nicht im Scope

- Bild, Barcode, OCR, Sprache oder sonstige Rohdatenverarbeitung;
- Inventarerfassung oder Normalisierung durch das Modell;
- automatische Bestands-, Einkaufs- oder sonstige Mutationen;
- ein autonomer Agent oder eine neue generische Agentenplattform;
- die Prüfung, Nutzung oder Änderung unfertiger Feature-Entwürfe;
- `tools/llm-test-platform/` außerhalb von Prompt-, Schema-, Safety- und
  Regressionsevals.

## Verbindliche Architekturentscheidungen

### 1. Zustand und Regeln liegen außerhalb des Modells

App und Backend sind autoritativ für:

- Bestand, Mengen, Einheiten und Zustände;
- MHD, Öffnungsstatus, Verfügbarkeit und Lebensmittelsicherheit;
- Allergien und Nutzerrestriktionen;
- Personenanzahl;
- `priority_score(item)`;
- Rezeptsuche und Kandidatenauswahl;
- Einkaufslistenstatus;
- alle Mutationen.

### 2. Einkaufslistenregel ist deterministisch

- Einkaufsliste leer: keine weitere Nachfrage im Rezeptdialog;
- Einkaufsliste enthält Artikel: fragen, ob heute noch eingekauft wird;
- bei Zustimmung: relevante Artikel als `planned_shopping_items` ergänzen;
- bei Ablehnung: nur vorhandenen Bestand und bereits erlaubte Zutaten verwenden;
- geplante Einkaufsartikel niemals als vorhandenen Bestand behandeln.

### 3. Vorhandene Rezepte vor generativem Fallback

Das Backend sucht zuerst passende Rezepte aus dem vorhandenen Rezeptbestand und
gibt höchstens drei Kandidaten weiter. Nur wenn kein passendes Rezept existiert,
darf das Modell ein bis drei Fallback-Rezepte formulieren.

### 4. Structured Outputs sind der technische Vertrag

Jeder Modellaufruf verwendet ein versioniertes Structured-Output-Schema.
Freitext ist nur ein Feld innerhalb der validierten Antwort. Ungültige Antworten
werden fail-closed verworfen und nicht durch Freitext-Heuristiken repariert.

### 5. Read-only bleibt read-only

Das Modell schlägt vor. Eine Bestands- oder Einkaufsänderung läuft nur nach
expliziter Nutzerentscheidung über den normalen App-Mutationspfad.

## Abhängigkeitsgraph

```text
0 Datenmodell-Grenze
        |
        v
A Verträge und Schema
        |
        v
B Deterministischer Rezeptkontext
        |
        v
C Gemeinsame Structured-Output-Validierung
        |
        v
D Gezielte Prompt-/Schema-/Safety-/Regressionsevals
        |
        v
E Read-only Gateway und Vorschlagsanzeige
        |
        v
F Produktwirkung nach einem Monat messen
```

Die Beads-Abhängigkeiten sind entsprechend verknüpft. Bestehende, nicht zu
diesem neuen Plan gehörende Issues werden nicht verändert.

## Task-Liste

Die Aufgaben werden in Beads geführt. Die IDs sind die verbindliche Zuordnung
zwischen diesem Plan und dem Tracker.

### 0. Datenmodell-Grenze festlegen

**Beads:** `fam-agg`  
**Abhängigkeit:** keine  
**Größe:** M

**Ziel:** Die Datenmodellgrenzen für Rezeptkatalog, Zutaten-Templates,
Wegwerf-Ereignisse und die wöchentliche Plausibilitätsmessung festlegen.

**Akzeptanzkriterien:**

- der autoritative Rezeptkatalog ist von Import-/Testinput und Laufzeit klar
  getrennt;
- deterministische Zutaten-Templates haben eine versionierbare Struktur;
- ein `waste`-Ereignis referenziert die konkrete Bestands-/Lot-Quelle,
  Menge, Einheit, Grund, Haushalt, Nutzer und Zeitstempel;
- die wöchentliche Kurzabfrage ist ein getrenntes Messobjekt und keine
  Bestandsbuchung;
- Datenbankänderungen bleiben deklarativ und erhalten RLS-, SQLite- und
  Outbox-Parität, falls sie synchronisierte Daten betreffen;
- keine unfertigen Feature-Entwürfe werden als Grundlage verwendet.

**Verifikation:** Review des Datenmodells gegen die Capability Map sowie
gezielte Schema-/RLS-/Domain-Tests, falls tatsächlich ein Schema geändert wird.

**Dateien:** Capability- und Spezifikationsdokumentation; später nur die
freigegebenen deklarativen Supabase-Schemas, lokalen Mirror-Schemas und Tests.

### A. Verträge und Structured-Output-Schema

**Beads:** `fam-cbx`  
**Abhängigkeit:** 0  
**Größe:** S bis M

**Ziel:** Einen stabilen `recipe_suggestion`-Vertrag für Katalogrezepte und
Fallback-Rezepte definieren.

**Akzeptanzkriterien:**

- Input enthält nur geprüften, für die Anfrage nötigen Zustand;
- Output enthält `schema_version` und 1 bis 3 Mahlzeiten;
- `catalog` und `model_generated` sind eindeutig unterscheidbar;
- `recipe_id` und `inventory_item_id` sind typsicher zugeordnet;
- zusätzliche Zutaten kommen nur aus einer expliziten Allowlist;
- der Vertrag enthält keinen Mutationsbefehl.

**Verifikation:** Fokussierte Contract- und Domain-Tests für Katalogquelle,
Fallbackquelle, IDs und die Grenze von 1 bis 3 Mahlzeiten.

**Dateien:** Noch freizugebende App-/Backend-Vertragsbereiche und zugehörige
fokussierte Tests. Keine unfertigen Feature-Entwürfe verwenden.

### B. Deterministische Kontextpipeline

**Beads:** `fam-2ry`  
**Abhängigkeit:** A  
**Größe:** M

**Ziel:** Aus autoritativem Zustand denselben minimalen Modellkontext erzeugen.

**Akzeptanzkriterien:**

- MHD, Öffnungsstatus, Verfügbarkeit und Allergien werden vor dem Modellaufruf
  geprüft;
- `priority_score` ist als reine Regel testbar;
- Personenanzahl, Mengen und Nutzerpräferenzen wirken deterministisch;
- leere Einkaufsliste erzeugt keine Einkaufsnachfrage;
- nichtleere Einkaufsliste erzeugt genau die definierte Einkaufsfrage;
- bestätigte Einkaufsartikel bleiben `planned_shopping_items`;
- passende Katalogrezepte werden vor dem Fallback gesucht;
- derselbe geprüfte Zustand erzeugt denselben Kontext.

**Verifikation:** Reine Regeltests für Priorität, MHD, Allergien, Mengen,
Personenanzahl sowie alle drei Einkaufslistenfälle.

**Dateien:** Noch freizugebende App-/Backend-Domainbereiche und fokussierte
Regeltests. Keine Datenbankänderung ohne separate Freigabe.

### C. Gemeinsame Structured-Output-Validierung

**Beads:** `fam-4aw`  
**Abhängigkeit:** B  
**Größe:** S bis M

**Ziel:** Gateway und spätere Evals prüfen dieselben Invarianten.

**Akzeptanzkriterien:**

- Schema, Mengen, IDs, Allergene und Quellen werden validiert;
- Katalog- und Fallbackregeln werden validiert;
- nicht freigegebene Zutaten und Bestandsreferenzen werden abgelehnt;
- fehlerhafte oder abgeschnittene Antworten werden fail-closed behandelt;
- kein heuristisches Reparieren von Freitext;
- Validierung führt zu keiner Mutation.

**Verifikation:** Fokussierte Handler- und Contract-Tests mit gültigen,
ungültigen, abgeschnittenen und regelwidrigen Antworten.

**Dateien:** Freigegebene Vertrags-/Gateway-Grenzen und fokussierte Tests.

### D. Gezielte Evals

**Beads:** `fam-ana`  
**Abhängigkeit:** C  
**Größe:** S

**Ziel:** Nur die relevanten Prompt-, Schema-, Safety- und Regressionsevals
durchführen.

**Akzeptanzkriterien:**

- Structured-Output-Modus und effektive Konfiguration sind reproduzierbar;
- `finish_reason`, Retries und Prompt-/Config-Hashes werden erfasst;
- nur betroffene Fälle werden erneut getestet;
- keine automatische Modellpromotion;
- `tools/llm-test-platform/` wird ausschließlich für diese Evals verwendet.

**Verifikation:** Begrenzter lokaler Replay und gezielte Provideranfragen im
Eval-Workspace. Keine Änderung am App-Laufzeitcode durch diesen Task.

**Dateien:** Ausschließlich freigegebene Eval-Artefakte im bestehenden
Eval-Workspace; unfertige Feature-Entwürfe bleiben unberührt.

### E. Read-only Gateway und Vorschlagsanzeige

**Beads:** `fam-0ij`  
**Abhängigkeit:** D  
**Größe:** M

**Ziel:** Den geprüften Kontext als Vorschlag durch den Read-only-Pfad bis zur
App-Anzeige führen.

**Akzeptanzkriterien:**

- Authentifizierung, Haushaltsgrenze und Rate-Limit sind eingehalten;
- 1 bis 3 Vorschläge werden angezeigt;
- Herkunft `catalog` oder `model_generated` bleibt sichtbar;
- Einkaufslistenregel wird ohne Modellentscheidung umgesetzt;
- Mutation ist nur nach expliziter Nutzerbestätigung möglich;
- Fehler werden typisiert und verständlich angezeigt.

**Verifikation:** Fokussierte Gateway-, App- und Typecheck-Prüfungen. Kein
End-to-End-Test mit Rohdatenverarbeitung.

**Dateien:** Noch freizugebende App-/Backend-Implementierungsbereiche und
zugehörige Tests. Keine unfertigen Feature-Entwürfe verwenden.

### F. Produktwirkung messen

**Beads:** `fam-o57`  
**Abhängigkeit:** E  
**Größe:** S

**Ziel:** Prüfen, ob Nutzer nach einem Monat tatsächlich weniger Lebensmittel
wegwerfen.

**Akzeptanzkriterien:**

- Messung startet erst nach einem funktionierenden Rezeptfluss;
- Food-Waste-Wirkung wird getrennt von Providerkosten und Tokenverbrauch
  ausgewertet;
- primäre Ereignisse enthalten konkrete Bestands-/Lot-Referenz, Menge, Einheit,
  Grund, Haushalt, Nutzer und Zeitstempel;
- die wöchentliche Kurzabfrage bleibt ein getrenntes, grobes Messobjekt;
- die Messung beschreibt eine reale Nutzeraufgabe, keinen technischen Timer;
- das Ergebnis ist ein Produktentscheidungs-Signal, kein automatischer
  Modellwechsel.

**Verifikation:** Dokumentierter Messablauf und Review der Outcome-Daten.

**Dateien:** Produktmessungsdokumentation und nur nach Freigabe notwendige
Analytics-/Auswertungsbereiche.

## Checkpoints

### Checkpoint 1: Vertrag und Regeln

Nach A bis C:

- [ ] Structured-Output-Vertrag ist versioniert;
- [ ] deterministische Einkaufslisten- und Prioritätsregeln sind getestet;
- [ ] Gateway und Evals verwenden dieselben Validierungsinvarianten;
- [ ] menschliche Prüfung vor Provideranfragen.

### Checkpoint 2: Funktionierender read-only Flow

Nach D und E:

- [ ] beide Einstiege liefern denselben Rezeptvorschlagsvertrag;
- [ ] Katalogrezepte werden vor Fallback-Rezepten verwendet;
- [ ] leere Einkaufsliste erzeugt keine weitere Nachfrage;
- [ ] gefüllte Einkaufsliste fragt einmal nach der heutigen Einkaufsabsicht;
- [ ] keine automatische Mutation ist möglich;
- [ ] fokussierte Qualitätsgates sind grün.

### Checkpoint 3: Produktwert

Nach F:

- [ ] die reale Nutzeraufgabe ist messbar;
- [ ] die Auswertung beantwortet, ob weniger Lebensmittel weggeworfen werden;
- [ ] weitere Ausbauschritte werden aus dem Outcome abgeleitet.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Modell erhält zu viel Haushaltszustand | Kosten- und Datenschutzproblem | Kontext deterministisch minimieren |
| Modell erfindet Zutaten oder Bestandsmengen | Nutzer erhält falschen Vorschlag | IDs, Mengen und Allowlists nachvalidieren |
| Allergie- oder Sicherheitsregel wird nur im Prompt gelöst | potenziell gefährliche Antwort | harte Vor- und Nachprüfung im Code |
| Einkaufsliste wird als Bestand behandelt | falsche Rezept- und Bestandslogik | `planned_shopping_items` strikt trennen |
| Structured Output ist abgeschnitten | fehlerhafte Anzeige | fail-closed validieren, nicht reparieren |
| Technische Qualität steigt, Food Waste sinkt nicht | Feature ohne Produktwert | Outcome nach einem Monat messen |

## Offene Punkte vor Implementierungsbeginn

- Welcher konkrete App-/Backend-Pfad wird für das neue
  `recipe-suggestions`-Modul freigegeben?
- Welche Mindeststruktur und welcher Inhalt werden für den ersten
  autoritativen Rezeptkatalog und die Zutaten-Templates freigegeben?
- Wird das `waste`-Ereignis in einen bestehenden Inventar-Ledger integriert oder
  als eigene deklarative Struktur ergänzt?

Diese Punkte blockieren die Planprüfung nicht, aber die konkrete Dateiauswahl
und Implementierung.
