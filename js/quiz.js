// ── quiz.js — launchS, renderQ, selAns, endSession, showResults

// ════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════
// Store AI copy texts indexed by their button id to avoid HTML attribute quote issues
let _aiCopyTexts={};

function showResults(duration){
  // Restaurer l'écran résultats si le game over survie l'avait masqué
  const goEl=document.getElementById('survival-gameover');
  if(goEl)goEl.style.display='none';
  const wrapEl=document.querySelector('#screen-results>.wrap');
  if(wrapEl)wrapEl.style.display='';
  const total=session.qs.length;
  const pct=Math.round((session.correct/total)*100);
  stats.sessions++;stats.totalAnswered+=total;stats.totalCorrect+=session.correct;
  addWeeklyQ(total);
  saveAll();

  // ── ANNALES : calcul note /20 ──
  if(session.isAnnales){
    const annWrong=session.answers.filter(a=>!a.correct&&!a.skipped).length;
    const annSkip=session.answers.filter(a=>a.skipped).length;
    const annRight=session.correct;
    const ptsLost=annWrong/3;
    const note=Math.max(0,annRight-ptsLost);   // note / total (chaque Q = 1pt)
    const noteStr=note.toFixed(2).replace('.',',');
    const notePct=Math.min(100,Math.max(0,(note/total)*100));

    // Ring & header
    document.getElementById('remo').innerHTML=note>=16?'<span class="ms f" style="font-size:46px;color:var(--gold)">emoji_events</span>':note>=12?'<span class="ms f" style="font-size:46px;color:var(--primary)">target</span>':note>=8?'<span class="ms f" style="font-size:46px;color:var(--tertiary)">fitness_center</span>':'<span class="ms f" style="font-size:46px;color:var(--on-sv)">menu_book</span>';
    document.getElementById('rhead').textContent=note>=16?'Excellent !':note>=12?'Beau travail !':note>=8?'Continue !':'À retravailler !';
    document.getElementById('rscore').textContent=noteStr;
    document.querySelector('#screen-results .rslbl').textContent=`/ ${total}`;
    document.getElementById('rpct').textContent=`Note concours · ${session.mode}`;
    document.getElementById('rtime').innerHTML=`<span class="ms" style="font-size:13px;vertical-align:middle">timer</span> Durée : ${formatTime(duration||0)}`;

    // Ring animation (sur 20)
    const off=377-(notePct/100)*377;
    const ring=document.getElementById('rring');ring.style.strokeDashoffset=377;
    setTimeout(()=>{ring.style.strokeDashoffset=off;},120);

    // sstrip classique (masqué — remplacé par rann-info)
    document.getElementById('rok').textContent=annRight;
    document.getElementById('rko').textContent=annWrong;
    document.getElementById('rpc').textContent=annSkip;

    // Bloc annales
    document.getElementById('rann-info').style.display='block';
    document.getElementById('rann-note').textContent=noteStr;
    document.getElementById('rann-sub').textContent=`Note max : ${total} · ${annRight} juste · ${annWrong} fausse${annWrong!==1?'s':''} · ${annSkip} passée${annSkip!==1?'s':''}`;
    document.getElementById('rann-ok').textContent=annRight;
    document.getElementById('rann-ko').textContent=annWrong;
    document.getElementById('rann-skip').textContent=annSkip;
    if(annWrong>0){
      document.getElementById('rann-penalty').style.display='block';
      document.getElementById('rann-penalty-val').textContent=(ptsLost).toFixed(2).replace('.',',');
    } else {
      document.getElementById('rann-penalty').style.display='none';
    }
  } else {
    document.getElementById('rann-info').style.display='none';
    document.getElementById('remo').innerHTML=pct>=90?'<span class="ms f" style="font-size:46px;color:var(--gold)">emoji_events</span>':pct>=70?'<span class="ms f" style="font-size:46px;color:var(--primary)">target</span>':pct>=50?'<span class="ms f" style="font-size:46px;color:var(--tertiary)">fitness_center</span>':'<span class="ms f" style="font-size:46px;color:var(--on-sv)">menu_book</span>';
    document.getElementById('rhead').textContent=['À retravailler !','Continue comme ça !','Beau travail !','Excellent travail !'][pct>=90?3:pct>=70?2:pct>=50?1:0];
    document.getElementById('rscore').textContent=`${session.correct}/${total}`;
    document.querySelector('#screen-results .rslbl').textContent='maîtrise';
    document.getElementById('rpct').textContent=`${pct}% de réussite · ${session.mode}`;
    document.getElementById('rtime').innerHTML=`<span class="ms" style="font-size:13px;vertical-align:middle">timer</span> Durée : ${formatTime(duration||0)}`;
    document.getElementById('rok').textContent=session.correct;
    document.getElementById('rko').textContent=total-session.correct;
    document.getElementById('rpc').textContent=pct+'%';
    const off=377-(pct/100)*377;const ring=document.getElementById('rring');ring.style.strokeDashoffset=377;setTimeout(()=>{ring.style.strokeDashoffset=off;},120);
  }

  const wrong=session.answers.filter(a=>!a.correct&&!a.skipped);
  const hasNextBlock=window._blocks&&window._currentBlock!==undefined&&window._currentBlock<window._blocks.length-1;
  document.getElementById('racts').innerHTML=`
    ${hasNextBlock?`<button class="btn btn-p" onclick="nextBlock()" style="flex:1"><span class="ms" style="font-size:15px">navigate_next</span> Bloc suivant (${window._currentBlock+2}/${window._blocks.length})</button>`:``}
    ${!hasNextBlock?`<button class="btn btn-g" onclick="goBack()"><span class="ms" style="font-size:15px">arrow_back</span> Retour</button>`:''}
    ${!hasNextBlock?`<button class="btn btn-p" onclick="restartS()"><span class="ms" style="font-size:15px">replay</span> Recommencer</button>`:''}
    ${!hasNextBlock&&wrong.length>0?`<button class="btn btn-w" onclick="retryErr()"><span class="ms" style="font-size:15px">find_in_page</span> Corriger ${wrong.length} erreur${wrong.length>1?'s':''}</button>`:''}
    ${!hasNextBlock&&wrong.length>0&&!session.isAnnales?`<button class="btn btn-purple" onclick="showScreen('stats')"><span class="ms" style="font-size:15px">bar_chart</span> Points faibles</button>`:''}
    ${hasNextBlock?`<button class="btn btn-g" onclick="goBack()" style="flex:1"><span class="ms" style="font-size:15px">stop_circle</span> Arrêter ici</button>`:''}
  `;

  // Recap
  const recap={};session.answers.forEach(a=>{const cid=a.q.courseId;if(!recap[cid])recap[cid]={ok:0,t:0};recap[cid].t++;if(a.correct)recap[cid].ok++;});
  const rr=document.getElementById('rrecap');rr.style.display=!hasNextBlock?'block':'none';
  document.getElementById('rrecaplist').innerHTML=Object.keys(recap).map(cid=>{
    const c=courses.find(x=>x.id===cid);const f=c?folders.find(x=>x.id===c.folderId):null;
    const r=recap[cid];const cp=Math.round((r.ok/r.t)*100);const bc=cp>=80?'var(--tertiary)':cp>=50?'var(--gold)':'var(--error)';
    return `<div class="recap"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:5px"><div><div style="font-size:11px;color:var(--on-sv);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:2px">${f?f.name:''}</div><div class="hf" style="font-size:15px;font-weight:700">${c?c.name:'Cours'}</div></div><div class="hf" style="font-size:17px;font-weight:800;color:${bc}">${cp}%</div></div><div class="mbar"><div class="mfill" style="width:${cp}%;background:${bc}"></div></div><div style="font-size:12px;color:${bc};font-weight:600">${cp>=80?'<span class="ms" style="font-size:12px;vertical-align:middle;color:var(--tertiary)">check_circle</span> Bien maîtrisé':cp>=50?'<span class="ms" style="font-size:12px;vertical-align:middle;color:var(--gold)">warning</span> À retravailler':'<span class="ms" style="font-size:12px;vertical-align:middle;color:var(--error)">cancel</span> À consolider'} · ${r.ok}/${r.t}</div></div>`;
  }).join('');

  // Wrong items — store copy texts in JS object to avoid HTML attribute quoting issues
  _aiCopyTexts={};
  const ws=document.getElementById('rwrong');
  if(wrong.length){
    ws.style.display='block';
    document.getElementById('rwronglist').innerHTML=wrong.map((a,idx)=>{
      const ac=courses.find(x=>x.id===a.q.courseId);const af=ac?folders.find(x=>x.id===ac.folderId):null;
      const ct=a.q.answers[a.chosenIdx]||'(non répondu)';const corr=a.q.answers[a.q.correct];
      _aiCopyTexts['cbtn-'+idx]=`Dans la question "${a.q.question}", je me suis trompé en indiquant la réponse "${ct}" qui est fausse, la vraie étant "${corr}". Explique moi pourquoi.`;
      return `<div class="wi">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--on-sv);font-weight:700;margin-bottom:4px">${af?af.name+' › ':''}${ac?ac.name:''}</div>
        <div class="hf" style="font-size:15px;font-weight:700;margin-bottom:10px;line-height:1.4">${a.q.question}</div>
        <div><span class="wchosen">✗ ${ct}</span></div>
        <div style="margin-top:5px"><span class="wcorrect">✓ ${corr}</span></div>
        ${a.q.expl&&!session.isAnnales?`<div style="font-size:13px;color:#5C4200;margin-top:10px;padding:12px 14px;background:var(--gold-l);border-radius:10px;border-left:3px solid var(--gold);line-height:1.7"><span class="ms" style="font-size:14px;vertical-align:middle">lightbulb</span> <strong>Explication :</strong> ${a.q.expl}</div>`:''}
        ${a.q.expl&&session.isAnnales?`<div style="font-size:13px;color:#5C4200;margin-top:10px;padding:12px 14px;background:var(--gold-l);border-radius:10px;border-left:3px solid var(--gold);line-height:1.7"><span class="ms" style="font-size:14px;vertical-align:middle">lightbulb</span> <strong>Explication :</strong> ${a.q.expl}</div>`:''}
        <div style="margin-top:10px">
          <button class="btn-copy" id="cbtn-${idx}" onclick="copyForAI('cbtn-${idx}')"><span class="ms" style="font-size:13px">content_copy</span> Copier pour une IA</button>
        </div>
      </div>`;
    }).join('');
  } else ws.style.display='none';
  if(typeof renderSessionQStats==='function')renderSessionQStats(session);
  showScreen('results');
}

