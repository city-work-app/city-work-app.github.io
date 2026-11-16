/* effects.js — Kiné+ Visual Effects */

/* ─── PARTICLES ─────────────────────────────────────────── */

let _particleState = null;

function initParticles(config) {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (_particleState) { cancelAnimationFrame(_particleState.raf); _particleState = null; }

  const C = {
    color: config.color || 'rgba(255,255,255,0.4)',
    count: config.count || 30,
    kind: config.kind || 'dot',
  };

  let W = canvas.width = window.innerWidth;
  let H = canvas.height = window.innerHeight;
  let mx = -9999, my = -9999;

  const particles = Array.from({ length: C.count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: C.kind === 'orb' ? 2 + Math.random() * 4 : 1 + Math.random() * 2,
    vx: (Math.random() - 0.5) * 0.36,
    vy: (Math.random() - 0.5) * 0.36,
    phase: Math.random() * Math.PI * 2,
  }));

  const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  const onMove = e => { mx = e.clientX; my = e.clientY; };
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMove);

  let t = 0;
  function frame() {
    ctx.clearRect(0, 0, W, H);
    t += 0.016;

    for (const p of particles) {
      // cursor repulsion
      const dx = p.x - mx, dy = p.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120 && dist > 0) {
        const force = (120 - dist) / 120 * 0.6;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      // dampen
      p.vx *= 0.98;
      p.vy *= 0.98;
      // clamp velocity
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 1.5) { p.vx = (p.vx / speed) * 1.5; p.vy = (p.vy / speed) * 1.5; }
      p.x += p.vx; p.y += p.vy;
      // wrap
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      // twinkle alpha
      const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.2 + p.phase));

      if (C.kind === 'orb') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 8);
        grad.addColorStop(0, C.color.replace(/[\d.]+\)$/, `${alpha})`));
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = C.color.replace(/[\d.]+\)$/, `${alpha * parseFloat((C.color.match(/[\d.]+\)$/) || ['1)'])[0])}`);
        ctx.fill();
      }
    }

    _particleState.raf = requestAnimationFrame(frame);
  }

  _particleState = { raf: requestAnimationFrame(frame) };

  return () => {
    cancelAnimationFrame(_particleState.raf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMove);
  };
}

/* ─── CUSTOM CURSOR ─────────────────────────────────────── */

function initCursor() {
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.innerWidth < 900) return;

  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  let mx = 0, my = 0, rx = 0, ry = 0;
  let hovered = false;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
  });

  const hoverSelectors = 'button, a, [data-hover], .nav-item, .theme-tile, .card';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverSelectors)) { hovered = true; ring.classList.add('large'); }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverSelectors)) { hovered = false; ring.classList.remove('large'); }
  });

  function lerp() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(lerp);
  }
  lerp();
}

/* ─── 3D TILT ───────────────────────────────────────────── */

function attachTilt(el, { max = 6, perspective = 1200 } = {}) {
  if (!el) return;
  el.style.transformStyle = 'preserve-3d';
  // float children
  el.querySelectorAll(':scope > *').forEach(child => {
    child.style.transform = 'translateZ(20px)';
    child.style.transformStyle = 'preserve-3d';
  });

  el.addEventListener('mousemove', e => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * max;
    const ry = (x - 0.5) * max;
    el.style.transform = `perspective(${perspective}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  });

  el.addEventListener('mouseleave', () => {
    el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg)`;
    el.style.transition = 'transform 0.5s ease';
    setTimeout(() => { el.style.transition = ''; }, 500);
  });
}

function initTilts() {
  const heroCard = document.querySelector('.hero-card');
  if (heroCard) attachTilt(heroCard, { max: 3 });
  document.querySelectorAll('.stat-card').forEach(el => attachTilt(el, { max: 4 }));
  document.querySelectorAll('.reco-card').forEach(el => attachTilt(el, { max: 5 }));
  document.querySelectorAll('.train-card').forEach(el => attachTilt(el, { max: 4 }));
}

/* ─── THEME FLASH ───────────────────────────────────────── */

function themeFlash(x, y) {
  const flash = document.createElement('div');
  flash.className = 'theme-flash';
  flash.style.cssText = `
    position:fixed;inset:0;z-index:9000;pointer-events:none;
    background:radial-gradient(circle at ${x}px ${y}px, var(--accent-soft), transparent 60%);
    animation:themeMorph 0.7s ease forwards;
  `;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 700);
}

/* ─── RING PROGRESS ─────────────────────────────────────── */

function initRingProgress(svgId, pct) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const circle = svg.querySelector('.ring-fill');
  if (!circle) return;
  const r = parseFloat(circle.getAttribute('r'));
  const circ = 2 * Math.PI * r;
  circle.style.strokeDasharray = circ;
  circle.style.strokeDashoffset = circ;
  setTimeout(() => {
    circle.style.transition = 'stroke-dashoffset 1.2s ease';
    circle.style.strokeDashoffset = circ * (1 - pct / 100);
  }, 100);
}

/* ─── BAR CHART (7-day) ─────────────────────────────────── */

function initBarChart(containerId, values) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  const max = Math.max(...values);
  values.forEach((v, i) => {
    const bar = document.createElement('div');
    bar.className = 'mini-bar' + (i === values.length - 1 ? ' active' : '');
    bar.style.height = `${Math.max(8, (v / max) * 100)}%`;
    bar.style.animationDelay = `${i * 0.07}s`;
    el.appendChild(bar);
  });
}

/* ─── HEATMAP ───────────────────────────────────────────── */

function initHeatmap(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  data.forEach((v, i) => {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.style.opacity = v === 0 ? '0' : '1';
    if (v > 0) {
      cell.style.background = `color-mix(in srgb, var(--accent) ${Math.round(20 + v * 80)}%, transparent)`;
    } else {
      cell.style.background = 'color-mix(in srgb, var(--border-strong) 30%, transparent)';
      cell.style.opacity = '1';
    }
    cell.style.animationDelay = `${i * 0.004}s`;
    el.appendChild(cell);
  });
}

/* ─── INIT ALL ──────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Particles
  const saved = localStorage.getItem('kineplus.theme') || 'rose-noir';
  const theme = (typeof DASH_THEMES !== 'undefined') && DASH_THEMES.find(t => t.id === saved);
  if (theme) initParticles(theme.particle);

  // Cursor désactivé
  // initCursor();

  // Tilts (after short delay so DOM is ready)
  setTimeout(initTilts, 50);

  // Ring
  initRingProgress('ring-svg', 72);

  // 7-day bars
  initBarChart('bars-7day', [6, 14, 9, 20, 18, 25, 30]);

  // Heatmap (14×7 = 98 cells, column-major order)
  const heatData = generateHeatData();
  initHeatmap('heatmap-grid', heatData);
});

function generateHeatData() {
  const cells = [];
  const totalCells = 14 * 7;
  const recentDays = 29;

  for (let col = 0; col < 14; col++) {
    for (let row = 0; row < 7; row++) {
      const dayIndex = col * 7 + row;
      const daysFromEnd = totalCells - 1 - dayIndex;
      let v = 0;
      if (daysFromEnd < recentDays) {
        v = 0.4 + Math.random() * 0.6;
      } else {
        v = Math.random() < 0.35 ? 0.1 + Math.random() * 0.6 : 0;
      }
      cells.push(v);
    }
  }
  return cells;
}
