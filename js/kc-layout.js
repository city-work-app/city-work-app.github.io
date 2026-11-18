/* =========================================================
   kc-layout.js — Personnalisation de la mise en page (v66, 16 nov. 2026)
   Panneau à droite (kcLayoutOpen('home'|'nav'|'bar')), les changements s'appliquent en direct.
   - Accueil : ordre des cadres (glisser), taille Petit / Large / Toute la largeur, cacher.
       → #kh-grid .kh-blk[data-blk] (order + data-size + hidden)
   - Menu de gauche : côté gauche / droite (body.kc-nav-right), catégories renommables, ajout / suppression,
       rubriques déplaçables d'une catégorie à l'autre, rubriques cachées.  → .dl-nav reconstruit
   - Barre du bas (téléphone) : ordre des 5 boutons.
   Stockage : kp_layout2 = {home:[{id,size,hide,w,h}], homeGap, homeMax, nav:{side, groups:[{label,items:[data-nav]}], hidden:[]}, bar:[id], top:{items:[id], off:[id]}}
   v69 (16 nov. 2026) :
   - cadres de l'accueil redimensionnables à la souris en mode édition (bord droit = largeur sur 12 colonnes → w,
     bord bas = hauteur mini en px → h, coin = les deux ; double-clic sur un bord = taille automatique) ;
     espace entre les cadres (homeGap) et largeur de la page (homeMax) réglables (bouton « Espaces »).
   - barre du haut personnalisable (comme la barre des menus d'un Mac) : boutons d'origine [data-tb], raccourcis vers
     les rubriques du menu (n:<data-nav>), actions (a:…), infos en direct (w:streak, w:goal, w:clock, w:date, w:wx).
     En mode édition : pastille « − » pour enlever, glisser pour changer l'ordre, bouton « + » pour ajouter.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* v69 : la clé « kp_layout » était aussi écrite par ui.js (applyLayout('a') à chaque démarrage) → la mise en page
   personnalisée était effacée à chaque rechargement. Nouvelle clé kp_layout2 (l'ancienne est reprise si elle est lisible). */
const KEY='kp_layout2',OLD_KEY='kp_layout';
const load=()=>{
  try{const v=localStorage.getItem(KEY);if(v){const o=JSON.parse(v);if(o&&typeof o==='object')return o;}}catch(e){}
  try{const o=JSON.parse(localStorage.getItem(OLD_KEY)||'{}');return o&&typeof o==='object'?o:{};}catch(e){return {};}
};
/* v70 : chaque changement est daté (kp_layout2_at) et envoyé dans le compte (kc-polish.js → kcLayoutPush), pour retrouver la même mise en page sur tous les appareils */
const save=o=>{try{localStorage.setItem(KEY,JSON.stringify(o));localStorage.setItem(KEY+'_at',String(Date.now()));}catch(e){}try{if(window.kcLayoutPush)window.kcLayoutPush();}catch(e){}};

/* ───────── Accueil ───────── */
const BLOCKS=[
  {id:'goal',n:'Objectif du jour',ic:'flag',size:'L'},
  {id:'progress',n:'Progression & série',ic:'trending_up',size:'S'},
  {id:'modes',n:'Raccourcis',ic:'bolt',size:'F'},
  {id:'activity',n:'Activité',ic:'bar_chart',size:'L'},
  {id:'weak',n:'À renforcer',ic:'my_location',size:'S'},
  {id:'agenda',n:'Prochaines révisions',ic:'event_upcoming',size:'L'},
  {id:'city',n:'Ma ville',ic:'location_city',size:'S'},
  {id:'quote',n:'Citation',ic:'format_quote',size:'F'}
];
const SIZES=[['S','Petit'],['L','Large'],['F','Toute la largeur']];
function homeCfg(){
  const saved=(load().home||[]).filter(x=>BLOCKS.some(b=>b.id===x.id));
  const out=saved.map(x=>{
    const o={id:x.id,size:['S','L','F'].includes(x.size)?x.size:BLOCKS.find(b=>b.id===x.id).size,hide:!!x.hide};
    const w=Math.round(+x.w),h=Math.round(+x.h);
    if(w>=3&&w<=12)o.w=w;          /* largeur libre : nombre de colonnes sur 12 */
    if(h>=60&&h<=2400)o.h=h;       /* hauteur mini libre, en px */
    return o;});
  BLOCKS.forEach(b=>{if(!out.some(x=>x.id===b.id))out.push({id:b.id,size:b.size,hide:false});});
  return out;
}
function applyHome(){
  const g=$('kh-grid');if(!g)return;
  homeCfg().forEach((c,i)=>{
    const el=g.querySelector(`.kh-blk[data-blk="${c.id}"]`);if(!el)return;
    el.style.order=i;el.dataset.size=c.size;
    if(c.w){el.dataset.w=c.w;el.style.setProperty('--kh-w',c.w);}else{delete el.dataset.w;el.style.removeProperty('--kh-w');}
    if(c.h){el.dataset.h=c.h;el.style.setProperty('--kh-h',c.h+'px');}else{delete el.dataset.h;el.style.removeProperty('--kh-h');}
    if(c.hide)el.setAttribute('hidden','');else el.removeAttribute('hidden');
  });
  const o=load(),gap=+o.homeGap,max=+o.homeMax,kh=g.closest('.kh');
  g.style.gap=gap>=4&&gap<=60?gap+'px':'';
  if(kh)kh.style.maxWidth=max>=800?(max>=MAXW?'none':max+'px'):'';
}
const MAXW=2000;/* curseur « largeur de la page » au maximum = toute la largeur de l'écran */

/* ───────── Menu de gauche ───────── */
let NAV0=null;/* état d'origine lu dans la page */
function readNav(){
  if(NAV0)return NAV0;
  const nav=document.querySelector('#desktop-left .dl-nav');if(!nav)return null;
  const items={},groups=[];let cur=null;
  [...nav.children].forEach(el=>{
    if(el.classList.contains('kh-nav-label')){cur={label:el.textContent.trim(),items:[]};groups.push(cur);}
    else if(el.matches('a[data-nav]')){
      const k=el.dataset.nav,ic=(el.querySelector('.ms')||{}).textContent||'circle';
      const txt=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
      items[k]={el,ic,n:txt||k};
      if(!cur){cur={label:'',items:[]};groups.push(cur);}
      cur.items.push(k);
    }
  });
  NAV0={items,groups};
  return NAV0;
}
function navCfg(){
  const n0=readNav();if(!n0)return null;
  const s=load().nav||{};
  const known=new Set(Object.keys(n0.items));
  let groups=Array.isArray(s.groups)&&s.groups.length?s.groups.map(g=>({label:String(g.label||''),items:(g.items||[]).filter(k=>known.has(k))})):n0.groups.map(g=>({label:g.label,items:g.items.slice()}));
  const seen=new Set();groups.forEach(g=>{g.items=g.items.filter(k=>!seen.has(k)&&seen.add(k));});
  const miss=[...known].filter(k=>!seen.has(k));
  if(miss.length){if(!groups.length)groups.push({label:'',items:[]});groups[groups.length-1].items.push(...miss);}
  return {side:s.side==='right'?'right':'left',groups,hidden:(s.hidden||[]).filter(k=>known.has(k))};
}
function applyNav(){
  const n0=readNav(),c=navCfg();if(!n0||!c)return;
  const nav=document.querySelector('#desktop-left .dl-nav');
  document.body.classList.toggle('kc-nav-right',c.side==='right');
  nav.querySelectorAll('.kh-nav-label').forEach(l=>l.remove());
  const search=nav.querySelector('.kh-search'),div=nav.querySelector('.dl-divider');
  const frag=document.createDocumentFragment();
  if(search)frag.appendChild(search);
  c.groups.forEach(g=>{
    const vis=g.items.filter(k=>!c.hidden.includes(k));
    if(!vis.length&&!g.items.length)return;
    if(g.label){const l=document.createElement('div');l.className='kh-nav-label';l.textContent=g.label;frag.appendChild(l);}
    g.items.forEach(k=>{const it=n0.items[k];if(!it)return;it.el.hidden=c.hidden.includes(k);frag.appendChild(it.el);});
  });
  if(div)frag.appendChild(div);
  nav.appendChild(frag);
}

