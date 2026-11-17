/* =========================================================
   kc-shortcuts.js — v71 (17 nov. 2026)
   1. Raccourcis de l'accueil (cadre « modes ») : on choisit 0 à 8 tuiles parmi les modes de jeu, outils et pages.
      Stockage : kp_layout2.modes = [id] (même clé que kc-layout.js → suit la mise en page dans le compte).
      kcShortcutsPick() : fenêtre de choix (ajouter, enlever, glisser ou flèches pour l'ordre).
      Ouverte par : bouton ⚙ au survol du cadre, mode édition de l'accueil (bouton « tune »), panneau Mise en page, Paramètres.
   2. Raccourcis clavier personnalisés (Paramètres > Raccourcis clavier, #kp-keys-body).
      Stockage : kp_keys = {action: touche} (seulement les changements ; '' = aucune touche).
      Écouteur en capture sur window : passe avant ceux de content.js / quiz-cobalt.js ; une touche d'origine
      réattribuée ailleurs ne fait plus son ancienne action. Restent toujours valables : 1–5, Entrée, →.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fn=(name,...a)=>{const f=window[name];if(typeof f==='function')return f.apply(window,a);console.warn('[raccourcis] fonction absente :',name);};
const g=name=>{try{return eval(name);}catch(e){return undefined;}};/* variables globales déclarées avec let (questions, concepts…) */
const nf=n=>Number(n||0).toLocaleString('fr-FR');
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};

