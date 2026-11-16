/* =========================================================
   kc-home-plus.js — v66 (16 nov. 2026)
   1. Carte « Ma ville » de l'accueil : scène SVG vivante (window.kcCityScene)
      - les bâtiments grandissent avec les habitants (7 étapes : petite maison → gratte-ciel)
      - ciel réel : jour / aube / coucher de soleil / nuit (soleil et lune qui suivent leur course, phase de la lune)
      - météo réelle de la ville choisie (Open-Meteo, gratuit, sans clé) : pluie, neige, orage, nuages, brouillard
      Lieu : kp_wx_loc {name, sub, lat, lon} ; cache météo kp_wx_cache (30 min). Fenêtre : kcWeatherSetup().
   2. Petite fenêtre maison (kcDlg) + objectif du jour (kcGoalDialog) à la place du prompt() du navigateur.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const SS=(k,v)=>{try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};

/* ───────── Petite fenêtre maison ───────── */
function kcDlg(o){
  const old=$('kc-dlg');if(old)old.remove();
  const bg=document.createElement('div');bg.id='kc-dlg';bg.className='kc-dlg-bg';
  bg.innerHTML=`<div class="kc-dlg" role="dialog" aria-modal="true" aria-labelledby="kc-dlg-t">
    <div class="kc-dlg-h">${o.icon?`<span class="kc-dlg-ic"><span class="ms">${o.icon}</span></span>`:''}<div><b id="kc-dlg-t">${esc(o.title)}</b>${o.sub?`<small>${esc(o.sub)}</small>`:''}</div>
      <button class="kc-dlg-x" data-x aria-label="Fermer"><span class="ms">close</span></button></div>
    <div class="kc-dlg-b">${o.body||''}</div>
    ${o.foot===false?'':`<div class="kc-dlg-f">${o.foot||'<button class="btn btn-g" data-x>Annuler</button><button class="btn btn-p" data-ok>OK</button>'}</div>`}</div>`;
  const close=()=>{bg.classList.remove('open');document.removeEventListener('keydown',key,true);setTimeout(()=>bg.remove(),180);if(o.onClose)o.onClose();};
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();close();}else if(e.key==='Enter'&&o.onOk&&!e.target.closest('textarea')&&!e.target.closest('.kc-wx-res')){e.preventDefault();ok();}};
  const ok=()=>{if(!o.onOk||o.onOk(bg)!==false)close();};
  bg.addEventListener('mousedown',e=>{bg._d=e.target===bg;});
  bg.addEventListener('click',e=>{
    if(e.target===bg&&bg._d){close();return;}
    if(e.target.closest('[data-x]')){close();return;}
    if(e.target.closest('[data-ok]')){ok();return;}
  });
  document.addEventListener('keydown',key,true);
  document.body.appendChild(bg);
  requestAnimationFrame(()=>bg.classList.add('open'));
  if(o.onOpen)o.onOpen(bg);
  return {el:bg,close};
}
window.kcDlg=kcDlg;

/* ───────── Objectif du jour ───────── */
window.kcGoalDialog=function(){
  let cur=10;try{cur=dailyGoal||10;}catch(e){}
  const chips=[10,20,30,50,80,100];
  kcDlg({title:'Objectif du jour',sub:'Combien de questions veux-tu faire chaque jour ?',icon:'flag',
    body:`<div class="kc-goal">
      <button class="kc-goal-b" data-d="-5" aria-label="Moins"><span class="ms">remove</span></button>
      <div class="kc-goal-v"><input id="kc-goal-in" type="number" min="1" max="500" value="${cur}" data-no-step inputmode="numeric"><small>questions / jour</small></div>
      <button class="kc-goal-b" data-d="5" aria-label="Plus"><span class="ms">add</span></button></div>
      <input id="kc-goal-r" class="kc-range" type="range" min="5" max="150" step="5" value="${Math.min(150,cur)}">
      <div class="kc-goal-chips">${chips.map(n=>`<button class="kc-chip${n===cur?' on':''}" data-n="${n}">${n}</button>`).join('')}</div>
      <p class="kc-goal-hint" id="kc-goal-hint"></p>`,
    foot:'<button class="btn btn-g" data-x>Annuler</button><button class="btn btn-p" data-ok><span class="ms">check</span>Enregistrer</button>',
    onOpen(bg){
      const inp=bg.querySelector('#kc-goal-in'),rg=bg.querySelector('#kc-goal-r'),hint=bg.querySelector('#kc-goal-hint');
      const set=n=>{n=Math.max(1,Math.min(500,Math.round(n)||1));inp.value=n;rg.value=Math.min(150,n);
        bg.querySelectorAll('.kc-chip').forEach(c=>c.classList.toggle('on',+c.dataset.n===n));
        const min=Math.round(n*0.6);hint.textContent=`≈ ${min<60?min+' min':Math.floor(min/60)+' h '+String(min%60).padStart(2,'0')} par jour${n<=20?' · parfait pour garder le rythme':n<=60?' · un bon rythme de révision':' · rythme intensif, pense aux pauses'}`;};
      set(cur);
      inp.addEventListener('input',()=>set(+inp.value));
      rg.addEventListener('input',()=>set(+rg.value));
      bg.addEventListener('click',e=>{const c=e.target.closest('.kc-chip');if(c)set(+c.dataset.n);const b=e.target.closest('.kc-goal-b');if(b)set(+inp.value+ +b.dataset.d);});
      /* v69 : plus de sélection automatique du nombre à l'ouverture (surlignage gênant) */
    },
    onOk(bg){
      const n=Math.max(1,Math.min(500,parseInt(bg.querySelector('#kc-goal-in').value,10)||0));
      if(!n){notify('Entre un nombre de questions (1 à 500).','err');return false;}
      try{dailyGoal=n;}catch(e){}
      if(typeof saveAll==='function')saveAll();
      notify(`Objectif : ${n} questions par jour`,'ok');
      if(typeof renderHome==='function')renderHome();else if(window.khRender)khRender();
    }});
};

