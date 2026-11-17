/* =========================================================
   home-cobalt.js — accueil « Cobalt » (Claude Design, 15 nov. 2026)
   Remplit #screen-home .kh avec les vraies données :
   objectif du jour, reprise de session, niveau / XP, série, semaine,
   modes, calendrier de régularité (dailyCounts), matières à renforcer
   (diffData), prochaines révisions (agenda + répétition espacée), Ma ville.
   Se branche sur renderHome() / gamRefreshUI() / showScreen() sans les modifier.
   Script classique (le site s'ouvre aussi en file://).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString('fr-FR');
const MONTHS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const WD=['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'];
const LEVELS=['aucune révision','1 à 10 questions','11 à 25 questions','26 à 50 questions','plus de 50 questions'];
const DAYS=['L','M','M','J','V','S','D'];
/* Monuments débloqués par niveau (même liste que BLD dans city-game.js) */
const MONUMENTS=[
  {lvl:3,name:'Statue du Kiné d’or',icon:'emoji_events'},
  {lvl:5,name:'Faculté de kiné',icon:'school'},
  {lvl:8,name:'Centre de rééducation',icon:'self_improvement'},
  {lvl:12,name:'Piscine olympique',icon:'pool'},
  {lvl:16,name:'Stade',icon:'stadium'},
  {lvl:20,name:'Tour City Work',icon:'apartment'},
  {lvl:25,name:'CHU',icon:'emergency'},
  {lvl:30,name:'Observatoire',icon:'travel_explore'},
  {lvl:35,name:'Arc du Diplôme',icon:'castle'}
];
const AG_LOOK={cours:['school','t-sky'],examen:['workspace_premium','t-violet'],stage:['medical_services','t-green'],
  revision:['menu_book','t-green'],perso:['favorite','t-rose'],autre:['event','t-orange']};

/* Clé AAAA-MM-JJ comme data.js (toISOString) : on prend midi heure locale pour tomber sur le bon jour */
function dkey(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12).toISOString().slice(0,10);}
function counts(){try{return (typeof dailyCounts!=='undefined'&&dailyCounts)||{};}catch(e){return {};}}
function g(name){try{return eval(name);}catch(e){return undefined;}} /* lit une variable globale « let » d'un autre script */

function fmtMin(s){
  s=s|0;
  if(s>=3600)return Math.floor(s/3600)+' h '+String(Math.floor(s%3600/60)).padStart(2,'0');
  return Math.round(s/60)+' min';
}
function bars(id,pct,color){const el=$(id);if(!el)return;el.style.setProperty('--v',Math.max(0,Math.min(100,pct))+'%');if(color)el.style.setProperty('--bar-c',color);}

/* Série = jours de révision d'affilée (aujourd'hui compte s'il y a eu des questions, sinon on part d'hier) */
function streaks(){ /* v70 : un seul calcul pour tout le site → kcStreakSync() dans data.js */
  try{if(typeof kcStreakSync==='function')return kcStreakSync();}catch(e){}
  return {cur:0,best:0};
}
window.khStreaks=streaks;/* utilisé par l'info « Série » de la barre du haut (kc-layout.js) */

/* ---------- En-tête ---------- */
function renderHead(st){
  const dt=$('kh-date');if(dt)dt.textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  /* 16 nov. 2026 : le pseudo choisi dans le profil (kp_firstname) en priorité */
  let name='Étudiant';
  try{name=(localStorage.getItem('kp_firstname')||'').trim()||(typeof gamDisplayName==='function'?gamDisplayName():'')||name;}catch(e){}
  name=String(name).trim();if(name.length>28)name=name.slice(0,28)+'…';
  $('kh-name').textContent=name;
  const hh=new Date().getHours(),hel=$('kh-hello');if(hel)hel.textContent=hh>=18||hh<5?'Bonsoir':'Bonjour';
  $('kh-chip-streak').textContent=st.cur+' jour'+(st.cur>1?'s':'');
  const gm=g('gam');
  $('kh-chip-xp').textContent=nf(gm?gm.xp:0);
  const av=$('kh-avatar');
  if(av){
    if(gm&&typeof gamAvatarSVG==='function'){try{av.innerHTML=gamAvatarSVG(gm.char,44);}catch(e){av.textContent=name.charAt(0).toUpperCase();}}
    else av.textContent=name.charAt(0).toUpperCase();
  }
  syncThemeBtn();
}
function syncThemeBtn(){
  const b=$('kh-theme-btn');if(!b)return;
  const dark=document.body.classList.contains('dark');
  b.querySelector('.ms').textContent=dark?'light_mode':'dark_mode';
  b.setAttribute('aria-label',dark?'Passer en mode clair':'Passer en mode sombre');
}

