/* =========================================================
   quiz-cobalt.js — Quiz et Résultats « Cobalt » (Claude Design, 15 nov. 2026)
   Le moteur ne change pas (launchS, renderQ, selAns, skipQ, nextQ, prevQ,
   endSession, showResults, showSurvivalGameOver dans content.js / quiz.js).
   Ce fichier :
   - après chaque renderQ / selAns : en-tête du mode, progression, badges,
     verdict, carte Explication, barème Annales, barre d'actions, colonne de
     droite (navigation, score, raccourcis) ;
   - après showResults / showSurvivalGameOver : construit l'écran Résultats
     (#kr-root) à partir de la session réelle.
   Script classique (le site s'ouvre aussi en file://).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString('fr-FR');
const fr=n=>String(Math.round(n*100)/100).replace('.',',');
const L=['A','B','C','D','E','F','G','H'];
function g(name){try{return eval(name);}catch(e){return undefined;}} /* variable globale « let » d'un autre script */

const MODES={
  flash:{short:'Flash rapide',icon:'bolt',tone:'t-amber'},
  ciblee:{short:'Révision ciblée',icon:'my_location',tone:'t-rose'},
  annales:{short:'Annales',icon:'history_edu',tone:'t-sky'},
  survie:{short:'Survie',icon:'favorite',tone:'t-rose'},
  correction:{short:'Correction des erreurs',icon:'find_in_page',tone:'t-violet'},
  cours:{short:'Révision',icon:'school',tone:'t-sky'}
};
const DIFF={new:['Nouvelle','t-violet'],easy:['Facile','t-sky'],medium:['Moyenne','t-amber'],hard:['Difficile','t-orange'],acquired:['Acquise','t-green']};
function modeKey(S){
  if(!S)return 'cours';
  if(S.isAnnales)return 'annales';
  if(S.isSurvival)return 'survie';
  if(S.isRetry)return 'correction';
  if(S.isFlash)return 'flash';
  if(S.isHard||/cibl/i.test(S.mode||''))return 'ciblee';
  return 'cours';
}
function xpPerCorrect(){const X=g('GAM_XP');return X&&X.correct||5;}
function curXP(){const gm=g('gam');return gm?gm.xp|0:0;}
let _xp0=0;

