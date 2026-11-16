/* =========================================================
   kc-stats.js — Tableau de bord des statistiques (v66, 16 nov. 2026)
   Remplit #ks2-root dans #screen-profil (l'ancien contenu est gardé caché dans .kst-legacy pour ui.js).
   Période : 7 j / 30 j / 3 mois / 1 an (kst_range). Sources : dailyCounts, sessionHistory, diffData,
   getDiff, folders, courses, questions, dailyGoal.
   Sections : chiffres clés (avec évolution), activité, maîtrise (anneau), réussite dans le temps,
   calendrier, par matière, questions à retravailler, records.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function G(n,d){try{const v=eval(n);return v===undefined?d:v;}catch(e){return d;}}
const nf=n=>Number(n||0).toLocaleString('fr-FR');
const dk=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),12).toISOString().slice(0,10);
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const MON=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const WDF=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const RANGES=[['7','7 j'],['30','30 j'],['90','3 mois'],['365','1 an']];
let range=(()=>{try{return localStorage.getItem('kst_range')||'30';}catch(e){return '30';}})();
if(!RANGES.some(r=>r[0]===range))range='30';

function fmtDur(s){s=Math.round(s||0);if(s<60)return s?'< 1 min':'0 min';const m=Math.round(s/60);if(m<60)return m+' min';const h=Math.floor(m/60),r=m%60;return h+' h'+(r?' '+String(r).padStart(2,'0'):'');}
function sessDate(s){return s.date||(s.ts?dk(new Date(s.ts)):'');}
function delta(cur,prev,unit){
  if(!prev&&!cur)return '<span class="ks2-delta">—</span>';
  if(!prev)return '<span class="ks2-delta up"><span class="ms">trending_up</span>nouveau</span>';
  const d=unit==='pt'?Math.round(cur-prev):Math.round((cur-prev)/prev*100);
  if(!d)return '<span class="ks2-delta">= stable</span>';
  return `<span class="ks2-delta ${d>0?'up':'down'}"><span class="ms">${d>0?'trending_up':'trending_down'}</span>${d>0?'+':''}${d}${unit==='pt'?' pt':' %'}</span>`;
}
function data(){
  const dc=G('dailyCounts',{})||{},sh=G('sessionHistory',[])||[],dd=G('diffData',{})||{};
  const qs=G('questions',[])||[],cs=G('courses',[])||[],fs=G('folders',[])||[];
  const goal=Math.max(1,G('dailyGoal',10)||10);
  const gd=typeof getDiff==='function'?getDiff:(id=>{const d=dd[id];if(!d||!d.attempts)return 'new';const r=d.errors/d.attempts;return r>=.5?'hard':r>=.2?'medium':'easy';});
  const boy=id=>typeof isBoycotted==='function'&&isBoycotted(id);
  return {dc,sh,dd,qs,cs,fs,goal,gd,boy};
}
function periodStats(D,days,offset){
  const today=new Date(),end=addD(today,-offset*days),keys=[];
  for(let i=days-1;i>=0;i--)keys.push(dk(addD(end,-i)));
  const set=new Set(keys),qn=keys.reduce((a,k)=>a+(D.dc[k]||0),0),active=keys.filter(k=>(D.dc[k]||0)>0).length;
  let tot=0,cor=0,secs=0,sess=0;
  D.sh.forEach(s=>{const d=sessDate(s);if(!set.has(d))return;sess++;secs+=(s.duration||s.secs||0);if(s.type!=='flashcards'){tot+=s.total||0;cor+=s.correct||0;}});
  return {keys,qn,active,rate:tot?cor/tot*100:null,secs,sess,goalDays:keys.filter(k=>(D.dc[k]||0)>=D.goal).length};
}
function streaks(D){
  const has=k=>(D.dc[k]||0)>0;let cur=0,d=new Date();
  if(!has(dk(d)))d=addD(d,-1);
  while(has(dk(d))&&cur<3650){cur++;d=addD(d,-1);}
  const ks=Object.keys(D.dc).filter(k=>D.dc[k]>0).sort();let best=0,run=0,prev=null;
  ks.forEach(k=>{const t=Date.parse(k+'T12:00:00Z');run=prev!=null&&Math.round((t-prev)/864e5)===1?run+1:1;best=Math.max(best,run);prev=t;});
  return {cur,best:Math.max(best,cur)};
}

/* ── Graphiques (SVG) ── */
function barChart(D,days){
  const today=new Date(),weekly=days>90;
  let pts=[];
  if(!weekly){for(let i=days-1;i>=0;i--){const d=addD(today,-i),k=dk(d);pts.push({v:D.dc[k]||0,lbl:d.getDate()+' '+MON[d.getMonth()],k,today:i===0,first:d.getDate()===1});}}
  else{const n=Math.ceil(days/7);for(let w=n-1;w>=0;w--){let v=0;const e=addD(today,-w*7);for(let i=0;i<7;i++)v+=D.dc[dk(addD(e,-i))]||0;const s=addD(e,-6);pts.push({v,lbl:'sem. du '+s.getDate()+' '+MON[s.getMonth()],today:w===0});}}
  const goal=weekly?D.goal*7:D.goal,mx=Math.max(goal*1.15,...pts.map(p=>p.v),1);
  const W=720,H=200,pl=34,pr=8,pt=12,pb=24,iw=W-pl-pr,ih=H-pt-pb,n=pts.length,bw=iw/n,gap=Math.min(6,bw*.28);
  const y=v=>pt+ih-v/mx*ih;
  let g='';
  [0,.5,1].forEach(f=>{const v=Math.round(mx*f),yy=y(v);g+=`<line x1="${pl}" x2="${W-pr}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="ks2-grid"/><text x="${pl-6}" y="${(yy+3.5).toFixed(1)}" class="ks2-ax" text-anchor="end">${nf(v)}</text>`;});
  pts.forEach((p,i)=>{
    const x=pl+i*bw+gap/2,w=Math.max(1,bw-gap),h=Math.max(p.v?3:1.5,p.v/mx*ih),yy=pt+ih-h;
    g+=`<g class="ks2-bar${p.v>=goal?' ok':''}${p.today?' now':''}${p.v?'':' zero'}" style="--i:${i}"><rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4,w/2).toFixed(1)}"/><rect class="ks2-hit" x="${(pl+i*bw).toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${ih}"/><title>${esc(p.lbl)} : ${nf(p.v)} question${p.v>1?'s':''}</title></g>`;
    const every=n<=8?1:n<=31?(n<=14?2:5):Math.ceil(n/8);
    if(i%every===0||i===n-1&&n<=8)g+=`<text x="${(x+w/2).toFixed(1)}" y="${H-6}" class="ks2-ax" text-anchor="middle">${esc(weekly?p.lbl.replace('sem. du ',''):n<=8?['D','L','M','M','J','V','S'][addD(today,-(n-1-i)).getDay()]:p.lbl.split(' ')[0])}</text>`;
  });
  const gy=y(goal);
  g+=`<line x1="${pl}" x2="${W-pr}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" class="ks2-goal"/><text x="${W-pr}" y="${(gy-5).toFixed(1)}" class="ks2-ax ks2-goal-t" text-anchor="end">objectif ${nf(goal)}${weekly?' / sem.':''}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="ks2-svg" preserveAspectRatio="none" role="img" aria-label="Questions par ${weekly?'semaine':'jour'}">${g}</svg>`;
}
function donut(parts,total){
  const R=54,C=2*Math.PI*R;let off=0,g='';
  parts.forEach(p=>{if(!p.n)return;const l=p.n/total*C;g+=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${p.c}" stroke-width="16" stroke-dasharray="${l.toFixed(2)} ${(C-l).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" class="ks2-arc"><title>${esc(p.l)} : ${nf(p.n)}</title></circle>`;off+=l;});
  return `<svg viewBox="0 0 140 140" class="ks2-donut"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--kc-surface-2)" stroke-width="16"/><g transform="rotate(-90 70 70)">${g}</g></svg>`;
}
function lineChart(D,days){
  const today=new Date(),start=dk(addD(today,-(days-1))),by={};
  D.sh.forEach(s=>{if(s.type==='flashcards')return;const d=sessDate(s);if(!d||d<start)return;const o=by[d]||(by[d]={t:0,c:0});o.t+=s.total||0;o.c+=s.correct||0;});
  const ks=Object.keys(by).sort().filter(k=>by[k].t>0);
  if(ks.length<2)return '<div class="ks2-empty"><span class="ms">show_chart</span>Fais au moins deux jours de QCM sur la période pour voir ta courbe.</div>';
  const pts=ks.map(k=>({k,v:by[k].c/by[k].t*100,n:by[k].t}));
  const sm=pts.map((p,i)=>{const a=pts.slice(Math.max(0,i-1),i+2);return a.reduce((s,x)=>s+x.v*x.n,0)/a.reduce((s,x)=>s+x.n,0);});
  const W=720,H=180,pl=34,pr=10,pt=12,pb=22,iw=W-pl-pr,ih=H-pt-pb;
  const t0=Date.parse(start+'T12:00:00Z'),t1=Date.parse(dk(today)+'T12:00:00Z');
  const X=k=>pl+((Date.parse(k+'T12:00:00Z')-t0)/Math.max(1,t1-t0))*iw,Y=v=>pt+ih-v/100*ih;
  let g='';
  [0,50,100].forEach(v=>{g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" class="ks2-grid"/><text x="${pl-6}" y="${Y(v)+3.5}" class="ks2-ax" text-anchor="end">${v}%</text>`;});
  const path=pts.map((p,i)=>`${i?'L':'M'}${X(p.k).toFixed(1)} ${Y(sm[i]).toFixed(1)}`).join(' ');
  g+=`<path d="${path} L${X(pts[pts.length-1].k).toFixed(1)} ${pt+ih} L${X(pts[0].k).toFixed(1)} ${pt+ih} Z" class="ks2-area"/><path d="${path}" class="ks2-line"/>`;
  pts.forEach(p=>{g+=`<circle cx="${X(p.k).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3" class="ks2-dot"><title>${p.k.split('-').reverse().slice(0,2).join('/')} : ${Math.round(p.v)} % (${p.n} questions)</title></circle>`;});
  const fd=new Date(start+'T12:00:00');g+=`<text x="${pl}" y="${H-5}" class="ks2-ax">${fd.getDate()} ${MON[fd.getMonth()]}</text><text x="${W-pr}" y="${H-5}" class="ks2-ax" text-anchor="end">aujourd’hui</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="ks2-svg" preserveAspectRatio="none">${g}</svg>`;
}
function heat(D){
  const today=new Date(),weeks=20,dow=(today.getDay()+6)%7,start=addD(today,-(weeks-1)*7-dow);
  const lv=v=>!v?0:v<=10?1:v<=25?2:v<=50?3:4;let cells='',months='',lastM=-1;
  for(let w=0;w<weeks;w++){
    const d0=addD(start,w*7);
    if(d0.getMonth()!==lastM){months+=`<span style="grid-column:${w+1}">${MON[d0.getMonth()]}</span>`;lastM=d0.getMonth();}
    for(let i=0;i<7;i++){const d=addD(start,w*7+i);if(d>today){cells+='<i class="f"></i>';continue;}const v=D.dc[dk(d)]||0;cells+=`<i class="l${lv(v)}" title="${d.getDate()} ${MON[d.getMonth()]} : ${v} question${v>1?'s':''}"></i>`;}
  }
  return `<div class="ks2-heat"><div class="ks2-heat-m" style="grid-template-columns:repeat(${weeks},1fr)">${months}</div><div class="ks2-heat-g" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div>
    <div class="ks2-heat-k"><span>Moins</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>Plus</span></div></div>`;
}

/* ── Rendu ── */
function render(){
  const root=$('ks2-root');if(!root)return;
  const D=data(),days=+range,P=periodStats(D,days,0),Q=periodStats(D,days,1),S=streaks(D);
  const allQ=D.qs.filter(q=>!D.boy(q.id));
  const cnt={acquired:0,easy:0,medium:0,hard:0,new:0};allQ.forEach(q=>{const d=D.gd(q.id);cnt[d in cnt?d:'new']++;});
  const tot=allQ.length||1,mastPct=Math.round((cnt.acquired+cnt.easy)/tot*100);
  const parts=[{k:'acquired',l:'Acquises',n:cnt.acquired,c:'var(--kc-primary)'},{k:'easy',l:'Faciles',n:cnt.easy,c:'var(--kc-green,#12A35E)'},{k:'medium',l:'Moyennes',n:cnt.medium,c:'var(--kc-amber,#E8930C)'},{k:'hard',l:'Difficiles',n:cnt.hard,c:'var(--kc-rose,#E5394F)'},{k:'new',l:'Jamais vues',n:cnt.new,c:'color-mix(in srgb,var(--kc-ink-2) 35%,transparent)'}];
  /* par matière */
  const subj=D.fs.filter(f=>f.type!=='annales'&&!(typeof isFolderArchived==='function'&&isFolderArchived(f.id))).map(f=>{
    const cids=new Set(D.cs.filter(c=>c.folderId===f.id).map(c=>c.id)),fq=allQ.filter(q=>cids.has(q.courseId));
    let at=0,er=0,seen=0,m=0,h=0;fq.forEach(q=>{const d=D.dd[q.id];if(d&&d.attempts){at+=d.attempts;er+=d.errors||0;seen++;}const g=D.gd(q.id);if(g==='acquired'||g==='easy')m++;if(g==='hard')h++;});
    return {f,n:fq.length,seen,rate:at?Math.round((1-er/at)*100):null,mast:fq.length?Math.round(m/fq.length*100):0,hard:h};
  }).filter(x=>x.n>0);
  /* à retravailler */
  const weak=allQ.map(q=>{const d=D.dd[q.id];return d&&d.attempts>=2?{q,r:(d.errors||0)/d.attempts,a:d.attempts}:null;}).filter(x=>x&&x.r>0).sort((a,b)=>b.r-a.r||b.a-a.a).slice(0,8);
  window._ks2Weak=weak.map(x=>x.q);
  /* records */
  const dks=Object.keys(D.dc).filter(k=>D.dc[k]>0);
  const bestDay=dks.reduce((b,k)=>!b||D.dc[k]>D.dc[b]?k:b,null);
  const allTime=dks.reduce((a,k)=>a+D.dc[k],0);
  const wd=[0,0,0,0,0,0,0],wn=[0,0,0,0,0,0,0];dks.forEach(k=>{const d=new Date(k+'T12:00:00').getDay();wd[d]+=D.dc[k];wn[d]++;});
  const fav=wd.map((v,i)=>[i,wn[i]?v/wn[i]:0]).sort((a,b)=>b[1]-a[1])[0];
  const fmtK=k=>{const d=new Date(k+'T12:00:00');return d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();};
  const totalSess=D.sh.length,totalSecs=D.sh.reduce((a,s)=>a+(s.duration||s.secs||0),0);
  const per=RANGES.find(r=>r[0]===range)[1];

  root.innerHTML=`
  <header class="ks2-head">
    <div><p class="ks2-kick">Mon espace</p><h1>Statistiques</h1><p class="ks2-sub">${P.active} jour${P.active>1?'s':''} actif${P.active>1?'s':''} sur les ${days} derniers jours</p></div>
    <div class="ks2-head-r">
      <div class="ks2-seg" role="tablist" aria-label="Période">${RANGES.map(([v,l])=>`<button class="${v===range?'on':''}" data-ks2="range" data-v="${v}">${l}</button>`).join('')}</div>
      <button class="btn btn-g ks2-back" onclick="showScreen('profil-hub')"><span class="ms">arrow_back</span>Retour</button>
    </div>
  </header>

  <section class="ks2-kpis">
    <div class="ks2-kpi ks2-fire"><div class="ks2-kpi-h"><span class="ms">local_fire_department</span>Série</div><div class="ks2-kpi-v">${S.cur}<small> jour${S.cur>1?'s':''}</small></div><div class="ks2-kpi-f">Record : ${S.best} jour${S.best>1?'s':''}${S.cur&&S.cur>=S.best?' · c’est ton record !':''}</div></div>
    <div class="ks2-kpi"><div class="ks2-kpi-h"><span class="ms">quiz</span>Questions</div><div class="ks2-kpi-v">${nf(P.qn)}</div><div class="ks2-kpi-f">${delta(P.qn,Q.qn)} <span>vs ${per} d’avant</span></div></div>
    <div class="ks2-kpi"><div class="ks2-kpi-h"><span class="ms">check_circle</span>Réussite</div><div class="ks2-kpi-v">${P.rate==null?'—':Math.round(P.rate)+'<small> %</small>'}</div><div class="ks2-kpi-f">${P.rate==null?'<span>aucun QCM sur la période</span>':delta(P.rate,Q.rate||0,'pt')+' <span>vs avant</span>'}</div></div>
    <div class="ks2-kpi"><div class="ks2-kpi-h"><span class="ms">schedule</span>Temps de révision</div><div class="ks2-kpi-v">${fmtDur(P.secs)}</div><div class="ks2-kpi-f">${P.sess} session${P.sess>1?'s':''} · ${P.goalDays} objectif${P.goalDays>1?'s':''} atteint${P.goalDays>1?'s':''}</div></div>
  </section>

  <section class="ks2-row">
    <div class="ks2-card ks2-wide"><div class="ks2-card-h"><div><h2>Activité</h2><p>Questions faites par ${days>90?'semaine':'jour'} · la ligne pointillée = ton objectif</p></div><a class="ks2-link" onclick="kcGoalDialog&&kcGoalDialog()">Objectif : ${nf(D.goal)} / jour</a></div>${barChart(D,days)}</div>
    <div class="ks2-card"><div class="ks2-card-h"><div><h2>Maîtrise</h2><p>${nf(allQ.length)} questions dans tes cours</p></div></div>
      <div class="ks2-mast">${donut(parts,tot)}<div class="ks2-mast-c"><b>${mastPct}%</b><span>maîtrisé</span></div></div>
      <ul class="ks2-legend">${parts.map(p=>`<li><i style="background:${p.c}"></i>${p.l}<b>${nf(p.n)}</b></li>`).join('')}</ul></div>
  </section>

  <section class="ks2-row">
    <div class="ks2-card ks2-wide"><div class="ks2-card-h"><div><h2>Réussite au fil du temps</h2><p>Taux de bonnes réponses par jour de QCM (courbe lissée)</p></div></div>${lineChart(D,days)}</div>
    <div class="ks2-card"><div class="ks2-card-h"><div><h2>Calendrier</h2><p>20 dernières semaines</p></div></div>${heat(D)}</div>
  </section>

  <section class="ks2-card">
    <div class="ks2-card-h"><div><h2>Par matière</h2><p>Clique sur une matière pour l’ouvrir</p></div><button class="btn btn-g ks2-sm" onclick="showScreen('heatmap')"><span class="ms">map</span>Carte de maîtrise</button></div>
    ${subj.length?`<div class="ks2-subj"><div class="ks2-subj-h"><span>Matière</span><span>Questions</span><span>Réussite</span><span>Maîtrise</span><span></span></div>
      ${subj.map(x=>`<div class="ks2-subj-r" data-ks2="open" data-v="${esc(x.f.id)}" role="button" tabindex="0">
        <span class="ks2-subj-n"><i style="background:${esc(x.f.color||'var(--kc-primary)')}"></i>${esc(x.f.name)}</span>
        <span class="ks2-num">${nf(x.n)}<small>${x.seen<x.n?' · '+nf(x.n-x.seen)+' jamais vues':''}</small></span>
        <span class="ks2-num ${x.rate==null?'':x.rate>=75?'good':x.rate>=50?'mid':'bad'}">${x.rate==null?'—':x.rate+' %'}</span>
        <span class="ks2-mbar"><i style="width:${x.mast}%"></i><b>${x.mast} %</b></span>
        <span>${x.hard?`<button class="ks2-pill" data-ks2="hard" data-v="${esc(x.f.id)}" title="Réviser les questions difficiles"><span class="ms">bolt</span>${x.hard} difficile${x.hard>1?'s':''}</button>`:'<span class="ks2-ok"><span class="ms">verified</span></span>'}</span>
      </div>`).join('')}</div>`:'<div class="ks2-empty"><span class="ms">folder_open</span>Ajoute des matières et des QCM pour voir ta progression par matière.</div>'}
  </section>

  <section class="ks2-row ks2-row-b">
    <div class="ks2-card ks2-wide"><div class="ks2-card-h"><div><h2>À retravailler</h2><p>Les questions où tu te trompes le plus</p></div>${weak.length?`<button class="btn btn-p ks2-sm" data-ks2="weak"><span class="ms">play_arrow</span>Réviser ces ${weak.length}</button>`:''}</div>
      ${weak.length?`<ol class="ks2-weak">${weak.map(x=>{const c=D.cs.find(y=>y.id===x.q.courseId),f=c&&D.fs.find(y=>y.id===c.folderId),ok=Math.round((1-x.r)*100);return `<li><div><b>${esc(String(x.q.question||'').slice(0,110))}${String(x.q.question||'').length>110?'…':''}</b><small>${esc([f&&f.name,c&&c.name].filter(Boolean).join(' › '))} · ${x.a} essais</small></div><span class="ks2-rate ${ok>=50?'mid':'bad'}">${ok} %</span></li>`;}).join('')}</ol>`:'<div class="ks2-empty"><span class="ms">sentiment_satisfied</span>Rien à signaler : aucune question ratée plusieurs fois.</div>'}</div>
    <div class="ks2-card"><div class="ks2-card-h"><div><h2>Records</h2><p>Depuis le début</p></div></div>
      <div class="ks2-recs">
        <div><span class="ms">emoji_events</span><b>${bestDay?nf(D.dc[bestDay]):'—'}</b><small>meilleur jour${bestDay?' · '+fmtK(bestDay):''}</small></div>
        <div><span class="ms">local_fire_department</span><b>${S.best} j</b><small>plus longue série</small></div>
        <div><span class="ms">calendar_today</span><b>${fav&&fav[1]?WDF[fav[0]]:'—'}</b><small>ton jour le plus productif</small></div>
        <div><span class="ms">functions</span><b>${nf(allTime)}</b><small>questions en tout</small></div>
        <div><span class="ms">timer</span><b>${fmtDur(totalSecs)}</b><small>${nf(totalSess)} sessions</small></div>
        <div><span class="ms">speed</span><b>${dks.length?nf(Math.round(allTime/dks.length)):'—'}</b><small>questions par jour actif</small></div>
      </div></div>
  </section>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-ks2]');if(!b||!b.closest('#ks2-root'))return;
  const a=b.dataset.ks2,v=b.dataset.v;
  if(a==='range'){range=v;try{localStorage.setItem('kst_range',v);}catch(_){}render();return;}
  if(a==='hard'){e.stopPropagation();const D=data(),cids=new Set(D.cs.filter(c=>c.folderId===v).map(c=>c.id)),qs=D.qs.filter(q=>cids.has(q.courseId)&&!D.boy(q.id)&&D.gd(q.id)==='hard');if(qs.length&&typeof launchS==='function'){try{rBack='profil';}catch(_){}launchS(typeof shuffle==='function'?shuffle(qs):qs,'Questions difficiles',false,false,true,false,false);}return;}
  if(a==='open'){if(typeof openFolder==='function')openFolder(v);return;}
  if(a==='weak'){const qs=window._ks2Weak||[];if(qs.length&&typeof launchS==='function'){try{rBack='profil';}catch(_){}launchS(qs.slice(),'À retravailler',false,false,true,false,false);}}
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#ks2-root .ks2-subj-r')){e.preventDefault();e.target.click();}});
const prev=window.renderProfil;
if(typeof prev==='function'){window.renderProfil=function(){let r;try{r=prev.apply(this,arguments);}catch(e){console.warn('[stats] ancien rendu',e);}try{render();}catch(e){console.warn('[stats]',e);}return r;};}
window.kcStatsRender=render;
})();
