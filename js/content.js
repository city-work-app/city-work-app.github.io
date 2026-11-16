// ── content.js — navigation, folders, courses, subfolders, import/parseQCM

// Sauvegarde automatique de la session avant rechargement/fermeture
window.addEventListener('beforeunload', function(){
  if(typeof session!=='undefined' && session && session.qs && session.qs.length > 0 && session.cur > 0){
    try{ saveAll(); saveResumeSession(); }catch(e){}
  }
});

// Migration : marquer les anciens dossiers importés PDF comme isAnnale
(function migratePdfFolders(){
  if(typeof folders==='undefined')return;
  let changed=false;
  folders.forEach(function(f){
    if(!f.isAnnale && f.icon==='📄' && f.color==='#5B8DEF'){
      f.isAnnale=true;changed=true;
    }
  });
  if(changed&&typeof saveAll==='function')saveAll();
})();

// ════════════════════════════════════════════
// NAV
// ════════════════════════════════════════════
let curF=null,curC=null,curSF=null,rBack='home';
let _folderSortMode=localStorage.getItem('kp-f-sort')||'manual';
let _folderSubSortMode=localStorage.getItem('kp-sf-sort')||'manual';
let _subFolderCourseSortMode=localStorage.getItem('kp-sfc-sort')||'manual';
let _renameFId=null,_renameSFId=null;
let _dndId=null;

function setFolderSort(mode){_folderSortMode=mode;localStorage.setItem('kp-f-sort',mode);renderHome();}

// ── Drag & drop helpers ──
function _dndStart(e,id){_dndId=id;e.dataTransfer.effectAllowed='move';e.currentTarget.classList.add('dnd-dragging');}
function _dndEnd(e){e.currentTarget.classList.remove('dnd-dragging');}
function _dndOver(e){e.preventDefault();e.currentTarget.classList.add('dnd-over');}
function _dndLeave(e){e.currentTarget.classList.remove('dnd-over');}
function _dndDropFolders(e,tgtId){
  e.preventDefault();e.currentTarget.classList.remove('dnd-over');
  if(!_dndId||_dndId===tgtId)return;
  const si=folders.findIndex(x=>x.id===_dndId),ti=folders.findIndex(x=>x.id===tgtId);
  if(si<0||ti<0)return;
  const [item]=folders.splice(si,1);folders.splice(ti,0,item);
  saveAll();renderHome();
}
function _dndDropSF(e,tgtId){
  e.preventDefault();e.currentTarget.classList.remove('dnd-over');
  if(!_dndId||_dndId===tgtId)return;
  const si=subFolders.findIndex(x=>x.id===_dndId),ti=subFolders.findIndex(x=>x.id===tgtId);
  if(si<0||ti<0)return;
  const [item]=subFolders.splice(si,1);subFolders.splice(ti,0,item);
  saveAll();renderMatiere();
}
function _dndDropCourse(e,tgtId,screen){
  e.preventDefault();e.currentTarget.classList.remove('dnd-over');
  if(!_dndId||_dndId===tgtId)return;
  const si=courses.findIndex(x=>x.id===_dndId),ti=courses.findIndex(x=>x.id===tgtId);
  if(si<0||ti<0)return;
  const [item]=courses.splice(si,1);courses.splice(ti,0,item);
  saveAll();screen==='sub'?renderSubFolder():renderMatiere();
}

function applyImportExisting(){
  const text=document.getElementById('import-existing-txt').value;
  if(!text.trim()){showNotif('Le texte est vide.','err');return;}
  const p=parseQCM(text);
  if(!p.length){showNotif('Aucune question détectée.','err');return;}
  showConfirm(`Remplacer les ${questions.filter(q=>q.courseId===curC).length} questions existantes ?`,`Elles seront remplacées par les ${p.length} questions du texte modifié.`,'Remplacer',()=>{
    questions=questions.filter(q=>q.courseId!==curC);
    p.forEach(q=>questions.push({id:uid(),courseId:curC,question:q.question,answers:q.answers,correct:q.correct,expl:q.expl||''}));
    saveAll();closeModal('modal-import');renderCourse();
    showNotif(`${p.length} question${p.length>1?'s':''} mises à jour !`,'ok');
  });
}

// ── Toggle topbar buttons : 1er clic → écran, 2ème clic → accueil ──
function _tbToggle(targetScreen, altScreen){
  const cur=document.body.dataset.screen;
  if(cur===targetScreen||(altScreen&&cur===altScreen)){
    showScreen('home');
  } else {
    if(targetScreen==='profil-hub'){
      showScreen('profil-hub');
    } else if(targetScreen==='stats'){
      curF=null;window._statsReturnScreen=null;showScreen('stats');
    } else {
      showScreen(targetScreen);
    }
  }
}

// ── Profondeur de navigation (transitions directionnelles)
const _screenDepths={home:0,house:0,city:0,agenda:0,social:0,annales:0,concepts:0,profil:0,stats:0,manage:0,prompts:0,heatmap:0,plan:0,braindump:0,partiels:0,imaging:0,mindmap:0,diagram:0,friends:0,audio:0,'audio-folder':1,'matieres-hub':0,'matiere-options':1,matiere:1,subfolder:2,course:3,'mindmap-editor':1,'diagram-editor':1,'friend-profile':1,quiz:4,results:4,fiche:4,'concept-fc':4,'imaging-session':4,match:4};
let _navDepth=0;
window._navHistory=[];
window._navGoingBack=false;
function goBack(){
  window._navGoingBack=true;
  if(window._navHistory.length>1){window._navHistory.pop();showScreen(window._navHistory[window._navHistory.length-1]);}
  else{showScreen('home');}
  window._navGoingBack=false;
}

// ── Confirm modal générique
let _mcCallback=null;
function showConfirm(title,body,confirmLabel,onConfirm,opts={}){
  const danger=opts.danger!==false;
  const icon=opts.icon||(danger?'delete':'check_circle');
  _mcCallback=onConfirm;
  document.getElementById('mc-title').textContent=title;
  document.getElementById('mc-body').textContent=body;
  const wrap=document.getElementById('mc-icon-wrap');
  const iconEl=document.getElementById('mc-icon');
  const btn=document.getElementById('mc-confirm-btn');
  wrap.style.background=danger?'var(--error-c)':'rgba(124,58,237,.1)';
  iconEl.textContent=icon;
  iconEl.style.color=danger?'var(--error)':'var(--primary)';
  btn.textContent=confirmLabel;
  if(danger){btn.style.cssText='justify-content:center;width:100%;padding:14px 20px;font-size:15px;font-weight:700;background:var(--error);color:#fff;border-color:transparent;border-radius:var(--r-full)';}
  else{btn.style.cssText='justify-content:center;width:100%;padding:14px 20px;font-size:15px;font-weight:700;background:var(--primary);color:#fff;border-color:transparent;border-radius:var(--r-full)';}
  openModal('modal-confirm');
}
function _mcConfirm(){closeModal('modal-confirm');if(_mcCallback){_mcCallback();_mcCallback=null;}}
function showScreen(id){
  // 15 nov. 2026 : « Statistiques » et « Profil & Stats » ne font plus qu'une page (#screen-profil)
  let _toStats=false;
  if(id==='stats'){id='profil';_toStats=true;}
  // Pause/resume quiz timer when leaving/entering the quiz screen
  if(id!=='quiz'&&timerInterval&&session&&session.qs){
    // Leaving quiz — pause timer
    clearInterval(timerInterval);timerInterval=null;
    window._quizPausedElapsed=Math.floor((Date.now()-sessionStart)/1000);
    const tb=document.getElementById('topbar-timer');
    if(tb){const tStr=formatTime(window._quizPausedElapsed);tb.style.display='block';tb.innerHTML=`<span style="font-size:12px;font-weight:700;color:var(--on-sv);padding:3px 9px;background:var(--surf-low);border-radius:var(--r-full)"><span class="ms" style="font-size:12px;vertical-align:middle">timer</span> ${tStr}</span>`;}
  } else if(id==='quiz'&&!timerInterval&&session&&session.qs){
    // Returning to quiz — resume timer
    const elapsed=window._quizPausedElapsed||0;
    sessionStart=Date.now()-elapsed*1000;
    timerInterval=setInterval(()=>{
      const e=Math.floor((Date.now()-sessionStart)/1000);
      const tStr=formatTime(e);
      const te=document.getElementById('quiz-timer');if(te){te.textContent=tStr;te.className='quiz-timer-live'+(e>1800?' warn':'');}
      const tb=document.getElementById('topbar-timer');if(tb){tb.style.display='block';tb.innerHTML=`<span style="font-size:12px;font-weight:700;color:var(--on-sv);padding:3px 9px;background:var(--surf-low);border-radius:var(--r-full)"><span class="ms" style="font-size:12px;vertical-align:middle">timer</span> ${tStr}</span>`;}
    },1000);
  }
  // Reset course select mode when leaving matiere/subfolder
  if(id!=='matiere'&&id!=='subfolder'&&(_courseSelectMode||_selectedCourses.size>0)){
    _courseSelectMode=false;_selectedCourses.clear();
  }
  const newDepth=_screenDepths[id]??1;
  const dir=newDepth>_navDepth?'forward':newDepth<_navDepth?'back':'none';
  _navDepth=newDepth;
  if(!window._navGoingBack&&window._navHistory[window._navHistory.length-1]!==id){window._navHistory.push(id);if(window._navHistory.length>30)window._navHistory.shift();}
  document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active','slide-forward','slide-back');s.style.display='none';});
  const screenEl=document.getElementById('screen-'+id);
  if(screenEl){
    screenEl.classList.add('active');
    if(dir==='forward')screenEl.classList.add('slide-forward');
    else if(dir==='back')screenEl.classList.add('slide-back');
    screenEl.style.display='block';
  }
  document.body.dataset.screen=id;
  // Update desktop left nav active state
  document.querySelectorAll('.dl-nav a[data-nav]').forEach(a=>a.classList.toggle('dl-active',a.dataset.nav===id));
  setTimeout(updateQuizIndicator,30);
  window.scrollTo(0,0);
  if(id==='home'){renderHome();if(typeof renderDesktopSidebar==='function')renderDesktopSidebar();}
  if(id==='annales'){renderAnnales();setAnnalesMode(true);}
  if(id==='home'){setAnnalesMode(false);}
  if(id==='matiere')renderMatiere();
  if(id==='subfolder')renderSubFolder();
  if(id==='course')renderCourse();
  if(id==='manage'){renderManage();setTimeout(_initMgSettings,0);}
  if(id==='profil'){renderProfil();renderStats();if(_toStats)setTimeout(()=>{const a=document.getElementById('stats-anchor');if(a)a.scrollIntoView({block:'start',behavior:'smooth'});},120);}
  if(id==='concepts')renderConcepts();
  if(id==='heatmap')renderHeatmap();
  if(id==='plan')renderPlan();
  if(id==='braindump')renderBrainDump();
  if(id==='prompts')renderPrompts();
  if(id==='fiche')renderFiche();
  if(id==='partiels')renderPartiels();
  if(id==='annales-hub')renderAnnalesHub();
  if(id==='all-flashcards'){_afcSearchOpen=false;const b=document.getElementById('afc-search-bar');if(b)b.style.display='none';renderAFCList();}
  if(id==='mindmap'&&typeof renderMindMapHub==='function')renderMindMapHub();
  if(id!=='mindmap-editor'&&typeof kmapSleep==='function')kmapSleep();
  if(id==='diagram'&&typeof renderDiagramHub==='function')renderDiagramHub();
  if(id==='friends'&&typeof renderFriends==='function')renderFriends();
  if(id==='house'&&typeof renderHouse==='function')renderHouse();
  else if(typeof houseSleep==='function')houseSleep();
  if(id==='city'&&typeof renderCity==='function')renderCity();
  else if(typeof citySleep==='function')citySleep();
  if(id==='agenda'&&typeof renderAgenda==='function')renderAgenda();
  if(id==='social'&&typeof renderSocial==='function')renderSocial();
  if(id!=='quiz'&&typeof _gamShowPendingLevelUp==='function')setTimeout(_gamShowPendingLevelUp,400);
}
function setAnnalesMode(on){
  document.body.classList.toggle('annales-mode',on);
}
function switchTab(tab){
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  const el=document.getElementById('nav-'+tab);if(el)el.classList.add('active');
  if(tab!=='annales')setAnnalesMode(false);
  showScreen(tab);
  document.querySelectorAll('.dl-nav a[data-nav]').forEach(a=>a.classList.toggle('dl-active',a.dataset.nav===tab));
}

// ════════════════════════════════════════════
// SESSION RESUME (sessionStorage)
// ════════════════════════════════════════════
function saveResumeSession(){
  if(!session||!session.qs||!session.qs.length)return;
  try{
    // Filtrer les réponses null avant sérialisation
    const safeAnswers=(session.answers||[]).filter(a=>a&&a.q).map(a=>({
      qid:a.q.id,chosenIdx:a.chosenIdx,correct:a.correct,skipped:a.skipped,timeSpent:a.timeSpent
    }));
    // Trouver le nom du cours/mode pour affichage
    const firstQ=session.qs[session.cur]||session.qs[0];
    const course=firstQ?(courses||[]).find(c=>c.id===firstQ.courseId):null;
    const label=course?course.name:(session.mode||'Quiz');
    const folder=course?(folders||[]).find(f=>f.id===course.folderId):null;
    const folderName=folder?folder.name:'';
    localStorage.setItem('kcu_resume',JSON.stringify({
      courseId:curC,label,folderName,savedAt:Date.now(),
      qids:session.qs.map(q=>q.id),cur:session.cur,correct:session.correct,
      mode:session.mode,isFlash:session.isFlash,isRetry:session.isRetry,
      isHard:session.isHard,isSurvival:session.isSurvival,isAnnales:session.isAnnales,
      lives:session.lives,survivalStreak:session.survivalStreak||0,sessionStart,rBack,
      answers:safeAnswers
    }));
  }catch(e){console.warn('saveResumeSession',e);}
}
function clearResumeSession(){try{localStorage.removeItem('kcu_resume');}catch(e){}}
function checkResumeSession(){
  try{
    const saved=localStorage.getItem('kcu_resume');if(!saved)return;
    const data=JSON.parse(saved);
    if(!data||!data.qids||!data.qids.length){clearResumeSession();return;}
    // Ignorer les sessions sans timestamp, de plus de 12h, ou sans progression réelle
    if(!data.savedAt || Date.now()-data.savedAt > 12*60*60*1000){clearResumeSession();return;}
    if(!data.cur || data.cur < 1){clearResumeSession();return;}
    // Vérifier que les questions existent encore dans les données actuelles
    const validQ=(questions||[]).filter(q=>data.qids.includes(q.id));
    if(validQ.length===0){clearResumeSession();return;}
    // Ne pas afficher le banner si une session est déjà active en mémoire
    if(typeof session!=='undefined'&&session&&session.qs&&session.qs.length>0)return;
    const banner=document.getElementById('resume-banner');if(!banner)return;
    banner.style.display='flex';
    // Remplir les éléments du banner
    const remaining=data.qids.length-data.cur;
    const pct=data.qids.length?Math.round((data.cur/data.qids.length)*100):0;
    const title=document.getElementById('rh-title');
    const desc=document.getElementById('rh-desc');
    const rem=document.getElementById('rh-remaining');
    const mins=document.getElementById('rh-mins');
    const prog=document.getElementById('rh-progress');
    // Retrouver le label depuis les questions si absent
    let displayLabel=data.label||data.mode||'';
    if(!displayLabel && data.qids && data.qids.length){
      const firstQ=(questions||[]).find(q=>q.id===data.qids[0]);
      const c=firstQ?(courses||[]).find(x=>x.id===firstQ.courseId):null;
      displayLabel=c?c.name:'Session';
    }
    if(title) title.textContent=displayLabel||'Session';
    if(desc) desc.textContent=data.folderName||'';
    if(rem) rem.textContent=`${remaining} question${remaining>1?'s':''} restante${remaining>1?'s':''}`;
    if(mins) mins.textContent=`${data.cur} répondue${data.cur>1?'s':''}`;
    if(prog) prog.textContent=`${pct}%`;
  }catch(e){console.warn('checkResumeSession',e);}
}
function resumeSession(){
  const saved=localStorage.getItem('kcu_resume');
  if(!saved){showNotif('Aucune session sauvegardée','');return;}
  let data;
  try{ data=JSON.parse(saved); }catch(e){clearResumeSession();showNotif('Session corrompue','');return;}
  // Si une session est déjà active en mémoire, juste reprendre celle-là
  if(typeof session!=='undefined'&&session&&session.qs&&session.qs.length>0){
    const b=document.getElementById('resume-banner');if(b)b.style.display='none';
    showScreen('quiz');renderQ();return;
  }
  const qs=(data.qids||[]).map(id=>(questions||[]).find(q=>q.id===id)).filter(Boolean);
  if(!qs.length){
    clearResumeSession();
    const b=document.getElementById('resume-banner');if(b)b.style.display='none';
    showNotif('Questions introuvables — session supprimée','');return;
  }
  // Restaurer les réponses
  const restoredAnswers=(data.answers||[]).map(a=>{
    const q=qs.find(x=>x.id===a.qid);
    return q?{q,chosenIdx:a.chosenIdx,correct:a.correct,skipped:a.skipped||false,timeSpent:a.timeSpent||0}:null;
  }).filter(Boolean);
  // S'assurer que restoredAnswers.length === cur
  while(restoredAnswers.length<(data.cur||0)) restoredAnswers.push(null);
  session={
    qs,cur:data.cur||0,correct:data.correct||0,
    answers:restoredAnswers,mode:data.mode,
    isFlash:data.isFlash,isRetry:data.isRetry,isHard:data.isHard,
    isSurvival:data.isSurvival,isAnnales:data.isAnnales,
    lives:data.lives||3,survivalStreak:data.survivalStreak||0,wrongQuestions:[]
  };
  rBack=data.rBack||'home';
  sessionStart=data.sessionStart||Date.now();
  setAnnalesMode(!!data.isAnnales);
  const b=document.getElementById('resume-banner');if(b)b.style.display='none';
  clearResumeSession();
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    const elapsed=Math.floor((Date.now()-sessionStart)/1000);const tStr=formatTime(elapsed);
    const te=document.getElementById('quiz-timer');if(te){te.textContent=tStr;te.className='quiz-timer-live'+(elapsed>1800?' warn':'');}
    const tb=document.getElementById('topbar-timer');if(tb){tb.style.display='block';tb.innerHTML=`<span style="font-size:12px;font-weight:700;color:var(--on-sv);padding:3px 9px;background:var(--surf-low);border-radius:var(--r-full)"><span class="ms" style="font-size:12px;vertical-align:middle">timer</span> ${tStr}</span>`;}
  },1000);
  showScreen('quiz');renderQ();
}
function dismissResume(){clearResumeSession();const b=document.getElementById('resume-banner');if(b)b.style.display='none';}

// ════════════════════════════════════════════
// HOME + GOAL RING
// ════════════════════════════════════════════
function renderHome(){
  // Nettoyer toute session invalide avant d'afficher le banner
  try{
    const saved=localStorage.getItem('kcu_resume');
    if(saved){
      const d=JSON.parse(saved);
      if(!d||!d.savedAt||!d.cur||d.cur<1||Date.now()-d.savedAt>12*60*60*1000){
        localStorage.removeItem('kcu_resume');
      }
    }
  }catch(e){localStorage.removeItem('kcu_resume');}
  checkResumeSession();
  updStreak();
  const todayQ=getTodayQ();
  const goal=dailyGoal||10;
  const pct=Math.min(100,Math.round((todayQ/goal)*100));
  const hardCount=questions.filter(q=>getDiff(q.id)==='hard').length;

  // Révision ciblée — badge compteur
  const threeDaysAgo=new Date();threeDaysAgo.setDate(threeDaysAgo.getDate()-3);
  const cibléCount=questions.filter(q=>{
    if(isBoycotted(q.id))return false;
    const diff=getDiff(q.id);if(diff!=='hard'&&diff!=='medium')return false;
    const d=diffData[q.id];if(!d||!d.lastDate)return true;
    return new Date(d.lastDate)<threeDaysAgo;
  }).length;
  const cibléEl=document.getElementById('dtc-cible-count');
  if(cibléEl){cibléEl.style.display=cibléCount>0?'':'none';cibléEl.textContent=cibléCount+' DISPO';}

  // Total questions badge
  const dtcTotal=document.getElementById('dtc-total');if(dtcTotal)dtcTotal.textContent=questions.filter(q=>!isBoycotted(q.id)).length;

  // Maîtrise globale
  const _allQ=questions.filter(q=>!isBoycotted(q.id));
  const _mastQ=_allQ.filter(q=>{ const d=getDiff(q.id); return d==='easy'||d==='acquired'; }).length;
  const _mastPctGlobal=_allQ.length?Math.round((_mastQ/_allQ.length)*100):0;
  const _mastColor=_mastPctGlobal>=80?'#22c55e':'var(--primary)';
  const _mastPctEl=document.getElementById('dash-mastery-pct');
  const _mastBarEl=document.getElementById('dash-mastery-bar');
  const _mastTrendEl=document.getElementById('dash-mastery-trend');
  if(_mastPctEl){
    _mastPctEl.style.color=_mastColor;
    // Démarre en même temps que les barres (180ms) et dure 2s comme elles
    _mastPctEl.textContent=0;
    setTimeout(()=>{
      const duration=2000;
      const startTime=performance.now();
      const target=_mastPctGlobal;
      (function tick(now){
        const elapsed=now-startTime;
        const progress=Math.min(elapsed/duration,1);
        const ease=1-Math.pow(1-progress,3);
        _mastPctEl.textContent=Math.round(ease*target);
        if(progress<1)requestAnimationFrame(tick);
      })(startTime);
    }, 180);
  }
  if(_mastBarEl){
    _mastBarEl.style.background=_mastColor;
    void _mastBarEl.offsetWidth; // force paint à 0%
    setTimeout(()=>{ _mastBarEl.style.width=_mastPctGlobal+'%'; }, 180);
  }
  if(_mastTrendEl){ _mastTrendEl.textContent=_mastPctGlobal>=80?'Excellent':_mastPctGlobal>=50?'En progression':_mastPctGlobal>=20?'Continue':_allQ.length===0?'Aucune question':'Début'; }

  document.getElementById('streak-num').textContent=stats.streak;
  document.getElementById('stat-q').textContent=questions.length;
  document.getElementById('stat-c').textContent=courses.length;
  document.getElementById('stat-hard').textContent=hardCount;

  // Goal ring (r=28, circ=2π×28≈175.9)
  const circ=175.9;
  document.getElementById('goal-arc').style.strokeDashoffset=circ-(pct/100)*circ;
  document.getElementById('goal-pct').textContent=pct+'%';
  document.getElementById('goal-count').textContent=`${todayQ}/${goal}`;

  const objCard=document.getElementById('dc-obj-card');
  if(todayQ>=goal){
    document.getElementById('goal-title').textContent='Objectif atteint';
    document.getElementById('goal-desc').textContent=`${todayQ} questions aujourd'hui`;
    if(objCard) objCard.classList.add('dc-obj--done');
  } else if(todayQ>0){
    document.getElementById('goal-title').textContent='Objectif du jour';
    const rem=goal-todayQ;
    document.getElementById('goal-desc').textContent=`Plus que ${rem} question${rem>1?'s':''} !`;
    if(objCard) objCard.classList.remove('dc-obj--done');
  } else {
    document.getElementById('goal-title').textContent='Objectif du jour';
    document.getElementById('goal-desc').textContent=`${goal} questions à faire`;
    if(objCard) objCard.classList.remove('dc-obj--done');
  }

  // Today timer
  const secs=stats.todaySecs||0;
  const timerEl=document.getElementById('today-timer');
  if(secs>0&&timerEl){
    timerEl.style.display='inline-flex';
    timerEl.innerHTML=`<span class="ms" style="font-size:11px">timer</span>${formatTime(secs)}`;
  } else if(timerEl) timerEl.style.display='none';

  // SRS — questions urgentes du jour
  const srsQs=getSRSDueQuestions();
  const srsEl=document.getElementById('srs-section');
  if(srsEl){
    if(srsQs.length>0){
      srsEl.style.display='block';
      srsEl.innerHTML=`<div class="srs-section-wrap">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span class="sl" style="margin:0">À réviser aujourd'hui</span>
          <span class="srs-badge"><span class="ms" style="font-size:11px;vertical-align:middle">schedule</span> ${srsQs.length}</span>
        </div>
        <div class="srs-card" onclick="launchSRS()">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:42px;height:42px;border-radius:var(--r-lg);background:linear-gradient(135deg,var(--primary),var(--primary-c));display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <span class="ms" style="color:#fff;font-size:22px">update</span>
            </div>
            <div>
              <div style="font-weight:800;font-size:15px;margin-bottom:2px">${srsQs.length} question${srsQs.length>1?'s':''} dues</div>
              <div style="font-size:12px;color:var(--on-sv)">Répétition espacée · Ancrage mémoriel optimal</div>
            </div>
          </div>
          <span class="ms" style="color:var(--on-sv);flex-shrink:0">chevron_right</span>
        </div>
      </div>`;
    } else {
      srsEl.style.display='none';
    }
  }

  // Plan de révision card
  renderPlanHomeCard();

  // Partiels card
  if(typeof renderPartielsHomeCard==='function')renderPartielsHomeCard();

  // Folders — avec barre de progression
  const grid=document.getElementById('fg'),empty=document.getElementById('hempty');
  const allRegular=folders.filter(f=>f.type!=='annales'&&!f.isAnnale);
  const activeFolders=allRegular.filter(f=>!isFolderArchived(f.id));
  const archivedList=allRegular.filter(f=>isFolderArchived(f.id));
  if(!activeFolders.length&&!archivedList.length){grid.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  document.querySelectorAll('#fg-sort-controls .sort-btn').forEach(b=>b.classList.toggle('sort-active',b.dataset.sort===_folderSortMode));
  let sortedFolders=[...activeFolders];
  if(_folderSortMode==='alpha')sortedFolders.sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true,sensitivity:'base'}));
  else if(_folderSortMode==='alpha-desc')sortedFolders.sort((a,b)=>b.name.localeCompare(a.name,'fr',{numeric:true,sensitivity:'base'}));
  const isDndF=_folderSortMode==='custom';
  function _fcHtml(f,archived){
    const fc=courses.filter(c=>c.folderId===f.id);
    const fq=questions.filter(q=>fc.some(c=>c.id===q.courseId));
    const total=fq.length;
    // Mastery calculation
    const _fcEasyN=fq.filter(q=>{const d=getDiff(q.id);return d==='easy'||d==='acquired';}).length;
    const _fcMastPct=total?Math.round(_fcEasyN/total*100):0;
    const _fcMastColor=_fcMastPct>=80?'#22c55e':'var(--primary)';
    let progressHtml='';
    if(total>0&&!archived){
      const easyN=_fcEasyN;
      const medN=fq.filter(q=>getDiff(q.id)==='medium').length;
      const hardN=fq.filter(q=>getDiff(q.id)==='hard').length;
      const pEasy=Math.round(easyN/total*100),pMed=Math.round(medN/total*100),pHard=Math.round(hardN/total*100);
      progressHtml=`<div class="fc-progress">
        ${pEasy>0?`<div class="fc-progress-seg" data-w="${pEasy}" style="width:0%;background:#22c55e"></div>`:''}
        ${pMed>0?`<div class="fc-progress-seg" data-w="${pMed}" style="width:0%;background:#f59e0b"></div>`:''}
        ${pHard>0?`<div class="fc-progress-seg" data-w="${pHard}" style="width:0%;background:#ef4444"></div>`:''}
      </div>`;
    }
    const archiveBtn=archived
      ?`<button class="fc-archive-btn fc-archive-active" onclick="event.stopPropagation();unarchiveFolder('${f.id}');renderHome()" title="Remettre en actif"><span class="ms" style="font-size:15px">unarchive</span></button>`
      :`<button class="fc-archive-btn" onclick="event.stopPropagation();archiveFolder('${f.id}');renderHome()" title="Marquer comme passé"><span class="ms" style="font-size:15px">check_circle</span></button>`;
    const dndAttrs=(!archived&&isDndF)?`draggable="true" ondragstart="_dndStart(event,'${f.id}')" ondragend="_dndEnd(event)" ondragover="_dndOver(event)" ondragleave="_dndLeave(event)" ondrop="_dndDropFolders(event,'${f.id}')"`:'' ;
    const mastBadge=total>0?`<span style="font-weight:800;color:${_fcMastColor};margin-left:4px">· ${_fcMastPct}%</span>`:'';
    return `<div class="fc${(!archived&&isDndF)?' dnd-item':''}${archived?' fc-archived':''}" ${dndAttrs} onclick="${(!archived&&isDndF)?'':` openFolder('${f.id}')`}" style="--fc-color:${f.color}">
      ${(!archived&&isDndF)?`<span class="ms dnd-handle" style="font-size:20px;color:var(--on-sv);cursor:grab;flex-shrink:0" onclick="openFolder('${f.id}')">drag_indicator</span>`:''}
      <div class="fstripe" style="background:${f.color}"></div>
      <button class="fdel" onclick="event.stopPropagation();deleteFolder('${f.id}')"><span class="ms" style="font-size:16px">delete</span></button>
      ${archiveBtn}
      <div class="fname" onclick="openFolder('${f.id}')">${f.name}</div>
      <div class="fmeta">${fc.length} cours · ${fq.length} question${fq.length!==1?'s':''}${mastBadge}</div>
      ${progressHtml}
    </div>`;
  }
  grid.innerHTML=sortedFolders.map(f=>_fcHtml(f,false)).join('');
  // Démarre l'animation après que l'écran a fini d'apparaître (transition .3s)
  const _segs=grid.querySelectorAll('.fc-progress-seg[data-w]');
  _segs.forEach(seg=>{ void seg.offsetWidth; }); // force paint à 0%
  setTimeout(()=>{
    _segs.forEach(seg=>{ seg.style.width=seg.dataset.w+'%'; });
  }, 180);
  // Section "Matières passées"
  let archSec=document.getElementById('archived-folders-section');
  if(!archSec){
    archSec=document.createElement('div');
    archSec.id='archived-folders-section';
    grid.parentNode.insertBefore(archSec,grid.nextSibling);
  }
  if(archivedList.length){
    const stored=localStorage.getItem('kp-arch-open');
    const isOpen=stored===null?false:stored==='1';
    archSec.innerHTML=`<div class="arch-section-head" onclick="_toggleArchivedSection()" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:12px 4px 8px;color:var(--on-sv);font-size:13px;font-weight:600;user-select:none">
      <span class="ms" style="font-size:18px;transition:transform .2s;transform:rotate(${isOpen?'0':'180'}deg)" id="arch-chevron">expand_less</span>
      Matières passées <span style="background:var(--sv2);color:var(--on-sv);border-radius:99px;padding:1px 8px;font-size:11px;font-weight:700">${archivedList.length}</span>
    </div>
    <div id="arch-grid" class="fg" style="display:${isOpen?'grid':'none'}">${archivedList.map(f=>_fcHtml(f,true)).join('')}</div>`;
  } else {
    archSec.innerHTML='';
  }
}
function _toggleArchivedSection(){
  const grid=document.getElementById('arch-grid');
  const chevron=document.getElementById('arch-chevron');
  if(!grid)return;
  const open=grid.style.display==='none';
  grid.style.display=open?'grid':'none';
  chevron.style.transform=open?'rotate(0deg)':'rotate(180deg)';
  localStorage.setItem('kp-arch-open',open?'1':'0');
}
function openFolder(fid){curF=fid;setAnnalesMode(isAnnalesFolder(fid));showScreen('matiere');}

