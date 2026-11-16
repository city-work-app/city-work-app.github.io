'use strict';

/* =========================================================
   friends.js — Social layer for Kiné+
   All data stored in localStorage. No backend.
   ========================================================= */

// --------------- State ---------------
var _friends = [];
var _challenges = [];
var _curFriend = null;
var _friendsTab = 'amis';

// --------------- Constants ---------------
var _AVATAR_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316'];

// =========================================================
// Helpers
// =========================================================

function _escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _nameColor(name) {
  var str = String(name || '');
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return _AVATAR_COLORS[Math.abs(hash) % _AVATAR_COLORS.length];
}

function _masteryColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#3b82f6';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function _timeAgo(ts) {
  if (!ts) return '';
  var diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return Math.floor(diff / 60) + 'min';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'j';
}

function _frLoad() {
  try {
    _friends = JSON.parse(localStorage.getItem('kcu_friends') || '[]');
  } catch(e) {
    _friends = [];
  }
  try {
    _challenges = JSON.parse(localStorage.getItem('kcu_challenges') || '[]');
  } catch(e) {
    _challenges = [];
  }
}

function _frSave() {
  localStorage.setItem('kcu_friends', JSON.stringify(_friends));
  localStorage.setItem('kcu_challenges', JSON.stringify(_challenges));
}

function _calcMastery(diffData) {
  var total = 0, correct = 0;
  Object.values(diffData || {}).forEach(function(d) {
    if (!d || !d.attempts) return;
    total += d.attempts;
    correct += d.attempts - (d.errors || 0);
  });
  return total ? Math.round(correct / total * 100) : 0;
}

function _chalTitle(ch) {
  if (!ch) return 'Défi';
  var type = ch.type;
  var target = ch.target;
  var days = ch.days;
  if (type === 'questions') return 'Répondre à ' + target + ' questions en ' + days + ' jour' + (days > 1 ? 's' : '');
  if (type === 'streak') return 'Atteindre un streak de ' + target + ' jours';
  if (type === 'mastery') return 'Atteindre ' + target + '% de maîtrise';
  return 'Défi personnalisé';
}

// =========================================================
// Profile export / import
// =========================================================

function getMyName() {
  return localStorage.getItem('kcu_display_name') || 'Utilisateur';
}

function setMyName(name) {
  name = (name || '').trim();
  if (!name) {
    if (typeof showNotif === 'function') showNotif('Veuillez entrer un prénom.', 'error');
    return;
  }
  localStorage.setItem('kcu_display_name', name);
  if (typeof closeModal === 'function') closeModal('modal-set-name');
  copyMyCode();
}

function exportMyProfile() {
  var mmCount = 0, conceptsCount = 0, dgCount = 0;
  try { mmCount = JSON.parse(localStorage.getItem('kcu_maps') || localStorage.getItem('kcu_mm') || '[]').length; } catch(e) {}
  try { conceptsCount = JSON.parse((typeof lsRaw === 'function' ? lsRaw('kcu_concepts') : localStorage.getItem('kcu_concepts')) || '[]').length; } catch(e) {}
  try { dgCount = JSON.parse(localStorage.getItem('kcu_dg') || '[]').length; } catch(e) {}

  var data = {
    version: 1,
    exportedAt: Date.now(),
    name: getMyName(),
    stats: {
      streak: (KS && KS.streak) || 0,
      totalAnswered: (KS && KS.totalAnswered) || 0,
      totalCorrect: (KS && KS.totalCorrect) || 0,
      sessions: (KS && KS.sessions) || 0,
      todayQ: (KS && KS.todayQ) || 0
    },
    folders: (KF || []).map(function(f) { return { id: f.id, name: f.name, color: f.color }; }),
    courses: (KC || []).map(function(c) {
      return {
        id: c.id,
        name: c.name,
        folderId: c.folderId,
        qCount: (KQ || []).filter(function(q) { return q.courseId === c.id; }).length
      };
    }),
    diffData: KD || {},
    mindMapsCount: mmCount,
    conceptsCount: conceptsCount,
    diagramsCount: dgCount
  };

  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function copyMyCode() {
  var name = getMyName();
  if (!name || name === 'Utilisateur') {
    var input = document.getElementById('set-name-input');
    if (input) input.value = '';
    if (typeof openModal === 'function') openModal('modal-set-name');
    return;
  }

  var code = exportMyProfile();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(function() {
      if (typeof showNotif === 'function') showNotif('Code copié dans le presse-papier !', 'success');
    }).catch(function() {
      _fallbackCopy(code);
    });
  } else {
    _fallbackCopy(code);
  }
}

