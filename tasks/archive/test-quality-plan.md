# Implementierungsplan: Testqualität und CI-Stabilität

## Abschlussstatus

**Vollständig erledigt** — 2026-09-16

- Beads-Epic `fam-okaa` ist geschlossen; alle 14 Unteraufgaben sind erledigt.
- Die Checkpoints für reproduzierbare Tests, Sync-Qualität und Qualitätsgates
  sind vollständig verifiziert und oben als abgeschlossen markiert.
- Nachweise: fokussierte Konventions-Regressionstests (3 Suites, 22 Tests),
  CI-Scope-Metriklauf und dokumentierter Coverage-/Mutation-Pilot.
- Dieser Plan ist abgeschlossen und wird nicht mehr als aktive Aufgabenquelle
  verwendet. Neue Verbesserungen erhalten eigene Beads-Aufgaben.

## Überblick

Die letzte CI-Ausführung scheiterte mit 8 fehlgeschlagenen Suiten und 9
fehlgeschlagenen Tests. Die konkreten Isolationsursachen wurden inzwischen
behoben: Ads-Tests setzen ihre Env-Konfiguration selbst, der veraltete
Settings-Konventionseintrag ist entfernt und der GLP-1-Test verwendet für die
lange Eingabe `paste` statt 201 einzelner Events.

Der anschließende Qualitätsaudit zeigt trotzdem strukturelle Risiken:

- Die CI-relevante Unit-Suite ist aktuell grün: 356 Suiten und 2426 Tests.
- Die gemessene Coverage liegt bei ungefähr 73,49 % Statements, 64,60 %
  Branches, 69,92 % Functions und 75,47 % Lines.
- Kritische Sync-Pfade sind schwach abgedeckt: `outbox-retry.ts` 0 %,
  `realtime.ts` ca. 2 %, `pull.ts` ca. 10 % und `background-sync.ts` ca. 14 %.
- Unit-nahe Tests enthalten noch echte `setTimeout`-Wartezeiten.
- Der i18n-Konventionstest erzeugt ungefähr 1399 report-only Findings.
- Die aktuelle Metrik-Hilfe zählt nicht exakt den CI-Scope und erkennt
  Testdeklarationen nur heuristisch.

Ziel ist eine reproduzierbare Unit-Suite, die kritische Offline-/Sync-Verträge
prüft, zeitbasierte Tests deterministisch ausführt und Qualitätsverschlechterung
schrittweise in CI sichtbar macht.

## Architektur- und Prozessentscheidungen

- Der bestehende Maestro-Plan unter `tasks/plan.md` bleibt unverändert. Dieser
  Plan wird ausschließlich unter `tasks/test-quality-plan.md` geführt.
- Aufgaben werden ausschließlich in Beads verfolgt. Die Beads-IDs in diesem
  Dokument sind der geordnete Index, keine zweite Aufgabenquelle.
- Unit-Tests verwenden keine persönliche `.env.development.local` als implizite
  Wahrheit. Env-abhängige Tests definieren ihre benötigten Werte selbst.
- Zeitverhalten wird mit scoped Fake-Timern geprüft. Timer werden innerhalb von
  `act` gezielt vorgerückt und danach sauber zurückgesetzt.
- Eine künstlich langsame API-/Katalogantwort ist kein Timer-Verhalten. Solche
  Tests verwenden Deferred-Promises und lösen die Antwort explizit auf.
- `waitFor` wartet ausschließlich auf beobachtbare Zustände oder Assertions;
  es führt keine Seiteneffekte aus und ersetzt kein gezieltes Timer-Vorrücken.
- Die ersten Coverage-Schwellen sind bewusst niedriger als die verifizierte
  Baseline: Statements 70 %, Branches 60 %, Functions 65 %, Lines 72 %.
  Nach den Sync-Slices werden sie schrittweise erhöht.
- Mutation Testing wird zunächst nur als fokussierter Pilot für Sync- und
  Auth-Domainlogik bewertet und nicht in den normalen Unit-Gate-Lauf gelegt.

## Abhängigkeiten und Reihenfolge