/* ───────── 1. Raccourcis de l'accueil ───────── */
const MAX=8,DEF=['flash','annales','survie','fc'];
const CAT=[
  /* Modes de jeu */
  {id:'flash',grp:'Modes de jeu',n:'Flash rapide',ic:'bolt',f:1,t:'amber',d:'10 questions au hasard · 5 min',go:()=>fn('startFlash'),tag:'Conseillé'},
  {id:'annales',grp:'Modes de jeu',n:'Annales',ic:'history_edu',t:'sky',d:'Examens réels · note sur 20',go:()=>fn('showScreen','annales-hub')},
  {id:'survie',grp:'Modes de jeu',n:'Survie',ic:'favorite',f:1,t:'rose',d:()=>{const b=g('bestSurvivalStreak')|0;return b?`3 vies · ton record : ${b}`:'3 vies · bats ton record';},go:()=>fn('startSurvival')},
  {id:'fc',grp:'Modes de jeu',n:'Flashcards',ic:'style',t:'green',d:()=>{const due=typeof getDueCount==='function'?getDueCount():0;let tot=0;try{tot=(g('flashcards')||[]).length+(g('concepts')||[]).length;}catch(e){}return due?`${due} carte${due>1?'s':''} à revoir aujourd’hui`:tot?`${nf(tot)} cartes · rien à revoir aujourd’hui`:'Crée tes premières cartes';},go:()=>fn('khFlashcards')},
  {id:'all',grp:'Modes de jeu',n:'Tout mélangé',ic:'shuffle',t:'violet',d:'Toutes tes questions, dans le désordre',go:()=>fn('startAll')},
  {id:'hard',grp:'Modes de jeu',n:'Questions dures',ic:'whatshot',t:'orange',d:'Tes points faibles',go:()=>fn('startHard')},
  {id:'cible',grp:'Modes de jeu',n:'Révision ciblée',ic:'my_location',t:'rose',d:'Difficiles et moyennes à revoir',go:()=>fn('startCiblé')},
  {id:'smart',grp:'Modes de jeu',n:'Révision intelligente',ic:'psychology',t:'green',d:'L’IA part de tes points faibles',go:()=>fn('startSmartReview')},
  {id:'modes',grp:'Modes de jeu',n:'Tous les modes',ic:'quiz',t:'sky',d:'Quiz & modes de jeu',go:()=>fn('showScreen','modes-hub')},
  /* Outils */
  {id:'mindmap',grp:'Outils',n:'Cartes mentales',ic:'account_tree',t:'violet',d:'Tes cartes et tableaux blancs',go:()=>fn('showScreen','mindmap')},
  {id:'ultra',grp:'Outils',n:'Apprentissage Ultra',ic:'psychology_alt',t:'violet',d:'Un cours expliqué par l’IA',go:()=>fn('showScreen','ultra')},
  {id:'atelier',grp:'Outils',n:'Atelier IA',ic:'auto_fix_high',t:'amber',d:'ChatGPT, Gemini, Claude en copier-coller',go:()=>fn('showScreen','atelier')},
  {id:'pdfqcm',grp:'Outils',n:'PDF → QCM',ic:'picture_as_pdf',t:'orange',d:'Crée des QCM depuis un PDF',go:()=>window.open('pdf-qcm.html','_blank')},
  {id:'outils',grp:'Outils',n:'Tous les outils',ic:'handyman',t:'sky',d:'Imagerie, Studio, enregistrements…',go:()=>fn('showScreen','outils')},
  /* Pages */
  {id:'matieres',grp:'Pages',n:'Mes matières',ic:'folder_open',t:'sky',d:'Tes cours rangés par matière',go:()=>fn('showScreen','matieres-hub')},
  {id:'agenda',grp:'Pages',n:'Agenda',ic:'calendar_month',t:'amber',d:'Tes révisions et examens',go:()=>fn('showScreen','agenda')},
  {id:'partiels',grp:'Pages',n:'Mes partiels',ic:'school',t:'rose',d:'Compte à rebours des examens',go:()=>fn('showScreen','partiels')},
  {id:'stats',grp:'Pages',n:'Statistiques',ic:'monitoring',t:'green',d:'Ta maîtrise et ton activité',go:()=>fn('showScreen','stats')},
  {id:'social',grp:'Pages',n:'Amis & classement',ic:'group',t:'green',d:'Défie tes amis',go:()=>fn('showScreen','social')},
  {id:'city',grp:'Pages',n:'Ma ville',ic:'location_city',t:'sky',d:'Construis avec tes points',go:()=>fn('showScreen','city')},
  {id:'house',grp:'Pages',n:'Ma maison',ic:'cottage',t:'orange',d:'Décore ta maison',go:()=>fn('showScreen','house')}
];
const byId=id=>CAT.find(c=>c.id===id);
const L=()=>{try{const o=JSON.parse(localStorage.getItem('kp_layout2')||'{}');return o&&typeof o==='object'?o:{};}catch(e){return {};}};
function cfg(){const m=L().modes;return Array.isArray(m)?m.filter(id=>byId(id)).slice(0,MAX):DEF.slice();}
function setCfg(list){
  const o=L();o.modes=list.slice(0,MAX);
  try{localStorage.setItem('kp_layout2',JSON.stringify(o));localStorage.setItem('kp_layout2_at',String(Date.now()));}catch(e){}
  try{if(window.kcLayoutPush)window.kcLayoutPush();}catch(e){}
  render();
}
function tile(c,i){
  const d=typeof c.d==='function'?c.d():c.d;
  return `<a class="kh-mode t-${c.t}" data-ksc="${c.id}" role="button" tabindex="0">
      <div class="kh-mode-top"><div class="kh-sq"><span class="ms${c.f?' f':''}">${c.ic}</span></div>${c.tag&&i===0?`<span class="kh-tag">${c.tag}</span>`:''}</div>
      <div><div class="kh-mode-title">${esc(c.n)}</div><div class="kh-mode-desc"${c.id==='survie'?' id="kh-surv-desc"':c.id==='fc'?' id="kh-fc-desc"':''}>${esc(d)}</div></div>
    </a>`;
}
function render(){
  const box=document.querySelector('#kh-grid .kh-modes, .kh-blk-modes .kh-modes');if(!box)return;
  const list=cfg();
  box.dataset.n=list.length;
  box.innerHTML=list.length?list.map((id,i)=>tile(byId(id),i)).join('')
    :`<button type="button" class="kh-mode kh-mode-add" data-ksc-add><span class="ms">add</span><span>Ajouter des raccourcis</span></button>`;
  const blk=box.closest('.kh-blk-modes');
  if(blk&&!blk.querySelector(':scope>.kh-modes-edit')){
    const b=document.createElement('button');b.type='button';b.className='kh-modes-edit';b.title='Choisir mes raccourcis';b.setAttribute('aria-label','Choisir mes raccourcis');
    b.innerHTML='<span class="ms">tune</span>';b.onclick=e=>{e.stopPropagation();pick();};blk.appendChild(b);
  }
}
document.addEventListener('click',e=>{
  const a=e.target.closest('.kh-modes [data-ksc]');
  if(a){if(document.body.classList.contains('kh-editing'))return;e.preventDefault();const c=byId(a.dataset.ksc);if(c)try{c.go();}catch(err){console.warn(err);}return;}
  if(e.target.closest('.kh-modes [data-ksc-add]')){e.preventDefault();pick();}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('.kh-modes [data-ksc]')){e.preventDefault();e.target.click();}});