function _fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (typeof showNotif === 'function') showNotif('Code copié !', 'success');
  } catch(e) {
    if (typeof showNotif === 'function') showNotif('Impossible de copier automatiquement.', 'error');
  }
  document.body.removeChild(ta);
}

// =========================================================
// Friend management
// =========================================================

function addFriendFromCode(code) {
  code = (code || '').trim();
  if (!code) {
    if (typeof showNotif === 'function') showNotif('Code vide.', 'error');
    return;
  }
  var data;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(code))));
  } catch(e) {
    if (typeof showNotif === 'function') showNotif('Code invalide.', 'error');
    return;
  }
  if (!data || !data.name || !data.version) {
    if (typeof showNotif === 'function') showNotif('Code non reconnu.', 'error');
    return;
  }
  _frLoad();
  var existing = _friends.find(function(f) { return f.name === data.name; });
  if (existing) {
    if (typeof showNotif === 'function') showNotif('Cet ami existe déjà. Utilisez "Mettre à jour".', 'error');
    return;
  }
  _friends.push({
    id: 'fr_' + Date.now(),
    name: data.name,
    addedAt: Date.now(),
    updatedAt: data.exportedAt,
    data: data
  });
  _frSave();
  if (typeof closeModal === 'function') closeModal('modal-add-friend');
  if (typeof showNotif === 'function') showNotif(data.name + ' ajouté(e) !', 'success');
  renderFriends();
}

function updateFriendFromCode(friendId, code) {
  code = (code || '').trim();
  if (!code) {
    if (typeof showNotif === 'function') showNotif('Code vide.', 'error');
    return;
  }
  var data;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(code))));
  } catch(e) {
    if (typeof showNotif === 'function') showNotif('Code invalide.', 'error');
    return;
  }
  _frLoad();
  var fr = _friends.find(function(f) { return f.id === friendId; });
  if (!fr) {
    if (typeof showNotif === 'function') showNotif('Ami introuvable.', 'error');
    return;
  }
  fr.name = data.name || fr.name;
  fr.updatedAt = data.exportedAt || Date.now();
  fr.data = data;
  _frSave();
  if (typeof showNotif === 'function') showNotif('Profil mis à jour !', 'success');
  renderFriends();
}

function deleteFriend(id) {
  _frLoad();
  var fr = _friends.find(function(f) { return f.id === id; });
  if (!fr) return;
  var name = fr.name;
  if (typeof showConfirm === 'function') {
    showConfirm(
      'Supprimer ' + _escHtml(name) + ' ?',
      'Cette action est irréversible.',
      'Supprimer',
      function() {
        _friends = _friends.filter(function(f) { return f.id !== id; });
        _frSave();
        if (typeof showNotif === 'function') showNotif(name + ' supprimé(e).', 'success');
        renderFriends();
      }
    );
  } else {
    if (!confirm('Supprimer ' + name + ' ?')) return;
    _friends = _friends.filter(function(f) { return f.id !== id; });
    _frSave();
    renderFriends();
  }
}

// =========================================================
// Render friends screen
// =========================================================

