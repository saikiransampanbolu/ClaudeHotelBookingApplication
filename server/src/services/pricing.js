import { config } from '../config.js';

/** Price breakdown in integer cents. */
export function computeQuote(nightlyCents, nights, taxRate = config.taxRate) {
  const subtotalCents = nightlyCents * nights;
  const taxCents = Math.round(subtotalCents * taxRate);
  return { nightlyCents, nights, subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
