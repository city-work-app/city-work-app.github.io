// ── data.js — état global, localStorage, uid()

// ── lz-string 1.5.0 (© 2013 Pieroxy, licence MIT — github.com/pieroxy/lz-string) ──
// Copie locale (marche hors ligne et en file://) : compresse les grosses données de localStorage (voir lsRaw / lsSet).
var LZString=function(){var r=String.fromCharCode,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",e={};function t(r,o){if(!e[r]){e[r]={};for(var n=0;n<r.length;n++)e[r][r.charAt(n)]=n}return e[r][o]}var i={compressToBase64:function(r){if(null==r)return"";var n=i._compress(r,6,function(r){return o.charAt(r)});switch(n.length%4){default:case 0:return n;case 1:return n+"===";case 2:return n+"==";case 3:return n+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(n){return t(o,r.charAt(n))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(r){return null==r?"":""==r?null:i._decompress(r.length,16384,function(o){return r.charCodeAt(o)-32})},compressToUint8Array:function(r){for(var o=i.compress(r),n=new Uint8Array(2*o.length),e=0,t=o.length;e<t;e++){var s=o.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null==o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;e<t;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(r){return null==r?"":i._compress(r,6,function(r){return n.charAt(r)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(o){return t(n,r.charAt(o))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(r,o,n){if(null==r)return"";var e,t,i,s={},u={},a="",p="",c="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<r.length;i+=1)if(a=r.charAt(i),Object.prototype.hasOwnProperty.call(s,a)||(s[a]=f++,u[a]=!0),p=c+a,Object.prototype.hasOwnProperty.call(s,p))c=p;else{if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++),s[p]=f++,c=String(a)}if(""!==c){if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==o-1){d.push(n(m));break}v++}return d.join("")},decompress:function(r){return null==r?"":""==r?null:i._decompress(r.length,32768,function(o){return r.charCodeAt(o)})},_decompress:function(o,n,e){var t,i,s,u,a,p,c,l=[],f=4,h=4,d=3,m="",v=[],g={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)l[t]=t;for(s=0,a=Math.pow(2,2),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 2:return""}for(l[3]=c,i=c,v.push(c);;){if(g.index>o)return"";for(s=0,a=Math.pow(2,d),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(c=s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 2:return v.join("")}if(0==f&&(f=Math.pow(2,d),d++),l[c])m=l[c];else{if(c!==h)return null;m=i+i.charAt(0)}v.push(m),l[h++]=i+m.charAt(0),i=m,0==--f&&(f=Math.pow(2,d),d++)}}};return i}();

