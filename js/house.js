/* =========================================================
   house.js — Maison 3D (Three.js), chargée à la demande par gamification.js.
   Script classique (pas un module ES) pour marcher aussi quand index.html
   est ouvert directement depuis le disque (file://) : Three.js est importé
   depuis le CDN. Aucune donnée n'est stockée ici : la liste des meubles et
   le personnage arrivent via mount()/update().
   ========================================================= */
'use strict';
window.KineHouseReady=window.KineHouseReady||(async function(){
const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm');
const {OrbitControls}=await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm');

const FLOOR_Y=0.12;           // dessus des dalles
const WALL_H=2.4, WALL_LOW=0.22, WALL_IN=0.55, WALL_T=0.1;
const PLOT={x0:-3,z0:-4,x1:27,z1:21};
const CENTER=new THREE.Vector3(11.5,0,8.5);

let R=null;     // moteur (créé une seule fois, réutilisé entre deux visites de l'écran)
let O=null;     // options courantes

// =========================================================
// Utilitaires géométrie / matériaux
// =========================================================
const _geo=new Map(),_mat=new Map(),_cachedGeo=new Set(),_cachedMat=new Set();
function cg(k,f){let g=_geo.get(k);if(!g){g=f();_geo.set(k,g);_cachedGeo.add(g);}return g;}
function gBox(w,h,d){return cg('b'+w+'|'+h+'|'+d,()=>new THREE.BoxGeometry(w,h,d));}
function gCyl(rt,rb,h,s){return cg('c'+rt+'|'+rb+'|'+h+'|'+s,()=>new THREE.CylinderGeometry(rt,rb,h,s||16));}
function gSph(r,s){return cg('s'+r+'|'+s,()=>new THREE.SphereGeometry(r,s||16,Math.max(8,(s||16)*.75|0)));}
function gIco(r,dt){return cg('i'+r+'|'+dt,()=>new THREE.IcosahedronGeometry(r,dt||0));}
function gCone(r,h,s){return cg('k'+r+'|'+h+'|'+s,()=>new THREE.ConeGeometry(r,h,s||12));}
function gTor(r,t,arc){return cg('t'+r+'|'+t+'|'+(arc||0),()=>new THREE.TorusGeometry(r,t,10,28,arc||Math.PI*2));}
function mat(color,o){
  o=o||{};const k=color+JSON.stringify(o);let m=_mat.get(k);
  if(!m){m=new THREE.MeshStandardMaterial(Object.assign({color,roughness:.82,metalness:0},o));_mat.set(k,m);_cachedMat.add(m);}
  return m;
}
function glow(color,i){return mat(color,{emissive:color,emissiveIntensity:i==null?.6:i});}
function add(g,geo,m,x,y,z){const me=new THREE.Mesh(geo,m);me.position.set(x||0,y||0,z||0);me.castShadow=true;me.receiveShadow=true;g.add(me);return me;}
// Boîte posée au sol : y = bas de la boîte
function B(g,w,h,d,c,x,y,z){return add(g,gBox(w,h,d),typeof c==='string'?mat(c):c,x,(y||0)+h/2,z);}
function C(g,rt,rb,h,c,x,y,z,s){return add(g,gCyl(rt,rb,h,s),typeof c==='string'?mat(c):c,x,(y||0)+h/2,z);}
function S(g,r,c,x,y,z,sx,sy,sz,seg){const m=add(g,gSph(r,seg),typeof c==='string'?mat(c):c,x,y,z);if(sx)m.scale.set(sx,sy==null?sx:sy,sz==null?sx:sz);return m;}
function rnd(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// Textures de sol dessinées sur canvas
const _tex=new Map();
function floorTex(kind){
  if(_tex.has(kind))return _tex.get(kind);
  const cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d');
  const r=rnd(kind.length*97);
  const planks=(base,lines,var_)=>{
    x.fillStyle=base;x.fillRect(0,0,256,256);
    for(let i=0;i<8;i++){
      const off=(i%2)*128+r()*40;
      for(let j=-1;j<3;j++){
        x.fillStyle=`rgba(${r()<.5?'255,255,255':'0,0,0'},${r()*var_})`;
        x.fillRect(off+j*128,i*32,128,32);
        x.fillStyle=lines;x.fillRect(off+j*128,i*32,2,32);
      }
      x.fillStyle=lines;x.fillRect(0,i*32,256,2);
    }
  };
  const tiles=(a,b,n,grout)=>{
    const s=256/n;
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){x.fillStyle=(i+j)%2?a:b;x.fillRect(i*s,j*s,s,s);}
    if(grout){x.strokeStyle=grout;x.lineWidth=2;for(let i=0;i<=n;i++){x.beginPath();x.moveTo(i*s,0);x.lineTo(i*s,256);x.stroke();x.beginPath();x.moveTo(0,i*s);x.lineTo(256,i*s);x.stroke();}}
  };
  const speck=(base,cols,n,sz)=>{x.fillStyle=base;x.fillRect(0,0,256,256);for(let i=0;i<n;i++){x.fillStyle=cols[r()*cols.length|0];x.fillRect(r()*256,r()*256,sz,sz);}};
  switch(kind){
    case 'chambre':planks('#d9a066','rgba(110,65,30,.45)',.12);break;
    case 'salon':planks('#e3bf8a','rgba(120,80,40,.35)',.10);break;
    case 'bureau':planks('#a8714a','rgba(60,30,15,.5)',.12);break;
    case 'terrasse':planks('#b98252','rgba(70,40,20,.55)',.14);break;
    case 'cuisine':tiles('#f4f1ea','#9fb4c7',4,'rgba(0,0,0,.08)');break;
    case 'sdb':tiles('#ffffff','#cfe8f3',8,'rgba(70,120,150,.25)');break;
    case 'sport':speck('#71849a',['#5f7287','#8195ab','#e9edf1'],500,2);break;
    case 'cabinet':tiles('#d8efe6','#cbe7dc',2,'rgba(0,80,60,.12)');break;
    case 'jardin':speck('#78c45f',['#6cb553','#86d06c','#5fa848','#f7f3a1','#ffffff'],900,3);break;
    case 'piscine':tiles('#efe4cf','#e6d8bd',4,'rgba(120,100,70,.25)');break;
    default:speck('#cfcac2',['#c4bfb6','#d8d3cb'],400,3);
  }
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;
  _tex.set(kind,t);return t;
}

// =========================================================
// Meubles — chaque fonction renvoie un Group centré, base à y=0, façade vers +z
// =========================================================
const WOOD='#a8794f',WOOD_D='#7a5235',WOOD_L='#d7b38a',WHITE='#f4f4f2',METAL='#9aa5ad',DARK='#2f3437';
function legs(g,w,d,h,c,t){t=t||.06;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>B(g,t,h,t,c,a*(w/2-t),0,b*(d/2-t)));}
function books(g,x0,x1,y,z,depth){
  const cols=['#e63946','#457b9d','#f4a261','#2a9d8f','#e9c46a','#8e7dbe','#264653'];let xx=x0,i=0;
  while(xx<x1-.06){const w=.05+((i*37)%5)*.012,h=.22+((i*53)%4)*.03;B(g,w,h,depth,cols[i%cols.length],xx+w/2,y,z);xx+=w+.008;i++;}
}
const BUILD={
  lit(g){B(g,1.8,.3,2.8,WOOD_D,0,0,0);B(g,1.7,.22,2.6,WHITE,0,.3,.05);B(g,1.74,.09,1.65,'#5b8def',0,.48,.5);B(g,1.74,.1,.12,'#4a76c9',0,.47,-.32);
    B(g,1.25,.15,.45,'#ffffff',0,.52,-.95);B(g,1.86,1.05,.12,WOOD_D,0,0,-1.37);B(g,1.86,.1,.16,WOOD,0,1.05,-1.37);},
  chevet(g){B(g,.6,.55,.5,WOOD,0,0,0);B(g,.5,.02,.01,WOOD_D,0,.32,.255);S(g,.025,'#c9a227',0,.42,.26);
    C(g,.05,.07,.04,DARK,0,.55,0);C(g,.015,.015,.22,DARK,0,.59,0);C(g,.1,.16,.18,glow('#ffe7a8',.5),0,.8,0);},
  plante(g){C(g,.21,.16,.36,'#c8643b',0,0,0);C(g,.19,.19,.02,'#4a3324',0,.34,0);
    [[0,.72,0,.26],[.13,.6,.06,.19],[-.12,.62,-.05,.2],[.02,.88,.04,.17]].forEach(([x,y,z,r])=>add(g,gIco(r,1),mat('#4caf50',{flatShading:true}),x,y,z));},
  tapis_rond(g){C(g,.92,.92,.02,'#e9a8a0',0,0,0,40);C(g,.66,.66,.026,'#f6d6c9',0,0,0,40);C(g,.36,.36,.03,'#e9a8a0',0,0,0,32);},
  armoire(g){B(g,1.8,2.05,.6,'#c49a6c',0,0,0);B(g,.02,1.85,.01,WOOD_D,0,.1,.305);B(g,1.86,.08,.64,WOOD_D,0,2.05,0);
    C(g,.025,.025,.08,'#c9a227',-.12,1.0,.32,8).rotation.x=Math.PI/2;C(g,.025,.025,.08,'#c9a227',.12,1.0,.32,8).rotation.x=Math.PI/2;},
  bureau_etude(g){B(g,1.8,.06,.7,WOOD_L,0,.72,0);legs(g,1.8,.7,.72,WOOD_D);books(g,.35,.85,.78,-.18,.18);
    B(g,.32,.02,.24,'#ffffff',-.35,.78,.08);C(g,.06,.08,.03,DARK,-.75,.78,-.2);C(g,.012,.012,.3,DARK,-.75,.81,-.2);C(g,.09,.13,.12,glow('#fff1c9',.5),-.75,1.08,-.2);},
  chaise(g){B(g,.46,.05,.46,WOOD_L,0,.45,0);legs(g,.46,.46,.45,WOOD_D,.05);B(g,.46,.48,.05,WOOD_L,0,.5,-.2);},
  etagere(g){B(g,.06,1.8,.4,WOOD,-.87,0,0);B(g,.06,1.8,.4,WOOD,.87,0,0);B(g,1.8,.04,.4,WOOD,0,1.78,0);B(g,1.74,1.8,.02,WOOD_D,0,0,-.19);
    [0,.45,.9,1.35].forEach(y=>{B(g,1.74,.04,.4,WOOD,0,y,0);books(g,-.8,.8,y+.04,0,.28);});},
  lampadaire(g){C(g,.2,.22,.04,DARK,0,0,0);C(g,.022,.022,1.5,DARK,0,.04,0);C(g,.17,.27,.3,glow('#fff2cc',.55),0,1.5,0);},
  pouf(g){C(g,.32,.3,.32,'#f2c14e',0,0,0,20);S(g,.32,'#f2c14e',0,.32,0,1,.25,1,20);},
  canape(g){B(g,2.8,.38,.85,'#6c8ebf',0,.08,0);B(g,2.8,.6,.22,'#5b7cad',0,.4,-.32);B(g,.22,.62,.85,'#5b7cad',-1.3,.08,0);B(g,.22,.62,.85,'#5b7cad',1.3,.08,0);
    B(g,1.15,.14,.6,'#7d9fd0',-.6,.46,.08);B(g,1.15,.14,.6,'#7d9fd0',.6,.46,.08);B(g,.4,.3,.12,'#f2c14e',-1.0,.55,-.17);legs(g,2.7,.8,.08,WOOD_D,.07);},
  table_basse(g){B(g,1.4,.07,.65,WOOD,0,.36,0);legs(g,1.4,.65,.36,WOOD_D);B(g,.3,.04,.22,'#e63946',.25,.43,0);C(g,.06,.05,.1,'#ffffff',-.3,.43,.05,10);},
  tv(g){B(g,1.8,.45,.45,'#5b4636',0,0,0);B(g,.8,.02,.01,'#3b2c22',-.42,.24,.226);B(g,.8,.02,.01,'#3b2c22',.42,.24,.226);
    B(g,.3,.05,.2,DARK,0,.45,-.05);B(g,.06,.12,.06,DARK,0,.5,-.05);B(g,1.45,.82,.06,'#151719',0,.6,-.05);B(g,1.36,.72,.01,glow('#2b5d8a',.35),0,.65,-.017);},
  tapis_rect(g){B(g,2.7,.02,1.7,'#c9a27e',0,0,0);B(g,2.4,.024,1.4,'#e6cfb3',0,0,0);B(g,2.0,.028,1.0,'#c9a27e',0,0,0);},
  fauteuil(g){B(g,.85,.38,.8,'#d1495b',0,.08,0);B(g,.85,.6,.2,'#b23a48',0,.4,-.3);B(g,.16,.55,.8,'#b23a48',-.35,.08,0);B(g,.16,.55,.8,'#b23a48',.35,.08,0);B(g,.55,.13,.55,'#e05f70',0,.46,.06);legs(g,.8,.75,.08,WOOD_D,.06);},
  plante_haute(g){C(g,.24,.2,.5,'#e9e4da',0,0,0);C(g,.22,.22,.02,'#4a3324',0,.48,0);C(g,.03,.04,.9,'#6b4a30',0,.5,0);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2,m=add(g,gSph(.2,10),mat('#3f9b4b'),Math.cos(a)*.22,1.0+(i%3)*.2,Math.sin(a)*.22);m.scale.set(1,.35,.6);m.rotation.y=-a;}
    add(g,gIco(.24,1),mat('#4caf50',{flatShading:true}),0,1.55,0);},
  bibliotheque(g){B(g,1.8,2.0,.45,WOOD_D,0,0,0);[.12,.6,1.08,1.56].forEach(y=>{B(g,1.66,.4,.04,'#5c3d26',0,y,.2);books(g,-.78,.78,y,.02,.3);});},
  piano(g){B(g,1.6,1.15,.6,'#1d1d1d',0,0,-.05);B(g,1.6,.06,.35,'#1d1d1d',0,.7,.3);B(g,1.5,.03,.22,'#fafafa',0,.76,.33);
    for(let i=0;i<14;i++)if([1,2,4,5,6].includes(i%7))B(g,.04,.02,.12,'#111',-.7+i*.1+.05,.79,.28);B(g,.9,.05,.35,'#1d1d1d',0,.45,.75);legs(g,.9,.3,.45,'#1d1d1d',.05);},
  arbre(g){C(g,.11,.16,1.1,'#8b5a2b',0,0,0,8);add(g,gIco(.75,1),mat('#5fae4f',{flatShading:true}),0,1.75,0);add(g,gIco(.5,1),mat('#6dbe5a',{flatShading:true}),.3,2.25,.1);},
  buisson(g){[[0,.3,0,.36],[.2,.24,.12,.26],[-.2,.24,-.08,.27]].forEach(([x,y,z,r])=>add(g,gIco(r,1),mat('#4f9e45',{flatShading:true}),x,y,z));},
  fleurs(g){B(g,1.85,.16,.85,'#6b4a30',0,0,0);B(g,1.95,.2,.08,'#d9cbb5',0,0,.45);B(g,1.95,.2,.08,'#d9cbb5',0,0,-.45);
    const cols=['#ff6b6b','#ffd166','#f78fb3','#ffffff','#c084fc'];
    for(let i=0;i<14;i++){const x=-.8+(i%7)*.27,z=i<7?-.18:.18;C(g,.01,.01,.22,'#3f8f3f',x,.16,z,5);S(g,.07,cols[i%cols.length],x,.42,z);}},
  banc(g){for(let i=0;i<3;i++)B(g,1.8,.05,.13,WOOD,0,.45,-.15+i*.15);for(let i=0;i<2;i++)B(g,1.8,.11,.04,WOOD,0,.62+i*.17,-.26);
    [-.75,.75].forEach(x=>{B(g,.06,.45,.42,DARK,x,0,0);B(g,.06,.45,.06,DARK,x,.45,-.26);});},
  reverbere(g){C(g,.16,.2,.15,DARK,0,0,0,8);C(g,.045,.06,2.3,DARK,0,.15,0,8);B(g,.32,.06,.32,DARK,0,2.45,0);B(g,.24,.28,.24,glow('#fff1b8',.9),0,2.17,0);C(g,.2,.02,.15,DARK,0,2.51,0,4);},
  fontaine(g){C(g,.92,.98,.45,'#bfb6a8',0,0,0,24);C(g,.8,.8,.04,mat('#4fc3e8',{roughness:.2,emissive:'#1d6f8c',emissiveIntensity:.25}),0,.4,0,24);
    C(g,.12,.16,.9,'#d6cfc4',0,.4,0,10);C(g,.38,.18,.14,'#d6cfc4',0,1.3,0,16);C(g,.32,.32,.03,mat('#7fd7f2',{roughness:.2}),0,1.43,0,16);S(g,.09,'#d6cfc4',0,1.52,0);},
  balancoire(g){[-.9,.9].forEach(x=>{const a=B(g,.08,2.0,.08,WOOD,x,0,-.35);a.rotation.x=.18;const b=B(g,.08,2.0,.08,WOOD,x,0,.35);b.rotation.x=-.18;});
    B(g,1.95,.09,.09,WOOD_D,0,1.95,0);[-.25,.25].forEach(x=>C(g,.01,.01,1.4,'#ddd',x,.6,0,4));B(g,.65,.05,.25,'#e63946',0,.58,0);},
  frigo(g){B(g,.82,1.92,.7,'#e8eef2',0,0,0);B(g,.83,.015,.71,'#b8c3cb',0,1.25,0);B(g,.03,.35,.04,METAL,-.32,1.4,.37);B(g,.03,.5,.04,METAL,-.32,.6,.37);
    B(g,.1,.1,.01,'#ff6b6b',.15,1.55,.355);B(g,.12,.08,.01,'#ffd166',.2,1.38,.355);},
  plan_travail(g){B(g,2.9,.86,.64,'#ffffff',0,0,0);B(g,2.96,.05,.7,'#5d6d7e',0,.86,0);for(let i=0;i<4;i++){B(g,.02,.7,.01,'#d0d4d8',-1.45+.725*(i+.5)+.36,.08,.322);B(g,.18,.02,.02,METAL,-1.1+i*.73,.7,.335);}
    B(g,.6,.03,.42,'#aab4bd',.6,.89,0);C(g,.02,.02,.3,METAL,.6,.89,-.25,6);B(g,.02,.02,.16,METAL,.6,1.17,-.18);
    B(g,2.9,.6,.04,'#cfe0ea',0,.91,-.31);C(g,.12,.1,.18,'#e63946',-.9,.91,.05,12);},
  table_cuisine(g){C(g,.62,.62,.05,WOOD_L,0,.74,0,28);C(g,.06,.06,.74,WOOD_D,0,0,0,10);C(g,.3,.32,.04,WOOD_D,0,0,0,16);
    [[0,.7],[0,-.7],[.7,0],[-.7,0]].forEach(([x,z])=>{const c=new THREE.Group();BUILD.chaise(c);c.scale.setScalar(.85);c.position.set(x,0,z);c.rotation.y=Math.atan2(-x,-z);g.add(c);});
    S(g,.08,'#ff6b6b',.12,.84,.05);S(g,.07,'#ffd166',-.08,.83,-.1);},
  four(g){B(g,.8,.9,.66,'#d9d9d9',0,0,0);B(g,.62,.42,.01,'#1d1d1d',0,.18,.335);B(g,.5,.03,.03,METAL,0,.66,.35);
    [[-.18,-.15],[.18,-.15],[-.18,.15],[.18,.15]].forEach(([x,z])=>C(g,.1,.1,.012,'#333',x,.9,z,14));},
  tabouret(g){C(g,.2,.2,.05,'#e63946',0,.65,0,16);[0,1,2,3].forEach(i=>{const a=i*Math.PI/2+Math.PI/4;C(g,.02,.025,.65,METAL,Math.cos(a)*.13,0,Math.sin(a)*.13,6);});},
  baignoire(g){B(g,1.85,.56,.82,'#ffffff',0,0,0);B(g,1.6,.04,.6,mat('#9ad9f0',{roughness:.15}),0,.46,0);C(g,.03,.03,.25,METAL,-.8,.56,0,6);
    S(g,.12,'#ffffff',.5,.52,.1,1,.5,1);S(g,.06,'#ffd166',-.2,.53,0);},
  lavabo(g){B(g,.7,.78,.5,'#ffffff',0,0,0);B(g,.6,.04,.4,'#d8e3ea',0,.78,.02);C(g,.016,.016,.18,METAL,0,.8,-.15,6);B(g,.6,.75,.03,mat('#cde8f5',{roughness:.1,metalness:.3}),0,1.05,-.235);},
  tapis_bain(g){B(g,.85,.02,.6,'#7fc8a9',0,0,0);B(g,.7,.024,.45,'#a3dcc4',0,0,0);},
  douche(g){B(g,.92,.08,.92,'#ffffff',0,0,0);const gl=mat('#bfe6f7',{transparent:true,opacity:.35,roughness:.05});
    B(g,.02,1.9,.92,gl,.45,.08,0);B(g,.92,1.9,.02,gl,0,.08,.45);C(g,.012,.012,1.7,METAL,-.38,.08,-.38,6);C(g,.1,.1,.03,METAL,-.3,1.85,-.3,12);},
  bureau_pc(g){B(g,1.8,.06,.72,'#f0f0f0',0,.72,0);legs(g,1.8,.72,.72,DARK,.05);B(g,.7,.42,.04,'#1d1d1d',0,.95,-.18);B(g,.64,.36,.01,glow('#3d7dd8',.4),0,.98,-.155);
    B(g,.08,.2,.06,'#1d1d1d',0,.78,-.2);B(g,.5,.02,.16,'#2b2b2b',0,.78,.12);B(g,.08,.02,.12,'#2b2b2b',.4,.78,.12);C(g,.05,.05,.1,'#e63946',-.65,.78,.1,10);},
  chaise_bureau(g){C(g,.04,.04,.42,DARK,0,.06,0,8);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const m=B(g,.3,.04,.05,DARK,Math.cos(a)*.15,.04,Math.sin(a)*.15);m.rotation.y=-a;}
    B(g,.5,.08,.48,'#3a4f7a',0,.48,0);B(g,.48,.55,.07,'#3a4f7a',0,.62,-.22);},
  classeur(g){B(g,.6,1.15,.6,'#8395a7',0,0,0);[.12,.48,.84].forEach(y=>{B(g,.52,.3,.01,'#9aabbd',0,y,.305);B(g,.16,.03,.02,METAL,0,y+.22,.315);});},
  tableau_blanc(g){[-.75,.75].forEach(x=>{B(g,.05,1.7,.05,METAL,x,0,0);B(g,.05,.04,.5,METAL,x,0,0);});B(g,1.65,1.0,.04,'#ffffff',0,.7,0);
    B(g,1.7,.04,.06,'#c0c7ce',0,.68,0);B(g,.5,.03,.01,'#e63946',-.3,1.3,.025);B(g,.7,.03,.01,'#2a6fdb',.1,1.18,.025);B(g,.4,.03,.01,'#2a9d8f',-.2,1.05,.025);},
  tapis_yoga(g){B(g,.7,.025,1.8,'#a78bfa',0,0,0);C(g,.09,.09,.65,'#8b6fe6',0,.01,-.8,14).rotation.z=Math.PI/2;},
  halteres(g){B(g,.75,.5,.4,DARK,0,0,0);B(g,.75,.04,.4,'#555',0,.5,0);
    [-.18,.18].forEach(x=>{C(g,.025,.025,.36,METAL,x,.54,0,6).rotation.x=Math.PI/2;[-.15,.15].forEach(z=>{const m=C(g,.07,.07,.07,'#e63946',x,.54,z,12);m.rotation.x=Math.PI/2;m.position.y=.6;});});},
  swiss_ball(g){S(g,.36,mat('#ff6b6b',{roughness:.4}),0,.36,0,null,null,null,24);},
  velo(g){B(g,.4,.06,1.3,DARK,0,0,0);const w=add(g,gTor(.28,.05),mat('#2a2a2a'),0,.38,.3);w.rotation.y=Math.PI/2;
    B(g,.08,.7,.08,'#e63946',0,.06,-.25).rotation.x=-.2;B(g,.25,.06,.3,'#1d1d1d',0,.78,-.3);B(g,.08,.85,.08,'#e63946',0,.06,.35).rotation.x=.25;B(g,.45,.04,.05,'#1d1d1d',0,.95,.55);},
  banc_muscu(g){B(g,.36,.1,1.4,'#1d1d1d',0,.45,.1);legs(g,.36,1.2,.45,METAL,.05);[-.35,.35].forEach(x=>B(g,.05,1.1,.05,METAL,x,0,-.65));
    const bar=C(g,.02,.02,1.4,METAL,0,1.05,-.65,6);bar.rotation.z=Math.PI/2;bar.position.y=1.08;[-.6,.6].forEach(x=>{const p=C(g,.17,.17,.06,'#2b2b2b',x,1.08,-.65,16);p.rotation.z=Math.PI/2;p.position.y=1.08;});},
  table_massage(g){B(g,.72,.12,1.85,'#4fb3a9',0,.72,0);B(g,.74,.04,1.87,'#3d9a90',0,.68,0);legs(g,.66,1.75,.68,METAL,.05);
    B(g,.6,.06,.6,'#ffffff',0,.84,.5);C(g,.1,.1,.6,'#e8f4f2',0,.84,-.7,14).rotation.z=Math.PI/2;},
  squelette(g){
    const bone=mat('#f5f0e1');C(g,.22,.26,.05,DARK,0,0,0,16);C(g,.02,.02,.5,METAL,0,.05,0,6);
    C(g,.035,.035,.75,bone,0,.62,0,8);                                   // colonne
    S(g,.15,bone,0,1.52,0,1,1.1,1.05);S(g,.06,DARK,-.055,1.53,.13,1,1,.4);S(g,.06,DARK,.055,1.53,.13,1,1,.4);B(g,.14,.06,.1,bone,0,1.37,.05); // crâne
    for(let i=0;i<5;i++){const t=add(g,gTor(.15-i*.012,.016,Math.PI*1.6),bone,0,1.25-i*.07,0);t.rotation.x=Math.PI/2;t.rotation.z=Math.PI*.2+Math.PI;}
    S(g,.12,bone,0,.62,0,1.3,.6,.8);                                     // bassin
    [-1,1].forEach(s=>{C(g,.025,.025,.55,bone,s*.2,.95,0,6).rotation.z=s*.15;C(g,.022,.022,.5,bone,s*.25,.5,0,6);   // bras
      C(g,.03,.03,.45,bone,s*.09,.15,0,6);C(g,.028,.028,.2,bone,s*.09,.05,0,6);});},
  espalier(g){[-.85,.85].forEach(x=>B(g,.1,2.3,.1,WOOD,x,0,0));for(let i=0;i<11;i++){const r=C(g,.025,.025,1.6,WOOD_L,0,.15+i*.2,0,8);r.rotation.z=Math.PI/2;r.position.y=.2+i*.2;}},
  barres(g){B(g,.8,.04,2.8,'#c8d6df',0,0,0);[-.3,.3].forEach(x=>{[-1.2,0,1.2].forEach(z=>C(g,.03,.035,.95,METAL,x,.04,z,8));const b=C(g,.025,.025,2.6,'#e0b64a',x,.98,0,8);b.rotation.x=Math.PI/2;b.position.y=.99;});},
  plateau(g){const h=add(g,new THREE.SphereGeometry(.16,16,8,0,Math.PI*2,0,Math.PI/2),mat('#2a6fdb'),0,0,0);h.castShadow=true;C(g,.32,.32,.05,'#4f8de8',0,.14,0,24);},
  transat(g){B(g,.65,.08,1.5,'#ffffff',0,.25,.15);legs(g,.6,1.4,.25,'#ffffff',.05);const b=B(g,.65,.08,.8,'#ffffff',0,0,0);b.rotation.x=.9;b.position.set(0,.6,-.72);
    for(let i=0;i<3;i++)B(g,.2,.02,1.4,i%2?'#ffffff':'#3fa7d6',-.21+i*.21,.33,.15);},
  parasol(g){C(g,.2,.24,.1,'#555',0,0,0);C(g,.025,.025,2.1,'#ddd',0,.1,0,6);
    for(let i=0;i<8;i++){const m=add(g,new THREE.ConeGeometry(1.0,.45,2,1,true,i*Math.PI/4,Math.PI/4),mat(i%2?'#ffffff':'#ef7d6d',{side:THREE.DoubleSide}),0,2.15,0);m.castShadow=true;}},
  bouee(g){const t=add(g,gTor(.3,.11),mat('#ff6b6b'),0,.12,0);t.rotation.x=Math.PI/2;for(let i=0;i<4;i++){const a=add(g,gTor(.3,.115,Math.PI/8),mat('#ffffff'),0,.12,0);a.rotation.x=Math.PI/2;a.rotation.z=i*Math.PI/2;}},
  salon_jardin(g){C(g,.55,.55,.04,'#f4f1ea',0,.72,0,24);C(g,.04,.04,.72,'#555',0,0,0,8);C(g,.25,.28,.03,'#555',0,0,0,16);
    [[-.75,0],[.75,0]].forEach(([x,z])=>{const c=new THREE.Group();BUILD.chaise(c);c.position.set(x,0,z);c.rotation.y=x<0?Math.PI/2:-Math.PI/2;g.add(c);});
    C(g,.03,.03,1.6,'#ddd',0,.76,0,6);for(let i=0;i<6;i++){const m=add(g,new THREE.ConeGeometry(.85,.35,2,1,true,i*Math.PI/3,Math.PI/3),mat(i%2?'#ffffff':'#2a9d8f',{side:THREE.DoubleSide}),0,2.3,0);m.castShadow=true;}},
  barbecue(g){S(g,.3,'#1d1d1d',0,.75,0,1,.6,1);C(g,.31,.31,.02,'#555',0,.75,0,20);[0,1,2].forEach(i=>{const a=i/3*Math.PI*2;const l=C(g,.02,.02,.75,'#333',Math.cos(a)*.2,0,Math.sin(a)*.2,6);l.rotation.z=Math.cos(a)*.15;});
    S(g,.29,'#262626',0,.78,0,1,.45,1);C(g,.03,.03,.06,METAL,0,.92,0,8);},
  hamac(g){[-1.3,1.3].forEach(z=>B(g,.12,1.5,.12,WOOD,0,0,z));
    for(let i=0;i<9;i++){const z=-1.1+i*.275,y=.95-Math.sin(i/8*Math.PI)*.35;B(g,.75,.03,.29,i%2?'#f4a261':'#e9c46a',0,y,z);}
    [-1.2,1.2].forEach(z=>C(g,.01,.01,.4,'#ddd',0,1.1,z,4));},
  lanternes(g){C(g,.04,.05,2.1,WOOD_D,0,0,0,6);const cols=['#ffd166','#ff6b6b','#7dcfa0','#6cb4ee','#f5a3c7'];
    for(let i=0;i<7;i++){const a=i/6*Math.PI;S(g,.07,glow(cols[i%cols.length],.9),Math.cos(a)*.4,2.0-Math.sin(a)*.25,Math.sin(a)*.1);}},
  // ── Décorations ajoutées (v2) ──
  peluche(g){const fur=mat('#a9774f'),lt=mat('#e8c9a3');
    S(g,.2,fur,0,.2,0,1,1.05,.95);S(g,.14,fur,0,.46,.02);
    [-1,1].forEach(s=>{S(g,.05,fur,s*.1,.58,0);S(g,.07,fur,s*.15,.06,.12,1,.8,1.2);S(g,.055,fur,s*.2,.24,.06,1,1.4,1);S(g,.018,'#2b2b2b',s*.05,.5,.13);});
    S(g,.06,lt,0,.43,.13,1,.8,.6);S(g,.02,'#2b2b2b',0,.45,.18);S(g,.08,lt,0,.2,.16,1,1.1,.4);B(g,.12,.04,.04,'#e63946',0,.34,.12);},
  pile_livres(g){const cols=['#e63946','#457b9d','#f4a261','#2a9d8f','#e9c46a','#8e7dbe'];let y=0;
    cols.forEach((c,i)=>{const h=.06+(i%3)*.012,w=.44-(i%2)*.06,d=.32-(i%3)*.03;const m=B(g,w,h,d,c,0,y,0);m.rotation.y=[0,.18,-.12,.3,-.2,.08][i];y+=h;});
    S(g,.05,'#e63946',.05,y+.05,0);add(g,gCone(.012,.04,5),mat('#3f8f3f'),.05,y+.11,0);},
  bougies(g){C(g,.22,.22,.03,'#c9a227',0,0,0,24);
    [[0,0,.3],[.1,.06,.22],[-.09,.05,.16]].forEach(([x,z,h])=>{C(g,.04,.04,h,'#fff4e0',x,.03,z,12);S(g,.025,glow('#ffb703',1.2),x,.03+h+.035,z,.7,1.4,.7);});},
  pouf_poire(g){const m=mat('#6cb4ee',{roughness:.95});S(g,.38,m,0,.26,0,1,.72,1,24);S(g,.24,m,0,.5,-.08,1,.6,1);},
  miroir(g){B(g,.5,.05,.3,WOOD_D,0,0,0);B(g,.06,.2,.06,WOOD_D,0,.05,-.05);B(g,.52,1.3,.06,WOOD,0,.25,-.05);
    B(g,.44,1.2,.02,mat('#dff3fb',{roughness:.05,metalness:.6}),0,.3,-.015);},
  globe(g){C(g,.2,.24,.04,WOOD_D,0,0,0,16);C(g,.025,.025,.3,WOOD_D,0,.04,0,8);
    S(g,.2,mat('#4f8de8',{roughness:.5}),0,.55,0,null,null,null,24);
    [[.1,.6,.13,.09],[-.12,.5,.1,.08],[.02,.42,-.16,.07],[-.05,.68,-.12,.06]].forEach(([x,y,z,r])=>S(g,r,'#62b05c',x,y,z,1,.6,1));
    const ring=add(g,gTor(.23,.012,Math.PI*1.3),mat('#c9a227',{metalness:.5,roughness:.4}),0,.55,0);ring.rotation.y=Math.PI/2;ring.rotation.z=.4;},
  guitare(g){const body=mat('#c8743a',{roughness:.45});B(g,.3,.06,.3,DARK,0,0,0);
    const gg=new THREE.Group();g.add(gg);gg.position.set(0,.06,0);gg.rotation.x=-.22;
    S(gg,.17,body,0,.25,0,1,1,.35);S(gg,.13,body,0,.47,0,1,1,.35);S(gg,.05,'#2b2b2b',0,.36,.05,1,1,.2);
    B(gg,.06,.55,.04,'#5c3d26',0,.55,.01);B(gg,.09,.12,.04,'#5c3d26',0,1.1,.01);
    [-.015,0,.015].forEach(x=>B(gg,.004,.9,.004,'#e5e5e5',x,.2,.06));},
  horloge(g){B(g,.5,.15,.35,WOOD_D,0,0,0);B(g,.42,1.4,.3,'#8b5e3c',0,.15,0);B(g,.5,.42,.36,WOOD_D,0,1.55,0);
    const f=C(g,.15,.15,.02,'#fdf6e3',0,1.74,.19,24);f.rotation.x=Math.PI/2;
    B(g,.012,.1,.005,'#222',0,1.75,.2);B(g,.07,.012,.005,'#222',.035,1.744,.2);
    B(g,.26,.8,.01,mat('#bfe6f7',{transparent:true,opacity:.35}),0,.4,.152);B(g,.01,.45,.01,'#c9a227',0,.6,.14);
    const p=C(g,.06,.06,.01,'#c9a227',0,.5,.145,16);p.rotation.x=Math.PI/2;},
  lit_double(g){B(g,2.7,.3,2.8,'#6b4a30',0,0,0);B(g,2.6,.24,2.6,WHITE,0,.3,.05);B(g,2.64,.1,1.6,'#e9c46a',0,.5,.55);B(g,2.64,.11,.14,'#d4a83a',0,.49,-.3);
    [-.6,.6].forEach(x=>B(g,1.0,.16,.45,'#ffffff',x,.54,-.95));B(g,2.76,1.2,.14,'#6b4a30',0,0,-1.37);B(g,2.76,.1,.18,'#8b5e3c',0,1.2,-1.37);},
  cactus(g){C(g,.18,.14,.26,'#e07a5f',0,0,0,14);C(g,.16,.16,.02,'#5c4033',0,.24,0,14);const gr=mat('#5aa469',{roughness:.7});
    C(g,.09,.1,.6,gr,0,.25,0,10);S(g,.09,gr,0,.85,0,1,.6,1,10);
    [[-1,.45,.25],[1,.55,.2]].forEach(([s,y,h])=>{const c=C(g,.05,.05,.12,gr,s*.12,y,0,8);c.rotation.z=Math.PI/2;C(g,.05,.05,h,gr,s*.18,y,0,8);S(g,.05,gr,s*.18,y+h,0);});
    S(g,.035,'#ff6b9a',0,.92,0);},
  lampe_arc(g){C(g,.16,.18,.06,'#3a3a3a',-.3,0,0,16);C(g,.02,.02,1.2,METAL,-.3,.06,0,8);
    add(g,gTor(.3,.018,Math.PI),mat('#9aa5ad',{metalness:.6,roughness:.3}),0,1.26,0);C(g,.08,.16,.16,glow('#fff2cc',.6),.3,1.02,0);},
  etagere_cubes(g){const w=mat('#f4f1ea');[0,.78,1.56].forEach(y=>B(g,1.6,.04,.4,w,0,y,0));[-.78,0,.78].forEach(x=>B(g,.04,1.56,.4,w,x,0,0));B(g,1.6,1.6,.02,'#e6e0d6',0,0,-.19);
    B(g,.3,.3,.3,'#e9c46a',-.4,.04,0);books(g,.1,.7,.82,0,.28);S(g,.12,'#7dcfa0',-.4,.95,0);C(g,.1,.08,.18,'#e07a5f',.4,.04,0,12);S(g,.1,'#62b05c',.4,.32,0);},
  cheminee(g){const st=mat('#d8cfc4',{roughness:.95});B(g,1.8,1.1,.5,st,0,0,-.05);B(g,2.0,.1,.6,'#8b5e3c',0,1.1,-.05);B(g,1.0,.65,.1,'#2b2420',0,.08,.21);
    B(g,.9,.06,.3,'#6b4a30',0,.1,.1);[-.15,.15].forEach(x=>{const l=C(g,.05,.05,.5,'#6b4a30',x,.16,.12,8);l.rotation.z=Math.PI/2;l.position.y=.2;});
    [[0,.2,.38],[-.13,.18,.28],[.13,.18,.3]].forEach(([x,y,h])=>add(g,gCone(.09,h,8),glow('#ff7b00',1.3),x,y+h/2,.14));
    add(g,gCone(.05,.22,8),glow('#ffd166',1.5),0,.31,.15);B(g,.3,.25,.2,'#e63946',-.6,1.2,-.1);C(g,.05,.05,.2,'#7dcfa0',.6,1.2,-.1,10);},
  platine(g){B(g,.7,.6,.45,'#5b4636',0,0,0);B(g,.6,.02,.01,'#3b2c22',0,.3,.226);B(g,.6,.08,.4,'#1d1d1d',0,.6,0);
    C(g,.16,.16,.012,'#111',-.06,.68,0,24);C(g,.05,.05,.014,'#e63946',-.06,.681,0,16);const arm=B(g,.02,.02,.22,METAL,.18,.69,-.02);arm.rotation.y=.4;},
  aquarium(g){B(g,1.5,.7,.5,'#3a4f7a',0,0,0);B(g,1.4,.7,.42,mat('#7fd3f0',{transparent:true,opacity:.45,roughness:.05}),0,.7,0);B(g,1.42,.04,.44,'#2b2b2b',0,1.4,0);
    B(g,1.3,.06,.36,'#e9d8a6',0,.7,0);
    [[-.4,.95,.05,'#ff7f50'],[.2,1.1,-.05,'#ffd166'],[.45,.88,.08,'#f78fb3']].forEach(([x,y,z,c])=>{S(g,.06,c,x,y,z,1.4,.8,.5);const t=add(g,gCone(.04,.06,3),mat(c),x-.09,y,z);t.rotation.z=Math.PI/2;});
    [-.55,-.1,.35].forEach(x=>{for(let k=0;k<3;k++)C(g,.012,.02,.25+k*.06,'#3f9b4b',x+k*.04,.76,-.1,5);});},
  canape_angle(g){const c='#8e7dbe',d='#7a69a8';B(g,2.8,.38,.85,c,0,.08,-.5);B(g,2.8,.6,.22,d,0,.4,-.83);B(g,.85,.38,1.0,c,1.0,.08,.42);
    B(g,.22,.6,1.85,d,1.36,.08,-.05);B(g,.22,.62,.85,d,-1.3,.08,-.5);
    B(g,.9,.14,.6,'#a596d0',-.7,.46,-.42);B(g,.9,.14,.6,'#a596d0',.25,.46,-.42);B(g,.7,.14,.9,'#a596d0',1.0,.46,.4);B(g,.4,.3,.12,'#f2c14e',-1.0,.55,-.67);},
  rochers(g){[[0,.18,0,.26],[.24,.12,.14,.16],[-.2,.1,.16,.14]].forEach(([x,y,z,r])=>add(g,gIco(r,0),mat('#9aa0a6',{flatShading:true,roughness:1}),x,y,z));},
  nain_jardin(g){B(g,.33,.04,.2,'#5c3d26',0,0,0);C(g,.16,.18,.26,'#3a6fd8',0,.04,0,12);S(g,.12,'#f5d0b5',0,.4,0);add(g,gCone(.13,.3,12),mat('#e63946'),0,.6,0);
    S(g,.1,'#ffffff',0,.32,.07,1,1.2,.6);S(g,.025,'#ff9a8a',0,.41,.11);[-1,1].forEach(s=>S(g,.015,'#2b2b2b',s*.04,.44,.1));},
  nichoir(g){C(g,.03,.035,1.1,WOOD_D,0,0,0,8);B(g,.28,.26,.26,'#e9c46a',0,1.1,0);
    const r1=B(g,.22,.03,.32,'#c0392b',-.07,1.36,0);r1.rotation.z=.6;const r2=B(g,.22,.03,.32,'#c0392b',.07,1.36,0);r2.rotation.z=-.6;
    const h=C(g,.04,.04,.02,'#2b2b2b',0,1.2,.13,12);h.rotation.x=Math.PI/2;},
  bac_potager(g){B(g,1.8,.32,.8,'#a8794f',0,0,0);B(g,1.7,.04,.7,'#5c4033',0,.3,0);
    for(let i=0;i<5;i++){const x=-.7+i*.35;const c=add(g,gCone(.035,.16,8),mat('#ff8c42'),x,.36,-.18);c.rotation.x=Math.PI;
      [-.02,.02].forEach(dx=>add(g,gCone(.02,.14,5),mat('#4caf50'),x+dx,.46,-.18));S(g,.1,'#7cc576',x,.38,.18,1,.7,1);}},
  brouette(g){const t=add(g,new THREE.CylinderGeometry(.32,.2,.25,4,1,false,Math.PI/4),mat('#2a9d8f'),0,.42,-.05);t.scale.set(1,1,1.4);
    const w=add(g,gTor(.12,.04),mat('#2b2b2b'),0,.16,.38);w.rotation.y=Math.PI/2;
    [-1,1].forEach(s=>{const h=B(g,.03,.03,.7,METAL,s*.18,.3,-.3);h.rotation.x=-.25;B(g,.03,.3,.03,METAL,s*.16,0,-.3);});},
  tente(g){const t=add(g,new THREE.CylinderGeometry(.9,.9,1.8,3,1,false,Math.PI),mat('#f4a261',{side:THREE.DoubleSide}),0,.45,0);t.rotation.x=Math.PI/2;
    const d=add(g,new THREE.CylinderGeometry(.45,.45,.02,3,1,false,Math.PI),mat('#7a4a2a'),0,.225,.9);d.rotation.x=Math.PI/2;
    B(g,1.7,.02,1.9,'#6c8ebf',0,0,0);},
  trampoline(g){[0,1,2,3].forEach(i=>{const a=i*Math.PI/2+Math.PI/4;C(g,.025,.025,.5,METAL,Math.cos(a)*.78,0,Math.sin(a)*.78,6);});
    const ring=add(g,gTor(.82,.05),mat('#2a6fdb'),0,.52,0);ring.rotation.x=Math.PI/2;C(g,.76,.76,.02,'#1d1d1d',0,.5,0,32);},
  palmier(g){let x=0,y=0;for(let i=0;i<6;i++){const seg=C(g,.09-i*.008,.1-i*.008,.36,'#a0703a',x,y,0,8);seg.rotation.z=-.06*i;x+=.025*i;y+=.34;}
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const leaf=add(g,gCone(.12,.9,4),mat('#4caf50',{flatShading:true}),x+Math.cos(a)*.35,y+.05,Math.sin(a)*.35);leaf.rotation.z=-Math.cos(a)*1.9;leaf.rotation.x=Math.sin(a)*1.9;}
    S(g,.06,'#7a5235',x+.05,y-.02,.05);S(g,.06,'#7a5235',x-.05,y-.02,-.03);},
  corbeille_fruits(g){C(g,.28,.28,.04,WOOD_L,0,.6,0,20);C(g,.04,.05,.6,WOOD_D,0,0,0,8);C(g,.2,.22,.03,WOOD_D,0,0,0,14);
    add(g,new THREE.SphereGeometry(.2,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2),mat('#c9a227',{side:THREE.DoubleSide}),0,.84,0);
    [[0,.82,0,'#e63946'],[.08,.84,.05,'#f4a261'],[-.08,.83,.06,'#ffd166'],[.02,.88,-.07,'#7cc576']].forEach(([x,y,z,c])=>S(g,.07,c,x,y,z));},
  machine_cafe(g){B(g,.6,.7,.5,'#f4f1ea',0,0,0);B(g,.3,.32,.26,'#2b2b2b',0,.7,-.05);B(g,.24,.08,.24,'#3a3a3a',0,1.02,-.05);B(g,.12,.02,.1,'#555',0,.72,.1);
    C(g,.04,.035,.06,'#ffffff',0,.74,.1,12);C(g,.02,.02,.04,METAL,0,.9,.06,8);add(g,gBox(.04,.04,.01),glow('#5eead4',.8),.1,.95,.086);},
  ilot(g){B(g,1.7,.86,.55,'#ffffff',0,0,-.15);B(g,1.8,.05,.7,'#5d6d7e',0,.86,-.1);[-.5,0,.5].forEach(x=>B(g,.4,.6,.01,'#e6e9ec',x,.12,.13));
    [-.45,.45].forEach(x=>{const t=new THREE.Group();BUILD.tabouret(t);t.position.set(x,0,.33);t.scale.setScalar(.9);g.add(t);});
    C(g,.12,.1,.16,'#e63946',.6,.91,-.2,12);S(g,.07,'#ffd166',-.6,.95,-.2);},
  lave_linge(g){B(g,.8,.85,.65,'#f4f6f8',0,0,0);B(g,.8,.14,.02,'#dfe5ea',0,.71,.33);
    const d=C(g,.25,.25,.04,'#b8c3cb',0,.36,.32,28);d.rotation.x=Math.PI/2;const gl=C(g,.19,.19,.05,mat('#7fb8d6',{roughness:.1,metalness:.2}),0,.355,.33,28);gl.rotation.x=Math.PI/2;
    add(g,gBox(.06,.04,.01),glow('#5eead4',.6),.25,.78,.335);const k=C(g,.03,.03,.02,'#555',-.25,.765,.33,12);k.rotation.x=Math.PI/2;},
  porte_serviettes(g){C(g,.18,.2,.03,METAL,0,0,0,16);[-.3,.3].forEach(x=>C(g,.02,.02,1.1,METAL,x,0,0,8));
    [.5,.8,1.08].forEach(y=>{const b=C(g,.015,.015,.62,METAL,0,y,0,8);b.rotation.z=Math.PI/2;b.position.y=y;});
    B(g,.5,.5,.05,'#7fc8a9',0,.38,.02);B(g,.45,.36,.05,'#f5a3c7',0,.7,-.03);},
  plante_bambou(g){C(g,.2,.16,.3,'#f4f1ea',0,0,0,14);C(g,.18,.18,.02,'#5c4033',0,.28,0,14);
    [[0,0,1.2],[.07,.04,1.0],[-.06,.05,.85],[.03,-.07,1.1]].forEach(([x,z,h])=>{C(g,.018,.018,h,'#8fbf4a',x,.3,z,6);for(let k=1;k<4;k++)C(g,.022,.022,.02,'#6e9a35',x,.3+h*k/4,z,6);const l=add(g,gCone(.05,.25,4),mat('#5aa469'),x+.06,.3+h,z);l.rotation.z=-1;});},
  imprimante(g){B(g,.65,.6,.5,WOOD_L,0,0,0);B(g,.5,.22,.4,'#e6e6e6',0,.6,0);const p=B(g,.44,.03,.2,'#ffffff',0,.82,-.08);p.rotation.x=-.4;B(g,.4,.02,.18,'#ffffff',0,.66,.22);add(g,gBox(.05,.03,.01),glow('#7dcfa0',.7),.18,.72,.205);},
  fauteuil_lecture(g){const c='#2a9d8f',d='#23867a';B(g,.85,.36,.75,c,0,.1,.05);B(g,.85,.9,.18,d,0,.1,-.33);
    [-1,1].forEach(s=>{B(g,.14,.55,.7,d,s*.36,.1,.03);B(g,.18,.35,.12,d,s*.34,.85,-.28);});B(g,.55,.12,.5,'#3fb3a5',0,.46,.1);legs(g,.8,.7,.1,WOOD_D,.05);S(g,.12,'#f2c14e',0,.75,-.18,1.3,1,.5);},
  vitrine_trophees(g){B(g,1.6,.08,.45,WOOD_D,0,0,0);B(g,1.6,.08,.45,WOOD_D,0,1.7,0);[-.78,.78].forEach(x=>B(g,.06,1.62,.45,WOOD_D,x,.08,0));B(g,1.5,1.62,.02,'#3a2a1d',0,.08,-.21);
    [.6,1.15].forEach(y=>B(g,1.5,.03,.4,mat('#cfe8f3',{transparent:true,opacity:.5}),0,y,0));
    const gold=mat('#e3b23c',{metalness:.6,roughness:.3});[[-.45,.08],[.1,.08],[.5,.08],[-.25,.63],[.35,.63],[0,1.18]].forEach(([x,y])=>{C(g,.06,.08,.04,gold,x,y,0,12);C(g,.015,.015,.1,gold,x,y+.04,0,8);C(g,.09,.04,.14,gold,x,y+.14,0,14);});
    B(g,1.5,1.62,.02,mat('#cfe8f3',{transparent:true,opacity:.2,roughness:.05}),0,.08,.22);},
  kettlebells(g){[[-.18,.12,'#e63946',.13],[.15,-.05,'#2a6fdb',.11],[.05,.2,'#ffd166',.09]].forEach(([x,z,c,r])=>{S(g,r,mat(c,{roughness:.5}),x,r*.9,z);add(g,gTor(r*.6,r*.15,Math.PI),mat('#2b2b2b'),x,r*1.6,z);});},
  tapis_course(g){B(g,.8,.14,1.8,'#2b2b2b',0,0,.05);B(g,.62,.02,1.6,'#444',0,.14,.05);[-1,1].forEach(s=>B(g,.06,1.1,.06,'#9aa5ad',s*.36,.14,-.8));
    B(g,.8,.2,.18,'#2b2b2b',0,1.24,-.8);add(g,gBox(.4,.12,.01),glow('#3d7dd8',.5),0,1.34,-.705);},
  sac_frappe(g){B(g,.6,.05,.6,'#2b2b2b',0,0,0);B(g,.06,1.9,.06,'#555',-.25,.05,-.25);B(g,.5,.05,.05,'#555',0,1.9,-.25);C(g,.01,.01,.25,'#999',.2,1.65,-.25,4);
    C(g,.16,.16,.95,mat('#c0392b',{roughness:.6}),.2,.7,-.25,16);C(g,.165,.165,.05,'#1d1d1d',.2,1.1,-.25,16);},
  electro(g){legs(g,.55,.45,.6,METAL,.03);B(g,.55,.04,.45,'#c8d6df',0,.12,0);B(g,.55,.04,.45,'#c8d6df',0,.55,0);
    B(g,.45,.25,.35,'#f4f6f8',0,.59,0);add(g,gBox(.22,.12,.01),glow('#5eead4',.7),0,.75,.176);
    [-.15,.15].forEach(x=>{const c=add(g,gTor(.08,.008,Math.PI),mat(x<0?'#e63946':'#2a6fdb'),x,.62,.2);c.rotation.x=Math.PI/2;});},
  escalier_reeduc(g){const w=mat('#d7b38a');[0,1,2,3].forEach(i=>B(g,.4,.16*(i+1),.7,w,-.75+i*.4,0,0));
    [-.38,.38].forEach(z=>{[-.9,-.05,.8].forEach(x=>C(g,.02,.02,1.0,METAL,x,0,z,8));const r=C(g,.025,.025,1.7,mat('#e0b64a'),-.05,0,z,8);r.rotation.z=Math.PI/2;r.position.y=1.0;});},
  rack_elastiques(g){B(g,.5,.05,.3,'#555',0,0,0);B(g,.06,1.5,.06,'#9aa5ad',0,.05,-.08);B(g,.5,.05,.08,'#9aa5ad',0,1.3,-.08);
    ['#e63946','#f4a261','#ffd166','#2a9d8f','#2a6fdb'].forEach((c,i)=>{const x=-.2+i*.1;C(g,.012,.012,.7,mat(c),x,.6,-.05,6);S(g,.03,c,x,.58,-.05);});},
  affiche_anatomie(g){[-.25,.25].forEach(x=>{const l=B(g,.04,1.5,.04,WOOD,x,0,-.05);l.rotation.x=-.12;});const b=B(g,.04,1.4,.04,WOOD,0,0,-.25);b.rotation.x=.3;
    B(g,.7,1.0,.02,'#fdf6e3',0,.55,.02);const red=mat('#e57373'),bn=mat('#f5f0e1');S(g,.07,bn,0,1.36,.04,1,1.1,.4);B(g,.16,.34,.01,red,0,.95,.035);
    B(g,.05,.32,.01,red,-.05,.62,.035);B(g,.05,.32,.01,red,.05,.62,.035);[-1,1].forEach(s=>{const a=B(g,.04,.3,.01,red,s*.12,.98,.035);a.rotation.z=s*.3;});},
  canard_geant(g){const y=mat('#ffd60a',{roughness:.4});S(g,.32,y,0,.3,0,1.1,.85,1.3);S(g,.2,y,0,.62,.22);
    const bk=add(g,gCone(.08,.16,8),mat('#ff8c00'),0,.6,.44);bk.rotation.x=Math.PI/2;[-1,1].forEach(s=>S(g,.03,'#1d1d1d',s*.08,.68,.38));S(g,.12,y,0,.42,-.38,1,.6,1);},
  plongeoir(g){B(g,.6,.5,.5,'#e6e0d6',0,0,-.65);B(g,.45,.06,1.6,'#2a9d8f',0,.5,.1);[-1,1].forEach(s=>C(g,.02,.02,.9,METAL,s*.28,0,-.85,8));
    const r=C(g,.02,.02,.56,METAL,0,.9,-.85,8);r.rotation.z=Math.PI/2;r.position.y=.9;},
  ping_pong(g){legs(g,1.7,.9,.7,'#555',.05);B(g,1.8,.05,1.0,'#1d6f42',0,.7,0);B(g,.02,.005,1.0,'#ffffff',0,.75,0);B(g,1.8,.005,.02,'#ffffff',0,.75,0);
    B(g,.02,.15,1.06,'#e5e5e5',0,.75,0);S(g,.025,'#ffffff',.4,.8,.2);[[.6,.3],[-.6,-.3]].forEach(([x,z])=>C(g,.09,.09,.015,'#c0392b',x,.75,z,16));},
  brasero(g){[0,1,2].forEach(i=>{const a=i/3*Math.PI*2;C(g,.02,.03,.4,'#333',Math.cos(a)*.18,0,Math.sin(a)*.18,6);});
    add(g,new THREE.SphereGeometry(.3,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2),mat('#4a4a4a',{side:THREE.DoubleSide,metalness:.4}),0,.62,0);
    [[0,.4],[.08,.3],[-.08,.3]].forEach(([x,h])=>add(g,gCone(.08,h,8),glow('#ff7b00',1.3),x,.55+h/2,0));add(g,gCone(.05,.25,8),glow('#ffd166',1.5),0,.67,0);},
  jacuzzi(g){C(g,.95,.95,.6,'#b98252',0,0,0,8);C(g,.86,.86,.02,mat('#46bfe8',{roughness:.1,emissive:'#126d93',emissiveIntensity:.35}),0,.6,0,24);
    const rim=add(g,gTor(.9,.07),mat('#8b5e3c'),0,.62,0);rim.rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;S(g,.03,'#ffffff',Math.cos(a)*.5,.63,Math.sin(a)*.5);}B(g,.6,.2,.3,'#8b5e3c',0,0,.8);},
  pergola(g){[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>B(g,.1,2.2,.1,WOOD,a*.88,0,b*.88));[-.88,.88].forEach(z=>B(g,1.95,.1,.1,WOOD_D,0,2.2,z));
    for(let i=0;i<7;i++)B(g,.06,.06,1.95,WOOD_L,-.84+i*.28,2.3,0);[-.6,.6].forEach(x=>{C(g,.12,.1,.25,'#e07a5f',x,0,-.7,12);S(g,.16,'#62b05c',x,.35,-.7);});}
};

