import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { ApiError, notFound } from './lib/errors.js';
import { policyText } from './services/cancellation.js';
import { validateRoomTypeInput, validateStay } from './lib/validate.js';
import { createAvailability } from './services/availability.js';
import { createBookings } from './services/bookings.js';
import { createRoomTypes } from './services/roomTypes.js';
import { createReports } from './services/reports.js';
import { createAuth } from './services/auth.js';
import { createOutboxMailer } from './adapters/mailer.js';
import { createSimulatedPayment } from './adapters/payment.js';
import { diffDays } from './lib/dates.js';

const here = dirname(fileURLToPath(import.meta.url));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((v) => v !== undefined && res.json(v)).catch(next);

/** Fixed-window in-memory limiter keyed by client IP (single-instance only). */
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, _res, next) => {
    const key = req.ip;
    const t = Date.now();
    const h = hits.get(key);
    if (!h || h.reset <= t) hits.set(key, { n: 1, reset: t + windowMs });
    else if (++h.n > max) return next(new ApiError(429, 'rate_limited', 'Too many attempts. Please wait and try again.'));
    next();
  };
}

export function createApp({
  db, payment = createSimulatedPayment(), mailer = createOutboxMailer(db), now = () => new Date(),
  limits = { auth: 10, lookup: 20 },
} = {}) {
  const availability = createAvailability(db);
  const bookings = createBookings({ db, availability, payment, mailer, now });
  const roomTypes = createRoomTypes(db);
  const reports = createReports(db, now);
  const auth = createAuth(db, now);

  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; frame-ancestors 'none'",
    });
    if (config.isProd) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(express.json({ limit: '50kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ---------- Public ----------
  api.get('/hotel', wrap(() => {
    const h = bookings.hotel();
    return {
      name: h.name, address: h.address, phone: h.phone, checkInTime: h.check_in_time,
      checkOutTime: h.check_out_time, timezone: h.timezone, currency: config.currency,
      taxRate: config.taxRate, cancellationPolicy: policyText(), maxNights: config.maxNights,
    };
  }));

  api.get('/rooms/search', wrap((req) => {
    const stay = validateStay(req.query, bookings.hotel().timezone, now());
    const nights = diffDays(stay.checkIn, stay.checkOut);
    return { ...stay, nights, results: availability.search(stay, nights) };
  }));

  api.get('/room-types/:id', wrap((req) => {
    const type = roomTypes.get(Number(req.params.id), { activeOnly: true });
    delete type.rooms; // internal room numbers are not public
    const out = { roomType: type, cancellationPolicy: policyText() };
    if (req.query.checkIn || req.query.checkOut) out.quote = bookings.quoteFor({ ...req.query, roomTypeId: type.id });
    return out;
  }));

  api.post('/bookings', wrap(async (req, res) => {
    const b = await bookings.create(req.body ?? {});
    res.status(201);
    return { booking: publicBooking(b) };
  }));

  const lookupLimit = rateLimit(limits.lookup, 60_000);
  const find = (body = {}) => {
    const b = bookings.byCodeAndEmail(body.code, body.email);
    if (!b) throw notFound('We could not find a booking with that code and email.');
    return b;
  };
  api.post('/bookings/lookup', lookupLimit, wrap((req) => ({ booking: publicBooking(find(req.body)) })));
  api.post('/bookings/cancel', lookupLimit, wrap(async (req) => ({
    booking: publicBooking(await bookings.cancel(find(req.body))),
  })));

  // ---------- Admin ----------
  const admin = express.Router();
  admin.post('/login', rateLimit(limits.auth, 60_000), wrap((req, res) => ({ user: auth.login(res, req.body?.email, req.body?.password) })));
  admin.use((req, _res, next) => {
    // CSRF hardening: state-changing admin calls must be JSON (cannot be sent by a plain HTML form).
    if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json')) {
      return next(new ApiError(415, 'unsupported_media_type', 'Content-Type must be application/json.'));
    }
    next();
  });
  admin.post('/logout', wrap((req, res) => { auth.logout(req, res); return { ok: true }; }));
  admin.use(auth.requireStaff);
  admin.get('/me', wrap((req) => ({ user: req.user })));
  admin.get('/dashboard', wrap(() => reports.dashboard()));
  admin.get('/calendar', wrap((req) => reports.calendar({ from: req.query.from, days: req.query.days })));

  const onlyAdmin = auth.requireRole('admin');
  admin.get('/room-types', wrap(() => ({ roomTypes: roomTypes.list() })));
  admin.post('/room-types', onlyAdmin, wrap((req, res) => { res.status(201); return { roomType: roomTypes.create(validateRoomTypeInput(req.body)) }; }));
  admin.put('/room-types/:id', onlyAdmin, wrap((req) => ({ roomType: roomTypes.update(Number(req.params.id), validateRoomTypeInput(req.body, true)) })));
  admin.post('/room-types/:id/rooms', onlyAdmin, wrap((req, res) => { res.status(201); return { roomType: roomTypes.addRoom(Number(req.params.id), req.body?.roomNumber) }; }));
  admin.put('/rooms/:id', onlyAdmin, wrap((req) => ({ roomType: roomTypes.setRoomStatus(Number(req.params.id), req.body?.status) })));
  admin.delete('/rooms/:id', onlyAdmin, wrap((req) => ({ roomType: roomTypes.removeRoom(Number(req.params.id)) })));

  const bookingOr404 = (id) => bookings.byId(Number(id)) ?? (() => { throw notFound('Booking not found.'); })();
  admin.get('/bookings', wrap((req) => ({ bookings: bookings.list(req.query) })));
  admin.get('/bookings/:id', wrap((req) => ({ booking: bookingOr404(req.params.id) })));
  admin.post('/bookings', wrap(async (req, res) => { res.status(201); return { booking: await bookings.create(req.body ?? {}, { source: 'admin' }) }; }));
  admin.put('/bookings/:id', wrap((req) => ({ booking: bookings.modify(Number(req.params.id), req.body ?? {}) })));
  admin.post('/bookings/:id/cancel', wrap(async (req) => ({
    booking: await bookings.cancel(bookingOr404(req.params.id), { waivePolicy: req.body?.waivePolicy !== false }),
  })));
  admin.post('/guests/:id/anonymize', onlyAdmin, wrap((req) => { bookings.anonymizeGuest(Number(req.params.id)); return { ok: true }; }));

  api.use('/admin', admin);
  api.use((_req, _res, next) => next(notFound('Unknown API route.')));
  app.use('/api', api);

  // ---------- Static SPA ----------
  const dist = join(here, '../../client/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'bad_json', message: 'Request body is not valid JSON.' } });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'too_large', message: 'Request body is too large.' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } });
  });

  return app;
}

/** Guest-facing booking: no internal ids or room number. */
function publicBooking(b) {
  const { id, guest, roomNumber, source, payment, ...rest } = b;
  return { ...rest, guest: { name: guest.name, email: guest.email, phone: guest.phone }, payment: payment && { status: payment.status, cardLast4: payment.cardLast4 } };
}
