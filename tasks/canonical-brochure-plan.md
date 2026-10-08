# Implementierungsplan: Canonical Brochure Pipeline

Status: BRN-Vollscan, Detailseitenzahlen, Gruppierung und Cover-only-Auswertung
sind abgeschlossen. `fam-gvnp.5`, `.6` und `.7` sind offen. Der lokale
123-BRN-Händlerpilot ist nach 56 BRNs unterbrochen. Ein vollständiger
PLZ-Sample-Lauf für 22043 hat 25 BRNs und 590 Seiten geladen; alle 25
vollständigen Seitenvektoren sind verschieden. Die lokale Bildübersicht wird
erst ergänzt, wenn der Gesamtworkflow steht. Cloudflare-/R2-Uploads bleiben bis
zu diesem Schritt und Marcos visueller Prüfung der vollständigen Prospekte
gesperrt.
Kernlösung: `# Lösung für Prospekte.md`; operative Anleitung:
`docs/features/BROCHURE/how_to_use.md` (Abschnitt Listing-Only)
Prior-Beads: `fam-kl22` (geschlossene Analyse), `fam-zarz` (Voll-Scan)
Tasks: Beads, ein Bead je Task (`fam-*`). Plan ersetzt keinen bestehenden Plan.

## Overview

Der Haupt-Crawler speichert pro PLZ eine Kopie jedes sichtbaren Prospekts und
erzeugt damit 217178 Einträge (Voll-Scan 2026-10-07). Für den Canonical-Modus
waren zunächst 32–60 Gruppen erwartet. Der Voll-Scan ergibt mit echten
Detail-Seitenzahlen 119 Metadaten-Gruppen; Marco hat bestätigt, den
Gruppierungsschlüssel beizubehalten und 119 als gemessenes Ergebnis zu
berichten. Innerhalb einer Metadaten-Gruppe
(`storeName + validFrom + validUntil + detailPageCount`) werden aktuell
Seite-1-Hash-Cluster persistiert. Für eine saubere Trennung vollständiger
Prospekte wird Phase 5 die Gruppierung auf den geordneten Hashvektor aller
Seiten erweitern. Übrige Sichtungen laufen als Availability-Liste.

## Gemessener Stand (Voll-Scan 2026-10-07)

- 217178 Sichtungen an 10813 PLZ und 4550 eindeutige BRNs.
- Detail-Seitenzahlen: 4550/4550 vorhanden; 4538 BRNs (99,7 %) haben mehrere
  Seiten. Jeder Wert stammt aus `pages.length` der Bring-Detailantwort für die
  jeweilige BRN; die gemessenen Werte reichen von 1 bis 91 Seiten. Damit kennen
  wir die exakte gemeldete Seitenzahl je BRN für diesen Scan. Die Seitenbilder
  selbst sind damit noch nicht vollständig geladen oder visuell geprüft.
- 119 Metadaten-Gruppen; ihre Sichtungssumme stimmt mit dem Voll-Scan überein.
- Davon: Kaufland 6 Gruppen / 1006 BRNs, REWE 23 Gruppen / 3116 BRNs und
  XXXLutz 16 Gruppen / 43 BRNs.
- SHA-256 Seite 1: 4550/4550 Hashes vorhanden; bisherige Auswertung fand 61
  Gruppen mit gleichem Titelbild und 58 Gruppen mit regional abweichendem
  Titelbild.
- Persistiert: 3126 bisherige Seite-1-Hash-Cluster; alle 10813 PLZ werden
  abgedeckt. Diese Zahl misst aktuelle Titelbild-Cluster, keine exakt
  bestätigten vollständigen Prospekte.
Die Einzelseiten-Verifikation trennt unterschiedliche Titelbilder. Prospekte
mit gleichem Titelbild gelten erst dann als derselbe Prospekt, wenn die
geordneten SHA-256-Hashes aller Seiten übereinstimmen.

## Architektur-Entscheidungen

### Bezug zur Kernlösung

Die vier Schichten aus `# Lösung für Prospekte.md` bleiben der Ablauf:

1. PLZ-Listings und Verfügbarkeit erfassen.
2. Metadaten als Kandidatensuche und für den lokalen Bericht nutzen.
3. Ausgewählte vollständige Seiten kontrolliert lokal laden.
4. Seitenbytes per SHA-256 vergleichen und bekannte Bytes über Läufe hinweg
   wiederverwenden.

Der Vollscan korrigiert zwei frühe Annahmen der Kernlösung: Das Offers-Listing
liefert nur das Cover und meldet dort `pageCount: 1`; echte Seitenzahlen wurden
danach per Detail-Call für alle 4550 BRNs erfasst. `detail-pages.json` enthält
die Seitenanzahl pro BRN, aber keine vollständigen Seiten-URLs oder Bildbytes.
Gleiche Metadaten oder verlängerte Gültigkeit beweisen keine Bildidentität und
dürfen allein keinen Bildabruf überspringen. Exakte Wiederverwendung setzt
bekannte Seitenbytes beziehungsweise den vollständigen geordneten
Seitenhashvektor voraus.

Die lokale Prüfansicht wird erst ergänzt, wenn der lokale Gesamtworkflow steht.
Marco prüft darin die vollständigen Prospekte vor einem separaten
Cloudflare-/R2-Upload.

