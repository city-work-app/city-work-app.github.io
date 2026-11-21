/* =========================================================
   kc-colors.js — Couleurs par écran (v84, 21 nov. 2026)
   Demande : « changer la couleur de l'interface du QCM et pareil pour toutes les autres interfaces, parce que
   c'est que noir et blanc ». Chaque groupe d'écrans (QCM, Flashcards, Annales, Accueil…) peut avoir sa propre
   ambiance de couleur : fond, cartes, bordures et couleur d'accent teintés, en clair comme en sombre.
   - Stockage : kp_scol = {groupe: {c:'#rrggbb', k:0|1|2 (intensité douce / moyenne / forte)}} ; groupe « all » =
     tout le site (les écrans sans réglage propre le prennent).
   - Application : variables --kc-* posées sur <body> (style en ligne) selon body[data-screen], mises à jour à
     chaque changement d'écran (MutationObserver) et de mode clair / sombre.
   - Fenêtre : kcColorsOpen(groupe) — bouton palette dans l'en-tête du QCM, Paramètres > Apparence, menu Mise en page.
   ========================================================= */
(function(){
'use strict';
const KEY='kp_scol';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GROUPS=[
  {id:'all',n:'Tout le site',ic:'public',s:[]},
  {id:'quiz',n:'QCM et résultats',ic:'quiz',s:['quiz','results']},
  {id:'flash',n:'Flashcards',ic:'style',s:['all-flashcards','concept-fc','fc-editor','concepts']},
  {id:'annales',n:'Annales',ic:'history_edu',s:['annales-hub','annales']},
  {id:'home',n:'Accueil',ic:'home',s:['home','modes-hub']},
  {id:'mat',n:'Mes matières et cours',ic:'folder_open',s:['matieres-hub','matiere','matiere-options','subfolder','course','fiche','manage']},
  {id:'stats',n:'Profil et statistiques',ic:'monitoring',s:['profil','profil-hub','heatmap','stats']},
  {id:'mind',n:'Cartes mentales',ic:'account_tree',s:['mindmap','mindmap-editor','diagram','diagram-editor']},
  {id:'agenda',n:'Agenda et partiels',ic:'calendar_month',s:['agenda','partiels','plan']},
  {id:'social',n:'Amis et classement',ic:'group',s:['social','friends','friend-profile']},
  {id:'tools',n:'Outils et Atelier IA',ic:'handyman',s:['outils','atelier','ultra','imaging','imaging-session','prompts','audio','audio-folder','braindump','match']}
];
const PAL=[
  ['Océan','#0ea5e9'],['Lagon','#14b8a6'],['Forêt','#22c55e'],['Menthe','#10b981'],['Citron','#a3e635'],
  ['Ambre','#f59e0b'],['Coucher de soleil','#f97316'],['Corail','#fb7185'],['Framboise','#e11d48'],['Bordeaux','#9f1239'],
  ['Rose','#ec4899'],['Lavande','#a78bfa'],['Violet','#7c3aed'],['Indigo','#4f46e5'],['Bleu nuit','#1e3a8a'],['Ardoise','#64748b']
];
const KS=[[.6,'Douce'],[1,'Moyenne'],[1.6,'Forte']];
const VARS=['--kc-primary','--kc-primary-hover','--kc-primary-text','--kc-primary-soft','--kc-on-primary','--kc-bg','--kc-bg-side','--kc-surface','--kc-surface-2','--kc-border','--kc-mix-base'];
function load(){try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');return o&&typeof o==='object'?o:{};}catch(e){return {};}}
function save(o){try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}}
const okHex=c=>/^#[0-9a-f]{6}$/i.test(c||'');
function groupOf(scr){return GROUPS.find(g=>g.s.includes(scr));}
function cfgFor(scr){const o=load(),g=groupOf(scr);const c=(g&&o[g.id])||o.all;return c&&okHex(c.c)?c:null;}
function lum(hex){const n=parseInt(hex.slice(1),16),r=(n>>16)/255,g=(n>>8&255)/255,b=(n&255)/255;return .2126*r+.7152*g+.0722*b;}
const mix=(c,p,base)=>`color-mix(in srgb,${c} ${Math.max(0,Math.min(100,p)).toFixed(1)}%,${base})`;
function varsFor(cfg,dark){
  const C=cfg.c,f=(KS[cfg.k]||KS[1])[0],V={};
  V['--kc-primary']=C;V['--kc-primary-hover']=mix(C,86,'#000');
  V['--kc-on-primary']=lum(C)>.62?'#111111':'#ffffff';
  if(dark){
    V['--kc-primary-text']=mix(C,68,'#fff');V['--kc-primary-soft']=mix(C,17,'transparent');
    V['--kc-bg']=mix(C,7*f,'#08080A');V['--kc-bg-side']=mix(C,8.5*f,'#0A0A0C');V['--kc-surface']=mix(C,10*f,'#0F0F12');
    V['--kc-surface-2']=mix(C,14*f,'#17171B');V['--kc-border']=mix(C,24*f,'#1F1F23');V['--kc-mix-base']=mix(C,7*f,'#08080A');
  }else{
    V['--kc-primary-text']=mix(C,82,'#000');V['--kc-primary-soft']=mix(C,11,'#fff');
    V['--kc-bg']=mix(C,5*f,'#fff');V['--kc-bg-side']=mix(C,7*f,'#fff');V['--kc-surface']=mix(C,1.6*f,'#fff');
    V['--kc-surface-2']=mix(C,8*f,'#fff');V['--kc-border']=mix(C,17*f,'#fff');V['--kc-mix-base']=mix(C,5*f,'#fff');
  }
  return V;
}
let lastKey='';
function apply(force){
  const b=document.body;if(!b)return;
  const scr=b.dataset.screen||'home',dark=b.classList.contains('dark'),cfg=cfgFor(scr);
  const key=cfg?cfg.c+'|'+cfg.k+'|'+dark:'none';
  if(key===lastKey&&!force)return;lastKey=key;
  if(!cfg){VARS.forEach(v=>b.style.removeProperty(v));b.classList.remove('kc-scol');return;}
  const V=varsFor(cfg,dark);VARS.forEach(v=>{if(V[v])b.style.setProperty(v,V[v]);else b.style.removeProperty(v);});
  b.classList.add('kc-scol');
}
window.kcColorsApply=()=>apply(true);

/* ───────── Fenêtre de choix ───────── */
let cur='quiz';
function bodyHTML(){
  const o=load(),g=GROUPS.find(x=>x.id===cur)||GROUPS[0],c=o[g.id],inh=!c&&g.id!=='all';
  const dark=document.body.classList.contains('dark');
  const prev=cfg=>{const V=cfg?varsFor(cfg,dark):null;return V?`--pb:${V['--kc-bg']};--ps:${V['--kc-surface-2']};--pp:${V['--kc-primary']};--pd:${V['--kc-border']}`:'';};
  return `<div class="ksc">
    <div class="ksc-groups" role="tablist">${GROUPS.map(x=>{const cc=o[x.id];return `<button type="button" class="ksc-g${x.id===cur?' on':''}" data-sg="${x.id}"><span class="ms">${x.ic}</span>${esc(x.n)}${cc&&okHex(cc.c)?`<i style="background:${cc.c}"></i>`:''}</button>`;}).join('')}</div>
    <div class="ksc-main">
      <div class="ksc-ttl"><span class="ms">${g.ic}</span><b>${esc(g.n)}</b><small>${g.id==='all'?'Les écrans sans couleur à eux prennent celle-ci':inh?(o.all&&okHex(o.all.c)?'Prend la couleur de « Tout le site »':'Couleurs normales du site'):'Couleur propre à ces écrans'}</small></div>
      <div class="ksc-sw">
        <button type="button" class="ksc-s ksc-none${!c?' on':''}" data-sc="" title="${g.id==='all'?'Couleurs normales du site':'Comme le reste du site'}"><span class="ms">${g.id==='all'?'format_color_reset':'link'}</span><small>${g.id==='all'?'Aucune':'Comme le site'}</small></button>
        ${PAL.map(([n,h])=>`<button type="button" class="ksc-s${c&&c.c===h?' on':''}" data-sc="${h}" title="${esc(n)}" style="--sw:${h}"><span class="ksc-dot"></span><small>${esc(n)}</small></button>`).join('')}
        <label class="ksc-s ksc-cust${c&&!PAL.some(p=>p[1]===c.c)?' on':''}" title="Ma couleur" style="${c&&!PAL.some(p=>p[1]===c.c)?'--sw:'+c.c:''}"><span class="ksc-dot"><span class="ms">colorize</span></span><small>Ma couleur</small><input type="color" value="${c?c.c:'#e11d48'}" data-scc></label>
      </div>
      <div class="ksc-row"><span>Intensité</span><div class="ksc-seg">${KS.map((k,i)=>`<button type="button" class="${(c?c.k:1)===i?'on':''}" data-sk="${i}"${c?'':' disabled'}>${k[1]}</button>`).join('')}</div></div>
      <div class="ksc-prev" style="${prev(c||(!inh?null:o.all))}"><div class="ksc-pv"><i></i><i></i><i></i><b></b></div><small>Aperçu</small></div>
    </div></div>`;
}
function redraw(bg){const b=bg.querySelector('.kc-dlg-b');if(b){const sc=b.querySelector('.ksc-groups')?.scrollLeft||0;b.innerHTML=bodyHTML();const gg=b.querySelector('.ksc-groups');if(gg)gg.scrollLeft=sc;}}
function setCur(patch){const o=load();if(patch===null)delete o[cur];else o[cur]=Object.assign({k:1},o[cur]||{},patch);save(o);apply(true);}
window.kcColorsOpen=function(g){
  if(g&&GROUPS.some(x=>x.id===g))cur=g;else{const gg=groupOf(document.body.dataset.screen);cur=gg?gg.id:'all';}
  if(typeof window.kcDlg!=='function'){if(typeof showNotif==='function')showNotif('Fenêtre indisponible','err');return;}
  window.kcDlg({title:'Couleurs des écrans',sub:'Donne une ambiance de couleur à chaque partie du site',icon:'palette',body:bodyHTML(),
    foot:'<button class="btn btn-g" data-sreset>Tout remettre</button><span style="flex:1"></span><button class="btn btn-p" data-x>Terminé</button>',
    onOpen(bg){
      bg.classList.add('ksc-dlg');
      bg.addEventListener('click',e=>{
        const t=e.target;
        const gb=t.closest('[data-sg]');if(gb){cur=gb.dataset.sg;redraw(bg);return;}
        const sb=t.closest('[data-sc]');if(sb){const v=sb.dataset.sc;setCur(v?{c:v}:null);redraw(bg);return;}
        const kb=t.closest('[data-sk]');if(kb&&!kb.disabled){setCur({k:+kb.dataset.sk});redraw(bg);return;}
        if(t.closest('[data-sreset]')){(typeof kcConfirm==='function'?kcConfirm('Remettre les couleurs normales partout ?',{ok:'Remettre'}):Promise.resolve(true)).then(ok=>{if(!ok)return;save({});apply(true);redraw(bg);});}
      });
      bg.addEventListener('input',e=>{const i=e.target.closest('[data-scc]');if(i&&okHex(i.value)){setCur({c:i.value.toLowerCase()});const l=i.closest('.ksc-cust');if(l){l.style.setProperty('--sw',i.value);}}});
      bg.addEventListener('change',e=>{if(e.target.closest('[data-scc]'))redraw(bg);});
    }});
};
function start(){
  apply(true);
  new MutationObserver(()=>apply()).observe(document.body,{attributes:true,attributeFilter:['data-screen','class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
