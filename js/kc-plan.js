/* =========================================================
   kc-plan.js — v85 (21 nov. 2026) : PLANNING AUTOMATIQUE AVANT UN EXAMEN
   - Examens = ceux de « Mes échéances » (getExamsV2 / saveExamsV2, ui.js : {id,name,date,folderIds}).
   - Réglages du planning par examen : kp_plans {examId:{on, perDay:'auto'|n}} ; suivi kp_plan_log {examId:{'AAAA-MM-JJ':n}}.
   - Programme recalculé chaque jour (si un jour est raté, le reste se répartit tout seul) :
       · jours d'apprentissage : les cours les plus faibles d'abord (taux d'erreur, puis jamais vus), répartis jour par jour ;
       · les 3 derniers jours : révision générale (erreurs + questions de tous les cours) ;
       · questions par jour : auto = (questions pas encore acquises) / (jours restants − 3), entre 10 et 150, ou fixe.
   - Remplace « Ta révision du jour » (kcDailySRS / kcLaunchDailySRS de kc-v72.js) quand un planning est actif :
     accueil (home-cobalt.js), cloche (kc-polish.js), content.js. kcPlanLabel() donne le titre.
   - kcRevisionWeek() : {exam, days} si un examen tombe dans les 7 prochains jours (mode révision de « Ma ville »).
   - Fenêtre : kcPlanOpen(examId?) ; boutons dans Mes partiels, l'agenda et « Mes échéances ».
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const J=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const JS=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
function G(n,d){try{const v=eval(n);return v===undefined?d:v;}catch(e){return d;}}
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};
const pad=n=>String(n).padStart(2,'0');
const dk=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const day0=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
const parseD=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,(m||1)-1,d||1);};
const WD=['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'],MO=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const FINAL=3;   /* jours de révision générale à la fin */

function exams(){try{return typeof getExamsV2==='function'?getExamsV2():[];}catch(e){return [];}}
function daysTo(ex){return Math.round((parseD(ex.date)-day0(new Date()))/864e5);}
function plans(){return J('kp_plans',{});}
function cfg(id){const p=plans()[id]||{};return {on:p.on!==false,perDay:p.perDay||'auto'};}
function setCfg(id,o){const p=plans();p[id]=Object.assign(cfg(id),o);JS('kp_plans',p);}
function log(id){return (J('kp_plan_log',{})[id])||{};}
function activeExam(){
  const up=exams().filter(e=>e.date&&daysTo(e)>=0&&cfg(e.id).on).sort((a,b)=>a.date<b.date?-1:1);
  return up[0]||null;
}
window.kcRevisionWeek=function(){
  const up=exams().filter(e=>e.date&&daysTo(e)>=0&&daysTo(e)<=7).sort((a,b)=>a.date<b.date?-1:1);
  return up.length?{exam:up[0],days:daysTo(up[0])}:null;
};

/* ───────── Questions d'un examen ───────── */
const arch=id=>!!id&&typeof isFolderArchived==='function'&&isFolderArchived(id);
const boy=id=>typeof isBoycotted==='function'&&isBoycotted(id);
function poolOf(ex){
  const F=G('folders',[])||[],C=G('courses',[])||[],Q=G('questions',[])||[];
  const ok=new Set((ex.folderIds&&ex.folderIds.length?ex.folderIds:F.filter(f=>f.type!=='annales'&&!arch(f.id)).map(f=>f.id)));
  const cs=C.filter(c=>ok.has(c.folderId)&&!arch(c.subFolderId));
  const cid=new Set(cs.map(c=>c.id));
  return {courses:cs,qs:Q.filter(q=>cid.has(q.courseId)&&!boy(q.id)),cid};
}
function qInfo(q){
  const d=(G('diffData',{})||{})[q.id]||{};
  const at=d.attempts||0,er=at?(d.errors||0)/at:0;
  const df=typeof getDiff==='function'?getDiff(q.id):'new';
  const last=d.lastDate?Date.parse(d.lastDate):0;
  const acq=at>=2&&er<.25&&d.lastCorrect!==false;
  /* priorité : difficile > moyenne > jamais vue > facile ; plus c'est vieux, plus ça remonte */
  const base=df==='hard'?100:df==='medium'?70:df==='new'?55:20;
  const age=last?Math.min(30,(Date.now()-last)/864e5):30;
  return {q,at,er,acq,df,s:base+er*30+age+(d.lastCorrect===false?15:0)};
}
function courseScore(c,infos){
  const L=infos.filter(i=>i.q.courseId===c.id);if(!L.length)return null;
  const seen=L.filter(i=>i.at),er=seen.length?seen.reduce((a,i)=>a+i.er,0)/seen.length:1;
  return {c,n:L.length,todo:L.filter(i=>!i.acq).length,score:er*100+(L.length-seen.length)/L.length*60,mast:Math.round(L.filter(i=>i.acq).length*100/L.length)};
}

