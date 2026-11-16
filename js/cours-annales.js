/* =========================================================
   cours-annales.js — Relier un cours (PDF) aux annales (PDF)
   • Le cours est découpé en passages (une puce, une phrase, un bloc de lignes).
   • Chaque question d'annale est reliée au(x) passage(s) qui contiennent la
     réponse : IA gratuite du navigateur (Transformers.js) ou Gemini (clé).
   • Lecteur : passages colorés (1× jaune, 2× orange, 3× et + rouge) ;
     clic sur un passage → la question ; clic sur une question → le passage.
   • Stockage : IndexedDB (les PDF sont trop gros pour localStorage).
   ========================================================= */
(function(){
'use strict';

/* ───────────────────────── Outils ───────────────────────── */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const newId=()=>'ca'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* ───────────────────────── Stockage (IndexedDB) ───────────────────────── */
const DB_NAME='kineplus-cours-annales',STORE='projets';
let dbP=null;
function db(){
  if(!dbP)dbP=new Promise((res,rej)=>{
    if(!window.indexedDB){rej(new Error('stockage indisponible dans ce navigateur'));return;}
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error||new Error('IndexedDB'));
  });
  return dbP;
}
async function tx(mode,fn){const d=await db();return new Promise((res,rej)=>{const t=d.transaction(STORE,mode),s=t.objectStore(STORE);let out;const r=fn(s);if(r)r.onsuccess=()=>{out=r.result;};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('écriture annulée (mémoire pleine ?)'));});}
const dbAll=()=>tx('readonly',s=>s.getAll());
const dbGet=id=>tx('readonly',s=>s.get(id));
const dbPut=o=>tx('readwrite',s=>s.put(o));
const dbDel=id=>tx('readwrite',s=>s.delete(id));

/* ───────────────────────── 1. Le cours : découpage en passages ───────────────────────── */
const RX_BULLET=/^(?:[•▪◦●○■□►▶✓✔➢➤→\-–—·*]\s*|\(?\d{1,2}[.)]\s+|[a-h]\)\s+)/;
async function readCourse(bytes,prog){
  const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
  const pages=[],segs=[];let hasHL=false,oldAnnales=false;
  for(let p=1;p<=pdf.numPages;p++){
    if(prog)prog(`Lecture du cours : page ${p} sur ${pdf.numPages}…`,p/pdf.numPages);
    const page=await pdf.getPage(p),vp=page.getViewport({scale:1}),W=vp.width,H=vp.height;
    const [tc,ann]=await Promise.all([page.getTextContent(),page.getAnnotations().catch(()=>[])]);
    if(ann.some(a=>a.subtype==='Highlight'))hasHL=true;
    if(ann.some(a=>a.titleObj&&/annales?/i.test(a.titleObj.str||'')))oldAnnales=true;
    const lines=pageLines(tc,vp);
    const blocks=pageBlocks(lines);
    let title='';
    { const top=lines.filter(l=>l.y<H*.4&&/[a-zA-ZÀ-ÿ]{3}/.test(l.t)).sort((a,b)=>b.h-a.h||a.y-b.y)[0]; if(top)title=top.t.slice(0,120); }
    pages.push({w:W,h:H,title});
    for(const b of blocks){
      for(const part of splitSentences(b.lines)){
        if(part.t.replace(/[^a-zA-ZÀ-ÿ]/g,'').length<4)continue;
        segs.push({id:'S'+(segs.length+1),p,t:part.t,
          r:part.r.map(R=>[+(R[0]/W).toFixed(4),+((R[1]-R[3]*.86)/H).toFixed(4),+(R[2]/W).toFixed(4),+((R[1]+R[3]*.24)/H).toFixed(4)]),
          big:b.lines[0].h,x0:b.x0/W,y0:b.lines[0].y/H,
          hd:part.r.length<=2&&b.lines[0].y<H*.3&&part.t.length<130&&!/[.:;!?]$/.test(part.t)&&!RX_BULLET.test(part.t)});   // sous-titre de diapo
      }
    }
    page.cleanup();
  }
  // les gros titres (taille de police nettement au-dessus de la normale de la page) sont marqués
  const byPage={};segs.forEach(s=>{(byPage[s.p]=byPage[s.p]||[]).push(s.big);});
  segs.forEach(s=>{const arr=byPage[s.p].slice().sort((a,b)=>a-b),med=arr[arr.length>>1]||s.big;s.title=s.big>med*1.35&&s.t.length<90;s.sub=!s.title&&s.big>med*1.08&&s.t.length<80;});
  // section : le sous-titre le plus proche au-dessus, dans la même colonne
  segs.forEach(s=>{
    let best=null;
    for(const o of segs){if(o.p!==s.p||o===s||!(o.title||o.sub)||o.y0>=s.y0)continue;if(Math.abs(o.x0-s.x0)>.12)continue;if(!best||o.y0>best.y0)best=o;}
    s.sec=best?best.t:'';
  });
  segs.forEach(s=>{delete s.big;delete s.sub;delete s.x0;delete s.y0;});
  const perPage={};segs.forEach(s=>{perPage[s.p]=(perPage[s.p]||0)+1;});
  segs.forEach(s=>{if(perPage[s.p]<=3)s.hd=true;});   // diapo intercalaire (titre de partie)
  // diapos qui ne sont pas du cours : cas clinique à résoudre, questions, consignes, bibliographie, sommaire
  const RX_NOTCOURSE=/^(caso cl[ií]nico|cas clinique|clinical case|preguntas? a resolver|preguntas|ejercicios?|exercices?|questions?( à résoudre)?|instrucciones|consignes|bibliograf|r[ée]f[ée]rences|referencias|[ií]ndice|sommaire|table des mati|plan du cours)/i;
  segs.forEach(s=>{const pt=(pages[s.p-1]&&pages[s.p-1].title)||'';if(RX_NOTCOURSE.test(pt.trim())||RX_NOTCOURSE.test((s.sec||'').trim()))s.hd=true;});
  const n=pdf.numPages;pdf.destroy();
  return{pages,segs,numPages:n,hasHL,oldAnnales};
}
function pageLines(tc,vp){
  const its=[];
  for(const it of tc.items){
    if(!it.str||!it.str.trim())continue;
    const t=pdfjsLib.Util.transform(vp.transform,it.transform);
    if(Math.abs(t[1])>Math.abs(t[0])*.25)continue;               // texte tourné (filigrane…)
    const h=Math.hypot(t[2],t[3])||Math.hypot(t[0],t[1])||10;
    its.push({s:it.str,x:t[4],y:t[5],w:(it.width||0)*vp.scale,h});
  }
  its.sort((a,b)=>a.y-b.y||a.x-b.x);
  const lines=[];
  for(const it of its){
    let L=null;
    for(let k=lines.length-1;k>=0&&k>=lines.length-16;k--){
      const c=lines[k];
      if(Math.abs(c.y-it.y)>Math.max(2,Math.min(c.h,it.h)*.45))continue;
      const gap=it.x-c.x1;
      if(gap>-c.h*.6&&gap<Math.max(c.h,it.h)*1.6){L=c;break;}
    }
    if(L){
      if(it.x-L.x1>L.h*.18&&!/\s$/.test(L.t)&&!/^\s/.test(it.s))L.t+=' ';
      L.t+=it.s;L.x1=Math.max(L.x1,it.x+it.w);L.h=Math.max(L.h,it.h);
    }else lines.push({t:it.s,x0:it.x,x1:it.x+it.w,y:it.y,h:it.h});
  }
  lines.forEach(l=>{l.t=clean(l.t);});
  return lines.filter(l=>l.t).sort((a,b)=>a.y-b.y||a.x0-b.x0);
}
function pageBlocks(lines){
  const blocks=[];
  for(const L of lines){
    let prev=null;
    for(let k=blocks.length-1;k>=0;k--){
      const B=blocks[k],P=B.lines[B.lines.length-1],dy=L.y-P.y;
      if(dy<=L.h*.3||dy>Math.max(P.h,L.h)*1.9)continue;
      const r=L.h/P.h;if(r<.8||r>1.25)continue;
      if(L.x0<B.x0-L.h*1.2||L.x0>B.x0+L.h*2.6)continue;
      prev=B;break;
    }
    const P=prev&&prev.lines[prev.lines.length-1];
    const bullet=RX_BULLET.test(L.t);
    const sentEnd=P&&/[.!?]$/.test(P.t)&&/^[¿¡A-ZÁÉÍÓÚÑÀÈÊÇ]/.test(L.t);
    if(prev&&!bullet&&!sentEnd&&prev.lines.length<9)prev.lines.push(L);
    else blocks.push({lines:[L],x0:L.x0});
  }
  return blocks;
}
/* Un long paragraphe → une phrase par passage (rectangles coupés au bon endroit de la ligne) */
function splitSentences(ls){
  const whole=joinLines(ls),box=l=>[l.x0,l.y,l.x1,l.h];
  if(whole.length<220||ls.length<2)return[{t:whole,r:ls.map(box)}];
  const chars=[];   // pour chaque caractère : sa ligne et sa position dans la ligne
  ls.forEach((l,li)=>{if(chars.length){if(/[a-zà-ÿ]-$/.test(ls[li-1].t))chars.pop();else chars.push({li:-1});}for(let k=0;k<l.t.length;k++)chars.push({li,k});});
  const txt=chars.map(c=>c.li<0?' ':ls[c.li].t[c.k]).join('');
  const cuts=[0];const rx=/[.!?]\s+(?=[¿¡A-ZÁÉÍÓÚÑ])/g;let m;
  while((m=rx.exec(txt)))cuts.push(m.index+1);
  cuts.push(txt.length);
  const parts=[];
  for(let k=0;k+1<cuts.length;k++){
    let a=cuts[k],b=cuts[k+1];while(a<b&&txt[a]===' ')a++;
    const t=clean(txt.slice(a,b));if(!t)continue;
    if(parts.length&&t.length<40){const P=parts[parts.length-1];P.t+=' '+t;P.b=b;continue;}   // trop court : on recolle
    parts.push({t,a,b});
  }
  if(parts.length<2)return[{t:whole,r:ls.map(box)}];
  return parts.map(P=>{
    const r=[];
    ls.forEach((l,li)=>{
      let k0=Infinity,k1=-1;
      for(let c=P.a;c<P.b;c++){const ch=chars[c];if(ch&&ch.li===li){k0=Math.min(k0,ch.k);k1=Math.max(k1,ch.k);}}
      if(k1<0)return;
      const n=Math.max(1,l.t.length),w=l.x1-l.x0;
      r.push([l.x0+w*k0/n,l.y,l.x0+w*(k1+1)/n,l.h]);
    });
    return{t:P.t,r};
  });
}
function joinLines(ls){let s='';for(const l of ls){if(!s)s=l.t;else if(/[a-zà-ÿ]-$/.test(s))s=s.slice(0,-1)+l.t;else s+=' '+l.t;}return clean(s);}

