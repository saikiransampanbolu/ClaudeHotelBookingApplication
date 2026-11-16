import { addDays, isDate, nightsBetween, todayIn } from '../lib/dates.js';
import { badRequest } from '../lib/errors.js';

export function createReports(db, now) {
  const tz = () => db.prepare('SELECT timezone FROM hotel WHERE id = 1').get().timezone;

  /** FR-11: rooms × days grid. */
  function calendar({ from, days = 14 }) {
    const start = from ?? todayIn(tz(), now());
    const n = Number(days);
    if (!isDate(start) || !Number.isInteger(n) || n < 1 || n > 62) {
      throw badRequest({ from: 'Use a valid start date and 1–62 days.' });
    }
    const end = addDays(start, n);
    const rooms = db.prepare(`SELECT r.id, r.room_number, r.status, t.name AS type_name
      FROM rooms r JOIN room_types t ON t.id = r.room_type_id ORDER BY t.name, r.room_number`).all();
    const cells = db.prepare(`SELECT bn.room_id, bn.night, b.id AS booking_id, b.booking_code, g.name AS guest_name
      FROM booking_nights bn JOIN bookings b ON b.id = bn.booking_id JOIN guests g ON g.id = b.guest_id
      WHERE bn.night >= ? AND bn.night < ?`).all(start, end);
    const map = new Map(cells.map((c) => [`${c.room_id}|${c.night}`, c]));
    const dates = nightsBetween(start, end);
    return {
      from: start,
      dates,
      rooms: rooms.map((r) => ({
        id: r.id, roomNumber: r.room_number, status: r.status, typeName: r.type_name,
        days: dates.map((d) => {
          const c = map.get(`${r.id}|${d}`);
          return c ? { booked: true, bookingId: c.booking_id, bookingCode: c.booking_code, guestName: c.guest_name } : { booked: false };
        }),
      })),
    };
  }

  /** FR-16: today's arrivals, departures, occupancy. */
  function dashboard() {
    const today = todayIn(tz(), now());
    const pick = (col) => db.prepare(`SELECT b.id, b.booking_code, b.guests, g.name AS guest_name, r.room_number
      FROM bookings b JOIN guests g ON g.id = b.guest_id JOIN rooms r ON r.id = b.room_id
      WHERE b.${col} = ? AND b.status != 'cancelled' ORDER BY r.room_number`).all(today)
      .map((r) => ({ id: r.id, bookingCode: r.booking_code, guests: r.guests, guestName: r.guest_name, roomNumber: r.room_number }));
    const sellable = db.prepare(`SELECT COUNT(*) c FROM rooms r JOIN room_types t ON t.id = r.room_type_id
      WHERE r.status != 'out_of_order' AND t.is_active = 1`).get().c;
    const occupied = db.prepare('SELECT COUNT(DISTINCT room_id) c FROM booking_nights WHERE night = ?').get(today).c;
    return {
      date: today,
      arrivals: pick('check_in'),
      departures: pick('check_out'),
      occupiedRooms: occupied,
      sellableRooms: sellable,
      occupancyPercent: sellable ? Math.round((occupied / sellable) * 100) : 0,
    };
  }

  return { calendar, dashboard };
}
