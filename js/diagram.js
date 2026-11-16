/* diagram.js — SVG-based diagram editor for Kiné+ */
'use strict';

/* ─── State ─────────────────────────────────────────────────────────────── */
let diagrams   = [];
let _dgId      = null;
let _dgNodes   = [];
let _dgEdges   = [];
let _dgSel     = null;
let _dgScale   = 1, _dgOx = 0, _dgOy = 0;
let _dgDragState = null;
let _dgWheelTarget = { s: 1, ox: 0, oy: 0 };
let _dgRafId   = null;
let _dgEditId  = null;  // node currently being inline-edited

const SVG_NS = 'http://www.w3.org/2000/svg';
const LS_KEY = 'kcu_dg';

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function _dgEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _uid(prefix) {
  return (prefix || 'n') + Date.now() + Math.floor(Math.random() * 9999);
}

function _svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
  return el;
}

/* ─── LocalStorage ──────────────────────────────────────────────────────── */
function _dgLS() {
  try { diagrams = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch(e) { diagrams = []; }
}

function _dgSave() {
  const idx = diagrams.findIndex(d => d.id === _dgId);
  if (idx < 0) return;
  diagrams[idx].nodes = _dgNodes;
  diagrams[idx].edges = _dgEdges;
  try { localStorage.setItem(LS_KEY, JSON.stringify(diagrams)); }
  catch(e) {}
}

function _dgSaveAll() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(diagrams)); }
  catch(e) {}
}

/* ─── Hub ───────────────────────────────────────────────────────────────── */
function renderDiagramHub() {
  _dgLS();
  const el = document.getElementById('dg-hub-list');
  if (!el) return;
  if (!diagrams.length) {
    el.innerHTML = `<div class="mm-empty-state">
      <span class="ms">schema</span>
      <p>Aucun diagramme pour l'instant.<br>Crée ton premier diagramme !</p>
    </div>`;
    return;
  }
  el.innerHTML = diagrams.map(d => `
    <div class="mm-hub-card" onclick="openDgEditor('${d.id}')">
      <div class="mm-hub-icon"><span class="ms">schema</span></div>
      <div class="mm-hub-info">
        <div class="mm-hub-name">${_dgEsc(d.name)}</div>
        <div class="mm-hub-meta">${d.nodes.length} nœuds · ${d.edges.length} liens</div>
      </div>
      <button class="icon-btn" onclick="event.stopPropagation();deleteDg('${d.id}')" title="Supprimer">
        <span class="ms">delete</span>
      </button>
      <span class="ms" style="color:var(--c-text-muted)">chevron_right</span>
    </div>`).join('');
}

function newDg() {
  _dgLS();
  const d = {
    id: _uid('dg'),
    name: 'Nouveau diagramme',
    nodes: [],
    edges: [],
    created: Date.now()
  };
  diagrams.push(d);
  _dgSaveAll();
  openDgEditor(d.id);
}

function deleteDg(id) {
  if (typeof showConfirm === 'function') {
    showConfirm('Supprimer ce diagramme ?', 'Cette action est irréversible.', 'Supprimer', () => {
      _dgLS();
      diagrams = diagrams.filter(d => d.id !== id);
      _dgSaveAll();
      renderDiagramHub();
    });
  } else {
    if (!confirm('Supprimer ce diagramme ?')) return;
    _dgLS();
    diagrams = diagrams.filter(d => d.id !== id);
    _dgSaveAll();
    renderDiagramHub();
  }
}

/* ─── Editor open/close ─────────────────────────────────────────────────── */
function openDgEditor(id) {
  _dgLS();
  const d = diagrams.find(x => x.id === id);
  if (!d) return;
  _dgId    = id;
  _dgNodes = JSON.parse(JSON.stringify(d.nodes));
  _dgEdges = JSON.parse(JSON.stringify(d.edges));
  _dgSel   = null;
  _dgScale = 1; _dgOx = 0; _dgOy = 0;
  _dgDragState = null;
  _dgEditId = null;
  if (typeof showScreen === 'function') showScreen('diagram-editor');
  setTimeout(() => { _dgSetup(); _dgRender(); }, 80);
}

function closeDgEditor() {
  _dgSave();
  _dgId = null;
  if (typeof showScreen === 'function') showScreen('diagram');
  renderDiagramHub && renderDiagramHub();
}

