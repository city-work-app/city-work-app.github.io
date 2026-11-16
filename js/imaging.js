// ── imaging.js v2 — Imagerie médicale (localStorage + base64)

// ── Data keys ─────────────────────────────────────────────────
const KIC = 'kcu_img_courses';
const KII = 'kcu_img_items';
const KIP = 'kcu_img_prog';

let imgCourses, imgItems, imgProgress;
function _imgLoad() {
  try { imgCourses = JSON.parse(localStorage.getItem(KIC) || '[]'); } catch(e) { imgCourses = []; }
  try { imgItems   = JSON.parse(localStorage.getItem(KII) || '[]'); } catch(e) { imgItems   = []; }
  try { imgProgress= JSON.parse(localStorage.getItem(KIP) || '{}'); } catch(e) { imgProgress= {}; }
}
_imgLoad();

function _imgSave() {
  localStorage.setItem(KIC, JSON.stringify(imgCourses));
  localStorage.setItem(KII, JSON.stringify(imgItems));
  localStorage.setItem(KIP, JSON.stringify(imgProgress));
}

function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function _esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

// ── State ─────────────────────────────────────────────────────
let _imgActiveTab       = 'add';
let _imgActiveCourseId  = null;
let _imgPendingB64      = null;
let _imgPendingMime     = null;
let _imgQueue           = [];
let _imgLibFilterCourse = '';
let _imgLibQuery        = '';
let _imgRevSession      = null;

// ── Storage capacity ──────────────────────────────────────────
const IMG_STORAGE_MAX = 5 * 1024 * 1024; // 5 MB (conservative)
function _imgStorageUsed() {
  let t = 0;
  for (const k of [KIC, KII, KIP]) { const v = localStorage.getItem(k); if (v) t += v.length * 2; }
  return t;
}
function _imgStoragePct() { return _imgStorageUsed() / IMG_STORAGE_MAX; }