/* ---------- Objectif du jour + reprise ---------- */
function renderGoal(){
  const done=typeof getTodayQ==='function'?getTodayQ():0;
  const total=Math.max(1,g('dailyGoal')||10);
  $('kh-goal-done').textContent=done;
  $('kh-goal-total').textContent=total;
  const n=Math.min(total,20),on=Math.min(n,Math.round(Math.min(done,total)/total*n));
  const segs=$('kh-segs');
  segs.innerHTML=Array.from({length:n},(_,i)=>`<div class="kh-seg${i<on?' on':''}"></div>`).join('');
  segs.classList.toggle('done',done>=total);
  segs.setAttribute('aria-valuenow',done);segs.setAttribute('aria-valuemax',total);
  $('kh-goal-label').textContent=done>=total?'Objectif atteint':'Objectif du jour';

  const st=g('stats')||{};
  const secs=st.todayDate===new Date().toDateString()?(st.todaySecs||0):0;
  $('kh-goal-time').textContent=fmtMin(secs);
  const tk=dkey(new Date());
  const ss=(g('sessionHistory')||[]).filter(s=>s.date===tk);
  const tot=ss.reduce((a,s)=>a+(s.total||0),0),cor=ss.reduce((a,s)=>a+(s.correct||0),0);
  $('kh-goal-acc').textContent=tot?Math.round(cor/tot*100)+' % de réussite':'– de réussite';
  const gm=g('gam');
  const xpToday=gm&&gm.today&&typeof gamDayKey==='function'&&gm.today.date===gamDayKey()?gm.today.xp:0;
  $('kh-goal-xp').textContent='+'+nf(xpToday)+' XP';

  // Reprise d'une session interrompue (renderHome → checkResumeSession a déjà nettoyé kcu_resume)
  const banner=$('resume-banner');
  let data=null;
  if(banner&&banner.style.display==='flex'){try{data=JSON.parse(localStorage.getItem('kcu_resume')||'null');}catch(e){}}
  const ic=$('kh-resume-ic'),ti=$('kh-resume-title'),sub=$('kh-resume-sub'),act=$('kh-resume-actions');
  if(data&&data.qids){
    ic.textContent='history';
    ti.textContent=($('rh-title')||{}).textContent||data.label||'Session en cours';
    sub.textContent=`Session interrompue à la question ${Math.min(data.qids.length,(data.cur|0)+1)} sur ${data.qids.length}`;
    act.innerHTML=`<button class="kh-btn kh-btn-p" type="button" onclick="resumeSession()">Reprendre<span class="ms">arrow_forward</span></button>`
      +`<button class="kh-btn kh-btn-s" type="button" onclick="dismissResume();startFlash()">Nouvelle session</button>`;
  }else{
    const rem=total-done;
    ic.textContent=done>=total?'task_alt':'bolt';
    ti.textContent=done>=total?'Journée validée, bravo !':(done?'On continue ?':'Prêt pour aujourd’hui ?');
    sub.textContent=done>=total?'Continue sur ta lancée avec une révision ciblée.':`Plus que ${rem} question${rem>1?'s':''} pour valider ta journée`;
    act.innerHTML=`<button class="kh-btn kh-btn-p" type="button" onclick="startFlash()">${done?'Continuer':'Commencer'}<span class="ms">arrow_forward</span></button>`
      +`<button class="kh-btn kh-btn-s" type="button" onclick="startCiblé()">Révision ciblée</button>`;
  }
}

