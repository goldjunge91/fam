# Issue tracker: GitHub

Issues und Specs für dieses Repo leben als GitHub Issues. Für alle Operationen die `gh`-CLI verwenden.

## Conventions

- **Issue erstellen**: `gh issue create --title "..." --body "..."`. Für mehrzeilige Bodies ein Heredoc verwenden.
- **Issue lesen**: `gh issue view <number> --comments`, Kommentare per `jq` filtern und Labels mitziehen.
- **Issues listen**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` mit passenden `--label`- und `--state`-Filtern.
- **Kommentieren**: `gh issue comment <number> --body "..."`
- **Labels setzen/entfernen**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Schließen**: `gh issue close <number> --comment "..."`

Das Repo wird aus `git remote -v` abgeleitet; `gh` erkennt das automatisch innerhalb eines Clones (`goldjunge91/fam`).

## Pull Requests als Triage-Fläche

**PRs als Request-Fläche: nein.** _(Auf `yes` setzen, falls dieses Repo externe PRs als Feature-Requests behandelt; `/triage` liest dieses Flag.)_

Wenn auf `yes` gesetzt, laufen PRs durch dieselben Labels und States wie Issues, über die `gh pr`-Äquivalente:

- **PR lesen**: `gh pr view <number> --comments` und `gh pr diff <number>` für den Diff.
- **Externe PRs für Triage listen**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, dann nur `authorAssociation` von `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` oder `NONE` behalten (`OWNER`/`MEMBER`/`COLLABORATOR` verwerfen).
- **Kommentieren/Labeln/Schließen**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub teilt sich einen Nummernraum zwischen Issues und PRs, eine reine `#42` kann also beides sein: Auflösung per `gh pr view 42`, mit Fallback auf `gh issue view 42`.

## Wenn ein Skill sagt "im Issue-Tracker veröffentlichen"

Ein GitHub Issue erstellen.

## Wenn ein Skill sagt "das relevante Ticket holen"

`gh issue view <number> --comments` ausführen.

## Wayfinding-Operationen

Genutzt von `/wayfinder`. Die **Map** ist ein einzelnes Issue mit **Child**-Issues als Tickets.

- **Map**: ein Issue mit Label `wayfinder:map`, das den Notes/Decisions-so-far/Fog-Body hält. `gh issue create --label wayfinder:map`.
- **Child-Ticket**: ein mit der Map verknüpftes Issue als GitHub-Sub-Issue (`gh api` auf dem Sub-Issues-Endpoint). Wo Sub-Issues nicht aktiviert sind, das Child in eine Task-Liste im Map-Body aufnehmen und `Part of #<map>` an den Anfang des Child-Bodys setzen. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Nach Beanspruchung wird das Ticket dem durchführenden Dev zugewiesen.
- **Blocking**: GitHubs **native Issue-Dependencies**, die kanonische, UI-sichtbare Darstellung. Kante hinzufügen mit `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, wobei `<blocker-db-id>` die numerische **Database-ID** des Blockers ist (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _nicht_ die `#number` oder `node_id`). GitHub meldet `issue_dependencies_summary.blocked_by` (nur offene Blocker, das lebende Gate). Wo Dependencies nicht verfügbar sind, Fallback auf eine `Blocked by: #<n>, #<n>`-Zeile am Anfang des Child-Bodys. Ein Ticket ist entblockt, sobald jeder Blocker geschlossen ist.
- **Frontier-Query**: offene Children der Map listen (`gh issue list --state open`, begrenzt auf die Sub-Issues/Task-Liste der Map), jedes mit offenem Blocker verwerfen (`issue_dependencies_summary.blocked_by > 0`, oder ein offenes Issue in der `Blocked by`-Zeile) oder mit Assignee; das erste in Map-Reihenfolge gewinnt.
- **Claim**: `gh issue edit <n> --add-assignee @me`, der erste Write der Session.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, dann `gh issue close <n>`, dann einen Kontext-Pointer (Gist + Link) an die Decisions-so-far der Map anhängen.
