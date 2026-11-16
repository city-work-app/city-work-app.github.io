/* =========================================================
   annale-import.js — Importer une annale depuis un PDF (écran Annales)
   1. PDF.js (déjà chargé par la page) rend chaque page dans un canvas.
   2. Pour chaque caractère du texte, on regarde la couleur du fond :
      jaune, vert, rose, bleu… = surligné. Ça marche quelle que soit la
      façon dont le surlignage a été fait (Word, Pages, Aperçu, Acrobat).
   3. On découpe les questions (1. 2. …) et les réponses (a) b) …).
      Repli si rien n'est surligné : « * » devant la réponse, ligne
      « Respuesta correcta : c », ou grille « 1-c 2-b » en fin de document.
   4. Aperçu corrigeable, puis création de l'annale et lancement du QCM.
   ========================================================= */
(function(){
'use strict';
const SCALE=1.6;
let QS=[],FILE=null,BUSY=false,STATS=null;

const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t);};

// ── Fenêtre ──
function ensureModal(){
  if($('modal-apdf'))return;
  const d=document.createElement('div');d.className='mdbg';d.id='modal-apdf';
  d.addEventListener('click',e=>{if(e.target===d&&!BUSY)close();});
  d.innerHTML=`<div class="md apdf" role="dialog" aria-label="Importer une annale">
    <div class="apdf-head"><div><div class="mdttl">Importer une annale</div>
      <div class="mddesc">Dépose le PDF de l’examen : je retrouve les questions et les bonnes réponses toute seule, puis je te prépare le QCM.</div></div>
      <button class="apdf-x" data-act="close" aria-label="Fermer"><span class="ms">close</span></button></div>
    <div id="apdf-body"></div></div>`;
  d.addEventListener('click',onClick);
  d.addEventListener('change',e=>{if(e.target&&e.target.id==='apdf-input'&&e.target.files[0])start(e.target.files[0]);});
  document.body.appendChild(d);
}
function open(file){
  ensureModal();QS=[];FILE=null;STATS=null;
  if(typeof openModal==='function')openModal('modal-apdf');else $('modal-apdf').classList.add('open');
  if(file)start(file);else showDrop();
}
function close(){if(BUSY)return;if(typeof closeModal==='function')closeModal('modal-apdf');else $('modal-apdf').classList.remove('open');}
function showDrop(err){
  $('apdf-body').innerHTML=`${err?`<div class="apdf-err"><span class="ms">error</span>${esc(err)}</div>`:''}
    <label class="apdf-drop" id="apdf-drop"><input type="file" id="apdf-input" accept="application/pdf,.pdf" hidden>
      <span class="ms">upload_file</span><b>Glisse le PDF ici</b><small>ou clique pour le choisir</small></label>
    <div class="apdf-tips">
      <div><span class="ms">format_color_fill</span><span>Les bonnes réponses <b>surlignées</b> sont reconnues (jaune, vert, rose, bleu…).</span></div>
      <div><span class="ms">emergency</span><span>Ça marche aussi avec un <b>*</b> devant la réponse, une ligne « Respuesta correcta : c » ou une <b>grille</b> en fin de document (1-c, 2-b…).</span></div>
      <div><span class="ms">edit_note</span><span>Tu pourras tout vérifier et corriger avant de lancer le QCM.</span></div>
    </div>`;
  const z=$('apdf-drop');
  z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('over');});
  z.addEventListener('dragleave',()=>z.classList.remove('over'));
  z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('over');const f=e.dataTransfer.files[0];if(f)start(f);});
}
function showProgressModal(label,pct){showProgress(label,pct);}
function showProgress(label,pct){
  if(!$('apdf-prog'))$('apdf-body').innerHTML=`<div class="apdf-prog" id="apdf-prog"><div class="apdf-spin"></div><b id="apdf-plabel"></b><div class="apdf-bar"><i id="apdf-pbar"></i></div><small>${esc(FILE?FILE.name:'')}</small></div>`;
  $('apdf-plabel').textContent=label;$('apdf-pbar').style.width=Math.round(pct)+'%';
}
async function start(file){
  if(BUSY)return;
  if(!/\.pdf$/i.test(file.name||'')&&file.type!=='application/pdf'){showDrop('Ce fichier n’est pas un PDF.');return;}
  FILE=file;BUSY=true;
  try{
    showProgress('Ouverture du PDF…',3);
    const lines=await readPdf(file);
    showProgress('Recherche des questions…',96);
    const r=parse(lines);QS=r.qs;STATS=r.stats;
    BUSY=false;
    if(!QS.length){showDrop('Je n’ai trouvé aucune question numérotée (1. 2. …) avec des réponses a) b) c)… dans ce PDF. S’il s’agit d’un scan (une image), il faut d’abord le passer dans un logiciel de reconnaissance de texte.');return;}
    showReview();
  }catch(e){BUSY=false;console.error('[annale-import]',e);showDrop('Lecture impossible : '+(e&&e.message||e));}
}

