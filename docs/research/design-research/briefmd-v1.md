# Research Brief

**Question:** führe eine ausführliche websuche durch wie man das inventar design neu gestalten kann ich möchte etwas innovatives

konkurrenz produkte sind unter anderem
KitchenPal
Your Food
PantryVault
NoWaste
zimmerfood

es wird bestimmt mehr geben.

## Scope & Constraints

- Welche Plattform(en) soll das neue Inventar-Design primär bedienen — Mobile (iOS/Android), Web-App, oder beides gleichzeitig? → Mobile-first, mit responsiver Web-Ansicht als sekundär
- Was ist der primäre Nutzer-Job: Verbrauch tracken & Ablaufdaten managen, oder Einkaufslisten & Vorratshaltung planen? → die seite heisst aktuell vorrat soll quasi den haushalt darstellen und alle lebensmittel wiederspiegeln. wichtigste ist anti food waste
- Soll die Produkterfassung hauptsächlich über Barcode-Scan erfolgen, manuelle Eingabe, oder KI-gestützte Bilderkennung (z.B. Foto des Kühlschranks)? → eigentlich werden die produkte über die einkaufsliste nach einem einkauf übertragen werden.

**Sub-questions (authoritative checklist — answer each; do NOT invent your own initial set). Items tagged _(emergent)_ were discovered mid-research; items tagged _(user guidance)_ are directives the user added — follow them, even if phrased as an instruction rather than a question:**
- Welche UX-Patterns und visuellen Designs nutzen KitchenPal, Your Food, PantryVault, NoWaste und zimmerfood für ihre Inventaransicht — und wo liegen die gemeinsamen Schwachstellen (z.B. flache Listen, schlechte Ablaufdatum-Salienz, fehlende Kategorisierung)?
- Welche innovativen Inventar-Interaktionsparadigmen existieren außerhalb der Food-Kategorie (z.B. visuelle Regalansichten, Gamification, Ambient-Display-Konzepte), die auf einen Kühlschrank/Vorratskammer-Kontext übertragbar sind?

**Sources allowed:** any
**Max cycles:** 10

**Recursive exploration (emergent sub-questions):** As you research you will discover NEW high-value questions not in the initial list. Each cycle, in addition to your finding, you MAY propose follow-up sub-questions by writing `emergent_questions.json` in this dir as a JSON array: `[{"text": "...", "priority": 0.0-1.0}, ...]` where priority is how valuable / relevant the lead is to the main question. The system ranks them, admits the top few per round (a budget), de-duplicates against existing questions, and appends the winners to the checklist above (tagged _(emergent)_) for you to investigate in later cycles — so you can follow leads BEYOND the initial questions. Do NOT re-propose questions already on the checklist, and stop proposing once the main question is sufficiently answered (your Definition of Done / verification).

Each cycle, also read `guidance.txt` in this dir if present and follow any directive there (e.g. a FINALIZE MODE instruction to stop exploring and synthesize your final answer).

**Ending the run:** if you decide the research is finished (goal met or no productive work remains), FIRST write `worker_done.json` in this dir as `{"reason": "<one line>"}` — this is the durable signal that you ended the run on purpose if the source stop record is unavailable — and only THEN call `autonudge_stop`.

Adapt direction each cycle from prior findings; pursue the highest-value open lead toward the question.