/* ───────── Programme ───────── */
function build(ex){
  const P=poolOf(ex),infos=P.qs.map(qInfo);
  const D=daysTo(ex),cf=cfg(ex.id);
  const todo=infos.filter(i=>!i.acq).length;
  const learnDays=Math.max(0,D-FINAL);
  let per=cf.perDay==='auto'?Math.ceil(todo/Math.max(1,learnDays||D||1)):+cf.perDay;
  per=Math.max(10,Math.min(150,per||20));
  const cs=P.courses.map(c=>courseScore(c,infos)).filter(Boolean).sort((a,b)=>b.score-a.score);
  /* répartit les cours (les plus faibles d'abord) sur les jours d'apprentissage, ≈ per questions à faire par jour */
  const days=[];const today=day0(new Date());
  let ci=0;
  for(let k=0;k<D;k++){
    const d=new Date(today);d.setDate(today.getDate()+k);
    const fin=D-k<=FINAL;
    const it={date:dk(d),d,k,fin,courses:[],target:per};
    if(!fin&&cs.length){
      let load=0;
      while(ci<cs.length&&(load<per||!it.courses.length)){it.courses.push(cs[ci]);load+=Math.max(1,cs[ci].todo);ci++;if(load>=per*1.25)break;}
      if(ci>=cs.length)ci=0;   /* tous les cours vus : on recommence par les plus faibles */
    }
    days.push(it);
  }
  return {ex,D,per,days,infos,courses:cs,todo,total:infos.length,learnDays};
}
function doneToday(ex){return log(ex.id)[dk(new Date())]||0;}
/* questions du jour : cours du jour d'abord (plus faibles d'abord), complétées par les points faibles des autres */
function todayQs(B,n){
  const day=B.days[0];if(!day)return [];
  const inDay=new Set(day.courses.map(x=>x.c.id));
  const sorted=B.infos.slice().sort((a,b)=>b.s-a.s);
  let pick;
  if(day.fin){/* révision générale : erreurs d'abord puis un peu de tout */
    const weak=sorted.filter(i=>i.er>0||i.df==='hard'||i.df==='medium');
    const rest=sorted.filter(i=>!weak.includes(i));shuf(rest);
    pick=weak.slice(0,Math.ceil(n*.6)).concat(rest);
  }else pick=sorted.filter(i=>inDay.has(i.q.courseId)).concat(sorted.filter(i=>!inDay.has(i.q.courseId)));
  return pick.slice(0,n).map(i=>i.q);
}
function shuf(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ───────── Remplace « Ta révision du jour » ───────── */
const _daily=window.kcDailySRS,_launch=window.kcLaunchDailySRS;
let _cache=null;
function cur(){
  const ex=activeExam();if(!ex)return null;
  if(_cache&&_cache.id===ex.id&&_cache.t>Date.now()-15000&&_cache.day===dk(new Date()))return _cache.B;
  const B=build(ex);if(!B.total)return null;
  _cache={id:ex.id,t:Date.now(),B,day:dk(new Date())};return B;
}
window.kcPlanToday=function(){
  const B=cur();if(!B)return null;
  const done=doneToday(B.ex),left=Math.max(0,B.per-done),day=B.days[0];
  return {exam:B.ex,days:B.D,per:B.per,done,left,fin:!!(day&&day.fin),focus:day?day.courses.map(x=>x.c.name):[]};
};
window.kcPlanLabel=function(){
  const t=window.kcPlanToday();if(!t)return null;
  const j=t.days===0?'aujourd’hui':t.days===1?'demain':'J-'+t.days;
  return {title:'Planning · '+t.exam.name+' ('+j+')',
    sub:t.left?`${t.left} question${t.left>1?'s':''} ${t.fin?'· révision générale':'· '+(t.focus.slice(0,2).join(', ')||'tes points faibles d’abord')}`:`Fait aujourd’hui (${t.done}/${t.per}) · tu peux continuer`,
    n:t.left||Math.min(20,t.per),done:!t.left};
};
window.kcDailySRS=function(n){
  const B=cur();
  if(B){const t=window.kcPlanToday();return todayQs(B,t.left||Math.min(20,B.per));}
  return typeof _daily==='function'?_daily(n):[];
};
window.kcPlanLaunch=function(id){
  const ex=id?exams().find(e=>e.id===id):activeExam();
  if(!ex){if(typeof _launch==='function')return _launch();return;}
  const B=id?build(ex):cur()||build(ex);
  const left=Math.max(0,B.per-doneToday(ex)),n=left||Math.min(20,B.per);
  const qs=todayQs(B,n);
  if(!qs.length){notify('Ajoute des questions aux matières de cet examen','err');return;}
  try{rBack='home';}catch(e){}
  try{const d=$('kc-dlg');if(d)d.remove();}catch(e){}
  if(typeof launchS==='function')launchS(shuf(qs.slice()),'Planning · '+ex.name,false,false,false,false,false);
};
window.kcLaunchDailySRS=function(){
  if(activeExam()&&cur())return window.kcPlanLaunch();
  return typeof _launch==='function'?_launch():undefined;
};
/* suivi : chaque réponse à une question de l'examen actif compte pour le jour */
(function hook(){
  const orig=window.recordAnswer;
  if(typeof orig!=='function'){setTimeout(hook,400);return;}
  if(orig._kcPlan)return;
  const w=function(qid){
    const r=orig.apply(this,arguments);
    try{
      const ex=activeExam();
      if(ex){const P=_cache&&_cache.id===ex.id?_cache.B:null;const cid=P?new Set(P.courses.map(x=>x.c.id)):poolOf(ex).cid;
        const q=(G('questions',[])||[]).find(x=>x.id===qid);
        if(q&&cid.has(q.courseId)){const L=J('kp_plan_log',{});const o=L[ex.id]||(L[ex.id]={});const k=dk(new Date());o[k]=(o[k]||0)+1;JS('kp_plan_log',L);}}
    }catch(e){}
    return r;
  };
  w._kcPlan=true;window.recordAnswer=w;
})();

/* ───────── Fenêtre ───────── */
let VIEW={id:null,add:false};
function examForm(){
  const F=(G('folders',[])||[]).filter(f=>f.type!=='annales'&&!arch(f.id));
  return `<div class="kpl-add">
    <div class="kpl-add-r"><label><span>Examen</span><input class="fi" id="kpl-n" maxlength="60" placeholder="ex : Partiel d’anatomie"></label>
      <label><span>Date</span><input class="fi" id="kpl-d" type="date" min="${dk(new Date())}"></label></div>
    ${F.length?`<div class="kpl-lbl">Matières à réviser <small>(rien de coché = toutes)</small></div><div class="kpl-fs">${F.map(f=>`<label class="kpl-f"><input type="checkbox" value="${esc(f.id)}"><i style="background:${esc(f.color||'var(--kc-primary)')}"></i>${esc(f.name)}</label>`).join('')}</div>`
      :'<small class="kpl-lbl">Tu n’as pas encore de matière : le planning utilisera toutes tes questions.</small>'}
    <div class="kpl-add-f"><button class="btn btn-g btn-sm" data-pl="cancel">Annuler</button><button class="btn btn-p btn-sm" data-pl="save">Créer mon planning</button></div></div>`;
}
function bodyHTML(){
  const all=exams().filter(e=>e.date&&daysTo(e)>=0).sort((a,b)=>a.date<b.date?-1:1);
  if(!VIEW.id||!all.some(e=>e.id===VIEW.id))VIEW.id=(activeExam()||all[0]||{}).id||null;
  const tabs=all.length?`<div class="kpl-tabs">${all.map(e=>`<button class="${e.id===VIEW.id?'on':''}" data-pl="tab" data-id="${esc(e.id)}"><b>${esc(e.name)}</b><small>${daysTo(e)===0?'aujourd’hui':'J-'+daysTo(e)}</small></button>`).join('')}<button class="kpl-plus" data-pl="add" title="Ajouter un examen"><span class="ms">add</span></button></div>`:'';
  if(VIEW.add||!all.length)return tabs+(all.length?'':`<div class="kpl-empty"><span class="ms">event_upcoming</span><b>Entre la date de ton examen</b><small>City Work te fait un programme jour par jour : un nombre de questions par jour, tes points faibles d’abord, puis une révision générale les 3 derniers jours.</small></div>`)+examForm();
  const ex=all.find(e=>e.id===VIEW.id),B=build(ex),cf=cfg(ex.id),L=log(ex.id),tk=dk(new Date());
  if(!B.total)return tabs+`<div class="kpl-empty"><span class="ms">help</span><b>Aucune question dans les matières de cet examen</b><small>Ajoute des QCM à tes cours (import, Atelier IA…) ou choisis d’autres matières.</small><button class="btn btn-g btn-sm" data-pl="del" data-id="${esc(ex.id)}">Supprimer cet examen</button></div>`;
  const acq=B.total-B.todo,pct=Math.round(acq*100/B.total),done=L[tk]||0;
  const PER=['auto',15,25,35,50,75];
  const head=`<div class="kpl-sum">
      <div class="kpl-ring" style="--p:${pct}"><b>${pct}%</b><small>acquis</small></div>
      <div class="kpl-sum-t"><b>${esc(ex.name)}</b><span>${parseD(ex.date).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} · ${B.D===0?'aujourd’hui':B.D===1?'demain':'dans '+B.D+' jours'}</span>
        <small>${B.total} questions · ${acq} acquises · ${B.todo} à travailler</small></div>
      <div class="kpl-on"><label class="kpl-sw"><input type="checkbox" data-pl="on"${cf.on?' checked':''}><i></i></label><small>${cf.on?'Planning actif':'En pause'}</small></div>
    </div>
    <div class="kpl-per"><span>Questions par jour</span>${PER.map(v=>`<button class="${String(cf.perDay)===String(v)?'on':''}" data-pl="per" data-v="${v}">${v==='auto'?'Auto · '+B.per:v}</button>`).join('')}</div>`;
  const FN={};(G('folders',[])||[]).forEach(f=>FN[f.id]=f.name);const fname=c=>FN[c.folderId]||'';
  const multi=new Set(B.courses.map(x=>x.c.folderId)).size>1;
  const rows=B.days.map((d,i)=>{
    const today=d.date===tk,n=today?done:0,cl=today?(n>=B.per?' ok':' now'):'';
    const what=d.fin?'<span class="kpl-tag fin"><span class="ms">replay</span>Révision générale</span><small>Tes erreurs d’abord, puis un peu de tout</small>'
      :d.courses.length?`<span class="kpl-cs">${d.courses.slice(0,4).map(x=>`<span title="${esc(fname(x.c))} › ${esc(x.c.name)} · ${x.mast}% acquis">${multi?`<i>${esc(fname(x.c))}</i>`:''}${esc(x.c.name)}<em>${x.mast}%</em></span>`).join('')}${d.courses.length>4?`<span>+${d.courses.length-4}</span>`:''}</span>`:'<small>Points faibles</small>';
    return `<div class="kpl-day${cl}">
      <div class="kpl-dd"><b>${today?'Auj.':WD[d.d.getDay()]}</b><span>${d.d.getDate()} ${MO[d.d.getMonth()]}</span></div>
      <div class="kpl-dw">${what}</div>
      <div class="kpl-dn"><span>${today?`<b>${Math.min(n,B.per)}</b> / `:''}${B.per}</span><small>questions</small></div>
      ${today?`<button class="btn btn-p btn-sm" data-pl="go">${n>=B.per?'Encore':'Réviser'}</button>`:''}
    </div>`;
  }).join('');
  const examDay=`<div class="kpl-day exam"><div class="kpl-dd"><b>${WD[parseD(ex.date).getDay()]}</b><span>${parseD(ex.date).getDate()} ${MO[parseD(ex.date).getMonth()]}</span></div><div class="kpl-dw"><span class="kpl-tag ex"><span class="ms">school</span>Jour de l’examen</span><small>Bonne chance !</small></div></div>`;
  const past=Object.keys(L).filter(k=>k<tk).sort().slice(-7);
  return tabs+head+`<div class="kpl-days">${rows}${examDay}</div>`
    +(past.length?`<div class="kpl-past"><span class="ms">history</span>Derniers jours : ${past.map(k=>`<span>${parseD(k).getDate()} ${MO[parseD(k).getMonth()]} · <b>${L[k]}</b></span>`).join('')}</div>`:'')
    +`<div class="kpl-note"><span class="ms">autorenew</span>Le programme se recalcule chaque jour d’après tes réponses : si tu rates un jour, le reste se répartit tout seul.</div>
     <div class="kpl-foot2"><button class="kpl-lnk" data-pl="del" data-id="${esc(ex.id)}"><span class="ms">delete</span>Supprimer l’examen</button></div>`;
}
let DLG=null;
function render(){const b=DLG&&DLG.el.querySelector('.kc-dlg-b');if(b){const sc=b.scrollTop;b.innerHTML=bodyHTML();b.scrollTop=sc;}_cache=null;}
window.kcPlanOpen=function(id){
  if(typeof window.kcDlg!=='function')return false;
  VIEW={id:id||null,add:false};
  DLG=window.kcDlg({title:'Planning de révision',sub:'Un programme jour par jour jusqu’à ton examen',icon:'event_upcoming',body:bodyHTML(),foot:false,
    onOpen:bg=>{bg.classList.add('kpl-dlg');
      bg.addEventListener('click',e=>{
        const b=e.target.closest('[data-pl]');if(!b)return;const a=b.dataset.pl;
        if(a==='tab'){VIEW.id=b.dataset.id;VIEW.add=false;render();}
        else if(a==='add'){VIEW.add=true;render();setTimeout(()=>$('kpl-n')&&$('kpl-n').focus(),30);}
        else if(a==='cancel'){VIEW.add=false;render();}
        else if(a==='per'){setCfg(VIEW.id,{perDay:b.dataset.v==='auto'?'auto':+b.dataset.v});render();refreshHome();}
        else if(a==='go'){const i=VIEW.id;DLG.close();setTimeout(()=>window.kcPlanLaunch(i),200);}
        else if(a==='del'){const i=b.dataset.id;(typeof kcConfirm==='function'?kcConfirm('Supprimer cet examen et son planning ?',{danger:true}):Promise.resolve(true)).then(ok=>{
            if(!ok)return;if(typeof saveExamsV2==='function')saveExamsV2(exams().filter(x=>x.id!==i));VIEW.id=null;render();refreshHome();});}
        else if(a==='save'){
          const n=($('kpl-n').value||'').trim(),d=$('kpl-d').value;
          if(!n){notify('Donne un nom à l’examen','err');return;}if(!d){notify('Choisis la date','err');return;}
          const f=[...DLG.el.querySelectorAll('.kpl-f input:checked')].map(x=>x.value);
          const id='ex'+Date.now().toString(36);
          if(typeof saveExamsV2==='function')saveExamsV2(exams().concat([{id,name:n,date:d,folderIds:f}]));
          setCfg(id,{on:true,perDay:'auto'});VIEW={id,add:false};render();refreshHome();notify('Planning créé','ok');
        }
      });
      bg.addEventListener('change',e=>{if(e.target.matches('[data-pl="on"]')){setCfg(VIEW.id,{on:e.target.checked});render();refreshHome();}});
    },onClose:()=>{DLG=null;refreshHome();}});
  return true;
};
function refreshHome(){_cache=null;try{if(typeof renderHome==='function'&&document.body.dataset.screen==='home')renderHome();}catch(e){}}

/* ───────── Boutons d'entrée ───────── */
function buttons(){
  const pg=document.querySelector('#pg-list-view .btn.btn-sm.btn-g');
  if(pg&&!$('kpl-btn-pg')){const b=document.createElement('button');b.id='kpl-btn-pg';b.className='btn btn-sm btn-p';b.style.marginRight='6px';
    b.innerHTML='<span class="ms" style="font-size:15px;vertical-align:middle">event_upcoming</span> Planning auto';b.onclick=()=>window.kcPlanOpen();pg.parentNode.insertBefore(b,pg);}
  const em=document.querySelector('#modal-exam-manager .md');
  if(em&&!em.querySelector('.kpl-em')){const b=document.createElement('button');b.className='btn btn-p kpl-em';b.style.cssText='margin:0 20px 16px;width:calc(100% - 40px);justify-content:center';
    b.innerHTML='<span class="ms" style="font-size:16px">event_upcoming</span> Voir mon planning jour par jour';b.onclick=()=>{if(typeof closeModal==='function')closeModal('modal-exam-manager');window.kcPlanOpen();};em.appendChild(b);}
}
document.addEventListener('click',()=>setTimeout(buttons,80),true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buttons);else setTimeout(buttons,300);
})();
