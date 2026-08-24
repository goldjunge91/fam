# Chronologischer Gesprächsverlauf: Einkaufsbereiche und Category Lab

Status: Rekonstruiertes Arbeitsprotokoll  
Stand: 2026-08-24  
Hinweis: Dieses Dokument hält die fachlich relevanten Gesprächsinhalte in zeitlicher Reihenfolge fest. Geheimnisse, Schlüssel und Zugangsdaten sind absichtlich redigiert. Terminal- und Toolausgaben werden nur zusammengefasst, soweit sie für Entscheidungen oder Fehlerdiagnosen relevant waren.

## 1. Ausgangsstand: Issue #223 V2

**Nutzer:** Übermittelte eine strukturierte Zusammenfassung der bereits vollständig umgesetzten Arbeit zu `docs/issue#223_V2.md`.

Der gemeldete Stand umfasste:

- wissenschaftliche Fundierung und eine 21-Zonen-Matrix für Einkaufslisten
- Supabase- und lokale SQLite-Constraints
- Klassifikationsdomänen, Farben, Ränge, Lagerorte, Keywords und Legacy-Mapping
- Namens- und OFF-Tag-Regeln
- Unicode-Normalisierung
- Kalibrierung gegen 406.802 reale deutsche Open-Food-Facts-Produkte
- automatisierte Zuordnung von mehr als 55 Prozent der Produkte
- HTML-Kalibrierungsreport
- Category Debugger mit vollständigem Dump-Browser und Trace
- Golden-Korpus für konkrete Praxisfehler
- bestandene Golden-, Unit-, TypeScript- und Build-Prüfungen

## 2. Kritik an der globalen Laufstrecke

**Nutzer:** Merkte an, dass die Übernahme einer festen Laufstrecke und Sortierung keinen Sinn ergibt, weil Märkte wegen ihrer Gegebenheiten und Nutzerpräferenzen unterschiedlich aufgebaut sind.

**Gemeinsame Entscheidung:** Keine universelle Markt-Laufstrecke. Die App soll später Korrekturen erfassen, wenn Nutzende einen Bereich ändern. Diese Daten dürfen erst gespeichert und später kontrolliert ausgewertet werden.

**Nutzer:** Wollte zunächst ein lokales Evaluierungstool, bevor weiter am App-Code gearbeitet wird.

## 3. Lokales Evaluationstool und separates Backend

**Nutzer:** Beauftragte die Umsetzung eines vollständigen Vorschlags für das Evaluierungstool und stellte eine weitere Supabase-Instanz bereit. Zugangsdaten wurden im Gespräch genannt, werden hier aber nicht gespeichert.

**Nutzer:** Stellte klar, dass Expo für das lokale Evaluierungswerkzeug unnötig ist.

**Entscheidung:** Das Category Lab beziehungsweise der Category Debugger bleibt ein separates lokales Web-/Vite-Werkzeug. Die mobile Expo-App und das Evaluationstool bleiben getrennt.

**Nutzer:** Wählte eine Kombination der zuvor diskutierten Varianten A und B für das Tool.

## 4. Blindes Labeling und Trace-Reihenfolge

**Nutzer:** Testete das Tool. Nach der Auswahl einer Kategorie erschien direkt das nächste Produkt. Die angekündigte Vorhersage und der Trace waren dadurch nicht sichtbar.

**Klärung:** Der gewünschte Ablauf lautet:

```text
Produkt zeigen
  -> menschlichen Bereich blind auswählen
  -> menschliches Label speichern
  -> Vorhersage und vollständigen Trace zeigen
  -> erst danach nächstes Produkt
```

Der Trace muss erst nach dem menschlichen Urteil sichtbar werden, damit dieses Urteil nicht von Regeln oder Vorhersage beeinflusst wird.

## 5. Crowd Learning und JWT-Fehler

**Nutzer:** Fragte nach der Bedeutung von „Crowd Learning“ und meldete gleichzeitig den Fehler `JWT issued at future` aus dem lokalen Entwicklungsbetrieb.

**Klärung zu Crowd Learning:** Nutzerkorrekturen wären zunächst lediglich Rohsignale. Sie dürften nicht automatisch globale Regeln, Goldlabels oder ML-Modelle verändern.

**Klärung zum JWT-Fehler:** Die Meldung deutet auf eine Zeitabweichung zwischen Gerät und Auth-System hin. Relevante Prüfungen sind Systemzeit, Zeitzone und eine erneuerte Auth-Session. Der Fehler ist nicht fachlich mit der Produktklassifikation verbunden.

## 6. Produktbilder im Evaluierungstool

**Nutzer:** Fragte, ob Produktbilder angezeigt werden können.

