/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  integrations.js — Kiné+ Plugin System                                 ║
 * ║  Architecte : Plugin Registry + Lazy Loader                            ║
 * ║                                                                         ║
 * ║  Principe :                                                             ║
 * ║  • Zéro code chargé au démarrage (lazy par défaut)                     ║
 * ║  • Chaque plugin est un objet { id, load(), mount(), destroy() }       ║
 * ║  • Un seul registre global : window.KinePlugins                        ║
 * ║  • Tous les I/O asynchrones → async/await, jamais de blocage           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   0. CORE — Plugin Registry & Lazy Loader
   ═══════════════════════════════════════════════════════════════════════════ */

const KinePlugins = (function _registry() {

  /** @type {Map<string, { meta: object, instance: object|null }>} */
  const _store = new Map();

  /**
   * register(meta)
   * Enregistre un plugin sans l'activer. Coût ≈ 0.
   * @param {{ id: string, name: string, factory: () => object }} meta
   */
  function register(meta) {
    if (_store.has(meta.id)) {
      console.warn(`[KinePlugins] Plugin déjà enregistré : "${meta.id}"`);
      return;
    }
    _store.set(meta.id, { meta, instance: null });
    console.debug(`[KinePlugins] ✓ Registré : ${meta.name}`);
  }

  /**
   * get(id) → Promise<plugin instance>
   * Active le plugin à la première demande (lazy), retourne le singleton ensuite.
   */
  async function get(id) {
    const entry = _store.get(id);
    if (!entry) throw new Error(`[KinePlugins] Plugin inconnu : "${id}"`);

    // Déjà initialisé → singleton
    if (entry.instance) return entry.instance;

    console.debug(`[KinePlugins] ⚡ Chargement lazy : ${entry.meta.name}`);

    // factory() peut être async (chargement de lib externe, etc.)
    entry.instance = await entry.meta.factory();

    // Hook d'initialisation
    if (typeof entry.instance.init === 'function') {
      await entry.instance.init();
    }

    return entry.instance;
  }

  /**
   * destroy(id)
   * Détruit proprement un plugin (libère mémoire, event listeners, WebGL contexts…)
   */
  async function destroy(id) {
    const entry = _store.get(id);
    if (!entry?.instance) return;
    if (typeof entry.instance.destroy === 'function') {
      await entry.instance.destroy();
    }
    entry.instance = null;
    console.debug(`[KinePlugins] 🗑 Détruit : ${entry.meta.name}`);
  }

  /** Liste des plugins enregistrés (debug) */
  function list() {
    return [..._store.entries()].map(([id, e]) => ({
      id,
      name: e.meta.name,
      active: !!e.instance,
    }));
  }

  return { register, get, destroy, list };
})();

window.KinePlugins = KinePlugins;


/* ═══════════════════════════════════════════════════════════════════════════
   1. PLUGIN : IMPORT ANKI / QUIZLET
   ═══════════════════════════════════════════════════════════════════════════
   Point d'entrée public : window.importFlashcards(file | url)

   Formats supportés :
     • Anki  (.apkg)  → ZIP contenant collection.anki21 (SQLite) ou notes.json
     • Quizlet export (.txt, TSV) → "term\tdefinition\n"
     • CSV générique  (.csv)

   Sortie JSON → compatible moteur mindmap (makeNode)
   ─────────────────────────────────────────────────────────────────────────── */

