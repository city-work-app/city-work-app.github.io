/* =========================================================
   ux-cobalt.js — finitions de l'interface (15 nov. 2026, soir)
   1. Boutons − / + à la place des petites flèches des champs nombre (tout le site, y compris
      les fenêtres créées plus tard : MutationObserver). Appui long = répète.
   2. Lumière de la souris : reflet discret dans la carte survolée (comme l'ancien effet ; le grand halo a été retiré en v63).
   3. Animations : apparition en cascade des cartes à chaque changement de page, onde au clic.
   Rien de tout ça sur écran tactile pour la lumière ; tout est coupé avec « Animations réduites » (body.kc-calm).
   ========================================================= */
(function(){
'use strict';
const fine=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
const calm=()=>document.body.classList.contains('kc-calm')||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ───────── 1. Champs nombre ───────── */
function enhanceNum(inp){
  if(inp.dataset.kcn||inp.closest('.kc-num')||inp.hasAttribute('data-no-step')||inp.closest('#screen-city,.cty-root,.km-app'))return;
  inp.dataset.kcn='1';
  const cs=getComputedStyle(inp),wrap=document.createElement('span');
  wrap.className='kc-num';
  const st=inp.style;
  const px=v=>/px$/.test(v)?parseFloat(v):null;
  if(st.width){const w=px(st.width);wrap.style.width=w!==null&&w<130?(w+60)+'px':st.width;}
  else if(cs.display==='block'||inp.classList.contains('fi')||inp.classList.contains('mb2-custom-input'))wrap.style.width='100%';
  if(st.maxWidth){const w=px(st.maxWidth);wrap.style.maxWidth=w!==null?(w+60)+'px':st.maxWidth;}
  if(st.flex)wrap.style.flex=st.flex;
  if(st.margin)wrap.style.margin=st.margin;
  ['width','maxWidth','flex','margin','border','borderRadius','padding','background'].forEach(k=>{st[k]='';});
  const mk=(d,lbl,ic)=>{const b=document.createElement('button');b.type='button';b.className='kc-num-b';b.tabIndex=-1;b.setAttribute('aria-label',lbl);b.innerHTML='<span class="ms">'+ic+'</span>';b.dataset.d=d;return b;};
  const minus=mk(-1,'Diminuer','remove'),plus=mk(1,'Augmenter','add');
  inp.parentNode.insertBefore(wrap,inp);
  wrap.append(minus,inp,plus);
  const step=d=>{
    if(inp.disabled||inp.readOnly)return;
    if(inp.value===''){const base=inp.placeholder&&!isNaN(+inp.placeholder)?+inp.placeholder:(inp.min!==''?+inp.min:0);inp.value=base;}
    else{try{d>0?inp.stepUp():inp.stepDown();}catch(e){inp.value=(+inp.value||0)+d;}}
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    inp.dispatchEvent(new Event('change',{bubbles:true}));
    wrap.classList.remove('kc-num-tick');void wrap.offsetWidth;wrap.classList.add('kc-num-tick');
  };
  [minus,plus].forEach(b=>{
    let t1=0,t2=0;
    const stop=()=>{clearTimeout(t1);clearInterval(t2);};
    b.addEventListener('pointerdown',e=>{e.preventDefault();step(+b.dataset.d);t1=setTimeout(()=>{t2=setInterval(()=>step(+b.dataset.d),70);},420);});
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stop));
    b.addEventListener('click',e=>e.preventDefault());
  });
}
function scanNums(root){(root||document).querySelectorAll('input[type="number"]:not([data-kcn])').forEach(enhanceNum);}