**Gemeinsame Richtung:** Bilder sollen im lokalen Debugger als Hilfsmittel für menschliche Bewertungen dienen. Sie sind insbesondere bei mehrdeutigen Namen, Verkaufsformen und schlecht gepflegten OFF-Tags nützlich.

## 7. Lokaler Produkt- und Bilddump

**Nutzer:** Wollte einen lokalen Dump mit Bildern oder vollständigen Produktdatensätzen auf der externen Festplatte erstellen.

**Nutzer:** Wünschte ausdrücklich, dass keine aufwendigen Befehle, Downloads oder Hintergrundprozesse ohne vorherige Ankündigung ausgeführt werden.

**Arbeitsregel:** Vor jedem ressourcenintensiven, externen oder länger laufenden Schritt wird angekündigt:

- welcher Schritt ausgeführt wird
- wozu er dient
- ob er Daten lädt, viel Speicher verwendet oder laufende Dienste berührt

**Nutzer:** Fragte anschließend nach dem Vorgehen zum Erstellen des Produktdumps.

## 8. Interne Erweiterungen: Crowd Learning, Regeltraining, ML

**Nutzer:** Listete als gewünschte nächste Entwicklungsschritte auf:

1. Crowd Learning
2. automatisches Regeltraining
3. ML-Modell

**Nutzer:** Korrigierte dies später: Crowd Learning soll vorerst nicht umgesetzt werden, weil noch keine echten Nutzenden vorhanden sind.

**Nutzer:** Bat darum, online nach vorhandenen Baseline-Modellen und passenden Datensätzen zu suchen. Zusätzlich wurde LLM-gestütztes Labeling als mögliche Hilfe diskutiert.

## 9. Klarstellung: nur interner Trainings- und Prüfpfad

**Nutzer:** Stellte ausdrücklich klar:

> „deine entwicklungschritte sind aktuell nur für unser eigenes trainings / prüf ansatz. daher setze sie um“

**Verbindliche Grenze:** Die folgenden Schritte betreffen ausschließlich das interne Category Lab, nicht die Produktiv-App und nicht globale Nutzerregeln.

Der interne Ansatz umfasst:

- blindes menschliches Labeling
- Konflikt-, Sonstiges- und stratifizierte Zufallsqueues
- lokale Speicherung sowie JSON-Import/-Export
- deterministischen Calibration-/Holdout-Split
- Confusion Matrix und Versionsvergleich
- Golden-Korpus und Regressionstests
- Regelkandidaten aus wiederkehrenden Fehlmustern
- Vergleich einer transparenten ML-Baseline gegen die Regelbasis
- LLM-Vorschläge nur als Review-Hilfe

Der verbindliche Veröffentlichungsablauf lautet:

```text
Rohdaten
  -> menschliche Labels
  -> Review
  -> explizite Trainingsfreigabe
  -> versionierter Dataset-Snapshot
  -> Calibration
  -> Holdout
  -> Vergleich mit aktueller Version
  -> manuelle Veröffentlichung
```

Es gibt keine automatische Regelübernahme, keine automatische Trainingsfreigabe und keine automatische Klassifikatorveröffentlichung.

## 10. Vollständiger OFF-Dump und Bildmanifest

**Nutzer:** Meldete den vollständigen Produktdump:

```text
/Volumes/Programme/off-dump-data/off_dump.jsonl.gz
```

**Nutzer:** Korrigierte selbst einen Fehler in `prepare-image-dump.ts`. Das Bildmanifest hatte anfangs keine Bildzuordnungen gemeldet. Anschließend startete ein Bilddownload mit lokaler Datenablage auf der externen Festplatte.

**Bedeutung:** Der Dump und die Bilder dienen dem lokalen Category Lab, dem Dump-Browser, dem Labeling und der Qualitätsprüfung. Sie sind nicht automatisch ein vollständiger mobiler App-Katalog.

## 11. Code-Review des Bilddump-Umbaus

**Nutzer:** Bat um einen Review der Änderung und darum, Fehler zu beheben, wenn sie andere Bereiche beeinträchtigen.

**Arbeitsprinzip:** Änderungen am Bildmanifest und Bilddownload müssen mit dem Dump-Browser, der Produktdatenbank und dem Evaluationstool kompatibel bleiben. Bestehende laufende Prozesse dürfen nicht ohne ausdrückliche Zustimmung beendet werden.

## 12. Zweifel an der bisherigen Kategorienlogik

**Nutzer:** Äußerte, dass die Kategorien möglicherweise nicht clever genug seien.

Als konkretes Beispiel nannte der Nutzer Milch und Hafermilch zusammen mit haltbarer Kochsahne in einem eigenen Gang.

