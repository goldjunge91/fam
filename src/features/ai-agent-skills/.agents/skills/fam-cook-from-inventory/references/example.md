# Beispiele: `fam-cook-from-inventory`

## Gültiger Kontextbezug

Der Nutzer fragt: „Was kann ich heute kochen?“ Der Gateway liefert die Lots
`lot-tomato` und `lot-spinach`. Ein Vorschlag darf diese IDs in `usedLots`
referenzieren. Benötigte Eier, die nicht im Kontext stehen, erscheinen in
`missingIngredients`.

## Ungültige Antworten

- `usedLots: ["lot-mushroom"]`, wenn diese ID nicht im Gateway-Kontext steht.
- Eine Zutat als vorhanden beschreiben, nur weil sie im Nutzertext genannt
  wurde.
- Allergie „Erdnüsse“ ignorieren oder `allergies: 'unknown'` ausgeben.
- Ein Rezept mit einer erfundenen oder nicht vorhandenen `recipeId` ausgeben.
- Mehr als drei Vorschläge oder eine direkte Bestandsmutation ausführen.