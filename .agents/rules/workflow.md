# Workflow: Analyse -> Planung -> Warten auf Freigabe

Bei allen Aufgaben und Codeänderungen muss zwingend folgender 3-Stufen-Prozess eingehalten werden:

1. **Analyse (Analysieren)**
   - Vor allen Änderungen das Problem, die Codebase, bestehende Logik, Abhängigkeiten und Anforderungen gründlich untersuchen.
   - In der Analysephase dürfen **keine** Quellcode-Änderungen vorgenommen und keine modifizierenden Befehle ausgeführt werden.

2. **Planung (Planen)**
   - Einen detaillierten und strukturierten Implementierungsplan (z.B. in `implementation_plan.md` oder in der Chat-Antwort) erstellen.
   - Der Plan muss das Ziel, betroffene Komponenten/Dateien (`[MODIFY]`, `[NEW]`, `[DELETE]`), die konkrete Vorgehensweise, Risiken und geplante Tests enthalten.

3. **Warten auf Freigabe (Warten vor dem Start)**
   - Nach Präsentation des Plans **stoppen** und auf die explizite Freigabe/Bestätigung des Benutzers warten.
   - **Keine Ausführung oder Codeänderungen** starten, bevor der Benutzer den Plan genehmigt hat.

## Git Worktree Nutzung
- Für eigenständige Aufgaben/Features bevorzugt einen eigenen Git Worktree (z.B. `git worktree add <pfad> -b <feature-branch>`) anlegen und darin arbeiten.
- Verhindert ungewollte Modifikationen am Haupt-Branch und hält den Arbeitsbereich isoliert.
- Nach Fertigstellung den Worktree sauber via `git worktree remove <pfad>` entfernen.
