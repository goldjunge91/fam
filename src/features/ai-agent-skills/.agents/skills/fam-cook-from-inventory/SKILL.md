---
name: fam-cook-from-inventory
description: Erzeugt höchstens drei strukturierte Kochvorschläge aus den vom Gateway gelesenen verderblichen Inventar-Lots bei einer Kochabsicht; nicht für freie Zutatenerfassung, Produktsuche oder Bestandsänderungen.
---

# Fam: Kochen aus dem Inventar

Nutze diesen Skill nur, wenn der Nutzer eine Mahlzeitidee oder ein Rezept aus
dem aktuellen Bestand möchte, zum Beispiel „Was kann ich heute kochen?“. Der
Nutzertext liefert ausschließlich Absicht und optionale Einschränkungen.

## Ablauf

1. Lies den autorisierten, tenant-scoped Inventar-Kontext über den Gateway.
   Verderbliche Lots stammen ausschließlich aus diesem Kontext, nie aus dem
   freien Text oder aus einer Modellannahme.
2. Wende Allergien als harten Ausschluss an. Filtere außerdem, soweit bekannt,
   Ernährungsform, Zeit und Portionen.
3. Suche ausschließlich in der freigegebenen Rezeptbasis und wähle
   deterministisch höchstens drei Kandidaten.
4. Formuliere strukturierte Vorschläge im Vertrag
   `cooking_suggestion.v1`.
5. Validiere Schema, Rezeptreferenz und jede `usedLots`-ID nach der
   Modellantwort. Bei einem Fehler liefere einen strukturierten Fehlerzustand,
   keine freie Ersatzantwort.

## Grenzen

- Keine Datenbankmutation, kein SQL- oder Service-Role-Tool und keine freie
  Websuche.
- Fehlende Zutaten gehören in `missingIngredients`; sie dürfen nicht als
  vorhandener Bestand ausgegeben werden.
- `recipeId` muss aus der Rezeptbasis stammen. `usedLots` darf nur Lot-IDs aus
  dem Gateway-Kontext enthalten und keine ID doppelt nennen.
- Höchstens drei Vorschläge. Bei unvollständigem Kontext höchstens eine
  fokussierte Rückfrage oder ein `unknown` im passenden Constraint-Feld.
- Private Trackingdaten bleiben vollständig außerhalb des Kontexts.

Lies für den exakten Vertrag und die Negativbeispiele
[references/contract.md](references/contract.md) und
[references/examples.md](references/examples.md). Die ausführbare
Post-Validation liegt in
`src/features/ai-agent-skills/domain/cooking-validation.ts`.