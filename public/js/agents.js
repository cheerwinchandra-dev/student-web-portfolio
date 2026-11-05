// Agent cursors that build the page as you scroll.
//
// The first time a part of the page scrolls into view, a coloured cursor flies
// out of the bar at the bottom of the screen, drags out a selection frame over
// that part (corner handles, a live size tag, guides and a ruler) and drops the
// content into the frame with its usual entrance animation. When everything on
// screen is built the cursors shrink back into the bar, so nothing moves while
// you read. Going back up never rebuilds anything, and a part that has waited
// on screen for a moment simply appears.
//
// site.js hands every part to add(el, done). done(mode) shows it: 'build' and
// 'auto' play its entrance animation, 'snap' shows it at once. The hero's text
// is held back here (class cw-wait) so the cursors can build it on load.
//
// Everything is drawn on one canvas above the page, so clicks and the page's
// own design are untouched. Pressing ×, or any error, shows everything at
// once. Not started for "reduce motion".

const COLORS = ['#ff6b81', '#ff9f43', '#feca57', '#1dd1a1', '#48dbfb', '#54a0ff', '#a29bfe', '#ff7eb3', '#7bed9f', '#f1f2f6'];
const BLUE = '#2b7bff';
const RED = '#ff4545';
const OFF_KEY = 'cw-agents-off';
// The arrow's own direction (tail to tip), used to point it along its path.
const ARROW_DIR = Math.atan2(-16, -6);
const HERO_ITEMS = '.hero [data-anim]';
const TEXT_KIND = '.h-section, .lead, .closing, .signature, .about__paras, .dots, .contact-list, .hero__tags, .hero__lines, .quote, .name, .role, .bio';
const MEDIA_KIND = '.about__photo, .qr, .work';
const INTRO = 0.8; // seconds the cursors circle the badge on load
const WAIT_LIMIT = 800; // ms a part may wait on screen for a free cursor before it just appears
const QUIET = 1200; // ms without scrolling after which a newly shown part just appears

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function storageGet(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode: the choice lasts until the page is closed */
  }
}

export function startAgents({ getLenis = () => null } = {}) {
  if (storageGet(OFF_KEY) === '1') return null;
  try {
    return createBuilder(getLenis);
  } catch (err) {
    console.warn('Agent cursors unavailable', err);
    return null;
  }
}