KinePlugins.register({
  id: 'flashcard-importer',
  name: 'Import Anki / Quizlet',

  factory: () => ({

    /* ── Parsers internes ── */

    /**
     * _parseTSV(text) → FlashcardSet
     * Format Quizlet export : "terme\tdéfinition\n"
     * @returns {{ cards: Array<{ front: string, back: string }>, title: string }}
     */
    _parseTSV(text) {
      const lines = text.trim().split('\n').filter(Boolean);
      const cards = lines.map((line, i) => {
        const [front = '', back = ''] = line.split('\t');
        return { id: `fc-${Date.now()}-${i}`, front: front.trim(), back: back.trim() };
      });
      return { title: 'Import Quizlet', cards };
    },

    /**
     * _parseCSV(text) → FlashcardSet
     * Format CSV : "terme","définition"
     */
    _parseCSV(text) {
      const rows = text.trim().split('\n').map(r =>
        r.split(',').map(c => c.replace(/^"|"$/g, '').trim())
      );
      const cards = rows.map(([front = '', back = ''], i) => ({
        id: `fc-${Date.now()}-${i}`, front, back,
      }));
      return { title: 'Import CSV', cards };
    },

    /**
     * _parseAnki(file) → Promise<FlashcardSet>
     * Un .apkg est un ZIP. On extrait le JSON si présent, sinon on
     * émet une erreur informative (SQLite needs wasm, lazy-loaded).
     */
    async _parseAnki(file) {
      // Lazy load de JSZip uniquement si fichier .apkg
      const JSZip = await _lazyScript(
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
        'JSZip'
      );
      const zip   = await JSZip.loadAsync(file);
      const names = Object.keys(zip.files);

      // Cherche un export JSON (Anki ≥ 2.1.55 avec "export notes as JSON")
      const jsonFile = names.find(n => n.endsWith('.json'));
      if (jsonFile) {
        const raw  = await zip.files[jsonFile].async('text');
        const data = JSON.parse(raw);
        const cards = (data.notes || []).map((n, i) => ({
          id:    `fc-anki-${i}`,
          front: n.fields?.[0] ?? '',
          back:  n.fields?.[1] ?? '',
          tags:  n.tags ?? [],
        }));
        return { title: data.name || 'Deck Anki', cards };
      }

      // Pas de JSON → SQLite (nécessite sql.js wasm, lazy)
      throw new Error(
        'Anki .apkg sans export JSON. Exporte ton deck via : Fichier → Exporter → ' +
        '"Notes en JSON" pour une compatibilité complète.'
      );
    },

    /* ── API principale ── */

    /**
     * import(file | urlString) → Promise<FlashcardSet>
     * Détecte le format, parse, retourne un objet structuré.
     *
     * CONNEXION UI :
     *   document.getElementById('import-file-input')
     *     .addEventListener('change', e => window.importFlashcards(e.target.files[0]))
     */
    async import(source) {
      let text = null;
      let filename = '';

      if (typeof source === 'string') {
        // URL → fetch CORS (Quizlet export direct link, etc.)
        const res  = await fetch(source);
        if (!res.ok) throw new Error(`Fetch échoué : ${res.status}`);
        text     = await res.text();
        filename = source.split('/').pop();
      } else if (source instanceof File) {
        filename = source.name;
        if (filename.endsWith('.apkg')) {
          return this._parseAnki(source);
        }
        text = await source.text();
      } else {
        throw new TypeError('importFlashcards() attend un File ou une URL string');
      }

      const ext = filename.split('.').pop().toLowerCase();
      const set = ext === 'csv' ? this._parseCSV(text) : this._parseTSV(text);

      // Émet un événement pour que le Mind Map ou d'autres modules réagissent
      window.dispatchEvent(new CustomEvent('kine:flashcards-imported', { detail: set }));
      return set;
    },

    /**
     * toMindMapNodes(set) → Array<NodeSpec>
     * Convertit un FlashcardSet en nœuds compatibles makeNode() du moteur.
     *
     * CONNEXION MINDMAP :
     *   const set   = await window.importFlashcards(file);
     *   const nodes = KinePlugins.get('flashcard-importer').toMindMapNodes(set);
     *   nodes.forEach(n => window._mmEngine._addNode(n));  // ou via API publique
     */
    toMindMapNodes(set) {
      const cx = 0, cy = 0, spacing = 160;
      return set.cards.map((card, i) => ({
        text:      card.front,
        subtext:   card.back,
        shape:     'rounded',
        fillColor: '#4f8ef7',
        x: cx + (i % 5) * spacing,
        y: cy + Math.floor(i / 5) * spacing,
      }));
    },

    /** Pas de cleanup nécessaire pour ce module */
    destroy() {},
  }),
});

/**
 * window.importFlashcards(file | url)
 * Point d'entrée public. Lazy : charge le plugin au premier appel.
 */
window.importFlashcards = async function(source) {
  const plugin = await KinePlugins.get('flashcard-importer');
  return plugin.import(source);
};


/* ═══════════════════════════════════════════════════════════════════════════
   2. PLUGIN : MODULE 3D ANATOMIE
   ═══════════════════════════════════════════════════════════════════════════
   Ouvre la recherche Sketchfab dans un nouvel onglet (window.open).
   Pas d'iframe, pas de modale — contourne tous les problèmes CSP/X-Frame.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Traductions muscle FR → terme EN pour BioDigital Human.
 * BioDigital est une plateforme d'anatomie 3D dédiée à l'enseignement médical —
 * aucun problème CSP ni 404.
 */
const _anatomyTerms = {
  'biceps':          'biceps brachii',
  'quadriceps':      'quadriceps femoris',
  'deltoïde':        'deltoid',
  'deltoid':         'deltoid',
  'triceps surae':   'gastrocnemius',
  'triceps':         'triceps brachii',
  'trapèze':         'trapezius',
  'grand dorsal':    'latissimus dorsi',
  'pectoraux':       'pectoralis major',
  'grand pectoral':  'pectoralis major',
  'fessier':         'gluteus maximus',
  'ischio':          'hamstrings',
  'tibial':          'tibialis anterior',
  'soléaire':        'soleus',
  'psoas':           'psoas',
  'coiffe':          'rotator cuff',
  'sus-épineux':     'supraspinatus',
  'sous-épineux':    'infraspinatus',
  'péronier':        'fibularis longus',
  'extenseur':       'extensor digitorum',
};