function buildItem(type){
  const g=new THREE.Group();(BUILD[type]||BUILD.chevet)(g);return g;
}

// =========================================================
// Personnage 3D (reprend les paramètres de l'avatar SVG)
// =========================================================
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=n>>16,g=(n>>8)&255,b=n&255;const t=amt<0?0:255,p=Math.abs(amt);
  r=Math.round((t-r)*p+r);g=Math.round((t-g)*p+g);b=Math.round((t-b)*p+b);return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);}
function buildChar(ch){
  ch=ch||{};const c=ch.color||'#ef7d6d',dk=shade(c,-.28),dk2=shade(c,-.45),lt=shade(c,.45),pink='#f7b6c8',sp=ch.species,mood=ch.mood;
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);
  const body=mat(c,{roughness:.6}),robot=ch.species==='robot',frog=ch.species==='grenouille';
  if(robot){add(g,new THREE.BoxGeometry(.66,.62,.56),body,0,.42,0);}
  else S(g,.36,body,0,.4,0,1.05,.98,.95,24);
  S(g,.2,mat(lt,{roughness:.6}),0,.33,.2,1.05,.85,.55);
  S(g,.1,dk,-.14,.06,.06,1,.5,1.2);S(g,.1,dk,.14,.06,.06,1,.5,1.2);
  const ey=frog?.72:.48,ex=frog?.15:.12,ez=frog?.18:.33;
  if(frog){S(g,.13,body,-.15,.68,.08);S(g,.13,body,.15,.68,.08);}
  /* v75 : yeux blancs sur masque noir (panda, raton), expressions (yeux fermés, cœurs, étoiles) */
  const eyeC=sp==='panda'||sp==='raton'?'#fff':mood==='amour'?'#ff4d6d':mood==='etoiles'?'#ffd166':'#222',closed=mood==='joie'||mood==='dodo';
  if(sp==='panda')[-1,1].forEach(s=>S(g,.085,'#222',s*.12,.48,.29,1,1.25,.45));
  if(sp==='raton')S(g,.2,'#222',0,.49,.24,1.45,.42,.6);
  [-1,1].forEach(s=>{
    if(robot){B(g,.11,.11,.03,'#1f2937',s*ex,ey-.055,.29);add(g,gBox(.055,.055,.02),glow('#5eead4',.8),s*ex,ey,.305);}
    else if(closed||(mood==='clin'&&s<0)){S(g,.05,eyeC==='#fff'?'#fff':'#222',s*ex,ey,ez,1.05,.32,.5);}
    else{const big=sp==='alien'?1.45:1;S(g,.05*big,eyeC,s*ex,ey,ez,1,1.2,.6);S(g,.018,eyeC==='#222'?'#fff':'#222',s*ex+.015,ey+.025,ez+.03);}
    S(g,.045,'#ff7a8a',s*.21,.38,.28,1,.6,.4).material=mat('#ff7a8a',{transparent:true,opacity:.6});
  });
  switch(ch.species){
    case 'ours':[-1,1].forEach(s=>{S(g,.1,body,s*.24,.7,0);S(g,.055,mat(lt),s*.24,.7,.05,1,1,.5);});break;
    case 'souris':[-1,1].forEach(s=>{S(g,.15,body,s*.32,.66,-.02,1,1,.35);S(g,.09,mat(pink),s*.32,.66,.03,1,1,.3);});break;
    case 'chat':[-1,1].forEach(s=>{const e=add(g,gCone(.1,.2,4),body,s*.2,.76,0);e.rotation.z=-s*.25;});break;
    case 'lapin':[-1,1].forEach(s=>{const e=S(g,.08,body,s*.12,.92,-.02,.8,2.8,.6);e.rotation.z=-s*.15;});break;
    case 'robot':C(g,.015,.015,.22,dk,0,.73,0,6);S(g,.05,glow('#ffd166',.6),0,.98,0);break;
    case 'dragon':[-1,1].forEach(s=>{const h=add(g,gCone(.05,.2,8),mat('#fff3d6'),s*.15,.8,0);h.rotation.z=-s*.3;const w=add(g,gCone(.16,.3,3),mat(dk),s*.38,.45,-.12);w.rotation.z=s*1.2;});break;
    case 'licorne':{const h=add(g,gCone(.05,.32,10),mat('#ffd166',{metalness:.3,roughness:.4}),0,.9,.12);h.rotation.x=.25;S(g,.1,mat('#b79ce8'),0,.7,-.22,1.2,.7,1);break;}
    /* v75 : nouveaux animaux (formes simples, mêmes réglages que l'avatar 2D) */
    case 'renard':[-1,1].forEach(s=>{const e=add(g,gCone(.1,.3,4),body,s*.2,.8,0);e.rotation.z=-s*.22;});S(g,.17,'#fffaf2',0,.33,.22,1.25,.8,.6);S(g,.035,'#222',0,.42,.36);break;
    case 'panda':[-1,1].forEach(s=>S(g,.1,'#222',s*.24,.7,0));S(g,.035,'#222',0,.41,.36);break;
    case 'koala':[-1,1].forEach(s=>{S(g,.16,body,s*.33,.66,-.02,1,1,.45);S(g,.1,mat(lt),s*.33,.66,.03,1,1,.4);});S(g,.06,'#3b3b44',0,.4,.35,1,1.25,.7);break;
    case 'chien':[-1,1].forEach(s=>{const e=S(g,.1,dk,s*.33,.5,0,.55,1.4,.8);e.rotation.z=s*.25;});S(g,.12,mat(lt),0,.36,.3,1.1,.75,.7);S(g,.04,'#222',0,.41,.4);break;
    case 'pingouin':S(g,.3,'#ffffff',0,.38,.1,1.02,.95,.9);{const b_=add(g,gCone(.05,.12,8),mat('#ffa62b'),0,.4,.42);b_.rotation.x=Math.PI/2;}[-1,1].forEach(s=>{const f=S(g,.08,dk,s*.36,.35,0,.4,1.3,.8);f.rotation.z=s*.35;});break;
    case 'hamster':[-1,1].forEach(s=>{S(g,.07,body,s*.2,.72,0);S(g,.04,mat(pink),s*.2,.72,.03,1,1,.5);S(g,.1,mat(lt),s*.2,.34,.24);});S(g,.025,'#e8737f',0,.41,.36);break;
    case 'cochon':[-1,1].forEach(s=>{const e=add(g,gCone(.08,.14,4),mat(dk),s*.2,.76,0);e.rotation.z=-s*.3;});{const sn=C(g,.08,.08,.06,dk,0,.37,.33,16);sn.rotation.x=Math.PI/2;}break;
    case 'poussin':[-1,0,1].forEach(s=>{const t=add(g,gCone(.025,.14,6),mat(dk),s*.04,.84,0);t.rotation.z=-s*.4;});{const b_=add(g,gCone(.045,.1,8),mat('#ffa62b'),0,.4,.4);b_.rotation.x=Math.PI/2;}[-1,1].forEach(s=>{const f=S(g,.08,dk,s*.36,.38,0,.4,1.1,.8);f.rotation.z=s*.4;});break;
    case 'mouton':[[-.2,.68,.05],[-.08,.76,.08],[.08,.76,.08],[.2,.68,.05],[0,.72,-.12],[-.16,.62,-.16],[.16,.62,-.16]].forEach(([x,y,z])=>S(g,.12,'#fbf7ef',x,y,z));[-1,1].forEach(s=>S(g,.07,dk,s*.36,.52,0,1.3,.5,.6));break;
    case 'hibou':[-1,1].forEach(s=>{const t=add(g,gCone(.07,.18,4),mat(dk),s*.2,.78,0);t.rotation.z=-s*.25;S(g,.11,mat(lt),s*.12,.48,.27,1,1,.4);const f=S(g,.09,dk,s*.36,.36,0,.45,1.3,.8);f.rotation.z=s*.2;});{const b_=add(g,gCone(.04,.1,8),mat('#f2b33d'),0,.4,.4);b_.rotation.x=Math.PI/2;}break;
    case 'tigre':[-1,1].forEach(s=>{S(g,.09,body,s*.24,.7,0);S(g,.045,mat(lt),s*.24,.7,.05,1,1,.5);});[-.08,0,.08].forEach(x=>B(g,.022,.1,.02,'#222',x,.62,.3));S(g,.13,'#fffaf2',0,.35,.28,1.15,.75,.6);S(g,.03,'#e8737f',0,.41,.37);break;
    case 'vache':[-1,1].forEach(s=>{const h=add(g,gCone(.035,.16,8),mat('#f3ead8'),s*.2,.8,0);h.rotation.z=-s*.6;const e=S(g,.08,body,s*.36,.62,0,1.4,.6,.6);e.rotation.z=s*.3;});[[.22,.55,.2],[-.25,.3,.18],[.1,.2,-.28]].forEach(([x,y,z])=>S(g,.08,'#222',x,y,z,1,.8,.3));S(g,.14,mat(pink),0,.35,.3,1.25,.8,.55);break;
    case 'raton':[-1,1].forEach(s=>{const e=add(g,gCone(.09,.16,4),mat(dk),s*.2,.76,0);e.rotation.z=-s*.25;});S(g,.1,'#fffaf2',0,.36,.3,1.1,.75,.6);S(g,.032,'#222',0,.41,.38);break;
    case 'axolotl':[-1,1].forEach(s=>[-.35,0,.35].forEach(a=>{const f=S(g,.1,mat('#f58fb5'),s*.42,.55+a*.25,0,1,.3,.3);f.rotation.z=s*a;}));break;
    case 'herisson':for(let k=0;k<26;k++){const a=(k/26)*Math.PI*2,u=.25+((k*7)%5)/10,y=.4+Math.sin(u*Math.PI)*.32,r=.36*Math.cos((u-.5)*Math.PI*.9);const x=Math.cos(a)*r*.9,z=-Math.abs(Math.sin(a))*r-.02;if(z>-.08)continue;const sp_=add(g,gCone(.05,.18,5),mat(dk2),x,y,z);sp_.lookAt(x*3,y*1.4,z*3);sp_.rotateX(Math.PI/2);}S(g,.1,mat(lt),0,.36,.3,1.1,.75,.6);S(g,.03,'#222',0,.41,.38);break;
    case 'requin':{const f=add(g,gCone(.12,.3,4),mat(dk),0,.85,-.05);f.scale.set(.35,1,1);}S(g,.3,'#f4f7fa',0,.32,.1,1.02,.8,.9);[-1,1].forEach(s=>{const fn=S(g,.1,dk,s*.36,.3,0,.4,1.2,.8);fn.rotation.z=s*.7;});break;
    case 'abeille':[.3,.16].forEach(y=>{const t=add(g,gTor(.34-(y<.2?.06:0),.045),mat('#222'),0,y,0);t.rotation.x=Math.PI/2;});[-1,1].forEach(s=>{C(g,.012,.012,.22,'#222',s*.1,.72,0,6);S(g,.035,'#222',s*.12,.95,0);S(g,.16,mat('#dff3ff',{transparent:true,opacity:.75}),s*.36,.62,-.15,1,.5,.25);});break;
    case 'elephant':[-1,1].forEach(s=>{S(g,.22,dk,s*.38,.5,-.04,.3,1,1);S(g,.13,mat(pink),s*.4,.5,0,.2,1,1);});{const t=C(g,.05,.07,.26,body,0,.18,.38,10);t.rotation.x=.2;}break;
    case 'lion':S(g,.46,dk2,0,.46,-.1,1,1,.5);[-1,1].forEach(s=>S(g,.07,body,s*.2,.74,.02));S(g,.13,'#fffaf2',0,.35,.28,1.15,.75,.6);S(g,.03,'#7a4a3a',0,.41,.37);break;
    case 'dino':[[0,.8,-.02,.08],[0,.72,-.24,.07],[0,.52,-.36,.06]].forEach(([x,y,z,r])=>{const k=add(g,gCone(r,.18,4),mat(dk),x,y,z);k.rotation.x=-.5;});break;
    case 'fantome':break;
    case 'alien':[-1,1].forEach(s=>{const a=C(g,.012,.012,.26,dk,s*.13,.7,0,6);a.rotation.z=-s*.4;S(g,.045,glow('#9dfc8b',.5),s*.22,.96,0);});break;
    default:{const l=S(g,.08,mat('#7cc576'),-.06,.8,0,1,.35,.6);l.rotation.z=.6;const l2=S(g,.08,mat('#62b05c'),.06,.82,0,1,.35,.6);l2.rotation.z=-.6;}
  }
  const hy=robot?.74:.7;
  switch(ch.hat){
    case 'bandeau':add(g,gTor(.36,.04),mat('#e63946'),0,.55,0).rotation.x=Math.PI/2;break;
    case 'casquette':S(g,.26,mat('#2a6fdb'),0,hy-.04,0,1,.55,1);B(g,.24,.03,.22,'#1f56ad',0,hy-.05,.27);break;
    case 'beret':{const m=C(g,.25,.27,.07,'#b23a48',-.04,hy,0,20);m.rotation.z=.2;break;}
    case 'bonnet':S(g,.27,mat('#3fa7a0'),0,hy-.05,0,1,.8,1);C(g,.3,.3,.08,'#2f8a84',0,hy-.12,0,20);S(g,.07,'#f4f1de',0,hy+.17,0);break;
    case 'paille':C(g,.5,.5,.03,'#e9c46a',0,hy-.04,0,24);C(g,.22,.25,.18,'#f2d283',0,hy-.02,0,18);C(g,.255,.255,.05,'#d1495b',0,hy-.01,0,18);break;
    case 'toque':C(g,.2,.2,.18,'#ffffff',0,hy-.05,0,16);S(g,.25,'#ffffff',0,hy+.2,0,1,.6,1);break;
    case 'casque':{const t=add(g,gTor(.36,.03,Math.PI),mat('#333'),0,.45,0);t.rotation.z=0;[-1,1].forEach(s=>S(g,.09,'#e63946',s*.37,.45,0,.6,1,1));break;}
    case 'hautdeforme':C(g,.35,.35,.03,'#222',0,hy-.04,0,24);C(g,.21,.21,.35,'#2b2b2b',0,hy-.02,0,20);C(g,.215,.215,.06,'#c1121f',0,hy,0,20);break;
    case 'couronne':{C(g,.2,.2,.1,mat('#ffd166',{metalness:.4,roughness:.35}),0,hy-.03,0,10);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const k=add(g,gCone(.04,.1,4),mat('#ffd166',{metalness:.4,roughness:.35}),Math.cos(a)*.18,hy+.12,Math.sin(a)*.18);k.castShadow=true;}break;}
    /* v75 : nouveaux chapeaux */
    case 'noeud':[-1,1].forEach(s=>{const k=add(g,gCone(.07,.13,4),mat('#ff5c8a'),.16+s*.07,hy+.02,.06);k.rotation.z=s*Math.PI/2;});S(g,.035,'#e03e6f',.16,hy+.02,.06);break;
    case 'fleurs':for(let i=0;i<9;i++){const a=i/9*Math.PI*2;S(g,.05,['#ff6b9a','#ffd166','#ffffff','#c39bff','#ff9f68'][i%5],Math.cos(a)*.27,hy-.07,Math.sin(a)*.27);}break;
    case 'bob':C(g,.38,.42,.04,'#f4a261',0,hy-.06,0,24);S(g,.25,'#f6b37a',0,hy-.02,0,1,.55,1);break;
    case 'diplome':C(g,.22,.22,.1,'#26323f',0,hy-.04,0,16);B(g,.52,.03,.52,'#2f3d4d',0,hy+.06,0);C(g,.008,.008,.18,'#ffd166',.24,hy-.08,.24,6);S(g,.025,'#ffd166',.24,hy-.09,.24);break;
    case 'noel':{const k=add(g,gCone(.24,.42,16),mat('#d62839'),0,hy+.18,0);k.rotation.z=-.25;const t=add(g,gTor(.25,.05),mat('#ffffff'),0,hy-.02,0);t.rotation.x=Math.PI/2;S(g,.06,'#ffffff',.1,hy+.38,0);break;}
    case 'fete':add(g,gCone(.14,.36,16),mat('#7c5cff'),0,hy+.16,0);S(g,.045,'#ff5c8a',0,hy+.36,0);break;
    case 'chantier':S(g,.29,'#ffc107',0,hy-.04,0,1,.6,1);C(g,.34,.34,.03,'#f0ad00',0,hy-.08,0,24);break;
    case 'sorcier':C(g,.42,.42,.03,'#3a2a6a',0,hy-.05,0,24);{const k=add(g,gCone(.22,.55,16),mat('#4b3a8c'),0,hy+.24,0);k.rotation.z=.15;}C(g,.215,.22,.05,'#ffd166',0,hy-.03,0,20);break;
    case 'pirate':S(g,.3,'#222',0,hy,0,1.3,.45,.85);S(g,.04,'#ffffff',0,hy+.03,.25);break;
    case 'viking':S(g,.28,'#8d99ae',0,hy-.04,0,1,.65,1);[-1,1].forEach(s=>{const h=add(g,gCone(.05,.22,10),mat('#f3ead8'),s*.3,hy+.06,0);h.rotation.z=-s*1;});break;
    case 'cowboy':C(g,.48,.48,.03,'#8b5a2b',0,hy-.05,0,24);C(g,.2,.24,.2,'#a0693a',0,hy-.03,0,18);C(g,.245,.245,.04,'#5e3b1c',0,hy-.02,0,18);break;
    case 'aureole':{const t=add(g,gTor(.2,.025),glow('#ffd166',.9),0,hy+.2,0);t.rotation.x=Math.PI/2;break;}
  }
  if(ch.face==='lunettes'||ch.face==='soleil'){const fm=ch.face==='soleil'?mat('#1a1a1a'):mat('#3a2f2a');
    [-1,1].forEach(s=>{const r=add(g,gTor(.065,.012),fm,s*ex,ey,ez+.04);if(ch.face==='soleil'){add(g,new THREE.CircleGeometry(.065,16),mat('#111'),s*ex,ey,ez+.045);}r.rotation.y=0;});
    B(g,.1,.015,.015,ch.face==='soleil'?'#1a1a1a':'#3a2f2a',0,ey-.007,ez+.04);}
  if(ch.face==='moustache'){[-1,1].forEach(s=>{const m=S(g,.07,'#5a3b2e',s*.06,.38,.36,1,.4,.4);m.rotation.z=s*.3;});}
  /* v75 : nouveaux visages et tenues */
  if(ch.face==='coeur'){[-1,1].forEach(s=>add(g,gTor(.07,.016),mat('#ff4d6d'),s*ex,ey,ez+.04));B(g,.1,.015,.015,'#d6335a',0,ey-.007,ez+.04);}
  if(ch.face==='monocle')add(g,gTor(.065,.01),mat('#c9a227',{metalness:.5,roughness:.3}),ex,ey,ez+.04);
  if(ch.face==='masque')B(g,.3,.12,.04,'#cfe9ff',0,.31,.35);
  if(ch.face==='barbe')S(g,.2,'#6b4532',0,.27,.25,1.2,.8,.6);
  if(ch.face==='rousseur')[-1,1].forEach(s=>[[0,0],[.03,.02],[.015,-.02]].forEach(([dx,dy])=>S(g,.01,'#b5653f',s*(.2+dx),.4+dy,.31)));
  if(ch.face==='pansement'){const b_=B(g,.12,.035,.012,'#f2c7a5',.19,.4,.31);b_.rotation.z=-.4;}
  if(ch.face==='cache'){S(g,.06,'#222',-ex,ey,ez+.03,1,1,.35);const st=add(g,gTor(.37,.008),mat('#222'),0,ey+.04,0);st.rotation.x=Math.PI/2-.25;}
  switch(ch.outfit){
    case 'papillon':[-1,1].forEach(s=>{const k=add(g,gCone(.05,.09,4),mat('#d62839'),s*.05,.2,.34);k.rotation.z=s*Math.PI/2;});S(g,.022,'#a51d2c',0,.2,.35);break;
    case 'echarpe':{const t=add(g,gTor(.31,.05),mat('#e63946'),0,.24,.03);t.rotation.x=Math.PI/2-.15;B(g,.08,.2,.04,'#c92c39',.12,.04,.3);break;}
    case 'stetho':{const t=add(g,gTor(.3,.012,Math.PI),mat('#4a5568'),0,.26,.05);t.rotation.x=Math.PI/2;t.rotation.z=Math.PI;S(g,.035,'#cbd5e0',.12,.12,.33,1,1,.4);break;}
    case 'blouse':S(g,.24,'#ffffff',0,.22,.17,1.2,.85,.55);break;
    case 'cravate':B(g,.05,.18,.02,'#2a6fdb',0,.06,.36);S(g,.03,'#1f56ad',0,.25,.35);break;
    case 'collier':for(let i=0;i<9;i++){const a=Math.PI*(.1+i*.1);S(g,.035,['#ff6b9a','#ffd166','#6ee7b7','#7cc4ff','#c39bff'][i%5],Math.cos(a)*.3,.24-Math.sin(a)*.04,Math.sin(a)*.3);}break;
    case 'medaille':{const m=C(g,.06,.06,.015,mat('#ffd166',{metalness:.5,roughness:.3}),0,.14,.35,16);m.rotation.x=Math.PI/2;B(g,.03,.14,.01,'#2a6fdb',-.03,.16,.33);B(g,.03,.14,.01,'#e63946',.03,.16,.33);break;}
    case 'sacados':B(g,.3,.3,.14,'#2a6fdb',0,.28,-.38);break;
    case 'cape':S(g,.36,'#d62839',0,.34,-.13,1.12,1,.5);break;
  }
  root.userData.inner=g;root.scale.setScalar(1.15);
  return root;
}