function createBuilder(getLenis) {
  const doc = document.documentElement;
  const small = window.matchMedia('(max-width: 760px)').matches;
  const COUNT = small ? 5 : 8;
  const SCALE = small ? 0.74 : 0.88;
  const DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  const bodyFont = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const off = new AbortController();
  const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: off.signal });

  // ---------------------------------------------------------------- canvas + bar
  const canvas = document.createElement('canvas');
  canvas.className = 'agents';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  const hud = document.createElement('div');
  hud.className = 'agent-hud';
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', 'Cursor animation');
  const faces = document.createElement('span');
  faces.className = 'agent-hud__faces';
  faces.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i++) {
    const f = document.createElement('i');
    f.style.background = COLORS[i % COLORS.length];
    faces.append(f);
  }
  const statAgents = document.createElement('span');
  statAgents.className = 'agent-hud__stat';
  const sep = document.createElement('span');
  sep.className = 'agent-hud__sep';
  sep.setAttribute('aria-hidden', 'true');
  const statLayers = document.createElement('span');
  statLayers.className = 'agent-hud__stat agent-hud__stat--dim';
  const bar = document.createElement('span');
  bar.className = 'agent-hud__bar';
  bar.setAttribute('aria-hidden', 'true');
  const barFill = document.createElement('i');
  bar.append(barFill);
  const mkBtn = (text, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'agent-hud__btn';
    b.textContent = text;
    if (label) b.setAttribute('aria-label', label);
    return b;
  };
  const tourBtn = mkBtn('Tour', 'Tour: scroll through the whole page');
  tourBtn.setAttribute('aria-pressed', 'false');
  const speedBtn = mkBtn('1x', 'Animation speed: 1x');
  const closeBtn = mkBtn('×', 'Hide the cursor animation');
  closeBtn.classList.add('agent-hud__btn--close');
  hud.append(faces, statAgents, sep, statLayers, bar, tourBtn, speedBtn, closeBtn);
  document.body.append(canvas, hud);

  let W = 0;
  let H = 0;
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  };
  resize();

  // ---------------------------------------------------------------- parts of the page
  const items = new Map(); // el -> { el, kind, state: queued|claimed|built, done[], seen, box, agent, gate, mode }
  const gated = new Set();
  const showAtOnce = new WeakSet(); // focused before site.js handed them over
  let alive = true;
  let speed = 1;
  let introT = 0;
  let lastScrollAt = -1e9;
  let lastUpAt = -1e9;
  let prevY = window.scrollY;

  const kindOf = (el) => (el.matches(MEDIA_KIND) ? 'media' : el.matches(TEXT_KIND) ? 'text' : 'block');

  // Where an element sits once it has arrived: offsets ignore the entrance
  // transforms (slide, scale) that a hidden part still has.
  const layoutBox = (el) => {
    let x = 0;
    let y = 0;
    for (let n = el; n; n = n.offsetParent) {
      x += n.offsetLeft + (n === el ? 0 : n.clientLeft);
      y += n.offsetTop + (n === el ? 0 : n.clientTop);
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const view = (b) => {
    const left = b.x - window.scrollX;
    const top = b.y - window.scrollY;
    return { left, top, width: b.w, height: b.h, right: left + b.w, bottom: top + b.h };
  };

  const ungate = (el, mode) => {
    if (mode === 'snap') {
      el.classList.add('cw-snap');
      el.classList.remove('cw-wait');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('cw-snap')));
    } else {
      el.classList.add('cw-now');
      el.classList.remove('cw-wait');
    }
  };

  const annos = []; // selection frames: { item, color, kind, p, a, held, placed, life }
  const annoOf = (item) => annos.find((n) => n.item === item);
  const dropAnno = (item) => {
    const n = annoOf(item);
    if (n) n.held = false;
  };

  // Shows a part (once) and lets go of any cursor that was on its way to it.
  const finish = (item, mode) => {
    if (item.state === 'built') return;
    item.state = 'built';
    item.mode = mode;
    const a = item.agent;
    item.agent = null;
    if (a && a.item === item) {
      a.item = null;
      a.state = 'home';
      dropAnno(item);
    }
    if (mode === 'build' && item.el.hasAttribute('data-reveal')) item.el.style.setProperty('--d', '0');
    if (item.gate) ungate(item.el, mode);
    for (const fn of item.done.splice(0)) {
      try {
        fn(mode);
      } catch (err) {
        console.warn('Could not show part of the page', err);
      }
    }
  };

  const add = (el, done = () => {}, { build = false, gate = false } = {}) => {
    if (!alive) {
      done('build');
      return;
    }
    const known = items.get(el);
    if (known) {
      if (known.state === 'built') done(known.mode);
      else known.done.push(done);
      return;
    }
    const item = { el, kind: kindOf(el), state: 'queued', done: [done], seen: 0, box: layoutBox(el), agent: null, gate, mode: '' };
    items.set(el, item);
    if (gate) {
      gated.add(el);
      el.classList.add('cw-wait');
    }
    const r = view(item.box);
    const now = performance.now();
    if (showAtOnce.has(el)) finish(item, 'snap');
    // Above the top of the screen: you have passed it or are going back up.
    else if (r.top < 0) finish(item, 'snap');
    else if (!build && now - lastUpAt < 450) finish(item, 'snap');
    // Nobody is scrolling (a late update, say): just show it.
    else if (!build && introT > 2.5 && now - lastScrollAt > QUIET) finish(item, 'auto');
  };

  on(window, 'scroll', () => {
    const y = window.scrollY;
    const now = performance.now();
    if (y !== prevY) lastScrollAt = now;
    if (y < prevY - 1) lastUpAt = now;
    prevY = y;
  }, { passive: true });
  // Tabbing into a part that is still waiting shows it at once.
  on(document, 'focusin', (e) => {
    for (const item of items.values()) if (item.state !== 'built' && item.el.contains(e.target)) finish(item, 'snap');
    const host = e.target instanceof Element ? e.target.closest('[data-reveal]') : null;
    if (host && !items.has(host)) showAtOnce.add(host);
  });
  on(window, 'beforeprint', () => {
    for (const item of items.values()) finish(item, 'snap');
  });

  // ---------------------------------------------------------------- agents
  const agents = [];
  for (let i = 0; i < COUNT; i++) {
    agents.push({
      color: COLORS[i % COLORS.length],
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      s: 1,
      state: 'intro', // intro -> travel -> draw -> place -> (travel | home -> dock)
      t: 0,
      item: null,
      placed: null,
      dur: 0.3,
      curve: 0,
      angle: 0,
      trail: [],
      orbit: (i / COUNT) * Math.PI * 2,
      ring: 34 + (i % 3) * 14,
      delay: i * 0.05
    });
  }

  let footerSeen = false;
  const dockPoint = () => {
    if (hud.classList.contains('is-tucked') || doc.classList.contains('has-pc')) return { x: W / 2, y: H + 40 };
    const r = faces.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const assign = (a, item, dock) => {
    a.item = item;
    item.agent = a;
    item.state = 'claimed';
    if (a.state === 'dock') {
      a.x = dock.x;
      a.y = dock.y;
      a.vx = 0;
      a.vy = 0;
      a.trail.length = 0;
    }
    a.state = 'travel';
    a.t = 0;
    a.curve = rand(-0.8, 0.8);
  };

  // ---------------------------------------------------------------- bar + buttons
  let tour = false;
  let raf = 0;
  const setTour = (v) => {
    tour = v;
    tourBtn.setAttribute('aria-pressed', String(v));
    tourBtn.classList.toggle('is-on', v);
  };
  const stopTour = () => {
    if (!tour) return;
    setTour(false);
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  };
  on(tourBtn, 'click', () => {
    if (tour) return stopTour();
    const max = doc.scrollHeight - H;
    if (max <= 0) return;
    const dest = window.scrollY > max - 60 ? 0 : max;
    const seconds = clamp(Math.abs(dest - window.scrollY) / 300, 3, 40) / speed;
    setTour(true);
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(dest, { duration: seconds, easing: (t) => (t < 0.5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2), force: true, onComplete: () => setTour(false) });
    } else {
      window.scrollTo({ top: dest, behavior: 'smooth' });
      setTimeout(() => setTour(false), 1500);
    }
  });
  // Your own scrolling always takes over from a tour.
  for (const type of ['wheel', 'touchstart', 'keydown']) {
    on(window, type, (e) => {
      if (tour && !(e.target instanceof Node && hud.contains(e.target))) stopTour();
    }, { passive: true });
  }
  on(speedBtn, 'click', () => {
    speed = speed === 1 ? 2 : 1;
    speedBtn.textContent = `${speed}x`;
    speedBtn.setAttribute('aria-label', `Animation speed: ${speed}x`);
  });

  let footerIO = null;
  const teardown = () => {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    stopTour();
    off.abort();
    footerIO?.disconnect();
    for (const item of items.values()) {
      item.agent = null;
      finish(item, 'build');
    }
    canvas.remove();
    hud.remove();
  };
  on(closeBtn, 'click', () => {
    storageSet(OFF_KEY, '1');
    teardown();
  });

  // Tuck the bar away over the footer so it never covers its links.
  const footer = document.querySelector('footer');
  if (footer && 'IntersectionObserver' in window) {
    footerIO = new IntersectionObserver(([e]) => {
      footerSeen = e.isIntersecting;
    });
    footerIO.observe(footer);
  }

  let built = 0;
  let total = 0;
  let allBuiltAt = 0;
  let nextCount = 0;
  const countParts = (now) => {
    let t = 0;
    let b = 0;
    for (const el of document.querySelectorAll('[data-reveal]')) {
      if (!el.offsetParent) continue; // not shown (e.g. extra projects before "View all")
      t++;
      const item = items.get(el);
      if (el.classList.contains('is-in') || (item && item.state === 'built')) b++;
    }
    for (const el of gated) {
      if (!el.isConnected) continue;
      t++;
      if (items.get(el)?.state === 'built') b++;
    }
    total = t;
    built = b;
    if (b >= t) allBuiltAt ||= now;
    else allBuiltAt = 0;
  };

  let hudShown = '';
  const updateHud = (now, busy) => {
    if (now > nextCount) {
      nextCount = now + 300;
      countParts(now);
    }
    const starting = introT < INTRO + 0.3;
    const text = starting ? 'Building page…|' : `${COUNT} agents|${built} / ${total} built`;
    if (text !== hudShown) {
      hudShown = text;
      const [s1, s2] = text.split('|');
      statAgents.textContent = s1;
      statLayers.textContent = s2;
      sep.hidden = starting;
      statLayers.hidden = starting;
    }
    barFill.style.transform = `scaleX(${(total ? built / total : 0).toFixed(3)})`;
    // Out of the way over the footer, and once the whole page is built.
    const finished = allBuiltAt && !busy && now - allBuiltAt > 1200;
    // Also while the privacy choices are open (js/privacy.js), which sit in the same spot.
    const tucked = footerSeen || Boolean(finished) || doc.classList.contains('has-pc');
    if (tucked !== hud.classList.contains('is-tucked')) {
      hud.classList.toggle('is-tucked', tucked);
      hud.inert = tucked; // hidden buttons must not take keyboard focus either
    }
  };

  const refreshBoxes = () => {
    for (const item of items.values()) if (item.state !== 'built') item.box = layoutBox(item.el);
  };
  on(window, 'cw:rendered', () => setTimeout(refreshBoxes, 50));
  on(window, 'resize', () => {
    resize();
    refreshBoxes();
  });
  requestAnimationFrame(() => hud.classList.add('is-in'));

  // ---------------------------------------------------------------- drawing helpers
  const arrow = (x, y, scale, angle) => {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16.5);
    ctx.lineTo(4.3, 12.6);
    ctx.lineTo(7.2, 18.8);
    ctx.lineTo(9.9, 17.6);
    ctx.lineTo(7.1, 11.6);
    ctx.lineTo(12.4, 11.6);
    ctx.closePath();
    ctx.restore();
  };
  const handle = (x, y) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeRect(x - 3, y - 3, 6, 6);
  };
  const pill = (x, y, text, bg) => {
    ctx.font = `600 10px ${bodyFont}`;
    const w = Math.ceil(ctx.measureText(text).width) + 10;
    const h = 16;
    const left = clamp(x - w / 2, 4, W - w - 4);
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(left, y, w, h, 3);
    else ctx.rect(left, y, w, h);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 5, y + h / 2 + 0.5);
  };
  const plus = (x, y, color, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
  };

  // ---------------------------------------------------------------- loop
  const pins = [];
  const guide = { x: 0, tx: 0, a: 0 };
  let rulerA = 0;
  let lastT = 0;
  let cleared = false;
  let nextBoxes = 0;

  const frame = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    try {
      step(now);
    } catch (err) {
      console.warn('Agent cursors stopped', err);
      teardown();
    }
  };

  const tickItems = (now) => {
    const refresh = now > nextBoxes;
    if (refresh) nextBoxes = now + 600;
    for (const item of items.values()) {
      if (item.state === 'built') continue;
      if (!item.el.isConnected) {
        // Replaced by a re-render: the new element arrives through add().
        if (item.agent) finish(item, 'snap');
        items.delete(item.el);
        continue;
      }
      if (refresh || item.agent) item.box = layoutBox(item.el);
      const r = view(item.box);
      if (r.bottom <= 0) {
        finish(item, 'snap'); // scrolled past before a cursor got to it
        continue;
      }
      const inView = r.top < H - 24 && r.bottom > 24 && r.width > 0;
      if (!inView) {
        item.seen = 0;
        if (item.agent) {
          // You went back up before it was built: it waits for your return.
          const a = item.agent;
          item.agent = null;
          item.state = 'queued';
          a.item = null;
          a.state = 'home';
          dropAnno(item);
        }
        continue;
      }
      // The wait only counts once the cursors are free to come (not during the intro).
      if (!item.seen || introT < INTRO) item.seen = now;
      // Going back up, or already half past the top of the screen: just show it.
      if (now - lastUpAt < 450 || (!item.agent && r.top < 0)) finish(item, 'snap');
      else if (!item.agent && introT >= INTRO && now - item.seen > WAIT_LIMIT) finish(item, 'auto');
    }
  };

  const step = (now) => {
    const dtReal = lastT ? Math.min((now - lastT) / 1000, 0.05) : 1 / 60;
    lastT = now;
    const dt = dtReal * speed;
    const sy = window.scrollY;
    introT += dt;

    tickItems(now);
    const dock = dockPoint();

    // Free cursors take the waiting parts, top of the page first, nearest cursor first.
    if (introT >= INTRO) {
      const free = agents.filter((a) => a.state === 'dock' || a.state === 'home');
      if (free.length) {
        const waiting = [];
        for (const item of items.values()) if (item.state === 'queued' && item.seen) waiting.push(item);
        waiting.sort((p, q) => p.box.y - q.box.y || p.box.x - q.box.x);
        for (const item of waiting) {
          if (!free.length) break;
          const r = view(item.box);
          let best = 0;
          let bestD = Infinity;
          free.forEach((a, i) => {
            const ax = a.state === 'dock' ? dock.x : a.x;
            const ay = a.state === 'dock' ? dock.y : a.y;
            const d = Math.hypot(ax - r.left, ay - r.top);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          });
          assign(free.splice(best, 1)[0], item, dock);
        }
      }
    }

    // ------------------------------------------------ move agents
    let busy = false;
    let drawing = false;
    for (const a of agents) {
      if (a.state === 'dock') continue;
      a.t += dt;
      let tx = a.x;
      let ty = a.y;
      let stiff = 260;
      let direct = null;

      if (a.state === 'intro') {
        a.orbit += dt * 2.6;
        tx = W / 2 + Math.cos(a.orbit) * a.ring * 1.35;
        ty = H / 2 + Math.sin(a.orbit) * a.ring;
        if (introT > INTRO + a.delay) a.state = 'home';
      } else if (a.state === 'travel' && a.item) {
        busy = true;
        const r = view(a.item.box);
        tx = r.left;
        ty = r.top;
        const d = Math.hypot(tx - a.x, ty - a.y);
        if (a.t < 0.3 && d > 40) {
          // Curved approach: bend the path sideways while far away.
          const nx = -(ty - a.y) / d;
          const ny = (tx - a.x) / d;
          tx += nx * a.curve * d * 0.22;
          ty += ny * a.curve * d * 0.22;
        }
        if (d < 10 || a.t > 0.45) {
          a.state = 'draw';
          a.t = 0;
          a.dur = clamp(0.16 + Math.hypot(r.width, r.height) / 4200, 0.2, 0.32);
          annos.push({ item: a.item, color: a.color, kind: a.item.kind, p: 0, a: 0, held: true, placed: false, life: 0 });
          guide.tx = r.left;
        }
      } else if (a.state === 'draw' && a.item) {
        busy = true;
        drawing = true;
        const item = a.item;
        const r = view(item.box);
        const p = ease(clamp(a.t / a.dur, 0, 1));
        const n = annoOf(item);
        if (n) n.p = p;
        direct = { x: r.left + r.width * p, y: r.top + r.height * p };
        if (a.t >= a.dur) {
          // Frame drawn: drop the content in.
          a.item = null;
          item.agent = null;
          finish(item, 'build');
          if (n) n.placed = true;
          a.placed = item;
          a.state = 'place';
          a.t = 0;
          pins.push({ x: r.right, docY: r.top + sy, color: a.color, life: 0.8 });
          if (Math.random() < 0.5) pins.push({ x: r.left, docY: r.bottom + sy, color: a.color, life: 0.8 });
        }
      } else if (a.state === 'place' && a.placed) {
        busy = true;
        drawing = true;
        const r = view(a.placed.box);
        tx = r.right;
        ty = r.bottom;
        stiff = 260;
        if (a.t > 0.12) {
          a.placed = null;
          a.state = 'home';
          a.t = 0;
        }
      } else {
        // Nothing to build: shrink back into the bar.
        a.state = 'home';
        a.item = null;
        tx = dock.x;
        ty = dock.y;
        stiff = 130;
        if (Math.hypot(tx - a.x, ty - a.y) < 14) {
          a.state = 'dock';
          a.vx = 0;
          a.vy = 0;
          a.trail.length = 0;
          continue;
        }
      }

      if (direct) {
        const h = Math.max(dt, 1e-3);
        a.vx = (direct.x - a.x) / h;
        a.vy = (direct.y - a.y) / h;
        a.x = direct.x;
        a.y = direct.y;
      } else {
        // Spring towards the target, slightly underdamped for a lively settle.
        // Small fixed steps keep it stable at 2x speed and on slow frames.
        const damp = 2 * Math.sqrt(stiff) * 0.82;
        const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
        const h = dt / steps;
        for (let k = 0; k < steps; k++) {
          a.vx += ((tx - a.x) * stiff - a.vx * damp) * h;
          a.vy += ((ty - a.y) * stiff - a.vy * damp) * h;
          const v = Math.hypot(a.vx, a.vy);
          if (v > 3400) {
            a.vx *= 3400 / v;
            a.vy *= 3400 / v;
          }
          a.x += a.vx * h;
          a.y += a.vy * h;
        }
      }
      // Small near the bar, full size once out on the page.
      a.s = a.state === 'intro' ? 1 : clamp(Math.hypot(a.x - dock.x, a.y - dock.y) / 150, 0.15, 1);
      const sp = Math.hypot(a.vx, a.vy);
      // Lean the arrow into fast moves, tip first; upright when it slows down.
      const lean = a.state === 'draw' ? 0 : clamp((sp - 250) / 900, 0, 1);
      const head = Math.atan2(a.vy, a.vx) - ARROW_DIR;
      const want = Math.atan2(Math.sin(head), Math.cos(head)) * lean;
      let diff = want - a.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.angle += diff * clamp(dtReal * 10, 0, 1);
      a.trail.unshift({ x: a.x, y: a.y, sp });
      if (a.trail.length > 7) a.trail.length = 7;
    }

    // ------------------------------------------------ frames, guide, ruler, pins
    for (let i = annos.length - 1; i >= 0; i--) {
      const n = annos[i];
      if (n.placed) {
        n.life += dtReal;
        if (n.life > 0.3) n.held = false;
      }
      n.a += ((n.held ? 1 : 0) - n.a) * clamp(dtReal * (n.held ? 16 : 6), 0, 1);
      if (!n.held && n.a < 0.02) annos.splice(i, 1);
    }
    guide.x = guide.x ? guide.x + (guide.tx - guide.x) * clamp(dtReal * 10, 0, 1) : guide.tx;
    guide.a += ((drawing && guide.tx > 16 && guide.tx < W - 16 ? 0.7 : 0) - guide.a) * clamp(dtReal * 6, 0, 1);
    rulerA += ((busy ? 1 : 0) - rulerA) * clamp(dtReal * 6, 0, 1);
    for (let i = pins.length - 1; i >= 0; i--) {
      pins[i].life -= dtReal;
      if (pins[i].life <= 0) pins.splice(i, 1);
    }
    if (pins.length > 40) pins.splice(0, pins.length - 40);

    updateHud(now, busy || agents.some((a) => a.state !== 'dock'));

    // Nothing on screen: clear once, then skip drawing until there is.
    const idle = introT > INTRO + 0.6 && !annos.length && !pins.length && rulerA < 0.01 && guide.a < 0.01 && agents.every((a) => a.state === 'dock');
    if (idle) {
      if (!cleared) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cleared = true;
      }
      return;
    }
    cleared = false;
    draw(sy);
  };

  const draw = (sy) => {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';

    // The badge the cursors circle on load.
    if (introT < INTRO + 0.5) {
      ctx.globalAlpha = clamp(introT < INTRO ? 1 : 1 - (introT - INTRO) / 0.5, 0, 1);
      ctx.fillStyle = 'rgba(237, 220, 195, 0.12)';
      ctx.strokeStyle = 'rgba(237, 220, 195, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(W / 2 - 28, H / 2 - 28, 56, 56, 12);
      else ctx.rect(W / 2 - 28, H / 2 - 28, 56, 56);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#eddcc3';
      ctx.font = `700 15px ${bodyFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CC', W / 2, H / 2 + 1);
      ctx.textAlign = 'start';
    }

    // Ruler along the top while the page is being built.
    if (rulerA > 0.02) {
      ctx.globalAlpha = rulerA * 0.85;
      ctx.fillStyle = 'rgba(12, 8, 8, 0.72)';
      ctx.fillRect(0, 3, W, 15);
      ctx.strokeStyle = 'rgba(237, 220, 195, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < W; x += 10) {
        const h = x % 100 === 0 ? 8 : x % 50 === 0 ? 5 : 3;
        ctx.moveTo(x + 0.5, 18);
        ctx.lineTo(x + 0.5, 18 - h);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(237, 220, 195, 0.7)';
      ctx.font = `600 8px ${bodyFont}`;
      ctx.textBaseline = 'top';
      for (let x = 100; x < W; x += 100) ctx.fillText(String(x), x + 3, 4);
    }

    // Red alignment guide on the left edge of the frame being drawn.
    if (guide.a > 0.02) {
      ctx.globalAlpha = guide.a;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(guide.x) + 0.5, 0);
      ctx.lineTo(Math.round(guide.x) + 0.5, H);
      ctx.stroke();
    }

    // Selection frames.
    for (const n of annos) {
      if (n.a < 0.02) continue;
      const r = view(n.item.box);
      if (r.bottom < -40 || r.top > H + 40) continue;
      const x = Math.round(r.left) + 0.5;
      const y = Math.round(r.top) + 0.5;
      const w = Math.max(1, Math.round(r.width * n.p));
      const h = Math.max(1, Math.round(r.height * n.p));
      ctx.globalAlpha = n.a;
      if (n.placed && n.held) {
        // Guides across the screen from the frame's top and bottom.
        ctx.globalAlpha = n.a * 0.28;
        ctx.strokeStyle = BLUE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.moveTo(0, y + h);
        ctx.lineTo(W, y + h);
        ctx.stroke();
        ctx.globalAlpha = n.a;
      }
      ctx.fillStyle = n.kind === 'media' ? 'rgba(120, 160, 225, 0.16)' : 'rgba(43, 123, 255, 0.08)';
      ctx.fillRect(x, y, w, h);
      if (!n.placed) {
        if (n.kind === 'media') {
          // Image placeholder: a cross from corner to corner.
          ctx.strokeStyle = 'rgba(43, 123, 255, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y + h);
          ctx.moveTo(x + w, y);
          ctx.lineTo(x, y + h);
          ctx.stroke();
        } else if (n.kind === 'text' && h > 16 && w > 14) {
          // A new text box with its caret waiting at the start.
          const ch = Math.min(h - 10, 22);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + 7, y + 5);
          ctx.lineTo(x + 7, y + 5 + ch);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = 1;
      handle(x, y);
      if (n.placed) {
        handle(x + w, y);
        handle(x, y + h);
        handle(x + w, y + h);
        if (w > 140 && h > 60) {
          handle(x + w / 2, y);
          handle(x + w / 2, y + h);
          handle(x, y + h / 2);
          handle(x + w, y + h / 2);
        }
      }
      const labelY = y + h + 6 + 16 < H ? y + h + 6 : y - 22;
      pill(x + w / 2, labelY, `${w} × ${h}`, BLUE);
    }

    // Crosshair pins left at the corners of new frames.
    for (const p of pins) plus(p.x, p.docY - sy, p.color, clamp(p.life / 0.6, 0, 1) * 0.9);

    // The cursors, with a short trail of ghost arrows when they move fast.
    for (const a of agents) {
      if (a.state === 'dock') continue;
      const scale = SCALE * a.s;
      ctx.globalAlpha = clamp(a.s * 1.4, 0, 1);
      for (let i = 2; i < a.trail.length; i += 2) {
        const g = a.trail[i];
        if (g.sp < 380) continue;
        ctx.globalAlpha = (1 - i / a.trail.length) * 0.45 * a.s;
        ctx.fillStyle = a.color;
        arrow(g.x, g.y, scale * 0.9, a.angle);
        ctx.fill();
      }
      ctx.globalAlpha = clamp(a.s * 1.4, 0, 1);
      ctx.fillStyle = a.color;
      ctx.strokeStyle = 'rgba(10, 6, 6, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 8;
      arrow(a.x, a.y, scale, a.angle);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  // The hero's text waits for the cursors (unless the page opened further down).
  try {
    for (const el of document.querySelectorAll(HERO_ITEMS)) {
      const r = view(layoutBox(el));
      if (r.bottom > 0) add(el, () => {}, { build: true, gate: true });
    }
  } catch (err) {
    teardown();
    throw err;
  }

  raf = requestAnimationFrame(frame);
  return { add, stop: teardown };
}
