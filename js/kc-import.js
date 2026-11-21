/* =========================================================
   kc-import.js — Importer depuis les autres applis de révision (v84, 21 nov. 2026)
   Demande : « quand on vient sur mon site, on ne perd aucune de ses données ». Fenêtre kcImportOpen() :
   1) choisir l'appli d'origine (Anki, Quizlet, Knowt, Brainscape, RemNote, Notion, Obsidian, Mochi, SuperMemo,
      Excel / Google Sheets, Kahoot, Quizizz / Wayground, Moodle, Wooclap, autre) → mode d'emploi pour exporter ;
   2) déposer le fichier ou coller le texte → aperçu (flashcards ou QCM détectés tout seuls) ;
   3) destination : nouveau paquet de flashcards (un par paquet Anki) ou matière + cours pour les QCM → Importer.
   Formats lus : .apkg / .colpkg Anki (ancien et nouveau format compressé zstd, images de l'ancien format),
   texte Anki, TSV / CSV (guillemets, ; ou ,), .xlsx / .xls / .ods (SheetJS), GIFT et XML Moodle, Markdown
   (« recto :: verso », « >> », « Q: / A: », blocs séparés par ---).
   Bibliothèques chargées seulement au besoin : JSZip, sql.js (cdnjs), fzstd (jsDelivr), SheetJS (cdnjs).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function G(n,d){try{const v=eval(n);return v===undefined?d:v;}catch(e){return d;}}
const nid=()=>(typeof uid==='function'?uid():Date.now().toString(36)+Math.random().toString(36).slice(2,8));
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};

/* ───────── Applis d'origine ───────── */
const SRC=[
  {id:'anki',n:'Anki',ic:'school',c:'#2563eb',acc:'.apkg,.colpkg,.txt',how:['Ouvre Anki sur ton ordinateur.','Fichier → <b>Exporter…</b>','Format : <b>Paquet Anki (.apkg)</b>, choisis le paquet (ou « Tous les paquets »).','Coche « Inclure les médias » si tu as des images.','Dépose le fichier .apkg ici.'],t:'Paquets, cartes à trous et images'},
  {id:'quizlet',n:'Quizlet',ic:'style',c:'#4255ff',acc:'.txt,.csv,.tsv',how:['Ouvre ton set Quizlet sur le site.','Clique sur <b>⋯</b> (plus) → <b>Exporter</b>.','Laisse « Tabulation » entre terme et définition et « Nouvelle ligne » entre les cartes.','Clique sur <b>Copier le texte</b>, puis colle-le ici.'],t:'Copier-coller du set'},
  {id:'knowt',n:'Knowt',ic:'bolt',c:'#14b8a6',acc:'.txt,.csv',how:['Ouvre ton set de flashcards Knowt.','Menu <b>⋯</b> → <b>Exporter</b> (ou sélectionne toutes les cartes et copie-les).','Colle le texte ici (un terme et sa définition par ligne, séparés par une tabulation).'],t:'Flashcards Knowt'},
  {id:'brainscape',n:'Brainscape',ic:'psychology',c:'#7c3aed',acc:'.csv,.txt',how:['Sur brainscape.com, ouvre ton paquet.','<b>Options du paquet</b> → <b>Exporter en CSV</b>.','Dépose le fichier .csv ici.'],t:'Export CSV'},
  {id:'remnote',n:'RemNote',ic:'hub',c:'#0ea5e9',acc:'.md,.txt,.apkg',how:['Dans RemNote, sélectionne ton document.','<b>⋯</b> → <b>Exporter</b> → <b>Markdown</b> (ou <b>Anki</b> pour garder plus d’infos).','Dépose le fichier ici (les « recto :: verso » et « >> » sont reconnus).'],t:'Markdown ou Anki'},
  {id:'notion',n:'Notion',ic:'description',c:'#111827',acc:'.csv,.md,.txt,.zip',how:['Base de données de flashcards : <b>⋯</b> → <b>Exporter</b> → <b>Markdown & CSV</b>.','Dépose le fichier .csv (ou le .zip) ici : la 1re colonne devient le recto, la 2e le verso.','Une page avec des « question :: réponse » marche aussi en copier-coller.'],t:'Tableaux CSV ou texte'},
  {id:'obsidian',n:'Obsidian',ic:'diamond',c:'#7c3aed',acc:'.md,.txt',how:['Avec l’extension Spaced Repetition : tes notes « question :: réponse », « ::: » ou « ? ».','Dépose tes fichiers .md ici (plusieurs à la fois si tu veux).'],t:'Notes Spaced Repetition'},
  {id:'mochi',n:'Mochi',ic:'cookie',c:'#f97316',acc:'.md,.txt,.csv',how:['Dans Mochi : paquet → <b>Exporter</b> → <b>Markdown</b> (ou CSV).','Dépose le fichier ici : le recto et le verso séparés par <code>---</code> sont reconnus.'],t:'Markdown / CSV'},
  {id:'supermemo',n:'SuperMemo · Mnemosyne',ic:'memory',c:'#16a34a',acc:'.txt,.tsv',how:['SuperMemo : <b>Fichier → Exporter → Q&A text</b> (lignes « Q: » et « A: »).','Mnemosyne : <b>Fichier → Exporter → Fichier texte avec tabulations</b>.','Dépose le fichier ici.'],t:'Texte Q&A / tabulations'},
  {id:'sheet',n:'Excel · Google Sheets',ic:'table_chart',c:'#16a34a',acc:'.xlsx,.xls,.ods,.csv,.tsv',how:['Colonne A = recto (ou question), colonne B = verso (ou réponse).','Pour des QCM : colonnes « Question », « Réponse 1 » à « Réponse 4 », « Bonne réponse » (1 à 4 ou A à D), « Explication ».','Dépose le fichier, ou copie les cellules et colle-les ici.'],t:'Tableaux .xlsx, .ods, .csv'},
  {id:'kahoot',n:'Kahoot!',ic:'sports_esports',c:'#46178f',acc:'.xlsx,.xls,.csv',how:['Sur kahoot.com, ouvre ton kahoot → <b>⋯</b> → <b>Télécharger</b> / exporter en tableur (ou utilise leur modèle Excel).','Dépose le fichier .xlsx ici : chaque question devient un QCM avec sa bonne réponse.'],t:'Quiz → QCM'},
  {id:'quizizz',n:'Quizizz · Wayground',ic:'quiz',c:'#8854c0',acc:'.xlsx,.xls,.csv',how:['Ouvre ton quiz → <b>⋯</b> → <b>Exporter</b> / Télécharger en tableur.','Dépose le fichier ici : options, bonne réponse et explication sont gardées.'],t:'Quiz → QCM'},
  {id:'moodle',n:'Moodle',ic:'account_balance',c:'#f98012',acc:'.txt,.gift,.xml',how:['Banque de questions → <b>Exporter</b> → format <b>GIFT</b> ou <b>XML Moodle</b>.','Dépose le fichier ici : les QCM, vrai / faux et réponses courtes sont reconnus.'],t:'GIFT ou XML → QCM'},
  {id:'wooclap',n:'Wooclap',ic:'how_to_vote',c:'#3b82f6',acc:'.xlsx,.xls,.csv',how:['Dans ton événement Wooclap : <b>Exporter les questions</b> en Excel.','Dépose le fichier ici : les questions à choix multiples deviennent des QCM.'],t:'Questions → QCM'},
  {id:'other',n:'Autre site (copier-coller)',ic:'content_paste',c:'#64748b',acc:'.txt,.csv,.tsv,.md,.xlsx,.ods,.xml,.gift,.apkg',how:['Cram, StudyStack, Gizmo, StudySmarter, Memrise, un document… : copie la liste de tes cartes.','Une carte par ligne : terme puis définition, séparés par une tabulation, « - », « : », « ; » ou « :: ».','Colle ici : le site devine tout seul le format (tu peux le corriger dessous).'],t:'Le site devine le format'}
];