// =========================================================
// Construction de la scène
// =========================================================
function createEngine(){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.className='house-canvas';
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#bfe3f5');
  scene.fog=new THREE.Fog('#bfe3f5',70,150);
  const camera=new THREE.PerspectiveCamera(32,1,.1,400);
  scene.add(new THREE.HemisphereLight('#ffffff','#7fae6a',1.5));
  const sun=new THREE.DirectionalLight('#fff3df',2.4);
  sun.position.set(CENTER.x-12,32,CENTER.z+14);sun.target.position.copy(CENTER);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:90});sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;
  scene.add(sun,sun.target);
  const controls=new OrbitControls(camera,renderer.domElement);
  Object.assign(controls,{zoomToCursor:true,enableDamping:true,dampingFactor:.08,minDistance:9,maxDistance:58,minPolarAngle:.42,maxPolarAngle:1.18,screenSpacePanning:false,rotateSpeed:.7,zoomSpeed:.9});
  controls.target.copy(CENTER);
  const E={renderer,scene,camera,controls,sun,groups:{},walls:[],labels:[],raf:0,running:false,clock:new THREE.Clock(),
    raycaster:new THREE.Raycaster(),pointer:new THREE.Vector2(),plane:new THREE.Plane(new THREE.Vector3(0,1,0),-FLOOR_Y),tween:null,
    decorate:false,armed:null,armRot:0,ghost:null,moving:null,selected:null,bubble:null,camDirty:true};
  ['static','rooms','items','char','grid','fx'].forEach(k=>{E.groups[k]=new THREE.Group();scene.add(E.groups[k]);});
  buildStatic(E);
  resetCam(E,true);
  return E;
}

