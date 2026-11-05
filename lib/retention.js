// Deletes personal data once it is no longer needed (DPDP Act s.8(7)).
// Run by the daily job (lib/app.js -> runDailyJob, scheduled in vercel.json).
//
// - Contact messages: MESSAGE_RETENTION_DAYS after they arrive (365 days).
// - Access log (sign-ins, exports, deletions): ACCESS_LOG_DAYS (400 days, so
//   always at least the one year the rules ask for).
// - Signed-out or expired sessions, unfinished two-step setups, and rate-limit
//   counters (lib/rate-limit.js) are cleared too.
// Each clean-up that removed messages is itself written to the access log.

import { query } from './db.js';
import { logAuthEvent, ACCESS_LOG_DAYS, SYSTEM } from './auth.js';
import { MESSAGE_RETENTION_DAYS } from '../public/js/shared/defaults.js';

const DAY = 24 * 60 * 60 * 1000;

export async function applyRetention(now = Date.now()) {
  const expired = await query('DELETE FROM pf_messages WHERE created_at < $1 RETURNING id', [now - MESSAGE_RETENTION_DAYS * DAY]);
  if (expired.length) {
    await logAuthEvent('messages_expired', SYSTEM, now, `${expired.length} message${expired.length === 1 ? '' : 's'} older than ${MESSAGE_RETENTION_DAYS} days`);
  }
  await query('DELETE FROM pf_auth_events WHERE at < $1', [now - ACCESS_LOG_DAYS * DAY]);
  await query('DELETE FROM pf_sessions WHERE expires_at < $1', [now]);
  await query("DELETE FROM pf_settings WHERE key = 'admin_2fa_pending' AND updated_at < $1", [now - DAY]);
  return { messagesDeleted: expired.length };
}
