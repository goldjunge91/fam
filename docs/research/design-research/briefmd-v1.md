# Research Brief

**Wie kann die Verbindung zwischen Inventar und Einkaufsliste in einer mobilen Food-Management-App innovativ gestaltet werden, damit Haushalte ihre Lebensmittel übersichtlich verwalten, Einkäufe effizient planen und Lebensmittelverschwendung reduzieren können?**

**Question:** Führe eine ausführliche Webrecherche zur innovativen Neugestaltung von Inventar und Einkaufsliste einer mobilen Food-Management-App durch. Untersuche, wie beide Bereiche miteinander verbunden werden können: Produkte sollen nach dem Einkauf möglichst nahtlos aus der Einkaufsliste in das Inventar übernommen werden. Gleichzeitig soll das Inventar Informationen wie Mengen, Kategorien und Ablaufdaten liefern und daraus intelligente Empfehlungen für die nächste Einkaufsliste ableiten.

konkurrenz produkte sind unter anderem
KitchenPal
Your Food
PantryVault
NoWaste
zimmerfood

Analysiere Wettbewerber wie KitchenPal, Your Food, PantryVault, NoWaste und zimmerfood sowie weitere relevante Anwendungen. Untersuche deren UX-Patterns, visuelle Gestaltung, Produktübernahme, Kategorisierung, Ablaufdaten-Management und Verknüpfung zwischen Inventar und Einkaufsliste.

Entwickle zusätzlich innovative Konzepte aus anderen Bereichen, etwa visuelle Regale, smarte Empfehlungen, Gamification oder kontextbezogene Erinnerungen. Der Schwerpunkt liegt auf einer mobilen Nutzung für iOS und Android; eine responsive Webansicht ist sekundär. Das übergeordnete Ziel ist, Haushalte bei der Organisation ihrer Lebensmittel zu unterstützen und Lebensmittelverschwendung zu vermeiden.

## Scope & Constraints

- Welche UX- und UI-Patterns verwenden relevante Wettbewerber in ihren Inventaransichten?
- Welche Plattform(en) soll das neue Inventar-Design primär bedienen — Mobile (iOS/Android), Web-App, oder beides gleichzeitig? → Mobile-first, mit responsiver Web-Ansicht als sekundär
- Welche gemeinsamen Schwächen zeigen sich, beispielsweise flache Listen, geringe Sichtbarkeit von Ablaufdaten oder fehlende Kategorisierung?
- Was ist der primäre Nutzer-Job: Verbrauch tracken & Ablaufdaten managen, oder Einkaufslisten & Vorratshaltung planen? → die seite heisst aktuell vorrat soll quasi den haushalt darstellen und alle lebensmittel wiederspiegeln. wichtigste ist anti food waste
- Soll die Produkterfassung hauptsächlich über Barcode-Scan erfolgen, manuelle Eingabe, oder KI-gestützte Bilderkennung (z.B. Foto des Kühlschranks)? → eigentlich werden die produkte über die einkaufsliste nach einem einkauf übertragen werden.
- Welche innovativen Interaktionsmuster aus anderen Produktkategorien lassen sich auf Kühlschrank und Vorratskammer übertragen?
- Welche Designlösung eignet sich am besten für eine mobile-first Anwendung mit responsiver Webansicht?

**Sub-questions (authoritative checklist — answer each; do NOT invent your own initial set). Items tagged _(emergent)_ were discovered mid-research; items tagged _(user guidance)_ are directives the user added — follow them, even if phrased as an instruction rather than a question:**

- Welche UX-Patterns und visuellen Designs nutzen KitchenPal, Your Food, PantryVault, NoWaste und zimmerfood für ihre Inventaransicht — und wo liegen die gemeinsamen Schwachstellen (z.B. flache Listen, schlechte Ablaufdatum-Salienz, fehlende Kategorisierung)?
- Welche innovativen Inventar-Interaktionsparadigmen existieren außerhalb der Food-Kategorie (z.B. visuelle Regalansichten, Gamification, Ambient-Display-Konzepte), die auf einen Kühlschrank/Vorratskammer-Kontext übertragbar sind?

**Sources allowed:** any
**Max cycles:** 10

**Recursive exploration (emergent sub-questions):** As you research you will discover NEW high-value questions not in the initial list. Each cycle, in addition to your finding, you MAY propose follow-up sub-questions by writing `emergent_questions.json` in this dir as a JSON array: `[{"text": "...", "priority": 0.0-1.0}, ...]` where priority is how valuable / relevant the lead is to the main question. The system ranks them, admits the top few per round (a budget), de-duplicates against existing questions, and appends the winners to the checklist above (tagged _(emergent)_) for you to investigate in later cycles — so you can follow leads BEYOND the initial questions. Do NOT re-propose questions already on the checklist, and stop proposing once the main question is sufficiently answered (your Definition of Done / verification).

Each cycle, also read `guidance.txt` in this dir if present and follow any directive there (e.g. a FINALIZE MODE instruction to stop exploring and synthesize your final answer).

**Ending the run:** if you decide the research is finished (goal met or no productive work remains), FIRST write `worker_done.json` in this dir as `{"reason": "<one line>"}` — this is the durable signal that you ended the run on purpose if the source stop record is unavailable — and only THEN call `autonudge_stop`.

Adapt direction each cycle from prior findings; pursue the highest-value open lead toward the question.
