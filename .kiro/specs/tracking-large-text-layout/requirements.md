# Requirements Document

## Introduction

Diese Spezifikation beschreibt die Layout-Anpassung für den vollständigen Screen „Mein Tracking“ im Zusammenhang mit `fam-qu0f`. Der Screen enthält die Auswahl der Tracking-Methode, Ernährung und Tagesziele mit Makro-Bereichen sowie Tracking-Rhythmus und Zeitfenster einschließlich des manuellen Tagesstart-Modals.

Das Ziel ist ein vollständig lesbarer und bedienbarer Screen bei nativer iOS-Großschrift auf einem realen iPhone mit 414 pt Breite. Betroffene Texte müssen ihren Schriftgrad behalten, umbrechen oder in verfügbare Bereiche stapeln können und bei wachsendem Inhalt vollständig erreichbar bleiben. Die bestehenden Nachweise bei 320 pt und `fontScale === 2` bleiben erhalten und werden um einen eigenen Tracking-Fall ergänzt.

Diese Phase erstellt nur die Requirements-Spezifikation. Produktcode, Harness-Code und Tests werden in dieser Phase nicht geändert. OTA, Signing und Build-Probleme gehören nicht zum fachlichen Umfang.

## Glossary

- **Tracking Screen**: Der Produkt-Screen „Mein Tracking“ unter `/profile/tracking` für private Tracking-Einstellungen eines erwachsenen Accounts.
- **Day-Start Modal**: Das Modal „Tagesstart festlegen“ für die manuelle Eingabe, Prüfung, Übernahme oder Verwerfung einer Tagesstart-Uhrzeit.
- **Large-Text Layout**: Die Layout-Regeln des Tracking Screen und des Day-Start Modal für native größere Schriftgrade und schmale verfügbare Breiten.
- **Affected Text**: Überschrift des Screens, Bereichsüberschriften, Namen, Beschreibungen und Status der Tracking-Methoden, Texte in Methoden- und Inhaltsbereichen, Kalorien- und Makro-Bezeichnungen und -Werte, Tagesstart-Texte sowie Labels, Hilfetexte, Fehlermeldungen und Aktionen des Day-Start Modal.
- **Macro Area**: Ein Darstellungsbereich für genau einen Makro-Wert aus Protein, Carbs oder Fett.
- **Content-Derived Height**: Eine Containerhöhe, die aus dem vollständig dargestellten Inhalt entsteht und nicht als feste Begrenzung vorgegeben wird.
- **Single-Line Restriction**: Eine Begrenzung, die einen Affected Text auf eine Zeile festlegt oder zusätzlichen Text ausblendet.
- **Responsive Stacking**: Das vertikale Anordnen von Macro Areas oder Text- und Aktionsbereichen, wenn die verfügbare Breite eine vollständige Darstellung in einer Reihe nicht zulässt.
- **Deterministic Large-Text Harness**: Der bestehende iOS-Harness für reproduzierbare Layout-Nachweise bei 320 logischen Punkten und `fontScale === 2`, der um den Tracking-Fall erweitert wird.
- **Native iOS Acceptance**: Die reale Abnahme des Tracking Screen auf einem iPhone mit nativer iOS-Großschrift und einer gemessenen Breite von 414 pt.
- **fontScale**: Der zur Laufzeit gemessene native Skalierungswert der Schrift; die Native iOS Acceptance bindet den Nachweis nicht an einen festen Wert.
- **Acceptance Process**: Die Reihenfolge aus Layout-Anpassung, deterministischem Harness-Nachweis, realer iPhone-Abnahme und anschließendem Schließen von `fam-qu0f`.
- **fam-qu0f**: Der Beads-Vorgang für den Nachweis großer Systemschrift auf schmalen Produktflächen.

## Requirements

### Requirement 1: Complete Tracking Screen

**User Story:** Als erwachsener Account-Inhaber möchte ich alle privaten Tracking-Einstellungen auf einem vollständigen Screen sehen und bedienen können, damit Methode, Tagesziele und Tagesstart an einer Stelle erreichbar sind.

#### Acceptance Criteria

1. THE Tracking Screen SHALL present the tracking-method area, method-specific content, nutrition and daily-goal area, Macro Areas, and tracking-rhythm and time-window area.
2. WHEN profile and goal data are available, THE Tracking Screen SHALL show the selected tracking method, the current daily calorie goal, the current macro values, and the current day-start time.
3. IF no current goal is available, THEN THE Tracking Screen SHALL show an explicit not-set state for the daily calorie goal and the Macro Areas.

### Requirement 2: Manual Day-Start Modal

**User Story:** Als erwachsener Account-Inhaber möchte ich den Tagesstart manuell festlegen können, damit mein persönlicher Tracking-Tag zu meiner Tagesroutine passt.

#### Acceptance Criteria

1. WHEN the account holder activates manual day-start entry, THE Day-Start Modal SHALL show its heading, time input, explanatory text, apply action, and cancel or close action.
2. WHEN the account holder submits a valid 24-hour time, THE Day-Start Modal SHALL apply the entered time, close, and return the selected time to the Tracking Screen.
3. IF the entered value is not a valid 24-hour time, THEN THE Day-Start Modal SHALL remain open and show a validation message adjacent to the time input.
4. WHEN the account holder selects cancel or close, THE Day-Start Modal SHALL close without applying the unsaved input.

### Requirement 3: Native 414-Point Large-Text Readability

**User Story:** Als Nutzer mit nativer iOS-Großschrift möchte ich den vollständigen Tracking Screen und das Tagesstart-Modal lesen können, damit keine Information oder Aktion durch die größere Schrift verloren geht.