function renderFriends() {
  _frLoad();
  switchFriendsTab(_friendsTab);

  var list = document.getElementById('fr-list');
  if (!list) return;

  if (!_friends.length) {
    list.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center;opacity:.6;">'
      + '<div style="font-size:2.5rem;">👥</div>'
      + '<p style="margin-top:.5rem;">Aucun ami ajouté</p>'
      + '<p style="font-size:.85rem;">Partagez votre code et ajoutez des amis !</p>'
      + '</div>';
    return;
  }

  list.innerHTML = _friends.map(function(fr) {
    var d = fr.data || {};
    var stats = d.stats || {};
    var mastery = _calcMastery(d.diffData);
    var mColor = _masteryColor(mastery);
    var avatarColor = _nameColor(fr.name);
    var letter = _escHtml((fr.name || '?')[0].toUpperCase());
    var total = stats.totalAnswered || 0;
    var streak = stats.streak || 0;
    return '<div class="fr-card" onclick="openFriendProfile(\'' + _escHtml(fr.id) + '\')" style="display:flex;align-items:center;gap:.9rem;padding:.9rem 1rem;border-radius:14px;background:var(--card-bg,#fff);box-shadow:0 1px 6px rgba(0,0,0,.07);margin-bottom:.6rem;cursor:pointer;">'
      + '<div style="width:44px;height:44px;border-radius:50%;background:' + avatarColor + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;flex-shrink:0;">' + letter + '</div>'
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _escHtml(fr.name) + '</div>'
      +   '<div style="font-size:.75rem;opacity:.55;margin-top:.15rem;">Mis à jour il y a ' + _timeAgo(fr.updatedAt) + '</div>'
      +   '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.45rem;">'
      +     '<span style="font-size:.75rem;padding:.15rem .5rem;border-radius:99px;background:rgba(245,158,11,.12);color:#f59e0b;">🔥 ' + streak + '</span>'
      +     '<span style="font-size:.75rem;padding:.15rem .5rem;border-radius:99px;background:rgba(59,130,246,.1);color:#3b82f6;">📝 ' + total + '</span>'
      +     '<span style="font-size:.75rem;padding:.15rem .5rem;border-radius:99px;background:rgba(0,0,0,.05);color:' + mColor + ';">⭐ ' + mastery + '%</span>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function switchFriendsTab(tab) {
  _friendsTab = tab || 'amis';
  var tabs = ['amis', 'classement', 'defis'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('fr-tab-' + t);
    var panel = document.getElementById('fr-panel-' + t);
    if (btn) {
      if (t === _friendsTab) {
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--on-sv, var(--text-secondary, #666))';
      }
    }
    if (panel) {
      panel.style.display = t === _friendsTab ? '' : 'none';
    }
  });
  if (_friendsTab === 'classement') renderLeaderboard();
  if (_friendsTab === 'defis') renderChallenges();
}

// =========================================================
// Leaderboard
// =========================================================

function renderLeaderboard() {
  var el = document.getElementById('fr-leaderboard');
  if (!el) return;
  _frLoad();

  var myMastery = _calcMastery(KD);
  var myColor = _nameColor(getMyName());

  var entries = [{
    name: getMyName() + ' (moi)',
    mastery: myMastery,
    streak: (KS && KS.streak) || 0,
    total: (KS && KS.totalAnswered) || 0,
    isMe: true,
    color: myColor
  }];

  _friends.forEach(function(fr) {
    var d = fr.data || {};
    var stats = d.stats || {};
    entries.push({
      name: fr.name,
      mastery: _calcMastery(d.diffData),
      streak: stats.streak || 0,
      total: stats.totalAnswered || 0,
      isMe: false,
      color: _nameColor(fr.name)
    });
  });

  entries.sort(function(a, b) { return b.mastery - a.mastery; });

  var medals = ['🥇', '🥈', '🥉'];
  el.innerHTML = entries.map(function(e, i) {
    var rank = i < 3 ? medals[i] : ('<span style="font-size:.8rem;font-weight:600;color:var(--text-secondary,#888);">#' + (i + 1) + '</span>');
    var mColor = _masteryColor(e.mastery);
    var letter = (e.name || '?')[0].toUpperCase();
    var rowBg = e.isMe ? 'background:color-mix(in srgb, var(--primary) 8%, transparent);' : '';
    return '<div style="display:flex;align-items:center;gap:.7rem;padding:.7rem .9rem;border-radius:12px;margin-bottom:.4rem;' + rowBg + '">'
      + '<div style="width:26px;text-align:center;">' + rank + '</div>'
      + '<div style="width:36px;height:36px;border-radius:50%;background:' + e.color + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.9rem;flex-shrink:0;">' + _escHtml(letter) + '</div>'
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="font-size:.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _escHtml(e.name) + '</div>'
      +   '<div style="margin-top:.3rem;height:5px;border-radius:99px;background:rgba(0,0,0,.08);overflow:hidden;">'
      +     '<div style="height:100%;width:' + e.mastery + '%;background:' + mColor + ';border-radius:99px;transition:width .4s;"></div>'
      +   '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:.1rem;flex-shrink:0;">'
      +   '<span style="font-size:.75rem;color:#f59e0b;">🔥 ' + e.streak + '</span>'
      +   '<span style="font-size:.75rem;opacity:.55;">' + e.total + ' q.</span>'
      + '</div>'
      + '<div style="width:38px;text-align:right;font-size:.85rem;font-weight:700;color:' + mColor + ';">' + e.mastery + '%</div>'
      + '</div>';
  }).join('');
}

// =========================================================
// Friend profile screen
// =========================================================

function openFriendProfile(id) {
  _curFriend = id;
  if (typeof showScreen === 'function') showScreen('friend-profile');
  renderFriendProfile();
}

function renderFriendProfile() {
  var fr = null;
  _frLoad();
  if (_curFriend) {
    fr = _friends.find(function(f) { return f.id === _curFriend; }) || null;
  }
  if (!fr) return;

  var d = fr.data || {};
  var stats = d.stats || {};
  var avatarColor = _nameColor(fr.name);
  var letter = (fr.name || '?')[0].toUpperCase();

  var nameEl = document.getElementById('fp-name');
  var avatarEl = document.getElementById('fp-avatar');
  var updEl = document.getElementById('fp-updated');
  if (nameEl) nameEl.textContent = fr.name;
  if (avatarEl) {
    avatarEl.textContent = letter;
    avatarEl.style.background = avatarColor;
  }
  if (updEl) updEl.textContent = 'Mis à jour il y a ' + _timeAgo(fr.updatedAt);

  // Inventory
  var invEl = document.getElementById('fp-inventory');
  if (invEl) {
    var folders = (d.folders || []).length;
    var courses = (d.courses || []).length;
    var qTotal = (d.courses || []).reduce(function(s, c) { return s + (c.qCount || 0); }, 0);
    var flashcards = d.conceptsCount || 0;
    var mm = d.mindMapsCount || 0;
    var dg = d.diagramsCount || 0;
    invEl.innerHTML = _invItem('📁', folders, 'dossier' + (folders !== 1 ? 's' : ''))
      + _invItem('📖', courses, 'cours')
      + _invItem('❓', qTotal, 'question' + (qTotal !== 1 ? 's' : ''))
      + _invItem('🃏', flashcards, 'flashcard' + (flashcards !== 1 ? 's' : ''))
      + _invItem('🗺️', mm, 'mind map' + (mm !== 1 ? 's' : ''))
      + _invItem('📊', dg, 'diagramme' + (dg !== 1 ? 's' : ''));
  }

  // Comparison
  var cmpEl = document.getElementById('fp-comparison');
  if (cmpEl) {
    var myMastery = _calcMastery(KD);
    var frMastery = _calcMastery(d.diffData);
    var myStreak = (KS && KS.streak) || 0;
    var frStreak = stats.streak || 0;
    var myTotal = (KS && KS.totalAnswered) || 0;
    var frTotal = stats.totalAnswered || 0;
    cmpEl.innerHTML = _vsRow('Maîtrise', myMastery + '%', frMastery + '%', myMastery >= frMastery, _masteryColor(myMastery), _masteryColor(frMastery))
      + _vsRow('Streak', '🔥 ' + myStreak, '🔥 ' + frStreak, myStreak >= frStreak, '#f59e0b', '#f59e0b')
      + _vsRow('Questions', myTotal + '', frTotal + '', myTotal >= frTotal, '#3b82f6', '#3b82f6');
  }

  // Folders breakdown
  var foldEl = document.getElementById('fp-folders');
  if (foldEl) {
    if (!(d.folders || []).length) {
      foldEl.innerHTML = '<p style="opacity:.5;font-size:.85rem;">Aucun dossier</p>';
    } else {
      foldEl.innerHTML = (d.folders || []).map(function(f) {
        var fCourses = (d.courses || []).filter(function(c) { return c.folderId === f.id; });
        var fQ = fCourses.reduce(function(s, c) { return s + (c.qCount || 0); }, 0);
        return '<div style="display:flex;align-items:center;gap:.7rem;padding:.55rem .7rem;border-radius:10px;background:var(--card-bg,#fff);margin-bottom:.4rem;">'
          + '<div style="width:12px;height:12px;border-radius:50%;background:' + _escHtml(f.color || '#888') + ';flex-shrink:0;"></div>'
          + '<div style="flex:1;font-size:.9rem;font-weight:500;">' + _escHtml(f.name) + '</div>'
          + '<div style="font-size:.78rem;opacity:.6;">' + fCourses.length + ' cours · ' + fQ + ' q.</div>'
          + '</div>';
      }).join('');
    }
  }
}

function _invItem(icon, count, label) {
  return '<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .7rem;border-radius:10px;background:var(--card-bg,#fff);margin-bottom:.35rem;">'
    + '<span style="font-size:1.1rem;">' + icon + '</span>'
    + '<span style="font-weight:700;font-size:.95rem;">' + count + '</span>'
    + '<span style="opacity:.6;font-size:.82rem;">' + label + '</span>'
    + '</div>';
}

function _vsRow(label, myVal, frVal, myWins, myColor, frColor) {
  return '<div style="margin-bottom:.6rem;">'
    + '<div style="font-size:.78rem;opacity:.55;text-align:center;margin-bottom:.25rem;">' + _escHtml(label) + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;">'
    +   '<span style="font-weight:700;color:' + (myWins ? myColor : 'var(--text-secondary,#888)') + ';font-size:.95rem;">' + _escHtml(myVal) + '</span>'
    +   '<span style="font-size:.72rem;opacity:.4;">VS</span>'
    +   '<span style="font-weight:700;color:' + (!myWins ? frColor : 'var(--text-secondary,#888)') + ';font-size:.95rem;">' + _escHtml(frVal) + '</span>'
    + '</div>'
    + '</div>';
}

// =========================================================
// Challenges
// =========================================================

function openChallengeModal() {
  if (typeof openModal === 'function') openModal('modal-challenge');

  var recipientEl = document.getElementById('chal-recipient');
  if (recipientEl && _curFriend) {
    _frLoad();
    var fr = _friends.find(function(f) { return f.id === _curFriend; });
    if (fr) recipientEl.value = fr.name;
  }

  var sel = document.getElementById('chal-folder-select');
  if (sel) {
    sel.innerHTML = '<option value="">— Toutes matières —</option>'
      + (KF || []).map(function(f) {
          return '<option value="' + _escHtml(f.id) + '">' + _escHtml(f.name) + '</option>';
        }).join('');
  }

  var codeSection = document.getElementById('chal-code-section');
  if (codeSection) codeSection.style.display = 'none';
}

function createAndShowChallenge() {
  var typeEl = document.querySelector('input[name="chal-type"]:checked');
  var targetEl = document.getElementById('chal-target');
  var daysEl = document.getElementById('chal-days');
  var recipientEl = document.getElementById('chal-recipient');
  var folderEl = document.getElementById('chal-folder-select');

  var type = typeEl ? typeEl.value : 'questions';
  var target = targetEl ? (parseInt(targetEl.value) || 10) : 10;
  var days = daysEl ? (parseInt(daysEl.value) || 7) : 7;
  var recipient = recipientEl ? recipientEl.value.trim() : '';
  var folderId = folderEl ? folderEl.value : '';

  var ch = {
    id: 'ch_' + Date.now(),
    type: type,
    target: target,
    days: days,
    recipient: recipient,
    folderId: folderId,
    createdAt: Date.now(),
    from: getMyName()
  };

  var code = btoa(unescape(encodeURIComponent(JSON.stringify(ch))));

  var codeOut = document.getElementById('chal-code-out');
  if (codeOut) codeOut.value = code;

  var codeSection = document.getElementById('chal-code-section');
  if (codeSection) codeSection.style.display = '';

  var titleEl = document.getElementById('chal-preview-title');
  if (titleEl) titleEl.textContent = _chalTitle(ch);
}

function copyChallengeCode() {
  var codeOut = document.getElementById('chal-code-out');
  if (!codeOut) return;
  var code = codeOut.value;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(function() {
      if (typeof showNotif === 'function') showNotif('Code défi copié !', 'success');
    }).catch(function() { _fallbackCopy(code); });
  } else {
    _fallbackCopy(code);
  }
}

function openImportChallengeModal() {
  var input = document.getElementById('import-chal-code');
  if (input) input.value = '';
  if (typeof openModal === 'function') openModal('modal-import-challenge');
}

function importChallenge() {
  var input = document.getElementById('import-chal-code');
  var code = input ? input.value.trim() : '';
  if (!code) {
    if (typeof showNotif === 'function') showNotif('Code vide.', 'error');
    return;
  }
  var ch;
  try {
    ch = JSON.parse(decodeURIComponent(escape(atob(code))));
  } catch(e) {
    if (typeof showNotif === 'function') showNotif('Code invalide.', 'error');
    return;
  }
  if (!ch || !ch.type || !ch.target) {
    if (typeof showNotif === 'function') showNotif('Défi non reconnu.', 'error');
    return;
  }
  _frLoad();
  ch.importedAt = Date.now();
  ch.deadline = Date.now() + (ch.days || 7) * 86400000;
  ch.baseline = {
    questions: (KS && KS.totalAnswered) || 0,
    streak: (KS && KS.streak) || 0,
    mastery: _calcMastery(KD)
  };
  _challenges.push(ch);
  _frSave();
  if (typeof closeModal === 'function') closeModal('modal-import-challenge');
  if (typeof showNotif === 'function') showNotif('Défi importé !', 'success');
  renderChallenges();
}

// =========================================================
// QCM Sharing
// =========================================================

var _shareImportData = null;

function openShareQCM() {
  var list = document.getElementById('share-qcm-folder-list');
  var result = document.getElementById('share-qcm-result');
  if (result) result.style.display = 'none';
  if (!list) { if (typeof openModal === 'function') openModal('modal-share-qcm'); return; }

  var flds = typeof folders !== 'undefined' ? folders : [];
  var qs = typeof questions !== 'undefined' ? questions : [];
  var cs = typeof courses !== 'undefined' ? courses : [];

  if (!flds.length) {
    list.innerHTML = '<div style="text-align:center;opacity:.5;padding:1rem;font-size:.85rem;">Aucun dossier disponible.</div>';
  } else {
    list.innerHTML = flds.map(function(f) {
      var fCourses = cs.filter(function(c) { return c.folderId === f.id; });
      var fQ = fCourses.reduce(function(s, c) {
        return s + qs.filter(function(q) { return q.courseId === c.id; }).length;
      }, 0);
      return '<label style="display:flex;align-items:center;gap:.7rem;padding:.65rem .8rem;border-radius:12px;background:var(--card-bg,#fff);cursor:pointer;">'
        + '<input type="checkbox" class="share-folder-cb" data-id="' + _escHtml(f.id) + '" checked style="width:16px;height:16px;accent-color:var(--primary);flex-shrink:0">'
        + '<div style="width:10px;height:10px;border-radius:50%;background:' + _escHtml(f.color || '#888') + ';flex-shrink:0"></div>'
        + '<div style="flex:1;font-size:.9rem;font-weight:600;">' + _escHtml(f.name) + '</div>'
        + '<div style="font-size:.75rem;opacity:.55;">' + fCourses.length + ' cours · ' + fQ + ' q.</div>'
        + '</label>';
    }).join('');
  }

  if (typeof openModal === 'function') openModal('modal-share-qcm');
}

function toggleAllShareFolders(checked) {
  document.querySelectorAll('.share-folder-cb').forEach(function(cb) { cb.checked = checked; });
}

function generateShareLink() {
  var cbs = document.querySelectorAll('.share-folder-cb:checked');
  if (!cbs.length) {
    if (typeof showNotif === 'function') showNotif('Sélectionne au moins un dossier.', 'error');
    return;
  }

  var selectedIds = Array.from(cbs).map(function(cb) { return cb.dataset.id; });

  var selFolders = folders.filter(function(f) { return selectedIds.indexOf(f.id) !== -1; });
  var selCourses = courses.filter(function(c) { return selectedIds.indexOf(c.folderId) !== -1; });
  var courseIds = selCourses.map(function(c) { return c.id; });
  var selSubs = subFolders.filter(function(sf) { return selectedIds.indexOf(sf.folderId) !== -1; });
  var selQuestions = questions.filter(function(q) { return courseIds.indexOf(q.courseId) !== -1; });

  var payload = {
    v: 1,
    from: getMyName(),
    exportedAt: Date.now(),
    folders: selFolders,
    subFolders: selSubs,
    courses: selCourses,
    questions: selQuestions
  };

  var encoded;
  try {
    encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch(e) {
    if (typeof showNotif === 'function') showNotif('Erreur lors de l\'encodage.', 'error');
    return;
  }

  var base = window.location.href.split('?')[0].split('#')[0];

  var resultDiv = document.getElementById('share-qcm-result');
  var linkInput = document.getElementById('share-qcm-link');
  if (resultDiv) resultDiv.style.display = '';
  if (linkInput) {
    linkInput.value = '⏳ Génération du lien court…';
    linkInput.disabled = true;
  }

  // Stocker les données via GitHub Gist anonyme → ID court
  fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
    body: JSON.stringify({
      description: 'Kiné+ QCM share',
      public: false,
      files: { 'kineplus-share.json': { content: JSON.stringify(payload) } }
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.id) throw new Error('no id');
    if (linkInput) { linkInput.value = data.id; linkInput.disabled = false; }
    if (typeof showNotif === 'function') showNotif('Code prêt à partager ! 🎉', 'ok');
  })
  .catch(function() {
    if (linkInput) { linkInput.value = 'Erreur — vérifie ta connexion internet.'; linkInput.disabled = false; }
    if (typeof showNotif === 'function') showNotif('Connexion internet requise pour partager.', 'error');
  });
}

function copyShareLink() {
  var input = document.getElementById('share-qcm-link');
  if (!input || !input.value) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(function() {
      if (typeof showNotif === 'function') showNotif('Lien copié !', 'success');
    }).catch(function() { _fallbackCopy(input.value); });
  } else {
    _fallbackCopy(input.value);
  }
}