/* ───────── 2. Lumière de la souris ───────── */
const CARD='.kh-card,.kh-mode,.kh-subject,.kh-tile,.kh-rev,.kh-weak,.kh-city,.hub-card,.matiere-hub-item,.kc-tile,.fcx-fold,.fcx-side,.fcx-add,.fcx-hero,.ci,.qi,.bc,.settings-card,.kh-tool,.kf-head,.an-group,.fce-card,.fce-box,.fcc-tile,.ua-card,.kr-card,.ob,.kh-chip,.partiel-item,.mm-hub-card,.km-card,.dl-user-info,.kh-act-card';
let glow=null,lit=null,mx=-999,my=-999,raf=0;
function ensureGlow(){if(glow)return glow;glow=document.createElement('div');glow.id='kc-glow';glow.setAttribute('aria-hidden','true');document.body.appendChild(glow);return glow;}
function frame(){
  raf=0;
  if(glow)glow.style.transform=`translate3d(${mx}px,${my}px,0)`;
  if(lit){const r=lit.getBoundingClientRect();lit.style.setProperty('--kc-mx',(mx-r.left)+'px');lit.style.setProperty('--kc-my',(my-r.top)+'px');}
}
function setLit(el){
  if(lit===el&&(!el||el.querySelector(':scope > .kc-spot')))return;
  if(lit&&lit!==el)lit.classList.remove('kc-lit');
  lit=el;
  if(lit){
    if(!lit.querySelector(':scope > .kc-spot')){
      if(getComputedStyle(lit).position==='static')lit.style.position='relative';
      const s=document.createElement('span');s.className='kc-spot';s.setAttribute('aria-hidden','true');lit.appendChild(s);
    }
    lit.classList.add('kc-lit');
  }
}
/* v68 (16 nov. 2026) : une seule lumière douce sur tout l'écran, qui glisse derrière la souris (lissée),
   à la place du reflet dans chaque carte (« trop visible, plus fluide, plus pro, sur tout l'écran ») */
let L=null,lx=-2000,ly=-2000,ltx=-2000,lty=-2000,la=0,lta=0,lrun=false;
function lightEl(){if(L)return L;L=document.createElement('div');L.id='kc-light';L.setAttribute('aria-hidden','true');document.body.appendChild(L);return L;}
function lightLoop(){
  /* v72 : la lumière est collée à la souris (avant : lissage ×0,12 → elle traînait ~2 s derrière) ; seule l'apparition est douce */
  lx=ltx;ly=lty;la+=(lta-la)*.18;
  L.style.transform=`translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0)`;L.style.opacity=la.toFixed(3);
  if(Math.abs(lta-la)>.004)requestAnimationFrame(lightLoop);else{la=lta;L.style.opacity=la.toFixed(3);lrun=false;}
}
function lightKick(){if(!lrun){lrun=true;requestAnimationFrame(lightLoop);}}
if(fine){
  window.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse')return;
    mx=e.clientX;my=e.clientY;
    lightEl();
    const off=calm()||document.body.dataset.glow==='non'||!!(e.target&&e.target.closest&&e.target.closest('.km-app,#screen-city,.cty-root,.ca-v'));
    if(lx<-1000){lx=mx;ly=my;}
    ltx=mx;lty=my;lta=off?0:1;
    if(L&&!lrun){lx=mx;ly=my;L.style.transform=`translate3d(${mx}px,${my}px,0)`;}
    lightKick();
  },{passive:true});
  document.documentElement.addEventListener('mouseleave',()=>{lta=0;if(L)lightKick();});
}

/* ───────── 3. Animations ───────── */
// Onde au clic
const RIP='.btn,.hub-card,.kc-tile,.kh-tool,.dl-nav a,.fcx-fold,.matiere-hub-item,.ni,.kp-seg-b,.kp-mode,.fcc-tile,.fce-tb,.ua-chip,.an-group-h,.kh-chip,.kf-crumb';
document.addEventListener('pointerdown',e=>{
  if(e.button!==0||calm())return;
  const el=e.target.closest&&e.target.closest(RIP);
  if(!el||el.disabled||el.closest('#screen-city,.km-app'))return;
  const r=el.getBoundingClientRect();if(r.width<24||r.height<20)return;
  let box=el.querySelector(':scope > .kc-rip');
  if(!box){
    if(getComputedStyle(el).position==='static')el.style.position='relative';
    box=document.createElement('span');box.className='kc-rip';box.setAttribute('aria-hidden','true');el.appendChild(box);
  }
  const d=Math.max(r.width,r.height)*2.2,c=document.createElement('i');
  c.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;
  box.appendChild(c);
  setTimeout(()=>c.remove(),650);
},{passive:true});

