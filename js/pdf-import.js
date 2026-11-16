// ══════════════════════════════════════════════
// PDF Import — Kiné+
// Stratégie 1 : détection surlignage (annotations + opérateurs graphiques)
// Stratégie 2 : grille de correction manuelle (prioritaire)
// ══════════════════════════════════════════════

(function () {
  'use strict';

  let _parsedQuestions = [];
  let _selectedFile = null;

  // ── Utilitaires UI ──────────────────────────────────────

  function el(id) { return document.getElementById(id); }

  function pdfShowProgress(visible, label) {
    el('pdf-progress-wrap').style.display = visible ? 'block' : 'none';
    if (label) el('pdf-progress-label').textContent = label;
  }

  function pdfSetProgress(pct) {
    el('pdf-progress-bar').style.width = Math.min(100, pct) + '%';
  }

  function pdfShowError(msg) {
    const e = el('pdf-error');
    e.textContent = msg;
    e.style.display = msg ? 'block' : 'none';
  }

  function pdfShowPreview(count) {
    const wrap = el('pdf-preview-info');
    if (count > 0) {
      el('pdf-preview-count').textContent =
        ` ${count} question${count > 1 ? 's' : ''} détectée${count > 1 ? 's' : ''} — prêt à importer`;
      wrap.style.display = 'block';
      el('pdf-folder-wrap').style.display = 'block';
      el('pdf-import-btn').style.display = '';
    } else {
      wrap.style.display = 'none';
      el('pdf-folder-wrap').style.display = 'none';
      el('pdf-import-btn').style.display = 'none';
    }
  }

  // ── Click / drag-drop ────────────────────────────────────

  window.pdfZoneClick = function (e) {
    e.stopPropagation();
    const input = document.getElementById('pdf-file-input');
    if (input) input.click();
  };

  function setupDropZone() {
    const zone = el('pdf-drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.style.borderColor = 'var(--primary)';
      zone.style.background = 'color-mix(in srgb, var(--primary) 8%, transparent)';
    });
    zone.addEventListener('dragleave', function () {
      zone.style.borderColor = '';
      zone.style.background = '';
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.style.borderColor = '';
      zone.style.background = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        pdfFileSelected(file);
      } else {
        pdfShowError('Veuillez déposer un fichier PDF.');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDropZone);
  } else {
    setupDropZone();
  }

  // ── Sélection du fichier ─────────────────────────────────

  window.pdfFileSelected = async function (file) {
    if (!file) return;
    _selectedFile = file;
    _parsedQuestions = [];

    el('pdf-drop-zone').style.display = 'none';
    const info = el('pdf-file-info');
    info.style.display = 'flex';
    el('pdf-file-name').textContent = file.name;
    el('pdf-file-pages').textContent = 'Lecture en cours…';
    pdfShowError('');
    pdfShowPreview(0);

    const folderInput = el('pdf-folder-name');
    if (folderInput && !folderInput.value) {
      folderInput.value = file.name.replace(/\.pdf$/i, '');
    }

    try {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js non chargé — recharge la page.');
      }

      pdfShowProgress(true, 'Lecture du PDF…');
      pdfSetProgress(5);

      const text = await extractTextFromPDF(file);

      pdfSetProgress(80);
      pdfShowProgress(true, 'Analyse des questions…');

      if (typeof parseQCM !== 'function') {
        throw new Error('Moteur de parsing introuvable. Rechargez la page.');
      }

      _parsedQuestions = parseQCM(text);
      pdfSetProgress(100);

      el('pdf-file-pages').textContent =
        `${_parsedQuestions.length} question${_parsedQuestions.length !== 1 ? 's' : ''} trouvée${_parsedQuestions.length !== 1 ? 's' : ''}`;

      pdfShowProgress(false);

      if (_parsedQuestions.length === 0) {
        pdfShowError('Aucune question QCM détectée. Vérifiez le format du PDF.');
      } else {
        pdfShowPreview(_parsedQuestions.length);
      }
    } catch (err) {
      pdfShowProgress(false);
      pdfShowError('Erreur : ' + (err.message || err));
      el('pdf-file-pages').textContent = 'Échec de la lecture';
      console.error('[PDF Import]', err);
    }
  };

  // ── Stratégie 1 : Extraction texte + détection surlignages ──

  async function getYellowRectsFromOperators(page) {
    const rects = [];
    try {
      const opList = await page.getOperatorList();
      const ops = opList.fnArray, args = opList.argsArray;
      const OPS = pdfjsLib.OPS;
      let isYellow = false;
      let ctmStack = [[1,0,0,1,0,0]]; // pile de matrices CTM simplifiées

      function currentTranslation() {
        const m = ctmStack[ctmStack.length - 1];
        return { tx: m[4], ty: m[5] };
      }

      for (let j = 0; j < ops.length; j++) {
        const op = ops[j], arg = args[j];

        if (op === OPS.save) {
          ctmStack.push([...ctmStack[ctmStack.length - 1]]);
        } else if (op === OPS.restore) {
          if (ctmStack.length > 1) ctmStack.pop();
          isYellow = false;
        } else if (op === OPS.transform) {
          // concatène la translation sur la matrice courante
          const cur = ctmStack[ctmStack.length - 1];
          const [a,b,c,d,e,f] = arg;
          ctmStack[ctmStack.length - 1] = [
            cur[0]*a + cur[2]*b, cur[1]*a + cur[3]*b,
            cur[0]*c + cur[2]*d, cur[1]*c + cur[3]*d,
            cur[0]*e + cur[2]*f + cur[4], cur[1]*e + cur[3]*f + cur[5]
          ];
        } else if (op === OPS.setFillRGBColor) {
          const [r, g, b] = arg;
          // Jaune : R et G élevés, B faible
          isYellow = (r > 0.7 && g > 0.6 && b < 0.4);
        } else if (op === OPS.setFillGray) {
          isYellow = false;
        } else if (op === OPS.setFillColorN || op === OPS.setFillColor) {
          // CMYK ou autre — tenter de détecter jaune CMYK (0,0,1,0)
          if (arg && arg.length === 4) {
            const [c2,m2,y2,k2] = arg;
            isYellow = (c2 < 0.1 && m2 < 0.3 && y2 > 0.7 && k2 < 0.1);
          } else {
            isYellow = false;
          }
        } else if (op === OPS.rectangle && isYellow) {
          const [x, y, w, h] = arg;
          const { tx, ty } = currentTranslation();
          const ax = x + tx, ay = y + ty;
          rects.push([
            Math.min(ax, ax + w), Math.min(ay, ay + h),
            Math.max(ax, ax + w), Math.max(ay, ay + h)
          ]);
        }
      }
    } catch (e) {
      // Silencieux — on continue sans rectangles graphiques
    }
    return rects;
  }

  async function extractTextFromPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js non chargé. Rechargez la page.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    let fullText = '';
    let totalHighlights = 0;

    for (let i = 1; i <= numPages; i++) {
      pdfSetProgress(5 + (i / numPages) * 70);
      const page = await pdf.getPage(i);

      const [content, annotations, yellowRects] = await Promise.all([
        page.getTextContent(),
        page.getAnnotations(),
        getYellowRectsFromOperators(page)
      ]);

      // Annotations Highlight standard
      const annotHighlights = annotations
        .filter(a => a.subtype === 'Highlight' && a.rect)
        .map(a => {
          const r = a.rect;
          return [Math.min(r[0],r[2]), Math.min(r[1],r[3]),
                  Math.max(r[0],r[2]), Math.max(r[1],r[3])];
        });

      const allHighlights = [...annotHighlights, ...yellowRects];
      totalHighlights += allHighlights.length;

      function isHighlighted(item) {
        if (!allHighlights.length) return false;
        const x = item.transform[4];
        const y = item.transform[5];
        const w = item.width || 0;
        return allHighlights.some(r =>
          y >= r[1] - 20 && y <= r[3] + 20 &&
          x + w >= r[0] - 10 && x <= r[2] + 10
        );
      }

      // Reconstruction ligne par ligne
      let pageText = '';
      let lastY = null;
      let lineItems = [], lineHighlighted = false;

      function flushLine() {
        if (!lineItems.length) return;
        const s = lineItems.join('');
        if (s.trim()) {
          pageText += (lineHighlighted ? 'CORRECT:' : '') + s + '\n';
        }
        lineItems = [];
        lineHighlighted = false;
      }

      for (const item of content.items) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          flushLine();
        }
        if (isHighlighted(item)) lineHighlighted = true;
        if (item.str) lineItems.push(item.str);
        lastY = item.transform[5];
      }
      flushLine();

      fullText += pageText + '\n';
    }

    console.log('[PDF Import] Highlights détectés (total):', totalHighlights);
    console.log('[PDF Import] Extrait (800 chars):\n', fullText.substring(0, 800));
    return fullText;
  }

  // ── Stratégie 2 : Parser la grille de correction ─────────
  // Format accepté :
  //   "1A 2B 3C 4D"  → numéro + lettre
  //   "A B C D"      → lettres seules (dans l'ordre des questions)
  //   "1A 2BD 3C"    → plusieurs bonnes réponses (pas supporté dans le modèle, prend la 1ère)

  function parseCorrectionGrid(gridStr) {
    if (!gridStr || !gridStr.trim()) return null;
    const s = gridStr.trim();
    const map = {}; // index 0-based → lettre correcte (A/B/C/D)

    // Essayer format "1A 2B 3C..."
    const withNums = [...s.matchAll(/(\d+)\s*([A-Da-d])/g)];
    if (withNums.length > 0) {
      withNums.forEach(m => {
        const idx = parseInt(m[1]) - 1;
        map[idx] = m[2].toUpperCase();
      });
      return map;
    }

    // Essayer format lettres seules "A B C D" ou "ABCD"
    const letters = [...s.matchAll(/([A-Da-d])/g)];
    if (letters.length > 0) {
      letters.forEach((m, i) => {
        map[i] = m[1].toUpperCase();
      });
      return map;
    }

    return null;
  }

  function applyGrid(questions, gridMap) {
    if (!gridMap) return questions;
    const LETTERS = ['A', 'B', 'C', 'D'];
    return questions.map((q, i) => {
      const correctLetter = gridMap[i];
      if (!correctLetter) return q;
      const idx = LETTERS.indexOf(correctLetter);
      if (idx < 0 || idx >= q.answers.length) return q;
      return { ...q, correct: idx };
    });
  }

  // ── Reset ────────────────────────────────────────────────

  window.pdfReset = function () {
    _selectedFile = null;
    _parsedQuestions = [];
    el('pdf-drop-zone').style.display = '';
    el('pdf-file-info').style.display = 'none';
    el('pdf-file-input').value = '';
    el('pdf-folder-name').value = '';
    const gridEl = el('pdf-correction-grid');
    if (gridEl) gridEl.value = '';
    pdfShowProgress(false);
    pdfShowPreview(0);
    pdfShowError('');
  };

  // ── Import final ─────────────────────────────────────────

  window.pdfDoImport = function () {
    if (!_parsedQuestions.length) {
      pdfShowError('Aucune question à importer.');
      return;
    }

    const folderName = (el('pdf-folder-name').value || '').trim();
    if (!folderName) {
      el('pdf-folder-name').focus();
      el('pdf-folder-name').style.borderColor = 'var(--error)';
      setTimeout(() => { el('pdf-folder-name').style.borderColor = ''; }, 1500);
      return;
    }

    // Stratégie 2 : grille de correction manuelle (prioritaire)
    const gridStr = (el('pdf-correction-grid') ? el('pdf-correction-grid').value : '') || '';
    const gridMap = parseCorrectionGrid(gridStr);
    let finalQuestions = gridMap
      ? applyGrid(_parsedQuestions, gridMap)
      : _parsedQuestions;

    // Crée le dossier
    const folderId = typeof uid === 'function' ? uid() : ('f' + Date.now());
    const newFolder = { id: folderId, name: folderName, icon: '📄', color: '#5B8DEF', isAnnale: true };
    if (typeof folders !== 'undefined') folders.push(newFolder);

    // Crée un cours
    const courseId = typeof uid === 'function' ? uid() : ('c' + Date.now());
    const newCourse = { id: courseId, folderId: folderId, name: folderName };
    if (typeof courses !== 'undefined') courses.push(newCourse);

    // Injecte les questions
    let added = 0;
    finalQuestions.forEach(function (q) {
      const newQ = {
        id: typeof uid === 'function' ? uid() : ('q' + Date.now() + Math.random()),
        courseId: courseId,
        question: q.question,
        answers: q.answers,
        correct: q.correct,
        expl: q.expl || ''
      };
      if (typeof questions !== 'undefined') {
        questions.push(newQ);
        added++;
      }
    });

    if (typeof saveAll === 'function') saveAll();

    const usedGrid = gridMap ? ' (grille manuelle)' : '';
    closeModal('modal-import');
    pdfReset();

    if (typeof showNotif === 'function') {
      showNotif(
        `📄 ${added} question${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''} dans "${folderName}"${usedGrid}`,
        'ok'
      );
    }

    if (typeof openFolder === 'function') {
      openFolder(folderId);
    } else if (typeof renderHome === 'function') {
      renderHome();
    }
  };

})();