// ── Lecture du PDF : texte + surlignage, caractère par caractère ──
function isHL(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx>150&&mx-mn>48&&(r+g+b)/3>112;}
function isPaper(r,g,b){return(r+g+b)/3>112;}      // tout ce qui n'est pas de l'encre
function quadRects(a,vp){
  const out=[],add=(x0,y0,x1,y1)=>{const r=vp.convertToViewportRectangle([x0,y0,x1,y1]);out.push([Math.min(r[0],r[2]),Math.min(r[1],r[3]),Math.max(r[0],r[2]),Math.max(r[1],r[3])]);};
  const q=a.quadPoints;
  if(Array.isArray(q)&&q.length){
    if(Array.isArray(q[0]))q.forEach(pts=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);add(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));});
    else if(typeof q[0]==='number')for(let k=0;k+7<q.length;k+=8){const xs=[q[k],q[k+2],q[k+4],q[k+6]],ys=[q[k+1],q[k+3],q[k+5],q[k+7]];add(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));}
  }else if(a.rect)add(a.rect[0],a.rect[1],a.rect[2],a.rect[3]);
  return out;
}
function charFlags(img,W,H,x,base,w,fh,str,rects){
  const n=str.length,out=new Uint8Array(n);if(!n||!(w>0))return out;
  const top=base-fh*.82,bot=base+fh*.2,cw=w/n,d=img&&img.data;
  for(let k=0;k<n;k++){
    const x0=x+k*cw;let hl=0,bg=0;
    if(d)for(let sy=0;sy<4;sy++){const yy=Math.round(top+(bot-top)*(sy+.5)/4);if(yy<0||yy>=H)continue;
      for(let sx=0;sx<3;sx++){const xx=Math.round(x0+cw*(sx+.5)/3);if(xx<0||xx>=W)continue;
        const o=(yy*W+xx)*4,r=d[o],g=d[o+1],b=d[o+2];if(isPaper(r,g,b)){bg++;if(isHL(r,g,b))hl++;}}}
    let on=bg>0&&hl/bg>=.45;
    if(!on&&rects.length){const cx=x0+cw/2,cy=(top+bot)/2;on=rects.some(R=>cx>=R[0]&&cx<=R[2]&&cy>=R[1]&&cy<=R[3]);}
    out[k]=on?1:0;
  }
  return out;
}
async function readPdf(file,prog){
  const showProgress=prog||showProgressModal;   /* prog : utilisé par cours-annales.js */
  if(typeof pdfjsLib==='undefined')throw new Error('le lecteur PDF n’est pas chargé, recharge la page');
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  const cv=document.createElement('canvas'),ctx=cv.getContext('2d',{willReadFrequently:true}),lines=[];
  for(let p=1;p<=pdf.numPages;p++){
    showProgress(`Lecture de la page ${p} sur ${pdf.numPages}…`,4+90*(p-1)/pdf.numPages);
    const page=await pdf.getPage(p),vp=page.getViewport({scale:SCALE});
    cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);
    let img=null;
    try{await page.render({canvasContext:ctx,viewport:vp,intent:'print'}).promise;   // « print » : ne dépend pas de l'affichage, continue même si l'onglet est en arrière-plan
      img=ctx.getImageData(0,0,cv.width,cv.height);}catch(e){console.warn('[annale-import] rendu page',p,e);}
    const [tc,annots]=await Promise.all([page.getTextContent(),page.getAnnotations().catch(()=>[])]);
    const rects=annots.filter(a=>/^(Highlight|Squiggly|Underline)$/.test(a.subtype||'')).flatMap(a=>quadRects(a,vp));
    const items=[];
    for(const it of tc.items){
      if(!it.str)continue;
      const t=pdfjsLib.Util.transform(vp.transform,it.transform),fh=Math.hypot(t[2],t[3])||Math.hypot(t[0],t[1])||10;
      const x=t[4],y=t[5],w=(it.width||0)*SCALE;
      items.push({str:it.str,x,y,w,h:fh,fl:charFlags(img,cv.width,cv.height,x,y,w,fh,it.str,rects),page:p,ph:cv.height});
    }
    lines.push(...toLines(items));
    page.cleanup();
  }
  pdf.destroy();
  return lines;
}
function toLines(items){
  items.sort((a,b)=>a.y-b.y||a.x-b.x);
  const groups=[];
  for(const it of items){
    const g=groups.length?groups[groups.length-1]:null;
    if(g&&Math.abs(it.y-g.y)<=Math.max(2,Math.min(it.h,g.h)*.45))g.items.push(it);
    else groups.push({y:it.y,h:it.h,page:it.page,ph:it.ph,items:[it]});
  }
  return groups.map(g=>{
    g.items.sort((a,b)=>a.x-b.x);
    let text='',fl=[],end=null;
    for(const it of g.items){
      if(end!==null&&it.x-end>it.h*.18&&!/\s$/.test(text)&&!/^\s/.test(it.str)){text+=' ';fl.push(fl.length&&fl[fl.length-1]&&it.fl[0]?1:0);}
      text+=it.str;for(let k=0;k<it.str.length;k++)fl.push(it.fl[k]||0);end=it.x+it.w;
    }
    return{text,fl,page:g.page,y:g.y,h:g.h,x:g.items[0].x,ph:g.ph};
  });
}