// Cartes qui apparaissent en cascade quand on change de page
const RISE='.kh-card,.hub-card,.matiere-hub-item,.kc-tile,.fcx-fold,.fcx-hero,.fcx-side,.fcx-add,.ci,.an-group,.settings-card,.fce-card,.fcc-tile,.kf-head,.kh-tool,.bc,.partiel-item';
function rise(scr){
  if(!scr||calm())return;
  const now=performance.now();if(scr._kcRiseT&&now-scr._kcRiseT<250)return;scr._kcRiseT=now;
  const els=[...scr.querySelectorAll(RISE)].filter(el=>el.offsetParent!==null).slice(0,18);
  els.forEach((el,i)=>{
    el.style.setProperty('--kc-i',i);
    el.classList.remove('kc-rise');void el.offsetWidth;el.classList.add('kc-rise');
    el.addEventListener('animationend',function h(ev){if(ev.target!==el)return;el.classList.remove('kc-rise');el.removeEventListener('animationend',h);});
  });
}
function wrapShow(){
  const orig=window.showScreen;
  if(typeof orig!=='function'||orig._kcux)return;
  const w=function(id){
    const r=orig.apply(this,arguments);
    requestAnimationFrame(()=>requestAnimationFrame(()=>rise(document.getElementById('screen-'+id)||document.querySelector('.screen.active'))));
    return r;
  };
  w._kcux=true;
  window.showScreen=w;
}

