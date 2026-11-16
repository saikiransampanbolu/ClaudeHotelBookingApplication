import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';
import { seed } from './seed.js';

const db = createDb(config.dbPath);
// First run: make sure hotel + inventory exist. Admin users come from `npm run seed`.
seed(db, {
  adminEmail: process.env.SEED_ADMIN_EMAIL,
  adminPassword: process.env.SEED_ADMIN_PASSWORD,
});

createApp({ db }).listen(config.port, () => console.log(`Hotel booking API on http://localhost:${config.port}`));
