# KaufDA-Prospektpipeline: Produktionsplan

**Status:** Nachfragegesteuerte Umsetzung fertig und lokal geprüft. Die Migration wurde außerdem auf das verknüpfte Supabase-Projekt angewendet. Die App stellt nur ihre aktive PLZ ein, wenn diese noch nie erfolgreich gescannt wurde oder der letzte Erfolg mindestens fünf Tage zurückliegt. Ein Deutschlandlauf über alle 10.813 PLZ findet nicht statt.

**Grundlage:** [PROSPEKTE_ARCHITECTURE.md](./PROSPEKTE_ARCHITECTURE.md)

## Ziel

Den lokalen KaufDA-Test als einfachen, stabilen Produktionslauf für alle
Prospekte betreiben, die KaufDA für eine angefragte PLZ über sämtliche
Kategorien anbietet. Die App stellt einen Scan ein, wenn es für die PLZ noch
keinen erfolgreichen Lauf gibt oder dieser mindestens fünf Tage zurückliegt.
GitHub Actions liest alle 15 Minuten nur diese fälligen App-Anfragen. Für jede
ausgewählte PLZ paginiert der Runner den vollständigen regionalen KaufDA-Katalog,
übernimmt alle echten Viewer-Seiten und schreibt das Ergebnis nach Supabase.
Die App lädt originale Bonial-CDN-Bild-URLs. Der Runner lädt und speichert keine
Bildbytes. R2 gehört nicht zum Zielpfad.

Jeder PLZ-Lauf erzeugt seine eigene Prospektkopie. Eine KaufDA-contentId allein
beweist nicht, dass Seiten und Angebote in allen PLZ identisch sind. Datensätze
und Verfügbarkeit werden daher an die Anfrage-PLZ gebunden. Es gibt keine
BRN-Identität und keine automatische gemeinsame Kopie über mehrere PLZ.

## Festgestellter Ist-Stand

- *scripts/scrapers/kaufda.ts* ruft KaufDAs PLZ-basierten `/api/shelf`-Katalog
  und den Bonial-Viewer direkt per HTTP ab. `sectorIds` bleibt leer, damit alle
  Kategorien einfließen. Es lädt keine Bildbytes und benötigt keinen Browser.
- *scripts/scrapers/run-kaufda.ts* verarbeitet genau eine PLZ, liest alle
  Shelf-Seiten dieser PLZ und ruft anschließend die Seiten
  aller echten Prospekte ab. Publisher werden aus der KaufDA-Antwort erkannt;
  dynamische Angebotskarten ohne Prospektseiten werden übersprungen. Erst nach
  erfolgreichem Gesamtabruf veröffentlicht der Runner den vollständigen
  PLZ-Scope. Ein Fehler lässt den zuletzt erfolgreichen Datenbestand der PLZ
  unangetastet.
- Die historische ALDI-Beispielausgabe unter
  *scripts/scrapers/output/kaufda-aldi-example.json* wird von keinem aktiven
  App- oder Runnerpfad geladen. App-Sync schreibt ausschließlich die geprüfte
  PLZ-Antwort; ein Fehler erhält den letzten guten SQLite-Stand.
- Das deklarative Supabase-Modell, der Publisher und die App verwenden
  regionale KaufDA-IDs und originale Bonial-Bildhosts. Eine kleine PLZ-Scan-
  Warteschlange hält Zeitpunkt, Erfolg und verzögerte Wiederholung. Die
  bestehende Tabelle für Händlerfavoriten bleibt bestehen.
- Der KaufDA-Seiten- und Bonial-Viewer-Endpunkt ist im Prototyp beobachtet,
  aber in den hier gefundenen offiziellen Quellen nicht als stabiler öffentlicher
  API-Vertrag dokumentiert. Der Runner braucht deshalb Antwortvalidierung,
  einen kleinen Live-Pilot und ein klares Fehlerverhalten.
