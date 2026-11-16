import { computeQuote } from './pricing.js';

const FREE_ROOM_SQL = `
  r.status != 'out_of_order'
  AND NOT EXISTS (
    SELECT 1 FROM booking_nights bn
    WHERE bn.room_id = r.id AND bn.night >= @checkIn AND bn.night < @checkOut
      AND bn.booking_id != @exclude)`;

export const parseTypeRow = (t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  maxGuests: t.max_guests,
  basePriceCents: t.base_price_cents,
  amenities: JSON.parse(t.amenities),
  photoUrl: t.photo_url,
  isActive: !!t.is_active,
});

export function createAvailability(db) {
  const freeRoomStmt = db.prepare(`
    SELECT r.id FROM rooms r WHERE r.room_type_id = @typeId AND ${FREE_ROOM_SQL}
    ORDER BY r.room_number LIMIT 1`);
  const freeRoomOfStmt = db.prepare(`
    SELECT r.id FROM rooms r WHERE r.id = @roomId AND ${FREE_ROOM_SQL}`);
  const searchStmt = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = t.id AND ${FREE_ROOM_SQL}) AS free_rooms
    FROM room_types t WHERE t.is_active = 1 AND t.max_guests >= @guests
    ORDER BY t.base_price_cents, t.name`);

  /** First free room id of a type for all nights in [checkIn, checkOut), or null. */
  const findFreeRoom = (typeId, checkIn, checkOut, excludeBookingId = 0) =>
    freeRoomStmt.get({ typeId, checkIn, checkOut, exclude: excludeBookingId })?.id ?? null;

  const isRoomFree = (roomId, checkIn, checkOut, excludeBookingId = 0) =>
    !!freeRoomOfStmt.get({ roomId, checkIn, checkOut, exclude: excludeBookingId });

  /** FR-01/02/03: room types with inventory on every night, with a price quote. */
  function search({ checkIn, checkOut, guests }, nights) {
    return searchStmt
      .all({ checkIn, checkOut, guests, exclude: 0 })
      .filter((t) => t.free_rooms > 0)
      .map((t) => ({
        ...parseTypeRow(t),
        availableRooms: t.free_rooms,
        quote: computeQuote(t.base_price_cents, nights),
      }));
  }

  return { findFreeRoom, isRoomFree, search };
}