/**
 * window.showAnatomyModel(muscleName)
 * Ouvre BioDigital Human dans un nouvel onglet — anatomie 3D interactive,
 * dédiée à l'enseignement médical, toujours disponible.
 */
window.showAnatomyModel = function(muscleName) {
  if (!muscleName) return;
  const lc  = muscleName.toLowerCase().trim();

  // Chercher la meilleure correspondance dans le dictionnaire
  const key = Object.keys(_anatomyTerms).find(k => lc.includes(k));
  const term = key ? _anatomyTerms[key] : muscleName;

  const q = encodeURIComponent(term);
  // BioDigital Human — moteur de recherche anatomique 3D dédié médecine/kiné
  // Google — recherche anatomie garantie de fonctionner
  const searchQ = encodeURIComponent(term + ' anatomy muscle');
  window.open(`https://www.google.com/search?q=${searchQ}`, '_blank');
};


/* ═══════════════════════════════════════════════════════════════════════════
   3. PLUGIN : CONNECTEUR NOTION
   ═══════════════════════════════════════════════════════════════════════════
   Point d'entrée public : window.NotionService

   Auth : OAuth 2.0 PKCE (redirect flow) — token stocké dans sessionStorage
   Sync  : Notion API v2022-06-28
   ─────────────────────────────────────────────────────────────────────────── */

KinePlugins.register({
  id: 'notion-connector',
  name: 'Connecteur Notion',

  factory: () => ({

    _BASE:         'https://api.notion.com/v1',
    _VERSION:      '2022-06-28',
    _CLIENT_ID:    '',          // ← à renseigner dans les settings utilisateur
    _REDIRECT_URI: window.location.origin + '/notion-callback',
    _TOKEN_KEY:    'kine_notion_token',

    /* ── Auth ── */

    /**
     * authenticate()
     * Lance le flow OAuth PKCE. Redirige vers Notion puis revient sur _REDIRECT_URI.
     *
     * CONNEXION UI :
     *   <button onclick="window.NotionService.authenticate()">Connecter Notion</button>
     */
    authenticate() {
      if (!this._CLIENT_ID) {
        if (window.showNotif) showNotif('Renseigne ton Client ID Notion dans les réglages', 'error');
        return;
      }
      const state = _randomToken();
      sessionStorage.setItem('notion_oauth_state', state);
      const params = new URLSearchParams({
        client_id:     this._CLIENT_ID,
        response_type: 'code',
        owner:         'user',
        redirect_uri:  this._REDIRECT_URI,
        state,
      });
      window.location.href = `https://api.notion.com/v1/oauth/authorize?${params}`;
    },

    /**
     * handleCallback(code, state)
     * À appeler depuis la page de callback OAuth.
     * Échange le code contre un access_token via ton backend proxy.
     *
     * ⚠️  L'échange token-to-secret DOIT passer par un backend (CORS + secret).
     *     Placeholder : suppose un endpoint /api/notion/token sur ton serveur.
     */
    async handleCallback(code, state) {
      const saved = sessionStorage.getItem('notion_oauth_state');
      if (state !== saved) throw new Error('Notion OAuth : state mismatch (CSRF)');

      const res = await fetch('/api/notion/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: this._REDIRECT_URI }),
      });
      if (!res.ok) throw new Error(`Token exchange failed : ${res.status}`);
      const { access_token } = await res.json();
      sessionStorage.setItem(this._TOKEN_KEY, access_token);
      return access_token;
    },

    _getToken() {
      const t = sessionStorage.getItem(this._TOKEN_KEY);
      if (!t) throw new Error('Non authentifié Notion. Appelle NotionService.authenticate() d\'abord.');
      return t;
    },

    _headers() {
      return {
        'Authorization':  `Bearer ${this._getToken()}`,
        'Notion-Version': this._VERSION,
        'Content-Type':   'application/json',
      };
    },

    /* ── Fetch & Transform ── */

    /**
     * fetchPage(pageId) → Promise<PageData>
     * Récupère les blocs d'une page Notion et les structure.
     *
     * CONNEXION UI :
     *   const page = await window.NotionService.fetchPage('abc123...');
     *   // Afficher en liste de révision OU injecter dans le Mind Map :
     *   const nodes = window.NotionService.toMindMapNodes(page);
     */
    async fetchPage(pageId) {
      const [metaRes, blocksRes] = await Promise.all([
        fetch(`${this._BASE}/pages/${pageId}`, { headers: this._headers() }),
        fetch(`${this._BASE}/blocks/${pageId}/children?page_size=100`, { headers: this._headers() }),
      ]);
      if (!metaRes.ok)   throw new Error(`Notion page error : ${metaRes.status}`);
      if (!blocksRes.ok) throw new Error(`Notion blocks error : ${blocksRes.status}`);

      const meta   = await metaRes.json();
      const blocks = await blocksRes.json();

      return {
        id:     pageId,
        title:  meta.properties?.title?.title?.[0]?.plain_text ?? 'Page Notion',
        blocks: this._extractBlocks(blocks.results ?? []),
      };
    },

    /**
     * _extractBlocks(results) → Array<Block>
     * Normalise les blocs Notion en objets simples { type, text, checked }.
     */
    _extractBlocks(results) {
      return results.map(b => {
        const type    = b.type;
        const content = b[type];
        const text    = content?.rich_text?.map(t => t.plain_text).join('') ?? '';
        return {
          type,
          text,
          checked:  content?.checked ?? false,
          children: [],   // fetchChildren() si besoin de récursion
        };
      }).filter(b => b.text);
    },

    /**
     * toMindMapNodes(page) → Array<NodeSpec>
     * Convertit une PageData en nœuds Mind Map hiérarchiques.
     *
     * heading_1 → nœud racine bleu
     * heading_2 → nœud enfant vert
     * paragraph → nœud feuille gris
     * to_do     → nœud feuille avec ✓/✗
     */
    toMindMapNodes(page) {
      return page.blocks.map((b, i) => {
        const isH1  = b.type === 'heading_1';
        const isH2  = b.type === 'heading_2';
        const isTodo = b.type === 'to_do';
        return {
          text:      (isTodo ? (b.checked ? '✓ ' : '✗ ') : '') + b.text,
          shape:     isH1 ? 'diamond' : isH2 ? 'rounded' : 'rect',
          fillColor: isH1 ? '#0284c7' : isH2 ? '#16a34a' : '#475569',
          x: (i % 4) * 200,
          y: Math.floor(i / 4) * 120,
        };
      });
    },

    destroy() { /* stateless, rien à détruire */ },
  }),
});