- **Schichten:** Gruppierung, Verifikation, Persistenz und Bericht bleiben als
  reproduzierbare Analysewerkzeuge in `tools/crawler/brochures/listing-only/`.
  Der Haupt-Crawler veröffentlicht ausschließlich den verifizierten Katalog;
  parallel laufende Dump-Veröffentlichung gibt es nicht. Der vorhandene
  App-Lesepfad filtert die Verfügbarkeit nach aktiver PLZ und schreibt in die
  bestehende lokale SQLite-Form.
- **Signaturebene:** Metadaten-Gruppierung erfolgt auf
  `storeName + validFrom + validUntil + detailPageCount`. Der Offers-Liste
  `pageCount` ist immer 1 und unbrauchbar; echte Seitenzahl kommt nur im
  Detail-Call.
- **Vorprüfung:** Pro BRN kann Seite 1 als günstiger Filter geladen und
  gehasht werden. Verschiedene Seite-1-Hashes beweisen verschiedene Prospekte;
  gleiche Seite-1-Hashes beweisen nur gleiche Titelbilder und erfordern für
  exakte Trennung den Vergleich der übrigen Seiten.
- **Vollständige Identität:** Die Identität eines Prospekts basiert auf der
  Seitenzahl und dem geordneten Vektor der SHA-256-Hashes aller Seitenbilder.
  Nur übereinstimmende vollständige Vektoren werden zusammengeführt;
  abweichende Vektoren bleiben getrennte regionale/inhaltliche Ausgaben.
- **Persistenz:** Ein Datensatz je bestätigtem vollständigem Seiten-Hashvektor
  mit `availableZipCodes` als String-Array. Keine per-PLZ-Duplikate.
- **Datenquellen:** Der bisherige Analyse-Lauf liest
  `all-stores-full.json` und Bring-Detail-Metadaten und lädt nur Seite 1.
  Der geplante exakte Vergleich lädt Folgeseiten in den Fällen, die eine
  vollständige Trennung erfordern.
- **Listing-first-Import:** Der nächste Import-Schritt beginnt mit einer
  vollständigen Metadaten-Liste je PLZ. Die daraus invertierte Zuordnung
  `BRN -> PLZ` bleibt die Quelle der Verfügbarkeit; es gibt keine Detail-Calls
  pro BRN und PLZ. Detail-Metadaten werden höchstens einmal pro eindeutiger
  BRN abgerufen, um die tatsächliche Seitenzahl zu erhalten.
- **Metadatenfilter:** Innerhalb eines Laufs gruppieren ausschließlich
  `storeName + validFrom + validUntil + detailPageCount` Sichtungen. Titel und
  URL ändern diesen freigegebenen Gruppierungsschlüssel nicht. URL-Signaturen
  sind kein Identitätsschlüssel, weil CDN-URLs je PLZ variieren. Über Läufe
  dient `storeName + validFrom + detailPageCount` mit der Gültigkeitszeitspanne
  nur als Kandidatensuche. Eine verlängerte `validUntil`-Zeitspanne oder gleiche
  Titelbild-Prüfsumme reicht allein nicht, um spätere Bildabrufe auszulassen.
  Im aktuell untersuchten Listing wurde keine stabile Inhalts-Signatur
  gefunden. Ohne eine solche Quelle kann der lokale Hash-Index Speicher und
  Uploads deduplizieren, aber keine Netzwerkabrufe sicher verhindern.
  Seite-1-SHA-256 filtert unterschiedliche Titelbilder; bei gleichem Titelbild
  muss der vollständige Seiten-Hashvektor verglichen werden.
- **Gezielter Bildabruf:** Neue Kandidaten laden alle Seiten in einen lokalen,
  budgetierten Asset-Ordner. SHA-256 wird über die Originalbytes jeder Seite
  vor Optimierung berechnet. Seite 1 kann verschiedene Prospekte früh trennen;
  sie allein kann keinen vollständigen Prospekt als bereits bekannt bestätigen.
  Exakte Gruppierung erfordert den Hash jeder Seite, in Seitenreihenfolge.
- **Laufübergreifende Deduplizierung:** Ein atomar geschriebener
  `seen-hashes.json`-Index hält SHA-256, Asset-Pfad und verknüpfte Prospekt-/
  Seiteneinträge fest. Wiederholte Bytes werden einer vorhandenen Asset-Datei
  zugeordnet und nicht erneut gespeichert oder hochgeladen. Eine lokale
  Duplikatdatei darf erst entfernt werden, nachdem die Referenz im Index
  geschrieben und validiert wurde. Uploads verwenden bytebasierte
  SHA-256-Schlüssel; bestehende URL-basierte R2-Schlüssel werden in einer
  separaten, messbaren Umstellung behandelt.
- **Messbarkeit:** Jeder Lauf berichtet Sichtungen, eindeutige BRNs,
  Metadaten-Kandidaten, Seite-1-Prüfungen, vollständige Prospektdownloads,
  geladene Seiten und bestätigte Byte-Duplikate getrennt. Übersprungene
  Netzwerkabrufe werden nur ausgewiesen, wenn eine stabile vollständige
  Inhalts-Signatur vorliegt. Unsichere Metadaten-Treffer werden nie als
  bestätigte Duplikate gezählt.

## Abhängigkeits-Graph

```
Task 1: Detail-Seitenzahl je BRN
    │
    └── Task 2: Metadaten-Gruppierung mit Seitenzahl
            │
            └── Task 3: Hash-Verifikation je Gruppe
                    │
                    └── Task 4: Bild-Cluster-Persistenz + Availability
                            └── Task 5: Bericht Ausgangssichtungen vs. gespeicherte Bild-Cluster
                                    └── Task 6: Cutover-Haupt-Crawler (dieser Zyklus)
```

