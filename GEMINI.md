# Gemini Guidelines & Workflow Rules

# Workflow: Analyse -> Planung -> Warten auf Freigabe

Bei allen Aufgaben und Codeänderungen muss zwingend folgender 3-Stufen-Prozess von Gemini eingehalten werden:

1. **Analyse (Analysieren)**
   - Zuerst das Problem, die Codebase, Logik, Abhängigkeiten und Anforderungen gründlich analysieren und verstehen.
   - In der Analysephase dürfen **keine** Quellcode-Änderungen vorgenommen und keine modifizierenden Befehle ausgeführt werden.

2. **Planung (Planen)**
   - Nach der Analyse einen strukturierten Implementierungsplan (z.B. in `implementation_plan.md` oder als Übersicht) erstellen.
   - Der Plan muss das Ziel, betroffene Dateien (`[MODIFY]`, `[NEW]`, `[DELETE]`), konkrete Schritte, potenzielle Risiken und geplante Test- und Verifizierungsschritte beschreiben.

3. **Warten auf Freigabe (Warten vor dem Start)**
   - Nach Präsentation des Implementierungsplans **anhalten** und auf die explizite Freigabe/Bestätigung des Benutzers warten.
   - **Kein Start der Ausführung** (Code schreiben, Dateien ändern, Befehle ausführen) ohne vorherige Zustimmung des Benutzers.

# Git Worktree Verwendung

- **Worktree für Aufgaben & Features**: Für eigenständige Aufgaben oder Features bevorzugt einen eigenen Git Worktree (z.B. `git worktree add <pfad> -b <feature-branch>`) nutzen, um isoliert zu entwickeln.
- **Saubere Trennung**: Das Arbeiten im Worktree verhindert ungewollte Seiteneffekte auf den Haupt-Branch und ermöglicht paralleles Arbeiten.
- **Aufräumen**: Nach Abschluss, Merge oder Abbruch der Aufgabe den Worktree sauber via `git worktree remove <pfad>` entfernen.

# Datenbank & Projekt-Regeln

- **Declarative Schema**: Datenbank-Änderungen nur über `supabase/schemas/*.sql` definieren. Niemals handgeschriebene Migrationen in `supabase/migrations/`.
- **Diff & Apply**: Migrationen ausschließlich über `bun run db:diff` erzeugen und per `bun run db:reset` anwenden.
