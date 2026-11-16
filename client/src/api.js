export class ApiFailure extends Error {
  constructor(status, error = {}) {
    super(error.message || 'Something went wrong. Please try again.');
    this.status = status;
    this.code = error.code;
    this.fields = error.fields || {};
  }
}

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined || method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : method === 'GET' ? undefined : '{}',
    });
  } catch {
    throw new ApiFailure(0, { message: 'Cannot reach the server. Check your connection and try again.' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiFailure(res.status, data.error);
  return data;
}

export const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();
export const money = (cents) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const fmtDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** Today's date in the hotel's zone (YYYY-MM-DD) for date input minimums. */
export const todayIn = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
