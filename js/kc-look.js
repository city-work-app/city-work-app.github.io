/* =========================================================
   kc-look.js — v85 (21 nov. 2026) : PERSONNALISATION
   1. Fond d'écran du site (#kc-wall) : aucun · ta photo · dégradé animé (6) · ta ville (scène kcCityScene) · saison
      (change tout seul : printemps, été, automne, hiver). Voile réglable pour garder le texte lisible.
      Clés : kp_wall {t:'none'|'photo'|'grad'|'city'|'season', g, veil, blur} ; photo dans kp_wall_img (grande mémoire).
   2. Thèmes de saison automatiques : Noël (1er–31 déc.), Halloween (24 oct.–1er nov.), printemps (20 mars–30 avril) :
      petites particules (neige, chauves-souris, pétales) sauf pendant un quiz, et le personnage met tout seul
      un bonnet de Noël / un chapeau de sorcier / une couronne de fleurs (gamAvatarSVG enveloppé).
      kp_season = 'auto' | 'off' ; kp_season_char = '0' pour garder son chapeau ; essai : kcSeasonTry('noel').
   3. Profil vitrine (kp_vitrine {b: bannière, g: badge préféré, bio, city}) : affiché sur mon profil et dans la fiche
      d'un ami (socialOpenFriend enveloppé) ; envoyé au serveur dans avatar._v (kcVitrineData, kc-onboard.js).
   4. Carte « Ambiance du site » dans Paramètres (fond, saisons, personnage du quiz, vitrine).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const J=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const JS=(k,v)=>{try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};
function G(n,d){try{const v=eval(n);return v===undefined?d:v;}catch(e){return d;}}
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.dataset.motion==='off'||document.body.classList.contains('kc-no-motion');

/* ───────── 1. Fond d'écran ───────── */
const GRADS={
  aurore:['Aurore','#6366f1','#a855f7','#ec4899','#22d3ee'],
  ocean:['Océan','#0ea5e9','#2563eb','#14b8a6','#38bdf8'],
  coucher:['Coucher de soleil','#f97316','#ec4899','#facc15','#f43f5e'],
  foret:['Forêt','#16a34a','#65a30d','#0d9488','#84cc16'],
  nuit:['Nuit étoilée','#0f172a','#312e81','#1e3a8a','#4c1d95'],
  pastel:['Pastel','#fbcfe8','#bfdbfe','#ddd6fe','#bbf7d0']
};
const SEAS={
  printemps:['Printemps','#fbcfe8','#bbf7d0','#fde68a','#f9a8d4'],
  ete:['Été','#38bdf8','#facc15','#fb923c','#22d3ee'],
  automne:['Automne','#ea580c','#b45309','#facc15','#9a3412'],
  hiver:['Hiver','#bfdbfe','#e0f2fe','#c7d2fe','#94a3b8']
};
function seasonNow(d){d=d||new Date();const m=d.getMonth()+1,dd=d.getDate(),k=m*100+dd;
  return k>=320&&k<621?'printemps':k>=621&&k<923?'ete':k>=923&&k<1221?'automne':'hiver';}
