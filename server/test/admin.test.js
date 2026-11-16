import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, GUEST } from './helpers.js';

let s, admin, staff;
before(async () => {
  s = await startServer();
  admin = (await s.login()).cookie;
  staff = (await s.login('staff@hotel.test', 'staff-password-1')).cookie;
});
after(() => s.close());

test('FR-09 login: wrong password, unknown user, and unauthenticated access are rejected', async () => {
  assert.equal((await s.login('admin@hotel.test', 'wrong')).status, 401);
  assert.equal((await s.login('nobody@hotel.test', 'whatever')).status, 401);
  assert.equal((await s.call('GET', '/admin/bookings')).status, 401);
  assert.equal((await s.call('GET', '/admin/bookings', { cookie: 'hb_session=forged' })).status, 401);
});

test('FR-09 session cookie is HttpOnly and token is stored hashed', async () => {
  const r = await s.login();
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  const token = r.cookie.split('=')[1];
  const stored = s.db.prepare('SELECT token_hash FROM sessions').all().map((x) => x.token_hash);
  assert.ok(!stored.includes(token));
  const me = await s.call('GET', '/admin/me', { cookie: r.cookie });
  assert.deepEqual(me.body.user.role, 'admin');
  assert.equal((await s.call('POST', '/admin/logout', { cookie: r.cookie, body: {} })).status, 200);
  assert.equal((await s.call('GET', '/admin/me', { cookie: r.cookie })).status, 401);
});

test('passwords are stored as bcrypt hashes', () => {
  const rows = s.db.prepare('SELECT password_hash FROM staff_users').all();
  assert.ok(rows.length >= 2 && rows.every((r) => /^\$2[aby]\$/.test(r.password_hash)));
});

test('admin writes require application/json (CSRF hardening)', async () => {
  const r = await s.call('POST', '/admin/room-types', { cookie: admin, body: 'name=x', raw: true });
  assert.equal(r.status, 415);
});

test('login is rate limited', async () => {
  const limited = await startServer({ limits: { auth: 2, lookup: 20 } });
  try {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await limited.login('admin@hotel.test', 'nope')).status);
    assert.deepEqual(codes, [401, 401, 429, 429]);
  } finally { await limited.close(); }
});

test('FR-10 admin creates, edits and deactivates room types; staff cannot', async () => {
  const body = { name: 'Penthouse', description: 'Top floor', maxGuests: 4, basePriceCents: 49900, amenities: ['Wi-Fi', 'Terrace'] };
  assert.equal((await s.call('POST', '/admin/room-types', { cookie: staff, body })).status, 403);
  const invalid = await s.call('POST', '/admin/room-types', { cookie: admin, body: { ...body, name: '', basePriceCents: -5 } });
  assert.equal(invalid.status, 400);
  assert.ok('name' in invalid.body.error.fields && 'basePriceCents' in invalid.body.error.fields);

  const created = await s.call('POST', '/admin/room-types', { cookie: admin, body });
  assert.equal(created.status, 201);
  const id = created.body.roomType.id;
  const withRoom = await s.call('POST', `/admin/room-types/${id}/rooms`, { cookie: admin, body: { roomNumber: 'PH1' } });
  assert.equal(withRoom.body.roomType.rooms.length, 1);
  assert.equal((await s.call('POST', `/admin/room-types/${id}/rooms`, { cookie: admin, body: { roomNumber: 'PH1' } })).status, 409);

  const search = () => s.call('GET', '/rooms/search?checkIn=2026-12-20&checkOut=2026-12-22&guests=2');
  assert.ok((await search()).body.results.some((t) => t.name === 'Penthouse'));

  const edited = await s.call('PUT', `/admin/room-types/${id}`, { cookie: admin, body: { basePriceCents: 55000 } });
  assert.equal(edited.body.roomType.basePriceCents, 55000);
  assert.equal((await search()).body.results.find((t) => t.name === 'Penthouse').quote.nightlyCents, 55000);

  await s.call('PUT', `/admin/room-types/${id}`, { cookie: admin, body: { isActive: false } });
  assert.ok(!(await search()).body.results.some((t) => t.name === 'Penthouse'));
  assert.equal((await s.call('GET', `/room-types/${id}`)).status, 404);

  assert.equal((await s.call('PUT', '/admin/room-types/9999', { cookie: admin, body: { name: 'x' } })).status, 404);
});

test('out-of-order rooms are not sold; rooms with bookings cannot be deleted', async () => {
  const id = s.typeId('Family Suite');
  const rooms = (await s.call('GET', '/admin/room-types', { cookie: admin })).body.roomTypes.find((t) => t.id === id).rooms;
  for (const r of rooms) await s.call('PUT', `/admin/rooms/${r.id}`, { cookie: admin, body: { status: 'out_of_order' } });
  const res = await s.call('GET', '/rooms/search?checkIn=2026-12-10&checkOut=2026-12-12&guests=4');
  assert.equal(res.body.results.length, 0);
  assert.equal((await s.call('PUT', `/admin/rooms/${rooms[0].id}`, { cookie: admin, body: { status: 'bogus' } })).status, 400);
  for (const r of rooms) await s.call('PUT', `/admin/rooms/${r.id}`, { cookie: admin, body: { status: 'clean' } });

  const b = await s.call('POST', '/bookings', { body: s.bookBody('Family Suite', { guests: 4 }) });
  assert.equal(b.status, 201);
  const booked = s.db.prepare('SELECT room_id FROM bookings').get().room_id;
  assert.equal((await s.call('DELETE', `/admin/rooms/${booked}`, { cookie: admin, body: {} })).status, 409);
});

