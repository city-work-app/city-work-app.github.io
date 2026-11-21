/* =========================================================
   kc-imgedit.js — v85 (21 nov. 2026) : ÉDITEUR DE PHOTO DES FLASHCARDS
   kcImgEdit(src, {edit, onSave(url, meta), actions:[{ic,label,run}]})
   Outils : Surligneur (trait droit par défaut, comme un vrai surligneur sur des mots ; mode « multiply » pour que le
   texte reste lisible), Zone surlignée (rectangle), Stylo, Cadre, Flèche, Texte, Cacher (rectangle opaque pour masquer
   une légende et s'interroger), Gomme (efface un élément), Annuler / Rétablir, Tout effacer.
   Photo : tourner ↺ ↻, recadrer, luminosité, contraste.
   Sauvegarde : image aplatie (JPEG) + meta {v:1, imageSrc (photo d'origine tournée / recadrée), bri, con, objs} gardée sur la
   carte (imageQEdit / imageAEdit) → on peut rouvrir et retirer un surlignage plus tard.
   Coordonnées des éléments : 0..1 de la largeur / hauteur ; épaisseurs : fraction du plus grand côté.
   ========================================================= */
(function(){
'use strict';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS=['#FFE600','#7CFC5A','#FF7AD9','#5EC8FF','#FFA53D','#EF4444','#111827','#FFFFFF'];
const TOOLS=[
  ['mark','ink_highlighter','Surligneur','Surligne des mots (trait droit ; Alt = main levée)'],
  ['rect','highlight_alt','Zone','Surligne une zone de la photo'],
  ['pen','draw','Stylo','Dessine à main levée'],
  ['box','crop_square','Cadre','Entoure une zone'],
  ['arrow','north_east','Flèche','Montre un détail'],
  ['text','title','Texte','Écris sur la photo'],
  ['hide','visibility_off','Cacher','Masque une légende pour t’interroger'],
  ['erase','ink_eraser','Gomme','Clique sur un élément pour l’effacer']
];
const SIZES={S:.006,M:.012,L:.022};
let ED=null;

function loadImg(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src;});}
function toCanvas(im,max){
  let w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;const k=Math.min(1,(max||1600)/Math.max(w,h));
  w=Math.round(w*k);h=Math.round(h*k);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);return c;
}
/* luminosité / contraste (ctx.filter si possible, sinon calcul pixel par pixel) */
function filtered(base,bri,con){
  if(bri===100&&con===100)return base;
  const c=document.createElement('canvas');c.width=base.width;c.height=base.height;const x=c.getContext('2d');
  if('filter' in x){x.filter=`brightness(${bri}%) contrast(${con}%)`;x.drawImage(base,0,0);if(x.filter!=='none')return c;}
  x.drawImage(base,0,0);
  const d=x.getImageData(0,0,c.width,c.height),p=d.data,b=bri/100,k=con/100;
  for(let i=0;i<p.length;i+=4)for(let j=0;j<3;j++){let v=p[i+j]*b;v=(v-128)*k+128;p[i+j]=v<0?0:v>255?255:v;}
  x.putImageData(d,0,0);return c;
}
function drawObj(x,o,W,H){
  const M=Math.max(W,H);
  x.save();
  if(o.t==='mark'||o.t==='rect'){x.globalCompositeOperation='multiply';x.globalAlpha=o.t==='mark'?.5:.38;}
  x.strokeStyle=x.fillStyle=o.c;x.lineCap='round';x.lineJoin='round';
  const lw=((o.p?o.w:o.sw)||.012)*M;
  if(o.t==='mark'||o.t==='pen'){
    x.lineWidth=o.t==='mark'?lw*2.6:lw;
    if(o.t==='mark')x.lineCap='butt';
    const P=o.p;if(!P||!P.length){x.restore();return;}
    x.beginPath();x.moveTo(P[0][0]*W,P[0][1]*H);
    if(P.length===1)x.lineTo(P[0][0]*W+.1,P[0][1]*H);
    for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i];x.quadraticCurveTo(a[0]*W,a[1]*H,(a[0]+b[0])/2*W,(a[1]+b[1])/2*H);}
    const L=P[P.length-1];x.lineTo(L[0]*W,L[1]*H);x.stroke();
  }else if(o.t==='rect'||o.t==='hide'){
    const r=norm(o);
    if(o.t==='hide'){x.globalAlpha=1;x.fillStyle=o.c;rr(x,r.x*W,r.y*H,r.w*W,r.h*H,M*.006);x.fill();
      x.strokeStyle='rgba(0,0,0,.25)';x.lineWidth=Math.max(1,M*.0015);x.stroke();
      const fs=Math.min(r.h*H*.6,M*.035);if(fs>8){x.fillStyle=lum(o.c)>.6?'rgba(0,0,0,.45)':'rgba(255,255,255,.8)';x.font=`700 ${fs}px Geist,system-ui,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText('?',(r.x+r.w/2)*W,(r.y+r.h/2)*H);}}
    else{x.fillRect(r.x*W,r.y*H,r.w*W,r.h*H);}
  }else if(o.t==='box'){const r=norm(o);x.lineWidth=lw;rr(x,r.x*W,r.y*H,r.w*W,r.h*H,M*.008);x.stroke();}
  else if(o.t==='arrow'){
    const x1=o.x*W,y1=o.y*H,x2=(o.x+o.w)*W,y2=(o.y+o.h)*H,a=Math.atan2(y2-y1,x2-x1),hl=Math.max(lw*3.2,M*.02);
    x.lineWidth=lw;x.beginPath();x.moveTo(x1,y1);x.lineTo(x2-Math.cos(a)*hl*.6,y2-Math.sin(a)*hl*.6);x.stroke();
    x.beginPath();x.moveTo(x2,y2);x.lineTo(x2-Math.cos(a-.45)*hl,y2-Math.sin(a-.45)*hl);x.lineTo(x2-Math.cos(a+.45)*hl,y2-Math.sin(a+.45)*hl);x.closePath();x.fill();
  }else if(o.t==='text'){
    const fs=(o.s||.04)*M;x.font=`700 ${fs}px Geist,system-ui,sans-serif`;x.textBaseline='top';
    const lines=String(o.txt||'').split('\n');
    x.lineWidth=Math.max(2,fs*.16);x.strokeStyle=lum(o.c)>.6?'rgba(0,0,0,.75)':'rgba(255,255,255,.9)';
    lines.forEach((l,i)=>{x.strokeText(l,o.x*W,o.y*H+i*fs*1.15);x.fillText(l,o.x*W,o.y*H+i*fs*1.15);});
  }
  x.restore();
}
function rr(x,a,b,w,h,r){r=Math.min(r,w/2,h/2);x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath();}
function lum(h){const n=parseInt(String(h).slice(1),16);return ((n>>16)*.299+((n>>8)&255)*.587+(n&255)*.114)/255;}
function norm(o){return {x:Math.min(o.x,o.x+o.w),y:Math.min(o.y,o.y+o.h),w:Math.abs(o.w),h:Math.abs(o.h)};}
function bbox(o){
  if(o.p){let a=1,b=1,c=0,d=0;o.p.forEach(([x,y])=>{a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);});return {x:a,y:b,w:c-a,h:d-b};}
  if(o.t==='text'){const n=String(o.txt||'').split('\n');return {x:o.x,y:o.y,w:Math.max(...n.map(l=>l.length))*(o.s||.04)*.55,h:n.length*(o.s||.04)*1.15};}
  return norm(o);
}
function hit(o,px,py,W,H){
  const M=Math.max(W,H),tol=Math.max(.012,((o.p?o.w:o.sw)||.012)*1.6)*M;
  if(o.p){for(const [x,y] of o.p)if(Math.hypot((x-px)*W,(y-py)*H)<tol*(o.t==='mark'?1.8:1))return true;
    for(let i=1;i<o.p.length;i++){const [ax,ay]=o.p[i-1],[bx,by]=o.p[i];if(segD(px*W,py*H,ax*W,ay*H,bx*W,by*H)<tol*(o.t==='mark'?1.8:1))return true;}return false;}
  if(o.t==='arrow')return segD(px*W,py*H,o.x*W,o.y*H,(o.x+o.w)*W,(o.y+o.h)*H)<tol;
  const b=bbox(o);
  if(o.t==='box')return px>=b.x-.01&&px<=b.x+b.w+.01&&py>=b.y-.01&&py<=b.y+b.h+.01&&!(px>b.x+.02&&px<b.x+b.w-.02&&py>b.y+.02&&py<b.y+b.h-.02);
  return px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h;
}
function segD(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
/* rotation de 90° (dir = 1 horaire, -1 anti-horaire) des éléments */
function rotObj(o,dir){
  const R=dir>0?([x,y])=>[1-y,x]:([x,y])=>[y,1-x];
  o=JSON.parse(JSON.stringify(o));
  if(o.p){o.p=o.p.map(R);return o;}
  if(o.t==='text'){const [x,y]=R([o.x,o.y]);o.x=Math.max(0,Math.min(.95,x));o.y=Math.max(0,Math.min(.95,y));return o;}
  const a=R([o.x,o.y]),b=R([o.x+o.w,o.y+o.h]);o.x=a[0];o.y=a[1];o.w=b[0]-a[0];o.h=b[1]-a[1];return o;
}
function cropObj(o,c,k){
  const F=([x,y])=>[(x-c.x)/c.w,(y-c.y)/c.h];
  o=JSON.parse(JSON.stringify(o));
  if(o.p){o.w=(o.w||.012)*k;o.p=o.p.map(F);return o;}
  if(o.t==='text'){const [x,y]=F([o.x,o.y]);o.x=x;o.y=y;o.s=(o.s||.04)*k;return o;}
  if(o.sw)o.sw*=k;
  const a=F([o.x,o.y]);o.x=a[0];o.y=a[1];o.w=o.w/c.w;o.h=o.h/c.h;return o;
}

window.kcImgEdit=async function(src,opt){
  opt=opt||{};
  if(ED)close(false);
  const meta=opt.edit&&(opt.edit.imageSrc||opt.edit.src)?opt.edit:null;   /* imageSrc : nom en « image… » pour que data.js range la photo à part (_imgPack) */
  let base;
  try{base=toCanvas(await loadImg(meta?(meta.imageSrc||meta.src):src),1600);}catch(e){if(typeof showNotif==='function')showNotif('Image illisible','err');return;}
  ED={base,bri:meta?meta.bri||100:100,con:meta?meta.con||100:100,objs:meta?JSON.parse(JSON.stringify(meta.objs||[])):[],redo:[],hist:[],edited:!!meta,
    tool:localStorage.getItem('kie_tool')||'mark',color:localStorage.getItem('kie_color')||COLORS[0],size:localStorage.getItem('kie_size')||'M',
    straight:localStorage.getItem('kie_straight')!=='0',opt,cur:null,crop:null,filt:null,dirty:false};
  if(ED.tool==='hide'&&ED.color===COLORS[0])ED.color='#FFFFFF';
  ED.filt=filtered(base,ED.bri,ED.con);
  const bg=document.createElement('div');bg.className='kie';bg.id='kie';bg.setAttribute('role','dialog');bg.setAttribute('aria-label','Modifier la photo');
  bg.innerHTML=`<div class="kie-top">
      <div class="kie-tools" role="toolbar" aria-label="Outils">${TOOLS.map(([k,ic,n,d])=>`<button type="button" data-tool="${k}" title="${esc(n+' — '+d)}"><span class="ms">${ic}</span><span class="kie-tl">${n}</span></button>`).join('')}</div>
      <div class="kie-opts">
        <div class="kie-cols">${COLORS.map(c=>`<button type="button" data-col="${c}" style="--c:${c}" aria-label="Couleur ${c}"></button>`).join('')}<label class="kie-colc" title="Autre couleur"><input type="color" value="${ED.color}"><span class="ms">palette</span></label></div>
        <div class="kie-sz">${Object.keys(SIZES).map(k=>`<button type="button" data-sz="${k}" title="Épaisseur ${k}"><i style="--s:${k==='S'?4:k==='M'?8:13}px"></i></button>`).join('')}</div>
        <button type="button" class="kie-st" data-a="straight" title="Surligneur en ligne droite (Alt pour dessiner à main levée)"><span class="ms">horizontal_rule</span>Trait droit</button>
      </div>
    </div>
    <div class="kie-stage"><div class="kie-wrap"><canvas class="kie-cv"></canvas><div class="kie-cropbox" hidden></div></div></div>
    <div class="kie-bot">
      <div class="kie-g"><button type="button" data-a="undo" title="Annuler (Ctrl+Z)"><span class="ms">undo</span></button><button type="button" data-a="redo" title="Rétablir (Ctrl+Maj+Z)"><span class="ms">redo</span></button><button type="button" data-a="clear" title="Effacer toutes les annotations"><span class="ms">layers_clear</span></button></div>
      <div class="kie-g"><button type="button" data-a="rotl" title="Tourner à gauche"><span class="ms">rotate_left</span></button><button type="button" data-a="rotr" title="Tourner à droite"><span class="ms">rotate_right</span></button><button type="button" data-a="crop" title="Recadrer"><span class="ms">crop</span><span class="kie-tl">Recadrer</span></button>
        <label class="kie-sl" title="Luminosité"><span class="ms">light_mode</span><input type="range" min="50" max="160" value="${ED.bri}" data-r="bri"></label>
        <label class="kie-sl" title="Contraste"><span class="ms">contrast</span><input type="range" min="50" max="180" value="${ED.con}" data-r="con"></label></div>
      <div class="kie-crop-g" hidden><span>Trace le cadre à garder</span><button type="button" class="btn btn-g btn-sm" data-a="cropno">Annuler</button><button type="button" class="btn btn-p btn-sm" data-a="cropok">Recadrer</button></div>
      <div class="kie-g kie-end">${(opt.actions||[]).map((a,i)=>`<button type="button" data-act="${i}" title="${esc(a.label)}"><span class="ms">${a.ic}</span><span class="kie-tl">${esc(a.label)}</span></button>`).join('')}
        <button type="button" class="btn btn-g" data-a="cancel">Annuler</button><button type="button" class="btn btn-p" data-a="save"><span class="ms" style="font-size:17px">check</span>Enregistrer</button></div>
    </div>
    <div class="kie-txt" hidden><textarea rows="2" placeholder="Ton texte…"></textarea><div><button type="button" class="btn btn-g btn-sm" data-a="txtno">Annuler</button><button type="button" class="btn btn-p btn-sm" data-a="txtok">Ajouter</button></div></div>`;
  document.body.appendChild(bg);ED.el=bg;ED.cv=bg.querySelector('.kie-cv');
  requestAnimationFrame(()=>bg.classList.add('open'));
  syncUI();layout();draw();
  bind();
};
function layout(){
  if(!ED)return;
  const st=ED.el.querySelector('.kie-stage'),W=st.clientWidth-24,H=st.clientHeight-24,b=ED.base;
  const k=Math.min(W/b.width,H/b.height,3);
  ED.cv.width=b.width;ED.cv.height=b.height;
  ED.cv.style.width=Math.round(b.width*k)+'px';ED.cv.style.height=Math.round(b.height*k)+'px';
}
function draw(extra){
  if(!ED)return;const x=ED.cv.getContext('2d'),W=ED.cv.width,H=ED.cv.height;
  x.clearRect(0,0,W,H);x.drawImage(ED.filt,0,0);
  ED.objs.forEach(o=>drawObj(x,o,W,H));
  if(ED.cur)drawObj(x,ED.cur,W,H);
  if(extra)extra(x,W,H);
}
function syncUI(){
  const e=ED.el;
  e.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===ED.tool));
  e.querySelectorAll('[data-col]').forEach(b=>b.classList.toggle('on',b.dataset.col.toLowerCase()===ED.color.toLowerCase()));
  e.querySelectorAll('[data-sz]').forEach(b=>b.classList.toggle('on',b.dataset.sz===ED.size));
  const st=e.querySelector('[data-a="straight"]');st.classList.toggle('on',ED.straight);st.hidden=ED.tool!=='mark';
  e.querySelector('.kie-sz').hidden=ED.tool==='erase'||ED.tool==='rect'||ED.tool==='hide';
  e.querySelector('.kie-cols').hidden=ED.tool==='erase';
  e.querySelector('[data-a="undo"]').disabled=!ED.hist.length;
  e.querySelector('[data-a="redo"]').disabled=!ED.redo.length;
  ED.cv.style.cursor=ED.tool==='erase'?'crosshair':ED.tool==='text'?'text':'crosshair';
}
function pos(ev){const r=ED.cv.getBoundingClientRect();return [Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height))];}
/* historique : un état complet avant chaque changement (les toiles ne sont jamais modifiées sur place) */
function state(){return {base:ED.base,objs:JSON.parse(JSON.stringify(ED.objs)),bri:ED.bri,con:ED.con};}
function snapshot(){ED.hist.push(state());if(ED.hist.length>40)ED.hist.shift();ED.redo=[];ED.dirty=true;}
function restore(st){const nb=st.base!==ED.base;ED.base=st.base;ED.objs=st.objs;ED.bri=st.bri;ED.con=st.con;ED.filt=filtered(ED.base,ED.bri,ED.con);
  ED.el.querySelectorAll('[data-r]').forEach(r=>r.value=ED[r.dataset.r]);if(nb)layout();draw();syncUI();}
function push(o){snapshot();ED.objs.push(o);syncUI();}
function bind(){
  const e=ED.el,cv=ED.cv;
  e.addEventListener('click',ev=>{
    const t=ev.target.closest('[data-tool],[data-col],[data-sz],[data-a],[data-act]');if(!t)return;
    if(t.dataset.tool){ED.tool=t.dataset.tool;localStorage.setItem('kie_tool',ED.tool);
      if(ED.tool==='hide'&&ED.color!=='#FFFFFF'&&ED.color!=='#111827')ED.color='#FFFFFF';
      else if((ED.tool==='mark'||ED.tool==='rect')&&(ED.color==='#FFFFFF'||ED.color==='#111827'))ED.color=COLORS[0];
      syncUI();if(ED.tool==='erase'&&!ED.objs.length&&typeof showNotif==='function')showNotif('Rien à effacer pour l’instant','ok');}
    else if(t.dataset.col){ED.color=t.dataset.col;localStorage.setItem('kie_color',ED.color);syncUI();}
    else if(t.dataset.sz){ED.size=t.dataset.sz;localStorage.setItem('kie_size',ED.size);syncUI();}
    else if(t.dataset.act!=null){const a=(ED.opt.actions||[])[+t.dataset.act];close(false);if(a)a.run();}
    else act(t.dataset.a);
  });
  e.querySelector('.kie-colc input').addEventListener('input',ev=>{ED.color=ev.target.value;syncUI();});
  e.querySelectorAll('[data-r]').forEach(r=>{r.addEventListener('pointerdown',()=>snapshot());r.addEventListener('keydown',()=>snapshot());
    r.addEventListener('input',()=>{ED[r.dataset.r]=+r.value;ED.filt=filtered(ED.base,ED.bri,ED.con);ED.dirty=true;draw();});});
  let down=null;
  cv.addEventListener('pointerdown',ev=>{
    if(ev.button>0)return;ev.preventDefault();try{cv.setPointerCapture(ev.pointerId);}catch(_){}
    const p=pos(ev),W=cv.width,H=cv.height;down={p,free:ev.altKey};
    if(ED.crop){ED.crop={x:p[0],y:p[1],w:0,h:0,on:true};cropBox();return;}
    if(ED.tool==='erase'){for(let i=ED.objs.length-1;i>=0;i--)if(hit(ED.objs[i],p[0],p[1],W,H)){snapshot();ED.objs.splice(i,1);syncUI();draw();break;}down=null;return;}
    if(ED.tool==='text'){down=null;askText(p);return;}
    const w=SIZES[ED.size]||SIZES.M;
    if(ED.tool==='mark'||ED.tool==='pen')ED.cur={t:ED.tool,c:ED.color,w,p:[p]};
    else ED.cur={t:ED.tool,c:ED.color,sw:w,x:p[0],y:p[1],w:0,h:0};
    draw();
  });
  cv.addEventListener('pointermove',ev=>{
    if(!down)return;const p=pos(ev);
    if(ED.crop&&ED.crop.on){ED.crop.w=p[0]-ED.crop.x;ED.crop.h=p[1]-ED.crop.y;cropBox();return;}
    const o=ED.cur;if(!o)return;
    if(o.p){
      if(o.t==='mark'&&ED.straight&&!down.free&&!ev.altKey){const s=o.p[0];let q=p;
        /* presque horizontal → parfaitement horizontal (lignes de texte) */
        if(Math.abs(p[1]-s[1])*ED.cv.height<Math.abs(p[0]-s[0])*ED.cv.width*.18)q=[p[0],s[1]];o.p=[s,q];}
      else{const L=o.p[o.p.length-1];if(Math.hypot((p[0]-L[0])*cv.width,(p[1]-L[1])*cv.height)>2)o.p.push(p);}
    }else{o.w=p[0]-o.x;o.h=p[1]-o.y;}
    draw();
  });
  const up=()=>{
    if(!down)return;down=null;
    if(ED.crop&&ED.crop.on){ED.crop.on=false;return;}
    const o=ED.cur;ED.cur=null;if(!o)return;
    if(!o.p&&Math.abs(o.w)<.008&&Math.abs(o.h)<.008){draw();return;}
    if(o.t!=='arrow'&&!o.p){const r=norm(o);o.x=r.x;o.y=r.y;o.w=r.w;o.h=r.h;}
    push(o);draw();
  };
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  ED.key=ev=>{
    if(!ED)return;
    if(ED.el.querySelector('.kie-txt:not([hidden])')&&ev.key!=='Escape')return;
    if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();if(ED.crop){act('cropno');return;}act('cancel');return;}
    if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();ev.stopPropagation();act(ev.shiftKey?'redo':'undo');return;}
    if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();ev.stopPropagation();act('save');return;}
    ev.stopPropagation();
  };
  document.addEventListener('keydown',ED.key,true);
  ED.rs=()=>{layout();draw();};addEventListener('resize',ED.rs);
}
function askText(p){
  const b=ED.el.querySelector('.kie-txt'),ta=b.querySelector('textarea');b.hidden=false;ta.value='';ta.focus();
  b.dataset.x=p[0];b.dataset.y=p[1];
}
function cropBox(){
  const bx=ED.el.querySelector('.kie-cropbox'),c=ED.crop;if(!c){bx.hidden=true;return;}
  const r=norm(c);bx.hidden=!(r.w>0&&r.h>0);
  bx.style.cssText=`left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%`;
}
function act(a){
  if(!ED)return;
  if(a==='straight'){ED.straight=!ED.straight;localStorage.setItem('kie_straight',ED.straight?'1':'0');syncUI();}
  else if(a==='undo'){if(!ED.hist.length)return;ED.redo.push(state());restore(ED.hist.pop());ED.dirty=true;}
  else if(a==='redo'){if(!ED.redo.length)return;ED.hist.push(state());restore(ED.redo.pop());ED.dirty=true;}
  else if(a==='clear'){if(!ED.objs.length)return;snapshot();ED.objs=[];syncUI();draw();}
  else if(a==='rotl'||a==='rotr'){
    snapshot();const d=a==='rotr'?1:-1,b=ED.base,c=document.createElement('canvas');c.width=b.height;c.height=b.width;
    const x=c.getContext('2d');x.translate(c.width/2,c.height/2);x.rotate(d*Math.PI/2);x.drawImage(b,-b.width/2,-b.height/2);
    ED.base=c;ED.objs=ED.objs.map(o=>rotObj(o,d));ED.filt=filtered(c,ED.bri,ED.con);ED.dirty=true;layout();draw();syncUI();}
  else if(a==='crop'){ED.crop={x:0,y:0,w:0,h:0,on:false};ED.el.classList.add('cropping');ED.el.querySelector('.kie-crop-g').hidden=false;cropBox();}
  else if(a==='cropno'){ED.crop=null;ED.el.classList.remove('cropping');ED.el.querySelector('.kie-crop-g').hidden=true;cropBox();}
  else if(a==='cropok'){
    const c=ED.crop&&norm(ED.crop);if(!c||c.w<.03||c.h<.03){if(typeof showNotif==='function')showNotif('Trace d’abord le cadre à garder','err');return;}
    snapshot();const b=ED.base,sx=Math.round(c.x*b.width),sy=Math.round(c.y*b.height),sw=Math.max(8,Math.round(c.w*b.width)),sh=Math.max(8,Math.round(c.h*b.height));
    const n=document.createElement('canvas');n.width=sw;n.height=sh;n.getContext('2d').drawImage(b,sx,sy,sw,sh,0,0,sw,sh);
    const k=Math.max(b.width,b.height)/Math.max(sw,sh);
    ED.objs=ED.objs.map(o=>cropObj(o,c,k)).filter(o=>{const bb=bbox(o);return bb.x+bb.w>0&&bb.y+bb.h>0&&bb.x<1&&bb.y<1;});
    ED.base=n;ED.filt=filtered(n,ED.bri,ED.con);ED.dirty=true;act('cropno');layout();draw();syncUI();}
  else if(a==='txtok'||a==='txtno'){
    const b=ED.el.querySelector('.kie-txt'),v=b.querySelector('textarea').value.trim();b.hidden=true;
    if(a==='txtok'&&v){push({t:'text',c:ED.color,s:ED.size==='S'?.03:ED.size==='L'?.06:.042,x:+b.dataset.x,y:+b.dataset.y,txt:v});draw();}}
  else if(a==='cancel'){
    if(ED.dirty&&typeof kcConfirm==='function'){kcConfirm('Quitter sans enregistrer les modifications ?',{icon:'edit_off'}).then(ok=>{if(ok)close(false);});return;}
    close(false);}
  else if(a==='save')close(true);
}
function close(save){
  if(!ED)return;const E=ED;ED=null;
  document.removeEventListener('keydown',E.key,true);removeEventListener('resize',E.rs);
  if(save&&E.opt.onSave){
    const c=document.createElement('canvas');c.width=E.base.width;c.height=E.base.height;const x=c.getContext('2d');
    x.drawImage(E.filt,0,0);E.objs.forEach(o=>drawObj(x,o,c.width,c.height));
    const url=c.toDataURL('image/jpeg',.86);
    const meta=E.objs.length||E.bri!==100||E.con!==100||E.hist.length||E.edited?{v:1,imageSrc:E.base.toDataURL('image/jpeg',.86),bri:E.bri,con:E.con,objs:E.objs}:null;
    try{E.opt.onSave(url,meta);}catch(err){console.warn('[kie]',err);}
    if(typeof showNotif==='function')showNotif('Photo enregistrée','ok');
  }
  E.el.classList.remove('open');setTimeout(()=>E.el.remove(),200);
}
})();