/* ───────── Météo (Open-Meteo, gratuit, sans clé) ───────── */
const LOC='kp_wx_loc',CACHE='kp_wx_cache';
let wxBusy=null;
function getLoc(){const l=LS(LOC,null);return l&&isFinite(l.lat)&&isFinite(l.lon)?l:null;}
async function getWx(force){
  const loc=getLoc();if(!loc)return null;
  const c=LS(CACHE,null);
  if(!force&&c&&c.lat===loc.lat&&c.lon===loc.lon&&Date.now()-c.at<30*60e3)return c;
  if(wxBusy)return wxBusy;
  wxBusy=(async()=>{
    try{
      const u=`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,is_day,cloud_cover&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
      const r=await fetch(u);if(!r.ok)throw new Error('meteo '+r.status);
      const j=await r.json(),cu=j.current||{},d=j.daily||{};
      const o={at:Date.now(),lat:loc.lat,lon:loc.lon,off:j.utc_offset_seconds||0,t:cu.temperature_2m,code:cu.weather_code,day:cu.is_day,cloud:cu.cloud_cover,
        rise:d.sunrise&&d.sunrise[0],set:d.sunset&&d.sunset[0]};
      SS(CACHE,o);return o;
    }catch(e){return c&&c.lat===loc.lat?c:null;}
    finally{setTimeout(()=>{wxBusy=null;},0);}
  })();
  return wxBusy;
}
function wxKind(code,cloud){
  if(code==null)return 'clear';
  if(code>=95)return 'storm';
  if((code>=71&&code<=77)||code===85||code===86)return 'snow';
  if((code>=51&&code<=67)||(code>=80&&code<=82))return 'rain';
  if(code===45||code===48)return 'fog';
  if(code===3)return 'cloudy';
  if(code===1||code===2)return 'partly';
  return cloud>70?'cloudy':'clear';
}
const WX_LBL={clear:'Ciel dégagé',partly:'Éclaircies',cloudy:'Nuageux',rain:'Pluie',snow:'Neige',storm:'Orage',fog:'Brouillard'};
function wxIcon(k,night){return {clear:night?'clear_night':'sunny',partly:night?'partly_cloudy_night':'partly_cloudy_day',cloudy:'cloud',rain:'rainy',snow:'weather_snowy',storm:'thunderstorm',fog:'foggy'}[k]||'sunny';}

/* Heure solaire : avec la météo → lever/coucher réels de la ville ; sinon estimation selon la saison */
function solar(wx){
  let now,rise,set;
  if(wx&&wx.rise&&wx.set){
    now=Date.now()+wx.off*1000;
    rise=Date.parse(wx.rise+'Z');set=Date.parse(wx.set+'Z');
    const dayMs=86400000,d0=Math.floor(now/dayMs)*dayMs,r0=Math.floor(rise/dayMs)*dayMs;
    if(r0!==d0){rise+=d0-r0;set+=d0-r0;}
  }else{
    const d=new Date(),doy=Math.floor((d-new Date(d.getFullYear(),0,0))/864e5),c=Math.cos(2*Math.PI*(doy+10)/365);
    const base=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
    now=d.getTime();rise=base+(7.0+1.3*c)*36e5;set=base+(19.3-2.3*c)*36e5;
  }
  const m=60e3;let period;
  if(now>=rise-35*m&&now<rise+35*m)period='dawn';
  else if(now>=set-45*m&&now<set+30*m)period='dusk';
  else if(now>rise&&now<set)period='day';
  else period='night';
  let t;
  if(now>=rise&&now<=set)t=(now-rise)/(set-rise);
  else{const len=86400000-(set-rise);let since=now>set?now-set:now+86400000-set;t=Math.min(1,since/len);}
  return {period,t,sunUp:now>=rise-20*m&&now<=set+20*m};
}
function moonPhase(){const syn=29.530588853,ref=Date.UTC(2000,0,6,18,14);return (((Date.now()-ref)/864e5)%syn+syn)%syn/syn;}

/* ───────── Scène ───────── */
function rnd(seed){let x=seed|0||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return ((x>>>0)%10000)/10000;};}
const STAGES=[0,40,120,300,800,2000,5000];
const LVLS=[1,3,6,10,15,22,30];
const PLAN=[
  [['t','H'],['t']],
  [['H','t','H'],['H','t']],
  [['H','L','t'],['L','H','t']],
  [['L','M','H'],['M','L','t']],
  [['M','T','L','t'],['T','M','L']],
  [['T','S','M','T'],['S','T','M','t']],
  [['S','T','S','M','S'],['S','S','T','S','M']]
];
const BW={H:34,L:36,M:42,T:38,S:36,t:20};
const BH={H:22,L:44,M:74,T:104,S:128,t:30};
function stageOf(pop,lv){
  let s=0,f=0;
  if(pop>0){for(let i=0;i<STAGES.length;i++)if(pop>=STAGES[i])s=i;f=s<STAGES.length-1?(pop-STAGES[s])/(STAGES[s+1]-STAGES[s]):1;}
  else{for(let i=0;i<LVLS.length;i++)if(lv>=LVLS[i])s=i;f=s<LVLS.length-1?(lv-LVLS[s])/(LVLS[s+1]-LVLS[s]):1;}
  return {s,f:Math.max(0,Math.min(1,f))};
}
const PAL={
  day:{sky:['#3b8dff','#8cc8ff','#c9e8ff'],b:['#f3f6fb','#dfe6f1','#c8d3e4'],win:'#9ec3ea',winOn:'#ffe08a',lit:.05,roof:'#e2725b',door:'#8a5a44',ground:'#7bc67e',road:'#5e6b7a',tree:'#3fb871',trunk:'#7a5a3a',cloud:'#ffffff',star:0},
  dawn:{sky:['#5866d0','#e79ab4','#ffd6a0'],b:['#6c5a8c','#5a4b7a','#4a3e68'],win:'#a58fc2',winOn:'#ffd36b',lit:.35,roof:'#8a4a6a',door:'#3d2f50',ground:'#5a7a5f',road:'#4a4560',tree:'#3f8a5f',trunk:'#5a4434',cloud:'#ffd9e2',star:.25},
  dusk:{sky:['#2b2f7a','#b8458a','#ff8f5a','#ffd27a'],b:['#4b3a6a','#3e3058','#33284a'],win:'#7d6aa0',winOn:'#ffcf6b',lit:.55,roof:'#6e3352',door:'#2a2040',ground:'#3d3550',road:'#2f2a44',tree:'#2f6a4f',trunk:'#4a3a30',cloud:'#ffc2a8',star:.2},
  night:{sky:['#060a1c','#111a3d','#1d2a5a'],b:['#2a3152','#232a46','#1c223a'],win:'#323a5c',winOn:'#ffd36b',lit:.62,roof:'#3a2f52',door:'#151a2c',ground:'#161c30',road:'#10142a',tree:'#1e4a3a',trunk:'#2e2620',cloud:'#3a4466',star:1}
};
const GREY={day:{sky:['#7f8ea6','#a9b5c6','#ccd4df'],b:['#d9dee7','#c6cdd9','#b3bccb'],ground:'#6f9a72',cloud:'#e8ecf2'},night:{sky:['#0a0e1a','#151b2c','#232b40'],cloud:'#2c3448'},dawn:{sky:['#5a6280','#a08aa0','#c8b4b0'],cloud:'#b8aab8'},dusk:{sky:['#33334f','#7a5070','#b0786a'],cloud:'#8a7088'}};
function cloudPath(x,y,s){return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="8" rx="26" ry="9"/><circle cx="-10" cy="3" r="10"/><circle cx="6" cy="-1" r="13"/><circle cx="20" cy="6" r="8"/></g>`;}
let lastOpts=null,ro=null;
function scene(o){
  const el=$('kh-city-scene');if(!el)return;
  lastOpts=o;
  const W=Math.max(240,Math.round(el.clientWidth||340)),H=Math.max(140,Math.round(el.clientHeight||168));
  const wx=o.wx||null,kind=wx?wxKind(wx.code,wx.cloud):'clear';
  const sol=solar(wx),per=sol.period;
  const grey=(kind==='rain'||kind==='storm'||kind==='snow'||kind==='fog'||kind==='cloudy');
  const P=Object.assign({},PAL[per],grey&&GREY[per]?GREY[per]:{});
  const {s:st,f}=stageOf(o.pop||0,o.lv||1);
  const R=rnd(9173+st*31);
  const G=H-16;
  let defs=`<linearGradient id="kcs-sky" x1="0" y1="0" x2="0" y2="1">${P.sky.map((c,i)=>`<stop offset="${(i/(P.sky.length-1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>
    <radialGradient id="kcs-sun"><stop offset="0" stop-color="${per==='day'?'#fff6c2':'#ffe2a8'}"/><stop offset=".45" stop-color="${per==='day'?'#ffd84d':'#ff9f4d'}"/><stop offset="1" stop-color="${per==='day'?'#ffd84d':'#ff7a3d'}" stop-opacity="0"/></radialGradient>
    <linearGradient id="kcs-beam" x1="0" x2="1"><stop offset="0" stop-color="#fff6c2" stop-opacity=".45"/><stop offset="1" stop-color="#fff6c2" stop-opacity="0"/></linearGradient>
    <radialGradient id="kcs-moon"><stop offset="0" stop-color="#fffbe8" stop-opacity=".5"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/></radialGradient>`;
  let sky=`<rect width="${W}" height="${H}" fill="url(#kcs-sky)"/>`;
  /* étoiles */
  const starA=grey?P.star*.25:P.star;
  if(starA>0){const r2=rnd(77);for(let i=0;i<Math.round(W/9);i++){const x=r2()*W,y=r2()*G*.62,rr=r2()*.9+.35;sky+=`<circle class="kcs-star" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(2)}" fill="#fff" opacity="${(starA*(.35+r2()*.65)).toFixed(2)}" style="animation-delay:${(r2()*4).toFixed(2)}s"/>`;}}
  /* soleil / lune sur leur arc */
  const ax=t=>36+t*(W-72),ay=t=>Math.min(G-46,G-30-Math.sin(Math.PI*t)*(G-48));
  if(sol.sunUp){
    const x=ax(sol.t),y=ay(sol.t),big=per!=='day';
    if(!(grey&&kind!=='cloudy'&&kind!=='fog'))sky+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${big?46:40}" fill="url(#kcs-sun)" opacity="${grey?.45:.9}"/><circle class="kcs-sunc" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${big?15:13}" fill="${per==='day'?'#ffe066':'#ffb057'}" opacity="${grey?.5:1}"/>`;
  }else{
    const x=ax(sol.t),y=ay(sol.t),r=12,ph=moonPhase(),dx=ph<.5?-4*r*ph:4*r*(1-ph);
    defs+=`<mask id="kcs-mm"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff"/><circle cx="${(x+dx).toFixed(1)}" cy="${y.toFixed(1)}" r="${r+.5}" fill="#000"/></mask>`;
    sky+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34" fill="url(#kcs-moon)" opacity="${grey?.3:.8}"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#e9e6da" opacity=".14"/>
      <g mask="url(#kcs-mm)" opacity="${grey?.55:1}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#f4f1e4"/><circle cx="${(x-4).toFixed(1)}" cy="${(y-3).toFixed(1)}" r="2.6" fill="#dcd7c4"/><circle cx="${(x+3.5).toFixed(1)}" cy="${(y+3).toFixed(1)}" r="1.8" fill="#dcd7c4"/><circle cx="${(x+4).toFixed(1)}" cy="${(y-4.5).toFixed(1)}" r="1.2" fill="#dcd7c4"/></g>`;
  }
  /* nuages */
  const nC=kind==='clear'?(per==='night'?0:1):kind==='partly'?2:kind==='fog'?2:4;
  let clouds='';
  for(let i=0;i<nC;i++){const r3=rnd(500+i*13),x=r3()*W,y=10+r3()*(grey?26:40),sc=(grey?1.15:.85)+r3()*.5;clouds+=`<g class="kcs-cloud" style="animation-duration:${(60+r3()*50).toFixed(0)}s;animation-delay:-${(r3()*60).toFixed(0)}s" fill="${P.cloud}" opacity="${grey?.92:(per==='night'?.35:.85)}">${cloudPath(x,y,sc)}</g>`;}
  /* bâtiments */
  const nextW=o.next?58:0,nextH=o.next?Math.round(70+st*6):0;
  const gx=o.next?Math.round(W*.56-nextW/2):W;
  const plan=PLAN[st],mult=.9+.22*f;
  const place=(list,x0,x1)=>{const out=[];let x=x0,i=0,guard=0;while(guard++<40){const k=list[i%list.length];const w=BW[k]+(k==='t'?0:Math.round((R()-.5)*8));if(x+w>x1)break;out.push({k,x,w});x+=w+(k==='t'?4:6+Math.round(R()*6));i++;if(i>=list.length&&x>x1-30)break;}
    const used=out.length?out[out.length-1].x+out[out.length-1].w-x0:0,extra=(x1-x0)-used;
    if(out.length>1&&extra>0){const step=extra/(out.length);out.forEach((b,j)=>{b.x+=Math.round(step*(j+.5));});}
    return out;};
  const bl=place(plan[0],10,o.next?gx-8:W*.5).concat(place(plan[1],o.next?gx+nextW+8:W*.5+6,W-8));
  let bld='',trees='';
  bl.forEach((b,i)=>{
    const col=P.b[i%P.b.length];
    if(b.k==='t'){const th=BH.t*(.8+R()*.4),cx=b.x+b.w/2;trees+=`<g class="kcs-tree"><rect x="${(cx-1.5).toFixed(1)}" y="${(G-th*.45).toFixed(1)}" width="3" height="${(th*.45).toFixed(1)}" fill="${P.trunk}"/><circle cx="${cx.toFixed(1)}" cy="${(G-th*.62).toFixed(1)}" r="${(b.w*.5).toFixed(1)}" fill="${P.tree}"/></g>`;return;}
    const h=Math.round(BH[b.k]*mult*(.88+R()*.24)),y=G-h;
    let g=`<rect x="${b.x}" y="${y}" width="${b.w}" height="${h}" rx="2" fill="${col}"/>`;
    if(b.k==='H'){
      g=`<rect x="${b.x}" y="${y}" width="${b.w}" height="${h}" fill="${col}"/><path d="M${b.x-3} ${y} L${b.x+b.w/2} ${y-14} L${b.x+b.w+3} ${y} Z" fill="${P.roof}"/><rect x="${b.x+b.w/2-4}" y="${G-11}" width="8" height="11" rx="1.5" fill="${P.door}"/>`;
      [[5],[b.w-12]].forEach(([wx2])=>{const on=R()<P.lit*1.2;g+=`<rect x="${b.x+wx2}" y="${y+6}" width="7" height="6" rx="1" fill="${on?P.winOn:P.win}"/>`;});
    }else{
      const cols=Math.max(2,Math.floor((b.w-8)/9)),rows=Math.max(2,Math.floor((h-12)/11)),cw=(b.w-8)/cols;
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const on=R()<P.lit;g+=`<rect x="${(b.x+4+c*cw+1.5).toFixed(1)}" y="${y+7+r*11}" width="${(cw-3).toFixed(1)}" height="6" rx="1" fill="${on?P.winOn:P.win}"${on&&per!=='day'?' class="kcs-win"':''}/>`;}
      if(b.k==='S'){g+=`<rect x="${b.x+b.w/2-1}" y="${y-14}" width="2" height="14" fill="${col}"/><circle cx="${b.x+b.w/2}" cy="${y-15}" r="2" fill="#ff4d4d" class="${per==='day'?'':'kcs-blink'}"/>`;}
      if(b.k==='T')g+=`<rect x="${b.x+4}" y="${y-5}" width="${b.w-8}" height="5" fill="${col}" opacity=".85"/>`;
    }
    bld+=`<g class="kcs-b" style="--d:${(i*.05).toFixed(2)}s">${g}</g>`;
  });
  /* monument en construction */
  let ghost='';
  if(o.next){ghost=`<rect x="${gx}" y="${G-nextH}" width="${nextW}" height="${nextH}" rx="4" fill="${per==='day'&&!grey?'rgba(255,255,255,.35)':'rgba(255,255,255,.08)'}" stroke="var(--kc-primary,#2B5CFF)" stroke-width="1.6" stroke-dasharray="5 4"/><rect x="${gx}" y="${G-Math.round(nextH*o.next.pct/100)}" width="${nextW}" height="${Math.round(nextH*o.next.pct/100)}" rx="0" fill="var(--kc-primary,#2B5CFF)" opacity=".22"/>`;}
  /* sol, route, voiture */
  /* sol : trottoir + route, puis passants et véhicules (v67 : plus de vie, nombre selon la taille de la ville) */
  const night=per==='night'||per==='dusk';
  const ground=`<rect x="0" y="${G}" width="${W}" height="${H-G}" fill="${P.road}"/><rect x="0" y="${G}" width="${W}" height="4" fill="${P.ground}"/><line x1="0" x2="${W}" y1="${G+10}" y2="${G+10}" stroke="${night?'rgba(255,255,255,.25)':'rgba(255,255,255,.7)'}" stroke-width="1" stroke-dasharray="7 7"/>`;
  const RL=rnd(4242+st);
  const SHIRT=['#e5394f','#2f80ed','#f2b705','#1fa463','#9b51e0','#ff7a45','#14b8a6','#f472b6'],SKIN=['#f1c27d','#c68642','#8d5524','#ffdbac','#e0ac69'],HAIR=['#2b1d14','#4a3121','#111','#a0522d','#d9b38c'];
  const person=(i,dog)=>{
    const sh=SHIRT[i%SHIRT.length],sk=SKIN[Math.floor(RL()*SKIN.length)],hr=HAIR[Math.floor(RL()*HAIR.length)],pants=night?'#2a2f45':'#3b4252',sc=.95+RL()*.25,skirt=RL()<.35;
    const legs=`<g class="kcs-leg"><line x1="-1" y1="-5" x2="-1" y2="0" stroke="${pants}" stroke-width="1.6" stroke-linecap="round"/></g><g class="kcs-leg kcs-leg2"><line x1="1" y1="-5" x2="1" y2="0" stroke="${pants}" stroke-width="1.6" stroke-linecap="round"/></g>`;
    const body=skirt?`<path d="M-2.4 -11 h4.8 l1 6 h-6.8 z" fill="${sh}"/>`:`<rect x="-2.4" y="-11" width="4.8" height="6.4" rx="1.6" fill="${sh}"/>`;
    const arm=`<g class="kcs-arm"><line x1="0" y1="-10" x2="0" y2="-6" stroke="${sk}" stroke-width="1.3" stroke-linecap="round"/></g>`;
    const head=`<circle cx="0" cy="-13.4" r="2.3" fill="${sk}"/><path d="M-2.4 -13.6 a2.4 2.4 0 0 1 4.8 0 z" fill="${hr}"/>`;
    const pup=dog?`<g transform="translate(-9 0)"><g class="kcs-leg"><line x1="-2" y1="-2" x2="-2" y2="0" stroke="#7a5230" stroke-width="1.1"/></g><g class="kcs-leg kcs-leg2"><line x1="2" y1="-2" x2="2" y2="0" stroke="#7a5230" stroke-width="1.1"/></g><rect x="-3.2" y="-4.6" width="6.4" height="3" rx="1.5" fill="#a0703f"/><circle cx="3.6" cy="-5" r="1.7" fill="#a0703f"/><line x1="-3" y1="-4" x2="-4.6" y2="-6" stroke="#a0703f" stroke-width="1" stroke-linecap="round"/><line x1="2" y1="-11" x2="-6" y2="-4" stroke="rgba(0,0,0,.35)" stroke-width=".5"/></g>`:'';
    return `<g transform="scale(${sc.toFixed(2)})">${pup}${legs}${body}${arm}${head}</g>`;
  };
  let life='';
  const nP=night?1:(st>=3?2:1);   /* v68 : beaucoup moins de passants */
  for(let i=0;i<nP;i++){
    const right=i%2===0,dur=(34+RL()*14).toFixed(1),dl=(-(i*20+RL()*10)).toFixed(1),y=G+3+(i%2);
    life+=`<g class="kcs-walk" style="--a:${right?-20:W+20}px;--b:${right?W+20:-20}px;animation-duration:${dur}s;animation-delay:${dl}s"><g transform="translate(0 ${y})${right?'':' scale(-1 1)'}">${person(i,i===1&&st>=1)}</g></g>`;
  }
  const car=(c,dir)=>`<g ${dir<0?'transform="scale(-1 1)"':''}><path d="M-13 -3 v-3.2 q0 -1.6 1.6 -1.8 l3.4 -.4 l3 -3.2 q.8 -.8 2 -.8 h6 q1.2 0 2 .9 l2.6 3.1 l3 .5 q1.4 .3 1.4 1.7 v3.2 z" fill="${c}"/><path d="M-6.6 -8.2 l2.4 -2.6 h4 v2.6 z M1 -8.2 v-2.6 h3.6 l2.1 2.6 z" fill="${night?'#ffe9a8':'#cfe8ff'}" opacity="${night?.8:.95}"/><circle cx="-7.5" cy="-2.6" r="2.4" fill="#1d1f24"/><circle cx="7.5" cy="-2.6" r="2.4" fill="#1d1f24"/><circle cx="-7.5" cy="-2.6" r=".9" fill="#9aa3ad"/><circle cx="7.5" cy="-2.6" r=".9" fill="#9aa3ad"/>${night?'<path d="M13 -5 l22 -3.5 v8 z" fill="url(#kcs-beam)"/><circle cx="12.6" cy="-5.2" r="1" fill="#fff6c2"/>':''}</g>`;
  const bus=dir=>`<g ${dir<0?'transform="scale(-1 1)"':''}><rect x="-20" y="-14" width="40" height="11.5" rx="3" fill="#f2b705"/><rect x="-20" y="-6.5" width="40" height="2" fill="#d99a00"/>${[-16,-9,-2,5].map(x=>`<rect x="${x}" y="-12" width="5.4" height="4.2" rx="1" fill="${night?'#ffe9a8':'#cfe8ff'}"/>`).join('')}<rect x="13" y="-12" width="5" height="8" rx="1" fill="${night?'#ffe9a8':'#cfe8ff'}"/><circle cx="-12" cy="-2.4" r="2.6" fill="#1d1f24"/><circle cx="12" cy="-2.4" r="2.6" fill="#1d1f24"/></g>`;
  const VC=['#e5394f','#2f80ed','#1fa463','#f5f5f5','#9b51e0','#ff7a45'];
  const nV=1;
  for(let i=0;i<nV;i++){const dir=i%2?-1:1,dur=(18+RL()*8).toFixed(1),dl=(-RL()*20).toFixed(1),y=dir>0?H-1:G+9.5;
    life+=`<g class="kcs-walk" style="--a:${dir>0?-30:W+30}px;--b:${dir>0?W+30:-30}px;animation-duration:${dur}s;animation-delay:${dl}s"><g transform="translate(0 ${y})">${car(VC[Math.floor(RL()*VC.length)],dir)}</g></g>`;}
  if(st>=5&&!night)life+=`<g class="kcs-walk" style="--a:${W+40}px;--b:-40px;animation-duration:34s;animation-delay:-${(RL()*24).toFixed(1)}s"><g transform="translate(0 ${G+9.5})">${bus(-1)}</g></g>`;
  /* météo */
  let fx='';
  if(kind==='rain'||kind==='storm'){const r4=rnd(31),n=Math.round(W/7);for(let i=0;i<n;i++){const x=r4()*W,y=r4()*H;fx+=`<line class="kcs-rain" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x-3).toFixed(1)}" y2="${(y+9).toFixed(1)}" style="animation-delay:-${(r4()*1).toFixed(2)}s;animation-duration:${(.55+r4()*.35).toFixed(2)}s"/>`;}}
  if(kind==='snow'){const r5=rnd(53),n=Math.round(W/9);for(let i=0;i<n;i++){const x=r5()*W;fx+=`<circle class="kcs-snow" cx="${x.toFixed(1)}" cy="-6" r="${(1+r5()*1.6).toFixed(1)}" style="animation-delay:-${(r5()*6).toFixed(2)}s;animation-duration:${(4+r5()*4).toFixed(1)}s"/>`;}}
  if(kind==='storm')fx+=`<rect class="kcs-flash" width="${W}" height="${H}" fill="#fff"/>`;
  if(kind==='fog')fx+=`<rect class="kcs-fog" x="-40" y="${G-40}" width="${W+80}" height="22" rx="11" fill="#fff" opacity=".22"/><rect class="kcs-fog kcs-fog2" x="-40" y="${G-16}" width="${W+80}" height="16" rx="8" fill="#fff" opacity=".28"/>`;
  el.innerHTML=`<svg class="kcs" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none" data-per="${per}" data-wx="${kind}"><defs>${defs}</defs>${sky}${clouds}${trees}${bld}${ghost}${ground}${life}${fx}</svg>
    ${o.next?`<div class="kh-city-next" style="left:${gx}px;width:${nextW}px;height:${nextH}px"><span class="ms">${o.next.icon}</span><span class="kh-num">${o.next.pct} %</span></div>`:''}
    ${wxChip(wx,kind,per)}`;
  el.dataset.per=per;
  if(!ro&&window.ResizeObserver){let last=W;ro=new ResizeObserver(()=>{const w=Math.round(el.clientWidth);if(Math.abs(w-last)>6){last=w;if(lastOpts)scene(lastOpts);}});ro.observe(el);}
}
function wxChip(wx,kind,per){
  const loc=getLoc(),night=per==='night';
  if(!loc)return `<button class="kh-city-wx add" type="button" onclick="event.stopPropagation();kcWeatherSetup()" title="Afficher la vraie météo de ta ville"><span class="ms">location_on</span>Météo de ma ville</button>`;
  if(!wx)return `<button class="kh-city-wx" type="button" onclick="event.stopPropagation();kcWeatherSetup()"><span class="ms">location_on</span>${esc(loc.name)}</button>`;
  return `<button class="kh-city-wx" type="button" onclick="event.stopPropagation();kcWeatherSetup()" title="${esc(WX_LBL[kind])} à ${esc(loc.name)} · changer de ville"><span class="ms">${wxIcon(kind,night)}</span><b>${Math.round(wx.t)}°</b><span class="kh-city-wx-n">${esc(loc.name)}</span></button>`;
}
window.kcCityScene=function(o){
  const base=Object.assign({},o);
  scene(Object.assign({},base,{wx:LS(CACHE,null)&&getLoc()&&LS(CACHE,null).lat===getLoc().lat?LS(CACHE,null):null}));
  if(getLoc())getWx(false).then(wx=>{if(wx)scene(Object.assign({},base,{wx}));});
};
/* le ciel bouge tout seul : on redessine toutes les 5 minutes si l'accueil est affiché */
setInterval(()=>{if(lastOpts&&document.body.dataset.screen==='home'&&!document.hidden)window.kcCityScene(lastOpts);},5*60e3);

/* ───────── Choisir sa ville (météo) ───────── */
window.kcWeatherSetup=function(){
  const loc=getLoc();
  let results=[],t=null;
  kcDlg({title:'Météo de ma ville',sub:'La carte « Ma ville » affichera le vrai temps et le vrai ciel de chez toi.',icon:'partly_cloudy_day',
    body:`<div class="kc-wx-cur">${loc?`<span class="ms">location_on</span><b>${esc(loc.name)}</b><small>${esc(loc.sub||'')}</small><button class="btn btn-g btn-sm" data-rm>Retirer</button>`:'<span class="ms">location_off</span><span>Aucune ville choisie</span>'}</div>
      <div class="kc-wx-search"><span class="ms">search</span><input id="kc-wx-in" type="search" autocomplete="off" placeholder="Tape le nom de ta ville (ex. Madrid, Lyon…)"></div>
      <div class="kc-wx-res" id="kc-wx-res"></div>
      <button class="btn btn-g kc-wx-geo" data-geo><span class="ms">my_location</span>Utiliser ma position actuelle</button>
      <p class="kc-wx-note"><span class="ms">lock</span>Seul le nom de la ville (ou une position arrondie) est envoyé à Open-Meteo, un service météo gratuit. Rien d’autre.</p>`,
    foot:'<button class="btn btn-g" data-x>Fermer</button>',
    onOpen(bg){
      const inp=bg.querySelector('#kc-wx-in'),box=bg.querySelector('#kc-wx-res');
      const draw=()=>{box.innerHTML=results.map((r,i)=>`<button class="kc-wx-opt" data-i="${i}"><span class="ms">location_city</span><span><b>${esc(r.name)}</b><small>${esc([r.admin1,r.country].filter(Boolean).join(', '))}</small></span></button>`).join('')||(inp.value.trim().length>1?'<p class="kc-wx-empty">Aucune ville trouvée</p>':'');};
      inp.addEventListener('input',()=>{clearTimeout(t);const q=inp.value.trim();if(q.length<2){results=[];draw();return;}
        t=setTimeout(async()=>{try{const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`);const j=await r.json();results=j.results||[];}catch(e){results=[];box.innerHTML='<p class="kc-wx-empty">Pas de connexion internet ?</p>';return;}draw();},280);});
      const save=l=>{SS(LOC,l);SS(CACHE,null);notify('Météo : '+l.name,'ok');const d=$('kc-dlg');if(d)d.remove();if(window.khRender)khRender();};
      bg.addEventListener('click',e=>{
        const o=e.target.closest('.kc-wx-opt');if(o){const r=results[+o.dataset.i];if(r)save({name:r.name,sub:[r.admin1,r.country].filter(Boolean).join(', '),lat:+r.latitude.toFixed(3),lon:+r.longitude.toFixed(3)});return;}
        if(e.target.closest('[data-rm]')){SS(LOC,null);SS(CACHE,null);notify('Ville retirée','ok');const d=$('kc-dlg');if(d)d.remove();if(window.khRender)khRender();return;}
        if(e.target.closest('[data-geo]')){
          if(!navigator.geolocation){notify('Ton navigateur ne donne pas la position','err');return;}
          navigator.geolocation.getCurrentPosition(p=>save({name:'Ma position',sub:'position actuelle (arrondie)',lat:+p.coords.latitude.toFixed(2),lon:+p.coords.longitude.toFixed(2)}),()=>notify('Position refusée : tape plutôt le nom de ta ville','err'),{timeout:10000,maximumAge:3600e3});
        }
      });
      setTimeout(()=>inp.focus(),60);
    }});
};
window.kcWxInfo=()=>({loc:getLoc(),cache:LS(CACHE,null)});
/* la scène n'existait pas encore au premier rendu de l'accueil */
setTimeout(()=>{if(window.khRender&&$('kh-city-scene')&&!$('kh-city-scene').firstChild)khRender();},0);
})();
