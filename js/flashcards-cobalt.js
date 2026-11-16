/* =========================================================
   flashcards-cobalt.js — Flashcards modernisées (15 nov. 2026)
   1. Accueil des flashcards (vue « hub ») : révision du jour (à revoir + 20 nouvelles max),
      prévision des 7 prochains jours, chiffres, AJOUT RAPIDE recto/verso (Ctrl+Entrée,
      carte inversée en option, texte à trous avec {{mot}}), dossiers et cours en cartes.
   2. Révision : 4 notes façon Anki (À revoir / Difficile / Bien / Facile) avec l'intervalle
      affiché, les cartes « À revoir » reviennent plus loin dans la session, sens inversé
      ou mélangé (touche R), raccourcis 1–4, bilan de fin (erreurs à revoir).
   Remplace (sans les supprimer de content.js) : renderAFCList (vue hub seulement),
   startFCSession, renderFCCard, toggleFCFlip, fcAnswer, endFCSession.
   Données : concepts (masteryLevel, nextReview, lastReview) + fcSpacedData {interval,ease,reps,due}.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NEW_PER_DAY=20;
const dayStr=(d)=>(d||new Date()).toISOString().split('T')[0];
function G(name,def){try{const v=eval(name);return v===undefined?def:v;}catch(e){return def;}} /* variables « let » des autres scripts */

/* ───────── Données ───────── */
function concs(){return (G('concepts',[])||[]).filter(c=>kcIsCard(c));}
function fcs(){return G('flashcards',[])||[];}
function spd(){const d=G('fcSpacedData',null);return d||{};}
function sp(id){return spd()[id]||null;}
function poolAll(){return [...concs().map(c=>({...c,type:'concept'})),...fcs().map(f=>({...f,type:'flashcard'}))];}
function poolOf(key){
  if(key==='hub')return poolAll();
  if(key.startsWith('__course_')){const cid=key.slice(9);return fcs().filter(f=>f.courseId===cid).map(f=>({...f,type:'flashcard'}));}
  if(key==='__none__')return concs().filter(c=>!c.folderId).map(c=>({...c,type:'concept'}));
  const ids=new Set(descIds(key));
  return concs().filter(c=>ids.has(c.folderId)).map(c=>({...c,type:'concept'}));
}
/* Dossiers imbriqués (16 nov. 2026) : conceptFolders[].parentId */
function cfAll(){return G('conceptFolders',[])||[];}
function descIds(id){const all=cfAll(),out=[id];for(let i=0;i<out.length;i++)all.forEach(f=>{if(f.parentId===out[i]&&!out.includes(f.id))out.push(f.id);});return out;}
function isRootF(f){return !f.parentId||!cfAll().some(x=>x.id===f.parentId);}
function kidsOf(id){return cfAll().filter(f=>f.parentId===id);}
function ancestors(id){const all=cfAll(),out=[];let f=all.find(x=>x.id===id),n=0;while(f&&f.parentId&&n++<20){const p=all.find(x=>x.id===f.parentId);if(!p)break;out.unshift(p);f=p;}return out;}
function treeOrder(){const all=cfAll(),out=[];const walk=(f,d)=>{out.push([f,d]);all.filter(x=>x.parentId===f.id).forEach(k=>walk(k,d+1));};all.filter(isRootF).forEach(f=>walk(f,0));return out;}
function folderOptions(sel,skip){
  const bad=skip?new Set(descIds(skip)):new Set();
  return treeOrder().filter(([f])=>!bad.has(f.id)).map(([f,d])=>`<option value="${f.id}"${f.id===sel?' selected':''}>${'\u2003'.repeat(d)}${d?'└ ':''}${esc(f.name)}</option>`).join('');
}
function folderStats(id){const ids=new Set(descIds(id));return {items:concs().filter(c=>ids.has(c.folderId)).map(c=>({...c,type:'concept'})),subs:kidsOf(id).length};}
function moveFolder(id,parent){
  const all=cfAll(),f=all.find(x=>x.id===id);if(!f)return;
  if(parent&&descIds(id).includes(parent)){showNotif('Impossible : ce dossier est à l’intérieur de celui que tu déplaces','err');return;}
  if((f.parentId||null)===(parent||null))return;
  if(parent)f.parentId=parent;else delete f.parentId;
  try{saveAll();}catch(e){}
  const p=parent&&all.find(x=>x.id===parent);
  showNotif(p?`« ${f.name} » rangé dans « ${p.name} »`:`« ${f.name} » remis à la racine`,'ok');
  renderAFCList();
}
window.fcxMoveFolder=moveFolder;
window.fcxFolderOptions=folderOptions;
window.fcxAncestors=ancestors;
window.fcxSubfoldersHTML=function(key){
  const ks=kidsOf(key);if(!ks.length)return '';
  return `<div class="fcx-sec"><h2>Sous-dossiers</h2><span>${ks.length}</span></div><div class="fcx-grid fcx-subgrid">`+ks.map(f=>{const st=folderStats(f.id);return folderCard(f.id,f.name,'folder',st.items,f.color,st.subs);}).join('')+'</div>';
};
window.fcxNewSubfolder=function(parent){
  openModal('modal-concept-folder');
  const n=$('cfol-name');if(n)n.value='';
  const d=$('cfol-delete-btn');if(d)d.style.display='none';
  const t=$('cfol-modal-title');if(t)t.textContent='Nouveau sous-dossier';
  window._editConceptFolderId=null;window._newFolderParent=parent;
  addParentPicker(parent,null);
};
function addParentPicker(sel,skip){
  const old=$('cfol-parent-row');if(old)old.remove();
  const n=$('cfol-name');if(!n)return;
  const row=document.createElement('div');row.id='cfol-parent-row';row.className='fcx-parent-row';
  row.innerHTML=`<label for="cfol-parent">Ranger dans</label><select id="cfol-parent" class="fcx-sel"><option value="">Aucun dossier (racine)</option>${folderOptions(sel,skip)}</select>`;
  const anchor=n.closest('.fg')||n;anchor.insertAdjacentElement('afterend',row);
}
/* glisser-déposer : un dossier sur un autre dossier, ou sur « Flashcards » / « Mes dossiers » pour le remettre à la racine */
let dragF=null;
document.addEventListener('dragstart',e=>{
  const c=e.target.closest&&e.target.closest('.fcx-fold[data-fkey]');if(!c)return;
  dragF=c.dataset.fkey;c.classList.add('fcx-dragging');
  try{e.dataTransfer.setData('text/plain','kp-folder:'+dragF);e.dataTransfer.effectAllowed='move';}catch(_){}
  document.body.classList.add('fcx-dragmode');
});
document.addEventListener('dragend',()=>{dragF=null;document.querySelectorAll('.fcx-dragging,.fcx-drop').forEach(x=>x.classList.remove('fcx-dragging','fcx-drop'));document.body.classList.remove('fcx-dragmode');});
function dropTarget(e){
  if(!dragF)return null;
  const t=e.target.closest&&e.target.closest('.fcx-fold[data-fkey],[data-fdrop]');if(!t)return null;
  const to=t.dataset.fkey||t.dataset.fdrop;
  if(to===dragF)return null;
  if(to!=='root'&&descIds(dragF).includes(to))return null;
  return {el:t,to};
}
document.addEventListener('dragover',e=>{
  const d=dropTarget(e);
  document.querySelectorAll('.fcx-drop').forEach(x=>{if(!d||x!==d.el)x.classList.remove('fcx-drop');});
  if(!d)return;
  e.preventDefault();try{e.dataTransfer.dropEffect='move';}catch(_){}
  d.el.classList.add('fcx-drop');
});
document.addEventListener('drop',e=>{
  const d=dropTarget(e);if(!d)return;
  e.preventDefault();const id=dragF;dragF=null;
  moveFolder(id,d.to==='root'?null:d.to);
});
/* Enregistrer / supprimer un dossier depuis l'écran Flashcards (avant : le bouton « Modifier » créait un nouveau dossier) */
const _origSaveCF=window.saveConceptFolder,_origDelCF=window.deleteConceptFolder,_origOpenModal=window.openModal;
const onFc=()=>document.body.dataset.screen==='all-flashcards'||document.body.dataset.screen==='fc-editor';
if(typeof _origOpenModal==='function')window.openModal=function(id){const r=_origOpenModal.apply(this,arguments);if(id==='modal-concept-folder'){const o=$('cfol-parent-row');if(o)o.remove();window._newFolderParent=null;}return r;};
window.saveConceptFolder=function(){
  if(!onFc()&&typeof _origSaveCF==='function')return _origSaveCF.apply(this,arguments);
  const name=($('cfol-name')||{}).value;if(!name||!name.trim()){showNotif('Nom vide','');return;}
  const pr=(($('cfol-prompt')||{}).value||'').trim(),id=window._editConceptFolderId||null;
  const ps=$('cfol-parent'),parent=ps?(ps.value||null):(window._newFolderParent||null);
  const all=cfAll();
  if(id){const f=all.find(x=>x.id===id);if(f){f.name=name.trim();f.prompt=pr;if(ps&&(parent===null||!descIds(id).includes(parent))){if(parent)f.parentId=parent;else delete f.parentId;}}}
  else{const f={id:uid(),name:name.trim(),prompt:pr,collapsed:false};if(parent)f.parentId=parent;all.push(f);}
  window._newFolderParent=null;
  try{saveAll();}catch(e){}
  closeModal('modal-concept-folder');renderAFCList();
  showNotif(id?'Dossier modifié':'Dossier créé','ok');
};
window.deleteConceptFolder=function(){
  if(!onFc()&&typeof _origDelCF==='function')return _origDelCF.apply(this,arguments);
  const id=window._editConceptFolderId;if(!id)return;
  closeModal('modal-concept-folder');
  window.fcxDeleteFolders([id]);
};
/* ───────── Supprimer / sélectionner des dossiers (v69, 16 nov. 2026) ─────────
   Corbeille sur chaque dossier + bouton « Sélectionner » (plusieurs dossiers d'un coup).
   Au choix : garder les cartes (elles remontent d'un niveau) ou les supprimer avec le dossier. */