function checkShareParam() {
  var params = new URLSearchParams(window.location.search);
  var clean = window.location.href.split('?')[0];

  // Nouveau format court : ?gist=ID
  var gistId = params.get('gist');
  if (gistId) {
    window.history.replaceState({}, '', clean);
    if (typeof showNotif === 'function') showNotif('Chargement du partage…', 'ok');
    fetch('https://api.github.com/gists/' + gistId, {
      headers: { 'Accept': 'application/vnd.github+json' }
    })
    .then(function(r) { return r.json(); })
    .then(function(g) {
      var content = g.files && g.files['kineplus-share.json'] && g.files['kineplus-share.json'].content;
      if (!content) throw new Error('invalid');
      var data = JSON.parse(content);
      if (!data || !data.folders || !data.v) throw new Error('invalid');
      _shareImportData = data;
      _renderImportModal(data);
      if (typeof openModal === 'function') openModal('modal-import-qcm');
    })
    .catch(function() {
      if (typeof showNotif === 'function') showNotif('Lien expiré ou invalide.', 'error');
    });
    return;
  }

  // Ancien format long : ?share=base64
  var encoded = params.get('share');
  if (!encoded) return;

  var data;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch(e) { return; }

  if (!data || !data.folders || !data.v) return;

  window.history.replaceState({}, '', clean);
  _shareImportData = data;
  _renderImportModal(data);
  if (typeof openModal === 'function') openModal('modal-import-qcm');
}

