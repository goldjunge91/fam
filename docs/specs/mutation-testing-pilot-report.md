# Mutation-Testing-Pilot: Ergebnisbericht

## Lauf

- Datum: 2026-09-16
- Tool: StrykerJS `10.0.0`
- Runner: `@stryker-mutator/jest-runner@10.0.0`
- Testbasis: Jest aus `jest.config.js`
- Befehl: `bunx --no-install stryker run stryker.config.mjs`
- Scope: 2 Mutationsranges, 2 zugehörige Testdateien, 1 Worker
- Initiallauf: 21 Tests erfolgreich in 3 Sekunden
- Mutationslauf: 2 Minuten 45 Sekunden

## Ergebnis

| Kennzahl | Anzahl |
|---|---:|
| Mutanten gesamt | 8 |
| Getötet | 6 |
| Überlebt | 0 |
| No coverage | 0 |
| Fehler | 0 |
| Timeout | 2 |

Stryker meldet einen Mutation Score von 100 %. Dieser Score schließt
Timeout-Mutanten nicht in den Score-Nenner ein. Für die Qualitätsbewertung
werden die 2 Timeouts deshalb separat behandelt und nicht als bestandene
Mutanten gewertet.

## Klassifikation

### Getötete Mutanten: 6

- Auth: Entfernen bzw. Umkehren der Stable-Key-Prüfung und Ersetzen der
  Kleinschreibung wurden durch die bestehenden Auth-Domain-Tests erkannt.
- Sync: Die Backoff-Klammerung mit `DELAYS_MS.length + 1` wurde durch den
  Deckelungs-Test erkannt.

### Tool-Limit: 2 Timeouts

Beide offenen Mutanten liegen in `src/lib/sync/backoff.ts:7`:

- `Math.max(Math.max(attempts, 0), DELAYS_MS.length - 1)`
- `Math.min(attempts, 0)`

Sie waren durch die Backoff-Tests abgedeckt, aber der Jest-Runner beendete die
Mutantenläufe auch mit einem auf 30 Sekunden erhöhten Stryker-Timeout nicht als
getötete oder überlebende Mutanten. Es gibt damit keinen belastbaren Hinweis
auf einen fehlenden Assertion-Vertrag. Vor einem breiteren Pilot sollte dieses
Stryker-/Jest-Timeout-Verhalten separat untersucht werden.

## Entscheidung

- Mutation Testing bleibt ein fokussierter lokaler Pilot außerhalb des normalen
  CI-Unit-Gates.
- Die Stryker-Pakete sind als gepinnte Dev-Dependencies installiert, damit der
  Befehl ohne temporäre Mehrpaket-Auflösung reproduzierbar läuft.
- Der Scope wird nicht automatisch auf die gesamte Sync- oder Auth-Domäne
  erweitert. Weitere Bereiche erhalten zuerst eigene kleine, messbare Piloten.
- Es wird aus diesem Ergebnis kein CI-Mutationsgate abgeleitet, weil die zwei
  Backoff-Timeouts noch nicht geklärt sind und der Lauf lokal 2:45 Minuten
  dauerte.
