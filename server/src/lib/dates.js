const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** True only for real calendar dates in strict YYYY-MM-DD form. */
export function isDate(s) {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === s;
}

const toMs = (s) => Date.parse(`${s}T00:00:00Z`);

export function addDays(s, n) {
  return new Date(toMs(s) + n * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(from, to) {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

/** Nights occupied by a stay: check-in inclusive, check-out exclusive. */
export function nightsBetween(checkIn, checkOut) {
  const out = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Calendar date "today" in the given IANA time zone. */
export function todayIn(tz, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function offsetMs(utcMs, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Convert a local wall-clock date + "HH:MM" in tz to a UTC Date (DST-safe). */
export function zonedToUtc(dateStr, hhmm, tz) {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, m);
  let ms = guess - offsetMs(guess, tz);
  ms = guess - offsetMs(ms, tz); // second pass handles DST transitions
  return new Date(ms);
}