// ── Découpage en questions / réponses ──
const RX_Q=/^\s*(?:(?:pregunta|question|cuesti[oó]n)\s*(?:n[°º.]?\s*)?)?(\d{1,3})\s*(?:[.)](?!\d)\s*|[\-–:]\s+)(.*)$/i;
const RX_A=/^\s*([*✓✔✅→►]+\s*)?[(\[]?([a-hA-H])\s*(?:[)\]]\s*|[.:\-–]\s+)(.*)$/;
const RX_KEYLINE=/^(?:\s*\d{1,3}\s*[-.):=]?\s*[a-hA-H](?![a-zA-Z])[\s,;.|]*)+$/;
const RX_KEYPAIR=/(\d{1,3})\s*[-.):=]?\s*([a-hA-H])(?![a-zA-Z])/g;
const RX_KEYHEAD=/^\s*(respuestas?|soluci[oó]n(es)?|plantilla|clave|hoja de respuestas|corrig[ée]s?|corrections?|r[ée]ponses?|solutions?|answers?|answer key|grille)\b/i;
const RX_CORR=/^\s*(?:respuesta\s+correcta|respuesta|soluci[oó]n|bonne\s+r[ée]ponse|r[ée]ponse\s+correcte|r[ée]ponse|correcta|correct[e]?|answer)\s*[:=\-]\s*\(?([a-hA-H])\)?(?![a-zA-Z])/i;
const RX_EXPL=/^\s*(?:explicaci[oó]n|justificaci[oó]n|comentario|explication|justification|commentaire|explanation)\s*[:\-]\s*(.*)$/i;
const RX_PAGE=/^\s*(?:p[aá]g(?:ina)?\.?|page)?\s*\d{1,3}\s*(?:(?:\/|de|of|sur)\s*\d{1,3})?\s*$/i;
const RX_MARK_START=/^\s*(?:[*✓✔✅→►]+|\(\s*x\s*\)|\[\s*x\s*\])\s*/i;
const RX_MARK_END=/\s*(?:[*✓✔✅]+|\((?:correcta|correcte|correct|bonne r[ée]ponse|vrai)\))\s*$/i;

