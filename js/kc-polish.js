/* =========================================================
   kc-polish.js — finitions (v70, 16 nov. 2026)
   1. kcConfirm / kcPrompt / kcAlert : fenêtres du site à la place de confirm() / prompt() / alert() du navigateur
      (elles renvoient une promesse : `if(!(await kcConfirm('…')))return;`).
   2. Bouton « Annuler » après une suppression (kcUndoOffer, appelé par saveAll dans data.js).
   3. Cloche de notifications de l'accueil (kcNotifOpen) : cartes et questions à revoir, examens proches,
      objectif du jour, série en danger, flashcards à continuer.
   4. Téléphone : les ajouts de la barre du haut (cachés faute de place) sont dans un petit menu « ⋯ » (#kc-tb-more).
   5. Brouillon de l'« Ajout rapide » des flashcards (kp_fcx_draft) : le texte tapé survit à un rechargement.
   6. Mise en page (kp_layout2) enregistrée dans le compte (métadonnées du compte Supabase) : la même sur tous les appareils.
   7. Ligne « Espace utilisé » dans Paramètres > Sauvegarde.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function G(name,def){try{const v=eval(name);return v===undefined?def:v;}catch(e){return def;}}
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const lsPut=(k,v)=>{try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}};

/* ───────── 1. Fenêtres ───────── */
const DANGER=/^(supprimer|retirer|vider|effacer|ne plus)/i;
function split(msg){ // « Titre ? Détail… » → titre + sous-texte
  msg=String(msg==null?'':msg).replace(/\s*\n+\s*/g,' ').trim();
  const m=msg.match(/^(.{4,90}?\?)\s+(.+)$/);
  return m?{t:m[1],s:m[2]}:{t:msg,s:''};
}
window.kcConfirm=function(msg,o){
  o=o||{};
  return new Promise(res=>{
    if(typeof window.kcDlg!=='function'){res(window.confirm(msg));return;}
    const p=split(msg),danger=o.danger!==undefined?o.danger:DANGER.test(p.t);
    const ok=o.ok||(danger?(p.t.match(/^(\S+)/)||[0,'Supprimer'])[1].replace(/^./,c=>c.toUpperCase()):'OK');
    let done=false;
    window.kcDlg({title:p.t,sub:'',icon:o.icon||(danger?'delete':'help'),
      body:p.s?`<p class="kc-dlg-msg">${esc(p.s)}</p>`:'',
      foot:`<button class="btn btn-g" data-x>Annuler</button><button class="btn btn-p${danger?' kc-btn-danger':''}" data-ok>${esc(ok)}</button>`,
      onOk(){done=true;res(true);},onClose(){if(!done)res(false);},
      onOpen(bg){bg.classList.add('kc-dlg-small');setTimeout(()=>{const b=bg.querySelector('[data-ok]');if(b)b.focus();},40);}});
  });
};
window.kcPrompt=function(msg,def,o){
  o=o||{};
  return new Promise(res=>{
    if(typeof window.kcDlg!=='function'){res(window.prompt(msg,def==null?'':def));return;}
    let done=false;
    window.kcDlg({title:String(msg).replace(/\s*:\s*$/,''),icon:o.icon||'edit',
      body:`<input class="fi kc-dlg-in" id="kc-prompt-in" value="${esc(def==null?'':def)}" maxlength="${o.max||200}" autocomplete="off">`,
      foot:`<button class="btn btn-g" data-x>Annuler</button><button class="btn btn-p" data-ok>${esc(o.ok||'OK')}</button>`,
      onOk(bg){done=true;res(bg.querySelector('#kc-prompt-in').value);},onClose(){if(!done)res(null);},
      onOpen(bg){bg.classList.add('kc-dlg-small');setTimeout(()=>{const i=bg.querySelector('#kc-prompt-in');if(i){i.focus();i.select();}},40);}});
  });
};
window.kcAlert=function(msg){
  return new Promise(res=>{
    if(typeof window.kcDlg!=='function'){window.alert(msg);res();return;}
    const p=split(msg);
    window.kcDlg({title:p.t,icon:'info',body:p.s?`<p class="kc-dlg-msg">${esc(p.s)}</p>`:'',foot:'<button class="btn btn-p" data-ok>OK</button>',
      onOk(){},onClose(){res();},onOpen(bg){bg.classList.add('kc-dlg-small');}});
  });
};

