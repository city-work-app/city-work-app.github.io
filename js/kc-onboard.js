/* =========================================================
   kc-onboard.js — v85 (21 nov. 2026)
   1. Bienvenue + visite guidée (kcOnboard) : à la première visite d'un nouvel utilisateur et juste après la création
      d'un compte (kcOnboardAfterSignup, appelé par social.js). Étapes :
        a) ce que fait City Work (ranger les cours faits avec l'IA, les transformer, réviser) ;
        b) « Tu étudies quoi ? » (kp_prof, 16 filières) + école / fac (kp_school) + année / promo (kp_promo) ;
        c) prénom (kp_firstname) + objectif du jour (dailyGoal) ;
        d) visite des rubriques : projecteur sur les vrais boutons du menu (ou de la barre du bas sur téléphone) ;
        e) « Par où commencer ? » (Atelier IA, import, Drive commun…).
      Fini / passé → kp_onb = 1. Revoir : Paramètres > Ma filière > « Revoir la visite guidée », ou kcTour().
   2. La filière adapte le site : exemples des fenêtres Nouvelle matière / Nouveau cours / Nouveau dossier,
      Imagerie cachée hors santé (html.kp-nonsante), texte de la carte Paramètres. Évènement 'kc-prof' (kc-extras.js).
   3. kcAvatarPayload() : personnage envoyé au serveur + filière / école / promo / vitrine (_f, _e, _y, _v) dans la
      colonne avatar (jsonb, déjà modifiable) → classement par filière / école sans changer la base.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const SS=(k,v)=>{try{if(v==null||v==='')localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}};
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};
const PROFS=()=>window.KC_PROFS||{};
const SANTE=/^(kine|med|dent|veto|inf|pharma|sf|psy)$/;
const prof=()=>{const p=LS('kp_prof','');return PROFS()[p]?p:'';};

/* ───────── Exemples par filière ───────── */
const EX={
  kine:['Neurologie','Le genou','Cours de M. Dupont'],med:['Cardiologie','Insuffisance cardiaque','Item 232'],dent:['Parodontologie','Les parodontites','TP de prothèse'],
  veto:['Pathologie canine','La parvovirose','Clinique des carnivores'],inf:['UE 2.11 Pharmacologie','Les anticoagulants','Semestre 3'],pharma:['Pharmacologie','Les antibiotiques','Chimie thérapeutique'],
  sf:['Obstétrique','La grossesse normale','Stage en salle de naissance'],psy:['Psychologie cognitive','La mémoire de travail','TD de statistiques'],
  droit:['Droit des obligations','La formation du contrat','TD de M. Martin'],prepa:['Physique','Mécanique du point','Colles de maths'],
  eco:['Microéconomie','L’offre et la demande','Marketing'],lettres:['Littérature française','Le roman au XIXe siècle','Grammaire anglaise'],
  sciences:['Biologie cellulaire','La mitose','Chimie organique'],info:['Algorithmique','Les algorithmes de tri','Bases de données'],
  lycee:['Mathématiques','Les suites','Spécialité SVT'],autre:['Ma matière','Chapitre 1','Mon prof']
};
window.kcFilExample=function(i){const e=EX[prof()]||EX.kine;return e[i||0];};
function applyFil(){
  const p=prof(),e=EX[p]||EX.kine,html=document.documentElement;
  html.classList.toggle('kp-nonsante',!!p&&!SANTE.test(p));
  html.dataset.prof=p||'';
  const set=(id,v)=>{const el=$(id);if(el)el.placeholder='ex : '+v;};
  set('nf-name',e[0]);set('nc-name',e[1]);set('nsf-name',e[2]);
  const d=document.querySelector('#kp-prof-grid')?.closest('.settings-card')?.querySelector('.settings-card-desc');
  if(d)d.textContent='Les exemples, les citations, l’IA, le Drive commun, le classement et ton métier dans « Ma ville » s’adaptent à ta filière.';
  settingsExtras();
}
document.addEventListener('kc-prof',()=>{applyFil();try{if(typeof socialPushProfile==='function')socialPushProfile();}catch(e){}});

