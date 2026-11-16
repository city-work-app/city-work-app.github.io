// ── features.js — Feature #3 Stats, #7 Heatmap, #5 Brain Dump

// ════════════════════════════════════════════
// FEATURE #3 — SESSION Q STATS (résultats)
// ════════════════════════════════════════════

function formatRelativeDate(ts){
  const diff=Date.now()-ts;const days=Math.floor(diff/86400000);
  if(days===0)return'Aujourd\'hui';if(days===1)return'Hier';
  if(days<7)return`Il y a ${days} jours`;
  return new Date(ts).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
}

function renderSessionQStats(sess){
  const el=document.getElementById('rqstats');
  if(!el){return;}
  if(!sess||!sess.answers||!sess.answers.length||sess.isSurvival||sess.isRetry){el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=`
    <details class="qs-details">
      <summary class="qs-summary">
        <span class="ms" style="font-size:16px;color:var(--primary)">query_stats</span>
        Détail par question
        <span style="font-size:12px;font-weight:500;color:var(--on-sv);margin-left:auto">${sess.answers.length} question${sess.answers.length>1?'s':''}</span>
        <span class="ms qs-arrow" style="font-size:18px;color:var(--on-sv)">expand_more</span>
      </summary>
      <div class="qs-list">
        ${sess.answers.map((ans,idx)=>renderQStatCard(ans,idx)).join('')}
      </div>
    </details>`;
}

function renderQStatCard(ans,idx){
  const q=ans.q;const correct=!!(ans.correct&&!ans.skipped);const skipped=ans.skipped;
  const timeSpent=ans.timeSpent||0;
  const c=courses.find(x=>x.id===q.courseId);
  const qs=getQStats(q.id);
  const resultColor=skipped?'var(--on-sv)':correct?'var(--tertiary)':'var(--error)';
  const resultIcon=skipped?'arrow_forward':correct?'check_circle':'cancel';
  const resultLabel=skipped?'Passée':correct?'Correct':'Incorrect';

  let statsHtml='';
  if(qs&&qs.timesAsked>0){
    const patterns=analyzePattern(qs);
    const pctColor=qs.percentageCorrect>=70?'var(--tertiary)':qs.percentageCorrect>=50?'var(--gold)':'var(--error)';
    statsHtml=`<div class="qs-cumul">
      <div class="qs-cumul-title">Stats cumulées</div>
      <div class="qs-grid">
        <div><span class="qs-lbl">Vu</span><strong>${qs.timesAsked}×</strong></div>
        <div><span class="qs-lbl">Réussi</span><strong style="color:${pctColor}">${qs.timesCorrect}× (${qs.percentageCorrect}%)</strong></div>
        <div><span class="qs-lbl">Streak</span><strong>${qs.streak} | ↑${qs.longestStreak}</strong></div>
        ${qs.avgResponseTime>0?`<div><span class="qs-lbl">Tps moy</span><strong>${qs.avgResponseTime}s</strong></div>`:''}
      </div>
      ${patterns.length?`<div class="qs-patterns">${patterns.map(p=>`<div class="qs-pattern ${p.type}"><span class="ms" style="font-size:11px;vertical-align:middle">${p.type==='ok'?'check_circle':p.type==='warn'?'warning':'info'}</span> ${p.text}</div>`).join('')}</div>`:''}
    </div>`;
  }else{
    statsHtml=`<div class="qs-new"><span class="ms" style="font-size:12px;vertical-align:middle">new_releases</span> Première fois vue</div>`;
  }

  const starId=`qstar-${q.id}-${idx}`;
  return `<div class="qs-card" style="border-left:3px solid ${resultColor}">
    <div class="qs-card-top">
      <div style="flex:1;min-width:0">
        <div class="qs-course">${idx+1}. ${c?c.name:''}</div>
        <div class="qs-question">${q.question.substring(0,100)}${q.question.length>100?'…':''}</div>
      </div>
      <div class="qs-result">
        <span class="ms f" style="font-size:22px;color:${resultColor}">${resultIcon}</span>
        <div style="font-size:10px;color:${resultColor};font-weight:700">${resultLabel}</div>
        ${timeSpent>0?`<div class="qs-time">${timeSpent}s</div>`:''}
      </div>
    </div>
    ${statsHtml}
    <div class="qs-actions">
      <button onclick="toggleStarQ('${q.id}','${idx}')" class="btn-micro${qs&&qs.starred?' active':''}" id="${starId}">
        <span class="ms" style="font-size:12px">${qs&&qs.starred?'star':'star_border'}</span> ${qs&&qs.starred?'Épinglée':'Épingler'}
      </button>
      ${!correct&&!skipped?`<button onclick="markQReview('${q.id}')" class="btn-micro"><span class="ms" style="font-size:12px">bookmark_add</span> À revoir</button>`:''}
    </div>
  </div>`;
}

function toggleStarQ(qid,idx){
  if(!questionStats[qid])questionStats[qid]={qId:qid,timesAsked:0,timesCorrect:0};
  questionStats[qid].starred=!questionStats[qid].starred;
  saveAll();
  const starred=questionStats[qid].starred;
  const btn=document.getElementById(`qstar-${qid}-${idx}`);
  if(btn){btn.className='btn-micro'+(starred?' active':'');btn.innerHTML=`<span class="ms" style="font-size:12px">${starred?'star':'star_border'}</span> ${starred?'Épinglée':'Épingler'}`;}
  showNotif(starred?'Question épinglée ⭐':'Épingle retirée','ok');
}
function markQReview(qid){
  if(!questionStats[qid])questionStats[qid]={qId:qid,timesAsked:0,timesCorrect:0};
  questionStats[qid].markedReview=true;saveAll();
  showNotif('Marquée à revoir ✓','ok');
}

// ════════════════════════════════════════════
// FEATURE #7 — HEATMAP
// ════════════════════════════════════════════

function getMasteryColor(pct){
  if(pct===0)return'#EF4444';if(pct<30)return'#F87171';if(pct<50)return'#FB923C';
  if(pct<70)return'#FBBF24';if(pct<85)return'#A3E635';return'#22C55E';
}
function getMasteryLevel(pct){
  if(pct===0)return'none';if(pct<30)return'poor';if(pct<50)return'fair';
  if(pct<85)return'good';return'excellent';
}
function getMasteryLabel(l){return{none:'Jamais étudié',poor:'À travailler',fair:'En progrès',good:'Bon niveau',excellent:'Excellent'}[l]||'—';}
function getMasteryIcon(l){return{none:'⭕',poor:'🔴',fair:'⚠️',good:'✓',excellent:'✓✓'}[l]||'?';}

function getCourseHeatmapData(){
  return folders.map(f=>{
    const fcs=courses.filter(c=>c.folderId===f.id);
    const allQs=questions.filter(q=>fcs.some(c=>c.id===q.courseId));
    let totalAnswered=0,totalCorrect=0,totalAsked=0,lastStudiedAt=null;
    allQs.forEach(q=>{
      const qs=questionStats[q.id];
      if(qs&&qs.timesAsked>0){totalAnswered++;totalCorrect+=qs.timesCorrect||0;totalAsked+=qs.timesAsked||0;
        if(qs.lastAskedAt&&(!lastStudiedAt||qs.lastAskedAt>lastStudiedAt))lastStudiedAt=qs.lastAskedAt;}
    });
    const pct=totalAsked>0?Math.round(totalCorrect*100/totalAsked):0;
    return{folderId:f.id,folderName:f.name,folderColor:f.color,
      totalQuestions:allQs.length,totalAnswered,totalCorrect,totalAsked,
      percentageCorrect:pct,masteryLevel:getMasteryLevel(pct),color:getMasteryColor(pct),
      lastStudiedAt,daysSinceStudy:lastStudiedAt?Math.floor((Date.now()-lastStudiedAt)/86400000):null};
  });
}

function getFolderEmoji(folderId){
  const f=folders.find(x=>x.id===folderId);if(!f)return'📚';
  const n=f.name.toLowerCase();
  if(n.includes('anato'))return'💀';if(n.includes('physio'))return'❤️';
  if(n.includes('pathol'))return'🦠';if(n.includes('pharma'))return'💊';
  if(n.includes('kin')||n.includes('réédu')||n.includes('rehab'))return'🏃';
  if(n.includes('neuro'))return'🧠';if(n.includes('cardio'))return'❤️';
  if(n.includes('ortho'))return'🦴';if(n.includes('sdrc')||n.includes('douleur'))return'⚡';
  return'📚';
}

let _heatmapSelected=null;

function _genStars(n){
  return Array.from({length:n},()=>{
    const x=(Math.random()*100).toFixed(1),y=(Math.random()*100).toFixed(1);
    const s=Math.random()<0.25?2:1;
    const o=(0.15+Math.random()*0.55).toFixed(2);
    const d=(Math.random()*6).toFixed(1);
    return `<span class="cstar" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;opacity:${o};animation-delay:${d}s"></span>`;
  }).join('');
}

let _hmAngle=0,_hmRAF=null,_hmPaused=false,_hmActiveId=null,_hmOrbData=[];

function hmStop(){if(_hmRAF){cancelAnimationFrame(_hmRAF);_hmRAF=null;}}

function renderHeatmap(){
  const el=document.getElementById('heatmap-content');if(!el)return;
  if(_heatmapSelected){renderHeatmapDetail(_heatmapSelected);return;}
  hmStop();
  const data=getCourseHeatmapData();
  if(!data.length){
    el.innerHTML=`<div class="empty"><div class="eico"><span class="ms" style="font-size:42px">map</span></div><div class="ettl">Aucune matière</div><p style="font-size:14px">Crée des matières pour voir ta carte de maîtrise.</p></div>`;return;
  }
  const N=data.length;
  const rMin=60,rMax=165;
  _hmOrbData=data.map((d,i)=>{
    const r=N===1?rMin:rMin+i*(rMax-rMin)/(N-1);
    const speed=1-(i*0.1);
    const offset=(i*2*Math.PI)/N+(i%2===0?0:Math.PI);
    return{id:d.folderId,rx:r,ry:r*0.65,speed,offset,data:d};
  });
  const rings=_hmOrbData.map(o=>`<div class="hm-orb-ring" style="width:${o.rx*2}px;height:${o.ry*2}px"></div>`).join('');
  const planets=_hmOrbData.map(o=>{
    const d=o.data;
    const emoji=getFolderEmoji(d.folderId);
    const nm=d.folderName.length>10?d.folderName.slice(0,9)+'…':d.folderName;
    const glow=`0 0 14px ${d.color}99,0 0 28px ${d.color}44`;
    return `<div class="hm-node" id="hm-node-${d.folderId}" onclick="hmSelectNode('${d.folderId}')">
      <div class="hm-planet" style="background:radial-gradient(circle at 35% 30%,${d.color}ee,${d.color}55);box-shadow:${glow};border:1px solid ${d.color}66">
        <div class="hm-pl-emoji">${emoji}</div>
        <div class="hm-pl-pct">${d.percentageCorrect}%</div>
      </div>
      <div class="hm-pl-name">${nm}</div>
    </div>`;
  }).join('');
  el.innerHTML=`<div class="hm-orb-wrap">
    <div class="cstar-field">${_genStars(65)}</div>
    <div class="hm-orb-label">MON UNIVERS</div>
    <div class="hm-orb-stage" id="hm-orb-stage">
      ${rings}
      <div class="hm-orb-core"><div class="hm-orb-core-dot"></div><div class="hm-orb-core-ping"></div></div>
      ${planets}
    </div>
    <div class="hm-popup" id="hm-popup" style="display:none"></div>
  </div>`;
  _hmAngle=0;_hmPaused=false;_hmActiveId=null;
  hmAnimate();
}

function hmAnimate(){
  if(!_hmPaused)_hmAngle+=0.007;
  const stage=document.getElementById('hm-orb-stage');
  if(!stage){_hmRAF=null;return;}
  const W=stage.offsetWidth||320,H=stage.offsetHeight||220;
  const cx=W/2,cy=H/2;
  _hmOrbData.forEach(o=>{
    const node=document.getElementById('hm-node-'+o.id);if(!node)return;
    const a=_hmAngle*o.speed+o.offset;
    const x=cx+o.rx*Math.cos(a);
    const y=cy+o.ry*Math.sin(a);
    const depth=(1+Math.sin(a))/2;
    const sc=0.72+0.28*depth;
    node.style.left=x+'px';node.style.top=y+'px';
    node.style.transform=`translate(-50%,-50%) scale(${sc})`;
    node.style.zIndex=Math.round(depth*10)+1;
    node.style.opacity=0.48+0.52*depth;
  });
  _hmRAF=requestAnimationFrame(hmAnimate);
}

function hmSelectNode(folderId){
  _hmPaused=true;_hmActiveId=folderId;
  const data=getCourseHeatmapData();
  const d=data.find(x=>x.folderId===folderId);if(!d)return;
  const popup=document.getElementById('hm-popup');if(!popup)return;
  const last=d.lastStudiedAt?formatRelativeDate(d.lastStudiedAt):'Jamais';
  const err=(d.totalAsked||0)-(d.totalCorrect||0);
  popup.innerHTML=`<div class="hm-pop-card">
    <button class="hm-pop-close" onclick="hmDeselect()">✕</button>
    <div class="hm-pop-top">
      <div class="hm-pop-planet" style="background:radial-gradient(circle at 35% 30%,${d.color}ee,${d.color}55);box-shadow:0 0 20px ${d.color}55">${getFolderEmoji(d.folderId)}</div>
      <div>
        <div class="hm-pop-name">${d.folderName}</div>
        <div class="hm-pop-lvl" style="color:${d.color}">${getMasteryIcon(d.masteryLevel)} ${getMasteryLabel(d.masteryLevel)}</div>
        <div class="hm-pop-last">Étudié ${last.toLowerCase()}</div>
      </div>
    </div>
    <div class="hm-pop-pct" style="color:${d.color}">${d.percentageCorrect}<span>%</span></div>
    <div class="hm-pop-bar-bg"><div class="hm-pop-bar-fill" style="width:${d.percentageCorrect}%;background:${d.color}"></div></div>
    <div class="hm-pop-stats">
      <div class="hm-pst"><div class="hm-pst-n">${d.totalAnswered}</div><div class="hm-pst-l">vues</div></div>
      <div class="hm-pst"><div class="hm-pst-n" style="color:#4ade80">${d.totalCorrect||0}</div><div class="hm-pst-l">réussies</div></div>
      <div class="hm-pst"><div class="hm-pst-n" style="color:#f87171">${err}</div><div class="hm-pst-l">échouées</div></div>
    </div>
    <div class="hm-pop-btns">
      <button class="btn btn-p" style="flex:1;justify-content:center" onclick="startHeatmapQCM('${d.folderId}')"><span class="ms" style="font-size:15px">play_arrow</span> QCM</button>
      <button class="btn btn-g" style="flex:1;justify-content:center" onclick="hmDeselect();selectHeatmapCourse('${d.folderId}')">Détail →</button>
    </div>
  </div>`;
  popup.style.display='block';
}

function hmDeselect(){
  _hmPaused=false;_hmActiveId=null;
  const p=document.getElementById('hm-popup');if(p)p.style.display='none';
}

function selectHeatmapCourse(folderId){
  const data=getCourseHeatmapData();
  _heatmapSelected=data.find(d=>d.folderId===folderId)||null;
  renderHeatmap();
}

function renderHeatmapDetail(d){
  const el=document.getElementById('heatmap-content');if(!el)return;
  const fcs=courses.filter(c=>c.folderId===d.folderId);
  const allQs=questions.filter(q=>fcs.some(c=>c.id===q.courseId));
  const qsWithStats=allQs.filter(q=>questionStats[q.id]&&questionStats[q.id].timesAsked>0)
    .map(q=>({q,qs:questionStats[q.id]})).sort((a,b)=>b.qs.percentageCorrect-a.qs.percentageCorrect);
  const strong=qsWithStats.filter(x=>x.qs.percentageCorrect>=80).slice(0,3);
  const weak=qsWithStats.filter(x=>x.qs.percentageCorrect<50).sort((a,b)=>a.qs.percentageCorrect-b.qs.percentageCorrect).slice(0,3);
  const lastStudied=d.lastStudiedAt?formatRelativeDate(d.lastStudiedAt):'Jamais';
  const notStudied=d.totalQuestions-d.totalAnswered;

  el.innerHTML=`
    <button onclick="_heatmapSelected=null;renderHeatmap()" class="btn btn-sm btn-g" style="margin-bottom:16px">← Carte</button>
    <div class="hm-hero" style="background:linear-gradient(145deg,#060b18,#0f1828);box-shadow:0 0 40px ${d.color}22,0 8px 32px rgba(0,0,0,.5)">
      <div class="cstar-field">${_genStars(35)}</div>
      <div class="hm-hero-inner">
        <div class="hm-hero-circle" style="background:radial-gradient(circle at 35% 30%,${d.color}ee,${d.color}66);box-shadow:0 0 32px ${d.color}80,0 0 64px ${d.color}30">
          <span style="font-size:28px">${getFolderEmoji(d.folderId)}</span>
        </div>
        <div class="hm-hero-info">
          <div class="hm-hero-name">${d.folderName}</div>
          <div class="hm-hero-level" style="color:${d.color}">${getMasteryIcon(d.masteryLevel)} ${getMasteryLabel(d.masteryLevel)}</div>
          <div class="hm-hero-last">Étudié ${lastStudied.toLowerCase()}</div>
        </div>
        <div class="hm-hero-score" style="color:${d.color}">${d.percentageCorrect}<span style="font-size:20px;font-weight:600">%</span></div>
      </div>
      <div class="hm-arc-wrap">
        <div class="hm-arc-bar"><div class="hm-arc-fill" style="width:${d.percentageCorrect}%;background:linear-gradient(90deg,${d.color}88,${d.color})"></div></div>
      </div>
      <div class="hm-hero-stats">
        <div class="hm-hstat"><div class="hm-hstat-n">${d.totalAnswered}</div><div class="hm-hstat-l">vues</div></div>
        <div class="hm-hstat-div"></div>
        <div class="hm-hstat"><div class="hm-hstat-n" style="color:#4ade80">${d.totalCorrect}</div><div class="hm-hstat-l">réussies</div></div>
        <div class="hm-hstat-div"></div>
        <div class="hm-hstat"><div class="hm-hstat-n" style="color:#f87171">${d.totalAsked-d.totalCorrect}</div><div class="hm-hstat-l">échouées</div></div>
        ${notStudied>0?`<div class="hm-hstat-div"></div><div class="hm-hstat"><div class="hm-hstat-n" style="color:#94a3b8">${notStudied}</div><div class="hm-hstat-l">jamais vues</div></div>`:``}
      </div>
    </div>
    ${strong.length?`<span class="sl">Points forts ✓</span>
      <div class="hm-qlist">${strong.map(x=>`<div class="hm-qrow ok"><span class="ms f" style="font-size:15px;color:var(--tertiary);flex-shrink:0">check_circle</span><div style="flex:1;font-size:13px;font-weight:600;line-height:1.35">${x.q.question.substring(0,65)}${x.q.question.length>65?'…':''}</div><span class="hm-qpct" style="color:var(--tertiary)">${x.qs.percentageCorrect}%</span></div>`).join('')}</div>`:''}
    ${weak.length?`<span class="sl">À travailler ⚡</span>
      <div class="hm-qlist">${weak.map(x=>`<div class="hm-qrow ko"><span class="ms f" style="font-size:15px;color:var(--error);flex-shrink:0">cancel</span><div style="flex:1;font-size:13px;font-weight:600;line-height:1.35">${x.q.question.substring(0,65)}${x.q.question.length>65?'…':''}</div><span class="hm-qpct" style="color:var(--error)">${x.qs.percentageCorrect}%</span></div>`).join('')}</div>`:''}
    <button class="btn btn-p" style="width:100%;justify-content:center;margin-top:12px" onclick="startHeatmapQCM('${d.folderId}')"><span class="ms" style="font-size:15px">play_arrow</span> Lancer QCM</button>`;
}

function startHeatmapQCM(folderId){
  _heatmapSelected=null;
  const fcs=courses.filter(c=>c.folderId===folderId);
  const qs=questions.filter(q=>fcs.some(c=>c.id===q.courseId)&&!isBoycotted(q.id));
  if(!qs.length){showNotif('Aucune question disponible.','err');return;}
  const f=folders.find(x=>x.id===folderId);
  rBack='heatmap';launchS(shuffle(qs),f?f.name:'Matière',false,false,false);
}

// ════════════════════════════════════════════
// FEATURE #5 — BRAIN DUMP
// ════════════════════════════════════════════

let _bdCourseId=null;
let _bdTimerInterval=null;
let _bdTimeLeft=300;
let _bdActive=false;
let _bdResult=null;
let _bdFound=[];
let _bdAbandoned=false;

function openBrainDump(){
  _bdCourseId=curC;_bdTimeLeft=300;_bdActive=false;_bdResult=null;
  _bdFound=[];_bdAbandoned=false;
  clearInterval(_bdTimerInterval);
  showScreen('braindump');
}

function renderBrainDump(){
  if(_bdResult){renderBrainDumpResults(_bdResult);return;}
  const c=courses.find(x=>x.id===_bdCourseId);
  const el=document.getElementById('braindump-content');if(!el)return;
  const kc=getKeyConceptsForCourse(_bdCourseId);
  const total=kc.length;
  const remaining=total-_bdFound.length;
  const progress=total>0?(_bdFound.length/total)*100:0;

  el.innerHTML=`
    <div class="bd-hd">
      <div class="bd-theme-title">${c?c.name:'Ce cours'}</div>
      ${_bdActive&&total>0?`
        <div class="bd-prog-wrap">
          <div class="bd-prog-fill" id="bd-prog-fill" style="width:${progress}%"></div>
        </div>
        <div class="bd-counter" id="bd-counter">${remaining} / ${total} mots restants</div>
      `:''}
      <div class="bd-timer" id="bd-timer">${formatTime(_bdTimeLeft)}</div>
    </div>
    ${!_bdActive?`
      <div class="bd-start-block">
        <button class="btn btn-p" style="font-size:16px;padding:14px 32px" onclick="startBrainDump()"><span class="ms" style="font-size:18px">play_arrow</span> Démarrer</button>
        ${!kc.length?`<div class="bd-warn"><span class="ms" style="font-size:14px;vertical-align:middle">warning</span> Aucun concept clé défini. <button onclick="openKeyConceptsManager()" style="background:none;border:none;padding:0;color:var(--primary);font-weight:700;font-size:inherit;cursor:pointer;text-decoration:underline">Ajouter des concepts clés</button> pour activer l'analyse automatique.</div>`:
        `<div class="bd-info">${total} concept${total>1?'s':''} à retrouver · <button onclick="openKeyConceptsManager()" style="background:none;border:none;padding:0;color:var(--primary);font-weight:600;font-size:inherit;cursor:pointer;text-decoration:underline">Modifier</button></div>`}
      </div>
    `:`
      <input class="fi bd-main-input" id="bd-word-input"
        type="text" placeholder="Tape un concept…"
        oninput="checkBdInput(this.value)"
        autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">
      <div class="bd-cloud" id="bd-cloud">
        ${_bdFound.map(w=>`<span class="bd-chip bd-found">${w}</span>`).join('')}
      </div>
      <div class="bd-game-actions">
        ${!_bdAbandoned?`<button class="btn btn-g" onclick="abandonBrainDump()"><span class="ms" style="font-size:15px">flag</span> Abandonner</button>`:''}
        <button class="btn btn-p" style="flex:1;justify-content:center" onclick="submitBrainDump()"><span class="ms" style="font-size:15px">send</span> Terminer</button>
      </div>
    `}`;
  if(_bdActive)setTimeout(()=>{const i=document.getElementById('bd-word-input');if(i)i.focus();},80);
}

function startBrainDump(){
  _bdActive=true;_bdTimeLeft=300;_bdFound=[];_bdAbandoned=false;
  clearInterval(_bdTimerInterval);
  _bdTimerInterval=setInterval(()=>{
    _bdTimeLeft--;
    const t=document.getElementById('bd-timer');if(t)t.textContent=formatTime(_bdTimeLeft);
    if(_bdTimeLeft<=0){clearInterval(_bdTimerInterval);submitBrainDump();}
  },1000);
  renderBrainDump();
}

function checkBdInput(val){
  const kc=getKeyConceptsForCourse(_bdCourseId);
  const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const normVal=norm(val.trim());
  if(!normVal)return;
  for(const concept of kc){
    if(_bdFound.includes(concept.name))continue;
    if(norm(concept.name)===normVal||(concept.aliases||[]).some(a=>norm(a)===normVal)){
      _bdFound.push(concept.name);
      bdSuccessEffect();
      const inp=document.getElementById('bd-word-input');if(inp)inp.value='';
      addBdChip(concept.name,false);
      updateBdProgress();
      if(_bdFound.length>=kc.length){clearInterval(_bdTimerInterval);setTimeout(()=>submitBrainDump(),500);}
      return;
    }
  }
}

function addBdChip(name,missed){
  const cloud=document.getElementById('bd-cloud');if(!cloud)return;
  const chip=document.createElement('span');
  chip.className='bd-chip '+(missed?'bd-missed':'bd-found');
  chip.textContent=name;
  chip.style.opacity='0';chip.style.transform='scale(0.7)';
  cloud.appendChild(chip);
  requestAnimationFrame(()=>{
    chip.style.transition='opacity 80ms ease, transform 80ms ease';
    chip.style.opacity='1';chip.style.transform='scale(1)';
  });
}

function updateBdProgress(){
  const kc=getKeyConceptsForCourse(_bdCourseId);
  const total=kc.length;if(!total)return;
  const found=_bdFound.length;
  const bar=document.getElementById('bd-prog-fill');
  if(bar)bar.style.width=Math.round(found/total*100)+'%';
  const counter=document.getElementById('bd-counter');
  if(counter)counter.textContent=(total-found)+' / '+total+' mots restants';
}

function bdSuccessEffect(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.value=880;osc.type='sine';
    gain.gain.setValueAtTime(0.2,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12);
    osc.start();osc.stop(ctx.currentTime+0.12);
  }catch(e){}
  if(navigator.vibrate)navigator.vibrate(35);
}