function wall(){return Object.assign({t:'none',g:'aurore',veil:62,blur:0},J('kp_wall',{}));}
function grad(c){return `linear-gradient(120deg,${c[1]},${c[2]},${c[3]},${c[4]},${c[1]})`;}
let cityT=0;
function applyWall(){
  const w=wall(),html=document.documentElement;
  let el=$('kc-wall');
  if(w.t==='none'){if(el)el.remove();html.classList.remove('kc-wp');clearInterval(cityT);return;}
  if(!el){el=document.createElement('div');el.id='kc-wall';el.setAttribute('aria-hidden','true');el.innerHTML='<div class="kcw-img"></div><div class="kcw-veil"></div>';document.body.insertBefore(el,document.body.firstChild);}
  html.classList.add('kc-wp');
  const img=el.querySelector('.kcw-img');img.className='kcw-img';img.style.cssText='';img.innerHTML='';clearInterval(cityT);
  el.style.setProperty('--veil',(Math.max(0,Math.min(95,w.veil))/100).toFixed(2));
  if(w.t==='photo'){const src=LS('kp_wall_img','');if(src){img.style.backgroundImage=`url("${src}")`;img.classList.add('photo');img.style.filter=w.blur?`blur(${w.blur}px)`:'';}}
  else if(w.t==='grad'){img.style.backgroundImage=grad(GRADS[w.g]||GRADS.aurore);img.classList.add('grad');}
  else if(w.t==='season'){const s=seasonNow();img.style.backgroundImage=grad(SEAS[s]);img.classList.add('grad','season-'+s);}
  else if(w.t==='city'){img.classList.add('city');cityWall(img);cityT=setInterval(()=>{if(!document.hidden)cityWall(img);},10*60e3);}
}
function cityWall(img){
  if(typeof window.kcCityScene!=='function')return;
  let meta=null;try{meta=JSON.parse(localStorage.getItem('kcu_city_meta')||'null');}catch(e){}
  const lv=(()=>{try{return typeof gamLevelInfo==='function'?gamLevelInfo(G('gam',{}).xp||0).level:1;}catch(e){return 1;}})();
  img.innerHTML='<div class="kcw-cs"></div>';const box=img.firstChild;
  const fit=()=>{const k=Math.max(innerWidth/640,innerHeight/300);box.style.transform=`translate(-50%,-50%) scale(${k.toFixed(3)})`;};
  window.kcCityScene({el:box,pop:meta&&meta.pop||0,lv});fit();
  if(!img._rs){img._rs=1;addEventListener('resize',fit);}
}
async function pickPhoto(){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=()=>{const f=inp.files&&inp.files[0];if(!f)return;
    const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{
      const k=Math.min(1,2200/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      try{localStorage.setItem('kp_wall_img',c.toDataURL('image/jpeg',.84));}catch(e){notify('Photo trop lourde pour la mémoire du navigateur','err');return;}
      JS('kp_wall',Object.assign(wall(),{t:'photo'}));applyWall();renderCard();notify('Fond d’écran mis à jour','ok');};im.src=fr.result;};fr.readAsDataURL(f);};
  inp.click();
}