/* ───────────────────────── 2. L'annale : questions + bonne réponse ───────────────────────── */
const RX_QH=/^\s*(?:Q|Pregunta|Question|Cuesti[oó]n|[IÍ]tem)\s*n?[°º.]?\s*(\d{1,3})\b\s*(?:([·•|\-–—:.)])\s*(.*))?$/i;
const RX_QN=/^\s*(\d{1,3})\s*[.)](?!\d)\s*(.+)$/;
const RX_A=/^\s*([*✓✔✅→►]+\s*)?[(\[]?([a-hA-H])\s*(?:[)\]]\s*|[.:\-–]\s+)(.*)$/;
const RX_CORR=/^\s*(?:respuesta\s+correcta|respuesta|soluci[oó]n|bonne\s+r[ée]ponse|r[ée]ponse\s+correcte|r[ée]ponse|correcta|correct[e]?|answer)\s*[:=\-]\s*\(?([a-hA-H])\)?(?![a-zA-Z])/i;
const RX_EXAM=/^\s*(?:examen|exam|convocatoria|parcial|session|sesi[oó]n|partiel)\b.{3,100}$/i;
const RX_PAGE=/^\s*(?:p[aá]g(?:ina)?\.?|page)?\s*\d{1,3}\s*(?:(?:\/|de|of|sur)\s*\d{1,3})?\s*$/i;
function parseAnnale(lines){
  const pages=new Set(lines.map(l=>l.page)).size,norm=t=>clean(t).replace(/\d+/g,'#').toLowerCase(),seen=new Map();
  lines.forEach(l=>{const k=norm(l.text);if(k.length>2){if(!seen.has(k))seen.set(k,new Set());seen.get(k).add(l.page);}});
  const noise=l=>{const t=clean(l.text);if(!t||RX_PAGE.test(t))return true;const s=seen.get(norm(t));return pages>=3&&!!s&&s.size>=Math.max(3,Math.ceil(pages*.5))&&t.length<120&&!RX_QH.test(t);};
  const qs=[];let q=null,a=null,mode='',last=0,exam='',examN=0,prev=null,tail=null;
  const finish=()=>{if(q&&q.answers.length>=2)qs.push(q);q=null;a=null;mode='';};
  const startQ=(n,l,text)=>{finish();last=n;q={num:n,exam,examN,text:clean(text),answers:[],correct:-1,marked:-1,page:l.page,y:l.ph?l.y/l.ph:0,yEnd:0,pageEnd:l.page};mode='q';tail=l;};
  for(const l of lines){
    if(noise(l))continue;
    const t=clean(l.text);
    if(RX_EXAM.test(t)&&!(q&&mode==='q')){finish();exam=t.replace(/\s+[—–-]\s+.*$/,'').replace(/\s+\d{1,3}$/,'');examN++;prev=l;continue;}
    const mh=t.match(RX_QH);
    if(mh){
      const sep=mh[2]||'',rest=mh[3]||'';
      const isText=rest&&(!/[·•|—–]/.test(sep)||rest.length>=45||/\?/.test(rest));
      startQ(+mh[1],l,isText?rest:'');prev=l;continue;
    }
    const mn=t.match(RX_QN);
    if(mn&&(!q||(q.answers.length>=2&&(+mn[1]>last&&+mn[1]<=last+3||+mn[1]===1)))){startQ(+mn[1],l,mn[2]);prev=l;continue;}
    if(!q){prev=l;continue;}
    const ma=t.match(RX_A);
    if(ma&&mode!=='c'){
      const li=ma[2].toLowerCase().charCodeAt(0)-97;
      if(li===q.answers.length){
        const from=l.text.length-ma[3].length;
        a={text:ma[3],fl:(l.fl||[]).slice(from),lab:(l.fl||[]).slice(0,from),mark:!!ma[1]};q.answers.push(a);mode='a';tail=l;
        q.pageEnd=l.page;q.yEnd=l.ph?l.y/l.ph:0;prev=l;continue;
      }
    }
    const mc=t.match(RX_CORR);
    if(mc){q.marked=mc[1].toLowerCase().charCodeAt(0)-97;mode='c';prev=l;continue;}
    if(mode==='q'&&tail&&(!q.text||tail.page!==l.page||(l.y-tail.y)<Math.max(6,tail.h)*3)){q.text=clean(q.text+' '+t);tail=l;}
    else if(mode==='a'&&a&&tail&&tail.page===l.page&&(l.y-tail.y)<Math.max(6,tail.h)*2.3){a.text=clean(a.text+' '+t);a.fl=a.fl.concat([0],l.fl||[]);q.yEnd=l.ph?l.y/l.ph:q.yEnd;tail=l;}
    prev=l;
  }
  finish();
  const ratio=x=>{let on=0,tot=0;for(let k=0;k<x.text.length&&k<x.fl.length;k++){if(/\s/.test(x.text[k]))continue;tot++;if(x.fl[k])on++;}return tot?on/tot:0;};
  const RXM=/^\s*[*✓✔✅]+\s*|\s*[*✓✔✅]+\s*$/g;
  qs.forEach((q,i)=>{
    q.id='Q'+(i+1);
    const hl=q.answers.map((a,k)=>[ratio(a),k]).filter(x=>x[0]>=.5);
    const mk=q.answers.findIndex(a=>a.mark||/^\s*[✓✔✅]/.test(a.text));
    if(mk>=0)q.correct=mk;
    else if(q.marked>=0&&q.marked<q.answers.length)q.correct=q.marked;
    else if(hl.length===1)q.correct=hl[0][1];
    q.answers=q.answers.map(a=>clean(a.text.replace(RXM,'')));
    delete q.marked;
  });
  return qs;
}

/* ───────────────────────── 3. Recherche par les mots (BM25) ───────────────────────── */
const STOP=new Set(('a al algo algun alguna algunas alguno algunos ante antes aquel aquella aquello aqui asi aun cada como con contra cual cuales cuando de del desde donde dos el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba estado estan estar estas este esto estos fue fueron ha hace hacen hay la las le les lo los mas me mediante mi muy no nos o otra otras otro otros para pero poco por porque puede pueden que quien se sea segun ser si sido sin sobre son su sus tal tambien tanto te tiene tienen todo todos tras tu un una uno unos y ya cual cuales siguiente siguientes correcta correcto incorrecta incorrecto verdadera falsa cierta ciertas cierto señale senale respecto relacion paciente pacientes caso puede '+
  'au aux avec ce ces cet cette dans de des du elle en est et il ils la le les leur lui mais par pas plus pour qui que quel quelle sa se ses son sont sur un une vers ou où ne ni si y on '+
  'the of and or to in is are for with on by an be as at this that which').split(' '));
function stem(w){
  if(w.length>4&&/es$/.test(w))w=w.slice(0,-2);else if(w.length>3&&/s$/.test(w))w=w.slice(0,-1);
  return w.length>7?w.slice(0,7):w;
}
function toks(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ]+/g,' ').split(' ')
    .filter(w=>w.length>2&&!STOP.has(w)&&!/^\d{1,2}$/.test(w)).map(stem);
}
/* Contexte d'un passage : la ligne du tableau (cellules à gauche/droite) + le titre de la diapo */
function addContext(segs,pages){
  const byP={};segs.forEach(s=>{(byP[s.p]=byP[s.p]||[]).push(s);});
  segs.forEach(s=>{
    const r0=s.r[0],h=r0[3]-r0[1],row=byP[s.p].filter(o=>o!==s&&Math.abs(o.r[0][1]-r0[1])<h*.6&&o.t.length<160).sort((a,b)=>a.r[0][0]-b.r[0][0]).map(o=>o.t);
    s.ctx=[s.sec&&s.sec!==s.t?s.sec:'',...row].filter(Boolean).join(' · ').slice(0,260);
    const pt=pages[s.p-1]&&pages[s.p-1].title;s.pt=pt&&pt!==s.t?pt:'';
  });
}
const passageText=s=>(s.pt?s.pt+' — ':'')+(s.ctx?s.ctx+' — ':'')+s.t;
function buildIndex(segs){
  const docs=segs.map(s=>{
    const tf=new Map(),add=(txt,w)=>{for(const t of toks(txt))tf.set(t,Math.max(tf.get(t)||0,0)+w);};
    add(s.t,1);
    const main=new Set(toks(s.t));
    for(const t of toks(s.ctx))if(!main.has(t))tf.set(t,(tf.get(t)||0)+.5);
    for(const t of toks(s.pt))if(!main.has(t))tf.set(t,(tf.get(t)||0)+.25);
    return{tf,len:Math.max(3,main.size)};
  });
  const df=new Map();docs.forEach(d=>d.tf.forEach((v,w)=>df.set(w,(df.get(w)||0)+1)));
  const avg=docs.reduce((a,d)=>a+d.len,0)/Math.max(1,docs.length);
  return{docs,df,N:docs.length,avg};
}
function bm25(ix,qw){ // qw : Map(mot → poids)
  const k1=1.2,b=.5,out=new Float32Array(ix.N);
  qw.forEach((wq,w)=>{
    const n=ix.df.get(w);if(!n)return;
    const idf=Math.log(1+(ix.N-n+.5)/(n+.5));
    for(let i=0;i<ix.N;i++){const f=ix.docs[i].tf.get(w);if(!f)continue;const d=ix.docs[i];out[i]+=wq*idf*f*(k1+1)/(f+k1*(1-b+b*d.len/ix.avg));}
  });
  return out;
}
const fold=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const RX_META=/^(todas|todos|toutes|tous|all|ninguna|ninguno|aucune|aucun|none|ambas|las dos|les deux|both)\b/;
const RX_LETTERS=/^\(?([a-h])\)?\s*(?:,|y|e|et|and)\s*\(?([a-h])\)?(?:\s*(?:,|y|e|et|and)\s*\(?([a-h])\)?)?\b/;
const RX_NEG=/\b(no|nunca|falsa|falso|falsas|incorrecta|incorrecto|erronea|erroneo|equivocada|excepto|salvo|fausse|faux|incorrecte|erronee|sauf|except|not|false|wrong)\b/;
/* Ce qu'on cherche dans le cours : ce qui est VRAI. La bonne réponse ; ou les autres
   réponses quand la question est à la négative (« señale la falsa », « EXCEPTO ») ;
   ou les autres quand la bonne réponse est « toutes / aucune ». */
function queryParts(q){
  const ans=q.answers,c=q.correct,ca=c>=0?fold(ans[c]):'',others=ans.filter((_,k)=>k!==c);
  let truths;
  if(c<0)truths=ans.slice();
  else if(RX_META.test(ca))truths=others;
  else if(RX_LETTERS.test(ca)){const m=ca.match(RX_LETTERS);truths=[m[1],m[2],m[3]].filter(Boolean).map(l=>ans[l.charCodeAt(0)-97]).filter(Boolean);}
  else if(RX_NEG.test(fold(q.text)))truths=others;
  else truths=[ans[c]];
  return{q:q.text,truths:truths.filter(t=>t&&t.length>2)};
}
/* Une question = une ou plusieurs « idées » à retrouver (une par réponse vraie) */
function queryUnits(q){
  const P=queryParts(q);
  if(!P.truths.length)return[{main:P.q,ctx:''}];
  if(P.truths.length===1)return[{main:P.truths[0],ctx:P.q}];
  return P.truths.map(t=>({main:t,ctx:P.q}));
}
function unitWeights(u){const m=new Map(),add=(s,w)=>{for(const t of toks(s))m.set(t,Math.max(m.get(t)||0,w));};add(u.ctx,.7);add(u.main,1.8);return m;}

/* ───────────────────────── 4. IA gratuite du navigateur (Transformers.js) ───────────────────────── */
const TJS_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
const EMB_MODEL='Xenova/multilingual-e5-small';
let tjsP=null;
const tjs=()=>tjsP||(tjsP=import(TJS_URL).then(T=>{T.env.allowLocalModels=false;return T;}).catch(e=>{tjsP=null;throw e;}));
function dlProgress(onProg){   // additionne la progression de tous les fichiers téléchargés
  const files={};
  return e=>{
    if(!onProg||!e||!e.file)return;
    if(e.total)files[e.file]={l:e.loaded||0,t:e.total};
    if(e.status==='done'&&files[e.file])files[e.file].l=files[e.file].t;
    let l=0,t=0;Object.values(files).forEach(f=>{l+=f.l;t+=f.t;});
    if(t>2e6)onProg(l,t);
  };
}
let embP=null;
function loadEmbedder(onProg){
  if(!embP)embP=(async()=>{
    const T=await tjs();
    return await T.pipeline('feature-extraction',EMB_MODEL,{dtype:'q8',progress_callback:dlProgress(onProg)});
  })().catch(e=>{embP=null;throw e;});
  return embP;
}
/* IA de relecture (bge-reranker-v2-m3) : lit la question ET le passage ensemble et
   note si le passage contient la réponse. Beaucoup plus précise, mais il faut la carte
   graphique (WebGPU). Mesuré sur « Trastornos motores » : 80-85 % de liens justes. */
