/* =========================================================
   kc-v72.js — série de demandes du 18 nov. 2026
   1. Carte de maîtrise refaite (remplace renderHeatmap de features.js) : une carte par matière
      (anneau de maîtrise, réussite, répartition Acquises → Jamais vues, cours dépliables, Réviser / Ouvrir),
      matières terminées (archiveFolder) cachées par défaut, annales exclues. Tri kc_mast_sort, kc_mast_done.
   2. kcImgView(src, {actions}) : visionneuse d'image plein écran avec zoom (molette, pincer, double-clic,
      boutons − / +, touches + − 0), déplacement à la souris, clic À CÔTÉ de l'image = fermer.
      Utilisée par la révision des flashcards (clic sur la photo) et l'éditeur (fc-editor.js zoomImg).
   3. Révision des flashcards : taille de la carte réglable (boutons loupe en haut, touches + / −), clé fcx_zoom,
      variable CSS --fz sur #screen-concept-fc (1 = ancienne taille, 1,2 par défaut).
   4. kcDailySRS(n) / kcLaunchDailySRS() : les 20 questions les plus urgentes du jour, sans les matières
      terminées (notification de la cloche, kc-polish.js).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function G(n,d){try{const v=eval(n);return v===undefined?d:v;}catch(e){return d;}}
const lsG=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const lsS=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const arch=id=>!!id&&typeof isFolderArchived==='function'&&isFolderArchived(id);
const boy=id=>typeof isBoycotted==='function'&&isBoycotted(id);
function shuf(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ───────── 4. Révision du jour ───────── */
function liveCourses(){return new Set((G('courses',[])||[]).filter(c=>!arch(c.folderId)&&!arch(c.subFolderId)).map(c=>c.id));}
window.kcDailySRS=function(n){
  n=n||20;let due=[];try{due=G('getSRSDueQuestions',()=>[])()||[];}catch(e){}
  const live=liveCourses(),dd=G('diffData',{})||{},now=Date.now();
  return due.filter(q=>live.has(q.courseId)).map(q=>{
    const d=dd[q.id]||{},nr=d.nextReview?Date.parse(d.nextReview):NaN;
    const late=isNaN(nr)?30:Math.max(0,(now-nr)/864e5),er=d.attempts?(d.errors||0)/d.attempts:0;
    return {q,s:er*10+Math.min(late,60)/6+(d.lastCorrect===false?3:0)};
  }).sort((a,b)=>b.s-a.s).slice(0,n).map(x=>x.q);
};
window.kcLaunchDailySRS=function(){
  const qs=window.kcDailySRS(20);
  if(!qs.length){if(typeof showNotif==='function')showNotif('Rien à revoir aujourd’hui','ok');return;}
  try{rBack='home';}catch(e){}
  if(typeof launchS==='function')launchS(shuf(qs.slice()),'Révision du jour',false,false,false,false,false);
};

