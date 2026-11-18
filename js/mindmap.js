/* ════════════════════════════════════════════════════════════════════════
   Kiné+ — Cartes mentales v4 · tableau blanc infini (inspiré de Lucidspark)
   ─ js/mindmap.js       : cœur (état, rendu, mise en page automatique des
                           branches, souris / tactile / clavier, révision, accueil)
   ─ js/mindmap-extra.js : modèles kiné, imports (fiche, QCM, plan collé),
                           export PNG, miniatures, migration des anciennes cartes
   ─ mindmap.css         : styles (préfixe .km-)
   Stockage : kcu_maps (index des cartes) + kcu_map_<id> (contenu d'une carte)
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
if (window.KM && window.KM.__core) return;
const KM = window.KM = window.KM || {};
KM.__core = true;

/* ───────────────────────── Constantes ───────────────────────── */
const IDX_KEY = 'kcu_maps', MAP_PREFIX = 'kcu_map_', HINT_KEY = 'kcu_maps_hint', XP_KEY = 'kcu_maps_xp';
const SVGNS = 'http://www.w3.org/2000/svg';
const ZMIN = 0.1, ZMAX = 4;
const BRANCH = ['#f2711c', '#2f80ed', '#1fa463', '#9b51e0', '#e0a000', '#0ea5b7', '#e5486b', '#5b63e6'];
const STICKY = ['#ffe066', '#ffc078', '#ffa8a8', '#fcc2d7', '#d0bfff', '#a5d8ff', '#b2f2bb', '#e9ecef'];
const INK = ['auto', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5', '#868e96', '#ffffff'];
const HILITE = ['#ffd43b', '#8ce99a', '#74c0fc', '#faa2c1'];
const FILL = ['#ffffff', '#e9ecef', '#d0ebff', '#d3f9d8', '#fff3bf', '#ffe3e3', '#e5dbff', '#343a40'];
const FILL_LINE = ['#adb5bd', '#868e96', '#4dabf7', '#40c057', '#fab005', '#fa5252', '#845ef7', '#212529'];
const SHAPES = [['rect', 'Rectangle'], ['round', 'Arrondi'], ['ellipse', 'Ellipse'], ['diamond', 'Losange'], ['triangle', 'Triangle'], ['hexagon', 'Hexagone'], ['para', 'Parallélogramme'], ['star', 'Étoile'], ['cloud', 'Nuage']];
const POLY = {
  diamond: 'M50,1L99,50L50,99L1,50Z',
  triangle: 'M50,2L98,97L2,97Z',
  hexagon: 'M25,2L75,2L99,50L75,98L25,98L1,50Z',
  para: 'M22,2L99,2L78,98L1,98Z',
  star: (function () { let d = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? 21 : 49, a = -Math.PI / 2 + i * Math.PI / 5; d += (i ? 'L' : 'M') + (50 + r * Math.cos(a)).toFixed(1) + ',' + (53 + r * Math.sin(a)).toFixed(1); } return d + 'Z'; })(),
  cloud: 'M27,84C12,84 3,73 7,60C-2,50 6,32 22,34C23,16 42,7 56,16C64,4 86,8 88,26C100,29 103,48 93,58C101,72 89,86 74,84Z'
};
const TH = [7, 3.6, 2.4, 1.8];              // épaisseur des branches par profondeur
const th = d => TH[Math.max(0, Math.min(d, 3))];
const HG = d => d === 0 ? 72 : d === 1 ? 46 : 34;   // écart horizontal parent → enfants
const VG = d => d <= 1 ? 22 : d === 2 ? 12 : 8;     // écart vertical entre frères
const DVG = d => d === 0 ? 70 : 48;                 // disposition « organigramme »
const DHG = d => d <= 1 ? 28 : 16;
KM.C = { BRANCH, STICKY, INK, HILITE, FILL, FILL_LINE, POLY, SHAPES };

/* ───────────────────────── Utilitaires ───────────────────────── */
const uid = () => Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r1 = v => Math.round(v * 10) / 10;
const f1 = v => (Math.round(v * 10) / 10).toString();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
let BGD = null;   /* v5 : fond de la carte clair (false) ou sombre (true) ; null = thème du site */
const isDark = () => (BGD != null ? BGD : document.body.classList.contains('dark'));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function readJSON(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn('[cartes] stockage', e); return false; } }
function toast(msg, type) { if (typeof showNotif === 'function') showNotif(msg, type || 'ok'); else console.log('[cartes]', msg); }
function ago(t) {
  if (!t) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'à l’instant';
  if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
  if (s < 172800) return 'hier';
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function colHex(c, pal) {
  if (typeof c === 'number' && isFinite(c)) return pal[((c % pal.length) + pal.length) % pal.length];
  if (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) return c;
  return null;
}
const themeInk = () => (isDark() ? '#e9eaec' : '#1f2933');
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return 'rgb(' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(',') + ')'; }
function inkHex(c) { const h = colHex(c == null ? 0 : c, INK); return !h || h === 'auto' ? themeInk() : h; }
const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
function distSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
KM.uid = uid; KM.esc = esc; KM.norm = norm; KM.toast = toast; KM.colHex = colHex; KM.inkHex = inkHex; KM.readJSON = readJSON; KM.writeJSON = writeJSON;

/* ───────────────────────── Index des cartes ───────────────────────── */
let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  let a = readJSON(IDX_KEY, null);
  if (!Array.isArray(a)) {
    a = [];
    if (typeof KM.migrate === 'function') { try { a = KM.migrate() || []; } catch (e) { console.warn('[cartes] migration', e); a = []; } }
    writeJSON(IDX_KEY, a);
  }
  INDEX = a.filter(m => m && m.id);
  return INDEX;
}
function saveIndex() { return writeJSON(IDX_KEY, index()); }
function metaOf(id) { return index().find(m => m.id === id) || null; }
KM.index = index; KM.saveIndex = saveIndex; KM.metaOf = metaOf;

KM.createBoard = function (name, items, o) {
  o = o || {};
  const id = uid(), now = Date.now();
  items = items || [];
  if (!writeJSON(MAP_PREFIX + id, { v: 4, items, view: null })) { toast('Stockage du navigateur plein : impossible de créer la carte.', 'error'); return null; }
  index().unshift({ id, name: name || 'Nouvelle carte', created: now, updated: now, n: items.filter(i => i.k === 'node').length, courseId: o.courseId || null, th: '' });
  saveIndex();
  return id;
};
function deleteBoard(id) {
  const a = index(), i = a.findIndex(m => m.id === id);
  if (i >= 0) a.splice(i, 1);
  saveIndex();
  try { localStorage.removeItem(MAP_PREFIX + id); } catch (e) { /* rien */ }
}
function duplicateBoard(id) {
  const m = metaOf(id), d = readJSON(MAP_PREFIX + id, null);
  if (!m || !d) return null;
  const nid = KM.createBoard(m.name + ' (copie)', d.items || [], { courseId: m.courseId });
  const nm = nid && metaOf(nid);
  if (nm) { nm.th = m.th; nm.bgc = m.bgc; saveIndex(); }
  if (nid && (d.bg || d.theme)) { const nd = readJSON(MAP_PREFIX + nid, null); if (nd) { nd.bg = d.bg; nd.theme = d.theme; writeJSON(MAP_PREFIX + nid, nd); } }
  return nid;
}

/* ───────────────────────── État de l'éditeur ───────────────────────── */
let B = null;                         // carte ouverte {id, name, items}
let V = { x: 0, y: 0, z: 1 };         // vue : décalage écran + zoom
const byId = new Map();
const G = new Map();                  // géométrie calculée (monde) id → {x,y,w,h,…}
const SZ = new Map();                 // tailles mesurées id → {w,h}
const DIRTY = new Set();              // éléments à re-mesurer
const BH = new Map(), BW = new Map(); // hauteurs / largeurs de sous-arbres
const LG = new Map();                 // géométrie des connecteurs
let KIDS = new Map(), DEPTH = new Map(), ROOTS = new Map();
let BRANCHES = new Map(), BRSTROKES = new Map(), BRSEG = [];
let sel = new Set();
let tool = 'select';
const opt = { shape: 'round', penC: 0, penW: 3, hl: false, hlC: 0, stickyC: 0 };
let EDIT = null, P = null, REV = null, CLIP = null;
let E = null;                         // éléments DOM de l'éditeur
const IEL = new Map(), INKEL = new Map(), LNEL = new Map(), BREL = new Map();
const INKD = new WeakMap(), INKBB = new WeakMap();
let pending = false, spaceDown = false, ctxSig = '', VPR = null, animId = 0, inGesture = false;
let LAST_PT = null, lastTap = null, matches = [], matchI = -1;
const pointers = new Map();

const get = id => byId.get(id);
const isActive = () => !!(B && E && document.body.dataset.screen === 'mindmap-editor');
function rebuild() { byId.clear(); for (const it of B.items) byId.set(it.id, it); }

/* ───────────────────────── Arbres (cartes mentales) ───────────────────────── */
function computeTree() {
  KIDS = new Map(); DEPTH = new Map(); ROOTS = new Map();
  for (const it of B.items) {
    if (it.k !== 'node' || !it.p) continue;
    const par = byId.get(it.p);
    if (!par || par.k !== 'node' || par === it) {           // parent disparu → devient sujet central
      const g = G.get(it.id);
      it.p = null; it.x = g ? r1(g.x + g.w / 2) : 0; it.y = g ? r1(g.y + g.h / 2) : 0;
      continue;
    }
    const a = KIDS.get(it.p); a ? a.push(it) : KIDS.set(it.p, [it]);
  }
  KIDS.forEach(a => a.sort((x, y) => (x.o || 0) - (y.o || 0)));
}
function depth(id) {
  if (DEPTH.has(id)) return DEPTH.get(id);
  let d = 0, n = get(id); const seen = new Set();
  while (n && n.p) {
    if (seen.has(n.id)) { n.p = null; break; }                // cycle → on le casse
    seen.add(n.id); n = get(n.p); d++;
  }
  DEPTH.set(id, d);
  return d;
}
function rootOf(id) {
  if (ROOTS.has(id)) return ROOTS.get(id);
  let n = get(id); const seen = new Set();
  while (n && n.p && !seen.has(n.id)) { seen.add(n.id); n = get(n.p); }
  ROOTS.set(id, n);
  return n;
}
const kids = id => KIDS.get(id) || [];
function subtreeIds(id, out) { out = out || []; out.push(id); for (const k of kids(id)) subtreeIds(k.id, out); return out; }
function countDesc(id) { let c = 0; for (const k of kids(id)) c += 1 + countDesc(k.id); return c; }
function layOf(n) { const r = rootOf(n.id); return (r && r.lay) || 'map'; }
function styleOf(n, d, lay) {
  if (n.s) return n.s;
  if (d <= 1) return 'box';
  return lay === 'down' ? 'pill' : 'line';
}
function defFs(it, d) {
  if (it.k === 'node') return d === 0 ? 21 : d === 1 ? 15.5 : 14;
  if (it.k === 'sticky') return 17;
  if (it.k === 'text') return 18;
  if (it.k === 'shape') return 15;
  return 13;
}
function normOrders(pid) { kids(pid).forEach((k, i) => { k.o = i; }); }
function lastOrder(pid) { const a = kids(pid); return a.length ? Math.max(...a.map(k => k.o || 0)) : -1; }
function nextColor(root) {
  const used = kids(root.id).map(k => k.c).filter(c => typeof c === 'number');
  for (let i = 0; i < BRANCH.length; i++) if (!used.includes(i)) return i;
  return kids(root.id).length % BRANCH.length;
}
function chooseSide(root) {
  if ((root.lay || 'map') !== 'map') return 'r';
  let r = 0, l = 0;
  for (const k of kids(root.id)) { const w = 1 + countDesc(k.id); if (k.side === 'l') l += w; else r += w; }
  return l < r ? 'l' : 'r';
}

/* ───────────────────────── Rendu ───────────────────────── */
function req() {
  if (pending || !B) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; render(); });
}
KM.req = req;
function render() {
  if (!B || !E) return;
  computeTree();
  syncDom();
  measure();
  layout();
  place();
  drawSvg();
  drawOverlay();
  reqMini();
}
KM.render = render;

function syncDom() {
  const seen = new Set();
  B.items.forEach((it, i) => {
    if (it.k === 'ink') return;
    if (it.k === 'line' && !it.t && !(EDIT && EDIT.id === it.id)) return;
    seen.add(it.id);
    let e = IEL.get(it.id);
    if (!e) { e = makeEl(it); IEL.set(it.id, e); (it.k === 'frame' ? E.frames : E.layer).appendChild(e); }
    if (e._z !== i) { e.style.zIndex = it.k === 'line' ? 100000 + i : i; e._z = i; }
    updateEl(it, e);
  });
  for (const [id, e] of IEL) if (!seen.has(id)) { e.remove(); IEL.delete(id); SZ.delete(id); }
}
function makeEl(it) {
  let e;
  switch (it.k) {
    case 'frame': e = el('div', 'km-frame', '<div class="km-frame-title"><span class="km-t" data-ph="Cadre"></span></div>'); e.firstChild.dataset.id = it.id; break;
    case 'img': e = el('div', 'km-it km-img'); { const im = new Image(); im.draggable = false; im.alt = ''; e.appendChild(im); } break;
    case 'line': e = el('div', 'km-it km-lbl', '<div class="km-t" data-ph="Libellé"></div>'); break;
    case 'shape': e = el('div', 'km-it km-shape', '<svg class="km-sh-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke"/></svg><div class="km-t"></div>'); break;
    case 'sticky': e = el('div', 'km-it km-sticky', '<div class="km-t" data-ph="Écris ici…"></div>'); break;
    case 'text': e = el('div', 'km-it km-text', '<div class="km-t" data-ph="Texte"></div>'); break;
    default:
      e = el('div', 'km-it km-node', '<div class="km-t" data-ph="Idée"></div><span class="km-note ms" data-note title="Voir la note">sticky_note_2</span><button class="km-fold" data-fold tabindex="-1" title="Replier / déplier"></button>');
  }
  if (it.k !== 'frame') e.dataset.id = it.id;
  e._sig = null; e._t = null; e._tf = ''; e._z = -1;
  return e;
}
function updateEl(it, e) {
  const editing = EDIT && EDIT.id === it.id;
  const t = e.querySelector('.km-t');
  if (t && !editing && e._t !== (it.t || '')) { t.textContent = it.t || ''; e._t = it.t || ''; DIRTY.add(it.id); }
  let cls, sig;
  switch (it.k) {
    case 'node': {
      const d = depth(it.id), lay = layOf(it), st = styleOf(it, d, lay);
      cls = 'km-it km-node ' + (d === 0 ? 'd0' : d === 1 ? 'd1' : 'dn') + ' s-' + st + (it.b ? ' km-b' : '') + (it.note ? ' has-note' : '') + (lay === 'down' ? ' lay-down' : '');
      sig = cls + '|' + (it.fs || '');
      if (e._sig !== sig) { e.className = cls; t.style.fontSize = (it.fs || defFs(it, d)) + 'px'; e.style.setProperty('--bw', th(d) + 'px'); e._sig = sig; DIRTY.add(it.id); }
      break;
    }
    case 'sticky':
      sig = [it.w, it.h, it.fs, it.c].join('|');
      if (e._sig !== sig) { e.style.width = it.w + 'px'; e.style.height = it.h + 'px'; e.style.setProperty('--c', colHex(it.c == null ? 0 : it.c, STICKY)); e._sig = sig; DIRTY.add(it.id); }
      break;
    case 'text':
      sig = [it.w || 0, it.fs, it.b ? 1 : 0, it.c, isDark()].join('|');
      if (e._sig !== sig) {
        e.style.width = it.w ? it.w + 'px' : '';
        e.classList.toggle('fixed', !!it.w); e.classList.toggle('km-b', !!it.b);
        t.style.fontSize = (it.fs || defFs(it)) + 'px';
        e.style.color = it.c == null || it.c === 0 ? '' : inkHex(it.c);
        e._sig = sig; DIRTY.add(it.id);
      }
      break;
    case 'shape': {
      const s = it.s || 'rect';
      sig = [it.w, it.h, it.fs, it.c, s].join('|');
      if (e._sig !== sig) {
        e.className = 'km-it km-shape sh-' + s;
        e.style.width = it.w + 'px'; e.style.height = it.h + 'px';
        const ci = it.c == null ? 0 : it.c;
        e.style.setProperty('--fill', colHex(ci, FILL)); e.style.setProperty('--stroke', colHex(ci, FILL_LINE));
        e.style.setProperty('--tc', ci === 7 ? '#fff' : '#1f2933');
        e.querySelector('path').setAttribute('d', POLY[s] || '');
        t.style.fontSize = (it.fs || defFs(it)) + 'px';
        e._sig = sig; DIRTY.add(it.id);
      }
      break;
    }
    case 'frame':
      sig = [it.w, it.h, it.c].join('|');
      if (e._sig !== sig) { e.style.width = it.w + 'px'; e.style.height = it.h + 'px'; e.className = 'km-frame fc-' + ((it.c || 0) % 7); e._sig = sig; }
      break;
    case 'img':
      if (e._src !== it.src) { e.firstChild.src = it.src || ''; e._src = it.src; }
      sig = it.w + '|' + it.h;
      if (e._sig !== sig) { e.style.width = it.w + 'px'; e.style.height = it.h + 'px'; e._sig = sig; }
      break;
    case 'line':
      sig = 'l' + (it.c == null ? '' : it.c);
      if (e._sig !== sig) { e.style.color = it.c == null ? '' : inkHex(it.c); e._sig = sig; DIRTY.add(it.id); }
      break;
  }
}
function measure() {
  if (!DIRTY.size) return;
  const list = [];
  DIRTY.forEach(id => { const it = get(id), e = IEL.get(id); if (it && e) list.push([it, e]); });
  DIRTY.clear();
  for (const [, e] of list) if (e.style.display === 'none') { e.style.visibility = 'hidden'; e.style.display = ''; e._tmp = true; }
  for (const [it, e] of list) {
    if (it.k === 'node' || it.k === 'text' || it.k === 'line') SZ.set(it.id, { w: e.offsetWidth, h: e.offsetHeight });
    else if (it.k === 'sticky' || it.k === 'shape') fitText(it, e);
  }
  for (const [, e] of list) if (e._tmp) { e.style.display = 'none'; e.style.visibility = ''; e._tmp = false; }
}
function fitText(it, e) {
  const t = e.querySelector('.km-t'); if (!t) return;
  let fs = it.fs || defFs(it), guard = 0;
  t.style.fontSize = fs + 'px';
  while (guard++ < 24 && fs > 8 && (t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1)) {
    fs -= fs > 18 ? 1.5 : 1;
    t.style.fontSize = fs + 'px';
  }
}
const sz = id => SZ.get(id) || { w: 90, h: 34 };

function layout() {
  G.clear(); BH.clear(); BW.clear();
  for (const it of B.items) {
    switch (it.k) {
      case 'node': if (!it.p) layoutTree(it); break;
      case 'text': { const s = sz(it.id); G.set(it.id, { x: it.x, y: it.y, w: s.w, h: s.h }); break; }
      case 'sticky': case 'shape': case 'frame': case 'img': G.set(it.id, { x: it.x, y: it.y, w: it.w, h: it.h }); break;
    }
  }
  LG.clear();
  for (const it of B.items) if (it.k === 'line') { const g = lineGeom(it); if (g) LG.set(it.id, g); }
}
function layoutTree(r) {
  const lay = r.lay || 'map', s = sz(r.id), rx = r.x || 0, ry = r.y || 0;
  if (lay === 'down') { bw(r, 0); placeD(r, rx, ry - s.h / 2, 0, null, r.id); return; }
  G.set(r.id, { x: rx - s.w / 2, y: ry - s.h / 2, w: s.w, h: s.h, side: 0, d: 0, col: null, lay, st: styleOf(r, 0, lay), root: r.id });
  const ks = r.fold ? [] : kids(r.id);
  if (!ks.length) return;
  ks.forEach(k => bh(k, 1));
  const groups = lay === 'right' ? [[1, ks]] : [[1, ks.filter(k => k.side !== 'l')], [-1, ks.filter(k => k.side === 'l')]];
  for (const [side, arr] of groups) {
    if (!arr.length) continue;
    const tot = arr.reduce((a, k) => a + BH.get(k.id), 0) + VG(1) * (arr.length - 1);
    let y = ry - tot / 2;
    for (const k of arr) {
      const kz = sz(k.id), col = k.c != null ? k.c : ks.indexOf(k) % BRANCH.length;
      const cx = rx + side * (s.w / 2 + HG(0) + kz.w / 2);
      placeH(k, cx + (k.dx || 0), y + BH.get(k.id) / 2 + (k.dy || 0), side, 1, col, lay, r.id);
      y += BH.get(k.id) + VG(1);
    }
  }
}
function bh(n, d) {
  const s = sz(n.id), ks = n.fold ? [] : kids(n.id);
  let sum = 0;
  for (const k of ks) sum += bh(k, d + 1);
  if (ks.length) sum += VG(d + 1) * (ks.length - 1);
  const v = Math.max(s.h, sum); BH.set(n.id, v); return v;
}
function placeH(n, cx, cy, side, d, col, lay, rid) {
  const s = sz(n.id);
  G.set(n.id, { x: cx - s.w / 2, y: cy - s.h / 2, w: s.w, h: s.h, side, d, col, lay, st: styleOf(n, d, lay), root: rid });
  if (n.fold) return;
  const ks = kids(n.id); if (!ks.length) return;
  const tot = ks.reduce((a, k) => a + BH.get(k.id), 0) + VG(d + 1) * (ks.length - 1);
  let y = cy - tot / 2;
  for (const k of ks) {
    const kz = sz(k.id), kc = k.c != null ? k.c : col;
    const kcx = cx + side * (s.w / 2 + HG(d) + kz.w / 2);
    placeH(k, kcx + (k.dx || 0), y + BH.get(k.id) / 2 + (k.dy || 0), side, d + 1, kc, lay, rid);
    y += BH.get(k.id) + VG(d + 1);
  }
}
function bw(n, d) {
  const s = sz(n.id), ks = n.fold ? [] : kids(n.id);
  let sum = 0;
  for (const k of ks) sum += bw(k, d + 1);
  if (ks.length) sum += DHG(d + 1) * (ks.length - 1);
  const v = Math.max(s.w, sum); BW.set(n.id, v); return v;
}
function placeD(n, cx, top, d, col, rid) {
  const s = sz(n.id);
  G.set(n.id, { x: cx - s.w / 2, y: top, w: s.w, h: s.h, side: 0, d, col, lay: 'down', st: styleOf(n, d, 'down'), root: rid });
  if (n.fold) return;
  const ks = kids(n.id); if (!ks.length) return;
  const tot = ks.reduce((a, k) => a + BW.get(k.id), 0) + DHG(d + 1) * (ks.length - 1);
  let x = cx - tot / 2; const rowTop = top + s.h + DVG(d);
  ks.forEach((k, i) => {
    const kc = k.c != null ? k.c : (d === 0 ? i % BRANCH.length : col);
    placeD(k, x + BW.get(k.id) / 2 + (k.dx || 0), rowTop + (k.dy || 0), d + 1, kc, rid);
    x += BW.get(k.id) + DHG(d + 1);
  });
}

