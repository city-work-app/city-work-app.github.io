/* =========================================================
   atelier-ia.js — « Atelier IA » : l'IA travaille sur SON site, on ramène le résultat (16 nov. 2026)
   Gratuit, sans clé : Gemini / AI Studio / ChatGPT / Claude.
   1. Réglages (source : PDF joint sur le site de l'IA / un de mes cours / un sujet ; langue, niveau, quantité)
   2. Consigne : un clic = consigne copiée + site de l'IA ouvert (ou télécharger en .txt si très longue)
   3. Réponse : on colle, l'appli vérifie en direct (JSON tolérant : réparé, réponse coupée récupérée)
   Types : course (cours interactif), cards (flashcards → concepts), fiche (saveFiche), map (KM.boardFromTree),
           cases (cas cliniques, même lecteur que le cours interactif), annales (→ Cours ↔ Annales, méthode « relais »).
   Lecteur : écran #screen-atelier (#kia-root) ; vues « hub » et « play ».
   Stockage : index kp_kia_idx [{id,kind,title,n,created,updated,pct,done,courseId}] + kp_kia_i_<id> (LZ).
   XP : +2 par bonne réponse (1er essai), +3 par étape terminée, +15 à la fin ; 120 XP/jour max (kp_kia_xp_<date>).
   API : window.KIA = {open(kind, opts), relay(cfg), parseJSON(text)} ; kiaHub(), kiaPlay(id).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const SS=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const notif=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t);};
const newId=()=>typeof uid==='function'?uid():Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const mdHtml=s=>window.KAI&&KAI.md?KAI.md(s):'<p>'+esc(s).replace(/\n/g,'<br>')+'</p>';
const isMac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');
const PASTE=isMac?'⌘ V':'Ctrl + V';
const L='ABCDEFGH';
const gF=()=>typeof folders!=='undefined'?folders:[];
const gC=()=>typeof courses!=='undefined'?courses:[];
const gQ=()=>typeof questions!=='undefined'?questions:[];

/* ───────── Types et IA ───────── */
const KINDS={
  course:{ic:'school',t:'Cours interactif',d:'Ton cours en étapes : explications simples, QCM, vrai ou faux, résumé. Tu gagnes des XP.',c:'#2563eb'},
  cards:{ic:'style',t:'Flashcards',d:'Des cartes recto / verso sur tout le cours, ajoutées à tes flashcards.',c:'#d97706'},
  fiche:{ic:'description',t:'Fiche de révision',d:'Une fiche claire et complète, enregistrée dans ton cours.',c:'#059669'},
  map:{ic:'account_tree',t:'Carte mentale',d:'Le plan du cours en carte, ouverte dans ton tableau blanc.',c:'#0284c7'},
  cases:{ic:'stethoscope',t:'Cas cliniques',d:'Des patients façon examen : questions, puis correction détaillée.',c:'#e11d48'},
  annales:{ic:'link',t:'Cours ↔ Annales',d:'L’IA relie chaque question d’annale au passage exact du cours.',c:'#7c3aed'}
};
const ORDER=['course','cards','fiche','map','cases','annales'];
const AIS=[
  {id:'gemini',n:'Gemini',u:'https://gemini.google.com/app',tag:'Conseillé · lit les longs PDF',c:'#1a73e8'},
  {id:'aistudio',n:'Google AI Studio',u:'https://aistudio.google.com/prompts/new_chat',tag:'Le plus puissant, gratuit',c:'#0b8043'},
  {id:'chatgpt',n:'ChatGPT',u:'https://chatgpt.com/',tag:'',c:'#10a37f'},
  {id:'claude',n:'Claude',u:'https://claude.ai/new',tag:'',c:'#c96442'}
];
const LANGS=['Français','Español','English','Português','Italiano'];
const LEVELS={debutant:['Débutant','débutant : explique simplement, sans jargon non défini'],inter:['Intermédiaire','intermédiaire : étudiant de 2e-3e année'],avance:['Avancé','avancé : niveau examen final, précis et technique']};
const PROF={kine:['kinésithérapie (physiothérapie)','en kinésithérapie'],med:['médecine','en médecine'],dent:['chirurgie dentaire','en dentaire'],veto:['médecine vétérinaire','vétérinaire']};
const prof=()=>PROF[LS('kp_prof','kine')]||PROF.kine;

/* ───────── Stockage ───────── */
const IDX='kp_kia_idx',PFX='kp_kia_i_',MARK='\u0001LZ:';
function idx(){try{const a=JSON.parse(LS(IDX,'[]'));return Array.isArray(a)?a:[];}catch(e){return [];}}
function saveIdx(a){localStorage.setItem(IDX,JSON.stringify(a));}
function getItem(id){
  try{const v=localStorage.getItem(PFX+id);if(!v)return null;
    const raw=v.startsWith(MARK)&&typeof LZString!=='undefined'?LZString.decompressFromUTF16(v.slice(MARK.length)):v;
    return JSON.parse(raw);}catch(e){return null;}
}
function putItem(it){
  it.updated=Date.now();
  const raw=JSON.stringify(it);
  const v=typeof LZString!=='undefined'?MARK+LZString.compressToUTF16(raw):raw;
  try{
    localStorage.setItem(PFX+it.id,v);
    const a=idx().filter(x=>x.id!==it.id);
    a.unshift(meta(it));saveIdx(a);return true;
  }catch(e){notif('Mémoire du navigateur pleine : impossible d’enregistrer','err');return false;}
}
function meta(it){
  const P=it.progress||{},n=it.steps.length;
  return {id:it.id,kind:it.kind,title:it.title,n,created:it.created,updated:it.updated,
    pct:n?Math.round((P.stepsDone||[]).length/n*100):0,done:!!P.done,courseId:it.courseId||null,score:P.best!=null?P.best:null};
}
function delItem(id){try{localStorage.removeItem(PFX+id);}catch(e){}try{saveIdx(idx().filter(x=>x.id!==id));}catch(e){}}