/* ───────── 2. Annuler une suppression ───────── */
const UL=[['matière','matières'],['dossier','dossiers'],['cours','cours'],['question','questions'],['carte','cartes'],['dossier de cartes','dossiers de cartes'],['carte','cartes']];
let undoT=0;
function undoHide(){const el=$('kc-undo');if(el){el.classList.remove('on');setTimeout(()=>{if(!el.classList.contains('on'))el.remove();},250);}clearTimeout(undoT);}
window.kcUndoOffer=function(u){
  const parts=[];
  u.before.forEach((n,i)=>{const d=n-u.after[i];if(d>0)parts.push(d+' '+UL[i][d>1?1:0]);});
  if(!parts.length)return;
  let el=$('kc-undo');
  if(!el){el=document.createElement('div');el.id='kc-undo';el.className='kc-undo';el.setAttribute('role','status');document.body.appendChild(el);}
  el.innerHTML=`<span class="ms">delete</span><span class="kc-undo-t">Supprimé : ${esc(parts.join(', '))}</span><button type="button" class="kc-undo-b"><span class="ms">undo</span>Annuler</button><button type="button" class="kc-undo-x" aria-label="Fermer"><span class="ms">close</span></button><i class="kc-undo-bar"></i>`;
  el.querySelector('.kc-undo-b').onclick=()=>{
    undoHide();
    let ok=false;try{ok=G('kcUndoRestore',null)(u)!==false;}catch(e){console.error(e);}
    refresh();
    if(typeof showNotif==='function')showNotif(ok?'Suppression annulée : tout est revenu':'Impossible d’annuler','ok');
  };
  el.querySelector('.kc-undo-x').onclick=undoHide;
  /* relance l'animation de la barre de temps */
  el.classList.remove('on');void el.offsetWidth;el.classList.add('on');
  clearTimeout(undoT);undoT=setTimeout(undoHide,9000);
};
function refresh(){ // réaffiche l'écran courant après un retour en arrière
  const sc=document.body.dataset.screen||'home';
  const tryFn=(n,...a)=>{try{const f=G(n,null);if(typeof f==='function'){f(...a);return true;}}catch(e){}return false;};
  if(sc==='fc-editor'){tryFn('fceReload');return;}
  if(sc==='all-flashcards'){if(!tryFn('renderAFCList'))tryFn('showScreen',sc);return;}
  if(sc==='folder'){const id=G('curF',null);if(id&&tryFn('openFolder',id))return;}
  if(sc==='course'){const id=G('curC',null);if(id&&tryFn('openCourse',id))return;}
  if(sc==='manage'){tryFn('renderManage');return;}
  tryFn('showScreen',sc);
  tryFn('renderHome');
}