function buildStatic(E){
  const g=E.groups.static;
  const grass=new THREE.Mesh(new THREE.PlaneGeometry(400,400),mat('#8ccc6e'));grass.rotation.x=-Math.PI/2;grass.position.set(CENTER.x,-.02,CENTER.z);grass.receiveShadow=true;g.add(grass);
  const lawn=new THREE.Mesh(new THREE.PlaneGeometry(PLOT.x1-PLOT.x0,PLOT.z1-PLOT.z0),mat('#9ad47a'));lawn.rotation.x=-Math.PI/2;lawn.position.set((PLOT.x0+PLOT.x1)/2,-.01,(PLOT.z0+PLOT.z1)/2);lawn.receiveShadow=true;g.add(lawn);
  // Allée
  B(g,2,.03,PLOT.z1-17,'#e2d6c1',4.5,-.01,(17+PLOT.z1)/2);
  // Clôture (piquets instanciés)
  const posts=[];
  const edge=(x0,z0,x1,z1)=>{const n=Math.round(Math.hypot(x1-x0,z1-z0)/1.2);for(let i=0;i<=n;i++)posts.push([x0+(x1-x0)*i/n,z0+(z1-z0)*i/n]);
    const len=Math.hypot(x1-x0,z1-z0),ang=Math.atan2(z1-z0,x1-x0);[.35,.7].forEach(y=>{const r=add(g,gBox(len,.06,.05),mat('#ffffff'),(x0+x1)/2,y,(z0+z1)/2);r.rotation.y=-ang;});};
  edge(PLOT.x0,PLOT.z0,PLOT.x1,PLOT.z0);edge(PLOT.x1,PLOT.z0,PLOT.x1,PLOT.z1);edge(PLOT.x0,PLOT.z0,PLOT.x0,PLOT.z1);
  edge(PLOT.x0,PLOT.z1,3.3,PLOT.z1);edge(5.7,PLOT.z1,PLOT.x1,PLOT.z1);
  const pm=new THREE.InstancedMesh(gBox(.1,.9,.1),mat('#ffffff'),posts.length);const m4=new THREE.Matrix4();
  posts.forEach(([x,z],i)=>{m4.makeTranslation(x,.45,z);pm.setMatrixAt(i,m4);});pm.castShadow=true;g.add(pm);
  // Arbres et buissons autour du terrain
  const r=rnd(42);
  for(let i=0;i<34;i++){
    const a=r()*Math.PI*2,rad=24+r()*22,x=CENTER.x+Math.cos(a)*rad*1.15,z=CENTER.z+Math.sin(a)*rad;
    if(x>PLOT.x0-2&&x<PLOT.x1+2&&z>PLOT.z0-2&&z<PLOT.z1+2)continue;
    const t=new THREE.Group();const s=.9+r()*.9;
    C(t,.16,.24,1.4,'#8b5a2b',0,0,0,7);add(t,gIco(1.1,1),mat(r()<.5?'#4f9e45':'#5fae4f',{flatShading:true}),0,2.2,0);
    if(r()<.6)add(t,gIco(.75,1),mat('#67b957',{flatShading:true}),.4,2.9,.2);
    t.scale.setScalar(s);t.position.set(x,0,z);g.add(t);
  }
  for(let x=PLOT.x0+1;x<PLOT.x1;x+=1.6){const b=add(g,gIco(.55+r()*.25,1),mat('#4c9a43',{flatShading:true}),x,.4,PLOT.z0-.9);b.scale.y=.8;}
}

