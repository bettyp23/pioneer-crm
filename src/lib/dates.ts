// Date helpers for the workspace timezone (D-11, NFR-DATA-2). No external date library:
// Intl gives us the timezone offset for any instant.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// "YYYY-MM-DD" for the given instant in the timezone.
export function dateInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

// "YYYY-MM-DDTHH:mm" (value for <input type="datetime-local">) in the timezone.
export function localDateTimeInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Offset of the timezone from UTC at the instant, in minutes (e.g. -240 for EDT).
function offsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

// Wall-clock "YYYY-MM-DDTHH:mm" in the timezone → UTC instant. Returns null if invalid.
// Ambiguous times (DST fall-back) resolve to the first occurrence; skipped times (spring
// forward) shift forward by the gap.
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = LOCAL_DATETIME.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(naiveUtc)) return null;
  const o1 = offsetMinutes(new Date(naiveUtc), timeZone);
  const t1 = naiveUtc - o1 * 60_000;
  const o2 = offsetMinutes(new Date(t1), timeZone);
  if (o1 === o2) return new Date(t1);
  const t2 = naiveUtc - o2 * 60_000;
  if (offsetMinutes(new Date(t2), timeZone) === o2) return new Date(t2);
  // Wall time falls in a DST gap: take the later instant (shift forward).
  return new Date(Math.max(t1, t2));
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

// Display a date-only value ("YYYY-MM-DD") without shifting it through a timezone.
export function formatIsoDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
