# Implementation Plan: Koch-Streak sichtbar machen

## Überblick

Die bereits vorhandene lokale Streak-Logik wird als sichtbare Dashboard-Karte in
die App integriert. Erfolgreiche Koch- und Einkaufsaktionen aktualisieren die
Karte weiterhin offline; definierte Meilensteine lösen zusätzlich die vorhandene
feierliche Haptik aus.

## Architekturentscheidungen

- Die Streak bleibt eine lokale, gerätegebundene Kennzahl. Es gibt keine
  Datenbankänderung und keine neue Synchronisationsschicht.
- Die Dashboard-Karte wird als immer verfügbare Karte registriert und kann über
  die bestehende Karten-Galerie ein- und ausgeblendet sowie in der Größe
  verändert werden.
- Die bestehende `useStreak()`-Subscription versorgt die Karte reaktiv mit
  Änderungen aus MMKV.
- Meilensteine verwenden die vorhandene `celebrate()`-Haptik. Eine neue
  Benachrichtigungs- oder Konfetti-Abhängigkeit wäre für den aktuellen Umfang
  nicht gerechtfertigt.

## Task List

### Phase 1: Verhaltenspfad

- [x] `recordActivity()`-Ergebnisse in Koch- und Einkaufsabschluss auswerten
- [x] Bei den definierten Meilensteinen `celebrate()` auslösen
- [x] Fokussierte Regressionstests für normale Aktivität und Meilensteine

### Phase 2: Dashboard-Karte

- [x] Kleine und große Streak-Karten im bestehenden Fam-Stil implementieren
- [x] Karte im Dashboard registrieren und in der Galerie beschreiben
- [x] Reaktive Anzeige von aktueller Streak, bester Streak und Status heute

### Checkpoint: Sichtbarkeit

- [x] Karte erscheint im Dashboard und kann über Long-Press bearbeitet werden
- [x] MMKV-Änderungen aktualisieren die Karte ohne Navigation oder Reload
- [x] Keine Aktivität zeigt einen verständlichen Startzustand

### Phase 3: Verifikation

- [x] Betroffene Jest-Tests erfolgreich
- [ ] `bun run typecheck` erfolgreich, blockiert durch bestehende Inventory-/DB-Fehler
- [ ] `bun run check` erfolgreich, blockiert durch bestehende Inventory-/DB-Formatfehler
- [x] `bun run check:css` erfolgreich

Die fokussierte Biome-Prüfung aller geänderten Streak-/Dashboard-Dateien ist
grün. Der globale Check und Typecheck bleiben wegen paralleler, bereits
vorhandener Änderungen außerhalb dieses Features offen.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Streak-Karte wird durch die bestehende Karten-Galerie versteckt | Nutzer sehen die Funktion nicht | Karte standardmäßig sichtbar registrieren und Metadaten ergänzen |
| Mock von `recordActivity()` liefert in bestehenden Tests keinen Wert | Tests schlagen beim Auswerten des Meilensteins fehl | Rückgabewert in den Caller-Tests explizit modellieren |
| Lokaler Gerätespeicher ist kontoübergreifend | Streak kann bei mehreren Konten auf demselben Gerät geteilt werden | Im aktuellen Umfang nicht umbauen; als bekannte Einschränkung dokumentieren |

## Nicht im Umfang

- Supabase-Schema oder RLS
- Kontoübergreifende Synchronisierung
- Freeze-Days, Push-Benachrichtigungen, XP oder Achievement-System