// ════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════
const KF='kcu_f',KC='kcu_c',KQ='kcu_q',KS='kcu_s',KD='kcu_diff',KG='kcu_goal',KSF='kcu_sf',KB='kcu_boycott',KConcepts='kcu_concepts',KPrompts='kcu_prompts',KFiches='kcu_fiches',KQStats='kcu_qstats',KBrainDumps='kcu_bd',KKeyConcepts='kcu_kc',KPartiels='kcu_partiels',KPG='kcu_pg',KFav='kcu_fav',KConceptFolders='kcu_cfol',KWeeklyH='kcu_weekly_h',KArchived='kcu_archived',KFCSpaced='kcu_fc_spaced',KSessionHistory='kcu_sh';
// ── Stockage compressé (ajout 8 nov. 2026) ──
// localStorage est limité (~5 Mo Safari, ~10 Mo Chrome). Quand il est plein, plus rien ne s'enregistre
// (ex. : « Importer » ne faisait rien). Les grosses listes qui changent rarement sont donc stockées
// compressées (≈ 6× plus petites). ls() lit les deux formats : l'ancien JSON brut reste lisible.
const LZ_MARK='\u0001LZ1:';
const LZ_KEYS=new Set(['kcu_q','kcu_fiches','kcu_flashcards','kcu_concepts','kcu_partiels','kcu_bd','kcu_kc','kcu_prompts','kcu_sh']);
const _lzCache={};  // clé → {raw, packed} : évite de recompresser à chaque saveAll()
const _lsBroken={}; // clés illisibles : jamais réécrites, pour ne pas détruire la donnée
function lsRaw(k){  // texte JSON stocké (décompressé si besoin), ou null
  const v=localStorage.getItem(k);
  if(v==null||v.indexOf(LZ_MARK)!==0)return v;
  let out=null;
  try{out=LZString.decompressFromUTF16(v.slice(LZ_MARK.length));}catch(e){}
  if(!out){_lsBroken[k]=true;console.error('[Kiné+] Donnée illisible, laissée intacte :',k);return null;}
  _lzCache[k]={raw:out,packed:v};
  return out;
}
function lsSet(k,raw){ // écrit une valeur (compressée si utile) — peut lever QuotaExceededError
  if(_lsBroken[k]){const e=new Error('donnée illisible laissée intacte ('+k+')');e.name='KineProtected';throw e;}
  let v=raw;
  if(LZ_KEYS.has(k)&&raw.length>4096&&!(window.KStore&&KStore.ok)){   /* grande mémoire (kstore.js) : plus besoin de compresser */
    const c=_lzCache[k];
    if(c&&c.raw===raw)v=c.packed;
    else{
      try{
        const p=LZ_MARK+LZString.compressToUTF16(raw);
        // gardée seulement si vraiment plus petite ET relue à l'identique
        if(p.length*2<raw.length&&LZString.decompressFromUTF16(p.slice(LZ_MARK.length))===raw)v=p;
      }catch(e){}
      _lzCache[k]={raw,packed:v};
    }
  }
  localStorage.setItem(k,v);
}
function ls(k,d){try{const v=lsRaw(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
// ── Images des flashcards rangées à part (16 nov. 2026) ──
// Avec la grande mémoire (kstore.js), chaque image (imageQ / imageA / image…) est écrite une seule fois sous sa propre clé
// `kimg_<id>` ; la liste des cartes ne garde que « kimg:<id> ». En mémoire rien ne change : les cartes ont leur image complète.
const _imgIds=new Map(); // image (data:…) → id
function _imgPack(list){
  if(!(window.KStore&&KStore.ok))return JSON.stringify(list);
  return JSON.stringify(list,function(key,val){
    if(typeof val==='string'&&val.length>3000&&key.lastIndexOf('image',0)===0&&val.lastIndexOf('data:',0)===0){
      let id=_imgIds.get(val);
      if(!id){id=uid();localStorage.setItem('kimg_'+id,val);_imgIds.set(val,id);}
      return 'kimg:'+id;
    }
    return val;
  });
}
function _imgUnpack(list){
  (function walk(o){
    if(!o||typeof o!=='object')return;
    for(const k in o){const v=o[k];
      if(typeof v==='string'){if(v.lastIndexOf('kimg:',0)===0){const id=v.slice(5),d=localStorage.getItem('kimg_'+id);if(d){o[k]=d;_imgIds.set(d,id);}else o[k]='';}}
      else if(v&&typeof v==='object')walk(v);}
  })(list);
  return list;
}
function _imgSweep(){ // supprime les images qui ne servent plus à aucune carte (appelé longtemps après le démarrage)
  if(!(window.KStore&&KStore.ok))return;
  try{
    const keys=KStore.keys().filter(k=>k.lastIndexOf('kimg_',0)===0);if(!keys.length)return;
    if(_lsBroken[KConcepts]||_lsBroken[KFlashcards]||(!concepts.length&&!flashcards.length))return; // dans le doute, on ne touche à rien
    const used=new Set();
    (function walk(o){if(!o||typeof o!=='object')return;for(const k in o){const v=o[k];if(typeof v==='string'){if(v.length>3000){const id=_imgIds.get(v);if(id)used.add(id);}}else if(v&&typeof v==='object')walk(v);}})([concepts,flashcards]);
    keys.forEach(k=>{if(!used.has(k.slice(5)))localStorage.removeItem(k);});
  }catch(e){}
}
setTimeout(_imgSweep,45000);

let folders=ls(KF,[]);
let subFolders=ls(KSF,[]); // {id, folderId, name}
let courses=ls(KC,[]);      // courses now have optional subFolderId (null = direct child of matiere)
let questions=ls(KQ,[]);
let stats=ls(KS,{streak:0,lastDate:'',sessions:0,totalAnswered:0,totalCorrect:0,weekly:[0,0,0,0,0,0,0],todayQ:0,todayDate:'',todaySecs:0});
let diffData=ls(KD,{});
let dailyGoal=ls(KG,10);
let boycottedQuestions=ls(KB,{});
let archivedFolders=ls(KArchived,{});
let favoritedQuestions=ls(KFav,{});
let bestSurvivalStreak=ls('kcu_best_survival',0);
let concepts=_imgUnpack(ls(KConcepts,[]));
let conceptFolders=ls(KConceptFolders,[]);
const SRS_DAYS=[1,4,10,21,45,90];
const KFlashcards='kcu_flashcards';
let flashcards=_imgUnpack(ls(KFlashcards,[]));
let prompts=ls(KPrompts,[]);
let fiches=ls(KFiches,[]);
let questionStats=ls(KQStats,{});
let brainDumps=ls(KBrainDumps,[]);
let keyConcepts=ls(KKeyConcepts,{});
let partiels=ls(KPartiels,[]);
let partielGroups=ls(KPG,[]);
let weeklyHistory=ls(KWeeklyH,{});
let fcSpacedData=ls(KFCSpaced,{});
let sessionHistory=ls(KSessionHistory,[]);

// ── Stockage journalier simple (indestructible) ──
// kcu_daily : { "2026-06-15": 60, "2026-06-14": 45, ... }
const KDaily='kcu_daily';
let dailyCounts=ls(KDaily,{});

// Backfill depuis sessionHistory au cas où dailyCounts est vide
(function backfillDaily(){
  if(!sessionHistory||!sessionHistory.length)return;
  let changed=false;
  sessionHistory.forEach(s=>{
    if(!s.date||!s.total)return;
    if(!dailyCounts[s.date]){dailyCounts[s.date]=0;changed=true;}
  });
  // Recalcule depuis zéro (session par session, cumule par date)
  const rebuilt={};
  sessionHistory.forEach(s=>{if(s.date&&s.total)rebuilt[s.date]=(rebuilt[s.date]||0)+s.total;});
  Object.entries(rebuilt).forEach(([d,v])=>{
    if(!dailyCounts[d]||dailyCounts[d]<v){dailyCounts[d]=v;changed=true;}
  });
  if(changed)localStorage.setItem(KDaily,JSON.stringify(dailyCounts));
})();

function addDailyQ(n){
  const today=new Date().toISOString().split('T')[0];
  dailyCounts[today]=(dailyCounts[today]||0)+n;
  localStorage.setItem(KDaily,JSON.stringify(dailyCounts));
}

// Retourne le tableau [Lun,Mar,Mer,Jeu,Ven,Sam,Dim] pour la semaine contenant la date de base + weekOffset semaines
function getDailyWeek(weekOffset){
  const now=new Date();
  const day=now.getDay(); // 0=Sun
  const diff=(day===0?-6:1-day); // décalage vers lundi
  const monday=new Date(now);
  monday.setDate(now.getDate()+diff+((weekOffset||0)*7));
  const result=[];
  for(let i=0;i<7;i++){
    const d=new Date(monday);
    d.setDate(monday.getDate()+i);
    const key=d.toISOString().split('T')[0];
    result.push(dailyCounts[key]||0);
  }
  return result;
}

function getMondayOfWeek(weekOffset){
  const now=new Date();
  const day=now.getDay();
  const diff=(day===0?-6:1-day);
  const monday=new Date(now);
  monday.setDate(now.getDate()+diff+((weekOffset||0)*7));
  return monday;
}

// Returns the Monday date string (YYYY-MM-DD) for the week containing `date`, shifted by `weekOffset` weeks
function getWeekKey(date,weekOffset){
  const d=new Date(date);
  const day=d.getDay(); // 0=Sun
  const diff=(day===0?-6:1-day);
  d.setDate(d.getDate()+diff+(weekOffset||0)*7);
  return d.toISOString().slice(0,10);
}
// JS getDay() → Monday-indexed (Mon=0…Sun=6)
const JS_TO_MON=[6,0,1,2,3,4,5];
function addWeeklyQ(n){
  const key=getWeekKey(new Date(),0);
  if(!weeklyHistory[key])weeklyHistory[key]=[0,0,0,0,0,0,0];
  const idx=JS_TO_MON[new Date().getDay()];
  weeklyHistory[key][idx]=(weeklyHistory[key][idx]||0)+n;
}

// Réinitialisation propre : l'ancien système accumulait tout-temps dans stats.weekly
// ce qui polluait la semaine courante. On repart de zéro sur weeklyHistory (v2).
(function cleanWeeklyHistory(){
  if(localStorage.getItem('kcu_wh_v')!=='2'){
    weeklyHistory={};
    localStorage.setItem(KWeeklyH,'{}');
    localStorage.setItem('kcu_wh_v','2');
  }
})();

// ── Reconstruction de weeklyHistory depuis sessionHistory ──
// Comble les jours manquants si addWeeklyQ n'avait pas encore été branché.
(function backfillWeeklyHistory(){
  if(!sessionHistory||!sessionHistory.length) return;
  let changed=false;
  sessionHistory.forEach(s=>{
    if(!s.date||!s.total) return;
    const d=new Date(s.date+'T12:00:00'); // midi pour éviter décalage TZ
    const wKey=getWeekKey(d,0);
    const dayIdx=JS_TO_MON[d.getDay()];
    if(!weeklyHistory[wKey]) weeklyHistory[wKey]=[0,0,0,0,0,0,0];
    // On stocke le max pour éviter les doublons si addWeeklyQ a déjà tourné
    // On accumule seulement si la valeur courante < total de la session
    // Approche : on recompute tout proprement depuis sessionHistory pour chaque semaine
    changed=true;
  });
  if(!changed) return;
  // Recalculer chaque semaine depuis zéro à partir de sessionHistory
  const rebuilt={};
  sessionHistory.forEach(s=>{
    if(!s.date||!s.total) return;
    const d=new Date(s.date+'T12:00:00');
    const wKey=getWeekKey(d,0);
    const dayIdx=JS_TO_MON[d.getDay()];
    if(!rebuilt[wKey]) rebuilt[wKey]=[0,0,0,0,0,0,0];
    rebuilt[wKey][dayIdx]+=s.total;
  });
  // Fusionner : pour chaque semaine, prendre le max entre ce qu'on a et ce qu'on reconstruit
  Object.entries(rebuilt).forEach(([wk,arr])=>{
    if(!weeklyHistory[wk]){weeklyHistory[wk]=arr;}
    else{arr.forEach((v,i)=>{weeklyHistory[wk][i]=Math.max(weeklyHistory[wk][i]||0,v);});}
  });
  try{localStorage.setItem(KWeeklyH,JSON.stringify(weeklyHistory));}catch(e){} // mémoire pleine : ne pas bloquer le chargement
})();

// saveAll() renvoie true si tout est enregistré, false sinon (erreur dans window._kineSaveError).
// saveAll({quiet:true}) = sans notification (l'appelant affiche son propre message).
let _saveErrAt=0;
function _isQuotaErr(e){return !!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014);}
function saveAll(opts){
  if(window._kpImporting)return true; /* import en cours : ne rien écraser */
  /* Annuler une suppression : si une liste a rétréci depuis le dernier enregistrement, on garde l'état d'avant
     (le texte encore en mémoire de stockage) et on propose « Annuler » (kc-polish.js → kcUndoOffer). */
  let undo=null;
  if(!(opts&&opts.noUndo)){
    const now=_undoCount();
    if(_undoLens&&now.some((n,i)=>n<_undoLens[i])){
      undo={before:_undoLens.slice(),after:now,raw:{}};
      _UNDO_K.forEach(k=>{try{undo.raw[k]=lsRaw(k);}catch(e){}});
    }
  }
  const items=[
    [KF,folders],[KSF,subFolders],[KC,courses],[KQ,questions],[KS,stats],[KD,diffData],
    [KG,dailyGoal,1],[KB,boycottedQuestions],[KArchived,archivedFolders],[KFav,favoritedQuestions],
    ['kcu_best_survival',bestSurvivalStreak,1],[KConcepts,concepts],[KConceptFolders,conceptFolders],
    [KFlashcards,flashcards],[KPrompts,prompts],[KFiches,fiches],[KQStats,questionStats],
    [KBrainDumps,brainDumps],[KKeyConcepts,keyConcepts],[KPartiels,partiels],[KPG,partielGroups],
    [KWeeklyH,weeklyHistory],[KFCSpaced,fcSpacedData],[KSessionHistory,sessionHistory]
  ];
  let err=null;
  // une clé qui échoue n'empêche plus d'enregistrer les suivantes
  for(const [k,val,plain] of items){
    try{lsSet(k,plain?String(val):(k===KConcepts||k===KFlashcards)?_imgPack(val):JSON.stringify(val));}catch(e){if(!err)err=e;}
  }
  window._kineSaveError=err;
  _undoLens=_undoCount();
  if(undo&&!err&&typeof window.kcUndoOffer==='function'){try{window.kcUndoOffer(undo);}catch(e){}}
  if(!err)return true;
  console.error('[Kiné+] saveAll :',err);
  if(!(opts&&opts.quiet)&&typeof showNotif==='function'&&Date.now()-_saveErrAt>20000){
    _saveErrAt=Date.now();
    showNotif(_isQuotaErr(err)?'Mémoire du navigateur pleine : tes dernières modifications ne sont pas enregistrées.':'Erreur d\'enregistrement : '+(err.message||err),'err');
  }
  return false;
}

const _UNDO_K=[KF,KSF,KC,KQ,KConcepts,KConceptFolders,'kcu_flashcards',KFiches,KD,KQStats,KFCSpaced,KFav,KB,KKeyConcepts,KBrainDumps,KArchived];
function _undoCount(){return [folders,subFolders,courses,questions,concepts,conceptFolders,flashcards].map(a=>Array.isArray(a)?a.length:0);}
let _undoLens=null;
setTimeout(()=>{try{_undoLens=_undoCount();}catch(e){}},0);
function kcUndoRestore(u){ // remet tout comme avant la suppression
  const P=k=>{try{return u.raw[k]?JSON.parse(u.raw[k]):null;}catch(e){return null;}};
  let v;
  if((v=P(KF)))folders=v;if((v=P(KSF)))subFolders=v;if((v=P(KC)))courses=v;if((v=P(KQ)))questions=v;
  if((v=P(KConcepts)))concepts=_imgUnpack(v);if((v=P(KConceptFolders)))conceptFolders=v;if((v=P('kcu_flashcards')))flashcards=_imgUnpack(v);
  if((v=P(KFiches)))fiches=v;if((v=P(KD)))diffData=v;if((v=P(KQStats)))questionStats=v;if((v=P(KFCSpaced)))fcSpacedData=v;
  if((v=P(KFav)))favoritedQuestions=v;if((v=P(KB)))boycottedQuestions=v;if((v=P(KKeyConcepts)))keyConcepts=v;if((v=P(KBrainDumps)))brainDumps=v;if((v=P(KArchived)))archivedFolders=v;
  return saveAll({noUndo:true});
}

// ── Diagnostic de l'espace utilisé (affiché quand la mémoire est pleine) ──
const _LS_GROUPS=[
  [/^kcu_q$/,'Questions'],
  [/^(kcu_qstats|kcu_diff|kcu_sh|kcu_s|kcu_weekly_h|kcu_wh_v|kcu_daily)$/,'Statistiques'],
  [/^kcu_img_/,'Imagerie'],
  [/^(kcu_map|lmm_|kcu_mm$|kcu_dg$)/,'Cartes mentales'],
  [/^kcu_city/,'Ma ville'],
  [/^kcu_fiches$/,'Fiches de cours'],
  [/^(kcu_flashcards|kcu_concepts|kcu_cfol|kcu_fc_spaced|kcu_kc)$|^kimg_/,'Flashcards'],
  [/^kp_avatar_photo$/,'Photo de profil'],
  [/^kcu_gam/,'XP & maison']
];
function kineStorageReport(){ // {total, groups:[[libellé, octets]…]} du plus gros au plus petit
  const by={};let total=0;
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i),v=localStorage.getItem(k)||'';
    const b=(k.length+v.length)*(/[^\u0000-ÿ]/.test(v)?2:1); // ≈ octets
    const g=(_LS_GROUPS.find(x=>x[0].test(k))||[0,'Autres'])[1];
    by[g]=(by[g]||0)+b;total+=b;
  }
  return {total,groups:Object.entries(by).sort((a,b)=>b[1]-a[1])};
}
function kineFmtMo(b){return (b/1048576).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+' Mo';}
function kineSaveErrorHTML(what,err){ // message pour une fenêtre (ex. kineSaveErrorHTML('Import', e))
  const e=err||window._kineSaveError;
  const safe=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  if(!_isQuotaErr(e))return `<b>${what} impossible :</b> erreur d'enregistrement (${safe(e&&e.message||e)}). Rien n'a été modifié.`;
  let h=`<b>${what} impossible : la mémoire de ton navigateur est pleine.</b> Rien n'a été modifié.`;
  try{
    const r=kineStorageReport();
    h+=`<br>Espace utilisé ≈ ${kineFmtMo(r.total)}. Le plus gros : `+r.groups.slice(0,4).map(([g,b])=>`${g} ${kineFmtMo(b)}`).join(' · ')+'.';
  }catch(_){}
  return h+`<br>Libère de la place (photos de l'imagerie, images des cartes mentales…) puis réessaie.`;
}

