// Admin-only endpoints. Every request here needs a valid session; every
// change also needs to come from this site (CSRF protection).

import { json, readJson, assertSameOrigin, clientInfo, HttpError } from '../http.js';
import { query, first, getSetting, setSetting, deleteSetting, hashIp, num } from '../db.js';
import { requireSession, getCredentials, destroyOtherSessions, logAuthEvent, envFingerprint, ACCESS_LOG_DAYS } from '../auth.js';
import { verifyPassword, hashPassword } from '../crypto.js';
import { recordFailure, lockedFor, clearKey } from '../rate-limit.js';
import { refreshGithub, getGithubData } from '../github.js';
import { validateContent, validateProjects, sanitizeStoredContent, sanitizeStoredProjects, passwordProblem } from '../validate.js';
import { getTwoFactor, useSecondFactor, startSetup, finishSetup, replaceRecoveryCodes, turnOff } from '../totp.js';
import { MESSAGE_RETENTION_DAYS } from '../../public/js/shared/defaults.js';
import { humanWait } from './public.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_COLUMNS = 'id, name, email, topic, message, created_at, is_read, starred, country, ref, consent_at, consent_version, adult_confirmed';

function rowToMessage(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    topic: r.topic,
    message: r.message,
    createdAt: num(r.created_at),
    read: r.is_read === true,
    starred: r.starred === true,
    country: r.country,
    ref: r.ref || '',
    // The consent record (empty for messages sent before consent was recorded).
    consentAt: num(r.consent_at),
    consentVersion: r.consent_version || '',
    adult: r.adult_confirmed === true
  };
}

async function counts() {
  const row = await first(
    'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE NOT is_read)::int AS unread, COUNT(*) FILTER (WHERE starred)::int AS starred FROM pf_messages'
  );
  return { all: num(row.total), unread: num(row.unread), starred: num(row.starred) };
}

async function listMessages(url) {
  const filter = url.searchParams.get('filter') || 'all';
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const where = [];
  const args = [];
  if (filter === 'unread') where.push('NOT is_read');
  else if (filter === 'starred') where.push('starred');
  else if (filter !== 'all') throw new HttpError(400, 'bad_filter', 'Unknown filter.');
  if (q) {
    args.push(`%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
    const p = `$${args.length}`;
    where.push(`(name ILIKE ${p} ESCAPE '\\' OR email ILIKE ${p} ESCAPE '\\' OR message ILIKE ${p} ESCAPE '\\' OR topic ILIKE ${p} ESCAPE '\\')`);
  }
  const rows = await query(
    `SELECT ${MESSAGE_COLUMNS} FROM pf_messages ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`,
    args
  );
  return json({ ok: true, messages: rows.map(rowToMessage), counts: await counts(), serverTime: Date.now() });
}

async function updateMessage(request, id) {
  const body = await readJson(request, 512);
  const sets = [];
  const args = [];
  if ('read' in body) {
    if (typeof body.read !== 'boolean') throw new HttpError(400, 'validation_failed', '"read" must be true or false.');
    args.push(body.read);
    sets.push(`is_read = $${args.length}`);
  }
  if ('starred' in body) {
    if (typeof body.starred !== 'boolean') throw new HttpError(400, 'validation_failed', '"starred" must be true or false.');
    args.push(body.starred);
    sets.push(`starred = $${args.length}`);
  }
  if (!sets.length) throw new HttpError(400, 'validation_failed', 'Nothing to update.');
  args.push(id);
  const rows = await query(`UPDATE pf_messages SET ${sets.join(', ')} WHERE id = $${args.length} RETURNING id`, args);
  if (!rows.length) throw new HttpError(404, 'not_found', 'That message no longer exists.');
  return json({ ok: true, counts: await counts() });
}

async function deleteMessage(request, id) {
  const rows = await query('DELETE FROM pf_messages WHERE id = $1 RETURNING ref', [id]);
  // The access log keeps a note that it was deleted (no content), for a year.
  if (rows.length) await logAuthEvent('message_deleted', clientInfo(request), Date.now(), rows[0].ref || id.slice(0, 8));
  return json({ ok: true, counts: await counts() });
}

function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stops spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const utc = (ms) => (ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 19) : '');

async function exportCsv(request) {
  const rows = await query(`SELECT ${MESSAGE_COLUMNS} FROM pf_messages ORDER BY created_at DESC`);
  const header = ['Date (UTC)', 'Reference', 'Name', 'Email', 'Topic', 'Message', 'Read', 'Starred', 'Country', 'Consent given (UTC)', 'Privacy Policy version', 'Confirmed 18+', 'ID'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        utc(num(r.created_at)), r.ref, r.name, r.email, r.topic, r.message, r.is_read ? 'yes' : 'no', r.starred ? 'yes' : 'no', r.country,
        utc(num(r.consent_at)), r.consent_version, r.adult_confirmed ? 'yes' : 'no', r.id
      ]
        .map(csvCell)
        .join(',')
    );
  }
  await logAuthEvent('messages_exported', clientInfo(request), Date.now(), `${rows.length} message${rows.length === 1 ? '' : 's'} (CSV)`);
  const day = new Date().toISOString().slice(0, 10);
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="portfolio-messages-${day}.csv"`,
      'cache-control': 'no-store'
    }
  });
}