/* ─── Setup (once) ──────────────────────────────────────────────────────── */
function _dgSetup() {
  const svg = document.getElementById('dg-svg');
  if (!svg || svg.dataset.setup === '1') return;
  svg.dataset.setup = '1';

  svg.addEventListener('mousedown', _dgMouseDown);
  svg.addEventListener('mousemove', _dgMouseMove);
  svg.addEventListener('mouseup',   _dgMouseUp);
  svg.addEventListener('mouseleave',_dgMouseUp);
  svg.addEventListener('wheel',     _dgWheel, { passive: false });
  svg.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  svg.addEventListener('drop',      _dgDrop);

  document.addEventListener('keydown', _dgKeydown);
}

/* ─── Transform ─────────────────────────────────────────────────────────── */
function _dgApplyTransform() {
  const vp = document.getElementById('dg-vp');
  if (vp) vp.setAttribute('transform', `translate(${_dgOx},${_dgOy}) scale(${_dgScale})`);
}

function dgFitView() {
  if (!_dgNodes.length) return;
  const svg = document.getElementById('dg-svg');
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const pad = 60;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  _dgNodes.forEach(n => {
    minX = Math.min(minX, n.x - n.w/2);
    minY = Math.min(minY, n.y - n.h/2);
    maxX = Math.max(maxX, n.x + n.w/2);
    maxY = Math.max(maxY, n.y + n.h/2);
  });
  const bw = maxX - minX, bh = maxY - minY;
  const s = Math.min((rect.width - pad*2)/bw, (rect.height - pad*2)/bh, 3);
  _dgScale = Math.max(0.15, s);
  _dgOx = rect.width/2  - ((minX + bw/2) * _dgScale);
  _dgOy = rect.height/2 - ((minY + bh/2) * _dgScale);
  _dgApplyTransform();
}

function dgZoom(delta) {
  const svg = document.getElementById('dg-svg');
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const cx = rect.width/2, cy = rect.height/2;
  const newScale = Math.max(0.15, Math.min(4, _dgScale * (1 + delta)));
  _dgOx = cx - (cx - _dgOx) * (newScale / _dgScale);
  _dgOy = cy - (cy - _dgOy) * (newScale / _dgScale);
  _dgScale = newScale;
  _dgApplyTransform();
}

/* ─── Wheel zoom ────────────────────────────────────────────────────────── */
function _dgWheel(e) {
  e.preventDefault();
  const svg = document.getElementById('dg-svg');
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const factor = Math.min(0.06, Math.abs(e.deltaY) / 500);
  const dir = e.deltaY < 0 ? 1 : -1;
  const newScale = Math.max(0.15, Math.min(4, _dgScale * (1 + dir * factor)));
  _dgOx = mx - (mx - _dgOx) * (newScale / _dgScale);
  _dgOy = my - (my - _dgOy) * (newScale / _dgScale);
  _dgScale = newScale;
  _dgApplyTransform();
}

/* ─── World coords ──────────────────────────────────────────────────────── */
function _dgToWorld(screenX, screenY) {
  const svg = document.getElementById('dg-svg');
  if (!svg) return { x: 0, y: 0 };
  const rect = svg.getBoundingClientRect();
  return {
    x: (screenX - rect.left - _dgOx) / _dgScale,
    y: (screenY - rect.top  - _dgOy) / _dgScale
  };
}

function _dgToScreen(wx, wy) {
  const svg = document.getElementById('dg-svg');
  if (!svg) return { x: 0, y: 0 };
  const rect = svg.getBoundingClientRect();
  return {
    x: wx * _dgScale + _dgOx + rect.left,
    y: wy * _dgScale + _dgOy + rect.top
  };
}

/* ─── Render ────────────────────────────────────────────────────────────── */
function _dgRender() {
  const nodesLayer = document.getElementById('dg-nodes-layer');
  const edgesLayer = document.getElementById('dg-edges-layer');
  const defs       = document.querySelector('#dg-svg defs');
  if (!nodesLayer || !edgesLayer) return;

  // Update title
  const d = diagrams.find(x => x.id === _dgId);
  const titleEl = document.getElementById('dg-title');
  if (titleEl && d) titleEl.textContent = d.name;

  // Rebuild defs markers
  if (defs) {
    // Remove old per-edge markers
    Array.from(defs.querySelectorAll('[id^="dg-arr-e"]')).forEach(m => m.remove());
    _dgEdges.forEach(e => {
      const marker = _svgEl('marker', {
        id: `dg-arr-${e.id}`,
        markerWidth: '10', markerHeight: '7',
        refX: '9', refY: '3.5', orient: 'auto'
      });
      const poly = _svgEl('polygon', { points: '0 0, 10 3.5, 0 7', fill: e.color || '#64748b' });
      marker.appendChild(poly);
      defs.appendChild(marker);
    });
  }

  // Edges
  edgesLayer.innerHTML = '';
  _dgEdges.forEach(e => _dgRenderEdge(e, edgesLayer));

  // Nodes
  nodesLayer.innerHTML = '';
  _dgNodes.forEach(n => _dgRenderNode(n, nodesLayer));

  _dgApplyTransform();
  _dgUpdateToolbar();
}

