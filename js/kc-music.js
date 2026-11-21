/* =========================================================
   kc-music.js — v85 (21 nov. 2026) : MUSIQUE « COLLE TA PLAYLIST »
   Un seul bouton Musique (#kc-mus-btn, data-tb="mus", barre du haut) :
     1. on colle le lien d'une playlist / d'un album / d'un titre : Spotify, Apple Music, Deezer, YouTube (et YouTube Music)
        ou SoundCloud ;
     2. le service est reconnu tout seul (parse) et son lecteur officiel s'affiche (iframe « embed ») ;
     3. le lien est retenu ; plusieurs favoris (kp_music {v:1, list:[{id,svc,kind,eid,url,title}], cur}) + playlists de
        révision proposées (DEF) ;
     4. la vraie télécommande Spotify (spotify.js, comptes autorisés) reste en place : lien dans le panneau.
   Le lecteur vit dans un petit dock en bas à gauche (#kmu-dock) qui reste ouvert quand on change de page ;
   « Réduire » le cache sans couper la musique (l'iframe n'est jamais supprimée tant qu'on n'appuie pas sur ✕).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};
const KEY='kp_music';
const SVC={
  spotify:{n:'Spotify',c:'#1DB954',ic:'<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.62.62 0 0 1-.86.2c-2.35-1.43-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.81-.87 7.09-.5 9.73 1.11.3.18.39.57.2.86Zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.57 11.24 1.33.37.22.48.7.25 1.07Zm.1-2.83C14.7 8.94 9.37 8.76 6.3 9.7a.94.94 0 1 1-.54-1.8c3.53-1.07 9.4-.86 13.1 1.34a.94.94 0 0 1-.96 1.61Z"/>'},
  apple:{n:'Apple Music',c:'#FA2D48',ic:'<path d="M16.5 3.2 9 4.9c-.6.13-1 .66-1 1.27v9.13a3.3 3.3 0 0 0-1.5-.3C4.9 15 3.6 16 3.6 17.4s1.3 2.4 2.9 2.4 2.9-1.1 2.9-2.5V9.6l6.6-1.5v5.6a3.3 3.3 0 0 0-1.5-.3c-1.6 0-2.9 1-2.9 2.4s1.3 2.4 2.9 2.4 2.9-1.1 2.9-2.5V4.4c0-.8-.7-1.4-1.5-1.2Z"/>'},
  deezer:{n:'Deezer',c:'#A238FF',ic:'<path d="M3 15h3.6v2H3zm0-3h3.6v2H3zm4.6 3h3.6v2H7.6zm0-3h3.6v2H7.6zm0-3h3.6v2H7.6zm4.6 6h3.6v2h-3.6zm0-3h3.6v2h-3.6zm4.6 3h3.6v2h-3.6zm0-3h3.6v2h-3.6zm0-3h3.6v2h-3.6zm0-3h3.6v2h-3.6z"/>'},
  youtube:{n:'YouTube',c:'#FF0000',ic:'<path d="M21.6 7.2a2.5 2.5 0 0 0-1.77-1.77C18.27 5 12 5 12 5s-6.27 0-7.83.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.77 1.77C5.73 19 12 19 12 19s6.27 0 7.83-.43a2.5 2.5 0 0 0 1.77-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z"/>'},
  soundcloud:{n:'SoundCloud',c:'#FF5500',ic:'<path d="M1 14.5c0 1 .7 1.8 1.6 1.8V12.7c-.9 0-1.6.8-1.6 1.8Zm2.4 1.8h.9v-5.1h-.9zm1.7 0H6v-6.4h-.9zm1.7 0H7.7V9.4h-.9zm1.8 0h.9v-7.6l-.9.4zM11 8.3v8h7.6a3.3 3.3 0 0 0 0-6.6c-.4 0-.8.1-1.2.2A5.2 5.2 0 0 0 11 8.3Z"/>'}
};
const KIND={playlist:'Playlist',album:'Album',track:'Titre',song:'Titre',episode:'Épisode',show:'Podcast',artist:'Artiste',video:'Vidéo',live:'Direct',set:'Playlist',station:'Radio'};
/* playlists de révision proposées par défaut */
const DEF=[
  {svc:'youtube',kind:'live',eid:'v:jfKfPfyJRdk',title:'Lofi Girl — radio lofi pour réviser',url:'https://www.youtube.com/watch?v=jfKfPfyJRdk'},
  {svc:'spotify',kind:'playlist',eid:'playlist/37i9dQZF1DWWQRwui0ExPn',title:'Lofi Beats',url:'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn'},
  {svc:'spotify',kind:'playlist',eid:'playlist/37i9dQZF1DWZeKCadgRdKQ',title:'Deep Focus',url:'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ'},
  {svc:'spotify',kind:'playlist',eid:'playlist/37i9dQZF1DX4sWSpwq3LiO',title:'Peaceful Piano',url:'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO'},
  {svc:'spotify',kind:'playlist',eid:'playlist/37i9dQZF1DWXLeA8Omikj7',title:'Brain Food',url:'https://open.spotify.com/playlist/37i9dQZF1DWXLeA8Omikj7'}
];
function st(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&Array.isArray(s.list))return s;}catch(e){}return {v:1,list:[],cur:null,min:false};}
function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}}