// ── Spaced repetition SM-2 ──
/* Une carte compte dès qu'elle a une réponse : du texte OU une photo au verso (avant : les cartes « terme + photo » étaient ignorées → « Aucune carte dans ce dossier »). */
function kcIsCard(c){return !!(c&&((c.definition&&String(c.definition).trim())||c.imageA));}
function getFCSpaced(id){return fcSpacedData[id]||{interval:1,ease:2.5,reps:0,due:null};}
function updateFCSpaced(id,knew){
  const d=getFCSpaced(id);
  let {interval,ease,reps}=d;
  const grade=knew?4:1;
  if(grade<3){reps=0;interval=1;}
  else{reps++;interval=reps===1?1:reps===2?6:Math.round(interval*ease);}
  ease=Math.max(1.3,ease+(0.1-(5-grade)*(0.08+(5-grade)*0.02)));
  const due=new Date();due.setDate(due.getDate()+interval);
  fcSpacedData[id]={interval,ease,reps,due:due.toISOString().split('T')[0]};
  saveAll();
}
function getDueCount(){
  const today=new Date().toISOString().split('T')[0];
  return [...concepts,...flashcards].filter(c=>{const d=fcSpacedData[c.id];return d&&d.due&&d.due<=today;}).length;
}
function getDueCards(){
  const today=new Date().toISOString().split('T')[0];
  return [...concepts.map(c=>({...c,type:'concept'})),...flashcards.map(fc=>({...fc,type:'flashcard'}))].filter(c=>{const d=fcSpacedData[c.id];return d&&d.due&&d.due<=today;});
}