/* Connecteurs */
function sideAnchor(r, p) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = p.x - cx, dy = p.y - cy, g = 4;
  if (Math.abs(dx) / (r.w / 2 + 1) >= Math.abs(dy) / (r.h / 2 + 1)) { const s = dx >= 0 ? 1 : -1; return { x: cx + s * (r.w / 2 + g), y: cy, nx: s, ny: 0 }; }
  const s = dy >= 0 ? 1 : -1; return { x: cx, y: cy + s * (r.h / 2 + g), nx: 0, ny: s };
}
function freeAnchor(p, o) {
  const dx = o.x - p.x, dy = o.y - p.y;
  return Math.abs(dx) >= Math.abs(dy) ? { x: p.x, y: p.y, nx: dx >= 0 ? 1 : -1, ny: 0 } : { x: p.x, y: p.y, nx: 0, ny: dy >= 0 ? 1 : -1 };
}
function clipRect(r, c, p, g) {
  const dx = p.x - c.x, dy = p.y - c.y;
  if (!dx && !dy) return { x: c.x, y: c.y };
  const t = Math.min(dx ? (r.w / 2 + g) / Math.abs(dx) : Infinity, dy ? (r.h / 2 + g) / Math.abs(dy) : Infinity);
  return { x: c.x + dx * Math.min(t, 1), y: c.y + dy * Math.min(t, 1) };
}
function cubicAt(p0, c1, c2, p3, t) {
  const m = 1 - t;
  return { x: m * m * m * p0.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * p3.x, y: m * m * m * p0.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * p3.y };
}
function arrowD(T, u, al) {
  const bx = T.x - u.x * al, by = T.y - u.y * al, hw = al * 0.5, nx = -u.y, ny = u.x;
  return 'M' + f1(T.x) + ',' + f1(T.y) + 'L' + f1(bx + nx * hw) + ',' + f1(by + ny * hw) + 'L' + f1(bx - nx * hw) + ',' + f1(by - ny * hw) + 'Z';
}
function lineGeom(it) {
  if (!it.a || !it.b) return null;
  const ra = it.a.id ? G.get(it.a.id) : null, rb = it.b.id ? G.get(it.b.id) : null;
  if ((it.a.id && !ra) || (it.b.id && !rb)) return null;
  const ca = ra ? { x: ra.x + ra.w / 2, y: ra.y + ra.h / 2 } : { x: +it.a.x || 0, y: +it.a.y || 0 };
  const cb = rb ? { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 } : { x: +it.b.x || 0, y: +it.b.y || 0 };
  const st = it.st || 'curve', w = it.w || 2, al = 8 + w * 2.2, ea = !!it.ea, eb = it.eb !== 0;
  let A, Bp, ta, tb, d, pts, mid;
  if (st === 'straight') {
    A = ra ? clipRect(ra, ca, cb, 4) : ca; Bp = rb ? clipRect(rb, cb, ca, 4) : cb;
    const u = unit(Bp.x - A.x, Bp.y - A.y); tb = u; ta = { x: -u.x, y: -u.y };
    const A2 = ea ? { x: A.x + u.x * al * 0.6, y: A.y + u.y * al * 0.6 } : A;
    const B2 = eb ? { x: Bp.x - u.x * al * 0.6, y: Bp.y - u.y * al * 0.6 } : Bp;
    d = 'M' + f1(A2.x) + ',' + f1(A2.y) + 'L' + f1(B2.x) + ',' + f1(B2.y);
    pts = [A, Bp]; mid = { x: (A.x + Bp.x) / 2, y: (A.y + Bp.y) / 2 };
  } else {
    const sa = ra ? sideAnchor(ra, cb) : freeAnchor(ca, cb), sb = rb ? sideAnchor(rb, ca) : freeAnchor(cb, ca);
    A = sa; Bp = sb;
    if (st === 'elbow') {
      const ah = sa.nx !== 0, bh2 = sb.nx !== 0;
      if (ah && bh2) { const mx = (sa.x + sb.x) / 2; pts = [sa, { x: mx, y: sa.y }, { x: mx, y: sb.y }, sb]; }
      else if (!ah && !bh2) { const my = (sa.y + sb.y) / 2; pts = [sa, { x: sa.x, y: my }, { x: sb.x, y: my }, sb]; }
      else if (ah) pts = [sa, { x: sb.x, y: sa.y }, sb];
      else pts = [sa, { x: sa.x, y: sb.y }, sb];
      pts = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.5);
      if (pts.length < 2) pts = [sa, sb];
      const n = pts.length;
      tb = unit(pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y);
      ta = unit(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const q = pts.map(p => ({ x: p.x, y: p.y }));
      if (ea) { q[0].x -= ta.x * al * 0.6; q[0].y -= ta.y * al * 0.6; }
      if (eb) { q[n - 1].x -= tb.x * al * 0.6; q[n - 1].y -= tb.y * al * 0.6; }
      d = 'M' + f1(q[0].x) + ',' + f1(q[0].y);
      for (let i = 1; i < n - 1; i++) {                       // coins arrondis
        const p = q[i], a = q[i - 1], b = q[i + 1];
        const r = Math.min(10, Math.hypot(p.x - a.x, p.y - a.y) / 2, Math.hypot(b.x - p.x, b.y - p.y) / 2);
        const u1 = unit(p.x - a.x, p.y - a.y), u2 = unit(b.x - p.x, b.y - p.y);
        d += 'L' + f1(p.x - u1.x * r) + ',' + f1(p.y - u1.y * r) + 'Q' + f1(p.x) + ',' + f1(p.y) + ' ' + f1(p.x + u2.x * r) + ',' + f1(p.y + u2.y * r);
      }
      d += 'L' + f1(q[n - 1].x) + ',' + f1(q[n - 1].y);
      let L = 0; const segs = [];
      for (let i = 1; i < n; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(l); L += l; }
      let acc = 0; mid = pts[0];
      for (let i = 1; i < n; i++) { if (acc + segs[i - 1] >= L / 2) { const t = (L / 2 - acc) / (segs[i - 1] || 1); mid = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; break; } acc += segs[i - 1]; }
    } else {
      const dist = Math.hypot(sb.x - sa.x, sb.y - sa.y), k = clamp(dist * 0.42, 24, 240);
      const c1 = { x: sa.x + sa.nx * k, y: sa.y + sa.ny * k }, c2 = { x: sb.x + sb.nx * k, y: sb.y + sb.ny * k };
      ta = unit(sa.x - c1.x, sa.y - c1.y); tb = unit(sb.x - c2.x, sb.y - c2.y);
      const A2 = ea ? { x: sa.x - ta.x * al * 0.6, y: sa.y - ta.y * al * 0.6 } : sa;
      const B2 = eb ? { x: sb.x - tb.x * al * 0.6, y: sb.y - tb.y * al * 0.6 } : sb;
      d = 'M' + f1(A2.x) + ',' + f1(A2.y) + 'C' + f1(c1.x) + ',' + f1(c1.y) + ' ' + f1(c2.x) + ',' + f1(c2.y) + ' ' + f1(B2.x) + ',' + f1(B2.y);
      pts = []; for (let i = 0; i <= 20; i++) pts.push(cubicAt(sa, c1, c2, sb, i / 20));
      mid = cubicAt(sa, c1, c2, sb, 0.5);
    }
  }
  const arrows = [];
  if (ea) arrows.push(arrowD(A, ta, al));
  if (eb) arrows.push(arrowD(Bp, tb, al));
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) { if (p.x < x1) x1 = p.x; if (p.y < y1) y1 = p.y; if (p.x > x2) x2 = p.x; if (p.y > y2) y2 = p.y; }
  return { d, arrows, pts, mid, A, B: Bp, bb: { x: x1 - 4, y: y1 - 4, w: x2 - x1 + 8, h: y2 - y1 + 8 } };
}

function place() {
  const dragSet = P && P.mode === 'move' && P.moved ? P.dragIds : null;
  for (const it of B.items) {
    const e = IEL.get(it.id); if (!e) continue;
    let x, y;
    if (it.k === 'node') {
      const g = G.get(it.id);
      if (!g) { if (e.style.display !== 'none') e.style.display = 'none'; continue; }
      if (e.style.display === 'none') e.style.display = '';
      x = g.x; y = g.y;
      const hex = it.p ? (colHex(g.col, BRANCH) || BRANCH[0]) : (it.c != null ? colHex(it.c, BRANCH) : '');
      const ck = hex + (isDark() ? 'd' : 'l');
      if (e._c !== ck) {
        if (hex) { e.style.setProperty('--c', hex); e.style.setProperty('--tint', mixHex(hex, isDark() ? '#1d1f23' : '#ffffff', isDark() ? 0.24 : 0.13)); }
        else { e.style.removeProperty('--c'); e.style.removeProperty('--tint'); }
        e.classList.toggle('km-custom', !it.p && !!hex); e._c = ck;
      }
      e.classList.toggle('km-sl', g.side < 0);
      const n = kids(it.id).length, fb = e.querySelector('.km-fold');
      fb.hidden = !n;
      if (n) { const lbl = it.fold ? String(countDesc(it.id)) : '−'; if (fb.textContent !== lbl) fb.textContent = lbl; }
      e.classList.toggle('folded', !!it.fold && n > 0);
      e.classList.toggle('km-masked', !!(REV && it.p && !REV.shown.has(it.id)));
      e.classList.toggle('km-rv-ok', !!(REV && REV.ok.has(it.id)));
      e.classList.toggle('km-rv-ko', !!(REV && REV.ko.has(it.id)));
    } else if (it.k === 'line') {
      const g = LG.get(it.id), s = sz(it.id);
      if (!g) { e.style.display = 'none'; continue; }
      e.style.display = '';
      x = g.mid.x - s.w / 2; y = g.mid.y - s.h / 2;
    } else { x = it.x; y = it.y; }
    const tf = 'translate(' + f1(x) + 'px,' + f1(y) + 'px)';
    if (e._tf !== tf) { e.style.transform = tf; e._tf = tf; }
    e.classList.toggle('km-sel', sel.has(it.id));
    e.classList.toggle('km-drag', !!(dragSet && dragSet.has(it.id)));
    e.classList.toggle('km-match', matches.length > 0 && matches.includes(it.id));
  }
}

function taper(x0, y0, x1, y1, w0, w1, vert) {
  const a = w0 / 2, b = w1 / 2;
  if (!vert) {
    const m = (x1 - x0) * 0.5;
    return 'M' + f1(x0) + ',' + f1(y0 - a) + 'C' + f1(x0 + m) + ',' + f1(y0 - a) + ' ' + f1(x1 - m) + ',' + f1(y1 - b) + ' ' + f1(x1) + ',' + f1(y1 - b) +
      'L' + f1(x1) + ',' + f1(y1 + b) + 'C' + f1(x1 - m) + ',' + f1(y1 + b) + ' ' + f1(x0 + m) + ',' + f1(y0 + a) + ' ' + f1(x0) + ',' + f1(y0 + a) + 'Z';
  }
  const m = (y1 - y0) * 0.5;
  return 'M' + f1(x0 - a) + ',' + f1(y0) + 'C' + f1(x0 - a) + ',' + f1(y0 + m) + ' ' + f1(x1 - b) + ',' + f1(y1 - m) + ' ' + f1(x1 - b) + ',' + f1(y1) +
    'L' + f1(x1 + b) + ',' + f1(y1) + 'C' + f1(x1 + b) + ',' + f1(y1 - m) + ' ' + f1(x0 + a) + ',' + f1(y0 + m) + ' ' + f1(x0 + a) + ',' + f1(y0) + 'Z';
}
function branchSeg(pg, g) {
  const d = g.d, w0 = th(d - 1), w1 = th(d);
  if (g.lay === 'down') {
    const x0 = pg.x + pg.w / 2, y0 = pg.y + pg.h, x1 = g.x + g.w / 2, y1 = g.y;
    return { x0, y0, x1, y1, w0, w1, vert: true };
  }
  const side = g.side || 1;
  let x0, y0;
  if (d === 1) { x0 = pg.x + pg.w / 2 + side * pg.w * 0.22; y0 = pg.y + pg.h / 2; }
  else if (pg.st === 'line') { x0 = side > 0 ? pg.x + pg.w : pg.x; y0 = pg.y + pg.h - w0 / 2; }
  else { x0 = side > 0 ? pg.x + pg.w : pg.x; y0 = pg.y + pg.h / 2; }
  const x1 = side > 0 ? g.x : g.x + g.w, y1 = g.st === 'line' ? g.y + g.h - w1 / 2 : g.y + g.h / 2;
  return { x0, y0, x1, y1, w0, w1, vert: false };
}
function inkD(p) {
  let d = INKD.get(p); if (d) return d;
  if (p.length < 4) d = 'M' + p[0] + ',' + p[1] + 'l0.01,0';
  else {
    d = 'M' + p[0] + ',' + p[1];
    for (let i = 2; i < p.length - 2; i += 2) d += 'Q' + p[i] + ',' + p[i + 1] + ' ' + f1((p[i] + p[i + 2]) / 2) + ',' + f1((p[i + 1] + p[i + 3]) / 2);
    d += 'L' + p[p.length - 2] + ',' + p[p.length - 1];
  }
  INKD.set(p, d);
  return d;
}
function inkBB(it) {
  const p = it.pts; let b = INKBB.get(p); if (b) return b;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (let i = 0; i < p.length; i += 2) { if (p[i] < x1) x1 = p[i]; if (p[i] > x2) x2 = p[i]; if (p[i + 1] < y1) y1 = p[i + 1]; if (p[i + 1] > y2) y2 = p[i + 1]; }
  const m = (it.w || 3) / 2;
  b = { x: x1 - m, y: y1 - m, w: x2 - x1 + m * 2, h: y2 - y1 + m * 2 };
  INKBB.set(p, b);
  return b;
}
function elbowD(s) {
  const { x0, y0, x1, y1 } = s, ym = y0 + (y1 - y0) / 2, dx = x1 - x0;
  if (Math.abs(dx) < 1) return 'M' + f1(x0) + ',' + f1(y0) + 'V' + f1(y1);
  const dir = dx > 0 ? 1 : -1, r = Math.max(0, Math.min(12, Math.abs(dx) / 2, (y1 - y0) / 3));
  return 'M' + f1(x0) + ',' + f1(y0) + 'V' + f1(ym - r) + 'Q' + f1(x0) + ',' + f1(ym) + ' ' + f1(x0 + dir * r) + ',' + f1(ym) +
    'H' + f1(x1 - dir * r) + 'Q' + f1(x1) + ',' + f1(ym) + ' ' + f1(x1) + ',' + f1(ym + r) + 'V' + f1(y1);
}
function drawSvg() {
  // Branches des cartes mentales, regroupées par couleur : formes effilées (cartes)
  // ou traits coudés d'épaisseur constante (organigrammes)
  BRANCHES = new Map(); BRSTROKES = new Map(); BRSEG = [];
  for (const it of B.items) {
    if (it.k !== 'node' || !it.p) continue;
    const g = G.get(it.id), pg = G.get(it.p); if (!g || !pg) continue;
    const hex = colHex(g.col, BRANCH) || BRANCH[0];
    const s = branchSeg(pg, g); s.c = hex; BRSEG.push(s);
    if (s.vert) { const key = hex + '|' + f1(Math.max(1.5, s.w1 * 0.85)); BRSTROKES.set(key, (BRSTROKES.get(key) || '') + elbowD(s)); }
    else BRANCHES.set(hex, (BRANCHES.get(hex) || '') + taper(s.x0, s.y0, s.x1, s.y1, s.w0, s.w1, false));
  }
  const want = new Map();
  BRANCHES.forEach((d, hex) => want.set('f' + hex, { d, fill: hex }));
  BRSTROKES.forEach((d, key) => { const [hex, w] = key.split('|'); want.set('s' + key, { d, stroke: hex, w }); });
  for (const [k, p] of BREL) if (!want.has(k)) { p.remove(); BREL.delete(k); }
  want.forEach((o, k) => {
    let p = BREL.get(k);
    if (!p) { p = o.fill ? svgEl('path', { fill: o.fill }) : svgEl('path', { fill: 'none', stroke: o.stroke, 'stroke-width': o.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }); E.br.appendChild(p); BREL.set(k, p); }
    if (p._d !== o.d) { p.setAttribute('d', o.d); p._d = o.d; }
  });
  // Connecteurs
  const seenL = new Set();
  for (const it of B.items) {
    if (it.k !== 'line') continue;
    seenL.add(it.id);
    const g = LG.get(it.id);
    let ge = LNEL.get(it.id);
    if (!ge) { ge = svgEl('g', { class: 'km-ln' }); ge.innerHTML = '<path class="km-ln-halo"/><path class="km-ln-p"/><path class="km-ln-a"/>'; E.lines.appendChild(ge); LNEL.set(it.id, ge); }
    if (!g) { ge.style.display = 'none'; continue; }
    ge.style.display = '';
    const [halo, path, arr] = ge.children, col = it.c == null ? 'var(--km-line)' : inkHex(it.c), w = it.w || 2;
    halo.setAttribute('d', g.d); path.setAttribute('d', g.d); arr.setAttribute('d', g.arrows.join(''));
    path.style.stroke = col; path.style.strokeWidth = w; arr.style.fill = col;
    halo.style.strokeWidth = w + 10;
    path.style.strokeDasharray = it.dash ? (w * 3) + ' ' + (w * 2.5) : '';
    ge.classList.toggle('sel', sel.has(it.id));
  }
  for (const [id, ge] of LNEL) if (!seenL.has(id)) { ge.remove(); LNEL.delete(id); }
  // Encre
  const seenI = new Set();
  for (const it of B.items) {
    if (it.k !== 'ink') continue;
    seenI.add(it.id);
    let p = INKEL.get(it.id);
    if (!p) { p = svgEl('path', { class: 'km-ink' }); E.ink.appendChild(p); INKEL.set(it.id, p); }
    const d = inkD(it.pts);
    if (p._d !== d) { p.setAttribute('d', d); p._d = d; }
    p.style.stroke = it.hl ? colHex(it.c, HILITE) : (it.c == null || it.c === 0 ? 'var(--km-text)' : inkHex(it.c));
    p.style.strokeWidth = it.w || 3;
    p.classList.toggle('hl', !!it.hl);
    p.classList.toggle('sel', sel.has(it.id));
  }
  for (const [id, p] of INKEL) if (!seenI.has(id)) { p.remove(); INKEL.delete(id); }
}

/* Boîtes et calques écran */
function itemBox(it) {
  if (!it) return null;
  if (it.k === 'ink') return inkBB(it);
  if (it.k === 'line') { const g = LG.get(it.id); return g ? g.bb : null; }
  return G.get(it.id) || null;
}
function contentBox() {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const it of B.items) {
    const r = itemBox(it); if (!r) continue;
    if (r.x < x1) x1 = r.x; if (r.y < y1) y1 = r.y;
    if (r.x + r.w > x2) x2 = r.x + r.w; if (r.y + r.h > y2) y2 = r.y + r.h;
  }
  return x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
KM.contentBox = () => (B ? contentBox() : null);
function toScr(r) { return { x: r.x * V.z + V.x, y: r.y * V.z + V.y, w: r.w * V.z, h: r.h * V.z }; }
function selBox() {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const id of sel) { const r = itemBox(get(id)); if (!r) continue; x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h); }
  return x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
const resizable = it => it && (it.k === 'sticky' || it.k === 'shape' || it.k === 'frame' || it.k === 'img' || it.k === 'text');

function drawOverlay() {
  if (!E) return;
  let h = '';
  const busy = P && ((P.mode === 'move' && P.moved) || P.mode === 'pan' || P.mode === 'pinch');
  const one = sel.size === 1 ? get([...sel][0]) : null;
  for (const id of sel) {
    const it = get(id); if (!it || it.k === 'line' || it.k === 'ink') continue;
    const g = itemBox(it); if (!g) continue;
    const r = toScr(g), pad = it.k === 'node' ? 4 : 3;
    h += '<div class="km-selr' + (it.k === 'node' ? ' n' : '') + '" style="left:' + f1(r.x - pad) + 'px;top:' + f1(r.y - pad) + 'px;width:' + f1(r.w + pad * 2) + 'px;height:' + f1(r.h + pad * 2) + 'px"></div>';
  }
  for (const id of sel) {
    const it = get(id); if (!it || it.k !== 'ink') continue;
    const r = toScr(inkBB(it));
    h += '<div class="km-selr dash" style="left:' + f1(r.x - 4) + 'px;top:' + f1(r.y - 4) + 'px;width:' + f1(r.w + 8) + 'px;height:' + f1(r.h + 8) + 'px"></div>';
  }
  if (one && !busy && !REV) {
    const g = itemBox(one);
    if (g && resizable(one)) {
      const r = toScr(g), hs = one.k === 'text' ? ['w', 'e'] : one.k === 'frame' || one.k === 'shape' ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] : ['nw', 'ne', 'se', 'sw'];
      for (const k of hs) {
        const x = k.includes('w') ? r.x - 3 : k.includes('e') ? r.x + r.w + 3 : r.x + r.w / 2;
        const y = k.includes('n') ? r.y - 3 : k.includes('s') ? r.y + r.h + 3 : r.y + r.h / 2;
        h += '<div class="km-h h-' + k + '" data-h="' + k + '" style="left:' + f1(x) + 'px;top:' + f1(y) + 'px"></div>';
      }
    }
    if (g && one.k === 'node' && !EDIT) {
      const r = toScr(g), gg = G.get(one.id);
      const adds = [];
      if (gg.lay === 'down') adds.push(['d', r.x + r.w / 2, r.y + r.h + 18]);
      else if (!one.p && (one.lay || 'map') === 'map') { adds.push(['r', r.x + r.w + 18, r.y + r.h / 2]); adds.push(['l', r.x - 18, r.y + r.h / 2]); }
      else { const s = gg.side < 0 ? -1 : 1; adds.push([s < 0 ? 'l' : 'r', s > 0 ? r.x + r.w + 18 : r.x - 18, r.y + r.h / 2]); }
      for (const [k, x, y] of adds) h += '<button class="km-add" data-add="' + k + '" style="left:' + f1(x) + 'px;top:' + f1(y) + 'px" title="Ajouter une idée (Tab)"><span class="ms">add</span></button>';
    }
    if (one.k === 'line') {
      const g2 = LG.get(one.id);
      if (g2) for (const [k, p] of [['a', g2.A], ['b', g2.B]]) h += '<div class="km-end' + (one[k].id ? ' on' : '') + '" data-end="' + k + '" style="left:' + f1(p.x * V.z + V.x) + 'px;top:' + f1(p.y * V.z + V.y) + 'px"></div>';
    }
  }
  if (P && (P.mode === 'marq' || (P.mode === 'create' && (P.tool === 'shape' || P.tool === 'frame') && P.moved))) {
    const x = Math.min(P.start.x, P.cur.x), y = Math.min(P.start.y, P.cur.y);
    const r = toScr({ x, y, w: Math.abs(P.cur.x - P.start.x), h: Math.abs(P.cur.y - P.start.y) });
    h += '<div class="km-marq" style="left:' + f1(r.x) + 'px;top:' + f1(r.y) + 'px;width:' + f1(r.w) + 'px;height:' + f1(r.h) + 'px"></div>';
  }
  if (P && P.drop) {
    const g = G.get(P.drop.id);
    if (g) {
      const r = toScr(g);
      if (P.drop.mode === 'child') h += '<div class="km-drop child" style="left:' + f1(r.x - 6) + 'px;top:' + f1(r.y - 6) + 'px;width:' + f1(r.w + 12) + 'px;height:' + f1(r.h + 12) + 'px"></div>';
      else if (g.lay === 'down') h += '<div class="km-drop bar v" style="left:' + f1(P.drop.mode === 'before' ? r.x - 8 : r.x + r.w + 6) + 'px;top:' + f1(r.y) + 'px;height:' + f1(r.h) + 'px"></div>';
      else h += '<div class="km-drop bar" style="left:' + f1(r.x) + 'px;top:' + f1(P.drop.mode === 'before' ? r.y - 7 : r.y + r.h + 5) + 'px;width:' + f1(r.w) + 'px"></div>';
    }
  }
  if (P && (P.mode === 'line' || P.mode === 'line2' || P.mode === 'lend') && P.hover) {
    const g = G.get(P.hover);
    if (g) { const r = toScr(g); h += '<div class="km-drop child" style="left:' + f1(r.x - 5) + 'px;top:' + f1(r.y - 5) + 'px;width:' + f1(r.w + 10) + 'px;height:' + f1(r.h + 10) + 'px"></div>'; }
  }
  if (REV && REV.last && G.get(REV.last)) {
    const r = toScr(G.get(REV.last));
    h += '<div class="km-rv-eval" style="left:' + f1(r.x + r.w / 2) + 'px;top:' + f1(r.y + r.h + 8) + 'px"><button data-rv="ok" title="Je savais"><span class="ms">check</span></button><button data-rv="ko" title="À revoir"><span class="ms">close</span></button></div>';
  }
  E.ov.innerHTML = h;
  // aperçu du connecteur en cours de tracé
  if (P && (P.mode === 'line' || P.mode === 'line2') && P.cur) {
    const tmp = { a: P.a, b: P.hover ? { id: P.hover } : { x: P.cur.x, y: P.cur.y }, st: 'curve', eb: 1, w: 2 };
    const g = lineGeom(tmp);
    E.tmp.setAttribute('d', g ? g.d + g.arrows.join('') : '');
  } else if (E.tmp.getAttribute('d')) E.tmp.setAttribute('d', '');
  positionCtx();
}

/* ───────────────────────── Vue (zoom / déplacement) ───────────────────────── */
function gridBg() {
  let step = 24;
  while (step * V.z < 14) step *= 2;
  while (step * V.z > 44) step /= 2;
  const s = step * V.z, rad = clamp(V.z, 0.6, 1.4);
  E.vp.style.backgroundSize = s + 'px ' + s + 'px';
  E.vp.style.backgroundPosition = f1(V.x % s) + 'px ' + f1(V.y % s) + 'px';
  E.vp.style.setProperty('--km-dotr', rad.toFixed(2) + 'px');
  E.app.style.setProperty('--km-gs', s + 'px ' + s + 'px');
  E.app.style.setProperty('--km-gp', f1(V.x % s) + 'px ' + f1(V.y % s) + 'px');
  E.app.style.setProperty('--km-dotr', rad.toFixed(2) + 'px');
}
function applyView() {
  if (!E) return;
  E.world.style.transform = 'translate(' + f1(V.x) + 'px,' + f1(V.y) + 'px) scale(' + V.z + ')';
  gridBg();
  E.zpct.textContent = Math.round(V.z * 100) + ' %';
  drawOverlay();
  scheduleViewSave();
  reqMini();
}
function setView(v) { V = { x: +v.x || 0, y: +v.y || 0, z: clamp(+v.z || 1, ZMIN, ZMAX) }; applyView(); }
function zoomAt(f, sx, sy) {
  const z = clamp(V.z * f, ZMIN, ZMAX), k = z / V.z;
  V.x = sx - (sx - V.x) * k; V.y = sy - (sy - V.y) * k; V.z = z;
  applyView();
}
function zoomBy(f) { const r = E.vp.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); }
function zoomTo(z) { const r = E.vp.getBoundingClientRect(); zoomAt(z / V.z, r.width / 2, r.height / 2); }
function animView(to, ms) {
  cancelAnimationFrame(animId);
  if (document.hidden) { setView(to); return; }
  const from = { ...V }, t0 = performance.now(); ms = ms || 300;
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    V = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: from.z + (to.z - from.z) * e };
    applyView();
    if (k < 1) animId = requestAnimationFrame(step);
  };
  animId = requestAnimationFrame(step);
}
function fit(animate) {
  if (!B) return;
  render();
  const b = contentBox(), r = E.vp.getBoundingClientRect();
  if (!b) { setView({ x: r.width / 2, y: r.height / 2, z: 1 }); return; }
  const padX = Math.min(110, r.width * 0.1), padY = Math.min(110, r.height * 0.14);
  const z = clamp(Math.min((r.width - padX * 2) / Math.max(b.w, 1), (r.height - padY * 2) / Math.max(b.h, 1), 1.25), ZMIN, ZMAX);
  const to = { z, x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 + 12 - (b.y + b.h / 2) * z };
  animate ? animView(to) : setView(to);
}
function centerOn(id) {
  render();
  const b = itemBox(get(id)); if (!b) return;
  const r = E.vp.getBoundingClientRect(), z = clamp(Math.max(V.z, 0.75), ZMIN, 1.6);
  animView({ z, x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z });
}
function ensureVisible(id) {
  const b = itemBox(get(id)); if (!b) return;
  const r = toScr(b), vr = E.vp.getBoundingClientRect(), m = 80;
  let dx = 0, dy = 0;
  if (r.x < m) dx = m - r.x; else if (r.x + r.w > vr.width - m) dx = vr.width - m - r.x - r.w;
  if (r.y < m) dy = m - r.y; else if (r.y + r.h > vr.height - m) dy = vr.height - m - r.y - r.h;
  if (dx || dy) animView({ x: V.x + dx, y: V.y + dy, z: V.z }, 220);
}
function toWorld(cx, cy) { const r = VPR || E.vp.getBoundingClientRect(); return { x: (cx - r.left - V.x) / V.z, y: (cy - r.top - V.y) / V.z }; }
function viewCenter() { const r = E.vp.getBoundingClientRect(); return { x: (r.width / 2 - V.x) / V.z, y: (r.height / 2 - V.y) / V.z }; }
KM.viewCenter = () => viewCenter();

