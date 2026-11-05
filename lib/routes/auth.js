// Sign in, sign out and session status for the admin dashboard.

import { json, readJson, assertSameOrigin, clientInfo, HttpError } from '../http.js';
import { hashIp } from '../db.js';
import { lockedFor, recordFailure, clearKey } from '../rate-limit.js';
import { verifyPassword, safeStringEqual } from '../crypto.js';
import { getCredentials, createSession, getSession, destroySession, sessionCookie, clearedCookie, logAuthEvent } from '../auth.js';
import { getTwoFactor, useSecondFactor } from '../totp.js';
import { humanWait } from './public.js';

const FIFTEEN_MIN = 15 * 60 * 1000;
export const LOGIN_LIMITS = {
  perIp: { max: 5, windowMs: FIFTEEN_MIN, lockMs: FIFTEEN_MIN }, // 5 wrong tries -> 15 min lock, doubling on repeat
  global: { max: 30, windowMs: FIFTEEN_MIN, lockMs: 10 * 60 * 1000, escalate: false } // slows down attacks from many IPs
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function handleLogin(request, url) {
  assertSameOrigin(request, url);
  const body = await readJson(request, 2048);
  const info = clientInfo(request);
  const ipKey = `login:${await hashIp(info.ip)}`;

  const wait = Math.max(await lockedFor(ipKey), await lockedFor('login:global'));
  if (wait) {
    await logAuthEvent('blocked', info);
    throw new HttpError(429, 'locked', `Too many failed attempts. Try again in ${humanWait(wait)}.`, { retryAfter: wait });
  }

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase().slice(0, 64) : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 256) : '';
  if (!username || !password) {
    throw new HttpError(400, 'missing_fields', 'Enter your username and password.');
  }

  const creds = await getCredentials();
  // Both checks always run, so timing doesn't reveal which part was wrong.
  const [userOk, passOk] = await Promise.all([safeStringEqual(username, creds.username), verifyPassword(password, creds.hash)]);

  if (!userOk || !passOk) {
    const result = await recordFailure(ipKey, LOGIN_LIMITS.perIp);
    const global = await recordFailure('login:global', LOGIN_LIMITS.global);
    await logAuthEvent(result.locked || global.locked ? 'locked' : 'login_failed', info);
    await sleep(300 + Math.floor(Math.random() * 300));
    const lockedSeconds = Math.max(result.locked, global.locked);
    if (lockedSeconds) {
      throw new HttpError(429, 'locked', `Too many failed attempts. Try again in ${humanWait(lockedSeconds)}.`, { retryAfter: lockedSeconds });
    }
    throw new HttpError(401, 'invalid_credentials', 'Wrong username or password.', { attemptsLeft: result.remaining });
  }

  // Two-step sign-in: with the right password, a code from the authenticator
  // app (or a recovery code) is needed too. A wrong code counts as a failed try.
  const tfa = await getTwoFactor();
  if (tfa) {
    const code = typeof body.code === 'string' ? body.code.slice(0, 32) : '';
    if (!code.trim()) {
      return json({ ok: false, error: 'code_required', message: 'Enter the 6-digit code from your authenticator app.' }, 401);
    }
    const used = await useSecondFactor(tfa, code);
    if (!used) {
      const result = await recordFailure(ipKey, LOGIN_LIMITS.perIp);
      await logAuthEvent(result.locked ? 'locked' : '2fa_failed', info);
      await sleep(300 + Math.floor(Math.random() * 300));
      if (result.locked) {
        throw new HttpError(429, 'locked', `Too many failed attempts. Try again in ${humanWait(result.locked)}.`, { retryAfter: result.locked });
      }
      throw new HttpError(401, 'invalid_code', 'That code is not right. Codes change every 30 seconds; use the newest one.', { attemptsLeft: result.remaining });
    }
    if (used === 'recovery') await logAuthEvent('recovery_code_used', info, Date.now(), `${tfa.recovery.length} left`);
  }

  await clearKey(ipKey);
  const token = await createSession(info);
  await logAuthEvent('login', info, Date.now(), tfa ? 'with two-step code' : 'password only');
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) });
}

export async function handleLogout(request, url) {
  assertSameOrigin(request, url);
  const session = await getSession(request);
  if (session) {
    await destroySession(session.tokenHash);
    await logAuthEvent('logout', clientInfo(request));
  }
  return json({ ok: true }, 200, { 'set-cookie': clearedCookie() });
}

export async function handleSessionStatus(request) {
  const session = await getSession(request);
  if (!session) return json({ ok: true, authenticated: false });
  const creds = await getCredentials().catch(() => null);
  return json({ ok: true, authenticated: true, username: creds ? creds.username : '', expiresAt: session.expiresAt });
}