## Task List

Bead-IDs siehe Beads-Index unten.

### Phase 1: Datengrundlage

- [x] **Task 1** (Bead `fam-05bp`): `fetch-detail-pages.ts` — Für jeden BRN aus dem
  Voll-Scan genau einen Bring-Detail-Call ausführen und
  `detail-pages.json` (`{ brn: pageCount }`) schreiben. Kosten: ~4550 Calls,
  konkurrierend 8, Dauer ~15–20 Min.
  - AC: Report hat einen Eintrag je BRN, pageCount > 1 für mind. 90 % der
    Einträge, 0 hard failures.
  - Verification: jq-Prüfung auf fehlende BRNs, Reportgröße.
  - Files: `tools/crawler/brochures/listing-only/fetch-detail-pages.ts`,
    `tools/crawler/data/listing-only/detail-pages.json`.

- [x] **Task 2** (Bead `fam-2ory`): `group-canonical.ts` — Liest Voll-Scan +
  Detail-Seitenzahlen und gruppiert nach
  `storeName + validFrom + validUntil + detailPageCount`. Output:
  `canonical-groups.json` mit BRN-Liste je Gruppe und `availableZipCodes`.
  - AC: Für den Voll-Scan vom 2026-10-07 sind 119 Gruppen zu berichten. Jede
    Gruppe hat BRNs + zips, naive Einträge == Summe der Gruppen-Sichtungen.
    Der frühere Zielkorridor 32–60 wurde durch das gemessene Ergebnis ersetzt.
  - Verification: jq-Prüfung auf Gruppenzahl und Summen.
  - Files: `tools/crawler/brochures/listing-only/group-canonical.ts`,
    `tools/crawler/data/listing-only/canonical-groups.json`.

### Phase 2: Verifikation und Persistenz

- [x] **Task 3** (Bead `fam-t428`, historischer Schritt): Der damalige
  Seite-1-Verifizierer `verify-canonical.ts` — pro Gruppe pro BRN genau
  eine Seite laden (Seite 1, optimiert nach dem bestehenden
  `downloadOptimizedImage`-Muster), SHA-256 vergleichen. Output:
  `canonical-verification.json` mit Hash je BRN und Bestätigung
  `identical | regional-variant | uncertain` bezogen auf Seite 1.
  - AC: Für Kaufland (1006 BRNs) und REWE (3116 BRNs) Hash je BRN vorhanden.
    Gleiche Titelbild-Hashes werden als `identical` markiert; diese historische
    Klassifikation belegt noch keine Gleichheit vollständiger Prospekte.
  - Verification: jq-Prüfung auf Hash-Konsistenz und Gruppenklasse.
  - Historische Files: `verify-canonical.ts` und
    `canonical-verification.json`; der Einstiegspunkt wird in Task 10 entfernt.

- [x] **Task 4** (Bead `fam-vz9v`): `persist-canonical.ts` — Der erste Stand
  persistierte Seite-1-Hash-Cluster; der aktuelle Einstieg liest den
  Vollseitenbericht und validiert den kompletten geordneten Hashvektor. Er
  schreibt je vollständiger Variante einen Datensatz
  (`{ canonicalBrn, storeName, title, validFrom, validUntil, pageCount,
  coverImage, pageUrls, availableZipCodes }`) nach
  `canonical-brochures.json`.
  - AC: Jeder Persistenzeintrag hat eine PLZ-Liste, vollständige Seitenhashes
    und einen reproduzierbaren Prospekt-Hash. Abweichende Seitenvektoren
    bleiben getrennt.
  - Verification: jq-Prüfung auf Datensatzanzahl und ZIP-Abdeckung.
  - Files: `tools/crawler/brochures/listing-only/persist-canonical.ts`,
    `tools/crawler/data/listing-only/canonical-brochures.json`.

- [x] **Task 5** (Bead `fam-qa9v`): `canonical-report.ts` — Vergleicht die Zahl
  der Vollscan-Sichtungen und der vollständigen Varianten aus
  `canonical-brochures.json` mit dem Verifikationsbericht und schreibt
  `canonical-report.json` mit Vollscan-, Varianten-, Metadaten- und
  Händlerzahlen samt PLZ-Abdeckung.
  - AC: Der Report zählt nur Varianten mit vollständigem Seitenhashvektor und
    prüft Sichtungs- und PLZ-Summen gegen die Eingabedaten.
  - Verification: jq-Prüfung auf Gesamtwerte.
  - Files: `tools/crawler/brochures/listing-only/canonical-report.ts`,
    `tools/crawler/data/listing-only/canonical-report.json`.

### Phase 3: Cutover und Nachweis