const RR_MODEL='onnx-community/bge-reranker-v2-m3-ONNX';
let rrP=null;
async function hasWebGPU(){try{return !!(navigator.gpu&&await navigator.gpu.requestAdapter());}catch(e){return false;}}
function loadReranker(onProg){
  if(!rrP)rrP=(async()=>{
    const T=await tjs(),cb=dlProgress(onProg);
    const tok=await T.AutoTokenizer.from_pretrained(RR_MODEL,{progress_callback:cb});
    const model=await T.AutoModelForSequenceClassification.from_pretrained(RR_MODEL,{dtype:'q4f16',device:'webgpu',progress_callback:cb});
    return{tok,model};
  })().catch(e=>{rrP=null;throw e;});
  return rrP;
}
async function rrScore(rr,query,ps){
  const out=[],B=16;
  for(let i=0;i<ps.length;i+=B){
    const chunk=ps.slice(i,i+B);
    const inp=rr.tok(new Array(chunk.length).fill(query),{text_pair:chunk,padding:true,truncation:true,max_length:320});
    const {logits}=await rr.model(inp);
    const d=logits.data,n=(logits.dims&&logits.dims[1])||1;
    for(let k=0;k<chunk.length;k++)out.push(n===1?d[k]:d[k*n+n-1]);
  }
  return out;
}
async function embed(ext,texts,prefix,onProg){
  const out=[],B=24;
  const yieldUI=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});   // pas ralenti quand l'onglet est en arrière-plan
  for(let i=0;i<texts.length;i+=B){
    const r=await ext(texts.slice(i,i+B).map(t=>prefix+t.slice(0,600)),{pooling:'mean',normalize:true});
    const arr=r.tolist();arr.forEach(v=>out.push(Float32Array.from(v)));
    if(onProg)onProg(Math.min(texts.length,i+B),texts.length);
    await yieldUI();
  }
  return out;
}
const dot=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};

/* Pour une « idée » : le passage qui la contient. On exige que le passage reprenne
   vraiment les mots importants de la réponse (sinon : « pas dans ce cours »),
   puis on départage avec l'IA (le sens) et les mots communs. */
