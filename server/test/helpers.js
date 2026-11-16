process.env.NODE_ENV = 'test';
process.env.BCRYPT_COST = '4';

const { createDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { seed } = await import('../src/seed.js');
const { createSimulatedPayment } = await import('../src/adapters/payment.js');

export const NOW = new Date('2026-11-16T12:00:00Z'); // 07:00 in the hotel's zone
export const GOOD_CARD = { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' };
export const DECLINED_CARD = { number: '4000 0000 0000 0002', expiry: '12/30', cvc: '123' };
export const GUEST = { name: 'Ada Lovelace', email: 'ada@example.com', phone: '+1 555 010 2000' };

export async function startServer(opts = {}) {
  const db = createDb(':memory:');
  seed(db, { adminEmail: 'admin@hotel.test', adminPassword: 'correct-horse-battery', staffEmail: 'staff@hotel.test', staffPassword: 'staff-password-1' });
  const calls = { charge: 0, refund: 0 };
  const sim = createSimulatedPayment({ delayMs: 15, now: () => NOW });
  const payment = {
    charge: (a) => { calls.charge++; return sim.charge(a); },
    refund: (a) => { calls.refund++; return sim.refund(a); },
  };
  const app = createApp({ db, payment, now: () => NOW, ...opts });
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, { body, cookie, raw } = {}) {
    const res = await fetch(base + '/api' + path, {
      method,
      headers: { ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}), ...(raw ? { 'content-type': 'text/plain' } : {}), ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, body: json, headers: res.headers };
  }

  async function login(email = 'admin@hotel.test', password = 'correct-horse-battery') {
    const r = await call('POST', '/admin/login', { body: { email, password } });
    const cookie = r.headers.get('set-cookie')?.split(';')[0];
    return { ...r, cookie };
  }

  const typeId = (name) => db.prepare('SELECT id FROM room_types WHERE name = ?').get(name).id;
  const bookBody = (name, over = {}) => ({
    roomTypeId: typeId(name), checkIn: '2026-12-10', checkOut: '2026-12-13', guests: 2,
    guest: GUEST, card: GOOD_CARD, ...over,
  });

  return {
    db, call, login, calls, typeId, bookBody, base,
    close: () => new Promise((r) => server.close(r)),
  };
}
