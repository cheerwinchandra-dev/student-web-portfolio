// Password setup page: makes ADMIN_PASSWORD_HASH and CRON_SECRET in the browser.
import { hashPassword, randomToken } from './shared/crypto.js';
import { passwordProblem } from './shared/password.js';

const form = document.getElementById('setup-form');
const msg = document.getElementById('su-msg');
const out = document.getElementById('su-out');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const a = document.getElementById('su-pass').value;
  const b = document.getElementById('su-pass2').value;
  out.hidden = true;
  msg.classList.remove('is-ok');
  const problem = passwordProblem(a, 'cheerwin');
  if (problem) {
    msg.textContent = problem;
    return;
  }
  if (a !== b) {
    msg.textContent = 'The two passwords don’t match.';
    return;
  }
  const btn = form.querySelector('.btn');
  btn.classList.add('is-loading');
  btn.disabled = true;
  try {
    document.getElementById('su-hash').value = await hashPassword(a);
    document.getElementById('su-cron').value = randomToken(32);
    msg.classList.add('is-ok');
    msg.textContent = 'Done. Copy both values into Vercel.';
    out.hidden = false;
    document.getElementById('su-pass').value = '';
    document.getElementById('su-pass2').value = '';
  } catch {
    msg.textContent = 'This browser can’t create the hash. Try a current version of Chrome, Edge, Firefox or Safari.';
  } finally {
    btn.classList.remove('is-loading');
    btn.disabled = false;
  }
});

for (const b of document.querySelectorAll('[data-copy]')) {
  b.addEventListener('click', async () => {
    const field = document.getElementById(b.getAttribute('data-copy'));
    try {
      await navigator.clipboard.writeText(field.value);
      b.textContent = 'Copied';
    } catch {
      field.select();
      b.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => (b.textContent = 'Copy'), 2000);
  });
}