/* ─── Node side points ──────────────────────────────────────────────────── */
function _dgGetNodeSidePoint(node, side) {
  const { x, y, w, h, type } = node;
  if (type === 'diamond') {
    if (side === 'n') return { x, y: y - h/2 };
    if (side === 's') return { x, y: y + h/2 };
    if (side === 'e') return { x: x + w/2, y };
    if (side === 'w') return { x: x - w/2, y };
  }
  if (side === 'n') return { x, y: y - h/2 };
  if (side === 's') return { x, y: y + h/2 };
  if (side === 'e') return { x: x + w/2, y };
  if (side === 'w') return { x: x - w/2, y };
  return { x, y };
}

/* ─── Closest sides ─────────────────────────────────────────────────────── */
function _dgClosestSides(fromNode, toNode) {
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  let fromSide, toSide;
  if (Math.abs(dx) >= Math.abs(dy)) {
    fromSide = dx > 0 ? 'e' : 'w';
    toSide   = dx > 0 ? 'w' : 'e';
  } else {
    fromSide = dy > 0 ? 's' : 'n';
    toSide   = dy > 0 ? 'n' : 's';
  }
  return { fromSide, toSide };
}

/* ─── Bezier control points ─────────────────────────────────────────────── */
function _dgBezierCtrl(x, y, side) {
  const d = 80;
  return {
    cx: x + (side === 'e' ? d : side === 'w' ? -d : 0),
    cy: y + (side === 's' ? d : side === 'n' ? -d : 0)
  };
}

/* ─── Shape element ─────────────────────────────────────────────────────── */
function _dgShapeEl(n) {
  const { type, w, h, fill, stroke, strokeW } = n;
  const sa = { fill, stroke, 'stroke-width': strokeW };
  let el;
  switch(type) {
    case 'rect':
      el = _svgEl('rect', { x:-w/2, y:-h/2, width:w, height:h, rx:0, ...sa }); break;
    case 'rounded':
      el = _svgEl('rect', { x:-w/2, y:-h/2, width:w, height:h, rx:10, ...sa }); break;
    case 'diamond':
      el = _svgEl('polygon', { points:`0,${-h/2} ${w/2},0 0,${h/2} ${-w/2},0`, ...sa }); break;
    case 'circle':
      el = _svgEl('ellipse', { cx:0, cy:0, rx:w/2, ry:h/2, ...sa }); break;
    case 'parallelogram': {
      const sk = 15;
      el = _svgEl('polygon', {
        points:`${-w/2+sk},${-h/2} ${w/2},${-h/2} ${w/2-sk},${h/2} ${-w/2},${h/2}`, ...sa }); break;
    }
    case 'hexagon': {
      const hx = w * 0.15;
      el = _svgEl('polygon', {
        points:`${-w/2+hx},${-h/2} ${w/2-hx},${-h/2} ${w/2},0 ${w/2-hx},${h/2} ${-w/2+hx},${h/2} ${-w/2},0`,
        ...sa }); break;
    }
    case 'text':
      el = _svgEl('rect', { x:-w/2, y:-h/2, width:w, height:h, fill:'transparent', stroke:'none' }); break;
    case 'cylinder': {
      const g = _svgEl('g');
      const body = _svgEl('rect', { x:-w/2, y:-h/2+8, width:w, height:h-8, ...sa });
      const topCap = _svgEl('ellipse', { cx:0, cy:-h/2+8, rx:w/2, ry:8, ...sa });
      const botCap = _svgEl('ellipse', { cx:0, cy:h/2,    rx:w/2, ry:8, ...sa, opacity:0.5 });
      g.appendChild(body); g.appendChild(topCap); g.appendChild(botCap);
      return g;
    }
    default:
      el = _svgEl('rect', { x:-w/2, y:-h/2, width:w, height:h, rx:0, ...sa });
  }
  return el;
}