function isHeading(s){
  if(s.title||s.hd)return true;
  if(toks(s.t).length<3)return true;   // 1-2 mots : étiquette de schéma, en-tête de tableau…
  const letters=s.t.replace(/[^A-Za-zÀ-ÿ]/g,'');
  return letters.length>6&&letters.replace(/[^A-ZÀ-ÖØ-Þ]/g,'').length/letters.length>.7;
}
function coverage(ix,i,words){
  const d=ix.docs[i].tf;let on=0,tot=0;
  for(const w of words){const n=ix.df.get(w)||0,idf=Math.log(1+(ix.N-n+.5)/(n+.5));tot+=idf;if(d.has(w))on+=idf*Math.min(1,d.get(w));}
  return tot?on/tot:0;
}
function passes(M,cm,cq){const need=M.length<=1?1:M.length<=3?.6:.45;return cm>=need||(cm>=need-.2&&cq>=.5);}
/* Passages qui peuvent convenir à une idée (filtre par les mots, avant l'IA) */
function candidates(u,ix,segs){
  const lex=bm25(ix,unitWeights(u)),M=[...new Set(toks(u.main))],Qw=[...new Set(toks(u.ctx))].filter(w=>!M.includes(w)),out=[];
  for(let i=0;i<ix.N;i++){if(!lex[i]||isHeading(segs[i]))continue;if(passes(M,coverage(ix,i,M),Qw.length?coverage(ix,i,Qw):0))out.push(i);}
  return out;
}
function matchUnit(u,ix,segs,segVec,uVec){
  const lex=bm25(ix,unitWeights(u));let mx=0;for(const v of lex)mx=Math.max(mx,v);
  if(!mx)return null;
  const M=[...new Set(toks(u.main))],Qw=[...new Set(toks(u.ctx))].filter(w=>!M.includes(w));
  let cmax=-1,cmed=0;
  const cos=segVec&&uVec?Array.from(segVec,v=>v?dot(v,uVec):NaN):null;
  if(cos){const srt=cos.filter(x=>x===x).sort((a,b)=>b-a);cmax=srt[0];cmed=srt[srt.length>>1];if(srt.length<8)cmed=cmax-.08;}
  const cands=[];
  for(let i=0;i<ix.N;i++){
    if(!lex[i]||isHeading(segs[i]))continue;
    const cm=coverage(ix,i,M),cq=Qw.length?coverage(ix,i,Qw):0;
    if(!passes(M,cm,cq))continue;
    if(cos&&cos[i]!==cos[i])continue;
    const sem=cos?Math.max(0,(cos[i]-cmed)/Math.max(1e-6,cmax-cmed)):0;
    cands.push({i,cm,cq,l:lex[i]/mx,sem,cos:cos?cos[i]:0,score:(cos?.45*(lex[i]/mx)+.55*sem:lex[i]/mx)+.25*cm+.1*cq});
  }
  if(!cands.length)return null;
  cands.sort((a,b)=>b.score-a.score);
  const c=cands[0],gap=cands[1]?c.score-cands[1].score:1;
  const conf=Math.max(0,Math.min(1,.35*c.cm+.2*c.cq+.25*(cos?c.sem:c.l)+.2*Math.min(1,gap*4)));
  return{i:c.i,conf,cm:c.cm,alt:cands.slice(1,4).map(x=>x.i)};
}
/* Une question → ses passages (1 à 4), sa confiance */
function matchQuestion(q,ix,segs,segVec,uVecs){
  const us=queryUnits(q),found=new Map();
  us.forEach((u,k)=>{const m=matchUnit(u,ix,segs,segVec,uVecs?uVecs[k]:null);if(m&&(!found.has(m.i)||found.get(m.i).conf<m.conf))found.set(m.i,m);});
  const list=[...found.values()].sort((a,b)=>b.conf-a.conf).slice(0,4);
  return{segs:list.map(m=>segs[m.i].id),conf:list.length?list.reduce((a,m)=>a+m.conf,0)/list.length:0,units:us.length};
}
/* ───────────────────────── 5. Recherche complète : IA gratuite ───────────────────────── */
/* Candidats : les meilleurs passages par les mots, pour chaque idée et pour la question entière */
function lexTop(q,ix,segs,K){
  const set=new Set(),top=u=>{const sc=bm25(ix,unitWeights(u));Array.from(sc.keys()).filter(i=>sc[i]>0&&!isHeading(segs[i])).sort((a,b)=>sc[b]-sc[a]).slice(0,K).forEach(i=>set.add(i));};
  queryUnits(q).forEach(top);top({main:q.text+' '+q.answers.join(' '),ctx:''});
  return [...set];
}
const RR_MIN=-1;   // note minimale de l'IA de relecture pour relier (réglée sur la correction faite à la main)
async function rerankMatch(segs,qs,prog){
  prog('Préparation de l’IA gratuite…',0);
  const rr=await loadReranker((l,t)=>prog(`Téléchargement de l’IA gratuite (une seule fois) : ${Math.round(l/1e6)} / ${Math.round(t/1e6)} Mo…`,l/t));
  const ix=buildIndex(segs),out=new Map(),pt=segs.map(passageText);   // titre de diapo + cellules voisines + texte : le contexte évite les faux liens
  const yieldUI=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
  for(let n=0;n<qs.length;n++){
    const q=qs[n];
    prog(`L’IA relit le cours pour la question ${n+1} sur ${qs.length}…`,n/qs.length);
    const cands=lexTop(q,ix,segs,5),picked=new Map();
    if(cands.length){
      const ps=cands.map(i=>pt[i]);
      for(const u of queryUnits(q)){
        const sc=await rrScore(rr,(u.ctx?u.ctx+' ':'')+u.main,ps);
        let b=-1;sc.forEach((v,k)=>{if(b<0||v>sc[b])b=k;});
        if(b>=0&&sc[b]>=RR_MIN){const i=cands[b];if(!picked.has(i)||picked.get(i)<sc[b])picked.set(i,sc[b]);}
      }
    }
    const list=[...picked.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
    out.set(q.id,{segs:list.map(x=>segs[x[0]].id),conf:list.length?1/(1+Math.exp(-(list[0][1]+1))):0});
    await yieldUI();
  }
  const use=new Map();out.forEach(m=>m.segs.forEach(s=>use.set(s,(use.get(s)||0)+1)));
  out.forEach(m=>{if(m.segs.some(s=>use.get(s)>=4))m.conf=Math.min(m.conf,.5);});
  return out;
}
/* IA gratuite : la relecture si la carte graphique le permet, sinon l'ancienne méthode */
async function freeMatch(segs,qs,prog){
  if(await hasWebGPU()){
    try{return{out:await rerankMatch(segs,qs,prog),src:'ia'};}
    catch(e){console.warn('[cours-annales] IA de relecture impossible, méthode simple',e);notify('IA précise indisponible sur cet appareil : méthode simple utilisée','err');}
  }
  return{out:await localMatch(segs,qs,prog),src:'local'};
}
async function localMatch(segs,qs,prog){
  let segVec=null,U=null;
  try{
    prog('Préparation de l’IA gratuite…',0);
    const ext=await loadEmbedder((l,t)=>prog(`Téléchargement de l’IA gratuite (une seule fois) : ${Math.round(l/1e6)} / ${Math.round(t/1e6)} Mo…`,l/t));
    const ix0=buildIndex(segs),need=new Set(),hasC=new Set();
    qs.forEach(q=>queryUnits(q).forEach((u,k)=>{const c=candidates(u,ix0,segs);if(c.length)hasC.add(q.id+'|'+k);c.forEach(i=>need.add(i));}));
    const idx=[...need].sort((a,b)=>a-b);
    const vecs=await embed(ext,idx.map(i=>passageText(segs[i])),'passage: ',(a,b)=>prog(`L’IA lit les passages du cours : ${a} / ${b}…`,a/b));
    segVec=new Array(segs.length);idx.forEach((i,k)=>{segVec[i]=vecs[k];});
    const texts=[],keys=[];
    qs.forEach(q=>queryUnits(q).forEach((u,k)=>{if(!hasC.has(q.id+'|'+k))return;texts.push((u.ctx?u.ctx+' ':'')+u.main);keys.push([q.id,k]);}));   // une idée sans passage possible : inutile de la donner à l'IA
    const vs=await embed(ext,texts,'query: ',(a,b)=>prog(`L’IA lit les questions : ${a} / ${b}…`,a/b));
    U=new Map();keys.forEach(([id,k],j)=>{if(!U.has(id))U.set(id,[]);U.get(id)[k]=vs[j];});
  }catch(e){
    console.warn('[cours-annales] IA du navigateur indisponible, recherche par les mots seulement',e);
    notify('IA gratuite indisponible (connexion ?) : recherche par les mots seulement','err');
    segVec=null;U=null;
  }
  const ix=buildIndex(segs),out=new Map();
  qs.forEach(q=>{const m=matchQuestion(q,ix,segs,segVec,U?U.get(q.id):null);out.set(q.id,{segs:m.segs,conf:segVec?m.conf:m.conf*.8});});
  // un même passage choisi pour 4 questions ou plus (souvent un cas clinique qui « ressemble » à tout) : à vérifier
  const use=new Map();out.forEach(m=>m.segs.forEach(s=>use.set(s,(use.get(s)||0)+1)));
  out.forEach(m=>{if(m.segs.some(s=>use.get(s)>=4))m.conf=Math.min(m.conf,.5);});
  return out;
}

/* ───────────────────────── 6. Recherche complète : Gemini ───────────────────────── */
const GKEY='kcu_gemini_key',G_BASE='https://generativelanguage.googleapis.com/v1beta/';
const getKey=()=>{try{return localStorage.getItem(GKEY)||'';}catch(e){return'';}};
const setKey=k=>{try{if(k)localStorage.setItem(GKEY,k);else localStorage.removeItem(GKEY);}catch(e){}};
function GemErr(msg,kind,wait){const e=new Error(msg);e.kind=kind;e.wait=wait||0;return e;}
async function gemFetch(path,key,body){
  let r;
  try{r=await fetch(G_BASE+path,{method:body?'POST':'GET',headers:body?{'x-goog-api-key':key,'Content-Type':'application/json'}:{'x-goog-api-key':key},body:body?JSON.stringify(body):undefined});}
  catch(e){throw GemErr('Impossible de joindre Google (internet coupé ?)','net');}
  let j=null;try{j=await r.json();}catch(e){}
  if(r.ok)return j;
  const err=(j&&j.error)||{},msg=err.message||('erreur '+r.status),det=JSON.stringify(err.details||[]);
  if(/API_KEY_INVALID|API key not valid|API_KEY/i.test(msg+det)||r.status===401)throw GemErr('Google refuse cette clé : vérifie que tu l’as copiée en entier.','key');
  if(r.status===403)throw GemErr('Google refuse cette clé ('+msg+').','key');
  if(r.status===429){
    const daily=/PerDay|per day|daily|RequestsPerDay/i.test(msg+det),m=det.match(/"retryDelay":"(\d+)/);
    throw GemErr(daily?'Limite de Gemini atteinte pour aujourd’hui':'Trop de demandes d’un coup',daily?'daily':'rate',m?+m[1]:20);
  }
  if(r.status===404)throw GemErr('Modèle Gemini introuvable','model');
  if(r.status>=500)throw GemErr('Google est surchargé','rate',10);
  throw GemErr('Gemini : '+msg,'other');
}
async function gemModels(key){
  const j=await gemFetch('models?pageSize=200',key);
  const score=n=>{const m=n.match(/^gemini-(\d+(?:\.\d+)?)-flash(-lite)?(-preview[\w-]*|-exp[\w-]*|-\d{3})?$/);if(!m)return-1;return 200+parseFloat(m[1])*10-(m[2]?100:0)-(m[3]&&!/^-\d{3}$/.test(m[3])?3:0);};
  const ms=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>String(m.name||'').replace(/^models\//,''))
    .filter(n=>score(n)>0&&!/image|tts|audio|live|thinking|8b/.test(n)).sort((a,b)=>score(b)-score(a));
  return ms.length?ms:['gemini-2.5-flash','gemini-2.5-flash-lite'];
}
function gemPrompt(segs,qs){
  const L='ABCDEFGH';
  const course=segs.map(s=>`${s.id} | p.${s.p} | ${s.sec&&s.sec!==s.t?'['+s.sec.slice(0,70)+'] ':''}${s.ctx&&!s.sec?'['+s.ctx.slice(0,70)+'] ':''}${s.t}`).join('\n');
  const qt=qs.map(q=>`${q.id} : ${q.text}\n${q.answers.map((a,k)=>`  ${L[k]}. ${a}${k===q.correct?'   ← bonne réponse':''}`).join('\n')}`).join('\n\n');
  return `Tu aides un étudiant en kinésithérapie à relier les questions d'examen (annales) à son cours.

COURS — découpé en passages. Chaque ligne : identifiant | page | [section] texte du passage.
${course}

QUESTIONS — la bonne réponse est indiquée.
${qt}

Pour CHAQUE question, donne l'identifiant du ou des passages du cours qui contiennent précisément l'information qui permet de trouver la bonne réponse (ou de savoir que les autres réponses sont fausses).
Règles :
- Sois très précis : un passage qui parle seulement du même thème ne suffit pas, il doit contenir l'information elle-même. Évite les titres.
- En général 1 passage. Jusqu'à 4 seulement si l'information est vraiment répartie (par exemple « toutes sont vraies » ou « SAUF »).
- Si le cours ne contient pas cette information, renvoie une liste vide : ne devine pas.
- c = ta confiance entre 0 et 1.
Réponds uniquement en JSON.`;
}
async function gemMatch(segs,qs,key,prog){
  prog('Connexion à Gemini…',0);
  const models=await gemModels(key);let mi=0;
  const out=new Map(),valid=new Set(segs.map(s=>s.id)),B=20;
  const big=segs.reduce((a,s)=>a+s.t.length+30,0)>170000,ix=big?buildIndex(segs):null;
  const pick=batch=>{   // cours très long : seulement les passages candidats
    if(!big)return segs;
    const keep=new Set();
    batch.forEach(q=>queryUnits(q).forEach(u=>{const sc=bm25(ix,unitWeights(u));Array.from(sc.keys()).sort((a,b)=>sc[b]-sc[a]).slice(0,30).forEach(i=>keep.add(i));}));
    return segs.filter((_,i)=>keep.has(i));
  };
  for(let i=0;i<qs.length;i+=B){
    const batch=qs.slice(i,i+B);let tries=0;
    for(;;){
      prog(`Gemini cherche les questions ${i+1} à ${Math.min(qs.length,i+B)} sur ${qs.length}…`,i/qs.length);
      try{
        const j=await gemFetch(`models/${models[mi]}:generateContent`,key,{
          contents:[{role:'user',parts:[{text:gemPrompt(pick(batch),batch)}]}],
          generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:{type:'ARRAY',items:{type:'OBJECT',properties:{q:{type:'STRING'},s:{type:'ARRAY',items:{type:'STRING'}},c:{type:'NUMBER'}},required:['q','s']}}}});
        const cand=(j&&j.candidates&&j.candidates[0])||{},parts=(cand.content&&cand.content.parts)||[];
        let arr=[];try{arr=JSON.parse(parts.map(p=>p.text||'').join('')||'[]');}catch(e){arr=[];}
        if(!Array.isArray(arr))arr=[];
        for(const o of arr){if(!o||!batch.some(q=>q.id===o.q))continue;out.set(o.q,{segs:(o.s||[]).map(x=>String(x).trim()).filter(x=>valid.has(x)).slice(0,4),conf:typeof o.c==='number'?Math.max(0,Math.min(1,o.c)):.8});}
        batch.forEach(q=>{if(!out.has(q.id))out.set(q.id,{segs:[],conf:0});});
        break;
      }catch(e){
        if(e.kind==='rate'&&tries<6){tries++;const w=Math.min(65,(e.wait||20)+1);for(let t=w;t>0;t--){prog(`Gemini demande une petite pause : reprise dans ${t} s…`,i/qs.length);await sleep(1000);}continue;}
        if((e.kind==='daily'||e.kind==='model')&&mi<models.length-1){mi++;tries=0;continue;}
        e.done=out;throw e;
      }
    }
    if(i+B<qs.length)await sleep(4000);
  }
  return out;
}

/* ───────────────────────── 7. Liens : couleurs et états ───────────────────────── */
const UNSURE=.5;
function linkOf(P,qid){const l=P.links[qid];return l&&l.segs&&l.segs.length?l:null;}
function isUnsure(l){return !!l&&!l.ok&&l.src!=='main'&&(l.conf||0)<(l.src==='local'?.65:l.src==='ia'?.56:UNSURE);}
function counts(P){const m=new Map();P.qs.forEach(q=>{const l=linkOf(P,q.id);if(l)l.segs.forEach(s=>{const o=m.get(s)||{n:0,sure:0};o.n++;if(!isUnsure(l))o.sure++;m.set(s,o);});});return m;}
function qsOfSeg(P,sid){return P.qs.filter(q=>{const l=linkOf(P,q.id);return l&&l.segs.includes(sid);});}
function stats(P){const pend=new Set(P.pending||[]);let inC=0,uns=0,none=0;P.qs.forEach(q=>{const l=linkOf(P,q.id);if(!l){if(!pend.has(q.id))none++;}else{inC++;if(isUnsure(l))uns++;}});return{inC,uns,none,pend:pend.size};}
const lvl=n=>n>=3?3:n;

/* ───────────────────────── 8. Assistant (fenêtre de départ) ───────────────────────── */
let WZ={course:null,annale:null,method:'local',rerun:null,busy:false};
try{WZ.method=localStorage.getItem('kcu_ca_method')||'local';}catch(e){}
function wzEnsure(){
  if($('modal-ca'))return;
  const d=document.createElement('div');d.className='mdbg';d.id='modal-ca';
  d.innerHTML='<div class="md ca-wz" role="dialog" aria-label="Relier un cours aux annales"><div id="ca-wz-body"></div></div>';
  d.addEventListener('click',e=>{if(e.target===d&&!WZ.busy)wzClose();});
  d.addEventListener('click',wzClick);
  d.addEventListener('change',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.file&&t.files[0])wzSetFile(t.dataset.file,t.files[0]);});
  d.addEventListener('input',e=>{if(e.target&&e.target.id==='ca-key')setKey(e.target.value.trim());});
  document.body.appendChild(d);
}
function wzOpen(rerun){
  wzEnsure();WZ.course=null;WZ.annale=null;WZ.rerun=rerun||null;WZ.busy=false;
  if(typeof openModal==='function')openModal('modal-ca');else $('modal-ca').classList.add('open');
  wzForm();
}
function wzClose(){if(WZ.busy)return;if(typeof closeModal==='function')closeModal('modal-ca');else if($('modal-ca'))$('modal-ca').classList.remove('open');}
function wzHead(title,desc){return `<div class="ca-wz-head"><div><div class="mdttl">${title}</div>${desc?`<div class="mddesc">${desc}</div>`:''}</div><button class="ca-x" data-a="wzclose" aria-label="Fermer"><span class="ms">close</span></button></div>`;}
function dropHtml(k,label,hint){
  const f=WZ[k];
  return `<label class="ca-drop${f?' has':''}" data-drop="${k}"><input type="file" accept="application/pdf,.pdf" data-file="${k}" hidden>
    <span class="ms">${f?'task':k==='course'?'menu_book':'quiz'}</span><b>${label}</b><small>${f?esc(f.name):hint}</small></label>`;
}
function wzForm(err){
  const R=WZ.rerun,key=getKey();
  $('ca-wz-body').innerHTML=wzHead(R?'Relancer la recherche':'Relier un cours aux annales',
    R?'Les liens que tu as placés ou validés toi-même sont gardés.':'Je colore dans ton cours les passages tombés à l’examen (<b class="ca-t1">1 fois</b>, <b class="ca-t2">2 fois</b>, <b class="ca-t3">3 fois et +</b>). Un clic sur un passage montre la question, un clic sur la question montre le passage.')+
    (err?`<div class="ca-err"><span class="ms">error</span><span>${esc(err)}</span></div>`:'')+
    (R?'':`<div class="ca-drops">${dropHtml('course','Le cours (PDF)','clique ou glisse le PDF ici')}${dropHtml('annale','L’annale (PDF)','avec les bonnes réponses (surlignées, ✔ ou « Bonne réponse : C »)')}</div>`)+
    `<div class="ca-lbl">Qui cherche les passages ?</div>
    <div class="ca-meth">
      <button class="ca-m${WZ.method==='local'?' on':''}" data-a="meth" data-m="local"><span class="ms">memory</span><span><b>IA gratuite du navigateur</b><small>Gratuite et illimitée, rien à régler. Elle relit chaque passage avec la question (≈ 8 liens justes sur 10). La 1<sup>re</sup> fois : téléchargement d’environ 0,7 Go, puis 2 à 5 minutes par annale. Sur un appareil sans carte graphique compatible : méthode simple, moins précise.</small></span></button>
      <button class="ca-m${WZ.method==='relais'?' on':''}" data-a="meth" data-m="relais"><span class="ms">content_paste</span><span><b>Gemini ou ChatGPT sur leur site · le plus précis</b><small>Gratuit, sans clé. Je prépare une consigne avec ton cours et tes questions : tu la colles dans l’IA (un clic), puis tu ramènes sa réponse ici. Environ 2 minutes.</small></span></button>
      <button class="ca-m${WZ.method==='gemini'?' on':''}" data-a="meth" data-m="gemini"><span class="ms">auto_awesome</span><span><b>Gemini · plus précis</b><small>Gratuit avec une clé Google. Nombre de demandes limité par jour : si la limite est atteinte, tu pourras finir avec l’IA gratuite ou reprendre le lendemain.</small></span></button>
    </div>
    <div class="ca-key"${WZ.method==='gemini'?'':' hidden'}>
      <div class="ca-keyrow"><input id="ca-key" type="password" autocomplete="off" spellcheck="false" placeholder="Colle ta clé Gemini ici" value="${esc(key)}"><button class="ca-ib2" data-a="eye" title="Afficher la clé"><span class="ms">visibility</span></button></div>
      <details${key?'':' open'}><summary>Comment avoir une clé gratuite ? (2 minutes)</summary>
        <ol><li>Ouvre <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.</li><li>Connecte-toi avec ton compte Google.</li><li>Clique sur <b>Create API key</b> (« Créer une clé API »).</li><li>Copie la clé et colle-la ci-dessus.</li></ol>
        <small>La clé reste enregistrée dans ce navigateur uniquement. Avec la formule gratuite, Google peut se servir des textes envoyés (ton cours, tes annales) pour améliorer ses IA.</small>
      </details>
    </div>
    <div class="ca-foot"><button class="btn btn-p" data-a="go"><span class="ms">${R?'refresh':'link'}</span>${R?'Relancer':'Relier'}</button></div>`;
  document.querySelectorAll('#ca-wz-body .ca-drop').forEach(z=>{
    z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('over');});
    z.addEventListener('dragleave',()=>z.classList.remove('over'));
    z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('over');const f=e.dataTransfer.files[0];if(f)wzSetFile(z.dataset.drop,f);});
  });
}
function wzSetFile(k,f){
  if(!/\.pdf$/i.test(f.name||'')&&f.type!=='application/pdf'){wzForm('« '+f.name+' » n’est pas un PDF.');return;}
  WZ[k]=f;wzForm();
}
function wzProgress(label,frac,sub){
  const b=$('ca-wz-body');
  if(!$('ca-prog'))b.innerHTML=wzHead('Je relie ton cours aux annales…','')+`<div class="ca-prog" id="ca-prog"><div class="ca-spin"></div><b id="ca-plabel"></b><div class="ca-bar"><i id="ca-pbar"></i></div><small id="ca-psub"></small><small class="ca-pnote">Garde cet onglet ouvert pendant la recherche.</small></div>`;
  $('ca-plabel').textContent=label;$('ca-pbar').style.width=Math.round(Math.max(0,Math.min(1,frac||0))*100)+'%';if(sub!=null)$('ca-psub').textContent=sub;
}
function wzClick(e){
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a;
  if(a==='wzclose')wzClose();
  else if(a==='meth'){WZ.method=b.dataset.m;try{localStorage.setItem('kcu_ca_method',WZ.method);}catch(_){}wzForm();}
  else if(a==='eye'){const i=$('ca-key');if(i)i.type=i.type==='password'?'text':'password';}
  else if(a==='go')wzRun();
  else if(a==='finishLocal')finishPending('local');
  else if(a==='later'){WZ.busy=false;wzClose();if(WZ._pid)openViewer(WZ._pid);}
}
const copyBuf=b=>new Uint8Array(b.slice(0));
async function wzRun(){
  if(WZ.busy)return;
  const R=WZ.rerun,key=getKey();
  if(!R&&(!WZ.course||!WZ.annale)){wzForm(!WZ.course&&!WZ.annale?'Choisis le cours et l’annale (deux fichiers PDF).':!WZ.course?'Il manque le cours.':'Il manque l’annale.');return;}
  if(WZ.method==='gemini'&&!key){wzForm('Colle ta clé Gemini, ou choisis l’IA gratuite du navigateur.');return;}
  if(typeof pdfjsLib==='undefined'){wzForm('Le lecteur PDF n’est pas chargé : recharge la page.');return;}
  WZ.busy=true;
  const prog=(l,f)=>wzProgress(l,f,R?R.name:((WZ.course&&WZ.course.name)||'')+' + '+((WZ.annale&&WZ.annale.name)||''));
  let P;
  try{
    if(R){P=R;}
    else{
      prog('Ouverture du cours…',0);
      const courseBuf=await WZ.course.arrayBuffer(),annaleBuf=await WZ.annale.arrayBuffer();
      const C=await readCourse(copyBuf(courseBuf),(l,f)=>prog(l,f*.5));
      if(!C.segs.length)throw new Error('Je ne trouve pas de texte dans ce cours. Si c’est un scan (des photos de pages), il faut d’abord le passer dans un logiciel de reconnaissance de texte (OCR).');
      addContext(C.segs,C.pages);
      if(typeof window._annaleReadPdf!=='function')throw new Error('le module d’annales n’est pas chargé, recharge la page');
      const lines=await window._annaleReadPdf(new Blob([annaleBuf],{type:'application/pdf'}),(l,pct)=>prog(String(l).replace(/^Lecture de la page/,'Lecture de l’annale : page'),.5+pct/200));
      const qs=parseAnnale(lines);
      if(!qs.length)throw new Error('Je n’ai trouvé aucune question avec des réponses A, B, C… dans l’annale. Si c’est un scan, il faut d’abord le passer dans un logiciel de reconnaissance de texte (OCR).');
      P={id:newId(),name:WZ.course.name.replace(/\.pdf$/i,'').replace(/[_]+/g,' ').trim()||'Cours',created:Date.now(),
        courseName:WZ.course.name,annaleName:WZ.annale.name,course:courseBuf,annale:annaleBuf,
        pages:C.pages,segs:C.segs,qs,links:{},pending:[],showOrig:!C.oldAnnales,method:WZ.method};
    }
    const keepOwn=qid=>{const l=P.links[qid];return l&&(l.src==='main'||l.ok);};
    const todo=P.qs.filter(q=>!keepOwn(q.id));
    if(WZ.method==='relais'){
      P.method='relais';P.pending=todo.map(q=>q.id);
      prog('Préparation de la consigne…',1);await save(P);
      WZ.busy=false;wzClose();relayOpen(P,todo);return;
    }
    await runMethod(P,todo,WZ.method,key,prog);
  }catch(e){
    WZ.busy=false;
    if(e&&e.kind==='daily'&&P){await afterDaily(P,e);return;}
    console.error('[cours-annales]',e);
    wzForm(e&&e.message?e.message:String(e));return;
  }
  WZ.busy=false;wzClose();
  notify(`Cours relié : ${stats(P).inC} question${stats(P).inC>1?'s':''} placée${stats(P).inC>1?'s':''} dans le cours`,'ok');
  openViewer(P.id);
}
async function runMethod(P,todo,method,key,prog){
  P.method=method;
  if(!todo.length){await save(P);return;}
  if(method==='gemini'){
    try{const out=await gemMatch(P.segs,todo,key,prog);applyOut(P,out,'gemini');P.pending=[];}
    catch(e){if(e.done){applyOut(P,e.done,'gemini');P.pending=todo.filter(q=>!e.done.has(q.id)).map(q=>q.id);}await save(P);throw e;}
  }else{
    const r=await freeMatch(P.segs,todo,prog);applyOut(P,r.out,r.src);P.pending=[];
  }
  prog('Enregistrement…',1);
  await save(P);
}
function applyOut(P,out,src){out.forEach((m,qid)=>{P.links[qid]={segs:m.segs,conf:m.conf,src,ok:false};});}
async function afterDaily(P,e){
  WZ._pid=P.id;WZ.rerun=P;WZ.busy=false;
  const st=stats(P);
  $('ca-wz-body').innerHTML=wzHead('Limite de Gemini atteinte pour aujourd’hui','')+
    `<div class="ca-daily"><span class="ms">hourglass_bottom</span><div><b>${P.qs.length-st.pend} question${P.qs.length-st.pend>1?'s':''} traitée${P.qs.length-st.pend>1?'s':''}, ${st.pend} restante${st.pend>1?'s':''}.</b><br>Tu peux finir maintenant avec l’IA gratuite du navigateur, ou attendre demain et relancer Gemini depuis le cours (bouton « Continuer avec Gemini »).</div></div>
    <div class="ca-foot"><button class="btn btn-g" data-a="later"><span class="ms">schedule</span>Reprendre demain</button><button class="btn btn-p" data-a="finishLocal"><span class="ms">memory</span>Finir avec l’IA gratuite</button></div>`;
}
async function finishPending(method){
  const P=(V&&V.P)||WZ.rerun;if(!P)return;
  const todo=P.qs.filter(q=>(P.pending||[]).includes(q.id));
  if(method==='relais'){if(V)closeViewer(true);relayOpen(P,todo);return;}
  if(method==='gemini'&&!getKey()){closeViewer(true);wzOpen(P);WZ.method='gemini';wzForm('Colle ta clé Gemini pour continuer.');return;}
  if(V)closeViewer(true);   // la fenêtre de progression passe devant
  WZ.busy=true;WZ.rerun=P;
  if(!$('modal-ca')||!$('modal-ca').classList.contains('open')){wzEnsure();if(typeof openModal==='function')openModal('modal-ca');else $('modal-ca').classList.add('open');}
  $('ca-wz-body').innerHTML='';
  const prog=(l,f)=>wzProgress(l,f,P.name);
  try{await runMethod(P,todo,method,getKey(),prog);}
  catch(e){WZ.busy=false;if(e&&e.kind==='daily'){await afterDaily(P,e);return;}wzForm(e&&e.message||String(e));return;}
  WZ.busy=false;wzClose();openViewer(P.id);
}