- [x] **Task 6** (Bead `fam-j4fc`): Cutover des Haupt-Crawlers auf die
  Ausgabe mit Bild-Clustern in diesem Zyklus. Supabase erhält eine
  `canonical_brochures`-Tabelle und eine `brochure_availability`-Relation mit
  einer Zeile je PLZ und Cluster. Regionale Hash-Varianten bleiben getrennte
  Datensätze. Der Cluster-Datensatz enthält die vollständigen Seiten samt
  Hotspots und private R2-Schlüssel. Der vorhandene App-Lesepfad und Screen
  werden weiterverwendet; die PLZ-Auswahl filtert über
  `brochure_availability`.
  - AC: App rendert Bild-Cluster, alle Seiten und Hotspots für die aktive PLZ.
  - Implementiert: neuer Hauptpfad verlangt R2 für echte Veröffentlichungen,
    hasht und spiegelt Bilder, baut den SHA-256-Katalog und veröffentlicht nur
    vollständig geprüfte PLZ atomar. Der vorhandene SQLite-Sync und die
    vorhandenen Screens bleiben erhalten. `brochure_dumps` und dessen direkte
    Schreibrechte wurden aus dem deklarativen Schema entfernt. Die alten
    Seed- und R2-Migrationsskripte sowie der ersetzte Uploader-Test wurden
    entfernt.
  - Identitätsgrenze: Der aktuelle Katalog-Hash beruht auf Seite 1 und
    bestätigt deshalb bisher nur Titelbild-Cluster. Die vollständige
    Prospekttrennung und ein neuer Kataloglauf gehören zu Task 13.
  - Migrationen mit `bun run db:dec -- --no-apply` erzeugt und geprüft:
    `20261007152833_canonical_brochure_catalog.sql` ersetzt die Dump-Tabelle
    durch den Katalog; `20261007154338_canonical_brochure_foreign_key_indexes.sql`
    ergänzt Indizes für die drei Fremdschlüssel. Beide Migrationen wurden nur
    auf der lokalen Supabase-Datenbank angewendet.
  - `bun run db:types` hat `src/lib/database.types.ts` aus der lokalen DB
    generiert. Der gezielte pgTAP-Lauf bestand mit 53 Assertions. Typecheck,
    Biome und die fokussierten App-/Crawler-Tests bestanden ebenfalls.
  - `test:db` reicht einen optionalen Dateipfad an die Supabase CLI
    weiter, sodass `bun run test:db <datei>` nur diesen Test ausführt.
  - Ein Gerätelauf ist noch offen. Es wurden keine Katalogdaten in ein
    produktives Supabase-Projekt oder einen R2-Bucket geladen.
  - Files: `supabase/schemas/*.sql`, `supabase/tests/*.test.sql`,
    `src/features/brochures/**`, `tools/crawler/brochures/**`.

### Phase 4: Vollständige Seitenverifikation statt Cover-Manifest

Der Cover-Manifest-, dHash- und OCR-Ansatz ist verworfen. Es wird kein neues
`image-manifest.json` erzeugt und keine Cover-Ähnlichkeit zur
Ausgabentrennung verwendet. Die alten Beads `fam-zarz` und `fam-gvnp.1` werden
als durch Task 13 ersetzt behandelt; ihre verbliebenen Dateien werden in Task
10 nach Referenzprüfung entfernt.

- [x] **Task 9** (Bead `fam-gvnp.2`): `listing-only` in der aktiven
  Prospekt-Dokumentation zum vollständigen Hash-Workflow machen.
  - AC: Aktive Anleitungen beschreiben `verify-full-brochures.ts`,
    `persist-canonical.ts` und `canonical-report.ts`, nennen das erforderliche
    Bytebudget und die erzeugten Pfade und erklären, dass nur vollständige,
    geordnete Seitenhashes eine Ausgabe zusammenführen.
  - Verification: Referenzsuche und `git diff --check`.
  - Files: `docs/features/BROCHURE/how_to_use.md`,
    `tools/crawler/brochures/README.md`.

- [x] **Task 10** (Bead `fam-gvnp.3`): Veraltete Sample-, Cover-Manifest- und
  Bildähnlichkeits-Einstiegspunkte nach der Dokumentationsumstellung entfernen.
  Vor dem Löschen alle Aufrufer suchen; gemeinsam genutzte Hilfen behalten.
  - AC: Kein unterstützter Aufruf und kein aktiver Test hängt an den alten
    Einstiegspunkten; entfernte Dateien, Tests und Dokumentationsabschnitte
    sind samt Referenznachweis gelistet.
  - Verification: Repository-weite Referenzsuche, fokussierte Tests und
    `bun run check`.
  - Files: nur nachgewiesene ungenutzte Sample-, Cover-Manifest- und
    Ähnlichkeits-Einstiegspunkte sowie ihre Tests und aktiven Dokuabschnitte.

## Kontrollpunkte

### Checkpoint: Nach Task 1
- [x] Detail-Seitenzahlen vollständig, 0 Hard-Failures.
- [x] Files unter `tools/crawler/data/listing-only/` vorhanden.
- [x] 119 Metadaten-Gruppen für den Voll-Scan vom 2026-10-07 berichtet.

### Checkpoint: Nach Task 3
- [x] Hash-Verifikation für Kaufland + REWE abgeschlossen.
- [x] `identical | regional-variant | uncertain` klar pro Gruppe, bezogen auf Seite 1.
- [x] 4550/4550 BRNs gehasht: 61 Gruppen mit gleichem Titelbild, 58 mit
  regional abweichendem Titelbild, 0 unsichere Gruppen.
- [x] Die 4550 Hashes belegen nur Seite-1-Identität; sie zählen keine exakt
  identischen vollständigen Prospekte. Für die vollständige Trennung bleibt
  der Seiten-Hashvektor aus Task 13 offen.