// ════════════════════════════════════════════
// ANNALES
// ════════════════════════════════════════════
function renderAnnales(){
  const af=folders.filter(f=>f.type==='annales');
  const list=document.getElementById('annales-list');
  const empty=document.getElementById('annales-empty');
  if(!af.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  list.innerHTML=af.map(f=>{
    const fc=courses.filter(c=>c.folderId===f.id);
    const fq=questions.filter(q=>fc.some(c=>c.id===q.courseId));
    return `<div class="fc" onclick="openFolder('${f.id}')">
      <div class="fstripe" style="background:${f.color}"></div>
      <button class="fdel" onclick="event.stopPropagation();deleteFolder('${f.id}')"><span class="ms" style="font-size:16px">delete</span></button>
      <div class="fname">${f.name}</div>
      <div class="fmeta">${fc.length} examen${fc.length!==1?'s':''} · ${fq.length} question${fq.length!==1?'s':''}</div>
    </div>`;
  }).join('');
}
function saveAnnalesFolder(){
  const name=document.getElementById('naf-name').value.trim();
  if(!name){showNotif('Donne un nom à la matière.','err');return;}
  folders.push({id:uid(),name,color:selC,type:'annales'});
  saveAll();closeModal('modal-naf');renderAnnales();
  showNotif('Matière Annales créée : '+name,'ok');
}
function isAnnalesFolder(fid){const f=folders.find(x=>x.id===fid);return !!(f&&f.type==='annales');}
function getAnnalesFlagForCurrent(){
  // Detect if current context is an annales folder
  if(curF&&isAnnalesFolder(curF))return true;
  if(curSF){const sf=subFolders.find(x=>x.id===curSF);if(sf&&isAnnalesFolder(sf.folderId))return true;}
  if(curC){const c=courses.find(x=>x.id===curC);if(c&&isAnnalesFolder(c.folderId))return true;}
  return false;
}

// ════════════════════════════════════════════
// MATIERE
// ════════════════════════════════════════════
// ════════════════════════════════════════════
// MULTI-SELECT COURSES
// ════════════════════════════════════════════
let _courseSelectMode = false;
let _selectedCourses = new Set();

function toggleCourseSelectMode() {
  _courseSelectMode = !_courseSelectMode;
  _selectedCourses.clear();
  if (document.getElementById('screen-subfolder').classList.contains('active')) {
    renderSubFolder();
  } else {
    renderMatiere();
  }
}

function toggleCourseSelect(cid) {
  if (_selectedCourses.has(cid)) _selectedCourses.delete(cid);
  else _selectedCourses.add(cid);
  const cb = document.getElementById('cb-' + cid);
  if (cb) cb.checked = _selectedCourses.has(cid);
  const bar = document.getElementById('course-select-bar');
  if (bar) {
    const n = _selectedCourses.size;
    bar.querySelector('#csel-count').textContent = n === 0 ? 'Aucun sélectionné' : `${n} sélectionné${n > 1 ? 's' : ''}`;
    bar.querySelector('#csel-delete-btn').style.opacity = n > 0 ? '1' : '0.4';
    bar.querySelector('#csel-delete-btn').disabled = n === 0;
    const mb = bar.querySelector('#csel-move-btn');
    if (mb) { mb.style.opacity = n > 0 ? '1' : '0.4'; mb.disabled = n === 0; }
  }
}

function selectAllCourses() {
  const inSub = document.getElementById('screen-subfolder').classList.contains('active');
  const list = inSub
    ? courses.filter(c => c.subFolderId === curSF)
    : courses.filter(c => c.folderId === curF && !c.subFolderId);
  list.forEach(c => _selectedCourses.add(c.id));
  list.forEach(c => { const cb = document.getElementById('cb-' + c.id); if(cb) cb.checked = true; });
  const bar = document.getElementById('course-select-bar');
  if (bar) {
    const n = _selectedCourses.size;
    bar.querySelector('#csel-count').textContent = `${n} sélectionné${n > 1 ? 's' : ''}`;
    bar.querySelector('#csel-delete-btn').style.opacity = '1';
    bar.querySelector('#csel-delete-btn').disabled = false;
    const mb = bar.querySelector('#csel-move-btn');
    if (mb) { mb.style.opacity = '1'; mb.disabled = false; }
  }
}

function deleteSelectedCourses() {
  const n = _selectedCourses.size;
  if (!n) return;
  const nq = questions.filter(q => _selectedCourses.has(q.courseId)).length;
  showConfirm(`Supprimer ${n} cours ?`, `${nq} question${nq > 1 ? 's' : ''} seront supprimées définitivement.`, 'Supprimer', () => {
    questions = questions.filter(q => !_selectedCourses.has(q.courseId));
    courses = courses.filter(c => !_selectedCourses.has(c.id));
    _selectedCourses.clear();
    _courseSelectMode = false;
    saveAll();
    if (document.getElementById('screen-subfolder').classList.contains('active')) {
      renderSubFolder();
    } else {
      renderMatiere();
    }
    showNotif(`${n} cours supprimés`, 'ok');
  });
}

function moveSelectedCourses() {
  const n = _selectedCourses.size;
  if (!n) return;
  // Récupérer les sous-dossiers disponibles pour cette matière
  const sfs = subFolders.filter(s => s.folderId === curF);
  const f = folders.find(x => x.id === curF);
  let html = '';
  // Option racine
  html += `<div class="pi-pick" onclick="applyMoveSelected(null)">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="ms" style="font-size:18px">home</span>
      <div><div style="font-size:14px;font-weight:700">${f ? f.name : 'Matière'}</div><div style="font-size:12px;color:var(--on-sv)">Racine — sans dossier</div></div>
    </div>
    <span class="ms" style="color:var(--on-sv)">chevron_right</span>
  </div>`;
  sfs.forEach(sf => {
    html += `<div class="pi-pick" onclick="applyMoveSelected('${sf.id}')">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="ms" style="font-size:18px">folder</span>
        <div><div style="font-size:14px;font-weight:700">${sf.name}</div><div style="font-size:12px;color:var(--on-sv)">${courses.filter(x => x.subFolderId === sf.id).length} cours</div></div>
      </div>
      <span class="ms" style="color:var(--on-sv)">chevron_right</span>
    </div>`;
  });
  if (!sfs.length) {
    html += `<div style="font-size:13px;color:var(--on-sv);text-align:center;padding:12px">Aucun dossier disponible.<br>Crée d'abord un dossier dans cette matière.</div>`;
  }
  document.getElementById('move-course-name').textContent = `${n} cours sélectionné${n > 1 ? 's' : ''}`;
  document.getElementById('move-dest-list').innerHTML = html;
  openModal('modal-move');
}

function applyMoveSelected(destSfId) {
  const ids = [..._selectedCourses];
  ids.forEach(cid => {
    const c = courses.find(x => x.id === cid);
    if (c) c.subFolderId = destSfId || null;
  });
  _selectedCourses.clear();
  _courseSelectMode = false;
  saveAll();
  closeModal('modal-move');
  const sfName = destSfId ? (subFolders.find(x => x.id === destSfId) || {name: 'dossier'}).name : 'la racine';
  showNotif(`${ids.length} cours déplacés vers ${sfName} ✓`, 'ok');
  renderMatiere();
}

function renderMatiere(){
  const f=folders.find(x=>x.id===curF);if(!f)return;
  const sfs=subFolders.filter(s=>s.folderId===curF);
  const directCourses=courses.filter(c=>c.folderId===curF&&!c.subFolderId);
  const allCourses=courses.filter(c=>c.folderId===curF);
  const fq=questions.filter(q=>allCourses.some(c=>c.id===q.courseId));
  // Calcul du pourcentage de maîtrise
  const _masteredCount=fq.filter(q=>{ const d=getDiff(q.id); return d==='easy'||d==='acquired'; }).length;
  const _mastPct=fq.length?Math.round((_masteredCount/fq.length)*100):0;
  const _mastColor=_mastPct>=80?'#22c55e':'var(--primary)';
  document.getElementById('matiere-hdr').innerHTML=`
    <div class="kf-title-row"><button class="kf-ic kf-ic-btn" onclick="openEditFolderColor()" title="Changer la couleur" style="--c:${f.color}"><span class="ms">school</span></button><h1 class="kf-title">${f.name}</h1><button class="bico" onclick="openRenameFolder('${f.id}')" title="Renommer"><span class="ms" style="font-size:18px">edit</span></button></div>
    <div class="kf-meta">${sfs.length?`<span>${sfs.length} dossier${sfs.length!==1?'s':''}</span>`:''}<span>${allCourses.length} cours</span><span>${fq.length} question${fq.length!==1?'s':''}</span>${fq.length>0?`<span class="kf-mast"><i><b style="width:${_mastPct}%;background:${_mastColor}"></b></i><strong style="color:${_mastColor}">${_mastPct} %</strong> maîtrisé</span>`:''}</div>`;
  // Update mastery badge separately (more reliable than template literal)
  const _mastBadgeEl=document.getElementById('matiere-mastery-badge');
  if(_mastBadgeEl&&fq.length>0){
    _mastBadgeEl.innerHTML=` · <span style="font-weight:800;color:${_mastColor}">${_mastPct}%</span>`;
  }
  const el=document.getElementById('courses-list');
  if(!sfs.length&&!directCourses.length){el.innerHTML=`<div class="empty"><div class="eico"><span class="ms" style="font-size:42px">menu_book</span></div><div class="ettl">Aucun contenu</div><p style="font-size:14px">Crée un <strong>Dossier</strong> pour regrouper des cours, ou ajoute un <strong>Cours</strong> directement.</p></div>`;return;}
  let html='';
  const isDndM=_folderSubSortMode==='custom';
  const _sfSortPills=`<div style="display:flex;gap:4px;flex-wrap:wrap"><button class="sort-btn btn btn-g${_folderSubSortMode==='manual'?' sort-active':''}" onclick="setFolderSubSort('manual')" style="font-size:10px;padding:3px 8px">Ordre</button><button class="sort-btn btn btn-g${_folderSubSortMode==='alpha'?' sort-active':''}" onclick="setFolderSubSort('alpha')" style="font-size:10px;padding:3px 8px">A→Z</button><button class="sort-btn btn btn-g${_folderSubSortMode==='alpha-desc'?' sort-active':''}" onclick="setFolderSubSort('alpha-desc')" style="font-size:10px;padding:3px 8px">Z→A</button><button class="sort-btn btn btn-g${_folderSubSortMode==='custom'?' sort-active':''}" onclick="setFolderSubSort('custom')" style="font-size:10px;padding:3px 8px"><span class="ms" style="font-size:11px;vertical-align:middle">drag_indicator</span></button></div>`;
  if(sfs.length){
    let sortedSfs=[...sfs];
    if(_folderSubSortMode==='alpha')sortedSfs.sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true,sensitivity:'base'}));
    else if(_folderSubSortMode==='alpha-desc')sortedSfs.sort((a,b)=>b.name.localeCompare(a.name,'fr',{numeric:true,sensitivity:'base'}));
    html+=`<div class="kf-toolbar"><span class="kf-tl">Dossiers <em>${sfs.length}</em></span><div class="kf-tools">${_sfSortPills}</div></div>`;
    html+=sortedSfs.map(sf=>{
      const sfCourses=courses.filter(c=>c.subFolderId===sf.id);
      const sfQs=questions.filter(q=>sfCourses.some(c=>c.id===q.courseId));
      const hardN=sfQs.filter(q=>getDiff(q.id)==='hard').length;
      const dndA=isDndM?`draggable="true" ondragstart="_dndStart(event,'${sf.id}')" ondragend="_dndEnd(event)" ondragover="_dndOver(event)" ondragleave="_dndLeave(event)" ondrop="_dndDropSF(event,'${sf.id}')"`:'' ;
      return `<div class="ci${isDndM?' dnd-item':''}" style="border-left:4px solid ${f.color}" ${dndA} onclick="openSubFolder('${sf.id}')">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          <span class="ms" style="font-size:20px">folder</span>
          <div><div class="cname">${sf.name}</div><div class="cmeta">${sfCourses.length} cours · ${sfQs.length} question${sfQs.length!==1?'s':''}${hardN>0?` · <span style="color:var(--error)">${hardN} difficile${hardN>1?'s':''}</span>`:''}</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="cacts"><button class="bico" onclick="event.stopPropagation();socialOpenShareFolder('${sf.id}')" title="Partager ce dossier avec tes amis"><span class="ms" style="font-size:16px">share</span></button><button class="bico" onclick="event.stopPropagation();openRenameSubFolder('${sf.id}')" title="Renommer"><span class="ms" style="font-size:16px">edit</span></button><button class="bico del" onclick="event.stopPropagation();deleteSubFolder('${sf.id}')"><span class="ms" style="font-size:16px">delete</span></button></div>
          <div class="cbadge">${sfQs.length}</div>
          ${isDndM?`<span class="ms dnd-handle" style="font-size:22px;color:var(--on-sv);cursor:grab;flex-shrink:0" onclick="event.stopPropagation()">drag_indicator</span>`:'<span class="ms" style="color:var(--on-sv);font-size:20px">chevron_right</span>'}
        </div>
      </div>`;
    }).join('');
  }
  if(directCourses.length){
    const selBtn=`<button class="bico" onclick="toggleCourseSelectMode()" title="${_courseSelectMode?'Annuler':'Sélectionner'}" style="color:${_courseSelectMode?'var(--primary)':'var(--on-sv)'}"><span class="ms" style="font-size:18px">${_courseSelectMode?'cancel':'checklist'}</span></button>`;
    html+=`<div class="kf-toolbar${sfs.length?' kf-toolbar-gap':''}"><span class="kf-tl">Cours <em>${directCourses.length}</em></span><div class="kf-tools">${sfs.length?'':_sfSortPills}${selBtn}</div></div>`;
    html+=directCourses.map(c=>{
      const cq=questions.filter(q=>q.courseId===c.id);
      const hardN=cq.filter(q=>getDiff(q.id)==='hard').length;
      const dndA=isDndM?`draggable="true" ondragstart="_dndStart(event,'${c.id}')" ondragend="_dndEnd(event)" ondragover="_dndOver(event)" ondragleave="_dndLeave(event)" ondrop="_dndDropCourse(event,'${c.id}','mat')"`:'' ;
      const isSelected=_selectedCourses.has(c.id);
      const cardClick=_courseSelectMode?`toggleCourseSelect('${c.id}')`:`openCourse('${c.id}')`;
      const cardStyle=_courseSelectMode&&isSelected?'background:color-mix(in srgb,var(--primary) 10%,transparent);border-color:var(--primary)':'';
      return `<div class="ci${isDndM?' dnd-item':''}" ${dndA} onclick="${cardClick}" style="${cardStyle}">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          ${_courseSelectMode?`<input type="checkbox" id="cb-${c.id}" onchange="toggleCourseSelect('${c.id}')" onclick="event.stopPropagation()" ${isSelected?'checked':''} style="width:18px;height:18px;cursor:pointer;accent-color:var(--primary);flex-shrink:0">`:''}
          <div class="cdot" style="background:${f.color}"></div>
          <div><div class="cname">${c.name}</div><div class="cmeta">${cq.length} question${cq.length!==1?'s':''}${hardN>0?` · <span style="color:var(--error)">${hardN} difficile${hardN>1?'s':''}</span>`:''}</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">${_courseSelectMode?'':` <div class="cacts"><button class="bico" onclick="event.stopPropagation();socialOpenShare('${c.id}')" title="Partager ce cours avec tes amis"><span class="ms" style="font-size:16px">share</span></button><button class="bico" onclick="event.stopPropagation();openMoveCourse('${c.id}')" title="Déplacer"><span class="ms" style="font-size:16px">drive_file_move</span></button><button class="bico del" onclick="event.stopPropagation();deleteCourse('${c.id}')"><span class="ms" style="font-size:16px">delete</span></button></div>`}<div class="cbadge">${cq.length}</div>${isDndM&&!_courseSelectMode?`<span class="ms dnd-handle" style="font-size:22px;color:var(--on-sv);cursor:grab;flex-shrink:0" onclick="event.stopPropagation()">drag_indicator</span>`:'<span class="ms" style="color:var(--on-sv);font-size:20px">chevron_right</span>'}</div>
      </div>`;
    }).join('');
    if(_courseSelectMode){
      html+=`<div id="course-select-bar" style="position:sticky;bottom:70px;background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r-xl);padding:10px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;box-shadow:var(--sh-lg);margin-top:10px">
  <span id="csel-count" style="flex:1;min-width:100px;font-size:13px;font-weight:700;color:var(--on-surface)">Aucun sélectionné</span>
  <button class="btn btn-sm btn-g" onclick="selectAllCourses()">Tout</button>
  <button id="csel-move-btn" class="btn btn-sm btn-g" style="opacity:0.4" disabled onclick="moveSelectedCourses()"><span class="ms" style="font-size:14px;vertical-align:middle">drive_file_move</span> Déplacer</button>
  <button id="csel-delete-btn" class="btn btn-sm" style="background:#ef4444;color:#fff;opacity:0.4" disabled onclick="deleteSelectedCourses()">Supprimer</button>
  <button class="btn btn-sm btn-g" onclick="toggleCourseSelectMode()">Annuler</button>
</div>`;
    }
  }
  el.innerHTML=html;
}
function openSubFolder(sfid){curSF=sfid;showScreen('subfolder');}
function openCourse(cid){curC=cid;showScreen('course');}
function startMatiere(){
  const fc=courses.filter(c=>c.folderId===curF);
  const qs=questions.filter(q=>fc.some(c=>c.id===q.courseId)&&!isBoycotted(q.id));
  if(!qs.length){showNotif('Aucune question dans cette matière.','err');return;}
  const f=folders.find(x=>x.id===curF);
  window._blockQs=qs;window._blockTopic=f?f.name:'Matière';window._blockMode='matiere';
  window._blockIsAnnales=isAnnalesFolder(curF);
  document.getElementById('blocks-topic').textContent=window._blockTopic;
  _initBlocksModal(qs.length);
  openModal('modal-blocks');
}

// Lance les cours dans l'ordre, un bloc par cours (TEMA 1 → TEMA 2 → …)
function startMatiereSequential(){
  const f=folders.find(x=>x.id===curF);
  const fc=courses.filter(c=>c.folderId===curF);
  if(!fc.length){showNotif('Aucun cours dans cette matière.','err');return;}
  const blocks=[];const blockNames=[];
  fc.forEach(c=>{
    const cqs=questions.filter(q=>q.courseId===c.id&&!isBoycotted(q.id));
    if(cqs.length){blocks.push(cqs);blockNames.push(c.name);}
  });
  if(!blocks.length){showNotif('Aucune question disponible.','err');return;}
  window._blocks=blocks;
  window._blockNames=blockNames;
  window._currentBlock=0;
  window._blockTopic=f?f.name:'Matière';
  window._blockIsAnnales=isAnnalesFolder(curF);
  rBack='matiere';
  launchS(blocks[0],`${blockNames[0]} (1/${blocks.length})`,false,false,false,false,!!window._blockIsAnnales);
}

// ════════════════════════════════════════════
// SOUS-DOSSIER
// ════════════════════════════════════════════
function renderSubFolder(){
  const sf=subFolders.find(x=>x.id===curSF);if(!sf)return;
  const f=folders.find(x=>x.id===sf.folderId);
  const sfCourses=courses.filter(c=>c.subFolderId===curSF);
  const sfQs=questions.filter(q=>sfCourses.some(c=>c.id===q.courseId));
  const _sfMasteredCount=sfQs.filter(q=>{ const d=getDiff(q.id); return d==='easy'||d==='acquired'; }).length;
  const _sfMastPct=sfQs.length?Math.round((_sfMasteredCount/sfQs.length)*100):0;
  const _sfMastColor=_sfMastPct>=80?'#22c55e':'var(--primary)';
  document.getElementById('subfolder-hdr').innerHTML=`
    <button class="kf-crumb" onclick="showScreen('matiere')"><span class="ms">arrow_back</span>${f?f.name:'Retour'}</button>
    <div class="kf-title-row"><span class="kf-ic" style="--c:${f&&f.color?f.color:'var(--primary)'}"><span class="ms">folder</span></span><h1 class="kf-title">${sf.name}</h1><button class="bico" onclick="openRenameSubFolder('${sf.id}')" title="Renommer"><span class="ms" style="font-size:18px">edit</span></button></div>
    <div class="kf-meta"><span>${sfCourses.length} cours</span><span>${sfQs.length} question${sfQs.length!==1?'s':''}</span>${sfQs.length>0?`<span class="kf-mast"><i><b style="width:${_sfMastPct}%;background:${_sfMastColor}"></b></i><strong style="color:${_sfMastColor}">${_sfMastPct} %</strong> maîtrisé</span>`:''}</div>`;
  const el=document.getElementById('subfolder-list');
  if(!sfCourses.length){el.innerHTML=`<div class="empty"><div class="eico"><span class="ms" style="font-size:42px">edit_note</span></div><div class="ettl">Aucun cours</div><p style="font-size:14px">Ajoute des cours avec <strong>+ Cours</strong>.</p></div>`;return;}
  const color=f?f.color:'#004d75';
  const isDndS=_subFolderCourseSortMode==='custom';
  const _subSortPills=`<div style="display:flex;gap:4px;flex-wrap:wrap"><button class="sort-btn btn btn-g${_subFolderCourseSortMode==='manual'?' sort-active':''}" onclick="setSubFolderSort('manual')" style="font-size:10px;padding:3px 8px">Ordre</button><button class="sort-btn btn btn-g${_subFolderCourseSortMode==='alpha'?' sort-active':''}" onclick="setSubFolderSort('alpha')" style="font-size:10px;padding:3px 8px">A→Z</button><button class="sort-btn btn btn-g${_subFolderCourseSortMode==='alpha-desc'?' sort-active':''}" onclick="setSubFolderSort('alpha-desc')" style="font-size:10px;padding:3px 8px">Z→A</button><button class="sort-btn btn btn-g${_subFolderCourseSortMode==='custom'?' sort-active':''}" onclick="setSubFolderSort('custom')" style="font-size:10px;padding:3px 8px"><span class="ms" style="font-size:11px;vertical-align:middle">drag_indicator</span></button></div>`;
  let sortedCourses=[...sfCourses];
  if(_subFolderCourseSortMode==='alpha')sortedCourses.sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true,sensitivity:'base'}));
  else if(_subFolderCourseSortMode==='alpha-desc')sortedCourses.sort((a,b)=>b.name.localeCompare(a.name,'fr',{numeric:true,sensitivity:'base'}));
  const selBtnSub=`<button class="bico" onclick="toggleCourseSelectMode()" title="${_courseSelectMode?'Annuler':'Sélectionner'}" style="color:${_courseSelectMode?'var(--primary)':'var(--on-sv)'}"><span class="ms" style="font-size:18px">${_courseSelectMode?'cancel':'checklist'}</span></button>`;
  let subHtml=`<div class="kf-toolbar"><span class="kf-tl">Cours <em>${sfCourses.length}</em></span><div class="kf-tools">${_subSortPills}${selBtnSub}</div></div>`;
  subHtml+=sortedCourses.map(c=>{
    const cq=questions.filter(q=>q.courseId===c.id);
    const hardN=cq.filter(q=>getDiff(q.id)==='hard').length;
    const dndA=isDndS?`draggable="true" ondragstart="_dndStart(event,'${c.id}')" ondragend="_dndEnd(event)" ondragover="_dndOver(event)" ondragleave="_dndLeave(event)" ondrop="_dndDropCourse(event,'${c.id}','sub')"`:'' ;
    const isSelected=_selectedCourses.has(c.id);
    const cardClick=_courseSelectMode?`toggleCourseSelect('${c.id}')`:`openCourse('${c.id}')`;
    const cardStyle=_courseSelectMode&&isSelected?'background:color-mix(in srgb,var(--primary) 10%,transparent);border-color:var(--primary)':'';
    return `<div class="ci${isDndS?' dnd-item':''}" ${dndA} onclick="${cardClick}" style="${cardStyle}">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        ${_courseSelectMode?`<input type="checkbox" id="cb-${c.id}" onchange="toggleCourseSelect('${c.id}')" onclick="event.stopPropagation()" ${isSelected?'checked':''} style="width:18px;height:18px;cursor:pointer;accent-color:var(--primary);flex-shrink:0">`:''}
        <div class="cdot" style="background:${color}"></div>
        <div><div class="cname">${c.name}</div><div class="cmeta">${cq.length} question${cq.length!==1?'s':''}${hardN>0?` · <span style="color:var(--error)">${hardN} difficile${hardN>1?'s':''}</span>`:''}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">${_courseSelectMode?'':` <div class="cacts"><button class="bico" onclick="event.stopPropagation();socialOpenShare('${c.id}')" title="Partager ce cours avec tes amis"><span class="ms" style="font-size:16px">share</span></button><button class="bico" onclick="event.stopPropagation();openMoveCourse('${c.id}')" title="Déplacer"><span class="ms" style="font-size:16px">drive_file_move</span></button><button class="bico del" onclick="event.stopPropagation();deleteCourse('${c.id}')"><span class="ms" style="font-size:16px">delete</span></button></div>`}<div class="cbadge">${cq.length}</div>${isDndS&&!_courseSelectMode?`<span class="ms dnd-handle" style="font-size:22px;color:var(--on-sv);cursor:grab;flex-shrink:0" onclick="event.stopPropagation()">drag_indicator</span>`:'<span class="ms" style="color:var(--on-sv);font-size:20px">chevron_right</span>'}</div>
    </div>`;
  }).join('');
  if(_courseSelectMode){
    subHtml+=`<div id="course-select-bar" style="position:sticky;bottom:70px;background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r-xl);padding:10px 14px;display:flex;align-items:center;gap:10px;box-shadow:var(--sh-lg);margin-top:10px">
  <span id="csel-count" style="flex:1;font-size:13px;font-weight:700;color:var(--on-surface)">Aucun sélectionné</span>
  <button class="btn btn-sm btn-g" onclick="selectAllCourses()">Tout</button>
  <button id="csel-move-btn" class="btn btn-sm btn-g" style="opacity:0.4" disabled onclick="moveSelectedCourses()"><span class="ms" style="font-size:14px;vertical-align:middle">drive_file_move</span> Déplacer</button>
  <button id="csel-delete-btn" class="btn btn-sm" style="background:#ef4444;color:#fff;opacity:0.4" disabled onclick="deleteSelectedCourses()">Supprimer</button>
  <button class="btn btn-sm btn-g" onclick="toggleCourseSelectMode()">Annuler</button>
</div>`;
  }
  el.innerHTML=subHtml;
}
function startSubFolder(){
  const sfCourses=courses.filter(c=>c.subFolderId===curSF);
  const qs=questions.filter(q=>sfCourses.some(c=>c.id===q.courseId)&&!isBoycotted(q.id));
  if(!qs.length){showNotif('Aucune question dans ce dossier.','err');return;}
  const sf=subFolders.find(x=>x.id===curSF);
  window._blockQs=qs;window._blockTopic=sf?sf.name:'Dossier';window._blockMode='subfolder';
  window._blockIsAnnales=getAnnalesFlagForCurrent();
  document.getElementById('blocks-topic').textContent=window._blockTopic;
  _initBlocksModal(qs.length);
  openModal('modal-blocks');
}

