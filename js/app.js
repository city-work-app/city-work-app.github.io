/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  app.js — Kiné+ Application Bootstrap & Glue                           ║
 * ║  Extrait de index.html — ne plus modifier le HTML pour cette logique   ║
 * ║                                                                         ║
 * ║  Contenu :                                                              ║
 * ║  1.  Event delegation hub  (remplace les onclick= statiques)           ║
 * ║  2.  Patches showScreen    (sidebar sync, écrans spéciaux)             ║
 * ║  3.  Topbar collapse                                                    ║
 * ║  4.  Rename course modal                                               ║
 * ║  5.  Toggle shuffle UI                                                  ║
 * ║  6.  Dashboard exam card                                               ║
 * ║  7.  Matières hub render                                               ║
 * ║  8.  SRS recommendations                                               ║
 * ║  9.  Apprentissage Ultra                                               ║
 * ║  10. Spotlight cursor tracking                                          ║
 * ║  11. Plugin glue (FAB, Notion, flashcard import, Pomodoro badge)       ║
 * ║  12. Service worker + seed loader                                       ║
 * ║  13. DOMContentLoaded init                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   1. EVENT DELEGATION HUB
   ─────────────────────────────────────────────────────────────────────────
   Remplace tous les onclick= statiques dans le HTML.

   Utilisation dans le HTML :
     <button data-action="showScreen" data-target="partiels">
     <button data-action="openModal"  data-target="modal-nf">
     <button data-action="toggleTopbar">

   Pour les actions sans argument, omettre data-target.
   ─────────────────────────────────────────────────────────────────────────
   NOTE : Les onclick= dans les innerHTML générés dynamiquement (renderQ,
   renderMatieresHub, etc.) sont hors scope de cette étape — ils seront
   traités en Étape 2 via event delegation sur les containers.
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('click', function _delegationHub(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;
  const target = el.dataset.target;   // peut être undefined

  switch (action) {
    /* ── Navigation ── */
    case 'switchTab':
      if (typeof switchTab === 'function') switchTab(target);
      break;
    case 'showScreen':
      if (typeof showScreen === 'function') showScreen(target);
      break;

    /* ── Modaux ── */
    case 'openModal':
      if (typeof openModal === 'function') openModal(target);
      break;
    case 'closeModal':
      if (typeof closeModal === 'function') closeModal(target);
      break;

    /* ── Topbar ── */
    case 'toggleTopbar':
      if (typeof toggleTopbar === 'function') toggleTopbar();
      break;
    case 'toggleThemePicker':
      if (typeof toggleThemePicker === 'function') toggleThemePicker(e);
      break;
    case 'openSearch':
      if (typeof openSearch === 'function') openSearch();
      break;

    /* ── Fonctions métier courantes ── */
    case 'openMatiereOptions':
      if (typeof openMatiereOptions === 'function')
        openMatiereOptions(el.dataset.id, el.dataset.name);
      break;
    case 'startSmartReview':
      if (typeof startSmartReview === 'function') startSmartReview();
      break;
    case 'showImagingHub':
      if (typeof showImagingHub === 'function') showImagingHub();
      break;
    case 'showAudioHub':
      if (typeof showAudioHub === 'function') showAudioHub();
      break;
    case 'openAllFlashcards':
      if (typeof openAllFlashcards === 'function') openAllFlashcards();
      break;
    case 'openPickMatiere':
      if (typeof openPickMatiere === 'function') openPickMatiere();
      break;
    case 'spotifyLogin':
      if (typeof spotifyLogin === 'function') spotifyLogin();
      break;

    /* ── Outils ── */
    case 'openPomodoro':
      if (window.Pomodoro) window.Pomodoro.show(); else if (typeof openModal === 'function') openModal('modal-pomodoro');
      break;
    case 'openPdfInput':
      document.getElementById('kine-pdf-input')?.click();
      break;
    case 'openFlashcardInput':
      document.getElementById('kine-fc-input')?.click();
      break;
    case 'openAnatomy':
      if (typeof window.showAnatomyModel === 'function') {
        kcPrompt('Nom du muscle (ex : biceps brachii)','biceps brachii').then(m=>{ if(m!==null) window.showAnatomyModel(m.trim() || 'biceps brachii'); });

      }
      break;
    case 'openNotionConnect':
      if (typeof window._openNotionConnect === 'function') window._openNotionConnect();
      break;
    case 'resumeQuizFromChip':
      if (typeof _resumeQuizFromChip === 'function') _resumeQuizFromChip();
      break;

    /* ── Pomodoro ── */
    case 'hidePomodoro':
      if (window.Pomodoro) window.Pomodoro.hide();
      break;
    case 'notionConnect':
      if (typeof window._notionConnect === 'function') window._notionConnect();
      break;

    default:
      /* Action inconnue — ne rien faire, ne pas bloquer la propagation */
      break;
  }
}, true /* capture = true pour intercepter avant les onclick= résiduels si besoin */);


/* ═══════════════════════════════════════════════════════════════════════════
   2. PATCHES showScreen — sidebar sync + écrans spéciaux
   ═══════════════════════════════════════════════════════════════════════════ */

(function patchShowScreen() {
  /* Attendre que showScreen soit défini par content.js */
  function _apply() {
    if (typeof window.showScreen !== 'function') return;

    /* ── Patch 1 : screen-matiere-options (écran non listé dans _screenDepths) ── */
    const _orig1 = window.showScreen;
    window.showScreen = function (id) {
      if (id === 'matiere-options') {
        document.querySelectorAll('.screen').forEach(s => {
          s.classList.remove('active');
          s.style.display = 'none';
        });
        const el = document.getElementById('screen-matiere-options');
        if (el) { el.classList.add('active'); el.style.display = 'block'; }
        document.body.dataset.screen = 'matiere-options';
        window.scrollTo(0, 0);
        const hist = window._navHistory;
        if (!window._navGoingBack && hist && hist[hist.length - 1] !== 'matiere-options') {
          hist.push('matiere-options');
          if (hist.length > 30) hist.shift();
        }
        return;
      }
      _orig1.apply(this, arguments);
    };

    /* ── Patch 2 : sidebar active state + renderers dynamiques ── */
    const _orig2 = window.showScreen;
    window.showScreen = function (id) {
      _orig2.apply(this, arguments);

      /* Sync active link dans la sidebar desktop */
      document.querySelectorAll('.dl-nav a[data-nav]').forEach(a =>
        a.classList.toggle('dl-active', a.dataset.nav === id)
      );

      /* Renderers à déclencher selon l'écran affiché */
      if (id === 'home') {
        if (typeof renderSrsRecommendations === 'function') renderSrsRecommendations();
        if (typeof renderDashExamCard      === 'function') renderDashExamCard();
      }
      if (id === 'matieres-hub' && typeof renderMatieresHub === 'function') {
        renderMatieresHub();
      }
      if (id === 'profil-hub' && typeof initIdentityCard === 'function') {
        initIdentityCard();
      }
      if (id === 'ultra' && typeof initUltraScreen === 'function') {
        initUltraScreen();
      }
    };
  }

  /* showScreen peut ne pas encore exister au chargement de app.js
     → on réessaie après que tous les scripts sont parsés */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _apply);
  } else {
    /* Scripts synchrones déjà exécutés — on peut appliquer immédiatement */
    _apply();
  }
})();