/* ───────────────────────── Historique & sauvegarde ───────────────────────── */
const H = { u: [], r: [], cur: '' };
function resetHistory() { H.u = []; H.r = []; H.cur = JSON.stringify(B.items); updUndo(); }
function commit() {
  if (!B) return;
  const s = JSON.stringify(B.items);
  if (s === H.cur) return;
  H.u.push(H.cur);
  const max = s.length > 600000 ? 15 : 120;
  while (H.u.length > max) H.u.shift();
  H.r = []; H.cur = s;
  updUndo(); scheduleSave(); afterChange();
}
KM.commit = () => commit();
function undo() { commitEdit(); if (!H.u.length) return; H.r.push(H.cur); H.cur = H.u.pop(); restore(); }
function redo() { commitEdit(); if (!H.r.length) return; H.u.push(H.cur); H.cur = H.r.pop(); restore(); }
function restore() {
  B.items = JSON.parse(H.cur); rebuild();
  for (const id of [...sel]) if (!byId.has(id)) sel.delete(id);
  markAllDirty(); updUndo(); scheduleSave(); onSel(); render(); afterChange();
}
function updUndo() { if (!E) return; E.undo.disabled = !H.u.length; E.redo.disabled = !H.r.length; }
function markAllDirty() { for (const it of B.items) DIRTY.add(it.id); for (const e of IEL.values()) { e._t = null; e._sig = null; } }
function afterChange() { if (E && E.outline.classList.contains('open')) renderOutline(); if (E && E.search.classList.contains('open')) runSearch(E.sinput.value, true); }

let saveT = 0, viewT = 0, dataDirty = false;
function scheduleSave() { dataDirty = true; setSave('pending'); clearTimeout(saveT); saveT = setTimeout(saveNow, 700); }
function scheduleViewSave() { if (!B) return; clearTimeout(viewT); viewT = setTimeout(() => { const m = B && metaOf(B.id); if (m) { m.view = { x: r1(V.x), y: r1(V.y), z: Math.round(V.z * 1000) / 1000 }; saveIndex(); } }, 900); }
function saveNow() {
  clearTimeout(saveT);
  if (!B) return true;
  const m = metaOf(B.id);
  if (!m) return false;
  if (!dataDirty) { setSave('ok'); return true; }
  const ok = writeJSON(MAP_PREFIX + B.id, { v: 4, items: B.items, view: { x: V.x, y: V.y, z: V.z }, bg: B.bg || undefined, theme: B.theme && B.theme !== 'arc' ? B.theme : undefined });
  if (!ok) { setSave('error'); toast('Stockage du navigateur plein : la carte n’a pas pu être enregistrée (supprime des images ou d’anciennes cartes).', 'error'); return false; }
  m.updated = Date.now(); m.name = B.name; m.bgc = bgSwatch();
  m.n = B.items.filter(i => i.k === 'node').length;
  try { m.th = typeof KM.thumb === 'function' ? KM.thumb() : ''; } catch (e) { m.th = ''; }
  saveIndex();
  dataDirty = false; setSave('ok');
  return true;
}
function setSave(st) {
  if (!E) return;
  E.save.dataset.st = st;
  E.save.textContent = st === 'ok' ? 'cloud_done' : st === 'error' ? 'cloud_off' : 'cloud_sync';
  E.save.title = st === 'ok' ? 'Enregistré sur cet appareil' : st === 'error' ? 'Échec de l’enregistrement' : 'Enregistrement…';
}

/* ───────────────────────── Sélection ───────────────────────── */
function onSel() {
  ctxSig = '';
  if (E) E.app.classList.toggle('km-has-sel', sel.size > 0);
}
function selectAll() { sel = new Set(B.items.filter(it => it.k !== 'node' || G.has(it.id)).map(it => it.id)); onSel(); render(); }

/* ───────────────────────── Édition de texte ───────────────────────── */
const PLAIN = (function () { try { const d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only'; } catch (e) { return false; } })();
const hasText = it => !!it && (it.k === 'node' || it.k === 'sticky' || it.k === 'text' || it.k === 'shape' || it.k === 'line' || it.k === 'frame');
function startEdit(id, o) {
  o = o || {};
  if (REV) return;
  const it = get(id); if (!hasText(it)) return;
  commitEdit();
  EDIT = { id, el: null, orig: it.t || '', isNew: !!o.isNew };
  sel = new Set([id]); onSel();
  render();                                   // crée l'élément (libellé de connecteur)
  const host = it.k === 'frame' ? IEL.get(id) : IEL.get(id);
  const t = host && host.querySelector('.km-t');
  if (!t) { EDIT = null; return; }
  EDIT.el = t;
  t.contentEditable = PLAIN ? 'plaintext-only' : 'true';
  t.spellcheck = true;
  host.classList.add('km-editing');
  if (o.replace) { t.textContent = ''; DIRTY.add(id); }
  t.focus({ preventScroll: true });
  try {
    const r = document.createRange(); r.selectNodeContents(t);
    if (!o.selectAll || o.replace) r.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  } catch (e) { /* rien */ }
  render();
}
function commitEdit() {
  if (!EDIT) return;
  const ed = EDIT; EDIT = null;
  const it = get(ed.id);
  if (!ed.el) { req(); return; }
  const txt = (ed.el.innerText || '').replace(/ /g, ' ').replace(/\r/g, '').replace(/\n+$/, '');
  ed.el.removeAttribute('contenteditable');
  const host = ed.el.closest('.km-it, .km-frame'); if (host) host.classList.remove('km-editing');
  if (document.activeElement === ed.el) ed.el.blur();
  try { window.getSelection().removeAllRanges(); } catch (e) { /* rien */ }
  if (!it) { req(); return; }
  if (!txt.trim() && ed.isNew && (it.k === 'node' || it.k === 'text')) {
    const par = it.p;
    removeItems([it.id]);
    sel = new Set(par && byId.has(par) ? [par] : []); onSel();
  } else {
    if (it.k === 'frame' && !txt.trim()) it.t = 'Cadre'; else it.t = txt;
    const e = IEL.get(it.id); if (e) e._t = null;
    DIRTY.add(it.id);
  }
  commit(); render();
}

/* ───────────────────────── Opérations ───────────────────────── */
function addItem(it) { B.items.push(it); byId.set(it.id, it); return it; }
function removeItems(ids) {
  const del = new Set();
  computeTree();
  for (const id of ids) { const it = get(id); if (!it) continue; if (it.k === 'node') subtreeIds(id).forEach(x => del.add(x)); else del.add(id); }
  for (const it of B.items) if (it.k === 'line' && ((it.a && del.has(it.a.id)) || (it.b && del.has(it.b.id)))) del.add(it.id);
  B.items = B.items.filter(it => !del.has(it.id));
  del.forEach(id => { byId.delete(id); sel.delete(id); });
  computeTree();
}
function deleteSel() {
  if (!sel.size) return;
  const one = sel.size === 1 ? get([...sel][0]) : null;
  const par = one && one.k === 'node' ? one.p : null;
  removeItems([...sel]);
  sel = new Set(par && byId.has(par) ? [par] : []);
  onSel(); commit(); render();
}
function newNode(pid, o) {
  o = o || {};
  const par = get(pid);
  computeTree();
  const n = { id: uid(), k: 'node', p: pid, t: o.t || '' };
  if (o.after) {
    normOrders(pid);
    const sibs = kids(pid), i = sibs.indexOf(o.after), next = sibs[i + 1];
    n.o = next ? ((o.after.o || 0) + (next.o || 0)) / 2 : (o.after.o || 0) + 1;
  } else n.o = lastOrder(pid) + 1;
  if (par && !par.p) { n.side = o.side || chooseSide(par); n.c = nextColor(par); }
  if (par && par.fold) par.fold = false;
  addItem(n);
  computeTree();
  return n;
}
function addChild(id, side) {
  const it = get(id); if (!it || it.k !== 'node') return;
  commitEdit();
  const lay = layOf(it);
  const n = newNode(id, { side: !it.p && lay === 'map' && (side === 'l' || side === 'r') ? side : undefined });
  sel = new Set([n.id]); onSel();
  render(); ensureVisible(n.id);
  startEdit(n.id, { isNew: true });
}
function addSibling(id) {
  const it = get(id); if (!it || it.k !== 'node') return;
  if (!it.p) return addChild(id);
  commitEdit();
  const n = newNode(it.p, { after: it, side: it.side });
  if (it.side && get(it.p) && !get(it.p).p) n.side = it.side;
  sel = new Set([n.id]); onSel();
  render(); ensureVisible(n.id);
  startEdit(n.id, { isNew: true });
}
function createRootAt(pt, text) {
  const n = addItem({ id: uid(), k: 'node', p: null, x: r1(pt.x), y: r1(pt.y), t: text || '', lay: 'map' });
  sel = new Set([n.id]); onSel(); render();
  if (!text) startEdit(n.id, { isNew: true }); else commit();
  return n;
}
function toggleFold(id, v) {
  const it = get(id); if (!it || !kids(id).length) return;
  it.fold = v == null ? !it.fold : !!v;
  if (!it.fold) delete it.fold;
  for (const s of [...sel]) if (s !== id && it.fold && subtreeIds(id).includes(s)) sel.delete(s);
  onSel(); commit(); render();
}
function tidy(id) {
  const ids = id ? subtreeIds(rootOf(id).id) : B.items.filter(i => i.k === 'node').map(i => i.id);
  for (const x of ids) { const n = get(x); if (n) { delete n.dx; delete n.dy; } }
  commit(); render();
}
const hasOffsets = id => subtreeIds(rootOf(id).id).some(x => { const n = get(x); return n && (n.dx || n.dy); });
function bringFront(back) {
  const ids = new Set(sel);
  const moved = B.items.filter(i => ids.has(i.id)), rest = B.items.filter(i => !ids.has(i.id));
  B.items = back ? moved.concat(rest) : rest.concat(moved);
  commit(); render();
}
function applyColor(v) {
  for (const it of [...sel].map(get).filter(Boolean)) {
    if (v === 'auto') { delete it.c; continue; }
    it.c = +v;
  }
  ctxSig = ''; commit(); render();
}
function nudge(k, step) {
  const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
  for (const it of [...sel].map(get).filter(Boolean)) moveItem(it, dx, dy);
  commit(); render();
}
function moveItem(it, dx, dy) {
  if (it.k === 'ink') it.pts = it.pts.map((v, i) => r1(v + (i % 2 ? dy : dx)));
  else if (it.k === 'line') { if (!it.a.id) it.a = { x: r1(it.a.x + dx), y: r1(it.a.y + dy) }; if (!it.b.id) it.b = { x: r1(it.b.x + dx), y: r1(it.b.y + dy) }; }
  else if (it.k === 'node' && it.p) { it.dx = r1((it.dx || 0) + dx); it.dy = r1((it.dy || 0) + dy); }
  else { it.x = r1((it.x || 0) + dx); it.y = r1((it.y || 0) + dy); }
}
function navNode(n, key) {
  const g = G.get(n.id); if (!g) return;
  const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  let best = null, bs = Infinity;
  for (const it of B.items) {
    if (it.k !== 'node' || it.id === n.id) continue;
    const o = G.get(it.id); if (!o) continue;
    const dx = o.x + o.w / 2 - cx, dy = o.y + o.h / 2 - cy;
    let s;
    if (key === 'ArrowRight') { if (dx <= 4) continue; s = dx + Math.abs(dy) * 2.2; }
    else if (key === 'ArrowLeft') { if (dx >= -4) continue; s = -dx + Math.abs(dy) * 2.2; }
    else if (key === 'ArrowDown') { if (dy <= 4) continue; s = dy + Math.abs(dx) * 2.2; }
    else { if (dy >= -4) continue; s = -dy + Math.abs(dx) * 2.2; }
    if (it.p === n.id || n.p === it.id) s *= 0.6;           // favorise parent / enfants
    if (s < bs) { bs = s; best = it; }
  }
  if (best) { sel = new Set([best.id]); onSel(); render(); ensureVisible(best.id); }
}
function duplicate() {
  if (!sel.size) return;
  const data = copySel();
  pasteItems(data.items, null, 28);
}
function copySel() {
  computeTree();
  const ids = new Set();
  for (const id of sel) { const it = get(id); if (!it) continue; if (it.k === 'node') subtreeIds(id).forEach(x => ids.add(x)); else ids.add(id); }
  for (const it of B.items) if (it.k === 'line' && it.a.id && it.b.id && ids.has(it.a.id) && ids.has(it.b.id)) ids.add(it.id);
  const items = B.items.filter(it => ids.has(it.id)).map(it => {
    const c = JSON.parse(JSON.stringify(it));
    if (c.k === 'node' && c.p && !ids.has(c.p)) { const g = G.get(c.id); c.p = null; c.x = g ? r1(g.x + g.w / 2) : 0; c.y = g ? r1(g.y + g.h / 2) : 0; c.lay = layOf(it); delete c.dx; delete c.dy; delete c.side; delete c.o; const gg = G.get(it.id); if (gg && c.c == null && typeof gg.col === 'number') c.c = gg.col; }
    if (c.k === 'line') for (const k of ['a', 'b']) if (c[k].id && !ids.has(c[k].id)) { const g = LG.get(it.id); const p = g ? g[k === 'a' ? 'A' : 'B'] : { x: 0, y: 0 }; c[k] = { x: r1(p.x), y: r1(p.y) }; }
    return c;
  });
  const text = items.filter(i => i.k === 'node' && !i.p).map(r => outlineOf(r.id, 0)).join('\n') ||
    items.filter(i => i.t).map(i => i.t).join('\n');
  CLIP = { items, text };
  return CLIP;
}
function outlineOf(id, d) {
  const n = get(id); if (!n) return '';
  let s = '  '.repeat(d) + (d ? '- ' : '') + (n.t || '').replace(/\n/g, ' ');
  for (const k of kids(id)) s += '\n' + outlineOf(k.id, d + 1);
  return s;
}
KM.outlineOf = (id) => outlineOf(id, 0);
function pasteItems(items, at, off) {
  if (!items || !items.length) return;
  const map = new Map();
  items.forEach(it => map.set(it.id, uid()));
  const out = items.map(src => {
    const it = JSON.parse(JSON.stringify(src));
    it.id = map.get(src.id);
    if (it.k === 'node' && it.p) it.p = map.get(it.p) || null;
    if (it.k === 'line') for (const k of ['a', 'b']) if (it[k].id) { if (map.has(it[k].id)) it[k] = { id: map.get(it[k].id) }; else return null; }
    return it;
  }).filter(Boolean);
  // décalage
  let dx = off || 0, dy = off || 0;
  if (at) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const it of out) {
      let pts = [];
      if (it.k === 'node' && !it.p) pts = [[it.x, it.y]];
      else if (it.k === 'ink') for (let i = 0; i < it.pts.length; i += 2) pts.push([it.pts[i], it.pts[i + 1]]);
      else if (it.k === 'line') pts = [it.a, it.b].filter(p => !p.id).map(p => [p.x, p.y]);
      else if (it.x != null) pts = [[it.x, it.y], [it.x + (it.w || 0), it.y + (it.h || 0)]];
      for (const [x, y] of pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    }
    if (x1 !== Infinity) { dx = at.x - (x1 + x2) / 2; dy = at.y - (y1 + y2) / 2; }
  }
  for (const it of out) if (!(it.k === 'node' && it.p)) moveItem(it, dx, dy);
  out.forEach(addItem);
  sel = new Set(out.filter(it => !(it.k === 'node' && it.p)).map(it => it.id));
  onSel(); commit(); render();
}
KM.pasteItems = (items, at) => pasteItems(items, at || viewCenter());
function pasteText(text, at) {
  text = String(text || '').replace(/\r/g, '');
  if (!text.trim()) return;
  const lines = text.split('\n').filter(l => l.trim());
  const one = sel.size === 1 ? get([...sel][0]) : null;
  if (one && one.k === 'node' && typeof KM.parseOutline === 'function') {
    const forest = KM.parseOutline(text);
    computeTree();
    let first = null;
    const addRec = (t, pid) => { const n = newNode(pid, { t: t.t }); if (t.note) n.note = t.note; first = first || n; (t.kids || []).forEach(k => addRec(k, n.id)); };
    forest.forEach(t => addRec(t, one.id));
    commit(); render();
    toast(lines.length > 1 ? lines.length + ' idées ajoutées' : 'Idée ajoutée');
    return;
  }
  const p = at || LAST_PT || viewCenter();
  if (lines.length > 1 && typeof KM.parseOutline === 'function') { KM.insertTree(KM.forestToTree(KM.parseOutline(text), 'Plan'), p); return; }
  const s = addItem({ id: uid(), k: 'sticky', x: r1(p.x - 100), y: r1(p.y - 100), w: 200, h: 200, t: text.trim().slice(0, 600), c: opt.stickyC });
  sel = new Set([s.id]); onSel(); commit(); render();
}
KM.insertTree = function (tree, at) {
  if (!B || typeof KM.treeToItems !== 'function') return;
  let p = at || viewCenter();
  const box = contentBox();
  if (!at && box) p = { x: box.x + box.w + 420, y: box.y + box.h / 2 };
  const items = KM.treeToItems(tree, r1(p.x), r1(p.y), tree.lay ? { lay: tree.lay } : {});
  items.forEach(addItem);
  render();
  if (!at && box) {                           // pose la nouvelle carte à droite, sans chevauchement
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const it of items) { const g = G.get(it.id); if (!g) continue; x1 = Math.min(x1, g.x); y1 = Math.min(y1, g.y); x2 = Math.max(x2, g.x + g.w); y2 = Math.max(y2, g.y + g.h); }
    if (x1 !== Infinity) { items[0].x = r1(items[0].x + (box.x + box.w + 160) - x1); items[0].y = r1(items[0].y + (box.y + box.h / 2) - (y1 + y2) / 2); }
  }
  sel = new Set([items[0].id]); onSel(); commit(); render();
  fit(true);
};
function addImageFile(file, at) {
  if (!file || !/^image\//.test(file.type)) return;
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1100, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cw = Math.max(1, Math.round(img.naturalWidth * k)), ch = Math.max(1, Math.round(img.naturalHeight * k));
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
      const alpha = /png|gif|svg|webp/.test(file.type);
      let src = alpha ? cv.toDataURL('image/webp', 0.86) : cv.toDataURL('image/jpeg', 0.84);
      if (alpha && src.indexOf('data:image/webp') !== 0) src = cv.toDataURL('image/png');
      const p = at || viewCenter(), dw = Math.min(cw, 420), dh = dw * ch / cw;
      const it = addItem({ id: uid(), k: 'img', x: r1(p.x - dw / 2), y: r1(p.y - dh / 2), w: r1(dw), h: r1(dh), src });
      sel = new Set([it.id]); onSel(); commit(); render();
      if (!saveNow()) { removeItems([it.id]); H.cur = JSON.stringify(B.items); render(); }
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function editNote(id) {
  const it = get(id); if (!it) return;
  const d = dialog({
    title: 'Note de l’idée', html: '<p class="km-dlg-sub">' + esc(it.t || 'Idée') + '</p><textarea class="km-ta" rows="7" placeholder="Détails, définition, moyen mnémotechnique…">' + esc(it.note || '') + '</textarea>',
    foot: (it.note ? '<button class="km-b2 ghost" data-k="del">Supprimer la note</button>' : '') + '<button class="km-b2 pri" data-k="ok">Enregistrer</button>',
    onMount(w, close) {
      const ta = w.querySelector('textarea'); setTimeout(() => ta.focus(), 30);
      w.addEventListener('click', e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        if (b.dataset.k === 'del') delete it.note; else { const v = ta.value.trim(); if (v) it.note = v; else delete it.note; }
        ctxSig = ''; commit(); render(); close();
      });
    }
  });
  return d;
}
function showNote(id) {
  const it = get(id); if (!it || !it.note) return;
  dialog({ title: it.t || 'Note', html: '<div class="km-note-view">' + esc(it.note).replace(/\n/g, '<br>') + '</div>', foot: REV ? '' : '<button class="km-b2" data-k="edit">Modifier</button>', onMount(w, close) { w.addEventListener('click', e => { if (e.target.closest('[data-k="edit"]')) { close(); editNote(id); } }); } });
}

/* Glisser-déposer des idées */
function findDrop(id, pt) {
  const ex = new Set(subtreeIds(id));
  let best = null;
  for (const it of B.items) {
    if (it.k !== 'node' || ex.has(it.id)) continue;
    const g = G.get(it.id); if (!g) continue;
    const m = 8;
    if (pt.x < g.x - m || pt.x > g.x + g.w + m || pt.y < g.y - m || pt.y > g.y + g.h + m) continue;
    let mode = 'child';
    if (it.p) {
      const rel = g.lay === 'down' ? (pt.x - g.x) / g.w : (pt.y - g.y) / g.h;
      if (rel < 0.3) mode = 'before'; else if (rel > 0.7) mode = 'after';
    }
    best = { id: it.id, mode, side: !it.p ? (pt.x < g.x + g.w / 2 ? 'l' : 'r') : null };
  }
  return best;
}
function applyDrop(id, drop) {
  const n = get(id), tgt = get(drop.id); if (!n || !tgt) return;
  const wasRoot = !n.p, wasL1 = !!(n.p && get(n.p) && !get(n.p).p);
  delete n.dx; delete n.dy;
  if (drop.mode === 'child') {
    n.p = tgt.id; n.o = lastOrder(tgt.id) + 1;
    if (!tgt.p) { n.side = (tgt.lay || 'map') === 'map' ? (drop.side || 'r') : 'r'; if (n.c == null || !wasL1) n.c = nextColor(tgt); }
    else delete n.side;
  } else {
    n.p = tgt.p;
    normOrders(tgt.p);
    const sibs = kids(tgt.p).filter(k => k.id !== id), i = sibs.indexOf(tgt);
    const prev = drop.mode === 'before' ? sibs[i - 1] : tgt, next = drop.mode === 'before' ? tgt : sibs[i + 1];
    n.o = prev && next ? ((prev.o || 0) + (next.o || 0)) / 2 : prev ? (prev.o || 0) + 1 : (next.o || 0) - 1;
    const par = get(tgt.p);
    if (par && !par.p) { n.side = tgt.side || 'r'; if (n.c == null || !wasL1) n.c = nextColor(par); } else delete n.side;
  }
  const par = get(n.p);
  if (wasL1 && par && par.p) delete n.c;
  if (wasRoot) { delete n.x; delete n.y; delete n.lay; }
}
function maybeFlipSide(id, pt) {
  const n = get(id); if (!n || !n.p) return;
  const par = get(n.p); if (!par || par.p || (par.lay || 'map') !== 'map') return;
  const pg = G.get(par.id); if (!pg) return;
  const left = pt.x < pg.x + pg.w / 2;
  if (left !== (n.side === 'l')) { n.side = left ? 'l' : 'r'; delete n.dx; delete n.dy; }
}

/* ───────────────────────── Pointeur ───────────────────────── */
function inkHit(it, pt, tol) {
  const b = inkBB(it);
  if (pt.x < b.x - tol || pt.x > b.x + b.w + tol || pt.y < b.y - tol || pt.y > b.y + b.h + tol) return false;
  const p = it.pts;
  if (p.length < 4) return Math.hypot(pt.x - p[0], pt.y - p[1]) <= tol;
  for (let i = 0; i < p.length - 2; i += 2) if (distSeg(pt, { x: p[i], y: p[i + 1] }, { x: p[i + 2], y: p[i + 3] }) <= tol) return true;
  return false;
}
function lineHit(it, pt, tol) {
  const g = LG.get(it.id); if (!g) return false;
  const b = g.bb;
  if (pt.x < b.x - tol || pt.x > b.x + b.w + tol || pt.y < b.y - tol || pt.y > b.y + b.h + tol) return false;
  for (let i = 0; i < g.pts.length - 1; i++) if (distSeg(pt, g.pts[i], g.pts[i + 1]) <= tol) return true;
  return false;
}
function hitTest(pt, target) {
  const tol = 6 / V.z;
  for (let i = B.items.length - 1; i >= 0; i--) { const it = B.items[i]; if (it.k === 'ink' && inkHit(it, pt, tol + (it.w || 3) / 2)) return it.id; }
  const host = target && target.closest ? target.closest('[data-id]') : null;
  if (host && byId.has(host.dataset.id)) return host.dataset.id;
  for (let i = B.items.length - 1; i >= 0; i--) { const it = B.items[i]; if (it.k === 'line' && lineHit(it, pt, tol + (it.w || 2) / 2)) return it.id; }
  return null;
}
function itemAt(pt, excl) {
  let frame = null;
  for (let i = B.items.length - 1; i >= 0; i--) {
    const it = B.items[i];
    if (it.k === 'ink' || it.k === 'line' || it.id === excl) continue;
    const g = G.get(it.id); if (!g) continue;
    if (pt.x >= g.x && pt.x <= g.x + g.w && pt.y >= g.y && pt.y <= g.y + g.h) { if (it.k === 'frame') { frame = frame || it.id; continue; } return it.id; }
  }
  return frame;
}
function listen() { window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp); }
function unlisten() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); }

