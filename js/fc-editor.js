/* =========================================================
   fc-editor.js — Création de flashcards façon Knowt (15 nov. 2026, soir)
   1. Fenêtre « Créer » (fceCreate) : tuiles PDF + IA, partir de zéro, depuis mes QCM, avec des images,
      Anki / Quizlet, sujet + IA.
   2. Éditeur plein écran #screen-fc-editor (fceOpen(key) / fceNew(opts)) : titre + description du paquet,
      cartes numérotées (terme / définition en texte enrichi : gras, italique, souligné, barré, surligné,
      indice, exposant), image recto / verso (clic, coller, glisser ; réduite à 1000 px), inverser, supprimer,
      glisser pour réordonner, recherche, inverser tout, importer une liste, depuis mes QCM.
      Enregistrement AUTOMATIQUE (700 ms) dans concepts (dossiers conceptFolders) ou flashcards (cours).
      Champs : term / definition (texte simple, utilisé partout) + termHtml / defHtml (mise en forme, facultatif),
      imageQ / imageA ; dossier : name + desc.
   3. Assistant IA à droite (Gemini, ai-gemini.js) : créer des cartes sur un sujet, texte à trous, Q/R,
      depuis un PDF, compléter les définitions vides, améliorer ; aperçu à cocher puis « Ajouter ».
   4. Vue d'un dossier (après renderAFCList) : en-tête propre, Modifier / Générer / Ajouter, clic sur une
      carte = l'éditeur sur cette carte.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function G(name,def){try{const v=eval(name);return v===undefined?def:v;}catch(e){return def;}}
const nid=()=>(typeof uid==='function'?uid():Date.now().toString(36)+Math.random().toString(36).slice(2,8));
let kSeq=0;const lk=()=>'r'+(++kSeq);

/* ───────── Texte enrichi sûr ───────── */
const OK_TAGS={B:'b',STRONG:'b',I:'i',EM:'i',U:'u',S:'s',STRIKE:'s',MARK:'mark',SUB:'sub',SUP:'sup',BR:'br'};
function clean(node){
  let out='';
  node.childNodes.forEach(n=>{
    if(n.nodeType===3){out+=esc(n.nodeValue);return;}
    if(n.nodeType!==1)return;
    const t=OK_TAGS[n.tagName];
    if(t==='br'){out+='<br>';return;}
    const inner=clean(n);
    if(/^(DIV|P|LI)$/.test(n.tagName)){out+=(out&&!/<br>$/.test(out)?'<br>':'')+inner;return;}
    if(n.tagName==='SPAN'&&n.style&&/background/.test(n.getAttribute('style')||'')&&inner){out+='<mark>'+inner+'</mark>';return;}
    out+=t?`<${t}>${inner}</${t}>`:inner;
  });
  return out;
}
window.fcxSafeHtml=function(html){const d=document.createElement('div');d.innerHTML=String(html||'');return clean(d).replace(/(<br>)+$/,'');};
const plainOf=el=>{const d=document.createElement('div');d.innerHTML=fcxSafeHtml(el.innerHTML).replace(/<br>/g,'\n');return (d.textContent||'').replace(/ /g,' ').trim();};
const hasFmt=h=>/<(b|i|u|s|mark|sub|sup)>/.test(h);

/* ───────── État ───────── */
const E={key:null,kind:'folder',title:'',desc:'',rows:[],deleted:new Set(),saveT:0,savedAt:0,q:'',ai:{open:true,file:null,props:null,busy:false},back:'all-flashcards'};
function folders(){return G('conceptFolders',[])||[];}
function listFor(kind){return kind==='course'?G('flashcards',[]):G('concepts',[]);}
function load(key){
  E.key=key;E.deleted=new Set();E.q='';E.ai.props=null;
  E.kind=key&&key.startsWith('__course_')?'course':'folder';
  let items=[];
  if(E.kind==='course'){const cid=key.slice(9);items=(G('flashcards',[])||[]).filter(f=>f.courseId===cid);const c=(G('courses',[])||[]).find(x=>x.id===cid);E.title=c?c.name:'Cours';E.desc='';}
  else if(key==='__none__'){items=(G('concepts',[])||[]).filter(c=>!c.folderId);E.title='Sans dossier';E.desc='';}
  else if(key){const f=folders().find(x=>x.id===key);items=(G('concepts',[])||[]).filter(c=>c.folderId===key);E.title=f?f.name:'';E.desc=f&&f.desc||'';}
  else{E.title='';E.desc='';}
  E.rows=items.map(c=>({k:lk(),id:c.id,term:c.term||'',def:c.definition||'',termHtml:c.termHtml||'',defHtml:c.defHtml||'',imageQ:c.imageQ||c.image||null,imageA:c.imageA||null,imageQEdit:c.imageQEdit||null,imageAEdit:c.imageAEdit||null}));
}
const blank=()=>({k:lk(),id:null,term:'',def:'',termHtml:'',defHtml:'',imageQ:null,imageA:null,imageQEdit:null,imageAEdit:null});
const isEmpty=r=>!r.term.trim()&&!r.def.trim()&&!r.imageQ&&!r.imageA;

/* ───────── Enregistrement automatique ───────── */
function schedule(){clearTimeout(E.saveT);setSaved('…');E.saveT=setTimeout(commit,700);}
function ensureFolder(){
  if(E.kind==='course'||E.key)return;
  if(!E.rows.some(r=>!isEmpty(r))&&!E.title.trim())return;
  const cf=folders();
  const f={id:nid(),name:E.title.trim()||'Nouveau paquet',color:'#'+(['3D63FF','8B5CF6','EC4899','F59E0B','10B981','0EA5E9'][cf.length%6])};
  if(E.desc.trim())f.desc=E.desc.trim();
  cf.push(f);E.key=f.id;
}
function commit(){
  clearTimeout(E.saveT);E.saveT=0;
  ensureFolder();
  if(!E.key&&E.kind!=='course'){setSaved('');return;}
  const list=listFor(E.kind);if(!list)return;
  const cid=E.kind==='course'?E.key.slice(9):null,fid=E.kind==='folder'&&E.key!=='__none__'?E.key:null;
  const now=new Date().toISOString(),sp=G('fcSpacedData',null);
  E.rows.forEach(r=>{
    const empty=isEmpty(r);
    if(r.id){
      const i=list.findIndex(x=>x.id===r.id);if(i<0)return;
      if(empty){list.splice(i,1);if(sp)delete sp[r.id];r.id=null;return;}
      const c=list[i];
      c.term=r.term;c.definition=r.def;
      if(r.termHtml)c.termHtml=r.termHtml;else delete c.termHtml;
      if(r.defHtml)c.defHtml=r.defHtml;else delete c.defHtml;
      if(r.imageQ)c.imageQ=r.imageQ;else delete c.imageQ;
      if(r.imageA)c.imageA=r.imageA;else delete c.imageA;
      if(r.imageQ&&r.imageQEdit)c.imageQEdit=r.imageQEdit;else delete c.imageQEdit;   /* v85 : annotations modifiables (kc-imgedit.js) */
      if(r.imageA&&r.imageAEdit)c.imageAEdit=r.imageAEdit;else delete c.imageAEdit;
      if(c.image&&!r.imageQ)delete c.image;
    }else if(!empty){
      const c=E.kind==='course'
        ?{id:nid(),courseId:cid,term:r.term,definition:r.def,keywords:[],createdAt:now}
        :{id:nid(),term:r.term,questionId:null,state:'toExplain',definition:r.def,keywords:[],masteryLevel:0,nextReview:null,lastReview:null,createdAt:now,folderId:fid};
      if(r.termHtml)c.termHtml=r.termHtml;if(r.defHtml)c.defHtml=r.defHtml;
      if(r.imageQ)c.imageQ=r.imageQ;if(r.imageA)c.imageA=r.imageA;
      if(r.imageQ&&r.imageQEdit)c.imageQEdit=r.imageQEdit;if(r.imageA&&r.imageAEdit)c.imageAEdit=r.imageAEdit;
      list.push(c);r.id=c.id;
    }
  });
  const userDel=E.deleted.size>0;   /* « Annuler » n'est proposé que pour une carte supprimée avec la corbeille, pas pour une carte vidée */
  E.deleted.forEach(id=>{const i=list.findIndex(x=>x.id===id);if(i>=0)list.splice(i,1);if(sp)delete sp[id];});
  E.deleted.clear();
  // ordre de l'éditeur = ordre dans le tableau (mêmes emplacements)
  const ids=E.rows.map(r=>r.id).filter(Boolean),set=new Set(ids),slots=[];
  list.forEach((x,i)=>{if(set.has(x.id))slots.push(i);});
  if(slots.length===ids.length){const by={};list.forEach(x=>{by[x.id]=x;});slots.forEach((s,j)=>{list[s]=by[ids[j]];});}
  if(E.kind==='folder'&&E.key&&E.key!=='__none__'){const f=folders().find(x=>x.id===E.key);if(f){if(E.title.trim())f.name=E.title.trim();if(E.desc.trim())f.desc=E.desc.trim();else delete f.desc;}}
  let ok=false;try{ok=saveAll(userDel?undefined:{noUndo:true})!==false;}catch(e){}
  if(ok){E.savedAt=Date.now();setSaved();}else setSaved('Enregistrement impossible (mémoire pleine)','err');
  remember();
}
/* Paquet en cours (16 nov. 2026) : tant qu'on n'a pas cliqué sur « Terminé », le site propose de le reprendre
   (pastille « Continuer » en haut à gauche, même après un rechargement de la page). */