#### Acceptance Criteria

1. WHILE Native iOS Acceptance uses a real iPhone with a measured viewport width of 414 pt, THE Tracking Screen SHALL render every Affected Text fully inside the available horizontal bounds without overflow or clipping.
2. WHILE Native iOS Acceptance uses native iOS large text, THE Day-Start Modal SHALL render every Affected Text fully inside the available modal area without overflow, clipping, or hidden text.
3. WHEN Native iOS Acceptance records the native text scale, THE Native iOS Acceptance SHALL document the measured `fontScale` together with the measured viewport width.
4. THE Native iOS Acceptance SHALL evaluate the layout against the observed `fontScale` without requiring a fixed `fontScale` value.

### Requirement 4: Responsive Text and Macro Areas

**User Story:** Als Nutzer mit größerer Schrift möchte ich, dass Überschriften, Methoden- und Inhaltsbereiche sowie Makro-Bereiche ihren verfügbaren Raum flexibel nutzen, damit alle Texte vollständig lesbar bleiben.

#### Acceptance Criteria

1. WHEN an Affected Text exceeds one line at the available width, THE Large-Text Layout SHALL wrap the text and expand its containing block to a Content-Derived Height.
2. WHILE an Affected Text shares a row with another control, THE Large-Text Layout SHALL allow the text block to shrink within the available width and keep the adjacent control reachable.
3. THE Large-Text Layout SHALL use Content-Derived Height for containers that hold Affected Text.
4. THE Large-Text Layout SHALL render Affected Text without a Single-Line Restriction.
5. WHEN Macro Areas cannot contain their complete label and value in one row at the target width, THE Large-Text Layout SHALL use Responsive Stacking and preserve the complete label and value.
6. WHEN a tracking-method or content area cannot contain its complete name, description, or status in one row, THE Large-Text Layout SHALL reflow the text and status into the available vertical space.

### Requirement 5: Complete Vertical Scrolling

**User Story:** Als Nutzer mit großer Schrift möchte ich den gesamten wachsenden Inhalt scrollen können, damit auch untere Bereiche und Aktionen erreichbar bleiben.

#### Acceptance Criteria

1. WHILE Tracking Screen content exceeds the visible height, THE Tracking Screen SHALL allow vertical scrolling from the first section to the last section and expose every section and action.
2. WHILE Day-Start Modal content exceeds the available modal height, THE Day-Start Modal SHALL allow vertical scrolling to every field, explanation, validation message, and action.
3. IF a validation message increases the Day-Start Modal content height, THEN THE Day-Start Modal SHALL keep the validation message and both modal actions reachable through scrolling.

### Requirement 6: Preserved Text Size and Content

**User Story:** Als Nutzer mit nativer Großschrift möchte ich, dass die eingestellte Schriftgröße erhalten bleibt und kein Text versteckt wird, damit die Darstellung zugänglich und vollständig bleibt.

#### Acceptance Criteria

1. THE Large-Text Layout SHALL preserve the configured native font size for every Affected Text at the target widths and text scales.
2. THE Large-Text Layout SHALL display complete Affected Text instead of reducing the font size or hiding overflow.

### Requirement 7: Deterministic Harness Coverage

**User Story:** Als Maintainer möchte ich den bestehenden deterministischen Nachweis behalten und um den Tracking Screen erweitern, damit der Layout-Fix reproduzierbar geprüft wird, ohne vorhandene Nachweise zu verlieren.

#### Acceptance Criteria

1. THE Deterministic Large-Text Harness SHALL retain its existing iOS coverage at 320 logical points with `fontScale === 2`.
2. WHEN the tracking case is added, THE Deterministic Large-Text Harness SHALL exercise the complete Tracking Screen and the Day-Start Modal at 320 logical points with `fontScale === 2`.
3. THE Deterministic Large-Text Harness SHALL execute the existing product-surface cases together with the new tracking case rather than replacing an existing case.
4. WHEN the tracking case captures evidence, THE Deterministic Large-Text Harness SHALL record the resolved viewport width, measured `fontScale`, and an artifact for the Tracking Screen and Day-Start Modal states.

### Requirement 8: Acceptance Order and Scope

**User Story:** Als Maintainer möchte ich die Nachweise in einer festen Reihenfolge durchführen, damit `fam-qu0f` erst nach dem Layout- und Gerätebeleg abgeschlossen wird.

#### Acceptance Criteria

1. WHEN the layout adjustment is ready, THE Acceptance Process SHALL perform the layout review first, the 320-point and `fontScale === 2` harness run second, the real 414-pt iPhone acceptance third, and the `fam-qu0f` closure last.
2. WHEN the deterministic harness and Native iOS Acceptance both pass, THE Acceptance Process SHALL provide the evidence required to close `fam-qu0f`.
3. IF OTA, signing, or build problems occur, THEN THE Acceptance Process SHALL record those problems as outside the scope of this feature and keep the layout acceptance criteria unchanged.

## Scope Boundaries

- Der Umfang umfasst den vollständigen Tracking Screen, das manuelle Day-Start Modal, die betroffenen Layout-Regeln, den zusätzlichen Tracking-Fall im bestehenden Harness und die beschriebene Reihenfolge der Nachweise.
- Der Umfang umfasst keine neue Tracking-Fachlogik, keine Änderung der privaten Datenverantwortung und keine Ausweitung auf andere Plattformen.
- OTA, Signing und Build-Probleme werden nicht als Layout-Arbeit behandelt.
- Diese Requirements-Spezifikation ersetzt weder den bestehenden 320-pt- und `fontScale === 2`-Nachweis noch den realen iOS-Nachweis.