function onDown(e) {
  if (!B) return;
  const t = e.target;
  if (t.closest('.km-ui')) return;
  closeFloating();
  VPR = E.vp.getBoundingClientRect();
  if (EDIT) { if (EDIT.el && t.closest('.km-t') === EDIT.el) return; commitEdit(); }
  if (document.activeElement && document.activeElement !== document.body && E.app.contains(document.activeElement)) document.activeElement.blur();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { beginPinch(); return; }
  if (pointers.size > 2) return;
  const pt = toWorld(e.clientX, e.clientY), touch = e.pointerType === 'touch';
  if (e.button === 2) { e.preventDefault(); beginPan(e, true); return; }
  if (e.button === 1 || spaceDown || tool === 'hand') { e.preventDefault(); beginPan(e); return; }
  if (e.button !== 0) return;
  e.preventDefault();
  if (REV) {
    const rv = t.closest('[data-rv]');
    if (rv && REV.last) { (rv.dataset.rv === 'ok' ? REV.ok : REV.ko).add(REV.last); (rv.dataset.rv === 'ok' ? REV.ko : REV.ok).delete(REV.last); REV.last = null; renderRevBar(); render(); maybeRevEnd(); return; }
    if (t.closest('[data-note]')) { const host = t.closest('[data-id]'); if (host && !isMasked(host.dataset.id)) { showNote(host.dataset.id); return; } }
    const id = hitTest(pt, t);
    if (id && get(id).k === 'node' && isMasked(id)) { reveal(id); render(); return; }
    beginPan(e); return;
  }
  if (P && P.mode === 'line2') { finishLine(pt); return; }
  if (tool === 'pen') { beginInk(e, pt); return; }
  if (tool === 'eraser') { beginErase(e, pt); return; }
  if (tool === 'line') { beginLine(e, pt); return; }
  if (tool !== 'select') { beginCreate(e, pt); return; }
  const hEl = t.closest('[data-h]'); if (hEl) { beginResize(e, pt, hEl.dataset.h); return; }
  const aEl = t.closest('[data-add]'); if (aEl) { const one = [...sel][0]; if (one) addChild(one, aEl.dataset.add); return; }
  const eEl = t.closest('[data-end]'); if (eEl) { beginLineEnd(e, eEl.dataset.end); return; }
  const fEl = t.closest('[data-fold]'); if (fEl) { const host = fEl.closest('[data-id]'); if (host) toggleFold(host.dataset.id); return; }
  const nEl = t.closest('[data-note]'); if (nEl) { const host = nEl.closest('[data-id]'); if (host) showNote(host.dataset.id); return; }
  const id = hitTest(pt, t);
  if (id) {
    const wasOnly = sel.size === 1 && sel.has(id);
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      if (sel.has(id)) { sel.delete(id); onSel(); render(); return; }
      sel.add(id);
    } else if (!sel.has(id)) sel = new Set([id]);
    onSel();
    if (touch && isDoubleTap(e, id)) { if (hasText(get(id))) startEdit(id, { selectAll: get(id).k === 'node' }); return; }
    beginMove(e, pt, id, wasOnly);
  } else {
    if (!e.shiftKey) { sel.clear(); onSel(); }
    if (touch) { if (isDoubleTap(e, null)) { createRootAt(pt); return; } beginPan(e); }
    else beginMarquee(e, pt);
  }
  render();
}
function isDoubleTap(e, id) {
  const now = Date.now(), prev = lastTap;
  lastTap = { t: now, x: e.clientX, y: e.clientY, id };
  return !!(prev && now - prev.t < 340 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24 && prev.id === id);
}
function beginPan(e, rc) {
  P = { mode: 'pan', pid: e.pointerId, sx: e.clientX, sy: e.clientY, vx: V.x, vy: V.y, rc: !!rc, moved: false, ce: e };
  E.app.classList.add('km-panning');
  listen();
}
function beginPinch() {
  const [a, b] = [...pointers.values()];
  if (P && P.mode === 'move' && P.moved) commit();
  if (P && P.mode === 'ink') P = null;
  P = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: { ...V } };
  listen();
}
function movableSet() {
  computeTree();
  const ids = new Set(sel);
  for (const id of sel) {
    const it = get(id);
    if (it && it.k === 'frame') {
      const fr = { x: it.x, y: it.y, w: it.w, h: it.h };
      for (const o of B.items) {
        if (o.id === id || ids.has(o.id) || (o.k === 'node' && o.p)) continue;
        const b = itemBox(o); if (!b) continue;
        if (b.x >= fr.x && b.y >= fr.y && b.x + b.w <= fr.x + fr.w && b.y + b.h <= fr.y + fr.h) ids.add(o.id);
      }
    }
  }
  for (const id of [...ids]) {                                  // pas de double déplacement dans un arbre
    const it = get(id);
    if (it && it.k === 'node') { let p = it.p ? get(it.p) : null; while (p) { if (ids.has(p.id)) { ids.delete(id); break; } p = p.p ? get(p.p) : null; } }
  }
  return ids;
}
function beginMove(e, pt, hitId, wasOnly) {
  const ids = movableSet(), orig = new Map();
  for (const id of ids) {
    const it = get(id); if (!it) continue;
    orig.set(id, it.k === 'ink' ? it.pts.slice() : it.k === 'line' ? { a: { ...it.a }, b: { ...it.b } } : it.k === 'node' && it.p ? { dx: it.dx || 0, dy: it.dy || 0 } : { x: it.x || 0, y: it.y || 0 });
  }
  const hit = get(hitId);
  const dragNode = sel.size === 1 && hit && hit.k === 'node' ? hit.id : null;
  P = { mode: 'move', pid: e.pointerId, start: pt, orig, moved: false, sx: e.clientX, sy: e.clientY, dragNode, wasOnly, hitId, dragIds: new Set(dragNode ? subtreeIds(dragNode) : ids) };
  listen();
}
function beginResize(e, pt, hnd) {
  const it = get([...sel][0]); if (!it) return;
  const g = itemBox(it);
  P = { mode: 'resize', pid: e.pointerId, hnd, id: it.id, start: pt, o: { x: g.x, y: g.y, w: g.w, h: g.h }, moved: false };
  listen();
}
function beginMarquee(e, pt) { P = { mode: 'marq', pid: e.pointerId, start: pt, cur: pt, base: e.shiftKey ? new Set(sel) : new Set(), moved: false }; listen(); }
function beginCreate(e, pt) { P = { mode: 'create', pid: e.pointerId, tool, start: pt, cur: pt, sx: e.clientX, sy: e.clientY, moved: false }; listen(); }
function beginInk(e, pt) {
  const it = { id: uid(), k: 'ink', pts: [r1(pt.x), r1(pt.y)], c: opt.hl ? opt.hlC : opt.penC, w: opt.hl ? 18 : opt.penW };
  if (opt.hl) it.hl = 1;
  P = { mode: 'ink', pid: e.pointerId, it };
  E.live.setAttribute('d', '');
  E.live.style.stroke = it.hl ? colHex(it.c, HILITE) : (it.c ? inkHex(it.c) : 'var(--km-text)');
  E.live.style.strokeWidth = it.w;
  E.live.classList.toggle('hl', !!it.hl);
  listen();
}
function beginErase(e, pt) { P = { mode: 'erase', pid: e.pointerId, hit: false }; eraseAt(pt); listen(); }
function eraseAt(pt) {
  const r = 9 / V.z;
  for (let i = B.items.length - 1; i >= 0; i--) {
    const it = B.items[i];
    if (it.k === 'ink' && inkHit(it, pt, r + (it.w || 3) / 2)) { B.items.splice(i, 1); byId.delete(it.id); sel.delete(it.id); P.hit = true; }
  }
  if (P.hit) req();
}
function beginLine(e, pt) {
  const id = itemAt(pt);
  P = { mode: 'line', pid: e.pointerId, a: id ? { id } : { x: r1(pt.x), y: r1(pt.y) }, cur: pt, hover: null, sx: e.clientX, sy: e.clientY, moved: false };
  listen();
}
function finishLine(pt) {
  const aid = P.a.id, bid = itemAt(pt, aid);
  const b = bid ? { id: bid } : { x: r1(pt.x), y: r1(pt.y) };
  if (!bid && !aid && Math.hypot(b.x - P.a.x, b.y - P.a.y) < 8 / V.z) { P = null; render(); return; }
  if (bid && bid === aid) { P = null; render(); return; }
  const ln = addItem({ id: uid(), k: 'line', a: P.a, b, st: 'curve', w: 2, eb: 1 });
  P = null;
  sel = new Set([ln.id]); onSel(); setTool('select'); commit(); render();
}
function beginLineEnd(e, end) {
  const ln = get([...sel][0]); if (!ln || ln.k !== 'line') return;
  P = { mode: 'lend', pid: e.pointerId, end, id: ln.id, hover: null, moved: false };
  listen();
}

function onMove(e) {
  if (!P) return;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (P.mode === 'pinch') {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()], r = VPR || E.vp.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const z = clamp(P.v0.z * d / P.d0, ZMIN, ZMAX);
    const wx = (P.m0.x - r.left - P.v0.x) / P.v0.z, wy = (P.m0.y - r.top - P.v0.y) / P.v0.z;
    V = { z, x: m.x - r.left - wx * z, y: m.y - r.top - wy * z };
    applyView(); return;
  }
  if (P.pid != null && e.pointerId !== P.pid) return;
  const pt = toWorld(e.clientX, e.clientY);
  switch (P.mode) {
    case 'pan':
      if (!P.moved && Math.hypot(e.clientX - P.sx, e.clientY - P.sy) > 3) P.moved = true;
      V.x = P.vx + e.clientX - P.sx; V.y = P.vy + e.clientY - P.sy; applyView(); break;
    case 'move': {
      if (!P.moved) { if (Math.hypot(e.clientX - P.sx, e.clientY - P.sy) < 4) return; P.moved = true; }
      const dx = pt.x - P.start.x, dy = pt.y - P.start.y;
      for (const [id, o] of P.orig) {
        const it = get(id); if (!it) continue;
        if (it.k === 'ink') it.pts = o.map((v, i) => r1(v + (i % 2 ? dy : dx)));
        else if (it.k === 'line') { if (!it.a.id) it.a = { x: r1(o.a.x + dx), y: r1(o.a.y + dy) }; if (!it.b.id) it.b = { x: r1(o.b.x + dx), y: r1(o.b.y + dy) }; }
        else if (it.k === 'node' && it.p) { it.dx = r1(o.dx + dx); it.dy = r1(o.dy + dy); }
        else { it.x = r1(o.x + dx); it.y = r1(o.y + dy); }
      }
      if (P.dragNode) P.drop = findDrop(P.dragNode, pt);
      req(); break;
    }
    case 'resize': {
      const it = get(P.id); if (!it) return;
      P.moved = true;
      const o = P.o, h = P.hnd, dx = pt.x - P.start.x, dy = pt.y - P.start.y, minW = it.k === 'text' ? 40 : 30, minH = 24;
      let x = o.x, y = o.y, w = o.w, hh = o.h;
      if (h.includes('e')) w = Math.max(minW, o.w + dx);
      if (h.includes('w')) { w = Math.max(minW, o.w - dx); x = o.x + o.w - w; }
      if (h.includes('s')) hh = Math.max(minH, o.h + dy);
      if (h.includes('n')) { hh = Math.max(minH, o.h - dy); y = o.y + o.h - hh; }
      if (it.k === 'img' || (e.shiftKey && it.k !== 'text')) { const ratio = o.w / o.h; hh = w / ratio; if (h.includes('n')) y = o.y + o.h - hh; }
      if (it.k === 'text') { it.w = r1(w); it.x = r1(x); }
      else { it.x = r1(x); it.y = r1(y); it.w = r1(w); it.h = r1(hh); }
      DIRTY.add(it.id); req(); break;
    }
    case 'marq': {
      P.cur = pt; P.moved = true;
      const x1 = Math.min(P.start.x, pt.x), y1 = Math.min(P.start.y, pt.y), x2 = Math.max(P.start.x, pt.x), y2 = Math.max(P.start.y, pt.y);
      sel = new Set(P.base);
      for (const it of B.items) {
        const b = itemBox(it); if (!b) continue;
        const inter = b.x <= x2 && b.x + b.w >= x1 && b.y <= y2 && b.y + b.h >= y1;
        const inside = b.x >= x1 && b.y >= y1 && b.x + b.w <= x2 && b.y + b.h <= y2;
        if (it.k === 'frame' ? inside : inter) sel.add(it.id);
      }
      onSel(); req(); break;
    }
    case 'create':
      P.cur = pt;
      if (!P.moved && Math.hypot(e.clientX - P.sx, e.clientY - P.sy) > 6) P.moved = true;
      req(); break;
    case 'ink': {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e], p = P.it.pts;
      for (const ce of (evs.length ? evs : [e])) {
        const q = toWorld(ce.clientX, ce.clientY);
        if (Math.hypot(q.x - p[p.length - 2], q.y - p[p.length - 1]) * V.z >= 1.5) p.push(r1(q.x), r1(q.y));
      }
      INKD.delete(p);
      E.live.setAttribute('d', inkD(p));
      INKD.delete(p);
      break;
    }
    case 'erase': eraseAt(pt); break;
    case 'line':
      P.cur = pt; P.hover = itemAt(pt, P.a.id);
      if (!P.moved && Math.hypot(e.clientX - P.sx, e.clientY - P.sy) > 6) P.moved = true;
      drawOverlay(); break;
    case 'lend': {
      const ln = get(P.id); if (!ln) return;
      P.moved = true;
      const other = ln[P.end === 'a' ? 'b' : 'a'];
      P.hover = itemAt(pt, other.id);
      ln[P.end] = P.hover ? { id: P.hover } : { x: r1(pt.x), y: r1(pt.y) };
      req(); break;
    }
  }
}
function onUp(e) {
  if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);
  if (!P) { unlisten(); return; }
  if (P.mode === 'pinch') { if (pointers.size < 2) { P = null; unlisten(); } return; }
  if (P.pid != null && e.pointerId !== P.pid) return;
  const pt = toWorld(e.clientX, e.clientY), mode = P.mode;
  unlisten();
  E.app.classList.remove('km-panning');
  switch (mode) {
    case 'pan':
      if (P.rc && !P.moved) { const ce = P.ce; P = null; ctxMenu(ce); return; }
      break;
    case 'move':
      if (P.moved) {
        if (P.drop) applyDrop(P.dragNode, P.drop);
        else if (P.dragNode) maybeFlipSide(P.dragNode, pt);
        P = null; commit(); render(); return;
      }
      if (P.wasOnly && hasText(get(P.hitId)) && e.pointerType !== 'touch') { const id = P.hitId; P = null; startEdit(id, { selectAll: false }); return; }
      break;
    case 'resize': if (P.moved) { P = null; commit(); render(); return; } break;
    case 'create': { const c = P; P = null; createFromTool(c); return; }
    case 'ink': {
      const it = P.it; P = null;
      E.live.setAttribute('d', '');
      it.pts = simplify(it.pts, 0.45 / V.z);
      if (it.pts.length === 2) it.pts.push(r1(it.pts[0] + 0.1), it.pts[1]);
      addItem(it); commit(); render(); return;
    }
    case 'erase': { const hit = P.hit; P = null; if (hit) { commit(); render(); } return; }
    case 'line':
      if (P.moved) { finishLine(pt); return; }
      P.mode = 'line2'; P.pid = null; drawOverlay(); return;
    case 'lend': P = null; commit(); render(); return;
    case 'marq': break;
  }
  P = null;
  render();
}
function createFromTool(c) {
  const pt = c.start, t = c.tool;
  let it = null;
  if (t === 'node') { setTool('select'); createRootAt(pt); return; }
  if (t === 'sticky') it = { id: uid(), k: 'sticky', x: r1(pt.x - 100), y: r1(pt.y - 100), w: 200, h: 200, t: '', c: opt.stickyC };
  else if (t === 'text') it = { id: uid(), k: 'text', x: r1(pt.x), y: r1(pt.y - 14), t: '' };
  else if (t === 'shape' || t === 'frame') {
    let x, y, w, h;
    if (c.moved) { x = Math.min(c.start.x, c.cur.x); y = Math.min(c.start.y, c.cur.y); w = Math.max(30, Math.abs(c.cur.x - c.start.x)); h = Math.max(24, Math.abs(c.cur.y - c.start.y)); }
    else if (t === 'frame') { w = 560; h = 380; x = pt.x - w / 2; y = pt.y - h / 2; }
    else { w = opt.shape === 'ellipse' || opt.shape === 'diamond' || opt.shape === 'star' || opt.shape === 'hexagon' ? 150 : 170; h = opt.shape === 'rect' || opt.shape === 'round' || opt.shape === 'para' ? 100 : 130; x = pt.x - w / 2; y = pt.y - h / 2; }
    it = t === 'frame' ? { id: uid(), k: 'frame', x: r1(x), y: r1(y), w: r1(w), h: r1(h), t: 'Cadre ' + (B.items.filter(i => i.k === 'frame').length + 1) }
      : { id: uid(), k: 'shape', s: opt.shape, x: r1(x), y: r1(y), w: r1(w), h: r1(h), t: '' };
  }
  if (!it) return;
  if (it.k === 'frame') B.items.unshift(it), byId.set(it.id, it); else addItem(it);
  sel = new Set([it.id]); onSel(); setTool('select');
  if (it.k === 'sticky' || it.k === 'text') startEdit(it.id, { isNew: true });
  else { commit(); render(); }
}
function simplify(p, eps) {
  if (p.length <= 6) return p;
  const pts = []; for (let i = 0; i < p.length; i += 2) pts.push({ x: p[i], y: p[i + 1] });
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = distSeg(pts[i], pts[a], pts[b]); if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  const out = []; pts.forEach((q, i) => { if (keep[i]) out.push(q.x, q.y); });
  return out;
}
function onHover(e) {
  if (!B || e.buttons) return;
  VPR = E.vp.getBoundingClientRect();
  LAST_PT = toWorld(e.clientX, e.clientY);
  if (P && P.mode === 'line2') { P.cur = LAST_PT; P.hover = itemAt(LAST_PT, P.a.id); drawOverlay(); }
}
function onWheel(e) {
  if (!B) return;
  e.preventDefault();
  if (inGesture) return;
  const r = E.vp.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  let dx = e.deltaX, dy = e.deltaY;
  if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= r.width; dy *= r.height; }
  if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-clamp(dy, -30, 30) * 0.0085), sx, sy);
  else {
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    V.x -= dx; V.y -= dy; applyView();
  }
}
function onDblClick(e) {
  if (!B || REV || e.target.closest('.km-ui')) return;
  if (EDIT && EDIT.el && EDIT.el.contains(e.target)) return;
  VPR = E.vp.getBoundingClientRect();
  const pt = toWorld(e.clientX, e.clientY);
  const id = hitTest(pt, e.target);
  if (id) { const it = get(id); if (hasText(it)) startEdit(id, { selectAll: it.k === 'node' || it.k === 'frame' }); return; }
  if (tool === 'select') { createRootAt(pt); }
}