/* ───────── 2. Thèmes de saison ───────── */
const FEST={noel:{n:'Noël',ic:'ac_unit',hat:'noel'},halloween:{n:'Halloween',ic:'nights_stay',hat:'sorcier'},printemps:{n:'Printemps',ic:'local_florist',hat:'fleurs'}};
function festNow(){
  const f=sessionStorage.getItem('kp_season_try');if(f&&FEST[f])return f;
  if(LS('kp_season','auto')==='off')return null;
  const d=new Date(),m=d.getMonth()+1,dd=d.getDate(),k=m*100+dd;
  if(m===12)return 'noel';
  if((m===10&&dd>=24)||(m===11&&dd<=1))return 'halloween';
  if(k>=320&&k<=430)return 'printemps';
  return null;
}
/* le personnage s'habille tout seul */
(function wrapAv(){
  const A=window.gamAvatarSVG;if(typeof A!=='function'){setTimeout(wrapAv,300);return;}if(A._kcs)return;
  const w=function(ch,size){
    try{const f=festNow(),edit=document.querySelector('#modal-gam-char.open');if(f&&!edit&&LS('kp_season_char','1')!=='0'&&ch&&typeof ch==='object'&&!ch._noFest){ch=Object.assign({},ch,{hat:FEST[f].hat});}}catch(e){}
    return A.call(this,ch,size);
  };w._kcs=true;window.gamAvatarSVG=w;
})();
let PT={raf:0,cv:null,ps:[],kind:null,last:0};
function particles(){
  const f=festNow(),hide=!f||reduce()||/^(quiz|annales|concept-fc|city|house)$/.test(document.body.dataset.screen||'');
  document.documentElement.dataset.fest=f||'';
  if(hide){if(PT.cv){PT.cv.remove();PT.cv=null;}cancelAnimationFrame(PT.raf);PT.raf=0;return;}
  if(!PT.cv){PT.cv=document.createElement('canvas');PT.cv.id='kc-season';PT.cv.setAttribute('aria-hidden','true');document.body.appendChild(PT.cv);}
  if(PT.kind!==f){PT.kind=f;PT.ps=[];}
  size();if(!PT.raf)PT.raf=requestAnimationFrame(tick);
}
function size(){if(!PT.cv)return;const d=Math.min(2,devicePixelRatio||1);PT.cv.width=innerWidth*d;PT.cv.height=innerHeight*d;PT.cv.style.width=innerWidth+'px';PT.cv.style.height=innerHeight+'px';PT.d=d;}
function spawn(top){
  const W=innerWidth,H=innerHeight,k=PT.kind;
  if(k==='noel')return {x:Math.random()*W,y:top?-10:Math.random()*H,r:1.2+Math.random()*2.6,vy:.25+Math.random()*.6,vx:0,ph:Math.random()*6,a:.45+Math.random()*.45};
  if(k==='printemps')return {x:Math.random()*W,y:top?-12:Math.random()*H,r:4+Math.random()*4,vy:.35+Math.random()*.5,vx:.2+Math.random()*.4,ph:Math.random()*6,rot:Math.random()*6,a:.55+Math.random()*.35,c:['#f9a8d4','#fbcfe8','#fda4af','#fff1f2'][Math.floor(Math.random()*4)]};
  return {x:top?-30:Math.random()*W,y:40+Math.random()*H*.5,r:7+Math.random()*6,vx:.6+Math.random()*.9,vy:0,ph:Math.random()*6,a:.55};
}
function tick(t){
  PT.raf=0;if(!PT.cv||document.hidden){if(PT.cv)PT.raf=requestAnimationFrame(tick);return;}
  const x=PT.cv.getContext('2d'),d=PT.d||1,W=innerWidth,H=innerHeight,k=PT.kind;
  const N=k==='noel'?Math.round(W*H/26000):k==='printemps'?Math.round(W*H/60000):3;
  while(PT.ps.length<N)PT.ps.push(spawn(PT.ps.length>N/2));
  x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,W,H);
  const dark=document.body.classList.contains('dark');
  PT.ps.forEach((p,i)=>{
    p.ph+=.012;
    if(k==='noel'){p.y+=p.vy;p.x+=Math.sin(p.ph)*.3;x.globalAlpha=p.a;x.fillStyle=dark?'#fff':'#cbd5e1';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill();}
    else if(k==='printemps'){p.y+=p.vy;p.x+=p.vx+Math.sin(p.ph)*.4;p.rot+=.01;x.globalAlpha=p.a;x.save();x.translate(p.x,p.y);x.rotate(p.rot+Math.sin(p.ph));x.fillStyle=p.c;x.beginPath();x.ellipse(0,0,p.r,p.r*.55,0,0,7);x.fill();x.restore();}
    else{p.x+=p.vx;p.y+=Math.sin(p.ph*3)*.6;x.globalAlpha=p.a;x.fillStyle=dark?'#e9d5ff':'#1f2937';const f=Math.sin(p.ph*14)*.5+.5,r=p.r;
      x.beginPath();x.moveTo(p.x,p.y);x.quadraticCurveTo(p.x-r*.9,p.y-r*(.3+f*.6),p.x-r*1.6,p.y-r*.1);x.quadraticCurveTo(p.x-r*.9,p.y+r*.05,p.x,p.y+r*.25);
      x.quadraticCurveTo(p.x+r*.9,p.y+r*.05,p.x+r*1.6,p.y-r*.1);x.quadraticCurveTo(p.x+r*.9,p.y-r*(.3+f*.6),p.x,p.y);x.fill();}
    if(p.y>H+14||p.x>W+40)PT.ps[i]=spawn(true);
  });
  x.globalAlpha=1;
  PT.raf=requestAnimationFrame(tick);
}
addEventListener('resize',()=>{if(PT.cv)size();});
new MutationObserver(particles).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
window.kcSeasonTry=function(f){
  if(f&&FEST[f])sessionStorage.setItem('kp_season_try',f);else sessionStorage.removeItem('kp_season_try');
  particles();refreshAv();renderCard();
};
function refreshAv(){try{if(typeof gamRefreshUI==='function')gamRefreshUI();}catch(e){}try{if(typeof renderHome==='function'&&document.body.dataset.screen==='home')renderHome();}catch(e){}}

