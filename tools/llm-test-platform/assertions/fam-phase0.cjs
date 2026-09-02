const CAPTURE_KEYS = ["kind", "items", "questions", "warnings"];
const CAPTURE_ITEM_KEYS = [
  "rawText",
  "normalizedName",
  "quantity",
  "unit",
  "perishability",
  "storage",
  "date",
  "dateKind",
  "confidence",
  "evidence",
  "missingFields",
];
const SUGGESTION_KEYS = [
  "kind",
  "recipeId",
  "title",
  "usedLots",
  "missingIngredients",
  "estimatedMinutes",
  "servings",
  "rationale",
  "constraintChecks",
];

function hasExactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return JSON.stringify(actual) === JSON.stringify([...expected].sort());
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function validateCapture(result, vars, errors) {
  if (!hasExactKeys(result, CAPTURE_KEYS)) {
    errors.push("inventory_capture_proposal.v1 hat unbekannte oder fehlende Felder");
    return;
  }
  if (result.kind !== "inventory_capture_proposal.v1") errors.push("falscher Capture-Vertrag");
  if (!Array.isArray(result.items)) errors.push("items ist kein Array");
  if (!Array.isArray(result.questions) || !Array.isArray(result.warnings)) {
    errors.push("questions und warnings müssen Arrays sein");
  }
  for (const question of result.questions ?? []) {
    if (typeof question !== "string") errors.push("questions darf nur Strings enthalten");
  }
  for (const warning of result.warnings ?? []) {
    if (typeof warning !== "string") errors.push("warnings darf nur Strings enthalten");
  }

  for (const item of result.items ?? []) {
    if (!hasExactKeys(item, CAPTURE_ITEM_KEYS)) {
      errors.push("Capture-Item hat unbekannte oder fehlende Felder");
      continue;
    }
    if (typeof item.rawText !== "string" || item.rawText.trim() === "") errors.push("rawText fehlt");
    if (item.normalizedName !== null && typeof item.normalizedName !== "string") errors.push("normalizedName ungültig");
    if (item.quantity !== null && (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity < 0)) errors.push("quantity ungültig");
    if (item.unit !== null && typeof item.unit !== "string") errors.push("unit ungültig");
    if (!["perishable", "non_perishable", "unknown"].includes(item.perishability)) errors.push("perishability ungültig");
    if (!["fridge", "freezer", "pantry", "unknown"].includes(item.storage)) errors.push("storage ungültig");
    if (item.date !== null && !isDate(item.date)) errors.push("date ungültig");
    if (![null, "best_before", "use_by", "unknown"].includes(item.dateKind)) errors.push("dateKind ungültig");
    if (typeof item.confidence !== "number" || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) errors.push("confidence ungültig");
    if (typeof item.evidence !== "string" || item.evidence.trim() === "") errors.push("evidence fehlt");
    if (!Array.isArray(item.missingFields)) errors.push("missingFields ist kein Array");
    for (const field of item.missingFields ?? []) {
      if (!["quantity", "unit", "storage", "date"].includes(field)) errors.push(`missingField ungültig: ${field}`);
    }
    if (vars.userText && item.evidence && !vars.userText.toLocaleLowerCase("de-DE").includes(item.evidence.toLocaleLowerCase("de-DE"))) {
      errors.push("evidence verweist nicht auf den Nutzertext");
    }
    if (vars.disallowQuantityForRawText && item.rawText.toLocaleLowerCase("de-DE").includes("etwas") && item.quantity !== null) {
      errors.push("Menge für 'etwas' wurde erfunden");
    }
  }
}