/* ───────── 3. Cloche de notifications ───────── */
function dayKey(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12).toISOString().slice(0,10);}
function notifs(){
  const out=[],now=new Date(),tk=dayKey(now);
  /* flashcards en cours d'écriture */
  try{const o=JSON.parse(lsGet('kp_fce_open','null'));if(o&&o.key){const f=(G('conceptFolders',[])||[]).find(x=>x.id===o.key);if(f)out.push({id:'fce:'+o.key,ic:'edit_note',cls:'t-violet',t:'Flashcards à terminer',s:'« '+f.name+' » : reprends là où tu t’étais arrêté',go:()=>window.fceOpen&&window.fceOpen(o.key)});}}catch(e){}
  /* révisions du jour */
  let due=0;try{due=G('getDueCount',()=>0)()||0;}catch(e){}
  if(due)out.push({id:'fc:'+tk+':'+due,ic:'style',cls:'t-green',t:due+' carte'+(due>1?'s':'')+' à revoir',s:'Flashcards · répétition espacée',go:()=>{const f=G('startDueFlashcards',null);if(f)f();}});
  /* v72 : plus de « 1995 questions à revoir » (évident quand on révise beaucoup) → une petite révision du jour,
     les 20 questions les plus urgentes, sans les matières terminées (kcDailySRS, kc-v72.js) */
  let srs=[];try{srs=G('kcDailySRS',()=>[])()||[];}catch(e){}
  if(srs.length)out.push({id:'srs20:'+tk,ic:'my_location',cls:'t-rose',t:'Ta révision du jour : '+srs.length+' question'+(srs.length>1?'s':''),s:'Les plus urgentes à revoir · environ '+Math.max(2,Math.round(srs.length*0.4))+' min',go:()=>{const f=G('kcLaunchDailySRS',null);if(f)f();}});
  /* examens et évènements proches */
  try{
    const up=(G('_agUpcoming',()=>[])(tk)||[]),t0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    up.forEach(e=>{
      const [y,m,d]=e.date.split('-').map(Number),days=Math.round((new Date(y,m-1,d)-t0)/864e5);
      const exam=e.kind==='exam'||e.type==='examen';
      if(days<0||days>(exam?7:1))return;
      const when=days===0?'aujourd’hui':days===1?'demain':'dans '+days+' jours';
      out.push({id:'ag:'+e.date+':'+e.title+':'+days,ic:exam?'workspace_premium':'event',cls:exam?'t-violet':'t-orange',urgent:exam&&days<=3,
        t:(exam?'Examen ':'')+when+' : '+e.title,s:exam?(days<=3?'Dernière ligne droite : révise tes points faibles':'Pense à planifier tes révisions'):(e.time||'Dans ton agenda'),
        go:()=>{const f=G('showScreen',null);if(f)f('agenda');setTimeout(()=>{try{G('agSelect',null)(e.date);}catch(_){}} ,60);}});
    });
  }catch(e){}
  /* objectif du jour */
  try{
    const goal=G('dailyGoal',0)|0,doneQ=G('getTodayQ',()=>0)()|0;
    if(goal>0){
      const left=goal-doneQ;
      if(left<=0)out.push({id:'goal-ok:'+tk,ic:'task_alt',cls:'t-green',t:'Objectif du jour atteint',s:doneQ+' questions aujourd’hui. Bravo !',quiet:true});
      else if(doneQ>0&&left<=Math.max(3,Math.round(goal*.34)))out.push({id:'goal:'+tk+':'+left,ic:'flag',cls:'t-amber',t:'Plus que '+left+' question'+(left>1?'s':'')+' pour ton objectif',s:doneQ+' / '+goal+' faites aujourd’hui',go:()=>{const f=G('khStart',null)||G('startFlash',null);if(f)f();else{const s=G('showScreen',null);if(s)s('modes-hub');}}});
    }
  }catch(e){}
  /* série en danger (le soir, rien fait aujourd'hui) */
  try{
    const st=G('kcStreak',null),c=G('dailyCounts',{})||{};
    if(st){const s=st();if(s.cur>=2&&!(c[tk]>0)&&now.getHours()>=18)out.push({id:'streak:'+tk,ic:'local_fire_department',cls:'t-orange',urgent:true,t:'Ta série de '+s.cur+' jours tient à une question',s:'Fais au moins une question avant minuit',go:()=>{const f=G('showScreen',null);if(f)f('modes-hub');}});}
  }catch(e){}
  return out;
}
const seen=()=>{try{return JSON.parse(lsGet('kp_notif_seen','[]'))||[];}catch(e){return [];}};
function bell(){
  const b=$('kh-bell');if(!b)return;
  const s=seen(),n=notifs().filter(x=>!x.quiet&&s.indexOf(x.id)<0).length;
  let d=b.querySelector('.kc-bell-n');
  if(n){if(!d){d=document.createElement('i');d.className='kc-bell-n';b.appendChild(d);}d.textContent=n>9?'9+':n;}
  else if(d)d.remove();
  b.setAttribute('aria-label',n?n+' notification'+(n>1?'s':''):'Notifications');
}
function notifClose(){const p=$('kc-notif');if(p)p.remove();document.removeEventListener('mousedown',outside,true);document.removeEventListener('keydown',onKey,true);}
function outside(e){if(!e.target.closest('#kc-notif')&&!e.target.closest('#kh-bell'))notifClose();}
function onKey(e){if(e.key==='Escape'){e.stopPropagation();notifClose();}}
window.kcNotifOpen=function(ev){
  if(ev)ev.stopPropagation();
  if($('kc-notif')){notifClose();return;}
  const list=notifs(),s=seen(),b=$('kh-bell');
  const p=document.createElement('div');p.id='kc-notif';p.className='kc-notif';p.setAttribute('role','dialog');p.setAttribute('aria-label','Notifications');
  p.innerHTML=`<div class="kc-notif-h"><b>Notifications</b><button type="button" class="kc-notif-ag">Agenda<span class="ms">arrow_forward</span></button></div>
    <div class="kc-notif-l">${list.length?list.map((x,i)=>`<button type="button" class="kc-notif-i${x.urgent?' urgent':''}${s.indexOf(x.id)<0&&!x.quiet?' new':''}" data-i="${i}"><span class="kh-sq sm ${x.cls}"><span class="ms">${x.ic}</span></span><span class="kc-notif-b"><b>${esc(x.t)}</b><small>${esc(x.s||'')}</small></span>${x.go?'<span class="ms kc-notif-a">chevron_right</span>':''}</button>`).join('')
      :'<div class="kc-notif-e"><span class="ms">notifications_none</span><b>Rien à signaler</b><small>Tu es à jour. Les cartes à revoir, les examens proches et ton objectif s’afficheront ici.</small></div>'}</div>`;
  document.body.appendChild(p);
  if(b){const r=b.getBoundingClientRect(),w=p.offsetWidth;p.style.top=(r.bottom+10)+'px';p.style.left=Math.max(10,Math.min(innerWidth-w-10,r.right-w))+'px';}
  p.addEventListener('click',e=>{
    if(e.target.closest('.kc-notif-ag')){notifClose();const f=G('showScreen',null);if(f)f('agenda');return;}
    const it=e.target.closest('.kc-notif-i');if(!it)return;
    const x=list[+it.dataset.i];notifClose();if(x&&x.go)try{x.go();}catch(err){console.error(err);}
  });
  setTimeout(()=>{document.addEventListener('mousedown',outside,true);document.addEventListener('keydown',onKey,true);},0);
  lsPut('kp_notif_seen',JSON.stringify(list.map(x=>x.id).slice(0,40)));
  bell();
};