const OPEN_KEY='kp_fce_open';
function remember(){try{if(E.key&&document.body.dataset.screen==='fc-editor')localStorage.setItem(OPEN_KEY,JSON.stringify({key:E.key,ts:Date.now()}));}catch(e){}}
function forget(){try{localStorage.removeItem(OPEN_KEY);}catch(e){}pill();}
function pending(){
  let o=null;try{o=JSON.parse(localStorage.getItem(OPEN_KEY)||'null');}catch(e){}
  if(!o||!o.key)return null;
  let name='',n=0;
  if(o.key.startsWith('__course_')){const cid=o.key.slice(9),c=(G('courses',[])||[]).find(x=>x.id===cid);if(!c)return null;name=c.name;n=(G('flashcards',[])||[]).filter(f=>f.courseId===cid).length;}
  else if(o.key==='__none__'){name='Sans dossier';n=(G('concepts',[])||[]).filter(c=>!c.folderId).length;}
  else{const f=folders().find(x=>x.id===o.key);if(!f)return null;name=f.name;n=(G('concepts',[])||[]).filter(c=>c.folderId===o.key).length;}
  return {key:o.key,name,n};
}
function pill(){
  let el=$('kc-resume');
  const p=document.body.dataset.screen==='fc-editor'?null:pending();
  if(!p){if(el)el.remove();return;}
  if(!el){
    el=document.createElement('div');el.id='kc-resume';el.className='kc-resume';
    const logo=document.querySelector('header.topbar .logo');
    if(logo&&logo.parentNode)logo.parentNode.insertBefore(el,logo.nextSibling);else document.body.appendChild(el);
    el.addEventListener('click',e=>{
      if(e.target.closest('.kc-resume-x')){forget();return;}
      const q=pending();if(q)window.fceOpen(q.key,null,{add:false});
    });
  }
  el.innerHTML=`<button class="kc-resume-go" title="Reprendre là où tu t’étais arrêté"><span class="ms">edit_note</span><span class="kc-resume-t"><b>Continuer tes flashcards</b><i>${esc(p.name)} · ${p.n} carte${p.n!==1?'s':''}</i></span></button><button class="kc-resume-x" title="Ne plus proposer (tes cartes restent enregistrées)" aria-label="Fermer"><span class="ms">close</span></button>`;
}
window.fcePill=pill;
window.fceReload=function(){if(document.body.dataset.screen!=='fc-editor'||!E.key)return;load(E.key);if(!E.rows.length)E.rows.push(blank());render();};
function setSaved(txt,cls){
  const el=$('fce-saved');if(!el)return;
  if(txt!==undefined){el.textContent=txt;el.className='fce-saved'+(cls?' '+cls:'');return;}
  el.className='fce-saved ok';el.innerHTML='<span class="ms">cloud_done</span>Enregistré';
}

/* ───────── Ouverture ───────── */
window.fceOpen=function(key,focusId,o){
  o=o||{};
  E.back=G('_afcView','hub')!=='hub'?'folder':'all-flashcards';
  load(key);
  if(!E.rows.length||o.add)E.rows.push(blank());
  showScreen('fc-editor');
  render();
  remember();pill();
  afterOpen(focusId,o);
};
window.fceNew=function(o){
  o=o||{};
  E.back='all-flashcards';
  load(null);
  E.rows=o.rows&&o.rows.length?o.rows:[blank(),blank(),blank()];
  if(o.title)E.title=o.title;
  showScreen('fc-editor');
  render();
  afterOpen(null,o);
};
function afterOpen(focusId,o){
  if(o.ai&&!E.ai.open)fceToggleAI();
  if(o.importList)setTimeout(fceImport,80);
  if(o.qcm)setTimeout(fceFromQcm,80);
  if(o.pdf)setTimeout(()=>{const f=$('fce-ai-file');if(f)f.click();},120);
  if(o.topic)setTimeout(()=>aiPreset(o.topic),80);
  if(o.img)setTimeout(()=>{const b=document.querySelector('#fce-list .fce-card .fce-img[data-s="q"]');if(b)b.click();},120);
  setTimeout(()=>{
    let el=null;
    if(focusId){const r=E.rows.find(x=>x.id===focusId);if(r){const c=document.querySelector(`.fce-card[data-k="${r.k}"]`);if(c){c.scrollIntoView({block:'center'});c.classList.add('fce-flash');el=c.querySelector('[data-f="term"]');}}}
    else if(!o.ai&&!o.importList&&!o.qcm&&!o.pdf&&!o.topic){const r=E.rows.find(isEmpty);if(r)el=document.querySelector(`.fce-card[data-k="${r.k}"] [data-f="term"]`);else el=$('fce-title');if(!E.key&&!E.title)el=$('fce-title');}
    if(el)el.focus();
  },60);
}
window.fceClose=function(){
  commit();forget();
  const key=E.key;
  if(E.back==='folder'&&key){showScreen('all-flashcards');if(typeof afcOpenView==='function')afcOpenView(key);}
  else{try{if(typeof _afcView!=='undefined')_afcView='hub';}catch(e){}showScreen('all-flashcards');}
};
window.fceStudy=function(){
  commit();forget();
  const key=E.key;if(!key){showNotif('Ajoute au moins une carte','err');return;}
  if(typeof fcxStartKey==='function')fcxStartKey(key);
};