/* ───────── Lecture tolérante de la réponse de l'IA ───────── */
// Prend le(s) bloc(s) de code s'il y en a (plusieurs = réponse + « continue »), répare : retours à la ligne dans
// les textes, guillemets non échappés, virgules en trop ; réponse coupée → garde ce qui est complet.
function fenced(text,langRe){
  const t=String(text||'').replace(/\r/g,'');
  const re=/```([\w-]*)[^\n]*\n([\s\S]*?)(```|$)/g;let m,out=[];
  while((m=re.exec(t))){if(!langRe||langRe.test(m[1]||''))out.push(m[2]);if(!m[3])break;}
  return out;
}
function parseJSON(text){
  let t=String(text||'').replace(/\r/g,'').replace(/ /g,' ');
  const blocks=fenced(t,/^(json|JSON|)$/);
  if(blocks.length)t=blocks.join('\n');
  t=t.replace(/^\s*```[\w-]*\s*$/gm,'');
  const i=t.search(/[\[{]/);if(i<0)return null;
  t=t.slice(i);
  try{return {v:JSON.parse(t),cut:false};}catch(e){}
  const j=Math.max(t.lastIndexOf('}'),t.lastIndexOf(']'));
  if(j>0){try{return {v:JSON.parse(t.slice(0,j+1)),cut:false};}catch(e){}}
  return repair(t);
}
function repair(src){
  let out='',st=[],inS=false,bs=false,safe=null;
  const nextSig=k=>{for(let x=k+1;x<src.length;x++){const c=src[x];if(c!==' '&&c!=='\n'&&c!=='\t')return c;}return '';};
  const tryP=(s,cut)=>{try{return {v:JSON.parse(s),cut};}catch(e){return null;}};
  for(let k=0;k<src.length;k++){
    const c=src[k];
    if(inS){
      if(bs){out+=c;bs=false;continue;}
      if(c==='\\'){out+=c;bs=true;continue;}
      if(c==='"'){const n=nextSig(k);if(n===''||',}]:'.includes(n)){out+=c;inS=false;}else out+='\\"';continue;}
      if(c==='\n'){out+='\\n';continue;}
      if(c==='\t'){out+='\\t';continue;}
      if(c<' ')continue;
      out+=c;continue;
    }
    if(c==='"'||c==='“'||c==='”'){inS=true;out+='"';continue;}
    if(c==='{'||c==='['){st.push(c==='{'?'}':']');out+=c;continue;}
    if(c==='}'||c===']'){
      out=out.replace(/,\s*$/,'');
      if(st.length&&st[st.length-1]===c)st.pop();
      out+=c;
      if(!st.length)return tryP(out,false);
      safe={len:out.length,st:st.slice()};
      continue;
    }
    out+=c;
  }
  if(!safe)return null;
  let o=out.slice(0,safe.len).replace(/,\s*$/,'');
  o+=safe.st.slice().reverse().join('');
  return tryP(o,true);
}
const pick=(o,...ks)=>{for(const k of ks)if(o&&o[k]!=null&&o[k]!=='')return o[k];return undefined;};
const str=v=>v==null?'':Array.isArray(v)?v.map(str).filter(Boolean).join('\n'):typeof v==='object'?Object.values(v).map(str).join(' '):String(v).trim();
const arr=v=>Array.isArray(v)?v:v==null||v===''?[]:[v];
function normQ(q){
  if(!q||typeof q!=='object')return null;
  const type=String(q.type||'').toLowerCase();
  const why=str(pick(q,'explication','pourquoi','why','explanation','justification'));
  const tfv=pick(q,'vrai','true','answer_bool','reponse_vf');
  if(/^(vf|tf|vrai|v\/f|true|bool)/.test(type)||pick(q,'affirmation','statement')!=null||typeof tfv==='boolean'){
    const text=str(pick(q,'affirmation','statement','question','q'));
    let v=tfv;if(v==null)v=pick(q,'reponse','answer','bonne','correct');
    if(typeof v==='string')v=/^(vrai|true|v|oui|yes|verdadero|1)$/i.test(v.trim());
    if(typeof v==='number')v=v===0;   // index : 0 = Vrai
    if(!text||typeof v!=='boolean')return null;
    return {t:'tf',q:text,a:v,why};
  }
  const opts=arr(pick(q,'options','choix','reponses','answers','choices')).map(str).filter(Boolean);
  if(opts.length>=2&&!/^(ouvert|open|libre)/.test(type)){
    let a=pick(q,'bonne','answer','correct','reponse','bonne_reponse','correcta');
    if(Array.isArray(a))a=a[0];
    if(typeof a==='string'){const s=a.trim();
      if(/^[A-Ha-h]$/.test(s))a=s.toUpperCase().charCodeAt(0)-65;
      else if(/^\d+$/.test(s))a=+s;
      else{const k=opts.findIndex(o=>o.toLowerCase()===s.toLowerCase());a=k;}}
    if(typeof a!=='number'||a<0||a>=opts.length)return null;
    return {t:'mcq',q:str(pick(q,'question','q','enonce')),o:opts.slice(0,8),a:Math.floor(a),why};
  }
  const text=str(pick(q,'question','q','enonce'));
  const model=str(pick(q,'reponse','reponse_attendue','answer','model','correction'));
  if(!text||!model)return null;
  return {t:'open',q:text,a:model,why};
}
function normCourse(o,kind){
  if(Array.isArray(o))o=kind==='cases'?{cas:o}:{etapes:o};
  if(!o||typeof o!=='object')return null;
  const list=arr(kind==='cases'?pick(o,'cas','cases','casos','etapes','steps'):pick(o,'etapes','steps','sections','parties','etapas','modules'));
  const steps=list.map(s=>{
    if(!s||typeof s!=='object')return null;
    const qs=arr(pick(s,'questions','quiz','qcm','preguntas')).map(normQ).filter(Boolean);
    const body=str(pick(s,kind==='cases'?'contexte':'explication','contexte','presentation','enonce','explication','explanation','contenu','content','texte','text'));
    if(!body&&!qs.length)return null;
    return {title:str(pick(s,'titre','title','nom','titulo'))||'',pages:str(pick(s,'pages','page','p')),body,
      keys:arr(pick(s,'a_retenir','retenir','keypoints','points','key_points','cles')).map(str).filter(Boolean).slice(0,8),
      qs,after:str(pick(s,'correction','synthese','corrige','solution','resume'))};
  }).filter(Boolean);
  if(!steps.length)return null;
  steps.forEach((s,i)=>{if(!s.title)s.title=(kind==='cases'?'Cas ':'Étape ')+(i+1);});
  return {title:str(pick(o,'titre','title','titulo','cours')),intro:str(pick(o,'intro','introduction','description')),steps,
    summary:arr(pick(o,'resume','summary','points_cles','resumen')).map(str).filter(Boolean),
    cards:normCards(pick(o,'flashcards','cartes','cards'))||[]};
}
function normCards(o){
  const list=Array.isArray(o)?o:o&&typeof o==='object'?arr(pick(o,'cartes','cards','flashcards','tarjetas')):[];
  const out=list.map(c=>{
    if(!c||typeof c!=='object')return null;
    const r=str(pick(c,'recto','front','term','terme','question','q','anverso')),v=str(pick(c,'verso','back','definition','reponse','answer','a','reverso'));
    return r&&v?{r,v}:null;
  }).filter(Boolean);
  return out.length?out:null;
}
function extractText(text,langRe){
  const b=fenced(text,langRe);
  if(b.length)return b.join('\n').trim();
  const any=fenced(text,null);
  if(any.length)return any.join('\n').trim();
  return String(text||'').replace(/\r/g,'').trim();
}
const countNodes=t=>1+(t.kids||[]).reduce((a,k)=>a+countNodes(k),0);

/* ───────── Source du cours (« un de mes cours ») ───────── */
function courseText(cid){
  const c=gC().find(x=>x.id===cid);if(!c)return null;
  const qs=gQ().filter(q=>q.courseId===cid);
  let fiche='';try{const f=typeof getFiche==='function'?getFiche(cid):null;fiche=f&&f.content?String(f.content):'';}catch(e){}
  if(!fiche&&!qs.length)return null;
  let t='COURS : '+c.name+'\n';
  if(fiche)t+='\n=== FICHE DE COURS ===\n'+fiche.slice(0,150000)+'\n';
  if(qs.length)t+='\n=== QCM CORRIGÉS DU COURS ('+qs.length+') ===\n'+qs.slice(0,400).map((q,i)=>{
    const ok=Array.isArray(q.correct)?q.correct:[q.correct];
    return (i+1)+'. '+q.question+'\n'+(q.answers||[]).map((a,j)=>'  '+L[j]+') '+a+(ok.includes(j)?'  ← bonne réponse':'')).join('\n')+(q.expl?'\n  Explication : '+q.expl:'');
  }).join('\n\n');
  return {name:c.name,text:t,info:(fiche?'fiche + ':'')+qs.length+' QCM'};
}
function courseOptions(sel,placeholder){
  const F=gF().filter(f=>!f.isAnnale&&f.type!=='annales'),C=gC();
  return `<option value="">${esc(placeholder||'Choisir un cours…')}</option>`+F.map(f=>{const cs=C.filter(c=>c.folderId===f.id);if(!cs.length)return '';
    return `<optgroup label="${esc(f.name)}">${cs.map(c=>`<option value="${esc(c.id)}"${c.id===sel?' selected':''}>${esc(c.name)}</option>`).join('')}</optgroup>`;}).join('');
}
function fcFolderOptions(sel){
  const cf=typeof conceptFolders!=='undefined'?conceptFolders:[];
  return `<option value="__new"${sel==='__new'||!sel?' selected':''}>Nouveau dossier (nom du cours)</option><option value=""${sel===''?' selected':''}>Sans dossier</option>`+
    cf.map(f=>`<option value="${esc(f.id)}"${f.id===sel?' selected':''}>${esc(f.name)}</option>`).join('');
}

/* ───────── Consignes ───────── */
function prompt(W){
  const P=prof(),lv=LEVELS[W.level]||LEVELS.inter;
  const src=W.src==='pdf'?'DOCUMENT : le cours est dans le fichier PDF joint à ce message. Lis-le en entier, toutes les pages (texte, tableaux et schémas).'
    :W.src==='course'?`DOCUMENT : voici le cours de l’étudiant (sa fiche et/ou ses QCM corrigés), entre les balises <cours> et </cours>.\n<cours>\n${(courseText(W.courseId)||{}).text||''}\n</cours>`
    :`SUJET : « ${W.topic} ». Il n’y a pas de document : appuie-toi sur les connaissances de référence enseignées en ${P[0]}, sans rien inventer.`;
  const head=`Tu es un professeur expert en ${P[0]} qui prépare du matériel de révision pour un étudiant ${P[1]}. Le résultat sera importé automatiquement dans son application de révision : respecte EXACTEMENT le format demandé.
LANGUE : écris tout le contenu en ${W.lang} (même si le document est dans une autre langue ; garde entre parenthèses le terme original quand il est utile pour l’examen).
NIVEAU : ${lv[1]}.
${src}
`;
  const fmt=`
FORMAT DE LA RÉPONSE (très important) :
- Réponds UNIQUEMENT avec un seul bloc de code \`\`\`json contenant un JSON valide, sans aucun texte avant ou après.
- Guillemets droits ", pas de commentaire, pas de virgule après le dernier élément. Pour citer un mot dans un texte, utilise « ».
- Ne coupe jamais le JSON : si la réponse risque d’être trop longue, raccourcis les explications.`;
  const qRules=`QCM : 4 options plausibles, une seule bonne ("bonne" = numéro de la bonne option en partant de 0 ; varie sa position). Vrai ou faux : une affirmation précise, tantôt vraie, tantôt fausse. "explication" : pourquoi, en 1 ou 2 phrases.`;
  if(W.kind==='course'){
    const n={auto:'Entre 5 et 12 étapes selon la longueur du cours',court:'Environ 5 étapes (l’essentiel)',complet:'8 à 10 étapes',detail:'12 à 16 étapes (plus de détails, rien d’important oublié)'}[W.opt]||'Entre 5 et 12 étapes selon la longueur du cours';
    return head+`
TÂCHE : transforme ce cours en COURS INTERACTIF, découpé en étapes courtes qui suivent l’ordre du cours et couvrent TOUT ce qui est important pour l’examen.
- ${n}. Une étape = une notion ou une partie du cours.
- "explication" : en Markdown (### sous-titres, listes, **gras** pour les mots-clés, tableaux si utile), 120 à 300 mots, simple et clair : définitions, mécanismes pas à pas, une analogie ou un exemple clinique concret, les pièges classiques.
- "a_retenir" : 2 à 4 phrases courtes.
- "questions" : 2 ou 3 par étape, avec au moins un QCM et un vrai ou faux. ${qRules}
- "pages" : les pages du document concernées (ex. "p. 4-6"), ou "" si inconnu.
- "resume" : 8 à 12 points clés de tout le cours.
- "flashcards" : 10 à 20 cartes (recto court, verso précis).
Structure exacte :
{"titre":"…","intro":"2 phrases : de quoi parle le cours et ce que l’étudiant saura faire","etapes":[{"titre":"…","pages":"p. 1-3","explication":"…","a_retenir":["…"],"questions":[{"type":"qcm","question":"…","options":["…","…","…","…"],"bonne":0,"explication":"…"},{"type":"vf","affirmation":"…","vrai":true,"explication":"…"}]}],"resume":["…"],"flashcards":[{"recto":"…","verso":"…"}]}
`+fmt;
  }
  if(W.kind==='cases'){
    return head+`
TÂCHE : crée ${W.opt||5} CAS CLINIQUES façon examen, basés sur ce cours, variés (patients, âges, stades, contextes différents).
- "contexte" : en Markdown, la présentation du patient : âge, profession, motif de consultation, antécédents, histoire, examen clinique / bilan (chiffres, tests), imagerie si utile. 80 à 200 mots.
- "questions" : 3 à 5 par cas, dans l’ordre du raisonnement (diagnostic, bilan, objectifs, prise en charge, précautions / signes d’alerte). Mélange des QCM (4 options plausibles, une seule bonne, "bonne" = numéro de la bonne option à partir de 0, varie sa position ; "explication" = pourquoi) et des questions ouvertes ("reponse" = la réponse attendue, précise, 1 à 4 phrases).
- "correction" : en Markdown, la synthèse complète du raisonnement attendu à l’examen.
Structure exacte :
{"titre":"…","cas":[{"titre":"court, ex. « Entorse de cheville chez une sportive »","contexte":"…","questions":[{"type":"qcm","question":"…","options":["…","…","…","…"],"bonne":0,"explication":"…"},{"type":"ouverte","question":"…","reponse":"…"}],"correction":"…"}]}
`+fmt;
  }
  if(W.kind==='cards'){
    const n={15:'15 flashcards',30:'30 flashcards',50:'50 flashcards',all:'autant de flashcards que nécessaire pour couvrir TOUT le cours (souvent 40 à 80)'}[W.opt]||'30 flashcards';
    return head+`
TÂCHE : crée ${n} qui couvrent tout le cours : définitions, mécanismes, classifications, chiffres, origines / terminaisons / innervations / actions pour les muscles, signes cliniques, tests, contre-indications, pièges d’examen.
- Une seule idée par carte. Recto : une question courte ou un terme. Verso : la réponse précise, 40 mots maximum.
- Pas de doublons, dans l’ordre du cours.
Structure exacte :
{"titre":"titre court du cours","cartes":[{"recto":"…","verso":"…"}]}
`+fmt;
  }
  if(W.kind==='fiche'){
    return head+`
TÂCHE : rédige une FICHE DE RÉVISION ${W.opt==='synth'?'synthétique (1 à 2 pages : l’essentiel pour l’examen)':'complète (tout le contenu important, bien organisé)'}.
- Markdown : # titre du cours, ## grandes parties, ### sous-parties, listes à puces, **gras** pour les mots-clés, tableaux pour les comparaisons et classifications.
- À la fin : ## Pièges classiques d’examen, puis ## À retenir absolument (5 à 10 points).
- Fidèle au document, n’invente rien.${W.src==='pdf'?' Indique les pages entre crochets après les titres, ex. [p. 4].':''}

FORMAT DE LA RÉPONSE (très important) : réponds UNIQUEMENT avec la fiche dans un seul bloc de code \`\`\`markdown … \`\`\` (pour qu’elle se copie telle quelle), sans aucun texte avant ou après.`;
  }
  if(W.kind==='map'){
    return head+`
TÂCHE : fais le PLAN du cours pour une CARTE MENTALE.
- 1re ligne : « # » suivi du sujet central (titre court).
- Puis 4 à 8 branches principales, chacune avec ses sous-idées, jusqu’à 4 niveaux.
- Une ligne = une idée de 2 à 8 mots (pas de longues phrases) : mots-clés, chiffres, exemples.
- Chaque ligne commence par « - », avec 2 espaces de plus par niveau.
Exemple :
# Genou
- Anatomie
  - Os
    - Fémur, tibia, patella
  - Ligaments croisés
- Pathologies
  - Rupture du LCA

FORMAT DE LA RÉPONSE (très important) : réponds UNIQUEMENT avec le plan dans un seul bloc de code \`\`\`text … \`\`\`, sans aucun texte avant ou après.`;
  }
  return '';
}

/* ───────── Vérification de la réponse collée ───────── */
function check(W,text){
  if(!String(text||'').trim())return {state:'empty'};
  const k=W.kind;
  if(W.relay)return W.relay.parse(text);
  if(k==='course'||k==='cases'){
    const r=parseJSON(text);
    const d=r&&normCourse(r.v,k);
    if(!d)return {state:'err',msg:'Je ne trouve pas le '+(k==='cases'?'JSON des cas cliniques':'JSON du cours')+' dans ce texte.'};
    const nq=d.steps.reduce((a,s)=>a+s.qs.length,0);
    return {state:r.cut?'warn':'ok',data:d,
      msg:k==='cases'?`${d.steps.length} cas clinique${d.steps.length>1?'s':''} · ${nq} question${nq>1?'s':''}`
        :`${d.steps.length} étape${d.steps.length>1?'s':''} · ${nq} question${nq>1?'s':''}${d.summary.length?' · résumé':''}${d.cards.length?' · '+d.cards.length+' flashcards':''}`,
      cut:r.cut};
  }
  if(k==='cards'){
    const r=parseJSON(text);const c=r&&normCards(r.v);
    if(!c)return {state:'err',msg:'Je ne trouve pas de flashcards (recto / verso) dans ce texte.'};
    return {state:r.cut?'warn':'ok',data:{title:str(r.v&&!Array.isArray(r.v)?pick(r.v,'titre','title'):''),cards:c},msg:c.length+' flashcard'+(c.length>1?'s':''),cut:r.cut};
  }
  if(k==='fiche'){
    const t=extractText(text,/^(markdown|md|)$/i);
    if(t.length<150)return {state:'err',msg:'Le texte est trop court pour une fiche.'};
    const h=(t.match(/^#{1,4}\s/mg)||[]).length;
    return {state:'ok',data:{md:t,title:(t.match(/^#\s+(.+)$/m)||[])[1]||''},msg:`Fiche de ${t.split(/\s+/).length} mots · ${h} titre${h>1?'s':''}`};
  }
  if(k==='map'){
    const t=extractText(text,/^(text|txt|markdown|md|)$/i);
    if(!window.KM||!KM.parseOutline)return {state:'err',msg:'Le module des cartes mentales n’est pas chargé : recharge la page.'};
    const forest=KM.parseOutline(t);
    const tree=KM.forestToTree(forest,W.title||'Plan');
    const n=countNodes(tree);
    if(n<4)return {state:'err',msg:'Je ne trouve pas de plan avec des tirets « - » dans ce texte.'};
    return {state:'ok',data:{tree},msg:`${(tree.kids||[]).length} branches · ${n} idées`};
  }
  return {state:'err',msg:'Type inconnu'};
}

/* ───────── Fenêtre (réglages → consigne → réponse) ───────── */
let W=null;
function defaults(kind,o){
  o=o||{};
  return {kind,step:kind?1:0,src:o.courseId?'course':LS('kp_kia_src','pdf')==='topic'?'topic':'pdf',courseId:o.courseId||'',topic:o.topic||'',
    lang:LS('kp_kia_lang','Français'),level:LS('kp_kia_level','inter'),opt:null,dest:o.courseId||'',fcDest:'__new',
    text:'',res:null,copied:false,ai:LS('kp_kia_ai','gemini'),title:''};
}
function optDefault(kind){return {course:'auto',cards:'30',cases:'5',fiche:'full'}[kind]||null;}
window.kiaNew=function(kind,o){
  if(kind==='annales'){goAnnales();return;}
  W=defaults(kind||null,o);if(kind)W.opt=optDefault(kind);
  openDlg();
};
function goAnnales(){
  closeDlg();
  if(typeof coursAnnalesOpen==='function')coursAnnalesOpen('relais');else notif('Module Cours ↔ Annales non chargé','err');
}
// Fenêtre réduite (consigne + réponse) pour un autre module : cfg = {title, sub, icon, color, prompt, file, pdfNote, parse(text)→{state,msg,data}, onSave(data), saveLabel}
function relay(cfg){
  W={relay:cfg,step:2,text:'',res:null,copied:false,ai:LS('kp_kia_ai','gemini'),src:cfg.pdfNote?'pdf':'course'};
  openDlg();
}
function openDlg(){
  closeDlg();
  const bg=document.createElement('div');bg.className='kia-bg';bg.id='kia-dlg';
  bg.innerHTML='<div class="kia-dlg" role="dialog" aria-modal="true" aria-labelledby="kia-dt"></div>';
  bg.addEventListener('mousedown',e=>{if(e.target===bg)bg._down=true;});
  bg.addEventListener('click',e=>{if(e.target===bg&&bg._down&&!W.text)closeDlg();bg._down=false;});
  bg.addEventListener('click',onClick);
  bg.addEventListener('input',onInput);
  bg.addEventListener('change',onInput);
  document.body.appendChild(bg);
  document.addEventListener('keydown',onKeyDlg,true);
  requestAnimationFrame(()=>bg.classList.add('open'));
  draw();
}
function closeDlg(){
  const b=$('kia-dlg');if(b)b.remove();
  document.removeEventListener('keydown',onKeyDlg,true);
}
function onKeyDlg(e){if(e.key==='Escape'&&$('kia-dlg')&&!document.getElementById('kc-dlg')){e.stopPropagation();if(W&&W.text){kcConfirm('Fermer ? La réponse collée sera perdue.',{ok:'Fermer'}).then(ok=>{if(ok)closeDlg();});return;}closeDlg();}}
function head(){
  const R=W.relay,K=R?{ic:R.icon||'content_paste',t:R.title,c:R.color||'#7c3aed'}:W.kind?KINDS[W.kind]:{ic:'auto_awesome',t:'Atelier IA',c:'var(--kc-primary,#2563eb)'};
  const sub=R?(R.sub||'Avec Gemini, ChatGPT ou Claude, sur leur site'):W.kind?'Avec Gemini, ChatGPT ou Claude, sur leur site · gratuit, sans clé':'Que veux-tu créer ?';
  const steps=R?['Consigne','Réponse']:['Réglages','Consigne','Réponse'];
  const cur=R?W.step-2:W.step-1;
  return `<header class="kia-dh"><span class="kia-dh-ic" style="--c:${K.c}"><span class="ms">${K.ic}</span></span>
    <div class="kia-dh-t"><b id="kia-dt">${esc(K.t)}</b><small>${esc(sub)}</small></div>
    <button class="kia-x" data-a="close" aria-label="Fermer"><span class="ms">close</span></button></header>
    ${W.step>0?`<ol class="kia-steps">${steps.map((s,i)=>`<li class="${i<cur?'done':i===cur?'on':''}"><span>${i<cur?'<span class="ms">check</span>':i+1}</span>${s}</li>`).join('')}</ol>`:''}`;
}
function draw(){
  const d=document.querySelector('#kia-dlg .kia-dlg');if(!d)return;
  d.innerHTML=head()+`<div class="kia-body">${W.step===0?bodyKinds():W.step===1?bodySettings():W.step===2?bodyCopy():bodyPaste()}</div>`+foot();
  if(W.step===3){const ta=$('kia-ta');if(ta){ta.value=W.text;if(!W.text)setTimeout(()=>ta.focus(),60);}showCheck();}
}
function bodyKinds(){
  return `<div class="kia-kinds">${ORDER.map(k=>{const K=KINDS[k];return `<button class="kia-kind" data-a="kind" data-k="${k}" style="--c:${K.c}"><span class="kia-kind-ic"><span class="ms">${K.ic}</span></span><b>${K.t}</b><small>${K.d}</small></button>`;}).join('')}</div>`;
}
function seg(name,list,cur){return `<div class="kia-seg" role="group">${list.map(([v,t])=>`<button class="${String(cur)===String(v)?'on':''}" data-a="set" data-f="${name}" data-v="${esc(v)}">${t}</button>`).join('')}</div>`;}
function bodySettings(){
  const k=W.kind,ct=W.src==='course'&&W.courseId?courseText(W.courseId):null;
  const srcCard=(v,ic,t,d)=>`<button class="kia-src${W.src===v?' on':''}" data-a="set" data-f="src" data-v="${v}"><span class="ms">${ic}</span><b>${t}</b><small>${d}</small></button>`;
  let h=`<div class="kia-lbl">Ton cours</div>
    <div class="kia-srcs">${srcCard('pdf','picture_as_pdf','Mon PDF','Tu le joindras sur le site de l’IA')}${srcCard('course','menu_book','Un de mes cours','Sa fiche et ses QCM')}${srcCard('topic','edit_note','Un sujet','Sans document')}</div>`;
  if(W.src==='course')h+=`<select class="fi kia-in" data-f="courseId">${courseOptions(W.courseId)}</select>${W.courseId?(ct?`<div class="kia-hint ok"><span class="ms">check_circle</span>${esc(ct.info)} seront envoyés à l’IA</div>`:`<div class="kia-hint err"><span class="ms">error</span>Ce cours n’a ni fiche ni QCM : choisis plutôt « Mon PDF »</div>`):''}`;
  if(W.src==='topic')h+=`<input class="fi kia-in" data-f="topic" placeholder="Ex. : le ligament croisé antérieur, la spasticité, l’épaule douloureuse…" value="${esc(W.topic)}">`;
  if(W.src==='pdf')h+=`<div class="kia-hint"><span class="ms">info</span>Rien à envoyer ici : à l’étape suivante, tu joindras ton PDF directement dans Gemini ou ChatGPT.</div>`;
  if(k==='course')h+=`<div class="kia-lbl">Longueur</div>`+seg('opt',[['auto','Auto'],['court','Court'],['complet','Complet'],['detail','Très détaillé']],W.opt);
  if(k==='cases')h+=`<div class="kia-lbl">Nombre de cas</div>`+seg('opt',[['3','3'],['5','5'],['8','8']],W.opt);
  if(k==='cards')h+=`<div class="kia-lbl">Nombre de cartes</div>`+seg('opt',[['15','15'],['30','30'],['50','50'],['all','Tout le cours']],W.opt)+
    `<div class="kia-lbl">Ranger dans</div><select class="fi kia-in" data-f="fcDest">${fcFolderOptions(W.fcDest)}</select>`;
  if(k==='fiche')h+=`<div class="kia-lbl">Style</div>`+seg('opt',[['full','Complète'],['synth','Synthétique']],W.opt)+
    `<div class="kia-lbl">Enregistrer la fiche dans le cours</div><select class="fi kia-in" data-f="dest">${courseOptions(W.dest,'Choisir le cours…')}</select>`;
  h+=`<div class="kia-row2"><div><div class="kia-lbl">Langue</div><div class="kia-chips">${LANGS.map(n=>`<button class="kia-chip${W.lang===n?' on':''}" data-a="set" data-f="lang" data-v="${n}">${n}</button>`).join('')}${LANGS.includes(W.lang)?`<button class="kia-chip" data-a="lang">Autre…</button>`:`<button class="kia-chip on" data-a="lang">${esc(W.lang)}</button>`}</div></div>
    <div><div class="kia-lbl">Niveau</div>${seg('level',Object.entries(LEVELS).map(([v,x])=>[v,x[0]]),W.level)}</div></div>`;
  return h;
}
function curPrompt(){return W.relay?W.relay.prompt:prompt(W);}
function bodyCopy(){
  const p=curPrompt(),big=p.length>30000,pdf=W.relay?!!W.relay.pdfNote:W.src==='pdf';
  return `<p class="kia-lead"><b>Clique sur ton IA :</b> la consigne est copiée et son site s’ouvre dans un nouvel onglet.</p>
    <div class="kia-ais">${AIS.map(a=>`<button class="kia-ai${W.ai===a.id?' last':''}" data-a="ai" data-i="${a.id}" style="--c:${a.c}"><span class="kia-ai-dot">${a.n[0]}</span><span><b>${a.n}</b>${a.tag?`<small>${a.tag}</small>`:''}</span><span class="ms">open_in_new</span></button>`).join('')}</div>
    <ol class="kia-how">
      <li><span>1</span><div>Dans l’IA, <b>colle</b> la consigne (<kbd>${PASTE}</kbd>).</div></li>
      ${pdf?`<li class="kia-how-pdf"><span>2</span><div><b>Joins ton PDF</b> avec le bouton <b>+</b> ou le trombone, à côté de la zone de texte.${W.relay&&W.relay.pdfNote?' '+W.relay.pdfNote:''}</div></li>`:''}
      <li><span>${pdf?3:2}</span><div><b>Envoie</b>, attends la fin de la réponse, puis clique sur <b>Copier</b> <span class="ms kia-cp">content_copy</span> sous la réponse (ou sur le bloc de code).</div></li>
      <li><span>${pdf?4:3}</span><div>Reviens ici et clique sur <b>« J’ai la réponse »</b>.</div></li>
    </ol>
    ${W.copied?`<div class="kia-hint ok"><span class="ms">check_circle</span>Consigne copiée${W.copiedAi?' · '+esc(W.copiedAi)+' ouvert dans un nouvel onglet':''}</div>`:''}
    ${big?`<div class="kia-hint warn"><span class="ms">description</span><span>Consigne très longue (${Math.round(p.length/1000)} 000 caractères). Gemini ou AI Studio l’acceptent sans problème ; si ton IA refuse de coller autant de texte, télécharge-la en fichier et joins le fichier à la place.</span></div>`:''}
    <div class="kia-tools">
      <button class="btn btn-g btn-sm" data-a="copy"><span class="ms">content_copy</span>Copier seulement</button>
      <button class="btn btn-g btn-sm" data-a="dl"><span class="ms">download</span>Télécharger en fichier</button>
      <details class="kia-see"><summary><span class="ms">visibility</span>Voir la consigne</summary><pre>${esc(p.length>12000?p.slice(0,12000)+'\n…':p)}</pre></details>
    </div>`;
}
function bodyPaste(){
  return `<p class="kia-lead">Colle ici toute la réponse de l’IA (<kbd>${PASTE}</kbd>). Je vérifie tout de suite qu’elle est complète.</p>
    <div class="kia-paste">
      <textarea id="kia-ta" class="kia-ta" spellcheck="false" placeholder="Colle la réponse de l’IA ici…"></textarea>
      <button class="btn btn-g btn-sm kia-pbtn" data-a="paste"><span class="ms">content_paste</span>Coller</button>
    </div>
    <div id="kia-check" class="kia-check" role="status"></div>`;
}
function showCheck(){
  const el=$('kia-check');if(!el)return;
  const r=W.res||{state:'empty'};
  const ic={ok:'check_circle',warn:'warning',err:'error',empty:'content_paste_go'}[r.state];
  let tip='';
  if(r.state==='err')tip=`<ul><li>Clique bien sur <b>Copier</b> sous la réponse (ou sur l’icône du bloc de code) plutôt que de sélectionner le texte.</li><li>Si la réponse est coupée, écris <b>« continue »</b> à l’IA, puis colle la suite <b>à la fin</b> de ce texte.</li><li>Sinon, demande-lui : <i>« Redonne uniquement le bloc de code, complet. »</i></li></ul>`;
  if(r.state==='warn')tip=`<div>La réponse semble coupée : je garde tout ce qui est complet. Pour avoir le reste, écris <b>« continue »</b> à l’IA et colle la suite à la fin de ce texte.</div>`;
  el.className='kia-check '+r.state;
  el.innerHTML=r.state==='empty'?`<span class="ms">${ic}</span><span>En attente de la réponse…</span>`:`<span class="ms">${ic}</span><div><b>${r.state==='err'?'Pas encore bon':r.state==='warn'?'Presque : ':'Parfait : '}</b>${esc(r.msg||'')}${tip}</div>`;
  const sv=document.querySelector('#kia-dlg [data-a="save"]');if(sv)sv.disabled=!(r.state==='ok'||r.state==='warn');
}
function foot(){
  const R=W.relay;
  if(W.step===0)return `<footer class="kia-df"><span class="kia-note"><span class="ms">lock_open</span>Gratuit, sans clé ni compte à configurer</span></footer>`;
  if(W.step===1)return `<footer class="kia-df"><button class="btn btn-g" data-a="back"><span class="ms">arrow_back</span>Retour</button><span class="kia-flex"></span><button class="btn btn-p" data-a="next">Préparer la consigne<span class="ms">arrow_forward</span></button></footer>`;
  if(W.step===2)return `<footer class="kia-df">${R?'':`<button class="btn btn-g" data-a="back"><span class="ms">arrow_back</span>Réglages</button>`}<span class="kia-flex"></span><button class="btn btn-p" data-a="next">J’ai la réponse<span class="ms">arrow_forward</span></button></footer>`;
  return `<footer class="kia-df"><button class="btn btn-g" data-a="back"><span class="ms">arrow_back</span>Consigne</button><span class="kia-flex"></span><button class="btn btn-p" data-a="save" disabled><span class="ms">check</span>${R&&R.saveLabel?esc(R.saveLabel):saveLabel()}</button></footer>`;
}
function saveLabel(){return {course:'Ouvrir le cours interactif',cases:'Ouvrir les cas cliniques',cards:'Ajouter les flashcards',fiche:'Enregistrer la fiche',map:'Ouvrir la carte mentale'}[W.kind]||'Enregistrer';}
function copyText(t){
  try{if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).catch(()=>fallbackCopy(t));return true;}}catch(e){}
  return fallbackCopy(t);
}
function fallbackCopy(t){
  const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(e){}ta.remove();return ok;
}
function validSettings(){
  if(W.src==='course'){if(!W.courseId)return 'Choisis le cours.';if(!courseText(W.courseId))return 'Ce cours n’a ni fiche ni QCM : choisis plutôt « Mon PDF ».';}
  if(W.src==='topic'&&W.topic.trim().length<3)return 'Écris le sujet.';
  if(W.kind==='fiche'&&!W.dest)return 'Choisis le cours où enregistrer la fiche.';
  return '';
}
function onClick(e){
  const b=e.target.closest('[data-a]');if(!b||!W)return;
  const a=b.dataset.a;
  if(a==='close'){if(W.text&&W.step===3){kcConfirm('Fermer ? La réponse collée sera perdue.',{ok:'Fermer'}).then(ok=>{if(ok)closeDlg();});return;}closeDlg();return;}
  if(a==='kind'){const k=b.dataset.k;if(k==='annales'){goAnnales();return;}W.kind=k;W.opt=optDefault(k);W.step=1;draw();return;}
  if(a==='set'){
    const f=b.dataset.f,v=b.dataset.v;W[f]=v;
    if(f==='src'){SS('kp_kia_src',v);if(v==='course'&&W.kind==='fiche'&&W.courseId&&!W.dest)W.dest=W.courseId;}
    if(f==='lang')SS('kp_kia_lang',v);if(f==='level')SS('kp_kia_level',v);
    draw();return;
  }
  if(a==='lang'){const v=window.prompt('Dans quelle langue ?',LANGS.includes(W.lang)?'':W.lang)||'';if(v.trim()){W.lang=v.trim().slice(0,30);SS('kp_kia_lang',W.lang);draw();}return;}
  if(a==='back'){W.step=Math.max(0,W.step-1);draw();return;}
  if(a==='next'){
    if(W.step===1){const er=validSettings();if(er){notif(er,'err');return;}}
    W.step++;draw();return;
  }
  if(a==='ai'){
    const ai=AIS.find(x=>x.id===b.dataset.i);if(!ai)return;
    copyText(curPrompt());W.copied=true;W.copiedAi=ai.n;W.ai=ai.id;SS('kp_kia_ai',ai.id);
    try{window.open(ai.u,'_blank','noopener');}catch(_){}
    notif('Consigne copiée : colle-la dans '+ai.n+' ('+PASTE+')','ok');
    draw();return;
  }
  if(a==='copy'){copyText(curPrompt());W.copied=true;W.copiedAi='';notif('Consigne copiée','ok');draw();return;}
  if(a==='dl'){
    const name=((W.relay&&W.relay.file)||('consigne-'+(W.kind||'ia')))+'.txt';
    const url=URL.createObjectURL(new Blob([curPrompt()],{type:'text/plain;charset=utf-8'}));
    const l=document.createElement('a');l.href=url;l.download=name;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    return;
  }
  if(a==='paste'){
    const ta=$('kia-ta');
    if(navigator.clipboard&&navigator.clipboard.readText){
      navigator.clipboard.readText().then(t=>{if(!t){notif('Le presse-papiers est vide','err');return;}W.text=W.text?W.text.replace(/\s*$/,'\n')+t:t;if(ta)ta.value=W.text;W.res=check(W,W.text);showCheck();})
        .catch(()=>{notif('Colle avec '+PASTE+' dans la zone','err');ta&&ta.focus();});
    }else{notif('Colle avec '+PASTE+' dans la zone','err');ta&&ta.focus();}
    return;
  }
  if(a==='save'){doSave();return;}
}
let tIn=0;
function onInput(e){
  const t=e.target;if(!W)return;
  if(t.id==='kia-ta'){W.text=t.value;clearTimeout(tIn);tIn=setTimeout(()=>{W.res=check(W,W.text);showCheck();},220);return;}
  const f=t.dataset&&t.dataset.f;if(!f)return;
  W[f]=t.value;
  if(f==='courseId'){if(W.kind==='fiche'&&(!W.dest||e.type==='change'))W.dest=t.value;if(e.type==='change')draw();}
  else if(e.type==='change'&&f!=='topic')draw();
}

/* ───────── Enregistrement ───────── */
function srcName(){
  if(W.src==='course'){const c=gC().find(x=>x.id===W.courseId);return c?c.name:'';}
  if(W.src==='topic')return W.topic.trim();
  return '';
}
async function doSave(){
  const r=W.res||check(W,W.text);
  if(!r||!(r.state==='ok'||r.state==='warn'))return;
  if(W.relay){
    const btn=document.querySelector('#kia-dlg [data-a="save"]');if(btn)btn.disabled=true;
    try{await W.relay.onSave(r.data);closeDlg();}catch(e){notif(e&&e.message||'Erreur','err');if(btn)btn.disabled=false;}
    return;
  }
  const k=W.kind,d=r.data;
  if(k==='course'||k==='cases'){
    const it={id:newId(),kind:k,title:(d.title||srcName()||KINDS[k].t).slice(0,120),intro:d.intro,steps:d.steps,summary:d.summary,cards:d.cards,
      created:Date.now(),courseId:W.src==='course'?W.courseId:null,src:W.src,lang:W.lang,
      progress:{step:-1,ans:{},stepsDone:[],done:false,xp:0,best:null}};
    if(!putItem(it))return;
    closeDlg();notif((k==='cases'?'Cas cliniques prêts':'Cours interactif prêt')+' : '+it.steps.length+(k==='cases'?' cas':' étapes'),'ok');
    kiaPlay(it.id);return;
  }
  if(k==='cards'){
    const n=addCards(d.cards,W.fcDest,d.title||srcName());
    if(n){closeDlg();notif(n+' flashcards ajoutées','ok');if(typeof showScreen==='function')showScreen('concepts');}
    return;
  }
  if(k==='fiche'){
    const c=gC().find(x=>x.id===W.dest);if(!c){notif('Choisis le cours','err');return;}
    if(typeof saveFiche!=='function'){notif('Module des fiches non chargé','err');return;}
    const old=typeof getFiche==='function'?getFiche(c.id):null;
    let content=d.md;
    if(old&&old.content&&String(old.content).trim()){
      const ch=window.confirm('Ce cours a déjà une fiche.\n\nOK = remplacer l’ancienne fiche\nAnnuler = ajouter la nouvelle à la suite');
      if(!ch)content=String(old.content).replace(/\s*$/,'')+'\n\n---\n\n'+d.md;
    }
    saveFiche(c.id,content);
    closeDlg();notif('Fiche enregistrée dans « '+c.name+' »','ok');
    try{curC=c.id;}catch(e){}
    if(typeof showScreen==='function')showScreen('fiche');
    return;
  }
  if(k==='map'){
    if(!window.KM||!KM.boardFromTree){notif('Module des cartes mentales non chargé','err');return;}
    const tree=d.tree;if(srcName()&&(!tree.t||tree.t==='Plan'))tree.t=srcName();
    const id=KM.boardFromTree(tree.t||'Carte',tree,{courseId:W.src==='course'?W.courseId:null});
    if(!id)return;
    closeDlg();notif('Carte mentale créée','ok');
    if(KM.openBoard)KM.openBoard(id);
    return;
  }
}
function addCards(cards,dest,title){
  const list=typeof concepts!=='undefined'?concepts:null,cf=typeof conceptFolders!=='undefined'?conceptFolders:null;
  if(!list||!cards||!cards.length){notif('Impossible d’ajouter les cartes','err');return 0;}
  let fid=dest||null;
  if(fid==='__new'&&cf){fid=newId();cf.push({id:fid,name:(title||'Atelier IA').replace(/\.pdf$/i,'').slice(0,60),color:'#F59E0B'});}
  else if(fid==='__new')fid=null;
  const now=new Date().toISOString();
  cards.forEach(x=>list.push({id:newId(),term:x.r,questionId:null,state:'toExplain',definition:x.v,keywords:[],masteryLevel:0,nextReview:null,lastReview:null,createdAt:now,folderId:fid}));
  try{if(typeof saveAll==='function'&&saveAll()===false){notif('Mémoire du navigateur pleine','err');}}catch(e){}
  return cards.length;
}

/* ───────── Écran : accueil de l'atelier ───────── */
let V={view:'hub',it:null,saveT:0};
function root(){return $('kia-root');}
window.kiaHub=function(){V.view='hub';V.it=null;if(typeof showScreen==='function'&&!isOn())showScreen('atelier');else renderHub();};
const isOn=()=>{const s=$('screen-atelier');return s&&s.classList.contains('active');};
function renderHub(){
  const r=root();if(!r)return;
  r.className='kia kia-v-hub';
  const items=idx();
  const fmtD=t=>{try{return new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});}catch(e){return '';}};
  r.innerHTML=`
  <div class="kia-wrap">
    <div class="kia-top"><button class="hub-back" onclick="showScreen('outils')" aria-label="Retour"><span class="ms">arrow_back</span></button></div>
    <section class="kia-hero">
      <div class="kia-badge"><span class="ms">lock_open</span>Gratuit · sans clé</div>
      <h1>Atelier <em>IA</em></h1>
      <p>Gemini, ChatGPT ou Claude font le travail sur leur site, avec ton PDF. Tu ramènes le résultat ici en un copier-coller, et il devient un vrai outil de révision.</p>
      <ol class="kia-flow">
        <li><span class="ms">tune</span><div><b>Choisis</b><small>ce que tu veux créer</small></div></li>
        <li><span class="ms">content_copy</span><div><b>Copie</b><small>la consigne dans ton IA</small></div></li>
        <li><span class="ms">content_paste</span><div><b>Colle</b><small>sa réponse ici</small></div></li>
      </ol>
    </section>
    <div class="kia-kinds kia-kinds-hub">${ORDER.map(k=>{const K=KINDS[k];return `<button class="kia-kind" onclick="kiaNew('${k}')" style="--c:${K.c}"><span class="kia-kind-ic"><span class="ms">${K.ic}</span></span><b>${K.t}</b><small>${K.d}</small><span class="ms kia-kind-go">arrow_forward</span></button>`;}).join('')}</div>
    <section class="kia-mine">
      <h2>Mes cours interactifs et cas cliniques${items.length?` <span>${items.length}</span>`:''}</h2>
      ${items.length?`<div class="kia-list">${items.map(m=>{const K=KINDS[m.kind]||KINDS.course;return `
        <div class="kia-it" style="--c:${K.c}">
          <button class="kia-it-main" onclick="kiaPlay('${esc(m.id)}')">
            <span class="kia-it-ic"><span class="ms">${m.done?'task_alt':K.ic}</span></span>
            <span class="kia-it-t"><b>${esc(m.title)}</b><small>${K.t} · ${m.n} ${m.kind==='cases'?'cas':'étapes'}${m.score!=null?' · '+m.score+' % de réussite':''} · ${fmtD(m.updated||m.created)}</small>
              <span class="kia-it-bar"><i style="width:${m.done?100:m.pct}%"></i></span></span>
            <span class="kia-it-go">${m.done?'Revoir':m.pct?'Reprendre':'Commencer'}<span class="ms">arrow_forward</span></span>
          </button>
          <button class="kia-ib" title="Supprimer" aria-label="Supprimer" onclick="kiaDelete('${esc(m.id)}')"><span class="ms">delete</span></button>
        </div>`;}).join('')}</div>`
      :`<div class="kia-empty"><span class="ms">school</span><div><b>Rien pour l’instant</b><small>Crée ton premier cours interactif : choisis « Cours interactif » ci-dessus.</small></div></div>`}
    </section>
  </div>`;
}
window.kiaDelete=async function(id){
  const m=idx().find(x=>x.id===id);if(!m)return;
  if(!(await kcConfirm('Supprimer « '+m.title+' » ?\nTa progression sera perdue (ça ne touche pas à tes cours ni à tes flashcards).')))return;
  delItem(id);renderHub();notif('Supprimé','ok');
};

/* ───────── Lecteur (cours interactif / cas cliniques) ───────── */
window.kiaPlay=function(id){
  const it=getItem(id);if(!it){notif('Introuvable','err');return;}
  V.view='play';V.it=it;
  if(!isOn()&&typeof showScreen==='function')showScreen('atelier');else renderPlay();
  scrollTop();
};
function scrollTop(){try{window.scrollTo({top:0});const s=$('screen-atelier');if(s)s.scrollTop=0;}catch(e){}}
function saveSoon(){clearTimeout(V.saveT);const it=V.it;V.saveT=setTimeout(()=>{if(it)putItem(it);},300);}
const qKey=(s,j)=>s+'-'+j;
function stepAnswered(it,s){return it.steps[s].qs.every((q,j)=>{const a=it.progress.ans[qKey(s,j)];return a&&(q.t!=='open'||a.ok!=null);});}
function totals(it){
  let n=0,ok=0,done=0;
  it.steps.forEach((s,i)=>s.qs.forEach((q,j)=>{n++;const a=it.progress.ans[qKey(i,j)];if(a&&(q.t!=='open'||a.ok!=null)){done++;if(a.ok)ok++;}}));
  return {n,ok,done};
}
function xp(n){
  if(!n||typeof gamAward!=='function')return 0;
  const k='kp_kia_xp_'+new Date().toISOString().slice(0,10),used=+LS(k,'0');
  const give=Math.max(0,Math.min(n,120-used));
  if(!give)return 0;
  try{gamAward(give,'bonus');}catch(e){return 0;}
  SS(k,String(used+give));
  V.it.progress.xp=(V.it.progress.xp||0)+give;
  return give;
}
function renderPlay(){
  const r=root(),it=V.it;if(!r||!it)return;
  const P=it.progress,K=KINDS[it.kind]||KINDS.course,cases=it.kind==='cases';
  r.className='kia kia-v-play';
  const n=it.steps.length,s=P.step;
  const bar=`<div class="kia-pbar">${it.steps.map((x,i)=>`<button class="${P.stepsDone.includes(i)?'done':''}${i===s?' on':''}" data-p="go" data-s="${i}" title="${esc(x.title)}" aria-label="${esc((cases?'Cas ':'Étape ')+(i+1))}"></button>`).join('')}</div>`;
  const top=`<header class="kia-ph">
      <button class="kia-ib" data-p="hub" aria-label="Retour"><span class="ms">arrow_back</span></button>
      <div class="kia-ph-t"><small>${K.t}${s>=0&&s<n?' · '+(cases?'cas ':'étape ')+(s+1)+' / '+n:''}</small><b>${esc(it.title)}</b></div>
      <span class="kia-xp" title="XP gagnés dans ce cours"><span class="ms">bolt</span>${P.xp||0} XP</span>
    </header>${bar}`;
  let body='';
  if(s<0)body=introHTML(it);
  else if(s>=n)body=endHTML(it);
  else body=stepHTML(it,s);
  r.innerHTML=`<div class="kia-play" style="--c:${K.c}">${top}<main class="kia-pm">${body}</main></div>`;
  r.onclick=onPlayClick;
  r.oninput=e=>{const t=e.target;if(t.dataset.open!=null){const a=P.ans[t.dataset.open]||{};a.txt=t.value;P.ans[t.dataset.open]=a;saveSoon();}};
}
function introHTML(it){
  const P=it.progress,cases=it.kind==='cases',T=totals(it);
  return `<section class="kia-intro">
    <div class="kia-badge"><span class="ms">${(KINDS[it.kind]||KINDS.course).ic}</span>${cases?'Cas cliniques':'Cours interactif'}</div>
    <h1>${esc(it.title)}</h1>
    ${it.intro?`<p>${esc(it.intro)}</p>`:''}
    <div class="kia-facts"><span><span class="ms">${cases?'stethoscope':'layers'}</span>${it.steps.length} ${cases?'cas':'étapes'}</span><span><span class="ms">quiz</span>${T.n} questions</span>${it.cards&&it.cards.length?`<span><span class="ms">style</span>${it.cards.length} flashcards</span>`:''}<span><span class="ms">schedule</span>≈ ${Math.max(5,Math.round(it.steps.length*(cases?6:4)))} min</span></div>
    <ol class="kia-plan">${it.steps.map((x,i)=>`<li class="${P.stepsDone.includes(i)?'done':''}"><button data-p="go" data-s="${i}"><span class="kia-plan-n">${P.stepsDone.includes(i)?'<span class="ms">check</span>':i+1}</span><span>${esc(x.title)}</span>${x.pages?`<small>${esc(x.pages)}</small>`:''}</button></li>`).join('')}</ol>
    <div class="kia-nav"><span class="kia-flex"></span><button class="btn btn-p kia-big" data-p="go" data-s="${firstTodo(it)}">${P.stepsDone.length?'Reprendre':'Commencer'}<span class="ms">arrow_forward</span></button></div>
  </section>`;
}
function firstTodo(it){for(let i=0;i<it.steps.length;i++)if(!it.progress.stepsDone.includes(i))return i;return 0;}
function qHTML(it,s,j){
  const q=it.steps[s].qs[j],k=qKey(s,j),a=it.progress.ans[k];
  const head=`<div class="kia-q-h"><span class="kia-q-tag">${q.t==='tf'?'Vrai ou faux':q.t==='open'?'Question ouverte':'QCM'}</span>${a&&(q.t!=='open'||a.ok!=null)?`<span class="kia-q-res ${a.ok?'ok':'ko'}"><span class="ms">${a.ok?'check_circle':'cancel'}</span>${a.ok?'Juste':'Faux'}</span>`:''}</div>`;
  const why=q.why?`<div class="kia-why"><span class="ms">lightbulb</span><div>${mdHtml(q.why)}</div></div>`:'';
  if(q.t==='mcq'){
    return `<div class="kia-q${a?' answered':''}" data-k="${k}">${head}<div class="kia-q-t">${mdHtml(q.q)}</div>
      <div class="kia-opts">${q.o.map((o,i)=>{let c='';if(a){if(i===q.a)c=' right';else if(i===a.pick)c=' wrong';else c=' dim';}
        return `<button class="kia-opt${c}" data-p="ans" data-k="${k}" data-i="${i}"${a?' disabled':''}><span class="kia-opt-l">${L[i]}</span><span>${esc(o)}</span>${a&&i===q.a?'<span class="ms">check</span>':a&&i===a.pick?'<span class="ms">close</span>':''}</button>`;}).join('')}</div>
      ${a?why:''}</div>`;
  }
  if(q.t==='tf'){
    return `<div class="kia-q${a?' answered':''}" data-k="${k}">${head}<div class="kia-q-t">${mdHtml(q.q)}</div>
      <div class="kia-tf">${[true,false].map(v=>{let c='';if(a){if(v===q.a)c=' right';else if(v===a.pick)c=' wrong';else c=' dim';}
        return `<button class="kia-opt${c}" data-p="ans" data-k="${k}" data-v="${v?1:0}"${a?' disabled':''}><span class="ms">${v?'check':'close'}</span><span>${v?'Vrai':'Faux'}</span></button>`;}).join('')}</div>
      ${a?why:''}</div>`;
  }
  const shown=a&&a.shown;
  return `<div class="kia-q${a&&a.ok!=null?' answered':''}" data-k="${k}">${head}<div class="kia-q-t">${mdHtml(q.q)}</div>
    <textarea class="kia-open" data-open="${k}" rows="3" placeholder="Écris ta réponse (même quelques mots), puis compare."${a&&a.ok!=null?' disabled':''}>${esc(a&&a.txt||'')}</textarea>
    ${shown?`<div class="kia-model"><b>Réponse attendue</b>${mdHtml(q.a)}</div>${why}
      ${a.ok==null?`<div class="kia-self"><span>Tu avais trouvé ?</span><button class="btn btn-g btn-sm" data-p="self" data-k="${k}" data-v="1"><span class="ms">check</span>Oui, l’essentiel</button><button class="btn btn-g btn-sm" data-p="self" data-k="${k}" data-v="0"><span class="ms">close</span>Non</button></div>`:''}`
    :`<button class="btn btn-g btn-sm" data-p="show" data-k="${k}"><span class="ms">visibility</span>Voir la réponse</button>`}
  </div>`;
}
function stepHTML(it,s){
  const st=it.steps[s],cases=it.kind==='cases',done=stepAnswered(it,s),n=it.steps.length;
  return `<article class="kia-step">
    <div class="kia-step-k">${cases?'Cas '+(s+1):'Étape '+(s+1)}${st.pages?` · <span>${esc(st.pages)}</span>`:''}</div>
    <h1>${esc(st.title)}</h1>
    ${cases?`<div class="kia-case"><div class="kia-case-h"><span class="ms">personal_injury</span>Le patient</div><div class="kia-md">${mdHtml(st.body)}</div></div>`:`<div class="kia-md">${mdHtml(st.body)}</div>`}
    ${st.keys.length?`<div class="kia-keys"><div class="kia-keys-h"><span class="ms">push_pin</span>À retenir</div><ul>${st.keys.map(k=>`<li>${esc(k)}</li>`).join('')}</ul></div>`:''}
    ${st.qs.length?`<div class="kia-check-h"><span class="ms">quiz</span>${cases?'À toi de raisonner':'Vérifie que tu as compris'}<small>${st.qs.filter((q,j)=>it.progress.ans[qKey(s,j)]).length} / ${st.qs.length}</small></div>
      <div class="kia-qs">${st.qs.map((q,j)=>qHTML(it,s,j)).join('')}</div>`:''}
    ${st.after&&(done||!st.qs.length)?`<div class="kia-after"><div class="kia-keys-h"><span class="ms">fact_check</span>${cases?'Correction':'Pour aller plus loin'}</div><div class="kia-md">${mdHtml(st.after)}</div></div>`:''}
    <div class="kia-nav">
      <button class="btn btn-g" data-p="go" data-s="${s-1}"><span class="ms">arrow_back</span>${s?'Précédent':'Sommaire'}</button>
      <span class="kia-flex"></span>
      ${!done&&st.qs.length?`<span class="kia-left">Réponds aux questions pour valider ${cases?'le cas':'l’étape'}</span>`:''}
      <button class="btn ${done||!st.qs.length?'btn-p':'btn-g'}" data-p="next">${s+1>=n?'Terminer':cases?'Cas suivant':'Étape suivante'}<span class="ms">arrow_forward</span></button>
    </div>
  </article>`;
}
function endHTML(it){
  const P=it.progress,T=totals(it),pct=T.done?Math.round(T.ok/T.done*100):0,cases=it.kind==='cases';
  const wrong=[];it.steps.forEach((s,i)=>s.qs.forEach((q,j)=>{const a=P.ans[qKey(i,j)];if(a&&a.ok===false)wrong.push([i,j]);}));
  const mcqN=it.steps.reduce((a,s)=>a+s.qs.filter(q=>q.t!=='open').length,0);
  const R=52,C=2*Math.PI*R;
  return `<section class="kia-end">
    <div class="kia-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" class="bg"/><circle cx="60" cy="60" r="${R}" class="fg" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-pct/100)}"/></svg><div><b>${pct}%</b><small>de réussite</small></div></div>
    <h1>${pct>=80?'Excellent !':pct>=60?'Bien joué !':'C’est un bon début'}</h1>
    <p>${T.ok} bonne${T.ok>1?'s':''} réponse${T.ok>1?'s':''} sur ${T.done} · <b>${P.xp||0} XP</b> gagnés${T.done<T.n?` · ${T.n-T.done} question${T.n-T.done>1?'s':''} sans réponse`:''}</p>
    ${it.summary&&it.summary.length?`<div class="kia-keys kia-sum"><div class="kia-keys-h"><span class="ms">summarize</span>Résumé à retenir</div><ul>${it.summary.map(k=>`<li>${esc(k)}</li>`).join('')}</ul></div>`:''}
    <div class="kia-acts">
      ${wrong.length?`<button class="kia-act" data-p="retry"><span class="ms">replay</span><b>Refaire ${wrong.length>1?'mes '+wrong.length+' erreurs':'mon erreur'}</b><small>Les questions ratées, à nouveau</small></button>`:''}
      ${it.cards&&it.cards.length?`<div class="kia-act kia-act-f"><span class="ms">style</span><b>${it.cards.length} flashcards</b><small>Ajoute-les à tes révisions espacées</small>
        ${P.cardsAdded?'<span class="kia-done"><span class="ms">check</span>Ajoutées</span>':`<div class="kia-act-row"><select class="fi" id="kia-fcd">${fcFolderOptions('__new')}</select><button class="btn btn-p btn-sm" data-p="cards">Ajouter</button></div>`}</div>`:''}
      ${mcqN?`<div class="kia-act kia-act-f"><span class="ms">playlist_add</span><b>${mcqN} QCM</b><small>Ajoute-les aux QCM d’un cours pour les réviser comme les autres</small>
        ${P.qcmAdded?'<span class="kia-done"><span class="ms">check</span>Ajoutés</span>':`<div class="kia-act-row"><select class="fi" id="kia-qcd">${courseOptions(it.courseId||'')}</select><button class="btn btn-p btn-sm" data-p="qcm">Ajouter</button></div>`}</div>`:''}
    </div>
    <div class="kia-nav"><button class="btn btn-g" data-p="restart"><span class="ms">restart_alt</span>Recommencer à zéro</button><span class="kia-flex"></span><button class="btn btn-p" data-p="hub">Terminer<span class="ms">check</span></button></div>
  </section>`;
}
function go(s){
  const it=V.it;it.progress.step=Math.max(-1,Math.min(it.steps.length,s));saveSoon();renderPlay();scrollTop();
}
function completeStep(s){
  const P=V.it.progress;
  if(!P.stepsDone.includes(s)&&stepAnswered(V.it,s)){P.stepsDone.push(s);xp(3);}
}
function finish(){
  const it=V.it,P=it.progress,T=totals(it);
  const pct=T.done?Math.round(T.ok/T.done*100):0;
  if(!P.done&&P.stepsDone.length===it.steps.length){P.done=true;xp(15);}
  P.best=Math.max(P.best||0,pct);
}
function onPlayClick(e){
  const b=e.target.closest('[data-p]');if(!b||!V.it)return;
  const it=V.it,P=it.progress,a=b.dataset.p;
  if(a==='hub'){putItem(it);V.view='hub';V.it=null;renderHub();scrollTop();return;}
  if(a==='go'){go(+b.dataset.s);return;}
  if(a==='next'){const s=P.step;completeStep(s);if(s+1>=it.steps.length){P.step=it.steps.length;finish();saveSoon();renderPlay();scrollTop();}else go(s+1);return;}
  if(a==='ans'){
    const k=b.dataset.k;if(P.ans[k])return;
    const [s,j]=k.split('-').map(Number),q=it.steps[s]&&it.steps[s].qs[j];if(!q)return;
    const pickV=q.t==='tf'?b.dataset.v==='1':+b.dataset.i;
    const ok=pickV===q.a;
    P.ans[k]={pick:pickV,ok};
    if(ok)xp(2);
    if(typeof kcPlaySound==='function'){try{kcPlaySound('click',ok?1:0);}catch(_){}}
    rerenderQ(s,j);saveSoon();return;
  }
  if(a==='show'){const k=b.dataset.k,ta=document.querySelector(`[data-open="${k}"]`);const x=P.ans[k]||{};x.txt=ta?ta.value:x.txt;x.shown=true;P.ans[k]=x;const [s,j]=k.split('-').map(Number);rerenderQ(s,j);saveSoon();return;}
  if(a==='self'){const k=b.dataset.k,x=P.ans[k]||{};if(x.ok!=null)return;x.ok=b.dataset.v==='1';P.ans[k]=x;if(x.ok)xp(2);const [s,j]=k.split('-').map(Number);rerenderQ(s,j);saveSoon();return;}
  if(a==='retry'){
    Object.keys(P.ans).forEach(k=>{if(P.ans[k].ok===false){delete P.ans[k];const s=+k.split('-')[0];P.stepsDone=P.stepsDone.filter(x=>x!==s);}});
    P.done=false;go(firstTodo(it));return;
  }
  if(a==='restart'){kcConfirm('Recommencer à zéro ? Tes réponses seront effacées (les XP déjà gagnés restent).',{ok:'Recommencer'}).then(ok=>{if(!ok)return;P.ans={};P.stepsDone=[];P.done=false;go(-1);});return;}
  if(a==='cards'){const sel=$('kia-fcd');const n=addCards(it.cards,sel?sel.value:'__new',it.title);if(n){P.cardsAdded=true;saveSoon();notif(n+' flashcards ajoutées','ok');renderPlay();}return;}
  if(a==='qcm'){
    const sel=$('kia-qcd'),cid=sel&&sel.value;if(!cid){notif('Choisis le cours','err');return;}
    const list=typeof questions!=='undefined'?questions:null;if(!list){notif('Impossible','err');return;}
    let n=0;
    it.steps.forEach(s=>s.qs.forEach(q=>{
      if(q.t==='mcq'){list.push({id:newId(),courseId:cid,question:q.q,answers:q.o.slice(),correct:q.a,expl:q.why||''});n++;}
      else if(q.t==='tf'){list.push({id:newId(),courseId:cid,question:'Vrai ou faux : '+q.q,answers:['Vrai','Faux'],correct:q.a?0:1,expl:q.why||''});n++;}
    }));
    let ok=true;try{if(typeof saveAll==='function')ok=saveAll()!==false;}catch(_){}
    if(!ok){notif('Mémoire du navigateur pleine','err');return;}
    P.qcmAdded=true;saveSoon();const c=gC().find(x=>x.id===cid);notif(n+' QCM ajoutés à « '+(c?c.name:'')+' »','ok');renderPlay();return;
  }
}
function rerenderQ(s,j){
  const it=V.it,el=document.querySelector(`.kia-q[data-k="${qKey(s,j)}"]`);
  if(!el){renderPlay();return;}
  const tmp=document.createElement('div');tmp.innerHTML=qHTML(it,s,j);
  el.replaceWith(tmp.firstElementChild);
  // barre « x / n », bouton suivant, correction du cas
  const st=it.steps[s],done=stepAnswered(it,s);
  const cnt=document.querySelector('.kia-check-h small');if(cnt)cnt.textContent=st.qs.filter((q,k)=>it.progress.ans[qKey(s,k)]).length+' / '+st.qs.length;
  const xpEl=document.querySelector('.kia-xp');if(xpEl)xpEl.innerHTML='<span class="ms">bolt</span>'+(it.progress.xp||0)+' XP';
  if(done){
    const nx=document.querySelector('.kia-step [data-p="next"]');if(nx){nx.classList.remove('btn-g');nx.classList.add('btn-p');}
    const left=document.querySelector('.kia-left');if(left)left.remove();
    if(st.after&&!document.querySelector('.kia-after')){
      const d=document.createElement('div');d.className='kia-after kia-in';
      d.innerHTML=`<div class="kia-keys-h"><span class="ms">fact_check</span>${it.kind==='cases'?'Correction':'Pour aller plus loin'}</div><div class="kia-md">${mdHtml(st.after)}</div>`;
      const nav=document.querySelector('.kia-step .kia-nav');if(nav)nav.before(d);
    }
  }
}
// Clavier : 1-4 / A-D = réponse à la 1re question sans réponse ; V / F ; Entrée = suite
document.addEventListener('keydown',e=>{
  if(!isOn()||V.view!=='play'||!V.it||$('kia-dlg'))return;
  const t=e.target;if(t&&(t.tagName==='TEXTAREA'||t.tagName==='INPUT'||t.tagName==='SELECT'||t.isContentEditable))return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const q=document.querySelector('.kia-q:not(.answered)');
  const k=e.key.toLowerCase();
  if(q){
    let btn=null;
    if(/^[1-8]$/.test(k))btn=q.querySelectorAll('.kia-opt')[+k-1];
    else if(q.querySelector('.kia-tf')&&(k==='v'||k==='f'))btn=q.querySelectorAll('.kia-opt')[k==='v'?0:1];
    else if(/^[a-h]$/.test(k)&&!q.querySelector('.kia-tf'))btn=q.querySelectorAll('.kia-opt')[k.charCodeAt(0)-97];
    if(btn&&!btn.disabled){e.preventDefault();btn.click();btn.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
  }
  if(e.key==='Enter'){const nx=document.querySelector('.kia-play [data-p="next"], .kia-intro [data-p="go"].kia-big');if(nx){e.preventDefault();nx.click();}}
  if(e.key==='ArrowRight'&&V.it.progress.step>=0&&V.it.progress.step<V.it.steps.length&&stepAnswered(V.it,V.it.progress.step)){const nx=document.querySelector('.kia-play [data-p="next"]');if(nx){e.preventDefault();nx.click();}}
});

/* ───────── Branchement sur showScreen ───────── */
window.initAtelierScreen=function(){if(V.view==='play'&&V.it)renderPlay();else renderHub();};
function hook(){
  if(typeof window.showScreen!=='function'||window.showScreen._kia)return;
  const orig=window.showScreen;
  const w=function(id){
    if(id!=='atelier'&&V.it){try{putItem(V.it);}catch(e){}}
    const r=orig.apply(this,arguments);
    if(id==='atelier')window.initAtelierScreen();
    return r;
  };
  w._kia=true;Object.keys(orig).forEach(k=>{try{w[k]=orig[k];}catch(e){}});
  window.showScreen=w;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(hook,0));else setTimeout(hook,0);

window.KIA={open:window.kiaNew,relay,parseJSON,normCourse,normCards,check:(kind,t)=>check({kind},t),prompt:o=>prompt(Object.assign(defaults(o.kind),o)),getItem,idx};
})();