function abandonBrainDump(){
  _bdAbandoned=true;
  clearInterval(_bdTimerInterval);
  const kc=getKeyConceptsForCourse(_bdCourseId);
  kc.filter(k=>!_bdFound.includes(k.name)).forEach(k=>addBdChip(k.name,true));
  const inp=document.getElementById('bd-word-input');
  if(inp){inp.disabled=true;inp.placeholder='Session terminée';}
  const actEl=document.querySelector('.bd-game-actions');
  if(actEl)actEl.innerHTML=`<button class="btn btn-p" style="flex:1;justify-content:center" onclick="submitBrainDump()"><span class="ms" style="font-size:15px">send</span> Terminer</button>`;
}

function submitBrainDump(){
  clearInterval(_bdTimerInterval);
  const kc=getKeyConceptsForCourse(_bdCourseId);
  const elapsed=300-_bdTimeLeft;
  const missed=kc.filter(k=>!_bdFound.includes(k.name)).map(k=>k.name);
  const score=kc.length>0?Math.round(_bdFound.length*100/kc.length):null;
  const result={id:uid(),courseId:_bdCourseId,createdAt:Date.now(),
    durationSeconds:elapsed,userInput:'',wordCount:_bdFound.length,
    foundConcepts:[..._bdFound],missedConcepts:missed,
    foundCount:_bdFound.length,totalExpectedConcepts:kc.length,score,wordsPerMinute:0};
  _bdResult=result;_bdActive=false;
  saveBrainDump(result);
  renderBrainDumpResults(result);
}