function copyForAI(btnId){
  const text=_aiCopyTexts[btnId];if(!text)return;
  const btn=document.getElementById(btnId);
  const ok=()=>{btn.innerHTML='<span class="ms" style="font-size:13px">check</span> Copié !';btn.classList.add('copied');setTimeout(()=>{btn.innerHTML='<span class="ms" style="font-size:13px">content_copy</span> Copier pour une IA';btn.classList.remove('copied');},2500);};
  try{navigator.clipboard.writeText(text).then(ok).catch(()=>{const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0;top:0;left:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);ok();});}
  catch(e){const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0;top:0;left:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);ok();}
}
let _preRetryBack=null;
function retryErr(){
  const w=session.answers.filter(a=>!a.correct&&!a.skipped).map(a=>a.q);
  if(!w.length)return;
  _preRetryBack=rBack;
  rBack='results';
  launchS(shuffle(w),'Correction erreurs',false,true,false,false,false);
}
function goBack(){
  const dest=rBack;
  if(dest==='results'){
    // Après une session de correction, aller à l'origine réelle
    if(session&&session.isRetry&&_preRetryBack!==null){
      const orig=_preRetryBack;_preRetryBack=null;rBack=orig;
      if(orig==='subfolder'){showScreen('subfolder');}
      else if(orig==='course'){showScreen('course');}
      else if(orig==='matiere'){showScreen('matiere');}
      else{setAnnalesMode(false);switchTab(orig==='home'||!orig?'home':orig);}
      return;
    }
    showScreen('results');
  } else if(dest==='subfolder'){
    showScreen('subfolder');
  } else if(dest==='course'){
    showScreen('course');
  } else if(dest==='matiere'){
    showScreen('matiere');
  } else {
    setAnnalesMode(false);
    switchTab('home');
  }
}
function restartS(){launchS(shuffle(session.qs),session.mode,session.isFlash,false,session.isHard,false,session.isAnnales);}
function confirmQuit(){openModal('modal-quit');}
function doQuit(){
  closeModal('modal-quit');
  clearInterval(timerInterval);
  document.getElementById('topbar-timer').style.display='none';
  if(document.body.classList.contains('focus-mode'))toggleFocusMode();
  // Sauvegarder pour le banner de reprise sur le dashboard
  if(session && session.cur >= 1) saveResumeSession();
  else clearResumeSession();
  // Réinitialiser session pour masquer le chip "en cours"
  session = null;
  if(typeof updateQuizIndicator==='function') updateQuizIndicator();
  goBack();
}
function doBoycott(){if(!session||!session.qs[session.cur])return;boycottQuestion(session.qs[session.cur].id);showNotif('Question boycottée ⛔','ok');setTimeout(()=>nextQ(),500);}
function toggleFavoriteQ(){
  if(!session||!session.qs[session.cur])return;
  const q=session.qs[session.cur];
  toggleFavorite(q.id);
  const isFav=isFavorite(q.id);
  const btn=document.getElementById('qfavorite');
  const icon=document.getElementById('qfav-icon');
  if(btn&&icon){
    icon.textContent=isFav?'star':'star_border';
    btn.style.color=isFav?'#FFD700':'var(--on-sv)';
    btn.title=isFav?'Retirer des favoris':'Ajouter aux favoris';
    // Petit pop animation
    btn.style.transform='scale(1.3)';
    setTimeout(()=>{btn.style.transform='scale(1)';},200);
  }
  showNotif(isFav?'⭐ Ajouté aux favoris':'Retiré des favoris','ok');
}
function nextBlock(){
  if(!window._blocks||window._currentBlock===undefined)return;
  window._currentBlock++;
  clearInterval(timerInterval);
  const newQs=window._blocks[window._currentBlock];
  const idx=window._currentBlock;const total=window._blocks.length;
  const label=window._blockNames&&window._blockNames[idx]?`${window._blockNames[idx]} (${idx+1}/${total})`:window._blockTopic+` (Bloc ${idx+1}/${total})`;
  launchS(newQs,label,false,false,false,false,session.isAnnales);
}
function retrySurvivalErr(){const w=session.wrongQuestions||[];if(!w.length)return;const qs=w.map(a=>a.q);rBack='home';launchS(shuffle(qs),'Correction (Mode Survie)',false,true,false,false,false);}

// ════════════════════════════════════════════
// SESSION LAUNCH
// ════════════════════════════════════════════
// (defined in content.js — launchS, renderQ, selAns, nextQ, endSession, skipQ)
