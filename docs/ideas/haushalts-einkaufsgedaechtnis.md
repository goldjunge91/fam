# Haushalts-Einkaufsgedächtnis

## Problem Statement

Wie können Haushalte Kassenbons mit minimalem Aufwand erfassen und später nach
Kaufdatum nachvollziehen, was der Einkauf und seine einzelnen Artikel gekostet
haben?

## Recommended Direction

Der Bon-Upload ist ein optionaler, geteilter Haushaltsworkflow. OCR erkennt
Markt, Datum, Gesamtbetrag und relevante Produktpositionen. Nur unsichere Werte
müssen korrigiert werden. `expo-ai-kit@0.17.0` bildet die gemeinsame Expo-API;
darunter laufen Apple Vision auf iOS und Google ML Kit auf Android. Es ist der
einzige direkte OCR-Provider dieser Umsetzung; `expo-mlkit-ocr` ist nicht Teil
des aktuellen Plans.

Der Feature-Code besitzt den gemeinsamen Owner `src/features/ocr/` mit den
getrennten Bereichen `authority/`, `capture/` und `processing/`.

Das komprimierte, gut lesbare Belegbild wird in Supabase Storage gespeichert und ist ausschließlich für Haushaltsmitglieder zugänglich. Es gibt keine öffentlichen Beleg-URLs.

Die aktuelle Historie zeigt bestätigte Bons nach Kaufdatum. Jeder Bon bleibt
als eigene Detailansicht aufrufbar und zeigt Markt, Datum, Gesamtsumme sowie
die vollständige bestätigte Artikelliste mit Mengen und Preisen. Vorhandene
private Bonbilder werden direkt als Vorschau gezeigt und können vergrößert
geöffnet werden. Die Historie liegt unter `Haushalt > Einstellungen`; der
Erfassungsbutton bleibt in der Einkaufsliste. Aggregationen, Budgetlogik und
automatische Kategorisierung sind nicht Teil dieses Schritts.

Rabatte, Coupons, Pfand und Treuekartenpositionen werden nicht als eigene Positionen gespeichert. Der finale bezahlte Gesamtbetrag bleibt jedoch für die Ausgabenhistorie erhalten. Der Preisverlauf zeigt daher beobachtete Kassenpreise, nicht garantiert reguläre Preise.

## Key Assumptions to Validate

- [ ] Der Upload wird regelmäßig genutzt, wenn nur unsichere Werte geprüft werden müssen.
- [ ] Markt, Datum und Gesamtbetrag werden zuverlässig genug erkannt.
- [ ] Komprimierte Belege bleiben auf Mobilgeräten gut lesbar.
- [ ] Datumssortierte Bons und Artikelpreise bleiben nach Relaunch offline
      lesbar.
- [ ] Ein späteres Verknüpfen wiederkehrender Artikel ist nur mit bestätigter
      Identität zuverlässig.

## MVP Scope

- Bon fotografieren oder hochladen
- Bild komprimieren und in Supabase Storage speichern
- OCR für Markt, Datum, Gesamtbetrag und Produktpositionen
- Relevante Artikel und ihre beobachteten Positionspreise verarbeiten
- Pfand-, Rabatt-, Coupon- und Treuekartenzeilen ignorieren
- Unsichere Werte manuell korrigieren
- Einkauf einem bestehenden Haushaltssupermarkt zuordnen
- Bestätigte Bons nach Kaufdatum anzeigen und jeden Bon als vollständige
  strukturierte Detailansicht mit Artikeln und Preisen öffnen
- Vorhandene private Bonbilder in der Detailansicht als Vorschau anzeigen und
  vergrößert öffnen
- Bon-Historie unter Haushaltseinstellungen, Bon-Erfassung weiterhin in der
  Einkaufsliste
- Strukturierte Bondaten dauerhaft speichern; Belegbilder getrennt privat
  speichern und unabhängig löschbar halten
- Supabase-RLS für Haushaltsmitglieder und Storage-Objekte

## Not Doing

- Automatische Bestandspflege
- Automatische Änderungen an der Einkaufsliste
- Vollständiges Budgetsystem
- Aggregierte Ausgabenberichte und Preisverlaufsanalyse
- Automatisches Zusammenführen wiederkehrender Artikel
- Automatische Normalpreis-Erkennung
- Automatische „günstigster Markt“-Empfehlungen im MVP
- Verbindung mit privaten Kalorien- oder Gesundheitsdaten
- Speicherung von Rabatt- und Coupondetails

Capture, OCR, Review, Save, Historie und Löschen verändern niemals Inventory,
Fridge oder Shopping List und erzeugen keine entsprechenden
Outbox-Operationen.

## Open Questions

- Wie lange sollen private Bonbilder standardmäßig aufbewahrt werden, bevor der
  Nutzer sie optional löscht? Die strukturierten Daten bleiben erhalten.
- Wie wird die Lesbarkeit der komprimierten Belege auf verschiedenen Geräten validiert?
- Nach welchem expliziten Vertrag sollen wiederkehrende Artikel später
  bestätigt miteinander verknüpft werden?