// ── Session history ──
function pushSessionHistory(entry){
  sessionHistory.push({...entry,ts:Date.now()});
  if(sessionHistory.length>300)sessionHistory=sessionHistory.slice(-300);
  saveAll();
}

function getFiche(courseId){return fiches.find(x=>x.courseId===courseId)||null;}
function saveFiche(courseId,content){
  const idx=fiches.findIndex(x=>x.courseId===courseId);
  if(idx>=0){fiches[idx].content=content;fiches[idx].updatedAt=new Date().toISOString();}
  else fiches.push({id:uid(),courseId,content,updatedAt:new Date().toISOString()});
  saveAll();
}
function deleteFiche(courseId){fiches=fiches.filter(x=>x.courseId!==courseId);saveAll();}

// ════════════════════════════════════════════
// STREAK + TODAY
// ════════════════════════════════════════════
function updStreak(){
  const today=new Date().toDateString(),yesterday=new Date(Date.now()-86400000).toDateString();
  if(stats.lastDate===today)return;
  stats.streak=stats.lastDate===yesterday?stats.streak+1:1;
  stats.lastDate=today;kcStreakSync();saveAll();
}
// ── LA série (16 nov. 2026) : une seule façon de compter, utilisée partout (menu, accueil, barre du haut, amis, XP) ──
// Un jour compte si tu es venu sur le site ce jour-là (ancien compteur stats.streak) ou si tu y as fait au moins une
// question (dailyCounts). Avant : le menu affichait l'un, l'accueil l'autre (« 12 jours » d'un côté, « 1 jour » de l'autre).
function _dayKey(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12).toISOString().slice(0,10);}
function kcStreak(){
  const act=new Set();
  try{Object.keys(dailyCounts||{}).forEach(k=>{if(dailyCounts[k]>0)act.add(k);});}catch(e){}
  const today=new Date();
  try{
    const ld=stats.lastDate?new Date(stats.lastDate):null;
    if(ld&&!isNaN(ld)){
      const gap=Math.round((new Date(today.getFullYear(),today.getMonth(),today.getDate())-new Date(ld.getFullYear(),ld.getMonth(),ld.getDate()))/864e5);
      if(gap>=0&&gap<=1){const d=new Date(ld);for(let i=0,n=Math.min(stats.streak|0,3660);i<n;i++){act.add(_dayKey(d));d.setDate(d.getDate()-1);}}
    }
  }catch(e){}
  let cur=0;const d=new Date(today);
  if(!act.has(_dayKey(d)))d.setDate(d.getDate()-1);
  while(act.has(_dayKey(d))){cur++;d.setDate(d.getDate()-1);}
  let best=0,run=0,prev=null;
  Array.from(act).sort().forEach(k=>{const t=new Date(k+'T12:00:00Z');run=(prev&&Math.round((t-prev)/864e5)===1)?run+1:1;if(run>best)best=run;prev=t;});
  let stored=0;try{stored=parseInt(localStorage.getItem('kp_streak_best'))||0;}catch(e){}
  best=Math.max(best,cur,stored);
  if(best>stored){try{localStorage.setItem('kp_streak_best',String(best));}catch(e){}}
  return {cur,best};
}
function kcStreakSync(){const s=kcStreak();if(stats.streak!==s.cur)stats.streak=s.cur;return s;}
try{kcStreakSync();}catch(e){}
function getTodayQ(){
  const today=new Date().toDateString();
  if(stats.todayDate!==today){stats.todayDate=today;stats.todayQ=0;stats.todaySecs=0;saveAll();}
  return stats.todayQ||0;
}
function addTodayQ(n,secs){
  const today=new Date().toDateString();
  if(stats.todayDate!==today){stats.todayDate=today;stats.todayQ=0;stats.todaySecs=0;}
  stats.todayQ=(stats.todayQ||0)+n;
  stats.todaySecs=(stats.todaySecs||0)+(secs||0);
  addWeeklyQ(n);
  addDailyQ(n);
  saveAll();
}
function formatTime(s){const m=Math.floor(s/60);return `${m}:${(s%60).toString().padStart(2,'0')}`;}

// ════════════════════════════════════════════
// DIFFICULTY
// ════════════════════════════════════════════
const FAST_THRESHOLD_SECS=8;

