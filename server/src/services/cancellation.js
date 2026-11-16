import { config } from '../config.js';
import { zonedToUtc } from '../lib/dates.js';

/** Refund for cancelling `now`, given hotel-local check-in date/time. */
export function computeRefund({ totalCents, checkIn, checkInTime, timezone }, now = new Date(), tiers = config.cancellationTiers) {
  const deadline = zonedToUtc(checkIn, checkInTime, timezone);
  const hoursLeft = (deadline.getTime() - now.getTime()) / 3_600_000;
  const tier = tiers.find((t) => hoursLeft >= t.hoursBefore);
  const percent = tier ? tier.percent : 0;
  return { percent, refundCents: Math.floor((totalCents * percent) / 100), hoursLeft };
}

export function policyText(tiers = config.cancellationTiers) {
  return tiers
    .map((t, i) => {
      const prev = tiers[i - 1];
      const range = i === 0 ? `${t.hoursBefore} hours or more before check-in`
        : t.hoursBefore === 0 ? `less than ${prev.hoursBefore} hours before check-in`
        : `${t.hoursBefore}–${prev.hoursBefore} hours before check-in`;
      return `${t.percent}% refund ${range}`;
    })
    .join('; ') + '.';
}