let bookingId;
test('FR-11/16 calendar and dashboard show bookings', async () => {
  const r = await s.call('POST', '/bookings', { body: s.bookBody('Deluxe King', { checkIn: '2026-11-16', checkOut: '2026-11-18' }) });
  assert.equal(r.status, 201);
  const list = (await s.call('GET', '/admin/bookings?q=ada', { cookie: staff })).body.bookings;
  bookingId = list.find((b) => b.bookingCode === r.body.booking.bookingCode).id;

  const cal = (await s.call('GET', '/admin/calendar?from=2026-11-16&days=4', { cookie: staff })).body;
  assert.equal(cal.dates.length, 4);
  const row = cal.rooms.find((x) => x.days[0].booked);
  assert.deepEqual(row.days.map((d) => d.booked), [true, true, false, false]);
  assert.equal(row.days[0].bookingCode, r.body.booking.bookingCode);
  assert.equal((await s.call('GET', '/admin/calendar?from=bad', { cookie: staff })).status, 400);

  const dash = (await s.call('GET', '/admin/dashboard', { cookie: staff })).body;
  assert.equal(dash.date, '2026-11-16');
  assert.equal(dash.arrivals.length, 1);
  assert.equal(dash.occupiedRooms, 1);
  assert.equal(dash.sellableRooms, 9);
  assert.equal(dash.occupancyPercent, 11);
});

test('FR-12 admin creates a booking on behalf of a guest (offline payment, no card)', async () => {
  const before = s.calls.charge;
  const r = await s.call('POST', '/admin/bookings', { cookie: staff, body: s.bookBody('Standard Queen', { card: undefined, guest: { name: 'Walk In', email: 'walkin@example.com', phone: '555 0100 200' } }) });
  assert.equal(r.status, 201);
  assert.equal(r.body.booking.source, 'admin');
  assert.equal(r.body.booking.payment.status, 'offline');
  assert.equal(s.calls.charge, before);
});

test('FR-15 modify booking re-checks availability atomically', async () => {
  const mod = await s.call('PUT', `/admin/bookings/${bookingId}`, { cookie: staff, body: { checkOut: '2026-11-19', guests: 3 } });
  assert.equal(mod.status, 200);
  assert.equal(mod.body.booking.nights, 3);
  assert.equal(s.db.prepare('SELECT COUNT(*) c FROM booking_nights WHERE booking_id = ?').get(bookingId).c, 3);
  assert.equal((await s.call('PUT', `/admin/bookings/${bookingId}`, { cookie: staff, body: { guests: 9 } })).status, 400);
  assert.equal((await s.call('PUT', '/admin/bookings/9999', { cookie: staff, body: {} })).status, 404);
  // Fill the whole type for a window, then try to move into it: must fail and leave the booking intact.
  for (let i = 0; i < 3; i++) await s.call('POST', '/bookings', { body: s.bookBody('Deluxe King', { checkIn: '2026-12-01', checkOut: '2026-12-03', guest: { ...GUEST, email: `k${i}@example.com` } }) });
  const clash = await s.call('PUT', `/admin/bookings/${bookingId}`, { cookie: staff, body: { checkIn: '2026-12-01', checkOut: '2026-12-02' } });
  assert.equal(clash.status, 409);
  const still = (await s.call('GET', `/admin/bookings/${bookingId}`, { cookie: staff })).body.booking;
  assert.equal(still.checkIn, '2026-11-16');
  assert.equal(s.db.prepare('SELECT COUNT(*) c FROM booking_nights WHERE booking_id = ?').get(bookingId).c, 3);
});

test('admin cancel refunds in full and frees nights; unknown id is 404', async () => {
  const r = await s.call('POST', `/admin/bookings/${bookingId}/cancel`, { cookie: staff, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.booking.status, 'cancelled');
  assert.equal(r.body.booking.refundCents, r.body.booking.totalCents);
  assert.equal(s.db.prepare('SELECT COUNT(*) c FROM booking_nights WHERE booking_id = ?').get(bookingId).c, 0);
  assert.equal((await s.call('POST', '/admin/bookings/9999/cancel', { cookie: staff, body: {} })).status, 404);
  assert.equal((await s.call('POST', `/admin/bookings/${bookingId}/cancel`, { cookie: staff, body: {} })).status, 409);
  assert.equal((await s.call('PUT', `/admin/bookings/${bookingId}`, { cookie: staff, body: { guests: 1 } })).status, 409);
});

test('privacy: anonymize removes PII, admin only', async () => {
  const guestId = s.db.prepare("SELECT id FROM guests WHERE email = 'walkin@example.com'").get().id;
  assert.equal((await s.call('POST', `/admin/guests/${guestId}/anonymize`, { cookie: staff, body: {} })).status, 403);
  assert.equal((await s.call('POST', `/admin/guests/${guestId}/anonymize`, { cookie: admin, body: {} })).status, 200);
  const g = s.db.prepare('SELECT * FROM guests WHERE id = ?').get(guestId);
  assert.equal(g.name, 'Anonymized');
  assert.equal(g.phone, '');
  assert.ok(!g.email.includes('walkin'));
  assert.equal((await s.call('POST', '/admin/guests/9999/anonymize', { cookie: admin, body: {} })).status, 404);
});
