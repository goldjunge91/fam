Sobald die Aufnahmen fertig sind, gehen wir so weiter:

1. **Rohbilder prüfen**
   - 5 deutsche und 5 englische Screenshots
   - `1320 × 2868 px`
   - PNG ohne Transparenz
   - keine Debug-Overlays, Dialoge oder Simulator-Ränder
   - korrekte Reihenfolge: Dashboard, Einkauf, Vorrat, Rezepte, Tracking

2. **In Figma importieren**
   - die Rohbilder in Apples iPhone-17-Pro-Max-Template einsetzen
   - Gerätrahmen und Hintergrund übernehmen
   - pro Screenshot eine kurze Überschrift ergänzen
   - zuerst das deutsche Set, danach die englische Variante

3. **Arbeitsentwürfe prüfen**
   - Text darf die App-UI nicht verdecken
   - Screenshots müssen echte Funktionen zeigen
   - keine abgeschnittenen Texte oder wichtigen Inhalte
   - gleiche Farben und Gestaltung über alle fünf Screens

4. **Final exportieren**
   - als PNG
   - weiterhin `1320 × 2868 px`
   - ohne Transparenz
   - unter `screenshots/app-store/final/de/` und `screenshots/app-store/final/en/`

5. **Mit dem finalen TestFlight-Build vergleichen**
   - jeder Screenshot muss exakt zum Build mit `com.goldjunge91.fam1` passen
   - keine Funktionen zeigen, die im Build nicht verfügbar sind

6. **In App Store Connect hochladen**
   - iPhone-Screenshot-Set auswählen
   - deutsche und englische Lokalisierung getrennt pflegen
   - Screenshots in derselben Reihenfolge hochladen

Apple erlaubt ein bis zehn Screenshots und skaliert den hochauflösenden 6,9"-Satz für kleinere Geräte herunter. 

Der nächste konkrete Schritt ist also: **Rohbilder prüfen, bevor wir sie in Figma gestalten.**


```md
Erstelle die Roh-Screenshots für den iOS-App-Store-Eintrag der App „fam“.

Zielgerät:
- iPhone 17 Pro Max
- Portrait
- Native Auflösung des Geräts
- App-Bundle: com.goldjunge91.fam1
- Verwende den aktuellen Production-/TestFlight-Build

Allgemeine Regeln:
- Nur den echten App-Inhalt aufnehmen
- Keine Simulator-Fenster, Mauszeiger, Debug-Menüs oder Dev-Overlays
- Keine Splashscreens, Loginseiten, Ladezustände oder offenen Tastaturen
- Modals und Berechtigungsdialoge schließen
- Nur fiktive Testdaten verwenden
- Keine echten Namen, E-Mail-Adressen oder privaten Gesundheitsdaten
- Auf jeder Seite warten, bis die Inhalte vollständig geladen sind
- Die Free-Version verwenden. Werbung bleibt aktiviert, darf aber nicht absichtlich versteckt werden
- Noch keine Marketing-Texte oder Figma-Geräterahmen hinzufügen
- Jeden Screenshot als unveränderte PNG-Datei speichern
- Keine Kompression und kein Zuschneiden

Speicherort:

screenshots/app-store/raw/de/iphone-17-pro-max/

Benötigte deutsche Screenshots in dieser Reihenfolge:

01-dashboard.png
Zeige das Dashboard als Einstieg:
- Haushaltsbegrüßung
- aktuelles Datum oder Tagesübersicht
- zentrale Haushaltsinformationen
- sichtbare Hinweise auf Einkauf, Vorrat oder Planung
- untere Navigation vollständig sichtbar

Marketing-Idee für später in Figma:
„Alles für euren Haushalt im Blick“

02-einkauf.png
Zeige die Hauptansicht der Einkaufsliste:
- mehrere noch offene Einkaufsartikel
- sichtbare Zuordnung zu Märkten, Kategorien oder Listen
- gemeinsamer Haushaltskontext
- keine leere Liste
- Navigation vollständig sichtbar

Marketing-Idee:
„Gemeinsam einkaufen, nichts vergessen“

03-vorrat.png
Zeige die Vorrats-Hauptansicht:
- mehrere Vorratsartikel
- Lagerorte oder Kategorien
- mindestens ein sichtbarer Hinweis auf Ablaufdatum, Bestand oder Verbrauch
- keine leere Ansicht

Marketing-Idee:
„Vorrat und Ablaufdaten im Blick“

04-rezepte.png
Zeige die Rezeptübersicht:
- mehrere echte Rezeptkarten oder Rezeptvorschläge
- sichtbarer Bezug zu vorhandenen Vorräten
- wenn vorhanden, den Bereich „Jetzt verwenden“ zeigen
- keine Detailansicht mit Ladezustand

Marketing-Idee:
„Passende Rezepte aus eurem Vorrat“

05-tracking-privat.png
Zeige die private Tracking-Übersicht:
- Kalorien, Nährwerte, Gewicht oder Tagesfortschritt
- eindeutig private persönliche Ansicht
- ausschließlich fiktive Werte verwenden
- keine Medikamente oder besonders sensiblen Daten zeigen, sofern nicht notwendig

Marketing-Idee:
„Gesundheit privat im Blick behalten“

Nach jedem Screenshot:
- Prüfen, dass der gewünschte Screen vollständig sichtbar ist
- Prüfen, dass keine Dialoge oder Ladeindikatoren vorhanden sind
- Prüfen, dass der Screenshot die richtige Reihenfolge und den richtigen Dateinamen hat

Falls ein Screen im aktuellen Build nicht vorhanden oder nicht stabil erreichbar ist:
- Nicht durch einen künstlichen Screen ersetzen
- Den Grund dokumentieren
- Mit dem nächsten Screen fortfahren

Danach dieselben fünf Screens zusätzlich auf Englisch aufnehmen und speichern unter:

screenshots/app-store/raw/en/iphone-17-pro-max/
```