/* ───────────────────────── Clavier & presse-papiers ───────────────────────── */
const TOOLKEYS = { v: 'select', h: 'hand', m: 'node', t: 'text', n: 'sticky', s: 'sticky', r: 'shape', o: 'shape', l: 'line', f: 'frame', p: 'pen', e: 'eraser' };
function onKeyDown(e) {
  if (!isActive()) return;
  if (PR && !document.querySelector('.km-dlg, .mdbg.open')) {
    const k0 = e.key;
    if (k0 === 'ArrowRight' || k0 === 'ArrowDown' || k0 === ' ' || k0 === 'PageDown' || k0 === 'Enter') { e.preventDefault(); e.stopPropagation(); presentGo(PR.i + 1); return; }
    if (k0 === 'ArrowLeft' || k0 === 'ArrowUp' || k0 === 'PageUp' || k0 === 'Backspace') { e.preventDefault(); e.stopPropagation(); presentGo(PR.i - 1); return; }
    if (k0 === 'Escape') { e.preventDefault(); e.stopPropagation(); stopPresent(); return; }
  }
  const t = e.target;
  if (t && t.closest && t.closest('.km-dlg, .mdbg.open')) return;
  if (document.querySelector('.km-dlg, .mdbg.open')) return;
  const k = e.key, mod = e.metaKey || e.ctrlKey;
  if (EDIT) {
    const it = get(EDIT.id);
    if (k === 'Escape') { e.preventDefault(); commitEdit(); if (sel.size) { sel.clear(); onSel(); render(); } }
    else if (k === 'Enter' && !e.shiftKey && !e.altKey && it && (mod || it.k === 'node' || it.k === 'line' || it.k === 'frame')) { e.preventDefault(); commitEdit(); }
    else if (k === 'Tab' && it && it.k === 'node') { e.preventDefault(); const id = EDIT.id; commitEdit(); if (get(id)) addChild(id); }
    return;
  }
  if (t && t.matches && (t.matches('input, textarea, select') || t.isContentEditable)) { if (k === 'Escape') t.blur(); return; }
  e.stopPropagation();                        // garde les raccourcis globaux de l'appli à l'écart
  if (REV) { if (k === 'Escape') stopRevision(); return; }
  const kl = k.length === 1 ? k.toLowerCase() : k;
  if (mod) {
    if (kl === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (kl === 'y') { e.preventDefault(); redo(); return; }
    if (kl === 'a') { e.preventDefault(); selectAll(); return; }
    if (kl === 'd') { e.preventDefault(); duplicate(); return; }
    if (kl === 'f' || kl === 'k') { e.preventDefault(); openSearch(); return; }
    if (kl === 's') { e.preventDefault(); dataDirty = true; if (saveNow()) toast('Carte enregistrée'); return; }
    if (kl === 'b') { e.preventDefault(); ctxAction('bold'); return; }
    if (k === '0') { e.preventDefault(); zoomTo(1); return; }
    if (k === '=' || k === '+') { e.preventDefault(); zoomBy(1.25); return; }
    if (k === '-') { e.preventDefault(); zoomBy(0.8); return; }
    if (k === 'Enter') { e.preventDefault(); return; }
    return;
  }
  if (k === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; E.app.classList.add('km-space'); } return; }
  if (k === 'Escape') {
    if (P && P.mode === 'line2') { P = null; render(); return; }
    if (sel.size) { sel.clear(); onSel(); render(); } else setTool('select');
    return;
  }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  const one = sel.size === 1 ? get([...sel][0]) : null;
  if (k === 'Tab') { e.preventDefault(); if (one && one.k === 'node') addChild(one.id); return; }
  if (k === 'Enter') { e.preventDefault(); if (one) { if (one.k === 'node') addSibling(one.id); else if (hasText(one)) startEdit(one.id, { selectAll: true }); } return; }
  if (k === 'F2') { e.preventDefault(); if (one && hasText(one)) startEdit(one.id, { selectAll: true }); return; }
  if (k.indexOf('Arrow') === 0) { e.preventDefault(); if (one && one.k === 'node' && !e.altKey) navNode(one, k); else if (sel.size) nudge(k, e.shiftKey ? 10 : 1); return; }
  if (e.shiftKey && (e.code === 'Digit1' || k === '!')) { e.preventDefault(); fit(true); return; }
  if (e.shiftKey && e.code === 'Digit0') { e.preventDefault(); zoomTo(1); return; }
  if (k === '?' && !one) { e.preventDefault(); showHelp(); return; }
  if (one && hasText(one) && !e.altKey && (k.length === 1 || k === 'Dead')) { startEdit(one.id, { replace: true }); return; }
  if (k === '+' || k === '=') { zoomBy(1.25); return; }
  if (k === '-') { zoomBy(0.8); return; }
  if (TOOLKEYS[kl]) { e.preventDefault(); setTool(TOOLKEYS[kl]); }
}
function onKeyUp(e) { if (e.key === ' ' && spaceDown) { spaceDown = false; if (E) E.app.classList.remove('km-space'); } }
function typingTarget(e) { const t = e.target; return t && t.matches && (t.matches('input, textarea') || t.isContentEditable); }
function onCopy(e, cut) {
  if (!isActive() || EDIT || typingTarget(e) || !sel.size || document.querySelector('.km-dlg')) return;
  e.preventDefault();
  const data = copySel();
  try { e.clipboardData.setData('text/plain', data.text); e.clipboardData.setData('application/x-kineplus-carte', JSON.stringify(data.items)); } catch (er) { /* rien */ }
  if (cut) deleteSel();
}
function onPaste(e) {
  if (!isActive() || EDIT || typingTarget(e) || REV || document.querySelector('.km-dlg')) return;
  const cd = e.clipboardData; if (!cd) return;
  e.preventDefault();
  let json = ''; try { json = cd.getData('application/x-kineplus-carte'); } catch (er) { /* rien */ }
  if (json) { try { pasteItems(JSON.parse(json), LAST_PT || viewCenter()); return; } catch (er) { /* rien */ } }
  const files = [...(cd.files || [])].filter(f => /^image\//.test(f.type));
  if (files.length) { files.forEach((f, i) => addImageFile(f, { x: (LAST_PT || viewCenter()).x + i * 30, y: (LAST_PT || viewCenter()).y + i * 30 })); return; }
  const text = cd.getData('text/plain');
  if (CLIP && text && text === CLIP.text) { pasteItems(CLIP.items, LAST_PT || viewCenter()); return; }
  if (text) pasteText(text);
}

/* ───────────────────────── Interface ───────────────────────── */
const ICON_SHAPE = {
  rect: '<rect x="3" y="6" width="26" height="20" rx="1.5"/>', round: '<rect x="3" y="6" width="26" height="20" rx="7"/>',
  ellipse: '<ellipse cx="16" cy="16" rx="13" ry="10"/>', diamond: '<path d="M16 3L29 16L16 29L3 16Z"/>',
  triangle: '<path d="M16 4L29 27H3Z"/>', hexagon: '<path d="M9 5H23L29 16L23 27H9L3 16Z"/>',
  para: '<path d="M9 6H29L23 26H3Z"/>', star: '<path d="M16 3l3.7 8 8.3.8-6.3 5.6 1.9 8.3L16 21.4 8.4 25.7l1.9-8.3L4 11.8l8.3-.8z"/>',
  cloud: '<path d="M9 25C5 25 3 22 4 19C1 16 4 11 8 12C9 7 14 5 17.5 8C20 4.5 26 6 26.5 10.5C30 11.5 31 16 28 18.5C30 22 27 25.5 23 25Z"/>'
};
function ensureEditor() {
  if (E) return;
  const scr = document.getElementById('screen-mindmap-editor');
  if (!scr) return;
  scr.innerHTML = '';
  const app = el('div', 'km-app');
  app.dataset.tool = 'select';
  const toolBtn = (tl, icon, title, extra) => '<button class="km-tool" data-tool="' + tl + '" title="' + title + '" aria-label="' + title + '"' + (extra || '') + '><span class="ms">' + icon + '</span></button>';
  const actBtn = (act, icon, title) => '<button class="km-tool" data-act="' + act + '" title="' + title + '" aria-label="' + title + '"><span class="ms">' + icon + '</span></button>';
  app.innerHTML =
    '<div class="km-vp"><div class="km-wall"></div><div class="km-pat"></div><div class="km-world">' +
      '<div class="km-frames"></div>' +
      '<svg class="km-svg"><g class="km-g-br"></g><g class="km-g-ln"></g><path class="km-tmp"/></svg>' +
      '<div class="km-layer"></div>' +
      '<svg class="km-svg km-svg-ink"><g class="km-g-ink"></g><path class="km-ink km-live"/></svg>' +
    '</div></div>' +
    '<div class="km-ov"></div>' +
    '<div class="km-tlw">' +
    '<div class="km-ui km-bar km-top-l">' +
      '<button class="km-ib" data-act="back" title="Retour à mes cartes" aria-label="Retour"><span class="ms">arrow_back</span></button>' +
      '<div class="km-title" data-act="rename" title="Renommer la carte"></div>' +
      '<span class="km-save ms" data-st="ok">cloud_done</span>' +
      '<span class="km-vsep"></span>' +
      '<button class="km-ib" data-act="search" title="Rechercher (Ctrl+F)" aria-label="Rechercher"><span class="ms">search</span></button>' +
      '<div class="km-search"><input type="search" placeholder="Rechercher dans la carte…" aria-label="Rechercher"><span class="km-search-n"></span><button class="km-ib sm" data-act="snext" title="Suivant (Entrée)"><span class="ms">keyboard_arrow_down</span></button></div>' +
      '<button class="km-ib" data-act="menu" title="Menu" aria-label="Menu"><span class="ms">menu</span></button>' +
    '</div>' +
    '<div class="km-ui km-bar km-undo">' +
      '<button class="km-ib" data-act="undo" title="Annuler (Ctrl+Z)" aria-label="Annuler"><span class="ms">undo</span></button>' +
      '<button class="km-ib" data-act="redo" title="Rétablir (Ctrl+Maj+Z)" aria-label="Rétablir"><span class="ms">redo</span></button>' +
    '</div>' +
    '</div>' +
    '<div class="km-ui km-bar km-top-r">' +
      '<button class="km-btn km-revbtn" data-act="revise" title="Masquer les idées et les retrouver de mémoire"><span class="ms">school</span><span>Réviser</span></button>' +
      '<button class="km-ib" data-act="present" title="Présenter la carte branche par branche" aria-label="Présenter"><span class="ms">slideshow</span></button>' +
      '<button class="km-ib" data-act="style" title="Fond d’écran et couleurs" aria-label="Fond et couleurs"><span class="ms">palette</span></button>' +
      '<button class="km-ib" data-act="zen" title="Mode zen (cacher les outils)" aria-label="Mode zen"><span class="ms">self_improvement</span></button>' +
      '<button class="km-ib" data-act="outline" title="Plan de la carte" aria-label="Plan"><span class="ms">format_list_bulleted</span></button>' +
      '<button class="km-ib" data-act="export" title="Exporter en image (PNG)" aria-label="Exporter"><span class="ms">download</span></button>' +
    '</div>' +
    '<div class="km-ui km-tools">' +
      '<div class="km-tg">' + actBtn('templates', 'auto_awesome_mosaic', 'Modèles kiné') + actBtn('fromcourse', 'school', 'Créer depuis un cours') + actBtn('import', 'playlist_add', 'Importer un plan (texte)') + '</div>' +
      '<div class="km-tg">' +
        toolBtn('select', 'arrow_selector_tool', 'Sélection (V)') +
        toolBtn('hand', 'pan_tool', 'Main — se déplacer (H)') +
        toolBtn('node', 'account_tree', 'Nouvelle carte mentale (M)') +
        toolBtn('text', 'title', 'Texte (T)') +
        toolBtn('sticky', 'sticky_note_2', 'Post-it (N)') +
        toolBtn('shape', 'category', 'Formes (R)', ' data-fly="shapes"') +
        toolBtn('line', 'arrow_right_alt', 'Connecteur (L)') +
        toolBtn('frame', 'crop_free', 'Cadre (F)') +
        actBtn('image', 'image', 'Image') +
        toolBtn('pen', 'draw', 'Stylo (P)', ' data-fly="pen"') +
        toolBtn('eraser', 'ink_eraser', 'Gomme (E)') +
      '</div>' +
      '<div class="km-tg">' + actBtn('help', 'keyboard', 'Raccourcis clavier (?)') + '</div>' +
    '</div>' +
    '<div class="km-ui km-fly" data-fly="shapes"><div class="km-fly-h">Formes</div><div class="km-shapes">' +
      SHAPES.map(([s, n]) => '<button class="km-shp" data-shape="' + s + '" title="' + n + '"><svg viewBox="0 0 32 32">' + ICON_SHAPE[s] + '</svg></button>').join('') +
    '</div></div>' +
    '<div class="km-ui km-fly" data-fly="pen"><div class="km-fly-h">Stylo</div>' +
      '<div class="km-pen-modes"><button data-pm="pen" class="on"><span class="ms">draw</span>Stylo</button><button data-pm="hl"><span class="ms">ink_highlighter</span>Surligneur</button></div>' +
      '<div class="km-pen-c"></div>' +
      '<div class="km-pen-w">' + [2, 3, 5, 8].map(w => '<button data-pw="' + w + '" title="Épaisseur ' + w + '"><i style="width:' + (w + 3) + 'px;height:' + (w + 3) + 'px"></i></button>').join('') + '</div>' +
    '</div>' +
    '<div class="km-ui km-bar km-zoom">' +
      '<button class="km-ib" data-act="zout" title="Zoom arrière (−)" aria-label="Zoom arrière"><span class="ms">remove</span></button>' +
      '<button class="km-zpct" data-act="z100" title="Revenir à 100 %">100 %</button>' +
      '<button class="km-ib" data-act="zin" title="Zoom avant (+)" aria-label="Zoom avant"><span class="ms">add</span></button>' +
      '<span class="km-vsep"></span>' +
      '<button class="km-ib" data-act="fit" title="Tout afficher (Maj+1)" aria-label="Tout afficher"><span class="ms">fit_screen</span></button>' +
      '<button class="km-ib" data-act="mini" title="Mini-carte" aria-label="Mini-carte"><span class="ms">map</span></button>' +
    '</div>' +
    '<div class="km-ui km-mini" title="Clique pour te déplacer"></div>' +
    '<div class="km-ui km-stylepop"></div>' +
    '<div class="km-ui km-prbar"></div>' +
    '<button class="km-ui km-zenx" data-act="zen" title="Quitter le mode zen"><span class="ms">close_fullscreen</span>Afficher les outils</button>' +
    '<div class="km-ui km-ctx"></div>' +
    '<div class="km-ui km-pop"></div>' +
    '<div class="km-ui km-revbar"></div>' +
    '<div class="km-ui km-outline"></div>' +
    '<div class="km-ui km-hint"></div>' +
    '<div class="km-ui km-menu"></div>' +
    '<input type="file" class="km-file" accept="image/*" hidden>';
  scr.appendChild(app);
  const q = s => app.querySelector(s);
  E = {
    app, vp: q('.km-vp'), world: q('.km-world'), frames: q('.km-frames'), layer: q('.km-layer'),
    br: q('.km-g-br'), lines: q('.km-g-ln'), tmp: q('.km-tmp'), ink: q('.km-g-ink'), live: q('.km-live'),
    ov: q('.km-ov'), ctx: q('.km-ctx'), pop: q('.km-pop'), title: q('.km-title'), save: q('.km-save'),
    undo: q('[data-act="undo"]'), redo: q('[data-act="redo"]'), zpct: q('.km-zpct'), tools: q('.km-tools'),
    revbar: q('.km-revbar'), outline: q('.km-outline'), hint: q('.km-hint'), menu: q('.km-menu'),
    search: q('.km-search'), sinput: q('.km-search input'), scount: q('.km-search-n'), file: q('.km-file'),
    wall: q('.km-wall'), pat: q('.km-pat'), mini: q('.km-mini'), stylepop: q('.km-stylepop'), prbar: q('.km-prbar')
  };
  E.mini.addEventListener('pointerdown', miniDown);
  E.stylepop.addEventListener('input', styleInput);
  E.stylepop.addEventListener('change', styleInput);
  // Pointeur
  app.addEventListener('pointerdown', onDown);
  E.vp.addEventListener('pointermove', onHover);
  E.vp.addEventListener('wheel', onWheel, { passive: false });
  E.vp.addEventListener('dblclick', onDblClick);
  app.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea, [contenteditable]')) e.preventDefault(); });
  E.vp.addEventListener('gesturestart', e => { e.preventDefault(); inGesture = true; P = null; E.vp._gz = V.z; });
  E.vp.addEventListener('gesturechange', e => { e.preventDefault(); const r = E.vp.getBoundingClientRect(); zoomAt((E.vp._gz * e.scale) / V.z, e.clientX - r.left, e.clientY - r.top); });
  E.vp.addEventListener('gestureend', e => { e.preventDefault(); inGesture = false; });
  E.vp.addEventListener('dragover', e => { e.preventDefault(); });
  E.vp.addEventListener('drop', e => {
    e.preventDefault(); VPR = E.vp.getBoundingClientRect();
    const pt = toWorld(e.clientX, e.clientY), files = [...(e.dataTransfer.files || [])].filter(f => /^image\//.test(f.type));
    if (files.length) files.forEach((f, i) => addImageFile(f, { x: pt.x + i * 30, y: pt.y + i * 30 }));
    else { const tx = e.dataTransfer.getData('text/plain'); if (tx) pasteText(tx, pt); }
  });
  // Édition de texte
  const onInput = () => { if (EDIT) { DIRTY.add(EDIT.id); req(); } };
  E.layer.addEventListener('input', onInput); E.frames.addEventListener('input', onInput);
  const onFocusOut = e => { if (EDIT && e.target === EDIT.el && document.hasFocus()) setTimeout(() => { if (EDIT && document.activeElement !== EDIT.el) commitEdit(); }, 0); };
  E.layer.addEventListener('focusout', onFocusOut); E.frames.addEventListener('focusout', onFocusOut);
  if (!PLAIN) E.layer.addEventListener('paste', e => { if (EDIT) { e.preventDefault(); const tx = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, tx); } });
  // Barres d'outils
  app.addEventListener('click', onUiClick);
  E.ctx.addEventListener('pointerdown', e => e.preventDefault());
  E.sinput.addEventListener('input', () => runSearch(E.sinput.value));
  E.sinput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nextMatch(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); } });
  E.file.addEventListener('change', () => { [...E.file.files].forEach((f, i) => { const c = viewCenter(); addImageFile(f, { x: c.x + i * 30, y: c.y + i * 30 }); }); E.file.value = ''; });
  window.addEventListener('resize', () => { if (isActive()) req(); });
  renderPenFly();
}

function onUiClick(e) {
  if (e.target.closest('input, textarea')) return;
  const b = e.target.closest('button, .km-title, [data-ol-id], [data-mi]');
  if (!b || !E.app.contains(b)) return;
  if (b.tagName === 'BUTTON' && b.closest('.km-ui')) setTimeout(() => { if (document.activeElement === b) b.blur(); }, 0);
  if (b.closest('.km-ctx')) { ctxClick(b); return; }
  if (b.closest('.km-pop')) { popClick(b); return; }
  if (b.closest('.km-menu')) { menuClick(b); return; }
  if (b.closest('.km-outline')) { outlineClick(b); return; }
  if (b.closest('.km-revbar')) { revClick(b); return; }
  if (b.closest('.km-stylepop')) { styleClick(b); return; }
  if (b.closest('.km-prbar')) { const a = b.dataset.pr; if (a === 'next') presentGo(PR.i + 1); else if (a === 'prev') presentGo(PR.i - 1); else stopPresent(); return; }
  if (b.closest('.km-hint')) { E.hint.classList.remove('show'); try { localStorage.setItem(HINT_KEY, '1'); } catch (er) { /* rien */ } return; }
  if (b.dataset.shape) { opt.shape = b.dataset.shape; setTool('shape'); closeFloating(); E.app.querySelectorAll('.km-shp').forEach(x => x.classList.toggle('on', x.dataset.shape === opt.shape)); return; }
  if (b.dataset.pm) { opt.hl = b.dataset.pm === 'hl'; renderPenFly(); setTool('pen', true); return; }
  if (b.dataset.pc != null) { if (opt.hl) opt.hlC = +b.dataset.pc; else opt.penC = +b.dataset.pc; renderPenFly(); setTool('pen', true); return; }
  if (b.dataset.pw) { opt.penW = +b.dataset.pw; opt.hl = false; renderPenFly(); setTool('pen', true); return; }
  if (b.dataset.tool) {
    const fly = b.dataset.fly, wasOn = tool === b.dataset.tool;
    setTool(b.dataset.tool, true);
    if (fly) { const open = E.app.querySelector('.km-fly[data-fly="' + fly + '"]').classList.contains('show'); closeFloating(); if (!(wasOn && open)) openFly(fly, b); }
    return;
  }
  const act = b.dataset.act;
  switch (act) {
    case 'back': closeEditor(); break;
    case 'rename': renameInline(); break;
    case 'search': E.search.classList.contains('open') ? closeSearch() : openSearch(); break;
    case 'snext': nextMatch(1); break;
    case 'menu': openMenu(b); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'revise': REV ? endRevision() : startRevision(); break;
    case 'outline': E.outline.classList.toggle('open'); renderOutline(); break;
    case 'export': if (KM.exportPNG) KM.exportPNG(); break;
    case 'templates': if (KM.templatePicker) KM.templatePicker(tpl => KM.insertTree(JSON.parse(JSON.stringify(tpl.tree)))); break;
    case 'fromcourse': if (KM.coursePicker) KM.coursePicker(c => { const tr = KM.courseTree(c); if (tr) KM.insertTree(tr); }); break;
    case 'import': if (KM.pasteDialog) KM.pasteDialog(tree => KM.insertTree(tree)); break;
    case 'image': E.file.click(); break;
    case 'help': showHelp(); break;
    case 'zout': zoomBy(0.8); break;
    case 'zin': zoomBy(1.25); break;
    case 'z100': zoomTo(1); break;
    case 'fit': fit(true); break;
    case 'mini': MINI_ON = !MINI_ON; try { localStorage.setItem('kcu_maps_mini', MINI_ON ? '1' : '0'); } catch (er) { /* rien */ } b.classList.toggle('on', MINI_ON); drawMini(); break;
    case 'style': { const open = E.stylepop.classList.contains('show'); closeFloating(); if (!open) openStyle(b); break; }
    case 'present': PR ? stopPresent() : startPresent(); break;
    case 'zen': E.app.classList.toggle('km-zen'); closeFloating(); break;
  }
}
function setTool(t, fromUi) {
  if (REV || !E) return;
  commitEdit();
  if (P && P.mode === 'line2') P = null;
  tool = t;
  E.app.dataset.tool = t;
  E.tools.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  if (!fromUi) closeFloating();
  if (t !== 'select') { sel.clear(); onSel(); }
  render();
}
function openFly(name, btn) {
  const f = E.app.querySelector('.km-fly[data-fly="' + name + '"]'); if (!f) return;
  const r = btn.getBoundingClientRect(), ar = E.app.getBoundingClientRect();
  f.style.top = Math.max(8, Math.min(r.top - ar.top - 8, ar.height - 260)) + 'px';
  f.classList.add('show');
  if (name === 'shapes') E.app.querySelectorAll('.km-shp').forEach(x => x.classList.toggle('on', x.dataset.shape === opt.shape));
}
function renderPenFly() {
  if (!E) return;
  const pal = opt.hl ? HILITE : INK, cur = opt.hl ? opt.hlC : opt.penC;
  E.app.querySelector('.km-pen-c').innerHTML = pal.map((c, i) => '<button data-pc="' + i + '" class="km-sw' + (cur === i ? ' on' : '') + '" style="--sw:' + (c === 'auto' ? 'var(--km-text)' : c) + '" title="Couleur"></button>').join('');
  E.app.querySelectorAll('[data-pm]').forEach(b => b.classList.toggle('on', (b.dataset.pm === 'hl') === opt.hl));
  E.app.querySelectorAll('[data-pw]').forEach(b => b.classList.toggle('on', !opt.hl && +b.dataset.pw === opt.penW));
}
function closeFloating() {
  if (!E) return;
  E.app.querySelectorAll('.km-fly.show').forEach(f => f.classList.remove('show'));
  E.pop.classList.remove('show');
  E.menu.classList.remove('show');
  if (E.stylepop) E.stylepop.classList.remove('show');
}

/* Barre contextuelle */
function ctxHTML() {
  const items = [...sel].map(get).filter(Boolean);
  if (!items.length || REV) return '';
  const kinds = new Set(items.map(i => i.k)), k = kinds.size === 1 ? items[0].k : 'multi', one = items.length === 1 ? items[0] : null;
  const btn = (act, icon, title, v, on) => '<button class="km-cb' + (on ? ' on' : '') + '" data-cx="' + act + '"' + (v != null ? ' data-v="' + v + '"' : '') + ' title="' + title + '" aria-label="' + title + '"><span class="ms">' + icon + '</span></button>';
  const sep = '<span class="km-cs"></span>';
  const sw = (pal, cur, extra) => pal.map((c, i) => '<button class="km-sw' + (cur === i ? ' on' : '') + '" data-cx="color" data-v="' + i + '" style="--sw:' + (c === 'auto' ? 'var(--km-text)' : c) + '" title="Couleur"></button>').join('') + (extra || '');
  const fs = btn('fs', 'text_decrease', 'Texte plus petit', -1) + btn('fs', 'text_increase', 'Texte plus grand', 1);
  const del = btn('del', 'delete', 'Supprimer (Suppr)');
  let h = '';
  switch (k) {
    case 'node': {
      const n = items[0], g = G.get(n.id) || {};
      const hex = n.p ? colHex(g.col, BRANCH) : (n.c != null ? colHex(n.c, BRANCH) : themeInk());
      h += '<button class="km-cb km-cdot" data-cx="pop" data-v="ncolor" title="Couleur de la branche"><i style="--sw:' + (hex || '#888') + '"></i></button>';
      h += btn('pop', 'shape_line', 'Style de la bulle', 'nstyle') + fs + btn('bold', 'format_bold', 'Gras (Ctrl+B)', null, !!n.b);
      if (one) {
        h += sep + btn('child', 'add_circle', 'Ajouter une sous-idée (Tab)');
        if (n.p) h += btn('sibling', 'playlist_add', 'Ajouter une idée sœur (Entrée)');
        if (kids(n.id).length) h += btn('fold', n.fold ? 'unfold_more' : 'unfold_less', n.fold ? 'Déplier la branche' : 'Replier la branche');
        h += btn('note', 'sticky_note_2', n.note ? 'Modifier la note' : 'Ajouter une note', null, !!n.note);
        if (!n.p) h += btn('pop', 'account_tree', 'Disposition', 'layout');
        if (hasOffsets(n.id)) h += btn('tidy', 'auto_fix_high', 'Réaligner la carte');
      }
      h += sep + del;
      break;
    }
    case 'sticky': h += sw(STICKY, one ? (one.c || 0) : -1) + sep + fs + sep + btn('dup', 'content_copy', 'Dupliquer (Ctrl+D)') + del; break;
    case 'shape': h += btn('pop', 'category', 'Changer de forme', 'skind') + sw(FILL, one ? (one.c || 0) : -1) + sep + fs + sep + btn('dup', 'content_copy', 'Dupliquer (Ctrl+D)') + del; break;
    case 'text': h += sw(INK.slice(0, 7), one ? (one.c || 0) : -1) + sep + fs + btn('bold', 'format_bold', 'Gras', null, !!(one && one.b)) + sep + del; break;
    case 'line': {
      const l = items[0];
      h += btn('pop', 'conversion_path', 'Tracé', 'lstyle') + btn('ea', 'west', 'Flèche au départ', null, !!l.ea) + btn('eb', 'east', 'Flèche à l’arrivée', null, l.eb !== 0) +
        btn('dash', 'more_horiz', 'Pointillés', null, !!l.dash) + btn('lw', 'line_weight', 'Épaisseur') + sep + sw(INK.slice(0, 7), l.c == null ? -1 : l.c) + btn('label', 'label', 'Ajouter un libellé') + sep + del;
      break;
    }
    case 'ink': h += sw(items[0].hl ? HILITE : INK.slice(0, 7), one ? (one.c || 0) : -1) + sep + del; break;
    case 'frame': h += Array.from({ length: 7 }, (_, i) => '<button class="km-sw fsw fc-' + i + (one && (one.c || 0) === i ? ' on' : '') + '" data-cx="color" data-v="' + i + '" title="Fond du cadre"></button>').join('') + sep + del; break;
    case 'img': h += btn('front', 'flip_to_front', 'Premier plan') + btn('back', 'flip_to_back', 'Arrière-plan') + sep + btn('dup', 'content_copy', 'Dupliquer (Ctrl+D)') + del; break;
    default: h += '<span class="km-cn">' + items.length + ' éléments</span>' + sep + btn('dup', 'content_copy', 'Dupliquer (Ctrl+D)') + btn('front', 'flip_to_front', 'Premier plan') + del;
  }
  return h;
}
function positionCtx() {
  const c = E.ctx;
  const busy = P && ((P.mode === 'move' && P.moved) || P.mode === 'pan' || P.mode === 'pinch' || P.mode === 'marq' || P.mode === 'resize' || P.mode === 'lend' || P.mode === 'ink');
  if (!sel.size || REV || busy) { c.classList.remove('show'); if (busy) E.pop.classList.remove('show'); return; }
  const sig = [...sel].map(id => { const it = get(id); return it ? [id, it.c, it.s, it.fs, it.b, it.fold, it.note ? 1 : 0, it.st, it.ea, it.eb, it.dash, it.w, it.lay, it.hl, kids(id).length > 0, it.p || '', (G.get(id) || {}).col, hasOffsetsSafe(it)].join(':') : ''; }).join(',');
  if (sig !== ctxSig) { ctxSig = sig; c.innerHTML = ctxHTML(); E.pop.classList.remove('show'); }
  const b = selBox(); if (!b || !c.innerHTML) { c.classList.remove('show'); return; }
  c.classList.add('show');
  const r = toScr(b), W = E.app.clientWidth, Hh = E.app.clientHeight, cw = c.offsetWidth, ch = c.offsetHeight;
  let x = r.x + r.w / 2 - cw / 2, y = r.y - ch - 18;
  if (y < 64) y = r.y + r.h + 18;
  const minX = W > 760 ? 66 : 8;
  x = clamp(x, minX, Math.max(minX, W - cw - 8)); y = clamp(y, 8, Math.max(8, Hh - ch - 8));
  c.style.left = Math.round(x) + 'px'; c.style.top = Math.round(y) + 'px';
}
function hasOffsetsSafe(it) { return it && it.k === 'node' ? (hasOffsets(it.id) ? 1 : 0) : 0; }
function ctxClick(b) {
  const a = b.dataset.cx, v = b.dataset.v;
  if (a === 'pop') { openPop(v, b); return; }
  if (a === 'color') { applyColor(v); return; }
  ctxAction(a, v);
}
function ctxAction(a, v) {
  const items = [...sel].map(get).filter(Boolean), one = items.length === 1 ? items[0] : null;
  if (!items.length) return;
  switch (a) {
    case 'fs':
      for (const it of items) {
        if (it.k === 'line' || it.k === 'ink' || it.k === 'img' || it.k === 'frame') continue;
        const d = it.k === 'node' ? depth(it.id) : 0, cur = it.fs || defFs(it, d);
        it.fs = clamp(cur + (+v) * (cur >= 24 ? 4 : 2), 9, 72);
      }
      break;
    case 'bold': for (const it of items) if (it.k === 'node' || it.k === 'text') { if (it.b) delete it.b; else it.b = 1; } break;
    case 'child': if (one) { addChild(one.id); return; } break;
    case 'sibling': if (one) { addSibling(one.id); return; } break;
    case 'fold': if (one) { toggleFold(one.id); return; } break;
    case 'note': if (one) { editNote(one.id); return; } break;
    case 'tidy': if (one) { tidy(one.id); return; } break;
    case 'del': deleteSel(); return;
    case 'dup': duplicate(); return;
    case 'front': bringFront(false); return;
    case 'back': bringFront(true); return;
    case 'ea': for (const it of items) if (it.k === 'line') { if (it.ea) delete it.ea; else it.ea = 1; } break;
    case 'eb': for (const it of items) if (it.k === 'line') it.eb = it.eb === 0 ? 1 : 0; break;
    case 'dash': for (const it of items) if (it.k === 'line') { if (it.dash) delete it.dash; else it.dash = 1; } break;
    case 'lw': for (const it of items) if (it.k === 'line') { const ws = [1.5, 2, 3, 5], i = ws.indexOf(it.w || 2); it.w = ws[(i + 1) % ws.length]; } break;
    case 'label': if (one) { startEdit(one.id, { selectAll: true }); return; } break;
  }
  ctxSig = ''; commit(); render();
}
function openPop(kind, btn) {
  const p = E.pop, items = [...sel].map(get).filter(Boolean), one = items[0];
  if (p.classList.contains('show') && p.dataset.kind === kind) { p.classList.remove('show'); return; }
  let h = '';
  if (kind === 'ncolor') {
    h = '<div class="km-pop-h">Couleur</div><div class="km-pop-sw">' + BRANCH.map((c, i) => '<button class="km-sw" data-pv="c" data-v="' + i + '" style="--sw:' + c + '"></button>').join('') + '</div><button class="km-pop-i" data-pv="c" data-v="auto"><span class="ms">format_color_reset</span>Couleur automatique</button>';
  } else if (kind === 'nstyle') {
    h = '<div class="km-pop-h">Style de la bulle</div>' + [['box', 'Boîte', 'crop_square'], ['pill', 'Pilule', 'rounded_corner'], ['line', 'Souligné', 'format_underlined'], ['plain', 'Texte seul', 'text_fields']].map(([s, n, ic]) => '<button class="km-pop-i' + (one && one.s === s ? ' on' : '') + '" data-pv="s" data-v="' + s + '"><span class="ms">' + ic + '</span>' + n + '</button>').join('') + '<button class="km-pop-i" data-pv="s" data-v="auto"><span class="ms">auto_mode</span>Automatique</button>';
  } else if (kind === 'layout') {
    h = '<div class="km-pop-h">Disposition</div>' + [['map', 'Carte (des deux côtés)', 'hub'], ['right', 'Arbre vers la droite', 'format_indent_increase'], ['down', 'Organigramme', 'account_tree']].map(([s, n, ic]) => '<button class="km-pop-i' + (((one && one.lay) || 'map') === s ? ' on' : '') + '" data-pv="lay" data-v="' + s + '"><span class="ms">' + ic + '</span>' + n + '</button>').join('');
  } else if (kind === 'skind') {
    h = '<div class="km-pop-h">Forme</div><div class="km-shapes">' + SHAPES.map(([s, n]) => '<button class="km-shp' + (one && (one.s || 'rect') === s ? ' on' : '') + '" data-pv="sk" data-v="' + s + '" title="' + n + '"><svg viewBox="0 0 32 32">' + ICON_SHAPE[s] + '</svg></button>').join('') + '</div>';
  } else if (kind === 'lstyle') {
    h = '<div class="km-pop-h">Tracé</div>' + [['curve', 'Courbe', 'gesture'], ['straight', 'Droit', 'horizontal_rule'], ['elbow', 'Coudé', 'turn_right']].map(([s, n, ic]) => '<button class="km-pop-i' + ((one && (one.st || 'curve')) === s ? ' on' : '') + '" data-pv="st" data-v="' + s + '"><span class="ms">' + ic + '</span>' + n + '</button>').join('');
  }
  p.innerHTML = h; p.dataset.kind = kind;
  p.classList.add('show');
  const r = btn.getBoundingClientRect(), ar = E.app.getBoundingClientRect();
  const x = clamp(r.left - ar.left + r.width / 2 - p.offsetWidth / 2, 8, ar.width - p.offsetWidth - 8);
  let y = r.bottom - ar.top + 8; if (y + p.offsetHeight > ar.height - 8) y = r.top - ar.top - p.offsetHeight - 8;
  p.style.left = Math.round(x) + 'px'; p.style.top = Math.round(y) + 'px';
}
function popClick(b) {
  const k = b.dataset.pv, v = b.dataset.v; if (!k) return;
  const items = [...sel].map(get).filter(Boolean);
  for (const it of items) {
    if (k === 'c' && it.k === 'node') { if (v === 'auto') delete it.c; else it.c = +v; }
    else if (k === 's' && it.k === 'node') { if (v === 'auto') delete it.s; else it.s = v; }
    else if (k === 'lay' && it.k === 'node' && !it.p) { it.lay = v; computeTree(); kids(it.id).forEach(c => { if (v !== 'map') delete c.side; }); if (v === 'map') kids(it.id).forEach((c, i, a) => { c.side = i < Math.ceil(a.length / 2) ? 'r' : 'l'; }); subtreeIds(it.id).forEach(x => { const n = get(x); delete n.dx; delete n.dy; }); }
    else if (k === 'sk' && it.k === 'shape') it.s = v;
    else if (k === 'st' && it.k === 'line') it.st = v;
  }
  E.pop.classList.remove('show');
  ctxSig = ''; markAllDirty(); commit(); render();
}