/* ---------- Progression ---------- */
function renderProgress(st){
  const gm=g('gam');
  const info=gm&&typeof gamLevelInfo==='function'?gamLevelInfo(gm.xp):{level:1,into:0,need:60,toNext:60,pct:0};
  $('kh-level').textContent='Niveau '+info.level;
  $('kh-xp-into').textContent=nf(info.into);
  $('kh-xp-need').textContent=nf(info.need);
  $('kh-xp-next').textContent=`Niv. ${info.level+1} dans ${nf(info.toNext)} XP`;
  bars('kh-xp-bar',Math.round(info.pct*100));
  $('kh-streak').textContent=st.cur;
  $('kh-best').textContent=st.best;

  // 3e statistique : classement entre amis s'il est connu, sinon réussite globale
  let rank=null;
  try{const lb=g('_soc')&&g('_soc').lb;const rows=lb&&lb.rows;const me=rows&&rows.find(r=>r.is_me);if(me&&me.rank)rank={r:me.rank,n:rows.length};}catch(e){}
  const s3=$('kh-stat3');
  if(rank){
    s3.innerHTML=`<span class="kh-stat-label t-sky"><span class="ms f kh-ic">group</span>Classement</span><span class="kh-stat-value"><span class="kh-num">${rank.r}</span>${rank.r===1?'re':'e'} <small>/ ${rank.n}</small></span>`;
  }else{
    let att=0,err=0;try{Object.values(g('diffData')||{}).forEach(d=>{att+=d.attempts||0;err+=d.errors||0;});}catch(e){}
    s3.innerHTML=`<span class="kh-stat-label t-green"><span class="ms f kh-ic">check_circle</span>Réussite</span><span class="kh-stat-value"><span class="kh-num">${att?Math.round((1-err/att)*100):'–'}</span>${att?' %':''}</span>`;
  }

  const wk=typeof getDailyWeek==='function'?getDailyWeek(0):[0,0,0,0,0,0,0];
  const ti=(new Date().getDay()+6)%7;
  $('kh-week').innerHTML=wk.map((v,k)=>{
    let cls,inner='';
    if(k<ti){cls=v>0?'done':'miss';if(v>0)inner='<span class="ms">check</span>';}
    else if(k===ti){cls='today'+(v>0?'':' idle');inner='<span class="ms f">local_fire_department</span>';}
    else cls='future';
    return `<div class="kh-day ${cls}" title="${v} question${v>1?'s':''}"><div class="kh-day-dot">${inner}</div>${DAYS[k]}</div>`;
  }).join('');
}

/* ---------- Modes ---------- */
function renderModes(){
  const best=g('bestSurvivalStreak')|0;
  /* v71 : les tuiles sont choisies par l'utilisateur (kc-shortcuts.js) → elles peuvent être absentes */
  if(!$('kh-surv-desc')||!$('kh-fc-desc')){if(window.kcShortcutsRender)kcShortcutsRender();return;}
  $('kh-surv-desc').textContent=best?`3 vies · ton record : ${best}`:'3 vies · bats ton record';
  const due=typeof getDueCount==='function'?getDueCount():0;
  let total=0;try{total=(g('flashcards')||[]).length+(g('concepts')||[]).length;}catch(e){}
  $('kh-fc-desc').textContent=due?`${due} carte${due>1?'s':''} à revoir aujourd’hui`:total?`${nf(total)} cartes · rien à revoir aujourd’hui`:'Crée tes premières cartes';
}

/* ---------- Activité (remplace la grille « Régularité », 15 nov. 2026) ----------
   Barres par jour (7 j / 30 j) ou par semaine (3 mois), ligne pointillée = objectif du jour. */
