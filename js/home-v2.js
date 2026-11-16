/* =========================================================
   home-v2.js — accueil « Amplitude du jour »
   Fait tourner le goniomètre (objectif du jour : 0° → 180°),
   remplit la bande de la semaine, l'échelle de maîtrise et les
   mesures Réussite / Temps. Se branche sur renderHome() sans le modifier.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const DAYS=['L','M','M','J','V','S','D'];
const reduce=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);

function countTo(el,to,ms){
  if(!el)return;
  const from=+el.dataset.v||0;el.dataset.v=to;
  if(reduce()||from===to){el.textContent=to;return;}
  const t0=performance.now();
  (function step(t){const k=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-k,3);el.textContent=Math.round(from+(to-from)*e);if(k<1)requestAnimationFrame(step);})(t0);
}
function fmtTime(s){
  if(s>=3600)return `${Math.floor(s/3600)} h ${String(Math.floor(s%3600/60)).padStart(2,'0')}`;
  if(s>=60)return `${Math.floor(s/60)} min`;
  return s>0?`${s} s`:'–';
}
function update(){
  if(!$('kd-arm'))return;
  const dt=$('kd-date');
  if(dt)dt.textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});

  // Goniomètre : 0 % de l'objectif = 0°, objectif atteint = 180°
  const pct=Math.max(0,Math.min(100,parseInt(($('goal-pct')||{}).textContent,10)||0)),deg=Math.round(pct*1.8);
  $('kd-arm').style.setProperty('--kd-a',deg+'deg');
  const arc=$('goal-arc');if(arc)arc.style.opacity=pct>0?'1':'0';
  countTo($('kd-deg'),deg,1200);

  // Semaine en cours (lundi → dimanche)
  const wk=typeof getDailyWeek==='function'?getDailyWeek(0):[0,0,0,0,0,0,0];
  const today=(new Date().getDay()+6)%7,days=wk.filter(v=>v>0).length;
  const w=$('kd-week');
  if(w)w.innerHTML=wk.map((v,k)=>`<div class="kd-day${v>0?' on':''}${k===today?' today':''}" title="${v} question${v>1?'s':''}"><i></i><span>${DAYS[k]}</span></div>`).join('');
  const cap=$('dcs-meta');
  if(cap)cap.textContent=days?`${days} jour${days>1?'s':''} de révision cette semaine`:'Pas encore de révision cette semaine';

  // Maîtrise (même calcul que l'accueil : questions faciles ou acquises)
  let m=0;
  try{
    const all=questions.filter(q=>!isBoycotted(q.id));
    if(all.length)m=Math.round(all.filter(q=>{const d=getDiff(q.id);return d==='easy'||d==='acquired';}).length/all.length*100);
  }catch(e){}
  const eva=$('kd-eva');if(eva)requestAnimationFrame(()=>eva.style.setProperty('--kd-m',m+'%'));

  // Réussite globale et temps de révision du jour
  try{
    let att=0,err=0;Object.values(diffData).forEach(d=>{att+=d.attempts||0;err+=d.errors||0;});
    const a=$('kd-avg');if(a)a.textContent=att?Math.round((1-err/att)*100)+' %':'–';
    const s=stats.todayDate===new Date().toDateString()?(stats.todaySecs||0):0;
    const t=$('kd-time');if(t)t.textContent=fmtTime(s);
  }catch(e){}
}

const orig=window.renderHome;
if(typeof orig==='function'){
  window.renderHome=function(){const r=orig.apply(this,arguments);try{update();}catch(e){console.warn('[home-v2]',e);}return r;};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(update,60));
else setTimeout(update,60);
})();