function getDiff(qid){
  const d=diffData[qid];
  if(!d||d.attempts===0)return 'new';
  // legacy migration: entries without lastCorrect → infer from error rate
  if(d.lastCorrect===undefined){
    const r=d.errors/d.attempts;
    if(r>=0.5)return 'hard';
    if(r>=0.25)return 'medium';
    return 'easy';
  }
  if(!d.lastCorrect)return 'hard';
  if(d.prevCorrect===false)return 'medium';
  if((d.lastTimeSpent||0)>FAST_THRESHOLD_SECS)return 'easy';
  return 'acquired';
}
function getDiffBadge(diff){
  if(diff==='hard')return{text:'Difficile',cls:'diff-hard'};
  if(diff==='medium')return{text:'Moyen',cls:'diff-med'};
  if(diff==='easy')return{text:'Facile',cls:'diff-easy'};
  if(diff==='acquired')return{text:'Acquise',cls:'diff-acquired'};
  return{text:'Nouveau',cls:'diff-new'};
}
function recordAnswer(qid,correct,timeSpent){
  if(!diffData[qid])diffData[qid]={attempts:0,errors:0,lastDate:'',score:0,lastCorrect:undefined,prevCorrect:null,lastTimeSpent:0,srsInterval:1,srsEaseFactor:2.5,srsRepetitions:0};
  const d=diffData[qid];
  d.prevCorrect=d.lastCorrect===undefined?null:d.lastCorrect;
  d.lastCorrect=!!correct;
  d.lastTimeSpent=timeSpent||0;
  d.attempts++;
  if(!correct)d.errors++;
  d.lastDate=new Date().toDateString();
  d.score=Math.round((d.errors/d.attempts)*100);
  // SM-2 : qualité 0-5 basée sur réussite + rapidité
  if(!d.srsEaseFactor||d.srsEaseFactor<1.3)d.srsEaseFactor=2.5;
  if(!d.srsRepetitions)d.srsRepetitions=0;
  if(!d.srsInterval||d.srsInterval<1)d.srsInterval=1;
  const q=correct?((timeSpent||0)>0&&(timeSpent||0)<FAST_THRESHOLD_SECS?5:4):1;
  if(q<3){
    d.srsRepetitions=0;d.srsInterval=1;
  } else {
    if(d.srsRepetitions===0)d.srsInterval=1;
    else if(d.srsRepetitions===1)d.srsInterval=6;
    else d.srsInterval=Math.max(1,Math.round(d.srsInterval*d.srsEaseFactor));
    d.srsRepetitions++;
  }
  d.srsEaseFactor=Math.max(1.3,d.srsEaseFactor+0.1-(5-q)*(0.08+(5-q)*0.02));
  const next=new Date();next.setDate(next.getDate()+d.srsInterval);
  d.nextReview=next.toDateString();
}
function getHardQs(){return questions.filter(q=>getDiff(q.id)==='hard'||getDiff(q.id)==='medium');}
// SRS : questions dont la révision est due aujourd'hui
function getSRSDueQuestions(){
  const todayMs=new Date().setHours(0,0,0,0);
  return questions.filter(q=>{
    if(isBoycotted(q.id))return false;
    const d=diffData[q.id];
    if(!d||!d.lastDate)return false; // jamais répondue → pas due
    if(!d.nextReview)return true;    // répondue avant le SRS → due maintenant
    return new Date(d.nextReview).setHours(0,0,0,0)<=todayMs;
  });
}
function boycottQuestion(qid){boycottedQuestions[qid]=true;saveAll();}
function archiveFolder(fid){archivedFolders[fid]=new Date().toISOString();// Retirer du plan exam si présent
const ef=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]').filter(id=>id!==fid);if(ef.length)localStorage.setItem('kp_exam_folders',JSON.stringify(ef));else localStorage.removeItem('kp_exam_folders');saveAll();}
function unarchiveFolder(fid){delete archivedFolders[fid];saveAll();}
function isFolderArchived(fid){return !!archivedFolders[fid];}
function unboycottQuestion(qid){delete boycottedQuestions[qid];saveAll();}
function isBoycotted(qid){return !!boycottedQuestions[qid];}
function toggleFavorite(qid){if(favoritedQuestions[qid]){delete favoritedQuestions[qid];}else{favoritedQuestions[qid]=true;}saveAll();}
function isFavorite(qid){return !!favoritedQuestions[qid];}

// ════════════════════════════════════════════
// PRELOAD SDRC
// ════════════════════════════════════════════
(function(){
  if(questions.length>0)return;
  const fid=uid(),cid=uid();
  folders.push({id:fid,name:'Kinésithérapie',color:'#2D5A3D'});
  courses.push({id:cid,folderId:fid,name:'SDRC I'});
  [{q:"Lequel de ces termes est un synonyme clinique du Syndrome Douloureux Régional Complexe de Type I (SDRC I) ?",a:["Syndrome de Sudeck","Neuropathie périphérique diabétique","Fibromyalgie généralisée","Arthrose précoce"],c:0,e:""},
  {q:"Concernant l'étiologie traumatique du SDRC I, quelle affirmation est exacte ?",a:["L'intensité du syndrome est proportionnelle à la gravité du traumatisme initial.","Il n'y a pas de parallélisme entre la cause et l'effet.","Le syndrome apparaît systématiquement dans les 24 h suivant l'accident.","Seules les fractures ouvertes déclenchent ce syndrome."],c:1,e:""},
  {q:"Selon la théorie de Leriche (1923), quel changement biochimique est induit par la stase circulatoire ?",a:["Une augmentation du pH local","Une diminution du PpCO₂","Une diminution du pH et de la PpO₂","Une vasoconstriction permanente et irréversible"],c:2,e:""},
  {q:"Quelle est la caractéristique principale de la douleur lors de la \"phase chaude\" du SDRC I ?",a:["Elle disparaît totalement au repos.","Elle a un début progressif et ne répond pas aux analgésiques communs.","Elle est purement mécanique et diurne.","Elle est localisée strictement à un seul point précis."],c:1,e:""},
  {q:"Lequel de ces signes cliniques est typique de la \"phase froide\" ?",a:["Peau rouge et luisante","Cyanose et hypothermie locale","Hyper-sudation abondante","Augmentation de la température cutanée"],c:1,e:""},
  {q:"Quel facteur psychologique favorise l'apparition du SDRC I ?",a:["L'extraversion excessive","Un état anxio-dépressif ou hyper-émotif","Une grande résistance au stress","L'absence totale d'émotions"],c:1,e:""},
  {q:"Quelle est la règle d'or absolue en kinésithérapie pour traiter un SDRC I ?",a:["La règle de la \"No douleur\"","Le renforcement musculaire intensif immédiat","L'immobilisation stricte prolongée","L'application de chaleur intense en phase chaude"],c:0,e:""},
  {q:"Selon les critères de Doury, à quoi correspond le \"Groupe B\" du diagnostic ?",a:["Aux signes cliniques identifiables par le kinésithérapeute","À la déminéralisation osseuse locale ou régionale","À l'examen histologique de l'os","À la réponse aux bétabloquants"],c:1,e:""},
  {q:"Quel outil est utilisé pour la rééducation sensitive via le système nerveux central ?",a:["Le dynamomètre","La Mirror Box (Boîte miroir)","Le goniomètre","Les poids et haltères"],c:1,e:""},
  {q:"Quel est l'objectif prioritaire de la kinésithérapie en phase chaude ?",a:["Récupérer la force maximale de préhension","Lutter contre la douleur et normaliser les troubles vasomoteurs","Forcer sur les articulations pour éviter la fibrose","Préparer le patient à une chirurgie correctrice"],c:1,e:""},
  {q:"Dans le mécanisme du SDRC, qu'est-ce qui déclenche initialement le cycle de la douleur ?",a:["Une infection bactérienne","Une lésion initiale (injury) envoyant un influx douloureux au SNC","Une carence en calcium","Une paralysie motrice soudaine"],c:1,e:""},
  {q:"Quelle technique est recommandée pour diminuer l'œdème en phase chaude ?",a:["Massage transversal profond","Massage superficiel et drainage","Cryothérapie par immersion prolongée dans la glace","Ultrasons à forte intensité"],c:1,e:""},
  {q:"Selon Harden et al. (2013), quel signe appartient à la catégorie \"Vasomotrice\" ?",a:["Allodynie au toucher léger","Asymétrie de température ou changement de couleur de la peau","Tremblements ou dystonie","Changements de croissance des ongles"],c:1,e:""},
  {q:"En phase froide, que peut-on observer au niveau radiologique ?",a:["Une condensation osseuse massive","Une ostéopénie péri-articulaire","La disparition totale des espaces articulaires","Une ossification des tendons"],c:1,e:""},
  {q:"Quel est le \"juste milieu\" pour le traitement kiné du SDRC ?",a:["Travailler uniquement un jour sur deux","Éviter un traitement trop intense (aggravation) et un traitement trop faible (raideur)","Mélanger kinésithérapie et ostéopathie systématiquement","Utiliser la même intensité pour tous les patients"],c:1,e:""},
  {q:"Les \"Bains de contraste\" sont utilisés pour quel objectif ?",a:["Augmenter la force musculaire","La désensibilisation et la rééducation vasomotrice","Nettoyer les plaies chirurgicales","Étendre les ligaments rétractés"],c:1,e:""},
  {q:"Quelle est la durée habituelle de la phase chaude ?",a:["2 à 3 jours","Plusieurs années","De quelques semaines à quelques mois","Exactement 12 mois pour tous les patients"],c:2,e:""},
  {q:"Dans l'étude RCT d'Oerlemans et al. (2000), quels groupes étaient comparés ?",a:["Kinésithérapie vs Ergothérapie vs Groupe contrôle (travail social)","Chirurgie vs Médicaments uniquement","Acupuncture vs Kinésithérapie","Repos complet vs Exercice intensif"],c:0,e:""},
  {q:"Quel est l'effet de l'ischémie locale selon le processus de Leriche ?",a:["Elle favorise la guérison rapide","Elle déclenche une vasodilatation secondaire et une perméabilité accrue","Elle renforce la structure osseuse","Elle n'a aucun impact sur la douleur"],c:1,e:""},
  {q:"L'impuissance fonctionnelle dans le SDRC est définie comme :",a:["Une envie de ne pas bouger par paresse","Une limitation majeure de la mobilité dans tous les sens due à la douleur","Une paralysie nerveuse totale et irréversible","Une augmentation de la souplesse articulaire"],c:1,e:""},
  {q:"En phase froide, quelle complication tissulaire redoute-t-on particulièrement ?",a:["Une hyper-élasticité cutanée","La fibrose avec rétractions tendineuses et capsulaires","La repousse excessive des poils","Une hypertrophie musculaire"],c:1,e:""},
  {q:"Quel signe appartient à la catégorie \"Sudomotrice/Œdème\" des critères diagnostiques ?",a:["Peau bleue","Changements de sudation ou asymétrie de sudation","Perte de force","Douleur au mouvement articulaire"],c:1,e:""},
  {q:"Quel est l'intérêt principal du TENS dans le SDRC ?",a:["Faire fondre les graisses locales","Le contrôle de la douleur via la théorie du Gate Control","Remplacer totalement les médicaments","Provoquer des contractions musculaires puissantes"],c:1,e:""},
  {q:"Quelle attitude du kinésithérapeute est un \"facteur nocif\" ?",a:["Éduquer le patient sur sa pathologie","Provoquer intentionnellement de la douleur pendant la séance","Utiliser la Mirror Box dès le début","Encourager une mobilisation active très douce"],c:1,e:""},
  {q:"Quel est le pronostic général du SDRC I si le traitement est adéquat ?",a:["Amputation systématique du membre","Pronostic bénin mais avec un risque de séquelles fonctionnelles","Dégénérescence en cancer des os","Guérison totale et instantanée en 48 heures"],c:1,e:""}
  ].forEach(d=>questions.push({id:uid(),courseId:cid,question:d.q,answers:d.a,correct:d.c,expl:d.e}));
  saveAll();
})();

