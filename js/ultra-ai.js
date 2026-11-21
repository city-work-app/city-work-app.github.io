/* =========================================================
   ultra-ai.js — Apprentissage Ultra avec une vraie IA (15 nov. 2026)
   Remplace la discussion simulée d'app.js. IA = Gemini (gratuit, clé partagée, voir ai-gemini.js).
   1. Préparation : source (PDF déposé / un de mes cours = fiche + QCM / sans document), langue, méthode
      (explication guidée, socratique, résumé + quiz, questions libres), niveau. Réglages kp_ultra_*.
   2. Discussion : PDF affiché à gauche (PDF.js, pages rendues quand elles deviennent visibles), IA à droite
      en direct ; renvois [p. 4] cliquables ; blocs interactifs dans les réponses :
        ```quiz {"q","options","answer","why"}```  → question cliquable, corrigée, réponse renvoyée à l'IA (+3 XP, 60/jour max)
        ```suggestions``` (une par ligne)          → boutons de réponse rapide
        ```flashcards [{"recto","verso"}]```        → « Ajouter à mes flashcards »
      Boutons rapides (plus simple, exemple clinique, quiz, résumé, flashcards, suite), arrêter, réessayer.
   La discussion reste en mémoire tant que la page n'est pas rechargée (le PDF n'est pas stocké).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function G(name,def){try{const v=eval(name);return v===undefined?def:v;}catch(e){return def;}}
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const SS=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};

const LANGS=[['Français','fr'],['Español','es'],['English','en'],['Português','pt'],['Italiano','it'],['Deutsch','de'],['العربية','ar'],['Català','ca']];
const MODES={
  interactive:{ic:'quiz',t:'Interactif',d:'Il t’interroge sur tes points faibles, une question à la fois, et t’explique chaque erreur',
    p:'MÉTHODE « interactive » : c’est une séance de révision active. S’il y a une liste « QUESTIONS PRIORITAIRES » dans le document, commence par ces notions (ce sont celles que l’étudiant rate ou oublie le plus selon l’algorithme de répétition espacée). Pose UN quiz à la fois (reformule, ne recopie pas mot pour mot les QCM), attends la réponse, corrige en expliquant le mécanisme (pourquoi c’est juste, pourquoi les autres options sont fausses), puis enchaîne. Varie les formes (QCM, cas clinique court, question ouverte « explique-moi… »). Tous les 5 quiz, fais un mini-bilan (ce qui est acquis, ce qui reste à revoir).'},
  teach:{ic:'school',t:'Très éducatif',d:'Il t’explique tout le cours en profondeur, comme un prof, avant de vérifier',
    p:'MÉTHODE « très éducative » : tu es un professeur qui fait un vrai cours. Commence par un plan numéroté du contenu (les cours / grandes parties). Explique ensuite chaque partie en profondeur, en partant des bases : définitions, mécanismes pas à pas, schémas décrits en texte ou tableaux, moyens mnémotechniques, liens avec la pratique clinique, pièges classiques d’examen. Insiste davantage sur les notions des « QUESTIONS PRIORITAIRES » s’il y en a. Une partie par message ; termine chaque partie par UN quiz de vérification et attends la réponse avant de continuer.'},
  guided:{ic:'route',t:'Explication guidée',d:'Le cours partie par partie, avec un quiz à chaque étape',
    p:'MÉTHODE « explication guidée » : commence par un plan numéroté du cours (5 à 10 parties, avec les pages), puis explique la partie 1 clairement (définitions, mécanismes, liens avec la clinique kiné). Avance partie par partie. À la fin de chaque partie, pose UN quiz et attends la réponse de l’étudiant avant de passer à la suite.'},
  socratic:{ic:'psychology_alt',t:'Socratique',d:'L’IA te pose des questions pour que tu trouves toi-même',
    p:'MÉTHODE « socratique » : ne donne pas directement les réponses. Pose des questions courtes qui amènent l’étudiant à trouver lui-même, donne des indices progressifs, et n’explique complètement que s’il bloque après deux essais. Commence par lui demander ce qu’il sait déjà du sujet principal du document.'},
  summary:{ic:'summarize',t:'Résumé + quiz',d:'L’essentiel à retenir pour l’examen, puis 5 questions',
    p:'MÉTHODE « résumé + quiz » : fais d’abord un résumé structuré et complet de tout le document (l’essentiel pour l’examen : définitions, chiffres, classifications, pièges classiques), puis enchaîne 5 quiz, un seul par message, en attendant chaque réponse.'},
  free:{ic:'forum',t:'Questions libres',d:'Tu demandes, elle répond, sur ton cours',
    p:'MÉTHODE « questions libres » : présente le document en 3 lignes (sujet, grandes parties), puis réponds précisément aux questions de l’étudiant en t’appuyant sur le document.'}
};
const LEVELS={debutant:'débutant (explique simplement, sans jargon non défini)',inter:'intermédiaire (étudiant en kiné de 2e-3e année)',avance:'avancé (niveau examen final, précis et technique)'};
const QUICK=[
  ['Plus simple','sentiment_satisfied','Explique-moi ça plus simplement, avec une image ou une analogie.'],
  ['Exemple clinique','stethoscope','Donne-moi un exemple clinique concret en kiné (cas patient) pour ce point.'],
  ['Quiz','quiz','Pose-moi un quiz sur ce qu’on vient de voir.'],
  ['Résumé','summarize','Fais-moi un résumé court de ce qu’on a vu jusqu’ici (points clés à retenir).'],
  ['Flashcards','style','Crée-moi des flashcards sur ce qu’on vient de voir.'],
  ['Suite','arrow_forward','On passe à la suite.']
];

const U={view:'setup',src:null,contents:[],busy:false,ctrl:null,pdfOpen:true,obs:null,pdf:null,smart:false};
const set=()=>({lang:LS('kp_ultra_lang','Français'),mode:U.smart?LS('kp_smart_mode','interactive'):LS('kp_ultra_mode','guided'),level:LS('kp_ultra_level','inter')});
const PROF_TXT={kine:['kinésithérapie, physiothérapie','en kiné'],med:['médecine','en médecine'],dent:['chirurgie dentaire, odontologie','en dentaire'],veto:['médecine vétérinaire','vétérinaire'],inf:['soins infirmiers (IFSI)','en soins infirmiers'],pharma:['pharmacie','en pharmacie'],sf:['maïeutique (sage-femme)','en maïeutique'],psy:['psychologie','en psychologie'],droit:['droit','en droit'],prepa:['classes préparatoires scientifiques et école d’ingénieurs (maths, physique, chimie, SI)','en prépa'],eco:['économie, gestion et commerce','en éco-gestion'],lettres:['lettres, langues et sciences humaines','en lettres'],sciences:['sciences (biologie, chimie, physique, maths)','en sciences'],info:['informatique','en informatique'],lycee:['programme du lycée et du baccalauréat','au lycée'],autre:['ses études','dans ses études']};
const prof=()=>PROF_TXT[LS('kp_prof','kine')]||PROF_TXT.kine;

function sysPrompt(){
  const s=set(),m=MODES[s.mode]||MODES.guided;
  const pdf=U.src&&U.src.kind==='pdf';
  const P=prof();
  return `Tu es « Ultra », un professeur particulier expert en ${P[0]}${/^(kine|med|dent|veto|inf|pharma|sf|psy)$/.test(LS('kp_prof','kine'))?' et sciences de la santé (anatomie, physiologie, neurologie, biomécanique, pathologies, pharmacologie…)':''}. Tu aides un étudiant ${P[1]} à vraiment comprendre son cours.
LANGUE : réponds TOUJOURS en ${s.lang}, même si le document est dans une autre langue (traduis ; garde entre parenthèses le terme du document quand c’est utile pour l’examen).
NIVEAU : ${LEVELS[s.level]||LEVELS.inter}.
${m.p}
RÈGLES :
- Appuie-toi d’abord sur le document fourni.${pdf?' Cite les pages ainsi : [p. 4] (ou [p. 4-5]).':''} Si tu ajoutes une information qui n’est pas dans le document, signale-le par « (hors cours) ».
- Messages courts et aérés : titres ###, listes, **gras** pour les mots-clés, tableaux si utile. Une seule notion à la fois, pas de pavés.
- Donne des exemples cliniques concrets (${P[1]}) quand ça aide à comprendre.
- Pour vérifier la compréhension, utilise ce bloc (JSON valide, une seule question, 3 à 5 options, "answer" = index de la bonne option à partir de 0) :
\`\`\`quiz
{"q":"…","options":["…","…","…","…"],"answer":0,"why":"explication courte de la bonne réponse"}
\`\`\`
- Termine CHAQUE message par 2 à 4 réponses rapides que l’étudiant pourrait t’envoyer (courtes, dans la langue choisie) :
\`\`\`suggestions
…
…
\`\`\`
- Si l’étudiant demande des flashcards, donne-les dans ce bloc (8 à 15 cartes, recto court, verso précis) :
\`\`\`flashcards
[{"recto":"…","verso":"…"}]
\`\`\`
- Quand l’étudiant répond à un quiz, corrige avec bienveillance, explique pourquoi, puis continue.
- L’étudiant peut à tout moment changer sa demande (plus d’explications, plus de questions, un autre cours du dossier, une autre langue, plus simple, plus court…) : adapte-toi immédiatement, sans recommencer depuis le début.`;
}

/* ───────── Préparation ───────── */
function coursesOptions(){
  const F=(G('folders',[])||[]).filter(f=>!f.isAnnale&&f.type!=='annales'),C=G('courses',[])||[],Q=G('questions',[])||[];
  const cur=window._currentMatiereId||'';
  const qn={};Q.forEach(q=>{qn[q.courseId]=(qn[q.courseId]||0)+1;});
  const sorted=[...F].sort((a,b)=>(b.id===cur)-(a.id===cur));
  return sorted.map(f=>{const cs=C.filter(c=>c.folderId===f.id);if(!cs.length)return '';
    return `<optgroup label="${esc(f.name)}">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}${qn[c.id]?' · '+qn[c.id]+' QCM':''}</option>`).join('')}</optgroup>`;}).join('');
}
function renderSetup(){
  const root=$('ua-root');if(!root)return;
  U.view='setup';
  const s=set(),src=U.src;
  const langKnown=LANGS.some(l=>l[0]===s.lang);
  root.className='ua ua-v-setup';
  root.innerHTML=U.smart?smartSetupHTML(s,langKnown):`
  <div class="ua-setup">
    <div class="ua-hero">
      <div class="ua-badge"><span class="ms">auto_awesome</span>Apprentissage Ultra</div>
      <h1>Ton prof particulier, <em>quand tu veux</em></h1>
      <p>Envoie ton cours en PDF : l’IA te l’explique pas à pas, te pose des questions pour vérifier que tu as compris, et répond à tout, dans la langue de ton choix.</p>
    </div>
    <div class="ua-grid">
      <section class="ua-card">
        <h3><span class="ua-n">1</span>Ton cours</h3>
        ${src&&src.kind==='pdf'?`<div class="ua-file"><span class="ua-file-ic"><span class="ms">picture_as_pdf</span></span><div><b>${esc(src.name)}</b><small>${src.pages?src.pages+' page'+(src.pages>1?'s':'')+' · ':''}${(src.size/1048576).toFixed(1)} Mo${src.mode==='text'?' · texte seulement (gros fichier)':''}</small></div><button class="ib" title="Retirer" onclick="uaClearSrc()"><span class="ms">close</span></button></div>`
        :`<div class="ua-drop" id="ua-drop" role="button" tabindex="0" onclick="document.getElementById('ua-file').click()">
            <span class="ua-drop-ic"><span class="ms">upload_file</span></span>
            <b>Dépose ton cours PDF ici</b><small>ou clique pour le choisir · diapos, polycopié, article…</small>
          </div>`}
        <input type="file" id="ua-file" accept="application/pdf" hidden onchange="uaPickFile(this.files[0]);this.value=''">
        <div class="ua-or"><span>ou</span></div>
        <label class="ua-lbl" for="ua-course">Un de mes cours (fiche + QCM)</label>
        <select class="fi" id="ua-course" onchange="uaPickCourse(this.value)"><option value="">Choisir un cours…</option>${coursesOptions()}</select>
        ${src&&src.kind==='course'?`<div class="ua-file ua-file-c"><span class="ua-file-ic"><span class="ms">menu_book</span></span><div><b>${esc(src.name)}</b><small>${esc(src.info||'')}</small></div><button class="ib" title="Retirer" onclick="uaClearSrc()"><span class="ms">close</span></button></div>`:''}
      </section>
      <section class="ua-card">
        <h3><span class="ua-n">2</span>Comment tu veux apprendre</h3>
        <div class="ua-lbl">Langue de l’explication</div>
        <div class="ua-chips">${LANGS.map(([n])=>`<button class="ua-chip${s.lang===n?' on':''}" onclick="uaSet('lang','${n}')">${n}</button>`).join('')}<button class="ua-chip${langKnown?'':' on'}" onclick="uaOtherLang()">${langKnown?'Autre…':esc(s.lang)}</button></div>
        <div class="ua-lbl">Méthode</div>
        <div class="ua-modes">${Object.entries(MODES).map(([k,m])=>`<button class="ua-mode${s.mode===k?' on':''}" onclick="uaSet('mode','${k}')"><span class="ms">${m.ic}</span><b>${m.t}</b><small>${m.d}</small></button>`).join('')}</div>
        <div class="ua-lbl">Niveau</div>
        <div class="kp-seg">${[['debutant','Débutant'],['inter','Intermédiaire'],['avance','Avancé']].map(([k,t])=>`<button class="kp-seg-b${s.level===k?' active':''}" onclick="uaSet('level','${k}')">${t}</button>`).join('')}</div>
      </section>
    </div>
    <div class="ua-go-row">
      <button class="ua-aist" onclick="KAI.openKeyDialog().then(()=>uaRender())">${window.KAI&&KAI.hasKey()?'<span class="ua-dot on"></span>IA gratuite Gemini activée':'<span class="ua-dot"></span>IA gratuite à activer (2 min)'}<span class="ms">chevron_right</span></button>
      <span class="ua-flex"></span>
      <button class="btn btn-g" onclick="uaStart(true)"><span class="ms">forum</span>Sans document</button>
      <button class="btn btn-p ua-go" onclick="uaStart()"${src?'':' disabled'}>Commencer<span class="ms">arrow_forward</span></button>
    </div>
  </div>`;
  const dz=$('ua-drop');
  if(dz){
    ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over');}));
    ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,()=>dz.classList.remove('over')));
    dz.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)uaPickFile(f);});
    dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dz.click();}});
  }
  if(src&&src.kind==='course'){const sel=$('ua-course');if(sel)sel.value=src.courseId;}
}
window.uaSet=function(k,v){SS((U.smart&&k==='mode'?'kp_smart_':'kp_ultra_')+k,v);if(U.view==='setup')renderSetup();else syncBar();};

/* ───────── Révision intelligente (v63) : un dossier entier + l'algorithme d'oubli ───────── */
function folderOptions(cur){
  const F=(G('folders',[])||[]).filter(f=>!f.isAnnale&&f.type!=='annales'),C=G('courses',[])||[],SF=G('subFolders',[])||[];
  const arch=fid=>{try{return typeof isFolderArchived==='function'&&isFolderArchived(fid);}catch(e){return false;}};
  const opt=(v,t)=>`<option value="${v}"${v===cur?' selected':''}>${esc(t)}</option>`;
  let h=opt('all','Toutes mes matières (questions prioritaires)');
  [...F].sort((a,b)=>arch(a.id)-arch(b.id)).forEach(f=>{
    const n=C.filter(c=>c.folderId===f.id).length;if(!n)return;
    const sfs=SF.filter(x=>x.folderId===f.id);
    h+=`<optgroup label="${esc(f.name)}${arch(f.id)?' (terminée)':''}">`+opt('f:'+f.id,f.name+' · toute la matière · '+n+' cours')+
      sfs.map(sf=>{const k=C.filter(c=>c.subFolderId===sf.id).length;return k?opt('s:'+sf.id,'Dossier « '+sf.name+' » · '+k+' cours'):'';}).join('')+'</optgroup>';
  });
  return h;
}
function smartSetupHTML(s,langKnown){
  const src=U.src&&U.src.kind==='folder'?U.src:null;
  const order=['interactive','teach','guided','socratic','summary','free'];
  return `
  <div class="ua-setup">
    <div class="ua-hero">
      <div class="ua-badge"><span class="ms">psychology</span>Révision intelligente</div>
      <h1>Ton dossier, <em>expliqué ou en quiz</em></h1>
      <p>Choisis une matière ou un dossier : l’IA part de tes questions les plus fragiles (algorithme d’oubli), t’interroge de façon interactive ou t’explique le cours comme un prof. Tu peux lui écrire à tout moment pour changer ta demande, dans la langue que tu veux.</p>
    </div>
    <div class="ua-grid">
      <section class="ua-card">
        <h3><span class="ua-n">1</span>Ton dossier</h3>
        <label class="ua-lbl" for="ua-folder">Matière ou dossier</label>
        <select class="fi" id="ua-folder" onchange="uaPickFolder(this.value)"><option value="">Choisir…</option>${folderOptions(src?src.scope:'')}</select>
        ${src?`<div class="ua-file ua-file-c"><span class="ua-file-ic"><span class="ms">${src.scope==='all'?'apps':src.scope[0]==='f'?'school':'folder'}</span></span><div><b>${esc(src.name)}</b><small>${esc(src.info||'')}</small></div><button class="ib" title="Retirer" onclick="uaClearSrc()"><span class="ms">close</span></button></div>`:''}
        ${src&&src.prio&&src.prio.length?`<div class="ua-lbl">À retravailler en priorité</div><ul class="ua-prio">${src.prio.slice(0,4).map(x=>`<li><i style="background:${x.d==='hard'?'var(--error)':x.d==='medium'?'var(--gold,#e8930c)':'var(--on-sv)'}"></i>${esc(String(x.q.question).slice(0,90))}${x.q.question.length>90?'…':''}</li>`).join('')}</ul>`:''}
        <div class="ua-or"><span>ou</span></div>
        <div class="ua-alt">
          <button class="btn btn-g btn-sm" onclick="startSmartQCM()"><span class="ms">checklist</span>QCM classique (sans IA)</button>
          <button class="btn btn-g btn-sm" onclick="uaSmartOff()"><span class="ms">picture_as_pdf</span>Envoyer un PDF</button>
        </div>
      </section>
      <section class="ua-card">
        <h3><span class="ua-n">2</span>Comment tu veux réviser</h3>
        <div class="ua-lbl">Méthode</div>
        <div class="ua-modes">${order.map(k=>{const m=MODES[k];return `<button class="ua-mode${s.mode===k?' on':''}${k==='interactive'||k==='teach'?' ua-mode-top':''}" onclick="uaSet('mode','${k}')"><span class="ms">${m.ic}</span><b>${m.t}</b><small>${m.d}</small></button>`;}).join('')}</div>
        <div class="ua-lbl">Langue de la réponse</div>
        <div class="ua-chips">${LANGS.map(([n])=>`<button class="ua-chip${s.lang===n?' on':''}" onclick="uaSet('lang','${n}')">${n}</button>`).join('')}<button class="ua-chip${langKnown?'':' on'}" onclick="uaOtherLang()">${langKnown?'Autre…':esc(s.lang)}</button></div>
        <div class="ua-lbl">Niveau</div>
        <div class="kp-seg">${[['debutant','Débutant'],['inter','Intermédiaire'],['avance','Avancé']].map(([k,t])=>`<button class="kp-seg-b${s.level===k?' active':''}" onclick="uaSet('level','${k}')">${t}</button>`).join('')}</div>
      </section>
    </div>
    <div class="ua-go-row">
      <button class="ua-aist" onclick="KAI.openKeyDialog().then(()=>uaRender())">${window.KAI&&KAI.hasKey()?'<span class="ua-dot on"></span>IA gratuite Gemini activée':'<span class="ua-dot"></span>IA gratuite à activer (2 min)'}<span class="ms">chevron_right</span></button>
      <span class="ua-flex"></span>
      <button class="btn btn-p ua-go" onclick="uaStart()"${src?'':' disabled'}>Commencer<span class="ms">arrow_forward</span></button>
    </div>
  </div>`;
}
const MAX_DOC=260000; // ≈ 65 000 tokens : le dossier est renvoyé à chaque message (limite gratuite de Gemini par minute)
window.uaPickFolder=function(val){
  if(!val){if(U.src&&U.src.kind==='folder'){U.src=null;renderSetup();}return;}
  const F=G('folders',[])||[],SF=G('subFolders',[])||[],C=G('courses',[])||[],Q=G('questions',[])||[];
  let cs=[],name='';
  if(val==='all'){cs=C.filter(c=>{const f=F.find(x=>x.id===c.folderId);return f&&f.type!=='annales'&&!f.isAnnale&&!(typeof isFolderArchived==='function'&&isFolderArchived(f.id));});name='Toutes mes matières';}
  else if(val[0]==='f'){const f=F.find(x=>x.id===val.slice(2));if(!f)return;cs=C.filter(c=>c.folderId===f.id);name=f.name;}
  else{const sf=SF.find(x=>x.id===val.slice(2));if(!sf)return;cs=C.filter(c=>c.subFolderId===sf.id);const f=F.find(x=>x.id===sf.folderId);name=(f?f.name+' › ':'')+sf.name;}
  const ids=new Set(cs.map(c=>c.id));
  const bo=id=>{try{return typeof isBoycotted==='function'&&isBoycotted(id);}catch(e){return false;}};
  const qs=Q.filter(q=>ids.has(q.courseId)&&!bo(q.id));
  if(!qs.length){showNotif('Pas encore de questions dans '+(val==='all'?'tes matières':'ce dossier'),'err');return;}
  // Priorités : même calcul que l'ancienne révision intelligente (oubli + taux d'erreur)
  let prio=[];
  try{prio=(typeof computeSrsCandidates==='function'?computeSrsCandidates(100000):[]).filter(x=>ids.has(x.q.courseId)&&!bo(x.q.id)).slice(0,val==='all'?60:30);}catch(e){}
  prio.forEach(x=>{try{x.d=getDiff(x.q.id);}catch(e){x.d='new';}});
  const L='ABCDEFGH',cname={};cs.forEach(c=>cname[c.id]=c.name);
  const fmtQ=(q,i)=>{const ok=Array.isArray(q.correct)?q.correct:[q.correct];
    return (i+1)+'. '+q.question+'\n'+(q.answers||[]).map((a,j)=>'  '+L[j]+') '+a+(ok.includes(j)?'  ← bonne réponse':'')).join('\n')+(q.expl?'\n  Explication : '+q.expl:'');};
  let txt=(val==='all'?'RÉVISION DE TOUTES MES MATIÈRES':'DOSSIER : '+name)+' ('+cs.length+' cours, '+qs.length+' QCM)\n';
  if(prio.length)txt+='\n=== QUESTIONS PRIORITAIRES (algorithme d’oubli : ratées souvent ou pas revues depuis longtemps) ===\n'+prio.map((x,i)=>{
    const when=x.attempts===0?'jamais faite':x.daysSince>=2?'vue il y a '+Math.round(x.daysSince)+' j':'vue récemment';
    return fmtQ(x.q,i)+'\n  [cours : '+(cname[x.q.courseId]||'?')+' · '+(x.attempts?Math.round(x.errRate*100)+' % d’erreurs sur '+x.attempts+' essai'+(x.attempts>1?'s':'')+' · ':'')+when+']';
  }).join('\n\n')+'\n';
  let cut=false;
  if(val!=='all'){
    for(const c of cs){
      if(txt.length>MAX_DOC){cut=true;break;}
      let fiche='';try{const fx=typeof getFiche==='function'?getFiche(c.id):null;fiche=fx&&fx.content?String(fx.content):'';}catch(e){}
      const cq=qs.filter(q=>q.courseId===c.id);
      if(!fiche&&!cq.length)continue;
      txt+='\n\n##### COURS : '+c.name+' #####\n';
      if(fiche)txt+='--- Fiche ---\n'+fiche.slice(0,25000)+'\n';
      if(cq.length)txt+='--- QCM ('+cq.length+') ---\n'+cq.map(fmtQ).join('\n\n');
    }
    if(txt.length>MAX_DOC){txt=txt.slice(0,MAX_DOC);cut=true;}
    if(cut)txt+='\n\n(… le reste du dossier n’a pas été envoyé : il est trop long. Si l’étudiant parle d’un cours absent, dis-lui de choisir un dossier plus petit.)';
  }
  const nh=prio.filter(x=>x.d==='hard').length;
  U.pdf=null;
  U.src={kind:'folder',scope:val,name,prio,text:txt,
    info:cs.length+' cours · '+qs.length+' QCM'+(prio.length?' · '+prio.length+' prioritaires'+(nh?' dont '+nh+' difficiles':''):'')+(cut?' · dossier très long : début seulement':'')};
  renderSetup();
};
window.uaSmart=function(scope){
  U.smart=true;U._entering=true;
  if(U.view==='conv'){if(U.ctrl)U.ctrl.abort();U.view='setup';}
  U.src=null;
  if(typeof showScreen==='function')showScreen('ultra');
  U._entering=false;
  if(scope)uaPickFolder(scope);else renderSetup();
};
window.uaSmartOff=function(){U.smart=false;U.src=null;renderSetup();};
function hookSmart(){
  const cur=window.startSmartReview;
  if(cur&&cur._ua)return;
  if(typeof cur==='function'&&!window.startSmartQCM)window.startSmartQCM=cur;
  const w=function(){uaSmart();};w._ua=true;
  window.startSmartReview=w;
}
if(!window.startSmartQCM)window.startSmartQCM=function(){
  const items=typeof computeSrsCandidates==='function'?computeSrsCandidates(10):[];
  if(!items.length){showNotif('Aucune question à réviser','info');return;}
  launchS(items.map(i=>i.q),'Révision intelligente',false,false,false,false,false);
};
hookSmart();
window.addEventListener('load',hookSmart);
window.uaOtherLang=async function(){
  const v=await kcPrompt('Dans quelle langue veux-tu les explications ?',set().lang);
  if(v&&v.trim())uaSet('lang',v.trim().slice(0,30));
};
window.uaClearSrc=function(){U.src=null;U.pdf=null;renderSetup();};
window.uaPickFile=async function(f){
  if(!f)return;
  if(f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name)){showNotif('Choisis un fichier PDF','err');return;}
  if(f.size>80*1024*1024){showNotif('PDF trop gros (80 Mo max)','err');return;}
  try{
    const buf=await f.arrayBuffer();
    let pages=0;try{if(typeof pdfjsLib!=='undefined'){const d=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;pages=d.numPages;U.pdf=d;}}catch(e){U.pdf=null;}
    U.src={kind:'pdf',file:f,name:f.name,size:f.size,pages,buf,mode:f.size<=14*1024*1024?'pdf':'text'};
    renderSetup();
  }catch(e){showNotif('Impossible de lire ce PDF','err');}
};
window.uaPickCourse=function(cid){
  if(!cid){if(U.src&&U.src.kind==='course'){U.src=null;renderSetup();}return;}
  const c=(G('courses',[])||[]).find(x=>x.id===cid);if(!c)return;
  const qs=(G('questions',[])||[]).filter(q=>q.courseId===cid);
  let fiche='';try{const fx=typeof getFiche==='function'?getFiche(cid):null;fiche=fx&&fx.content?String(fx.content):'';}catch(e){}
  const L='ABCDEFGH';
  let txt='COURS : '+c.name+'\n';
  if(fiche)txt+='\n=== FICHE DE COURS ===\n'+fiche.slice(0,200000)+'\n';
  if(qs.length)txt+='\n=== QCM DU COURS ('+qs.length+') ===\n'+qs.slice(0,400).map((q,i)=>{
    const ok=Array.isArray(q.correct)?q.correct:[q.correct];
    return (i+1)+'. '+q.question+'\n'+(q.answers||[]).map((a,j)=>'  '+L[j]+') '+a+(ok.includes(j)?'  ← bonne réponse':'')).join('\n')+(q.expl?'\n  Explication : '+q.expl:'');
  }).join('\n\n');
  if(!fiche&&!qs.length){showNotif('Ce cours n’a ni fiche ni QCM : dépose plutôt le PDF','err');return;}
  U.pdf=null;
  U.src={kind:'course',courseId:cid,name:c.name,info:(fiche?'fiche + ':'')+qs.length+' QCM',text:txt};
  renderSetup();
};

/* ───────── Discussion ───────── */
window.uaStart=async function(blank){
  if(!window.KAI){showNotif('Module IA non chargé : recharge la page','err');return;}
  if(blank===true)U.src={kind:'none',name:'Discussion libre'};
  if(!U.src){showNotif('Choisis d’abord ton cours','err');return;}
  if(!(await KAI.ensureKey())){renderSetup();return;}
  U.contents=[];
  renderConv();
  let docPart=null;
  try{
    if(U.src.kind==='pdf'){
      if(U.src.mode==='pdf'){const p=await KAI.pdfPart(U.src.file);docPart=p.part;}
      else{const t=await KAI.pdfText(U.src.buf);docPart={text:'Document « '+U.src.name+' » ('+t.pages+' pages, texte extrait) :\n'+t.text};}
    }else if(U.src.kind==='course'||U.src.kind==='folder')docPart={text:U.src.text};
  }catch(e){showNotif(e.message||'Lecture du document impossible','err');}
  const intro=U.src.kind==='none'?'Bonjour ! Présente-toi en deux phrases et demande-moi sur quoi je veux travailler.':U.src.kind==='folder'?'Voici mon dossier de révision. Commence selon la méthode choisie.':'Voici mon cours. Commence.';
  const parts=docPart?[docPart,{text:intro}]:[{text:intro}];
  U.contents.push({role:'user',parts});
  addMsg('me',U.src.kind==='none'?'On commence ?':U.src.kind==='folder'?'Révision de « '+U.src.name+' » · '+(MODES[set().mode]||MODES.guided).t:'C’est parti avec « '+U.src.name+' »');
  reply();
};
window.uaBack=function(){if(U.ctrl)U.ctrl.abort();if(U.obs)U.obs.disconnect();renderSetup();};
window.uaRestart=function(){if(U.busy&&U.ctrl)U.ctrl.abort();uaStart(U.src&&U.src.kind==='none');};
window.uaTogglePdf=function(){U.pdfOpen=!U.pdfOpen;const r=$('ua-root');if(r)r.classList.toggle('ua-nopdf',!U.pdfOpen);const b=$('ua-pdfbtn');if(b)b.innerHTML=`<span class="ms">${U.pdfOpen?'right_panel_close':'menu_book'}</span>${U.pdfOpen?'Masquer le PDF':'Voir le PDF'}`;};
function syncBar(){
  const s=set(),i=$('ua-doc-info');
  if(i)i.textContent=[U.src&&U.src.pages?U.src.pages+' page'+(U.src.pages>1?'s':''):'',(MODES[s.mode]||MODES.guided).t,s.lang].filter(Boolean).join(' · ');
}
function renderConv(){
  const root=$('ua-root');if(!root)return;
  U.view='conv';
  const hasPdf=U.src&&U.src.kind==='pdf'&&U.pdf;
  const s=set();
  root.className='ua ua-v-conv'+(hasPdf?' ua-haspdf':'')+(hasPdf&&!U.pdfOpen?' ua-nopdf':'');
  root.innerHTML=`
  <header class="ua-bar">
    <button class="ib" title="Changer de cours ou de réglages" onclick="uaBack()"><span class="ms">arrow_back</span></button>
    <span class="ua-doc-ic"><span class="ms">${U.src.kind==='pdf'?'picture_as_pdf':U.src.kind==='course'?'menu_book':U.src.kind==='folder'?'psychology':'forum'}</span></span>
    <div class="ua-doc"><b>${esc(U.src.name)}</b><small id="ua-doc-info"></small></div>
    <span class="ua-flex"></span>
    <select class="ua-mini" aria-label="Méthode" title="Changer de méthode (s’applique au prochain message)" onchange="uaSet('mode',this.value);uaModeSwitched(this.value)">${Object.entries(MODES).map(([k,m])=>`<option value="${k}"${k===s.mode?' selected':''}>${esc(m.t)}</option>`).join('')}</select>
    <select class="ua-mini" aria-label="Langue" onchange="uaSet('lang',this.value)">${[...new Set([s.lang,...LANGS.map(l=>l[0])])].map(n=>`<option${n===s.lang?' selected':''}>${esc(n)}</option>`).join('')}</select>
    ${hasPdf?`<button class="btn btn-g btn-sm" id="ua-pdfbtn" onclick="uaTogglePdf()"><span class="ms">${U.pdfOpen?'right_panel_close':'menu_book'}</span>${U.pdfOpen?'Masquer le PDF':'Voir le PDF'}</button>`:''}
    <button class="ib" title="Recommencer la discussion" onclick="uaRestart()"><span class="ms">restart_alt</span></button>
  </header>
  <div class="ua-body">
    ${hasPdf?`<aside class="ua-pdf" id="ua-pdf" aria-label="Ton cours"></aside>`:''}
    <section class="ua-chat">
      <div class="ua-thread" id="ua-thread" aria-live="polite"></div>
      <div class="ua-quick" id="ua-quick">${QUICK.map(([t,ic,m],i)=>`<button class="ua-qb" onclick="uaQuick(${i})"><span class="ms">${ic}</span>${t}</button>`).join('')}</div>
      <div class="ua-composer">
        <textarea id="ua-input" rows="1" placeholder="Pose une question, réponds à l’IA…" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,160)+'px'" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();uaSend();}"></textarea>
        <button class="ua-send" id="ua-send" onclick="uaSend()" aria-label="Envoyer"><span class="ms">arrow_upward</span></button>
      </div>
      <p class="ua-hint">Entrée pour envoyer · Maj + Entrée pour aller à la ligne · l’IA peut se tromper : vérifie avec ton cours</p>
    </section>
  </div>`;
  syncBar();
  if(hasPdf)buildPdf();
}

/* PDF à gauche */
function buildPdf(){
  const box=$('ua-pdf'),pdf=U.pdf;if(!box||!pdf)return;
  box.innerHTML='';
  if(U.obs)U.obs.disconnect();
  U.obs=new IntersectionObserver(ents=>ents.forEach(en=>{if(en.isIntersecting)renderPage(en.target);}),{root:box,rootMargin:'600px 0px'});
  pdf.getPage(1).then(p1=>{
    const vp=p1.getViewport({scale:1}),ratio=vp.height/vp.width;
    for(let i=1;i<=pdf.numPages;i++){
      const d=document.createElement('div');d.className='ua-page';d.dataset.p=i;
      d.innerHTML=`<div class="ua-page-h"><span>Page ${i}</span><button class="ua-page-x" onclick="uaExplainPage(${i})"><span class="ms">auto_awesome</span>Explique cette page</button></div><div class="ua-page-c" style="aspect-ratio:${(1/ratio).toFixed(4)}"></div>`;
      box.appendChild(d);U.obs.observe(d);
    }
  });
}
async function renderPage(el){
  if(el.dataset.done)return;el.dataset.done='1';
  try{
    const p=await U.pdf.getPage(+el.dataset.p),c=el.querySelector('.ua-page-c');
    const w=c.clientWidth||400,vp0=p.getViewport({scale:1}),sc=w/vp0.width,dpr=Math.min(2,window.devicePixelRatio||1);
    const vp=p.getViewport({scale:sc*dpr}),cv=document.createElement('canvas');
    cv.width=vp.width;cv.height=vp.height;cv.style.width='100%';
    await p.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
    c.appendChild(cv);
  }catch(e){el.dataset.done='';}
}
window.uaGoPage=function(n){
  if(!U.pdfOpen)uaTogglePdf();
  const el=document.querySelector(`#ua-pdf .ua-page[data-p="${n}"]`);
  if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.remove('ua-flash');void el.offsetWidth;el.classList.add('ua-flash');}
};
window.uaExplainPage=function(n){sendText('Explique-moi en détail la page '+n+' du cours.');};

