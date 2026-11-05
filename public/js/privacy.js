// Privacy choices ("cookie banner"), shown on the first visit.
//
// The site has no ads, no analytics and no tracking cookies. The one optional
// extra: when this site's own server can't be reached, the visitor's browser
// may load the latest projects straight from GitHub, which shares the
// visitor's IP address with GitHub. That only happens after the visitor says
// yes here. Accept, Reject and Choose are the same size and equally easy, and
// "Privacy choices" in the footer brings this back at any time.
//
// The choice is kept in this browser only (localStorage "cw-privacy").

import { PRIVACY_VERSION } from './shared/defaults.js';

const KEY = 'cw-privacy';
const listeners = new Set();
let banner = null;

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v === 'object' && v.policy === PRIVACY_VERSION && typeof v.github === 'boolean') return v;
  } catch {
    /* storage blocked: ask again next time */
  }
  return null;
}

function save(github) {
  const v = { github, policy: PRIVACY_VERSION, at: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* the choice still applies to this visit */
  }
  current = v;
  for (const fn of listeners) fn(v);
}

let current = read();

/** True only after the visitor allowed loading projects straight from GitHub. */
export function allowsGithub() {
  return Boolean(current && current.github);
}

export function onPrivacyChange(fn) {
  listeners.add(fn);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function close() {
  if (!banner) return;
  banner.remove();
  banner = null;
  document.documentElement.classList.remove('has-pc');
}

/** Shows the privacy choices. `choose` opens the detailed options straight away. */
export function openPrivacyChoices({ choose = false, focus = false } = {}) {
  close();
  banner = el('section', 'pc');
  banner.setAttribute('aria-labelledby', 'pc-title');
  banner.setAttribute('role', 'region');

  const title = el('h2', 'pc__title', 'Your privacy');
  title.id = 'pc-title';
  const text = el('p', 'pc__text', 'No ads, no analytics, no tracking cookies. One optional extra: if my server is down, your browser can load my latest projects straight from GitHub, which shares your IP address with GitHub. ');
  const more = el('a', '', 'Details');
  more.href = '/privacy#cookies';
  text.append(more);

  const panel = el('div', 'pc__panel');
  panel.id = 'pc-panel';
  panel.hidden = !choose;
  const essential = el('label', 'pc__opt');
  const e1 = el('input');
  e1.type = 'checkbox';
  e1.checked = true;
  e1.disabled = true;
  const e2 = el('span');
  e2.append(el('b', '', 'Essential (always on). '), document.createTextNode('Remembers this choice and an unsent message draft in your browser, and keeps the site owner signed in. Nothing is shared.'));
  essential.append(e1, e2);
  const optional = el('label', 'pc__opt');
  const g1 = el('input');
  g1.type = 'checkbox';
  g1.id = 'pc-github';
  g1.checked = allowsGithub();
  const g2 = el('span');
  g2.append(el('b', '', 'Load projects from GitHub. '), document.createTextNode('Only used if my server is down. Your browser then contacts api.github.com (GitHub, Inc.), which sees your IP address.'));
  optional.append(g1, g2);
  panel.append(essential, optional);

  const actions = el('div', 'pc__actions');
  const accept = el('button', 'pc__btn', 'Accept');
  const reject = el('button', 'pc__btn', 'Reject');
  const chooseBtn = el('button', 'pc__btn', choose ? 'Save' : 'Choose');
  for (const b of [accept, reject, chooseBtn]) b.type = 'button';
  chooseBtn.setAttribute('aria-controls', 'pc-panel');
  chooseBtn.setAttribute('aria-expanded', String(choose));
  accept.addEventListener('click', () => {
    save(true);
    close();
  });
  reject.addEventListener('click', () => {
    save(false);
    close();
  });
  chooseBtn.addEventListener('click', () => {
    if (panel.hidden) {
      panel.hidden = false;
      chooseBtn.textContent = 'Save';
      chooseBtn.setAttribute('aria-expanded', 'true');
      g1.focus();
      return;
    }
    save(g1.checked);
    close();
  });
  actions.append(accept, reject, chooseBtn);

  banner.append(title, text, panel, actions);
  // First in the page, so keyboard users reach it straight away.
  document.body.prepend(banner);
  document.documentElement.classList.add('has-pc');
  if (focus) (choose ? g1 : accept).focus();
}

function init() {
  for (const b of document.querySelectorAll('[data-privacy-choices]')) {
    b.addEventListener('click', (e) => {
      e.preventDefault();
      openPrivacyChoices({ choose: true, focus: true });
    });
  }
  if (!current) openPrivacyChoices();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
