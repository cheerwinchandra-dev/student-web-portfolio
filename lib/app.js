// The API: one router for every /api/* request (one Vercel Function,
// api/router.js).

import { json, errorResponse, withApiHeaders, HttpError, runWithPlatform } from './http.js';
import { ensureSchema, getSetting, setSetting } from './db.js';
import { pruneRateLimits } from './rate-limit.js';
import { refreshGithub } from './github.js';
import { applyRetention } from './retention.js';
import { safeStringEqual } from './crypto.js';
import { handleSite, handleContact } from './routes/public.js';
import { handleLogin, handleLogout, handleSessionStatus } from './routes/auth.js';
import { handleAdmin } from './routes/admin.js';

function only(method, ...allowed) {
  if (!allowed.includes(method)) throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');
}

/**
 * The daily job: pulls your newest repositories, deletes messages and logs
 * that are past their keep-until date (lib/retention.js) and clears old
 * rate-limit rows.
 */
export async function runDailyJob(now = Date.now()) {
  const result = { ok: true };
  await ensureSchema();
  try {
    const data = await refreshGithub();
    result.repos = data.repos.length;
  } catch (err) {
    result.ok = false;
    result.github = `failed: ${String(err.message || err).slice(0, 120)}`;
  }
  try {
    Object.assign(result, await applyRetention(now));
  } catch (err) {
    result.ok = false;
    result.retention = `failed: ${String(err.message || err).slice(0, 120)}`;
  }
  await pruneRateLimits(now).catch(() => {});
  await setSetting('daily_job_at', now).catch(() => {});
  return result;
}

/**
 * GET /api/cron/daily: run by Vercel once a day (vercel.json). With a
 * CRON_SECRET set in Vercel, Vercel signs the call and nobody else can make
 * it. Without one, the job runs at most once every 10 minutes, whoever calls.
 */
async function handleCron(request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (!(await safeStringEqual(auth, `Bearer ${secret}`))) throw new HttpError(401, 'unauthorized', 'Not allowed.');
  } else {
    await ensureSchema();
    const last = Number(await getSetting('daily_job_at').catch(() => 0)) || 0;
    if (Date.now() - last < 10 * 60 * 1000) return json({ ok: true, skipped: 'ran recently' });
  }
  return json(await runDailyJob());
}

async function route(request, url) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === '/api/site') {
    only(method, 'GET', 'HEAD');
    // The public site still works (with default content) if the database is missing.
    await ensureSchema().catch((err) => console.warn('Database unavailable:', err.message));
    return handleSite();
  }
  if (pathname === '/api/cron/daily' || pathname === '/api/cron/github') {
    only(method, 'GET');
    return handleCron(request);
  }
  await ensureSchema();
  if (pathname === '/api/contact') {
    only(method, 'POST');
    return handleContact(request, url);
  }
  if (pathname === '/api/auth/login') {
    only(method, 'POST');
    return handleLogin(request, url);
  }
  if (pathname === '/api/auth/logout') {
    only(method, 'POST');
    return handleLogout(request, url);
  }
  if (pathname === '/api/auth/session') {
    only(method, 'GET');
    return handleSessionStatus(request);
  }
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    return handleAdmin(request, url);
  }
  throw new HttpError(404, 'not_found', 'Not found.');
}

/**
 * The address the visitor actually asked for. vercel.json rewrites /api/x/y to
 * /api/router?__path=x/y; locally (and if Vercel keeps the original path) the
 * request arrives as /api/x/y. Both give the same result.
 */
export function logicalUrl(request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/router' || url.pathname === '/api/router/') {
    url.pathname = '/api/' + (url.searchParams.get('__path') || '').replace(/^\/+/, '');
  }
  // Remove the routing helpers Vercel adds, so they never reach the handlers.
  url.searchParams.delete('__path');
  url.searchParams.delete('route');
  return url;
}

/**
 * Answers one API request. `platform` carries what the host knows about the
 * visitor: { ip, country, waitUntil } (from api/router.js on Vercel, or from
 * the local dev server).
 */
export function handle(request, platform = {}) {
  return runWithPlatform(platform, async () => {
    let response;
    try {
      response = await route(request, logicalUrl(request));
    } catch (err) {
      response = errorResponse(err);
    }
    return withApiHeaders(response);
  });
}