/* Paramètres : école + promo + revoir la visite */
function settingsExtras(){
  const g=$('kp-prof-grid');if(!g||$('kob-set'))return;
  const w=document.createElement('div');w.id='kob-set';w.className='kob-set';
  w.innerHTML=`<label><span>École / fac</span><input class="fi" id="kob-set-school" maxlength="60" placeholder="ex : Université Lyon 3" value="${esc(LS('kp_school',''))}"></label>
    <label><span>Année / promo</span><input class="fi" id="kob-set-promo" maxlength="24" placeholder="ex : L1, K2, PASS" value="${esc(LS('kp_promo',''))}"></label>
    <button type="button" class="btn btn-g btn-sm" onclick="kcTour()"><span class="ms" style="font-size:16px">tour</span>Revoir la visite guidée</button>`;
  g.after(w);
  const save=()=>{SS('kp_school',($('kob-set-school').value||'').trim());SS('kp_promo',($('kob-set-promo').value||'').trim());
    try{if(typeof socialPushProfile==='function')socialPushProfile();}catch(e){}};
  w.addEventListener('change',save);
}

/* ───────── Profil envoyé au serveur ───────── */
window.kcAvatarPayload=function(){
  const ch=Object.assign({},(typeof gam!=='undefined'&&gam&&gam.char)||{});
  const f=prof(),e=LS('kp_school','').trim().slice(0,60),y=LS('kp_promo','').trim().slice(0,24);
  if(f)ch._f=f;if(e)ch._e=e;if(y)ch._y=y;
  try{const v=typeof window.kcVitrineData==='function'?window.kcVitrineData():null;if(v)ch._v=v;}catch(err){}
  return ch;
};
/* normalise un nom d'école pour comparer (« Université Lyon 3 » = « universite lyon3 ») */
window.kcSchoolKey=function(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\b(universite|univ|faculte|fac|ecole|de|du|des|la|le|l)\b/g,'').replace(/[^a-z0-9]/g,'');};