let SEL=null;/* null = pas de sélection en cours ; sinon Set des identifiants cochés */
function selBar(){
  let b=$('fcx-selbar');
  if(!SEL){if(b)b.remove();return;}
  if(!b){b=document.createElement('div');b.id='fcx-selbar';b.className='fcx-selbar';document.body.appendChild(b);}
  const n=SEL.size,tot=document.querySelectorAll('#screen-all-flashcards .fcx-fold[data-fkey]').length;
  b.innerHTML=`<b>${n?n+' dossier'+(n>1?'s':'')+' sélectionné'+(n>1?'s':''):'Clique sur les dossiers à choisir'}</b>
    <button type="button" class="btn btn-g" onclick="fcxSelectAll()"><span class="ms">${n&&n>=tot?'remove_done':'done_all'}</span>${n&&n>=tot?'Tout décocher':'Tout sélectionner'}</button>
    <button type="button" class="btn fcx-danger" onclick="fcxDeleteSelected()"${n?'':' disabled'}><span class="ms">delete</span>Supprimer</button>
    <button type="button" class="btn btn-g" onclick="fcxSelectMode(false)">Terminer</button>`;
}
function syncSel(){
  document.body.classList.toggle('fcx-selmode',!!SEL);
  document.querySelectorAll('.fcx-fold[data-fkey]').forEach(c=>c.classList.toggle('fcx-on',!!SEL&&SEL.has(c.dataset.fkey)));
  const sb=document.querySelector('.fcx-selb');if(sb&&sb.lastChild)sb.lastChild.textContent=SEL?'Terminer':'Sélectionner';
  selBar();
}
window.fcxSelectMode=function(on){
  on=on===undefined?!SEL:!!on;
  if(on===!!SEL)return;
  SEL=on?new Set():null;syncSel();
};
window.fcxSelectAll=function(){
  if(!SEL)return;
  const keys=[...document.querySelectorAll('#screen-all-flashcards .fcx-fold[data-fkey]')].map(c=>c.dataset.fkey);
  if(keys.length&&keys.every(k=>SEL.has(k)))SEL.clear();else keys.forEach(k=>SEL.add(k));
  syncSel();
};
window.fcxDeleteSelected=function(){if(SEL&&SEL.size)window.fcxDeleteFolders([...SEL]);};
window.fcxFoldClick=function(ev,key){
  if(SEL){if(!key.startsWith('__')){if(SEL.has(key))SEL.delete(key);else SEL.add(key);syncSel();}return;}
  afcOpenView(key);
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&SEL&&!document.querySelector('.kc-dlg-bg'))window.fcxSelectMode(false);});
window.fcxDeleteFolders=function(ids){
  const all=cfAll();
  ids=(ids||[]).filter(id=>all.some(f=>f.id===id));
  if(!ids.length){showNotif('Choisis au moins un dossier','err');return;}
  /* un sous-dossier d'un dossier déjà choisi est compris dedans */
  const top=ids.filter(id=>!ancestors(id).some(a=>ids.includes(a.id)));
  const inside=new Set();top.forEach(id=>descIds(id).forEach(x=>inside.add(x)));
  const cs=G('concepts',[])||[];
  const isCard=c=>kcIsCard(c);
  const nCards=cs.filter(c=>inside.has(c.folderId)&&isCard(c)).length,nSub=inside.size-top.length;
  const names=top.map(id=>(all.find(f=>f.id===id)||{}).name||'Dossier');
  const run=withCards=>{
    if(withCards){
      const sd=spd();
      for(let i=cs.length-1;i>=0;i--){const c=cs[i];if(!inside.has(c.folderId))continue;if(isCard(c)){try{delete sd[c.id];}catch(e){}cs.splice(i,1);}else c.folderId=null;}
      for(let i=all.length-1;i>=0;i--)if(inside.has(all[i].id))all.splice(i,1);
    }else{
      top.forEach(id=>{
        const f=all.find(x=>x.id===id);if(!f)return;
        const par=f.parentId&&all.some(x=>x.id===f.parentId)?f.parentId:null;
        cs.forEach(c=>{if(c.folderId===id)c.folderId=par;});
        all.forEach(x=>{if(x.parentId===id){if(par)x.parentId=par;else delete x.parentId;}});
        const i=all.indexOf(f);if(i>=0)all.splice(i,1);
      });
    }
    try{saveAll();}catch(e){}
    const v=G('_afcView','hub');
    if(v!=='hub'&&!String(v).startsWith('__')&&!cfAll().some(f=>f.id===v)){try{_afcView='hub';}catch(e){}}
    SEL=null;syncSel();
    renderAFCList();
    const what=top.length>1?top.length+' dossiers supprimés':'Dossier supprimé';
    showNotif(withCards&&nCards?`${what} avec ${nCards} carte${nCards>1?'s':''}`:nCards?`${what} · les cartes sont gardées`:what,'ok');
  };
  const title=top.length>1?`Supprimer ${top.length} dossiers ?`:`Supprimer « ${names[0]} » ?`;
  if(typeof window.kcDlg!=='function'){if(confirm(title+(nCards?' Les cartes sont gardées.':'')))run(false);return;}
  const list=top.length>1?`<p class="fcx-deltxt">${names.slice(0,6).map(esc).join(', ')}${names.length>6?'…':''}</p>`:'';
  const cont=[nCards?`${nCards} carte${nCards>1?'s':''}`:'',nSub?`${nSub} sous-dossier${nSub>1?'s':''}`:''].filter(Boolean).join(' et ');
  window.kcDlg({title,icon:'delete',sub:cont?`Contient ${cont}`:(top.length>1?'Ces dossiers sont vides':'Ce dossier est vide'),
    body:list+(cont?`<div class="fcx-delopt">
        <label><input type="radio" name="fcx-delmode" value="keep" checked><span><b>Garder ${nCards?'les cartes':'les sous-dossiers'}</b><small>${nCards?'Les cartes ne sont pas perdues : elles remontent d’un niveau (dans « Sans dossier » ou le dossier parent).':'Les sous-dossiers remontent d’un niveau.'}</small></span></label>
        <label><input type="radio" name="fcx-delmode" value="all"><span><b>Tout supprimer</b><small>Le dossier${nSub?', ses sous-dossiers':''}${nCards?' et ses '+nCards+' carte'+(nCards>1?'s':''):''} : c’est définitif.</small></span></label>
      </div>`:''),
    foot:'<button class="btn btn-g" data-x>Annuler</button><button class="btn fcx-danger" data-ok><span class="ms">delete</span>Supprimer</button>',
    onOk(bg){const r=bg.querySelector('input[name="fcx-delmode"]:checked');run(!!r&&r.value==='all');}});
};
/* Ctrl + Entrée n'importe où sur l'écran Flashcards (v69) : accueil = ajout rapide, dossier = nouvelle carte dans l'éditeur */
document.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.key!=='Enter'||e.defaultPrevented)return;
  if(document.body.dataset.screen!=='all-flashcards')return;
  if(document.querySelector('.kc-dlg-bg,.mdbg.open'))return;
  e.preventDefault();
  const v=G('_afcView','hub');
  if(v==='hub'&&!G('_afcSearchOpen',false)){
    const fr=$('fcx-front'),bk=$('fcx-back');
    if(fr&&bk&&fr.value.trim()&&(bk.value.trim()||/\{\{.+?\}\}/.test(fr.value))){window.fcxQuickAdd();return;}
    if(fr){fr.scrollIntoView({block:'center',behavior:'smooth'});(fr.value.trim()?bk:fr).focus({preventScroll:true});}
  }else if(v&&v!=='hub'&&typeof window.fceOpen==='function')window.fceOpen(v,null,{add:true});
});
/* Recherche : barre intégrée sous l'en-tête (avant : cachée sous la barre du haut, texte invisible) */
window.toggleAFCSearch=function(force){
  const open=force===undefined?!G('_afcSearchOpen',false):!!force;
  try{_afcSearchOpen=open;}catch(e){}
  const bar=$('afc-search-bar'),inp=$('afc-search-input'),wrap=$('afc-wrap');if(!bar)return;
  bar.style.display=open?'flex':'none';
  if(wrap)wrap.style.paddingTop='';
  const hdr=$('afc-hub-header'),ar=$('afc-action-row');
  if(open){if(inp){inp.value='';setTimeout(()=>inp.focus(),30);}}
  else{if(hdr)hdr.style.display='';if(ar)ar.style.display='';renderAFCList();}
};
function isDue(c){
  const d=sp(c.id);
  if(d&&d.due&&d.due<=dayStr())return true;
  return !!(c.nextReview&&new Date(c.nextReview)<=new Date());
}
function isNew(c){return !sp(c.id)&&!c.lastReview;}
function level(c){
  if(typeof c.masteryLevel==='number'&&c.lastReview)return c.masteryLevel;
  const d=sp(c.id);return d?Math.min(5,d.reps||0):0;
}
function mastered(c){const d=sp(c.id);return level(c)>=4||!!(d&&d.interval>=21);}
function shuf(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function todayPool(items){
  const due=items.filter(isDue),nw=items.filter(x=>isNew(x)&&!isDue(x)).slice(0,NEW_PER_DAY);
  return {due,nw,all:[...shuf(due),...nw]};
}

/* ───────── Répétition espacée (4 notes) ───────── */
function nextState(d,g){
  let interval=(d&&d.interval)||0,ease=(d&&d.ease)||2.5,reps=(d&&d.reps)||0;
  if(g===1){reps=0;interval=0;ease=Math.max(1.3,ease-.2);}
  else if(reps===0){interval=[0,0,1,2,4][g];reps=1;if(g===2)ease=Math.max(1.3,ease-.15);if(g===4)ease+=.15;}
  else if(g===2){interval=Math.max(interval+1,Math.round(interval*1.2));ease=Math.max(1.3,ease-.15);reps++;}
  else if(g===3){interval=Math.max(interval+1,Math.round(interval*ease));reps++;}
  else{interval=Math.max(interval+2,Math.round(interval*ease*1.3));ease+=.15;reps++;}
  return {interval,ease:Math.round(ease*100)/100,reps};
}
function fmtIv(n){
  if(!n)return 'dans la session';
  if(n<30)return n+' j';
  if(n<365)return Math.round(n/30)+' mois';
  return (Math.round(n/36.5)/10)+' an'+(n>=730?'s':'');
}
function applyGrade(c,g){
  const ns=nextState(sp(c.id),g);
  const due=new Date();due.setDate(due.getDate()+Math.max(1,ns.interval));
  const store=G('fcSpacedData',null);
  if(store)store[c.id]={...ns,due:dayStr(due)};
  if(c.type==='concept'){
    const cc=(G('concepts',[])||[]).find(x=>x.id===c.id);
    if(cc){
      const l=cc.masteryLevel||0;
      cc.masteryLevel=g===1?Math.max(0,l-1):g===2?l:g===3?Math.min(5,l+1):Math.min(5,l+2);
      if(cc.masteryLevel>=5)cc.state='learned';
      cc.lastReview=new Date().toISOString();cc.nextReview=due.toISOString();
    }
  }
  clearTimeout(applyGrade._t);applyGrade._t=setTimeout(()=>{try{saveAll();}catch(e){}},300);
}

/* ───────── 1. Accueil des flashcards ───────── */
function forecast(items){
  const out=[];const base=new Date();
  for(let i=0;i<7;i++){
    const d=new Date(base);d.setDate(base.getDate()+i);const k=dayStr(d);
    const n=items.filter(c=>{const s=sp(c.id);const due=s&&s.due?s.due:(c.nextReview?dayStr(new Date(c.nextReview)):null);return due&&(i===0?due<=k:due===k);}).length;
    out.push({n,lbl:i===0?'Auj.':['D','L','M','M','J','V','S'][d.getDay()]});
  }
  return out;
}
function folderCard(key,name,icon,items,color,subs){
  const due=items.filter(isDue).length,m=items.length?Math.round(items.filter(mastered).length/items.length*100):0;
  const editable=!key.startsWith('__');
  return `<div class="fcx-fold${SEL&&SEL.has(key)?' fcx-on':''}" onclick="fcxFoldClick(event,'${key}')" role="button" tabindex="0"${editable?` draggable="true" data-fkey="${key}"`:''}>
    <div class="fcx-fold-top">
      <span class="fcx-fold-ic" style="--c:${color||'var(--kc-primary)'}"><span class="ms">${icon}</span></span>
      <div class="fcx-fold-acts">
        <button class="fcx-mini" title="Modifier les cartes" onclick="event.stopPropagation();fceOpen('${key}')"><span class="ms">edit_note</span></button>
        ${editable?`<button class="fcx-mini fcx-del" title="Supprimer ce dossier" aria-label="Supprimer ce dossier" onclick="event.stopPropagation();fcxDeleteFolders(['${key}'])"><span class="ms">delete</span></button>`:''}
        ${items.length?`<button class="fcx-mini fcx-play" title="Réviser ce dossier" onclick="event.stopPropagation();fcxStartKey('${key}')"><span class="ms">play_arrow</span></button>`:''}
      </div>
      ${editable?'<span class="fcx-check" aria-hidden="true"><span class="ms">check</span></span>':''}
    </div>
    <div class="fcx-fold-name">${esc(name)}</div>
    <div class="fcx-fold-meta"><span>${items.length} carte${items.length!==1?'s':''}</span>${subs?`<span><span class="ms" style="font-size:14px;vertical-align:-2px">folder</span> ${subs}</span>`:''}${due?`<span class="fcx-due">${due} à revoir</span>`:''}</div>
    <div class="fcx-bar" title="${m} % maîtrisées"><b style="width:${m}%"></b></div>
  </div>`;
}
function renderHub(){
  const hdr=$('afc-hub-header'),ar=$('afc-action-row'),list=$('afc-list'),wrap=$('afc-wrap'),title=$('afc-topbar-title');
  if(!list)return;
  if(title)title.textContent='Flashcards';
  if(wrap){wrap.classList.add('fcx-hubmode');wrap.style.paddingTop='';}
  const scr=$('screen-all-flashcards');if(scr)scr.classList.add('fcx-hub');
  if(hdr)hdr.style.display='';
  const all=poolAll(),tp=todayPool(all),fo=forecast(all);
  const nMast=all.filter(mastered).length,nNew=all.filter(isNew).length,nLearn=all.length-nMast-nNew;
  const fmax=Math.max(1,...fo.map(x=>x.n));
  const nToday=tp.all.length;
  hdr.innerHTML=`
    <div class="hub-header kc-pagehead">
      <button class="hub-back" onclick="switchTab('home')" aria-label="Retour"><span class="ms">arrow_back</span></button>
      <div style="flex:1;min-width:0"><p class="hub-kicker">Réviser</p><h1 class="hub-title">Flashcards</h1></div>
      <button class="kc-hbtn" onclick="toggleAFCSearch()" aria-label="Rechercher dans les flashcards" title="Rechercher"><span class="ms">search</span></button>
      <button class="kc-hbtn" onclick="afcOpenSort()" aria-label="Trier les flashcards" title="Trier"><span class="ms">sort</span></button>
    </div>
    <div class="fcx-head"><p class="fcx-lead">${all.length} carte${all.length!==1?'s':''} · répétition espacée : chaque carte revient juste avant que tu l’oublies</p></div>
    <div class="fcx-top">
      <section class="fcx-hero">
        <div class="fcx-kicker"><span class="ms">today</span>Révision du jour</div>
        ${nToday?`<div class="fcx-big"><b>${nToday}</b> carte${nToday>1?'s':''}</div>
          <div class="fcx-sub">${tp.due.length} à revoir · ${tp.nw.length} nouvelle${tp.nw.length>1?'s':''}</div>
          <button class="btn btn-p fcx-go" onclick="fcxStartToday()"><span class="ms">play_arrow</span>Commencer</button>`
        :`<div class="fcx-big fcx-ok"><span class="ms">task_alt</span>Tout est à jour</div>
          <div class="fcx-sub">${all.length?'Reviens demain, ou révise quand même.':'Crée tes premières cartes : à la main, depuis un PDF ou avec l’IA.'}</div>
          ${all.length>=1?`<button class="btn btn-g fcx-go" onclick="startAllFlashcardsHub()"><span class="ms">replay</span>Réviser quand même</button>`:`<button class="btn btn-p fcx-go" onclick="fceCreate()"><span class="ms">add</span>Créer mes premières cartes</button>`}`}
      </section>
      <section class="fcx-side">
        <div class="fcx-stats">
          <div><b>${nMast}</b><span><i style="background:var(--kc-green,#12A35E)"></i>Maîtrisées</span></div>
          <div><b>${Math.max(0,nLearn)}</b><span><i style="background:var(--kc-primary)"></i>En cours</span></div>
          <div><b>${nNew}</b><span><i style="background:var(--kc-border)"></i>Nouvelles</span></div>
        </div>
        <div class="fcx-fc-t">7 prochains jours</div>
        <div class="fcx-fc">${fo.map(x=>`<div title="${x.n} carte${x.n>1?'s':''}"><i style="height:${x.n?Math.max(8,x.n/fmax*100):0}%"></i><b>${x.n||''}</b><span>${x.lbl}</span></div>`).join('')}</div>
      </section>
    </div>`;
  const cf=G('conceptFolders',[])||[];
  const lastF=(()=>{try{return localStorage.getItem('fcx_last_folder')||'';}catch(e){return '';}})();
  if(ar){
    ar.style.display='block';
    ar.innerHTML=`
    <div class="fcx-tools">
      <button class="fcx-create" onclick="fceCreate()"><span class="ms">add</span>Créer des flashcards</button>
      <button class="kh-tool" onclick="fceNew({ai:true,pdf:true})"><span class="ms">picture_as_pdf</span>Depuis un PDF (IA)</button>
      <button class="kh-tool" onclick="fceNew({ai:true,topic:'topic'})"><span class="ms">auto_awesome</span>Sur un sujet (IA)</button>
      <button class="kh-tool" onclick="openModal('modal-concept-folder');document.getElementById('cfol-name').value='';document.getElementById('cfol-delete-btn').style.display='none';document.getElementById('cfol-modal-title').textContent='Nouveau dossier';window._editConceptFolderId=null"><span class="ms">create_new_folder</span>Nouveau dossier</button>
    </div>
    <section class="fcx-add" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();fcxQuickAdd();}">
      <div class="fcx-add-h"><span class="ms">bolt</span><b>Ajout rapide</b><small>Ctrl + Entrée pour ajouter · écris <code>{{mot}}</code> pour un texte à trous</small></div>
      <div class="fcx-add-f">
        <textarea id="fcx-front" rows="2" placeholder="Recto — question, terme ou phrase avec {{trou}}"></textarea>
        <textarea id="fcx-back" rows="2" placeholder="Verso — réponse ou définition"></textarea>
      </div>
      <div class="fcx-add-b">
        <select id="fcx-folder" class="fcx-sel" aria-label="Dossier"><option value="">Sans dossier</option>${folderOptions(lastF)}</select>
        <label class="fcx-chk"><input type="checkbox" id="fcx-both"${(()=>{try{return localStorage.getItem('fcx_both')==='1'?' checked':'';}catch(e){return '';}})()} onchange="try{localStorage.setItem('fcx_both',this.checked?'1':'0')}catch(e){}"> Carte inversée aussi</label>
        <span class="fcx-flex"></span>
        <button class="btn btn-p" onclick="fcxQuickAdd()"><span class="ms">add</span>Ajouter</button>
      </div>
    </section>`;
  }
  // Dossiers + cours
  const groups={};concs().forEach(c=>{const k=c.folderId&&cf.some(f=>f.id===c.folderId)?c.folderId:'__none__';(groups[k]=groups[k]||[]).push({...c,type:'concept'});});
  let html='';
  const fkeys=cf.filter(isRootF).map(f=>f.id);if(groups.__none__)fkeys.push('__none__');
  if(fkeys.length){
    html+=`<div class="fcx-sec" data-fdrop="root"><h2>Mes dossiers</h2><span>${fkeys.length}</span>${cf.length>1?'<small class="fcx-dnd-hint"><span class="ms">drag_pan</span>Glisse un dossier sur un autre pour le ranger dedans</small>':''}${cf.length?`<button type="button" class="fcx-selb" onclick="fcxSelectMode()" title="Choisir plusieurs dossiers pour les supprimer d’un coup"><span class="ms">checklist</span>${SEL?'Terminer':'Sélectionner'}</button>`:''}</div><div class="fcx-grid">`+
      fkeys.map(k=>{const f=cf.find(x=>x.id===k);if(k==='__none__')return folderCard(k,'Sans dossier','inbox',groups[k]||[]);const st=folderStats(k);return folderCard(k,(f&&f.name)||'Dossier','folder',st.items,f&&f.color,st.subs);}).join('')+`</div>`;
  }
  const byC={};fcs().forEach(f=>{(byC[f.courseId]=byC[f.courseId]||[]).push({...f,type:'flashcard'});});
  const ck=Object.keys(byC);
  if(ck.length){
    const cs=G('courses',[])||[];
    html+=`<div class="fcx-sec"><h2>Flashcards de cours</h2><span>${ck.length}</span></div><div class="fcx-grid">`+
      ck.map(id=>{const c=cs.find(x=>x.id===id);return folderCard('__course_'+id,c?c.name:'Cours supprimé','menu_book',byC[id]);}).join('')+`</div>`;
  }
  if(!html)html=`<div class="fcx-empty"><span class="ms">style</span><b>Aucune carte pour l’instant</b><p>Tape un recto et un verso dans « Ajout rapide », ou crée tes cartes avec l’IA.</p></div>`;
  list.innerHTML=html;
}
window.fcxEditFolder=function(key){
  const cf=G('conceptFolders',[])||[];const f=cf.find(x=>x.id===key);
  openModal('modal-concept-folder');
  const n=$('cfol-name');if(n)n.value=f?f.name:'';
  const d=$('cfol-delete-btn');if(d)d.style.display='inline-flex';
  const t=$('cfol-modal-title');if(t)t.textContent='Modifier le dossier';
  window._editConceptFolderId=key;
  addParentPicker(f&&f.parentId||'',key);
};
window.fcxQuickAdd=function(){
  const fr=$('fcx-front'),bk=$('fcx-back');if(!fr||!bk)return;
  const front=fr.value.trim(),back=bk.value.trim();
  const folderId=($('fcx-folder')||{}).value||null;
  try{localStorage.setItem('fcx_last_folder',folderId||'');}catch(e){}
  const list=G('concepts',null);if(!list){showNotif('Flashcards indisponibles','err');return;}
  const mk=(term,def)=>({id:uid(),term,questionId:null,state:'toExplain',definition:def,keywords:[],masteryLevel:0,nextReview:null,lastReview:null,createdAt:new Date().toISOString(),folderId});
  let added=0;
  const cloze=[...front.matchAll(/\{\{(.+?)\}\}/g)];
  if(cloze.length){
    // Texte à trous : une carte par trou ; le verso = la phrase complète (+ le verso tapé, s'il y en a un)
    const full=front.replace(/\{\{(.+?)\}\}/g,'$1');
    cloze.forEach((m,i)=>{
      let k=0;const q=front.replace(/\{\{(.+?)\}\}/g,(all,w)=>(k++===i?'[ … ]':w));
      list.push(mk(q,m[1]+'\n\n'+full+(back?'\n\n'+back:'')));added++;
    });
  }else{
    if(!front||!back){showNotif(!front?'Écris le recto':'Écris le verso','err');(front?bk:fr).focus();return;}
    list.push(mk(front,back));added++;
    if(($('fcx-both')||{}).checked){list.push(mk(back,front));added++;}
  }
  try{saveAll();}catch(e){}
  showNotif(added>1?`${added} cartes ajoutées`:'Carte ajoutée','ok');
  renderHub();
  const f2=$('fcx-front');if(f2)f2.focus();
};
window.fcxStartToday=function(){
  const tp=todayPool(poolAll());
  if(!tp.all.length){showNotif('Rien à revoir aujourd’hui','ok');return;}
  startFCSession(tp.all,'all-flashcards');
};
window.fcxStartKey=function(key){
  const items=poolOf(key);const tp=todayPool(items);
  const pool=tp.all.length?tp.all:items;
  if(!pool.length){showNotif('Aucune carte dans ce dossier','err');return;}
  startFCSession(pool,'all-flashcards');
};
const _origRender=window.renderAFCList;
window.renderAFCList=function(){
  const wrap=$('afc-wrap');
  if(G('_afcView','hub')!=='hub'||G('_afcSearchOpen',false)){
    if(wrap)wrap.classList.remove('fcx-hubmode');
    const scr=$('screen-all-flashcards');if(scr)scr.classList.remove('fcx-hub');
    return _origRender.apply(this,arguments);
  }
  try{renderHub();}catch(e){console.warn('[flashcards]',e);if(wrap)wrap.classList.remove('fcx-hubmode');return _origRender.apply(this,arguments);}
};

/* ───────── 2. Révision ───────── */
let S=null,flipped=false,tx=0,ty=0;
function getDir(){try{return localStorage.getItem('fcx_dir')||'td';}catch(e){return 'td';}}
const DIR_LBL={td:'Terme → Déf.',dt:'Déf. → Terme',mix:'Mélangé'};
function syncDir(){const l=$('fcx-dir-lbl');if(l)l.textContent=DIR_LBL[getDir()];}
window.fcxToggleDir=function(){
  const order=['td','dt','mix'],n=order[(order.indexOf(getDir())+1)%3];
  try{localStorage.setItem('fcx_dir',n);}catch(e){}
  syncDir();if(S&&S.cards[S.cur]){S.cards.forEach(c=>{delete c._rev;});window.renderFCCard();}
};
function setFlip(on){
  flipped=on;try{_fcFlipped=on;}catch(e){}
  const card=$('cfcard');if(card){card.classList.toggle('flipped',on);card.setAttribute('aria-pressed',on?'true':'false');}
  const ar=$('fc-answer-row');if(ar)ar.classList.toggle('visible',on);
  const rv=$('fcx-reveal');if(rv)rv.hidden=on;
}
window.startFCSession=function(cards,returnTo){
  S={cards:shuf(cards.map(c=>({...c}))),cur:0,correct:0,returnTo:returnTo||'concepts',stats:{1:0,2:0,3:0,4:0},first:{},again:{},t0:Date.now(),done:0};
  try{fcSess=S;}catch(e){}
  const end=$('fcx-end');if(end){end.hidden=true;end.innerHTML='';}
  document.body.classList.remove('fcx-ended');
  showScreen('concept-fc');
  syncDir();
  window.renderFCCard();
  const stage=document.querySelector('#screen-concept-fc .fc-stage');
  if(stage&&!stage._fcxSwipe){
    stage._fcxSwipe=true;
    stage.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
    stage.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
      if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy))return;
      if(flipped)window.fcAnswer(dx>0?3:1);else if(dx<0)nextFCCardNav();else prevFCCard();
    },{passive:true});
    // L'ancien gestionnaire de content.js est désactivé pour ne pas noter deux fois
    stage._fcSwipeInit=true;
  }
};
window.renderFCCard=function(dir){
  if(!S)return;
  const c=S.cards[S.cur],total=S.cards.length;if(!c)return;
  setFlip(false);
  $('cfprog').style.width=(S.cur/total*100)+'%';
  $('cfn').textContent=`${S.cur+1} / ${total}`;
  const lv=level(c);
  $('cfmeta').innerHTML=c._again?'<span class="fcx-tag again">À revoir</span>':isNew(c)?'<span class="fcx-tag new">Nouvelle</span>':
    `<span class="fcx-lv" title="Niveau ${lv}/5">${[0,1,2,3,4].map(i=>`<i class="${i<lv?'on':''}"></i>`).join('')}</span>`;
  const d=getDir();
  if(c._rev===undefined)c._rev=d==='dt'?true:d==='mix'?Math.random()<.5:false;
  const rev=c._rev,def=c.definition||'—';
  const lblF=document.querySelector('#screen-concept-fc .fc-front .fc-face-label'),lblB=document.querySelector('#screen-concept-fc .fc-back .fc-face-label');
  if(lblF)lblF.textContent=rev?'Définition':'Recto';
  if(lblB)lblB.textContent=rev?'Terme':'Verso';
  const ft=$('cfterm'),bt=$('cfdef');
  const sh=h=>typeof fcxSafeHtml==='function'&&h?fcxSafeHtml(h):null;
  const tH=sh(c.termHtml),dH=sh(c.defHtml);
  const put=(el,html,txt)=>{if(html)el.innerHTML=html;else el.textContent=txt;};
  put(ft,rev?dH:tH,rev?def:(c.term||''));put(bt,rev?tH:dH,rev?(c.term||''):def);
  ft.classList.toggle('fcx-long',(ft.textContent||'').length>140);bt.classList.toggle('fcx-long',(bt.textContent||'').length>140);
  const kw=$('cfkw-hint');
  if(kw)kw.innerHTML=c.keywords&&c.keywords.length?`<div class="fcx-kws">${c.keywords.map(k=>`<span>${esc(k)}</span>`).join('')}</div>`:'';
  const imgQ=c.imageQ||c.image||null,imgA=c.imageA||null;
  const [fi,bi]=rev?[imgA,imgQ]:[imgQ,imgA];
  const qEl=$('cfimg-q'),qImg=$('cfimg-q-el'),aEl=$('cfimg-a'),aImg=$('cfimg-a-el');
  if(qEl&&qImg){if(fi){qImg.src=fi;qEl.style.display='block';}else{qEl.style.display='none';qImg.removeAttribute('src');}}
  if(aEl&&aImg){if(bi){aImg.src=bi;aEl.style.display='block';}else{aEl.style.display='none';aImg.removeAttribute('src');}}
  const st=sp(c.id);
  [2,3,4].forEach(g=>{const el=$('fcx-i'+g);if(el)el.textContent=fmtIv(Math.max(1,nextState(st,g).interval));});
  const pb=$('fc-prev-btn');if(pb)pb.disabled=S.cur===0;
  const card=$('cfcard');
  if(dir&&card){card.classList.add(dir==='right'?'fc-slide-right':'fc-slide-left');card.addEventListener('animationend',()=>card.classList.remove('fc-slide-right','fc-slide-left'),{once:true});}
};
window.toggleFCFlip=function(){if(S&&!document.body.classList.contains('fcx-ended'))setFlip(!flipped);};
window.fcAnswer=function(g){
  if(!S)return;
  if(g===true)g=3;else if(g===false)g=1;
  g=Math.max(1,Math.min(4,g|0));
  if(!flipped){setFlip(true);return;}
  const c=S.cards[S.cur];if(!c||S._busy)return;
  S._busy=true;
  applyGrade(c,g);S.stats[g]++;S.done++;
  if(S.first[c.id]===undefined){S.first[c.id]=g;if(g>=2)S.correct++;}
  if(g===1){
    S.again[c.id]=(S.again[c.id]||0)+1;
    if(S.again[c.id]<=3){const pos=Math.min(S.cards.length,S.cur+5);S.cards.splice(pos,0,{...c,_again:true,_rev:c._rev});}
  }
  const card=$('cfcard');
  card.classList.add(g>=2?'cf-swipe-right':'cf-swipe-left');
  setTimeout(()=>{
    card.classList.remove('cf-swipe-right','cf-swipe-left','flipped');
    S._busy=false;S.cur++;
    if(S.cur>=S.cards.length){window.endFCSession();return;}
    window.renderFCCard('right');
  },220);
};
function exitSession(){
  const rt=S?S.returnTo:'all-flashcards';
  document.body.classList.remove('fcx-ended');
  const end=$('fcx-end');if(end){end.hidden=true;end.innerHTML='';}
  S=null;
  if(rt==='course')showScreen('course');else switchTab(rt);
}
window.fcxExit=exitSession;
window.fcxRetryErrors=function(){
  if(!S)return;
  const ids=Object.keys(S.first).filter(id=>S.first[id]===1);
  const pool=poolAll().filter(c=>ids.includes(c.id));
  const rt=S.returnTo;
  if(!pool.length){exitSession();return;}
  startFCSession(pool,rt);
};
window.endFCSession=function(){
  if(!S){exitSession();return;}
  if(!S.done){exitSession();return;}
  const firstN=Object.keys(S.first).length,ok=S.correct,pct=firstN?Math.round(ok/firstN*100):0;
  const errs=Object.values(S.first).filter(g=>g===1).length;
  const secs=Math.round((Date.now()-S.t0)/1000),mm=Math.floor(secs/60),ss=secs%60;
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const tk=dayStr(tomorrow);
  const dueTomorrow=poolAll().filter(c=>{const s=sp(c.id);return s&&s.due&&s.due<=tk;}).length;
  const tot=S.stats[1]+S.stats[2]+S.stats[3]+S.stats[4]||1;
  const seg=(g,cls)=>S.stats[g]?`<i class="${cls}" style="flex:${S.stats[g]}"></i>`:'';
  try{if(typeof pushSessionHistory==='function')pushSessionHistory({type:'flashcards',total:firstN,correct:ok,secs});}catch(e){}
  const end=$('fcx-end');
  document.body.classList.add('fcx-ended');
  end.innerHTML=`<div class="fcx-end-card">
    <div class="fcx-end-ic"><span class="ms">${pct>=80?'emoji_events':pct>=50?'trending_up':'fitness_center'}</span></div>
    <h2>Session terminée</h2>
    <p class="fcx-end-sub">${pct>=80?'Excellent, tu maîtrises bien ces cartes.':pct>=50?'Bon travail, encore un effort sur les cartes ratées.':'Les cartes ratées reviendront vite : c’est comme ça qu’on retient.'}</p>
    <div class="fcx-end-pct"><b>${pct} %</b><span>réussies du premier coup</span></div>
    <div class="fcx-end-bar">${seg(1,'g1')}${seg(2,'g2')}${seg(3,'g3')}${seg(4,'g4')}</div>
    <div class="fcx-end-leg"><span><i class="g1"></i>À revoir ${S.stats[1]}</span><span><i class="g2"></i>Difficile ${S.stats[2]}</span><span><i class="g3"></i>Bien ${S.stats[3]}</span><span><i class="g4"></i>Facile ${S.stats[4]}</span></div>
    <div class="fcx-end-grid">
      <div><b>${firstN}</b><span>cartes</span></div>
      <div><b>${mm}:${String(ss).padStart(2,'0')}</b><span>temps</span></div>
      <div><b>${dueTomorrow}</b><span>à revoir demain</span></div>
    </div>
    <div class="fcx-end-btns">
      ${errs?`<button class="btn btn-g" onclick="fcxRetryErrors()"><span class="ms">replay</span>${errs>1?`Revoir mes ${errs} erreurs`:'Revoir mon erreur'}</button>`:''}
      <button class="btn btn-p" onclick="fcxExit()">Terminer</button>
    </div>
  </div>`;
  end.hidden=false;
  $('cfprog').style.width='100%';
};
// Raccourcis : 1–4 = note, R = sens, Entrée = retourner / « Bien », Échap = terminer
document.addEventListener('keydown',e=>{
  if(document.body.dataset.screen!=='concept-fc'||!S)return;
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable))return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(document.body.classList.contains('fcx-ended')){if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();exitSession();}return;}
  if(/^[1-4]$/.test(e.key)){e.preventDefault();window.fcAnswer(+e.key);return;}
  if(e.key==='r'||e.key==='R'){e.preventDefault();window.fcxToggleDir();return;}
  if(e.key==='Enter'){e.preventDefault();if(flipped)window.fcAnswer(3);else setFlip(true);return;}
  if(e.key==='Escape'){e.preventDefault();window.endFCSession();}
});
})();