function openImportQcmModal() {
  // Reset UI au champ code
  var codeSection = document.getElementById('import-code-section');
  var actionsSection = document.getElementById('import-qcm-actions');
  var cancelRow = document.getElementById('import-qcm-cancel-row');
  var codeInput = document.getElementById('import-code-input');
  var meta = document.getElementById('import-qcm-meta');
  var list = document.getElementById('import-qcm-folder-list');
  if (codeSection) codeSection.style.display = '';
  if (actionsSection) actionsSection.style.display = 'none';
  if (cancelRow) cancelRow.style.display = '';
  if (codeInput) codeInput.value = '';
  if (meta) meta.textContent = '';
  if (list) list.innerHTML = '';
  _shareImportData = null;
  if (typeof openModal === 'function') openModal('modal-import-qcm');
}

function loadFromCode() {
  var input = document.getElementById('import-code-input');
  var code = (input && input.value.trim()) || '';
  if (!code) { if (typeof showNotif === 'function') showNotif('Colle le code reçu.', 'error'); return; }
  if (typeof showNotif === 'function') showNotif('Chargement…', 'ok');
  fetch('https://api.github.com/gists/' + code, { headers: { 'Accept': 'application/vnd.github+json' } })
    .then(function(r) { return r.json(); })
    .then(function(g) {
      var content = g.files && g.files['kineplus-share.json'] && g.files['kineplus-share.json'].content;
      if (!content) throw new Error('invalid');
      var data = JSON.parse(content);
      if (!data || !data.folders || !data.v) throw new Error('invalid');
      _shareImportData = data;
      _renderImportModal(data);
    })
    .catch(function() { if (typeof showNotif === 'function') showNotif('Code invalide ou expiré.', 'error'); });
}

