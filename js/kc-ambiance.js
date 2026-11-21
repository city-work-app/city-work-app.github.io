/* =========================================================
   kc-ambiance.js — Sons d'ambiance fabriqués par le site (18 nov. 2026, v73)
   v75 : vrais enregistrements (voir REC_BASE) ; les anciens sons synthétisés (SYN) servent de secours hors ligne,
   et les bruits brun / rose / blanc restent calculés.
   - Bouton de la barre du haut [data-tb="amb"] → kcAmbOpen(e) : panneau #kc-amb (lecture, volume général,
     ambiances toutes prêtes, un curseur par son, arrêt automatique 15 → 90 min).
   - kcAmbToggle() : lecture / pause (raccourci clavier « Sons d'ambiance » dans kc-shortcuts.js).
   - Réglages dans kp_amb = {v:{id:0..1}, m:volume général, t:minutes d'arrêt auto}. La lecture ne reprend
     jamais toute seule au chargement (les navigateurs l'interdisent sans clic).
   Chaque son = une fonction qui construit ses nœuds vers une sortie `out` et renvoie {nodes, timers} ;
   les sons à 0 sont démontés (rien ne tourne pour rien), pause = fondu puis ctx.suspend().
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='kp_amb';
/* v75 (20 nov. 2026) : l'utilisateur trouvait que « tous les sons font de la pluie » (les sons calculés étaient tous
   du bruit filtré). Maintenant : VRAIS ENREGISTREMENTS (projet libre Moodist, sons CC0 / licence Pixabay, libres
   d'utilisation), chargés à la demande depuis raw.githubusercontent.com (version figée REC_BASE), gardés dans le
   cache du navigateur (Cache API 'kc-amb-v1') pour marcher ensuite sans internet. Chaque son est décodé, raccourci
   à 75 s max et bouclé avec un fondu enchaîné de 3 s (aucun « clic » au raccord). k = gain qui égalise les volumes
   (mesurés : RMS cible ≈ 0,12). Hors ligne et jamais chargé → ancien son calculé si `syn` existe (SYN), sinon rien.
   Bruits brun / rose / blanc : toujours calculés (`syn` seul, pas de fichier). */
const REC_BASE='https://raw.githubusercontent.com/remvze/moodist/11c0be2200116a3635880d600fd6953899cc51a3/public/sounds/';
const SOUNDS=[
  {id:'rain',n:'Pluie',ic:'rainy',g:'Pluie & orage',f:'rain/light-rain',k:7.5,syn:'rain'},
  {id:'heavy',n:'Grosse pluie',ic:'rainy_heavy',g:'Pluie & orage',f:'rain/heavy-rain',k:1.9,syn:'rain'},
  {id:'window',n:'Pluie sur la vitre',ic:'window',g:'Pluie & orage',f:'rain/rain-on-window',k:1.1,syn:'rain'},
  {id:'thunder',n:'Tonnerre',ic:'thunderstorm',g:'Pluie & orage',f:'rain/thunder',k:2.6,syn:'thunder'},
  {id:'waves',n:'Vagues',ic:'waves',g:'Nature',f:'nature/waves',k:10,syn:'waves'},
  {id:'gulls',n:'Mouettes',ic:'sailing',g:'Nature',f:'animals/seagulls',k:3.2},
  {id:'river',n:'Rivière',ic:'water',g:'Nature',f:'nature/river',k:5,syn:'stream'},
  {id:'birds',n:'Oiseaux',ic:'flutter_dash',g:'Nature',f:'animals/birds',k:2,syn:'forest'},
  {id:'trees',n:'Vent dans les arbres',ic:'park',g:'Nature',f:'nature/wind-in-trees',k:1.8,syn:'wind'},
  {id:'wind',n:'Vent',ic:'air',g:'Nature',f:'nature/wind',k:2.8,syn:'wind'},
  {id:'crickets',n:'Grillons (nuit d’été)',ic:'nights_stay',g:'Nature',f:'animals/crickets',k:16},
  {id:'fire',n:'Feu de cheminée',ic:'fireplace',g:'Maison & lieux',f:'nature/campfire',k:8,syn:'fire'},
  {id:'cat',n:'Chat qui ronronne',ic:'pets',g:'Maison & lieux',f:'animals/cat-purring',k:10,vr:{rate:.07,seg:[5,11],gap:.22}},
  {id:'cafe',n:'Café',ic:'local_cafe',g:'Maison & lieux',f:'places/cafe',k:1.9},
  {id:'library',n:'Bibliothèque',ic:'local_library',g:'Maison & lieux',f:'places/library',k:6},
  {id:'train',n:'Dans le train',ic:'train',g:'Maison & lieux',f:'transport/inside-a-train',k:2},
  {id:'chimes',n:'Carillon à vent',ic:'notifications',g:'Maison & lieux',f:'things/wind-chimes',k:2.6},
  {id:'brown',n:'Bruit brun',ic:'texture',g:'Bruits pour se concentrer',syn:'brown'},
  {id:'pink',n:'Bruit rose',ic:'grain',g:'Bruits pour se concentrer',syn:'pink'},
  {id:'white',n:'Bruit blanc',ic:'blur_on',g:'Bruits pour se concentrer',syn:'white'}
];
const SBY={};SOUNDS.forEach(s=>SBY[s.id]=s);
const PRESETS=[
  {id:'focus',n:'Concentration',ic:'psychology',v:{brown:.5}},
  {id:'rain',n:'Pluie douce',ic:'rainy',v:{rain:.6,window:.3}},
  {id:'storm',n:'Orage',ic:'thunderstorm',v:{heavy:.6,thunder:.75,wind:.2}},
  {id:'sea',n:'Bord de mer',ic:'beach_access',v:{waves:.75,gulls:.25,wind:.12}},
  {id:'fire',n:'Coin du feu',ic:'fireplace',v:{fire:.7,window:.3}},
  {id:'forest',n:'Forêt',ic:'forest',v:{birds:.55,river:.4,trees:.25}},
  {id:'night',n:'Nuit d’été',ic:'nights_stay',v:{crickets:.55,trees:.15}},
  {id:'cafe',n:'Café',ic:'local_cafe',v:{cafe:.6,window:.2}},
  {id:'library',n:'Bibliothèque',ic:'local_library',v:{library:.6,rain:.25}},
  {id:'train',n:'Voyage en train',ic:'train',v:{train:.6,window:.25}},
  {id:'cosy',n:'Cocon',ic:'pets',v:{cat:.5,fire:.45,rain:.2}}
];
const TIMERS=[0,15,30,45,60,90];