/* ═══════════════════════════════════════════════════════════════════════════
   3. TOPBAR COLLAPSE
   ═══════════════════════════════════════════════════════════════════════════ */

/* 15 nov. 2026 : la colonne de droite n'existe plus (interface Cobalt) → ce bouton cache / affiche le MENU DE GAUCHE */
function _syncNavBtn(hidden) {
  const icon = document.getElementById('topbar-collapse-icon');
  const btn  = document.getElementById('topbar-collapse-btn');
  if (icon) icon.textContent = hidden ? 'left_panel_open' : 'left_panel_close';
  if (btn) { btn.dataset.tooltip = hidden ? 'Afficher le menu' : 'Masquer le menu'; btn.setAttribute('aria-label', btn.dataset.tooltip); }
}
window.toggleTopbar = function () {
  const hidden = document.body.classList.toggle('kc-nav-hidden');
  document.body.classList.remove('sidebar-right-hidden');
  try { localStorage.setItem('kp_nav_hidden', hidden ? '1' : '0'); } catch (e) {}
  _syncNavBtn(hidden);
};

/* Restaurer la préférence au chargement */
(function restoreTopbarPref() {
  let on = false;
  try { on = localStorage.getItem('kp_nav_hidden') === '1'; localStorage.removeItem('kp_sidebar_right_hidden'); } catch (e) {}
  if (!on) return;
  document.body.classList.add('kc-nav-hidden');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => _syncNavBtn(true));
  else _syncNavBtn(true);
})();


/* ═══════════════════════════════════════════════════════════════════════════
   4. RENAME COURSE MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

let _renameCourseId = null;

window.openRenameCourse = function (courseId, currentName) {
  _renameCourseId = courseId;
  const inp = document.getElementById('rename-course-input');
  if (inp) inp.value = currentName || '';
  if (typeof openModal === 'function') openModal('modal-rename-course');
  setTimeout(() => inp?.select(), 120);
};

window.confirmRenameCourse = function () {
  const newName = document.getElementById('rename-course-input')?.value.trim();
  if (!newName) return;
  const c = (typeof courses !== 'undefined' ? courses : []).find(x => x.id === _renameCourseId);
  if (c) { c.name = newName; if (typeof saveAll === 'function') saveAll(); }
  if (typeof closeModal  === 'function') closeModal('modal-rename-course');
  if (typeof renderMatiere   === 'function') renderMatiere();
  if (typeof renderSubFolder === 'function') renderSubFolder();
  if (typeof renderCourse    === 'function') renderCourse();
  if (typeof showNotif === 'function') showNotif('Cours renommé', 'ok');
};


/* ═══════════════════════════════════════════════════════════════════════════
   5. TOGGLE SHUFFLE UI
   ═══════════════════════════════════════════════════════════════════════════ */

function syncToggleUI(inputId, sliderId, knobId) {
  const el     = document.getElementById(inputId);
  const slider = document.getElementById(sliderId);
  const knob   = document.getElementById(knobId);
  if (!el || !slider || !knob) return;
  slider.style.background = el.checked ? 'var(--primary)' : 'var(--border-subtle)';
  knob.style.left         = el.checked ? '21px' : '3px';
}
window.syncToggleUI = syncToggleUI;  /* exposé pour usage dans content.js */

/* Forcer le toggle shuffle à OFF à chaque ouverture de #modal-blocks */
const _modalBlocksObs = new MutationObserver(() => {
  const modal = document.getElementById('modal-blocks');
  if (!modal) return;
  const visible = modal.style.display === 'flex'
               || modal.classList.contains('visible')
               || modal.style.opacity  === '1';
  if (!visible) return;
  if (!window._wantShuffle) {
    const bt = document.getElementById('blocks-shuffle-toggle');
    if (bt) { bt.checked = false; syncToggleUI('blocks-shuffle-toggle', 'blocks-shuffle-slider', 'blocks-shuffle-knob'); }
  }
  window._wantShuffle = false;
});

/* Bouton Aléatoire dans l'écran cours */
window.startCourseShuffle = function () {
  window._wantShuffle = true;
  const bt = document.getElementById('blocks-shuffle-toggle');
  if (bt) { bt.checked = true; syncToggleUI('blocks-shuffle-toggle', 'blocks-shuffle-slider', 'blocks-shuffle-knob'); }
  if (typeof startCourse === 'function') startCourse();
};


/* ═══════════════════════════════════════════════════════════════════════════
   6. DASHBOARD — exam card
   ═══════════════════════════════════════════════════════════════════════════ */

window.renderDashExamCard = function () {
  const el = document.getElementById('dash-exam-card');
  if (!el) return;

  const examDays = typeof getExamDaysLeft === 'function' ? getExamDaysLeft() : null;
  if (examDays === null || examDays < 0) { el.style.display = 'none'; return; }

  const examName    = localStorage.getItem('kp_exam_name') || 'Concours';
  const examDateRaw = localStorage.getItem('kp_exam_date');
  const examDateStr = examDateRaw
    ? new Date(examDateRaw).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  el.style.display = 'block';
  el.innerHTML = `
    <div class="ec-kicker">⚡ Prochaine échéance</div>
    <div class="ec-name">${examName}</div>
    <div class="ec-days">
      <span class="ec-num">${examDays}</span>
      <span class="ec-lbl">jour${examDays > 1 ? 's' : ''} restant${examDays > 1 ? 's' : ''}</span>
    </div>
    ${examDateStr ? `<div class="ec-date">${examDateStr}</div>` : ''}`;
};


/* ═══════════════════════════════════════════════════════════════════════════
   7. MATIÈRES HUB
   ═══════════════════════════════════════════════════════════════════════════ */

window._currentMatiereId = null;