/* ================= QUIZ ================= */
function sync(){
  const S=g('session');
  if(!S||!S.qs||document.body.dataset.screen!=='quiz')return;
  const q=S.qs[S.cur];if(!q)return;
  const mk=modeKey(S),M=MODES[mk],total=S.qs.length,ans=S.answers||[],a=ans[S.cur];
  const answered=!!a&&!a.skipped;

  // En-tête : icône du mode
  const ic=$('kq-mode-ic');if(ic){ic.className='kq-sq sm '+M.tone;ic.firstElementChild.textContent=M.icon;}

  // Progression
  const bar=$('qprog'),left=$('qn'),right=$('qsc');
  if(mk==='survie'){
    const rec=g('bestSurvivalStreak')|0;
    bar.style.width=Math.min(100,(S.correct||0)/Math.max(rec,10)*100)+'%';
    left.innerHTML=`Question <strong class="kh-num">${S.cur+1}</strong> · record <span class="kh-num">${rec}</span>`;
    right.innerHTML=`<span class="kq-lives" aria-label="${S.lives} vies restantes">${[0,1,2].map(i=>`<span class="ms f${i>=S.lives?' lost':''}">favorite</span>`).join('')}</span>`;
  }else{
    bar.style.width=(Math.min(ans.length,total)/total*100)+'%';
    left.innerHTML=`<strong class="kh-num">${S.cur+1}</strong> / <span class="kh-num">${total}</span>`;
    if(mk==='annales'){
      const sk=ans.filter(x=>x.skipped).length,n=ans.length-sk;
      right.innerHTML=`<span><strong class="kh-num">${n}</strong> ${n>1?'répondues':'répondue'} · <strong class="kh-num">${sk}</strong> ${sk>1?'passées':'passée'}</span>`;
    }else{
      const c=S.correct||0;
      right.innerHTML=`<span class="kq-good"><span class="ms f">check_circle</span><strong class="kh-num">${c}</strong>&nbsp;${c>1?'bonnes':'bonne'}</span>`;
    }
  }

  // Badges : mode, difficulté, cours
  const d=DIFF[typeof getDiff==='function'?getDiff(q.id):'new']||DIFF.new;
  const c=(g('courses')||[]).find(x=>x.id===q.courseId);
  $('qbadges').innerHTML=`<span class="kq-badge primary"><span class="ms f">${M.icon}</span>${M.short}</span>`
    +(mk==='annales'?'':`<span class="kq-badge tone ${d[1]}"><span class="dot"></span>${d[0]}</span>`)
    +(c?`<span class="kq-badge">${esc(c.name)}</span>`:'');

  // Favori
  const fav=$('kq-fav');
  if(fav){const on=typeof isFavorite==='function'&&isFavorite(q.id);fav.dataset.on=on;fav.setAttribute('aria-pressed',on);fav.title=on?'Retirer des favoris':'Ajouter aux favoris';}

  // Réponses : en Annales, jamais de correction pendant l'épreuve (même en revenant en arrière)
  const box=$('qopts'),opts=[...box.children];
  if(mk==='annales'&&a&&!a.skipped&&opts.some(o=>o.classList.contains('correct')||o.classList.contains('reveal')||o.classList.contains('wrong'))){
    opts.forEach((o,i)=>{o.classList.remove('correct','reveal','wrong');o.classList.toggle('annales-selected',i===a.chosenIdx);});
  }
  box.classList.toggle('is-locked',!!a);

  // Verdict + explication + rappel de fiche
  let verdict='';
  if(answered&&mk!=='annales'){
    const ci=opts.findIndex(o=>o.classList.contains('correct')||o.classList.contains('reveal'));
    verdict=a.correct
      ?`<div class="kq-verdict ok"><span class="ms f">check_circle</span>Bonne réponse<span class="kq-xp"><span class="ms f">bolt</span>+${xpPerCorrect()} XP</span></div>`
      :`<div class="kq-verdict ko"><span class="ms f">cancel</span>Mauvaise réponse${ci>=0?' · la bonne réponse était '+L[ci]:''}${mk==='survie'?'<span class="kq-xp"><span class="ms f" style="color:var(--c-rose)">heart_broken</span>−1 vie</span>':''}</div>`;
  }
  $('kq-verdict').innerHTML=verdict;
  const ex=$('qexpl');
  if(ex){
    if(mk==='annales'||!q.expl||!answered){ex.style.display='none';}
    else{
      ex.style.display='';
      ex.innerHTML=`<div class="kq-note-head"><div class="kq-sq sm t-amber"><span class="ms">lightbulb</span></div><h2 class="kq-note-title">Explication</h2></div><div class="kq-note-body">${q.expl}</div>`;
    }
  }
  $('kq-hint').innerHTML=mk==='annales'
    ?'<div class="kq-hint"><span class="ms">balance</span>Notation concours : <span>bonne <b>+1</b></span><span>fausse <b>−⅓</b></span><span>passée <b>0</b></span></div>':'';

  // Barre d'actions
  ['kq-prev','kq-prev-m'].forEach(id=>{const b=$(id);if(b)b.disabled=S.cur===0;});
  const sk=$('kq-skip');if(sk)sk.hidden=!(mk==='annales'&&!a);
  const nx=$('kq-next');if(nx)nx.disabled=!a;
  const last=mk!=='survie'&&S.cur+1>=total;
  $('kq-next-lbl').textContent=last?'Voir les résultats':'Suivante';

  renderRail(S,mk);
}

