// The one Vercel Function. vercel.json rewrites every /api/* request here
// (as /api/router?__path=…), and lib/app.js routes it.
//
// Vercel's network sets the visitor's IP address and country on every request
// and overwrites any values a visitor sends, so they are safe to use for rate
// limits. They are handed to the app here, never read from headers elsewhere.
import { waitUntil } from '@vercel/functions';
import { handle } from '../lib/app.js';

function platformFor(request) {
  const h = request.headers;
  const ip = (h.get('x-vercel-forwarded-for') || h.get('x-real-ip') || h.get('x-forwarded-for') || '').split(',')[0].trim();
  const country = (h.get('x-vercel-ip-country') || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  return { ip, country, waitUntil };
}

const run = (request) => handle(request, platformFor(request));

export const GET = run;
export const HEAD = run;
export const POST = run;
export const PUT = run;
export const PATCH = run;
export const DELETE = run;
export const OPTIONS = run;
