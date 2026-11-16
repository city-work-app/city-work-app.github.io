'use strict';

/* =========================================================
   agenda.js — Agenda mensuel
   • jours de révision (sessionHistory + dailyCounts de data.js)
   • examens (getExamsV2 de ui.js — même liste que le compte à rebours)
   • évènements perso : localStorage 'kcu_agenda'
   ========================================================= */

const KAgenda='kcu_agenda';
const AG_TYPES=[
  {id:'cours',name:'Cours / TP',icon:'school',color:'#6cb4ee'},
  {id:'examen',name:'Examen',icon:'workspace_premium',color:'#e3b23c'},
  {id:'stage',name:'Stage / garde',icon:'medical_services',color:'#7dcfa0'},
  {id:'revision',name:'Révision prévue',icon:'menu_book',color:'#b79ce8'},
  {id:'perso',name:'Perso',icon:'favorite',color:'#f5a3c7'},
  {id:'autre',name:'Autre',icon:'event',color:'#9aa5ad'}
];
const AG_MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const AG_MON_SHORT=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const AG_DAYS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

let agEvents=ls(KAgenda,[]);
let _agMonth=null;   // 1er jour du mois affiché
let _agSel=null;     // jour sélectionné 'YYYY-MM-DD'

function _agSave(){localStorage.setItem(KAgenda,JSON.stringify(agEvents));}
function _agKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function _agParse(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d);}
function _agEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function _agType(id){return AG_TYPES.find(t=>t.id===id)||AG_TYPES[AG_TYPES.length-1];}
function _agExams(){try{return typeof getExamsV2==='function'?getExamsV2():[];}catch(e){return [];}}

// Révision d'un jour : sessions + questions (les clés de data.js sont au format YYYY-MM-DD)
function _agRevision(key){
  const ss=(typeof sessionHistory!=='undefined'?sessionHistory:[]).filter(s=>s.date===key);
  const total=ss.reduce((a,s)=>a+(s.total||0),0),correct=ss.reduce((a,s)=>a+(s.correct||0),0);
  const secs=ss.reduce((a,s)=>a+(s.duration||0),0);
  const q=Math.max(total,(typeof dailyCounts!=='undefined'&&dailyCounts[key])||0);
  return {sessions:ss.length,q,correct,total,secs};
}
function _agItems(key){
  const ex=_agExams().filter(e=>e.date===key).map(e=>({kind:'exam',id:e.id,title:e.name,type:'examen',time:e.time||''}));
  const ev=agEvents.filter(e=>e.date===key).map(e=>Object.assign({kind:'event'},e));
  return ex.concat(ev).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
}

