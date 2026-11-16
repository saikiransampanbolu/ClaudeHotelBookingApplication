import { tx } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { str } from '../lib/validate.js';
import { parseTypeRow } from './availability.js';

const STATUSES = ['clean', 'dirty', 'out_of_order'];

export function createRoomTypes(db) {
  const rooms = (typeId) => db.prepare('SELECT id, room_number, status FROM rooms WHERE room_type_id = ? ORDER BY room_number').all(typeId)
    .map((r) => ({ id: r.id, roomNumber: r.room_number, status: r.status }));
  const withRooms = (row) => ({ ...parseTypeRow(row), rooms: rooms(row.id) });

  return {
    get(id, { activeOnly = false } = {}) {
      const row = db.prepare('SELECT * FROM room_types WHERE id = ?').get(id);
      if (!row || (activeOnly && !row.is_active)) throw notFound('Room type not found.');
      return withRooms(row);
    },
    list: () => db.prepare('SELECT * FROM room_types ORDER BY name').all().map(withRooms),

    create(v) {
      const r = db.prepare(`INSERT INTO room_types (name, description, max_guests, base_price_cents, amenities, photo_url)
        VALUES (?,?,?,?,?,?)`).run(v.name, v.description ?? '', v.maxGuests, v.basePriceCents, JSON.stringify(v.amenities ?? []), v.photoUrl ?? '');
      return this.get(Number(r.lastInsertRowid));
    },

    update(id, v) {
      const cur = this.get(id);
      const m = { ...cur, ...v };
      db.prepare(`UPDATE room_types SET name=?, description=?, max_guests=?, base_price_cents=?, amenities=?, photo_url=?, is_active=?
        WHERE id=?`).run(m.name, m.description, m.maxGuests, m.basePriceCents, JSON.stringify(m.amenities), m.photoUrl, m.isActive ? 1 : 0, id);
      return this.get(id);
    },

    addRoom(typeId, roomNumber) {
      this.get(typeId);
      const num = str(roomNumber);
      if (!/^[A-Za-z0-9-]{1,10}$/.test(num)) throw badRequest({ roomNumber: 'Room number must be 1–10 letters, digits or dashes.' });
      try {
        db.prepare('INSERT INTO rooms (room_type_id, room_number) VALUES (?,?)').run(typeId, num);
      } catch (err) {
        if (/UNIQUE/i.test(err.message)) throw conflict('duplicate_room', 'That room number already exists.');
        throw err;
      }
      return this.get(typeId);
    },

    setRoomStatus(roomId, status) {
      if (!STATUSES.includes(status)) throw badRequest({ status: `Status must be one of ${STATUSES.join(', ')}.` });
      const room = db.prepare('SELECT room_type_id FROM rooms WHERE id = ?').get(roomId);
      if (!room) throw notFound('Room not found.');
      db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(status, roomId);
      return this.get(room.room_type_id);
    },

    removeRoom(roomId) {
      return tx(db, () => {
        const room = db.prepare('SELECT room_type_id FROM rooms WHERE id = ?').get(roomId);
        if (!room) throw notFound('Room not found.');
        const used = db.prepare('SELECT 1 FROM bookings WHERE room_id = ? LIMIT 1').get(roomId);
        if (used) throw conflict('room_in_use', 'This room has bookings; mark it out of order instead.');
        db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
        return this.get(room.room_type_id);
      });
    },
  };
}
