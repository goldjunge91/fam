# Umsetzungsplan: Rezeptvorschläge aus dem Haushaltsbestand

## 1. Verbindliche Quelle und Scope

Die kanonische fachliche Quelle für diesen Plan ist:

[`docs/specs/fam-agent-skills.md`](../docs/specs/fam-agent-skills.md)

Diese Spezifikation wird jetzt überarbeitet und bleibt dabei die einzige
fachliche Quelle der Wahrheit. Die kompakte Datei
[`docs/referenced-chatgpt-conversation-this-is-an/work/ai-rezeptvorschlaege-kompakt.md`](../docs/referenced-chatgpt-conversation-this-is-an/work/ai-rezeptvorschlaege-kompakt.md)
war redaktionelle Arbeitsgrundlage für die Überarbeitung, ist aber nicht
normativ.

Dieser Plan umfasst genau einen read-only Produkt-Workflow:

`fam-cook-from-inventory`

Er hat zwei Auslöser, aber dieselbe fachliche Pipeline:

1. Der Nutzer nennt vorhandene Lebensmittel. Der Text ist nur ein Intent-
   Trigger. Die Lebensmittel und Mengen kommen ausschließlich aus dem
   autorisierten Inventar.
2. Der Nutzer fragt sinngemäß „Was kann ich heute kochen/essen?“. Die App
   berechnet die Nutzungspriorität aus dem autoritativen Zustand und übergibt
   nur den relevanten Ausschnitt.

Nicht Bestandteil dieses Plans:

- natürliche Inventarerfassung, OCR, Bild, Barcode oder Sprache;
- Produktsuche oder Einkaufslisten-Klassifikation;
- automatische Bestands-, Einkaufs- oder sonstige Mutationen;
- ein autonomer Agent, ein eigener Runner, eine eigene Run-Datenbank oder
  eine neue generische Plattform;
- Phase-3/4-Themen wie Belegimport oder Vision.

`tools/category-debugger` bleibt ein unabhängiges Werkzeug. Es ist weder Abhängigkeit noch Testziel dieses
Plans. Alle anderen vorhandenen Einträge unter `/tools/` sind ebenfalls
außerhalb des Scopes. Einzige Ausnahme ist der ausdrücklich dafür vorgesehene
Eval-Workspace `tools/llm-test-platform`.

## 2. Nicht verhandelbare fachliche Regeln

### Verantwortungsgrenze

App und Backend halten den Zustand und entscheiden deterministisch:

1. Rezept-Intent routen.
2. Tenant-scoped Inventar- und Nutzerdaten lesen.
3. Lebensmittel, Einheiten, Mengen und Zustände normalisieren.
4. MHD, Öffnungsstatus, Verfügbarkeit und Lebensmittelsicherheit prüfen.
5. Allergien als harte Ausschlussregel anwenden.
6. Personenanzahl und verfügbare Mengen berücksichtigen.
7. `priority_score` berechnen und priorisierte verderbliche Lots auswählen.
8. Den Einkaufslistenstatus behandeln:
   - leer: keine Einkaufsrückfrage;
   - nicht leer: fragen, ob heute eingekauft wird;
   - bei Zustimmung: Artikel nur als `planned_shopping_items` führen;
   - niemals geplante Artikel als bereits vorhandenen Bestand behandeln.
9. Zuerst passende vorhandene Rezepte suchen.
10. Höchstens drei Kandidaten an den Modellkontext geben.
11. Den minimalen JSON-Kontext erzeugen.
12. Die Modellantwort gegen Schema und Domänenregeln validieren.
13. Erst nach expliziter Nutzerentscheidung den bestehenden Mutationspfad
    verwenden.

Das Modell darf aus dem geprüften Kontext Titel, Zutatenhinweise, Schritte und
bis zu drei Mahlzeiten formulieren. Es darf keinen Bestand erfinden, Allergien
oder Sicherheit entscheiden, Rezeptreferenzen austauschen oder schreiben.

### Structured-Output-Vertrag

Die technische Antwort ist versioniertes JSON, kein reparierter Freitext:

```json
{
  "schema_version": 1,
  "meals": [
    {
      "title": "Spinat-Tomaten-Pasta",
      "source": "catalog",
      "recipe_id": "recipe-123",
      "servings": 3,
      "used_items": [
        { "inventory_item_id": "inventory-1", "quantity": 3, "unit": "Stück" }
      ],
      "additional_ingredients": [],
      "steps": ["..."],
      "notes": []
    }
  ]
}
```

Harte Regeln:

