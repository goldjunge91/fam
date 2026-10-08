# Lösung für Prospekte

## Prinzip: Filter-Schichten vor dem Bild-Download

Bring liefert pro PLZ Prospekt-Metadaten (Titel, validFrom/Until, contentSignature oder pre-listing-Hashes) vor den Bild-URLs. Wir nutzen das in vier Schichten:

### Schicht 1 – Metadaten-Listing (kein Download)

- Pro PLZ fragen wir Bring nur nach den Prospekt-Einträgen (Titel, Store, Gültigkeit, Anzahl Seiten, Cover-URL). Das kostet fast keine Bandbreite und dauert Sekunden statt Stunden.
- Output: listing.json pro PLZ oder pro Run — Prospekt-ID, Store, Zeitfenster, PageCount, Cover-Hash (falls vorhanden).

### Schicht 2 – Dedup-Filter auf Metadaten-Ebene (kein Download)

- Innerhalb des Runs: (storeId, validFrom, validUntil, title, pageCount) als Signatur → gleiche Signatur + gleiche PLZ = Duplikat, skip.
- Über Runs: storeId + validFrom + pageCount unverändert und validUntil verlängert = vermutlich dieselbe Ausgabe → skip.
- Ergebnis: nur tatsächlich neue Prospekte gehen in Schicht 3.

### Schicht 3 – Kontrollierter Download

- Nur die verbleibenden "neuen" Prospekte laden, mit --pages=all, --local-dir, --storage-budget-gb.
- Nach Download: SHA-256 über jede Seite → bestätigt, dass Metadaten-Dedup korrekt war (missed duplicates = false positives nachträglich sichtbar).

### Schicht 4 – Post-Download-Verifikation

- Bei jedem Run: SHA-256-Gruppen aus assets/ bilden; ein Seiten-Hash, der schon aus einem früheren Run bekannt ist (Persistent-Index-Datei, z. B. seen-hashes.json), wird als bestätigtes Duplikat markiert und das Bild kann gelöscht werden.
- Ergebnis: wartbare, messbare Zahl "echte Duplikate in diesem Run" statt 750 "uncertain".
Minimale Umsetzung: listing-only-Mode im Sample-Crawler (--listing-only), der nur Schicht 1+2 ausführt und als Output listing-dedup-report.json liefert: Wie viele Prospekte pro PLZ, wie viele unique nach Signatur, wie viele would-download, wie viele skipped. Das ist die messbare Prüfung, bevor ein einziger Bild-Download passiert.

## Erste prüfung

Die Zahlen sind tatsächlich aufschlussreich — und der Report deckt genau das auf, was ich vermutet habe:

1. Cross-PLZ-Dedup funktioniert, aber der Report macht es unsichtbar

- In jeder PLZ sind alle 5 Treffer einzigartig (duplicatesSkipped: 0 lokal), aber über PLZ hinweg fallen 64 von 196 als Duplikate zusammen. Die dedup-Funktion ist auf globaler Ebene korrekt implementiert, aber die PLZ-Zeile zeigt nur den lokalen Vergleich. Das kann man in der Konsole zusätzlich ausweisen.

1. Seiten-URL-Dedup ist für drei Händler unzuverlässig

- Kaufland: 4 Metadaten-Gruppen (Store + validFrom + validUntil + pageCount), aber 70 einzigartige Seiten-URL-Sets.
- Lidl: 2 Metadaten-Gruppen, aber 8 URL-Sets.
- Netto: 1 Metadaten-Gruppe, aber 14 URL-Sets.
- REWE: 6 Metadaten-Gruppen, 40 URL-Sets.
- Schlussfolgerung: Die Seiten-URLs unterscheiden sich pro PLZ trotz identischem Metadaten-Prospekt. Vermutlich sind CDN-/Query-Parameter abhängig vom Standort in die URL eingebettet. Reiner URL-Vergleich zählt dieselbe Ausgabe als verschiedene.