function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
function parse(lines){
  // en-têtes et pieds de page répétés sur plusieurs pages
  const pages=new Set(lines.map(l=>l.page)).size,norm=t=>clean(t).replace(/\d+/g,'#').toLowerCase(),seen=new Map();
  lines.forEach(l=>{const k=norm(l.text);if(k.length>2){if(!seen.has(k))seen.set(k,new Set());seen.get(k).add(l.page);}});
  const noise=l=>{const t=clean(l.text);if(!t||RX_PAGE.test(t))return true;
    if(l.ph&&(l.y<l.ph*.055||l.y>l.ph*.955)&&!RX_Q.test(t)&&!RX_A.test(t))return true;   // marges haute/basse : en-tête, pied de page
    const s=seen.get(norm(t));return pages>=3&&!!s&&s.size>=Math.max(3,Math.ceil(pages*.5))&&t.length<100&&!RX_Q.test(t)&&!RX_A.test(t);};
  // grille de réponses (lignes faites uniquement de « 1-c 2-b … »)
  const key=new Map(),body=[];
  for(const l of lines){
    const t=clean(l.text);
    if(noise(l))continue;
    if(RX_KEYLINE.test(t)){for(const m of t.matchAll(RX_KEYPAIR))key.set(+m[1],m[2].toLowerCase());continue;}
    if(RX_KEYHEAD.test(t)&&!RX_Q.test(t)&&!RX_CORR.test(t)&&(t.length<40||/:\s*\d/.test(t))){for(const m of t.replace(RX_KEYHEAD,'').matchAll(RX_KEYPAIR))key.set(+m[1],m[2].toLowerCase());continue;}
    body.push(l);
  }
  const qs=[];let q=null,a=null,mode='',last=0,prev=null;
  const sub=(l,from)=>({text:l.text.slice(from),fl:l.fl.slice(from)});
  const appendTo=(o,part)=>{if(!part.text.trim())return;if(o.text&&!/\s$/.test(o.text)){o.text+=' ';o.fl.push(0);}o.text+=part.text;o.fl.push(...part.fl);};
  const finish=()=>{if(q&&q.answers.length>=2)qs.push(q);q=null;a=null;mode='';};
  for(const l of body){
    const t=l.text,gap=prev&&prev.page===l.page?(l.y-prev.y)/Math.max(6,prev.h):1;
    const mq=t.match(RX_Q),ma=t.match(RX_A);
    if(mq){
      const n=+mq[1];
      if(!q&&!qs.length||(n>last&&n<=last+3)){
        finish();last=n;
        const from=t.length-mq[2].length;
        q={num:n,text:'',fl:[],answers:[],marked:-1,expl:'',page:l.page};appendTo(q,sub(l,from));mode='q';prev=l;continue;
      }
    }
    if(q&&ma){
      const li=ma[2].toLowerCase().charCodeAt(0)-97;
      if(li===q.answers.length){
        const from=t.length-ma[3].length;
        a={text:'',fl:[],lab:l.fl.slice(0,from),pre:!!ma[1]};appendTo(a,sub(l,from));q.answers.push(a);mode='a';prev=l;continue;
      }
    }
    const mc=t.match(RX_CORR);
    if(q&&mc){q.marked=mc[1].toLowerCase().charCodeAt(0)-97;prev=l;continue;}
    const me=t.match(RX_EXPL);
    if(q&&me){q.expl=clean(me[1]);mode='e';prev=l;continue;}
    if(!q){prev=l;continue;}
    if(mode==='e'){q.expl=clean(q.expl+' '+t);}
    else if(mode==='a'&&a){if(gap<2.3)appendTo(a,sub(l,0));}
    else if(mode==='q'){if(gap<3)appendTo(q,sub(l,0));}
    prev=l;
  }
  finish();
  // bonne réponse : surlignage > marqueur > ligne « réponse : c » > grille
  const ratio=x=>{let on=0,tot=0;for(let k=0;k<x.text.length;k++){if(/\s/.test(x.text[k]))continue;tot++;if(x.fl[k])on++;}return tot?on/tot:0;};
  const multi=qs.filter(q=>q.answers.filter(a=>Math.max(ratio(a),avg(a.lab))>=.5).length>1).length;
  const trustHL=!qs.length||multi/qs.length<.6;
  const st={hl:0,mark:0,line:0,key:0,todo:0,warn:0};
  for(const q of qs){
    q.text=clean(q.text);
    q.answers.forEach(a=>{let tx=a.text;a.mark=a.pre||RX_MARK_START.test(tx)||RX_MARK_END.test(tx);tx=tx.replace(RX_MARK_START,'').replace(RX_MARK_END,'');a.r=Math.max(ratio(a),avg(a.lab)>=.6?.99:0);a.text=clean(tx);});
    const hl=q.answers.map((a,k)=>[a.r,k]).filter(x=>x[0]>=.5).sort((x,y)=>y[0]-x[0]);
    q.correct=-1;q.warn='';
    if(trustHL&&hl.length&&hl.length<q.answers.length){q.correct=hl[0][1];q.src='hl';if(hl.length>1)q.warn='Plusieurs réponses semblent surlignées : vérifie.';}
    else{
      const mk=q.answers.findIndex(a=>a.mark);
      if(mk>=0){q.correct=mk;q.src='mark';}
      else if(q.marked>=0&&q.marked<q.answers.length){q.correct=q.marked;q.src='line';}
      else if(key.has(q.num)){const li=key.get(q.num).charCodeAt(0)-97;if(li<q.answers.length){q.correct=li;q.src='key';}}
    }
    if(q.correct<0)st.todo++;else st[q.src]++;
    if(q.warn)st.warn++;
    q.answers=q.answers.map(a=>({text:a.text}));delete q.fl;
  }
  return{qs,stats:st};
}
function avg(arr){if(!arr||!arr.length)return 0;let s=0;for(const v of arr)s+=v;return s/arr.length;}