- `meals` enthält 1 bis 3 Einträge;
- `source` ist `catalog` oder `model_generated`;
- `recipe_id` ist bei `model_generated` `null`;
- jede `inventory_item_id` stammt aus dem geprüften Kontext;
- zusätzliche Zutaten kommen ausschließlich aus einer expliziten Allowlist;
- Allergien, Verfügbarkeit und Lot-Zuordnung werden vor und nach dem
  Modellaufruf geprüft;
- ungültige Antworten werden verworfen und nicht heuristisch repariert;
- keine Antwort löst selbst eine Mutation aus.

## 3. Aktueller Stand, korrekt eingeordnet

| Bereich | Stand | Aussage |
| --- | --- | --- |
| Fachliche Quelle | überarbeitet | `docs/specs/fam-agent-skills.md` ist die kanonische Quelle; die kompakte Datei war nur redaktionelle Arbeitsgrundlage. |
| App-Verträge/Gateway | vorhanden, zu härten | Read-only Gateway und typisierter Client existieren; Validator-Parität und fail-closed Modellkonfiguration müssen noch geprüft werden. |
| Lokale Evals | vorhanden | Promptfoo-Fixtures und deterministische Gates sind vorhanden. |
| Sechs-Modell-Lauf | Diagnose, keine Freigabe | 24 Requests, 18 bestanden, 6 Befunde, 28.522 Tokens. Zwei Befunde sind semantisch; vier betreffen leere/abgeschnittene strukturierte Ausgaben mit noch offener Ursachenklassifikation. |
| Deno-Handler | bestanden | Windows-Lauf: 9/9 Tests grün. Der gleiche Befehl bleibt macOS/CI-Gate. |
| Manuelle Zeitmessung | verworfen/deferiert | Der JSON-Terminal-Timer misst keine reale Produktinteraktion und ist kein Phase-0-Nachweis. Eine echte Messung gehört frühestens in eine spätere Produktvalidierung. |
| `fam-cook-from-inventory` | noch nicht als vollständiger Produktfluss abgenommen | Deterministische Adapter und Teile der Validierung sind vorhanden; Kontextpipeline, Gateway-Parität und App-Review müssen als zusammenhängender Ablauf geschlossen werden. |

Die Matrix ist damit ein Fehler- und Konfigurationssignal, keine
Produktionsrangliste. Vor einer Modellpromotion müssen die effektive
Request-Konfiguration, `finish_reason`, Tokenaufteilung, Retry-Anzahl,
Provider-/Modellmetadaten sowie Prompt-/Config-Hashes reproduzierbar gespeichert
werden. Eine zweite Vollmatrix ist nicht der nächste Schritt.

## 4. Arbeitsplan

### Arbeitspaket A: Quelle und Verträge bereinigen

**Ziel:** `docs/specs/fam-agent-skills.md` enthält einen konsistenten,
umsetzbaren Vertrag für den kleinen Rezeptvorschlags-Scope.

**Akzeptanz:**

- nur `fam-cook-from-inventory` bleibt in diesem Workflow;
- die beiden Einstiege liefern denselben `recipe_suggestion`-Pfad;
- Rohtexte werden nicht als Lebensmittelquelle verwendet;
- der Structured-Output-Vertrag ist versioniert und dokumentiert;
- alte Capture-Annahmen sind aus diesem Plan und den zugehörigen Phase-
  1-Gates entfernt.

**Prüfung:** Contract- und Domain-Tests für Katalogquelle, Fallbackquelle,
`recipe_id`, `used_items`, 1–3 Mahlzeiten und Null-Mutationspfad.

**Dateien/Verantwortung:**

- `src/features/ai-agent-skills/domain/`
- `src/features/ai-agent-skills/` zugehörige Verträge und Tests
- `docs/specs/fam-agent-skills.md`
- `docs/specs/fam-agent-skills-phase0-baseline.md` nur, wenn die technische
  Befundklassifikation korrigiert werden muss

**Abhängigkeit:** keine.

### Arbeitspaket B: Deterministische Kontextpipeline

**Ziel:** Derselbe geprüfte Haushaltszustand erzeugt denselben minimalen
Modellkontext.

**Akzeptanz:**

- aktive, tenant-scoped verderbliche Lots werden aus dem Inventar gelesen;
- abgelaufene, nicht verfügbare und allergene Lots sind ausgeschlossen;
- `priority_score` ist eine reine, separat testbare Regel;
- Personenanzahl, Mengen, Öffnungsstatus und Nutzerrestriktionen wirken vor
  dem Modellaufruf;