### Checkpoint: Nach Task 5
- [x] Gespeicherte Bild-Cluster + Bericht vorhanden.
- [x] Reduktion der gespeicherten Titelbild-Cluster ist messbar (98,56 %).
- [x] Persistenz enthält 3126 Seite-1-Hash-Cluster mit vollständiger
  PLZ-Abdeckung.
- [x] Marco hat den Cutover in diesem Zyklus freigegeben, regionale Varianten
  als separate Datensätze gewählt und eine zweite ALDI-Nord-Quelle abgelehnt.
- [x] Deklarative Migration erzeugt; sie enthält den erwarteten Tabellenwechsel.
- [x] Lokale Migration anwenden, pgTAP ausführen und `db:types` generieren.
- [ ] Device-Check nach erfolgreichem Schema- und Typabgleich.

### Checkpoint: Nach Task 13
- [ ] Jeder BRN hat einen vollständigen, geordneten Seitenhashvektor.
- [ ] Abweichende Innenseiten ergeben getrennte Prospektvarianten.
- [ ] Alle Assets sind gegen ihre SHA-256-Dateinamen geprüft und bleiben im
  gesetzten Speicherbudget.

### Checkpoint: Nach Task 10
- [x] Aktive Anleitung führt nur zum vollständigen `listing-only`-Pfad.
- [x] Alte Cover-Analyse, Manifest, OCR- und fokussierte Tests entfernt.
- [x] Gezielte Referenzsuche bestätigt, dass keine aktiven Aufrufer übrig sind.
- [x] Historische Listing-only-Daten bleiben für den Vergleich erhalten.

### Zusätzliches Epic-Arbeitspaket

- Bead `fam-fmx6` (Bildzugriff nur für authentifizierte Nutzer) ist umgesetzt
  und geschlossen.
- Bead `fam-zarz` und `fam-gvnp.1` beschreiben den verworfenen
  Cover-Manifest-/dHash-/OCR-Ansatz. Keine neuen Cover-Manifeste oder lokalen
  Ähnlichkeitsberichte erzeugen; die alten Dateien werden im Cleanup-Task
  entfernt, sobald ihre Caller-Prüfung abgeschlossen ist.

### Phase 5: Listing-first-Import mit dauerhafter Bild-Deduplizierung

Tasks 11 und 12 bereiten die Kandidaten vor. Task 13 beginnt mit dem unten
beschriebenen begrenzten Hash-Pilot; die vollständige lokale Prüfung und Task
14 bleiben offen. Die Tasks erweitern
`tools/crawler/brochures/listing-only/` und den Produktivpfad. Sie reaktivieren
nicht den Sample-Crawler.

#### Filterstufen vor dem Bildabruf

1. **Metadaten einsammeln:** Pro PLZ nur Angebote und ihre Metadaten lesen,
   Sichtungen zu `BRN -> PLZ-Menge` invertieren und echte Seitenzahlen höchstens
   einmal pro BRN aus den Detaildaten ergänzen. In dieser Stufe werden keine
   Bilder geladen.
2. **Metadaten filtern:** Innerhalb des Laufs bleibt der freigegebene
   Gruppierungsschlüssel `storeName + validFrom + validUntil + detailPageCount`.
   Der Vollscan vom 2026-10-07 ergibt damit 119 Gruppen. Diese Gruppen sind
   Download-Kandidaten, aber kein Beweis gleicher Bildinhalte; Titel und URL
   ändern den Gruppierungsschlüssel nicht. Metadaten und Seite-1-SHA allein
   überspringen keinen Abruf; nur ein vollständiger Vektor mit lokal erneut
   bestätigten Asset-Bytes darf wiederverwendet werden.
3. **Kandidaten vollständig laden:** Für jeden noch nicht vollständig
   verifizierten BRN lädt der Verifizierer alle Detailseiten mit lokalem Ziel
   und Speicherbudget. SHA-256 wird vor Optimierung über Originalbytes
   berechnet. Die geordneten Hashes bestimmen die Ausgabe und halten regionale
   Varianten mit abweichenden Bytes getrennt. Eine Metadatengruppe kann darum
   mehrere Ausgaben ergeben.
4. **Bildbytes wiederverwenden:** Erst nach dem Download werden gleiche
   Seitenbytes anhand ihres SHA-256 über verschiedene URLs und Läufe hinweg
   einem vorhandenen Asset zugeordnet. Der vollständige Prospekthash bleibt
   zusätzlich der geordnete Vektor aller Seitenhashes. Index und Assets werden
   lokal validiert; ein R2-Schlüsselwechsel ist ein eigener, messbarer Schritt.

Eine Verlängerung der Gültigkeit kann die PLZ-Verfügbarkeit einer bereits
vollständig bestätigten Ausgabe ergänzen. Sie darf keinen Abruf auslassen,
solange kein passender vollständiger Seitenvektor vorliegt.

#### Nächster Schritt: Hash-Pilot für große Händlergruppen

Die frühere Schätzung von 32 Metadatengruppen und etwa 32 Detail-Calls stammt
aus einer Voranalyse. Sie ist nicht der gemessene Vollscan: `fam-05bp` hat
bereits einmalige Detail-Calls für alle 4550 BRNs abgeschlossen; `fam-2ory`
und `fam-gvnp.4` weisen 119 Gruppen aus. Die Seitenzahlen werden deshalb nicht
erneut geladen.

Der erste Vollseiten-Pilot verwendet die vorhandenen Daten und bleibt lokal:

1. `fam-gvnp.5` erzeugt eine reproduzierbare Auswahl der 32 Gruppen mit den
   meisten PLZ-Sichtungen aus Kaufland, REWE und XXXLutz. Die Auswahl sortiert
   nach Sichtungszahl absteigend und verwendet Händlername, Gültigkeit und
   Seitenzahl als stabile Gleichstandsregel. Die drei Händler enthalten im
   gemessenen Vollscan zusammen 45 Gruppen.
2. Für jede ausgewählte Gruppe wird die BRN mit lexikografisch kleinster ID
   als Gruppenvertreter gewählt. Ein Detail-Call lädt deren Seiten-URLs; alle
   Seitenbytes werden kontrolliert lokal geladen und vor jeder Optimierung
   gehasht. Der Bericht weist ausgewählte Gruppe, BRN, Seitensumme,
   Downloadbytes und Fehler aus.
3. Ein Gruppenvertreter belegt keine Identität für die übrigen BRNs. Innerhalb
   der ausgewählten Gruppen werden deshalb alle weiteren BRNs mit gleichem
   Seite-1-SHA vollständig gehasht, bevor eine Gleichheit oder Abweichung
   festgestellt wird. Unterschiedliche Seite-1-SHAs bleiben getrennte
   Ausgaben; fehlende oder partielle Seitenvektoren bleiben ungeklärt.
4. Fortschritt und Assets sind budgetiert, fortsetzbar und lokal. Der Pilot
   schreibt weder nach Cloudflare/R2 noch nach Supabase. Die Prüfansicht kommt
   nach Fertigstellung des lokalen Gesamtworkflows; vor dem ersten Upload prüft
   Marco dort die vollständigen Prospekte visuell.

Der Pilot ersetzt die Gesamtanforderung aus Task 13 nicht. Er liefert eine
begrenzte, überprüfbare erste Messung; ungeprüfte Gruppen werden nicht als
identisch gezählt oder veröffentlicht.

#### Prüfreihenfolge vor einem Cloudflare-/R2-Upload

1. Lokalen Metadatenfilter, vollständige Seitenhashes und dauerhaften Byteindex
   gemäß `fam-gvnp.5` bis `.7` fertigstellen und Ende-zu-Ende prüfen.
2. Danach eine lokale Prüfansicht für die gespeicherten vollständigen
   Prospekte ergänzen. Sie gehört zum fertigen Workflow, nicht zum Vorab-Pilot.
3. Marco prüft die vollständigen Prospekte in dieser Ansicht. Erst danach kann
   ein separater Upload-Schritt freigegeben werden.

#### Messhinweis aus dem früheren 40-PLZ-Sample

- 196 Sichtungen ergaben 132 BRN-/URL-Kombinationen und 13
  Metadatengruppen; die URL-basierte Schätzung hätte 7912 Seiten eingeplant.
- 64 Wiederholungen lagen über PLZ hinweg; die lokalen PLZ-Zähler zeigten
  dagegen jeweils keine Duplikate. Der Report braucht deshalb globale und
  lokale Zähler.
- URLs variieren offenbar je PLZ und sind kein stabiler Inhaltsvergleich.
  Die 13 Metadatengruppen sind ein Kandidatenwert, kein bestätigter Wert für
  einzigartige Ausgaben. Ein Seite-1-Hash trennt unterschiedliche Titelbilder,
  bestätigt aber nicht die Gleichheit vollständiger Prospekte. Dafür müssen
  BRNs mit gleichem Titelbild über alle Seiten verglichen werden.
- Diese Stichprobe dient als Begründung für den Vollscan-Filter, nicht als
  Produktionsumfang oder als Grund, den stillgelegten Sample-Crawler wieder
  einzuführen.

- [ ] **Task 11** (Bead `fam-gvnp.4`): Metadaten-Liste und
  `listing-dedup-report.json` pro vollständigem Lauf ausgeben. Angebote werden
  über alle PLZ invertiert, so dass jedes BRN seine exakte PLZ-Menge behält.
  Doppelte Sichtungen innerhalb eines Laufs werden ausschließlich nach dem
  freigegebenen Schlüssel `storeName + validFrom + validUntil +
  detailPageCount` gruppiert. Für den Vollscan vom 2026-10-07 werden 119
  Gruppen erwartet; Titel und URL sind keine zusätzlichen Schlüssel.
  - AC: Keine Bilder oder R2/Supabase-Schreibzugriffe; Detail-Calls höchstens
    einmal je BRN; URL- oder Titelabweichungen erzeugen keine zusätzlichen
    Gruppen;
    Report zählt rohe Sichtungen, eindeutige BRNs, Metadaten-Gruppen und
    PLZ-Verfügbarkeit nachvollziehbar.
  - Verification: Berichtssummen stimmen mit dem Vollscan überein; gezielte
    Tests für überlappende PLZ und abweichende Bild-URLs.
  - Files: `tools/crawler/brochures/listing-only/all-stores-full.ts`,
    zugehörige Listing-/Gruppierungsmodule und fokussierte Tests.