// ── Aperçu ──
function showReview(){
  const todo=QS.filter(q=>!q.del&&q.correct<0).length,ok=QS.filter(q=>!q.del&&q.correct>=0).length,src=[];
  if(STATS.hl)src.push(`${STATS.hl} par surlignage`);if(STATS.mark)src.push(`${STATS.mark} par astérisque`);if(STATS.line)src.push(`${STATS.line} par « réponse : … »`);if(STATS.key)src.push(`${STATS.key} par la grille`);
  const name=FILE?FILE.name.replace(/\.pdf$/i,'').replace(/[_]+/g,' ').trim():'Annale';
  $('apdf-body').innerHTML=`
    <div class="apdf-sum">
      <div class="apdf-chip ok"><span class="ms">task_alt</span><b>${ok}</b> question${ok>1?'s':''} prête${ok>1?'s':''}</div>
      ${todo?`<div class="apdf-chip todo"><span class="ms">help</span><b>${todo}</b> à vérifier</div>`:''}
      ${src.length?`<small>Bonnes réponses trouvées ${esc(src.join(', '))}.</small>`:''}
    </div>
    <label class="apdf-name"><span>Nom de l’annale</span><input id="apdf-name" maxlength="80" value="${esc(name)}"></label>
    <div class="apdf-list" id="apdf-list">${QS.map(card).join('')}</div>
    <div class="apdf-foot">
      <small id="apdf-skip">${todo?`Clique sur la bonne réponse des questions en orange (sinon elles seront ignorées).`:'Tout est prêt ! Tu peux cliquer sur une autre réponse pour corriger.'}</small>
      <div class="apdf-actions">
        <button class="btn btn-p" data-act="save" data-mode="exam"><span class="ms">timer</span>Mode concours</button>
        <button class="btn btn-g" data-act="save" data-mode="train"><span class="ms">school</span>Entraînement</button>
        <button class="btn btn-g" data-act="save" data-mode="none"><span class="ms">save</span>Enregistrer</button>
      </div>
      <small class="apdf-hint">Concours : +1 bonne réponse, −⅓ erreur, note sur 20. Entraînement : correction à chaque question.</small>
    </div>`;
}
function card(q,i){
  if(q.del)return `<div class="apdf-q gone" data-i="${i}"><span>Question ${q.num} retirée</span><button class="apdf-undo" data-act="undel" data-i="${i}">Remettre</button></div>`;
  const L='abcdefgh';
  return `<div class="apdf-q${q.correct<0?' todo':''}" data-i="${i}">
    <div class="apdf-qh"><b>${q.num}.</b><span>${esc(q.text)}</span><button class="apdf-del" data-act="del" data-i="${i}" title="Retirer cette question" aria-label="Retirer"><span class="ms">close</span></button></div>
    <div class="apdf-as">${q.answers.map((a,k)=>`<button class="apdf-a${k===q.correct?' ok':''}" data-act="set" data-i="${i}" data-k="${k}"><b>${L[k]})</b><span>${esc(a.text)}</span>${k===q.correct?'<span class="ms">check</span>':''}</button>`).join('')}</div>
    ${q.correct<0?'<small class="apdf-warn"><span class="ms">touch_app</span>Clique sur la bonne réponse</small>':q.warn?`<small class="apdf-warn"><span class="ms">warning</span>${esc(q.warn)}</small>`:''}
  </div>`;
}
function refreshCard(i){
  const el=document.querySelector(`#apdf-list .apdf-q[data-i="${i}"]`);if(!el)return;
  const tmp=document.createElement('div');tmp.innerHTML=card(QS[i],i);el.replaceWith(tmp.firstElementChild);
  const todo=QS.filter(q=>!q.del&&q.correct<0).length,ok=QS.filter(q=>!q.del&&q.correct>=0).length;
  const sum=document.querySelector('.apdf-sum');
  if(sum){sum.querySelector('.apdf-chip.ok').innerHTML=`<span class="ms">task_alt</span><b>${ok}</b> question${ok>1?'s':''} prête${ok>1?'s':''}`;const td=sum.querySelector('.apdf-chip.todo');if(td){if(todo)td.innerHTML=`<span class="ms">help</span><b>${todo}</b> à vérifier`;else td.remove();}}
  const sk=$('apdf-skip');if(sk)sk.textContent=todo?'Clique sur la bonne réponse des questions en orange (sinon elles seront ignorées).':'Tout est prêt ! Tu peux cliquer sur une autre réponse pour corriger.';
}
function onClick(e){
  const b=e.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act,i=+b.dataset.i;
  if(act==='close')close();
  else if(act==='set'){QS[i].correct=+b.dataset.k;QS[i].warn='';refreshCard(i);}
  else if(act==='del'){QS[i].del=true;refreshCard(i);}
  else if(act==='undel'){QS[i].del=false;refreshCard(i);}
  else if(act==='save')save(b.dataset.mode);
}