// ════════════════════════════════════════════
// COURSE
// ════════════════════════════════════════════
function renderCourse(){
  const c=courses.find(x=>x.id===curC);const f=c?folders.find(x=>x.id===c.folderId):null;if(!c)return;
  const sf=c.subFolderId?subFolders.find(x=>x.id===c.subFolderId):null;
  const cq=questions.filter(q=>q.courseId===curC);
  const breadcrumb=`${f?f.name:''}${sf?' › '+sf.name:''}`;
  // 15 nov. 2026 : même en-tête que les pages Matière / Dossier (fil d'Ariane cliquable, icône, titre, méta + maîtrise, partager)
  const _cMast=cq.filter(q=>{const d=getDiff(q.id);return d==='easy'||d==='acquired';}).length,_cPct=cq.length?Math.round(_cMast/cq.length*100):0,_cCol=_cPct>=80?'#22c55e':'var(--primary)';
  const _cFc=getFlashcardsForCourse(curC).length,_cName=String(c.name).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
  document.getElementById('course-hdr').innerHTML=`
    <button class="kf-crumb" onclick="goBackFromCourse()"><span class="ms">arrow_back</span>${breadcrumb||'Retour'}</button>
    <div class="kf-title-row"><span class="kf-ic" style="--c:${f&&f.color?f.color:'var(--primary)'}"><span class="ms">menu_book</span></span><h1 class="kf-title">${c.name}</h1>
      <button class="bico" onclick="openRenameCourse('${c.id}','${_cName}')" title="Renommer"><span class="ms" style="font-size:18px">edit</span></button>
      <span style="flex:1"></span>
      <button class="btn btn-sm btn-g kf-share" onclick="socialOpenShare(curC)" title="Partager ce cours avec tes amis"><span class="ms" style="font-size:17px">share</span>Partager</button></div>
    <div class="kf-meta"><span>${cq.length} question${cq.length!==1?'s':''}</span>${_cFc?`<span>${_cFc} flashcard${_cFc>1?'s':''}</span>`:''}${cq.length>0?`<span class="kf-mast"><i><b style="width:${_cPct}%;background:${_cCol}"></b></i><strong style="color:${_cCol}">${_cPct} %</strong> maîtrisé</span>`:''}</div>`;
  const el=document.getElementById('course-ql');
  const fcsBtnEl=document.getElementById('course-fcs-btn');
  const fcsCount=getFlashcardsForCourse(curC).length;
  if(fcsBtnEl)fcsBtnEl.style.display=fcsCount?'inline-flex':'none';
  if(!cq.length){el.innerHTML=`<div class="empty"><div class="eico"><span class="ms" style="font-size:42px">edit_note</span></div><div class="ettl">Aucune question</div><p style="font-size:14px">Importe ton premier QCM.</p></div>`;renderCourseFlashcards();return;}
  el.innerHTML=`<span class="sl">${cq.length} question${cq.length>1?'s':''}</span>`+cq.map(q=>{
    const diff=getDiff(q.id);const db=getDiffBadge(diff);const boycott=isBoycotted(q.id);
    return `<div class="qi" style="${boycott?'opacity:.55;background:var(--surf-low)':''}"><div style="flex:1">
      <div class="qtxt" style="${boycott?'text-decoration:line-through;color:var(--on-sv)':''}">${q.question.substring(0,90)}${q.question.length>90?'…':''}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">
        <div class="qmeta">✓ ${q.answers[q.correct]}</div>
        <span class="di-badge ${db.cls}">${db.text}</span>
        ${boycott?`<span class="di-badge" style="background:var(--error-c);color:var(--error)"><span class="ms" style="font-size:12px;vertical-align:middle">block</span> Boycottée</span>`:''}
        ${q.expl?`<span style="font-size:11px;color:var(--gold)"><span class="ms" style="font-size:12px;vertical-align:middle">lightbulb</span> Feedback</span>`:''}
      </div>
    </div>
    <div class="qbtns">${boycott?`<button class="bico" onclick="unboycottQuestion('${q.id}');renderCourse()"><span class="ms" style="font-size:16px">restore</span></button>`:``}<button class="bico${isFavorite(q.id)?' fav-active':''}" onclick="toggleFavorite('${q.id}');renderCourse()" title="${isFavorite(q.id)?'Retirer des favoris':'Ajouter aux favoris'}"><span class="ms f" style="font-size:16px;color:${isFavorite(q.id)?'var(--tertiary)':'var(--on-sv)'}">${isFavorite(q.id)?'star':'star_border'}</span></button><button class="bico" onclick="openEQ('${q.id}')"><span class="ms" style="font-size:16px">edit</span></button><button class="bico del" onclick="delQ('${q.id}')"><span class="ms" style="font-size:16px">delete</span></button></div>
    </div>`;
  }).join('');
  renderCourseFlashcards();
  const favBtn=document.getElementById('course-fav-btn');
  if(favBtn){const favCount=cq.filter(q=>isFavorite(q.id)).length;favBtn.style.display=favCount?'inline-flex':'none';document.getElementById('course-fav-count').textContent='Favoris ('+favCount+')';}
}
function goBackFromMatiere(){
  const src=window._matiereSource||'matieres-hub';
  window._matiereSource=null;
  showScreen(src);
}
function renderAnnalesHub(){
  const list=document.getElementById('annales-hub-list');
  if(!list)return;
  const annaleFolders=folders.filter(f=>f.isAnnale);
  const pdfBtn=`<div style="margin-bottom:18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
    <button class="btn btn-p" onclick="annaleImportOpen()" style="display:flex;align-items:center;gap:8px;padding:10px 18px;font-size:14px;font-weight:700">
      <span class="ms" style="font-size:18px">upload_file</span> Importer une annale (PDF)
    </button>
    <button class="btn btn-g" onclick="coursAnnalesOpen()" style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:14px;font-weight:700" title="Colore dans ton cours les passages tombés en annales">
      <span class="ms" style="font-size:18px">link</span> Relier un cours aux annales
    </button>
    <button class="btn btn-g" onclick="document.getElementById('kine-pdf-input').click()" style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:14px;font-weight:700">
      <span class="ms" style="font-size:18px">picture_as_pdf</span> Lire un PDF
    </button>
    <span style="font-size:12px;color:var(--on-sv)">Astuce : tu peux aussi glisser le PDF directement sur cette page.</span>
  </div><div id="ca-hub"></div>`;
  setTimeout(()=>{if(typeof coursAnnalesRenderHub==='function')coursAnnalesRenderHub();},0);
  if(!annaleFolders.length){
    list.innerHTML=pdfBtn+`<div style="text-align:center;padding:40px 16px;color:var(--on-sv)">
      <span class="ms" style="font-size:48px;display:block;margin-bottom:16px;opacity:.4">description</span>
      <div style="font-size:15px;font-weight:700;margin-bottom:6px">Aucune annale importée</div>
      <div style="font-size:13px;opacity:.7">Importe un PDF avec le bouton ci-dessus</div>
    </div>`;
    return;
  }
  list.innerHTML=pdfBtn+annaleFolders.map(f=>{
    const c=courses.find(x=>x.folderId===f.id);
    const qCount=c?questions.filter(q=>q.courseId===c.id).length:0;
    const color=f.color||'#5B8DEF';
    return `<div class="ci" data-annale-fid="${f.id}">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0" data-open="${f.id}">
        <div class="cdot" style="background:${color}"></div>
        <div style="min-width:0">
          <div class="cname" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
          <div class="cmeta">${qCount} question${qCount!==1?'s':''}</div>
        </div>
      </div>
      <div class="cacts" onclick="event.stopPropagation()">
        <button class="ib" title="Renommer" onclick="_annaleRename('${f.id}')"><span class="ms" style="font-size:16px">edit</span></button>
        <button class="ib" title="Supprimer" onclick="_annaleDelete('${f.id}')"><span class="ms" style="font-size:16px;color:var(--error)">delete</span></button>
      </div>
      <span class="ms" style="color:var(--on-sv);font-size:18px;margin-left:8px" data-open="${f.id}">chevron_right</span>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click',()=>{
      window._matiereSource='annales-hub';
      openFolder(el.dataset.open);
    });
  });
}
window._annaleDelete=function(fid){
  const f=folders.find(x=>x.id===fid);if(!f)return;
  const fc=courses.filter(c=>c.folderId===fid);
  const nq=questions.filter(q=>fc.some(c=>c.id===q.courseId)).length;
  showConfirm(`Supprimer "${f.name}" ?`,`${fc.length} cours et ${nq} questions seront supprimées.`,'Supprimer',()=>{
    const cids=fc.map(c=>c.id);
    questions=questions.filter(q=>!cids.includes(q.courseId));
    courses=courses.filter(c=>c.folderId!==fid);
    folders=folders.filter(x=>x.id!==fid);
    saveAll();renderAnnalesHub();showNotif('Dossier supprimé','ok');
  });
};
window._annaleRename=function(fid){
  const f=folders.find(x=>x.id===fid);if(!f)return;
  const name=prompt('Nouveau nom :',f.name);
  if(name&&name.trim()){f.name=name.trim();saveAll();renderAnnalesHub();showNotif('Renommé','ok');}
};
function goBackFromCourse(){
  const c=courses.find(x=>x.id===curC);
  if(c&&c.subFolderId){showScreen('subfolder');}else{showScreen('matiere');}
}
function toggleQFav(){
  const q=session.qs[session.cur];if(!q)return;
  toggleFavorite(q.id);
  const btn=document.getElementById('qfav');if(!btn)return;
  const fav=isFavorite(q.id);
  btn.innerHTML=`<span class="ms f" style="font-size:18px;color:${fav?'var(--tertiary)':'var(--on-sv)'}">${fav?'star':'star_border'}</span>`;
}
function startFavorites(){
  const cq=questions.filter(q=>q.courseId===curC&&isFavorite(q.id));
  const desc=document.getElementById('fav-modal-desc');
  const list=document.getElementById('fav-modal-list');
  const launchBtn=document.getElementById('fav-modal-launch');
  if(desc)desc.textContent=cq.length?`${cq.length} question${cq.length>1?'s':''} en favori dans ce cours.`:'Aucune question en favori pour le moment.';
  if(launchBtn)launchBtn.style.display=cq.length?'':'none';
  if(list){
    list.innerHTML=cq.length?cq.map(q=>{
      const diff=getDiff(q.id);const db=getDiffBadge(diff);
      return `<div style="background:var(--surf-low);border-radius:var(--r-lg);padding:12px 14px;border:1px solid var(--border-subtle)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--on-surface);margin-bottom:6px;line-height:1.4">${q.question}</div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:12px;color:var(--on-sv)">✓ ${q.answers[q.correct]}</span>
              <span class="di-badge ${db.cls}">${db.text}</span>
            </div>
          </div>
          <button class="bico" onclick="toggleFavorite('${q.id}');startFavorites()" title="Retirer des favoris" style="flex-shrink:0"><span class="ms f" style="font-size:16px;color:var(--tertiary)">star</span></button>
        </div>
      </div>`;
    }).join(''):'<div class="muted" style="text-align:center;padding:20px 0">Aucun favori pour l\'instant.<br>Clique sur ⭐ pour en ajouter.</div>';
  }
  openModal('modal-fav');
}
function launchFavoritesQCM(){
  const cq=questions.filter(q=>q.courseId===curC&&isFavorite(q.id)&&!isBoycotted(q.id));
  if(!cq.length){showNotif('Aucun favori dans ce cours.','err');return;}
  const c=courses.find(x=>x.id===curC);
  closeModal('modal-fav');
  rBack='course';
  launchS(shuffle(cq),c?c.name+' — Favoris':'Favoris',false,false,false,false,false);
}
function startCourse(){
  const qs=questions.filter(q=>q.courseId===curC&&!isBoycotted(q.id));
  if(!qs.length){showNotif('Aucune question dans ce cours.','err');return;}
  const c=courses.find(x=>x.id===curC);
  window._blockQs=qs;window._blockTopic=c?c.name:'Cours';window._blockMode='course';
  window._blockIsAnnales=getAnnalesFlagForCurrent();
  document.getElementById('blocks-topic').textContent=window._blockTopic;
  _initBlocksModal(qs.length);
  const resumeSec=document.getElementById('blocks-resume-section');
  try{
    const saved=localStorage.getItem('kcu_resume');
    if(saved&&resumeSec){
      const data=JSON.parse(saved);
      if(data&&data.courseId===curC&&data.cur>0&&data.qids&&data.qids.length>data.cur){
        const remaining=data.qids.length-data.cur;
        document.getElementById('blocks-resume-info').textContent=`Question ${data.cur+1}/${data.qids.length} — ${remaining} restante${remaining>1?'s':''}`;
        resumeSec.style.display='block';
      }else{resumeSec.style.display='none';}
    }else if(resumeSec){resumeSec.style.display='none';}
  }catch(e){if(resumeSec)resumeSec.style.display='none';}
  openModal('modal-blocks');
}
function resumeFromBlocks(){closeModal('modal-blocks');resumeSession();}
function _initBlocksModal(n){
  document.getElementById('total-count').textContent=n;
  const f=document.getElementById('blocks-from');const t=document.getElementById('blocks-to');
  if(f)f.value=1;if(t)t.value=n;
  // reset difficulty pills to all active
  document.querySelectorAll('.diff-pill').forEach(p=>{p.classList.add('diff-pill-active');p.style.opacity='1';});
  _updateDiffCount();
}
function toggleDiffPill(diff){
  const pill=document.getElementById('diff-pill-'+diff);
  if(!pill)return;
  const active=document.querySelectorAll('.diff-pill.diff-pill-active');
  // prevent deselecting all
  if(pill.classList.contains('diff-pill-active')&&active.length===1)return;
  pill.classList.toggle('diff-pill-active');
  pill.style.opacity=pill.classList.contains('diff-pill-active')?'1':'0.35';
  _updateDiffCount();
}
function _getSelectedDiffs(){
  const sel=[];
  document.querySelectorAll('.diff-pill.diff-pill-active').forEach(p=>sel.push(p.dataset.diff));
  return sel;
}
function _updateDiffCount(){
  if(!window._blockQs)return;
  const sel=_getSelectedDiffs();
  const count=window._blockQs.filter(q=>sel.includes(getDiff(q.id))).length;
  const el=document.getElementById('blocks-diff-count');
  if(el)el.textContent=count+' question'+(count!==1?'s':'');
}
function _getFilteredBlockQs(){
  if(!window._blockQs)return[];
  const sel=_getSelectedDiffs();
  return window._blockQs.filter(q=>sel.includes(getDiff(q.id)));
}
function _getBlockRange(){
  const total=window._blockQs?window._blockQs.length:0;
  const fromEl=document.getElementById('blocks-from');
  const toEl=document.getElementById('blocks-to');
  let from=fromEl?Math.max(1,parseInt(fromEl.value)||1):1;
  let to=toEl?Math.min(total,parseInt(toEl.value)||total):total;
  if(from>to)from=to;
  return{from:from-1,to};
}
function launchAllQuestions(){
  if(!window._blockQs)return;
  closeModal('modal-blocks');
  window._blocks=null;window._currentBlock=undefined;
  rBack=window._blockMode;
  const bt=document.getElementById('blocks-shuffle-toggle');
  const{from,to}=_getBlockRange();
  const base=_getFilteredBlockQs();
  const sliced=base.slice(from,to);
  if(!sliced.length){showNotif('Aucune question pour ces difficultés.','err');return;}
  const qs=bt&&bt.checked?shuffle(sliced):[...sliced];
  launchS(qs,window._blockTopic,false,false,false,false,!!window._blockIsAnnales);
}
function launchWithBlocks(blockSize){
  if(!window._blockQs||!blockSize||blockSize<1)return;
  closeModal('modal-blocks');
  const bt=document.getElementById('blocks-shuffle-toggle');
  const{from,to}=_getBlockRange();
  const base=_getFilteredBlockQs();
  const sliced=base.slice(from,to);
  const qs=bt&&bt.checked?shuffle(sliced):[...sliced];
  const blocks=[];for(let i=0;i<qs.length;i+=blockSize)blocks.push(qs.slice(i,i+blockSize));
  if(!blocks.length){showNotif('Aucune question dans cette plage.','err');return;}
  window._blocks=blocks;window._currentBlock=0;window._blockSize=blockSize;
  rBack=window._blockMode;
  launchS(blocks[0],`${window._blockTopic} (Bloc ${1}/${blocks.length})`,false,false,false,false,!!window._blockIsAnnales);
}
function startSurvival(){
  closeModal('modal-pm');
  const avail=questions.filter(q=>!isBoycotted(q.id));
  if(avail.length<5){showNotif('Besoin d\'au moins 5 questions pour le Mode Survie.','err');return;}
  rBack='home';
  const endless=[];for(let i=0;i<Math.max(100,avail.length*2);i++)endless.push(avail[Math.floor(Math.random()*avail.length)]);
  launchS(endless,'Mode Survie',false,false,false,true,false);
}

// ════════════════════════════════════════════
// MODALS
// ════════════════════════════════════════════
function openModal(id){
  document.getElementById(id).classList.add('open');
  if(id==='modal-nf'){document.getElementById('nf-name').value='';selC=PAL[0];renderCP('nf-cp',PAL[0]);setTimeout(()=>document.getElementById('nf-name').focus(),120);}
  if(id==='modal-naf'){document.getElementById('naf-name').value='';selC=PAL[3];renderCP('naf-cp',PAL[3]);setTimeout(()=>document.getElementById('naf-name').focus(),120);}
  if(id==='modal-nc'){_ncMode='single';document.getElementById('nc-name').value='';document.getElementById('nc-single-fields').style.display='';document.getElementById('nc-bulk-fields').style.display='none';document.getElementById('nc-mode-single').className='btn btn-sm btn-p';document.getElementById('nc-mode-bulk').className='btn btn-sm btn-g';setTimeout(()=>document.getElementById('nc-name').focus(),120);}
  if(id==='modal-nsf'){document.getElementById('nsf-name').value='';setTimeout(()=>document.getElementById('nsf-name').focus(),120);}
  // modal-move has no autofocus needed
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function closeBg(e,id){if(e.target.id===id)closeModal(id);}
function openAddCourse(){openModal('modal-nc');}  // cours direct dans matière
function openAddSubFolder(){openModal('modal-nsf');}
function openAddCourseInSub(){openModal('modal-nc');}  // cours dans sous-dossier (même modal, saveCourse détecte curSF)
function openImport(){
  openModal('modal-import');
  document.getElementById('import-txt').value='';
  document.getElementById('iprev').innerHTML='';
  document.getElementById('ierr').style.display='none';
  const pb=document.getElementById('import-prompt-box');if(pb)pb.style.display='none';
  const cq=questions.filter(q=>q.courseId===curC);
  const sec=document.getElementById('import-existing-section');
  const body=document.getElementById('import-existing-body');
  const icon=document.getElementById('import-existing-icon');
  if(sec){
    if(cq.length){
      document.getElementById('import-existing-count').textContent=cq.length+' question'+(cq.length>1?'s':'');
      const L=['A','B','C','D','E','F','G','H'];
      document.getElementById('import-existing-txt').value=cq.map((q,i)=>{
        const lines=[`${i+1}. ${q.question}`];
        q.answers.forEach((a,j)=>lines.push(`${j===q.correct?'* ':''}${L[j]}. ${a}`));
        if(q.expl)lines.push(`Feedback : ${q.expl}`);
        return lines.join('\n');
      }).join('\n\n');
      sec.style.display='block';
      if(body)body.style.display='none';
      if(icon)icon.textContent='chevron_right';
    } else {
      sec.style.display='none';
    }
  }
}
function toggleImportExisting(){
  const body=document.getElementById('import-existing-body');
  const icon=document.getElementById('import-existing-icon');
  if(!body)return;
  const open=body.style.display!=='none';
  body.style.display=open?'none':'block';
  if(icon)icon.textContent=open?'chevron_right':'expand_more';
}

// ── EDIT Q ──
let eqid=null;
function openEQ(qid){
  eqid=qid;const q=questions.find(x=>x.id===qid);if(!q)return;
  document.getElementById('eq-q').value=q.question;document.getElementById('eq-expl').value=q.expl||'';document.getElementById('eq-err').style.display='none';
  document.getElementById('eq-ans').innerHTML=q.answers.map((a,i)=>`<div class="aedit"><input type="radio" name="eqr" value="${i}" class="rdc" ${i===q.correct?'checked':''}><input class="fi" id="eqa-${i}" value="${a}"></div>`).join('');
  const tagsEl=document.getElementById('eq-tags');if(tagsEl)tagsEl.value=(q.tags||[]).join(', ');
  openModal('modal-eq');
}
function saveEQ(){
  const q=questions.find(x=>x.id===eqid);if(!q)return;
  const qq=document.getElementById('eq-q').value.trim();const expl=document.getElementById('eq-expl').value.trim();
  const ans=q.answers.map((_,i)=>(document.getElementById('eqa-'+i)||{value:''}).value.trim());
  const cel=document.querySelector('input[name="eqr"]:checked');const err=document.getElementById('eq-err');
  if(!qq){err.textContent='La question ne peut pas être vide.';err.style.display='block';return;}
  if(ans.some(a=>!a)){err.textContent='Toutes les réponses doivent être remplies.';err.style.display='block';return;}
  if(!cel){err.textContent='Coche la bonne réponse.';err.style.display='block';return;}
  const tagsEl=document.getElementById('eq-tags');
  q.tags=tagsEl?tagsEl.value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean):q.tags||[];
  q.question=qq;q.answers=ans;q.correct=parseInt(cel.value);q.expl=expl;
  saveAll();closeModal('modal-eq');
  if(document.getElementById('screen-course').classList.contains('active'))renderCourse();
  if(document.getElementById('screen-manage').classList.contains('active'))renderManage();
  showNotif('Question mise à jour.','ok');
}

// ════════════════════════════════════════════
// FOLDER/COURSE CRUD
// ════════════════════════════════════════════
function saveFolder(){const name=document.getElementById('nf-name').value.trim();if(!name){showNotif('Donne un nom à la matière.','err');return;}folders.push({id:uid(),name,color:selC});saveAll();closeModal('modal-nf');renderHome();if(typeof renderMatieresHub==='function')renderMatieresHub();showNotif('Matière créée : '+name,'ok');}
function deleteFolder(fid){const f=folders.find(x=>x.id===fid);const fc=courses.filter(c=>c.folderId===fid);const nq=questions.filter(q=>fc.some(c=>c.id===q.courseId)).length;showConfirm(`Supprimer "${f.name}" ?`,`${fc.length} cours et ${nq} questions seront supprimés définitivement.`,'Supprimer',()=>{const cids=fc.map(c=>c.id);questions=questions.filter(q=>!cids.includes(q.courseId));courses=courses.filter(c=>c.folderId!==fid);subFolders=subFolders.filter(s=>s.folderId!==fid);folders=folders.filter(x=>x.id!==fid);delete archivedFolders[fid];// Nettoyer kp_exam_folders
const ef=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]').filter(id=>id!==fid);if(ef.length)localStorage.setItem('kp_exam_folders',JSON.stringify(ef));else localStorage.removeItem('kp_exam_folders');saveAll();renderHome();if(typeof renderDesktopSidebar==='function')renderDesktopSidebar();});}
let _ncMode = 'single';
function setNCMode(mode) {
  _ncMode = mode;
  document.getElementById('nc-single-fields').style.display = mode === 'single' ? '' : 'none';
  document.getElementById('nc-bulk-fields').style.display = mode === 'bulk' ? '' : 'none';
  document.getElementById('nc-mode-single').className = 'btn btn-sm ' + (mode === 'single' ? 'btn-p' : 'btn-g');
  document.getElementById('nc-mode-bulk').className = 'btn btn-sm ' + (mode === 'bulk' ? 'btn-p' : 'btn-g');
  if (mode === 'bulk') updateNCBulkPreview();
}
function updateNCBulkPreview() {
  const prefix = (document.getElementById('nc-prefix')?.value || 'Thème').trim();
  const from = parseInt(document.getElementById('nc-from')?.value) || 1;
  const to = parseInt(document.getElementById('nc-to')?.value) || 10;
  const count = Math.max(0, to - from + 1);
  const preview = document.getElementById('nc-bulk-preview');
  if (!preview) return;
  if (count <= 0) { preview.textContent = '⚠️ La valeur "à" doit être ≥ "de"'; return; }
  const examples = [];
  for (let i = from; i <= Math.min(from + 2, to); i++) examples.push(`${prefix} ${i}`);
  if (to > from + 2) examples.push('...');
  if (to > from + 2) examples.push(`${prefix} ${to}`);
  preview.textContent = `${count} cours : ${examples.join(', ')}`;
}
function saveCourse(){
  const inSub=document.getElementById('screen-subfolder').classList.contains('active');
  const sfid=inSub?curSF:null;
  if(_ncMode==='bulk'){
    const prefix=(document.getElementById('nc-prefix').value||'Thème').trim();
    const from=parseInt(document.getElementById('nc-from').value)||1;
    const to=parseInt(document.getElementById('nc-to').value)||10;
    if(to<from){showNotif('"À" doit être ≥ "De"','err');return;}
    const count=to-from+1;
    for(let i=from;i<=to;i++){courses.push({id:uid(),folderId:curF,subFolderId:sfid||null,name:`${prefix} ${i}`});}
    saveAll();closeModal('modal-nc');
    if(inSub){renderSubFolder();}else{renderMatiere();}
    showNotif(`${count} cours créés ✓`,'ok');
  } else {
    const name=document.getElementById('nc-name').value.trim();if(!name){showNotif('Donne un nom au cours.','err');return;}
    courses.push({id:uid(),folderId:curF,subFolderId:sfid||null,name});
    saveAll();closeModal('modal-nc');
    if(inSub){renderSubFolder();}else{renderMatiere();}
    showNotif('Cours créé : '+name,'ok');
  }
}
function saveSubFolder(){const name=document.getElementById('nsf-name').value.trim();if(!name){showNotif('Donne un nom au dossier.','err');return;}subFolders.push({id:uid(),folderId:curF,name});saveAll();closeModal('modal-nsf');renderMatiere();showNotif('Dossier créé : '+name,'ok');}
function deleteSubFolder(sfid){const sf=subFolders.find(x=>x.id===sfid);const sfCourses=courses.filter(c=>c.subFolderId===sfid);const nq=questions.filter(q=>sfCourses.some(c=>c.id===q.courseId)).length;showConfirm(`Supprimer "${sf.name}" ?`,`${sfCourses.length} cours et ${nq} questions seront supprimés définitivement.`,'Supprimer',()=>{const cids=sfCourses.map(c=>c.id);questions=questions.filter(q=>!cids.includes(q.courseId));courses=courses.filter(c=>c.subFolderId!==sfid);subFolders=subFolders.filter(x=>x.id!==sfid);saveAll();renderMatiere();});}
function openRenameFolder(fid){_renameFId=fid;const f=folders.find(x=>x.id===fid);if(!f)return;document.getElementById('rename-folder-input').value=f.name;openModal('modal-rename-folder');setTimeout(()=>document.getElementById('rename-folder-input').select(),120);}
function confirmRenameFolder(){const newName=document.getElementById('rename-folder-input').value.trim();if(!newName)return;const f=folders.find(x=>x.id===_renameFId);if(f){f.name=newName;saveAll();}closeModal('modal-rename-folder');renderMatiere();renderHome();showNotif('Matière renommée','ok');}
function openRenameSubFolder(sfid){_renameSFId=sfid;const sf=subFolders.find(x=>x.id===sfid);if(!sf)return;document.getElementById('rename-subfolder-input').value=sf.name;openModal('modal-rename-subfolder');setTimeout(()=>document.getElementById('rename-subfolder-input').select(),120);}
function confirmRenameSubFolder(){const newName=document.getElementById('rename-subfolder-input').value.trim();if(!newName)return;const sf=subFolders.find(x=>x.id===_renameSFId);if(sf){sf.name=newName;saveAll();}closeModal('modal-rename-subfolder');renderMatiere();renderSubFolder&&renderSubFolder();showNotif('Dossier renommé','ok');}
function setFolderSubSort(mode){_folderSubSortMode=mode;localStorage.setItem('kp-sf-sort',mode);renderMatiere();}
function setSubFolderSort(mode){_subFolderCourseSortMode=mode;localStorage.setItem('kp-sfc-sort',mode);renderSubFolder();}
function deleteCourse(cid){const c=courses.find(x=>x.id===cid);const nq=questions.filter(q=>q.courseId===cid).length;showConfirm(`Supprimer "${c.name}" ?`,`${nq} question${nq>1?'s':''} seront supprimées définitivement.`,'Supprimer',()=>{questions=questions.filter(q=>q.courseId!==cid);courses=courses.filter(x=>x.id!==cid);saveAll();if(c.subFolderId){renderSubFolder();}else{renderMatiere();}});}

// ════════════════════════════════════════════
// DÉPLACER UN COURS
// ════════════════════════════════════════════
let _moveCourseId=null;
function openMoveCourse(cid){
  _moveCourseId=cid;
  const c=courses.find(x=>x.id===cid);if(!c)return;
  const sfs=subFolders.filter(s=>s.folderId===c.folderId);
  document.getElementById('move-course-name').textContent=c.name;
  // Build destination list : racine de la matière + chaque dossier (sauf celui où il est déjà)
  const f=folders.find(x=>x.id===c.folderId);
  let html='';
  // Option : racine (pas de sous-dossier)
  const isAtRoot=!c.subFolderId;
  html+=`<div class="pi-pick" style="${isAtRoot?'opacity:.4;pointer-events:none':''}" onclick="moveCourse(null)">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="ms" style="font-size:18px">home</span>
      <div><div style="font-size:14px;font-weight:700">${f?f.name:'Matière'}</div><div style="font-size:12px;color:var(--on-sv)">Racine — sans dossier</div></div>
    </div>
    ${isAtRoot?'<span style="font-size:12px;color:var(--on-sv)">Position actuelle</span>':'<span class="ms" style="color:var(--on-sv)">chevron_right</span>'}
  </div>`;
  // Options : chaque sous-dossier
  sfs.forEach(sf=>{
    const isCurrent=c.subFolderId===sf.id;
    html+=`<div class="pi-pick" style="${isCurrent?'opacity:.4;pointer-events:none':''}" onclick="moveCourse('${sf.id}')">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="ms" style="font-size:18px">folder</span>
        <div><div style="font-size:14px;font-weight:700">${sf.name}</div><div style="font-size:12px;color:var(--on-sv)">${courses.filter(x=>x.subFolderId===sf.id).length} cours</div></div>
      </div>
      ${isCurrent?'<span style="font-size:12px;color:var(--on-sv)">Position actuelle</span>':'<span class="ms" style="color:var(--on-sv)">chevron_right</span>'}
    </div>`;
  });
  if(!sfs.length&&isAtRoot){
    html+=`<div style="font-size:13px;color:var(--on-sv);text-align:center;padding:12px">Aucun dossier disponible.<br>Crée d'abord un dossier dans cette matière.</div>`;
  }
  document.getElementById('move-dest-list').innerHTML=html;
  openModal('modal-move');
}
function moveCourse(destSfId){
  const c=courses.find(x=>x.id===_moveCourseId);if(!c)return;
  const prevSf=c.subFolderId;
  c.subFolderId=destSfId||null;
  saveAll();
  closeModal('modal-move');
  const sfName=destSfId?(subFolders.find(x=>x.id===destSfId)||{name:'dossier'}).name:'la racine';
  showNotif(`"${c.name}" déplacé vers ${sfName} ✓`,'ok');
  // Refresh the current screen
  if(prevSf){renderSubFolder();}else{renderMatiere();}
}

// ════════════════════════════════════════════
// SUPER PARSER — détecte tous les formats
// ════════════════════════════════════════════
function parseQCM(rawText){
  const result=[];

  // ── Nettoyage global ──
  const text=rawText
    .replace(/\r\n/g,'\n').replace(/\r/g,'\n')
    .replace(/\u00a0/g,' ')   // nbsp
    .replace(/\u2019/g,"'")   // smart quote
    .replace(/\u2013|\u2014/g,'-'); // em/en dash

  const rawLines=text.split('\n').map(l=>l.trim()).filter(l=>l);

  // ── Pré-processing PDF : fusionne les marqueurs seuls avec la ligne suivante ──
  // PDF.js extrait parfois "1)" et "Texte question" sur des lignes séparées (bold)
  const lines=[];
  for(let i=0;i<rawLines.length;i++){
    const l=rawLines[i];
    // Numéro seul : "1)" ou "1." → fusionner avec ligne suivante
    if(/^\d+\s*[\.\)]$/.test(l) && i+1<rawLines.length){
      lines.push(l+' '+rawLines[++i]);
    // Option seule : "a)" ou "a." → fusionner avec ligne suivante
    } else if(/^[a-dA-D][\.\)]$/.test(l) && i+1<rawLines.length){
      lines.push(l+' '+rawLines[++i]);
    } else {
      lines.push(l);
    }
  }

  // ── Fonctions utilitaires ──
  const cleanLine=l=>l
    .replace(/^\*\s*/,'')          // leading asterisk bullet
    .replace(/^[-–•]\s*/,'')       // dash/bullet
    .replace(/^\d+[\.\)]\s*/,'')   // leading number
    .replace(/^[A-Da-d][\.\)]\s*/,'') // leading letter A. B. etc.
    .replace(/^[A-Da-d]\s+/,'')    // leading letter with space (A Bonne réponse)
    .replace(/[✓✔☑★]/g,'')        // check marks
    .replace(/\(correct\)/i,'')
    .replace(/\(bonne\)/i,'')
    .replace(/^\*\*|\*\*$/g,'')    // bold markdown
    .trim();

  // Détecte si une ligne est la bonne réponse (marqueur explicite)
  const isBonneReponse=l=>{
    const t=l.trim();
    return /^bonne\s*r[eé]ponse\s*\d*\s*:/i.test(t)
      ||/^r[eé]ponse\s*correcte\s*(\d*|[A-D]?)\s*:/i.test(t)
      ||/^r[eé]ponse\s*juste\s*:/i.test(t)
      ||/^respuesta\s*correcta?\s*:/i.test(t)
      ||/^resposta\s*correta?\s*:/i.test(t)
      ||/^correct(?:a|e)?\s*:/i.test(t)
      ||/^answer\s*:/i.test(t);
  };

  // Détecte une lettre de réponse correcte : "Réponse correcte : C" ou "Respuesta correcta: C" etc.
  const extractCorrectLetter=l=>{
    const m=l.match(/(?:respuesta\s*correcta?|resposta\s*correta?|r[eé]ponse\s*(?:correcte?|juste)|bonne\s*r[eé]ponse|correct(?:a|e)?\s*(?=\s*[:=])|answer)\s*[:=]\s*([A-Da-d])\.?/i)
      ||l.match(/^(?:correcta?|correct[ao]?)\s*[:=]\s*([A-Da-d])\.?/i);
    return m?m[1].toUpperCase():null;
  };

  // Détecte si c'est une mauvaise réponse explicite
  const isMauvaiseReponse=l=>{
    const t=l.trim();
    return /^mauvaise\s*r[eé]ponse\s*\d*\s*:/i.test(t)
      ||/^r[eé]ponse\s*(incorrecte?|fausse?|mauvaise?)\s*\d*\s*:/i.test(t)
      ||/^distract(eur)?\s*\d*\s*:/i.test(t)
      ||/^faux\s*:/i.test(t)
      ||/^wrong\s*:/i.test(t);
  };

  // Détecte si c'est une explication/feedback
  const isFeedback=l=>{
    const t=l.trim();
    return /^feedback\s*:/i.test(t)
      ||/^explication\s*:/i.test(t)
      ||/^expl[i.]?\s*:/i.test(t)
      ||/^justification\s*:/i.test(t)
      ||/^commentaire\s*:/i.test(t)
      ||/^note\s*:/i.test(t)
      ||/^pourquoi\s*:/i.test(t)
      ||/^correction\s*:/i.test(t)
      ||/^r[eé]ponse\s*expliqu/i.test(t)
      ||/^hint\s*:/i.test(t);
  };

  const extractFeedback=l=>l
    .replace(/^feedback\s*:\s*/i,'')
    .replace(/^explication\s*:\s*/i,'')
    .replace(/^expl[i.]?\s*:\s*/i,'')
    .replace(/^justification\s*:\s*/i,'')
    .replace(/^commentaire\s*:\s*/i,'')
    .replace(/^note\s*:\s*/i,'')
    .replace(/^correction\s*:\s*/i,'')
    .replace(/^r[eé]ponse\s*expliqu\w*\s*:\s*/i,'')
    .replace(/^hint\s*:\s*/i,'')
    .trim();

  const extractBonne=l=>l
    .replace(/^bonne\s*r[eé]ponse\s*\d*\s*:\s*/i,'')
    .replace(/^r[eé]ponse\s*correcte\s*(\d*|[A-D]?)\s*:\s*/i,'')
    .replace(/^r[eé]ponse\s*juste\s*:\s*/i,'')
    .replace(/^correct\s*:\s*/i,'')
    .replace(/^answer\s*:\s*/i,'')
    .trim();

  const extractMauvaise=l=>l
    .replace(/^mauvaise\s*r[eé]ponse\s*\d*\s*:\s*/i,'')
    .replace(/^r[eé]ponse\s*(incorrecte?|fausse?|mauvaise?)\s*\d*\s*:\s*/i,'')
    .replace(/^distract(eur)?\s*\d*\s*:\s*/i,'')
    .replace(/^faux\s*:\s*/i,'')
    .replace(/^wrong\s*:\s*/i,'')
    .trim();

  // Détecter si une ligne est probablement une option de réponse (A. B. * A. etc.)
  const isOptionLine=l=>{
    const t=l.trim();
    return /^\*?\s*[A-Da-d][\.\)]\s+\S/.test(t)
      ||/^\*\s+[A-Da-d][\.\)]\s+\S/.test(t)
      ||/^[A-Da-d]\s+[A-Z]/.test(t); // A Majuscule
  };

  // ── Splitter les blocs de questions ──
  // Un bloc commence quand on détecte un numéro ou un pattern "Question N"
  const blockStarters=[
    /^\d+\s*[\.\)]\s+\S/,         // 1. ou 1) + contenu
    /^Question\s+\d+/i,           // Question 2
    /^Q\s*\d+\s*[\.\):-]/i,       // Q2. Q2) Q2:
    /^Énoncé\s*:/i,               // Énoncé :
    /^Question\s*\d*\s*[Éé]nonc/i // Question N Énoncé
  ];
  const isBlockStart=l=>blockStarters.some(r=>r.test(l.trim()));

  const blocks=[];let curBlock=null;
  lines.forEach(l=>{
    if(isBlockStart(l)){
      if(curBlock)blocks.push(curBlock);
      curBlock={head:l,rest:[]};
    } else if(curBlock){
      curBlock.rest.push(l);
    }
  });
  if(curBlock)blocks.push(curBlock);

  // Si aucun bloc détecté (pas de numérotation), essai de découpage par lignes vides ou par heuristique
  if(blocks.length===0){
    // Traitement fallback: regrouper par blocs séparés par des lignes vides dans le raw
    const rawBlocks=rawText.split(/\n\s*\n/).filter(b=>b.trim());
    rawBlocks.forEach(rb=>{
      const bLines=rb.split('\n').map(l=>l.trim()).filter(l=>l);
      if(bLines.length>=3){
        blocks.push({head:bLines[0],rest:bLines.slice(1)});
      }
    });
  }

  blocks.forEach(b=>{
    // ── Extraire la question ──
    let questionText=b.head
      .replace(/^Question\s+\d+\s*/i,'')       // "Question 2 "
      .replace(/^Q\s*\d+\s*[\.\):-]\s*/i,'')   // "Q2. "
      .replace(/^Énoncé\s*:\s*/i,'')            // "Énoncé : "
      .replace(/^\d+\s*[\.\)]\s*/,'')           // "1. "
      .trim();

    // Si le head contient "Énoncé" dans la même ligne
    const enonceMatch=b.head.match(/[Éé]nonc[eé]\s*:\s*(.+)/i);
    if(enonceMatch)questionText=enonceMatch[1].trim();

    if(!questionText||questionText.length<4)return;

    // ── Analyser les lignes du bloc ──
    const optionsMap={A:null,B:null,C:null,D:null}; // lettre → texte
    const bonnesExplicites=[];   // lignes "Bonne réponse : ..."
    const mauvaisesExplicites=[];// lignes "Mauvaise réponse : ..."
    const feedbacks=[];
    let correctLetter=null;      // lettre extraite de "Réponse correcte : C"
    let asteriskLines=[];        // lignes commençant par *

    b.rest.forEach(l=>{
      const lt=l.trim();

      // Feedback
      if(isFeedback(lt)){feedbacks.push(extractFeedback(lt));return;}

      // Réponse correcte par lettre
      const cl=extractCorrectLetter(lt);
      if(cl){correctLetter=cl;
        // La ligne peut aussi contenir du texte après la lettre
        const afterLetter=lt.replace(/.*(?:r[eé]ponse\s*correcte|bonne\s*r[eé]ponse|réponse\s*juste|correct|answer)\s*[:=]\s*[A-Da-d]\.?\s*/i,'').trim();
        if(afterLetter.length>2&&!afterLetter.match(/^[A-Da-d][\.\)]/))bonnesExplicites.push(afterLetter);
        return;
      }

      // Bonne réponse explicite
      if(isBonneReponse(lt)){bonnesExplicites.push(extractBonne(lt));return;}

      // Mauvaise réponse explicite
      if(isMauvaiseReponse(lt)){mauvaisesExplicites.push(extractMauvaise(lt));return;}

      // Option lettrée (A. B. * C. etc.)  — ou préfixée CORRECT: (depuis surlignage PDF)
      const highlighted=lt.startsWith('CORRECT:');
      const ltForOption=highlighted?lt.slice(8).trim():lt;
      if(isOptionLine(ltForOption)||highlighted){
        const asterisk=ltForOption.startsWith('*');
        const clean=ltForOption.replace(/^\*\s*/,'');
        const letterMatch=clean.match(/^([A-Da-d])[\.\)]\s*(.*)/);
        if(letterMatch){
          const letter=letterMatch[1].toUpperCase();
          const content=letterMatch[2].trim();
          optionsMap[letter]=content;
          if(asterisk||highlighted)asteriskLines.push(letter);
          return;
        }
        // "A Texte" sans ponctuation
        const letterSpace=clean.match(/^([A-Da-d])\s+(.+)/);
        if(letterSpace){
          const letter=letterSpace[1].toUpperCase();
          const content=letterSpace[2].trim();
          optionsMap[letter]=content;
          if(asterisk||highlighted)asteriskLines.push(letter);
          return;
        }
        // Texte brut surligné sans lettre — traiter comme bonne réponse explicite
        if(highlighted){bonnesExplicites.push(clean);return;}
      }

      // Ligne avec astérisque seul (marqueur bonne réponse)
      if(lt.startsWith('*')&&lt.length>2){
        asteriskLines.push(lt.replace(/^\*\s*/,''));
      }
    });

    // ── Reconstituer les réponses ──
    let answers=[];
    let correctIdx=0;

    // CAS 1 : Options lettrées trouvées (A,B,C,D)
    const hasLettered=Object.values(optionsMap).some(v=>v!==null);
    if(hasLettered){
      const letters=['A','B','C','D'];
      const available=letters.filter(l=>optionsMap[l]!==null);

      // Déterminer la lettre correcte
      let correctL=null;
      if(correctLetter&&optionsMap[correctLetter])correctL=correctLetter;
      else if(asteriskLines.length>0){
        // Chercher quelle lettre a l'astérisque
        asteriskLines.forEach(al=>{
          // al peut être une lettre seule ('A') ou 'A. texte'
          const m=al.match(/^([A-Da-d])[\.\)]?\s*(.*)/);
          if(m&&optionsMap[m[1].toUpperCase()])correctL=m[1].toUpperCase();
        });
      }
      else if(bonnesExplicites.length>0){
        // Trouver la lettre dont le contenu correspond à la bonne réponse
        const bText=bonnesExplicites[0].toLowerCase().trim();
        available.forEach(l=>{
          if(optionsMap[l].toLowerCase().trim()===bText)correctL=l;
        });
        // Si pas trouvé, la bonne réponse explicite elle-même
        if(!correctL)bonnesExplicites.forEach(b=>answers.push({text:b,correct:true}));
      }

      if(correctL){
        // Garder l'ordre original A/B/C/D, correctIdx = position de la bonne lettre
        answers=available.map(l=>optionsMap[l]).filter(Boolean);
        correctIdx=available.indexOf(correctL);
        if(correctIdx<0)correctIdx=0;
      } else {
        // Pas de marqueur clair : toutes les options dans l'ordre, défaut 0
        answers=available.map(l=>optionsMap[l]).filter(Boolean);
        correctIdx=0;
      }
    }
    // CAS 2 : Format explicite (Bonne réponse + Mauvaises réponses)
    else if(bonnesExplicites.length>0||mauvaisesExplicites.length>0){
      if(bonnesExplicites.length>0){
        answers=[bonnesExplicites[0],...mauvaisesExplicites.slice(0,3)];
        correctIdx=0;
      } else {
        answers=mauvaisesExplicites.slice(0,4);
        correctIdx=0;
      }
    }
    // CAS 3 : Lignes avec astérisque sans lettre
    else if(asteriskLines.length>0){
      const goodLines=b.rest.filter(l=>l.trim().startsWith('*')).map(l=>cleanLine(l)).filter(l=>l);
      const badLines=b.rest.filter(l=>!l.trim().startsWith('*')&&!isFeedback(l.trim())&&!isBonneReponse(l.trim())&&!isMauvaiseReponse(l.trim())).map(l=>cleanLine(l)).filter(l=>l&&l.length>2);
      if(goodLines.length>0){answers=[goodLines[0],...badLines.slice(0,3)];correctIdx=0;}
    }
    // CAS 4 : Aucun marqueur — prendre les lignes restantes comme réponses
    else {
      const rawAns=b.rest.filter(l=>!isFeedback(l.trim())&&!isBonneReponse(l.trim())&&!isMauvaiseReponse(l.trim())).map(l=>cleanLine(l)).filter(l=>l&&l.length>2);
      answers=rawAns.slice(0,4);
      correctIdx=0;
    }

    // S'assurer que les réponses sont uniques et non vides
    answers=answers.filter((a,i,arr)=>a&&a.length>0&&arr.indexOf(a)===i);

    if(answers.length>=2){
      result.push({
        question:questionText,
        answers:answers.slice(0,4),
        correct:correctIdx,
        expl:feedbacks.join(' ').trim()
      });
    }
  });

  return result;
}