// Exposition directe (service singleton, pas lazy car très léger)
KinePlugins.get('notion-connector').then(p => { window.NotionService = p; });


/* ═══════════════════════════════════════════════════════════════════════════
   4. PLUGIN : PDF READER INTÉGRÉ
   ═══════════════════════════════════════════════════════════════════════════
   Point d'entrée public :
     window.openPdfReader(file | url)
     window.createNodeFromSelection(text)

   Dépendance externe : pdf.js (lazy, CDN Mozilla)
   ─────────────────────────────────────────────────────────────────────────── */

KinePlugins.register({
  id: 'pdf-reader',
  name: 'PDF Reader intégré',

  factory: () => ({

    _pdfjsLib:    null,
    _currentDoc:  null,
    _currentPage: 1,
    _totalPages:  0,
    _container:   null,

    /* ── Bootstrap HTML ── */
    _buildUI() {
      if (document.getElementById('pdf-viewer')) return;

      const el = document.createElement('div');
      el.id = 'pdf-viewer';
      el.innerHTML = `
        <div class="pdf-header">
          <button id="pdf-close"><span class="material-symbols-outlined">close</span></button>
          <span id="pdf-title">Lecteur PDF</span>
          <div class="pdf-nav">
            <button id="pdf-prev"><span class="material-symbols-outlined">chevron_left</span></button>
            <span id="pdf-page-info">— / —</span>
            <button id="pdf-next"><span class="material-symbols-outlined">chevron_right</span></button>
          </div>
          <button id="pdf-zoom-out"><span class="material-symbols-outlined">zoom_out</span></button>
          <button id="pdf-zoom-in"><span class="material-symbols-outlined">zoom_in</span></button>
          <button id="pdf-extract-qcm" title="Extraire les questions QCM" style="background:var(--primary);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px">
            <span class="material-symbols-outlined" style="font-size:15px">quiz</span> Extraire QCM
          </button>
        </div>
        <div class="pdf-body">
          <canvas id="pdf-canvas"></canvas>
          <!-- Overlay de sélection texte (layer transparent) -->
          <div id="pdf-text-layer"></div>
        </div>
        <div class="pdf-toolbar" id="pdf-toolbar" style="display:none">
          <span id="pdf-selection-preview"></span>
          <button id="pdf-to-mindmap">
            <span class="material-symbols-outlined">account_tree</span>
            Créer un nœud
          </button>
          <button id="pdf-copy">
            <span class="material-symbols-outlined">content_copy</span>
          </button>
        </div>
      `;
      document.body.appendChild(el);
      this._container = el;
      this._bindEvents();
    },

    _bindEvents() {
      document.getElementById('pdf-close').addEventListener('click', () => this.close());
      document.getElementById('pdf-prev').addEventListener('click',  () => this._goPage(-1));
      document.getElementById('pdf-next').addEventListener('click',  () => this._goPage(+1));
      document.getElementById('pdf-zoom-out').addEventListener('click', () => this._zoom(-0.25));
      document.getElementById('pdf-zoom-in').addEventListener('click',  () => this._zoom(+0.25));
      document.getElementById('pdf-to-mindmap').addEventListener('click', () => {
        const text = window.getSelection()?.toString().trim();
        if (text) window.createNodeFromSelection(text);
      });
      document.getElementById('pdf-extract-qcm').addEventListener('click', () => this._extractQCM());
      // Détection de sélection texte → affiche toolbar
      document.getElementById('pdf-text-layer').addEventListener('mouseup', () => {
        const text = window.getSelection()?.toString().trim();
        this._onSelection(text);
      });
    },

    _onSelection(text) {
      const toolbar = document.getElementById('pdf-toolbar');
      const preview = document.getElementById('pdf-selection-preview');
      if (!toolbar || !preview) return;
      if (text && text.length > 0) {
        preview.textContent = text.length > 60 ? text.slice(0, 60) + '…' : text;
        toolbar.style.display = 'flex';
      } else {
        toolbar.style.display = 'none';
      }
    },

    /* ── Rendu PDF.js ── */

    _scale: 1.4,

    async _renderPage(num) {
      if (!this._currentDoc) return;
      const page   = await this._currentDoc.getPage(num);
      const canvas = document.getElementById('pdf-canvas');
      const ctx    = canvas.getContext('2d');
      const vp     = page.getViewport({ scale: this._scale });

      canvas.width  = vp.width;
      canvas.height = vp.height;

      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      // Text layer (pour la sélection)
      const textLayer  = document.getElementById('pdf-text-layer');
      textLayer.style.cssText = `width:${vp.width}px;height:${vp.height}px;`;
      textLayer.innerHTML = '';

      const textContent = await page.getTextContent();
      const pdfjsLib    = this._pdfjsLib;
      // API compatible v2 et v3
      const renderParams = { container: textLayer, viewport: vp, textDivs: [] };
      if (pdfjsLib.renderTextLayer.length === 1) {
        renderParams.textContentSource = textContent;
      } else {
        renderParams.textContent = textContent;
      }
      pdfjsLib.renderTextLayer(renderParams);

      document.getElementById('pdf-page-info').textContent = `${num} / ${this._totalPages}`;
      this._currentPage = num;
    },

    _goPage(delta) {
      const next = this._currentPage + delta;
      if (next >= 1 && next <= this._totalPages) this._renderPage(next);
    },

    _zoom(delta) {
      this._scale = Math.min(3, Math.max(0.5, this._scale + delta));
      this._renderPage(this._currentPage);
    },

    /* ── API principale ── */

    /**
     * open(source) — file ou URL
     * Charge et affiche le PDF. Lazy-load pdf.js au premier appel.
     *
     * CONNEXION UI :
     *   <input type="file" accept=".pdf"
     *     onchange="window.openPdfReader(this.files[0])">
     *
     *   // Depuis un lien externe :
     *   window.openPdfReader('https://…/cours.pdf')
     */
    async open(source) {
      this._buildUI();

      // Réutilise le pdfjsLib chargé dans index.html (v3 UMD, workerSrc déjà fixé)
      if (!this._pdfjsLib) {
        this._pdfjsLib = window.pdfjsLib;
        if (!this._pdfjsLib) throw new Error('PDF.js non disponible — rechargez la page.');
      }

      const data = source instanceof File
        ? await source.arrayBuffer()
        : source;  // URL string → pdf.js fetch lui-même

      this._currentDoc = await this._pdfjsLib.getDocument(data).promise;
      this._totalPages = this._currentDoc.numPages;

      const title = source instanceof File ? source.name : source.split('/').pop();
      const el = document.getElementById('pdf-title');
      if (el) el.textContent = title;

      const viewer = document.getElementById('pdf-viewer');
      viewer.style.display = '';
      viewer.classList.add('open');
      await this._renderPage(1);
    },

    async _extractQCM() {
      if (!this._currentDoc) return;
      const btn = document.getElementById('pdf-extract-qcm');
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:15px;animation:spin 1s linear infinite">progress_activity</span> Extraction…';
      btn.disabled = true;

      try {
        // 1. Extraire tout le texte du PDF avec détection des surlignages
        // Détecte les rectangles jaunes dans le flux graphique (highlights non-annotés)
        async function getYellowRects(page) {
          const rects = [];
          try {
            const opList = await page.getOperatorList();
            const ops = opList.fnArray, args = opList.argsArray;
            const OPS = pdfjsLib.OPS;
            let isYellow = false;
            // Track current transform matrix (simplified - only translation)
            let ctmX = 0, ctmY = 0;
            for (let j = 0; j < ops.length; j++) {
              const op = ops[j], arg = args[j];
              // Set fill RGB color — detect yellow/light colors (R high, G high, B low-mid)
              if (op === OPS.setFillRGBColor) {
                const [r,g,b] = arg;
                isYellow = (r > 0.7 && g > 0.7 && b < 0.5);
              } else if (op === OPS.setFillColorN || op === OPS.setFillColor) {
                isYellow = false; // reset on other color ops to be safe
              } else if (op === OPS.transform) {
                // [a,b,c,d,e,f] — track translation
                ctmX = arg[4]; ctmY = arg[5];
              } else if (op === OPS.rectangle && isYellow) {
                const [x, y, w, h] = arg;
                const ax = x + ctmX, ay = y + ctmY;
                rects.push([Math.min(ax, ax+w), Math.min(ay, ay+h),
                            Math.max(ax, ax+w), Math.max(ay, ay+h)]);
              } else if (op === OPS.restore) {
                ctmX = 0; ctmY = 0;
              }
            }
          } catch(e) { /* ignore */ }
          return rects;
        }

        let fullText = '';
        for (let i = 1; i <= this._currentDoc.numPages; i++) {
          const page = await this._currentDoc.getPage(i);
          const [content, annotations, yellowRects] = await Promise.all([
            page.getTextContent(),
            page.getAnnotations(),
            getYellowRects(page)
          ]);

          // Combine: annotation highlights + operator-list yellow rects
          const highlights = [
            ...annotations.filter(a => a.subtype === 'Highlight' && a.rect).map(a => {
              const r = a.rect;
              return [Math.min(r[0],r[2]), Math.min(r[1],r[3]),
                      Math.max(r[0],r[2]), Math.max(r[1],r[3])];
            }),
            ...yellowRects
          ];

          console.log('[PDF p'+i+'] highlights trouvés:', highlights.length, highlights.slice(0,3));

          function isHighlighted(item) {
            if (!highlights.length) return false;
            const x = item.transform[4], y = item.transform[5];
            const w = item.width || 0;
            return highlights.some(r =>
              y >= r[1] - 20 && y <= r[3] + 20 &&
              x + w >= r[0] - 10 && x <= r[2] + 10
            );
          }

          let pageText = '';
          let lastY = null;
          let lineItems = [], lineHighlighted = false;

          function flushLine() {
            if (!lineItems.length) return;
            const s = lineItems.join('');
            if (s.trim()) pageText += (lineHighlighted ? 'CORRECT:' : '') + s + '\n';
            lineItems = []; lineHighlighted = false;
          }

          for (const item of content.items) {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) flushLine();
            if (isHighlighted(item)) lineHighlighted = true;
            if (item.str) lineItems.push(item.str);
            lastY = item.transform[5];
          }
          flushLine();
          fullText += pageText + '\n';
        }
        console.log('[ExtractQCM] Texte extrait (800 premiers chars):\n', fullText.substring(0, 800));

        // 2. Parser avec parseQCM() de content.js
        if (typeof parseQCM !== 'function') throw new Error('Moteur de parsing introuvable.');
        const parsedQs = parseQCM(fullText);

        console.log('[ExtractQCM] Texte extrait (500 premiers chars):\n', fullText.substring(0, 500));
        console.log('[ExtractQCM] Questions trouvées:', parsedQs.length);

        if (!parsedQs.length) {
          if (typeof showNotif === 'function') showNotif('Aucune question QCM détectée dans ce PDF.', 'err');
          return;
        }

        // 3. Demander le nom du dossier
        const pdfTitle = document.getElementById('pdf-title')?.textContent || 'Annale PDF';
        const folderName = prompt(`${parsedQs.length} question(s) détectée(s) !\n\nNom du dossier à créer :`, pdfTitle.replace(/\.pdf$/i, ''));
        if (!folderName) return;

        // 4. Créer dossier + cours + questions
        const folderId = typeof uid === 'function' ? uid() : ('f' + Date.now());
        const courseId = typeof uid === 'function' ? uid() : ('c' + Date.now());
        folders.push({ id: folderId, name: folderName, icon: '📄', color: '#5B8DEF', isAnnale: true });
        courses.push({ id: courseId, folderId, name: folderName });
        parsedQs.forEach(q => {
          questions.push({
            id: typeof uid === 'function' ? uid() : ('q' + Date.now() + Math.random()),
            courseId, question: q.question, answers: q.answers, correct: q.correct, expl: q.expl || ''
          });
        });
        if (typeof saveAll === 'function') saveAll();

        // 5. Succès
        this.close();
        if (typeof showNotif === 'function') showNotif(`✅ ${questions.length} questions importées dans "${folderName}"`, 'ok');
        window._matiereSource = 'annales-hub';
        if (typeof openFolder === 'function') openFolder(folderId);
        else if (typeof renderHome === 'function') renderHome();

      } catch (err) {
        if (typeof showNotif === 'function') showNotif('Erreur : ' + err.message, 'err');
        console.error('[ExtractQCM]', err);
      } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
      }
    },

    close() {
      const v = document.getElementById('pdf-viewer');
      if (v) { v.classList.remove('open'); v.style.display = 'none'; }
      this._currentDoc = null;
    },

    destroy() {
      document.getElementById('pdf-viewer')?.remove();
      this._pdfjsLib   = null;
      this._currentDoc = null;
    },
  }),
});