/* ─── Render node ───────────────────────────────────────────────────────── */
function _dgRenderNode(n, layer) {
  const g = _svgEl('g', {
    class: 'dg-node' + (_dgSel === n.id ? ' dg-node-sel' : ''),
    'data-id': n.id,
    transform: `translate(${n.x},${n.y})`
  });
  g.style.cursor = 'move';

  // Shape
  g.appendChild(_dgShapeEl(n));

  // Text via foreignObject
  const fo = _svgEl('foreignObject', {
    x: -n.w/2, y: -n.h/2, width: n.w, height: n.h,
    style: 'pointer-events:none; overflow:visible;'
  });
  const div = document.createElement('div');
  div.className = 'dg-fo-div';
  div.id = `dg-fo-${n.id}`;
  div.setAttribute('data-id', n.id);
  div.style.cssText = [
    'width:100%', 'height:100%', 'display:flex', 'align-items:center',
    'justify-content:center', 'text-align:center',
    `font-size:${n.fontSize || 14}px`,
    `color:${n.textColor || '#1e293b'}`,
    `font-weight:${n.fontWeight || 600}`,
    'padding:4px', 'pointer-events:none', 'overflow:hidden',
    'box-sizing:border-box', 'line-height:1.3', 'word-break:break-word'
  ].join(';');
  div.innerHTML = _dgEsc(n.text || '');
  fo.appendChild(div);
  g.appendChild(fo);

  const isSel = _dgSel === n.id;

  // Connection points (always present, hidden unless hovered/selected)
  const sides = [
    { s:'n', cx:0,      cy:-n.h/2 },
    { s:'s', cx:0,      cy: n.h/2 },
    { s:'e', cx: n.w/2, cy:0 },
    { s:'w', cx:-n.w/2, cy:0 }
  ];
  sides.forEach(({ s, cx, cy }) => {
    const cp = _svgEl('circle', {
      class: 'dg-cp', 'data-side': s, 'data-id': n.id,
      cx, cy, r: isSel ? 6 : 5,
      fill: '#3b82f6', stroke: '#fff', 'stroke-width': 2,
      style: `cursor:crosshair; opacity:${isSel ? 0.85 : 0}; pointer-events:${isSel ? 'all' : 'none'};`,
      'data-nodeid': n.id
    });
    g.appendChild(cp);
  });

  // Selection ring + resize handles
  if (isSel) {
    const ring = _svgEl('rect', {
      class: 'dg-sel-ring',
      x: -n.w/2 - 4, y: -n.h/2 - 4,
      width: n.w + 8, height: n.h + 8,
      fill: 'none', stroke: '#3b82f6',
      'stroke-width': 1.5, 'stroke-dasharray': '5,3', rx: 3
    });
    ring.style.pointerEvents = 'none';
    g.appendChild(ring);

    const cursors = { nw:'nw-resize', n:'n-resize', ne:'ne-resize', e:'e-resize',
                      se:'se-resize', s:'s-resize', sw:'sw-resize', w:'w-resize' };
    const handles = [
      { dir:'nw', hx:-n.w/2-4, hy:-n.h/2-4 },
      { dir:'n',  hx:-4,       hy:-n.h/2-4 },
      { dir:'ne', hx: n.w/2-4, hy:-n.h/2-4 },
      { dir:'e',  hx: n.w/2-4, hy:-4 },
      { dir:'se', hx: n.w/2-4, hy: n.h/2-4 },
      { dir:'s',  hx:-4,       hy: n.h/2-4 },
      { dir:'sw', hx:-n.w/2-4, hy: n.h/2-4 },
      { dir:'w',  hx:-n.w/2-4, hy:-4 }
    ];
    handles.forEach(({ dir, hx, hy }) => {
      const rh = _svgEl('rect', {
        class: 'dg-rh', 'data-dir': dir, 'data-id': n.id,
        x: hx, y: hy, width: 8, height: 8,
        fill: '#fff', stroke: '#3b82f6', 'stroke-width': 1.5, rx: 2,
        style: `cursor:${cursors[dir]}`
      });
      g.appendChild(rh);
    });
  }

  layer.appendChild(g);

  // Enable hover connection points via pointer-events when not editing
  g.addEventListener('mouseenter', () => {
    g.querySelectorAll('.dg-cp').forEach(cp => {
      cp.style.opacity = '0.75';
      cp.style.pointerEvents = 'all';
    });
  });
  g.addEventListener('mouseleave', () => {
    if (_dgSel !== n.id) {
      g.querySelectorAll('.dg-cp').forEach(cp => {
        cp.style.opacity = '0';
        cp.style.pointerEvents = 'none';
      });
    }
  });
}

