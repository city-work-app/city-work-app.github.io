/* =========================================================
   kc-voice.js — v85 (21 nov. 2026) : MODE AUDIO (le site lit à voix haute)
   Voix du navigateur (speechSynthesis), en français de préférence. Réglages kp_voice {voice, rate, wait, auto}.
   1. Quiz : bouton haut-parleur dans l'en-tête (#kv-qbtn) → lit chaque question et ses réponses (A, B, C…),
      puis la correction après ta réponse (pas pendant les annales).
   2. Mode écoute « mains libres » kcListen(source) : lit la question, laisse un temps pour réfléchir, donne la réponse
      et l'explication, puis passe à la suivante toute seule — pour réviser dans les transports ou en marchant.
      Sources : révision du jour / planning, questions difficiles, une matière, flashcards du jour (recto → verso).
      Lecteur #kv-pl (pause, précédent, suivant, vitesse, temps de réflexion). Touches de l'écran verrouillé (Media Session).
   3. Fiches : bouton « Écouter » sur la fiche d'un cours (#screen-fiche) → lit paragraphe par paragraphe (surligné).
   Entrées : carte « Mode audio » dans Outils (kcVoiceHub), bouton du quiz, bouton de la fiche.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};
function G(n,d){try{const v=eval(n);return v===undefined?d:v;}catch(e){return d;}}
const SY=window.speechSynthesis;
const L=['A','B','C','D','E','F','G','H'];
function cfg(){try{return Object.assign({voice:'',rate:1,wait:6,auto:false},JSON.parse(localStorage.getItem('kp_voice')||'{}'));}catch(e){return {voice:'',rate:1,wait:6,auto:false};}}
function setCfg(o){try{localStorage.setItem('kp_voice',JSON.stringify(Object.assign(cfg(),o)));}catch(e){}}
let VOICES=[];
function loadVoices(){if(!SY)return;VOICES=SY.getVoices()||[];}
if(SY){loadVoices();try{SY.addEventListener('voiceschanged',loadVoices);}catch(e){SY.onvoiceschanged=loadVoices;}}
function frVoices(){const v=VOICES.filter(x=>/^fr/i.test(x.lang));return v.length?v:VOICES;}
function pickVoice(){
  const c=cfg(),all=frVoices();
  return all.find(v=>v.name===c.voice)||all.find(v=>/google/i.test(v.name)&&/^fr/i.test(v.lang))||all.find(v=>/(Amélie|Thomas|Audrey|Aurélie|Marie|Denise|Henri|Julie)/i.test(v.name))||all.find(v=>/^fr-FR/i.test(v.lang))||all[0]||null;
}
/* langue d'un texte (fr / es / en) : les cours peuvent être en espagnol ou en anglais → voix adaptée */
function langOf(t){
  t=' '+String(t||'').toLowerCase()+' ';
  const n=re=>(t.match(re)||[]).length;
  const es=n(/[¿¡ñ]/g)*3+n(/\s(el|los|las|del|que|una|por|para|con|es|cuál|qué|según|son|como|más)\s/g);
  const en=n(/\s(the|and|of|is|which|what|with|for|are|this|that|from)\s/g);
  const fr=n(/\s(le|les|des|est|une|du|quelle|quel|pour|avec|dans|sont|qui|au|aux)\s/g)+n(/[àâçèêëîïôœùû]/g)*.5;
  return es>fr&&es>=en?'es':en>fr&&en>es?'en':'fr';
}
function voiceFor(lang){
  if(lang==='fr')return pickVoice();
  const L=VOICES.filter(v=>v.lang&&v.lang.toLowerCase().startsWith(lang));
  return L.find(v=>/google/i.test(v.name))||L.find(v=>v.localService)||L[0]||pickVoice();
}
/* texte propre à lire : sans HTML ni Markdown, flèches et symboles en mots */
function clean(t){
  const d=document.createElement('div');d.innerHTML=String(t||'');
  let s=(d.textContent||'').replace(/[#*_`>|~]+/g,' ').replace(/→|=>|->/g,' donne ').replace(/←/g,' vient de ').replace(/≥/g,' supérieur ou égal à ').replace(/≤/g,' inférieur ou égal à ')
    .replace(/\be\.g\./gi,'par exemple').replace(/\bcf\.\s*/gi,'voir ').replace(/\s+/g,' ').trim();
  return s;
}
/* lit une suite de morceaux ; renvoie une promesse (rejetée si on coupe) */
let TOKEN=0;
function speak(parts,o){
  o=o||{};
  if(!SY){notify('La lecture à voix haute n’est pas disponible dans ce navigateur','err');return Promise.reject('nosy');}
  const my=++TOKEN;SY.cancel();
  const list=(Array.isArray(parts)?parts:[parts]).map(clean).filter(Boolean);
  /* Chrome coupe les phrases trop longues : découpe vers 220 caractères */
  const chunks=[];list.forEach(p=>{let r=p;while(r.length>220){let k=r.lastIndexOf('. ',220);if(k<80)k=r.lastIndexOf(', ',220);if(k<80)k=r.lastIndexOf(' ',220);chunks.push(r.slice(0,k+1));r=r.slice(k+1);}if(r.trim())chunks.push(r);});
  return new Promise((res,rej)=>{
    let i=0;const v=pickVoice(),rate=o.rate||cfg().rate;
    const next=()=>{
      if(my!==TOKEN){rej('stop');return;}
      if(i>=chunks.length){res();return;}
      const txt=chunks[i++],lg=o.lang||langOf(txt),vv=lg==='fr'?v:voiceFor(lg);
      const u=new SpeechSynthesisUtterance(txt);u.lang=vv?vv.lang:(lg==='es'?'es-ES':lg==='en'?'en-US':'fr-FR');if(vv)u.voice=vv;u.rate=rate;
      u.onend=()=>setTimeout(next,90);u.onerror=e=>{if(my!==TOKEN||e.error==='interrupted'||e.error==='canceled')rej('stop');else setTimeout(next,60);};
      SY.speak(u);
    };
    next();
  });
}
const WORDS={fr:['Question','Réponse','Exact !','Non. La bonne réponse était'],es:['Pregunta','Respuesta','¡Correcto!','No. La respuesta correcta era'],en:['Question','Answer','Correct!','No. The right answer was']};
function stopSpeak(){TOKEN++;if(SY)SY.cancel();}
window.kcSpeak=speak;window.kcSpeakStop=stopSpeak;

/* ───────── 1. Quiz lu à voix haute ───────── */
function quizBtn(){
  const t=document.querySelector('#screen-quiz .kq-tools');if(!t||$('kv-qbtn'))return;
  const b=document.createElement('button');b.id='kv-qbtn';b.type='button';b.className='kq-ib';b.title='Lire les questions à voix haute';b.setAttribute('aria-label','Lecture à voix haute');
  b.innerHTML='<span class="ms">volume_off</span>';
  b.onclick=()=>{const on=!cfg().auto;setCfg({auto:on});syncQ();if(on)readQ();else stopSpeak();notify(on?'Lecture à voix haute activée':'Lecture à voix haute coupée','ok');};
  t.insertBefore(b,t.firstChild.nextSibling);syncQ();
}
function syncQ(){const b=$('kv-qbtn');if(!b)return;const on=cfg().auto;b.classList.toggle('on',on);b.querySelector('.ms').textContent=on?'volume_up':'volume_off';}
function readQ(){
  if(!cfg().auto||document.body.dataset.screen!=='quiz')return;
  const q=$('qq'),opts=[...document.querySelectorAll('#qopts .ob')];if(!q)return;
  const parts=[q.textContent];opts.forEach((o,i)=>{const t=o.querySelector('.otxt');parts.push(L[i]+' : '+(t?t.textContent:o.textContent));});
  speak(parts,{lang:langOf(q.textContent)}).catch(()=>{});
}
(function hookQ(){
  const R=window.renderQ,S=window.selAns;
  if(typeof R!=='function'||typeof S!=='function'){setTimeout(hookQ,400);return;}
  if(R._kv)return;
  const r=function(){const x=R.apply(this,arguments);quizBtn();setTimeout(readQ,350);return x;};r._kv=true;window.renderQ=r;
  const s=function(j,oi){
    const x=S.apply(this,arguments);
    try{const ses=G('session',null);
      if(cfg().auto&&ses&&!ses.isAnnales){const q=ses.qs[ses.cur],ok=oi===q.correct;
        const map=($('qopts')||{})._map||[],di=map.indexOf(q.correct);
        const lg=langOf(q.question),W=WORDS[lg];speak([ok?W[2]:W[3]+' '+(di>=0?L[di]+' : ':'')+q.answers[q.correct]+'.',q.expl||''],{lang:lg}).catch(()=>{});}}catch(e){}
    return x;};s._kv=true;window.selAns=s;
})();
new MutationObserver(()=>{if(document.body.dataset.screen!=='quiz'&&!LST.on&&!FI.on)stopSpeak();else if(document.body.dataset.screen==='quiz')quizBtn();}).observe(document.body,{attributes:true,attributeFilter:['data-screen']});

/* ───────── 2. Mode écoute mains libres ───────── */
const LST={on:false,items:[],i:0,paused:false,phase:'',title:'',timer:0,cd:0};
function srcItems(k){
  const Q=G('questions',[])||[],boy=id=>typeof isBoycotted==='function'&&isBoycotted(id);
  const toQ=qs=>qs.filter(q=>q&&!boy(q.id)&&Array.isArray(q.answers)).map(q=>({kind:'q',q}));
  if(k==='daily'){const qs=typeof window.kcDailySRS==='function'?window.kcDailySRS(20):[];return toQ(qs.length?qs:shuf(Q.slice()).slice(0,20));}
  if(k==='hard'){const gd=typeof getDiff==='function'?getDiff:()=>'new';return toQ(shuf(Q.filter(q=>gd(q.id)==='hard'||gd(q.id)==='medium')).slice(0,40));}
  if(k.startsWith('f:')){const fid=k.slice(2),cs=new Set((G('courses',[])||[]).filter(c=>c.folderId===fid).map(c=>c.id));return toQ(shuf(Q.filter(q=>cs.has(q.courseId))).slice(0,60));}
  if(k==='fc'){const C=(G('concepts',[])||[]).filter(c=>c.term&&c.definition);
    const due=C.filter(c=>!c.nextReview||Date.parse(c.nextReview)<=Date.now());return shuf((due.length?due:C).slice()).slice(0,30).map(c=>({kind:'fc',c}));}
  return [];
}
function shuf(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function plHTML(){
  const it=LST.items[LST.i],c=cfg();
  let main='';
  if(it&&it.kind==='q'){const q=it.q,rev=LST.phase==='ans'||LST.phase==='done';
    main=`<div class="kv-q">${esc(clean(q.question))}</div><ol class="kv-a">${q.answers.map((a,i)=>`<li class="${rev&&i===q.correct?'ok':''}"><b>${L[i]}</b>${esc(clean(a))}</li>`).join('')}</ol>${rev&&q.expl?`<div class="kv-ex"><span class="ms">lightbulb</span>${esc(clean(q.expl))}</div>`:''}`;}
  else if(it){const k=it.c,rev=LST.phase==='ans'||LST.phase==='done';main=`<div class="kv-q">${esc(clean(k.termHtml||k.term))}</div>${rev?`<div class="kv-ex fc">${esc(clean(k.defHtml||k.definition))}</div>`:''}`;}
  return `<div class="kv-h"><span class="kv-hic"><span class="ms">headphones</span></span><div><b>${esc(LST.title)}</b><small>${LST.items.length?`${LST.i+1} / ${LST.items.length}`:''} · ${LST.phase==='think'?'À toi de réfléchir… '+LST.cd+' s':LST.phase==='ans'?'Réponse':LST.paused?'En pause':'Lecture'}</small></div><button type="button" data-v="close" aria-label="Fermer"><span class="ms">close</span></button></div>
    <div class="kv-prog"><i style="width:${LST.items.length?((LST.i+(LST.phase==='ans'?1:.5))/LST.items.length*100):0}%"></i></div>
    <div class="kv-body">${main}</div>
    <div class="kv-ctl">
      <button type="button" data-v="prev" title="Précédente"><span class="ms">skip_previous</span></button>
      <button type="button" class="kv-big" data-v="pp" title="Pause / lecture (Espace)"><span class="ms f">${LST.paused?'play_arrow':'pause'}</span></button>
      <button type="button" data-v="next" title="Suivante"><span class="ms">skip_next</span></button>
    </div>
    <div class="kv-set">
      <label><span class="ms">speed</span><select data-s="rate">${[.8,.9,1,1.1,1.25,1.5].map(r=>`<option value="${r}"${+c.rate===r?' selected':''}>×${String(r).replace('.',',')}</option>`).join('')}</select></label>
      <label><span class="ms">hourglass_top</span><select data-s="wait">${[3,6,10,15].map(w=>`<option value="${w}"${+c.wait===w?' selected':''}>${w} s pour réfléchir</option>`).join('')}</select></label>
      <label class="kv-vc"><span class="ms">record_voice_over</span><select data-s="voice">${frVoices().map(v=>`<option value="${esc(v.name)}"${pickVoice()&&pickVoice().name===v.name?' selected':''}>${esc(v.name.replace(/\s*\(.*\)/,''))}</option>`).join('')||'<option>Voix du système</option>'}</select></label>
    </div>`;
}
function plRender(){const p=$('kv-pl');if(p)p.querySelector('.kv-in').innerHTML=plHTML();}
async function plRun(){
  const my=++LST.run;
  while(LST.on&&LST.i<LST.items.length){
    if(LST.paused){plRender();return;}
    const it=LST.items[LST.i];
    try{
      LST.phase='read';plRender();
      const lg=it.kind==='q'?langOf(it.q.question):langOf(it.c.term),W=WORDS[lg];
      if(it.kind==='q')await speak([W[0]+' '+(LST.i+1)+'.',it.q.question].concat(it.q.answers.map((a,i)=>L[i]+' : '+a)),{lang:lg});
      else await speak([it.c.termHtml||it.c.term],{lang:lg});
      if(my!==LST.run)return;
      LST.phase='think';
      for(LST.cd=cfg().wait;LST.cd>0;LST.cd--){plRender();await new Promise(r=>LST.timer=setTimeout(r,1000));if(my!==LST.run||LST.paused)return plRender();}
      LST.phase='ans';plRender();
      if(it.kind==='q')await speak([W[1]+' '+L[it.q.correct]+' : '+it.q.answers[it.q.correct]+'.',it.q.expl||''],{lang:lg});
      else await speak([it.c.defHtml||it.c.definition],{lang:langOf(it.c.definition)});
      if(my!==LST.run)return;
      await new Promise(r=>LST.timer=setTimeout(r,900));
      if(my!==LST.run)return;
      LST.i++;
    }catch(e){return;}
  }
  if(LST.on&&LST.i>=LST.items.length){LST.phase='done';LST.i=LST.items.length-1;plRender();speak(['C’est fini, bravo !']).catch(()=>{});LST.paused=true;plRender();}
}
LST.run=0;
function plGo(d){clearTimeout(LST.timer);stopSpeak();LST.run++;LST.i=Math.max(0,Math.min(LST.items.length-1,LST.i+d));LST.paused=false;LST.phase='';plRun();}
function plClose(){LST.on=false;LST.run++;clearTimeout(LST.timer);stopSpeak();const p=$('kv-pl');if(p){p.classList.remove('open');setTimeout(()=>p.remove(),200);}document.removeEventListener('keydown',plKey,true);
  try{if(navigator.mediaSession)navigator.mediaSession.metadata=null;}catch(e){}}
function plKey(e){
  if(!LST.on||e.target.closest&&e.target.closest('select,input,textarea'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();plClose();}
  else if(e.key===' '){e.preventDefault();e.stopPropagation();toggle();}
  else if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();plGo(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();plGo(-1);}
}
function toggle(){if(LST.paused){LST.paused=false;if(LST.phase==='done'){LST.i=0;}LST.phase='';plRun();}else{LST.paused=true;LST.run++;clearTimeout(LST.timer);stopSpeak();plRender();}}
window.kcListen=function(k,title){
  const items=Array.isArray(k)?k:srcItems(k);
  if(!items.length){notify(k==='fc'?'Aucune flashcard à écouter':'Aucune question à écouter ici','err');return;}
  if(!SY){notify('La lecture à voix haute n’est pas disponible dans ce navigateur','err');return;}
  try{const d=$('kc-dlg');if(d)d.remove();}catch(e){}
  Object.assign(LST,{on:true,items,i:0,paused:false,phase:'',title:title||'Mode écoute'});
  let p=$('kv-pl');if(p)p.remove();
  p=document.createElement('div');p.id='kv-pl';p.className='kv-pl';p.innerHTML='<div class="kv-in" role="dialog" aria-label="Mode écoute"></div>';
  document.body.appendChild(p);requestAnimationFrame(()=>p.classList.add('open'));
  p.addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;const v=b.dataset.v;
    if(v==='close')plClose();else if(v==='pp')toggle();else if(v==='next')plGo(1);else if(v==='prev')plGo(-1);});
  p.addEventListener('change',e=>{const s=e.target.dataset.s;if(!s)return;setCfg({[s]:s==='voice'?e.target.value:+e.target.value});});
  document.addEventListener('keydown',plKey,true);
  try{if(navigator.mediaSession){navigator.mediaSession.metadata=new MediaMetadata({title:LST.title,artist:'City Work · mode écoute'});
    navigator.mediaSession.setActionHandler('play',()=>{if(LST.paused)toggle();});navigator.mediaSession.setActionHandler('pause',()=>{if(!LST.paused)toggle();});
    navigator.mediaSession.setActionHandler('nexttrack',()=>plGo(1));navigator.mediaSession.setActionHandler('previoustrack',()=>plGo(-1));}}catch(e){}
  plRun();
};
/* Choix de la source */
window.kcVoiceHub=function(){
  if(typeof window.kcDlg!=='function')return;
  const F=(G('folders',[])||[]).filter(f=>f.type!=='annales'&&!(typeof isFolderArchived==='function'&&isFolderArchived(f.id)));
  const pl=typeof window.kcPlanLabel==='function'?window.kcPlanLabel():null;
  window.kcDlg({title:'Mode audio',sub:'Le site te lit tes questions et tes fiches : idéal dans les transports ou en marchant',icon:'headphones',foot:false,
    body:`<div class="kv-hub">
      <button data-src="daily"><span class="ms">${pl?'event_upcoming':'my_location'}</span><b>${pl?'Mon planning du jour':'Ma révision du jour'}</b><small>Question, temps pour réfléchir, puis la réponse et l’explication</small></button>
      <button data-src="hard"><span class="ms">local_fire_department</span><b>Mes questions difficiles</b><small>Celles où tu te trompes le plus</small></button>
      <button data-src="fc"><span class="ms">style</span><b>Flashcards du jour</b><small>Le recto, une pause, puis le verso</small></button>
      <button data-src="fiche"><span class="ms">description</span><b>Écouter une fiche</b><small>Ouvre la fiche d’un cours puis « Écouter »</small></button>
    </div>
    ${F.length?`<div class="kv-hub-l">Une matière</div><div class="kv-hub-f">${F.map(f=>`<button data-src="f:${esc(f.id)}"><i style="background:${esc(f.color||'var(--kc-primary)')}"></i>${esc(f.name)}</button>`).join('')}</div>`:''}
    <div class="kv-hub-l">Pendant un quiz</div><p class="kv-hub-p"><span class="ms">volume_up</span>Le bouton haut-parleur en haut du quiz lit chaque question et ses réponses, puis la correction.</p>`,
    onOpen:bg=>bg.addEventListener('click',e=>{const b=e.target.closest('[data-src]');if(!b)return;const s=b.dataset.src;
      if(s==='fiche'){bg.remove();if(typeof showScreen==='function')showScreen('matieres-hub');notify('Ouvre un cours, puis sa fiche : le bouton « Écouter » est en haut','ok');return;}
      const f=s.startsWith('f:')?F.find(x=>x.id===s.slice(2)):null;
      window.kcListen(s,s==='daily'?(pl?'Planning du jour':'Révision du jour'):s==='hard'?'Questions difficiles':s==='fc'?'Flashcards du jour':f?f.name:'Mode écoute');})});
};

/* ───────── 3. Fiches ───────── */
const FI={on:false,els:[],i:0};
function ficheBtn(){
  const bar=document.querySelector('#screen-fiche .fr');if(!bar||$('kv-fbtn'))return;
  const b=document.createElement('button');b.id='kv-fbtn';b.className='btn btn-sm btn-g';b.type='button';
  b.innerHTML='<span class="ms" style="font-size:15px">headphones</span> Écouter';b.onclick=()=>FI.on?ficheStop():ficheRead();
  bar.insertBefore(b,bar.firstChild);
}
function ficheStop(){FI.on=false;stopSpeak();document.querySelectorAll('#fiche-view .kv-reading').forEach(x=>x.classList.remove('kv-reading'));
  const b=$('kv-fbtn');if(b)b.innerHTML='<span class="ms" style="font-size:15px">headphones</span> Écouter';}
async function ficheRead(){
  const v=$('fiche-view');if(!v||!v.textContent.trim()){notify('Cette fiche est vide','err');return;}
  FI.els=[...v.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,td')].filter(e=>e.textContent.trim()&&!e.querySelector('p,li'));
  if(!FI.els.length)FI.els=[v];
  FI.on=true;const b=$('kv-fbtn');if(b)b.innerHTML='<span class="ms" style="font-size:15px">stop_circle</span> Arrêter';
  for(FI.i=0;FI.i<FI.els.length&&FI.on;FI.i++){
    const e=FI.els[FI.i];document.querySelectorAll('#fiche-view .kv-reading').forEach(x=>x.classList.remove('kv-reading'));
    e.classList.add('kv-reading');e.scrollIntoView({block:'center',behavior:'smooth'});
    try{await speak([e.textContent]);}catch(err){break;}
  }
  ficheStop();
}
new MutationObserver(()=>{if(document.body.dataset.screen==='fiche')ficheBtn();else if(FI.on)ficheStop();}).observe(document.body,{attributes:true,attributeFilter:['data-screen']});

/* Carte dans Outils */
function hubCard(){
  const g=document.querySelector('#screen-outils .hub-grid');if(!g||$('kv-hubcard'))return;
  const b=document.createElement('button');b.className='hub-card';b.id='kv-hubcard';b.setAttribute('aria-label','Mode audio');b.onclick=()=>window.kcVoiceHub();
  b.innerHTML='<div class="hub-card-icon" style="background:linear-gradient(135deg,#0ea5e9,#6366f1)"><span class="ms">headphones</span></div><div class="hub-card-body"><div class="hub-card-name">Mode audio <span class="kia-new">Nouveau</span></div><div class="hub-card-desc">Le site te lit tes questions, flashcards et fiches à voix haute : révise dans les transports ou en marchant</div></div>';
  g.appendChild(b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hubCard);else hubCard();
})();