// ── Création de l'annale + QCM ──
function save(mode){
  const keep=QS.filter(q=>!q.del&&q.correct>=0&&q.answers.length>=2);
  if(!keep.length){notify('Choisis au moins une bonne réponse avant de continuer.','err');return;}
  const name=clean($('apdf-name')&&$('apdf-name').value)||'Annale';
  const fid=uid(),cid=uid();
  folders.push({id:fid,name,color:'#5B8DEF',icon:'📄',isAnnale:true});
  courses.push({id:cid,folderId:fid,subFolderId:null,name});
  const created=keep.map(q=>({id:uid(),courseId:cid,question:q.text,answers:q.answers.map(a=>a.text),correct:q.correct,expl:q.expl||''}));
  questions.push(...created);
  if(typeof saveAll==='function')saveAll();
  close();
  if(typeof renderAnnalesHub==='function')renderAnnalesHub();
  notify(`Annale « ${name} » créée : ${created.length} question${created.length>1?'s':''}`,'ok');
  if(mode==='none')return;
  try{curF=fid;curC=cid;curSF=null;rBack='matiere';}catch(e){}
  window._matiereSource='annales-hub';
  if(typeof launchS==='function')launchS(created.slice(),name,false,false,false,false,mode==='exam');
}

// Glisser un PDF directement sur l'écran Annales
document.addEventListener('dragover',e=>{if(document.body.dataset.screen==='annales-hub'&&e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{
  if(document.body.dataset.screen!=='annales-hub'||(e.target&&e.target.closest&&e.target.closest('#modal-apdf')))return;
  const f=e.dataTransfer&&e.dataTransfer.files[0];if(!f)return;e.preventDefault();
  if(/\.pdf$/i.test(f.name)||f.type==='application/pdf')open(f);
});
window.annaleImportOpen=open;
window.annaleImportClose=close;
window._annaleParse=parse;   // pour les tests
window._annaleReadPdf=readPdf;   // lecture texte + surlignage, réutilisée par cours-annales.js
})();