window.openPdfReader = async function(source) {
  const plugin = await KinePlugins.get('pdf-reader');
  return plugin.open(source);
};

/**
 * window.createNodeFromSelection(text)
 * Envoie le texte sélectionné dans le PDF vers le moteur Mind Map.
 * Fonctionne hors contexte PDF aussi (sélection n'importe où dans l'app).
 *
 * CONNEXION MINDMAP :
 *   Le moteur écoute 'kine:create-node' et appelle _addNode().
 */
window.createNodeFromSelection = function(text) {
  if (!text) return;
  window.dispatchEvent(new CustomEvent('kine:create-node', {
    detail: {
      text:      text.length > 80 ? text.slice(0, 80) + '…' : text,
      shape:     'rounded',
      fillColor: '#f59e0b',     // ambre = "extrait de PDF"
      source:    'pdf-selection',
    },
  }));
  if (window.showNotif) showNotif('Nœud créé depuis la sélection !', 'success');
};


/* ═══════════════════════════════════════════════════════════════════════════
   5. POMODORO — Modale standard (structure .mdbg existante du site)
   ═══════════════════════════════════════════════════════════════════════════
   Déclenchement : openModal('modal-pomodoro')
   Fermeture     : closeModal('modal-pomodoro') ou clic sur le fond
   ─────────────────────────────────────────────────────────────────────────── */