// ── Seed prompt QCM par défaut
if(!prompts.length){
  prompts.push({
    id:uid(),
    name:'📝 Générateur de QCM',
    content:`Rôle : Tu es un expert en ingénierie pédagogique et un spécialiste du domaine abordé dans les documents joints. Ta mission est de concevoir un examen de type QCM de haute qualité, rigoureux et exhaustif, destiné à valider la compréhension profonde du cours.

Consignes de rédaction :

Volume : Génère un minimum de 25 questions. Si la densité du cours l'exige pour couvrir l'intégralité des concepts clés (ex: chaque structure en anatomie, chaque étape d'un processus), augmente ce nombre jusqu'à épuisement des points essentiels.

Pertinence : Focalise-toi uniquement sur les concepts fondamentaux, les mécanismes et les structures critiques. Ignore les données futiles, les statistiques secondaires ou les pourcentages anecdotiques, sauf s'ils sont le cœur du sujet.

Qualité des distracteurs (mauvaises réponses) :
   * Les distracteurs doivent être hautement plausibles.
   * Utilise des erreurs de logique classiques, des confusions de termes fréquents dans la discipline ou des inversions de mécanismes mentionnés dans le texte.
   * Interdiction stricte : N'utilise jamais d'options "Toutes les réponses ci-dessus", "Aucune des réponses" ou de réponses évidemment fausses/absurdes.

Équilibre visuel : Veille à ce que les 4 options de réponse (A, B, C, D) aient une longueur approximativement identique. La réponse correcte ne doit pas être identifiable parce qu'elle est plus détaillée ou plus longue que les autres.

Privilégie les formulations positives. Évite au maximum les questions du type 'Lequel de ces éléments n'est pas...' ou 'Toutes ces propositions sont vraies sauf une'.

Assure une homogénéité syntaxique : si la réponse A commence par un verbe à l'infinitif, les réponses B, C et D doivent aussi commencer par un verbe à l'infinitif. Si la réponse A est une phrase complète, les autres doivent l'être aussi.

Aléatrise la position de la réponse correcte pour qu'il n'y ait pas de schéma répétitif (ex: ne pas avoir 3 fois de suite la réponse B correcte).

Assure-toi que les options sont mutuellement exclusives. Il ne doit pas y avoir de chevauchement de sens ou de valeurs numériques entre les propositions.

Inclus 20% de questions basées sur des mini-scénarios ou cas pratiques pour tester l'application des connaissances.

Dans le Feedback, ajoute à la fin entre parenthèses la page d'où tu as tiré la question.

Contraintes de formatage (STRICT) :

Tu dois écrire les questions sous format texte brut, dans une boîte de code, en respectant exactement cette structure pour chaque question (pour permettre un copier-coller direct dans mon application) :

[N°]. [Texte de la question] ?

A. [Option A]

B. [Option B]

C. [Option C]

D. [Option D]

Réponse correcte : [Lettre]

Feedback : [Explication complète et percutante reliant la réponse à un concept clé du document].

[COLLEZ VOTRE TEXTE/PDF ICI]`,
    createdAt:new Date().toISOString()
  });
  saveAll();
}

