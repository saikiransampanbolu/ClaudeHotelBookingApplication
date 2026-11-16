import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS hotel (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL,
  check_in_time TEXT NOT NULL DEFAULT '15:00',
  check_out_time TEXT NOT NULL DEFAULT '11:00',
  timezone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS room_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id INTEGER NOT NULL DEFAULT 1 REFERENCES hotel(id),
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  max_guests INTEGER NOT NULL CHECK (max_guests BETWEEN 1 AND 10),
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents > 0),
  amenities TEXT NOT NULL DEFAULT '[]',
  photo_url TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  room_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'clean' CHECK (status IN ('clean','dirty','out_of_order'))
);
CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
  anonymized_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_code TEXT NOT NULL UNIQUE,
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  check_in TEXT NOT NULL, check_out TEXT NOT NULL,
  guests INTEGER NOT NULL CHECK (guests >= 1),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed')),
  nightly_cents INTEGER NOT NULL, nights INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL, tax_cents INTEGER NOT NULL, total_price_cents INTEGER NOT NULL,
  special_requests TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'online',
  refund_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, cancelled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE TABLE IF NOT EXISTS booking_nights (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  night TEXT NOT NULL,
  UNIQUE (room_id, night)
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid','refunded','partially_refunded','offline')),
  provider_ref TEXT NOT NULL, card_last4 TEXT,
  refunded_cents INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS staff_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','staff'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addr TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
  kind TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL
);
`;

/** Open (and migrate) a database. Use ':memory:' for tests. */
export function createDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

/** Run fn inside BEGIN IMMEDIATE so writers serialise; rolls back on throw. */
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