function previewParse(){
  const text=document.getElementById('import-txt').value;
  if(!text.trim()){document.getElementById('iprev').innerHTML='';return;}
  const p=parseQCM(text);
  if(!p.length){
    document.getElementById('iprev').innerHTML=`<div class="iprev"><span class="parse-tag parse-warn"><span class="ms" style="font-size:13px;vertical-align:middle">warning</span> Aucune question détectée</span> — assure-toi que chaque question a un numéro ou "Question N"</div>`;
    return;
  }
  const withExpl=p.filter(q=>q.expl).length;
  document.getElementById('iprev').innerHTML=`<div class="iprev">
    <span class="parse-tag parse-ok">✓ ${p.length} question${p.length>1?'s':''} détectée${p.length>1?'s':''}</span>
    ${withExpl>0?`<span class="parse-tag parse-ok" style="margin-left:6px"><span class="ms" style="font-size:12px;vertical-align:middle">lightbulb</span> ${withExpl} avec explication</span>`:''}
    ${p.slice(0,3).map(q=>`<div class="prow">• ${q.question.substring(0,60)}${q.question.length>60?'…':''}<br>
      <span style="color:var(--tertiary);font-size:11px">✓ ${q.answers[q.correct]}</span>
      ${q.expl?`<span style="color:var(--gold);font-size:11px;margin-left:8px"><span class="ms" style="font-size:11px;vertical-align:middle">lightbulb</span> ${q.expl.substring(0,40)}…</span>`:''}
    </div>`).join('')}
    ${p.length>3?`<div class="prow" style="color:var(--on-sv)">… et ${p.length-3} de plus</div>`:''}
  </div>`;
}

function doImport(){
  const text=document.getElementById('import-txt').value;const err=document.getElementById('ierr');
  err.style.display='none';
  if(!text.trim()){err.textContent='Colle ton QCM.';err.style.display='block';return;}
  if(!curC||!courses.some(c=>c.id===curC)){err.textContent='Ouvre d\'abord un cours : les questions y seront ajoutées.';err.style.display='block';return;}
  let p=parseQCM(text);
  if(!p.length){err.textContent='Aucune question détectée. Chaque question doit commencer par un numéro (1. 2. …) ou "Question N".';err.style.display='block';return;}
  // Bouton « Ordre aléatoire à l'import » (n'était pas pris en compte)
  const sh=document.getElementById('import-shuffle-toggle');if(sh&&sh.checked)p=shuffle(p);
  const added=p.map(q=>({id:uid(),courseId:curC,question:q.question,answers:q.answers,correct:q.correct,expl:q.expl||''}));
  questions.push(...added);
  if(!saveAll({quiet:true})){
    // Échec (mémoire du navigateur pleine…) : avant, le bouton ne faisait rien sans rien dire.
    // On annule l'ajout pour ne pas garder des questions qui disparaîtraient au rechargement.
    const e=window._kineSaveError,ids=new Set(added.map(q=>q.id));
    questions=questions.filter(q=>!ids.has(q.id));saveAll({quiet:true});
    err.innerHTML=kineSaveErrorHTML('Import',e);err.style.display='block';
    return;
  }
  closeModal('modal-import');renderCourse();
  showNotif(`${p.length} question${p.length>1?'s':''} importée${p.length>1?'s':''} !`,'ok');
}

function delQ(qid){
  showConfirm('Supprimer cette question ?','Cette action est irréversible.','Supprimer',()=>{
    questions=questions.filter(q=>q.id!==qid);saveAll();
    if(document.getElementById('screen-course').classList.contains('active'))renderCourse();
    if(document.getElementById('screen-manage').classList.contains('active'))renderManage();
    showNotif('Question supprimée.','');
  });
}

// ════════════════════════════════════════════
// SESSIONS + TIMER
// ════════════════════════════════════════════
let session={qs:[],cur:0,correct:0,answers:[],mode:'',isFlash:false,isRetry:false,isHard:false,isAnnales:false};
let sessionStart=0;
let timerInterval=null;
let questionStartTime=0;

function startFlash(){const avail=questions.filter(q=>!isBoycotted(q.id));if(!avail.length){showNotif('Aucune question disponible.','err');return;}rBack='home';launchS(shuffle(avail).slice(0,Math.min(10,avail.length)),'Flash rapide',true,false,false);}
function startAll(){const avail=questions.filter(q=>!isBoycotted(q.id));if(!avail.length){showNotif('Aucune question disponible.','err');return;}rBack='home';launchS(shuffle(avail),'Tout mélangé',false,false,false);}
function startHard(){const h=getHardQs().filter(q=>!isBoycotted(q.id));if(!h.length){showNotif('Pas encore de questions difficiles !','err');return;}rBack='home';launchS(shuffle(h),'Questions dures',false,false,true);}

function openPickMatiere(mode){
  if(!folders.length){showNotif('Aucune matière créée.','err');return;}
  const isSv=mode==='survival';
  document.getElementById('pm-title').textContent=isSv?'Mode Survie — Choisir une matière':'Réviser par matière';
  document.getElementById('pm-desc').textContent=isSv?'3 vies · Questions infinies dans la matière choisie.':'Toutes les questions mélangées.';
  openModal('modal-pm');
  const allAvail=questions.filter(q=>!isBoycotted(q.id));
  const allRow=isSv?`<div class="pi-pick" onclick="startSurvival()">
    <div style="display:flex;align-items:center;gap:10px"><div style="width:10px;height:10px;border-radius:50%;background:var(--primary)"></div><div><div style="font-family:'Manrope',sans-serif;font-size:14px;font-weight:700">Toutes les matières</div><div style="font-size:12px;color:var(--on-sv)">${allAvail.length} question${allAvail.length!==1?'s':''}</div></div></div>
    <span class="ms" style="color:var(--on-sv)">chevron_right</span>
  </div>`:'';
  document.getElementById('pm-list').innerHTML=allRow+folders.map(f=>{
    const fc=courses.filter(c=>c.folderId===f.id);const fq=questions.filter(q=>fc.some(c=>c.id===q.courseId)&&!isBoycotted(q.id));
    const cb=isSv?`startSurvivalById('${f.id}')`:`startMById('${f.id}')`;
    return `<div class="pi-pick" onclick="${cb}">
      <div style="display:flex;align-items:center;gap:10px"><div style="width:10px;height:10px;border-radius:50%;background:${f.color}"></div><div><div style="font-family:'Manrope',sans-serif;font-size:14px;font-weight:700">${f.name}</div><div style="font-size:12px;color:var(--on-sv)">${fq.length} question${fq.length!==1?'s':''}</div></div></div>
      <span class="ms" style="color:var(--on-sv)">chevron_right</span>
    </div>`;
  }).join('');
}
function startMById(fid){
  closeModal('modal-pm');const fc=courses.filter(c=>c.folderId===fid);const qs=questions.filter(q=>fc.some(c=>c.id===q.courseId));
  if(!qs.length){showNotif('Aucune question dans cette matière.','err');return;}
  const f=folders.find(x=>x.id===fid);rBack='home';launchS(shuffle(qs),f?f.name:'Matière',false,false,false);
}
function startSurvivalById(fid){
  closeModal('modal-pm');
  const fc=courses.filter(c=>c.folderId===fid);
  const avail=questions.filter(q=>fc.some(c=>c.id===q.courseId)&&!isBoycotted(q.id));
  if(avail.length<5){showNotif('Besoin d\'au moins 5 questions pour le Mode Survie.','err');return;}
  const f=folders.find(x=>x.id===fid);
  rBack='home';
  const endless=[];for(let i=0;i<Math.max(100,avail.length*2);i++)endless.push(avail[Math.floor(Math.random()*avail.length)]);
  launchS(endless,`Mode Survie · ${f?f.name:'Matière'}`,false,false,false,true,false);
}
function launchSRS(){
  const qs=getSRSDueQuestions();
  if(!qs.length){showNotif('Aucune question à réviser pour aujourd\'hui !','ok');return;}
  rBack='home';launchS(shuffle(qs),'Révision SRS',false,false,false,false,false);
}

// ════════════════════════════════════════════
// RECHERCHE GLOBALE
// ════════════════════════════════════════════
let _searchIdx=0;
function openSearch(){
  const ov=document.getElementById('search-overlay');if(!ov)return;
  ov.classList.add('open');
  const inp=document.getElementById('search-input');if(inp){inp.value='';inp.focus();}
  document.getElementById('search-results').innerHTML='<div class="sr-hint">Tape pour chercher dans tes questions, cours et matières</div>';
}
function closeSearch(e){
  if(e&&e.target!==document.getElementById('search-overlay')&&!e.target.classList.contains('search-close'))return;
  const ov=document.getElementById('search-overlay');if(ov)ov.classList.remove('open');
}
function renderSearch(q){
  const el=document.getElementById('search-results');if(!el)return;
  const t=q.trim().toLowerCase();
  if(t.length<2){el.innerHTML='<div class="sr-hint">Tape au moins 2 caractères</div>';return;}
  const res=[];

  // Matières
  folders.filter(x=>x.name.toLowerCase().includes(t)).forEach(x=>{
    const nq=questions.filter(q=>courses.filter(c=>c.folderId===x.id).some(c=>c.id===q.courseId)).length;
    res.push({type:'f',label:x.name,sub:`Matière · ${nq} question${nq!==1?'s':''}`,fid:x.id,color:x.color,priority:0});
  });
  // Sous-dossiers
  subFolders.filter(x=>x.name.toLowerCase().includes(t)).forEach(x=>{
    const f=folders.find(fv=>fv.id===x.folderId);
    const nq=questions.filter(q=>courses.filter(c=>c.subFolderId===x.id).some(c=>c.id===q.courseId)).length;
    res.push({type:'sf',label:x.name,sub:`${f?f.name+' · ':''}Dossier · ${nq} question${nq!==1?'s':''}`,sfid:x.id,fid:x.folderId,priority:1});
  });
  // Cours
  courses.filter(x=>x.name.toLowerCase().includes(t)).forEach(x=>{
    const f=folders.find(fv=>fv.id===x.folderId);
    const sf=x.subFolderId?subFolders.find(s=>s.id===x.subFolderId):null;
    const nq=questions.filter(q=>q.courseId===x.id).length;
    res.push({type:'c',label:x.name,sub:`${f?f.name:''}${sf?' › '+sf.name:''} · ${nq} question${nq!==1?'s':''}`,cid:x.id,priority:2});
  });
  // Questions
  questions.filter(x=>!isBoycotted(x.id)).forEach(x=>{
    if(!x.question.toLowerCase().includes(t)&&!(x.expl||'').toLowerCase().includes(t)&&!((x.tags||[]).some(tg=>tg.includes(t))))return;
    const c=courses.find(cv=>cv.id===x.courseId);const f=c?folders.find(fv=>fv.id===c.folderId):null;
    const sf=c&&c.subFolderId?subFolders.find(s=>s.id===c.subFolderId):null;
    const breadcrumb=[f?f.name:null,sf?sf.name:null,c?c.name:null].filter(Boolean).join(' › ');
    res.push({type:'q',label:x.question,sub:breadcrumb,q:x,diff:getDiff(x.id),cid:x.courseId,fid:f?f.id:null,priority:3});
  });
  // Tags
  const tagMatches={};
  questions.forEach(x=>{(x.tags||[]).forEach(tg=>{if(tg.includes(t))tagMatches[tg]=(tagMatches[tg]||0)+1;});});
  Object.entries(tagMatches).forEach(([tg,n])=>res.push({type:'tag',label:tg,sub:`Tag · ${n} question${n>1?'s':''}`,tag:tg,priority:4}));

  res.sort((a,b)=>a.priority-b.priority);

  if(!res.length){el.innerHTML='<div class="sr-hint">Aucun résultat pour « '+q+' »</div>';return;}
  _searchIdx=0;
  const icons={q:'help_outline',c:'book',f:'folder',sf:'folder_open',tag:'label'};
  const typeLabel={f:'Matière',sf:'Dossier',c:'Cours',q:'Question',tag:'Tag'};
  el.innerHTML=res.slice(0,15).map((r,i)=>{
    const diff=r.diff&&r.diff!=='new'?`<span class="sr-diff sr-diff-${r.diff}"></span>`:'';
    const editBtn=r.type==='q'?`<button class="sr-edit" onclick="event.stopPropagation();_searchClose();openEQ('${r.q.id}')" title="Modifier"><span class="ms" style="font-size:15px">edit</span></button>`:'';
    return `<div class="sr-item${i===0?' sr-focus':''}" data-i="${i}" onclick="_searchGo(${i})" onmouseover="_searchHover(${i})">
      <div class="sr-ico-wrap sr-ico-${r.type}"><span class="ms" style="font-size:16px">${icons[r.type]}</span></div>
      <div class="sr-body">
        <div class="sr-label">${diff}${r.label.length>120?r.label.slice(0,120)+'…':r.label}</div>
        <div class="sr-sub">${r.sub}</div>
      </div>
      <div class="sr-actions">
        <span class="sr-type-badge">${typeLabel[r.type]}</span>
        ${editBtn}
      </div>
    </div>`;
  }).join('');
  el._res=res.slice(0,15);
}
function _searchClose(){const ov=document.getElementById('search-overlay');if(ov)ov.classList.remove('open');}
function _searchHover(i){_searchIdx=i;document.querySelectorAll('.sr-item').forEach((el,j)=>el.classList.toggle('sr-focus',j===i));}
function _searchGo(i){
  const el=document.getElementById('search-results');
  const res=el._res;if(!res||!res[i])return;
  const r=res[i];
  _searchClose();
  if(r.type==='f'){openFolder(r.fid);}
  else if(r.type==='sf'){curF=r.fid;openSubFolder(r.sfid);}
  else if(r.type==='c'){
    const c=courses.find(x=>x.id===r.cid);
    if(c){curF=c.folderId;if(c.subFolderId)curSF=c.subFolderId;}
    openCourse(r.cid);
  }
  else if(r.type==='q'){
    const c=courses.find(x=>x.id===r.cid);
    if(c){curF=c.folderId;if(c.subFolderId)curSF=c.subFolderId;openCourse(c.id);}
  }
  else if(r.type==='tag'){
    const qs=questions.filter(x=>!isBoycotted(x.id)&&(x.tags||[]).includes(r.tag));
    if(qs.length)launchS(shuffle(qs),'Tag : '+r.tag,false,false,false,false,false);
  }
}

// ════════════════════════════════════════════
// PLAN DE RÉVISION
// ════════════════════════════════════════════
function renderPlanHomeCard(){
  const el=document.getElementById('plan-home-card');if(!el)return;
  const plan=getExamPlan();
  if(!plan){el.style.display='none';return;}
  el.style.display='block';

  const phaseColor={learn:'var(--tertiary)',review:'var(--gold)',intense:'#f97316',sprint:'var(--error)'};
  const statusIcon={ok:'check_circle',warning:'warning',critical:'error'};
  const statusColor={ok:'var(--tertiary)',warning:'var(--gold)',critical:'var(--error)'};
  const top=plan.todayTop.slice(0,3);

  el.innerHTML=`
  <div class="plan-home-wrap" onclick="showScreen('plan')">
    <div class="plan-home-head">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="ms" style="font-size:18px;color:${phaseColor[plan.phase]}">event_available</span>
        <div>
          <div style="font-size:12px;font-weight:800;color:${phaseColor[plan.phase]};text-transform:uppercase;letter-spacing:.8px">${plan.phaseLabel}</div>
          <div style="font-size:13px;font-weight:700;color:var(--on-surface)">J−${plan.daysLeft} · ${plan.examName}</div>
        </div>
      </div>
      <span class="ms" style="color:var(--on-sv)">chevron_right</span>
    </div>
    <div style="font-size:11.5px;color:var(--on-sv);margin-bottom:10px;line-height:1.5">${plan.phaseDesc}</div>
    <div class="plan-home-topics">
      ${top.map(s=>`
        <div class="plan-topic-pill" style="border-left:3px solid ${statusColor[s.status]}">
          <span class="ms" style="font-size:13px;color:${statusColor[s.status]}">${statusIcon[s.status]}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:var(--on-surface);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.folder.name}</div>
            <div style="font-size:10px;color:var(--on-sv)">${s.byDiff.hard||0} difficile${(s.byDiff.hard||0)>1?'s':''} · ${s.coverage}% couvert</div>
          </div>
          <button class="btn btn-sm btn-p" style="padding:4px 10px;font-size:11px;flex-shrink:0" onclick="event.stopPropagation();startMById('${s.folder.id}')">Réviser</button>
        </div>`).join('')}
    </div>
  </div>`;
}

function _planDayLabel(date,offset){
  if(offset===0)return "Aujourd'hui";
  if(offset===1)return 'Demain';
  return date.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
}
function generateSchedule(plan){
  if(!plan||plan.daysLeft<=0)return[];
  const today=new Date();today.setHours(0,0,0,0);

  // Tous les thèmes sont inclus (même ceux maîtrisés — ils ont besoin de révision)
  const pool=plan.folderScores.map(s=>({
    id:s.folder.id,name:s.folder.name,color:s.folder.color||'var(--primary)',
    status:s.status,
    urgency:(s.byDiff.hard||0)*3+(s.byDiff.medium||0)*2+(s.byDiff.new||0)*1+(s.byDiff.easy||0)*0.5,
    score:s.score,
    cooldown:0 // jours avant de pouvoir réapparaître
  }));

  if(!pool.length)return[];

  // Espacer les thèmes : un thème révisé aujourd'hui ne réapparaît pas avant N jours
  const spacing=Math.max(1,Math.floor(pool.length/(2)));

  const schedule=[];
  const limit=Math.min(plan.daysLeft,365);

  for(let i=0;i<limit;i++){
    const date=new Date(today);date.setDate(today.getDate()+i);
    const daysRemaining=plan.daysLeft-i;
    const isToday=i===0;
    const isSprint=daysRemaining<=2;
    const isWeekend=date.getDay()===0||date.getDay()===6;

    if(isSprint){
      schedule.push({date,label:_planDayLabel(date,i),topics:[{name:'Sprint final',color:'#dc2626',type:'sprint'}],isToday,isSprint:true});
      pool.forEach(w=>w.cooldown=Math.max(0,w.cooldown-1));
      continue;
    }

    // Sélectionner les thèmes disponibles (cooldown=0), triés par urgence décroissante
    const available=pool.filter(w=>w.cooldown===0).sort((a,b)=>b.urgency-a.urgency);
    const slotCount=isWeekend?1:2;
    // Si pas assez de disponibles, prendre aussi ceux avec le plus petit cooldown
    const fallback=pool.filter(w=>w.cooldown>0).sort((a,b)=>a.cooldown-b.cooldown);
    const candidates=[...available,...fallback];
    const pick=candidates.slice(0,slotCount);

    const topics=[];
    pick.forEach(w=>{
      w.cooldown=spacing; // ne réapparaît pas avant spacing jours
      // Baisser l'urgence légèrement après révision (thème traité)
      w.urgency=Math.max(0.5,w.urgency*0.85);
      topics.push({id:w.id,name:w.name,color:w.color,status:w.status});
    });

    schedule.push({date,label:_planDayLabel(date,i),topics,isToday,isWeekend});
    pool.forEach(w=>w.cooldown=Math.max(0,w.cooldown-1));
  }
  return schedule;
}

function renderPlan(){
  const el=document.getElementById('plan-content');if(!el)return;
  const plan=getExamPlan();
  if(!plan){
    el.innerHTML=`<div class="plan-empty"><span class="ms" style="font-size:48px;color:var(--on-sv)">event</span><div style="font-size:16px;font-weight:800;margin-top:12px">Aucune date d'examen</div><div style="font-size:13px;color:var(--on-sv);margin-top:6px">Configure la date dans les paramètres (icône ⚙️ en haut)</div></div>`;
    return;
  }

  const phaseGrad={learn:'135deg,var(--tertiary-fixed),var(--tertiary-dim)',review:'135deg,var(--gold-l),var(--gold)',intense:'135deg,var(--primary-fixed),var(--primary-c)',sprint:'135deg,var(--error-c),var(--error)'};
  const statusIcon={ok:'check_circle',warning:'warning',critical:'error'};
  const statusLabel={ok:'Dans les temps',warning:'À surveiller',critical:'Retard critique'};
  const statusColor={ok:'var(--tertiary)',warning:'var(--gold)',critical:'var(--error)'};

  const allFQ=plan.folderScores;
  const avgMastery=allFQ.length?Math.round(allFQ.reduce((s,f)=>s+f.mastery,0)/allFQ.length):0;
  const avgCoverage=allFQ.length?Math.round(allFQ.reduce((s,f)=>s+f.coverage,0)/allFQ.length):0;
  const critical=allFQ.filter(f=>f.status==='critical').length;
  const warning=allFQ.filter(f=>f.status==='warning').length;

  // ── Génère l'agenda jour par jour
  const schedule=generateSchedule(plan);
  const scheduleHTML=schedule.map(day=>{
    const dateStr=day.date.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    const topicsHTML=day.topics.map(t=>`
      <div class="agenda-chip" style="background:${t.color}22;border-left:3px solid ${t.color};${day.isSprint?'background:#dc262620;border-color:#dc2626':''}" onclick="${t.id?`event.stopPropagation();startMById('${t.id}')`:''}">
        <div style="font-size:12px;font-weight:700;color:var(--on-surface)">${t.name}</div>
      </div>`).join('');
    return `
      <div class="agenda-day${day.isToday?' agenda-today':''}${day.isSprint?' agenda-sprint':''}${day.isWeekend?' agenda-weekend':''}">
        <div class="agenda-date-col">
          <div class="agenda-day-num${day.isToday?' agenda-day-today':''}">${day.date.getDate()}</div>
          <div class="agenda-day-name">${day.date.toLocaleDateString('fr-FR',{weekday:'short'})}</div>
        </div>
        <div class="agenda-topics">${topicsHTML}</div>
      </div>`;
  }).join('');

  // ── Render HTML en grille 2 colonnes
  el.innerHTML=`<div class="plan-grid">

    <!-- Colonne gauche : analyse -->
    <div class="plan-left">
      <div class="plan-hero" style="background:linear-gradient(${phaseGrad[plan.phase]});position:relative">
        <button onclick="openExamEditModal()" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,.15);border:none;border-radius:8px;padding:5px 8px;cursor:pointer;color:#fff;display:flex;align-items:center;gap:3px;font-family:inherit"><span class="ms" style="font-size:15px">edit</span></button>
        <div class="plan-hero-phase">${plan.phaseLabel}</div>
        <div class="plan-hero-days">J−${plan.daysLeft}</div>
        <div class="plan-hero-exam">${plan.examName}</div>
        <div class="plan-hero-desc">${plan.phaseDesc}</div>
      </div>

      <div class="plan-section">
        <div class="plan-section-title">Vue d'ensemble</div>
        <div class="plan-stats-row">
          <div class="plan-stat"><div class="plan-stat-val">${avgCoverage}%</div><div class="plan-stat-lbl">Couverture</div></div>
          <div class="plan-stat"><div class="plan-stat-val" style="color:var(--tertiary)">${avgMastery}%</div><div class="plan-stat-lbl">Maîtrise</div></div>
          <div class="plan-stat"><div class="plan-stat-val" style="color:${critical>0?'var(--error)':'var(--on-sv)'}">${critical}</div><div class="plan-stat-lbl">Critiques</div></div>
          <div class="plan-stat"><div class="plan-stat-val" style="color:${warning>0?'var(--gold)':'var(--on-sv)'}">${warning}</div><div class="plan-stat-lbl">À surveiller</div></div>
        </div>
        <div class="plan-global-bar">
          <div style="height:6px;background:var(--surf-highest);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${avgMastery}%;background:linear-gradient(90deg,var(--tertiary),#00c8b8);border-radius:3px;transition:width .6s var(--ease)"></div>
          </div>
          <div style="font-size:11px;color:var(--on-sv);margin-top:4px">Objectif journalier conseillé : <strong style="color:var(--on-surface)">${plan.dynamicGoal} questions</strong></div>
        </div>
      </div>

      <div class="plan-section">
        <div class="plan-section-title">Priorités d'aujourd'hui</div>
        ${plan.todayTop.map((s,i)=>`
          <div class="plan-topic-card">
            <div class="plan-topic-header">
              <div class="plan-rank">${i+1}</div>
              <div style="flex:1">
                <div style="font-size:15px;font-weight:800;color:var(--on-surface)">${s.folder.name}</div>
                <div class="plan-status-row">
                  <span class="ms" style="font-size:12px;color:${statusColor[s.status]}">${statusIcon[s.status]}</span>
                  <span style="font-size:11px;color:${statusColor[s.status]};font-weight:700">${statusLabel[s.status]}</span>
                  ${s.daysSinceStudied<999?`<span style="font-size:11px;color:var(--on-sv)">· vu il y a ${s.daysSinceStudied}j</span>`:'<span style="font-size:11px;color:var(--error)">· jamais révisé</span>'}
                </div>
              </div>
              <button class="btn btn-p" style="padding:8px 14px;font-size:12px;flex-shrink:0" onclick="startMById('${s.folder.id}')"><span class="ms" style="font-size:14px">play_arrow</span> Réviser</button>
            </div>
            <div class="plan-diff-bar">
              ${s.byDiff.hard?`<div class="plan-diff-seg" style="flex:${s.byDiff.hard};background:var(--error)"></div>`:''}
              ${s.byDiff.medium?`<div class="plan-diff-seg" style="flex:${s.byDiff.medium};background:var(--gold)"></div>`:''}
              ${s.byDiff.new?`<div class="plan-diff-seg" style="flex:${s.byDiff.new};background:var(--surf-highest)"></div>`:''}
              ${s.byDiff.easy?`<div class="plan-diff-seg" style="flex:${s.byDiff.easy};background:var(--tertiary);opacity:.4"></div>`:''}
            </div>
            <div class="plan-topic-meta">
              <span><i class="kh-dot" style="--d:var(--error)"></i>${s.byDiff.hard||0} difficiles</span>
              <span><i class="kh-dot" style="--d:var(--gold)"></i>${s.byDiff.medium||0} moyens</span>
              <span><i class="kh-dot" style="--d:var(--outline-v)"></i>${s.byDiff.new||0} nouveaux</span>
              <span><i class="kh-dot" style="--d:#12A35E"></i>${s.mastery}% maîtrisé</span>
            </div>
          </div>`).join('')}
      </div>

      <div class="plan-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="plan-section-title" style="margin:0">Matières incluses</div>
          <button class="btn btn-sm btn-g" style="font-size:11px;padding:5px 10px" onclick="_openPlanFolderManager()"><span class="ms" style="font-size:13px;vertical-align:middle">tune</span> Gérer</button>
        </div>
        ${allFQ.map(s=>{
          const examFids=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]');
          const isSelected=!examFids.length||examFids.includes(s.folder.id);
          return `<div class="plan-row${isSelected?'':' plan-row-dim'}" style="opacity:${isSelected?1:.45}">
            <div style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${s.folder.color||statusColor[s.status]}"></div>
            <div style="flex:1;min-width:0;cursor:pointer" onclick="startMById('${s.folder.id}')">
              <div style="font-size:13px;font-weight:700;color:var(--on-surface);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.folder.name}</div>
              <div style="font-size:11px;color:var(--on-sv)">${s.coverage}% couvert · ${s.byDiff.hard||0} dur${(s.byDiff.hard||0)>1?'s':''}</div>
            </div>
            <div style="font-size:13px;font-weight:800;color:${statusColor[s.status]};flex-shrink:0">${s.mastery}%</div>
          </div>`;
        }).join('')}
        ${(()=>{
          // Matières exclues du plan (actives mais pas sélectionnées)
          const examFids=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]');
          if(!examFids.length)return '';
          const activeFolders=folders.filter(f=>f.type!=='annales'&&!isFolderArchived(f.id));
          const excluded=activeFolders.filter(f=>!examFids.includes(f.id));
          if(!excluded.length)return '';
          return `<div style="margin-top:10px;padding:10px 12px;background:var(--surf-low);border-radius:10px">
            <div style="font-size:11px;color:var(--on-sv);font-weight:600;margin-bottom:6px">Non incluses dans ce plan</div>
            ${excluded.map(f=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border-subtle)">
              <div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${f.color||'var(--primary)'}"></div>
              <span style="font-size:13px;color:var(--on-sv);flex:1">${f.name}</span>
              <button onclick="_addFolderToPlan('${f.id}')" style="background:none;border:1px solid var(--border-subtle);border-radius:7px;padding:3px 8px;font-size:11px;color:var(--primary);cursor:pointer;font-weight:600">+ Inclure</button>
            </div>`).join('')}
          </div>`;
        })()}
      </div>
    </div>

    <!-- Colonne droite : agenda -->
    <div class="plan-right">
      <div class="agenda-wrap">
        <div class="agenda-header">
          <span class="ms" style="font-size:16px;color:var(--primary)">calendar_month</span>
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--on-surface)">Agenda jusqu'à l'exam</div>
            <div style="font-size:10px;color:var(--on-sv)">${plan.daysLeft} jour${plan.daysLeft>1?'s':''} · cliquer = réviser</div>
          </div>
        </div>
        <div class="agenda-list">${scheduleHTML}</div>
        <div class="agenda-exam-day">
          <span class="ms" style="font-size:14px">school</span>
          <span style="font-size:12px;font-weight:800">${plan.examName} — ${plan.examDate.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</span>
        </div>
      </div>
    </div>

  </div>`;
}

function _openPlanFolderManager(){
  const activeFolders=folders.filter(f=>f.type!=='annales'&&!isFolderArchived(f.id));
  const examFids=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]');
  // Build modal HTML
  const body=`<div style="font-size:13px;color:var(--on-sv);margin-bottom:12px">Coche les matières à inclure dans ce plan d'examen. Décoche pour exclure.</div>`+
    activeFolders.map(f=>{
      const checked=!examFids.length||examFids.includes(f.id);
      const fc=courses.filter(c=>c.folderId===f.id);
      const nq=questions.filter(q=>fc.some(c=>c.id===q.courseId)).length;
      return `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;margin-bottom:6px;background:var(--surf-low);border:1.5px solid ${checked?'var(--primary)':'var(--border-subtle)'}">
        <input type="checkbox" class="pfm-check" value="${f.id}"${checked?' checked':''} onchange="_pfmToggle(this)" style="accent-color:var(--primary);width:16px;height:16px;flex-shrink:0">
        <div style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${f.color||'var(--primary)'}"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--on-surface)">${f.name}</div>
          <div style="font-size:11px;color:var(--on-sv)">${fc.length} cours · ${nq} questions</div>
        </div>
        <div style="display:flex;gap:4px">
          <button onclick="event.preventDefault();event.stopPropagation();openFolder('${f.id}')" style="background:none;border:1px solid var(--border-subtle);border-radius:7px;padding:4px 8px;font-size:11px;color:var(--on-sv);cursor:pointer" title="Ouvrir"><span class="ms" style="font-size:13px;vertical-align:middle">open_in_new</span></button>
          <button onclick="event.preventDefault();event.stopPropagation();deleteFolder('${f.id}')" style="background:none;border:1px solid var(--border-subtle);border-radius:7px;padding:4px 8px;font-size:11px;color:var(--error);cursor:pointer" title="Supprimer"><span class="ms" style="font-size:13px;vertical-align:middle">delete</span></button>
        </div>
      </label>`;
    }).join('');

  // Utiliser le modal générique mc ou créer un overlay rapide
  const ov=document.createElement('div');
  ov.id='pfm-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML=`<div style="background:var(--surface);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:560px;max-height:80vh;overflow-y:auto;box-shadow:0 -4px 40px rgba(0,0,0,.2)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <span style="font-size:16px;font-weight:800;color:var(--on-surface)">Gérer les matières du plan</span>
      <button onclick="document.getElementById('pfm-overlay').remove()" style="background:none;border:none;cursor:pointer;color:var(--on-sv)"><span class="ms" style="font-size:22px">close</span></button>
    </div>
    ${body}
    <button class="btn btn-p" style="width:100%;margin-top:10px;justify-content:center" onclick="_savePFM()">Appliquer</button>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  document.body.appendChild(ov);
}
function _pfmToggle(cb){
  const label=cb.closest('label');
  if(label)label.style.borderColor=cb.checked?'var(--primary)':'var(--border-subtle)';
}
function _savePFM(){
  const checks=document.querySelectorAll('.pfm-check');
  const all=document.querySelectorAll('.pfm-check').length;
  const checked=Array.from(document.querySelectorAll('.pfm-check:checked')).map(c=>c.value);
  // Si tout est coché, on enlève le filtre
  if(checked.length===all||!checked.length)localStorage.removeItem('kp_exam_folders');
  else localStorage.setItem('kp_exam_folders',JSON.stringify(checked));
  document.getElementById('pfm-overlay')?.remove();
  renderPlan();
  if(typeof renderDesktopSidebar==='function')renderDesktopSidebar();
  showNotif('Plan mis à jour','ok');
}
function _addFolderToPlan(fid){
  const ef=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]');
  if(!ef.includes(fid)){ef.push(fid);localStorage.setItem('kp_exam_folders',JSON.stringify(ef));}
  renderPlan();
  showNotif('Matière ajoutée au plan','ok');
}

