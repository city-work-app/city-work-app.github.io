/* ═══════════════════════════════════════════
   AUDIO RECORDINGS — audio.js
   IndexedDB pour les blobs, localStorage pour les métadonnées
═══════════════════════════════════════════ */

// ── State ──
let audioFolders = [];
let audioRecordings = [];
let _audioCurFolder = null;
let _audioEditFolderId = null;
let _audioRenameId = null;
let _audioMoveId = null;
let _mediaRecorder = null;
let _audioChunks = [];
let _audioTimerInterval = null;
let _audioTimerSecs = 0;
let _audioStream = null;
let _audioAnalyser = null;
let _audioAnimFrame = null;
let _audioPlayers = {}; // id -> HTMLAudioElement

// ── IndexedDB ──
let _audioDB = null;

function _openAudioDB() {
  return new Promise((resolve, reject) => {
    if (_audioDB) { resolve(_audioDB); return; }
    const req = indexedDB.open('kineplus_audio', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('blobs', { keyPath: 'id' });
    };
    req.onsuccess = e => { _audioDB = e.target.result; resolve(_audioDB); };
    req.onerror = () => reject(req.error);
  });
}

async function _saveAudioBlob(id, blob) {
  const db = await _openAudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put({ id, blob });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function _getAudioBlob(id) {
  const db = await _openAudioDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('blobs').objectStore('blobs').get(id);
    req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    req.onerror = () => reject(req.error);
  });
}