/** Everything needed to restore the inbox, as one JSON file (download it regularly). */
async function backupJson(request) {
  const [rows, events, contentRaw, projectsRaw] = await Promise.all([
    query(`SELECT ${MESSAGE_COLUMNS} FROM pf_messages ORDER BY created_at DESC`),
    query('SELECT at, kind, ip_masked, country, user_agent, detail FROM pf_auth_events ORDER BY at DESC, id DESC'),
    getSetting('content'),
    getSetting('projects')
  ]);
  await logAuthEvent('backup_downloaded', clientInfo(request), Date.now(), `${rows.length} message${rows.length === 1 ? '' : 's'}`);
  const body = {
    kind: 'cheerwin-portfolio-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    note: 'Contains personal data. Store it somewhere private (an encrypted drive) and delete old copies.',
    messages: rows.map(rowToMessage),
    accessLog: events.map((e) => ({ at: num(e.at), kind: e.kind, ip: e.ip_masked, country: e.country, userAgent: e.user_agent, detail: e.detail })),
    settings: { content: contentRaw, projects: projectsRaw }
  };
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="portfolio-backup-${day}.json"`,
      'cache-control': 'no-store'
    }
  });
}

/** The whole access log as a CSV file. */
async function eventsCsv(request) {
  const rows = await query('SELECT at, kind, ip_masked, country, user_agent, detail FROM pf_auth_events ORDER BY at DESC, id DESC');
  await logAuthEvent('access_log_exported', clientInfo(request), Date.now(), `${rows.length} entries`);
  const lines = [['Time (UTC)', 'Event', 'Detail', 'Network', 'Country', 'Device'].join(',')];
  for (const e of rows) lines.push([utc(num(e.at)), e.kind, e.detail, e.ip_masked, e.country, e.user_agent].map(csvCell).join(','));
  const day = new Date().toISOString().slice(0, 10);
  return new Response('\ufeff' + lines.join('\r\n') + '\r\n', {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="portfolio-access-log-${day}.csv"`,
      'cache-control': 'no-store'
    }
  });
}

async function getSettings() {
  const [contentRaw, projectsRaw] = await Promise.all([getSetting('content'), getSetting('projects')]);
  const { data, source } = await getGithubData();
  return json({
    ok: true,
    content: sanitizeStoredContent(contentRaw),
    contentCustomized: Boolean(contentRaw),
    projects: sanitizeStoredProjects(projectsRaw),
    repos: data.repos,
    github: { source, fetchedAt: data.fetchedAt, profileUrl: data.profile ? data.profile.url : '' }
  });
}

async function securityOverview(session) {
  const [sessions, events, creds, tfa] = await Promise.all([
    query('SELECT token_hash, created_at, last_seen, ip_masked, country, user_agent FROM pf_sessions ORDER BY last_seen DESC LIMIT 20'),
    query('SELECT at, kind, ip_masked, country, user_agent, detail FROM pf_auth_events ORDER BY at DESC, id DESC LIMIT 50'),
    getCredentials(),
    getTwoFactor()
  ]);
  return json({
    ok: true,
    passwordSource: creds.source,
    username: creds.username,
    twoFactor: tfa ? { enabled: true, enabledAt: tfa.enabledAt, recoveryLeft: tfa.recovery.length } : { enabled: false },
    retention: { messagesDays: MESSAGE_RETENTION_DAYS, accessLogDays: ACCESS_LOG_DAYS },
    sessions: sessions.map((s) => ({
      current: s.token_hash === session.tokenHash,
      createdAt: num(s.created_at),
      lastSeen: num(s.last_seen),
      ip: s.ip_masked,
      country: s.country,
      userAgent: s.user_agent
    })),
    events: events.map((e) => ({ at: num(e.at), kind: e.kind, ip: e.ip_masked, country: e.country, userAgent: e.user_agent, detail: e.detail || '' }))
  });
}