function startCiblé(){
  const threeDaysAgo=new Date();threeDaysAgo.setDate(threeDaysAgo.getDate()-3);
  const qs=questions.filter(q=>{
    if(isBoycotted(q.id))return false;
    const diff=getDiff(q.id);
    if(diff!=='hard'&&diff!=='medium')return false;
    const d=diffData[q.id];
    if(!d||!d.lastDate)return true;
    return new Date(d.lastDate)<threeDaysAgo;
  });
  if(!qs.length){showNotif('Aucune question ciblée — tout est à jour !','ok');return;}
  rBack='home';launchS(shuffle(qs),'Révision ciblée',false,false,true,false,false);
}

// ── Mode focus quiz
function toggleFocusMode(){
  const active=document.body.classList.toggle('focus-mode');
  const btn=document.getElementById('focus-btn');
  if(btn)btn.innerHTML=active
    ?'<span class="ms" style="font-size:18px">fullscreen_exit</span>'
    :'<span class="ms" style="font-size:18px">fullscreen</span>';
}

// ── Taille du texte du quiz (A− / A+ dans l'en-tête, touches + et −) ──
// Seul le texte grossit (variable CSS --qfs, voir la fin de styles7.css) ; le choix est mémorisé
// (avant : zoom de tout l'écran, remis à 100 % à chaque session).
const QFS_KEY='kp_quiz_fs',QFS_MIN=0.6,QFS_MAX=2,QFS_PRESETS=[.6,.7,.8,.9,1,1.1,1.2,1.3,1.5,1.75,2];   // 13 nov. 2026 : dès 60 %, menu de tailles
let _qfs=(()=>{try{const v=parseFloat(localStorage.getItem(QFS_KEY));if(v>=QFS_MIN&&v<=QFS_MAX)return v;}catch(e){}return 1;})();
function _applyQFS(){
  const area=document.getElementById('screen-quiz');
  if(area){area.style.setProperty('--qfs',_qfs);area.style.zoom='';}
  const lbl=document.getElementById('zoom-pct');if(lbl)lbl.textContent=Math.round(_qfs*100)+'%';
  const b=document.querySelectorAll('#quiz-zoom-ctrl .ib');
  if(b.length===2){b[0].disabled=_qfs<=QFS_MIN;b[1].disabled=_qfs>=QFS_MAX;}
  document.querySelectorAll('.qfs-menu button').forEach(x=>x.classList.toggle('on',Math.abs(parseFloat(x.dataset.v)-_qfs)<.01));
}
function setQuizFontScale(v){
  _qfs=Math.min(QFS_MAX,Math.max(QFS_MIN,Math.round(v*10)/10));
  try{localStorage.setItem(QFS_KEY,String(_qfs));}catch(e){}
  _applyQFS();
}
function changeQuizZoom(delta){setQuizFontScale(_qfs+delta);}
// Clic sur le pourcentage : petit menu de tailles toutes prêtes (60 % → 200 %)
function toggleQfsMenu(ev){
  if(ev)ev.stopPropagation();
  const ctrl=document.getElementById('quiz-zoom-ctrl');if(!ctrl)return;
  let m=ctrl.querySelector('.qfs-menu');
  if(m){m.remove();return;}
  m=document.createElement('div');m.className='qfs-menu';m.setAttribute('role','menu');
  m.innerHTML='<div class="qfs-menu-t">Taille du texte</div><div class="qfs-menu-g">'+QFS_PRESETS.map(v=>`<button type="button" data-v="${v}" role="menuitem">${Math.round(v*100)} %</button>`).join('')+'</div><div class="qfs-menu-h">Touches <b>+</b> et <b>−</b> pendant le quiz, <b>0</b> pour revenir à 100 %</div>';
  m.addEventListener('click',e=>{e.stopPropagation();const b=e.target.closest('button[data-v]');if(b){setQuizFontScale(parseFloat(b.dataset.v));m.remove();}});
  ctrl.appendChild(m);_applyQFS();
  setTimeout(()=>document.addEventListener('click',function off(){m.remove();document.removeEventListener('click',off);}),0);
}
_applyQFS();

// ── Couleur matière — édit
function openEditFolderColor(){
  const f=folders.find(x=>x.id===curF);if(!f)return;
  selC=f.color;renderCP('ecf-cp',f.color);
  openModal('modal-ecf');
}
function saveFolderColor(){
  const f=folders.find(x=>x.id===curF);if(!f)return;
  f.color=selC;saveAll();closeModal('modal-ecf');
  renderMatiere();renderHome();
  showNotif('Couleur mise à jour','ok');
}

let _quizIndicatorVisible = false;
function _resumeQuizFromChip(){
  // Hide chip instantly (no animation) then navigate
  const ind = document.getElementById('dl-quiz-indicator');
  if(ind){ ind.classList.remove('visible','hiding'); _quizIndicatorVisible = false; }
  showScreen('quiz');
}
function updateQuizIndicator(){
  const ind = document.getElementById('dl-quiz-indicator');
  if(!ind) return;
  const active = typeof session!=='undefined' && session && session.qs && session.qs.length > 0;
  const onQuizScreen = document.body.dataset.screen === 'quiz';
  const shouldShow = active && !onQuizScreen;

  if(shouldShow){
    const cur = session.cur || 0;
    const total = session.qs.length;
    const pct = Math.round((cur/total)*100);
    const q   = session.qs[cur];
    const c   = q ? courses.find(x=>x.id===q.courseId) : null;
    const label = document.getElementById('dl-quiz-label');
    const prog  = document.getElementById('dl-quiz-prog');
    const bar   = document.getElementById('dl-quiz-bar');
    if(label) label.textContent = c ? c.name : (session.mode||'Quiz');
    if(prog)  prog.textContent  = `${cur}/${total}`;
    if(bar)   bar.style.width   = pct+'%';
    if(!_quizIndicatorVisible){
      ind.classList.remove('hiding');
      ind.classList.add('visible');
      _quizIndicatorVisible = true;
    }
  } else if(_quizIndicatorVisible) {
    ind.classList.add('hiding');
    ind.addEventListener('animationend', ()=>{
      ind.classList.remove('visible','hiding');
      _quizIndicatorVisible = false;
    }, {once:true});
  }
}

function launchS(qs,mode,isFlash,isRetry,isHard,isSurvival,isAnnales){
  _applyQFS(); // taille du texte mémorisée (ne revient plus à 100 % à chaque session)
  session={qs,cur:0,correct:0,answers:[],mode,isFlash,isRetry,isHard,isSurvival,isAnnales:!!isAnnales};
  setAnnalesMode(!!isAnnales);
  if(isSurvival){session.lives=3;session.survivalStreak=0;session.wrongQuestions=[];}
  updStreak();
  sessionStart=Date.now();
  // Start timer
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    const elapsed=Math.floor((Date.now()-sessionStart)/1000);
    const tStr=formatTime(elapsed);
    const te=document.getElementById('quiz-timer');
    if(te){te.textContent=tStr;te.className='quiz-timer-live'+(elapsed>1800?' warn':'');}
    // Also update topbar timer
    const tb=document.getElementById('topbar-timer');
    if(tb){tb.style.display='block';tb.innerHTML=`<span style="font-size:12px;font-weight:700;color:var(--on-sv);padding:3px 9px;background:var(--surf-low);border-radius:var(--r-full)"><span class="ms" style="font-size:12px;vertical-align:middle">timer</span> ${tStr}</span>`;}
  },1000);
  saveResumeSession();
  showScreen('quiz');renderQ();
  setTimeout(updateQuizIndicator,50);
}

function showSurvivalGameOver(){
  const score=session.correct;const previousBest=bestSurvivalStreak;
  if(score>previousBest){bestSurvivalStreak=score;saveAll();}

  const wrong=session.wrongQuestions||[];
  const wrongHTML=wrong.length?`
    <div style="margin-top:40px;border-top:1px solid var(--border-subtle);padding-top:40px">
      <h2 style="font-size:20px;font-weight:800;margin-bottom:20px;text-align:left"><span class="ms" style="font-size:20px;vertical-align:middle;color:var(--error)">cancel</span> Questions à retravailler (${wrong.length})</h2>
      <div style="display:flex;flex-direction:column;gap:20px;max-height:400px;overflow-y:auto">
        ${wrong.map((a,idx)=>{
          const ac=courses.find(x=>x.id===a.q.courseId);const af=ac?folders.find(x=>x.id===ac.folderId):null;
          const ct=a.q.answers[a.chosenIdx]||'(non répondu)';const corr=a.q.answers[a.q.correct];
          return `<div style="padding:16px;background:var(--surf-low);border-radius:var(--r-lg);border-left:3px solid var(--error);text-align:left">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--on-sv);font-weight:700;margin-bottom:4px">${af?af.name+' › ':''}${ac?ac.name:''}</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:10px;line-height:1.4">${a.q.question}</div>
            <div><span style="display:inline-block;padding:4px 8px;background:var(--error);color:white;border-radius:6px;font-size:12px">✗ ${ct}</span></div>
            <div style="margin-top:5px"><span style="display:inline-block;padding:4px 8px;background:var(--tertiary);color:white;border-radius:6px;font-size:12px">✓ ${corr}</span></div>
            ${a.q.expl?`<div style="font-size:12px;color:#5C4200;margin-top:8px;padding:8px 10px;background:var(--gold-l);border-radius:6px;border-left:3px solid var(--gold);line-height:1.6"><span class="ms" style="font-size:14px;vertical-align:middle">lightbulb</span> ${a.q.expl}</div>`:''}
          </div>`;
        }).join('')}
      </div>
      <button class="btn btn-w" onclick="retrySurvivalErr()" style="width:100%;margin-top:20px;justify-content:center"><span class="ms" style="font-size:15px">find_in_page</span> Corriger ${wrong.length} erreur${wrong.length>1?'s':''}</button>
    </div>
  `:'';

  const gameOverHtml=`
    <div style="text-align:center;padding:60px 20px;max-width:700px;margin:0 auto">
      <div style="font-size:72px;margin-bottom:20px;animation:bounce 0.6s ease-in-out"><span class="ms f" style="font-size:72px;color:var(--error)">skull</span></div>
      <h1 style="font-size:48px;font-weight:800;margin-bottom:8px;font-family:'Manrope',sans-serif">GAME OVER</h1>
      <p style="font-size:16px;color:var(--on-sv);margin-bottom:40px">Ta streak s'arrête là...</p>

      <div style="background:var(--surface);border-radius:var(--r-xl);padding:32px;margin-bottom:24px;box-shadow:var(--sh),inset 0 1px 0 rgba(255,255,255,.9);border:1px solid var(--border-subtle)">
        <div style="font-size:14px;color:var(--on-sv);margin-bottom:8px;text-transform:uppercase;font-weight:700;letter-spacing:1px">Bonnes réponses d'affilée</div>
        <div style="font-size:56px;font-weight:800;color:var(--primary);font-family:'Manrope',sans-serif;margin-bottom:16px">${score}</div>
        ${score>previousBest?`<div style="font-size:16px;color:var(--tertiary);font-weight:700"><span class="ms f" style="font-size:18px;vertical-align:middle;color:var(--gold)">emoji_events</span> NOUVEAU RECORD!</div>`:score===previousBest?`<div style="font-size:14px;color:var(--on-sv)">Égalé ton meilleur: ${previousBest}</div>`:score<previousBest?`<div style="font-size:14px;color:var(--on-sv)">Meilleur: ${previousBest} (manquait ${previousBest-score})</div>`:''}
      </div>

      <div style="display:flex;gap:12px">
        <button class="btn btn-p" onclick="startSurvival()" style="flex:1;justify-content:center"><span class="ms" style="font-size:16px">replay</span> Recommencer</button>
        <button class="btn btn-g" onclick="switchTab('home')" style="flex:1;justify-content:center"><span class="ms" style="font-size:16px">home</span> Accueil</button>
      </div>
      ${wrongHTML}
    </div>
  `;
  // Injecter dans un container dédié pour ne pas détruire le HTML de l'écran résultats
  let goEl=document.getElementById('survival-gameover');
  if(!goEl){goEl=document.createElement('div');goEl.id='survival-gameover';document.getElementById('screen-results').appendChild(goEl);}
  const wrapEl=document.querySelector('#screen-results>.wrap');
  if(wrapEl)wrapEl.style.display='none';
  goEl.innerHTML=gameOverHtml;
  goEl.style.display='block';
  showScreen('results');
}

function renderQ(){
  questionStartTime=Date.now();
  const q=session.qs[session.cur];const total=session.qs.length;
  if(session.isSurvival){
    document.getElementById('qprog').style.width='0%';
    document.getElementById('qn').innerHTML=`Vies: ${'<span class="ms f" style="font-size:16px;color:#e53e35">favorite</span> '.repeat(session.lives)}`;
    document.getElementById('qsc').textContent=`Streak: ${session.survivalStreak}`;
  } else if(session.isAnnales){
    const as=session.answers.filter(a=>a.skipped).length;
    const answered=session.answers.filter(a=>!a.skipped).length;
    document.getElementById('qprog').style.width=((session.cur/total)*100)+'%';
    document.getElementById('qn').textContent=`${session.cur+1} / ${total}`;
    document.getElementById('qsc').textContent=`${answered} rép.${as>0?' · '+as+' pass.':''}`;
  } else {
    document.getElementById('qprog').style.width=((session.cur/total)*100)+'%';
    document.getElementById('qn').textContent=`${session.cur+1} / ${total}`;
    document.getElementById('qsc').textContent=`${session.correct} correct${session.correct>1?'s':''}`;
  }
  document.getElementById('qctx').textContent=session.mode;
  const badges=[];
  if(session.isAnnales)badges.push('<span class="badge-pill annales-pill"><span class="ms" style="font-size:11px;vertical-align:middle">history_edu</span> Annales</span>');
  if(session.isFlash)badges.push('<span class="badge-pill flash-pill"><span class="ms" style="font-size:11px;vertical-align:middle">bolt</span> Flash</span>');
  if(session.isRetry)badges.push('<span class="badge-pill retry-pill"><span class="ms" style="font-size:11px;vertical-align:middle">find_in_page</span> Correction</span>');
  if(session.isHard)badges.push('<span class="badge-pill hard-pill"><span class="ms" style="font-size:11px;vertical-align:middle">whatshot</span> Difficiles</span>');
  const diff=getDiff(q.id);
  if(diff==='hard'&&!session.isAnnales)badges.push('<span class="badge-pill retry-pill"><svg width="8" height="8" style="vertical-align:middle;margin-right:2px" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="var(--error)"/></svg>Difficile</span>');
  document.getElementById('qbadges').innerHTML=badges.join('');
  // Skip button (annales only)
  const skipRow=document.getElementById('qskip-row');
  if(skipRow)skipRow.style.display=session.isAnnales?'block':'none';
  const c=courses.find(x=>x.id===q.courseId);const f=c?folders.find(x=>x.id===c.folderId):null;
  document.getElementById('qql').textContent=f&&c?`${f.name} › ${c.name}`:c?c.name:'';
  const qEl=document.getElementById('qq');qEl.textContent=q.question;qEl.classList.remove('entering');void qEl.offsetWidth;qEl.classList.add('entering');
  document.getElementById('qexpl').style.display='none';document.getElementById('qnrow').style.display='none';document.getElementById('qboycott').style.display='none';document.getElementById('qfavorite').style.display='none';document.getElementById('qri').textContent='';
  const _qfav=document.getElementById('qfav');if(_qfav){const _fav=isFavorite(q.id);_qfav.innerHTML=`<span class="ms f" style="font-size:18px;color:${_fav?'var(--tertiary)':'var(--on-sv)'}">${_fav?'star':'star_border'}</span>`;}
  const _pb=document.getElementById('qprevbtn');if(_pb)_pb.style.display=session.cur>0?'':'none';
  const ficheEl=document.getElementById('qconcept-fiche');if(ficheEl)ficheEl.style.display='none';
  const L=['A','B','C','D','E','F','G','H'];
  const KBL=['Q','S','D','F'];
  const con=document.getElementById('qopts');con.innerHTML='';
  const prevAns=session.answers[session.cur];
  if(prevAns){
    // Lecture seule — question déjà répondue (navigation arrière)
    q.answers.forEach((a,origIdx)=>{
      const btn=document.createElement('button');btn.className='ob';btn.style.animationDelay=(0.03+origIdx*0.05)+'s';
      btn.disabled=true;
      btn.innerHTML=`<div class="oltr">${L[origIdx]}</div><div class="otxt">${a}</div>`;
      if(!prevAns.skipped){
        if(origIdx===q.correct&&origIdx===prevAns.chosenIdx)btn.classList.add('correct');
        else if(origIdx===q.correct)btn.classList.add('reveal');
        else if(origIdx===prevAns.chosenIdx)btn.classList.add('wrong');
      }
      con.appendChild(btn);
    });
    if(q.expl){const ex=document.getElementById('qexpl');ex.innerHTML=`<span class="ms" style="font-size:16px;vertical-align:middle">lightbulb</span> ${q.expl}`;ex.style.display='block';}
    document.getElementById('qri').innerHTML=prevAns.skipped?'<span style="font-size:13px;color:var(--on-sv)">Passée</span>':prevAns.correct?'<span class="ms f" style="font-size:26px;color:var(--tertiary)">check_circle</span>':'<span class="ms f" style="font-size:26px;color:var(--error)">cancel</span>';
    document.getElementById('qnrow').style.display='flex';
    document.getElementById('qboycott').style.display='none';
    document.getElementById('qnbtn').textContent=session.cur+1>=session.qs.length?'Voir les résultats →':'Suivante →';
  } else {
    // Question fraîche — affichage normal avec mélange
    const shuf=shuffle(q.answers.map((a,i)=>({a,i})));
    con._map=shuf.map(o=>o.i);
    shuf.forEach((obj,j)=>{
      const btn=document.createElement('button');btn.className='ob';btn.style.animationDelay=(0.03+j*0.05)+'s';
      btn.innerHTML=`<div class="oltr">${L[j]}</div><div class="otxt">${obj.a}</div>`;
      btn.onclick=()=>selAns(j,obj.i);con.appendChild(btn);
    });
  }
}

function selAns(j,oi){
  const q=session.qs[session.cur];const ok=oi===q.correct;
  const all=document.querySelectorAll('.ob');const map=document.getElementById('qopts')._map;
  const timeSpent=Math.round((Date.now()-questionStartTime)/1000);

  // ── MODE ANNALES : pas de feedback, juste marquer la sélection ──
  if(session.isAnnales){
    all.forEach(o=>o.disabled=true);
    all[j].classList.add('annales-selected');
    if(ok)session.correct++;
    session.answers.push({q,chosenIdx:oi,correct:ok,skipped:false,timeSpent});
    recordAnswer(q.id,ok,timeSpent);saveAll();saveResumeSession();
    document.getElementById('qexpl').style.display='none';
    document.getElementById('qri').textContent='';
    const skipRow=document.getElementById('qskip-row');
    if(skipRow)skipRow.style.display='none';
    document.getElementById('qnrow').style.display='flex';
    document.getElementById('qnbtn').textContent=session.cur+1>=session.qs.length?'Voir les résultats →':'Suivante →';
    return;
  }

  // ── MODE NORMAL ──
  all.forEach((o,i)=>{o.disabled=true;if(map[i]===q.correct)o.classList.add(ok&&i===j?'correct':'reveal');});
  all[j].classList.remove('reveal');all[j].classList.add(ok?'correct':'wrong');
  if(ok){session.correct++;if(session.isSurvival)session.survivalStreak++;}
  else if(session.isSurvival){session.lives--;session.survivalStreak=0;if(!session.wrongQuestions)session.wrongQuestions=[];session.wrongQuestions.push({q,chosenIdx:oi});}
  session.answers.push({q,chosenIdx:oi,correct:ok,skipped:false,timeSpent});
  recordAnswer(q.id,ok,timeSpent);saveAll();saveResumeSession();
  // Show explanation/feedback if available
  if(q.expl){
    const ex=document.getElementById('qexpl');
    ex.innerHTML=`<span class="ms" style="font-size:16px;vertical-align:middle">lightbulb</span> ${q.expl}`;
    ex.style.display='block';
  }
  // Show concept fiche reminder on wrong answer
  if(!ok){
    const matched=conceptsMatchingQuestion(q.question);
    const ficheEl=document.getElementById('qconcept-fiche');
    if(matched.length>0&&ficheEl){
      ficheEl.innerHTML=matched.map(c=>`<div class="concept-fiche-reminder"><div class="concept-fiche-header"><span class="ms" style="font-size:14px;vertical-align:middle">psychology</span> Concept lié : <strong>${c.term}</strong></div><div class="concept-fiche-body">${c.definition}</div></div>`).join('');
      ficheEl.style.display='block';
    }
  }
  document.getElementById('qri').innerHTML=ok?'<span class="ms f" style="font-size:26px;color:var(--tertiary)">check_circle</span>':'<span class="ms f" style="font-size:26px;color:var(--error)">cancel</span>';
  // Game Over check for Survival mode
  if(session.isSurvival&&session.lives<=0){
    clearInterval(timerInterval);
    showSurvivalGameOver();
    return;
  }
  document.getElementById('qnrow').style.display='flex';
  document.getElementById('qboycott').style.display='';
  const _favBtn=document.getElementById('qfavorite');const _favIcon=document.getElementById('qfav-icon');
  if(_favBtn&&_favIcon){const _isFav=isFavorite(session.qs[session.cur].id);_favBtn.style.display='';_favIcon.textContent=_isFav?'star':'star_border';_favBtn.style.color=_isFav?'#FFD700':'var(--on-sv)';_favBtn.title=_isFav?'Retirer des favoris':'Ajouter aux favoris';}
  if(session.isSurvival){
    document.getElementById('qnbtn').textContent='Suivante →';
  } else {
    document.getElementById('qnbtn').textContent=session.cur+1>=session.qs.length?'Voir les résultats →':'Suivante →';
  }
}

function skipQ(){
  if(!session.isAnnales)return;
  const q=session.qs[session.cur];
  const timeSpent=Math.round((Date.now()-questionStartTime)/1000);
  session.answers.push({q,chosenIdx:-1,correct:false,skipped:true,timeSpent});
  session.cur++;
  if(session.cur>=session.qs.length){endSession();return;}
  renderQ();
}

function nextQ(){session.cur++;if(session.cur>=session.qs.length){endSession();return;}renderQ();}
function prevQ(){if(!session||session.cur<=0)return;session.cur--;renderQ();}

function endSession(){
  clearResumeSession();
  clearInterval(timerInterval);
  if(document.body.classList.contains('focus-mode'))toggleFocusMode();
  document.getElementById('topbar-timer').style.display='none';
  const duration=Math.floor((Date.now()-sessionStart)/1000);
  addTodayQ(session.qs.length,duration);
  calculateAndSaveStats(session);
  if(typeof pushSessionHistory==='function'){
    pushSessionHistory({date:new Date().toISOString().split('T')[0],correct:session.correct,total:session.qs.length,mode:session.mode,duration});
  }
  showResults(duration);
  session = null; // masque le chip "session en cours" après showResults
  setTimeout(updateQuizIndicator,50);
}

// ════════════════════════════════════════════
// CONCEPTS HUB
// ════════════════════════════════════════════
const MASTERY_EMOJI=['<span class="ms" style="font-size:18px;color:var(--on-sv)">radio_button_unchecked</span>','<span class="ms f" style="font-size:18px;color:var(--primary)">circle</span>','<span class="ms f" style="font-size:18px;color:var(--gold)">circle</span>','<span class="ms f" style="font-size:18px;color:#f97316">circle</span>','<span class="ms f" style="font-size:18px;color:var(--tertiary)">circle</span>','<span class="ms f" style="font-size:18px;color:#fbbf24">star</span>'];

function renderConcepts(){
  const due=getConceptsDue().length;
  const dueEl=document.getElementById('concepts-due-count');if(dueEl)dueEl.textContent=due;
  const list=document.getElementById('concepts-list');if(!list)return;

  // ── Vue dossier ──────────────────────────────────────────────
  if(_activeFolderView){
    const f=conceptFolders.find(x=>x.id===_activeFolderView);
    if(!f){_activeFolderView=null;}
    else{list.innerHTML=renderConceptFolderDetail(f);return;}
  }

  // ── Vue globale ──────────────────────────────────────────────
  if(concepts.length===0){
    list.innerHTML=`<div style="text-align:center;padding:48px 0;color:var(--on-sv)"><div style="font-size:40px;margin-bottom:12px"><span class="ms" style="font-size:40px">psychology</span></div><div style="font-weight:800;font-size:16px;margin-bottom:6px">Aucun concept encore</div><div style="font-size:13px;line-height:1.6">Surlignez un terme dans une question de quiz<br>pour l'ajouter automatiquement ici.</div></div>`;
    return;
  }
  let html='';
  conceptFolders.forEach(f=>{
    html+=renderConceptFolderSection(f,concepts.filter(c=>c.folderId===f.id));
  });
  const unfiled=concepts.filter(c=>!c.folderId||!conceptFolders.find(f=>f.id===c.folderId));
  if(unfiled.length>0){
    const toExp=unfiled.filter(c=>c.state==='toExplain');
    const learned=unfiled.filter(c=>c.state==='learned');
    if(conceptFolders.length>0)html+=`<span class="sl" style="margin-top:8px">Sans dossier (${unfiled.length})</span>`;
    if(toExp.length>0){if(conceptFolders.length===0)html+=`<span class="sl">À expliquer (${toExp.length})</span>`;html+=toExp.map(renderConceptItem).join('');}
    if(learned.length>0){if(conceptFolders.length===0)html+=`<span class="sl">Appris (${learned.length})</span>`;html+=learned.map(renderConceptItem).join('');}
  }
  list.innerHTML=html;
}

function renderConceptFolderDetail(f){
  const fc=concepts.filter(c=>c.folderId===f.id);
  const toExp=fc.filter(c=>c.state==='toExplain');
  const learned=fc.filter(c=>c.state==='learned');

  let cards='';
  if(fc.length===0){
    cards=`<div style="text-align:center;padding:36px;color:var(--on-sv);font-size:13px">Aucun concept dans ce dossier.</div>`;
  } else {
    if(toExp.length>0)cards+=`<span class="sl">À expliquer (${toExp.length})</span>`+toExp.map(renderConceptItem).join('');
    if(learned.length>0)cards+=`<span class="sl">Appris (${learned.length})</span>`+learned.map(renderConceptItem).join('');
  }

  return `
    <!-- En-tête dossier -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
      <button class="btn btn-sm btn-g" onclick="exitConceptFolder()" style="flex-shrink:0">
        <span class="ms" style="font-size:15px">arrow_back</span>
      </button>
      <span class="ms" style="font-size:20px;color:var(--primary)">folder_open</span>
      <h2 style="font-size:20px;font-weight:800;margin:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(f.name)}</h2>
      <button class="btn btn-sm btn-g" onclick="editConceptFolder('${f.id}')" title="Modifier le dossier">
        <span class="ms" style="font-size:14px">edit</span>
      </button>
    </div>
    <!-- Actions scopées au dossier -->
    <div class="fr" style="gap:8px;margin-bottom:18px;flex-wrap:wrap">
      <button class="btn btn-p" onclick="startFolderFlashcards('${f.id}')">
        <span class="ms" style="font-size:15px">style</span> Réviser
      </button>
      <button class="btn btn-g" onclick="openBulkConceptImport('${f.id}')">
        <span class="ms" style="font-size:15px">file_upload</span> Import en lot
      </button>
      <button class="btn btn-g" onclick="openAddConceptInFolder('${f.id}')">
        <span class="ms" style="font-size:15px">add</span> Ajouter
      </button>
    </div>
    <!-- Concepts -->
    ${cards}
  `;
}

function enterConceptFolder(id){
  _activeFolderView=id;
  renderConcepts();
  document.getElementById('screen-concepts')?.scrollTo({top:0,behavior:'smooth'});
}

function exitConceptFolder(){
  _activeFolderView=null;
  if(_conceptSelectMode){ _conceptSelectMode=false; _selectedConceptIds.clear(); }
  renderConcepts();
}