function _renderImportModal(data) {
  var meta = document.getElementById('import-qcm-meta');
  var list = document.getElementById('import-qcm-folder-list');
  if (!meta || !list) return;
  // Basculer l'interface : cacher champ code, montrer actions
  var codeSection = document.getElementById('import-code-section');
  var actionsSection = document.getElementById('import-qcm-actions');
  var cancelRow = document.getElementById('import-qcm-cancel-row');
  if (codeSection) codeSection.style.display = 'none';
  if (actionsSection) actionsSection.style.display = '';
  if (cancelRow) cancelRow.style.display = 'none';

  var total = (data.questions || []).length;
  meta.textContent = 'Partagé par ' + (data.from || 'un ami') + ' — ' + (data.folders || []).length + ' dossier(s), ' + total + ' question(s).';

  var courses = data.courses || [];
  var questions = data.questions || [];

  list.innerHTML = (data.folders || []).map(function(f) {
    var fCourses = courses.filter(function(c) { return c.folderId === f.id; });
    var fQ = fCourses.reduce(function(s, c) {
      return s + questions.filter(function(q) { return q.courseId === c.id; }).length;
    }, 0);
    return '<label style="display:flex;align-items:center;gap:.7rem;padding:.65rem .8rem;border-radius:12px;background:var(--card-bg,#fff);cursor:pointer;">'
      + '<input type="checkbox" class="import-folder-cb" data-id="' + _escHtml(f.id) + '" checked style="width:16px;height:16px;accent-color:var(--primary);flex-shrink:0">'
      + '<div style="width:10px;height:10px;border-radius:50%;background:' + _escHtml(f.color || '#888') + ';flex-shrink:0"></div>'
      + '<div style="flex:1;font-size:.9rem;font-weight:600;">' + _escHtml(f.name) + '</div>'
      + '<div style="font-size:.75rem;opacity:.55;">' + fCourses.length + ' cours · ' + fQ + ' q.</div>'
      + '</label>';
  }).join('');
}

