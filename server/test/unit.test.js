import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { isDate, addDays, diffDays, nightsBetween, todayIn, zonedToUtc } from '../src/lib/dates.js';
import { computeQuote } from '../src/services/pricing.js';
import { computeRefund, policyText } from '../src/services/cancellation.js';
import { createSimulatedPayment } from '../src/adapters/payment.js';
import { validateStay, validateGuest } from '../src/lib/validate.js';

test('isDate accepts real dates only', () => {
  assert.equal(isDate('2026-02-28'), true);
  for (const bad of ['2026-02-30', '2026-13-01', '26-01-01', '2026/01/01', '', null, undefined, 20260101]) {
    assert.equal(isDate(bad), false, String(bad));
  }
});

test('date arithmetic and nights (check-out night excluded)', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(diffDays('2026-12-10', '2026-12-13'), 3);
  assert.deepEqual(nightsBetween('2026-12-10', '2026-12-13'), ['2026-12-10', '2026-12-11', '2026-12-12']);
  assert.deepEqual(nightsBetween('2026-12-10', '2026-12-10'), []);
});

test('todayIn uses hotel-local calendar day', () => {
  assert.equal(todayIn('America/New_York', new Date('2026-11-17T03:00:00Z')), '2026-11-16');
  assert.equal(todayIn('UTC', new Date('2026-11-17T03:00:00Z')), '2026-11-17');
});

test('zonedToUtc handles standard time and DST', () => {
  assert.equal(zonedToUtc('2026-12-10', '15:00', 'America/New_York').toISOString(), '2026-12-10T20:00:00.000Z');
  assert.equal(zonedToUtc('2026-07-10', '15:00', 'America/New_York').toISOString(), '2026-07-10T19:00:00.000Z');
});

test('FR-03 price breakdown in cents', () => {
  assert.deepEqual(computeQuote(12900, 3, 0.12), { nightlyCents: 12900, nights: 3, subtotalCents: 38700, taxCents: 4644, totalCents: 43344 });
});

test('FR-08 refund tiers', () => {
  const base = { totalCents: 10000, checkIn: '2026-12-10', checkInTime: '15:00', timezone: 'America/New_York' };
  const deadline = Date.parse('2026-12-10T20:00:00Z');
  const at = (hoursBefore) => new Date(deadline - hoursBefore * 3_600_000);
  assert.equal(computeRefund(base, at(100)).refundCents, 10000);
  assert.equal(computeRefund(base, at(48)).refundCents, 10000);
  assert.equal(computeRefund(base, at(47.9)).refundCents, 5000);
  assert.equal(computeRefund(base, at(24)).refundCents, 5000);
  assert.equal(computeRefund(base, at(23.9)).refundCents, 0);
  assert.equal(computeRefund(base, at(-5)).refundCents, 0);
  assert.match(policyText(), /100% refund 48 hours or more/);
});

test('simulated payment: success, decline, and invalid input', async () => {
  const now = () => new Date('2026-11-16T00:00:00Z');
  const p = createSimulatedPayment({ delayMs: 0, now });
  const ok = await p.charge({ amountCents: 100, card: { number: '4242424242424242', expiry: '12/30', cvc: '123' } });
  assert.equal(ok.ok, true);
  assert.equal(ok.last4, '4242');
  assert.ok(!JSON.stringify(ok).includes('4242424242424242'));
  const bad = [
    [{ number: '4000000000000002', expiry: '12/30', cvc: '123' }, /declined/],
    [{ number: '4242424242424241', expiry: '12/30', cvc: '123' }, /invalid/],
    [{ number: '4242424242424242', expiry: '01/20', cvc: '123' }, /expired/],
    [{ number: '4242424242424242', expiry: '13/30', cvc: '123' }, /expiry/],
    [{ number: '4242424242424242', expiry: '12/30', cvc: '1' }, /code/],
    [undefined, /invalid/],
  ];
  for (const [card, re] of bad) {
    const r = await p.charge({ amountCents: 100, card });
    assert.equal(r.ok, false);
    assert.match(r.message, re);
  }
});

test('FR-01 validation rejects bad stays with field errors', () => {
  const tz = 'America/New_York';
  const now = new Date('2026-11-16T12:00:00Z');
  const fails = (input, field) => assert.throws(() => validateStay(input, tz, now), (e) => e.status === 400 && field in e.fields);
  fails({ checkIn: '2026-12-10', checkOut: '2026-12-09', guests: 1 }, 'checkOut');
  fails({ checkIn: '2026-12-10', checkOut: '2026-12-10', guests: 1 }, 'checkOut');
  fails({ checkIn: '2026-11-15', checkOut: '2026-11-17', guests: 1 }, 'checkIn');
  fails({ checkIn: '2026-12-10', checkOut: '2027-02-10', guests: 1 }, 'checkOut');
  fails({ checkIn: '2026-12-10', checkOut: '2026-12-11', guests: 0 }, 'guests');
  fails({ checkIn: '2026-12-10', checkOut: '2026-12-11', guests: 'x' }, 'guests');
  fails({}, 'checkIn');
  assert.deepEqual(validateStay({ checkIn: '2026-11-16', checkOut: '2026-11-17', guests: '2' }, tz, now), { checkIn: '2026-11-16', checkOut: '2026-11-17', guests: 2 });
});

test('FR-04 guest validation', () => {
  assert.throws(() => validateGuest({}), (e) => ['name', 'email', 'phone'].every((f) => f in e.fields));
  assert.throws(() => validateGuest({ name: 'A', email: 'not-an-email', phone: '+1 555 010 2000' }), (e) => 'email' in e.fields);
  assert.throws(() => validateGuest({ name: 'A', email: 'a@b.co', phone: 'abc' }), (e) => 'phone' in e.fields);
  assert.equal(validateGuest({ name: ' A ', email: ' A@B.CO ', phone: '+1 555 010 2000' }).email, 'a@b.co');
});
