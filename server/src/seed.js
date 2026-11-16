import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { createDb } from './db.js';
import { hashPassword } from './services/auth.js';

/** Idempotent seed: hotel, room types, rooms, and the owner-created admin account. */
export function seed(db, { adminEmail, adminPassword, staffEmail, staffPassword } = {}) {
  if (!db.prepare('SELECT 1 FROM hotel').get()) {
    db.prepare('INSERT INTO hotel (id, name, address, phone, timezone) VALUES (1,?,?,?,?)')
      .run('Harbor View Hotel', '12 Seaside Avenue, Portland, ME 04101', '+1 207 555 0142', config.timezone);
  }
  if (!db.prepare('SELECT 1 FROM room_types').get()) {
    const types = [
      ['Standard Queen', 'Bright room with a queen bed, work desk and city view.', 2, 12900, ['Wi-Fi', 'Air conditioning', 'TV', 'Coffee maker'], ['101', '102', '103', '104']],
      ['Deluxe King', 'Spacious king room with seating area and harbor glimpses.', 3, 18900, ['Wi-Fi', 'Air conditioning', 'Mini bar', 'Bathtub', 'Smart TV'], ['201', '202', '203']],
      ['Family Suite', 'Two bedrooms and a living area, ideal for families.', 5, 28900, ['Wi-Fi', 'Kitchenette', 'Two bathrooms', 'Sofa bed', 'Smart TV'], ['301', '302']],
    ];
    for (const [name, description, max, price, amenities, numbers] of types) {
      const id = db.prepare('INSERT INTO room_types (name, description, max_guests, base_price_cents, amenities) VALUES (?,?,?,?,?)')
        .run(name, description, max, price, JSON.stringify(amenities)).lastInsertRowid;
      for (const n of numbers) db.prepare('INSERT INTO rooms (room_type_id, room_number) VALUES (?,?)').run(id, n);
    }
  }
  const addUser = (email, pw, role) => {
    if (email && pw && !db.prepare('SELECT 1 FROM staff_users WHERE email = ?').get(email)) {
      db.prepare('INSERT INTO staff_users (email, password_hash, role) VALUES (?,?,?)').run(email, hashPassword(pw), role);
    }
  };
  addUser(adminEmail, adminPassword, 'admin');
  addUser(staffEmail, staffPassword, 'staff');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 10) {
    console.error('Set SEED_ADMIN_PASSWORD (min 10 characters) in the environment before seeding.');
    process.exit(1);
  }
  const db = createDb(config.dbPath);
  seed(db, {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@hotel.test', adminPassword: password,
    staffEmail: process.env.SEED_STAFF_EMAIL, staffPassword: process.env.SEED_STAFF_PASSWORD,
  });
  console.log(`Seeded ${config.dbPath}`);
}
