import { config } from '../config.js';
import { isDate, diffDays, todayIn } from './dates.js';
import { badRequest } from './errors.js';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

export const str = (v) => (typeof v === 'string' ? v.trim() : '');
export const normEmail = (v) => str(v).toLowerCase();

export function validateStay({ checkIn, checkOut, guests }, tz, now = new Date()) {
  const e = {};
  if (!isDate(checkIn)) e.checkIn = 'Enter a valid check-in date (YYYY-MM-DD).';
  if (!isDate(checkOut)) e.checkOut = 'Enter a valid check-out date (YYYY-MM-DD).';
  const g = Number(guests);
  if (!Number.isInteger(g) || g < 1 || g > config.maxGuestsPerBooking) {
    e.guests = `Guests must be a whole number from 1 to ${config.maxGuestsPerBooking}.`;
  }
  if (!e.checkIn && !e.checkOut) {
    const today = todayIn(tz, now);
    if (checkIn < today) e.checkIn = 'Check-in cannot be in the past.';
    else if (diffDays(today, checkIn) > config.maxAdvanceDays) e.checkIn = 'Check-in is too far in the future.';
    if (checkOut <= checkIn) e.checkOut = 'Check-out must be after check-in.';
    else if (diffDays(checkIn, checkOut) > config.maxNights) e.checkOut = `Stays are limited to ${config.maxNights} nights.`;
  }
  if (Object.keys(e).length) throw badRequest(e);
  return { checkIn, checkOut, guests: g };
}

export function validateGuest(input = {}) {
  const e = {};
  const name = str(input.name);
  const email = normEmail(input.email);
  const phone = str(input.phone);
  if (name.length < 1 || name.length > 100) e.name = 'Enter your name (max 100 characters).';
  if (!EMAIL_RE.test(email) || email.length > 120) e.email = 'Enter a valid email address.';
  if (!PHONE_RE.test(phone)) e.phone = 'Enter a valid phone number.';
  if (Object.keys(e).length) throw badRequest(e);
  return { name, email, phone };
}

export function validateSpecialRequests(v) {
  const s = str(v);
  if (s.length > 500) throw badRequest({ specialRequests: 'Special requests are limited to 500 characters.' });
  return s;
}

export function validateRoomTypeInput(b = {}, partial = false) {
  const e = {};
  const out = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has('name')) {
    out.name = str(b.name);
    if (!out.name || out.name.length > 80) e.name = 'Name is required (max 80 characters).';
  }
  if (!partial || has('description')) out.description = str(b.description).slice(0, 1000);
  if (!partial || has('maxGuests')) {
    out.maxGuests = Number(b.maxGuests);
    if (!Number.isInteger(out.maxGuests) || out.maxGuests < 1 || out.maxGuests > 10) e.maxGuests = 'Max guests must be 1–10.';
  }
  if (!partial || has('basePriceCents')) {
    out.basePriceCents = Number(b.basePriceCents);
    if (!Number.isInteger(out.basePriceCents) || out.basePriceCents <= 0 || out.basePriceCents > 10_000_000) {
      e.basePriceCents = 'Price must be a positive amount.';
    }
  }
  if (!partial || has('amenities')) {
    const a = Array.isArray(b.amenities) ? b.amenities.map(str).filter(Boolean).slice(0, 30) : [];
    out.amenities = a;
  }
  if (!partial || has('photoUrl')) {
    out.photoUrl = str(b.photoUrl);
    if (out.photoUrl && !/^(https:\/\/|\/)/.test(out.photoUrl)) e.photoUrl = 'Photo URL must start with https:// or /.';
  }
  if (has('isActive')) out.isActive = Boolean(b.isActive);
  if (Object.keys(e).length) throw badRequest(e);
  return out;
}