/* Fenêtre de choix */
function pickBody(){
  const list=cfg(),full=list.length>=MAX;
  const grps=[...new Set(CAT.map(c=>c.grp))];
  return `<div class="ksc-h"><b>Sur l’accueil</b><small>${list.length} / ${MAX}</small></div>
    <div class="ksc-sel" data-ksc-sel>${list.length?list.map((id,i)=>{const c=byId(id);return `<div class="ksc-chip t-${c.t}" draggable="true" data-id="${id}">
        <span class="ms ksc-grip">drag_indicator</span><span class="ksc-ic"><span class="ms${c.f?' f':''}">${c.ic}</span></span><b>${esc(c.n)}</b>
        <span class="ksc-mv"><button type="button" data-k="left" ${i?'':'disabled'} title="Plus tôt" aria-label="Déplacer avant"><span class="ms">chevron_left</span></button><button type="button" data-k="right" ${i<list.length-1?'':'disabled'} title="Plus tard" aria-label="Déplacer après"><span class="ms">chevron_right</span></button></span>
        <button type="button" class="ksc-x" data-k="rm" title="Enlever" aria-label="Enlever ${esc(c.n)}"><span class="ms">close</span></button></div>`;}).join('')
      :'<p class="ksc-empty">Aucun raccourci : le cadre affichera seulement un bouton « Ajouter ». Pour enlever tout le cadre, utilise l’œil en mode édition de l’accueil.</p>'}</div>
    ${grps.map(gr=>`<div class="ksc-h ksc-h2"><b>${gr}</b></div><div class="ksc-grid">${CAT.filter(c=>c.grp===gr).map(c=>{const on=list.includes(c.id);return `<button type="button" class="ksc-opt t-${c.t}${on?' on':''}" data-k="tog" data-id="${c.id}" ${!on&&full?'disabled':''}>
        <span class="ksc-ic"><span class="ms${c.f?' f':''}">${c.ic}</span></span><span class="ksc-t"><b>${esc(c.n)}</b><small>${esc(typeof c.d==='function'?c.d():c.d)}</small></span><span class="ms ksc-ck">${on?'check_circle':'add_circle'}</span></button>`;}).join('')}</div>`).join('')}
    ${full?'<p class="ksc-full">8 raccourcis au maximum : enlèves-en un pour en ajouter un autre.</p>':''}`;
}
function pick(){
  if(typeof window.kcDlg!=='function')return;
  let dragId=null;
  window.kcDlg({title:'Mes raccourcis',sub:'Jusqu’à 8 sur la même ligne de l’accueil',icon:'bolt',
    body:`<div class="ksc" id="ksc-body">${pickBody()}</div>`,
    foot:'<button class="btn btn-g" data-ksc-reset type="button">Par défaut</button><button class="btn btn-p" data-x type="button">Terminé</button>',
    onOpen(bg){
      bg.classList.add('ksc-dlg');
      const redraw=()=>{const b=bg.querySelector('#ksc-body');if(b)b.innerHTML=pickBody();};
      bg.addEventListener('click',e=>{
        if(e.target.closest('[data-ksc-reset]')){setCfg(DEF.slice());redraw();return;}
        const b=e.target.closest('[data-k]');if(!b||b.disabled)return;
        const list=cfg(),k=b.dataset.k,id=b.dataset.id||(b.closest('[data-id]')||{}).dataset&&b.closest('[data-id]').dataset.id,i=list.indexOf(id);
        if(k==='tog'){if(i>-1)list.splice(i,1);else if(list.length<MAX)list.push(id);else return;}
        else if(k==='rm'&&i>-1)list.splice(i,1);
        else if(k==='left'&&i>0)[list[i-1],list[i]]=[list[i],list[i-1]];
        else if(k==='right'&&i>-1&&i<list.length-1)[list[i+1],list[i]]=[list[i],list[i+1]];
        else return;
        setCfg(list);redraw();
      });
      /* glisser-déposer (ordinateur) */
      bg.addEventListener('dragstart',e=>{const c=e.target.closest('.ksc-chip');if(!c)return;dragId=c.dataset.id;c.classList.add('drag');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);}catch(err){}});
      bg.addEventListener('dragover',e=>{const c=e.target.closest('.ksc-chip');if(!c||!dragId)return;e.preventDefault();});
      bg.addEventListener('drop',e=>{
        const c=e.target.closest('.ksc-chip');if(!c||!dragId||c.dataset.id===dragId)return;e.preventDefault();
        const list=cfg(),from=list.indexOf(dragId);if(from<0)return;list.splice(from,1);
        const r=c.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;let to=list.indexOf(c.dataset.id);if(after)to++;
        list.splice(to,0,dragId);dragId=null;setCfg(list);redraw();
      });
      bg.addEventListener('dragend',()=>{dragId=null;bg.querySelectorAll('.ksc-chip.drag').forEach(x=>x.classList.remove('drag'));});
    }});
}
window.kcShortcutsPick=pick;
window.kcShortcutsRender=render;