// ════════════════════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════════════════════
function showImagingHub() {
  showScreen('imaging');
  // Sync tab button states
  document.querySelectorAll('.img-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === _imgActiveTab));
  _imgRenderTab(_imgActiveTab);
}

function imgSwitchTab(tab) {
  _imgActiveTab = tab;
  document.querySelectorAll('.img-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  _imgRenderTab(tab);
}

function _imgRenderTab(tab) {
  const el       = document.getElementById('img-tab-content');
  const pdfPanel = document.getElementById('pdfqcm-wrap');
  if (!el) return;

  if (tab === 'pdfqcm') {
    el.style.display = 'none';
    if (pdfPanel) pdfPanel.style.display = 'block';
    return;
  }

  // Onglet classique → cacher le panel PDF
  el.style.display = '';
  if (pdfPanel) pdfPanel.style.display = 'none';

  if      (tab === 'add')     _renderImgAdd(el);
  else if (tab === 'library') _renderImgLibrary(el);
  else                        _renderImgRevise(el);
}

// ════════════════════════════════════════════════════════
// TAB 1 — AJOUTER
// ════════════════════════════════════════════════════════
function _renderImgAdd(el) {
  // Capacity warning
  const pct = _imgStoragePct();
  let capHtml = '';
  if (pct > 0.8) {
    const capColor = pct > 0.9 ? 'danger' : 'warn';
    capHtml = `<div style="margin-top:10px;background:var(--surf-low);border-radius:var(--r-lg);padding:10px 12px">
      <div style="font-size:12px;color:${pct > 0.9 ? 'var(--error)' : 'var(--gold)'};font-weight:700;margin-bottom:4px">
        <span class="ms" style="font-size:14px;vertical-align:middle">warning</span>
        Stockage ${Math.round(pct*100)}% utilisé — Pensez à exporter !
      </div>
      <div class="img-cap-bar"><div class="img-cap-fill ${capColor}" style="width:${Math.min(pct*100,100)}%"></div></div>
    </div>`;
  }

  // Dossier options
  const dossierOpts = imgCourses.map(c =>
    `<option value="${_esc(c.id)}" ${c.id === _imgActiveCourseId ? 'selected' : ''}>${_esc(c.name)}</option>`
  ).join('');

  // Drop zone
  const dropInnerHtml = _imgPendingB64 ? `
    <img src="${_imgPendingB64}" class="img-preview-img" onclick="event.stopPropagation()" alt="">
  ` : `
    <span class="ms" style="font-size:38px;color:var(--on-sv);opacity:.35;display:block;margin-bottom:8px">add_photo_alternate</span>
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">Coller ou sélectionner une image</div>
    <div class="img-drop-zone-hint">
      <kbd>Ctrl+V</kbd> pour coller · cliquez pour parcourir · ou glissez-déposez
    </div>
  `;

  // Fields when pending image
  const fieldsHtml = _imgPendingB64 ? `
    <div style="margin-bottom:10px">
      <input class="fi" id="img-title-input" type="text" maxlength="120"
        placeholder="ej: Fractura estrés 2º metatarsiano - Eco"
        onkeydown="if(event.key==='Enter')imgConfirmAdd()"
        style="margin-bottom:8px">
      <div style="display:flex;gap:8px">
        <select class="img-fsel" id="img-region-sel" style="flex:1">
          <option value="">Región anatómica…</option>
          ${['Tobillo','Rodilla','Tibia','Cadera','Pie','Columna','Hombro','Mano','Codo','Muñeca','Pelvis','Cuello']
            .map(r => `<option>${r}</option>`).join('')}
        </select>
        <input class="fi" id="img-tags-input" type="text"
          placeholder="Tags: RM, agudo…" style="flex:1;font-size:13px">
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <button class="btn btn-g" onclick="_imgClearPending()">✕ Annuler</button>
      <button class="btn btn-p" style="flex:1;justify-content:center" onclick="imgConfirmAdd()">
        Añadir <kbd style="background:rgba(255,255,255,.2);border:none;border-radius:4px;padding:1px 5px;font-size:11px">↵</kbd>
      </button>
    </div>
  ` : '';

  // Queue indicator
  const queueHtml = _imgQueue.length ? `
    <div style="padding:9px 12px;background:var(--surf-low);border-radius:var(--r-lg);font-size:12px;color:var(--on-sv);margin-top:6px">
      <span class="ms" style="font-size:14px;vertical-align:middle;color:var(--primary);margin-right:4px">queue</span>
      ${_imgQueue.length} image${_imgQueue.length > 1 ? 's' : ''} en attente
    </div>
  ` : '';

  // Recent thumbnails of selected dossier
  const recentHtml = _imgActiveCourseId ? _imgRecentHtml() : '';

  el.innerHTML = `
    <!-- Dossier selector — toujours visible -->
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
      <select class="img-fsel" id="img-course-sel" style="flex:1" onchange="_imgOnDossierChange(this)">
        <option value="">— Choisir un dossier —</option>
        ${dossierOpts}
        <option value="__new__">＋ Nouveau dossier…</option>
      </select>
    </div>
    <div id="img-new-dossier-row" style="display:none;gap:8px;margin-bottom:12px">
      <input class="fi" id="img-new-course-name" placeholder="Nom du dossier…" maxlength="60"
        onkeydown="if(event.key==='Enter')_imgCreateCourse()" style="flex:1">
      <button class="btn btn-p btn-sm" onclick="_imgCreateCourse()">Créer</button>
    </div>

    <!-- Drop / paste zone -->
    <div class="img-drop-zone ${_imgPendingB64 ? 'has-image' : ''} ${!_imgActiveCourseId ? 'img-drop-zone-disabled' : ''}"
      id="img-drop-zone"
      ondragover="imgDragOver(event)" ondragleave="imgDragLeave(event)" ondrop="imgDrop(event)"
      onclick="_imgActiveCourseId && document.getElementById('img-file-input').click()">
      ${!_imgActiveCourseId
        ? `<span class="ms" style="font-size:32px;color:var(--on-sv);opacity:.25;display:block;margin-bottom:6px">folder_open</span>
           <div style="color:var(--on-sv);font-size:13px">Choisissez d'abord un dossier ci-dessus</div>`
        : dropInnerHtml
      }
    </div>
    <input type="file" id="img-file-input" accept="image/*" multiple style="display:none" onchange="imgFileSelect(event)">

    ${fieldsHtml}
    ${queueHtml}
    ${recentHtml}

    <div class="img-export-row">
      <button class="btn btn-g" style="flex:1;justify-content:center;font-size:12px" onclick="imgExport()">
        <span class="ms" style="font-size:14px">download</span> Exporter
      </button>
      <label class="btn btn-g" style="flex:1;justify-content:center;font-size:12px;cursor:pointer">
        <span class="ms" style="font-size:14px">upload</span> Importer
        <input type="file" accept=".zip" style="display:none" onchange="imgImport(event)">
      </label>
    </div>
    ${capHtml}
  `;

  _imgWirePaste();
  if (_imgPendingB64) setTimeout(() => document.getElementById('img-title-input')?.focus(), 50);
}

function _imgOnDossierChange(sel) {
  const row = document.getElementById('img-new-dossier-row');
  if (sel.value === '__new__') {
    if (row) row.style.display = 'flex';
    _imgActiveCourseId = null;
  } else {
    if (row) row.style.display = 'none';
    _imgActiveCourseId = sel.value || null;
    // Re-render recent thumbs without full re-render
    const recentEl = document.getElementById('img-recent-container');
    if (recentEl) recentEl.innerHTML = _imgRecentHtml();
    else _imgRenderTab('add');
  }
}

function _imgRecentHtml() {
  if (!_imgActiveCourseId) return '';
  const recent = [...imgItems].filter(i => i.courseId === _imgActiveCourseId).slice(-3).reverse();
  if (!recent.length) return '';
  const thumbs = [...recent, ...Array(Math.max(0, 3 - recent.length)).fill(null)].map(item =>
    item
      ? `<div class="img-recent-thumb" title="${_esc(item.title)}">
           <img src="${item.b64}" alt="${_esc(item.title)}">
         </div>`
      : `<div class="img-recent-thumb img-recent-thumb-empty"></div>`
  ).join('');
  return `
    <div style="margin-top:12px" id="img-recent-container">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--on-sv);margin-bottom:8px">
        3 dernières ajoutées
      </div>
      <div class="img-recent-strip">${thumbs}</div>
    </div>`;
}

// ── Dossier creation ──────────────────────────────────────────
function _imgCreateCourse() {
  const inp  = document.getElementById('img-new-course-name');
  const name = inp?.value?.trim();
  if (!name) { showNotif('Nom du dossier requis.', 'warn'); return; }
  const existing = imgCourses.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing) { _imgActiveCourseId = existing.id; _imgRenderTab('add'); return; }
  const course = { id: _uid(), name, createdAt: new Date().toISOString() };
  imgCourses.push(course);
  _imgSave();
  _imgActiveCourseId = course.id;
  _imgRenderTab('add');
  showNotif(`Dossier "${name}" créé ✓`, 'ok');
}

// ── Paste / drop / file ───────────────────────────────────────
let _imgPasteHandler = null;

function _imgWirePaste() {
  if (_imgPasteHandler) document.removeEventListener('paste', _imgPasteHandler);
  _imgPasteHandler = function(e) {
    if (!document.getElementById('img-drop-zone')) return; // not on add tab
    const tag = document.activeElement?.tagName;
    if (tag === 'TEXTAREA') return;
    if (tag === 'INPUT' && document.activeElement.id !== 'img-title-input') return;
    const imgs = Array.from(e.clipboardData?.items || []).filter(it => it.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    if (!_imgActiveCourseId) { showNotif('Choisis un cours d\'abord.', 'warn'); return; }
    imgs.forEach(it => { const b = it.getAsFile(); if (b) _imgQueueBlob(b); });
  };
  document.addEventListener('paste', _imgPasteHandler);
}

function imgDragOver(e) { e.preventDefault(); document.getElementById('img-drop-zone')?.classList.add('dragover'); }
function imgDragLeave()  { document.getElementById('img-drop-zone')?.classList.remove('dragover'); }
function imgDrop(e) {
  e.preventDefault();
  document.getElementById('img-drop-zone')?.classList.remove('dragover');
  if (!_imgActiveCourseId) { showNotif('Choisis un cours d\'abord.', 'warn'); return; }
  Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).forEach(f => _imgQueueBlob(f));
}

function imgFileSelect(e) {
  if (!_imgActiveCourseId) { showNotif('Choisis un cours d\'abord.', 'warn'); return; }
  Array.from(e.target.files).filter(f => f.type.startsWith('image/')).forEach(f => _imgQueueBlob(f));
  e.target.value = '';
}

function _imgQueueBlob(blob) {
  const reader = new FileReader();
  reader.onload = ev => {
    const b64  = ev.target.result;
    const mime = blob.type || 'image/jpeg';
    if (_imgPendingB64) {
      _imgQueue.push({ b64, mime });
      showNotif(`Image en file (${_imgQueue.length} en attente).`, 'ok');
      // Refresh queue indicator only
      const qEl = document.createElement('div');
      qEl.innerHTML = `
        <div style="padding:9px 12px;background:var(--surf-low);border-radius:var(--r-lg);font-size:12px;color:var(--on-sv);margin-top:6px">
          <span class="ms" style="font-size:14px;vertical-align:middle;color:var(--primary);margin-right:4px">queue</span>
          ${_imgQueue.length} image${_imgQueue.length > 1 ? 's' : ''} en attente dans la file
        </div>`;
      const existing = document.querySelector('[data-queue-indicator]');
      if (existing) existing.replaceWith(qEl.firstElementChild);
    } else {
      _imgPendingB64  = b64;
      _imgPendingMime = mime;
      _imgRenderTab('add');
    }
  };
  reader.readAsDataURL(blob);
}

function _imgClearPending() {
  _imgPendingB64  = null;
  _imgPendingMime = null;
  _imgRenderTab('add');
}

function imgConfirmAdd() {
  const titleEl = document.getElementById('img-title-input');
  const title   = titleEl?.value?.trim();
  if (!title)         { showNotif('Le titre est obligatoire.', 'warn'); titleEl?.focus(); return; }
  if (!_imgPendingB64){ showNotif('Aucune image en attente.', 'warn'); return; }
  if (!_imgActiveCourseId){ showNotif('Aucun cours actif.', 'warn'); return; }

  // Rough storage check: b64 string length × 2 bytes
  if (_imgStorageUsed() + _imgPendingB64.length * 2 > IMG_STORAGE_MAX * 0.95) {
    showNotif('Stockage presque plein ! Exportez d\'abord.', 'warn');
    return;
  }

  const region  = document.getElementById('img-region-sel')?.value || '';
  const rawTags = document.getElementById('img-tags-input')?.value || '';
  const tags    = rawTags.split(/[,;\s]+/).map(t => t.trim()).filter(Boolean);

  imgItems.push({
    id: _uid(), courseId: _imgActiveCourseId,
    title, region, tags,
    b64: _imgPendingB64, mime: _imgPendingMime || 'image/jpeg',
    createdAt: new Date().toISOString()
  });
  _imgSave();
  showNotif('Image ajoutée ✓', 'ok');

  // Next from queue or reset
  if (_imgQueue.length) {
    const next = _imgQueue.shift();
    _imgPendingB64  = next.b64;
    _imgPendingMime = next.mime;
  } else {
    _imgPendingB64  = null;
    _imgPendingMime = null;
  }
  _imgRenderTab('add');
}

// ════════════════════════════════════════════════════════
// TAB 2 — BIBLIOTHÈQUE
// ════════════════════════════════════════════════════════
function _renderImgLibrary(el) {
  // Course tabs
  const courseTabs = [
    `<button class="img-course-tab ${!_imgLibFilterCourse ? 'active' : ''}" onclick="imgLibFilterCourse('')">
      Tous (${imgItems.length})
    </button>`,
    ...imgCourses.map(c => {
      const n = imgItems.filter(i => i.courseId === c.id).length;
      return `<button class="img-course-tab ${_imgLibFilterCourse === c.id ? 'active' : ''}" onclick="imgLibFilterCourse('${c.id}')">
        ${_esc(c.name)} (${n})
      </button>`;
    })
  ].join('');

  // Filtered + searched items
  let items = _imgLibFilterCourse ? imgItems.filter(i => i.courseId === _imgLibFilterCourse) : [...imgItems];
  if (_imgLibQuery) {
    const q = _imgLibQuery.toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.region||'').toLowerCase().includes(q) ||
      (i.tags||[]).some(t => t.toLowerCase().includes(q))
    );
  }
  items = [...items].reverse(); // most recent first

  const gridHtml = items.length
    ? items.map(item => {
        const tagsHtml = [item.region, ...(item.tags||[])].filter(Boolean)
          .map(t => `<span class="img-grid-tag">${_esc(t)}</span>`).join('');
        return `<div class="img-grid-item" onclick="imgOpenDetail('${item.id}')">
          <img src="${item.b64}" alt="${_esc(item.title)}" loading="lazy">
          <div class="img-grid-info">
            <div class="img-grid-title">${_esc(item.title)}</div>
            ${tagsHtml ? `<div class="img-grid-tags">${tagsHtml}</div>` : ''}
          </div>
        </div>`;
      }).join('')
    : `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--on-sv)">
        <span class="ms" style="font-size:40px;opacity:.25;display:block;margin-bottom:8px">photo_library</span>
        ${imgItems.length ? 'Aucun résultat' : 'Aucune image — ajoutez-en dans l\'onglet Ajouter'}
      </div>`;

  el.innerHTML = `
    <div class="img-lib-bar">
      <input class="img-lib-search" type="search" placeholder="Rechercher titre, région, tag…"
        value="${_esc(_imgLibQuery)}" oninput="imgLibSearch(this.value)">
    </div>
    <div class="img-course-tabs">${courseTabs}</div>
    <div class="img-grid">${gridHtml}</div>
  `;
}

function imgLibFilterCourse(id) { _imgLibFilterCourse = id; _imgRenderTab('library'); }

function imgLibSearch(q) {
  _imgLibQuery = q;
  const el = document.getElementById('img-tab-content');
  if (el) _renderImgLibrary(el);
}

function imgOpenDetail(id) {
  const item = imgItems.find(i => i.id === id);
  if (!item) return;
  const courseName = imgCourses.find(c => c.id === item.courseId)?.name || '';
  const tagsHtml   = [item.region, ...(item.tags||[])].filter(Boolean)
    .map(t => `<span class="img-grid-tag">${_esc(t)}</span>`).join('');
  const content = document.getElementById('img-detail-content');
  if (!content) return;
  content.innerHTML = `
    <img src="${item.b64}" class="img-detail-img" alt="${_esc(item.title)}">
    <div style="font-weight:800;font-size:16px;margin-bottom:4px">${_esc(item.title)}</div>
    <div style="font-size:12px;color:var(--on-sv);margin-bottom:8px">${_esc(courseName)}</div>
    ${tagsHtml ? `<div class="img-grid-tags" style="margin-bottom:10px">${tagsHtml}</div>` : ''}
    <div style="display:flex;gap:8px">
      <button class="btn btn-g btn-sm" style="flex:1;justify-content:center" onclick="imgEditItem('${id}')">
        <span class="ms" style="font-size:14px">edit</span> Modifier
      </button>
      <button class="btn btn-d btn-sm" onclick="imgDeleteItem('${id}')">
        <span class="ms" style="font-size:14px">delete</span>
      </button>
    </div>
  `;
  openModal('modal-img-detail');
}

async function imgDeleteItem(id) {
  if (!(await kcConfirm('Supprimer cette image définitivement ?'))) return;
  imgItems = imgItems.filter(i => i.id !== id);
  delete imgProgress[id];
  _imgSave();
  closeModal('modal-img-detail');
  _imgRenderTab('library');
  showNotif('Image supprimée.', 'ok');
}

function imgEditItem(id) {
  const item    = imgItems.find(i => i.id === id);
  const content = document.getElementById('img-detail-content');
  if (!item || !content) return;
  content.innerHTML = `
    <img src="${item.b64}" class="img-detail-img" alt="">
    <div class="fg2" style="margin-bottom:10px">
      <label class="fl">Titre</label>
      <input class="fi" id="img-edit-title" value="${_esc(item.title)}" maxlength="120">
    </div>
    <div class="fg2" style="margin-bottom:10px">
      <label class="fl">Région</label>
      <input class="fi" id="img-edit-region" value="${_esc(item.region||'')}" placeholder="Tobillo, Rodilla…">
    </div>
    <div class="fg2" style="margin-bottom:14px">
      <label class="fl">Tags (séparés par virgules)</label>
      <input class="fi" id="img-edit-tags" value="${_esc((item.tags||[]).join(', '))}" placeholder="RM, agudo…">
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-g" style="flex:1;justify-content:center" onclick="imgOpenDetail('${id}')">Annuler</button>
      <button class="btn btn-p" style="flex:1;justify-content:center" onclick="imgSaveEdit('${id}')">
        <span class="ms" style="font-size:14px">save</span> Enregistrer
      </button>
    </div>
  `;
}

function imgSaveEdit(id) {
  const item  = imgItems.find(i => i.id === id);
  if (!item) return;
  const title = document.getElementById('img-edit-title')?.value?.trim();
  if (!title) { showNotif('Titre requis.', 'warn'); return; }
  item.title  = title;
  item.region = document.getElementById('img-edit-region')?.value?.trim() || '';
  item.tags   = (document.getElementById('img-edit-tags')?.value || '').split(/[,;\s]+/).map(t=>t.trim()).filter(Boolean);
  _imgSave();
  closeModal('modal-img-detail');
  _imgRenderTab('library');
  showNotif('Modifié ✓', 'ok');
}

// ════════════════════════════════════════════════════════
// TAB 3 — RÉVISER
// ════════════════════════════════════════════════════════
function _renderImgRevise(el) {
  const coursesWithItems = imgCourses.filter(c => imgItems.some(i => i.courseId === c.id));
  if (!coursesWithItems.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--on-sv)">
      <span class="ms" style="font-size:40px;opacity:.25;display:block;margin-bottom:10px">play_circle</span>
      <div style="font-weight:700;margin-bottom:6px">Aucune image à réviser</div>
      <div style="font-size:13px">Ajoutez des images dans l'onglet Ajouter</div>
    </div>`;
    return;
  }

  const totalAll   = imgItems.length;
  const sabidoAll  = imgItems.filter(i => imgProgress[i.id]?.lastEval === 'sabido').length;
  const pctAll     = totalAll ? Math.round(sabidoAll / totalAll * 100) : 0;

  const dossierCards = coursesWithItems.map(c => {
    const items  = imgItems.filter(i => i.courseId === c.id);
    const total  = items.length;
    const sabido = items.filter(i => imgProgress[i.id]?.lastEval === 'sabido').length;
    const pct    = total ? Math.round(sabido / total * 100) : 0;
    return `<div class="img-rev-card" onclick="startImgRevision('${c.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:15px;margin-bottom:4px">${_esc(c.name)}</div>
        <div style="font-size:12px;color:var(--on-sv);margin-bottom:6px">${total} image${total !== 1 ? 's' : ''} · ${pct}% mémorisé</div>
        <div class="pbar" style="max-width:160px"><div class="pfill" style="width:${pct}%"></div></div>
      </div>
      <span class="ms" style="color:var(--on-sv);font-size:24px;margin-left:12px">chevron_right</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <!-- Tout réviser -->
    <div class="img-rev-card img-rev-card-all" onclick="startImgRevision('all')" style="background:linear-gradient(135deg,var(--primary),#006699);margin-bottom:16px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:16px;color:#fff;margin-bottom:4px">Tout réviser</div>
        <div style="font-size:12px;color:rgba(255,255,255,.75);margin-bottom:6px">
          ${totalAll} image${totalAll !== 1 ? 's' : ''} · ${pctAll}% mémorisé
        </div>
        <div class="pbar" style="max-width:160px;background:rgba(255,255,255,.2)">
          <div class="pfill" style="width:${pctAll}%;background:#fff"></div>
        </div>
      </div>
      <span class="ms" style="color:rgba(255,255,255,.6);font-size:28px;margin-left:12px">play_circle</span>
    </div>

    <!-- Par dossier -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--on-sv);margin-bottom:10px">Par dossier</div>
    ${dossierCards}
  `;
}

function startImgRevision(courseId) {
  const items = courseId === 'all'
    ? [...imgItems]
    : imgItems.filter(i => i.courseId === courseId);
  if (!items.length) { showNotif('Aucune image à réviser.', 'warn'); return; }
  const label = courseId === 'all'
    ? 'Tout réviser'
    : (imgCourses.find(c => c.id === courseId)?.name || 'Imagerie');
  _imgRevSession = {
    courseId,
    label,
    images: shuffle([...items]),
    cur: 0,
    results: [],
    startTime: Date.now()
  };
  _imgRevSession.total = _imgRevSession.images.length;
  showScreen('imaging-session');
  _renderImgRevSlide();
}

function _renderImgRevSlide() {
  const s = _imgRevSession;
  if (!s) return;
  if (s.cur >= s.total) { _endImgRevSession(); return; }

  const pct = (s.cur / s.total) * 100;
  const el  = document.getElementById('img-sprog');
  const ctr = document.getElementById('img-scounter');
  const ctx = document.getElementById('img-sctx');
  if (el)  el.style.width     = pct + '%';
  if (ctr) ctr.textContent    = `${s.cur + 1} / ${s.total}`;
  if (ctx) ctx.textContent    = s.label || 'Imagerie';

  const img  = s.images[s.cur];
  const area = document.getElementById('img-area');
  if (!area) return;

  area.innerHTML = `
    <div style="background:#0a0a0a;border-radius:var(--r-xl);overflow:hidden;margin-bottom:14px">
      <img src="${img.b64}" style="width:100%;max-height:340px;object-fit:contain;display:block" alt="">
    </div>
    <div id="img-rev-answer" style="display:none;background:var(--surface);border-radius:var(--r-xl);padding:14px 16px;margin-bottom:14px;box-shadow:var(--sh)">
      <div style="font-weight:800;font-size:16px;margin-bottom:4px">${_esc(img.title)}</div>
      ${img.region ? `<div style="font-size:12px;color:var(--on-sv);margin-bottom:6px">${_esc(img.region)}</div>` : ''}
      ${(img.tags||[]).length
        ? `<div class="img-grid-tags">${img.tags.map(t=>`<span class="img-grid-tag">${_esc(t)}</span>`).join('')}</div>`
        : ''}
    </div>
    <div id="img-rev-actions">
      <button class="btn btn-g btn-lg" style="width:100%;justify-content:center" onclick="revealImgTitle()">
        <span class="ms" style="font-size:15px">visibility</span> Voir le titre
      </button>
    </div>
  `;
}

function revealImgTitle() {
  const ans  = document.getElementById('img-rev-answer');
  const acts = document.getElementById('img-rev-actions');
  if (ans)  ans.style.display = 'block';
  if (!acts) return;
  acts.innerHTML = `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--on-sv);text-align:center;margin-bottom:10px">
      Auto-évaluation
    </div>
    <div style="display:flex;gap:8px">
      <button class="img-eval-btn img-ev-rate" onclick="evalImgRev('noSabido')">
        <span class="ms">close</span> No sabido
      </button>
      <button class="img-eval-btn img-ev-hard" onclick="evalImgRev('dudoso')">
        <span class="ms">remove</span> Dudoso
      </button>
      <button class="img-eval-btn img-ev-easy" onclick="evalImgRev('sabido')">
        <span class="ms">check</span> Sabido
      </button>
    </div>
  `;
}

function evalImgRev(ev) {
  const s   = _imgRevSession;
  if (!s)   return;
  const img = s.images[s.cur];
  const p   = imgProgress[img.id] || { views:0, sabido:0, dudoso:0, noSabido:0 };
  p.views    = (p.views||0) + 1;
  p.lastEval = ev;
  p.lastDate = new Date().toDateString();
  p[ev]      = (p[ev]||0) + 1;
  imgProgress[img.id] = p;
  _imgSave();
  s.results.push({ id: img.id, eval: ev });
  s.cur++;
  _renderImgRevSlide();
}

function exitImgRevSession() {
  _imgRevSession = null;
  _imgActiveTab  = 'revise';
  showImagingHub();
}

function _endImgRevSession() {
  const s    = _imgRevSession;
  const area = document.getElementById('img-area');
  const elapsed = Math.floor((Date.now() - s.startTime) / 1000);

  const sabido   = s.results.filter(r => r.eval === 'sabido').length;
  const dudoso   = s.results.filter(r => r.eval === 'dudoso').length;
  const noSabido = s.results.filter(r => r.eval === 'noSabido').length;
  const ratio    = s.total ? sabido / s.total : 0;
  const emoji    = ratio >= 0.8 ? '🎉' : ratio >= 0.5 ? '💪' : '📖';

  const prog = document.getElementById('img-sprog');
  const ctr  = document.getElementById('img-scounter');
  if (prog) prog.style.width  = '100%';
  if (ctr)  ctr.textContent   = `${s.total} / ${s.total}`;

  if (area) area.innerHTML = `
    <div style="text-align:center;padding:24px 0 16px">
      <div style="font-size:52px;margin-bottom:10px">${emoji}</div>
      <div class="hf" style="font-size:24px;font-weight:800;margin-bottom:4px">Session terminée !</div>
      <div style="font-size:13px;color:var(--on-sv)">${s.total} image${s.total>1?'s':''} · ${formatTime(elapsed)}</div>
    </div>
    <div class="sstrip" style="margin-bottom:20px">
      <div class="sbox"><div class="snum" style="color:var(--tertiary)">${sabido}</div><div class="slbl">Sabido ✅</div></div>
      <div class="sbox"><div class="snum" style="color:var(--gold)">${dudoso}</div><div class="slbl">Dudoso ⚠️</div></div>
      <div class="sbox"><div class="snum" style="color:var(--error)">${noSabido}</div><div class="slbl">No sabido ❌</div></div>
    </div>
    <div class="fr" style="gap:10px">
      <button class="btn btn-p" style="flex:1;justify-content:center" onclick="startImgRevision('${s.courseId}')">
        🔄 Rejouer
      </button>
      <button class="btn btn-g" style="flex:1;justify-content:center" onclick="exitImgRevSession()">
        ← Retour
      </button>
    </div>
  `;
  _imgRevSession = null;
}

// ════════════════════════════════════════════════════════
// EXPORT / IMPORT (JSZip)
// ════════════════════════════════════════════════════════
async function imgExport() {
  if (typeof JSZip === 'undefined') { showNotif('JSZip non disponible. Réessayez.', 'warn'); return; }
  if (!imgItems.length) { showNotif('Aucune image à exporter.', 'warn'); return; }

  showNotif('Préparation de l\'export…');
  const zip       = new JSZip();
  const imgFolder = zip.folder('images');
  const metadata  = [];

  for (const item of imgItems) {
    const ext      = (item.mime||'image/jpeg').split('/')[1] || 'jpg';
    const filename = `${item.id}.${ext}`;
    const b64raw   = (item.b64||'').split(',')[1] || item.b64;
    imgFolder.file(filename, b64raw, { base64: true });
    metadata.push({ id:item.id, courseId:item.courseId, title:item.title,
      region:item.region||'', tags:item.tags||[], mime:item.mime||'image/jpeg',
      filename, createdAt:item.createdAt });
  }

  zip.file('images.json', JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    courses: imgCourses,
    images: metadata,
    progress: imgProgress
  }, null, 2));

  zip.file('README.txt', [
    'City Work — Pack Imagerie',
    '=======================',
    `Exporté le : ${new Date().toLocaleDateString('fr-FR')}`,
    `${imgItems.length} images dans ${imgCourses.length} cours`,
    '',
    'Pour importer dans City Work :',
    '1. Ouvrir l\'onglet Imagerie → Ajouter',
    '2. Cliquer "Importer pack"',
    '3. Sélectionner ce fichier ZIP',
    '',
    'Les données existantes ne seront pas écrasées.'
  ].join('\n'));

  const blob = await zip.generateAsync({ type:'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `kineplus-imagerie-${new Date().toISOString().slice(0,10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  showNotif(`${imgItems.length} images exportées ✓`, 'ok');
}

async function imgImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (typeof JSZip === 'undefined') { showNotif('JSZip non disponible. Réessayez.', 'warn'); return; }

  showNotif('Import en cours…');
  try {
    const zip      = await JSZip.loadAsync(file);
    const jsonFile = zip.file('images.json');
    if (!jsonFile) throw new Error('images.json introuvable dans le ZIP');
    const data = JSON.parse(await jsonFile.async('string'));

    const existingCourseIds = new Set(imgCourses.map(c => c.id));
    let newCourses = 0;
    for (const c of (data.courses||[])) {
      if (!existingCourseIds.has(c.id)) { imgCourses.push(c); newCourses++; }
    }

    const existingItemIds = new Set(imgItems.map(i => i.id));
    let newImages = 0;
    for (const meta of (data.images||[])) {
      if (existingItemIds.has(meta.id)) continue;
      const imgFile = zip.file(`images/${meta.filename}`);
      if (!imgFile) continue;
      const b64raw = await imgFile.async('base64');
      imgItems.push({
        id:meta.id, courseId:meta.courseId, title:meta.title,
        region:meta.region||'', tags:meta.tags||[],
        b64:`data:${meta.mime||'image/jpeg'};base64,${b64raw}`,
        mime:meta.mime||'image/jpeg', createdAt:meta.createdAt
      });
      newImages++;
    }

    for (const [id, p] of Object.entries(data.progress||{})) {
      if (!imgProgress[id]) imgProgress[id] = p;
    }

    _imgSave();
    showNotif(`Import : ${newImages} image${newImages!==1?'s':''}, ${newCourses} cours ajouté${newCourses!==1?'s':''} ✓`, 'ok');
    _imgRenderTab(_imgActiveTab);
  } catch(err) {
    showNotif('Erreur import : ' + err.message, 'warn');
  }
  e.target.value = '';
}