/* ───────── Rendu ───────── */
function cardHTML(r,i){
  const img=(s,src)=>src?`<div class="fce-img has" data-s="${s}" title="Cliquer pour surligner, annoter ou modifier la photo"><img src="${src}" alt=""><button class="fce-img-x" data-act="rmimg" data-s="${s}" tabindex="-1" title="Retirer l’image"><span class="ms">close</span></button></div>`
    :`<button class="fce-img" data-s="${s}" tabindex="-1" title="Ajouter une image (ou colle-la avec Ctrl+V)"><span class="ms">add_photo_alternate</span><span>Image</span></button>`;
  const ed=(f,html,txt,ph)=>`<div class="fce-ed" contenteditable="true" spellcheck="true" data-f="${f}" data-ph="${ph}" role="textbox" aria-multiline="true" aria-label="${ph}">${html?fcxSafeHtml(html):esc(txt).replace(/\n/g,'<br>')}</div>`;
  return `<div class="fce-card" data-k="${r.k}">
    <div class="fce-card-top">
      <span class="fce-num">${i+1}</span>
      <span class="fce-flex"></span>
      <button class="fce-tb" data-act="ai" tabindex="-1" title="Compléter avec l’IA"><span class="ms">auto_awesome</span></button>
      <button class="fce-tb fce-grip" tabindex="-1" title="Glisser pour déplacer"><span class="ms">drag_indicator</span></button>
      <button class="fce-tb" data-act="swap" tabindex="-1" title="Inverser terme et définition"><span class="ms">swap_vert</span></button>
      <button class="fce-tb del" data-act="del" tabindex="-1" title="Supprimer la carte"><span class="ms">delete</span></button>
    </div>
    <div class="fce-sides">
      <div class="fce-side">${img('q',r.imageQ)}<div class="fce-field">${ed('term',r.termHtml,r.term,'Terme, question…')}<label>Terme</label></div></div>
      <div class="fce-side">${img('a',r.imageA)}<div class="fce-field">${ed('def',r.defHtml,r.def,'Définition, réponse…')}<label>Définition</label></div></div>
    </div>
  </div>`;
}
function render(){
  const root=$('fce-root');if(!root)return;
  const isCourse=E.kind==='course',fixedTitle=isCourse||E.key==='__none__';
  root.className='fce'+(E.ai.open?' fce-ai-on':'');
  root.innerHTML=`
  <div class="fce-main">
    <section class="fce-head">
      <div class="fce-top">
        <button class="kf-crumb" onclick="fceClose()"><span class="ms">arrow_back</span>${E.back==='folder'?'Dossier':'Flashcards'}</button>
        <span class="fce-saved" id="fce-saved"></span>
      </div>
      <div class="fce-h1row">
        <h1>${E.key?'Modifier les flashcards':'Créer des flashcards'}</h1>
        <span class="fce-flex"></span>
        <button class="btn btn-p" onclick="fceStudy()"><span class="ms">play_arrow</span>Enregistrer et réviser</button>
      </div>
      <div class="fce-fields">
        <label class="fce-lab"><span>Titre</span><input class="fi" id="fce-title" maxlength="80" placeholder="Ex. : Muscles de la coiffe des rotateurs" value="${esc(E.title)}"${fixedTitle?' disabled':''}></label>
        ${fixedTitle?'':`<label class="fce-lab"><span>Description</span><input class="fi" id="fce-desc" maxlength="200" placeholder="Ajoute une description (facultatif)" value="${esc(E.desc)}"></label>`}
      </div>
    </section>
    <div class="fce-toolbar">
      <label class="fce-search"><span class="ms">search</span><input id="fce-q" placeholder="Rechercher dans les cartes" value="${esc(E.q)}"></label>
      <span class="fce-flex"></span>
      <button class="btn btn-g btn-sm" onclick="fceImport()"><span class="ms">download</span>Importer</button>
      <button class="btn btn-g btn-sm" onclick="fceFromQcm()"><span class="ms">quiz</span>Depuis mes QCM</button>
      <button class="fce-tbb" title="Inverser tous les termes et définitions" onclick="fceSwapAll()"><span class="ms">swap_horiz</span></button>
      <button class="fce-tbb fce-ai-t${E.ai.open?' on':''}" title="Assistant IA" onclick="fceToggleAI()"><span class="ms">auto_awesome</span></button>
    </div>
    <div class="fce-list" id="fce-list">${E.rows.map(cardHTML).join('')}</div>
    <button class="fce-add" onclick="fceAddRow(true)"><span class="ms">add</span>Ajouter une carte<kbd>Ctrl + Entrée</kbd></button>
    <div class="fce-foot"><span id="fce-count"></span><span class="fce-flex"></span><button class="btn btn-g" onclick="fceClose()">Terminé</button><button class="btn btn-p" onclick="fceStudy()"><span class="ms">play_arrow</span>Réviser</button></div>
  </div>
  <aside class="fce-ai" id="fce-ai">${aiHTML()}</aside>
  <div class="fce-fmt" id="fce-fmt" role="toolbar" aria-label="Mise en forme">
    <button data-cmd="bold" title="Gras (Ctrl+B)"><span class="ms">format_bold</span></button>
    <button data-cmd="italic" title="Italique (Ctrl+I)"><span class="ms">format_italic</span></button>
    <button data-cmd="underline" title="Souligné (Ctrl+U)"><span class="ms">format_underlined</span></button>
    <button data-cmd="strikeThrough" title="Barré"><span class="ms">strikethrough_s</span></button>
    <button data-cmd="mark" title="Surligner"><span class="ms">ink_highlighter</span></button>
    <button data-cmd="subscript" title="Indice (ex. H₂O)"><span class="ms">subscript</span></button>
    <button data-cmd="superscript" title="Exposant (ex. Ca²⁺)"><span class="ms">superscript</span></button>
    <button data-cmd="removeFormat" title="Effacer la mise en forme"><span class="ms">format_clear</span></button>
  </div>
  <input type="file" id="fce-file" accept="image/*" hidden>`;
  bind();count();filter();
  if(E.savedAt)setSaved();
}
function count(){
  const n=E.rows.filter(r=>!isEmpty(r)).length,el=$('fce-count');
  if(el)el.textContent=n+' carte'+(n!==1?'s':'');
  document.querySelectorAll('#fce-list .fce-num').forEach((x,i)=>{x.textContent=i+1;});
}
function filter(){
  const q=(E.q||'').toLowerCase().trim();
  document.querySelectorAll('#fce-list .fce-card').forEach(c=>{
    const r=E.rows.find(x=>x.k===c.dataset.k);
    c.hidden=!!q&&!!r&&!((r.term+' '+r.def).toLowerCase().includes(q));
  });
}
const rowOf=el=>{const c=el&&el.closest('.fce-card');return c?E.rows.find(r=>r.k===c.dataset.k):null;};

