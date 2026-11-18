/* =========================================================
   kc-ambiance.js — Sons d'ambiance fabriqués par le site (18 nov. 2026, v73)
   Tout est synthétisé en direct avec Web Audio (aucun fichier, aucune connexion) :
   pluie, tonnerre, vagues, vent, feu de cheminée, oiseaux, ruisseau, bruits brun / rose / blanc.
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
const SOUNDS=[
  {id:'rain',n:'Pluie',ic:'rainy'},
  {id:'thunder',n:'Tonnerre',ic:'thunderstorm'},
  {id:'waves',n:'Vagues',ic:'waves'},
  {id:'wind',n:'Vent',ic:'air'},
  {id:'fire',n:'Feu de cheminée',ic:'local_fire_department'},
  {id:'forest',n:'Oiseaux',ic:'forest'},
  {id:'stream',n:'Ruisseau',ic:'water'},
  {id:'brown',n:'Bruit brun',ic:'texture'},
  {id:'pink',n:'Bruit rose',ic:'grain'},
  {id:'white',n:'Bruit blanc',ic:'blur_on'}
];
const PRESETS=[
  {id:'focus',n:'Concentration',ic:'psychology',v:{brown:.55}},
  {id:'rain',n:'Pluie douce',ic:'rainy',v:{rain:.6}},
  {id:'storm',n:'Orage',ic:'thunderstorm',v:{rain:.75,thunder:.7,wind:.25}},
  {id:'sea',n:'Bord de mer',ic:'beach_access',v:{waves:.75,wind:.2}},
  {id:'fire',n:'Coin du feu',ic:'fireplace',v:{fire:.7,rain:.3}},
  {id:'forest',n:'Forêt',ic:'forest',v:{forest:.55,stream:.4,wind:.12}}
];
const TIMERS=[0,15,30,45,60,90];

/* ───────── Réglages ───────── */
function load(){try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');return {v:o.v&&typeof o.v==='object'?o.v:{},m:typeof o.m==='number'?o.m:.7,t:TIMERS.includes(o.t)?o.t:0};}catch(e){return {v:{},m:.7,t:0};}}
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
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-12;comp.ratio.value=3;comp.attack.value=.01;comp.release.value=.3;
  master=ctx.createGain();master.gain.value=0;master.connect(comp);comp.connect(ctx.destination);
  return ctx;
}
/* bruits en boucle (stéréo : deux canaux différents = son large) */
function noiseBuf(kind){
  if(BUF[kind])return BUF[kind];
  const sec=kind==='brown'?10:6,len=Math.floor(ctx.sampleRate*sec),b=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){
    const d=b.getChannelData(ch);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0,peak=0;
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1;
      if(kind==='white')d[i]=w;
      else if(kind==='pink'){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=b0+b1+b2+b3+b4+b5+b6+w*.5362;b6=w*.115926;}
      else{last=(last+.02*w)/1.02;d[i]=last;}
    }
    /* boucle sans « clic » : on retire la dérive pour que la fin rejoigne le début */
    const drift=d[len-1]-d[0];for(let i=0;i<len;i++)d[i]-=drift*i/len;
    for(let i=0;i<len;i++){const a=Math.abs(d[i]);if(a>peak)peak=a;}
    const k=.9/(peak||1);for(let i=0;i<len;i++)d[i]*=k;
  }
  return BUF[kind]=b;
}
function src(kind,o){const s=ctx.createBufferSource();s.buffer=noiseBuf(kind);s.loop=true;s.connect(o);s.start(ctx.currentTime,Math.random()*s.buffer.duration);return s;}
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