window.renderMatieresHub = function () {
  const el = document.getElementById('matieres-hub-list');
  if (!el) return;

  const list = (typeof folders !== 'undefined' ? folders : []) || [];
  if (!list.length) {
    el.innerHTML = `<div class="hub-empty">
      <span class="ms">folder_open</span>
      <p>Aucune matière — crée-en une pour commencer.</p>
    </div>`;
    return;
  }

  // Matières « normales » seulement (les annales ont leur propre écran) ; maîtrise et difficiles calculées ici
  const cById = {};
  (typeof courses !== 'undefined' ? courses : []).forEach(c => { cById[c.id] = c; });
  const sfFolder = {};
  (typeof subFolders !== 'undefined' ? subFolders : []).forEach(sf => { sfFolder[sf.id] = sf.folderId; });
  const byF = {};
  (typeof questions !== 'undefined' ? questions : []).forEach(q => {
    const c = cById[q.courseId]; if (!c) return;
    const fid = c.folderId || sfFolder[c.subFolderId]; if (!fid) return;
    if (typeof isBoycotted === 'function' && isBoycotted(q.id)) return;
    const a = byF[fid] || (byF[fid] = { n: 0, m: 0, h: 0 });
    a.n++;
    const d = typeof getDiff === 'function' ? getDiff(q.id) : 'new';
    if (d === 'easy' || d === 'acquired') a.m++; else if (d === 'hard') a.h++;
  });
  const nCourses = fid => Object.values(cById).filter(c => c.folderId === fid).length;
  const isDone = fid => typeof isFolderArchived === 'function' && isFolderArchived(fid);
  // 15 nov. 2026 : favoris (f.fav) en tête, ordre perso = ordre du tableau folders (glisser-déposer), matières terminées (= archivées) à part
  const regular = list.filter(f => f.type !== 'annales' && !f.isAnnale);
  const favs = regular.filter(f => f.fav && !isDone(f.id));
  const todo = regular.filter(f => !f.fav && !isDone(f.id));
  const done = regular.filter(f => isDone(f.id));
  const row = (f, sec) => {
    const a = byF[f.id] || { n: 0, m: 0, h: 0 };
    const pct = a.n ? Math.round(a.m / a.n * 100) : 0;
    const nc = nCourses(f.id);
    const fid   = f.id;
    const fname = f.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const dn = sec === 'done';
    return `<div class="matiere-hub-item${dn ? ' mh-done' : ''}" data-fid="${fid}" data-sec="${sec}" onclick="openMatiereOptions('${fid}','${fname}')">
      <span class="mh-grip ms" title="Glisser pour changer l'ordre" onclick="event.stopPropagation()">drag_indicator</span>
      <button type="button" class="matiere-hub-dot mh-dot-btn" style="background:${f.color || 'var(--primary)'}" title="Changer la couleur" aria-label="Changer la couleur de ${f.name.replace(/"/g, '&quot;')}" onclick="event.stopPropagation();mhPickColor('${fid}',this)"></button>
      <div class="matiere-hub-info">
        <div class="matiere-hub-name">${f.name}</div>
        <div class="matiere-hub-meta">${nc} cours · ${a.n} question${a.n !== 1 ? 's' : ''}${a.h && !dn ? ` · <span style="color:var(--error)">${a.h} difficile${a.h > 1 ? 's' : ''}</span>` : ''}${dn ? ' · <span class="mh-done-lbl">terminée</span>' : ''}</div>
        ${a.n ? `<div class="kh-mini-bar" title="Maîtrise : ${pct} %"><span style="width:${pct}%"></span></div>` : ''}
      </div>
      ${a.n ? `<div class="kh-mini-pct">${pct}<small> %</small></div>` : ''}
      <div class="matiere-hub-actions">
        ${dn ? '' : `<button class="mha-btn mh-star${f.fav ? ' on' : ''}" title="${f.fav ? 'Retirer des favoris' : 'Mettre en favori'}" aria-pressed="${!!f.fav}"
          onclick="event.stopPropagation();mhToggleFav('${fid}',this)"><span class="ms">star</span></button>`}
        <button class="mha-btn mh-check${dn ? ' on' : ''}" title="${dn ? 'Remettre dans les matières à réviser' : 'Marquer comme terminée'}" aria-pressed="${dn}"
          onclick="event.stopPropagation();mhToggleDone('${fid}',this)"><span class="ms">${dn ? 'undo' : 'check_circle'}</span></button>
        <button class="mha-btn" title="Renommer"
          onclick="event.stopPropagation();window._currentMatiereId='${fid}';openRenameMatiere()">
          <span class="ms">edit</span>
        </button>
        <button class="mha-btn" title="Partager toute la matière avec tes amis"
          onclick="event.stopPropagation();socialOpenShareFolder('mat:${fid}')">
          <span class="ms">share</span>
        </button>
        <button class="mha-btn mha-btn-del" title="Supprimer"
          onclick="event.stopPropagation();window._currentMatiereId='${fid}';confirmDeleteMatiere()">
          <span class="ms">delete</span>
        </button>
      </div>
      <span class="ms matiere-hub-arrow">arrow_forward_ios</span>
    </div>`;
  };
  let openDone = false; try { openDone = localStorage.getItem('kp_mh_done_open') === '1'; } catch (e) {}
  let html = '';
  if (favs.length) html += `<div class="mh-sec"><span class="ms f">star</span>Favorites <em>${favs.length}</em></div><div class="mh-group" data-sec="fav">${favs.map(f => row(f, 'fav')).join('')}</div>`;
  if (todo.length || !favs.length) html += `<div class="mh-sec">${favs.length || done.length ? '<span class="ms">school</span>À réviser' : '<span class="ms">school</span>Mes matières'} <em>${todo.length}</em><span class="mh-tip">Glisse <span class="ms">drag_indicator</span> pour changer l'ordre · <span class="ms">star</span> favori · <span class="ms">check_circle</span> terminée</span></div><div class="mh-group" data-sec="todo">${todo.map(f => row(f, 'todo')).join('') || '<div class="mh-empty">Tout est terminé, bravo !</div>'}</div>`;
  if (done.length) html += `<button class="mh-sec mh-sec-btn${openDone ? ' open' : ''}" onclick="mhToggleDoneList(this)" aria-expanded="${openDone}"><span class="ms">task_alt</span>Terminées <em>${done.length}</em><span class="ms mh-chev">expand_more</span></button><div class="mh-group mh-done-group" data-sec="done"${openDone ? '' : ' hidden'}>${done.map(f => row(f, 'done')).join('')}</div>`;
  el.innerHTML = html
  + `<div class="mh-new-row"><button class="btn btn-g mh-new" onclick="openModal('modal-nf')">
       <span class="ms" style="font-size:16px">add</span> Nouvelle matière
     </button></div>`;   /* v84 : le bouton « Drive commun » est déjà en haut de la page (il était en double) */
  _mhInitDrag(el);
};