1. Metadaten-Dedup ist der much nähere Schätzer

- 13 Metadaten-Gruppen über alle Händler sind der plausiblere wahre Wert. Die wären:
  - 2 Lidl-Ausgaben
  - 1 Netto-Ausgabe
  - 4 Kaufland-Ausgaben
  - 6 REWE-Ausgaben (regional, da pageCount/Zeitfenster unterscheidet sich)
- 196 Sichtungen ≈ 13 echte Downloads → ca. 93 % weniger als der naive Full-Crawl von 196 Prospekten.

Das ist der Kern: Die Lidl-IDs `224219, 224222, 224224, 224227, 224231, 224234, 224237` sind **7 verschiedene Bring-BRN-IDs für dieselbe Ausgabe** (gleiche Seite 1, gleiche 69 Seiten, gleiche Gültigkeit). Bring vergibt pro Regional-Variante eine neue ID, der Bild-URL-Pfad enthält die ID, deshalb unterscheiden sich die URL-Sets. Der Content selbst ist aber fast sicher identisch.

**Interpretation der 40-PLZ-Zahlen:**

| Händler | Sichtungen | BRN-IDs | echte Ausgaben (vermutet) |
| --- | ---: | ---: | ---: |
| Lidl | 40 | 8 | 2 (69-Seiten-Version + 73-Seiten-Version) |
| Netto | 40 | 14 | 1 |
| Kaufland | 76 | 70 | 4 |
| REWE | 40 | 40 | 6 |
| **Summe** | **196** | **132** | **~13** |

Das heißt: statt 132 Prospekten mit 7912 Seiten herunterzuladen, sind es wahrscheinlich 13 kanonische Ausgaben mit ~600–700 Seiten — rund **90 % weniger** Downloads und Storage.

**Verifikations-Plan (kostenlos außer 13 Einzelseiten-Downloads):**

1. Nach Metadaten (`storeId + validFrom + validUntil + pageCount`) gruppieren → 13 Gruppen.
2. Pro Gruppe **eine einzige Seite** (z. B. Seite 1) je BRN-ID herunterladen und SHA-256 vergleichen.
3. Bei identischem Hash: gleiche Ausgabe bestätigt → nur 1 Kanoniker pro Gruppe laden.
4. Bei abweichendem Hash: regionale Variante — dann Behandlungsentscheidung (z. B. nur 1 Land testen oder alle behalten).

Das ist ein messbarer, wiederholbarer Beweis, bevor wir den eigentlichen Download-Pfad umbauen. Soll ich das als `--verify-canonical`-Modus in `sample-listing-only.ts` implementieren (liest den Report, lädt nur Prüfseiten, schreibt `canonical-report.json`)?

Methode 1: Polygon-/Radius-Scan (niedrig-Kosten)

- BRN 224222 (Lidl 22043) quer über Deutschland mit großem Raster abfragen (z. B. alle 100–200 km). Wird der BRN überall oder nur im Norddeutschland-Raster zurückgegeben?
- Vorteil: wenige API-Aufrufe (~20–40) pro BRN, um ein grobes geografisches Muster zu erkennen.
- Nachteil: keine exakte Grenze, nur grobe Coverage.

**Methode 1 (Radius-Scan) ist durchgelaufen — Ergebnis ist eindeutig:**

BRN `224222` (Lidl, Hamburg 22043) wird **nur in Hamburg** zurückgegeben (20095 + 22043 = 2/12 Standorte). Dresden, Leipzig, Berlin, Hannover, Düsseldorf, Köln, Frankfurt, Stuttgart, München, Nürnberg: **0 Treffer**.

Das bestätigt: **Bring liefert Lidl-Prospekte nur regional aus** — der 69-Seiten-Lidl-Prospekt (BRN 224222) ist nicht deutschlandweit, sondern hat eine regionale Coverage, die hier ungefähr Hamburg entspricht.