const _Pomo = {
  _STORE_KEY: 'kine_pomodoro',
  _tick:      null,
  _remaining: 25 * 60,
  _mode:      'work',
  _running:   false,
  _cycleCount: 0,
  _DURATIONS: { 'work': 25*60, 'short-break': 5*60, 'long-break': 15*60 },

  /* ── Persistance ── */
  _load() {
    try { return JSON.parse(localStorage.getItem(this._STORE_KEY)) || {}; }
    catch { return {}; }
  },
  _save(patch) {
    localStorage.setItem(this._STORE_KEY, JSON.stringify({ ...this._load(), ...patch }));
  },

  _recordCycle() {
    const today = new Date().toISOString().slice(0, 10);
    const data  = this._load();
    const todayCycles = (data.todayCycles || 0) + 1;
    const newStreak = data.lastCycleDate === today ? (data.streak || 0) : (data.streak || 0) + 1;
    this._save({
      streak: newStreak, lastCycleDate: today,
      totalCycles: (data.totalCycles || 0) + 1,
      todayCycles, bestStreak: Math.max(newStreak, data.bestStreak || 0),
    });
    const sc = document.getElementById('pomo-streak-count');
    const td = document.getElementById('pomo-today');
    if (sc) sc.textContent = newStreak;
    if (td) td.textContent = todayCycles;
    window.dispatchEvent(new CustomEvent('kine:pomodoro-cycle',
      { detail: { streak: newStreak, mode: this._mode } }));
  },

  /* ── Timer ── */
  _tick_fn() {
    this._remaining--;
    this._updateDisplay();
    if (this._remaining <= 0) this._onCycleEnd();
  },

  _onCycleEnd() {
    this.stop();
    if (this._mode === 'work') {
      this._cycleCount++;
      this._recordCycle();
      _notify('⏱ Pomodoro terminé !', 'Prends une pause méritée.');
      this.setMode(this._cycleCount % 4 === 0 ? 'long-break' : 'short-break');
    } else {
      _notify('☕ Pause terminée !', 'C\'est reparti !');
      this.setMode('work');
    }
  },

  _updateDisplay() {
    const m   = Math.floor(this._remaining / 60).toString().padStart(2, '0');
    const s   = (this._remaining % 60).toString().padStart(2, '0');
    const pct = this._remaining / this._DURATIONS[this._mode];
    const el  = document.getElementById('pomo-time');
    const ring = document.getElementById('pomo-ring-fill');
    if (el)   el.textContent = `${m}:${s}`;
    if (ring) ring.style.strokeDashoffset = 339.3 * (1 - pct);
    document.title = this._running ? `⏱ ${m}:${s} — City Work` : (window._kpTitle||'City Work');
    // Sync topbar chip
    const topTime = document.getElementById('pomo-topbar-time');
    if (topTime) topTime.textContent = `${m}:${s}`;
    const topIcon = document.getElementById('pomo-topbar-icon');
    if (topIcon) topIcon.textContent = this._running ? 'pause' : 'play_arrow';
  },

  /* ── API publique ── */
  show() {
    if (typeof openModal === 'function') openModal('modal-pomodoro');
    const data = this._load();
    const sc = document.getElementById('pomo-streak-count');
    const td = document.getElementById('pomo-today');
    const best = document.getElementById('pomo-best');
    if (sc)   sc.textContent   = data.streak || 0;
    if (td)   td.textContent   = data.todayCycles || 0;
    if (best) best.textContent = data.bestStreak || 0;
    this._updateDisplay();
  },

  hide() {
    this.stop();
    if (typeof closeModal === 'function') closeModal('modal-pomodoro');
    document.title = window._kpTitle||'City Work';
  },

  toggle() { this._running ? this.stop() : this.start(); },

  start() {
    if (this._running) return;
    this._running = true;
    this._tick = setInterval(() => this._tick_fn(), 1000);
    const icon = document.getElementById('pomo-play-icon');
    if (icon) icon.textContent = 'pause';
    // Ferme la modale et affiche le mini-chip dans la topbar
    if (typeof closeModal === 'function') closeModal('modal-pomodoro');
    const chip = document.getElementById('pomo-topbar-chip');
    if (chip) chip.style.display = 'flex';
    _pomoSyncTopbar();
  },

  stop() {
    this._running = false;
    clearInterval(this._tick);
    this._tick = null;
    const icon = document.getElementById('pomo-play-icon');
    if (icon) icon.textContent = 'play_arrow';
    const topIcon = document.getElementById('pomo-topbar-icon');
    if (topIcon) topIcon.textContent = 'play_arrow';
  },

  reset() {
    this.stop();
    this._remaining = this._DURATIONS[this._mode];
    this._updateDisplay();
  },

  skip() { this.stop(); this._onCycleEnd(); },

  setMode(mode) {
    if (!this._DURATIONS[mode]) return;
    this.stop();
    this._mode = mode;
    this._remaining = this._DURATIONS[mode];
    this._updateDisplay();
    const labels = { 'work': 'Travail', 'short-break': 'Pause courte', 'long-break': 'Pause longue' };
    const label  = document.getElementById('pomo-label');
    const tabs   = document.querySelectorAll('#modal-pomodoro .pomo-tab');
    if (label) label.textContent = labels[mode];
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  },

  getStats() { return this._load(); },
};

