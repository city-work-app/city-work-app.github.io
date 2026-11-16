/* ════════════════════════════════════════════════════════════════════════
   Kiné+ — Cartes mentales v4 · compléments
   Modèles kiné, import (fiche de cours, QCM, plan collé), export PNG,
   miniatures de l'accueil, migration des anciennes cartes (lmm_maps_v3).
   Dépend de js/mindmap.js (objet global KM).
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const KM = window.KM = window.KM || {};
const esc = s => KM.esc(s);

/* ───────────────────────── Modèles kiné ───────────────────────── */
KM.TEMPLATES = [
  { id: 'muscle', name: 'Muscle', icon: 'fitness_center', color: '#e5486b', desc: 'Origine, terminaison, innervation, action…',
    tree: { t: 'Nom du muscle', kids: [
      { t: 'Origine (insertion proximale)' }, { t: 'Terminaison (insertion distale)' }, { t: 'Trajet & rapports' },
      { t: 'Innervation', kids: [{ t: 'Nerf' }, { t: 'Racines' }] }, { t: 'Vascularisation' },
      { t: 'Action(s)', kids: [{ t: 'Chaîne ouverte' }, { t: 'Chaîne fermée' }] }, { t: 'Palpation' },
      { t: 'Testing & tests cliniques' }, { t: 'Pathologies & rééducation' }] } },
  { id: 'articulation', name: 'Articulation', icon: 'accessibility_new', color: '#2f80ed', desc: 'Surfaces, moyens d’union, mouvements…',
    tree: { t: 'Articulation', kids: [
      { t: 'Classification', kids: [{ t: 'Type' }, { t: 'Degrés de liberté' }] }, { t: 'Surfaces articulaires' },
      { t: 'Moyens d’union', kids: [{ t: 'Capsule' }, { t: 'Ligaments' }, { t: 'Fibrocartilage / labrum' }] },
      { t: 'Muscles moteurs' }, { t: 'Mouvements & amplitudes', kids: [{ t: 'Flexion / extension' }, { t: 'Abduction / adduction' }, { t: 'Rotations' }] },
      { t: 'Biomécanique' }, { t: 'Position de verrouillage' }, { t: 'Pathologies fréquentes' }] } },
  { id: 'patho', name: 'Pathologie', icon: 'healing', color: '#f2711c', desc: 'Définition, clinique, bilan, rééducation…',
    tree: { t: 'Pathologie', kids: [
      { t: 'Définition' }, { t: 'Épidémiologie' }, { t: 'Étiologie & facteurs de risque' }, { t: 'Physiopathologie' },
      { t: 'Signes cliniques', kids: [{ t: 'Symptômes' }, { t: 'Signes à l’examen' }] }, { t: 'Examens complémentaires' },
      { t: 'Diagnostic différentiel' }, { t: 'Traitement médical / chirurgical' },
      { t: 'Rééducation', kids: [{ t: 'Objectifs' }, { t: 'Moyens' }, { t: 'Précautions & contre-indications' }] }, { t: 'Évolution & pronostic' }] } },
  { id: 'bdk', name: 'Bilan kiné', icon: 'assignment', color: '#1fa463', desc: 'Anamnèse, bilans, diagnostic kiné, objectifs…',
    tree: { t: 'Bilan diagnostic kiné', kids: [
      { t: 'Anamnèse', kids: [{ t: 'Motif de consultation' }, { t: 'Antécédents' }, { t: 'Mode de vie & attentes' }] },
      { t: 'Douleur', kids: [{ t: 'EVA / EN' }, { t: 'Type & horaire' }, { t: 'Localisation' }] },
      { t: 'Bilan morphostatique' }, { t: 'Bilan cutané & trophique' }, { t: 'Bilan articulaire', kids: [{ t: 'Goniométrie' }] },
      { t: 'Bilan musculaire', kids: [{ t: 'Testing' }, { t: 'Extensibilité' }] }, { t: 'Bilan neurologique' },
      { t: 'Bilan fonctionnel', kids: [{ t: 'Échelles & scores' }] },
      { t: 'Diagnostic kiné (CIF)', kids: [{ t: 'Déficiences' }, { t: 'Limitations d’activité' }, { t: 'Restrictions de participation' }] },
      { t: 'Objectifs' }, { t: 'Plan de traitement' }] } },
  { id: 'nerf', name: 'Nerf', icon: 'electric_bolt', color: '#e0a000', desc: 'Origine, trajet, territoires, lésions…',
    tree: { t: 'Nerf', kids: [
      { t: 'Origine (racines, plexus)' }, { t: 'Trajet & rapports' }, { t: 'Branches collatérales' }, { t: 'Branches terminales' },
      { t: 'Territoire moteur' }, { t: 'Territoire sensitif' }, { t: 'Lésions', kids: [{ t: 'Causes' }, { t: 'Signes cliniques' }, { t: 'Tests' }] }] } },
  { id: 'cours', name: 'Plan de cours', icon: 'menu_book', color: '#9b51e0', desc: 'Parties, notions clés, à retenir…',
    tree: { t: 'Titre du cours', kids: [
      { t: 'Introduction' }, { t: 'Partie I', kids: [{ t: 'Notion clé' }, { t: 'Notion clé' }] },
      { t: 'Partie II', kids: [{ t: 'Notion clé' }, { t: 'Notion clé' }] }, { t: 'Partie III' },
      { t: 'À retenir' }, { t: 'Questions d’examen' }] } }
];

