// Single source for product assumptions (see docs/requirements.md §1).
export const config = {
  port: Number(process.env.PORT) || 3001,
  dbPath: process.env.DB_PATH || './data/hotel.db',
  isProd: process.env.NODE_ENV === 'production',
  bcryptCost: Number(process.env.BCRYPT_COST) || 12,
  timezone: 'America/New_York',
  currency: 'USD',
  taxRate: 0.12, // tax-exclusive prices; tax added on the breakdown
  maxNights: 30,
  maxAdvanceDays: 365,
  maxGuestsPerBooking: 10,
  sessionHours: 8,
  // Refund tiers: first tier whose hoursBefore <= hours until check-in applies.
  cancellationTiers: [
    { hoursBefore: 48, percent: 100 },
    { hoursBefore: 24, percent: 50 },
    { hoursBefore: 0, percent: 0 },
  ],
  paymentDelayMs: Number(process.env.PAYMENT_DELAY_MS ?? 150),
  silentMail: process.env.NODE_ENV === 'test',
};