function indoorUnlockedAt(cx,cz){
  return O.rooms.some(r=>r.indoor&&r.level<=O.level&&cx>=r.x&&cx<r.x+r.w&&cz>=r.z&&cz<r.z+r.d);
}
function insideAnyRoom(cx,cz){return O.rooms.some(r=>cx>=r.x&&cx<r.x+r.w&&cz>=r.z&&cz<r.z+r.d);}

function buildRooms(E){
  const g=E.groups.rooms;clearGroup(g);E.walls=[];
  O.rooms.forEach(r=>{
    const unlocked=r.level<=O.level;
    const cx=r.x+r.w/2,cz=r.z+r.d/2;
    if(!unlocked){
      B(g,r.w-.04,.07,r.d-.04,mat('#cdc8c0',{roughness:.95}),cx,0,cz);
      const pts=[r.x+.08,r.z+.08,r.x+r.w-.08,r.z+.08,r.x+r.w-.08,r.z+r.d-.08,r.x+.08,r.z+r.d-.08];
      const pos=[];for(let i=0;i<4;i++){const a=i*2,b=((i+1)%4)*2;pos.push(pts[a],.09,pts[a+1],pts[b],.09,pts[b+1]);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#e7b416'})));
      [[r.x,r.z],[r.x+r.w,r.z],[r.x,r.z+r.d],[r.x+r.w,r.z+r.d]].forEach(([x,z])=>B(g,.08,.5,.08,'#d64545',x+(x===r.x?.12:-.12),0,z+(z===r.z?.12:-.12)));
      return;
    }
    const tex=floorTex(r.id).clone();tex.needsUpdate=true;tex.repeat.set(r.w/3,r.d/3);
    const fm=new THREE.MeshStandardMaterial({map:tex,roughness:r.indoor?.7:.9});
    B(g,r.w,FLOOR_Y,r.d,fm,cx,0,cz);
    if(r.id==='piscine'){
      const p=O.pool;B(g,p.w+.3,.04,p.d+.3,'#d8ccb4',p.x+p.w/2,FLOOR_Y,p.z+p.d/2);
      const water=new THREE.Mesh(new THREE.BoxGeometry(p.w,.06,p.d),mat('#46bfe8',{roughness:.12,emissive:'#126d93',emissiveIntensity:.35,transparent:true,opacity:.92}));
      water.position.set(p.x+p.w/2,FLOOR_Y+.01,p.z+p.d/2);g.add(water);E.water=water;
    }
    if(r.id==='jardin'){[[r.x,r.z+r.d-.15,r.w,.3],[r.x,r.z,r.w,.3]].forEach(([x,z,w,d])=>B(g,w,.18,d,'#d9cbb5',x+w/2,0,z+d/2));}
    if(!r.indoor)return;
    // Murs : côté par côté, en segments selon le voisin (pièce débloquée = muret bas)
    const sides=[
      {n:[0,-1],len:r.w,at:i=>[r.x+i+.5,r.z-.5],pos:(a,b)=>[r.x+(a+b)/2,r.z+WALL_T/2],rotY:0},
      {n:[0,1],len:r.w,at:i=>[r.x+i+.5,r.z+r.d+.5],pos:(a,b)=>[r.x+(a+b)/2,r.z+r.d-WALL_T/2],rotY:0},
      {n:[-1,0],len:r.d,at:i=>[r.x-.5,r.z+i+.5],pos:(a,b)=>[r.x+WALL_T/2,r.z+(a+b)/2],rotY:Math.PI/2},
      {n:[1,0],len:r.d,at:i=>[r.x+r.w+.5,r.z+i+.5],pos:(a,b)=>[r.x+r.w-WALL_T/2,r.z+(a+b)/2],rotY:Math.PI/2}
    ];
    sides.forEach(sd=>{
      let i=0;
      while(i<sd.len){
        const [nx,nz]=sd.at(i);const inner=indoorUnlockedAt(Math.floor(nx),Math.floor(nz));
        let j=i+1;while(j<sd.len){const [mx,mz]=sd.at(j);if(indoorUnlockedAt(Math.floor(mx),Math.floor(mz))!==inner)break;j++;}
        const [px,pz]=sd.pos(i,j),len=j-i;
        const outer=!inner&&!insideAnyRoom(Math.floor(nx),Math.floor(nz));
        addWall(E,g,px,pz,len,sd.rotY,sd.n,inner?'in':'full',outer);
        i=j;
      }
    });
  });
  E.camDirty=true;
}
function addWall(E,g,x,z,len,rotY,n,kind,windows){
  const w=new THREE.Group();w.position.set(x,FLOOR_Y,z);w.rotation.y=rotY;g.add(w);
  const wallM=mat('#f3ede3'),capM=mat('#d9cfc0');
  if(kind==='in'){B(w,len,WALL_IN,WALL_T,wallM,0,0,0);B(w,len,.04,WALL_T+.02,capM,0,WALL_IN,0);return;}
  const full=new THREE.Group(),low=new THREE.Group();w.add(full,low);
  B(full,len,WALL_H,WALL_T,wallM,0,0,0);B(full,len,.05,WALL_T+.03,capM,0,WALL_H,0);
  B(full,len,.12,WALL_T+.03,mat('#c9b9a3'),0,0,0);
  if(windows&&len>=3){
    const nWin=len>=6?2:1;
    for(let k=0;k<nWin;k++){
      const wx=nWin===1?0:(k===0?-len/4:len/4);
      B(full,1.3,1.0,WALL_T+.04,mat('#ffffff'),wx,1.0,0);
      B(full,1.16,.86,WALL_T+.06,mat('#a9dcf3',{roughness:.1,metalness:.1,emissive:'#5aa9d6',emissiveIntensity:.15}),wx,1.07,0);
      B(full,.04,.86,WALL_T+.07,mat('#ffffff'),wx,1.07,0);B(full,1.16,.04,WALL_T+.07,mat('#ffffff'),wx,1.48,0);
      B(full,1.4,.06,WALL_T+.16,mat('#ffffff'),wx,.96,0);
    }
  }
  B(low,len,WALL_LOW,WALL_T,wallM,0,0,0);B(low,len,.03,WALL_T+.02,capM,0,WALL_LOW,0);
  low.visible=false;
  E.walls.push({full,low,center:new THREE.Vector3(x,1,z),normal:new THREE.Vector3(n[0],0,n[1])});
}
function updateCutaway(E){
  const cam=E.camera.position;
  E.walls.forEach(w=>{
    const facing=(cam.x-w.center.x)*w.normal.x+(cam.z-w.center.z)*w.normal.z>0;
    w.full.visible=!facing;w.low.visible=facing;
  });
}

function itemDims(it){const f=O.furniture.find(x=>x.id===it.type)||{w:1,d:1};const r=(it.rot||0)%2;return {w:r?f.d:f.w,d:r?f.w:f.d,f};}
function placeMesh(m,it){const {w,d}=itemDims(it);m.position.set(it.x+w/2,FLOOR_Y,it.z+d/2);m.rotation.y=-(it.rot||0)*Math.PI/2;}
function buildItems(E){
  const g=E.groups.items;clearGroup(g);E.itemMeshes=new Map();
  (O.items||[]).forEach(it=>{
    if(!O.furniture.some(f=>f.id===it.type))return;
    const m=buildItem(it.type);placeMesh(m,it);m.userData.uid=it.uid;g.add(m);E.itemMeshes.set(it.uid,m);
  });
  E.occ=computeOcc();
}
function computeOcc(){
  const occ=new Set();
  (O.items||[]).forEach(it=>{const {w,d,f}=itemDims(it);if(f.flat)return;for(let i=0;i<w;i++)for(let j=0;j<d;j++)occ.add((it.x+i)+','+(it.z+j));});
  if(O.pool)for(let i=0;i<O.pool.w;i++)for(let j=0;j<O.pool.d;j++)occ.add((O.pool.x+i)+','+(O.pool.z+j));
  return occ;
}

function buildGrid(E){
  const g=E.groups.grid;clearGroup(g);
  const pos=[];
  O.rooms.filter(r=>r.level<=O.level).forEach(r=>{
    for(let i=0;i<=r.w;i++)pos.push(r.x+i,FLOOR_Y+.012,r.z,r.x+i,FLOOR_Y+.012,r.z+r.d);
    for(let j=0;j<=r.d;j++)pos.push(r.x,FLOOR_Y+.012,r.z+j,r.x+r.w,FLOOR_Y+.012,r.z+j);
  });
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.45})));
  g.visible=!!(E.decorate||E.gridOn);
}