/* ── Favori / terminée / ordre (15 nov. 2026) ── */
window.mhToggleFav = function (fid, btn) {
  const f = (typeof folders !== 'undefined' ? folders : []).find(x => x.id === fid); if (!f) return;
  f.fav = !f.fav; if (!f.fav) delete f.fav;
  if (typeof saveAll === 'function') saveAll();
  if (btn) { btn.classList.add('kc-pop'); }
  setTimeout(() => renderMatieresHub(), btn ? 180 : 0);
};
window.mhToggleDone = function (fid, btn) {
  const f = (typeof folders !== 'undefined' ? folders : []).find(x => x.id === fid); if (!f) return;
  const was = typeof isFolderArchived === 'function' && isFolderArchived(fid);
  const item = btn && btn.closest('.matiere-hub-item');
  const go = () => {
    if (was) unarchiveFolder(fid); else archiveFolder(fid);
    renderMatieresHub();
    if (typeof renderHome === 'function') try { renderHome(); } catch (e) {}
    if (typeof showNotif === 'function') showNotif(was ? `« ${f.name} » est de retour dans tes matières à réviser` : `« ${f.name} » terminée : elle ne sera plus proposée en révision`, 'ok');
  };
  if (item) { item.classList.add('mh-leave'); setTimeout(go, 220); } else go();
};
window.mhToggleDoneList = function (btn) {
  const g = btn.nextElementSibling; if (!g) return;
  const open = g.hasAttribute('hidden');
  if (open) g.removeAttribute('hidden'); else g.setAttribute('hidden', '');
  btn.classList.toggle('open', open); btn.setAttribute('aria-expanded', open);
  try { localStorage.setItem('kp_mh_done_open', open ? '1' : '0'); } catch (e) {}
};
/* Glisser-déposer à la souris ou au doigt (poignée) : réordonne le tableau folders → même ordre partout dans le site */
function _mhInitDrag(root) {
  root.querySelectorAll('.mh-grip').forEach(grip => {
    grip.addEventListener('pointerdown', e => {
      const item = grip.closest('.matiere-hub-item'), group = item && item.parentElement;
      if (!item || !group) return;
      e.preventDefault(); e.stopPropagation();
      grip.setPointerCapture(e.pointerId);
      const r0 = item.getBoundingClientRect(), y0 = e.clientY;
      const ph = document.createElement('div'); ph.className = 'mh-ph'; ph.style.height = r0.height + 'px';
      item.after(ph);
      item.classList.add('mh-drag'); item.style.width = r0.width + 'px'; item.style.left = r0.left + 'px'; item.style.top = r0.top + 'px';
      const move = ev => {
        item.style.transform = `translateY(${ev.clientY - y0}px)`;
        const sibs = [...group.querySelectorAll('.matiere-hub-item:not(.mh-drag)')];
        let before = null;
        for (const s2 of sibs) { const r = s2.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { before = s2; break; } }
        if (before) { if (ph.nextElementSibling !== before) group.insertBefore(ph, before); }
        else if (group.lastElementChild !== ph) group.appendChild(ph);
      };
      const up = () => {
        grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
        ph.replaceWith(item);
        item.classList.remove('mh-drag'); item.style.cssText = '';
        // nouvel ordre : on replace les matières de ce groupe dans le tableau folders, aux mêmes emplacements
        const ids = [...group.querySelectorAll('.matiere-hub-item')].map(x => x.dataset.fid);
        if (typeof folders !== 'undefined') {
          const slots = []; folders.forEach((f, i) => { if (ids.includes(f.id)) slots.push(i); });
          const byId = {}; folders.forEach(f => { byId[f.id] = f; });
          slots.forEach((slot, k) => { folders[slot] = byId[ids[k]]; });
          if (typeof saveAll === 'function') saveAll();
        }
      };
      grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
    });
  });
}

window.openMatiereOptions = function (id, name) {
  window._currentMatiereId = id;
  document.getElementById('matiere-opt-kicker').textContent = 'Matière';
  document.getElementById('matiere-opt-title').textContent  = name;
  if (typeof showScreen === 'function') showScreen('matiere-options');
};

/* ── Renommer ── */
window.openRenameMatiere = function () {
  const f = (typeof folders !== 'undefined' ? folders : []).find(x => x.id === window._currentMatiereId);
  if (!f) return;
  const inp = document.getElementById('rename-matiere-input');
  if (inp) inp.value = f.name;
  mhFillColors('rename-matiere-colors', f.color);
  if (typeof openModal === 'function') openModal('modal-rename-matiere');
  setTimeout(() => inp?.select(), 80);
};

window.saveRenameMatiere = function () {
  const newName = document.getElementById('rename-matiere-input')?.value.trim();
  if (!newName) { if (typeof showNotif === 'function') showNotif('Le nom ne peut pas être vide.', 'err'); return; }
  const f = (typeof folders !== 'undefined' ? folders : []).find(x => x.id === window._currentMatiereId);
  if (!f) return;
  f.name = newName;
  const col = mhSelColor('rename-matiere-colors'); if (col) f.color = col;
  if (typeof saveAll === 'function') saveAll();
  const titleEl = document.getElementById('matiere-opt-title');
  if (titleEl) titleEl.textContent = newName;
  if (typeof closeModal === 'function') closeModal('modal-rename-matiere');
  if (typeof renderMatieresHub === 'function') renderMatieresHub();
  if (typeof showNotif === 'function') showNotif(`Matière renommée en "${newName}"`, 'ok');
};

