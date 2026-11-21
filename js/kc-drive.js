/* =========================================================
   kc-drive.js — « Drive commun » (20 nov. 2026, v75)
   Tous les cours partagés en « Public » par les étudiants City Work, consultables par tout le monde
   (même sans compte) : recherche, filtres par matière, tri (récents / populaires / plus de questions),
   aperçu puis import en un clic (réutilise socialOpenCourse / socialImportCourse de social.js).
   - Serveur : supabase/drive.sql (RPC list_public_courses, list_public_subjects, get_public_course,
     note_public_import). Sans ce script, le drive affiche « pas encore activé ».
   - Entrées : kcDriveOpen() — bouton « Drive commun » de Mes matières, des fenêtres Nouvelle matière /
     Nouveau cours, de l'écran vide et de l'onglet Cours partagés (Amis).
   - Publier : socialOpenShare() avec « Public » coché (kcDriveShare).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const D={school:false,v3:null,q:'',subj:'',sort:'recent',list:null,subjects:null,off:0,more:false,err:'',loading:false,seq:0,cat:(()=>{try{return localStorage.getItem('kdr_cat')||'';}catch(e){return '';}})(),v2:null,peek:{},open:null};
/* v84 (21 nov. 2026) : rubriques (Kiné, Véto, Médecine, Dentaire, Autres) + aperçu des questions directement dans la carte.
   Serveur à jour (supabase/drive2.sql) → rubrique et 3 premières questions renvoyées par list_public_courses(p_cat) ;
   sinon, ancienne fonction et rubrique devinée d'après le titre et la matière. */