**Fachliche Entscheidung:** Produktfamilie, Verkaufsform und Einkaufsort müssen getrennt sein:

```text
ProductFamily  Was ist das Produkt?
ProductForm    In welcher Verkaufsform liegt es vor?
PlacementZone  Wo wird es in diesem Markt gesucht?
```

Beispiele:

- H-Milch, ungekühlter Haferdrink und haltbare Kochsahne: `ambient_milk_drinks`
- gekühlter Haferdrink: `chilled_plant_based`
- Passierte Tomaten und Nudeln: `pasta_tomato`
- Ketchup, Senf und Würzsaucen: `condiments`

## 13. Simulation realistischer Einkäufe

**Nutzer:** Bat darum, drei Einkäufe mit jeweils etwa 25 bis 50 Produkten für einen Drei-Personen-Haushalt durchzuspielen.

**Zweck:** Solche Mischlisten dienen dazu, Bereichsgrenzen und die sichtbare Gruppierung unter realistischen Bedingungen zu prüfen. Sie sind kein Trainingsdatensatz und keine globale Marktannahme.

## 14. Konkrete Korrekturen aus Nutzerfeedback

**Nutzer:** Korrigierte frühere Annahmen zu Warengruppen:

- Cornflakes stehen meistens nicht bei Nudeln und Reis.
- Nudeln liegen häufig bei passierten Tomaten und Tomatenmark.
- Reis kann in einem anderen Gang liegen.
- Nudeln sollen von Reis und Hülsenfrüchten getrennt werden.
- Ketchup liegt oft an anderer Stelle als Nudeln und Tomatenprodukte.

**Folge:** Die Zieltaxonomie unterscheidet unter anderem:

```text
pasta_tomato
rice_world_foods
breakfast
condiments
```

Die globale Taxonomie ist nur Fallback. Ein Markt kann seine sichtbare Reihenfolge später über `stores.category_order` definieren.

## 15. Alpha: reale Korrekturen sammeln

**Nutzer:** Schlug vor, in der Alpha viele Daten zu sammeln und Nutzende Produkte verschieben zu lassen.

**Nutzer:** Legte die oberste Regel fest:

> Crowd-Signale niemals ungeprüft übernehmen. Sie werden zunächst ungefiltert gespeichert und später verarbeitet. Wichtig ist sauberes Tracking.

**Entscheidung:** App-Korrekturen sind append-only Rohsignale. Sie werden nicht automatisch zu Regeln, Goldlabels oder Trainingsdaten.

## 16. Interne Tool-Überarbeitung und spätere App-Planung

**Nutzer:** Wollte zunächst das interne Tool überarbeiten und die App-Bearbeitung danach planen.

**Nutzer:** Wählte Variante A aus einer vorigen Auswahl.

Die daraus abgeleitete Zielrichtung war:

- internes Tool und Evaluation zuerst belastbar machen
- Alpha-Signale sauber strukturiert erfassen
- App-UX später minimal halten
- kein automatisches Lernen aus Nutzerdaten

## 17. Lokales Docker und Remote-Supabase

**Nutzer:** Meldete zunächst, dass Docker läuft.

**Nutzer:** Widersprach anschließend der Nutzung eines lokalen Supabase-Docker-Containers, weil der Rechner nicht genügend Ressourcen hat.

**Nutzer:** Startete eine Datenbankinstanz und meldete deren Bereitschaft.

**Nutzer:** Bat darum, den Supabase-MCP zu verwenden.

**Arbeitsentscheidung:** Lokales Supabase-Docker wird nicht als regulärer Arbeitsweg verwendet. Datenbankänderungen bleiben deklarativ, werden aber in einer ressourcenfähigen Umgebung vorbereitet und anschließend auf der Remote-Instanz geprüft.

## 18. UX-Plan für die Alpha

**Nutzer:** Stellte einen UX-Plan bereit und fragte, ob etwas fehlt.

**Nutzer:** Merkte an, dass für die App-Supabase eine separate Tabelle benötigt wird, um Signale zu sammeln und später zu extrahieren.

**Nutzer:** Fragte außerdem, ob die Kategorien bei der UX-Arbeit erneut angepasst werden sollten.

**Entscheidung:** Die Alpha darf nicht mit sichtbaren Lernmechanismen überladen werden. Die Datensammlung bleibt im Hintergrund.

Der beschlossene Ablauf:

```text
Artikel antippen
  -> bestehendes Bearbeiten-Formular
  -> „Einkaufsbereich“ bei Bedarf ändern
  -> Speichern
  -> Liste gruppiert Artikel neu
```

Bewusst ausgeschlossen:

- Schnell-Picker in der Liste
- geänderte Long-Press-Geste
- Bedienhinweis
- Drag-and-drop
- Undo
- Crowd-/Lernstatus
- Sync-Meldungen
- Datenschutzdialog während des Einkaufens

Long Press bleibt für die bestehende Löschfunktion. Der Einkaufsmodus bleibt unverändert.

## 19. Store- und Haushaltspräferenzen

**Entscheidung:** Eine manuelle Bereichsauswahl wird nach Scope gespeichert:

- mit Markt als Store-Präferenz
- ohne Markt als Haushaltspräferenz

Die Auflösung folgt:

```text
globale Klassifikation
  -> Haushaltspräferenz
  -> Store-Präferenz
  -> Item-Snapshot
```

„Automatisch“ entfernt nur die Präferenz im aktuellen Scope. Das Entfernen einer Store-Präferenz darf auf eine Haushaltspräferenz zurückfallen.

## 20. Feedback-Events und Offline-Verhalten

**Entscheidung:** Eine bewusste Korrektur erzeugt lokal atomar:

1. Aktualisierung des Einkaufslistenelements
2. Aktualisierung der passenden Präferenz
3. optionales Feedback-Event für aktive Alpha-Teilnehmer
4. passende Outbox-Einträge

Die Feedback-Events sind append-only und idempotent. Die mobile App kann eine wiederholte Event-ID nach Netzfehler sicher erneut senden. Ein Netzwerkfehler blockiert die lokale Einkaufslistenänderung nicht.

Um normale Speichervorgänge nicht fälschlich als Nutzerfeedback zu zählen, wird ein Formularzustand mit `placementSelectionTouched` benötigt.

## 21. Zwei Supabase-Instanzen

**Entscheidung:** Es gibt zwei getrennte Datenräume:

| Instanz | Zweck |
| --- | --- |
| App-Supabase | produktive App-Daten, Präferenzen und rohe Alpha-Events |
| Evaluation-Supabase | pseudonymisierte interne Auswertung, Review und Dataset-Snapshots |

Die App verbindet sich nie direkt mit der Evaluation-Supabase.

Für die App-Supabase gelten:

- Feedback-Events sind für App-Nutzende insert-only.
- App-Nutzende können Events nicht lesen, ändern oder löschen.
- `anon` besitzt keine Rechte.
- der eingeloggte Nutzer muss Haushaltsmitglied sein.
- ein gesetzter Store muss zum Haushalt gehören.
- Feedback wird nicht per Realtime gezogen.

Für die Evaluation-Supabase gelten:

- manueller Import statt direkter App-Verbindung
- stabile Pseudonymisierung per HMAC
- keine direkten Nutzer-, Haushalts- oder Store-IDs im Zielsystem
- getrennte Tabellen für Rohsignal, Review und Trainingsfreigabe

## 22. Taxonomiedatei als gemeinsamer TypeScript-Vertrag

**Nutzer:** Fragte, ob laut Dokument eine Taxonomiedatei erstellt werden muss.

**Antwort und Entscheidung:** Ja. Vorgesehen ist:

```text
src/features/shopping-list/classification/placement-taxonomy.ts
```

Die Datei enthält:

- die 27 stabilen IDs
- `PlacementZoneId`
- Taxonomieversion
- Labels, Farben, Standardränge und Lagerorte
- Standardreihenfolge
- Legacy-Mapping
- Normalisierung und Type Guard

Sie enthält keine Präferenzen, Feedback-Events, Lernlogik oder Regeln. App, Klassifikator und Category Lab importieren diese gemeinsame Definition.

## 23. Sicherheitsentscheidung

**Nutzer:** Hatte zuvor einen Supabase Secret Key im Gespräch bereitgestellt.

**Festgehalten:** Secret Keys gehören nicht in die App und müssen vor produktiver Nutzung rotiert werden, wenn sie in einem Chat offengelegt wurden. Die App nutzt ausschließlich Publishable Key und URL. Secrets bleiben im internen Import- beziehungsweise Evaluationstool.

## 24. Dokumentation der Unterhaltung

**Nutzer:** Wollte zunächst eine vollständige Zusammenfassung der Unterhaltung und anschließend eine Datei mit detaillierten Abschnitten zum Category Debugger sowie zum internen Trainings- und Prüfpfad.

**Ergebnis:** Die fachliche Zusammenfassung wurde als eigene Projektdokumentation erstellt und anschließend auf die fachlich-technische Entwicklung vor der Spezifikationsarbeit fokussiert.

**Nutzer:** Wollte danach zusätzlich dieses chronologische Gesprächsprotokoll von der ersten bis zur letzten Nachricht.

Dieses Dokument ist das Ergebnis dieser letzten Anforderung.