- passende Katalogrezepte werden vor einem generativen Fallback gesucht;
- der Kontext enthält nur `request`, `constraints`, `priority_foods`,
  `planned_shopping_items` und `candidate_recipes`;
- Einkaufslistenartikel bleiben klar vom Bestand getrennt.

**Prüfung:** deterministische Domain-Tests mit identischem Zustand, Ablauf-
und Prioritätsfällen, Allergie-Negativfällen sowie leerer/nichtleerer
Einkaufsliste.

**Dateien/Verantwortung:**

- `src/features/ai-agent-skills/domain/context*`
- `src/features/ai-agent-skills/domain/priority*`
- tenant-scoped Inventar-/Rezeptadapter und fokussierte Tests

**Abhängigkeit:** Arbeitspaket A.

### Arbeitspaket C: Ein strenger Validator für Gateway und Evals

**Ziel:** Produktionspfad und Testplattform beurteilen dieselben Invarianten.

**Akzeptanz:**

- ein gemeinsames oder inhaltlich identisches Schema validiert die Gateway-
  Antwort und die Promptfoo-Auswertung;
- Katalogtitel/-zutaten, Fallbackregel, `used_items`, Mengen, Servings,
  `additional_ingredients` und Allergene werden geprüft;
- fremde Lot-/Rezept-IDs werden fail-closed abgelehnt;
- `toolTrace`/Allowlist-Daten werden nicht nur vom Testfall behauptet,
  sondern der Prüfpfad erhält nachweisbare Gateway-Evidenz;
- ungültiges JSON, fremdes Modell, Timeout und Rate Limit liefern strukturierte
  Fehler und keinen Fallback-Text.

**Prüfung:** Handler-Tests für jede aktuelle Fehlerklasse sowie lokale Evals,
deren Assertions fehlende Felder, Mengen, Rezeptgrundlage und Allergene
explizit prüfen.

**Dateien/Verantwortung:**

- `src/features/ai-agent-skills/domain/validation*`
- `supabase/functions/ai-gateway/handler.ts`
- `supabase/functions/ai-gateway/handler_test.ts`
- `tools/llm-test-platform/assertions/` und die scoped Fixtures

**Abhängigkeit:** Arbeitspakete A und B.

### Arbeitspaket D: Eval-Harness und kostensparende Modellentscheidung

**Ziel:** Die sechs Modelle werden reproduzierbar beurteilt, ohne blind weitere
Vollmatrizen zu bezahlen.

**Akzeptanz:**

- jede Auswertung speichert effektive Modell-/Endpoint-Konfiguration,
  Structured-Output-Modus, Reasoning-Einstellungen, Tokenaufteilung,
  `finish_reason`, Retry-Anzahl sowie Prompt-/Config-Hashes;
- Modell-Aliase und Endpoint-Fähigkeiten werden vor einem bezahlten Retest
  geprüft;
- nur betroffene Modell/Fixture-Paare werden gezielt wiederholt;
- semantische Fehler und Ausgabestabilitäts-/Budgetfehler bleiben getrennt;
- ein produktiver Default ist explizit konfiguriert und darf nicht auf einem
  ungeprüften Modell liegen;
- keine Modellpromotion allein aus einem einzelnen 4-Fixture-Lauf.

**Prüfung:** maximal zwölf gezielte Anfragen nach kostenlosem Capability-Check;
lokaler Replay, soweit möglich; Report mit Rohantwort-/Provenance-Verweis und
klarer Entscheidung `candidate`, `blocked` oder `needs-more-evidence`.

**Dateien/Verantwortung:**

- `tools/llm-test-platform/promptfooconfig.openrouter.yaml`
- `tools/llm-test-platform/assertions/`
- `tools/llm-test-platform/tests/`
- `tools/llm-test-platform/scripts/` für PowerShell und Bash
- `docs/specs/fam-agent-skills-phase0-baseline.md`

**Abhängigkeit:** Arbeitspaket C.

### Arbeitspaket E: Read-only Gateway und App-Review schließen

**Ziel:** Der reale App-Fluss nutzt ausschließlich den geprüften Kontext und
zeigt eine Vorschlagskarte, bevor irgendeine Mutation möglich ist.

**Akzeptanz:**

- Authentifizierung, Haushaltsmitgliedschaft und Rate Limit werden vor
  Kontext-/Providerzugriff geprüft;
- das Gateway liest nur erlaubte, aktive, verderbliche Lots;
- die Modell-Allowlist und das Default-Modell sind explizit, fail-closed und
  per Umgebung konfiguriert;