/* Wiring des boutons de la modale (exécuté une fois au chargement) */
document.addEventListener('DOMContentLoaded', function() {
  const tog  = document.getElementById('pomo-toggle');
  const rst  = document.getElementById('pomo-reset');
  const skp  = document.getElementById('pomo-skip');
  if (tog) tog.addEventListener('click', () => _Pomo.toggle());
  if (rst) rst.addEventListener('click', () => _Pomo.reset());
  if (skp) skp.addEventListener('click', () => _Pomo.skip());
  document.querySelectorAll('#modal-pomodoro .pomo-tab').forEach(tab => {
    tab.addEventListener('click', () => _Pomo.setMode(tab.dataset.mode));
  });
});

window._Pomo = _Pomo;   // exposé pour les onclick inline du chip topbar
window.Pomodoro = {
  show:  () => _Pomo.show(),
  hide:  () => _Pomo.hide(),
  start: () => _Pomo.start(),
  stop:  () => _Pomo.stop(),
  stats: () => _Pomo.getStats(),
};

/** Sync the topbar pause/play icon */
function _pomoSyncTopbar() {
  const icon = document.getElementById('pomo-topbar-icon');
  if (icon) icon.textContent = _Pomo._running ? 'pause' : 'play_arrow';
}


/* ═══════════════════════════════════════════════════════════════════════════
   UTILITAIRES INTERNES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * _lazyScript(url, globalName, isModule)
 * Charge un script externe une seule fois (idempotent).
 * Résout immédiatement si le global est déjà présent.
 * @returns {Promise<any>} le global exposé par le script
 */