/* Menu principal */
function openMenu(btn) {
  const m = E.menu;
  if (m.classList.contains('show')) { m.classList.remove('show'); return; }
  const it = (k, ic, label, kb) => '<button data-mi="' + k + '"><span class="ms">' + ic + '</span><span>' + label + '</span>' + (kb ? '<kbd>' + kb + '</kbd>' : '') + '</button>';
  m.innerHTML = it('new', 'add', 'Nouvelle carte') + it('list', 'grid_view', 'Toutes mes cartes') + '<hr>' +
    it('rename', 'edit', 'Renommer') + it('dupb', 'content_copy', 'Dupliquer la carte') + '<hr>' +
    it('tpl', 'auto_awesome_mosaic', 'Insérer un modèle kiné') + it('course', 'school', 'Insérer depuis un cours') + it('import', 'playlist_add', 'Importer un plan (texte)') + '<hr>' +
    it('png', 'image', 'Exporter en image (PNG)') + it('md', 'description', 'Télécharger le plan (Markdown)') + it('copy', 'content_paste_go', 'Copier le plan (texte)') + it('present', 'slideshow', 'Présenter la carte') + it('style', 'palette', 'Fond d’écran et couleurs') + it('tidy', 'auto_fix_high', 'Réaligner toutes les cartes') + it('fit', 'fit_screen', 'Tout afficher', 'Maj 1') + '<hr>' +
    it('help', 'keyboard', 'Raccourcis clavier', '?') + it('delete', 'delete', 'Supprimer la carte');
  m.classList.add('show');
  const r = btn.getBoundingClientRect(), ar = E.app.getBoundingClientRect();
  m.style.left = Math.max(8, r.left - ar.left - 8) + 'px'; m.style.top = (r.bottom - ar.top + 10) + 'px';
}
function menuClick(b) {
  const k = b.dataset.mi; E.menu.classList.remove('show');
  switch (k) {
    case 'new': { saveNow(); const id = KM.newBoard(); if (id) openBoard(id, { editRoot: true }); break; }
    case 'list': closeEditor(); break;
    case 'rename': renameInline(); break;
    case 'dupb': { saveNow(); const id = duplicateBoard(B.id); if (id) { openBoard(id); toast('Carte dupliquée'); } break; }
    case 'tpl': onUiClick({ target: E.app.querySelector('[data-act="templates"]') }); break;
    case 'course': onUiClick({ target: E.app.querySelector('[data-act="fromcourse"]') }); break;
    case 'import': onUiClick({ target: E.app.querySelector('[data-act="import"]') }); break;
    case 'png': if (KM.exportPNG) KM.exportPNG(); break;
    case 'copy': copyOutline(); break;
    case 'md': exportMd(); break;
    case 'present': startPresent(); break;
    case 'style': openStyle(E.app.querySelector('[data-act="style"]')); break;
    case 'tidy': tidy(null); break;
    case 'fit': fit(true); break;
    case 'help': showHelp(); break;
    case 'delete': {
      const id = B.id, name = B.name;
      const doDel = () => { deleteBoard(id); B = null; showScreen('mindmap'); toast('Carte « ' + name + ' » supprimée'); };
      if (typeof showConfirm === 'function') showConfirm('Supprimer cette carte ?', '« ' + name + ' » sera définitivement supprimée.', 'Supprimer', doDel);
      else if (confirm('Supprimer « ' + name + ' » ?')) doDel();
      break;
    }
  }
}
function copyOutline() {
  const txt = typeof KM.outlineText === 'function' ? KM.outlineText() : B.items.filter(i => i.k === 'node' && !i.p).map(r => outlineOf(r.id, 0)).join('\n\n');
  if (!txt.trim()) { toast('Aucune carte mentale à copier.', 'error'); return; }
  const done = () => toast('Plan copié : colle-le dans tes notes');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
  else fallbackCopy(txt, done);
}
function fallbackCopy(txt, done) {
  const ta = el('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Copie impossible', 'error'); }
  ta.remove();
}
function renameInline() {
  if (!B) return;
  const t = E.title, old = B.name;
  t.innerHTML = '<input class="km-title-in" maxlength="80">';
  const inp = t.firstChild; inp.value = old; inp.focus(); inp.select();
  let done = false;
  const finish = ok => { if (done) return; done = true; const v = ok ? inp.value.trim() : ''; B.name = v || old; t.textContent = B.name; const m = metaOf(B.id); if (m) { m.name = B.name; saveIndex(); } };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
  inp.addEventListener('blur', () => finish(true));
}

/* Menu clic droit */
function ctxMenu(e) {
  VPR = E.vp.getBoundingClientRect();
  const pt = toWorld(e.clientX, e.clientY), id = hitTest(pt, e.target);
  if (id && !sel.has(id)) { sel = new Set([id]); onSel(); render(); }
  if (!id && sel.size) { sel.clear(); onSel(); render(); }
  const it = id ? get(id) : null;
  const row = (k, ic, label, kb) => '<button data-cm="' + k + '"><span class="ms">' + ic + '</span><span>' + label + '</span>' + (kb ? '<kbd>' + kb + '</kbd>' : '') + '</button>';
  let h = '';
  if (it) {
    if (hasText(it)) h += row('edit', 'edit', it.k === 'line' ? 'Libellé' : 'Modifier le texte', 'F2');
    if (it.k === 'node') { h += row('child', 'add_circle', 'Ajouter une sous-idée', 'Tab'); if (kids(it.id).length) h += row('fold', it.fold ? 'unfold_more' : 'unfold_less', it.fold ? 'Déplier' : 'Replier'); h += row('note', 'sticky_note_2', it.note ? 'Modifier la note' : 'Ajouter une note'); }
    h += '<hr>' + row('copy', 'content_copy', 'Copier', 'Ctrl C') + row('dup', 'library_add', 'Dupliquer', 'Ctrl D');
    if (it.k !== 'node') h += row('front', 'flip_to_front', 'Premier plan') + row('back', 'flip_to_back', 'Arrière-plan');
    h += '<hr>' + row('del', 'delete', 'Supprimer', 'Suppr');
  } else {
    if (CLIP) h += row('paste', 'content_paste', 'Coller', 'Ctrl V');
    h += row('root', 'account_tree', 'Nouvelle carte mentale ici') + row('sticky', 'sticky_note_2', 'Post-it ici') + '<hr>' + row('all', 'select_all', 'Tout sélectionner', 'Ctrl A') + row('fit', 'fit_screen', 'Tout afficher', 'Maj 1');
  }
  const m = E.menu;
  m.innerHTML = h; m.classList.add('show');
  const ar = E.app.getBoundingClientRect();
  m.style.left = Math.min(e.clientX - ar.left, ar.width - m.offsetWidth - 8) + 'px';
  m.style.top = Math.min(e.clientY - ar.top, ar.height - m.offsetHeight - 8) + 'px';
  m.onclick = ev => {
    const b = ev.target.closest('[data-cm]'); if (!b) return;
    ev.stopPropagation(); m.classList.remove('show'); m.onclick = null;
    switch (b.dataset.cm) {
      case 'edit': startEdit(id, { selectAll: true }); break;
      case 'child': addChild(id); break;
      case 'fold': toggleFold(id); break;
      case 'note': editNote(id); break;
      case 'copy': { const d = copySel(); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.text).catch(() => {}); toast('Copié'); break; }
      case 'dup': duplicate(); break;
      case 'front': bringFront(false); break;
      case 'back': bringFront(true); break;
      case 'del': deleteSel(); break;
      case 'paste': if (CLIP) pasteItems(CLIP.items, pt); break;
      case 'root': createRootAt(pt); break;
      case 'sticky': { const s = addItem({ id: uid(), k: 'sticky', x: r1(pt.x - 100), y: r1(pt.y - 100), w: 200, h: 200, t: '', c: opt.stickyC }); sel = new Set([s.id]); onSel(); startEdit(s.id, { isNew: true }); break; }
      case 'all': selectAll(); break;
      case 'fit': fit(true); break;
    }
  };
}
function menuClickGuard(e) { if (E && E.menu.classList.contains('show') && !e.target.closest('.km-menu') && !e.target.closest('[data-act="menu"]')) { E.menu.classList.remove('show'); E.menu.onclick = null; } }

/* Plan (panneau) */
function renderOutline() {
  if (!E || !E.outline.classList.contains('open')) return;
  computeTree();
  const roots = B.items.filter(i => i.k === 'node' && !i.p);
  const rec = n => {
    const g = G.get(n.id), col = n.p ? (colHex(g && g.col, BRANCH) || '#888') : 'var(--km-text)';
    const ks = kids(n.id);
    return '<li><a data-ol-id="' + n.id + '" style="--c:' + col + '"' + (sel.has(n.id) ? ' class="on"' : '') + '><i></i><span>' + esc(n.t || 'Sans titre') + '</span>' + (n.note ? '<span class="ms">sticky_note_2</span>' : '') + '</a>' + (ks.length ? '<ul>' + ks.map(rec).join('') + '</ul>' : '') + '</li>';
  };
  E.outline.innerHTML = '<div class="km-ol-h"><b>Plan de la carte</b><button class="km-ib sm" data-ol="copy" title="Copier le plan"><span class="ms">content_copy</span></button><button class="km-ib sm" data-ol="close" title="Fermer"><span class="ms">close</span></button></div>' +
    '<div class="km-ol-b">' + (roots.length ? roots.map(r => '<ul class="km-ol-tree">' + rec(r) + '</ul>').join('') : '<p class="km-ol-empty">Aucune carte mentale sur ce tableau pour l’instant.<br>Double-clique sur le fond pour en créer une.</p>') + '</div>';
}
function outlineClick(b) {
  if (b.dataset.ol === 'close') { E.outline.classList.remove('open'); return; }
  if (b.dataset.ol === 'copy') { copyOutline(); return; }
  const id = b.dataset.olId;
  if (id && get(id)) { unfoldTo(id); sel = new Set([id]); onSel(); centerOn(id); renderOutline(); }
}
function unfoldTo(id) { let n = get(id), ch = false; while (n && n.p) { const p = get(n.p); if (p && p.fold) { delete p.fold; ch = true; } n = p; } if (ch) { commit(); render(); } }

/* Recherche */
function openSearch() { E.search.classList.add('open'); E.sinput.focus(); E.sinput.select(); if (E.sinput.value) runSearch(E.sinput.value); }
function closeSearch() { if (!E) return; E.search.classList.remove('open'); E.sinput.value = ''; matches = []; matchI = -1; E.scount.textContent = ''; req(); }
function runSearch(q, keep) {
  const nq = norm(q.trim());
  matches = nq ? B.items.filter(it => it.t && norm(it.t).includes(nq)).map(it => it.id) : [];
  if (!keep) matchI = -1;
  E.scount.textContent = nq ? (matches.length ? (matchI >= 0 ? (matchI + 1) + '/' : '') + matches.length : '0') : '';
  req();
}
function nextMatch(d) {
  if (!matches.length) return;
  matchI = (matchI + d + matches.length) % matches.length;
  const id = matches[matchI];
  unfoldTo(id); sel = new Set([id]); onSel(); centerOn(id);
  E.scount.textContent = (matchI + 1) + '/' + matches.length;
}

/* Aide & astuce */
function showHelp() {
  const rows = [
    ['Tab', 'Ajouter une sous-idée'], ['Entrée', 'Ajouter une idée sœur'], ['Taper du texte', 'Remplacer le texte de l’élément sélectionné'], ['Double-clic', 'Modifier un texte · sur le fond : nouvelle carte'],
    ['Maj + Entrée', 'Retour à la ligne pendant l’écriture'], ['Flèches', 'Passer d’une idée à l’autre'], ['Glisser une idée sur une autre', 'La rattacher (haut/bas : la placer avant/après)'],
    ['Espace + glisser · clic droit + glisser', 'Se déplacer'], ['Ctrl + molette · pincer', 'Zoomer'], ['Maj + 1', 'Tout afficher'],
    ['Ctrl Z · Ctrl Maj Z', 'Annuler · rétablir'], ['Ctrl C · Ctrl V · Ctrl D', 'Copier · coller · dupliquer'], ['Coller un plan sur une idée', 'Crée toutes les sous-idées d’un coup'],
    ['V H M T N R L F P E', 'Sélection, main, carte, texte, post-it, forme, connecteur, cadre, stylo, gomme'], ['Ctrl F', 'Rechercher'], ['Suppr', 'Supprimer'],
    ['Présentation : → ← Espace', 'Branche suivante / précédente · Échap pour quitter']
  ];
  dialog({ title: 'Raccourcis clavier', wide: true, html: '<div class="km-keys">' + rows.map(([k, d]) => '<div><kbd>' + esc(k) + '</kbd><span>' + esc(d) + '</span></div>').join('') + '</div>' });
}
function showHint() {
  if (!E) return;
  let seen = false; try { seen = !!localStorage.getItem(HINT_KEY); } catch (e) { /* rien */ }
  if (seen) { E.hint.classList.remove('show'); return; }
  E.hint.innerHTML = '<span class="ms">lightbulb</span><span><b>Tab</b> ajoute une sous-idée · <b>Entrée</b> une idée sœur · <b>double-clic</b> sur le fond crée une nouvelle carte · <b>Espace + glisser</b> pour se déplacer</span><button class="km-ib sm" title="Compris"><span class="ms">close</span></button>';
  E.hint.classList.add('show');
}

/* Fenêtres */
function dialog(o) {
  const wrap = el('div', 'km-dlg');
  wrap.innerHTML = '<div class="km-dlg-card' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="km-dlg-h"><b>' + esc(o.title || '') + '</b><button class="km-dlg-x" data-dlg="x" aria-label="Fermer"><span class="ms">close</span></button></div><div class="km-dlg-body">' + (o.html || '') + '</div>' + (o.foot ? '<div class="km-dlg-f">' + o.foot + '</div>' : '') + '</div>';
  document.body.appendChild(wrap);
  let closed = false;
  const close = () => { if (closed) return; closed = true; wrap.remove(); if (o.onClose) o.onClose(); };
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-dlg="x"]')) close(); });
  wrap.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } e.stopPropagation(); });
  requestAnimationFrame(() => wrap.classList.add('show'));
  if (o.onMount) o.onMount(wrap, close);
  return { el: wrap, close };
}
KM.dialog = dialog;

/* ───────────────────────── Mode révision ───────────────────────── */
function startRevision() {
  commitEdit(); P = null;
  const nodes = B.items.filter(i => i.k === 'node' && i.p);
  if (!nodes.length) { toast('Ajoute d’abord des idées à ta carte pour pouvoir la réviser.', 'error'); return; }
  REV = { shown: new Set(), ok: new Set(), ko: new Set(), last: null, folds: B.items.filter(i => i.fold).map(i => i.id), xp: 0 };
  REV.folds.forEach(id => { delete get(id).fold; });
  sel.clear(); onSel(); closeFloating();
  E.app.classList.add('km-rev-on');
  E.app.querySelector('.km-revbtn span:last-child').textContent = 'Terminer';
  renderRevBar(); render(); fit(true);
}
function stopRevision() {
  if (!REV) return;
  REV.folds.forEach(id => { const n = get(id); if (n) n.fold = true; });
  REV = null;
  E.app.classList.remove('km-rev-on');
  E.app.querySelector('.km-revbtn span:last-child').textContent = 'Réviser';
  renderRevBar(); render();
}
const isMasked = id => !!(REV && get(id) && get(id).p && !REV.shown.has(id));
const revTotal = () => B.items.filter(i => i.k === 'node' && i.p).length;
function reveal(id) { REV.shown.add(id); REV.last = id; renderRevBar(); maybeRevEnd(); }
function revealLevel() {
  let min = Infinity;
  for (const it of B.items) if (isMasked(it.id)) min = Math.min(min, depth(it.id));
  if (min === Infinity) return;
  for (const it of B.items) if (isMasked(it.id) && depth(it.id) === min) REV.shown.add(it.id);
  REV.last = null; renderRevBar(); render(); maybeRevEnd();
}
function maybeRevEnd() {
  if (!REV || REV.ended || REV.shown.size < revTotal() || REV.last) return;
  REV.ended = true;
  setTimeout(revSummary, 350);
}
function renderRevBar() {
  if (!E) return;
  if (!REV) { E.revbar.classList.remove('show'); E.revbar.innerHTML = ''; return; }
  const tot = revTotal(), n = REV.shown.size;
  E.revbar.innerHTML = '<span class="km-rv-t"><span class="ms">school</span>Révision</span><span class="km-rv-p"><i style="width:' + (tot ? Math.round(n / tot * 100) : 0) + '%"></i></span><span class="km-rv-n">' + n + ' / ' + tot + '</span>' +
    '<span class="km-rv-s"><b class="ok">✓ ' + REV.ok.size + '</b><b class="ko">✗ ' + REV.ko.size + '</b></span>' +
    '<button data-rvb="level"><span class="ms">keyboard_double_arrow_down</span>Niveau suivant</button><button data-rvb="all">Tout révéler</button><button data-rvb="restart" title="Recommencer"><span class="ms">restart_alt</span></button><button data-rvb="stop" class="pri">Terminer</button>' +
    '<span class="km-rv-help">Clique sur une bulle pour la révéler, puis dis si tu la savais.</span>';
  E.revbar.classList.add('show');
}
function revClick(b) {
  switch (b.dataset.rvb) {
    case 'level': revealLevel(); break;
    case 'all': B.items.forEach(i => { if (i.k === 'node' && i.p) REV.shown.add(i.id); }); REV.last = null; renderRevBar(); render(); maybeRevEnd(); break;
    case 'restart': REV.shown.clear(); REV.ok.clear(); REV.ko.clear(); REV.last = null; REV.ended = false; renderRevBar(); render(); break;
    case 'stop': endRevision(); break;
  }
}
function endRevision() {
  if (!REV) return;
  if (!REV.ended && (REV.ok.size || REV.ko.size)) { REV.ended = true; REV.last = null; render(); revSummary(); }
  else stopRevision();
}
function revXP(ok) {
  if (typeof gamAward !== 'function' || ok <= 0) return 0;
  const day = new Date().toISOString().slice(0, 10), st = readJSON(XP_KEY, {}) || {};
  if (st.day !== day) { st.day = day; st.b = {}; }
  st.b = st.b || {};
  const done = st.b[B.id] || 0, xp = Math.min(Math.ceil(ok / 2), 15 - done);
  if (xp <= 0) return 0;
  st.b[B.id] = done + xp; writeJSON(XP_KEY, st);
  try { gamAward(xp, 'bonus', null, {}); } catch (e) { return 0; }
  return xp;
}
function revSummary() {
  if (!REV) return;
  const tot = revTotal(), ok = REV.ok.size, ko = REV.ko.size, rated = ok + ko;
  const xp = REV.xp ? 0 : revXP(ok); REV.xp = REV.xp || xp || -1;
  const pct = rated ? Math.round(ok / rated * 100) : 0;
  dialog({
    title: 'Révision terminée',
    html: '<div class="km-rv-sum"><div class="km-rv-ring" style="--p:' + pct + '"><b>' + (rated ? pct + '%' : '—') + '</b></div><div><p><b>' + ok + '</b> idée' + (ok > 1 ? 's' : '') + ' retrouvée' + (ok > 1 ? 's' : '') + ', <b>' + ko + '</b> à revoir' + (tot - rated > 0 ? ', ' + (tot - rated) + ' non notée' + (tot - rated > 1 ? 's' : '') : '') + '.</p>' + (xp > 0 ? '<p class="km-rv-xp">+' + xp + ' XP</p>' : '') + '</div></div>',
    foot: (ko ? '<button class="km-b2" data-k="ko">Revoir les ✗ (' + ko + ')</button>' : '') + '<button class="km-b2" data-k="again">Recommencer</button><button class="km-b2 pri" data-k="end">Terminer</button>',
    onMount(w, close) {
      w.addEventListener('click', e => {
        const b = e.target.closest('[data-k]'); if (!b || !REV) return;
        if (b.dataset.k === 'ko') { REV.ko.forEach(id => REV.shown.delete(id)); REV.ko.clear(); REV.ended = false; REV.last = null; renderRevBar(); render(); }
        else if (b.dataset.k === 'again') { REV.shown.clear(); REV.ok.clear(); REV.ko.clear(); REV.ended = false; REV.last = null; renderRevBar(); render(); }
        else stopRevision();
        close();
      });
    }
  });
}