/* ───────── Bienvenue ───────── */
const O={step:0,el:null,after:false};
const GOALS=[10,20,35,50];
function welcomeHTML(){
  const s=O.step,P=PROFS(),cur=prof();
  const dots=`<div class="kob-dots">${[0,1,2].map(i=>`<i class="${i===s?'on':i<s?'done':''}"></i>`).join('')}</div>`;
  if(s===0)return `<div class="kob-hero"><div class="kob-logo"><span class="ms">location_city</span></div>
      <h1>${O.after?'Ton compte est prêt !':'Bienvenue sur City Work'}</h1>
      <p>Ton classeur de révision intelligent. Tu prépares tes cours avec <b>ChatGPT, Gemini, Claude</b>, tes PDF ou tes notes ?
      City Work les <b>regroupe au même endroit</b>, les <b>range</b> et les <b>transforme</b> en révisions.</p></div>
    <div class="kob-three">
      <div><span class="kob-n">1</span><span class="ms">folder_open</span><b>Rassemble tes cours</b><small>Tout au même endroit : matière → dossier → cours. Fini les cours éparpillés entre l’IA, les PDF et les captures.</small></div>
      <div><span class="kob-n">2</span><span class="ms">auto_awesome</span><b>Transforme-les avec l’IA</b><small>Un copier-coller avec l’Atelier IA (gratuit) : QCM, flashcards, fiche, carte mentale, cas pratiques.</small></div>
      <div><span class="kob-n">3</span><span class="ms">trending_up</span><b>Révise malin</b><small>Révision espacée, annales notées sur 20, planning avant l’examen… et ta ville grandit à chaque bonne réponse.</small></div>
    </div>
    <div class="kob-foot">${dots}<button class="btn btn-g" data-ob="skip">Passer</button><button class="btn btn-p" data-ob="next">C’est parti<span class="ms">arrow_forward</span></button></div>`;
  if(s===1){
    const grp=g=>Object.entries(P).filter(([k,v])=>v.g===g).map(([k,v])=>`<button type="button" class="kob-fil${cur===k?' on':''}" data-ob="fil" data-k="${k}"><span class="ms">${v.ic}</span>${esc(v.n)}</button>`).join('');
    return `<div class="kob-hd"><span class="kob-hic"><span class="ms">school</span></span><div><h2>Tu étudies quoi ?</h2><p>Les exemples, les citations, l’IA, le Drive commun, le classement et même ton métier dans « Ma ville » s’adaptent.</p></div></div>
      <div class="kob-grp">Santé</div><div class="kob-fils">${grp('sante')}</div>
      <div class="kob-grp">Autres études</div><div class="kob-fils">${grp('autre')}</div>
      <div class="kob-row2">
        <label><span>École / fac <em>facultatif</em></span><input class="fi" id="kob-school" maxlength="60" placeholder="ex : Université Lyon 3" value="${esc(LS('kp_school',''))}"></label>
        <label><span>Année / promo <em>facultatif</em></span><input class="fi" id="kob-promo" maxlength="24" placeholder="ex : L1, K2, PASS" value="${esc(LS('kp_promo',''))}"></label>
      </div>
      <small class="kob-hint"><span class="ms">info</span>Avec ton école, tu trouves les cours de ta promo dans le Drive commun et tu te compares aux étudiants de ta fac.</small>
      <div class="kob-foot">${dots}<button class="btn btn-g" data-ob="back">Retour</button><button class="btn btn-p" data-ob="next"${cur?'':' disabled'}>Continuer<span class="ms">arrow_forward</span></button></div>`;
  }
  const g=typeof dailyGoal!=='undefined'?dailyGoal:20;
  return `<div class="kob-hd"><span class="kob-hic"><span class="ms">waving_hand</span></span><div><h2>On fait connaissance</h2><p>Pour te saluer sur l’accueil et fixer ton rythme.</p></div></div>
    <label class="kob-one"><span>Ton prénom ou pseudo</span><input class="fi" id="kob-name" maxlength="40" placeholder="ex : Léa" value="${esc(LS('kp_firstname',''))}"></label>
    <div class="kob-grp">Combien de questions par jour ?</div>
    <div class="kob-goals">${GOALS.map(n=>`<button type="button" class="kob-goal${g===n?' on':''}" data-ob="goal" data-n="${n}"><b>${n}</b><small>${n<=10?'Tranquille':n<=20?'Régulier':n<=35?'Sérieux':'Intensif'}</small><em>≈ ${Math.round(n*.45)} min</em></button>`).join('')}</div>
    <small class="kob-hint"><span class="ms">event</span>Un examen bientôt ? Après la visite, entre sa date : City Work te fera un planning jour par jour.</small>
    <div class="kob-foot">${dots}<button class="btn btn-g" data-ob="back">Retour</button><button class="btn btn-p" data-ob="tour">Visiter le site<span class="ms">explore</span></button></div>`;
}
function renderW(){
  if(!O.el)return;
  O.el.querySelector('.kob-card').innerHTML=welcomeHTML();
  O.el.querySelector('.kob-card').classList.remove('kob-in');void O.el.offsetWidth;O.el.querySelector('.kob-card').classList.add('kob-in');
}
function saveInputs(){
  const sc=$('kob-school'),pr=$('kob-promo'),nm=$('kob-name');
  if(sc)SS('kp_school',sc.value.trim());
  if(pr)SS('kp_promo',pr.value.trim());
  if(nm&&nm.value.trim()){SS('kp_firstname',nm.value.trim());try{if(typeof loadIdentity==='function')loadIdentity();}catch(e){}}
}
function closeW(done){
  saveInputs();
  if(done)SS('kp_onb','1');
  if(O.el){const e=O.el;e.classList.remove('open');setTimeout(()=>e.remove(),220);O.el=null;}
  document.removeEventListener('keydown',keyW,true);
  try{if(typeof renderHome==='function')renderHome();}catch(e){}
  try{if(typeof socialPushProfile==='function')socialPushProfile();}catch(e){}
}
function keyW(e){if(e.key==='Escape'){e.stopPropagation();e.preventDefault();closeW(true);}}
window.kcOnboard=function(o){
  o=o||{};O.step=o.step||0;O.after=!!o.after;
  if(O.el)O.el.remove();
  const bg=document.createElement('div');bg.className='kob';bg.id='kob';
  bg.innerHTML='<div class="kob-card kob-in" role="dialog" aria-modal="true" aria-label="Bienvenue"></div>';
  document.body.appendChild(bg);O.el=bg;renderW();
  requestAnimationFrame(()=>bg.classList.add('open'));
  document.addEventListener('keydown',keyW,true);
  bg.addEventListener('click',e=>{
    const b=e.target.closest('[data-ob]');if(!b)return;
    const a=b.dataset.ob;
    if(a==='skip')closeW(true);
    else if(a==='next'){saveInputs();O.step=Math.min(2,O.step+1);renderW();}
    else if(a==='back'){saveInputs();O.step=Math.max(0,O.step-1);renderW();}
    else if(a==='fil'){saveInputs();if(typeof kcSetProf==='function')kcSetProf(b.dataset.k);else SS('kp_prof',b.dataset.k);renderW();}
    else if(a==='goal'){const n=+b.dataset.n;try{dailyGoal=n;if(typeof saveAll==='function')saveAll({quiet:true});}catch(err){}
      O.el.querySelectorAll('.kob-goal').forEach(x=>x.classList.toggle('on',x===b));}
    else if(a==='tour'){closeW(true);setTimeout(()=>kcTour(),260);}
  });
};
window.kcOnboardAfterSignup=function(){setTimeout(()=>window.kcOnboard({after:true,step:prof()?2:1}),500);};