function renderRail(S,mk){
  const nav=$('kq-nav');if(!nav)return;
  const ans=S.answers||[],total=S.qs.length;
  const n=mk==='survie'?Math.max(10,Math.ceil((S.cur+1)/5)*5):total;
  let h='';
  for(let j=0;j<n;j++){
    const a=ans[j];let cls='';
    if(a&&a.skipped)cls='skip';
    else if(a)cls=mk==='annales'?'done':(a.correct?'ok':'ko');
    if(j===S.cur)cls+=' cur';
    const can=j<=ans.length&&j<total&&j!==S.cur;
    h+=`<button type="button" class="${cls}" ${can?`onclick="khQuizGo(${j})"`:'disabled'}>${j+1}</button>`;
  }
  nav.innerHTML=h;
  $('kq-rail-count').textContent=mk==='survie'?'Q'+(S.cur+1):(S.cur+1)+'/'+total;
  $('kq-legend').innerHTML=mk==='annales'
    ?'<span><i style="background:var(--kc-primary-soft)"></i>Répondue</span><span><i style="border:1px dashed var(--kc-ink-2)"></i>Passée</span><span><i style="box-shadow:inset 0 0 0 2px var(--kc-primary)"></i>En cours</span>'
    :'<span><i style="background:var(--kc-success-soft);box-shadow:inset 0 0 0 1px var(--kc-success)"></i>Bonne</span><span><i style="background:var(--kc-danger-soft);box-shadow:inset 0 0 0 1px var(--kc-danger)"></i>Erreur</span><span><i style="box-shadow:inset 0 0 0 2px var(--kc-primary)"></i>En cours</span>';

  const sc=$('kq-score'),right=S.correct||0,done=ans.filter(a=>!a.skipped).length,wrong=done-right;
  if(mk==='annales'){
    const skp=ans.filter(a=>a.skipped).length;
    sc.innerHTML=`<div class="kq-rail-title"><span>Barème</span><span class="ms" style="font-size:18px">balance</span></div>
      <div class="kq-rows"><div class="kq-row"><span><span class="ms" style="color:var(--kc-success)">check_circle</span>Bonne réponse</span><b>+1 pt</b></div>
      <div class="kq-row"><span><span class="ms" style="color:var(--kc-danger)">cancel</span>Mauvaise réponse</span><b>−⅓ pt</b></div>
      <div class="kq-row"><span><span class="ms">skip_next</span>Question passée</span><b>0 pt</b></div></div>
      <p class="kq-rail-foot"><span class="kh-num">${done}</span> répondue${done>1?'s':''}, <span class="kh-num">${skp}</span> passée${skp>1?'s':''}. Le score s'affiche à la fin.</p>`;
  }else if(mk==='survie'){
    sc.innerHTML=`<div class="kq-rail-title"><span>Survie</span></div>
      <div class="kq-lives big">${[0,1,2].map(i=>`<span class="ms f${i>=S.lives?' lost':''}">favorite</span>`).join('')}</div>
      <div class="kq-rows"><div class="kq-row"><span>Série en cours</span><b>${S.survivalStreak||0}</b></div><div class="kq-row"><span>Ton record</span><b>${g('bestSurvivalStreak')|0}</b></div></div>`;
  }else{
    const xp=Math.max(0,curXP()-_xp0);
    sc.innerHTML=`<div class="kq-rail-title"><span>Score</span></div>
      <div class="kq-score-big"><span class="kh-num">${done?Math.round(right/done*100):0} %</span> <small>de réussite</small></div>
      <div class="kq-rows"><div class="kq-row"><span><span class="ms" style="color:var(--kc-success)">check_circle</span>Bonnes</span><b>${right}</b></div>
      <div class="kq-row"><span><span class="ms" style="color:var(--kc-danger)">cancel</span>Erreurs</span><b>${wrong}</b></div>
      <div class="kq-row"><span><span class="ms" style="color:var(--kc-amber)">bolt</span>XP de la session</span><b>+${nf(xp)}</b></div></div>`;
  }
}

function scrollToVerdict(){
  if(window.innerWidth>=1024)return;
  const v=document.querySelector('#kq-verdict .kq-verdict');if(!v)return;
  const head=(document.querySelector('.kq-head')||{offsetHeight:0}).offsetHeight;
  const y=v.getBoundingClientRect().top+window.scrollY-head-140;
  if(y>window.scrollY)window.scrollTo({top:y,behavior:'smooth'});
}

