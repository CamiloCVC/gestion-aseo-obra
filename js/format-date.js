// Todo el sistema trabaja en hora de Colombia (UTC-5, sin horario de verano).
const TIME_ZONE = "America/Bogota";
const OFFSET = "-05:00";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(date) {
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

// "2026-09-24 11:25" en 24 h. Vacío si no hay valor; el texto original si no es una fecha válida.
export function formatDateTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function colombiaDay(date = new Date()) {
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day}`;
}

// Valor por defecto de un <input type="datetime-local">, en hora de Colombia.
export function colombiaNowInputValue(date = new Date()) {
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Valor de un <input type="datetime-local"> (sin zona) → instante con offset de Colombia.
export function toColombiaIso(localValue) {
  const withSeconds = localValue.length === 16 ? `${localValue}:00` : localValue;
  return `${withSeconds}${OFFSET}`;
}

export function dayStartIso(day) {
  return new Date(`${day}T00:00:00${OFFSET}`).toISOString();
}

export function nextDayStartIso(day) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
  return dayStartIso(next);
}
