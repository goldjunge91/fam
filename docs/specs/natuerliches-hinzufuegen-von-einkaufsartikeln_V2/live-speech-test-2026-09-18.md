# Live-Sprachtests: 20-Sätze

Die WAV-Dateien wurden am 18.09.2026 einzeln über QuickTime Player und BlackHole in den laufenden iPhone-11-Simulator (iOS 26.2) eingespeist. Die Artikel wurden nur in der Preview geprüft; kein Lauf wurde bestätigt oder in die Einkaufsliste gespeichert.

Die vollständigen relevanten Parserdaten liegen in [natural-language-addition-live-speech-2026-09-18.jsonl](natural-language-addition-live-speech-2026-09-18.jsonl). Jeder Datensatz enthält das On-Device-Flag, Rohtranskript, Parserartikel, Mengen/Einheiten und `unparsed_text`.

| Audio | Preview-Artikel | `unparsed_text` |
| --- | ---: | --- |
| satz-01.wav (Save-Test) | 19 | `null` |
| satz-02.wav | 20 | `null` |
| satz-03.wav | 21 | `null` |
| satz-04.wav | 25 | `null` |
| satz-05.wav | 26 | `null` |
| satz-07.wav | 27 | `null` |
| satz-08.wav | 29 | `null` |
| satz-09.wav | 31 | `null` |
| satz-10.wav | 29 | `null` |
| satz-11.wav | 29 | `null` |
| satz-12.wav | 31 | `null` |
| satz-13.wav | 32 | `null` |
| satz-14.wav | 32 | `null` |
| satz-15.wav | 32 | `null` |
| satz-16.wav | 33 | `null` |
| satz-17.wav | 34 | `null` |
| satz-18.wav | 36 | `null` |
| satz-19.wav | 38 | `null` |

Das JSONL enthält zusätzlich drei frühere satz-20-Läufe (39, 39 und 38 Artikel). Ein satz-01-Lauf wurde für den anschließenden Save-/Delete-Integrationstest erneut aufgezeichnet. Ein früher separat live geprüfter satz-06-Lauf ist in diesem Artefakt nicht enthalten.

Die sichtbaren Namensabweichungen bleiben absichtlich erhalten: Sie dokumentieren echte iOS-Spracherkennung und werden nicht nachträglich korrigiert oder als Parsererfolg ausgegeben.

## Save-/Delete-Integrationstest

Mit `satz-01.wav` wurde in der Preview genau `Äpfel` ausgewählt, dem Markt `Aldi` zugeordnet und über `1 Artikel hinzufügen` bestätigt. Danach zeigte die Aldi-Liste `Äpfel bearbeiten`; die Detailansicht bestätigte Menge `1` und Markt `Aldi`. Der Testartikel wurde anschließend über den Löschdialog entfernt. Danach enthielt die Aldi-Ansicht wieder nur den vorher vorhandenen Eintrag `Kuchen`; `Äpfel` war nicht mehr vorhanden. Kein anderer Preview-Artikel wurde bestätigt.