/* ───────── 8 bis. Copier-coller vers Gemini / ChatGPT (Atelier IA, 16 nov. 2026) ───────── */
function relayPrompt(segs,qs){
  let use=segs;
  if(segs.reduce((a,s)=>a+s.t.length+30,0)>170000){   // cours très long : seulement les passages candidats (comme gemMatch)
    const ix=buildIndex(segs),keep=new Set();
    qs.forEach(q=>queryUnits(q).forEach(u=>{const sc=bm25(ix,unitWeights(u));Array.from(sc.keys()).sort((a,b)=>sc[b]-sc[a]).slice(0,30).forEach(i=>keep.add(i));}));
    use=segs.filter((_,i)=>keep.has(i));
  }
  return gemPrompt(use,qs).replace(/Réponds uniquement en JSON\.\s*$/,'')+`- Réponds pour TOUTES les questions (${qs.length}), dans l’ordre, même celles qui ne sont pas dans le cours (liste vide).

FORMAT DE LA RÉPONSE (très important) : réponds UNIQUEMENT avec un seul bloc de code \`\`\`json contenant un tableau JSON valide, sans aucun texte avant ou après, exactement sous cette forme :
[{"q":"${qs[0]?qs[0].id:'Q1'}","s":["S12"],"c":0.9},{"q":"…","s":[],"c":0}]`;
}
function relayOpen(P,todo){
  if(!window.KIA||!KIA.relay){notify('Module Atelier IA non chargé : recharge la page','err');openViewer(P.id);return;}
  if(!todo.length){openViewer(P.id);return;}
  const valid=new Set(P.segs.map(s=>s.id)),want=new Map(todo.map(q=>[String(q.id).toLowerCase(),q.id]));
  KIA.relay({title:'Relier le cours aux annales',sub:P.name+' · '+todo.length+' question'+(todo.length>1?'s':''),icon:'link',color:'#7c3aed',
    prompt:relayPrompt(P.segs,todo),file:'consigne-cours-annales',saveLabel:'Placer les questions dans le cours',
    parse(text){
      const r=KIA.parseJSON(text);
      let a=r&&r.v;
      if(a&&!Array.isArray(a)&&typeof a==='object')a=Array.isArray(a.liens||a.links||a.questions)?(a.liens||a.links||a.questions):Object.entries(a).map(([q,s])=>({q,s}));
      if(!Array.isArray(a))return {state:'err',msg:'Je ne trouve pas la liste JSON des questions dans ce texte.'};
      const out=new Map();let placed=0;
      a.forEach(o=>{
        if(!o||typeof o!=='object')return;
        const id=want.get(String(o.q||o.question||o.id||'').trim().toLowerCase());if(!id)return;
        let ss=o.s||o.passages||o.segs||[];if(!Array.isArray(ss))ss=[ss];
        const segs=ss.map(x=>String(x).trim().toUpperCase().replace(/^(\d+)$/,'S$1')).filter(x=>valid.has(x)).slice(0,4);
        const c=typeof o.c==='number'?Math.max(0,Math.min(1,o.c)):.8;
        out.set(id,{segs,conf:segs.length?c:0});if(segs.length)placed++;
      });
      if(!out.size)return {state:'err',msg:'Aucune question de cette annale dans la réponse (vérifie que tu as collé la bonne réponse).'};
      const miss=todo.length-out.size;
      return {state:miss>0?'warn':'ok',data:out,cut:miss>0,msg:`${out.size} question${out.size>1?'s':''} sur ${todo.length} · ${placed} placée${placed>1?'s':''} dans le cours${miss>0?' · '+miss+' manquante'+(miss>1?'s':''):''}`};
    },
    async onSave(out){
      applyOut(P,out,'relais');
      P.method='relais';P.pending=todo.filter(q=>!out.has(q.id)).map(q=>q.id);
      await save(P);
      const st=stats(P);
      notify(`Cours relié : ${st.inC} question${st.inC>1?'s':''} placée${st.inC>1?'s':''} dans le cours`,'ok');
      openViewer(P.id);
    }
  });
}