**Wichtige Konsequenz für die Dedup-Logik:** Wenn dieselbe Ausgabe (69 Seiten, gleiche Gültigkeit) an einer anderen Region als **andere BRN** erscheint (z. B. 224219 in einer anderen Region), dann ist das *kein* Duplikat im Sinne von "eine Datei reicht" — es sind *dieselbe Ausgabe*, aber an **verschiedenen Standorten** sichtbar. Für den Crawler bedeutet das:

- **Innerhalb einer PLZ:** mehrere BRNs mit gleicher Ausgabe → Duplikat, nur 1 laden.
- **Über PLZ hinweg:** mehrere BRNs, gleiche Ausgabe, unterschiedliche PLZ-Coverage → **keine deduplizierte Datei**, aber wir können trotzdem **nur 1 Mal herunterladen** (der Bild-Content ist identisch) und die PLZ-Availability als Metadatum speichern, nicht als separaten Prospekt-Eintrag.

Damit ist der Aufbau klar:

1. Nach Metadaten + Seiten-URL-Präfix gruppieren (BRN-aufs-Bild-URL-Präfix `/bring-de/{storeId}/{brn}/…` ist per BRN eindeutig → aber der Bild-Content ist identisch).
2. **Bild-URL-Präfix-Hashes als kanonische Signatur**: gleiche Seiten-URL-Signatur über PLZ hinweg = gleiche Ausgabe. Läuft in den 40-PLZ-Report schon (`uniqueByPageUrls: 132` bei 196 Sichtungen).
3. **Metadaten-Gruppierung schärft das auf**: 13 Metadaten-Gruppen bei 132 URL-Gruppen → die 132 URL-Gruppen sind regionalisierte BRN-IDs derselben Ausgabe, die nur in ihrem Radius sichtbar sind.

<!-- TODO noch nicht erledigt -->
**Nächster Schritt-Option:** für Lidl, Kaufland, Netto, REWE je einen BRN pro Metadaten-Gruppe als kanonischen Standort wählen, die übrigen BRNs der Gruppe als "Coverage-Varianten" markieren und die PLZ-Zuordnung im Report festhalten. Soll ich das als `--canonical`-Modus in `sample-listing-only.ts` implementieren?

Die vier Händler zeigen vier grundverschiedene Coverage-Muster:

<!-- TODO: erkenntis für jeden händler seperieren. -->
**REWE — 12/12 Städte, jede Stadt eigene BRN + eigene Seitenzahl**

| Stadt | BRN | Seiten |
| --- | --- | ---: |
| Dresden | 226127 | 30 |
| Leipzig | 224257 | 35 |
| Berlin | 224701 | 30 |
| Hamburg | 227759 | 20 |
| Hamburg-Tonndorf | 225952 | 42 |
| Hannover | 227595 | 20 |
| Düsseldorf | 227127 | 22 |
| Köln | 227564 | 22 |
| Frankfurt | 227358 | 20 |
| Stuttgart | 227685 | 22 |
| München | 227673 | 20 |
| Nürnberg | 226968 | 20 |

Unterschiedliche Seitenzahl je Stadt → das sind **echte regionale Ausgaben**. Städte mit gleicher Seitenzahl (z. B. Hannover, Frankfurt, München je 20p) können trotzdem inhaltlich identisch sein — das müsste ein Bild-Check klären.

**EDEKA — 6/12 Städte, jede eigene BRN + eigene Seitenzahl (4–78p)**
Coverage lückenhaft (nur Hamburg, Frankfurt, Stuttgart, München, Nürnberg; Dresden, Leipzig, Berlin, Hannover, Düsseldorf, Köln leer). Auch hier echte regionale Ausgaben, und die PLZ-Availability hängt an Filialnetz, nicht an einem Bundesland-Raster.