async function changePassword(request, session) {
  const body = await readJson(request, 2048);
  const info = clientInfo(request);
  const key = `pwchange:${await hashIp(info.ip)}`;
  const wait = await lockedFor(key);
  if (wait) throw new HttpError(429, 'locked', `Too many wrong attempts. Try again in ${humanWait(wait)}.`, { retryAfter: wait });

  const current = typeof body.currentPassword === 'string' ? body.currentPassword.slice(0, 256) : '';
  const next = typeof body.newPassword === 'string' ? body.newPassword : '';
  const creds = await getCredentials();
  if (!(await verifyPassword(current, creds.hash))) {
    const r = await recordFailure(key, { max: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });
    await logAuthEvent('password_change_failed', info);
    throw new HttpError(400, 'validation_failed', 'Your current password is not correct.', { fields: { currentPassword: 'Your current password is not correct.' }, attemptsLeft: r.remaining });
  }
  const problem = passwordProblem(next, creds.username);
  if (problem) throw new HttpError(400, 'validation_failed', problem, { fields: { newPassword: problem } });
  if (next === current) {
    throw new HttpError(400, 'validation_failed', 'The new password must be different.', { fields: { newPassword: 'The new password must be different.' } });
  }
  await setSetting('admin_password_hash', { hash: await hashPassword(next), env: await envFingerprint() });
  await clearKey(key);
  await destroyOtherSessions(session.tokenHash);
  await logAuthEvent('password_changed', info);
  return json({ ok: true });
}

// ---------- two-step sign-in (lib/totp.js)

/** True when two-step sign-in is on (INBOX_WITHOUT_TWO_STEP=1 turns the rule off; not recommended). */
async function twoStepReady() {
  if ((process.env.INBOX_WITHOUT_TWO_STEP || '').trim() === '1') return true;
  return Boolean(await getTwoFactor());
}

async function secondFactorLimit(request) {
  const info = clientInfo(request);
  const key = `2fa:${await hashIp(info.ip)}`;
  const wait = await lockedFor(key);
  if (wait) throw new HttpError(429, 'locked', `Too many wrong codes. Try again in ${humanWait(wait)}.`, { retryAfter: wait });
  return { info, key };
}

async function wrongCode(key, info, message = 'That code is not right. Use the newest code from your app.') {
  const r = await recordFailure(key, { max: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });
  await logAuthEvent('2fa_failed', info);
  throw new HttpError(400, 'validation_failed', message, { fields: { code: message }, attemptsLeft: r.remaining });
}

async function twoFactorStart() {
  if (await getTwoFactor()) throw new HttpError(409, 'already_on', 'Two-step sign-in is already on.');
  const creds = await getCredentials();
  const { secret, uri } = await startSetup(creds.username);
  return json({ ok: true, secret, uri });
}

async function twoFactorEnable(request, session) {
  const body = await readJson(request, 512);
  const { info, key } = await secondFactorLimit(request);
  const result = await finishSetup(typeof body.code === 'string' ? body.code : '');
  if (result.expired) throw new HttpError(400, 'setup_expired', 'This setup has expired. Press "Set up" to start again.');
  if (result.wrong) await wrongCode(key, info, 'That code is not right. Check the time on your phone is set automatically, then try the newest code.');
  await clearKey(key);
  await destroyOtherSessions(session.tokenHash);
  await logAuthEvent('2fa_enabled', info);
  return json({ ok: true, recoveryCodes: result.codes });
}

async function twoFactorDisable(request) {
  const body = await readJson(request, 1024);
  const { info, key } = await secondFactorLimit(request);
  const tfa = await getTwoFactor();
  if (!tfa) return json({ ok: true });
  const creds = await getCredentials();
  const password = typeof body.password === 'string' ? body.password.slice(0, 256) : '';
  const passOk = await verifyPassword(password, creds.hash);
  const used = passOk ? await useSecondFactor(tfa, typeof body.code === 'string' ? body.code : '') : '';
  if (!passOk || !used) await wrongCode(key, info, 'The password or the code is not right.');
  await turnOff();
  await clearKey(key);
  await logAuthEvent('2fa_disabled', info);
  return json({ ok: true });
}