/* ───────── Outils texte ───────── */
function htmlToText(h){
  if(h==null)return '';h=String(h);
  if(!/[<&]/.test(h))return h.trim();
  h=h.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(div|p|li|h\d)>/gi,'\n').replace(/<li[^>]*>/gi,'• ');
  const d=document.createElement('div');d.innerHTML=h.replace(/<img[^>]*>/gi,'');return (d.textContent||'').replace(/ /g,' ').replace(/\n{3,}/g,'\n\n').trim();
}
function cloze(t){return t.replace(/\{\{c\d+::(.*?)(::[^}]*)?\}\}/g,(m,a)=>'{{'+a+'}}');}
/* CSV / TSV avec guillemets et retours à la ligne dans les cellules */
function parseDelim(text,d){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=ch;continue;}
    if(ch==='"'&&cell==='')q=true;
    else if(ch===d){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
    else if(ch!=='\r')cell+=ch;}
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  return rows.filter(r=>r.some(c=>String(c).trim()));
}
function guessDelim(text){
  const L=text.split('\n').slice(0,40).filter(l=>l.trim());if(!L.length)return '\t';
  const sc=d=>{const n=L.map(l=>l.split(d).length-1);const ok=n.filter(x=>x>=1).length;return ok/L.length+(n.every(x=>x===n[0])&&n[0]>0?.3:0);};
  const c=[['\t',sc('\t')+.2],[';',sc(';')],[',',sc(',')-.15]].sort((a,b)=>b[1]-a[1]);return c[0][1]>=.6?c[0][0]:null;
}
const HEAD=/^(term|terme|front|recto|question|questions|word|mot|definition|définition|back|verso|answer|réponse|reponse|notes?|text|texte)$/i;