function renderAgenda(){
  const root=document.getElementById('agenda-root');if(!root)return;
  const today=new Date();today.setHours(0,0,0,0);
  if(!_agMonth)_agMonth=new Date(today.getFullYear(),today.getMonth(),1);
  if(!_agSel)_agSel=_agKey(today);
  const y=_agMonth.getFullYear(),m=_agMonth.getMonth();
  const first=new Date(y,m,1),start=new Date(first);start.setDate(1-((first.getDay()+6)%7));
  const todayKey=_agKey(today);
  // Compteurs du mois
  let monthSessions=0,monthExams=0,monthEvents=0;
  const cells=[];
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const key=_agKey(d),inMonth=d.getMonth()===m;
    const rev=_agRevision(key),items=_agItems(key);
    if(inMonth){monthSessions+=rev.sessions;monthExams+=items.filter(x=>x.kind==='exam').length;monthEvents+=items.filter(x=>x.kind==='event').length;}
    const lvl=rev.q===0?0:rev.q<10?1:rev.q<30?2:rev.q<60?3:4;
    const wknd=d.getDay()===0||d.getDay()===6;
    const shown=items.slice(0,2);
    cells.push(`<button class="ag-cell${inMonth?'':' out'}${wknd?' wknd':''}${key===todayKey?' today':''}${key===_agSel?' sel':''} lv${lvl}" onclick="agSelect('${key}')" aria-label="${d.getDate()} ${AG_MONTHS[d.getMonth()]}${rev.q?`, ${rev.q} questions révisées`:''}${items.length?`, ${items.length} évènement(s)`:''}">
      <span class="ag-num">${d.getDate()}</span>
      ${rev.q?`<span class="ag-done" title="${rev.q} questions"><span class="ms">check</span></span>`:''}
      <span class="ag-chips">${shown.map(it=>{const t=_agType(it.type);return `<span class="ag-chip${it.kind==='exam'?' exam':''}" style="--c:${t.color}"><span class="ms">${t.icon}</span><span class="ag-chip-t">${_agEsc(it.title)}</span></span>`;}).join('')}${items.length>2?`<span class="ag-more">+${items.length-2}</span>`:''}</span>
    </button>`);
  }
  const sel=_agParse(_agSel),selRev=_agRevision(_agSel),selItems=_agItems(_agSel);
  const isFuture=_agSel>todayKey;
  const upcoming=_agUpcoming(todayKey).slice(0,6);
  root.innerHTML=`
    <div class="ag-hero">
      <div>
        <div class="ag-kicker">Agenda</div>
        <h1 class="ag-title">${AG_MONTHS[m].charAt(0).toUpperCase()+AG_MONTHS[m].slice(1)} <span>${y}</span></h1>
        <div class="ag-stats">
          <span><b>${monthSessions}</b> séance${monthSessions>1?'s':''} faite${monthSessions>1?'s':''}</span>
          <span><b>${monthExams}</b> examen${monthExams>1?'s':''}</span>
          <span><b>${monthEvents}</b> évènement${monthEvents>1?'s':''}</span>
        </div>
      </div>
      <div class="ag-nav">
        <button class="ag-navbtn" onclick="agMove(-1)" aria-label="Mois précédent"><span class="ms">chevron_left</span></button>
        <button class="ag-today" onclick="agGoToday()">Aujourd’hui</button>
        <button class="ag-navbtn" onclick="agMove(1)" aria-label="Mois suivant"><span class="ms">chevron_right</span></button>
      </div>
    </div>
    <div class="ag-layout">
      <div class="ag-cal">
        <div class="ag-head">${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d,i)=>`<span class="${i>4?'wk':''}">${d}</span>`).join('')}</div>
        <div class="ag-grid">${cells.join('')}</div>
        <div class="ag-legend"><span class="ag-done"><span class="ms">check</span></span> révision faite <span class="ag-lg-sw lv1"></span><span class="ag-lg-sw lv2"></span><span class="ag-lg-sw lv3"></span><span class="ag-lg-sw lv4"></span> intensité</div>
      </div>
      <div class="ag-side">
        <div class="ag-day">
          <div class="ag-day-top">
            <div class="ag-day-month">${AG_MONTHS[sel.getMonth()].toUpperCase()}</div>
            <div class="ag-day-num">${sel.getDate()}</div>
            <div class="ag-day-name">${AG_DAYS[sel.getDay()].charAt(0).toUpperCase()+AG_DAYS[sel.getDay()].slice(1)} ${sel.getDate()} ${AG_MON_SHORT[sel.getMonth()]}</div>
          </div>
          <div class="ag-day-body">
            <div class="ag-rev${selRev.q?' on':''}">
              <span class="ag-rev-ic"><span class="ms">${selRev.q?'task_alt':isFuture?'schedule':'bedtime'}</span></span>
              <div>${selRev.q
                ?`<b>${selRev.sessions||1} séance${selRev.sessions>1?'s':''} · ${selRev.q} questions</b><small>${selRev.total?Math.round(selRev.correct*100/selRev.total)+'% de réussite':''}${selRev.secs?' · '+Math.max(1,Math.round(selRev.secs/60))+' min':''}</small>`
                :`<span>${isFuture?'Jour à venir — planifie une révision ci-dessous.':'Pas de révision ce jour-là.'}</span>`}</div>
            </div>
            ${selItems.length?`<div class="ag-list">${selItems.map(it=>{const t=_agType(it.type);return `
              <div class="ag-item" style="--c:${t.color}">
                <span class="ag-item-ic"><span class="ms">${t.icon}</span></span>
                <div class="ag-item-txt"><b>${_agEsc(it.title)}</b><small>${it.time?it.time+' · ':''}${t.name}</small></div>
                ${it.kind==='event'?`<button class="ag-del" onclick="agDelete('${it.id}')" aria-label="Supprimer"><span class="ms">delete</span></button>`
                  :`<button class="ag-del" onclick="agDeleteExam('${it.id}')" aria-label="Supprimer l’examen"><span class="ms">delete</span></button>`}
              </div>`;}).join('')}</div>`:''}
            <div class="ag-form">
              <div class="ag-form-title">Ajouter un évènement</div>
              <input class="fi" id="ag-title" maxlength="80" placeholder="Ex. TP anatomie, garde clinique…" onkeydown="if(event.key==='Enter')agAdd()">
              <div class="ag-form-row">
                <input class="fi" id="ag-time" type="time" aria-label="Heure">
                <select class="fi" id="ag-type" aria-label="Type">${AG_TYPES.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select>
              </div>
              <button class="btn btn-p ag-add" onclick="agAdd()"><span class="ms" style="font-size:18px">add</span> Ajouter</button>
            </div>
          </div>
        </div>
        <div class="ag-up">
          <div class="ag-up-title">À venir</div>
          ${upcoming.length?upcoming.map(u=>{const d=_agParse(u.date),t=_agType(u.type);const days=Math.round((d-today)/864e5);return `
            <button class="ag-up-item" onclick="agJump('${u.date}')">
              <span class="ag-up-date" style="--c:${t.color}"><b>${d.getDate()}</b><small>${AG_MON_SHORT[d.getMonth()].replace('.','').toUpperCase()}</small></span>
              <span class="ag-up-txt"><small>${AG_DAYS[d.getDay()].charAt(0).toUpperCase()+AG_DAYS[d.getDay()].slice(1)} ${d.getDate()} ${AG_MON_SHORT[d.getMonth()]}${u.time?' · '+u.time:''} · ${days===0?'aujourd’hui':days===1?'demain':'dans '+days+' j'}</small><b><span class="ms">${t.icon}</span>${u.kind==='exam'?'Examen · ':''}${_agEsc(u.title)}</b></span>
            </button>`;}).join(''):`<div class="ag-up-empty">Rien de prévu pour l’instant.</div>`}
        </div>
      </div>
    </div>`;
}
function _agUpcoming(fromKey){
  const ex=_agExams().filter(e=>e.date&&e.date>=fromKey).map(e=>({kind:'exam',date:e.date,title:e.name,type:'examen',time:e.time||''}));
  const ev=agEvents.filter(e=>e.date>=fromKey).map(e=>Object.assign({kind:'event'},e));
  return ex.concat(ev).sort((a,b)=>(a.date+(a.time||'99')).localeCompare(b.date+(b.time||'99')));
}