function renderBrainDumpResults(result){
  const el=document.getElementById('braindump-content');if(!el)return;
  const scoreColor=result.score===null?'var(--on-sv)':result.score>=80?'var(--tertiary)':result.score>=50?'var(--gold)':'var(--error)';
  const scoreMsg=result.score===null?'Analyse non disponible (aucun concept clé défini).':
    result.score>=80?'Excellent ! Tu as bien retenu l\'essentiel !':
    result.score>=50?'Pas mal ! Quelques lacunes à combler.':'Il faut vraiment revoir ce cours !';

  el.innerHTML=`
    <div class="bd-result-header">
      ${result.score!==null?`<div class="bd-result-score" style="color:${scoreColor}">${result.score}%</div>
        <div class="bd-result-sub">${result.foundCount}/${result.totalExpectedConcepts} concepts trouvés</div>`
        :`<div class="bd-result-score" style="font-size:32px">✓</div><div class="bd-result-sub">Brain Dump terminé</div>`}
      <div class="bd-result-msg">${scoreMsg}</div>
    </div>
    ${result.foundConcepts.length?`<span class="sl" style="color:var(--tertiary)">✓ Bien retenu (${result.foundConcepts.length})</span>
      <div class="bd-concept-list">
        ${result.foundConcepts.map(c=>`<div class="bd-concept ok"><span class="ms f" style="font-size:16px;color:var(--tertiary)">check_circle</span>${c}</div>`).join('')}
      </div>`:''}
    ${result.missedConcepts.length?`<span class="sl" style="color:var(--error)">❌ Manquants (${result.missedConcepts.length})</span>
      <div class="bd-concept-list">
        ${result.missedConcepts.map(c=>`<div class="bd-concept miss"><span class="ms f" style="font-size:16px;color:var(--error)">cancel</span>${c}</div>`).join('')}
      </div>`:''}
    <div class="bd-insights">
      <div class="bd-insights-title"><span class="ms" style="font-size:14px;vertical-align:middle">insights</span> Insights</div>
      <div class="bd-insights-row"><span class="ms" style="font-size:13px;vertical-align:middle">edit_note</span> <strong>${result.wordCount}</strong> mots en ${Math.round(result.durationSeconds/60)||1} min</div>
      ${result.wordsPerMinute>0?`<div class="bd-insights-row"><span class="ms" style="font-size:13px;vertical-align:middle">speed</span> Vitesse : <strong>${result.wordsPerMinute} mots/min</strong></div>`:''}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
      ${result.missedConcepts.length?`<button class="btn btn-p" style="justify-content:center" onclick="launchBrainDumpQCM()"><span class="ms" style="font-size:15px">quiz</span> Réviser les manquants</button>`:''}
      <button class="btn btn-g" style="justify-content:center" onclick="_bdResult=null;_bdTimeLeft=300;_bdActive=false;_bdFound=[];_bdAbandoned=false;clearInterval(_bdTimerInterval);renderBrainDump()"><span class="ms" style="font-size:15px">replay</span> Recommencer</button>
      <button class="btn btn-g" style="justify-content:center" onclick="backFromBrainDump()"><span class="ms" style="font-size:15px">arrow_back</span> Retour au cours</button>
    </div>`;
}