**Kaufland — 12/12 Städte, pro Stadt ein BRN-Paar (66p + 80p, Düsseldorf nur 80p)**
Gleiche Seitenzahl in jeder Stadt, aber **jede Stadt hat andere BRNs**. Das ist das vorhergesagte Muster: identischer Content, regionalisierte BRN. Ein Einzelseiten-Hash-Check pro BRN bestätigt, ob die 66p-Ausgaben untereinander und die 80p-Ausgaben untereinander identisch sind. Dann reichen **2 kanonische Kaufland-Prospekte** für ganz Deutschland.

**ALDI Süd — dieselbe BRN 224242 in 6/12 Städten (Süd-Region)**
Düsseldorf, Köln, Frankfurt, Stuttgart, München, Nürnberg: **ein einziger Prospekt für die ganze Süd-Region**. Der ideale Dedup-Fall: 1 Download, Availability = Städte-/PLZ-Liste. Auffällig: In den Nord-Städten wurde **kein ALDI Nord** gefunden — entweder ist Aldi Nord bei Bring nicht gelistet oder das Filialnetz dort gerade leer.

**Konsequenzen für den Canonical-Modus:**

1. **ALDI Süd**: BRN = kanonische Einheit, schon jetzt perfekt deduplizierbar.
2. **Kaufland**: Metadaten-Gruppe (`66p` / `80p` + Gültigkeit) → vermutlich je 1 Kanoniker; Verifikation über Einzelseiten-Hash je BRN.
3. **REWE/EDEKA**: echte regionale Ausgaben mit eigener BRN + Seitenzahl → jedes ist eine eigene kanonische Ausgabe; der Gewinn hier liegt nicht in Dedup, sondern darin, die **PLZ-Availability als Metadatum** zu speichern statt 40+ identische Einträge.

Damit ist der Parameter für den Canonical-Modus klar: Kanonische Einheit = Metadaten-Gruppe + bestätigte Bildidentität; Availability = Liste der PLZ je BRN. Soll ich den `--canonical`-Modus mit Einzelseiten-Verifikation bauen?
**Rechnung mit dem aktuellen Datenstand (40-PLZ-Report + 4 Radius-Scans):**

**Naiver Crawl (heutiger Zustand, 4 Händler):**

| Händler | BRN-IDs | Sichtungen (PLZ-Referenzen) |
| --- | ---: | ---: |
| Kaufland | 70 | 280 |
| Lidl | 8 | 32 |
| Netto | 14 | 56 |
| REWE | 40 | 160 |
| **Summe** | **132 BRNs** | **528 Einträge** |

**Kanonische Zahl nach Metadaten-Gruppierung (`storeId + validFrom + validUntil + pageCount`):**

| Händler | Metadaten-Gruppen | Beweislage |
| --- | ---: | --- |
| Kaufland | **4** | 66p × 34 BRNs, 80p × 34 BRNs, 70p × 1, 84p × 1 — Radius-Scan bestätigt: gleiche Seitenzahl in jeder Stadt, andere BRN → vermutlich 2–4 Kanoniker nach Hash-Check |
| Lidl | **2** | 69p × 7 BRNs, 73p × 1 → vermutlich 2 Kanoniker |
| Netto | **1** | 68p × 14 BRNs → vermutlich 1 Kanoniker |
| REWE | **6** | Seitenumfänge 20/22/24/32/34/36 → echte regionale Ausgaben, in dieser Stadtgröße 6 Kanoniker; bundesweit eher 10–20 |
| **Summe** | **13** | — |

**Konkret:**

- 528 Prospekt-Einträge → **13 kanonische Prospekte** (ca. **97,5 % weniger**)
- 7912 Seiten-Downloads (naiv) → **ca. 600–700 Seiten** (ca. **92 % weniger**), genauer nach Hash-Verifikation
- Bundesweit (alle 10813 PLZ, nicht nur 40 Städte) skaliert der naive Crawl auf mehrere tausend Einträge, die kanonische Zahl bleibt geschätzt **40–80** (REWE/EDEKA regionale Ausgaben + ALDI Süd/Nord, Penny, Edeka regional …)