- [ ] **Task 12** (Bead `fam-gvnp.5`): Laufübergreifenden
  Metadaten-Kandidatenindex und Seite-1-Vorprüfung für inkrementelle Läufe
  ergänzen. Die Kandidatensuche verwendet die freigegebenen Felder
  `storeName + validFrom + detailPageCount`; Gültigkeit dient nur zum Finden
  geänderter Kandidaten. Der Seite-1-Hash trennt unterschiedliche Titelbilder,
  bestätigt aber nicht die Gleichheit vollständiger Prospekte. Mangels stabiler
  Bring-Inhaltssignatur überspringt der Metadatenindex keine Bildabrufe.
  - CLI liest `canonical-groups.json`, die Seite-1-SHAs aus
    `canonical-verification.json` und optional den letzten
    `metadata-candidate-index.json`-Stand. Ein fehlender Index startet sicher
    eine neue Historie; ein beschädigter Index stoppt vor jedem Output.
    `metadata-candidate-report.json` und der neue Index werden atomar lokal
    geschrieben.
  - Der Report wählt reproduzierbar die 32 meistgesehenen Gruppen aus
    Kaufland, REWE und XXXLutz. Er nennt je Gruppe die Vertreter-BRN mit der
    kleinsten ID sowie alle BRNs mit demselben Seite-1-SHA wie dieser
    Vertreter. Der Pilot-Umfang zählt diese BRNs und deren Seiten, ohne sie
    schon zu laden oder als identisch einzustufen.
  - AC: Der Report markiert Metadaten- und Titelbild-Treffer nur als
    Kandidaten. Gleiche vollständige Seiten-Hashvektoren bestätigen gleiche
    Prospekte; fehlende Hashes führen zur konservativen Prüfung/Beibehaltung.
    Gültigkeitsverlängerung aktualisiert Verfügbarkeit ohne
    Identitätsbehauptung; Netzwerkabrufe werden nur bei einer künftig belegten
    stabilen Quelle für die vollständige Inhalts-Signatur übersprungen. Der
    Report enthält eine stabile Pilot-Auswahl und deren Seitenbudget.
  - Verification: Tests für neue, unveränderte, verlängerte, gleiche Titelbilder
    mit abweichenden Innenseiten, regionale und unvollständige Kandidaten; kein
    Unsicher-Fall wird als Duplikat gezählt. CLI-Lauf auf den lokalen
    Vollscan-Inputs weist alle 119 Gruppen und 4550 BRNs aus und erzeugt die
    beiden lokalen Outputs.
  - Files: `tools/crawler/brochures/listing-only/metadata-candidates.ts`,
    `test/crawler/metadata-candidates.test.ts`,
    `tools/crawler/data/listing-only/metadata-candidate-index.json` und
    `tools/crawler/data/listing-only/metadata-candidate-report.json`.

  Für den ersten Hash-Pilot erzeugt dieser Schritt zusätzlich die stabile
  Auswahl der 32 höchstfrequenten Gruppen aus Kaufland, REWE und XXXLutz gemäß
  der oben dokumentierten Gleichstandsregel. Die Auswahl ist ein Pilotumfang,
  keine Behauptung über die Gesamtzahl der Ausgaben. Im aktuellen Datensatz
  umfassen diese Gruppen 4100 BRNs und 166869 Seitenabrufe, falls jede BRN
  vollständig geprüft wird. Die 32 Vertreter umfassen 869 Seiten; ihre
  Seite-1-identischen Kandidaten erweitern den Pilot auf 123 BRNs und 3205
  Seitenabrufe. Andere Seite-1-Varianten bleiben ungeprüft.

- [ ] **Task 13** (Bead `fam-gvnp.6`): Alle Seiten jedes noch nicht vollständig
  verifizierten BRN kontrolliert in ein lokales, budgetiertes Asset-Verzeichnis
  laden. Für jede Seite SHA-256 über die Originalbytes vor Optimierung bilden.
  Nur gleiche vollständige
  Hashvektoren innerhalb desselben freigegebenen Metadatenschlüssels und bei
  gleicher Seitenzahl werden als dieselbe Ausgabe gruppiert. Pro
  Metadatengruppe dürfen unterschiedliche Ausgaben entstehen. Der daraus
  gebildete Gesamt-Hash ersetzt
  beim Katalogeintrag die bisherige Seite-1-Bedeutung von `verified_sha256`.
  Den Produktivpfad mit denselben geladenen Seitenbytes speisen, damit Seiten
  nicht für Verifikation und Veröffentlichung doppelt geladen werden.
  - AC: Alle BRNs erhalten einen vollständigen Seitenhashvektor. Gleiche
    Titelbilder mit abweichenden Innenseiten bleiben getrennte Prospekte; nur
    gleiche vollständige Hashvektoren werden zusammengeführt.
    Bericht weist Seiten-Hashvektoren, Prospekt- und Seitenzahlen vor/nach Filter aus;
    fehlgeschlagene/partielle Abrufe veröffentlichen keine unvollständigen
    PLZ; erneutes Fortsetzen lädt fertige Assets nicht nochmals.
  - Verification: fokussierte Tests für Budget, Resume, Partials, frühe
    Trennung bei abweichender Seite 1 und vollständigen Vergleich bei gleicher
    Seite 1; fokussierter Pilotlauf ohne Cloud-Schreibzugriffe.
  - Files: `tools/crawler/brochures/listing-only/verify-full-brochures.ts`,
    lokaler Asset-Store, Persistenz/Report, fokussierte Tests und CLI-Dokumentation.

  Der CLI-Lauf verlangt eine ausdrückliche Umfangswahl: `--candidate-report`
  verarbeitet nur den lokalen 32-Gruppen-Pilot; `--zip-code=<PLZ>` nimmt alle
  im Scan für eine einzelne PLZ gelisteten BRNs; `--all-brns` bleibt dem
  späteren Gesamt-Lauf vorbehalten. Pilotberichte sind als Teilumfang markiert
  und werden nicht als vollständiger Katalog akzeptiert. Für PLZ 22043 wurden
  25 BRNs mit 590 Seiten erfolgreich geprüft. Der breite Händlerpilot bleibt
  nach 56 von 123 BRNs unvollständig.