/* ───────── 3. Profil vitrine ───────── */
const BANNERS={
  aurore:['Aurore','linear-gradient(120deg,#6366f1,#a855f7 50%,#ec4899)'],ocean:['Océan','linear-gradient(120deg,#0ea5e9,#2563eb 60%,#14b8a6)'],
  coucher:['Coucher de soleil','linear-gradient(120deg,#f97316,#ec4899 55%,#facc15)'],foret:['Forêt','linear-gradient(120deg,#14532d,#16a34a 55%,#a3e635)'],
  nuit:['Nuit','radial-gradient(circle at 20% 30%,#fff 0 1px,transparent 1.5px),radial-gradient(circle at 70% 60%,#fff 0 1px,transparent 1.5px),radial-gradient(circle at 45% 20%,#fff 0 .8px,transparent 1.2px),linear-gradient(135deg,#0f172a,#312e81)'],
  bonbon:['Bonbon','repeating-linear-gradient(45deg,#fbcfe8 0 14px,#fce7f3 14px 28px)'],
  cobalt:['Cobalt','linear-gradient(120deg,#1e3a8a,#2b5cff)'],
  or:['Or','linear-gradient(120deg,#78350f,#f59e0b 50%,#fde68a)'],
  menthe:['Menthe','linear-gradient(120deg,#0d9488,#5eead4)'],
  lave:['Lave','linear-gradient(120deg,#450a0a,#dc2626 55%,#fb923c)'],
  grille:['Cahier','linear-gradient(#93c5fd55 1px,transparent 1px) 0 0/100% 18px,linear-gradient(90deg,#fca5a5 2px,transparent 2px) 28px 0/100% 100% no-repeat,#f8fafc'],
  confetti:['Confettis','radial-gradient(circle at 15% 25%,#f43f5e 0 4px,transparent 5px),radial-gradient(circle at 60% 70%,#3b82f6 0 4px,transparent 5px),radial-gradient(circle at 85% 30%,#facc15 0 4px,transparent 5px),radial-gradient(circle at 35% 80%,#22c55e 0 4px,transparent 5px),#fff7ed']
};
function myBadges(){
  const st=G('stats',{})||{},gam=G('gam',{})||{},out=[];
  let lv=1;try{lv=typeof gamLevelFromXP==='function'?gamLevelFromXP(gam.xp||0):1;}catch(e){}
  let rec=0;try{const dc=G('dailyCounts',{})||{};const ks=Object.keys(dc).filter(k=>dc[k]>0).sort();let run=0,prev=null;
    ks.forEach(k=>{const d=new Date(k);if(prev&&Math.round((d-prev)/864e5)===1)run++;else run=1;prev=d;rec=Math.max(rec,run);});}catch(e){}
  rec=Math.max(rec,st.streak||0);
  const tot=st.totalAnswered||0;
  const add=(id,ic,t,c)=>out.push({id,ic,t,c});
  add('lv','military_tech','Niveau '+lv,'#2b5cff');
  if(rec>=3)add('st'+(rec>=100?100:rec>=30?30:rec>=7?7:3),'local_fire_department','Série de '+(rec>=100?100:rec>=30?30:rec>=7?7:3)+' jours','#f97316');
  [[10000,'10 000 questions'],[5000,'5 000 questions'],[1000,'1 000 questions'],[100,'100 questions']].some(([n,t])=>{if(tot>=n){add('q'+n,'quiz',t,'#7c4deb');return true;}return false;});
  try{const m=JSON.parse(localStorage.getItem('kcu_city_meta')||'null');if(m&&m.name)add('maire','location_city','Maire de '+String(m.name).slice(0,24),'#12a35e');}catch(e){}
  const pf=LS('kp_prof','').replace(/"/g,''),P=window.KC_PROFS||{};if(P[pf])add('fil',P[pf].ic,P[pf].n,'#0a92d1');
  if(st.totalAnswered>=50&&st.totalCorrect/st.totalAnswered>=.8)add('prec','target','Précision 80 %+','#e5394f');
  return out;
}
function vit(){return Object.assign({b:'aurore',g:'lv',bio:'',city:true},J('kp_vitrine',{}));}
window.kcVitrineData=function(){
  const v=vit(),b=myBadges().find(x=>x.id===v.g)||myBadges()[0];
  let m=null;try{m=JSON.parse(localStorage.getItem('kcu_city_meta')||'null');}catch(e){}
  const o={b:v.b,bio:String(v.bio||'').slice(0,120)};
  if(b)o.g={ic:b.ic,t:b.t,c:b.c};
  if(v.city&&m)o.c={n:String(m.name||'').slice(0,28),p:m.pop|0};
  return o;
};
/* carte vitrine (moi ou un ami) */
window.kcVitrineHTML=function(p,me){
  const v=me?window.kcVitrineData():(p&&p.avatar&&p.avatar._v)||null;
  if(!v&&!me)return '';
  const B=BANNERS[v&&v.b]||BANNERS.aurore,nm=me?(LS('kp_firstname','')||'Moi'):(p.display_name||p.username||'');
  const P=window.KC_PROFS||{},f=me?LS('kp_prof','').replace(/"/g,''):(p.avatar&&p.avatar._f),e=me?LS('kp_school',''):(p.avatar&&p.avatar._e);
  const av=typeof gamAvatarSVG==='function'?gamAvatarSVG(me?(G('gam',{}).char||{}):p.avatar,92):'';
  return `<div class="kvt">
    <div class="kvt-ban" style="background:${B[1]}">${v&&v.c?`<div class="kvt-city" data-pop="${v.c.p|0}"></div>`:''}</div>
    <div class="kvt-row"><div class="kvt-av">${av}</div>
      <div class="kvt-tx"><b>${esc(nm)}</b><span>${[f&&P[f]?P[f].n:'',e||''].filter(Boolean).map(esc).join(' · ')}</span></div>
      ${v&&v.g?`<span class="kvt-badge" style="--c:${esc(v.g.c||'#2b5cff')}"><span class="ms">${esc(v.g.ic||'star')}</span>${esc(v.g.t)}</span>`:''}
      ${me?`<button type="button" class="btn btn-g btn-sm kvt-edit" onclick="kcVitrineEdit()"><span class="ms" style="font-size:16px">edit</span>Modifier</button>`:''}</div>
    ${v&&v.bio?`<p class="kvt-bio">${esc(v.bio)}</p>`:''}
    ${v&&v.c&&v.c.n?`<small class="kvt-cn"><span class="ms">location_city</span>${esc(v.c.n)} · ${(v.c.p|0).toLocaleString('fr-FR')} habitants</small>`:''}
  </div>`;
};
function fillCities(root){
  (root||document).querySelectorAll('.kvt-city:not(.done)').forEach(el=>{el.classList.add('done');
    try{if(typeof window.kcCityScene==='function'){const box=document.createElement('div');box.className='kvt-cs';el.appendChild(box);window.kcCityScene({el:box,pop:+el.dataset.pop||0,lv:5});}}catch(e){}});
}
window.kcVitrineEdit=function(){
  if(typeof window.kcDlg!=='function')return;
  const v=vit(),bs=myBadges();
  const body=()=>`<div class="kvt-ed">${window.kcVitrineHTML(null,true).replace('kvt-edit','kvt-edit hide')}
    <div class="kvt-l">Bannière</div><div class="kvt-bans">${Object.entries(BANNERS).map(([k,b])=>`<button type="button" class="${vit().b===k?'on':''}" data-vb="${k}" style="background:${b[1]}" title="${esc(b[0])}" aria-label="${esc(b[0])}"></button>`).join('')}</div>
    <div class="kvt-l">Badge préféré</div><div class="kvt-bgs">${bs.map(b=>`<button type="button" class="${vit().g===b.id?'on':''}" data-vg="${b.id}" style="--c:${b.c}"><span class="ms">${b.ic}</span>${esc(b.t)}</button>`).join('')}</div>
    <div class="kvt-l">Petite phrase</div><input class="fi" id="kvt-bio" maxlength="120" placeholder="ex : En route vers le D.E. !" value="${esc(vit().bio)}">
    <label class="kvt-ck"><input type="checkbox" id="kvt-city"${vit().city?' checked':''}> Montrer ma ville en miniature</label>
    <small class="kvt-n">Tes amis voient ta vitrine dans ta fiche (Amis &amp; classement). Ton personnage animé est celui de « Mon personnage ».</small></div>`;
  const D=window.kcDlg({title:'Ma vitrine',sub:'Ce que tes amis voient de toi',icon:'badge',body:body(),
    foot:'<button class="btn btn-g" data-x>Fermer</button><button class="btn btn-p" data-ok>Enregistrer</button>',
    onOpen:bg=>{bg.classList.add('kvt-dlg');fillCities(bg);
      const re=()=>{const sc=bg.querySelector('.kc-dlg-b').scrollTop;bg.querySelector('.kc-dlg-b').innerHTML=body();bg.querySelector('.kc-dlg-b').scrollTop=sc;fillCities(bg);};
      bg.addEventListener('click',e=>{const b=e.target.closest('[data-vb],[data-vg]');if(!b)return;const o=vit();
        if(b.dataset.vb)o.b=b.dataset.vb;else o.g=b.dataset.vg;JS('kp_vitrine',o);re();});
      bg.addEventListener('change',e=>{if(e.target.id==='kvt-city'){const o=vit();o.city=e.target.checked;JS('kp_vitrine',o);re();}});
      bg.addEventListener('input',e=>{if(e.target.id==='kvt-bio'){const o=vit();o.bio=e.target.value;JS('kp_vitrine',o);}});},
    onOk:()=>{try{if(typeof socialPushProfile==='function')socialPushProfile(true);}catch(e){}myCard();notify('Vitrine enregistrée','ok');}});
  return D;
};
/* sur mon profil */
function myCard(){
  const s=$('screen-profil-hub');if(!s)return;
  let c=$('kvt-me');
  if(!c){const w=s.querySelector('.wrap,.hub-wrap')||s;c=document.createElement('div');c.id='kvt-me';
    const h=w.querySelector('.hub-header');if(h&&h.nextSibling)w.insertBefore(c,h.nextSibling);else w.insertBefore(c,w.firstChild);}
  c.innerHTML=window.kcVitrineHTML(null,true);fillCities(c);
}
new MutationObserver(()=>{if(document.body.dataset.screen==='profil-hub')myCard();}).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
/* dans la fiche d'un ami */
(function wrapFriend(){
  const F=window.socialOpenFriend;if(typeof F!=='function'){setTimeout(wrapFriend,500);return;}if(F._kvt)return;
  const w=async function(id){
    const r=await F.apply(this,arguments);
    try{const body=$('modal-soc-friend-body'),head=body&&body.querySelector('.sf-head');
      if(head&&!body.querySelector('.kvt')){
        const p=await _rpc('get_user_profile',{p_user:id}).catch(()=>null);
        if(p&&p.avatar&&p.avatar._v){head.insertAdjacentHTML('beforebegin',window.kcVitrineHTML(p,false));head.classList.add('kvt-under');fillCities(body);}
      }}catch(e){}
    return r;
  };w._kvt=true;window.socialOpenFriend=w;
})();

/* ───────── 4. Carte Paramètres ───────── */
function renderCard(){
  const anchor=$('kp-prof-grid');if(!anchor)return;
  const host=anchor.closest('.settings-card');if(!host)return;
  let c=$('kc-look-card');
  if(!c){c=document.createElement('div');c.className='settings-card';c.id='kc-look-card';host.after(c);}
  const w=wall(),f=festNow(),tr=sessionStorage.getItem('kp_season_try');
  const tile=(t,g,label,bg)=>`<button type="button" class="kcl-t${w.t===t&&(!g||w.g===g)?' on':''}" data-wt="${t}"${g?` data-wg="${g}"`:''} style="${bg?'background:'+bg:''}"><span>${esc(label)}</span></button>`;
  c.innerHTML=`<div class="settings-card-hd" style="display:flex;align-items:center;gap:10px"><span class="ms" style="font-size:18px;color:var(--primary)">wallpaper</span>
      <div><div class="settings-card-title">Ambiance du site</div><div class="settings-card-desc">Fond d’écran, thèmes de saison et ton personnage pendant le quiz</div></div></div>
    <div class="kcl-l">Fond d’écran</div>
    <div class="kcl-walls">
      ${tile('none','','Aucun','var(--kc-surface-2)')}
      <button type="button" class="kcl-t photo${w.t==='photo'?' on':''}" data-wt="photo" style="${LS('kp_wall_img','')&&w.t==='photo'?`background-image:url('${LS('kp_wall_img','')}')`:''}"><span class="ms">add_photo_alternate</span><span>Ma photo</span></button>
      ${Object.entries(GRADS).map(([k,g])=>tile('grad',k,g[0],grad(g))).join('')}
      ${tile('city','','Ma ville','linear-gradient(#7dd3fc,#bae6fd 60%,#86efac 61%)')}
      ${tile('season','','Saison · '+SEAS[seasonNow()][0],grad(SEAS[seasonNow()]))}
    </div>
    ${w.t!=='none'?`<div class="kcl-sl"><label><span>Voile (lisibilité)</span><input type="range" min="20" max="90" value="${w.veil}" data-wv="veil"></label>${w.t==='photo'?`<label><span>Flou</span><input type="range" min="0" max="16" value="${w.blur}" data-wv="blur"></label>`:''}</div>`:''}
    <div class="kcl-l">Thèmes de saison</div>
    <div class="kcl-row"><label class="kcl-sw"><input type="checkbox" data-k="season"${LS('kp_season','auto')!=='off'?' checked':''}><i></i><span>Automatiques (Noël, Halloween, printemps)</span></label>
      <label class="kcl-sw"><input type="checkbox" data-k="schar"${LS('kp_season_char','1')!=='0'?' checked':''}><i></i><span>Mon personnage s’habille pour l’occasion</span></label></div>
    <div class="kcl-try"><span>Essayer :</span>${Object.entries(FEST).map(([k,v])=>`<button type="button" class="${tr===k?'on':''}" data-try="${k}"><span class="ms">${v.ic}</span>${v.n}</button>`).join('')}${tr?'<button type="button" data-try=""><span class="ms">close</span>Arrêter l’essai</button>':''}
      <small>${f&&!tr?'En ce moment : '+FEST[f].n:''}</small></div>
    <div class="kcl-l">Pendant le quiz</div>
    <div class="kcl-row"><label class="kcl-sw"><input type="checkbox" data-k="buddy"${LS('kp_buddy','1')!=='0'?' checked':''}><i></i><span>Mon personnage réagit à mes réponses</span></label></div>
    <div class="kcl-row"><button type="button" class="btn btn-g btn-sm" onclick="kcVitrineEdit()"><span class="ms" style="font-size:16px">badge</span>Ma vitrine (profil pour mes amis)</button></div>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#kc-look-card [data-wt],#kc-look-card [data-try]');if(!b)return;
  if(b.dataset.try!==undefined){window.kcSeasonTry(b.dataset.try);return;}
  const t=b.dataset.wt;
  if(t==='photo'&&(!LS('kp_wall_img','')||wall().t==='photo')){pickPhoto();return;}
  JS('kp_wall',Object.assign(wall(),{t,g:b.dataset.wg||wall().g}));applyWall();renderCard();
});
document.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.wv;if(!k)return;const w=wall();w[k]=+e.target.value;JS('kp_wall',w);applyWall();});
document.addEventListener('change',e=>{
  const k=e.target.closest&&e.target.closest('#kc-look-card')&&e.target.dataset.k;if(!k)return;
  if(k==='season'){try{localStorage.setItem('kp_season',e.target.checked?'auto':'off');}catch(_){}particles();refreshAv();renderCard();}
  else if(k==='schar'){try{localStorage.setItem('kp_season_char',e.target.checked?'1':'0');}catch(_){}refreshAv();}
  else if(k==='buddy'){if(typeof kcBuddySet==='function')kcBuddySet(e.target.checked);}
});
new MutationObserver(()=>{if(document.body.dataset.screen==='manage')renderCard();}).observe(document.body,{attributes:true,attributeFilter:['data-screen']});

function boot(){applyWall();particles();renderCard();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
