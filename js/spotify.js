/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  spotify.js — Kiné+ Spotify Integration                                ║
 * ║  Extrait de index.html — ne plus modifier le HTML pour cette logique   ║
 * ║                                                                         ║
 * ║  Auth   : PKCE (Authorization Code Flow)                               ║
 * ║  Poll   : /me/player toutes les 1.5 s                                  ║
 * ║  Public : window.spotifyLogin, window.spotifyPlayPause,                ║
 * ║           window.spotifyPrev, window.spotifyNext,                      ║
 * ║           window.spShuffle, window.spRepeat,                           ║
 * ║           window.spSeekClick, window.spVolumeInput,                    ║
 * ║           window.spVolumeCommit, window.spTogglePanel                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  /* ── Config ── */
  const CLIENT_ID   = '243290f32a424837a83de95b04c13a4a';
  // Adresse de retour après la connexion (13 nov. 2026) : avant, toujours http://127.0.0.1:8080/files/,
  // donc « ERR_CONNECTION_REFUSED » quand Kiné+ n'était pas ouvert à cette adresse. Maintenant : l'adresse
  // de la page elle-même (elle doit être ajoutée dans les « Redirect URIs » de l'appli Spotify Developer).
  const SP_HOME = 'http://127.0.0.1:8080/files/';   // adresse ouverte par le lanceur « Ouvrir Kiné+.command »
  const REDIRECT_URI = (function () {
    const L = window.location;
    if (L.protocol !== 'http:' && L.protocol !== 'https:') return SP_HOME;
    return L.origin + L.pathname.replace(/index\.html$/, '');
  })();
  // Spotify refuse de renvoyer vers un fichier (file://) et vers « localhost » (il faut 127.0.0.1)
  function spWhyNot() {
    const L = window.location;
    if (L.protocol !== 'http:' && L.protocol !== 'https:') return 'file';   // fichier ouvert depuis le disque (file://)
    if (L.hostname === 'localhost') return 'localhost';
    return '';
  }
  function spHelp(why) {
    const old = document.getElementById('sp-help');if (old) old.remove();
    const d = document.createElement('div');d.id = 'sp-help';
    d.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(10,20,30,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif';
    const msg = why === 'localhost'
      ? `<p style="margin:0 0 10px">Spotify n’accepte pas l’adresse « localhost ». Ouvre plutôt City Work à l’adresse <b>http://127.0.0.1${window.location.port ? ':' + window.location.port : ''}${window.location.pathname}</b>, puis reconnecte-toi.</p>`
      : `<p style="margin:0 0 10px">Après la connexion, Spotify doit te renvoyer vers City Work. Il ne sait pas le faire quand City Work est ouvert comme un simple fichier (double-clic sur <b>index.html</b>).</p>
         <p style="margin:0 0 10px"><b>Pour utiliser Spotify :</b> ouvre City Work en double-cliquant sur <b>« Ouvrir Kiné+ »</b> dans le dossier <b>!Kine</b> (il lance City Work à l’adresse ${SP_HOME}).</p>
         <p style="margin:0 0 10px"><b>Attention, la première fois :</b> à cette nouvelle adresse, le navigateur range les données à part. Avant, fais <b>Profil → Données → Exporter</b> ici, puis <b>Importer</b> le fichier là-bas : tu retrouveras tes questions, ta ville et tes statistiques.</p>`;
    d.innerHTML = `<div style="background:#fff;color:#1d2a25;max-width:440px;border-radius:18px;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.3);font-size:14px;line-height:1.5">
      <div style="font:800 17px Manrope,Inter,sans-serif;margin-bottom:10px">🎵 Spotify ne peut pas se connecter ici</div>${msg}
      <button id="sp-help-ok" style="margin-top:6px;width:100%;border:none;border-radius:99px;padding:10px 16px;background:#1db954;color:#fff;font:800 14px Manrope,Inter,sans-serif;cursor:pointer">J’ai compris</button></div>`;
    d.addEventListener('click', e => { if (e.target === d || e.target.id === 'sp-help-ok') d.remove(); });
    document.body.appendChild(d);
  }
  window.spRedirectInfo = () => ({ redirect: REDIRECT_URI, blocked: spWhyNot() });
  const SCOPES      = 'user-read-playback-state user-modify-playback-state user-library-modify user-library-read';

  /* ── State ── */
  let spToken        = null;
  let spPollInterval = null;
  let _currentTrackId = null;
  let _progressMs    = 0;
  let _durationMs    = 0;
  let _isPlaying     = false;
  let _shuffleState  = false;
  let _repeatState   = 'off';
  let _spProgressTimer = null;
  let _spPanelOpen   = false;
  let _spVolume      = 50;
  let _seekFreezeUntil  = 0;
  let _trackFreezeUntil = 0;
  let _volDragging   = false;
  let _volFreezeUntil = 0;
  let _volAbort      = null;
  let _trackUrl = '', _albumUrl = '', _artistUrl = '';

  /* ═══════════════════════════════════════════════════════════════
     CRYPTO — PKCE helpers
  ═══════════════════════════════════════════════════════════════ */

  async function sha256(plain) {
    const enc  = new TextEncoder().encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomStr(len) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(len)))
      .map(b => chars[b % chars.length]).join('');
  }

  /* ═══════════════════════════════════════════════════════════════
     AUTH — login / callback / refresh / token cache
  ═══════════════════════════════════════════════════════════════ */

  async function spotifyLogin() {
    const why = spWhyNot();
    if (why) { spHelp(why); return; }   // au lieu d'envoyer vers une page d'erreur
    const verifier   = randomStr(64);
    const challenge  = await sha256(verifier);
    const state      = randomStr(16);
    localStorage.setItem('sp_verifier', verifier);
    localStorage.setItem('sp_state', state);
    const url = `https://accounts.spotify.com/authorize`
      + `?client_id=${CLIENT_ID}`
      + `&response_type=code`
      + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
      + `&scope=${encodeURIComponent(SCOPES)}`
      + `&state=${state}`
      + `&code_challenge_method=S256`
      + `&code_challenge=${challenge}`
      + `&show_dialog=true`;
    window.location.href = url;
  }
  window.spotifyLogin = spotifyLogin;

  async function handleCallback() {
    const params   = new URLSearchParams(window.location.search);
    const code     = params.get('code');
    const state    = params.get('state');
    if (!code || state !== localStorage.getItem('sp_state')) return;

    const verifier = localStorage.getItem('sp_verifier');
    window.history.replaceState({}, '', window.location.pathname);

    const body = new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    });
    const r    = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await r.json();
    console.log('🎵 Spotify token response:', JSON.stringify({
      scope: data.scope, error: data.error, has_token: !!data.access_token,
    }));

    if (data.access_token) {
      spToken = data.access_token;
      localStorage.setItem('sp_token',     data.access_token);
      localStorage.setItem('sp_token_exp', Date.now() + data.expires_in * 1000);
      if (data.refresh_token) localStorage.setItem('sp_refresh', data.refresh_token);
      showPlayer();
      setTimeout(() => {
        pollNowPlaying();
        spPollInterval = setInterval(pollNowPlaying, 1000);
      }, 2000);
    } else {
      console.error('🎵 Token exchange failed:', data);
      showConnectBtn();
    }
  }

  async function refreshToken() {
    const refresh = localStorage.getItem('sp_refresh');
    if (!refresh) return false;

    const body = new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: refresh,
    });
    const r    = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await r.json();

    if (data.access_token) {
      spToken = data.access_token;
      localStorage.setItem('sp_token',     data.access_token);
      localStorage.setItem('sp_token_exp', Date.now() + data.expires_in * 1000);
      if (data.refresh_token) localStorage.setItem('sp_refresh', data.refresh_token);
      return true;
    }
    return false;
  }

  function loadToken() {
    const t   = localStorage.getItem('sp_token');
    const exp = parseInt(localStorage.getItem('sp_token_exp') || 0);
    if (t && Date.now() < exp) { spToken = t; return true; }
    return false;
  }

  /* ═══════════════════════════════════════════════════════════════
     API WRAPPER
  ═══════════════════════════════════════════════════════════════ */

  async function spFetch(path, method = 'GET', body = null) {
    if (!spToken) return null;
    const opts = { method, headers: { Authorization: `Bearer ${spToken}` } };
    if (body) {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
    const r = await fetch(`https://api.spotify.com/v1${path}`, opts);
    if (r.status === 401) {
      spToken = null;
      localStorage.removeItem('sp_token');
      showConnectBtn();
      return null;
    }
    if (r.status === 204 || r.status === 202) return {};
    if (!r.ok) return null;
    return r.json().catch(() => ({}));
  }

  /* ═══════════════════════════════════════════════════════════════
     POLLING — /me/player
  ═══════════════════════════════════════════════════════════════ */

  async function pollNowPlaying() {
    // Respect suspension window set by user actions
    if (typeof _pollSuspendUntil !== 'undefined' && Date.now() < _pollSuspendUntil) return;
    const data   = await spFetch('/me/player');
    const player = document.getElementById('sp-player');
    if (!data || !data.item) { player.classList.add('sp-idle'); return; }
    player.classList.remove('sp-idle');

    const track = data.item;
    const newId = track.id;
    _trackUrl = track.uri  || '';
    _albumUrl = track.album?.uri || '';
    _artistUrl = track.artists?.[0]?.uri || '';

    if (Date.now() > _trackFreezeUntil) {
      const tEl = document.getElementById('sp-track');
      const aEl = document.getElementById('sp-artist');
      tEl.textContent = track.name;
      tEl.style.cursor = _albumUrl ? 'pointer' : '';
      tEl.onclick = _albumUrl ? () => { location.href = _albumUrl; } : null;
      aEl.textContent = track.artists.map(a => a.name).join(', ');
      aEl.style.cursor = _artistUrl ? 'pointer' : '';
      aEl.onclick = _artistUrl ? () => { location.href = _artistUrl; } : null;
    }

    const img  = document.getElementById('sp-cover');
    const ph   = document.querySelector('.sp-cover-placeholder');
    const imgs = track.album?.images || [];
    const coverUrl = imgs[1]?.url || imgs[0]?.url || '';
    if (coverUrl) {
      if (img.src !== coverUrl) img.src = coverUrl;
      img.style.cssText = 'display:block!important;width:34px;height:34px;object-fit:cover;border-radius:7px;opacity:1;transition:opacity .2s;';
      ph.style.display = 'none';
    } else {
      img.style.display = 'none';
      ph.style.display  = 'flex';
    }

    _isPlaying = data.is_playing;
    document.getElementById('sp-play-icon').textContent = _isPlaying ? 'pause_circle' : 'play_circle';

    if (Date.now() > _seekFreezeUntil) _progressMs = data.progress_ms || 0;
    _durationMs   = track.duration_ms || 0;
    _shuffleState = data.shuffle_state || false;
    _repeatState  = data.repeat_state  || 'off';

    if (data.device) {
      if (!_volDragging && Date.now() > _volFreezeUntil) {
        _spVolume = data.device.volume_percent ?? 50;
        spUpdateVolUI(_spVolume);
      }
      const dtype = data.device.type?.toLowerCase() || '';
      const dicon = dtype.includes('phone')    ? 'smartphone'
                  : dtype.includes('computer') ? 'laptop'
                  : dtype.includes('tv')       ? 'tv'
                  :                              'devices';
      document.getElementById('sp-device-icon').textContent = dicon;
      document.getElementById('sp-device-name').textContent = data.device.name || '—';
    }

    spUpdateSeekUI();
    spUpdateToggleUI();
    spStartProgressTimer();

    if (newId !== _currentTrackId) {
      _currentTrackId = newId;
      if (_spPanelOpen) spLoadQueue();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     UI HELPERS
  ═══════════════════════════════════════════════════════════════ */

  function spFmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function spUpdateSeekUI() {
    if (!_durationMs) return;
    const pct = Math.min(100, (_progressMs / _durationMs) * 100);
    document.getElementById('sp-seek-fill').style.width  = pct + '%';
    document.getElementById('sp-seek-thumb').style.left  = pct + '%';
    document.getElementById('sp-time-cur').textContent   = spFmtTime(_progressMs);
    document.getElementById('sp-time-total').textContent = spFmtTime(_durationMs);
  }

  function spUpdateVolUI(vol) {
    const slider = document.getElementById('sp-vol-slider');
    if (slider) { slider.value = vol; slider.style.setProperty('--val', vol + '%'); }
    const icon = document.getElementById('sp-vol-icon');
    if (icon) icon.textContent = vol === 0 ? 'volume_off' : vol < 40 ? 'volume_down' : 'volume_up';
  }

  function spUpdateToggleUI() {
    const sb = document.getElementById('sp-shuffle-btn');
    const rb = document.getElementById('sp-repeat-btn');
    const ri = document.getElementById('sp-repeat-icon');
    const rl = document.getElementById('sp-repeat-label');
    if (sb) sb.classList.toggle('active', _shuffleState);
    if (rb) rb.classList.toggle('active', _repeatState !== 'off');
    if (ri) ri.textContent = _repeatState === 'track' ? 'repeat_one' : 'repeat';
    if (rl) rl.textContent = _repeatState === 'track'   ? 'Une fois'
                           : _repeatState === 'context' ? 'Playlist'
                           :                              'Répéter';
  }

  function spStartProgressTimer() {
    clearInterval(_spProgressTimer);
    if (!_isPlaying) return;
    _spProgressTimer = setInterval(() => {
      _progressMs += 1000;
      if (_progressMs > _durationMs) { clearInterval(_spProgressTimer); return; }
      spUpdateSeekUI();
    }, 1000);
  }

  function showConnectBtn() {
    document.getElementById('sp-connect-btn').style.display = 'flex';
    document.getElementById('sp-player').style.display      = 'none';
  }

  function showPlayer() {
    document.getElementById('sp-connect-btn').style.display = 'none';
    document.getElementById('sp-player').style.display      = 'flex';
  }

  /* ═══════════════════════════════════════════════════════════════
     PANEL (hover expand)
  ═══════════════════════════════════════════════════════════════ */

  function spOpenPanel() {
    if (_spPanelOpen) return;
    _spPanelOpen = true;
    const btn    = document.getElementById('sp-expand-btn');
    const panel  = document.getElementById('sp-panel');
    const rect   = btn.getBoundingClientRect();
    const panelW = 300;
    let left = rect.left + rect.width / 2 - panelW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
    panel.style.left    = left + 'px';
    panel.style.display = 'block';
    btn.classList.add('open');
    spLoadQueue();
  }

  function spClosePanel() {
    _spPanelOpen = false;
    document.getElementById('sp-panel').style.display = 'none';
    document.getElementById('sp-expand-btn').classList.remove('open');
  }

  window.spTogglePanel = spOpenPanel;

  /* ═══════════════════════════════════════════════════════════════
     SEEK — click + drag
  ═══════════════════════════════════════════════════════════════ */

  let _seekDragging = false;
  let _seekAbort    = null;

  function spSeekFromEvent(e, trackEl) {
    const rect = trackEl.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    _progressMs      = Math.round(pct * _durationMs);
    _seekFreezeUntil = Date.now() + 4000;
    spUpdateSeekUI();
  }

  function spSendSeek() {
    if (_seekAbort) _seekAbort.abort();
    _seekAbort = new AbortController();
    if (!spToken) return;
    fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${_progressMs}`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${spToken}` },
      signal:  _seekAbort.signal,
    }).catch(() => {});
  }

  window.spSeekClick = function (e) {
    spSeekFromEvent(e, e.currentTarget);
    spStartProgressTimer();
    spSendSeek();
  };

  /* ═══════════════════════════════════════════════════════════════
     VOLUME
  ═══════════════════════════════════════════════════════════════ */

  window.spVolumeInput = function (val) {
    _spVolume       = parseInt(val);
    _volDragging    = true;
    _volFreezeUntil = Date.now() + 4000;
    spUpdateVolUI(_spVolume);
    if (_volAbort) _volAbort.abort();
    _volAbort = new AbortController();
    if (!spToken) return;
    fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${_spVolume}`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${spToken}` },
      signal:  _volAbort.signal,
    }).catch(() => {});
  };

  window.spVolumeCommit = function (val) {
    _volDragging    = false;
    _volFreezeUntil = Date.now() + 3000;
    if (_volAbort) _volAbort.abort();
    spFetch(`/me/player/volume?volume_percent=${val}`, 'PUT');
  };

  /* ═══════════════════════════════════════════════════════════════
     PLAYBACK CONTROLS — exposés globalement
  ═══════════════════════════════════════════════════════════════ */

  window.spShuffle = async function () {
    _shuffleState = !_shuffleState;
    spUpdateToggleUI();
    await spFetch(`/me/player/shuffle?state=${_shuffleState}`, 'PUT');
  };

  window.spRepeat = async function () {
    const states = ['off', 'context', 'track'];
    _repeatState = states[(states.indexOf(_repeatState) + 1) % 3];
    spUpdateToggleUI();
    await spFetch(`/me/player/repeat?state=${_repeatState}`, 'PUT');
  };

  /* ── Polling grace period — suspend polling after user action ── */
  let _pollSuspendUntil = 0;

  function spSuspendPoll(ms) {
    _pollSuspendUntil = Date.now() + ms;
  }

  // Wrap pollNowPlaying to respect the suspend window
  const _pollNowPlayingOriginal = pollNowPlaying;
  pollNowPlaying = function() {
    if (Date.now() < _pollSuspendUntil) return;
    return _pollNowPlayingOriginal();
  };

  /* ── Instant UI helpers ── */
  function spSetPlayIcon(playing) {
    const icon = document.getElementById('sp-play-icon');
    if (icon) icon.textContent = playing ? 'pause_circle' : 'play_circle';
  }

  function spResetProgressUI() {
    _progressMs = 0;
    const fill  = document.getElementById('sp-seek-fill');
    const thumb = document.getElementById('sp-seek-thumb');
    const cur   = document.getElementById('sp-time-cur');
    if (fill)  { fill.style.width = '0%'; fill.style.transition = 'none'; }
    if (thumb) { thumb.style.left = '0%'; thumb.style.transition = 'none'; }
    if (cur)   cur.textContent = '0:00';
    // Re-enable transition after reset
    requestAnimationFrame(() => {
      if (fill)  fill.style.transition  = '';
      if (thumb) thumb.style.transition = '';
    });
  }

  function spSetTrackLoading() {
    const tEl = document.getElementById('sp-track');
    const aEl = document.getElementById('sp-artist');
    const img = document.getElementById('sp-cover');
    const ph  = document.querySelector('.sp-cover-placeholder');
    if (tEl) tEl.textContent = 'Chargement…';
    if (aEl) aEl.textContent = '—';
    // Fade cover
    if (img) { img.style.opacity = '0.3'; }
    if (ph)  { ph.style.display  = 'none'; }
  }

  /* ── Schedule aggressive re-polls AFTER suspend window ── */
  function spScheduleResync(suspendMs) {
    // Poll right after the suspend window ends
    setTimeout(() => {
      _pollSuspendUntil = 0;
      pollNowPlaying();
    }, suspendMs + 50);
    setTimeout(() => pollNowPlaying(), suspendMs + 400);
    setTimeout(() => pollNowPlaying(), suspendMs + 900);
  }

  /* ── PLAY / PAUSE ── */
  window.spotifyPlayPause = function () {
    // 1. Snapshot for rollback
    const wasPlaying = _isPlaying;

    // 2. Instant UI update (< 1ms)
    _isPlaying = !wasPlaying;
    spSetPlayIcon(_isPlaying);
    if (_isPlaying) spStartProgressTimer();
    else            clearInterval(_spProgressTimer);

    // 3. Suspend polling for 1.5s (play/pause is fast on Spotify's side)
    spSuspendPoll(1500);

    // 4. Fire API in background — no await
    spFetch(_isPlaying ? '/me/player/play' : '/me/player/pause', 'PUT')
      .then(res => {
        if (res === null) {
          // API error → rollback
          _isPlaying = wasPlaying;
          spSetPlayIcon(_isPlaying);
          if (_isPlaying) spStartProgressTimer();
          else            clearInterval(_spProgressTimer);
        }
      });

    spScheduleResync(1500);
  };

  /* ── NEXT ── */
  window.spotifyNext = function () {
    // 1. Instant UI
    _isPlaying = true;
    spSetPlayIcon(true);
    spSetTrackLoading();
    spResetProgressUI();
    clearInterval(_spProgressTimer);

    // 2. Suspend polling for 2.5s (track change takes longer server-side)
    spSuspendPoll(2500);

    // 3. Background API
    spFetch('/me/player/next', 'POST').then(res => {
      if (res === null) {
        // On error, force immediate resync
        _pollSuspendUntil = 0;
        pollNowPlaying();
      }
    });

    spScheduleResync(2500);
  };

  /* ── PREV ── */
  window.spotifyPrev = function () {
    // 1. Instant UI
    _isPlaying = true;
    spSetPlayIcon(true);
    spSetTrackLoading();
    spResetProgressUI();
    clearInterval(_spProgressTimer);

    // 2. Suspend polling for 2.5s
    spSuspendPoll(2500);

    // 3. Background API
    spFetch('/me/player/previous', 'POST').then(res => {
      if (res === null) {
        _pollSuspendUntil = 0;
        pollNowPlaying();
      }
    });

    spScheduleResync(2500);
  };

  /* ═══════════════════════════════════════════════════════════════
     QUEUE
  ═══════════════════════════════════════════════════════════════ */

  async function spLoadQueue() {
    const list = document.getElementById('sp-queue-list');
    if (!list) return;
    list.innerHTML = '<div class="sp-queue-loading">Chargement…</div>';
    const data = await spFetch('/me/player/queue');
    if (!data || !data.queue || !data.queue.length) {
      list.innerHTML = '<div class="sp-queue-loading">File vide</div>';
      return;
    }
    list.innerHTML = data.queue.slice(0, 4).map((t, i) => {
      const name   = t.name || '—';
      const artist = (t.artists || []).map(a => a.name).join(', ');
      return `<div class="sp-queue-item">
        <span class="sp-queue-num">${i + 1}</span>
        <div class="sp-queue-info">
          <div class="sp-queue-name">${name}</div>
          <div class="sp-queue-artist">${artist}</div>
        </div>
      </div>`;
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════════
     EVENT WIRING (panel hover, seek drag) — après DOMContentLoaded
  ═══════════════════════════════════════════════════════════════ */

  function wireSpotifyEvents() {
    /* Panel hover */
    const expandBtn = document.getElementById('sp-expand-btn');
    const panel     = document.getElementById('sp-panel');
    let _spLeaveTimer = null;

    if (expandBtn && panel) {
      expandBtn.addEventListener('mouseenter', spOpenPanel);
      expandBtn.addEventListener('mouseleave', () => {
        _spLeaveTimer = setTimeout(spClosePanel, 200);
      });
      panel.addEventListener('mouseleave', () => {
        _spLeaveTimer = setTimeout(spClosePanel, 200);
      });
      document.addEventListener('mouseover', e => {
        if (panel.contains(e.target) || expandBtn.contains(e.target)) {
          clearTimeout(_spLeaveTimer);
        }
      });
    }

    /* Seek drag */
    const seekTrack = document.getElementById('sp-seek-track');
    if (seekTrack) {
      seekTrack.addEventListener('mousedown', function (e) {
        _seekDragging = true;
        clearInterval(_spProgressTimer);
        spSeekFromEvent(e, this);
        const onMove = ev => {
          if (!_seekDragging) return;
          spSeekFromEvent(ev, document.getElementById('sp-seek-track'));
          spSendSeek();
        };
        const onUp = () => {
          _seekDragging = false;
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
          spSendSeek();
          spStartProgressTimer();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ACCÈS POUR LE JEU « MA VILLE » (12 nov. 2026) : lecteur dans la ville
     window.spGetState() = état en lecture seule · window.spSeekTo(0..1) = aller à une position
  ═══════════════════════════════════════════════════════════════ */
  window.spGetState = function () {
    const t = document.getElementById('sp-track'), a = document.getElementById('sp-artist'), img = document.getElementById('sp-cover');
    return { on: !!spToken, has: !!_currentTrackId, track: t ? t.textContent : '', artist: a ? a.textContent : '',
             cover: img && img.style.display !== 'none' && img.src && !/\/$/.test(img.src) ? img.src : '',
             playing: _isPlaying, pos: _progressMs, dur: _durationMs, vol: _spVolume,
             shuffle: _shuffleState, repeat: _repeatState,
             dev: (document.getElementById('sp-device-name') || {}).textContent || '',
             devIc: (document.getElementById('sp-device-icon') || {}).textContent || 'devices' };
  };
  // 14 nov. 2026 : file « À suivre » pour le panneau du lecteur de la ville
  window.spGetQueue = async function () {
    if (!spToken) return [];
    const data = await spFetch('/me/player/queue');
    return ((data && data.queue) || []).slice(0, 4).map(t => ({
      name: t.name || '—', artist: (t.artists || []).map(a => a.name).join(', ') }));
  };
  window.spSeekTo = function (frac) {
    if (!spToken || !_durationMs) return;
    _progressMs = Math.round(Math.max(0, Math.min(1, frac)) * _durationMs);
    _seekFreezeUntil = Date.now() + 2500;
    spUpdateSeekUI(); spStartProgressTimer(); spSendSeek();
  };

  /* ═══════════════════════════════════════════════════════════════
     BOOT
  ═══════════════════════════════════════════════════════════════ */

  async function init() {
    wireSpotifyEvents();

    if (new URLSearchParams(window.location.search).has('code')) {
      await handleCallback();
    } else if (loadToken()) {
      showPlayer();
      pollNowPlaying();
      spPollInterval = setInterval(pollNowPlaying, 1000);
    } else if (localStorage.getItem('sp_refresh')) {
      const ok = await refreshToken();
      if (ok) {
        showPlayer();
        pollNowPlaying();
        spPollInterval = setInterval(pollNowPlaying, 1000);
      } else {
        showConnectBtn();
      }
    } else {
      showConnectBtn();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