// ════════════════════════════════════════════════════════
// PROFIL SECTION (section sur l'écran profil)
// ════════════════════════════════════════════════════════
function renderImgProfil() {
  const el = document.getElementById('img-profil-section');
  if (!el) return;
  if (!imgItems.length) { el.style.display = 'none'; return; }

  const byCourse = {};
  imgItems.forEach(item => {
    const name = imgCourses.find(c => c.id === item.courseId)?.name || 'Sans cours';
    if (!byCourse[name]) byCourse[name] = { total:0, sabido:0 };
    byCourse[name].total++;
    if (imgProgress[item.id]?.lastEval === 'sabido') byCourse[name].sabido++;
  });

  const total  = imgItems.length;
  const sabido = Object.values(byCourse).reduce((a,b) => a + b.sabido, 0);
  const pct    = total ? Math.round(sabido / total * 100) : 0;

  const rows = Object.entries(byCourse).map(([name, d]) => {
    const tp = Math.round(d.sabido / d.total * 100);
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:600">${_esc(name)}</span>
        <span style="color:var(--on-sv)">${d.sabido}/${d.total} · ${tp}%</span>
      </div>
      <div class="pbar"><div class="pfill" style="width:${tp}%"></div></div>
    </div>`;
  }).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div class="img-profil-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="ms f" style="color:var(--primary);font-size:22px">radiology</span>
          <span class="hf" style="font-weight:800;font-size:15px">Imagerie médicale</span>
        </div>
        <span style="font-size:24px;font-weight:800;color:var(--tertiary)">${pct}%</span>
      </div>
      <div class="sstrip" style="margin-bottom:14px">
        <div class="img-stat-box"><div class="img-stat-num" style="color:var(--tertiary)">${sabido}</div><div class="img-stat-lbl">Sabido</div></div>
        <div class="img-stat-box"><div class="img-stat-num" style="color:var(--on-sv)">${total-sabido}</div><div class="img-stat-lbl">À revoir</div></div>
        <div class="img-stat-box"><div class="img-stat-num">${total}</div><div class="img-stat-lbl">Total</div></div>
      </div>
      ${rows}
      <button class="btn btn-g" style="width:100%;justify-content:center;margin-top:10px" onclick="showImagingHub()">
        <span class="ms" style="font-size:15px">radiology</span> Aller à l'Imagerie
      </button>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { if (imgItems.length) renderImgProfil(); }, 800);
});