/* ───────── Reconnaître un lien ───────── */
function parse(raw){
  let t=String(raw||'').trim();
  const ifr=t.match(/src=["']([^"']+)["']/i);if(ifr)t=ifr[1];   /* code « Intégrer » collé tel quel */
  let m=t.match(/^spotify:(playlist|album|track|episode|show|artist):([A-Za-z0-9]{10,})/);
  if(m)return {svc:'spotify',kind:m[1],eid:m[1]+'/'+m[2],url:'https://open.spotify.com/'+m[1]+'/'+m[2]};
  if(!/^https?:\/\//i.test(t))t='https://'+t;
  let u;try{u=new URL(t);}catch(e){return null;}
  const h=u.hostname.replace(/^www\./,'').toLowerCase(),p=u.pathname.replace(/\/+$/,'');
  if(h==='open.spotify.com'||h==='play.spotify.com'){
    m=p.match(/(?:\/intl-[a-z-]+)?(?:\/embed)?\/(playlist|album|track|episode|show|artist)\/([A-Za-z0-9]{10,})/);
    if(m)return {svc:'spotify',kind:m[1],eid:m[1]+'/'+m[2],url:'https://open.spotify.com/'+m[1]+'/'+m[2]};
    return {err:'Lien Spotify incomplet : ouvre la playlist, puis Partager → Copier le lien.'};
  }
  if(h==='spotify.link'||h==='spoti.fi')return {err:'Ce lien Spotify raccourci ne peut pas être lu ici : ouvre-le, puis copie le lien complet (open.spotify.com/…).'};
  if(h==='music.apple.com'||h==='embed.music.apple.com'||h==='itunes.apple.com'){
    m=p.match(/^\/([a-z]{2})\/(playlist|album|song|station|music-video)\/(?:[^/]+\/)?([A-Za-z0-9.\-]+)$/);
    if(m)return {svc:'apple',kind:m[2]==='song'?'song':m[2],eid:p.slice(1)+(u.search||''),url:'https://music.apple.com'+p+(u.search||'')};
    return {err:'Lien Apple Music incomplet : dans Musique, ⋯ → Partager → Copier le lien.'};
  }
  if(/(^|\.)deezer\.com$/.test(h)){
    m=p.match(/(?:\/[a-z]{2})?\/(playlist|album|track|artist|show|episode)\/(\d+)/);
    if(m)return {svc:'deezer',kind:m[1],eid:m[1]+'/'+m[2],url:'https://www.deezer.com/'+m[1]+'/'+m[2]};
    return {err:'Lien Deezer incomplet.'};
  }
  if(h==='deezer.page.link'||h==='link.deezer.com')return {err:'Ce lien Deezer raccourci ne peut pas être lu ici : ouvre-le dans ton navigateur, puis copie l’adresse complète (deezer.com/…/playlist/…).'};
  if(/(^|\.)youtube\.com$|^youtu\.be$|^youtube-nocookie\.com$/.test(h)){
    const list=u.searchParams.get('list');let v=u.searchParams.get('v');
    if(h==='youtu.be')v=p.slice(1);
    m=p.match(/^\/(?:embed|live|shorts|v)\/([A-Za-z0-9_-]{6,})/);if(m&&m[1]!=='videoseries')v=m[1];
    if(v&&!/^[A-Za-z0-9_-]{6,}$/.test(v))v=null;
    if(!v&&!list)return {err:'Lien YouTube incomplet : copie l’adresse de la vidéo ou de la playlist.'};
    const live=/^\/live\//.test(p);
    return {svc:'youtube',kind:list&&!v?'playlist':live?'live':list?'playlist':'video',eid:(v?'v:'+v:'')+(list?(v?'|':'')+'l:'+list:''),url:t};
  }
  if(/(^|\.)soundcloud\.com$|^on\.soundcloud\.com$/.test(h)){
    if(h!=='on.soundcloud.com'&&p.split('/').filter(Boolean).length<1)return {err:'Lien SoundCloud incomplet.'};
    return {svc:'soundcloud',kind:/\/sets\//.test(p)?'set':'track',eid:'https://'+h+p,url:'https://'+h+p};
  }
  return null;
}
function embed(it,dark){
  if(it.svc==='spotify')return {src:`https://open.spotify.com/embed/${it.eid}?utm_source=generator${dark?'&theme=0':''}`,h:it.kind==='track'||it.kind==='episode'?152:352,allow:'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'};
  if(it.svc==='apple')return {src:'https://embed.music.apple.com/'+it.eid,h:it.kind==='song'?175:450,allow:'autoplay *; encrypted-media *; fullscreen *; clipboard-write',sandbox:'allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation'};
  if(it.svc==='deezer')return {src:`https://widget.deezer.com/widget/${dark?'dark':'light'}/${it.eid}`,h:it.kind==='track'?150:300,allow:'encrypted-media; clipboard-write'};
  if(it.svc==='youtube'){const v=(it.eid.match(/v:([^|]+)/)||[])[1],l=(it.eid.match(/l:(.+)$/)||[])[1];
    const q='?rel=0&modestbranding=1&playsinline=1'+(l?'&list='+encodeURIComponent(l):'');
    return {src:'https://www.youtube-nocookie.com/embed/'+(v?encodeURIComponent(v):'videoseries')+q,h:200,allow:'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',yt:true};}
  if(it.svc==='soundcloud')return {src:'https://w.soundcloud.com/player/?url='+encodeURIComponent(it.eid)+'&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&visual='+(it.kind==='set'?'true':'false'),h:it.kind==='set'?300:166,allow:'autoplay'};
  return null;
}
const logo=(svc,sz)=>{const S=SVC[svc];return S?`<svg viewBox="0 0 24 24" width="${sz||18}" height="${sz||18}" fill="${S.c}" aria-hidden="true">${S.ic}</svg>`:'';};
/* titre : demande au service quand c'est possible (oEmbed), sinon « Playlist Spotify »… */
async function fetchTitle(it){
  const o={spotify:'https://open.spotify.com/oembed?url=',youtube:'https://www.youtube.com/oembed?format=json&url=',soundcloud:'https://soundcloud.com/oembed?format=json&url='}[it.svc];
  if(!o)return null;
  try{const ctl=new AbortController();setTimeout(()=>ctl.abort(),5000);
    const r=await fetch(o+encodeURIComponent(it.url),{signal:ctl.signal});if(!r.ok)return null;const j=await r.json();return j&&j.title?String(j.title).slice(0,90):null;}catch(e){return null;}
}

/* ───────── Dock du lecteur ───────── */
function dark(){return document.body.classList.contains('dark');}
function dock(){
  let d=$('kmu-dock');if(d)return d;
  d=document.createElement('div');d.id='kmu-dock';d.className='kmu-dock';
  d.innerHTML=`<div class="kmu-dh"><span class="kmu-dl"></span><b class="kmu-dt"></b>
      <button type="button" data-m="list" title="Mes playlists"><span class="ms">queue_music</span></button>
      <button type="button" data-m="min" title="Réduire (la musique continue)"><span class="ms">expand_more</span></button>
      <button type="button" data-m="stop" title="Arrêter et fermer"><span class="ms">close</span></button></div>
    <div class="kmu-fr"></div>`;
  d.addEventListener('click',e=>{const b=e.target.closest('[data-m]');
    if(!b){if(d.classList.contains('min')&&e.target.closest('.kmu-dh'))setMin(false);return;}
    e.stopPropagation();const a=b.dataset.m;
    if(a==='min')setMin(!d.classList.contains('min'));else if(a==='stop')stop();else if(a==='list')window.kcMusicOpen();});
  document.body.appendChild(d);return d;
}
function setMin(v){const d=$('kmu-dock');if(!d)return;d.classList.toggle('min',v);const s=st();s.min=v;save(s);
  const i=d.querySelector('[data-m="min"] .ms');if(i)i.textContent=v?'expand_less':'expand_more';}
function play(it,fromUser){
  const e=embed(it,dark());if(!e)return;
  const d=dock(),fr=d.querySelector('.kmu-fr');
  d.querySelector('.kmu-dl').innerHTML=logo(it.svc,16);d.querySelector('.kmu-dt').textContent=it.title||((KIND[it.kind]||'')+' '+SVC[it.svc].n);
  fr.innerHTML=`<iframe title="${esc(SVC[it.svc].n)}" src="${esc(e.src)}" height="${e.h}" allow="${e.allow}" ${e.sandbox?`sandbox="${e.sandbox}"`:''} loading="eager" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  fr.style.setProperty('--h',e.h+'px');
  d.classList.add('on');d.dataset.svc=it.svc;
  const s=st();s.cur=it.id||it.eid;save(s);setMin(false);
  syncBtn();
  if(fromUser&&e.yt&&location.protocol==='file:')notify('YouTube peut refuser de jouer quand le site est ouvert depuis un fichier : utilise l’adresse en ligne du site','ok');
}
function stop(){const d=$('kmu-dock');if(d){d.querySelector('.kmu-fr').innerHTML='';d.classList.remove('on','min');}const s=st();s.cur=null;save(s);syncBtn();}
function syncBtn(){const b=$('kc-mus-btn');if(b)b.classList.toggle('kmu-live',!!($('kmu-dock')&&$('kmu-dock').classList.contains('on')));}

/* ───────── Panneau ───────── */
let PANEL=null;
function rowHTML(it,mine){
  const cur=st().cur===(it.id||it.eid)&&$('kmu-dock')?.classList.contains('on');
  return `<div class="kmu-row${cur?' on':''}" data-id="${esc(it.id||it.eid)}" data-def="${mine?'':'1'}">
    <span class="kmu-ic" style="--c:${SVC[it.svc].c}">${logo(it.svc,20)}</span>
    <span class="kmu-tx"><b>${esc(it.title||((KIND[it.kind]||'Lien')+' '+SVC[it.svc].n))}</b><small>${esc(SVC[it.svc].n)} · ${esc(KIND[it.kind]||'')}</small></span>
    <button type="button" class="kmu-play" data-k="play" title="${cur?'En cours':'Écouter'}"><span class="ms">${cur?'graphic_eq':'play_arrow'}</span></button>
    ${mine?`<button type="button" class="kmu-mini" data-k="ren" title="Renommer"><span class="ms">edit</span></button><button type="button" class="kmu-mini" data-k="del" title="Retirer"><span class="ms">delete</span></button>`
      :`<button type="button" class="kmu-mini" data-k="fav" title="Ajouter à mes playlists"><span class="ms">bookmark_add</span></button>`}
  </div>`;
}
function panelHTML(){
  const s=st();let spot='';
  try{const g=typeof window.spGetState==='function'?window.spGetState():null;
    spot=`<div class="kmu-spot"><span class="kmu-ic" style="--c:#1DB954">${logo('spotify',18)}</span><span><b>Télécommande Spotify</b><small>${g&&g.on?'Connectée : pilote ton Spotify depuis la barre du haut (S = pause, D = suivant)':'Pour les comptes autorisés : contrôle ton vrai Spotify (téléphone, ordinateur…)'}</small></span>${g&&g.on?'':'<button type="button" class="btn btn-g btn-sm" data-k="spot">Connecter</button>'}</div>`;}catch(e){}
  return `<div class="kmu-h"><span class="kmu-hic"><span class="ms">queue_music</span></span><div><b>Ta musique pour réviser</b><small>Colle le lien d’une playlist : elle joue ici, même quand tu changes de page.</small></div><button type="button" class="kmu-x" data-k="close" aria-label="Fermer"><span class="ms">close</span></button></div>
    <form class="kmu-add" data-k="add"><span class="ms">link</span><input id="kmu-in" type="text" inputmode="url" placeholder="Colle ici le lien de ta playlist…" autocomplete="off" spellcheck="false"><button type="submit" class="btn btn-p btn-sm">Ajouter</button></form>
    <div class="kmu-svcs">${Object.keys(SVC).map(k=>`<span title="${SVC[k].n}">${logo(k,16)}${SVC[k].n}</span>`).join('')}</div>
    <div class="kmu-msg" id="kmu-msg" hidden></div>
    <div class="kmu-sec">Mes playlists ${s.list.length?`<em>${s.list.length}</em>`:''}</div>
    <div class="kmu-list">${s.list.length?s.list.map(it=>rowHTML(it,true)).join(''):'<div class="kmu-empty">Aucune pour l’instant : colle un lien au-dessus, ou ajoute une playlist de révision ci-dessous.</div>'}</div>
    <div class="kmu-sec">Playlists de révision</div>
    <div class="kmu-list">${DEF.map(it=>rowHTML(it,false)).join('')}</div>
    ${spot}
    <small class="kmu-note"><span class="ms">info</span>Chaque lecteur est le lecteur officiel du service : sans compte, Spotify et Apple Music ne jouent souvent que des extraits de 30 s ; connecte-toi dans le lecteur pour tout écouter.</small>`;
}
function msg(t,err){const m=$('kmu-msg');if(!m)return;m.hidden=!t;m.textContent=t||'';m.classList.toggle('err',!!err);}
function renderP(){if(PANEL){const sc=PANEL.querySelector('.kmu-p').scrollTop;PANEL.querySelector('.kmu-p').innerHTML=panelHTML();PANEL.querySelector('.kmu-p').scrollTop=sc;}}
function closeP(){if(!PANEL)return;const p=PANEL;PANEL=null;p.classList.remove('open');setTimeout(()=>p.remove(),180);document.removeEventListener('keydown',keyP,true);}
function keyP(e){if(e.key==='Escape'&&PANEL){e.stopPropagation();closeP();}}
async function add(raw){
  const r=parse(raw);
  if(!r){msg('Je ne reconnais pas ce lien. Colle un lien Spotify, Apple Music, Deezer, YouTube ou SoundCloud.',true);return;}
  if(r.err){msg(r.err,true);return;}
  const s=st();let it=s.list.find(x=>x.svc===r.svc&&x.eid===r.eid);
  if(!it){it=Object.assign({id:'m'+Date.now().toString(36),title:''},r);s.list.unshift(it);if(s.list.length>40)s.list.length=40;save(s);}
  msg('');const inp=$('kmu-in');if(inp)inp.value='';
  play(it,true);renderP();
  if(!it.title){const t=await fetchTitle(it);if(t){const s2=st(),x=s2.list.find(y=>y.id===it.id);if(x){x.title=t;save(s2);renderP();const dt=document.querySelector('#kmu-dock .kmu-dt');if(dt&&st().cur===x.id)dt.textContent=t;}}}
}
window.kcMusicOpen=function(ev){
  if(PANEL){closeP();return;}
  const p=document.createElement('div');p.className='kmu-pbg';p.id='kmu-panel';
  p.innerHTML='<div class="kmu-p" role="dialog" aria-label="Musique"></div>';
  document.body.appendChild(p);PANEL=p;renderP();
  const btn=$('kc-mus-btn'),box=p.querySelector('.kmu-p');
  if(btn&&btn.getBoundingClientRect().width&&innerWidth>640){const r=btn.getBoundingClientRect();box.style.top=Math.round(r.bottom+8)+'px';box.style.right=Math.max(12,Math.round(innerWidth-r.right-40))+'px';}
  else p.classList.add('center');
  requestAnimationFrame(()=>p.classList.add('open'));
  document.addEventListener('keydown',keyP,true);
  p.addEventListener('mousedown',e=>{if(e.target===p)closeP();});
  p.addEventListener('submit',e=>{e.preventDefault();add($('kmu-in').value);});
  p.addEventListener('paste',e=>{if(e.target.id!=='kmu-in')return;setTimeout(()=>{const v=$('kmu-in').value;if(parse(v)&&!parse(v).err)add(v);},30);});
  p.addEventListener('click',e=>{
    const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;
    if(k==='close'){closeP();return;}
    if(k==='spot'){closeP();if(typeof window.spotifyLogin==='function')window.spotifyLogin();return;}
    const row=b.closest('.kmu-row');if(!row)return;
    const id=row.dataset.id,def=row.dataset.def==='1',s=st();
    const it=def?DEF.find(x=>x.eid===id):s.list.find(x=>x.id===id);if(!it)return;
    if(k==='play'){play(it,true);renderP();}
    else if(k==='fav'){if(!s.list.some(x=>x.eid===it.eid)){s.list.unshift(Object.assign({id:'m'+Date.now().toString(36)},it));save(s);}renderP();notify('Ajoutée à tes playlists','ok');}
    else if(k==='del'){s.list=s.list.filter(x=>x.id!==id);save(s);if(s.cur===id)stop();renderP();}
    else if(k==='ren'){(typeof kcPrompt==='function'?kcPrompt('Nom de la playlist',it.title||'',{icon:'edit'}):Promise.resolve(null)).then(v=>{if(v==null)return;const s2=st(),x=s2.list.find(y=>y.id===id);if(x){x.title=String(v).trim().slice(0,90);save(s2);renderP();}});}
  });
  setTimeout(()=>{const i=$('kmu-in');if(i&&matchMedia('(pointer:fine)').matches)i.focus();},60);
};
window.kcMusicParse=parse;
/* Le lecteur ne se recharge pas tout seul au démarrage (pas d'iframe tierce sans action de l'utilisateur) :
   la dernière playlist est en tête de « Mes playlists ». */
})();
