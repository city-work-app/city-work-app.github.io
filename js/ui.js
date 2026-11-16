// ── ui.js — renderHome, renderStats, renderProfil, dark mode, notifs

// Sécurité XSS : échappe les entrées utilisateur avant injection dans innerHTML
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Dates : évite le décalage fuseau horaire de toISOString()
function getLocalDateString(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ════════════════════════════════════════════
// IDENTITY (prénom + promo + photo)
// ════════════════════════════════════════════
function _applyAvatarToEl(el, photo, initial){
  if(!el) return;
  if(photo){
    el.innerHTML=`<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    el.innerHTML='';
    el.textContent = initial || '?';
  }
}
function saveIdentity(){
  const fn=document.getElementById('id-firstname');
  const pr=document.getElementById('id-promo');
  if(fn)localStorage.setItem('kp_firstname',fn.value.trim());
  if(pr)localStorage.setItem('kp_promo',pr.value.trim());
  updateIdentityPreview();
}
function updateIdentityPreview(){
  const fn=document.getElementById('id-firstname');
  const v=(fn?fn.value.trim():localStorage.getItem('kp_firstname')||'');
  const initial = v ? v[0].toUpperCase() : '?';
  const photo = localStorage.getItem('kp_avatar_photo')||null;
  // Identity card avatar
  const av=document.getElementById('id-avatar');
  _applyAvatarToEl(av, photo, initial);
  // Sidebar avatar
  const dlAv=document.getElementById('dl-avatar');
  _applyAvatarToEl(dlAv, photo, initial);
  // Sidebar name
  const dlName=document.getElementById('dl-uname');
  if(dlName) dlName.textContent = v || 'Étudiant';
  // Show/hide remove photo btn
  const rmBtn=document.getElementById('id-remove-photo-btn');
  if(rmBtn) rmBtn.style.display = photo ? 'block' : 'none';
}
function uploadProfilePhoto(input){
  const file=input.files[0];if(!file||!file.type.startsWith('image/'))return;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const SIZE=160;let w=img.width,h=img.height;
      const side=Math.min(w,h);
      const cv=document.createElement('canvas');cv.width=SIZE;cv.height=SIZE;
      const ctx=cv.getContext('2d');
      ctx.drawImage(img,(w-side)/2,(h-side)/2,side,side,0,0,SIZE,SIZE);
      const b64=cv.toDataURL('image/jpeg',.85);
      localStorage.setItem('kp_avatar_photo',b64);
      updateIdentityPreview();
      showNotif('Photo de profil mise à jour !','ok');
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
function removeProfilePhoto(){
  localStorage.removeItem('kp_avatar_photo');
  const inp=document.getElementById('id-photo-input');if(inp)inp.value='';
  updateIdentityPreview();
  showNotif('Photo supprimée','ok');
}
function loadIdentity(){
  const fn=document.getElementById('id-firstname');
  const pr=document.getElementById('id-promo');
  if(fn)fn.value=localStorage.getItem('kp_firstname')||'';
  if(pr)pr.value=localStorage.getItem('kp_promo')||'';
  updateIdentityPreview();
}
document.addEventListener('DOMContentLoaded',loadIdentity);

// ════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════
let _statsFolder=null; // null = toutes les matières
function setStatsFolder(fid){
  _statsFolder=fid;
  renderStats();
}
function renderStats(){
  const el=document.getElementById('stats-content');
  // Render folder pills
  const pillsEl=document.getElementById('stats-folder-pills');
  if(pillsEl){
    const activeFolders=(typeof folders!=='undefined'?folders:[]).filter(f=>f.type!=='annales'&&!(typeof isFolderArchived==='function'&&isFolderArchived(f.id)));
    pillsEl.innerHTML=`<button class="sf-pill${_statsFolder===null?' active':''}" onclick="setStatsFolder(null)">Toutes</button>`+
      activeFolders.map(f=>`<button class="sf-pill${_statsFolder===f.id?' active':''}" onclick="setStatsFolder('${f.id}')" style="--pill-dot:${f.color||'var(--primary)'}"><span class="sf-pill-dot"></span>${escapeHTML(f.name)}</button>`).join('');
  }
  // Use explicit filter or fall back to curF context
  const fid = _statsFolder || (typeof curF!=='undefined'&&curF ? curF : null);
  const folderCourseIds = fid ? new Set(courses.filter(c=>c.folderId===fid).map(c=>c.id)) : null;
  const baseQs = folderCourseIds ? questions.filter(q=>folderCourseIds.has(q.courseId)) : questions;
  // Update title
  const titleEl = document.getElementById('stats-title');
  if(titleEl){
    if(fid){const f=folders.find(x=>x.id===fid);titleEl.textContent=f?f.name:'Statistiques';}
    else{titleEl.textContent='Statistiques';}
  }
  const hard=baseQs.filter(q=>getDiff(q.id)==='hard');
  const medium=baseQs.filter(q=>getDiff(q.id)==='medium');
  const easy=baseQs.filter(q=>getDiff(q.id)==='easy');
  const acquired=baseQs.filter(q=>getDiff(q.id)==='acquired');
  const relevantDiff = folderCourseIds ? Object.entries(diffData).filter(([qid])=>baseQs.some(q=>q.id===qid)) : Object.entries(diffData);
  const totalAttempts=relevantDiff.reduce((s,[,d])=>s+(d.attempts||0),0);
  const totalErrors=relevantDiff.reduce((s,[,d])=>s+(d.errors||0),0);
  const globalRate=totalAttempts>0?Math.round((1-totalErrors/totalAttempts)*100):0;

  function qRows(qs){
    return qs.slice(0,12).map(q=>{
      const d=diffData[q.id];const c=courses.find(x=>x.id===q.courseId);const f=c?folders.find(x=>x.id===c.folderId):null;
      const pct=d&&d.attempts>0?Math.round((1-d.errors/d.attempts)*100):100;
      const btnId='stat-'+q.id;
      _aiCopyTexts[btnId]=`La question "${q.question}" est une question sur laquelle j'ai des difficultés. La bonne réponse est "${q.answers[q.correct]}". Explique moi en détail ce concept pour que je puisse mieux le retenir.`;
      return `<div class="diff-q-row"><div style="flex:1"><div style="font-size:13px;font-weight:600;line-height:1.4;margin-bottom:3px">${q.question.substring(0,75)}${q.question.length>75?'…':''}</div><div style="font-size:11px;color:var(--on-sv)">${f?f.name+' › ':''}${c?c.name:''} · ${d?d.attempts:0} essai${(d?.attempts||0)>1?'s':''} · ${pct}%</div></div><button class="btn-copy btn-sm" id="${btnId}" style="flex-shrink:0;margin-left:8px;padding:5px 8px;font-size:11px" onclick="copyAIStat('${btnId}')"><span class="ms" style="font-size:13px">content_copy</span></button></div>`;
    }).join('');
  }

  el.innerHTML=`
    <div class="sstrip" style="margin-bottom:14px">
      <div class="sbox"><div class="snum">${globalRate}%</div><div class="slbl">taux global</div></div>
      <div class="sbox"><div class="snum" style="color:var(--error)">${hard.length}</div><div class="slbl">difficiles</div></div>
      <div class="sbox"><div class="snum" style="color:var(--gold)">${medium.length}</div><div class="slbl">moyennes</div></div>
      <div class="sbox"><div class="snum" style="color:var(--tertiary)">${easy.length}</div><div class="slbl">faciles</div></div>
      <div class="sbox"><div class="snum" style="color:#3b82f6">${acquired.length}</div><div class="slbl">acquises</div></div>
    </div>
    ${hard.length>0?`<div class="diff-section"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div><div class="hf" style="font-size:14px;font-weight:700;color:var(--error)"><svg width="10" height="10" style="margin-right:5px;vertical-align:middle" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="var(--error)"/></svg>Difficiles (${hard.length})</div><div style="font-size:11px;color:var(--on-sv);margin-top:2px">Dernière réponse incorrecte</div></div><button class="btn btn-sm btn-p" onclick="startHard()">Réviser →</button></div>${qRows(hard)}</div>`:''}
    ${medium.length>0?`<div class="diff-section"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div><div class="hf" style="font-size:14px;font-weight:700;color:var(--gold)"><svg width="10" height="10" style="margin-right:5px;vertical-align:middle" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="var(--gold)"/></svg>Moyennes (${medium.length})</div><div style="font-size:11px;color:var(--on-sv);margin-top:2px">Échouée puis récupérée</div></div><button class="btn btn-sm btn-p" onclick="startHard()">Réviser →</button></div>${qRows(medium)}</div>`:''}
    ${easy.length>0?`<div class="diff-section"><div class="hf" style="font-size:14px;font-weight:700;color:var(--tertiary);margin-bottom:10px"><svg width="10" height="10" style="margin-right:5px;vertical-align:middle" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="var(--tertiary)"/></svg>Faciles (${easy.length}) <span style="font-size:11px;font-weight:400;color:var(--on-sv)">— réussie avec réflexion</span></div>${qRows(easy)}</div>`:''}
    ${acquired.length>0?`<div class="diff-section"><div class="hf" style="font-size:14px;font-weight:700;color:#3b82f6;margin-bottom:10px"><svg width="10" height="10" style="margin-right:5px;vertical-align:middle" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#3b82f6"/></svg>Acquises (${acquired.length}) <span style="font-size:11px;font-weight:400;color:var(--on-sv)">— répondu rapidement</span></div>${qRows(acquired)}</div>`:''}
    ${totalAttempts===0?`<div class="empty"><div class="eico"><span class="ms" style="font-size:42px">trending_up</span></div><div class="ettl">Aucune donnée encore</div><p style="font-size:14px;line-height:1.7">Fais quelques sessions pour voir tes statistiques.</p></div>`:''}
  `;
  // Inject session history chart
  renderSessionHistoryChart(el);
}
function renderSessionHistoryChart(container){
  const hist=typeof sessionHistory!=='undefined'?sessionHistory:[];
  if(hist.length<2){return;}
  // Get last 30 sessions
  const recent=hist.slice(-30);
  const maxTotal=Math.max(...recent.map(s=>s.total),1);
  const W=360,H=120,padL=28,padB=24,padT=10,padR=8;
  const iW=W-padL-padR,iH=H-padT-padB;
  const n=recent.length;
  const pts=recent.map((s,i)=>{
    const x=padL+Math.round((i/(Math.max(n-1,1)))*iW);
    const y=padT+iH-Math.round((s.correct/Math.max(s.total,1))*iH);
    return {x,y,s};
  });
  const polyline=pts.map(p=>`${p.x},${p.y}`).join(' ');
  const areaBottom=padT+iH;
  const area=`${padL},${areaBottom} `+polyline+` ${pts[pts.length-1].x},${areaBottom}`;
  // Y axis labels
  const yLabels=[0,50,100].map(pct=>{
    const y=padT+iH-Math.round((pct/100)*iH);
    return `<text x="${padL-4}" y="${y+4}" font-size="9" fill="var(--on-sv)" text-anchor="end">${pct}%</text>`;
  }).join('');
  // X axis: first and last date
  const xLabels=`<text x="${padL}" y="${H-4}" font-size="9" fill="var(--on-sv)" text-anchor="middle">${recent[0].date||''}</text>
    <text x="${W-padR}" y="${H-4}" font-size="9" fill="var(--on-sv)" text-anchor="end">${recent[recent.length-1].date||''}</text>`;
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-height:140px;overflow:visible">
    <defs><linearGradient id="shg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--primary)" stop-opacity=".25"/><stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+iH}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${padL}" y1="${padT+iH}" x2="${W-padR}" y2="${padT+iH}" stroke="var(--border)" stroke-width="1"/>
    ${[25,50,75,100].map(pct=>{const y=padT+iH-Math.round((pct/100)*iH);return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border)" stroke-width=".5" stroke-dasharray="3,3"/>`;}).join('')}
    ${yLabels}${xLabels}
    <polygon points="${area}" fill="url(#shg)"/>
    <polyline points="${polyline}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--primary)"><title>${p.s.date} · ${p.s.correct}/${p.s.total} · ${Math.round((p.s.correct/Math.max(p.s.total,1))*100)}%</title></circle>`).join('')}
  </svg>`;
  const div=document.createElement('div');
  div.className='diff-section';
  div.innerHTML=`<div class="hf" style="font-size:14px;font-weight:700;margin-bottom:10px"><span class="ms" style="font-size:14px;vertical-align:middle">timeline</span> Progression (${recent.length} sessions)</div>${svg}`;
  container.appendChild(div);
}
function copyAIStat(btnId){
  const text=_aiCopyTexts[btnId];if(!text)return;
  const btn=document.getElementById(btnId);
  const ok=()=>{btn.innerHTML='<span class="ms" style="font-size:13px">check</span>';btn.classList.add('copied');setTimeout(()=>{btn.innerHTML='<span class="ms" style="font-size:13px">content_copy</span>';btn.classList.remove('copied');},2000);};
  try{navigator.clipboard.writeText(text).then(ok).catch(()=>{const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0;top:0;left:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);ok();});}
  catch(e){const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0;top:0;left:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);ok();}
}

// ════════════════════════════════════════════
// PROFIL
// ════════════════════════════════════════════
function renderProfil(){
  updStreak();
  document.getElementById('p-streak').textContent=stats.streak;
  document.getElementById('p-next').textContent=`Prochain objectif : ${Math.ceil(Math.max(stats.streak,1)/5)*5} jours`;
  const days=['L','M','M','J','V','S','D'];const daysFull=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];const todayMon=JS_TO_MON[new Date().getDay()];
  if(typeof window._weekOffset==='undefined')window._weekOffset=0;
  const isThisWeek=window._weekOffset===0;
  // ── Utilise dailyCounts (stockage robuste par date ISO) ──
  const wCur=(typeof getDailyWeek==='function')?getDailyWeek(window._weekOffset):[0,0,0,0,0,0,0];
  const mx=Math.max(...wCur,1);
  // Label semaine
  const mondayD=(typeof getMondayOfWeek==='function')?getMondayOfWeek(window._weekOffset):new Date();
  const sundayD=new Date(mondayD);sundayD.setDate(mondayD.getDate()+6);
  const fmtD=(d)=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const wLabelTxt=isThisWeek?'Cette semaine':`${fmtD(mondayD)} – ${fmtD(sundayD)}`;
  const wLabelEl=document.getElementById('week-label-badge');if(wLabelEl)wLabelEl.textContent=wLabelTxt;
  const wNextBtn=document.getElementById('week-next-btn');if(wNextBtn){wNextBtn.style.opacity=isThisWeek?'0':'1';wNextBtn.style.pointerEvents=isThisWeek?'none':'auto';}
  const wQ=wCur.reduce((a,b)=>a+b,0);
  const wTotalEl=document.getElementById('week-total-label');if(wTotalEl)wTotalEl.textContent=wQ+' questions';
  // Stats sessions de la semaine
  const mondayStr=mondayD.toISOString().split('T')[0];
  const sundayStr=sundayD.toISOString().split('T')[0];
  const weekSessions=(typeof sessionHistory!=='undefined'?sessionHistory:[]).filter(s=>s.date>=mondayStr&&s.date<=sundayStr);
  const wSess=weekSessions.length;
  const wAvg=weekSessions.length>0?Math.round(weekSessions.reduce((s,e)=>s+(e.correct/Math.max(e.total,1)),0)/weekSessions.length*100):null;
  document.getElementById('p-total').textContent=wQ;
  document.getElementById('p-sess').textContent=wSess||0;
  document.getElementById('p-avg').textContent=wAvg!==null?wAvg+'%':'—';
  document.getElementById('wbars').innerHTML=wCur.map((v,i)=>{const isToday=isThisWeek&&i===todayMon;const lbl=(daysFull[i]+(isToday?" (aujourd'hui)":''));if(v===0){return `<div class="wbar inact" style="height:3px;opacity:${isToday?'.5':'.2'};background:${isToday?'var(--primary)':'var(--border-subtle)'}" onmouseenter="showWbarTip(this,0,'${lbl.replace(/'/g,"&#39;")}')" onmouseleave="hideWbarTip()"></div>`;}const h=Math.max(6,Math.round((v/mx)*100));const cls=isToday?'tod':'act';return `<div class="wbar ${cls}" style="height:${h}%" onmouseenter="showWbarTip(this,${v},'${lbl.replace(/'/g,"&#39;")}')" onmouseleave="hideWbarTip()"></div>`;}).join('');
  document.getElementById('dlbls').innerHTML=days.map((d,i)=>`<div class="dlbl" style="${isThisWeek&&i===todayMon?'color:var(--tertiary)':''}">${d}</div>`).join('');
  const el=document.getElementById('p-mastery');
  if(!folders.length){el.innerHTML='<div class="muted">Aucune matière.</div>';return;}
  el.innerHTML=folders.map(f=>{
    const fc=courses.filter(c=>c.folderId===f.id);const fq=questions.filter(q=>fc.some(c=>c.id===q.courseId));
    return `<div class="recap" style="margin-bottom:8px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:10px;height:10px;border-radius:50%;background:${f.color}"></div><div class="hf" style="font-size:15px;font-weight:700">${f.name}</div><div style="margin-left:auto;font-size:12px;color:var(--on-sv)">${fq.length} questions</div></div>${fc.map(c=>{const cq=questions.filter(q=>q.courseId===c.id).length;const hardN=questions.filter(q=>q.courseId===c.id&&getDiff(q.id)==='hard').length;return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-top:1px solid var(--surf-high)"><span style="font-size:13px;color:var(--on-sv)">${c.name}</span><div style="display:flex;gap:6px;align-items:center">${hardN>0?`<span class="di-badge diff-hard">${hardN}<span class="ms" style="font-size:10px;vertical-align:middle;margin-left:2px">circle</span></span>`:''}<span class="cbadge">${cq}</span></div></div>`;}).join('')}</div>`;
  }).join('');

  // Goal input
  document.getElementById('goal-input').value=dailyGoal||10;
}

function showWbarTip(el,count,label){
  hideWbarTip();
  const tip=document.createElement('div');
  tip.id='wbar-tip-active';
  tip.className='wbar-tip';
  tip.innerHTML=`<div style="font-size:10px;font-weight:600;opacity:.7;margin-bottom:2px">${label||''}</div><div>${count===0?'Aucune question':count+' question'+(count>1?'s':'')}</div>`;
  document.body.appendChild(tip);
  const r=el.getBoundingClientRect();
  tip.style.left=Math.max(6,r.left+r.width/2-tip.offsetWidth/2)+'px';
  tip.style.top=(r.top-tip.offsetHeight-10)+'px';
}
function hideWbarTip(){
  const t=document.getElementById('wbar-tip-active');
  if(t)t.remove();
}
function saveGoal(){
  const v=parseInt(document.getElementById('goal-input').value)||10;
  dailyGoal=Math.max(1,Math.min(500,v));
  saveAll();showNotif(`Objectif mis à jour : ${dailyGoal} questions/jour ✓`,'ok');renderHome();
}
function resetStats(){showConfirm('Réinitialiser les statistiques ?','Streak, sessions et progression quotidienne seront effacés.','Réinitialiser',()=>{stats={streak:0,lastDate:'',sessions:0,totalAnswered:0,totalCorrect:0,weekly:[0,0,0,0,0,0,0],todayQ:0,todayDate:'',todaySecs:0};saveAll();renderProfil();showNotif('Stats réinitialisées.','');},{icon:'restart_alt'});}

// ════════════════════════════════════════════
// EXPORT / IMPORT
// ════════════════════════════════════════════
// 16 nov. 2026 (v5) : la sauvegarde contient ABSOLUMENT tout ce qui est sur cet appareil :
//  - toutes les clés de la mémoire (localStorage + grande mémoire IndexedDB de kstore.js, images des flashcards comprises) ;
//  - les bases IndexedDB de l'appli : cours reliés aux annales (avec leurs PDF), enregistrements audio.
// Seuls les jetons de connexion (Spotify `sp_*`, compte `sb-*`) restent sur l'appareil. Les amis / le classement sont dans le compte.
const _EXPORT_DBS=['kineplus-cours-annales','kineplus_audio'];
async function _idbNames(){
  const names=_EXPORT_DBS.slice();
  try{if(indexedDB.databases)(await indexedDB.databases()).forEach(d=>{if(d&&d.name&&/^(kine|city)/i.test(d.name)&&names.indexOf(d.name)<0)names.push(d.name);});}catch(e){}
  return names.filter(n=>n!=='citywork-store');
}
function _idbOpenExisting(name){return new Promise(res=>{
  let fresh=false,r;try{r=indexedDB.open(name);}catch(e){res(null);return;}
  r.onupgradeneeded=e=>{if(e.oldVersion===0){fresh=true;try{e.target.transaction.abort();}catch(_){}}};
  r.onsuccess=()=>{if(fresh){try{r.result.close();}catch(_){}res(null);}else res(r.result);};
  r.onerror=e=>{try{e.preventDefault();}catch(_){}res(null);};r.onblocked=()=>res(null);
});}
async function _idbDump(name){
  const d=await _idbOpenExisting(name);if(!d)return null;
  const out={version:d.version,stores:[]};
  try{
    for(const sn of Array.from(d.objectStoreNames)){
      out.stores.push(await new Promise((res,rej)=>{
        const t=d.transaction(sn,'readonly'),st=t.objectStore(sn);
        const meta={name:sn,keyPath:st.keyPath,autoIncrement:st.autoIncrement,indexes:Array.from(st.indexNames).map(n=>{const ix=st.index(n);return{name:n,keyPath:ix.keyPath,unique:ix.unique,multiEntry:ix.multiEntry};})};
        const rk=st.getAllKeys(),rv=st.getAll();
        t.oncomplete=()=>res({meta,keys:rk.result||[],vals:rv.result||[]});t.onerror=t.onabort=()=>rej(t.error);
      }));
    }
  }finally{try{d.close();}catch(_){}}
  return out;
}
function _b64(blob){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const x=fr.result;res(x.slice(x.indexOf(',')+1));};fr.onerror=()=>rej(fr.error);fr.readAsDataURL(blob);});}
function _binEnc(v,jobs){ // fichiers / octets → texte base64 (les tâches asynchrones vont dans `jobs`)
  if(v==null||typeof v!=='object')return v;
  let o=null;
  if(typeof Blob!=='undefined'&&v instanceof Blob){o={__kbin:'blob',type:v.type||'',name:v.name||'',d:''};jobs.push(_b64(v).then(x=>{o.d=x;}));return o;}
  if(v instanceof ArrayBuffer){o={__kbin:'ab',d:''};jobs.push(_b64(new Blob([v])).then(x=>{o.d=x;}));return o;}
  if(ArrayBuffer.isView(v)){o={__kbin:v.constructor.name,d:''};jobs.push(_b64(new Blob([v])).then(x=>{o.d=x;}));return o;}
  if(v instanceof Date)return{__kbin:'date',d:v.toISOString()};
  if(Array.isArray(v))return v.map(x=>_binEnc(x,jobs));
  o={};for(const k of Object.keys(v))o[k]=_binEnc(v[k],jobs);return o;
}
function _binDec(v){
  if(v==null||typeof v!=='object')return v;
  if(Array.isArray(v)){for(let i=0;i<v.length;i++)v[i]=_binDec(v[i]);return v;}
  if(typeof v.__kbin==='string'&&typeof v.d==='string'){
    if(v.__kbin==='date')return new Date(v.d);
    const bin=atob(v.d),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    if(v.__kbin==='blob'){try{return v.name?new File([u],v.name,{type:v.type}):new Blob([u],{type:v.type});}catch(e){return new Blob([u],{type:v.type});}}
    if(v.__kbin==='ab')return u.buffer;
    const C=window[v.__kbin];try{return typeof C==='function'&&C!==Uint8Array?new C(u.buffer):u;}catch(e){return u;}
  }
  for(const k in v)v[k]=_binDec(v[k]);return v;
}
function _idbRestore(name,dump,noVersion){return new Promise(res=>{
  let r;try{r=noVersion?indexedDB.open(name):indexedDB.open(name,dump.version||1);}catch(e){res(0);return;}
  r.onupgradeneeded=()=>{const d=r.result;(dump.stores||[]).forEach(st=>{const m=st.meta||{};if(!m.name||d.objectStoreNames.contains(m.name))return;
    const opt={};if(m.keyPath!=null)opt.keyPath=m.keyPath;if(m.autoIncrement)opt.autoIncrement=true;
    const os=d.createObjectStore(m.name,opt);(m.indexes||[]).forEach(ix=>{try{os.createIndex(ix.name,ix.keyPath,{unique:!!ix.unique,multiEntry:!!ix.multiEntry});}catch(e){}});});};
  r.onblocked=()=>res(0);
  r.onerror=e=>{try{e.preventDefault();}catch(_){}if(!noVersion)_idbRestore(name,dump,true).then(res);else res(0);};
  r.onsuccess=()=>{const d=r.result;
    const sts=(dump.stores||[]).filter(st=>st.meta&&d.objectStoreNames.contains(st.meta.name));
    if(!sts.length){d.close();res(0);return;}
    let n=0;
    try{
      const t=d.transaction(sts.map(st=>st.meta.name),'readwrite');
      sts.forEach(st=>{const os=t.objectStore(st.meta.name);(st.rows||[]).forEach(row=>{try{const val=_binDec(row[1]);if(os.keyPath!=null)os.put(val);else os.put(val,row[0]);n++;}catch(e){}});});
      t.oncomplete=()=>{d.close();res(n);};t.onerror=t.onabort=()=>{d.close();res(0);};
    }catch(e){try{d.close();}catch(_){}res(0);}
  };
});}
async function exportData(){
  if(exportData._busy)return;exportData._busy=true;
  try{
    showNotif('Préparation de la sauvegarde complète…','');
    await new Promise(r=>setTimeout(r,30));
    const raw={};
    const keys=window.KStore?KStore.keys():Object.keys(localStorage);
    // lsRaw (data.js) : données décompressées → la sauvegarde reste du JSON lisible
    keys.forEach(k=>{if(/^sp_/.test(k)||/^sb-/.test(k)||k==='kineplus-auth')return;   /* jetons de connexion : jamais dans un fichier */
      const v=typeof LZ_KEYS!=='undefined'&&LZ_KEYS.has(k)&&typeof lsRaw==='function'?lsRaw(k):localStorage.getItem(k);if(v!=null)raw[k]=v;});
    const parts=['{"_version":5,"_app":"City Work","_exportDate":'+JSON.stringify(new Date().toISOString())+',"_raw":',JSON.stringify(raw),',"_idb":{'];
    let nDb=0,nRows=0;
    for(const name of await _idbNames()){
      let dump=null;try{dump=await _idbDump(name);}catch(e){console.warn('[export]',name,e);}
      if(!dump)continue;
      parts.push((nDb++?',':'')+JSON.stringify(name)+':{"version":'+dump.version+',"stores":[');
      for(let i=0;i<dump.stores.length;i++){
        const st=dump.stores[i];
        parts.push((i?',':'')+'{"meta":'+JSON.stringify(st.meta)+',"rows":[');
        for(let j=0;j<st.keys.length;j++){
          const jobs=[],enc=_binEnc(st.vals[j],jobs);await Promise.all(jobs);
          parts.push((j?',':'')+JSON.stringify([st.keys[j],enc]));st.vals[j]=null;nRows++;
        }
        parts.push(']}');
      }
      parts.push(']}');
    }
    parts.push('}}');
    const blob=new Blob(parts,{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`citywork_sauvegarde_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),60000);
    const mo=typeof kineFmtMo==='function'?' · '+kineFmtMo(blob.size):'';
    showNotif(`Sauvegarde complète exportée : ${Object.keys(raw).length} éléments${nRows?` + ${nRows} fichier${nRows>1?'s':''} (cours reliés aux annales, PDF, enregistrements)`:''}${mo}`,'ok');
  }catch(err){console.error(err);showNotif('Export impossible : '+(err&&err.message||err),'err');}
  finally{exportData._busy=false;}
}
function importData(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      // Nouveau format v4 (sauvegarde complète)
      if(data._raw){
        const keys=Object.keys(data._raw);
        const dbs=data._idb&&typeof data._idb==='object'?Object.keys(data._idb):[];
        let nFiles=0;dbs.forEach(n=>(data._idb[n].stores||[]).forEach(st=>{nFiles+=(st.rows||[]).length;}));
        showConfirm('Importer toutes les données ?',`${keys.length} éléments${nFiles?` et ${nFiles} fichier${nFiles>1?'s':''} (cours reliés aux annales, PDF, enregistrements)`:''} — matières, annales, flashcards, cartes mentales, ville, statistiques, réglages… Tes données actuelles seront remplacées.`,'Importer',async()=>{
          window._kpImporting=true;   // plus aucun enregistrement automatique ne doit écraser ce qu'on importe
          showNotif('Import en cours…','');
          let fail=0;keys.forEach(k=>{try{if(typeof lsSet==='function'&&typeof LZ_KEYS!=='undefined'&&LZ_KEYS.has(k))lsSet(k,data._raw[k]);else localStorage.setItem(k,data._raw[k]);}catch(err){fail++;}});
          for(const n of dbs){try{await _idbRestore(n,data._idb[n]);}catch(err){fail++;}}
          try{if(window.KStore)await KStore.flush();}catch(err){}
          showNotif(fail?`Données importées, sauf ${fail} élément${fail>1?'s':''} (mémoire pleine). Rechargement…`:'Tout est importé ! Rechargement…','ok');
          setTimeout(()=>location.reload(),900);
        },{icon:'upload',danger:false});
      // Ancien format v1-v3 (rétrocompatibilité)
      } else if(data.folders&&data.questions){
        showConfirm('Importer ces données ?',`${data.questions.length} questions et ${data.folders.length} matières. Tes données actuelles seront remplacées.`,'Importer',()=>{
          folders=data.folders||[];subFolders=data.subFolders||[];courses=data.courses||[];questions=data.questions||[];
          stats=data.stats||stats;diffData=data.diffData||{};
          if(data.dailyGoal)dailyGoal=data.dailyGoal;
          saveAll();renderHome();
          showNotif(`Importé — ${questions.length} questions restaurées !`,'ok');
        },{icon:'upload',danger:false});
      // Format seed.json (clés kcu_* avec valeurs JSON en string)
      } else if(Object.keys(data).some(k=>k.startsWith('kcu_')||k.startsWith('kp_'))){
        const keys=Object.keys(data).filter(k=>k.startsWith('kcu_')||k.startsWith('kp_'));
        showConfirm('Importer toutes les données ?',`${keys.length} entrées détectées. Tes données actuelles seront remplacées.`,'Importer',()=>{
          window._kpImporting=true;keys.forEach(k=>{if(data[k]!=null)localStorage.setItem(k,data[k]);});
          showNotif('Données importées ! Rechargement…','ok');
          setTimeout(()=>{if(window.KStore)KStore.reload();else location.reload();},900);
        },{icon:'upload',danger:false});
      } else {
        throw new Error('Format de fichier non reconnu.');
      }
    }catch(err){showNotif('Fichier invalide : '+err.message,'err');}
  };
  reader.readAsText(file);input.value='';
}

// ════════════════════════════════════════════
// MANAGE — hiérarchie navigable
// ════════════════════════════════════════════
// _mgLevel: 'folders' | 'courses' | 'questions'
let _mgLevel='folders';
let _mgSelFolder=null;
let _mgSelCourse=null;

function renderManage(){
  document.getElementById('mg-txt').textContent=`${questions.length} questions · ${courses.length} cours · ${subFolders.length} dossiers · ${folders.length} matières`;
  _mgLevel='folders';_mgSelFolder=null;_mgSelCourse=null;
  _mgRenderLevel();
}

function _mgRenderLevel(){
  const el=document.getElementById('mglist');
  if(!el)return;
  if(_mgLevel==='folders') _mgRenderFolders(el);
  else if(_mgLevel==='courses') _mgRenderCourses(el);
  else if(_mgLevel==='questions') _mgRenderQuestions(el);
}

function _mgFolderQCount(fid){
  const cids=new Set(courses.filter(c=>c.folderId===fid).map(c=>c.id));
  return questions.filter(q=>cids.has(q.courseId)).length;
}
function _mgCourseQCount(cid){
  return questions.filter(q=>q.courseId===cid).length;
}

function _mgDeleteFolder(fid,fname){
  showConfirm(
    `Supprimer "${fname}" ?`,
    'Tous les cours et questions de cette matière seront supprimés définitivement.',
    'Supprimer',
    ()=>{
      const cids=new Set(courses.filter(c=>c.folderId===fid).map(c=>c.id));
      const sfids=new Set(subFolders.filter(sf=>sf.folderId===fid).map(sf=>sf.id));
      questions=questions.filter(q=>!cids.has(q.courseId));
      courses=courses.filter(c=>c.folderId!==fid);
      subFolders=subFolders.filter(sf=>sf.folderId!==fid);
      folders=folders.filter(f=>f.id!==fid);
      saveAll();
      renderManage();
      showNotif(`"${fname}" supprimée.`,'ok');
    },
    {icon:'warning'}
  );
}
function _mgRenderFolders(el){
  if(!folders.length){
    el.innerHTML='<div class="empty"><div class="eico"><span class="ms" style="font-size:42px">folder_open</span></div><div class="ettl">Aucune matière</div></div>';return;
  }
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px">`+
    folders.map(f=>{
      const qc=_mgFolderQCount(f.id);
      const cc=courses.filter(c=>c.folderId===f.id).length;
      const diff=questions.filter(q=>courses.filter(c=>c.folderId===f.id).some(c=>c.id===q.courseId)&&getDiff(q.id)==='hard').length;
      return `<div class="mg-row" style="cursor:default">
        <div style="width:10px;height:10px;border-radius:50%;background:${f.color||'var(--primary)'};flex-shrink:0"></div>
        <div style="flex:1;min-width:0;cursor:pointer" onclick="_mgSelFolder='${f.id}';_mgLevel='courses';_mgRenderLevel()">
          <div class="mg-row-title">${escapeHTML(f.name)}</div>
          <div class="mg-row-sub">${cc} cours · ${qc} questions${diff>0?` · <span style="color:var(--error)">${diff} difficiles</span>`:''}</div>
        </div>
        <button onclick="event.stopPropagation();_mgDeleteFolder('${f.id}','${f.name.replace(/'/g,"\\'")}')" style="background:none;border:none;padding:6px;cursor:pointer;color:var(--on-sv);opacity:.5;border-radius:8px;transition:opacity .15s,color .15s" onmouseenter="this.style.opacity='1';this.style.color='var(--error)'" onmouseleave="this.style.opacity='.5';this.style.color='var(--on-sv)'">
          <span class="ms" style="font-size:18px">delete</span>
        </button>
        <span class="ms" style="font-size:18px;color:var(--on-sv);cursor:pointer" onclick="_mgSelFolder='${f.id}';_mgLevel='courses';_mgRenderLevel()">chevron_right</span>
      </div>`;
    }).join('')+`</div>`;
}

function _mgRenderCourses(el){
  const f=folders.find(x=>x.id===_mgSelFolder);
  if(!f){_mgLevel='folders';_mgRenderLevel();return;}
  // Group by subfolder
  const direct=courses.filter(c=>c.folderId===_mgSelFolder&&!c.subFolderId);
  const sfs=subFolders.filter(sf=>sf.folderId===_mgSelFolder);
  const totalQ=_mgFolderQCount(_mgSelFolder);

  let html=`<button class="mg-back-btn" onclick="_mgLevel='folders';_mgRenderLevel()">
    <span class="ms" style="font-size:15px">arrow_back</span> Matières
  </button>
  <div class="mg-breadcrumb">
    <span style="width:9px;height:9px;border-radius:50%;background:${f.color||'var(--primary)'};display:inline-block;margin-right:5px"></span>
    ${escapeHTML(f.name)} <span style="color:var(--on-sv);font-weight:400">· ${totalQ} questions</span>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px">`;

  // Sous-dossiers (fermés par défaut)
  sfs.forEach(sf=>{
    const sfCourses=courses.filter(c=>c.subFolderId===sf.id);
    const sfQ=sfCourses.reduce((s,c)=>s+_mgCourseQCount(c.id),0);
    const uid_sf='sfrows-'+sf.id;
    html+=`<div class="mg-row mg-row-sf" style="cursor:default">
      <span class="ms" style="font-size:16px;color:var(--primary);cursor:pointer" onclick="
        const r=document.getElementById('${uid_sf}');
        const ico=document.getElementById('sficon-${sf.id}');
        const open=r.style.display!=='none'&&r.style.display!=='';
        r.style.display=open?'none':'flex';
        if(ico)ico.style.transform=open?'':'rotate(180deg)';
      ">folder</span>
      <div style="flex:1;min-width:0;cursor:pointer" onclick="
        const r=document.getElementById('${uid_sf}');
        const ico=document.getElementById('sficon-${sf.id}');
        const open=r.style.display!=='none'&&r.style.display!=='';
        r.style.display=open?'none':'flex';
        if(ico)ico.style.transform=open?'':'rotate(180deg)';
      ">
        <div class="mg-row-title">${escapeHTML(sf.name)}</div>
        <div class="mg-row-sub">${sfCourses.length} cours · ${sfQ} questions</div>
      </div>
      <button onclick="event.stopPropagation();_mgDeleteSF('${sf.id}','${sf.name.replace(/'/g,"\\'")}')" style="background:none;border:none;padding:6px;cursor:pointer;color:var(--on-sv);opacity:.5;border-radius:8px;transition:opacity .15s,color .15s" onmouseenter="this.style.opacity='1';this.style.color='var(--error)'" onmouseleave="this.style.opacity='.5';this.style.color='var(--on-sv)'">
        <span class="ms" style="font-size:17px">delete</span>
      </button>
      <span class="ms" id="sficon-${sf.id}" style="font-size:18px;color:var(--on-sv);transition:transform .2s;cursor:pointer" onclick="
        const r=document.getElementById('${uid_sf}');
        const open=r.style.display!=='none'&&r.style.display!=='';
        r.style.display=open?'none':'flex';
        this.style.transform=open?'':'rotate(180deg)';
      ">expand_more</span>
    </div>
    <div id="${uid_sf}" style="display:none;flex-direction:column;gap:6px;margin-left:18px;margin-bottom:4px">
      ${sfCourses.map(c=>_mgCourseRow(c)).join('')}
    </div>`;
  });

  // Cours directs
  if(direct.length){
    if(sfs.length) html+=`<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--on-sv);padding:4px 2px;margin-top:4px">Cours directs</div>`;
    html+=direct.map(c=>_mgCourseRow(c)).join('');
  }

  html+=`</div>`;
  el.innerHTML=html;
}

function _mgCourseRow(c){
  const qc=_mgCourseQCount(c.id);
  const hard=questions.filter(q=>q.courseId===c.id&&getDiff(q.id)==='hard').length;
  return `<div class="mg-row" onclick="_mgSelCourse='${c.id}';_mgLevel='questions';_mgRenderLevel()">
    <span class="ms" style="font-size:16px;color:var(--on-sv)">menu_book</span>
    <div style="flex:1;min-width:0">
      <div class="mg-row-title">${escapeHTML(c.name)}</div>
      <div class="mg-row-sub">${qc} questions${hard>0?` · <span style="color:var(--error)">${hard} difficiles</span>`:''}</div>
    </div>
    <span class="ms" style="font-size:18px;color:var(--on-sv)">chevron_right</span>
  </div>`;
}

let _mgSelectedQs=new Set();

function _mgToggleSelectQ(qid){
  if(_mgSelectedQs.has(qid)){_mgSelectedQs.delete(qid);}else{_mgSelectedQs.add(qid);}
  _mgUpdateSelBar();
  // toggle visual
  const row=document.getElementById('mgq-'+qid);
  if(row)row.style.background=_mgSelectedQs.has(qid)?'color-mix(in srgb,var(--error) 8%,var(--surface))':'';
  const cb=document.getElementById('mgcb-'+qid);
  if(cb)cb.style.background=_mgSelectedQs.has(qid)?'var(--error)':'';
}
function _mgToggleSelectAll(){
  const qs=questions.filter(q=>q.courseId===_mgSelCourse);
  const allSelected=_mgSelectedQs.size===qs.length&&qs.length>0;
  if(allSelected){_mgSelectedQs.clear();}
  else{qs.forEach(q=>_mgSelectedQs.add(q.id));}
  // Mise à jour visuelle sans re-rendre
  qs.forEach(q=>{
    const row=document.getElementById('mgq-'+q.id);
    const cb=document.getElementById('mgcb-'+q.id);
    const sel=_mgSelectedQs.has(q.id);
    if(row)row.style.background=sel?'color-mix(in srgb,var(--error) 8%,var(--surface))':'';
    if(cb)cb.style.background=sel?'var(--error)':'';
  });
  _mgUpdateSelBar();
}
function _mgUpdateSelBar(){
  const n=_mgSelectedQs.size;
  const total=questions.filter(q=>q.courseId===_mgSelCourse).length;
  const allSel=n===total&&total>0;
  const countEl=document.getElementById('mg-sel-count');
  if(countEl)countEl.textContent=n===0?`Tout sélectionner (${total})`:`${n} sélectionnée${n>1?'s':''} / ${total}`;
  const delBtn=document.getElementById('mg-sel-del');
  if(delBtn)delBtn.style.display=n>0?'flex':'none';
  const allCb=document.getElementById('mg-sel-all-cb');
  if(allCb){
    allCb.style.background=allSel?'var(--error)':'';
    allCb.style.borderColor=allSel?'var(--error)':'var(--border-subtle)';
    const chk=allCb.querySelector('.ms');
    if(chk)chk.style.opacity=allSel?'1':'0';
  }
}
function _mgDeleteSelected(){
  const n=_mgSelectedQs.size;
  if(!n)return;
  showConfirm(`Supprimer ${n} question${n>1?'s':''} ?`,'Ces questions seront supprimées définitivement.',`Supprimer ${n}`,()=>{
    questions=questions.filter(q=>!_mgSelectedQs.has(q.id));
    _mgSelectedQs.clear();
    saveAll();
    _mgRenderLevel();
    showNotif(`${n} question${n>1?'s':''} supprimée${n>1?'s':''}.`,'ok');
  },{icon:'delete'});
}
function _mgDeleteSF(sfid, sfname){
  const sfCourses=courses.filter(c=>c.subFolderId===sfid);
  const nq=questions.filter(q=>sfCourses.some(c=>c.id===q.courseId)).length;
  showConfirm(`Supprimer "${sfname}" ?`,`${sfCourses.length} cours et ${nq} questions seront supprimés définitivement.`,'Supprimer',()=>{
    const cids=new Set(sfCourses.map(c=>c.id));
    questions=questions.filter(q=>!cids.has(q.courseId));
    courses=courses.filter(c=>c.subFolderId!==sfid);
    subFolders=subFolders.filter(sf=>sf.id!==sfid);
    saveAll();_mgRenderLevel();showNotif(`"${sfname}" supprimé.`,'ok');
  },{icon:'warning'});
}
function _mgRenderQuestions(el){
  const c=courses.find(x=>x.id===_mgSelCourse);
  const f=c?folders.find(x=>x.id===c.folderId):null;
  const sf=c&&c.subFolderId?subFolders.find(x=>x.id===c.subFolderId):null;
  const qs=questions.filter(q=>q.courseId===_mgSelCourse);
  _mgSelectedQs=new Set(); // reset selection on re-render

  let html=`<button class="mg-back-btn" onclick="_mgLevel='courses';_mgRenderLevel()">
    <span class="ms" style="font-size:15px">arrow_back</span> ${escapeHTML(f?f.name:'')}${sf?' › '+escapeHTML(sf.name):''}
  </button>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <div class="mg-breadcrumb" style="margin-bottom:0">${escapeHTML(c?c.name:'?')} <span style="color:var(--on-sv);font-weight:400">· ${qs.length} questions</span></div>
  </div>`;

  if(!qs.length){
    html+=`<div class="empty" style="padding:32px 0"><div class="ettl">Aucune question dans ce cours</div></div>`;
    el.innerHTML=html;return;
  }

  // Barre de sélection
  html+=`<div id="mg-sel-bar" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surf-low);border-radius:12px;margin-bottom:10px;cursor:pointer" onclick="_mgToggleSelectAll()">
    <div id="mg-sel-all-cb" style="width:18px;height:18px;border-radius:5px;border:2px solid var(--border-subtle);flex-shrink:0;transition:background .15s;display:flex;align-items:center;justify-content:center">
      <span class="ms" style="font-size:12px;color:#fff">check</span>
    </div>
    <span id="mg-sel-count" style="font-size:13px;font-weight:600;color:var(--on-sv);flex:1">Tout sélectionner (${qs.length})</span>
    <button id="mg-sel-del" onclick="event.stopPropagation();_mgDeleteSelected()" style="display:none;align-items:center;gap:5px;padding:5px 12px;background:var(--error);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
      <span class="ms" style="font-size:14px">delete</span> Supprimer
    </button>
  </div>
  <div style="display:flex;flex-direction:column;gap:6px">`;

  html+=qs.map(q=>{
    const diff=getDiff(q.id);
    const diffColors={hard:'var(--error)',medium:'var(--gold)',easy:'var(--tertiary)',acquired:'#3b82f6',new:'var(--on-sv)'};
    const diffDots={hard:'<i class="kh-dot" style="--d:var(--error)"></i>',medium:'<i class="kh-dot" style="--d:var(--gold)"></i>',easy:'<i class="kh-dot" style="--d:#12A35E"></i>',acquired:'<i class="kh-dot" style="--d:var(--primary)"></i>',new:'<i class="kh-dot" style="--d:var(--outline-v)"></i>'};
    const isSel=_mgSelectedQs.has(q.id);
    return `<div class="qi" id="mgq-${q.id}" style="${isSel?'background:color-mix(in srgb,var(--error) 8%,var(--surface))':''}">
      <div id="mgcb-${q.id}" onclick="_mgToggleSelectQ('${q.id}')" style="width:16px;height:16px;border-radius:4px;border:2px solid var(--border-subtle);flex-shrink:0;cursor:pointer;margin-right:4px;transition:background .15s;${isSel?'background:var(--error)':''}"></div>
      <div style="flex:1;min-width:0;cursor:pointer" onclick="_mgToggleSelectQ('${q.id}')">
        <div class="qtxt">${q.question.substring(0,90)}${q.question.length>90?'…':''}</div>
        <div class="qmeta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span>✓ ${q.answers[q.correct].substring(0,50)}${q.answers[q.correct].length>50?'…':''}</span>
          ${q.expl?`<span class="ms" style="font-size:11px;color:var(--gold)">lightbulb</span>`:''}
          <span style="font-size:10px;color:${diffColors[diff]||'var(--on-sv)'}">${diffDots[diff]||''} ${diff==='new'?'Nouveau':diff==='hard'?'Difficile':diff==='medium'?'Moyen':diff==='easy'?'Facile':'Acquise'}</span>
        </div>
      </div>
      <div class="qbtns">
        <button class="bico" onclick="openEQ('${q.id}')"><span class="ms" style="font-size:16px">edit</span></button>
        <button class="bico del" onclick="event.stopPropagation();delQ('${q.id}');_mgRenderLevel()"><span class="ms" style="font-size:16px">delete</span></button>
      </div>
    </div>`;
  }).join('');

  html+=`</div>`;
  el.innerHTML=html;
}

function clearAll(){showConfirm('Supprimer TOUTES les données ?','Matières, cours, questions et statistiques seront effacés définitivement.','Tout supprimer',()=>{folders=[];subFolders=[];courses=[];questions=[];diffData={};saveAll();renderManage();showNotif('Tout supprimé.','');},{icon:'warning'});}

function mgSwitchTab(tab){
  if(tab==='settings'){const saved=parseInt(localStorage.getItem('kp_brightness')||'100');const sl=document.getElementById('brightness-slider');const lb=document.getElementById('brightness-val');if(sl)sl.value=saved;if(lb)lb.textContent=saved+'%';}
  const isSettings=tab==='settings';
  document.getElementById('mg-panel-settings').style.display=isSettings?'':'none';
  document.getElementById('mg-panel-questions').style.display=isSettings?'none':'';
  document.getElementById('mg-tab-settings').style.cssText=isSettings?
    'flex:1;padding:8px 12px;border:none;background:var(--surface);border-radius:9px;font-size:13px;font-weight:700;color:var(--on-surface);cursor:pointer;transition:all .2s;box-shadow:0 1px 4px rgba(0,0,0,.1)':
    'flex:1;padding:8px 12px;border:none;background:transparent;border-radius:9px;font-size:13px;font-weight:600;color:var(--on-sv);cursor:pointer;transition:all .2s';
  document.getElementById('mg-tab-questions').style.cssText=isSettings?
    'flex:1;padding:8px 12px;border:none;background:transparent;border-radius:9px;font-size:13px;font-weight:600;color:var(--on-sv);cursor:pointer;transition:all .2s':
    'flex:1;padding:8px 12px;border:none;background:var(--surface);border-radius:9px;font-size:13px;font-weight:700;color:var(--on-surface);cursor:pointer;transition:all .2s;box-shadow:0 1px 4px rgba(0,0,0,.1)';
  if(!isSettings){_mgLevel='folders';_mgRenderLevel();}
}
function _renderMgThemeGrid(){
  const grid=document.getElementById('mg-theme-grid');
  if(!grid)return;
  grid.style.cssText='';
  grid.innerHTML=_themePickerHTML(true);
  _syncThemePickers();
}
function _initMgSettings(){
  // Pre-fill identity
  const fn=document.getElementById('mg-firstname');
  const pr=document.getElementById('mg-promo');
  if(fn)fn.value=localStorage.getItem('kp_firstname')||'';
  if(pr)pr.value=localStorage.getItem('kp_promo')||'';
  // Pre-fill goal
  const gi=document.getElementById('goal-input-mg');
  if(gi)gi.value=dailyGoal||10;
  // Render theme grid
  _renderMgThemeGrid();
  const spt=document.getElementById('kp-spotify-toggle');if(spt)spt.checked=spotifyEnabled();
}
function saveGoalMg(){
  const v=parseInt(document.getElementById('goal-input-mg').value)||10;
  dailyGoal=Math.max(1,Math.min(500,v));
  saveAll();showNotif(`Objectif mis à jour : ${dailyGoal} questions/jour ✓`,'ok');renderHome();
}
function saveMgIdentity(){
  const fn=document.getElementById('mg-firstname');
  const pr=document.getElementById('mg-promo');
  if(fn)localStorage.setItem('kp_firstname',fn.value.trim());
  if(pr)localStorage.setItem('kp_promo',pr.value.trim());
  updateIdentityPreview();
  showNotif('Profil mis à jour ✓','ok');
}

// ════════════════════════════════════════════
// NOTIF
// ════════════════════════════════════════════
let nt;
function showNotif(msg,type){const el=document.getElementById('notif');el.textContent=msg;el.className='notif show'+(type?' '+type:'');clearTimeout(nt);nt=setTimeout(()=>el.classList.remove('show'),3500);}

// ════════════════════════════════════════════
// THEME SYSTEM — classic · midnight · crimson · ivory · rose · bordeaux
// ════════════════════════════════════════════
// Depuis le 15 nov. 2026 : UN seul design (« Cobalt »). Le thème = mode clair/sombre ; la couleur d'accent est à part (kp_accent).
const THEMES = ['cobalt','cobalt-dark'];
const ACCENTS = [
  {id:'bleu',name:'Bleu cobalt',c:'#2B5CFF'},{id:'indigo',name:'Indigo',c:'#4F46E5',d:'#6366F1'},{id:'violet',name:'Violet',c:'#7C3AED'},
  {id:'fuchsia',name:'Fuchsia',c:'#C026D3',d:'#D946EF'},{id:'rose',name:'Rose',c:'#DB2777'},{id:'rouge',name:'Framboise',c:'#E11D48'},
  {id:'corail',name:'Corail',c:'#E5484D',d:'#F2555A'},{id:'orange',name:'Orange',c:'#EA580C'},{id:'ambre',name:'Ambre',c:'#D97706',d:'#F59E0B'},
  {id:'olive',name:'Olive',c:'#4D7C0F',d:'#65A30D'},{id:'vert',name:'Émeraude',c:'#059669'},{id:'teal',name:'Sarcelle',c:'#0D9488',d:'#14B8A6'},
  {id:'cyan',name:'Cyan',c:'#0891B2',d:'#06B6D4'},{id:'ciel',name:'Ciel',c:'#0284C7',d:'#0EA5E9'},{id:'ardoise',name:'Ardoise',c:'#475569',d:'#64748B'}
];
// Couleurs d'accent avec leurs propres règles dans cobalt.css ; les autres (et la couleur perso) passent par --kc-acc
const ACCENTS_CSS = ['bleu','rose','rouge','violet','vert','orange'];
// Anciens thèmes → [couleur d'accent, mode] (conversion automatique, une seule fois)
const OLD_THEMES = {classic:['bleu',0],midnight:['violet',1],crimson:['rouge',1],ivory:['orange',0],rose:['rose',0],bordeaux:['rose',1],
  poudre:['rose',0],cerise:['rouge',1],lilas:['violet',0],prune:['violet',1],saumon:['orange',0],grenat:['orange',1],peche:['orange',0]};
const THEME_ICONS = {cobalt:'light_mode','cobalt-dark':'dark_mode'};
const THEME_TOOLTIPS = {cobalt:'Apparence','cobalt-dark':'Apparence'};

const LAYOUTS = ['a','b','c','d','e'];
const LAYOUT_NAMES = {a:'Équilibré',b:'Éditorial',c:'Dense',d:'Minimal',e:'Zen'};
const LAYOUT_DESCS = {
  a:'Nav + panneau activité',
  b:'Héros typographique côté gauche',
  c:'Deux côtés remplis de widgets',
  d:'Rail d\'icônes + colonne slim',
  e:'Sans sidebar gauche, méta discrète'
};

const QUOTES = [
  {text:"La répétition espacée, c'est la mémoire qui choisit ce qui reste.", cite:"Conseil du jour"},
  {text:"La constance fait le thérapeute.", cite:"City Work"},
  {text:"Un kiné ne soigne pas, il réapprend au corps à fonctionner.", cite:"Conseil du jour"},
  {text:"La douleur est une alerte, pas une sentence.", cite:"Physiologie"},
  {text:"Comprendre avant d'agir : la clé de la thérapie manuelle.", cite:"Conseil du jour"},
  {text:"Chaque session compte. La progression est dans la régularité.", cite:"City Work"},
  {text:"La mémoire se consolide pendant le sommeil. Révisez le soir.", cite:"Neurosciences"},
  {text:"Tester sa mémoire vaut mieux que la relire. Active recall.", cite:"Conseil du jour"},
  {text:"Le corps garde la mémoire de ce que l'esprit oublie.", cite:"Psychosomatique"},
  {text:"Réviser peu mais souvent : la loi de la mémoire à long terme.", cite:"City Work"},
  {text:"Soigner avec ses mains commence par comprendre avec sa tête.", cite:"Conseil du jour"},
  {text:"Réapprendre à bouger, c'est réapprendre à vivre.", cite:"Kinésithérapie"},
  {text:"Une question difficile aujourd'hui, une réponse certaine demain.", cite:"Conseil du jour"},
  {text:"La maîtrise est la somme de toutes les petites habitudes.", cite:"City Work"},
];

function getTodayQuote(){
  const d=new Date();
  const day=Math.floor((d-new Date(d.getFullYear(),0,0))/(864e5));
  return QUOTES[day%QUOTES.length];
}

function buildHeatmapCells(){
  const counts={};
  Object.values(diffData).forEach(d=>{
    if(d.lastDate) counts[d.lastDate]=(counts[d.lastDate]||0)+1;
  });
  const today=new Date();
  const wk=weeklyHistory[getWeekKey(today,0)]||[];
  wk.forEach((n,monIdx)=>{
    if(!n)return;
    const d=new Date(today);
    const todayMon=JS_TO_MON[today.getDay()];
    d.setDate(today.getDate()-(todayMon-monIdx));
    const key=d.toISOString().slice(0,10);
    counts[key]=Math.max(counts[key]||0,n);
  });
  const todayKey=today.toISOString().slice(0,10);
  // Build exam date map
  const examDates={};
  getExamsV2().forEach(ex=>{
    if(ex.date) examDates[ex.date]=(examDates[ex.date]?examDates[ex.date]+', ':'')+ex.name;
  });
  const cells=[];
  for(let i=90;i>=0;i--){
    const d=new Date(today);
    d.setDate(today.getDate()-i);
    const key=d.toISOString().slice(0,10);
    const n=counts[key]||0;
    const level=n===0?0:n<3?1:n<8?2:n<20?3:4;
    cells.push({level,isToday:key===todayKey,isExam:!!examDates[key],examName:examDates[key]||'',isFuture:i<0||key>todayKey});
  }
  return cells;
}

// ── Multi-exam system (v2) ─────────────────────────────────
function getExamsV2(){
  let raw=localStorage.getItem('kp_exams_v2');
  if(raw){try{return JSON.parse(raw);}catch(e){}}
  // Migrate from old single-exam system
  const exams=[];
  const d=localStorage.getItem('kp_exam_date');
  if(d){
    exams.push({id:'_main',name:localStorage.getItem('kp_exam_name')||'Concours',date:d,folderIds:JSON.parse(localStorage.getItem('kp_exam_folders')||'[]')});
  }
  // Also import partielGroups with examDate
  (typeof partielGroups!=='undefined'?partielGroups:[]).forEach(g=>{
    if(g.examDate && !exams.find(e=>e.name===g.name&&e.date===g.examDate)){
      exams.push({id:'_pg_'+g.id,name:g.name,date:g.examDate,folderIds:g.folderIds||[]});
    }
  });
  if(exams.length) saveExamsV2(exams);
  return exams;
}
function saveExamsV2(exams){
  localStorage.setItem('kp_exams_v2',JSON.stringify(exams));
}
function deleteExamV2(id){
  const exams=getExamsV2().filter(e=>e.id!==id);
  saveExamsV2(exams);
  renderDesktopSidebar();
  if(typeof renderHome==='function')renderHome();
}
function openExamManager(){
  _renderExamManagerModal();
  openModal('modal-exam-manager');
}
let _examEditingId=null;
function _renderExamManagerModal(){
  const exams=getExamsV2();
  const today=new Date();today.setHours(0,0,0,0);
  const activeFolders=(typeof folders!=='undefined'?folders:[]).filter(f=>f.type!=='annales'&&(typeof isFolderArchived!=='function'||!isFolderArchived(f.id)));
  const listHTML=exams.length?exams.map(ex=>{
    const d=new Date(ex.date);d.setHours(0,0,0,0);
    const days=Math.round((d-today)/864e5);
    const urgColor=days<=0?'var(--error)':days<=7?'var(--error)':days<=30?'var(--gold)':'var(--primary)';
    const label=days<0?'Passé':days===0?'Aujourd\'hui':days===1?'Demain':`J−${days}`;
    const fNames=(ex.folderIds||[]).map(fid=>{const f=activeFolders.find(x=>x.id===fid);return f?`<span style="display:inline-flex;align-items:center;gap:3px;background:var(--surf-mid);border-radius:20px;padding:1px 6px;font-size:9px;font-weight:600"><span style="width:5px;height:5px;border-radius:50%;background:${f.color||'var(--primary)'};flex-shrink:0"></span>${f.name}</span>`:''}).filter(Boolean).join(' ');
    return `<div style="border:1.5px solid var(--border-subtle);border-radius:12px;padding:12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:13px;color:var(--on-surface);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ex.name}</div>
          <div style="font-size:11px;color:${urgColor};font-weight:700;margin-top:2px">${label} · ${new Date(ex.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}</div>
          ${fNames?`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px">${fNames}</div>`:''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button onclick="_startEditExam('${ex.id}')" style="background:var(--surf-mid);border:none;border-radius:8px;padding:5px 8px;cursor:pointer;color:var(--on-sv);font-size:12px;font-family:inherit;font-weight:600">✏️ Modifier</button>
          <button onclick="deleteExamV2('${ex.id}');_renderExamManagerModal()" style="background:none;border:1.5px solid var(--error);border-radius:8px;padding:5px 8px;cursor:pointer;color:var(--error);font-size:12px;font-family:inherit;font-weight:600">✕</button>
        </div>
      </div>
    </div>`;
  }).join(''):`<div style="text-align:center;padding:20px;color:var(--on-sv);font-size:13px">Aucun examen planifié</div>`;

  const folderPickerHTML=activeFolders.length?`
    <div style="margin-top:12px">
      <label style="font-size:11px;color:var(--on-sv);font-weight:600;margin-bottom:6px;display:block">Matières concernées (optionnel)</label>
      <div id="em-folder-picker" style="display:flex;flex-direction:column;gap:4px">
        ${activeFolders.map(f=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;font-size:13px;color:var(--on-surface);background:var(--surf-low)">
          <input type="checkbox" class="em-folder-check" value="${f.id}" style="accent-color:var(--primary);width:15px;height:15px">
          <span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${f.color||'var(--primary)'}"></span>
          ${f.name}
        </label>`).join('')}
      </div>
    </div>`:'';

  const modal=document.getElementById('modal-exam-manager');
  if(!modal)return;
  modal.querySelector('.md').innerHTML=`
    <div style="background:var(--primary-fixed);border-bottom:1.5px solid var(--outline-v);padding:20px 20px 16px;position:relative">
      <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--primary);font-weight:700;margin-bottom:4px">Gestion des examens</div>
      <div style="font-size:19px;font-weight:800;color:var(--on-surface);font-family:Manrope,sans-serif">Mes échéances</div>
      <button onclick="closeModal('modal-exam-manager')" style="position:absolute;top:14px;right:14px;background:var(--surf-mid);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;color:var(--on-sv);font-size:18px;display:flex;align-items:center;justify-content:center">×</button>
    </div>
    <div style="padding:20px;background:var(--surface);max-height:70vh;overflow-y:auto">
      <div id="em-list">${listHTML}</div>
      <div id="em-form" style="border:1.5px solid var(--primary);border-radius:14px;padding:16px;margin-top:4px">
        <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:12px" id="em-form-title">+ Ajouter un examen</div>
        <input class="fi" id="em-name" type="text" placeholder="Nom de l'examen (ex: Partiel Nutri)" style="margin-bottom:10px">
        <input class="fi" id="em-date" type="date" style="margin-bottom:0">
        ${folderPickerHTML}
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-p" onclick="_saveExamForm()" style="flex:1;justify-content:center">Enregistrer</button>
          <button class="btn btn-g" onclick="_cancelExamEdit()" style="padding:0 14px">Annuler</button>
        </div>
      </div>
    </div>
  `;
  _examEditingId=null;
}
function _startEditExam(id){
  _examEditingId=id;
  const ex=getExamsV2().find(e=>e.id===id);
  if(!ex)return;
  const nm=document.getElementById('em-name');
  const dt=document.getElementById('em-date');
  const title=document.getElementById('em-form-title');
  if(nm)nm.value=ex.name;
  if(dt)dt.value=ex.date;
  if(title)title.textContent='Modifier l\'examen';
  document.querySelectorAll('.em-folder-check').forEach(cb=>{
    cb.checked=(ex.folderIds||[]).includes(cb.value);
  });
  document.getElementById('em-form')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function _cancelExamEdit(){
  _examEditingId=null;
  const nm=document.getElementById('em-name');
  const dt=document.getElementById('em-date');
  const title=document.getElementById('em-form-title');
  if(nm)nm.value='';
  if(dt)dt.value='';
  if(title)title.textContent='+ Ajouter un examen';
  document.querySelectorAll('.em-folder-check').forEach(cb=>cb.checked=false);
}
function _saveExamForm(){
  const name=(document.getElementById('em-name')?.value||'').trim();
  const date=document.getElementById('em-date')?.value;
  if(!name){showNotif('Donne un nom à l\'examen.','err');return;}
  if(!date){showNotif('Sélectionne une date.','err');return;}
  const folderIds=Array.from(document.querySelectorAll('.em-folder-check:checked')).map(c=>c.value);
  const exams=getExamsV2();
  if(_examEditingId){
    const idx=exams.findIndex(e=>e.id===_examEditingId);
    if(idx>=0) exams[idx]={...exams[idx],name,date,folderIds};
  } else {
    exams.push({id:'ex_'+Date.now(),name,date,folderIds});
  }
  saveExamsV2(exams);
  _cancelExamEdit();
  _renderExamManagerModal();
  renderDesktopSidebar();
  if(typeof renderHome==='function')renderHome();
  showNotif(_examEditingId?'Examen mis à jour.':'Examen ajouté.','ok');
  _examEditingId=null;
}
// Keep old functions for backward compat
function openExamEditModal(){ openExamManager(); }

function getExamDaysLeft(){
  const d=localStorage.getItem('kp_exam_date');
  if(!d)return null;
  const today=new Date(); today.setHours(0,0,0,0);
  const exam=new Date(d); exam.setHours(0,0,0,0);
  return Math.round((exam-today)/864e5);
}
function saveExamDate(){
  const name=(document.getElementById('exam-name-input')?.value||'').trim()||'Concours';
  const date=document.getElementById('exam-date-input')?.value;
  if(!date){showNotif('Sélectionne une date.','');return;}
  localStorage.setItem('kp_exam_date',date);
  localStorage.setItem('kp_exam_name',name);
  // Save selected folders
  const checks=document.querySelectorAll('.exam-folder-check:checked');
  const fids=Array.from(checks).map(c=>c.value);
  if(fids.length)localStorage.setItem('kp_exam_folders',JSON.stringify(fids));
  else localStorage.removeItem('kp_exam_folders');
  renderDesktopSidebar();
  showNotif('Examen enregistré.','ok');
  const p=document.getElementById('theme-picker');
  if(p)p.style.display='none';
}
function clearExamDate(){
  localStorage.removeItem('kp_exam_date');
  localStorage.removeItem('kp_exam_name');
  localStorage.removeItem('kp_exam_folders');
  renderDesktopSidebar();
  showNotif('Compte à rebours supprimé.','');
}
function openExamEditModal(){
  const name=localStorage.getItem('kp_exam_name')||'';
  const date=localStorage.getItem('kp_exam_date')||'';
  const saved=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]');
  document.getElementById('exam-edit-name').value=name;
  document.getElementById('exam-edit-date').value=date;
  // Render folder picker inside modal
  const wrap=document.getElementById('exam-edit-folder-picker');
  const active=(typeof folders!=='undefined'?folders:[]).filter(f=>f.type!=='annales'&&(typeof isFolderArchived!=='function'||!isFolderArchived(f.id)));
  if(active.length){
    wrap.style.display='block';
    wrap.innerHTML=`<div style="font-size:11px;color:var(--on-sv);font-weight:600;margin-bottom:5px">Matières concernées (optionnel)</div>`+
      active.map(f=>`<label style="display:flex;align-items:center;gap:6px;padding:3px 2px;cursor:pointer;font-size:12px;color:var(--on-surface)">
        <input type="checkbox" class="exam-edit-folder-check" value="${f.id}"${saved.includes(f.id)?' checked':''} style="accent-color:var(--primary);width:13px;height:13px">
        <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${f.color||'var(--primary)'}"></span>
        ${f.name}
      </label>`).join('');
  } else {
    wrap.style.display='none';
  }
  openModal('modal-exam-edit');
}
function saveExamEdit(){
  const name=(document.getElementById('exam-edit-name')?.value||'').trim()||'Concours';
  const date=document.getElementById('exam-edit-date')?.value;
  if(!date){showNotif('Sélectionne une date.','');return;}
  localStorage.setItem('kp_exam_date',date);
  localStorage.setItem('kp_exam_name',name);
  const checks=document.querySelectorAll('.exam-edit-folder-check:checked');
  const fids=Array.from(checks).map(c=>c.value);
  if(fids.length)localStorage.setItem('kp_exam_folders',JSON.stringify(fids));
  else localStorage.removeItem('kp_exam_folders');
  renderDesktopSidebar();
  closeModal('modal-exam-edit');
  if(typeof renderHome==='function')renderHome();
  if(typeof renderPlan==='function')renderPlan();
  showNotif('Examen mis à jour.','ok');
}
function clearExamDateAndClose(){
  clearExamDate();
  closeModal('modal-exam-edit');
  if(typeof renderHome==='function')renderHome();
  if(typeof renderPlan==='function')renderPlan();
}
function _renderExamFolderPicker(){
  const wrap=document.getElementById('exam-folder-picker');
  if(!wrap)return;
  const saved=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]');
  const active=(typeof folders!=='undefined'?folders:[]).filter(f=>f.type!=='annales'&&(typeof isFolderArchived!=='function'||!isFolderArchived(f.id)));
  if(!active.length){wrap.style.display='none';return;}
  wrap.style.display='block';
  wrap.innerHTML=`<div style="font-size:11px;color:var(--on-sv);font-weight:600;margin-bottom:5px;padding:0 2px">Matières concernées (optionnel)</div>`+
    active.map(f=>`<label style="display:flex;align-items:center;gap:6px;padding:3px 2px;cursor:pointer;font-size:12px;color:var(--on-surface)">
      <input type="checkbox" class="exam-folder-check" value="${f.id}"${saved.includes(f.id)?' checked':''} style="accent-color:var(--primary);width:13px;height:13px">
      <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${f.color||'var(--primary)'}"></span>
      ${f.name}
    </label>`).join('');
}

function getAccent(){const a=localStorage.getItem('kp_accent');return a==='custom'||ACCENTS.some(x=>x.id===a)?a:'bleu';}
// ── Personnalisation (15 nov. 2026) : fond, police, taille, cartes, animations, mode auto ──
const LOOK_DEFAULTS={bg:'neutre',font:'geist',size:'100',cards:'filet',motion:'normal'};
const LOOK_FONTS={geist:['Geist',''],inter:['Inter',''],manrope:['Manrope',''],bricolage:['Bricolage Grotesque',''],
  lexend:['Lexend','Lexend:wght@400;500;600;700'],atkinson:['Atkinson Hyperlegible','Atkinson+Hyperlegible:wght@400;700'],
  serif:['Source Serif 4','Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700'],system:['','']};
function getLook(k){const v=localStorage.getItem('kp_look_'+k);return v||LOOK_DEFAULTS[k];}
function _themeIsAuto(){return localStorage.getItem('kp_theme_auto')==='1';}
function _sysDark(){return !!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);}
function applyLook(){
  const b=document.body;if(!b)return;
  b.dataset.bg=getLook('bg');b.dataset.cards=getLook('cards');
  const f=getLook('font'),fd=LOOK_FONTS[f]||LOOK_FONTS.geist;
  b.dataset.font=f;
  if(fd[1]&&!document.getElementById('kp-font-'+f)){const l=document.createElement('link');l.id='kp-font-'+f;l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family='+fd[1]+'&display=swap';document.head.appendChild(l);}
  b.classList.toggle('kc-calm',getLook('motion')==='reduit');
  b.classList.toggle('sp-on',spotifyEnabled());
  const z=parseInt(getLook('size'))||100;
  document.documentElement.style.zoom=z===100?'':String(z/100);
}
function spotifyEnabled(){try{return localStorage.getItem('kp_spotify')==='1';}catch(e){return false;}}
function setSpotifyEnabled(on){
  try{localStorage.setItem('kp_spotify',on?'1':'0');}catch(e){}
  document.body.classList.toggle('sp-on',!!on);
  showNotif(on?'Spotify affiché dans la barre du haut':'Spotify masqué','ok');
}
function setLook(k,v){
  try{localStorage.setItem('kp_look_'+k,v);}catch(e){}
  applyLook();_syncThemePickers();
}
function resetLook(){
  Object.keys(LOOK_DEFAULTS).forEach(k=>{try{localStorage.removeItem('kp_look_'+k);}catch(e){}});
  try{localStorage.removeItem('kp_theme_auto');localStorage.setItem('kp_accent','bleu');}catch(e){}
  applyLook();applyTheme(localStorage.getItem('kp_theme')||'cobalt');
}
if(window.matchMedia){try{window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(_themeIsAuto())applyTheme(_sysDark()?'cobalt-dark':'cobalt');});}catch(e){}}
function applyTheme(theme){
  if(OLD_THEMES[theme]){
    const [acc,dark]=OLD_THEMES[theme];
    if(!localStorage.getItem('kp_accent'))localStorage.setItem('kp_accent',acc);
    theme=dark?'cobalt-dark':'cobalt';
    localStorage.setItem('kp_theme',theme);
  }
  if(!THEMES.includes(theme))theme='cobalt';
  document.body.classList.remove('dark','midnight','ivory','rose','bordeaux','poudre','cerise','lilas','prune','saumon','grenat','peche');
  document.body.classList.add('cobalt');
  document.body.classList.toggle('dark',theme==='cobalt-dark');
  const acc=getAccent();
  document.body.dataset.accent=acc;
  if(ACCENTS_CSS.includes(acc)){delete document.body.dataset.accentCustom;document.body.style.removeProperty('--kc-acc');}
  else{
    const ad=ACCENTS.find(x=>x.id===acc);
    const col=acc==='custom'?(localStorage.getItem('kp_accent_custom')||'#2B5CFF'):(theme==='cobalt-dark'&&ad.d?ad.d:ad.c);
    document.body.dataset.accentCustom='1';document.body.style.setProperty('--kc-acc',col);
  }
  applyLook();
  const tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.content=theme==='cobalt-dark'?'#09090B':'#FFFFFF';
  _syncThemePickers();
  const icon=document.getElementById('dark-icon');
  const btn=document.getElementById('dark-toggle');
  if(icon) icon.textContent=THEME_ICONS[theme]||'dark_mode';
  if(btn){
    btn.classList.toggle('dark-active', theme==='cobalt-dark');
    btn.setAttribute('data-tooltip', THEME_TOOLTIPS[theme]||'Thème');
  }
  // Ring SVG strokes
  const isDark=(theme==='cobalt-dark'||theme==='crimson'||theme==='midnight'||theme==='bordeaux'||theme==='cerise'||theme==='prune'||theme==='grenat');
  const ringStroke='var(--primary)';
  const rring=document.getElementById('rring');
  if(rring)rring.style.stroke=ringStroke;
  const garc=document.getElementById('goal-arc');
  if(garc)garc.style.stroke=ringStroke;
  // Logo swap (dark vs light)
  const logoEl=document.getElementById('topbar-logo');
  if(logoEl&&window._logoLight&&window._logoDark){
    logoEl.src=isDark?window._logoDark:window._logoLight;
  }
  // Update desktop left sidebar active link color via CSS class already on body
  renderDesktopSidebar();
}
function toggleDark(){
  selectTheme(document.body.classList.contains('dark')?'cobalt':'cobalt-dark');
}
function toggleThemePicker(e){
  e && e.stopPropagation();
  const p=document.getElementById('theme-picker');
  if(!p)return;
  const isOpen=p.style.display!=='none';
  p.style.display=isOpen?'none':'block';
  if(!isOpen){
    const ap=document.getElementById('tp-appearance');if(ap)ap.innerHTML=_themePickerHTML();
    _syncThemePickers();
    // Pré-remplir les champs examen
    const savedDate=localStorage.getItem('kp_exam_date')||'';
    const savedName=localStorage.getItem('kp_exam_name')||'';
    const nameIn=document.getElementById('exam-name-input');
    const dateIn=document.getElementById('exam-date-input');
    if(nameIn)nameIn.value=savedName;
    if(dateIn)dateIn.value=savedDate;
    _renderExamFolderPicker();
    // Chip jours restants
    const chip=document.getElementById('exam-days-chip');
    if(chip){const d=getExamDaysLeft();chip.textContent=d!==null&&d>=0?`J−${d}`:(d!==null?'passé':'');}
  }
}
function selectTheme(t){
  if(t==='auto'){localStorage.setItem('kp_theme_auto','1');t=_sysDark()?'cobalt-dark':'cobalt';}
  else localStorage.removeItem('kp_theme_auto');
  localStorage.setItem('kp_theme',t);
  applyTheme(t);
}
function selectAccent(a){
  localStorage.setItem('kp_accent',a);
  applyTheme(localStorage.getItem('kp_theme')||'cobalt');
}
// Met à jour l'état actif des choix « Clair / Sombre » et des pastilles de couleur (menu du haut + Paramètres)
function selectAccentCustom(hex){
  if(!/^#[0-9a-f]{6}$/i.test(hex))return;
  localStorage.setItem('kp_accent_custom',hex);selectAccent('custom');
}
function _syncThemePickers(){
  const t=_themeIsAuto()?'auto':(document.body.classList.contains('dark')?'cobalt-dark':'cobalt'),a=getAccent();
  document.querySelectorAll('[data-kp-mode]').forEach(b=>b.classList.toggle('active',b.dataset.kpMode===t));
  document.querySelectorAll('[data-kp-accent]').forEach(b=>b.classList.toggle('active',b.dataset.kpAccent===a));
  document.querySelectorAll('[data-kp-look]').forEach(b=>{const [k,v]=b.dataset.kpLook.split(':');b.classList.toggle('active',getLook(k)===v);});
  const cc=localStorage.getItem('kp_accent_custom')||'#2B5CFF';
  document.querySelectorAll('.kp-accent-custom').forEach(el=>{el.style.setProperty('--sw',cc);const i=el.querySelector('input');if(i&&i.value!==cc)i.value=cc;});
}
// full=false : version courte (menu du haut) ; full=true : tous les réglages (Paramètres)
function _themePickerHTML(full){
  const seg=(k,opts)=>`<div class="kp-seg" role="radiogroup">${opts.map(([v,lbl,ic])=>`<button type="button" class="kp-seg-b" data-kp-look="${k}:${v}" onclick="setLook('${k}','${v}')">${ic?`<span class="ms">${ic}</span>`:''}${lbl}</button>`).join('')}</div>`;
  const modes=`<div class="kp-modes${full?' kp-modes3':''}" role="radiogroup" aria-label="Mode">
      <button type="button" class="kp-mode" data-kp-mode="cobalt" onclick="selectTheme('cobalt')"><span class="ms">light_mode</span>Clair</button>
      <button type="button" class="kp-mode" data-kp-mode="cobalt-dark" onclick="selectTheme('cobalt-dark')"><span class="ms">dark_mode</span>Sombre</button>
      ${full?`<button type="button" class="kp-mode" data-kp-mode="auto" onclick="selectTheme('auto')"><span class="ms">contrast</span>Auto</button>`:''}
    </div>`;
  const accents=`<div class="kp-accents" role="radiogroup" aria-label="Couleur d'accent">${ACCENTS.map(x=>`<button type="button" class="kp-accent" data-kp-accent="${x.id}" onclick="selectAccent('${x.id}')" title="${x.name}" aria-label="${x.name}" style="--sw:${x.c}"><span class="ms">check</span></button>`).join('')}<label class="kp-accent kp-accent-custom" data-kp-accent="custom" title="Couleur perso" aria-label="Choisir ma couleur"><span class="ms">colorize</span><input type="color" oninput="selectAccentCustom(this.value)"></label></div>`;
  if(!full)return modes+accents+`<button type="button" class="kp-more" onclick="document.getElementById('theme-picker').style.display='none';openAppearanceSettings()"><span class="ms">tune</span>Plus de réglages</button>`;
  const fonts=[['geist','Geist'],['inter','Inter'],['manrope','Manrope'],['bricolage','Bricolage'],['lexend','Lexend'],['atkinson','Atkinson'],['serif','Serif'],['system','Système']];
  return `<div class="kp-row"><div class="kp-lbl">Mode</div>${modes}</div>
    <div class="kp-row"><div class="kp-lbl">Couleur d'accent</div>${accents}</div>
    <div class="kp-row"><div class="kp-lbl">Fond</div>${seg('bg',[['neutre','Neutre'],['chaud','Chaud'],['froid','Froid'],['teinte','Teinté'],['noir','Noir pur']])}</div>
    <div class="kp-row"><div class="kp-lbl">Police</div><div class="kp-fonts">${fonts.map(([v,n])=>`<button type="button" class="kp-font" data-kp-look="font:${v}" onclick="setLook('font','${v}')" style="font-family:${LOOK_FONTS[v][0]?`'${LOOK_FONTS[v][0]}',`:''}system-ui,sans-serif"><b>Aa</b><span>${n}</span></button>`).join('')}</div></div>
    <div class="kp-row"><div class="kp-lbl">Taille de l'interface</div>${seg('size',[['90','90 %'],['100','100 %'],['110','110 %'],['120','120 %']])}</div>
    <div class="kp-row"><div class="kp-lbl">Cartes</div>${seg('cards',[['filet','Filet fin','crop_square'],['ombre','Ombre douce','layers'],['plat','Plates','rectangle']])}</div>
    <div class="kp-row"><div class="kp-lbl">Animations</div>${seg('motion',[['normal','Normales','animation'],['reduit','Réduites','motion_photos_off']])}</div>
    <button type="button" class="kp-reset" onclick="resetLook()"><span class="ms">restart_alt</span>Revenir au style d'origine</button>`;
}
function openAppearanceSettings(){
  if(typeof showScreen==='function')showScreen('manage');
  setTimeout(()=>{try{mgSwitchTab('settings');}catch(e){}const g=document.getElementById('mg-theme-grid');if(g){_renderMgThemeGrid();g.closest('.settings-card').scrollIntoView({behavior:'smooth',block:'start'});}},80);
}
function applyLayout(id){
  if(!LAYOUTS.includes(id))id='a';
  document.body.dataset.layout=id;
  /* v69 : on n'écrit plus « kp_layout » ici (option retirée ; cette écriture effaçait la mise en page de kc-layout.js) */
  document.querySelectorAll('.lp-btn').forEach(b=>b.classList.toggle('active',b.dataset.l===id));
  if(typeof renderDesktopSidebar==='function')renderDesktopSidebar();
}
function selectLayout(l){
  applyLayout(l);
  const p=document.getElementById('theme-picker');
  if(p)p.style.display='none';
}
function showLayoutDesc(l){
  const el=document.getElementById('layout-desc');
  if(el)el.textContent=LAYOUT_DESCS[l]||'';
}
// Close picker when clicking elsewhere
document.addEventListener('click',function(e){
  const p=document.getElementById('theme-picker');
  if(p&&p.style.display!=='none'&&!p.contains(e.target)&&e.target.id!=='dark-toggle'){
    p.style.display='none';
  }
});

// Legacy: treat kp_dark=1 as crimson on first load
(function initTheme(){
  let saved=localStorage.getItem('kp_theme');
  if(!saved){
    const legacyDark=localStorage.getItem('kp_dark');
    const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
    saved=(legacyDark==='1'||(legacyDark===null&&prefersDark))?'cobalt-dark':'cobalt';
    localStorage.setItem('kp_theme',saved);
  }
  if(_themeIsAuto())saved=_sysDark()?'cobalt-dark':'cobalt';
  applyTheme(saved); // convertit aussi les anciens thèmes (Bordeaux → Rose sombre…)
})();

// Une seule disposition depuis le 15 nov. 2026 (l'option « Layout » a été retirée)
(function initLayout(){ applyLayout('a'); })();

// Keep legacy applyDark shim so any existing code calling it still works
function applyDark(dark){ applyTheme(dark?'cobalt-dark':'cobalt'); }

// ════════════════════════════════════════════
// DESKTOP SIDEBAR RENDERER
// ════════════════════════════════════════════
function renderDesktopSidebar(){
  const el=document.getElementById('desktop-right');
  if(!el)return;

  const layout=document.body.dataset.layout||'a';

  // ── Variante B : panneau éditorial dans la sidebar gauche ──
  const leftEl=document.getElementById('desktop-left');
  if(leftEl){
    let hero=leftEl.querySelector('.edit-hero');
    if(layout==='b'){
      if(!hero){
        hero=document.createElement('div');
        hero.className='edit-hero';
        leftEl.insertBefore(hero,leftEl.firstChild);
      }
      const totalQ=stats.totalAnswered||0;
      const goal=dailyGoal||10;
      const logoSrc=window._logoLight||'';
      hero.innerHTML=`
        <img class="eh-watermark" src="${logoSrc}" alt="">
        <div>
          <div class="eh-kicker">City Work · Révisions 2026</div>
          <div class="eh-title">La constance<br><em>fait</em> le<br>thérapeute.</div>
          <div class="eh-sub">${totalQ} question${totalQ!==1?'s':''} répondues. Continue à avancer chaque jour.</div>
        </div>
        <div class="eh-streak">
          <div class="eh-num">${stats.streak||0}</div>
          <div class="eh-lbl">jours<br>de série</div>
        </div>`;
    } else {
      if(hero) hero.remove();
      // Mise à jour pill utilisateur (layouts A/C/D/E)
      const dlStreak=document.getElementById('dl-streak');
      if(dlStreak) dlStreak.textContent=`${stats.streak||0} jour${(stats.streak||0)!==1?'s':''} de série`;
    }
    // Sync active nav link
    document.querySelectorAll('.dl-nav a[data-nav]').forEach(a=>{
      a.classList.toggle('dl-active',a.dataset.nav===(document.body.dataset.screen||'home'));
    });
  }

  // ── Stats communes ──
  const todayQ=getTodayQ();
  const goal=dailyGoal||10;
  const pct=Math.min(100,Math.round((todayQ/goal)*100));
  const secs=stats.todaySecs||0;
  const timeStr=secs>60?`${Math.floor(secs/60)}min`:(secs>0?`${secs}s`:'—');
  const totalAttempts=Object.values(diffData).reduce((s,d)=>s+(d.attempts||0),0);
  const totalErrors=Object.values(diffData).reduce((s,d)=>s+(d.errors||0),0);
  const avgRate=totalAttempts>0?Math.round((1-totalErrors/totalAttempts)*100):null;

  // ── Variante E : Zen meta column ──
  if(layout==='e'){
    const examDays=getExamDaysLeft();
    el.innerHTML=`
      <div class="zen-meta">
        <div class="zm-block">
          <div class="zm-label">Série</div>
          <div class="zm-val">${stats.streak||0}<small>j</small></div>
          <div class="zm-sub">Continuez chaque jour</div>
        </div>
        <div class="zm-block">
          <div class="zm-label">Aujourd'hui</div>
          <div class="zm-val">${todayQ}<small>Q</small></div>
          <div class="zm-sub">Objectif : ${goal} questions</div>
        </div>
        <div class="zm-block">
          <div class="zm-label">Temps</div>
          <div class="zm-val">${timeStr}</div>
          <div class="zm-sub">Séance d'aujourd'hui</div>
        </div>
        ${avgRate!==null?`<div class="zm-block"><div class="zm-label">Moyenne</div><div class="zm-val">${avgRate}<small>%</small></div><div class="zm-sub">Taux de réussite global</div></div>`:''}
        ${examDays!==null&&examDays>=0?`<div class="zm-block"><div class="zm-label">Concours</div><div class="zm-val">J−${examDays}</div><div class="zm-sub">${localStorage.getItem('kp_exam_name')||'Examen'}</div></div>`:''}
      </div>`;
    return;
  }

  // ── Semaine (barres) — lundi=0, nav semaines précédentes ──
  if(typeof _weekOffset==='undefined')window._weekOffset=0;
  const wKey=getWeekKey(new Date(),window._weekOffset);
  const w=(weeklyHistory[wKey])||[0,0,0,0,0,0,0]; // Mon…Sun
  const mx=Math.max(...w,1);
  const todayMonIdx=JS_TO_MON[new Date().getDay()];
  const days=['L','M','M','J','V','S','D'];
  const isCurrentWeek=window._weekOffset===0;
  const wbarsHTML=w.map((v,i)=>{const isToday=isCurrentWeek&&i===todayMonIdx;const h=v>0?Math.max(6,Math.round((v/mx)*100)):2;return `<div class="dr-wbar${isToday?' today':''}" style="height:${h}%;${v===0?'opacity:.2':''}"></div>`;}).join('');
  const wlblsHTML=days.map((d,i)=>`<span style="${isCurrentWeek&&i===todayMonIdx?'color:var(--primary);font-weight:800':''}">${d}</span>`).join('');
  const wTotal=w.reduce((a,b)=>a+b,0);
  // Compute readable week label
  const mondayDate=new Date(wKey+'T12:00:00');
  const sundayDate=new Date(mondayDate);sundayDate.setDate(mondayDate.getDate()+6);
  const fmt=(d)=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const weekLabel=isCurrentWeek?'Cette semaine':`${fmt(mondayDate)} – ${fmt(sundayDate)}`;

  // ── Heatmap 91 jours ──
  const hmCells=buildHeatmapCells();
  const hmColors=['var(--surf-mid)','#d6ecf3','#8fc8d9','#3d93b0','var(--primary)'];
  const hmHTML=hmCells.map(c=>{
    let bg=hmColors[c.level];
    let extra='';
    if(c.isExam){
      bg='var(--error)';
      extra='border:2px solid #ff6b6b;opacity:1;';
    } else if(c.isToday){
      extra='box-shadow:0 0 0 2px var(--primary);z-index:1;';
    } else if(c.isFuture&&c.level===0){
      bg='color-mix(in srgb,var(--surf-mid) 60%,transparent)';
    }
    return `<div style="width:9px;height:9px;border-radius:2.5px;background:${bg};${extra}flex-shrink:0;transition:opacity .2s" title="${c.isExam?''+c.examName:c.isToday?'Aujourd\'hui':''}"></div>`;
  }).join('');

  // ── Compte à rebours examens (tous les partiels + examen principal) ──
  const _today=new Date();_today.setHours(0,0,0,0);
  const _allExams=[];
  getExamsV2().forEach(ex=>{
    const _ed=new Date(ex.date);_ed.setHours(0,0,0,0);
    const _days=Math.round((_ed-_today)/864e5);
    if(_days>=0)_allExams.push({name:ex.name,days:_days,id:ex.id,folderIds:ex.folderIds||[]});
  });
  _allExams.sort((a,b)=>a.days-b.days);
  const examCardHTML=_allExams.length?`
    <div style="background:var(--primary-fixed);border:1.5px solid var(--outline-v);border-radius:16px;padding:12px 14px;margin-bottom:12px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;right:0;width:100px;height:100px;background:var(--primary);opacity:.06;border-radius:50%;transform:translate(30%,-30%);pointer-events:none"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px">
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--primary);font-weight:700;font-family:Inter,sans-serif">Échéances</div>
        <div style="display:flex;gap:4px">
          <button onclick="openExamManager()" style="background:var(--surf-mid);border:none;border-radius:7px;padding:3px 6px;cursor:pointer;color:var(--on-sv);display:flex;align-items:center;font-family:inherit"><span class="ms" style="font-size:13px">edit</span></button>
          <button onclick="openExamManager()" style="background:var(--primary);border:none;border-radius:7px;padding:3px 8px;cursor:pointer;color:#fff;font-size:10px;font-weight:700;font-family:inherit">+</button>
        </div>
      </div>
      ${_allExams.map((ex,i)=>{
        const isFirst=i===0;
        const urgColor=ex.days===0?'var(--error)':ex.days<=3?'var(--error)':ex.days<=7?'var(--gold)':'var(--on-sv)';
        return `<div style="display:flex;align-items:center;gap:10px;${i>0?'margin-top:8px;padding-top:8px;border-top:1px solid var(--border-subtle)':''}">
          <div style="min-width:36px;text-align:center;flex-shrink:0">
            <div style="font-family:'DM Serif Display',serif;font-size:${isFirst?'32px':'21px'};line-height:.88;color:${isFirst?'var(--primary)':urgColor}">${ex.days}</div>
            <div style="font-size:8px;color:var(--on-sv);margin-top:2px;opacity:.7">jours</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:${isFirst?'13px':'11px'};color:var(--on-surface);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ex.name}</div>
            <div style="font-size:9px;color:${urgColor};margin-top:2px;font-weight:600">${ex.days===0?'Aujourd\'hui':ex.days===1?'Demain':ex.days<=7?`Dans ${ex.days} jours`:`J−${ex.days}`}</div>
          </div>
          ${isFirst?`<div style="width:3px;height:32px;background:var(--primary);border-radius:4px;flex-shrink:0;opacity:.5"></div>`:''}
        </div>`;
      }).join('')}
    </div>`:'';

  // ── Markers examen pour la heatmap (90 jours futurs) ──
  const _hmExamMarkers=(()=>{
    const future=_allExams.filter(ex=>ex.days>0&&ex.days<=90);
    if(!future.length)return '';
    return `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px">
      ${future.map(ex=>{
        const urgColor=ex.days<=7?'var(--error)':ex.days<=30?'var(--gold)':'var(--primary)';
        return `<div style="display:flex;align-items:center;gap:4px;background:var(--surf-mid);border:1px solid var(--outline-v);border-radius:20px;padding:3px 8px">
          <div style="width:6px;height:6px;border-radius:50%;background:${urgColor};flex-shrink:0"></div>
          <span style="font-size:10px;font-weight:700;color:${urgColor}">J−${ex.days}</span>
          <span style="font-size:10px;color:var(--on-sv);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ex.name}</span>
        </div>`;
      }).join('')}
    </div>`;
  })();

  // ── Heatmap stats + grid ──
  let _hmTotalQ=0,_hmBest=0,_hmCur=0;
  for(const c of hmCells){_hmTotalQ+=c.level;if(c.level>0){_hmCur++;_hmBest=Math.max(_hmBest,_hmCur);}else{_hmCur=0;}}
  const _hmStats={totalQuestions:_hmTotalQ,bestStreak:_hmBest};

  // Start date = today - 90 days
  const _hmSD=new Date();_hmSD.setHours(0,0,0,0);_hmSD.setDate(_hmSD.getDate()-90);

  // Month labels: one per column (each column = 7 days)
  const _HM_MONTHS=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  const _mlArr=Array(13).fill('');
  let _lastHmMonth=-1;
  for(let col=0;col<13;col++){
    const d=new Date(_hmSD);d.setDate(d.getDate()+col*7);
    const mo=d.getMonth();
    if(mo!==_lastHmMonth){_mlArr[col]=_HM_MONTHS[mo];_lastHmMonth=mo;}
  }
  const _hmMonthLabels=_mlArr.map(lbl=>`<div style="flex:1;font-size:9px;color:var(--on-sv);font-weight:700;white-space:nowrap;overflow:hidden">${lbl}</div>`).join('');

  // Grid HTML — 13 cols × 7 rows, row-major emission
  const _hmColors=['var(--surf-mid)','color-mix(in srgb,var(--primary) 20%,var(--surf-mid))','color-mix(in srgb,var(--primary) 45%,var(--surf-mid))','color-mix(in srgb,var(--primary) 70%,var(--surf-mid))','var(--primary)'];
  const _gridParts=[];
  for(let row=0;row<7;row++){
    for(let col=0;col<13;col++){
      const idx=col*7+row;
      if(idx>=91){_gridParts.push('<div></div>');continue;}
      const c=hmCells[idx];
      let bg=_hmColors[Math.min(c.level,4)];
      let extra='';
      if(c.isExam){bg='var(--error)';extra='outline:1.5px solid color-mix(in srgb,var(--error) 60%,transparent);';}
      else if(c.isToday){extra='outline:2px solid var(--primary);z-index:1;';}
      else if(c.isFuture&&c.level===0){bg='color-mix(in srgb,var(--surf-mid) 50%,transparent)';}
      const title=c.isExam?`${c.examName}`:c.isToday?`Aujourd'hui`:'';
      _gridParts.push(`<div style="border-radius:2.5px;background:${bg};${extra}position:relative" title="${title}"></div>`);
    }
  }
  const _hmGridHTML=_gridParts.join('');

  // ── Citation du jour ──
  const q=getTodayQuote();
  const quoteHTML=`
    <div class="quote-card">
      <p>${q.text}</p>
      <cite>— ${q.cite}</cite>
    </div>`;

  // ── À retravailler ──
  const hardQs=questions.filter(q=>getDiff(q.id)==='hard').slice(0,4);
  const medQs=questions.filter(q=>getDiff(q.id)==='medium').slice(0,3);
  const toReview=[...hardQs,...medQs].slice(0,5);
  const reviewHTML=toReview.length?`
    <div class="dr-panel">
      <div class="dr-panel-head">
        <div class="dr-panel-title">À retravailler</div>
        <span class="dr-panel-act" onclick="startHard()">Réviser →</span>
      </div>
      ${toReview.map(q=>{
        const isHard=getDiff(q.id)==='hard';
        return `<div class="dr-qrow" onclick="startHard()">
          <div class="dr-qdot" style="background:${isHard?'var(--error)':'var(--gold)'}"></div>
          <div class="dr-qtext">${q.question.substring(0,70)}${q.question.length>70?'…':''}</div>
        </div>`;
      }).join('')}
    </div>`:'';

  el.innerHTML=`
    ${examCardHTML}
    ${document.getElementById('kd-avg')?'':`<div class="dr-panel"><div class="dr-panel-head"><div class="dr-panel-title">Aujourd'hui</div></div><div class="dr-row"><span class="dr-row-k">Temps</span><span class="dr-row-v">${timeStr}</span></div>${avgRate!==null?`<div class="dr-row"><span class="dr-row-k">Moyenne</span><span class="dr-row-v">${avgRate}%</span></div>`:''}</div>`}
    <div class="dr-panel" onclick="switchTab('profil')" style="cursor:pointer" title="Voir l'activité hebdomadaire">
      <div class="dr-panel-head" style="align-items:center">
        <div style="display:flex;align-items:center;gap:0;flex-shrink:0">
          <button onclick="event.stopPropagation();window._weekOffset--;renderDesktopSidebar();if(document.body.dataset.screen==='profil')renderProfil();" style="background:none;border:none;cursor:pointer;width:24px;font-size:16px;color:var(--on-sv);line-height:1;flex-shrink:0">‹</button>
          <div style="width:100px;text-align:center">
            <div class="dr-panel-title" style="margin-bottom:1px">Semaine</div>
            <div style="font-size:10px;color:var(--on-sv);white-space:nowrap">${weekLabel}</div>
          </div>
          <button onclick="event.stopPropagation();window._weekOffset++;renderDesktopSidebar();if(document.body.dataset.screen==='profil')renderProfil();" style="background:none;border:none;cursor:pointer;width:24px;font-size:16px;color:var(--on-sv);line-height:1;flex-shrink:0;opacity:${isCurrentWeek?0:1};pointer-events:${isCurrentWeek?'none':'auto'}">›</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--primary);font-weight:700">${wTotal} Q</span>
          <span class="ms" style="font-size:14px;color:var(--on-sv)">chevron_right</span>
        </div>
      </div>
      <div class="dr-wbars">${wbarsHTML}</div>
      <div class="dr-wlbls">${wlblsHTML}</div>
    </div>
    <div class="dr-panel" style="padding:14px 14px 12px">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="dr-panel-title">Activité · 13 semaines</div>
        <div style="font-size:10px;color:var(--on-sv);font-weight:600">${_hmStats.totalQuestions} questions</div>
      </div>
      <!-- Day labels on left + grid -->
      <div style="display:flex;gap:5px">
        <!-- Day labels -->
        <div style="display:flex;flex-direction:column;gap:2px;padding-top:18px">
          ${['L','','M','','V','','D'].map(d=>`<div style="height:11px;font-size:8px;color:var(--on-sv);line-height:11px;width:10px;text-align:right;opacity:.7">${d}</div>`).join('')}
        </div>
        <!-- Grid: columns = weeks (oldest left), rows = days Mon-Sun -->
        <div style="flex:1;overflow:hidden">
          <!-- Month labels row -->
          <div style="display:flex;gap:2px;margin-bottom:3px;height:14px">
            ${_hmMonthLabels}
          </div>
          <!-- Cells grid -->
          <div style="display:grid;grid-template-columns:repeat(13,1fr);grid-template-rows:repeat(7,11px);gap:2px">
            ${_hmGridHTML}
          </div>
        </div>
      </div>
      <!-- Legend + stats -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:9px;color:var(--on-sv)">Moins</span>
          ${[0,1,2,3,4].map(l=>`<div style="width:9px;height:9px;border-radius:2px;background:${l===0?'var(--surf-mid)':l===4?'var(--primary)':'color-mix(in srgb,var(--primary) '+[0,25,50,75,100][l]+'%,var(--surf-mid))'};opacity:1"></div>`).join('')}
          <span style="font-size:9px;color:var(--on-sv)">Plus</span>
          <span style="margin:0 4px;width:1px;height:10px;background:var(--border-subtle)"></span>
          <div style="width:9px;height:9px;border-radius:2px;background:var(--error)"></div>
          <span style="font-size:9px;color:var(--on-sv)">Exam</span>
        </div>
        <div style="font-size:10px;color:var(--on-sv)">Série max : <span style="color:var(--primary);font-weight:700">${_hmStats.bestStreak}j</span></div>
      </div>
      ${_hmExamMarkers}
    </div>
    ${quoteHTML}
    ${reviewHTML}
  `;
}

// Déclarations partiels (avant renderHome pour éviter TDZ)
let _partielEditId = null;
let _partielStatus = 'todo';
let _partielConf = 1;
let _partielGroupCtx = null;
let _partielGroupEditId = null;
let _pgFeel = 'medium';
let _pgDetailId = null;

// Caps par type de phase (déclarés ici pour éviter TDZ lors de renderHome())
const _CAP_VOIR     = 5;
const _CAP_REVISER  = 5;
const _CAP_REREVISER = 8;

updStreak();renderHome();renderDesktopSidebar();

// ── Surnom hero (séparé du prénom profil) ───────────────────────────
(function(){
  function _getHeroName(){ return localStorage.getItem('kp_hero_name')||''; }
  function _updateHeroName(){
    const el=document.getElementById('dash-name');
    if(el) el.textContent=_getHeroName()||'Étudiant';
  }
  _updateHeroName();

  const el=document.getElementById('dash-name');
  if(!el)return;
  el.style.cursor='pointer';
  el.title='Cliquer pour modifier ton surnom';

  el.addEventListener('click',function(e){
    e.stopPropagation();
    if(document.getElementById('_hero-popup'))return;
    const cur=_getHeroName();
    const rect=el.getBoundingClientRect();

    const popup=document.createElement('div');
    popup.id='_hero-popup';
    popup.style.cssText=`position:fixed;top:${rect.bottom+10}px;left:${rect.left}px;z-index:9999;background:var(--surface);border:1px solid var(--outline-v);border-radius:14px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:10px;min-width:240px`;

    const label=document.createElement('div');
    label.textContent='Ton surnom sur le tableau de bord';
    label.style.cssText='font-size:11px;font-weight:700;color:var(--on-sv);letter-spacing:.5px;text-transform:uppercase';

    const inp=document.createElement('input');
    inp.value=cur;
    inp.placeholder='Ex : Ayaat, Champion…';
    inp.style.cssText='background:var(--surf-low);border:1.5px solid var(--outline-v);border-radius:8px;padding:8px 12px;font-size:15px;font-family:inherit;color:var(--on-surface);outline:none;width:100%;box-sizing:border-box;transition:border-color .15s';
    inp.addEventListener('focus',()=>inp.style.borderColor='var(--primary)');
    inp.addEventListener('blur',()=>inp.style.borderColor='var(--outline-v)');

    const btn=document.createElement('button');
    btn.textContent='Enregistrer';
    btn.style.cssText='background:var(--primary);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;width:100%';

    popup.appendChild(label);popup.appendChild(inp);popup.appendChild(btn);
    document.body.appendChild(popup);
    inp.focus();inp.select();

    function _save(){
      const v=inp.value.trim();
      localStorage.setItem('kp_hero_name',v);
      el.textContent=v||'Étudiant';
      popup.remove();
    }
    function _close(){popup.remove();}
    btn.addEventListener('click',_save);
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')_save();if(e.key==='Escape')_close();});
    setTimeout(()=>document.addEventListener('click',function h(e){if(!popup.contains(e.target)){_close();document.removeEventListener('click',h);}},true),50);
  });
})();
// Set logo
(function(){
  const LOGO_LIGHT='data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAfQB9ADASIAAhEBAxEB/8QAHQABAAAHAQEAAAAAAAAAAAAAAAECAwQFBgcICf/EAEEQAQACAQMEAQMCBgECBAQDCQABAgMEBREGEiExBxNBUSJhCBQycYGRI0JSFTNisRZykqEXJENEgtFTYyVzwcL/xAAbAQEAAgMBAQAAAAAAAAAAAAAAAQIDBAUGB//EAC8RAQACAgEEAQQDAAICAQUAAAABAgMRBAUSITFBEyIyUQYUYUJxI1KBFTNDkbH/2gAMAwEAAhEDEQA/APZYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAky5ceKvde0RCyy7voscTNssf7FLXrX3LIC127X4NdS1sFotFeOV0LVtFo3AAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8gAf4P8AAAH+AA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC11Wu0+npa18lfH25azvXVeKtZrp7xEx+6YiZa2fl4sEbvbTas+pw4Ymb3iJhrW/wDUf0MExh45/LSN03zV6i02jNMRP7sFrNfqJ/ryzNVuyXneV/IY324obJuXUWrz45iMs/25a9n3XVXt2zef9sbbUZJn9NvCbHM2vHJNXEyc7Jlndpl1L4kve2m19b2m0xOOfP79zemh/EVeMe4z/wD4v/8Atvikxp7Po9ptwqTP+/8A9kAHTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlZa7ctNpKz9TJHMQItaKxuV6pZc+HHEzfJWOP3aVvPVuSlLRp7Q1fV9Q6vV1mPqTE/fybhyuR1fBi9eXTNTv2iw883iWK1HWGlraYrw5lm1eovMxbJK1z5bTEdszz90xDi5uv5ZnVIdE1fW9af0TErO/XGaY5rLQ+yZjmEsc9vmE+GlfrXJt6lvNettVPmbKeXrrV1nx5aT5m3rwm4txzB4YY6tytfk3O3W+stXnnhWw9baqKfqt5aNEcx6TVieeZ9GoI6ryt/k3r/45zxbiY5XFOuLeO5z60WivMIfbng0yx1jlV/5OnafrLHM/rtHllNH1VosvFbWjlxqJtM+p5T1y6jFaJpaUabmLrmev5eXd9Lumj1HiuWsT/deUvS39N4n/AC4Ni3TU4rRNcluf7tm2XqXUUrE2vPP7omdOpx+uYr+Lxp1UavtfU1MnEai0eWy4MtM2KMlPNZ9Ds4s1MsbpKcAZQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQBQ1Orw6endkvEQ1je+qa4ZtXT2ifwMGfk48EbvLaNRqsOCk2yZIjj92tbx1ThxxNMFo5hpe4b7qtXMxN55lg8ts05Jm1pnlMaea53Xp81ws5u+85dTFu288z+7Aze0zNr2nlCLxW36ltqcvNpirNX1t5fLmvntu8ps2eIiYWWS1sk+zmbWmJVMOPmwjt0krX0ye26DLq8la48cz5/Crt+15tVnrWlJnl1HpXp2mgx0y5ax3ccomdOp0/pmTl23PiqboDar7Zos3fExOWaz/AK5//i2YiOI8RwMMzt7zBhrgxxjr6gAGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUtRnxYKd2S0RCjrdw0+lx2te8cx9mh9S9QTmi0Y7+P7piGly+dj41dz7ZrqLqfBgx2phv5/Lnu6bvqNVebfUt5lY6jPfPkm15mfwpRHP2XiNPE83q2bkzreoLZL2vzNpmEazbnx4Qin3T1hOnNiZ0jxP3QtH7J4jwlsJ2k4O39kUYVVQisfhGIREiHEfhJaPPCp9kl45lMJiSOOCIjghDmef2EzKbjx6Q/wnj0gLbSePwjM258TxCPb58HEoVnyuNHrcmC0czMxEt+6X6npGOuLLMcOcccxwqabJbFkjiZiETDf4PUcvFt4nw7tpNVh1NO7FeJV3J9m6ktpckV7/Efu3jauptLqqx32isqPacTqWLkR71LYBbY9dpckx2Zaz/lcRMTHMTEjoRMT6RAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAlvetK91rREMHu/UWl0nNK3iZGPLlpijdp0y+q1eDTxzlvENd3jqfT4qWx0tHn7tR3rqK2otMd/v92vZ8182TmbTMf3W7Xmed16Y+3CzG677l1EzWMluGGyZb5fM2lJFfKpWse5lfUPM5uVkzW3eUtI49mXNWlfPtS1OorTmI9rC+SbyuxRtNqM02mZjxChHNk1o5jhNirP9MRzJtmr6VK4+6IiIZ/prabanUf0zMyn6f2XNrJrxSXTundkxaDFF5rHfwra2odjpnTL8i3dePtUOmdhx6Kv1ctI7/tDYoBhezxYq4q9tY8AAyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhMxEczPEMVu++aTQVnutFrCmTJXHXutOoX+q1WLTVi2W0Vhhd56i0uLDNcOWJtP3iWl9R9SX1l5rFpin24a1fLe8+b2laKvO83r1a7ri8/6ze9bvmzd0Rkmef3YC2W94mLc+U3EyhxKYjTy2fkXzTu0pK18IxzHjhNEIzCzXIiOCIgnlARHhHlLPklGEJ2l7ZRiE3lFCUnH5QlG6WUq7RifPDJbdtl9ZSOyPPLFR/U2LpbX/AEMtK244iTeobfCx0yZYrf0yWk6MzZaRNomJ/sr5eisla8xHPH7N+2/U49Tp65MfHr7LlXul7WnRuHMfi5Hqel9dW8/Tw24j9mJ1e2azT3muTFbmP2dx7Y/Ef6WWu2zS6qtu/HXvmPfCe5qcj+P4rRvFOpcRnFkr7rMIcePLc+o9iy6WbcV5r75hp+Ws1vMfumJ28pyONk495rkhIkvE8Twqe0J98DBMLatbzPPqVfDqNTht3VtPEfblNKWUdrJXNavpfaTe9bS8W75iIbLoeqs8VrFs3/3aXx5OZhE13Ldw9Uz4o1Eum6Hq7FFojJfn/LO6DfdHq54reI/y4rF7RPPPC90Gvy6a8TW8+TtdTj/yC8TrJDuVLRavNZ5j8oucbL1ZlwTXFmtzVvG2brptdSJx3iJ/CNPRcXn4eTH2T5X4CG6AAAAAAAAAAAAAAAAAAAAAha0ViZtPER9wR+zCb3vOHS1mkZIi0futOo+pMOjx2pitE2c03vdsmsyTabT5/daIcTqPV8fGjspO7Nj3XqbNfmlc3Mf3atuOqyZ7d3fM8/usu+1q8T5Ij909ryXJ6hl5E7sh3W7o58rvHEcR5UaV/CrxWkc2laI058z52qzxXyttRqKRExE8St9XrPdaSx1ptaZtMytpaI2uL277TM2IiI8x6UccxMK1KzMcQnbNqIT6ek5c0UrHMz9mzbJst82ekTjnn+x0ZseTU66mTsnj8uqbZtWHSz3zWJspa2vDu9N6VbPMZLekmwbVj0OCs9sd0wywMT2NKRSvbUAFgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFvrNZg0tJtlyRH+REzpXmYj3PDG7nvGm0cTWbxN2r771TSZtXFfj+zTNbumbPmmZvMx+6YhxOb1rFh3FPMtt3vq601mmK3+mla/cNRqss2vkmYmfSz/AFzkta0zMSmmvHmPKXleZz8vJ/KfCFvMxKrEKXFpmJVuFoc+I0jHBMRwhCPmROkvo5R7ZIpPIjSEz4S8/dNavHhLwCPJB5RgAPCCBLeUE1kqVZJiE1M04eJrzyl5jhLMWm3rwStSdS3fpLqG+Ca4r3/T+7oml1OLUYq3paJ5hwnFa2OY4tx5ZzbeotRpr1rOS3ZCsw9R07rcYq9mX07DExP3JmIjzPDnmm6upSZm1pnlJq+se+sxS0wq7E9a4sRvbdt8/l7bfkjNMT48ON7hERq8la+onwv9d1DqtTeYnJPbP25YjLl78k2n7r1eb6t1HHy5iKx6BL3QjFoS4so8eEOD7o88pQhwhMI/c5gIS8IW8J5mEt6zaP0iYK2nmJhmNi3bLpM9Zi8+2GiLRHryqaeLUnnjyhnwZLYrRasu1bDuePX6asxP6ojyyTQfj7NaMnZNvbflJjT6DweR/YwxcAQ3AAAAAAAAAAAAAAAAAQmeI5meIYPfd8w6XFNMVom/3GPLlrir3WnwyO47hg0WPuyXjn7Q0rqTqu84rYcduIn8MFvW8ZM9+fqTPn0wGpyWy5u+Z5hasPKdR63Nt0xI7jq8upyd17TP+Vpasz7Vr1ifMJeJlaHmbTNp3JWvEcKlKlYj0l1GWMVOefKyqpfJTHXmZY7Wau157a+lDPntlt5niEkTVNUxUjz5lHgiYn0mx8WyVpHmZnwmV4iUMcceobT0lsOfcc9ea+OUmy7Dm1GakXx+3Wendpx7fpa8ViL8eWO1ne6X0yeRPfkjwrbJteHbtPFKVju48yyIMb2dKRSO2PQALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACF7VpXutPEKOo1WDBWbZMkRx+7Seq+qorziwW4/sNXlcvHxqd15ZzfeocOkpamO0TP5c63rftVqc1oi8zX+7Ha7cc2o5tNp8rSszaPK9YeK53WMvIt21nUJr3ve3NufKWfwn/Y45+yzk7mZ8pY9JoOASjCp9uVKPaf9kJhNwjHtCE9Y+/AEJo9KGo1uk08TOXLWvH5laaDfNFrNVbBgy1tMfiSInS2l9dTVLwpyKTAH+CRAfdBEVS29oJpQ4SrKVNWPCCavoIQmBMCUImYhLPMpziEMsKU15JVOIST7IVlL5TR7hBNCVUyMe0IRFgJ9IIEYRr4lCE0RyhKMx5T0jyknifCrhjukXhtvQ02rrKcOkND6Dw85ovMem+Kz7e96TSa8eNgCHUAAAAAAAAAAAAAAFHV6imnxTe8xHC33LctPosM3teJmPty0LqHqS2eZrS3EfhMNDmc/Hxq+Z8sn1B1NNeaYrcNL3Hc8mptMzzz91tq9RbNPMzPlQnxHC8Q8XzOo5eTbzPhLa088yl8TPhNbhDj8EObKCaIOOI5lbarVRWJrVKNKufNXFTn7sVmzWy2mZnwhlyXyT5nwljx9mSI0tEaQ4QpMTKMyhETz4gleqpWPE8Q2DpTZc2t1uO/05msTyp9L7Ll3DU0iaz2zP4dk6d2XBtunrEUjv4/DHa2odvpfTLci/ff8YVNp2nDpa1vMRNuPwyhAxPaUpFI1AALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADH75uFNBo7ZZmOfwl3ndsG34LWtaO7jxDmvUO/wCbX3tEz+n7J05fUOp4+LXW/uT77v8Am1N7Vpa3H92uZ8n1p5tMzJa82nnlJwtEbeJ5PMyci3daVK2O0x4T0rMV8puDx6T6amjj8I19IQmqkmSYhDjyWmOfCePFeZEoRXzCtGCf+qeIYndd82/bMM3z5azaPty0Lf8A5GzZrWpoZ4r6XphvefEJ9Oibnuui23HNsmalpj7ctF6h+QO+bYtFHb+7QNZumt117XzZbeZ9crbj9PM8ct/HxKx+TDbL58MruG97lrMk/VzT2/tJ0xuOo2/d6ZoyTNbT55liY9SY79tueWz9OutaIy229DbXrMeu0dMlLRMzHlczSeXK+gOqKaXUV0+pv/xz48uq4M2LU0jLitFq28xw5OfHOO2mSJ2kms8oxSZVPPKMRywnypTjQ7JVeIS2j7i3bClaOEqfIk4FZrCKaI8JE0T4EahE4CJSagmEJhHkQuhNZSzWVT7IceRE+UnajFfKeYSzPCUaR4OPHKXu8o8z6iPIgnx7SxaJlG/mvmJSRbHSObWiFog8q1azPpDPaNPETf1Kz1O86LSVm18tfH7tU3/rLBqJ+lpp/pWrjmV6V3Ldp1OCuPvteI/ubZuWLUauuDFTumZ48OWYd01+46qMVJtxP4dx+Iek8tYpuOrp4+0TDJbHWkbl0+Bw55GWIiPDovTG300+hpkmvFrRyzSFIiIiIjiI9ItJ76lYpWKwACwAAAAAAAAAACTLkrixze88RATOkb2ilJtb1DUd96o/lM1q0/p9Jepepq46XxYbRx6c71+vtqss8zz5WiHnepdarh+zFPlk90322qtPMz5YbNeclueVOEeeE9sPJ5uRfLO7SjEzP9X2RnzCWPKescp0196S1rPKeYiscyWtWkTNmO1eqm0zFZ8LRCJmZVNbqeY7aSx/mZ5meSbc+fuRMc+V+2F48JZmOeCJ7vXhC3HfKakTPpLL2wkn3Ecc8th2jZcma+Purz3eljsu25tZqaxSszHLsfTWyY8WHFlyV/VWGK1ph1um9N/s23PpU6S2PHoNNW96x3/ZsSERERxCLE9rix1xVitQAZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJlgOsup9B03t19Vq8tYtEeKzPsiNomYiNyz/I88aj5/xzvdaVxVrgieJ8uw9GdZbR1NpKZNHqKWyzHmnLJbHasbmGLHyMeSdVlswRP2+4xswHK2z63S4csYsuatbz6iZBcWtFazMzxEMH1Bv2DRYJrS0TeVh1bv0aTHMYLxbx9pc43Ld8uvyT3cxx9+VoiXH6l1OvGrNa/ku993XLrMk83nhifM18+ksX5jifKEzKe2Xhs2W2a3dafKePRJWfCMcStpSI8HtCyaISZLTHiINInwlmeEa2K/qnz4hrnVHVei2fFaKXrfL67Vq0m06hHtmtz3DS7dgnNqsla1iPy571R8j44i2Hb/1R65ah1Vv2s3q/dbNauOf+nlrtdJXu8WbuLixHmzNEViPK93HdtZr885M2a0xM+uVOk+eYhSjBEe7ekaX7ZbtYiI1DFeN+l3jmeJmE8T+ZWlMvEynnLwnbF2SuJnn1CSfSnXNxBOXn0bhP07KndasR2zxMfdunRvW2XbbV02rtNsfrmWk0/XxEqsY6W8T5UvjrkjUsld1jUvQW0b3t+54otgy15/eWS54jxMT/AGeetsz6vRZIvp9TakR9oluO19d6rTVrjyx9T95aF+FaPx8m4h1KeUsxLXdp6w0GrpH1bxS0s3h3DR5o/RliYn92tbFavuFotEp8scSkiFfimaOa2jx+5ODiOe6P9q6lKlwjEcQn+nEf9Uf7O2vH9Uf7NKz4SfcLzjr/AFXj/a3y63S4/wCrLH+09syhXmeEs34WOXedsr/VqKxP91rqeotoxRMxqYmf7r/Sv+kd8M1F/wAo1tz4ahq+tNDjifp3i0sVqPkC/MxTFC8cfJPwd0Q6L/e0R/lTy5ceOOb3r/ty3UdYazPP6bTXn91jqd71+SszOotx/daOJb5RN4+HUc+77dg5m+WPH7sTrus9twc/TvEzDl2fW6m/nJktMT+60zR3eeOZZa8OI9yr3eW/a35Anun6VeYa7uXWu4am01pE1ifwwM4pnHzWszP4XW3bZqNVkisYrcz68Mv0aVXrbXhLl12v1UzNst55+3LNdNbRqNdkiv0rTM/eG29FfGe57leL2xW+nPHM8O79F/He3bLhpfLSMmTjzEww5c1aeId7gdLy8jzPiGnfGXxtWL01utx8U9xzDtGk0+LTYK4cNIrSscREJ8WOmLHFMdYrWPURCdoXyTedy9dxeJj41e2kACjaAAAAAAAAAAAY7fNfTRaS1u6Iv+BW94pG5V9Vr9Np+fqXiJhpPV/U0Wx2xYbcR+zA751Bkz2tEe+fy1zLqL5LzN/K0Q8r1LrXdE0xI5dRmz3ta9pmJU8cfq5R+3EeCnifa0Q8nO5tuU4c/seUp3CasJr3jHTutKnfJXFXusxOt1tstu2PSYiZIjarqtVbJaYrPhQjzXn7reLcKmPL+y8RpeIVJiIOePslrl58TVGb8RzxylbtlCaz74Xu06PJrM8UrE+zR6XJntXiszFnTuhOmIw1rqM1f3jmFLWiHT4HBvybxGvDIdGdOYdLp658lf1/iW3ViKxxEcQhStaVitY4iEzDM7e6w4a4aRSsACGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkFpuusx6HQZtVltFa46zPmXjn5k671XUO8ZsVMlvoUtNYiJdw/iH6nybbst9HhmazaOJmHkPLnvn1GS9p5mZ5b3Fxb+6XH6hyZieyFpljNbLNo7m2/HfVm6dN7xiy4M14xxMd0csBS3FJm0QlnNFazaOOW7asTGpciuSaW3Evcfx31/tnUugx1tnpTPFY5ibe5bv3R290THb+eXz02LqXcdm1Fc+kz3rMT9pdN0XznvNNtnTZM/Nprxy5+Tizv7XZw9TrNfv9vQXyD8i7f03jyYotF8vb4mJ9S8163rzqfeuo5z4NRkmnf+mI+0NZ3jqPcOpNX2XyWva8/l0Hofp+mj09MuWkTaY58wn6cY/bkdQ6paZ7azpuen3HV6rbcX8zeZydsd3KTB5tKWYrHiviFTBH+mL285kyWvO7TtViCYR9H9xiQr6RjwmiPCHCExKaiXPeuKk3yTxH5UdXqsOhw2zZ7xWIj7ubdX9Z31lp0+jtxXnieGTHitknUInyyPWvWVdLW2l0U839d0OV67UajV57ZNTa1rWnmF3q7zN++091p98rO3dkvy6ePFFI1CPxnwRTniOPBNOLeIXMTHFY4Jjj7Mi0raeJpPNfK148r+3r7eVC2OvP4CPKhETPpPWl7RP4hd6PB35IitJs2TZ+ldz3KezBosnFvvwra0V9s2LFe86iGnxFueE1YtzxES6poviDeNRj7pxWrPvzDG7v0FuW0TaM+lvMf93DH9WkzqJbFuDyKR3TWdNCxd3PpdVjivPHlkM2hjBM1tXtn91C+OOOGevpp2rO/KnjmeOU97RxExCSZmI4iEmS0+I4SxW9aVseS1Z5raYn+6/wAW6bhij/jzzEf3YX6kxKaM1uCYiWHUtk0/U2746cRnt/tc16t3biItms1fDltMTyqxeVJxUn4Um1on22WeqtzmP/NlTv1TuseIzWYCckxCE5ZmPSPpU/Sa2tvyy2p6k3a//wCvb/bH5923PJ/Vnt/tazfnwha3EeiKVj1DLEyky6rV2t+rLb/anN8tvd7f7T38+UseJ9cysv8A9I0pP5nlVxeZ/VPhDHjzWvEVxzPP7Mtpth1uqtWmHDe3P4hWZgmlreoWeGaTHv0q45i/NIiZmfs3Tp7403fV5KxbT5K933mHSNg+E7Yr482oyR+ZiWG+elfct7j9J5Wb1Xw4LG2avPMVx4rTP28M/snQW9bhMTXTZJ5/9L07svx3suiiLZcFb3j9m1aHbNFo68afBSv+Gvfmx/xh2uP/ABnzvJZ576T+G9Xn1Fb6uOyn3iYdU6d+Ndn220Xy4aZJj9m9xHHqIj+yMQ1Mme958u7x+lcfBHiu1votHptHj7NNirSv4iFxwDC6MRERqAASAAAAAAAAAABM8eWF33e8WixXis82gUyZK4691p8LzdtxwaDBa97R3RHrly7qPfc2t1Fu28zXn0pb/vebXZLW758/ZgaTMytrTxfVurWzz2Y5+1Le1rXmbSRCaYiUFocCJmQEePCUSRzPjlG94pXmZQtMUr3SxGt1U5LTWs+FohWI2jr9VOS0xE+FnCE+yGSIZYTI1lJympzNSVqqtPavp8NsuWKV9crfFza0ViOZl0X4/wCmP5zjPmrxWPfKkzpucPjX5OWKVZDofpy2aKZc1eKV8+Y9uj4cdMWOKUiIrH2SaTT49NhrixViKxCs13veNxq4KRWoANkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ9gDif8RPSu5bvoLanT17sdI5niHk3ctJqdBntS9JjieJ5fRnVYMWpwWw5qxelo4mJcj6/+Gdr3XFl1OiiK57ee3huYORFY7ZcvmcKck91Xjec2S89selL6tpzxit6b/wBdfHG89PZrxkwX458TENM/lL481fq14tH5dCJi3mHAvS1J1MJbYsfmJla/ysXyxFOeZnwvc/6LzM/dsnQWwZdz19clqT9Os8+kWmKxuWG9+yPLYvi/pePqV1mpp/bl1XFjrip2Vj9Knt+kx6TTUx46xXiOFefbm3v3S5GbJNrbSTjr/tPjiKx4Q9poUYNpomEYnmUn3RrMcpTtU89vhbblrcOh0ts2a8R2x6lDc9dh27SWz5rRERDj3WHUeq3bWTTHea4o8Rx92XDim9v8RWJtKHW3VGq3PPbFiyTGKJ8cNf08VrTv55vPtbW78eSZt55VsXdMRMepdWtYrGoLzGvCfJxeElqUieY9qtomY4iCuK88zwnSkSs/r3i0+SdTa0ccpbY5nJaJ5ZXp/pvX7tqK49NhvbmfwrM6jy2KVtedRDH6aMua0UrHNp9N56R6B3PeL0jLhvFbT+HUPjb4Ym049Vu1ezt8xDue0bHt+24a48GCn6Y454aWblxXxV6Lh9Btk1bL4hyfpL4Y0elnFl1VYn7zEurbNsG2bVgrj02mpHEe+GWiOBoXyWvPmXp+PxMWCNUhJXHSPEY4hZ7ptWi3LTzh1WCtqz9+F+MbYmInxLlnVXxFtOurbJo6xXJLjnWnxlvG0904cNr1j1xD1so59PgzRxmw1yc/mGxj5N6OZyek4M/nWpeB930G5aO8VthtWf8Aq5hic+bUxxzD291F8cbHvGS+S+KuO1vxDnfUHwTpcszOlv7bleZWY8uDm6DlrP2+YeXr6q8eJ45P5nJ9pjh2/dPgDc+6ZwTPDBaj4K6mrb/ix2mGeORSflz79L5FZ/BzTBqcnCvGovPHmHS9H8G9SzXi2OYX+m+B9+mecnMf5hP16R8te3S+TM+Mbk1s+TmPwnrlvb8fu7Pp/gXcZmPq3lt+w/A2348Ufzmaefux25WOvyz4+h8q8/jp5ux1yZrxGPHaWS0OxbtqrRFNLkmJ9TES9V7f8RdOaSYmte7j8w23aemdo27D2YtHit+81Ybc6PiHS4/8cyf/AJLPKmx/G28ayItlwWrE/mG8bN8IanJFMueIis/aXobHpdNSOKYKV/tCtxx4jxDBbmXn06WH+P8AHpO5mZct2T4g2fTxE6rHEts2fojYtttFsGnrMx+WzjBOW0+5dXHw8OPXbWFLHgxY4iKYq1iPXEKnH7ojG2tAAAAAAAAAAAAAAAABKFpiI5meIa51Lv8Aj0mOcWO0TMx5kYs2amGs2vPhP1NvmPR4bY8Vo7+HM933jUanJNbTzEqW7bll1eotM2mYmWNnmbr6eF6l1W/JvqviqePE8kxyjEeEeE6cpLWscpu2COfwnrHIrKTtQyzFK8yr2iK15nxwwu66yLc0pK0QjUqW462bWmlZ8MfE+UJnmeSJ5ZYhk1qE3ch3T90J9wfdIjz4T0jJaP0JLQz3S+2X1mWnFZmOVbTqGbBinLeKwynRmwZNfqaT2eeXadn0GPQaSuKkcTERysOldox7do6z2x3zHtnGva23vOncGvFx/wCyAKuiAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHH4AGF6o6f0O+6DJp9VirN5r4vx6eQflzpf/wPds1Mdf0VtPE8Paua9ceO17zxWI5mXj7+IrqTBr9/yaPScc1tNZ4+7a41pidfDk9VikY9z7cq23R5dx3CmnpWZ5l33o3YqbXtWOOyIvxzM8NT+KOma4sca/VU5m3mvMOnTaIrFY9QyZ8sW8Q8byMvdOlD7pLe1TLx9vCjz+7XaMymhFJyjHMxMCm0Jsttw12DbtNbUZ7xWKxzHKrqMlMGK2XLMRFY5cb+R+qL6/V20mnyT9OJ48SzYcc5Z0tSs2nwq9VdV5t6zZMWO01x1niIifbA35rSPysNtmsY5mf6l/E91fLqUpFI1DLMzEaWuWe63FpXOni304iI5U8laRHrmVKmTJ3cRPEQtvTF2zLJ1pzPPC6xYu6e2sTMqGgpk1PGPHEzaXZPi342zbpNNRrMc1pE88zHtjyZK0ruW3xeFk5F+2sNO6A6C1fUOujt09pxc/qnj09K9C9BbV07pKxGCl8vHua+me6f2Pb9l0sYdFgrSeI7p49sq5ObkWyT/j3HA6Zj41dzG7IVrERxHER+EQa7qAAAAAAHB5AEPP5PP5RAQ8/k4n8ogIefyjx+QA4j8AAAAAAAAAAAAAAAAAAAAAAJM2SmKk2vPEJrTERMzPENN626gxYcM4MNv1R94lMRtg5PIpgxze0p+o+oZxxamO0Rx+7nm5bhl1ma0zMrLXbhqNRfm2SZ5lTpM8RK0Rp4PndSycu0/pNx55mE0REyc8+0Y4TpzdInCbhHhIhWOVSKxWO6fSHiI5Y7ddb2UmlbJiNo+VDdNfzacWOzE3mZnmfJaebTafcocssV0n0kTQSgnS20yEzwp5Jt9pVNHS2ozVxU8zyJis2nwv8AadFk1morjpWbWtPHDtfQ3TWPbdLXJnpE3mOeJhhfjjpiMNa6rNTz7jmHSI4a+S2/EPZ9G6bGGn1Lx5lGI48R6AY3fAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY7qLDkzbPqMeKeLTSeJeO976P12o69yZdVFrY/qTM8/3ewuodbTR7fe1rREzDi+8ZsOfcZyUrEWmZ8s+HJNNvO9evWKR58rPRaemj0tNPjjiKwrzbwkv5nlBWHj7eUck+FGbKuSP0qFloYpTRKek+JmZ4iPuoRPMtd6+3+Nn221KW/wCTJHEcLVpNp1CIjc6a58m9WfT7tBpL/q9WmHK7917zkvPNp98q2sz5dVqrZ8sza1p5U7V8eYdTFjjHXUNyKRX0utDE8fsyVfMREMXopnzEMni5mseYZWO1dyqfRmYSafR5c2pjFSkzzPjheaas5ZrjrHMy698OdBZtx19NRqsM/TpPdzMMeXJFI3LZ4nDtyLRWq8+HfjLJq8ePXa3HNaRPPEw9EbbocGg0tNPgpFa1jjxCbQaTDo9NXT4KRStY48LhxsuWck7l7vh8OnFpqvsAYm4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJcl646za08QZclcdJvafENQ6m36tItSl44IYORyKYKTa0qvVvUePTaecWC/6p8S5ZuGsyavUWte0zEz4T7nrcmr1Vu6Z45WkVmJ5n0ya08B1PqN+Zf/IS9nnwrxHEJItHtUj0mHNojEHmJITcC6NZVa15SYqcqe4ammmxTHP6hKjuerrhxzWJ8tfy3nJbusm1Ga2XJNrSpxLNWEITKHPnhC8+UtZ8+4WE8zyTzKWPapjrM+I8ykiEkY7XvFKxM8uifG/SH8zmjVZqTFK+Z5YzojY512qpE4+eZ8y7dtWjpotHTBSsRxHnhr3tr09R0fpvdrJk9K2mwY9PhrixViK1jhVBhesiNAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJJc/8Alj5A0PSe2XrXNW2qtH9PPmE1rNp1Ct7xSNy37ujn+qv+03Lxf/8AjlvtN2m38xecUW547vs7f8afM+079Smn12WmHJxx3TP3Zr8e9Y21cfNxXt27dhFDRavBrMMZdNkrkpP3iVdgbgkvaI92rH95YDrbqjS9ObZk1OS1bZKxz28vL3VnzVvm6b3OHbs18NJt28VsyUxWv6avI5ePBH3S7t8obrFtRXBgy81j+riXPe+b5YmVps+q1mq0NM2uva97xzMzK7pH/JytMa8PCdR5k8rNNo9LnmeUyVNA50llG3tXmOUK0ieZ49CFnuWpxaDQ31GSYiIhw/qneLbnueSZtN8fPiG6/K+/dlP5HBb3HE8S5fgr3X8z5+7f42PUd0s+KmvK8wxTt5mkJsladnikJq1/REQTT78tln8sZnt2ZfXEKmLU817eZ5Sayn/L75Zn4+6f1O/77i0uHDNom0fZWZ15llx0m8xWHSPg/orVb/raZ8uKfoVmJtMw9W7Ltel2vR002mx1rFY4mYj2w3x103h6b2HDpqUiuSax3+G0R6cnPlnJZ7XgcOOPjiPkAYW+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEySwnUm84dDpLduSO/8AuMeXJXHWbWnwsusd9x6TTWw45ibTDlmv1mXUZLWteZ5lX3zcMuu1U2m08f3WHbyv6fPuq9Stysmo/GCtfH7p+3wRHCKXKS9v7Iz4R5SzIQimrEzPhL+yp300+Kcl+PCUpdTmppMM3tbiWrbhrbanNNufHJvW421eaa1nisSsKTwy0rqPK9YmIV4tPuJR7p/KnEo8skJRtKSZmJ9ozP7qWT3AtX2rUvzMRz5bF0rtmXW6ula0meZYPbdPfUamuKlJnl3H466bjSaamry14tx4jhjtfUOt03hW5GWPHhn+ldkwbVo68VicloiZn8M2QNV7qlIpWK1ABcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABC3oGP3/AHHDtm159ZmvFIx1mY5l4f8Al3qfPvfU2ozTktfH3TERz4ejv4m95vtvTcYseSa98TE8S8banVWy57X555s3+LjjXdLi9S5E7+nClPM5J4pMQr7frNRobxlxWvSYn7Sl+pPMePKGS03jmIhuTG3I3Menavjv5c3Ha9PjxZ9Rb6cccxMuv6b5q2vLtkT31jN2/l43v38VikzH9lXFmz04iMlo4/dhvx6WbeLn5KRp1z5Q6+z7rfNFc02rbxERLSPjfa53HfO/JXmO7nmYa735Mt5ibTMy6/8AF21/y2211N6xFp+6t4jHXw5vPzTaO6ZbpXF9DDXHXzFY4TYeZvHMKkflPXzLScS07VOIg8cnCEpUTKO5amuj2/Jmmf8AplWxRM2hqXyPulNNpf5WlvMrUr3W0R5nTlHUepy67dc+S0TNe6eGNwxxef3ZnVzWac8RzLFZYmt3VjxGm3WV3h4mvEz6Ml4iFtS0+fPCTJe0Y5rCF4VMOlyavX0pipNomePD1V/D10Zptv26Nwz6eIzTxNZmHIvgjpqd51UZr4+6K2+8PXO0aLHodBiwYqxWK1iPDR5eT/jD0XReJMzOW0eF3CINB6YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJFpuesx6PTWy3tETEeBFrRWNyxvUu7V0eKcdbdt/7uXb7ueXU6mYtaZhe9TbtbWaq1+Z9teyTN78ytX28P1fqU57TSk+CY5nnlHu/b0RVMtpwJg/dCULIciukeSsczx90Puu9NhiP12+yYTpS7Yx0nJfxENZ3zcpzZZxY7cVhedWbvWInT4Z/vw1OLTaeZmeWWtExVdeOfaMTH5W8IsmmVcxaOPaMTH5WnKpWfyGtq8yq6PBbUZYrWOVvEzxDdfjzaLajU91qe/XKt51G2fi4JzZIpVsHxv03XJq63y08R58w6/hx1xY646RxFY4Y3p3bKaDSxHH62Vatrbnb6BwuLHGxRWABVuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABITHIPOn8X1M8bXW1ee3ieHk7TWntnunzy+hPyp0Xp+sNjyabJPGWtZ7P3l5P6i+EOrtDqMltNo7Xxd08TDocbLWK9suF1DjZJyd8RuHL8Pfe67rhjxH5bZb416r0te/JockTH7Mdrdi3LQz/+Z0uSsx+zbi0T6lzpx2r7hYfyvFImFG2Ce7/3XE6nFE9l5mto+0lsmLxMW8p0xWjStsGh/md1w44jmO7y9A7Xoq6LbsWKI4/TDlXxnt1cu51z5I/TE8w7Ln47axHqIafJtuYhzOXfcxC3iPPCtjjiFOsTEq1Gq0ZRmElk8zEe1PnutEQsrKrExTDe8/aOXHertVOu3S8zaZik8Oi9ZbnGi26a0txaYcpyf8172mfNp5bnGp/yZMdflaa2tLY44+zGzWLTMQy2ak/Tnj7MdNZpk5mOG14ZKeEkYbTVdbXtl9ZqKY6xzNp4VMWOb15r64dL+FOl77vvOO005pS3M+FMl+yu25xcM5skVh2n4I6TjYen65cuPjLkjmHTYUdFhrg02PDSIiKViFZxrWm07l73DijFSKR8ACrKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoa3UV02C2W0+IETOvMptTnpgw2yXtEREOadZ77k1OWceK36VbqjfMmW9qYsk8T9uWo5p+tPda3lMeHlOs9U7t4ccqeS/dXmfcqMxxKraLccRCE0mfa1YeUS0RtPhGKSTWeFtoU5Qj3+6ft8q2HT2vaOIEJNPim1o8eOVr1RumPRab6OK0fUmPsvd21eLbdJM2mO/j059r9Rk1eptkyWmY58MlKrVhQy3vlyTkvPMzJWPJEI8Mqybk8IcwJWQn0mpKXujlX0uC+oyxTHXmeUSn/GW6d2/JuGtpjrXmJmHfukOn8Wg0GOb0iL8NP+Kem4r26nPXia+fMOq1iIiIj1DWy334ez6JwPo4/qXjzKMeAGJ3wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACUtq90cW4mPxwmAWuXQ6PJHF9PSf/wB1gt76J2HdaWjLoscWmOOe2Gzkpi0x6VtStvcPMHy78I6fQafLuu2xzWsTa0RHp54zY/o7hbBP2tw9/fJOp0+l6P1057ViJxz4n7vCtsVNd1Zk+nHNZv4/26PFyTas7ec6virjmJj5dO+NtL2aWl5r7hv9mv8AS2mrpdFjpx54Z29vu18k7l5XPbco8p6/lRiypWf0sbXMlin6Y759R7UslvPCTcM8aba82S0+e2eFo8jnPyDuU590nBW36WuYo4pzyp6zVzqt1yZLzz5TzaJr4dOldRENmtdQXvExxDH62OLRwvuI49LbX15ivEJTEaTbL9TPraYKR4meHrj4R6cx7ZsOPWTXjJePPh5p+K9oya/qXBE15r3xy9pbNpMei27Dp6RERFYaXLv47XpuhcfczllewA0HpwAAAAAAAAAAQm1Y9zEJfqY/+6P9gnFOcuKI83iI/unraLRzWeYBEAAAAAAAAAAAAAAAAAAAAAEL2itZmZ4iGldYb5E47YKT4ZXqzd8ek0tsVLc3n8OYblrMmoyTa3I891rqX0a/TpPlSzZ5y5Jsp8JMM88zKovHp4ubTadyQhKZLPsUEBPWvPiINBixd1vS8z5cWh0s5LzETEeFTFjpgwfVyTERENI6v3mdTknBht+mPwy1rtkiNMV1FueTX6y0909sT6WNPUeVC08z+6etvHDPrQrRBb0liyM2jgQl58HMceEk2+yHPjwsbTYub5eIjl0T466cya3VUvNf0zPMzw1HpTbcmv3OlK0mY58zw9G9GbHTadBXmIm9oiWDLbTv9F4M5r99vUMvtuixaLTVw46xHEcTK6IGq9rEREagAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACFvsiTHIOEfxV7prNHtWLBp7Wil6+eHnL452/Pqt1nPeOeLcvbXyB0bt/Ve32w6uvOStf0OC4ujI6Y3TPh7eIiZ4buDJHZNXmevY71r3x6Xmlr9PHSI+0Lu2SJY+b2i8QuefEMcw8hM7VotHKrWfstolWxTzKulC8c2YH5C1VtNsvFZ47o8tk7ebOefKeu7sVdNWfMLY43aF8cbs53prTOotb8yyOO1ePPpjtPH617Th09t3UK8T5nhDN2TNYtHM8oV4VIxzfPjrWOeZhEyrMeHaP4fenrZtd/NTX9NfL0dWOIiPw5x8G7VbR9P01Fo476ukQ5We3deXuumYfpcesADC6AAAAABM8RzICEzER5nhit33nBo8c8WibQ0veetMkxOPHPE/snTR5PUcHHj75bzuO7abRx+q8TLXNb1rhx37Ke3PtZvWq1MzzeZ5/LHXy3vbzPlbth53k/yK0zrFGnQNX1lXJ955WWbqy01/TzDS47vym88e5IpDmZOr8m877m3V6otevZe0/wC2c2jqylYrjtbw5pETzzyqVyWpPNZJrDJh6xyMdtzO3dNs3LT63F3UvESvonlxLbd71OmtWK3mIb90/wBU0zxTDnnz+VdPUcHq+Lk/bPiW3iXHeuSkXpMTEpkOuAAAAAAAAAAAAAAAAMJ1DvNNux2iZ8zHhkNz1dNJprXtPnjw5h1Tud9Xk7Zn7piNub1Dn14tJ/a33jdI1eSZtMzzLEZpm8cVS1iefKM+I8J7YeAzZpy2m1kMcTEcSnSxKMJYU3Hg7fHJCb3HECdJIibTxHtkNDo7W/VbxEI7fpJyXi0wodU7tTbNLOPHMd8wtEL1xx7liOsd6pjxzo8M+Y8Tw0TJza0zz7lU1ee+p1Fs2SebWlSmY48tmsahG1Ka/qS90cqllCeI5/K8eU7VPqQTlhSSXt5To0uItFlxotNfPmrjr5mWPr3WtWKuj/G3Tubcdbjv2+InmZVm2o22ePxZzZIrDe/inpamn0sarPj8z58umViKxxHqPShoNPTS6WmGkcRWOJXDRtPdO30Li4K4MUUr8ACrYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQmeI5+wFvvP7ON/It4ybtmiI88+3Ut03fTaTQ5s9Mlb2pHrlxfqTc53HVZNR2ds3n0yY/bgdfvEYIj/Wv8TOTjhWSxjnnu58qvEcMu3h/KnMzCrgtPdCS1U2KOLRKELq15pS159RDjXXWptn3rJHPNeXYtd42/Jb9pcV3+nfueS3PPlmwfltmwx5YnFHGRdU54UsdOMnMrmvENzbd1Mp8UTMemc6T0kazeMGG0e7R/7sLjmOffDoHwnsk731DWe7tjHaJVvbVZlm4+Kb5IjT090bpY0fT2mw1jiIpDNKGiwRptLjwRPPbXhXciZ3O3vaV7axAAhYAAJGH6i3L+TwTSk8XmBS960r3WZPUajFgr3ZbxENR6i6qpi78WGY4j7tY3TqXV56TS08xE8e2u6vU2zzPd45TqXmOf16v44ZXu6b3m1c2jmZYOJta8zbyq9nnnlNWkQvHp5XLntlt3WlSrXieU0R5TzTn7o1rxKYYpmEvpMm7YJgNpJ/YiOZT1r5TRVCYlSnld7bqb4snv+yhNUK14tFo+x8M2PL2WiYl0fpbqKaVrgz25j8y3fDlpmxxkxzzWXDtLrJxXi3Hp0Hone66i0YL34iI8Ryp5+Xs+k9UjP/47T5bmIRPKKHfAAAAAAAAAAAAFPU5q4MNst54iE9rRWJmZ4iGl9Zb7FOcOOea/fyNblcmvHxzeyw6u336vNcc+Gl5s1slu6yfW6mdRafstqRNZ4meVofPubzLcnJ3Sn58HPJ4RjhLSmYQRjlGI5RiAPsvdBp5yWiePCjp8M5LRDNaeldJp5vb1EckMlI+ZSbpqsO16CclpiJ4cn3/csm4aq17Wma8+GV643u2u1U4cd/0V8e2rW8Rxzy2cdJjyte0J+fBMqP1ePHBOX9mXUse4T2nwt5nymtl4+yj3xPMrRCdwqcpL+fEe01P1/svNu0FtVr8OCs891oJ8Jr5nwv8ApXZMu5azHjrWZ5l6R6J2HHs+3UjtiMnHlrHxx0lXQXrmyU54jmJmHSohpZb7nUPcdI4MYad9o8yQAwu2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsd63TSbTor6vWZIpjrHnkiNomde19ycw5XqPm3pWmrnDjzRbtniZ5hntk+S+mt0vWuDVVi0/mYXnHaPcMVc+O06iW7Chp9Vgz44vizVtWfXEq3P7cqMxMuE/wARPyTremJ/lduy9tpjieJdt3LU00miy58k9sVr93hj+IPfb7rv+eIt3RW3Ef7bHHp3W8tLnZvpY/DDV+VOqs2u7La2848lvMcuv9Pa/Pq9owajNPNrR5eZdur3bhiif+6HpTpqnZ09pYmOP0w2ctYiPDyXUM1skRuWZree5V58KOKOIjlWmGvpw5JnlPijmVOPavgj9UQKyl3y/wBPZ8s8/wDTLjGumcme9v8A1S671jece03j8w5FkiZvaftyz4I1DPgWXHFlWvpC8cXT0rzDYb9fSWZ8u2fwwaW2Tcs2TjiIcWmIr5n8vRf8Mmj+npc2eY/qjwwcidUdPpdO7PDuHAQOc9eAABLG71uuDb9PNrWibT6Fb3rSs2t6Sb7uuLQYZjujvc36g3rLqs0zN+Vv1Ju+fW6qZ7p4YTJa0zHM+VtPD9V6tfNaaUn7UclptMzM+5U5TT6STys4EyR5TpYTJUkRiEEY8iNo+DhGIIhCyNYR4QhFIhMIT4TSkuJhCZ8+PS82bW30utratpiOeVlPlTtMxPMTwrLPhyTitFq/Dt2wbvi1+npFf6ojyy7kXRu8TprdlreeXUts1lNXp4vWfPHlSfb6H0/m15OOJ+V2AOgAAAAAAAABLF73umLRYLef1cCl7xSO6WP6w3WdLprUx34ly/W6rLqck2taZ8/dkuod0vqptE25iZYOOeFtaeC6tz55OXtifthFGpCb9kw4qCMR5J8Iwk2mjiITYqzkvERCTibTwy+1aSeYtMIZKRtcbbpYpHdbxDWuu9+jT1nSYL/q9TwzfVm649q2+3ExFpjw5BrtVk1uptnyTM8yzY6b8s15iPthJkvNrza08zKRCUvM8NqGGUlp/UhyltPkiVkF/wClQrPmYV7elvalueYSb0uMETa3j26T8YdM5tfuOLU2rPZWYmWn9J7Tk1+tx461m0zMPTPRezYdp2nHWtOMlojua+fJ2xqHd6H0/wCvk+pb1DNabFXDhpjpEREREKoNF7qAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEJn/Tzd/FH1nlw2vs+nzTWJrxPEvQu8550+1arNzx2Y5n/7PBXzFvebdeptTkm02iLzHv8AdtcWm77c7qWbsx9sfLUNFxXHkyTntN7SyG27vq9uyxkw6m8Tz+WH0vjHMKtpjw6etvPVtMOsdJ/MO7bZNMeXPe1PU8zLpG2fxDUxxXFqKxMRHt5fjxaOfSnntPf68MFuNS0tunOy0jxL0l1986xuW1W0ujntm0fZ593vXRueqvkzW5m08sXfLafsjii028xytTDWkeGLNyb55+42zFWN1xTXzxZ6O6ft9TY9NHHHEQ88bTH/APdsUcf9T0NsfMbTp4iOPEMfI9Q5PMnWmWrxWIVJtypUieI8J7S1XLk7uFbBkmJiYW8p8XpKJWPXOa07bx+YcvmvHd+HRuu8nGgrH7OeZI/RLaxR4ZcU+FlMc34lc4oiPS2nxddYPMcsjdp6SZ4rExz+XpT+HfLGPauyY4i0PNeq8zWf3elvgHFFtoxWnxPENbk/g7PR5/8AM7BADnvWAALfcMkYdJktM8eJ4ck6k3LPlz2pN5mIl1Xe8U5dBkivuIlx3fsd8epnmJ/qXpG3nev5b0xRFfSwtlm0efanMd08ymnt7efupWnifErah4mbbTzyhKWckR7Iy1NKp4mUySMleU83qK6ITV9oRxKMe0Gk/BxCPMCUoejknxCHIkmUt58Iylv6BLM+OFOU0oSETKpo8s4bd0T55dD6F3rvy1097RzZzf78shsuotpdZXLW0x5VmI3t1em8yeNkifh3aJ5GH6a3KNdpaxMxNqwzCj6DjyRkrFq+pABkAAAAAAUdXmphwWveeI4cv6q3ecme1MVuY5bH1tu/ZS2ClvX4c4zXnLabT7laI8PJ9d6jqfo0U8lpvfzKaISUiYsqwtp5FLx55TQcHqSUIx7JlCZT6als2aKxCEwvNs01s14nhn89sWg0U5skxXtg2zBj0+lm9uI4hzP5G6ovm1FtFpr+InieJZKUm06bdIitdsP1tvt9x196UtzjifDX6ZbRXiFDLMzbumfMpqW8NytYiGC078qtstuEs5bJZQtHhfSm0JvzPKMTKnz54TUX0bVJmeFfbMGTV6quGI5iZ4UO2Zjj8ulfEXSttbr65c9Z+nzzzMMeWYrG21xOLbk5YpDePifpLHpKV1uWn6o4mOXUIiI9KWk0+PTYK4cVYitY48KzmWtNp2+j8Xj14+OKVAFWwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEhPoGu/IuedP0nrrVniZxz/AOz59dT5rX3fVd33yT5/y+gHyXpMus6S1lMU/qrjmXz06rxZ8G/ammSZ4jJP/u3+H6lxOrRMzVb4OYpKPd5WUZbU8c+D61pn23u5yOxf1tMzHMpcszM8LP6l+fEpozTz5kiSa6Voraf3V8UTE8+1vjta/wDTKtxeto4JlWFztEc7zhjjz3PQ+0x2bRp+fxDgPT9a33vBPHnmHoHQTzt+Gs/aIa/I+HO5d9xC+pM9vslTi3HiE0+mq5yHKrh8+FGVbTT+uCESwXXvM6Sv7NAvz2zLpHXdYnR14hoFscRWeY8NrHbwzYaT2sXaP1crzS1ntUslIifEK2nmY+6+27WJ0lzx+qPH3en/AIDxxGwY78cz2vMGef1x/d6c/h7va2w8TPiIa3K/GHb6LGs0/wDTqohHpFoPUgAIXrFqTWfUtO6u6ajNhnNgrzb3MRDckLRExMTHMT7TE6YORx6Z6TS8OBbhp76XNNLV44WV7cW/d1vqzpjFqa31GGkc8eocs3bbs+ivesxPPP8ApliYl4LqHScnFtMx5hZ255IUYm/HE+00WlOnM7VaFWIlaxeY+6aMlvya2rMaXVZmFWl+Vj9S0/dNGW0fdHbKrICzpntE+fS6x2745iUaSnt6SnnnhANopLpjiJkRtTlCYVu2EO2BChPtPW00jlU7azHomkT7hEstbeG09H7tk0uXHzb9Mz58uoaXUYs9ItjvE8w4XivfH/RMxw6F0Judfpxjy35tP5VmHruhc/cfRtLeBCPyiq9SAAAAML1JucaPTWilv1cMpq89NPhtkvPHEOY9SbjbUajNxb9MzPEEOd1Llxx8Xj3LEbtq8mrz2va0z5Y7jx58KvdE2R7a29wu+fZbWyWm1vajEeE0Qq9lfwj2wnbBMKXCFvStxH4SZeOOIjzIiKpIibTxDObTo4pEXmPKnsuhiYi+WOVfqXctPtG3WycxFuPELRHlsUwzrbEdcdR02zb8mmx2/wCS0flxzJlvnz2zZJmbWn3K96g3TLuWstkvaZrz4Y7u8NyldQra3wjkS1mULTz7STM8skQxzK45QtbiPalFp/JMzMe1tK7QtPKbFae6IW03mLzzPhkNDjjPasUjnyt4WiJmdMz07teTc9xxYaVmazPvh6d6N2bDtW04ccUiLzXzPDRvh/pbFTTV12fHH5jmHVqxERER6j053Iyd1tQ930TgxgxfUtHmUQGs7oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAChrdPXUaTLp7eYyVmJeP/nb4g3bDvOXXbZgtkx2mbcVh7HU8+HFljjLirkj94ZMWWcc7hr8jj1z11Z848Xx/wBTZImZ2/NEx/6ZX2l+Leqc/Exoskc/tL6DRtugj1osUf8A7qeui0lfWlxx/hsTzJn4aUdLp+3gbT/DPV2S0f8A5e0V/tK11vxL1Xps0x/KXtEftL6DRp8EesFI/wAJb6TTWn9Wmxz/AIRHMtC09MxzHt85tX05r9pvNNbgtjn94Wc4LVtP/wBnqn+KPZNHh27+fx4K47cceIeWLZoreZ58NzFkm9duRyeN9C3an2O803rFM+4tDv2htNttwT+Yh582nJzu+O0cf1PQW3+dk01vzEco5EenC5ddwvscTMJ5nwpYpjt9+EZnw1JaEIzKphtxKhz5RpbzHkglbdZz3aGstEtHNZb31RE30HMfhoGSZiZ8/dsUbOCN1UMlYiSnjyZfXPtCkMjerHhLm5mYmPy9J/w45u/aL058xEPN94/Z3v8Ahr1MxTLi59wwcj8HV6TOs+ncq+kSBz3qgAAAEJjmPPmGrdV9O4dVhvmw0/VxzMNqQmImOJjmExOmLNhplr22h573bQZdLqbRNJjiVhP4dj606epqMV9TgpHMRzLk+44bafPaO2Y8s1Z7nhOp9Otxb7j1Kz/6uIOeEs2jnwcrQ48qkSjEqUT5TRKVFSZ+ybDnnHbjnwpTb+ySZUlLNY7Vy17qpZ8Twxem1NsE88+GXr25sUZKefHlXRKTlGPaXyjCFU3KP2SpoSkhFGI5giJQtCPHMMlsmotps9b93HE+GOiFTFM9/j7In02eNmnFfuh2LYddGs0lbTaJtwyUOadMbll02avNv0/h0PQ6rHqsUXxzz+VH0HgcyvJxxMe1wAN8JmIiZn7DDdR7lXS6ecdLR3zAx5ctcVJtb1DB9ZbxXzhx29eJc/1GW2TJM8+5X+43yZ8973n3LH9kTk9SQ+f9Q5luTlm3whWnlPEKkV4R48sjQlTmJITzHhLMeEMdvaW08Qu9o0n8zm7rx+mFvhxTlyxWIlsm2aeuHHxxx+UxDLhpuyrMY9Np7ZLeIrHLjXyHv9tx11sOK8/TrPE8Nw+Suof5PS20mC/658Tw5DkvN7WyWnmbeZbOKvy2clp9Qk58polJwjHhsw07e008SpXniU/pQyzxZaGOVSLIxZb93lGLfulXSb9NrTHDfvivp++6bji/RM0i3MtW2Lbr6zNSsUmYmYemvizp3T7TtFM8U4yXqwZsnZHh3Oj8H+xl3PqG17XosWh0dNPhrxWsLsiBzXvoiIjUAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJCQcg/ig0kZ+ibZPvH/8AB4i1cWpmtTl9DPljYcm/9LZtHir3X48Q8RdZ9A77tG5ZZvpMnbz/ANsuhxb17dS4fU8d5t3RHhqu00tTcMU8+eYegdlyTfYsEWn1WHBtPps+HcMXdS0WifMcO4bJNrbLg5jj9PllzzuHmuVGp0v6Zbd3ET4V++ePaxrPN/7LqLNbTm3VJtP5Rpae6J5U+UYnyljT7/8A8m1zMfaHOcszF7efu6Nr57tuyV/ZzvUxNc1on8r43R4XmspMfm3Eq1Yj8KOPxZViWaHQRvEcenWf4ddb9HdLYZ/6vDk/tv8A8I5/odS1iZ8TMMeaN1ltcO3bmiXqiJ9f2RSYrRbHS0ephO5r1gAAAAACTNjjJjtjt6t4lzfr/p76OK2bBj5i34h0tQ1mmxarBbFlrExMSmJ1LW5XGryMc1l5p1NL0vNPUxKTut+W49d9O5NDr75MVf0TPPppl5mt5q2qzEw+d8vj3wZJrZPFp/KNrTx4lSiyFrxws0005Jj7oTkn8qXchyjSFeb8x7X+y6/6GX6eSeayxMW4ki3FolWYTE6bpqdPF8cZsU+JWNOYvPKXp7cuZjT5Z5ifTJ63RzS31KRzEsdoXtXcbhaVjlUiEKVVYqpCkVQrH7JuIKwmiErxCXj9lXHEdvMR5QiE9PEIlaIVMeS2PzE8N86H3Gt8X8vM/qloHHC+2bW30Woi1Z4nlV1el8yeNmjfqXXhZbPq41ejpfnm3Hld5L1x0m9p4iEPexaJjuj0t9x1NdPpr2m3E8eHLt13DLqNTeLZJnz4bP1NuuPLN6Uyft7aT/Vbn91tPJ9a6j3z9Kk+E1ImfM+UbUr9qp6QWr+5Dzal2/sj2x+EyPCVknb+yW+PnxWOZVohfbTopzZe+0eIF6Ypv4Vdp0MUpGS9fModSa7Htu3Xy2tFZ48Mxl7MOKbW8ViHHflDqCdXnnR4b/prPniWTHWbS3bxXHTTTeotyy7luV81rzMc+GO58FksS3ojUNC07RtKWZn8oXniUvK8QwW9prW4haZMk9/tXyf0+1lktxblaEQqVvPKes99oiv58qFZ+7a+g9gy7vuWLHXHNom0c+C0xWNyyYcU5bxSvy6r8R9LV1Ol0+pvj5r4mZmHb9Nhpgw1xUiIrWGL6Q2nHtGz4dNWsRaKxyzLk5L987fRuDxK8bFFYjyAMbdAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJjmPXLE7r0/tG5c/zmjx5Jn3MwywImIn25nvnw/0xrLTm02lpiye+eHMOr9rx7DqLaHFMTGOePD0zfmYmOJ9PPny5p5xb3mtPM1mZ9s+K8zPmXD6zxqfR7ojy0bHmjmOY9ryJ8QxMZP8AlrH25ZWJ/TH9maXirxqVWqaPanFk1beRjXGSsW0t6/mHP90x9mstH7t/pPdEw0rqTH2a20rUny3eHbU6Y3HH6lWI58qWGP1Lj0zw6mkv3bD0HrJ0W+48sTx5hr8qu26j+X12O3/qhF43Gl8fi0S9n9Nar+c2bBm/NYZNq3xlqqanpXTcWibRXy2ly7RqdPX453WJAELgAAAAAMJ1XtdNdtuWYrHfFeXn/edNk0+syVtSY4l6atEWrNZ9T7c2+TOmK2wX1mkx+fvxDLjtqdOF1rgfXx99I8w45bLwk+pzb2k1UWwZ7Y7xxPK3rb/lbOnh5rr2v4lGZUYlFGmOZT/dGJSQirpG1xp804skXrPEw3vp7WU3DSxitxa8Q54ynTO5W2/XVnnxaUTHhkx2+7TcdZo7Yckx2+FHsbLjjHuGjjNXiZmGI1GnnHeY4YpjTbvh15hY9swdsriYS8K7YpopRE/hNWJ/CrWE8R4N7RrSjxx7hCYmPX+FeUtuEaQ23pTXzgx4/qZI7fvEr/qTeInDNcOSOJj7NKx3mKRxMwTe9rczMzH7odrH1bJXBONQzZL5M1pnkx04Vu39kawiNuNFZm02mUnHCMx44VOCYNr9qjFZ/BFZ/wAK3BETa0ViPae5eMe0dHhnLnivHhs2k08YsXFVHZtFFKRa0eVTetbg23QZM+S3ERC0eXSwYeyu5al8m79j23QTgx5I+peOPEuHZsuTUai+TJMzMzyyvW275d03bJk7pnFz+lhsVuXQxY+2rmcnN3W8JZjzKnwrWU/TLpq96lkhJwq5fcKUytEI3tLk/pWV+3niV5eY4WOWk3zcQn0K+j0+TNlrWtZmJl6V+CumY0ugrrs2OIt7jmHLvivprLumtxVyYuaRMTzw9QbPose36DFpsVYiK1iJaXJy7jth6roHA8/Wt/8AC8j8gNF60AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAa/wBRdXbHsdprr9XjraI547l31Trcmg2TUanHHNq0nh4K+Uep951/UOqnLqck175iI7pZ8GH6s+2ny+V9Cu9PSe8/xB7JpdVmxYbVtFJmKtO3Hrvb+ss98uK0d0+3mKNJq82SctotPdP5bd0PlzbdrKV8xNuPDb/r1rG4cLl8y+anbPp1nJpqTkiaz6XHmIhJpvqZMNclq8RMJ5mGJ5rLrfhNEpqz5SxMJomBglWx24lrnVWL9Xfx7Z+LR+WP6hpXLpPHmYKzqWbBbV4ali/qVvaljpMXmFetZbMO1X0hx4U+3jJWf3XEV/ZJak8xwmfSXov4D3L6u3/y97+YjxHLrMPMvxFvE6LdMOK1+3utEe3pjDaL4qWieYmOXNzRqz03T8vfhjfwnAYm8AAAAAAKWqw0z4LYr1iazH3VQRMbeevkrYbaLdL5MdOK2nlo8cxk8x6ejfkfZY1+32y0pzasfhwLd9HbR57VvXieW3jtFoeE6vwv6+XdY8Stq3lPFltXJWfun+pWPuu4kwrzY7lKl4mVSJifuaVnwnrJeLcxNfZEwjMxx7RMIifLdehd9+naulzW8evLdddp65sX1KcTz5cWw5bYc1clLcTE8up9Gb3h12jrhy3jviOGK1Z06fGyReO2yhnxzjvxKnETyzW7aTvnvxRzDGfTtWeJhhkyY+2VOKo+VSazwh2SjbBaFPz+EO2ZVuyfwj2z+DbHpClf0wjFfPKrFZ49IxSVWTtU+3wljnlXmkpJpJtaKoQjMcwRWfwmism14iVPtnhf7ZpO/JF7Ql0mnnLaIiOWe0mmnHWImExDe4+GZncq+niMdJmfEVhyD5X6jnPq50Omv+n1bhvPyBv1Np2m8UvEZZjj24NqNTbVanJqMlpm1pmfLbwU3O5Rzc8VjshaajHxH5lbV8Svc1omv7rG8xWeZluw4lpTTKXlL9Sv5Szkr+VtMaGaVve3lVyWifUre8xzxC0LQhNmX6X2jJuOsx9teYm3DF4sGTLPFKzLt3wh0lk1E11eek1xV8xPDFlvFKuh0/iTyMsVdN+OOmsWz7VjvfHEZbRy3CEuKkUpWkeqxxCZybTudvouLHXFSK1+ABDIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAT/YAQ7qx4m0f7OZ/AIk+hCefwDXvkSbV6W1Xb77f/8AT579c5rf/EGprM8/8k/+7378m7hpdL01qK5c1YvNfFZnz6eEeu9JjzbrnzYvveZb3E+XF6pO5iGL0eW8xSIsyOLNOHX4cvd6mGJ0n/HERz5XfPdaJluONP6dv2XUxqdppeLRP6S3thfj/PGXbZx8/wBMMzef1S1bRqZcfPTtsjEpu6VOJ5TKtWUeUNRT6untH7IynxcT+n8hWdS1O+OaZ7cxx5Tx7X28af6eq5iPErGIZ6+ndwTum08R4UsszW3hcUiOOFtqfF+Eyz19sp0xqb4d0w5OZia2iXrLorWzrthw5ptzPbxy8i7fWa2i8fZ6B+E98nNpo0F8niI8ctXkV3G3V6bk1ea/t1WPQQNN3AAAAAAAAFPNjrlxWx3jmsxw4v8AJ/T06e+XPGP9M8zHh2xhOrtppum2XxzWJtETwtWdS0udxY5OKaz7eV+O281n3yhzxLLdVbbfb9zyY7VmvEyxFfPlv+/T51lpbHaa2+FXFbzwuKytsf8A91aJTpr28q0WInmVPu8IVv5RpjVufHDI7DuFtv1tckT+nliYmYlGbcQTC9ba8u77BqsOv0EXraJ5jyttz03ZabR6c96F6gtodRGDJeey0/eXUonHrdLGSsxMWjw0717Zd3DeubHr5a9FufCMI6zFbDmmOPCGOOasMtS1ZjxJHtPWJTY6KsUjhBFUK18Qm7E9a+E9am2aKKXbPHKSarma+FKY8oT2KUwl8zeKV9yqWhdbTppyaiL2jxB7ZKY5taIZHatP9KndaPK63PV10egvnyTERWOVxWIrH4iIcu+XOpvp4bbfp8n6vvwz0r3Tp0cl64Mcy0Trvfsu8bjkiLTOOs8e2s1nhHvmZmZnmZ9pLzw6NKxEah5jNeb2m0mS3haameYVbW5lb6mfDNWGvKlMpeUJmTldCTJaYt74Q7v1ePKGXzPP4T7divqNVWlY+6JXiJnxDb+gdmy7rr8WKkTxM+fD1R0ntNNm2fFpKREeOZ8NB+E+k8ej0Ma/PjjutHNeYdViHL5OTutqHv8AovC+hhi9vcogNZ2wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQQmYiJmZ8R7cl+WPlzQdLXtpdPkrfPEfZt3yjv1tg6X1OppP6rUmIn8eHz/AOtN81m771qMmfLa8TeZiZls8fD3+Zc/m8ucP219u15/4gdzvnm8X8c/lsmyfxE3vjrTU9vd+7y3o45pPhdY6cfs3f69Jj05EdQzRPt7M2v542a2LnVXrzMMd1B8/wCgpS1dBMTf7PJVbX/77eEbZpmYj7qxxKbXnqebWnUusPkTdOoNRfJnzzFbeo58Ofbnlvm7v1c2lYWzWifcqd7zfzzLPFIj01L5LZJ3ZJGO9bTMz5XOOLTWOPa3rPdPHK4pPbPiRXthunxzrcmPUZMVreJbvebRbz93KemdbGm3Ov6v6pdS7u6mO8TzE1YMlfLm86vbMTCtWZVYhRxz4Vqf1Qx6cy0poiU+PmLQSep5NMXdKjvWD6mDur7YL6UxPDaLVjNgmv34YDNSaZZifyyVl2eFkmcelKKTELXVY7d3heqOSOZ8rt2LSqaCe2kx925fHG7zt+84uLTXm3DScf6V7oc84tRjyxPHbPPLHaNxpmxZppaJexdFl+tpMWSJ57qxKs074t3rHuuxUjv7r0jhuMObManT1tLRasTAAhYAAAAAAJAHKvmDpiM9f57TY/12/q4cY1Olyaa81vHl603HS49Xpb4clYmLRMQ8+fJew5ds117RWe2Z5bWC/wAPJde4Gp+tWGj1ntt5VYvChzM+ZRiW1EbeQvPnwq9yHfESkmyWZ5nynSkK8ZaoTlhR5S2t4V0vEJsmptiyVvSeOJdV+N+o66rT102S/mPEOO5rc+F509ueXbNwplraYrE+WLJTuhvca/05iXojXYKZqc8eWKnHNLcceFx0vu2LddvpeLRNuPLJ6rR92HvrDQvGnVtjjLG4YrFSZjmFX6Vvsnx14txKtFGPalcUKdMFuE8YLLmlf0wm4WZ4xQtZwWUrYLR7ZDiVPLH2RPhP0olYU09r5IiGb0emnDSJmPKTb9Nxbvle6m9cWG17TxER5XrDbw4IrXulhOrN5xbXtmW9rdtprPDzb1Du2XcNzyZ72mf1Tw3T5Z6ktrdZOiw3/TSePEubZYmZ5b+Cmo3LjczP9SdfCtjy+fKra0WhYxMwqVyeGy5d4T3nhQzzzCa11DPZlqwWSScTxyltdNW3Phk0x90pP/1Ijh0D4t6Wz7nu+HJGOZx8xzLVNk27Lr9fjpSkzHMenqb4s6dps+z0yWxx33iGpycvZGodzonBtys3db1DbNp0lNDoMWlpERFK8Lsgcp9EiIiNQACQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABC3pFC3oHMf4iq2t0XkisfaXgzXU7dXlj3PdL3/8AO+O+To7LFad36Z5eCd4xzj3HPHHjul0eJ+Lg9V8XhT0cf8a5rC20eTtrNZhcRmjj16bnw5M+U8QhzWJ/dC2WIrErW+fi/PBuIIrM+l3Mxyha0RPpafzXdHHHlJXUT3eYVm0LxSV7FqxP6fuqUnj2scWeItPhc1zxPjgX0q0zfTzxkjx2zy6r0prY1200tM82iOHIMub9NohuvxduHfnnSzbxCl43DT5mPup4dFxxxCrT2krH6p49KlfDA4VolPyTKWLEyMK50Nv+Tifux+8YO3PzEe13p7cZIXmt08ZtP3x5nhMOhxMkV8S1ntmPsky1+67yVmtpiYW+afXhfbq1najFU3PFJg549qd7/clfUusfB29Ro9R9HJfiszxxy79ivF8db1nmLRy8h9K7lOk1VLRPHFnp3oTdq7rsuK9Z5mkREy0M1Z7tvQdMzbp2T8NhCPQwuqAAAAAAAAS1L5C2Om5bbfJFO68R+G2qeopGTDekxzEwmJ1O2LNirlpNLfLyjvmgnR5rxMccT6Yru4dM+Vtlvpe/PGOYjnn05Za8zPMxw6OO26vmnP4tsGaaK3ch3KE5eD6q7U7J9q03SXtMwpzk8Id6JWiEmX2dvMFpifcH29qyzVluXxn1Bfb9wjBnvPZaeIiZd62/Lj1OlrasxMWjl5Tpe+PLXLSZiazzDtfxP1RGsxV0ee/648eZauany6/Ts0Tbsbvq9LNbzaK+FKtGw209cmP+6x1Gimk8w1LVdbJxZidxCzrTxCPbwuPpTFUPp/lXuhT6cqHamxaf6mTmY8K9MM2sv8GOK8R2rR5ZsWCZ8yp1xxSnj1DTfkvfse3bNmx1vEZLRPHlt28arHo9DkzXmIrWHmz5F6kvuu7ZMdbTOOkzx5bGKndLB1DN9HHqPctZ1GXJqNRfNkmZm0ytslZ5TW1Ec+lO2aJl0YjTzNreUl4SxyjfJHHpTjJHC+mG0prcqGaU9sv4W+bLEL1YrRuPCHM/ddaSk3+3ta0yRafPps3RW2X3TcseGlJmO6PHC8zERtXFhtktFYj26h8GdJW1GSNbqcf/ABxPMcw79ipXHjrjpHFaxxDC9F7TTadlw4K1iJmsTLOw4mXJN7bl9P6fxK8XDFIAGNvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAML1noabj05rMFqxM/Tnj/AE+fnyHt+Xb+oNTgtjmI+pPnj930ay44yY7Y7R+m0cS83fxEfGN8s5N22/B3UmOZiseeW1xskVnUub1Hjzkr3R8PKta8Rzynm1Y4jleazbc2lyWx5aTWYnjiVHBt2oz24xYrX/s6UTGnBis+lrmvxMRHiFvauTJfitZn+0Ok9J/Fe/dR3x0xabJjrbjzMS7z0N/D7o9JixTvFa2mPMsOTPSrcxcPJf4eS9DsO76uf+DR5bf2qvrdJb9ipN82gzVrEc8zV792f496Z2yta4NFT9P5iGR3DpTZNZgtiyaPFETHHisNaeV59N6Om+PMvmvbHfDqLYstZrMTxPKtb14di/iT6CxdK7xGfS4+MWeZmOHGq34nhuUtF67hy82OcV5rKW/MRPLJ9F6+dDvFb88RMsZefcypYrTjyVvX3E8r68Mc1i0aeh9FlrmwUyVn+qOVf92r/H+4/wA5tla2tzascNnmZ4asx5ecz0mtpgmTlIjEjVT1mWS2/LFqzS0sZWVXBk7MkTCNMuOUN00/ZlmYjxLFZ6+Wy7hi+tpoyR9oa9qImJ4laHY49u6FpaPKnePCvMcykv6Wbijp7WpljieIdm+GOpLYtTTQXydtLT55caxRE34lsXTWW+l1uPNjtNe2YYcldtnj5px3iXrWlomImJiY49pmv9Fbth3LaMXbfnJWsdzYIaMxqXp6Wi0bgAQsAAAAAAAA1n5A2Su8bJkpWsfUrEzDzFvmjyaLW5cGSs17bcPYVoiYmJ8xLivzN0nFbW1+nx+J824hs4Mmp1Lz3XeB9Wn1ae4cTvMpK35lU1UVpM0+63ifw3dPGaVot9k3KjHtPEqqaVJ9oc+UO7lCPaEwqY/bI7FueXad0xZsdpiO7yx2PxKbLEWjlFo3C+LJOO0Wh6n6K3vDu+1YstbxNu3z5Z/Jji0ennD4j6qvte610WfJMY5njzL0ZotRTVYKZaTzW0cw0b07Ze34HJryMW/lRy6fiFvbDP4ZK/vhL2xP2Ypo35wVla6bFx7XFuK1mfSPERLX+ut7x7NtN8trcWmOIhatVMsVx120L5l6ojDhtoNPk82jieJcI1HdOSbWnmZny2Dftbk3TX5dVltMxMzMcsBqp/5Jb+GmoeM53InNkmVtfmEkzKpkUpbMQ50oWnwp2lNefCjaV4YpRtbwt9RPhVmVDPEzxELaINJW+TUVpWfM/Z6O+BOkeyldz1GPxx45hyP4w6Wy7xvWK81maxby9e9P7dh2zbMWmxViIivlpcrLqO2Hp+gcDvt9a3qPTIVjiOI9R6RIHOeyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFLVafDqcNsOfHXJS0cTEwqgOY7/wDDPS+7aq+fJTsm08zFVXp34e6X2fLGTHhjLxPPFodI4j8I8R+F/qW1rbFGDHE70tNFt2i0dK002lx4or67YXUR+6IoynEIWjmEQHCv4sNnya3pyNVTH3fSr74eLJm9bTFo4tE+X0r642bHvnTup0F6Ra16TEeHhL5Q+Pt22Dec/Glv9KLTxMQ6HEyeO1xeo4Z7ovDQbWmY9KNL/q4svcO3bhnyRhppck2tPEfpb70Z8O9S75qsdbaS9cVvduG1a0Vjcy51aWv4rDGfH+vy6fNGPBE2ifbp2DV3yREWjiZdM6X+Atv2fZvq2yTbVdvPEw0Xf9pttu5ZMFomOyeGpOSLz9rT6lwb4q99oWvd5O5JbxZDlledmE98k1jmFOdRaJ9Jcs/pULSiUw2HbdVObTzjljtwxR9SeYUNszzjzxHPiWU1uOMte+FfTf4l57ohiK4a/lC2COFaY7bcE+lol1VnOGK35hdYM18UeElvEoRCdJdL+Jupr4dyx6TNfiLTEe3faT3UraPUxy8f7dqsmh1dNRjmYtWYl6U+NeoI3nZcUZLc5KxxLU5FNT3Q7vTOR3V7J9tuCBrOsAAAAAAAAMX1Lt1dz2jPpZrEzavhlEJInStqxaJiXj/5F2jNsm6ZMXbPETLV9Hmve8xPiHo75w6R/ntBfXYKc2iJm3EPOmPBfBqMmK8cTWePLqYrxer591XiTxs2ojxK4rZNFo49rW+SKxMIVyTM8r6cqZlc/UmJTVyKEz90aytFYY5tK6pklPOSZjjhbVnj7qlbRwTWFe6VbHNsWWmXHPF6zzzDvvxH1VOt0NdLnvHfWOI5cArkj3DO9H73faN4w5YtMU7o5jlhy4otX/XT6dzb4MkRvxL1ZW3dHKPPlhend6wbpt+PNhvEzMRzDLxeOJnloa17e3pn7o3EpdVljFjtktPEVjlwX5Z6jtuG5zpKX5pHjiHRvkjqTHtm15KRkiL2jj2876zWW1WsyZ7zzNp5bGLHEztxer87UfTrKnntFImInwxuXjmZ5XWovzEwssniJlu1pDy9rzKlaVO1kb28KN5/dlisMfdKXPftpytpzW/CfUW5otLTxXwnR7XMZOY9rzZ9LfWayuOK88yxmKZm0Rw6b8M9PZdy3iLWxzNOfwpe0UrtscfBbPeKVdi+FOlI2/TV1+SnmY8curQs9n0VdBoaaenqIXjjXvN7bl9J4nHjj4opAAo2QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABiN66d2fd4mNw0VM0z7mYZcInSJiJ9tO0fxv0jpcv1a7Vim3PMTNY8Nn0Wg0mix9mlwUxxH4hdIc/iEzaZ9oila+oQmsefzMcOKfNGxU0uWdZSP6/Mzw7Tly48Ve7LkrSP3lpnyXk2fW9O6it9ZhvmrX9ERbzytjnVttTn4YzYLVecsscW4n2l+6tqqWi0zx55WeSbVdCJh83tjmJ1KbPP6FvMmS9pjiUnce0RWU9LdtomGd0GeM2Htlr0rra9T9LNEW9SrMM+G3bbbI6nFxbnhQ48sjniMmLvr64Y6/MSQ61MkSp5K+UIrKpHn2jwuz62ozHiW+/GHUFtt1OPFN+KzP5aHl5iFTRam+nyVvXnmJ8KZK90aZcFpx37oevNDqK6rS0zUnmLRyruXfEHVNtdSNBqMkc1jxy6hDQtWazp6jDljJSLQiAqygAAAAAAALbctLTW6PJpskRMXjjy8wfLPTsbLu+WcdOKzPiePb1Q5v8AM3S07vtF9Thr+vHEz4ZsN+2zl9V4ccjDMx7h5bvW0z5hVx0nt9Kmpw5tNmviyxMWrbhb5Mt4h04h89vWd6VvPPlGFvjyWn2ni0rxDVtOp0rdyat/sod0/lLOSYsaIleRfiEtrzzzE8cLOctks5p/KO2Vob90F17n2PUVw5bzbFz+XTdV8p7fGhm1LR3zX1y83Wy17uU1cs/99v8AbBbBFp262HqGXFTthuHWfVGo3vWWvbJP05nxHLC0t4hi4yRMq1dRMfdkrTtaWXLN57rLzNPK2zTxWUts0z91DLkntlliGCbJLSpWkm0pZll0x96nl/pWl44lc5pnt5UY4taKz90aZKzvyvendLbW7hXFWs2mZh66+I+lsG0bLi1NqR9XJXn16cO+Eel7a3ecWe2KZpExPp6q0mGun09MNI4iteHM5mTc9sPafx7h9tZy2/8AhWgBovUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE/gFPU5seDBfNltFaUjmZlxf5L+dNn2LFlw7dkrfPTx/le/xG9UanZenb4cF+zvrMcxPl4b3nW5tfqsmTLktabW58trBgi0bs53M5c4p7auq9W/xAdT7xF8eHLOOnqOJaTj693/Pq4zZdZltPPqbTw1CKfaaqlP08eJbkUrHpyLci9p3Mu39IdSf+LYZrnmPq8eWU1PPc4z0lumXQblSeZ7LT5ddx6imq09M1Z8TClq6cXnU+7uj5Lyk5jlC3mSCHOlPHlLMTE8x7hH7I1mSY8ESzm0amMmH6Vp8mqx9t+WG02a2HNFo9cs/Wa6nDF4nyrDe499rKI4FTJWaz5ScfdeHUr6U81eapKV8Kt/SSvHcLxDN9J7lk2zXUzYrTXifL0f0hu9d22qmaLRNojiXl2s9lYmPboPxx1Pk23XY8WS//DPiYa+andG4b/C5P07dtvUu+C023X6fX4Yy6e3dH3XbTd6J2ACQAAAAABS1WGufT5MNo5i9ZhVJB5g+Xelc+271fNTHxhtPPLmmrxTWZn7PYHyPsVN52PLWKROSkcxLyp1DpraPW5NPasx2zw6fGyd9dPBdc4P9fLN49Sw2KsxHlPMwhe0cfpSWnnhuQ85b2n7klreUOfCna3k0iqPPhLPmUs2Q58DJCS8cShFuEbypqsm1SLJ+9Q54Of3TEK2lcRdC1uYlRiU028e14hik7vsfZTieZVKeWRjlJl/pXWx7bfW7hipWkzM2hTpjm9oiI5/Z2T4M6Zx6zcMefPi/TWefMMGbJFI26XTuNPIyxSHWfiLpv/wXZMeTJSIvkrDfIU8GOuLHXFSOK1jiFRw7Wm07l9Nw4q4qRSvwAKsoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAT75AHCP4oNjz6jaJ1kTa2OI9PG2WKRqb17PMS+kfXG1afeOmtbpc+OL84p7eftPD549bbTl2TqPVaW/v6k8f25dDi33Ha4fUcXbbv/bExOLnzWELdnE8VhSifKeI5htacsxTMTzEcTDe+i94+vj/AJTLfia+vLRfMV5T7Zqcul1dc1JmPPlFo2x5afUpp2LFafqcT5hXrwxewauNdpK5YnzEMnE+WKHEy11bSpEQlyevCaEmSfCWBJMyvtq1NqXjHa3hY8/shEzWe6PcGlqzMS2eac17pjnlJ2x64S7PqPr6fttP6oV70msqS7WC26QozWPwh2V99qpwhMDYiUnEfhHHe1J5rMxwjwlmErbdq+JuocdtNj0Npjvtx5mXTol5c6e3HNt2qpkxXmton2770P1Hi3jQ0pe//NWPPn20clNTt6DhcmL17Z9tnCJGJ0AAAAAAAAEmWkXx2pPq0cPNHzlsE7fueTNjx8Vt55iHpqWmfKnT2LedgyzXFFs1azMeGbBk7LOb1Ti/2OPMR7h4803dWt5tPPlLfLP+2R3jQ5NDq82HJSadtpjzDEZZ+ztxqYfM70mk6lVnLPqFvfJbunyTzX7qV7efaVITd9vyj3z+VOLQTKFkZvb8od0/lLyhMmkxKebT+VOL2/KPKj3JiEqsZLfeUZvbj2o9yPP7pVmFWMkzHtcafJ5jlZd32XOhpbLmikLKdu5bX0LoP/EN+x4uybRaeOOHrPoDYMOz7ZWIxRW9oifTkXwP0hN9dTc82H9ER4mYehKxERFYjxHpyOZm7rdsPffx/p/0cf1bR5lGAGi9IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlvaKxzaYrH5kEwt7avTx71OOP/3mJ3bqzYttif5jXYeY98WhMRMom0R7Z7mEJmfw59uHy50fo6zbJrKzx+JhzDrr+InT4bXx7FMWjzESvXFe06iGHJycVI8y7T1/1Jt2xdPazNm1WOMv057ac+eXgDrvd7771DqNZNeIm88f7ZjrPrjeuptbOfV6m/baf6efDWct5tfxEOhgw/T9+3E5vK+tOo9LCuO33jwj22iPS87+J44SzaYnnhnaK3mZ4/pnykt3Vr/RPK9rM28xEJo5mJ8QJZfoTd74dTGDNPFJn7ujVnu4vX1LjV73w3i9fExPPh0bozeI1+ijDe0d9WO0a8uZzMO57obFHHCTJMeC0cePupRPmVYc3tTx7IjlLyRKdIXmhz2wZImJ8ctopX6+nrkr58NQxxzDN7BuFseT6GSf0yrNW7x+R26rK9tTiVO8eV/q8UT+uvmJY+8TEyh0qX3KX7IT4J8Qkslk2nxWiJ/f8tt6N3udp1WO/wBT9PMc+WnTHhHm0RHEyxzSJXx5rUtuHqrYtyw7nt+PU4pjzHmGQcS+JurY0mX+T1eT/j9Ry7PpNRi1OKMuKeay0r0ms6en42eM1ItCsAo2AAAAAABJkpF6WpaOYmOE5IPM3z505bb9ynUYsf6ck88xDjeWIieJtD2l8kdO4N92DPS9ItlrX9MvGvW2zajZ9yy4clbRFbS63Ezd1e2fbwvXuB9LL9SseJWNrV9d0KFvfjytJtFo9rnDMRjbrzc115PMJo5+5zzPlPzMxxBpWZSezhGEYlbtU7lO0TEKXbPK5nykkiFu9R7ZRiPCrE/ctPNJNaT37U5iOfEtm6C2vJuO9YMNazPNuJazosOTLqa0pHPMvS3wF0ZjpNdy1WLzxzXmGtnzRSrq9M4E8jNEfDr3R21U2jZMGmrWInt5lm0Kx2xxHqPSLiTO52+k0rFaxEACFgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACfQJM+WmLFbJktFaVjmZl5c+ePm/WaLcM2y7b+itJmO+vt3b5Y3T/wvpTU5a37bzSePP7Pn51rq8+4b5n1GWJmZvP3bXGxxady53P5Fscaqv8AV/JHVuqyWn/xXUVrM/aywy9QbzqP1ajdc9+fzZhKUtz4j/Cf6eSJ5msujWIj04d817eZlfzqtXeZ+pqb3ifzKXFX/l5tPMJey0VjwVi8THESuwTMz7XVcdZyc8+E8048R7W8Xv45jjhUnUUiYmZVXRmsfeUJpExPlLfNj99yH18c4/fEiypSvFeOVSlYmvHKjjyV7farS9J9SChrMX6PEqmw7jfbNfW0W4rM+UuqvW1P0z5Y68fq55NbYrxE+Jdp0OqprNHTNS0TMx5Tc8S0LoXecmHPGmyzM0n7ug5qRNIvj8xLD2zEuRmxdkqfKaEsc/dPEeE6asyq4/SpXnmJieJhTpMcJ4tEJ0jbZti1X8xh+jknmY9coavHOPLMMFpNX/L565KzxxPlnoz11te+nmePKkxp1OJmi0alaylmFS8TWeJU5mFW9tD+5MeBGfQshp819PnrelpieXaPjDq2t4potTfivHiZcTt/VEsttOvnSZK2i3bMMOWNw2uJyJw28enqelotWLVmJifXCLQPjfqimtxV0WXN35PtzLf4acxp6XHkjJXcACFwAAAAAELViYmJjmJ+zjnzj0Bi3HS33HSYv18TNoiHZFPUYcefFbFlrFqWjzEwvjyTS24a3K4tOTjml3z/AN42rNodTetqTHE8cSt6Y5rj/V4ejfmP49mct9Zo8P6Z8+IcD3jSX0me2HLWazWfw7WLLGSNvAc3gX415rMMdxMzxKpFe37+En1cMW83Q/mcPmO9miXOtj/Saf6uPyjWPPCh9fFNvFlSM2KfM3W2wTjn9K3bH5STSefBGow/9yel6W/6vKdqzWY9qXbPPCtTT2vWa19ynx46zfmJ5mW5dEdK67esnGDT2nzHE8MeS8Ujctnjca2a8VrG1/8AD/ROo3jdcVsmOfp1tE2nh6y2XbMG16DHpMFYitY45a78adK06f2qk3rxntX9Ucem4w4vIy/Ut/j6N0vg14uKP3IA13TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACfQA5z876PJqOlMt6c8VrMz/p4K6kvMbplxxPmLy+knV23xufT+r0kxzN6TEf6fPb5Q2LJs/Vmq0+SkxMXmW/xLRqYcbqWOdxZq+CLRkjmV/XHOTzP2WulpM5Y5ZXF9OPDdcbaytFpnthNWsxPlUtEReeCsR3eZWV0pZO6YlaW8+F/livbKxrFrz246zNvwiWSkKc1nhJz59s9s/Sm+7rkrTT6PLMW/Ztmb4e6i0m033DPp8nbWOeOGKb1idTLNXFe0biHOqWmfuqVvMekNXp8uk1FsWSs1tWeOJQx/mWVg1pNaea/hQms/dc3rE159KV48cx6WhS3tHRZ74MsWrPHl1Lo3daa3R/SyXjurDlUU/Tz92X6b1l9HqazEzEc+S0bhgz076TDqt44n9kIlT0eWNRpKZqzzEwmmfswuNas1nUp6T4TcqXch3phRVtK50GuvprxxPj7rCbcpefypf0yYpms7huMZMeqxRkpPn8LbJWYlhdp11sOWItb9LYbRXLSL088sbq48nfChHpCUZ5ieD2NyEnHlNevjlHhCOfUiZZLp/dNRtmvx58N5rMT+XobonqPBve30mbx9aIiJjn2808cNi6P3/U7XuOP6V5ivPlgyY+6Nt7hcqcNtT6l6XGF6a3vBuulrMWj6kR5ZppvRVtFo3AAJAAAAAAUdXpsOqxTiz0i9Z+0uJ/K/xVXXZcms2/FHmP6Yh3JC0RMcTET/AHXpktSfDX5HGx566tDwL1N0XvGy6m0ZdNkmsf8AplrN6WreYtW0TH2mH0H3rprad1pauq0uO0zHvhzfqP4P2XWZLZNJWuO0uhj5lfVnmuR0HJE7xS8eRPFp9p8do+70Zrv4d9Re9rYtRXz6UNJ/DprOf+XU1hmnk4v20Z6Tyt/i8/VtE24jlldHoNTn7Yx0t3T+z0FoP4e6Yctb5M9bcT+7f+m/irZdvtW+oxVyTX9lLcvHHpenQc+SY7/DhPQPxzue7arF9XTXrjmY5tNXpvo3pXQ9PaDHixYq/ViOJtwzOg0Om0OGMOmw0pWPxC6aGbPbJ4+HpeB0zFxI8eZIAYHTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQt+/p5d/iw6I+jxv2mxxMXn9XD1HPlrnyB05g6l2DPos8c/pnt/uyYr9ltsOfH9Sk1fOmuXBSvMxxMJf5rF7jltfyh0brend3zYZwXikWmYnjxw0XmOJiY4l16z3Rt5bJXttqV5Gandz95VKZKWn92M/5MlopjpabT64dS+JfjLeOpNVivfT3rhmY5mYLXisblOPDOSdVa70/0xum+aimHR4L2nJPETEPQnxV/D5GnvTWdSViZ/q7XYvjr4/2rpbQUiunpkzzWOZmPUt2iOP7fhzsvJm3irucbp9aeb+Za9sfRuw7RFf5XR447Y8cxDL63QaXV6TJpcuCs4714mOF3wS1tujERHp4g/iO6Kx7H1Fmz6TF24clp48OM3iMV+2fb3f8AxC9Jf+PdOW1GHFE5MMTMzEPDm+6HPodwyUy0msRaY8upxsnfXTzvPw/Tybj1K1teLU4j2jj/ABPpRme2OUcFNTnzRTDjteZ/ENnctGaxK5itZnwzPTfTu67/AK6mk2vBa17TETMR4bx8VfFG8dTZKZcunvTDzHdMw9YfGvxrs3SGlrbFhpk1ExHNpj01svJinhu8fp85fM+nHtt+JN62vpOl9THOaK8zENC3PT5duz3xaisxNZe18uOuTHbHeItW0ccOIfMXQlpvk1+lxc4+OZ4hrYs8zOpOo9Hp29+NwrFqKZeZr6hP3woZ9NfSZ8mK1ZrxKWszw2+55W2HtnUribwh3KcTMox+5PlTWvSpzx5hndh3Gtf+LLPvw19PjnttEx7hHbC1ctqz4bpn01p/5K/0z6UeyYUti3KMta6fLP7RyyWpwxXzXzEqutiy99Vnxwk5jnx6VbRKhPhDYrO09rR6QxX7ctZj8qcyhz5JhbTeujupp2zV0+pee2Jjl3PYN10+66KufBeJ8eYeVKzNbRbnlvPx/wBXZdn12PFa02xXniYmfTWyYfG4dPh83tntt6ehBbbdrMOu01NRgvFqWjnwuWq7cTsAEgAAAAABMfuAIcfvJx+8ogIcfvKPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAExyANN67+P8AaOqsVv5jFWuSY/q7XC+ov4bYyai1tJeYrM/aHqaY5J/wy0zXp6lr5eLjyebQ89dEfw7bZo7Y9RuFubUnntmPbuWxbJt2zaSmm0OmpiisccxX2yXHPtFW+S1/cr48NMf4wAKMoAChrdNTVaXJp8kc0vWYnl53+WPhC+v1V9TtmPv7p54iHo9CY/aF6ZLUncMWXDTLGrPFu3/w+b7k1UTnw3in44l2DoD4E2naq49Rroi+SPPbNXceJ/Ef6R4ZL8i9vG2DHwsVJ3pZbRteh2rTRp9DgphrEeeI45X3AlvaK1m1piKxHMzMsDbiNJpmPut9diwZtNfHqYrOGY88tQ62+SunemNNa+XWYsuSv/RW0TLzx17/ABG5tZlvi26l8eLnjwy48Vr+mDNyaYo8r35r27R6Lf7X0Nq9lp8xDQMfmGk9Sdc7lvO5V1Ns1opz5iW17HrMeu0Nclbx3RHlv0rMRqXjefTuvOSseJZCqM+0ImePSasd0cskORbwVTx7QiqKdMe11gt9OYvWfLZ9p3CuoxRiyTHdHpp8Z4jxx6VMOu+hkrenMcKalt4cnZLctRSazKxt7Vtt3LHrcEVmP18IZ8E0nyr6dXHkrMKKW3pNMIT4Qy90IV5n2r4L/TyxMe1Cs8Sd3FuUTG1vTqXxt1hk0eeumz5OcU+OJl2fRarDq8EZsF4tWYeT9Bq5w54tHLqfx11xj02Suj1FuaWnjmZa2XFPuHX4XM8dl5dkFLS58Wow1zYbRato55iVVrOuAAAAAAAAAAAAAAByAAAAcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlvPEWn8RyCy3zddJtGgya3WZa0x0jnifu8t/Mnz1rp1OXQ7DkiuK3NeYU/4ofkPXW3C+06TLNcdOa2iJebsmXLmyTfJPNpb+DBGu6zj8zmzvsoyW9b1r93zzn1epy2vaeZibTwxWXHMwjHvhWrWbeG3rXpy5tPuWP7J7uGd6d3K+35qxNp7J9wx2bF55j2jFf0xM+0TDHaItExLrGj1OPV6auTHPuPS4rHFWjdIbtGn1FcOe36Z8N7vfHkiLY5iY4I8S4fIxTjlLyhMpLW8+Es2/KWtpC0+ZSzKW0+ZS8oZohebfrb6TPW0T4+7c9JrMOuwRMTHc0Bf7bq76bLFqzPH4Y7trBfTbM2Oa28Qo2jwuNHqceswxxMd3CTPjmvKG/SdrdCxKEjOhE8Tyr6XNOPJFq2mPutsn9PhGiET7db+OevLYM2PQaq/OOZiOZdm0ufHqcNcuK0WraOfDyDg1FsGTurPExPt1b4x64yYprpdTk7sfry1cuL5h2ODzf8Ahd20UNFqsWr09c+G0TSyu1nYAAAk5AFLNqMOGk3yZKxEfmWG13Vmy6SZjNqaR/lMRM+lLZK0/KdM8c/s59uHyjseG9qYcsT2/flrG7fMmLDMxp5rK8Yrz8NPL1LjY/d3Z7WiI8zEf3U5z4Y95qx/l523P5e1uoi01vxHHjhq2r+Sd4y2mK57RE/uyxxr/LQyfyDjV/Hy9WZtx0WGOb6nH/tYZepdqpbidRTn+7yZn613fJfzqbzz+62nqPcrZe62e/H91o4s/MtK/wDJaxOq1etc3V20Yo5tnr/tZ3692Os8RmiXljJvevy8x9a3bP7qeDX6mt5/5bT/AJT/AFY/bDf+SZP+NXqT/wDEHavqxWLRwrx15s/HNrxDy7g3DU93PfK7trdTevFsk8E8eIVj+RZv09MU672a3rIqY+tdpvbiLw8y6fWZqcxGSVzTcdTEREXlWcELR/Iss+4em69VbXbz9WIVsXUW25J4jNX/AG8zRuWs7fOW3+1fDvOsrXiua3P91Pos0fyK3zV6cpuuivaIrmrPP7rmmfDf+nJWf8vNWh6i3CkeM1pmP3ZrR9Z7hhiO7JM8fupbHMNnH/IMdvyrp3+JifU8ouO7d8g6itYnu5bTtHW9dVjickxEqTGnRw9T4+X1LeRh9L1BoM/Ed/FmWx5KXrFq2iYlDfret/NZTACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApaiJthyVj70lVQkHgT+IfTanTdZauc1bds3niZ+/ly/DabT+p7C/it6I/ndBO66TBzNY5tMQ8gUpaua+Ka/qrPHDq4b91Xm+ZjmmRUpjrafa5jFFK88qVJjHXiY8qtb8xH4ZmqqVxUyU5mfK3zUjFHEeVxE+YiI8KuWtb4vXlLHMaY/HaKTF4txMNm6c3+aXjDntzE+I5atmicc8TXwpTeeYtWeJgljvjrkjUutWy1vWLUnmJSTkmGndN792zGDUW/zLZ/rVvWLVnmJUho3wRSdTC68T5/J4U6W5rEp48pa8xpNEQmrbiUKkSaiVZmY9Mjtutvp80TWfDa9Lqa63Bz45aLW3DIbduV9NlrxP6fuiaxrwy4c9otqZbHlxdsqNvEr/AE2fFrMPfXju49LPU17b+uGF2KzuNre8oV8fdG0pJTC8Jbe58q+366+iy99JULKfHniUTESmI1O3ZPjb5AjFamk1Vv8Ajnx5dn0epw6rBXNgvFqWj7PHGky3wZYvSZ8Os/F/XObDqaaXV5JnF68y1cuL5h1uHzf+F3dEJniJmfUKWk1GLU4a5sN4tWY58Ksxz/ZrOu1Pqbrfbtom2Pui2SPtLnO//MeavdhwYYj922fJPQ0bpS2r0kT9X3xDzx1ZtOs27XThzY7VtEt3Bix2eX6vzOZgn7fFf22PevkfdtdzWuW9Yn7ctR3LeNw1eT/k1N4if3WMWiLcc+VO8z3eW5WlY9Q8rl5OTNO7ztWm9rV4nLMzP35UraaLT5yT/tCfceOEJt54haIYbTv2mjTUifN+YTRpaTMeUKTM+Jhc1jiEWVjwpfyeOZ9qlNHXmObK9I548Kta+fSiNpK6WsJ401e7mFaOE9YRo2lwYK966rhiPPKTDH61zCloXrPhTjBX3yrYcETPkhVw+1ZTtNTDEePaeuCvHhPRUrCmkd0mnwR2yua4o7eENPHiVxWqkxG098qVcPjiJ4ZDQ3vgx/pmVKlP2XOKvFeFbViV6ZLRPiV7g3PU448TwzW1dWazTzEXyWtEfu1uIQmv+FO2G5h5+bDO62dc2TqvFnrSM1ojls2l1mn1MT9HJW3+XA8GoyY58WlktB1DrdHb9GS0f5Umrucf+RanWWHcuYHPunutqzijHqZ5t+8tw23dtLrKRNckRaftyrMTD0XH5mLkV3SWRAQ2gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGI6t23Huuw6nSZaRfvpPHMPAfynsVdh6o1WKtO2O6eHvfrLf8AR9PbFqNw1mStYpWZisz7eDfknqbD1T1PqtZER9KbT28N3iRO5/TldTivbE/LS+JtXmVTFH2XFa4/fHhPEYvcR5b0uLtSrMRPbPtU59cKWomsZImIRpkEbR1WGMtOfvDFZv02mGaraPUsdr8Ud82rBJHtj4tNbd0TMS2npjeI4jT5rcz9plrFq8psUzjyRekzFoRpF6xaNS6nhtE1iYnmFxSJa10xvGLLWuHNPF/ty2XmfdfMDkZKTWdSniOISz6S2vaEvdPC0QwWiVTlGJ4sozeUs3mI5NIiPLN7XuNtJkjmZ7WwWzV1WKMlOPLQbZ7/AJXe27vm094pNv0SxTjl0sOeI8S2e8TX2lieUuDPGpxxaJiUZiYn0p6b9bRMeCZSX55TydsT7FolCqvpNRfBbupbjj8KUViI4hDiIjhGkb16dq+Jesb1wfy2qtN454jmXX9NnpnxVy45iYmHkLbdzz7dMzgtw6V8d/I2bT6imn19+cUzEeWtlwz7h1uFzZ/DI7vPn92g/JPQ2n3vDk1WClYzRH2j23Xbtbp9dpqZ9Pki9bRzxH2XXuGvW01ncOlmw0z07bxuHi7qXZM2z7hfHnpNeJ48wwee8d0Ty9ZfI/Q+373osmprhiNRWOfEPM3Uux5NBqsuK2K1e2Zh1MOaMkf68H1PpV+JabR+LCTkm0RwmpEz5WlLWreaz9l7gt3cQzOPvapWszxwuqV9KVZrFo+67xRWbRzMRCNbVtaK+ylVetZ9oTkw1j+qFO+uw044mOEdkqTkhX4TVWsbnpp55QndNNHk7JWi22QxT+pX5Yed70tJ7uPCMdRaLnzClqSvWWZrKrinyw+Lf9DaYZDR7rock/1xDHNZTM6hkca4pCTT5dJlrzTLWV7iw0t/TPP9mOYR7Q00eFzSvlU0uCIieYXNMVefSkpiNqWOvEK1Y/Sn+nWIJiI9KTK9Y0khCZTTCCq0yk58oWVYrEwWrE+0KSpUmaWi0TMM7tm7ZcFq3pknmP3YfthVrjiseEW9Nnj8i2G24dQ6c6ojJEU1Nuefu23T58WekWx3i3P4lwrFnyYv6bTHDaul9/y6bLSt7zNZ98qTV6rp/Wq3mKZHUBbaDWYdXii+O0T49LlV6OJi0bgAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIWtER5mI/vIIoc/wCGq9Xdc7J09jvGo1WOctY815cS6z/iQ0+nrkwaDHE2jxEwyVxWt6hhycjHj/KXpS+XHTzfLSv95at1b13sXT+lyX1GqxzeI8RFoeN+o/m/qHcYtbFny4uftEtE3zqrd93rxn1eW8z75mWzXiT/AMmjk6lWI+2HSfnb5V1vVmrtpdJmmumrzHET4lyPbYvN7/mVKebceZm33XOit2zMccTLbpSK6iHIzZpybmVzeIrWIRju55TRHdBERyyMK3z8zePCS88RCvn8TxCnakzxxCEo1yWiI4S2nutMWRisyltHEgs9Vimlua+lCP8A7snNYvXiVlmwzW3g0lLhyXxZa5KzxMN66Z3rHqqRgyWiLxH3aJHPPpNiy5MGaMmOZrMfgYMuGMkal1XJ+Y9KVrMN05vePVYfpZrcXiPuydrefcLQ5WSk1nUqkyltPiUnPn2hefApCFp5ST5PaPAzwyGy6/LptRFbTzRtmHLTU4+6vHLRsMfrZfbdbfBkiJn9LFePLcwX8eWw2r2+0OOPKfDemoxxesx5QvWYjyo24naSbeUlreUbKVpEoXtxKGLNbFburPEwpZJnujlCfXKJWh0z4r671W1a2uDWZZtgvPE8/Z6G2zXafcNJTU6a0Wx2jnw8V1yXp5rPEu0fEHWV9Jo6aXU5O6nPHmfTVy4t+YdPic2KfZeXdZiJjiY5iWjdedDaPd9PkzafFEZuJluWi1WHV4K5sF62rMfaVf3DXraazuHVy4qZqdto3DxL1d0/q9o3bNTLjmIrafsw9MtPUe3r35A6F0PUGmyZK0rXNxPHj28y9YdMZ+n90yYcuK3ifw6eHPGSNfLwPVek5OLfvr5q16M1q24gyanLzzyp5eK27lCcvdfjxw2quFkj0mtly5Jn9UpJvaYmJnzCSZnmeJUr8x+rnnhZhiPKr9SaxMzPlb2y3m3MSlm/dzMqfPPPAzqt8k3r5lS7YQjnlNEz+ELxPgiJ+0qlZyV57bzCSSszE8miZXmj12r0/E1yzLP7b1Vr8HEzPNYarE255VImZr7VnHE+2PumHTdr6303rUe5bPt2+aDW1j6V4iZ/dxDBxxzMcyvdNq82nnux5Zr/AJYL8ePheuR3KZi1eazz/ZJ6jiXN9i6yzaea49R+qv5lu2g3fS66kXxZK+f3al8Vq+2atolkfZwlrMT6lUrDEmUY9H2RghCCI8qv2U/StEeEStWEv28JsdrUmJieDhJaZiJ/ZC0TMTuG1dO75l0eate/n8uj7VuOHXYomkx3ceXC8eS8Xi1Zn22jp3e8mkz1ibfpR2vTdL6rNJ7Mk+HWhY7RuGPXYItWY5Xyj1lbRaNwACQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEmW9cdLXtPFaxzMvN3z18xZtDqb7bs2p+nlx8xM1s7N8sbnl2rozV6jFbtt2zHL599U7hm3HfdRqMuSbTN59/wB21xsUX8y5nUOTbHEVr8shunUu871qr5ddrL5JtPnm0sffT6e3N74+6y0wz2zzz5lXjJMx74dCIiPTjTaZ9k4tPFf/ACvCbFTBEeMcKc2m8ccp6x214WhS3tUrjweZ+nHKnn7K+a04TV598pNT5iFvCk+ktbWmOYJtMV5+6PP6eIg+nPHPIqpze0+0Im0x4lPak8cIUifUQhbSM89sflGJjtjmOZVJxzxykik93M+gTRFf+1HJSlo/ohHjzwnrX7AxGS0RkmsV4S29rnNi/wCS0+1nl5i0wiV4RxZ5xZ62xz2+W0aLdZy0rWbeWpxjmZn9lXR5Mtc1fp1taZn1EKyx3xxb4bpXJkn1dUw3vOSIm3MLvb9m1uXQVz3wXrzHPmFpGO+PP22rMTElZ21L017he8wjHCnEp6eV2tKe3iOYQre0fcv/AEqfctEMdpmJZXbddlw34m/hsumyfXxRaJ5nho0XmPuv9s3LLpssc25rKl67hn42WYtES2fJExEra9p54V8eopqcPdSY5WmSZrPlgl1YlJktPPtJNp445LT55S8iUJtP5XOm1+p01f8AhvNf7LafRE8QIl0/4y+RtbtOqph1mScmCZ4mJn09EbLumk3bRU1Wky1vW0eeJ9PFeO80j9M8S6P8Vdb6jp/V0wanJN9PefMTLWzYd+YdPhc2az2X9PTfvzDWOtuktu3/AEWT6mnr9eImYtx5lm9o3HT7noseq014tW8RPET6XrViZrO4di9K5a6t5iXj7r3ovX7Vly2tprUpEzx4cyyTkx5bVtaYmJ9Pe/UeyaLeNBlw6jDW1rVmInh5J+Sfj/W7NuWfN9K30ptzHj7Olg5Pf4t7eK6t0ecH/kxxuHPfqW59+EYtbn3zCGSlqXms1nwkpzbJxDah5+I/xXjj8FYj3wmikwmpjtbyyK6Qisd39Kbiv4VK45mP3RnHwMdolTpFfvBesRx44TVxzPlNes8RynSvlSI449I2jiEO2YjnlKukYmY9Ixafylt49pe5C8QqTbn2q6bctXorxODLMVj7crfmEt/9q2iJjyyU8S6X0j1di1fbg1Norb15lvWG9MmOLUmJifu874rXwZYyY5mLRLo/QfVEz26XVW8z4iZaGbBrzDI6RFY4jwjFYj7I4rVvii1Z5ifui0WSIQ4jj0l5nlOpcphMI8ylmefEo8oT7A44nxHEHfNZiazME8pbRzHhCImY9Ny6L3qdNmrF781nxxy6Zp8tc2KMlZ5iYcF0eW2LNExPHDp/Q+8RmxRgyW8x65lW0fL2HROo99fpXnzDbwieRV6QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJAGifOGmy6r4/wBZjxUm1u2fEPn3umK+m3LLjyR23i8+J/u+nGu02PV6XJp8tItS9ZjiXiv+Ib41ybHvWo3StJjFktNq8em7xMmvtcjqeGbavDjOKOZ8yq+v3W1O6ZmY+yet5r7+7ecncK/9McxKpTzHE/dac8KmO1onmPS0Kz5ldeKwpai08RxJEz2StrTPPEzzyb0iYXOOZnxyusOK144iO6V10p01ue963Hh0+C9qzPuIenfi34N0tMNNXvVOfHMQxXz1pHlmw8TJmnw8z4tk3fPxGDbc+SJ+8VZPH0R1B9D687dmiIjnzV7y2fpjZtq0tdPptDhmI+81jlf327Q2pOO2jxdsx5jtas8z9Q6UdKjXmz50azQ6nTWmmbBbHaPfMMfeZrPEzEPT/wDEF0Dlw2vuOh00RitMz+mHmPc9NfHrLUtExaJ44bmPJF43Dl5sNsV5rKnM8/q5Pqx658qN6ZK+JhTj35XYtJb5J+pP3SRj77czHCM/pvzEcy3P456L3Lqnc8eLHgv2zMeePCs2iI3K1K2tbVWB6f6d3DeNdTTaPTXyd88cxHp6V+JPgDDp4xa/e6Ras/q7ZdU+LfjXaelNvx5L6el9ZNf1TMepdDrWIiIiOI/DnZuRNp1V3uNwa0jd/MtK3T492PLtVtNpdPWlq14rMQ8yfJ/Sep2TX5Z/lrRjiZ/Xx4e0Za3170zpOpOn9VoMmGn1MlZituPPKmLNNJ8p5nApyKePEvDETXnxaJVqTH5ZjrjoLduldyy4r0vOKLTxPDWO6a+5l063i3mHkcvGtjt22X+S36fE8qPlQw3n6nvmFebxz6ZIs1rY/PsmZKW8+ULWUstvHgmdwitO2dslodffTX47v0s5jzY89ItW8c8NM5/dW0eqyYMkTFp4Y5ptu483b7bXeJiUscm158epxc1mOYXV8Nvx4Yp8Nutu6NrWfSH3V74+I4hT7eJNrIfblNXLakxMfaUPsltP5Eadb+Nuuc214ceC+b9HiP1S7v09vWk3bR0y4c9LWmPMRLxTfNkrH6LTDaehOtdw2DW0tGe1sfMcxMsGXDFvMOhw+XbFPbedw9hMN1N0/od80d8OpxVm0xxE8LHobq3Q9SaCmTFlrGbj9UctnaXmsu59uSv7iXj75Z6E1Wwa7JfDp7XxWmZiYhy6YnHm4tXtnl766q2fBvG15dPkw0vea8VmYecesviXW49VktjxT+qZ44h0sHJiY1b28d1TotqX78MeJchxxzPPdHlUrWKxzNoiG96b4o33J+mmO3+mQp8O71krGO9bRP8AZsfXx/tyI6fyp8dkubx2xPMWiUYjxPM+3V9B8HbzOSLX9Mlf4P3S9eJmsI/s4/2v/wDSOXPnscV5rHu0QlyzXiOLRMuv6r4P3W0xWPceuFnm+FN5w+ZiZlP9nH+1J6Py4/4OUTERXibRCWbVj3aHQN2+KN9xRN4x24j8Q1Hdejt30tpm2nyzx/6ZXjNW3qWG/AzU/KumHy3iLeLcpO6UMmh1WntP1sdq/wB0ItHqIW72vOPXiU82T4+Zjx5U4iJXelrHaRPd4Vv9ldpIx8z5hWxTfBlrlxTMWiVTwmi37LTVg+t/jq/Qm9RrNDTDlvHfENo8R93COn9zy6DeMUxeYpNo5dr0eaus0+PPS3MTEOVyMXZZs477hkIrzVbW5ieF3TxjUM0cy1/TNEqfKH3TxCPaCX7EwmipxyhCl/T5iPLMbHqsmnzVtS0xLFV4jJ5hXx2mmWLwSz8fJOK8Wh2bYNZ/NaKnM82iPLJNG6F3OK2+lkn+r03mFJh9D4eeM+KLQAIbQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABLSPmLpvF1F0bq8M44tmrSZpPHlu6TLSt6TW8c1mOJhNZ1O4VvWLRMS+Z3UW35dn3PNoctJralp55WOOYtHl6R/ig+Mb6fWX33bMHfXLMzaKx6ebM+LJpLdmak188eXXx5IvXbzHIwTivMKlojtO6Y8KVLTeeITdt55j7MrDuFzi4tSfLaPjrpHVdU7pXT4MVreY88LDozprX77rcek0uO17XtHqHtL4R+N9L0htGPNnxROryViZ5jzVrZ8304/1u8TizltufS5+J/jjbuldqpbNgpk1Nq+eY9OiUrFa8RERH4TRH3n2c/hzLWm07l6ClIpGoPQxm573tu30tfUamlZrHrlitk622Xc9RbT01NK354iOfZFZmNqzlpWe2Z8s5u+36fctDk0mppF6ZKzHmPTxF849I6jp7qvNOPBadPNpmLRHh7niYtETExMT6lrXW/Rm1dU6G+DV4KfUmPF+PMMuHLOOWDl8aM9dR7fPP6s5snEV8q1NDfJkrFKTaZ8eIeiuov4ecml3Du2685Mdp55iPTb+hvgzQ6Kcep3CYtaJ57ZhvTyaRG3Hr0/NNtS4n8bfEO5dRavDmyYLV08zE2mYes+gOhtq6U2+mLTYKWyxHm/HlsG07Zo9r0tdPosNcVKxEeIXrRy5rZHY4/Ephj/SICZ4Q58cx6YW2jM8KGr1ODS4bZ9RlrTHWOZmZal1z8i7D0vgvOo1eO2aI/o7oeWPlr5x3nd7Z9JteS1cOTmI7Z9M2PDbJ5a2bk0xeJ9un/xHfJPSdNonSaTLh1GsmZiZj3DzDo93xa3JaZmI5nmGq6+dZrs059Va972nmZmUNNa+nyRNYlv4sX0404XMvXPbub1itEZOeVf6nMsJtWtjNEVtP6mVi0/dmiXIvSYlXiyXJPhLW0flC88+p5SxdqHKaEsQmhIutvz5NPki1LTx+G3bZr8eqxxW0xFmlUvWvi08K+m1P0ckWpfiGO0blsYsna3fNjiPKyzfpvKTbd10+akVy5Ii0fun1XN7zanmv5Y9TDciYn0pzfhJe8SktFuFO3oTpJe/6phTtM/lHie7ktHhEobL0N1VrNg3HFfDlt2TbzHL1R0T1Zpt80mLuvWuWa+uXjCImtotH28tz6Q6w1W05cdq5Jjtn8seTDF4/wBbGDnzx7RWfT2Mp5cWLJ/5mOtv7w07446y0e/6OmOc8TqOP6efLdYn7fdoWrNZ1L0dL1yVi0elKmDBWea4qR/hP9PHzz2V/wBJhC2kOPx4OJ/KIJQ4JrE+4if7wiApZMGG8cWxVn+8LHWbHterxzjy6LFxP37YZMTvSs1ifcOcdSfEuw7vPdERin9ocx6m+C8+HJe+383rHqIeleI/BPLLTPevqXP5HSeNn/Kvl4X6i6R3XZtRambTX8T+GKpS9Y4tXtn8PcW/9NbXvGC+PUaanfaP6u15++UfjDUbRmtqtDjnJgnzzEem/g5dbTq3iXluqdAyYqzfF5hyDiYniYQn3xC51enyYMk1yRMWhbRlxRPEz/dvbeUmkwss8zXJ3x7iXWfjPc/5vQxp7W5tWHJNXesWnifEts+Jtb9PdrY+7xLV5Fe6ktnG7R3fp4UZnyqTE8RzHtSn25bYhHk5SzIJR7kayl7Zn0jWJgELTEWVaTzwo257vKfHbz5Fqs5sGq+jrKTzxxLrG3Z/5jSUyfeYcV0eaIy8zPDpPRG5VzYf5e1+Zj0raNPU9A5HmcctqAUepAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWW77bpNz0l9NrMVclLRxxMPLXzp8L56aq+t2nTzfHMzbtpHp6ySZcdMlZrelbVn3ExyyY8k0ncMGbBXLGpfNXcOmd527N230OX3x/TLZ+k/jff971GKKaPJXFeY5nte4tw6K6e11u7Posczzz/TDKbVs+37ZhjFo9NjpEf+mGzPMnXiHPr0qu/MtB+HvjDb+kttx5dRipk1cxExaY9OmxHB4iGC6s6l0GwaG2bU5a90xPbH7tSZtefLpRFMFP1EMvqtVg02Ob58tccRHPmXNOt/lLQ6HFk0ujt/zeu6Jcp+RvkzX7nlvi02Wa158cS5tl3HNqrzkz3m125i4vzZ5nn9f1M0w//ttPV/WGv3LNaZzXiJ/dr+07zrdFrK6jHmvF4nnnljsuSb2iZQmJbtaREaiHk83Ky3yd8z5el/ib5Nxa+uPb9xyR9TiIi0y7BjvXLSL0tFqz5iYeFto1WXR6iuXDea2ifs7/APFvyRbLXDt2tyRP/TEz7aPI4+vuq9f0brP1YjFmnz+3bOP2g4Qx5K5KRalotEx4lM0nqBCbREc/aPcoZL1x0m97RWsRzMy4H84fNNNljLtmzWic0RNbWhelJvOoYsuauKvdZ1HrLr3YumtJbNqdXjvaP+iLeXn/AOSv4hsmti2m2DnBxHHc4D1L1Vum96q+bVajLaLTzx3TwwVp5nlv04tY9uNm6je3inhmeoepN13rV3z7hqcmSZn/ALmHnLaJ5if9pZ58oVjm3EtiK68NGbTadykvkv3TKnMyusmL9PMQtZjg0jappstsWSLVny2LbdfXUV7bzxaGt0jyqUvOO/dSeJg0peNtut4Mc+WO2zXRmiMeSf1L+Imkphq2jUK0SjypxKblZhmFPPP6oU+6YTaif1QozKYTCtTLatotEzEw2bZN3pfBGHJMd37tRmyNL2xW+pWeJhW8bhkxW7ZdAyV8d0TEwtMtuZ4hidm3qLzGLLLL3mtpia+YlgmNS3q27oSRBxKHPmeE1ZBDtQ7ZiPapM+FHunniUwpZsHS2/a3Zddj1OlzWras/l6c+L+udL1Joa4s2WtNVWIiYmf6nkTumJ5ZnpXfdXtG8YNRpstqzW0eInwx5cUXj/W1xeXbBbz6e3Yn8jQPjvrvBveKuLVXrXLxHlv1bRaIms8x+XOtWazqXosWWuSvdWUQEMgAAAAAAt9dpMGs09sGox1vjt7iYXAImNuB/LvxrXFTJuGgxcx74iHnbc9NfTay+K9ZraJnw9/6zT4tTp74MtYtW0ceXmD5z6IjbtffV6enEWmZdLi8jf22eO670qKROfFH/AG4jlrzzDL9BZZwb7i4njmzFZ4mmW1J9x7XvSluN7wTH/fDZt+MvMx6ejL37tPjt+aqEo4p50uL/AOVByV6oJoQiE1fYsmiE3AIFO8eEvHHlUt6U5TCJOfLZOjtXOn1tP1cRMtan7L3Z8v09TWZnjiSfMN3p+ecOaJdww3i+OtonnmE7GdN5ZzbZS0zyybE+i0t3ViQAWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFPPlphxTkyWita++VPXavBo9PbPqLxSlfvLh3yt8nzXHk0eitxX1zEr0xzedQ1OXzMfGp3Xlt3X3ydtu047afSZYtl4mJ8vPXXfWOv37Uz/zW7InxDWd13DU67U2y5L2t3Tz5lb4YnmZl08WGuN4rndXy8nceql+/JPdefKXi3HiFbjyhMM7jbS057o5XHZPZzC29XiVa2oiK+1ohhtO7J6xkrxPpU23dsuh3LHkxX4tWyyyanu+/DGZ7WnP3RM+yYhkxWmttw9sfEPUOPeem8UTebZqx5bz9nnv+GDda5OdH3RzEfl6Dj3LjZ6dt5h9M6byPr8at5az8m622g6J3DU0mYmtJ8w8AdUa/U7jumfPkt3RNp8y+gHyXpf5zorcMERzzSfD5+dS4Z0e76nBPMdtp8S2OHrzDW6pv7ZYS8T6iPMpv5bJxEce0ndzeJ/df4+Z48+G848LKdPkj7I1w3mY8L20+eFPj3PPAlDHjntmLQt8+ktMzNIXmOJn7ponieJlCNsROK1PcIds8r3W14jmPSzE+0aWtjtFqz5hnNBr4y44pkn9UMFyd9qTzWeJSpekWhtcZKx7lGc1OGF0Gui0RTJK/mY45j0lrzTU+VbLetp/SpzKSvH2QmUo7YRtKX3/YSz7DWkcf6bRas8S2XZtxiYjHlnzx4azxx91XHfttFonjhE1iV63mrd4xWtHfX0jFJhido3OZ7cd58NgpWmSndWYlhmNNmtu6Fpfx7U+yeeVfNSZnn8JO7x7R6W7YlLak8eEkVtF4tH2VJup5MsRU2iaRLP7B1Bqds1FLUyzWIn7PR/xP13pd7wV0OTNX6tY92l5EzZpm3i3pfbBv2s2nW11GmzWx2r58T7YsmKLw2OJn/rT/AI97RP78ouO/EPyrpd4wU0O55YpmjxEzPt1/FkpkpF6Wi1ZjmJhoWrNZ1L0WLLXLXuqnAVZAAAAAACWl/K2yY912LLaa82rWeG6Lbc8P19DlxdvdNqzC1Z1O2LPjjJjms/LwJ1Jo8mj3jPhtWY4tPCp0nit/41gmY8d0N9+atj/8P3y+Ts477efDVOjMH1N5xRHmIs6sZO6m3zPlYpw5rY5+HccNJjS4pj/tgiOUbX7cGOsf9qEc8cudMKxpHhGI8kSmhCSfSEyiltxCBC3iFObQjkt+lRm0JhWU8zBTJFb1mJmJ5U5tyk5/H5J9LY51aJdf+PtROXb4i08tqaV8aTH8nEc+W6sT6Pwbd2CsyADbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFtuGswaLT2z6jJFK1jnzPs3HWYdDprajPaK1rHPmXBPlLr7Jrc+TSabLMYo8RxLJjxzefDS5vNpxad1vat8q/IE66uTR6TL20jx4n24huebJqb2m9pnmfa7yfV1Opm18szz+5fQ2vHizq48daRqHz/l86/KyTa7C9k18J614X99vyV890cKGfBOLjmYldp7j0ofdLKtWnPPmIW+ee2s+YSjSlmvC3vM++VLPm5t4SRl8eYXiUfTmZ2rTEzChkmYtKbHqJm/EUmf8M1s/T24brl/4NPae714RNtMuPj3tOqxuW1/Bm56nbOoMdsczFbW4l7F0eT6ulxZP++sTLzr8VfF26U1GPU6nnDFZ54mHorR4voabHh557K8OVy7Vtbw910PDmxYe3JGkdVhx6jBfBkrE0vExMPEH8SvSGXY+qM+sx4ppgyWmYnh7jt4hw/8Aiw27R6jpWmbN2VvWZ4n8q8a/bf8A7b/Oxd+Kf8eKsfE2iIZHHMRERCxv20zzWs/9XC/pTiI8upLzkT+ziPudsfdPMRKFuIrM8idlYjjiEOImJlJXJWPaactZnx4EJc1Y+n22hjs+OazzEeF/lvF68fdJ+macWCPDGlpV82GY5tHpQrHdMx+ELJefPMeJZLQ6uePp5P8Aaw+n+6bsnjmJSpaNs7TjjmJ9krHR6iYiK2lfRxMc+1mCY0RCMxHs7vKHiZ55SjRNY7uUJ45iVTms+0l5iPBtGlzjyxjrE1nyy20bvbFlit55iWArMce09bxXifvCsxtkruHQJvXUY++nrhYXtxMsHtm9zpp+nknmJZiuSmakXreJ5+zFMabNZ2WvKhlmZrP2T29qeS0eY/Kullt78Je2YnlWrXj7l4ifSdKbXfT+uvodxpnpaazE+J5el/iL5Ermw00W45ueeIraZ9PLdMVr2iKzx59s7s+u1Gj1GOa5piKz9pY8mPvhfByr4cka9PdmDLjzYq5MV4tSfUwncm+GOu9PuekjbtVmit6REV7p9usVmJrExMTE+pc69ZrOpenxZa5axaEQFWQAAAAJELegcE/ic27Hh0+PVRXzeffDlXxdovrbjbJaP6fLuv8AEdtt9dsmKazxFZ//AIObfHu1fyWmnLbjmW7jvEYtPA9exW/uTbTZsto7or+E8eoS5MfN+7lCbx6YZmJcqE6HMpZyQh3QqlUieVPNMwmpaOVLUXjuNI2kvbwpTKN8kcKfdC2pVmU8ShaeI9/dLFkua3dWIg0R5l1H4utzi/q5b+538VUtFeeeY4dEYbe30Tpcz/WrsAQ6IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAttx1mHQ6TJqc9orSkczyqajNTBitlyTxWscuKfL/XdLabLoMGXj3Hhkx45yTqGlzubTiY5vaWI+V/kbJru/SaLJxiiZjxLj2o1GbUXnJa0zMzylvkyZr2teeeZO3iPDq48cY41D55zOZk5V++8p9LM/V888shX1ys9JH/ACcyvqxzC7St7Usk8/lYbpjnisx7ZWKxKw3m9a4/PuCFY9sTmv8ATpzM+WL1ea17eJ8Kmqy2tPPPhT02mvqbxWlZmbePC/qGWvmdKeHFlyxMUrzLLbD0pvG7aitMenvNZn3EOr/FvxlqNdTHk1WGYrbz5j7PQXTPSW1bLp61w6ek3iI5mYamTlVr4h6Tg9EvmiLX8Q4n0J8JZbUxancKxFZ4mYl2fp/onY9npT6Gnr31+8w2WIisRFY4j8QTMRHMzER+7QyZrX9vVcbg4ePH2x5K1rWOK1iv9k3P7MPu/Um0bXEzq9Vjrx/6nL+t/nPZ9q7segvXJeI8eVa47W9Qz3zUx/lLrm5bhpNBpsmo1WauOlI5nmXjj+Jj5Mr1Jrb7Vocn/wCXw24jiWt/I/zJvfUebNixZ748czMcRM8OWWvfPltlyWm17TzMy3sHH7J7re3J5nNjJXsojjjumOf6uWXrHPE/sxuH+qOWWrMcRH7Nvblyk4SX47JVvHlTycf4FVvER90OY8p44mZOI9RCRT+x2xxPKeIiJ/VCPFeOUSKURExxPpQy4ez9VY8Su4ivCti7JrNbcITDE8ePKbnxwudfpvp1i9YniVpEzxxwmEp6+v3Xej1ExPbefC0i0zB90qzDMTMTHMekIjmOFhgzzWYi0+GUwzWaRMfdO2Pt0kmOJSZPavkiIlSv+eDZpSpP60b2iLeFK+SfqeEkzPfyLaT3vXnn7r3bNwyYc0RMz2MdfmLRPBlvMTERHCJjaYnTdtPmpnp30nmUMlfvMeWr7Lr8uDNxMzNW3YMlNTp5v454Y5jS8StpQmfKPEz4QiPPpCEcfMWXFJjnnz4W8cc+Vas+OEsdvbM7Fumo2/VRqNNktW9ZiY4l6g+Heu9P1Bt1NFqMkRqsccTzPt5JxW7LTLPdFdQ5tj3OM+LJNOZ/LDlxd9WzxOXPHtufT3FExMeJ5Gj/ABn1hpd823HjyZq/zHH5bw5sxMTqXp8eSuSsWr6AEMgAAhb0iT68g5v84d1trw46/wDVb/8Ag0HZ8H0NHWPU8N6+UtT/ADWox6eOJrSWn2iKxxEMlfTw3W793LmP0lvPlSlPHtTn2s46PhDlCUsc8iJVoWmrv+riFxaZinLH5bzN5laIY002mTlJzzByshUhLaOf9kTylvP6ojn7omPC1N78Os/FuPt0sT+zfGmfGeGK7bW8fhubXt7fSen11x6gCG4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAITPEcotc666gwbJtGXJOSIy8eI5TETM6hTJkrjrNreoah8wdb4ds0VtHpskTeY4niXmrc9yyblr5yZLzPMsl1fvOfetwzZZvPHdP3a7gpNc8Orhxxjj/XznqfPnm5PPqPTJY8UR9004omfaNU3tkc7aOGsUt75X+GtbRzysawvNPH6fMphSfabURXHim3PHDWt11H1b8T4ZjdtR217Ia9rq+Yn8rx4jaKxuy3jBXNfju8uufCfQld11mPUZ8fOOs8+Ycu2LTTqN1w4Y/6rRD2V8V7Rh2zprD244jJavmeGtyss1rp6DofCjPm7reobPt2i0+i01MODHWsUrx4hWz5seHFbLkvWtKxzMymtPETPriOXmX+Jr5Y1W3552Tac84rxzW/E+3Ox45yW1D3GbLXBTul1Hrz5g6Z6b09ox6zHn1ET/REuJdYfxE6rXY7U0dfpR9prLznuWr1e4am+o1eW2S9p58yt6xPbxPLfrxaV/1xcnUMl/XiG99Q/Ie77x3fV1eSIn/1S1TUam+omZy5rWtP3mVhFePCesNiIiPTTtebT5XNNLi9xbzKeNJT1FlPFz4/C4rbifSWNJ/K1rx+r0uaXjiFK2SPvCFLRz5TCtlebxaePX7pLTEz2+4SxPM8wj9+eBXaetax4gilZn8JazETMzKNbRPryLJLxHpCsx9/SfJ5j0kjiIIhG0ZisxM8odsWj3xwfbxBHr0aNq85a2wfTtESx+bF225j0uOeILTFq8SjS21lMRFuEI9p8teLJJ9o3K8RGkV5pdVemHjt54Wtcd7zEY4mefXEN/6H+L+oeo6Vy4tNkjFb79som2vMymMU38VhpttwmfEViUn85eZ/ph1rqb4K3zatDOqx472iI5niHK9Xtuo0eovgz47VtWePMLVtW8bhjvivTxaEsUrNfqTPs4jmILcViI49Kc2/VzCVU9qxE+0k1p69p49ektYifPAJsUVifDJ7duFsFvp881ljKz5niE1bcW54BuGC2LLji1bcyTETPHDX9t1VsOTmZ/TLYcdq58XfinmVJhaJW9588QjTJNZifaFomJnlJMiNbVb5pmeVK1ovPM37eFO0rbUTPEGlbViY1LcehOs9VsW64r481prFvPn7PYXx/wBUaLqLZ8WbDmrbL2/qjl4Ei00v3V8S6J8Tdd63p7dsXGW0YJtETHLXz4YvHj23eBy/689k+pe34GF6T3/Sb9tmLU6fLWbTWJmOWac2Y09NExMbgAEi13PNGDR5L88TEeF01PrvX/RwfTx388eY5TEbYOTmjDjm8tA3zWWz7hktaeYiWOyX7o9cI5p772t95lJ9l3zvkZpyZJvPyk4SzEKkwllO2vtJNUvHE8qk+kOAUtTftxMb3+eVzuOWOO2JWMT4ZKsavS3M8KnC3pP6lbuWE8VXGh0sajP22n0tqzyzHS+Cc+4RX91bTqGfjU78kVh1joDB9DZ4rx4/LZGO6fwzg22lJjhkWs+lYKdmOKgAzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgoa7U49Jpr58k8VrHLzX8y9U23Tcr4sGSYxx44iXSPmLqq2j099DgyRE8eeHnbVaidXqbXvMzzLd42LX3S8l1/qG4+hSf8Ata4cXNJtKhNYjL4ZOuOnb2/ZJbBjjzHtu7eQjwp0ieEeJR8wcyLp6efCta8Y8M2UKeLeFhu+stWYx1lMeVbR5SZ8ls15mVjruf0xKbHmv2zyoZ8s2nmzKxxvbOdA4PqdSaabR474e1enKxTZ8EVjiOyHinoLU3r1Dp4j/vjh7T6Xm1tlwTaeZ7Yc7mx6ez/jFomt1/qZmNPltHuMc/8As+efzpmyZ/kXXTltM8ZLcRP28voZnjnDkj/0T/7PAXzhoYxdfbhlzRPnLbj/AGpw51aXY6pv6cOd3pxPP2SxPPhWtXzMR6V8OLFGOJn+p0HDideFnNOJRis8r62PHxxKFqY6+YgNwhSOIiE8+Pst/qTHPkjLbjiZEmbnu5hCvM/lLa0+ePaGG+W1+K17o/Y3pExMrnD3d3pXrHttHSPRG+b/AHpGm0t+2334l1nbv4eN4zbd9S961y2jmOVLZqV9yy4+Jlyeaw88W7uZ8SmxRaPs37r34u6j6VvadTjm2OPvDn18uWl5pbxMLVtFo3CmXFbFOrK1pmK+YS19T4Ua5r2ni3pU7p+y8MKevPHHHCNo4rxwki8+Ut8lkStEE8qduePCat/PuF5otDm1dorixze0+ohErRWZYu82/wCrxLK9NdN7pvmprj0mlyZImftV1/4p+GdV1DembdMFseOJ5jmPs9OdEfHfT/S2DHGj01Jy1iOZmPu1cvIivp0uPwr3/LxDjvxH8FYa4sOu3nFHHiey0PQmzbNt+06aun0Gmx4qR48QyFaxERERxEfaEWhe9rT5dnHhpjjVYUdVpsOpw2w58dbUtHExMPPnzn8TY8uDLue14ojiJtMVh6JUdXgx6jT3wZaxal44nkx5JpO4Rmw1y17bPmru2mz6PWX0+WkxaszE8wtaVt3enon+Ib4q1Wl1eXd9rwTbHeZnisennbLGq02e2HPjmlqzx5h18eSMldw81yOPbDbUq8xPCnE8z4SRmvM8TPhXmKV44heGvPhJHMTzEIzMx5Td0euELWrNZ4Ed0JPqTyyuy67JhtETP6Z/LDzKNctq+kT5TEt0y9uTTfVrPtZzPLFbXuV4n6OSecbL847xFqeYVnwskmFDUR4XXHhSzRE8c+gmFpXFzHH3V9JE4f1c+U+OK1sqRWvbMyMU1l1H4k6+1Gx6vFizZ5+lMxHEy9X9P7pg3bbMOswXi0XiJniXgfRYqzmpebccT4eqP4btZrM+05cefu+nSI7OWnycUa7odfpfLtN/pWdhEK+iZiI5meIhou+td01uPR6a2S0xzx4hyXqTc76zVX/VPEyz/X+90tmnDhvzx4loWbLa8zMz7WiHkOt9Q7rfRrPpWiY4QmUlP6ITLbecEkp4R7Y5EKalnyfTpK67I45Yncssd01qtEIWea85MkzKH9lPun2l7555hl0rtcV57k/nlaVzTCpXNafSdI0vMc+W5fHGktfcYyzXmOWl6Ke/NFZ8uwfG+2Xw4v5i1f0THhjyeIdrofH+ryIn9N2x1itIrEcQmBrvegAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACw33WU0O25c17cTFZ4X8uYfNPUH8tt19JivxbiefK+Ok3tqGrzeRHHw2yT8OKfJO9ZdfvGSZvzHc1nDWeeZhQ1uonNq5tktzabLmk+I4/DrduoiHzC+ac17Wn5Vazz6TzEzCnETCpET288oV15STCWaqkwTCVlG36Mc2lrusyTlzzb8Sz26X+npp4a77mZ/K9I+USmrPhTy+ZjlNwp5vtPK6se2Q6fz/wApu+DNzxFbQ9ofG2vrr+l9Pmi0T+l4j0sc3iZnjh6O/h56k5xxt2oy8ViP08y1OXTupt6L+O8iMWeaT6l3O0c1mPzHDx9/FN03m2/fv52cf/HmmZ5ewonujmPX2c3+d+kMXUnTGbNFe7NhrM1jho4L9l4mXsOZi+rimIeCb1tF7TEeOVfTxM0jlfb1oM2g12TT5KTWa2mPMLeniscQ63t5ifZavMqVq2j3Cre/E8wo5cvPiEi1tEd0oVn3yhknxM/dU23TanX6zFptPjm97WiIiFUx+k236HU6/WU02mx3va88fpjl6O+IPgzLqYw63dcfGC3nizb/AOH74k0m36LFvG7aats1oiYraHfcGLHixRjxUilI9ViPDQzcnfirt8XgxERbIxHTfTW1bFoq6bR6XHER/wBXHlmu3xxE8IjTmdupEREahrXyDsuk3npvV49Rira1cdprMx9+Hz9640NtBvuo0/bxNck8f25fSLVYa59PfDb+m8TEvE/8SnSeTaOp8upx47fSvPMTEN3h31Mw5XVMXdWL/pxvHPFvKp3RK2juj37Qm0xLobcSPS7ieUb8ViP3W+P6l/6KzafxDoHQfx5vnUeXDMaS8YrTHnhS14j2vjx2vOohr3SvS+v3/X0w6XFe3dP2h6t+HfhrS7Zp8Wt3fHFsseYrLcPij4123pTbsd8mCl9TNfMzX06NWIiOIjiPtDQzcmbeK+ne4vBrj+63tR0ml0+lx1x4MNcdaxxHbCuDUdAAACZ4S3vFazabRFY8zzIKOu0un1mG2DU4oyUtHHEw8m/xJdCaDadXfXaX6dYvPMRDr3yd8xbd01bLpdNamXLXmJ8+nlL5J+RNz6r197ZMtvpc+I5bfHpeJ7nL5+bFNO33LSr4rUt/lfdk8Ra0fZY48tpyxNp5hlpiLREw6MTt5+yzmJm08QlmJ8+FzfHMeVK9fHPKyi3mEswmmPKEx4Qsjima25hkdr1s0tNLz7Y2PE+EszMW5hWV4bZW0XjmqXPERWGL2nWxM/TySy1/MRx559KplQi0xPhc462yV5rCTBhvkydkY7TM+uIdT+K/jzXb5qKZM2ntXBz5mYRa0VjcrYsVstu2qy+Lug9V1Nq6Xmlq46z58PWPR+wabp/asWlwUiLRWItMfdJ0f01oundBXT6bHWLcRzPDPOblzTef8ei4nDrgjfzI1rrTe8W36K2HHePrzH2lX6k37Dt2OcdLRbJMf6cq3zX5NbrLWvebf5Y4r8tHqvVK8ek0pP3StNVntn1Fst5mZlb2iZlV8/hLExynbw9pm07lPT+lNCWJ8ekefCRNEJuOUkSn8VrNpkgUtZljDgnz5a/lv32m0rnctRObLMc+IWVp58M1YVmUJSyhz5Q5ZFEl/CNLeEL+SK82iIVleGf6W0ttXuGOlY55mHf9j038rtuLFxxxDlfxbtFsuprn7fFfLsNY4iP2hgyW34e0/j/F+nhnJPyiAxPQgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKeoyVxYb5bzxFY8vLvzFvttbv+ox47/oi0x7ehevNwpoOn9RMzxaazw8lbzltrd0zZLTzzMtziV8zZ5T+TcrtrXFHyxEVi2TmY88shjjxC2nFxeOF9ir+mPDdl46PSaK8qmOvnhGtfCekeVJE3ZX8EY6z9k8J615mINqSxG/VrXFxx4YOKV7Z4qzm/8Am8UhiOOKzDPT8SNre1axWZ48rTPMRMePS8y0txzysNRzFuJlaV6+0a5eHQPh7Uayu+YZxd0xN454c70+O2bU1w0iZtaeHpv4A6G/ldPXdNXSJiY5iJhgzXilJ26vSuNkz8iOz4+Xa9DNp0eGbe5rHKfPix5cdseSsWpaOJiU9YiIiI9R6Rcd9GiPDzj/ABD/ABPGpx33fZsHFpmZvFY9PMmv0OXRWtgycxas8S+kmowY8+G+HLSt8d4mLRLzX85/DmXLrMu67Pj/AOKfP06x929g5Hjts5HN4O576PL15mI45Upj92X3bp3d9DqrY82iy148f0pNDsG7arNWmLR5Lczx4q3d7cbttv0weLT58+pjHiibTM8eHpH+G/4sya3VYt23HDNKYpi0d1faX4g+GNVqtXg12vwTip4mYtD1Tse16badvx6TTY60rSOPENLPn/41dfhcKdxe670+GmHFTFjrFaVjiIhUBou0AAS1P5D6L2zqzacun1OCs5u39Npj7tsExMxO4VtWLRqXhnqz4N6i0O45sumw3tg58cVYLR/EfVOq1MYaaLJxM++2Xv8Ay4ceWs1yY6WrP5hTxaTTYp5xYMdZ/wDlbf8Act+nNt0vHM+3m/4r/h9pp649ZvXE2rMTNJj29B7HsO17RpqYNFpaY4pHETEMpERx6iP7Ez+Ia98lrzuW9iwUxRqsI8CHM/g7uI5t+mGNmRFrl1ujx89+qx14/NmC3/rfYdnxzObWYrzH2iyYiZVm8R7ls/P4UtRnx6fFOTPeuOke5mXDOtPnbQYMVse2x+uPu5F1R8x9R7rhthjUzXFb7RLNXj3s08nUMVPnb031j8mdP9P6eb/zNM94/wCmtoed/lD573Xc5vh2a19NjjxPE+3JNx3HXa3NN8+oyX5/NlGNF9evuPLapx619+XNy9RyZPFfEMRvO967ctXfPq81smS882mZ9sb9S3KtuOkyabU2i0Txz4WvPNmzDnzM78rnHl4vEceGT0+qmeKsLWZ54iV3gvxbn7pUt5Za95mffhSyc+0mDL3zxMq98X6JmFoli0tpmPwknyjeeFPu8Er6Lz+FO1pTfaZU788xEVm0z+EMtY8E5LV4tWfLevjPatXv2sjDFLXnn1wodBfHm9dT6zFGLT3rimY5nh6++IfizQdKaWufPSt9RNY+3qWtlzRSP9bmHhWz+41DFfHHxDt2nx49fumCt7z57Jh1vbNt0W3YYxaLBTFSPtELusREcREREeuEL2rWs2tPbEfeXPvktedy72HBTDXVYTMH1JvuDbdPaK3ick8xxz6Wm/8AVGn0uLJixecnHES5tue4ZtZmnJktMzKsR+3L6l1anGrNaebJN23DNqtVfLe8zzKwr58z7TXjn+5WvEcLRO3h8uS2S02t7PshxEfZMhKWNDk5QnwjEwkTR4hi9110xH06WVNy11MVZpWfLA5Mk3yTafuvWpMqvdM+Z9od08pYsiyqSiIcox5SJbLvZtNbPra147uZUKY5tMcef2dF+MdgrqNVTU5cf6az92O86dLp3FnkZIrDoHRG0127bqXj3ePMNiSYqVx0ilI4rEeE7VmdvoeLHGOsVj4ABkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACRCZ8SDmPzlrpw6CunrbzaPLzx9PjLe0x5mXUvnTcLW3OMXdPieOHMaX5iZ4dLj11R8667l+pzLR+ljaP+SPC/xV/THhR57snpf0r+mPDNMuPVS7fsjX2q9vlGK/sptbSEQqUjzCHCfH4tCu0TVr++T/APnPLHRHieWQ6jnt1fLFxk/Ty2aTuqNaQy+I8+WO1dY+pWI9yvpukph+vrMVOPdoW3ojbcviHpK+7b7ivbHNqxaJmeHr7Z9Di2/QYtLhrxWteHPvg/p/HoNnpqrY47rV98OnQ5PIy99n0TovD/r4ImfcgDXdkS5KVvWa3rFon7SmAazu/RHT25ZZyajR45tPviIU9s6D6b2/LGTBoqcxP3iG1cHELd060p9Ou96SYcWPFSKY6VpWPERCcFVwAAAAAAFpu2uw7doMusz24pjrMyEzpT3jd9BtWntn1uemOsR6mXJeufmzbdtt27dlrk88S4F88fJm4bxv+fSaTU3pgpaYr2z7cnw67UWyXtly2yTP5lvY+LGt2cjP1HVu2j05rv4idZTxirWZYTdf4gt71OKaYv08/hwGusmY81iZXmnzVtX+mOWeOPSPho35uWfl0bcflDetwmZ+vkrE++JlrW6b7rtfMzlz5Z/vLG4Lf8c/ohcU5msfpiF4pEemvbNe3uVnNrXmZtMz/cjHzHMR4ZHsx9szPb/tTnUaXHTzMcrMMrOaTWPMeE9NTXDHMSobhrqccY48MXa98kz5NLRtV3TUxrLTW0eY9MPfFaluJXl7zE8celPJM28pIhQpVWp75UpmeVSJ8cBNV3p44numWU0162w2/VHLA908e02HLMXie6YSr2spbT98Tx7UJ0to9zEGLLmvftwY7XtPjiIdN+MvinfOq82PLmw3xYeebd0ceFbXrWNyyY8VsltVhzvT7LuGrxV/ldPfLNp4/TDv/wAL/BOTWYsO5b9j4xW4t2zDuPQXxhsHS+CnZgpnyxXz3Rz5b5ix0x0iuOsUrHqIaGXkzPirucbp8U838sN0z0xtHT+mjDt2mpWIjjnhnEJmIjnniIYLfeo9JoMcxW0WyR9mr5lv3yUxV3adQym4a3DosE5c1oiI+zQuoOrMmal8eG3GOfwwnUHUWbcs82i0xHrt+zAWmZmeefK0Rry8l1Lr03nswev2r6nVZc2Tm0zNZ/KnETwpxCeP7pmNvOTktad28yjzE+CfaCMeiI0je0OJOE3KMBpS45lYbtrK6bFxE+ZV9fqaYKWmZ8tX1uptqMk2mfC9K7U2kyZLZb99p8ox/dRmUvdPPtn7Uwuu7901Z8x5WfPn3JF559mk9q//AG5TV9rOl4iY5lmtm0s6rU0pSOeZPDJGCbTqGR6X23Jq9VT9Ez5dz6X22u3bfWsV4m0RMsb0X07i0GlpmzY4+pMeIbVEcNXJbcvd9K4EcbHEz7kDkY3XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEma0VxXtPqKynWW85Ix7bmvM8fpkRadRt5l+XtX9fqPLH4tPDT6z4Zvr3L/MdQZrT9rSwtoiteXWxxqsPlvOt9TkXt/qbT17sjJRXws9BWJtDJ2xzxHEJu1a+FCKp+39KeKWifSM1nj0xSvCjwcfqhUms+PCWYnn0g01/qjHxbva7fJxXiG3dT4rW0XfEcy03t5njny2sU/aWTUmZ8zLavj3bY3PecVIr3TFoarSIrPn06Z8D6Wc3UuKcdeYi0coyzqsyz8HHGTPWs/t6h6V0n8lsmDBNe2YrDLJcccUrH4qmcWX1GlYrERAALAAAAAAAAAAAADW/kfTZNV0frcOPnunHPHDZFLUYqZsV8eSvdW1eJhMTqdq2jujT5o9cafPpuodRiz1ms1vPv8AuxempN+eHaP4m+kdRt3U2bW4tNMYclpmJiHHdvj9V68eYdfHburt5jNSaXmsqdo7Z4TY81qT4VMmOZn0k+nb/tZGCV7g1lopNuUufcs1/FZmFpXmkTEwllCPCrfU57f/AKto/wAoRa9q8zaZU58xwnp4gE0zPPnlNSOJ5g8W88qmPtmePSTS2yx+uZUp98Lq1P8Akn8fZCcEc8zIlZzHlH7LqumnJfivMzPqOPbYNp6B6s3aaTpNn1FqWn+vsnhWZiPa9azPqGsY6Xt+mtZmZ/DZujOh996g3PFh02jyTS1o88O6/GH8PWfJGHXbxb6fExM47Q9G9N9K7NsWnxYtFo8dL0iI7oj7tbJyor4q6HH6da/m/hxz4u+B9Dt2XHrt1p3XjieyYd123btFt+KMWj09MNYjj9NYhd8flLlyUxUm+S0VrH3lo3yWvO5djHhpijVYT8QtdfrtPo8c3zZIqw3UPUmj0mmmmDPW+WfxPpz3c961WvvauXJPH91Yho83qeLjR73LZ+ousKWrOLT24/eGi6zW5NZmm17TPlbXpM3meeUcfieJj/K3/TxfP6hm5VvunwmiI48whasJvHKH3HO0l44E1uEqwj4R/wDuk5T0mPdp4hC0JqxzC212tw6ak/qju/C13bdcWnpNMdomzW8+ptqLza9mStJnyWtpV12svqc0z9lrMcfZHmOfaEzH5Z4jTGltPjwpTbyqWmFCZjn2svRP3JbWS8/5gpWb5K1rEzMz6RLJEblWxd17VisTMzLrvxZ05OeaanPTiseYmYav0R0tqdbq8d74J7OfPh3rZtvxbdoqYMdYjiGvkvrxD1HSOn99vq3jwvKVilIr+PC13XcMG36W2fNeI4jnhcZsuPDjtkyWitK+ZmXFvlPq6uo1V9Jp8vNK8x4n2w1jcvQczlV42ObS3jRdeaPNq4x3msUmeOW16LXaXWV7tPlrfxz7eUo1+WMndF5jz4bb0X1Xq9Lqoi+ea0/eWW2LxuHD43Xom/bk9PRQ13prqTRbjgrWc9fqf3bFywaekx5K5K91Z3AALgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEsP1dPbsWef/TLMSxnU2OMmzZ6z67ZTHtizRvHMf48ldV3tbecv/wA0sZe0xHn2y/VuPt3zNH/qnhir059uxT1D5XyIn6krva+b3ieWdmOIhg9r4pkhnreaxLHk9sVVNCZ+ybwTHEcsMssQpSlnynmCKqsihq8UZ9JakxHpz/V4/oaq9Jjjy6VSkT4n7tS6u26ceX69I8fdnw214Y8ntr1nXf4bZ+nvtvHPdMOR1iLR/Z1T+HjU0xdQVpM8TMx7XzfhLd6VMRyqPVcfb+yKWnmKz+yZyH0wAAAAAAAAAAA5AEOf2Of2kEULekL3rSObWisfux+6bzt226W+o1WqxxWsc8ciJlyX+KXR48vTsZrVrE1rPnh4vxx2avLaJ+8vQ38Q/wAm6be+/bdDeLYq8x4eetJXvz5LT655dPjVmK+XneoZK3yfamtzxyl7p4T5I/HpL28R+7ac9RyczPlTlVy+1ORMJU9Z8IcIxHgSeeU1eZlDjyuMGHutEfeUbSl/VaYrSs2s3Pob493rqXUUpTT5IpaY/Vwy3xX0dG+b3p8XbzWbRy9o9GdM6Dp7bMWDT4KRk7Y7p4ambN9P06XF4f1Z3b05H0J/D/oNB9HPus1y2rxbh2/bNq0O3aWmm0mmxUpSOI/TC94/eS0xHmZ4aFr2t7dnHhpjj7YIiIjjiI/sha1aRzaYrDD7r1FodFFq2vE3j00nfOr8+etqY7cRHrhGmtyeoYePH3S3beOotFt8Wi14tb9paBv/AFdqdZFsWOZjHP4a1qdVn1N7Xy5JtM/uoVi0QmNQ8lzeuZs/24/EKkZLXz902m0z+ZVZnmVHFXi3Mq0rQ4lrTadygSjCPAiEnCPCKPHlAp2j90IjnwmtEcrTXa3Do8c2taJstCFzeaY6zN7RWIa1ve9cXnFhn/MMduu8Z9TaYraYoxcczPMzyzUp8yj2r2y3yW7rWmZlHnlSqni3hmVlVrPhFJFvHCPKyqF1GJ5mVa3qVrEzEz2x5RLNh+VfHzM9sNr6K6fz7juOLjHM15jzwodEdOand9ZSvZPbMvQXSvTuk2bSUrSkTl48ywZMkVeg6V02/It338VXmw7Zh27RUx1pXv48zwyNrRWJmZ4iEZaV8jdYaPZdDfBXJE57R9mtETadQ9fly4+Nj7reIhhflTq/Hh0OTQ6XJxefE8S4TqM2TNlm2S02mZ+673nd53HWWva0zNp5Wf3b9ccU8Q+e9S6hfmZN78QjSPCritMTzEzCl/dPSeJJ9OdHtmdl3nU6DUVtTLaOJ/Lt/QXWWDcsVNLqckRl48TMvPXHM8yyW0bhk0Oprlx2mJieWC9Ys7HTepZOJeInzV6srPMc+4/KLnfQfWk7hjpi1V4jtiIdBxZK5KRes8xLWmJj295x+TTkU76SnAQzgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC31+KM2jy47euyf/ZcJMsc0vH5rMCJjcPJXXePs6l1NLeIi88f7Ya/Zx4ltPy1pp0/UeaeOO60tNiZrE/d2MfmkS+X82vZyLxP7V8GSKZYZ/T5a5MUTE/ZqlrT2zPLKbDqYtP0rSjJHhqevTNc15RnifEJZjiUax5a0rxKE0nlNFZ+6fiUYhVdClJmeEdVt9NbpLYbxHr2q4Y/UuK81lMTMImNuZbjtebQ6m1ZrPZz4Zz471OTQ7xTLSe2YtDZN40FNbgmO2O7j20u2PUbbrorXmPPtsRfvrpGG048sWh7L6W1dtZsmDPeeZmrKua/C/UOLV7PTQ5csTkpHjmXSnMvXttp9P4uaM2Kt4kAVbIAAAAAAha0VjmbRWI+8lpiI5n1Dhf8Q3yVk2bT32vbc3Zl4/qrPlalZvOoY8uWuOvdLpHUPX/TmzXvj1Osx/Ur9os0/VfO3S+G1qzmr4eLN76h3fctVky59XkvMz97SxsZL3mJva0z/dvRw415lx79TtM/bD2PrP4idkx5bVx9sxHph9b/ABI6esz9HHWYeULV5n1yhNV441IYp6jll3nrP563TdsE00tpxfvVzTe+vOoNxxzjvr801n3HLUqxMSjzLLXHWvqGDJycmT3KtbLmz378tptP3mZT46zXmftKhW0wqVtMrxDVn9q0RHHH2O2EkQjz49rI2p5cczbwk+lP3V4QEbUPp2QiI7uLK/3Q7f1czBB3ShTHEsjtuOs6mkT+VpgpNp548OgfGPS07vuFMuWs/TraJliyW7YZ8cRM+XZ/4cOms/167j9OYx1mJ5mHou1q0r3WvWIiPPMucbHvei6d2THotLirWa1iJmI9sRuXU+v1M27clq1n7RLl2mbzuW/fq/F4lO2J3Lo2s6m2rTd0XzRzH2ajvnV854n6MzWPs0rU5pzT3XmZnn7oWta0REz6V7XH5H8hzZI1SNQutZrcmptNrWmeVjatpmU8VhGfS3bpxMma+T2pUiIjiZR9T4OA0w7T0mE0WifupI1lOkbVYlN9lKFXFHdyTBs45hGf0xzM8Qk1Gpwaes2yXiGubvvdskTjwz4/MFazZO4X+77riwUmlJibNR1moy6jJNrXmefslzWve3de0zKnLZrSIU7lPieEszFfEqkqOaP1L6THlP31R+pX8rf0TKVu2Fx9fHHiZTRnx/licl/+SVXFaPv4hKZxwysZK2jw2jpHpPW7tnpbHhnt555mGk7VuGiy7rg0l81Yi14ifL1t0fotDpdl038nWsxNI5tEMOa/bHh3ekdJjPM3yelDo/pzBs+kp+iPq8eWxDX+u99xbDsWfU3txftnt/vw1I3aXtIimGnjxEMd8gdbbX03o70z5q/WtHERE+nmTrDqv/xXX3yRltetp58sP1j1Hq9/3XLl1GS14754iZYO1f0+nVw8eKRufbwHV+qW5d+2PFYbLtmeMuWOJhmeI5aFpNTk01u6LT79Nu2fX01eGOZjugy1mHIiuo3C+nhNSvdPhKqYP6mCV6p60n390aUt7+6pWFXHWVGRkentTm01+6LTHEux/H/VGm1FK6XUZf8AknxHMuL6SJ4mF9tmfLpdXXJjtMTE888sV6RPl0un9Qvxbx+npeJ5/dFqXQnUMblpq6fLaJvSPcz7bawTGnvcOauakXr6kAQygAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACExzE/uihb0Dz389aCdPulck1/r88uWY6+bRLv8A8+7ZbUaPHq4rzFI8vPt89a93EcOrxp3SHzzruHs5dp/alqOOZ4UtHnnT5ovE/dSzaiLX7Y9oxSZj2zTDjxGm56PNXPhraPPhc1jy1vp/Vzjv9K0tmx8WmP3alq6k3ESjwnrVUjDP5T1xT+WJlQxV/UqxBjxzE8yqxQTpJxwxW+aLDmiLRWO78sxNZWur09801ms8ce1q20pMLTo3cdVs27UtjtMV58vSnS274t123HlrkicnHmOXnONJ+rmvts/SW/6nZ89Ym0zX8cqZKxeNu70bqc8e3Zk/GXfRgumd9w7pp4mbRFmdar3NLxeNwACwAAADHdQ6yuh2jUaiftSeHhj5S3HNuvUmpyXvNo7p48/u9u9a6W2s6c1mOk8WjHMvB/UGTs3vWY8n9VbzHlucSPMy5PU7TqIaTqK9uW0R+UtI/VCtuNqzqLdv5S4qza0Oi4e4hG8cShwuLYv3hJ9OY/AeFOIj0cI3/Sl+pEKpR7U9Y8KX1Yn0TliAXMf08puKzX91tGorEeiNRX3EeEqSuJ4jwktKOO8ZPMQjNYt6SrM6SQqY4m3jjwmx4ZlsXTfT+fcc9K0rPEz5J1HtivlisbS9K7JqN11NaY8c9nPmeHeuktsw7JoK460iLzHmUvSvTWm2rQUrWlfqceZ4ZjNp72iOJ44czNlm06ho5uXM+K+k1ss38zPKTzM88pqYeIiJTdnnwwy0ZS1jz5VYS1rx7TcxyQiEfshMeET7JSpcIT7T9vlH6ciFOUI55TXiKRzeeI/di9x3jT6akxWYmVoiZ9IZDJmpiiZyWiI/uxW4dQYdPWa4p7pn8S1fct01WqyT23mKSsKRMW7rTMssYv2Mjqdx1GqyTN7z2/hCt/HC0resfZUjLER6ZNIlXvKSUs5ItHgi3haIVRlQzf1K/wB0mSnd5g0tT2tpSzPCtOKZniGP3nWYNtwTkz5I8R6NM1azM6hS1F6YpnJkmIr+Wp9TdVVxVnBpbefXMSwvUvUubWWtXBbto1bJN8luZtMyyRV08HD+bstp941cbhTPXLMWrPPPL2p/Dd1r/wCN7JTQ5sndlpXjzLwtjxX7uYtxLr/8N3U2o2bqvFgyZeK3tx7Y82OLVd7h5Jx3iI9PeM/hoHzdt99b0tktWJnsiZ8N50WaM+kxZo/66xP/ANlh1bpf5zp7WYOOZtjtx/poUt22iXdz178dq/uHhjJTt1eWsxxMWlDJM/ZlupdHbbt4z4M1Zi31JYvNNZrzV24tGtvl2XHMWmJW1+PUq22622j1NeJ/Tz5W178zx91LjlFvKMcdviXRdFnpqcNb1leYo88cNL6Z3K2HNGK8+JbzoojN+qstPJXtlPiJT0r5V6xwmpgnlWjBZi2uaf8AZdY68z7U8GGY+64rjnt8T5VmdpiYZzpbdL6DV1vW3ERPl2XYt5w7jhrMTxbjz5ef69+OOefMNz6N3yunrStpnnljvX5eh6N1H6VvpWnw7GKOizVz6XHlrPPMKzC9jE78gAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgOu9DTX9N6nFavM9s8PI3UWmtpNZmw8cTWZ8PaubHXLitjtHNbRxLzH807HOg3vPnrTjHaZ4bvDvqZh5j+Scab0rlj4cmrb/kj+7JUiJiFjFec/j0v8fifH4dCXibek2K04ssXr+W4bJqK6mtfPmGpY4/MMjtOotpdRFuf08sWSvdCse26dvEp4hT0mempxxevHMwrcTDSlsQVjymhCORVePRKVHyCEnH7nHlP28o8cBpl+nN41OgvEUtMRy6PsHWNc01pqbRx6lySk9viFSma+O3dF5jhWY37dTh9TzcbURPh6F0mu0+qp34skcLiJifUxLhmg33V4a17Mtoj+7YNB1jlxRWLXm3HtimunpcHXMV/Fo06oNM0HW2DNMRk4hm8HUW2ZIj/nrE/jlV08fLw5I8WZgYzHvu3XmYrnr4VKbtobz4zVGaMlZ+U+70+ptmqpH/AFY5h4M+TduyaLqjV91e2JvM/wD3e8L7lobUtWctZiY8+Xk3+JXbsEbzk1emj9E/eG1xbavpzepxFse4n04Bnj/kt/dNh5iUMlf1Sn0/MXjmHTef2uaU555nwp34iJXE2ieeI4UuY+8AtLRzKnNOZXdqxP24VNNp75skY8WO17T+IVlassfbH2yky+v0+f7N82L4/wB43PJWbYprin3Mw6LsvxFtuOlb6rJzP3iWC3IpXxMqXz1r5l57iMnHM4rJq++Jjh6hj486fx4vp9lJ+3PDSevPi/T4dLfV7ZPdaI54hSvKrM6Yo5VLTpx7S89sxC90+KbTHhJg0l9PlyYskcWrPEsrocPrmG1vUK5LxELzZ9tnUZqViOeZdr6F6fxaLS1yzSO6YaX8fbV9fPGS9fEenX9BijHp61iOOIaWfLue2HNy37vCtWJiEtonlU8oS1WFRmOJOE1kqVZQS/umlT5TCE8euUY5mYU5tEe5iFnrN302lif1RNoPYydorXzaeFhr910+lpMd0Tb7Na3Hfs+pmYp+mGLyZb3nm9pt/dkjF+zemR3TeNRqInieKsLkta882tM8quW/6OFtM+WxWuo8KwTXhDiDnyhaVpSQmiVOZRiUIVafuqV8yoVlUpPM+Eq6V6+VTsitObeFjrNfptvxTl1GSsRH7uf9WddZs9rafReKeu6E9sy2OPgtkt4bV1N1NotqxWrW8Wy8eOJcp3/fNXume1sl57OfELDV6jNnyzfNkm8z+VLifwyRXTt4ePXF5+UsRPpPTHE28pq8TMQrUiO5LahJNKxPMMn0tqr7fvmm1XdMRW8eVlPHd6VOJ4rMflExtaLa8vof8T75TfOk9Lli3dalKxP+m3XrGSs1mOazHEvPf8JO+zfZ76DNfmf+l6Fjw5OSvbaYenwX78cWeXP4idhrod4tq8WPil/PPDjndb6L1j/ELtNNZ099aK/qrHt5QzxOOb45+0ulxrd1Hhut4PpcqZj1Plbcz3+VWIU4nyr4q8w2Ycaxh/ReLx9nRejNRTU6eI5/VENCx1/Txx5bJ0XnnT6uKz4iZY8te6qsN7ivE8KkQjPmImPumrHlz2VHHCpCFYRQhC/o0Wa+HUV4n9KM+Y8qE8xfwa2vjvNLbh2noHeK6jT109rczENxhxPofXXwaqnmYjl2bSZPqael4nnmIYLR5e/6Vyvr4Y37hWAVdQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlzb5u2Cu57R9alf1UieeIdJWm66LHr9Dk02SInvrMQvS3baJYOThjPimk/Lw5uOmvpdwtjjnxZeY6xFY5nzw3L5V6YybTvN5rX9M2554af2zHHMfZ2a27qxL5by8N8OW1J+FSleZhVraKV4nyoxz9k1p4x/uaa0W8sps27W0mbtt5rLbdNqa6jFGSnE8ucTb8Mntm6ZdLasTaZp+GHJi35hmrbTd4vzPEpvay2/WYdZETS0d345XleYnhpzGpZYlHhGleZ8ox7VKRHKsrQliqPbyqREcFoQvpCmKJj2mnBE145T4vSpALeMc09ShFJi3dzK5tEcJIrCJjZ3THpL3TX1aY/yfVyxaL1y3j/ACm7YOyEahP1bx6lcU1uorxNbTH+VWNx1XH6clon+61iscEVg1pb+1l/9lzi1utrfmc1p5+3LXPkvab7rsF4iO/LEcs7WOFaIi9JraOYnxK1bTSdwzY+Zmje528j7lgvptVfDekxNJ48qFJ8w7p8kfH+PX4r6vb6RXJ7mIj243rdi3XRZZx5NJfms++2XSx5K3je2zXN3x4lazbjjhLMzNuIrzM/hkdt2HddbkilNJk8z77ZdR6G+Nq4+zVblEW+/bKcmWmOPKb5opHmWidKdG7nvmSsWw2phn/r4dj6P+PNt2WkXzVrnv78x6bdodLpNDpowaXFWlY/ZUi8Odk5Fsn+Q078m1vUpceDHgjtw1ilfxEI3vMRxM8oz5SXa+o9sM5LaU/c+VPPHdgyUmOYmsxwqzH7pfutpim8uA9W7RGn3jNaY7e+0ytNDponNTHHmZb58obbaM8ajHXx95iGu9J6K2q3TDPZMxE+fDo0tum5bEXma+ZdL6J22NPoaXmOJmG24p4pELHRYYw6elKxxxC8p6aNvM7YYncqvuUe390K+YT8ceZ9Kra2p3ql7efRqdVpsMc3yxH+WF3HqPT4omuL9U/svWsz6hSdMtlmmOvN7REMPr960unie28TP4a1uG66vVWmYyTFfwxGWZtaZvaZlmrh/bHMxPpmdx6gzaiZrj/TH5hisme+Se69ptKjHHqCfDLFIgVo1H4hD688+lCZQ5X7YFe2bmvHCn3Kcz4IlaIVnwqdynmyzWPEJvspamJisImE0828n1p454TVyW9xCnirN+KRPn8Ng0HTmv1Om+rTBaaxHPParOm1TFOSdVhgcurrhmPqcVhht56u0+jrNMPFrMX8manWaLVxporbHx4n7NB1meb8d0zN49zyyViNNzFwImO67J75veq12W1smWe2f+nlhfqR+FO1pmeZSzPMrzLfpjrSPEKk2iZ5TTaIiFLxzxwqW9cceUe2TUJ4rEcW5XODHGXiIhHRaS2bt5jwzmm0dMURxVKu5hY00FYjutKNcGO08Rb0yGp7a4p8cMbht23nmBMeXY/4dOoKbR1ZptFktxjyW8y9mYslclK3pMTWY8S+c/TW6W27f9NmrMxMXh77+Ptb/P8ASOh1PPdNsccufyq6nud7puXdZp+lH5G22+59P5cNK90xHLx11rtN9BuGSsc/1eXunNjjJitjn1aOJebvnnpDJpcuTV6enMWnnxCeJk1Pa5/X+LN6Rlr8OEYcUzeI+y+xYoqpYsdqXmLxMTC5jx9nTrDwt7TtNSkTLI7ZaMeqxTz/ANSwrMR9lal+MuK0eOJTNfCtbTMuraOIvpqW558K9cXP3Wex3jLttLfsyGNyLeJbMT4U7/ojhJ3quePMKXCu1k0W5hJMRz3SnpVLkrxZMSaXm2a62myRatfu7L0JrL6zbe+9ufXhw/FPbaOXT/jDW2iPozPifsrePDv9B5E0z/Tn1LosAML2wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASANH+U+m9Puu0Xz1xxOWkc8vNO46acGrvimPETw9lZ8VM2G+K8c1vHEuC/MfR3/AIXktr9DjmcVvM/3bnFy6ntl5f8AkHTu+v1qR69uU48Ux5iFHU1mtZmPSXJq8tJms+JWmfV5b/pmfDo6eH1uUYlN3eFvW/lPyjSyvo9fn0Of6uO08fhueyb7g1lIrktFb/u0S0cxwYonHeL0tMTH4Y74u9aLxHt1ekd0RNZ5j8qtay0nZeoNRiiMea3NYbjtGv02sr5vWJ/u1MmK1Pa9MlZlcxWeEZrMrqMVZj9M8/2Pp8MLNtb0iYhNCvXHE18k44+6NpUJnwhHlXnFVH6VYiDasrdCZXM4qpfpVRtVT58QjCrFI8QdkAkrM8q39kIrHKpxEehaJ0ljxPrn+6z1W1bfqrTOfBSZn9l9wR7T6RvystNtmh0kR9DBSJ/subV+8Rx/ZU+/JM8x5VnckzMpIjwktWYnwq88Qk7uUaRtLW0x7TZJ/T4Q45TRHMcGjalPpLxKr2nbWI8zECGL3bbcW4Yvp5axMLfZuntJt1u7FSOWS1Ot02niYtevLFarqLBSJik8zDJE29Qn4ZuY7UmbXafBX9eSvP4adq+pNRbmMbDanWajU5O7Je0SyRimfaay3fV9T6bFExWOZYjVdTanNzXFPES1mJ59zyqVtFfTLGKIRaZ+F3qtZqtRefq5Lf7UOePvMyki8k25ZdMM7TWtPChafKpafvCjzPPIQjMoWmeEJmUtrTEC8ITJEpO6TmeUsnZKrHMzwnpWJ+0rfJktSvMKml1E2vWLTCd6THHvfzC7xY+6PXDJ7Rsep3TJFMWK1v8ADY/j7ZdFvG4Y8OovWKzMcu77B0ptG0xW2mxVm3Htr5c8V8Q7vT+hXyzF7zqHMuj/AIqjJbHq9XHbHPmsur6Hp/bNHpfoYsFO3jj0y1YiI4iOIRmGnbJa3t6zj8LDx41SHkL+KnpO+h3GNZp8XGO3nmIecdXSYtz78voj8zdN6ff+jtZW+Puz0xzNJfPfqTTanbN2z6LPWazS0xHLd4+Tcalzedx4pO49MfMzx5SxPMfuhbmVfBjrbjlsudMahJX3CtM+YX2LTYe2JlUtpdPz59p1KvdC/wBrvT6VfHlk+6I9MFpslMd4pX0ysZOaQlVJrpmcXLHYZ5v5XesvHbMfsxVcs47zMfk0VX1YimvxXn8w9s/w6bzbX9L49NM8xirHDw3bPa+ekx7h6m/hF3v6s59Hlnz2+Gtyq7pt0unX1l1+3pOPMMH1hsWHe9ryae9Ym/HiZZyEZc6J1O4d29IvWa29PGnXvTdto3LNWaTEVtPlqkRMx59vUPzj0ti1Ww5dfgpHfSObPMs0nHaaWjzEuxxsvfV846vwZ4ufUep9KdY/Tx90Jni1Y/dPlnivct7X5tWPvyz7cqKT7dU6Tnu2as/szGJhei+Y2SIlm8bk5fylnr6SZo5mEkR5XHbFvZGOvLHteJU6Qkz1/Vyu6Y6qGrpEekxJMqVI5jn03XoHURg3DDW0+LT7aXinujiWd2HPOPUUiv5TPpucDL2Z6zH7dzpMWiJieY4RWWzXm+24rTPMzC9a76RE7gAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADH79ten3bQX0morE1mPEyyAR4RasWjUvKHyh0Xqtn12TJjx27JnxxH2c/tSYni3PMPaPV/T2m3zQXxZKx38eJ4eaOvek82z6jNM45ilZnieHUwcjvjU+3gOsdHnjW+pjj7ZaPVPEHbwjENpwZRmPCBb0Jhit7VKW4nlcYNTnxz3Y8k14/ErPnhGLzHJMbRG4ltez9V59PxTNzMfmW06HqTbtTxE5Ii0uVWvzClN70nnHaaz/AHa9+PWzNGS0O4YtThyU5pkrP+SckfmHF8G97jpbRNctrRH25ZjRdb6ikRGbH/lrW41o9M1b7h076kflGMkcNK0fWWkyxH1LRWWU0/Um23iO7PEf5YpxW/R3tji8fkiYYim77dfzGoj/AGucW4aO39OaJ/yp2z+kd8Mhycwt66nDP/6kf7R+vhj/APUj/ZqV9q8e00yt41OD/wDmR/snUYY93j/ZEImy4mYn7kSsr6/SUn9WWI/ypX3fRVj/AM6P9p7ZR3Ml3eSZYe2+aOvPGSJWmfqbDTxXiTstPwbbDKna9YnzaGo6rqjLMfppwxWp3/V5ZniZhaMViJ35b7k1unx/1Xha333Q0mebw59l12pyz5yT/tQta1vczP8AleMP7RtvGp6mwxz9OeWL1fUGfN4pMxDW6R+VfHxEcskY6wiZR3HJqs+SJ+pbhaZs2LTU79Rk9fld5MvbE8/hzvrTc8uTU2w1tMRHhlpTc6ZcVJyTptc9T7VivMTeFbFv+1aivNckcy5Bl8zMzPKvprXpTmszH+WacUOhThU/br9dVp8nHZkr/tUrak+rx/tyjBrtXinxmt/tkMG9aunHOSZ/yr2SW4P6l02Jjj3B4n7w0XBvOpmkTNpXWPec8fdTtlhngXbhx+8JZiIlrNN6y+pV67peZiYRqVf6N2c45niEtqdsTyxddwvH29mTV5JxzPKPK9eDb5le3yUrPmYUb6rHWOIlisma8z7lJNu77m5bleHHyvs+s7o8LWdVki3MTwo2niEnd4Nt3FgrWPEM9sXU+t23WUyYslo7Zj09X/FfVGDqHYsXOSJ1Fa/qjny8W88XmXVPgXqLLod+x6b6sxXJaK8csOXHE126nBzfTt2z6l6zgSY7c0rP5jlO0XdU9RirmxXxXrE1tWYmHhr+KPpPLtPVOfW0w9uHJaZiYh7on043/FB0xXeOk76qmOJviiZmeGXDbtu1eXj+pjl4OXujr4UNVjnFqsmKY47bTC90PH04/LqVny83f0uYmfHEI2vMceE148RMQpWnn7sjFpCJ4yRP7sngyd1WMmOeF7pOeEEJtXaeJhjuP1L/AFUc8zysoiJmULQX/rjj7OzfwwbvOi6px4Jnj6lohxy1PMTLcPiDW20PW+hvSfP1K+P8qZK7pMNjjX7MsS+hFJ5rWfzXlMtNpzTqNvwZ5jibY4XbjvUwsN+0NNw2rNpLxzFqT4eQuv8AbP8AwrftTh7eIi08f7eyrR4t/Z5j+edHWm9ZMkR5tM/Zt8O2r6ed/keCL8eL/MOUZ+bVjz4W9KzbPjrH5V8vrjlcbJpv5nX4qxHPFvLpTOvLw9fbp3TGOce1UrMceGWrHhQ0mKMOnx0j8Lirk2ncrxCasJojkr5T1qomCkSoa3xK7pC23CY4/dNfZZZY7cWlkNqydmprMz92Nx+11o54z1/uvK+GdXiXdul831dqx/tDLNf6IyRba6R+IbA1303j27scSADMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATDWutemdJve25KTijv4/DZRMTMTuGPJjrkrNbR4l5I646Q1WzZ7RXBaKRPvhpt4mszWfEw9pb/ALDoN4018Wpw1m0x4nhwf5A+MNTpMt82ixzaInnxDoYeRFvFniOqdDvhmcmGNw5FTu54nyntMRHiF/qNuz6O80z45raFravHjjw3Il5q0T8wod0ffyp5LTHpXtp7f1KeeviPCYIhS7p/KWZ8fujMTxwhNZmEp0jEck0rPuEaxxCaEJU/oYvwqUxV9xMo8KlfEIVtPhPS16+rz/tWx6rUU/pyT/tQhEmIUXcblr49ZpR/8U3Cfeef9rKZ4OZV7Y/TLEyvJ3PX/wD86f8AaS267jPic8/7Ws+0syrNYWhczrdXfzfLM/5RpqMs2jm8zH91ryqYo5tCNLaX+PJMz5mf9qscT75UsMce4V+2ZjwqjUqczbnj7CeaW45S8T94VlaPSWeOElp4T2j9lLIQifRW0yrUtK3rPnyrY5/CWOVXiLTPdHPhzHq7H27lk8ceXTJmYzREfeHP+voius5rxz91sX5OjwY+5ql4hGlpiOPshbz5I8RyzTLs0iFStplVrM+OFt3cJ65+2VWTTMafJbsjlc47TM+WO0+spWImy7wa/Ba3DGyajS/pM90cMjhmOI8MXj1mDuivML/FuGmx1/VMI1Ks6hfYuJnzCtNZmsxEeGNrvOkrzzxyhk6j00V7a18o7ZO6sMhGLz/Sm+hWftwwWTqSkTPbXysdT1Bnt/TPC3ZKv1IbHqK46V/qj+yx1GWKzxWOGC2/X6jU66K3tMxLMarmJiPuTXS9bbjwr4P1eZj22DoXNbS9RaW9Z7Z744YLR1mYhnujtNbUdSaSkR5+pCkslN7h7T6ZzZNRs2DLknm00jyybHdO4Z0+zafHb3FI/wDZkXLl6ivoYTrXRV3DpjXaa9O7ux2iI/wzaTJWLxNLRzWY8wmJ1JMbjT5qfIW1W2vqfVYLUmv/ACT9mM0vFMXHHn8uxfxX9O5NB1ffWYMfbhvPPpx3TVtOOPw62K3dES8vyKTW8wuK5J/Epp7fwpzzzEQn4mGZrKVrcW9K+lyz3cKF4nuRwTNb8AvskxP258LSLV7vEeVz+qfC17Zi0oFekxMx3QzPR+aml6i0ueI4mt48/wCWCrM8rrbr2rrsc8/9UExuFq21O30N6B1c63pXSZ+eeaR5bBDnnwPrJ1PRenx2tz2V8Ohw4t41aYesxTukShb04v8AxEbdgjT49RTHHdMeZdpn05Z8/V52ms/svhnV4aXVaxbi328x6mlYtzx92x9BaSttZOS1fH2Ym2ntnyxWI9y3rpjb40mmi33mG9lt4fOY9M1E+f7KkSpx7Tx5aaE0WlNF5SxJHmUCrW8/la62/M8LiIY7WZP+XhME+UaKuG/GSvHvlQpb8KmCZnLE/utK9PcO49A+dnxzx54bG13oGJjZccz+GxNaX0zh/wD2K/8AQANkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASZsWPLSaZKRaJjieU4DmXyH8cYt1xWy7dSK5Z8uH790pue1XvTLgvPbPvh69lYbltOh1+C+LPp6W7o98NjHyLU8S4nO6Jh5P3V8S8Y5LWp+jJHbMflYazJx94egvkH4ojVc5ttjj78Q4v1H0VuO2ZLRemS3Hvw6FM9LenkOX0vPxratXx+2uzfmvnhCLxzxMrfVYc2C3Zeto4/Kl5n7+WXbR7NL6LcT7TVsssMT95lWi0/b0ljnUSuq2TxP7rSPM+0f1c+/BCto8Lzn9zn8LTutH5Ri08ezSkV2uZn9xZ99uUYvb9zS8Qu+fCSZUO/8AT7SRktPhSYXiFzE8yutLH64WOKZ5ZCnP0+6GOZ0zVrtk8NP1cqWu1mHR45vmtER+FnTUziw2yTPqHP8AqreMufUWiLzxzxxyUjctrHxJv8s/uvWE/UnHpfssqdXamJ/U1DT5LTk7pjldVtExP6Wbtr+m5HDpHhumk6x09o4ze2Rrv2hz0iaXiHOp7e2Z7I5W+bLkiI7bTX+ys0hS/Arb1LquLV6fJHMZa/7XeLNg9/Vr/txyut1VPFc1uP7p43TWxHH17f7V7GL/AOlz/wCzrG57vpNJSb2vWbceOJc26h3L+f1s2r65Y6+r1GaP+TLNv7qcWmPsmtYht4OJGL58qsx9zjmnBMzxHEJomePS3tta7fKlNZ+6E1/ZcRE8eYJj/wBKNHco8TMQjSJiVTt/ZGI/Y0d6Ed0W57pT3tafdpS2nz6U5mfymPCPapzM/cjxPPKlzJMynaJoqzxPlLPH39KUzPg5n7yhHayewV41vcz+oibZY/LAdOcxre6fMM9qL2nN4jhSzLXwyGhrNYjluXxngm/VmjmtJtxkjnhp+2RbmJny63/Dngx36oyzlxxfifHP2YMk6iZbXHr3XiHp3TxxhxeOP0wqkRxx4HNemgQt4jlEn0DhX8WmyafVdJxrIrEZa+5eNtLWfpWjn1L3588bJfeuitRirz+isz4eB9w01tu1ufSczPbeXR4k7q4XU66v3Kk05iJ5g49eVrW9vzKpN5mOIluOVstEzdGlbd/JNpiIjjyjW1osG1zH9PP3W8c2tMzKtF549LW1vMhHlWivHnnwqYrdlu6J9TC15n8p8Fv+evP9PMcoW7fl7N/hb3L+a6e+jxb9Nfu7ZH3cM/hby477VaMdIrEVdzj7uRnjWSXp+HPdhrKMuSfPeqrbS0wV98eXWrTxEz+IcV+VNVTXbt9GI57J4lXHOrbaXWssU4lv9cv2Tbe60ZLVnjnltOkiIjsisxwraXFTHSIikQrVisz4rwzXyd0vn0RMKXb59HCvwRH7KbT2qVYRT2gjjwKyp5rxTHMz74YebzkyTPP3Xm86iMePsj2xGC0xE+VqwQyNeYhX0vE5K/3Y2l559r3QTOTLWn35X0yY/Nod86JiY2PD+OPDOsR0nTs2DTR/6YZdqy+nceNYqx/gAhmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJjwxu47Ltuvpauo0uO02j3NYZIN6VtWLRqYcu6i+INo1/fkxcUt7iOHMeo/hbc8N7X0VLWiPtEPT/ABCExz9oZ6ci9flzOR0bi5vddT/jxRvHR277decWTS35j3PDETotXit2XwWj/D29rdm2zV2m2o0uO8z78MNuPQvT+rpPboqUt+eGzXm7/KHEz/xiZneO7x5bSZI4/RMf4Qtjmk8TWfD01uvxLo81ZnBatZ/DVN0+HNTMTfFf/DLXlUn5c3L0Dl0nxG3Do8+O3yjkx8Txw6hqviTdqTzSsz/hZZvjDea//o2/0yfXpPy0p6Vy6/8ACXN+IieJT1itp4iHQMnxVvdo7ow35n9lL/8ACzfq+fp3/wBJ+tT9k9M5f/pLRfpRPhLTF5nw6Hj+MN79zhvP+FWPi7ep8xhvH+GO2Wn7ZKdM5X/pLQNNgm9uOPDJYdPMYrR58N403xZvNJi3Zbj8cMnj+Ndzx4ptbHaf24YrZa/ttYul8nfmjkm/VnT7Xe0V45iXJdZecma8z65eoPkjoO229KX1eoyRjntniJeXtZHZqMlPtFpZsFotEujk404dRKGmmbW7eeF/EcU8Mbp5n6vMMlin9PE/dnUjyktH6fa3zxPELq/H28rfU/bgWiPK2shEKk15jhLxMShbSfHTujn7Ju2UuLmImOVavEx79KmkJrPjyq0p455UvH5VsfPER9kwrZPNJmCacT7VO3mPaS0T5jghRTmPKEo/3JiPfKSIST7U+fKpbhT45QvWAQg8oWP2K15k4lUx0nn0lRlOnMPOqieWf1GL/liIYjp+e3UevLYrYptkiZ8KTC8LjbMPN6x+7sX8NMRXqfVRavPjx+zk+hitL18up/w9XmOqM3ZPv21834y3OJOstXpiBD7ouc9GAAsN9wRqdn1eG1e7vxzER/h89flnasm1dX6rFeJr3XmYj/L6L3iJrNZ9Wjh4j/iy0FNH1zaY4ju8tviW1bTm9TpvHFv041E8/dVpHn2o46zPCrWIifbpPPaVJr5iSYmbI18z7VIrE+eTadFImOfKhxzMwuqRX1E+UlMFrTM15/0Jjwp0rMz2wyWy7Zk1W4YsXbMxa0fZedP9PbhuWrpj0envmtM+orMvQfxJ8OarJauu3On0ZrxMVtHDFkyxjjctrBx75Z1EN/8A4fenc+z7V9S9JrS9fDrMfdZ7Loa7dt+PS144pHHhd5LVpSbWmIiPu5V7d9pl6PFT6dIqst811dBt2TPb3FZ4cO3a/wDN7jl1Nv8ArtMt56+32meZ0+G/6Y8T5aF4mZ8kenkev8uMl4xV+Es/08QmrHHlCZiJ4Tc+OEvOa1KMIxCEJoFkswkyzFMc2n7K3EMVv2qjFi7a+5WrG2K3tiNwz/X1E+fHKXH4WtbTPNp+64xTWa+Z8s2hVr78M50vprZtfT9PMcsHj48eYdA+NtF9fcsN+OaRPlFvEN3gYZy561dc2TH9Pa8NOOOKr5LjrFaxWscREJmo+lVjUaABIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwT/YAS9sf9sHZSfdK/wCkwCXsr/2V/wBIfTpP/RT/AEnAS9lftSv+jtj/ALK/6TAJe2P+2P8ARaIiP6apifQOY/xDaOmp6MyTaJjtiZjh4N3Ks11mWtvUXl9GPk3ba7n0jrcXHMxjtMf6fPzqjbcmm3TUYrRMduSff93R4c/bLidUr90SwuCe23Me1zF5mFvjxzF+FzFP0+G5DkTBF5iEszMz5VaYomvM+zLjitYnk2Qo8+PSHE8+k8cfeYXVa4fo+bV7v7iVjak88xBESus2TFjrx48/ut/rUtPCE+UI8e1xh/oUuazHEK+Gv6eSFbeYT+YJtMprxHMcqduIlKmlO/8AVKSbI3nzKTlVkg9oSiSCCNfaCesASq4Znn7JPCfDEe5WUZLZLzXVxMy2q17TES1DbK8aiPLZvqc0rET6VsvVe4b9tuOfLpPwLrP5Tqf35vPDluG0c8zLdfiPVV0/Ven7p8WvDBlj7ZbXGtrJEvZFJ5rWfzCZSwTzixzH3rCq5b04ACFv6oeQf4yNttbqGus4ntivt6+n3Dz1/Fhtcajb/rzHHEe2bjzq8NTm17sMvIcc9kRCavH3VL4prl7I48K9dHlyWiMVJt+eHWeZ3K2r4nlNS3niGw7b0du+42pXTaXJM2/9MutdAfAW663s1G417cc+ZiYY75KVjzLNjwZMn4w4xse16zXamlcOnvk7p48Q7z0B8I6rX48WfV0nHS3EzEu29GfFXTnT+LHNdPW+WvnmeG/4sdMdIpjrFaxHERDTycqf+DrYOmxHnJ5ad0X8dbB01GPJp9NS2orHm0xz5blWsRHisV/sj9lrr9fptHji+fJERP7tSbTady6URWkePELm960pNrTxWPu0PrPqmta202nt49Two9XdVxkpbDpL/o49w59m1GTNebZJ5mUxHjbzfVus9kfTw/8A7S5898+e1rTM8ygkrH6uVSFqw8la02ncowjHJCMLKownS19p5mK15sJUtTljDSZlrO4ZZz5pnnmF7vOvjJeceOfEe2K5/LPjpryxT7SXiIhS5mJ4iVa9vcLeZ/X6WlfHPldabnJeKRz7dt+I9B26P6to8w5F0posms3Gle3x3PRnS+349BtmOtI4mYjlgy28aem6Dxptl+pPqGWCBrvYgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKWqw1z4L4bx+i8TEvJX8RHxprtv3HLuuhwWto58zNY+710tN02/S7lo76TW4a5sN44msxyy4sk452wcjBXNXtl8yrZMePUzS9MkTHieYVq5cXPit5if2e3t1+B+ktbmvljTUpa08+Kwoaf4C6XxWiZx1tEfbtbv9ujkW6Zk34eNtDotTq7RTT6fNabeuKtq2n406p3jiul0eTz+Yez+nvjfpbZsMVx7bhyWj/qmkNn0W3aHRx/+V02PF/arHbmf+sM2Ppf/tLxzsn8PfU2omP57HOOJ/s3XbP4asVqRGp1Nqy9OcW/KPn8sNuTkn5bdOn4a/G3nHN/DRttsUx/NW5+zmnyf8GazprS21elm18VY5mXtnz+Wr/J+npqeiNxrkrE8Y548evBTPeLR5Rl4WHsnUPnPes4ctsV/E1niV3prVnH5nwp9QVim96rHEerykweMTqQ83b9Lyb45+6lkmPst+79SbnkRJaJ5QisqkeiELbSdsoxSfuqR/ZU4ETKhOP8IxSY9wrIW/plKu1KOFSnbH3UjlKdLzBlrGSOJ8s9p81OyO6zV8NuMkSyuG/6Y8qytWGarqMcTzE+GZ6V3Gun6i0Nsc+ZyR/7tR75XO2an+W3fRX/AP6kefx5Umu/DJWe2dw+gfTue2o2XTZb+5xx/wCzIta+N89s/SWkyWt3c0jz/hssenIn29ZWdxAAhI0D5n6Qy9WdPzptP/5rfyf2TE6ncK2rFo1Lyxtn8POpy5qzqrTWPvLonTfwRsG3RTJnv9S8e4mHYvP5OGSc15+WCvFxV+Gv7F0jsuz0mMGjxWn8zX0z1KVpWK0rFax9ogy5MeKvdktFYYTd+ptHovFbxeY/dj8yvfJjw13adQzs8e5mFnq9z0Wm5+rmrHDnm99cZc1p/l5mkevEtY1W76vUWmb3m3P7piHG5X8gwYvFPLe9+6yis3w4P6ftaGlbjvGq1nfW+W3H28sbN7W82nlDnmVvXp5nldX5HImfOoU4+paOLzKHZNZ8eVc48mnOm0yoVrfu9J+2VRFMI2pxWefSbjwn4kjjzM+oSTOoQrHju58MJvu6RSJwY5/vKXf97ppqzhw2ibNXvntlvN7zzMsuPHvzKvdOl5TLHMzaeZlN9WvHHKxi3lHujnhn0rC7nJVU0sUyZIrHnlYzb7Ng6T0E6rU0r2TPM/hS86hscfHOS8Vh0L4s2Sbayue9P0x5dhrEVjtj1DC9JbZTQbZjia8WmGbaVrbl9G4HGjj4YqAKt0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABDiDiEQAAAABr3yHHPRu4x//St/7NhYjq3Q5dw6c1mjxf15McxCa+1L+ay+cnVMRXftVEf/AMyVnS3GNl/k3a9V0/1VrNNq6T3d8zDXsGet8PPp162iXlL0tWZ2rRb9SrWVnOSInlH+ZiPC7HML+spq++FrXPHESq11FU6lWbQuawioxqaI/XpynSs2hVQv4rKnOeiS+pp2zCNI7oQ5QmVL69EJz1GTa4x/1wyWC36WGx6ivcvMGrrHgO6IZSs8quOO7X6SIjmfqR/7rHHqscR5bR8f7Tm6j3rDi0lfOO0TNmO09sbXpMWnT2n8Tc//AATpOY4/RH/s2+PTSelNy02x7Dg0OptE3pWInhfZOtdrp75cmY3L00cnFSsd1obQNM1PXugivGGkzLF6nrjNbn6UeJRqWDJ1TjU92dEvlx1/qvWP8rfNuOkxc92avP45co1/U+tzW5i1ohjdRuOpzT3xltz/AHO1oZOv4YnVI26tq+p9FgnzMT/lgdy6yibcYJ4c+yZs2TzbJMyozGTnmJW05mfr2W0fb4bFunVWtz80+pMw13U6nNmvN7ZJmZ+yT6VovNpn2jbF4/T7Plxs/JyZvzttRnm0xyrRHHCWcV588p+Y44TENO0R8I+EPc+kJ8o8mkIx7RiUvdHPpNHCUo/YJ8V5n0x+4btpdHjm17xMx9loiZ9G4Xuoz0w0m2S0RENV33qL+rFprftzDBb31Dm1mWa47TGNisV4teZmZlsVxTHmUrq2XJmyTfJMzMq9L8LWlo49KsXjhl7VZXFbfdNE8z5Wv8xTH4n2qUzVtPgmEREshpsU5bREff07T8SdNTGnrq9Tj4j3HMNG+M+msu8a3He+OYxVnmXojQaTFo9NTBhrFa1jjw1M9/h67oPTv/zXj/pXrWK1iseo9Ig1nrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEl8uPHx33iOQTizzblo8XPfmrH+Vjq+pNuw45muatpGO2Wlfcs0TP78NM1PWuOkTOOtbQw269b571/469v9hqZOo4MfuXSpvWI5m0RC3vr9LWZictfH7uP6jqvX5YmK5LRz+7D63etwjzOa3n91ortzc3X8VPxrt2zU9Qbbg5781f8AbC67rPT4+fpWrLjWp3HV5/68tv8AalTNmmPN7T/leKQ5eb+SZZnVK6dWy9d5ef0RHCnbr+9Y9Ry5vhteY45lNXHNrcTJ2Q16/wAh5LTfmzpm/U+svuWDHE5b+Z4cE3Xpjd9BqZwfy9+I/EPXGLBMxEW8whk2fQZpmcukpa35mGauaa/DHHUrXtNrPHtdn3SZ4/lsvP8A8sq+Lpzdrz402T/6Zeu8exbTH/7Bj5/+VdYdn2uv/wCw4/8A6Vv7c/pM8+Z+HkfD0pvd+Irp8n+l7g6K37JPEae/+nrWu27dEc10eOOP/SqV0mij+nS0j/Cf7tv0w25dp9PKWL4/6gtXn6Fv9E/H/UHv6U/6esPo6WI8YK/6W9sGn5mfo1/0f3L/AKVjk2+XlDN0Nv8AWP8Aybf6WebpDe6RPOC/+nre2m0tvenr/pTtotDb3paf6I5lv0mOXb9PH+TpneaT+rT5P9KNtj3SP/2fJ/8AS9gX2vbp96PHP+FK2zbXb/8AYsf/ANKf7U/pk/vT+nkTHs+4Rf8AVp8n+l1h2nXzbxp8n+nq/wD8A2mf/wBix/8A0pq7HtWP1osf/wBK39rXwpbmTPw84bF0Tum45aROO1aTPnmHcfj3pvT9K6bvxRE57x5lsWPQ6fD/AOThrT+0J7Y548sN8038MFuReU2XWZsnPfaZUL5OfdeS2OfUJbY5hi9MM2mfclLeJ+yetp/KjMT9iO5CIVpn90a+vChzZVrM9oJ/EoT4QjlHiZAmT7eTiTgRKH91KZ8qsx4UJ8zKYUlOhMpZniP6ohZa3dtFoomc2SvMfblPtC/8RPM+FHV67T6THN8uSvEfu0veutO6Zppq8x+Wq67dNXrLza+W3E/blmphmfZMTDcd96tmYnHpJ/ZqWq1ufV3m2W8/2WVbz91StobNccV9EKtY5V8Efq4W1b8K2C/6lxd+kZmfsoxfz5JvMxzAlNb9Voj7tm6G6d1W7blSlcczXmPsp9GdPajd9TWv07eZ8eHpDoLpTTbDoK2nHE5rRHPMemrmyxX073SumW5FotaPC/6Q2HDs230x1pEZOPLOwQNGZ29vSkUrFa+gBC4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKeXNixRzkvFePzLCbl1RoNL3Vi8WtH7piNsWXNTFG7zpnb3rSvdeYiPyx+u3nQ6XFN7Z68x9uXON/6v1Ge1q4skxT7eWo67ctXqMs92W3H45W7J+XB5f8hx4/GONy6RvXXOKs9mnmP7xLX8nVOs1eeKTeY59eWnUra0+Z5lldswTOSLTHpMxEQ4tur8rPePOoZvPbU6iZ7s8/7WmTQ3vH/mz/tc1pPd4lUy2rir3XmIj7sTat3WndpY7FtsxPbOSZhVrtlI8zbljd76w2TaqTfJqsc2j7dzCaL5U2LPl7LXrXzxzyt9O8+Yhgvjn4htN9qpM+J9rTU7LFp83ZLa912/c9PGXSammTmPUSuL05REzEtS9dzprObZZpEzHlY5NJkxW8x4bfNfstdTp63jzC3fLXth16YfRabnHP5XsaOlcfda3CtpcE058eGK+QNf/wCFdO58vfxftntO6ZmIhjjB5UtRv2y6PN9DLraxf8dy/wBFvm06jjHh1VLXn93k/edy1mq1uTUznvzNp48pNHve76W8Xwam8Wj92/8A1Pt9t3+j/wCsvY0xFY7o4mJQ+pEx6cA6O+UNbpL0w7la2WPXMuvbB1Rte8Yq2rqKY7z/ANPLWvhtT21cmO+P22KdTHbxFUP5iOPShfiaxNPMflQvf7fdj8MczK6yaqI+y1ya7meIqpTbxMTKhP5TrSImVzbWz/2pP52ZnzChNeUK0nuiDSfK6nW+f6SNbH/apzh/Y+gnUJ1KtXWRE89qM6uLT6W9sUxHpLFZgTEbXf8AMRPjhH6ke5haxEprT4INQrTkiUto5UImefaPdb8pRMQmyTFYSc8pckzMflJFp+yFfStFYn7qtKxFeFtF+PNp4Tfzelpj5vmrH+TSJnS5mIlNFIYvLvm3YuYnU0/2stR1ht2GJit62n+6YpafUI7obDNY+yE1j78Q0vV9d6WtZ+nXywG4daarUTNcEzVlrx7z8MU5Yh0jVa3S6eP+XJEf5YDdOqtv0vP0clck/wB3PNRr9fqpn6ueeP7rC1ObTzM8/wB2xTiR8yxTm36bJu/V2p1UzXBM0j8w17UarU6iec2Wbf5Sdv4O3y2IxVr6g+rMpYrEeeEfvyn4Q4NL90yd37JomUkwjzMQrMMlfSpFk9Mk1nnhSnxXldbfpsurv2Y4m0/tCFojfpNivOSeOPP4bf0T0hrt71lKxit2TMc+GW6B+Otbuurply4rUx8+5h6G6U6c0ux6SuPHSs5Ij+rhrZc8V8Q73S+jXzT35fFVn0f0jotk0mLjHE5axHM8Np4IGhM7e1pjrSvbWPAAhcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEL3rSs2tMREflrW/8AVmg0GK1aZInJ/cY8uamKO686hntXq8OmpN8l48NS3/rTDp57NPbzHtz/AKh6z1GoyWrS88NW1W4ZdRfvvaWWuOXmOb/IYjdcTct46w1Wr7orkmP7S1XPr9Rmzd1r28/usYt57o+6aZ7vHpkikw85yObkzzu0q9tRa14ibLiI9TLH9sd0T+F5TJzxEE1mGrH3TteaWs2yRENp2zT9uOPEMPsWm+tmrz6bjTSRjwx/ZhvMQ6/B4trzuFnGKI5mfs5V8r9af+HVyaLS3/5eOJ4dI6r19dr2XUZ7TxMVnh5K6w3bLuW7ZtRa/MTaYZuJii9u63p18tPpxqWG3vX6vXai18+fJMzPrlY1pbs/8y8f5TzMTl7rK0RW1XWnWvDVi0wzXSXWm6dOZ6xhz3th58xMu99F/Kmzbvp8WDPkrjzzHEzLzDnxU9Stv+TBeL4MlqWj8NXLxqZPPyXrF3ufDfFqcUZdPkjLWfPNUL4rfeOIeVujflPfdixU003tkxR955dX2D5j23U46xrp4tPtzsnGvT1G2H+tZ1OmKZjiIcm/iO3CdJt+PTxMx3w2jJ8odN4sE3jJHPHPtwn5g6xjqrcYjHP/ABUn9KeNitOSJmPEJpg17aJa8zWf7p8N+IUuK+k9IrDsb2y9q/w0i0xPjlk9Bqdbo81cunzXi0euJYbT5axb3LMafLjmsefKPDFekzDfOm/kXctHMU3C3fRv+0db7TuNax3RS0/lwyMdL+Z8pLVvW8fTvan9mC+HHb/GL+pv3D0rjzaXNXuxaqk8/umpXun9P6v7POuk3vcNFaIpqMk8fu2HbPkXdtNMRbzEflrWwTHpjng2+HbIxWj/AKZT0x/qiJhz/ZPkjFmmP5zw2/besenM9YtfJ5j3zLBNbV9wmODkZmMaaMaXTdQdP54/RnpH/wC8uabhs9vWox//AFQjaP6tlvbH4U5xQv8AJqtqindXU4+P/mhRrqNBeP058fP2/VCJsrPHtCznH+FHPMYsdr2jxEcsnNMc+a2iY/ZStpqZ8eTFb1aODuhScMw1PU9U7bhvNL2iLR4WWbrfa8cT+qJaP8ibJm0W8XtjtMY5lqk6eef1XmW/TBS0ba99VnTp+q+QtHHMY68wxuf5AmYn6UcNFx4axzHHKb6dPXbDNHGp+mGclYbHrOtdyzc/TtxDG5d93TPE92W3E/ux8Y6pq/p8Qy1xVj1DHOT9Kv1c+T/zMt/9kVmJ577T/eVPuTRaV+1htMyn4888yqUvMfZR+pJF558MmmKYXU57QfUiVtNpiefumrMz5QiKrjvRi8cqHM8fuTa8eYQntmF1MwcraMl+fKrEZLx/xxzLHplidzpU+/CHH64iI55Znp3pvct01FaUwXnn78OxdF/D+PPkx59yrxSOJmGHJkrT3LocTg8jk27aV/8AlyLpvpncN71NcWHT37ZmPPDu/wAf/FGHbopqNbEWmY54l0jp7pva9kwRi0enrH78eWYiHPy8ibeIey4HQ8XHjuyebLfb9Fp9Dp4wafHWtI/ELmAa7uRER4gAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACjqtRi0+Ob5bxWI/KjuG4afR4LZL3jmPty5T1z1blz2nHhydtfxEpiNtHm87HxKbt7ZrrPq+Ii2DT34iPvE+3Kd43DNq9RNrXn3+VprtblzZJm159/lRr+rzzy2aViHg+f1DLyreZ8IzEz5mZk8oTPHkiefPK7naVqWVYnlQrykzavBp45y3iv+Vojaq8rHK4x5cWKnde0NV1vU+HHPZh4v9mL1e7arPX9PMcrfSvK9bRX27T0Zlpqb80nnhu2TH3YZr+HOPhmZyaO1rTzZ0viYpMz4ho5o7b6ev6XH/jif25B/EZrr7f09WmO3Hf4l5iyVnJprZZnzM8vQ38UnfbbMXbPMcvONL2+lNZn/AA6PErEY2Tn/AP3NQozPE/sucX9HMrO8zX+yrizxFJ5ltS048qmaJ7eeFvNfHPCa+oia8Kf1Y44QmIJiIjxHKSt7V81jgtePSXu8IX3K5nPmyU7ZtPH90k8cRE+1PDb2m5CZR4+6esTNfSTmeE1bTFOORBMzEqlNRkrwpzCfjmI8+UIZbbtfMTEZY8Mh/MYcs/pmIaza8zERHjhJGfLSf02nhWYZY1psOX+rxxKSJ88ywMa7NTJ3TaZXWLdq+ItCJiUTDNYr82iKwu8WXJXmK2mP8sTpNbgtbmLRyyGLNjiJt3+VdI8wvcObV1mbRqb1/blWpqdy8zTXZP8A6mOjLFvMSnjLaPUo7Edyvn3LdYxzxrsn9u5T0m/btgvF51uSePt3LXLkmfus75PMp7IO51/4/wCt8upyU02pvzM+OZl1HHnicdb0nxMPL3TWoti3bFakz7h6O2TJbLtOC/8A6WjyMcVnw1c8REbhgvlHQRn2r+YpXm8e3HckeZj8O99VUi+xZe7if0uC5/Goyx+7b4c7ppx+R7iUtPUpvCSnKeG7DUtPlGILRxKpWEt4nlMKqaaCKz+EYjlIceUOP1eE0zPpGkT3cxCVe0/Vz5gqrVpbjmVKIrfJGPu9zwiZTFSJT6TFlz564qUvPM/aHTPj34w1W+9mfJWfozx+rh27pj4p2Laq1tmw0y3j7zDVyculPHt2+H0DkcmO6fEPOe09EbrumSlMGnv5/Z1non4bit633Pmsccu07ftG36HiNNpqUmPvEL/+7Sycu1vx8PRcP+O4MPm/3SwPT/S+17NgjHg09LT/AN018s7WsVjisREfsiNWZmfMu/THWkarGgBC4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAx2/bni27Q3y3vEW48RyuNw1ePR6a2bJPERDinyH1RfVai9aZPEeOIlele6XO6hzq8THv5Y/rTqjWZNXauLPPZP25aZqNfnz27r2mVDV6m+bLNrTzyoxLbisRD5/yeTfPebWlcxebe5Va3mKxwtaTyrd0Up3XmIiExDU2uKTNvalq9Zp9JSb5LxHH25YPd+ocOnrNMM82alrtdqddkm2S88M1MW/aYiZbLr+rI7pphrMfiWG1G5ZtXM/UtPDFRXiU/fPPENqtYj0rX7V3XJSto4iWQxamJr4jywkZJ545XGDN2xzPtF9rT5dq+Htb2Y7Yu7i0up4L5cmqpS880n285fHe+Tp91pW1u2sy9F7PmpqsWLLjmJ5iHL5dNW29b0a8Xpr9NZ/iI6LvvPSn8xoa82xVmZiIeItyxanSa3Jp8vNLVtMTEvp1jwYtTt30c1YvS9eLRLzx85fAuPdL33Pp6kUyT+q1YW42eK/bZ2OdxLX++jyTjm0x+qVSIjhtu6fGfVG25LVvoct+38RLF26Y32luLbbnif/lb8zHuJcf6dq+Jhh5pWYQmsRDK5ti3jHXzt+f/AOlZ6jQ66lf+TR5a/wB4I8omJ/S2iK/jlP8ATrP2RxUmvi9OJ/dXtSZp3RExCVdpMWOlaz45RtSsRHhUx47RXz6lHJHjxCYRtR7a/hGa1/CbtmOEZiYSeUnEfhCeITSltAKNp8yh7RtHlBCyW1YSzjpzzwnT1pMoNylwcVt+mJXlM14rPvwt8dZiypE2jk0naP8AOZaz4mV1pNXlyW4mZWExPP2Xu3YrWvHbBpDIc2iI5iU3ZSY5mFbNSYpHhb5LcRx91JhWZZfpXS1zbnTtrzxLt+lyZtNoMNazxHHpoPxJ01qdbljVVxzNY8upbntGsnHWuHFabVj1ENTLMTMQryKXnHuIa31Vul67dOKb88w5XqaROa1vzLpHUGwbzmia00mS3+Go6rpHqCtptGgyz/iWXFEV+XEvTLafxlrmaJrPifCHf688Nl0/Q/UWsrNq6HJXj8wy20/FfUWsvWLaeaR/ZsTetY8ymvEz31qjRubzxMWVObcc29O4bR8D6+cdcufJERMeYcq+Ytrp0nuM6Ct4nt/Clc9ZtqJbU9I5ERu1dMFOalfdohTvrdNSOZvHLStXu2fJb9NvC0tqctvdp8s3eivTte245t6wY7TxMSs9T1NSsTGOs8tWmZn3aUPH38qzeW3Tg4q+4ZbPv+uyc/TvMQ2D4q0e4b91NhwXvN6d8ctLxV77dtfcvR/8J3SV7bxG4Z8Mzi98zH7MOS/bWZb/ABuLjteIir1D0RtNdn2HT6etYieyJnx+zOxEQhSIrHbHqI8JnJmdvVVrFY1AAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEuS9cdJvaeKxHlM1H5E33Htm22rS8ReYmJjlMRudMWbLXFSb29Q1f5N6q5pbS6e/6I/DjW46m+XLN7WmeV5vO531WovabTMTLHRes+45btMeofN+oc63KyzafSlH5PKa3meIjiC16YqTa8xEMna0O6EmTJXFSbWmIa1vm8Zskzhx24r+ynv+53zZZx4p4iPww1rTPv22MeLXmUxMITzPm08zKPn7JZlHuZtJ7tnmbFo4nwhyhE+zuO1C37SmxTb3HlCuObTxHLLbds+p1Fqzgx3tP4iFLWhMUmfEKO35LYdVXJXmOPLtnxf1dN8H8plt+rxFeWmbJ0Nuev7a00ton+zoHSXxbumk12HU5azSKzEzDXzWx2jUu30zj8ml4tWsu57De19rxXt7mOV9MRMefMfhbbXgnT6DFht7rHC6cufb3lN6ja1yaHSZJ/XpMdv7wtcmwbNk8227BzP/pZQNynUMHl6U2DJ/Vt2D/6YYXePjPpbcomMuhpXn8RDdjiCLTHyrOOs+4cK60+Athz6HJm2unbmrHMR4eXestoz7DumTRZ8VqzSePMPotaI9ceJ9vJX8XGm0eDf62xYa0tavM8Q3ONltNtS5nP4uOKd1Y04DTJ9SJ4J8xx94S6OYjHeYhNa08OhDhRKSY8eUszPr7Kk2nj0pW9p0RKNomY8elOyPM/lA0so28zJ2yrR79JuJ58whK2iPKvijnzKaa+fUIRzz4Dek/bMefylyRMY5lNFrc+UL2nifHg0bUcMTMth2bBHZ3ceWE09on7M/s9orSZmUEK2o5ixsu333DeMOmrHdN7R6UNyzTOGZ9Ty6x/Dj0tTdt4x6nNHdWs88zHpjvaKxMrYsU5ckVh3/4l6N0+0dPYLZscd9qw3XBtGixZbZIxVmZ+0rvS4a4MFMFf6aRxCq5E2mZ29VTHWtYiIW38jpI9abH/AKJ0Wkn3pcf+lyI2t2x+lvXR6Wv9Omxx/hPTDip/TirH+FUt6kTqIWO86qmh23UajLfsrWkzHl8/PnffLbz1nqLVyTalbTHP+XsP+IjdbbZ0XktXL9PviY9vBu6Z/wCZ1uXJae6bW55bnFr8uV1HL5irE/dU4+y4jHE/9KaMf7Q3nInUrXieEKxPrhd0jm/b28r6mj5pEzXgRtQ6e0OXW7xg0+OszN7cPoH8K9OW6f6R0+LNjrGTJWLcvL38PfRk771Vitkx8Y8c93dw9s6TDXBpsWCs+MdYiGjyr+e12enYfHfKtHoBpuqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASClqctcOC+W3qseXA/lXeo1uvvXFfmvPrl0r5V33/wAJ2q2OtuLZKvOep3DJrNVktbnzM+21x8e/ueT/AJHzu2IwR8qWa6Stpn7+UJ8mPiZbeni58qtZmI5mfDAb/r7ZOcWOeIjwym6amuHTTSs/qlrGaL2mbzPPLPSnytWImPK0tTjzNvKSYVLVmZ9KdomJ4ZRLxzPpGKTzwqVrMxyu9JpcufJFKY5nn9kTK9azadQsOy3meJlkti2PW7rnjHgwWmZn8OlfH/xlrt61GPJqcFsOLx5tHuHoHpfofZNk0+OuPS0tlrHm3DUy8mtPEO/wehZORq1/FXCOkPhrcNVkxZNXjnHT3PMO3dM/Hmy7PWszp6ZbRH3huVaxWOK1iIj8QmaGTPe/t6ri9L4/Gj7Y3K00u3aLTW5waelJ/aF35/IMLoxER6ABIAAACXJaK0taf+mOXjX+K3cq7h1JaKW47fHD2Du2WMO26nLPqtJl4K+Z9yrq+p9TNrd3F5iP9tri1+7bndSvrHppGhr/AMdkcvPPhSwZK1raO7jlN9SJ8d0OpX089PtPxPiYlJfxKNMlOeO6EuSY7v6kohKQm/TMc8pYnz7QsmrSff5VOyUMfPEfhVmP3QlTtSefaFacW4lUn0lrPM8zIiUsx+pJeJ8wrWr555U8k8VmRCnT9H3ZLQZZ7OOeGKraJnzPtkdLNK04i3Kq0Qv8eOdRauP3zPD15/DR0/8A+G9NzqMuLi1v6ZmHlLo7TX1286fDjjvn6keI/u96dEaKu39NaLDFYrP068/6afKtqunV6bjibzZm49cokDQdsAAJ98Chrc9dPpMme08RSsyDzb/F91HFdHXa638x9uXk/DH6eZ8zLqf8R2+X3frDNFbzalbceHLsMfodXBXVIeb5mTvyyqRxCMTESceOUI9s0tPSSl4rmmWZ23v12XHp8Uc3tPEcMHb+qXXf4dOj8u/dRYc2XDM48VotMzHhW9orG18VJyXisPSP8OfSUbJ0ti1uenGoyR948utwt9BpcWk0uPBhrFaUrxxC4ci1ptO5eqx0ilYrAAquAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIXniszP2hFi+qNV/KbLnzc8cVnymI3Kt7RWszLgvzl1DfNuttL389kzEOZ6LPa1rc+1511rLa3es2S9uf1SxW2cTafw6uOsViIfLufybcjNa0snXJPb5S2ydtJnkrEz/AGWu7zXHh4ieJZ4hz4rMsXr9RfJlmOfChzzHCnP6rczKeK90ssR4XhCY58Qs8/6bzMsjXFFZ5TaDa82u18Y8de7unjhW0s+KszPhJ07oc256iuHHjm0zPHh6K+L/AIww48OPV7lijt9xEwr/AA58c6fQ6THr9dijvnzES7FipXHSKUjtrHiIhzeRydz21e16T0iMdYyZY8qel0+HT4a4cOOtKViIjiOFYGi9HEaABIhz+0sb1Bveg2TRX1WvzVpSsc+ZcG6r/iIwaLdp0230rfHzxEr0x2v6YsmamP8AKXoyJ/Yca+OPmrb9/wBXGm19q4r28R9nYdPmx58VcuK8WpaOYmEWrNZ1KceWuSN1lUAVZAAFvuGnjVaLNp7eslZh4a/iB6K12x9RZ9ROK84b257vt7e7Wu9bdI7T1Xt1tJuGGs8x4t92bDl+nZqcvjfXpqPb5sZZ8x+yMT45h375N+AN70OfNqNmxxk0sczxHvhxrdOlt82zLOPUaLLHbPvsl1KZK2jxLz2TjZMXiYYmPyTz788Ly+h1NKRzhvWf3hTyROOnZeIif7snhh/7UImYTVnlCLd89sccpprxPCJWiVzjm36YhPPdFvaljt2xEI982slj2nvMz7U45mUfE24QifPgE8RPPPKjnmeJhWrzafannp4mYD5WVuZ8yucFprHdM/Zb249K2mrNvHPhjlmiXXP4b9t/n+tsU9vdMTz5e4cFPp4aY+I/TEQ8o/wkbZMb3/OTXmIrPn/D1jH9UuZyJ3d6HgV1i2iAwN0AAlp3yzvmDZektXbLbtvkpMU/03C3Hp5y/iz6jpGkx7bgv+qszzEMuGnfeIYOTk+njmzy51NuF9bu2oyWnmZvM8yxVbTxwraqkzmta3uZ5UI4h1408paZt5VopM14S5otxFVXTzNrQucumjtiY9ylEQpbHoL7juOLT46zMzaHuP8Ah+6N/wDh7YMeqyY4i+WnPry4j/Dr8cZd13DDumbF/wAOOYmeXr/R4Mem02PBijilK8RDncrJue2Hc6bxtR9SytEANN1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABoXzDu+PQ7BfTzbtteG+y4N/EduVYvTDzxxDLhr3XiHO6pl+lxbS4pu2eMmotfnnmZS7dl/XMeoljdVmtxH4lPtd57+OeYdft8vmlqRETLZ6TEY+Zn0wO7Z5yZPHpktRn7NPxzx4a/qc3OSeJ8LRDHX0l7o7uJ8LnF29vPLG5bTGTxK70lptXtlfZvUr/FSbxzWvLsnwp0Hn1efHuetxTXBHmvMe2o/FPS+Tfd2wxNJnFWYm8cPVW1aHDt+gxaPBSK48deIiGhy83b9sPWdA6b9T/z39fC4w4qYsdceOsVrXxEQnBzXtAABYb1umj2jQX1uuzVxYaRzzK9yWitLXn1WOZeav4kOvJz0ybTp8vGKPFoiWTHSb20w580YqTaWg/OnyPrN83PNptBqLTpa2mIiLe4cXyVy5rza3PdM++VTVau9slpi0zHKGGbWnnudemOKRqHl8ua2W0zKvtm46zbtXjthyWraJj9US9bfw+/JMa7TYtp1meL5OIiJtLyFkra1+Yn0zPS+86vaNdTU6TNOO9Z58SplwxeNMvE5M4Lf4+kETE/eJ5RcN+E/l/TbzixbRu2WK6iI4+pa3t2/DkpkxxfHaLUmPExLlXpNJ1L0uLLXJXuqnS5MlMeO172iK1jmZlGZ+0T5cu+e+ta9N9P5MGDL25slZjxKtazadQte8Ujctj1nyJ0hpNZOlz7thrlieJjubDtW56HdNLXU6HUY8uOfUxL5r79umq1e5ZdbbNaclrTPPc2v49+VOp+ndRirXcMk6Wto5x90+m1PFnXiXPp1CJtqYfQi9K5KzS8Ras+4mGF3XpTYtzxWpqNuwTM/9XZDXvin5G2zrPa8dq5a01URETTu8y339p9tWYmsuhE1vG3Ld3+Fem9daZrEY+fxDUd8/hs2TVUnJg1doyfaHoDiDtiPS8Zbx6litxsVvdXjXqn+Hndtvi2TQRbLWHK+oOjd72jNNNVpctYif+19HpjmJieJiWE3bpbYd0if5zb8WSZ+81hnpy7R+Xlp5em47fj4fOr6FMdI+pFqzHvmEONLzzF/L2D1t8A7PusZsuh7cFpiZrWIcG6w+EOo9ntkvp9Nky46z7is+m3j5FL+HLzcDLi863Dmk20/M/q8qVeOfCbcds1u36icOp016WifPMKeO/8A08eWdoz4nyrxFY88+UmWYmsoxH5gtHNZjhG5TCytj58q+jpzk7fypz3RPDJdO6S2r3PHjmJjunhE+mSPb1x/Cbs/8v03OttHmfU/4d3j3y578E7Vfa+isWG0cd3mP9Q6FHqHIyzu8y9Vx69uKsADGzAEzwC23LU49HosupyTEVpWZ8vDfzhv1t66w1M0t3Ui88ef3epfnfqbHsfSmfT93GXNSYr5eIdx1N9Rrb5b2mbXtPMt7h08zZyOp5dRFIYzV4rzkmZjws5xzMsjqb2tM054Wc80ifPMt/WnCiFXRViJjvnhufRnT9993bT6bHSbVm0emm7djyarUUxVrMzaeHrv+HL47nSaHHu+vx8W8TSJj2xZ8kUrtt8XBOXJEOq/GvTeDpzp3Bp8URFprHd4bVHhLSIrERWOIj1CZyJnb1FaxWNQAISAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhaeKzP4eYf4gtR9fd+2Z9S9N5f/AC7/ANnlP5myRbfctMnvu8NriR9+3B/kNtcbX7c61Nazp48Ke014zT+FTW8/S49Qk2nnunz4dWHhbx9krjdM88cMZe1ZiJ4Xm4xzdYWrMzxHpZr19KWS3/JyyOx475tZSkRM8z6WF4iLw3r4u2r+b3nBaa91e6PCl7dsbZsGGcuWKx8vRHwn05Xa9ojV2pEWy1+8OjwsNiwVwbTgxVjtitY8L9w72m1pmX1Li4a4MVaV+ABVsBPoJ9A1v5D3f/wfp7Nnj3asw8PfIm45Nw3LPlteZ7rS9q/LG159z6U1GPTxzateXhnqnFk0euz4tRExaLcN/hxHmXF6pa24j4alMcWnmVxpuPUfdR1PFb8x90tL8VmY9uhMuLEMlMViJ49qWKvbk5mVtTLe3ufCa+Wfsjwnyy+1blm23WxqcGS1bRPMcS7l8ZfOuq26aafdbWy4o8Ry864+68xwrTN4jxPEww5aRfxLb4+a+L1L23uXzdsNdqtnwcfVmv6Y59PM/wAw9d5upc9r3yTxM+I5c7yazWeIjLPbH25WusnLn45nlix4K0nbPn5l8kaW+XJ9TniDBERHvymjFaEPo2ln01Nto6K6x3HpjecOo0Oa9Yi0cxE+Htn4k+TNu6r2vDTNmpj1cViLRM+5eA8OOaz3W9x6bL0P1Lrdg3SmqrmtWtZieIlr5sPe3OLy5x21Pp9H4mJiJieY/KLknw/8qbd1Fo8em1mopTNEREd0usY8lb1i1LReJ+8Ofas1nUu7S8XjcJwFV0OIU82DFmpamXHS1ZjiYmFUBonVXxf0xveDJE6HFTPb/riHDOt/4ddXgrk1e25otHuKw9XITWOOJ8/3ZaZr09S1svExZfyh88936B6i2nPamo0WWaxPvtYbNtesxxeLYbVmPzD6Kbpsu3blj7NXpcdo/PbDWNX8X9J6i02yaOvn3xDZrzP3DnX6Tr8JeCtHs+46zNXFp8F7XmftDu3wl8R67V6/DrdywWxUpPd+qHoLaPjPpTbNRGfTaOvdE8+YbjgwYsFIx4cdaViPHEcK5OVNo1DNg6dWk7vO1PbtJi0Wkx6bDWK0pHHhcg03UAAEmW9cdLXvMRWsc8ynab8t9QYdh6R1OfJkiuSazFU1jc6VtbtiZl5y/ij6xjcN5jRYcnNMMzHifbg31+/LyuOqN2z7tvep1Ge82ra8zX/bHYslYv5+zsYqRSNPL8jJOW8yyGWK248eVpeszkmsRzKr9evHM+m4fG/RO5dU7rhtpcfOLujuleZ1G2CtJmdQ3H+Hn431O+btTW6rDMaetu7mY8PZm26PFodFi0uGsVpjrERwwvx905h6b6ewaHHjrW8V/VMR92yR4hyM2Wclnp+Lx4w018gDE2gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFPN/5V/wCzyX8z27eoMvd77nrXL/5d4/Z5N+b8Mx1Fe3/qbnD/ADef/kMT/Xhzjcb3+lHvhT2qf1eJXO5z/wDlq8x9lrtNe2bTMupp4fJ+EwuNdPnysLWjleau3PlaWiPwlrV9KWSszMdrtn8OugnLuuLNavMVlxekTbJEccczw9O/w3bTGPbJ1Mxy1OVbtpLudDxfU5Vf8dprERxERxHCYj8jkvooAAACnnxVzYr4rxzW8cS89/NHw5fX5Mut2nHExP6p/u9EJb1i0TW0RNfxK9LzSdww5sNctdWfN7qfpTeNn1F6ajS5eKzxz2ywVMGTujupav8Afw+j+/dH7FvOOa6rQ4uZ+/ZDl3WXwJs+s0uXJt8xTLPqsQ36cys+LQ42Xpd481nbxpjw82tEz/8AdGcMRXnl1LrL4a6l2SuTPj0174q8+YhzTV6XNo8lqaitq3ieJiWeL1t5iWlfHek6tC3pbsnhNFo7bTMqP1azPCWbcwurCMzE/dGsR9pU4VKCEZEZAJjlPjpXjzPtJJzMz/YmEb0yu26zW6DLTNo9RfFas8/pl2r43+e9w2q+Lb9z5yYo4ibW5cMwZYiIiUus7cluaV8/ljvjrb8mzh5F8c+JfQro3rvYepsNLaHVY/qTHM1mW1RaJjmJif7PnF0r1Hu2xaqubS6rJjrE+otLv/QXz3n0+DHpdxxxk54jvtLRycaY/F18PPpbxbw9PjUem+vun940uLJTW465Lx5ry2vFkplpF8dq2rMeJiWtNZj23q3i3qU4cwIWDiAA4gAAAAAEt7RWs2meIjy8kfxadbRqdw/8L0mafp18WiJejvk/qXB010xqNXlvFbTXiPL5+de7vk3zf9RqrWm1bXmY8trjU3Pc5nUc8Vr2R8sDjtMzMzKeJ4nlTrE18J9PTJmzVxUrM2tPHh0HFn14X+1aPPuWqppcFJte0xEcPb38OHRn/wAP9J4tTrMXGqvHPmHNP4bfib6sY963TFMUrxandHt6kwYceHHXHjrFaVjiIiGlyc+/tq7HA4nbH1L+08Ig0nVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQtXmsx+XmH560dtPv36vMWnnl6fl57/AIlNPOLW48vHPdDZ4k6yOL12kW4sz+nCt3jjH5txCy263Ez+rmE29WvMVmf6Vpt8z3Tx6diIeAyTussnl4t5W005n3wr2j9Kjef1eYGvHpPpaRbV0r7iZetfgLTW0/Tc8zzFuJh5K0nP87imPEd0PYXwlx/8MUmPxDR5n4vTfxqsTyJn/G/V9IoV9IuY92AAAAAAIccekQFDV6bDqsNsWpx1yY59xMPP3zj8G6fdcebd9omMNqx3TSIeiFnutYnbtTFo5iaTzyvS80ncMWbFXLXVnzQ3Pa8+27pk0eaOLUnifClGGO7zPMN4+Xow06s1UY+Oe+fX92mxERSZl1q2mYeZvTstMJPoxPnlCtIieOU1bRMcQjERz4hdST6cflNGL90eP0/umj+lKu1OacT7QrWI58J7JRSZ8oR4nlWrj7698X4UZTcz28QJiVf6XMRHcucOO0ePqf28rDvmvtUpqeJV0ttnNu3zcNpyxfBqLxMeuJdW6E+edy22cWDcJtlx18eZcRrlpe8d0oZuyL8VmFLUraNSz4s98fmsvcnSPzF05vU1rlz009rR/wBVodE0Gt0utwxl0mamWk/es8vmxp9Xn01u/HmyVtHriXXvhH5Y3Tadwx6TXZ73082iOLS08nF1G6uph6juYi8PaQx3T+66feNux6vT2ia2rEyyLTdSJ35ABIAAltaIjumeIj2mn00v5b6rwdLdL59Re8RkyVmK+UxG50ra0VjcvPH8WXW19RvNtjwZu7DWOJ4l5x+/mWZ613jNve9ZtZmvN7WvPEywfbbxEeXWx07a6eY5GT6uSbE985a0pWZmZ4h3H4C+JtVvu54dy1tJ+hWYmYmrC/B/x1qeqdxx5smGfp1tE8zD230jsGk6f2nFo9NjrW1axFpiPbBnzdsdse25wuJ9Se+/pe7Pt2n2zb8Wi01Irjx1iOIhekeBz3diNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE/Zx/8AiK276+1RqO3max7dglqfyhtldy6X1FOObRXmGTDbtvEtPn4vq8e1f8eKd2txWK29rXb/ABzMsh1fpb6TX5MP4meWM2zzae53Ynb5nmjtiYlkv+jn7qdvX7qkWiIU5457iWvCOn8azHFv+6Hr34NmJ6YrxPqIeQKXj+Zpb8S9Yfw854zdN28+uGlzYmaPR/xu2uVMf46jX0ihX0i5b3oAAAAAAABPpqnydvuPYel9RqbWis2rMRy2qfcPMn8WvUuuwT/4bTmMPH2/syYqd9tMPIyfTxzLzl1Zrrbj1NqNTa3MWtMsXkmZ5W05rTl+p75TWz2l14jUPL9+5mZV8Efj7rmteI8wsMWeYnle4c0ZI/V9komfCeI5jzCEeuOE8ZK/aEImsxynSsyo5PfhIq24mefuhEQKKaabREcR7TzSvHuVOa158yEShbieEmTx6VeK8cJMlax9xO1C17R5gpkt3RMoXnzMJYnj2qvC4nNMyuNmyZK7li+nPEzaOGPm3vj22j4x2XPvvUWnxUpMxGSOeP7onxErVibWiIe0/wCH6NTHSFZ1MzMzEcculV9ML0ZtWLaOn9LpcUccY47v9M249p3L1eOvbWIAFVwELT4BQ3DV4tHpMmqzTxTHEzLxt/Et8gzv2utoNNl5w0txxEu2/wAR3XGm2HYraTFmiM14mJiJeIt51uXXbjfU8za2S3pu8bHH5S5HUeRr/wAcLas++fbo3w70BrOr92x46YbfSi3M248cI/FHxruHVuux9+K9ccz5njw9pfGnRGg6Q2nHp8GKv1eP1W+7NnzxSNR7a3D4k5bd1vS66A6P27pPasel0eKsZO2O+ePu2eCBzZmZncu/WsVjUACEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC33DBXU6TLhtHMWrMLhCRExt40+bdiy6Hf8ANelJ7JtMueaKJi8w9R/xC7BGXTxqsNPMx54h5ny4Z0+pvWY4nl2ePk76w+ddX4k4M9v9VIniqXiefXhPWszSPCaPXDYcXWlC9OckT6eh/wCHLc5rSNL3+J+zz3m5i/Dp3wXun8n1Fgra/wCmZ8xy1+RXupMOl0jP9LmVl6zFPBeMmOuSs8xaFRxn06AAAAAAAACfy45/EP8AHuTqXZsmt0dJvqax/TEfs7GlvWLRMTETE+4WpaazuGPLjjJWay+Y287Trto12TS6vBek1njzDHVnmeJe9/lb4f2fqvR5Mmlw0wamYme6I9y8kde/F++dManL9XTXnDWfF+2fMOpi5Fbx/rz3J4V8XmPTQ6VmZ8LzDW0V9K2mwUrTiY/VHvwqXrMRxEM8NOfSjzxXhNWZn7eEs1mfHHlVrW0U44Soltz6iCY8eYTWmaeJjzKaInt54QQknniPCjf+v0uJ54U7ebevIaSzxKTJE88cK0xPjiE0V7pE6Y28cWnlJX3PKvqq8ZLcfZDSYcmozUxYqTa1p44iEStE7Q0WlzavVUwYaWtNp48Q9a/w1fG19sjHu2sw+LRzHdDG/wAPHxFiyVx71u+mjt91rar0zotLg0enrg02OMeOscREQ0ORn39tXb4XDmNXurViIjiI4iPSINJ1gABgOtupNH01sefcdTetZpSZrEz7ZnVZ8Wnw3zZrRWlI5mZl47/if+SL75rr7ToMlqYcUzSeJ/qZcWPvtpr8nPGGm3OPmLrTUdYb/lz0ta2O1p4rEsn8NfGev6q3LHa+G8YYmJmZj7Ml8EfFmr6s1mPU6jFauniYmbWj29ndIdMbZ03t2PS6HT1peteLWiPbay5opHbVzOPxbZ578i36D6S2/pbacWk02Kn1Ijzft8tmIGjM79u1WsVjUACEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMH1jteLdNlz4r07r9s9ryR8kdP32nXW5pxaZl7SmPHrlyP516NruOgnXaPHzkjmbcQ2uLl7LalwutcD+xj76+4eW4teteEtsnEc8+V7uOktpc1sN44ms8MflxT3d0c8OvHl4C1ZrOlWuWmSOZ/qZzpLWzo9xx5cUzFotDXor2z3T7XmgyRhvF498pmImEUt237ntroLca7j03pcnfFrxWO5sDif8PfUEZMFtJnyeZjisO1x6cLNTsvMPqHT+RHI49bwiAxN0AAAAAAAAmGK6g2Ha970ltPuOlx5KTHHmGVCJ0iYiY1Lyt8zfC1tvtk12x4ZtjtzMVrHp5/1u1bjt2oy49ZS1Jj1Ew+k2XFTLSaZKReJ+0uYfI3xHs3UODLm0uGuPVW5/s3cXLmPFnK5PTot5o8KZb5KffyjGXLMcxZvfyV8Z750vr71yYL2xxPPdETxw0LzSJ5jjjxLeraLRuHDvjtS3baE8Zbcfr8yj/MWiOFKZ59JZWQrzmmY/dLbLPHP3S1rM8TBkx2jzwJiEv17x91bDnmZ/da2jiVTT0t3cx6kEZrfNqeysczMu8fw//FeXe9fi3LV4pphxTFv1R/U598VdI6nqDqjT4a45tS145n/L3d0fsuHYtkwaHDjrWa0jumI9tPkZu2NQ6nA4kXnvt6ZHbtHg0Wkx6bT0rTHSOIiFyDnO8AAITKMtd681uu0WyZLbfSbZ7RxHCYjc6RadRtzT+JLrf+Q6fvs+0aiLa3J4nsnzDkvw18T6zqzW03Lfa2nH3d1+77t/6O+Kd23nqW299R3tfBa3dFbO87NtWj2nSRptFjilI/DZnJGOvbRo1wTmv35PX6W/THT+2dPaCmj23T0xY6xx4j2y8RwQNWZ23oiIjUAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUdXp8ep098GWsWpeOJVgJjbzb82dA227UW3DS45thtPPiHFtZ+i/bNZiY+0vd287fp9x0OTTajFXJW0TERMPLPyx0Zl2vdMl8WCYxzMzHEOpxM8THbZ4zrnS+y31sfpyvLPdliPsu9PXmk93hRnTzjyTFo88rqs+Ij7N95P5bj8f7/bZd00+WLTFYtHL1j0xvGDedrxarDaJmaxzw8RWydsR2T5h274J6zrprV27Pk57/ABETLQ5mLujuh6joHP8ApX+jb1L0KJaWi1YmJ55TOW9uAAAAAAAAAAEx/gAYnqPYNu33RX02u09LxaOO6Y8vLHzb8QW2XLk1m24ptp58+IevZWO87Zpt10N9JqscWpaOPMMuLLOOWtyONTNXU+3zY1eiyafJOO1ZrMT91v8ASmZ9w9F/O/xJqNvy31u1YpvhtzMzEennLcdPq9FqLYs1bU4n7unTLW0eHncuC2GdSuscVjiJmEmoyxW/b4Y+L3n1af8Aane9ovPMzK+2PS5vPdPK60VZyZqY49zLGRkn8sv0foNTuW+afBgra0zkj0i1lqY5tOnrb+F7piuDQf8AiGoxcXiImszDv0NZ+MttrtnR+hwTjiuT6cd3j9mzuRkt3WmXp8GP6dIgAUZgABLkx0yRxekWj90wCFaxWIiscR+IRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACWE6p6d0e+6K+HPjr9SY8W4ZsmOUxMxO4UvSt69to8PIHyf0Xqdh3W0Rjn6UzzE8NGyW7bRTjzD251X03oN/0dsWpxVm/HFbcenm/5L+ONZseotnwYbZcc+YmsOpx+VF9Vn28T1XotsMzkxx9v/wDHM7R5j7K2zbjl2zdaajHkms1nmPK21kZcN+3LSaTE+eWM1F5nJNu5tzG41LgVtNJ3Ht7G+I+ucG+bdj0mozROese5l0eJeIfj7qO+y6zHmrmmOJ8+Xq/486u03UW30ilonLEeXJ5GCaTuPT3nSOpRyKRS/wCUNwCBqu4AAAAAAAAAAAAt9dpNPrMFsGpxVyY7RxMTDhXyz8H6TdZza3bMdazPMxSId9QmP8r0vNJ3DFlw0yxq0PnX1V8d79seqyVvpMnZWf8Atlp2p0eqxZOL4bxP47X0w3bp/adzif5zSY7zPv8AS07cPh7pPV6n638pSse+OG3HL8eYcu/TJ39kvBG2bFue4ZYxYdLk5tPj9MvTv8OHxJm0eqx7vumHiK+Yi0O27P8AG3TG22rbHosc2r6nht+m0+HT4oxYcdaUj1EQx5OTNo1DY4/AjHPdbymxY646RSkRFYjxCcGq6IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtdx0On1+ntg1OOt62jjzC6BExExqXn75P+LMk5Mus0mKJxTzPEQ4F1BtGXbtVfHkpNYj8vfeTHTJWa5Kxes/aXOvkD4u2vf6ZM+GkY88x4iG9h5cx4s831DoVckzkw+3iyMlonmJmHRvi/rrWdO67HfHk/RzxMT+FTrb4t3jZtRaa4LWp9uIaPl2rW6PNHdS1eJ8xMN37MkPO0rn4eTetTD3Z0b1FpOodqx6vT5Im01juj92dh5F+KOttRsOuw48mS30uYiY+z1L05vej3rQ01GmyVmZjzHLlZsM45/x7fgc6vKp/rKhAwugAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAttZotLq69upwUyfbzXlznrT4s2/cfqajS0it5jmKxDp4tW9q+mHNx8eaNXjbyTu3xt1LoNVkth2+1scTPExDK9D7zv8A0xrIrnrkikT5rL0/akWiYtFZiftwwG9dKbXuNJ/4KUvP/VwzxyN+LQ5M9I+lbvwW1Kv0lvlN722moiO28x5hmmC6Z2CuzRauO/NZ+zOte2t+HYxd3ZHf7AEMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//Z';
  const LOGO_DARK='data:image/png;base64,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';
  window._logoLight=LOGO_LIGHT;
  window._logoDark=LOGO_DARK;
  const isDark=document.body.classList.contains('dark')||document.body.classList.contains('midnight');
  document.getElementById('topbar-logo').src=isDark?LOGO_DARK:LOGO_LIGHT;
})();


// ════════════════════════════════════════════
// PARTIELS
// ════════════════════════════════════════════

function selectPGFeel(val) {
  _pgFeel = val;
  document.querySelectorAll('.pg-feel-btn').forEach(b => {
    const active = b.dataset.val === val;
    b.style.border = active ? '2px solid currentColor' : '2px solid transparent';
    b.style.background = active ? (val==='good'?'rgba(34,197,94,.12)':val==='medium'?'rgba(245,158,11,.12)':'rgba(239,68,68,.12)') : 'var(--surf-low)';
  });
}

// Rétrocompat (plus utilisé mais gardé pour éviter les erreurs)
function _switchPartielTab(tab) {}


function _groupScore(gid) {
  const qs = partiels.filter(p => p.groupId === gid);
  if (!qs.length) return 0;
  const pts = qs.reduce((s, p) => s + (p.status === 'done' ? 2 : p.status === 'seen' ? 1 : 0), 0);
  return Math.round(pts / (qs.length * 2) * 100);
}
function partielScore() {
  if (!partiels.length) return 0;
  const pts = partiels.reduce((s, p) => s + (p.status === 'done' ? 2 : p.status === 'seen' ? 1 : 0), 0);
  return Math.round(pts / (partiels.length * 2) * 100);
}
function _pgDaysLeft(g) {
  if (!g || !g.examDate) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const ed = new Date(g.examDate); ed.setHours(0,0,0,0);
  return Math.ceil((ed - today) / 86400000);
}

function renderPartielsHomeCard() {
  try { _renderPartielsHomeCardInner(); } catch(e) { console.error('HomeCard:', e); }
}
function _renderPartielsHomeCardInner() {
  const card = document.getElementById('partiel-home-card');
  if (!card) return;
  if (!partiels.length && !partielGroups.length) { card.style.display = 'none'; return; }
  const pct = partielScore();
  const done = partiels.filter(p => p.status === 'done').length;
  const seen = partiels.filter(p => p.status === 'seen').length;
  const todo = partiels.filter(p => p.status === 'todo').length;
  // Prochain exam parmi les groupes
  const today = new Date(); today.setHours(0,0,0,0);
  const nextExam = partielGroups.filter(g=>g.examDate).map(g=>({g,d:_pgDaysLeft(g)})).filter(x=>x.d>0).sort((a,b)=>a.d-b.d)[0];
  const parts = [];
  if (done) parts.push(`<span style="color:var(--tertiary);font-weight:700">${done} maîtrisé${done>1?'s':''}</span>`);
  if (seen) parts.push(`<span style="color:var(--gold);font-weight:700">${seen} en cours</span>`);
  if (todo) parts.push(`<span style="color:var(--on-sv)">${todo} à faire</span>`);
  // ── Générer l'aperçu planning pour les 5 prochains jours ──
  const feelMap = { good: 'Bien', medium: 'Moyen', bad: 'Pas bien' };
  const todayStr = getLocalDateString(new Date());
  const matieresPourCal = partielGroups
    .filter(g => g.examDate && _pgDaysLeft(g) > 0 && partiels.filter(p => p.groupId === g.id).length > 0)
    .map(g => ({
      id: g.id,
      nom_matiere: g.name,
      date_examen: g.examDate,
      nombre_themes: partiels.filter(p => p.groupId === g.id).length,
      niveau_confiance: feelMap[g.feel] || 'Moyen',
    }));

  const palette = ['#6366f1','#f59e0b','#22c55e','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
  const matColor = {};
  matieresPourCal.forEach((m, i) => { matColor[m.nom_matiere] = palette[i % palette.length]; });

  let planningHTML = '';
  if (matieresPourCal.length > 0) {
    const cal = genererCalendrier(todayStr, matieresPourCal);
    const PREVIEW_DAYS = 5;
    const dayRows = [];
    for (let i = 0; i < PREVIEW_DAYS; i++) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + i);
      const dateStr = getLocalDateString(d);
      const taches = cal[dateStr] || [];
      const isToday = i === 0;
      const examsJ = matieresPourCal.filter(m => m.date_examen === dateStr);
      const dayLabel = isToday ? 'Auj.' : d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});

      let pills = '';
      if (examsJ.length) {
        pills = examsJ.map(m => `<span style="background:#ef444418;color:#ef4444;border-radius:99px;padding:1px 7px;font-size:10px;font-weight:800">${escapeHTML(m.nom_matiere)}</span>`).join(' ');
      } else if (!taches.length) {
        pills = `<span style="font-size:10px;color:var(--on-sv);font-style:italic">Repos</span>`;
      } else {
        const byMat = {};
        taches.forEach(t => { if (!byMat[t.matiere]) byMat[t.matiere] = 0; byMat[t.matiere]++; });
        pills = Object.entries(byMat).map(([mat, n]) => {
          const col = matColor[mat] || '#6366f1';
          return `<span style="background:${col}18;color:${col};border-radius:99px;padding:1px 7px;font-size:10px;font-weight:700">${escapeHTML(mat.length>12?mat.slice(0,11)+'…':mat)} ×${n}</span>`;
        }).join(' ');
      }

      dayRows.push(`<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;${i<PREVIEW_DAYS-1?'border-bottom:1px solid var(--border-subtle)':''}">
        <div style="min-width:36px;font-size:10px;font-weight:${isToday?'800':'600'};color:${isToday?'var(--primary)':'var(--on-sv)'};padding-top:1px;text-align:center">${dayLabel}</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px">${pills}</div>
      </div>`);
    }
    planningHTML = dayRows.join('');
  }

  card.style.display = 'block';
  card.innerHTML = `<div onclick="showScreen('partiels')" style="background:var(--surface);border-radius:var(--r-xl);padding:14px 16px;cursor:pointer;border:1px solid var(--border-subtle);box-shadow:var(--sh);margin-bottom:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:13px;font-weight:800;color:var(--on-surface)">Planning partiels</span>
      ${nextExam?`<span style="font-size:11px;font-weight:800;color:${nextExam.d<=3?'var(--error)':nextExam.d<=7?'var(--primary)':'var(--primary)'};background:color-mix(in srgb,var(--primary) 12%,transparent);border-radius:99px;padding:2px 8px">J−${nextExam.d} · ${escapeHTML(nextExam.g.name)}</span>`:`<span style="font-size:13px;font-weight:800;color:var(--primary)">${pct}%</span>`}
    </div>
    <div style="height:4px;background:var(--surf-highest);border-radius:99px;overflow:hidden;margin-bottom:10px">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--primary-c));border-radius:99px;transition:width .8s var(--ease)"></div>
    </div>
    ${planningHTML || `<div style="font-size:12px;color:var(--on-sv)">${parts.join(' · ') || 'Ajoute une date d\'examen pour voir ton planning'}</div>`}
    <div style="font-size:10px;color:var(--on-sv);margin-top:8px;text-align:right">Voir tout →</div>
  </div>`;
}

// ── Vue liste : grille de cartes matières ──
function renderPartiels() {
  try { _renderPartielsInner(); } catch(e) { console.error('renderPartiels CRASH:', e); document.getElementById('pg-matieres-grid').innerHTML = `<div style="padding:20px;color:red;font-size:12px">Erreur: ${e.message}</div>`; }
}
function _renderPartielsInner() {
  // Toujours montrer la vue liste
  const listView = document.getElementById('pg-list-view');
  const detailView = document.getElementById('pg-detail-view');
  if (listView) listView.style.display = '';
  if (detailView) detailView.style.display = 'none';
  _pgDetailId = null;

  // Stats globales
  const statsEl = document.getElementById('partiels-stats');
  const total = partiels.length;
  const done = partiels.filter(p => p.status === 'done').length;
  const seen = partiels.filter(p => p.status === 'seen').length;
  const todo = partiels.filter(p => p.status === 'todo').length;
  const pct = partielScore();
  if (statsEl && total > 0) {
    statsEl.style.display = '';
    statsEl.innerHTML = `<div class="partiels-stats-inner">
      <div>
        <div class="hf" style="font-size:32px;font-weight:800;line-height:1;color:var(--primary)">${pct}%</div>
        <div style="font-size:12px;color:var(--on-sv);margin-top:2px">${done+seen}/${total} thèmes couverts</div>
      </div>
      <div style="text-align:right;font-size:12px;color:var(--on-sv);line-height:2">
        <span style="color:var(--tertiary);font-weight:700">✓ ${done}</span> maîtrisé${done>1?'s':''}<br>
        <span style="color:var(--gold);font-weight:700">◑ ${seen}</span> en cours<br>
        <span style="color:var(--on-sv)">○ ${todo}</span> à faire
      </div>
    </div>
    <div class="partiel-bar-bg" style="height:8px;border-radius:6px;margin-top:10px">
      <div class="partiel-bar-fill" style="width:${pct}%;height:8px;transition:width .8s var(--ease)"></div>
    </div>`;
  } else if (statsEl) statsEl.style.display = 'none';

  // Grille des matières
  const grid = document.getElementById('pg-matieres-grid');
  if (!grid) return;

  if (!partielGroups.length) {
    grid.innerHTML = `<div style="text-align:center;padding:48px 20px">
      <div style="margin-bottom:14px"><span class="ms" style="font-size:44px;color:var(--on-sv)">school</span></div>
      <div style="font-size:17px;font-weight:800;color:var(--on-surface);margin-bottom:6px">Aucune matière</div>
      <div style="font-size:13px;color:var(--on-sv);margin-bottom:20px">Crée ta première matière et ajoute les thèmes à réviser avant l'exam.</div>
      <button class="btn btn-p" onclick="openPartielGroupModal(null)"><span class="ms" style="font-size:15px">add</span> Nouvelle matière</button>
    </div>`;
    return;
  }

  // ── Grille des matières (toujours affichée en premier) ──
  grid.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <span style="font-size:12px;font-weight:700;color:var(--on-sv);text-transform:uppercase;letter-spacing:.6px">${partielGroups.length} matière${partielGroups.length>1?'s':''}</span>
    <button class="btn btn-sm btn-p" onclick="openPartielGroupModal(null)"><span class="ms" style="font-size:13px;vertical-align:middle">add</span> Nouvelle</button>
  </div>` +
  partielGroups.map(g => {
    const themes = partiels.filter(p => p.groupId === g.id);
    const gpct = _groupScore(g.id);
    const gdone = themes.filter(p => p.status === 'done').length;
    const gseen = themes.filter(p => p.status === 'seen').length;
    const gtodo = themes.filter(p => p.status === 'todo').length;
    const daysLeft = _pgDaysLeft(g);
    const barColor = gpct >= 75 ? '#22c55e' : gpct >= 40 ? '#f59e0b' : gpct > 0 ? '#ef4444' : 'var(--surf-highest)';
    const dColor = daysLeft === null ? 'var(--on-sv)' : daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#22c55e';
    const feelEmoji = g.feel === 'good' ? '<span class="ms" style="font-size:18px;color:#12A35E;vertical-align:-3px">sentiment_satisfied</span>' : g.feel === 'bad' ? '<span class="ms" style="font-size:18px;color:var(--error);vertical-align:-3px">sentiment_stressed</span>' : g.feel === 'medium' ? '<span class="ms" style="font-size:18px;color:var(--gold);vertical-align:-3px">sentiment_neutral</span>' : '';
    const examStr = g.examDate ? new Date(g.examDate).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : null;
    return `<div class="pg-matiere-card" onclick="openPGDetail('${g.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:800;color:var(--on-surface);margin-bottom:3px">${feelEmoji?feelEmoji+' ':''}${escapeHTML(g.name)}</div>
          <div style="font-size:12px;color:var(--on-sv)">${themes.length} thème${themes.length>1?'s':''} · ✓${gdone} ◑${gseen} ○${gtodo}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:10px">
          <div style="font-size:20px;font-weight:900;color:${barColor};font-family:'Manrope',sans-serif;line-height:1">${gpct}%</div>
          ${daysLeft!==null?`<div style="font-size:11px;font-weight:800;color:${dColor};margin-top:2px">${daysLeft<0?'Passé':'J−'+daysLeft}</div>`:''}
        </div>
      </div>
      <div style="height:6px;background:var(--surf-highest);border-radius:99px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${gpct}%;background:${barColor};border-radius:99px;transition:width .8s var(--ease)"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${examStr?`<span style="background:${dColor}18;color:${dColor};border-radius:99px;padding:2px 8px;font-size:11px;font-weight:700">${examStr}</span>`:'<span style="font-size:11px;color:var(--on-sv)">Pas de date</span>'}
          ${(()=>{const rem=gtodo+Math.round(gseen*.5);const dt=daysLeft>0&&rem>0?Math.ceil(rem/daysLeft):null;return dt?`<span style="background:var(--surf-mid);border-radius:99px;padding:2px 8px;font-size:11px;color:var(--on-sv)">${dt}/jour</span>`:'';})()}
        </div>
        <div style="display:flex;gap:4px">
          <button onclick="event.stopPropagation();openPartielGroupModal('${g.id}')" style="background:none;border:1px solid var(--border-subtle);border-radius:8px;padding:5px 8px;cursor:pointer;color:var(--on-sv)" title="Modifier"><span class="ms" style="font-size:14px">edit</span></button>
          <button onclick="event.stopPropagation();_deletePartielGroup('${g.id}')" style="background:none;border:1px solid var(--border-subtle);border-radius:8px;padding:5px 8px;cursor:pointer;color:var(--error)" title="Supprimer"><span class="ms" style="font-size:14px">delete</span></button>
        </div>
      </div>
    </div>`;
  }).join('');

  // ── Emploi du temps global (colonne droite) ──
  const rightCol = document.getElementById('pg-right-col');
  const intensifEl = document.getElementById('pg-intensif-preview');
  if (!intensifEl) return;
  try {
    const todayStr = getLocalDateString(new Date());
    const feelMap = { good: 'Bien', medium: 'Moyen', bad: 'Pas bien' };
    const matieresPourAlgo = partielGroups
      .filter(g => g.examDate && _pgDaysLeft(g) > 0 && partiels.filter(p => p.groupId === g.id).length > 0)
      .map(g => ({
        id: g.id, nom_matiere: g.name, date_examen: g.examDate,
        nombre_themes: partiels.filter(p => p.groupId === g.id).length,
        niveau_confiance: feelMap[g.feel] || 'Moyen',
      }));

    if (!matieresPourAlgo.length) { if (rightCol) rightCol.style.display = 'none'; intensifEl.innerHTML = ''; return; }

    const cal = genererCalendrier(todayStr, matieresPourAlgo);
    const maxDaysGlobal = Math.max(...matieresPourAlgo.map(m => _cgDiffJours(todayStr, m.date_examen)));
    const totalTachesGlobal = Object.values(cal).flat().length;
    const palette = ['#6366f1','#f59e0b','#22c55e','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
    const matiereColor = {};
    matieresPourAlgo.forEach((m, i) => { matiereColor[m.nom_matiere] = palette[i % palette.length]; });

    const phaseShort = p => p.startsWith('Voir + ') ? 'V+R' : p.startsWith('Voir') ? 'V' : p.startsWith('Rév') ? 'R' : '✓';

    const rows = [];
    for (let i = 0; i < maxDaysGlobal; i++) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + i);
      const dateStr = getLocalDateString(d);
      const taches = cal[dateStr] || [];
      const isToday = i === 0;
      const examsJ = matieresPourAlgo.filter(m => m.date_examen === dateStr);
      let content = '';
      if (examsJ.length) {
        content = examsJ.map(m => `<span style="background:#ef444420;color:#ef4444;border-radius:99px;padding:2px 8px;font-size:11px;font-weight:800">${escapeHTML(m.nom_matiere)}</span>`).join(' ');
      } else if (!taches.length) {
        content = `<span style="font-size:11px;color:var(--on-sv);font-style:italic">Repos</span>`;
      } else {
        const byMat = {};
        taches.forEach(t => { if (!byMat[t.matiere]) byMat[t.matiere] = []; byMat[t.matiere].push(t); });
        content = Object.entries(byMat).map(([mat, ts]) => {
          const col = matiereColor[mat] || '#6366f1';
          const chips = ts.map(t => {
            const num = (t.theme.match(/\d+/) || ['?'])[0];
            return `<span style="background:${col}18;color:${col};border-radius:4px;padding:1px 5px;font-size:10px;font-weight:700">${phaseShort(t.phase)}${num}</span>`;
          }).join(' ');
          return `<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
            <span style="font-size:11px;font-weight:700;color:${col};min-width:55px;max-width:75px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(mat)}</span>
            <div style="display:flex;flex-wrap:wrap;gap:3px">${chips}</div>
          </div>`;
        }).join('');
      }
      rows.push(`<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-subtle);${isToday?'background:var(--primary)08;margin:0 -4px;padding:7px 4px;border-radius:6px':''}">
        <div style="min-width:40px;text-align:center;flex-shrink:0">
          <div style="font-size:15px;font-weight:900;color:${isToday?'var(--primary)':'var(--on-surface)'}">${d.getDate()}</div>
          <div style="font-size:9px;color:var(--on-sv);text-transform:uppercase;font-weight:700">${d.toLocaleDateString('fr-FR',{weekday:'short'})}</div>
          ${isToday?`<div style="font-size:8px;color:var(--primary);font-weight:800">Auj.</div>`:''}
        </div>
        <div style="flex:1;min-width:0">${content}</div>
      </div>`);
    }

    const legende = matieresPourAlgo.map(m =>
      `<span style="background:${matiereColor[m.nom_matiere]}18;color:${matiereColor[m.nom_matiere]};border-radius:99px;padding:2px 8px;font-size:10px;font-weight:700">${escapeHTML(m.nom_matiere)}</span>`
    ).join('');

    if (rightCol) rightCol.style.display = '';
    intensifEl.innerHTML = `<div style="background:var(--surface);border-radius:var(--r-xl);padding:16px;border:1px solid var(--border-subtle);box-shadow:var(--sh);position:sticky;top:12px">
      <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:2px">Emploi du temps</div>
      <div style="font-size:11px;color:var(--on-sv);margin-bottom:8px">${totalTachesGlobal} tâches · V=Voir R=Réviser ✓=Re-rév.</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">${legende}</div>
      <div style="max-height:70vh;overflow-y:auto;padding-right:2px">${rows.join('')}</div>
    </div>`;
  } catch(e) {
    console.error('Calendrier erreur:', e);
    if (rightCol) {
      rightCol.style.display = '';
      intensifEl.innerHTML = `<div style="background:var(--surface);border-radius:var(--r-xl);padding:16px;border:1px solid var(--border-subtle)"><div style="color:var(--error);font-size:12px">Erreur calendrier: ${e.message}</div></div>`;
    }
  }
}

function _deletePartielGroup(gid) {
  const g = partielGroups.find(x => x.id === gid);
  if (!g) return;
  showConfirm(`Supprimer "${g.name}" ?`, 'Les thèmes seront supprimés définitivement.', 'Supprimer', () => {
    partiels = partiels.filter(p => p.groupId !== gid);
    partielGroups = partielGroups.filter(x => x.id !== gid);
    saveAll(); renderPartiels(); renderPartielsHomeCard();
    if(typeof renderPlanHomeCard==='function')renderPlanHomeCard();
    showNotif('Matière supprimée','ok');
  });
}

// ── Vue détail d'une matière ──
function openPGDetail(gid) {
  _pgDetailId = gid;
  document.getElementById('pg-list-view').style.display = 'none';
  document.getElementById('pg-detail-view').style.display = '';
  renderPGDetail();
}

// ══════════════════════════════════════════════════
// ALGORITHME DE CALENDRIER — Gemini v2
// Load-balancing + scoring dynamique + dépendances
// entre phases. Clés = dates YYYY-MM-DD.
// ══════════════════════════════════════════════════

function _cgDiffJours(date1, date2) {
  return Math.ceil((new Date(date2) - new Date(date1)) / (1000 * 60 * 60 * 24));
}
function _cgAjouterJours(date, jours) {
  const d = new Date(date);
  d.setDate(d.getDate() + jours);
  return getLocalDateString(d);
}
function _cgCalculerScore(tache, jourActuel) {
  let score = 0;
  if (tache.confiance === 'Pas bien') score += 10;
  if (tache.confiance === 'Moyen')    score += 5;
  if (tache.phase.includes('Voir'))   score += 8;
  score += (100 / Math.max(1, tache.joursAvantExamen - jourActuel));
  return score;
}

/**
 * @param {string} dateAujourdhui  'YYYY-MM-DD'
 * @param {Array}  matieres  [{id, nom_matiere, date_examen, nombre_themes, niveau_confiance}]
 *   niveau_confiance : 'Pas bien' | 'Moyen' | 'Bien'
 * @returns {Object} { [dateStr]: [{matiere, theme:'Thème N', phase}] }
 */
function _cgCapPhase(phase) {
  if (phase.startsWith('Voir')) return _CAP_VOIR;
  if (phase.startsWith('Réviser')) return _CAP_REVISER;
  return _CAP_REREVISER;
}
function _cgPhaseKey(phase) {
  if (phase.startsWith('Voir')) return 'voir';
  if (phase.startsWith('Réviser')) return 'reviser';
  return 'rereviser';
}

function genererCalendrier(dateAujourdhui, matieres) {
  const maxJours = Math.max(...matieres.map(m => _cgDiffJours(dateAujourdhui, m.date_examen)).filter(j => j > 0));
  if (!maxJours) return {};

  const calendrier = {};
  for (let j = 0; j < maxJours; j++) calendrier[_cgAjouterJours(dateAujourdhui, j)] = [];

  const sprintDays = maxJours <= 7 ? 1
    : maxJours <= 20 ? Math.max(2, Math.round(maxJours * 0.15))
    : Math.min(10, Math.max(3, Math.round(maxJours * 0.12)));
  const mainDays = maxJours - sprintDays;

  const taches = [];

  matieres.forEach(matiere => {
    const jr = _cgDiffJours(dateAujourdhui, matiere.date_examen);
    if (jr <= 0) return;
    const mMain = Math.min(mainDays, jr - sprintDays);
    const N = matiere.nombre_themes;

    // Espacements fixes par phase (méthode SRS) :
    // Voir → +2j Réviser → +9j Re-réviser → +20j Re-réviser 2
    let phases, spacings;
    if (matiere.niveau_confiance === 'Pas bien') {
      phases   = ['Voir', 'Réviser', 'Re-réviser 1', 'Re-réviser 2'];
      spacings = [0, 2, 9, 20];
    } else if (matiere.niveau_confiance === 'Moyen') {
      phases   = ['Voir', 'Réviser', 'Re-réviser'];
      spacings = [0, 2, 9];
    } else {
      phases   = ['Voir + Réviser', 'Re-réviser'];
      spacings = [0, 7];
    }

    // Étaler les Voir sur les 55% premiers jours de mMain
    // (laisse de la place pour les Réviser et Re-réviser après le dernier Voir)
    const voirZone = Math.max(1, Math.floor(mMain * 0.55));
    for (let t = 0; t < N; t++) {
      const jourVoir = Math.floor((t / Math.max(1, N)) * voirZone);
      phases.forEach((phase, idx) => {
        const jourIdeal = jourVoir + spacings[idx];
        taches.push({ matiere: matiere.nom_matiere, theme: `Thème ${t + 1}`, phase, jourIdeal, dateExamen: matiere.date_examen });
      });
    }
  });

  // Trier chronologiquement puis placer (jour idéal ou 1er slot dispo, jamais après l'exam)
  taches.sort((a, b) => a.jourIdeal - b.jourIdeal);

  taches.forEach(tache => {
    const key = _cgPhaseKey(tache.phase);
    const cap = key === 'voir' ? _CAP_VOIR : key === 'reviser' ? _CAP_REVISER : _CAP_REREVISER;
    for (let delta = 0; delta < mainDays; delta++) {
      const dateKey = _cgAjouterJours(dateAujourdhui, tache.jourIdeal + delta);
      if (dateKey >= tache.dateExamen) break; // ne pas placer après (ou le jour de) l'examen
      const jour = calendrier[dateKey];
      if (!jour) continue;
      if (jour.filter(t => _cgPhaseKey(t.phase) === key).length >= cap) continue;
      if (jour.some(t => t.theme === tache.theme && t.matiere === tache.matiere)) continue;
      jour.push({ matiere: tache.matiere, theme: tache.theme, phase: tache.phase });
      break;
    }
  });

  // ── Sprint final ──
  const sprintThemes = [];
  matieres.forEach(m => {
    for (let t = 1; t <= m.nombre_themes; t++)
      sprintThemes.push({ matiere: m.nom_matiere, theme: `Thème ${t}`, phase: 'Re-réviser', dateExamen: m.date_examen });
  });
  let si = 0;
  for (let pass = 0; pass < 4 && si < sprintThemes.length; pass++) {
    for (let j = maxJours - sprintDays; j < maxJours && si < sprintThemes.length; j++) {
      const dateKey = _cgAjouterJours(dateAujourdhui, j);
      if (dateKey >= sprintThemes[si].dateExamen) { si++; continue; } // skip si après exam
      const jour = calendrier[dateKey] || [];
      const places = Math.max(0, _CAP_REREVISER - jour.filter(t => _cgPhaseKey(t.phase) === 'rereviser').length);
      for (let k = 0; k < places && si < sprintThemes.length; k++, si++) jour.push(sprintThemes[si]);
    }
  }

  return calendrier;
}

function renderPGDetail() {
  const el = document.getElementById('pg-detail-content');
  if (!el || !_pgDetailId) return;
  const g = partielGroups.find(x => x.id === _pgDetailId);
  if (!g) { renderPartiels(); return; }

  const themes = partiels.filter(p => p.groupId === _pgDetailId);
  const done  = themes.filter(p => p.status === 'done');
  const seen  = themes.filter(p => p.status === 'seen');
  const todo  = themes.filter(p => p.status === 'todo');
  const gpct  = _groupScore(_pgDetailId);
  const daysLeft   = _pgDaysLeft(g);
  const barColor   = gpct >= 75 ? '#22c55e' : gpct >= 40 ? '#f59e0b' : gpct > 0 ? '#ef4444' : 'var(--surf-highest)';
  const dColor     = daysLeft === null ? 'var(--on-sv)' : daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#22c55e';
  const feelEmoji  = g.feel === 'good' ? '<span class="ms" style="font-size:18px;color:#12A35E;vertical-align:-3px">sentiment_satisfied</span>' : g.feel === 'bad' ? '<span class="ms" style="font-size:18px;color:var(--error);vertical-align:-3px">sentiment_stressed</span>' : '<span class="ms" style="font-size:18px;color:var(--gold);vertical-align:-3px">sentiment_neutral</span>';

  // ── Couleurs des phases (nouvel algo) ──
  function _phaseInfo(phase) {
    if (phase.startsWith('Voir + Réviser')) return { label: 'Voir + Réviser', color: '#8b5cf6', bg: '#8b5cf615' };
    if (phase.startsWith('Voir'))           return { label: 'Voir',           color: '#6366f1', bg: '#6366f115' };
    if (phase.startsWith('Réviser'))        return { label: 'Réviser',        color: '#f59e0b', bg: '#f59e0b15' };
    return                                         { label: 'Re-réviser',      color: '#22c55e', bg: '#22c55e15' };
  }

  // ── Générer le calendrier (nouvel algo) ──
  const feelMap = { good: 'Bien', medium: 'Moyen', bad: 'Pas bien' };
  const todayStr = getLocalDateString(new Date());
  const matieresPourAlgo = [{
    id: g.id,
    nom_matiere: g.name,
    date_examen: g.examDate,
    nombre_themes: themes.length,
    niveau_confiance: feelMap[g.feel] || 'Moyen',
  }];
  const calendrier = (daysLeft !== null && daysLeft > 0 && themes.length > 0 && g.examDate)
    ? genererCalendrier(todayStr, matieresPourAlgo)
    : {};

  // Compter le total de tâches planifiées
  const totalTaches = Object.values(calendrier).flat().length;

  // ── Construire l'agenda HTML ──
  let agendaHTML = '';
  if (daysLeft !== null && daysLeft > 0) {
    const today = new Date(); today.setHours(0,0,0,0);
    const ed = g.examDate ? new Date(g.examDate + 'T00:00:00') : null;

    const rows = [];
    for (let i = 0; i < daysLeft; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const dateStr = getLocalDateString(d);
      const isToday = i === 0;
      const taches = calendrier[dateStr] || [];

      // Regrouper par phase normalisée → numéros de thèmes
      const byPhase = {};
      taches.forEach(t => {
        const pi = _phaseInfo(t.phase);
        const key = pi.label;
        if (!byPhase[key]) byPhase[key] = { pi, nums: [] };
        const m = t.theme.match(/\d+/);
        if (m) byPhase[key].nums.push(parseInt(m[0]));
      });

      let content = '';
      if (!taches.length) {
        content = `<span style="font-size:11px;color:var(--on-sv);font-style:italic">Repos</span>`;
      } else {
        content = Object.values(byPhase).map(({ pi, nums }) => {
          nums.sort((a, b) => a - b);
          // Grouper les numéros en plages lisibles : [1,2,3,5] → "1-3, 5"
          const ranges = [];
          let start = nums[0], end = nums[0];
          for (let k = 1; k < nums.length; k++) {
            if (nums[k] === end + 1) { end = nums[k]; }
            else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = end = nums[k]; }
          }
          ranges.push(start === end ? `${start}` : `${start}-${end}`);
          return `<div style="background:${pi.bg};border-left:2px solid ${pi.color};border-radius:0 6px 6px 0;padding:3px 7px;margin-bottom:2px">
            <div style="font-size:10px;font-weight:700;color:${pi.color}">${pi.label}</div>
            <div style="font-size:12px;font-weight:600;color:var(--on-surface)">Thème${nums.length>1?'s':''} ${ranges.join(', ')} <span style="color:var(--on-sv);font-weight:400">(${nums.length})</span></div>
          </div>`;
        }).join('');
      }

      rows.push(`<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-subtle);${isToday?'background:var(--primary)08;margin:0 -4px;padding:7px 4px;border-radius:6px':''}">
        <div style="min-width:42px;text-align:center;flex-shrink:0">
          <div style="font-size:15px;font-weight:900;color:${isToday?'var(--primary)':'var(--on-surface)'}">${d.getDate()}</div>
          <div style="font-size:9px;color:var(--on-sv);text-transform:uppercase;font-weight:700">${d.toLocaleDateString('fr-FR',{weekday:'short'})}</div>
          ${isToday?`<div style="font-size:8px;color:var(--primary);font-weight:800">Auj.</div>`:''}
        </div>
        <div style="flex:1;min-width:0">${content}</div>
      </div>`);
    }

    // Ligne exam
    if (ed) rows.push(`<div style="display:flex;gap:10px;padding:10px 4px;background:#ef444418;border-radius:8px;margin-top:4px">
      <div style="min-width:42px;text-align:center;flex-shrink:0">
        <div style="font-size:15px;font-weight:900;color:#ef4444">${ed.getDate()}</div>
        <div style="font-size:9px;color:#ef4444;text-transform:uppercase;font-weight:700">${ed.toLocaleDateString('fr-FR',{weekday:'short'})}</div>
      </div>
      <div style="font-size:13px;font-weight:800;color:#ef4444;line-height:1.8">Examen<br>
        <span style="font-size:11px;font-weight:400;color:var(--on-sv)">${ed.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</span>
      </div>
    </div>`);

    agendaHTML = `<div class="pg-detail-agenda">
      <div style="font-size:13px;font-weight:800;color:var(--on-surface);margin-bottom:2px">Calendrier de révision</div>
      <div style="font-size:11px;color:var(--on-sv);margin-bottom:10px">${daysLeft<0?'Passé':'J−'+daysLeft} · ${totalTaches} tâches planifiées · ${themes.length} thème${themes.length>1?'s':''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${['Voir','Réviser','Re-réviser','Voir + Réviser'].map(p=>{ const pi=_phaseInfo(p); return `<span style="font-size:10px;font-weight:700;color:${pi.color};background:${pi.bg};padding:2px 7px;border-radius:99px">${pi.label}</span>`; }).join('')}
      </div>
      ${rows.join('')}
    </div>`;
  } else if (daysLeft === null) {
    agendaHTML = `<div class="pg-detail-agenda" style="text-align:center;padding:24px 16px">
      <div style="margin-bottom:10px"><span class="ms" style="font-size:32px;color:var(--on-sv)">calendar_month</span></div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">Pas de date d'exam</div>
      <div style="font-size:12px;color:var(--on-sv);margin-bottom:14px">Ajoute une date pour générer ton calendrier automatiquement</div>
      <button class="btn btn-p btn-sm" onclick="openPartielGroupModal('${g.id}')">Ajouter une date</button>
    </div>`;
  } else {
    agendaHTML = `<div class="pg-detail-agenda" style="text-align:center;padding:24px 16px;color:var(--on-sv)">Examen passé.</div>`;
  }

  // ── Carte thème (liste gauche) ──
  const siMap = {
    todo: { label: 'Non commencé', color: 'var(--error)',    icon: 'radio_button_unchecked' },
    seen: { label: 'En cours',     color: 'var(--gold)',     icon: 'timelapse' },
    done: { label: 'Maîtrisé',     color: 'var(--tertiary)', icon: 'check_circle' },
  };

  function themeCard(p, idx) {
    const si = siMap[p.status] || siMap.todo;
    // Trouver la date à laquelle ce thème est "à voir" dans le calendrier
    const themeLabel = `Thème ${idx + 1}`;
    let dateVoir = null;
    for (const [dateStr, taches] of Object.entries(calendrier)) {
      if (taches.some(t => t.theme === themeLabel && t.phase.startsWith('Voir'))) { dateVoir = dateStr; break; }
    }
    let dateLabel = '';
    if (dateVoir !== null) {
      const isToday2 = dateVoir === todayStr;
      const d = new Date(dateVoir + 'T00:00:00');
      dateLabel = isToday2
        ? `<span style="background:#ef444415;color:#ef4444;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px;margin-left:6px">Aujourd'hui</span>`
        : `<span style="color:var(--on-sv);font-size:10px;margin-left:6px">${d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span>`;
    }
    return `<div class="pg-theme-card" onclick="openPartielModal('${p.id}','${_pgDetailId}')">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="min-width:28px;height:28px;border-radius:50%;background:var(--surf-low);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--on-sv);flex-shrink:0">${idx+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--on-surface)">${p.name}${dateLabel}</div>
          <div style="font-size:11px;color:${si.color};font-weight:600">${si.label}</div>
        </div>
        <span class="ms" style="font-size:16px;color:var(--on-sv)">chevron_right</span>
      </div>
    </div>`;
  }

  el.innerHTML = `<div class="wrap">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-top:4px">
      <button class="ib" onclick="renderPartiels()"><span class="ms">arrow_back</span></button>
      <div style="flex:1">
        <h2 style="font-size:20px;font-weight:800;color:var(--on-surface)">${feelEmoji} ${escapeHTML(g.name)}</h2>
        <div style="font-size:12px;color:var(--on-sv)">${themes.length} thème${themes.length>1?'s':''} · ${gpct}% maîtrisé</div>
      </div>
      <button class="btn btn-sm btn-g" onclick="openPartielGroupModal('${g.id}')"><span class="ms" style="font-size:13px;vertical-align:middle">edit</span> Modifier</button>
    </div>

    <div style="background:var(--surface);border-radius:var(--r-xl);padding:16px;margin-bottom:16px;border:1px solid var(--border-subtle);box-shadow:var(--sh)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:22px;font-weight:900;color:${barColor};font-family:'Manrope',sans-serif">${gpct}%</span>
        ${daysLeft!==null?`<span style="font-size:18px;font-weight:800;color:${dColor}">${daysLeft<0?'Passé':'J−'+daysLeft}</span>`:''}
      </div>
      <div style="height:8px;background:var(--surf-highest);border-radius:99px;overflow:hidden;margin-bottom:10px">
        <div style="height:100%;width:${gpct}%;background:${barColor};border-radius:99px;transition:width .8s var(--ease)"></div>
      </div>
      <div style="display:flex;gap:14px;font-size:12px;color:var(--on-sv)">
        <span>✓ ${done.length}</span><span>◑ ${seen.length}</span><span>○ ${todo.length}</span>
        ${totalTaches?`<span style="margin-left:auto;font-weight:700;color:var(--primary)">${totalTaches} tâches planifiées</span>`:''}
      </div>
    </div>

    <div class="pg-detail-grid">
      <div class="pg-detail-left">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--on-sv)">Thèmes (${themes.length})</div>
          <button class="btn btn-sm btn-p" style="font-size:11px" onclick="openPartielModal(null,'${g.id}')"><span class="ms" style="font-size:12px">add</span> Ajouter</button>
        </div>
        ${themes.length ? themes.map((p, i) => themeCard(p, i)).join('') : `<div style="text-align:center;padding:32px;color:var(--on-sv)">
          <div style="margin-bottom:10px"><span class="ms" style="font-size:32px;color:var(--on-sv)">edit_note</span></div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Aucun thème</div>
          <button class="btn btn-p btn-sm" onclick="openPartielModal(null,'${g.id}')">+ Ajouter un thème</button>
        </div>`}
      </div>
      <div class="pg-detail-right">
        ${agendaHTML}
      </div>
    </div>
    <div style="height:80px"></div>
  </div>`;
}

function togglePartielGroup(gid) {} // rétrocompat


// ── Groupe modal ──
function openPartielGroupModal(id) {
  _partielGroupEditId = id;
  _pgFeel = 'medium';

  // Remplir le sélecteur de dossiers liés
  const folderSel = document.getElementById('pg-folder-sel');
  const activeFolders = folders.filter(f => !isFolderArchived(f.id) && f.type !== 'annales');
  folderSel.innerHTML = '<option value="">— Aucun dossier —</option>' +
    activeFolders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');

  if (id) {
    const g = partielGroups.find(x => x.id === id);
    if (!g) return;
    document.getElementById('pg-modal-title').textContent = 'Modifier la matière';
    document.getElementById('pg-name').value = g.name;
    document.getElementById('pg-exam-date').value = g.examDate || '';
    _pgFeel = g.feel || 'medium';
    folderSel.value = g.folderId || '';
    document.getElementById('pg-delete-btn').style.display = '';
  } else {
    document.getElementById('pg-modal-title').textContent = 'Nouvelle matière';
    document.getElementById('pg-name').value = '';
    document.getElementById('pg-exam-date').value = '';
    folderSel.value = '';
    document.getElementById('pg-delete-btn').style.display = 'none';
  }
  selectPGFeel(_pgFeel);
  openModal('modal-partiel-group');
  setTimeout(() => document.getElementById('pg-name').focus(), 120);
}

function savePartielGroup() {
  const name = document.getElementById('pg-name').value.trim();
  if (!name) { showNotif('Donne un nom à la matière', 'error'); return; }
  const examDate = document.getElementById('pg-exam-date').value || null;
  const feel = _pgFeel;
  const folderId = document.getElementById('pg-folder-sel').value || null;
  if (_partielGroupEditId) {
    const idx = partielGroups.findIndex(x => x.id === _partielGroupEditId);
    if (idx >= 0) partielGroups[idx] = { ...partielGroups[idx], name, examDate, feel, folderId };
  } else {
    partielGroups.push({ id: uid(), name, examDate, feel, folderId });
  }
  saveAll();
  closeModal('modal-partiel-group');
  if (_pgDetailId) { renderPGDetail(); } else { renderPartiels(); }
  renderPartielsHomeCard();
  showNotif(_partielGroupEditId ? 'Matière mise à jour' : 'Matière créée !', 'ok');
}

function deletePartielGroup() {
  if (!_partielGroupEditId) return;
  showConfirm(
    'Supprimer cette matière ?',
    'Les thèmes de cette matière seront déplacés dans "Sans matière".',
    'Supprimer',
    () => {
      partiels = partiels.map(p => p.groupId === _partielGroupEditId ? { ...p, groupId: null } : p);
      partielGroups = partielGroups.filter(x => x.id !== _partielGroupEditId);
      saveAll();
      closeModal('modal-partiel-group');
      renderPartiels();
      renderPartielsHomeCard();
      if(typeof renderPlanHomeCard==='function')renderPlanHomeCard();
      showNotif('Matière supprimée', 'ok');
    }
  );
}

// ── Onglet Intensif ──
function renderPartielsIntensif() {
  const el = document.getElementById('partiels-intensif');
  if (!el) return;
  const today = new Date(); today.setHours(0,0,0,0);

  const rows = partielGroups.map(g => {
    const themes = partiels.filter(p => p.groupId === g.id);
    const total = themes.length;
    const done = themes.filter(p => p.status === 'done').length;
    const seen = themes.filter(p => p.status === 'seen').length;
    const todo = themes.filter(p => p.status === 'todo').length;
    const gpct = _groupScore(g.id);
    const remaining = todo + Math.round(seen * 0.5);
    let daysLeft = null, examStr = null;
    if (g.examDate) {
      const ed = new Date(g.examDate); ed.setHours(0,0,0,0);
      daysLeft = Math.ceil((ed - today) / 86400000);
      examStr = ed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    }
    const dailyTarget = (daysLeft !== null && daysLeft > 0 && remaining > 0) ? Math.ceil(remaining / daysLeft) : null;
    const urgency = daysLeft !== null ? daysLeft : 9999;
    let statusColor, statusLabel;
    if (!g.examDate) { statusColor = 'var(--on-sv)'; statusLabel = 'Sans date d\'examen'; }
    else if (daysLeft <= 0) { statusColor = 'var(--on-sv)'; statusLabel = 'Examen passé'; }
    else if (g.feel === 'bad' || (daysLeft <= 3 && gpct < 60)) { statusColor = 'var(--error)'; statusLabel = 'Critique'; }
    else if (g.feel === 'medium' || (daysLeft <= 7 && gpct < 80)) { statusColor = 'var(--gold)'; statusLabel = 'À surveiller'; }
    else { statusColor = 'var(--tertiary)'; statusLabel = 'Dans les temps'; }
    const expired = daysLeft !== null && daysLeft <= 0;
    return { g, total, done, seen, todo, gpct, remaining, daysLeft, examStr, dailyTarget, urgency, statusColor, statusLabel, expired };
  }).sort((a, b) => a.urgency - b.urgency);

  const withDate = rows.filter(r => r.g.examDate && !r.expired);
  const noDate = rows.filter(r => !r.g.examDate);
  const expired = rows.filter(r => r.expired);

  let html = '';

  // Matières sans date — section de setup rapide
  if (noDate.length) {
    html += `<div style="background:var(--surf-low);border-radius:var(--r-xl);padding:14px;margin-bottom:14px;border:1px solid var(--border-subtle)">
      <div style="font-size:12px;font-weight:700;color:var(--on-sv);margin-bottom:10px;text-transform:uppercase;letter-spacing:.6px">Ajouter une date d'exam</div>
      ${noDate.map(r => `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border-subtle)">
        <span style="font-size:14px;font-weight:600;color:var(--on-surface)">${escapeHTML(r.g.name)}</span>
        <button class="btn btn-sm btn-p" style="font-size:12px;padding:5px 12px" onclick="openPartielGroupModal('${r.g.id}')">
          <span class="ms" style="font-size:13px;vertical-align:middle">add</span> Ajouter date
        </button>
      </div>`).join('')}
    </div>`;
  }

  // Matières avec date — affichage principal
  if (withDate.length) {
    html += withDate.map(r => {
      const {g, total, done, seen, todo, gpct, remaining, daysLeft, examStr, dailyTarget, statusColor, statusLabel} = r;
      const barColor = gpct >= 75 ? 'var(--tertiary)' : gpct >= 40 ? 'var(--gold)' : 'var(--error)';
      const dColor = daysLeft <= 3 ? 'var(--error)' : daysLeft <= 7 ? 'var(--gold)' : 'var(--tertiary)';
      const feelEmoji = g.feel === 'good' ? '<span class="ms" style="font-size:18px;color:#12A35E;vertical-align:-3px">sentiment_satisfied</span>' : g.feel === 'bad' ? '<span class="ms" style="font-size:18px;color:var(--error);vertical-align:-3px">sentiment_stressed</span>' : g.feel === 'medium' ? '<span class="ms" style="font-size:18px;color:var(--gold);vertical-align:-3px">sentiment_neutral</span>' : '';
      const dailyHTML = dailyTarget ? `
        <div style="background:${statusColor}15;border-radius:10px;padding:10px 12px;margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div>
            <div style="font-size:22px;font-weight:900;color:${statusColor};font-family:'Manrope',sans-serif;line-height:1">${dailyTarget}</div>
            <div style="font-size:11px;color:var(--on-sv)">thème${dailyTarget>1?'s':''}/jour · ${remaining} restant${remaining>1?'s':''} sur ${daysLeft}j</div>
          </div>
          <button onclick="event.stopPropagation();openPartielGroupModal('${g.id}')" style="background:none;border:1px solid var(--border-subtle);border-radius:8px;padding:5px 10px;font-size:12px;color:var(--on-sv);cursor:pointer">Modifier</button>
        </div>` : '';
      return `<div style="background:var(--surface);border-radius:var(--r-xl);padding:16px;margin-bottom:12px;border:1px solid var(--border-subtle);box-shadow:var(--sh)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--on-surface);margin-bottom:3px">${feelEmoji?feelEmoji+' ':''}${escapeHTML(g.name)}</div>
            <div style="font-size:12px;color:${statusColor};font-weight:700">${statusLabel}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:8px">
            <div style="font-size:18px;font-weight:900;color:${dColor};font-family:'Manrope',sans-serif">${daysLeft<0?'Passé':'J−'+daysLeft}</div>
            <div style="font-size:11px;color:var(--on-sv)">${examStr}</div>
          </div>
        </div>
        <div style="height:7px;background:var(--surf-highest);border-radius:99px;overflow:hidden;margin-bottom:5px">
          <div style="height:100%;width:${gpct}%;background:${barColor};border-radius:99px;transition:width .8s var(--ease)"></div>
        </div>
        <div style="font-size:11px;color:var(--on-sv);display:flex;gap:10px;flex-wrap:wrap">
          <span style="font-weight:700;color:${barColor}">${gpct}%</span>
          <span>✓${done} maîtrisé${done>1?'s':''}</span><span>◑${seen} en cours</span><span>○${todo} à faire</span>
        </div>
        ${dailyHTML}
      </div>`;
    }).join('');
  } else if (!noDate.length) {
    html = `<div style="text-align:center;padding:40px 20px;color:var(--on-sv)">
      <div style="margin-bottom:12px"><span class="ms" style="font-size:40px;color:var(--on-sv)">calendar_month</span></div>
      <div style="font-weight:700;font-size:15px;margin-bottom:6px">Aucun examen à venir</div>
      <div style="font-size:13px">Ajoute une date d'examen à tes matières pour voir ici leur urgence.</div>
      <button class="btn btn-p" style="margin-top:16px" onclick="openPartielGroupModal(null)"><span class="ms" style="font-size:15px">add</span> Nouvelle matière</button>
    </div>`;
  }

  // Passés en bas
  if (expired.length) {
    html += `<details style="margin-top:8px"><summary style="font-size:12px;color:var(--on-sv);cursor:pointer;padding:6px 0;user-select:none">Examens passés (${expired.length})</summary>
      ${expired.map(r => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--surf-low);border-radius:10px;margin-top:6px;opacity:.6">
        <span style="font-size:14px;font-weight:600">${escapeHTML(r.g.name)}</span>
        <span style="font-size:12px;color:var(--on-sv)">${r.examStr}</span>
        <button onclick="openPartielGroupModal('${r.g.id}')" style="background:none;border:1px solid var(--border-subtle);border-radius:7px;padding:4px 8px;font-size:11px;color:var(--on-sv);cursor:pointer">Modifier</button>
      </div>`).join('')}
    </details>`;
  }

  el.innerHTML = html;
}

// ── Thème modal ──
function openPartielModal(id, groupId) {
  _partielEditId = id;
  _partielGroupCtx = groupId || null;
  _partielStatus = 'todo';
  _partielConf = 1;

  // Toujours reset en mode "single" à l'ouverture
  _partielMode = 'single';
  switchPartielMode('single');
  // Cacher le toggle si on est en mode édition
  document.getElementById('partiel-mode-toggle').style.display = id ? 'none' : '';

  const sel = document.getElementById('partiel-group-sel');
  sel.innerHTML = '<option value="">— Sans matière —</option>' +
    partielGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

  // Écoute changement de sélection matière → rafraîchir "also course" row
  sel.onchange = () => _updateAlsoCourseRow();

  // Écoute live sur les champs plage
  ['partiel-range-prefix','partiel-range-from','partiel-range-to'].forEach(id2 => {
    const el = document.getElementById(id2);
    if (el) el.oninput = _updateRangePreview;
  });

  if (id) {
    const p = partiels.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modal-partiel-title').textContent = 'Modifier le thème';
    document.getElementById('partiel-name').value = p.name;
    document.getElementById('partiel-delete-btn').style.display = '';
    _partielStatus = p.status;
    _partielConf = p.confidence || 1;
    sel.value = p.groupId || '';
  } else {
    document.getElementById('modal-partiel-title').textContent = 'Nouveau thème';
    document.getElementById('partiel-name').value = '';
    document.getElementById('partiel-range-prefix').value = 'Thème';
    document.getElementById('partiel-range-from').value = '';
    document.getElementById('partiel-range-to').value = '';
    document.getElementById('partiel-delete-btn').style.display = 'none';
    if (_partielGroupCtx) sel.value = _partielGroupCtx;
  }
  _updatePartielStatusBtns();
  _updatePartielConfBtns();
  _updateRangePreview();
  openModal('modal-partiel');
  setTimeout(() => document.getElementById('partiel-name').focus(), 120);
}

function selectPartielStatus(val) {
  _partielStatus = val;
  _updatePartielStatusBtns();
  _updatePartielConfBtns();
}

function selectPartielConf(val) {
  _partielConf = val;
  _updatePartielConfBtns();
}

function _updatePartielStatusBtns() {
  document.querySelectorAll('.partiel-status-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === _partielStatus);
  });
  document.getElementById('partiel-confidence-row').style.display =
    _partielStatus === 'todo' ? 'none' : '';
}

function _updatePartielConfBtns() {
  document.querySelectorAll('.partiel-conf-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.val) === _partielConf);
  });
}

let _partielMode = 'single'; // 'single' | 'range'

function switchPartielMode(mode) {
  _partielMode = mode;
  document.querySelectorAll('.partiel-mode-btn').forEach(b => {
    const active = b.dataset.mode === mode;
    b.style.background = active ? 'var(--primary)' : 'transparent';
    b.style.color = active ? '#fff' : 'var(--primary)';
  });
  document.getElementById('partiel-single-row').style.display = mode === 'single' ? '' : 'none';
  document.getElementById('partiel-range-row').style.display = mode === 'range' ? '' : 'none';
  document.getElementById('partiel-delete-btn').style.display = mode === 'range' ? 'none' : (window._partielEditId ? '' : 'none');
  document.getElementById('partiel-save-btn').textContent = mode === 'range' ? 'Créer les thèmes' : 'Enregistrer';
  // show "also create courses" only in range mode
  const gid = document.getElementById('partiel-group-sel').value;
  _updateAlsoCourseRow();
  _updateRangePreview();
}

function _updateRangePreview() {
  const pre = document.getElementById('partiel-range-preview');
  if (!pre) return;
  const prefix = (document.getElementById('partiel-range-prefix').value.trim() || 'Thème');
  const from = parseInt(document.getElementById('partiel-range-from').value) || 1;
  const to = parseInt(document.getElementById('partiel-range-to').value) || from;
  const count = Math.max(0, to - from + 1);
  if (count <= 0) { pre.textContent = ''; return; }
  const sample = count <= 3
    ? Array.from({length: count}, (_, i) => `${prefix} ${from + i}`).join(', ')
    : `${prefix} ${from}, ${prefix} ${from + 1} … ${prefix} ${to}`;
  pre.textContent = `→ ${count} thème${count > 1 ? 's' : ''} : ${sample}`;
}

function _updateAlsoCourseRow() {
  const row = document.getElementById('partiel-also-course-row');
  if (!row) return;
  const gid = document.getElementById('partiel-group-sel').value;
  const g = gid ? partielGroups.find(x => x.id === gid) : null;
  // show only in range mode AND when selected group has a linked folder
  const linkedFid = g && g.folderId ? g.folderId : null;
  row.style.display = (_partielMode === 'range' && linkedFid) ? '' : 'none';
  if (linkedFid) {
    const f = folders.find(x => x.id === linkedFid);
    const lbl = row.querySelector('label');
    if (lbl && f) lbl.childNodes[lbl.childNodes.length - 1].textContent = ` Créer aussi les cours dans "${f.name}"`;
  }
}

function savePartiel() {
  const groupId = document.getElementById('partiel-group-sel').value || null;

  if (_partielMode === 'range' && !_partielEditId) {
    // ── MODE PLAGE ──
    const prefix = (document.getElementById('partiel-range-prefix').value.trim() || 'Thème');
    const from = parseInt(document.getElementById('partiel-range-from').value);
    const to = parseInt(document.getElementById('partiel-range-to').value);
    if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
      showNotif('Vérifie la plage de numéros', 'error'); return;
    }
    if (to - from + 1 > 60) {
      showNotif('Maximum 60 thèmes à la fois', 'error'); return;
    }
    const alsoCourse = document.getElementById('partiel-also-course').checked;
    const g = groupId ? partielGroups.find(x => x.id === groupId) : null;
    const linkedFid = g && g.folderId ? g.folderId : null;
    for (let n = from; n <= to; n++) {
      const name = `${prefix} ${n}`;
      partiels.push({ id: uid(), name, status: _partielStatus, confidence: _partielConf, groupId });
      if (alsoCourse && linkedFid) {
        courses.push({ id: uid(), folderId: linkedFid, name });
      }
    }
    saveAll();
    closeModal('modal-partiel');
    if (_pgDetailId) renderPGDetail(); else renderPartiels();
    renderPartielsHomeCard();
    if (alsoCourse && linkedFid) renderMatiere && renderMatiere();
    const count = to - from + 1;
    showNotif(`${count} thème${count > 1 ? 's' : ''} créé${count > 1 ? 's' : ''} !`, 'ok');
    return;
  }

  // ── MODE UNITAIRE ──
  const name = document.getElementById('partiel-name').value.trim();
  if (!name) { showNotif('Donne un nom au thème', 'error'); return; }
  if (_partielEditId) {
    const idx = partiels.findIndex(x => x.id === _partielEditId);
    if (idx >= 0) partiels[idx] = { ...partiels[idx], name, status: _partielStatus, confidence: _partielConf, groupId };
  } else {
    partiels.push({ id: uid(), name, status: _partielStatus, confidence: _partielConf, groupId });
  }
  saveAll();
  closeModal('modal-partiel');
  if (_pgDetailId) renderPGDetail(); else renderPartiels();
  renderPartielsHomeCard();
  showNotif(_partielEditId ? 'Thème mis à jour' : 'Thème ajouté !', 'ok');
}

function deletePartiel() {
  if (!_partielEditId) return;
  partiels = partiels.filter(x => x.id !== _partielEditId);
  saveAll();
  closeModal('modal-partiel');
  if (_pgDetailId) renderPGDetail(); else renderPartiels();
  renderPartielsHomeCard();
  showNotif('Thème supprimé', 'ok');
}

// ── Import (supporte # Matière headers) ──
function importPartiels() {
  const raw = document.getElementById('partiel-import-txt').value;
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) { showNotif('Aucun thème détecté', 'error'); return; }

  let currentGroupId = null;
  let added = 0;

  lines.forEach(line => {
    if (line.startsWith('#')) {
      const gname = line.replace(/^#+\s*/, '').trim();
      if (!gname) return;
      let g = partielGroups.find(x => x.name.toLowerCase() === gname.toLowerCase());
      if (!g) { g = { id: uid(), name: gname }; partielGroups.push(g); }
      currentGroupId = g.id;
    } else {
      if (!partiels.find(p => p.name.toLowerCase() === line.toLowerCase())) {
        partiels.push({ id: uid(), name: line, status: 'todo', confidence: 1, groupId: currentGroupId });
        added++;
      }
    }
  });

  saveAll();
  closeModal('modal-partiel-import');
  document.getElementById('partiel-import-txt').value = '';
  renderPartiels();
  renderPartielsHomeCard();
  showNotif(added + ' thème' + (added > 1 ? 's' : '') + ' importé' + (added > 1 ? 's' : '') + ' !', 'ok');
}

// ── Luminosité ──
window.applyBrightness = function(val){
  val = Math.min(100, Math.max(50, parseInt(val) || 100)); // Max 100% — pas de surbrillance
  localStorage.setItem('kp_brightness', String(val));
  document.documentElement.style.filter = val === 100 ? '' : 'brightness('+val+'%)';
  document.body.style.filter = ''; // s'assurer que body n'a pas de filtre parasite
  const label = document.getElementById('brightness-val');
  if(label) label.textContent = val + '%';
  const slider = document.getElementById('brightness-slider');
  if(slider) slider.value = val;
};