window.khQuizGo=function(i){
  const S=g('session');if(!S)return;
  if(i<0||i>S.answers.length||i>=S.qs.length)return;
  S.cur=i;renderQ();window.scrollTo(0,0);
};
window.khQuizFav=function(){
  if(typeof toggleFavoriteQ==='function')toggleFavoriteQ();
  const S=g('session'),q=S&&S.qs[S.cur];
  const on=q&&typeof isFavorite==='function'&&isFavorite(q.id);
  if(typeof showNotif==='function')showNotif(on?'Ajoutée aux favoris':'Retirée des favoris','ok');
  sync();
};

/* Clavier : 1 à 5 pour répondre, Entrée pour la suite (Q S D F / Espace / flèches restent gérés par content.js) */
document.addEventListener('keydown',e=>{
  if(document.body.dataset.screen!=='quiz'||!g('session'))return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
  if(document.querySelector('.mdbg.open'))return;
  const n=['1','2','3','4','5','6'].indexOf(e.key);
  if(n>-1){const o=[...document.querySelectorAll('#qopts .ob:not(:disabled)')][n];if(o){e.preventDefault();o.click();}return;}
  if(e.key==='Enter'){const b=$('kq-next');if(b&&!b.disabled){e.preventDefault();nextQ();}}
});

/* ================= RÉSULTATS ================= */
let _last=null;
function ring(pct,center,label){
  const r=72,c=2*Math.PI*r;
  return `<div class="kr-ring" role="img" aria-label="${esc(label)}"><svg width="168" height="168" viewBox="0 0 168 168"><circle cx="84" cy="84" r="${r}" fill="none" stroke="var(--kc-surface-2)" stroke-width="14"/>
    <circle class="kr-ring-arc" cx="84" cy="84" r="${r}" fill="none" stroke="var(--kc-primary)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}" data-off="${(c*(1-Math.max(0,Math.min(1,pct)))).toFixed(2)}"/></svg>
    <div class="kr-ring-center">${center}</div></div>`;
}
const kpi=(icon,color,lbl,val)=>`<div class="kr-kpi"><span class="kr-kpi-lbl"><span class="ms f" style="color:${color}">${icon}</span>${lbl}</span><span class="kr-kpi-val">${val}</span></div>`;