/* ───────── 4. Téléphone : menu des ajouts de la barre du haut ───────── */
function moreBtn(){
  const fr=document.querySelector('header.topbar .fr');if(!fr||$('kc-tb-more'))return;
  const b=document.createElement('button');b.type='button';b.id='kc-tb-more';b.className='ib kc-tb-more';b.setAttribute('aria-label','Mes raccourcis');
  b.innerHTML='<span class="ms">more_horiz</span>';b.style.order=90;
  b.addEventListener('click',e=>{e.stopPropagation();morePop(b);});
  fr.appendChild(b);
}
function morePop(btn){
  const old=$('kc-tb-morepop');if(old){old.remove();return;}
  const items=[...document.querySelectorAll('header.topbar .fr .kc-tb-w:not(.kc-tb-off),header.topbar .fr .kc-tb-x:not(.kc-tb-off)')].sort((a,b)=>(+a.style.order||0)-(+b.style.order||0));
  const p=document.createElement('div');p.id='kc-tb-morepop';p.className='kc-notif kc-morepop';
  p.innerHTML=`<div class="kc-notif-l">${items.map((el,i)=>{const ic=el.querySelector('.ms'),v=el.querySelector('b');return `<button type="button" class="kc-notif-i" data-i="${i}"><span class="kh-sq sm"><span class="ms">${esc(ic?ic.textContent:'star')}</span></span><span class="kc-notif-b"><b>${esc(el.dataset.tooltip||el.getAttribute('aria-label')||'')}</b>${v&&v.textContent?`<small>${esc(v.textContent)}</small>`:''}</span></button>`;}).join('')}</div>`;
  document.body.appendChild(p);
  const r=btn.getBoundingClientRect(),w=p.offsetWidth;p.style.top=(r.bottom+10)+'px';p.style.left=Math.max(10,Math.min(innerWidth-w-10,r.right-w))+'px';
  const close=e=>{if(e&&e.target.closest&&e.target.closest('#kc-tb-morepop'))return;p.remove();document.removeEventListener('mousedown',close,true);};
  p.addEventListener('click',e=>{const it=e.target.closest('.kc-notif-i');if(!it)return;const el=items[+it.dataset.i];p.remove();document.removeEventListener('mousedown',close,true);if(el)el.click();});
  setTimeout(()=>document.addEventListener('mousedown',close,true),0);
}