function renderConceptFolderSection(f,fc){
  const isOpen=!f.collapsed;
  const toExp=fc.filter(c=>c.state==='toExplain');
  const learned=fc.filter(c=>c.state==='learned');
  let body='';
  if(isOpen){
    if(fc.length===0){body='<div class="cfoldr-empty">Aucun concept — déplacez-en un ici</div>';}
    else{
      if(toExp.length>0)body+=`<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--on-sv);margin:10px 4px 6px">À expliquer (${toExp.length})</div>`+toExp.map(renderConceptItem).join('');
      if(learned.length>0)body+=`<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--on-sv);margin:10px 4px 6px">Appris (${learned.length})</div>`+learned.map(renderConceptItem).join('');
    }
  }
  return `<div class="cfoldr">
    <div class="cfoldr-hdr" onclick="toggleConceptFolder('${f.id}')">
      <div class="cfoldr-left" onclick="event.stopPropagation();enterConceptFolder('${f.id}')" style="cursor:pointer;flex:1;min-width:0">
        <span class="ms cfoldr-icon">${isOpen?'folder_open':'folder'}</span>
        <span class="cfoldr-name">${_esc(f.name)}</span>
        <span class="cfoldr-count">${fc.length}</span>
      </div>
      <div class="cfoldr-actions">
        <button class="btn btn-sm btn-g" style="font-size:11px;padding:3px 9px" title="Modifier le dossier"
          onclick="event.stopPropagation();editConceptFolder('${f.id}')">
          <span class="ms" style="font-size:13px">edit</span>
        </button>
        <span class="ms cfoldr-chevron${isOpen?' open':''}" onclick="event.stopPropagation();toggleConceptFolder('${f.id}')">chevron_right</span>
      </div>
    </div>
    ${isOpen?`<div class="cfoldr-body">${body}</div>`:''}
  </div>`;
}

function renderConceptItem(c){
  const lvl=c.masteryLevel||0;
  const maxLvl=5;
  const nextRev=c.nextReview?new Date(c.nextReview).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'—';
  const isDue=c.nextReview&&new Date(c.nextReview)<=new Date();
  const stateColor=c.state==='learned'?'var(--tertiary)':'var(--on-sv)';
  // Mastery dots
  const dots=Array.from({length:maxLvl},(_,i)=>`<span style="width:6px;height:6px;border-radius:50%;background:${i<lvl?'var(--tertiary)':'var(--outline-v)'};display:inline-block"></span>`).join('');
  const defPreview=c.definition
    ?`<p class="cpt-def">${c.definition.slice(0,100)}${c.definition.length>100?'…':''}</p>`
    :`<p class="cpt-nodef">Tap pour ajouter une définition…</p>`;

  if(_conceptSelectMode){
    const checked=_selectedConceptIds.has(c.id);
    return `<div class="cpt-card${checked?' cpt-card-sel':''}" onclick="toggleConceptSelect('${c.id}')">
      <input type="checkbox" id="csel-${c.id}" ${checked?'checked':''} onclick="event.stopPropagation();toggleConceptSelect('${c.id}')" style="width:17px;height:17px;flex-shrink:0;accent-color:var(--primary);margin-top:2px">
      <div style="flex:1;min-width:0">
        <div class="cpt-term">${_esc(c.term)}</div>
        ${defPreview}
      </div>
    </div>`;
  }
  return `<div class="cpt-card" onclick="openConceptDef('${c.id}')">
    <div class="cpt-header">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        <div class="cpt-term">${_esc(c.term)}</div>
        ${isDue?`<span style="font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;background:color-mix(in srgb,var(--primary) 12%,transparent);color:var(--primary);padding:2px 6px;border-radius:var(--r-full);flex-shrink:0">À réviser</span>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">${dots}</div>
    </div>
    ${defPreview}
    <div class="cpt-footer">
      <span class="cpt-meta">${c.state==='learned'?'✓ Appris':'⏳ À définir'} · Rév. ${nextRev}</span>
      <div class="cpt-actions" onclick="event.stopPropagation()">
        <button class="cpt-btn" title="Déplacer" onclick="openMoveConcept('${c.id}')"><span class="ms" style="font-size:14px">drive_file_move</span></button>
        <button class="cpt-btn" title="Prompt IA" onclick="genConceptPromptForId('${c.id}')"><span class="ms" style="font-size:14px">auto_awesome</span></button>
        <button class="cpt-btn cpt-btn-del" title="Supprimer" onclick="deleteConcept('${c.id}')"><span class="ms" style="font-size:14px">delete</span></button>
      </div>
    </div>
  </div>`;
}

// ── Dossiers de concepts ─────────────────────────────────────

let _curFolderId=null;

const _DEFAULT_CONCEPT_PROMPT=`Tu es un expert pédagogue en kinésithérapie et médecine.\nGénère une fiche de mémorisation pour : "{{TERM}}"\n\nFormat EXACT :\nDÉFINITION: [max 20 mots, définition précise et mémorisable]\nMOTS_CLÉS: [4-6 concepts-clés séparés par des virgules]\n\nRègle pour les MOTS_CLÉS : chaque mot-clé représente un concept incontournable de la définition que l'étudiant doit mentionner. Si la définition contient "densité minérale osseuse", les mots-clés seront "densité minérale, osseuse, ...". L'étudiant valide s'il cite ≥ 80 % des concepts.\n\nExemple :\nDÉFINITION: Baisse de la densité minérale osseuse localisée autour d'une articulation, liée à l'inflammation ou à l'immobilisation\nMOTS_CLÉS: densité minérale, osseuse, articulaire, baisse, inflammation, immobilisation`;

function toggleConceptFolder(id){
  const f=conceptFolders.find(x=>x.id===id);if(!f)return;
  f.collapsed=!f.collapsed;saveAll();renderConcepts();
}

function openCreateConceptFolder(){
  _curFolderId=null;
  document.getElementById('cfol-modal-title').textContent='Nouveau dossier';
  document.getElementById('cfol-name').value='';
  document.getElementById('cfol-prompt').value='';
  document.getElementById('cfol-delete-btn').style.display='none';
  openModal('modal-concept-folder');
  setTimeout(()=>document.getElementById('cfol-name').focus(),150);
}

function editConceptFolder(id){
  const f=conceptFolders.find(x=>x.id===id);if(!f)return;
  _curFolderId=id;
  document.getElementById('cfol-modal-title').textContent='Modifier le dossier';
  document.getElementById('cfol-name').value=f.name;
  document.getElementById('cfol-prompt').value=f.prompt||'';
  document.getElementById('cfol-delete-btn').style.display='';
  openModal('modal-concept-folder');
  setTimeout(()=>document.getElementById('cfol-name').focus(),150);
}

function resetFolderPromptToDefault(){
  document.getElementById('cfol-prompt').value=_DEFAULT_CONCEPT_PROMPT;
}

function saveConceptFolder(){
  const name=document.getElementById('cfol-name').value.trim();
  if(!name){showNotif('Nom vide','');return;}
  const prompt=document.getElementById('cfol-prompt').value.trim();
  if(_curFolderId){
    const f=conceptFolders.find(x=>x.id===_curFolderId);
    if(f){f.name=name;f.prompt=prompt;}
  }else{
    conceptFolders.push({id:uid(),name,prompt,collapsed:false});
  }
  saveAll();closeModal('modal-concept-folder');renderConcepts();
  showNotif(_curFolderId?'Dossier modifié !':'Dossier créé !','ok');
}

function deleteConceptFolder(){
  if(!_curFolderId)return;
  if(!confirm('Supprimer ce dossier ? Les concepts seront déplacés dans "Sans dossier".'))return;
  concepts.forEach(c=>{if(c.folderId===_curFolderId)c.folderId=null;});
  conceptFolders=conceptFolders.filter(x=>x.id!==_curFolderId);
  saveAll();closeModal('modal-concept-folder');renderConcepts();
  showNotif('Dossier supprimé','ok');
}

let _moveConceptId=null;
function openMoveConcept(id){
  _moveConceptId=id;
  const c=concepts.find(x=>x.id===id);if(!c)return;
  const list=document.getElementById('cfol-move-list');
  let html=`<button class="cfol-move-opt${!c.folderId?' active':''}" onclick="moveConceptToFolder('${id}',null)">
    <span class="ms" style="font-size:18px;color:var(--on-sv)">folder_off</span>
    <span>Sans dossier</span>
  </button>`;
  conceptFolders.forEach(f=>{
    html+=`<button class="cfol-move-opt${c.folderId===f.id?' active':''}" onclick="moveConceptToFolder('${id}','${f.id}')">
      <span class="ms" style="font-size:18px;color:var(--primary)">folder</span>
      <span>${_esc(f.name)}</span>
    </button>`;
  });
  if(conceptFolders.length===0)html+=`<div style="text-align:center;padding:12px;color:var(--on-sv);font-size:13px">Aucun dossier — créez-en un d'abord.</div>`;
  list.innerHTML=html;
  openModal('modal-move-concept');
}

function moveConceptToFolder(conceptId,folderId){
  const c=concepts.find(x=>x.id===conceptId);if(!c)return;
  c.folderId=folderId||null;
  saveAll();closeModal('modal-move-concept');renderConcepts();
  const fname=folderId?conceptFolders.find(f=>f.id===folderId)?.name:'Sans dossier';
  showNotif(`Déplacé vers "${fname}"`, 'ok');
}

let _curConceptId=null;
function openConceptDef(id){
  _curConceptId=id;
  _cdefActiveSlot='Q';
  const c=concepts.find(x=>x.id===id);if(!c)return;
  document.getElementById('cdef-term').textContent=c.term;
  document.getElementById('cdef-paste').value='';
  document.getElementById('cdef-def').value=c.definition||'';
  document.getElementById('cdef-kw').value=(c.keywords||[]).join(', ');
  document.getElementById('cdef-prompt-box').style.display='none';
  _setConceptImageZone('Q', c.imageQ||c.image||null);
  _setConceptImageZone('A', c.imageA||null);
  switchCDefTab('manuel');
  openModal('modal-concept-def');
}
function switchCDefTab(tab){
  const isIA=tab==='ia';
  const pm=document.getElementById('cdef-panel-manuel');const pi=document.getElementById('cdef-panel-ia');
  if(pm)pm.style.display=isIA?'none':'block';
  if(pi)pi.style.display=isIA?'block':'none';
  const tm=document.getElementById('cdeftab-manuel'),ti=document.getElementById('cdeftab-ia');
  if(tm){tm.style.background=isIA?'none':'var(--surface)';tm.style.boxShadow=isIA?'none':'0 1px 4px rgba(0,0,0,.12)';tm.style.color=isIA?'var(--on-sv)':'var(--on-surface)';}
  if(ti){ti.style.background=isIA?'var(--surface)':'none';ti.style.boxShadow=isIA?'0 1px 4px rgba(0,0,0,.12)':'none';ti.style.color=isIA?'var(--on-surface)':'var(--on-sv)';}
}
function genConceptPrompt(){
  const c=concepts.find(x=>x.id===_curConceptId);if(!c)return;
  // Utilise le prompt du dossier si défini, sinon le prompt par défaut
  const folder=c.folderId?conceptFolders.find(f=>f.id===c.folderId):null;
  const template=(folder&&folder.prompt)?folder.prompt:_DEFAULT_CONCEPT_PROMPT;
  const prompt=template.replace(/\{\{TERM\}\}/g,c.term);
  const box=document.getElementById('cdef-prompt-box');
  box.textContent=prompt;box.style.display='block';
  navigator.clipboard.writeText(prompt).then(()=>showNotif('Prompt copié !','ok')).catch(()=>{});
}
function genConceptPromptForId(id){
  openConceptDef(id);
  setTimeout(()=>genConceptPrompt(),120);
}
function parseCdefPaste(){
  const text=document.getElementById('cdef-paste').value;

  // ── Format natif attendu : DÉFINITION / MOTS_CLÉS ──────────
  const defM=text.match(/^D[ÉE]FINITION\s*:\s*(.+)$/mi);
  const kwM =text.match(/^MOTS[_\-]?CL[ÉE]S?\s*:\s*(.+)$/mi);

  // ── Formats alternatifs (IA espagnole / anglaise / libre) ───
  // Respuesta: …  |  Réponse: …  |  Answer: …  |  Définition: …
  const altDefM=!defM&&text.match(/^(?:Respuesta|R[eé]ponse|Answer|D[eé]finition)\s*[:\-]\s*(.+)$/mi);

  // Format "Ficha N\n○ Pregunta: …\n○ Respuesta: …"
  // → on prend la PREMIÈRE Respuesta trouvée
  const fichaM=!defM&&!altDefM&&text.match(/Respuesta\s*:\s*([^\n]+(?:\n(?![\n○•\-*]).[^\n]*)*)/i);

  // Valeur finale de définition (tronquée à 200 car) ───────────
  const rawDef=(defM||altDefM||fichaM)?.[1];
  const defVal=rawDef?.trim().replace(/\s+/g,' ').substring(0,200);

  if(defVal)document.getElementById('cdef-def').value=defVal;
  if(kwM)   document.getElementById('cdef-kw').value=kwM[1].trim();
  if(defVal||kwM)switchCDefTab('manuel');
}
function saveConceptDef(){
  const def=document.getElementById('cdef-def').value.trim();
  const kw=document.getElementById('cdef-kw').value.trim();
  if(!def){showNotif('La définition est vide','');return;}
  const imgQEl=document.getElementById('cdef-imgq-el');
  const imgAEl=document.getElementById('cdef-imga-el');
  const imageQ=imgQEl&&imgQEl.src&&imgQEl.src.startsWith('data:')?imgQEl.src:null;
  const imageA=imgAEl&&imgAEl.src&&imgAEl.src.startsWith('data:')?imgAEl.src:null;
  const c=concepts.find(x=>x.id===_curConceptId);
  if(c){c.imageQ=imageQ;c.imageA=imageA;c.image=null;}
  updateConceptFiche(_curConceptId,def,kw,null);
  closeModal('modal-concept-def');
  if(document.getElementById('screen-concepts').classList.contains('active'))renderConcepts();
  showNotif('Fiche enregistrée !','ok');
}
let _cdefActiveSlot='Q'; // tracks which zone is active for paste
function _setConceptImageZone(slot,src){
  const s=slot.toLowerCase();
  const el=document.getElementById(`cdef-img${s}-el`);
  const ph=document.getElementById(`cdef-img${s}-placeholder`);
  const rm=document.getElementById(`cdef-img${s}-remove`);
  const zone=document.getElementById(`cdef-img${s}-zone`);
  if(src){if(el){el.src=src;el.style.display='block';}if(ph)ph.style.display='none';if(rm)rm.style.display='flex';}
  else{if(el){el.src='';el.style.display='none';}if(ph)ph.style.display='flex';if(rm)rm.style.display='none';}
}
function _applyConceptImage(file,slot){
  if(!file||!file.type.startsWith('image/'))return;
  const s=slot||_cdefActiveSlot||'Q';
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=520;let w=img.width,h=img.height;
      if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      const b64=cv.toDataURL('image/jpeg',.8);
      _setConceptImageZone(s,b64);
      // Also save immediately to concept if editing
      if(_curConceptId){const c=concepts.find(x=>x.id===_curConceptId);if(c){if(s==='A')c.imageA=b64;else c.imageQ=b64;}}
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
function removeConceptImage(slot){
  const s=slot||'Q';
  _setConceptImageZone(s,null);
  const inp=document.getElementById(`cdef-img${s.toLowerCase()}-input`);if(inp)inp.value='';
  if(_curConceptId){const c=concepts.find(x=>x.id===_curConceptId);if(c){if(s==='A')c.imageA=null;else c.imageQ=null;}}
}
// Paste anywhere in the concept modal → goes to active slot
document.addEventListener('paste',e=>{
  const modal=document.getElementById('modal-concept-def');
  if(!modal||!modal.classList.contains('open'))return;
  // Skip if pasting into a text field
  const tag=document.activeElement&&document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  const items=e.clipboardData&&e.clipboardData.items;
  if(!items)return;
  for(const it of items){if(it.type.startsWith('image/')){e.preventDefault();_applyConceptImage(it.getAsFile(),_cdefActiveSlot);return;}}
});
function deleteConcept(id){
  showConfirm('Supprimer ce concept ?','Cette action est irréversible.','Supprimer',()=>{
    concepts=concepts.filter(x=>x.id!==id);saveAll();renderConcepts();
  });
}
function openAddConceptManual(){
  _pendingConceptFolderId=null;
  document.getElementById('ac-term').value='';
  openModal('modal-add-concept');
  setTimeout(()=>document.getElementById('ac-term').focus(),120);
}
function saveManualConcept(){
  const term=document.getElementById('ac-term').value.trim();
  if(!term){showNotif('Entrez un terme','');return;}
  const added=addConcept(term,null);
  if(added && _pendingConceptFolderId){
    const c=concepts.find(x=>x.term.toLowerCase()===term.toLowerCase());
    if(c){ c.folderId=_pendingConceptFolderId; saveAll(); }
  }
  _pendingConceptFolderId=null;
  closeModal('modal-add-concept');
  renderConcepts();
  showNotif(added?`"${term}" ajouté !`:`"${term}" existe déjà`,'ok');
  if(added){
    const c=concepts.find(x=>x.term.toLowerCase()===term.toLowerCase());
    if(c)setTimeout(()=>openConceptDef(c.id),200);
  }
}

// ── Sélection de texte → tooltip ──
let _tooltipTerm='',_tooltipQid=null;
function _handleSelection(){
  const sel=window.getSelection();
  if(!sel||sel.isCollapsed){hideConceptTooltip();return;}
  const range=sel.getRangeAt(0);
  const qqEl=document.getElementById('qq');
  const qexplEl=document.getElementById('qexpl');
  const inQQ=qqEl&&qqEl.contains(range.commonAncestorContainer);
  const inExpl=qexplEl&&qexplEl.style.display!=='none'&&qexplEl.contains(range.commonAncestorContainer);
  if(!inQQ&&!inExpl){hideConceptTooltip();return;}
  const text=sel.toString().trim();
  if(text.length<2||text.length>80){hideConceptTooltip();return;}
  const rect=range.getBoundingClientRect();
  _tooltipTerm=text;
  _tooltipQid=(typeof session!=='undefined'&&session&&session.qs)?session.qs[session.cur]?.id:null;
  const tt=document.getElementById('concept-tooltip');
  tt.style.left=(rect.left+rect.width/2)+'px';
  tt.style.top=Math.max(10,rect.top-52)+'px';
  tt.style.display='block';
}
// concept tooltip disabled

function hideConceptTooltip(){document.getElementById('concept-tooltip').style.display='none';}
function addSelectedConcept(){
  if(!_tooltipTerm)return;
  const added=addConcept(_tooltipTerm,_tooltipQid);
  hideConceptTooltip();
  window.getSelection().removeAllRanges();
  showNotif(added?`"${_tooltipTerm}" ajouté !`:`"${_tooltipTerm}" déjà enregistré`,'ok');
  _tooltipTerm='';
}

// ════════════════════════════════════════════
// FLASHCARD SESSION (concepts + standalone)
// ════════════════════════════════════════════
let fcSess={cards:[],cur:0,correct:0,returnTo:'concepts'};

function startConceptFlashcards(dueOnly){
  const pool=dueOnly?getConceptsDue():concepts.filter(c=>c.definition);
  if(!pool.length){showNotif(dueOnly?'Aucun concept à réviser !':'Ajoutez des fiches d\'abord.','');return;}
  startFCSession(pool.map(c=>({...c,type:'concept'})),'concepts');
}
function startFolderFlashcards(folderId){
  const pool=concepts.filter(c=>c.folderId===folderId&&c.definition);
  if(!pool.length){showNotif('Aucune fiche dans ce dossier. Importez d\'abord.','');return;}
  startFCSession(pool.map(c=>({...c,type:'concept'})),'concepts');
}
function startAllFlashcards(){
  const pool=flashcards.map(fc=>({...fc,type:'flashcard',masteryLevel:0}));
  if(!pool.length){showNotif('Aucune flashcard dans vos cours. Importez-en depuis un cours.','');return;}
  startFCSession(pool,'home');
}
function startCourseFlashcards(){
  const pool=getFlashcardsForCourse(curC);
  if(!pool.length){showNotif('Aucune flashcard dans ce cours.','');return;}
  startFCSession(pool.map(fc=>({...fc,type:'flashcard',masteryLevel:0})),'course');
}
let _fcTouchStartX=0,_fcTouchStartY=0;
function startFCSession(cards,returnTo){
  fcSess={cards:shuffle([...cards]),cur:0,correct:0,returnTo:returnTo||'concepts'};
  showScreen('concept-fc');
  renderFCCard();
  // Touch swipe for mobile navigation
  const stage=document.querySelector('.fc-stage');
  if(stage&&!stage._fcSwipeInit){
    stage._fcSwipeInit=true;
    stage.addEventListener('touchstart',e=>{_fcTouchStartX=e.touches[0].clientX;_fcTouchStartY=e.touches[0].clientY;},{passive:true});
    stage.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-_fcTouchStartX;
      const dy=e.changedTouches[0].clientY-_fcTouchStartY;
      if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy))return;
      if(_fcFlipped){
        // Card is flipped: swipe = answer (left=Pas su, right=Je savais)
        fcAnswer(dx>0);
      } else {
        // Card not flipped: swipe = navigate
        if(dx<0)nextFCCardNav();else prevFCCard();
      }
    },{passive:true});
  }
}

let _fcFlipped=false;

function renderFCCard(dir){
  const c=fcSess.cards[fcSess.cur];const total=fcSess.cards.length;
  _fcFlipped=false;
  // Reset card to front
  const card=document.getElementById('cfcard');
  if(card) card.classList.remove('flipped');
  // Hide answer buttons
  const ar=document.getElementById('fc-answer-row');
  if(ar) ar.classList.remove('visible');
  // Progress + counter
  document.getElementById('cfprog').style.width=((fcSess.cur/total)*100)+'%';
  document.getElementById('cfn').textContent=`${fcSess.cur+1} / ${total}`;
  const lvl=c.type==='concept'?`${MASTERY_EMOJI[Math.min(c.masteryLevel,5)]} Niv. ${c.masteryLevel}/5`:'Flashcard';
  document.getElementById('cfmeta').textContent=lvl;
  // Front content
  document.getElementById('cfterm').textContent=c.term||'';
  // Back content
  document.getElementById('cfdef').textContent=c.definition||'—';
  const kwEl=document.getElementById('cfkw-hint');
  if(kwEl){
    if(c.keywords&&c.keywords.length){
      const chips=c.keywords.map(kw=>`<span class="kw-chip kw-ok">${_esc(kw)}</span>`).join('');
      kwEl.innerHTML=`<div style="font-size:10px;color:var(--on-sv);margin-bottom:5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">Mots-clés</div><div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center">${chips}</div>`;
    } else { kwEl.innerHTML=''; }
  }
  // Images
  const imgQ=c.imageQ||c.image||null;
  const qEl=document.getElementById('cfimg-q'),qImg=document.getElementById('cfimg-q-el');
  if(qEl&&qImg){if(imgQ){qImg.src=imgQ;qEl.style.display='block';}else{qEl.style.display='none';qImg.src='';}}
  const aEl=document.getElementById('cfimg-a'),aImg=document.getElementById('cfimg-a-el');
  if(aEl&&aImg){if(c.imageA){aImg.src=c.imageA;aEl.style.display='block';}else{aEl.style.display='none';}}
  // Prev/next button state
  const prevBtn=document.getElementById('fc-prev-btn');
  if(prevBtn) prevBtn.disabled=fcSess.cur===0;
  // Slide animation
  if(dir&&card){
    card.classList.add(dir==='right'?'fc-slide-right':'fc-slide-left');
    card.addEventListener('animationend',()=>card.classList.remove('fc-slide-right','fc-slide-left'),{once:true});
  }
}

function toggleFCFlip(){
  const card=document.getElementById('cfcard');
  if(!card) return;
  _fcFlipped=!_fcFlipped;
  card.classList.toggle('flipped',_fcFlipped);
  const ar=document.getElementById('fc-answer-row');
  if(ar) ar.classList.toggle('visible',_fcFlipped);
}

function prevFCCard(){
  if(fcSess.cur===0) return;
  fcSess.cur--;
  renderFCCard('left');
}

function nextFCCardNav(){
  if(fcSess.cur>=fcSess.cards.length-1){endFCSession();return;}
  fcSess.cur++;
  renderFCCard('right');
}

function fcAnswer(knew){
  const c=fcSess.cards[fcSess.cur];
  if(knew) fcSess.correct++;
  if(c.type==='concept') updateConceptMastery(c.id, knew?'correct':'wrong');
  if(typeof updateFCSpaced==='function') updateFCSpaced(c.id, knew);
  const card=document.getElementById('cfcard');
  card.classList.add(knew?'cf-swipe-right':'cf-swipe-left');
  setTimeout(()=>{
    card.classList.remove('cf-swipe-right','cf-swipe-left','flipped');
    fcSess.cur++;
    if(fcSess.cur>=fcSess.cards.length){endFCSession();return;}
    renderFCCard('right');
  },240);
}

// Raccourcis clavier globaux
document.addEventListener('keydown', e=>{
  // Recherche : / ou Ctrl+K pour ouvrir
  if((e.key==='/'||e.key==='k'&&(e.ctrlKey||e.metaKey))&&!document.getElementById('search-overlay')?.classList.contains('open')){
    if(e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA'&&!e.target.isContentEditable){
      e.preventDefault();openSearch();return;
    }
  }
  // Recherche ouverte : Échap / flèches / Entrée
  if(document.getElementById('search-overlay')?.classList.contains('open')){
    if(e.key==='Escape'){e.preventDefault();const ov=document.getElementById('search-overlay');if(ov)ov.classList.remove('open');return;}
    const items=document.querySelectorAll('.sr-item');
    if(e.key==='ArrowDown'&&items.length){e.preventDefault();_searchIdx=Math.min(_searchIdx+1,items.length-1);_searchHover(_searchIdx);items[_searchIdx].scrollIntoView({block:'nearest'});return;}
    if(e.key==='ArrowUp'&&items.length){e.preventDefault();_searchIdx=Math.max(_searchIdx-1,0);_searchHover(_searchIdx);items[_searchIdx].scrollIntoView({block:'nearest'});return;}
    if(e.key==='Enter'&&items.length){e.preventDefault();_searchGo(_searchIdx);return;}
    return;
  }

  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;

  // Flashcard : Espace = flip, ← → = navigation
  if(document.body.dataset.screen==='concept-fc'){
    if(e.code==='Space'){e.preventDefault();toggleFCFlip();return;}
    if(e.code==='ArrowRight'){e.preventDefault();nextFCCardNav();return;}
    if(e.code==='ArrowLeft'){e.preventDefault();prevFCCard();return;}
    return;
  }

  // Quiz : Q/S/D/F = réponses A/B/C/D, Espace = suivante
  if(document.body.dataset.screen==='quiz'&&session){
    // + / − = taille du texte (sans Ctrl/Cmd : le zoom du navigateur reste disponible)
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.key==='+'||e.key==='='||e.key==='-')){
      e.preventDefault();changeQuizZoom(e.key==='-'?-0.1:0.1);return;
    }
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key==='0'){e.preventDefault();setQuizFontScale(1);return;}   /* 0 = retour à 100 % */
    const keyToIdx={q:0,s:1,d:2,f:3};
    const idx=keyToIdx[e.key.toLowerCase()];
    if(idx!==undefined){
      e.preventDefault();
      const opts=[...document.querySelectorAll('.ob:not(:disabled)')];
      if(opts[idx]){
        opts[idx].focus();
        opts[idx].click();
      }
      return;
    }
    if(e.code==='Space'){
      e.preventDefault();
      const nrow=document.getElementById('qnrow');
      const nbtn=document.getElementById('qnbtn');
      if(nrow&&nrow.style.display!=='none'&&nbtn)nbtn.click();
      return;
    }
    if(e.code==='ArrowRight'){
      e.preventDefault();
      const nrow=document.getElementById('qnrow');
      const nbtn=document.getElementById('qnbtn');
      if(nrow&&nrow.style.display!=='none'&&nbtn)nbtn.click();
      return;
    }
    if(e.code==='ArrowLeft'){
      e.preventDefault();
      prevQ();
    }
  }
});

function endFCSession(){
  const s=fcSess.correct,t=fcSess.cards.length;
  showNotif(`Session terminée : ${s}/${t} (${Math.round(s/t*100)}%)`, 'ok');
  if(fcSess.returnTo==='course'){showScreen('course');}
  else{switchTab(fcSess.returnTo);}
}

// ── Course flashcard import ──
function parseFlashcards(text){
  const cards=[];
  const blocks=text.trim().split(/\n---+\n?|(?=\nTERME\s*:)/i);
  for(const block of blocks){
    const b=block.trim();if(!b)continue;
    const termM=b.match(/^TERME\s*:\s*(.+)$/mi);
    const defM=b.match(/^D[ÉE]FINITION\s*:\s*(.+)$/mi);
    const kwM=b.match(/^MOTS[_\-]?CL[ÉE]S?\s*:\s*(.+)$/mi);
    if(termM&&defM){
      cards.push({term:termM[1].trim(),definition:defM[1].trim(),keywords:kwM?kwM[1].split(',').map(k=>k.trim()).filter(Boolean):[]});
    }
  }
  return cards;
}

// ════════════════════════════════════════════
// IMPORT EN LOT — CONCEPTS
// ════════════════════════════════════════════

let _bciTab = 'ia';
let _bciTargetFolderId = null;
let _activeFolderView  = null;
let _conceptSelectMode = false;
let _selectedConceptIds = new Set();

function toggleConceptSelectMode(){
  _conceptSelectMode = !_conceptSelectMode;
  _selectedConceptIds.clear();
  const btn = document.getElementById('concept-select-btn');
  const bar = document.getElementById('concepts-select-bar');
  if(btn){ btn.style.background = _conceptSelectMode ? 'var(--primary)' : ''; btn.style.color = _conceptSelectMode ? '#fff' : ''; btn.style.borderColor = _conceptSelectMode ? 'transparent' : ''; }
  if(bar) bar.style.display = _conceptSelectMode ? 'flex' : 'none';
  _updateConceptSelBar();
  renderConcepts();
}

function _updateConceptSelBar(){
  const n = _selectedConceptIds.size;
  const countEl = document.getElementById('concept-sel-count');
  const delBtn  = document.getElementById('concept-delete-sel-btn');
  const movBtn  = document.getElementById('concept-move-sel-btn');
  if(countEl) countEl.textContent = n;
  if(delBtn)  { delBtn.disabled = n === 0; delBtn.style.opacity = n > 0 ? '1' : '.4'; }
  if(movBtn)  { movBtn.disabled = n === 0; movBtn.style.opacity = n > 0 ? '1' : '.4'; }
}

function moveSelectedConceptsToFolder(){
  const n = _selectedConceptIds.size;
  if(!n) return;
  const titleEl = document.getElementById('cfol-move-title');
  if(titleEl) titleEl.textContent = `Déplacer ${n} concept${n>1?'s':''} vers…`;
  let html = `<button class="cfol-move-opt" onclick="applyMoveSelectedConcepts(null)"><span class="ms" style="font-size:16px;vertical-align:middle">inbox</span> Sans dossier</button>`;
  conceptFolders.forEach(f=>{
    html += `<button class="cfol-move-opt" onclick="applyMoveSelectedConcepts('${f.id}')"><span class="ms" style="font-size:16px;vertical-align:middle">folder</span> ${_esc(f.name)}</button>`;
  });
  if(conceptFolders.length===0) html += `<div style="font-size:13px;color:var(--on-sv);text-align:center;padding:20px 0">Aucun dossier. Créez-en un d'abord.</div>`;
  document.getElementById('cfol-move-list').innerHTML = html;
  openModal('modal-move-concept');
}

function applyMoveSelectedConcepts(folderId){
  const ids = [..._selectedConceptIds];
  ids.forEach(id=>{ const c=concepts.find(x=>x.id===id); if(c) c.folderId=folderId||null; });
  saveAll();
  closeModal('modal-move-concept');
  const dest = folderId ? (conceptFolders.find(f=>f.id===folderId)?.name||'dossier') : 'sans dossier';
  showNotif(`${ids.length} concept${ids.length>1?'s':''} déplacé${ids.length>1?'s':''} → ${dest}`, 'ok');
  _selectedConceptIds.clear();
  _updateConceptSelBar();
  renderConcepts();
}

function conceptSelectAll(){
  const pool = _activeFolderView
    ? concepts.filter(c => c.folderId === _activeFolderView)
    : concepts;
  pool.forEach(c => _selectedConceptIds.add(c.id));
  _updateConceptSelBar();
  renderConcepts();
}

function toggleConceptSelect(id){
  if(_selectedConceptIds.has(id)) _selectedConceptIds.delete(id);
  else _selectedConceptIds.add(id);
  _updateConceptSelBar();
  // Update just the checkbox to avoid full re-render flicker
  const cb = document.getElementById('csel-'+id);
  if(cb) cb.checked = _selectedConceptIds.has(id);
}

function deleteSelectedConcepts(){
  const n = _selectedConceptIds.size;
  if(!n) return;
  showConfirm(`Supprimer ${n} concept${n>1?'s':''} ?`, 'Cette action est irréversible.', `Supprimer ${n}`, () => {
    concepts = concepts.filter(c => !_selectedConceptIds.has(c.id));
    _selectedConceptIds.clear();
    saveAll();
    _updateConceptSelBar();
    renderConcepts();
    showNotif(`${n} concept${n>1?'s':''} supprimé${n>1?'s':''}`, 'ok');
  });
}

let _pendingConceptFolderId = null;

function openAddConceptInFolder(folderId) {
  _pendingConceptFolderId = folderId || null;
  document.getElementById('ac-term').value = '';
  openModal('modal-add-concept');
  setTimeout(() => document.getElementById('ac-term').focus(), 120);
}