/* ───────── Réglages ───────── */
function load(){try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');const v=o.v&&typeof o.v==='object'?o.v:{};
  /* anciens identifiants (v73-v74) → nouveaux */
  if(v.forest!=null){v.birds=v.forest;delete v.forest;}if(v.stream!=null){v.river=v.stream;delete v.stream;}
  Object.keys(v).forEach(k=>{if(!SBY[k])delete v[k];});
  const u=Array.isArray(o.u)?o.u.filter(x=>x&&x.id&&x.v&&typeof x.v==='object').slice(0,24):[];
  return {v,m:typeof o.m==='number'?o.m:.7,t:TIMERS.includes(o.t)?o.t:0,u};}catch(e){return {v:{},m:.7,t:0,u:[]};}}
let st=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
const vol=id=>Math.max(0,Math.min(1,+st.v[id]||0));

/* ───────── Moteur audio ───────── */
let ctx=null,master=null,PLAY=false,endAt=0,tick=0;
const N={};/* sons montés : id → {g, nodes, timers} */
const BUF={};
function ensureCtx(){
  if(ctx)return ctx;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  ctx=new AC();
  /* v74 : simple limiteur (avant : compresseur qui « pompait » à chaque crépitement → un souffle qui passe)
     + coupe-bas 35 Hz (les infrabasses donnaient un grondement de vent) */
  const lim=ctx.createDynamicsCompressor();lim.threshold.value=-3;lim.knee.value=4;lim.ratio.value=12;lim.attack.value=.003;lim.release.value=.25;
  const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=35;hp.Q.value=.7;
  master=ctx.createGain();master.gain.value=0;master.connect(hp);hp.connect(lim);lim.connect(ctx.destination);
  return ctx;
}
/* bruits en boucle (stéréo : deux canaux différents = son large).
   v74 (19 nov. 2026) : le bruit « brun » d'avant (intégrateur qui fuit à ~140 Hz, normalisé au pic) faisait de
   grosses variations lentes = un « vent très fort qui passe » dans presque tous les sons. Maintenant : coupe-bas
   (filtre anti-continu ~30 Hz) sur rose et brun, et niveau réglé sur la puissance moyenne (RMS 0,2), pas sur le pic. */
function noiseBuf(kind){
  if(BUF[kind])return BUF[kind];
  const sr=ctx.sampleRate,sec=8,len=Math.floor(sr*sec),b=ctx.createBuffer(2,len,sr),Rdc=1-2*Math.PI*30/sr;
  for(let ch=0;ch<2;ch++){
    const d=b.getChannelData(ch);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,br=0,xp=0,yp=0;
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1;let v;
      if(kind==='white')v=w;
      else if(kind==='pink'){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;v=b0+b1+b2+b3+b4+b5+b6+w*.5362;b6=w*.115926;}
      else{br=br*.9975+w*.05;v=br;}
      if(kind!=='white'){const y=v-xp+Rdc*yp;xp=v;yp=y;v=y;}   /* anti-continu : plus d'infrabasses */
      d[i]=v;
    }
    /* raccord de la boucle : fondu enchaîné de 0,25 s entre la fin et le début */
    const X=Math.floor(sr*.25);for(let i=0;i<X;i++){const t=i/X;d[i]=d[i]*t+d[len-X+i]*(1-t);}
    let ss=0;for(let i=0;i<len-X;i++)ss+=d[i]*d[i];
    const k=.2/Math.sqrt(ss/(len-X)||1);for(let i=0;i<len;i++)d[i]=Math.max(-1,Math.min(1,d[i]*k));
  }
  return BUF[kind]=b;
}
function src(kind,o){const s=ctx.createBufferSource();s.buffer=noiseBuf(kind);s.loop=true;s.loopStart=0;s.loopEnd=s.buffer.duration-.25;s.connect(o);s.start(ctx.currentTime,Math.random()*(s.buffer.duration-.3));return s;}
function flt(type,f,q){const x=ctx.createBiquadFilter();x.type=type;x.frequency.value=f;if(q!=null)x.Q.value=q;return x;}
function gain(v){const g=ctx.createGain();g.gain.value=v;return g;}
function chain(...a){for(let i=0;i<a.length-1;i++)a[i].connect(a[i+1]);return a[a.length-1];}
/* oscillateur lent qui fait varier un réglage (filtre, volume) autour de sa valeur */
function lfo(rate,depth,param,nodes){const o=ctx.createOscillator(),g=gain(depth);o.frequency.value=rate;o.connect(g);g.connect(param);o.start(ctx.currentTime+Math.random()*2);nodes.push(o);return o;}
function pan(v){if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=v;return p;}return gain(1);}
/* planificateur : appelle fn(t) aux instants d'un tirage aléatoire (moyenne `rate` par seconde), 150 ms à l'avance */
function sched(rate,fn,timers,first){
  let next=ctx.currentTime+(first==null?.05:first);
  const run=()=>{if(!ctx||ctx.state!=='running')return;const lim=ctx.currentTime+.15;let n=0;while(next<lim&&n++<40){if(next>ctx.currentTime-.05)fn(next);next+=typeof rate==='function'?rate():-Math.log(1-Math.random())/rate;}if(next<ctx.currentTime-1)next=ctx.currentTime+.05;};
  timers.push(setInterval(run,50));run();
}
/* court morceau de bruit (goutte, crépitement) */
function grain(t,out,o){
  const s=ctx.createBufferSource();s.buffer=noiseBuf(o.kind||'white');
  const f=flt(o.type||'bandpass',o.f,o.q==null?1:o.q),g=ctx.createGain(),p=pan(o.pan||0);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.a,t+(o.att||.002));g.gain.exponentialRampToValueAtTime(.0001,t+(o.att||.002)+o.dur);
  chain(s,f,g,p,out);s.start(t,Math.random()*4,(o.att||.002)+o.dur+.02);
  s.onended=()=>{try{p.disconnect();}catch(e){}};
}
const R=(a,b)=>a+Math.random()*(b-a);
/* fait varier un gain au hasard entre lo et hi toutes les `ms` (texture vivante : clapotis, rafales…) */
function jitter(param,lo,hi,ms,tau,timers){timers.push(setInterval(()=>{if(ctx&&ctx.state==='running')param.setTargetAtTime(R(lo,hi),ctx.currentTime,tau);},ms));}
/* événement ponctuel : source de bruit non bouclée qui se coupe seule */
function burst(kind,t,dur){const s=ctx.createBufferSource(),b=noiseBuf(kind),L=b.duration-.3;s.buffer=b;if(dur>L-.5){s.loop=true;s.loopStart=0;s.loopEnd=L;s.start(t,Math.random()*L*.5,dur);}else s.start(t,Math.random()*(L-dur),dur);return s;}