/* ───────────────────────── Ouverture / fermeture ───────────────────────── */
function sanitize(a) {
  if (!Array.isArray(a)) return [];
  const out = [], ids = new Set();
  for (const it of a) {
    if (!it || typeof it !== 'object' || !it.k) continue;
    if (!it.id || ids.has(it.id)) it.id = uid();
    ids.add(it.id);
    if (it.k === 'ink' && (!Array.isArray(it.pts) || it.pts.length < 2)) continue;
    if (it.k === 'line' && (!it.a || !it.b)) continue;
    if ((it.k === 'sticky' || it.k === 'shape' || it.k === 'frame' || it.k === 'img') && !(it.w > 0 && it.h > 0)) { it.w = it.w > 0 ? it.w : 200; it.h = it.h > 0 ? it.h : 160; }
    out.push(it);
  }
  return out;
}
function clearDom() {
  IEL.forEach(e => e.remove()); IEL.clear();
  INKEL.forEach(e => e.remove()); INKEL.clear();
  LNEL.forEach(e => e.remove()); LNEL.clear();
  BREL.forEach(e => e.remove()); BREL.clear();
}
function openBoard(id, o) {
  o = o || {};
  const meta = metaOf(id);
  if (!meta) { toast('Carte introuvable.', 'error'); return; }
  if (B && B.id !== id) { commitEdit(); saveNow(); }
  const data = readJSON(MAP_PREFIX + id, null) || { items: [] };
  if (typeof showScreen === 'function') showScreen('mindmap-editor');
  ensureEditor();
  if (!E) return;
  B = { id, name: meta.name || 'Carte', items: sanitize(data.items), bg: data.bg || null, theme: data.theme || 'arc' };
  if (PR) stopPresent(true);
  E.app.classList.remove('km-zen');
  applyTheme(); applyBg(true);
  rebuild(); clearDom();
  sel = new Set(); SZ.clear(); G.clear(); DIRTY.clear(); LG.clear();
  REV = null; P = null; EDIT = null; dataDirty = false; matches = []; matchI = -1;
  E.app.classList.remove('km-rev-on', 'km-has-sel');
  E.app.querySelector('.km-revbtn span:last-child').textContent = 'Réviser';
  renderRevBar(); closeFloating(); closeSearch();
  E.outline.classList.remove('open');
  E.title.textContent = B.name;
  resetHistory(); setSave('ok'); setTool('select');
  render();
  const v = meta.view || data.view;
  if (v && isFinite(v.x) && isFinite(v.y) && isFinite(v.z)) setView(v); else fit(false);
  render();
  if (!meta.th && B.items.length && typeof KM.thumb === 'function') { try { meta.th = KM.thumb(); saveIndex(); } catch (e) { /* rien */ } }
  if (o.editRoot) { const r = B.items.find(i => i.k === 'node' && !i.p); if (r) startEdit(r.id, { selectAll: true }); }
  showHint();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (B && B.id === id) { markAllDirty(); render(); } });
}
KM.openBoard = openBoard;
function closeEditor() {
  if (REV) stopRevision();
  commitEdit(); saveNow();
  closeFloating();
  if (typeof showScreen === 'function') showScreen('mindmap');
}
KM.newBoard = function (name) {
  const items = [{ id: uid(), k: 'node', p: null, x: 0, y: 0, t: 'Sujet central', lay: 'map' }];
  return KM.createBoard(name || 'Nouvelle carte', items);
};
KM.state = () => ({ B, G, V, LG, sel, kids, depth, IEL, BRANCHES, BRSTROKES, BRSEG, contentBox, itemBox, inkD, inkBB, layOf, styleOf });

/* ───────────────────────── Accueil (liste des cartes) ───────────────────────── */
/* Accueil des cartes mentales — v5 (16 nov. 2026) : création en tuiles, modèles avec aperçu, recherche, tri, favoris, grille / liste */
const HUBK = 'kcu_maps_hub';
let hubQ = '';
function hubPrefs() { const d = readJSON(HUBK, {}) || {}; let fd = d.d || ''; if (fd && fd !== '__none' && !mfolders().some(f => f.id === fd)) fd = ''; return { f: d.f || 'all', s: d.s || 'recent', v: d.v || 'grid', d: fd }; }
/* v73 (18 nov. 2026) : dossiers de cartes (kcu_maps_folders = [{id, name}], carte → meta.folder) + sélection multiple
   (ranger dans un dossier, supprimer). Glisser une carte (ou la sélection) sur un dossier la range aussi. */