const DSHORT=['L','M','M','J','V','S','D'];
let _actRange=(function(){try{return localStorage.getItem('kh_act_range')||'30';}catch(e){return '30';}})();
window.khActRange=function(r){_actRange=r;try{localStorage.setItem('kh_act_range',r);}catch(e){}renderActivity();};
function renderActivity(){
  const box=$('kh-act');if(!box)return;
  const c=counts(),today=new Date();today.setHours(12,0,0,0);
  const goal=Math.max(1,g('dailyGoal')||10);
  const weekly=_actRange==='90';
  const items=[];
  if(!weekly){
    const n=_actRange==='7'?7:30;
    for(let i=n-1;i>=0;i--){
      const dt=new Date(today);dt.setDate(today.getDate()-i);
      const v=c[dkey(dt)]||0,dow=(dt.getDay()+6)%7;
      const lbl=n===7?DSHORT[dow]:((i%5===0)?String(dt.getDate()):'');
      items.push({v,lbl,tip:`${dt.getDate()} ${MONTHS[dt.getMonth()]} · ${v} question${v>1?'s':''}`,today:i===0,ok:v>=goal});
    }
  }else{
    const dow=(today.getDay()+6)%7;
    for(let w=12;w>=0;w--){
      const mon=new Date(today);mon.setDate(today.getDate()-dow-7*w);
      let v=0;for(let d=0;d<7;d++){const dt=new Date(mon);dt.setDate(mon.getDate()+d);if(dt<=today)v+=c[dkey(dt)]||0;}
      items.push({v,lbl:(w%3===0)?`${mon.getDate()} ${MONTHS[mon.getMonth()]}`:'',tip:`Semaine du ${mon.getDate()} ${MONTHS[mon.getMonth()]} · ${v} question${v>1?'s':''}`,today:w===0,ok:v>=goal*5});
    }
  }
  const ref=weekly?goal*7:goal;
  const max=Math.max(ref*1.15,...items.map(x=>x.v),1);
  box.innerHTML=`<div class="kh-act-goal" style="bottom:${(ref/max*100).toFixed(1)}%"><span>${weekly?'objectif × 7':'objectif'} ${nf(ref)}</span></div>`+
    items.map(x=>`<div class="kh-act-col${x.today?' today':''}" title="${x.tip}"><div class="kh-act-bar${x.v?'':' zero'}${x.ok?' ok':''}" style="height:${x.v?Math.max(4,x.v/max*100).toFixed(1):0}%"></div><span>${x.lbl}</span></div>`).join('');
  box.classList.toggle('dense',items.length>14);
  // Chiffres sur la période
  const days=weekly?91:(_actRange==='7'?7:30);
  let act=0,tot=0,best=0,hit=0;
  for(let i=0;i<days;i++){const dt=new Date(today);dt.setDate(today.getDate()-i);const v=c[dkey(dt)]||0;if(v){act++;tot+=v;}if(v>best)best=v;if(v>=goal)hit++;}
  $('kh-act-stats').innerHTML=[
    [act+' / '+days,'jours actifs'],[nf(tot),'questions'],[act?nf(Math.round(tot/act)):'0','par jour actif'],[hit,'objectifs atteints']
  ].map(([v,l])=>`<div><b class="kh-num">${v}</b><span>${l}</span></div>`).join('');
  document.querySelectorAll('[data-act-range]').forEach(b=>b.classList.toggle('on',b.dataset.actRange===_actRange));
}