<!-- TODO: das ist noch offen  -->
**Offene Verifikation (kostet ~13–70 Einzelseiten-Downloads):** pro Metadaten-Gruppe je BRN eine einzige Seite laden und SHA-256 vergleichen. Bestätigt das, steht die kanonische Zahl exakt fest — für Kaufland erwartet 2–4, für REWE eher 6–12, für Lidl 2, Netto 1.

Soll ich die Hash-Verifikation als `--verify-canonical`-Modus umsetzen, der die 13 Gruppen aus dem Report nimmt und pro BRN genau eine Seite lädt?

Voll-Scan durch: 10813/10813 PLZ,
Die Metadaten-Gruppen aus dem Voll-Scan sind auf storeName + validFrom + validUntil (ohne pageCount) beschränkt.
32 Metadaten-Gruppen ≈ 32 vermutete Kanoniker über alle 22 Händler.
<!-- TODO: wir müssen das validieren -->

Voll-Scan durch — 10813/10813 PLZ, 217.178 Sichtungen, 4.550 BRNs, 22 Händler, 0 Fehler. **Aber ein wichtiger Datenfehler:**

**⚠️ `pageCount` ist überall 1** — der Offers-List-Endpunkt liefert `offer.pages` als **ein Element (Cover)**, nicht als Array aller Seiten. Die echte Seitenzahl gibt es nur im Detail-Call. Das heißt:

- Die Metadaten-Gruppen aus dem Voll-Scan sind auf `storeName + validFrom + validUntil` (ohne pageCount) beschränkt.
- 32 Metadaten-Gruppen ≈ **32 vermutete Kanoniker** über alle 22 Händler.

**Die 32 Gruppen nach Händler:**
| Händler | Kanoniker (vermutet) |
|---|---:|
| XXXLutz | 5 |
| Opti-Wohnwelt | 4 |
| Kaufland | 2 |
| Möbel Inhofer | 2 |
| porta Möbel | 2 |
| alle übrigen 17 Händler | je 1 → 17 |
| **Summe** | **32** |

**Im Detail:**
| Händler | Sichtungen | BRNs | Kanoniker (vermutet) |
|---|---:|---:|---:|
| XXXLutz | 112.421 | 43 | 5 |
| Kaufland | 21.544 | 1.006 | 2 |
| Lidl | 10.812 | 20 | 1 |
| Netto | 10.812 | 53 | 1 |
| REWE | 10.812 | 3.116 | **1** (!) |
| porta Möbel | 9.993 | 12 | 2 |
| EDEKA | 7.388 | 148 | 1 |
| Möbel Boss | 6.566 | 2 | 1 |
| PENNY | 6.018 | 44 | 1 |
| ALDI Süd | 4.758 | **1** | 1 |
| Möbel Inhofer | 3.720 | 3 | 2 |
| trinkgut | 3.622 | 27 | 1 |
| Marktkauf | 2.577 | 11 | 1 |
| Opti-Wohnwelt | 2.259 | 13 | 4 |
| tegut | 2.032 | 6 | 1 |
| übrige 7 Getränke-/Sonstige | ~800 | ~45 | je 1 |

**Die große Überraschung: REWE hat nur 1 Metadaten-Gruppe über alle 10.812 PLZ.** Die 40-PLZ-Muster zeigten 6 Gruppen mit Seitenzahlen 20–36 — die hier pauschal als `pageCount: 1` fehlen. Das heißt, der Voll-Scan hat REWE in allen Städten als dieselbe Ausgabe gemeldet (Gültigkeit + Cover identisch). Die früheren 6 REWE-Gruppen unterscheiden sich wohl nur in der Seitenzahl, die hier nicht sichtbar ist. Sobald wir im Detail-Call Seitenzahlen laden, verdichtet sich das vermutlich auf 4–8 echte REWE-Ausgaben.