async function twoFactorNewRecovery(request) {
  const body = await readJson(request, 512);
  const { info, key } = await secondFactorLimit(request);
  const tfa = await getTwoFactor();
  if (!tfa) throw new HttpError(409, 'not_on', 'Two-step sign-in is off.');
  if (!(await useSecondFactor(tfa, typeof body.code === 'string' ? body.code : ''))) await wrongCode(key, info);
  const codes = await replaceRecoveryCodes(tfa);
  await clearKey(key);
  await logAuthEvent('recovery_codes_replaced', info);
  return json({ ok: true, recoveryCodes: codes });
}

export async function handleAdmin(request, url) {
  const session = await requireSession(request);
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') assertSameOrigin(request, url);
  const path = url.pathname.replace(/^\/api\/admin/, '') || '/';

  // Visitors' personal data (the inbox and backups) needs two-step sign-in to be on.
  if ((path.startsWith('/messages') || path === '/backup.json') && !(await twoStepReady())) {
    throw new HttpError(403, 'two_step_required', 'Turn on two-step sign-in (Security tab) to open your inbox. It keeps visitors’ messages safe even if your password leaks.');
  }
  if (path === '/messages' && method === 'GET') return listMessages(url);
  if (path === '/messages.csv' && method === 'GET') return exportCsv(request);
  if (path === '/backup.json' && method === 'GET') return backupJson(request);
  if (path === '/access-log.csv' && method === 'GET') return eventsCsv(request);
  if (path === '/messages/read-all' && method === 'POST') {
    await query('UPDATE pf_messages SET is_read = TRUE WHERE NOT is_read');
    return json({ ok: true, counts: await counts() });
  }
  const m = path.match(/^\/messages\/([^/]+)$/);
  if (m) {
    if (!UUID.test(m[1])) throw new HttpError(404, 'not_found', 'That message no longer exists.');
    if (method === 'PATCH') return updateMessage(request, m[1]);
    if (method === 'DELETE') return deleteMessage(request, m[1]);
    throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');
  }

  if (path === '/settings' && method === 'GET') return getSettings();
  if (path === '/content' && method === 'PUT') {
    const body = await readJson(request, 32 * 1024);
    const current = sanitizeStoredContent(await getSetting('content'));
    const content = validateContent(body.content, current);
    await setSetting('content', content);
    return json({ ok: true, content });
  }
  if (path === '/content/reset' && method === 'POST') {
    await deleteSetting('content');
    return json({ ok: true, content: sanitizeStoredContent(null) });
  }
  if (path === '/projects' && method === 'PUT') {
    const body = await readJson(request, 64 * 1024);
    const projects = validateProjects(body.projects);
    await setSetting('projects', projects);
    return json({ ok: true, projects });
  }
  if (path === '/github/refresh' && method === 'POST') {
    try {
      const data = await refreshGithub();
      return json({ ok: true, repos: data.repos, github: { source: 'live', fetchedAt: data.fetchedAt, profileUrl: data.profile.url } });
    } catch (err) {
      throw new HttpError(502, 'github_unavailable', 'GitHub could not be reached right now. The site keeps showing the last saved copy. Try again in a few minutes.', { detail: String(err.message || '').slice(0, 120) });
    }
  }

  if (path === '/security' && method === 'GET') return securityOverview(session);
  if (path === '/password' && method === 'POST') return changePassword(request, session);
  if (path === '/2fa/start' && method === 'POST') return twoFactorStart();
  if (path === '/2fa/enable' && method === 'POST') return twoFactorEnable(request, session);
  if (path === '/2fa/disable' && method === 'POST') return twoFactorDisable(request);
  if (path === '/2fa/recovery-codes' && method === 'POST') return twoFactorNewRecovery(request);
  if (path === '/sessions/revoke-others' && method === 'POST') {
    await destroyOtherSessions(session.tokenHash);
    await logAuthEvent('sessions_revoked', clientInfo(request));
    return json({ ok: true });
  }

  throw new HttpError(404, 'not_found', 'Not found.');
}