/* ───────── Barre du bas (téléphone) ───────── */
function barItems(){return [...document.querySelectorAll('.bnav > .ni')].map(b=>({id:b.id,ic:(b.querySelector('.ms')||{}).textContent||'',n:[...b.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()}));}
function barCfg(){const all=barItems().map(b=>b.id),s=(load().bar||[]).filter(id=>all.includes(id));all.forEach(id=>{if(!s.includes(id))s.push(id);});return s;}
function applyBar(){barCfg().forEach((id,i)=>{const b=$(id);if(b)b.style.order=i;});}

/* ───────── Barre du haut (v69) ───────── */
const TB=[
  {id:'level',n:'Niveau et XP',ic:'military_tech'},
  {id:'pomo',n:'Pomodoro',ic:'timer'},
  {id:'theme',n:'Thème clair / sombre',ic:'light_mode'},
  {id:'search',n:'Recherche',ic:'search'},
  {id:'profil',n:'Mon profil',ic:'person'},
  {id:'stats',n:'Statistiques',ic:'bar_chart'},
  {id:'manage',n:'Paramètres',ic:'settings'},
  {id:'collapse',n:'Masquer le menu',ic:'left_panel_close'}
];
const TB_ACT=[
  {id:'a:full',n:'Plein écran',ic:'fullscreen'},
  {id:'a:edit',n:'Personnaliser la page',ic:'dashboard_customize'}
];
const TB_WID=[
  {id:'w:streak',n:'Série (jours d’affilée)',ic:'local_fire_department'},
  {id:'w:goal',n:'Objectif du jour',ic:'flag'},
  {id:'w:clock',n:'Heure',ic:'schedule'},
  {id:'w:date',n:'Date',ic:'calendar_today'},
  {id:'w:wx',n:'Météo',ic:'partly_cloudy_day'}
];
const TB_MAX=14;
const tbFr=()=>document.querySelector('.topbar .fr');
function tbCat(){
  const m={};
  TB.forEach(b=>{m[b.id]=Object.assign({kind:'base'},b);});
  const n0=readNav();
  if(n0)Object.keys(n0.items).forEach(k=>{m['n:'+k]={id:'n:'+k,n:n0.items[k].n,ic:n0.items[k].ic,kind:'nav'};});
  TB_ACT.forEach(a=>{m[a.id]=Object.assign({kind:'act'},a);});
  TB_WID.forEach(w=>{m[w.id]=Object.assign({kind:'wid'},w);});
  return m;
}
function topCfg(){
  const cat=tbCat(),s=load().top||{};
  const items=(Array.isArray(s.items)?s.items:[]).filter((id,i,a)=>cat[id]&&a.indexOf(id)===i);
  const off=(Array.isArray(s.off)?s.off:[]).filter(id=>TB.some(b=>b.id===id)&&!items.includes(id));
  TB.forEach(b=>{if(!items.includes(b.id)&&!off.includes(b.id))items.push(b.id);});
  return {items,off};
}
function tbEl(id){const fr=tbFr();return fr?[...fr.querySelectorAll('[data-tb]')].find(x=>x.dataset.tb===id)||null:null;}
function tbMake(d){
  const b=document.createElement('button');b.type='button';b.dataset.tb=d.id;b.dataset.tooltip=d.n;b.setAttribute('aria-label',d.n);
  if(d.kind==='wid'){b.className='kc-tb-w';b.innerHTML=`<span class="ms">${esc(d.ic)}</span><b></b>`;}
  else{b.className='ib kc-tb-x';b.innerHTML=`<span class="ms">${esc(d.ic)}</span>`;}
  return b;
}
function applyTop(){
  const fr=tbFr();if(!fr)return;
  const c=topCfg(),cat=tbCat();
  fr.querySelectorAll('[data-tb]').forEach(el=>{const id=el.dataset.tb;if(!TB.some(b=>b.id===id)&&!c.items.includes(id))el.remove();});
  c.items.forEach((id,i)=>{
    let el=tbEl(id);
    if(!el){if(TB.some(b=>b.id===id))return;el=tbMake(cat[id]);fr.appendChild(el);}
    el.classList.remove('kc-tb-off');el.style.order=i+1;
  });
  c.off.forEach(id=>{const el=tbEl(id);if(el)el.classList.add('kc-tb-off');});
  /* le minuteur Pomodoro et le chrono du quiz restent à côté du bouton Pomodoro */
  const po=c.items.indexOf('pomo');
  ['topbar-timer','pomo-topbar-chip'].forEach(x=>{const el=$(x);if(el)el.style.order=po>=0?po+1:0;});
  tbWidgets();
}
const WX_IC=(code,day)=>code==null?'partly_cloudy_day':code>=95?'thunderstorm':((code>=71&&code<=77)||code===85||code===86)?'weather_snowy':((code>=51&&code<=67)||(code>=80&&code<=82))?'rainy':(code===45||code===48)?'foggy':code===3?'cloud':(code===1||code===2)?'partly_cloudy_day':day===0?'bedtime':'sunny';
function tbWidgets(){
  const fr=tbFr();if(!fr)return;
  fr.querySelectorAll('.kc-tb-w').forEach(el=>{
    const id=el.dataset.tb,b=el.querySelector('b'),ic=el.querySelector('.ms');let t='',i='';
    try{
      if(id==='w:streak'){const n=window.khStreaks?window.khStreaks().cur:0;t=n+' j';}
      else if(id==='w:goal'){let d=0,g=10;try{d=getTodayQ();}catch(e){}try{g=dailyGoal||10;}catch(e){}t=d+' / '+g;i=d>=g?'task_alt':'flag';el.classList.toggle('ok',d>=g);}
      else if(id==='w:clock'){t=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
      else if(id==='w:date'){t=new Date().toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');}
      else if(id==='w:wx'){const w=window.kcWxInfo?window.kcWxInfo():null,c=w&&w.loc&&w.cache&&w.cache.lat===w.loc.lat?w.cache:null;
        if(c&&c.t!=null){t=Math.round(c.t)+' °C';i=WX_IC(c.code,c.day);el.dataset.tooltip='Météo · '+(w.loc.name||'ma ville');}
        else{t=w&&w.loc?'…':'Météo';i='partly_cloudy_day';el.dataset.tooltip=w&&w.loc?'Météo':'Choisir ma ville';}}
    }catch(e){}
    if(b&&b.textContent!==t)b.textContent=t;
    if(i&&ic&&ic.textContent!==i)ic.textContent=i;
  });
}
function tbRun(id){
  if(id.startsWith('n:')){const n0=readNav(),it=n0&&n0.items[id.slice(2)];if(it)it.el.click();return;}
  if(id==='a:full'){
    const d=document,el=d.documentElement,on=d.fullscreenElement||d.webkitFullscreenElement;
    try{if(on)(d.exitFullscreen||d.webkitExitFullscreen).call(d);else{const p=(el.requestFullscreen||el.webkitRequestFullscreen).call(el);if(p&&p.catch)p.catch(()=>{});}}catch(e){if(typeof showNotif==='function')showNotif('Le navigateur a refusé le plein écran','err');}
    return;
  }
  if(id==='a:edit'){window.kcHomeEdit(true);return;}
  if(id==='w:streak'){if(typeof showScreen==='function')showScreen('stats');return;}
  if(id==='w:goal'){if(window.kcGoalDialog)window.kcGoalDialog();return;}
  if(id==='w:clock'||id==='w:date'){if(typeof showScreen==='function')showScreen('agenda');return;}
  if(id==='w:wx'){if(window.kcWeatherSetup)window.kcWeatherSetup();return;}
}
document.addEventListener('click',e=>{
  if(EDIT)return;
  const b=e.target.closest&&e.target.closest('.topbar .fr .kc-tb-x,.topbar .fr .kc-tb-w');
  if(b)tbRun(b.dataset.tb);
});
document.addEventListener('fullscreenchange',()=>{const el=tbEl('a:full'),ic=el&&el.querySelector('.ms');if(ic)ic.textContent=document.fullscreenElement?'fullscreen_exit':'fullscreen';});
setInterval(()=>{if(!document.hidden)tbWidgets();},20000);
function tbAdd(id){
  const c=topCfg(),cat=tbCat();if(!cat[id]||c.items.includes(id))return false;
  if(c.items.length>=TB_MAX){if(typeof showNotif==='function')showNotif('La barre est pleine : enlève d’abord un bouton','err');return false;}
  const last=c.items[c.items.length-1];
  if(last==='collapse')c.items.splice(c.items.length-1,0,id);else c.items.push(id);
  c.off=c.off.filter(x=>x!==id);
  const o=load();o.top=c;save(o);applyTop();
  if(id==='w:wx'&&window.kcWxInfo&&!window.kcWxInfo().loc&&window.kcWeatherSetup&&!EDIT)window.kcWeatherSetup();
  return true;
}
function tbRemove(id){
  const c=topCfg();if(!c.items.includes(id))return;
  c.items=c.items.filter(x=>x!==id);
  if(TB.some(b=>b.id===id))c.off.push(id);
  const o=load();o.top=c;save(o);applyTop();
}

function applyAll(){try{applyHome();}catch(e){console.warn('[layout] accueil',e);}try{applyNav();}catch(e){console.warn('[layout] menu',e);}try{applyBar();}catch(e){}try{applyTop();}catch(e){console.warn('[layout] barre du haut',e);}}
window.kcLayoutApply=applyAll;

/* ───────── Glisser pour réordonner (souris + doigt) ───────── */
function sortable(root,onDrop){
  let drag=null;
  const move=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    e.preventDefault();
    drag.item.style.top=(e.clientY-drag.dy)+'px';
    const el=document.elementFromPoint(e.clientX,e.clientY);if(!el)return;
    const over=el.closest('.kl-item'),list=el.closest('.kl-list');
    if(over&&root.contains(over)&&over.parentElement.dataset.list===drag.kind){const rr=over.getBoundingClientRect();if(e.clientY<rr.top+rr.height/2)over.before(drag.ph);else over.after(drag.ph);}
    else if(list&&root.contains(list)&&list.dataset.list===drag.kind&&!list.querySelector('.kl-item')){const em=list.querySelector('.kl-empty');if(em)em.remove();list.appendChild(drag.ph);}
  };
  const end=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const {item,ph}=drag;drag=null;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);
    item.classList.remove('kl-drag');item.style.cssText='';
    ph.replaceWith(item);
    onDrop();
  };
  root.addEventListener('pointerdown',e=>{
    const h=e.target.closest('.kl-grip');if(!h||!root.contains(h))return;
    const item=h.closest('.kl-item');if(!item)return;
    e.preventDefault();
    const r=item.getBoundingClientRect();
    const ph=document.createElement('div');ph.className='kl-ph';ph.style.height=r.height+'px';
    drag={item,dy:e.clientY-r.top,ph,id:e.pointerId,kind:item.parentElement.dataset.list};
    item.after(ph);
    item.classList.add('kl-drag');Object.assign(item.style,{width:r.width+'px',left:r.left+'px',top:r.top+'px'});
    document.body.appendChild(item);
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  });
}

