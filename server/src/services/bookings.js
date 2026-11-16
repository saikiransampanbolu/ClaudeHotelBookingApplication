import { randomInt } from 'node:crypto';
import { config } from '../config.js';
import { tx } from '../db.js';
import { diffDays, nightsBetween, todayIn } from '../lib/dates.js';
import { ApiError, badRequest, conflict, notFound } from '../lib/errors.js';
import {
  normEmail, str, validateGuest, validateSpecialRequests, validateStay,
} from '../lib/validate.js';
import { computeQuote } from './pricing.js';
import { computeRefund } from './cancellation.js';
import { cancellationEmail, confirmationEmail } from '../adapters/mailer.js';
import { parseTypeRow } from './availability.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const makeCode = () => 'HB-' + Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const isUnique = (err) => /UNIQUE/i.test(String(err?.message));

export function createBookings({ db, availability, payment, mailer, now }) {
  const hotel = () => db.prepare('SELECT * FROM hotel WHERE id = 1').get();
  const getType = (id) => db.prepare('SELECT * FROM room_types WHERE id = ?').get(id);

  function toBooking(row) {
    const h = hotel();
    const status = row.status === 'confirmed' && row.check_out <= todayIn(h.timezone, now()) ? 'completed' : row.status;
    const pay = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(row.id);
    return {
      id: row.id,
      bookingCode: row.booking_code,
      status,
      checkIn: row.check_in,
      checkOut: row.check_out,
      guests: row.guests,
      nights: row.nights,
      nightlyCents: row.nightly_cents,
      subtotalCents: row.subtotal_cents,
      taxCents: row.tax_cents,
      totalCents: row.total_price_cents,
      refundCents: row.refund_cents,
      specialRequests: row.special_requests,
      source: row.source,
      createdAt: row.created_at,
      cancelledAt: row.cancelled_at,
      guest: { id: row.guest_id, name: row.g_name, email: row.g_email, phone: row.g_phone },
      roomType: { id: row.room_type_id, name: row.t_name },
      roomNumber: row.room_number,
      payment: pay && { status: pay.status, cardLast4: pay.card_last4, refundedCents: pay.refunded_cents },
      checkInTime: h.check_in_time,
      checkOutTime: h.check_out_time,
    };
  }

  const SELECT = `
    SELECT b.*, g.name AS g_name, g.email AS g_email, g.phone AS g_phone,
           t.name AS t_name, r.room_number
    FROM bookings b JOIN guests g ON g.id = b.guest_id
    JOIN room_types t ON t.id = b.room_type_id JOIN rooms r ON r.id = b.room_id`;

  const byId = (id) => {
    const row = db.prepare(`${SELECT} WHERE b.id = ?`).get(id);
    return row ? toBooking(row) : null;
  };
  const byCodeAndEmail = (code, email) => {
    const row = db.prepare(`${SELECT} WHERE b.booking_code = ? AND g.email = ?`).get(str(code).toUpperCase(), normEmail(email));
    return row ? toBooking(row) : null;
  };

  /** Resolve & validate the room type and quote for a stay. */
  function prepareStay(input) {
    const h = hotel();
    const stay = validateStay(input, h.timezone, now());
    const typeRow = getType(Number(input.roomTypeId));
    if (!typeRow || !typeRow.is_active) throw notFound('Room type not found.');
    if (stay.guests > typeRow.max_guests) throw badRequest({ guests: `This room sleeps up to ${typeRow.max_guests} guests.` });
    const nights = diffDays(stay.checkIn, stay.checkOut);
    return { stay, typeRow, nights, quote: computeQuote(typeRow.base_price_cents, nights) };
  }

  const quoteFor = (input) => {
    const { stay, typeRow, nights, quote } = prepareStay(input);
    const free = availability.findFreeRoom(typeRow.id, stay.checkIn, stay.checkOut);
    return { roomType: parseTypeRow(typeRow), ...stay, nights, quote, available: free !== null };
  };

  /** Atomically reserve a room; throws a UNIQUE/sold-out error if the race is lost. */
  function reserve({ typeRow, stay, nights, quote, guest, specialRequests, source, payInfo }) {
    return tx(db, () => {
      const roomId = availability.findFreeRoom(typeRow.id, stay.checkIn, stay.checkOut);
      if (roomId === null) throw conflict('sold_out', 'Sorry, that room type was just booked. Please choose different dates or room.');
      const g = db.prepare('INSERT INTO guests (name, email, phone) VALUES (?,?,?)').run(guest.name, guest.email, guest.phone);
      let bookingId;
      for (let attempt = 0; ; attempt++) {
        try {
          bookingId = db.prepare(`INSERT INTO bookings
            (booking_code, guest_id, room_id, room_type_id, check_in, check_out, guests, nightly_cents, nights,
             subtotal_cents, tax_cents, total_price_cents, special_requests, source, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
            makeCode(), g.lastInsertRowid, roomId, typeRow.id, stay.checkIn, stay.checkOut, stay.guests,
            quote.nightlyCents, nights, quote.subtotalCents, quote.taxCents, quote.totalCents,
            specialRequests, source, now().toISOString()).lastInsertRowid;
          break;
        } catch (err) {
          if (!isUnique(err) || attempt >= 5) throw err; // code collision: retry
        }
      }
      const addNight = db.prepare('INSERT INTO booking_nights (booking_id, room_id, night) VALUES (?,?,?)');
      for (const night of nightsBetween(stay.checkIn, stay.checkOut)) addNight.run(bookingId, roomId, night);
      db.prepare('INSERT INTO payments (booking_id, amount_cents, status, provider_ref, card_last4) VALUES (?,?,?,?,?)')
        .run(bookingId, quote.totalCents, payInfo.status, payInfo.providerRef, payInfo.last4 ?? null);
      return bookingId;
    });
  }

  async function sendMail(msg) {
    try { await mailer.send(msg); } catch (err) { console.error('email failed:', err.message); }
  }

  /** FR-04..06, 13. `source` is 'online' (card charged) or 'admin' (paid offline). */
  async function create(input, { source = 'online' } = {}) {
    const { stay, typeRow, nights, quote } = prepareStay(input);
    const guest = validateGuest(input.guest);
    const specialRequests = validateSpecialRequests(input.specialRequests);
    if (availability.findFreeRoom(typeRow.id, stay.checkIn, stay.checkOut) === null) {
      throw conflict('sold_out', 'No rooms of this type are available for those dates.');
    }

    let payInfo = { status: 'offline', providerRef: 'offline' };
    if (source === 'online') {
      const charge = await payment.charge({ amountCents: quote.totalCents, card: input.card });
      if (!charge.ok) throw new ApiError(402, 'payment_failed', charge.message ?? 'Payment failed.');
      payInfo = { status: 'paid', providerRef: charge.providerRef, last4: charge.last4 };
    }

    let bookingId;
    try {
      bookingId = reserve({ typeRow, stay, nights, quote, guest, specialRequests, source, payInfo });
    } catch (err) {
      if (payInfo.status === 'paid') await payment.refund({ providerRef: payInfo.providerRef, amountCents: quote.totalCents });
      if (err instanceof ApiError) throw err;
      if (isUnique(err)) throw conflict('sold_out', 'Sorry, that room was just booked. Please try again.');
      throw err;
    }
    const booking = byId(bookingId);
    await sendMail(confirmationEmail(booking, hotel()));
    return booking;
  }

  /** FR-08: refund for cancelling at `now`; admin may waive the policy. */
  function cancelBooking(booking, { waivePolicy = false } = {}) {
    if (booking.status !== 'confirmed') throw conflict('not_cancellable', `This booking is already ${booking.status}.`);
    const h = hotel();
    const refund = waivePolicy
      ? { percent: 100, refundCents: booking.totalCents }
      : computeRefund({ totalCents: booking.totalCents, checkIn: booking.checkIn, checkInTime: h.check_in_time, timezone: h.timezone }, now());
    tx(db, () => {
      db.prepare("UPDATE bookings SET status='cancelled', cancelled_at=?, refund_cents=? WHERE id=? AND status='confirmed'")
        .run(now().toISOString(), refund.refundCents, booking.id);
      db.prepare('DELETE FROM booking_nights WHERE booking_id = ?').run(booking.id);
    });
    return refund;
  }

  async function settleRefund(bookingId, refundCents) {
    const pay = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(bookingId);
    if (!pay || pay.status === 'offline' || refundCents <= 0) return;
    const res = await payment.refund({ providerRef: pay.provider_ref, amountCents: refundCents });
    if (res.ok) {
      db.prepare('UPDATE payments SET status=?, refunded_cents=? WHERE id=?')
        .run(refundCents >= pay.amount_cents ? 'refunded' : 'partially_refunded', refundCents, pay.id);
    }
  }

  async function cancel(booking, opts) {
    const refund = cancelBooking(booking, opts);
    await settleRefund(booking.id, refund.refundCents);
    const updated = byId(booking.id);
    await sendMail(cancellationEmail(updated, hotel()));
    return updated;
  }

  /** FR-15: modify dates/guest details, re-checking availability atomically. */
  function modify(id, input) {
    const current = byId(id);
    if (!current) throw notFound('Booking not found.');
    if (current.status !== 'confirmed') throw conflict('not_modifiable', `A ${current.status} booking cannot be modified.`);
    const stay = validateStay({
      checkIn: input.checkIn ?? current.checkIn,
      checkOut: input.checkOut ?? current.checkOut,
      guests: input.guests ?? current.guests,
    }, hotel().timezone, now());
    const typeRow = getType(current.roomType.id);
    if (stay.guests > typeRow.max_guests) throw badRequest({ guests: `This room sleeps up to ${typeRow.max_guests} guests.` });
    const guest = validateGuest({
      name: input.guest?.name ?? current.guest.name,
      email: input.guest?.email ?? current.guest.email,
      phone: input.guest?.phone ?? current.guest.phone,
    });
    const requests = input.specialRequests === undefined ? current.specialRequests : validateSpecialRequests(input.specialRequests);
    const nights = diffDays(stay.checkIn, stay.checkOut);
    const quote = computeQuote(current.nightlyCents, nights); // keep the booked rate

    tx(db, () => {
      const row = db.prepare('SELECT room_id, guest_id FROM bookings WHERE id = ?').get(id);
      db.prepare('DELETE FROM booking_nights WHERE booking_id = ?').run(id);
      const roomId = availability.isRoomFree(row.room_id, stay.checkIn, stay.checkOut, id)
        ? row.room_id
        : availability.findFreeRoom(typeRow.id, stay.checkIn, stay.checkOut, id);
      if (roomId === null) throw conflict('sold_out', 'No room is available for the new dates.');
      const add = db.prepare('INSERT INTO booking_nights (booking_id, room_id, night) VALUES (?,?,?)');
      for (const night of nightsBetween(stay.checkIn, stay.checkOut)) add.run(id, roomId, night);
      db.prepare(`UPDATE bookings SET room_id=?, check_in=?, check_out=?, guests=?, nights=?, subtotal_cents=?,
                  tax_cents=?, total_price_cents=?, special_requests=? WHERE id=?`)
        .run(roomId, stay.checkIn, stay.checkOut, stay.guests, nights, quote.subtotalCents, quote.taxCents, quote.totalCents, requests, id);
      db.prepare('UPDATE guests SET name=?, email=?, phone=? WHERE id=?').run(guest.name, guest.email, guest.phone, row.guest_id);
    });
    return byId(id);
  }

  function list({ q, status } = {}) {
    const rows = db.prepare(`${SELECT} ORDER BY b.check_in DESC, b.id DESC LIMIT 500`).all().map(toBooking);
    const needle = str(q).toLowerCase();
    return rows.filter((b) => (!status || b.status === status)
      && (!needle || [b.bookingCode, b.guest.name, b.guest.email, b.guest.phone].some((v) => v.toLowerCase().includes(needle))));
  }

  /** Privacy: blank PII but keep the booking rows for accounting. */
  function anonymizeGuest(guestId) {
    const g = db.prepare('SELECT id FROM guests WHERE id = ?').get(guestId);
    if (!g) throw notFound('Guest not found.');
    db.prepare("UPDATE guests SET name='Anonymized', email=?, phone='', anonymized_at=? WHERE id=?")
      .run(`anonymized-${guestId}@invalid`, now().toISOString(), guestId);
    db.prepare("UPDATE bookings SET special_requests='' WHERE guest_id=?").run(guestId);
  }

  return { quoteFor, create, byId, byCodeAndEmail, cancel, modify, list, anonymizeGuest, hotel };
}
