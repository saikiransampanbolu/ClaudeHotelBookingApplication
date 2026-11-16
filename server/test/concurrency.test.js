import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, GUEST } from './helpers.js';

// FR-13 / acceptance criterion: a room cannot be reserved twice for the same night.
test('concurrent bookings never exceed inventory; losers are refunded', async () => {
  const s = await startServer();
  try {
    // Family Suite has 2 rooms. Fire 8 simultaneous bookings for the same nights.
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      s.call('POST', '/bookings', { body: s.bookBody('Family Suite', { guests: 3, guest: { ...GUEST, email: `racer${i}@example.com` } }) })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 201, 409, 409, 409, 409, 409, 409]);

    // Database invariant: no room has two bookings on one night.
    const dupes = s.db.prepare('SELECT room_id, night, COUNT(*) c FROM booking_nights GROUP BY room_id, night HAVING c > 1').all();
    assert.equal(dupes.length, 0);
    assert.equal(s.db.prepare("SELECT COUNT(DISTINCT room_id) c FROM bookings WHERE status='confirmed'").get().c, 2);
    // Every charge that lost the race was refunded automatically.
    assert.equal(s.calls.charge - s.calls.refund, 2);
  } finally { await s.close(); }
});

test('database itself rejects a second booking of the same room-night', async () => {
  const s = await startServer();
  try {
    await s.call('POST', '/bookings', { body: s.bookBody('Standard Queen') });
    const { room_id, id } = s.db.prepare('SELECT room_id, id FROM bookings').get();
    assert.throws(() => s.db.prepare('INSERT INTO booking_nights (booking_id, room_id, night) VALUES (?,?,?)').run(id, room_id, '2026-12-10'), /UNIQUE/);
  } finally { await s.close(); }
});

test('NFR performance smoke: 50 concurrent searches finish well under 2 s', async () => {
  const s = await startServer();
  try {
    const t0 = performance.now();
    const rs = await Promise.all(Array.from({ length: 50 }, () => s.call('GET', '/rooms/search?checkIn=2026-12-10&checkOut=2026-12-13&guests=2')));
    const ms = performance.now() - t0;
    assert.ok(rs.every((r) => r.status === 200));
    assert.ok(ms < 2000, `took ${ms.toFixed(0)} ms`);
  } finally { await s.close(); }
});