function toggleAllImportFolders(checked) {
  document.querySelectorAll('.import-folder-cb').forEach(function(cb) { cb.checked = checked; });
}

function importSelectedFolders() {
  var data = _shareImportData;
  if (!data) return;

  var cbs = document.querySelectorAll('.import-folder-cb:checked');
  if (!cbs.length) {
    if (typeof showNotif === 'function') showNotif('Sélectionne au moins un dossier.', 'error');
    return;
  }

  var selectedIds = Array.from(cbs).map(function(cb) { return cb.dataset.id; });

  var now = Date.now();
  var idMap = {};

  function newId(old) {
    if (!idMap[old]) idMap[old] = 'imp_' + now + '_' + Math.random().toString(36).slice(2, 7);
    return idMap[old];
  }

  var imported = { folders: 0, courses: 0, questions: 0 };

  (data.folders || []).forEach(function(f) {
    if (selectedIds.indexOf(f.id) === -1) return;
    var nf = Object.assign({}, f, { id: newId(f.id) });
    folders.push(nf);
    imported.folders++;
  });

  (data.subFolders || []).forEach(function(sf) {
    if (selectedIds.indexOf(sf.folderId) === -1) return;
    subFolders.push(Object.assign({}, sf, { id: newId(sf.id), folderId: newId(sf.folderId) }));
  });

  (data.courses || []).forEach(function(c) {
    if (selectedIds.indexOf(c.folderId) === -1) return;
    var nc = Object.assign({}, c, { id: newId(c.id), folderId: newId(c.folderId) });
    if (c.subFolderId) nc.subFolderId = newId(c.subFolderId);
    courses.push(nc);
    imported.courses++;
  });

  var importedCourseIds = Object.keys(idMap);
  (data.questions || []).forEach(function(q) {
    if (!idMap[q.courseId]) return;
    questions.push(Object.assign({}, q, { id: newId(q.id), courseId: newId(q.courseId) }));
    imported.questions++;
  });

  if (typeof saveAll === 'function') saveAll();
  if (typeof closeModal === 'function') closeModal('modal-import-qcm');
  if (typeof showNotif === 'function') showNotif(imported.folders + ' dossier(s), ' + imported.courses + ' cours, ' + imported.questions + ' question(s) importés !', 'success');
  if (typeof renderHome === 'function') renderHome();
  _shareImportData = null;
}

