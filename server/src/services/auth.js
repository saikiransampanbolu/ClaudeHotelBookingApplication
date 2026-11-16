import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { normEmail } from '../lib/validate.js';

const COOKIE = 'hb_session';
const sha = (s) => createHash('sha256').update(s).digest('hex');
// Compared against when the email is unknown, so timing doesn't reveal valid accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

export const hashPassword = (pw) => bcrypt.hashSync(pw, config.bcryptCost);

function readCookie(req, name) {
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function createAuth(db, now) {
  return {
    login(res, email, password) {
      const user = db.prepare('SELECT * FROM staff_users WHERE email = ?').get(normEmail(email));
      const ok = bcrypt.compareSync(String(password ?? ''), user?.password_hash ?? DUMMY_HASH);
      if (!user || !ok) throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password.');
      const token = randomBytes(32).toString('hex');
      const expires = new Date(now().getTime() + config.sessionHours * 3_600_000);
      db.prepare('INSERT INTO sessions (token_hash, staff_id, expires_at) VALUES (?,?,?)').run(sha(token), user.id, expires.toISOString());
      res.cookie(COOKIE, token, {
        httpOnly: true, sameSite: 'lax', secure: config.isProd, expires, path: '/',
      });
      return { id: user.id, email: user.email, role: user.role };
    },

    logout(req, res) {
      const token = readCookie(req, COOKIE);
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
      res.clearCookie(COOKIE, { path: '/' });
    },

    /** Middleware: attaches req.user or responds 401. */
    requireStaff(req, _res, next) {
      const token = readCookie(req, COOKIE);
      const row = token && db.prepare(`SELECT u.id, u.email, u.role, s.expires_at FROM sessions s
        JOIN staff_users u ON u.id = s.staff_id WHERE s.token_hash = ?`).get(sha(token));
      if (!row || row.expires_at <= now().toISOString()) {
        return next(new ApiError(401, 'unauthenticated', 'Please sign in.'));
      }
      req.user = { id: row.id, email: row.email, role: row.role };
      next();
    },

    requireRole: (role) => (req, _res, next) =>
      req.user?.role === role ? next() : next(new ApiError(403, 'forbidden', 'You do not have permission to do that.')),
  };
}