function _lazyScript(url, globalName, isModule = false) {
  if (window[globalName]) return Promise.resolve(window[globalName]);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      // Script déjà injecté mais pas encore chargé → attendre
      existing.addEventListener('load',  () => resolve(window[globalName]));
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    if (isModule) s.type = 'module';
    s.onload  = () => resolve(window[globalName]);
    s.onerror = () => reject(new Error(`Impossible de charger : ${url}`));
    document.head.appendChild(s);
  });
}

/**
 * _randomToken() — génère un state CSRF aléatoire
 */
function _randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * _notify(title, body) — Web Notification API avec fallback showNotif
 */
function _notify(title, body) {
  if (window.showNotif) showNotif(title, 'success');
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' });
  }
}

/* ── Listener Mind Map : réception des nœuds créés par les plugins ── */
window.addEventListener('kine:create-node', function(e) {
  const spec = e.detail;
  if (!window.__mmEngine) return;
  // Centre du viewport courant
  const vp = window.__mmEngine.s.vp;
  const cx = (window.__mmEngine.svg.clientWidth  / 2 - vp.ox) / vp.scale;
  const cy = (window.__mmEngine.svg.clientHeight / 2 - vp.oy) / vp.scale;
  window.__mmEngine._addNode?.({
    ...spec,
    x: cx - 80, y: cy - 20,
  });
});

console.debug('[Kiné+] integrations.js chargé — 5 plugins enregistrés ✓');