/* ───────── 1. Carte de maîtrise ───────── */
const COLS={acquired:'#22C55E',easy:'#A3E635',medium:'#F59E0B',hard:'#EF4444',new:'color-mix(in srgb,var(--kc-ink-2) 30%,transparent)'};
const LBL={acquired:'Acquises',easy:'Faciles',medium:'Moyennes',hard:'Difficiles',new:'Jamais vues'};
const ORDER=['acquired','easy','medium','hard','new'];
function mColor(p,seen){if(!seen)return 'var(--kc-ink-2)';return p>=80?'#22C55E':p>=55?'#84CC16':p>=30?'#F59E0B':'#EF4444';}
function stat(list){
  const gd=typeof getDiff==='function'?getDiff:()=>'new',dd=G('diffData',{})||{},qst=G('questionStats',{})||{};
  const cnt={acquired:0,easy:0,medium:0,hard:0,new:0};let at=0,er=0,last=0;
  list.forEach(q=>{
    const g=gd(q.id);cnt[g in cnt?g:'new']++;
    const d=dd[q.id];if(d&&d.attempts){at+=d.attempts;er+=d.errors||0;const t=d.lastDate?Date.parse(d.lastDate):0;if(t>last)last=t;}
    const s=qst[q.id];if(s&&s.lastAskedAt&&s.lastAskedAt>last)last=s.lastAskedAt;
  });
  const n=list.length,seen=n-cnt.new;
  return {n,cnt,seen,mast:n?Math.round((cnt.acquired+cnt.easy)/n*100):0,rate:at?Math.round((1-er/at)*100):null,last};
}
function subjects(){
  const qs=(G('questions',[])||[]).filter(q=>!boy(q.id)),cs=G('courses',[])||[],fs=(G('folders',[])||[]).filter(f=>f.type!=='annales');
  const byC={};qs.forEach(q=>{(byC[q.courseId]||(byC[q.courseId]=[])).push(q);});
  return fs.map((f,i)=>{
    const fcs=cs.filter(c=>c.folderId===f.id);
    const crs=fcs.map(c=>({c,...stat(byC[c.id]||[])})).filter(x=>x.n>0);
    const all=[].concat(...fcs.map(c=>byC[c.id]||[]));
    return {f,i,arch:arch(f.id),...stat(all),courses:crs};
  }).filter(x=>x.n>0);
}
function ago(t){
  if(!t)return 'Jamais étudiée';
  const d=Math.floor((Date.now()-t)/864e5);
  return d<=0?'Étudiée aujourd’hui':d===1?'Étudiée hier':d<30?'Étudiée il y a '+d+' jours':d<60?'Étudiée il y a 1 mois':'Étudiée il y a '+Math.floor(d/30)+' mois';
}
function ring(p,col,size){
  const r=size/2-5,C=2*Math.PI*r,l=Math.max(0,Math.min(100,p))/100*C;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--kc-surface-2)" stroke-width="7"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${l.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${size/2} ${size/2})" class="kmy-arc"/></svg>`;
}
function bar(cnt,n){return `<div class="kmy-bar">${ORDER.map(k=>cnt[k]?`<i style="flex:${cnt[k]};background:${COLS[k]}" title="${LBL[k]} : ${cnt[k]}"></i>`:'').join('')}</div>`;}
function card(s){
  const col=mColor(s.mast,s.seen),f=s.f;
  const leg=ORDER.filter(k=>s.cnt[k]).map(k=>`<span><i style="background:${COLS[k]}"></i>${LBL[k]} <b>${s.cnt[k]}</b></span>`).join('');
  const crs=s.courses.slice().sort((a,b)=>a.mast-b.mast);
  return `<article class="kmy-card${s.arch?' done':''}" style="--c:${col};--i:${s.i}">
    <header class="kmy-top">
      <div class="kmy-ring">${ring(s.mast,col,72)}<b>${s.mast}<small>%</small></b></div>
      <div class="kmy-h">
        <h3 title="${esc(f.name)}">${esc(f.name)}${s.arch?'<span class="kmy-badge">Terminée</span>':''}</h3>
        <p>${s.n} question${s.n>1?'s':''} · ${s.seen} vue${s.seen>1?'s':''}${s.rate!=null?` · <b style="color:${mColor(s.rate,1)}">${s.rate} %</b> de réussite`:''}</p>
        <p class="kmy-last"><span class="ms">schedule</span>${ago(s.last)}${s.cnt.hard?` · <span class="kmy-hard">${s.cnt.hard} difficile${s.cnt.hard>1?'s':''}</span>`:''}</p>
      </div>
    </header>
    ${bar(s.cnt,s.n)}
    <div class="kmy-leg">${leg}</div>
    ${crs.length?`<details class="kmy-crs"><summary><span class="ms">expand_more</span>${crs.length} cours</summary><ul>${crs.map(x=>`<li><span class="kmy-cn" title="${esc(x.c.name)}">${esc(x.c.name)}</span><span class="kmy-mini"><i style="width:${x.mast}%;background:${mColor(x.mast,x.seen)}"></i></span><b>${x.seen?x.mast+' %':'—'}</b><button type="button" class="kmy-play" data-kmy="course" data-id="${x.c.id}" title="Réviser ce cours"><span class="ms">play_arrow</span></button></li>`).join('')}</ul></details>`:''}
    <footer class="kmy-foot">
      <button type="button" class="btn btn-g" data-kmy="open" data-id="${f.id}"><span class="ms">folder_open</span>Ouvrir</button>
      <button type="button" class="btn btn-p" data-kmy="go" data-id="${f.id}"><span class="ms">play_arrow</span>Réviser</button>
    </footer>
  </article>`;
}
const SORTS=[['weak','À travailler d’abord'],['strong','Les mieux maîtrisées'],['az','A → Z'],['recent','Étudiées récemment']];
function renderMastery(){
  const el=$('heatmap-content');if(!el)return;
  try{if(typeof hmStop==='function')hmStop();}catch(e){}
  try{_heatmapSelected=null;}catch(e){}
  const all=subjects(),done=all.filter(s=>s.arch),showDone=lsG('kc_mast_done','0')==='1';
  let sort=lsG('kc_mast_sort','weak');if(!SORTS.some(x=>x[0]===sort))sort='weak';
  const list=all.filter(s=>showDone||!s.arch);
  if(!all.length){
    el.innerHTML=`<div class="kmy-empty"><span class="ms">map</span><b>Aucune matière avec des questions</b><small>Crée une matière et importe des QCM pour voir ta carte de maîtrise.</small></div>`;return;
  }
  const by={weak:(a,b)=>(a.seen?0:1)-(b.seen?0:1)||a.mast-b.mast,strong:(a,b)=>b.mast-a.mast,az:(a,b)=>a.f.name.localeCompare(b.f.name,'fr'),recent:(a,b)=>b.last-a.last};
  list.sort((a,b)=>(a.arch-b.arch)||by[sort](a,b));
  const act=all.filter(s=>!s.arch),T={n:0,m:0,at:0,ok:0,seen:0};
  act.forEach(s=>{T.n+=s.n;T.m+=s.cnt.acquired+s.cnt.easy;T.seen+=s.seen;});
  const gm=T.n?Math.round(T.m/T.n*100):0,col=mColor(gm,T.seen);
  const best=act.filter(s=>s.seen).sort((a,b)=>b.mast-a.mast)[0],weak=act.filter(s=>s.seen).sort((a,b)=>a.mast-b.mast)[0];
  el.innerHTML=`<div class="kmy">
    <section class="kmy-sum" style="--c:${col}">
      <div class="kmy-ring big">${ring(gm,col,112)}<b>${gm}<small>%</small></b></div>
      <div class="kmy-sum-t"><h2>Maîtrise globale</h2><p>${T.m} question${T.m>1?'s':''} maîtrisée${T.m>1?'s':''} sur ${T.n} · ${act.length} matière${act.length>1?'s':''} en cours</p>
        <div class="kmy-kpis">
          ${best?`<div><span class="ms" style="color:#22C55E">trending_up</span><small>Point fort</small><b>${esc(best.f.name)}</b></div>`:''}
          ${weak&&weak!==best?`<div><span class="ms" style="color:#EF4444">priority_high</span><small>À travailler</small><b>${esc(weak.f.name)}</b></div>`:''}
          <div><span class="ms">visibility</span><small>Questions vues</small><b>${T.seen} / ${T.n}</b></div>
        </div></div>
    </section>
    <div class="kmy-tools">
      <div class="kmy-seg" role="tablist" aria-label="Trier">${SORTS.map(([v,l])=>`<button type="button" class="${v===sort?'on':''}" data-kmy="sort" data-v="${v}">${l}</button>`).join('')}</div>
      ${done.length?`<button type="button" class="kmy-done-t${showDone?' on':''}" data-kmy="done"><span class="ms">${showDone?'visibility':'visibility_off'}</span>${showDone?'Cacher':'Voir'} les matières terminées (${done.length})</button>`:''}
    </div>
    ${list.length?`<div class="kmy-grid">${list.map(card).join('')}</div>`:`<div class="kmy-empty"><span class="ms">task_alt</span><b>Toutes tes matières sont terminées</b><small>Clique sur « Voir les matières terminées » pour les afficher.</small></div>`}
    <p class="kmy-note"><span class="ms">info</span>Maîtrise = questions <b>acquises</b> ou <b>faciles</b> (réussies récemment). Les annales et les questions boycottées ne comptent pas.</p>
  </div>`;
}
function launchFolder(fid){
  const f=(G('folders',[])||[]).find(x=>x.id===fid);
  const cids=new Set((G('courses',[])||[]).filter(c=>c.folderId===fid).map(c=>c.id));
  const qs=(G('questions',[])||[]).filter(q=>cids.has(q.courseId)&&!boy(q.id));
  if(!qs.length){if(typeof showNotif==='function')showNotif('Aucune question disponible.','err');return;}
  const gd=typeof getDiff==='function'?getDiff:()=>'new',P={hard:0,medium:1,new:2,easy:3,acquired:4};
  const pick=shuf(qs.slice()).sort((a,b)=>(P[gd(a.id)]??2)-(P[gd(b.id)]??2)).slice(0,30);
  try{rBack='heatmap';}catch(e){}
  launchS(shuf(pick),(f?f.name:'Matière')+' · points faibles',false,false,false);
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#heatmap-content [data-kmy]');if(!b)return;
  const a=b.dataset.kmy,id=b.dataset.id;
  if(a==='sort'){lsS('kc_mast_sort',b.dataset.v);renderMastery();}
  else if(a==='done'){lsS('kc_mast_done',lsG('kc_mast_done','0')==='1'?'0':'1');renderMastery();}
  else if(a==='go')launchFolder(id);
  else if(a==='open'){if(typeof openFolder==='function')openFolder(id);}
  else if(a==='course'){
    const qs=(G('questions',[])||[]).filter(q=>q.courseId===id&&!boy(q.id)),c=(G('courses',[])||[]).find(x=>x.id===id);
    if(!qs.length)return;try{rBack='heatmap';}catch(err){}
    launchS(shuf(qs.slice()),c?c.name:'Cours',false,false,false);
  }
});
window.renderHeatmap=renderMastery;
window.kcRenderMastery=renderMastery;

/* ───────── 2. Visionneuse d'image ───────── */
let V=null;
function vClose(){
  if(!V)return;const v=V;V=null;
  window.removeEventListener('keydown',v.key,true);window.removeEventListener('resize',v.fit);
  v.bg.classList.add('out');setTimeout(()=>v.bg.remove(),140);
}
window.kcImgView=function(src,o){
  if(!src)return;o=o||{};vClose();
  const bg=document.createElement('div');bg.className='kiv';bg.id='kiv';bg.setAttribute('role','dialog');bg.setAttribute('aria-label','Image en grand');
  const acts=(o.actions||[]).map((a,i)=>`<button type="button" data-v="act" data-i="${i}"><span class="ms">${a.ic}</span>${esc(a.label)}</button>`).join('');
  bg.innerHTML=`<div class="kiv-stage"><img class="kiv-img" alt="" draggable="false"></div>
    <div class="kiv-bar">
      <button type="button" data-v="out" title="Dézoomer (−)" aria-label="Dézoomer"><span class="ms">zoom_out</span></button>
      <span class="kiv-pct">100 %</span>
      <button type="button" data-v="in" title="Zoomer (+)" aria-label="Zoomer"><span class="ms">zoom_in</span></button>
      <button type="button" data-v="fit" title="Taille de l’écran (0)" aria-label="Taille de l’écran"><span class="ms">fit_screen</span></button>
      ${acts?'<span class="kiv-sep"></span>'+acts:''}
      <button type="button" data-v="close"><span class="ms">close</span>Fermer</button>
    </div>
    <div class="kiv-hint">Molette ou pincer pour zoomer · glisser pour déplacer · clic à côté de l’image pour fermer</div>`;
  document.body.appendChild(bg);
  const st=bg.querySelector('.kiv-stage'),img=bg.querySelector('.kiv-img'),pct=bg.querySelector('.kiv-pct');
  const v=V={bg,st,img,z:1,tx:0,ty:0,base:1,w:0,h:0};
  const apply=()=>{img.style.transform=`translate(${v.tx}px,${v.ty}px) scale(${v.base*v.z})`;pct.textContent=Math.round(v.base*v.z*100)+' %';};
  const clamp=()=>{
    const W=st.clientWidth,H=st.clientHeight,s=v.base*v.z,iw=v.w*s,ih=v.h*s;
    v.tx=iw<=W?(W-iw)/2:Math.min(0,Math.max(W-iw,v.tx));
    v.ty=ih<=H?(H-ih)/2:Math.min(0,Math.max(H-ih,v.ty));
  };
  v.fit=()=>{if(!v.w)return;const W=st.clientWidth,H=st.clientHeight;v.base=Math.min(W/v.w,H/v.h,4);clamp();apply();};
  const zoomAt=(nz,px,py)=>{
    nz=Math.max(1,Math.min(10,nz));const s0=v.base*v.z,s1=v.base*nz;
    if(px==null){px=st.clientWidth/2;py=st.clientHeight/2;}
    v.tx=px-(px-v.tx)*(s1/s0);v.ty=py-(py-v.ty)*(s1/s0);v.z=nz;clamp();apply();
  };
  img.onload=()=>{v.w=img.naturalWidth||800;v.h=img.naturalHeight||600;img.style.width=v.w+'px';img.style.height=v.h+'px';v.z=1;v.fit();img.classList.add('in');};
  img.src=src;
  const rel=e=>{const r=st.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  st.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=rel(e);zoomAt(v.z*Math.exp(-e.deltaY*(e.ctrlKey?0.012:0.0018)),x,y);},{passive:false});
  /* glisser (souris) / pincer (doigts) */
  const P=new Map();let moved=false,downT=null,pinch=null;
  st.addEventListener('pointerdown',e=>{
    if(e.button>0)return;
    P.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;downT=e.target;
    try{st.setPointerCapture(e.pointerId);}catch(_){}
    if(P.size===2){const [a,b]=[...P.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:v.z};}
  });
  st.addEventListener('pointermove',e=>{
    const p=P.get(e.pointerId);if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    if(Math.abs(dx)+Math.abs(dy)>3)moved=true;
    p.x=e.clientX;p.y=e.clientY;
    if(P.size===2&&pinch){const [a,b]=[...P.values()],d=Math.hypot(a.x-b.x,a.y-b.y),r=st.getBoundingClientRect();zoomAt(pinch.z*d/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);return;}
    if(v.z>1){v.tx+=dx;v.ty+=dy;clamp();apply();st.classList.add('grab');}
  });
  const up=e=>{
    if(!P.has(e.pointerId))return;P.delete(e.pointerId);st.classList.remove('grab');
    if(P.size<2)pinch=null;
    /* simple clic à côté de l'image (fond noir) = fermer ; clic SUR l'image = rien (le zoom se fait à la molette / double-clic) */
    if(!moved&&P.size===0&&e.type==='pointerup'&&downT&&downT!==img){
      const r=img.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)vClose();
    }
  };
  st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);
  img.addEventListener('dblclick',e=>{e.preventDefault();const [x,y]=rel(e);zoomAt(v.z>1.05?1:2.5,x,y);});
  bg.addEventListener('click',e=>{
    const b=e.target.closest('[data-v]');
    if(!b){if(e.target===bg)vClose();return;}
    const k=b.dataset.v;
    if(k==='in')zoomAt(v.z*1.4);else if(k==='out')zoomAt(v.z/1.4);else if(k==='fit'){v.z=1;v.fit();}
    else if(k==='close')vClose();
    else if(k==='act'){const a=(o.actions||[])[+b.dataset.i];vClose();if(a&&a.run)try{a.run();}catch(err){console.warn(err);}}
  });
  bg.addEventListener('contextmenu',e=>{if(e.target!==img){e.preventDefault();vClose();}});
  v.key=e=>{
    e.stopImmediatePropagation();
    if(e.key==='Escape'||e.key===' '){e.preventDefault();vClose();}
    else if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(v.z*1.4);}
    else if(e.key==='-'||e.key==='_'){e.preventDefault();zoomAt(v.z/1.4);}
    else if(e.key==='0'){e.preventDefault();v.z=1;v.fit();}
  };
  window.addEventListener('keydown',v.key,true);window.addEventListener('resize',v.fit);
};
window.kcImgViewClose=vClose;

/* ───────── 3. Révision des flashcards : photo en grand + taille de la carte ───────── */
document.addEventListener('click',e=>{
  const im=e.target.closest&&e.target.closest('#cfimg-q-el,#cfimg-a-el');
  if(!im||!im.getAttribute('src'))return;
  e.preventDefault();e.stopPropagation();
  window.kcImgView(im.getAttribute('src'));
},true);
const FZ_MIN=.8,FZ_MAX=2;
function fz(){const v=parseFloat(lsG('fcx_zoom','1.2'));return isNaN(v)?1.2:Math.max(FZ_MIN,Math.min(FZ_MAX,v));}
function fzApply(){
  const s=$('screen-concept-fc');if(s)s.style.setProperty('--fz',fz());
  const l=$('fcx-fz-lbl');if(l)l.textContent=Math.round(fz()/1.2*100)+' %';
}
function fzSet(d){lsS('fcx_zoom',String(Math.round(Math.max(FZ_MIN,Math.min(FZ_MAX,fz()+d))*10)/10));fzApply();}
window.fcxZoom=fzSet;
function fzUI(){
  const r=document.querySelector('#screen-concept-fc .fcx-top-r');if(!r||$('fcx-fz'))return;
  const w=document.createElement('div');w.className='fcx-fz';w.id='fcx-fz';
  w.innerHTML=`<button type="button" onclick="fcxZoom(-0.1)" title="Carte plus petite (−)" aria-label="Carte plus petite"><span class="ms">zoom_out</span></button><span id="fcx-fz-lbl">100 %</span><button type="button" onclick="fcxZoom(0.1)" title="Carte plus grande (+)" aria-label="Carte plus grande"><span class="ms">zoom_in</span></button>`;
  r.insertBefore(w,r.firstChild);fzApply();
}
document.addEventListener('keydown',e=>{
  if(document.body.dataset.screen!=='concept-fc'||$('kiv')||$('kc-dlg'))return;
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable))return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='+'||e.key==='='){e.preventDefault();fzSet(.1);}
  else if(e.key==='-'||e.key==='_'){e.preventDefault();fzSet(-.1);}
});

function start(){fzUI();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