const SYN={
  /* Pluie : nappe aiguë « shhh », crépitement irrégulier, milliers de petites gouttes, quelques « plic » */
  rain(out,nodes,timers){
    nodes.push(src('pink',chain(flt('highpass',700),flt('lowpass',9500),gain(.42),out)));
    const pat=gain(.12);nodes.push(src('white',chain(flt('bandpass',2600,.6),pat,out)));jitter(pat.gain,.05,.17,35,.012,timers);
    sched(110,t=>grain(t,out,{f:R(1800,7000),q:2.2,a:R(.05,.2),dur:R(.003,.01),pan:R(-.9,.9)}),timers);
    sched(2.5,t=>{const o=ctx.createOscillator(),g=ctx.createGain(),pn=pan(R(-.7,.7)),f=R(2200,3400);
      o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*.38,t+.018);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(R(.02,.05),t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+.03);
      chain(o,g,pn,out);o.start(t);o.stop(t+.04);o.onended=()=>{try{pn.disconnect();}catch(e){}};},timers);
  },
  /* Tonnerre : silence, puis coups de tonnerre lointains (grondement qui roule) ou proches (craquement d'abord) */
  thunder(out,nodes,timers){
    sched(()=>R(10,24),t=>{
      const near=Math.random()<.3,dur=R(5,9),pn=pan(R(-.6,.6));pn.connect(out);
      if(near){const c=burst('white',t,.5),cf=flt('highpass',R(400,900)),cg=ctx.createGain();
        cg.gain.setValueAtTime(0,t);cg.gain.linearRampToValueAtTime(R(.9,1.4),t+.01);cg.gain.exponentialRampToValueAtTime(.001,t+.45);chain(c,cf,cg,pn);}
      const t0=t+(near?.12:R(.2,.8)),s0=burst('brown',t0,dur+1),f=flt('lowpass',near?900:420,.6),g=ctx.createGain(),mid=burst('pink',t0,dur),mf=flt('bandpass',320,.8),mg=ctx.createGain();
      f.frequency.setValueAtTime(near?900:420,t0);f.frequency.exponentialRampToValueAtTime(140,t0+dur*.7);
      const pk=near?R(1,1.4):R(.6,1);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(pk,t0+R(.15,.6));
      let tt=t0+.7;for(let k=0,n=2+(Math.random()*3|0);k<n;k++){g.gain.setTargetAtTime(pk*R(.35,1),tt,.25);tt+=R(.6,1.6);}
      g.gain.setTargetAtTime(.0001,tt,dur/5);
      mg.gain.setValueAtTime(0,t0);mg.gain.linearRampToValueAtTime(pk*.18,t0+.3);mg.gain.setTargetAtTime(.0001,t0+.8,dur/6);
      chain(s0,f,g,pn);chain(mid,mf,mg,pn);
      s0.onended=()=>{try{pn.disconnect();}catch(e){}};
    },timers,R(2,6));
  },
  /* Vagues : fond de mer calme + une vague toutes les 5 à 9 s (elle monte, se brise, l'écume pétille, elle se retire) */
  waves(out,nodes,timers){
    nodes.push(src('pink',chain(flt('lowpass',480),gain(.16),out)));
    sched(()=>R(5,9),t=>{
      const up=R(1.8,2.8),down=R(3.5,5.5),pk=R(.45,.75),pn=pan(R(-.5,.5));pn.connect(out);
      const s0=burst('pink',t,up+down+.5),f=flt('lowpass',250,.5),g=ctx.createGain();
      f.frequency.setValueAtTime(250,t);f.frequency.exponentialRampToValueAtTime(R(1600,2600),t+up);f.frequency.exponentialRampToValueAtTime(380,t+up+down);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(pk,t+up);g.gain.setTargetAtTime(.0001,t+up+.15,down/3.2);
      const fo=burst('white',t+up-.1,down),ff=flt('highpass',2200),fg=ctx.createGain();
      fg.gain.setValueAtTime(0,t+up-.1);fg.gain.linearRampToValueAtTime(pk*.16,t+up+.2);fg.gain.setTargetAtTime(.0001,t+up+.4,down/3);
      chain(s0,f,g,pn);chain(fo,ff,fg,pn);
      s0.onended=()=>{try{pn.disconnect();}catch(e){}};
    },timers,R(.3,1.5));
  },
  /* Vent : souffle doux qui monte et retombe en rafales, avec un léger sifflement */
  wind(out,nodes,timers){
    const bp=flt('bandpass',600,.7),g=gain(.3);
    nodes.push(src('pink',chain(flt('highpass',150),bp,g,out)));
    timers.push(setInterval(()=>{if(ctx&&ctx.state==='running'){const tt=ctx.currentTime;g.gain.setTargetAtTime(R(.12,.42),tt,R(1.2,2.8));bp.frequency.setTargetAtTime(R(380,950),tt,R(1.5,3));}},2600));
    const wh=flt('bandpass',1900,9),wg=gain(.03);nodes.push(src('pink',chain(wh,wg,out)));
    timers.push(setInterval(()=>{if(ctx&&ctx.state==='running'){const tt=ctx.currentTime;wh.frequency.setTargetAtTime(R(1400,2600),tt,2);wg.gain.setTargetAtTime(R(0,.045),tt,1.8);}},3100));
  },
  /* Feu de cheminée : petit ronflement très doux + crépitements en grappes, craquements du bois, sifflements de sève */
  fire(out,nodes,timers){
    const roar=gain(.07);nodes.push(src('pink',chain(flt('highpass',140),flt('lowpass',1000),roar,out)));jitter(roar.gain,.04,.09,400,.3,timers);
    const crk=(t,a,f,d,p)=>grain(t,out,{type:'highpass',f,q:.7,a,dur:d,pan:p});
    sched(()=>R(.12,.8),t=>{
      const p=R(-.6,.6),n=1+(Math.random()*7|0);let tt=t;
      for(let k=0;k<n;k++){crk(tt,R(.12,.7),R(1500,4500),R(.0015,.006),p+R(-.15,.15));tt+=R(.006,.06);}
      if(Math.random()<.14)grain(t+R(0,.1),out,{type:'bandpass',f:R(650,1300),q:3,a:R(.6,1),dur:R(.008,.02),pan:p});   /* craquement du bois */
    },timers);
    sched(()=>R(6,14),t=>{const d=R(.4,1.2),s0=burst('white',t,d+.1),f=flt('bandpass',R(3500,6000),2),g=ctx.createGain();
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(R(.04,.09),t+d*.3);g.gain.linearRampToValueAtTime(0,t+d);chain(s0,f,g,out);},timers,R(3,7));
  },
  /* Oiseaux : feuillage qui bruisse très doucement + chants variés, à gauche et à droite */
  forest(out,nodes,timers){
    const lv=gain(.03);nodes.push(src('pink',chain(flt('bandpass',2600,.5),lv,out)));jitter(lv.gain,.012,.04,900,.6,timers);
    const note=(t,f0,f1,d,a,p,vib)=>{
      const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),g2=gain(.18),pn=pan(p);o.type='sine';o2.type='sine';
      o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+d);o2.frequency.setValueAtTime(f0*2,t);o2.frequency.exponentialRampToValueAtTime(f1*2,t+d);
      if(vib){const l=ctx.createOscillator(),lg=gain(f0*.04);l.frequency.value=R(25,45);l.connect(lg);lg.connect(o.frequency);l.start(t);l.stop(t+d+.02);}
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+Math.min(.012,d/3));g.gain.exponentialRampToValueAtTime(.0001,t+d);
      o.connect(g);o2.connect(g2);g2.connect(g);chain(g,pn,out);o.start(t);o2.start(t);o.stop(t+d+.02);o2.stop(t+d+.02);o.onended=()=>{try{pn.disconnect();}catch(e){}};
    };
    sched(()=>R(.8,4),t=>{
      const p=R(-.85,.85),a=R(.02,.07),kind=Math.random();
      if(kind<.45){let tt=t;const base=R(2600,4400),n=2+(Math.random()*4|0);for(let i=0;i<n;i++){const d=R(.05,.11),f=base*R(.88,1.15);note(tt,f,f*R(.75,1.4),d,a,p);tt+=d+R(.03,.09);}}
      else if(kind<.72){const f=R(3400,5200),n=6+(Math.random()*8|0);for(let i=0;i<n;i++)note(t+i*.05,f*1.04,f*.94,.035,a*.7,p);}
      else{const f=R(1800,2600);note(t,f,f*R(1.15,1.4),R(.22,.34),a,p,true);note(t+R(.34,.48),f*R(1.1,1.25),f*R(.85,1),R(.18,.3),a*.8,p,true);}
    },timers,R(.2,1.2));
  },
  /* Ruisseau : clapotis (plusieurs bandes qui gargouillent chacune à leur rythme) + petites bulles */
  stream(out,nodes,timers){
    [[480,1.1,.06],[1100,1.3,.055],[2400,1.6,.035]].forEach(([f,q,a])=>{const g=gain(a);nodes.push(src('pink',chain(flt('bandpass',f,q),g,out)));jitter(g.gain,a*.35,a*1.4,R(45,85),.02,timers);});
    nodes.push(src('white',chain(flt('highpass',4500),gain(.018),out)));
    sched(6,t=>{
      const o=ctx.createOscillator(),gg=ctx.createGain(),pn=pan(R(-.6,.6)),f=R(500,1400);
      o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*R(1.4,2),t+.035);
      gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(R(.012,.04),t+.005);gg.gain.exponentialRampToValueAtTime(.0001,t+.05);
      chain(o,gg,pn,out);o.start(t);o.stop(t+.06);o.onended=()=>{try{pn.disconnect();}catch(e){}};
    },timers);
  },
  /* Bruits de fond pour se concentrer : réguliers, sans rafales */
  brown(out,nodes){nodes.push(src('brown',chain(flt('lowpass',700),gain(.9),out)));},
  pink(out,nodes){nodes.push(src('pink',chain(gain(.38),out)));},
  white(out,nodes){nodes.push(src('white',chain(flt('lowpass',8000),gain(.2),out)));}
};
/* ───────── Vrais enregistrements : chargement, cache, boucle sans raccord ───────── */
const RAW={};      /* id → ArrayBuffer (mp3 compressé, petit) */
const DEC={};      /* id → AudioBuffer prêt à boucler (gros : 5 au plus gardés) */
const DEC_ORDER=[];
const LOADING={};  /* id → Promise */
const FAILED={};
const CACHE_NAME_AMB='kc-amb-v1';
async function fetchRaw(s){
  if(RAW[s.id])return RAW[s.id];
  const url=REC_BASE+s.f+'.mp3';
  let c=null;try{if(window.caches)c=await caches.open(CACHE_NAME_AMB);}catch(e){c=null;}
  if(c){try{const hit=await c.match(url);if(hit){const ab=await hit.arrayBuffer();if(ab.byteLength>1000)return RAW[s.id]=ab;}}catch(e){}}
  const r=await fetch(url,{mode:'cors'});
  if(!r.ok)throw new Error('HTTP '+r.status);
  if(c){try{await c.put(url,r.clone());}catch(e){}}
  return RAW[s.id]=await r.arrayBuffer();
}
function decode(ab){
  return new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab.slice(0),res,rej);if(p&&p.then)p.then(res,rej);});
}
/* découpe à 75 s max et fond la fin dans le début (3 s, puissance constante) → boucle parfaite */
function loopable(buf){
  const sr=buf.sampleRate,XF=Math.min(Math.floor(sr*3),Math.floor(buf.length/4));
  const use=Math.min(buf.length,Math.floor(sr*75)+XF),len=use-XF,ch=Math.min(2,buf.numberOfChannels);
  const out=ctx.createBuffer(2,len,sr);
  for(let c=0;c<2;c++){
    const d=buf.getChannelData(Math.min(c,ch-1)),o=out.getChannelData(c);
    for(let i=0;i<len;i++)o[i]=d[i];
    for(let i=0;i<XF;i++){const t=i/XF;o[i]=d[i]*Math.sin(t*Math.PI/2)+d[len+i]*Math.cos(t*Math.PI/2);}
  }
  return out;
}
function loadRec(s){
  if(DEC[s.id])return Promise.resolve(DEC[s.id]);
  if(LOADING[s.id])return LOADING[s.id];
  return LOADING[s.id]=fetchRaw(s).then(decode).then(buf=>{
    const lb=loopable(buf);DEC[s.id]=lb;DEC_ORDER.push(s.id);
    for(let i=0;DEC_ORDER.length>5&&i<DEC_ORDER.length;){const k=DEC_ORDER[i];if(!N[k]&&k!==s.id){delete DEC[k];DEC_ORDER.splice(i,1);}else i++;}
    delete LOADING[s.id];delete FAILED[s.id];return lb;
  },e=>{delete LOADING[s.id];FAILED[s.id]=1;throw e;});
}
/* v84 (21 nov. 2026) : « les sons sont répétitifs (surtout le chat) ». Au lieu de boucler toujours le même
   enregistrement, on enchaîne des MORCEAUX pris au hasard dans le fichier (6 à 20 s), avec un fondu enchaîné de 2,5 s,
   une vitesse de lecture qui varie un peu (± 3 %, donc la hauteur aussi), un volume et une position gauche / droite qui
   changent doucement. Pour certains sons (chat), petites pauses naturelles de temps en temps. Résultat : jamais deux
   fois la même chose. */