const FOLK = 'kcu_maps_folders';
function mfolders() { const a = readJSON(FOLK, []); return Array.isArray(a) ? a.filter(f => f && f.id) : []; }
function saveMFolders(a) { writeJSON(FOLK, a); }
function folderOfMap(m) { return m && m.folder && mfolders().some(f => f.id === m.folder) ? m.folder : ''; }
let SELMODE = false, LASTSEL = null;
const SEL = new Set();
function setHubPref(k, v) { const d = hubPrefs(); d[k] = v; writeJSON(HUBK, d); }
function courseName(id) { try { const c = id && typeof courses !== 'undefined' ? courses.find(x => x.id === id) : null; return c ? c.name : ''; } catch (e) { return ''; } }
function tplPreview(t) {
  const kids0 = ((t.tree && t.tree.kids) || []).slice(0, 6), n = kids0.length || 1, W = 200, H = 96, cx = 100, cy = 48;
  let g = '';
  kids0.forEach((k, i) => {
    const left = i % 2 === 1, row = Math.floor(i / 2), rows = Math.ceil(n / 2);
    const y = 14 + (rows === 1 ? 34 : row * (68 / Math.max(1, rows - 1)));
    const x = left ? 22 : 178, c = BRANCH0[i % BRANCH0.length];
    g += '<path d="M' + cx + ' ' + cy + ' C' + (cx + (left ? -40 : 40)) + ' ' + cy + ' ' + (x + (left ? 30 : -30)) + ' ' + y + ' ' + (x + (left ? 18 : -18)) + ' ' + y + '" fill="none" stroke="' + c + '" stroke-width="2.6" stroke-linecap="round"/>';
    g += '<rect x="' + (left ? x - 18 : x - 18) + '" y="' + (y - 6) + '" width="36" height="12" rx="4" fill="' + c + '" opacity=".22" stroke="' + c + '" stroke-width="1.2"/>';
  });
  g += '<rect x="' + (cx - 30) + '" y="' + (cy - 11) + '" width="60" height="22" rx="7" fill="' + (t.color || '#2563eb') + '"/>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + g + '</svg>';
}
const BRANCH0 = BRANCH.slice();
function cardHTML(m, list) {
  const n = m.n || 0, cn = courseName(m.courseId);
  const thBg = m.bgc ? ' style="--km-thbg:' + esc(m.bgc).replace(/"/g, '') + '"' : '';
  const fid = folderOfMap(m), fd = fid && !hubPrefs().d ? mfolders().find(f => f.id === fid) : null;
  return '<div class="km-card' + (list ? ' row' : '') + (SEL.has(m.id) ? ' sel' : '') + '" draggable="true" data-hub="open" data-v="' + esc(m.id) + '" tabindex="0" role="button" aria-label="' + (SELMODE ? 'Sélectionner ' : 'Ouvrir ') + esc(m.name) + '">' +
    (SELMODE ? '<span class="km-card-ck" aria-hidden="true"><span class="ms">check</span></span>' : '') +
    '<div class="km-card-th' + (m.bgc ? ' bg' : '') + '"' + thBg + '>' + (m.th || '<span class="ms">account_tree</span>') + '</div>' +
    '<div class="km-card-b"><div class="km-card-n">' + esc(m.name || 'Sans titre') + '</div>' +
    '<div class="km-card-m">' + n + ' idée' + (n > 1 ? 's' : '') + ' · ' + ago(m.updated) + '</div>' +
    (cn || fd ? '<div class="km-card-tags">' + (fd ? '<span class="km-card-c km-card-fd"><span class="ms">folder</span>' + esc(fd.name) + '</span>' : '') + (cn ? '<span class="km-card-c"><span class="ms">school</span>' + esc(cn) + '</span>' : '') + '</div>' : '') + '</div>' +
    '<button class="km-card-fav' + (m.fav ? ' on' : '') + '" data-hub="fav" data-v="' + esc(m.id) + '" title="' + (m.fav ? 'Retirer des favoris' : 'Ajouter aux favoris') + '" aria-label="Favori"><span class="ms">' + (m.fav ? 'star' : 'star_outline') + '</span></button>' +
    '<button class="km-card-more" data-hub="more" data-v="' + esc(m.id) + '" title="Options" aria-label="Options"><span class="ms">more_horiz</span></button></div>';
}
function hubList() {
  const pr = hubPrefs(), q = norm(hubQ.trim());
  let list = index().slice();
  if (pr.f === 'fav') list = list.filter(m => m.fav);
  else if (pr.f === 'course') list = list.filter(m => m.courseId);
  if (pr.d) list = list.filter(m => pr.d === '__none' ? !folderOfMap(m) : m.folder === pr.d);
  if (q) list = list.filter(m => norm(m.name).includes(q) || norm(courseName(m.courseId)).includes(q));
  if (pr.s === 'name') list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
  else if (pr.s === 'size') list.sort((a, b) => (b.n || 0) - (a.n || 0));
  else list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (pr.s === 'recent' && !q && pr.f === 'all') list.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
  return list;
}
function drawHubList() {
  const box = document.getElementById('kmh-list'); if (!box) return;
  const pr = hubPrefs(), list = hubList(), all = index().length;
  const cnt = document.getElementById('kmh-count'); if (cnt) cnt.textContent = all;
  if (!all) { box.className = 'kmh-list'; box.innerHTML = '<div class="km-empty"><span class="ms">account_tree</span><b>Aucune carte pour l’instant</b><p>Crée une carte vierge, pars d’un modèle ou génère-la depuis la fiche d’un de tes cours.</p><button class="km-hbtn pri" data-hub="new"><span class="ms">add</span>Ma première carte</button></div>'; return; }
  drawFolders(); drawSelBar();
  if (!list.length) { box.className = 'kmh-list'; box.innerHTML = pr.d && !hubQ.trim() && pr.f === 'all' ? '<div class="km-empty sm"><span class="ms">folder_open</span><b>' + (pr.d === '__none' ? 'Toutes tes cartes sont rangées' : 'Ce dossier est vide') + '</b><p>Clique sur « Sélectionner », choisis des cartes puis « Ranger dans… » — ou glisse une carte sur le dossier.</p></div>' : '<div class="km-empty sm"><span class="ms">search_off</span><b>Aucune carte trouvée</b></div>'; return; }
  box.className = 'kmh-list ' + (pr.v === 'list' ? 'km-rows' : 'km-grid');
  box.innerHTML = list.map(m => cardHTML(m, pr.v === 'list')).join('');
}
window.renderMindMapHub = function () {
  const host = document.getElementById('km-hub'); if (!host) return;
  const tpls = KM.TEMPLATES || [], pr = hubPrefs();
  const chip = (k, l, ic) => '<button class="kmh-chip' + (pr.f === k ? ' on' : '') + '" data-hub="filt" data-v="' + k + '">' + (ic ? '<span class="ms">' + ic + '</span>' : '') + l + '</button>';
  host.innerHTML =
    '<header class="kmh-head"><div class="kmh-ttl"><p class="kmh-kick">Réviser</p><h1>Cartes mentales</h1><p>Organise un cours en carte visuelle, relie les notions entre elles, puis révise en masquant les idées.</p></div>' +
      '<label class="kmh-search"><span class="ms">search</span><input id="kmh-q" type="search" autocomplete="off" placeholder="Rechercher une carte ou un cours…" value="' + esc(hubQ) + '"></label></header>' +
    '<section class="kmh-create">' +
      '<button class="kmh-new" data-hub="new"><span class="kmh-new-art" aria-hidden="true"><svg viewBox="0 0 160 90"><g fill="none" stroke-linecap="round" stroke-width="4"><path d="M80 45C100 45 104 20 124 20" stroke="#2f80ed"/><path d="M80 45C100 45 104 70 124 70" stroke="#1fa463"/><path d="M80 45C60 45 56 22 36 22" stroke="#f2711c"/><path d="M80 45C60 45 56 68 36 68" stroke="#9b51e0"/></g><rect x="56" y="33" width="48" height="24" rx="8" fill="currentColor"/><rect x="118" y="11" width="34" height="18" rx="6" fill="#2f80ed" opacity=".25"/><rect x="118" y="61" width="34" height="18" rx="6" fill="#1fa463" opacity=".25"/><rect x="8" y="13" width="34" height="18" rx="6" fill="#f2711c" opacity=".25"/><rect x="8" y="59" width="34" height="18" rx="6" fill="#9b51e0" opacity=".25"/></svg></span>' +
        '<span class="kmh-new-t"><b><span class="ms">add</span>Carte vierge</b><small>Une idée au centre : appuie sur Tab pour ajouter des sous-idées</small></span></button>' +
      '<div class="kmh-tiles">' +
        '<button class="kmh-tile" data-hub="course" style="--c:#2f80ed"><span class="ms">school</span><b>Depuis un cours</b><small>La fiche et les QCM deviennent une carte</small></button>' +
        '<button class="kmh-tile" data-hub="ai" style="--c:#9b51e0"><span class="ms">auto_awesome</span><b>Avec l’IA</b><small>ChatGPT ou Gemini écrit le plan, tu colles</small></button>' +
        '<button class="kmh-tile" data-hub="paste" style="--c:#1fa463"><span class="ms">playlist_add</span><b>Coller un plan</b><small>Titres, puces ou tableau → carte</small></button>' +
        '<button class="kmh-tile" data-hub="board" style="--c:#f2711c"><span class="ms">gesture</span><b>Tableau blanc</b><small>Post-it, formes, dessin libre</small></button>' +
      '</div></section>' +
    (tpls.length ? '<div class="kmh-sec"><h2>Modèles kiné</h2><span>Clique pour partir d’une structure toute prête</span></div><div class="kmh-tpls">' + tpls.map(t => '<button class="kmh-tpl" data-hub="tpl" data-v="' + t.id + '" style="--c:' + t.color + '"><span class="kmh-tpl-pv">' + tplPreview(t) + '</span><span class="kmh-tpl-t"><span class="ms">' + t.icon + '</span><span><b>' + esc(t.name) + '</b><small>' + esc(t.desc) + '</small></span></span></button>').join('') + '</div>' : '') +
    '<div class="kmh-sec kmh-sec-cards"><h2>Mes cartes <span id="kmh-count"></span></h2>' +
      '<div class="kmh-tools"><div class="kmh-chips">' + chip('all', 'Toutes') + chip('fav', 'Favorites', 'star') + chip('course', 'Liées à un cours', 'school') + '</div>' +
      '<select class="kmh-sort" data-hubsel="s" aria-label="Trier"><option value="recent"' + (pr.s === 'recent' ? ' selected' : '') + '>Plus récentes</option><option value="name"' + (pr.s === 'name' ? ' selected' : '') + '>Nom (A → Z)</option><option value="size"' + (pr.s === 'size' ? ' selected' : '') + '>Plus grandes</option></select>' +
      '<div class="kmh-view"><button class="' + (pr.v === 'grid' ? 'on' : '') + '" data-hub="view" data-v="grid" title="Grille" aria-label="Grille"><span class="ms">grid_view</span></button><button class="' + (pr.v === 'list' ? 'on' : '') + '" data-hub="view" data-v="list" title="Liste" aria-label="Liste"><span class="ms">view_list</span></button></div>' +
      '<button class="kmh-selbtn" data-hub="sel" title="Sélectionner plusieurs cartes (ou Ctrl / Maj + clic)"><span class="ms">checklist</span><span>Sélectionner</span></button></div></div>' +
    '<div class="kmh-folders" id="kmh-folders"></div>' +
    '<div id="kmh-list"></div>';
  SELMODE = false; SEL.clear(); host.classList.remove('kmh-selecting');
  drawHubList();
};
function drawFolders() {
  const box = document.getElementById('kmh-folders'); if (!box) return;
  const fs = mfolders(), pr = hubPrefs(), all = index();
  const cnt = id => all.filter(m => id === '__none' ? !folderOfMap(m) : m.folder === id).length;
  let h = '<button class="kmh-fd' + (!pr.d ? ' on' : '') + '" data-hub="fold" data-v=""><span class="ms">apps</span>Toutes<small>' + all.length + '</small></button>';
  fs.forEach(f => { h += '<button class="kmh-fd' + (pr.d === f.id ? ' on' : '') + '" data-hub="fold" data-v="' + esc(f.id) + '" data-fdrop="' + esc(f.id) + '"><span class="ms">folder</span>' + esc(f.name) + '<small>' + cnt(f.id) + '</small></button>'; });
  if (fs.length) h += '<button class="kmh-fd' + (pr.d === '__none' ? ' on' : '') + '" data-hub="fold" data-v="__none" data-fdrop="__none"><span class="ms">folder_off</span>Sans dossier<small>' + cnt('__none') + '</small></button>';
  h += '<button class="kmh-fd add" data-hub="fnew"><span class="ms">create_new_folder</span>Nouveau dossier</button>';
  if (pr.d && pr.d !== '__none') h += '<span class="kmh-fd-act"><button data-hub="fren" data-v="' + esc(pr.d) + '" title="Renommer le dossier" aria-label="Renommer le dossier"><span class="ms">edit</span></button><button data-hub="fdel" data-v="' + esc(pr.d) + '" title="Supprimer le dossier" aria-label="Supprimer le dossier"><span class="ms">delete</span></button></span>';
  box.innerHTML = h;
}
function drawSelBar() {
  const host = document.getElementById('km-hub'); if (!host) return;
  let bar = document.getElementById('kmh-selbar');
  if (!SELMODE) { if (bar) bar.remove(); return; }
  if (!bar) { bar = el('div', 'kmh-selbar'); bar.id = 'kmh-selbar'; host.appendChild(bar); }
  const n = SEL.size, vis = hubList(), allOn = vis.length && vis.every(m => SEL.has(m.id));
  bar.innerHTML = '<b>' + (n ? n + ' carte' + (n > 1 ? 's' : '') + ' sélectionnée' + (n > 1 ? 's' : '') : 'Clique sur des cartes pour les sélectionner') + '</b>' +
    '<button data-hub="selall"><span class="ms">' + (allOn ? 'deselect' : 'select_all') + '</span>' + (allOn ? 'Aucune' : 'Tout') + '</button>' +
    '<button data-hub="selmove"' + (n ? '' : ' disabled') + '><span class="ms">drive_file_move</span>Ranger dans…</button>' +
    '<button data-hub="seldel" class="danger"' + (n ? '' : ' disabled') + '><span class="ms">delete</span>Supprimer</button>' +
    '<button data-hub="seldone" class="pri"><span class="ms">check</span>Terminé</button>';
}
function setSelMode(on) {
  SELMODE = !!on; if (!SELMODE) { SEL.clear(); LASTSEL = null; }
  const host = document.getElementById('km-hub'); if (host) host.classList.toggle('kmh-selecting', SELMODE);
  const b = document.querySelector('#km-hub .kmh-selbtn'); if (b) b.classList.toggle('on', SELMODE);
  drawHubList();
}
function toggleSel(id, range) {
  if (!SELMODE) setSelMode(true);
  if (range && LASTSEL) {
    const ids = hubList().map(m => m.id), a = ids.indexOf(LASTSEL), b = ids.indexOf(id);
    if (a > -1 && b > -1) { ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => SEL.add(x)); }
  } else if (SEL.has(id)) SEL.delete(id); else SEL.add(id);
  LASTSEL = id;
  document.querySelectorAll('#kmh-list .km-card').forEach(c => c.classList.toggle('sel', SEL.has(c.dataset.v)));
  drawSelBar();
}
function askName(title, def, cb) {
  dialog({
    title, html: '<input class="km-in" maxlength="60" placeholder="Ex. : Anatomie, Partiels…" value="' + esc(def || '') + '">', foot: '<button class="km-b2 pri" data-k="ok">OK</button>',
    onMount(w, close) {
      const inp = w.querySelector('input'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
      const ok = () => { const v = inp.value.trim(); if (v) cb(v); close(); };
      inp.addEventListener('keydown', e2 => { if (e2.key === 'Enter') ok(); });
      w.addEventListener('click', e2 => { if (e2.target.closest('[data-k="ok"]')) ok(); });
    }
  });
}
function newFolder(cb) { askName('Nouveau dossier', '', name => { const a = mfolders(), f = { id: uid(), name }; a.push(f); saveMFolders(a); if (cb) cb(f); else drawHubList(); }); }
function moveMaps(ids, fid) {
  let n = 0;
  ids.forEach(id => { const m = metaOf(id); if (!m) return; if (fid && fid !== '__none') m.folder = fid; else delete m.folder; n++; });
  saveIndex();
  const f = mfolders().find(x => x.id === fid);
  toast(n + ' carte' + (n > 1 ? 's' : '') + (f ? ' rangée' + (n > 1 ? 's' : '') + ' dans « ' + f.name + ' »' : ' sortie' + (n > 1 ? 's' : '') + ' de leur dossier'));
  if (SELMODE) setSelMode(false); else drawHubList();
}
function moveMenu(btn, ids) {
  closeHubMenu();
  if (!ids.length) return;
  const m = el('div', 'km-hubmenu km-menu show'), fs = mfolders();
  m.innerHTML = '<div class="km-mv-h">Ranger ' + ids.length + ' carte' + (ids.length > 1 ? 's' : '') + ' dans…</div>' +
    fs.map(f => '<button data-mv="' + esc(f.id) + '"><span class="ms">folder</span><span>' + esc(f.name) + '</span></button>').join('') +
    (fs.length ? '<button data-mv="__none"><span class="ms">folder_off</span><span>Sans dossier</span></button><hr>' : '') +
    '<button data-mv="__new"><span class="ms">create_new_folder</span><span>Nouveau dossier…</span></button>';
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = (r.top - m.offsetHeight - 8 > 8 && r.top > window.innerHeight / 2 ? r.top - m.offsetHeight - 8 : Math.min(r.bottom + 6, window.innerHeight - m.offsetHeight - 8)) + 'px';
  m.addEventListener('click', ev => {
    const b = ev.target.closest('[data-mv]'); if (!b) return;
    ev.stopPropagation(); m.remove();
    if (b.dataset.mv === '__new') newFolder(f => moveMaps(ids, f.id)); else moveMaps(ids, b.dataset.mv);
  });
}
function delMaps(ids) {
  if (!ids.length) return;
  const n = ids.length, doDel = () => { ids.forEach(deleteBoard); setSelMode(false); toast(n + ' carte' + (n > 1 ? 's' : '') + ' supprimée' + (n > 1 ? 's' : '')); };
  const t = 'Supprimer ' + (n > 1 ? 'ces ' + n + ' cartes' : 'cette carte') + ' ?', msg = (n > 1 ? 'Elles seront définitivement supprimées.' : '« ' + ((metaOf(ids[0]) || {}).name || '') + ' » sera définitivement supprimée.');
  if (typeof showConfirm === 'function') showConfirm(t, msg, 'Supprimer', doDel); else if (confirm(t)) doDel();
}
/* glisser une carte (ou toute la sélection) sur un dossier */
let DRAGIDS = null;
document.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('#kmh-list .km-card'); if (!c) return;
  DRAGIDS = SEL.has(c.dataset.v) ? [...SEL] : [c.dataset.v];
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', DRAGIDS.join(',')); } catch (err) { /* rien */ }
  document.getElementById('km-hub')?.classList.add('kmh-dragging');
});
document.addEventListener('dragend', () => { DRAGIDS = null; document.getElementById('km-hub')?.classList.remove('kmh-dragging'); document.querySelectorAll('.kmh-fd.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => { const f = DRAGIDS && e.target.closest && e.target.closest('#kmh-folders [data-fdrop]'); if (!f) return; e.preventDefault(); document.querySelectorAll('.kmh-fd.over').forEach(x => { if (x !== f) x.classList.remove('over'); }); f.classList.add('over'); });
document.addEventListener('drop', e => { const f = DRAGIDS && e.target.closest && e.target.closest('#kmh-folders [data-fdrop]'); if (!f) return; e.preventDefault(); const ids = DRAGIDS; DRAGIDS = null; moveMaps(ids, f.dataset.fdrop); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && SELMODE && document.getElementById('kmh-selbar') && !document.querySelector('.km-dlg')) { e.preventDefault(); setSelMode(false); } });
document.addEventListener('input', e => { if (e.target && e.target.id === 'kmh-q') { hubQ = e.target.value; drawHubList(); } });
document.addEventListener('change', e => { if (e.target && e.target.dataset && e.target.dataset.hubsel === 's' && e.target.closest('#km-hub')) { setHubPref('s', e.target.value); drawHubList(); } });
function hubClick(e) {
  const b = e.target.closest('[data-hub]');
  if (!b || !b.closest('#km-hub')) { closeHubMenu(); return; }
  const a = b.dataset.hub, v = b.dataset.v;
  if (a !== 'more') closeHubMenu();
  switch (a) {
    case 'open': if (SELMODE || e.shiftKey || e.metaKey || e.ctrlKey) { e.preventDefault(); toggleSel(v, e.shiftKey); } else openBoard(v); break;
    case 'sel': setSelMode(!SELMODE); break;
    case 'seldone': setSelMode(false); break;
    case 'selall': { const vis = hubList(), allOn = vis.length && vis.every(m => SEL.has(m.id)); if (allOn) vis.forEach(m => SEL.delete(m.id)); else vis.forEach(m => SEL.add(m.id)); drawHubList(); break; }
    case 'selmove': e.stopPropagation(); moveMenu(b, [...SEL]); break;
    case 'seldel': delMaps([...SEL]); break;
    case 'fold': setHubPref('d', v); drawHubList(); break;
    case 'fnew': newFolder(); break;
    case 'fren': { const a = mfolders(), f = a.find(x => x.id === v); if (f) askName('Renommer le dossier', f.name, name => { f.name = name; saveMFolders(a); drawHubList(); }); break; }
    case 'fdel': {
      const a = mfolders(), f = a.find(x => x.id === v); if (!f) break;
      const n = index().filter(m => m.folder === v).length;
      const go = () => { index().forEach(m => { if (m.folder === v) delete m.folder; }); saveIndex(); saveMFolders(a.filter(x => x.id !== v)); setHubPref('d', ''); drawHubList(); toast('Dossier « ' + f.name + ' » supprimé'); };
      const msg = n ? 'Les ' + n + ' carte' + (n > 1 ? 's' : '') + ' qu’il contient ne sont pas supprimées : elles reviennent dans « Sans dossier ».' : 'Il est vide.';
      if (typeof showConfirm === 'function') showConfirm('Supprimer le dossier « ' + f.name + ' » ?', msg, 'Supprimer le dossier', go); else if (confirm('Supprimer le dossier ?')) go();
      break;
    }
    case 'new': { const id = KM.newBoard(); if (id) openBoard(id, { editRoot: true }); break; }
    case 'board': { const id = KM.createBoard('Tableau blanc', []); if (id) { openBoard(id); setTool('sticky'); } break; }
    case 'ai': if (typeof window.kiaNew === 'function') window.kiaNew('map'); else toast('Atelier IA indisponible', 'error'); break;
    case 'course': if (KM.coursePicker) KM.coursePicker(c => KM.boardFromCourse(c)); break;
    case 'paste': if (KM.pasteDialog) KM.pasteDialog((tree, name) => { const id = KM.boardFromTree(name || tree.t || 'Plan importé', tree); if (id) openBoard(id); }); break;
    case 'tpl': { const t = (KM.TEMPLATES || []).find(x => x.id === v); if (t) { const id = KM.boardFromTree(t.name, JSON.parse(JSON.stringify(t.tree))); if (id) openBoard(id); } break; }
    case 'more': e.stopPropagation(); hubMenu(b, v); break;
    case 'fav': { e.stopPropagation(); const m = metaOf(v); if (m) { m.fav = !m.fav; saveIndex(); drawHubList(); toast(m.fav ? 'Ajoutée aux favoris' : 'Retirée des favoris'); } break; }
    case 'filt': setHubPref('f', v); document.querySelectorAll('#km-hub .kmh-chip').forEach(x => x.classList.toggle('on', x.dataset.v === v)); drawHubList(); break;
    case 'view': setHubPref('v', v); document.querySelectorAll('#km-hub .kmh-view button').forEach(x => x.classList.toggle('on', x.dataset.v === v)); drawHubList(); break;
  }
}
function closeHubMenu() { const m = document.querySelector('.km-hubmenu'); if (m) m.remove(); }
function hubMenu(btn, id) {
  closeHubMenu();
  const m = el('div', 'km-hubmenu km-menu show');
  const mm = metaOf(id);
  m.innerHTML = '<button data-hm="open"><span class="ms">open_in_new</span><span>Ouvrir</span></button><button data-hm="fav"><span class="ms">' + (mm && mm.fav ? 'star' : 'star_outline') + '</span><span>' + (mm && mm.fav ? 'Retirer des favoris' : 'Ajouter aux favoris') + '</span></button><button data-hm="rename"><span class="ms">edit</span><span>Renommer</span></button><button data-hm="move"><span class="ms">drive_file_move</span><span>Ranger dans un dossier…</span></button><button data-hm="dup"><span class="ms">content_copy</span><span>Dupliquer</span></button><hr><button data-hm="del" class="danger"><span class="ms">delete</span><span>Supprimer</span></button>';
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, window.innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.min(r.bottom + 6, window.innerHeight - m.offsetHeight - 8) + 'px';
  m.addEventListener('click', ev => {
    const b = ev.target.closest('[data-hm]'); if (!b) return;
    ev.stopPropagation(); m.remove();
    const meta = metaOf(id); if (!meta) return;
    if (b.dataset.hm === 'open') openBoard(id);
    else if (b.dataset.hm === 'move') moveMenu(btn, [id]);
    else if (b.dataset.hm === 'fav') { meta.fav = !meta.fav; saveIndex(); drawHubList(); }
    else if (b.dataset.hm === 'dup') { duplicateBoard(id); window.renderMindMapHub(); toast('Carte dupliquée'); }
    else if (b.dataset.hm === 'rename') {
      dialog({
        title: 'Renommer la carte', html: '<input class="km-in" maxlength="80" value="' + esc(meta.name) + '">', foot: '<button class="km-b2 pri" data-k="ok">Renommer</button>',
        onMount(w, close) {
          const inp = w.querySelector('input'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
          const ok = () => { const v = inp.value.trim(); if (v) { meta.name = v; saveIndex(); window.renderMindMapHub(); } close(); };
          inp.addEventListener('keydown', e2 => { if (e2.key === 'Enter') ok(); });
          w.addEventListener('click', e2 => { if (e2.target.closest('[data-k="ok"]')) ok(); });
        }
      });
    } else if (b.dataset.hm === 'del') {
      const doDel = () => { deleteBoard(id); window.renderMindMapHub(); toast('Carte supprimée'); };
      if (typeof showConfirm === 'function') showConfirm('Supprimer cette carte ?', '« ' + meta.name + ' » sera définitivement supprimée.', 'Supprimer', doDel);
      else if (confirm('Supprimer « ' + meta.name + ' » ?')) doDel();
    }
  });
}


/* ═════════════════ v5 (16 nov. 2026) : fonds d'écran, thèmes de couleurs, mini-carte, présentation, export ═════════════════ */
const BG_PRESETS = [
  /* id, nom, fond, points, sombre ?, dégradé */
  ['auto', 'Thème du site', null, null, null],
  ['nuit', 'Nuit', '#0f1117', '#2a2f3a', true],
  ['ardoise', 'Ardoise', '#1e293b', '#334155', true],
  ['plan', 'Plan bleu', '#0f2a4a', 'rgba(255,255,255,.16)', true],
  ['foret', 'Forêt', '#10261f', '#21463a', true],
  ['prune', 'Prune', '#24152b', '#3d2648', true],
  ['blanc', 'Blanc', '#ffffff', '#d5d9df', false],
  ['papier', 'Papier', '#f7f1e3', '#dccfb2', false],
  ['ciel', 'Ciel', '#e9f3ff', '#bcd6f5', false],
  ['menthe', 'Menthe', '#e7f6ee', '#b7e0c9', false],
  ['lavande', 'Lavande', '#f0ebfd', '#cfc3f3', false],
  ['peche', 'Pêche', '#fff0e6', '#f3cdb4', false],
  ['aurore', 'Aurore', '#1e1b4b', 'rgba(255,255,255,.12)', true, 'linear-gradient(135deg,#1e1b4b 0%,#4c1d95 52%,#9d174d 100%)'],
  ['ocean', 'Océan', '#0b1d33', 'rgba(255,255,255,.1)', true, 'linear-gradient(160deg,#0b1d33 0%,#0e4f6e 60%,#0f766e 100%)'],
  ['coucher', 'Coucher de soleil', '#ffd8b0', 'rgba(0,0,0,.1)', false, 'linear-gradient(160deg,#ffe0b8 0%,#ffb8b8 50%,#cdb8ff 100%)'],
  ['brume', 'Brume', '#eef1f6', 'rgba(0,0,0,.1)', false, 'linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%)']
];
const PATTERNS = [['dots', 'Points', 'more_horiz'], ['grid', 'Quadrillage', 'grid_on'], ['lines', 'Lignes', 'reorder'], ['plain', 'Uni', 'crop_square']];
const THEMES = {
  arc: ['Arc-en-ciel', BRANCH.slice()],
  pastel: ['Pastel', ['#f4a261', '#7fb3e6', '#7cc9a0', '#b79ce6', '#e9c46a', '#7fd1d8', '#f19cb4', '#9aa3f0']],
  neon: ['Néon', ['#ff3d7f', '#00b8f5', '#00d084', '#b04bff', '#ffc400', '#00d9c8', '#ff6a3d', '#6a7bff']],
  ocean: ['Océan', ['#0ea5e9', '#0369a1', '#06b6d4', '#14b8a6', '#3b82f6', '#0891b2', '#6366f1', '#22d3ee']],
  foret: ['Forêt', ['#16a34a', '#65a30d', '#ca8a04', '#0d9488', '#15803d', '#a16207', '#4d7c0f', '#047857']],
  coucher: ['Coucher de soleil', ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#f59e0b', '#e11d48', '#d946ef', '#fb7185']],
  mono: ['Sobre', ['#475569', '#64748b', '#334155', '#52525b', '#78716c', '#4b5563', '#3f3f46', '#71717a']]
};
function lumHex(h) { const c = hexRgb(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
function bgPreset() { const bg = (B && B.bg) || {}; return BG_PRESETS.find(x => x[0] === (bg.p || 'auto')) || BG_PRESETS[0]; }
function bgSwatch() { const bg = (B && B.bg) || {}; if (bg.p === 'custom' && bg.c) return bg.c; if (bg.p === 'img') return bg.imgC || '#334155'; const pr = bgPreset(); return pr[5] || pr[2] || ''; }
function applyTheme() { const t = THEMES[B && B.theme] || THEMES.arc; BRANCH.splice(0, BRANCH.length, ...t[1]); }
function applyBg(silent) {
  if (!E) return;
  const bg = (B && B.bg) || {}, pr = bgPreset();
  let col = pr[2], dot = pr[3], dark = pr[4], wall = pr[5] || '';
  if (bg.p === 'custom' && bg.c) { col = bg.c; dark = lumHex(bg.c) < 0.5; dot = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.14)'; wall = ''; }
  if (bg.p === 'img' && bg.img) { col = bg.imgC || '#334155'; dark = (bg.imgL != null ? bg.imgL < 0.55 : true) || (bg.dim || 0) > 0.35; dot = dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.16)'; wall = 'url("' + bg.img + '")'; }
  const app = E.app;
  if (col) { app.style.setProperty('--km-bg', col); app.style.setProperty('--km-dot', dot); }
  else { app.style.removeProperty('--km-bg'); app.style.removeProperty('--km-dot'); }
  BGD = col ? !!dark : null;
  app.classList.toggle('km-force-dark', BGD === true);
  app.classList.toggle('km-force-light', BGD === false);
  app.dataset.pat = bg.pat || (wall ? 'plain' : 'dots');
  E.wall.style.backgroundImage = wall;
  E.wall.classList.toggle('on', !!wall);
  E.wall.classList.toggle('img', bg.p === 'img');
  E.wall.style.setProperty('--km-dim', bg.p === 'img' ? String(bg.dim || 0) : '0');
  if (!silent) { markAllDirty(); render(); }
}
KM.applyBg = () => applyBg();
function setBoardStyle(fn) { if (!B) return; fn(); applyBg(); dataDirty = true; scheduleSave(); drawStyle(); }
let styleAnchor = null;
function openStyle(btn) { styleAnchor = btn; drawStyle(); E.stylepop.classList.add('show'); }
function drawStyle() {
  if (!E || !B) return;
  const bg = B.bg || {}, cur = bg.p || 'auto', pat = bg.pat || (bgPreset()[5] || bg.p === 'img' ? 'plain' : 'dots');
  const sw = BG_PRESETS.map(p => {
    const look = p[0] === 'auto' ? 'background:linear-gradient(135deg,#f5f6f8 50%,#141518 50%)' : 'background:' + (p[5] || p[2]);
    return '<button class="km-sw' + (cur === p[0] ? ' on' : '') + '" data-bg="' + p[0] + '" title="' + esc(p[1]) + '" style="' + look + '">' + (cur === p[0] ? '<span class="ms">check</span>' : '') + '</button>';
  }).join('');
  E.stylepop.innerHTML =
    '<div class="km-sp-h"><b>Fond d’écran</b><button class="km-ib sm" data-sp="close" title="Fermer"><span class="ms">close</span></button></div>' +
    '<div class="km-sws">' + sw + '</div>' +
    '<div class="km-sp-row"><label class="km-sp-btn' + (cur === 'custom' ? ' on' : '') + '"><span class="ms">colorize</span>Ma couleur<input type="color" data-sp="color" value="' + (bg.c || '#3b82f6') + '"></label>' +
    '<button class="km-sp-btn' + (cur === 'img' ? ' on' : '') + '" data-sp="img"><span class="ms">add_photo_alternate</span>' + (bg.img ? 'Changer l’image' : 'Mon image') + '</button></div>' +
    (cur === 'img' && bg.img ? '<div class="km-sp-dim"><span class="ms">brightness_6</span><input type="range" min="0" max="70" step="5" value="' + Math.round((bg.dim || 0) * 100) + '" data-sp="dim" aria-label="Assombrir l’image"><button class="km-ib sm" data-sp="rmimg" title="Retirer l’image"><span class="ms">delete</span></button></div>' : '') +
    '<div class="km-sp-h"><b>Motif</b></div>' +
    '<div class="km-sp-pats">' + PATTERNS.map(([k, n, ic]) => '<button class="' + (pat === k ? 'on' : '') + '" data-pat="' + k + '"><span class="ms">' + ic + '</span>' + n + '</button>').join('') + '</div>' +
    '<div class="km-sp-h"><b>Couleurs des branches</b></div>' +
    '<div class="km-sp-th">' + Object.entries(THEMES).map(([k, t]) => '<button class="' + ((B.theme || 'arc') === k ? 'on' : '') + '" data-th="' + k + '"><span class="km-sp-dots">' + t[1].slice(0, 6).map(c => '<i style="background:' + c + '"></i>').join('') + '</span>' + esc(t[0]) + '</button>').join('') + '</div>';
  const r = styleAnchor ? styleAnchor.getBoundingClientRect() : { right: window.innerWidth - 20, bottom: 60 }, ar = E.app.getBoundingClientRect();
  E.stylepop.style.right = Math.max(8, ar.right - r.right) + 'px';
  E.stylepop.style.top = (r.bottom - ar.top + 10) + 'px';
}
function styleClick(b) {
  if (b.dataset.sp === 'close') { E.stylepop.classList.remove('show'); return; }
  if (b.dataset.bg) { const v = b.dataset.bg; setBoardStyle(() => { B.bg = v === 'auto' ? null : { p: v, pat: (B.bg && B.bg.pat) || undefined }; }); return; }
  if (b.dataset.pat) { const v = b.dataset.pat; setBoardStyle(() => { B.bg = Object.assign({ p: 'auto' }, B.bg || {}, { pat: v }); }); return; }
  if (b.dataset.th) { const v = b.dataset.th; B.theme = v; applyTheme(); markAllDirty(); render(); dataDirty = true; scheduleSave(); drawStyle(); return; }
  if (b.dataset.sp === 'rmimg') { setBoardStyle(() => { B.bg = { p: 'auto', pat: B.bg && B.bg.pat }; }); return; }
  if (b.dataset.sp === 'img') {
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
    f.onchange = () => { const file = f.files && f.files[0]; if (file) wallFromFile(file); };
    f.click();
  }
}
function styleInput(e) {
  const t = e.target;
  if (t.dataset.sp === 'color') { const v = t.value; if (e.type === 'input') { B.bg = { p: 'custom', c: v, pat: B.bg && B.bg.pat }; applyBg(); } else setBoardStyle(() => { B.bg = { p: 'custom', c: v, pat: B.bg && B.bg.pat }; }); }
  else if (t.dataset.sp === 'dim') { B.bg.dim = (+t.value) / 100; applyBg(true); if (e.type === 'change') { applyBg(); dataDirty = true; scheduleSave(); } }
}
function wallFromFile(file) {
  if (!/^image\//.test(file.type)) { toast('Choisis une image (JPG, PNG…).', 'error'); return; }
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => {
      const max = 1920, k = Math.min(1, max / Math.max(im.width, im.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cv.width, cv.height);
      const sm = document.createElement('canvas'); sm.width = sm.height = 24; const sx = sm.getContext('2d'); sx.drawImage(cv, 0, 0, 24, 24);
      const px = sx.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, bl = 0; for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; bl += px[i + 2]; }
      const n = px.length / 4; r /= n; g /= n; bl /= n;
      const L = (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255, hx = '#' + [r, g, bl].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      const url = cv.toDataURL('image/jpeg', 0.8);
      setBoardStyle(() => { B.bg = { p: 'img', img: url, imgL: L, imgC: hx, dim: L > 0.6 ? 0 : 0.15, pat: 'plain' }; });
      toast('Fond d’écran appliqué');
    };
    im.onerror = () => toast('Image illisible.', 'error');
    im.src = rd.result;
  };
  rd.readAsDataURL(file);
}
/* Mini-carte (façon Miro) */
let MINI_ON = (function () { try { return localStorage.getItem('kcu_maps_mini') !== '0'; } catch (e) { return true; } })(), miniReq = 0;
function reqMini() { if (!miniReq) miniReq = requestAnimationFrame(() => { miniReq = 0; drawMini(); }); }
function drawMini() {
  if (!E || !B) return;
  const btn = E.app.querySelector('[data-act="mini"]'); if (btn) btn.classList.toggle('on', MINI_ON);
  const cb = contentBox();
  if (!MINI_ON || !cb || PR) { E.mini.classList.remove('show'); return; }
  const r = E.vp.getBoundingClientRect(), vw = { x: -V.x / V.z, y: -V.y / V.z, w: r.width / V.z, h: r.height / V.z };
  const x1 = Math.min(cb.x, vw.x), y1 = Math.min(cb.y, vw.y), x2 = Math.max(cb.x + cb.w, vw.x + vw.w), y2 = Math.max(cb.y + cb.h, vw.y + vw.h);
  const W = 180, H = 118, pad = 6, sc = Math.min((W - pad * 2) / Math.max(1, x2 - x1), (H - pad * 2) / Math.max(1, y2 - y1));
  const ox = (W - (x2 - x1) * sc) / 2, oy = (H - (y2 - y1) * sc) / 2;
  const X = x => (ox + (x - x1) * sc).toFixed(1), Y = y => (oy + (y - y1) * sc).toFixed(1);
  let h = '';
  for (const it of B.items) {
    if (it.k === 'line' || it.k === 'ink') continue;
    const b = itemBox(it); if (!b) continue;
    let c = 'var(--km-muted)';
    if (it.k === 'node') { const g = G.get(it.id); c = !it.p ? 'var(--km-text)' : (colHex(g && g.col, BRANCH) || BRANCH[0]); }
    else if (it.k === 'sticky') c = STICKY[it.c || 0] || STICKY[0];
    else if (it.k === 'frame') { h += '<rect x="' + X(b.x) + '" y="' + Y(b.y) + '" width="' + Math.max(1, b.w * sc).toFixed(1) + '" height="' + Math.max(1, b.h * sc).toFixed(1) + '" rx="2" fill="none" stroke="var(--km-muted)" stroke-width=".8" opacity=".6"/>'; continue; }
    h += '<rect x="' + X(b.x) + '" y="' + Y(b.y) + '" width="' + Math.max(1.5, b.w * sc).toFixed(1) + '" height="' + Math.max(1.5, b.h * sc).toFixed(1) + '" rx="1.5" fill="' + c + '" opacity=".85"/>';
  }
  h += '<rect class="km-mini-v" x="' + X(vw.x) + '" y="' + Y(vw.y) + '" width="' + (vw.w * sc).toFixed(1) + '" height="' + (vw.h * sc).toFixed(1) + '" rx="3"/>';
  E.mini.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + h + '</svg>';
  E.mini._t = { x1, y1, sc, ox, oy };
  E.mini.classList.add('show');
}
function miniDown(e) {
  e.preventDefault(); e.stopPropagation();
  const go = ev => {
    const t = E.mini._t; if (!t) return;
    const rr = E.mini.getBoundingClientRect(), r = E.vp.getBoundingClientRect();
    const wx = (ev.clientX - rr.left - t.ox) / t.sc + t.x1, wy = (ev.clientY - rr.top - t.oy) / t.sc + t.y1;
    setView({ x: r.width / 2 - wx * V.z, y: r.height / 2 - wy * V.z, z: V.z });
  };
  go(e);
  const mv = ev => go(ev), up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
/* Présentation branche par branche (façon MindMeister) */
let PR = null;
function boxOfIds(ids) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const id of ids) { const g = G.get(id); if (!g) continue; x1 = Math.min(x1, g.x); y1 = Math.min(y1, g.y); x2 = Math.max(x2, g.x + g.w); y2 = Math.max(y2, g.y + g.h); }
  return x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function startPresent() {
  if (!B) return;
  if (REV) endRevision();
  commitEdit(); closeFloating(); sel.clear(); onSel(); render();
  const steps = [];
  B.items.filter(i => i.k === 'node' && !i.p && G.has(i.id)).forEach(r => {
    steps.push({ id: r.id, all: true, root: r.id });
    kids(r.id).filter(k => G.has(k.id)).forEach(k => steps.push({ id: k.id, root: r.id }));
  });
  if (!steps.length) { toast('Ajoute d’abord une carte mentale (outil M) pour la présenter.', 'error'); return; }
  PR = { steps, i: 0 };
  E.app.classList.add('km-presenting');
  presentGo(0);
}
function presentGo(i) {
  if (!PR) return;
  if (i >= PR.steps.length) { stopPresent(); toast('Fin de la présentation 🎉'); return; }
  PR.i = clamp(i, 0, PR.steps.length - 1);
  const st = PR.steps[PR.i], focus = new Set(st.all ? subtreeIds(st.root) : subtreeIds(st.id).concat(st.root));
  IEL.forEach((e, id) => { const it = get(id); e.classList.toggle('km-dim', !st.all && !!it && (it.k === 'node' ? !focus.has(id) : true)); });
  E.app.classList.toggle('km-pr-focus', !st.all);
  const b = boxOfIds(st.all ? [...focus] : subtreeIds(st.id)), r = E.vp.getBoundingClientRect();
  if (b) {
    const pad = Math.min(150, r.width * 0.12);
    const z = clamp(Math.min((r.width - pad * 2) / Math.max(b.w, 1), (r.height - pad * 2 - 70) / Math.max(b.h, 1), st.all ? 1.3 : 1.9), ZMIN, ZMAX);
    animView({ z, x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - 30 - (b.y + b.h / 2) * z }, 650);
  }
  const n = get(st.id), lbl = String((n && n.t) || '').replace(/\n/g, ' ').slice(0, 60);
  E.prbar.innerHTML = '<button class="km-ib" data-pr="prev" title="Précédent (←)"' + (PR.i ? '' : ' disabled') + '><span class="ms">arrow_back</span></button>' +
    '<div class="km-pr-t"><b>' + esc(lbl || 'Idée') + '</b><small>' + (PR.i + 1) + ' / ' + PR.steps.length + (st.all ? ' · vue d’ensemble' : '') + '</small></div>' +
    '<button class="km-ib" data-pr="next" title="Suivant (→ ou Espace)"><span class="ms">arrow_forward</span></button><span class="km-vsep"></span>' +
    '<button class="km-ib" data-pr="stop" title="Quitter (Échap)"><span class="ms">close</span></button>' +
    '<i class="km-pr-prog" style="width:' + ((PR.i + 1) / PR.steps.length * 100).toFixed(1) + '%"></i>';
  E.prbar.classList.add('show');
}
function stopPresent(quiet) {
  if (!PR || !E) { PR = null; return; }
  PR = null;
  IEL.forEach(e => e.classList.remove('km-dim'));
  E.app.classList.remove('km-presenting', 'km-pr-focus');
  E.prbar.classList.remove('show');
  if (!quiet) { fit(true); reqMini(); }
}
/* Plan en Markdown (# idée centrale, puis listes) */
function exportMd() {
  if (!B) return;
  const roots = B.items.filter(i => i.k === 'node' && !i.p);
  if (!roots.length) { toast('Aucune carte mentale à exporter.', 'error'); return; }
  const md = roots.map(r => { const lines = outlineOf(r.id, 0).split('\n'); lines[0] = '# ' + lines[0]; return lines.join('\n'); }).join('\n\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md + '\n'], { type: 'text/markdown;charset=utf-8' }));
  a.download = (B.name || 'carte').replace(/[\\/:*?"<>|]/g, '') + '.md';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Plan téléchargé (.md)');
}

/* ───────────────────────── Intégrations Kiné+ ───────────────────────── */
window.kmapOpenForCourse = function (cid) {
  let course = null;
  try { course = (typeof courses !== 'undefined' ? courses : []).find(c => c.id === cid); } catch (e) { /* rien */ }
  if (!course) { toast('Cours introuvable.', 'error'); return; }
  const existing = index().filter(m => m.courseId === cid).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
  if (existing) { openBoard(existing.id); return; }
  KM.boardFromCourse(course);
};
KM.boardFromCourse = function (course) {
  const tree = typeof KM.courseTree === 'function' ? KM.courseTree(course) : { t: course.name, kids: [] };
  const id = KM.boardFromTree ? KM.boardFromTree(course.name, tree, { courseId: course.id }) : null;
  if (id) { openBoard(id); if (tree && tree._src) toast(tree._src); }
};
window.kmapSleep = function () {
  if (!B || !E) return;
  if (REV) stopRevision();
  commitEdit(); saveNow();
  P = null; spaceDown = false; E.app.classList.remove('km-space', 'km-panning');
  closeFloating(); closeHubMenu();
};
window.newMM = function () { const id = KM.newBoard(); if (id) openBoard(id, { editRoot: true }); };
window.openMM = function (id) { openBoard(id); };

// Nœuds envoyés par d'autres modules (sélection dans un PDF, import de flashcards)
let incoming = [], incomingT = 0;
window.addEventListener('kine:create-node', function (e) {
  const spec = e.detail || {}; const text = String(spec.text || '').trim();
  if (!text) return;
  if (isActive()) {
    const c = viewCenter(), k = incoming.length;
    const s = addItem({ id: uid(), k: 'sticky', x: r1(c.x - 100 + k * 24), y: r1(c.y - 100 + k * 24), w: 200, h: 200, t: text + (spec.subtext ? '\n\n' + spec.subtext : ''), c: 1 });
    sel = new Set([s.id]); onSel(); commit(); render();
    return;
  }
  incoming.push(spec);
  clearTimeout(incomingT);
  incomingT = setTimeout(() => {
    const specs = incoming; incoming = [];
    const tree = { t: specs.length > 1 ? 'Import (' + specs.length + ' idées)' : 'Extrait', kids: specs.map(s => ({ t: String(s.text || '').slice(0, 200), note: s.subtext ? String(s.subtext) : undefined })) };
    const id = KM.boardFromTree ? KM.boardFromTree(tree.t, tree) : null;
    if (id) openBoard(id);
  }, 350);
});

// Écouteurs globaux
window.addEventListener('keydown', onKeyDown, true);
window.addEventListener('keyup', onKeyUp, true);
window.addEventListener('blur', () => { spaceDown = false; if (E) E.app.classList.remove('km-space'); });
document.addEventListener('copy', e => onCopy(e, false));
document.addEventListener('cut', e => onCopy(e, true));
document.addEventListener('paste', onPaste);
document.addEventListener('click', hubClick);
document.addEventListener('pointerdown', menuClickGuard, true);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('km-card') && document.getElementById('km-hub')) { e.preventDefault(); openBoard(e.target.dataset.v); } });
window.addEventListener('pagehide', () => { if (B) { commitEdit(); saveNow(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && B) saveNow(); });
if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (isActive()) { markAllDirty(); req(); } });
})();