/* ---------- À renforcer : 3 matières au plus faible taux de réussite ---------- */
let _weakIds=[];
function renderWeak(){
  const el=$('kh-subjects');if(!el)return;
  const fs=(g('folders')||[]).filter(f=>f.type!=='annales'&&!f.isAnnale&&!(typeof isFolderArchived==='function'&&isFolderArchived(f.id)));
  const cs=g('courses')||[],qs=g('questions')||[],dd=g('diffData')||{};
  const byCourse={};cs.forEach(c=>{byCourse[c.id]=c.folderId;});
  const agg={};
  qs.forEach(q=>{
    if(typeof isBoycotted==='function'&&isBoycotted(q.id))return;
    const fid=byCourse[q.courseId];if(!fid)return;
    const a=agg[fid]||(agg[fid]={n:0,att:0,err:0,hard:0});
    a.n++;const d=dd[q.id];
    if(d){a.att+=d.attempts||0;a.err+=d.errors||0;}
    if(typeof getDiff==='function'&&getDiff(q.id)==='hard')a.hard++;
  });
  const rows=fs.map(f=>{const a=agg[f.id];if(!a||a.att<10)return null;return {f,a,pct:Math.round((1-a.err/a.att)*100)};})
    .filter(Boolean).sort((x,y)=>x.pct-y.pct).slice(0,3);
  _weakIds=rows.map(r=>r.f.id);
  const cta=$('kh-weak-cta');
  if(!rows.length){
    el.innerHTML='<div class="kh-empty">Réponds à quelques questions : tes matières les plus fragiles apparaîtront ici.</div>';
    if(cta)cta.style.display='none';return;
  }
  if(cta)cta.style.display='';
  el.innerHTML=rows.map(r=>{
    const col=r.pct<50?'var(--c-rose)':r.pct<60?'var(--c-orange)':r.pct<70?'var(--c-amber)':'var(--c-green)';
    return `<div class="kh-subject" onclick="openFolder('${esc(r.f.id)}')" title="Ouvrir ${esc(r.f.name)}">
      <div class="kh-subject-top"><span class="kh-subject-name">${esc(r.f.name)}</span><span class="kh-subject-pct">${r.pct} %</span></div>
      <div class="kh-bar"><span style="--v:${r.pct}%;--bar-c:${col}"></span></div>
      <span class="kh-subject-meta">${nf(r.a.n)} question${r.a.n>1?'s':''} · ${r.a.hard} difficile${r.a.hard>1?'s':''}</span>
    </div>`;
  }).join('');
}

/* ---------- Prochaines révisions ---------- */
function renderAgenda(){
  const el=$('kh-agenda');if(!el)return;
  const today=new Date(),tk=(typeof _agKey==='function')?_agKey(today):dkey(today);
  const items=[];
  const due=typeof getDueCount==='function'?getDueCount():0;
  if(due)items.push({today:true,d:today,icon:'style',cls:'t-green',title:'Flashcards à revoir',sub:`${due} carte${due>1?'s':''} · répétition espacée`,go:'startDueFlashcards()'});
  let srs=0;try{srs=typeof getSRSDueQuestions==='function'?getSRSDueQuestions().length:0;}catch(e){}
  if(srs)items.push({today:true,d:today,icon:'my_location',cls:'t-rose',title:'Questions à revoir',sub:`${srs} question${srs>1?'s':''} · répétition espacée`,go:'launchSRS()'});
  let up=[];try{up=typeof _agUpcoming==='function'?_agUpcoming(tk):[];}catch(e){}
  up.forEach(e=>{
    const [y,m,d]=e.date.split('-').map(Number),dt=new Date(y,m-1,d);
    const look=AG_LOOK[e.type]||AG_LOOK.autre;
    const typeName=(typeof _agType==='function'?_agType(e.type).name:'')||'';
    const days=Math.round((dt-new Date(today.getFullYear(),today.getMonth(),today.getDate()))/864e5);
    items.push({today:e.date===tk,d:dt,icon:look[0],cls:look[1],title:e.title,sub:e.kind==='exam'?'Examen · compte à rebours':typeName,
      right:e.kind==='exam'?`<span class="kh-badge">${days<=0?'Auj.':'J-'+days}</span>`:(e.time?`<span class="kh-agenda-time">${esc(e.time)}</span>`:''),
      go:`showScreen('agenda');setTimeout(()=>{try{agSelect('${e.date}')}catch(_){}} ,50)`});
  });
  const list=items.slice(0,4);
  if(!list.length){
    el.innerHTML='<div class="kh-empty">Rien de prévu pour l’instant. Ajoute tes cours, stages et examens dans l’agenda.</div>';return;
  }
  el.innerHTML=list.map(it=>`<div class="kh-agenda-item${it.today?' is-today':''}" onclick="${it.go.replace(/"/g,'&quot;')}">
      <div class="kh-agenda-date"><div class="kh-agenda-day">${it.today?'Auj.':WD[it.d.getDay()]}</div><div class="kh-agenda-num">${it.d.getDate()}</div></div>
      <div class="kh-sq sm ${it.cls}"><span class="ms">${it.icon}</span></div>
      <div class="kh-agenda-body"><div class="kh-agenda-title">${esc(it.title)}</div><div class="kh-agenda-sub">${esc(it.sub)}</div></div>
      ${it.right||''}
    </div>`).join('');
}