function varied(o,s,buf,out){
  const V=s.vr||{},rate=V.rate||.03,seg=V.seg||[6,20],XF=2.5,D=buf.duration;
  const wob=gain(1);wob.connect(out);o.nodes.push(wob);
  jitter(wob.gain,.78,1.12,R(3500,6000),1.6,o.timers);   /* le volume respire lentement */
  let next=ctx.currentTime+.02,first=true;
  const one=()=>{
    if(!ctx||!N[s.id]||N[s.id]!==o)return;
    if(ctx.state!=='running'){o.timers.push(setTimeout(one,500));return;}
    const gap=!first&&V.gap&&Math.random()<V.gap?R(1.5,5):0;   /* pause (le chat s'arrête un instant) */
    const len=Math.min(D-.5,R(seg[0],seg[1])),r_=1+R(-rate,rate),t0=Math.max(ctx.currentTime+.02,next+gap),off=Math.random()*Math.max(.01,D-len*r_-.2);
    const sr=ctx.createBufferSource(),eg=ctx.createGain(),pn=pan(R(-.25,.25));sr.buffer=buf;sr.playbackRate.value=r_;
    const xf=first?.4:XF;eg.gain.setValueAtTime(0,t0);eg.gain.linearRampToValueAtTime(1,t0+xf);eg.gain.setValueAtTime(1,t0+len-XF);eg.gain.linearRampToValueAtTime(0,t0+len);
    sr.connect(eg);eg.connect(pn);pn.connect(wob);sr.start(t0,off,len*r_+.05);
    o.nodes.push(sr);sr.onended=()=>{const i=o.nodes.indexOf(sr);if(i>=0)o.nodes.splice(i,1);try{pn.disconnect();}catch(e){}};
    first=false;next=t0+len-XF;
    o.timers.push(setTimeout(one,Math.max(200,(next-ctx.currentTime-1.2)*1000)));
  };
  one();
}
function rowState(id,cls,on){const r=document.querySelector('#kc-amb .kamb-row[data-id="'+id+'"]');if(r)r.classList.toggle(cls,!!on);}
function mount(id){
  const s=SBY[id];
  if(N[id]||!ctx||!s)return;
  const g=gain(0);g.connect(master);
  const o={g,nodes:[],timers:[]};N[id]=o;
  const synth=()=>{if(s.syn&&SYN[s.syn]){try{SYN[s.syn](g,o.nodes,o.timers);}catch(e){console.warn('[ambiance]',id,e);}}};
  if(!s.f){synth();return;}
  rowState(id,'ld',true);
  loadRec(s).then(buf=>{
    rowState(id,'ld',false);rowState(id,'off',false);
    if(N[id]!==o||!ctx)return;
    const k=gain((s.k||1)*1.4);k.connect(g);o.nodes.push(k);
    varied(o,s,buf,k);   /* v84 : plus de boucle qui se répète */
  },e=>{
    rowState(id,'ld',false);
    if(N[id]!==o)return;
    console.warn('[ambiance] enregistrement indisponible',id,e);
    if(s.syn)synth();
    else{rowState(id,'off',true);if(typeof showNotif==='function'&&!mount.warned){mount.warned=1;showNotif('Certains sons ont besoin d’internet la première fois','err');}}
  });
}
function unmount(id){
  const o=N[id];if(!o)return;delete N[id];
  o.timers.forEach(clearInterval);
  o.nodes.forEach(n=>{try{n.stop();}catch(e){}try{n.disconnect();}catch(e){}});
  try{o.g.disconnect();}catch(e){}
}
function applyVol(id,fast){
  const v=vol(id);
  if(!PLAY||!ctx)return;
  if(v>0){mount(id);const o=N[id];if(o)o.g.gain.setTargetAtTime(v*v,ctx.currentTime,fast?.05:.25);}
  else if(N[id]){const o=N[id];o.g.gain.setTargetAtTime(0,ctx.currentTime,.12);setTimeout(()=>{if(!vol(id))unmount(id);},700);}
}
function anyOn(){return SOUNDS.some(s=>vol(s.id)>0);}
function play(){
  if(!ensureCtx()){if(typeof showNotif==='function')showNotif('Ton navigateur ne peut pas fabriquer de sons','err');return;}
  if(!anyOn()){st.v=Object.assign({},PRESETS[1].v);save();}
  PLAY=true;
  const go=()=>{SOUNDS.forEach(s=>applyVol(s.id,true));master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(st.m*st.m,ctx.currentTime,.35);};
  if(ctx.state!=='running')ctx.resume().then(go,go);else go();
  endAt=st.t?Date.now()+st.t*60000:0;
  startTick();ui();
}
function pause(){
  PLAY=false;endAt=0;
  if(ctx&&master){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.15);
    setTimeout(()=>{if(PLAY)return;Object.keys(N).forEach(unmount);try{ctx.suspend();}catch(e){}},700);}
  ui();
}
function startTick(){
  if(tick)return;
  tick=setInterval(()=>{
    if(!PLAY){clearInterval(tick);tick=0;return;}
    if(endAt){
      const left=endAt-Date.now();
      if(left<=8000&&!startTick.fading&&ctx){startTick.fading=true;master.gain.setTargetAtTime(0,ctx.currentTime,2.2);}
      if(left<=0){startTick.fading=false;pause();if(typeof showNotif==='function')showNotif('Sons d’ambiance arrêtés (minuteur)','ok');return;}
    }
    const l=$('kamb-left');if(l)l.textContent=leftTxt();
  },1000);
}
function leftTxt(){if(!PLAY||!endAt)return '';const s=Math.max(0,Math.round((endAt-Date.now())/1000)),m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0');}

window.kcAmbToggle=function(){if(PLAY)pause();else play();return PLAY;};
window.kcAmbIsOn=()=>PLAY;
/* débogage : état du moteur et niveau sonore moyen (RMS) mesuré pendant 300 ms */
window.kcAmbDebug=function(){
  if(!ctx)return Promise.resolve({ctx:null});
  const an=ctx.createAnalyser();an.fftSize=2048;master.connect(an);const buf=new Float32Array(an.fftSize);
  return new Promise(res=>setTimeout(()=>{an.getFloatTimeDomainData(buf);let s=0;for(const v of buf)s+=v*v;try{master.disconnect(an);}catch(e){}res({state:ctx.state,mounted:Object.keys(N),rms:+Math.sqrt(s/buf.length).toFixed(4)});},300));
};

/* ───────── Panneau ───────── */
function rowHTML(s){
  const v=Math.round(vol(s.id)*100);
  return `<div class="kamb-row${v?' on':''}${LOADING[s.id]?' ld':''}" data-id="${s.id}">
    <button type="button" class="kamb-ri" data-am="tog" data-id="${s.id}" title="${v?'Couper':'Activer'} : ${esc(s.n)}"><span class="ms">${s.ic}</span></button>
    <span class="kamb-rn">${esc(s.n)}</span>
    <input type="range" min="0" max="100" step="1" value="${v}" data-am="vol" data-id="${s.id}" aria-label="Volume : ${esc(s.n)}" style="--p:${v}%">
  </div>`;
}
function listHTML(){let g='',h='';SOUNDS.forEach(s=>{if(s.g!==g){g=s.g;h+=`<div class="kamb-grp">${esc(g)}</div>`;}h+=rowHTML(s);});return h;}
function presetOn(p){return SOUNDS.every(s=>Math.abs(vol(s.id)-(p.v[s.id]||0))<.02);}
function panelHTML(){
  const m=Math.round(st.m*100);
  return `<div class="kamb-h"><span class="kamb-ic${PLAY?' on':''}"><span class="ms">graphic_eq</span></span><div><b>Sons d’ambiance</b><small>Vrais enregistrements · sans pub · mélange-les</small></div>
      <button type="button" class="kamb-x" data-am="close" aria-label="Fermer"><span class="ms">close</span></button></div>
    <div class="kamb-main">
      <button type="button" class="kamb-play${PLAY?' on':''}" data-am="play" aria-label="${PLAY?'Pause':'Lecture'}"><span class="ms">${PLAY?'pause':'play_arrow'}</span></button>
      <div class="kamb-mv"><span class="ms">${m?'volume_up':'volume_off'}</span><input type="range" min="0" max="100" value="${m}" data-am="master" aria-label="Volume général" style="--p:${m}%"></div>
    </div>
    <div class="kamb-my"><div class="kamb-myh"><span class="ms">bookmark</span>Mes mélanges<button type="button" class="kamb-save" data-am="save" title="Enregistrer les sons et volumes actuels"><span class="ms">bookmark_add</span>Enregistrer ce mélange</button></div>
      ${st.u.length?`<div class="kamb-pre">${st.u.map(p=>`<span class="kamb-chip kamb-uchip${presetOn(p)?' on':''}" data-am="upre" data-id="${esc(p.id)}" role="button" tabindex="0"><span class="ms">${esc(p.ic||'graphic_eq')}</span>${esc(p.n)}<button type="button" class="kamb-del" data-am="udel" data-id="${esc(p.id)}" aria-label="Supprimer ${esc(p.n)}"><span class="ms">close</span></button></span>`).join('')}</div>`
        :`<p class="kamb-hint">Règle les sons comme tu aimes, puis « Enregistrer ce mélange » : il suffira ensuite d’un clic.</p>`}</div>
    <div class="kamb-grp kamb-g0">Ambiances toutes prêtes</div>
    <div class="kamb-pre">${PRESETS.map(p=>`<button type="button" class="kamb-chip${presetOn(p)?' on':''}" data-am="pre" data-id="${p.id}"><span class="ms">${p.ic}</span>${esc(p.n)}</button>`).join('')}</div>
    <div class="kamb-list">${listHTML()}</div>
    <div class="kamb-foot"><span class="kamb-fl"><span class="ms">timer</span>Arrêt auto</span>
      <div class="kamb-seg">${TIMERS.map(t=>`<button type="button" class="${st.t===t?'on':''}" data-am="timer" data-v="${t}">${t?t+' min':'Non'}</button>`).join('')}</div>
      <span class="kamb-left" id="kamb-left">${leftTxt()}</span></div>`;
}
function ui(){
  try{fabSync();}catch(e){}
  const b=$('kc-amb-btn');if(b){b.classList.toggle('kc-amb-on',PLAY);b.dataset.tooltip=PLAY?'Sons d’ambiance (en cours)':'Sons d’ambiance';}
  const p=$('kc-amb');if(p){const sc=p.querySelector('.kamb-list')?.scrollTop||0;p.innerHTML=panelHTML();const l=p.querySelector('.kamb-list');if(l)l.scrollTop=sc;}
}
function place(p,anchor){
  if(innerWidth<=640){p.style.left='8px';p.style.right='8px';p.style.top='';p.style.bottom='8px';return;}
  const r=anchor?anchor.getBoundingClientRect():{left:innerWidth-380,bottom:64,right:innerWidth-12};
  const w=p.offsetWidth||360;
  p.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+(r.right-r.left)/2-w/2))+'px';
  p.style.top=Math.min(r.bottom+8,innerHeight-p.offsetHeight-8)+'px';
}
function close(){const p=$('kc-amb');if(p){p.classList.remove('open');setTimeout(()=>p.remove(),150);}document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',onKey,true);}
function outside(e){const p=$('kc-amb');if(!p)return;if(p.contains(e.target)||e.target.closest('#kc-amb-btn,#kc-amb-fab,#kc-dlg,.kc-dlg-bg'))return;close();}
function onKey(e){if(e.key==='Escape'&&$('kc-amb')){e.stopPropagation();close();return;}if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('kamb-uchip')){e.preventDefault();e.target.click();}}
window.kcAmbOpen=function(e){
  if(e&&e.stopPropagation)e.stopPropagation();
  if($('kc-amb')){close();return;}
  const p=document.createElement('div');p.id='kc-amb';p.className='kamb';p.setAttribute('role','dialog');p.setAttribute('aria-label','Sons d’ambiance');
  p.innerHTML=panelHTML();document.body.appendChild(p);
  place(p,(e&&e.currentTarget&&e.currentTarget.getBoundingClientRect)?e.currentTarget:$('kc-amb-btn'));
  requestAnimationFrame(()=>p.classList.add('open'));
  setTimeout(()=>{document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',onKey,true);},0);
};
window.kcAmbClose=close;
document.addEventListener('click',e=>{
  const b=e.target.closest('#kc-amb [data-am]');if(!b)return;
  const a=b.dataset.am;
  if(a==='close')close();
  else if(a==='play')window.kcAmbToggle();
  else if(a==='udel'){e.stopPropagation();const p=st.u.find(x=>x.id===b.dataset.id);if(!p)return;
    (typeof kcConfirm==='function'?kcConfirm('Supprimer le mélange « '+p.n+' » ?',{ok:'Supprimer',danger:true}):Promise.resolve(true)).then(ok=>{if(!ok)return;st.u=st.u.filter(x=>x!==p);save();ui();});}
  else if(a==='upre'){const p=st.u.find(x=>x.id===b.dataset.id);if(!p)return;st.v=Object.assign({},p.v);save();if(PLAY)SOUNDS.forEach(s=>applyVol(s.id));else play();ui();}
  else if(a==='save'){
    const v={};SOUNDS.forEach(s=>{const x=vol(s.id);if(x>0)v[s.id]=Math.round(x*100)/100;});
    if(!Object.keys(v).length){if(typeof showNotif==='function')showNotif('Active d’abord au moins un son','err');return;}
    const top=Object.keys(v).sort((a,b)=>v[b]-v[a])[0],ic=SBY[top]?SBY[top].ic:'graphic_eq';
    const ask=typeof kcPrompt==='function'?kcPrompt('Nom de ton mélange','Mon mélange '+(st.u.length+1),{ok:'Enregistrer',max:30,icon:'bookmark_add'}):Promise.resolve('Mon mélange '+(st.u.length+1));
    ask.then(n=>{n=String(n||'').trim().slice(0,30);if(!n)return;st.u.push({id:'u'+Date.now().toString(36),n,ic,v});if(st.u.length>24)st.u.shift();save();ui();if(typeof showNotif==='function')showNotif('Mélange « '+n+' » enregistré','ok');});}
  else if(a==='pre'){const p=PRESETS.find(x=>x.id===b.dataset.id);if(!p)return;st.v=Object.assign({},p.v);save();if(PLAY)SOUNDS.forEach(s=>applyVol(s.id));else play();ui();}
  else if(a==='tog'){const id=b.dataset.id;st.v[id]=vol(id)>0?0:.5;save();if(PLAY)applyVol(id);else if(st.v[id])play();ui();}
  else if(a==='timer'){st.t=+b.dataset.v||0;save();endAt=PLAY&&st.t?Date.now()+st.t*60000:0;startTick.fading=false;if(PLAY&&ctx)master.gain.setTargetAtTime(st.m*st.m,ctx.currentTime,.3);ui();}
});
document.addEventListener('input',e=>{
  const r=e.target.closest&&e.target.closest('#kc-amb input[type=range]');if(!r)return;
  const v=(+r.value||0)/100;r.style.setProperty('--p',r.value+'%');
  if(r.dataset.am==='master'){st.m=v;save();if(PLAY&&ctx)master.gain.setTargetAtTime(v*v,ctx.currentTime,.08);const ic=r.parentElement.querySelector('.ms');if(ic)ic.textContent=v?'volume_up':'volume_off';}
  else if(r.dataset.am==='vol'){
    const id=r.dataset.id;st.v[id]=v;save();
    const row=r.closest('.kamb-row');if(row)row.classList.toggle('on',v>0);
    if(PLAY)applyVol(id,true);else if(v>0)play();
    document.querySelectorAll('#kc-amb .kamb-chip').forEach(c=>{const p=PRESETS.find(x=>x.id===c.dataset.id)||st.u.find(x=>x.id===c.dataset.id);c.classList.toggle('on',!!p&&presetOn(p));});
  }
});
document.addEventListener('change',e=>{if(e.target.closest&&e.target.closest('#kc-amb input[type=range]'))ui();});
window.addEventListener('resize',()=>{const p=$('kc-amb');if(p){const b=$('kc-amb-btn');place(p,b&&b.offsetParent?b:$('kc-amb-fab'));}});
/* v84 : bouton flottant des sons d'ambiance quand la barre du haut est cachée (QCM, annales, flashcards, résultats…) */
const FAB_SCREENS=/^(quiz|results|annales|annales-hub|all-flashcards|concept-fc|fc-editor|imaging-session|match|course|fiche|atelier|ultra)$/;
function fabSync(){
  let f=$('kc-amb-fab');const b=$('kc-amb-btn'),scr=document.body.dataset.screen||'';
  const hidden=!b||!b.offsetParent||b.getBoundingClientRect().width===0;
  const modal=document.querySelector('.modal.open,.modal.show,.mdov.open,#fc-review.open,.fc-study.open');
  const want=hidden&&(FAB_SCREENS.test(scr)||PLAY||!!modal);
  if(!want){if(f)f.remove();return;}
  if(!f){f=document.createElement('button');f.id='kc-amb-fab';f.type='button';f.setAttribute('aria-label','Sons d’ambiance');f.innerHTML='<span class="ms">graphic_eq</span>';
    f.addEventListener('click',e=>window.kcAmbOpen(e));document.body.appendChild(f);}
  f.classList.toggle('on',PLAY);f.title=PLAY?'Sons d’ambiance (en cours)':'Sons d’ambiance';
}
function start(){ui();fabSync();setInterval(fabSync,1200);new MutationObserver(fabSync).observe(document.body,{attributes:true,attributeFilter:['data-screen','class']});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