/* ───────── Panneau ───────── */
let tab='home';
function panel(){
  let p=$('kl-panel');if(p)return p;
  p=document.createElement('aside');p.id='kl-panel';p.className='kl-panel';p.setAttribute('aria-label','Personnaliser la mise en page');
  p.innerHTML=`<header class="kl-h"><span class="kl-h-ic"><span class="ms">dashboard_customize</span></span><div><b>Mise en page</b><small>Les changements s’appliquent tout de suite</small></div><button class="kl-x" data-a="close" aria-label="Fermer"><span class="ms">close</span></button></header>
    <nav class="kl-tabs" role="tablist"><button data-t="home">Accueil</button><button data-t="nav">Menu</button><button data-t="top">Barre du haut</button><button data-t="bar">Barre du bas</button></nav>
    <div class="kl-body" id="kl-body"></div>
    <footer class="kl-f"><button class="btn btn-g" data-a="reset"><span class="ms">restart_alt</span>Réinitialiser</button><span style="flex:1"></span><button class="btn btn-p" data-a="close">Terminé</button></footer>`;
  document.body.appendChild(p);
  p.addEventListener('click',onClick);
  p.addEventListener('input',onInput);
  p.addEventListener('change',onInput);
  sortable(p,onSorted);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&p.classList.contains('open')&&!document.querySelector('.kc-dlg-bg'))close();});
  return p;
}
function open(t){
  tab=t||tab;const p=panel();
  if(tab==='home'&&document.body.dataset.screen!=='home'&&typeof showScreen==='function')showScreen('home');
  draw();requestAnimationFrame(()=>p.classList.add('open'));document.body.classList.add('kl-open');
}
function close(){const p=$('kl-panel');if(p)p.classList.remove('open');document.body.classList.remove('kl-open');}
window.kcLayoutOpen=open;window.kcLayoutClose=close;
function draw(){
  const p=panel(),b=$('kl-body');
  p.querySelectorAll('.kl-tabs button').forEach(x=>x.classList.toggle('on',x.dataset.t===tab));
  if(tab==='home')b.innerHTML=homeUI();
  else if(tab==='nav')b.innerHTML=navUI();
  else if(tab==='top')b.innerHTML=topUI();
  else b.innerHTML=barUI();
}
function topUI(){
  const c=topCfg(),cat=tbCat();
  const free=Object.keys(cat).map(k=>cat[k]).filter(d=>!c.items.includes(d.id));
  const grp=(t,arr)=>arr.length?`<div class="kl-sub">${t}</div><div class="kl-adds">${arr.map(d=>`<button type="button" class="kl-add" data-a="tbput" data-id="${esc(d.id)}"><span class="ms">${esc(d.ic)}</span><b>${esc(d.n)}</b><span class="ms kl-add-p">add_circle</span></button>`).join('')}</div>`:'';
  return `<p class="kl-hint">Les boutons en haut à droite de l’écran. Glisse pour changer l’ordre, enlève ceux qui ne te servent pas, ajoute des raccourcis ou des infos en direct (météo, heure, série…).</p>
    <div class="kl-list" data-list="top">${c.items.map(id=>{const d=cat[id];return `<div class="kl-item kl-sm" data-id="${esc(id)}">
      <button class="kl-grip" aria-label="Déplacer"><span class="ms">drag_indicator</span></button><span class="kl-ic"><span class="ms">${esc(d.ic)}</span></span><div class="kl-main"><b>${esc(d.n)}</b></div>
      <button class="kl-eye" data-a="tbrm" title="Enlever de la barre"><span class="ms">do_not_disturb_on</span></button></div>`;}).join('')||'<div class="kl-empty">La barre est vide</div>'}</div>
    <div class="kl-sep"></div>
    ${free.length?grp('Boutons d’origine enlevés',free.filter(d=>d.kind==='base'))+grp('Infos en direct',free.filter(d=>d.kind==='wid'))+grp('Raccourcis',free.filter(d=>d.kind==='nav'||d.kind==='act')):'<p class="kl-hint">Tout est déjà dans la barre.</p>'}`;
}
function homeUI(){
  const c=homeCfg();
  const mini=c.filter(x=>!x.hide).map(x=>{const B=BLOCKS.find(b=>b.id===x.id);return `<i class="kl-mini-${x.size}" title="${esc(B.n)}"><span class="ms">${B.ic}</span></i>`;}).join('');
  return `<button class="btn btn-p kl-direct" data-a="direct"><span class="ms">open_with</span>Déplacer les cadres directement sur l’accueil</button>
    <p class="kl-hint">Sur l’accueil, tu peux aussi <b>tirer le bord d’un cadre</b> pour régler sa largeur et sa hauteur à la souris. Ou ici : attrape un cadre par la poignée <span class="ms">drag_indicator</span> pour changer sa place, choisis sa taille ou cache-le avec l’œil.</p>
    <div class="kl-mini" aria-hidden="true">${mini}</div>
    <div class="kl-list" data-list="home">${c.map(x=>{const B=BLOCKS.find(b=>b.id===x.id);return `<div class="kl-item${x.hide?' off':''}" data-id="${x.id}">
      <button class="kl-grip" aria-label="Déplacer"><span class="ms">drag_indicator</span></button>
      <span class="kl-ic"><span class="ms">${B.ic}</span></span>
      <div class="kl-main"><b>${esc(B.n)}</b>${x.id==='modes'?'<button class="kl-pick" data-a="modes"><span class="ms">tune</span>Choisir les raccourcis (0 à 8)</button>':''}<div class="kl-seg">${SIZES.map(([v,l])=>`<button class="${x.size===v&&!x.w?'on':''}" data-a="size" data-v="${v}">${l}</button>`).join('')}${x.w?`<i class="kl-wtag" title="Largeur réglée à la souris">${x.w}/12</i>`:''}</div></div>
      <button class="kl-eye" data-a="hide" title="${x.hide?'Afficher':'Cacher'}"><span class="ms">${x.hide?'visibility_off':'visibility'}</span></button></div>`;}).join('')}</div>
    <div class="kl-sep"></div>
    <button class="kl-link" data-a="wx"><span class="ms">partly_cloudy_day</span><span><b>Météo de ma ville</b><small>Le vrai ciel et le vrai temps de chez toi sur la carte « Ma ville »</small></span><span class="ms">chevron_right</span></button>
    <button class="kl-link" data-a="mat"><span class="ms">folder_open</span><span><b>Ordre de mes matières</b><small>Dans « Mes matières », attrape la poignée d’une matière pour la déplacer</small></span><span class="ms">chevron_right</span></button>`;
}
function navUI(){
  const c=navCfg(),n0=readNav();if(!c)return '<p class="kl-hint">Menu introuvable.</p>';
  return `<div class="kl-row"><span>Côté du menu</span><div class="kl-seg"><button class="${c.side==='left'?'on':''}" data-a="side" data-v="left"><span class="ms">left_panel_open</span>Gauche</button><button class="${c.side==='right'?'on':''}" data-a="side" data-v="right"><span class="ms">right_panel_open</span>Droite</button></div></div>
    <p class="kl-hint">Glisse une rubrique dans une autre catégorie ou change son ordre (ex. « Cartes mentales » dans Organiser, « Accueil » en deuxième). Renomme les catégories en cliquant sur leur nom.</p>
    ${c.groups.map((g,gi)=>`<section class="kl-group" data-g="${gi}">
      <div class="kl-group-h"><span class="ms">label</span><input class="kl-gname" data-g="${gi}" value="${esc(g.label)}" placeholder="Sans titre" aria-label="Nom de la catégorie">${g.items.length?'':`<button class="kl-eye" data-a="delg" data-g="${gi}" title="Supprimer la catégorie vide"><span class="ms">delete</span></button>`}</div>
      <div class="kl-list" data-list="nav" data-g="${gi}">${g.items.map(k=>{const it=n0.items[k],hid=c.hidden.includes(k);return `<div class="kl-item kl-sm${hid?' off':''}" data-id="${k}">
        <button class="kl-grip" aria-label="Déplacer"><span class="ms">drag_indicator</span></button><span class="kl-ic"><span class="ms">${esc(it.ic)}</span></span><div class="kl-main"><b>${esc(it.n)}</b></div>
        ${k==='home'?'':`<button class="kl-eye" data-a="navhide" title="${hid?'Afficher':'Cacher'}"><span class="ms">${hid?'visibility_off':'visibility'}</span></button>`}</div>`;}).join('')||'<div class="kl-empty">Dépose une rubrique ici</div>'}</div></section>`).join('')}
    <button class="btn btn-g kl-addg" data-a="addg"><span class="ms">add</span>Ajouter une catégorie</button>`;
}
function barUI(){
  const ids=barCfg(),all=barItems();
  return `<p class="kl-hint">Sur téléphone, la barre en bas de l’écran. Glisse pour changer l’ordre des boutons.</p>
    <div class="kl-list" data-list="bar">${ids.map(id=>{const b=all.find(x=>x.id===id);return b?`<div class="kl-item kl-sm" data-id="${id}"><button class="kl-grip" aria-label="Déplacer"><span class="ms">drag_indicator</span></button><span class="kl-ic"><span class="ms">${esc(b.ic)}</span></span><div class="kl-main"><b>${esc(b.n)}</b></div></div>`:'';}).join('')}</div>`;
}
function setCfg(part,val){const o=load();o[part]=val;save(o);applyAll();}
function onSorted(){
  const p=$('kl-panel');
  if(tab==='home'){const c=homeCfg(),order=[...p.querySelectorAll('[data-list="home"] .kl-item')].map(x=>x.dataset.id);setCfg('home',order.map(id=>c.find(x=>x.id===id)));draw();}
  else if(tab==='nav'){const c=navCfg();c.groups.forEach((g,gi)=>{g.items=[...p.querySelectorAll(`[data-list="nav"][data-g="${gi}"] .kl-item`)].map(x=>x.dataset.id);});setCfg('nav',c);draw();}
  else if(tab==='top'){const c=topCfg();c.items=[...p.querySelectorAll('[data-list="top"] .kl-item')].map(x=>x.dataset.id);setCfg('top',c);}
  else{setCfg('bar',[...p.querySelectorAll('[data-list="bar"] .kl-item')].map(x=>x.dataset.id));}
}
function onInput(e){
  const n=e.target.closest('.kl-gname');if(!n)return;
  const c=navCfg();const g=c.groups[+n.dataset.g];if(!g)return;g.label=n.value.slice(0,30);setCfg('nav',c);
}
function onClick(e){
  const b=e.target.closest('[data-a],[data-t]');if(!b)return;
  if(b.dataset.t){tab=b.dataset.t;draw();if(tab==='home'&&document.body.dataset.screen!=='home'&&typeof showScreen==='function')showScreen('home');return;}
  const a=b.dataset.a,item=b.closest('.kl-item'),id=item&&item.dataset.id;
  if(a==='close'){close();return;}
  if(a==='direct'){kcHomeEdit(true);return;}
  if(a==='modes'){if(window.kcShortcutsPick)kcShortcutsPick();return;}
  if(a==='size'||a==='hide'){const c=homeCfg(),x=c.find(y=>y.id===id);if(!x)return;if(a==='size'){x.size=b.dataset.v;delete x.w;}else x.hide=!x.hide;setCfg('home',c);draw();return;}
  if(a==='tbput'){if(tbAdd(b.dataset.id))draw();return;}
  if(a==='tbrm'){tbRemove(id);draw();return;}
  if(a==='side'){const c=navCfg();c.side=b.dataset.v;setCfg('nav',c);draw();return;}
  if(a==='navhide'){const c=navCfg();c.hidden=c.hidden.includes(id)?c.hidden.filter(k=>k!==id):c.hidden.concat(id);setCfg('nav',c);draw();return;}
  if(a==='addg'){const c=navCfg();c.groups.push({label:'Nouvelle catégorie',items:[]});setCfg('nav',c);draw();const ins=$('kl-panel').querySelectorAll('.kl-gname');const last=ins[ins.length-1];if(last){last.focus();last.select();}return;}
  if(a==='delg'){const c=navCfg();c.groups.splice(+b.dataset.g,1);setCfg('nav',c);draw();return;}
  if(a==='wx'){if(window.kcWeatherSetup)kcWeatherSetup();return;}
  if(a==='mat'){close();if(typeof showScreen==='function')showScreen('matieres-hub');return;}
  if(a==='reset'){
    const o=load();
    if(tab==='home'){delete o.home;delete o.homeGap;delete o.homeMax;}else if(tab==='nav')delete o.nav;else if(tab==='top')delete o.top;else delete o.bar;
    save(o);
    if(tab==='nav'){document.body.classList.remove('kc-nav-right');}
    if(tab==='bar')document.querySelectorAll('.bnav > .ni').forEach(x=>x.style.order='');
    applyAll();draw();
    if(typeof showNotif==='function')showNotif('Mise en page d’origine remise','ok');
  }
}

