#!/usr/bin/env node
// Creates the values for your Vercel environment variables.
//
//   npm run hash-password            -> prints ADMIN_PASSWORD_HASH and CRON_SECRET
//   npm run hash-password -- --local -> also saves them to .env.local for "npm run dev"
//
// Only a PBKDF2 hash is printed. The password itself never leaves this computer.
// (No Node.js? Open https://<your-site>/admin/setup in a browser instead.)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { hashPassword, randomToken } from '../lib/crypto.js';
import { askHidden } from './prompt.mjs';
import { passwordProblem } from '../public/js/shared/password.js';

const password = await askHidden('New admin password: ');
const again = await askHidden('Type it again: ');
if (password !== again) {
  console.error('\nThe two passwords do not match. Nothing was created.');
  process.exit(1);
}
const problem = passwordProblem(password, (process.env.ADMIN_USERNAME || 'cheerwin').trim());
if (problem) {
  console.error(`\n${problem} Nothing was created.`);
  process.exit(1);
}
const hash = await hashPassword(password);
const cron = randomToken(32);

console.log('\nAdd these in Vercel -> your project -> Settings -> Environment Variables, then redeploy:\n');
console.log(`  ADMIN_PASSWORD_HASH = ${hash}`);
console.log(`  CRON_SECRET         = ${cron}\n`);

if (process.argv.includes('--local')) {
  const file = '.env.local';
  const keep = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l && !/^(ADMIN_PASSWORD_HASH|CRON_SECRET)=/.test(l)) : [];
  writeFileSync(file, [...keep, `ADMIN_PASSWORD_HASH='${hash}'`, `CRON_SECRET='${cron}'`].join('\n') + '\n', { mode: 0o600 });
  console.log('Also saved to .env.local for local testing (this file is git-ignored).');
}