/* Texte collé ou fichier texte → {cards:[{f,b}], qcm:[...]} */
function parseText(raw,opt){
  opt=opt||{};let text=String(raw||'').replace(/\r\n?/g,'\n').replace(/^﻿/,'');
  if(/^\s*<\?xml|<quiz[\s>]/i.test(text))return parseMoodleXML(text);
  if(isGIFT(text))return parseGIFT(text);
  // texte Anki : lignes d'en-tête #separator:tab, #html:true…
  let ankiTxt=false;if(/^#(separator|html|columns|deck|notetype)/m.test(text)){ankiTxt=true;text=text.split('\n').filter(l=>!/^#\w+:/.test(l)).join('\n');}
  const cs=opt.cs||'auto',ts=opt.ts||'auto';
  // cartes séparées par un caractère choisi (Quizlet « entre les cartes : ; »)
  let blocks=null;
  if(cs===';;')blocks=text.split(';;');else if(cs==='blank')blocks=text.split(/\n\s*\n/);else if(cs===';'&&ts!==';')blocks=text.split(';');
  // Q: / A:
  if(!blocks&&ts==='auto'&&/^\s*Q\s*[:.]/mi.test(text)&&/^\s*A\s*[:.]/mi.test(text)){
    const out=[];let cur=null;text.split('\n').forEach(l=>{const q=l.match(/^\s*Q\s*[:.]\s*(.*)$/i),a=l.match(/^\s*A\s*[:.]\s*(.*)$/i);
      if(q){if(cur&&cur.f)out.push(cur);cur={f:q[1],b:''};}else if(a&&cur){cur.b+=(cur.b?'\n':'')+a[1];cur.ina=true;}else if(cur&&l.trim()){if(cur.ina)cur.b+='\n'+l.trim();else cur.f+='\n'+l.trim();}});
    if(cur&&cur.f)out.push(cur);if(out.length)return{cards:out.map(c=>({f:c.f.trim(),b:c.b.trim()})),fmt:'Q: / A:'};}
  // Markdown avec --- entre recto et verso (Mochi), cartes séparées par des lignes vides ou des titres
  if(!blocks&&ts==='auto'&&/^\s*---\s*$/m.test(text)&&!/\t/.test(text)){
    const parts=text.split(/\n(?=#{1,3}\s)|\n\s*\n(?=\S)/).map(p=>p.trim()).filter(p=>/\n\s*---\s*\n/.test('\n'+p+'\n'));
    if(parts.length){return{cards:parts.map(p=>{const [f,...b]=p.split(/\n\s*---\s*\n/);return{f:f.replace(/^#{1,3}\s*/,'').trim(),b:b.join('\n').trim()};}),fmt:'Markdown (---)'};}}
  if(!blocks){
    const d=ts==='auto'?guessDelim(text):ts==='tab'?'\t':ts===','||ts===';'?ts:null;
    if(d){const rows=parseDelim(text,d);const tb=fromRows(rows);if(tb&&(tb.cards.length||tb.qcm.length))return Object.assign(tb,{fmt:ankiTxt?'Texte Anki':d==='\t'?'Tabulations':d===';'?'Points-virgules':'CSV'});}
    blocks=text.split('\n');
  }
  // une carte par bloc : on coupe au premier séparateur trouvé
  const seps=ts==='auto'?['\t',' ::: ',':::',' :: ','::',' >> ','>>',' — ',' – ',' - ',' = ',' : ',': ',';']:
    ({tab:['\t'],'::':[':::','::'],'-':[' - ',' — ',' – ','-'],':':[' : ',': ',':'],';':[';'],',':[','],'=':['=']})[ts]||['\t'];
  const cards=[];let dropped=0;
  blocks.forEach(b=>{b=b.replace(/^\s*[-*•]\s+/,'').trim();if(!b)return;
    let s=null;for(const x of seps){if(b.includes(x)){s=x;break;}}
    if(!s){if(/\?\s*\n/.test(b)){const [f,...r]=b.split(/\?\s*\n/);cards.push({f:f+'?',b:r.join('\n').trim()});}else dropped++;return;}
    const i=b.indexOf(s);cards.push({f:b.slice(0,i).trim(),b:b.slice(i+s.length).trim()});});
  return{cards:cards.filter(c=>c.f||c.b),dropped,fmt:'Texte'};
}
/* Tableau (CSV, Excel) → flashcards ou QCM selon les colonnes */
function fromRows(rows){
  rows=(rows||[]).map(r=>r.map(c=>c==null?'':String(c).trim())).filter(r=>r.some(Boolean));if(!rows.length)return null;
  // ligne d'en-tête : la première qui contient « question » ou des colonnes connues (Kahoot a des lignes au-dessus)
  let hi=-1;for(let i=0;i<Math.min(rows.length,15);i++){const r=rows[i].map(c=>c.toLowerCase());if(r.some(c=>/question/.test(c))&&r.some(c=>/(answer|option|choice|réponse|reponse|choix)\s*\d|^[a-d]$/.test(c))){hi=i;break;}}
  if(hi>=0){
    const H=rows[hi].map(c=>c.toLowerCase());
    const qi=H.findIndex(c=>/question/.test(c)&&!/type|time|temps/.test(c));
    const oi=H.map((c,i)=>/(answer|option|choice|réponse|reponse|choix)\s*\d|^[a-f]$/.test(c)&&!/correct|bonne/.test(c)?i:-1).filter(i=>i>=0);
    const ci=H.findIndex(c=>/correct|bonne|right|juste/.test(c));
    const ei=H.findIndex(c=>/expl|feedback|justif|commentaire/.test(c));
    const out=[];
    rows.slice(hi+1).forEach(r=>{const q=r[qi];if(!q)return;const ans=oi.map(i=>r[i]).filter(x=>x!=null&&x!=='');if(ans.length<2)return;
      let cor=0;const cv=ci>=0?String(r[ci]||'').trim():'';
      if(cv){const m=cv.match(/\d+/);const L=cv.match(/^[A-Fa-f](?![a-z])/);
        if(m&&+m[0]>=1&&+m[0]<=ans.length)cor=+m[0]-1;else if(L)cor=L[0].toUpperCase().charCodeAt(0)-65;else{const k=ans.findIndex(a=>a.toLowerCase()===cv.toLowerCase());if(k>=0)cor=k;}}
      out.push({question:htmlToText(q),answers:ans.map(htmlToText),correct:Math.max(0,Math.min(ans.length-1,cor)),expl:ei>=0?htmlToText(r[ei]||''):''});});
    if(out.length)return{cards:[],qcm:out};
  }
  // flashcards : colonnes recto / verso (en-tête facultatif)
  let start=0,fi=0,bi=1;const h0=rows[0].map(c=>c.toLowerCase());
  if(h0.length>=2&&h0.slice(0,4).some(c=>HEAD.test(c))){start=1;const f=h0.findIndex(c=>/^(term|terme|front|recto|question|word|mot)/.test(c)),b=h0.findIndex(c=>/^(definition|définition|back|verso|answer|réponse|reponse)/.test(c));if(f>=0)fi=f;if(b>=0&&b!==fi)bi=b;else bi=fi===0?1:0;}
  const cards=rows.slice(start).map(r=>({f:htmlToText(r[fi]||''),b:htmlToText(r[bi]||'')})).filter(c=>c.f||c.b);
  return{cards,qcm:[]};
}
/* ───────── GIFT (Moodle) ───────── */
function isGIFT(t){return /\{[^{}]*[=~][^{}]*\}/.test(t)&&(/::[^:\n]+::/.test(t)||/\{\s*(=|~|T|F|TRUE|FALSE)/.test(t))&&!/\t/.test(t.slice(0,2000));}
function parseGIFT(text){
  const un=s=>s.replace(/\\([:~=#{}])/g,'$1').replace(/\[(html|markdown|plain|moodle)\]/gi,'').trim();
  const items=text.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n').split(/\n\s*\n/);
  const qcm=[],cards=[];
  items.forEach(it=>{it=it.trim();if(!it)return;const m=it.match(/^(?:::(.*?)::)?([\s\S]*?)\{([\s\S]*)\}([\s\S]*)$/);if(!m)return;
    const q=htmlToText(un((m[2]+' '+(m[4]||'')).trim()))||htmlToText(un(m[1]||''));const body=m[3].trim();
    if(/^(T|TRUE|F|FALSE)\b/i.test(body)){const t=/^T/i.test(body);qcm.push({question:q,answers:['Vrai','Faux'],correct:t?0:1,expl:(body.match(/#([^#]*)$/)||[0,''])[1].trim()});return;}
    const parts=body.match(/[=~](?:\\.|[^=~])*/g)||[];
    const ans=parts.map(p=>{const right=p[0]==='=';let s=p.slice(1);let fb='';const h=s.search(/(?<!\\)#/);if(h>=0){fb=s.slice(h+1);s=s.slice(0,h);}s=s.replace(/^%-?\d+(\.\d+)?%/,'');return{t:htmlToText(un(s)),right,fb:un(fb)};}).filter(a=>a.t);
    if(ans.length&&ans.every(a=>a.right)){cards.push({f:q,b:ans.map(a=>a.t).join(' / ')});return;}
    if(ans.length>=2){const k=Math.max(0,ans.findIndex(a=>a.right));qcm.push({question:q,answers:ans.map(a=>a.t),correct:k,expl:(ans[k]&&ans[k].fb)||''});}});
  return{cards,qcm,fmt:'GIFT (Moodle)'};
}
/* ───────── XML Moodle ───────── */
function parseMoodleXML(text){
  const doc=new DOMParser().parseFromString(text,'text/xml'),qcm=[],cards=[];
  const tx=el=>el?htmlToText((el.querySelector('text')||el).textContent):'';
  doc.querySelectorAll('question').forEach(q=>{const ty=q.getAttribute('type');if(ty==='category')return;
    const qt=tx(q.querySelector('questiontext')),gf=tx(q.querySelector('generalfeedback'));
    const A=[...q.querySelectorAll(':scope > answer')].map(a=>({t:tx(a),fr:parseFloat(a.getAttribute('fraction')||'0'),fb:tx(a.querySelector('feedback'))}));
    if((ty==='multichoice'||ty==='truefalse')&&A.length>=2){let k=0,b=-1e9;A.forEach((a,i)=>{if(a.fr>b){b=a.fr;k=i;}});
      qcm.push({question:qt,answers:A.map(a=>ty==='truefalse'?(/^true$/i.test(a.t)?'Vrai':/^false$/i.test(a.t)?'Faux':a.t):a.t),correct:k,expl:gf||A[k].fb||''});}
    else if(A.length&&qt)cards.push({f:qt,b:A.filter(a=>a.fr>0).map(a=>a.t).join(' / ')||A[0].t});});
  return{cards,qcm,fmt:'XML Moodle'};
}
/* ───────── Bibliothèques à la demande ───────── */
const LIBS={};
function lib(url,glob){
  if(window[glob])return Promise.resolve(window[glob]);
  if(LIBS[url])return LIBS[url];
  return LIBS[url]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=url;s.onload=()=>window[glob]?res(window[glob]):rej(new Error('Bibliothèque vide : '+glob));s.onerror=()=>{delete LIBS[url];rej(new Error('Impossible de charger '+glob+' (connexion internet ?)'));};document.head.appendChild(s);});
}
const ZIP_URL='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const SQL_BASE='https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
const ZSTD_URL='https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js';
const XLSX_URL='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let _sql=null;
function sqlJs(){if(_sql)return _sql;return _sql=lib(SQL_BASE+'sql-wasm.js','initSqlJs').then(f=>f({locateFile:n=>SQL_BASE+n})).catch(e=>{_sql=null;throw e;});}

/* ───────── Anki .apkg / .colpkg ───────── */
async function parseApkg(file,progress){
  progress('Ouverture du paquet Anki…');
  const JSZip=await lib(ZIP_URL,'JSZip');const zip=await JSZip.loadAsync(file);
  let dbBytes=null,newFmt=false;
  if(zip.file('collection.anki21b')){progress('Décompression (nouveau format Anki)…');const fz=await lib(ZSTD_URL,'fzstd');dbBytes=fz.decompress(new Uint8Array(await zip.file('collection.anki21b').async('uint8array')));newFmt=true;}
  else if(zip.file('collection.anki21'))dbBytes=await zip.file('collection.anki21').async('uint8array');
  else if(zip.file('collection.anki2'))dbBytes=await zip.file('collection.anki2').async('uint8array');
  if(!dbBytes)throw new Error('Ce fichier ne ressemble pas à un paquet Anki (.apkg).');
  progress('Lecture des cartes…');
  const SQL=await sqlJs();const db=new SQL.Database(dbBytes);
  const all=(q)=>{try{const r=db.exec(q);return r[0]?r[0].values:[];}catch(e){return [];}};
  // paquets
  const decks={};
  all('SELECT id,name FROM decks').forEach(([id,n])=>{decks[id]=String(n).replace(/\x1f/g,' › ');});
  if(!Object.keys(decks).length){const c=all('SELECT decks,models FROM col')[0];if(c){try{const D=JSON.parse(c[0]);Object.values(D).forEach(d=>{decks[d.id]=String(d.name).replace(/::/g,' › ');});}catch(e){}}}
  // modèles (pour repérer les cartes à trous)
  const clozeM=new Set();{const c=all('SELECT models FROM col')[0];if(c&&c[0]){try{Object.values(JSON.parse(c[0])).forEach(m=>{if(m.type===1)clozeM.add(String(m.id));});}catch(e){}}}
  const nd={};all('SELECT nid,did FROM cards ORDER BY ord').forEach(([n,d])=>{if(nd[n]==null)nd[n]=d;});
  // médias (ancien format : fichier « media » en JSON)
  let media=null;if(!newFmt&&zip.file('media')){try{media=JSON.parse(await zip.file('media').async('text'));}catch(e){media=null;}}
  const byName={};if(media)Object.entries(media).forEach(([k,v])=>{byName[v]=k;});
  let imgN=0;
  const img=async html=>{const m=String(html||'').match(/<img[^>]+src=["']?([^"'>\s]+)/i);if(!m||!media||imgN>=250)return null;const key=byName[decodeURIComponent(m[1])]||byName[m[1]];if(key==null||!zip.file(key))return null;
    try{const b=await zip.file(key).async('blob');imgN++;return await shrink(b);}catch(e){return null;}};
  const notes=all('SELECT id,mid,flds,tags FROM notes');
  const groups={};let n=0;
  for(const [id,mid,flds] of notes){
    const F=String(flds).split('\x1f');let f=F[0]||'',b=F[1]||'';
    const isCl=clozeM.has(String(mid))||/\{\{c\d+::/.test(f);
    const card={f:'',b:''};
    if(isCl){card.f=htmlToText(cloze(f));card.b=htmlToText(F.slice(1).join('\n'));}
    else{card.f=htmlToText(f);card.b=htmlToText(b);}
    const iq=await img(f),ia=await img(isCl?'':b);if(iq)card.iq=iq;if(ia)card.ia=ia;
    if(!card.f&&!card.b&&!card.iq&&!card.ia)continue;
    const dn=decks[nd[id]]||'Paquet Anki';(groups[dn]||(groups[dn]=[])).push(card);
    if(++n%400===0)progress('Lecture des cartes… '+n);
  }
  db.close();
  const names=Object.keys(groups);
  if(newFmt&&notes.length<=1&&names.length<=1&&groups[names[0]]&&/update|mettre à jour|mise à jour/i.test(groups[names[0]][0].f))throw new Error('Ce paquet a été exporté pour une version récente d’Anki que le site ne lit pas. Réexporte-le en cochant « Compatible avec les anciennes versions d’Anki ».');
  return{decks:names.map(k=>({name:k,cards:groups[k]})),fmt:'Paquet Anki'+(newFmt?' (nouveau format)':''),noImg:newFmt};
}
function shrink(blob){return new Promise(res=>{const u=URL.createObjectURL(blob),im=new Image();im.onload=()=>{const k=Math.min(1,800/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);try{res(c.toDataURL('image/jpeg',.82));}catch(e){res(null);}};im.onerror=()=>{URL.revokeObjectURL(u);res(null);};im.src=u;});}
async function parseSheet(file,progress){
  progress('Lecture du tableau…');const X=await lib(XLSX_URL,'XLSX');const wb=X.read(await file.arrayBuffer(),{type:'array'});
  let best=null;wb.SheetNames.forEach(n=>{const rows=X.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,defval:''});const r=fromRows(rows);if(r&&(!best||(r.cards.length+r.qcm.length*2)>(best.cards.length+best.qcm.length*2)))best=Object.assign(r,{sheet:n});});
  return Object.assign(best||{cards:[],qcm:[]},{fmt:'Tableur'+(best&&best.sheet?' · feuille « '+best.sheet+' »':'')});
}
async function parseZip(file,progress){
  const JSZip=await lib(ZIP_URL,'JSZip');const zip=await JSZip.loadAsync(file);
  if(zip.file('collection.anki21b')||zip.file('collection.anki21')||zip.file('collection.anki2'))return parseApkg(file,progress);
  const out={cards:[],qcm:[],decks:[]};
  for(const name of Object.keys(zip.files)){if(zip.files[name].dir||!/\.(csv|md|txt|tsv)$/i.test(name))continue;const t=await zip.files[name].async('text');const r=parseText(t);if(r.cards&&r.cards.length)out.decks.push({name:name.split('/').pop().replace(/\.\w+$/,'').replace(/\s+[0-9a-f]{32}$/,''),cards:r.cards});if(r.qcm)out.qcm.push(...r.qcm);}
  out.fmt='Archive .zip';return out;
}
async function parseFile(file,progress){
  const n=file.name.toLowerCase();
  if(/\.(apkg|colpkg)$/.test(n))return parseApkg(file,progress);
  if(/\.(xlsx|xls|ods|numbers)$/.test(n))return parseSheet(file,progress);
  if(/\.zip$/.test(n))return parseZip(file,progress);
  const t=await file.text();return parseText(t,ST.opt);
}

/* ───────── Fenêtre ───────── */
const ST={src:null,res:null,files:[],text:'',opt:{ts:'auto',cs:'auto'},busy:false,msg:''};
function norm(r,fallback){   // → {decks:[{name,cards}], qcm:[]}
  if(!r)return{decks:[],qcm:[]};
  const decks=r.decks?r.decks.slice():[];if(r.cards&&r.cards.length)decks.push({name:fallback,cards:r.cards});
  return{decks:decks.filter(d=>d.cards.length),qcm:r.qcm||[],fmt:r.fmt,dropped:r.dropped||0,noImg:r.noImg};
}
function srcGrid(){
  return `<p class="kim-lead">Choisis l’appli d’où viennent tes cartes ou tes QCM : le site t’explique comment les récupérer, sans rien perdre.</p>
    <div class="kim-grid">${SRC.map(s=>`<button type="button" class="kim-src" data-src="${s.id}" style="--c:${s.c}"><span class="kim-si"><span class="ms">${s.ic}</span></span><b>${esc(s.n)}</b><small>${esc(s.t)}</small></button>`).join('')}</div>`;
}
function stepHTML(){
  const s=SRC.find(x=>x.id===ST.src),R=ST.res,tot=R?R.decks.reduce((a,d)=>a+d.cards.length,0):0,nq=R?R.qcm.length:0;
  const fs=(G('folders',[])||[]).filter(f=>f.type!=='annales');
  return `<button type="button" class="kim-back" data-kim="back"><span class="ms">arrow_back</span>Changer d’appli</button>
    <div class="kim-step"><div class="kim-how" style="--c:${s.c}"><div class="kim-howh"><span class="kim-si"><span class="ms">${s.ic}</span></span><b>Depuis ${esc(s.n)}</b></div><ol>${s.how.map(h=>`<li>${h}</li>`).join('')}</ol></div>
    <label class="kim-drop" id="kim-drop"><input type="file" id="kim-file" accept="${s.acc}" multiple hidden><span class="ms">upload_file</span><b>Dépose ton fichier ici</b><small>ou clique pour le choisir · ${esc(s.acc.replace(/,/g,' '))}</small>${ST.files.length?`<em>${ST.files.map(f=>esc(f.name)).join(', ')}</em>`:''}</label>
    <div class="kim-or"><span>ou colle le texte</span></div>
    <textarea class="fi kim-ta" id="kim-ta" placeholder="mitochondrie&#9;centrale énergétique de la cellule&#10;ATP&#9;molécule qui stocke l’énergie">${esc(ST.text)}</textarea>
    <div class="kim-opts"><label>Entre terme et définition <select class="fi" data-kopt="ts">${[['auto','Deviner'],['tab','Tabulation'],[',','Virgule'],[';','Point-virgule'],['::','::'],['-','Tiret'],[':','Deux-points'],['=','=']].map(([v,l])=>`<option value="${v}"${ST.opt.ts===v?' selected':''}>${l}</option>`).join('')}</select></label>
      <label>Entre les cartes <select class="fi" data-kopt="cs">${[['auto','Retour à la ligne'],['blank','Ligne vide'],[';',';'],[';;',';;']].map(([v,l])=>`<option value="${v}"${ST.opt.cs===v?' selected':''}>${l}</option>`).join('')}</select></label></div>
    ${ST.busy?`<div class="kim-busy"><div class="house-spinner"></div>${esc(ST.msg||'Lecture…')}</div>`:''}
    ${!ST.busy&&ST.msg&&!R?`<div class="kim-err"><span class="ms">error</span>${esc(ST.msg)}</div>`:''}
    ${R&&!ST.busy?(tot||nq?`<div class="kim-res"><div class="kim-resh"><span class="ms">check_circle</span><b>${tot?tot+' flashcard'+(tot>1?'s':''):''}${tot&&nq?' et ':''}${nq?nq+' QCM':''} trouvé${nq?'':'e'}${tot+nq>1?'s':''}</b><small>${esc(R.fmt||'')}${R.dropped?' · '+R.dropped+' ligne'+(R.dropped>1?'s':'')+' ignorée'+(R.dropped>1?'s':''):''}${R.noImg?' · images non reprises (nouveau format Anki)':''}</small></div>
      ${R.decks.length?`<div class="kim-sub">Flashcards → ${R.decks.length>1?R.decks.length+' paquets':'un nouveau paquet'}</div>${R.decks.map((d,i)=>`<div class="kim-deck"><span class="ms">style</span><input class="fi" data-dname="${i}" value="${esc(d.name)}" maxlength="80" aria-label="Nom du paquet"><small>${d.cards.length} carte${d.cards.length>1?'s':''}</small></div>`).join('')}
        <div class="kim-prev">${R.decks[0].cards.slice(0,4).map(c=>`<div><b>${esc(c.f.slice(0,90))}${c.iq?' 🖼':''}</b><span>${esc(c.b.slice(0,120))}${c.ia?' 🖼':''}</span></div>`).join('')}</div>`:''}
      ${nq?`<div class="kim-sub">QCM → dans une matière</div><div class="kim-dest"><select class="fi" id="kim-fold"><option value="">+ Nouvelle matière</option>${fs.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select><input class="fi" id="kim-fname" placeholder="Nom de la matière" value="${esc(s.n.split(' ')[0])}" maxlength="60"><input class="fi" id="kim-cname" placeholder="Nom du cours" value="Import ${esc(s.n.split(' ')[0])}" maxlength="80"></div>
        <div class="kim-prev">${R.qcm.slice(0,3).map(q=>`<div><b>${esc(q.question.slice(0,110))}</b><span>${q.answers.map((a,i)=>(i===q.correct?'✓ ':'')+esc(a.slice(0,40))).join(' · ')}</span></div>`).join('')}</div>`:''}
    </div>`:`<div class="kim-err"><span class="ms">help</span>Aucune carte reconnue. Vérifie le séparateur entre le terme et la définition ci-dessus.</div>`):''}
    </div>`;
}
let DLG=null;
function draw(){if(!DLG)return;const b=DLG.el.querySelector('.kc-dlg-b');if(!b)return;const ta=$('kim-ta'),pos=ta?ta.selectionStart:null;b.innerHTML=ST.src?stepHTML():srcGrid();
  const f=DLG.el.querySelector('[data-kim="go"]');if(f){const R=ST.res,ok=!!(R&&(R.decks.length||R.qcm.length))&&!ST.busy;f.disabled=!ok;f.style.display=ST.src?'':'none';}
  const nta=$('kim-ta');if(nta&&pos!=null&&document.activeElement===document.body){/* rien */}}
let tT=0;
async function analyse(){
  const s=SRC.find(x=>x.id===ST.src);ST.msg='';ST.res=null;
  if(ST.files.length){ST.busy=true;draw();
    try{const parts=[];for(const f of ST.files){const r=await parseFile(f,m=>{ST.msg=m;const el=DLG&&DLG.el.querySelector('.kim-busy');if(el)el.lastChild.textContent=m;});parts.push(norm(r,f.name.replace(/\.\w+$/,'')));}
      ST.res={decks:[].concat(...parts.map(p=>p.decks)),qcm:[].concat(...parts.map(p=>p.qcm)),fmt:parts.map(p=>p.fmt).filter(Boolean).join(' + '),dropped:parts.reduce((a,p)=>a+p.dropped,0),noImg:parts.some(p=>p.noImg)};}
    catch(e){console.warn('[import]',e);ST.msg=e.message||String(e);}
    ST.busy=false;draw();return;}
  if(ST.text.trim()){ST.res=norm(parseText(ST.text,ST.opt),'Import '+s.n.split(' ')[0]);}
  draw();
}
function doImport(){
  const R=ST.res;if(!R)return;
  const now=new Date().toISOString();let nc=0,nq=0,goFold=null,goDeck=null;
  if(R.decks.length){
    const cf=G('conceptFolders',null),cs=G('concepts',null);
    if(!cf||!cs){notify('Flashcards indisponibles','err');return;}
    const COLS=['#3D63FF','#8B5CF6','#EC4899','#F59E0B','#10B981','#0EA5E9'];
    R.decks.forEach((d,i)=>{const inp=DLG&&DLG.el.querySelector(`[data-dname="${i}"]`);const name=(inp&&inp.value.trim())||d.name||'Paquet importé';
      const f={id:nid(),name:name.slice(0,80),color:COLS[cf.length%6]};cf.push(f);goDeck=f.id;
      d.cards.forEach(c=>{const o={id:nid(),term:c.f,questionId:null,state:'toExplain',definition:c.b,keywords:[],masteryLevel:0,nextReview:null,lastReview:null,createdAt:now,folderId:f.id};if(c.iq)o.imageQ=c.iq;if(c.ia)o.imageA=c.ia;cs.push(o);nc++;});});
  }
  if(R.qcm.length){
    const fs=G('folders',null),cs=G('courses',null),qs=G('questions',null);
    if(!fs||!cs||!qs){notify('QCM indisponibles','err');return;}
    const sel=$('kim-fold'),fn=$('kim-fname'),cn=$('kim-cname');
    let fid=sel&&sel.value;if(!fid||!fs.some(f=>f.id===fid)){const f={id:nid(),name:((fn&&fn.value.trim())||'Import').slice(0,60),color:'#'+['2563EB','7C3AED','DB2777','EA580C','059669','0891B2'][fs.length%6]};fs.push(f);fid=f.id;}
    const c={id:nid(),folderId:fid,name:((cn&&cn.value.trim())||'Import').slice(0,80)};cs.push(c);goFold=fid;
    R.qcm.forEach(q=>{const ans=q.answers.slice(0,6);qs.push({id:nid(),courseId:c.id,question:q.question,answers:ans,correct:Math.min(q.correct,ans.length-1),expl:q.expl||''});nq++;});
  }
  let ok=false;try{ok=saveAll()!==false;}catch(e){console.warn(e);}
  if(!ok){notify('Import impossible : mémoire pleine','err');return;}
  if(DLG)DLG.close();
  notify(`Importé : ${nc?nc+' flashcard'+(nc>1?'s':''):''}${nc&&nq?' et ':''}${nq?nq+' QCM':''} 🎉`,'ok');
  try{if(nq&&goFold&&typeof openFolder==='function'){openFolder(goFold);}else if(nc&&typeof openAllFlashcards==='function'){openAllFlashcards();}}catch(e){}
  ST.res=null;ST.files=[];ST.text='';
}
window.kcImportOpen=function(src){
  if(typeof window.kcDlg!=='function'){notify('Fenêtre indisponible','err');return;}
  ST.src=src&&SRC.some(x=>x.id===src)?src:null;ST.res=null;ST.files=[];ST.text='';ST.msg='';ST.busy=false;
  DLG=window.kcDlg({title:'Importer depuis une autre appli',sub:'Anki, Quizlet, Knowt, Notion, Excel, Kahoot, Moodle…',icon:'move_to_inbox',body:ST.src?stepHTML():srcGrid(),
    foot:'<button class="btn btn-g" data-x>Annuler</button><button class="btn btn-p" data-kim="go" disabled style="display:none"><span class="ms">download</span>Importer</button>',
    onClose(){DLG=null;},
    onOpen(bg){
      bg.classList.add('kim-dlg');
      bg.addEventListener('click',e=>{
        const s=e.target.closest('[data-src]');if(s){ST.src=s.dataset.src;ST.res=null;ST.files=[];ST.msg='';draw();return;}
        const k=e.target.closest('[data-kim]');if(!k)return;
        if(k.dataset.kim==='back'){ST.src=null;ST.res=null;ST.files=[];ST.text='';ST.msg='';draw();}
        else if(k.dataset.kim==='go'&&!k.disabled)doImport();
      });
      bg.addEventListener('change',e=>{
        if(e.target.id==='kim-file'){ST.files=[...e.target.files];ST.text='';analyse();}
        const o=e.target.closest('[data-kopt]');if(o){ST.opt[o.dataset.kopt]=o.value;analyse();}
        if(e.target.id==='kim-fold'){const fn=$('kim-fname');if(fn)fn.style.display=e.target.value?'none':'';}
      });
      bg.addEventListener('input',e=>{if(e.target.id==='kim-ta'){ST.text=e.target.value;ST.files=[];clearTimeout(tT);tT=setTimeout(()=>{const ta=$('kim-ta'),p=ta?ta.selectionStart:0;analyse();const t2=$('kim-ta');if(t2){t2.focus();try{t2.setSelectionRange(p,p);}catch(_){}}},450);}});
      bg.addEventListener('dragover',e=>{const d=e.target.closest('#kim-drop');if(d){e.preventDefault();d.classList.add('over');}});
      bg.addEventListener('dragleave',e=>{const d=e.target.closest('#kim-drop');if(d)d.classList.remove('over');});
      bg.addEventListener('drop',e=>{const d=e.target.closest('#kim-drop');if(!d)return;e.preventDefault();d.classList.remove('over');if(e.dataTransfer.files.length){ST.files=[...e.dataTransfer.files];ST.text='';analyse();}});
    }});
};
/* tests (console) : kcImportParse(texte) */
window.kcImportParse=(t,o)=>parseText(t,o);
window.kcImportRows=fromRows;
window.kcImportFile=f=>parseFile(f,()=>{});
})();