/* ── Couleur d'une matière (v84, 21 nov. 2026) : clic sur la pastille, ou dans « Renommer la matière » ── */
const MH_COLS = ['#E5394F','#F97316','#F59E0B','#EAB308','#84CC16','#22C55E','#10B981','#14B8A6','#06B6D4','#0EA5E9','#3B82F6','#6366F1','#8B5CF6','#A855F7','#EC4899','#F472B6','#64748B','#2D5A3D'];
function mhColorsHTML(cur) {
  const c = String(cur || '').toUpperCase(), custom = c && !MH_COLS.includes(c);
  return MH_COLS.map(x => `<button type="button" class="mh-sw${x === c ? ' on' : ''}" data-col="${x}" style="--sw:${x}" title="${x}" aria-label="Couleur ${x}"><span class="ms">check</span></button>`).join('')
    + `<label class="mh-sw mh-sw-cust${custom ? ' on' : ''}" title="Ma couleur" style="${custom ? '--sw:' + c : ''}" data-col="${custom ? c : ''}"><span class="ms">colorize</span><input type="color" value="${custom ? c.toLowerCase() : '#e5394f'}"></label>`;
}
window.mhFillColors = function (id, cur) {
  const box = document.getElementById(id); if (!box) return;
  box.innerHTML = mhColorsHTML(cur); box.dataset.sel = cur || '';
  if (!box._wired) { box._wired = true;
    box.addEventListener('click', e => { const b = e.target.closest('.mh-sw'); if (!b || b.classList.contains('mh-sw-cust')) return; box.querySelectorAll('.mh-sw').forEach(x => x.classList.toggle('on', x === b)); box.dataset.sel = b.dataset.col; });
    box.addEventListener('input', e => { if (e.target.type !== 'color') return; const l = e.target.closest('.mh-sw-cust'); l.style.setProperty('--sw', e.target.value); box.querySelectorAll('.mh-sw').forEach(x => x.classList.toggle('on', x === l)); box.dataset.sel = e.target.value.toUpperCase(); });
  }
};
window.mhSelColor = function (id) { const b = document.getElementById(id); return b && /^#[0-9A-F]{6}$/i.test(b.dataset.sel || '') ? b.dataset.sel : null; };
window.mhPickColor = function (fid, anchor) {
  const f = (typeof folders !== 'undefined' ? folders : []).find(x => x.id === fid); if (!f) return;
  document.querySelectorAll('.mh-cpop').forEach(x => x.remove());
  const p = document.createElement('div'); p.className = 'mh-cpop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Couleur de la matière');
  p.innerHTML = `<div class="mh-cpop-t">Couleur de « ${String(f.name).replace(/[<>&]/g, '')} »</div><div class="mh-colors" id="mh-cpop-cols"></div>`;
  document.body.appendChild(p); mhFillColors('mh-cpop-cols', f.color);
  const r = anchor.getBoundingClientRect(), w = p.offsetWidth;
  p.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left - 8)) + 'px';
  p.style.top = (r.bottom + 8 + p.offsetHeight > innerHeight ? Math.max(8, r.top - p.offsetHeight - 8) : r.bottom + 8) + 'px';
  const apply = () => { const c = mhSelColor('mh-cpop-cols'); if (!c || c === f.color) return; f.color = c; if (typeof saveAll === 'function') saveAll(); anchor.style.background = c; };
  p.addEventListener('click', e => { if (e.target.closest('.mh-sw:not(.mh-sw-cust)')) { apply(); close(); } });
  p.addEventListener('change', e => { if (e.target.type === 'color') { apply(); close(); } });
  const close = () => { p.remove(); document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', key, true); if (typeof renderMatieresHub === 'function') renderMatieresHub(); };
  const out = e => { if (!p.contains(e.target)) close(); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  setTimeout(() => { document.addEventListener('pointerdown', out, true); document.addEventListener('keydown', key, true); }, 0);
};
/* fenêtre « Renommer la matière » de la page d'une matière (content.js) : on y ajoute aussi la couleur */
(function () {
  const wrap = () => {
    if (typeof window.openRenameFolder !== 'function' || window.openRenameFolder._mh) return;
    const o1 = window.openRenameFolder, o2 = window.confirmRenameFolder;
    window.openRenameFolder = function (fid) { const r = o1.apply(this, arguments); const f = (folders || []).find(x => x.id === fid); mhFillColors('rename-folder-colors', f && f.color); window._mhRenFid = fid; return r; };
    window.openRenameFolder._mh = true;
    window.confirmRenameFolder = function () { const f = (folders || []).find(x => x.id === window._mhRenFid), c = mhSelColor('rename-folder-colors'); if (f && c) f.color = c; return o2.apply(this, arguments); };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(wrap, 0)); else setTimeout(wrap, 0);
})();

/* ── Supprimer ── */
window.confirmDeleteMatiere = function () {
  const id = window._currentMatiereId;
  const f  = (typeof folders  !== 'undefined' ? folders  : []).find(x => x.id === id);
  if (!f) return;
  const fc = (typeof courses   !== 'undefined' ? courses   : []).filter(c => c.folderId === id);
  const nq = (typeof questions !== 'undefined' ? questions : [])
    .filter(q => fc.some(c => c.id === q.courseId)).length;

  if (typeof showConfirm === 'function') {
    showConfirm(
      `Supprimer "${f.name}" ?`,
      `${fc.length} cours et ${nq} question${nq !== 1 ? 's' : ''} seront supprimés définitivement.`,
      'Supprimer',
      () => {
        if (typeof deleteFolder === 'function') {
          deleteFolder(id);
          if (typeof showScreen === 'function') showScreen('matieres-hub');
        }
      }
    );
  }
};

/* ── Helpers navigation depuis matiere-options ── */
window.startMByIdCurrent = function () {
  if (window._currentMatiereId && typeof startMById === 'function') {
    window.rBack = 'matiere-options';
    startMById(window._currentMatiereId);
  }
};

window._matierePrevScreen = null;

window.openMatiereFolder = function () {
  if (!window._currentMatiereId) return;
  window._matierePrevScreen = 'matiere-options';
  if (typeof openFolder === 'function') openFolder(window._currentMatiereId);
};

window.goBackFromMatiere = function () {
  const prev = window._matierePrevScreen || 'home';
  window._matierePrevScreen = null;
  if (typeof showScreen === 'function') showScreen(prev);
};

window.openMatiereFlashcards = function () {
  if (!window._currentMatiereId) return;
  if (typeof curF !== 'undefined') window.curF = window._currentMatiereId;
  if (typeof showScreen === 'function') showScreen('concepts');
};

window.openMatiereStats = function () {
  if (window._currentMatiereId && typeof curF !== 'undefined') {
    window.curF = window._currentMatiereId;
  }
  window._statsReturnScreen = 'matiere-options';
  if (typeof showScreen === 'function') showScreen('stats');
};

/* startMById shim (si non encore défini par content.js au moment du clic) */
if (typeof startMById === 'undefined') {
  window.startMById = function (folderId) {
    if (typeof openPickMatiere === 'function') openPickMatiere();
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
   8. SRS — "Révise ça aujourd'hui"
   ═══════════════════════════════════════════════════════════════════════════ */

window.computeSrsCandidates = function (limit) {
  limit = limit || 5;
  const list = (typeof questions !== 'undefined' ? questions : []) || [];
  if (!list.length) return [];

  const scored = list.map(q => {
    const d        = (typeof diffData !== 'undefined' && diffData[q.id]) || { attempts: 0, errors: 0, lastDate: null };
    const attempts = d.attempts || 0;
    const errors   = d.errors   || 0;
    const errRate  = attempts > 0 ? errors / attempts : 0;
    let daysSince  = 999;
    if (d.lastDate) daysSince = (Date.now() - new Date(d.lastDate).getTime()) / 86400000;
    const oblScore  = attempts === 0 ? 0.4 : Math.min(1, daysSince / 14);
    const diffScore = errRate;
    return { q, score: oblScore * 0.55 + diffScore * 0.45, errRate, daysSince, attempts };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
};

window.renderSrsRecommendations = function () {
  const listEl = document.getElementById('srs-list');
  const subEl  = document.getElementById('srs-sub');
  if (!listEl) return;

  const items = computeSrsCandidates(5);
  if (!items.length) {
    listEl.innerHTML = `<div class="srs-empty">Aucune question urgente — revenez après quelques sessions.</div>`;
    if (subEl) subEl.textContent = "Importez vos premières questions pour activer l'algorithme.";
    return;
  }

  if (subEl) subEl.textContent = `${items.length} question${items.length > 1 ? 's' : ''} prioritaires selon l'algorithme d'oubli.`;

  listEl.innerHTML = items.map(({ q, errRate, daysSince, attempts }) => {
    const diff   = typeof getDiff === 'function' ? getDiff(q.id) : 'new';
    const tag    = diff === 'hard'   ? 'Difficile'
                 : diff === 'medium' ? 'À revoir'
                 : attempts === 0    ? 'Nouvelle'
                 :                    'Maîtrisée';
    const tagCol = diff === 'hard'   ? 'var(--error)'
                 : diff === 'medium' ? 'var(--gold)'
                 :                    'var(--on-sv)';
    const when   = daysSince > 900 ? 'jamais vue'
                 : daysSince >= 2   ? `il y a ${Math.round(daysSince)} j`
                 :                    'récente';
    return `<div class="srs-row" onclick="startSmartReview()">
      <div class="srs-dot" style="background:${tagCol}"></div>
      <div class="srs-row-body">
        <div class="srs-row-q">${q.question.length > 110 ? q.question.substring(0, 110) + '…' : q.question}</div>
        <div class="srs-row-meta"><span style="color:${tagCol};font-weight:700">${tag}</span> · ${when}</div>
      </div>
      <span class="ms srs-row-go">chevron_right</span>
    </div>`;
  }).join('');
};

window.startSmartReview = function () {
  const items = computeSrsCandidates(10);
  if (!items.length) {
    if (typeof showNotif === 'function') showNotif('Aucune question à réviser', 'info');
    return;
  }
  if (typeof launchS === 'function') {
    launchS(items.map(i => i.q), 'Révision intelligente', false, false, false, false, false);
  }
};


/* ═══════════════════════════════════════════════════════════════════════════
   9. APPRENTISSAGE ULTRA
   ═══════════════════════════════════════════════════════════════════════════ */

window.initUltraScreen = function () {
  const shell = document.getElementById('ultra-shell');
  if (!shell || shell.dataset.init) return;
  shell.dataset.init = '1';
};

window.ultraReset = function () {
  const shell = document.getElementById('ultra-shell');
  if (!shell) return;
  shell.dataset.state = 'empty';
  document.getElementById('ultra-empty').hidden = false;
  document.getElementById('ultra-conv').hidden  = true;
  document.getElementById('ultra-pdf-chip').hidden = true;
  document.getElementById('ultra-thread').innerHTML = `
    <div class="ultra-msg ultra-msg-ai">
      <div class="ultra-avatar"><span class="ms">auto_awesome</span></div>
      <div class="ultra-bubble">
        Bonjour. Avant de commencer — qu'as-tu envie d'explorer aujourd'hui ?<br><br>
        Je vais te poser des questions plutôt que te donner les réponses. C'est en cherchant que tu apprendras.
      </div>
    </div>`;
  document.getElementById('ultra-input').value = '';
};

window.ultraStartBlank = function () {
  const shell = document.getElementById('ultra-shell');
  if (!shell) return;
  shell.dataset.state = 'conv';
  document.getElementById('ultra-empty').hidden = true;
  document.getElementById('ultra-conv').hidden  = false;
  setTimeout(() => document.getElementById('ultra-input')?.focus(), 120);
};

window.ultraHandleFile = function (e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  if (f.type !== 'application/pdf') {
    if (typeof showNotif === 'function') showNotif('Format invalide — PDF uniquement', 'err');
    return;
  }
  const shell = document.getElementById('ultra-shell');
  shell.dataset.state = 'conv';
  document.getElementById('ultra-empty').hidden = true;
  document.getElementById('ultra-conv').hidden  = false;

  const chip = document.getElementById('ultra-pdf-chip');
  chip.hidden = false;
  document.getElementById('ultra-pdf-name').textContent = f.name;

  document.getElementById('ultra-thread').innerHTML = `
    <div class="ultra-msg ultra-msg-ai">
      <div class="ultra-avatar"><span class="ms">auto_awesome</span></div>
      <div class="ultra-bubble">
        Parfait, j'ai bien reçu <strong>${f.name}</strong>.<br><br>
        Avant que je te questionne dessus — peux-tu me dire en une phrase ce que tu en retiens à première lecture ?
      </div>
    </div>`;
  setTimeout(() => document.getElementById('ultra-input')?.focus(), 120);
};

window.ultraRemovePdf = function () {
  document.getElementById('ultra-pdf-chip').hidden = true;
  document.getElementById('ultra-file')?.value  && (document.getElementById('ultra-file').value  = '');
  document.getElementById('ultra-file2')?.value && (document.getElementById('ultra-file2').value = '');
};

window.ultraAutosize = function (ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
};

window.ultraKeydown = function (e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ultraSend(); }
};

window.ultraSend = function () {
  const ta   = document.getElementById('ultra-input');
  const text = ta.value.trim();
  if (!text) return;

  const thread  = document.getElementById('ultra-thread');
  const userMsg = document.createElement('div');
  userMsg.className   = 'ultra-msg ultra-msg-me';
  userMsg.innerHTML   = `<div class="ultra-bubble">${text.replace(/</g, '&lt;')}</div>`;
  thread.appendChild(userMsg);
  ta.value = '';
  ultraAutosize(ta);
  thread.scrollTop = thread.scrollHeight;

  /* Réponse IA simulée (design uniquement) */
  setTimeout(() => {
    const aiMsg = document.createElement('div');
    aiMsg.className = 'ultra-msg ultra-msg-ai';
    aiMsg.innerHTML = `
      <div class="ultra-avatar"><span class="ms">auto_awesome</span></div>
      <div class="ultra-bubble ultra-typing"><span></span><span></span><span></span></div>`;
    thread.appendChild(aiMsg);
    thread.scrollTop = thread.scrollHeight;

    setTimeout(() => {
      const bubble = aiMsg.querySelector('.ultra-bubble');
      bubble.classList.remove('ultra-typing');
      bubble.textContent = "Intéressant. Et si tu devais l'expliquer à un patient — qu'est-ce que tu garderais comme idée centrale ?";
      thread.scrollTop = thread.scrollHeight;
    }, 900);
  }, 220);
};


/* ═══════════════════════════════════════════════════════════════════════════
   10. SPOTLIGHT CURSOR TRACKING (rAF-based, 120Hz-ready)
   ═══════════════════════════════════════════════════════════════════════════ */

(function initSpotlight() {
  /* 15 nov. 2026 : remplacé par la lumière de souris de ux-cobalt.js (plus légère, sur tout le site) */
  return;
  /* Skip sur les écrans tactiles */
  if (window.matchMedia('(pointer:coarse)').matches) return;

  const SEL = [
    '.dtc', '.hub-card', '.dc-obj', '.dc-streak', '.dc-mastery',
    '.hr-panel', '.dl-user-info', '.dl-user', '.dr-panel',
    '.sbox', '.srs-card', '.streak-card', '.goal-card',
    '.qi', '.ci', '.fc', '.bc', '.ob', '.pi', '.pi-pick',
    '.concept-card', '.concept-fc-card',
    '.partiel-item', '.partiel-group', '.partiels-stats-card',
    '.hm-pop-card', '.img-rev-card', '.img-grid-item',
    '.identity-card', '.dash-exam-card', '.quote-card',
    '.matiere-hub-item', '.prompt-card', '.mm-hub-card',
  ].join(',');

  let mouseX = 0, mouseY = 0, ticking = false;

  function updateSpotlight() {
    document.querySelectorAll(SEL).forEach(card => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', (mouseX - r.left) + 'px');
      card.style.setProperty('--mouse-y', (mouseY - r.top)  + 'px');
    });
    ticking = false;
  }

  window.addEventListener('pointermove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!ticking) { requestAnimationFrame(updateSpotlight); ticking = true; }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    document.querySelectorAll(SEL).forEach(card => {
      card.style.setProperty('--mouse-x', '-9999px');
      card.style.setProperty('--mouse-y', '-9999px');
    });
  });
})();