function agSelect(key){
  _agSel=key;const d=_agParse(key);
  if(d.getMonth()!==_agMonth.getMonth()||d.getFullYear()!==_agMonth.getFullYear())_agMonth=new Date(d.getFullYear(),d.getMonth(),1);
  renderAgenda();
  if(window.innerWidth<1000){const el=document.querySelector('.ag-day');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
}
function agJump(key){agSelect(key);}
function agMove(n){_agMonth=new Date(_agMonth.getFullYear(),_agMonth.getMonth()+n,1);renderAgenda();}
function agGoToday(){_agMonth=null;_agSel=null;renderAgenda();}

function agAdd(){
  const title=(document.getElementById('ag-title').value||'').trim();
  const time=document.getElementById('ag-time').value||'';
  const type=document.getElementById('ag-type').value||'autre';
  if(!title){showNotif('Donne un nom à ton évènement','error');document.getElementById('ag-title').focus();return;}
  if(type==='examen'&&typeof saveExamsV2==='function'){
    // Les examens rejoignent la liste officielle (compte à rebours, plan de révision)
    saveExamsV2(_agExams().concat([{id:uid(),name:title,date:_agSel,time,folderIds:[]}]));
    if(typeof renderDesktopSidebar==='function')renderDesktopSidebar();
  }else{
    agEvents.push({id:uid(),date:_agSel,time,title,type});_agSave();
  }
  renderAgenda();
  showNotif(type==='examen'?'Examen ajouté — il apparaît aussi dans ton compte à rebours':'Évènement ajouté','ok');
}
function agDelete(id){agEvents=agEvents.filter(e=>e.id!==id);_agSave();renderAgenda();}
async function agDeleteExam(id){
  const ex=_agExams().find(e=>e.id===id);
  if(!ex||!(await kcConfirm(`Supprimer l’examen « ${ex.name} » ? Il disparaîtra aussi du compte à rebours.`)))return;
  if(typeof deleteExamV2==='function')deleteExamV2(id);else saveExamsV2(_agExams().filter(e=>e.id!==id));
  renderAgenda();
}