/* ───────── 4. Champs heure : sélecteur maison (16 nov. 2026, à la place du menu gris du navigateur) ───────── */
const pad=n=>String(n).padStart(2,'0');
function enhanceTime(inp){
  if(inp.dataset.kct||inp.closest('#screen-city,.cty-root,.km-app'))return;
  inp.dataset.kct='1';
  const v=inp.value;
  try{inp.type='text';}catch(e){return;}
  inp.value=v;inp.readOnly=true;inp.placeholder=inp.placeholder||'--:--';inp.classList.add('kc-time-in');inp.setAttribute('inputmode','none');
  const wrap=document.createElement('span');wrap.className='kc-time';
  if(inp.style.width){wrap.style.width=inp.style.width;inp.style.width='';}
  if(inp.style.flex){wrap.style.flex=inp.style.flex;inp.style.flex='';}
  inp.parentNode.insertBefore(wrap,inp);wrap.appendChild(inp);
  const ic=document.createElement('span');ic.className='ms kc-time-ic';ic.textContent='schedule';wrap.appendChild(ic);
  inp.addEventListener('click',()=>openTP(inp));
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '||e.key==='ArrowDown'){e.preventDefault();openTP(inp);}
    else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();setT(inp,'');}
  });
}
function setT(inp,v){inp.value=v;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));}
let TP=null;
function closeTP(){if(!TP)return;const t=TP;TP=null;t.el.classList.remove('open');document.removeEventListener('mousedown',t.out,true);document.removeEventListener('keydown',t.key,true);setTimeout(()=>t.el.remove(),160);}
function openTP(inp){
  if(TP&&TP.inp===inp){closeTP();return;}
  closeTP();
  const m0=/^(\d{1,2}):(\d{2})/.exec(inp.value||'');
  const now=new Date();
  let h=m0?+m0[1]:Math.min(23,now.getHours()+1),mi=m0?+m0[2]:0;
  const el=document.createElement('div');el.className='kc-tp';el.setAttribute('role','dialog');el.setAttribute('aria-label','Choisir une heure');
  const mins=[];for(let i=0;i<60;i+=5)mins.push(i);if(!mins.includes(mi))mins.push(mi),mins.sort((a,b)=>a-b);
  el.innerHTML=`<div class="kc-tp-show"><span class="kc-tp-h">${pad(h)}</span><i>:</i><span class="kc-tp-m">${pad(mi)}</span></div>
    <div class="kc-tp-cols"><div class="kc-tp-col" data-c="h">${Array.from({length:24},(_,i)=>`<button type="button" data-v="${i}">${pad(i)}</button>`).join('')}</div>
    <div class="kc-tp-col" data-c="m">${mins.map(i=>`<button type="button" data-v="${i}">${pad(i)}</button>`).join('')}</div></div>
    <div class="kc-tp-quick">${[8,10,12,14,16,18,20].map(x=>`<button type="button" data-q="${x}">${x} h</button>`).join('')}</div>
    <div class="kc-tp-f"><button type="button" class="kc-tp-clear">Effacer</button><button type="button" class="kc-tp-ok">Valider</button></div>`;
  document.body.appendChild(el);
  const sync=(scroll)=>{
    el.querySelector('.kc-tp-h').textContent=pad(h);el.querySelector('.kc-tp-m').textContent=pad(mi);
    el.querySelectorAll('[data-c="h"] button').forEach(b=>b.classList.toggle('on',+b.dataset.v===h));
    el.querySelectorAll('[data-c="m"] button').forEach(b=>b.classList.toggle('on',+b.dataset.v===mi));
    if(scroll)el.querySelectorAll('.kc-tp-col').forEach(c=>{const on=c.querySelector('.on');if(on)c.scrollTop=on.offsetTop-c.clientHeight/2+on.offsetHeight/2;});
  };
  const R=inp.getBoundingClientRect(),W=260;
  el.style.left=Math.max(10,Math.min(window.innerWidth-W-10,R.left))+'px';
  const below=R.bottom+8,hgt=360;
  el.style.top=(below+hgt>window.innerHeight&&R.top-hgt-8>0?R.top-hgt-8:Math.min(below,window.innerHeight-hgt-10))+'px';
  sync(true);
  el.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const col=b.closest('.kc-tp-col');
    if(col){if(col.dataset.c==='h')h=+b.dataset.v;else mi=+b.dataset.v;sync(false);setT(inp,pad(h)+':'+pad(mi));b.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
    if(b.dataset.q){h=+b.dataset.q;mi=0;sync(true);setT(inp,pad(h)+':'+pad(mi));closeTP();return;}
    if(b.classList.contains('kc-tp-clear')){setT(inp,'');closeTP();return;}
    if(b.classList.contains('kc-tp-ok')){setT(inp,pad(h)+':'+pad(mi));closeTP();inp.focus();}
  });
  const out=e=>{if(!el.contains(e.target)&&e.target!==inp)closeTP();};
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();closeTP();inp.focus();}else if(e.key==='Enter'){e.preventDefault();setT(inp,pad(h)+':'+pad(mi));closeTP();}
    else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();h=(h+(e.key==='ArrowUp'?1:23))%24;sync(true);}};
  document.addEventListener('mousedown',out,true);document.addEventListener('keydown',key,true);
  TP={el,inp,out,key};
  requestAnimationFrame(()=>el.classList.add('open'));
}
function scanTimes(root){(root||document).querySelectorAll('input[type="time"]:not([data-kct])').forEach(enhanceTime);}

/* ───────── Démarrage ───────── */
function start(){
  scanNums();scanTimes();
  wrapShow();
  let tm=0;
  new MutationObserver(muts=>{
    if(tm)return;
    tm=setTimeout(()=>{tm=0;scanNums();scanTimes();},60);
  }).observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>rise(document.querySelector('.screen.active')),120);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
// d'autres scripts enveloppent showScreen après nous : on se remet par-dessus une fois tout chargé
window.addEventListener('load',()=>setTimeout(wrapShow,0));
})();