/* ═══════════════════════════════════════════════════════════════════════════
   11. PLUGIN GLUE
   ─────────────────────────────────────────────────────────────────────────
   Connecte les éléments DOM statiques aux plugins de integrations.js.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── FAB mobile (toggle menu) ── */
(function wireFab() {
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('ktf-trigger-btn');
    const menu    = document.getElementById('ktf-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      trigger.classList.toggle('open', open);
    });

    document.addEventListener('click', () => {
      menu.classList.remove('open');
      trigger.classList.remove('open');
    });
  });
})();

/* ── FAB items (data-action= remplace leurs onclick=) ── */
document.addEventListener('DOMContentLoaded', () => {
  /* Les items du FAB ont déjà des onclick= dans le HTML actuel.
     Quand le HTML sera nettoyé, ils utiliseront data-action.
     Ici on s'assure que les data-action fonctionnent aussi. */
  const fabPomodoro = document.querySelector('#ktf-menu [data-action="openPomodoro"]');
  if (fabPomodoro) {
    fabPomodoro.addEventListener('click', () => {
      document.getElementById('ktf-menu')?.classList.remove('open');
      document.getElementById('ktf-trigger-btn')?.classList.remove('open');
    });
  }
});

/* ── Modale Notion Connect ── */
window._openNotionConnect = function () {
  const el = document.getElementById('modal-notion');
  if (el) el.classList.add('open');
};