function backFromBrainDump(){
  _bdResult=null;_bdActive=false;_bdFound=[];_bdAbandoned=false;clearInterval(_bdTimerInterval);showScreen('course');
}

function launchBrainDumpQCM(){
  if(!_bdResult)return;
  const qs=questions.filter(q=>q.courseId===_bdResult.courseId&&!isBoycotted(q.id));
  if(!qs.length){showNotif('Aucune question pour ce cours.','err');return;}
  _bdResult=null;rBack='course';launchS(shuffle(qs),'Brain Dump — Révision',false,false,false);
}

// ── Key Concepts Manager ──
function openKeyConceptsManager(){
  const kc=getKeyConceptsForCourse(_bdCourseId);
  const c=courses.find(x=>x.id===_bdCourseId);
  document.getElementById('kc-title').textContent=c?`Concepts — ${c.name}`:'Concepts clés';
  renderKCList(kc);openModal('modal-kc');
}

function renderKCList(kc){
  const el=document.getElementById('kc-list');if(!el)return;
  if(!kc.length){el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--on-sv);font-size:13px">Aucun concept encore. Ajoutes-en ci-dessous !</div>`;return;}
  el.innerHTML=kc.map((concept,idx)=>`<div class="kc-row">
    <div style="flex:1"><div style="font-size:13px;font-weight:700">${concept.name}</div>
    ${concept.aliases&&concept.aliases.length?`<div style="font-size:11px;color:var(--on-sv)">${concept.aliases.join(', ')}</div>`:''}</div>
    <button onclick="removeKeyConcept(${idx})" class="bico del"><span class="ms" style="font-size:15px">delete</span></button>
  </div>`).join('');
}