- [ ] **Task 14** (Bead `fam-gvnp.7`): Persistenten
  `seen-hashes.json`-Byteindex und SHA-256-basierte Asset-Schlüssel ergänzen.
  Gleiche Bytes über Läufe hinweg referenzieren ein gespeichertes Asset; erst
  nach bestätigter Index-Aktualisierung kann eine redundante lokale Kopie
  entfernt werden. Die Umstellung bestehender URL-basierter R2-Objekte muss
  ohne kaputte Katalogreferenzen und mit nachvollziehbarer Speicherbilanz
  erfolgen.
  - AC: Index-Schreibvorgang ist atomar und wiederherstellbar; jeder Eintrag
    referenziert ein vorhandenes Asset mit passendem Hash; Byte-Duplikate,
    Uploads und eingesparter Speicher sind separat gezählt; unveränderte
    Inhalte führen zu einem gemeinsamen Asset-Key.
  - Verification: Tests für gleiche Bytes mit verschiedenen URLs, parallele
    Schreibvorgänge, beschädigten Index und Wiederaufnahme; Vergleich von
    R2-Bestand und Katalogreferenzen vor/nach Cutover.
  - Files: `tools/crawler/brochures/r2-storage.ts`, lokaler Asset-/Hash-Index,
    Katalogintegration, fokussierte Tests und Prospekt-Dokumentation.

#### Kontrollpunkt nach Task 11

- [ ] Vollscan-Ausgabe enthält eine vollständige BRN-zu-PLZ-Umkehrung.
- [ ] Metadaten gruppieren PLZ-Sichtungen trotz unterschiedlicher URLs.
- [ ] Detail-Seitenzahlen kommen aus höchstens einem Detail-Call pro BRN.

#### Kontrollpunkt nach Task 14

- [ ] Ein zweiter identischer Lauf erzeugt keine zusätzlichen Byte-Assets.
- [ ] Regionale Varianten bleiben getrennte Prospekte, wenn ihre Seitenbytes
  abweichen.
- [ ] Index, Asset-Dateien, Katalogverweise und Speicherbericht stimmen überein.

## Risiken und Mitigationen

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Bring-Detail-Call limitiert (Rate-Limit) | Hoch | Retry mit Backoff; Concurrency 8; Fortsetzung über Progress-Datei |
| Abweichender Hash in derselben Metadaten-Gruppe (regionale Variante) | Mittel | Als `regional-variant` markieren, nicht deduplizieren; in Bericht sichtbar |
| Voll-Scan JSON groß (53 MB) | Niedrig | Streaming-JQ oder Memory-Budget beim Grouping |
| Unterbrochene Katalogveröffentlichung | Hoch | Cluster und Verfügbarkeiten innerhalb einer Datenbanktransaktion ersetzen; R2-Bilder vor dem Datenbankschritt veröffentlichen |
| Fehlende lokale Bildbytes für den Bericht | Mittel | Der Vollseiten-Verifizierer speichert Originalbytes content-addressed und schreibt erst nach vollständiger Prüfung den Bericht. |
| Metadaten-Kollision über Läufe | Hoch | Metadaten nur zur Kandidatensuche nutzen; Seite-1-SHA bestätigen und bei Unklarheit vollständig laden. |
| Deduplizierungsindex beschädigt oder veraltet | Hoch | Atomar schreiben, Assets vor dem Löschen validieren und bei Indexfehlern konservativ vollständig laden. |
| Unterschiedliche Bring-URLs für gleiche Bytes | Mittel | URLs nie als Byte-Identität verwenden; Inhalte hashen und erst danach Asset-Keys teilen. |

## Beads-Index und Abhängigkeiten

| Task | Bead | Hängt ab von |
|------|------|-------------|
| 1 | `fam-05bp` | — |
| 2 | `fam-2ory` | `fam-05bp` |
| 3 | `fam-t428` | `fam-2ory` |
| 4 | `fam-vz9v` | `fam-t428` |
| 5 | `fam-qa9v` | `fam-2ory`, `fam-vz9v` |
| 6 | `fam-j4fc` | `fam-qa9v` |
| 7 | `fam-zarz` | `fam-t428` |
| 8 | `fam-gvnp.1` | `fam-zarz` |
| 9 | `fam-gvnp.2` | `fam-gvnp.1` |
| 10 | `fam-gvnp.3` | `fam-gvnp.2` |
| 11 | `fam-gvnp.4` | `fam-gvnp.3` |
| 12 | `fam-gvnp.5` | `fam-gvnp.4` |
| 13 | `fam-gvnp.6` | `fam-gvnp.5` |
| 14 | `fam-gvnp.7` | `fam-gvnp.6` |

## Getroffene Entscheidungen

- Cutover in diesem Zyklus.
- Regionale Varianten werden je SHA-256-Cluster als getrennte Datensätze
  gespeichert.
- Keine zweite Quelle für ALDI Nord.
- Der Task-6-Cutover ersetzt die frühere Dump-Veröffentlichung vollständig.