/* ─── Render edge ───────────────────────────────────────────────────────── */
function _dgRenderEdge(e, layer) {
  const fromNode = _dgNodes.find(n => n.id === e.fromId);
  const toNode   = _dgNodes.find(n => n.id === e.toId);
  if (!fromNode || !toNode) return;

  const { fromSide, toSide } = _dgClosestSides(fromNode, toNode);
  const p1 = _dgGetNodeSidePoint(fromNode, fromSide);
  const p2 = _dgGetNodeSidePoint(toNode, toSide);
  const c1 = _dgBezierCtrl(p1.x, p1.y, fromSide);
  const c2 = _dgBezierCtrl(p2.x, p2.y, toSide);

  const path = `M${p1.x},${p1.y} C${c1.cx},${c1.cy} ${c2.cx},${c2.cy} ${p2.x},${p2.y}`;
  const isSel = _dgSel === e.id;

  const g = _svgEl('g', { class: 'dg-edge', 'data-id': e.id });

  // Hit area
  const hit = _svgEl('path', {
    d: path, fill: 'none', stroke: 'transparent', 'stroke-width': 12,
    style: 'cursor:pointer'
  });
  g.appendChild(hit);

  // Visible path
  const line = _svgEl('path', {
    d: path, fill: 'none',
    stroke: isSel ? '#3b82f6' : (e.color || '#64748b'),
    'stroke-width': e.strokeW || 1.5,
    'marker-end': `url(#dg-arr-${e.id})`,
    style: 'pointer-events:none'
  });
  if (isSel) line.setAttribute('stroke-dasharray', '6,3');
  g.appendChild(line);

  // Label
  if (e.label) {
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const bg = _svgEl('rect', {
      x: mx - 28, y: my - 10, width: 56, height: 20,
      fill: '#fff', rx: 4, 'stroke': '#e2e8f0', 'stroke-width': 1
    });
    const txt = _svgEl('text', {
      x: mx, y: my + 4,
      'text-anchor': 'middle', 'font-size': 11,
      fill: '#475569', style: 'pointer-events:none; font-family:inherit;'
    });
    txt.textContent = e.label;
    g.appendChild(bg);
    g.appendChild(txt);
  }

  layer.appendChild(g);
}

/* ─── Node CRUD ─────────────────────────────────────────────────────────── */
const _dgDefaultSizes = {
  rect:          { w:140, h:70 },
  rounded:       { w:140, h:70 },
  diamond:       { w:120, h:80 },
  circle:        { w:90,  h:90 },
  parallelogram: { w:140, h:70 },
  hexagon:       { w:140, h:70 },
  text:          { w:160, h:50 },
  cylinder:      { w:140, h:70 }
};

const _dgDefaultLabels = {
  rect:'Rectangle', rounded:'Arrondi', diamond:'Décision',
  circle:'Cercle', parallelogram:'Parallélogramme', hexagon:'Hexagone',
  text:'Texte', cylinder:'Cylindre'
};

function dgAddNode(type, wx, wy) {
  const sz = _dgDefaultSizes[type] || { w:140, h:70 };
  const node = {
    id:        _uid('n'),
    type:      type || 'rect',
    x:         wx != null ? wx : 200 + Math.random()*40,
    y:         wy != null ? wy : 200 + Math.random()*40,
    w:         sz.w, h: sz.h,
    text:      _dgDefaultLabels[type] || type,
    fill:      '#ffffff',
    stroke:    '#334155',
    textColor: '#1e293b',
    strokeW:   2,
    fontSize:  14,
    fontWeight:600
  };
  _dgNodes.push(node);
  _dgSel = node.id;
  _dgRender();
  _dgSave();
  setTimeout(() => _dgStartEdit(node.id), 60);
}

