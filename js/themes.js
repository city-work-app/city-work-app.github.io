/* themes.js — Kiné+ Design System · 12 thèmes */

// DASH_THEMES évite le conflit avec const THEMES de ui.js
window.DASH_THEMES = [
  {
    id: 'rose-noir',
    name: 'Rosé Noir',
    blurb: 'Élégance sombre, accent rose',
    mode: 'dark',
    display: 'Fraunces',
    particle: { color: 'rgba(236,79,108,0.5)', count: 35, kind: 'dot' },
    vars: {
      '--bg': '#0a0608',
      '--bg-elev': '#100a0d',
      '--surface': '#161013',
      '--surface-2': '#1c1418',
      '--border': 'rgba(255,255,255,0.07)',
      '--border-strong': 'rgba(255,255,255,0.14)',
      '--text': '#f5ebef',
      '--text-muted': '#a08a92',
      '--text-soft': 'rgba(255,255,255,0.4)',
      '--accent': '#ec4f6c',
      '--accent-2': '#f97373',
      '--accent-soft': 'rgba(236,79,108,0.18)',
      '--accent-glow': 'rgba(236,79,108,0.4)',
      '--gold': '#d4af37',
      '--display': "'Fraunces', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'emeraude',
    name: 'Émeraude Nocturne',
    blurb: 'Profondeur marine, accents teal',
    mode: 'dark',
    display: 'Fraunces',
    particle: { color: 'rgba(45,212,191,0.5)', count: 35, kind: 'dot' },
    vars: {
      '--bg': '#06100e',
      '--bg-elev': '#0a1816',
      '--surface': '#0e1c19',
      '--surface-2': '#13241f',
      '--border': 'rgba(255,255,255,0.07)',
      '--border-strong': 'rgba(255,255,255,0.14)',
      '--text': '#eaf4f0',
      '--text-muted': '#8aa39b',
      '--text-soft': 'rgba(255,255,255,0.4)',
      '--accent': '#2dd4bf',
      '--accent-2': '#5eead4',
      '--accent-soft': 'rgba(45,212,191,0.15)',
      '--accent-glow': 'rgba(45,212,191,0.35)',
      '--gold': '#d4af37',
      '--display': "'Fraunces', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'brume',
    name: 'Brume Claire',
    blurb: 'Clarté apaisante, teal doux',
    mode: 'light',
    display: 'Fraunces',
    particle: { color: 'rgba(15,118,110,0.25)', count: 30, kind: 'dot' },
    vars: {
      '--bg': '#f4f6f5',
      '--bg-elev': '#fafbfa',
      '--surface': '#ffffff',
      '--surface-2': '#eef2f1',
      '--border': 'rgba(15,30,28,0.08)',
      '--border-strong': 'rgba(15,30,28,0.18)',
      '--text': '#0e1f1c',
      '--text-muted': '#5b6e6a',
      '--text-soft': 'rgba(14,31,28,0.4)',
      '--accent': '#0f766e',
      '--accent-2': '#14b8a6',
      '--accent-soft': 'rgba(15,118,110,0.12)',
      '--accent-glow': 'rgba(15,118,110,0.25)',
      '--gold': '#92400e',
      '--display': "'Fraunces', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'bordeaux',
    name: 'Bordeaux Aube',
    blurb: 'Chaleur terracotta, élégance sobre',
    mode: 'light',
    display: 'Fraunces',
    particle: { color: 'rgba(159,18,57,0.22)', count: 28, kind: 'dot' },
    vars: {
      '--bg': '#f9f4ef',
      '--bg-elev': '#fcf8f3',
      '--surface': '#ffffff',
      '--surface-2': '#f3ebe2',
      '--border': 'rgba(40,20,15,0.08)',
      '--border-strong': 'rgba(40,20,15,0.18)',
      '--text': '#2a1812',
      '--text-muted': '#7a6258',
      '--text-soft': 'rgba(42,24,18,0.4)',
      '--accent': '#9f1239',
      '--accent-2': '#be123c',
      '--accent-soft': 'rgba(159,18,57,0.10)',
      '--accent-glow': 'rgba(159,18,57,0.25)',
      '--gold': '#92400e',
      '--display': "'Fraunces', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'aurora',
    name: 'Aurora',
    blurb: 'Cosmos animé, violet céleste',
    mode: 'dark',
    display: 'Cormorant Garamond',
    particle: { color: 'rgba(192,132,252,0.5)', count: 40, kind: 'orb' },
    vars: {
      '--bg': '#060818',
      '--bg-elev': '#0a0e26',
      '--surface': 'rgba(20,24,52,0.5)',
      '--surface-2': 'rgba(30,34,68,0.5)',
      '--border': 'rgba(255,255,255,0.08)',
      '--border-strong': 'rgba(192,132,252,0.3)',
      '--text': '#eef0ff',
      '--text-muted': '#9aa0c8',
      '--text-soft': 'rgba(238,240,255,0.4)',
      '--accent': '#c084fc',
      '--accent-2': '#22d3ee',
      '--accent-soft': 'rgba(192,132,252,0.18)',
      '--accent-glow': 'rgba(192,132,252,0.45)',
      '--gold': '#f0d56a',
      '--display': "'Cormorant Garamond', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'verre',
    name: 'Verre',
    blurb: 'Glassmorphism cristallin, ciel bleu',
    mode: 'dark',
    display: 'Playfair Display',
    particle: { color: 'rgba(125,211,252,0.4)', count: 45, kind: 'dot' },
    glass: true,
    vars: {
      '--bg': '#0c1422',
      '--bg-elev': '#101c32',
      '--surface': 'rgba(255,255,255,0.045)',
      '--surface-2': 'rgba(255,255,255,0.07)',
      '--border': 'rgba(255,255,255,0.10)',
      '--border-strong': 'rgba(255,255,255,0.20)',
      '--text': '#eaf3ff',
      '--text-muted': '#8fa3bd',
      '--text-soft': 'rgba(234,243,255,0.4)',
      '--accent': '#7dd3fc',
      '--accent-2': '#a5b4fc',
      '--accent-soft': 'rgba(125,211,252,0.15)',
      '--accent-glow': 'rgba(125,211,252,0.35)',
      '--gold': '#f0d56a',
      '--display': "'Playfair Display', serif",
      '--bg-pattern': 'radial-gradient(circle at 15% 20%, rgba(125,211,252,0.15), transparent 40%), radial-gradient(circle at 85% 70%, rgba(165,180,252,0.12), transparent 40%)',
    }
  },
  {
    id: 'pastel',
    name: 'Pastel',
    blurb: 'Douceur lavande, air de printemps',
    mode: 'light',
    display: 'Playfair Display',
    particle: { color: 'rgba(192,132,252,0.18)', count: 28, kind: 'dot' },
    vars: {
      '--bg': '#fbf6f9',
      '--bg-elev': '#fdf9fc',
      '--surface': '#ffffff',
      '--surface-2': '#f3edf5',
      '--border': 'rgba(60,30,80,0.06)',
      '--border-strong': 'rgba(60,30,80,0.14)',
      '--text': '#2d1b3d',
      '--text-muted': '#7a6a8c',
      '--text-soft': 'rgba(45,27,61,0.4)',
      '--accent': '#a78bfa',
      '--accent-2': '#f0abfc',
      '--accent-soft': 'rgba(167,139,250,0.14)',
      '--accent-glow': 'rgba(167,139,250,0.3)',
      '--gold': '#92400e',
      '--display': "'Playfair Display', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'royal',
    name: 'Royal',
    blurb: 'Bleu nuit, or impérial',
    mode: 'dark',
    display: 'Cormorant Garamond',
    particle: { color: 'rgba(212,175,55,0.35)', count: 32, kind: 'dot' },
    vars: {
      '--bg': '#0a1326',
      '--bg-elev': '#0e1a35',
      '--surface': '#13203f',
      '--surface-2': '#192b50',
      '--border': 'rgba(212,175,55,0.10)',
      '--border-strong': 'rgba(212,175,55,0.30)',
      '--text': '#f4eed8',
      '--text-muted': '#a09a78',
      '--text-soft': 'rgba(244,238,216,0.4)',
      '--accent': '#d4af37',
      '--accent-2': '#f0d56a',
      '--accent-soft': 'rgba(212,175,55,0.14)',
      '--accent-glow': 'rgba(212,175,55,0.35)',
      '--gold': '#f0d56a',
      '--display': "'Cormorant Garamond', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'foret',
    name: 'Forêt',
    blurb: 'Vert sombre, nature profonde',
    mode: 'dark',
    display: 'Fraunces',
    particle: { color: 'rgba(132,204,22,0.4)', count: 35, kind: 'dot' },
    vars: {
      '--bg': '#0a140e',
      '--bg-elev': '#0e1c14',
      '--surface': '#13241c',
      '--surface-2': '#192e23',
      '--border': 'rgba(255,255,255,0.06)',
      '--border-strong': 'rgba(132,204,22,0.25)',
      '--text': '#eaf3e8',
      '--text-muted': '#8ba38f',
      '--text-soft': 'rgba(234,243,232,0.4)',
      '--accent': '#84cc16',
      '--accent-2': '#bef264',
      '--accent-soft': 'rgba(132,204,22,0.14)',
      '--accent-glow': 'rgba(132,204,22,0.35)',
      '--gold': '#d4af37',
      '--display': "'Fraunces', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'brutaliste',
    name: 'Brutaliste',
    blurb: 'Mono noir, bords francs, jaune vif',
    mode: 'light',
    display: 'Space Grotesk',
    brutaliste: true,
    particle: { color: 'rgba(0,0,0,0.18)', count: 20, kind: 'dot' },
    vars: {
      '--bg': '#f0eee9',
      '--bg-elev': '#f5f3ee',
      '--surface': '#ffffff',
      '--surface-2': '#f0eee9',
      '--border': '#0a0a0a',
      '--border-strong': '#0a0a0a',
      '--text': '#0a0a0a',
      '--text-muted': '#3a3a3a',
      '--text-soft': 'rgba(10,10,10,0.4)',
      '--accent': '#0a0a0a',
      '--accent-2': '#facc15',
      '--accent-soft': '#facc15',
      '--accent-glow': 'rgba(250,204,21,0.55)',
      '--gold': '#0a0a0a',
      '--display': "'Space Grotesk', sans-serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'mocha',
    name: 'Mocha',
    blurb: 'Café au lait, chaleur terreuse',
    mode: 'light',
    display: 'Fraunces',
    particle: { color: 'rgba(146,64,14,0.18)', count: 28, kind: 'dot' },
    vars: {
      '--bg': '#f4ebe0',
      '--bg-elev': '#f8f1e6',
      '--surface': '#fdf8f0',
      '--surface-2': '#ede1d0',
      '--border': 'rgba(60,30,10,0.10)',
      '--border-strong': 'rgba(60,30,10,0.22)',
      '--text': '#3b2415',
      '--text-muted': '#8a6f55',
      '--text-soft': 'rgba(59,36,21,0.4)',
      '--accent': '#92400e',
      '--accent-2': '#c2410c',
      '--accent-soft': 'rgba(146,64,14,0.10)',
      '--accent-glow': 'rgba(146,64,14,0.25)',
      '--gold': '#92400e',
      '--display': "'Fraunces', serif",
      '--bg-pattern': 'none',
    }
  },
  {
    id: 'neon',
    name: 'Néon',
    blurb: 'Cyberpunk violet, rose électrique',
    mode: 'dark',
    display: 'Space Grotesk',
    particle: { color: 'rgba(255,0,170,0.55)', count: 45, kind: 'orb' },
    vars: {
      '--bg': '#0a0118',
      '--bg-elev': '#13042a',
      '--surface': '#190736',
      '--surface-2': '#220a45',
      '--border': 'rgba(255,0,170,0.15)',
      '--border-strong': 'rgba(255,0,170,0.45)',
      '--text': '#fbeaff',
      '--text-muted': '#a78bba',
      '--text-soft': 'rgba(251,234,255,0.4)',
      '--accent': '#ff2db8',
      '--accent-2': '#22d3ee',
      '--accent-soft': 'rgba(255,45,184,0.16)',
      '--accent-glow': 'rgba(255,45,184,0.55)',
      '--gold': '#22d3ee',
      '--display': "'Space Grotesk', sans-serif",
      '--bg-pattern': 'none',
    }
  },
];

function applyTheme(id, x, y) {
  const theme = DASH_THEMES.find(t => t.id === id);
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // Neutraliser l'ancien système de thèmes (body.dark, body.crimson, etc.)
  document.body.classList.remove('dark', 'crimson', 'midnight', 'ivory');
  document.body.classList.toggle('brutaliste', !!theme.brutaliste);
  document.body.classList.toggle('glass-theme', !!theme.glass);
  document.body.dataset.mode = theme.mode;
  localStorage.setItem('kineplus.theme', id);
  if (typeof initParticles === 'function') initParticles(theme.particle);
  if (typeof themeFlash === 'function' && x != null) themeFlash(x, y);
  // update theme pill gradient
  const pill = document.getElementById('theme-pill');
  if (pill) pill.style.background = `linear-gradient(135deg, ${theme.vars['--accent']}, ${theme.vars['--accent-2']})`;
  // update active tile
  document.querySelectorAll('.theme-tile').forEach(tile => {
    tile.classList.toggle('active', tile.dataset.theme === id);
  });
}

function getSavedTheme() {
  return localStorage.getItem('kineplus.theme') || 'rose-noir';
}

// Apply before first paint (called inline in <head>)
(function() {
  const saved = localStorage.getItem('kineplus.theme') || 'rose-noir';
  const theme = DASH_THEMES.find(t => t.id === saved);
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.body && (document.body.dataset.mode = theme.mode);
  if (theme.brutaliste) document.body && document.body.classList.add('brutaliste');
  if (theme.glass) document.body && document.body.classList.add('glass-theme');
})();