/* ───────── Mode édition directement sur la page (v67) ─────────
   kcHomeEdit() : les cadres de l'accueil et les rubriques du menu s'attrapent à la souris (ou au doigt). */
let EDIT=false,DG=null;
function blkName(id){const B=BLOCKS.find(b=>b.id===id);return B?B.n:id;}
function decorate(){
  const g=$('kh-grid');if(!g)return;
  homeCfg().forEach(c=>{
    const el=g.querySelector(`.kh-blk[data-blk="${c.id}"]`);if(!el)return;
    el.removeAttribute('hidden');el.classList.toggle('kh-off',c.hide);
    let cv=el.querySelector(':scope>.kh-ecover');
    if(!cv){cv=document.createElement('div');cv.className='kh-ecover';el.appendChild(cv);}
    cv.innerHTML=`<div class="kh-ebar"><span class="kh-egrip"><span class="ms">drag_indicator</span><b>${esc(blkName(c.id))}</b></span>
      <span class="kh-eseg">${SIZES.map(([v,l])=>`<button type="button" class="${c.size===v&&!c.w?'on':''}" data-e="size" data-v="${v}" title="${l}">${v==='S'?'Petit':v==='L'?'Large':'Plein'}</button>`).join('')}</span>
      ${c.id==='modes'?'<button type="button" class="kh-eeye kh-epick" data-e="modes" title="Choisir les raccourcis (0 à 8)"><span class="ms">tune</span><span>Choisir</span></button>':''}
      <button type="button" class="kh-eeye" data-e="hide" title="${c.hide?'Afficher':'Cacher'}"><span class="ms">${c.hide?'visibility_off':'visibility'}</span></button></div>
      ${c.hide?'<span class="kh-ehid">Caché</span>':''}
      <i class="kh-rz kh-rz-e" data-rz="e" title="Tire pour régler la largeur (double-clic : taille d’origine)"></i>
      <i class="kh-rz kh-rz-s" data-rz="s" title="Tire pour régler la hauteur (double-clic : hauteur automatique)"></i>
      <i class="kh-rz kh-rz-se" data-rz="se" title="Tire pour régler la largeur et la hauteur"></i>`;
  });
  decorateTop();
  document.querySelectorAll('#desktop-left .dl-nav a[data-nav]').forEach(x=>{x.classList.add('kh-navdrag');const c=navCfg();x.hidden=false;x.classList.toggle('kh-off',c&&c.hidden.includes(x.dataset.nav));if(!x.querySelector('.kh-navgrip')){const g=document.createElement('span');g.className='ms kh-navgrip';g.textContent='drag_indicator';x.appendChild(g);}});
}
function undecorate(){
  document.querySelectorAll('.kh-ecover').forEach(x=>x.remove());
  document.querySelectorAll('.kh-blk.kh-off,.dl-nav a.kh-off').forEach(x=>x.classList.remove('kh-off'));
  document.querySelectorAll('.kh-navgrip').forEach(x=>x.remove());
  document.querySelectorAll('.kh-navdrag').forEach(x=>x.classList.remove('kh-navdrag'));
  undecorateTop();closePop();
  applyAll();
}
/* barre du haut en mode édition : pastille « − » sur chaque bouton, bouton « + » pour ajouter */
function decorateTop(){
  const fr=tbFr();if(!fr)return;
  fr.classList.add('kc-tb-edit');
  fr.querySelectorAll('[data-tb]').forEach(el=>{
    if(el.querySelector(':scope>.kc-tb-rm'))return;
    const m=document.createElement('span');m.className='kc-tb-rm';m.dataset.e='tbrm';m.title='Enlever de la barre';m.innerHTML='<span class="ms">remove</span>';
    el.appendChild(m);
  });
  if(!fr.querySelector('.kc-tb-add')){
    const a=document.createElement('button');a.type='button';a.className='ib kc-tb-add';a.dataset.e='tbadd';a.dataset.tooltip='Ajouter à la barre';a.setAttribute('aria-label','Ajouter à la barre');a.innerHTML='<span class="ms">add</span>';
    fr.appendChild(a);
  }
}
function undecorateTop(){
  const fr=tbFr();if(!fr)return;
  fr.classList.remove('kc-tb-edit');
  fr.querySelectorAll('.kc-tb-rm,.kc-tb-add').forEach(x=>x.remove());
}
/* petites fenêtres du mode édition : « Ajouter à la barre » et « Espaces » */
function closePop(){document.querySelectorAll('.kh-epop').forEach(x=>x.remove());}
function popAt(id,anchor,html,above){
  closePop();
  const p=document.createElement('div');p.id=id;p.className='kh-epop';p.innerHTML=html;document.body.appendChild(p);
  const r=anchor.getBoundingClientRect(),w=p.offsetWidth,h=p.offsetHeight;
  const left=Math.max(10,Math.min(innerWidth-w-10,r.left+r.width/2-w/2));
  p.style.left=left+'px';
  p.style.top=(above?Math.max(10,r.top-h-10):Math.min(innerHeight-h-10,r.bottom+10))+'px';
  return p;
}
function tbPop(){
  const a=document.querySelector('.kc-tb-add');if(!a)return;
  const c=topCfg(),cat=tbCat(),free=Object.keys(cat).map(k=>cat[k]).filter(d=>!c.items.includes(d.id));
  const grp=(t,arr)=>arr.length?`<div class="kh-epop-t">${t}</div>${arr.map(d=>`<button type="button" class="kh-epop-i" data-e="tbput" data-id="${esc(d.id)}"><span class="ms">${esc(d.ic)}</span><span>${esc(d.n)}</span><span class="ms kh-epop-p">add</span></button>`).join('')}`:'';
  popAt('kc-tb-pop',a,`<div class="kh-epop-h"><b>Ajouter à la barre</b><small>${c.items.length} / ${TB_MAX} places</small></div><div class="kh-epop-s">${free.length?grp('Boutons d’origine enlevés',free.filter(d=>d.kind==='base'))+grp('Infos en direct',free.filter(d=>d.kind==='wid'))+grp('Raccourcis',free.filter(d=>d.kind==='nav'||d.kind==='act')):'<p class="kh-epop-e">Tout est déjà dans la barre.</p>'}${innerWidth<=640?'<p class="kh-epop-e">Sur téléphone, la barre est trop petite : les raccourcis et les infos ajoutés s’affichent sur ordinateur et tablette.</p>':''}</div>`,false);
}
function spacePop(btn){
  const o=load(),g=$('kh-grid'),gap=+o.homeGap||Math.round(parseFloat(getComputedStyle(g).columnGap)||20),max=+o.homeMax||1192;
  const lbl=v=>v>=MAXW?'Tout l’écran':v+' px';
  const p=popAt('kh-space-pop',btn,`<div class="kh-epop-h"><b>Espaces et largeur</b></div>
    <label class="kh-epop-r"><span>Espace entre les cadres<b id="kh-sp-gv">${gap} px</b></span><input type="range" class="kc-range" id="kh-sp-gap" min="4" max="48" step="2" value="${gap}"></label>
    <label class="kh-epop-r"><span>Largeur de la page<b id="kh-sp-mv">${lbl(max)}</b></span><input type="range" class="kc-range" id="kh-sp-max" min="900" max="${MAXW}" step="20" value="${Math.min(MAXW,max)}"></label>
    <button type="button" class="kh-epop-i" data-e="spreset"><span class="ms">restart_alt</span><span>Remettre les espaces d’origine</span></button>`,true);
  p.addEventListener('input',e=>{
    const o2=load();
    if(e.target.id==='kh-sp-gap'){o2.homeGap=+e.target.value;$('kh-sp-gv').textContent=o2.homeGap+' px';}
    if(e.target.id==='kh-sp-max'){o2.homeMax=+e.target.value;$('kh-sp-mv').textContent=lbl(o2.homeMax);}
    save(o2);applyHome();
  });
}
function toolbar(on){
  let t=$('kh-etool');
  if(!on){if(t)t.remove();return;}
  if(!t){t=document.createElement('div');t.id='kh-etool';t.className='kh-etool';document.body.appendChild(t);}
  t.innerHTML=`<span class="ms">open_with</span><span class="kh-etool-t"><b>Mode édition</b><small>Glisse les cadres · tire leurs bords · change la barre du haut</small></span>
    <button type="button" class="btn btn-g" data-e="space"><span class="ms">straighten</span>Espaces</button>
    <button type="button" class="btn btn-g" data-e="more"><span class="ms">tune</span>Plus d’options</button>
    <button type="button" class="btn btn-g" data-e="reset"><span class="ms">restart_alt</span>Réinitialiser</button>
    <button type="button" class="btn btn-p" data-e="done"><span class="ms">check</span>Terminé</button>`;
}
window.kcHomeEdit=function(on){
  on=on===undefined?!EDIT:!!on;
  if(on===EDIT){if(on)decorate();return;}
  EDIT=on;document.body.classList.toggle('kh-editing',on);
  if(on){if(document.body.dataset.screen!=='home'&&typeof showScreen==='function')showScreen('home');close();decorate();toolbar(true);}
  else{undecorate();toolbar(false);}
};
function ghostOf(el,e){
  const r=el.getBoundingClientRect(),gh=el.cloneNode(true);
  gh.classList.add('kh-ghost');gh.removeAttribute('id');gh.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
  Object.assign(gh.style,{width:r.width+'px',height:r.height+'px',left:r.left+'px',top:r.top+'px'});
  document.body.appendChild(gh);
  return {gh,dx:e.clientX-r.left,dy:e.clientY-r.top};
}
/* redimensionner un cadre à la souris : bord droit = largeur (colonnes sur 12), bord bas = hauteur mini */
let RZ=null;
function rzTip(e,txt){
  let t=$('kh-rz-tip');if(!t){t=document.createElement('div');t.id='kh-rz-tip';t.className='kh-rz-tip';document.body.appendChild(t);}
  t.textContent=txt;t.style.left=Math.min(innerWidth-170,e.clientX+16)+'px';t.style.top=Math.min(innerHeight-40,e.clientY+16)+'px';
}
/* v70 (16 nov. 2026) : le cadre suit la souris au pixel près pendant tout le geste (taille en px posée sur le cadre,
   une image par rafraîchissement, aucun enregistrement ni recalcul de la grille en route — avant, la grille était
   recalculée à chaque mouvement et le cadre sautait d'une ligne à l'autre). La taille « aimantée » sur les colonnes
   n'est appliquée qu'au relâchement, avec une petite transition. */