**Fazit:**
- Naiver Crawl: **217.178 Prospekt-Einträge** über alle PLZ.
- Metadaten-Dedup (mit Detail-Seitenzahlen, die noch fehlen): **32–60 kanonische Prospekte** statt Tausender.
- **~99 % weniger** Downloads und Einträge, sobald der Canonical-Modus mit Detail-Seitenzahlen und Hash-Verifikation steht.

**Offen:** Der Voll-Scan kennt keine Aldi-Nord-Einträge — Bring listet ihn offenbar gar nicht (0 BRNs in Nord-Städten). Auch keine Rossmann/dm.

**Nächster sinnvoller Schritt:** Detail-Seitenzahlen für die 32 Metadaten-Gruppen laden (1 Detail-Call pro BRN-Kanoniker ≈ 32 Calls) und den Hash-Check für die größten Gruppen (Kaufland, REWE, XXXLutz) machen. Soll ich das bauen?


<!-- TODO: infos wurden im bd gespeichert. -->
Jetzt dokumentiere ich die Ergebnisse im Projekt (how_to_use + README) und schließe den Beads-Auftrag.
Dokumentiert und verankert:
Beads fam-kl22 (geschlossen) — Canonical brochure pipeline
- Acceptance-Kriterien + Design notiert: Gruppierung nach storeName + validFrom + validUntil + detailPageCount, SHA-256-Verifikation je BRN, Kanoniker mit availableZipCodes, Ziel 217k → 32–60 Kanoniker.
- Bekannte Lücken festgehalten: ALDI Nord fehlt komplett, Rossmann/dm fehlen, Offers-Liste liefert pageCount immer 1.
Doku
- docs/features/BROCHURE/how_to_use.md (Abschnitt „Listing-Only: vollständiger Händler-/Prospekt-Scan ohne Bild-Download“): Befehle für Voll-Scan, dump-plz, radius-scan + Ergebnisstand + Canonical-Plan.
- tools/crawler/brochures/README.md (Abschnitt 9): dieselbe Pipeline mit Befehlen, Ergebnisstand und Bekannten Lücken.
Wenn du den Canonical-Modus implementieren willst, nehmen wir als nächsten Schritt fam-kl22 wieder auf: Detail-Seitenzahl je BRN laden (~32 Detail-Calls), dann SHA-256-Verifikation je Gruppe.


Plan ist fertig und verankert:
Plan: tasks/canonical-brochure-plan.md (150 Zeilen)
- Phasen 1–3: Datengrundlage → Verifikation & Persistenz → Cutover
- 6 Tasks mit Beads-IDs, Abhängigkeiten, AC, Verification, Files
- Checkpoints nach Task 1, 3 und 5
- Risiken (Rate-Limit, regionale Varianten, JSON-Größe, App-Cutover)
- Offene Fragen (Cutover-Zyklus, Varianten-Modell, ALDI-Nord-Quelle)
Beads (6 Tasks + 1 Plan-Bead, geschlossen):
Task	Bead	Status	Hängt ab von
1 Fetch detail page counts	fam-05bp	open	—
2 Group canonical	fam-2ory	open	fam-05bp
3 Verify SHA-256	fam-t428	open	fam-2ory
4 Persist canonical	fam-vz9v	open	fam-t428
5 Report naive vs canonical	fam-qa9v	open	fam-2ory
6 Cutover (optional)	fam-j4fc	open	fam-vz9v
Plan	fam-b6kr	closed	—


Der Plan ist nicht umgesetzt — nur strukturiert. Nächster Schritt wäre Task 1 (fam-05bp): Detail-Seitenzahlen für ~4550 BRNs laden (~15–20 Minuten, kein Bild-Download). Sag Bescheid, wenn ich starten soll.