- Der frühere Lauf über eine feste Händlerliste ist durch den Shelf-Abruf
  ersetzt. Ein PLZ-Dry-Run für 22043 am 26.10.2026 fand in allen Kategorien
  75 echte Prospekte von mehreren Dutzend Publishern mit 1.480 Seiten und
  7.323 Hotspots in 12 Sekunden, ohne Datenbank- oder Bildzugriff. Inhalt und Verfügbarkeit sind PLZ- und
  zeitabhängig. [KaufDA](https://www.kaufda.de/)

## Zielarchitektur

1. **Transport:** Bun-fetch ruft `/api/shelf` mit Koordinaten und Standort-Cookie
   ab. Der Katalog wird bis zur letzten Seite durchlaufen. Für jede echte
   Prospekt-contentId fragt der Runner anschließend die Viewer-JSON-Daten ab.
   Playwright und Browserinstallation werden nicht benötigt.
2. **Normalisierung:** Ein kleiner Adapter wandelt rohe KaufDA-Antworten in
   die vorhandene Dump-Form für Publisher, Prospekte, Seiten und Hotspots um.
   Publisher-ID und -Name stammen aus den Prospektmetadaten. Nur Einträge mit
   `content.type === BROCHURE` und positiver Seitenzahl werden verarbeitet;
   dynamische Angebote und andere Shelf-Inhalte werden übersprungen.
3. **Regionale Identität:** Die stabile interne Prospekt-ID enthält Quelle,
   PLZ, Publisher-ID und KaufDA-contentId, zum Beispiel
   kaufda:22043:kaufda:<publisherId>:<contentId>. Der Detail-Endpunkt wird je
   PLZ mit deren Koordinaten abgefragt. Eine andere PLZ bekommt einen eigenen
   Datensatz; die gleiche contentId erzeugt keine PLZ-übergreifende Kopie.
4. **Speicherung:** Die Tabellen entsprechen der generischen Form aus der
   Architektur: Händler, Prospekte, Seiten und PLZ-Verfügbarkeit. Ein
   Prospekt enthält Gültigkeit, Titel, Cover-URL und Seitenzahl. Eine Seite
   enthält Bild-URL und Hotspots. Die Bild-URLs bleiben externe
   Bonial-CDN-Referenzen.
5. **Veröffentlichung:** Supabase stellt eine eng begrenzte RPC-Funktion für
   den atomaren Austausch eines vollständig geprüften PLZ-Scope bereit.
   Ungültige oder unvollständige Antwortdaten lassen den zuletzt erfolgreichen
   Scope unangetastet. Ein nachweislich vollständiger Lauf ohne Prospekte darf
   dagegen eine echte leere Antwort veröffentlichen.
6. **App:** Die App fragt die Verfügbarkeit für ihre aktive PLZ ab und schreibt
   in die bestehende lokale SQLite-Form. Fehler halten den letzten guten
   SQLite-Stand. Beispielinhalte werden nur in Tests oder einer ausdrücklich
   gestarteten lokalen Vorschau verwendet.
7. **Runner:** Die App-PLZ-Anfragen liegen in Supabase. Ein leichtgewichtiger
   GitHub-Job prüft sie alle 15 Minuten und startet Scraper-Jobs nur für fällige
   PLZ. Pro Poll werden höchstens 25 PLZ ausgewählt, mit bis zu vier
   gleichzeitigen Jobs. Jede PLZ wird höchstens einmal alle fünf Tage erneut
   abgefragt. Ein manueller Lauf verlangt eine einzelne PLZ. Keine
   Hintergrundaufgabe scannt die vollständige deutsche PLZ-Datei bei KaufDA.

## Produktionsregeln

### Abruf und Validierung

- PLZ bleiben fünfstellige Zeichenketten, damit führende Nullen erhalten
  bleiben. Der Standortresolver liefert PLZ, Ortsname, Breite und Länge aus
  einer versionierten, lizenzierten Quelle. Fehlende Koordinaten brechen den
  betroffenen Scope ab, bevor KaufDA abgefragt wird.
- Jeder Request hat eine feste Zeitgrenze. Begrenzte Wiederholungen gelten nur
  für Netzwerkfehler, HTTP 429 und HTTP 5xx; Retry-After wird beachtet. Andere
  HTTP-Fehler, JSON-Fehler oder unerwartete Datenformen werden klar gemeldet.
- Detailabrufe laufen sequenziell mit 50 ms Mindestabstand pro Job. Die Matrix
  begrenzt gleichzeitige Jobs auf vier; 429-Antworten folgen ihrem
  Retry-After-Wert.
- Eine PLZ wird nur durch eine authentifizierte App-Anfrage eingestellt. Ein
  erfolgreicher Scan gilt fünf Tage; erneute App-Aufrufe währenddessen lösen
  keinen weiteren KaufDA-Abruf aus. Fehlgeschlagene Läufe warten mindestens
  eine Stunde vor dem nächsten Versuch.
- Shelf-Pagination ist auf 100 Seiten begrenzt und wird während des Abrufs auf
  konstante Seitenzahl und Gesamtmenge geprüft. Die Parallelität startet niedrig
  und wird erst nach dem Pilot angepasst.
- Die Seitendaten müssen eine positive Seitenzahl, fortlaufende Seitennummern
  und genau die erwartete Seitenanzahl enthalten. Bild-URLs müssen HTTPS und
  auf den erlaubten Bonial-CDN-Hosts liegen. Der Runner lädt diese URLs nicht.
- Hotspot-Koordinaten müssen endlich, innerhalb der erwarteten Seitengrenzen
  und in der von der Viewer-Ansicht verwendeten Einheit sein. Preise werden nur
  aus erkannten EUR-Werten in Cent umgerechnet. Rabattlabels behalten ihre
  Quellbedeutung; Prozentwerte dürfen nicht als Euro formatiert werden.
- Dynamische Angebote ohne Prospektseiten werden übersprungen. Ein ZIP wird erst
  veröffentlicht, wenn die Shelf-Pagination vollständig war und alle erkannten
  Prospektseiten geprüft sind. Ein vollständig gelesener Katalog ohne echte
  Prospekte darf einen leeren PLZ-Scope veröffentlichen.

### Datenmodell und Sicherheit

- Neue Tabellen und Rechte werden in *supabase/schemas/*.sql* gepflegt.
  Das Modell ist die erste KaufDA-Release-Form und übernimmt keine
  Prospektdatensätze aus Bring. Die Scanwarteschlange bleibt für die App
  unsichtbar; ihre Funktionen erlauben nur das Anfragen und Abfragen des
  eigenen PLZ-Status. Der Runner erhält fällige PLZ und kann Scanfehler
  verzögert erneut versuchen.
- Authentifizierte Nutzer erhalten Leserechte. Schreibrechte bleiben beim
  Runner über die eng begrenzte Veröffentlichungsfunktion.
- Eine Verfügbarkeitszeile darf nur auf einen Prospekt desselben PLZ-Scope
  zeigen. Veröffentlichung validiert Inhalt, Seitenzahl, Händlerzuordnung,
  URL-Hosts und Scope, bevor sie bestehende Zeilen ersetzt.
- Bestehende Händlerfavoriten bleiben erhalten. Die Händler-/Publisherzeilen
  werden beim Publish anhand der KaufDA-Publisher-ID und des Namens dynamisch
  angelegt oder aktualisiert. Bring-spezifische Tabellen, Felder, URL-Prüfungen und Publisher
  werden aus dem Zielmodell entfernt. Da noch kein Live-System auf dieser
  Form beruht, gibt es weder Datenkonvertierung noch einen parallelen
  Übergangspfad. Bereits angewandte Migrationen und Git-Commits werden nicht
  zurückgesetzt oder verändert.

### GitHub Actions

- Workflow-Datei: *.github/workflows/scrape-brochures.yml*.
- Geplante Läufe prüfen alle 15 Minuten die kleine Scanwarteschlange. Bei leerer
  Warteschlange startet kein KaufDA-Scraper-Job. Manueller Start kann eine PLZ
  direkt testen oder die fällige Warteschlange verarbeiten.
- Bun wird auf die Version aus *package.json* gepinnt und über die vorhandene
  Repository-Action eingerichtet. Der Workflow erhält nur `contents: read`;
  Supabase-Secrets sind nur für Läufe auf `main` verfügbar.
- Ein gemeinsamer Concurrency-Scope verhindert gleichzeitige Veröffentlichungen
  desselben Datenbestands. Die Abfrage liefert höchstens 25 PLZ je Poll; jede
  Veröffentlichung betrifft genau eine PLZ und führt Prospekt-, Seiten-,
  Hotspot-, Fehler- und Laufzeitzahlen je PLZ auf.
- Kein Pull-Request-Lauf erhält Produktions-Secrets. Kein Bilddownload,
  R2-Upload, Chromium-Cache, vollständiger Bildartefakt oder unbeschränkter
  Gesamt-JSON-Upload.
- GitHub weist darauf hin, dass geplante Workflows verzögert starten oder bei
  sehr hoher Last ausfallen können. Der Betrieb darf deshalb nicht von einer
  exakten Startminute abhängen. [GitHub: schedule-Event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
  [Workflow-Rechte und Syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
  [Concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency)

## Geordnete Umsetzung

Die Aufgaben und Abhängigkeiten werden in Beads geführt. Dieser Abschnitt ist
der Index, keine zweite Aufgabenliste.

| Reihenfolge | Bead | Ergebnis | Status |
| --- | --- | --- | --- |
| 1 | fam-1c4i.1 | Direkter KaufDA-Abruf und geprüfte Normalisierung | Implementiert; 11 Scraper-Tests und Live-Dry-Run bestanden |
| 2 | fam-1c4i.2 | Regionales Supabase-Schema, sichere Rechte und atomarer Publisher | Implementiert; lokale Migration und 51 pgTAP-Prüfungen bestanden; Remote-Migration angewendet |
| 3 | fam-1c4i.3 | App-Sync und Offline-Metadaten ohne Beispiel-Fallback | Implementiert; 29 App-Tests und TypeScript-Prüfung bestanden |
| 4 | fam-1c4i.4 | Begrenzter, manueller und geplanter GitHub-Runner | Implementiert; YAML geprüft; Runner verarbeitet nur angefragte PLZ |
| 5 | fam-1c4i.5 | PLZ-Isolation und gemessener Live-Abruf | Lokale PLZ-Isolation und ein Live-Dry-Run bestanden |
| 6 | fam-1c4i.6 | Bring aus App und Runner entfernen, ohne Übergangspfad | Aus aktiver App, Workflow und deklarativem Schema entfernt |

### Lokale Freigabeprüfungen

- `bun run db:reset` wendet die vollständige deklarative Migration lokal an.
- `bun run db:types` generiert App-Typen aus dem lokalen Schema.
- Gezielte Scraper- und App-Tests, pgTAP, TypeScript und Biome bestehen.
- Der Live-Dry-Run prüft genau eine PLZ und schreibt nichts nach Supabase.
- Die pgTAP-Suite belegt, dass gleiche contentIds unter zwei PLZ getrennt
  gespeichert werden und dass ein frischer Katalog fünf Tage wiederverwendet wird.

## Messbare Freigabekriterien

- Der PLZ-Pilot liefert je Standort alle vollständigen Prospekte, die KaufDA
  über sämtliche Kategorien anbietet, mit geordneten Seiten und plausibel
  positionierten Hotspots; gespeicherte Gültigkeit passt zur KaufDA-Seite.
- Wiederholung desselben ZIP-Laufs erzeugt keine doppelten Datensätze.
- Unterschiedliche PLZ teilen keine Prospektkopie oder Verfügbarkeit; derselbe
  Publisher kann für beide PLZ angezeigt werden, seine Prospektseiten bleiben
  jedoch separat je PLZ gespeichert.
- Ein HTTP-, Parse-, Seitenzahl- oder Datenbankfehler hinterlässt den vorherigen
  guten Stand unverändert.
- Kein Bildinhalt wird durch Runner, Supabase oder R2 übertragen. Nur URLs und
  Angebotsmetadaten werden verarbeitet.
- Ein neuer oder mindestens fünf Tage alter App-PLZ-Status löst genau einen
  regionalen Abruf aus. Ein erneutes Öffnen innerhalb des Frischefensters
  erzeugt keinen zusätzlichen KaufDA-Traffic.
- Der Warteschlangen-Poll startet maximal 25 PLZ-Jobs, höchstens vier parallel.
  Nicht fällige PLZ und ungenutzte deutsche PLZ werden nicht abgefragt.

## Risiken und Gegenmaßnahmen

| Risiko | Folge | Gegenmaßnahme |
| --- | --- | --- |
| Undokumentierter KaufDA-Viewer-Endpunkt ändert sein Format | Prospekte fehlen oder werden falsch dargestellt | Strikte Schema-Prüfung, Fixtures, manueller Live-Pilot und sichtbarer Jobfehler |
| Inhalt unterscheidet sich nach PLZ oder Standort | falsche Angebote in einer anderen Region | ID und Abruf bleiben je PLZ getrennt; keine Kopie nur wegen gleicher contentId |
| App-Anfragen häufen sich schneller als der Runner sie abarbeiten kann | Verzögerte neue Prospekte | Maximal 25 PLZ pro Poll, maximal vier parallele Jobs und sichtbare Warteschlange |
| Anbieter blockiert oder drosselt Abrufe | unvollständige Veröffentlichung | Retry-After und begrenzte Wiederholung; betroffenen Scope nicht ersetzen |
| Dem App-Hook wird bei Fehlern ein Beispielprospekt untergeschoben | Nutzer sehen falsche Angebote | Beispielinhalt auf Test/Vorschau beschränken und letzten guten lokalen Stand erhalten |
| Vorherige Bring-Migrationen stehen in der Historie | Ein frischer Reset spielt auch deren alten Zwischenstand ein | Die neue vorwärts laufende Migration entfernt den alten aktiven Katalog; Reset und pgTAP prüfen den Endzustand |

## Freigabegrenze

Die Umsetzung ändert die aktiven Scraper-, App-, Workflow- und Schema-Quellen.
Historische Migrationen bleiben unangetastet; eine neue vorwärts laufende
Migration entfernt den alten Bring-Katalog aus dem resultierenden Schema. Der
lokale Reset, alle gezielten Prüfungen und die Rechteprüfung gegen das
verknüpfte Supabase-Projekt sind bestanden. Die Remote-Queue ist leer, der alte
Katalog ist entfernt und es gibt keine Prospektdaten. Es gibt keine
Datenübernahme und keinen Deutschlandlauf.