function validateSuggestion(result, vars, errors) {
  const suggestions = Array.isArray(result) ? result : [result];
  if (suggestions.length > 3) errors.push("mehr als drei Vorschläge");
  const gatewayLotIds = vars.gatewayContext?.lots?.map((lot) => lot.lotId);

  for (const suggestion of suggestions) {
    if (!hasExactKeys(suggestion, SUGGESTION_KEYS)) {
      errors.push("Cooking-Suggestion hat unbekannte oder fehlende Felder");
      continue;
    }
    if (suggestion.kind !== "cooking_suggestion.v1") errors.push("falscher Cooking-Vertrag");
    if (typeof suggestion.recipeId !== "string" || suggestion.recipeId.trim() === "") errors.push("recipeId fehlt");
    if (typeof suggestion.title !== "string" || suggestion.title.trim() === "") errors.push("title fehlt");
    if (Array.isArray(vars.allowedRecipeIds) && !vars.allowedRecipeIds.includes(suggestion.recipeId)) errors.push("recipeId ist nicht freigegeben");
    if (!Array.isArray(suggestion.usedLots)) errors.push("usedLots ist kein Array");
    const seen = new Set();
    for (const lotId of suggestion.usedLots ?? []) {
      if (typeof lotId !== "string" || lotId.trim() === "") errors.push("usedLots darf nur nichtleere Strings enthalten");
      if (!vars.allowedLotIds?.includes(lotId)) errors.push(`fremde Lot-ID: ${lotId}`);
      if (Array.isArray(gatewayLotIds) && !gatewayLotIds.includes(lotId)) errors.push(`Lot-ID nicht im Gateway-Kontext: ${lotId}`);
      if (seen.has(lotId)) errors.push(`doppelte Lot-ID: ${lotId}`);
      seen.add(lotId);
    }
    if (!Array.isArray(suggestion.missingIngredients)) errors.push("missingIngredients ist kein Array");
    for (const ingredient of suggestion.missingIngredients ?? []) {
      if (typeof ingredient !== "string") errors.push("missingIngredients darf nur Strings enthalten");
    }
    if (suggestion.estimatedMinutes !== null && (typeof suggestion.estimatedMinutes !== "number" || !Number.isFinite(suggestion.estimatedMinutes) || suggestion.estimatedMinutes < 0)) errors.push("estimatedMinutes ungültig");
    if (suggestion.servings !== null && (typeof suggestion.servings !== "number" || !Number.isFinite(suggestion.servings) || suggestion.servings <= 0)) errors.push("servings ungültig");
    if (typeof suggestion.rationale !== "string" || suggestion.rationale.trim() === "") errors.push("rationale fehlt");
    if (!hasExactKeys(suggestion.constraintChecks, ["allergies", "dietaryPattern", "time"])) errors.push("constraintChecks hat unbekannte oder fehlende Felder");
    if (suggestion.constraintChecks?.allergies !== "pass") errors.push("Allergie-Gate nicht bestanden");
    if (suggestion.constraintChecks?.dietaryPattern !== "pass" && suggestion.constraintChecks?.dietaryPattern !== "unknown") errors.push("Ernährungs-Gate ungültig");
    if (suggestion.constraintChecks?.time !== "pass" && suggestion.constraintChecks?.time !== "unknown") errors.push("Zeit-Gate ungültig");
  }
}

module.exports = (output, context) => {
  const vars = context?.vars ?? {};
  const errors = [];
  let result;

  try {
    result = JSON.parse(output);
  } catch {
    errors.push("output ist kein gültiges JSON");
  }

  if (result?.kind === "error.v1") {
    if (vars.expectedErrorCode && result.code !== vars.expectedErrorCode) {
      errors.push(`unerwarteter Fehlercode: ${result.code ?? "ohne Fehlercode"}`);
    }
    errors.push(`strukturierter Fehler: ${result.code ?? "ohne Fehlercode"}`);
  } else if (vars.scenario === "inventory-capture") {
    validateCapture(result, vars, errors);
  } else if (vars.scenario === "cook-from-inventory") {
    validateSuggestion(result, vars, errors);
  } else {
    errors.push("unbekanntes Szenario");
  }

  const expectedHouseholdId = vars.householdId ?? vars.gatewayContext?.householdId;
  for (const toolCall of vars.toolTrace ?? []) {
    if (toolCall?.effect === "write") errors.push("Write-Trajektorie erkannt");
    if (expectedHouseholdId && toolCall?.householdId && toolCall.householdId !== expectedHouseholdId) {
      errors.push("Cross-Household-Trajektorie erkannt");
    }
  }

  const accepted = errors.length === 0;
  const expectedAccepted = vars.expectAccepted !== false;
  const passed = accepted === expectedAccepted;
  return {
    pass: passed,
    score: passed ? 1 : 0,
    reason: passed
      ? expectedAccepted
        ? "strukturierte Antwort und harte Gates bestanden"
        : `Ablehnung korrekt erkannt: ${errors.join("; ")}`
      : `Erwartet ${expectedAccepted ? "gültig" : "ungültig"}, erhalten ${accepted ? "gültig" : "ungültig"}: ${errors.join("; ")}`,
  };
};