function rzStart(e,h){
  const el=h.closest('.kh-blk'),g=$('kh-grid');if(!el||!g||RZ)return;
  e.preventDefault();
  const cs=getComputedStyle(g),gap=parseFloat(cs.columnGap)||0,cols=cs.gridTemplateColumns.split(' ').filter(Boolean).length||1;
  const gr=g.getBoundingClientRect(),colW=(gr.width-gap*(cols-1))/cols;
  const epad=parseFloat(getComputedStyle(el).getPropertyValue('--kh-epad'))||0;
  const r=el.getBoundingClientRect(),dir=h.dataset.rz;
  RZ={el,id:e.pointerId,dir,gap,cols,colW,epad,blk:el.dataset.blk,g,
    ox:e.clientX-r.right,oy:e.clientY-r.bottom,x:e.clientX,y:e.clientY,
    minW:Math.min(r.width,3*colW+2*gap),n:null,h:null,auto:false,raf:0,moved:false};
  /* le cadre est figé à sa taille actuelle, en pixels : il ne dépend plus de la grille pendant le geste */
  el.style.transition='none';
  if(dir!=='s'&&cols===12){el.style.width=r.width+'px';el.style.justifySelf='start';el.style.maxWidth='none';}
  if(dir!=='e'){el.style.alignSelf='start';el.style.height=r.height+'px';el.style.minHeight='0';}
  h.classList.add('on');el.classList.add('kh-rzing');document.body.classList.add('kh-resizing','kh-rzdir-'+dir);   /* surtout pas « kh-rz-e » : c'est la classe des poignées (largeur 16 px) → toute la page rétrécissait */
  if(cols===12&&dir!=='s'){g.classList.add('kh-cols');g.style.setProperty('--kh-colw',colW+'px');g.style.setProperty('--kh-colg',gap+'px');}
  try{h.setPointerCapture(e.pointerId);}catch(_){}
  window.addEventListener('pointermove',rzMove,{passive:false});window.addEventListener('pointerup',rzEnd);window.addEventListener('pointercancel',rzEnd);
}
function rzFrame(){
  const d=RZ;if(!d)return;d.raf=0;
  const el=d.el,r=el.getBoundingClientRect(),gr=d.g.getBoundingClientRect(),tip=[];
  if(d.dir!=='s'&&d.cols===12){
    const want=d.x-d.ox-r.left,w=Math.max(d.minW,Math.min(gr.right-r.left,want));
    el.style.width=w+'px';
    d.n=want>gr.right-r.left+48?12:Math.max(3,Math.min(12,Math.round((w+d.gap)/(d.colW+d.gap))));
    tip.push(d.n===12?'Toute la largeur':'Largeur '+d.n+' / 12');
  }
  if(d.dir!=='e'){
    /* v72 : vraie hauteur (avant : hauteur MINI → impossible de faire plus petit que le contenu, le cadre
       « revenait » à sa taille au lâcher). Le contenu s'adapte (CSS @container) et défile si besoin. */
    const hh=Math.max(90+d.epad,Math.min(2400,d.y-d.oy-r.top));
    el.style.height=hh+'px';
    d.auto=false;d.h=hh;
    tip.push('Hauteur '+Math.round(hh-d.epad)+' px');
  }
  rzTip({clientX:d.x,clientY:d.y},tip.join(' · '));
}
function rzMove(e){
  if(!RZ||e.pointerId!==RZ.id)return;
  e.preventDefault();
  RZ.x=e.clientX;RZ.y=e.clientY;RZ.moved=true;
  if(!RZ.raf)RZ.raf=requestAnimationFrame(rzFrame);
}
function rzEnd(e){
  if(!RZ||e.pointerId!==RZ.id)return;
  if(RZ.raf){cancelAnimationFrame(RZ.raf);}
  if(RZ.moved)rzFrame();
  const d=RZ;RZ=null;
  window.removeEventListener('pointermove',rzMove);window.removeEventListener('pointerup',rzEnd);window.removeEventListener('pointercancel',rzEnd);
  document.body.classList.remove('kh-resizing','kh-rzdir-e','kh-rzdir-s','kh-rzdir-se');
  const t=$('kh-rz-tip');if(t)t.remove();
  const el=d.el;
  if(d.moved){
    const c=homeCfg(),x=c.find(y=>y.id===d.blk);
    if(x){
      if(d.n!=null){x.size=d.n<=5?'S':d.n<=9?'L':'F';if(d.n===4||d.n===8||d.n===12)delete x.w;else x.w=d.n;}
      if(d.h!=null){if(d.auto)delete x.h;else x.h=Math.max(90,Math.round(d.h-d.epad));}
      const o=load();o.home=c;save(o);
    }
  }
  const fin=()=>{
    ['width','maxWidth','justifySelf','alignSelf','minHeight','height','transition'].forEach(k=>{el.style[k]='';});
    el.classList.remove('kh-rzing');d.g.classList.remove('kh-cols');
    applyHome();decorate();
  };
  if(d.moved&&d.n!=null){
    /* glisse en douceur jusqu'à la largeur aimantée, puis la grille reprend la main */
    el.style.transition='width .16s cubic-bezier(.2,.8,.2,1)';
    el.style.width=(d.n*d.colW+(d.n-1)*d.gap)+'px';
    setTimeout(fin,180);
  }else fin();
}
function onEditDown(e){
  if(!EDIT||e.button>0)return;
  const rz=e.target.closest('.kh-rz');
  if(rz){rzStart(e,rz);return;}
  if(e.target.closest('[data-e]')||e.target.closest('.kh-epop'))return;
  const cv=e.target.closest('.kh-ecover'),nav=e.target.closest('#desktop-left .dl-nav a.kh-navdrag'),tb=e.target.closest('.topbar .fr.kc-tb-edit [data-tb]');
  const el=cv?cv.parentElement:(nav||tb);if(!el)return;
  e.preventDefault();
  const g=ghostOf(el,e);
  if(tb)g.gh.classList.add('kc-tb-ghost');
  DG={el,kind:cv?'home':nav?'nav':'top',...g,id:e.pointerId,last:''};
  el.classList.add('kh-dragging');document.body.classList.add('kh-grabbing');
  window.addEventListener('pointermove',onEditMove,{passive:false});window.addEventListener('pointerup',onEditUp);window.addEventListener('pointercancel',onEditUp);
}
function onEditMove(e){
  if(!DG||e.pointerId!==DG.id)return;
  e.preventDefault();
  DG.gh.style.left=(e.clientX-DG.dx)+'px';DG.gh.style.top=(e.clientY-DG.dy)+'px';
  const under=document.elementFromPoint(e.clientX,e.clientY);if(!under)return;
  if(DG.kind==='home'){
    const t=under.closest('.kh-blk');if(!t||t===DG.el||!t.closest('#kh-grid'))return;
    const r=t.getBoundingClientRect(),gw=$('kh-grid').getBoundingClientRect().width;
    const after=r.width>gw*.6?e.clientY>r.top+r.height/2:e.clientX>r.left+r.width/2;
    const key=t.dataset.blk+(after?'>':'<');if(key===DG.last)return;DG.last=key;
    const c=homeCfg(),me=c.findIndex(x=>x.id===DG.el.dataset.blk);const [m]=c.splice(me,1);
    let ti=c.findIndex(x=>x.id===t.dataset.blk);c.splice(after?ti+1:ti,0,m);
    const o=load();o.home=c;save(o);applyHome();decorate();
  }else if(DG.kind==='top'){
    /* tirée loin sous la barre = enlevée au lâcher (comme sur Mac) */
    const bar=document.querySelector('.topbar'),out=bar&&e.clientY>bar.getBoundingClientRect().bottom+70;
    DG.out=!!out;DG.gh.classList.toggle('kc-tb-out',DG.out);
    if(out)return;
    const t=under.closest('.topbar .fr [data-tb]');if(!t||t===DG.el)return;
    const r=t.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;
    const key=t.dataset.tb+(after?'>':'<');if(key===DG.last)return;DG.last=key;
    const c=topCfg(),me=c.items.indexOf(DG.el.dataset.tb);if(me<0)return;
    const [m]=c.items.splice(me,1);const ti=c.items.indexOf(t.dataset.tb);if(ti<0)return;
    c.items.splice(after?ti+1:ti,0,m);
    const o=load();o.top=c;save(o);applyTop();
  }else{
    const t=under.closest('#desktop-left .dl-nav a[data-nav], #desktop-left .dl-nav .kh-nav-label');if(!t||t===DG.el)return;
    const r=t.getBoundingClientRect(),after=e.clientY>r.top+r.height/2||t.classList.contains('kh-nav-label');
    const key=(t.dataset.nav||t.textContent)+(after?'>':'<');if(key===DG.last)return;DG.last=key;
    if(after)t.after(DG.el);else t.before(DG.el);
  }
}
function onEditUp(e){
  if(!DG||e.pointerId!==DG.id)return;
  const d=DG;DG=null;
  window.removeEventListener('pointermove',onEditMove);window.removeEventListener('pointerup',onEditUp);window.removeEventListener('pointercancel',onEditUp);
  d.gh.remove();d.el.classList.remove('kh-dragging');document.body.classList.remove('kh-grabbing');
  if(d.kind==='top'&&d.out){tbRemove(d.el.dataset.tb);decorateTop();if(typeof showNotif==='function')showNotif('Enlevé de la barre · le bouton + permet de le remettre','ok');}
  if(d.kind==='nav'){
    const c=navCfg(),groups=[];let cur=null;
    [...document.querySelectorAll('#desktop-left .dl-nav > *')].forEach(x=>{
      if(x.classList.contains('kh-nav-label')){cur={label:x.textContent.trim(),items:[]};groups.push(cur);}
      else if(x.matches('a[data-nav]')){if(!cur){cur={label:'',items:[]};groups.push(cur);}cur.items.push(x.dataset.nav);}
    });
    c.groups.forEach(g0=>{if(!g0.items.length&&!groups.some(g=>g.label===g0.label))groups.push({label:g0.label,items:[]});});
    c.groups=groups;const o=load();o.nav=c;save(o);applyNav();decorate();
  }
}
document.addEventListener('pointerdown',onEditDown,true);
document.addEventListener('click',e=>{
  if(!EDIT)return;
  const b=e.target.closest('[data-e]');
  if(b){
    e.preventDefault();e.stopPropagation();
    const a=b.dataset.e,blk=b.closest('.kh-blk');
    if(a!=='tbadd'&&a!=='tbput'&&a!=='space'&&a!=='spreset')closePop();
    if(a==='size'||a==='hide'){const c=homeCfg(),x=c.find(y=>y.id===blk.dataset.blk);if(!x)return;if(a==='size'){x.size=b.dataset.v;delete x.w;}else x.hide=!x.hide;const o=load();o.home=c;save(o);applyHome();decorate();}
    else if(a==='modes'){if(window.kcShortcutsPick)kcShortcutsPick();}
    else if(a==='done')kcHomeEdit(false);
    else if(a==='more'){kcHomeEdit(false);open('nav');}
    else if(a==='reset'){const o=load();delete o.home;delete o.homeGap;delete o.homeMax;delete o.nav;delete o.top;save(o);document.body.classList.remove('kc-nav-right');applyAll();decorate();if(typeof showNotif==='function')showNotif('Mise en page d’origine remise','ok');}
    else if(a==='tbrm'){const it=b.closest('[data-tb]');if(it){tbRemove(it.dataset.tb);decorateTop();}}
    else if(a==='tbadd'){if($('kc-tb-pop'))closePop();else tbPop();}
    else if(a==='tbput'){if(tbAdd(b.dataset.id)){decorateTop();tbPop();}}
    else if(a==='space'){if($('kh-space-pop'))closePop();else spacePop(b);}
    else if(a==='spreset'){const o=load();delete o.homeGap;delete o.homeMax;save(o);applyHome();spacePop(document.querySelector('#kh-etool [data-e="space"]'));}
    return;
  }
  if(!e.target.closest('.kh-epop'))closePop();
  if(e.target.closest('.kh-ecover')||e.target.closest('#desktop-left .dl-nav a.kh-navdrag')||e.target.closest('.topbar .fr.kc-tb-edit')){e.preventDefault();e.stopPropagation();}
},true);
/* double-clic sur un bord : retour à la taille automatique */
document.addEventListener('dblclick',e=>{
  if(!EDIT)return;
  const h=e.target.closest('.kh-rz');if(!h)return;
  e.preventDefault();e.stopPropagation();
  const blk=h.closest('.kh-blk'),c=homeCfg(),x=c.find(y=>y.id===blk.dataset.blk);if(!x)return;
  if(h.dataset.rz!=='s'){delete x.w;const B=BLOCKS.find(b=>b.id===x.id);if(B)x.size=B.size;}
  if(h.dataset.rz!=='e')delete x.h;
  const o=load();o.home=c;save(o);applyHome();decorate();
},true);
document.addEventListener('keydown',e=>{if(EDIT&&e.key==='Escape'){e.preventDefault();kcHomeEdit(false);}});

/* ───────── Démarrage ───────── */
window.kcLayoutApplyAll=function(){try{applyAll();if(EDIT)decorate();}catch(e){}};
function start(){
  readNav();applyAll();
  const orig=window.showScreen;
  if(typeof orig==='function'&&!orig._kcl){
    const w=function(id){if(EDIT&&id!=='home')kcHomeEdit(false);const r=orig.apply(this,arguments);if(id==='home')try{applyHome();if(EDIT)decorate();}catch(e){}try{tbWidgets();}catch(e){}return r;};
    w._kcl=true;Object.keys(orig).forEach(k=>{try{w[k]=orig[k];}catch(e){}});window.showScreen=w;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
