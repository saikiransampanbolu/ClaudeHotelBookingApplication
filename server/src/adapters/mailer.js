import { config } from '../config.js';

const money = (c) => `$${(c / 100).toFixed(2)}`;

/** Outbox mailer: stores every message in the `emails` table (swap for SMTP later). */
export function createOutboxMailer(db, { silent = config.silentMail } = {}) {
  const insert = db.prepare('INSERT INTO emails (to_addr, subject, body, kind, status, created_at) VALUES (?,?,?,?,?,?)');
  return {
    async send({ to, subject, body, kind }) {
      insert.run(to, subject, body, kind, 'sent', new Date().toISOString());
      if (!silent) console.log(`[mail:${kind}] to=${to} subject="${subject}"`);
    },
  };
}

export function confirmationEmail(b, hotel) {
  return {
    kind: 'confirmation',
    to: b.guest.email,
    subject: `Booking confirmed — ${b.bookingCode}`,
    body: [
      `Hello ${b.guest.name},`,
      '',
      `Your stay at ${hotel.name} is confirmed.`,
      `Booking code: ${b.bookingCode}`,
      `Room type: ${b.roomType.name}`,
      `Check-in: ${b.checkIn} from ${hotel.check_in_time}`,
      `Check-out: ${b.checkOut} by ${hotel.check_out_time}`,
      `Guests: ${b.guests}`,
      `Total paid: ${money(b.totalCents)} (incl. ${money(b.taxCents)} tax)`,
      '',
      'Use your booking code and this email address to view or cancel your booking.',
    ].join('\n'),
  };
}

export function cancellationEmail(b, hotel) {
  return {
    kind: 'cancellation',
    to: b.guest.email,
    subject: `Booking cancelled — ${b.bookingCode}`,
    body: [
      `Hello ${b.guest.name},`,
      '',
      `Your booking ${b.bookingCode} at ${hotel.name} (${b.checkIn} to ${b.checkOut}) has been cancelled.`,
      `Refund: ${money(b.refundCents)}${b.refundCents ? ' (simulated; returned to your original payment method)' : ''}`,
    ].join('\n'),
  };
}