/* v85 : toutes les filières (KC_PROFS de kc-extras.js), la mienne en premier ; « Mon école » (payload.school, drive3.sql) */
const CATS=[['','Tout','apps']];
function buildCats(){
  const P=window.KC_PROFS||{kine:{n:'Kiné',ic:'accessibility_new'},veto:{n:'Véto',ic:'pets'},med:{n:'Médecine',ic:'stethoscope'},dent:{n:'Dentaire',ic:'dentistry'}};
  let me='';try{me=(localStorage.getItem('kp_prof')||'').replace(/"/g,'');}catch(e){}
  const keys=Object.keys(P).filter(k=>k!=='autre');keys.sort((a,b)=>(b===me)-(a===me));
  CATS.length=0;CATS.push(['','Tout','apps']);keys.forEach(k=>CATS.push([k,k==='veto'?'Véto':P[k].n,P[k].ic]));CATS.push(['other','Autres','category']);
}
buildCats();document.addEventListener('kc-prof',buildCats);
const mySchool=()=>{try{return (localStorage.getItem('kp_school')||'').trim();}catch(e){return '';}};
const sk=s=>typeof kcSchoolKey==='function'?kcSchoolKey(s):String(s||'').toLowerCase();
function catOf(c){
  if(c.cat&&CATS.some(x=>x[0]===c.cat))return c.cat;
  const t=((c.title||'')+' '+(c.subject||'')).toLowerCase();
  if(/\bdroit\b|juridi|contrat|p[ée]nal|constitution|obligations|jurisprud/.test(t))return 'droit';
  if(/informati|algorithm|python|java\b|programm|r[ée]seau|base de donn/.test(t))return 'info';
  if(/[ée]conomi|gestion|marketing|comptab|finance|management/.test(t))return 'eco';
  if(/infirmi|ifsi/.test(t))return 'inf';
  if(/pharmac(?!o)/.test(t))return 'pharma';
  if(/psycho/.test(t))return 'psy';
  if(/v[ée]t[ée]?r|canin|f[ée]lin|bovin|[ée]quin|porcin|chien|chat\b|animal|zoo/.test(t))return 'veto';
  if(/dent|odonto|parodont|endodont|orthodont|prothèse dentaire/.test(t))return 'dent';
  if(/kin[ée]|fisio|physio|r[ée][ée]duc|massage|ppg|amq|biom[ée]ca|\bmk\b|ost[ée]o|electroth|électroth|ergonom/.test(t))return 'kine';
  if(/m[ée]decine|cardio|pneumo|n[ée]phro|h[ée]mato|ecn|edn|s[ée]miolog|pharmaco|immuno|p[ée]diatr|chirurg|urgence/.test(t))return 'med';
  return 'other';
}
const SORTS=[['recent','Récents','schedule'],['popular','Populaires','trending_up'],['big','Plus de questions','format_list_numbered']];

function modal(){
  let m=$('modal-drive');if(m)return m;
  m=document.createElement('div');m.className='mdbg';m.id='modal-drive';
  m.addEventListener('click',e=>{if(e.target===m)close();});
  m.innerHTML='<div class="md kdr" role="dialog" aria-label="Drive commun"><div id="kdr-body"></div></div>';
  const ref=$('modal-soc-course');   /* avant l'aperçu d'un cours, pour que l'aperçu s'affiche par-dessus */
  if(ref&&ref.parentNode)ref.parentNode.insertBefore(m,ref);else document.body.appendChild(m);
  return m;
}
function close(){const m=$('modal-drive');if(m)m.classList.remove('open');document.removeEventListener('keydown',onKey,true);}
function onKey(e){if(e.key!=='Escape')return;const p=$('modal-soc-course');if(p&&p.classList.contains('open'))return;if($('modal-drive')?.classList.contains('open')){e.stopPropagation();close();}}

function mineIds(){
  const s=new Set();
  try{(typeof courses!=='undefined'?courses:[]).forEach(x=>x.sharedFrom&&s.add(x.sharedFrom));
    (typeof subFolders!=='undefined'?subFolders:[]).forEach(x=>x.sharedFrom&&s.add(x.sharedFrom));
    (typeof folders!=='undefined'?folders:[]).forEach(x=>x.sharedFrom&&s.add(x.sharedFrom));}catch(e){}
  return s;
}
function ago(iso){const t=Date.parse(iso);if(!t)return '';const d=Math.floor((Date.now()-t)/864e5);
  if(d<=0)return 'aujourd’hui';if(d===1)return 'hier';if(d<30)return `il y a ${d} j`;const mo=Math.floor(d/30);return mo<12?`il y a ${mo} mois`:`il y a ${Math.floor(mo/12)} an${mo>=24?'s':''}`;}
function name(p){return (p&&(p.display_name||p.username))||'Anonyme';}
function av(p){try{return typeof gamAvatarSVG==='function'?gamAvatarSVG(p&&p.avatar,22):'';}catch(e){return '';}}

function cardHTML(c,mine){
  const kind=c.kind||'course',ic=kind==='subject'?'school':kind==='folder'?'folder':'menu_book';
  const stats=[kind!=='course'&&c.course_count?`${c.course_count} cours`:'',`${c.question_count||0} question${(c.question_count||0)>1?'s':''}`,c.flash_count?`${c.flash_count} flashcard${c.flash_count>1?'s':''}`:'',c.has_fiche?'fiche':''].filter(Boolean).join(' · ');
  const ct=CATS.find(x=>x[0]===catOf(c)),pk=D.peek[c.id],op=D.open===c.id,pv=Array.isArray(c.preview)?c.preview:null;
  return `<div class="kdr-card${op?' open':''}" role="button" tabindex="0" data-kdr="open" data-id="${esc(c.id)}">
    <span class="kdr-ic k-${kind}"><span class="ms">${ic}</span></span>
    <span class="kdr-tx"><b>${esc(c.title)}</b>
      <span class="kdr-tags">${ct&&ct[0]!=='other'?`<span class="kdr-cat c-${ct[0]}"><span class="ms">${ct[2]}</span>${ct[1]}</span>`:''}${c.subject?`<span class="kdr-sub">${esc(c.subject)}</span>`:''}${c.school?`<span class="kdr-sub kdr-sch"><span class="ms">apartment</span>${esc(c.school)}${c.year?' · '+esc(c.year):''}</span>`:''}</span>
      <small>${stats}</small>
      <span class="kdr-by">${av(c.owner)}<span>${esc(name(c.owner))}</span><em>${ago(c.updated_at)}</em></span></span>
    <span class="kdr-side">${mine?'<span class="kdr-have"><span class="ms">check_circle</span>Déjà chez toi</span>':''}
      <span class="kdr-imp" title="Nombre d’étudiants qui l’ont importé"><span class="ms">download</span>${c.import_count|0}</span></span>
    ${(c.question_count|0)>0?`<button type="button" class="kdr-peekb" data-kdr="peek" data-id="${esc(c.id)}" aria-expanded="${op}"><span class="ms">${op?'expand_less':'visibility'}</span>${op?'Masquer les questions':'Voir les questions'}</button>`:''}
    ${op?`<div class="kdr-peek">${pk==='load'?'<div class="kdr-pl"><div class="house-spinner"></div></div>':pk&&pk.err?`<small class="kdr-pe">${esc(pk.err)}</small>`:pk?peekHTML(pk):pv?peekHTML({qs:pv,n:c.question_count}):''}</div>`:''}
  </div>`;
}
function peekHTML(P){
  const qs=P.qs||[];
  return `<ol class="kdr-ql">${qs.slice(0,8).map(q=>`<li><b>${esc(String(q.question||q.q||'').slice(0,200))}</b>${Array.isArray(q.answers)?`<span>${q.answers.slice(0,6).map((a,i)=>`<i class="${i===q.correct?'ok':''}">${String.fromCharCode(65+i)}. ${esc(String(a).slice(0,70))}</i>`).join('')}</span>`:''}</li>`).join('')}</ol>`
    +((P.n||qs.length)>8?`<small class="kdr-qm">… et ${(P.n||qs.length)-8} autre${(P.n||qs.length)-8>1?'s':''} question${(P.n||qs.length)-8>1?'s':''}</small>`:'')
    +(P.fc?`<small class="kdr-qm"><span class="ms">style</span>${P.fc} flashcard${P.fc>1?'s':''} incluse${P.fc>1?'s':''}</small>`:'');
}
async function peek(id){
  if(D.open===id){D.open=null;render();return;}D.open=id;
  if(D.peek[id]&&D.peek[id]!=='load'){render();return;}
  D.peek[id]='load';render();
  try{await ready();const c=await _rpc('get_public_course',{p_id:id});const p=(c&&c.payload)||{};
    const fc=Array.isArray(p.courses)?p.courses.reduce((n,x)=>n+((x.flashcards||[]).length),0):(p.flashcards||[]).length;
    D.peek[id]={qs:p.questions||[],n:(p.questions||[]).length,fc};}
  catch(e){D.peek[id]={err:'Aperçu indisponible.'};}
  render();
}
function bodyHTML(){
  const mine=mineIds();
  let list;
  if(D.err)list=`<div class="kdr-empty"><span class="ms">cloud_off</span><b>${esc(D.err)}</b>${D.errHint?`<small>${D.errHint}</small>`:''}</div>`;
  else if(!D.list)list='<div class="kdr-empty"><div class="house-spinner"></div></div>';
  else if(!D.list.length)list=`<div class="kdr-empty"><span class="ms">travel_explore</span><b>${D.q||D.subj?'Aucun cours ne correspond.':'Le drive est encore vide.'}</b><small>${D.q||D.subj?'Essaie un autre mot ou une autre matière.':'Sois le premier : partage un cours en « Public » et tous les étudiants pourront le récupérer.'}</small></div>`;
  else{let L=D.cat&&!D.v2?D.list.filter(c=>catOf(c)===D.cat):D.list;
    if(D.school&&!D.v3){const k=sk(mySchool());L=L.filter(c=>c.school&&sk(c.school)===k);}
    list=L.length?`<div class="kdr-grid">${L.map(c=>cardHTML(c,mine.has(c.id))).join('')}</div>`:`<div class="kdr-empty"><span class="ms">travel_explore</span><b>Rien dans cette rubrique pour l’instant.</b><small>Partage tes cours en « Public » pour la remplir !</small></div>`;}
  if(D.list&&D.list.length&&!D.err)list+=(D.more?`<button type="button" class="btn btn-g kdr-more" data-kdr="more"${D.loading?' disabled':''}>${D.loading?'Chargement…':'Voir plus de cours'}</button>`:'');
  const subs=D.subjects||[];
  return `<div class="kdr-h">
      <span class="kdr-hic"><span class="ms">cloud</span></span>
      <div class="kdr-ht"><div class="mdttl">Drive commun</div><div class="mddesc">Les cours publics de tous les étudiants City Work. Aperçu, puis import en un clic dans tes matières.</div></div>
      <button type="button" class="kdr-x" data-kdr="close" aria-label="Fermer"><span class="ms">close</span></button>
    </div>
    <div class="kdr-bar">
      <label class="kdr-search"><span class="ms">search</span><input type="search" id="kdr-q" placeholder="Chercher un cours, une matière…" value="${esc(D.q)}" autocomplete="off" spellcheck="false"></label>
      <div class="kdr-sort" role="group" aria-label="Trier">${SORTS.map(([k,n,ic])=>`<button type="button" class="${D.sort===k?'on':''}" data-kdr="sort" data-k="${k}"><span class="ms">${ic}</span>${n}</button>`).join('')}</div>
    </div>
    <div class="kdr-cats" role="tablist" aria-label="Rubriques"><button type="button" class="kdr-catb kdr-school${D.school?' on':''}" data-kdr="school" title="${mySchool()?'Seulement les cours de '+esc(mySchool()):'Indique ton école'}"><span class="ms">apartment</span>${mySchool()?'Mon école':'Mon école ?'}</button>${CATS.map(([k,n,ic])=>{const cnt=D.list&&!D.v2?(k?D.list.filter(c=>catOf(c)===k).length:D.list.length):null;return `<button type="button" role="tab" class="kdr-catb${D.cat===k?' on':''}${k?' c-'+k:''}" data-kdr="cat" data-k="${k}" aria-selected="${D.cat===k}"><span class="ms">${ic}</span>${n}${cnt!=null&&D.list.length?`<em>${cnt}</em>`:''}</button>`;}).join('')}</div>
    ${subs.length?`<div class="kdr-chips"><button type="button" class="${D.subj?'':'on'}" data-kdr="subj" data-k="">Toutes</button>${subs.map(s=>`<button type="button" class="${D.subj===s.subject?'on':''}" data-kdr="subj" data-k="${esc(s.subject)}">${esc(s.subject)}<em>${s.n}</em></button>`).join('')}</div>`:''}
    <div class="kdr-list">${list}</div>
    <div class="kdr-foot"><span class="ms">volunteer_activism</span><span>Tu as un bon cours ? Partage-le en <b>Public</b> pour aider tout le monde.</span>
      <button type="button" class="btn btn-sm btn-p" data-kdr="share"><span class="ms" style="font-size:16px">ios_share</span>Publier un cours</button></div>`;
}
function render(keepFocus){
  const b=$('kdr-body');if(!b)return;
  const f=document.activeElement&&document.activeElement.id==='kdr-q',pos=f?document.activeElement.selectionStart:0,sc=b.querySelector('.kdr-list')?.scrollTop||0;
  b.innerHTML=bodyHTML();
  const l=b.querySelector('.kdr-list');if(l)l.scrollTop=sc;
  if(f||keepFocus){const i=$('kdr-q');if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(e){}}}
}
async function ready(){
  if(typeof socialConfigured!=='function'||!socialConfigured())throw new Error('nocfg');
  if(typeof socialInit==='function')await socialInit();
  if(typeof _sb==='undefined'||!_sb)throw new Error('Pas de connexion internet.');
}
function errOf(e){
  const m=(e&&e.message)||String(e);
  if(m==='nocfg')return ['Le Drive commun a besoin des comptes City Work.',''];
  if(/list_public_courses|get_public_course|schema cache|Could not find the function|PGRST202|404/i.test(m))return ['Le Drive commun n’est pas encore activé sur le serveur.','Il sera disponible dès la mise à jour du serveur (fichier <code>supabase/drive.sql</code>).'];
  return [m,''];
}
const netErr=e=>/Pas de connexion|Failed to fetch|NetworkError|Load failed|nocfg|not_authenticated/i.test((e&&e.message)||String(e));
async function load(append){
  const my=++D.seq;D.loading=true;if(!append){D.off=0;D.list=null;}D.err='';render();
  try{
    await ready();
    let r;
    if(D.v3!==false){try{r=await _rpc('list_public_courses',{p_query:D.q,p_subject:D.subj,p_sort:D.sort,p_offset:D.off,p_cat:D.cat,p_school:D.school?mySchool():''});D.v3=true;D.v2=true;}
      catch(e){if(netErr(e))throw e;console.warn('[drive] v3',e);D.v3=false;}}   /* v85 : toute erreur du serveur → ancienne fonction (ex. drive3.sql pas encore lancé ou à corriger) */
    if(D.v3===false&&D.v2!==false){try{r=await _rpc('list_public_courses',{p_query:D.q,p_subject:D.subj,p_sort:D.sort,p_offset:D.off,p_cat:D.cat});D.v2=true;}
      catch(e){if(netErr(e))throw e;console.warn('[drive] v2',e);D.v2=false;}}
    if(D.v2===false)r=await _rpc('list_public_courses',{p_query:D.q,p_subject:D.subj,p_sort:D.sort,p_offset:D.off});
    if(my!==D.seq)return;
    const arr=Array.isArray(r)?r:[];D.list=append&&D.list?D.list.concat(arr):arr;D.more=arr.length>=60;D.off+=arr.length;
    if(!D.subjects)_rpc('list_public_subjects',{}).then(s=>{D.subjects=Array.isArray(s)?s:[];render();}).catch(()=>{D.subjects=[];});
  }catch(e){if(my!==D.seq)return;const [a,b]=errOf(e);D.err=a;D.errHint=b;}
  D.loading=false;render();
}
let _qT=0;
window.kcDriveOpen=function(){
  ['modal-nf','modal-nc'].forEach(id=>{const x=$(id);if(x&&x.classList.contains('open')&&typeof closeModal==='function')closeModal(id);});
  const m=modal();m.classList.add('open');document.addEventListener('keydown',onKey,true);
  load(false);
  setTimeout(()=>{const i=$('kdr-q');if(i&&matchMedia('(pointer:fine)').matches)i.focus();},150);
};
window.kcDriveClose=close;
window.kcDriveShare=function(){
  close();
  if(typeof socialIsLogged==='function'&&!socialIsLogged()&&typeof socialOpenAuth==='function'){socialOpenAuth('signup');if(typeof showNotif==='function')showNotif('Crée ton compte (gratuit) pour publier un cours','ok');return;}
  if(typeof socialOpenShare==='function')socialOpenShare(null,null,'public');
};
/* rafraîchit les pastilles « Déjà chez toi » après un import */
window.kcDriveRefresh=function(){if($('modal-drive')?.classList.contains('open'))render();};
document.addEventListener('click',e=>{
  const b=e.target.closest('#modal-drive [data-kdr]');if(!b)return;
  const a=b.dataset.kdr;
  if(a==='close')close();
  else if(a==='sort'){D.sort=b.dataset.k;load(false);}
  else if(a==='subj'){D.subj=b.dataset.k;load(false);}
  else if(a==='more'){if(!D.loading)load(true);}
  else if(a==='share')window.kcDriveShare();
  else if(a==='school'){
    if(!mySchool()){if(typeof kcPrompt==='function')kcPrompt('Ton école ou ta fac','',{icon:'apartment'}).then(v=>{if(v&&v.trim()){try{localStorage.setItem('kp_school',v.trim());}catch(_){}D.school=true;load(false);}});return;}
    D.school=!D.school;load(false);}
  else if(a==='cat'){D.cat=b.dataset.k;try{localStorage.setItem('kdr_cat',D.cat);}catch(_){}if(D.v2)load(false);else render();}
  else if(a==='peek'){e.stopPropagation();peek(b.dataset.id);}
  else if(a==='open'){if(typeof socialOpenCourse==='function')socialOpenCourse(b.dataset.id,null,true);}
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#modal-drive .kdr-card')){e.preventDefault();e.target.click();}});
document.addEventListener('input',e=>{
  if(e.target.id!=='kdr-q')return;D.q=e.target.value;clearTimeout(_qT);_qT=setTimeout(()=>load(false),320);
});
})();
