/* ═══════════════════════════════════════════════════
   KINÉ+ PREMIUM LAYER — interactions & animations
   Chargé en dernier après tous les autres scripts
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ═════════════════════════════════════════
     SLIDING PILL — indicateur nav animé
  ═════════════════════════════════════════ */
  var bnav = document.querySelector('.bnav');
  if (bnav) {
    var pill = document.createElement('div');
    pill.className = 'nav-pill';
    bnav.insertBefore(pill, bnav.firstChild);

    function updatePill() {
      var active = bnav.querySelector('.ni.active');
      if (!active) return;
      var nr = bnav.getBoundingClientRect();
      var br = active.getBoundingClientRect();
      pill.style.left   = (br.left - nr.left) + 'px';
      pill.style.top    = (br.top  - nr.top)  + 'px';
      pill.style.width  = br.width  + 'px';
      pill.style.height = br.height + 'px';
    }

    // Clic sur n'importe quel bouton nav
    bnav.addEventListener('click', function (e) {
      var ni = e.target.closest ? e.target.closest('.ni') : null;
      if (ni) setTimeout(updatePill, 25);
    });

    // Position initiale
    setTimeout(updatePill, 100);
    window.addEventListener('resize', updatePill);
  }

  /* ═════════════════════════════════════════
     COUNTER ANIMATION — chiffres qui comptent
  ═════════════════════════════════════════ */
  function animateNum(el, endVal, duration) {
    if (!el || !endVal || isNaN(endVal) || endVal <= 0) return;
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min((now - t0) / duration, 1);
      var eased = 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(eased * endVal);
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = endVal;
        el.classList.add('num-pop');
        setTimeout(function () { el.classList.remove('num-pop'); }, 400);
      }
    })(performance.now());
  }

  /* ═════════════════════════════════════════
     STAGGER HOME — entrée en cascade
  ═════════════════════════════════════════ */
  function staggerHome() {
    var selectors = [
      '#screen-home .streak-card',
      '#screen-home .goal-card',
      '#screen-home .global-progress-card',
      '#screen-home .sstrip',
      '#screen-home .bento',
      '#screen-home .fg'
    ];
    selectors.forEach(function (sel, i) {
      var el = document.querySelector(sel);
      if (!el) return;
      el.style.opacity   = '0';
      el.style.transform = 'translateY(14px)';
      void el.offsetWidth; // force reflow
      setTimeout(function () {
        el.style.transition =
          'opacity .32s cubic-bezier(0.16,1,0.3,1) ' + (i * 55) + 'ms,' +
          'transform .32s cubic-bezier(0.16,1,0.3,1) ' + (i * 55) + 'ms';
        el.style.opacity   = '1';
        el.style.transform = 'translateY(0)';
      }, 80);
    });
  }

  /* ═════════════════════════════════════════
     GLOBAL PROGRESS CARD — barre de maîtrise
  ═════════════════════════════════════════ */
  function updateGPC() {
    var card = document.getElementById('global-progress-card');
    if (!card || typeof questions === 'undefined') return;

    // Only count questions from active (non-archived) folders
    var activeCourseIds = (typeof courses !== 'undefined' ? courses : [])
      .filter(function(c){ return typeof isFolderArchived === 'function' ? !isFolderArchived(c.folderId) : true; })
      .map(function(c){ return c.id; });
    var activeQs = questions.filter(function(q){ return activeCourseIds.indexOf(q.courseId) !== -1; });
    var total = activeQs.length;
    if (total === 0) { card.style.display = 'none'; return; }

    var easy = 0;
    activeQs.forEach(function (q) {
      var d = typeof getDiff === 'function' ? getDiff(q.id) : '';
      if (d === 'easy' || d === 'acquired') easy++;   // même définition que la maîtrise de l'accueil
    });

    var pct = Math.round((easy / total) * 100);
    card.style.display = 'block';

    card.innerHTML =
      '<div class="gpc-header">' +
        '<span class="gpc-label">Progression globale</span>' +
        '<span class="gpc-pct">' + pct + '%</span>' +
      '</div>' +
      '<div class="gpc-bar"><div class="gpc-fill" id="gpc-fill"></div></div>' +
      '<div class="gpc-sub">' + easy + '\u202f/\u202f' + total + ' questions maîtrisées</div>';

    // Anime la barre après le paint
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var fill = document.getElementById('gpc-fill');
        if (fill) fill.style.width = pct + '%';
      });
    });
  }

  /* ═════════════════════════════════════════
     CONFETTI — célébration score ≥ 80 %
  ═════════════════════════════════════════ */
  function launchConfetti() {
    var canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    var ctx = canvas.getContext('2d');

    var colors = ['#006699','#00524d','#C49A3C','#5A2A8B','#e11d48','#5dd9d0','#f59e0b','#10b981'];
    var pieces = [];
    for (var i = 0; i < 100; i++) {
      pieces.push({
        x:    Math.random() * canvas.width,
        y:    -20 - Math.random() * canvas.height * .35,
        w:    Math.random() * 10 + 4,
        h:    Math.random() * 5  + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot:  Math.random() * Math.PI * 2,
        vx:   (Math.random() - .5) * 4,
        vy:   Math.random() * 2.5 + 1.5,
        vrot: (Math.random() - .5) * .13,
        alpha: 1
      });
    }

    var frame = 0, maxFrames = 150;
    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(function (p) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        p.x   += p.vx;
        p.y   += p.vy;
        p.rot += p.vrot;
        p.vy  += .042; // gravité
        if (frame > maxFrames * .55) p.alpha = Math.max(0, p.alpha - .017);
      });
      frame++;
      if (frame < maxFrames) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
  }

  /* ═════════════════════════════════════════
     RESULT RING GLOW
  ═════════════════════════════════════════ */
  function addRingGlow() {
    var rring = document.querySelector('.rring');
    if (rring) {
      setTimeout(function () { rring.classList.add('loaded'); }, 400);
    }
  }

  /* ═════════════════════════════════════════
     PATCH renderHome — stagger + counters + GPC
  ═════════════════════════════════════════ */
  var _origRH = window.renderHome;
  window.renderHome = function () {
    if (_origRH) _origRH();
    setTimeout(function () {
      staggerHome();
      updateGPC();
      ['stat-q', 'stat-c', 'stat-hard'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) animateNum(el, parseInt(el.textContent) || 0, 520);
      });
    }, 30);
  };

  /* ═════════════════════════════════════════
     PATCH showResults — confetti + ring glow
  ═════════════════════════════════════════ */
  var _origSR = window.showResults;
  if (_origSR) {
    window.showResults = function (duration) {
      _origSR(duration);
      addRingGlow();
      setTimeout(function () {
        var pctEl = document.getElementById('rpc');
        if (pctEl && parseInt(pctEl.textContent) >= 80) launchConfetti();
      }, 750);
    };
  }

  /* ═════════════════════════════════════════
     INIT — exécuté au chargement de la page
  ═════════════════════════════════════════ */
  setTimeout(function () {
    staggerHome();
    updateGPC();
    ['stat-q', 'stat-c', 'stat-hard'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) animateNum(el, parseInt(el.textContent) || 0, 650);
    });
  }, 130);

  /* ═════════════════════════════════════════
     BOYCOTT SYSTEM — show button after answer
  ═════════════════════════════════════════ */
  var observer = new MutationObserver(function() {
    var nrow = document.getElementById('qnrow');
    var boycottBtn = document.getElementById('qboycott');
    if (nrow && boycottBtn && nrow.style.display !== 'none') {
      boycottBtn.style.display = 'inline-flex';
    }
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] });

  /* ═════════════════════════════════════════
     SURVIVAL MODE — vida loss animation
  ═════════════════════════════════════════ */
  var lastLives = 0;
  var checkLivesInterval = setInterval(function() {
    if (typeof session !== 'undefined' && session && session.isSurvival && lastLives > session.lives) {
      var qn = document.getElementById('qn');
      if (qn) {
        qn.style.animation = 'none';
        void qn.offsetWidth; // reflow
        qn.style.animation = 'heartbreak .4s ease-out';
      }
    }
    lastLives = session && session.lives || 0;
  }, 100);

  /* ═════════════════════════════════════════
     PEEKABOO NAV — survol du bas du viewport
  ═════════════════════════════════════════ */
  var navTimer = null;
  var TRIGGER_PX = 70; // zone de déclenchement en bas

  function showNav() {
    bnav.classList.add('bnav-up');
    clearTimeout(navTimer);
  }
  function hideNav(delay) {
    clearTimeout(navTimer);
    navTimer = setTimeout(function () {
      if (!bnav.matches(':hover')) bnav.classList.remove('bnav-up');
    }, delay || 400);
  }

  // Souris proche du bas → montrer
  document.addEventListener('mousemove', function (e) {
    if (e.clientY > window.innerHeight - TRIGGER_PX) {
      showNav();
    } else {
      hideNav(500);
    }
  });

  // Maintenir visible tant que la souris est sur la nav
  bnav.addEventListener('mouseenter', showNav);
  bnav.addEventListener('mouseleave', function () { hideNav(300); });

  // Tactile : afficher 4 s après chaque toucher
  document.addEventListener('touchstart', function () {
    showNav();
    clearTimeout(navTimer);
    navTimer = setTimeout(function () { bnav.classList.remove('bnav-up'); }, 4000);
  }, { passive: true });

  // Afficher brièvement au chargement pour signaler son existence
  showNav();
  setTimeout(function () { hideNav(0); }, 2200);

}());
