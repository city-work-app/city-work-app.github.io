/* =========================================================
   kc-buddy.js — v85 (21 nov. 2026) : TON PERSONNAGE RÉAGIT PENDANT LE QUIZ
   Le personnage (gam.char, gamAvatarSVG) apparaît dans un coin de l'écran du quiz (#kbd) :
     bonne réponse → saute de joie (yeux joyeux) ; erreur → déçu (_triste, petite larme) ;
     3, 5, 10, 15… bonnes réponses d'affilée → fait la fête (étoiles + confettis) ; longue réflexion → s'endort.
   Pas de réaction en mode Annales (pas de correction pendant l'épreuve).
   Branché sur recordAnswer (comme gamification.js). Réglage : kp_buddy = '0' pour le cacher (Paramètres > Apparence,
   ou le × qui apparaît au survol). Position : kp_buddy_side = 'l' | 'r'.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const SS=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
function G(n,d){try{const v=eval(n);return v===undefined?d:v;}catch(e){return d;}}
const on=()=>LS('kp_buddy','1')!=='0';
const OK=['Bravo !','Bien joué !','Exact !','Trop fort !','Oui !','Parfait !','Excellent !','Tu gères !','Impeccable !'];
const KO=['Presque…','Pas grave !','On retient ça','La prochaine sera la bonne','Courage !','Ça viendra !','On apprend en se trompant'];
const PARTY=n=>[`${n} d’affilée !`,'En feu !','Inarrêtable !','Quelle série !'][Math.floor(Math.random()*4)];
const pick=a=>a[Math.floor(Math.random()*a.length)];
const B={streak:0,mood:null,t:0,sleepT:0,last:''};

function char(o){const ch=Object.assign({},(G('gam',null)||{}).char||{});return Object.assign(ch,o||{});}
function svg(mood){try{return typeof gamAvatarSVG==='function'?gamAvatarSVG(char(mood===undefined?{}:{mood}),86):'';}catch(e){return '';}}
function el(){
  let e=$('kbd');if(e)return e;
  e=document.createElement('div');e.id='kbd';e.className='kbd'+(LS('kp_buddy_side','r')==='l'?' l':'');
  e.innerHTML=`<div class="kbd-bub" aria-live="polite"></div><div class="kbd-av"></div><div class="kbd-sh"></div>
    <button type="button" class="kbd-x" title="Cacher le personnage (réglage dans Paramètres)" aria-label="Cacher le personnage"><span class="ms">close</span></button>
    <button type="button" class="kbd-side" title="Changer de côté" aria-label="Changer de côté"><span class="ms">swap_horiz</span></button>`;
  e.querySelector('.kbd-x').onclick=ev=>{ev.stopPropagation();SS('kp_buddy','0');sync();if(typeof showNotif==='function')showNotif('Personnage caché · Paramètres > Apparence pour le remettre','ok');};
  e.querySelector('.kbd-side').onclick=ev=>{ev.stopPropagation();const l=!e.classList.contains('l');e.classList.toggle('l',l);SS('kp_buddy_side',l?'l':'r');};
  e.querySelector('.kbd-av').onclick=()=>react('poke');
  document.body.appendChild(e);
  setFace(null);
  return e;
}
function setFace(mood){const e=$('kbd');if(!e)return;const k=String(mood);if(B.last===k)return;B.last=k;e.querySelector('.kbd-av').innerHTML=svg(mood);}
function say(t){const e=$('kbd');if(!e)return;const b=e.querySelector('.kbd-bub');b.textContent=t;b.classList.remove('in');void b.offsetWidth;b.classList.add('in');}
function anim(cls){const e=$('kbd');if(!e)return;e.classList.remove('jump','sad','party','poke');void e.offsetWidth;e.classList.add(cls);}
function confetti(){
  const e=$('kbd');if(!e)return;
  const C=['#f43f5e','#f59e0b','#22c55e','#3b82f6','#a855f7','#ec4899','#14b8a6'];
  for(let i=0;i<26;i++){const p=document.createElement('i');p.className='kbd-cf';
    const a=Math.random()*Math.PI-Math.PI,d=60+Math.random()*90;
    p.style.cssText=`--x:${Math.cos(a)*d}px;--y:${Math.sin(a)*d-30}px;--r:${Math.random()*720-360}deg;background:${C[i%C.length]};animation-delay:${Math.random()*.12}s`;
    e.appendChild(p);setTimeout(()=>p.remove(),1300);}
}
function rest(ms){clearTimeout(B.t);B.t=setTimeout(()=>{setFace(null);const e=$('kbd');if(e)e.classList.remove('jump','sad','party','poke');},ms);}
function sleepLater(){clearTimeout(B.sleepT);B.sleepT=setTimeout(()=>{if(visible()){setFace('dodo');say('Zzz… je réfléchis aussi');}},45000);}
function react(kind){
  if(!on()||!visible())return;el();
  if(kind==='ok'){B.streak++;
    const big=B.streak===3||B.streak===5||B.streak%5===0&&B.streak>=10;
    if(big){setFace('etoiles');anim('party');confetti();say(PARTY(B.streak));rest(2600);}
    else{setFace('joie');anim('jump');say(pick(OK));rest(1500);}
  }else if(kind==='ko'){B.streak=0;setFace('_triste');anim('sad');say(pick(KO));rest(2200);}
  else if(kind==='poke'){setFace(Math.random()<.5?'clin':'langue');anim('poke');say(pick(['Hé !','Je t’encourage !','On continue ?','Concentre-toi !']));rest(1300);}
  sleepLater();
}
function visible(){return document.body.dataset.screen==='quiz';}
function sync(){
  const show=on()&&visible();
  const e=show?el():$('kbd');
  if(e)e.classList.toggle('show',show);
  if(show){B.last='';setFace(null);sleepLater();}else{clearTimeout(B.sleepT);}
}
/* une nouvelle session repart de zéro */
(function hookLaunch(){
  const L=window.launchS;if(typeof L!=='function'){setTimeout(hookLaunch,400);return;}
  if(L._kbd)return;
  const w=function(){B.streak=0;const r=L.apply(this,arguments);setTimeout(sync,60);return r;};w._kbd=true;window.launchS=w;
})();
(function hookAnswer(){
  const R=window.recordAnswer;if(typeof R!=='function'){setTimeout(hookAnswer,400);return;}
  if(R._kbd)return;
  const w=function(qid,ok){
    const r=R.apply(this,arguments);
    try{const s=G('session',null);if(visible()&&s&&!s.isAnnales)setTimeout(()=>react(ok?'ok':'ko'),40);}catch(e){}
    return r;
  };w._kbd=true;window.recordAnswer=w;
})();
/* suit les changements d'écran (showScreen met body[data-screen]) */
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
window.kcBuddySet=function(v){SS('kp_buddy',v?'1':'0');sync();};
window.kcBuddyOn=on;
})();
