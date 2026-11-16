/* =========================================================
   ai-gemini.js — IA gratuite partagée (Gemini de Google), 15 nov. 2026
   Même clé que Cours ↔ Annales : localStorage.kcu_gemini_key (créée gratuitement sur aistudio.google.com).
   window.KAI :
     hasKey() / getKey() / setKey(k)
     ensureKey()               → Promise<bool> : ouvre la fenêtre d'activation si besoin
     openKeyDialog()           → fenêtre d'activation / gestion de la clé
     stream({system, contents, onText, signal, temperature}) → texte complet (réponse en direct)
     ask({system, contents, json, schema, temperature})      → texte (ou objet si json)
     pdfPart(file)             → {inline_data} (≤ 14 Mo) sinon {text} extrait avec PDF.js
     md(text)                  → HTML (mini Markdown : titres, listes, gras, italique, code, tableaux, citations)
   ========================================================= */
(function(){
'use strict';
const KEY='kcu_gemini_key',BASE='https://generativelanguage.googleapis.com/v1beta/';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getKey=()=>{try{return localStorage.getItem(KEY)||'';}catch(e){return '';}};
const setKey=k=>{try{if(k)localStorage.setItem(KEY,k);else localStorage.removeItem(KEY);}catch(e){}try{sessionStorage.removeItem('kai_models');}catch(e){}};
function Err(msg,kind,wait){const e=new Error(msg);e.kind=kind;e.wait=wait||0;return e;}
async function readErr(r){
  let j=null;try{j=await r.json();}catch(e){}
  const err=(j&&j.error)||{},msg=err.message||('erreur '+r.status),det=JSON.stringify(err.details||[]);
  if(/API_KEY_INVALID|API key not valid/i.test(msg+det)||r.status===401)return Err('Google refuse cette clé : vérifie que tu l’as copiée en entier.','key');
  if(r.status===403)return Err('Google refuse cette clé ('+msg+').','key');
  if(r.status===429){
    const daily=/PerDay|per day|daily/i.test(msg+det),m=det.match(/"retryDelay":"(\d+)/);
    return Err(daily?'Limite gratuite de Gemini atteinte pour aujourd’hui avec ce modèle':'Trop de demandes d’un coup : réessaie dans quelques secondes',daily?'daily':'rate',m?+m[1]:15);
  }
  if(r.status===404)return Err('Modèle introuvable','model');
  if(r.status===400&&/too large|exceeds|size/i.test(msg))return Err('Document trop gros pour l’IA : essaie un PDF plus léger.','size');
  if(r.status>=500)return Err('Google est surchargé, réessaie dans un instant','busy',8);
  return Err('Gemini : '+msg,'other');
}
async function call(path,body,signal){
  let r;
  try{r=await fetch(BASE+path,{method:body?'POST':'GET',headers:Object.assign({'x-goog-api-key':getKey()},body?{'Content-Type':'application/json'}:{}),body:body?JSON.stringify(body):undefined,signal});}
  catch(e){if(e&&e.name==='AbortError')throw e;throw Err('Impossible de joindre Google (internet coupé ?)','net');}
  if(!r.ok)throw await readErr(r);
  return r;
}
/* Meilleurs modèles « flash » disponibles pour cette clé (gratuits), du plus récent au plus ancien */
async function models(){
  try{const c=JSON.parse(sessionStorage.getItem('kai_models')||'null');if(c&&c.length)return c;}catch(e){}
  const j=await (await call('models?pageSize=200')).json();
  const score=n=>{const m=n.match(/^gemini-(\d+(?:\.\d+)?)-flash(-lite)?(-preview[\w-]*|-exp[\w-]*|-\d{3})?$/);if(!m)return -1;return 200+parseFloat(m[1])*10-(m[2]?100:0)-(m[3]&&!/^-\d{3}$/.test(m[3])?3:0);};
  let ms=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>String(m.name||'').replace(/^models\//,''))
    .filter(n=>score(n)>0&&!/image|tts|audio|live|thinking|8b/.test(n)).sort((a,b)=>score(b)-score(a));
  if(!ms.length)ms=['gemini-2.5-flash','gemini-2.5-flash-lite'];
  try{sessionStorage.setItem('kai_models',JSON.stringify(ms));}catch(e){}
  return ms;
}
function body(o){
  const b={contents:o.contents,generationConfig:{temperature:o.temperature==null?.6:o.temperature}};
  if(o.system)b.systemInstruction={parts:[{text:o.system}]};
  if(o.json){b.generationConfig.responseMimeType='application/json';if(o.schema)b.generationConfig.responseSchema=o.schema;}
  return b;
}
const textOf=j=>((((j||{}).candidates||[])[0]||{}).content||{}).parts?j.candidates[0].content.parts.filter(p=>!p.thought).map(p=>p.text||'').join(''):'';
/* Essaie les modèles dans l'ordre : modèle absent ou quota du jour épuisé → modèle suivant */
async function withModels(fn){
  const ms=await models();let last=null;
  for(const m of ms){
    try{return await fn(m);}
    catch(e){if(e&&e.name==='AbortError')throw e;last=e;if(e.kind==='model'||e.kind==='daily')continue;throw e;}
  }
  throw last||Err('Aucun modèle Gemini disponible','model');
}
async function ask(o){
  return withModels(async m=>{
    const j=await (await call('models/'+m+':generateContent',body(o),o.signal)).json();
    const fb=j&&j.promptFeedback&&j.promptFeedback.blockReason;
    if(fb)throw Err('Gemini a refusé de répondre ('+fb+')','other');
    const t=textOf(j);
    if(!o.json)return t;
    try{return JSON.parse(t);}catch(e){const m2=t.match(/[\[{][\s\S]*[\]}]/);if(m2)return JSON.parse(m2[0]);throw Err('Réponse illisible, réessaie','other');}
  });
}
async function stream(o){
  return withModels(async m=>{
    const r=await call('models/'+m+':streamGenerateContent?alt=sse',body(o),o.signal);
    const rd=r.body.getReader(),dec=new TextDecoder();let buf='',full='';
    for(;;){
      const {value,done}=await rd.read();if(done)break;
      buf+=dec.decode(value,{stream:true});
      let i;
      while((i=buf.indexOf('\n'))>=0){
        const line=buf.slice(0,i).trim();buf=buf.slice(i+1);
        if(!line.startsWith('data:'))continue;
        let j=null;try{j=JSON.parse(line.slice(5));}catch(e){continue;}
        if(j.error)throw Err('Gemini : '+(j.error.message||'erreur'),'other');
        const t=textOf(j);if(t){full+=t;o.onText&&o.onText(full,t);}
      }
    }
    if(!full)throw Err('L’IA n’a rien répondu, réessaie','other');
    return full;
  });
}

/* PDF → partie de message : le PDF lui-même (l'IA voit aussi les schémas) si ≤ 14 Mo, sinon le texte extrait */
function b64(buf){let s='';const a=new Uint8Array(buf),n=0x8000;for(let i=0;i<a.length;i+=n)s+=String.fromCharCode.apply(null,a.subarray(i,i+n));return btoa(s);}
async function pdfText(buf,max){
  if(typeof pdfjsLib==='undefined')throw Err('Le lecteur PDF n’est pas chargé : recharge la page.','other');
  const pdf=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;let out='';
  for(let p=1;p<=pdf.numPages&&out.length<(max||900000);p++){
    const tc=await (await pdf.getPage(p)).getTextContent();
    out+='\n\n[Page '+p+']\n'+tc.items.map(it=>it.str+(it.hasEOL?'\n':' ')).join('');
  }
  return {text:out,pages:pdf.numPages};
}
async function pdfPart(file){
  const buf=await file.arrayBuffer();
  if(buf.byteLength<=14*1024*1024)return {part:{inline_data:{mime_type:'application/pdf',data:b64(buf)}},buf,mode:'pdf'};
  const t=await pdfText(buf);
  return {part:{text:'Document « '+file.name+' » ('+t.pages+' pages, texte extrait) :\n'+t.text},buf,mode:'text'};
}

/* Mini Markdown sûr (tout est échappé avant) */
function inline(s){
  return s.replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>')
    .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g,'$1<em>$2</em>')
    .replace(/==([^=]+)==/g,'<mark>$1</mark>');
}
function md(src){
  const lines=esc(String(src||'').replace(/\r/g,'')).split('\n');let html='',i=0;
  const isTable=l=>/^\s*\|.*\|\s*$/.test(l);
  while(i<lines.length){
    let l=lines[i];
    if(/^```/.test(l)){let code='';i++;while(i<lines.length&&!/^```/.test(lines[i])){code+=lines[i]+'\n';i++;}i++;html+='<pre><code>'+code+'</code></pre>';continue;}
    let m;
    if((m=l.match(/^(#{1,4})\s+(.*)$/))){const n=Math.min(4,m[1].length+1);html+=`<h${n}>${inline(m[2])}</h${n}>`;i++;continue;}
    if(/^\s*(-{3,}|\*{3,})\s*$/.test(l)){html+='<hr>';i++;continue;}
    if(/^&gt;\s?/.test(l)){let q='';while(i<lines.length&&/^&gt;\s?/.test(lines[i])){q+=lines[i].replace(/^&gt;\s?/,'')+' ';i++;}html+='<blockquote>'+inline(q.trim())+'</blockquote>';continue;}
    if(isTable(l)&&i+1<lines.length&&/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i+1])){
      const row=x=>x.trim().replace(/^\||\|$/g,'').split('|').map(c=>inline(c.trim()));
      const h=row(l);i+=2;let rows='';
      while(i<lines.length&&isTable(lines[i])){rows+='<tr>'+row(lines[i]).map(c=>'<td>'+c+'</td>').join('')+'</tr>';i++;}
      html+='<div class="kai-tbl"><table><thead><tr>'+h.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';continue;
    }
    if(/^\s*([-*•]|\d+[.)])\s+/.test(l)){
      const ord=/^\s*\d+[.)]\s+/.test(l);let items='';
      while(i<lines.length&&/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])){
        const sub=/^\s{2,}/.test(lines[i]);items+=`<li${sub?' class="sub"':''}>`+inline(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/,''))+'</li>';i++;
      }
      html+=ord?'<ol>'+items+'</ol>':'<ul>'+items+'</ul>';continue;
    }
    if(!l.trim()){i++;continue;}
    let p=l;i++;
    while(i<lines.length&&lines[i].trim()&&!/^(#{1,4}\s|```|\s*([-*•]|\d+[.)])\s+|&gt;|\s*\|)/.test(lines[i])){p+='<br>'+lines[i];i++;}
    html+='<p>'+inline(p)+'</p>';
  }
  return html;
}

/* Fenêtre d'activation */
function openKeyDialog(){
  return new Promise(res=>{
    document.querySelectorAll('.kai-dlg-bg').forEach(x=>x.remove());
    const has=!!getKey();
    const bg=document.createElement('div');bg.className='kai-dlg-bg';
    bg.innerHTML=`<div class="kai-dlg" role="dialog" aria-modal="true" aria-label="Activer l'IA gratuite">
      <button class="kai-x" aria-label="Fermer"><span class="ms">close</span></button>
      <div class="kai-dlg-ic"><span class="ms">auto_awesome</span></div>
      <h2>Active l’IA gratuite</h2>
      <p class="kai-lead">City Work utilise <b>Gemini</b>, l’IA de Google : très puissante, elle lit tes PDF (schémas compris) et parle toutes les langues. C’est <b>gratuit</b> avec ton compte Google, il faut juste une « clé » (2 minutes, une seule fois).</p>
      ${has?`<div class="kai-ok"><span class="ms">check_circle</span>L’IA est activée sur cet appareil.</div>`:''}
      <ol class="kai-steps">
        <li><span>1</span><div><b>Ouvre Google AI Studio</b> et connecte-toi avec ton compte Google.<a class="btn btn-g btn-sm" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"><span class="ms">open_in_new</span>Ouvrir AI Studio</a></div></li>
        <li><span>2</span><div>Clique sur <b>« Create API key »</b> (Créer une clé API), puis <b>copie</b> la clé (elle commence par « AQ. » ou « AIza »).</div></li>
        <li><span>3</span><div><b>Colle-la ici :</b><input class="fi kai-in" type="password" autocomplete="off" spellcheck="false" placeholder="${has?'Nouvelle clé (laisse vide pour garder l’actuelle)':'AIza…'}"></div></li>
      </ol>
      <div class="kai-msg" role="status"></div>
      <div class="kai-row">
        <button class="btn btn-p kai-save"><span class="ms">bolt</span>${has?'Remplacer la clé':'Activer l’IA'}</button>
        ${has?'<button class="btn btn-g kai-del"><span class="ms">key_off</span>Retirer la clé</button>':''}
        <button class="btn btn-g kai-cancel">${has?'Fermer':'Plus tard'}</button>
      </div>
      <p class="kai-note"><span class="ms">lock</span>La clé reste sur ton appareil et n’est envoyée qu’à Google. Limite gratuite : plusieurs centaines de messages par jour.</p>
    </div>`;
    document.body.appendChild(bg);
    const inp=bg.querySelector('.kai-in'),msg=bg.querySelector('.kai-msg'),save=bg.querySelector('.kai-save');
    const close=v=>{bg.remove();res(v);};
    bg.addEventListener('click',e=>{if(e.target===bg)close(!!getKey());});
    bg.querySelector('.kai-x').onclick=()=>close(!!getKey());
    bg.querySelector('.kai-cancel').onclick=()=>close(!!getKey());
    const del=bg.querySelector('.kai-del');if(del)del.onclick=()=>{setKey('');showNotif&&showNotif('Clé retirée','ok');close(false);};
    const go=async()=>{
      const k=inp.value.trim().replace(/\s+/g,'');
      if(!k){if(has)close(true);else{msg.className='kai-msg err';msg.textContent='Colle d’abord ta clé.';inp.focus();}return;}
      if(!/^(AIza[\w-]{20,}|AQ\.[\w.-]{20,})$/.test(k)){msg.className='kai-msg err';msg.textContent='Ça ne ressemble pas à une clé Gemini (elle commence par « AIza » ou « AQ. »).';return;}
      const prev=getKey();setKey(k);save.disabled=true;msg.className='kai-msg';msg.textContent='Vérification auprès de Google…';
      try{await models();msg.className='kai-msg ok';msg.textContent='C’est bon, l’IA est activée !';if(typeof showNotif==='function')showNotif('IA gratuite activée','ok');setTimeout(()=>close(true),600);}
      catch(e){setKey(prev);save.disabled=false;msg.className='kai-msg err';msg.textContent=e.message||'Clé refusée';}
    };
    save.onclick=go;
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')go();if(e.key==='Escape')close(!!getKey());});
    setTimeout(()=>inp.focus(),60);
  });
}
async function ensureKey(){if(getKey())return true;return openKeyDialog();}

window.KAI={hasKey:()=>!!getKey(),getKey,setKey,models,ask,stream,pdfPart,pdfText,md,esc,ensureKey,openKeyDialog};
})();