function openBulkConceptImport(folderId) {
  _bciTargetFolderId = folderId || null;
  // Reset
  const p = document.getElementById('bci-paste');
  const pm = document.getElementById('bci-paste-manuel');
  const pb = document.getElementById('bci-prompt-box');
  const prev = document.getElementById('bci-preview');
  const prevm = document.getElementById('bci-preview-manuel');
  if(p)   p.value = '';
  if(pm)  pm.value = '';
  if(pb)  { pb.textContent = ''; pb.style.display = 'none'; }
  if(prev)  prev.textContent = '';
  if(prevm) prevm.textContent = '';
  bciSwitchTab('ia');
  openModal('modal-bulk-concepts');
}

function bciSwitchTab(tab) {
  _bciTab = tab;
  const isIA = tab === 'ia';
  const pIA  = document.getElementById('bci-panel-ia');
  const pMn  = document.getElementById('bci-panel-manuel');
  const tIA  = document.getElementById('bci-tab-ia');
  const tMn  = document.getElementById('bci-tab-manuel');
  if(pIA) pIA.style.display = isIA ? '' : 'none';
  if(pMn) pMn.style.display = isIA ? 'none' : '';
  const onStyle  = 'var(--surface)';
  const offStyle = 'none';
  if(tIA) { tIA.style.background = isIA ? onStyle : offStyle; tIA.style.boxShadow = isIA ? '0 1px 4px rgba(0,0,0,.12)' : 'none'; tIA.style.color = isIA ? 'var(--on-surface)' : 'var(--on-sv)'; }
  if(tMn) { tMn.style.background = isIA ? offStyle : onStyle; tMn.style.boxShadow = isIA ? 'none' : '0 1px 4px rgba(0,0,0,.12)'; tMn.style.color = isIA ? 'var(--on-sv)' : 'var(--on-surface)'; }
}

/* ── Génère le prompt pour remplir tous les concepts sans fiche ── */
function genBulkConceptPrompt() {
  const unfilled = concepts.filter(c => !c.definition && (_bciTargetFolderId ? c.folderId === _bciTargetFolderId : true));
  if (!unfilled.length) { showNotif('Tous les concepts ont déjà une fiche !', 'ok'); return; }

  const termList = unfilled.map(c => `- ${c.term}`).join('\n');

  // Format TERME: — le seul fiable pour le matching au retour
  const prompt =
`Tu es un expert pédagogue en kinésithérapie et médecine.
Pour chacun des termes ci-dessous, génère une fiche de mémorisation.

Format EXACT — respecte le séparateur --- entre chaque fiche :

TERME: [terme exact, recopié mot pour mot]
DÉFINITION: [max 20 mots, définition précise et mémorisable]
MOTS_CLÉS: [4-6 concepts-clés séparés par des virgules]
---

Règle MOTS_CLÉS : chaque mot-clé = un concept incontournable que l'étudiant doit citer.

Termes à traiter :
${termList}`;

  const box = document.getElementById('bci-prompt-box');
  if(box) { box.textContent = prompt; box.style.display = 'block'; }
  navigator.clipboard.writeText(prompt)
    .then(() => showNotif(`Prompt copié — ${unfilled.length} terme(s) à remplir`, 'ok'))
    .catch(() => {});
}

/* ── Parse le texte collé (onglet IA) ──────────────────────────
 * Formats acceptés (après nettoyage markdown) :
 *  A) TERME: ...\nDÉFINITION: ...\nMOTS_CLÉS: ...   ← recommandé
 *  B) Fiche N\nDÉFINITION: ...\nMOTS_CLÉS: ...      ← import externe
 * ─────────────────────────────────────────────────────────────*/
function _parseBulkIA(text) {
  const results = [];

  // ── 1. Nettoyage markdown ─────────────────────────────────
  const clean = text
    .replace(/\*\*/g, '')           // **bold**
    .replace(/\_\_/g, '')           // __bold__
    .replace(/^#+\s*/gm, '')        // ## titres markdown
    .replace(/^[○•]\s+/gm, '');     // puces (sans toucher aux tirets qui peuvent être dans les defs)

  // ── 2. Découpage en blocs ─────────────────────────────────
  // Séparateur explicite --- OU nouvelle occurrence de TERME:/Fiche(a) N en début de ligne
  const blocks = clean.trim().split(
    /\n---+\n?|(?=\n(?:TERME\s*:|Fich[ae]\s+\d))/i
  );

  blocks.forEach(raw => {
    const b = raw.trim();
    if (!b) return;

    const ficheM = b.match(/^Fich[ae]\s+(\d+)/i);
    const termeM = b.match(/^TERME\s*:\s*(.+)$/mi);

    // DÉFINITION : capture jusqu'à MOTS_CLÉS ou fin de bloc
    // Accepte aussi : Respuesta: / Réponse: / Answer: / Pregunta: (espagnol/anglais)
    const defM = b.match(/^(?:D[ÉE]FINITION|RESPUESTA|R[ÉE]PONSE|ANSWER|PREGUNTA)\s*:\s*(.+?)(?=\s*\n(?:MOTS|PALABRAS|KEYWORDS)|\s*$)/msi);
    const kwM  = b.match(/^(?:MOTS[_\-]?CL[ÉE]S?|PALABRAS[_\-]?CLAVE|KEYWORDS?)\s*:\s*(.+)$/mi);

    if (!defM) return; // pas de définition → bloc invalide

    const definition = defM[1].trim().replace(/\s+/g, ' ');
    const keywords   = kwM ? kwM[1].split(',').map(k => k.trim()).filter(Boolean) : [];

    let term = null;

    if (termeM) {
      // Format A : TERME: explicite → matching par nom
      term = termeM[1].trim();

    } else if (ficheM) {
      const n = parseInt(ficheM[1], 10);

      // Essai 1 : index dans la liste complète des concepts (1-based)
      if (n >= 1 && n <= concepts.length) {
        term = concepts[n - 1].term;
      } else {
        // Essai 2 : pas de concept à cet index → créer avec la définition
        // (premier segment significatif de la définition comme titre provisoire)
        const words = definition.split(/\s+/).slice(0, 4).join(' ');
        term = words.length > 3 ? words : `Fiche ${n}`;
      }
    }

    if (term) results.push({ term, definition, keywords });
  });

  return results;
}

/* ── Parse le texte collé (onglet Manuel) — format TERME/DÉFINITION/MOTS_CLÉS ── */
function _parseBulkManuel(text) {
  const results = [];
  const blocks = text.trim().split(/\n---+\n?|(?=\nTERME\s*:)/i);
  blocks.forEach(raw => {
    const b = raw.trim(); if (!b) return;
    const termeM = b.match(/^TERME\s*:\s*(.+)$/mi);
    const defM   = b.match(/^D[ÉE]FINITION\s*:\s*(.+)$/mi);
    const kwM    = b.match(/^MOTS[_\-]?CL[ÉE]S?\s*:\s*(.+)$/mi);
    if (termeM && defM) {
      results.push({
        term       : termeM[1].trim(),
        definition : defM[1].trim(),
        keywords   : kwM ? kwM[1].split(',').map(k => k.trim()).filter(Boolean) : [],
      });
    }
  });
  return results;
}

/* ── Aperçu live (onglet IA) ─────────────────────────────────── */
function bciPreview() {
  const text = document.getElementById('bci-paste')?.value || '';
  const prev = document.getElementById('bci-preview');
  if (!prev) return;
  if (!text.trim()) { prev.textContent = ''; return; }
  const parsed = _parseBulkIA(text);
  if (!parsed.length) {
    prev.innerHTML = '<span style="color:var(--error)">⚠ Aucune fiche reconnue — vérifiez le format</span>';
    return;
  }
  const news  = parsed.filter(p => !concepts.find(c => c.term.toLowerCase() === p.term.toLowerCase()));
  const upd   = parsed.length - news.length;
  prev.innerHTML =
    `<span style="color:var(--tertiary)">✓ ${parsed.length} fiche(s) reconnue(s)</span>` +
    (upd  ? ` · <span>${upd} mise(s) à jour</span>` : '') +
    (news.length ? ` · <span>${news.length} nouveau(x) concept(s)</span>` : '');
}

/* ── Aperçu live (onglet Manuel) ────────────────────────────── */
function bciPreviewManuel() {
  const text = document.getElementById('bci-paste-manuel')?.value || '';
  const prev = document.getElementById('bci-preview-manuel');
  if (!prev) return;
  if (!text.trim()) { prev.textContent = ''; return; }
  const parsed = _parseBulkManuel(text);
  if (!parsed.length) {
    prev.innerHTML = '<span style="color:var(--error)">⚠ Aucune fiche reconnue — vérifiez le format</span>';
    return;
  }
  const news = parsed.filter(p => !concepts.find(c => c.term.toLowerCase() === p.term.toLowerCase()));
  prev.innerHTML =
    `<span style="color:var(--tertiary)">✓ ${parsed.length} fiche(s) reconnue(s)</span>` +
    (news.length ? ` · ${news.length} nouveau(x)` : '');
}

/* ── Import effectif ─────────────────────────────────────────── */
function importBulkConcepts() {
  const isIA = _bciTab === 'ia';
  const text  = isIA
    ? (document.getElementById('bci-paste')?.value || '')
    : (document.getElementById('bci-paste-manuel')?.value || '');

  const parsed = isIA ? _parseBulkIA(text) : _parseBulkManuel(text);
  if (!parsed.length) { showNotif('Aucune fiche reconnue', ''); return; }

  let updated = 0, created = 0;

  parsed.forEach(({ term, definition, keywords }) => {
    const existing = concepts.find(c => c.term.toLowerCase() === term.toLowerCase());
    if (existing) {
      existing.definition = definition;
      existing.keywords   = keywords;
      if (_bciTargetFolderId) existing.folderId = _bciTargetFolderId;
      updated++;
    } else {
      // Créer un nouveau concept
      concepts.push({
        id          : uid(),
        term,
        definition,
        keywords,
        state       : 'toExplain',
        masteryLevel: 0,
        nextReview  : null,
        folderId    : _bciTargetFolderId || null,
      });
      created++;
    }
  });

  saveAll();
  closeModal('modal-bulk-concepts');
  renderConcepts();
  showNotif(`${updated} mise(s) à jour · ${created} créé(s)`, 'ok');
}

// ════════════════════════════════════════════
// PROMPT STUDIO
// ════════════════════════════════════════════
let _editingPromptId=null;
const _expandedPrompts=new Set();

function _escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function renderPrompts(){
  const el=document.getElementById('prompts-list');
  if(!el)return;
  if(!prompts.length){
    el.innerHTML=`<div style="text-align:center;padding:50px 20px;color:var(--muted)">
      <div style="font-size:44px;margin-bottom:14px"><span class="ms" style="font-size:44px">auto_awesome</span></div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px;color:var(--on-bg)">Aucun prompt</div>
      <div style="font-size:13px">Appuie sur <b>+</b> pour créer ton premier prompt IA</div>
    </div>`;
    return;
  }
  el.innerHTML=prompts.map(p=>{
    const wc=p.content.trim().split(/\s+/).length;
    const isExp=_expandedPrompts.has(p.id);
    const preview=(!isExp&&p.content.length>200)?p.content.slice(0,200)+'…':p.content;
    const canExpand=p.content.length>200;
    return `<div style="background:var(--surf);border-radius:var(--r-xl);padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:15px;color:var(--on-bg);margin-bottom:2px">${_escH(p.name)}</div>
          <div style="font-size:11px;color:var(--muted)">${wc} mots</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;margin-top:2px">
          <button onclick="editPrompt('${p.id}')" title="Modifier" style="background:var(--surf-low);border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="ms" style="font-size:17px;color:var(--muted)">edit</span></button>
          <button onclick="deletePrompt('${p.id}')" title="Supprimer" style="background:var(--surf-low);border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="ms" style="font-size:17px;color:var(--error,#f87171)">delete</span></button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--on-sv);line-height:1.65;white-space:pre-wrap;background:var(--surf-low);border-radius:10px;padding:10px 12px;margin-bottom:10px;${isExp?'max-height:300px;overflow-y:auto;':''}">${_escH(preview)}</div>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="copyPrompt('${p.id}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:var(--primary);color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s" onmousedown="this.style.opacity='.75'" onmouseup="this.style.opacity='1'">
          <span class="ms" style="font-size:16px">content_copy</span>Copier
        </button>
        ${canExpand?`<button onclick="togglePromptExpand('${p.id}')" style="background:var(--surf-low);border:none;border-radius:10px;padding:11px 14px;font-size:12px;color:var(--muted);cursor:pointer;white-space:nowrap">${isExp?'Réduire ↑':'Voir tout ↓'}</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function copyPrompt(id){
  const p=prompts.find(x=>x.id===id);
  if(!p)return;
  navigator.clipboard.writeText(p.content).then(()=>showNotif('Prompt copié !','ok')).catch(()=>showNotif('Erreur copie',''));
}

function togglePromptExpand(id){
  _expandedPrompts.has(id)?_expandedPrompts.delete(id):_expandedPrompts.add(id);
  renderPrompts();
}

function openPromptNew(){
  _editingPromptId=null;
  document.getElementById('mpe-title').textContent='Nouveau prompt';
  document.getElementById('mpe-name').value='';
  document.getElementById('mpe-content').value='';
  openModal('modal-prompt-edit');
}

function editPrompt(id){
  const p=prompts.find(x=>x.id===id);
  if(!p)return;
  _editingPromptId=id;
  document.getElementById('mpe-title').textContent='Modifier le prompt';
  document.getElementById('mpe-name').value=p.name;
  document.getElementById('mpe-content').value=p.content;
  openModal('modal-prompt-edit');
}

function savePromptEdit(){
  const name=document.getElementById('mpe-name').value.trim();
  const content=document.getElementById('mpe-content').value.trim();
  if(!name){showNotif('Donne un nom à ton prompt','');return;}
  if(!content){showNotif('Le contenu est vide','');return;}
  if(_editingPromptId){
    const p=prompts.find(x=>x.id===_editingPromptId);
    if(p){p.name=name;p.content=content;}
  } else {
    prompts.push({id:uid(),name,content,createdAt:new Date().toISOString()});
  }
  saveAll();
  closeModal('modal-prompt-edit');
  renderPrompts();
  showNotif(_editingPromptId?'Prompt modifié !':'Prompt ajouté !','ok');
}

function deletePrompt(id){
  showConfirm('Supprimer ce prompt ?','Cette action est irréversible.','Supprimer',()=>{
    prompts=prompts.filter(x=>x.id!==id);_expandedPrompts.delete(id);saveAll();renderPrompts();showNotif('Prompt supprimé','');
  });
}

function openImportFC(){
  document.getElementById('ifc-txt').value='';
  document.getElementById('ifc-prev').innerHTML='';
  document.getElementById('ifc-prompt-box').style.display='none';
  openModal('modal-import-fc');
}
function genFCImportPrompt(){
  const prompt=`Tu es un expert pédagogue en kinésithérapie et médecine.\nÀ partir du texte ci-dessous, génère des flashcards au format EXACT suivant :\n\nTERME: [terme court, 1-5 mots]\nDÉFINITION: [réponse courte, max 20 mots]\nMOTS_CLÉS: [4-6 concepts-clés séparés par des virgules]\n---\n\nRègles pour les MOTS_CLÉS :\n- Chaque mot-clé = un concept incontournable de la définition (pas des mots vides)\n- Si la définition dit "densité minérale osseuse", les mots-clés seront "densité minérale, osseuse"\n- L'étudiant valide sa réponse s'il cite ≥ 80 % des mots-clés\n- Un mot-clé peut être un groupe de mots (ex : "densité minérale", "non douloureux")\n\n[COLLEZ VOTRE TEXTE/PDF ICI]`;
  const box=document.getElementById('ifc-prompt-box');
  box.textContent=prompt;box.style.display='block';
  navigator.clipboard.writeText(prompt).then(()=>showNotif('Prompt copié !','ok')).catch(()=>{});
}
function impSwitchTab(tab){
  const tabs=['text','ia'];
  tabs.forEach(t=>{
    const btn=document.getElementById('imp-tab-'+t);
    const panel=document.getElementById('imp-panel-'+t);
    const active=t===tab;
    if(btn){btn.style.background=active?'var(--surface)':'none';btn.style.boxShadow=active?'0 1px 4px rgba(0,0,0,.12)':'none';btn.style.color=active?'var(--on-surface)':'var(--on-sv)';}
    if(panel)panel.style.display=active?'block':'none';
  });
}
function copyIAPrompt(){
  const txt=document.getElementById('imp-ia-prompt')?.textContent||'';
  const btn=document.querySelector('#imp-panel-ia .btn-g');
  navigator.clipboard.writeText(txt).then(()=>{if(btn){const orig=btn.innerHTML;btn.innerHTML='<span class="ms" style="font-size:13px">check</span> Copié !';setTimeout(()=>btn.innerHTML=orig,2000);}}).catch(()=>{});
}
function impFilePreview(input){
  const file=input.files[0];if(!file)return;
  const preview=document.getElementById('imp-file-preview');
  const img=document.getElementById('imp-file-img');
  if(file.type.startsWith('image/')){
    const r=new FileReader();r.onload=e=>{img.src=e.target.result;preview.style.display='block';};r.readAsDataURL(file);
  } else {
    preview.style.display='none';
    showNotif('PDF chargé — utilisez le prompt pour extraire le texte avec une IA.','ok');
  }
}
function genQCMImportPrompt(){
  const prompt=`Rôle : Tu es un expert en ingénierie pédagogique et un spécialiste du domaine abordé dans les documents joints. Ta mission est de concevoir un examen de type QCM de haute qualité, rigoureux et exhaustif, destiné à valider la compréhension profonde du cours.

Consignes de rédaction :

Volume : Génère un minimum de 25 questions. Si la densité du cours l'exige pour couvrir l'intégralité des concepts clés (ex: chaque structure en anatomie, chaque étape d'un processus), augmente ce nombre jusqu'à épuisement des points essentiels.

Pertinence : Focalise-toi uniquement sur les concepts fondamentaux, les mécanismes et les structures critiques. Ignore les données futiles, les statistiques secondaires ou les pourcentages anecdotiques, sauf s'ils sont le cœur du sujet.

Qualité des distracteurs (mauvaises réponses) :
   * Les distracteurs doivent être hautement plausibles.
   * Utilise des erreurs de logique classiques, des confusions de termes fréquents dans la discipline ou des inversions de mécanismes mentionnés dans le texte.
   * Interdiction stricte : N'utilise jamais d'options "Toutes les réponses ci-dessus", "Aucune des réponses" ou de réponses évidemment fausses/absurdes.

Équilibre visuel : Veille à ce que les 4 options de réponse (A, B, C, D) aient une longueur approximativement identique. La réponse correcte ne doit pas être identifiable parce qu'elle est plus détaillée ou plus longue que les autres.

Privilégie les formulations positives. Évite au maximum les questions du type 'Lequel de ces éléments n'est pas...' ou 'Toutes ces propositions sont vraies sauf une'.

Assure une homogénéité syntaxique : si la réponse A commence par un verbe à l'infinitif, les réponses B, C et D doivent aussi commencer par un verbe à l'infinitif. Si la réponse A est une phrase complète, les autres doivent l'être aussi.

Aléatrise la position de la réponse correcte pour qu'il n'y ait pas de schéma répétitif (ex: ne pas avoir 3 fois de suite la réponse B correcte).

Assure-toi que les options sont mutuellement exclusives. Il ne doit pas y avoir de chevauchement de sens ou de valeurs numériques entre les propositions.

Inclus 20% de questions basées sur des mini-scénarios ou cas pratiques pour tester l'application des connaissances.

Dans le Feedback, ajoute à la fin entre parenthèses la page d'ou tu as tiré la question (et la réponse du coup).

Contraintes de formatage (STRICT) :

Tu dois écrire les questions sous format texte brut, dans une boîte de code, en respectant exactement cette structure pour chaque question (pour permettre un copier-coller direct dans mon application) :

[N°]. [Texte de la question] ?

A. [Option A]

B. [Option B]

C. [Option C]

D. [Option D]

Réponse correcte : [Lettre]

Feedback : [Explication complète et percutante reliant la réponse à un concept clé du document].

[COLLEZ VOTRE TEXTE/PDF ICI]`;
  const box=document.getElementById('import-prompt-box');
  box.textContent=prompt;box.style.display='block';
  navigator.clipboard.writeText(prompt).then(()=>showNotif('Prompt copié !','ok')).catch(()=>{});
}
function previewFCImport(){
  const cards=parseFlashcards(document.getElementById('ifc-txt').value);
  const prev=document.getElementById('ifc-prev');
  if(!cards.length){prev.innerHTML='<div style="font-size:13px;color:var(--on-sv);padding:10px 0">Aucune flashcard détectée</div>';return;}
  prev.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--primary);margin:10px 0 6px">${cards.length} flashcard${cards.length>1?'s':''} détectée${cards.length>1?'s':''}</div>`+cards.map(c=>`<div style="background:var(--surf-low);border-radius:10px;padding:10px 12px;margin-bottom:6px;font-size:12px"><div style="font-weight:700;margin-bottom:2px">${c.term}</div><div style="color:var(--on-sv)">${c.definition}</div>${c.keywords.length?`<div style="margin-top:4px;color:var(--primary);font-size:11px"><span class="ms" style="font-size:11px;vertical-align:middle">key</span> ${c.keywords.join(', ')}</div>`:''}</div>`).join('');
}
function doImportFC(){
  const cards=parseFlashcards(document.getElementById('ifc-txt').value);
  if(!cards.length){showNotif('Aucune flashcard à importer','');return;}
  addFlashcards(curC,cards);
  closeModal('modal-import-fc');
  renderCourse();
  showNotif(`${cards.length} flashcard${cards.length>1?'s':''} importée${cards.length>1?'s':''}!`,'ok');
}

// ════════════════════════════════════════════
// FICHE DE RÉVISION
// ════════════════════════════════════════════
function showFiche(){showScreen('fiche');}

function renderFiche(){
  const c=courses.find(x=>x.id===curC);
  const f=c?folders.find(x=>x.id===c.folderId):null;
  if(!c)return;
  const sf=c.subFolderId?subFolders.find(x=>x.id===c.subFolderId):null;
  const breadcrumb=`${f?f.name:''}${sf?' › '+sf.name:''}`;
  document.getElementById('fiche-hdr').innerHTML=`
    <div style="font-size:11px;color:var(--on-sv);margin-bottom:3px;font-weight:600;letter-spacing:.5px;text-transform:uppercase">${breadcrumb}</div>
    <div class="hf" style="font-size:24px;font-weight:800;letter-spacing:-.5px">${c.name}</div>
    <div style="font-size:13px;color:var(--on-sv);margin-top:2px">Fiche de révision</div>`;
  const fiche=getFiche(curC);
  const view=document.getElementById('fiche-view');
  const editor=document.getElementById('fiche-editor');
  const editBtn=document.getElementById('fiche-edit-btn');
  const saveBtn=document.getElementById('fiche-save-btn');
  const delBtn=document.getElementById('fiche-delete-btn');
  const emptyEl=document.getElementById('fiche-empty');
  if(fiche&&fiche.content){
    view.innerHTML=_renderMarkdown(fiche.content);
    view.style.display='block';
    editor.style.display='none';
    editor.value=fiche.content;
    editBtn.style.display='inline-flex';
    saveBtn.style.display='none';
    delBtn.style.display='inline-flex';
    emptyEl.style.display='none';
  } else {
    view.style.display='none';
    editor.style.display='none';
    editBtn.style.display='none';
    saveBtn.style.display='none';
    delBtn.style.display='none';
    emptyEl.style.display='block';
  }
}

function startFicheEdit(){
  const emptyEl=document.getElementById('fiche-empty');
  const editor=document.getElementById('fiche-editor');
  const saveBtn=document.getElementById('fiche-save-btn');
  emptyEl.style.display='none';
  editor.value='';
  editor.style.display='block';
  saveBtn.style.display='inline-flex';
  editor.focus();
}

function toggleFicheEdit(){
  const view=document.getElementById('fiche-view');
  const editor=document.getElementById('fiche-editor');
  const editBtn=document.getElementById('fiche-edit-btn');
  const saveBtn=document.getElementById('fiche-save-btn');
  if(editor.style.display==='none'||!editor.style.display){
    const fiche=getFiche(curC);
    editor.value=fiche?fiche.content:'';
    view.style.display='none';
    editor.style.display='block';
    editBtn.style.display='none';
    saveBtn.style.display='inline-flex';
    editor.focus();
  } else {
    view.innerHTML=_renderMarkdown(editor.value);
    view.style.display='block';
    editor.style.display='none';
    editBtn.style.display='inline-flex';
    saveBtn.style.display='none';
  }
}

function saveFicheContent(){
  const editor=document.getElementById('fiche-editor');
  saveFiche(curC,editor.value);
  renderFiche();
  showNotif('Fiche sauvegardée !','ok');
}

function confirmDeleteFiche(){
  showConfirm('Supprimer la fiche ?','Cette action est irréversible.','Supprimer',()=>{
    deleteFiche(curC);renderFiche();showNotif('Fiche supprimée.','');
  });
}

// Table de correspondance LaTeX → Unicode
const _LATEX_MAP = {
  circ:'°',
  alpha:'α',beta:'β',gamma:'γ',Gamma:'Γ',
  delta:'δ',Delta:'Δ',epsilon:'ε',varepsilon:'ε',
  zeta:'ζ',eta:'η',theta:'θ',Theta:'Θ',
  iota:'ι',kappa:'κ',lambda:'λ',Lambda:'Λ',
  mu:'μ',nu:'ν',xi:'ξ',Xi:'Ξ',
  pi:'π',Pi:'Π',rho:'ρ',
  sigma:'σ',Sigma:'Σ',tau:'τ',upsilon:'υ',
  phi:'φ',Phi:'Φ',chi:'χ',psi:'ψ',Psi:'Ψ',
  omega:'ω',Omega:'Ω',
  times:'×',div:'÷',cdot:'·',
  approx:'≈',neq:'≠',equiv:'≡',sim:'∼',
  pm:'±',mp:'∓',
  leq:'≤',geq:'≥',le:'≤',ge:'≥',ll:'≪',gg:'≫',
  rightarrow:'→',leftarrow:'←',leftrightarrow:'↔',
  Rightarrow:'⇒',Leftarrow:'⇐',Leftrightarrow:'⇔',
  to:'→',mapsto:'↦',uparrow:'↑',downarrow:'↓',
  infty:'∞',ldots:'…',cdots:'⋯',vdots:'⋮',
  sum:'∑',prod:'∏',int:'∫',
  partial:'∂',nabla:'∇',
  forall:'∀',exists:'∃',
  in:'∈',notin:'∉',subset:'⊂',supset:'⊃',
  cup:'∪',cap:'∩',
  perp:'⊥',parallel:'∥',
  degree:'°',
};
function _cleanFiche(text){
  if(!text)return'';
  return text
    // Citations Claude
    .replace(/\[cite_start\]/g,'').replace(/\s*\[cite:\s*[\d,\s]+\]/g,'')
    // ^{\circ} → ° (ex: 20^{\circ}) — [\\] = backslash littéral
    .replace(/([0-9A-Za-z]*)\^\{[\\]circ\}/g,'$1°')
    // \sqrt{x} → √x, \frac{a}{b} → a/b
    .replace(/[\\]sqrt\{([^}]+)\}/g,'√$1')
    .replace(/[\\]frac\{([^}]+)\}\{([^}]+)\}/g,'$1/$2')
    // \text{...}, \mathrm{...} → contenu brut
    .replace(/[\\](?:text|mathrm|mathbf|mathit|textbf|textit|mbox)\{([^}]+)\}/g,'$1')
    // Exposants courants : ^{2} → ², etc.
    .replace(/\^\{2\}/g,'²').replace(/\^\{3\}/g,'³').replace(/\^\{-1\}/g,'⁻¹').replace(/\^\{n\}/g,'ⁿ')
    // Indices courants : _{1} → ₁, etc.
    .replace(/[_]\{1\}/g,'₁').replace(/[_]\{2\}/g,'₂').replace(/[_]\{3\}/g,'₃')
    // \command{...} → contenu brut (catch-all)
    .replace(/[\\][a-zA-Z]+\{([^}]+)\}/g,'$1')
    // \command → lookup Unicode, [\\] = backslash littéral (évite \c = Ctrl+C etc.)
    .replace(/[\\]([a-zA-Z]+)/g,(m,cmd)=>_LATEX_MAP[cmd]!==undefined?_LATEX_MAP[cmd]:cmd)
    // $$ ... $$  et  $ ... $
    .replace(/\$\$([^$\n]{1,120})\$\$/g,'$1')
    .replace(/\$([^$\n]{1,80})\$/g,'$1')
    .replace(/\$/g,'')
    // Accolades résiduelles
    .replace(/\{([^}]*)\}/g,'$1')
    .trim();
}


function _inlineMarkdown(t){
  return t
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code class="fiche-code">$1</code>');
}

function _renderTable(lines){
  const isSep=l=>/^\|[\s|:\-]+\|$/.test(l.trim());
  const rows=lines.filter(l=>!isSep(l));
  if(!rows.length)return'';
  let html='<div class="fiche-table-wrap"><table class="fiche-table">';
  rows.forEach((row,idx)=>{
    const cells=row.split('|').slice(1,-1);
    const tag=idx===0?'th':'td';
    html+='<tr>'+cells.map(c=>`<${tag}>${_inlineMarkdown(c.trim())}</${tag}>`).join('')+'</tr>';
  });
  return html+'</table></div>';
}

