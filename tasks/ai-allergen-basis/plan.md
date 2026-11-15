# Implementierungsplan: Geprüfte Allergenbasis für Haushalts- und Importrezepte

Status: In Umsetzung. Der Nutzer hat mit der Implementierung begonnen; Fortschritt und offene Abhängigkeiten stehen in Beads.

Die Aufgaben werden in Beads geführt. `tasks/todo.md` wird nicht angelegt. Der vorhandene `tasks/plan.md`-Plan für den Offline-Dashboardstart bleibt unverändert.

## Ziel

Eine gemeinsame, nachvollziehbare Zutaten- und Allergenbasis soll gespeicherte Haushaltsrezepte und Rezeptimporte klassifizierbar machen. AI darf nur Rezepte vorschlagen, deren Zutaten gegen die anwendbaren gespeicherten Lebensmittelregeln geprüft werden konnten. Mehrdeutige, unbekannte oder ungeprüfte Daten bleiben `unknown` und dürfen nicht als allergenfrei behandelt werden.

Die EU-Taxonomie orientiert sich an den 14 Gruppen aus Anhang II der [Verordnung (EU) Nr. 1169/2011](https://eur-lex.europa.eu/eli/reg/2011/1169/oj/deu). Diese Liste beschreibt die Allergenklassen; sie liefert keine vollständige Klassifikation einzelner Markenprodukte, Verpackungshinweise oder Kreuzkontamination.

### Quellenstand für die erste kuratierte Basis

- Rechtliche Referenz ist die konsolidierte Fassung `02011R1169-20250401`; die letzte Änderung von Anhang II erfolgte durch die [Delegierte Verordnung (EU) 2024/2512](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX%3A32024R2512). Die 14 Gruppen bleiben bestehen. Punkt 10 enthält nun eine eng begrenzte Ausnahme für bestimmte Emulgatoren aus hochreiner, zweifach destillierter Behensäure aus Senfsamen. Diese Kennzeichnungsausnahme ist **kein** `not_detected`-Beleg für die persönliche Allergenprüfung.
- Jede aus Anhang II abgeleitete Faktenzeile führt den genauen Anhang-II-Punkt, die konsolidierte Fassung, die offizielle EUR-Lex-URL, den Prüfumfang und einen kleinen Textsnapshot. Die EUR-Lex-Wiederverwendungsregeln erlauben die Weiternutzung von Rechtsdokumenten grundsätzlich mit Quellenangabe; für konsolidierte Redaktionstexte gilt CC BY 4.0 ([EUR-Lex-Rechtshinweis](https://eur-lex.europa.eu/content/legal-notice/legal-notice.html?locale=de)).
- Eine Nahrungsmittel-Ontologie wie FoodOn kann später kanonische Namen und IDs beisteuern, ist aber kein Beleg für eine Allergenbeziehung. Solche Beziehungen werden separat anhand der Rechtsquelle kuratiert und geprüft.
- Die erste Datenlieferung bleibt eng: direkt benannte Grundzutaten und eindeutig belegte Derivate. Produktnamen, gemischte Zubereitungen, nicht belegte Abwesenheit und Kreuzkontamination bleiben `unknown`.

## Ausgangslage und bestehende Arbeit

- `profile_food_rules` enthält private, accountgebundene Angaben. Diese Daten werden nicht zu Haushaltsfeldern. Bei freigegebenem Assistant-Kontext können die Angaben des anfragenden Accounts als Kontext an den Anbieter gehen; sie werden als Daten und nicht als Modellanweisungen behandelt.
- Die Produktstammdaten enthalten keine maßgeblichen Allergenfakten. Open Food Facts ist in den Projektverträgen eine Quelle, aber nicht automatisch die Wahrheit.
- Rezeptimportentwürfe speichern zurzeit den extrahierten Zutatentext und dessen Extraktionsvertrauen. Ein hohes KI-Vertrauen ist kein bestätigter Zutaten- oder Allergenbeleg.
- Der aktuelle Assistant gleicht Zutatenbezeichnungen mit gespeicherten Regeln ab. Die Haushaltsrezepte sind noch nicht über eine geprüfte kanonische Allergenprojektion angebunden.
- Bead `fam-y918.6` enthält bereits die Schema- und Projektionsarbeit im separaten AI-Cooking-Port. Der offene Bead `fam-y918.7` pflegt dort die lizenzierte Quelle und die Katalogzuordnungen. Diese Grundlage wird als Voraussetzung wiederverwendet, nicht dupliziert.
- Der Importpfad wird in `fam-d5rn.1` umgesetzt. Die Allergen-Zuordnung für Importe hängt von diesem Entwurfs- und Speicherpfad ab.

## Architekturentscheidungen

1. **Kanonische Identität statt unscharfer Modellklassifikation.** Eine Rezeptposition wird auf eine oder mehrere kanonische Zutaten abgebildet. Für ein positives Review muss die Zuordnung vollständig und eindeutig sein. Das Modell darf weder die Identität noch den Allergenstatus verbindlich festlegen.
2. **Mapping-Review und Allergenfakten sind getrennt.** Haushaltsmitglieder und Importnutzer können die Zutatenidentität und Vollständigkeit der Liste prüfen. Sie können keine globalen Allergenfakten und keine Allergenfreiheit bestätigen; diese stammen ausschließlich aus kuratierten, quellenbelegten Datensätzen.
3. **Provenienz gilt auch für klare Ergebnisse.** Kuratierte Fakten und Reviews ohne Treffer führen Quelle, Quellenkennung, URL, Version, Prüfumfang und Review-Zeitpunkt; kuratierte externe Quellen führen zusätzlich ihre Lizenz. Ein leeres Faktenresultat ist nur für den belegten Quellenumfang klar. Haushalts-/Importbelege für Zutatenlisten speichern stattdessen den exakten Snapshot oder stabilen Quellenbezug samt Produktidentität und Version. Quellen- oder Produktänderungen machen abhängige Reviews ungültig.
4. **`unknown` unterscheidet sich von einem geprüften Ergebnis ohne Regelkonflikt.** Ein geprüfter Datensatz ohne passende Allergenfakten ist ein explizites Review-Ergebnis. Eine fehlende oder unvollständige Mapping-Zeile ist niemals ein Freispruch.
5. **Ein gemeinsamer Projektor für beide Rezeptwege.** Haushaltsrezepte und importierte Zutaten benutzen dieselben kanonischen Zutaten, Fakten und Konfliktregeln. Produkt-, Unterkomponenten- und Freitextpositionen müssen den vollständigen Rezeptbaum abdecken.
6. **Alle persönlichen Regeltypen brauchen einen Abdeckungsstatus.** Der Resolver behandelt `allergy_codes`, `custom_allergies`, `intolerance_codes`, `custom_intolerances` und `disliked_foods`. Allergie, Unverträglichkeit und Abneigung bleiben getrennte Regeln; Milchallergie ist nicht Laktoseintoleranz. Regeln ohne belegbare Abbildung, etwa quantitative Unverträglichkeiten ohne Mengenfakten oder nicht auflösbare freie Labels, sind `unsupported`/`unknown` und sperren personalisierte Rezeptvorschläge mit erklärendem Grund. Sie werden nie als konfliktfrei behandelt.
7. **Regelzugriff folgt dem Assistant-Produktziel.** Bei freigegebenem Haushaltskontext liest der Assistant nur die eigenen Regeln des anfragenden Accounts über dessen RLS-Berechtigung. Regeln anderer Accounts und Kinderprofile werden für diesen Assistant nicht gelesen. Die freigegebenen eigenen Regeln dürfen nur im Umfang der erteilten Einwilligung an den Anbieter gehen; die serverseitige Projektions- und Toolvalidierung bleibt maßgeblich. Die Haushaltsaggregation aus der separaten Food-Waste-Spezifikation wird nicht stillschweigend auf den Assistant übertragen.
8. **Importvertrauen ist kein Sicherheitsstatus.** Importierte Rohzutaten bleiben Entwürfe, bis sie eindeutig zugeordnet sind. Unaufgelöste Rezepte dürfen gespeichert und bearbeitet werden, werden bei einschlägigen Regeln aber nicht als sichere AI-Kandidaten verwendet.
9. **Begrenzte Aussage der Oberfläche.** Die UI darf den Abgleich der vollständigen, belegten Zutatenliste mit den eigenen Regeln der anfragenden Person anzeigen. Sie darf keine Prüfung weiterer Verpackungsangaben oder Kreuzkontamination behaupten.

## Abhängigkeitsgraph

```text
fam-d5rn.2 ──────────────┐
                          ├→ fam-d5rn.9 → fam-d5rn.6
fam-y918.7 ──────────────┘                  ├→ fam-d5rn.3 → fam-d5rn.11 → fam-d5rn.10 ──┐
                                             └→ fam-d5rn.3 + .4 + .6 + .1 → fam-d5rn.8 ──┤
                 fam-d5rn.9 → fam-d5rn.12 ───────────────────────────────────────────────┤
                                                                                          ▼
                                                        fam-d5rn.5 → fam-d5rn.7
```

Das deklarative Basisschema `.2` ist quellenneutral und kann unabhängig entstehen. Die kuratierte Quelle `.9` benötigt sowohl `.2` als auch `fam-y918.7`. `.12` hängt von `.9` ab. `.11` hängt von `.3` und `.6` ab; `.10` hängt von `.11` und damit transitiv von `.9` ab. `.8` hängt von `.3`, `.4`, `.6` und `.1` ab. `.5` hängt von `.10`, `.8` und `.12` ab. Die Beads-Abhängigkeiten sind maßgeblich; diese Skizze dient der Übersicht.

## Aufgabenindex

| Reihenfolge | Bead | Aufgabe | Abhängigkeit |
| --- | --- | --- | --- |
| 1 | `fam-y918.7` | Kuratierte Fakten für den gemeinsamen Katalogbestand abschließen | Bereits offen im AI-Cooking-Port |
| 2 | `fam-d5rn.2` | Allergenbasis-Schema, Constraints und Les-/Schreibrechte integrieren | keine; Schema ist quellenneutral |
| 3 | `fam-d5rn.9` | Kuratierte Fakten und deterministischen fail-closed Projektor integrieren | `fam-d5rn.2`, `fam-y918.7` |
| 4 | `fam-d5rn.6` | Checkpoint: Taxonomie, kuratierte Quelle, Provenienz und Projektion prüfen | `fam-d5rn.2`, `fam-d5rn.9` |
| 5a | `fam-d5rn.3` | Haushaltsrezeptpositionen mit kanonischen Zutaten verknüpfen | `fam-d5rn.6` |
| 5b | `fam-d5rn.4` | Geprüften Mappingstatus im lokalen Importentwurf speichern | `fam-d5rn.6`, `fam-d5rn.1` |
| 5c | `fam-d5rn.11` | Zutatenidentität und Vollständigkeit im Haushalts-Rezepteditor prüfen | `fam-d5rn.3`, `fam-d5rn.6` |
| 5d | `fam-d5rn.10` | Haushaltslesepfad an vollständige Allergenprojektion anbinden | `fam-d5rn.11` (transitiv `.6`, `.9`) |
| 5e | `fam-d5rn.8` | Zuordnungsprüfung im Importeditor und belegte Mapping-Übernahme ins Haushaltsrezept umsetzen | `fam-d5rn.3`, `.4`, `.6`, `.1` |
| 5f | `fam-d5rn.12` | Coverage-Resolver für alle persönlichen Lebensmittelregeln festlegen | `fam-d5rn.9` |
| 6 | `fam-d5rn.5` | Assistant-Regelcoverage, Rezeptprüfung und atomaren Apply absichern | `fam-d5rn.10`, `.8`, `.12` |
| 7 | `fam-d5rn.7` | End-to-End-Checkpoint für Haushalt, Import und Assistant | `fam-d5rn.5` |

Jeder Bead enthält Beschreibung, Abnahmekriterien, Verifikation, Abhängigkeiten und einen begrenzten Dateisatz. Die ausführlichen Aufgaben stehen ausschließlich in Beads; diese Datei dupliziert sie nicht.

## Prüfpunkte

### Checkpoint `fam-d5rn.6`: gemeinsame Wissensbasis

- Quellen- und Lizenzentscheidung ist nachvollziehbar.
- Geprüfte Allergenfakten, ein vollständig geprüfter Zutaten-Mappingstatus ohne Regelkonflikt und `unknown` sind getrennte Zustände.
- Ein Ergebnis ohne Treffer hat einen versionierten Quellenbeleg samt Prüfumfang; ein bekannter Konflikt wird blockiert und ein klares Ergebnis gilt nur innerhalb der belegten Datenabdeckung.
- 1:n-Zuordnungen werden vollständig verarbeitet; ungeprüfte Einzelfakten, fehlende Belege und unbekannte Daten blockieren.
- Schema-, Rechte- und Projektionsprüfungen bestehen lokal.
- Die Freigabe durch Haushaltsmitglieder oder Importnutzer ändert keine kuratierten Allergenfakten.

### Checkpoint `fam-d5rn.7`: vollständiger Rezeptfluss

- Gespeicherte Haushaltsrezepte und importierte Rezepte verwenden dieselbe Projektion.
- Jeder aktive Typ persönlicher Regeln ist ausgewertet oder führt zu `unsupported` und sperrt personalisierte Vorschläge.
- Konflikt, `unknown` oder `unsupported` erzeugt weder Rezeptvorschlag noch Planvorschlag noch Zutatenwechsel.
- Geprüfte Importzuordnungen und ihre Belege bleiben beim Speichern, Offline-Sync und erneutem Laden erhalten.
- Regel-, Rezept-, Zutatenlisten-, Mapping- und Faktenänderungen werden vor dem Übernehmen erneut geprüft; der ganze Vorschlag wird vor der ersten Mutation validiert und ohne Teiländerungen geschrieben.
- Die Projekt-Tests und Typechecks für die geänderten Pfade bestehen. Ein Simulator-Build ist für diesen Daten-/Gateway-Slice nicht vorgesehen.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Die Datenquelle ist nicht ausreichend lizenziert oder belegt Zutatenklassen nicht präzise genug. | Keine belastbaren Fakten; Import könnte unzulässig oder fachlich falsch sein. | Quelle und Lizenz vor dem Import in `fam-y918.7` prüfen. Keine Daten aus einer ungeprüften Quelle als `verified` markieren. |
| Viele vorhandene Zutaten bleiben unbekannt. | Fail-Closed-Verhalten blockiert einen Teil der Rezepte. | Coverage-Bericht für Haushalts- und Importzutaten führen; unbekannte Fälle gezielt kuratieren, nicht automatisch freigeben. |
| Ein aktiver persönlicher Regeltyp ist nicht durch Fakten oder Alias abbildbar. | Der Assistant könnte eine Einschränkung still übergehen. | Coverage für jedes Profilfeld testen; `unsupported` sperrt personalisierte Rezeptvorschläge und zeigt den Grund. |
| Ein Produkt ist nur über Name oder Barcode identifiziert oder seine Zutatenliste ist unvollständig. | Produktidentität belegt keine vollständige Zusammensetzung oder konkrete Verpackungsangaben. | Zutatenlistenbeleg mit Produkt-/Quellenversion und Snapshot binden; ohne vollständigen Beleg bleibt der Review `unknown`. Keine Verpackungs- oder Kreuzkontaminationsprüfung behaupten. |
| Ein geprüftes leeres Faktenresultat hat keinen positiven Beleg oder veraltete Quelle. | Fehlende Daten könnten irrtümlich als Abwesenheit von Allergenen gelten. | Auch klare Ergebnisse an Quelle, Version, Lizenz, Prüfumfang und Review-Zeitpunkt binden und bei Änderungen invalidieren. |
| Importmapping wird nur lokal im Entwurf gespeichert. | Das gespeicherte Haushaltsrezept verliert Mapping oder Beleg nach Sync/Neustart. | Mapping samt Evidence mit Rezeptposition und Outbox-Mutation persistieren; zweiten-Gerät-Wiederladen prüfen; Fehler fällt auf `unknown` zurück. |
| Wochenplan wird beim Apply teilweise geschrieben. | Spätere ungültige Mahlzeiten lassen frühere Planänderungen zurück. | Alle Einträge und Versionen vorab prüfen und gesamten Apply lokal atomar committen. |
| Private Regeln anderer Accounts oder Kinderprofile werden versehentlich gelesen. | Haushaltsmitgliedern werden sensible persönliche Angaben offengelegt. | Für den Assistant ausschließlich den eigenen RLS-Datensatz des anfragenden Accounts und nur bei freigegebenem Kontext lesen; keine Haushaltsaggregation aus einem anderen Feature-Vertrag übernehmen; RLS- und Gatewaytests hinzufügen. |
| Importmodell ergänzt Zutaten oder deutet Begriffe falsch. | Unsichere Zutatenzuordnung. | Rohtext und Mapping getrennt speichern; keine automatische Freigabe über Extraktionsvertrauen; unbekannte Positionen bleiben sichtbar. |

## Offene fachliche Grenze

Für diesen Assistant gilt der bestehende AI-Produktvertrag: nur die Regeln des anfragenden Accounts, nur bei freigegebenem Haushaltskontext. Soll fam später Regeln anderer Haushaltsmitglieder oder Kinderprofile für konkrete Mahlzeiten einbeziehen, braucht das eine eigene Produkt- und Einwilligungsentscheidung samt Datenzugriffsvertrag. Verpackungsspezifische Spurenhinweise und Kreuzkontamination bleiben außerhalb des geprüften Zutatenwissens und müssen weiterhin als nicht geprüft kenntlich sein.

## Umsetzungsstatus

Die Arbeit läuft im Worktree `codex/ai-assistant-recipe-import`. Datenbankänderungen bleiben lokal und werden über deklarative Schemas sowie die Projektkommandos für Diff, lokalen Reset und Typgenerierung integriert. Die kuratierte Quelle und ihre Belege bleiben Voraussetzung für Faktenimporte; bis dahin gelten fehlende Zuordnungen als `unknown`. Es wird nichts remote ausgerollt.
