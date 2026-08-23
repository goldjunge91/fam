/**
 * Normalisiert einen Freitext-Artikelnamen zu `normalized_key_value` fuer
 * `key_type = 'name'`. Getrimmt, kleingeschrieben, mehrfache Leerzeichen zu
 * einem kollabiert — genau die Invariante, die sowohl `preference-identity.ts`
 * (`normalizedKeyValue === normalizedKeyValue.trim().toLowerCase()`) als auch
 * der lokale SQLite-Check-Constraint auf `shopping_category_preferences`
 * voraussetzen.
 *
 * Bewusst keine Tokenisierung und kein Diakritika-/Bindestrich-Stripping wie
 * `classification/normalize-shopping-name.ts`: dort geht es um Matching-Tokens
 * fuer Regeln, hier um eine einzige stabile Identitaet fuer "derselbe Name,
 * anders getippt" ("Hafermilch" == " HaferMilch " == "Hafer  milch").
 */
export function normalizePreferenceName(rawName: string): string {
  return rawName.trim().toLowerCase().replace(/\s+/g, ' ');
}
