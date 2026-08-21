/**
 * Zutaten-Erwähnungen im Zubereitungstext: `@Name`, optional direkt gefolgt
 * von einer Zahl (`@Wurst50`) für die verbrauchte Menge in der Einheit
 * dieser Zutat — nie hart codiert als Gramm, die Einheit kommt immer aus der
 * jeweiligen Zutat. Bewusst nur `@` als Auslöser (kein zusätzliches `#`):
 * `#` ist im Rezept-Wizard schon für Hashtags belegt (siehe
 * recipe-wizard-step-basics.tsx), ein zweiter Auslöser wäre nur zusätzliche
 * Mehrdeutigkeit ohne echten Zusatznutzen. Ersetzt im Rezept-Wizard die
 * manuelle Chip-Auswahl unter den Schritten; Anzeige (Wizard-Vorschau,
 * Rezept-Detail, Kochmodus) zeigt nie die rohe `@`-Syntax, sondern immer den
 * aufgelösten Klartext ("50g Wurst").
 */

export interface MentionableIngredient {
  /** `IngredientItem.id` im Wizard bzw. `recipe_component_items.id` nach dem Speichern. */
  itemId: string;
  name: string;
  unit: string;
  /** Eingetragene Gesamtmenge dieser Zutat, Nenner für den Verbrauchsfortschritt. */
  quantity: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Baut das Erwähnungs-Muster pro Aufruf aus den bekannten Zutatennamen statt
 * generisch nur "ein Wort" zu erlauben — sonst würde ein mehrteiliger Name
 * wie "Haferflocken kernig" schon an der Leerstelle abreißen. Bekannte Namen
 * (längste zuerst, damit ein kürzerer Name keinen längeren vorzeitig
 * abschneidet) haben Vorrang; ein einzelnes unbekanntes Wort bleibt als
 * Fallback erkennbar, damit Tippfehler weiterhin als "unresolved" markiert
 * werden können. `(?![\p{L}])` verhindert, dass ein bekannter Name nur
 * Präfix eines längeren, unbekannten Worts ist (z. B. "Zwiebel" in
 * "Zwiebeltopf").
 */
function buildMentionPattern(ingredients: MentionableIngredient[]): RegExp {
  const known = ingredients.map((i) => escapeRegExp(i.name)).sort((a, b) => b.length - a.length);
  const knownAlternatives = known.length > 0 ? `(?:${known.join('|')})(?![\\p{L}])` : '(?!)';
  return new RegExp(`@(${knownAlternatives}|[\\p{L}]+)(\\d{1,4})?`, 'giu');
}

/**
 * Baut die erwaehnbaren Zutaten aus geladenen `recipe_component_items` +
 * `productsById` (siehe `RecipeDetail` in use-recipes.ts) — gemeinsame
 * Grundlage fuer Rezept-Detail und Kochmodus, die Erwaehnungen nur lesen statt
 * (wie der Wizard) auch zu bearbeiten.
 */
export function flattenRecipeItems(
  items: readonly {
    id: string;
    product_id: string | null;
    unit: string;
    quantity: number | null;
  }[],
  productsById: ReadonlyMap<string, { name: string }>,
): MentionableIngredient[] {
  const result: MentionableIngredient[] = [];
  for (const item of items) {
    const product = item.product_id ? productsById.get(item.product_id) : undefined;
    if (!product) continue;
    result.push({
      itemId: item.id,
      name: product.name,
      unit: item.unit,
      quantity: item.quantity ?? 0,
    });
  }
  return result;
}

export function findMentionableIngredient(
  ingredients: MentionableIngredient[],
  name: string,
): MentionableIngredient | undefined {
  const lower = name.toLowerCase();
  return ingredients.find((i) => i.name.toLowerCase() === lower);
}

export type MentionSegmentKind = 'text' | 'resolved' | 'unresolved';

export interface MentionSegment {
  key: string;
  kind: MentionSegmentKind;
  /** Anzuzeigender Text — bei `resolved` bereits der Klartext ("50g Wurst"), nie die rohe Syntax. */
  text: string;
}

/** Zerlegt einen Schritttext in Klartext- und Erwähnungs-Abschnitte für die Anzeige. */
export function splitStepMentions(
  text: string,
  ingredients: MentionableIngredient[],
): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(buildMentionPattern(ingredients))) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      segments.push({ key: `t${key++}`, kind: 'text', text: text.slice(lastIndex, matchIndex) });
    }
    const ingredient = findMentionableIngredient(ingredients, match[1]);
    if (ingredient) {
      const label = match[2] ? `${match[2]}${ingredient.unit} ${ingredient.name}` : ingredient.name;
      segments.push({ key: `m${key++}`, kind: 'resolved', text: label });
    } else {
      segments.push({ key: `m${key++}`, kind: 'unresolved', text: match[0] });
    }
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ key: `t${key++}`, kind: 'text', text: text.slice(lastIndex) });
  }
  return segments;
}

/** Aufgeloester Klartext als reiner String, ohne Segment-Styling — fuer Stellen, die nur Text (keine JSX) brauchen, z. B. eine gekuerzte Kochmodus-Ueberschrift. */
export function renderMentionPlainText(text: string, ingredients: MentionableIngredient[]): string {
  return splitStepMentions(text, ingredients)
    .map((segment) => segment.text)
    .join('');
}

/** Summiert die in allen Schritttexten erwähnten Mengen je Zutat, gedeckelt auf die Gesamtmenge. */
export function computeMentionUsage(
  stepsText: string[],
  ingredients: MentionableIngredient[],
): Map<string, number> {
  const used = new Map<string, number>(ingredients.map((i) => [i.itemId, 0]));
  const pattern = buildMentionPattern(ingredients);
  for (const text of stepsText) {
    for (const match of text.matchAll(pattern)) {
      if (!match[2]) continue;
      const ingredient = findMentionableIngredient(ingredients, match[1]);
      if (!ingredient) continue;
      const current = used.get(ingredient.itemId) ?? 0;
      used.set(ingredient.itemId, Math.min(ingredient.quantity, current + Number(match[2])));
    }
  }
  return used;
}

/** IDs der im Text tatsächlich erwähnten Zutaten — hält `WizardStepItem.ingredientIds` mit dem Fließtext synchron. */
export function mentionedIngredientIds(
  text: string,
  ingredients: MentionableIngredient[],
): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(buildMentionPattern(ingredients))) {
    const ingredient = findMentionableIngredient(ingredients, match[1]);
    if (ingredient) ids.add(ingredient.itemId);
  }
  return Array.from(ids);
}

/**
 * Erkennt eine gerade getippte, noch unvollständige Erwähnung am Textende
 * (z. B. `"...und die @Hafer"` oder mehrteilig `"...die @Haferflocken kern"`)
 * — Grundlage für das Autovervollständigungs-Menü. Erlaubt Leerzeichen in der
 * Abfrage, damit mehrteilige Zutatennamen ("Haferflocken kernig") nicht schon
 * an der ersten Leerstelle abreißen; auf 40 Zeichen gedeckelt, damit keine
 * ganzen nachfolgenden Satzteile ohne Ziffer/Satzzeichen mit erfasst werden.
 * Bewusst nur am Textende statt an der Cursor-Position: `TextInput` in React
 * Native liefert die Cursor-Position nicht zuverlässig plattformübergreifend
 * per `onChangeText`, lineares Tippen am Ende deckt den Regelfall ab.
 */
export function matchPendingMention(text: string): { query: string } | null {
  const match = text.match(/@([\p{L}][\p{L} ]{0,39})?$/u);
  if (!match) return null;
  return { query: match[1] ?? '' };
}
