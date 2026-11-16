import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, GUEST, DECLINED_CARD } from './helpers.js';

let s;
before(async () => { s = await startServer(); });
after(() => s.close());

const search = (q) => s.call('GET', `/rooms/search?${new URLSearchParams(q)}`);
const emails = () => s.db.prepare('SELECT * FROM emails ORDER BY id').all();

test('health and hotel info', async () => {
  assert.equal((await s.call('GET', '/health')).body.status, 'ok');
  const h = (await s.call('GET', '/hotel')).body;
  assert.equal(h.name, 'Harbor View Hotel');
  assert.match(h.cancellationPolicy, /refund/);
});

test('FR-01 search rejects invalid input with 400', async () => {
  for (const q of [
    { checkIn: '2026-12-10', checkOut: '2026-12-09', guests: 2 },
    { checkIn: 'garbage', checkOut: '2026-12-09', guests: 2 },
    { checkIn: '2026-12-10', checkOut: '2026-12-12' },
  ]) {
    const r = await search(q);
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'validation_error');
  }
});

test('FR-02/03 search returns fitting types with price breakdown', async () => {
  const r = await search({ checkIn: '2026-12-10', checkOut: '2026-12-13', guests: 4 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results.map((t) => t.name), ['Family Suite']); // only one sleeps 4
  assert.deepEqual(r.body.results[0].quote, { nightlyCents: 28900, nights: 3, subtotalCents: 86700, taxCents: 10404, totalCents: 97104 });
  const two = await search({ checkIn: '2026-12-10', checkOut: '2026-12-13', guests: 2 });
  assert.equal(two.body.results.length, 3);
});

test('room type detail: public data only; unknown id is 404', async () => {
  const id = s.typeId('Deluxe King');
  const r = await s.call('GET', `/room-types/${id}?checkIn=2026-12-10&checkOut=2026-12-12&guests=2`);
  assert.equal(r.status, 200);
  assert.equal(r.body.roomType.rooms, undefined);
  assert.equal(r.body.quote.quote.totalCents, 37800 + 4536);
  assert.equal((await s.call('GET', '/room-types/9999')).status, 404);
});

test('FR-04 booking with missing/invalid guest fields is rejected before payment', async () => {
  const before = s.calls.charge;
  const r = await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen', { guest: { name: '', email: 'bad', phone: '' } }) });
  assert.equal(r.status, 400);
  assert.ok(['name', 'email', 'phone'].every((f) => f in r.body.error.fields));
  assert.equal(s.calls.charge, before);
});

test('booking: guest requesting more than max guests / unknown room type', async () => {
  assert.equal((await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen', { guests: 3 }) })).status, 400);
  assert.equal((await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen', { roomTypeId: 9999 }) })).status, 404);
});

test('FR-05 declined card creates no booking and no nights', async () => {
  const r = await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen', { card: DECLINED_CARD }) });
  assert.equal(r.status, 402);
  assert.equal(r.body.error.code, 'payment_failed');
  assert.equal(s.db.prepare('SELECT COUNT(*) c FROM bookings').get().c, 0);
});

let created;
test('FR-06 happy path: booking code, payment record and confirmation email', async () => {
  const r = await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen', { specialRequests: 'High floor' }) });
  assert.equal(r.status, 201);
  created = r.body.booking;
  assert.match(created.bookingCode, /^HB-[A-Z2-9]{8}$/);
  assert.equal(created.totalCents, 12900 * 3 + Math.round(12900 * 3 * 0.12));
  assert.equal(created.status, 'confirmed');
  assert.equal(created.payment.cardLast4, '4242');
  assert.equal(created.id, undefined);
  assert.equal(created.roomNumber, undefined);
  const mail = emails().at(-1);
  assert.equal(mail.to_addr, GUEST.email);
  assert.match(mail.subject, new RegExp(created.bookingCode));
  // Card number must never be stored anywhere in the database.
  const dump = JSON.stringify([s.db.prepare('SELECT * FROM payments').all(), s.db.prepare('SELECT * FROM bookings').all(), emails()]);
  assert.ok(!dump.includes('4242424242424242') && !dump.includes('4242 4242'));
});

test('FR-02/13 booked nights are unavailable; adjacent dates are not', async () => {
  // Standard Queen has 4 rooms; book the other 3 for the same nights -> sold out.
  for (let i = 0; i < 3; i++) assert.equal((await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen', { guest: { ...GUEST, email: `g${i}@example.com` } }) })).status, 201);
  const overlap = await search({ checkIn: '2026-12-12', checkOut: '2026-12-14', guests: 2 });
  assert.ok(!overlap.body.results.some((t) => t.name === 'Standard Queen'));
  const after = await search({ checkIn: '2026-12-13', checkOut: '2026-12-15', guests: 2 }); // check-out day is free
  assert.ok(after.body.results.some((t) => t.name === 'Standard Queen'));
  const r = await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen') });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'sold_out');
});

test('FR-07 lookup: wrong code / wrong email give the same 404', async () => {
  const ok = await s.call('POST', '/bookings/lookup', { body: { code: created.bookingCode.toLowerCase(), email: ' ADA@example.com ' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.booking.bookingCode, created.bookingCode);
  const wrongEmail = await s.call('POST', '/bookings/lookup', { body: { code: created.bookingCode, email: 'eve@example.com' } });
  const wrongCode = await s.call('POST', '/bookings/lookup', { body: { code: 'HB-ZZZZZZZZ', email: GUEST.email } });
  const missing = await s.call('POST', '/bookings/lookup', { body: {} });
  for (const r of [wrongEmail, wrongCode, missing]) assert.equal(r.status, 404);
  assert.deepEqual(wrongEmail.body, wrongCode.body);
});

test('FR-07/08/14 cancel: refund tier, nights freed, email sent, no double cancel', async () => {
  const before = emails().length;
  const r = await s.call('POST', '/bookings/cancel', { body: { code: created.bookingCode, email: GUEST.email } });
  assert.equal(r.status, 200);
  assert.equal(r.body.booking.status, 'cancelled');
  assert.equal(r.body.booking.refundCents, created.totalCents); // > 48h before check-in
  assert.equal(emails().length, before + 1);
  assert.match(emails().at(-1).subject, /cancelled/i);
  assert.equal(s.db.prepare("SELECT status FROM payments WHERE booking_id = (SELECT id FROM bookings WHERE booking_code = ?)").get(created.bookingCode).status, 'refunded');
  const again = await s.call('POST', '/bookings/cancel', { body: { code: created.bookingCode, email: GUEST.email } });
  assert.equal(again.status, 409);
  // Room is bookable again.
  assert.equal((await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen') })).status, 201);
});

test('FR-08 partial and zero refunds near check-in', async () => {
  const mk = async (checkIn, checkOut, email) => (await s.call('POST', '/bookings', {
    body: s.bookBody('Deluxe King', { checkIn, checkOut, guest: { ...GUEST, email } }),
  })).body.booking;
  const tomorrow = await mk('2026-11-17', '2026-11-18', 'tomorrow@example.com'); // ~32h before 15:00 check-in
  const today = await mk('2026-11-16', '2026-11-17', 'today@example.com'); // ~8h
  const c1 = await s.call('POST', '/bookings/cancel', { body: { code: tomorrow.bookingCode, email: 'tomorrow@example.com' } });
  const c2 = await s.call('POST', '/bookings/cancel', { body: { code: today.bookingCode, email: 'today@example.com' } });
  assert.equal(c1.body.booking.refundCents, Math.floor(tomorrow.totalCents / 2));
  assert.equal(c2.body.booking.refundCents, 0);
});

test('malformed JSON and unknown routes return JSON errors', async () => {
  const bad = await s.call('POST', '/bookings', { body: '{nope', raw: true });
  assert.equal(bad.status, 400);
  assert.equal((await s.call('GET', '/nope')).status, 404);
});

test('lookup endpoint is rate limited', async () => {
  const limited = await startServer({ limits: { auth: 10, lookup: 3 } });
  try {
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await limited.call('POST', '/bookings/lookup', { body: { code: 'HB-AAAAAAAA', email: 'x@y.co' } })).status);
    assert.deepEqual(codes, [404, 404, 404, 429, 429]);
  } finally { await limited.close(); }
});