window._notionConnect = async function () {
  const clientId = document.getElementById('notion-client-id-input')?.value.trim();
  if (!clientId) {
    if (typeof showNotif === 'function') showNotif('Entre un Client ID', 'error');
    return;
  }
  const plugin = await window.KinePlugins?.get('notion-connector');
  if (plugin) { plugin._CLIENT_ID = clientId; plugin.authenticate(); }
};

/* ── Résultat import flashcards ── */
window.addEventListener('kine:flashcards-imported', function (e) {
  const set   = e.detail;
  const body  = document.getElementById('fc-result-body');
  const modal = document.getElementById('modal-fc-result');
  if (!body || !modal) return;

  body.innerHTML = `
    <strong>${set.cards.length} cartes importées</strong> depuis "${set.title}".<br>
    Exemple : <em>${set.cards[0]?.front || '—'}</em><br><br>
    Tu peux les transformer en nœuds Mind Map ou les utiliser en session de révision.`;

  modal.classList.add('open');

  const mapBtn = document.getElementById('fc-to-mindmap-btn');
  if (mapBtn) {
    mapBtn.onclick = async function () {
      modal.classList.remove('open');
      const plugin = await window.KinePlugins?.get('flashcard-importer');
      if (!plugin) return;
      const nodes = plugin.toMindMapNodes(set);
      if (typeof showScreen === 'function') showScreen('mindmap');
      setTimeout(() => {
        nodes.forEach(spec => window.dispatchEvent(new CustomEvent('kine:create-node', { detail: spec })));
        if (typeof showNotif === 'function') showNotif(`${nodes.length} nœuds créés !`, 'success');
      }, 400);
    };
  }
});

/* ── Badge streak Pomodoro dans la sidebar ── */
window.addEventListener('kine:pomodoro-cycle', function (e) {
  const el = document.getElementById('dl-pomo-streak');
  if (el) { el.textContent = '🔥' + e.detail.streak; el.style.display = ''; }
});

/* ── File inputs câblés ── */
document.addEventListener('DOMContentLoaded', () => {
  /* PDF */
  const pdfInput = document.getElementById('kine-pdf-input');
  if (pdfInput) {
    pdfInput.addEventListener('change', function () {
      if (window.openPdfReader) openPdfReader(this.files[0]);
      this.value = '';
    });
  }

  /* Flashcards */
  const fcInput = document.getElementById('kine-fc-input');
  if (fcInput) {
    fcInput.addEventListener('change', async function () {
      const file = this.files[0];
      this.value = '';
      if (!file || !window.importFlashcards) return;
      try {
        const set = await importFlashcards(file);
        if (typeof showNotif === 'function') showNotif(`${set.cards.length} cartes importées !`, 'success');
      } catch (err) {
        if (typeof showNotif === 'function') showNotif(err.message, 'error');
      }
    });
  }
});


/* ═══════════════════════════════════════════════════════════════════════════
   12. SERVICE WORKER + SEED LOADER
   ═══════════════════════════════════════════════════════════════════════════ */

/* Service Worker (uniquement en contexte serveur) */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

/* Auto-load données migrées au premier lancement (localhost uniquement) */
(async function seedIfEmpty() {
  if (location.protocol === 'file:') return;
  if (localStorage.getItem('kcu_f')) return;       // données déjà présentes
  try {
    const res = await fetch('/seed');
    if (!res.ok) return;
    const data = await res.json();
    Object.entries(data).forEach(([k, v]) => { if (v) localStorage.setItem(k, v); });
    console.log('✅ Données migrées depuis seed.json — rechargement…');
    if(window.KStore)KStore.reload();else location.reload();
  } catch (e) { /* pas de seed, ignoré */ }
})();