/* ───────────────────────── 9. Lecteur ───────────────────────── */
let V=null,saveT=null;
async function save(P){P.updated=Date.now();await dbPut(P);}
function saveSoon(){clearTimeout(saveT);const P=V&&V.P;saveT=setTimeout(()=>{if(P)save(P).catch(e=>notify('Enregistrement impossible : '+e.message,'err'));},400);}
async function openViewer(id){
  const P=await dbGet(id).catch(()=>null);
  if(!P){notify('Ce cours relié est introuvable','err');return;}
  closeViewer(true);
  V={P,doc:'course',pdf:{},dims:{},zoom:1,sel:null,filter:'in',placing:null,scrollPos:{},rendered:new Map(),io:{},lay:getLay()};
  V.segById=new Map(P.segs.map(s=>[s.id,s]));V.qById=new Map(P.qs.map(q=>[q.id,q]));
  const el=document.createElement('div');el.id='ca-viewer';el.className='ca-v';
  el.innerHTML=`<header class="ca-top">
      <button class="ca-ib" data-a="close" title="Retour"><span class="ms">arrow_back</span></button>
      <div class="ca-ttl"><b>${esc(P.name)}</b><small id="ca-sub"></small></div>
      <div class="ca-seg ca-seg-doc" role="tablist"><button data-a="doc" data-d="course" class="on">Cours</button><button data-a="doc" data-d="annale">Annale</button></div>
      <div class="ca-lay" role="radiogroup" aria-label="Disposition">
        <button class="ca-ib" data-a="lay" data-l="single" title="Un document + questions"><span class="ms">vertical_split</span></button>
        <button class="ca-ib" data-a="lay" data-l="split" title="Cours et annale côte à côte + questions"><span class="ms">view_column</span></button>
        <button class="ca-ib" data-a="lay" data-l="split2" title="Cours et annale côte à côte (sans la liste)"><span class="ms">splitscreen_left</span></button>
        <button class="ca-ib" data-a="lay" data-l="focus" title="Document seul, plein écran"><span class="ms">fullscreen</span></button>
      </div>
      <div class="ca-legend" title="Nombre de fois où le passage est tombé"><span><i class="ca-c1"></i>1×</span><span><i class="ca-c2"></i>2×</span><span><i class="ca-c3"></i>3×+</span></div>
      <div class="ca-zoom"><button class="ca-ib" data-a="zoom" data-z="-1" title="Réduire"><span class="ms">zoom_out</span></button><button class="ca-ib" data-a="zoom" data-z="1" title="Agrandir"><span class="ms">zoom_in</span></button></div>
      <button class="ca-ib" data-a="menu" title="Options"><span class="ms">more_vert</span></button>
      <button class="ca-ib ca-ponly" data-a="sheet" title="Questions"><span class="ms">quiz</span></button>
    </header>
    <div class="ca-banner" id="ca-banner" hidden></div>
    <div class="ca-body"><div class="ca-docs" id="ca-docs"><div class="ca-scroll" id="ca-scroll-course" data-doc="course"><div class="ca-dh"><span class="ms">menu_book</span>Cours</div><div class="ca-pages" id="ca-pages-course"></div></div><div class="ca-scroll" id="ca-scroll-annale" data-doc="annale" hidden><div class="ca-dh"><span class="ms">quiz</span>Annale</div><div class="ca-pages" id="ca-pages-annale"></div></div></div>
      <aside class="ca-panel" id="ca-panel"></aside></div>
    <div class="ca-menu" id="ca-menu" hidden></div>`;
  document.body.appendChild(el);document.body.classList.add('ca-open');
  el.addEventListener('click',vClick);
  el.addEventListener('pointerdown',vDown);el.addEventListener('pointermove',vMove);el.addEventListener('pointerup',vUp);el.addEventListener('pointercancel',()=>{if(DR&&DR.box)DR.box.remove();DR=null;});
  ['course','annale'].forEach(d=>sc(d).addEventListener('scroll',()=>{if(V)V.scrollPos[d]=sc(d).scrollTop;},{passive:true}));
  applyLay(V.lay);
  window.addEventListener('resize',onResize);document.addEventListener('keydown',onKey);
  try{await showDoc('course');if(isSplit())await showDoc('annale',true);}catch(e){console.error(e);notify('Lecture du cours impossible : '+e.message,'err');}
  renderAll();
}
function closeViewer(silent){
  if(!V)return;
  try{Object.values(V.pdf).forEach(p=>p&&p.destroy&&p.destroy());}catch(e){}
  Object.values(V.io||{}).forEach(o=>o&&o.disconnect());
  const el=$('ca-viewer');if(el)el.remove();
  document.body.classList.remove('ca-open');
  window.removeEventListener('resize',onResize);document.removeEventListener('keydown',onKey);
  V=null;
  if(!silent&&document.body.dataset.screen==='annales-hub')renderHub();
}
function onKey(e){if(!V)return;if(e.key==='Escape'){if(V.placing){V.placing=null;renderAll();}else if(!$('ca-menu').hidden)$('ca-menu').hidden=true;else closeViewer();}}
let rT=null;function onResize(){clearTimeout(rT);rT=setTimeout(()=>{if(V)visDocs().forEach(d=>layoutPages(d,true));},150);}
/* Dispositions (15 nov. 2026) : single = un document + liste ; split = cours | annale + liste ; split2 = cours | annale ; focus = un document seul */
const LAYS=['single','split','split2','focus'];
function getLay(){const def=window.innerWidth>=1100?'split':'single';try{const l=localStorage.getItem('ca_layout');return LAYS.includes(l)?l:def;}catch(e){return def;}}
function isSplit(){return V&&(V.lay==='split'||V.lay==='split2');}
function sc(doc){return $('ca-scroll-'+doc);}
function visDocs(){return isSplit()?['course','annale']:[V.doc];}
function applyLay(l){
  const el=$('ca-viewer');if(!el||!V)return;
  V.lay=l;try{localStorage.setItem('ca_layout',l);}catch(e){}
  el.dataset.lay=l;
  el.querySelectorAll('[data-a="lay"]').forEach(b=>b.classList.toggle('on',b.dataset.l===l));
  sc('course').hidden=!isSplit()&&V.doc!=='course';
  sc('annale').hidden=!isSplit()&&V.doc!=='annale';
}
async function setLay(l){
  if(!V)return;
  applyLay(l);
  if(isSplit()){await showDoc(V.doc==='annale'?'course':'annale',true);if(!V)return;}
  else await showDoc(V.doc);
  if(!V)return;
  visDocs().forEach(d=>layoutPages(d,true));drawOverlays();
}
async function getPdf(doc){
  if(V.pdf[doc])return V.pdf[doc];
  const buf=doc==='course'?V.P.course:V.P.annale;
  const pdf=await pdfjsLib.getDocument({data:copyBuf(buf)}).promise;
  if(!V)return null;V.pdf[doc]=pdf;
  if(!V.dims[doc]){
    if(doc==='course')V.dims[doc]=V.P.pages.map(p=>({w:p.w,h:p.h}));
    else{const d=[];for(let i=1;i<=pdf.numPages;i++){const vp=(await pdf.getPage(i)).getViewport({scale:1});d.push({w:vp.width,h:vp.height});}V.dims[doc]=d;}
  }
  return pdf;
}
async function showDoc(doc,keepCur){
  if(!V)return;
  if(!keepCur)V.doc=doc;
  document.querySelectorAll('#ca-viewer .ca-seg-doc button').forEach(b=>b.classList.toggle('on',b.dataset.d===V.doc));
  sc('course').hidden=!isSplit()&&V.doc!=='course';sc('annale').hidden=!isSplit()&&V.doc!=='annale';
  await getPdf(doc);if(!V)return;
  const box=$('ca-pages-'+doc);
  if(!box.childElementCount){
    box.innerHTML=V.dims[doc].map((d,i)=>`<div class="ca-page" data-doc="${doc}" data-p="${i+1}"><canvas></canvas><div class="ca-ov"></div><div class="ca-ov2"></div><span class="ca-pn">${i+1}</span></div>`).join('');
    if(!V.io[doc])V.io[doc]=new IntersectionObserver(onIO,{root:sc(doc),rootMargin:'900px 0px'});
    box.querySelectorAll('.ca-page').forEach(p=>V.io[doc].observe(p));
  }
  layoutPages(doc,false);
  drawOverlays();
  sc(doc).scrollTop=V.scrollPos[doc]||0;
}
function pageWidth(doc){const s=sc(doc);const avail=Math.max(220,(s&&s.clientWidth?s.clientWidth:800)-28);return Math.round(Math.min(avail,isSplit()?1400:960)*V.zoom);}
function layoutPages(doc,rerender){
  const W=pageWidth(doc);
  document.querySelectorAll(`#ca-pages-${doc} .ca-page`).forEach(el=>{
    const d=V.dims[doc][+el.dataset.p-1];el.style.width=W+'px';el.style.height=Math.round(W*d.h/d.w)+'px';
    if(rerender&&el.dataset.r){el.dataset.r='';if(el._vis)renderPage(el);}
  });
}
function onIO(entries){entries.forEach(en=>{const el=en.target;el._vis=en.isIntersecting;if(en.isIntersecting){if(!el.dataset.r)renderPage(el);}else releasePage(el);});}
async function renderPage(el){
  if(!V)return;
  const doc=el.dataset.doc,p=+el.dataset.p,pdf=await getPdf(doc);if(!pdf||!V)return;
  const key=String(Math.round(el.clientWidth))+(doc==='course'&&V.P.showOrig?'o':'');
  if(el.dataset.r===key)return;el.dataset.r=key;
  if(el._task){try{el._task.cancel();}catch(e){}}
  const page=await pdf.getPage(p),d=V.dims[doc][p-1],dpr=Math.min(2,window.devicePixelRatio||1);
  const vp=page.getViewport({scale:el.clientWidth/d.w*dpr});
  const cv=document.createElement('canvas');cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
  const AM=pdfjsLib.AnnotationMode||{};
  const showAnn=doc==='annale'||V.P.showOrig;
  try{
    el._task=page.render({canvasContext:cv.getContext('2d'),viewport:vp,annotationMode:showAnn?(AM.ENABLE!=null?AM.ENABLE:1):(AM.DISABLE!=null?AM.DISABLE:0)});
    await el._task.promise;
    const old=el.querySelector('canvas');if(old)old.replaceWith(cv);
  }catch(e){if(!e||e.name!=='RenderingCancelledException')console.warn('[cours-annales] rendu',e);el.dataset.r='';}
  el._task=null;
}
function releasePage(el){
  if(!el.dataset.r)return;
  if(el._task){try{el._task.cancel();}catch(e){}el._task=null;}
  const c=el.querySelector('canvas');if(c){c.width=0;c.height=0;}
  el.dataset.r='';
}
/* Couleurs sur le cours, zones cliquables sur l'annale */
function drawOverlays(){
  if(!V)return;
  const P=V.P,cnt=counts(P),selSeg=V.sel&&V.sel.type==='seg'?V.sel.id:null,selQ=V.sel&&V.sel.type==='q'?V.sel.id:null;
  const selQSegs=selQ&&linkOf(P,selQ)?linkOf(P,selQ).segs:[];
  if($('ca-pages-course').childElementCount){
    const byP={};P.segs.forEach(s=>{(byP[s.p]=byP[s.p]||[]).push(s);});
    document.querySelectorAll('#ca-pages-course .ca-page').forEach(el=>{
      const segs=byP[+el.dataset.p]||[];let h='',x='';
      el.classList.toggle('drawing',!!V.placing);
      for(const s of segs){
        const c=cnt.get(s.id);
        if(!c&&!V.placing)continue;
        const cls=(c?`ca-mk ca-c${lvl(c.n)}${c.sure?'':' unsure'}`:'ca-mk ca-hit')+(s.user?' user':'');
        const isSel=s.id===selSeg||selQSegs.includes(s.id),on=isSel?' sel':'';
        h+=s.r.map(R=>`<div class="${cls}${on}" data-s="${s.id}" style="left:${(R[0]*100).toFixed(2)}%;top:${(R[1]*100).toFixed(2)}%;width:${((R[2]-R[0])*100).toFixed(2)}%;height:${((R[3]-R[1])*100).toFixed(2)}%"></div>`).join('');
        /* petite croix pour retirer le surlignage sélectionné (16 nov. 2026) */
        if(isSel&&c&&!V.placing){
          const R=s.r.reduce((m,r)=>r[1]<m[1]||(r[1]===m[1]&&r[2]>m[2])?r:m,s.r[0]);
          const tip=selQ?'Pas ici : retirer ce passage de la question':'Retirer ce surlignage';
          x+=`<button class="ca-mkx" data-a="${selQ?'unlink':'rmSeg'}" data-s="${s.id}"${selQ?` data-q="${selQ}"`:''} title="${tip}" style="left:${(Math.min(R[2],.985)*100).toFixed(2)}%;top:${(Math.max(R[1],.015)*100).toFixed(2)}%"><span class="ms">close</span></button>`;
        }
      }
      el.querySelector('.ca-ov').innerHTML=h;
      const o2=el.querySelector('.ca-ov2');if(o2)o2.innerHTML=x;
    });
  }
  if($('ca-pages-annale').childElementCount){
    const byP={};
    P.qs.forEach(q=>{
      const l=linkOf(P,q.id),tag=l?`p. ${[...new Set(l.segs.map(s=>V.segById.get(s)&&V.segById.get(s).p))].filter(Boolean).join(', ')}`:'pas dans le cours';
      const add=(p,y0,y1)=>{(byP[p]=byP[p]||[]).push({q,y0:Math.max(0,y0),y1:Math.min(1,y1),tag,l});};
      if(q.pageEnd===q.page||!q.pageEnd)add(q.page,q.y-.03,Math.max(q.y+.04,(q.yEnd||q.y)+.014));
      else{add(q.page,q.y-.03,.965);add(q.pageEnd,.035,(q.yEnd||.1)+.014);}
    });
    document.querySelectorAll('#ca-pages-annale .ca-page').forEach(el=>{
      el.querySelector('.ca-ov').innerHTML=(byP[+el.dataset.p]||[]).map(z=>`<div class="ca-qz${z.l?' linked':''}${z.q.id===selQ?' sel':''}" data-q="${z.q.id}" style="top:${(z.y0*100).toFixed(2)}%;height:${((z.y1-z.y0)*100).toFixed(2)}%"><span class="ca-qtag${z.l?' ca-c'+lvl(1):''}"><span class="ms">${z.l?'menu_book':'remove'}</span>${esc(z.tag)}</span></div>`).join('');
    });
  }
}
function renderAll(){
  if(!V)return;
  const st=stats(V.P);
  $('ca-sub').textContent=`${st.inC} question${st.inC>1?'s':''} sur ${V.P.qs.length} dans ce cours${st.uns?` · ${st.uns} à vérifier`:''}`;
  const bn=$('ca-banner');
  if(V.placing){const q=V.qById.get(V.placing);bn.hidden=false;bn.className='ca-banner place';bn.innerHTML=`<span class="ms">ads_click</span><span>Clique sur le passage du cours qui répond à : <b>${esc((q&&q.text||'').slice(0,110))}</b><br><small>… ou <b>trace un cadre</b> à la souris où tu veux (une image, un schéma, un morceau de texte).</small></span><button class="btn btn-g btn-sm" data-a="cancelPlace">Annuler</button>`;}
  else if(st.pend){bn.hidden=false;bn.className='ca-banner';bn.innerHTML=`<span class="ms">hourglass_bottom</span><span><b>${st.pend} question${st.pend>1?'s':''}</b> pas encore cherchée${st.pend>1?'s':''} ${V.P.method==='relais'?'(en attente de la réponse de l’IA).</span><button class="btn btn-p btn-sm" data-a="pend" data-m="relais">Coller la réponse de l’IA</button>':'(limite de Gemini).</span><button class="btn btn-g btn-sm" data-a="pend" data-m="gemini">Continuer avec Gemini</button>'}<button class="btn btn-g btn-sm" data-a="pend" data-m="local">Finir avec l’IA gratuite</button>`;}
  else bn.hidden=true;
  drawOverlays();renderPanel();
}
function qMeta(q){return `${esc(q.exam||'Annale')}${q.num?` · Q${q.num}`:''}`;}
function qCard(q,opts){
  const P=V.P,l=linkOf(P,q.id),L='ABCDEFGH',uns=isUnsure(l);
  const pages=l?[...new Set(l.segs.map(s=>V.segById.get(s)&&V.segById.get(s).p).filter(Boolean))]:[];
  return `<div class="ca-qc${uns?' unsure':''}" data-q="${q.id}">
    <div class="ca-qm"><span>${qMeta(q)}</span>${l?`<span class="ca-pill${uns?' warn':''}">${uns?'à vérifier':'p. '+pages.join(', ')}</span>`:'<span class="ca-pill off">pas dans le cours</span>'}</div>
    <div class="ca-qt">${esc(q.text)}</div>
    <ol class="ca-ans">${q.answers.map((a,k)=>`<li class="${k===q.correct?'ok':''}"><b>${L[k]}</b><span>${esc(a)}</span>${k===q.correct?'<span class="ms">check</span>':''}</li>`).join('')}</ol>
    <div class="ca-qa">
      ${l&&opts&&opts.go?`<button class="btn btn-g btn-sm" data-a="goq" data-q="${q.id}"><span class="ms">menu_book</span>Voir dans le cours</button>`:''}
      <button class="btn btn-g btn-sm" data-a="toAnnale" data-q="${q.id}"><span class="ms">quiz</span>Voir dans l’annale</button>
      ${uns?`<button class="btn btn-g btn-sm" data-a="ok" data-q="${q.id}"><span class="ms">check</span>C’est juste</button>`:''}
      <button class="btn btn-g btn-sm" data-a="place" data-q="${q.id}"><span class="ms">ads_click</span>${l?'Ajouter un passage':'Placer à la main'}</button>
      ${l&&opts&&opts.seg?`<button class="btn btn-g btn-sm ca-danger" data-a="unlink" data-q="${q.id}" data-s="${opts.seg}"><span class="ms">link_off</span>Pas ici</button>`:''}
      ${l&&!(opts&&opts.seg)?`<button class="btn btn-g btn-sm ca-danger" data-a="unlinkAll" data-q="${q.id}"><span class="ms">link_off</span>Retirer</button>`:''}
    </div></div>`;
}
function renderPanel(){
  if(!V)return;
  const P=V.P,pn=$('ca-panel');
  if(V.sel&&V.sel.type==='seg'){
    const s=V.segById.get(V.sel.id),qs=qsOfSeg(P,V.sel.id);
    pn.innerHTML=`<div class="ca-ph"><button class="ca-ib" data-a="back" title="Toutes les questions"><span class="ms">arrow_back</span></button><div><b>${qs.length?`Tombé ${qs.length} fois`:'Passage'}</b><small>page ${s?s.p:'?'}</small></div></div>
      <blockquote class="ca-quote ca-c${lvl(qs.length||1)}">${s&&s.user?'<span class="ms" style="font-size:16px;vertical-align:-3px;margin-right:4px">crop_free</span>':''}${esc(s?s.t:'')}</blockquote>
      ${qs.length?`<div class="ca-segbar"><button class="btn btn-g btn-sm ca-danger" data-a="rmSeg" data-s="${V.sel.id}"><span class="ms">ink_eraser</span>Retirer ce surlignage</button></div>`:''}
      <div class="ca-list">${qs.map(q=>qCard(q,{seg:V.sel.id})).join('')||'<p class="ca-empty">Aucune question reliée à ce passage.</p>'}</div>`;
    return;
  }
  if(V.sel&&V.sel.type==='q'){
    const q=V.qById.get(V.sel.id);
    pn.innerHTML=`<div class="ca-ph"><button class="ca-ib" data-a="back" title="Toutes les questions"><span class="ms">arrow_back</span></button><div><b>Question</b><small>${q?qMeta(q):''}</small></div></div><div class="ca-list">${q?qCard(q,{go:true}):''}</div>`;
    return;
  }
  const st=stats(P);
  const pend=new Set(P.pending||[]);
  const list=P.qs.filter(q=>{const l=linkOf(P,q.id);return V.filter==='in'?!!l:V.filter==='uns'?isUnsure(l):(!l&&!pend.has(q.id));});
  const chip=(f,lab,n)=>`<button class="ca-chip${V.filter===f?' on':''}" data-a="filter" data-f="${f}">${lab} <b>${n}</b></button>`;
  pn.innerHTML=`<div class="ca-ph"><div><b>Questions de l’annale</b><small>clique pour aller au passage</small></div></div>
    <div class="ca-chips">${chip('in','Dans ce cours',st.inC)}${chip('uns','À vérifier',st.uns)}${chip('none','Pas trouvées',st.none)}</div>
    ${V.filter==='none'&&list.length?'<p class="ca-hint">Souvent normal : l’annale couvre plusieurs cours. Si une question est bien dans ce cours, clique dessus puis « Placer à la main ».</p>':''}
    ${V.filter==='uns'&&list.length?'<p class="ca-hint">L’IA n’est pas sûre de ces passages : vérifie-les, puis « C’est juste » ou « Retirer ».</p>':''}
    <div class="ca-list">${list.map(q=>{const l=linkOf(P,q.id),uns=isUnsure(l),pages=l?[...new Set(l.segs.map(s=>V.segById.get(s)&&V.segById.get(s).p).filter(Boolean))]:[];
      return `<button class="ca-qi${uns?' unsure':''}" data-a="openq" data-q="${q.id}"><span class="ca-qm"><span>${qMeta(q)}</span>${l?`<span class="ca-pill${uns?' warn':''}">${uns?'à vérifier':'p. '+pages.join(', ')}</span>`:''}</span><span class="ca-qt2">${esc(q.text)}</span></button>`;}).join('')||'<p class="ca-empty">Rien ici.</p>'}</div>`;
}
function openSheet(on){const v=$('ca-viewer');if(v)v.classList.toggle('sheet',on!==false);}
async function goToSeg(sid,flash){
  const s=V.segById.get(sid);if(!s)return;
  if(V.doc!=='course'&&!isSplit())await showDoc('course');
  const el=document.querySelector(`#ca-pages-course .ca-page[data-p="${s.p}"]`),S=sc('course');if(!el)return;
  const y=el.offsetTop+s.r[0][1]*el.clientHeight-S.clientHeight*.28;
  S.scrollTo({top:Math.max(0,y),behavior:'smooth'});
  if(flash)setTimeout(()=>document.querySelectorAll(`#ca-pages-course .ca-mk[data-s="${sid}"]`).forEach(m=>{m.classList.remove('flash');void m.offsetWidth;m.classList.add('flash');}),450);
}
async function goToQ(qid){
  const q=V.qById.get(qid);if(!q)return;
  if(V.doc!=='annale'&&!isSplit())await showDoc('annale');
  V.sel={type:'q',id:qid};renderAll();
  const el=document.querySelector(`#ca-pages-annale .ca-page[data-p="${q.page}"]`),S=sc('annale');if(!el)return;
  S.scrollTo({top:Math.max(0,el.offsetTop+q.y*el.clientHeight-S.clientHeight*.2),behavior:'smooth'});
  setTimeout(()=>document.querySelectorAll(`#ca-pages-annale .ca-qz[data-q="${qid}"]`).forEach(m=>{m.classList.remove('flash');void m.offsetWidth;m.classList.add('flash');}),450);
}
/* Tracer un cadre libre (image, schéma…) en mode « Ajouter un passage » — 16 nov. 2026 */
let DR=null;
function vDown(e){
  if(!V||!V.placing||e.button!==0)return;
  const pg=e.target.closest('#ca-pages-course .ca-page');if(!pg||e.target.closest('.ca-mkx'))return;
  const b=pg.getBoundingClientRect();
  DR={pg,b,x0:(e.clientX-b.left)/b.width,y0:(e.clientY-b.top)/b.height,id:e.pointerId,box:null,moved:false};
}
function vMove(e){
  if(!DR||e.pointerId!==DR.id)return;
  const {b}=DR,x=Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y=Math.max(0,Math.min(1,(e.clientY-b.top)/b.height));
  if(!DR.moved&&Math.abs(x-DR.x0)*b.width<6&&Math.abs(y-DR.y0)*b.height<6)return;
  if(!DR.moved){DR.moved=true;try{DR.pg.setPointerCapture(e.pointerId);}catch(_){}DR.box=document.createElement('div');DR.box.className='ca-draw';DR.pg.querySelector('.ca-ov2').appendChild(DR.box);}
  e.preventDefault();
  DR.x1=x;DR.y1=y;
  const l=Math.min(DR.x0,x),t=Math.min(DR.y0,y);
  Object.assign(DR.box.style,{left:l*100+'%',top:t*100+'%',width:Math.abs(x-DR.x0)*100+'%',height:Math.abs(y-DR.y0)*100+'%'});
}
function vUp(e){
  if(!DR||e.pointerId!==DR.id)return;
  const d=DR;DR=null;
  if(!d.moved||!V||!V.placing)return;
  if(d.box)d.box.remove();
  V.justDrew=Date.now();
  const r=[Math.min(d.x0,d.x1),Math.min(d.y0,d.y1),Math.max(d.x0,d.x1),Math.max(d.y0,d.y1)];
  if((r[2]-r[0])*d.b.width<10||(r[3]-r[1])*d.b.height<10)return;
  const p=+d.pg.dataset.p;
  /* texte du cadre = passages du cours qu'il recouvre (sinon : zone d'image) */
  const inter=s=>s.p===p&&!s.user&&s.r.some(R=>R[0]<r[2]&&R[2]>r[0]&&R[1]<r[3]&&R[3]>r[1]);
  const txt=V.P.segs.filter(inter).map(s=>s.t).join(' ').trim();
  const sid='U'+Date.now().toString(36);
  const seg={id:sid,p,r:[r],t:txt?txt.slice(0,600):`Zone dessinée (image / schéma), page ${p}`,user:true};
  V.P.segs.push(seg);V.segById.set(sid,seg);
  const qid=V.placing,l=V.P.links[qid]||{segs:[],conf:1,src:'main',ok:true};
  l.segs.push(sid);l.src='main';l.ok=true;l.conf=1;V.P.links[qid]=l;
  V.placing=null;V.sel={type:'seg',id:sid};saveSoon();renderAll();notify('Zone surlignée et reliée à la question','ok');
}
function rmSeg(sid){
  const P=V.P,s=V.segById.get(sid);
  P.qs.forEach(q=>{const l=P.links[q.id];if(l&&l.segs&&l.segs.includes(sid)){l.segs=l.segs.filter(x=>x!==sid);l.ok=true;if(!l.segs.length){l.src='main';l.conf=0;}}});
  if(s&&s.user){P.segs=P.segs.filter(x=>x.id!==sid);V.segById.delete(sid);}
  V.sel=null;saveSoon();renderAll();notify('Surlignage retiré','ok');
}
function vClick(e){
  if(!V)return;
  if(V.justDrew&&Date.now()-V.justDrew<400){V.justDrew=0;return;}
  const menu=$('ca-menu');
  if(!menu.hidden&&!e.target.closest('#ca-menu')&&!e.target.closest('[data-a="menu"]'))menu.hidden=true;
  const mk=e.target.closest('.ca-mk');
  if(mk&&V.placing){
    const qid=V.placing,sid=mk.dataset.s,l=V.P.links[qid]||{segs:[],conf:1,src:'main',ok:true};
    if(!l.segs.includes(sid))l.segs.push(sid);l.src='main';l.ok=true;l.conf=1;V.P.links[qid]=l;
    V.placing=null;V.sel={type:'seg',id:sid};saveSoon();renderAll();notify('Passage relié à la question','ok');return;
  }
  if(mk){V.sel={type:'seg',id:mk.dataset.s};renderAll();openSheet(true);if(V.lay==='split2'){const q1=qsOfSeg(V.P,mk.dataset.s)[0];if(q1)goToQ(q1.id);}return;}
  const qz=e.target.closest('.ca-qz');
  if(qz){const l=linkOf(V.P,qz.dataset.q);V.sel={type:'q',id:qz.dataset.q};if(l){goToSeg(l.segs[0],true).then(()=>{if(V)renderAll();});}else renderAll();openSheet(true);return;}
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a,P=V.P,qid=b.dataset.q;
  if(a==='close')closeViewer();
  else if(a==='doc'){if(isSplit()){V.doc=b.dataset.d;document.querySelectorAll('#ca-viewer .ca-seg-doc button').forEach(x=>x.classList.toggle('on',x.dataset.d===V.doc));}else showDoc(b.dataset.d).then(drawOverlays);}
  else if(a==='lay')setLay(b.dataset.l);
  else if(a==='zoom'){V.zoom=Math.max(.6,Math.min(2.2,V.zoom*(b.dataset.z==='1'?1.2:1/1.2)));visDocs().forEach(d=>layoutPages(d,true));}
  else if(a==='sheet')openSheet(!$('ca-viewer').classList.contains('sheet'));
  else if(a==='back'){V.sel=null;renderAll();}
  else if(a==='filter'){V.filter=b.dataset.f;renderPanel();}
  else if(a==='openq'){const l=linkOf(P,qid);V.sel={type:'q',id:qid};renderAll();if(l){if(window.innerWidth<=820)openSheet(false);goToSeg(l.segs[0],true);}}
  else if(a==='goq'){const l=linkOf(P,qid);if(l){V.sel={type:'q',id:qid};if(window.innerWidth<=820)openSheet(false);goToSeg(l.segs[0],true).then(()=>{if(V)renderAll();});}}
  else if(a==='toAnnale')goToQ(qid);
  else if(a==='ok'){if(P.links[qid])P.links[qid].ok=true;saveSoon();renderAll();}
  else if(a==='unlink'){const sid=b.dataset.s,l=P.links[qid];if(l){l.segs=l.segs.filter(s=>s!==sid);l.ok=true;}const s=V.segById.get(sid);if(s&&s.user&&!qsOfSeg(P,sid).length){P.segs=P.segs.filter(x=>x.id!==sid);V.segById.delete(sid);}if(V.sel&&V.sel.type==='seg'&&V.sel.id===sid&&!qsOfSeg(P,sid).length)V.sel=null;saveSoon();renderAll();notify('Passage retiré de cette question','ok');}
  else if(a==='rmSeg')rmSeg(b.dataset.s);
  else if(a==='unlinkAll'){if(P.links[qid])P.links[qid]={segs:[],conf:0,src:'main',ok:true};saveSoon();renderAll();}
  else if(a==='place'){V.placing=qid;if(V.doc!=='course')showDoc('course').then(renderAll);else renderAll();openSheet(false);}
  else if(a==='cancelPlace'){V.placing=null;renderAll();}
  else if(a==='pend'){finishPending(b.dataset.m);}
  else if(a==='menu'){
    menu.hidden=!menu.hidden;
    menu.innerHTML=`<button data-a="orig"><span class="ms">${P.showOrig?'check_box':'check_box_outline_blank'}</span>Afficher les surlignages d’origine du PDF</button>
      <button data-a="rerun"><span class="ms">refresh</span>Relancer la recherche automatique</button>
      <button data-a="rename"><span class="ms">edit</span>Renommer</button>
      <button data-a="del" class="ca-danger"><span class="ms">delete</span>Supprimer ce cours relié</button>`;
  }
  else if(a==='orig'){P.showOrig=!P.showOrig;menu.hidden=true;saveSoon();document.querySelectorAll('#ca-pages-course .ca-page').forEach(el=>{el.dataset.r='';if(el._vis)renderPage(el);});}
  else if(a==='rerun'){menu.hidden=true;const p=P;closeViewer(true);wzOpen(p);}
  else if(a==='rename'){menu.hidden=true;const n=prompt('Nouveau nom :',P.name);if(n&&n.trim()){P.name=n.trim();saveSoon();const t=document.querySelector('#ca-viewer .ca-ttl b');if(t)t.textContent=P.name;}}
  else if(a==='del'){menu.hidden=true;delProject(P.id,P.name,true);}
}
function delProject(id,name,fromViewer){
  const go=async()=>{await dbDel(id).catch(()=>{});if(fromViewer)closeViewer(true);renderHub();notify('Cours relié supprimé','ok');};
  if(typeof showConfirm==='function')showConfirm(`Supprimer « ${name} » ?`,'Le cours, l’annale et tous les liens seront effacés de ce navigateur.','Supprimer',go);
  else if(confirm('Supprimer « '+name+' » ?'))go();
}