/* ───────── 2. Raccourcis clavier ───────── */
const KEYS='kp_keys';
const ACT=[
  {id:'ans0',grp:'Pendant un quiz',n:'Réponse A',def:'q',quiz:1},
  {id:'ans1',grp:'Pendant un quiz',n:'Réponse B',def:'s',quiz:1},
  {id:'ans2',grp:'Pendant un quiz',n:'Réponse C',def:'d',quiz:1},
  {id:'ans3',grp:'Pendant un quiz',n:'Réponse D',def:'f',quiz:1},
  {id:'ans4',grp:'Pendant un quiz',n:'Réponse E',def:'g',quiz:1},
  {id:'next',grp:'Pendant un quiz',n:'Question suivante',def:'Space',quiz:1},
  {id:'prev',grp:'Pendant un quiz',n:'Question précédente',def:'ArrowLeft',quiz:1},
  {id:'fav',grp:'Pendant un quiz',n:'Mettre en favori',def:'',quiz:1},
  {id:'boy',grp:'Pendant un quiz',n:'Boycotter la question',def:'',quiz:1},
  {id:'zin',grp:'Pendant un quiz',n:'Agrandir le texte',def:'+',quiz:1},
  {id:'zout',grp:'Pendant un quiz',n:'Réduire le texte',def:'-',quiz:1},
  {id:'search',grp:'Partout',n:'Rechercher',def:'/'},
  {id:'g_home',grp:'Partout',n:'Aller à l’accueil',def:''},
  {id:'g_flash',grp:'Partout',n:'Lancer un Flash rapide',def:''},
  {id:'g_modes',grp:'Partout',n:'Quiz & modes',def:''},
  {id:'g_fc',grp:'Partout',n:'Flashcards',def:''},
  {id:'g_mat',grp:'Partout',n:'Mes matières',def:''},
  {id:'g_annales',grp:'Partout',n:'Annales',def:''},
  {id:'g_mindmap',grp:'Partout',n:'Cartes mentales',def:''},
  {id:'g_agenda',grp:'Partout',n:'Agenda',def:''},
  {id:'g_city',grp:'Partout',n:'Ma ville',def:''},
  {id:'g_set',grp:'Partout',n:'Paramètres',def:''}
];
/* touches natives de content.js qui doivent être « coupées » si on les a réattribuées */
const NATIVE_ALIAS={'+':['+','='],'Space':['Space']};
const RUN={
  ans0:()=>ans(0),ans1:()=>ans(1),ans2:()=>ans(2),ans3:()=>ans(3),ans4:()=>ans(4),
  next:()=>{const b=$('kq-next');if(b&&!b.disabled){fn('nextQ');return;}const nr=$('qnrow'),nb=$('qnbtn');if(nr&&nr.style.display!=='none'&&nb)nb.click();},
  prev:()=>fn('prevQ'),fav:()=>fn('khQuizFav'),boy:()=>fn('doBoycott'),
  zin:()=>fn('changeQuizZoom',0.1),zout:()=>fn('changeQuizZoom',-0.1),
  search:()=>{const ov=$('search-overlay');if(ov&&ov.classList.contains('open'))return;fn('openSearch');},
  g_home:()=>fn('switchTab','home'),g_flash:()=>fn('startFlash'),g_modes:()=>fn('showScreen','modes-hub'),g_fc:()=>fn('openAllFlashcards'),
  g_mat:()=>fn('showScreen','matieres-hub'),g_annales:()=>fn('showScreen','annales-hub'),g_mindmap:()=>fn('showScreen','mindmap'),
  g_agenda:()=>fn('showScreen','agenda'),g_city:()=>fn('showScreen','city'),g_set:()=>fn('showScreen','manage')
};
function ans(n){const o=[...document.querySelectorAll('#qopts .ob:not(:disabled)')][n];if(o){o.focus();o.click();}}
const custom=()=>{try{const o=JSON.parse(localStorage.getItem(KEYS)||'{}');return o&&typeof o==='object'?o:{};}catch(e){return {};}};
const keyOf=a=>{const c=custom();return Object.prototype.hasOwnProperty.call(c,a.id)?c[a.id]:a.def;};
function combo(e){
  let k=e.key;if(!k||k==='Unidentified'||k==='Dead')return '';
  if(['Control','Shift','Alt','Meta','AltGraph','CapsLock'].includes(k))return '';
  if(k===' ')k='Space';
  /* Alt (⌥ sur Mac) change la lettre (⌥K = « ˚ ») : on prend la touche physique */
  if(e.altKey&&/^(Key[A-Z]|Digit\d)$/.test(e.code||''))k=e.code.slice(e.code[0]==='K'?3:5);
  const single=k.length===1;if(single)k=k.toLowerCase();
  const mods=[];if(e.ctrlKey||e.metaKey)mods.push('Ctrl');if(e.altKey)mods.push('Alt');if(e.shiftKey&&!single)mods.push('Shift');
  return mods.concat(k).join('+');
}
const NAMES={Space:'Espace',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Enter:'Entrée',Escape:'Échap',Backspace:'Retour',Tab:'Tab',Delete:'Suppr',Ctrl:navigator.platform&&/Mac/.test(navigator.platform)?'⌘':'Ctrl',Alt:navigator.platform&&/Mac/.test(navigator.platform)?'⌥':'Alt',Shift:'Maj','-':'−'};
/* « Ctrl+Alt+k », « + », « Ctrl++ » → morceaux (le « + » peut aussi être la touche elle-même) */
function parts(k){const out=[];let r=String(k||'');let m;while((m=r.match(/^(Ctrl|Alt|Shift)\+(?=.)/))){out.push(m[1]);r=r.slice(m[0].length);}if(r)out.push(r);return out;}
const pretty=k=>k?parts(k).map(p=>NAMES[p]||(p.length===1?p.toUpperCase():p)):[];
const kbd=(k,cls)=>k?pretty(k).map(p=>`<span class="${cls}">${esc(p)}</span>`).join(''):'';
const inField=t=>t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);
let REC=null;/* action en cours d'enregistrement dans Paramètres */
window.addEventListener('keydown',e=>{
  if(REC){recKey(e);return;}
  if(inField(e.target)||$('kc-dlg')||document.querySelector('.mdbg.open'))return;
  const scr=document.body.dataset.screen,inQuiz=scr==='quiz'&&!!g('session');
  if(['mindmap-editor','city','diagram-editor'].includes(scr))return;/* ces écrans ont leurs propres raccourcis */
  const ov=$('search-overlay');if(ov&&ov.classList.contains('open'))return;
  const c=combo(e);if(!c)return;
  const hit=ACT.find(a=>(!a.quiz||inQuiz)&&keyOf(a)===c);
  if(hit){e.preventDefault();e.stopImmediatePropagation();try{RUN[hit.id]();}catch(err){console.warn(err);}return;}
  /* touche d'origine qui ne sert plus (réattribuée) : on l'empêche de faire son ancienne action */
  const cu=custom();
  const stale=ACT.find(a=>(!a.quiz||inQuiz)&&a.def&&Object.prototype.hasOwnProperty.call(cu,a.id)&&cu[a.id]!==a.def&&(NATIVE_ALIAS[a.def]||[a.def]).includes(c==='='?'=':c));
  if(stale&&!(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();}
},true);

function recKey(e){
  e.preventDefault();e.stopImmediatePropagation();
  const id=REC;
  if(e.key==='Escape'){REC=null;drawKeys();return;}
  if(e.key==='Backspace'||e.key==='Delete'){setKey(id,'');REC=null;drawKeys();return;}
  const c=combo(e);if(!c)return;/* touche de modification seule : on attend la suite */
  if(/^[1-5]$/.test(c)||c==='Enter'||c==='ArrowRight'){notify('Cette touche est déjà réservée (1–5, Entrée et → servent toujours au quiz)','err');return;}
  const other=ACT.find(x=>x.id!==id&&keyOf(x)===c);
  if(other){setKey(other.id,'');notify(`« ${pretty(c).join(' + ')} » est retirée de « ${other.n} »`,'ok');}
  setKey(id,c);REC=null;drawKeys();
}
function setKey(id,k){
  const a=ACT.find(x=>x.id===id);if(!a)return;
  const c=custom();if(k===a.def)delete c[id];else c[id]=k;
  try{if(Object.keys(c).length)localStorage.setItem(KEYS,JSON.stringify(c));else localStorage.removeItem(KEYS);}catch(e){}
  railKeys();
}
function drawKeys(){
  const box=$('kp-keys-body');if(!box)return;
  const grps=[...new Set(ACT.map(a=>a.grp))],cu=custom();
  box.innerHTML=grps.map(gr=>`<div class="kpk-grp"><div class="kpk-h">${gr}</div>${ACT.filter(a=>a.grp===gr).map(a=>{const k=keyOf(a),rec=REC===a.id,chg=Object.prototype.hasOwnProperty.call(cu,a.id);
      return `<div class="kpk-row${rec?' rec':''}"><span class="kpk-n">${esc(a.n)}</span>
        <button type="button" class="kpk-key${k?'':' none'}" data-kk="${a.id}" title="Clique puis appuie sur la touche voulue">${rec?'<span class="kpk-wait">Appuie sur une touche…</span>':k?kbd(k,'kq-kbd'):'Aucune'}</button>
        ${chg?`<button type="button" class="kpk-undo" data-kr="${a.id}" title="Touche d’origine${a.def?' : '+esc(pretty(a.def).join(' + ')):' : aucune'}"><span class="ms">undo</span></button>`:'<span class="kpk-undo-ph"></span>'}</div>`;}).join('')}</div>`).join('')
    +`<p class="kpk-hint">Clique sur une touche puis appuie sur la nouvelle (tu peux ajouter Ctrl, Alt ou Maj). <b>Retour</b> = aucune touche, <b>Échap</b> = annuler. Les touches 1–5, Entrée et → marchent toujours pendant un quiz.</p>
      <button type="button" class="btn btn-g btn-sm" data-kall><span class="ms" style="font-size:16px;vertical-align:-3px">restart_alt</span> Remettre toutes les touches d’origine</button>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#kp-keys-body [data-kk]');
  if(b){REC=REC===b.dataset.kk?null:b.dataset.kk;drawKeys();return;}
  const r=e.target.closest('#kp-keys-body [data-kr]');
  if(r){const a=ACT.find(x=>x.id===r.dataset.kr);REC=null;if(a)setKey(a.id,a.def);drawKeys();return;}
  if(e.target.closest('#kp-keys-body [data-kall]')){try{localStorage.removeItem(KEYS);}catch(err){}REC=null;drawKeys();railKeys();notify('Touches d’origine remises','ok');return;}
  if(REC&&!e.target.closest('#kp-keys-body')){REC=null;drawKeys();}
});
/* colonne « Raccourcis » du quiz : montre les vraies touches */
function railKeys(){
  const box=document.querySelector('#screen-quiz .kq-keys');if(!box)return;
  const k=id=>keyOf(ACT.find(a=>a.id===id)),K=id=>kbd(k(id),'kq-kbd');
  const ansK=['ans0','ans1','ans2','ans3'].map(K).join('');
  const row=(l,v)=>v?`<div><span>${l}</span><span>${v}</span></div>`:'';
  box.innerHTML=row('Répondre',`<span class="kq-kbd">1</span>–<span class="kq-kbd">5</span>${ansK?' ou '+ansK:''}`)
    +row('Suivante',`<span class="kq-kbd">Entrée</span> ${K('next')}`)
    +row('Précédente',K('prev'))
    +row('Taille du texte',(K('zout')+' '+K('zin')).trim())
    +row('Favori',K('fav'))+row('Boycotter',K('boy'));
}
window.kcKeysDraw=drawKeys;

/* ───────── Démarrage ───────── */
function start(){
  render();drawKeys();railKeys();
  const orig=window.showScreen;
  if(typeof orig==='function'&&!orig._ksc){
    const w=function(id){const r=orig.apply(this,arguments);try{if(id==='home')render();if(id==='manage')drawKeys();}catch(e){}return r;};
    w._ksc=true;Object.keys(orig).forEach(k=>{try{w[k]=orig[k];}catch(e){}});window.showScreen=w;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
