/* =========================================================
   cobalt-plus.js — ajouts du 15 nov. 2026 (soir)
   1. Carte mentale d'une MATIÈRE : kmapOpenForFolder(fid) → racine = matière, branches = dossiers → cours
      (rouvre la carte déjà créée : champ folderId dans l'index kcu_maps).
   2. Annales rangées en DOSSIERS : remplace renderAnnalesHub (content.js).
      Dossiers dans localStorage kp_annale_groups = [{id,name,open}] ; chaque annale (folder isAnnale)
      porte f.annaleGroup = id du dossier (sauvé avec saveAll). Glisser une annale sur un dossier,
      ou bouton « Déplacer » (menu). Supprimer un dossier ne supprime pas ses annales.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function G(name,def){try{const v=eval(name);return v===undefined?def:v;}catch(e){return def;}}
const uidx=()=>(typeof uid==='function'?uid():Date.now().toString(36)+Math.random().toString(36).slice(2,7));

/* ───────── 1. Carte mentale d'une matière ───────── */
window.kmapOpenForFolder=function(fid){
  const KMo=window.KM;
  const f=(G('folders',[])||[]).find(x=>x.id===fid);
  if(!f){showNotif('Matière introuvable','err');return;}
  if(!KMo||typeof KMo.boardFromTree!=='function'){showNotif('Les cartes mentales ne sont pas chargées : recharge la page.','err');return;}
  const idx=KMo.index();
  const ex=idx.filter(m=>m.folderId===fid).sort((a,b)=>(b.updated||0)-(a.updated||0))[0];
  if(ex){KMo.openBoard(ex.id);return;}
  const sfs=(G('subFolders',[])||[]).filter(s=>s.folderId===fid);
  const cs=(G('courses',[])||[]).filter(c=>c.folderId===fid);
  const leaf=c=>({t:c.name});
  const tree={t:f.name,kids:[
    ...sfs.map(sf=>({t:sf.name,kids:cs.filter(c=>c.subFolderId===sf.id).map(leaf)})),
    ...cs.filter(c=>!c.subFolderId||!sfs.some(s=>s.id===c.subFolderId)).map(leaf)
  ]};
  const id=KMo.boardFromTree(f.name,tree,{});
  if(!id)return;
  const m=KMo.index().find(x=>x.id===id);if(m){m.folderId=fid;KMo.saveIndex();}
  KMo.openBoard(id);
  showNotif(tree.kids.length?'Carte créée avec les dossiers et cours de « '+f.name+' »':'Carte vierge créée : ajoute tes idées','ok');
};