function buildResults(R){
  const root=$('kr-root');if(!root)return;
  const M=MODES[R.mk];
  const nErr=R.errors.length;
  const backLbl=(g('rBack')||'home')==='home'?'Retour à l’accueil':'Retour';
  const actions=`${R.nextBlock?`<button class="btn btn-p" type="button" onclick="khResults('block')"><span class="ms">navigate_next</span>${R.nextBlock}</button>`:''}
    ${nErr?`<button class="btn ${R.nextBlock?'btn-g':'btn-p'}" type="button" onclick="khResults('retry')"><span class="ms">refresh</span>Revoir mes erreurs (${nErr})</button>`:''}
    <button class="btn ${nErr||R.nextBlock?'btn-g':'btn-p'}" type="button" onclick="khResults('again')"><span class="ms">replay</span>Recommencer</button>`;

  let hero='';
  if(R.mk==='annales'){
    const raw=R.right-R.wrong/3,note=Math.max(0,Math.round(raw/R.total*20*2)/2),malus=R.wrong/3;
    hero+=ring(note/20,`<span class="kr-ring-val">${fr(note)}<small>/20</small></span><span class="kr-ring-lbl">note concours</span>`,'Note '+fr(note)+' sur 20');
    hero+=`<div class="kr-hero-text"><h1 class="kr-hero-title">${R.right} bonne${R.right>1?'s':''} réponse${R.right>1?'s':''} sur ${R.total}</h1><p class="kr-hero-sub">${R.wrong?`Tu as perdu ${fr(malus)} point${malus>1?'s':''} sur ${R.wrong} erreur${R.wrong>1?'s':''}. Sur les questions dont tu doutes, passer peut rapporter plus que répondre.`:'Aucune erreur : aucun point perdu.'}</p><div class="kr-hero-actions">${actions}</div></div>`;
    hero+=`<div class="kr-scale">
      <div class="kr-scale-row"><span class="l"><span class="ms f" style="color:var(--kc-success)">check_circle</span>Correctes</span><span class="m">${R.right} × +1</span><span class="r">+${R.right}</span></div>
      <div class="kr-scale-row"><span class="l"><span class="ms f" style="color:var(--kc-danger)">cancel</span>Fausses</span><span class="m">${R.wrong} × −⅓</span><span class="r">−${fr(malus)}</span></div>
      <div class="kr-scale-row"><span class="l"><span class="ms" style="color:var(--kc-ink-2)">skip_next</span>Passées</span><span class="m">${R.skipped} × 0</span><span class="r">0</span></div>
      <div class="kr-scale-row total"><span class="l">Total</span><span class="m">${fr(Math.max(0,raw))} / ${R.total}</span><span class="r">${fr(note)} / 20</span></div></div>`;
    if(R.wrong)hero+=`<div class="kr-malus"><span class="ms">warning</span><span><b>Points perdus (malus) : ${fr(malus)} pts.</b> Ajuste ta stratégie de prise de risque.</span></div>`;
    hero+=`<div class="kr-kpis">${kpi('timer','var(--kc-ink-2)','Temps',R.time)}${kpi('check_circle','var(--kc-success)','Correctes',R.right)}${kpi('cancel','var(--kc-danger)','Fausses',R.wrong)}</div>`;
  }else if(R.mk==='survie'){
    const rec=Math.max(R.record,1);
    hero+=ring(R.right/rec,`<span class="kr-ring-val">${R.right}</span><span class="kr-ring-lbl">record : ${R.newRecord?R.right:R.record}</span>`,R.right+' bonnes réponses');
    const sub=R.newRecord?`Nouveau record ! L'ancien était de ${R.record}.`:R.right===R.record?`Tu égales ton record de ${R.record}.`:`Ton record est de ${R.record}. Il t'en manquait ${R.record-R.right} pour le battre.`;
    hero+=`<div class="kr-hero-text"><span class="kq-lives">${'<span class="ms f lost">favorite</span>'.repeat(3)}</span><h1 class="kr-hero-title">${R.right} bonne${R.right>1?'s':''} réponse${R.right>1?'s':''} avant la fin</h1><p class="kr-hero-sub">${sub}</p><div class="kr-hero-actions">${actions}</div></div>`;
    hero+=`<div class="kr-kpis">${kpi('timer','var(--kc-ink-2)','Temps',R.time)}${kpi('check_circle','var(--kc-success)','Correctes',R.right)}${kpi('cancel','var(--kc-danger)','Erreurs',R.wrong)}</div>`;
  }else{
    const pct=R.total?Math.round(R.right/R.total*100):0;
    hero+=ring(R.total?R.right/R.total:0,`<span class="kr-ring-val">${pct}<small>%</small></span><span class="kr-ring-lbl">de réussite</span>`,pct+' % de réussite');
    const weak=R.courses.filter(c=>c.ok<c.t).slice(0,2).map(c=>c.name);
    let sub=R.goalDone?'Objectif du jour atteint.':`Plus que ${R.goalLeft} question${R.goalLeft>1?'s':''} pour ton objectif du jour.`;
    if(weak.length)sub+=` À retravailler : ${weak.map(esc).join(' et ')}.`;
    else if(R.right===R.total&&R.total)sub+=' Sans faute, bravo !';
    hero+=`<div class="kr-hero-text"><h1 class="kr-hero-title">${R.right} bonne${R.right>1?'s':''} réponse${R.right>1?'s':''} sur ${R.total}</h1><p class="kr-hero-sub">${sub}</p><div class="kr-hero-actions">${actions}</div></div>`;
    hero+=`<div class="kr-kpis">${kpi('timer','var(--kc-ink-2)','Temps',R.time)}${kpi('check_circle','var(--kc-success)','Correctes',R.right)}${kpi('cancel','var(--kc-danger)','Erreurs',R.wrong)}</div>`;
  }

  const courses=R.courses.map(c=>{
    const p=Math.round(c.ok/c.t*100);
    const col=p<50?'var(--c-rose)':p<60?'var(--c-orange)':p<70?'var(--c-amber)':'var(--kc-primary)';
    return `<div class="kr-course"><div class="kr-course-top"><span class="kr-course-name">${esc(c.name)}</span><span class="kr-course-score"><b>${c.ok}</b>/${c.t} · ${p} %</span></div>
      <div class="kh-bar"><span style="--v:${Math.max(p,2)}%;--bar-c:${col}"></span></div></div>`;
  }).join('')||'<div class="kh-empty">Aucune réponse enregistrée.</div>';

  const show=R.mk==='annales'?3:99;
  if(typeof _aiCopyTexts!=='undefined'){try{for(const k in _aiCopyTexts)if(k.indexOf('kr-cp-')===0)delete _aiCopyTexts[k];}catch(e){}}
  const errors=R.errors.map((e,i)=>{
    const yours=e.q.answers[e.chosenIdx],good=e.q.answers[e.q.correct];
    try{_aiCopyTexts['kr-cp-'+i]=`Dans la question "${e.q.question}", je me suis trompé en indiquant la réponse "${yours||'(aucune)'}" qui est fausse, la vraie étant "${good}". Explique moi pourquoi.`;}catch(_){}
    const cc=(g('courses')||[]).find(x=>x.id===e.q.courseId);
    const d=DIFF[typeof getDiff==='function'?getDiff(e.q.id):'new']||DIFF.new;
    return `<article class="kr-err${i>=show?' kr-more-item':''}"><div class="kr-err-head"><span class="kq-badge">Q${e.n}</span><span>${cc?esc(cc.name)+' · ':''}${d[0]}</span>
        <button type="button" class="kr-copy" id="kr-cp-${i}" onclick="copyForAI('kr-cp-${i}')" title="Copier la question pour la coller dans une IA"><span class="ms">content_copy</span> Copier pour une IA</button></div>
      <h3 class="kr-err-q">${esc(e.q.question)}</h3>
      <div class="kr-err-a ko"><span class="k"><span class="ms">close</span></span><span class="t"><small>Ta réponse</small>${esc(yours||'(aucune)')}</span></div>
      <div class="kr-err-a ok"><span class="k"><span class="ms">check</span></span><span class="t"><small>Bonne réponse</small>${esc(good)}</span></div>
      ${e.q.expl?`<details${i===0?' open':''}><summary>Explication<span class="ms">expand_more</span></summary><p>${e.q.expl}</p></details>`:''}</article>`;
  }).join('')+(nErr>show?`<button class="btn btn-g kr-more" type="button" onclick="this.closest('.kr-errors').classList.add('all');this.remove()">Voir les ${nErr-show} autres erreurs<span class="ms">expand_more</span></button>`:'');

  root.innerHTML=`
    <div class="kr-head"><header class="kq-bar">
      <button class="kq-ib kq-only-m" type="button" onclick="khResults('back')" aria-label="${backLbl}"><span class="ms">close</span></button>
      <div class="kq-mode"><div class="kq-sq sm ${M.tone}"><span class="ms f">${M.icon}</span></div><div style="min-width:0"><div class="kq-title">Résultats</div><div class="kq-sub">${esc(R.sub)}</div></div></div>
      <div class="kq-tools"><button class="btn btn-g kq-only-d kq-quit" type="button" onclick="khResults('back')"><span class="ms">${backLbl==='Retour'?'arrow_back':'home'}</span>${backLbl}</button></div>
    </header></div>
    <main class="kr-main">
      <div class="kr-col">
        <section class="kq-card kr-card kr-hero-card" aria-label="Score"><div class="kr-hero">${hero}</div></section>
        <section class="kq-card kr-card kr-c-errors" aria-labelledby="kr-err-title">
          <div class="kr-card-head"><h2 class="kr-card-title" id="kr-err-title">Détail des erreurs</h2><span class="kr-card-sub">${nErr?nErr+(nErr>1?' questions ratées':' question ratée'):'Aucune erreur'}</span></div>
          <div class="kr-errors">${errors||'<div class="kh-empty">Aucune erreur sur cette session. Bravo !</div>'}</div>
        </section>
      </div>
      <div class="kr-col">
        <section class="kq-card kr-card kr-c-rewards" aria-labelledby="kr-rw-title">
          <div class="kr-card-head"><h2 class="kr-card-title" id="kr-rw-title">Récompenses</h2><span class="kr-card-sub">Session terminée</span></div>
          <div id="kr-rewards" class="kr-rewards-wrap"><div class="kh-empty">Calcul de l’XP…</div></div>
        </section>
        <section class="kq-card kr-card kr-c-courses" aria-labelledby="kr-crs-title">
          <div class="kr-card-head"><h2 class="kr-card-title" id="kr-crs-title">Résultats par cours</h2><span class="kr-card-sub">du plus faible au plus fort</span></div>
          <div class="kr-courses">${courses}</div>
        </section>
        <button class="btn btn-g kr-home-link" type="button" onclick="khResults('back')"><span class="ms">${backLbl==='Retour'?'arrow_back':'home'}</span>${backLbl}</button>
      </div>
    </main>
    <nav class="kr-actions" aria-label="Actions">
      <button class="btn btn-g" type="button" onclick="khResults('again')"><span class="ms">replay</span>Recommencer</button>
      ${R.nextBlock?`<button class="btn btn-p" type="button" onclick="khResults('block')"><span class="ms">navigate_next</span>Bloc suivant</button>`
        :nErr?`<button class="btn btn-p" type="button" onclick="khResults('retry')"><span class="ms">refresh</span>Revoir mes erreurs</button>`
        :`<button class="btn btn-p" type="button" onclick="khResults('back')"><span class="ms">done</span>Terminer</button>`}
    </nav>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    root.querySelectorAll('.kr-ring-arc').forEach(c=>{c.style.strokeDashoffset=c.dataset.off;});
  }));
  // Récompenses : l'XP de fin de session est versée juste après showResults (gamification.js)
  setTimeout(()=>renderRewards(R),30);
}

function renderRewards(R){
  const el=$('kr-rewards');if(!el)return;
  const now=curXP(),gain=Math.max(0,now-R.xp0);
  const info=typeof gamLevelInfo==='function'?gamLevelInfo(now):null;
  const coins=gain*(g('CITY_XP_MONEY')||20);
  let lvl='';
  if(info){
    const into0=Math.max(0,info.into-gain);
    const was=into0/info.need*100,gn=(info.into-into0)/info.need*100;
    lvl=`<div class="kr-lvl"><div class="kr-lvl-row"><span>Niveau <b>${info.level}</b> · <b class="kh-num">${nf(info.into)}</b> / ${nf(info.need)} XP</span><span>Niv. ${info.level+1} dans <span class="kh-num">${nf(info.toNext)}</span> XP</span></div>
      <div class="kr-lvl-bar" style="--was:${was}%;--gain:${gn}%"><span class="was"></span><span class="gain"></span></div></div>`;
  }
  const perks=[];
  const goal=g('dailyGoal')||10,today=typeof getTodayQ==='function'?getTodayQ():0;
  if(today>=goal)perks.push(['flag','Objectif du jour atteint',1]);
  if(R.mk==='annales')perks.push(['history_edu','Annale terminée',perks.length?0:1]);
  const st=g('stats');if(st&&st.streak>0)perks.push(['local_fire_department',`Série : ${st.streak} jour${st.streak>1?'s':''}`,0]);
  el.innerHTML=`<div class="kr-rewards">
      <div class="kr-reward"><div class="kq-sq t-amber"><span class="ms f">bolt</span></div><div><div class="kr-reward-val">+${nf(gain)}</div><div class="kr-reward-lbl">XP gagnée</div></div></div>
      <button type="button" class="kr-reward" onclick="showScreen('city')" title="Ouvrir Ma ville"><div class="kq-sq t-orange"><span class="ms f">toll</span></div><div><div class="kr-reward-val">+${nf(coins)} §</div><div class="kr-reward-lbl">pour Ma ville</div></div></button>
    </div>${lvl}${perks.length?`<div class="kr-perks">${perks.map(p=>`<span class="kq-badge${p[2]?' primary':''}"><span class="ms f">${p[0]}</span>${p[1]}</span>`).join('')}</div>`:''}`;
}

function collect(S,duration,extra){
  const mk=modeKey(S),ans=S.answers||[];
  const total=mk==='survie'?ans.length:S.qs.length;
  const right=S.correct||0,skipped=ans.filter(a=>a.skipped).length,wrongL=ans.map((a,i)=>Object.assign({n:i+1},a)).filter(a=>!a.correct&&!a.skipped);
  const byC={};
  ans.forEach(a=>{if(a.skipped)return;const id=a.q.courseId;(byC[id]=byC[id]||{ok:0,t:0}).t++;if(a.correct)byC[id].ok++;});
  const cs=g('courses')||[];
  const courses=Object.keys(byC).map(id=>{const c=cs.find(x=>x.id===id);return {name:c?c.name:'Cours',ok:byC[id].ok,t:byC[id].t};})
    .sort((a,b)=>a.ok/a.t-b.ok/b.t);
  const goal=g('dailyGoal')||10,today=typeof getTodayQ==='function'?getTodayQ():0;
  const blocks=window._blocks,cb=window._currentBlock;
  const nextBlock=blocks&&cb!==undefined&&cb<blocks.length-1?`Bloc suivant (${cb+2}/${blocks.length})`:'';
  const M=MODES[mk];
  return Object.assign({mk,total,right,wrong:wrongL.length,skipped,errors:wrongL,courses,
    time:typeof formatTime==='function'?formatTime(duration||0):'',
    sub:mk==='survie'?'Mode Survie · 3 vies':`${S.mode&&S.mode!==M.short?M.short+' · '+S.mode:M.short} · ${S.qs.length} question${S.qs.length>1?'s':''}`,
    goalDone:today>=goal,goalLeft:Math.max(0,goal-today),xp0:_xp0,nextBlock},extra||{});
}

window.khResults=function(act){
  const S=_last;
  if(act==='back'){if(S)session=S;if(typeof goBack==='function')goBack();session=null;return;}
  if(!S)return;
  if(act==='block'){if(typeof nextBlock==='function')nextBlock();return;}
  session=S;
  if(act==='retry'){
    if(S.isSurvival&&typeof retrySurvivalErr==='function'){retrySurvivalErr();return;}
    if(typeof retryErr==='function')retryErr();
  }else if(act==='again'){
    if(S.isSurvival){if(typeof startSurvival==='function')startSurvival();}
    else if(typeof restartS==='function')restartS();
  }
};

/* ================= Branchements ================= */
function wrap(name,after,before){
  const o=window[name];if(typeof o!=='function')return;
  window[name]=function(){
    let b;try{if(before)b=before.apply(this,arguments);}catch(e){console.warn('[quiz-cobalt]',name,e);}
    const r=o.apply(this,arguments);
    try{after(b,arguments);}catch(e){console.warn('[quiz-cobalt]',name,e);}
    return r;
  };
}
wrap('launchS',()=>{},()=>{_xp0=curXP();});
wrap('renderQ',()=>sync());
wrap('selAns',()=>{if(document.body.dataset.screen==='quiz'&&g('session')){sync();scrollToVerdict();}});
wrap('showResults',(b,args)=>{const S=g('session');if(!S)return;_last=S;buildResults(collect(S,args[0]));});
wrap('showSurvivalGameOver',prev=>{
  const S=g('session');if(!S)return;_last=S;
  const st=g('sessionStart');const dur=st?Math.floor((Date.now()-st)/1000):0;
  const R=collect(S,dur,{record:prev|0,newRecord:(S.correct||0)>(prev|0)});
  buildResults(R);
},()=>g('bestSurvivalStreak')|0);
})();