/* ---------- Ma ville (16 nov. 2026 : scène vivante dessinée par kc-home-plus.js) ---------- */
function renderCity(){
  const gm=g('gam');const xp=gm?gm.xp|0:0;
  const lv=typeof gamLevelFromXP==='function'?gamLevelFromXP(xp):1;
  let meta=null;try{meta=JSON.parse(localStorage.getItem('kcu_city_meta')||'null');}catch(e){}
  $('kh-city-title').textContent=(meta&&meta.name)||'Ma ville';
  const pop=meta?meta.pop|0:0;
  $('kh-city-pop').textContent=pop?nf(pop)+' habitant'+(pop>1?'s':''):'';
  const next=MONUMENTS.find(m=>m.lvl>lv);
  let nx=null;
  if(!next){$('kh-city-next').textContent='Tous les monuments sont débloqués';bars('kh-city-bar',100);}
  else{
    const prev=MONUMENTS.filter(m=>m.lvl<=lv).pop();
    const cum=typeof gamCumXP==='function'?gamCumXP:(L=>60*(L-1)+20*(L-1)*(L-2));
    const a=cum(prev?prev.lvl:1),b=cum(next.lvl);
    const pct=Math.max(0,Math.min(99,Math.round((xp-a)/Math.max(1,b-a)*100)));
    $('kh-city-next').textContent=`${next.name} : encore ${nf(b-xp)} XP`;
    bars('kh-city-bar',pct);
    nx={icon:next.icon,pct,name:next.name};
  }
  if(typeof window.kcCityScene==='function')window.kcCityScene({pop,lv,next:nx});
}

/* ---------- Rendu complet ---------- */
function render(){
  if(!$('kh-segs'))return;
  const st=streaks();
  const parts=[()=>renderHead(st),renderGoal,()=>renderProgress(st),renderModes,renderActivity,renderWeak,renderAgenda,renderCity];
  parts.forEach(fn=>{try{fn();}catch(e){console.warn('[home-cobalt]',e);}});
}
let _t=null;
function soon(){clearTimeout(_t);_t=setTimeout(render,40);}
window.khRender=render;