/* Messages */
function thread(){return $('ua-thread');}
function scrollEnd(force){const t=thread();if(!t)return;if(force||t.scrollHeight-t.scrollTop-t.clientHeight<160)t.scrollTop=t.scrollHeight;}
function addMsg(who,text){
  const t=thread();if(!t)return null;
  const m=document.createElement('div');m.className='ua-msg ua-'+who;
  m.innerHTML=who==='ai'?`<span class="ua-av"><span class="ms">auto_awesome</span></span><div class="ua-bub"></div>`:`<div class="ua-bub">${esc(text).replace(/\n/g,'<br>')}</div>`;
  t.appendChild(m);scrollEnd(true);
  return m;
}
const SPECIAL=/```(quiz|suggestions|flashcards)\s*\n([\s\S]*?)```/g;
function pageRefs(html){
  if(!(U.src&&U.src.kind==='pdf'&&U.pdf))return html;
  return html.replace(/\[(?:p\.|pp?\.|page|pág\.|pag\.)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\]/gi,(all,a,b)=>`<button class="ua-pref" onclick="uaGoPage(${a})"><span class="ms">description</span>p. ${a}${b?'–'+b:''}</button>`);
}
function renderAI(m,text,final){
  const bub=m.querySelector('.ua-bub');if(!bub)return;
  const blocks=[];
  let body=text.replace(SPECIAL,(all,kind,inner)=>{blocks.push({kind,inner:inner.trim()});return '\n\n%%UA'+(blocks.length-1)+'%%\n\n';});
  let pending='';
  const open=body.match(/```(quiz|suggestions|flashcards)[\s\S]*$/);
  if(open){body=body.slice(0,open.index);pending=open[1];}
  let html=pageRefs(KAI.md(body));
  html=html.replace(/<p>%%UA(\d+)%%<\/p>|%%UA(\d+)%%/g,(all,a,b)=>{const bl=blocks[+(a||b)];return bl&&bl.kind!=='suggestions'?blockHTML(bl,final):'';});
  if(pending&&pending!=='suggestions')html+=`<div class="ua-prep"><span class="ms">hourglass_top</span>${pending==='quiz'?'Préparation d’une question…':'Préparation des flashcards…'}</div>`;
  bub.innerHTML=html||'<div class="ua-typing"><i></i><i></i><i></i></div>';
  if(final){
    const sg=blocks.filter(b=>b.kind==='suggestions').map(b=>b.inner.split('\n').map(x=>x.replace(/^[-*•\d.)\s]+/,'').trim()).filter(Boolean)).flat().slice(0,4);
    document.querySelectorAll('#ua-thread .ua-sugg').forEach(x=>x.remove());
    if(sg.length){const d=document.createElement('div');d.className='ua-sugg';d.innerHTML=sg.map(x=>`<button>${esc(x)}</button>`).join('');d.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>sendText(sg[i]));m.appendChild(d);}
    m.querySelectorAll('.ua-quiz').forEach(bindQuiz);
    m.querySelectorAll('.ua-fcs').forEach(bindFcs);
  }
}
function parseJSON(s){try{return JSON.parse(s);}catch(e){const m=s.match(/[\[{][\s\S]*[\]}]/);if(m){try{return JSON.parse(m[0]);}catch(e2){}}return null;}}
function blockHTML(bl,final){
  const j=parseJSON(bl.inner);
  if(bl.kind==='quiz'){
    if(!j||!j.q||!Array.isArray(j.options))return '';
    const L='ABCDEFGH';
    return `<div class="ua-quiz" data-a="${+j.answer||0}" data-why="${esc(j.why||'')}">
      <div class="ua-quiz-h"><span class="ms">quiz</span>Question</div>
      <div class="ua-quiz-q">${pageRefs(KAI.md(j.q).replace(/^<p>|<\/p>$/g,''))}</div>
      <div class="ua-quiz-o">${j.options.map((o,i)=>`<button data-i="${i}"${final?'':' disabled'}><span class="l">${L[i]}</span><span class="t">${esc(o)}</span></button>`).join('')}</div>
      <div class="ua-quiz-why" hidden></div></div>`;
  }
  if(bl.kind==='flashcards'){
    const arr=Array.isArray(j)?j.filter(x=>x&&(x.recto||x.term)&&(x.verso||x.definition)):[];
    if(!arr.length)return '';
    const cf=G('conceptFolders',[])||[];
    return `<div class="ua-fcs" data-cards="${esc(JSON.stringify(arr.map(x=>({r:String(x.recto||x.term),v:String(x.verso||x.definition)}))))}">
      <div class="ua-quiz-h"><span class="ms">style</span>${arr.length} flashcards</div>
      <div class="ua-fcs-l">${arr.slice(0,30).map(x=>`<div><b>${esc(x.recto||x.term)}</b><span>${esc(x.verso||x.definition)}</span></div>`).join('')}</div>
      <div class="ua-fcs-b"><select class="fi" aria-label="Dossier"><option value="__new">Nouveau dossier « ${esc((U.src&&U.src.name||'Ultra').slice(0,40))} »</option>${cf.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}<option value="">Sans dossier</option></select><button class="btn btn-p btn-sm"${final?'':' disabled'}><span class="ms">add</span>Ajouter à mes flashcards</button></div></div>`;
  }
  return '';
}
function bindQuiz(q){
  if(q.dataset.bound)return;q.dataset.bound='1';
  const ans=+q.dataset.a;
  q.querySelectorAll('.ua-quiz-o button').forEach(b=>{
    b.disabled=false;
    b.onclick=()=>{
      if(q.dataset.done)return;q.dataset.done='1';
      const i=+b.dataset.i,ok=i===ans,btns=q.querySelectorAll('.ua-quiz-o button');
      btns.forEach(x=>{x.disabled=true;const k=+x.dataset.i;if(k===ans)x.classList.add('ok');else if(k===i)x.classList.add('ko');});
      const w=q.querySelector('.ua-quiz-why');
      if(w){w.hidden=false;w.className='ua-quiz-why '+(ok?'ok':'ko');w.innerHTML=`<b>${ok?'Bonne réponse !':'Pas tout à fait.'}</b> ${esc(q.dataset.why||'')}`;}
      if(ok)xp();
      const tx=t=>t.querySelector('.t').textContent;
      setTimeout(()=>sendText(ok?`J’ai répondu « ${tx(b)} » : c’est juste ✓`:`J’ai répondu « ${tx(b)} », mais la bonne réponse était « ${tx(btns[ans])} » ✗`),700);
    };
  });
}
function xp(){
  try{
    const k='kp_ultra_xp_'+new Date().toISOString().slice(0,10),n=+LS(k,'0');
    if(n>=60||typeof gamAward!=='function')return;
    gamAward(3,'bonus');SS(k,String(n+3));
  }catch(e){}
}
function bindFcs(box){
  if(box.dataset.bound)return;box.dataset.bound='1';
  const btn=box.querySelector('button'),sel=box.querySelector('select');
  btn.disabled=false;
  btn.onclick=()=>{
    const cards=parseJSON(box.dataset.cards)||[];
    const list=G('concepts',null),cf=G('conceptFolders',null);
    if(!list||!cards.length){showNotif('Impossible d’ajouter les cartes','err');return;}
    let fid=sel.value||null;
    if(fid==='__new'&&cf){fid=(typeof uid==='function'?uid():Date.now().toString(36));cf.push({id:fid,name:(U.src&&U.src.name||'Apprentissage Ultra').replace(/\.pdf$/i,'').slice(0,60),color:'#8B5CF6'});}
    const now=new Date().toISOString();
    cards.forEach(x=>list.push({id:typeof uid==='function'?uid():Math.random().toString(36).slice(2),term:x.r,questionId:null,state:'toExplain',definition:x.v,keywords:[],masteryLevel:0,nextReview:null,lastReview:null,createdAt:now,folderId:fid}));
    try{saveAll();}catch(e){}
    btn.disabled=true;sel.disabled=true;btn.innerHTML='<span class="ms">check</span>Ajoutées';
    showNotif(cards.length+' flashcards ajoutées','ok');
  };
}
window.uaModeSwitched=function(k){const m=MODES[k];if(m&&!U.busy)sendText('Change de méthode : passe en mode « '+m.t+' » à partir de maintenant.');};
window.uaQuick=function(i){const q=QUICK[i];if(q)sendText(q[2]);};
window.uaSend=function(){
  const ta=$('ua-input');if(!ta)return;
  if(U.busy){if(U.ctrl)U.ctrl.abort();return;}
  const t=ta.value.trim();if(!t)return;
  ta.value='';ta.style.height='auto';
  sendText(t);
};
function sendText(t){
  if(U.busy)return;
  document.querySelectorAll('#ua-thread .ua-sugg').forEach(x=>x.remove());
  addMsg('me',t);
  U.contents.push({role:'user',parts:[{text:t}]});
  reply();
}
function setBusy(b){
  U.busy=b;
  const s=$('ua-send');if(s){s.classList.toggle('stop',b);s.innerHTML=`<span class="ms">${b?'stop':'arrow_upward'}</span>`;s.setAttribute('aria-label',b?'Arrêter':'Envoyer');}
  document.querySelectorAll('#ua-quick button').forEach(x=>x.disabled=b);
}
async function reply(){
  const m=addMsg('ai');if(!m)return;
  m.querySelector('.ua-bub').innerHTML='<div class="ua-typing"><i></i><i></i><i></i></div>';
  setBusy(true);
  U.ctrl=new AbortController();
  let raf=0,last='';
  try{
    const full=await KAI.stream({system:sysPrompt(),contents:U.contents,signal:U.ctrl.signal,temperature:.55,
      onText:t=>{last=t;if(!raf)raf=requestAnimationFrame(()=>{raf=0;renderAI(m,last,false);scrollEnd();});},
      onStatus:t=>{const ty=m.querySelector('.ua-typing');if(!ty)return;let st=m.querySelector('.ua-status');if(!t){if(st)st.remove();return;}if(!st){st=document.createElement('div');st.className='ua-status';ty.after(st);}st.textContent=t;}});
    if(raf)cancelAnimationFrame(raf);
    U.contents.push({role:'model',parts:[{text:full}]});
    renderAI(m,full,true);scrollEnd();
  }catch(e){
    if(raf)cancelAnimationFrame(raf);
    if(e&&e.name==='AbortError'){
      if(last){U.contents.push({role:'model',parts:[{text:last}]});renderAI(m,last+'\n\n*(réponse arrêtée)*',true);}
      else{m.remove();U.contents.pop();}
    }else{
      if(last)renderAI(m,last,true);
      const bub=m.querySelector('.ua-bub');
      const err=document.createElement('div');err.className='ua-err';
      /* v71 : si Google est surchargé, on propose aussi l'Atelier IA (copier-coller vers ChatGPT / Gemini / Claude, sans clé) */
      const alt=(e.kind==='busy'||e.kind==='rate'||e.kind==='daily')?'<button class="btn btn-g btn-sm ua-alt" type="button"><span class="ms">content_paste</span>Avec ChatGPT (copier-coller)</button>':'';
      err.innerHTML=`<span class="ms">error</span><span>${esc(e.message||'Erreur')}</span>${e.kind==='key'?'<button class="btn btn-g btn-sm">Changer la clé</button>':'<button class="btn btn-g btn-sm">Réessayer</button>'}${alt}`;
      (last?m:bub).appendChild(err);if(!last){bub.querySelector('.ua-typing')&&bub.querySelector('.ua-typing').remove();bub.querySelector('.ua-status')&&bub.querySelector('.ua-status').remove();}
      const ab=err.querySelector('.ua-alt');if(ab)ab.onclick=()=>{if(typeof showScreen==='function')showScreen('atelier');};
      err.querySelector('button').onclick=()=>{m.remove();if(e.kind==='key')KAI.openKeyDialog().then(ok=>{if(ok)reply();});else reply();};
    }
  }finally{U.ctrl=null;setBusy(false);}
}

/* ───────── Entrée ───────── */
window.initUltraScreen=function(){
  const root=$('ua-root');if(!root)return;
  if(U._entering)U._entering=false;
  else if(U.view!=='conv'&&U.smart){U.smart=false;if(U.src&&U.src.kind==='folder')U.src=null;} // arrivée par Outils → Apprentissage Ultra normal
  if(U.view==='conv'&&U.src&&thread())return; // on reprend la discussion en cours
  renderSetup();
};
window.uaRender=function(){if(U.view==='setup')renderSetup();};
// anciens noms (boutons éventuels)
window.ultraReset=function(){U.src=null;renderSetup();};
})();