/* ───────── Interactions ───────── */
let imgTarget=null,fmtFor=null;
function bind(){
  const root=$('fce-root'),list=$('fce-list');
  const t=$('fce-title'),d=$('fce-desc'),q=$('fce-q');
  if(t)t.addEventListener('input',()=>{E.title=t.value;schedule();});
  if(d)d.addEventListener('input',()=>{E.desc=d.value;schedule();});
  if(q)q.addEventListener('input',()=>{E.q=q.value;filter();});
  list.addEventListener('input',e=>{
    const ed=e.target.closest('.fce-ed');if(!ed)return;
    const r=rowOf(ed);if(!r)return;
    const h=fcxSafeHtml(ed.innerHTML),txt=plainOf(ed);
    if(ed.dataset.f==='term'){r.term=txt;r.termHtml=hasFmt(h)?h:'';}else{r.def=txt;r.defHtml=hasFmt(h)?h:'';}
    count();schedule();
  });
  list.addEventListener('click',e=>{
    const b=e.target.closest('[data-act],.fce-img');if(!b)return;
    const r=rowOf(b);if(!r)return;
    const act=b.dataset.act;
    if(act==='del'){delRow(r);return;}
    if(act==='swap'){[r.term,r.def]=[r.def,r.term];[r.termHtml,r.defHtml]=[r.defHtml,r.termHtml];[r.imageQ,r.imageA]=[r.imageA,r.imageQ];[r.imageQEdit,r.imageAEdit]=[r.imageAEdit,r.imageQEdit];rerenderRow(r);schedule();return;}
    if(act==='ai'){aiRow(r,b);return;}
    if(act==='rmimg'){e.stopPropagation();r[b.dataset.s==='q'?'imageQ':'imageA']=null;r[b.dataset.s==='q'?'imageQEdit':'imageAEdit']=null;rerenderRow(r);schedule();return;}
    if(b.classList.contains('has')){zoomImg(r,b.dataset.s);return;}
    if(b.classList.contains('fce-img')){imgTarget={r,s:b.dataset.s};$('fce-file').click();}
  });
  $('fce-file').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f&&imgTarget)await setImg(imgTarget.r,imgTarget.s,f);});
  list.addEventListener('paste',async e=>{
    const ed=e.target.closest('.fce-ed');if(!ed)return;
    const items=[...((e.clipboardData&&e.clipboardData.items)||[])],im=items.find(x=>x.type&&x.type.startsWith('image/'));
    e.preventDefault();
    if(im){const r=rowOf(ed);if(r)await setImg(r,ed.dataset.f==='term'?'q':'a',im.getAsFile());return;}
    const txt=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';
    // une liste collée (plusieurs lignes avec tabulations) → proposition d'import
    if(/\t/.test(txt)&&txt.trim().split('\n').length>2){fceImport(txt);return;}
    document.execCommand('insertText',false,txt);
  });
  list.addEventListener('dragover',e=>{const c=e.target.closest('.fce-side');if(c&&[...(e.dataTransfer.items||[])].some(x=>x.kind==='file')){e.preventDefault();c.classList.add('over');}});
  list.addEventListener('dragleave',e=>{const c=e.target.closest('.fce-side');if(c)c.classList.remove('over');});
  list.addEventListener('drop',async e=>{
    const c=e.target.closest('.fce-side');if(!c)return;
    const f=[...(e.dataTransfer.files||[])].find(x=>x.type.startsWith('image/'));if(!f)return;
    e.preventDefault();c.classList.remove('over');
    const r=rowOf(c),ed=c.querySelector('.fce-ed');if(r&&ed)await setImg(r,ed.dataset.f==='term'?'q':'a',f);
  });
  list.addEventListener('keydown',e=>{
    const ed=e.target.closest('.fce-ed');if(!ed)return;
    if(e.key==='Tab'&&!e.shiftKey&&ed.dataset.f==='def'){const r=rowOf(ed);if(r&&E.rows[E.rows.length-1]===r){e.preventDefault();fceAddRow(true);}}
  });
  list.addEventListener('focusin',e=>{const ed=e.target.closest('.fce-ed');if(ed)showFmt(ed);});
  list.addEventListener('focusout',e=>{setTimeout(()=>{const a=document.activeElement;if(!a||!a.closest||(!a.closest('.fce-ed')&&!a.closest('#fce-fmt')))hideFmt();},120);});
  const fmt=$('fce-fmt');
  fmt.addEventListener('pointerdown',e=>e.preventDefault());
  fmt.addEventListener('click',e=>{
    const b=e.target.closest('[data-cmd]');if(!b||!fmtFor)return;
    fmtFor.focus();
    const c=b.dataset.cmd;
    if(c==='mark'){const s=window.getSelection();const tx=s&&s.toString();if(tx){const inMark=s.anchorNode&&s.anchorNode.parentElement&&s.anchorNode.parentElement.closest('mark');if(inMark){inMark.replaceWith(...inMark.childNodes);}else document.execCommand('insertHTML',false,'<mark>'+esc(tx)+'</mark>');}}
    else document.execCommand(c,false,null);
    fmtFor.dispatchEvent(new Event('input',{bubbles:true}));
  });
  initDrag(list);
  bindAI();
}
/* v70 : la barre de mise en forme se range dans le haut de la carte où l'on écrit (avant : flottante, elle passait sur le texte). */
function showFmt(ed){
  const f=$('fce-fmt'),card=ed.closest('.fce-card'),top=card&&card.querySelector('.fce-card-top');if(!f||!top)return;
  fmtFor=ed;
  const sp=top.querySelector('.fce-flex');
  if(f.parentNode!==top)top.insertBefore(f,sp||null);
  f.classList.add('on','docked');
}
function hideFmt(){
  const f=$('fce-fmt');fmtFor=null;if(!f)return;
  f.classList.remove('on','docked');
  const root=$('fce-root');if(root&&f.parentNode!==root)root.appendChild(f);
}
function placeFmt(){}
/* Photo d'une carte en grand ; « Changer » et « Retirer » sont dans cette vue. */
function zoomImg(r,side){
  const src=r[side==='q'?'imageQ':'imageA'];if(!src)return;
  /* v85 : clic sur la photo = éditeur (surligner des zones ou des mots, dessiner, cacher une légende, recadrer, tourner…) */
  if(typeof window.kcImgEdit==='function'){
    const K=side==='q'?'imageQ':'imageA';
    window.kcImgEdit(src,{edit:r[K+'Edit'],onSave:(url,meta)=>{r[K]=url;r[K+'Edit']=meta;rerenderRow(r);schedule();},
      actions:[
        {ic:'add_photo_alternate',label:'Changer',run:()=>{imgTarget={r,s:side};$('fce-file').click();}},
        {ic:'delete',label:'Retirer',run:()=>{r[K]=null;r[K+'Edit']=null;rerenderRow(r);schedule();}}
      ]});
    return;
  }
  /* v72 : visionneuse commune (kc-v72.js) : clic à côté de l'image = fermer, zoom à la molette / double-clic.
     Avant, l'image occupait toute la zone (object-fit) : cliquer « à côté » zoomait au lieu de fermer. */
  if(typeof window.kcImgView==='function'){
    window.kcImgView(src,{actions:[
      {ic:'add_photo_alternate',label:'Changer l’image',run:()=>{imgTarget={r,s:side};$('fce-file').click();}},
      {ic:'delete',label:'Retirer',run:()=>{r[side==='q'?'imageQ':'imageA']=null;rerenderRow(r);schedule();}}
    ]});
    return;
  }
  const bg=document.createElement('div');bg.className='fce-zoom';
  bg.innerHTML=`<div class="fce-zoom-pic"><img src="${src}" alt=""></div><div class="fce-zoom-bar"><button data-z="change"><span class="ms">add_photo_alternate</span>Changer l’image</button><button data-z="rm"><span class="ms">delete</span>Retirer</button><button data-z="close"><span class="ms">close</span>Fermer</button></div>`;
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close();}};
  const close=()=>{bg.remove();document.removeEventListener('keydown',key,true);};
  bg.addEventListener('click',e=>{
    const b=e.target.closest('[data-z]');
    if(!b){if(e.target.tagName==='IMG')bg.classList.toggle('big');else close();return;}
    close();
    if(b.dataset.z==='change'){imgTarget={r,s:side};$('fce-file').click();}
    else if(b.dataset.z==='rm'){r[side==='q'?'imageQ':'imageA']=null;rerenderRow(r);schedule();}
  });
  document.addEventListener('keydown',key,true);
  document.body.appendChild(bg);
}
function rerenderRow(r){
  const c=document.querySelector(`.fce-card[data-k="${r.k}"]`);if(!c)return;
  if(c.contains($('fce-fmt')))hideFmt();
  const i=E.rows.indexOf(r),tmp=document.createElement('div');tmp.innerHTML=cardHTML(r,i);
  c.replaceWith(tmp.firstElementChild);count();
}
function delRow(r){
  const c=document.querySelector(`.fce-card[data-k="${r.k}"]`);
  const go=()=>{
    if(c&&c.contains($('fce-fmt')))hideFmt();
    const i=E.rows.indexOf(r);if(i<0)return;
    E.rows.splice(i,1);if(r.id)E.deleted.add(r.id);
    if(c)c.remove();
    if(!E.rows.length)fceAddRow(false);
    count();schedule();
  };
  if(c){c.classList.add('fce-out');setTimeout(go,180);}else go();
}
/* Ctrl + Entrée (ou ⌘ + Entrée) = nouvelle carte, n'importe où dans l'éditeur, même sans avoir cliqué dans un champ (v69) */
document.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.key!=='Enter'||e.defaultPrevented)return;
  if(document.body.dataset.screen!=='fc-editor'||!$('fce-list'))return;
  if(document.querySelector('.kc-dlg-bg,.mdbg.open,.fce-aipop'))return;
  const t=e.target;if(t&&t.closest&&t.closest('#fce-ai'))return;
  e.preventDefault();window.fceAddRow(true);
});
window.fceAddRow=function(focus,r){
  r=r||blank();E.rows.push(r);
  const list=$('fce-list');if(!list)return r;
  const tmp=document.createElement('div');tmp.innerHTML=cardHTML(r,E.rows.length-1);
  const el=tmp.firstElementChild;el.classList.add('fce-in');list.appendChild(el);count();
  if(focus){const ed=el.querySelector('[data-f="term"]');if(ed){ed.focus();el.scrollIntoView({block:'nearest',behavior:'smooth'});}}
  return r;
};
window.fceSwapAll=function(){
  if(!E.rows.length)return;
  E.rows.forEach(r=>{[r.term,r.def]=[r.def,r.term];[r.termHtml,r.defHtml]=[r.defHtml,r.termHtml];[r.imageQ,r.imageA]=[r.imageA,r.imageQ];[r.imageQEdit,r.imageAEdit]=[r.imageAEdit,r.imageQEdit];});
  render();schedule();showNotif('Termes et définitions inversés','ok');
};
async function setImg(r,s,file){
  if(!file||!file.type.startsWith('image/')){showNotif('Choisis une image','err');return;}
  try{
    const url=await shrink(file,1000);
    r[s==='q'?'imageQ':'imageA']=url;r[s==='q'?'imageQEdit':'imageAEdit']=null;rerenderRow(r);schedule();
  }catch(e){showNotif('Image illisible','err');}
}
function shrink(file,max){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>{const im=new Image();im.onload=()=>{
      const k=Math.min(1,max/Math.max(im.width,im.height)),w=Math.round(im.width*k),h=Math.round(im.height*k);
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
      res(cv.toDataURL('image/jpeg',.82));
    };im.onerror=rej;im.src=fr.result;};
    fr.onerror=rej;fr.readAsDataURL(file);
  });
}
function initDrag(list){
  list.addEventListener('pointerdown',e=>{
    const grip=e.target.closest('.fce-grip');if(!grip)return;
    const card=grip.closest('.fce-card');if(!card)return;
    e.preventDefault();grip.setPointerCapture(e.pointerId);
    const r0=card.getBoundingClientRect(),y0=e.clientY;
    const ph=document.createElement('div');ph.className='fce-ph';ph.style.height=r0.height+'px';card.after(ph);
    card.classList.add('fce-drag');card.style.width=r0.width+'px';card.style.left=r0.left+'px';card.style.top=r0.top+'px';
    const move=ev=>{
      card.style.transform=`translateY(${ev.clientY-y0}px)`;
      let before=null;
      for(const s of list.querySelectorAll('.fce-card:not(.fce-drag)')){const r=s.getBoundingClientRect();if(ev.clientY<r.top+r.height/2){before=s;break;}}
      if(before){if(ph.nextElementSibling!==before)list.insertBefore(ph,before);}else if(list.lastElementChild!==ph)list.appendChild(ph);
      if(ev.clientY<80)window.scrollBy(0,-12);else if(ev.clientY>window.innerHeight-80)window.scrollBy(0,12);
    };
    const up=()=>{
      grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',up);grip.removeEventListener('pointercancel',up);
      ph.replaceWith(card);card.classList.remove('fce-drag');card.style.cssText='';
      const order=[...list.querySelectorAll('.fce-card')].map(c=>c.dataset.k);
      E.rows.sort((a,b)=>order.indexOf(a.k)-order.indexOf(b.k));count();schedule();
    };
    grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',up);grip.addEventListener('pointercancel',up);
  });
}