/* ---------- Actions ---------- */
window.khToggleTheme=function(){
  const dark=document.body.classList.contains('dark');
  if(typeof selectTheme==='function')selectTheme(dark?'cobalt':'cobalt-dark');
  syncThemeBtn();
};
window.khEditGoal=function(){
  if(typeof window.kcGoalDialog==='function'){window.kcGoalDialog();return;}
  const cur=g('dailyGoal')||10;
  const v=prompt('Combien de questions par jour ?',cur);
  if(v==null)return;
  const n=parseInt(v,10);
  if(!n||n<1){if(typeof showNotif==='function')showNotif('Entre un nombre de questions (1 à 500).','err');return;}
  try{dailyGoal=Math.max(1,Math.min(500,n));}catch(e){}
  if(typeof saveAll==='function')saveAll();
  if(typeof showNotif==='function')showNotif(`Objectif mis à jour : ${Math.max(1,Math.min(500,n))} questions/jour ✓`,'ok');
  if(typeof renderHome==='function')renderHome();
};
window.khFlashcards=function(){
  const due=typeof getDueCount==='function'?getDueCount():0;
  if(due&&typeof startDueFlashcards==='function')startDueFlashcards();
  else if(typeof openAllFlashcards==='function')openAllFlashcards();
};
window.khTargeted=function(){
  if(!_weakIds.length){if(typeof startCiblé==='function')startCiblé();return;}
  const cs=(g('courses')||[]).filter(c=>_weakIds.includes(c.folderId)).map(c=>c.id);
  const all=(g('questions')||[]).filter(q=>cs.includes(q.courseId)&&!(typeof isBoycotted==='function'&&isBoycotted(q.id)));
  let qs=all.filter(q=>{const d=typeof getDiff==='function'?getDiff(q.id):'';return d==='hard'||d==='medium'||d==='new';});
  if(qs.length<10)qs=all;
  if(!qs.length){if(typeof showNotif==='function')showNotif('Aucune question dans ces matières.','err');return;}
  try{rBack='home';}catch(e){}
  launchS(shuffle(qs).slice(0,30),'Révision ciblée',false,false,true,false,false);
};

/* ---------- Barre du bas : onglet actif selon l'écran ---------- */
const NAV={home:'nav-home','modes-hub':'nav-modes',agenda:'nav-agenda',social:'nav-social',friends:'nav-social','friend-profile':'nav-social',city:'nav-city'};
/* Menu de gauche : sur un sous-écran, la rubrique parente reste surlignée (on sait où on est) */
const PARENT={'fc-editor':'all-flashcards',matiere:'matieres-hub',subfolder:'matieres-hub',course:'matieres-hub',fiche:'matieres-hub','matiere-options':'matieres-hub',
  annales:'annales-hub',profil:'profil-hub',stats:'profil-hub',manage:'profil-hub',heatmap:'profil-hub',
  concepts:'all-flashcards','concept-fc':'all-flashcards',plan:'partiels',friends:'social','friend-profile':'social',
  'mindmap-editor':'mindmap','imaging-session':'outils','audio-folder':'outils',braindump:'matieres-hub',
  ultra:'outils',atelier:'outils',prompts:'outils',imaging:'outils',audio:'outils'};
const BN_PARENT={matiere:'nav-modes',subfolder:'nav-modes',course:'nav-modes',annales:'nav-modes','annales-hub':'nav-modes','matieres-hub':'nav-modes'};
function syncSide(id){
  const links=document.querySelectorAll('.dl-nav a[data-nav]');
  if([...links].some(a=>a.classList.contains('dl-active')))return;
  const p=PARENT[id];if(!p)return;
  links.forEach(a=>a.classList.toggle('dl-active',a.dataset.nav===p));
}
function syncBnav(id){
  const target=NAV[id]||BN_PARENT[id];
  if(!target)return;
  document.querySelectorAll('.bnav .ni').forEach(n=>n.classList.toggle('active',n.id===target));
}

/* ---------- Branchements ---------- */
const oRH=window.renderHome;
if(typeof oRH==='function')window.renderHome=function(){const r=oRH.apply(this,arguments);soon();return r;};
const oGR=window.gamRefreshUI;
if(typeof oGR==='function')window.gamRefreshUI=function(){const r=oGR.apply(this,arguments);if(document.body.dataset.screen==='home')soon();return r;};
const oSS=window.showScreen;
if(typeof oSS==='function')window.showScreen=function(id){const r=oSS.apply(this,arguments);try{syncBnav(id);syncSide(id);}catch(e){}return r;};
const oAT=window.applyTheme;
if(typeof oAT==='function')window.applyTheme=function(){const r=oAT.apply(this,arguments);try{syncThemeBtn();}catch(e){}return r;};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,80));
else setTimeout(render,80);
})();