// ════════════════════════════════════════════
// TRUE CRYPTO SHUFFLE
// ════════════════════════════════════════════
function shuffle(arr){
  const a=[...arr];
  const rnd=new Uint32Array(a.length);
  try{crypto.getRandomValues(rnd);}catch(e){for(let i=0;i<rnd.length;i++)rnd[i]=Math.random()*0xFFFFFFFF>>>0;}
  for(let i=a.length-1;i>0;i--){const j=rnd[i]%(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

// ════════════════════════════════════════════
// COLORS
// ════════════════════════════════════════════
const PAL=['#2D5A3D','#8B3A2A','#004d75','#7A3A8B','#C49A3C','#2A7A6A','#3f627e','#5A7A2A','#3A5A8B','#8B6A2A'];
let selC=PAL[0];
function renderCP(id,cur){selC=cur||PAL[0];document.getElementById(id).innerHTML=PAL.map(c=>`<div class="cpdot${c===selC?' selected':''}" style="background:${c}" onclick="pickC('${c}','${id}')"></div>`).join('');}
function pickC(c,id){selC=c;document.querySelectorAll('#'+id+' .cpdot').forEach(d=>{d.classList.toggle('selected',d.style.background===c);});}

// ════════════════════════════════════════════
// CONCEPTS + SRS
// ════════════════════════════════════════════
function addConcept(term,questionId){
  const t=term.trim();
  if(!t||concepts.find(c=>c.term.toLowerCase()===t.toLowerCase()))return false;
  concepts.push({id:uid(),term:t,questionId:questionId||null,state:'toExplain',definition:'',keywords:[],masteryLevel:0,nextReview:null,lastReview:null,createdAt:new Date().toISOString()});
  saveAll();return true;
}
function updateConceptFiche(id,definition,keywords,image){
  const c=concepts.find(x=>x.id===id);if(!c)return;
  c.definition=definition.trim();
  c.keywords=Array.isArray(keywords)?keywords:keywords.split(',').map(k=>k.trim()).filter(Boolean);
  c.state='learned';
  if(image!==undefined)c.image=image;
  saveAll();
}
function updateConceptMastery(cid,result){
  // result: 'correct' | 'partial' | 'wrong'  (legacy boolean still accepted)
  const c=concepts.find(x=>x.id===cid);if(!c)return;
  if(result===true||result==='correct'){
    c.masteryLevel=Math.min(5,c.masteryLevel+1);
    if(c.masteryLevel>=5)c.state='learned';
  } else if(result==='partial'){
    // niveau inchangé, mais révision demain
  } else {
    c.masteryLevel=Math.max(0,c.masteryLevel-1);
  }
  const days=result==='partial'?1:SRS_DAYS[Math.min(c.masteryLevel,SRS_DAYS.length-1)];
  const next=new Date();next.setDate(next.getDate()+days);
  c.nextReview=next.toISOString();c.lastReview=new Date().toISOString();
  saveAll();
}
function getConceptsDue(){
  const now=new Date();
  return concepts.filter(c=>kcIsCard(c)&&(!c.nextReview||new Date(c.nextReview)<=now));
}
function conceptsMatchingQuestion(qText){
  if(!qText)return[];
  const lo=qText.toLowerCase();
  return concepts.filter(c=>c.definition&&lo.includes(c.term.toLowerCase()));
}

// ── Tolerance check for typed answers ──
function _norm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}

const _SYN=[
  ['perte','diminution','baisse','reduction','chute','declin','deficit','diminue','baisser','perdre','abaissement','amoindrissement'],
  ['augmentation','hausse','elevation','majoration','accroissement','augmente','eleve','croissance','hyper'],
  ['douleur','algique','algie','douloureux','douloureuse','souffrance','nociceptif','nociception','algodystrophie'],
  ['inflammation','inflammatoire','inflame','synovite','synoviale'],
  ['immobilisation','immobile','immobilite','repos','alitement','immobilise','immobiliser'],
  ['osseux','osseuse','os','osteo','ossification','osteopenie','osteite'],
  ['articulaire','articulation','articulee','periarticulaire','juxta-articulaire','intra-articulaire'],
  ['densite','dense','densification'],
  ['minerale','mineral','mineralisation','demineralisation'],
  ['localise','locale','local','localisee','regional','regionale','periarticulaire','autour'],
  ['prolonge','prolongee','prolongement','chronique','durable','persistant','persistante'],
  ['oedeme','oedemateux','gonflement','enflure','tuméfaction','turgescence'],
  ['raideur','rigidite','raidissement','ankylose','ankyloses'],
  ['vasculaire','vasomoteur','vasomotrice','vascularisation','veineux','arteriel'],
  ['sensitif','sensitive','sensibilisation','sensibilite','sensible','allodynie','hyperalgesie'],
  ['moteur','motrice','motricite','mouvement','mobilite'],
  ['atrophie','atrophique','amyotrophie','fonte','hypotrophie'],
  ['sympathique','ortho-sympathique','neurovegetal','nerveux'],
  ['sudation','transpiration','sudomoteur','hyperhydrose'],
  ['trophique','trophicite','nutritif','nutrition'],
  ['spasme','contracture','contraction','crampe'],
  ['fracture','traumatisme','trauma','contusion','lesion'],
  ['laxiste','relache','hyperlaxite','instabilite'],
];
function _getSyns(w){for(const g of _SYN){if(g.includes(w))return g;}return null;}
function _wordsRelated(a,b){
  if(a===b||a.includes(b)||b.includes(a))return true;
  const sg=_getSyns(a);if(sg&&sg.includes(b))return true;
  // racine commune ≥5 lettres
  if(a.length>=5&&b.length>=5&&a.slice(0,5)===b.slice(0,5))return true;
  return false;
}
function _kwMatch(typed,kw){
  const t=_norm(typed),k=_norm(kw);
  if(t.includes(k))return true;
  const tWords=t.split(/\s+/);
  const kWords=k.split(/\s+/).filter(w=>w.length>2);
  // un seul mot du mot-clé doit matcher (direct ou synonyme)
  return kWords.some(kw2=>tWords.some(tw=>_wordsRelated(tw,kw2)));
}
function checkAnswer(typed,keywords){
  const t=_norm(typed||'');
  if(!t)return{ok:false,partial:false,matched:[],total:0};
  if(!keywords||!keywords.length){
    return{ok:t.length>2,partial:false,matched:[],total:0};
  }
  const matched=keywords.filter(kw=>_kwMatch(t,kw));
  const n=keywords.length;
  const forOk=Math.max(1,Math.round(n*0.8)); // ≥80% → correct
  const ok=matched.length>=forOk;
  const partial=!ok&&matched.length>=1;       // ≥1   → partiel
  return{ok,partial,matched,total:n,needed:forOk};
}

// ── Standalone Flashcards (course-level) ──
function addFlashcards(courseId,cards){
  cards.forEach(c=>flashcards.push({id:uid(),courseId,term:c.term.trim(),definition:c.definition.trim(),keywords:Array.isArray(c.keywords)?c.keywords:[] }));
  saveAll();
}
function deleteFlashcard(id){flashcards=flashcards.filter(x=>x.id!==id);saveAll();}
function getFlashcardsForCourse(courseId){return flashcards.filter(x=>x.courseId===courseId);}

// ════════════════════════════════════════════
// FEATURE #3 — QUESTION STATS
// ════════════════════════════════════════════
function getQStats(qid){return questionStats[qid]||null;}
function calculateAndSaveStats(sess){
  if(!sess||!sess.answers||!sess.qs)return;
  sess.answers.forEach(ans=>{
    const q=ans.q;const correct=!!(ans.correct&&!ans.skipped);
    const timeSpent=ans.timeSpent||0;
    const ex=questionStats[q.id]||{};
    const timesAsked=(ex.timesAsked||0)+1;
    const timesCorrect=(ex.timesCorrect||0)+(correct?1:0);
    const responseTimes=[...(ex.responseTimes||[]),...(timeSpent>0?[timeSpent]:[])];
    const streak=correct?(ex.streak||0)+1:0;
    questionStats[q.id]={
      qId:q.id,courseId:q.courseId,
      timesAsked,timesCorrect,
      timesWrong:timesAsked-timesCorrect,
      percentageCorrect:Math.round(timesCorrect*100/timesAsked),
      responseTimes,
      avgResponseTime:responseTimes.length?Math.round(responseTimes.reduce((a,b)=>a+b,0)/responseTimes.length):0,
      fastestTime:responseTimes.length?Math.min(...responseTimes):0,
      slowestTime:responseTimes.length?Math.max(...responseTimes):0,
      streak,
      longestStreak:Math.max(ex.longestStreak||0,streak),
      lastAskedAt:Date.now(),
      lastCorrectAt:correct?Date.now():(ex.lastCorrectAt||null),
      starred:ex.starred||false,
      markedReview:ex.markedReview||false,
    };
  });
  saveAll();
}
function analyzePattern(stats){
  if(!stats||!stats.timesAsked)return[];
  const p=[];
  if(stats.percentageCorrect<50)p.push({type:'warn',text:`Tu échoues souvent (${stats.percentageCorrect}% seulement)`});
  else if(stats.percentageCorrect>=85)p.push({type:'ok',text:`Bien maîtrisée (${stats.percentageCorrect}%) !`});
  if(stats.avgResponseTime>0&&stats.avgResponseTime<5&&stats.timesAsked>=2)p.push({type:'warn',text:'Tu réponds très vite — attention aux erreurs d\'inattention'});
  if(stats.percentageCorrect<60&&stats.timesAsked>=3)p.push({type:'warn',text:'Conseil : revois ce concept, il te pose régulièrement problème'});
  if(stats.streak>=3)p.push({type:'ok',text:`Bonne série ! ${stats.streak} bonnes réponses consécutives`});
  return p;
}

// ════════════════════════════════════════════
// FEATURE #5 — BRAIN DUMP
// ════════════════════════════════════════════
function saveBrainDump(dump){brainDumps.push(dump);saveAll();}
function getCourseBrainDumps(courseId){return brainDumps.filter(d=>d.courseId===courseId);}
function getKeyConceptsForCourse(courseId){return keyConcepts[courseId]||[];}
function setKeyConceptsForCourse(courseId,kc){keyConcepts[courseId]=kc;saveAll();}

// ════════════════════════════════════════════
// EXAM PLANNER — algorithme de planification
// ════════════════════════════════════════════
function getExamPlan(){
  const examDateStr=localStorage.getItem('kp_exam_date');
  if(!examDateStr)return null;
  const examDate=new Date(examDateStr);
  const today=new Date();today.setHours(0,0,0,0);examDate.setHours(0,0,0,0);
  const daysLeft=Math.ceil((examDate-today)/86400000);
  if(daysLeft<0)return null;

  // Phase automatique
  const phase=daysLeft>14?'learn':daysLeft>7?'review':daysLeft>2?'intense':'sprint';
  const phaseLabel={learn:'Apprentissage',review:'Consolidation',intense:'Intensif',sprint:'Sprint final'};
  const phaseDesc={
    learn:'Couvre tous les thèmes, priorité aux sujets jamais touchés',
    review:'Renforce les lacunes, attaque les questions difficiles',
    intense:'Concentre-toi sur tes points faibles critiques',
    sprint:'Questions dues SRS + erreurs récentes uniquement'
  };

  // Objectif journalier dynamique (augmente à l'approche de l'exam)
  const baseGoal=dailyGoal||20;
  const dynamicGoal=phase==='sprint'?Math.round(baseGoal*2):phase==='intense'?Math.round(baseGoal*1.5):baseGoal;

  const examFolderIds=JSON.parse(localStorage.getItem('kp_exam_folders')||'[]');
  const regularFolders=folders.filter(f=>{
    if(f.type==='annales'||isFolderArchived(f.id))return false;
    if(examFolderIds.length)return examFolderIds.includes(f.id);
    return true;
  });
  const todayMs=today.getTime();

  const folderScores=regularFolders.map(folder=>{
    const fc=courses.filter(c=>c.folderId===folder.id);
    const fq=questions.filter(q=>fc.some(c=>c.id===q.courseId)&&!isBoycotted(q.id));
    const total=fq.length;if(!total)return null;

    const byDiff={new:0,hard:0,medium:0,easy:0,acquired:0};
    let lastStudiedDate=null;let srsBacklog=0;
    fq.forEach(q=>{
      const diff=getDiff(q.id);byDiff[diff]=(byDiff[diff]||0)+1;
      const d=diffData[q.id];
      if(d&&d.lastDate){const ld=new Date(d.lastDate);if(!lastStudiedDate||ld>lastStudiedDate)lastStudiedDate=ld;}
      if(d&&d.nextReview&&new Date(d.nextReview).setHours(0,0,0,0)<=todayMs)srsBacklog++;
    });

    const daysSinceStudied=lastStudiedDate?Math.floor((today-lastStudiedDate)/86400000):999;
    const coverage=(total-byDiff.new)/total;
    const mastery=(byDiff.acquired||0)/total;
    const errorWeight=(byDiff.hard*3+(byDiff.medium||0)*2)/(total*3);

    // Score selon la phase (0–100)
    let score=0;
    if(phase==='learn'){
      score=(1-coverage)*50+errorWeight*30+Math.min(daysSinceStudied/14,1)*20;
    } else if(phase==='review'){
      score=errorWeight*40+(1-coverage)*30+Math.min(daysSinceStudied/7,1)*30;
    } else if(phase==='intense'){
      score=errorWeight*60+Math.min(daysSinceStudied/3,1)*40;
    } else {
      score=errorWeight*40+(srsBacklog/total)*40+(1-mastery)*20;
    }

    // Projection : est-on dans les temps ?
    // Estimation questions/jour nécessaires pour maîtriser ce thème avant l'exam
    const remaining=byDiff.new*1+byDiff.hard*2+(byDiff.medium||0)*1.5;
    const qPerDayNeeded=daysLeft>0?Math.ceil(remaining/daysLeft):remaining;
    const onTrack=qPerDayNeeded<=dynamicGoal/regularFolders.length*1.5;
    const status=mastery>0.7?'ok':(daysLeft<7&&errorWeight>0.5)?'critical':(!onTrack||errorWeight>0.4)?'warning':'ok';

    // Questions recommandées pour aujourd'hui (hard/medium/new selon phase)
    const recommended=fq.filter(q=>{
      const d=getDiff(q.id);
      if(phase==='sprint')return d==='hard'||d==='medium';
      if(phase==='intense')return d==='hard'||d==='medium';
      return d==='hard'||d==='medium'||d==='new';
    }).slice(0,Math.max(5,Math.ceil(dynamicGoal/regularFolders.length)));

    return{folder,total,byDiff,coverage:Math.round(coverage*100),mastery:Math.round(mastery*100),
      errorRate:Math.round(errorWeight*100),daysSinceStudied,srsBacklog,score,status,qPerDayNeeded,recommended};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);

  return{daysLeft,phase,phaseLabel:phaseLabel[phase],phaseDesc:phaseDesc[phase],
    examDate,examName:localStorage.getItem('kp_exam_name')||'Examen',
    folderScores,todayTop:folderScores.slice(0,3),dynamicGoal};
}

// ════════════════════════════════════════════
// SYNC — à venir
// ════════════════════════════════════════════

