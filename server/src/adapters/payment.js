import { randomBytes } from 'node:crypto';
import { config } from '../config.js';

function luhnOk(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Simulated payment provider. Same shape a Stripe adapter would expose:
 *   charge({amountCents, card}) -> {ok, providerRef, last4} | {ok:false, message}
 *   refund({providerRef, amountCents}) -> {ok, refundRef}
 * The card number is only inspected in memory; only last4 leaves this function.
 */
export function createSimulatedPayment({ delayMs = config.paymentDelayMs, now = () => new Date() } = {}) {
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  return {
    async charge({ amountCents, card = {} }) {
      await wait();
      const digits = String(card.number ?? '').replace(/[\s-]/g, '');
      if (!/^\d{13,19}$/.test(digits) || !luhnOk(digits)) return { ok: false, message: 'Card number is invalid.' };
      const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(card.expiry ?? ''));
      if (!m || +m[1] < 1 || +m[1] > 12) return { ok: false, message: 'Card expiry is invalid (use MM/YY).' };
      const t = now();
      const expYear = 2000 + +m[2];
      if (expYear < t.getUTCFullYear() || (expYear === t.getUTCFullYear() && +m[1] < t.getUTCMonth() + 1)) {
        return { ok: false, message: 'Card has expired.' };
      }
      if (!/^\d{3,4}$/.test(String(card.cvc ?? ''))) return { ok: false, message: 'Security code is invalid.' };
      if (digits === '4000000000000002') return { ok: false, message: 'Your card was declined.' };
      if (!(amountCents > 0)) return { ok: false, message: 'Invalid amount.' };
      return { ok: true, providerRef: `sim_${randomBytes(8).toString('hex')}`, last4: digits.slice(-4) };
    },
    async refund({ providerRef, amountCents }) {
      await wait();
      if (!providerRef || !(amountCents > 0)) return { ok: false };
      return { ok: true, refundRef: `simre_${randomBytes(6).toString('hex')}` };
    },
  };
}