function _dgDeleteSelected() {
  if (!_dgSel) return;
  // Is it a node?
  const ni = _dgNodes.findIndex(n => n.id === _dgSel);
  if (ni >= 0) {
    _dgNodes.splice(ni, 1);
    _dgEdges = _dgEdges.filter(e => e.fromId !== _dgSel && e.toId !== _dgSel);
  } else {
    const ei = _dgEdges.findIndex(e => e.id === _dgSel);
    if (ei >= 0) _dgEdges.splice(ei, 1);
  }
  _dgSel = null;
  _dgRender();
  _dgSave();
}

/* ─── Edge CRUD ─────────────────────────────────────────────────────────── */
function _dgAddEdge(fromId, toId) {
  if (fromId === toId) return;
  // Avoid duplicates
  if (_dgEdges.some(e => e.fromId === fromId && e.toId === toId)) return;
  const edge = {
    id:      _uid('e'),
    fromId,  toId,
    label:   '',
    color:   '#64748b',
    strokeW: 1.5
  };
  _dgEdges.push(edge);
  _dgSel = edge.id;
  _dgRender();
  _dgSave();
}

/* ─── Selection ─────────────────────────────────────────────────────────── */
function _dgSelect(id) {
  _dgSel = id;
  _dgRender();
}

/* ─── Toolbar ───────────────────────────────────────────────────────────── */
function _dgUpdateToolbar() {
  const bar = document.getElementById('dg-style-bar');
  if (!bar) return;
  const node = _dgNodes.find(n => n.id === _dgSel);
  const edge = _dgEdges.find(e => e.id === _dgSel);
  if (!node && !edge) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';

  // Fill swatches
  const fillSwatches = bar.querySelectorAll('[data-fill]');
  fillSwatches.forEach(sw => {
    sw.classList.toggle('dg-swatch-active', node && sw.dataset.fill === node.fill);
  });

  // Stroke swatches
  const strokeSwatches = bar.querySelectorAll('[data-stroke]');
  strokeSwatches.forEach(sw => {
    const val = node ? node.stroke : (edge ? edge.color : null);
    sw.classList.toggle('dg-swatch-active', sw.dataset.stroke === val);
  });

  // Font size
  const fsInput = bar.querySelector('#dg-fs-input');
  if (fsInput && node) fsInput.value = node.fontSize || 14;

  // Bold
  const boldBtn = bar.querySelector('#dg-bold-btn');
  if (boldBtn && node) boldBtn.classList.toggle('active', (node.fontWeight || 600) >= 700);
}

function dgSetFill(color) {
  const node = _dgNodes.find(n => n.id === _dgSel);
  if (!node) return;
  node.fill = color;
  _dgRender(); _dgSave();
}

function dgSetStroke(color) {
  const node = _dgNodes.find(n => n.id === _dgSel);
  if (node) { node.stroke = color; _dgRender(); _dgSave(); return; }
  const edge = _dgEdges.find(e => e.id === _dgSel);
  if (edge) { edge.color = color; _dgRender(); _dgSave(); }
}

function dgSetFontSize(v) {
  const node = _dgNodes.find(n => n.id === _dgSel);
  if (!node) return;
  node.fontSize = Math.max(8, Math.min(72, parseInt(v) || 14));
  _dgRender(); _dgSave();
}

function dgToggleBold() {
  const node = _dgNodes.find(n => n.id === _dgSel);
  if (!node) return;
  node.fontWeight = (node.fontWeight || 600) >= 700 ? 400 : 700;
  _dgRender(); _dgSave();
}

/* ─── Inline edit ───────────────────────────────────────────────────────── */
function _dgStartEdit(id) {
  const div = document.getElementById(`dg-fo-${id}`);
  if (!div) return;
  _dgEditId = id;
  div.style.pointerEvents = 'all';
  div.setAttribute('contenteditable', 'true');
  div.focus();
  // Select all text
  const range = document.createRange();
  range.selectNodeContents(div);
  const sel = window.getSelection();
  if (sel) { sel.removeAllRanges(); sel.addRange(range); }

  const finish = (cancel) => {
    div.removeAttribute('contenteditable');
    div.style.pointerEvents = 'none';
    if (!cancel) {
      const node = _dgNodes.find(n => n.id === id);
      if (node) {
        node.text = div.innerText.trim();
        _dgSave();
      }
    }
    _dgEditId = null;
    _dgRender();
  };

  div.addEventListener('blur', () => finish(false), { once: true });
  div.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); div.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); finish(true); }
    e.stopPropagation();
  });
}