/* ───────────────────────── 10. Écran Annales : la liste ───────────────────────── */
async function renderHub(){
  const box=$('ca-hub');if(!box)return;
  let all=[];try{all=await dbAll();}catch(e){box.innerHTML='';return;}
  all.sort((a,b)=>(b.updated||b.created)-(a.updated||a.created));
  if(!all.length){box.innerHTML='';return;}
  box.innerHTML=`<div class="ca-hubttl"><span class="ms">link</span>Cours reliés aux annales</div>`+all.map(P=>{const st=stats(P);
    return `<div class="ci ca-hubitem" data-ca-open="${P.id}">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0"><div class="ca-hubico"><span class="ms">menu_book</span></div>
        <div style="min-width:0"><div class="cname" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(P.name)}</div>
        <div class="cmeta">${st.inC} question${st.inC>1?'s':''} dans ce cours${st.uns?` · ${st.uns} à vérifier`:''}${st.pend?` · ${st.pend} en attente`:''}</div></div></div>
      <div class="cacts"><button class="ib" title="Supprimer" data-ca-del="${P.id}"><span class="ms" style="font-size:16px;color:var(--error)">delete</span></button></div>
      <span class="ms" style="color:var(--on-sv);font-size:18px;margin-left:8px">chevron_right</span></div>`;}).join('');
  box.querySelectorAll('[data-ca-open]').forEach(el=>el.addEventListener('click',e=>{
    const d=e.target.closest('[data-ca-del]');
    if(d){e.stopPropagation();const P=all.find(x=>x.id===d.dataset.caDel);delProject(d.dataset.caDel,P?P.name:'',false);return;}
    openViewer(el.dataset.caOpen);
  }));
}
window.coursAnnalesOpen=m=>{if(typeof m==='string'&&m){WZ.method=m;try{localStorage.setItem('kcu_ca_method',m);}catch(e){}}wzOpen(null);};
window.coursAnnalesRenderHub=renderHub;
window.coursAnnalesView=openViewer;

window._caEngine={relayOpen,relayPrompt,rerankMatch,freeMatch,lexTop,hasWebGPU,loadReranker,rrScore,readCourse,parseAnnale,addContext,passageText,buildIndex,bm25,toks,queryParts,queryUnits,unitWeights,matchUnit,matchQuestion,isHeading,loadEmbedder,embed,dot,localMatch,gemMatch,gemModels,gemPrompt,counts,stats};
})();