/* ───────── 5. Brouillon de l'ajout rapide ───────── */
const DK='kp_fcx_draft';
function draftSave(){const f=$('fcx-front'),b=$('fcx-back');if(!f||!b)return;if(f.value||b.value)lsPut(DK,JSON.stringify({f:f.value,b:b.value}));else lsPut(DK,null);}
function draftRestore(){
  const f=$('fcx-front'),b=$('fcx-back');if(!f||!b||f.value||b.value)return;
  let d=null;try{d=JSON.parse(lsGet(DK,'null'));}catch(e){}
  if(d&&(d.f||d.b)){f.value=d.f||'';b.value=d.b||'';}
}
document.addEventListener('input',e=>{const t=e.target;if(t&&(t.id==='fcx-front'||t.id==='fcx-back'))draftSave();});
function wrapQuick(){
  const o=window.fcxQuickAdd;if(typeof o!=='function'||o._kd)return;
  const w=function(){const r=o.apply(this,arguments);setTimeout(draftSave,0);return r;};w._kd=true;window.fcxQuickAdd=w;
}

/* ───────── 6. Mise en page dans le compte ───────── */
const LK='kp_layout2',LAT='kp_layout2_at';
let pushT=0,syncedFor=null,applying=false;
function session(){const s=G('_sbSession',null);return s&&s.user?s:null;}
window.kcLayoutPush=function(){
  if(applying)return;
  clearTimeout(pushT);
  pushT=setTimeout(async()=>{
    const s=session(),sb=G('_sb',null);if(!s||!sb)return;
    const raw=lsGet(LK,'');if(!raw||raw.length>7000)return;   /* trop gros pour le compte : reste sur l'appareil */
    try{await sb.auth.updateUser({data:{kp_layout2:JSON.parse(raw),kp_layout2_at:+lsGet(LAT,'0')||Date.now()}});}catch(e){console.warn('[mise en page] envoi',e);}
  },2500);
};
function layoutSync(){
  const s=session();if(!s||syncedFor===s.user.id)return;
  syncedFor=s.user.id;
  const md=s.user.user_metadata||{},rAt=+md.kp_layout2_at||0,lAt=+lsGet(LAT,'0')||0,local=lsGet(LK,'');
  if(md.kp_layout2&&typeof md.kp_layout2==='object'&&rAt>lAt){
    const raw=JSON.stringify(md.kp_layout2);
    if(raw!==local){
      applying=true;
      lsPut(LK,raw);lsPut(LAT,String(rAt));
      try{if(window.kcLayoutApplyAll)window.kcLayoutApplyAll();}catch(e){}
      applying=false;
      if(local&&typeof showNotif==='function')showNotif('Mise en page de ton compte appliquée','ok');
    }else lsPut(LAT,String(rAt));
  }else if(local&&lAt>rAt)window.kcLayoutPush();
  else if(local&&!md.kp_layout2){lsPut(LAT,String(Date.now()));window.kcLayoutPush();}
}

/* ───────── 7. Espace utilisé (Paramètres > Sauvegarde) ───────── */
function fmt(b){return b>=1073741824?(b/1073741824).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Go':(b/1048576).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+' Mo';}
window.kcStorageLine=function(){
  const el=$('kc-store-line');if(!el||!window.KStore)return;
  KStore.usage().then(u=>{
    const used=(u.ls+u.big)*2;
    el.innerHTML=KStore.ok
      ?`<span class="ms">hard_drive</span><span>Tes données : <b>${fmt(used)}</b>${u.quota?` · place disponible sur cet appareil : <b>${fmt(Math.max(0,u.quota-u.usage))}</b>`:''}. Les gros contenus (questions, photos des flashcards, ville…) sont rangés sur le disque : plus de « mémoire pleine ».</span>`
      :`<span class="ms">warning</span><span>Tes données : <b>${fmt(used)}</b> sur environ 5 Mo. La grande mémoire n’est pas disponible dans ce navigateur (navigation privée ?).</span>`;
  });
};

/* ───────── Démarrage ───────── */
function onScreen(){
  const sc=document.body.dataset.screen||'';
  if(sc==='home')bell();
  if(sc==='all-flashcards')setTimeout(draftRestore,120);
  if(sc==='manage')setTimeout(window.kcStorageLine,150);
  notifClose();
}
function start(){
  moreBtn();wrapQuick();
  try{new MutationObserver(onScreen).observe(document.body,{attributes:true,attributeFilter:['data-screen']});}catch(e){}
  setTimeout(()=>{bell();draftRestore();wrapQuick();},700);
  setInterval(()=>{if(document.body.dataset.screen==='home'&&!document.hidden)bell();},60000);
  setInterval(layoutSync,3000);
  document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.mg-tab,[onclick*="mgTab"]'))setTimeout(window.kcStorageLine,200);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
