# Persönliche Lebensmittelregeln

**Status:** Bestätigte Produktidee

**Scope:** Private, accountweite Erfassung im vorhandenen Profil

**Nicht im Scope:** Rezeptfilter, KI, Haushaltsaggregation oder medizinische Bewertung

## Problem Statement

Wie können Nutzer ihre Allergien, Unverträglichkeiten und ungeliebten Lebensmittel einmalig im privaten Profil hinterlegen, damit spätere Rezeptfunktionen diese unabhängig vom aktuell gewählten Haushalt berücksichtigen können?

## Recommended Direction

Die vorhandene Profilbearbeitung wird überarbeitet und um die Gruppe „Lebensmittel & Verträglichkeit“ ergänzt. Es entsteht kein neuer Profilbereich und kein zusätzlicher Haupteinstieg.

Das Profil führt drei getrennte, globale Listen:

- **Allergien:** sicherheitsrelevante Einschränkungen
- **Unverträglichkeiten:** Lebensmittel oder Inhaltsstoffe, die der Nutzer nicht oder nur eingeschränkt verträgt
- **Mag ich nicht:** geschmackliche Präferenzen

Die Trennung ist bereits das Regelmodell. Ein generisches System mit `kind`, `severity` oder `can_override` ist für die Erfassung nicht nötig. Häufige Einträge werden vorgeschlagen, weitere Angaben können frei ergänzt werden. Anzeigename und normalisierte Form bleiben erhalten, damit spätere Verbraucher Begriffe zuverlässig vergleichen können.

Die Daten gehören ausschließlich zum Account. Sie sind nicht an einen Haushalt gebunden, gelten damit in allen Haushalten des Nutzers und bleiben durch die private Profil-RLS vor anderen Haushaltsmitgliedern geschützt.

## Vorauswahl

### Allergien

Die Vorauswahl basiert auf den 14 in Anhang II der EU-Lebensmittelinformationsverordnung standardisierten Stoffgruppen:

1. Glutenhaltiges Getreide
2. Krebstiere
3. Eier
4. Fisch
5. Erdnüsse
6. Soja
7. Milch, als Abgrenzung zur Laktoseintoleranz in der Oberfläche als „Milch / Milcheiweiß“ bezeichnet
8. Schalenfrüchte
9. Sellerie
10. Senf
11. Sesam
12. Schwefeldioxid und Sulfite
13. Lupinen
14. Weichtiere

Zusätzlich gibt es „Weitere Allergie“. Die 14 kennzeichnungspflichtigen Gruppen sind eine belastbare Standardbasis, aber keine vollständige Liste aller möglichen Lebensmittelallergien.

Quellen:

- [BMLEH: Allergenkennzeichnung ist Pflicht](https://www.bmel.de/DE/themen/ernaehrung/lebensmittel-kennzeichnung/pflichtangaben/allergenkennzeichnung.html)
- [Verordnung (EU) Nr. 1169/2011, Anhang II](https://eur-lex.europa.eu/eli/reg/2011/1169/2018-01-01/deu/pdf)
- [Gesund.bund: Nahrungsmittelallergie](https://gesund.bund.de/nahrungsmittelallergie)

### Unverträglichkeiten

Die erste Vorauswahl bleibt bewusst klein:

- Laktoseintoleranz
- Fruktosemalabsorption
- Sorbitmalabsorption
- Zöliakie / Gluten strikt meiden
- Weitere Unverträglichkeit

Zöliakie ist medizinisch eine Autoimmunerkrankung und keine klassische Intoleranz. Sie wird dennoch hier angeboten, weil Nutzer sie im Ernährungskontext häufig als Glutenunverträglichkeit kennen. Intern muss sie eindeutig von einer Weizenallergie und anderen Unverträglichkeiten getrennt bleiben.

„Histaminintoleranz“ wird nicht prominent vorausgewählt. Die zuständige AWMF-Leitlinie beschreibt erhebliche diagnostische Unsicherheit und warnt vor pauschalen, langfristigen Eliminationsdiäten. Nutzer können Histamin weiterhin über „Weitere Unverträglichkeit“ erfassen.

Quellen:

- [AWMF: Management IgE-vermittelter Nahrungsmittelallergien](https://register.awmf.org/assets/guidelines/061-031l_S2k_Management_IgE-vermittelter_Nahrungsmittelallergien_2025-02-verlaengert.pdf)
- [Gesundheitsinformation.de: Zöliakie](https://www.gesundheitsinformation.de/zoeliakie-glutenunvertraeglichkeit.html)
- [Gesund.bund: Laktoseintoleranz](https://gesund.bund.de/laktoseintoleranz)
- [AWMF: Verdacht auf Unverträglichkeit gegenüber oral aufgenommenem Histamin](https://register.awmf.org/assets/guidelines/061-030l_S1_Vorgehen-bei-Verdacht-auf-Unvertraeglichkeit-gegenueber-oral-aufgenommenem-Histamin_2022-03.pdf)

### Mag ich nicht

Für Abneigungen gibt es keine medizinische oder gesetzliche Vorauswahlliste. Die Eingabe nutzt flexible Lebensmittelnamen und kann häufige oder zuletzt verwendete Begriffe als Komfortfunktion vorschlagen. Sie wird nicht an einzelne Product-Datensätze gebunden, weil ein Lebensmittelbegriff wie „Oliven“ oder „Pilze“ keine Produktidentität ist.

## Semantik für spätere Verbraucher

Die jetzige Umsetzung speichert nur die drei getrennten Kategorien. Sie implementiert keine Rezeptregel.

Spätere Verbraucher orientieren sich an folgenden Leitplanken:

- Allergien sind immer harte Ausschlüsse und niemals temporär übersteuerbar.
- Abneigungen sind weiche Präferenzen und dürfen im jeweiligen Workflow bewusst temporär ignoriert werden.
- Unverträglichkeiten erhalten jetzt keine pauschale harte oder weiche Bedeutung. Zöliakie verlangt eine andere Behandlung als eine individuell mengenabhängige Laktoseintoleranz. Der konkrete Verbraucher muss sein Verhalten deshalb ausdrücklich definieren.
- Eine spätere Haushaltsaggregation darf nur in einem vertrauenswürdigen Backendpfad stattfinden und nur die minimal notwendigen, vereinigten Einschränkungen weitergeben. Keine Namen oder Profilzuordnungen werden an ein Modell oder einen anderen externen Verbraucher übermittelt.

Wenn spätere Rezeptfunktionen Allergene prüfen, verwenden sie drei Zustände:

- `pass`: Allergeninformationen sind vollständig und es besteht kein bekannter Konflikt.
- `conflict`: Das Rezept enthält ein hinterlegtes Allergen.
- `unknown`: Allergeninformationen fehlen oder sind nicht verlässlich.

Bei aktiven Allergien werden sowohl `conflict` als auch `unknown` aus automatischen Vorschlägen ausgeschlossen. Die Oberfläche darf bei `unknown` nur neutral „Allergeninformationen unvollständig“ anzeigen und niemals „allergenfrei“ behaupten.

## Key Assumptions to Validate

- [ ] Nutzer verstehen die Unterscheidung zwischen Allergie, Unverträglichkeit und Abneigung.
- [ ] Die standardisierte Vorauswahl plus eigene Eingaben deckt die benötigten Angaben ausreichend ab.
- [ ] Drei getrennte Listen liefern später genug Information für Rezeptfunktionen.
- [ ] Unverträglichkeiten benötigen bei der ersten Erfassung weder Schweregrad noch Mengenangaben.
- [ ] Normalisierte Freitexteinträge lassen sich ohne belastenden Katalog-Workflow verständlich anlegen und bearbeiten.

## MVP Scope

- Vorhandene Profilbearbeitung überarbeiten
- Gruppe „Lebensmittel & Verträglichkeit“ innerhalb des bestehenden Profilflusses ergänzen
- Allergien hinzufügen und entfernen
- Unverträglichkeiten hinzufügen und entfernen
- Ungeliebte Lebensmittel hinzufügen und entfernen
- Häufige Allergien und Unverträglichkeiten als schnelle Auswahl anbieten
- Eigene Einträge für nicht abgedeckte Fälle zulassen
- Semantisch gleiche Eingaben normalisieren und Dubletten verhindern
- Angaben privat und accountweit speichern
- Leere Zustände sowie bestehende Angaben klar darstellen

## Not Doing

- **Neuer Profilbereich oder zusätzliche Hauptnavigation:** Die vorhandene Profilbearbeitung wird erweitert.
- **Rezeptfilter oder KI-Anbindung:** Diese Umsetzung erfasst ausschließlich Profildaten.
- **Haushaltsaggregation:** Sie wird erst zusammen mit einem konkreten gemeinsamen Rezeptworkflow gestaltet.
- **Temporäre Ausnahmen:** Sie gehören später in den jeweiligen Rezeptdialog.
- **Schweregrade und verträgliche Mengen:** Dafür gibt es im ersten Erfassungsworkflow noch keinen belastbaren Bedarf.
- **Automatisch gelernte Vorlieben:** Bewertungen können später als zusätzliches Signal dienen.
- **Medizinische Diagnose oder Validierung:** Die App bewertet nicht, ob eine Angabe medizinisch korrekt ist.
- **Kinderprofile:** Der erste Umfang gilt nur für Nutzer mit eigenem Account.
- **Feste Product-Verknüpfung:** Lebensmittelbegriffe bleiben unabhängig von konkreten Katalogprodukten.

## Open Questions für spätere Verbraucher

- Welche Unverträglichkeiten müssen im jeweiligen Rezeptworkflow strikt ausgeschlossen und welche nur möglichst vermieden werden?
- Wie wird eine temporäre Ausnahme für Abneigungen im jeweiligen Rezeptdialog dargestellt?
- Wie wird eine gemeinsame Mahlzeit angefragt, ohne Rückschlüsse auf private Angaben einzelner Haushaltsmitglieder unnötig zu erleichtern?
- Welche Quelle liefert einem Rezept später autoritative Allergeninformationen?