// Étiquettes HTML (pièces verrouillées + noms des pièces en mode déco)
function buildLabels(E){
  const el=O.labelsEl;if(!el)return;el.innerHTML='';E.labels=[];
  O.rooms.forEach(r=>{
    const unlocked=r.level<=O.level;
    const d=document.createElement('div');
    d.className='hl-room'+(unlocked?' hl-unlocked':'');
    d.innerHTML=unlocked?`<b>${r.name}</b>`:`<b><span class="ms">lock</span>${r.name}</b><small>Niveau ${r.level}</small>`;
    el.appendChild(d);
    E.labels.push({el:d,pos:new THREE.Vector3(r.x+r.w/2,unlocked?.4:.6,r.z+r.d/2),unlocked});
  });
  const b=document.createElement('div');b.className='hl-bubble';b.style.display='none';el.appendChild(b);E.bubble={el:b,until:0};
}
function updateLabels(E){
  const el=O.labelsEl;if(!el||!E.labels)return;
  const w=el.clientWidth,h=el.clientHeight,v=new THREE.Vector3();
  E.labels.forEach(l=>{
    if(l.unlocked&&!E.decorate){l.el.style.display='none';return;}
    v.copy(l.pos).project(E.camera);
    const vis=v.z<1&&v.x>-1.2&&v.x<1.2&&v.y>-1.2&&v.y<1.2;
    l.el.style.display=vis?'':'none';
    if(vis)l.el.style.transform=`translate(-50%,-50%) translate(${(v.x*.5+.5)*w}px,${(-v.y*.5+.5)*h}px)`;
  });
  if(E.bubble&&E.char){
    if(performance.now()>E.bubble.until){E.bubble.el.style.display='none';}
    else{v.set(E.char.position.x,E.char.position.y+1.5,E.char.position.z).project(E.camera);
      E.bubble.el.style.display='';E.bubble.el.style.transform=`translate(-50%,-100%) translate(${(v.x*.5+.5)*w}px,${(-v.y*.5+.5)*h}px)`;}
  }
}