/* ───────── Petites fenêtres (import, QCM, créer) ───────── */
function dlg(html,cls){
  document.querySelectorAll('.fcd-bg').forEach(x=>x.remove());
  const bg=document.createElement('div');bg.className='fcd-bg';
  bg.innerHTML=`<div class="fcd ${cls||''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(bg);
  const close=()=>bg.remove();
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-close]'))close();});
  bg.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  return {el:bg.firstElementChild,close};
}
function parseList(txt){
  return String(txt||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
    let m=l.split('\t');if(m.length>=2)return [m[0],m.slice(1).join(' ')];
    for(const sep of [' — ',' – ',' - ',' : ',' :: ',' | ',';',':']){const i=l.indexOf(sep);if(i>0)return [l.slice(0,i),l.slice(i+sep.length)];}
    return null;
  }).filter(x=>x&&x[0].trim()&&x[1].trim()).map(([a,b])=>[a.trim(),b.trim()]);
}
function addRows(pairs){
  // remplace les cartes vides du bas, puis ajoute
  pairs.forEach(([a,b])=>{
    let r=E.rows.find(isEmpty);
    if(!r){r=blank();E.rows.push(r);}
    r.term=a;r.def=b;r.termHtml='';r.defHtml='';
  });
  render();schedule();
  setTimeout(()=>{const l=document.querySelectorAll('#fce-list .fce-card');if(l.length)l[l.length-1].scrollIntoView({block:'end',behavior:'smooth'});},50);
}
window.fceImport=function(pre){
  const d=dlg(`<button class="fcd-x" data-close aria-label="Fermer"><span class="ms">close</span></button>
    <h2><span class="ms">download</span>Importer une liste</h2>
    <p class="fcd-lead">Colle tes cartes : <b>une par ligne</b>, terme et définition séparés par une tabulation (export Anki / Quizlet), « - », « : » ou « ; ».</p>
    <textarea class="fi fcd-ta" rows="9" placeholder="Biceps brachial\tFléchisseur du coude, supinateur&#10;Deltoïde - Abducteur du bras"></textarea>
    <div class="fcd-row"><span class="fcd-count">0 carte détectée</span><span class="fce-flex"></span><button class="btn btn-g" data-close>Annuler</button><button class="btn btn-p fcd-go" disabled><span class="ms">add</span>Ajouter</button></div>`,'fcd-sm');
  const ta=d.el.querySelector('textarea'),cn=d.el.querySelector('.fcd-count'),go=d.el.querySelector('.fcd-go');
  const upd=()=>{const n=parseList(ta.value).length;cn.textContent=n+' carte'+(n>1?'s':'')+' détectée'+(n>1?'s':'');go.disabled=!n;go.innerHTML=`<span class="ms">add</span>Ajouter ${n||''}`;};
  ta.addEventListener('input',upd);if(typeof pre==='string'){ta.value=pre;upd();}
  go.onclick=()=>{const p=parseList(ta.value);d.close();addRows(p);showNotif(p.length+' cartes importées','ok');};
  setTimeout(()=>ta.focus(),40);
};
window.fceFromQcm=function(){
  const F=(G('folders',[])||[]).filter(f=>!f.isAnnale),C=G('courses',[])||[],Q=G('questions',[])||[];
  const qn={};Q.forEach(q=>{qn[q.courseId]=(qn[q.courseId]||0)+1;});
  const opts=F.map(f=>{const cs=C.filter(c=>c.folderId===f.id&&qn[c.id]);return cs.length?`<optgroup label="${esc(f.name)}">${cs.map(c=>`<option value="${c.id}">${esc(c.name)} (${qn[c.id]} QCM)</option>`).join('')}</optgroup>`:'';}).join('');
  if(!opts){showNotif('Tu n’as pas encore de QCM','err');return;}
  const d=dlg(`<button class="fcd-x" data-close aria-label="Fermer"><span class="ms">close</span></button>
    <h2><span class="ms">quiz</span>Depuis mes QCM</h2>
    <p class="fcd-lead">Chaque question devient une carte : la question au recto, la bonne réponse au verso.</p>
    <select class="fi fcd-sel">${opts}</select>
    <label class="fcd-chk"><input type="checkbox" checked> Ajouter l’explication au verso quand il y en a une</label>
    <div class="fcd-row"><span class="fce-flex"></span><button class="btn btn-g" data-close>Annuler</button><button class="btn btn-p fcd-go"><span class="ms">add</span>Créer les cartes</button></div>`,'fcd-sm');
  d.el.querySelector('.fcd-go').onclick=()=>{
    const cid=d.el.querySelector('select').value,withE=d.el.querySelector('input').checked;
    const bo=G('boycottedQuestions',{})||{};
    const qs=Q.filter(q=>q.courseId===cid&&!bo[q.id]);
    const pairs=qs.map(q=>{const ok=Array.isArray(q.correct)?q.correct:[q.correct];const a=ok.map(i=>(q.answers||[])[i]).filter(Boolean).join(' / ');return [String(q.question||'').trim(),(a+(withE&&q.expl?'\n\n'+q.expl:'')).trim()];}).filter(p=>p[0]&&p[1]);
    d.close();
    if(!E.title){const c=C.find(x=>x.id===cid);if(c){E.title=c.name;}}
    addRows(pairs);showNotif(pairs.length+' cartes créées depuis tes QCM','ok');
  };
};
window.fceCreate=function(){
  const tiles=[
    ['picture_as_pdf','#EF4444','Depuis un PDF','L’IA lit ton cours et crée les cartes essentielles',"fceNew({ai:true,pdf:true})"],
    ['edit_note','#3D63FF','Partir de zéro','Écris tes cartes une par une, avec mise en forme',"fceNew()"],
    ['quiz','#10B981','Depuis mes QCM','Chaque question devient une carte',"fceNew({qcm:true})"],
    ['add_photo_alternate','#F59E0B','Avec des images','Schémas, radios, anatomie : une image au recto ou au verso',"fceNew({img:true})"],
    ['auto_awesome','#8B5CF6','Sur un sujet avec l’IA','Donne un thème, l’IA écrit les cartes',"fceNew({ai:true,topic:'topic'})"],
    ['download','#0EA5E9','Importer depuis une autre appli','Anki, Quizlet, Knowt, Notion, Excel…',"(window.kcImportOpen?kcImportOpen():fceNew({importList:true}))"]
  ];
  const d=dlg(`<button class="fcd-x" data-close aria-label="Fermer"><span class="ms">close</span></button>
    <h2 class="fcc-h">Créer des flashcards</h2><p class="fcd-lead">Choisis comment tu veux commencer</p>
    <div class="fcc-grid">${tiles.map(([ic,c,t,s,fn])=>`<button class="fcc-tile" data-fn="${esc(fn)}"><span class="fcc-ic" style="--c:${c}"><span class="ms">${ic}</span></span><b>${t}</b><small>${s}</small></button>`).join('')}</div>
    <div class="fcc-foot"><button class="btn btn-g btn-sm" data-close onclick="openModal('modal-concept-folder');document.getElementById('cfol-name').value='';document.getElementById('cfol-delete-btn').style.display='none';document.getElementById('cfol-modal-title').textContent='Nouveau dossier';window._editConceptFolderId=null"><span class="ms">create_new_folder</span>Nouveau dossier vide</button></div>`,'fcd-create');
  d.el.querySelectorAll('.fcc-tile').forEach(b=>b.onclick=()=>{d.close();try{(new Function(b.dataset.fn))();}catch(e){console.warn(e);}});
};

/* ───────── Assistant IA ───────── */
const SCHEMA={type:'ARRAY',items:{type:'OBJECT',properties:{recto:{type:'STRING'},verso:{type:'STRING'}},required:['recto','verso']}};
const PRESETS=[
  ['auto_awesome','Créer des cartes sur…','Crée 15 flashcards sur '],
  ['format_strikethrough','Texte à trous sur…','Crée 12 cartes « texte à trous » (une phrase clé avec [ … ] au recto, le mot manquant au verso) sur '],
  ['help','Questions-réponses sur…','Crée 12 flashcards question → réponse sur '],
  ['picture_as_pdf','Depuis un PDF','@pdf'],
  ['edit_note','Compléter les définitions vides','@fill'],
  ['auto_fix_high','Améliorer mes cartes','@improve']
];
function aiHTML(){
  const on=window.KAI&&KAI.hasKey(),f=E.ai.file;
  return `<div class="fce-ai-h"><span class="ms">auto_awesome</span><b>Assistant IA</b><span class="fce-flex"></span><button class="fce-tb" title="Fermer" onclick="fceToggleAI()"><span class="ms">close</span></button></div>
  <div class="fce-ai-body" id="fce-ai-body">
    ${on?'':`<div class="fce-ai-key"><span class="ms">bolt</span><div><b>Active l’IA gratuite</b><small>Gemini de Google : gratuit, 2 minutes, une seule fois.</small></div><button class="btn btn-p btn-sm" onclick="KAI.openKeyDialog().then(()=>fceAIRefresh())">Activer</button></div>`}
    <p class="fce-ai-lead">Dis-moi quelles cartes créer, ou choisis :</p>
    <div class="fce-ai-pre">${PRESETS.map(([ic,t],i)=>`<button class="ua-chip fce-pre" data-i="${i}"><span class="ms">${ic}</span>${t}</button>`).join('')}</div>
    <div id="fce-ai-out">${propsHTML()}</div>
    ${on?'':`<button class="fce-ai-manual" onclick="bciSwitchTab('ia');openModal('modal-bulk-concepts')"><span class="ms">content_paste</span>Sans clé : copier le prompt pour ChatGPT, puis coller la réponse</button>`}
  </div>
  <div class="fce-ai-in">
    ${f?`<div class="fce-ai-file"><span class="ms">picture_as_pdf</span><span>${esc(f.name)}</span><button title="Retirer" onclick="fceAIRmFile()"><span class="ms">close</span></button></div>`:''}
    <div class="fce-ai-box">
      <button class="fce-tb" title="Joindre un PDF" onclick="document.getElementById('fce-ai-file').click()"><span class="ms">attach_file</span></button>
      <textarea id="fce-ai-q" rows="1" placeholder="Ex. : 15 cartes sur les nerfs du membre supérieur"></textarea>
      <button class="fce-ai-send" id="fce-ai-send" onclick="fceAIGo()" aria-label="Envoyer"><span class="ms">${E.ai.busy?'hourglass_top':'arrow_upward'}</span></button>
    </div>
    <input type="file" id="fce-ai-file" accept="application/pdf" hidden>
  </div>`;
}
function propsHTML(){
  const p=E.ai.props;if(!p)return '';
  if(p.loading)return `<div class="fce-ai-load"><span class="fce-spin"></span>${esc(p.loading)}</div>`;
  if(p.err)return `<div class="ua-err"><span class="ms">error</span><span>${esc(p.err)}</span></div>`;
  if(!p.items.length)return '';
  return `<div class="fce-props">
    <div class="fce-props-h"><b>${p.items.length} carte${p.items.length>1?'s':''} proposée${p.items.length>1?'s':''}</b><button class="fce-link" onclick="fceAIAll()">Tout ${p.items.every(x=>x.on)?'décocher':'cocher'}</button></div>
    ${p.items.map((x,i)=>`<label class="fce-prop${x.on?' on':''}"><input type="checkbox" data-i="${i}"${x.on?' checked':''}><span><b>${esc(x.recto)}</b><small>${esc(x.verso)}</small></span></label>`).join('')}
    <div class="fce-props-b"><button class="btn btn-g btn-sm" onclick="fceAIClear()">Effacer</button><button class="btn btn-p btn-sm" onclick="fceAIAdd()"><span class="ms">${p.mode==='improve'?'auto_fix_high':'add'}</span>${p.mode==='improve'?'Remplacer mes cartes':'Ajouter '+p.items.filter(x=>x.on).length+' carte'+(p.items.filter(x=>x.on).length>1?'s':'')}</button></div>
  </div>`;
}
function bindAI(){
  const box=$('fce-ai');if(!box)return;
  box.addEventListener('click',e=>{const b=e.target.closest('.fce-pre');if(b)aiPreset(+b.dataset.i);});
  box.addEventListener('change',e=>{
    if(e.target.id==='fce-ai-file'){const f=e.target.files&&e.target.files[0];e.target.value='';if(f){E.ai.file=f;fceAIRefresh();if(!($('fce-ai-q')||{}).value)aiRun('Crée les flashcards essentielles de ce cours pour l’examen (20 à 30 cartes).');}}
    const cb=e.target.closest('.fce-prop input');if(cb&&E.ai.props){E.ai.props.items[+cb.dataset.i].on=cb.checked;outRefresh();}
  });
  const q=$('fce-ai-q');
  if(q){q.addEventListener('input',()=>{q.style.height='auto';q.style.height=Math.min(q.scrollHeight,140)+'px';});q.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();fceAIGo();}});}
}
window.fceAIRefresh=function(){const a=$('fce-ai');if(a){const v=($('fce-ai-q')||{}).value||'';a.innerHTML=aiHTML();bindAI();const q=$('fce-ai-q');if(q)q.value=v;}};
function outRefresh(){const o=$('fce-ai-out');if(o)o.innerHTML=propsHTML();}
window.fceToggleAI=function(){E.ai.open=!E.ai.open;const r=$('fce-root');if(r)r.classList.toggle('fce-ai-on',E.ai.open);document.querySelectorAll('.fce-ai-t').forEach(b=>b.classList.toggle('on',E.ai.open));if(E.ai.open)setTimeout(()=>{const q=$('fce-ai-q');if(q)q.focus();},60);};
window.fceAIRmFile=function(){E.ai.file=null;fceAIRefresh();};
window.fceAIAll=function(){const p=E.ai.props;if(!p)return;const all=p.items.every(x=>x.on);p.items.forEach(x=>x.on=!all);outRefresh();};
window.fceAIClear=function(){E.ai.props=null;outRefresh();};
function aiPreset(i){
  if(!E.ai.open)fceToggleAI();
  if(i==='topic'){const q=$('fce-ai-q');if(q){q.value='Crée 15 flashcards sur ';q.focus();}return;}
  const p=PRESETS[i];if(!p)return;
  if(p[2]==='@pdf'){$('fce-ai-file').click();return;}
  if(p[2]==='@fill'){aiFill();return;}
  if(p[2]==='@improve'){aiImprove();return;}
  const q=$('fce-ai-q');if(q){q.value=p[2];q.focus();q.setSelectionRange(q.value.length,q.value.length);}
}
window.fceAIGo=function(){
  if(E.ai.busy)return;
  const q=$('fce-ai-q'),t=q?q.value.trim():'';
  if(!t&&!E.ai.file){if(q)q.focus();return;}
  aiRun(t||'Crée les flashcards essentielles de ce cours pour l’examen (20 à 30 cartes).');
};
function existing(){return E.rows.filter(r=>r.term.trim()).map(r=>'- '+r.term.trim().slice(0,80)).slice(0,120).join('\n');}
const SYS='Tu crées des flashcards de révision pour un étudiant en kinésithérapie (anatomie, physiologie, neurologie, biomécanique, pathologies, pharmacologie…). Écris dans la langue de la demande (français par défaut). Recto : court (terme, question précise ou phrase à trous avec [ … ]). Verso : exact, concis (1 à 3 phrases), avec les chiffres et mots-clés utiles à l’examen. Une seule notion par carte, pas de doublon.';
async function aiCall(prompt,extraParts,o){
  if(!window.KAI){showNotif('Module IA non chargé','err');return null;}
  if(!(await KAI.ensureKey())){fceAIRefresh();return null;}
  E.ai.busy=true;fceAIRefresh();
  E.ai.props={loading:(o&&o.loading)||'L’IA écrit tes cartes…',items:[]};outRefresh();
  try{
    const parts=[...(extraParts||[]),{text:prompt}];
    const res=await KAI.ask({system:SYS,contents:[{role:'user',parts}],json:true,schema:(o&&o.schema)||SCHEMA,temperature:.5});
    return res;
  }catch(e){E.ai.props={err:e.message||'Erreur de l’IA',items:[]};if(e.kind==='key')KAI.openKeyDialog();return null;}
  finally{E.ai.busy=false;const s=$('fce-ai-send');if(s)s.innerHTML='<span class="ms">arrow_upward</span>';}
}
async function aiRun(prompt){
  const extra=[];
  if(E.ai.file){try{const p=await KAI.pdfPart(E.ai.file);extra.push(p.part);}catch(e){showNotif(e.message||'PDF illisible','err');}}
  const ex=existing();
  const res=await aiCall(prompt+(ex?'\n\nCartes déjà présentes (ne pas refaire) :\n'+ex:''),extra,{loading:E.ai.file?'L’IA lit ton PDF et écrit les cartes…':'L’IA écrit tes cartes…'});
  if(!res){outRefresh();return;}
  const items=(Array.isArray(res)?res:[]).filter(x=>x&&x.recto&&x.verso).map(x=>({recto:String(x.recto).trim(),verso:String(x.verso).trim(),on:true}));
  E.ai.props={mode:'add',items};
  if(!items.length)E.ai.props={err:'L’IA n’a proposé aucune carte : reformule ta demande.',items:[]};
  const q=$('fce-ai-q');if(q&&items.length)q.value='';
  outRefresh();
  if(!E.title&&E.ai.file)E.title=E.ai.file.name.replace(/\.pdf$/i,'').slice(0,80),($('fce-title')||{}).value=E.title;
}
async function aiFill(){
  const todo=E.rows.map((r,i)=>({r,i})).filter(x=>x.r.term.trim()&&!x.r.def.trim());
  if(!todo.length){showNotif('Aucune carte avec un terme sans définition','ok');return;}
  const schema={type:'ARRAY',items:{type:'OBJECT',properties:{n:{type:'INTEGER'},verso:{type:'STRING'}},required:['n','verso']}};
  const res=await aiCall('Écris la définition (verso) de chacun de ces termes, numérotés :\n'+todo.map((x,k)=>(k+1)+'. '+x.r.term).join('\n')+'\nRéponds avec n = numéro du terme.',[],{schema,loading:'L’IA complète tes définitions…'});
  if(!res){outRefresh();return;}
  let n=0;(Array.isArray(res)?res:[]).forEach(x=>{const t=todo[(x.n|0)-1];if(t&&x.verso){t.r.def=String(x.verso).trim();t.r.defHtml='';n++;}});
  E.ai.props=null;outRefresh();render();schedule();
  showNotif(n+' définition'+(n>1?'s':'')+' complétée'+(n>1?'s':''),'ok');
}
async function aiImprove(){
  const rows=E.rows.filter(r=>!isEmpty(r)&&r.term.trim()&&r.def.trim());
  if(!rows.length){showNotif('Écris d’abord quelques cartes','err');return;}
  const res=await aiCall('Améliore ces flashcards : corrige les erreurs, rends le recto plus précis et le verso plus clair et concis, garde le même nombre de cartes et le même ordre.\n'+JSON.stringify(rows.slice(0,80).map(r=>({recto:r.term,verso:r.def}))),[],{loading:'L’IA relit tes cartes…'});
  if(!res){outRefresh();return;}
  const items=(Array.isArray(res)?res:[]).filter(x=>x&&x.recto&&x.verso).map(x=>({recto:String(x.recto),verso:String(x.verso),on:true}));
  E.ai.props={mode:'improve',items,targets:rows.slice(0,80).map(r=>r.k)};outRefresh();
}
window.fceAIAdd=function(){
  const p=E.ai.props;if(!p)return;
  if(p.mode==='improve'){
    let n=0;p.items.forEach((x,i)=>{if(!x.on)return;const r=E.rows.find(y=>y.k===p.targets[i]);if(r){r.term=x.recto;r.def=x.verso;r.termHtml='';r.defHtml='';n++;}});
    E.ai.props=null;render();schedule();showNotif(n+' cartes améliorées','ok');return;
  }
  const sel=p.items.filter(x=>x.on);if(!sel.length)return;
  E.ai.props=null;
  addRows(sel.map(x=>[x.recto,x.verso]));
  showNotif(sel.length+' carte'+(sel.length>1?'s':'')+' ajoutée'+(sel.length>1?'s':''),'ok');
};
/* ───────── Compléter une carte (16 nov. 2026) ─────────
   1. Gemini si une clé est enregistrée ; 2. IA intégrée au navigateur (Chrome, sans clé) ;
   3. mes propres cartes (même terme ailleurs) ; 4. Wikipédia (terme → définition) ;
   5. sinon : petit menu → toutes les cartes vides d'un coup par copier-coller (ChatGPT / Gemini, sans clé) ou activer Gemini. */
const nrm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function ownLookup(text,wantDef){
  const n=nrm(text);if(n.length<2)return null;
  const pools=[G('concepts',[])||[],G('flashcards',[])||[]];
  for(const pool of pools)for(const c of pool){
    const t=c.term||c.front||'',d=c.definition||c.back||'';
    if(!t||!d)continue;
    if(wantDef&&nrm(t)===n)return d;
    if(!wantDef&&nrm(d)===n)return t;
  }
  return null;
}
async function browserAI(prompt){
  const LM=window.LanguageModel||(window.ai&&window.ai.languageModel);if(!LM)return null;
  try{
    const av=LM.availability?await LM.availability():((await LM.capabilities()).available);
    if(!/^(available|readily)$/.test(String(av)))return null;
    const ses=await LM.create({initialPrompts:[{role:'system',content:SYS}]});
    const t=await ses.prompt(prompt);try{ses.destroy();}catch(e){}
    return String(t||'').trim()||null;
  }catch(e){return null;}
}
async function wikiDef(term){
  const t=String(term||'').trim();if(!t||t.length>80)return null;
  const lc=t.toLowerCase(),title=lc.charAt(0).toUpperCase()+lc.slice(1);
  const es=/[ñ¿¡]|ción\b|\b(del|los|las|el|la|y)\b/i.test(t);
  for(const lang of es?['es','fr','en']:['fr','es','en']){
    try{
      const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),5000);
      const r=await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,{signal:ctl.signal});clearTimeout(tm);
      if(!r.ok)continue;
      const j=await r.json();
      if(j.type!=='standard'||!j.extract)continue;
      const sent=j.extract.split(/(?<=[.!?])\s+/).slice(0,2).join(' ');
      if(sent.length>20)return sent;
    }catch(e){}
  }
  return null;
}
function setSide(r,hasT,v){
  v=String(v||'').trim().replace(/^(verso|recto|définition|definition|terme)\s*:\s*/i,'').replace(/^["«]\s*|\s*["»]$/g,'');
  if(!v)return false;
  if(hasT){r.def=v;r.defHtml='';}else{r.term=v;r.termHtml='';}
  rerenderRow(r);schedule();count();return true;
}
async function aiRow(r,btn){
  const hasT=r.term.trim(),hasD=r.def.trim();
  if(!hasT&&!hasD){showNotif('Écris d’abord le terme (ou la définition)','err');return;}
  if(hasT&&hasD){showNotif('Vide le côté que l’IA doit compléter','ok');return;}
  const ask=hasT?'Donne seulement le verso (définition concise, 1 à 3 phrases, dans la même langue que le terme) de cette flashcard : '+r.term:'Donne seulement le recto (terme ou question courte, dans la même langue) correspondant à cette définition : '+r.def;
  btn.classList.add('busy');btn.disabled=true;
  try{
    if(window.KAI&&KAI.hasKey()){
      try{const t=await KAI.ask({system:SYS,contents:[{role:'user',parts:[{text:ask}]}],temperature:.3});if(setSide(r,hasT,t))return;}
      catch(e){showNotif((e.message||'Erreur de Gemini')+' — j’essaie autrement','err');}
    }
    const b=await browserAI(ask);if(b&&setSide(r,hasT,b)){showNotif('Complété par l’IA du navigateur','ok');return;}
    const own=ownLookup(hasT?r.term:r.def,!!hasT);if(own&&setSide(r,hasT,own)){showNotif('Trouvé dans tes autres cartes','ok');return;}
    if(hasT){const w=await wikiDef(r.term);if(w&&setSide(r,hasT,w)){showNotif('Définition trouvée sur Wikipédia : vérifie-la','ok');return;}}
    aiMenu(btn);
  }finally{btn.classList.remove('busy');btn.disabled=false;}
}
function aiMenu(btn){
  document.querySelectorAll('.fce-aipop').forEach(x=>x.remove());
  const todo=E.rows.filter(x=>!!x.term.trim()!==!!x.def.trim());
  const pop=document.createElement('div');pop.className='fce-aipop';
  pop.innerHTML=`<b>Pas d’IA disponible ici</b><small>Choisis comment compléter :</small>
    <button data-m="relay"><span class="ms">content_paste</span><span><b>Avec ChatGPT ou Gemini</b><small>Copier-coller, gratuit, sans clé · ${todo.length} carte${todo.length>1?'s':''} à compléter d’un coup</small></span></button>
    <button data-m="key"><span class="ms">bolt</span><span><b>Activer Gemini</b><small>Réponse instantanée en un clic (clé gratuite, 2 min)</small></span></button>`;
  document.body.appendChild(pop);
  const R=btn.getBoundingClientRect(),W=300;
  pop.style.left=Math.max(12,Math.min(window.innerWidth-W-12,R.right-W))+'px';
  pop.style.top=(R.bottom+8+pop.offsetHeight>window.innerHeight?R.top-pop.offsetHeight-8:R.bottom+8)+'px';
  const close=e=>{if(e&&pop.contains(e.target))return;pop.remove();document.removeEventListener('mousedown',close,true);};
  setTimeout(()=>document.addEventListener('mousedown',close,true),0);
  pop.addEventListener('click',e=>{const m=e.target.closest('[data-m]');if(!m)return;close();
    if(m.dataset.m==='key'){if(window.KAI)KAI.openKeyDialog().then(ok=>{if(ok&&KAI.hasKey())btn.click();});}
    else relayFill();});
}
function relayFill(){
  const todo=E.rows.filter(x=>!!x.term.trim()!==!!x.def.trim());
  if(!todo.length){showNotif('Aucune carte à moitié remplie','ok');return;}
  if(!window.KIA||!KIA.relay){showNotif('Atelier IA non chargé','err');return;}
  const lines=todo.map((x,i)=>`${i+1}. recto : ${x.term.trim()||'(à compléter)'} | verso : ${x.def.trim()||'(à compléter)'}`).join('\n');
  const prompt=`Tu complètes des flashcards de révision pour un étudiant en kinésithérapie.
Pour chaque carte, écris le côté marqué « (à compléter) » :
- verso = définition exacte et concise (1 à 3 phrases), avec les mots-clés utiles à l’examen ;
- recto = terme ou question courte.
Écris dans la même langue que la carte. Ne change pas le côté déjà rempli.

Réponds UNIQUEMENT avec un bloc de code \`\`\`json au format :
[{"n":1,"recto":"…","verso":"…"}]

Cartes :
${lines}`;
  KIA.relay({title:'Compléter mes flashcards',sub:`${todo.length} carte${todo.length>1?'s':''} · avec ChatGPT, Gemini ou Claude, sur leur site`,icon:'style',color:'#8B5CF6',prompt,saveLabel:'Compléter les cartes',
    parse(text){
      const j=KIA.parseJSON(text),arr=j&&Array.isArray(j.v)?j.v:j&&j.v&&Array.isArray(j.v.cartes)?j.v.cartes:null;
      if(!arr||!arr.length)return {state:'err',msg:'Je ne trouve pas la liste des cartes dans la réponse.'};
      const out=[];arr.forEach((o,i)=>{const k=(+o.n||i+1)-1,row=todo[k];if(!row)return;const v=row.term.trim()?(o.verso||o.back||o.definition||''):(o.recto||o.front||o.term||'');if(String(v).trim())out.push([row,String(v).trim()]);});
      if(!out.length)return {state:'err',msg:'Aucune carte complétée dans la réponse.'};
      return {state:out.length<todo.length||j.cut?'warn':'ok',msg:`${out.length} carte${out.length>1?'s':''} sur ${todo.length} complétée${out.length>1?'s':''}`,data:out};
    },
    onSave(data){data.forEach(([row,v])=>{if(E.rows.includes(row))setSide(row,!!row.term.trim(),v);});showNotif('Cartes complétées','ok');}
  });
}