async function _deleteAudioBlob(id) {
  const db = await _openAudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ── Persistence ──
function _loadAudioData() {
  try { audioFolders = JSON.parse(localStorage.getItem('kcu_af') || '[]'); } catch { audioFolders = []; }
  try { audioRecordings = JSON.parse(localStorage.getItem('kcu_ar') || '[]'); } catch { audioRecordings = []; }
}

function _saveAudioData() {
  localStorage.setItem('kcu_af', JSON.stringify(audioFolders));
  localStorage.setItem('kcu_ar', JSON.stringify(audioRecordings));
}

function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function _fmtDuration(secs) {
  if (!secs || isNaN(secs)) return '—';
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function _fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function _fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ── Init ──
function initAudio() {
  _loadAudioData();
}

// ── Navigation ──
function showAudioHub() {
  _loadAudioData();
  showScreen('audio');
  renderAudioHub();
}

function showAudioFolder(folderId) {
  window._audioCurFolder = folderId;
  const folder = audioFolders.find(f => f.id === folderId);
  document.getElementById('audio-folder-title').textContent = folder ? folder.name : 'Dossier';
  showScreen('audio-folder');
  renderAudioFolderList(folderId);
}

// ── Render hub ──
function renderAudioHub() {
  const list = document.getElementById('audio-hub-list');
  if (!list) return;
  let html = '';

  // Folders
  if (audioFolders.length) {
    html += `<span class="sl">Dossiers</span>`;
    audioFolders.forEach(f => {
      const recs = audioRecordings.filter(r => r.folderId === f.id);
      html += `<div class="audio-folder-card" onclick="showAudioFolder('${f.id}')">
        <div class="audio-folder-icon"><span class="ms">folder</span></div>
        <div style="flex:1;min-width:0">
          <div class="audio-folder-name">${_escA(f.name)}</div>
          <div class="audio-folder-meta">${recs.length} enregistrement${recs.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="audio-item-action" onclick="event.stopPropagation();audioEditFolder('${f.id}')" title="Modifier"><span class="ms">edit</span></button>
        <span class="ms" style="color:var(--on-sv);font-size:22px">chevron_right</span>
      </div>`;
    });
  }

  // Unfiled recordings
  const unfiled = audioRecordings.filter(r => !r.folderId);
  if (unfiled.length) {
    html += `<span class="sl" style="margin-top:${audioFolders.length ? '20px' : '0'}">Sans dossier</span>`;
    unfiled.forEach(r => { html += _renderAudioItem(r); });
  }

  if (!audioFolders.length && !unfiled.length) {
    html = `<div class="audio-empty">
      <span class="ms">mic_none</span>
      <p>Aucun enregistrement</p>
      <span>Appuie sur "Enregistrer" ou glisse un fichier audio ci-dessus.</span>
    </div>`;
  }

  list.innerHTML = html;
  _attachPlayers();
}

// ── Render folder list ──
function renderAudioFolderList(folderId) {
  const list = document.getElementById('audio-folder-list');
  if (!list) return;
  const recs = audioRecordings.filter(r => r.folderId === folderId);
  if (!recs.length) {
    list.innerHTML = `<div class="audio-empty">
      <span class="ms">mic_none</span>
      <p>Dossier vide</p>
      <span>Enregistre ou importe un fichier audio.</span>
    </div>`;
    return;
  }
  list.innerHTML = recs.map(r => _renderAudioItem(r)).join('');
  _attachPlayers();
}

function _renderAudioItem(r) {
  const meta = [_fmtDuration(r.duration), _fmtDate(r.createdAt), r.size ? _fmtSize(r.size) : ''].filter(Boolean).join(' · ');
  return `<div class="audio-item" id="audio-item-${r.id}">
    <div class="audio-item-top">
      <button class="audio-play-btn" onclick="audioTogglePlay('${r.id}')" id="audio-playbtn-${r.id}">
        <span class="ms" id="audio-playicon-${r.id}">play_arrow</span>
      </button>
      <div class="audio-item-info">
        <div class="audio-item-name">${_escA(r.name || 'Enregistrement')}</div>
        <div class="audio-item-meta">${meta}</div>
      </div>
      <div class="audio-item-actions">
        <button class="audio-item-action" onclick="audioRename('${r.id}')" title="Renommer"><span class="ms">edit</span></button>
        <button class="audio-item-action" onclick="audioMove('${r.id}')" title="Déplacer"><span class="ms">drive_file_move</span></button>
        <button class="audio-item-action" onclick="audioDelete('${r.id}')" title="Supprimer" style="color:var(--error)"><span class="ms">delete</span></button>
      </div>
    </div>
    <div class="audio-player-bar" id="audio-bar-${r.id}">
      <input type="range" class="audio-seek" id="audio-seek-${r.id}" value="0" min="0" step="0.1"
        oninput="audioSeek('${r.id}',this.value)">
      <span class="audio-time" id="audio-time-${r.id}">0:00 / ${_fmtDuration(r.duration)}</span>
    </div>
  </div>`;
}

// ── Players ──
function _attachPlayers() {
  // Players are created lazily on first play
}

async function audioTogglePlay(id) {
  const icon = document.getElementById('audio-playicon-' + id);
  const bar = document.getElementById('audio-bar-' + id);
  const seek = document.getElementById('audio-seek-' + id);
  const timeEl = document.getElementById('audio-time-' + id);

  // If already playing this one, pause it
  if (_audioPlayers[id] && !_audioPlayers[id].paused) {
    _audioPlayers[id].pause();
    if (icon) icon.textContent = 'play_arrow';
    return;
  }

  // Pause any other playing
  Object.entries(_audioPlayers).forEach(([pid, player]) => {
    if (pid !== id && !player.paused) {
      player.pause();
      const i = document.getElementById('audio-playicon-' + pid);
      if (i) i.textContent = 'play_arrow';
    }
  });

  // Load blob if not cached
  if (!_audioPlayers[id]) {
    const blob = await _getAudioBlob(id);
    if (!blob) { showNotif('Fichier audio introuvable', ''); return; }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _audioPlayers[id] = audio;

    const rec = audioRecordings.find(r => r.id === id);

    audio.addEventListener('timeupdate', () => {
      if (seek) { seek.max = audio.duration || 0; seek.value = audio.currentTime; }
      if (timeEl) timeEl.textContent = `${_fmtDuration(audio.currentTime)} / ${_fmtDuration(rec ? rec.duration : audio.duration)}`;
    });
    audio.addEventListener('ended', () => {
      if (icon) icon.textContent = 'play_arrow';
      if (seek) seek.value = 0;
      // Update duration if not stored
      if (rec && !rec.duration && audio.duration) {
        rec.duration = Math.round(audio.duration);
        _saveAudioData();
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      if (seek) seek.max = audio.duration;
      if (rec && !rec.duration && audio.duration && isFinite(audio.duration)) {
        rec.duration = Math.round(audio.duration);
        _saveAudioData();
        const metaEl = document.querySelector(`#audio-item-${id} .audio-item-meta`);
        if (metaEl) {
          const m = [_fmtDuration(rec.duration), _fmtDate(rec.createdAt), rec.size ? _fmtSize(rec.size) : ''].filter(Boolean).join(' · ');
          metaEl.textContent = m;
        }
        if (timeEl) timeEl.textContent = `0:00 / ${_fmtDuration(rec.duration)}`;
      }
    });
  }

  // Show player bar
  if (bar) bar.classList.add('visible');
  _audioPlayers[id].play();
  if (icon) icon.textContent = 'pause';
}

function audioSeek(id, val) {
  if (_audioPlayers[id]) _audioPlayers[id].currentTime = parseFloat(val);
}

// ── Folder CRUD ──
function audioOpenNewFolder() {
  _audioEditFolderId = null;
  document.getElementById('audio-folder-modal-title').textContent = 'Nouveau dossier';
  document.getElementById('audio-folder-name-input').value = '';
  document.getElementById('audio-folder-del-btn').style.display = 'none';
  openModal('modal-audio-folder');
  setTimeout(() => document.getElementById('audio-folder-name-input').focus(), 100);
}

function audioEditFolder(id) {
  const f = audioFolders.find(x => x.id === id);
  if (!f) return;
  _audioEditFolderId = id;
  document.getElementById('audio-folder-modal-title').textContent = 'Modifier le dossier';
  document.getElementById('audio-folder-name-input').value = f.name;
  document.getElementById('audio-folder-del-btn').style.display = 'inline-flex';
  openModal('modal-audio-folder');
  setTimeout(() => document.getElementById('audio-folder-name-input').focus(), 100);
}

function audioSaveFolder() {
  const name = document.getElementById('audio-folder-name-input').value.trim();
  if (!name) { showNotif('Entre un nom de dossier', ''); return; }
  if (_audioEditFolderId) {
    const f = audioFolders.find(x => x.id === _audioEditFolderId);
    if (f) { f.name = name; }
    if (document.getElementById('audio-folder-title')) {
      document.getElementById('audio-folder-title').textContent = name;
    }
  } else {
    audioFolders.push({ id: _uid(), name, createdAt: new Date().toISOString() });
  }
  _saveAudioData();
  closeModal('modal-audio-folder');
  if (document.body.dataset.screen === 'audio') renderAudioHub();
  showNotif(_audioEditFolderId ? 'Dossier modifié' : 'Dossier créé', 'ok');
}

async function audioDeleteFolder() {
  if (!_audioEditFolderId) return;
  const f = audioFolders.find(x => x.id === _audioEditFolderId);
  if (!(await kcConfirm(`Supprimer le dossier "${f?.name}" ? Les enregistrements seront déplacés dans "Sans dossier".`))) return;
  audioFolders = audioFolders.filter(x => x.id !== _audioEditFolderId);
  audioRecordings.forEach(r => { if (r.folderId === _audioEditFolderId) r.folderId = null; });
  _saveAudioData();
  closeModal('modal-audio-folder');
  if (document.body.dataset.screen === 'audio-folder') showScreen('audio');
  renderAudioHub();
  showNotif('Dossier supprimé', 'ok');
}

// ── Recording CRUD ──
function audioRename(id) {
  const r = audioRecordings.find(x => x.id === id);
  if (!r) return;
  _audioRenameId = id;
  document.getElementById('audio-rename-input').value = r.name || '';
  openModal('modal-audio-rename');
  setTimeout(() => document.getElementById('audio-rename-input').focus(), 100);
}

function audioConfirmRename() {
  const name = document.getElementById('audio-rename-input').value.trim();
  if (!name) return;
  const r = audioRecordings.find(x => x.id === _audioRenameId);
  if (r) {
    r.name = name;
    _saveAudioData();
    const el = document.querySelector(`#audio-item-${r.id} .audio-item-name`);
    if (el) el.textContent = name;
  }
  closeModal('modal-audio-rename');
  showNotif('Renommé', 'ok');
}

function audioMove(id) {
  _audioMoveId = id;
  const list = document.getElementById('audio-move-list');
  if (!list) return;
  let html = `<button class="afc-move-opt" onclick="audioApplyMove(null)">
    <span class="ms" style="font-size:16px">inbox</span> Sans dossier
  </button>`;
  audioFolders.forEach(f => {
    html += `<button class="afc-move-opt" onclick="audioApplyMove('${f.id}')">
      <span class="ms" style="font-size:16px">folder</span> ${_escA(f.name)}
    </button>`;
  });
  list.innerHTML = html;
  openModal('modal-audio-move');
}

function audioApplyMove(folderId) {
  const r = audioRecordings.find(x => x.id === _audioMoveId);
  if (r) { r.folderId = folderId || null; _saveAudioData(); }
  closeModal('modal-audio-move');
  if (document.body.dataset.screen === 'audio') renderAudioHub();
  else if (document.body.dataset.screen === 'audio-folder') renderAudioFolderList(window._audioCurFolder);
  showNotif('Déplacé !', 'ok');
}

async function audioDelete(id) {
  const r = audioRecordings.find(x => x.id === id);
  if (!r) return;
  if (!(await kcConfirm(`Supprimer "${r.name || 'cet enregistrement'}" ?`))) return;
  // Stop player if playing
  if (_audioPlayers[id]) { _audioPlayers[id].pause(); delete _audioPlayers[id]; }
  await _deleteAudioBlob(id);
  audioRecordings = audioRecordings.filter(x => x.id !== id);
  _saveAudioData();
  const el = document.getElementById('audio-item-' + id);
  if (el) el.remove();
  showNotif('Supprimé', 'ok');
}

// ── Upload ──
function audioDrop(e) {
  e.preventDefault();
  document.getElementById('audio-upload-zone').classList.remove('drag-over');
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('audio/'));
  if (!files.length) { showNotif('Format non supporté', ''); return; }
  audioUploadFiles(files, null);
}

function audioUploadToFolder() {
  const inp = document.getElementById('audio-upload-input');
  inp.dataset.targetFolder = window._audioCurFolder || '';
  inp.click();
}

function audioUploadFilesFromInput(input) {
  const folderId = input.dataset.targetFolder || null;
  audioUploadFiles(input.files, folderId);
  input.value = '';
}

async function audioUploadFiles(files, folderId) {
  if (!files || !files.length) return;
  let count = 0;
  for (const file of files) {
    if (!file.type.startsWith('audio/')) continue;
    const id = _uid();
    const name = file.name.replace(/\.[^.]+$/, '');
    await _saveAudioBlob(id, file);
    const rec = {
      id, name,
      folderId: folderId || null,
      duration: null,
      size: file.size,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    };
    // Try to read duration
    try {
      await new Promise(res => {
        const a = new Audio();
        a.src = URL.createObjectURL(file);
        a.onloadedmetadata = () => {
          if (isFinite(a.duration)) rec.duration = Math.round(a.duration);
          res();
        };
        a.onerror = res;
        setTimeout(res, 3000);
      });
    } catch {}
    audioRecordings.push(rec);
    count++;
  }
  _saveAudioData();
  if (document.body.dataset.screen === 'audio') renderAudioHub();
  else if (document.body.dataset.screen === 'audio-folder') renderAudioFolderList(window._audioCurFolder);
  showNotif(`${count} fichier${count > 1 ? 's' : ''} importé${count > 1 ? 's' : ''} !`, 'ok');
}

// ── Recording ──
function audioOpenRecordModal(folderId) {
  // Populate folder select
  const sel = document.getElementById('audio-rec-folder');
  sel.innerHTML = `<option value="">Sans dossier</option>` +
    audioFolders.map(f => `<option value="${f.id}"${f.id === folderId ? ' selected' : ''}>${_escA(f.name)}</option>`).join('');
  if (folderId) sel.value = folderId;

  // Default name
  const d = new Date();
  document.getElementById('audio-rec-name').value =
    `Enregistrement – ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;

  // Reset UI
  _resetRecorderUI();
  openModal('modal-audio-record');
}

function _resetRecorderUI() {
  document.getElementById('audio-rec-start-btn').style.display = 'inline-flex';
  document.getElementById('audio-rec-stop-btn').style.display = 'none';
  document.getElementById('audio-rec-pause-btn').style.display = 'none';
  document.getElementById('audio-rec-timer').textContent = '0:00';
  _clearCanvas();
}

function _clearCanvas() {
  const c = document.getElementById('audio-rec-canvas');
  if (!c) return;
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

async function audioStartRecording() {
  try {
    _audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showNotif('Accès micro refusé — autorise le micro dans les paramètres du navigateur.', '');
    return;
  }

  _audioChunks = [];
  _mediaRecorder = new MediaRecorder(_audioStream);
  _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _audioChunks.push(e.data); };
  _mediaRecorder.onstop = _onRecordingStop;
  _mediaRecorder.start(100);

  // Timer
  _audioTimerSecs = 0;
  _audioTimerInterval = setInterval(() => {
    _audioTimerSecs++;
    const m = Math.floor(_audioTimerSecs / 60), s = _audioTimerSecs % 60;
    const el = document.getElementById('audio-rec-timer');
    if (el) el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);

  // Waveform
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(_audioStream);
  _audioAnalyser = ctx.createAnalyser();
  _audioAnalyser.fftSize = 256;
  src.connect(_audioAnalyser);
  _drawWaveform();

  document.getElementById('audio-rec-start-btn').style.display = 'none';
  document.getElementById('audio-rec-stop-btn').style.display = 'inline-flex';
  document.getElementById('audio-rec-pause-btn').style.display = 'inline-flex';
}

function _drawWaveform() {
  const canvas = document.getElementById('audio-rec-canvas');
  if (!canvas || !_audioAnalyser) return;
  const ctx = canvas.getContext('2d');
  const data = new Uint8Array(_audioAnalyser.frequencyBinCount);
  _audioAnalyser.getByteFrequencyData(data);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const barW = Math.floor(canvas.width / data.length * 2.5);
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#006699';
  ctx.fillStyle = primary;
  for (let i = 0; i < data.length; i++) {
    const h = (data[i] / 255) * canvas.height;
    ctx.fillRect(i * (barW + 1), (canvas.height - h) / 2, barW, h || 2);
  }
  _audioAnimFrame = requestAnimationFrame(_drawWaveform);
}

function audioPauseResume() {
  if (!_mediaRecorder) return;
  if (_mediaRecorder.state === 'recording') {
    _mediaRecorder.pause();
    clearInterval(_audioTimerInterval);
    cancelAnimationFrame(_audioAnimFrame);
    document.getElementById('audio-rec-pause-icon').textContent = 'play_arrow';
  } else if (_mediaRecorder.state === 'paused') {
    _mediaRecorder.resume();
    _audioTimerInterval = setInterval(() => {
      _audioTimerSecs++;
      const m = Math.floor(_audioTimerSecs / 60), s = _audioTimerSecs % 60;
      const el = document.getElementById('audio-rec-timer');
      if (el) el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
    _drawWaveform();
    document.getElementById('audio-rec-pause-icon').textContent = 'pause';
  }
}

function audioStopRecording() {
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
    _mediaRecorder.stop();
  }
  clearInterval(_audioTimerInterval);
  cancelAnimationFrame(_audioAnimFrame);
  if (_audioStream) { _audioStream.getTracks().forEach(t => t.stop()); _audioStream = null; }
}

async function _onRecordingStop() {
  const blob = new Blob(_audioChunks, { type: _mediaRecorder.mimeType || 'audio/webm' });
  const name = document.getElementById('audio-rec-name').value.trim() || 'Enregistrement';
  const folderId = document.getElementById('audio-rec-folder').value || null;

  const id = _uid();
  await _saveAudioBlob(id, blob);

  const rec = {
    id, name,
    folderId: folderId || null,
    duration: _audioTimerSecs,
    size: blob.size,
    mimeType: blob.type,
    createdAt: new Date().toISOString(),
  };
  audioRecordings.push(rec);
  _saveAudioData();

  closeModal('modal-audio-record');
  _resetRecorderUI();

  // Navigate to the folder or hub
  if (folderId) showAudioFolder(folderId);
  else { if (document.body.dataset.screen === 'audio') renderAudioHub(); }
  showNotif(`"${name}" enregistré !`, 'ok');
}

function audioCancelRecord() {
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
    _mediaRecorder.stop();
    _audioChunks = [];
  }
  clearInterval(_audioTimerInterval);
  cancelAnimationFrame(_audioAnimFrame);
  if (_audioStream) { _audioStream.getTracks().forEach(t => t.stop()); _audioStream = null; }
  _resetRecorderUI();
  closeModal('modal-audio-record');
}

// ── Utility ──
function _escA(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', initAudio);