/* ───────── Visite guidée (projecteur sur les vrais boutons) ───────── */
const TOUR=[
  {sel:['.dl-nav [data-nav="matieres-hub"]','#nav-home'],ic:'folder_open',t:'Mes matières',d:'Tous tes cours rangés : matière → dossier → cours. Chaque cours peut avoir ses QCM, sa fiche, ses flashcards et son PDF. Tu peux tout glisser-déposer pour réorganiser.'},
  {sel:['.dl-nav [data-nav="outils"]'],ic:'auto_awesome',t:'Atelier IA (dans Outils)',d:'Tu fais tes cours avec ChatGPT, Gemini ou Claude ? L’Atelier IA te donne la consigne parfaite à copier avec ton cours. Tu recolles la réponse : City Work la range toute seule en QCM, flashcards, fiche, carte mentale ou cas pratiques.'},
  {sel:['.dl-nav [data-nav="modes-hub"]','#nav-modes'],ic:'quiz',t:'Réviser',d:'QCM rapides, toutes les questions, les plus difficiles, mode survie, révision intelligente par l’IA… Choisis ta façon de réviser.'},
  {sel:['.dl-nav [data-nav="all-flashcards"]'],ic:'style',t:'Flashcards',d:'Recto / verso avec révision espacée : chaque carte revient juste avant que tu l’oublies. Tu peux y mettre des photos et les surligner.'},
  {sel:['.dl-nav [data-nav="annales-hub"]'],ic:'history_edu',t:'Annales',d:'Tes sujets d’examen en conditions réelles : chronomètre, pas de correction pendant l’épreuve, note sur 20 à la fin.'},
  {sel:['.dl-nav [data-nav="partiels"]','.dl-nav [data-nav="agenda"]','#nav-agenda'],ic:'event_upcoming',t:'Planning d’examen',d:'Entre la date de ton examen et ses matières : City Work te prépare un programme jour par jour (tes points faibles d’abord, révision générale les 3 derniers jours).'},
  {sel:['.dl-nav [data-nav="city"]','#nav-city'],ic:'location_city',t:'Ma ville',d:'Chaque bonne réponse rapporte des pièces pour construire ta ville. Ton métier (cabinet, tribunal, labo…) suit ta filière.'},
  {sel:['.dl-nav [data-nav="social"]','#nav-social'],ic:'groups',t:'Amis & communauté',d:'Classement de la semaine (par filière et par école), salles d’étude en direct avec un Pomodoro commun, et le Drive commun : les cours partagés par les étudiants.'},
  {sel:['#kc-mus-btn'],ic:'queue_music',t:'Ta musique',d:'Colle le lien de ta playlist Spotify, Apple Music, Deezer, YouTube ou SoundCloud : elle joue pendant que tu révises.'},
  {sel:['.kh-search'],ic:'search',t:'Rechercher',d:'Retrouve n’importe quelle question, cours ou matière. Raccourci : la touche /.'}
];
/* téléphone / petite fenêtre : pas de menu à gauche → visite de la barre du bas */
const TOUR_M=[
  {sel:['#nav-home'],ic:'home',t:'Accueil',d:'Ton tableau de bord : objectif du jour, révision du jour (ou ton planning d’examen), matières à renforcer et prochaines échéances.'},
  {sel:['#nav-modes'],ic:'quiz',t:'Réviser',d:'Tous les modes : QCM, flashcards, annales, mode survie… et dans Outils, l’Atelier IA : tu colles la réponse de ChatGPT, Gemini ou Claude et City Work range tout en QCM, flashcards ou fiche.'},
  {sel:['#nav-agenda'],ic:'event_upcoming',t:'Agenda & planning',d:'Ajoute tes examens : City Work te prépare un programme jour par jour, tes points faibles d’abord.'},
  {sel:['#nav-social'],ic:'groups',t:'Amis & communauté',d:'Classement par filière et par école, salles d’étude en direct avec Pomodoro commun, et le Drive commun : les cours partagés par les étudiants.'},
  {sel:['#nav-city'],ic:'location_city',t:'Ma ville',d:'Chaque bonne réponse fait grandir ta ville. Ton métier (cabinet, tribunal, labo…) suit ta filière.'},
  {sel:['#kc-mus-btn'],ic:'queue_music',t:'Ta musique',d:'Colle le lien de ta playlist Spotify, Apple Music, Deezer, YouTube ou SoundCloud : elle joue pendant que tu révises.'}
];
const T={i:-1,list:[],el:null};
function visible(el){if(!el)return false;const r=el.getBoundingClientRect();if(r.width<4||r.height<4)return false;if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)return false;const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.05;}
function target(st){for(const s of st.sel){const el=document.querySelector(s);if(visible(el))return el;}return null;}
function place(){
  if(!T.el)return;
  const st=T.list[T.i],spot=T.el.querySelector('.kob-spot'),tip=T.el.querySelector('.kob-tip');
  if(!st){/* écran final */
    T.el.classList.add('final');
    tip.className='kob-tip kob-final';tip.style.cssText='';
    tip.innerHTML=`<div class="kob-hd"><span class="kob-hic"><span class="ms">rocket_launch</span></span><div><h2>Par où commencer ?</h2><p>Choisis, tu pourras tout faire ensuite.</p></div></div>
      <div class="kob-start">
        <button data-go="atelier"><span class="ms">auto_awesome</span><b>Créer un cours avec l’IA</b><small>ChatGPT, Gemini, Claude… (copier-coller)</small></button>
        <button data-go="import"><span class="ms">upload_file</span><b>Importer mes QCM ou un PDF</b><small>Texte copié, PDF, fichier</small></button>
        <button data-go="apps"><span class="ms">move_to_inbox</span><b>Importer d’une autre appli</b><small>Anki, Quizlet, Knowt, Excel…</small></button>
        <button data-go="drive"><span class="ms">cloud</span><b>Explorer le Drive commun</b><small>Les cours partagés par les étudiants</small></button>
        <button data-go="exam"><span class="ms">event_upcoming</span><b>Préparer un examen</b><small>Un planning jour par jour</small></button>
        <button data-go="none"><span class="ms">explore</span><b>Je découvre seul</b><small>Tu peux revoir la visite dans Paramètres</small></button>
      </div>`;
    return;
  }
  T.el.classList.remove('final');
  const el=target(st);
  if(!el){T.list.splice(T.i,1);place();return;}
  const r=el.getBoundingClientRect(),pad=6;
  spot.style.cssText=`left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px;opacity:1`;
  const n=T.list.length;
  tip.className='kob-tip';
  tip.innerHTML=`<div class="kob-tip-h"><span class="kob-hic sm"><span class="ms">${st.ic}</span></span><b>${esc(st.t)}</b><span class="kob-cnt">${T.i+1} / ${n}</span></div>
    <p>${esc(st.d)}</p>
    <div class="kob-tip-f"><button class="kob-lnk" data-t="end">Passer la visite</button><span></span>${T.i?'<button class="btn btn-g btn-sm" data-t="prev">Retour</button>':''}<button class="btn btn-p btn-sm" data-t="next">${T.i===n-1?'Terminer':'Suivant'}</button></div>`;
  /* position de la bulle : à droite de l'élément, sinon dessous / dessus */
  const W=Math.min(340,innerWidth-24),tw=W;tip.style.width=W+'px';
  const th=tip.offsetHeight||170;
  let x,y;
  if(r.right+16+tw<innerWidth){x=r.right+16;y=Math.max(12,Math.min(innerHeight-th-12,r.top+r.height/2-th/2));}
  else if(r.left-16-tw>0){x=r.left-16-tw;y=Math.max(12,Math.min(innerHeight-th-12,r.top+r.height/2-th/2));}
  else{x=Math.max(12,Math.min(innerWidth-tw-12,r.left+r.width/2-tw/2));y=r.top-th-16>12?r.top-th-16:Math.min(innerHeight-th-12,r.bottom+16);}
  tip.style.left=x+'px';tip.style.top=y+'px';
}
function tourGo(d){T.i+=d;if(T.i<0)T.i=0;if(T.i>T.list.length)return tourEnd();place();}
function tourEnd(){
  if(T.el){const e=T.el;e.classList.remove('open');setTimeout(()=>e.remove(),220);T.el=null;}
  document.removeEventListener('keydown',tourKey,true);removeEventListener('resize',place);
  SS('kp_onb','1');SS('kp_onb_tour','1');
}
function tourKey(e){
  if(!T.el)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();tourEnd();}
  else if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();e.stopPropagation();if(T.i<T.list.length)tourGo(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();tourGo(-1);}
}
window.kcTour=function(){
  try{const d=$('kc-dlg');if(d)d.remove();}catch(e){}
  try{if(typeof showScreen==='function'&&document.body.dataset.screen!=='home')showScreen('home');}catch(e){}
  if(T.el)T.el.remove();
  T.list=(visible(document.querySelector('.dl-nav [data-nav="home"]'))?TOUR:TOUR_M).slice();T.i=0;
  const el=document.createElement('div');el.className='kob-tour';el.id='kob-tour';
  el.innerHTML='<div class="kob-block"></div><div class="kob-spot"></div><div class="kob-tip"></div>';
  document.body.appendChild(el);T.el=el;
  setTimeout(()=>{place();el.classList.add('open');},120);
  document.addEventListener('keydown',tourKey,true);addEventListener('resize',place);
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-t],[data-go]');if(!b)return;
    if(b.dataset.t==='next')tourGo(1);
    else if(b.dataset.t==='prev')tourGo(-1);
    else if(b.dataset.t==='end')tourEnd();
    else if(b.dataset.go){const g=b.dataset.go;tourEnd();setTimeout(()=>startFrom(g),240);}
  });
};
function startFrom(g){
  const call=(n,...a)=>{if(typeof window[n]==='function'){window[n](...a);return true;}return false;};
  if(g==='atelier')call('showScreen','atelier');
  else if(g==='import'){call('showScreen','matieres-hub');notify('Crée une matière puis un cours : le bouton « Importer » accepte tes QCM copiés et tes PDF','ok');}
  else if(g==='apps')call('kcImportOpen');
  else if(g==='drive')call('kcDriveOpen');
  else if(g==='exam'){if(!call('kcPlanOpen'))call('openExamManager');}
}

/* ───────── Démarrage ───────── */
/* nouveau = seulement le cours d'exemple « SDRC I » (data.js le crée pour tout le monde) et presque aucune réponse */
function isNewUser(){
  try{const C=typeof courses!=='undefined'?courses:[];if(C.some(c=>c.name!=='SDRC I'))return false;}catch(e){}
  try{if(typeof stats!=='undefined'&&(stats.totalAnswered||0)>15)return false;}catch(e){}
  return true;
}
function boot(){
  applyFil();
  if(LS('kp_onb','')!=='1'&&isNewUser()&&!/[?&]notour\b/.test(location.search)){
    setTimeout(()=>{if(!document.querySelector('.mdbg.open,#kc-dlg,#kob'))window.kcOnboard();},1400);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
/* les fenêtres sont parfois reconstruites : ré-appliquer les exemples à l'ouverture */
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[onclick*="openModal"],[data-action]'))setTimeout(applyFil,60);},true);
})();