```text
Stabile Testumgebung (fam-okaa.3)
    ├── Outbox-Retry (fam-okaa.9) ─┐
    ├── Pull (fam-okaa.7)          │
    ├── Realtime (fam-okaa.2)      ├── Coverage-Gate (fam-okaa.5)
    └── Background-Sync (fam-okaa.6)┘

Metrik-Scope (fam-okaa.10) ─── i18n-Diagnose (fam-okaa.11)

Sync-Slices + Coverage-Gate ─── Mutation-Pilot (fam-okaa.8)
```

Die Timer-Aufgabe `fam-okaa.4` ist unabhängig und kann parallel zur
Testumgebung bzw. vor den Sync-Slices umgesetzt werden.

## Aufgabenliste

### Phase 1: Fundament und reproduzierbare Tests

1. **fam-okaa.3 – Stabile Unit-Test-Umgebung unabhängig von lokaler dotenv-Datei**
   - Priorität: P1, mittlerer Umfang.
   - Env-abhängige Tests und der Test-Runner erhalten einen expliziten,
     CI-identischen Vertrag.
   - Abhängigkeiten: keine.

2. **fam-okaa.4 – Unit-Timer deterministisch machen**
   - Priorität: P2, mittlerer Umfang.
   - ScreenshotDriver und echte Debounce-Tests verwenden Fake-Timer;
     Katalog-/Netzwerk-Latenzen werden mit Deferred-Promises modelliert.
   - Abhängigkeiten: keine.

3. **fam-okaa.10 – Testqualitätsmetriken auf den echten CI-Scope begrenzen**
   - Priorität: P2, kleiner bis mittlerer Umfang.
   - Metriken und Marker-Prüfung verwenden denselben Scope wie die CI-Unit-Suite
     und geben ihre Eingabemenge nachvollziehbar aus.
   - Abhängigkeiten: keine.

### Checkpoint 1: Reproduzierbare Basis

- [x] Die fokussierten Env-Tests laufen unabhängig vom lokalen dotenv-Inhalt.
- [x] Timer-Kandidaten sind klassifiziert: Fake-Timer, Deferred-Promise oder
      begründeter Scheduler-Restore.
- [x] Die Metrik-Ausgabe erklärt exakt den CI-Scope.
- [x] `bun run check` und `bun run typecheck` bleiben grün.

### Phase 2: Kritische Sync-Verträge

Die folgenden vier Aufgaben können nach `fam-okaa.3` parallel bearbeitet
werden. Jede Aufgabe bleibt auf den eigenen Sync-Pfad und seine fokussierten
Tests begrenzt.

4. **fam-okaa.9 – Outbox-Retry gezielt als Unit-Vertrag absichern**
   - Priorität: P1.
   - Terminale Retries, Payload-Reparaturen, sichere No-op-Fälle und ungültige
     Payload-Formen werden als Unit-Verträge abgedeckt.

5. **fam-okaa.7 – Pull-Fehler, Cursor und Reconciliation gezielt testen**
   - Priorität: P1.
   - Fehlerdiagnose, JWT-/Retry-Sonderfälle, Pagination, Cursor-Commit,
     lokale Wins und Orphan-Reconciliation werden abgedeckt.

6. **fam-okaa.2 – Realtime-Payloads und Reconnect-Resync absichern**
   - Priorität: P1.
   - Channel-Lifecycle, INSERT/UPDATE/DELETE, Payload-Fehler, Reconnect und
     Cleanup werden ohne echte Realtime-Verbindung geprüft.

7. **fam-okaa.6 – Background-Sync-Registrierung und Handler-Verträge absichern**
   - Priorität: P1.
   - Lazy Native-Module, idempotente Task-Definition, Handler-Erfolg/-Fehler
     sowie Registrierung, Deregistrierung und Status werden abgedeckt.

### Checkpoint 2: Sync-Qualität

- [x] Alle vier fokussierten Sync-Testgruppen sind grün.
- [x] Coverage der vier Zielmodule ist messbar über dem Ausgangswert.
- [x] Bestehende Integrations- und DB-Tests bleiben unverändert grün.
- [x] Es wurden keine nativen Dateien, Datenbankschemata oder Migrationen
      verändert.

### Phase 3: Diagnose und Qualitätsgates