/* ─── Drop (palette drag) ───────────────────────────────────────────────── */
function _dgDrop(e) {
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain');
  if (!type) return;
  const w = _dgToWorld(e.clientX, e.clientY);
  dgAddNode(type, w.x, w.y);
}

/* ─── Mouse events ──────────────────────────────────────────────────────── */
function _dgMouseDown(e) {
  if (_dgEditId) return; // Let the edit div handle its own events

  const target = e.target;

  // Resize handle?
  const rh = target.closest('.dg-rh');
  if (rh) {
    const id  = rh.dataset.id || rh.closest('[data-id]')?.dataset.id;
    const dir = rh.dataset.dir;
    const node = _dgNodes.find(n => n.id === id);
    if (node) {
      _dgDragState = {
        type: 'resize', id, dir,
        sx: e.clientX, sy: e.clientY,
        origX: node.x, origY: node.y,
        origW: node.w, origH: node.h
      };
      e.preventDefault(); return;
    }
  }

  // Connection point?
  const cp = target.closest('.dg-cp');
  if (cp) {
    const nodeId = cp.dataset.nodeid || cp.dataset.id;
    const side   = cp.dataset.side;
    const node   = _dgNodes.find(n => n.id === nodeId);
    if (node) {
      const pt = _dgGetNodeSidePoint(node, side);
      const sc = _dgToScreen(pt.x, pt.y); // but we track in SVG root space
      const svg = document.getElementById('dg-svg');
      const rect = svg ? svg.getBoundingClientRect() : { left:0, top:0 };
      const startX = pt.x * _dgScale + _dgOx;
      const startY = pt.y * _dgScale + _dgOy;
      _dgDragState = {
        type: 'connect', fromId: nodeId, fromSide: side,
        startSvgX: startX, startSvgY: startY,
        sx: e.clientX, sy: e.clientY
      };
      e.preventDefault(); return;
    }
  }

  // Node body?
  const nodeEl = target.closest('.dg-node');
  if (nodeEl) {
    const id = nodeEl.dataset.id;
    if (id) {
      if (_dgSel === id) {
        // second click → start edit
        _dgDragState = {
          type: 'move-check-edit', id,
          sx: e.clientX, sy: e.clientY, moved: false,
          origX: _dgNodes.find(n=>n.id===id)?.x,
          origY: _dgNodes.find(n=>n.id===id)?.y
        };
      } else {
        _dgSelect(id);
        const node = _dgNodes.find(n => n.id === id);
        if (node) {
          _dgDragState = {
            type: 'move', id,
            sx: e.clientX, sy: e.clientY, moved: false,
            origX: node.x, origY: node.y
          };
        }
      }
      e.preventDefault(); return;
    }
  }

  // Edge?
  const edgeEl = target.closest('.dg-edge');
  if (edgeEl) {
    _dgSelect(edgeEl.dataset.id);
    e.preventDefault(); return;
  }

  // Background → deselect + pan
  const isBg = target.id === 'dg-bg-rect' || target.id === 'dg-svg' || target === document.getElementById('dg-vp');
  if (isBg || !target.closest('.dg-node') && !target.closest('.dg-edge')) {
    _dgSelect(null);
    _dgDragState = { type: 'pan', sx: e.clientX, sy: e.clientY, origOx: _dgOx, origOy: _dgOy };
  }
}

function _dgMouseMove(e) {
  const ds = _dgDragState;
  if (!ds) return;
  const dx = e.clientX - ds.sx;
  const dy = e.clientY - ds.sy;

  if (ds.type === 'pan') {
    _dgOx = ds.origOx + dx;
    _dgOy = ds.origOy + dy;
    _dgApplyTransform();
    return;
  }

  if (ds.type === 'move' || ds.type === 'move-check-edit') {
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      ds.moved = true;
      ds.type = 'move'; // no longer potential edit
    }
    if (ds.moved) {
      const node = _dgNodes.find(n => n.id === ds.id);
      if (node) {
        node.x = ds.origX + dx / _dgScale;
        node.y = ds.origY + dy / _dgScale;
        _dgRender();
      }
    }
    return;
  }

  if (ds.type === 'resize') {
    const node = _dgNodes.find(n => n.id === ds.id);
    if (!node) return;
    const wdx = dx / _dgScale, wdy = dy / _dgScale;
    const dir = ds.dir;
    let { origX, origY, origW, origH } = ds;
    let nx = origX, ny = origY, nw = origW, nh = origH;

    if (dir.includes('e')) { nw = Math.max(60, origW + wdx); }
    if (dir.includes('w')) { nw = Math.max(60, origW - wdx); nx = origX + (origW - nw); }
    if (dir.includes('s')) { nh = Math.max(40, origH + wdy); }
    if (dir.includes('n')) { nh = Math.max(40, origH - wdy); ny = origY + (origH - nh); }

    node.x = nx; node.y = ny; node.w = nw; node.h = nh;
    _dgRender();
    return;
  }

  if (ds.type === 'connect') {
    const svg = document.getElementById('dg-svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ex = e.clientX - rect.left;
    const ey = e.clientY - rect.top;
    const tempLayer = document.getElementById('dg-temp-layer');
    if (!tempLayer) return;
    tempLayer.innerHTML = '';
    const path = _svgEl('path', {
      d: `M${ds.startSvgX},${ds.startSvgY} L${ex},${ey}`,
      fill: 'none', stroke: '#3b82f6', 'stroke-width': 2,
      'stroke-dasharray': '6,3', style: 'pointer-events:none'
    });
    tempLayer.appendChild(path);
  }
}

