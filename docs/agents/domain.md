# Domain Docs

Wie die Engineering-Skills die Domain-Dokumentation dieses Repos beim Erkunden der Codebasis konsumieren sollen.

## Vor dem Erkunden lesen

- **`CONTEXT.md`** im Repo-Root, oder
- **`CONTEXT-MAP.md`** im Repo-Root, falls vorhanden: verweist auf je ein `CONTEXT.md` pro Context. Jedes lesen, das zum Thema relevant ist.
- **`docs/adr/`**: ADRs lesen, die den Bereich betreffen, an dem gerade gearbeitet wird. In Multi-Context-Repos zusätzlich `src/<context>/docs/adr/` für context-spezifische Entscheidungen prüfen.

Falls eine dieser Dateien nicht existiert, **stillschweigend fortfahren**. Ihr Fehlen nicht anmerken, ihre Erstellung nicht vorab vorschlagen. Der `/domain-modeling`-Skill (erreicht über `/grill-with-docs` und `/improve-codebase-architecture`) erstellt sie lazy, sobald Begriffe oder Entscheidungen tatsächlich aufgelöst werden.

## Dateistruktur

Single-Context-Repo (dieses Repo):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-....md
│   └── 0002-....md
└── src/
```

## Vokabular des Glossars verwenden

Wenn Output einen Domain-Begriff benennt (in einem Issue-Titel, einem Refactor-Vorschlag, einer Hypothese, einem Testnamen), den in `CONTEXT.md` definierten Begriff verwenden. Nicht zu Synonymen abdriften, die das Glossar explizit vermeidet.

Falls das benötigte Konzept noch nicht im Glossar steht, ist das ein Signal: entweder wird Sprache erfunden, die das Projekt nicht nutzt (überdenken), oder es gibt eine echte Lücke (für `/domain-modeling` notieren).

## ADR-Konflikte melden

Falls Output einer bestehenden ADR widerspricht, dies explizit aufzeigen statt still zu überschreiben:

> _Widerspricht ADR-0007 (…), aber wert, neu aufzurollen, weil…_
