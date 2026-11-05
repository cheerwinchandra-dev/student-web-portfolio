// Two-step sign-in for the dashboard: 6-digit codes from an authenticator app
// (RFC 6238 TOTP: HMAC-SHA1, 30-second steps), plus one-time recovery codes.
//
// The app's secret is stored in the database encrypted with AES-GCM. The key
// comes from the ADMIN_PASSWORD_HASH environment variable, which lives only in
// Vercel, so a copy of the database alone can't be used to make codes.
// Putting a new ADMIN_PASSWORD_HASH in Vercel therefore also turns two-step
// sign-in off: that is the "lost my phone and my recovery codes" reset.

import { getSetting, setSetting, deleteSetting } from './db.js';
import { sha256, sha256Base64Url, toBase64Url, fromBase64Url, timingSafeEqual } from './crypto.js';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_MS = 30 * 1000;
const enc = new TextEncoder();
export const ISSUER = 'Cheerwin Portfolio';
const RECOVERY_COUNT = 8;
const PENDING_MS = 24 * 60 * 60 * 1000; // an unfinished setup expires after a day

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i === -1) throw new Error('Not base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** The 6-digit code for one 30-second step. */
export async function codeAt(secretBytes, step) {
  const msg = new Uint8Array(8);
  let s = step;
  for (let i = 7; i >= 0; i--) {
    msg[i] = s & 255;
    s = Math.floor(s / 256);
  }
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = mac[mac.length - 1] & 15;
  const n = ((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

/**
 * Checks a code against the current step and one step either side (clock
 * drift). Returns the matching step, or -1. A step at or before `lastStep` is
 * refused, so a code can't be used twice.
 */
export async function matchCode(secretBytes, code, { now = Date.now(), lastStep = -1 } = {}) {
  if (!/^\d{6}$/.test(code)) return -1;
  const current = Math.floor(now / STEP_MS);
  let found = -1;
  for (const step of [current - 1, current, current + 1]) {
    // Every step is checked, so the time taken doesn't depend on which one matched.
    const ok = timingSafeEqual(enc.encode(await codeAt(secretBytes, step)), enc.encode(code));
    if (ok && step > lastStep && found === -1) found = step;
  }
  return found;
}

export function newSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export function otpauthUri(secret, account) {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;
}

// ---------- encryption of the stored secret

const envHash = () => (process.env.ADMIN_PASSWORD_HASH || '').trim();

async function aesKey() {
  const raw = await sha256(`cw-2fa-key:${envHash()}`);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function envTag() {
  return sha256Base64Url(`cw-2fa-env:${envHash()}`);
}

async function seal(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), enc.encode(text)));
  return { iv: toBase64Url(iv), ct: toBase64Url(ct), env: await envTag() };
}

async function unseal(box) {
  if (!box || typeof box !== 'object' || box.env !== (await envTag())) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(box.iv) }, await aesKey(), fromBase64Url(box.ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

// ---------- recovery codes

function newRecoveryCode() {
  const s = base32Encode(crypto.getRandomValues(new Uint8Array(7))).slice(0, 10);
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

const normalizeRecovery = (code) => String(code).toUpperCase().replace(/[^A-Z2-7]/g, '');

async function hashRecovery(code) {
  return sha256Base64Url(`cw-recovery:${normalizeRecovery(code)}`);
}

export async function makeRecoveryCodes() {
  const codes = Array.from({ length: RECOVERY_COUNT }, newRecoveryCode);
  return { codes, hashes: await Promise.all(codes.map(hashRecovery)) };
}

// ---------- stored state

/** The active two-step setup, or null when it is off (or was reset in Vercel). */
export async function getTwoFactor() {
  const stored = await getSetting('admin_2fa');
  if (!stored || stored.enabled !== true) return null;
  const secret = await unseal(stored.secret);
  if (!secret) return null;
  return {
    secret,
    lastStep: Number(stored.lastStep) || -1,
    recovery: Array.isArray(stored.recovery) ? stored.recovery.filter((h) => typeof h === 'string') : [],
    enabledAt: Number(stored.enabledAt) || 0,
    sealed: stored.secret
  };
}

async function saveTwoFactor(tfa) {
  await setSetting('admin_2fa', { enabled: true, secret: tfa.sealed, lastStep: tfa.lastStep, recovery: tfa.recovery, enabledAt: tfa.enabledAt });
}

/**
 * Checks a 6-digit code or a recovery code. On success it is used up (the
 * step is remembered, or the recovery code is removed). Returns
 * 'code' | 'recovery' | ''.
 */
export async function useSecondFactor(tfa, input, now = Date.now()) {
  const raw = String(input || '').trim();
  const digits = raw.replace(/[\s-]/g, '');
  if (/^\d{6}$/.test(digits)) {
    const step = await matchCode(base32Decode(tfa.secret), digits, { now, lastStep: tfa.lastStep });
    if (step === -1) return '';
    tfa.lastStep = step;
    await saveTwoFactor(tfa);
    return 'code';
  }
  if (normalizeRecovery(raw).length === 10) {
    const h = await hashRecovery(raw);
    let hit = -1;
    tfa.recovery.forEach((stored, i) => {
      if (timingSafeEqual(enc.encode(stored), enc.encode(h))) hit = i;
    });
    if (hit === -1) return '';
    tfa.recovery.splice(hit, 1);
    await saveTwoFactor(tfa);
    return 'recovery';
  }
  return '';
}

/** Starts a setup: a new secret waits until the first correct code confirms it. */
export async function startSetup(account, now = Date.now()) {
  const secret = newSecret();
  await setSetting('admin_2fa_pending', { secret: await seal(secret), createdAt: now });
  return { secret, uri: otpauthUri(secret, account) };
}

/** Finishes a setup with the first code. Returns the recovery codes, or null if the code is wrong. */
export async function finishSetup(code, now = Date.now()) {
  const pending = await getSetting('admin_2fa_pending');
  if (!pending || !(now - Number(pending.createdAt) < PENDING_MS)) return { expired: true };
  const secret = await unseal(pending.secret);
  if (!secret) return { expired: true };
  const step = await matchCode(base32Decode(secret), String(code || '').replace(/\s/g, ''), { now });
  if (step === -1) return { wrong: true };
  const { codes, hashes } = await makeRecoveryCodes();
  await saveTwoFactor({ sealed: pending.secret, lastStep: step, recovery: hashes, enabledAt: now });
  await deleteSetting('admin_2fa_pending');
  return { codes };
}

export async function replaceRecoveryCodes(tfa) {
  const { codes, hashes } = await makeRecoveryCodes();
  tfa.recovery = hashes;
  await saveTwoFactor(tfa);
  return codes;
}

export async function turnOff() {
  await deleteSetting('admin_2fa');
  await deleteSetting('admin_2fa_pending');
}