const BUILD={
  rain(out,nodes,timers){
    nodes.push(src('pink',chain(flt('highpass',450),flt('lowpass',7500),gain(.5),out)));
    nodes.push(src('brown',chain(flt('lowpass',380),gain(.32),out)));
    sched(38,t=>grain(t,out,{f:R(2200,7000),q:1.4,a:R(.04,.2),dur:R(.012,.045),pan:R(-.8,.8)}),timers);
  },
  thunder(out,nodes,timers){
    nodes.push(src('brown',chain(flt('lowpass',110),gain(.05),out)));
    sched(()=>R(9,26),t=>{
      const s=ctx.createBufferSource();s.buffer=noiseBuf('brown');
      const f=flt('lowpass',900,.7),g=ctx.createGain(),p=pan(R(-.6,.6));
      const pk=R(.55,1),dur=R(4,8),roll=R(.8,1.8);
      f.frequency.setValueAtTime(R(700,1400),t);f.frequency.exponentialRampToValueAtTime(R(120,220),t+R(.4,1));
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(pk,t+R(.05,.35));
      g.gain.setTargetAtTime(pk*.45,t+.5,.4);g.gain.setTargetAtTime(pk*.8,t+roll,.15);
      g.gain.setTargetAtTime(.0001,t+roll+.3,dur/4);
      chain(s,f,g,p,out);s.start(t,Math.random()*5,dur+1.5);s.onended=()=>{try{p.disconnect();}catch(e){}};
    },timers,R(1.5,5));
  },
  waves(out,nodes,timers){
    [[.085,560,420,.36,.3],[.118,420,300,.26,.22]].forEach(([r,f0,fd,g0,gd])=>{
      const lp=flt('lowpass',f0,.5),g=gain(g0);
      nodes.push(src('brown',chain(lp,g,out)));
      const o=ctx.createOscillator();o.frequency.value=r;
      const a=gain(fd),b=gain(gd);o.connect(a);a.connect(lp.frequency);o.connect(b);b.connect(g.gain);
      o.start(ctx.currentTime+Math.random()*3);nodes.push(o);
      const foam=gain(.035);nodes.push(src('white',chain(flt('highpass',2600),foam,out)));
      const c=gain(.03);o.connect(c);c.connect(foam.gain);
    });
  },
  wind(out,nodes,timers){
    const bp=flt('bandpass',520,.9),g=gain(.42),gust=gain(1);
    nodes.push(src('pink',chain(bp,g,gust,out)));
    lfo(.06,280,bp.frequency,nodes);lfo(.071,.28,g.gain,nodes);
    const g2=gain(.3);nodes.push(src('brown',chain(flt('lowpass',320),g2,gust)));lfo(.045,.18,g2.gain,nodes);
    timers.push(setInterval(()=>{if(ctx&&ctx.state==='running'){gust.gain.setTargetAtTime(R(.55,1.35),ctx.currentTime,R(.8,2));bp.frequency.setTargetAtTime(R(380,780),ctx.currentTime,1.5);}},3200));
  },
  fire(out,nodes,timers){
    nodes.push(src('brown',chain(flt('lowpass',650),gain(.42),out)));
    const hiss=gain(.05);nodes.push(src('pink',chain(flt('bandpass',1300,.5),hiss,out)));
    timers.push(setInterval(()=>{if(ctx&&ctx.state==='running')hiss.gain.setTargetAtTime(R(.02,.08),ctx.currentTime,.12);},180));
    sched(7,t=>{
      const big=Math.random()<.1;
      grain(t,out,{type:'highpass',f:big?900:R(1600,4200),q:.7,a:big?R(.5,.85):R(.12,.45),dur:big?R(.02,.05):R(.003,.012),pan:R(-.5,.5)});
      if(Math.random()<.35)for(let i=1,n=2+(Math.random()*4|0);i<=n;i++)grain(t+i*R(.012,.04),out,{type:'highpass',f:R(2000,5000),q:.7,a:R(.05,.2),dur:R(.002,.008),pan:R(-.5,.5)});
    },timers);
  },
  forest(out,nodes,timers){
    nodes.push(src('pink',chain(flt('bandpass',2800,.35),gain(.018),out)));
    nodes.push(src('brown',chain(flt('lowpass',300),gain(.05),out)));
    const note=(t,f0,f1,d,a,p)=>{
      const o=ctx.createOscillator(),g=ctx.createGain(),pn=pan(p);o.type='sine';
      o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+d);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+Math.min(.012,d/3));g.gain.exponentialRampToValueAtTime(.0001,t+d);
      chain(o,g,pn,out);o.start(t);o.stop(t+d+.02);o.onended=()=>{try{pn.disconnect();}catch(e){}};
    };
    sched(()=>R(.7,3.8),t=>{
      const p=R(-.85,.85),a=R(.03,.11),kind=Math.random();
      if(kind<.45){/* gazouillis : 2 à 5 notes qui montent ou descendent */
        let tt=t;const base=R(2600,4600),n=2+(Math.random()*4|0);
        for(let i=0;i<n;i++){const d=R(.05,.11),f=base*R(.85,1.2);note(tt,f,f*R(.7,1.45),d,a,p);tt+=d+R(.03,.09);}
      }else if(kind<.75){/* trille rapide */
        const f=R(3200,5200),n=7+(Math.random()*8|0);for(let i=0;i<n;i++)note(t+i*.045,f*1.05,f*.92,.035,a*.8,p);
      }else{/* sifflement en deux temps (merle) */
        const f=R(1700,2600);note(t,f,f*R(1.2,1.5),R(.22,.34),a,p);note(t+R(.32,.45),f*R(1.1,1.3),f*R(.8,1),R(.18,.3),a*.8,p);
      }
    },timers,R(.2,1.2));
  },
  stream(out,nodes,timers){
    const g=gain(.24);nodes.push(src('white',chain(flt('bandpass',1600,.6),flt('lowpass',5000),g,out)));
    nodes.push(src('pink',chain(flt('bandpass',650,.8),gain(.18),out)));
    timers.push(setInterval(()=>{if(ctx&&ctx.state==='running')g.gain.setTargetAtTime(R(.13,.34),ctx.currentTime,.035);},70));
    sched(5,t=>{
      const o=ctx.createOscillator(),gg=ctx.createGain(),pn=pan(R(-.6,.6)),f=R(450,1300);
      o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*R(1.5,2.2),t+.04);
      gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(R(.02,.07),t+.006);gg.gain.exponentialRampToValueAtTime(.0001,t+.055);
      chain(o,gg,pn,out);o.start(t);o.stop(t+.07);o.onended=()=>{try{pn.disconnect();}catch(e){}};
    },timers);
  },
  brown(out,nodes){nodes.push(src('brown',chain(gain(1),out)));},
  pink(out,nodes){nodes.push(src('pink',chain(gain(.32),out)));},
  white(out,nodes){nodes.push(src('white',chain(flt('lowpass',9000),gain(.16),out)));}
};
function mount(id){
  if(N[id]||!ctx||!BUILD[id])return;
  const g=gain(0);g.connect(master);
  const o={g,nodes:[],timers:[]};N[id]=o;
  try{BUILD[id](g,o.nodes,o.timers);}catch(e){console.warn('[ambiance]',id,e);}
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
  return `<div class="kamb-row${v?' on':''}" data-id="${s.id}">
    <button type="button" class="kamb-ri" data-am="tog" data-id="${s.id}" title="${v?'Couper':'Activer'} : ${esc(s.n)}"><span class="ms">${s.ic}</span></button>
    <span class="kamb-rn">${esc(s.n)}</span>
    <input type="range" min="0" max="100" step="1" value="${v}" data-am="vol" data-id="${s.id}" aria-label="Volume : ${esc(s.n)}" style="--p:${v}%">
  </div>`;
}
function presetOn(p){return SOUNDS.every(s=>Math.abs(vol(s.id)-(p.v[s.id]||0))<.02);}
function panelHTML(){
  const m=Math.round(st.m*100);
  return `<div class="kamb-h"><span class="kamb-ic${PLAY?' on':''}"><span class="ms">graphic_eq</span></span><div><b>Sons d’ambiance</b><small>Fabriqués par le site · sans pub, sans internet</small></div>
      <button type="button" class="kamb-x" data-am="close" aria-label="Fermer"><span class="ms">close</span></button></div>
    <div class="kamb-main">
      <button type="button" class="kamb-play${PLAY?' on':''}" data-am="play" aria-label="${PLAY?'Pause':'Lecture'}"><span class="ms">${PLAY?'pause':'play_arrow'}</span></button>
      <div class="kamb-mv"><span class="ms">${m?'volume_up':'volume_off'}</span><input type="range" min="0" max="100" value="${m}" data-am="master" aria-label="Volume général" style="--p:${m}%"></div>
    </div>
    <div class="kamb-pre">${PRESETS.map(p=>`<button type="button" class="kamb-chip${presetOn(p)?' on':''}" data-am="pre" data-id="${p.id}"><span class="ms">${p.ic}</span>${esc(p.n)}</button>`).join('')}</div>
    <div class="kamb-list">${SOUNDS.map(rowHTML).join('')}</div>
    <div class="kamb-foot"><span class="kamb-fl"><span class="ms">timer</span>Arrêt auto</span>
      <div class="kamb-seg">${TIMERS.map(t=>`<button type="button" class="${st.t===t?'on':''}" data-am="timer" data-v="${t}">${t?t+' min':'Non'}</button>`).join('')}</div>
      <span class="kamb-left" id="kamb-left">${leftTxt()}</span></div>`;
}
function ui(){
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
function outside(e){const p=$('kc-amb');if(!p)return;if(p.contains(e.target)||e.target.closest('#kc-amb-btn'))return;close();}
function onKey(e){if(e.key==='Escape'&&$('kc-amb')){e.stopPropagation();close();}}
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
    document.querySelectorAll('#kc-amb .kamb-chip').forEach(c=>{const p=PRESETS.find(x=>x.id===c.dataset.id);c.classList.toggle('on',!!p&&presetOn(p));});
  }
});
document.addEventListener('change',e=>{if(e.target.closest&&e.target.closest('#kc-amb input[type=range]'))ui();});
window.addEventListener('resize',()=>{const p=$('kc-amb');if(p)place(p,$('kc-amb-btn'));});
function start(){ui();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