// =========================================================
// Personnage : promenade dans la pièce
// =========================================================
function placeChar(E){
  const old=E.char;const pos=old?old.position.clone():null;
  if(old){E.groups.char.remove(old);}
  E.char=buildChar(O.char);E.groups.char.add(E.char);
  const rooms=O.rooms.filter(r=>r.level<=O.level);
  E.charRoom=rooms.find(r=>pos&&pos.x>=r.x&&pos.x<r.x+r.w&&pos.z>=r.z&&pos.z<r.z+r.d)||rooms[0];
  if(pos)E.char.position.copy(pos);
  else{const c=freeCell(E,E.charRoom)||{x:E.charRoom.x+E.charRoom.w/2,z:E.charRoom.z+E.charRoom.d/2};E.char.position.set(c.x,FLOOR_Y,c.z);}
  E.walk={target:null,wait:1,hop:0};
}
function freeCell(E,room){
  for(let k=0;k<30;k++){
    const cx=room.x+Math.floor(Math.random()*room.w),cz=room.z+Math.floor(Math.random()*room.d);
    if(!E.occ.has(cx+','+cz))return {x:cx+.5,z:cz+.5};
  }
  return null;
}
function pathClear(E,a,b){
  const n=Math.ceil(a.distanceTo(b)/.2);
  for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(E.occ.has(Math.floor(x)+','+Math.floor(z)))return false;}
  return true;
}
function stepChar(E,dt,t){
  const c=E.char;if(!c)return;const W=E.walk,inner=c.userData.inner;
  // Changement de pièce de temps en temps
  if(!W.target&&W.wait<=0){
    if(Math.random()<.12){const rooms=O.rooms.filter(r=>r.level<=O.level);const nr=rooms[Math.random()*rooms.length|0];const fc=freeCell(E,nr);
      if(fc&&nr!==E.charRoom){E.charRoom=nr;c.position.set(fc.x,FLOOR_Y,fc.z);W.hop=1;W.wait=2;}}
    for(let k=0;k<12&&!W.target;k++){const fc=freeCell(E,E.charRoom);if(!fc)break;const tv=new THREE.Vector3(fc.x,FLOOR_Y,fc.z);if(tv.distanceTo(c.position)>.6&&pathClear(E,c.position,tv))W.target=tv;}
    if(!W.target)W.wait=1.5;
  }
  if(W.target){
    const d=W.target.clone().sub(c.position);d.y=0;const dist=d.length();
    if(dist<.05){W.target=null;W.wait=1.2+Math.random()*3;}
    else{const sp=Math.min(dist,dt*.95);c.position.addScaledVector(d.normalize(),sp);
      const ang=Math.atan2(d.x,d.z);let da=ang-c.rotation.y;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;c.rotation.y+=da*Math.min(1,dt*8);}
    inner.position.y=Math.abs(Math.sin(t*9))*.07;inner.rotation.z=Math.sin(t*9)*.06;
  }else{
    W.wait-=dt;inner.position.y*=.85;inner.rotation.z*=.85;
    const br=1+Math.sin(t*2.4)*.02;inner.scale.set(1/br,br,1/br);
  }
  if(W.hop>0){W.hop=Math.max(0,W.hop-dt*2.2);inner.position.y=Math.sin(W.hop*Math.PI)*.45;}
}

// =========================================================
// Boucle, caméra, interactions
// =========================================================
// Vue d'ensemble centrée entre le terrain et les pièces déjà débloquées
function resetCam(E,instant){
  const open=O?O.rooms.filter(r=>r.level<=O.level):[];
  let tgt=CENTER.clone(),rad=36;
  if(open.length&&open.length<O.rooms.length){
    let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;
    open.forEach(r=>{x0=Math.min(x0,r.x);z0=Math.min(z0,r.z);x1=Math.max(x1,r.x+r.w);z1=Math.max(z1,r.z+r.d);});
    tgt.lerp(new THREE.Vector3((x0+x1)/2,0,(z0+z1)/2),.45);
    rad=30+Math.min(8,open.length*1.2);
  }
  const pos=new THREE.Vector3().setFromSpherical(new THREE.Spherical(rad,.9,.62)).add(tgt);
  if(instant){E.camera.position.copy(pos);E.controls.target.copy(tgt);E.controls.update();}
  else tweenCam(E,pos,tgt);
}
function tweenCam(E,toPos,toTarget){
  E.tween={t:0,fromP:E.camera.position.clone(),fromT:E.controls.target.clone(),toP:toPos,toT:toTarget||E.controls.target.clone()};
}
function loop(){
  if(!R||!R.running)return;
  R.raf=requestAnimationFrame(loop);
  const dt=Math.min(.05,R.clock.getDelta()),t=R.clock.elapsedTime;
  if(R.tween){const tw=R.tween;tw.t=Math.min(1,tw.t+dt/.45);const k=1-Math.pow(1-tw.t,3);
    R.camera.position.lerpVectors(tw.fromP,tw.toP,k);R.controls.target.lerpVectors(tw.fromT,tw.toT,k);if(tw.t>=1)R.tween=null;}
  R.controls.update();
  const tg=R.controls.target;tg.x=Math.max(PLOT.x0,Math.min(PLOT.x1,tg.x));tg.z=Math.max(PLOT.z0,Math.min(PLOT.z1,tg.z));tg.y=0;
  stepChar(R,dt,t);
  if(R.water)R.water.material.emissiveIntensity=.3+Math.sin(t*1.5)*.06;
  updateCutaway(R);updateLabels(R);
  R.renderer.render(R.scene,R.camera);
}
function resize(){
  if(!R||!O||!R.container)return;
  const w=R.container.clientWidth,h=R.container.clientHeight;if(!w||!h)return;
  R.renderer.setSize(w,h,false);R.camera.aspect=w/h;R.camera.updateProjectionMatrix();
}