function _renderMarkdown(text){
  if(!text)return'';
  text=_cleanFiche(text);
  const lines=text.split('\n');
  let html='',inUl=false,inOl=false,inUl2=false;
  let i=0;
  const closeLists=()=>{
    if(inUl2){html+='</ul>';inUl2=false;}
    if(inUl){html+='</ul>';inUl=false;}
    if(inOl){html+='</ol>';inOl=false;}
  };
  while(i<lines.length){
    const l=lines[i];

    // ── Blocs fencés ```lang ... ``` ──
    if(l.startsWith('```')){
      closeLists();
      const lang=l.slice(3).trim().toLowerCase();
      i++;
      let code='';
      while(i<lines.length&&lines[i]!='```'){code+=lines[i]+'\n';i++;}
      if(lines[i]==='```')i++;
      html+=`<pre class="fiche-pre"><code>${code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`;
      continue;
    }

    // ── Tables ──
    if(l.trim().startsWith('|')){
      closeLists();
      const tbl=[];
      while(i<lines.length&&lines[i].trim().startsWith('|')){tbl.push(lines[i]);i++;}
      html+=_renderTable(tbl);
      continue;
    }

    // ── Titres ──
    if(l.match(/^####\s/)){closeLists();html+=`<h4 class="fiche-h4">${_inlineMarkdown(l.slice(5))}</h4>`;i++;continue;}
    if(l.match(/^###\s/)){closeLists();html+=`<h3 class="fiche-h3">${_inlineMarkdown(l.slice(4))}</h3>`;i++;continue;}
    if(l.match(/^##\s/)){closeLists();html+=`<h2 class="fiche-h2">${_inlineMarkdown(l.slice(3))}</h2>`;i++;continue;}
    if(l.match(/^#\s/)){closeLists();html+=`<h1 class="fiche-h1">${_inlineMarkdown(l.slice(2))}</h1>`;i++;continue;}
    if(l.match(/^---+$/)){closeLists();html+='<hr class="fiche-hr">';i++;continue;}
    if(l.match(/^>\s/)){closeLists();html+=`<blockquote class="fiche-bq">${_inlineMarkdown(l.slice(2))}</blockquote>`;i++;continue;}

    // ── Listes imbriquées (2 espaces ou tabulation) ──
    const isNested=l.match(/^(?:  |\t)[-*+]\s+([\s\S]+)/);
    const isUli=l.match(/^[-*+]\s+([\s\S]+)/);
    const isOli=l.match(/^\d+[.)]\s+([\s\S]+)/);

    if(isNested){
      if(!inUl){html+='<ul class="fiche-ul">';inUl=true;}
      if(!inUl2){html+='<ul class="fiche-ul fiche-ul-nested">';inUl2=true;}
      html+=`<li>${_inlineMarkdown(isNested[1])}</li>`;
      i++;continue;
    }
    if(inUl2&&!isNested){html+='</ul>';inUl2=false;}
    if(!isUli&&inUl){html+='</ul>';inUl=false;}
    if(!isOli&&inOl){html+='</ol>';inOl=false;}

    if(isUli){if(!inUl){html+='<ul class="fiche-ul">';inUl=true;}html+=`<li>${_inlineMarkdown(isUli[1])}</li>`;i++;continue;}
    if(isOli){if(!inOl){html+='<ol class="fiche-ol">';inOl=true;}html+=`<li>${_inlineMarkdown(isOli[1])}</li>`;i++;continue;}
    if(!l.trim()){html+='<div class="fiche-br"></div>';i++;continue;}
    html+=`<p class="fiche-p">${_inlineMarkdown(l)}</p>`;
    i++;
  }
  closeLists();
  return html;
}

// ── Render course flashcards section ──
function renderCourseFlashcards(){
  const fcs=getFlashcardsForCourse(curC);
  const sec=document.getElementById('course-fcs');if(!sec)return;
  const matchBtn=document.getElementById('course-match-btn');
  if(matchBtn)matchBtn.style.display=fcs.length>=2?'inline-flex':'none';
  if(!fcs.length){sec.innerHTML='';return;}
  sec.innerHTML=`<span class="sl" style="margin-top:24px">${fcs.length} flashcard${fcs.length>1?'s':''}</span>`
    +fcs.map(fc=>`<div class="fc-card-item">
      ${fc.image?`<img class="fc-card-img" src="${fc.image}" alt="">`:''}
      <div class="fc-card-term">${fc.term}</div>
      <div class="fc-card-def">${fc.definition}</div>
      ${fc.keywords.length?`<div class="fc-card-kw"><span class="ms" style="font-size:12px;vertical-align:middle">key</span> ${fc.keywords.join(', ')}</div>`:''}
      <div style="position:absolute;top:10px;right:10px;display:flex;gap:6px">
        <button class="bico" onclick="openEditFC('${fc.id}')"><span class="ms" style="font-size:15px">edit</span></button>
        <button class="bico del" onclick="deleteFlashcard('${fc.id}');renderCourse()"><span class="ms" style="font-size:15px">delete</span></button>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════
// EDIT FLASHCARD
// ════════════════════════════════════════════
let _editFCId=null,_efcActiveSlot='Q';
// Paste image into active FC image zone
document.addEventListener('paste',e=>{
  const modal=document.getElementById('modal-edit-fc');
  if(!modal||!modal.classList.contains('open'))return;
  const tag=document.activeElement&&document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  const items=e.clipboardData&&e.clipboardData.items;
  if(!items)return;
  for(const it of items){if(it.type.startsWith('image/')){e.preventDefault();_loadFCImageFromFile(it.getAsFile(),_efcActiveSlot);return;}}
});
function _loadFCImageFromFile(file,slot){
  if(!file||!file.type.startsWith('image/'))return;
  const s=slot||'Q';
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=520;let w=img.width,h=img.height;
      if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      const b64=cv.toDataURL('image/jpeg',.8);
      const fc=flashcards.find(x=>x.id===_editFCId);
      if(fc){if(s==='A')fc.imageA=b64;else fc.imageQ=b64;saveAll();}
      _setEFCImageZone(s,b64);
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
function switchEFCTab(tab){
  const isIA=tab==='ia';
  document.getElementById('efc-panel-manuel').style.display=isIA?'none':'block';
  document.getElementById('efc-panel-ia').style.display=isIA?'block':'none';
  const tm=document.getElementById('efc-tab-manuel'),ti=document.getElementById('efc-tab-ia');
  tm.style.background=isIA?'none':'var(--surface)';tm.style.boxShadow=isIA?'none':'0 1px 4px rgba(0,0,0,.12)';tm.style.color=isIA?'var(--on-sv)':'var(--on-surface)';
  ti.style.background=isIA?'var(--surface)':'none';ti.style.boxShadow=isIA?'0 1px 4px rgba(0,0,0,.12)':'none';ti.style.color=isIA?'var(--on-surface)':'var(--on-sv)';
}
function _setEFCImageZone(slot,src){
  const s=slot.toLowerCase();
  const el=document.getElementById(`efc-img${s}-el`);
  const ph=document.getElementById(`efc-img${s}-placeholder`);
  const rm=document.getElementById(`efc-img${s}-remove`);
  if(src){el.src=src;el.style.display='block';if(ph)ph.style.display='none';if(rm){rm.style.display='flex';}}
  else{el.src='';el.style.display='none';if(ph)ph.style.display='flex';if(rm)rm.style.display='none';}
}
function openEditFC(id){
  _editFCId=id;
  const fc=flashcards.find(x=>x.id===id);if(!fc)return;
  document.getElementById('efc-term').value=fc.term||'';
  document.getElementById('efc-def').value=fc.definition||'';
  document.getElementById('efc-kw').value=(fc.keywords||[]).join(', ');
  _setEFCImageZone('Q',fc.imageQ||fc.image||null);
  _setEFCImageZone('A',fc.imageA||null);
  const raw=document.getElementById('efc-ai-raw');if(raw)raw.value='';
  const st=document.getElementById('efc-ai-status');if(st)st.style.display='none';
  switchEFCTab('manuel');
  openModal('modal-edit-fc');
}
function saveEditFC(){
  const fc=flashcards.find(x=>x.id===_editFCId);if(!fc)return;
  const term=document.getElementById('efc-term').value.trim();
  const def=document.getElementById('efc-def').value.trim();
  if(!term||!def){showNotif('Terme et définition requis.','err');return;}
  fc.term=term;fc.definition=def;
  fc.keywords=document.getElementById('efc-kw').value.split(',').map(k=>k.trim()).filter(Boolean);
  fc.image=null;
  saveAll();closeModal('modal-edit-fc');renderCourse();
  showNotif('Flashcard mise à jour !','ok');
}
function loadFCImage(input,slot){_loadFCImageFromFile(input.files[0],slot);}
function removeFCImage(slot){
  const s=slot||'Q';
  const fc=flashcards.find(x=>x.id===_editFCId);
  if(fc){if(s==='A')fc.imageA=null;else fc.imageQ=null;}
  _setEFCImageZone(s,null);
  const inp=document.getElementById(`efc-img${s.toLowerCase()}-input`);if(inp)inp.value='';
}
function copyEFCPrompt(){
  const term=document.getElementById('efc-term').value.trim();
  const prompt=`Génère une flashcard médicale pour la kinésithérapie${term?' sur le sujet : "'+term+'"':''} en respectant ce format strict :\n\nTERME: [terme court 1-5 mots]\nDÉFINITION: [définition claire et mémorisable, maximum 20 mots]\nMOTS_CLÉS: [3 à 6 mots-clés séparés par des virgules]`;
  navigator.clipboard.writeText(prompt).then(()=>showNotif('Prompt copié !','ok')).catch(()=>showNotif('Copie échouée','err'));
}
function parseEFCAI(raw){
  if(!raw)return;
  const get=(keys,text)=>{for(const k of keys){const m=text.match(new RegExp(k+'\\s*[:\\-]\\s*(.+)','im'));if(m&&m[1].trim())return m[1].trim();}return'';};
  const terme=get(['TERME','TERM','MOT','QUESTION'],raw);
  const def=get(['DÉFINITION','DEFINITION','RÉPONSE','REPONSE','DEF'],raw);
  const kw=get(['MOTS.CLÉS','MOTS_CLÉS','MOTS-CLÉS','KEYWORDS','MOTS CLÉS','MOTS_CLES'],raw);
  if(terme)document.getElementById('efc-term').value=terme;
  if(def)document.getElementById('efc-def').value=def;
  if(kw)document.getElementById('efc-kw').value=kw;
  const st=document.getElementById('efc-ai-status');
  if(st)st.style.display=(terme||def)?'block':'none';
}

// ════════════════════════════════════════════
// MATCH MODE
// ════════════════════════════════════════════
let _match={cards:[],sel:null,matched:0,total:0,timer:null,secs:0,returnTo:'course'};

function startMatchMode(){
  const pool=getFlashcardsForCourse(curC);
  if(pool.length<2){showNotif('Minimum 2 flashcards pour jouer.','err');return;}
  const subset=shuffle([...pool]).slice(0,Math.min(pool.length,9));
  // Build card list: term cards + definition cards, shuffled together
  const cards=shuffle([
    ...subset.map((fc,i)=>({uid:uid(),fcId:fc.id,text:fc.term,image:fc.image||null,type:'term',pair:i,matched:false})),
    ...subset.map((fc,i)=>({uid:uid(),fcId:fc.id,text:fc.definition,image:null,type:'def',pair:i,matched:false}))
  ]);
  _match={cards,sel:null,matched:0,total:subset.length,timer:null,secs:0,returnTo:'course'};
  clearInterval(_match.timer);
  _match.timer=setInterval(()=>{_match.secs++;_tickMatchTimer();},1000);
  showScreen('match');
  document.getElementById('match-done').style.display='none';
  document.getElementById('match-grid').style.display='';
  renderMatchGrid();
}

function _tickMatchTimer(){
  const m=Math.floor(_match.secs/60),s=_match.secs%60;
  const el=document.getElementById('match-timer');
  if(el)el.textContent=`${m}:${s<10?'0':''}${s}`;
}

function renderMatchGrid(){
  const grid=document.getElementById('match-grid');if(!grid)return;
  document.getElementById('match-status').textContent=`${_match.matched}/${_match.total} paires trouvées`;
  grid.innerHTML=_match.cards.map((c,i)=>`
    <div class="match-card${c.matched?' mc-ok':''}" id="mc-${c.uid}" onclick="selectMatchCard(${i})">
      ${c.image?`<div><img class="match-img" src="${c.image}"><div style="font-size:12px;margin-top:4px">${c.text}</div></div>`:c.text}
    </div>`).join('');
}

function selectMatchCard(i){
  const c=_match.cards[i];if(!c||c.matched)return;
  const el=document.getElementById(`mc-${c.uid}`);
  if(_match.sel===null){
    // First selection
    _match.sel=i;
    el.classList.add('mc-sel');
    return;
  }
  if(_match.sel===i){
    // Deselect same
    el.classList.remove('mc-sel');
    _match.sel=null;
    return;
  }
  const prev=_match.cards[_match.sel];
  const prevEl=document.getElementById(`mc-${prev.uid}`);
  prevEl.classList.remove('mc-sel');

  if(prev.pair===c.pair&&prev.type!==c.type){
    // Correct match
    prev.matched=true;c.matched=true;
    prevEl.classList.add('mc-ok');el.classList.add('mc-ok');
    _match.matched++;
    _match.sel=null;
    document.getElementById('match-status').textContent=`${_match.matched}/${_match.total} paires trouvées`;
    if(_match.matched>=_match.total){
      clearInterval(_match.timer);
      setTimeout(()=>{
        document.getElementById('match-grid').style.display='none';
        const done=document.getElementById('match-done');
        done.style.display='block';
        const m=Math.floor(_match.secs/60),s=_match.secs%60;
        document.getElementById('match-done-time').textContent=`Temps : ${m}:${s<10?'0':''}${s}`;
      },400);
    }
  } else {
    // Wrong match — flash red then reset
    el.classList.add('mc-err');prevEl.classList.add('mc-err');
    _match.sel=null;
    setTimeout(()=>{el.classList.remove('mc-err');prevEl.classList.remove('mc-err');},500);
  }
}

function endMatchMode(){
  clearInterval(_match.timer);
  showScreen('course');
}

// ══════════════════════════════════════════════
// ALL FLASHCARDS HUB
// ══════════════════════════════════════════════
let _afcSearchOpen = false;
let _afcView   = 'hub';      // 'hub' | folderId | '__none__' | '__courses__'
let _afcSort   = 'new';      // 'az'|'za'|'new'|'old'|'mastery'
let _afcSelectMode = false;
let _afcSelected   = new Set();

function openAllFlashcards(){
  document.querySelectorAll('.dl-sidebar nav a').forEach(a=>a.classList.remove('dl-active'));
  const navEl=document.querySelector('[data-nav="all-flashcards"]');
  if(navEl) navEl.classList.add('dl-active');
  _afcView='hub'; _afcSelectMode=false; _afcSelected.clear();
  showScreen('all-flashcards');
}

function afcGoBack(){
  if(_afcView!=='hub'){ _afcView='hub'; _afcSelectMode=false; _afcSelected.clear(); _updateAFCSelBar(); renderAFCList(); }
  else switchTab('home');
}

function afcOpenSort(){ openModal('modal-afc-sort'); }
function setAFCSort(s){ _afcSort=s; closeModal('modal-afc-sort'); renderAFCList(); }

// ── Search ────────────────────────────────────
function toggleAFCSearch(){
  _afcSearchOpen=!_afcSearchOpen;
  const bar=document.getElementById('afc-search-bar');
  const wrap=document.getElementById('afc-wrap');
  if(!bar) return;
  if(_afcSearchOpen){
    bar.style.display='block';
    document.getElementById('afc-search-input').value='';
    document.getElementById('afc-search-input').focus();
    if(wrap) wrap.style.paddingTop='122px';
  } else {
    bar.style.display='none';
    if(wrap) wrap.style.paddingTop='72px';
    renderAFCList();
  }
}

function renderAFCSearch(){
  const q=(document.getElementById('afc-search-input').value||'').toLowerCase().trim();
  const list=document.getElementById('afc-list');
  if(!list) return;
  if(!q){ renderAFCList(); return; }
  const allC=(typeof concepts!=='undefined'?concepts:[]).filter(c=>c.definition&&c.definition.trim()).map(c=>({...c,type:'concept'}));
  const allFC=flashcards.map(fc=>({...fc,type:'flashcard',masteryLevel:0}));
  const pool=[...allC,...allFC];
  const matches=pool.filter(x=>(x.term||'').toLowerCase().includes(q)||(x.definition||'').toLowerCase().includes(q));
  // hide hub header & action row during search
  const hdr=document.getElementById('afc-hub-header');const ar=document.getElementById('afc-action-row');
  if(hdr) hdr.style.display='none'; if(ar) ar.style.display='none';
  if(!matches.length){ list.innerHTML='<div class="empty-state" style="margin-top:32px"><span class="ms" style="font-size:40px;color:var(--on-sv)">search_off</span><p style="color:var(--on-sv);margin-top:8px;font-weight:700">Aucun résultat</p></div>'; return; }
  list.innerHTML=`<span class="sl">${matches.length} résultat${matches.length>1?'s':''}</span>`+matches.map(x=>_renderAFCCard(x)).join('');
}

// ── Data helpers ──────────────────────────────
function _afcPoolForView(view){
  const allC=(typeof concepts!=='undefined'?concepts:[]).filter(c=>c.definition&&c.definition.trim());
  let pool=[];
  if(view==='hub'||view==='__courses__'){
    pool=flashcards.map(fc=>({...fc,type:'flashcard',masteryLevel:0}));
  }
  if(view==='hub'){
    pool=[...allC.map(c=>({...c,type:'concept'})),...pool];
  } else if(view==='__none__'){
    pool=allC.filter(c=>!c.folderId).map(c=>({...c,type:'concept'}));
  } else if(view!=='__courses__'){
    pool=allC.filter(c=>c.folderId===view).map(c=>({...c,type:'concept'}));
  }
  const sortFn=(a,b)=>{
    if(_afcSort==='az') return (a.term||'').localeCompare(b.term||'');
    if(_afcSort==='za') return (b.term||'').localeCompare(a.term||'');
    if(_afcSort==='old') return new Date(a.createdAt||0)-new Date(b.createdAt||0);
    if(_afcSort==='mastery') return (b.masteryLevel||0)-(a.masteryLevel||0);
    return new Date(b.createdAt||0)-new Date(a.createdAt||0);
  };
  return pool.sort(sortFn);
}

// ── Select mode ───────────────────────────────
function toggleAFCSelectMode(){
  _afcSelectMode=!_afcSelectMode;
  _afcSelected.clear();
  _updateAFCSelBar();
  renderAFCList();
}

function toggleAFCItem(id){
  if(_afcSelected.has(id)) _afcSelected.delete(id);
  else _afcSelected.add(id);
  _updateAFCSelBar();
  const el=document.getElementById('afc-item-'+id);
  const chk=document.getElementById('afc-chk-'+id);
  if(el) el.classList.toggle('afc-item-sel',_afcSelected.has(id));
  if(chk) chk.innerHTML=_afcSelected.has(id)?'check_circle':'radio_button_unchecked';
  if(chk) chk.className='ms afc-check-icon'+(_afcSelected.has(id)?' afc-check-on':'');
}

function _updateAFCSelBar(){
  const bar=document.getElementById('afc-sel-bar');
  if(!bar) return;
  const n=_afcSelected.size;
  if(_afcSelectMode){
    bar.style.display='flex';
    const cnt=document.getElementById('afc-sel-count');
    if(cnt) cnt.textContent=n===0?'Aucun sélectionné':`${n} sélectionné${n>1?'s':''}`;
  } else { bar.style.display='none'; }
}

function afcSelectAll(){
  const list=document.getElementById('afc-list');
  if(!list) return;
  list.querySelectorAll('[id^="afc-item-"]').forEach(el=>{
    const id=el.id.replace('afc-item-','');
    _afcSelected.add(id);
    el.classList.add('afc-item-sel');
    const chk=document.getElementById('afc-chk-'+id);
    if(chk){chk.innerHTML='check_circle';chk.className='ms afc-check-icon afc-check-on';}
  });
  _updateAFCSelBar();
}

function afcDeleteSelected(){
  if(!_afcSelected.size){showNotif('Rien de sélectionné','');return;}
  if(!confirm(`Supprimer ${_afcSelected.size} carte${_afcSelected.size>1?'s':''}?`)) return;
  _afcSelected.forEach(id=>{
    const ci=concepts.findIndex(c=>c.id===id);
    if(ci>-1) concepts.splice(ci,1);
    else { const fi=flashcards.findIndex(f=>f.id===id); if(fi>-1) flashcards.splice(fi,1); }
  });
  saveAll(); _afcSelected.clear(); _updateAFCSelBar(); renderAFCList();
  showNotif('Supprimé !','ok');
}

function afcMoveSelected(){
  if(!_afcSelected.size){showNotif('Rien de sélectionné','');return;}
  const cFolders=typeof conceptFolders!=='undefined'?conceptFolders:[];
  const list=document.getElementById('afc-move-folder-list');
  if(!list) return;
  list.innerHTML=`<button class="afc-move-opt" onclick="applyAFCMove(null)"><span class="ms" style="font-size:16px">psychology</span> Sans dossier</button>`
    +cFolders.map(f=>`<button class="afc-move-opt" onclick="applyAFCMove('${f.id}')"><span class="ms" style="font-size:16px">folder</span> ${_esc(f.name)}</button>`).join('');
  openModal('modal-afc-move');
}

function applyAFCMove(folderId){
  _afcSelected.forEach(id=>{ const c=concepts.find(x=>x.id===id); if(c) c.folderId=folderId||null; });
  saveAll(); closeModal('modal-afc-move'); _afcSelected.clear(); _updateAFCSelBar(); renderAFCList();
  showNotif('Déplacé !','ok');
}

function afcQuickAdd(){
  if(typeof openConceptDef==='function'){
    const id=uid();
    const folderForNew=(_afcView!=='hub'&&_afcView!=='__courses__')?(_afcView==='__none__'?null:_afcView):null;
    concepts.push({id,term:'',questionId:null,state:'toExplain',definition:'',keywords:[],masteryLevel:0,nextReview:null,lastReview:null,createdAt:new Date().toISOString(),folderId:folderForNew});
    saveAll(); openConceptDef(id);
  }
}

// ── Main render ───────────────────────────────
function renderAFCList(){
  const hdr=document.getElementById('afc-hub-header');
  const ar=document.getElementById('afc-action-row');
  const list=document.getElementById('afc-list');
  const title=document.getElementById('afc-topbar-title');
  const wrap=document.getElementById('afc-wrap');
  if(!list) return;
  if(_afcSearchOpen){ return; } // search handles its own render

  const allC=(typeof concepts!=='undefined'?concepts:[]).filter(c=>c.definition&&c.definition.trim());
  const cFolders=typeof conceptFolders!=='undefined'?conceptFolders:[];

  // ── HUB VIEW ─────────────────────────────────
  if(_afcView==='hub'){
    if(title) title.textContent='Flashcards';
    if(wrap) wrap.style.paddingTop='72px';

    // Hub header: stats + action buttons
    const totalCards=allC.length+flashcards.length;
    const folderCount=cFolders.length;
    const dueCount=typeof getDueCount==='function'?getDueCount():0;
    if(hdr) hdr.innerHTML=`
      <div style="margin-bottom:6px">
        <div class="hf" style="font-size:26px;font-weight:800;letter-spacing:-.5px">Mes Flashcards</div>
        <div style="font-size:13px;color:var(--on-sv);margin-top:2px">${folderCount} dossier${folderCount!==1?'s':''} · ${totalCards} carte${totalCards!==1?'s':''}</div>
      </div>
      ${dueCount>0?`<button class="btn btn-due" onclick="startDueFlashcards()" style="margin-bottom:4px"><span class="ms" style="font-size:15px;vertical-align:middle">alarm</span> ${dueCount} carte${dueCount>1?'s':''} à revoir aujourd'hui</button>`:''}
    `;

    // Action row
    if(ar){
      ar.style.display='flex';
      ar.innerHTML=`
        <button class="btn btn-g" onclick="openModal('modal-concept-folder');document.getElementById('cfol-name').value='';document.getElementById('cfol-delete-btn').style.display='none';document.getElementById('cfol-modal-title').textContent='Nouveau dossier';window._editConceptFolderId=null" style="font-size:13px">
          <span class="ms" style="font-size:14px;vertical-align:middle">create_new_folder</span> Dossier
        </button>
        <button class="btn btn-g" onclick="afcQuickAdd()" style="font-size:13px">
          <span class="ms" style="font-size:14px;vertical-align:middle">edit_note</span> Manuel + photo
        </button>
        <button class="btn btn-g" onclick="bciSwitchTab('ia');openModal('modal-bulk-concepts')" style="font-size:13px">
          <span class="ms" style="font-size:14px;vertical-align:middle">auto_awesome</span> Import IA
        </button>
        <div style="flex:1"></div>
        ${totalCards>=2?`<button class="btn btn-p" onclick="startAllFlashcardsHub()" style="font-size:13px">
          <span class="ms" style="font-size:15px;vertical-align:middle">play_arrow</span> Réviser tout
        </button>`:''}
      `;
    }

    let html='';

    // ── Concept folders (toujours affichés même si vides) ──
    {
      const cGrouped={};
      allC.forEach(c=>{ const k=c.folderId||'__none__'; if(!cGrouped[k]) cGrouped[k]=[]; cGrouped[k].push(c); });
      // Show all folders, even empty ones
      const folderKeys=cFolders.map(f=>f.id);
      if(cGrouped['__none__']) folderKeys.push('__none__');
      else if(allC.some(c=>!c.folderId)) folderKeys.push('__none__');

      if(folderKeys.length){
        html+=`<span class="sl">Dossiers</span>`;
        html+=folderKeys.map(key=>{
          const fcs=cGrouped[key]||[];
          const folderName=key==='__none__'?'Sans dossier':(cFolders.find(f=>f.id===key)||{}).name||'Dossier';
          const isNone=key==='__none__';
          const editAct=!isNone?`event.stopPropagation();openModal('modal-concept-folder');document.getElementById('cfol-name').value='${_esc((cFolders.find(f=>f.id===key)||{}).name||'')}';document.getElementById('cfol-delete-btn').style.display='inline-flex';document.getElementById('cfol-modal-title').textContent='Modifier';window._editConceptFolderId='${key}'`:'';
          return `<div class="ci" onclick="afcOpenView('${key}')" style="cursor:pointer">
            <div style="display:flex;align-items:center;gap:10px;flex:1">
              <span class="ms" style="font-size:20px;color:var(--primary)">${isNone?'psychology':'folder'}</span>
              <div><div class="cname">${_esc(folderName)}</div><div class="cmeta">${fcs.length} carte${fcs.length!==1?'s':''}</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              ${!isNone?`<div class="cacts"><button class="bico" onclick="${editAct}" title="Modifier"><span class="ms" style="font-size:16px">edit</span></button></div>`:''}
              <div class="cbadge">${fcs.length}</div>
              <span class="ms" style="color:var(--on-sv);font-size:20px">chevron_right</span>
            </div>
          </div>`;
        }).join('');
      }
    }

    if(totalCards===0&&!cFolders.length){
      list.innerHTML=`<div class="empty-state" style="margin-top:32px"><span class="ms" style="font-size:44px;color:var(--on-sv)">style</span><p style="font-weight:700;margin-top:12px">Aucune carte</p><p style="color:var(--on-sv);font-size:13px;margin-top:4px">Ajoute un concept ou importe des flashcards depuis un cours.</p></div>`;
      return;
    }

    // ── Course flashcard groups ──
    if(flashcards.length){
      const allCourses=typeof courses!=='undefined'?courses:[];
      const fcGrouped={};
      flashcards.forEach(fc=>{ if(!fcGrouped[fc.courseId]) fcGrouped[fc.courseId]=[]; fcGrouped[fc.courseId].push(fc); });
      html+=`<span class="sl" style="margin-top:16px">Flashcards de cours</span>`;
      Object.entries(fcGrouped).forEach(([courseId,fcs])=>{
        const course=allCourses.find(c=>c.id===courseId);
        const courseName=course?course.name:'Cours supprimé';
        html+=`<div class="ci" onclick="afcOpenView('__course_${courseId}')" style="cursor:pointer">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span class="ms" style="font-size:20px">menu_book</span>
            <div><div class="cname">${_esc(courseName)}</div><div class="cmeta">${fcs.length} flashcard${fcs.length>1?'s':''}</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="cbadge">${fcs.length}</div>
            <span class="ms" style="color:var(--on-sv);font-size:20px">chevron_right</span>
          </div>
        </div>`;
      });
    }

    list.innerHTML=html;
    return;
  }

  // ── FOLDER / COURSE DETAIL VIEW ───────────────
  const isCourseView=_afcView.startsWith('__course_');
  const courseId=isCourseView?_afcView.replace('__course_',''):null;
  let viewPool=[];
  let viewName='';

  if(isCourseView){
    viewPool=flashcards.filter(fc=>fc.courseId===courseId).map(fc=>({...fc,type:'flashcard',masteryLevel:0}));
    const course=(typeof courses!=='undefined'?courses:[]).find(c=>c.id===courseId);
    viewName=course?course.name:'Cours supprimé';
  } else {
    viewPool=allC.filter(c=>_afcView==='__none__'?!c.folderId:c.folderId===_afcView).map(c=>({...c,type:'concept'}));
    viewName=_afcView==='__none__'?'Sans dossier':(cFolders.find(f=>f.id===_afcView)||{}).name||'Dossier';
  }

  const sortFn=(a,b)=>{
    if(_afcSort==='az') return (a.term||'').localeCompare(b.term||'');
    if(_afcSort==='za') return (b.term||'').localeCompare(a.term||'');
    if(_afcSort==='old') return new Date(a.createdAt||0)-new Date(b.createdAt||0);
    if(_afcSort==='mastery') return (b.masteryLevel||0)-(a.masteryLevel||0);
    return new Date(b.createdAt||0)-new Date(a.createdAt||0);
  };
  viewPool.sort(sortFn);

  if(title) title.textContent=viewName;
  if(wrap) wrap.style.paddingTop='72px';

  // folder detail header
  if(hdr) hdr.innerHTML=`
    <button class="btn btn-sm btn-g" onclick="afcGoBack()" style="margin-bottom:14px">← Retour</button>
    <div style="margin-bottom:6px">
      <div class="hf" style="font-size:24px;font-weight:800;letter-spacing:-.5px">${_esc(viewName)}</div>
      <div style="font-size:13px;color:var(--on-sv);margin-top:2px">${viewPool.length} carte${viewPool.length!==1?'s':''}</div>
    </div>
  `;

  // action row for detail view
  if(ar){
    ar.style.display='flex';
    ar.style.flexWrap='wrap';
    ar.innerHTML=`
      ${!isCourseView?`
        <button class="btn btn-g" onclick="afcQuickAdd()" style="font-size:13px"><span class="ms" style="font-size:14px;vertical-align:middle">edit_note</span> Manuel</button>
        <button class="btn btn-g" onclick="bciSwitchTab('ia');openModal('modal-bulk-concepts')" style="font-size:13px"><span class="ms" style="font-size:14px;vertical-align:middle">auto_awesome</span> Import IA</button>
      `:''}
      <button class="btn btn-g" id="afc-sel-toggle" onclick="toggleAFCSelectMode()" style="font-size:13px${_afcSelectMode?';color:var(--primary);border-color:var(--primary)':''}">
        <span class="ms" style="font-size:14px;vertical-align:middle">checklist</span> Sélectionner
      </button>
      <button class="btn btn-g" onclick="afcSelectAll();afcMoveSelected()" style="font-size:13px"><span class="ms" style="font-size:14px;vertical-align:middle">drive_file_move</span> Tout déplacer</button>
      <div style="flex:1"></div>
      ${viewPool.length>=2?`
        <button class="btn btn-g" onclick="startAFCDue()" title="À revoir" style="font-size:13px"><span class="ms" style="font-size:15px">alarm</span></button>
        <button class="btn btn-p" onclick="startAFCView()" style="font-size:13px"><span class="ms" style="font-size:15px;vertical-align:middle">play_arrow</span> Réviser (${viewPool.length})</button>
      `:''}
    `;
  }

  if(viewPool.length===0){
    list.innerHTML=`<div class="empty-state" style="margin-top:32px"><span class="ms" style="font-size:44px;color:var(--on-sv)">style</span><p style="font-weight:700;margin-top:12px">Aucune carte</p></div>`;
    return;
  }

  if(_afcSelectMode){
    list.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button class="btn btn-sm btn-g" onclick="afcSelectAll()">Tout sélectionner</button></div>`
      +viewPool.map(x=>_renderAFCCard(x)).join('');
  } else {
    list.innerHTML=viewPool.map(x=>_renderAFCCard(x)).join('');
  }
}

function afcOpenView(key){
  _afcView=key; _afcSelectMode=false; _afcSelected.clear();
  _updateAFCSelBar(); renderAFCList();
}

function _renderAFCCard(x){
  const kws=(x.keywords||[]).slice(0,4).map(k=>`<span class="afc-kw">${_esc(k)}</span>`).join('');
  const sel=_afcSelected.has(x.id);
  const masteryDots=typeof x.masteryLevel==='number'?`<div class="afc-mastery">${[0,1,2,3,4].map(i=>`<span class="afc-dot${i<(x.masteryLevel||0)?' afc-dot-on':''}"></span>`).join('')}</div>`:'';
  const clickAct=_afcSelectMode?`toggleAFCItem('${x.id}')`:`openConceptDef('${x.id}')`;
  return `<div class="ci afc-item${sel?' afc-item-sel':''}" id="afc-item-${x.id}" onclick="${clickAct}">
    <div style="display:flex;align-items:flex-start;gap:10px;flex:1">
      ${_afcSelectMode?`<span class="ms afc-check-icon${sel?' afc-check-on':''}" id="afc-chk-${x.id}">${sel?'check_circle':'radio_button_unchecked'}</span>`:''}
      <div style="flex:1;min-width:0">
        <div class="cname" style="white-space:normal">${_esc(x.term||'')}</div>
        <div class="cmeta" style="white-space:normal;margin-top:3px;color:var(--on-sv)">${_esc((x.definition||'').slice(0,80)+(x.definition&&x.definition.length>80?'…':''))}</div>
        ${kws?`<div class="afc-kws" style="margin-top:6px">${kws}</div>`:''}
      </div>
    </div>
    ${masteryDots}
  </div>`;
}

// ── Sessions ──────────────────────────────────
function startAllFlashcardsHub(){
  const allC=(typeof concepts!=='undefined'?concepts:[]).filter(c=>c.definition&&c.definition.trim()).map(c=>({...c,type:'concept'}));
  const pool=[...allC,...flashcards.map(fc=>({...fc,type:'flashcard',masteryLevel:0}))];
  if(pool.length<2){showNotif('Minimum 2 cartes pour jouer.','err');return;}
  startFCSession(pool,'all-flashcards');
}
function startDueFlashcards(){
  const pool=typeof getDueCards==='function'?getDueCards():[];
  if(!pool.length){showNotif('Aucune carte à revoir aujourd\'hui.','ok');return;}
  startFCSession(pool,'all-flashcards');
}

function startAFCView(){
  const allC=(typeof concepts!=='undefined'?concepts:[]).filter(c=>c.definition&&c.definition.trim());
  const cFolders=typeof conceptFolders!=='undefined'?conceptFolders:[];
  let pool=[];
  if(_afcView.startsWith('__course_')){
    const courseId=_afcView.replace('__course_','');
    pool=flashcards.filter(fc=>fc.courseId===courseId).map(fc=>({...fc,type:'flashcard',masteryLevel:0}));
  } else {
    pool=allC.filter(c=>_afcView==='__none__'?!c.folderId:c.folderId===_afcView).map(c=>({...c,type:'concept'}));
  }
  if(pool.length<2){showNotif('Minimum 2 cartes pour démarrer.','err');return;}
  startFCSession(pool,'all-flashcards');
}

function startAFCDue(){
  const now=new Date();
  const pool=(typeof concepts!=='undefined'?concepts:[])
    .filter(c=>c.definition&&c.definition.trim()&&(!c.nextReview||new Date(c.nextReview)<=now))
    .map(c=>({...c,type:'concept'}));
  if(pool.length<2){showNotif('Moins de 2 cartes à revoir pour l\'instant','ok');return;}
  showNotif(`${pool.length} carte${pool.length>1?'s':''} à revoir`,'');
  startFCSession(pool,'all-flashcards');
}

function startAFCForCourse(courseId){
  const pool=flashcards.filter(fc=>fc.courseId===courseId).map(fc=>({...fc,type:'flashcard',masteryLevel:0}));
  if(pool.length<2){showNotif('Minimum 2 flashcards pour démarrer.','err');return;}
  startFCSession(pool,'all-flashcards');
}

function startAFCConceptFolder(folderId){
  const allC=typeof concepts!=='undefined'?concepts:[];
  const pool=(folderId==='__none__'
    ? allC.filter(c=>!c.folderId&&c.definition&&c.definition.trim())
    : allC.filter(c=>c.folderId===folderId&&c.definition&&c.definition.trim())
  ).map(c=>({...c,type:'concept'}));
  if(pool.length<2){showNotif('Minimum 2 concepts pour démarrer.','err');return;}
  startFCSession(pool,'all-flashcards');
}
