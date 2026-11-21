const COLOMBIA_OFFSET_HOURS = 5; // UTC-5, sin horario de verano

/**
 * Rango [from, to) del mes calendario anterior a `now`, en hora Colombia.
 * @param {Date} now
 * @returns {{ from: Date, to: Date }}
 */
export function previousMonthRange(now) {
  const co = new Date(now.getTime() - COLOMBIA_OFFSET_HOURS * 3600_000);
  const y = co.getUTCFullYear();
  const m = co.getUTCMonth();
  return {
    from: new Date(Date.UTC(y, m - 1, 1, COLOMBIA_OFFSET_HOURS)),
    to: new Date(Date.UTC(y, m, 1, COLOMBIA_OFFSET_HOURS)),
  };
}
