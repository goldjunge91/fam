const DAY_MS = 86_400_000;

function utcDay(value, field, allowTimestamp = false) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (typeof value !== 'string' || !(dateOnly.test(value) || (allowTimestamp && timestamp.test(value)))) {
    throw new TypeError(`${field} must be an ISO date${allowTimestamp ? ' or timestamp with timezone' : ''}`);
  }
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || !Number.isFinite(calendarDate.getTime())
    || calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new TypeError(`${field} is not a valid date`);
  }
  return Math.floor(time / DAY_MS);
}

// Prototype ranking heuristic, not a food-safety decision or a shelf-life prediction.
// Due-date urgency contributes 0..80; opening age contributes 5..20 over seven days.
export function priorityScore(item, referenceDate) {
  const today = utcDay(referenceDate, 'referenceDate');
  let due = item.bestBefore == null ? null : utcDay(item.bestBefore, 'bestBefore');
  const opened = item.openedAt == null ? null : utcDay(item.openedAt, 'openedAt', true);
  if (opened !== null && opened > today) throw new RangeError('openedAt cannot be in the future');
  if (item.consumeWithinDays != null) {
    if (opened === null || !Number.isInteger(item.consumeWithinDays) || item.consumeWithinDays < 0) {
      throw new TypeError('consumeWithinDays requires openedAt and a non-negative integer');
    }
    // This window must be supplied explicitly, never guessed from the food category.
    due = Math.min(due ?? Infinity, opened + item.consumeWithinDays);
  }
  const expiryUrgency = due === null ? 0 : 80 / (1 + Math.max(0, due - today));
  const openingUrgency = opened === null ? 0 : 5 + 15 * Math.min(1, (today - opened) / 7);
  return Math.round((expiryUrgency + openingUrgency) * 1000) / 1000;
}