function _dgMouseUp(e) {
  const ds = _dgDragState;
  _dgDragState = null;

  const tempLayer = document.getElementById('dg-temp-layer');
  if (tempLayer) tempLayer.innerHTML = '';

  if (!ds) return;

  if (ds.type === 'move') {
    if (ds.moved) { _dgSave(); return; }
  }

  if (ds.type === 'move-check-edit') {
    if (!ds.moved) {
      // same node clicked again → edit
      setTimeout(() => _dgStartEdit(ds.id), 10);
    }
    return;
  }

  if (ds.type === 'resize') {
    _dgSave(); return;
  }

  if (ds.type === 'connect') {
    // Hit test: find node under cursor (not same as source)
    const w = _dgToWorld(e.clientX, e.clientY);
    const target = _dgNodes.find(n => {
      if (n.id === ds.fromId) return false;
      return w.x >= n.x - n.w/2 && w.x <= n.x + n.w/2 &&
             w.y >= n.y - n.h/2 && w.y <= n.y + n.h/2;
    });
    if (target) _dgAddEdge(ds.fromId, target.id);
  }
}

/* ─── Keyboard ──────────────────────────────────────────────────────────── */
function _dgKeydown(e) {
  // Only when diagram editor is active
  const screen = document.getElementById('screen-diagram-editor');
  if (!screen || screen.style.display === 'none' || screen.classList.contains('hidden')) return;
  if (_dgId === null) return;

  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    _dgDeleteSelected();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    _dgSelect(null);
    e.preventDefault();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault(); // no select-all in diagram
  }
}

/* ─── Diagram rename ────────────────────────────────────────────────────── */
function dgRenamePrompt() {
  const d = diagrams.find(x => x.id === _dgId);
  if (!d) return;
  const name = prompt('Renommer le diagramme :', d.name);
  if (name && name.trim()) {
    d.name = name.trim();
    _dgSaveAll();
    const titleEl = document.getElementById('dg-title');
    if (titleEl) titleEl.textContent = d.name;
    renderDiagramHub && renderDiagramHub();
  }
}

/* ─── Export SVG ────────────────────────────────────────────────────────── */
function dgExportSVG() {
  const svgEl = document.getElementById('dg-svg');
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  // Remove temp layer, selection rings, resize handles
  clone.querySelectorAll('#dg-temp-layer, .dg-sel-ring, .dg-rh, .dg-cp').forEach(el => el.remove());
  const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = diagrams.find(x => x.id === _dgId);
  a.download = (d ? d.name.replace(/[^a-z0-9]/gi,'_') : 'diagram') + '.svg';
  a.click();
  URL.revokeObjectURL(a.href);
  if (typeof showNotif === 'function') showNotif('SVG exporté !', 'success');
}

/* ─── Clear canvas ──────────────────────────────────────────────────────── */
function dgClearCanvas() {
  if (typeof showConfirm === 'function') {
    showConfirm('Vider le canvas ?', 'Tous les nœuds et liens seront supprimés.', 'Vider', () => {
      _dgNodes = []; _dgEdges = []; _dgSel = null;
      _dgRender(); _dgSave();
    });
  } else {
    if (!confirm('Vider le canvas ?')) return;
    _dgNodes = []; _dgEdges = []; _dgSel = null;
    _dgRender(); _dgSave();
  }
}