/* ═══════════════════════════════════════════════════════════════════════════
   13. DOMContentLoaded — init globale
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {
  /* Supprime l'ancien widget Pomodoro flottant si le cache l'a injecté */
  document.getElementById('pomodoro-timer')?.remove();

  /* Init partage Spotify si callback dans l'URL */
  if (typeof checkShareParam === 'function') checkShareParam();

  /* Première passe du dashboard */
  if (typeof renderSrsRecommendations === 'function') renderSrsRecommendations();
  if (typeof renderDashExamCard       === 'function') renderDashExamCard();

  /* Toggle shuffle — état initial */
  const it = document.getElementById('import-shuffle-toggle');
  if (it) { it.checked = false; syncToggleUI('import-shuffle-toggle', 'import-shuffle-slider', 'import-shuffle-knob'); }

  ['import-shuffle-toggle', 'blocks-shuffle-toggle'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      syncToggleUI(id, id.replace('toggle', 'slider'), id.replace('toggle', 'knob'));
    });
  });

  /* Observer sur modal-blocks pour forcer le toggle à OFF */
  const modalBlocks = document.getElementById('modal-blocks');
  if (modalBlocks) _modalBlocksObs.observe(modalBlocks, { attributes: true, attributeFilter: ['style', 'class'] });

  /* Drag & drop Ultra */
  const drop = document.getElementById('ultra-drop');
  if (drop) {
    ['dragenter', 'dragover'].forEach(ev =>
      drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); })
    );
    ['dragleave', 'drop'].forEach(ev =>
      drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); })
    );
    drop.addEventListener('drop', e => {
      const f = e.dataTransfer.files?.[0];
      if (f) ultraHandleFile({ target: { files: [f] } });
    });
  }

  /* Badge streak Pomodoro au chargement */
  try {
    const data = JSON.parse(localStorage.getItem('kine_pomodoro') || '{}');
    if (data.streak > 0) {
      const el = document.getElementById('dl-pomo-streak');
      if (el) { el.textContent = '🔥' + data.streak; el.style.display = ''; }
    }
  } catch (e) { /* ignoré */ }
});


/* ═══════════════════════════════════════════════════════════════════════════
   14. ACCESSIBILITÉ — ÉTAPE 2
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 14a. Navigation clavier pour role="button" ────────────────────────────
   Enter et Espace déclenchent le click, comme sur un vrai <button>.         */
document.addEventListener('keydown', function _keyboardRoleButton(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (el.getAttribute('role') !== 'button') return;
  e.preventDefault();
  el.click();
}, false);

/* ── 14b. ARIA modaux — init automatique ───────────────────────────────────
   Scanne tous les .mdbg et leur ajoute role="dialog", aria-modal="true",
   et aria-labelledby pointant sur le premier titre trouvé à l'intérieur.

   Appelé une fois au DOMContentLoaded, puis ré-exposé pour appel
   dynamique si de nouveaux modaux sont injectés.                           */

window.initModalAria = function () {
  document.querySelectorAll('.mdbg').forEach(function (modal) {
    /* Éviter de re-traiter */
    if (modal.getAttribute('role') === 'dialog') return;

    modal.setAttribute('role',       'dialog');
    modal.setAttribute('aria-modal', 'true');

    /* Trouver un titre (mdttl, h2, h3, premier div de titre, etc.) */
    const titleEl = modal.querySelector(
      '.mdttl, .hub-title, h2, h3, [id$="-title"]:not(input)'
    );
    if (titleEl) {
      if (!titleEl.id) {
        titleEl.id = 'modal-label-' + Math.random().toString(36).slice(2, 7);
      }
      modal.setAttribute('aria-labelledby', titleEl.id);
    }
  });
};

/* ── 14c. Gestion du focus dans les modaux ─────────────────────────────────
   - À l'ouverture : focus sur le premier élément focusable
   - À la fermeture : retour au focus précédent
   - Trap focus : Tab reste dans la modale                                   */

let _lastFocusedEl = null;

const _focusableSelectors = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
].join(', ');

function _getModalFocusables(modal) {
  return Array.from(modal.querySelectorAll(_focusableSelectors))
    .filter(function (el) { return !el.closest('[hidden]') && !el.closest('[style*="display:none"]'); });
}

/* Patch openModal pour ajouter gestion focus */
(function patchModalFocus() {
  function _apply() {
    if (typeof openModal !== 'function') return;

    const _origOpen = window.openModal;
    window.openModal = function (id) {
      _lastFocusedEl = document.activeElement;
      _origOpen.apply(this, arguments);

      const modal = document.getElementById(id);
      if (!modal) return;

      /* Focus sur premier élément focusable (après l'animation CSS) */
      setTimeout(function () {
        const focusables = _getModalFocusables(modal);
        const first = focusables[0];
        if (first) first.focus();
      }, 80);

      /* Trap focus */
      modal._trapFocusHandler = function (e) {
        if (e.key !== 'Tab') return;
        const focusables = _getModalFocusables(modal);
        if (!focusables.length) return;
        const first = focusables[0];
        const last  = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      };
      modal.addEventListener('keydown', modal._trapFocusHandler);

      /* Fermeture sur Échap */
      modal._escHandler = function (e) {
        if (e.key === 'Escape') {
          if (typeof closeModal === 'function') closeModal(id);
        }
      };
      document.addEventListener('keydown', modal._escHandler, { once: true });
    };

    const _origClose = window.closeModal;
    window.closeModal = function (id) {
      _origClose.apply(this, arguments);

      const modal = document.getElementById(id);
      if (modal) {
        if (modal._trapFocusHandler) modal.removeEventListener('keydown', modal._trapFocusHandler);
        if (modal._escHandler)      document.removeEventListener('keydown', modal._escHandler);
      }

      /* Retour au focus précédent */
      if (_lastFocusedEl && typeof _lastFocusedEl.focus === 'function') {
        const el = _lastFocusedEl;
        setTimeout(function () { el.focus(); }, 50);
        _lastFocusedEl = null;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _apply);
  } else {
    _apply();
  }
})();

/* ── 14d. Flashcard flip : sync aria-pressed ───────────────────────────────
   La div role="button" a aria-pressed="false" au départ.
   On le met à jour quand toggleFCFlip() est appelé.                         */
(function patchFlipAria() {
  function _apply() {
    if (typeof toggleFCFlip !== 'function') return;
    const _orig = window.toggleFCFlip;
    window.toggleFCFlip = function () {
      _orig.apply(this, arguments);
      const card = document.getElementById('cfcard');
      if (card) {
        const flipped = card.classList.contains('flipped');
        card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
        card.setAttribute('aria-label',   flipped ? 'Retourner la flashcard (recto)' : 'Retourner la flashcard (verso)');
      }
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _apply);
  } else {
    _apply();
  }
})();

/* ── 14e. Seek slider : sync aria-valuenow ─────────────────────────────────
   Le div role="slider" de Spotify doit exposer aria-valuenow en temps réel. */
(function patchSeekAria() {
  document.addEventListener('DOMContentLoaded', function () {
    const track = document.getElementById('sp-seek-track');
    if (!track) return;
    const fill = document.getElementById('sp-seek-fill');
    if (!fill) return;

    const observer = new MutationObserver(function () {
      const pct = parseFloat(fill.style.width) || 0;
      track.setAttribute('aria-valuenow', Math.round(pct));
    });
    observer.observe(fill, { attributes: true, attributeFilter: ['style'] });
  });
})();

/* ── 14f. Init au DOMContentLoaded ─────────────────────────────────────────  */
document.addEventListener('DOMContentLoaded', function () {
  initModalAria();
});