- die App zeigt 1–3 geprüfte Vorschläge inklusive Herkunft (`catalog` oder
  `model_generated`);
- erst eine explizite Nutzeraktion erreicht den normalen lokalen
  Mutations-/Outbox-Pfad;
- Offline-/Outbox-Verhalten wird nicht durch das read-only Gateway umgangen.

**Prüfung:** Deno-Handler-Suite auf Windows und macOS/CI, fokussierte App-
Tests, Typecheck und ein manueller Review des bestätigungsfreien Pfads.

**Dateien/Verantwortung:**

- `supabase/functions/ai-gateway/`
- `src/features/ai-agent-skills/gateway.ts`
- zugehörige App-Screens/Hook-Integration nach bestehender Feature-First-
  Struktur

**Abhängigkeit:** Arbeitspakete A–D.

### Arbeitspaket F: Produktmessung erst nach funktionierendem Flow

**Ziel:** Falls Geschwindigkeit als Produktziel bewertet werden soll, wird die
reale Aufgabe gemessen und nicht JSON abgetippt.

**Akzeptanz:**

- Messbeginn ist die sichtbare Aufgabe, nicht eine technische Startbestätigung;
- Messende ist die fertige, geprüfte Vorschlagsanzeige;
- drei Personen-/Durchlaufmessungen sind ohne Copy/Paste und mit dokumentierter
  Korrektur-/Review-Regel reproduzierbar;
- die Messung umfasst die tatsächliche App-Interaktion und wird getrennt von
  Providerkosten ausgewertet.

**Prüfung:** erst nach Abschluss von Arbeitspaket E; kein Phase-0-Gate.

**Abhängigkeit:** Arbeitspaket E. Der vorhandene JSON-Timer bleibt höchstens
ein technischer Smoke-Test.

## 5. Gates und Reihenfolge

```text
A Verträge
  -> B deterministischer Kontext
    -> C Validator-Parität
      -> D gezielte Modelldiagnose
        -> E Gateway/App-Review
          -> F optionale Produktmessung
```

### Phase 0: Verträge und technische Messbarkeit

Phase 0 ist abgeschlossen, wenn A–C umgesetzt und geprüft sind, die Deno-
Handler-Suite auf Windows sowie in macOS/CI reproduzierbar läuft und der
vorhandene Matrixlauf als Diagnose mit korrekter Fehlerklassifikation
archiviert ist. Eine vollständige Modellfreigabe und eine menschliche
Erfassungszeit gehören nicht zur Abnahme von Phase 0.

### Phase 1: Read-only Rezeptvorschläge

Phase 1 beginnt erst nach dem Phase-0-Gate. Sie umfasst D und E: gezielte
Modellpromotion, der echte Gateway-Aufruf, App-Anzeige und Bestätigung vor
Mutation.

### Phase 2: Produktvalidierung

Erst hier wird F ausgeführt. Die Messung beantwortet eine Produktfrage und
ändert nicht die fachliche Wahrheit des Inventars.

## 6. Verifikation

Nur betroffene Prüfungen ausführen:

```powershell
cd C:\GIT\fam
bun run typecheck
bun run test src/features/ai-agent-skills
deno test --allow-net supabase/functions/ai-gateway/handler_test.ts
```

Lokale Eval-Suite ohne Providerzugriff:

```powershell
cd C:\GIT\fam\tools\llm-test-platform
.\scripts\promptfoo.ps1 eval -c promptfooconfig.fam-phase0.yaml --no-cache -j 1
```

Die kostenpflichtige OpenRouter-Auswertung läuft nur nach Arbeitspaket D und
nicht automatisch. PowerShell- und Bash-Launcher bleiben als gleichwertige
Ausführungswege erhalten; kein Launcher darf ein anderes Testset oder einen
anderen Scope implizit starten.

## 7. Offene Entscheidungen vor Phase 1

Nur diese Punkte benötigen noch eine fachliche Entscheidung:

1. Welche autoritative Rezeptbasis wird für `candidate_recipes` verwendet?
2. Welche Grundzutaten gehören initial in `allowed_staples`?
3. Ist ein generativer Fallback bei null Katalogtreffern zum Start erlaubt,
   oder wird zunächst nur der Katalogpfad freigegeben?

Diese Entscheidungen ändern nicht die Verantwortungsgrenze: Bestand,
Sicherheit, Priorisierung und Mutationen bleiben deterministisch und außerhalb
des Modells.