function setPointer(e){const r=R.renderer.domElement.getBoundingClientRect();R.pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);R.raycaster.setFromCamera(R.pointer,R.camera);}
function cellAtPointer(){const p=new THREE.Vector3();return R.raycaster.ray.intersectPlane(R.plane,p)?p:null;}
function dropGhost(){if(!R.ghost)return;R.groups.fx.remove(R.ghost);R.ghost.traverse(o=>{if(o.isMesh)o.material.dispose();});R.ghost=null;}
function ghostFor(type,rot){
  dropGhost();
  const g=buildItem(type);
  g.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.6;o.material.depthWrite=false;o.castShadow=false;o.userData.base=o.material.color.clone();}});
  R.ghost=g;R.ghostRot=rot||0;g.visible=false;R.groups.fx.add(g);
}
function tintGhost(ok){R.ghost.traverse(o=>{if(o.isMesh){o.material.color.copy(o.userData.base).lerp(new THREE.Color(ok?'#3ddc84':'#ff4d4d'),.55);}});}
function armedItemAt(p){
  const f=O.furniture.find(x=>x.id===R.armed);const rot=R.armRot;const w=rot%2?f.d:f.w,d=rot%2?f.w:f.d;
  return {uid:R.moving?R.moving.uid:Math.random().toString(36).slice(2,10),type:R.armed,rot,x:Math.floor(p.x)-Math.floor((w-1)/2),z:Math.floor(p.z)-Math.floor((d-1)/2)};
}
function onMove(e){
  if(!R.decorate||!R.armed||!R.ghost)return;
  setPointer(e);const p=cellAtPointer();if(!p){R.ghost.visible=false;return;}
  const it=armedItemAt(p);placeMesh(R.ghost,it);R.ghost.visible=true;tintGhost(O.fits(O.items,it,it.uid));R.lastGhost=it;
}
let _down=null;
function onDown(e){_down={x:e.clientX,y:e.clientY,t:performance.now()};}
function onUp(e){
  if(!_down)return;const moved=Math.hypot(e.clientX-_down.x,e.clientY-_down.y);_down=null;
  if(moved>6)return;
  setPointer(e);
  // Clic sur le personnage
  if(R.char){const hit=R.raycaster.intersectObject(R.char,true)[0];if(hit&&!R.armed){R.walk.hop=1;O.onCharClick&&O.onCharClick();return;}}
  if(O.readOnly||!R.decorate)return;
  if(R.armed){
    const p=cellAtPointer();if(!p)return;
    const it=armedItemAt(p);
    if(!O.fits(O.items,it,it.uid)){flashGhost();return;}
    const items=O.items.filter(x=>!R.moving||x.uid!==R.moving.uid).concat([it]);
    commitItems(items);
    if(R.moving){R.moving=null;disarm();select(it.uid);}
    else{onMove(e);}
    return;
  }
  // Sélection d'un meuble existant
  const hits=R.raycaster.intersectObjects(R.groups.items.children,true);
  if(hits.length){let o=hits[0].object;while(o&&!o.userData.uid)o=o.parent;select(o?o.userData.uid:null);}
  else select(null);
}
function flashGhost(){if(!R.ghost)return;R.ghost.scale.setScalar(1.06);setTimeout(()=>R.ghost&&R.ghost.scale.setScalar(1),140);}
function onKey(e){
  if(!R||!R.running||!R.decorate||/input|textarea|select/i.test((e.target.tagName||'')))return;
  if(e.key==='r'||e.key==='R'){rotateSelected();e.preventDefault();}
  if(e.key==='Escape'){if(R.armed)disarm();else select(null);}
  if((e.key==='Delete'||e.key==='Backspace')&&R.selected){deleteSelected();e.preventDefault();}
}
function commitItems(items){
  O.items=items;buildItems(R);if(R.selected)highlight(R.selected);
  O.onItemsChange&&O.onItemsChange(items);
}
function highlight(uid){
  R.itemMeshes&&R.itemMeshes.forEach((m,u)=>m.traverse(o=>{if(o.isMesh&&o.userData.sel){o.material=o.userData.sel;delete o.userData.sel;}}));
  const m=uid&&R.itemMeshes?R.itemMeshes.get(uid):null;
  if(m)m.traverse(o=>{if(o.isMesh){o.userData.sel=o.material;const c=o.material.clone();c.emissive=new THREE.Color('#ffb703');c.emissiveIntensity=.35;o.material=c;}});
}

// =========================================================
// API publique
// =========================================================
function mount(container,opts){
  O=Object.assign({},opts);
  if(!R)R=createEngine();
  R.container=container;
  container.appendChild(R.renderer.domElement);
  const cv=R.renderer.domElement;
  cv.addEventListener('pointermove',onMove);cv.addEventListener('pointerdown',onDown);cv.addEventListener('pointerup',onUp);
  window.addEventListener('keydown',onKey);
  R.ro=new ResizeObserver(resize);R.ro.observe(container);
  const first=!R.mountedOnce;R.mountedOnce=true;
  rebuildAll();resize();if(first)resetCam(R,true);
  R.running=true;R.clock.getDelta();loop();
}
function unmount(){
  if(!R)return;
  R.running=false;cancelAnimationFrame(R.raf);
  const cv=R.renderer.domElement;
  cv.removeEventListener('pointermove',onMove);cv.removeEventListener('pointerdown',onDown);cv.removeEventListener('pointerup',onUp);
  window.removeEventListener('keydown',onKey);
  if(R.ro){R.ro.disconnect();R.ro=null;}
  if(cv.parentNode)cv.parentNode.removeChild(cv);
  disarm();select(null);
}
function update(opts){
  const prev=O;O=Object.assign({},O,opts);
  if(!R)return;
  const levelChanged=!prev||prev.level!==O.level||prev.readOnly!==O.readOnly;
  if(levelChanged||opts.rooms){buildRooms(R);buildGrid(R);buildLabels(R);}
  if(levelChanged||opts.items)buildItems(R);
  if(levelChanged||opts.char)placeChar(R);
  if(opts.readOnly!=null&&prev&&prev.readOnly!==O.readOnly)resetCam(R,false);
}
function rebuildAll(){buildRooms(R);buildItems(R);buildGrid(R);buildLabels(R);placeChar(R);}
function setDecorate(on){
  if(!R)return;R.decorate=!!on;R.groups.grid.visible=R.decorate||!!R.gridOn;
  if(!on){disarm();select(null);}
}
function arm(type){
  if(!R)return;select(null);
  if(R.moving)cancelMove();
  R.armed=type;R.armRot=0;ghostFor(type,0);
}
function disarm(){
  if(!R)return;
  if(R.moving)cancelMove();
  R.armed=null;dropGhost();
  O&&O.onArmEnd&&O.onArmEnd();
}
function cancelMove(){const m=R.moving;R.moving=null;if(m&&!O.items.some(x=>x.uid===m.uid))commitItems(O.items.concat([m]));}
function armedType(){return R?R.armed:null;}
function select(uid){
  if(!R)return;R.selected=uid||null;highlight(R.selected);
  const it=uid?O.items.find(x=>x.uid===uid):null;
  O&&O.onSelect&&O.onSelect(it?{uid:it.uid,type:it.type}:null);
}
function rotateSelected(){
  if(!R)return;
  if(R.armed){R.armRot=(R.armRot+1)%4;if(R.lastGhost){const it=Object.assign({},R.lastGhost,{rot:R.armRot});placeMesh(R.ghost,it);tintGhost(O.fits(O.items,it,it.uid));}return;}
  const it=O.items.find(x=>x.uid===R.selected);if(!it)return;
  const nx=Object.assign({},it,{rot:((it.rot||0)+1)%4});
  if(!O.fits(O.items,nx,it.uid)){const m=R.itemMeshes.get(it.uid);if(m){m.position.y+=.15;setTimeout(()=>m.position.y-=.15,150);}return;}
  commitItems(O.items.map(x=>x.uid===it.uid?nx:x));
}
function moveSelected(){
  if(!R)return;const it=O.items.find(x=>x.uid===R.selected);if(!it)return;
  select(null);
  O.items=O.items.filter(x=>x.uid!==it.uid);buildItems(R);
  R.moving=it;R.armed=it.type;R.armRot=it.rot||0;ghostFor(it.type,R.armRot);
}
function deleteSelected(){
  if(!R)return;const uid=R.selected;if(!uid)return;
  select(null);commitItems(O.items.filter(x=>x.uid!==uid));
}
function cam(a){
  if(!R)return;
  const off=R.camera.position.clone().sub(R.controls.target);
  if(a==='left'||a==='right'){off.applyAxisAngle(new THREE.Vector3(0,1,0),(a==='left'?1:-1)*Math.PI/4);tweenCam(R,R.controls.target.clone().add(off),R.controls.target.clone());}
  if(a==='in'||a==='out'){
    const L=Math.max(R.controls.minDistance,Math.min(R.controls.maxDistance,off.length()*(a==='in'?.75:1.33)));off.setLength(L);
    // En zoomant, on se rapproche des pièces débloquées
    const tgt=R.controls.target.clone();
    if(a==='in'){const open=O.rooms.filter(r=>r.level<=O.level);if(open.length){const c=new THREE.Vector3();open.forEach(r=>c.add(new THREE.Vector3(r.x+r.w/2,0,r.z+r.d/2)));c.divideScalar(open.length);tgt.lerp(c,.35);}}
    tweenCam(R,tgt.clone().add(off),tgt);
  }
  if(a==='home')resetCam(R,false);
}
function setGrid(on){if(!R)return;R.gridOn=!!on;R.groups.grid.visible=R.decorate||R.gridOn;}
function say(text){
  if(!R||!R.bubble)return;R.bubble.el.textContent=text;R.bubble.until=performance.now()+3800;
}

function disposeTree(c){
  c.traverse(o=>{
    if(o.geometry&&!_cachedGeo.has(o.geometry))o.geometry.dispose();
    const ms=Array.isArray(o.material)?o.material:(o.material?[o.material]:[]);
    ms.forEach(m=>{if(!_cachedMat.has(m)){if(m.map)m.map.dispose();m.dispose();}});
  });
}
function clearGroup(g){while(g.children.length)disposeTree(g.children.pop());}

// =========================================================
// Maquette pour « Ma ville » (13 nov. 2026) : la maison du joueur (pièces débloquées, murs pleins avec fenêtres,
// meubles placés, toits, personnage) dans un groupe autonome, sans moteur ni caméra.
// La ville ne doit pas libérer ces géométries / matériaux : ils sont partagés avec l'écran Maison (caches cg / mat).
// =========================================================
function buildModel(opts){
  const keep=O;O=Object.assign({},opts,{rooms:(opts.rooms||[]).filter(r=>r.level<=opts.level)});
  const E={groups:{rooms:new THREE.Group(),items:new THREE.Group()},walls:[]};
  const root=new THREE.Group(),roofs=new THREE.Group();
  try{
    buildRooms(E);buildItems(E);
    E.walls.forEach(w=>{w.full.visible=true;w.low.visible=false;});   // pas de vue en coupe dans la ville
    const rm=mat('#c8553d',{roughness:.8}),eave=mat('#a9442f',{roughness:.8});
    const roofGeo=cg('roof4',()=>{const g=new THREE.ConeGeometry(Math.SQRT1_2,1,4,1);g.rotateY(Math.PI/4);return g;});   // pyramide de base 1 × 1
    O.rooms.filter(r=>r.indoor).forEach(r=>{
      const ov=.35,w=r.w+ov*2,d=r.d+ov*2,h=Math.min(w,d)*.3;
      const m=add(roofs,roofGeo,rm,r.x+r.w/2,FLOOR_Y+WALL_H+.08+h/2,r.z+r.d/2);m.scale.set(w,h,d);
      B(roofs,w,.08,d,eave,r.x+r.w/2,FLOOR_Y+WALL_H,r.z+r.d/2);
    });
    if(opts.char){const gr=O.rooms.find(r=>!r.indoor)||O.rooms[0];if(gr){const ch=buildChar(opts.char);ch.position.set(gr.x+gr.w/2,FLOOR_Y,gr.z+gr.d/2);root.add(ch);}}
  }finally{O=keep;}
  root.add(E.groups.rooms,E.groups.items,roofs);root.userData.roofs=roofs;
  return root;
}

// =========================================================
// Vignettes 3D des meubles (catalogue du mode Décorer)
// Petit moteur séparé, fond transparent + ombre douce au sol
// =========================================================
let TH=null;const _thumbs=new Map();
function thumbEngine(){
  if(TH)return TH;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff','#c9d6c2',1.7));
  const sun=new THREE.DirectionalLight('#fff3df',2.3);sun.castShadow=true;sun.shadow.mapSize.set(512,512);sun.shadow.bias=-.0005;
  scene.add(sun,sun.target);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.ShadowMaterial({opacity:.22}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  TH={renderer,scene,sun,cam:new THREE.PerspectiveCamera(26,1,.01,100)};
  return TH;
}
function renderThumb(type,size,angle){
  const E=thumbEngine();E.renderer.setSize(size,size,false);
  const g=buildItem(type);E.scene.add(g);
  const sph=new THREE.Box3().setFromObject(g).getBoundingSphere(new THREE.Sphere());
  const r=Math.max(sph.radius,.2),dist=r/Math.sin(THREE.MathUtils.degToRad(E.cam.fov/2))*1.02;
  const a=angle==null?.72:angle;
  E.cam.position.copy(sph.center).addScaledVector(new THREE.Vector3(Math.sin(a),.78,Math.cos(a)).normalize(),dist);
  E.cam.near=dist/40;E.cam.far=dist*4;E.cam.lookAt(sph.center);E.cam.updateProjectionMatrix();
  E.sun.position.copy(sph.center).add(new THREE.Vector3(-r*1.5,r*4,r*2.5));E.sun.target.position.copy(sph.center);
  Object.assign(E.sun.shadow.camera,{left:-r*2,right:r*2,top:r*2,bottom:-r*2,near:.05,far:r*12});E.sun.shadow.camera.updateProjectionMatrix();
  E.renderer.render(E.scene,E.cam);
  const url=E.renderer.domElement.toDataURL('image/png');
  E.scene.remove(g);disposeTree(g);
  return url;
}
function thumb(type,size){size=size||128;const k=type+'|'+size;if(!_thumbs.has(k))_thumbs.set(k,renderThumb(type,size));return _thumbs.get(k);}
function thumbCached(type,size){return _thumbs.get(type+'|'+(size||128))||null;}
// Images pour un aperçu qui tourne (une par angle)
function spin(type,frames,size){
  frames=frames||12;size=size||200;const k='spin|'+type+'|'+frames+'|'+size;
  if(!_thumbs.has(k)){const out=[];for(let i=0;i<frames;i++)out.push(renderThumb(type,size,.72+i/frames*Math.PI*2));_thumbs.set(k,out);}
  return _thumbs.get(k);
}

return {mount,unmount,update,setDecorate,arm,disarm,armedType,select,rotateSelected,moveSelected,deleteSelected,cam,setGrid,say,thumb,thumbCached,spin,buildModel};
})();