/* ───────── Vue d'un dossier : en-tête propre + clic = éditeur ───────── */
function decorate(){
  const key=G('_afcView','hub');
  if(key==='hub'||key==='__courses__'||G('_afcSearchOpen',false))return;
  const hdr=$('afc-hub-header'),ar=$('afc-action-row'),list=$('afc-list'),wrap=$('afc-wrap');
  if(!hdr||!ar||!list)return;
  const isCourse=key.startsWith('__course_');
  const items=isCourse?(G('flashcards',[])||[]).filter(f=>f.courseId===key.slice(9)):(G('concepts',[])||[]).filter(c=>key==='__none__'?!c.folderId:c.folderId===key);
  const f=!isCourse&&key!=='__none__'?folders().find(x=>x.id===key):null;
  const c=isCourse?(G('courses',[])||[]).find(x=>x.id===key.slice(9)):null;
  const name=isCourse?(c?c.name:'Cours'):key==='__none__'?'Sans dossier':(f?f.name:'Dossier');
  const sp=G('fcSpacedData',{})||{},today=new Date().toISOString().slice(0,10);
  const due=items.filter(x=>{const d=sp[x.id];return (d&&d.due&&d.due<=today)||(x.nextReview&&new Date(x.nextReview)<=new Date());}).length;
  const mast=items.length?Math.round(items.filter(x=>{const d=sp[x.id];return (x.masteryLevel||0)>=4||(d&&d.interval>=21);}).length/items.length*100):0;
  const sel=G('_afcSelectMode',false);
  if(wrap)wrap.style.paddingTop='';
  const scr=$('screen-all-flashcards');if(scr)scr.classList.add('fcx-view');
  const anc=f&&window.fcxAncestors?fcxAncestors(key):[];
  const subHTML=f&&window.fcxSubfoldersHTML?fcxSubfoldersHTML(key):'';
  const allIds=f?(function(){const all=folders(),out=[key];for(let i=0;i<out.length;i++)all.forEach(x=>{if(x.parentId===out[i]&&!out.includes(x.id))out.push(x.id);});return new Set(out);})():null;
  const nAll=allIds?(G('concepts',[])||[]).filter(c=>allIds.has(c.folderId)&&kcIsCard(c)).length:items.length;
  hdr.innerHTML=`<div class="fcv-crumbs"><button class="kf-crumb" data-fdrop="root" onclick="afcGoBack()"><span class="ms">arrow_back</span>Flashcards</button>${anc.map(a=>`<span class="ms fcv-sep">chevron_right</span><button class="kf-crumb" data-fdrop="${a.id}" onclick="afcOpenView('${a.id}')">${esc(a.name)}</button>`).join('')}</div>
    <div class="fcv-head">
      <span class="kf-ic" style="--c:${(f&&f.color)||'var(--kc-primary)'}"><span class="ms">${isCourse?'menu_book':key==='__none__'?'inbox':'folder'}</span></span>
      <div class="fcv-t"><h1 class="kf-title">${esc(name)}</h1>
        <div class="kf-meta"><span>${items.length} carte${items.length!==1?'s':''}</span>${due?`<span style="color:var(--kc-primary-text,var(--primary));font-weight:600">${due} à revoir</span>`:''}${items.length?`<span class="kf-mast"><i><b style="width:${mast}%"></b></i><strong>${mast} %</strong> maîtrisées</span>`:''}</div>
        ${f&&f.desc?`<p class="fcv-desc">${esc(f.desc)}</p>`:''}</div>
      <span class="fce-flex"></span>
      ${nAll?`<button class="btn btn-p" onclick="fcxStartKey('${key}')"><span class="ms">play_arrow</span>Réviser${due?' ('+due+')':nAll>items.length?' tout ('+nAll+')':''}</button>`:''}
    </div>`;
  ar.style.display='flex';
  ar.classList.add('fcv-actions');
  ar.innerHTML=`<button class="btn btn-g" onclick="fceOpen('${key}')"><span class="ms">edit_note</span>Modifier les cartes</button>
    <button class="btn btn-g" onclick="fceOpen('${key}',null,{add:true})"><span class="ms">add</span>Ajouter</button>
    <button class="btn btn-g" onclick="fceOpen('${key}',null,{ai:true})"><span class="ms">auto_awesome</span>Générer avec l’IA</button>
    <span class="fce-flex"></span>
    <button class="fce-tbb${sel?' on':''}" id="afc-sel-toggle" title="${sel?'Annuler la sélection':'Sélectionner des cartes'}" onclick="toggleAFCSelectMode()"><span class="ms">${sel?'close':'checklist'}</span></button>
    <button class="fce-tbb" title="Tout déplacer vers un autre dossier" onclick="afcSelectAll();afcMoveSelected()"><span class="ms">drive_file_move</span></button>
    ${f?`<button class="fce-tbb" title="Nouveau sous-dossier" onclick="fcxNewSubfolder('${key}')"><span class="ms">create_new_folder</span></button>`:''}
    ${f?`<button class="fce-tbb" title="Renommer, déplacer ou supprimer le dossier" onclick="fcxEditFolder('${key}')"><span class="ms">more_horiz</span></button>`:''}`;
  if(subHTML){list.insertAdjacentHTML('afterbegin',subHTML+(items.length?'<div class="fcx-sec"><h2>Cartes</h2><span>'+items.length+'</span></div>':''));}
  if(!items.length&&subHTML){list.querySelectorAll('.empty-state').forEach(x=>x.remove());return;}
  if(!items.length){
    list.innerHTML=`<div class="fcv-empty"><span class="ms">style</span><b>Ce dossier est vide</b><small>Écris tes cartes ou laisse l’IA les créer à partir de ton cours.</small>
      <div><button class="btn btn-p" onclick="fceOpen('${key}',null,{add:true})"><span class="ms">edit_note</span>Créer des cartes</button><button class="btn btn-g" onclick="fceOpen('${key}',null,{ai:true})"><span class="ms">auto_awesome</span>Avec l’IA</button></div></div>`;
    return;
  }
  if(!sel)list.querySelectorAll('.afc-item').forEach(el=>{
    const id=el.id.replace('afc-item-','');
    el.removeAttribute('onclick');
    el.addEventListener('click',e=>{if(e.target.closest('button'))return;fceOpen(key,id);});
  });
}
const prevRender=window.renderAFCList;
if(typeof prevRender==='function'){
  window.renderAFCList=function(){const a0=$('afc-action-row');if(a0)a0.classList.remove('fcv-actions');const s0=$('screen-all-flashcards');if(s0)s0.classList.remove('fcx-view');const r=prevRender.apply(this,arguments);try{decorate();}catch(e){console.warn('[fc-editor]',e);}return r;};
}
// quitter l'éditeur par un autre chemin (menu…) : on enregistre
document.addEventListener('visibilitychange',()=>{if(document.hidden&&E.saveT)commit();});
window.addEventListener('pagehide',()=>{if(E.saveT)commit();});
(function(){
  let last='';
  const tick=()=>{const sc=document.body.dataset.screen||'';if(sc===last)return;if(last==='fc-editor'&&E.saveT)commit();last=sc;pill();};
  const start=()=>{try{new MutationObserver(tick).observe(document.body,{attributes:true,attributeFilter:['data-screen']});}catch(e){}setTimeout(tick,400);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
window.addEventListener('beforeunload',()=>{if(E.saveT)commit();});
const origShow=window.showScreen;
if(typeof origShow==='function'){
  window.showScreen=function(id){if(id!=='fc-editor'&&E.saveT)commit();return origShow.apply(this,arguments);};
}
})();