/* ───────────────────────── Plan texte → arbre ───────────────────────── */
function clean(s) {
  return String(s)
    .replace(/^\[( |x|X)\]\s*/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
// Renvoie une forêt [{t, kids:[], note}] ; o.notes : les longs paragraphes deviennent des notes
KM.parseOutline = function (text, o) {
  o = o || {};
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const ind = [];
  for (const l of lines) { if (!l.trim()) continue; const n = l.replace(/\t/g, '    ').match(/^ */)[0].length; if (n) ind.push(n); }
  const unit = ind.length ? Math.max(2, Math.min(...ind)) : 2;
  const entries = [];
  let hl = -1, code = false;
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    '), s0 = line.trim();
    if (/^(```|~~~)/.test(s0)) { code = !code; continue; }
    if (code || !s0) continue;
    if (/^([-*_=]\s*){3,}$/.test(s0)) continue;
    const lv = Math.round(line.match(/^ */)[0].length / unit);
    let s = s0, lvl, kind = 'p', m;
    if (/^\|/.test(s0)) {
      if (/^\|?\s*:?-{2,}/.test(s0.replace(/^\|/, ''))) continue;
      s = s0.split('|').map(c => c.trim()).filter(Boolean).join(' · ');
      lvl = hl + 1; kind = 'b';
    } else if ((m = s.match(/^(#{1,6})\s+(.*)$/))) { lvl = m[1].length - 1; hl = lvl; s = m[2]; kind = 'h'; }
    else if ((m = s.match(/^(\d+(?:\.\d+)+)\.?\s+(.*)$/))) { lvl = hl + 1 + m[1].split('.').length - 1 + lv; s = m[2]; kind = 'b'; }
    else if ((m = s.match(/^(?:[-*+•·▪◦‣–—>✓✔→]|\d{1,3}[.)]|[a-zA-Z][.)]|[IVXLCivxlc]{1,6}[.)])\s+(.*)$/))) { lvl = hl + 1 + lv; s = m[1]; kind = 'b'; }
    else lvl = hl + 1 + lv;
    s = clean(s);
    if (!s) continue;
    if (o.notes && kind === 'p' && s.length > 90 && entries.length) {
      const last = entries[entries.length - 1];
      last.note = (last.note ? last.note + '\n' : '') + s;
      continue;
    }
    entries.push({ lvl: Math.max(0, lvl), t: s.length > 300 ? s.slice(0, 297) + '…' : s });
  }
  const roots = [], stack = [];
  for (const e of entries) {
    const node = { t: e.t, kids: [] };
    if (e.note) node.note = e.note;
    while (stack.length && stack[stack.length - 1].lvl >= e.lvl) stack.pop();
    if (stack.length) stack[stack.length - 1].node.kids.push(node); else roots.push(node);
    stack.push({ lvl: e.lvl, node });
  }
  return roots;
};
KM.forestToTree = function (forest, title) {
  if (!forest || !forest.length) return { t: title || 'Plan', kids: [] };
  if (forest.length === 1) return forest[0];
  return { t: title || 'Plan', kids: forest };
};
const countNodes = t => 1 + (t.kids || []).reduce((a, k) => a + countNodes(k), 0);

// Arbre → éléments de carte (sujet central au point cx, cy)
KM.treeToItems = function (tree, cx, cy, o) {
  o = o || {};
  const lay = o.lay || tree.lay || 'map', items = [];
  const root = { id: KM.uid(), k: 'node', p: null, x: cx, y: cy, t: tree.t || 'Sujet', lay };
  if (tree.note) root.note = tree.note;
  items.push(root);
  const weight = n => 1 + (n.kids || []).reduce((a, k) => a + weight(k), 0);
  const ks = tree.kids || [], tot = ks.reduce((a, k) => a + weight(k), 0);
  let acc = 0;
  const add = (n, pid, ord, side, c) => {
    const it = { id: KM.uid(), k: 'node', p: pid, o: ord, t: String(n.t || '') };
    if (side) it.side = side;
    if (c != null) it.c = c;
    if (n.note) it.note = String(n.note);
    items.push(it);
    (n.kids || []).forEach((k, j) => add(k, it.id, j, null, null));
  };
  ks.forEach((k, i) => {
    const side = lay !== 'map' ? 'r' : (i === 0 || acc < tot / 2 ? 'r' : 'l');
    acc += weight(k);
    add(k, root.id, i, side, i % KM.C.BRANCH.length);
  });
  return items;
};
KM.boardFromTree = function (name, tree, o) {
  o = o || {};
  return KM.createBoard(name || tree.t || 'Carte', KM.treeToItems(tree, 0, 0, { lay: tree.lay || o.lay }), o);
};

/* ───────────────────────── Cours → arbre (fiche, sinon QCM) ───────────────────────── */
function short(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function answerOf(q) {
  const a = Array.isArray(q.answers) ? q.answers : [];
  if (Array.isArray(q.correct)) return q.correct.map(i => a[i]).filter(Boolean).join(' / ');
  return a[q.correct] != null ? a[q.correct] : '';
}
KM.courseTree = function (course) {
  let fiche = null;
  try { fiche = typeof getFiche === 'function' ? getFiche(course.id) : null; } catch (e) { fiche = null; }
  if (fiche && fiche.content && String(fiche.content).trim()) {
    const forest = KM.parseOutline(fiche.content, { notes: true });
    let tree;
    if (forest.length === 1 && (forest[0].kids || []).length) tree = forest[0];
    else tree = { t: course.name, kids: forest };
    if (countNodes(tree) > 1) { tree._src = 'Carte créée à partir de la fiche du cours'; return tree; }
  }
  let qs = [];
  try { qs = (typeof questions !== 'undefined' ? questions : []).filter(q => q.courseId === course.id); } catch (e) { qs = []; }
  try { if (typeof boycotted !== 'undefined' && Array.isArray(boycotted)) qs = qs.filter(q => !boycotted.includes(q.id)); } catch (e) { /* rien */ }
  if (qs.length) {
    const max = 40;
    const tree = { t: course.name, kids: qs.slice(0, max).map(q => {
      const ans = answerOf(q), n = { t: short(q.question, 130), kids: ans ? [{ t: short(ans, 170) }] : [] };
      if (q.expl) n.note = short(q.expl, 1500);
      return n;
    }) };
    tree._src = 'Carte créée à partir des QCM du cours' + (qs.length > max ? ' (' + max + ' premières questions)' : '') + ' — clique sur « Réviser » pour masquer les réponses';
    return tree;
  }
  return { t: course.name, kids: [], _src: 'Ce cours n’a pas encore de fiche ni de QCM : carte vierge créée' };
};

/* ───────────────────────── Fenêtres de choix ───────────────────────── */
KM.coursePicker = function (onPick) {
  let F = [], Cs = [], Q = [];
  try { F = typeof folders !== 'undefined' ? folders : []; Cs = typeof courses !== 'undefined' ? courses : []; Q = typeof questions !== 'undefined' ? questions : []; } catch (e) { /* rien */ }
  if (!Cs.length) { KM.toast('Tu n’as pas encore de cours : crée-en un dans « Mes matières ».', 'error'); return; }
  const qn = {}; Q.forEach(q => { qn[q.courseId] = (qn[q.courseId] || 0) + 1; });
  const fiche = id => { try { const f = getFiche(id); return !!(f && f.content && String(f.content).trim()); } catch (e) { return false; } };
  const groups = F.map(f => ({ name: f.name, cs: Cs.filter(c => c.folderId === f.id) })).filter(g => g.cs.length);
  const orphan = Cs.filter(c => !F.some(f => f.id === c.folderId));
  if (orphan.length) groups.push({ name: 'Autres cours', cs: orphan });
  const row = c => '<button class="km-crow" data-cid="' + esc(c.id) + '" data-s="' + esc(KM.norm(c.name)) + '"><span class="km-crow-n">' + esc(c.name) + '</span><span class="km-crow-b">' + (fiche(c.id) ? '<i class="f">Fiche</i>' : '') + (qn[c.id] ? '<i>' + qn[c.id] + ' QCM</i>' : '') + '</span></button>';
  KM.dialog({
    title: 'Créer une carte depuis un cours', wide: true,
    html: '<input class="km-in" type="search" placeholder="Rechercher un cours…" aria-label="Rechercher un cours"><div class="km-clist">' +
      groups.map(g => '<div class="km-cgroup"><div class="km-cgh">' + esc(g.name) + '</div>' + g.cs.map(row).join('') + '</div>').join('') +
      '</div><p class="km-dlg-note"><span class="ms">info</span>La carte reprend les titres et les listes de la fiche du cours. Sans fiche, elle est construite avec ses QCM (question → bonne réponse).</p>',
    onMount(w, close) {
      const inp = w.querySelector('input'); setTimeout(() => inp.focus(), 40);
      inp.addEventListener('input', () => {
        const q = KM.norm(inp.value.trim());
        w.querySelectorAll('.km-crow').forEach(r => { r.hidden = !!q && !r.dataset.s.includes(q); });
        w.querySelectorAll('.km-cgroup').forEach(g => { g.hidden = ![...g.querySelectorAll('.km-crow')].some(r => !r.hidden); });
      });
      w.addEventListener('click', e => {
        const b = e.target.closest('[data-cid]'); if (!b) return;
        const c = Cs.find(x => String(x.id) === b.dataset.cid);
        close(); if (c) onPick(c);
      });
    }
  });
};
KM.templatePicker = function (onPick) {
  KM.dialog({
    title: 'Modèles kiné', wide: true,
    html: '<p class="km-dlg-sub">Une structure prête à remplir, ajoutée à côté de ta carte.</p><div class="km-tpls dlg">' +
      KM.TEMPLATES.map(t => '<button class="km-tpl" data-tpl="' + t.id + '" style="--c:' + t.color + '"><span class="ms">' + t.icon + '</span><b>' + esc(t.name) + '</b><small>' + esc(t.desc) + '</small></button>').join('') + '</div>',
    onMount(w, close) {
      w.addEventListener('click', e => {
        const b = e.target.closest('[data-tpl]'); if (!b) return;
        const t = KM.TEMPLATES.find(x => x.id === b.dataset.tpl);
        close(); if (t) onPick(t);
      });
    }
  });
};
KM.pasteDialog = function (onDone) {
  KM.dialog({
    title: 'Importer un plan', wide: true,
    html: '<p class="km-dlg-sub">Colle un plan : titres Markdown (#), listes à puces ou lignes indentées. Chaque niveau devient une branche.</p>' +
      '<textarea class="km-ta mono" rows="11" spellcheck="false" placeholder="Épaule\n  Articulations\n    Gléno-humérale\n    Acromio-claviculaire\n  Muscles\n    Coiffe des rotateurs\n    Deltoïde"></textarea>' +
      '<div class="km-paste-o"><div class="km-seg" role="group" aria-label="Disposition"><button data-lay="map" class="on">Carte</button><button data-lay="right">Arbre</button><button data-lay="down">Organigramme</button></div><span class="km-paste-n"></span></div>',
    foot: '<button class="km-b2 pri" data-k="ok" disabled>Créer la carte</button>',
    onMount(w, close) {
      const ta = w.querySelector('textarea'), ok = w.querySelector('[data-k="ok"]'), cnt = w.querySelector('.km-paste-n');
      let lay = 'map';
      setTimeout(() => ta.focus(), 40);
      const upd = () => {
        const f = KM.parseOutline(ta.value), n = f.reduce((a, t) => a + countNodes(t), 0);
        cnt.textContent = n ? n + ' idée' + (n > 1 ? 's' : '') + ' détectée' + (n > 1 ? 's' : '') : '';
        ok.disabled = !n;
      };
      ta.addEventListener('input', upd);
      w.addEventListener('click', e => {
        const s = e.target.closest('[data-lay]');
        if (s) { lay = s.dataset.lay; w.querySelectorAll('[data-lay]').forEach(b => b.classList.toggle('on', b === s)); return; }
        if (e.target.closest('[data-k="ok"]') && !ok.disabled) {
          const tree = KM.forestToTree(KM.parseOutline(ta.value), 'Plan');
          tree.lay = lay;
          close(); onDone(tree, tree.t);
        }
      });
    }
  });
};

/* ───────────────────────── Plan texte de la carte ───────────────────────── */
const oneLine = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim();
KM.outlineText = function () {
  KM.render();
  const S = KM.state(); if (!S.B) return '';
  const out = [];
  const rec = (n, d) => {
    out.push(d === 0 ? '# ' + oneLine(n.t) : '  '.repeat(d - 1) + '- ' + oneLine(n.t));
    if (n.note) out.push('  '.repeat(Math.max(0, d)) + '> ' + oneLine(n.note));
    S.kids(n.id).forEach(k => rec(k, d + 1));
  };
  S.B.items.filter(i => i.k === 'node' && !i.p).forEach((r, i) => { if (i) out.push(''); rec(r, 0); });
  const notes = S.B.items.filter(i => (i.k === 'sticky' || i.k === 'text' || i.k === 'shape') && i.t);
  if (notes.length) { out.push('', '## Notes'); notes.forEach(n => out.push('- ' + oneLine(n.t))); }
  return out.join('\n');
};

/* ───────────────────────── Miniature (accueil) ───────────────────────── */
const ri = v => Math.round(v);
KM.thumb = function () {
  const S = KM.state(); if (!S.B) return '';
  const box = S.contentBox(); if (!box) return '';
  const pad = Math.max(box.w, box.h) * 0.06 + 12;
  const vb = [box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2].map(ri);
  const u = Math.max(vb[2], vb[3]) / 300;               // unités monde par pixel de miniature
  const C = KM.C, parts = [];
  const push = s => { if (parts.length < 700) parts.push(s); };
  for (const it of S.B.items) if (it.k === 'frame') push('<rect x="' + ri(it.x) + '" y="' + ri(it.y) + '" width="' + ri(it.w) + '" height="' + ri(it.h) + '" rx="' + ri(8 * u) + '" fill="currentColor" fill-opacity=".05" stroke="currentColor" stroke-opacity=".25" stroke-width="' + ri(u) + '"/>');
  for (const s of S.BRSEG) {
    const d = s.vert ? 'M' + ri(s.x0) + ' ' + ri(s.y0) + 'C' + ri(s.x0) + ' ' + ri((s.y0 + s.y1) / 2) + ' ' + ri(s.x1) + ' ' + ri((s.y0 + s.y1) / 2) + ' ' + ri(s.x1) + ' ' + ri(s.y1)
      : 'M' + ri(s.x0) + ' ' + ri(s.y0) + 'C' + ri((s.x0 + s.x1) / 2) + ' ' + ri(s.y0) + ' ' + ri((s.x0 + s.x1) / 2) + ' ' + ri(s.y1) + ' ' + ri(s.x1) + ' ' + ri(s.y1);
    push('<path d="' + d + '" fill="none" stroke="' + s.c + '" stroke-width="' + Math.max(s.w0 * 0.8, 1.6 * u).toFixed(1) + '" stroke-linecap="round"/>');
  }
  for (const it of S.B.items) {
    if (it.k !== 'line') continue;
    const g = S.LG.get(it.id); if (!g) continue;
    push('<path d="M' + ri(g.A.x) + ' ' + ri(g.A.y) + 'L' + ri(g.B.x) + ' ' + ri(g.B.y) + '" stroke="currentColor" stroke-opacity=".45" stroke-width="' + (1.5 * u).toFixed(1) + '"/>');
  }
  for (const it of S.B.items) {
    const g = S.G.get(it.id);
    if (it.k === 'node' && g) {
      const col = it.p ? (KM.colHex(g.col, C.BRANCH) || C.BRANCH[0]) : (it.c != null ? KM.colHex(it.c, C.BRANCH) : null);
      if (!it.p) push('<rect x="' + ri(g.x) + '" y="' + ri(g.y) + '" width="' + ri(g.w) + '" height="' + ri(g.h) + '" rx="' + ri(Math.min(g.h / 2, 12)) + '" fill="' + (col || 'currentColor') + '"/>');
      else if (g.st === 'line' || g.st === 'plain') {
        push('<rect x="' + ri(g.x + 2) + '" y="' + ri(g.y + g.h * 0.3) + '" width="' + ri(g.w * 0.8) + '" height="' + ri(Math.max(g.h * 0.3, 2 * u)) + '" rx="' + ri(2 * u) + '" fill="currentColor" fill-opacity=".28"/>');
        if (g.st === 'line') push('<path d="M' + ri(g.x) + ' ' + ri(g.y + g.h) + 'H' + ri(g.x + g.w) + '" stroke="' + col + '" stroke-width="' + Math.max(2.4, 1.4 * u).toFixed(1) + '"/>');
      } else push('<rect x="' + ri(g.x) + '" y="' + ri(g.y) + '" width="' + ri(g.w) + '" height="' + ri(g.h) + '" rx="' + ri(g.st === 'pill' ? g.h / 2 : 8) + '" fill="' + col + '" fill-opacity=".2" stroke="' + col + '" stroke-width="' + Math.max(2, 1.2 * u).toFixed(1) + '"/>');
    } else if (it.k === 'sticky') push('<rect x="' + ri(it.x) + '" y="' + ri(it.y) + '" width="' + ri(it.w) + '" height="' + ri(it.h) + '" rx="' + ri(3 * u) + '" fill="' + KM.colHex(it.c || 0, C.STICKY) + '"/>');
    else if (it.k === 'shape') {
      const f = KM.colHex(it.c || 0, C.FILL), s = KM.colHex(it.c || 0, C.FILL_LINE);
      if (it.s === 'ellipse') push('<ellipse cx="' + ri(it.x + it.w / 2) + '" cy="' + ri(it.y + it.h / 2) + '" rx="' + ri(it.w / 2) + '" ry="' + ri(it.h / 2) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + ri(1.2 * u) + '"/>');
      else push('<rect x="' + ri(it.x) + '" y="' + ri(it.y) + '" width="' + ri(it.w) + '" height="' + ri(it.h) + '" rx="' + (it.s === 'round' ? ri(10 * u) : 0) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + ri(1.2 * u) + '"/>');
    } else if (it.k === 'text' && g) push('<rect x="' + ri(g.x) + '" y="' + ri(g.y + g.h * 0.25) + '" width="' + ri(g.w) + '" height="' + ri(g.h * 0.45) + '" rx="' + ri(2 * u) + '" fill="currentColor" fill-opacity=".3"/>');
    else if (it.k === 'img') push('<rect x="' + ri(it.x) + '" y="' + ri(it.y) + '" width="' + ri(it.w) + '" height="' + ri(it.h) + '" fill="currentColor" fill-opacity=".14"/>');
    else if (it.k === 'ink') {
      const p = it.pts, step = Math.max(2, Math.ceil(p.length / 2 / 24)) * 2;
      let d = 'M' + ri(p[0]) + ' ' + ri(p[1]);
      for (let i = step; i < p.length; i += step) d += 'L' + ri(p[i]) + ' ' + ri(p[i + 1]);
      d += 'L' + ri(p[p.length - 2]) + ' ' + ri(p[p.length - 1]);
      const col = it.hl ? KM.colHex(it.c || 0, C.HILITE) : (it.c ? KM.inkHex(it.c) : 'currentColor');
      push('<path d="' + d + '" fill="none" stroke="' + col + '"' + (it.hl ? ' stroke-opacity=".5"' : '') + ' stroke-width="' + Math.max(it.w || 3, 1.5 * u).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"/>');
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '" preserveAspectRatio="xMidYMid meet">' + parts.join('') + '</svg>';
};

/* ───────────────────────── Export PNG ───────────────────────── */
function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      if (!w) continue;
      const test = line + w;
      if (ctx.measureText(test).width <= maxW || !line.trim()) {
        if (ctx.measureText(test).width > maxW && !/\s/.test(w)) {               // mot trop long : on le coupe
          let chunk = line;
          for (const ch of w) { if (ctx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ch; } else chunk += ch; }
          line = chunk;
        } else line = test;
      } else { out.push(line.replace(/\s+$/, '')); line = w.replace(/^\s+/, ''); }
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out;
}
function rrect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
const visible = c => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
function drawText(ctx, host, tEl, ox, oy) {
  const txt = tEl.innerText || tEl.textContent || '';
  if (!txt.trim()) return;
  const ts = getComputedStyle(tEl);
  if (!visible(ts.color)) return;
  const fsz = parseFloat(ts.fontSize) || 14;
  ctx.font = ts.fontStyle + ' ' + ts.fontWeight + ' ' + fsz + 'px ' + ts.fontFamily;
  ctx.fillStyle = ts.color; ctx.textBaseline = 'middle';
  const pl = parseFloat(ts.paddingLeft) || 0, pr = parseFloat(ts.paddingRight) || 0, pt = parseFloat(ts.paddingTop) || 0;
  const lh = parseFloat(ts.lineHeight) || fsz * 1.3;
  const x = ox + tEl.offsetLeft + pl, w = Math.max(10, tEl.clientWidth - pl - pr), y = oy + tEl.offsetTop + pt;
  const align = ts.textAlign === 'center' ? 'center' : ts.textAlign === 'right' || ts.textAlign === 'end' ? 'right' : 'left';
  ctx.textAlign = align;
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  const lines = wrapText(ctx, txt, w + 1);
  const maxLines = Math.max(1, Math.floor((tEl.clientHeight - pt) / lh + 0.2));
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, ax, y + lh * i + lh / 2));
}
KM.exportPNG = function () {
  const S = KM.state(); if (!S.B) return;
  KM.render();
  const box = S.contentBox();
  if (!box) { KM.toast('La carte est vide.', 'error'); return; }
  const pad = 56;
  let scale = 2;
  scale = Math.min(scale, 9000 / (box.w + pad * 2), 9000 / (box.h + pad * 2));
  let W = Math.ceil((box.w + pad * 2) * scale), H = Math.ceil((box.h + pad * 2) * scale);
  if (W * H > 50e6) { const k = Math.sqrt(50e6 / (W * H)); scale *= k; W = Math.ceil(W * k); H = Math.ceil(H * k); }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const app = document.querySelector('.km-app'), acs = getComputedStyle(app);
  const bg = acs.getPropertyValue('--km-bg').trim() || '#f5f6f8';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(scale, 0, 0, scale, (pad - box.x) * scale, (pad - box.y) * scale);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const C = KM.C;
  // 1. cadres
  for (const it of S.B.items) {
    if (it.k !== 'frame') continue;
    const e = S.IEL.get(it.id); if (!e) continue;
    const cs = getComputedStyle(e);
    rrect(ctx, it.x, it.y, it.w, it.h, parseFloat(cs.borderTopLeftRadius) || 10);
    ctx.fillStyle = cs.backgroundColor; ctx.fill();
    ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = parseFloat(cs.borderTopWidth) || 1; ctx.stroke();
    const t = e.querySelector('.km-frame-title');
    if (t && it.t) { const ts = getComputedStyle(t); ctx.font = ts.fontWeight + ' ' + ts.fontSize + ' ' + ts.fontFamily; ctx.fillStyle = ts.color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(it.t, it.x + 2, it.y - 9); }
  }
  // 2. branches
  S.BRANCHES.forEach((d, fill) => { ctx.fillStyle = fill; ctx.fill(new Path2D(d)); });
  (S.BRSTROKES || new Map()).forEach((d, key) => { const [hex, w] = key.split('|'); ctx.strokeStyle = hex; ctx.lineWidth = +w || 2; ctx.stroke(new Path2D(d)); });
  // 3. connecteurs
  const lineCol = acs.getPropertyValue('--km-line').trim() || '#6b7280';
  for (const it of S.B.items) {
    if (it.k !== 'line') continue;
    const g = S.LG.get(it.id); if (!g) continue;
    const col = it.c == null ? lineCol : KM.inkHex(it.c), w = it.w || 2;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w;
    ctx.setLineDash(it.dash ? [w * 3, w * 2.5] : []);
    ctx.stroke(new Path2D(g.d));
    ctx.setLineDash([]);
    if (g.arrows.length) ctx.fill(new Path2D(g.arrows.join('')));
  }
  // 4. éléments
  for (const it of S.B.items) {
    if (it.k === 'ink' || it.k === 'frame') continue;
    const e = S.IEL.get(it.id); if (!e || e.style.display === 'none') continue;
    let x, y, w, h;
    if (it.k === 'line') { const g = S.LG.get(it.id); if (!g) continue; w = e.offsetWidth; h = e.offsetHeight; x = g.mid.x - w / 2; y = g.mid.y - h / 2; }
    else { const g = S.G.get(it.id); if (!g) continue; x = g.x; y = g.y; w = g.w; h = g.h; }
    const cs = getComputedStyle(e);
    if (it.k === 'img') { const im = e.querySelector('img'); try { if (im && im.complete) ctx.drawImage(im, x, y, w, h); } catch (er) { /* rien */ } continue; }
    if (it.k === 'shape' && C.POLY[it.s]) {
      const p = new Path2D(); p.addPath(new Path2D(C.POLY[it.s]), new DOMMatrix([w / 100, 0, 0, h / 100, x, y]));
      ctx.fillStyle = KM.colHex(it.c || 0, C.FILL); ctx.fill(p);
      ctx.strokeStyle = KM.colHex(it.c || 0, C.FILL_LINE); ctx.lineWidth = 1.6; ctx.stroke(p);
    } else {
      const rad = it.k === 'shape' && it.s === 'ellipse' ? -1 : (parseFloat(cs.borderTopLeftRadius) || 0);
      const bgc = cs.backgroundColor, btw = parseFloat(cs.borderTopWidth) || 0, bbw = parseFloat(cs.borderBottomWidth) || 0;
      if (cs.boxShadow && cs.boxShadow !== 'none' && it.k === 'sticky') { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.16)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = bgc; ctx.fillRect(x, y, w, h); ctx.restore(); }
      if (rad < 0) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); } else rrect(ctx, x, y, w, h, rad);
      if (visible(bgc)) { ctx.fillStyle = bgc; ctx.fill(); }
      if (btw > 0 && visible(cs.borderTopColor)) {
        if (rad < 0) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 - btw / 2, h / 2 - btw / 2, 0, 0, Math.PI * 2); } else rrect(ctx, x + btw / 2, y + btw / 2, w - btw, h - btw, Math.max(0, rad - btw / 2));
        ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = btw; ctx.stroke();
      } else if (bbw > 0 && visible(cs.borderBottomColor)) {
        ctx.strokeStyle = cs.borderBottomColor; ctx.lineWidth = bbw; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(x, y + h - bbw / 2); ctx.lineTo(x + w, y + h - bbw / 2); ctx.stroke(); ctx.lineCap = 'round';
      }
    }
    const t = e.querySelector('.km-t');
    if (t) drawText(ctx, e, t, x, y);
  }
  // 5. encre
  for (const it of S.B.items) {
    if (it.k !== 'ink') continue;
    ctx.save();
    ctx.strokeStyle = it.hl ? KM.colHex(it.c || 0, C.HILITE) : (it.c ? KM.inkHex(it.c) : KM.inkHex(0));
    ctx.lineWidth = it.w || 3;
    if (it.hl) { ctx.globalAlpha = 0.42; if (!document.body.classList.contains('dark')) ctx.globalCompositeOperation = 'multiply'; }
    ctx.stroke(new Path2D(S.inkD(it.pts)));
    ctx.restore();
  }
  const name = (S.B.name || 'carte-mentale').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'carte-mentale';
  const done = blob => {
    if (!blob) { KM.toast('Export impossible (carte trop grande ?)', 'error'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    KM.toast('Image exportée : ' + name + '.png');
  };
  try { cv.toBlob(done, 'image/png'); } catch (er) { KM.toast('Export impossible : ' + er.message, 'error'); }
};

/* ───────────────────────── Migration des anciennes cartes ───────────────────────── */
function pathPts(d) {
  const n = (String(d || '').match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number).filter(v => isFinite(v));
  const out = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push(Math.round(n[i] * 10) / 10, Math.round(n[i + 1] * 10) / 10);
  return out;
}
function convertV3(d) {
  if (!d || !Array.isArray(d.nodes)) return [];
  const nodes = d.nodes.filter(n => n && n.id), edges = Array.isArray(d.edges) ? d.edges : [];
  const src = new Map(nodes.map(n => [n.id, n])), ids = new Map(nodes.map(n => [n.id, KM.uid()]));
  const isMM = n => !n.type || n.type === 'mindmap-node';
  const childN = {}; nodes.forEach(n => { if (n.parentId) childN[n.parentId] = (childN[n.parentId] || 0) + 1; });
  const items = [], made = new Set(), px = new Map();
  for (const n of nodes) {
    const x = +n.x || 0, y = +n.y || 0, w = +n.width || 160, h = +n.height || 44, t = String(n.text || ''), id = ids.get(n.id);
    let it = null;
    if (n.type === 'sticky-note') it = { id, k: 'sticky', x, y, w: Math.max(80, w), h: Math.max(80, h), t, c: 0 };
    else if (n.type === 'text-box') { it = { id, k: 'text', x, y, t }; if (w > 60) it.w = w; }
    else if (n.type === 'container') it = { id, k: 'frame', x, y, w: Math.max(60, w), h: Math.max(60, h), t: t || 'Cadre' };
    else if (n.type === 'freehand') { const pts = pathPts(n._path); if (pts.length >= 4) it = { id, k: 'ink', pts, c: 0, w: +n.strokeWidth || 2 }; }
    else {
      const par = n.parentId && src.get(n.parentId);
      if (par && isMM(par)) { it = { id, k: 'node', p: ids.get(par.id), o: y, t }; px.set(id, x + w / 2); }
      else if (!childN[n.id] && ['rect', 'circle', 'diamond'].includes(n.shape)) it = { id, k: 'shape', s: n.shape === 'circle' ? 'ellipse' : n.shape, x, y, w, h, t };
      else it = { id, k: 'node', p: null, x: x + w / 2, y: y + h / 2, t: t || 'Sujet', lay: 'map' };
    }
    if (it) { items.push(it); made.add(id); }
  }
  // branches de premier niveau : côté + couleur
  const roots = new Map(items.filter(i => i.k === 'node' && !i.p).map(r => [r.id, r]));
  const perRoot = {};
  for (const it of items) {
    if (it.k !== 'node' || !it.p) continue;
    if (!made.has(it.p)) { it.p = null; it.x = px.get(it.id) || 0; it.y = it.o || 0; it.lay = 'map'; delete it.o; continue; }
    const r = roots.get(it.p);
    if (r) { it.side = (px.get(it.id) || 0) < r.x ? 'l' : 'r'; perRoot[r.id] = (perRoot[r.id] || 0) + 1; it.c = (perRoot[r.id] - 1) % KM.C.BRANCH.length; }
  }
  for (const e of edges) {
    const s = src.get(e.sourceNodeId), t = src.get(e.targetNodeId);
    if (!s || !t || t.parentId === s.id) continue;
    const a = ids.get(s.id), b = ids.get(t.id);
    if (!made.has(a) || !made.has(b)) continue;
    const ln = { id: KM.uid(), k: 'line', a: { id: a }, b: { id: b }, st: e.lineStyle === 'orthogonal' ? 'elbow' : e.lineStyle === 'straight' ? 'straight' : 'curve', w: 2, eb: e.arrowEnd === 'none' ? 0 : 1 };
    if (e.label) ln.t = String(e.label);
    items.push(ln);
  }
  return items;
}
KM.migrate = function () {
  const out = [];
  const add = (name, items, created, updated) => {
    if (!items.length) return;
    const id = KM.uid();
    if (!KM.writeJSON('kcu_map_' + id, { v: 4, items, view: null })) return;
    out.push({ id, name: name || 'Carte', created: created || Date.now(), updated: updated || created || Date.now(), n: items.filter(i => i.k === 'node').length, th: '' });
  };
  const v3 = KM.readJSON('lmm_maps_v3', null);
  if (v3 && typeof v3 === 'object') {
    for (const m of Object.values(v3)) {
      try { const d = typeof m.data === 'string' ? JSON.parse(m.data) : m.data; add(m.title, convertV3(d), m.created, m.modified); }
      catch (e) { console.warn('[cartes] migration v3', e); }
    }
  }
  const old = KM.readJSON('kcu_mm', null);
  if (Array.isArray(old)) {
    for (const m of old) {
      try { if (m && Array.isArray(m.nodes)) add(m.title || m.name, convertV3({ nodes: m.nodes, edges: m.edges }), m.created, m.modified || m.updated); }
      catch (e) { console.warn('[cartes] migration kcu_mm', e); }
    }
  }
  out.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return out;
};
})();