function renderChallenges() {
  var el = document.getElementById('fr-challenges');
  if (!el) return;
  _frLoad();

  if (!_challenges.length) {
    el.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center;opacity:.6;">'
      + '<div style="font-size:2.5rem;">🏆</div>'
      + '<p style="margin-top:.5rem;">Aucun défi en cours</p>'
      + '<p style="font-size:.85rem;">Importez un code défi pour commencer !</p>'
      + '</div>';
    return;
  }

  el.innerHTML = _challenges.map(function(ch) {
    var daysLeft = Math.max(0, Math.ceil(((ch.deadline || Date.now()) - Date.now()) / 86400000));
    var done = daysLeft === 0;

    var current = 0;
    if (ch.type === 'questions') {
      current = ((KS && KS.totalAnswered) || 0) - ((ch.baseline && ch.baseline.questions) || 0);
    } else if (ch.type === 'streak') {
      current = (KS && KS.streak) || 0;
    } else if (ch.type === 'mastery') {
      current = _calcMastery(KD);
    }
    current = Math.max(0, current);

    var target = ch.target || 1;
    var pct = Math.min(100, Math.round(current / target * 100));
    var completed = pct >= 100;
    var barColor = completed ? '#f59e0b' : 'var(--primary)';

    var typeIcon = ch.type === 'questions' ? '📝' : ch.type === 'streak' ? '🔥' : '⭐';

    return '<div style="padding:.9rem 1rem;border-radius:14px;background:var(--card-bg,#fff);box-shadow:0 1px 6px rgba(0,0,0,.07);margin-bottom:.6rem;' + (completed ? 'border:1.5px solid #f59e0b;' : '') + '">'
      + '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;">'
      +   '<span style="font-size:1.3rem;">' + typeIcon + '</span>'
      +   '<div style="flex:1;min-width:0;">'
      +     '<div style="font-weight:600;font-size:.9rem;">' + _escHtml(_chalTitle(ch)) + '</div>'
      +     '<div style="font-size:.75rem;opacity:.55;">De ' + _escHtml(ch.from || 'Inconnu') + (done ? ' · Expiré' : ' · ' + daysLeft + ' j. restant' + (daysLeft !== 1 ? 's' : '')) + '</div>'
      +   '</div>'
      +   (completed ? '<span style="font-size:.75rem;font-weight:700;color:#f59e0b;">COMPLÉTÉ !</span>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:.6rem;">'
      +   '<div style="flex:1;height:7px;border-radius:99px;background:rgba(0,0,0,.08);overflow:hidden;">'
      +     '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:99px;transition:width .4s;"></div>'
      +   '</div>'
      +   '<span style="font-size:.78rem;font-weight:600;color:' + barColor + ';white-space:nowrap;">' + current + '/' + target + '</span>'
      + '</div>'
      + '</div>';
  }).join('');
}