8. **fam-okaa.11 – i18n-Convention-Report ohne Diagnose-Rauschen**
   - Priorität: P2.
   - Report-only Findings werden aggregiert; echte Übersetzungs-, Placeholder-
     und dynamische-Key-Fehler bleiben fehlschlagend.
   - Abhängigkeit: `fam-okaa.10`.

9. **fam-okaa.5 – Coverage-Schwellen als schrittweises CI-Gate einführen**
   - Priorität: P2.
   - Der CI-Unit-Scope erhält zunächst die Schwellen 70/60/65/72 für
     Statements/Branches/Functions/Lines. Ein kontrollierter Threshold-Breach
     muss den Lauf reproduzierbar fehlschlagen lassen.
   - Abhängigkeiten: `fam-okaa.3`, `fam-okaa.10`, `fam-okaa.9`, `fam-okaa.7`,
     `fam-okaa.2`, `fam-okaa.6`.

10. **fam-okaa.8 – Mutation Testing für Sync- und Auth-Kernlogik bewerten und
    pilotieren**
    - Priorität: P3.
    - Ein fokussierter Mutation-Pilot klassifiziert nicht getötete Mutanten und
      bleibt aus dem normalen CI-Unit-Gate heraus.
    - Abhängigkeiten: Sync-Slices und `fam-okaa.5`.

### Checkpoint 3: Qualitätsgates

- [x] i18n-Diagnose ist kompakt und echte Fehler bleiben sichtbar.
- [x] Coverage-Gate läuft nur gegen den verifizierten CI-Unit-Scope.
- [x] Mutation-Pilot liefert einen dokumentierten Score und klassifizierte
      offene Mutanten.
- [x] Der normale CI-Unit-Lauf bleibt ohne unnötige Laufzeitsteigerung grün.

## Verifikation pro Slice

Die Umsetzung folgt den Repository-Regeln:

- `bun run test <gezielte-dateien>` statt der vollständigen Suite während der
  Einzelaufgaben.
- `bun run test -- --runInBand <gezielte-dateien>` für Timer-/RNTL-Diagnose und
  Wiederholung gegen Flakiness.
- `bun run check` und `bun run typecheck` an jedem Checkpoint.
- Nach Phase 2 ein CI-identischer Unit-Lauf mit 356 Suiten und 2426 Tests.
- Danach ein CI-identischer Coverage-Lauf mit dokumentierter Baseline und
  Threshold-Ergebnis.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Fake-Timer und RNTL-`userEvent` geraten aus `act` | Warnungen oder hängende Tests | `advanceTimers` konfigurieren, Timer innerhalb von `act` vorrücken; bei nachgewiesener Inkompatibilität begründete `fireEvent`-Ausnahme |
| Sync-Tests werden zu stark gemockt | Falsche Sicherheit | Reine Verträge mit kontrollierten Fakes testen und vorhandene SQLite-/Realtime-Integrationstests behalten |
| Coverage-Schwellen blockieren legitime Änderungen | CI-Friktion | Schwellen unter der verifizierten Baseline starten und erst nach Sync-Slices erhöhen |
| i18n-Report wird nur stummgeschaltet | Echte Fehler bleiben unsichtbar | Fehlerklassen weiterhin hart fehlschlagen lassen, nur report-only Ausgabe aggregieren |
| Mutation Testing verlängert CI | Langsame Feedbackschleife | Zunächst lokaler, fokussierter Pilot außerhalb des normalen Gates |
| Lokale dotenv-Datei beeinflusst weiterhin Tests | Wiederkehrende CI-Flakes | Env-Vertrag im Runner/Setup und explizite Test-Overrides verifizieren |

## Offene Entscheidungen

- Nach dem ersten grünen Coverage-Gate festlegen, ob Schwellen global oder
  zusätzlich pro kritischem Sync-Modul erhöht werden.
- Nach dem Mutation-Pilot entscheiden, ob er nächtlich, manuell oder nur vor
  Releases läuft.
- Falls die stabile Env-Isolation Änderungen an der CI-Workflow-Datei benötigt,
  den bestehenden nativen Build-/Lock-Scope nicht erweitern.

## Tracker

Alle Aufgaben und Abhängigkeiten werden in Beads verfolgt. Der Epic ist
`fam-okaa`; die IDs dieses Plans verweisen auf die zugehörigen Aufgaben.
