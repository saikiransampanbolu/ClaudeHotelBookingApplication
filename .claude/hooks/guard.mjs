// PreToolUse hook: block edits to secret files and obvious card-number logging.
import { readFileSync } from 'node:fs';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
const ti = input.tool_input ?? {};
const path = String(ti.file_path ?? '');
const text = String(ti.content ?? ti.new_string ?? '');

if (/(^|[\\/])\.env(\.|$)/.test(path) && !/\.env\.example$/.test(path)) {
  console.error('Blocked: .env files hold secrets and must not be edited by the agent.');
  process.exit(2);
}
if (/console\.(log|info|debug)\([^)]*(cardNumber|card\.number|pan)\b/i.test(text)) {
  console.error('Blocked: do not log card numbers.');
  process.exit(2);
}