function _splitKCLine(str){
  const parts=[];let depth=0,start=0;
  for(let i=0;i<str.length;i++){
    if(str[i]==='(')depth++;
    else if(str[i]===')')depth--;
    else if(str[i]===','&&depth===0){parts.push(str.slice(start,i));start=i+1;}
  }
  parts.push(str.slice(start));
  return parts;
}
function _parseKCEntry(raw){
  const s=raw.trim();
  const m=s.match(/^([^(]+?)(?:\s*\(([^)]+)\))?\s*$/);
  if(!m)return{name:s,aliases:[]};
  return{name:m[1].trim(),aliases:m[2]?m[2].split(',').map(a=>a.trim()).filter(Boolean):[]};
}
function addKeyConceptsFromList(){
  const el=document.getElementById('kc-bulk-input');if(!el)return;
  const entries=el.value.split('\n').flatMap(line=>_splitKCLine(line))
    .map(_parseKCEntry).filter(e=>e.name);
  if(!entries.length){showNotif('Entre au moins un concept.','err');return;}
  const kc=getKeyConceptsForCourse(_bdCourseId);
  let added=0;
  entries.forEach(({name,aliases})=>{
    if(!kc.find(k=>k.name.toLowerCase()===name.toLowerCase())){
      kc.push({name,aliases,importance:'high'});added++;
    }
  });
  setKeyConceptsForCourse(_bdCourseId,kc);
  el.value='';
  renderKCList(kc);
  showNotif(added?`${added} concept${added>1?'s':''} ajouté${added>1?'s':''} !`:'Déjà tous présents.',added?'ok':'err');
}

function removeKeyConcept(idx){
  const kc=getKeyConceptsForCourse(_bdCourseId);kc.splice(idx,1);
  setKeyConceptsForCourse(_bdCourseId,kc);renderKCList(kc);
}

function closeKCModal(){closeModal('modal-kc');renderBrainDump();}