/* ───────── 2. Annales en dossiers ───────── */
const GK='kp_annale_groups';
function groups(){try{const a=JSON.parse(localStorage.getItem(GK)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function saveGroups(a){try{localStorage.setItem(GK,JSON.stringify(a));}catch(e){}}
function annales(){return (G('folders',[])||[]).filter(f=>f.isAnnale);}
function qCount(fid){
  const c=(G('courses',[])||[]).find(x=>x.folderId===fid);
  return c?(G('questions',[])||[]).filter(q=>q.courseId===c.id).length:0;
}
function row(f){
  const n=qCount(f.id),color=f.color||'#5B8DEF';
  return `<div class="ci an-row" draggable="true" data-annale-fid="${f.id}">
    <div class="an-open" data-open="${f.id}">
      <div class="cdot" style="background:${color}"></div>
      <div style="min-width:0">
        <div class="cname">${esc(f.name)}</div>
        <div class="cmeta">${n} question${n!==1?'s':''}</div>
      </div>
    </div>
    <div class="cacts">
      <button class="ib" title="Ranger dans un dossier" onclick="event.stopPropagation();anMoveMenu('${f.id}',this)"><span class="ms" style="font-size:17px">drive_file_move</span></button>
      <button class="ib" title="Renommer" onclick="event.stopPropagation();_annaleRename('${f.id}')"><span class="ms" style="font-size:16px">edit</span></button>
      <button class="ib" title="Supprimer" onclick="event.stopPropagation();_annaleDelete('${f.id}')"><span class="ms" style="font-size:16px;color:var(--error)">delete</span></button>
    </div>
    <span class="ms an-chev" data-open="${f.id}">chevron_right</span>
  </div>`;
}
window.renderAnnalesHub=function(){
  const list=$('annales-hub-list');if(!list)return;
  const all=annales(),gs=groups();
  const valid=new Set(gs.map(g=>g.id));
  const tools=`<div class="an-tools">
    <button class="btn btn-p" onclick="annaleImportOpen()"><span class="ms">upload_file</span>Importer une annale (PDF)</button>
    <button class="btn btn-g" onclick="coursAnnalesOpen()" title="Colore dans ton cours les passages tombés en annales"><span class="ms">link</span>Relier un cours aux annales</button>
    <button class="btn btn-g" onclick="document.getElementById('kine-pdf-input').click()"><span class="ms">picture_as_pdf</span>Lire un PDF</button>
    <button class="btn btn-g" onclick="anNewGroup()"><span class="ms">create_new_folder</span>Nouveau dossier</button>
  </div>
  <p class="an-tip">Astuce : glisse un PDF sur cette page pour l’importer, et glisse une annale sur un dossier pour la ranger.</p>
  <div id="ca-hub"></div>`;
  setTimeout(()=>{if(typeof coursAnnalesRenderHub==='function')coursAnnalesRenderHub();},0);
  if(!all.length&&!gs.length){
    list.innerHTML=tools+`<div class="an-empty"><span class="ms">description</span><b>Aucune annale importée</b><small>Importe un PDF avec le bouton ci-dessus</small></div>`;
    return;
  }
  let html=tools+`<div class="an-sec"><span class="ms">history_edu</span>Mes annales <em>${all.length}</em></div>`;
  gs.forEach(g=>{
    const items=all.filter(f=>f.annaleGroup===g.id);
    html+=`<div class="an-group${g.open===false?'':' open'}" data-gid="${g.id}">
      <div class="an-group-h" data-drop="${g.id}" onclick="anToggleGroup('${g.id}')" role="button" tabindex="0" aria-expanded="${g.open!==false}">
        <span class="an-gic"><span class="ms">${g.open===false?'folder':'folder_open'}</span></span>
        <b class="an-gname" data-gname="${g.id}">${esc(g.name)}</b><em>${items.length}</em>
        <span class="an-flex"></span>
        <button class="ib" title="Renommer le dossier" onclick="event.stopPropagation();anRenameGroup('${g.id}')"><span class="ms" style="font-size:16px">edit</span></button>
        <button class="ib" title="Supprimer le dossier (les annales restent)" onclick="event.stopPropagation();anDeleteGroup('${g.id}')"><span class="ms" style="font-size:16px">folder_delete</span></button>
        <span class="ms an-gchev">expand_more</span>
      </div>
      <div class="an-group-list">${items.map(row).join('')||'<div class="an-gempty">Dossier vide : glisse une annale ici, ou utilise <span class="ms">drive_file_move</span></div>'}</div>
    </div>`;
  });
  const loose=all.filter(f=>!f.annaleGroup||!valid.has(f.annaleGroup));
  if(loose.length||gs.length){
    if(gs.length)html+=`<div class="an-sub" data-drop="">Sans dossier <em>${loose.length}</em></div>`;
    html+=`<div class="an-loose" data-drop="">${loose.map(row).join('')||(gs.length?'<div class="an-gempty">Toutes tes annales sont rangées</div>':'')}</div>`;
  }
  list.innerHTML=html;
  list.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click',()=>{window._matiereSource='annales-hub';openFolder(el.dataset.open);});
  });
  initDnD(list);
};
function setGroup(fid,gid){
  const f=annales().find(x=>x.id===fid);if(!f)return;
  if(gid){f.annaleGroup=gid;const g=groups();const gg=g.find(x=>x.id===gid);if(gg&&gg.open===false){gg.open=true;saveGroups(g);}}
  else delete f.annaleGroup;
  try{saveAll();}catch(e){}
  renderAnnalesHub();
}
function initDnD(root){
  let dragId=null;
  root.querySelectorAll('.an-row').forEach(r=>{
    r.addEventListener('dragstart',e=>{dragId=r.dataset.annaleFid;r.classList.add('an-dragging');try{e.dataTransfer.setData('text/x-annale',dragId);e.dataTransfer.effectAllowed='move';}catch(x){}});
    r.addEventListener('dragend',()=>{r.classList.remove('an-dragging');root.querySelectorAll('.an-over').forEach(x=>x.classList.remove('an-over'));dragId=null;});
  });
  root.querySelectorAll('[data-drop]').forEach(t=>{
    t.addEventListener('dragover',e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();t.classList.add('an-over');});
    t.addEventListener('dragleave',()=>t.classList.remove('an-over'));
    t.addEventListener('drop',e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();t.classList.remove('an-over');setGroup(dragId,t.dataset.drop||null);});
  });
  // déposer sur la liste d'un dossier ouvert = ranger dans ce dossier
  root.querySelectorAll('.an-group').forEach(g=>{
    const l=g.querySelector('.an-group-list');if(!l)return;
    l.addEventListener('dragover',e=>{if(!dragId)return;e.preventDefault();g.classList.add('an-over');});
    l.addEventListener('dragleave',e=>{if(!l.contains(e.relatedTarget))g.classList.remove('an-over');});
    l.addEventListener('drop',e=>{if(!dragId)return;e.preventDefault();g.classList.remove('an-over');setGroup(dragId,g.dataset.gid);});
  });
}
window.anToggleGroup=function(gid){
  const g=groups(),x=g.find(y=>y.id===gid);if(!x)return;
  x.open=x.open===false;saveGroups(g);
  const el=document.querySelector(`.an-group[data-gid="${gid}"]`);
  if(el){el.classList.toggle('open',x.open);const ic=el.querySelector('.an-gic .ms');if(ic)ic.textContent=x.open?'folder_open':'folder';el.querySelector('.an-group-h').setAttribute('aria-expanded',x.open);}
};
function inlineName(gid,onDone){
  const b=document.querySelector(`[data-gname="${gid}"]`);if(!b){onDone&&onDone();return;}
  const g=groups(),x=g.find(y=>y.id===gid);if(!x)return;
  const inp=document.createElement('input');inp.className='an-gin';inp.value=x.name;inp.maxLength=60;
  inp.addEventListener('click',e=>e.stopPropagation());
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')inp.blur();if(e.key==='Escape'){inp.value=x.name;inp.blur();}});
  inp.addEventListener('blur',()=>{const v=inp.value.trim();const g2=groups(),x2=g2.find(y=>y.id===gid);if(x2&&v){x2.name=v;saveGroups(g2);}renderAnnalesHub();});
  b.replaceWith(inp);inp.focus();inp.select();
}
window.anNewGroup=function(name,thenMove){
  const g=groups(),id='ag_'+uidx();
  g.push({id,name:name||'Nouveau dossier',open:true});saveGroups(g);
  if(thenMove){setGroup(thenMove,id);}else renderAnnalesHub();
  setTimeout(()=>inlineName(id),30);
  return id;
};
window.anRenameGroup=function(gid){inlineName(gid);};
window.anDeleteGroup=function(gid){
  const g=groups(),x=g.find(y=>y.id===gid);if(!x)return;
  const n=annales().filter(f=>f.annaleGroup===gid).length;
  const go=()=>{saveGroups(groups().filter(y=>y.id!==gid));annales().forEach(f=>{if(f.annaleGroup===gid)delete f.annaleGroup;});try{saveAll();}catch(e){}renderAnnalesHub();};
  if(!n){go();return;}
  if(typeof showConfirm==='function')showConfirm(`Supprimer le dossier « ${x.name} » ?`,`Ses ${n} annale${n>1?'s':''} ne sont pas supprimées : elles reviennent dans « Sans dossier ».`,'Supprimer le dossier',go);
  else if(confirm('Supprimer ce dossier ?'))go();
};
window.anMoveMenu=function(fid,btn){
  document.querySelectorAll('.an-menu').forEach(m=>m.remove());
  const f=annales().find(x=>x.id===fid);if(!f)return;
  const gs=groups();
  const m=document.createElement('div');m.className='an-menu kc-pop-in';m.setAttribute('role','menu');
  m.innerHTML=`<div class="an-menu-t">Ranger « ${esc(f.name)} » dans…</div>`+
    gs.map(g=>`<button role="menuitem" data-g="${g.id}"${f.annaleGroup===g.id?' class="on"':''}><span class="ms">folder</span>${esc(g.name)}${f.annaleGroup===g.id?'<span class="ms an-ok">check</span>':''}</button>`).join('')+
    (f.annaleGroup?`<button role="menuitem" data-g=""><span class="ms">folder_off</span>Sans dossier</button>`:'')+
    `<button role="menuitem" data-new="1" class="an-menu-new"><span class="ms">create_new_folder</span>Nouveau dossier…</button>`;
  document.body.appendChild(m);
  const r=btn.getBoundingClientRect(),w=240;
  m.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.right-w))+'px';
  const below=r.bottom+6,h=m.offsetHeight;
  m.style.top=(below+h>window.innerHeight-8?Math.max(8,r.top-h-6):below)+'px';
  m.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    m.remove();
    if(b.dataset.new)anNewGroup('Nouveau dossier',fid);
    else setGroup(fid,b.dataset.g||null);
  });
  setTimeout(()=>{
    const off=e=>{if(!m.contains(e.target)){m.remove();document.removeEventListener('pointerdown',off,true);}};
    document.addEventListener('pointerdown',off,true);
  },0);
};
})();
