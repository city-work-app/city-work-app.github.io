/* datepicker.js — Custom themed date picker for Kiné+ */

(function(){
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_FR   = ['L','M','M','J','V','S','D'];

  let _dp = null; // current picker state: { inputEl, year, month, overlay }

  // ── Build picker DOM ────────────────────────────────────────────
  function _buildPicker(inputEl) {
    // Parse existing value
    const val = inputEl.value; // YYYY-MM-DD
    const today = new Date();
    let year  = today.getFullYear();
    let month = today.getMonth(); // 0-based
    let selDate = null;

    if (val) {
      const parts = val.split('-');
      if (parts.length === 3) {
        year  = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        selDate = val;
      }
    }

    // Overlay backdrop
    const overlay = document.createElement('div');
    overlay.id = '_dp-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;';
    overlay.addEventListener('mousedown', e => {
      if (!e.target.closest('#_dp-picker')) closePicker();
    });

    // Picker card
    const card = document.createElement('div');
    card.id = '_dp-picker';
    card.style.cssText = `
      position:fixed;z-index:10001;
      background:var(--surface);
      border:1.5px solid var(--outline-v,var(--border-subtle));
      border-radius:20px;
      box-shadow:0 16px 48px rgba(0,0,0,.28),0 4px 16px rgba(0,0,0,.18);
      padding:18px 16px 14px;
      min-width:280px;
      font-family:'Manrope',sans-serif;
      user-select:none;
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    _dp = { inputEl, year, month, selDate, overlay, card };
    _renderPicker();
    _positionPicker(inputEl, card);
  }

  function _positionPicker(inputEl, card) {
    const rect = inputEl.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let top = rect.bottom + 8;
    let left = rect.left;
    // Flip up if not enough room below
    if (top + 340 > vh) top = rect.top - 340 - 8;
    // Keep within viewport
    if (left + 296 > vw) left = vw - 296 - 8;
    if (left < 8) left = 8;
    card.style.top  = top  + 'px';
    card.style.left = left + 'px';
  }

  function _renderPicker() {
    if (!_dp) return;
    const { year, month, selDate, card } = _dp;
    const today = new Date();
    const todayStr = today.toISOString().slice(0,10);

    // First day of month (0=Sun,1=Mon…)
    const firstDay = new Date(year, month, 1).getDay();
    // Days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Start on Monday (0=Mon..6=Sun)
    const startOffset = (firstDay + 6) % 7;

    // Header
    const monthLabel = MONTHS_FR[month] + ' ' + year;

    // Build calendar grid
    let gridCells = '';
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
      const dateStr = isCurrentMonth
        ? `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
        : null;
      const isToday = dateStr === todayStr;
      const isSel  = dateStr === selDate;
      const isOther = !isCurrentMonth;

      let cellStyle = `
        width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
        font-size:13px;font-weight:${isToday||isSel?'700':'500'};cursor:${isCurrentMonth?'pointer':'default'};
        transition:background .12s,color .12s;
        color:${isSel?'#fff':isToday?'var(--primary)':isOther?'var(--on-sv)':'var(--on-surface)'};
        background:${isSel?'var(--primary)':isToday?'color-mix(in srgb,var(--primary) 12%,transparent)':'transparent'};
        box-shadow:${isToday&&!isSel?'inset 0 0 0 1.5px var(--primary)':'none'};
        opacity:${isOther?'0.35':'1'};
      `;
      const onclick = isCurrentMonth ? `_dpSelectDay('${dateStr}')` : '';
      gridCells += `<div style="${cellStyle}" onmouseenter="_dpHover(this,${isCurrentMonth&&!isSel})" onmouseleave="_dpLeave(this,${isCurrentMonth&&!isSel})" onclick="${onclick}">${isCurrentMonth ? dayNum : ''}</div>`;
    }

    card.innerHTML = `
      <!-- Header: month nav -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <button onclick="_dpPrevMonth()" style="background:var(--surf-mid);border:none;border-radius:10px;width:32px;height:32px;cursor:pointer;color:var(--on-surface);font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .12s">‹</button>
        <div style="font-size:14px;font-weight:800;color:var(--on-surface);letter-spacing:-.3px">${monthLabel}</div>
        <button onclick="_dpNextMonth()" style="background:var(--surf-mid);border:none;border-radius:10px;width:32px;height:32px;cursor:pointer;color:var(--on-surface);font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .12s">›</button>
      </div>
      <!-- Day labels -->
      <div style="display:grid;grid-template-columns:repeat(7,34px);gap:2px;justify-content:center;margin-bottom:4px">
        ${DAYS_FR.map(d=>`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--on-sv);height:20px;display:flex;align-items:center;justify-content:center">${d}</div>`).join('')}
      </div>
      <!-- Calendar grid -->
      <div style="display:grid;grid-template-columns:repeat(7,34px);gap:2px;justify-content:center">
        ${gridCells}
      </div>
      <!-- Footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle)">
        <button onclick="_dpClear()" style="background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;color:var(--on-sv);font-family:inherit;padding:4px 8px;border-radius:8px;transition:color .12s" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--on-sv)'">Effacer</button>
        <button onclick="_dpToday()" style="background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;color:var(--primary);font-family:inherit;padding:4px 8px;border-radius:8px;transition:background .12s" onmouseover="this.style.background='color-mix(in srgb,var(--primary) 10%,transparent)'" onmouseout="this.style.background='none'">Aujourd'hui</button>
      </div>
    `;
  }

  // ── Public API (called from inline onclick) ──────────────────────
  window._dpPrevMonth = function() {
    if (!_dp) return;
    _dp.month--;
    if (_dp.month < 0) { _dp.month = 11; _dp.year--; }
    _renderPicker();
  };
  window._dpNextMonth = function() {
    if (!_dp) return;
    _dp.month++;
    if (_dp.month > 11) { _dp.month = 0; _dp.year++; }
    _renderPicker();
  };
  window._dpSelectDay = function(dateStr) {
    if (!_dp) return;
    _dp.selDate = dateStr;
    _dp.inputEl.value = dateStr;
    _dp.inputEl.dispatchEvent(new Event('change', {bubbles:true}));
    _dp.inputEl.dispatchEvent(new Event('input', {bubbles:true}));
    _renderPicker();
    setTimeout(closePicker, 150);
  };
  window._dpClear = function() {
    if (!_dp) return;
    _dp.selDate = null;
    _dp.inputEl.value = '';
    _dp.inputEl.dispatchEvent(new Event('change', {bubbles:true}));
    _renderPicker();
  };
  window._dpToday = function() {
    const t = new Date().toISOString().slice(0,10);
    window._dpSelectDay(t);
  };
  window._dpHover = function(el, active) {
    if (!active) return;
    el.style.background = 'color-mix(in srgb,var(--primary) 15%,transparent)';
  };
  window._dpLeave = function(el, active) {
    if (!active) return;
    el.style.background = 'transparent';
  };

  function closePicker() {
    if (_dp) {
      _dp.overlay.remove();
      _dp = null;
    }
  }

  // ── Attach to all type="date" inputs ────────────────────────────
  function attachDatePicker(input) {
    if (input.dataset.dpAttached) return;
    input.dataset.dpAttached = '1';
    // Hide native picker
    input.style.caretColor = 'transparent';
    input.style.cursor = 'pointer';
    input.readOnly = true;
    input.addEventListener('click', e => {
      e.preventDefault();
      if (_dp && _dp.inputEl === input) { closePicker(); return; }
      if (_dp) closePicker();
      _buildPicker(input);
    });
    // Display formatted value
    input.addEventListener('change', () => _updateDisplay(input));
    _updateDisplay(input);
  }

  function _updateDisplay(input) {
    const v = input.value;
    if (!v) { input.placeholder = 'jj/mm/aaaa'; return; }
    const [y,m,d] = v.split('-');
    // Show as dd/mm/yyyy in the input via a sibling span or just leave value
    // We store ISO in value, show formatted via placeholder trick
    // Actually we just show the ISO value — browser already shows it
    // For nicer display we'll use a custom approach
  }

  // ── Auto-attach on DOMContentLoaded + MutationObserver ──────────
  function scanAndAttach() {
    document.querySelectorAll('input[type="date"]').forEach(attachDatePicker);
  }

  document.addEventListener('DOMContentLoaded', () => {
    scanAndAttach();
    // Watch for dynamically added inputs
    new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('input[type="date"]')) attachDatePicker(node);
        node.querySelectorAll?.('input[type="date"]').forEach(attachDatePicker);
      }));
    }).observe(document.body, { childList: true, subtree: true });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _dp) closePicker();
    });
  });

})();
