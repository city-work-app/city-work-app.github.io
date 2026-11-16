/* =========================================================
   city-game.js — « Ma ville » : jeu de construction de ville en 3D.
   Chargé à la demande par city.js. Script classique (pas un module ES)
   pour marcher aussi en file:// ; Three.js vient du CDN (comme la maison).
   Données : localStorage 'kcu_city' (+ 'kcu_city_meta', lu par city.js).
   Lien avec Kiné+ : chaque XP gagnée en révisant rapporte XP_MONEY § à la
   ville, et les monuments se débloquent avec le niveau Kiné+.
   ========================================================= */
'use strict';
window.KineCityReady=window.KineCityReady||(async function(){
const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm');
// v7 (essai) : vrais modèles 3D (Kenney City Kit, licence CC0) précalculés dans js/city-models.js ; sans ce fichier, le jeu garde ses bâtiments dessinés par le code
const KM_SRC=window.KineCityModels||await new Promise(res=>{const s=document.createElement('script');s.src='js/city-models.js?v=1';s.onload=()=>res(window.KineCityModels||null);s.onerror=()=>res(null);document.head.appendChild(s);});

// =========================================================
// Réglages
// =========================================================
const N=64,NN=N*N,CH=16,NCH=N/CH,PX=32;
const DAY_MS=1300;                // durée d'un jour à vitesse ×1 (520 ms avant le 12 nov. 2026 : trop rapide)
const SPEEDS=[0,1,2,4];
const XP_MONEY=20;                // § par XP gagnée en révisant
const START_MONEY=20000;
const KEY='kcu_city',KEY_META='kcu_city_meta';
const FH=.3;                      // hauteur d'un étage
const HWZ=32,HWX=21;              // autoroute : ligne z=32, de x=0 à x=21
const MONTHS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const LOWQ=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||Math.min(screen.width||999,screen.height||999)<700;

const ZR=1,ZC=2,ZI=3,ZO=4;
const ZONES={
  1:{k:'r',name:'Résidentiel',short:'R',col:'#45b36b',icon:'house',desc:'Des maisons puis des immeubles : tes habitants.'},
  2:{k:'c',name:'Commerces',short:'C',col:'#3b8fdc',icon:'storefront',desc:'Boutiques et magasins : emplois et courses.'},
  3:{k:'i',name:'Industrie',short:'I',col:'#e2a521',icon:'factory',desc:'Usines et entrepôts : beaucoup d’emplois, mais polluants.'},
  4:{k:'o',name:'Bureaux',short:'B',col:'#8b6fd6',icon:'domain',desc:'Des emplois sans pollution.'}
};
const OK=0,BUILD=1,ABAND=2,FIRE=3,RUIN=4;
const LOT_NAMES={1:['Maison','Petit immeuble','Immeuble','Tour d’habitation'],2:['Boutique','Magasin','Centre d’affaires','Gratte-ciel'],
  3:['Entrepôt','Usine','Complexe industriel','Complexe industriel'],4:['Bureaux','Immeuble de bureaux','Tour de bureaux','Siège social']};

// Bâtiments posables. cat : energie · eau · services · parcs · monuments
// cov : rayons de couverture (cases) ; ms : palier requis ; lvl : niveau Kiné+ requis (monuments, uniques)
const BLD=[
  {id:'wind',name:'Éolienne',cat:'energie',w:1,cost:500,upkeep:10,power:60,ms:0,icon:'wind_power',desc:'Électricité propre mais modeste.'},
  {id:'coal',name:'Centrale thermique',cat:'energie',w:3,cost:5000,upkeep:110,power:650,pol:{r:9,s:75},ms:2,icon:'factory',desc:'Beaucoup d’électricité… et beaucoup de pollution.'},
  {id:'solar',name:'Parc solaire',cat:'energie',w:3,cost:8000,upkeep:70,power:450,ms:4,icon:'solar_power',desc:'Électricité propre en grande quantité.'},
  {id:'wtower',name:'Château d’eau',cat:'energie',w:1,cost:400,upkeep:8,water:80,ms:0,icon:'water_drop',desc:'De l’eau pour quelques rues.'},
  {id:'pump',name:'Station de pompage',cat:'energie',w:2,cost:3000,upkeep:60,water:500,ms:1,needWater:true,icon:'water_pump',desc:'Pompe l’eau de la rivière : à placer au bord de l’eau.'},
  {id:'kine',name:'Cabinet de kiné',cat:'services',w:1,cost:900,upkeep:22,cov:{health:6},ms:0,icon:'accessibility_new',desc:'Soigne le quartier : plus de bonheur et de valeur foncière.'},
  {id:'school',name:'École',cat:'services',w:2,cost:2500,upkeep:65,cov:{edu:9},ms:1,icon:'school',desc:'Indispensable pour que les maisons deviennent des immeubles.'},
  {id:'police',name:'Commissariat',cat:'services',w:2,cost:2200,upkeep:60,cov:{police:10},ms:1,icon:'local_police',desc:'Sécurise le quartier.'},
  {id:'fire',name:'Caserne de pompiers',cat:'services',w:2,cost:2200,upkeep:60,cov:{fire:10},ms:1,icon:'local_fire_department',desc:'Éteint les incendies avant qu’ils ne détruisent tout.'},
  {id:'hospital',name:'Hôpital',cat:'services',w:3,cost:7000,upkeep:150,cov:{health:15},ms:3,icon:'local_hospital',desc:'Soigne une grande partie de la ville.'},
  {id:'lycee',name:'Lycée',cat:'services',w:3,cost:6500,upkeep:130,cov:{edu:7,edu2:14},ms:3,icon:'history_edu',desc:'Études longues : permet les tours et l’industrie moderne.'},
  {id:'square',name:'Square',cat:'parcs',w:1,cost:150,upkeep:3,cov:{park:4},ms:0,icon:'park',desc:'Un coin de verdure : les voisins adorent.'},
  {id:'garden',name:'Jardin public',cat:'parcs',w:2,cost:800,upkeep:12,cov:{park:7},ms:1,icon:'nature',desc:'Allées, étang et grands arbres.'},
  {id:'plaza',name:'Place et fontaine',cat:'parcs',w:2,cost:1500,upkeep:18,cov:{park:6,lv:5},ms:2,icon:'water',desc:'Une place animée qui fait grimper la valeur foncière.'},
  {id:'statue',name:'Statue du Kiné d’or',cat:'monuments',w:1,cost:1000,upkeep:5,cov:{park:6,lv:5},tour:2,lvl:3,icon:'emoji_events',desc:'Hommage aux kinés de la ville.'},
  {id:'fac',name:'Faculté de kiné',cat:'monuments',w:3,cost:9000,upkeep:120,cov:{edu:12,edu2:18},tour:3,lvl:5,icon:'school',desc:'Forme les kinés de demain : éducation sur un grand rayon.'},
  {id:'poste',name:'Bureau de poste',cat:'services',w:1,cost:800,upkeep:15,cov:{lv:3},ms:1,icon:'local_post_office',desc:'Les facteurs font leurs tournées dans les quartiers, le matin et l’après-midi.'},
  {id:'mahouse',name:'Ma maison',cat:'monuments',w:3,cost:500,upkeep:0,cov:{park:4,lv:4},tour:1,lvl:1,icon:'cottage',desc:'Ta maison de Kiné+ (tes pièces, tes meubles, ton personnage) posée dans ta ville. Elle change quand tu la décores. Zoome dessus pour voir l’intérieur.'},
  {id:'reeduc',name:'Centre de rééducation',cat:'monuments',w:3,cost:9000,upkeep:110,cov:{health:18,park:6},tour:3,lvl:8,icon:'self_improvement',desc:'Balnéo et plateau technique : santé et bonheur.'},
  {id:'pool',name:'Piscine olympique',cat:'monuments',w:3,cost:11000,upkeep:90,cov:{park:12,lv:8},tour:6,lvl:12,icon:'pool',desc:'Natation et aquagym pour toute la ville.'},
  {id:'stadium',name:'Stade',cat:'monuments',w:4,cost:16000,upkeep:150,cov:{park:20},tour:12,lvl:16,icon:'stadium',desc:'Les soirs de match, toute la ville vibre.'},
  {id:'tower',name:'Tour Kiné+',cat:'monuments',w:2,cost:25000,upkeep:100,cov:{lv:18},tour:10,lvl:20,icon:'apartment',desc:'Le gratte-ciel emblème de ta ville.'},
  {id:'chu',name:'CHU',cat:'monuments',w:4,cost:30000,upkeep:220,cov:{health:26,edu2:12},lvl:25,icon:'emergency',desc:'Le centre hospitalier universitaire.'},
  {id:'observ',name:'Observatoire',cat:'monuments',w:3,cost:20000,upkeep:90,cov:{park:16,edu2:10},tour:15,lvl:30,icon:'travel_explore',desc:'Les étoiles, pour récompenser tes révisions.'},
  {id:'arc',name:'Arc du Diplôme',cat:'monuments',w:2,cost:28000,upkeep:60,cov:{lv:25},tour:12,lvl:35,icon:'castle',desc:'Le monument des diplômés. Tu y es presque !'},
  {id:'landfill',name:'Décharge',cat:'energie',w:3,cost:2000,upkeep:40,garbage:300,pol:{r:5,s:30},ms:2,icon:'delete_sweep',desc:'Stocke les déchets de la ville. Un peu polluante.'},
  {id:'incin',name:'Incinérateur',cat:'energie',w:2,cost:6000,upkeep:90,garbage:420,power:120,pol:{r:7,s:45},ms:3,icon:'local_fire_department',desc:'Brûle les déchets et produit un peu d’électricité.'},
  {id:'recycle',name:'Centre de tri',cat:'energie',w:2,cost:5000,upkeep:70,garbage:360,ms:4,icon:'recycling',desc:'Recycle les déchets, sans pollution.'},
  {id:'mairie',name:'Mairie',cat:'services',w:2,cost:3000,upkeep:40,cov:{police:4,lv:6},ms:1,unique:true,icon:'account_balance',desc:'Le cœur de la ville : débloque les arrêtés municipaux.'},
  {id:'sante',name:'Maison de santé',cat:'services',w:2,cost:3500,upkeep:70,cov:{health:10},ms:2,icon:'medical_services',desc:'Médecins, infirmiers et kinés réunis.'},
  {id:'biblio',name:'Bibliothèque',cat:'services',w:2,cost:2000,upkeep:45,cov:{edu:7,park:3},ms:2,icon:'local_library',desc:'Le temple des révisions.'},
  {id:'gym',name:'Salle de sport',cat:'services',w:2,cost:2400,upkeep:40,cov:{health:5,park:6},ms:2,icon:'fitness_center',desc:'Renforcement musculaire : les kinés recommandent.'},
  {id:'bus',name:'Arrêt de bus',cat:'transports',w:1,cost:300,upkeep:8,cov:{transport:5},ms:1,icon:'directions_bus',desc:'Des bus desservent le quartier : valeur foncière et bonheur en hausse.'},
  {id:'metro',name:'Station de métro',cat:'transports',w:2,cost:4000,upkeep:70,cov:{transport:11},ms:3,icon:'subway',desc:'Une desserte rapide pour tout un quartier.'},
  {id:'gare',name:'Gare',cat:'transports',w:3,cost:9000,upkeep:120,cov:{transport:16},tour:8,ms:4,icon:'train',desc:'Relie la ville au pays : voyageurs et touristes.'},
  {id:'cinema',name:'Cinéma',cat:'loisirs',w:2,cost:4000,upkeep:50,cov:{park:6},tour:4,ms:3,icon:'theaters',desc:'Les séances du soir animent le quartier.'},
  {id:'marina',name:'Port de plaisance',cat:'loisirs',w:2,cost:6000,upkeep:50,cov:{park:8,lv:10},tour:8,ms:3,needWater:true,icon:'sailing',desc:'Bateaux et promenade : à placer au bord de l’eau.'},
  {id:'wheel',name:'Grande roue',cat:'loisirs',w:2,cost:7000,upkeep:60,cov:{park:9},tour:9,ms:4,icon:'attractions',desc:'Une vue imprenable sur toute la ville.'},
  {id:'musee',name:'Musée',cat:'loisirs',w:3,cost:8000,upkeep:80,cov:{park:8,lv:6},tour:10,ms:4,icon:'museum',desc:'Expositions sur l’histoire de la ville… et du corps humain.'},
  {id:'funfair',name:'Parc d’attractions',cat:'loisirs',w:4,cost:15000,upkeep:140,cov:{park:14},tour:20,ms:5,icon:'festival',desc:'Montagnes russes, manège et grande roue.'}
];
const BT={};BLD.forEach(b=>{b.d=b.w;BT[b.id]=b;});
const COV_NAMES={health:'Santé',edu:'École',edu2:'Études longues',police:'Sécurité',fire:'Pompiers',park:'Loisirs',lv:'Prestige',transport:'Transports'};

// Paliers de population : agrandissent le terrain et débloquent des bâtiments
const MS=[
  {pop:0,name:'Lieu-dit',area:24,reward:0,maxLvl:2},
  {pop:60,name:'Hameau',area:32,reward:3000,maxLvl:2},
  {pop:250,name:'Village',area:40,reward:6000,maxLvl:2},
  {pop:700,name:'Bourg',area:48,reward:10000,maxLvl:3},
  {pop:1600,name:'Petite ville',area:56,reward:15000,maxLvl:3},
  {pop:3500,name:'Ville',area:64,reward:25000,maxLvl:4},
  {pop:7000,name:'Grande ville',area:64,reward:40000,maxLvl:4},
  {pop:14000,name:'Métropole',area:64,reward:60000,maxLvl:4}
];
const MS_EXTRA={3:'Zone Bureaux et immeubles de 6 à 12 étages',5:'Gratte-ciel'};

// =========================================================
// Utilitaires
// =========================================================
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash(a){a|=0;a=Math.imul(a^a>>>16,0x45d9f3b);a=Math.imul(a^a>>>16,0x45d9f3b);return((a^a>>>16)>>>0)/4294967296;}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
function fmt(n){return Math.round(n).toLocaleString('fr-FR');}
function money(n){return fmt(n)+' §';}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function makeNoise(seed){
  const R=rng(seed),G=new Float32Array(256);for(let i=0;i<256;i++)G[i]=R();
  const g=(a,b)=>G[((a&15)<<4)|(b&15)],s=t=>t*t*(3-2*t);
  return function(x,y){const xi=Math.floor(x),yi=Math.floor(y),u=s(x-xi),v=s(y-yi);
    return lerp(lerp(g(xi,yi),g(xi+1,yi),u),lerp(g(xi,yi+1),g(xi+1,yi+1),u),v);};
}
function fbm(n,x,y){return n(x,y)*.55+n(x*2.1+5.3,y*2.1+1.7)*.3+n(x*4.3+9.1,y*4.3+3.3)*.15;}
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;}
function ramp(t,stops){t=clamp(t,0,1)*(stops.length-1);const k=Math.min(stops.length-2,Math.floor(t)),f=t-k;
  const a=parseInt(stops[k].slice(1),16),b=parseInt(stops[k+1].slice(1),16);
  const r=Math.round(lerp(a>>16,b>>16,f)),g=Math.round(lerp((a>>8)&255,(b>>8)&255,f)),bl=Math.round(lerp(a&255,b&255,f));
  return '#'+((1<<24)|(r<<16)|(g<<8)|bl).toString(16).slice(1);}
const RAMP_GOOD=['#d64545','#f08c3a','#f2cf3b','#7ccf5a','#2fa36b'];
function gamXP(){return(typeof gam!=='undefined'&&gam)?Math.max(0,gam.xp|0):0;}
function PO(id){return !!(S&&S.pol&&S.pol[id]);}                       // arrêté municipal actif ?
function MOD(k){let v=0;if(S&&S.mods)for(const m of S.mods)if(m.k===k&&m.u>S.day)v+=m.v;return v;}   // effets temporaires (évènements)
function garbageOn(){return !!S&&S.ms>=2;}                               // les déchets comptent à partir du palier Village
function month(){return((S.day/30)|0)%12;}
function gamLvl(){try{return typeof gamLevelFromXP==='function'?gamLevelFromXP(gamXP()):1;}catch(e){return 1;}}

// =========================================================
// État de la carte (une valeur par case)
// =========================================================
const ter=new Uint8Array(NN),tree=new Uint8Array(NN),road=new Uint8Array(NN),zone=new Uint8Array(NN),
      lvl=new Uint8Array(NN),vari=new Uint8Array(NN),st=new Uint8Array(NN),tmr=new Uint8Array(NN);
// v3 (12 nov. 2026) : rail = rails de tram sur la route · rx = carrefour (1 feux, 2 rond-point) · deco = décor posé
// hill = colline (hauteur 1 à 3) · dist = numéro du quartier (0 = aucun). Ajoutées en fin de liste : les
// anciennes sauvegardes (8 couches) restent lisibles, les nouvelles couches y valent 0.
const rail=new Uint8Array(NN),rx=new Uint8Array(NN),deco=new Uint8Array(NN),hill=new Uint8Array(NN),dist=new Uint8Array(NN);
// v4 (12 nov. 2026) : mtn = relief naturel du paysage (1 à 9 : montagne, mesa, rochers, volcan), jamais remboursé
const mtn=new Uint8Array(NN);
// v6 (13 nov. 2026) : lane = 1 piste cyclable, 2 rue piétonne (posées sur une route)
const lane=new Uint8Array(NN);
// 13 nov. 2026 : dg = liaisons de route en diagonale vers les cases voisines (bits 1 NE, 2 SE, 4 SO, 8 NO)
const dg=new Uint8Array(NN);
const LAYERS=[ter,tree,road,zone,lvl,vari,st,tmr,rail,rx,deco,hill,dist,mtn,lane,dg];
const svcAt=new Int32Array(NN);       // id du service posé sur la case (0 = aucun)
const SV=new Map();                    // id → {id,t,x,z,w,d,rot}
let S=null,NZ=null;

// Valeurs dérivées (recalculées, non sauvegardées)
const conn=new Uint8Array(NN),rdist=new Uint8Array(NN),wdist=new Uint8Array(NN),cap=new Uint16Array(NN);
const COV={health:new Uint8Array(NN),edu:new Uint8Array(NN),edu2:new Uint8Array(NN),police:new Uint8Array(NN),fire:new Uint8Array(NN),park:new Uint8Array(NN),lv:new Uint8Array(NN),transport:new Uint8Array(NN)};
const pol=new Uint8Array(NN),lval=new Uint8Array(NN),hap=new Uint8Array(NN),pw=new Uint8Array(NN),wt=new Uint8Array(NN),gb=new Uint8Array(NN);
const svcOK=new Map(),SPARE={p:0,w:0};
const D={roads:true,cov:true,util:true,pol:true,lv:true,icons:true,trees:true,lights:true};
const ST={pop:0,jc:0,ji:0,jo:0,workers:0,unemp:0,hap:60,pp:0,pu:0,wp:0,wu:0,roads:0,lots:{1:0,2:0,3:0,4:0},free:{1:0,2:0,3:0,4:0},
  aband:0,fires:0,noPow:0,noWat:0,eduAny:false,edu2Any:false,healthAny:false,pendP:0,pendW:0,gp:0,gu:0,tour:0,aves:0,noGar:0};

function defaults(){return{v:1,seed:1,name:'Kinéville',created:Date.now(),day:0,money:START_MONEY,tax:{r:9,c:9,i:9,o:9},
  xpSeen:null,grants:0,ms:0,nextId:1,cursor:0,speed:1,dem:{1:.8,2:.5,3:.6,4:-.2},tut:0,set:{dn:true,sh:!LOWQ,gfx:!LOWQ,sn:true,wx:true,snd:true,mus:false,cat:false,lbl:true,vol:.45,uiC:'',uiA:true,uiM:{},tsp:2,tl:true,asv:true,km:true,acc:true},
  hist:[],last:null,cam:null,seen:{},fires:0,pol:{},mods:[],event:null,nextEv:240,evHist:[],mis:0,quiz:{d:'',n:0},quizTot:0};}

function inArea(x,z){const a=MS[S.ms].area,o=(N-a)>>1;return x>=o&&x<o+a&&z>=o&&z<o+a;}
function inAreaI(i){return inArea(i%N,(i/N)|0);}

function genMap(seed){
  LAYERS.forEach(a=>a.fill(0));
  if(S&&S.biome&&S.biome!=='tempere'){genBiome(seed);return;}   // autres paysages (v4)
  const R=rng(seed),nz=makeNoise(seed^0x5bd1e995);
  // Rivière du nord au sud, à l'est du centre
  const cx=40.5+R()*3,w0=2.3+R()*.8,p1=R()*6.28,p2=R()*6.28;
  for(let z=0;z<N;z++){
    const xc=cx+Math.sin(z*.11+p1)*3.4+Math.sin(z*.29+p2)*1.2,w=w0+Math.sin(z*.07+p2)*.7;
    for(let x=Math.floor(xc-w);x<=Math.ceil(xc+w);x++)if(x>=0&&x<N&&Math.abs(x+.5-xc)<=w/2)ter[z*N+x]=1;
  }
  // Lac au sud-ouest
  const lx=10+R()*5,lz=50+R()*4,lr=4+R()*1.8;
  for(let z=40;z<N;z++)for(let x=0;x<30;x++){const d=Math.hypot((x+.5-lx)/1.3,z+.5-lz)+(nz(x*.3,z*.3)-.5)*2.2;if(d<lr)ter[z*N+x]=1;}
  // Forêts
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){
    const i=z*N+x;if(ter[i])continue;
    const n=fbm(nz,x*.09,z*.09),near=Math.hypot(x-27,z-HWZ)<8;
    if(n>.56&&!near)tree[i]=n>.68?3:n>.62?2:1;
    else if(R()<.022&&!near)tree[i]=1;
  }
  // Autoroute qui relie la ville au reste du monde
  for(let x=0;x<=HWX;x++){const i=HWZ*N+x;ter[i]=0;tree[i]=0;road[i]=2;}
}

// Caractéristiques d'un bâtiment de zone : étages (f) et capacité (habitants ou emplois)
function lotSpec(z,l,v){
  const r=hash(v*31+l*7+z*131+1);let f=1,c=0;
  if(z===ZR){f=l===1?(r<.45?1:2):l===2?3+(r*3|0):l===3?6+(r*7|0):13+(r*10|0);c=l===1?f*3+1:l===2?f*4:f*5;}
  else if(z===ZC){f=l===1?(r<.6?1:2):l===2?3+(r*3|0):l===3?7+(r*7|0):15+(r*16|0);c=l===1?3+f*2:l===2?f*3:f*4;}
  else if(z===ZO){f=l===1?2+(r*2|0):l===2?4+(r*3|0):l===3?8+(r*7|0):16+(r*17|0);c=l===1?f*4:l===2?f*5:f*6;}
  else{f=Math.min(3,l);c=f===1?8:f===2?16:26;}
  return{f,cap:c};
}
const USE_P=[0,1,1.2,1.8,1.1],USE_W=[0,1,.6,1.4,.5],USE_G=[0,.5,.6,1,.4];
let _um=[1,1,1];
function useMul(){return[PO('led')?.85:1,(PO('water')?.8:1)*(1+MOD('useW')),PO('recycle')?.7:1];}
function lotUse(i){const z=zone[i],c=cap[i];return[Math.ceil(c*USE_P[z]*_um[0]),Math.ceil(c*USE_W[z]*_um[1]),Math.ceil(c*USE_G[z]*_um[2])];}
function svcUse(b){const a=b.w*b.w;if(b.garbage)return[b.power?0:a*2,a,0];if(b.power)return[0,a,a];if(b.water)return[a*3,0,a];if(b.cat==='parcs')return[a,a*2,a];return[a*2,a,a];}

// =========================================================
// Sauvegarde
// =========================================================
function b64enc(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
function b64dec(str){const s=atob(str),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
let _lastSave=0;
function save(){
  if(!S||VISIT)return;   // pendant la visite de la ville d'un ami, on ne sauvegarde jamais
  tlMaybeSnap();
  if(E&&E.cam)S.cam={x:+CAM.x.toFixed(2),z:+CAM.z.toFixed(2),dist:+CAM.dist.toFixed(2),yaw:+CAM.yaw.toFixed(3),pitch:+CAM.pitch.toFixed(3)};
  const buf=new Uint8Array(NN*LAYERS.length);LAYERS.forEach((a,k)=>buf.set(a,k*NN));
  const o=Object.assign({},S,{map:b64enc(buf),svc:[...SV.values()].map(s=>[s.id,s.t,s.x,s.z,s.rot|0])});
  try{
    localStorage.setItem(KEY,JSON.stringify(o));
    localStorage.setItem(KEY_META,JSON.stringify({xpSeen:S.xpSeen,name:S.name,pop:ST.pop,ms:S.ms}));
  }catch(e){console.warn('[city] sauvegarde impossible',e);toastOnce('save','warning','Sauvegarde impossible : la mémoire du navigateur est pleine.',600);}
  _lastSave=performance.now();
}
function load(){
  let o=null;try{o=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){o=null;}
  SV.clear();svcAt.fill(0);
  if(!o||!o.map){S=defaults();S.seed=(Math.random()*1e9)|0;S.biome=BIOME_IDS[(Math.random()*BIOME_IDS.length)|0];extLoadFix();applyProf();NZ=makeNoise(S.seed);genMap(S.seed);return true;}   // nouvelle ville : paysage tiré au hasard
  S=Object.assign(defaults(),o);delete S.map;delete S.svc;
  S.tax=Object.assign({r:9,c:9,i:9,o:9},S.tax||{});S.set=Object.assign(defaults().set,S.set||{});S.dem=Object.assign(defaults().dem,S.dem||{});
  if(!Array.isArray(S.hist))S.hist=[];if(!S.seen)S.seen={};
  if(!S.pol||typeof S.pol!=='object')S.pol={};if(!Array.isArray(S.mods))S.mods=[];if(!Array.isArray(S.evHist))S.evHist=[];if(!S.quiz)S.quiz={d:'',n:0};
  S.ms=clamp(S.ms|0,0,MS.length-1);
  if(!BIOMES[S.biome])S.biome='tempere';applyProf();   // anciennes villes : vallée verte
  extLoadFix();if(S.flood&&Array.isArray(S.flood.tiles))S.flood.set=new Set(S.flood.tiles);else S.flood=null;
  NZ=makeNoise(S.seed);
  try{const buf=b64dec(o.map);LAYERS.forEach((a,k)=>{a.fill(0);a.set(buf.subarray(k*NN,(k+1)*NN));});}
  catch(e){console.warn('[city] carte illisible, nouvelle carte',e);genMap(S.seed);}
  (o.svc||[]).forEach(a=>{if(Array.isArray(a)&&BT[a[1]])addSvc({id:a[0],t:a[1],x:a[2],z:a[3],rot:a[4]},true);});
  return false;
}
function initDerived(){
  ovpIndex();
  for(let i=0;i<NN;i++){
    cap[i]=(lvl[i]&&zone[i]&&(st[i]===OK||st[i]===FIRE))?lotSpec(zone[i],lvl[i],vari[i]).cap:0;
    if(lvl[i]&&!zone[i])lvl[i]=0;
  }
  // distance à l'eau (vue sur l'eau = valeur foncière)
  wdist.fill(255);const q=[];
  for(let i=0;i<NN;i++)if(ter[i]){wdist[i]=0;q.push(i);}
  for(let h=0;h<q.length;h++){const i=q[h],d=wdist[i];if(d>=4)continue;const x=i%N;
    for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&wdist[j]>d+1){wdist[j]=d+1;q.push(j);}}
  Object.keys(D).forEach(k=>D[k]=true);
  recomputeRoads();recomputeCoverage();recomputePollution();recomputeLV();recomputeUtilities();
  for(let i=0;i<NN;i++)if(zone[i]===ZR&&lvl[i])hap[i]=lotHappiness(i);
  computeStats();
  D.roads=D.cov=D.pol=D.lv=D.util=false;
}

// =========================================================
// Services (bâtiments posés)
// =========================================================
function addSvc(s,raw){
  const b=BT[s.t];s.w=b.w;s.d=b.d;s.rot=s.rot|0;
  if(!s.id)s.id=S.nextId++;else S.nextId=Math.max(S.nextId,s.id+1);
  SV.set(s.id,s);
  for(let z=s.z;z<s.z+s.d;z++)for(let x=s.x;x<s.x+s.w;x++)if(x>=0&&z>=0&&x<N&&z<N)svcAt[z*N+x]=s.id;
  if(!raw){touchSvc(s);D.roads=true;D.cov=D.util=D.lv=true;if(b.pol)D.pol=true;if(b.trophy)S.trophies=Math.max(0,(S.trophies|0)-1);}
  return s;
}
function removeSvc(id){
  const s=SV.get(id);if(!s)return null;
  SV.delete(id);
  for(let z=s.z;z<s.z+s.d;z++)for(let x=s.x;x<s.x+s.w;x++)if(svcAt[z*N+x]===id)svcAt[z*N+x]=0;
  touchSvc(s);D.roads=true;D.cov=D.util=D.lv=true;if(BT[s.t].pol)D.pol=true;if(BT[s.t].trophy)S.trophies=(S.trophies|0)+1;
  if(S.mlines)S.mlines=S.mlines.filter(l=>l[0]!==id&&l[1]!==id);   // une station démolie coupe ses lignes de métro
  return s;
}
function svcCount(t){let n=0;for(const s of SV.values())if(s.t===t)n++;return n;}
function svcHasRoad(s){
  for(let x=s.x-1;x<=s.x+s.w;x++)for(let z=s.z-1;z<=s.z+s.d;z++){
    if(x>=s.x&&x<s.x+s.w&&z>=s.z&&z<s.z+s.d)continue;
    if((x===s.x-1||x===s.x+s.w)&&(z===s.z-1||z===s.z+s.d))continue;
    if(x<0||z<0||x>=N||z>=N)continue;if(conn[z*N+x])return true;
  }
  return false;
}
function svcTouchesRoad(x0,z0,w,d){
  for(let x=x0;x<x0+w;x++){if(z0>0&&road[(z0-1)*N+x])return true;if(z0+d<N&&road[(z0+d)*N+x])return true;}
  for(let z=z0;z<z0+d;z++){if(x0>0&&road[z*N+x0-1])return true;if(x0+w<N&&road[z*N+x0+w])return true;}
  return false;
}
// Orientation d'un bâtiment de service : vers le côté qui touche une route
function svcRot(x0,z0,w,d){
  let best=0,bn=-1;
  const cnt=[0,0,0,0];
  for(let x=x0;x<x0+w;x++){if(z0+d<N&&road[(z0+d)*N+x])cnt[0]++;if(z0>0&&road[(z0-1)*N+x])cnt[2]++;}
  for(let z=z0;z<z0+d;z++){if(x0+w<N&&road[z*N+x0+w])cnt[1]++;if(x0>0&&road[z*N+x0-1])cnt[3]++;}
  cnt.forEach((n,k)=>{if(n>bn){bn=n;best=k;}});
  return best;
}

// =========================================================
// Annuler (pile d'actions)
// =========================================================
const UNDO=[];let ACT=null;
function actBegin(){ACT={t:new Map(),add:[],del:[],cost:0};}
function rec(i){if(ACT&&!ACT.t.has(i))ACT.t.set(i,LAYERS.map(a=>a[i]));}
function actEnd(cost,label){
  if(!ACT)return;ACT.cost=cost;ACT.label=label;
  if(ACT.t.size||ACT.add.length||ACT.del.length||ACT.ovs){UNDO.push(ACT);if(UNDO.length>25)UNDO.shift();}
  ACT=null;
}
function undo(){
  const a=UNDO.pop();if(!a){toast('Rien à annuler.','undo');return;}
  // Annuler une démolition reprend l'argent rendu : impossible si on l'a déjà dépensé (sinon argent infini)
  if(a.cost<0&&S.money<-a.cost){UNDO.push(a);toast(`Il te faut ${money(-a.cost)} pour annuler : l’argent rendu par la démolition est repris.`,'block');return;}
  if(a.pol)S.pol=a.pol;
  if(a.ovs){S.ovs=a.ovs;ovpChanged();}
  a.add.forEach(id=>removeSvc(id));
  a.t.forEach((v,i)=>{LAYERS.forEach((arr,k)=>arr[i]=v[k]);cap[i]=(lvl[i]&&zone[i]&&(st[i]===OK||st[i]===FIRE))?lotSpec(zone[i],lvl[i],vari[i]).cap:0;touch(i,true);});
  a.del.forEach(s=>addSvc({id:s.id,t:s.t,x:s.x,z:s.z,rot:s.rot}));
  S.money+=a.cost;
  D.roads=D.util=D.pol=D.cov=D.lv=D.trees=D.lights=D.icons=true;
  extAfterUndo();
  simRefresh();
  toast(`Annulé : ${esc(a.label||'action')}${a.cost>0?` (+${money(a.cost)})`:a.cost<0?` (−${money(-a.cost)})`:''}`,'undo');
}

// =========================================================
// Simulation
// =========================================================
function recomputeRoads(){
  ovpValidate();
  conn.fill(0);const q=[];let n=0,na=0;
  for(let i=0;i<NN;i++){if(!road[i])continue;n++;if(road[i]===3)na++;const x=i%N,z=(i/N)|0;if(x===0||z===0||x===N-1||z===N-1){conn[i]=1;q.push(i);}}
  for(let h=0;h<q.length;h++){const i=q[h],x=i%N;
    for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&road[j]&&!conn[j]){conn[j]=1;q.push(j);}
    const L=OVE.get(i);if(L)for(const e of L)if(!conn[e.to]){conn[e.to]=1;q.push(e.to);}   // v5 : pont routier
    if(dg[i])for(let d=4;d<8;d++){const j=roadNb(i,d);if(j>=0&&!conn[j]){conn[j]=1;q.push(j);}}}   /* routes en diagonale */
  rdist.fill(255);const q2=[];
  for(let i=0;i<NN;i++)if(conn[i]){rdist[i]=0;q2.push(i);}
  for(let h=0;h<q2.length;h++){const i=q2[h],d=rdist[i];if(d>=3)continue;const x=i%N;
    for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N]){
      if(j<0||j>=NN||road[j]||ter[j]||svcAt[j]||rdist[j]<=d+1)continue;rdist[j]=d+1;q2.push(j);}}
  svcOK.clear();for(const s of SV.values())svcOK.set(s.id,svcHasRoad(s)&&!svcDamaged(s.id));
  ST.roads=n;ST.aves=na;
}
function recomputeCoverage(){
  for(const k in COV)COV[k].fill(0);
  ST.eduAny=ST.edu2Any=ST.healthAny=false;
  for(const s of SV.values()){
    const b=BT[s.t];if(!b.cov||!svcOK.get(s.id))continue;
    const cx=s.x+s.w/2,cz=s.z+s.d/2;
    for(const k in b.cov){
      const r=b.cov[k]+(k==='transport'?svcCovBonus(s):0),arr=COV[k];if(k==='edu')ST.eduAny=true;if(k==='edu2')ST.edu2Any=true;if(k==='health')ST.healthAny=true;
      const x0=Math.max(0,Math.floor(cx-r)),x1=Math.min(N-1,Math.ceil(cx+r)),z0=Math.max(0,Math.floor(cz-r)),z1=Math.min(N-1,Math.ceil(cz+r));
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
        const d=Math.hypot(x+.5-cx,z+.5-cz);if(d>r)continue;
        const v=Math.round(100-60*d/r),i=z*N+x;if(v>arr[i])arr[i]=v;
      }
    }
  }
  extCoverage();
}
function recomputePollution(){
  const acc=new Float32Array(NN),gk=PO('green')?.65:1;
  const stamp=(cx,cz,r,s)=>{const x0=Math.max(0,Math.floor(cx-r)),x1=Math.min(N-1,Math.ceil(cx+r)),z0=Math.max(0,Math.floor(cz-r)),z1=Math.min(N-1,Math.ceil(cz+r));
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x+.5-cx,z+.5-cz);if(d<r)acc[z*N+x]+=s*(1-d/r);}};
  for(let i=0;i<NN;i++)if(zone[i]===ZI&&lvl[i]&&st[i]!==ABAND&&st[i]!==RUIN)stamp(i%N+.5,((i/N)|0)+.5,3+lvl[i],(12+lvl[i]*8)*gk*distPolK(i));
  extPollution(stamp);
  for(const s of SV.values()){const b=BT[s.t];if(b.pol)stamp(s.x+s.w/2,s.z+s.d/2,b.pol.r,b.pol.s);}
  for(let i=0;i<NN;i++)pol[i]=clamp(Math.round(acc[i]-tree[i]*8),0,100);
}
function nearAve(i){const x=i%N,z=(i/N)|0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Z=z+dz;if(X>=0&&Z>=0&&X<N&&Z<N&&road[Z*N+X]===3)return true;}return false;}
function recomputeLV(){
  const z30=PO('zone30'),gOn=garbageOn(),bonus=MOD('lv');
  for(let i=0;i<NN;i++){
    if(ter[i]){lval[i]=0;continue;}
    let v=20+COV.park[i]*.25+COV.health[i]*.08+COV.police[i]*.07+COV.edu[i]*.07+COV.fire[i]*.04+COV.lv[i]*.3+COV.transport[i]*.12+bonus;
    if(wdist[i]<=3)v+=12-wdist[i]*3;
    if(nearAve(i))v+=8;
    if(z30&&zone[i]===ZR)v+=3;
    if(gOn&&lvl[i]&&cap[i]&&!gb[i])v-=8;
    v-=pol[i]*.6;v+=extLV(i);
    lval[i]=clamp(Math.round(v),0,100);
  }
}
function recomputeUtilities(){
  _um=useMul();
  const pw0=E?pw.slice():null,wt0=E?wt.slice():null;   /* v10 : pour éteindre / rallumer les quartiers qui changent */
  pw.fill(0);wt.fill(0);gb.fill(0);
  const P=[],W=[],Gs=[],su=[0,0,0];let pp=0,wp=0,gp=0;
  for(const s of SV.values()){
    const b=BT[s.t],ok=svcOK.get(s.id),c=[s.x+s.w/2,s.z+s.d/2];
    if(ok&&b.power){P.push(c[0],c[1]);pp+=b.power;}
    if(ok&&b.water){W.push(c[0],c[1]);wp+=b.water;}
    if(ok&&b.garbage){Gs.push(c[0],c[1]);gp+=b.garbage;}
    const u=svcUse(b);su[0]+=u[0];su[1]+=u[1];su[2]+=u[2];
  }
  gp=Math.round(gp*Math.max(0,1+MOD('gar')));
  const list=[];
  for(let i=0;i<NN;i++)if(lvl[i]&&cap[i]&&st[i]!==ABAND&&st[i]!==RUIN)list.push(i);
  const U=list.map(i=>lotUse(i));
  ST.pp=pp;ST.wp=wp;ST.gp=gp;ST.pu=su[0];ST.wu=su[1];ST.gu=garbageOn()?su[2]:0;
  // les bâtiments les plus proches d'une centrale (ou d'un château d'eau…) sont servis en premier
  const alloc=(prod,src,arr,k)=>{
    let left=prod-su[k],tot=0;
    const d=list.map((i,j)=>{const x=i%N+.5,z=((i/N)|0)+.5;let m=1e9;for(let q=0;q<src.length;q+=2){const v=Math.abs(src[q]-x)+Math.abs(src[q+1]-z);if(v<m)m=v;}return[m,i,U[j][k]];});
    d.sort((a,b)=>a[0]-b[0]);
    for(const e of d){tot+=e[2];if(src.length&&left>=e[2]){arr[e[1]]=1;left-=e[2];}else left=-1e9;}
    return tot;
  };
  ST.pu+=alloc(pp,P,pw,0);ST.wu+=alloc(wp,W,wt,1);
  if(garbageOn())ST.gu+=alloc(gp,Gs,gb,2);else gb.fill(1);
  if(pw0)utilChanged(pw0,wt0);
}
function computeStats(){
  let pop=0,jc=0,ji=0,jo=0,hs=0,ab=0,fi=0,np=0,nw=0,ng=0,pp=0,pw_=0;
  const lots={1:0,2:0,3:0,4:0},free={1:0,2:0,3:0,4:0};
  for(let i=0;i<NN;i++){
    const z=zone[i];if(!z)continue;
    if(!lvl[i]){if(rdist[i]<=2&&inAreaI(i))free[z]++;continue;}
    lots[z]++;const s=st[i];
    if(s===ABAND){ab++;continue;}if(s===RUIN)continue;if(s===FIRE)fi++;
    const c=cap[i];
    if(s===BUILD){const e=lotSpec(z,lvl[i],vari[i]).cap-c;if(e>0){pp+=Math.ceil(e*USE_P[z]);pw_+=Math.ceil(e*USE_W[z]);}}
    if(z===ZR){pop+=c;hs+=hap[i]*c;}else if(z===ZC)jc+=c;else if(z===ZI)ji+=c;else jo+=c;
    if(s!==BUILD&&c){if(!pw[i])np++;if(!wt[i])nw++;if(!gb[i])ng++;}
  }
  for(const s of SV.values()){const b=BT[s.t];if(b.jobs&&svcOK.get(s.id))ji+=b.jobs;}   // fermes, scieries, ports…
  const jobs=jc+ji+jo,workers=pop*.5;
  let tr=extTour();for(const s of SV.values()){const b=BT[s.t];if(b.tour&&svcOK.get(s.id))tr+=b.tour;}
  Object.assign(ST,{noGar:ng,tour:Math.max(0,Math.round(tr+MOD('tour'))),pendP:pp,pendW:pw_,pop,jc,ji,jo,workers,unemp:workers>0?clamp((workers-jobs)/workers,-1,1):0,hap:pop?Math.round(hs/pop):60,lots,free,aband:ab,fires:fi,noPow:np,noWat:nw});
  SPARE.p=ST.pp-ST.pu-pp;SPARE.w=ST.wp-ST.wu-pw_;
}
function updateDemand(){
  const P=ST,jobs=P.jc+P.ji+P.jo,workers=P.workers,off=S.ms>=3;
  let r=(jobs+40-workers)/Math.max(25,workers*.35);
  let c=(15+P.pop*.18-P.jc)/Math.max(10,(15+P.pop*.18)*.5);
  let ind=(25+P.pop*.22-P.jo*.35-P.ji)/Math.max(12,(25+P.pop*.22)*.5);
  let o=off?(P.pop*.14-P.jo+8)/Math.max(10,P.pop*.07):-1;
  r+=(P.hap-55)/120;
  if(P.pu>P.pp||P.wu>P.wp){r-=.35;c-=.2;ind-=.2;o-=.2;}
  const t=S.tax;r-=(t.r-9)*.06;c-=(t.c-9)*.06;ind-=(t.i-9)*.06;o-=(t.o-9)*.06;
  c+=Math.min(.3,P.tour*.006)+(PO('pme')?.15:0)+(PO('night')?.1:0)-(PO('zone30')?.05:0);
  if(PO('green'))ind-=.1;
  r+=MOD('dem1');c+=MOD('dem2');ind+=MOD('dem3');o+=MOD('dem4');
  const T={1:r,2:c,3:ind,4:o};extDemand(T);
  for(const z of[1,2,3,4])S.dem[z]+=(clamp(T[z],-1,1)-S.dem[z])*.08;
}
function lotHappiness(i){
  let h=55+COV.health[i]*(PO('kine')?.22:.12)+COV.police[i]*.1+COV.edu[i]*.08+COV.park[i]*.14+COV.transport[i]*.05+(lval[i]-35)*.25-pol[i]*.5-(S.tax.r-9)*2.5;
  if(!pw[i])h-=20;if(!wt[i])h-=20;h-=Math.max(0,ST.unemp-.15)*30;
  if(garbageOn()&&!gb[i])h-=10;
  h+=MOD('hap')+(PO('sport')?4:0)+(PO('zone30')?3:0)+(PO('smoke')?2:0)-(PO('water')?2:0)-(PO('night')?2:0);
  h+=extHap(i);
  return clamp(Math.round(h),0,100);
}
function targetLevel(i){
  const v=lval[i],z=zone[i],m=MS[S.ms].maxLvl;let t=1;
  if(z===ZR){if(v>=68&&COV.edu2[i]&&m>=4)t=4;else if(v>=48&&COV.edu[i]&&m>=3)t=3;else if(v>=30&&COV.edu[i])t=2;}
  else if(z===ZC){if(v>=68&&m>=4)t=4;else if(v>=48&&m>=3)t=3;else if(v>=30)t=2;}
  else if(z===ZO){if(v>=70&&COV.edu2[i]&&m>=4)t=4;else if(v>=52&&m>=3)t=3;else if(v>=36)t=2;}
  else{if(ST.edu2Any&&ST.pop>=1500&&m>=3)t=3;else if(ST.eduAny&&ST.pop>=250)t=2;}
  return Math.min(t,m);
}
// Ce qui manque pour monter de niveau (affiché dans l'inspecteur)
function levelHint(i){
  const z=zone[i],l=lvl[i],v=lval[i],m=MS[S.ms].maxLvl;
  if(l>=(z===ZI?3:4))return 'Niveau maximum atteint.';
  if(l>=m)return `Palier « ${MS.find(x=>x.maxLvl>l).name} » requis pour grandir.`;
  const need=[];
  if(z===ZI){if(l===1){if(!ST.eduAny)need.push('une école dans la ville');if(ST.pop<250)need.push('250 habitants');}
    else{if(!ST.edu2Any)need.push('un lycée ou la faculté');if(ST.pop<1500)need.push('1 500 habitants');}}
  else{
    const th=z===ZO?[0,36,52,70]:[0,30,48,68];
    if(v<th[l])need.push(`valeur foncière ${th[l]} (actuelle ${v}) : parcs, services, vue sur l’eau`);
    if(z===ZR&&l<3&&!COV.edu[i])need.push('une école à proximité');
    if((z===ZR||z===ZO)&&l===3&&!COV.edu2[i])need.push('des études longues à proximité (lycée, faculté)');
  }
  return need.length?'Pour grandir : '+need.join(', ')+'.':'Prêt à grandir : il suffit d’un peu de demande.';
}
function setBuilding(i,l){
  const was=lvl[i]&&st[i]!==RUIN&&st[i]!==ABAND;
  lvl[i]=l;vari[i]=(Math.random()*256)|0;st[i]=BUILD;tmr[i]=3+l*3;
  if(!was)cap[i]=0;
  if(tree[i]){tree[i]=0;D.trees=true;}
  touch(i);D.util=true;if(zone[i]===ZI)D.pol=true;
}
function abandon(i){st[i]=ABAND;tmr[i]=0;cap[i]=0;touch(i);D.util=true;D.icons=true;if(zone[i]===ZI)D.pol=true;}
function clearLot(i){lvl[i]=0;st[i]=OK;tmr[i]=0;cap[i]=0;touch(i);D.util=true;D.icons=true;}
function ignite(i){
  if(st[i]!==OK||!lvl[i])return;
  st[i]=FIRE;tmr[i]=14;touch(i);D.icons=true;S.fires=(S.fires|0)+1;v6FireTruck(i);sosStart('fire',i);   // v6 : camion de pompiers + quiz pour sauver la ville
  const x=i%N,z=(i/N)|0;
  toastOnce('fire'+((S.day/20)|0),'local_fire_department',COV.fire[i]?'Incendie ! Les pompiers arrivent.':'Incendie ! Aucune caserne ne couvre ce quartier.',0,{label:'Voir',fn:()=>flyTo(x+.5,z+.5)});
}
function evalLot(i){
  const z=zone[i];if(!z)return;
  if(road[i]||svcAt[i]||ter[i]){zone[i]=0;lvl[i]=0;return;}
  const l=lvl[i],s=st[i];
  if(isFlooded(i))return;   // inondation passagère : le bâtiment attend que l'eau se retire
  if(!l){
    if(s!==OK||!inAreaI(i)||rdist[i]>2)return;
    if(z===ZO&&S.ms<3)return;
    const d=S.dem[z];if(d<=.03)return;
    if(SPARE.p<3||SPARE.w<3)return;
    if(Math.random()<(.1+.75*d)*(rdist[i]===1?1:.6)){
      setBuilding(i,1);const c=lotSpec(z,1,vari[i]).cap;SPARE.p-=Math.ceil(c*USE_P[z]);SPARE.w-=Math.ceil(c*USE_W[z]);
    }
    return;
  }
  if(s===BUILD||s===FIRE||s===RUIN)return;
  if(s===ABAND){tmr[i]=Math.min(255,tmr[i]+1);if(tmr[i]>=4)clearLot(i);return;}
  const h=lotHappiness(i);hap[i]=h;
  let bad=0;
  if(!pw[i])bad++;if(!wt[i])bad++;if(rdist[i]>2)bad+=2;
  if(z===ZR&&h<22)bad++;
  if(z!==ZR&&S.dem[z]<-.55)bad++;
  if(z!==ZR&&ST.unemp<-.35)bad++;
  if(bad){tmr[i]=Math.min(255,tmr[i]+1);if(tmr[i]>=5&&Math.random()<.22+.1*bad)abandon(i);return;}
  tmr[i]=0;
  if(S.ms>=1&&Math.random()<.0003*l*(1-COV.fire[i]/100)*(PO('firesafe')?.4:1)){ignite(i);return;}
  const tl=targetLevel(i);
  if(tl>l&&S.dem[z]>-.3&&Math.random()<.28){
    const e=Math.max(0,lotSpec(z,l+1,vari[i]).cap-cap[i]),ep=Math.ceil(e*USE_P[z]),ew=Math.ceil(e*USE_W[z]);
    if(SPARE.p<ep+2||SPARE.w<ew+2)return;      // pas de quoi alimenter un bâtiment plus grand
    setBuilding(i,l+1);SPARE.p-=ep;SPARE.w-=ew;
  }
}
function dayStatuses(){
  for(let i=0;i<NN;i++){
    const s=st[i];if(s===OK||s===ABAND)continue;
    if(s===BUILD){
      if(!lvl[i]){st[i]=OK;continue;}
      if(tmr[i]>0){const T_=3+lvl[i]*3,a_=siteStage(tmr[i],T_);tmr[i]--;if(siteStage(tmr[i],T_)!==a_)touch(i);}   /* v10 : étapes du chantier */
      else{st[i]=OK;cap[i]=lotSpec(zone[i],lvl[i],vari[i]).cap;if(zone[i]===ZR){hap[i]=lotHappiness(i);rlMoveIn(i);}touch(i);D.util=true;D.icons=true;}
    }else if(s===FIRE){
      if(COV.fire[i]&&Math.random()<.3){st[i]=OK;tmr[i]=0;touch(i);D.icons=true;toastOnce('fireout','local_fire_department','Incendie maîtrisé par les pompiers.',30);}
      else if(tmr[i]>0)tmr[i]--;
      else{
        st[i]=RUIN;tmr[i]=18;cap[i]=0;touch(i);D.util=true;D.icons=true;
        const x=i%N;
        for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&lvl[j]&&st[j]===OK&&Math.random()<.18)ignite(j);
      }
    }else if(s===RUIN){if(tmr[i]>0)tmr[i]--;else clearLot(i);}
  }
}
function simRefresh(){
  if(D.roads){recomputeRoads();D.roads=false;D.util=D.cov=D.icons=D.lights=true;}
  if(D.cov){recomputeCoverage();D.cov=false;D.lv=true;viewChanged('cov');}
  if(D.pol){recomputePollution();D.pol=false;D.lv=true;viewChanged('pol');}
  if(D.lv){recomputeLV();D.lv=false;viewChanged('lv');}
  if(D.util){recomputeUtilities();D.util=false;D.icons=true;viewChanged('util');}
  computeStats();
}
function simDay(){
  S.day++;
  simRefresh();
  dayStatuses();
  SPARE.p=ST.pp-ST.pu-ST.pendP;SPARE.w=ST.wp-ST.wu-ST.pendW;
  const per=Math.ceil(NN/30);
  for(let k=0;k<per;k++){const i=(S.cursor*1597)%NN;S.cursor=(S.cursor+1)%NN;evalLot(i);}   // ordre dispersé (1597 premier avec 4096)
  computeStats();updateDemand();
  if(S.day%30===0)monthTick();
  if(S.day%2===0)D.icons=true;
  extDay();
}
function monthTick(){
  const t=S.tax,P=ST;
  const inc={r:P.pop*t.r*.14,c:P.jc*t.c*.16*(PO('pme')?.75:1),i:P.ji*t.i*.12,o:P.jo*t.o*.2,t:P.tour*(8+P.pop*.006)*(PO('tourism')?1.3:1),x:tradeIncome()};
  const up={};let upk=0;
  for(const s of SV.values()){const b=BT[s.t];upk+=b.upkeep;up[b.cat]=(up[b.cat]||0)+b.upkeep;}
  const rd=Math.round(P.roads*.25+P.aves*.25+tramTiles()*.3);
  let pc=0;for(const p of POLICIES)if(PO(p.id))pc+=Math.ceil(P.pop*p.cost);
  const tin=Math.round(inc.r+inc.c+inc.i+inc.o+inc.t+inc.x),tex=upk+rd+pc,net=tin-tex;
  S.money+=net;
  S.last={inc:{r:Math.round(inc.r),c:Math.round(inc.c),i:Math.round(inc.i),o:Math.round(inc.o),t:Math.round(inc.t),x:Math.round(inc.x)},up,rd,pc,tin,tex,net};
  S.hist.push([P.pop,Math.round(S.money),net,P.hap,P.tour,P.jc+P.ji+P.jo,S.stat.patOk|0,S.quizTot|0,S.day]);if(S.hist.length>240)S.hist.shift();   // v6 : plus de courbes, 20 ans
  S.mods=S.mods.filter(m=>m.u>S.day);
  D.pol=D.lv=D.util=true;
  checkMilestones();checkTuto();advisor();maybeEvent();extMonth();
  if(performance.now()-_lastSave>15000)save();
}
function checkMilestones(){
  let up=false;
  while(S.ms<MS.length-1&&ST.pop>=MS[S.ms+1].pop){S.ms++;S.money+=MS[S.ms].reward;up=true;onMilestone(S.ms);}
  return up;
}
function freeLots(z){return ST.free[z];}
function advisor(){
  const P=ST,tips=[];
  if(S.money<0)tips.push(['money','savings','Caisse vide ! Révise un peu pour recevoir une subvention, ou augmente les impôts.',4]);
  if(P.pu>P.pp&&P.pop>0)tips.push(['pw','bolt','Pénurie d’électricité : construis une éolienne ou une centrale.',4]);
  if(P.wu>P.wp&&P.pop>0)tips.push(['wt','water_drop','Il manque de l’eau : construis un château d’eau.',4]);
  if(garbageOn()&&P.gu>P.gp&&P.pop>0)tips.push(['gar','delete','Les poubelles débordent : construis une décharge (menu Réseaux).',4]);
  if(P.fires>0&&!SV.size)tips.push(['firest','local_fire_department','Pense à une caserne de pompiers.',6]);
  const cnt=ST.free[1]+ST.free[2]+ST.free[3]+ST.free[4];
  if(cnt>0&&Math.max(S.dem[1],S.dem[2],S.dem[3])>.2&&(SPARE.p<3||SPARE.w<3))tips.push(['cap',SPARE.p<3?'bolt':'water_drop',SPARE.p<3?'Plus de courant disponible : construis des éoliennes pour que de nouveaux bâtiments poussent.':'Plus d’eau disponible : construis un château d’eau pour que de nouveaux bâtiments poussent.',3]);
  if(S.dem[1]>.45&&freeLots(1)<4&&P.pop>0)tips.push(['dr','house','Des familles veulent s’installer : crée des zones résidentielles.',5]);
  if(S.dem[2]>.45&&freeLots(2)<3&&P.pop>=20)tips.push(['dc','storefront','Les habitants réclament des commerces.',5]);
  if(S.dem[3]>.45&&freeLots(3)<3&&P.pop>=20)tips.push(['di','factory','Les entreprises cherchent des terrains industriels.',5]);
  if(S.ms>=3&&S.dem[4]>.45&&freeLots(4)<3)tips.push(['do','domain','Les sociétés veulent des bureaux.',6]);
  if(P.pop>=60&&!P.healthAny)tips.push(['hl',P_().bldIc,P_().tip,8]);
  if(P.pop>=120&&!P.eduAny&&S.ms>=1)tips.push(['ed','school','Construis une école : sans elle, les maisons ne deviendront pas des immeubles.',8]);
  if(P.aband>=4)tips.push(['ab','domain_disabled','Des bâtiments sont abandonnés : vérifie l’électricité, l’eau et l’accès aux routes.',8]);
  if(P.unemp>.25&&P.pop>60)tips.push(['un','work','Trop de chômage : ajoute des commerces, de l’industrie ou des bureaux.',8]);
  for(const tp of tips){if(toastOnce(tp[0],tp[1],tp[2],tp[3]*30))break;}
}

// =========================================================
// Arrêtés municipaux (débloqués par la mairie)
// =========================================================
const POLICIES=[
  {id:'green',name:'Ville verte',icon:'eco',cost:.15,desc:'Pollution des usines −35 %, mais un peu moins d’industrie.'},
  {id:'led',name:'Éclairage LED',icon:'lightbulb',cost:.06,desc:'Consommation d’électricité −15 %.'},
  {id:'water',name:'Économies d’eau',icon:'water_drop',cost:.05,desc:'Consommation d’eau −20 %, bonheur −2.'},
  {id:'recycle',name:'Tri obligatoire',icon:'recycling',cost:.08,ms:2,desc:'Déchets −30 %.'},
  {id:'sport',name:'Sport pour tous',icon:'sports_handball',cost:.12,desc:'Bonheur +4 : la ville bouge !'},
  {id:'kine',name:'Kiné remboursé',icon:'accessibility_new',cost:.15,desc:'La santé compte presque double dans le bonheur. Les kinés approuvent.'},
  {id:'zone30',name:'Zone 30',icon:'speed',cost:.03,desc:'Quartiers résidentiels plus calmes : bonheur +3, valeur foncière +3, commerces un peu moins actifs.'},
  {id:'pme',name:'Soutien aux commerces',icon:'storefront',cost:0,desc:'Plus de demande de commerces, mais leurs impôts baissent de 25 %.'},
  {id:'firesafe',name:'Prévention incendie',icon:'fire_extinguisher',cost:.04,desc:'Risque d’incendie −60 %.'},
  {id:'tourism',name:'Office de tourisme',icon:'luggage',cost:.05,desc:'Revenus du tourisme +30 %.'},
  {id:'night',name:'Vie nocturne',icon:'nightlife',cost:0,desc:'Commerces plus actifs, mais un peu de bruit : bonheur −2.'},
  {id:'smoke',name:'Ville sans tabac',icon:'smoke_free',cost:.04,desc:'Des poumons en meilleure santé : bonheur +2.'}
];

// =========================================================
// Évènements : le conseil municipal demande une décision
// =========================================================
const EVENTS=[
  {id:'festival',icon:'festival',t:'Festival de musique',d:'Des organisateurs veulent installer un festival au bord de la rivière tout l’été.',
    a:{l:'Accueillir le festival',c:2000,m:[['hap',6,120],['tour',10,90]],r:'Le festival est un succès : la ville vibre !'},b:{l:'Refuser',m:[['hap',-2,60]],r:'Les jeunes sont déçus.'}},
  {id:'promoteur',icon:'apartment',t:'Un promoteur immobilier',d:'Il propose de financer la ville si tu assouplis les règles d’urbanisme.',
    a:{l:'Accepter son argent',g:6000,m:[['hap',-4,180],['dem1',.2,180]],r:'Les grues poussent partout… et les habitants grognent un peu.'},b:{l:'Refuser',r:'Le promoteur va voir ailleurs.'}},
  {id:'marathon',icon:'directions_run',t:'Marathon des kinés',d:'L’école de kiné organise un marathon solidaire dans tes rues.',
    a:{l:'Sponsoriser la course',c:1500,m:[['hap',5,120]],r:'Échauffements, étirements… et une ville en pleine forme !'},b:{l:'Décliner',r:'Les coureurs iront dans la ville voisine.'}},
  {id:'canicule',icon:'sunny',t:'Canicule',d:'Une vague de chaleur s’abat sur la ville.',cond:()=>{const m=month();return m>=5&&m<=7;},
    a:{l:'Distribuer de l’eau',c:1200,r:'Les habitants te remercient.'},b:{l:'Ne rien faire',m:[['useW',.25,60],['hap',-5,60]],r:'La consommation d’eau explose.'}},
  {id:'grippe',icon:'coronavirus',t:'Épidémie de grippe',d:'Le virus circule dans les écoles et les bureaux.',cond:()=>{const m=month();return m===11||m<=1;},
    a:{l:'Campagne de vaccination',c:2000,r:'L’épidémie est vite enrayée.'},b:{l:'Laisser passer',m:[['hap',-7,90]],r:'Beaucoup d’habitants sont malades.'}},
  {id:'greve',icon:'delete',t:'Grève des éboueurs',d:'Les agents de collecte réclament une prime.',cond:()=>garbageOn()&&ST.gp>0,
    a:{l:'Verser la prime',c:2500,r:'La collecte reprend aussitôt.'},b:{l:'Attendre',m:[['gar',-.4,75]],r:'Les poubelles s’accumulent…'}},
  {id:'startup',icon:'rocket_launch',t:'Une start-up de la e-santé',d:'De jeunes kinés veulent lancer une application de rééducation.',cond:()=>S.ms>=3,
    a:{l:'Leur offrir des locaux',c:3000,m:[['dem4',.3,240]],r:'Leur succès attire d’autres entreprises.'},b:{l:'Refuser',r:'Ils partent dans une grande ville.'}},
  {id:'guide',icon:'menu_book',t:'Un guide touristique',d:'Un célèbre guide veut consacrer une page à ta ville.',cond:()=>ST.tour>0,
    a:{l:'Inviter le journaliste',c:1000,m:[['tour',15,180]],r:'Les touristes affluent !'},b:{l:'Non merci',r:'La ville restera discrète.'}},
  {id:'congres',icon:'groups',t:'Congrès national de kiné',d:'La profession cherche une ville pour son grand congrès annuel.',cond:()=>svcCount('fac')+svcCount('reeduc')>0,
    a:{l:'Accueillir le congrès',c:4000,m:[['tour',25,90],['hap',3,90]],r:'Des milliers de kinés découvrent ta ville.'},b:{l:'Décliner',r:'Le congrès aura lieu ailleurs.'}},
  {id:'nids',icon:'construction',t:'Nids-de-poule',d:'L’hiver a abîmé les routes.',cond:()=>ST.roads>=120,
    a:{l:'Tout réparer',cf:'roads',r:'Les routes sont comme neuves.'},b:{l:'Plus tard',m:[['hap',-4,120],['dem2',-.1,120]],r:'Les habitants râlent sur leurs amortisseurs.'}},
  {id:'brocante',icon:'storefront',t:'Brocante géante',d:'Les commerçants veulent fermer le centre-ville un dimanche.',
    a:{l:'Autoriser',m:[['hap',3,45],['dem2',.12,60]],r:'Les rues sont noires de monde.'},b:{l:'Interdire',r:'Les commerçants sont déçus.'}},
  {id:'partiels',icon:'school',t:'Semaine des partiels',d:'Les étudiants de la ville révisent jour et nuit.',
    a:{l:'Ouvrir les bibliothèques la nuit',c:800,m:[['hap',3,60]],r:'Merci pour eux ! Et toi, as-tu révisé aujourd’hui ?'},b:{l:'Ne rien changer',r:'Les étudiants s’entassent dans les cafés.'}},
  {id:'parcs',icon:'park',t:'Prime de la région',d:'La région récompense les villes qui plantent des espaces verts.',cond:()=>BLD.filter(b=>b.cat==='parcs').reduce((n,b)=>n+svcCount(b.id),0)>=3,one:true,
    a:{l:'Recevoir la prime',g:4000,r:'Ta ville verte est récompensée !'}},
  {id:'mecene',icon:'volunteer_activism',t:'Un mécène généreux',d:'Un ancien habitant devenu riche veut aider sa ville natale.',one:true,
    a:{l:'Accepter le don',g:3500,r:'Merci au mécène !'}}
];
function evCost(o){return o.cf==='roads'?ST.roads*6:(o.c||0);}
function maybeEvent(){
  if(S.event||S.tut<TUTO.length||ST.pop<80||S.day<(S.nextEv||0))return;
  const recent=S.evHist.slice(-4);
  const ok=EVENTS.filter(e=>!recent.includes(e.id)&&!(e.one&&S.evHist.includes(e.id))&&(!e.cond||e.cond()));
  if(!ok.length)return;
  const e=ok[(Math.random()*ok.length)|0];
  S.event={id:e.id,day:S.day};S.nextEv=S.day+150+((Math.random()*150)|0);
  S.evHist.push(e.id);if(S.evHist.length>30)S.evHist.shift();
  renderEventBanner();
  toast(`<b>Le conseil municipal a besoin de toi</b> : ${esc(e.t)}`,'gavel',{label:'Décider',fn:()=>openPanel('event')});
}
function chooseEvent(k){
  const e=S.event&&EVENTS.find(x=>x.id===S.event.id);if(!e)return;
  const o=e[k];if(!o)return;
  const c=evCost(o);
  if(c&&S.money<c){noMoney(c);return;}
  S.money+=(o.g||0)-c;
  (o.m||[]).forEach(([mk,v,d])=>S.mods.push({k:mk,v,u:S.day+d}));
  S.event=null;renderEventBanner();closePanel();
  if(o.g)floatMoney(o.g);if(c)floatMoney(-c);
  toast(esc(o.r||'C’est noté.'),e.icon);
  D.util=D.lv=true;simRefresh();refreshHUD(true);save();
}

// =========================================================
// Défis (après les objectifs du début)
// =========================================================
function countLvl(l){let n=0;for(let i=0;i<NN;i++)if(lvl[i]>=l&&st[i]===OK&&zone[i]&&zone[i]!==ZI)n++;return n;}
const MISSIONS=[
  {t:'Construis une école',hint:'Sans elle, les maisons ne deviennent pas des immeubles.',ok:()=>svcCount('school')>0,r:1500},
  {t:'Relève le défi du maire',hint:'Bouton « Défi » à droite : réponds juste à 3 questions de tes cours.',ok:()=>(S.quizTot||0)>=3,r:1500},
  {t:'Atteins 250 habitants',hint:'Le palier Village débloque la centrale, la décharge, la bibliothèque…',ok:()=>ST.pop>=250,r:2000},
  {t:'Bâtis la mairie',hint:'Services → Mairie : elle débloque les arrêtés municipaux.',ok:()=>svcCount('mairie')>0,r:2000},
  {t:'Trace une avenue',hint:'Routes → Avenue (5 cases) : ses arbres font grimper la valeur foncière.',ok:()=>ST.aves>=5,r:1500},
  {t:'Atteins 65 % de bonheur',hint:'Parcs, santé, sécurité… et peu de pollution.',ok:()=>ST.pop>=150&&ST.hap>=65,r:2500},
  {t:'Fais pousser un immeuble de 6 étages',hint:'Niveau 3 : palier Bourg, valeur foncière 48 et une école.',ok:()=>countLvl(3)>0,r:3000},
  {t:'Installe un arrêt de bus',hint:'Transports → Arrêt de bus.',ok:()=>svcCount('bus')>0,r:1000},
  {t:'Atteins 1 000 habitants',hint:'Pense aux bureaux et aux transports.',ok:()=>ST.pop>=1000,r:5000},
  {t:'Attire des touristes',hint:'Loisirs : cinéma, port de plaisance, musée… (10 points de tourisme).',ok:()=>ST.tour>=10,r:4000},
  {t:'Réponds juste à 25 questions du maire',hint:'Ta ville et tes partiels te remercient.',ok:()=>(S.quizTot||0)>=25,r:5000},
  {t:'Un premier gratte-ciel',hint:'Niveau 4 : palier Ville, valeur foncière 68 et des études longues.',ok:()=>countLvl(4)>0,r:8000},
  {t:'Atteins 5 000 habitants',hint:'Une grande ville en devenir.',ok:()=>ST.pop>=5000,r:12000},
  {t:'Inaugure un monument Kiné+',hint:'Ils se débloquent avec ton niveau d’XP.',ok:()=>BLD.some(b=>b.lvl&&svcCount(b.id)>0),r:6000},
  {t:'Atteins 10 000 habitants',hint:'Une vraie métropole !',ok:()=>ST.pop>=10000,r:25000}
];
function checkMissions(){
  let done=false;
  while((S.mis|0)<MISSIONS.length&&MISSIONS[S.mis|0].ok()){const m=MISSIONS[S.mis|0];S.money+=m.r;toast(`<b>Défi réussi</b> : ${esc(m.t)} · +${money(m.r)}`,'military_tech');floatMoney(m.r);S.mis=(S.mis|0)+1;done=true;}
  if(done)renderTuto();
}

// =========================================================
// Moteur 3D : textures et matériaux
// =========================================================
let E=null;
const CAM={x:27,z:32,dist:30,yaw:.75,pitch:.9};
let VIEW=null;          // vue d'information active (null = vue normale)
let ZONEVIEW=false;     // zones bien visibles (outil zones actif)
const TOP=new Float32Array(NN);   // hauteur du haut de chaque bâtiment (icônes, sélection)

function cvs(w,h){const c=document.createElement('canvas');c.width=w;c.height=h||w;return c;}
function ctex(cv,rep){const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=E?Math.min(8,E.aniso):4;return t;}

// Façades : 4×4 cellules (une travée × un étage), version jour + version « fenêtres allumées »
function facadeTex(kind,lit){
  // v8 (13 nov. 2026) : façades plus réalistes (512 px, une cellule = une travée × un étage) — encadrements, appuis, volets,
  // bandeaux d'étage, murs-rideaux avec meneaux et reflets du ciel, vitrines, bardage industriel. Le blanc prend la couleur du mur.
  const S_=512,C_=128,cv=cvs(S_),x=cv.getContext('2d'),R=rng(kind.charCodeAt(0)*977+(lit?7:1));
  x.fillStyle=lit?'#000':'#fff';x.fillRect(0,0,S_,S_);
  const glass=(gx,gy,w,h,top,bot)=>{const g=x.createLinearGradient(0,gy,0,gy+h);g.addColorStop(0,top);g.addColorStop(1,bot);x.fillStyle=g;x.fillRect(gx,gy,w,h);
    x.fillStyle='rgba(255,255,255,.28)';x.beginPath();x.moveTo(gx+w*.12,gy+h);x.lineTo(gx+w*.42,gy);x.lineTo(gx+w*.62,gy);x.lineTo(gx+w*.32,gy+h);x.closePath();x.fill();};
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const ox=col*C_,oy=row*C_,on=R()<(kind==='off'?.5:kind==='shop'?.9:.42),v=R();
    if(kind==='res'){
      if(lit){if(on){x.fillStyle=R()<.5?'#ffcf7a':'#ffe4ae';x.fillRect(ox+38,oy+30,52,70);}continue;}
      x.fillStyle='#f1efea';x.fillRect(ox,oy+C_-10,C_,10);x.fillStyle='#d9d6cf';x.fillRect(ox,oy+C_-11,C_,2);   // bandeau d'étage
      x.fillStyle='#e2dfd8';x.fillRect(ox+30,oy+22,68,86);                                                     // encadrement
      glass(ox+38,oy+30,52,70,'#a9c0d0','#5d7385');
      x.fillStyle='#eceae4';x.fillRect(ox+62,oy+30,4,70);x.fillRect(ox+38,oy+56,52,3);                         // croisée
      x.fillStyle='#cfccc5';x.fillRect(ox+26,oy+100,76,7);x.fillStyle='rgba(0,0,0,.12)';x.fillRect(ox+28,oy+107,72,3);   // appui
      if(v<.45){x.fillStyle='#d4d1ca';for(const sx of[ox+12,ox+100]){x.fillRect(sx,oy+28,16,74);x.fillStyle='rgba(0,0,0,.08)';for(let k=0;k<7;k++)x.fillRect(sx+1,oy+32+k*10,14,2);x.fillStyle='#d4d1ca';}}   // volets
      else if(v<.6){x.fillStyle='#bdbab3';x.fillRect(ox+30,oy+86,68,3);for(let k=0;k<9;k++)x.fillRect(ox+32+k*8,oy+88,2,14);x.fillRect(ox+30,oy+100,68,3);}   // garde-corps
    }else if(kind==='off'){
      if(lit){if(on){x.fillStyle=R()<.6?'#eaf2ff':'#fff1cf';x.fillRect(ox+6,oy+4,C_-10,94);}continue;}
      glass(ox,oy,C_,100,v<.5?'#dcecf5':'#e7eef2',v<.5?'#7fa6bd':'#94aebd');
      x.fillStyle='rgba(20,40,60,.1)';x.fillRect(ox,oy+60,C_,40);                                                  // reflets plus sombres en bas
      x.fillStyle='#eef3f6';x.fillRect(ox,oy+100,C_,28);x.fillStyle='#d8e0e5';x.fillRect(ox,oy+100,C_,3);           // allège
      x.fillStyle='#f7fafc';x.fillRect(ox,oy,5,C_);x.fillRect(ox+C_/2-1,oy,3,100);                                 // meneaux
    }else if(kind==='shop'){
      if(lit){if(on){x.fillStyle='#ffe0a0';x.fillRect(ox+8,oy+34,C_-16,86);}continue;}
      x.fillStyle='#3a3f44';x.fillRect(ox+3,oy+28,C_-6,96);
      glass(ox+8,oy+34,C_-16,86,'#b9d2df','#5f7f93');
      x.fillStyle='rgba(255,236,190,.35)';x.fillRect(ox+14,oy+96,C_-28,20);                                          // présentoir éclairé
      x.fillStyle='#3a3f44';x.fillRect(ox+C_/2-2,oy+34,4,86);
      x.fillStyle='#e9e6e0';x.fillRect(ox,oy,C_,24);x.fillStyle='#d2cec6';x.fillRect(ox,oy+22,C_,3);               // bandeau d'enseigne
    }else{
      if(lit){if(on){x.fillStyle='#ffd089';x.fillRect(ox+24,oy+18,80,22);}continue;}
      for(let k=0;k<32;k++){x.fillStyle=k%2?'#e9e9e9':'#ffffff';x.fillRect(ox+k*4,oy,4,C_);}                           // bardage ondulé
      x.fillStyle='rgba(0,0,0,.07)';x.fillRect(ox,oy+C_-6,C_,6);
      if(R()<.75){x.fillStyle='#d6d9db';x.fillRect(ox+20,oy+14,88,30);glass(ox+24,oy+18,80,22,'#a7bac6','#6e8492');}
      if(v<.2){x.fillStyle='#c9ccce';x.fillRect(ox+30,oy+56,68,72);x.fillStyle='rgba(0,0,0,.08)';for(let k=0;k<9;k++)x.fillRect(ox+30,oy+60+k*8,68,2);}   // porte sectionnelle
    }
  }
  return ctex(cv,true);
}
function iconTex(kind){
  const cv=cvs(64),x=cv.getContext('2d');
  const bg={power:'#f5a300',water:'#2f8fe0',fire:'#e5482d',aband:'#6b6b6b',road:'#8b5cf6',garbage:'#8d6e63',patient:'#e6397a',repair:'#f08c3a',crisis:'#7b2fbe',dmg:'#d64545',flood:'#1e88e5'}[kind];
  x.fillStyle='rgba(0,0,0,.25)';x.beginPath();x.arc(32,34,27,0,7);x.fill();
  x.fillStyle=bg;x.beginPath();x.arc(32,31,26,0,7);x.fill();
  x.strokeStyle='#fff';x.lineWidth=3;x.stroke();
  x.fillStyle='#fff';x.beginPath();
  if(kind==='power'){x.moveTo(36,10);x.lineTo(20,35);x.lineTo(31,35);x.lineTo(27,52);x.lineTo(44,26);x.lineTo(33,26);x.closePath();}
  else if(kind==='water'){x.moveTo(32,11);x.bezierCurveTo(24,24,19,30,19,37);x.arc(32,37,13,Math.PI,0,true);x.bezierCurveTo(45,30,40,24,32,11);}
  else if(kind==='fire'){x.moveTo(32,10);x.bezierCurveTo(44,22,46,30,45,38);x.bezierCurveTo(44,47,38,52,32,52);x.bezierCurveTo(24,52,19,46,19,38);x.bezierCurveTo(19,31,24,27,27,22);x.bezierCurveTo(28,29,30,31,33,32);x.bezierCurveTo(33,24,31,17,32,10);}
  else if(kind==='aband'){x.rect(28,13,8,24);x.moveTo(37,46);x.arc(32,46,5,0,7);}
  else if(kind==='garbage'){x.rect(19,17,26,5);x.rect(28,12,8,5);x.moveTo(21,24);x.lineTo(43,24);x.lineTo(40,50);x.lineTo(24,50);x.closePath();}
  else if(kind==='patient'){const pr=S&&S.prof;   // v4 : patte (véto), dent (dentiste), croix sinon
    if(pr==='veto'){x.ellipse(32,39,10,9,0,0,7);for(const[a,b]of[[19,27],[27,18],[37,18],[45,27]]){x.moveTo(a+5,b);x.ellipse(a,b,5,6,0,0,7);}}
    else if(pr==='dent'){x.moveTo(18,22);x.bezierCurveTo(18,12,28,12,32,16);x.bezierCurveTo(36,12,46,12,46,22);x.bezierCurveTo(46,30,43,34,42,40);x.lineTo(40,50);x.lineTo(36,50);x.lineTo(33,38);x.lineTo(31,38);x.lineTo(28,50);x.lineTo(24,50);x.lineTo(22,40);x.bezierCurveTo(21,34,18,30,18,22);}
    else{x.rect(27,14,10,34);x.rect(15,26,34,10);}}
  else if(kind==='repair'){x.save();x.translate(32,32);x.rotate(-.78);x.rect(-3,-6,6,26);x.rect(-11,-18,22,10);x.restore();}
  else if(kind==='crisis'){x.arc(32,31,10,0,7);for(let k=0;k<8;k++){const a=k*Math.PI/4;x.moveTo(32+Math.cos(a)*10,31+Math.sin(a)*10);x.arc(32+Math.cos(a)*17,31+Math.sin(a)*17,3.5,0,7);}}
  else if(kind==='dmg'){x.moveTo(32,12);x.lineTo(50,46);x.lineTo(14,46);x.closePath();}
  else if(kind==='flood'){x.rect(14,22,36,5);x.rect(14,32,36,5);x.rect(14,42,36,5);}
  else{x.rect(22,12,4,40);x.rect(38,12,4,40);x.rect(30,14,4,7);x.rect(30,28,4,7);x.rect(30,42,4,7);}
  x.fill();
  if(kind==='road'){x.strokeStyle='#fff';x.lineWidth=5;x.beginPath();x.moveTo(14,50);x.lineTo(50,14);x.stroke();}
  if(kind==='dmg'){x.fillStyle=bg;x.fillRect(30,22,4,13);x.fillRect(30,38,4,4);}
  return ctex(cv,false);
}
function dotTex(){if(dotTex.t)return dotTex.t;const cv=cvs(32),x=cv.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.55,'rgba(255,255,255,.8)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,32,32);return dotTex.t=ctex(cv,false);}
function glowTex(){
  const cv=cvs(64),x=cv.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,240,200,.65)');g.addColorStop(1,'rgba(255,220,150,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return ctex(cv,false);
}
let GRASS_CV=null,SANDP_CV=null;
function makePatterns(){
  const cv=cvs(128),x=cv.getContext('2d'),R=rng(4242);
  for(let k=0;k<420;k++){const a=R();x.fillStyle=a<.5?`rgba(255,255,230,${.08+R()*.12})`:`rgba(30,70,20,${.06+R()*.1})`;x.fillRect(R()*128,R()*128,1+R()*2,1+R()*2);}
  for(let k=0;k<26;k++){x.fillStyle=`rgba(${R()<.5?'250,250,210':'60,110,40'},.08)`;x.beginPath();x.arc(R()*128,R()*128,3+R()*7,0,7);x.fill();}
  GRASS_CV=cv;
  const sv=cvs(128),y=sv.getContext('2d');   // sable du désert (v4) : grains clairs et foncés, ondulations des dunes
  for(let k=0;k<380;k++){const a=R();y.fillStyle=a<.5?`rgba(255,250,235,${.1+R()*.14})`:`rgba(150,100,50,${.06+R()*.1})`;y.fillRect(R()*128,R()*128,1+R()*2,1+R()*2);}
  for(let k=0;k<16;k++){y.fillStyle='rgba(190,140,80,.07)';y.beginPath();y.ellipse(R()*128,R()*128,8+R()*10,2+R()*3,R()*3,0,7);y.fill();}
  SANDP_CV=sv;
}
const SNOW={value:0};
// v10 : neige sur chaque case de route (texture 64 × 64, canal rouge) et pluie (routes mouillées)
const RS_D=new Uint8Array(N*N*4),RSU={value:null},WETU={value:0};
{const t_=new THREE.DataTexture(RS_D,N,N);t_.magFilter=THREE.LinearFilter;t_.minFilter=THREE.LinearFilter;t_.needsUpdate=true;RSU.value=t_;}
// Neige : blanchit les surfaces tournées vers le ciel (toits, herbe) quand c'est l'hiver
function snowify(m,ground){
  if(!m||m.userData.snow)return;m.userData.snow=1;
  m.onBeforeCompile=sh=>{
    sh.uniforms.uSnow=SNOW;
    sh.vertexShader='varying vec3 vWN;\n'+sh.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvec3 wn_=objectNormal;\n#ifdef USE_INSTANCING\nwn_=mat3(instanceMatrix)*wn_;\n#endif\nvWN=normalize(mat3(modelMatrix)*wn_);');
    sh.fragmentShader='uniform float uSnow;\nvarying vec3 vWN;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n{float s_=uSnow*smoothstep(.45,.8,vWN.y);'+(ground?'s_*=.86*clamp((diffuseColor.g-max(diffuseColor.r,diffuseColor.b))*8.,0.,1.);':'')+'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,.99),s_);}');
    if(ground){sh.uniforms.uRS=RSU;sh.uniforms.uWet=WETU;   /* v10 : asphalte = gris foncé peu saturé (couleurs linéaires) */
      sh.vertexShader='varying vec2 vWP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xz;');
      sh.fragmentShader='uniform sampler2D uRS;\nuniform float uWet;\nvarying vec2 vWP;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n{float mx_=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)),mn_=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));float rd_=step(mx_-mn_,.07)*step(mx_,.5);float rs_=texture2D(uRS,vWP/64.).r;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.9,.95),uSnow*rs_*rd_*.9);diffuseColor.rgb*=mix(1.,.84,uWet*rd_);diffuseColor.rgb+=vec3(.01,.015,.025)*uWet*rd_;}');}
  };
  const ob=m.onBeforeCompile;m.onBeforeCompile=sh=>{ob(sh);lmInject(sh);};
  m.customProgramCacheKey=()=>ground?'snowG3':'snowB3';
}
const SNOW_M=[1,.9,.35,0,0,0,0,0,0,0,.1,.75];   // de janvier à décembre
function updateSeason(dt){
  let tgt=0;
  if(S.set.sn&&!BIO().nosnow){const d=S.day%360,m=(d/30)|0,f=(d%30)/30;tgt=lerp(SNOW_M[m],SNOW_M[(m+1)%12],f);}
  SNOW.value+=(tgt-SNOW.value)*Math.min(1,dt*.8);
}
function makeFlakes(){
  const n=600,geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3);
  for(let k=0;k<n;k++){pos[k*3]=(Math.random()-.5)*40;pos[k*3+1]=Math.random()*14;pos[k*3+2]=(Math.random()-.5)*40;}
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  E.flakes=new THREE.Points(geo,new THREE.PointsMaterial({color:'#ffffff',map:dotTex(),size:.08,sizeAttenuation:true,transparent:true,opacity:.9,depthWrite:false}));   /* 14 nov. 2026 : disques doux (avant : carrés blancs) */
  E.flakes.frustumCulled=false;E.flakes.visible=false;E.gD.add(E.flakes);
}
function stepFlakes(dt){
  const F=E.flakes,on=SNOW.value>.35&&!!S.set.sn;F.visible=on;if(!on)return;
  const a=F.geometry.attributes.position.array,ext=Math.min(70,CAM.dist*1.4)/40;
  F.position.set(CAM.x,0,CAM.z);F.scale.set(ext,1,ext);
  for(let k=0;k<a.length;k+=3){a[k+1]-=dt*(1.1+(k%7)*.09);a[k]+=Math.sin(E.t*.7+k)*dt*.12;if(a[k+1]<0)a[k+1]+=14;}
  F.geometry.attributes.position.needsUpdate=true;F.material.size=.06+CAM.dist*.0022;
}
function makeMaterials(){
  const T={};
  ['res','off','shop','ind'].forEach(k=>{T[k]=facadeTex(k,false);T[k+'L']=facadeTex(k,true);});
  const lam=o=>new THREE.MeshLambertMaterial(Object.assign({vertexColors:true},o));
  E.mat={
    plain:lam({}),
    res:lam({map:T.res,emissive:new THREE.Color('#ffc978'),emissiveMap:T.resL,emissiveIntensity:0}),
    shop:lam({map:T.shop,emissive:new THREE.Color('#ffd79a'),emissiveMap:T.shopL,emissiveIntensity:0}),
    ind:lam({map:T.ind,emissive:new THREE.Color('#ffc978'),emissiveMap:T.indL,emissiveIntensity:0}),
    off:new THREE.MeshPhongMaterial({vertexColors:true,map:T.off,shininess:60,specular:new THREE.Color('#8aa3b5'),emissive:new THREE.Color('#d9e6ff'),emissiveMap:T.offL,emissiveIntensity:0}),
    resN:lam({map:T.res}),shopN:lam({map:T.shop}),indN:lam({map:T.ind}),
    offN:new THREE.MeshPhongMaterial({vertexColors:true,map:T.off,shininess:20,specular:new THREE.Color('#444')}),
    basic:new THREE.MeshBasicMaterial({vertexColors:true}),
    fire:new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.92,depthWrite:false}),
    ghost:new THREE.MeshLambertMaterial({vertexColors:true,transparent:true,opacity:.6,depthWrite:false}),
    glass:lam({emissive:new THREE.Color('#ffc978'),emissiveIntensity:0}),   /* v7 : vitres des modèles 3D */
    sign:new THREE.MeshBasicMaterial({vertexColors:true})   /* v10 : enseignes des magasins, éteintes à la fermeture */
  };
  E.lit=[[E.mat.res,1],[E.mat.shop,1.15],[E.mat.ind,.8],[E.mat.off,.9],[E.mat.glass,.7]];
  ['plain','res','shop','ind','off','resN','shopN','indN','offN'].forEach(k=>snowify(E.mat[k],false));
}

// =========================================================
// Géométrie procédurale (triangles à plat, regroupés par matériau)
// =========================================================
class Geo{constructor(){this.p=[];this.n=[];this.c=[];this.u=[];}}
let GB=null,CUR=null,OVC=null,DK=0,NP=0,SITEP=1;   /* NP : lot sans électricité (v10) · SITEP : avancement du chantier */
const _c3=new THREE.Color(),_cc=new Map();
function C3(hex){let c=_cc.get(hex);if(!c){_c3.set(hex);c=[_c3.r,_c3.g,_c3.b];_cc.set(hex,c);}return c;}
function CC(hex){if(OVC)return OVC;const c=C3(hex);return DK?[c[0]*.3+.03,c[1]*.28+.03,c[2]*.27+.03]:c;}
const UNLIT={res:'resN',off:'offN',shop:'shopN',ind:'indN',basic:'plain',glass:'plain',sign:'plain'};
function G(k){if(OVC&&k!=='fire')k='plain';else if((DK||NP)&&UNLIT[k])k=UNLIT[k];let g=GB.get(k);if(!g){g=new Geo();GB.set(k,g);}return g;}
function tri(g,a,b,c,col,ua,ub,uc){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz);if(!l)return;nx/=l;ny/=l;nz/=l;
  g.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
  g.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
  g.c.push(col[0],col[1],col[2],col[0],col[1],col[2],col[0],col[1],col[2]);
  if(ua)g.u.push(ua[0],ua[1],ub[0],ub[1],uc[0],uc[1]);else g.u.push(0,0,0,0,0,0);
}
// triangle avec une couleur par sommet (dégradé)
function triC(g,a,b,c,ca,cb,cc,ua,ub,uc){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz);if(!l)return;nx/=l;ny/=l;nz/=l;
  g.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);g.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
  g.c.push(ca[0],ca[1],ca[2],cb[0],cb[1],cb[2],cc[0],cc[1],cc[2]);
  if(ua)g.u.push(ua[0],ua[1],ub[0],ub[1],uc[0],uc[1]);else g.u.push(0,0,0,0,0,0);
}
// mur : a, b en bas (couleur cb), c, d en haut (couleur ct)
function quadG(g,a,b,c,d,cb,ct,uv){if(uv){triC(g,a,b,c,cb,cb,ct,uv[0],uv[1],uv[2]);triC(g,a,c,d,cb,ct,ct,uv[0],uv[2],uv[3]);}else{triC(g,a,b,c,cb,cb,ct);triC(g,a,c,d,cb,ct,ct);}}
const AO_K=.84,AO_H=.55;  // pied des murs à 84 % (léger), dégradé sur 0,55 unité de haut
// a, b, c, d dans le sens trigonométrique vu de l'extérieur
function quad(g,a,b,c,d,col,uv){if(uv){tri(g,a,b,c,col,uv[0],uv[1],uv[2]);tri(g,a,c,d,col,uv[0],uv[2],uv[3]);}else{tri(g,a,b,c,col);tri(g,a,c,d,col);}}
// Boîte alignée (coordonnées monde). fac : null (uni), 'clé' (matériau), {k,bu,fu,y0} (façade à fenêtres)
function boxW(x0,y0,z0,x1,y1,z1,col,fac,top){
  const c=CC(col),ct=top?CC(top):c;let gs,gt,uvf=null;
  if(fac&&typeof fac==='object'){gs=G(fac.k);gt=G('plain');const b=fac.y0||0,v0=(y0-b)/fac.fu/4,v1=(y1-b)/fac.fu/4,bu=fac.bu*4;
    uvf=len=>{const u=len/bu;return[[0,v0],[u,v0],[u,v1],[0,v1]];};}
  else gs=gt=G(fac||'plain');
  const dx=x1-x0,dz=z1-z0;
  if(y0<.06&&y1-y0>.04&&!OVC){   // posé au sol : le pied du mur est plus sombre, le haut garde sa couleur
    const k=AO_K+(1-AO_K)*Math.min(1,y0/.06),t=Math.min(1,(y1-y0)/AO_H),kt=k+(1-k)*t;
    const cb=[c[0]*k,c[1]*k,c[2]*k],ct=[c[0]*kt,c[1]*kt,c[2]*kt];
    quadG(gs,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],cb,ct,uvf&&uvf(dz));
    quadG(gs,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],cb,ct,uvf&&uvf(dz));
    quadG(gs,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],cb,ct,uvf&&uvf(dx));
    quadG(gs,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],cb,ct,uvf&&uvf(dx));
  }else{
  quad(gs,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],c,uvf&&uvf(dz));
  quad(gs,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],c,uvf&&uvf(dz));
  quad(gs,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],c,uvf&&uvf(dx));
  quad(gs,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],c,uvf&&uvf(dx));}
  quad(gt,[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],ct);
}
// Repère local d'un bâtiment : centré sur le terrain, l'avant (+z) tourné vers la rue
const TX={x:0,z:0,k:0};
function P(lx,lz){switch(TX.k){case 1:return[TX.x+lz,TX.z-lx];case 2:return[TX.x-lx,TX.z-lz];case 3:return[TX.x-lz,TX.z+lx];default:return[TX.x+lx,TX.z+lz];}}
function V(lx,y,lz){const p=P(lx,lz);return[p[0],y,p[1]];}
function bx(lx0,lz0,lx1,lz1,y0,y1,col,fac,top){
  const a=P(lx0,lz0),b=P(lx1,lz1);
  boxW(Math.min(a[0],b[0]),y0,Math.min(a[1],b[1]),Math.max(a[0],b[0]),y1,Math.max(a[1],b[1]),col,fac,top);
}
function bc(cx,cz,hw,hd,y0,y1,col,fac,top){bx(cx-hw,cz-hd,cx+hw,cz+hd,y0,y1,col,fac,top);}
// Toit à deux pans (faîtage parallèle à x local si alongX)
function gable(lx0,lz0,lx1,lz1,y0,h,col,alongX,gcol){
  const g=G('plain'),c=CC(col),cg=CC(gcol||col);
  if(alongX){const mz=(lz0+lz1)/2,Dl=V(lx0,y0+h,mz),Dr=V(lx1,y0+h,mz);
    quad(g,V(lx0,y0,lz1),V(lx1,y0,lz1),Dr,Dl,c);quad(g,V(lx1,y0,lz0),V(lx0,y0,lz0),Dl,Dr,c);
    tri(g,V(lx0,y0,lz0),V(lx0,y0,lz1),Dl,cg);tri(g,V(lx1,y0,lz1),V(lx1,y0,lz0),Dr,cg);}
  else{const mx=(lx0+lx1)/2,Df=V(mx,y0+h,lz1),Db=V(mx,y0+h,lz0);
    quad(g,V(lx1,y0,lz1),V(lx1,y0,lz0),Db,Df,c);quad(g,V(lx0,y0,lz0),V(lx0,y0,lz1),Df,Db,c);
    tri(g,V(lx0,y0,lz1),V(lx1,y0,lz1),Df,cg);tri(g,V(lx1,y0,lz0),V(lx0,y0,lz0),Db,cg);}
}
// Bloc à dessus incliné : hauteur ya0 côté lz0, ya1 côté lz1 (auvents, sheds, panneaux)
function wedge(lx0,lz0,lx1,lz1,yb,ya0,ya1,col,bk){
  const g=G(bk||'plain'),c=CC(col);
  quad(g,V(lx0,ya1,lz1),V(lx1,ya1,lz1),V(lx1,ya0,lz0),V(lx0,ya0,lz0),c);
  quad(g,V(lx0,yb,lz1),V(lx1,yb,lz1),V(lx1,ya1,lz1),V(lx0,ya1,lz1),c);
  quad(g,V(lx1,yb,lz0),V(lx0,yb,lz0),V(lx0,ya0,lz0),V(lx1,ya0,lz0),c);
  quad(g,V(lx1,yb,lz1),V(lx1,yb,lz0),V(lx1,ya0,lz0),V(lx1,ya1,lz1),c);
  quad(g,V(lx0,yb,lz0),V(lx0,yb,lz1),V(lx0,ya1,lz1),V(lx0,ya0,lz0),c);
}
function cyl(lx,lz,y0,y1,r0,r1,seg,col,topCol,bk){
  const p=P(lx,lz),g=G(bk||'plain'),c=CC(col),ct=CC(topCol||col);
  for(let k=0;k<seg;k++){
    const a0=k/seg*6.28318,a1=(k+1)/seg*6.28318,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
    const A=[p[0]+c0*r0,y0,p[1]+s0*r0],B=[p[0]+c1*r0,y0,p[1]+s1*r0],C=[p[0]+c1*r1,y1,p[1]+s1*r1],Dd=[p[0]+c0*r1,y1,p[1]+s0*r1];
    if(r1>0){quad(g,B,A,Dd,C,c);tri(g,[p[0],y1,p[1]],C,Dd,ct);}else tri(g,B,A,Dd,c);
  }
}
function cone(lx,lz,y0,h,r,seg,col,bk){cyl(lx,lz,y0,y0+h,r,0,seg,col,null,bk);}
const ICO=(()=>{const g=new THREE.IcosahedronGeometry(1,0),a=(g.index?g.toNonIndexed():g).attributes.position.array.slice();g.dispose();return a;})();
function ico(lx,y,lz,r,col,sy,bk){
  const p=P(lx,lz),g=G(bk||'plain'),c=CC(col);sy=sy||1;
  for(let k=0;k<ICO.length;k+=9)tri(g,[p[0]+ICO[k]*r,y+ICO[k+1]*r*sy,p[1]+ICO[k+2]*r],[p[0]+ICO[k+3]*r,y+ICO[k+4]*r*sy,p[1]+ICO[k+5]*r],[p[0]+ICO[k+6]*r,y+ICO[k+7]*r*sy,p[1]+ICO[k+8]*r],c);
}
function tree3(lx,lz,s,conifer,col){
  bc(lx,lz,s*.18,s*.18,0,s*1.15,'#7a5236');
  if(conifer)cone(lx,lz,s*.75,s*2.4,s*.95,7,col||'#3f8a4c');else ico(lx,s*1.75,lz,s,col||'#5aa84a');
}
const CAR_COLS=['#e63946','#f1faee','#457b9d','#1d3557','#f4a261','#2a9d8f','#e9c46a','#8d99ae','#222831','#ffffff','#b5179e'];
function car3(lx,lz,along,col){
  col=col||CAR_COLS[(Math.abs(lx*97+lz*31)*7|0)%CAR_COLS.length];
  if(along){bc(lx,lz,.085,.045,.015,.07,col);bc(lx-.01,lz,.045,.04,.07,.11,'#3e4a55');}
  else{bc(lx,lz,.045,.085,.015,.07,col);bc(lx,lz-.01,.04,.045,.07,.11,'#3e4a55');}
}
function EMIT(kind,lx,y,lz){if(!CUR)return;const p=P(lx,lz);CUR.emit.push(p[0],y,p[1],kind==='smoke'?0:kind==='steam'?1:2);}
function pick(r,a){return a[(r()*a.length)|0];}
function parapet(cx,cz,w,d,h,col){
  const t=.025,p=.05;
  bx(cx-w/2,cz-d/2,cx+w/2,cz-d/2+t,h,h+p,col);bx(cx-w/2,cz+d/2-t,cx+w/2,cz+d/2,h,h+p,col);
  bx(cx-w/2,cz-d/2+t,cx-w/2+t,cz+d/2-t,h,h+p,col);bx(cx+w/2-t,cz-d/2+t,cx+w/2,cz+d/2-t,h,h+p,col);
}
function roofBits(r,cx,cz,w,d,h){const n=1+(r()*3|0);for(let k=0;k<n;k++){const s=.035+r()*.045;bc(cx+(r()-.5)*(w-.22),cz+(r()-.5)*(d-.22),s,s,h,h+.05+r()*.05,'#b9b6b0');}}

const PAL={
  rw:['#f4e9d8','#f2dcc6','#ead0ac','#f7f1e7','#e1e9ef','#efd5cf','#e9e3c9','#dfe7d6'],
  rr:['#c8553d','#b4503a','#8f5d4b','#6f6c78','#a8664a','#d27a3e','#7d8f99'],
  rw2:['#efe6da','#e7d3bf','#d9cfc1','#e4e9ec','#f0dcd2','#d8e2d3','#ece3cf'],
  rw3:['#e9e3da','#d8d2c9','#e2cfbb','#cdd8de','#d6ccc2','#e6dccb','#c9cfd6'],
  cw:['#f3f0ea','#e8eef2','#f4e4d4','#efe9f3','#e6efe6'],
  aw:['#e4572e','#2e86ab','#f2b134','#3fa34d','#a23b72','#ef6f6c','#4f6d7a'],
  gl:['#86b9d6','#8fc7c9','#9db3d8','#6fa6c4','#a6c9d9','#7fa9c9','#96bfb6'],
  ow:['#f1f3f5','#dfe5ea','#e9e4dc','#d6dde3','#e5e9ee'],
  iw:['#cfc8bd','#bdb6ab','#d9d2c3','#aba79f','#c8c2b4','#b9c1c6'],
  ir:['#8d8f93','#7a7f86','#a05a3c','#6f7a72','#98846a']
};
const FRs=y0=>({k:'res',bu:.2,fu:FH,y0:y0||0});
const FOf=y0=>({k:'off',bu:.16,fu:FH,y0:y0||0});
const FSh=(h,y0)=>({k:'shop',bu:.3,fu:h,y0:y0||0});
const FIn=h=>({k:'ind',bu:.26,fu:h,y0:0});

// =========================================================
// v7 (essai) : vrais modèles 3D — Kenney City Kit Suburban / Commercial (CC0), données dans js/city-models.js
// Chaque coin de triangle garde la couleur lue dans la texture du modèle (dégradés lisses) ; les toits (classe 1) et les murs (classe 2)
// prennent la couleur choisie en gardant leurs nuances, les vitres (classe 3) s'allument la nuit (matériau glass).
// =========================================================
const KM_H1=['h-a','h-g','h-h','h-i','h-p'],KM_H2=['h-c','h-e','h-k','h-o','h-r','h-s','h-u'];   // maisons de plain-pied / à étage
const KM_ROOF=['#c8553d','#b4503a','#8f5d4b','#6f6c78','#a8664a','#d27a3e','#7d8f99','#3f7fbf'];
const KM_TOP=['#d9d4cb','#cfc9bf','#d4d0c8','#c9cfd1','#d8cfc2'];
const KM_REF={1:'#4fba82',2:'#e6e6ef',4:'#5f657c'},KM_ROT={h:0,a:0};   // couleur d'origine de référence ; quart de tour pour mettre la porte côté rue
const KMD=new Map(),_kmL=new Map();
function kmOn(){return !!(KM_SRC&&S&&S.set&&S.set.km);}
function kmB64(s,T){const b=atob(s),u=new Uint8Array(b.length);for(let k=0;k<b.length;k++)u[k]=b.charCodeAt(k);return new T(u.buffer);}
function kmGet(n){
  let M=KMD.get(n);if(M!==undefined)return M;
  const R=KM_SRC&&KM_SRC.m[n];M=null;
  if(R){const v=kmB64(R.v,Int16Array),idx=kmB64(R.i,Uint16Array),t=kmB64(R.t,Uint16Array),p=new Float32Array(idx.length*3);
    for(let k=0;k<idx.length;k++){const j=idx[k]*3;p[k*3]=v[j]*R.q;p[k*3+1]=v[j+1]*R.q;p[k*3+2]=v[j+2]*R.q;}
    const nt=idx.length/3,nm=new Float32Array(nt*3);   /* normale de chaque triangle, calculée une fois */
    for(let k=0;k<nt;k++){const q=k*9,ux=p[q+3]-p[q],uy=p[q+4]-p[q+1],uz=p[q+5]-p[q+2],vx=p[q+6]-p[q],vy=p[q+7]-p[q+1],vz=p[q+8]-p[q+2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nm[k*3]=nx/l;nm[k*3+1]=ny/l;nm[k*3+2]=nz/l;}
    M={p,t,nm,w:R.w,d:R.d,h:R.h};}
  KMD.set(n,M);return M;
}
function kmLum(hex){let l=_kmL.get(hex);if(l==null){const c=C3(hex);l=.2126*c[0]+.7152*c[1]+.0722*c[2];_kmL.set(hex,l);}return l;}
function kmCol(tk,o){
  const cls=tk>>12,hex=KM_SRC.pal[tk&4095],tgt=cls===1?o.roof:cls===2?o.wall:cls===4?o.top:null;
  if(!tgt||OVC)return CC(hex);
  const q=kmLum(hex)/kmLum(KM_REF[cls]),c=CC(tgt),k=cls===4?clamp(.8+.2*q,.8,1.05):Math.min(1.12,q);   /* toits plats : nuances adoucies */
  return[Math.min(1,c[0]*k),Math.min(1,c[1]*k),Math.min(1,c[2]*k)];
}
// Dessine le modèle n sur le terrain courant (repère TX, rue côté +z). o.fit : taille max au sol ; o.x / o.z : décalage ;
// o.r : quarts de tour ; o.roof / o.wall / o.top (toit plat) : couleurs (null = celles du modèle) ; o.lit : fenêtres allumées la nuit. Renvoie la hauteur.
function km(n,o){
  const M=kmGet(n);if(!M)return 0;
  const s=o.s||Math.min(o.fit/M.w,o.fit/M.d),ox=o.x||0,oz=o.z||0,p=M.p,t=M.t,nm=M.nm,cc=new Map(),gP=G('plain'),gW=G(o.lit?'glass':'plain');
  /* modèle → terrain (quart de tour o.r, échelle, décalage) → monde (P, quart de tour TX.k) réunis en une seule rotation : rapide */
  const r=(o.r||0)&3,cs=[1,0,-1,0][r],sn=[0,1,0,-1][r],PK=[[1,0,0,1],[0,1,-1,0],[-1,0,0,-1],[0,-1,1,0]][TX.k];
  const A=PK[0]*cs+PK[1]*sn,B=PK[1]*cs-PK[0]*sn,C=PK[2]*cs+PK[3]*sn,D=PK[3]*cs-PK[2]*sn,tx=TX.x+PK[0]*ox+PK[1]*oz,tz=TX.z+PK[2]*ox+PK[3]*oz;
  const col=tk=>{let c=cc.get(tk);if(!c){c=kmCol(tk,o);cc.set(tk,c);}return c;};
  for(let k=0,nt=t.length/3;k<nt;k++){
    const q=k*9,g=(t[k*3]>>12)===3?gW:gP,nx=A*nm[k*3]+B*nm[k*3+2],ny=nm[k*3+1],nz=C*nm[k*3]+D*nm[k*3+2];
    const c0=col(t[k*3]),c1=col(t[k*3+1]),c2=col(t[k*3+2]);
    g.p.push(tx+s*(A*p[q]+B*p[q+2]),p[q+1]*s,tz+s*(C*p[q]+D*p[q+2]),tx+s*(A*p[q+3]+B*p[q+5]),p[q+4]*s,tz+s*(C*p[q+3]+D*p[q+5]),tx+s*(A*p[q+6]+B*p[q+8]),p[q+7]*s,tz+s*(C*p[q+6]+D*p[q+8]));
    g.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    g.c.push(c0[0],c0[1],c0[2],c1[0],c1[1],c1[2],c2[0],c2[1],c2[2]);
    g.u.push(0,0,0,0,0,0);
  }
  return M.h*s;
}

// =========================================================
// Bâtiments de zone (repère local : terrain [-0.5, 0.5]², rue côté +z)
// =========================================================
function aR1(r,v){
  if(kmOn()){   /* v7 : vraie maison 3D */
    const f=lotSpec(ZR,1,v).f,n=pick(r,f===1?KM_H1:KM_H2);
    const h=km(n,{fit:.78,z:-.06,r:KM_ROT.h,roof:r()<.3?null:pick(r,KM_ROOF),wall:r()<.5?null:pick(r,PAL.rw),top:pick(r,KM_TOP),lit:r()<.8});
    {const M_=kmGet(n);V15.kmDoor=M_?kmDoorPos(n,Math.min(.78/M_.w,.78/M_.d),0,-.06):null;}   /* v15 : position de la vraie porte du modèle */
    if(r()<.7){bx(-.48,.43,-.1,.47,0,.07,'#5c9a4c');bx(.1,.43,.48,.47,0,.07,'#5c9a4c');}   /* haie côté rue, comme avant */
    if(r()<.55)tree3((r()<.5?-1:1)*.4,-.42,.08+r()*.03,r()<.25);
    spot(.4,.33,false,0);   /* voiture garée devant la maison, surtout le soir */
    return h;}
  const f=lotSpec(ZR,1,v).f,w=.44+r()*.18,d=.36+r()*.14,h=f*FH+.05,zc=-.07,wall=pick(r,PAL.rw),roof=pick(r,PAL.rr);
  bc(0,zc,w/2,d/2,0,h,wall,FRs());
  const rh=.18+r()*.1;
  gable(-w/2-.04,zc-d/2-.04,w/2+.04,zc+d/2+.04,h,rh,roof,r()<.65,wall);
  if(r()<.5)bc(w*.25,zc-d*.12,.035,.035,h,h+rh+.06,'#8a6e60');
  bc(0,zc+d/2+.006,.05,.006,0,.17,'#6d5444');
  if(r()<.7){bx(-.48,.43,-.1,.47,0,.07,'#5c9a4c');bx(.1,.43,.48,.47,0,.07,'#5c9a4c');}
  if(r()<.65)tree3((r()<.5?-1:1)*.33,-.36,.1+r()*.05,r()<.25);
  spot(.37,.24,false,0);
  return h+rh;
}
function aR2(r,v){
  if(kmOn()){   /* v7 : vrai immeuble 3D */
    const f=lotSpec(ZR,2,v).f,n=pick(r,f<=3?['a-c','a-d']:f===4?['a-a','a-b','a-h']:['a-f','a-g']);
    return km(n,{fit:.86,r:KM_ROT.a,wall:r()<.35?null:pick(r,PAL.rw2),top:pick(r,KM_TOP),lit:r()<.85});}
  const f=lotSpec(ZR,2,v).f,w=.62+r()*.16,d=.54+r()*.16,zc=-.04,h=f*FH,wall=pick(r,PAL.rw2);
  bc(0,zc,w/2,d/2,0,h,wall,FRs(),'#c9c3b9');let top=h;
  if(r()<.45){const rh=.16+r()*.06;gable(-w/2-.03,zc-d/2-.03,w/2+.03,zc+d/2+.03,h,rh,pick(r,PAL.rr),true,wall);top+=rh;}
  else{parapet(0,zc,w,d,h,'#b8b2a8');roofBits(r,0,zc,w,d,h);top+=.08;}
  if(r()<.6)for(let k=1;k<f;k++)bx(-w/2+.05,zc+d/2,w/2-.05,zc+d/2+.06,k*FH-.025,k*FH,'#ece8e1');
  bx(-.09,zc+d/2,.09,zc+d/2+.07,.19,.21,'#6f7c88');
  if(r()<.5)tree3(-.39,.39,.08);
  return top;
}
// =========================================================
// v8 (13 nov. 2026) : bâtiments « grande ville » — balcons, rez-de-chaussée commerçants, corniches, toits-terrasses
// équipés, enseignes, murs-rideaux, socles, couronnements, quais de chargement. Inspiration : jeux de gestion de ville réalistes.
// =========================================================
PAL.br=['#b8664a','#a95c44','#c47b5b','#9e5d49','#c9906c','#b07258'];   // briques
function balc(x0,x1,zf,y0,n,col,rail){for(let k=0;k<n;k++){const y=y0+k*FH;bx(x0,zf,x1,zf+.06,y-.014,y,col||'#ebe8e2');bx(x0,zf+.053,x1,zf+.06,y,y+.055,rail||'#a9c6d4');bx(x0,zf,x0+.006,zf+.06,y,y+.055,rail||'#a9c6d4');bx(x1-.006,zf,x1,zf+.06,y,y+.055,rail||'#a9c6d4');}}
function balcX(xf,z0,z1,y0,n,col,rail){for(let k=0;k<n;k++){const y=y0+k*FH;bx(xf,z0,xf+.06,z1,y-.014,y,col||'#ebe8e2');bx(xf+.053,z0,xf+.06,z1,y,y+.055,rail||'#a9c6d4');}}
function cornice(w,d,y,col,cz){cz=cz||0;bx(-w/2-.014,cz-d/2-.014,w/2+.014,cz+d/2+.014,y,y+.028,col||'#efebe4');}
function canopy(cx,zf,w,y,col){bx(cx-w/2,zf,cx+w/2,zf+.1,y,y+.022,col||'#4d5862');bc(cx-w/2+.01,zf+.09,.007,.007,0,y,'#4d5862');bc(cx+w/2-.01,zf+.09,.007,.007,0,y,'#4d5862');}
function signB(cx,zf,w,y,col,h,k){h=h||.07;k=k||'basic';bx(cx-w/2,zf,cx+w/2,zf+.014,y,y+h,col,k);bx(cx-w/2+.03,zf+.014,cx+w/2-.03,zf+.018,y+h*.35,y+h*.62,'#ffffff',k);}
function roofKit(r,cx,cz,w,d,h){
  bc(cx+(r()-.5)*w*.3,cz+(r()-.5)*d*.3,.075,.06,h,h+.1,'#cfcbc4');                                                  // cage d'escalier
  const n=1+(r()*3|0);for(let k=0;k<n;k++){const x=cx+(r()-.5)*(w-.2),z=cz+(r()-.5)*(d-.2);bc(x,z,.036,.03,h,h+.045,'#b9bcbf');bx(x-.028,z-.022,x+.028,z+.022,h+.045,h+.05,'#8d9196');}   // groupes froids
  if(r()<.35){const x=cx+(r()<.5?-1:1)*w*.24,z=cz+(r()<.5?-1:1)*d*.24;for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]])bc(x+a*.03,z+b*.03,.006,.006,h,h+.08,'#6b5a4a');cyl(x,z,h+.08,h+.17,.045,.045,8,'#9a7350','#6b5240');}   // château d'eau
  else if(r()<.4){bx(cx-w*.3,cz-d*.3,cx+w*.05,cz+d*.05,h,h+.012,'#7fc46c');}                                          // toit végétalisé
  if(r()<.25)bc(cx,cz,.006,.006,h,h+.32,'#9a9a9a');
}
function truck(lx,lz,along,col){col=col||['#ffffff','#e8e8e8','#d94a3a','#2f6fd6'][(Math.abs((TX.x+lx)*97+(TX.z+lz)*31)*7|0)%4];
  if(along){bc(lx-.05,lz,.06,.04,.015,.12,col);bc(lx+.085,lz,.03,.036,.015,.095,'#3f6fb5');}else{bc(lx,lz-.05,.04,.06,.015,.12,col);bc(lx,lz+.085,.036,.03,.015,.095,'#3f6fb5');}}
function aR3(r,v){   // immeuble d'habitation (6 à 12 étages) : rez-de-chaussée commerçant, balcons, corniche, attique
  const f=lotSpec(ZR,3,v).f,brick=r()<.5,w=.76+r()*.1,d=.62+r()*.12,gb=FH*1.25,wall=brick?pick(r,PAL.br):pick(r,PAL.rw3),aw=pick(r,PAL.aw);
  bc(0,0,w/2+.012,d/2+.012,0,gb,'#d9d3c9',FSh(gb),'#c7c1b7');
  const att=f>7&&r()<.6,fm=att?f-1:f,h1=gb+(fm-1)*FH;
  bc(0,0,w/2,d/2,gb,h1,wall,FRs(gb),'#c4bfb6');
  cornice(w+.024,d+.024,gb-.03,'#efebe4');cornice(w,d,h1,brick?'#efe7dc':'#e9e4dc');let top=h1+.028;
  if(att){bc(0,-.05,w/2-.08,d/2-.1,top,top+FH*.9,'#f4f1eb',FOf(top),'#d6d2ca');bx(-w/2+.05,d/2-.15,w/2-.05,d/2-.02,top,top+.04,'#a9c6d4');top+=FH*.9;}
  parapet(0,0,w,d,top,'#e6e1d9');
  const bw=.1+r()*.04,cols=w>.82?[-.27,0,.27]:[-.21,.21];
  for(const c of cols)balc(c-bw,c+bw,d/2,gb+FH,fm-2);
  canopy(0,d/2+.012,.22,gb*.78);signB(-.26,d/2+.012,.2,gb*.72,aw,.05,'sign');
  roofKit(r,0,0,w-.1,d-.1,top);
  return top+.14;
}
function aR4(r,v){   // tour d'habitation (13 étages et plus) : socle, balcons en saillie sur deux façades, couronnement
  const f=lotSpec(ZR,4,v).f,wall=pick(r,PAL.rw3),pod=FH*2.2,w=.29+r()*.05,h=pod+(f-2)*FH,zc=-.04;
  bc(0,0,.45,.43,0,pod,'#d8d3ca',FSh(pod/2),'#c2bdb4');cornice(.9,.86,pod,'#ece8e1');
  bx(.12,.12,.42,.4,pod+.028,pod+.045,'#7fc46c');tree3(.3,.3,.06);tree3(.2,.36,.05);                                 // jardin sur le socle
  bc(0,zc,w,w,pod,h,wall,FRs(pod),'#b8b3aa');
  balc(-w+.02,-w*.15,zc+w,pod+FH,f-4);balc(w*.15,w-.02,zc+w,pod+FH*1.5,f-5);                                          // balcons en quinconce
  balcX(w,zc-w+.03,zc+w*.1,pod+FH,f-4);
  bc(0,zc,w+.012,w+.012,h,h+.03,'#ece8e1');
  bc(0,zc,w-.05,w-.05,h+.03,h+FH*.8,pick(r,PAL.gl),FOf(h),'#9fb0b8');                                                 // dernier étage vitré
  bx(-w+.04,zc-w+.04,w-.04,zc+w-.04,h+FH*.8,h+FH*.8+.02,'#e9eef1');
  bc(0,zc,.012,.012,h+FH*.8,h+FH*.8+.42,'#9b9b9b');bc(0,zc,.02,.02,h+FH*.8+.42,h+FH*.8+.45,'#ff4b4b','basic');
  return h+FH*.8+.3;
}
function aC1(r,v){   // petit commerce : vitrine, auvent, enseigne lumineuse, terrasse de café
  const f=lotSpec(ZC,1,v).f,w=.74+r()*.16,d=.54+r()*.14,zc=-.06,gh=FH*1.3,wall=pick(r,PAL.cw),aw=pick(r,PAL.aw),zf=zc+d/2;
  bc(0,zc,w/2,d/2,0,gh,wall,FSh(gh),'#cfc9bf');let top=gh;
  if(f>1){bc(0,zc,w/2,d/2,gh,gh+FH,r()<.5?pick(r,PAL.br):pick(r,PAL.rw2),FRs(gh),'#c6c0b6');top+=FH;}
  cornice(w,d,top,'#e8e3db',zc);parapet(0,zc,w,d,top+.028,'#d9d3ca');
  wedge(-w/2+.03,zf,w/2-.03,zf+.13,gh*.58,gh*.78,gh*.62,aw);
  signB(0,zf,w*.62,gh*.8,aw,.06,'sign');
  roofKit(r,0,zc,w-.1,d-.1,top+.028);
  if(r()<.6)for(const sx of[-.24,.08]){cyl(sx,.36,0,.07,.01,.01,5,'#555555');cyl(sx,.36,.07,.08,.045,.045,8,'#f4f1ea');cyl(sx,.36,.08,.19,.005,.005,4,'#777777');cone(sx,.36,.17,.05,.09,8,aw);}
  else spot(.36,.36,true,2);
  return top+.14;
}
function aC2(r,v){   // immeuble mixte (3 à 5 étages) : boutiques en bas, logements avec balcons au-dessus
  const f=lotSpec(ZC,2,v).f,w=.76+r()*.12,d=.64+r()*.12,gh=FH*1.4,brick=r()<.5,wall=brick?pick(r,PAL.br):pick(r,PAL.cw),h=gh+(f-1)*FH,zf=d/2;
  bc(0,0,w/2,d/2,0,gh,'#e5e0d8',FSh(gh),'#cfc9bf');
  bc(0,0,w/2-.01,d/2-.01,gh,h,wall,FRs(gh),'#bdb8ae');
  cornice(w,d,gh-.03,'#efebe4');cornice(w,d,h,'#efebe4');parapet(0,0,w,d,h+.028,'#e2ddd5');
  const a1=pick(r,PAL.aw),a2=pick(r,PAL.aw);
  wedge(-w/2+.03,zf,-.02,zf+.11,gh*.58,gh*.78,gh*.62,a1);wedge(.02,zf,w/2-.03,zf+.11,gh*.58,gh*.78,gh*.62,a2);
  signB(-w/4,zf,w*.36,gh*.8,a1,.05,'sign');signB(w/4,zf,w*.36,gh*.8,a2,.05,'sign');
  if(f>2){balc(-w/2+.07,-w/2+.25,zf-.01,gh+FH,f-2);balc(w/2-.25,w/2-.07,zf-.01,gh+FH,f-2);}
  roofKit(r,0,0,w-.12,d-.12,h+.028);
  return h+.18;
}
function aC3(r,v){   // grand magasin / galerie : socle vitré avec grande enseigne, tour au-dessus
  const f=lotSpec(ZC,3,v).f,pod=FH*2.2,g=pick(r,PAL.gl),aw=pick(r,PAL.aw),w=.32+r()*.06,d=.27+r()*.07,h=pod+(f-2)*FH;
  bc(0,0,.46,.44,0,pod,'#ebe7df',FSh(pod/2),'#d3cec5');cornice(.92,.88,pod,'#f2efea');
  bx(-.24,.44,.24,.455,.03,pod-.05,'#a9c9da',FOf(0),'#a9c9da');                                                         // atrium vitré
  signB(0,.455,.42,pod+.035,aw,.1,'sign');
  bc(0,-.08,w,d,pod+.028,h,g,FOf(pod),'#8fa0ad');
  for(const sx of[-1,1])bx(sx*w-.006,-.08-d,sx*w+.006,-.08+d,pod,h+.04,'#eef3f6');                                      // arêtes claires
  bc(0,-.08,w*.72,d*.72,h,h+.16,'#e3e9ec');
  roofKit(r,.32,.18,.18,.3,pod+.028);
  return h+.18;
}
function aC4(r,v){   // tour commerciale : socle, gradins, bandeau lumineux au sommet, flèche
  const f=lotSpec(ZC,4,v).f,pod=FH*2.2,g=pick(r,PAL.gl),aw=pick(r,PAL.aw);
  bc(0,0,.47,.47,0,pod,'#e2ded6',FSh(FH),'#cbc5bb');cornice(.94,.94,pod,'#f2efea');signB(0,.47,.5,pod*.62,aw,.08,'sign');
  let w=.35+r()*.04,y=pod+.028;const tiers=2+(r()*2|0),per=Math.ceil((f-2)/tiers);
  for(let t=0;t<tiers;t++){const fl=Math.min(per,f-2-t*per);if(fl<=0)break;const y1=y+fl*FH;bc(0,0,w,w,y,y1,g,FOf(y),'#93a3af');
    for(const sx of[-1,1])for(const sz of[-1,1])bc(sx*w,sz*w,.008,.008,y,y1,'#f1f5f7');bx(-w-.01,-w-.01,w+.01,w+.01,y1,y1+.025,'#eef2f4');y=y1+.025;w*=.8;}
  bx(-w,-w,w,w,y,y+.05,aw,'basic');bc(0,0,w*.9,w*.9,y+.05,y+.14,'#dfe6ea');
  const sp=.55+r()*.6;bc(0,0,.012,.012,y+.14,y+.14+sp,'#c9c9c9');bc(0,0,.024,.024,y+.14+sp,y+.18+sp,'#ff4b4b','basic');
  return y+.2+sp;
}
function aO1(r,v){   // bureaux bas : bandeaux vitrés, auvent d'entrée, parking
  const f=lotSpec(ZO,1,v).f,w=.62+r()*.12,d=.56+r()*.1,h=f*FH,zc=-.08,x0=-.1;
  bc(x0,zc,w/2,d/2,0,h,pick(r,PAL.ow),FOf(),'#d5d9dc');cornice(w,d,h,'#f4f6f8',zc);
  bx(x0-w/2,zc-d/2,x0+w/2,zc+d/2,h+.028,h+.034,'#dfe4e8');
  canopy(x0,zc+d/2,.24,FH*.8,'#2c4a73');signB(x0+.18,zc+d/2,.16,h-.1,'#2c4a73',.05);
  bx(.3,-.46,.48,.46,0,.006,'#6b7178');for(let k=0;k<3;k++)bx(.3,-.3+k*.22,.48,-.29+k*.22,.006,.008,'#f2f2f2');           // parking
  spot(.39,-.2,true,1);spot(.39,.02,true,1);spot(.39,.24,true,1);   /* v10 : places de parking qui se remplissent le jour */
  roofKit(r,x0,zc,w-.12,d-.12,h+.034);
  return h+.16;
}
function aO2(r,v){   // bureaux moyens : boîte de verre à ailettes verticales
  const f=lotSpec(ZO,2,v).f,w=.7+r()*.12,d=.62+r()*.12,h=f*FH,g=pick(r,PAL.gl);
  bc(0,0,w/2,d/2,0,FH*1.1,'#5b6770',FSh(FH*1.1),'#4d5760');
  bc(0,0,w/2-.02,d/2-.02,FH*1.1,h,g,FOf(FH*1.1),'#9aa7b1');
  for(let x=-w/2+.06;x<w/2-.03;x+=.09)bx(x-.008,d/2-.02,x+.008,d/2+.025,FH*1.1,h,'#eef2f5');                             // ailettes
  bx(-w/2+.01,-d/2+.01,w/2-.01,d/2-.01,h,h+.04,'#e8ecef');canopy(0,d/2,.26,FH*.85,'#2c4a73');
  roofKit(r,0,0,w-.14,d-.14,h+.04);
  return h+.16;
}
function aO3(r,v){   // tour de bureaux : socle, ailettes sur les angles, couronnement vitré
  const f=lotSpec(ZO,3,v).f,pod=FH*1.5,w=.34+r()*.06,h=pod+(f-1.5)*FH,c=pick(r,PAL.ow);
  bc(0,0,.44,.42,0,pod,'#c9ced3',FSh(pod),'#b5bbc1');cornice(.88,.84,pod,'#eef1f4');
  bc(0,0,w,w-.02,pod+.028,h,c,FOf(pod),'#c4cbd1');
  for(const s_ of[-1,1]){bc(s_*(w+.006),0,.012,w-.02,pod,h+.1,'#f4f6f8');bc(0,s_*(w-.014),w,.008,h-.02,h+.02,'#f4f6f8');}
  bc(0,0,w-.06,w-.08,h,h+.2,'#9fb6c6',FOf(h));bx(-w+.04,-w+.06,w-.04,w-.06,h+.2,h+.215,'#e8ecef');
  roofKit(r,0,0,w*1.2,w*1.2,h+.215);
  return h+.25;
}
function aO4(r,v){   // gratte-ciel : socle, deux gradins, sommet effilé, héliport ou flèche
  const f=lotSpec(ZO,4,v).f,pod=FH*2,g=pick(r,PAL.gl);
  bc(0,0,.46,.46,0,pod,'#cfd4d9',FSh(FH),'#bcc2c8');cornice(.92,.92,pod,'#eef1f4');canopy(0,.46,.3,FH*.9,'#2c4a73');
  let w=.36,y=pod+.028;const fl=f-2,a=Math.ceil(fl*.6);
  bc(0,0,w,w,y,y+a*FH,g,FOf(y),'#8a9aa6');for(const sx of[-1,1])for(const sz of[-1,1])bc(sx*w,sz*w,.01,.01,y,y+a*FH,'#eef3f6');y+=a*FH;
  bx(-w-.01,-w-.01,w+.01,w+.01,y,y+.03,'#eef2f4');y+=.03;
  bc(0,0,w*.8,w*.8,y,y+(fl-a)*FH,g,FOf(y),'#8a9aa6');y+=(fl-a)*FH;
  bx(-w*.8,-w*.8,w*.8,w*.8,y,y+.06,'#2dd4bf','basic');
  if(r()<.5){bc(0,0,w*.62,w*.62,y+.06,y+.26,'#dfe6ea');cyl(0,0,y+.26,y+.275,w*.5,w*.5,16,'#5b6770','#5b6770');bx(-.04,-.006,.04,.006,y+.276,y+.279,'#ffffff','basic');bx(-.04,-.05,-.03,.05,y+.276,y+.279,'#ffffff','basic');bx(.03,-.05,.04,.05,y+.276,y+.279,'#ffffff','basic');return y+.3;}   // héliport « H »
  bc(0,0,w*.6,w*.6,y+.06,y+.3,'#dfe6ea');cone(0,0,y+.3,.35,w*.42,4,'#cfd8de');bc(0,0,.01,.01,y+.65,y+1.05,'#c9c9c9');
  return y+1.05;
}
function aI1(r){   // entrepôt : toit en dents de scie, quais de chargement, camions
  const w=.84,d=.6,h=.32+r()*.08,zc=-.12,wall=pick(r,PAL.iw),rf=pick(r,PAL.ir);
  bc(0,zc,w/2,d/2,0,h,wall,FIn(h),rf);
  for(let k=0;k<4;k++){const z0=zc-d/2+k*d/4;wedge(-w/2,z0,w/2,z0+d/4,h,h+.1,h,rf);bx(-w/2+.02,z0+d/4-.012,w/2-.02,z0+d/4,h,h+.1,'#a9c0cc');}
  for(let k=0;k<3;k++){const x=-.3+k*.3;bx(x-.07,zc+d/2,x+.07,zc+d/2+.006,0,.16,'#c9ccce');bx(x-.08,zc+d/2,x+.08,zc+d/2+.05,.16,.175,'#5b6770');}   // quais
  truck(-.3,.33,false);if(r()<.6)truck(.3,.33,false);
  for(const sx of[-1,1])bx(sx*.47,-.46,sx*.47+.008*sx,.46,0,.09,'#9aa0a6');
  return h+.12;
}
function aI2(r){   // usine : halle, cheminée qui fume, silos, tapis
  const w=.8,d=.6,h=.46+r()*.1,wall=pick(r,PAL.iw);
  bc(-.04,-.06,w/2,d/2,0,h,wall,FIn(h),pick(r,PAL.ir));
  for(let k=0;k<3;k++)bx(-w/2+.08+k*.24,-.34,-w/2+.2+k*.24,.2,h,h+.03,'#a9c0cc');
  cyl(.32,-.3,h*.5,h+.85,.055,.045,10,'#b54b3a');cyl(.32,-.3,h+.72,h+.85,.047,.046,10,'#f1f1f1');EMIT('smoke',.32,h+.92,-.3);
  for(const [x,z] of[[-.3,.34],[-.1,.36]]){cyl(x,z,0,.5,.085,.085,12,'#d6dadd','#c2c7cb');cone(x,z,.5,.06,.085,12,'#b8bdc1');}
  bx(-.2,.3,.1,.32,.38,.4,'#8d9196');truck(.3,.35,true);
  return h+.9;
}
function aI3(r){   // industrie lourde : cuves, tuyaux, cheminées, torchère
  const wall=pick(r,PAL.iw);
  bx(-.46,-.46,.12,.2,0,.62,wall,FIn(.31),'#7d8186');
  bx(.16,-.46,.46,.0,0,.4,pick(r,PAL.iw),FIn(.4),'#8d9095');
  for(const [cx,cz,hh] of[[-.3,.34,1.25],[-.12,.34,1.05]]){cyl(cx,cz,0,hh,.05,.04,10,'#9da3a8');cyl(cx,cz,hh-.1,hh,.042,.041,10,'#d94a3a');EMIT('smoke',cx,hh+.06,cz);}
  for(const [x,z] of[[.3,.24],[.22,.4]]){cyl(x,z,0,.16,.08,.08,14,'#e8ebed','#d5d9dc');bx(x-.08,z-.004,x+.08,z+.004,.08,.09,'#c45a3a');}
  bx(.12,.06,.46,.1,.3,.34,'#a0a6ab');bx(.12,-.02,.16,.32,.08,.32,'#a0a6ab');bx(-.02,.18,.3,.2,.2,.22,'#c9a24a');
  bc(.42,-.36,.008,.008,0,.6,'#7d8186');cone(.42,-.36,.6,.08,.02,6,'#ff8a1f','fire');
  return 1.3;
}
const ARCH={1:[null,aR1,aR2,aR3,aR4],2:[null,aC1,aC2,aC3,aC4],3:[null,aI1,aI2,aI3,aI3],4:[null,aO1,aO2,aO3,aO4]};
function aSite(r,zn,l,v){
  const sp=lotSpec(zn,l,v),H=Math.max(.35,sp.f*FH*(zn===ZI?1.2:1)),w=zn===ZI?.8:.62,fc='#f2a03d',stg=SITEP<.34?0:SITEP<.67?1:2;
  bx(-.47,-.47,.47,-.45,0,.08,fc);bx(-.47,.45,.47,.47,0,.08,fc);bx(-.47,-.45,-.45,.45,0,.08,fc);bx(.45,-.45,.47,.45,0,.08,fc);
  if(stg===0){   /* terrassement : terre, dalle, fers à béton, pelleteuse, ouvriers */
    bx(-w/2,-w/2,w/2,w/2,0,.012,'#8a6a4a');bx(-w/2+.04,-w/2+.04,w/2-.04,w/2-.04,.012,.03,'#bdb7ad');
    for(let k=0;k<5;k++)for(let j=0;j<5;j++)bc(-w/2+.08+k*(w-.16)/4,-w/2+.08+j*(w-.16)/4,.004,.004,.03,.09,'#7a4f3a');
    bc(.3,.3,.06,.04,.01,.06,'#f2b134');bc(.3,.3,.035,.03,.06,.1,'#f2b134');bx(.2,.29,.3,.31,.08,.1,'#f2b134');bx(.17,.28,.21,.32,.02,.09,'#3b3f44');
    worker(-.2,.32);worker(.05,-.3);return .15;}
  if(stg===1){   /* structure : planchers et poteaux en béton */
    const fl=Math.max(1,Math.round(H*.6/FH));for(let k=0;k<=fl;k++)bx(-w/2,-w/2,w/2,w/2,k*FH,k*FH+.02,'#c9c4bb');
    for(const sx of[-1,0,1])for(const sz of[-1,0,1])bc(sx*(w/2-.02),sz*(w/2-.02),.012,.012,0,fl*FH,'#bdb7ad');
    worker(.12,.36);worker(-.26,-.36);worker(0,0);
    if(l>=3||H>1.4){const mx=w/2+.12,mz=-w/2+.05,top=H+.7;bc(mx,mz,.03,.03,0,top,'#f4b400');bx(mx-.9,mz-.025,mx+.3,mz+.025,top,top+.05,'#f4b400');bc(mx+.24,mz,.06,.045,top-.09,top,'#7a7a7a');bc(mx-.6,mz,.005,.005,top-.6,top,'#444444');}
    return fl*FH+.05;}
  bc(0,0,w/2,w/2,0,H*.42,'#bdb7ad');
  for(const sx of[-1,1])for(const sz of[-1,1])bc(sx*w/2,sz*w/2,.012,.012,0,H*.72,'#8d8d8d');
  for(let y=FH*2;y<H*.72;y+=FH*2){bc(0,w/2,w/2,.01,y,y+.016,'#9a9a9a');bc(0,-w/2,w/2,.01,y,y+.016,'#9a9a9a');}
  if(l>=3||H>1.4){const mx=w/2+.12,mz=-w/2+.05,top=H+.7;
    bc(mx,mz,.03,.03,0,top,'#f4b400');bx(mx-.9,mz-.025,mx+.3,mz+.025,top,top+.05,'#f4b400');
    bc(mx+.24,mz,.06,.045,top-.09,top,'#7a7a7a');bc(mx-.6,mz,.005,.005,top-.6,top,'#444444');}
  else bc(.3,.3,.06,.04,0,.08,'#c9a979');
  return H*.72;
}
function aRuin(r){
  for(let k=0;k<8;k++){const s=.05+r()*.08;bc((r()-.5)*.6,(r()-.5)*.6,s,s*.8,0,.04+r()*.12,r()<.5?'#5b5752':'#3f3c39');}
  bc(-.2,-.1,.02,.02,0,.35,'#2e2b29');bc(.18,.12,.02,.02,0,.25,'#2e2b29');
  return .4;
}
function flames(r,top){for(let k=0;k<5;k++)cone((r()-.5)*.4,(r()-.5)*.4,top-.03,.12+r()*.22,.05+r()*.05,6,k%2?'#ffb31a':'#ff5a1f','fire');}

// =========================================================
// Bâtiments de service (repère local centré sur l'emprise, entrée côté +z)
// =========================================================
function flag(x,z,h){bc(x,z,.012,.012,0,h,'#d0d0d0');const y=h-.13;bx(x+.012,z-.005,x+.06,z+.005,y,h,'#2c4fa3','basic');bx(x+.06,z-.005,x+.108,z+.005,y,h,'#f5f5f5','basic');bx(x+.108,z-.005,x+.156,z+.005,y,h,'#e03a3a','basic');}
function bench(x,z,along){if(along)bc(x,z,.07,.02,.03,.055,'#8a5a3b');else bc(x,z,.02,.07,.03,.055,'#8a5a3b');}
function lamp(x,z){bc(x,z,.008,.008,0,.32,'#4a4f55');bc(x,z,.02,.02,.32,.35,'#fff1c9','basic');}
function cross(cx,y,cz,s,col){bc(cx,cz,s*.3,.012,y-s,y+s,col,'basic');bc(cx,cz,s,.012,y-s*.3,y+s*.3,col,'basic');}
function coolTower(cx,cz,h){cyl(cx,cz,0,h*.38,.56,.42,12,'#d9d4cc');cyl(cx,cz,h*.38,h*.78,.42,.37,12,'#d2cdc5');cyl(cx,cz,h*.78,h,.37,.42,12,'#d9d4cc','#5f5b56');}
// Côté où se trouve l'eau, exprimé dans le repère local du bâtiment
function waterDirLocal(s){
  const W=[[0,1],[1,0],[0,-1],[-1,0]];let best=null,bn=0;
  for(const [wx,wz] of W){let n=0;
    const fw=(x,z)=>isW(x,z)&&!road[z*N+x];
    if(wz)for(let x=s.x;x<s.x+s.w;x++){if(fw(x,wz>0?s.z+s.d:s.z-1))n++;}
    else for(let z=s.z;z<s.z+s.d;z++){if(fw(wx>0?s.x+s.w:s.x-1,z))n++;}
    if(n>bn){bn=n;best=[wx,wz];}}
  if(!best)return[0,-1];
  const [wx,wz]=best;return[[wx,wz],[-wz,wx],[-wx,-wz],[wz,-wx]][TX.k];
}
const SVB={
  landfill(r){
    for(const [x,z,sz] of[[-.75,-.6,.55],[.35,-.75,.5],[-.25,.25,.45],[.75,.25,.4]]){cone(x,z,0,sz*.7,sz,7,'#8d7f6a');ico(x+.1,sz*.32,z+.05,sz*.42,'#a8977c',.55);}
    bx(.85,.85,1.4,1.4,0,.36,'#cfd5da',FRs(),'#9aa5ad');bc(-.95,1.1,.2,.09,.02,.2,'#2e7d32');bc(-1.18,1.1,.06,.08,.02,.17,'#e0e0e0');
    return .7;},
  incin(r){
    bx(-.9,-.55,.45,.85,0,.8,'#b9b2a6',FIn(.4),'#7d776f');bx(.45,.15,.9,.85,0,.45,'#a7a094',FIn(.45),'#6f6a63');
    for(let k=0;k<4;k++)cyl(.55,-.5,k*.55,(k+1)*.55,.12-.01*k,.11-.01*k,10,k===3?'#c94b3a':'#d2ccc2');
    EMIT('smoke',.55,2.28,-.5);return 2.3;},
  recycle(r){
    bx(-.9,-.85,.9,.25,0,.55,'#6fae6a',FIn(.55),'#4f8a4b');
    ['#f2c14e','#3b8fdc','#45b36b','#8d6e63'].forEach((col,k)=>bc(-.6+k*.4,.62,.13,.1,0,.18,col));
    wedge(-.3,.25,.3,.45,.3,.36,.3,'#9fd3a8');bx(-.15,.25,.15,.27,.35,.5,'#2fa36b','basic');
    return .8;},
  mairie(r){   // mairie (13 nov. 2026) : façade classique, portique à colonnes et fronton, beffroi à horloge, parvis avec fontaine
    const wl='#efe6d3',t=FH*2.4;
    bx(-.85,-.75,.85,.3,0,t,wl,FRs());bx(-.87,-.77,.87,.32,t-.02,t+.01,'#f7f1e4');gable(-.89,-.79,.89,.34,t,.3,'#5e6b78',true,wl);
    for(const x of[-.3,-.15,0,.15,.3])cyl(x,.42,.04,FH*1.7,.024,.024,8,'#f6f1e6');bx(-.38,.3,.38,.5,FH*1.7,FH*1.7+.04,'#f3ecdd');gable(-.38,.3,.38,.5,FH*1.7+.04,.12,'#efe6d3',true,'#efe6d3');
    bx(-.4,.3,.4,.56,0,.02,'#d9d0bd');bx(-.36,.3,.36,.52,.02,.04,'#d9d0bd');
    bc(0,-.2,.2,.2,t,t+.6,wl,FRs(t));bc(0,-.2,.215,.215,t+.6,t+.63,'#f7f1e4');cone(0,-.2,t+.63,.35,.22,4,'#5e6b78');
    bx(-.075,.0,.075,.008,t+.29,t+.44,'#ffffff','basic');bx(-.004,.008,.004,.012,t+.36,t+.42,'#2b2b2b');bx(-.004,.008,.04,.012,t+.362,t+.37,'#2b2b2b');
    cyl(0,.78,0,.05,.16,.16,14,'#cfc8bd','#cfc8bd');if(waterOK())cyl(0,.78,.05,.055,.13,.13,14,'#5bc0eb','#5bc0eb','basic');else cyl(0,.78,.05,.055,.13,.13,14,'#b8b0a2','#b8b0a2');cyl(0,.78,.05,.16,.02,.02,6,'#cfc8bd');
    flag(-.62,.62,.8);flag(.62,.62,.8);tree3(-.8,.84,.09);tree3(.8,.84,.09);lamp(-.32,.75);lamp(.32,.75);
    return t+1;},
  sante(r){
    bx(-.85,-.75,.85,.3,0,FH*2,'#f4f8f6',FOf(),'#d8e4df');parapet(0,-.225,1.7,1.05,FH*2,'#cfdcd6');
    cross(0,FH*2-.14,.31,.1,'#2fa36b');wedge(-.3,.3,.3,.55,.27,.31,.28,'#2fa36b');
    tree3(-.75,.75,.08);tree3(.75,.75,.08);bench(.4,.7,true);
    return .9;},
  biblio(r){
    bx(-.85,-.75,.85,.3,0,FH*2.2,'#d9c7a8',FRs(),'#b9a789');
    bx(-.35,.3,.35,.32,.05,FH*1.8,'#8fb3c7');
    for(let k=0;k<4;k++)cyl(-.45+k*.3,.42,0,FH*2,.03,.03,8,'#efe6d6');
    bx(-.55,.3,.55,.5,FH*2,FH*2+.05,'#e6dcc8');bx(-.14,.505,.14,.515,FH*2-.12,FH*2-.02,'#7a4b2e','basic');
    tree3(-.78,.75,.08);return .8;},
  gym(r){
    bx(-.85,-.7,.85,.35,0,FH*2.2,'#e8eef2',FOf(),'#c9d3da');bx(-.86,.35,.86,.37,FH*1.25,FH*1.55,'#ff8c42','basic');
    const y=FH*2.2;bc(-.27,-.2,.01,.01,y,y+.12,'#6b7177');bc(.27,-.2,.01,.01,y,y+.12,'#6b7177');
    bx(-.27,-.22,.27,-.18,y+.1,y+.14,'#6b7177');bc(-.27,-.2,.04,.09,y+.03,y+.21,'#3d4247');bc(.27,-.2,.04,.09,y+.03,y+.21,'#3d4247');
    tree3(.75,.75,.08);return .95;},
  bus(r){
    bc(0,-.05,.32,.03,0,.02,'#d0d0d0');bx(-.25,-.12,.25,-.1,0,.22,'#a9d6ea');bx(-.27,-.13,.27,.08,.22,.24,'#5b6770');
    bc(-.25,-.02,.01,.1,0,.22,'#8d949b');bc(.25,-.02,.01,.1,0,.22,'#8d949b');bench(0,-.06,true);
    bc(.38,.3,.012,.012,0,.36,'#8d949b');bc(.38,.3,.06,.012,.3,.38,'#2f6fd6','basic');
    return .45;},
  metro(r){
    bx(-.6,-.35,.6,.35,0,.4,'#a8bccb',FOf(),'#8aa0b0');wedge(-.65,.35,.65,.75,.32,.4,.34,'#9fc3d6');bx(-.3,.36,.3,.75,0,.02,'#3a4048');
    bc(.75,.75,.02,.02,0,.75,'#5b6770');bx(.66,.74,.84,.76,.62,.8,'#e63946','basic');
    bx(-.9,-.9,-.65,-.65,0,.3,'#c9d1d6');tree3(-.8,.8,.08);return .9;},
  gare(r){
    const wl='#e8dcc4';
    bx(-1.4,-.3,1.4,.6,0,.85,wl,FRs());gable(-1.44,-.34,1.44,.64,.85,.35,'#7d5a4a',true,wl);
    bc(0,.75,.22,.17,0,1.55,wl,FRs());cone(0,.75,1.55,.35,.3,4,'#7d5a4a');bx(-.09,.92,.09,.93,1.2,1.38,'#ffffff','basic');
    wedge(-1.45,-1.35,1.45,-.3,.5,.62,.55,'#cfd5da');
    for(const z of[-.98,-.82])bx(-1.5,z-.012,1.5,z+.012,0,.03,'#6d6a66');
    for(let k=0;k<12;k++)bx(-1.45+k*.26,-1.02,-1.37+k*.26,-.78,0,.012,'#8a6a4f');
    bx(-1.45,-.74,1.45,-.62,0,.05,'#d9d4cc');for(const x of[-.9,0,.9])bc(x,-.68,.008,.008,.05,.3,'#5b6770');   /* quai ; le train arrive et repart (stepTrains) */
    return 1.9;},
  cinema(r){
    bx(-.85,-.75,.85,.3,0,.85,'#463a5c',null,'#3a3050');bx(-.7,.3,.7,.36,.48,.66,'#ffd23f','basic');bx(-.86,.25,.86,.45,.42,.46,'#2d2540');
    [-.55,-.2,.2,.55].forEach((x,k)=>bx(x-.1,.3,x+.1,.31,.08,.36,['#e63946','#3b8fdc','#f08c3a','#45b36b'][k],'basic'));
    bx(-.15,.3,.15,.31,0,.2,'#1e1a26');return 1;},
  marina(r,s){
    const dl=waterDirLocal(s);
    bc(-dl[0]*.45,-dl[1]*.45,.3,.24,0,.45,'#f4f6f8',FRs(),'#3b6fb0');
    for(const off of[-.55,0,.55]){
      if(dl[0])bx(Math.min(0,1.6*dl[0]),off-.04,Math.max(0,1.6*dl[0]),off+.04,.01,.05,'#a8865e');
      else bx(off-.04,Math.min(0,1.6*dl[1]),off+.04,Math.max(0,1.6*dl[1]),.01,.05,'#a8865e');
    }
    for(const off of[-.3,.3]){const a=1.25,px=dl[0]?a*dl[0]:off,pz=dl[0]?off:a*dl[1];
      if(dl[0])bc(px,pz,.17,.06,-.05,.03,'#ffffff');else bc(px,pz,.06,.17,-.05,.03,'#ffffff');
      bc(px,pz,.008,.008,.03,.5,'#c9c9c9');if(dl[0])bx(px-.12,pz-.005,px,pz+.005,.08,.45,'#f4f4f4');else bx(px-.005,pz-.12,px+.005,pz,.08,.45,'#f4f4f4');}
    bench(.5*(dl[1]?1:0),.5*(dl[0]?1:0),!!dl[1]);
    return .8;},
  wheel(r){
    bc(0,0,.6,.35,0,.06,'#d9d4cc');
    for(const sz of[-1,1]){bc(-.32,sz*.14,.035,.035,.06,1.2,'#8d949b');bc(.32,sz*.14,.035,.035,.06,1.2,'#8d949b');bx(-.32,sz*.14-.03,.32,sz*.14+.03,1.15,1.22,'#8d949b');}
    if(CUR){const p=V(0,1.2,0);CUR.wh.push(p[0],p[1],p[2],TX.k,1);}
    bc(.62,.62,.12,.1,0,.22,'#e63946');return 2.3;},
  musee(r){
    const wl='#f0ebe1';
    bx(-1.35,-1.25,1.35,.45,0,FH*3,wl,FRs(),'#ddd6c8');
    for(let k=0;k<8;k++)cyl(-1.05+k*.3,.6,0,FH*3,.045,.045,8,'#f7f3ec');
    bx(-1.25,.45,1.25,.75,FH*3,FH*3+.06,'#e9e2d4');gable(-1.25,.45,1.25,.75,FH*3+.06,.2,'#e9e2d4',true,'#f3ede2');
    cone(0,1.12,0,.42,.36,4,'#a9d6ea');tree3(-1.2,1.2,.1);tree3(1.2,1.2,.1);
    return 1.4;},
  funfair(r){
    for(const sz of[-1,1]){bc(-1.25,-1.2+sz*.14,.035,.035,0,1.3,'#8d949b');bc(-.65,-1.2+sz*.14,.035,.035,0,1.3,'#8d949b');}
    if(CUR){const p=V(-.95,1.3,-1.2);CUR.wh.push(p[0],p[1],p[2],TX.k,1.05);}
    const tp=k=>{const a=k/36*6.2832;return[.75+Math.cos(a),.56+.28*Math.sin(a*3)+.18*Math.cos(a),.35+Math.sin(a)*1.25];};
    for(let k=0;k<36;k++){const a=tp(k),b=tp(k+1),dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,nx=-dz/l*.05,nz=dx/l*.05;
      quad(G('plain'),V(a[0]-nx,a[1],a[2]-nz),V(a[0]+nx,a[1],a[2]+nz),V(b[0]+nx,b[1],b[2]+nz),V(b[0]-nx,b[1],b[2]-nz),CC('#e63946'));
      quad(G('plain'),V(a[0]+nx,a[1]-.03,a[2]+nz),V(a[0]-nx,a[1]-.03,a[2]-nz),V(b[0]-nx,b[1]-.03,b[2]-nz),V(b[0]+nx,b[1]-.03,b[2]+nz),CC('#b52d3a'));
      if(k%3===0)bc(a[0],a[2],.012,.012,0,a[1]-.02,'#9aa0a6');}
    bc(tp(0)[0],tp(0)[2],.09,.05,tp(0)[1],tp(0)[1]+.07,'#3b8fdc');
    cyl(-1.1,1.1,0,.08,.42,.42,12,'#f2c14e');cyl(-1.1,1.1,.08,.4,.04,.04,6,'#e9e9e9');cone(-1.1,1.1,.4,.3,.48,12,'#e63946');
    for(let k=0;k<6;k++){const a=k/6*6.28;bc(-1.1+Math.cos(a)*.3,1.1+Math.sin(a)*.3,.04,.04,.1,.2,['#3b8fdc','#45b36b','#f08c3a'][k%3]);}
    for(let k=0;k<3;k++){const x=-.3+k*.45;bc(x,1.65,.15,.12,0,.22,'#f4f6f8');wedge(x-.17,1.5,x+.17,1.77,.22,.3,.24,['#e63946','#3b8fdc','#f2c14e'][k]);}
    bc(-.35,1.9,.04,.04,0,.6,'#7d5a4a');bc(.35,1.9,.04,.04,0,.6,'#7d5a4a');bx(-.42,1.86,.42,1.94,.55,.7,'#ff6b9d','basic');
    return 2.8;},
  observ(r){
    cyl(0,-.2,0,.75,.85,.85,16,'#e9e6df','#dcd8cf');ico(0,.75,-.2,.85,'#f4f4f4',.85);bx(-.08,.3,.08,.56,.9,1.42,'#3a4048');
    bx(-1.3,.45,-.45,1.25,0,.5,'#d9d4cc',FRs(),'#bfb9ae');tree3(1,1,.11);tree3(.6,1.2,.09);
    return 1.7;},
  arc(r){
    const c='#e9dcc2';
    bx(-.85,-.35,-.35,.35,0,1.55,c,null,'#ded0b4');bx(.35,-.35,.85,.35,0,1.55,c,null,'#ded0b4');bx(-.35,-.33,.35,.33,1.3,1.55,'#ded0b4');
    bx(-.9,-.38,.9,.38,1.55,2.05,c,null,'#ded0b4');bx(-.92,-.4,.92,.4,1.75,1.82,'#e3b23c','basic');
    return 2.2;},
  wind(r){bc(0,0,.16,.16,0,.04,'#cdc8bf');cyl(0,0,.04,2.05,.05,.03,8,'#f4f4f4');bc(0,-.02,.045,.1,2.02,2.12,'#ececec');
    if(CUR){const p=V(0,2.07,.1);CUR.rot.push(p[0],p[1],p[2],TX.k);}return 2.5;},
  coal(r){
    bx(-1.35,.1,-.1,1.35,0,.9,'#a7a299',FIn(.45),'#7d7a75');
    bx(.05,.45,1.35,1.35,0,.55,'#8f8b85',FIn(.55),'#6d6a66');
    for(const [cx,cz] of[[-.75,-.75],[.55,-.75]]){coolTower(cx,cz,1.7);EMIT('steam',cx,1.8,cz);}
    for(let k=0;k<5;k++)cyl(1.05,.1,k*.52,(k+1)*.52,.11-.01*k,.1-.01*k,8,k%2?'#f2f2f2':'#c94b3a');
    EMIT('smoke',1.05,2.7,.1);
    return 2.7;},
  solar(r){
    for(let k=0;k<6;k++){const z0=-1.38+k*.46;wedge(-1.35,z0,1.35,z0+.33,.04,.2,.06,'#2f5d93');bx(-1.36,z0+.33,1.36,z0+.35,.0,.08,'#9aa3ab');}
    bc(1.22,1.3,.12,.08,0,.2,'#d0d0d0');return .3;},
  wtower(r){
    for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]])bc(a*.13,b*.13,.018,.018,0,1.05,'#8b97a3');
    bc(0,0,.15,.15,.5,.53,'#8b97a3');cyl(0,0,0,1.02,.035,.035,6,'#7f8a95');
    cyl(0,0,1.0,1.45,.27,.27,12,'#a9c3d6','#9db8cc');cone(0,0,1.45,.2,.28,12,'#8aa7bc');return 1.7;},
  pump(r){
    bx(-.85,-.2,.15,.75,0,.55,'#d8e0e6',FRs(),'#9fb0bd');
    bc(.55,-.45,.32,.34,0,.07,'#4aa3c9');bc(.55,-.45,.36,.38,0,.05,'#c9d1d6');
    bx(.15,.18,.85,.26,.1,.18,'#7d8a96');bx(.77,.26,.85,.75,.1,.18,'#7d8a96');
    cyl(-.55,-.6,0,.45,.15,.15,10,'#e1e6ea','#c9d0d6');cyl(-.15,-.6,0,.38,.13,.13,10,'#e1e6ea','#c9d0d6');
    return .8;},
  kine(r){   // cabinet du métier choisi (v4) : kiné (croix turquoise), véto (patte + chien), médecin (croix bleue), dentiste (dent)
    const P=(S&&S.prof)||'kine',band={kine:'#0e8c87',veto:'#3f9b4f',med:'#2f6fd6',dent:'#2aa7d6'}[P]||'#0e8c87';
    if(kmOn())km('a-c',{fit:.72,z:-.14,r:KM_ROT.a,wall:'#f6f8f8',top:'#e1e6e6',lit:true});   /* v7 : vrai bâtiment 3D */
    else{bc(0,-.05,.34,.28,0,FH*2,'#f6f8f8',FRs(),'#e1e6e6');
    bx(-.35,-.34,.35,.24,FH*2,FH*2+.04,band);}
    if(P==='kine'){bx(-.03,.23,.03,.25,.41,.57,'#14b8a6','basic');bx(-.08,.23,.08,.25,.46,.52,'#14b8a6','basic');}
    else{bx(-.11,.226,.11,.232,.39,.6,band);const w='#ffffff';
      if(P==='med'){bx(-.025,.232,.025,.25,.42,.57,w,'basic');bx(-.075,.232,.075,.25,.47,.52,w,'basic');}
      else if(P==='veto'){bx(-.045,.232,.045,.25,.42,.48,w,'basic');bx(-.085,.232,-.055,.25,.5,.54,w,'basic');bx(-.035,.232,-.005,.25,.53,.575,w,'basic');bx(.005,.232,.035,.25,.53,.575,w,'basic');bx(.055,.232,.085,.25,.5,.54,w,'basic');}
      else{bx(-.06,.232,.06,.25,.49,.575,w,'basic');bx(-.055,.232,-.012,.25,.415,.49,w,'basic');bx(.012,.232,.055,.25,.415,.49,w,'basic');}}
    wedge(-.16,.23,.16,.36,.25,.29,.26,band);bc(0,.235,.06,.006,0,.2,'#41545e');
    tree3(-.39,.38,.08);
    if(P==='veto'){const c='#c58b4e',d='#8a5a30';for(const[lx,lz]of[[.2,.35],[.2,.39],[.27,.35],[.27,.39]])bc(lx,lz,.006,.006,0,.04,c);   // un chien attend devant la clinique
      bc(.235,.37,.045,.02,.04,.072,c);bc(.29,.37,.02,.018,.06,.097,c);bc(.315,.37,.011,.011,.064,.081,d);bc(.285,.355,.006,.004,.095,.112,d);bc(.285,.385,.006,.004,.095,.112,d);bc(.19,.37,.005,.005,.065,.1,c);}
    else tree3(.39,.38,.08);
    return .75;},
  school(r){   // école (13 nov. 2026) : bâtiment en L, préau, cour avec terrain de basket, clôture, enseigne
    const br='#c98a6a',wl='#f0e1c2',rf='#b5523b';
    bx(-.92,-.92,.92,-.28,0,FH*2,br,FRs(),'#a9634a');gable(-.96,-.96,.96,-.24,FH*2,.25,rf,true,br);
    bx(-.92,-.28,-.36,.5,0,FH*2,wl,FRs());gable(-.96,-.28,-.32,.54,FH*2,.22,rf,false,wl);
    canopy(-.64,.5,.3,FH*.85,'#2f6fd6');signB(-.64,.5,.36,FH*1.22,'#2f6fd6',.07);
    bx(-.34,-.26,.95,.95,0,.008,'#ddd6c8');bx(.08,.1,.88,.88,.008,.012,'#e07a4f');bx(.47,.1,.49,.88,.012,.014,'#ffffff');
    for(const z of[.13,.85]){bc(.48,z,.006,.006,0,.2,'#59616a');bx(.43,z-.004,.53,z+.004,.17,.23,'#ffffff');}
    bx(-.3,-.24,.04,.08,FH*1.05,FH*1.05+.02,'#6f8a9a');for(const [x,z] of[[-.29,-.23],[.03,-.23],[-.29,.07],[.03,.07]])bc(x,z,.008,.008,0,FH*1.05,'#6f8a9a');
    bx(-.98,.95,-.86,.97,0,.08,'#6a7d5c');bx(-.4,.95,.98,.97,0,.08,'#6a7d5c');bx(.96,-.98,.98,.97,0,.08,'#6a7d5c');
    flag(-.2,.8,.7);tree3(.82,-.12,.1);tree3(-.18,.62,.09);tree3(.2,-.14,.08);return .9;},
  police(r){   // commissariat (13 nov. 2026) : façade vitrée, bandeau lumineux, mât radio, parking avec voitures de police
    const top=FH*2.5;bx(-.85,-.8,.4,.35,0,top,'#e1e7ee',FOf(),'#b9c4cf');bx(-.87,-.82,.42,.37,top,top+.03,'#f2f5f8');parapet(-.225,-.225,1.29,1.19,top+.03,'#c3ccd5');
    bx(-.86,.35,.41,.37,FH*1.1,FH*1.4,'#2f5fa8');bx(-.26,.37,.26,.385,FH*1.55,FH*2.15,'#2f5fa8','basic');bx(-.2,.385,.2,.39,FH*1.74,FH*1.96,'#ffffff','basic');
    canopy(-.22,.37,.36,FH*.85,'#2f5fa8');roofKit(r,-.3,-.3,1,.9,top+.03);
    bc(-.6,-.55,.012,.012,top,top+.72,'#9aa0a6');bc(-.6,-.55,.07,.006,top+.56,top+.575,'#9aa0a6');bc(-.6,-.55,.006,.07,top+.62,top+.635,'#9aa0a6');
    bx(.45,-.92,.96,.96,0,.006,'#6b7178');
    for(const z of[.62,.27,-.08,-.43]){bx(.47,z+.15,.94,z+.162,.006,.009,'#f2f2f2');bc(.68,z,.085,.045,.015,.065,'#f4f6f8');bc(.68,z,.086,.02,.035,.05,'#2f5fa8');bc(.68,z,.045,.04,.065,.105,'#2e3b47');
      bx(.665,z-.03,.678,z,.105,.116,'#ff3b3b','basic');bx(.665,z,.678,z+.03,.105,.116,'#2f7bff','basic');}
    for(let x=-.8;x<.4;x+=.16)bc(x,.5,.012,.012,0,.06,'#9aa0a6');
    return 1.5;},
  fire(r){   // caserne (13 nov. 2026) : briques, trois portes vitrées, tour de séchage avec sirène, camions à échelle
    bx(-.9,-.7,.9,.4,0,FH*2,'#c8553d',FRs(FH),'#8f3d2e');bx(-.92,-.72,.92,.42,FH*2,FH*2+.03,'#efe7da');parapet(0,-.15,1.84,1.14,FH*2+.03,'#ddd2c2');
    for(const x of[-.55,0,.55]){bx(x-.21,.4,x+.21,.405,0,.4,'#f3f3f3');bx(x-.19,.405,x+.19,.41,.02,.37,'#9fb7c4');for(const y of[.11,.2,.29])bx(x-.19,.41,x+.19,.413,y,y+.012,'#e9eef1');bx(x-.2,.4,x+.2,.62,0,.006,'#cfcac1');}
    signB(0,.4,.7,FH*1.45,'#d62828',.08);
    bx(.55,-.9,.9,-.55,0,FH*4.2,'#b14a37',FRs(),'#7d3428');bx(.53,-.92,.92,-.53,FH*4.2,FH*4.2+.03,'#efe7da');cyl(.72,-.72,FH*4.2+.03,FH*4.2+.09,.03,.03,8,'#d9d9d9','#e63946');
    for(const [x,z,al] of[[-.55,.75,false],[.25,.78,true]]){if(al){bc(x,z,.17,.065,.02,.13,'#d62828');bc(x+.13,z,.04,.062,.08,.125,'#2e3b47');bx(x-.15,z-.025,x+.08,z+.025,.13,.15,'#cfd3d6');bx(x+.09,z-.04,x+.11,z+.04,.125,.14,'#ff3b3b','basic');}
      else{bc(x,z,.065,.17,.02,.13,'#d62828');bc(x,z+.13,.062,.04,.08,.125,'#2e3b47');bx(x-.025,z-.15,x+.025,z+.08,.13,.15,'#cfd3d6');bx(x-.04,z+.09,x+.04,z+.11,.125,.14,'#ff3b3b','basic');}}
    bc(.86,.86,.018,.018,0,.06,'#d62828');flag(-.85,.85,.7);
    return 1.45;},
  hospital(r){   // hôpital (13 nov. 2026) : tour de soins, aile vitrée, atrium, urgences avec ambulances, héliport, parking
    const t=FH*6;bx(-1.3,-1.25,.5,.2,0,t,'#f3f5f7',FRs(),'#d9dee3');bx(-1.32,-1.27,.52,.22,t,t+.03,'#ffffff');parapet(-.4,-.525,1.84,1.49,t+.03,'#d0d6dc');
    bx(.5,-1.25,1.3,.9,0,FH*3,'#e8eef2',FOf(),'#cfd6dc');bx(.48,-1.27,1.32,.92,FH*3,FH*3+.03,'#ffffff');roofKit(r,.9,-.2,.6,1.6,FH*3+.03);
    bx(-.75,.2,-.05,.55,0,FH*1.4,'#a9c9da',FOf(),'#e3ebf0');bx(-.78,.2,-.02,.58,FH*1.4,FH*1.4+.025,'#ffffff');
    cross(-.4,t-.2,.21,.12,'#e63946');cross(-.4,FH*1.15,.555,.07,'#e63946');
    cyl(-.4,-.55,t+.03,t+.06,.32,.32,16,'#4a5058','#4a5058');bx(-.5,-.62,-.46,-.48,t+.06,t+.066,'#ffffff','basic');bx(-.34,-.62,-.3,-.48,t+.06,t+.066,'#ffffff','basic');bx(-.46,-.565,-.34,-.535,t+.06,t+.066,'#ffffff','basic');
    bx(.55,.9,1.25,1.18,FH*.9,FH*.9+.025,'#e63946');for(const x of[.57,1.23])bc(x,1.16,.01,.01,0,FH*.9,'#e3e6e9');signB(.9,.9,.5,FH*1.12,'#e63946',.07);
    for(const x of[.72,1.05]){bc(x,1.05,.055,.1,.02,.13,'#f6f7f8');bx(x-.056,.98,x+.056,1.12,.07,.085,'#e63946');bc(x,1.12,.05,.025,.08,.12,'#2e3b47');bx(x-.03,1.0,x+.03,1.02,.13,.14,'#2f7bff','basic');}
    bx(-1.45,.62,-.85,1.45,0,.006,'#6b7178');for(let k=0;k<4;k++)bx(-1.45,.7+k*.2,-.85,.712+k*.2,.006,.009,'#f2f2f2');car3(-1.15,.8,true);car3(-1.15,1.2,true);
    tree3(-.2,1.2,.1);tree3(.2,1.3,.09);return t+.2;},
  lycee(r){   // lycée (13 nov. 2026) : ailes en U, entrée, cour arborée, terrain de sport, parc à vélos
    const wl='#e9dcc3',rf='#7d6a5b';
    bx(-1.35,-1.35,1.35,-.65,0,FH*3,wl,FRs(),null);gable(-1.39,-1.39,1.39,-.61,FH*3,.28,rf,true,wl);
    bx(-1.35,-.65,-.75,.3,0,FH*3,wl,FRs());gable(-1.39,-.65,-.71,.34,FH*3,.26,rf,false,wl);
    bx(.75,-.65,1.35,.3,0,FH*3,wl,FRs());gable(.71,-.65,1.39,.34,FH*3,.26,rf,false,wl);
    canopy(0,-.65,.4,FH*.9,'#7d6a5b');signB(0,-.65,.5,FH*1.3,'#2f6fd6',.07);
    bx(-.74,-.64,.74,.3,0,.008,'#ddd6c8');for(const x of[-.4,.4])tree3(x,-.2,.09);
    bx(-1.3,.42,1.3,1.4,0,.008,'#c8553d');bx(-1.15,.55,1.15,1.27,.008,.012,'#6fbf5a');bx(-.005,.55,.005,1.27,.012,.014,'#ffffff');
    for(let k=0;k<6;k++)bc(-1.32+k*.06,.34,.006,.022,0,.05,'#59616a');flag(1.2,.34,1.1);
    return 1.2;},
  square(r){tree3(-.2,-.15,.12);if(r()<.6)tree3(.25,.2,.1,true);bench(.15,-.25,true);lamp(-.32,.3);return .5;},
  garden(r){
    for(const [x,z] of[[-.6,-.6],[.62,-.55],[-.55,.6],[.7,.4],[.1,-.75]])tree3(x,z,.12+r()*.05,r()<.3);
    bc(.15,.12,.3,.2,0,.025,'#5fb7d6');
    for(let k=0;k<6;k++)bc(-.7+k*.08,.12,.03,.03,0,.04,['#f15bb5','#fee440','#f15bb5','#ff9f1c','#9b5de5','#fee440'][k]);
    bench(-.3,-.15,true);bench(.5,-.15,true);lamp(0,-.4);lamp(-.4,.35);return .5;},
  plaza(r){
    cyl(0,0,0,.1,.42,.42,16,'#cfd5db','#cfd5db');cyl(0,0,.1,.11,.37,.37,16,'#6cc4e6','#6cc4e6');
    cyl(0,0,.1,.32,.06,.05,8,'#cfd5db');cyl(0,0,.32,.4,.03,.01,6,'#e8f7ff',null,'basic');
    for(const [x,z] of[[-.72,-.72],[.72,-.72],[-.72,.72],[.72,.72]]){tree3(x,z,.09);lamp(x*.55,z*.95);}
    bench(0,.6,true);bench(0,-.6,true);bench(.6,0,false);bench(-.6,0,false);return .5;},
  statue(r){
    bc(0,0,.18,.18,0,.08,'#d9d4cc');bc(0,0,.1,.1,.08,.36,'#cfc8bd');
    cyl(0,0,.36,.6,.045,.035,8,'#e3b23c');ico(0,.66,0,.05,'#e3b23c');bx(-.13,-.015,.13,.015,.5,.53,'#e3b23c');
    tree3(-.36,-.36,.08);tree3(.36,-.36,.08);return .8;},
  fac(r){
    const wl='#efe6d6';
    bx(-1.3,-1.3,1.3,.1,0,FH*3,wl,FRs(),null);gable(-1.34,-1.34,1.34,.14,FH*3,.3,'#6f7c88',true,wl);
    bx(-.6,.1,.6,.4,0,.08,'#e2d9c8');
    for(let k=0;k<6;k++)cyl(-.5+k*.2,.32,.08,FH*3,.035,.035,8,'#f7f2e8');
    bx(-.62,.12,.62,.42,FH*3,FH*3+.05,'#e9e1d2');gable(-.62,.12,.62,.42,FH*3+.05,.18,'#e9e1d2',true,'#f3ede2');
    cyl(0,-.6,FH*3+.25,FH*3+.45,.3,.3,12,'#ddd3c1');ico(0,FH*3+.45,-.6,.3,'#0e8c87',.7);
    bx(-.4,.425,.4,.43,FH*3-.12,FH*3-.02,'#0e8c87','basic');
    tree3(-1,.9,.13);tree3(1,.9,.13);tree3(-.55,1.05,.1);tree3(.55,1.05,.1);return 1.6;},
  reeduc(r){
    bx(-1.3,-1.3,.4,.2,0,FH*3,'#eef6f5',FOf(),'#cde3e1');parapet(-.45,-.55,1.7,1.5,FH*3,'#bcd7d4');
    bx(.4,-1.3,1.3,.2,0,FH*1.6,'#bfe3ea',FOf(),'#a8d3dc');
    bx(.5,-1.2,1.2,.1,FH*1.6,FH*1.6+.01,'#4fc3e8');
    bx(-.4,.18,.4,.22,FH*2.2,FH*2.8,'#14b8a6','basic');
    cross(-.85,FH*3+.25,-.2,.13,'#14b8a6');bc(-.85,-.2,.012,.012,FH*3,FH*3+.1,'#9aa0a6');
    for(const [x,z] of[[-1.1,.9],[1.1,.9],[0,1.1],[.6,.6]])tree3(x,z,.11);
    bench(-.5,.8,true);bench(.3,.95,true);return 1.2;},
  pool(r){
    for(let k=0;k<3;k++)bx(-1.4,.75+k*.18,1.4,.93+k*.18,0,.12+k*.12,'#d9d4cc');
    wedge(-1.4,.65,1.4,1.42,.62,.62,.68,'#e9eef2');
    for(const x of[-1.38,1.38])bc(x,1.05,.015,.015,0,.62,'#9aa0a6');
    bx(-1.4,-1.45,1.4,-1.05,0,FH*2,'#eaf2f6',FOf(),'#cfdfe8');
    bc(1.15,-.6,.03,.03,0,.7,'#e5e5e5');bx(1.05,-.65,1.25,-.25,.68,.71,'#e5e5e5');
    return .8;},
  stadium(r){
    const stand=(x0,z0,x1,z1,ax,out)=>{for(let k=0;k<3;k++){let a=x0,b=z0,c=x1,d=z1;const t=(ax==='z'?z1-z0:x1-x0)/3;
      if(ax==='z'){if(out>0){b=z0+k*t;d=b+t;}else{d=z1-k*t;b=d-t;}}else{if(out>0){a=x0+k*t;c=a+t;}else{c=x1-k*t;a=c-t;}}
      bx(a,b,c,d,0,.16+k*.16,k%2?'#d6d2cb':'#c9c4bb');}};
    stand(-1.75,-1.95,1.75,-1.55,'z',-1);stand(-1.75,1.55,1.75,1.95,'z',1);
    stand(-1.95,-1.5,-1.55,1.5,'x',-1);stand(1.55,-1.5,1.95,1.5,'x',1);
    wedge(-1.75,-2,1.75,-1.45,.55,.75,.6,'#e8ecef');
    for(const [x,z] of[[-1.85,-1.85],[1.85,-1.85],[-1.85,1.85],[1.85,1.85]]){bc(x,z,.03,.03,0,1.4,'#8d949b');bc(x,z,.12,.05,1.4,1.52,'#fff6d5','basic');}
    return 1.6;},
  tower(r){
    bc(0,0,.95,.95,0,FH*2,'#d5dbe0',FSh(FH),'#c3cad0');
    let w=.62,y=FH*2;const segs=[10,9,8,6];
    segs.forEach((n,k)=>{const y1=y+n*FH;bc(0,0,w,w,y,y1,'#7fd0cf',FOf(y),'#6bb8b7');bx(-w-.01,-w-.01,w+.01,w+.01,y1-.04,y1,'#2dd4bf','basic');y=y1;w*=.82;});
    bc(0,0,w*.8,w*.8,y,y+.35,'#e8f6f6');bx(-.2,w*.8,.2,w*.8+.01,y+.06,y+.29,'#0e8c87','basic');
    bc(0,0,.02,.02,y+.35,y+1.6,'#c9d6d9');bc(0,0,.04,.04,y+1.6,y+1.68,'#ff4b4b','basic');
    return y+1.7;},
  chu(r){
    bx(-1.9,-1.9,1.9,.5,0,FH*2,'#eef2f5',FRs(),'#d6dde3');
    bx(-1.7,-1.7,-.2,-.1,FH*2,FH*9,'#f6f8fa',FRs(FH*2),'#dce2e7');bx(.2,-1.7,1.7,-.4,FH*2,FH*11,'#f6f8fa',FOf(FH*2),'#dce2e7');
    cross(-.95,FH*9-.25,-.09,.16,'#e63946');cross(.95,FH*11-.25,-.39,.16,'#e63946');
    cyl(.95,-1.05,FH*11+.01,FH*11+.03,.42,.42,16,'#4a5058','#4a5058');
    wedge(-.6,.5,.6,.9,.32,.36,.32,'#d6dde3');
    for(let k=0;k<4;k++)car3(-1.5+k*.22,1.45,false,k%2?'#f4f6f8':'#e63946');
    tree3(1.4,1.4,.12);tree3(1.7,.9,.1);return FH*11+.2;}
};
// ── Ma maison (13 nov. 2026) : la maison de l'écran Maison (house.js → buildModel) posée sur 3 × 3 cases ──
// Le bloc ne dessine que le terrain (pelouse, clôture, allée) ; la maquette est un groupe Three.js à part (E.gD),
// refaite quand le niveau, les meubles, le personnage ou la place changent. Hors ligne : petite maison dessinée par le code.
const MYH={g:null,sig:'',loading:false,fail:false,t:0,c:null};
function myHouseSig(s){const G_=typeof gam!=='undefined'&&gam?gam:{};return [s.id,s.x,s.z,s.rot|0,gamLvl(),JSON.stringify((G_.house&&G_.house.items)||[]),JSON.stringify(G_.char||null)].join('|');}
function myHouseDrop(){if(MYH.g&&E)E.gD.remove(MYH.g);MYH.g=null;MYH.sig='';MYH.c=null;}   /* pas de dispose : géométries partagées avec l'écran Maison */
function myHouseSync(){
  if(!E)return;
  if(MYH.g&&MYH.g.parent!==E.gD){MYH.g=null;MYH.sig='';}   /* scène refaite */
  let s=null;for(const v of SV.values())if(v.t==='mahouse'){s=v;break;}
  if(!s||VISIT){myHouseDrop();return;}
  const sig=myHouseSig(s);if(sig===MYH.sig||MYH.loading||MYH.fail)return;
  if(typeof _houseLoad!=='function'||typeof GAM_ROOMS==='undefined'){MYH.fail=true;touchSvc(s);return;}
  MYH.loading=true;
  _houseLoad().then(mod=>{
    MYH.loading=false;if(!E)return;
    if(!mod||!mod.buildModel){MYH.fail=true;touchSvc(s);return;}
    myHouseDrop();
    const m=mod.buildModel({rooms:GAM_ROOMS,pool:GAM_POOL,furniture:GAM_FURNITURE,items:(gam.house&&gam.house.items)||[],level:gamLvl(),char:gam.char||null});
    const R_=GAM_ROOMS.filter(r=>r.level<=gamLvl());let x0=99,x1=0,z0=99,z1=0;R_.forEach(r=>{x0=Math.min(x0,r.x);x1=Math.max(x1,r.x+r.w);z0=Math.min(z0,r.z);z1=Math.max(z1,r.z+r.d);});
    if(!(x1>x0)){x0=0;x1=24;z0=0;z1=17;}
    const w=new THREE.Group(),sc=Math.min(2.6/(x1-x0),2.6/(z1-z0),.19);m.position.set(-(x0+x1)/2,0,-(z0+z1)/2);w.add(m);w.scale.setScalar(sc);   /* centrée sur les pièces débloquées */
    w.rotation.y=(s.rot|0)*Math.PI/2;w.position.set(s.x+s.w/2,.012,s.z+s.d/2);
    MYH.g=w;MYH.sig=sig;MYH.c=[s.x+s.w/2,s.z+s.d/2];E.gD.add(w);
  }).catch(()=>{MYH.loading=false;MYH.fail=true;touchSvc(s);});
}
function myHouseFrame(){
  if(E.t-MYH.t>1){MYH.t=E.t;myHouseSync();}
  if(MYH.g&&MYH.c){const r=MYH.g.children[0].userData.roofs;if(r)r.visible=!(CAM.dist<9&&Math.hypot(CAM.x-MYH.c[0],CAM.z-MYH.c[1])<4);}   /* de près : on enlève les toits pour voir dedans */
}
Object.assign(SVB,{mahouse(r,s){
  bx(-1.46,-1.46,1.46,1.46,0,.018,'#93d071');                                                   /* pelouse */
  const f='#ffffff',e=1.44;
  bx(-e,-e,e,-e+.02,.0,.07,f);bx(-e,-e,-e+.02,e,0,.07,f);bx(e-.02,-e,e,e,0,.07,f);                /* clôture blanche */
  bx(-e,e-.02,-1.02,e,0,.07,f);bx(-.62,e-.02,e,e,0,.07,f);
  bx(-1.0,.9,-.64,1.46,0,.024,'#e2d6c1');                                                         /* allée vers la rue */
  if(MYH.fail||THM){bc(0,-.25,1.05,.7,0,.36,'#f3ede3',FRs());gable(-1.1,-.98,1.1,.48,.36,.32,'#c8553d',true,'#f3ede3');}
  tree3(-1.28,-1.25,.12);tree3(1.28,-1.25,.11);
  return .7;}});
function lotDir(i){
  const x=i%N,z=(i/N)|0;
  if(z<N-1&&road[i+N])return 0;if(x<N-1&&road[i+1])return 1;if(z>0&&road[i-N])return 2;if(x>0&&road[i-1])return 3;
  if(z<N-2&&road[i+2*N])return 0;if(x<N-2&&road[i+2])return 1;if(z>1&&road[i-2*N])return 2;if(x>1&&road[i-2])return 3;
  return vari[i]&3;
}
function viewColor(i){
  switch(VIEW){
    case 'power':return C3(pw[i]?'#ffe08a':'#e04f4f');
    case 'water':return C3(wt[i]?'#8fd3ff':'#e04f4f');
    case 'hap':return C3(zone[i]===ZR?ramp(hap[i]/100,RAMP_GOOD):'#f2f0ec');
    case 'road':return C3(rdist[i]<=2?'#9fe0b0':'#e04f4f');
    case 'garbage':return C3(gb[i]?'#c8e6c9':'#8d6e63');
    default:return C3('#f2f0ec');
  }
}
function svcViewColor(s){
  const b=BT[s.t];
  if(VIEW==='power'&&b.power)return C3('#ffc933');
  if(VIEW==='water'&&b.water)return C3('#3aa0ff');
  if(VIEW==='road')return C3(svcOK.get(s.id)?'#9fe0b0':'#e04f4f');
  if(VIEW==='garbage'&&b.garbage)return C3('#8d6e63');
  if(b.cov&&b.cov[VIEW])return C3('#2fa36b');
  return C3('#e6e3de');
}
function buildLot(i){
  const x=i%N,z=(i/N)|0,zn=zone[i],l=Math.min(4,lvl[i]),v=vari[i],s=st[i];
  TX.x=x+.5;TX.z=z+.5;TX.k=lotDir(i);
  const r=rng(v*977+l*131+zn*7+i*3);
  OVC=VIEW?viewColor(i):null;DK=(s===ABAND||s===FIRE)?1:0;NP=(s===OK&&!pw[i])?1:0;SITEP=s===BUILD?1-tmr[i]/(3+l*3):1;
  let top;V15.kmDoor=null;const pre=gbLens();
  if(s===BUILD)top=aSite(r,zn,l,v);else if(s===RUIN)top=aRuin(r);else top=ARCH[zn][l](r,v);
  OVC=null;DK=0;NP=0;
  if(s!==BUILD&&s!==RUIN&&zn!==ZI)doorScan(i,pre,zn===ZR?(l===1?'house':'res'):zn===ZC?'shop':'off');else V15.doors.delete(i);   /* v15 : porte qui s'ouvre */
  if(s===FIRE){flames(r,top);EMIT('fire',0,top+.25,0);}
  TOP[i]=top;
}
function buildSvcModel(s){
  TX.x=s.x+s.w/2;TX.z=s.z+s.d/2;TX.k=s.rot|0;
  OVC=VIEW?svcViewColor(s):null;
  const top=(SVB[s.t]||SVB.square)(rng(s.id*7919+13),s);
  OVC=null;
  for(let z=s.z;z<s.z+s.d;z++)for(let x=s.x;x<s.x+s.w;x++)TOP[z*N+x]=top;
}
function roadMask(x,z){
  let m=0;
  if(z>0&&road[(z-1)*N+x])m|=1;if(x<N-1&&road[z*N+x+1])m|=2;if(z<N-1&&road[(z+1)*N+x])m|=4;if(x>0&&road[z*N+x-1])m|=8;
  if(road[z*N+x]===2){if(x===0)m|=8;}
  return m;
}
function bridge(i){
  const x=i%N,z=(i/N)|0,m=roadMask(x,z),y=.13,ew=!!(m&10),ns=!!(m&5);
  TX.x=x+.5;TX.z=z+.5;TX.k=(ns&&!ew)?1:0;
  const full=ew&&ns;
  if(full)bx(-.5,-.5,.5,.5,y-.07,y,'#5d646c');
  else{bx(-.5,-.37,.5,.37,y-.07,y,'#5d646c');bx(-.5,-.37,.5,-.33,y,y+.07,'#d9dde0');bx(-.5,.33,.5,.37,y,y+.07,'#d9dde0');
    bx(-.4,-.012,-.1,.012,y,y+.004,'#f3f1e7','basic');bx(.1,-.012,.4,.012,y,y+.004,'#f3f1e7','basic');}
  if((x+z)%2===0)bc(0,0,.09,.09,-.35,y-.07,'#a09a91');
  TOP[i]=y;
}

// =========================================================
// Blocs de rendu (16 × 16 cases)
// =========================================================
function toGeo(g){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(g.n,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(g.c,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(g.u,2));
  return geo;
}
function toMesh(g,mat){
  const m=new THREE.Mesh(toGeo(g),mat);
  m.castShadow=mat!==E.mat.fire&&mat!==E.mat.ghost&&!!S.set.sh;m.receiveShadow=true;m.matrixAutoUpdate=false;return m;
}
function rebuildChunk(ci){
  const ch=E.bc[ci];
  for(const k in ch.meshes){const m=ch.meshes[k];E.gB.remove(m);m.geometry.dispose();}
  ch.meshes={};ch.emit=[];ch.rot=[];ch.wh=[];ch.park=[];
  GB=new Map();CUR=ch;
  const x0=(ci%NCH)*CH,z0=((ci/NCH)|0)*CH;
  for(const k of [...V15.doors.keys()]){const x=k%N,z=(k/N)|0;if(x>=x0&&x<x0+CH&&z>=z0&&z<z0+CH){V15.doors.delete(k);V15.doorDirty=true;}}   /* v15 : portes refaites avec le bloc */
  for(let z=z0;z<z0+CH;z++)for(let x=x0;x<x0+CH;x++){
    const i=z*N+x;
    if(road[i]&&ter[i])bridge(i);
    else if(lvl[i]&&zone[i]&&!svcAt[i])buildLot(i);
    else if(!svcAt[i])TOP[i]=0;
    const id=svcAt[i];if(id){const s=SV.get(id);if(s&&s.x===x&&s.z===z)buildSvcModel(s);}
    extTile(i);   // décor, collines, feux et ronds-points
  }
  for(const [k,g] of GB){if(!g.p.length)continue;const m=toMesh(g,E.mat[k]);ch.meshes[k]=m;E.gB.add(m);}
  GB=null;CUR=null;E.emitDirty=true;E.rotDirty=true;E.parkDirty=true;
}
function markG(i){if(!E)return;const x=i%N,z=(i/N)|0;E.gc[(z>>4)*NCH+(x>>4)].tiles.add(i);}
function markB(i){if(!E)return;const x=i%N,z=(i/N)|0;E.bDirty.add((z>>4)*NCH+(x>>4));}
function touch(i,nb){
  if(!E)return;markB(i);markG(i);
  if(nb||road[i]){const x=i%N,z=(i/N)|0;
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Z=z+dz;if(X<0||Z<0||X>=N||Z>=N)continue;const j=Z*N+X;markG(j);if(lvl[j]||road[j])markB(j);}}
}
function touchSvc(s){
  if(!E)return;markB(s.z*N+s.x);
  for(let z=s.z-1;z<=s.z+s.d;z++)for(let x=s.x-1;x<=s.x+s.w;x++)if(x>=0&&z>=0&&x<N&&z<N){markG(z*N+x);if(lvl[z*N+x])markB(z*N+x);}
  D.icons=true;
}

// =========================================================
// Sol : textures dessinées sur canvas (herbe, eau, routes, zones…)
// =========================================================
function drawTile(i){
  const x=i%N,z=(i/N)|0,gc=E.gc[(z>>4)*NCH+(x>>4)],c=gc.ctx,px=(x&15)*PX,pz=(z&15)*PX;
  c.save();c.beginPath();c.rect(px,pz,PX,PX);c.clip();
  if(ter[i]){c.clearRect(px,pz,PX,PX);waterCorners(c,x,z,px,pz);}
  else{
    grass(c,x,z,px,pz);
    shore(c,x,z,px,pz);
    if(road[i])drawRoad(c,i,x,z,px,pz);
    else if(svcAt[i])svcGround(c,SV.get(svcAt[i]),gc,px,pz);
    else if(zone[i])drawLot(c,i,px,pz);
    else if(tree[i]){c.fillStyle=`rgba(40,90,30,${.1+tree[i]*.06})`;c.fillRect(px,pz,PX,PX);}
    if(!road[i]&&!svcAt[i])landCorners(c,x,z,px,pz);
    extGround(c,i,x,z,px,pz);
    diagCaps(c,x,z,px,pz,i);
    if(pol[i]>8&&!VIEW&&!road[i]){c.fillStyle=`rgba(105,82,45,${Math.min(.4,pol[i]/210)})`;c.fillRect(px,pz,PX,PX);}
    if(VIEW)viewTint(c,i,px,pz);
    if(!inArea(x,z)){c.fillStyle='rgba(18,32,22,.28)';c.fillRect(px,pz,PX,PX);}
    else areaEdge(c,x,z,px,pz);
  }
  c.restore();gc.tex.needsUpdate=true;
}
function grass(c,x,z,px,pz){
  const n=NZ(x*.13+3.1,z*.13+7.7),n2=NZ(x*.05+11,z*.05+5),B=BIO(),i=z*N+x;   // couleur du sol selon le paysage (v4)
  let r=B.g[0]+n*18-n2*12,g=B.g[1]+n*12-n2*4,b=B.g[2]+n*10-n2*14;
  if(B.beach&&wdist[i]<=2){const k=wdist[i]===1?1:.45;r=lerp(r,227,k);g=lerp(g,211,k);b=lerp(b,162,k);}   // plages
  c.fillStyle=`rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  c.fillRect(px,pz,PX,PX);
  c.fillStyle=B.sandy?(c._spat||(c._spat=c.createPattern(SANDP_CV,'repeat'))):(c._pat||(c._pat=c.createPattern(GRASS_CV,'repeat')));c.fillRect(px,pz,PX,PX);
}
function isW(x,z){return x>=0&&z>=0&&x<N&&z<N&&ter[z*N+x]===1;}
const SAND='#e3d3a2',B5=5,H2=PX/2;
function shore(c,x,z,px,pz){
  c.fillStyle=SAND;
  if(isW(x,z-1))c.fillRect(px,pz,PX,B5);if(isW(x,z+1))c.fillRect(px,pz+PX-B5,PX,B5);
  if(isW(x-1,z))c.fillRect(px,pz,B5,PX);if(isW(x+1,z))c.fillRect(px+PX-B5,pz,B5,PX);
  if(isW(x+1,z-1))c.fillRect(px+PX-B5,pz,B5,B5);if(isW(x-1,z-1))c.fillRect(px,pz,B5,B5);
  if(isW(x+1,z+1))c.fillRect(px+PX-B5,pz+PX-B5,B5,B5);if(isW(x-1,z+1))c.fillRect(px,pz+PX-B5,B5,B5);
}
// coin arrondi : (ox, oy) = coin de la case, (sx, sy) = direction vers l'intérieur
function cornerArc(c,ox,oy,sx,sy){c.arc(ox+sx*H2,oy+sy*H2,H2,Math.atan2(0,-sx),Math.atan2(-sy,0),(sx*sy)<0);}
function cornerPath(c,ox,oy,sx,sy){c.beginPath();c.moveTo(ox,oy);c.lineTo(ox,oy+sy*H2);cornerArc(c,ox,oy,sx,sy);c.closePath();}
function landCorners(c,x,z,px,pz){
  const cs=[[isW(x,z-1)&&isW(x-1,z),px,pz,1,1],[isW(x,z-1)&&isW(x+1,z),px+PX,pz,-1,1],[isW(x,z+1)&&isW(x-1,z),px,pz+PX,1,-1],[isW(x,z+1)&&isW(x+1,z),px+PX,pz+PX,-1,-1]];
  for(const [ok,ox,oy,sx,sy] of cs){if(!ok)continue;
    c.globalCompositeOperation='destination-out';cornerPath(c,ox,oy,sx,sy);c.fill();c.globalCompositeOperation='source-over';
    c.strokeStyle=SAND;c.lineWidth=B5*2;c.beginPath();cornerArc(c,ox,oy,sx,sy);c.stroke();}
}
function waterCorners(c,x,z,px,pz){
  const land=(X,Z)=>X>=0&&Z>=0&&X<N&&Z<N&&!ter[Z*N+X];
  const cs=[[land(x,z-1)&&land(x-1,z)&&land(x-1,z-1),px,pz,1,1],[land(x,z-1)&&land(x+1,z)&&land(x+1,z-1),px+PX,pz,-1,1],
    [land(x,z+1)&&land(x-1,z)&&land(x-1,z+1),px,pz+PX,1,-1],[land(x,z+1)&&land(x+1,z)&&land(x+1,z+1),px+PX,pz+PX,-1,-1]];
  c.fillStyle=SAND;
  for(const [ok,ox,oy,sx,sy] of cs){if(!ok)continue;cornerPath(c,ox,oy,sx,sy);c.fill();}
}
// Route en diagonale : une bande par branche (diagonales vers les coins, droites vers les bords), raccord rond au centre
const DG_W=26,DG_A=18;
function drawDiagRoad(c,i,m,px,pz){
  const cx=px+H2,cz=pz+H2,arms=[];
  for(let d=0;d<4;d++)if(m&[1,2,4,8][d])arms.push([DIRS8[d][0]*H2,DIRS8[d][1]*H2,PX,PX-10]);
  for(let d=4;d<8;d++)if(dg[i]&dgBit(d))arms.push([DIRS8[d][0]*H2,DIRS8[d][1]*H2,DG_W,DG_A]);
  const band=(k,col)=>{c.fillStyle=c.strokeStyle=col;c.lineCap='butt';for(const a of arms){c.lineWidth=a[k];c.beginPath();c.moveTo(cx,cz);c.lineTo(cx+a[0],cz+a[1]);c.stroke();}
    c.beginPath();c.arc(cx,cz,Math.max(...arms.map(a=>a[k]))/2,0,7);c.fill();};
  band(2,'#d3d6d8');band(3,'#5d646c');band(3,asphPat(c));   /* v13 : asphalte grainé */
  if(arms.length<=2){c.strokeStyle='#f3f1e7';c.lineWidth=1.5;c.setLineDash([5,5]);c.beginPath();for(const a of arms){c.moveTo(cx,cz);c.lineTo(cx+a[0],cz+a[1]);}c.stroke();c.setLineDash([]);}
}
// Coin d'une case traversé par une route en diagonale entre deux voisines : on y dessine le morceau de chaussée qui déborde
function diagCaps(c,x,z,px,pz,i){
  for(const [sx,sz] of [[0,0],[1,0],[0,1],[1,1]]){
    const kx=x+sx,kz=z+sz;let a,d;                                   // coin (kx, kz) ; case a reliée en diagonale à son opposée
    if((sx===0)===(sz===0)){a=[kx,kz-1];d=6;}else{a=[kx-1,kz-1];d=5;}   // nous = haut-gauche / bas-droite → paire haut-droite / bas-gauche, sinon l'autre paire
    if(a[0]<0||a[1]<0||a[0]>=N||a[1]>=N)continue;const j=a[1]*N+a[0];if(!(dg[j]&dgBit(d)))continue;
    const ux=DIRS8[d][0]*.7071,uz=DIRS8[d][1]*.7071,X=px+sx*PX,Z=pz+sz*PX,R=14;
    c.lineCap='butt';
    if(!road[i]){c.strokeStyle='#d3d6d8';c.lineWidth=DG_W;c.beginPath();c.moveTo(X-ux*R,Z-uz*R);c.lineTo(X+ux*R,Z+uz*R);c.stroke();}
    c.strokeStyle='#5d646c';c.lineWidth=DG_A;c.beginPath();c.moveTo(X-ux*R,Z-uz*R);c.lineTo(X+ux*R,Z+uz*R);c.stroke();
  }
}
function drawLot(c,i,px,pz){
  const z=zone[i],l=lvl[i],s=st[i],Z=ZONES[z];
  if(!l){
    c.fillStyle=hexA(Z.col,ZONEVIEW?.6:.38);c.fillRect(px+1,pz+1,PX-2,PX-2);
    c.strokeStyle=hexA(Z.col,.95);c.lineWidth=1.5;c.setLineDash([4,3]);c.strokeRect(px+3.5,pz+3.5,PX-7,PX-7);c.setLineDash([]);
    if(tree[i]){c.fillStyle='rgba(40,90,30,.15)';c.fillRect(px,pz,PX,PX);}
    return;
  }
  let col;
  if(s===BUILD)col='#cdb994';else if(s===RUIN)col='#77716a';else if(s===ABAND)col='#b3ae8f';
  else if(z===ZR&&l<=2)col='#acd88d';else if(z===ZI)col='#c6c0b4';else col='#dcd8d0';
  c.fillStyle=col;c.fillRect(px,pz,PX,PX);
  if(z===ZR&&l<=2&&s===OK){
    c.fillStyle='#e8dfcd';const k=lotDir(i);
    if(k===0)c.fillRect(px+H2-2,pz+H2,4,H2);else if(k===2)c.fillRect(px+H2-2,pz,4,H2);
    else if(k===1)c.fillRect(px+H2,pz+H2-2,H2,4);else c.fillRect(px,pz+H2-2,H2,4);
  }else if(s===OK){c.strokeStyle='rgba(0,0,0,.07)';c.lineWidth=1;c.strokeRect(px+.5,pz+.5,PX-1,PX-1);}
  if(ZONEVIEW){c.fillStyle=hexA(Z.col,.42);c.fillRect(px,pz,PX,PX);}
}
function svcGround(c,s,gc,px,pz){
  if(!s)return;
  const ox=(s.x-gc.x0)*PX,oy=(s.z-gc.z0)*PX,W=s.w*PX,Hh=s.d*PX,t=s.t;
  const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(ox+x,oy+y,w,h);};
  const lawn='#9fd57e',path='#efe3c4';
  if(V11T.has(t)){rect(0,0,W,Hh,V11G[t]||lawn);return;}   /* v11 : le modèle dessine lui-même allées, parkings et dallages */
  if(t==='wind'){c.fillStyle='rgba(120,110,90,.25)';c.beginPath();c.arc(ox+W/2,oy+Hh/2,8,0,7);c.fill();return;}
  if(t==='square'||t==='garden'||t==='statue'||t==='fac'||t==='reeduc'||t==='observ'||t==='sante'||t==='biblio'||t==='gym'){
    rect(0,0,W,Hh,lawn);c.fillStyle=path;
    if(t==='square'){c.save();c.translate(ox+W/2,oy+Hh/2);c.rotate(.7);c.fillRect(-W,-2.5,W*2,5);c.restore();}
    else if(t==='statue'){c.beginPath();c.arc(ox+W/2,oy+Hh/2,11,0,7);c.fill();rect(W/2-2.5,Hh/2,5,Hh/2,path);}
    else{rect(W/2-4,0,8,Hh,path);rect(0,Hh/2-4,W,8,path);c.beginPath();c.arc(ox+W/2,oy+Hh/2,12,0,7);c.fill();}
    return;
  }
  if(t==='landfill'){rect(0,0,W,Hh,'#9b8b6e');c.fillStyle='rgba(60,45,30,.25)';for(let k=0;k<60;k++)c.fillRect(ox+hash(s.id*13+k)*W,oy+hash(k*17+s.id)*Hh,3,2);return;}
  if(t==='marina'){rect(0,0,W,Hh,'#c9a77c');c.fillStyle='rgba(90,60,30,.25)';for(let k=4;k<Hh;k+=6)c.fillRect(ox,oy+k,W,1);return;}
  if(t==='funfair'){rect(0,0,W,Hh,'#ead9c4');c.fillStyle='#9fd57e';c.beginPath();c.arc(ox+W*.3,oy+Hh*.3,W*.2,0,7);c.fill();c.beginPath();c.arc(ox+W*.75,oy+Hh*.55,W*.2,0,7);c.fill();
    c.strokeStyle='#d9b98f';c.lineWidth=5;c.beginPath();c.moveTo(ox+W/2,oy+Hh);c.lineTo(ox+W/2,oy+Hh*.45);c.lineTo(ox+W*.15,oy+Hh*.75);c.stroke();return;}
  if(t==='plaza'||t==='tower'||t==='mairie'||t==='musee'||t==='arc'||t==='metro'||t==='cinema'||t==='wheel'||t==='bus'){rect(0,0,W,Hh,'#e3ddd2');c.strokeStyle='rgba(150,140,125,.35)';c.lineWidth=1;
    for(let k=4;k<W;k+=8){c.beginPath();c.moveTo(ox+k,oy);c.lineTo(ox+k,oy+Hh);c.stroke();c.beginPath();c.moveTo(ox,oy+k);c.lineTo(ox+W,oy+k);c.stroke();}
    c.strokeStyle='rgba(120,110,95,.5)';c.lineWidth=2;c.beginPath();c.arc(ox+W/2,oy+Hh/2,W*.36,0,7);c.stroke();return;}
  if(t==='school'||t==='lycee'){rect(0,0,W,Hh,lawn);rect(W*.35,Hh*.32,W*.58,Hh*.6,'#d8c6a8');
    c.strokeStyle='#ffffff';c.lineWidth=1.5;c.strokeRect(ox+W*.42,oy+Hh*.4,W*.44,Hh*.44);c.beginPath();c.moveTo(ox+W*.64,oy+Hh*.4);c.lineTo(ox+W*.64,oy+Hh*.84);c.stroke();return;}
  if(t==='stadium'){for(let k=0;k<8;k++)rect(W*.12+k*W*.76/8,Hh*.14,W*.76/8+.5,Hh*.72,k%2?'#62b04c':'#6dbd55');
    c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(ox+W*.16,oy+Hh*.18,W*.68,Hh*.64);c.beginPath();c.moveTo(ox+W/2,oy+Hh*.18);c.lineTo(ox+W/2,oy+Hh*.82);c.stroke();
    c.beginPath();c.arc(ox+W/2,oy+Hh/2,W*.08,0,7);c.stroke();return;}
  if(t==='pool'){rect(0,0,W,Hh,'#e9e4da');rect(W*.08,Hh*.3,W*.84,Hh*.42,'#3fb7e3');
    c.fillStyle='rgba(255,255,255,.7)';for(let k=1;k<6;k++)c.fillRect(ox+W*.08,oy+Hh*.3+k*Hh*.07,W*.84,1);return;}
  if(t==='hospital'||t==='chu'||t==='police'||t==='fire'||t==='gare'||t==='incin'||t==='recycle'){rect(0,0,W,Hh,'#878d94');c.fillStyle='rgba(255,255,255,.75)';
    for(let k=6;k<W;k+=9)c.fillRect(ox+k,oy+Hh-12,1.5,10);rect(0,0,W,4,'#9fd57e');return;}
  if(t==='coal'){rect(0,0,W,Hh,'#8f8a83');c.fillStyle='rgba(40,40,40,.25)';for(let k=0;k<30;k++){const a=hash(s.id*31+k);c.fillRect(ox+a*W,oy+hash(k*7+s.id)*Hh,3,2);}return;}
  if(t==='solar'){rect(0,0,W,Hh,'#bdb8ae');return;}
  rect(0,0,W,Hh,'#cfcac0');c.strokeStyle='#bdb7ab';c.lineWidth=2;c.strokeRect(ox+2,oy+2,W-4,Hh-4);
}
function viewTint(c,i,px,pz){
  let col=null;
  switch(VIEW){
    case 'lv':col=hexA(ramp(lval[i]/100,['#3557a8','#4fa3c7','#7ccf5a','#f2cf3b','#f08c3a']),.55);break;
    case 'pol':if(pol[i]>4)col=`rgba(120,62,30,${Math.min(.8,pol[i]/100+.12)})`;break;
    case 'hap':if(zone[i]===ZR&&lvl[i])col=hexA(ramp(hap[i]/100,RAMP_GOOD),.55);break;
    case 'road':if(road[i])col=conn[i]?'rgba(40,140,255,.55)':'rgba(230,60,60,.7)';else if(zone[i])col=rdist[i]<=2?'rgba(60,180,90,.4)':'rgba(230,60,60,.45)';break;
    case 'power':case 'water':break;
    case 'trf':if(road[i])col=hexA(ramp(1-Math.min(1,trf[i]/120),RAMP_GOOD),.75);break;
    case 'dist':if(dist[i])col=hexA(distCol(dist[i]),.45);break;
    default:{const v=COV[VIEW]?COV[VIEW][i]:0;if(v)col=`rgba(40,170,110,${.2+v/100*.5})`;else if(zone[i]&&lvl[i])col='rgba(220,70,70,.32)';}
  }
  if(col){c.fillStyle=col;c.fillRect(px,pz,PX,PX);}
}
function areaEdge(c,x,z,px,pz){
  const a=MS[S.ms].area;if(a>=N)return;const o=(N-a)>>1,e=o+a-1;
  if(x!==o&&x!==e&&z!==o&&z!==e)return;
  c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=2.5;c.setLineDash([7,5]);c.beginPath();
  if(x===o){c.moveTo(px+1.5,pz);c.lineTo(px+1.5,pz+PX);}if(x===e){c.moveTo(px+PX-1.5,pz);c.lineTo(px+PX-1.5,pz+PX);}
  if(z===o){c.moveTo(px,pz+1.5);c.lineTo(px+PX,pz+1.5);}if(z===e){c.moveTo(px,pz+PX-1.5);c.lineTo(px+PX,pz+PX-1.5);}
  c.stroke();c.setLineDash([]);
}
function redrawAllGround(){if(!E)return;E.gc.forEach(g=>g.all=true);}
const VIEW_BLD={power:1,water:1,hap:1,road:1,garbage:1};
function viewChanged(kind){
  if(!E||!VIEW)return;
  const map={cov:['health','edu','edu2','police','fire','park','lv','road','transport'],pol:['pol','lv'],lv:['lv','hap'],util:['power','water','hap','garbage']};
  if((map[kind]||[]).includes(VIEW))E.viewStale=true;
}

// =========================================================
// Création de la scène
// =========================================================
function createEngine(){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,LOWQ?1:1.5));   /* v13 : puis ajustée selon la fluidité (adaptRes) */
  renderer.shadowMap.enabled=!!S.set.sh;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.className='cty-canvas';
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.3,420);   // 420 : assez loin pour le brouillard, plus précis pour l'occlusion
  const hemi=new THREE.HemisphereLight('#ffffff','#6f8f5a',1.25);
  const sun=new THREE.DirectionalLight('#fff3df',2.3);
  sun.castShadow=true;const sm=LOWQ?1024:2048;   /* v13 : 2048 (avant 4096) */sun.shadow.mapSize.set(sm,sm);sun.shadow.bias=-.0006;sun.shadow.normalBias=.035;
  sun.shadow.camera.near=1;sun.shadow.camera.far=170;
  scene.add(hemi,sun,sun.target);
  scene.background=new THREE.Color('#bfe3f5');scene.fog=new THREE.Fog('#bfe3f5',80,240);
  E={renderer,scene,camera,hemi,sun,aniso:renderer.capabilities.getMaxAnisotropy(),
    bc:[],gc:[],bDirty:new Set(),raf:0,running:false,clock:new THREE.Clock(),acc:0,t:0,tod:.34,night:0,
    ray:new THREE.Raycaster(),ndc:new THREE.Vector2(),plane:new THREE.Plane(new THREE.Vector3(0,1,0),0),
    emitDirty:true,rotDirty:true,viewStale:false,viewT:0,shadowExt:0,cam:true,roadList:[],ghosts:new Map()};
  ['gG','gB','gT','gC','gF','gI','gD'].forEach(k=>{E[k]=new THREE.Group();scene.add(E[k]);});
  makePatterns();makeMaterials();
  for(let ci=0;ci<NCH*NCH;ci++)E.bc.push({meshes:{},emit:[],rot:[],wh:[]});
  makeGround();makeWater();makeSlab();makeSign();makeTrees();makeCars();makeBuses();makeTaxis();makeRotors();makeWheels();makeBoats();makeSmoke();makeFlakes();makeIcons();makeLights();makeFx();
  extEngine();
  return E;
}
function makeGround(){
  for(let cz=0;cz<NCH;cz++)for(let cx=0;cx<NCH;cx++){
    const cv=cvs(CH*PX*GS),ctx=cv.getContext('2d'),tex=ctex(cv,false);ctx.setTransform(GS,0,0,GS,0,0);   /* v12 : sol (routes, marquages) en double résolution */
    const gm=new THREE.MeshLambertMaterial({map:tex,alphaTest:.5});snowify(gm,true);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(CH,CH),gm);
    mesh.rotation.x=-Math.PI/2;mesh.position.set(cx*CH+CH/2,0,cz*CH+CH/2);mesh.receiveShadow=true;
    E.gG.add(mesh);E.gc.push({cv,ctx,tex,mesh,x0:cx*CH,z0:cz*CH,tiles:new Set(),all:true});
  }
}
// Eau (v3.3, 12 nov. 2026) : style net et coloré — couleur franche selon la profondeur, fins reflets lumineux
// qui ondulent (motif cellulaire animé), écume très discrète le long des rives (v3.5),
// petites étincelles de soleil (plus de grosse tache blanche floue).
const WATER_U={uTime:{value:0},uDepth:{value:null},uShallow:{value:new THREE.Color('#5ccfd4')},uDeep:{value:new THREE.Color('#2380bd')},uSky:{value:new THREE.Color('#bfe3f5')},uNight:{value:0},uMist:{value:0}};
function makeWater(){
  const mat=new THREE.MeshPhongMaterial({color:'#ffffff',shininess:40,specular:new THREE.Color('#33404a')});
  mat.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,WATER_U);
    sh.vertexShader='varying vec3 vWP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz;');
    sh.fragmentShader=`uniform float uTime,uNight,uMist;uniform sampler2D uDepth;uniform vec3 uShallow,uDeep,uSky;varying vec3 vWP;
vec2 h22(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
float h21(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
// reflets ondulés (caustiques) : lignes de lumière organiques qui bougent doucement
float caus(vec2 uv,float time){vec2 p=mod(uv*6.2831,6.2831)-250.,i=p;float c=1.,inten=.005;
  for(int n=0;n<4;n++){float t=time*(1.-(3.5/float(n+1)));i=p+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));
    c+=1./length(vec2(p.x/(sin(i.x+t)/inten),p.y/(cos(i.y+t)/inten)));}
  c/=4.;c=1.17-pow(c,1.4);return clamp(pow(abs(c),8.),0.,1.);}
`+sh.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
  float dep=texture2D(uDepth,vec2(vWP.x/${N}.,1.-vWP.z/${N}.)).r;
  vec3 wc=mix(uShallow,uDeep,smoothstep(.0,.85,dep));
  vec2 wp=vWP.xz+vec2(sin(vWP.z*2.1+uTime*.7)+sin(vWP.x*3.7-uTime*.4)*.5,cos(vWP.x*1.9+uTime*.6)+cos(vWP.z*3.3+uTime*.5)*.5)*.09;
  float ln=caus(wp*.22,uTime*.35+23.)*(.5+.5*vn(wp*.9+vec2(uTime*.05,0.)));   // reflets fins et doux, coupés en morceaux (plus de longs traits blancs)
  wc+=vec3(.2,.25,.25)*ln*mix(1.,.45,smoothstep(.2,1.,dep));
  wc=mix(wc,vec3(.58,.84,.8),smoothstep(.09,.0,dep)*.3);   // fond sableux : eau un peu plus claire tout près du bord
  diffuseColor.rgb=wc;`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  {vec2 g=vec2(cos(dot(vWP.xz,vec2(.8,.6))*2.1+uTime*1.1),cos(dot(vWP.xz,vec2(-.55,.84))*3.3+uTime*1.5))*.035;
   vec3 nw=normalize(vec3(-g.x*.8+g.y*.55,1.,-g.x*.6-g.y*.84));normal=normalize((viewMatrix*vec4(nw,0.)).xyz);}`)
      .replace('#include <opaque_fragment>',`{vec3 vd=normalize(vViewPosition);float fr=pow(1.-clamp(dot(normal,vd),0.,1.),4.);
  outgoingLight=mix(outgoingLight,uSky*(1.-uNight*.6),clamp(fr*.35,0.,.4));
  // étincelles du soleil : de petits points qui scintillent là où la lumière se reflète
  #if NUM_DIR_LIGHTS>0
  {vec3 L=directionalLights[0].direction;vec2 cell=floor(vWP.xz*14.);float rnd=h21(cell),tw=.5+.5*sin(uTime*(2.+rnd*4.)+rnd*40.);
   vec2 fc=fract(vWP.xz*14.)-.5;float dot_=smoothstep(.16,.0,length(fc));
   float refl=pow(max(dot(reflect(-vd,normal),L),0.),12.);
   outgoingLight+=directionalLights[0].color*.35*step(.86,rnd)*tw*dot_*refl*(1.-uNight);}
  #endif
  // écume discrète (v3.5) : fin liseré irrégulier et translucide contre la rive + vaguelettes à peine visibles, en morceaux
  float nz=vn(vWP.xz*7.+vec2(uTime*.16,-uTime*.11)),nz2=vn(vWP.xz*2.3-vec2(uTime*.05,uTime*.04));
  float edge=smoothstep(.036,.014,dep+(nz-.5)*.014)*(.35+.65*nz2);
  float ph=fract(uTime*.08),ring=smoothstep(.007,.0,abs(dep-(.045+ph*.13)))*sin(ph*3.1416)*smoothstep(.4,.75,nz);
  float foam=clamp(edge*.42+ring*.12,0.,1.);
  outgoingLight=mix(outgoingLight,vec3(.92,.97,.98)*(1.-uNight*.7),foam);
  // brume du matin (v6.1) : voile doux et irrégulier, de la couleur du ciel, qui dérive lentement
  if(uMist>.001){float mn=vn(vWP.xz*.32+vec2(uTime*.025,uTime*.01))*.65+vn(vWP.xz*1.05-vec2(uTime*.04,0.))*.35;
    outgoingLight=mix(outgoingLight,uSky*1.03,uMist*smoothstep(.3,.8,mn)*.3);}}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey=()=>'water6';
  const m=new THREE.Mesh(new THREE.PlaneGeometry(N,N),mat);
  m.rotation.x=-Math.PI/2;m.position.set(N/2,-.06,N/2);m.receiveShadow=true;E.gD.add(m);E.water=m;
  rebuildWaterDepth();
}
// profondeur : distance de chaque case d'eau à la rive la plus proche (0 = rive), lissée par la texture
function rebuildWaterDepth(){
  // carte de profondeur fine (8 pixels par case, pour un liseré d'écume net) : distance réelle de chaque point à la rive, sur 3 cases au plus
  const R=8,W=N*R,cv=E.depthCv||(E.depthCv=cvs(W)),c=cv.getContext("2d"),img=c.createImageData(W,W),MAX=2;
  for(let py=0;py<W;py++)for(let px=0;px<W;px++){
    const x=(px+.5)/R,z=(py+.5)/R,tx=Math.floor(x),tz=Math.floor(z);let v=0;
    if(ter[tz*N+tx]){let best=MAX;
      for(let dz=-MAX;dz<=MAX;dz++)for(let dx=-MAX;dx<=MAX;dx++){const X=tx+dx,Z=tz+dz;if(X<0||Z<0||X>=N||Z>=N||ter[Z*N+X])continue;
        const ex=Math.max(X-x,0,x-(X+1)),ez=Math.max(Z-z,0,z-(Z+1)),dd=Math.hypot(ex,ez);if(dd<best)best=dd;}
      v=Math.round(clamp(best/MAX,0,1)*255);}
    const o=(py*W+px)*4;img.data[o]=img.data[o+1]=img.data[o+2]=v;img.data[o+3]=255;}
  c.putImageData(img,0,0);
  if(!E.depthTex){E.depthTex=new THREE.CanvasTexture(cv);E.depthTex.magFilter=E.depthTex.minFilter=THREE.LinearFilter;E.depthTex.generateMipmaps=false;WATER_U.uDepth.value=E.depthTex;}
  E.depthTex.needsUpdate=true;
}
function stepWater(dt){WATER_U.uTime.value=E.t;WATER_U.uSky.value.copy(E.scene.background);WATER_U.uNight.value=E.night;}
// Socle de la maquette : tranches de terre visibles sur les bords
function makeSlab(){
  GB=new Map();const g=G('plain'),depth=2.4;
  const SL=BIO().slab,layers=[[0,-.18,SL[0]],[-.18,-1.5,SL[1]],[-1.5,-depth,SL[2]]];   // couleurs du paysage (v4)
  for(let k=0;k<N;k++){
    const edges=[[k+1,0,k,0,ter[k]],[k,N,k+1,N,ter[(N-1)*N+k]],[0,k,0,k+1,ter[k*N]],[N,k+1,N,k,ter[k*N+N-1]]];
    for(const [x0,z0,x1,z1,w] of edges)for(const [ya,yb,col] of layers){
      const top=w&&ya===0?-.06:ya;quad(g,[x0,yb,z0],[x1,yb,z1],[x1,top,z1],[x0,top,z0],C3(w&&ya===0?'#4aa6c8':col));
    }
  }
  quad(g,[0,-depth,0],[N,-depth,0],[N,-depth,N],[0,-depth,N],C3('#5e5248'));
  const m=new THREE.Mesh(toGeo(g),E.mat.plain);GB=null;E.gD.add(m);E.slab=m;E.slabK=(S.biome||'')+'|'+S.seed;
}
function drawSign(){
  const cv=E.signCv,x=cv.getContext('2d');
  x.fillStyle='#1f7a4d';x.fillRect(0,0,512,128);x.strokeStyle='#fff';x.lineWidth=8;x.strokeRect(10,10,492,108);
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';
  x.font='600 30px Manrope, sans-serif';x.fillText('Bienvenue à',256,44);
  let fs=46;x.font=`800 ${fs}px Manrope, sans-serif`;while(x.measureText(S.name).width>470&&fs>20){fs-=2;x.font=`800 ${fs}px Manrope, sans-serif`;}
  x.fillText(S.name,256,86);E.signTex.needsUpdate=true;
}
function makeSign(){
  E.signCv=cvs(512,128);E.signTex=ctex(E.signCv,false);drawSign();
  GB=new Map();TX.x=1.5;TX.z=HWZ+.5;TX.k=0;
  bc(0,-.64,.03,.03,0,1.3,'#8d949b');bc(0,.64,.03,.03,0,1.3,'#8d949b');bx(-.03,-.64,.03,.64,1.25,1.31,'#8d949b');
  E.gD.add(new THREE.Mesh(toGeo(GB.get('plain')),E.mat.plain));GB=null;
  const mat=new THREE.MeshBasicMaterial({map:E.signTex});
  for(const s of[1,-1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.3),mat);p.position.set(1.5+s*.035,1.08,HWZ+.5);p.rotation.y=s*Math.PI/2;E.gD.add(p);}
}
const TREE_PAL=['#5aa84a','#4f9e45','#67b957','#46913f','#79b84f','#5c9e3a'],CON_PAL=['#3e7d47','#2f6f3f','#47885a','#356f4a'];
// Couronne des feuillus : une boule ; avec les modèles détaillés (v7), cinq boules pour un arbre plus touffu
function treeCrown(full){
  if(!full){const g=new THREE.IcosahedronGeometry(.2,0);g.translate(0,.31,0);return g;}
  const P=[];
  for(const [x,y,z,r] of [[0,.3,0,.17],[.1,.26,.05,.12],[-.09,.27,-.05,.12],[.02,.27,-.11,.11],[0,.42,.01,.12]]){
    const g=new THREE.IcosahedronGeometry(r,0),a=g.attributes.position.array;for(let k=0;k<a.length;k+=3)P.push(a[k]+x,a[k+1]+y,a[k+2]+z);g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();return g;
}
function makeTrees(){
  const tg=new THREE.BoxGeometry(.05,.16,.05);tg.translate(0,.08,0);
  const rg=treeCrown(kmOn());
  const cg=new THREE.ConeGeometry(.17,.5,7);cg.translate(0,.36,0);
  const mk=fn=>{GB=new Map();TX.x=0;TX.z=0;TX.k=0;fn();const g=toGeo(GB.get('plain'));GB=null;return g;};
  // palmier (v4) : tronc fin et palmes qui retombent ; cactus : une colonne et deux bras
  const pg=mk(()=>{cyl(0,0,0,.44,.026,.017,5,'#8a6a45');ico(0,.43,0,.028,'#6b4a2a');const g=G('plain');
    for(let k=0;k<7;k++){const a=k/7*6.283,c=Math.cos(a),sn=Math.sin(a),col=CC(k%2?'#3f9b3f':'#4fae46');
      const L=[c*.03-sn*.045,.45,sn*.03+c*.045],Rr=[c*.03+sn*.045,.45,sn*.03-c*.045],T=[c*.26,.33,sn*.26];tri(g,L,T,Rr,col);tri(g,Rr,T,L,col);}});
  const kg=mk(()=>{const c='#4f8f3a',t='#5fa34a';cyl(0,0,0,.32,.045,.04,7,c,t);
    bx(.03,-.016,.075,.016,.12,.15,c);cyl(.075,0,.12,.24,.02,.018,6,c,t);bx(-.07,-.015,-.03,.015,.16,.19,c);cyl(-.07,0,.16,.27,.019,.017,6,c,t);});
  E.trees={cap:0,geo:{tg,rg,cg,pg,kg},mat:{t:new THREE.MeshLambertMaterial({color:'#7a5236'}),c:new THREE.MeshLambertMaterial({flatShading:true}),v:new THREE.MeshLambertMaterial({vertexColors:true})}};
  snowify(E.trees.mat.c,false);
}
function rebuildTrees(){
  const T=E.trees,R=[],Cn=[],Pa=[],Ca=[],B=BIO(),L=[R,Cn,Pa,Ca];
  // essence selon le paysage (v4) : 0 feuillu, 1 sapin, 2 palmier, 3 cactus
  const typ=(i,r)=>{const w=wdist[i];switch(B.mix){case 'montagne':return r<.75?1:0;case 'lacs':return r<.7?1:0;
    case 'littoral':return w<=2&&r<.65?2:r<.2?1:0;case 'tropical':return w<=3&&r<.75?2:r<.22?2:0;case 'desert':return w<=3?2:3;default:return r<.33?1:0;}};
  for(let i=0;i<NN;i++){
    const d=tree[i];if(!d||road[i]||ter[i]||svcAt[i]||lvl[i]||mtn[i])continue;const x=i%N,z=(i/N)|0;
    for(let k=0;k<d;k++){const it=[x+.18+hash(i*17+k*131)*.64,z+.18+hash(i*29+k*71+5)*.64,.75+hash(i*13+k*37+9)*.6,hash(i*7+k)];L[typ(i,it[3])].push(it);}
  }
  const avT=B.mix==='desert'||B.mix==='tropical'?Pa:R;
  for(let i=0;i<NN;i++){if(road[i]!==3||ter[i])continue;const m=roadMask(i%N,(i/N)|0);if(m===5||m===10)avT.push([i%N+.5,((i/N)|0)+.5,.42+hash(i*3)*.12,hash(i*11)]);}
  // forêts sur les pentes basses des montagnes (posées sur le relief)
  if(MH&&B.treeLine)for(let i=0;i<NN;i++){const v=mtn[i];if(!v||road[i]||v>B.treeLine||hash(i*13+7)>B.mtnTrees)continue;const x=i%N,z=(i/N)|0,n=1+((hash(i*5+1)*2)|0);
    for(let k=0;k<n;k++){const px=x+.2+hash(i*17+k*131)*.6,pz=z+.2+hash(i*29+k*71)*.6;(B.mtnRound?R:Cn).push([px,pz,.65+hash(i*3+k)*.5,hash(i*7+k),mtnH(px,pz)-.03]);}}
  const need=R.length+Cn.length+Pa.length+Ca.length;
  if(need>T.cap||!T.trunk){
    if(T.trunk){[T.trunk,T.round,T.con,T.palm,T.cactus].forEach(m=>{if(m){E.gT.remove(m);m.dispose();}});}
    T.cap=Math.ceil(need*1.3)+64;
    T.trunk=new THREE.InstancedMesh(T.geo.tg,T.mat.t,T.cap);T.round=new THREE.InstancedMesh(T.geo.rg,T.mat.c,T.cap);T.con=new THREE.InstancedMesh(T.geo.cg,T.mat.c,T.cap);
    T.palm=new THREE.InstancedMesh(T.geo.pg,T.mat.v,T.cap);T.cactus=new THREE.InstancedMesh(T.geo.kg,T.mat.v,T.cap);
    [T.trunk,T.round,T.con,T.palm,T.cactus].forEach(m=>{m.frustumCulled=false;m.castShadow=!!S.set.sh;m.receiveShadow=true;E.gT.add(m);});
    const w=new THREE.Color('#ffffff');T.round.setColorAt(0,w);T.con.setColorAt(0,w);
  }
  const m=new THREE.Matrix4(),col=new THREE.Color(),q=new THREE.Quaternion(),e=new THREE.Euler(),pv=new THREE.Vector3(),sv=new THREE.Vector3();let ti=0;
  const put=(arr,mesh,pal)=>{arr.forEach((it,j)=>{
      if(pal){m.makeScale(it[2],it[2],it[2]);m.setPosition(it[0],it[4]||0,it[1]);T.trunk.setMatrixAt(ti++,m);col.set(pal[(it[3]*977|0)%pal.length]);mesh.setColorAt(j,col);}
      else{e.set(0,it[3]*6.283,0);q.setFromEuler(e);pv.set(it[0],it[4]||0,it[1]);sv.setScalar(it[2]);m.compose(pv,q,sv);}
      mesh.setMatrixAt(j,m);});
    mesh.count=arr.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;};
  put(R,T.round,roundPal());put(Cn,T.con,CON_PAL);put(Pa,T.palm,null);put(Ca,T.cactus,null);
  T.trunk.count=ti;T.trunk.instanceMatrix.needsUpdate=true;
}
function makeCars(){
  GB=new Map();TX.x=0;TX.z=0;TX.k=0;   /* 13 nov. 2026 : caisse, capot, vitres, toit, roues, pare-chocs ; phares à part (toujours lumineux) */
  bc(0,.002,.05,.097,.02,.052,'#ffffff');bc(0,-.004,.049,.094,.052,.068,'#ffffff');
  bc(0,-.014,.044,.05,.068,.106,'#2e3b47');bc(0,-.016,.041,.042,.106,.114,'#ffffff');
  for(const sx of[-1,1])for(const sz of[-1,1])bc(sx*.047,sz*.06,.007,.019,0,.038,'#1d2024');
  bc(0,.099,.046,.003,.022,.034,'#d9dde0');bc(0,-.099,.046,.003,.022,.034,'#d9dde0');
  const geo=toGeo(GB.get('plain'));
  GB=new Map();bc(-.032,.098,.011,.004,.04,.05,'#fff7d6');bc(.032,.098,.011,.004,.04,.05,'#fff7d6');bc(-.034,-.098,.01,.004,.042,.05,'#ff3b30');bc(.034,-.098,.01,.004,.042,.05,'#ff3b30');
  const lg=toGeo(GB.get('plain'));GB=null;
  const mesh=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}),240);
  mesh.count=0;mesh.frustumCulled=false;mesh.setColorAt(0,new THREE.Color('#fff'));E.gC.add(mesh);
  const lights=new THREE.InstancedMesh(lg,new THREE.MeshBasicMaterial({vertexColors:true}),240);lights.count=0;lights.frustumCulled=false;E.gC.add(lights);
  E.cars={mesh,lights,cone:coneMesh(240,.1),list:[],m:new THREE.Matrix4(),col:new THREE.Color(),o:[0,0,0]};
}
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
// 13 nov. 2026 : 8 directions (4 à 7 = diagonales NE, SE, SO, NO) ; une diagonale n'existe que si la liaison dg est posée
const DIRS8=DIRS.concat([[1,-1],[1,1],[-1,1],[-1,-1]]);
function OPP(d){return d<4?(d+2)&3:4+((d-2)&3);}
function dgBit(d){return 1<<(d-4);}
function roadNb(i,d){const x=i%N,z=(i/N)|0,X=x+DIRS8[d][0],Z=z+DIRS8[d][1];if(X<0||Z<0||X>=N||Z>=N)return -1;if(d>=4&&!(dg[i]&dgBit(d)))return -1;const j=Z*N+X;return road[j]?j:-1;}
// retire les liaisons en diagonale d'une case (et celles des voisines qui pointent vers elle)
function dgClear(i){if(!dg[i])return;const x=i%N,z=(i/N)|0;
  for(let d=4;d<8;d++)if(dg[i]&dgBit(d)){const X=x+DIRS8[d][0],Z=z+DIRS8[d][1];if(X<0||Z<0||X>=N||Z>=N)continue;const j=Z*N+X;rec(j);dg[j]&=~dgBit(OPP(d));touch(j,true);}
  dg[i]=0;}
function spawnCar(c,fleet){
  const L=E.roadList;if(!L.length)return false;
  const car=fleet===E.cars;
  for(let k=0;k<12;k++){
    const i=L[(Math.random()*L.length)|0];
    if(noCar(i)||showBlocked(i)||(car&&k<10&&Math.random()*90>trf[i]+12))continue;   // plus de voitures là où le trafic est fort
    const opts=[0,1,2,3,4,5,6,7].filter(d=>roadNb(i,d)>=0);
    if(!opts.length)continue;
    const out=opts[(Math.random()*opts.length)|0],from=OPP(out),t0=Math.random();
    const lane=E._lanes&&E._lanes.get(i*8+from);if(lane&&lane.some(o=>o!==c&&Math.abs(o.t-t0)<.45))continue;   // pas d'apparition sur une autre voiture
    c.i=i;c.from=from;c.to=out;c.t=t0;c.ov=null;c.ok=0;c.nmv=null;c.nmvX=0;c.bt=0;c.sp=1.1+Math.random()*.8;c.col=CAR_COLS[(Math.random()*CAR_COLS.length)|0];c.fresh=true;c.dest=car?commuteDest():fleet===E.taxis?taxiDest():null;if(c.id==null)c.id=++_carId;return true;
  }
  return false;
}
function carPos(c,o){
  if(onRb(c)){rbPos(c,o);return;}   /* v15 : autour de l'îlot */
  const x=c.i%N+.5,z=((c.i/N)|0)+.5,a=DIRS8[c.from],b=DIRS8[c.to],t=c.t,u=1-t;
  const p0x=x+a[0]*.5,p0z=z+a[1]*.5,p2x=x+b[0]*.5,p2z=z+b[1]*.5;
  const px=u*u*p0x+2*u*t*x+t*t*p2x,pz=u*u*p0z+2*u*t*z+t*t*p2z;
  let tx=2*u*(x-p0x)+2*t*(p2x-x),tz=2*u*(z-p0z)+2*t*(p2z-z);const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
  o[0]=px-tz*.17;o[1]=pz+tx*.17;o[2]=Math.atan2(tx,tz);
}
function stepFleet(C,target,dt,fixCol){
  while(C.list.length<target){const c={};if(!spawnCar(c,C))break;C.list.push(c);}
  if(C.list.length>target)C.list.length=Math.max(0,target);
  const o=C.o;let n=0;
  for(const c of C.list){
    if(c.ov!=null&&!S.ovs[c.ov]&&!spawnCar(c,C))continue;
    if(c.ov==null&&(!road[c.i]||showBlocked(c.i))&&!spawnCar(c,C))continue;
    if(fixCol)c.col=fixCol;
    let adv=dt*c.sp*(C===E.cars&&c.ov==null?jamK(c.i):1);   // bouchons : on roule au pas sur les routes saturées
    if(C===E.buses&&busWait(c,dt))adv=0;   /* v10 : le bus s'arrête à l'arrêt */
    if(E.accI!=null&&c.i===E.accI)adv*=.1;   /* v10 : accident, on roule au pas */
    c.big=C===E.buses;
    if(adv>0&&E._lanes){const g=gapAhead(c,E._lanes),minG=C===E.buses?.62:.44;adv=Math.min(adv,Math.max(0,g-minG));}   // distance de sécurité (v15 : un peu plus grande)
    if(c.to>=4||c.from>=4)adv/=(c.to>=4?.707:.5)+(c.from>=4?.707:.5);   /* diagonale : plus de chemin dans la case, même vitesse */
    if(onRb(c))adv*=.82/RBP[c.from][c.to].len;   /* v15 : rond-point, chemin plus long et un peu plus lent */
    if(adv>0){const r_=carRoom(c),k_=onRb(c)?RBP[c.from][c.to].len:1;if(r_<9){adv=Math.min(adv,Math.max(0,r_/k_));if(r_<.02){c.bt=(c.bt||0)+dt;if(c.bt>6){c.ghost=E.t+1;c.bt=0;}}else c.bt=0;}else c.bt=0;}   /* v15 : plus de voitures qui se touchent */
    if(adv>0&&c.ov==null&&c.to<4){const j=roadNb(c.i,c.to);
      if(j>=0&&rx[j]===2&&!SIG[j]&&c.t<.93&&rbBusy(j,OPP(c.to),c))adv=Math.min(adv,Math.max(0,.9-c.t));   // on cède le passage à l'entrée du rond-point
      if(j>=0&&c.t<.93&&boxFull(j,c))adv=Math.min(adv,Math.max(0,.9-c.t));   // on n'entre pas dans un carrefour déjà encombré
      if(j>=0&&c.t>.5&&!c.nmv&&!c.nmvX){c.nmv=nextMove(c,C);c.nmvX=1;c.nmvK=c.i*8+c.to;}   // direction suivante choisie un peu avant le carrefour
      if(j>=0&&c.t<.93&&c.nmv&&c.nmv.j===j&&c.nmv.ov==null&&rx[j]!==2&&armCnt(j)>=3&&boxConflict(j,OPP(c.to),c.nmv.to,c))adv=Math.min(adv,Math.max(0,.88-c.t));   // priorité : on laisse passer la voiture déjà engagée
      if(V15.pedX.size){const X_=V15.pedX;   // passages piétons occupés : on s'arrête avant
        if(c.t<.62&&X_.has(c.i*5+c.to))adv=Math.min(adv,Math.max(0,.6-c.t));
        else if(c.t<.3&&X_.has(c.i*5+4))adv=Math.min(adv,Math.max(0,.28-c.t));
        else if(j>=0&&c.t>.45&&(X_.has(j*5+OPP(c.to))||X_.has(j*5+4)))adv=Math.min(adv,Math.max(0,.86-c.t));}}
    if(adv>0&&c.t<.9&&c.ov==null&&c.to<4){const j=roadNb(c.i,c.to);if(j>=0&&SIG[j]&&sigState(j,c.to&1)!==0)adv=Math.min(adv,Math.max(0,.86-c.t));}   // feu rouge ou orange : on attend avant le carrefour (v4)
    c.t+=adv;
    let guard=0;
    while(c.t>=1&&guard++<4){
      const mv=(c.nmv&&c.nmvK===c.i*8+c.to)?c.nmv:nextMove(c,C);c.nmv=null;c.nmvX=0;   // v5 : routes + ponts routiers · v15 : direction choisie à l'avance
      if(!mv){spawnCar(c,C);break;}
      c.from=OPP(c.to);c.i=mv.j;c.to=mv.to;c.ov=mv.ov;c.ok=mv.ok;c.t-=1;
      if(c.dest!=null&&Math.abs(c.i%N-c.dest%N)+Math.abs(((c.i/N)|0)-((c.dest/N)|0))<2)c.dest=null;
    }
    if(c.t>=1)c.t=.99;
    carPos(c,o);c.px=o[0];c.pz=o[1];c.pa=o[2];
    C.m.makeRotationY(o[2]);C.m.setPosition(o[0],c.ov!=null?ovpY(c):ter[c.i]?.13:mtn[c.i]?mtnH(o[0],o[1])+.012:0,o[1]);   /* route de montagne : suit la pente */C.mesh.setMatrixAt(n,C.m);if(C.lights)C.lights.setMatrixAt(n,C.m);if(C.cone)C.cone.setMatrixAt(n,C.m);
    if(c.fresh||c.n!==n){C.col.set(fixCol||c.col);C.mesh.setColorAt(n,C.col);c.fresh=false;c.n=n;C.colDirty=true;}
    n++;
  }
  C.mesh.count=n;C.mesh.instanceMatrix.needsUpdate=true;if(C.lights){C.lights.count=n;C.lights.instanceMatrix.needsUpdate=true;}if(C.cone){C.cone.count=n;C.cone.instanceMatrix.needsUpdate=true;}
  if(C.colDirty&&C.mesh.instanceColor){C.mesh.instanceColor.needsUpdate=true;C.colDirty=false;}
}
// Files de circulation : voitures qui entrent dans la case i par le côté « from » (clé i*4+from)
function laneMap(){const M=new Map();for(const C of[E.cars,E.buses,E.taxis].filter(Boolean))for(const c of C.list){if(c.i==null)continue;const k=(c.ov!=null?NN*8:0)+c.i*8+c.from;let a=M.get(k);if(!a)M.set(k,a=[]);a.push(c);}return M;}
function gapAhead(c,M){
  let best=9;const a=M.get((c.ov!=null?NN*8:0)+c.i*8+c.from);
  if(a)for(const o of a)if(o!==c&&(o.t>c.t||(o.t===c.t&&o.id>c.id))&&o.t-c.t<best)best=o.t-c.t;
  if(best>1.2&&c.ov==null){const j=roadNb(c.i,c.to);if(j>=0){const b=M.get(j*8+OPP(c.to));if(b)for(const o of b){const g=1-c.t+o.t;if(g<best)best=g;}}}
  return best;
}
let _carId=0;
function stepCars(dt){
  const jobs=ST.jc+ST.ji+ST.jo,rl=E.roadList.length,k=PO('zone30')?.75:1;
  E._lanes=laneMap();carGrid();   /* v15 : positions de tout le monde pour la distance de sécurité */
  stepFleet(E.cars,carTarget(),dt*k);   // v4 : selon la population
  const nb=svcCount('bus')*2+svcCount('metro')*3+svcCount('gare')*3;
  stepFleet(E.buses,Math.min(36,nb,Math.round(rl*.15)),dt*k*.8,'#14b8a6');
  if(E.taxis)stepFleet(E.taxis,taxiTarget(),dt*k,'#f6c90e');   /* v10 : taxis */
}
// v10 : taxis jaunes avec lumineux sur le toit (plus nombreux avec une gare ou un aéroport)
function makeTaxis(){
  GB=new Map();TX.x=0;TX.z=0;TX.k=0;
  bc(0,.002,.05,.097,.02,.052,'#ffffff');bc(0,-.004,.049,.094,.052,.068,'#ffffff');bc(0,-.014,.044,.05,.068,.106,'#2e3b47');bc(0,-.016,.041,.042,.106,.114,'#ffffff');
  for(const sx of[-1,1])for(const sz of[-1,1])bc(sx*.047,sz*.06,.007,.019,0,.038,'#1d2024');bx(-.0505,-.06,.0505,.06,.04,.046,'#222222');
  const geo=toGeo(GB.get('plain'));
  GB=new Map();bc(-.032,.098,.011,.004,.04,.05,'#fff7d6');bc(.032,.098,.011,.004,.04,.05,'#fff7d6');bc(-.034,-.098,.01,.004,.042,.05,'#ff3b30');bc(.034,-.098,.01,.004,.042,.05,'#ff3b30');bc(0,-.016,.016,.008,.114,.128,'#fff3b0');
  const lg=toGeo(GB.get('plain'));GB=null;
  const mesh=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}),24);mesh.count=0;mesh.frustumCulled=false;mesh.setColorAt(0,new THREE.Color('#f6c90e'));E.gC.add(mesh);
  const lights=new THREE.InstancedMesh(lg,new THREE.MeshBasicMaterial({vertexColors:true}),24);lights.count=0;lights.frustumCulled=false;E.gC.add(lights);
  E.taxis={mesh,lights,cone:coneMesh(24,.1),list:[],m:new THREE.Matrix4(),col:new THREE.Color(),o:[0,0,0]};
}
function taxiTarget(){if(!ST.pop)return 0;return Math.min(20,(svcCount('gare')+svcCount('aeroport'))*4+Math.floor(ST.pop/1500));}
function taxiDest(){const L=[...SV.values()].filter(s=>s.t==='gare'||s.t==='aeroport'||s.t==='mairie');if(!L.length||Math.random()<.4)return null;const F=svcFront(rpick(L));return F?F.ri:null;}
function busWait(c,dt){
  if(c.wait>0){c.wait-=dt;return true;}
  if(E.busStops&&E.busStops.has(c.i)&&c.stopI!==c.i&&c.t>=.4&&c.t<.62){c.stopI=c.i;c.wait=2.4;return true;}
  return false;
}
function makeBuses(){
  GB=new Map();TX.x=0;TX.z=0;TX.k=0;
  bc(0,0,.055,.15,.024,.11,'#ffffff');bc(0,-.01,.057,.125,.064,.096,'#2e3b47');bc(0,.151,.05,.002,.05,.1,'#2e3b47');   /* 13 nov. 2026 : vitres, pare-brise, clim, roues */
  bc(0,-.05,.034,.05,.11,.124,'#e6e9ec');for(const sx of[-1,1])for(const sz of[-1,.9])bc(sx*.052,sz*.1,.007,.022,0,.044,'#1d2024');bc(.0575,.06,.001,.028,.026,.09,'#d9dde0');
  const geo=toGeo(GB.get('plain'));
  GB=new Map();bc(-.036,.151,.011,.003,.035,.046,'#fff7d6');bc(.036,.151,.011,.003,.035,.046,'#fff7d6');bc(-.04,-.151,.01,.003,.04,.05,'#ff3b30');bc(.04,-.151,.01,.003,.04,.05,'#ff3b30');
  const lg=toGeo(GB.get('plain'));GB=null;
  const mesh=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}),40);
  mesh.count=0;mesh.frustumCulled=false;mesh.setColorAt(0,new THREE.Color('#14b8a6'));E.gC.add(mesh);
  const lights=new THREE.InstancedMesh(lg,new THREE.MeshBasicMaterial({vertexColors:true}),40);lights.count=0;lights.frustumCulled=false;E.gC.add(lights);
  E.buses={mesh,lights,cone:coneMesh(24,.17),list:[],m:new THREE.Matrix4(),col:new THREE.Color(),o:[0,0,0]};
}
// Bateaux sur la rivière (12 nov. 2026) : vedettes et voiliers avec coque effilée, petit sillage discret, léger roulis
const BOAT_K=1.15;   /* v13 : bateaux à l'échelle (avant 0,68 : plus petits que les voitures) */                 // taille des bateaux (12 nov. 2026 : plus petits, plus « maquette »)
function hull(L,B,col,deck){
  const g=G('plain'),c=CC(col),cd=CC(deck),y0=-.05,y1=.028;
  const top=[[-B,-L*.62],[B,-L*.62],[B,L*.3],[B*.55,L*.72],[0,L],[-B*.55,L*.72],[-B,L*.3]];
  const bot=top.map(([x,z])=>[x*.45,z*.9]);
  for(let k=0;k<top.length;k++){const a=top[k],b=top[(k+1)%top.length],a2=bot[k],b2=bot[(k+1)%top.length];
    quad(g,[a2[0],y0,a2[1]],[b2[0],y0,b2[1]],[b[0],y1,b[1]],[a[0],y1,a[1]],c);}
  for(let k=0;k<top.length;k++){const a=top[k],b=top[(k+1)%top.length];tri(g,[0,y1,0],[b[0],y1,b[1]],[a[0],y1,a[1]],cd);}
  const ds=CC('#2e3a46');for(let k=0;k<top.length;k++){const a=top[k],b=top[(k+1)%top.length];quad(g,[a[0]*1.01,y1-.012,a[1]*1.01],[b[0]*1.01,y1-.012,b[1]*1.01],[b[0]*1.01,y1-.004,b[1]*1.01],[a[0]*1.01,y1-.004,a[1]*1.01],ds);}
}
function boatMesh(build,n){GB=new Map();TX.x=0;TX.z=0;TX.k=0;build();const geo=toGeo(GB.get('plain'));GB=null;
  const m=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}),n);m.count=0;m.frustumCulled=false;m.castShadow=true;m.setColorAt(0,new THREE.Color('#fff'));E.gC.add(m);return m;}
function makeBoats(){
  const motor=boatMesh(()=>{hull(.2,.058,'#ffffff','#eee8de');bc(0,-.095,.042,.03,.028,.031,'#c99a6a');   /* v12 : cabine vitrée, toit, garde-corps, moteur hors-bord */
    bc(0,-.035,.04,.055,.028,.074,'#f4f6f8');wedge(-.04,.02,.04,.052,.028,.074,.046,'#33424f');bx(-.041,-.085,.041,.015,.048,.064,'#33424f');bc(0,-.035,.043,.058,.074,.079,'#e9ecef');
    bx(-.058,.02,-.054,.15,.028,.046,'#d0d4d8');bx(.054,.02,.058,.15,.028,.046,'#d0d4d8');bc(0,-.125,.018,.016,-.02,.056,'#2e3a46');bc(0,-.137,.012,.008,-.05,0,'#2e3a46');
    bc(-.059,0,.003,.006,.04,.048,'#ff3b30');bc(.059,0,.003,.006,.04,.048,'#2ecc71');},10);
  const sail=boatMesh(()=>{hull(.25,.065,'#ffffff','#c9a77c');bc(0,-.06,.03,.045,.028,.06,'#f4f6f8');
    bc(0,.04,.006,.006,.028,.5,'#d0d4d8');const g=G('plain'),w=CC('#fbf8f0'),w2=CC('#f1ece0');
    tri(g,[0,.08,.035],[0,.48,.04],[0,.08,-.16],w);tri(g,[0,.08,-.16],[0,.48,.04],[0,.08,.035],w);
    tri(g,[0,.42,.045],[0,.07,.2],[0,.07,.05],w2);tri(g,[0,.07,.05],[0,.07,.2],[0,.42,.045],w2);},10);
  // sillage miniature (12 nov. 2026, v3.5) : un petit remous blanc juste derrière la poupe et deux rides très légères
  // qui s'effacent vite (avant : un grand V blanc trop marqué). En bas du dessin = la poupe, en haut = loin derrière.
  const cv=cvs(64,128),x=cv.getContext('2d'),im=x.createImageData(64,128),hs=(a,b)=>{const v=Math.sin(a*12.9898+b*78.233)*43758.5453;return v-Math.floor(v);};
  for(let py=0;py<128;py++)for(let px=0;px<64;px++){
    const t=1-(py+.5)/128,dx=Math.abs(px+.5-32),gr=.55+.45*hs(px>>1,py>>1);
    const cw=2.2+t*7,churn=Math.exp(-(dx*dx)/(2*cw*cw))*Math.pow(Math.max(0,1-t/.6),2)*.75*gr;
    const vx=4+t*20,rip=Math.exp(-Math.pow(dx-vx,2)/1.6)*Math.pow(Math.max(0,1-t),2.2)*.3;
    const a=Math.min(1,churn+rip)*(t<.03?t/.03:1),o=(py*64+px)*4;
    im.data[o]=im.data[o+1]=im.data[o+2]=255;im.data[o+3]=Math.round(a*255);}
  x.putImageData(im,0,0);
  const wt=new THREE.CanvasTexture(cv);const pg=new THREE.PlaneGeometry(.26,.5);pg.rotateX(-Math.PI/2);pg.translate(0,0,-.25);
  const wake=new THREE.InstancedMesh(pg,new THREE.MeshBasicMaterial({map:wt,transparent:true,depthWrite:false,opacity:.55}),20);wake.count=0;wake.frustumCulled=false;wake.renderOrder=2;E.gC.add(wake);
  E.boats={T:boatTypes(motor,sail),mesh:motor,sail,wake,list:[],path:[],m:new THREE.Matrix4(),col:new THREE.Color(),e:new THREE.Euler(),q:new THREE.Quaternion(),p:new THREE.Vector3(),s:new THREE.Vector3(1,1,1)};
}
function rebuildBoats(){
  const B=E.boats,path=[];
  for(let z=0;z<N;z++){let best=null,run=null;   // v4 : le plus large plan d'eau de chaque ligne (rivière ou mer)
    for(let x=30;x<=N;x++){const w=x<N&&ter[z*N+x];if(w){if(!run)run=[x,x];run[1]=x;}else if(run){if(!best||run[1]-run[0]>best[1]-best[0])best=run;run=null;}}
    if(best&&best[1]-best[0]>=1)path.push([(best[0]+best[1]+1)/2,z+.5]);else if(path.length)break;}
  const sm=path.map((p,k)=>{let x=0,c=0;for(let j=Math.max(0,k-2);j<=Math.min(path.length-1,k+2);j++){x+=path[j][0];c++;}return[x/c,p[1]];});
  B.path=sm;B.list=[];
  const n=sm.length>12?Math.min(12,Math.max(4,Math.round(sm.length/6))):0,cols=['#ffffff','#f3f6fb','#fff3e0','#e8f2ff','#ffffff','#eefaf3','#fdf0f0'],TY=['motor','sail','yacht','barge','trawl','tug','cata','motor','sail','yacht','barge','cata'];   /* v13 : 7 types de bateaux */
  for(let k=0;k<n;k++){const ty=TY[k%TY.length],sp=BOAT_SP[ty];B.list.push({s:Math.random()*(sm.length-1),dir:Math.random()<.5?1:-1,sp:sp[0]+Math.random()*sp[1],ty,sail:ty==='sail'||ty==='cata',col:ty==='motor'||ty==='yacht'?cols[k%cols.length]:'#ffffff',lane:(Math.random()-.5)*.5});}
  const cnt={};B.list.forEach(o=>{const M=B.T[o.ty],i=cnt[o.ty]||0;M.setColorAt(i,B.col.set(o.col));cnt[o.ty]=i+1;});
  Object.values(B.T).forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;});
  if(E.boat2)rebuildBoats2();
}
function stepBoats(dt){
  const B=E.boats,P=B.path;if(!B.list.length){Object.values(B.T).forEach(m=>m.count=0);B.wake.count=0;return;}
  let nw=0;const cnt={},WK=BOAT_K/.68;
  for(const b of B.list){
    if(b.wait>0)b.wait-=dt;else{b.s+=b.dir*b.sp*dt*clamp(Math.min(b.s,P.length-1-b.s)/2.5,.3,1);if(b.s<=0){b.s=0;b.dir=1;b.wait=3;}if(b.s>=P.length-1.001){b.s=P.length-1.001;b.dir=-1;b.wait=3;}}   /* v12 : ralentit, s'arrête et fait demi-tour en douceur */
    const k=Math.floor(b.s),f=b.s-k,a=P[k],c=P[k+1];
    const ex=c[0]-a[0],ez=c[1]-a[1],el=Math.hypot(ex,ez)||1,st_=(.25+b.lane*.3)*b.dir;b.sd=b.sd==null?st_:b.sd+(st_-b.sd)*Math.min(1,dt*.45);
    const ta=Math.atan2(ex*b.dir,ez*b.dir);b.a=b.a==null?ta:angLerp(b.a,ta,Math.min(1,dt*(b.sail?.7:1.1)));
    const x=lerp(a[0],c[0],f)-ez/el*b.sd,z=lerp(a[1],c[1],f)+ex/el*b.sd,ang=b.a,tx=Math.sin(ang),tz=Math.cos(ang),l=1;
    B.e.set(Math.sin(E.t*1.3+b.s)*.03,ang,Math.cos(E.t*1.1+b.s*1.7)*.04,'YXZ');B.q.setFromEuler(B.e);B.p.set(x,-.057+Math.sin(E.t*2+b.s)*.004,z);
    B.s.set(BOAT_K,BOAT_K,BOAT_K);B.m.compose(B.p,B.q,B.s);   /* bateaux plus petits, façon maquette */
    {const M=B.T[b.ty]||B.mesh,i=cnt[b.ty]||0;if(i<10)M.setMatrixAt(i,B.m);cnt[b.ty]=i+1;}
    // petit sillage collé à la poupe : un peu plus long pour les vedettes, presque rien pour les voiliers ou à l'arrêt
    const L=(BOAT_WL[b.ty]||.124)*BOAT_K,ws=dt>0&&!(b.wait>0)?1:.3;B.p.set(x-tx/l*L,-.0575,z-tz/l*L);B.e.set(0,ang,0,'YXZ');B.q.setFromEuler(B.e);
    B.s.set((b.sail?.85:1)*WK*(b.ty==='barge'?1.2:1),1,ws*WK*(b.sail?.55:.75+b.sp*.6));B.m.compose(B.p,B.q,B.s);B.s.set(1,1,1);B.wake.setMatrixAt(nw++,B.m);
  }
  for(const k in B.T){B.T[k].count=Math.min(10,cnt[k]||0);B.T[k].instanceMatrix.needsUpdate=true;}B.wake.count=nw;B.wake.instanceMatrix.needsUpdate=true;
}
function mergeSimple(list){
  let n=0;const gs=list.map(g=>{const h=g.index?g.toNonIndexed():g;n+=h.attributes.position.count;return h;});
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3);let o=0;
  gs.forEach(h=>{pos.set(h.attributes.position.array,o*3);nor.set(h.attributes.normal.array,o*3);o+=h.attributes.position.count;});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));return g;
}
function makeRotors(){
  const parts=[];
  for(let k=0;k<3;k++){const b=new THREE.BoxGeometry(.045,.66,.012);b.translate(0,.33,0);b.rotateZ(k*2.0944);parts.push(b);}
  parts.push(new THREE.BoxGeometry(.07,.07,.09));
  const mesh=new THREE.InstancedMesh(mergeSimple(parts),new THREE.MeshLambertMaterial({color:'#f7f7f7'}),96);
  mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=true;E.gD.add(mesh);
  E.rotors={mesh,list:[],a:0,m:new THREE.Matrix4(),q:new THREE.Quaternion(),e:new THREE.Euler(),p:new THREE.Vector3(),s:new THREE.Vector3(1,1,1)};
}
function colorGeo(g,hex){const c=new THREE.Color(hex),n=g.attributes.position.count,a=new Float32Array(n*3);for(let k=0;k<n;k++){a[k*3]=c.r;a[k*3+1]=c.g;a[k*3+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;}
function mergeCol(list){
  let n=0;const gs=list.map(([g,h])=>{const q=g.index?g.toNonIndexed():g;colorGeo(q,h);n+=q.attributes.position.count;return q;});
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3);let o=0;
  gs.forEach(q=>{pos.set(q.attributes.position.array,o*3);nor.set(q.attributes.normal.array,o*3);col.set(q.attributes.color.array,o*3);o+=q.attributes.position.count;});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));return g;
}
function makeWheels(){
  const parts=[[new THREE.TorusGeometry(1,.035,6,40),'#f4f4f4'],[new THREE.TorusGeometry(.12,.04,6,12),'#9aa0a6']];
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2,sp=new THREE.BoxGeometry(.025,1,.025);sp.translate(0,.5,0);sp.rotateZ(a);parts.push([sp,'#dfe3e6']);
    const g=new THREE.BoxGeometry(.13,.12,.13);g.translate(-Math.sin(a),Math.cos(a)-.06,0);parts.push([g,['#e63946','#3b8fdc','#f2c14e','#45b36b'][k%4]]);}
  const mesh=new THREE.InstancedMesh(mergeCol(parts),new THREE.MeshLambertMaterial({vertexColors:true}),24);
  mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=true;E.gD.add(mesh);
  E.wheels={mesh,list:[],a:0,m:new THREE.Matrix4(),q:new THREE.Quaternion(),e:new THREE.Euler(),p:new THREE.Vector3(),s:new THREE.Vector3()};
}
function collectWheels(){const L=[];E.bc.forEach(ch=>{for(let k=0;k<ch.wh.length;k+=5)L.push(ch.wh.slice(k,k+5));});E.wheels.list=L.slice(0,24);}
function stepWheels(dt){
  const W=E.wheels;W.a+=dt*.32;let n=0;
  for(const [x,y,z,k,r] of W.list){W.e.set(0,k*Math.PI/2,W.a,'YXZ');W.q.setFromEuler(W.e);W.p.set(x,y,z);W.s.setScalar(r);W.m.compose(W.p,W.q,W.s);W.mesh.setMatrixAt(n++,W.m);}
  W.mesh.count=n;if(n)W.mesh.instanceMatrix.needsUpdate=true;
}
function collectRotors(){const L=[];E.bc.forEach(ch=>{for(let k=0;k<ch.rot.length;k+=4)L.push(ch.rot.slice(k,k+4));});E.rotors.list=L.slice(0,96);}
function stepRotors(dt){
  const R=E.rotors;R.a+=dt*2.6*windK();   /* v10 : selon le vent */let n=0;
  for(const [x,y,z,k] of R.list){R.e.set(0,k*Math.PI/2,R.a+x*1.7+z,'YXZ');R.q.setFromEuler(R.e);R.p.set(x,y,z);R.m.compose(R.p,R.q,R.s);R.mesh.setMatrixAt(n++,R.m);}
  R.mesh.count=n;if(n)R.mesh.instanceMatrix.needsUpdate=true;
}
// Fumées et vapeur : particules douces (shader maison)
function makeSmoke(){
  const M=520,geo=new THREE.BufferGeometry(),pos=new Float32Array(M*3),sz=new Float32Array(M),al=new Float32Array(M),col=new Float32Array(M*3);
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize',new THREE.BufferAttribute(sz,1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha',new THREE.BufferAttribute(al,1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aCol',new THREE.BufferAttribute(col,3).setUsage(THREE.DynamicDrawUsage));
  const mat=new THREE.ShaderMaterial({uniforms:{uScale:{value:500}},transparent:true,depthWrite:false,
    vertexShader:'attribute float aSize;attribute float aAlpha;attribute vec3 aCol;varying float vA;varying vec3 vC;uniform float uScale;void main(){vA=aAlpha;vC=aCol;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uScale/max(.5,-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'varying float vA;varying vec3 vC;void main(){vec2 d=gl_PointCoord-.5;float r=length(d);if(r>.5)discard;gl_FragColor=vec4(vC,vA*smoothstep(.5,.12,r));}'});
  const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;pts.renderOrder=3;E.gD.add(pts);
  E.smoke={pts,geo,pos,sz,al,col,M,p:[],em:[],acc:0};
}
function collectEmitters(){const L=[];E.bc.forEach(ch=>{for(let k=0;k<ch.emit.length;k+=4)L.push(ch.emit.slice(k,k+4));});E.smoke.em=L;}
const SMOKE_COL=[[.42,.42,.44],[.95,.96,.97],[.25,.22,.2]];
function stepSmoke(dt){
  const P=E.smoke,list=P.p,em=P.em,run=SPEEDS[S.speed]?1:.35;
  if(em.length){
    P.acc+=dt*Math.min(260,em.length*3.2)*run;
    while(P.acc>=1&&list.length<P.M){P.acc-=1;const e=em[(Math.random()*em.length)|0],k=e[3];if(k===0&&!smokeOn(e))continue;   /* v10 : usine à l'arrêt = pas de fumée */
      list.push({x:e[0]+(Math.random()-.5)*.06,y:e[1],z:e[2]+(Math.random()-.5)*.06,vx:.12+Math.random()*.08,vz:.05,vy:k===2?.55:.32+Math.random()*.15,a:0,l:k===1?3.2:k===2?1.6:2.6,s0:k===1?.25:.16,s1:k===1?.9:.6,k});}
    if(P.acc>5)P.acc=5;
  }
  let n=0;
  for(let j=list.length-1;j>=0;j--){const p=list[j];p.a+=dt;if(p.a>=p.l){list[j]=list[list.length-1];list.pop();}}
  for(const p of list){
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;const f=p.a/p.l;
    P.pos[n*3]=p.x;P.pos[n*3+1]=p.y;P.pos[n*3+2]=p.z;P.sz[n]=lerp(p.s0,p.s1,f);
    P.al[n]=Math.min(1,f*6)*(1-f)*(p.k===1?.5:.42);const c=SMOKE_COL[p.k];const dk=1-E.night*.55;
    P.col[n*3]=c[0]*dk;P.col[n*3+1]=c[1]*dk;P.col[n*3+2]=c[2]*dk;n++;
  }
  P.geo.setDrawRange(0,n);
  ['position','aSize','aAlpha','aCol'].forEach(a=>P.geo.attributes[a].needsUpdate=true);
}
const ICON_KINDS=['power','water','fire','aband','road','garbage','patient','repair','crisis','dmg','flood'];
function makeIcons(){
  E.icons={};
  for(const k of ICON_KINDS){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(3*700),3));geo.setDrawRange(0,0);
    const mat=new THREE.PointsMaterial({map:iconTex(k),size:19*E.renderer.getPixelRatio(),sizeAttenuation:false,transparent:true,depthTest:false,depthWrite:false});
    const p=new THREE.Points(geo,mat);p.frustumCulled=false;p.renderOrder=20;E.gI.add(p);E.icons[k]=p;
  }
}
function rebuildIcons(){
  const L={power:[],water:[],fire:[],aband:[],road:[],garbage:[],patient:[],repair:[],crisis:[],dmg:[],flood:[]};
  for(let i=0;i<NN;i++){
    if(!lvl[i]||!zone[i])continue;const s=st[i],x=i%N+.5,z=((i/N)|0)+.5,y=(TOP[i]||.5)+.32;
    if(s===FIRE)L.fire.push(x,y+.2,z);else if(s===ABAND)L.aband.push(x,y,z);
    else if(s===OK&&cap[i]){if(rdist[i]>2)L.road.push(x,y,z);else if(!pw[i])L.power.push(x,y,z);else if(!wt[i])L.water.push(x,y,z);else if(garbageOn()&&!gb[i])L.garbage.push(x,y,z);}
  }
  for(const s of SV.values())if(!svcOK.get(s.id))(svcDamaged(s.id)?L.dmg:L.road).push(s.x+s.w/2,(TOP[s.z*N+s.x]||1)+.4,s.z+s.d/2);
  extIcons(L);
  for(const k of ICON_KINDS){const p=E.icons[k],a=L[k],n=Math.min(a.length/3,700),arr=p.geometry.attributes.position.array;
    for(let j=0;j<n*3;j++)arr[j]=a[j];p.geometry.attributes.position.needsUpdate=true;p.geometry.setDrawRange(0,n);}
}
function makeLights(){
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(3*NN),3));geo.setDrawRange(0,0);
  const mat=new THREE.PointsMaterial({map:glowTex(),size:.32,sizeAttenuation:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:new THREE.Color('#ffcf87'),opacity:0});
  E.lamps=new THREE.Points(geo,mat);E.lamps.frustumCulled=false;E.lamps.visible=false;E.gD.add(E.lamps);
  const pg=new THREE.PlaneGeometry(1.3,1.3);pg.rotateX(-Math.PI/2);const cap=Math.ceil(NN/2)+64;   /* 13 nov. 2026 : flaque de lumière chaude sous chaque lampadaire */
  E.pools=new THREE.InstancedMesh(pg,new THREE.MeshBasicMaterial({map:glowTex(),color:new THREE.Color('#ffc46b'),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}),cap);
  E.pools.userData.cap=cap;E.pools.count=0;E.pools.frustumCulled=false;E.pools.visible=false;E.pools.renderOrder=2;E.gD.add(E.pools);
}
function rebuildLights(){
  const L=[];E.roadList=[];
  const PL=[];
  const kTX=[TX.x,TX.z,TX.k];
  for(let i=0;i<NN;i++){if(!road[i])continue;E.roadList.push(i);const x=i%N,z=(i/N)|0;
    if(lampAt(i)){if(lampOn(i)){TX.x=x+.5;TX.z=z+.5;TX.k=lampK(i);const h=P(-.31,-.42),pp=P(-.26,-.3);L.push(h[0],.33,h[1]);PL.push(pp[0],pp[1]);}}   /* v12 : suit les nouveaux lampadaires */
    else if((x*3+z*5)%4===0&&(ter[i]||mtn[i]||lane[i]||rx[i]||SIG[i]))L.push(x+.16,ter[i]?.42:.3+(mtn[i]?mtnH(x+.16,z+.16):0),z+.16);}
  [TX.x,TX.z,TX.k]=kTX;
  for(let i=0;i<NN;i++)if(deco[i]===4&&!road[i]){const x=i%N,z=(i/N)|0;L.push(x+.5,.36,z+.5,x+.8,.36,z+.8);PL.push(x+.5,z+.5,x+.8,z+.8);}
  const arr=E.lamps.geometry.attributes.position.array;for(let j=0;j<L.length;j++)arr[j]=L[j];
  E.lamps.geometry.attributes.position.needsUpdate=true;E.lamps.geometry.setDrawRange(0,L.length/3);
  if(E.pools)E.pools.count=0;lmBuild(PL);   /* v13 : vraie lumière portée (carte de lumière) au lieu des ronds orange */
  recomputeSignals();rebuildBunting();
}
function makeFx(){
  const pg=new THREE.PlaneGeometry(.94,.94);pg.rotateX(-Math.PI/2);
  E.prev=new THREE.InstancedMesh(pg,new THREE.MeshBasicMaterial({transparent:true,opacity:.55,depthWrite:false}),NN);
  E.prev.count=0;E.prev.frustumCulled=false;E.prev.renderOrder=4;E.prev.setColorAt(0,new THREE.Color('#fff'));E.gF.add(E.prev);
  GB=new Map();TX.x=0;TX.z=0;TX.k=0;const t=.04;
  bx(-.5,-.5,.5,-.5+t,0,.06,'#ffd23f');bx(-.5,.5-t,.5,.5,0,.06,'#ffd23f');bx(-.5,-.5+t,-.5+t,.5-t,0,.06,'#ffd23f');bx(.5-t,-.5+t,.5,.5-t,0,.06,'#ffd23f');
  E.sel=new THREE.Mesh(toGeo(GB.get('plain')),new THREE.MeshBasicMaterial({vertexColors:true}));GB=null;E.sel.visible=false;E.gF.add(E.sel);
  const bg=new THREE.CylinderGeometry(.5,.5,1,28,1,true);bg.translate(0,.5,0);
  E.beam=new THREE.Mesh(bg,new THREE.MeshBasicMaterial({color:'#ffd23f',transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide}));E.beam.visible=false;E.gF.add(E.beam);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.97,1,72),new THREE.MeshBasicMaterial({color:'#2fd17a',transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));
  const disc=new THREE.Mesh(new THREE.CircleGeometry(.97,72),new THREE.MeshBasicMaterial({color:'#2fd17a',transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide}));
  E.ring=new THREE.Group();ring.rotation.x=disc.rotation.x=-Math.PI/2;E.ring.add(ring,disc);E.ring.visible=false;E.gF.add(E.ring);
  E.grid=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.16,depthWrite:false}));
  E.grid.visible=false;E.gF.add(E.grid);rebuildGrid();
}
function rebuildGrid(){
  const a=MS[S.ms].area,o=(N-a)>>1,v=[];
  for(let k=0;k<=a;k++){v.push(o+k,.02,o,o+k,.02,o+a,o,.02,o+k,o+a,.02,o+k);}
  E.grid.geometry.dispose();E.grid.geometry=new THREE.BufferGeometry();E.grid.geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
}
function fullRebuild(){
  E.gc.forEach(g=>g.all=true);
  for(let ci=0;ci<NCH*NCH;ci++)E.bDirty.add(ci);
  v4Rebuild();   // socle, relief, feux (avant les blocs : les poteaux des feux en dépendent)
  processDirty(true);
  rebuildTrees();rebuildLights();collectEmitters();collectRotors();collectWheels();rebuildIcons();rebuildBoats();
  D.trees=D.lights=D.icons=false;E.emitDirty=E.rotDirty=false;
  extRebuild();
}
function processDirty(all){
  let n=0;
  for(const gc of E.gc){
    if(gc.all){for(let z=gc.z0;z<gc.z0+CH;z++)for(let x=gc.x0;x<gc.x0+CH;x++)drawTile(z*N+x);gc.all=false;gc.tiles.clear();n+=2;}
    else if(gc.tiles.size){for(const i of gc.tiles)drawTile(i);gc.tiles.clear();n++;}
    if(!all&&n>=2)break;   /* v13 : au plus ~2 textures de sol envoyées par image (sol en double résolution) */
  }
  let k=0;const lim=all?1e9:E.bDirty.size>8?3:1,t0=performance.now();
  for(const ci of E.bDirty){E.bDirty.delete(ci);rebuildChunk(ci);if(++k>=lim||(!all&&performance.now()-t0>9))break;}   /* v13 : pas plus de ~9 ms par image */
}

// =========================================================
// Jour, nuit et caméra
// =========================================================
const SKY_DAY=new THREE.Color('#bfe3f5'),SKY_DUSK=new THREE.Color('#f7b27a'),SKY_PINK=new THREE.Color('#e7909f'),SKY_NIGHT=new THREE.Color('#182a4d');
const HEMI_DUSK=new THREE.Color('#ffd2b8'),GRD_DUSK=new THREE.Color('#7a6650'),SUN_GOLD=new THREE.Color('#ff8f4a');
const HEMI_DAY=new THREE.Color('#ffffff'),HEMI_NIGHT=new THREE.Color('#8292c6'),GRD_DAY=new THREE.Color('#6f8f5a'),GRD_NIGHT=new THREE.Color('#39424f');
const SUN_COL=new THREE.Color('#fff3df'),DUSK_COL=new THREE.Color('#ffb57a'),MOON_COL=new THREE.Color('#9fb4ff');
const _sky=new THREE.Color(),DAYLEN=300;
function updateSky(dt){
  if(S.set.dn)E.tod=(E.tod+dt*animK()/DAYLEN)%1;else E.tod=S.set.skyH??.4;
  E.ltod=S.set.dn?E.tod:((E.ltod??E.tod)+dt*animK()/DAYLEN)%1;   // v6 : la vie de la ville continue quand le ciel est figé   // le jour et la nuit suivent le rythme du temps (v4)
  // el : hauteur du soleil (−1 → 1) ; gold : heure dorée (lever et coucher), plus longue qu'avant
  const el=Math.sin((E.tod-.25)*Math.PI*2),day=clamp((el+.1)/.32,0,1),gold=clamp(1-Math.abs(el-.1)/.26,0,1)*(el>-.12?1:0);
  E.night=1-day;E.gold=gold;
  _sky.copy(SKY_NIGHT).lerp(SKY_DAY,day).lerp(SKY_DUSK,gold*.8).lerp(SKY_PINK,clamp(gold*1.6-1,0,1)*.45*(el<.08?1:.4));
  E.scene.background.copy(_sky);E.scene.fog.color.copy(_sky);
  E.hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY,day).lerp(HEMI_DUSK,gold*.7);E.hemi.groundColor.copy(GRD_NIGHT).lerp(GRD_DAY,day).lerp(GRD_DUSK,gold*.5);
  E.hemi.intensity=.78+.52*day+.12*gold;   /* v12 : nuit moins sombre */
  let dx,dy,dz;
  if(day>.08){const a=(E.tod-.25)*Math.PI*2;dx=-Math.cos(a)*.75;dy=Math.max(.11,el);dz=.45;   // soleil bas = ombres longues
    E.sun.color.copy(SUN_COL).lerp(DUSK_COL,clamp(gold*1.2,0,1)).lerp(SUN_GOLD,clamp(gold*1.8-.8,0,1));E.sun.intensity=2.4*day+1.1*gold;}
  else{dx=.35;dy=.85;dz=-.4;E.sun.color.copy(MOON_COL);E.sun.intensity=.45+.25*moonFull();}
  const l=Math.hypot(dx,dy,dz);updateShadow(dx/l,dy/l,dz/l);
  const lit=clamp((E.night-.3)/.5,0,1);
  E.lit.forEach(([m,k])=>m.emissiveIntensity=lit*k*litRhythm(m));if(E.mat.sign)E.mat.sign.color.setScalar(shopOpen()?1:.22);   /* v10 : rythme de la journée */
  E.lamps.visible=lit>.02;E.lamps.material.opacity=lit*(.6-.25*SNOW.value);LMK.value=lit;if(E.pools){E.pools.visible=lit>.02;E.pools.material.opacity=lit*.62*(1+WETU.value*.7);}
  for(const C of[E.cars,E.taxis,E.buses])if(C&&C.cone){C.cone.visible=lit>.05;C.cone.material.opacity=lit*(.4-.2*SNOW.value);}   /* v12 : phares qui éclairent la route */
}
function updateShadow(dx,dy,dz){
  const s=E.sun,ext=clamp(CAM.dist*.85,14,52);
  s.target.position.set(CAM.x,0,CAM.z);s.position.set(CAM.x+dx*80,dy*80,CAM.z+dz*80);
  if(Math.abs(ext-E.shadowExt)>1.5){const c=s.shadow.camera;c.left=-ext;c.right=ext;c.top=ext;c.bottom=-ext;c.updateProjectionMatrix();E.shadowExt=ext;}
}
function applyCam(){
  const cp=Math.cos(CAM.pitch),sp=Math.sin(CAM.pitch);
  E.camera.position.set(CAM.x+CAM.dist*cp*Math.sin(CAM.yaw),CAM.dist*sp,CAM.z+CAM.dist*cp*Math.cos(CAM.yaw));
  E.camera.lookAt(CAM.x,0,CAM.z);E.camera.updateMatrixWorld();
  E.scene.fog.near=CAM.dist*1.1+25;E.scene.fog.far=CAM.dist*2.6+120;
}
function clampCam(){CAM.x=clamp(CAM.x,-4,N+4);CAM.z=clamp(CAM.z,-4,N+4);CAM.dist=clamp(CAM.dist,5,100);CAM.pitch=clamp(CAM.pitch,E&&E.skyLook?.08:.3,1.45);}
function setRay(sx,sy){const r=E.renderer.domElement.getBoundingClientRect();E.ndc.set(((sx-r.left)/r.width)*2-1,-((sy-r.top)/r.height)*2+1);E.ray.setFromCamera(E.ndc,E.camera);}
const _gp=new THREE.Vector3();
function groundAt(sx,sy){setRay(sx,sy);const p=E.ray.ray.intersectPlane(E.plane,_gp);return p?{x:p.x,z:p.z}:null;}
function zoomAt(f,sx,sy){
  const a=groundAt(sx,sy);CAM.dist=clamp(CAM.dist*f,5,100);applyCam();
  const b=groundAt(sx,sy);if(a&&b){CAM.x+=a.x-b.x;CAM.z+=a.z-b.z;clampCam();applyCam();}
}
function tweenCam(to){E.tw={t:0,from:Object.assign({},CAM),to:Object.assign({},CAM,to)};}
function flyTo(x,z,dist){tweenCam({x,z,dist:dist||Math.min(CAM.dist,24)});}
function stepTween(dt){
  const w=E.tw;if(!w)return;w.t=Math.min(1,w.t+dt/.55);const k=1-Math.pow(1-w.t,3);
  for(const key of['x','z','dist','yaw','pitch'])CAM[key]=lerp(w.from[key],w.to[key],k);
  applyCam();if(w.t>=1)E.tw=null;
}
function camHome(){
  const a=MS[S.ms].area;tweenCam({x:N/2-3,z:N/2,dist:clamp(a*1.25,26,82),pitch:.92,yaw:CAM.yaw});
}
function camCmd(a){
  if(a==='left')tweenCam({yaw:CAM.yaw+Math.PI/4});else if(a==='right')tweenCam({yaw:CAM.yaw-Math.PI/4});
  else if(a==='in')tweenCam({dist:clamp(CAM.dist/1.35,5,100)});else if(a==='out')tweenCam({dist:clamp(CAM.dist*1.35,5,100)});
  else if(a==='home')camHome();
}

// =========================================================
// Boucle principale
// =========================================================
function loop(){
  if(!E||!E.running)return;
  E.raf=requestAnimationFrame(loop);
  const now=performance.now(),dt=Math.min(.1,E.clock.getDelta());E.t+=dt;
  const sp=SPEEDS[S.speed]||0,tk=timeK();   // v4 : × rythme du temps choisi dans les Réglages
  if(tk&&!E.hold){const t0=performance.now();E.acc+=dt*1000*tk;let g=0;while(E.acc>=DAY_MS&&g<8){simDay();E.acc-=DAY_MS;g++;}if(g>=8)E.acc=0;if(E.pf)E.pf.sim=(E.pf.sim||0)+performance.now()-t0;}
  stepTween(dt);stepKeys(dt);
  const pf0=performance.now();processDirty(false);if(E.pf)E.pf.dirty=(E.pf.dirty||0)+performance.now()-pf0;
  if(D.trees){rebuildTrees();D.trees=false;}
  if(D.lights){rebuildLights();D.lights=false;}
  if(D.icons&&now-(E.iconT||0)>350){rebuildIcons();D.icons=false;E.iconT=now;}
  if(E.emitDirty){collectEmitters();E.emitDirty=false;}
  if(E.rotDirty){collectRotors();collectWheels();E.rotDirty=false;}
  if(E.viewStale&&now-E.viewT>1200){E.viewStale=false;E.viewT=now;redrawAllGround();if(VIEW_BLD[VIEW])for(let ci=0;ci<NCH*NCH;ci++)E.bDirty.add(ci);}
  updateSky(dt);
  const run=dt*animK();   // en pause, tout ce qui bouge s'arrête ; sinon tout suit le rythme du temps (v4)
  let pt=performance.now();const PF=E.pf,pk=k=>{if(PF){const t=performance.now();PF[k]=(PF[k]||0)+t-pt;pt=t;}};
  stepCars(run);pk('cars');stepRotors(run);stepWheels(run);stepBoats(run);stepSmoke(dt);updateSeason(dt);stepFlakes(dt);pk('fx');
  extFrame(dt,sp);pk('ext');
  stepWater(dt);
  E.mat.fire.color.setScalar(.85+Math.sin(E.t*23)*.1+Math.sin(E.t*7.3)*.08);
  E.gI.position.y=Math.sin(E.t*2.4)*.06;
  if(E.beam.visible)E.beam.material.opacity=.1+Math.sin(E.t*3)*.05;
  renderFrame(dt);pk('render');if(PF)PF.n=(PF.n||0)+1;
  if(now-(E.hudT||0)>250){E.hudT=now;refreshHUD();}
  if(now-_lastSave>30000)save();
}
function resize(){
  if(!E||!E.stage)return;const w=E.stage.clientWidth,h=E.stage.clientHeight;if(!w||!h)return;
  E.renderer.setSize(w,h,false);E.camera.aspect=w/h;E.camera.updateProjectionMatrix();
  E.smoke.pts.material.uniforms.uScale.value=h*E.renderer.getPixelRatio()/(2*Math.tan(E.camera.fov*Math.PI/360));
  if(E.fx)E.fx.c.setSize(w,h);
}

// =========================================================
// Souris, doigts et clavier
// =========================================================
const PTR=new Map();let GEST=null;
function onDown(e){
  if(!E||!S)return;
  if(e.pointerType==='mouse'&&e.button===2)e.preventDefault();
  try{E.renderer.domElement.setPointerCapture(e.pointerId);}catch(_){}
  PTR.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(PTR.size===1){
    const b=e.button;GEST={mode:null,x0:e.clientX,y0:e.clientY,t0:performance.now(),moved:0,id:e.pointerId,touch:e.pointerType!=='mouse'};
    if(b===2||(b===0&&e.altKey))GEST.mode='rot';
    else if(b===1||TOOL.id==='inspect'){GEST.mode='pan';GEST.g=groundAt(e.clientX,e.clientY);}
    else{GEST.mode='tool';toolDown(e);}
  }else if(PTR.size===2){
    if(GEST&&GEST.mode==='tool')toolCancel();
    const [a,b]=[...PTR.values()],mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    GEST={mode:'pinch',d0:Math.hypot(a.x-b.x,a.y-b.y)||1,a0:Math.atan2(b.y-a.y,b.x-a.x),dist0:CAM.dist,yaw0:CAM.yaw,my0:my,pitch0:CAM.pitch,g:groundAt(mx,my),moved:99};
  }
}
function onMove(e){
  if(!E||!S)return;
  const p=PTR.get(e.pointerId);
  if(!p){if(e.pointerType==='mouse')toolHover(e);return;}
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(!GEST)return;
  if(GEST.x0!=null)GEST.moved=Math.max(GEST.moved,Math.hypot(e.clientX-GEST.x0,e.clientY-GEST.y0));
  if(GEST.mode==='pan'){if(FOLLOW&&GEST.moved>8)followStop();if(!GEST.g)GEST.g=groundAt(e.clientX,e.clientY);const g=groundAt(e.clientX,e.clientY);if(g&&GEST.g){CAM.x+=GEST.g.x-g.x;CAM.z+=GEST.g.z-g.z;clampCam();applyCam();}E.tw=null;}
  else if(GEST.mode==='rot'){CAM.yaw-=dx*.006;CAM.pitch=clamp(CAM.pitch+dy*.005,.3,1.45);applyCam();E.tw=null;}
  else if(GEST.mode==='pinch'&&PTR.size>=2){
    const [a,b]=[...PTR.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,an=Math.atan2(b.y-a.y,b.x-a.x),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    let da=an-GEST.a0;if(da>Math.PI)da-=Math.PI*2;if(da<-Math.PI)da+=Math.PI*2;
    CAM.dist=clamp(GEST.dist0*GEST.d0/d,5,100);CAM.yaw=GEST.yaw0+da;applyCam();
    if(GEST.g){const g=groundAt(mx,my);if(g){CAM.x+=GEST.g.x-g.x;CAM.z+=GEST.g.z-g.z;clampCam();applyCam();}}
    E.tw=null;
  }
  else if(GEST.mode==='tool')toolMove(e);
}
function onUp(e){
  if(!E||!S)return;
  const had=PTR.delete(e.pointerId);
  if(!had||!GEST)return;
  if(GEST.mode==='tool'){if(GEST.id===e.pointerId){toolUp(e);GEST=null;}return;}
  if(GEST.mode==='pan'&&GEST.moved<8&&performance.now()-GEST.t0<650&&e.button!==1)inspectAt(e);
  if(!PTR.size)GEST=null;
  else if(GEST.mode==='pinch'){const [a]=[...PTR.values()];GEST={mode:'pan',x0:null,moved:99,g:groundAt(a.x,a.y)};}
}
function onCancel(e){PTR.delete(e.pointerId);if(GEST&&GEST.mode==='tool')toolCancel();if(!PTR.size)GEST=null;}
function onWheel(e){e.preventDefault();zoomAt(Math.exp(clamp(e.deltaY,-120,120)*.0018),e.clientX,e.clientY);E.tw=null;}
function onLeave(){if(!DRAG){clearPreview();hideGhost();}}
function onKey(e){
  if(!E||!E.running||document.body.dataset.screen!=='city'||/input|textarea|select/i.test((e.target&&e.target.tagName)||''))return;
  const k=e.key,st_=CAM.dist*.06,fx=-Math.sin(CAM.yaw),fz=-Math.cos(CAM.yaw),rx=Math.cos(CAM.yaw),rz=-Math.sin(CAM.yaw);
  let used=true;
  // Ctrl/Cmd+Z d'abord (avant, « z » faisait avancer la caméra et l'annulation ne marchait jamais au clavier) ;
  // les autres raccourcis avec Ctrl/Cmd/Alt restent au navigateur (Cmd+R, Cmd+D…)
  if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==='z'){undo();refreshToolbar();}
  else if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==='s'){quickSave();}   // v4.2 : sauvegarde rapide
  else if(e.ctrlKey||e.metaKey||e.altKey)used=false;
  /* 13 nov. 2026 : zoom par position de touche (les deux touches à droite du 0, + et − du pavé), puis chiffres = menus */
  else if(e.code==='Equal'||e.code==='NumpadAdd'||k==='+'){CAM.dist/=1.15;}
  else if(e.code==='Minus'||e.code==='NumpadSubtract'||(k==='-'&&!/^Digit/.test(e.code))){CAM.dist*=1.15;}
  else if(/^(Digit|Numpad)\d$/.test(e.code)){const c=KEY_CATS[e.code.slice(-1)];if(c&&!VISIT)pickCat(c);else used=false;}
  else if(k==='f'||k==='F'){setFS(!isFS());}
  else if(CAM_KEYS[k.toLowerCase()]){KEYS.add(k.toLowerCase());}   /* v13 : Z Q S D (ou flèches) glissent en douceur tant que la touche est enfoncée ; E R tournent */
  else if(k==='Tab'&&!e.shiftKey){if(!VISIT&&!e.repeat)togglePanel('quiz');}   /* 16 nov. 2026 : Tab ouvre le défi du maire (QCM) ; A et E tournent la vue */
  else if(k==='b'||k==='B'||k==='Delete'||k==='Backspace'){if(!VISIT)pickCat('bulldoze');}
  else if(k==='i'||k==='I'){pickCat('inspect');}
  else if(k==='h'||k==='H'){camHome();}
  else if(k==='v'||k==='V'){togglePanel('views');}
  else if(k==='m'||k==='M'){if(!VISIT&&!e.repeat)togglePanel('quiz');}
  else if(k==='g'||k==='G'){togglePanel('budget');}
  else if(k==='o'||k==='O'){togglePanel('goals');}
  else if(k==='p'||k==='P'){setSpeed(S.speed?0:(E.lastSpeed||1));}
  else if(k==='x'||k==='X'){setSpeed(S.speed>=3?1:S.speed+1);}
  else if(k==='u'||k==='U'){const b=$('cty');photoMode(!(b&&b.classList.contains('photo')));}
  else if(k==='k'||k==='K'||k==='?'){togglePanel('keys');}
  else if(extKey(k)){}
  else if(k==='Escape'){if(PANEL)closePanel();else setTool('inspect');}
  else if(k===' '){setSpeed(S.speed?0:(E.lastSpeed||1));}
  else used=false;
  if(used){e.preventDefault();clampCam();applyCam();E.tw=null;}
}

// =========================================================
// Outils de construction
// =========================================================
let TOOL={id:'inspect'},DRAG=null,SEL=null;
function tileAt(e){const g=groundAt(e.clientX,e.clientY);if(!g)return null;const x=Math.floor(g.x),z=Math.floor(g.z);return x<0||z<0||x>=N||z>=N?null:{x,z};}
function toolDown(e){const t=tileAt(e);if(!t)return;DRAG={x0:t.x,z0:t.z,x1:t.x,z1:t.z};if(TOOL.id==='place')showGhost(t);else previewFor(DRAG);}
function toolMove(e){const t=tileAt(e);if(!t||!DRAG)return;if(t.x===DRAG.x1&&t.z===DRAG.z1)return;DRAG.x1=t.x;DRAG.z1=t.z;if(TOOL.id==='place')showGhost(t);else previewFor(DRAG);}
function toolUp(e){
  if(!DRAG)return;const d=DRAG;DRAG=null;
  if(TOOL.id==='place')placeAt(d.x1,d.z1);else if(TOOL.id==='road')commitRoad(d);else if(!extToolUp(d))commitRect(d);
  clearPreview();hideGhost();
  if(e&&e.pointerType==='mouse')setTimeout(()=>toolHover(e),0);
}
function toolCancel(){DRAG=null;clearPreview();hideGhost();}
function toolHover(e){
  if(TOOL.id==='inspect'||DRAG)return;
  const t=tileAt(e);if(!t){clearPreview();hideGhost();return;}
  if(TOOL.id==='place')showGhost(t);else previewFor({x0:t.x,z0:t.z,x1:t.x,z1:t.z});
}
function setTool(id,opt){
  if(!E)return;toolCancel();
  if(VISIT&&id!=='inspect'){toast('Tu visites la ville d’un ami : impossible d’y construire.','visibility');id='inspect';}
  TOOL={id};if(id==='zone')TOOL.z=opt;if(id==='place')TOOL.b=opt;if(id==='road')TOOL.rt=opt===3?3:1;if(EXT_TOOLS[id])TOOL.k=opt;
  const zv=id==='zone'||id==='dezone';if(zv!==ZONEVIEW){ZONEVIEW=zv;redrawAllGround();}
  E.grid.visible=id!=='inspect';
  if(id!=='inspect'){hideSelection();if(PANEL==='inspect')closePanel();}
  refreshToolbar();
  const touch=matchMedia('(pointer:coarse)').matches;
  const msg=({road:'Glisse pour tracer une route',zone:'Glisse pour délimiter une zone',dezone:'Glisse pour retirer des zones',bulldoze:'Glisse sur ce que tu veux démolir : ce que tu as payé t’est rendu',trees:'Glisse pour planter des arbres',place:'Touche le terrain pour construire'})[id]||(EXT_TOOLS[id]&&EXT_TOOLS[id].msg);
  extToolSet(id);
  if(msg)tip(msg+(touch?' · deux doigts pour bouger la vue':''),'info',2600);else hideTip();
}
function roadPath(d){
  if(TOOL.dg){   /* 13 nov. 2026 : route en diagonale (45°) puis tout droit pour le reste */
    const pts=[[d.x0,d.z0]],sx=Math.sign(d.x1-d.x0),sz=Math.sign(d.z1-d.z0);let x=d.x0,z=d.z0;
    const m=Math.min(Math.abs(d.x1-d.x0),Math.abs(d.z1-d.z0));for(let k=0;k<m;k++){x+=sx;z+=sz;pts.push([x,z]);}
    while(x!==d.x1){x+=sx;pts.push([x,z]);}while(z!==d.z1){z+=sz;pts.push([x,z]);}
    return pts;}
  const pts=[[d.x0,d.z0]],hx=Math.abs(d.x1-d.x0)>=Math.abs(d.z1-d.z0),sx=Math.sign(d.x1-d.x0),sz=Math.sign(d.z1-d.z0);let x=d.x0,z=d.z0;
  if(hx){while(x!==d.x1){x+=sx;pts.push([x,z]);}while(z!==d.z1){z+=sz;pts.push([x,z]);}}
  else{while(z!==d.z1){z+=sz;pts.push([x,z]);}while(x!==d.x1){x+=sx;pts.push([x,z]);}}
  return pts;
}
function roadValid(x,z){const i=z*N+x;if(TOOL.dg&&ter[i])return false;return road[i]>0||(inArea(x,z)&&!svcAt[i]&&!hill[i]);}   /* 13 nov. 2026 : routes permises sur le relief (pas de diagonale sur l'eau) */
function roadPrice(av,water){return av?(water?60:25):(water?50:10);}   // prix d'une case neuve (route / avenue, pont si eau)
// Élargir une route en avenue coûte la différence : route + élargissement = prix de l'avenue (remboursement exact)
function roadCost(x,z){const i=z*N+x,av=TOOL.rt===3;if(road[i])return av&&road[i]===1?roadPrice(true,ter[i])-roadPrice(false,ter[i]):0;return roadPrice(av,ter[i])+(mtn[i]?MTN_ROAD:0);}
const MTN_ROAD=20;   /* supplément par case de route sur le relief (13 nov. 2026) */
// ── Démolition remboursée à 100 % (ajout 10 nov. 2026) ──
// On rend exactement ce qui a été payé : routes, avenues, ponts et bâtiments posés. Le zonage est gratuit
// (les bâtiments qui poussent ne coûtent rien) ; l'autoroute (road=2) et les arbres ne sont pas remboursés.
function roadRefund(i){return road[i]===3?roadPrice(true,ter[i]):road[i]===1?roadPrice(false,ter[i]):0;}
function svcRefund(s){const b=s&&BT[s.t];return b?b.cost|0:0;}
function cityValue(){ // {v: argent récupérable, n: éléments à raser}
  let v=0,n=0;
  for(let i=0;i<NN;i++){const r=roadRefund(i)+(lane[i]&&road[i]?LANE_COST[lane[i]]||0:0);if(r){v+=r;n++;}else if(zone[i]||lvl[i])n++;}
  for(const s of SV.values()){v+=svcRefund(s);n++;}
  return {v,n};
}
function rectTiles(d){const x0=Math.min(d.x0,d.x1),x1=Math.max(d.x0,d.x1),z0=Math.min(d.z0,d.z1),z1=Math.max(d.z0,d.z1),a=[];for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)a.push([x,z]);return a;}
function zoneOk(x,z){const i=z*N+x;return inArea(x,z)&&!ter[i]&&!road[i]&&!svcAt[i]&&!hill[i]&&!mtn[i]&&!deco[i];}
function previewFor(d){
  if(extPreview(d))return;
  const id=TOOL.id,list=[];
  if(id==='road'){
    const pts=roadPath(d),av=TOOL.rt===3;let cost=0,bad=0,br=0,up=0;
    for(const [x,z] of pts){const i=z*N+x,ok=roadValid(x,z);if(!ok)bad++;else{cost+=roadCost(x,z);if(ter[i]&&!road[i])br++;if(av&&road[i]===1)up++;}
      list.push([x,z,!ok?'#ff4d4d':(av&&road[i]===1)?'#ffd166':road[i]?'#9fb4c7':ter[i]?'#4fc3f7':av?'#7ad37a':'#3ddc84']);}
    setPreview(list);
    if(bad)tip(TOOL.dg&&pts.some(([x,z])=>ter[z*N+x])?'Pas de diagonale sur l’eau : fais le pont en ligne droite':'Impossible : hors du terrain constructible ou sur un bâtiment','bad');
    else tip(`${av?'Avenue':'Route'}${TOOL.dg?' en diagonale':''} · ${pts.length} case${pts.length>1?'s':''}${br?` dont ${br} de pont`:''}${pts.some(([x,z])=>mtn[z*N+x]&&!road[z*N+x])?' · sur le relief':''}${up?` · ${up} route${up>1?'s':''} élargie${up>1?'s':''}`:''} · ${money(cost)}`,cost>S.money?'bad':'');
    return;
  }
  let n=0,cost=0;const sv=new Set();
  for(const [x,z] of rectTiles(d)){const i=z*N+x;let col=null;
    if(id==='zone'){if(zoneOk(x,z)&&zone[i]!==TOOL.z){col=ZONES[TOOL.z].col;n++;}}
    else if(id==='dezone'){if(zone[i]){col='#ff8a65';n++;}}
    else if(id==='bulldoze'){const xr=extRefund(i);if(road[i]===1||road[i]===3||zone[i]||svcAt[i]||tree[i]||xr){col='#ff4d4d';n++;if(svcAt[i])sv.add(svcAt[i]);else cost+=roadRefund(i)+xr;}else col='#ffffff';}
    else if(id==='trees'){if(zoneOk(x,z)&&!zone[i]&&tree[i]<3){col='#2e7d32';n++;cost+=5;}}
    if(col)list.push([x,z,col]);}
  setPreview(list);
  if(id==='zone')tip(`${ZONES[TOOL.z].name} · ${n} case${n>1?'s':''} · gratuit`,n?'':'bad');
  else if(id==='dezone')tip(`Retirer la zone de ${n} case${n>1?'s':''}`);
  else if(id==='bulldoze'){sv.forEach(sid=>{cost+=svcRefund(SV.get(sid));});tip(n?`Démolir ${n} élément${n>1?'s':''}${cost?` · +${money(cost)} remboursés`:''}`:'Rien à démolir ici',n?'':'bad');}
  else if(id==='trees')tip(`Arbres · ${n} case${n>1?'s':''} · ${money(cost)}`,cost>S.money?'bad':'');
}
function setPreview(list){
  const P=E.prev,m=E._pm||(E._pm=new THREE.Matrix4()),c=E._pc||(E._pc=new THREE.Color());let n=0;
  for(const [x,z,col] of list){if(n>=NN)break;m.makeTranslation(x+.5,ter[z*N+x]?.17:.05,z+.5);P.setMatrixAt(n,m);c.set(col);P.setColorAt(n,c);n++;}
  P.count=n;P.instanceMatrix.needsUpdate=true;if(P.instanceColor)P.instanceColor.needsUpdate=true;
}
function clearPreview(){if(!E)return;E.prev.count=0;E.ring.visible=false;if(!DRAG)hideTip(true);}
function hideGhost(){if(E&&E.ghostG)E.ghostG.visible=false;if(E)E.ring.visible=false;}
function touchesWater(x0,z0,w,d){
  for(let x=x0;x<x0+w;x++){if(isW(x,z0-1)||isW(x,z0+d))return true;}
  for(let z=z0;z<z0+d;z++){if(isW(x0-1,z)||isW(x0+w,z))return true;}
  return false;
}
function unlocked(b){
  if(b.prof&&b.prof!==(S.prof||'kine'))return{ok:false,why:`Réservé aux ${PROF[b.prof].pros}`};
  if(b.trophy)return (S.trophies|0)>0?{ok:true}:{ok:false,why:'Gagne un duel du maire contre un ami pour obtenir cette statue'};
  if(b.lvl){const L=gamLvl();if(L<b.lvl)return{ok:false,why:`Niveau Kiné+ ${b.lvl} requis (tu es niveau ${L})`};if(svcCount(b.id))return{ok:false,why:'Monument unique : déjà construit'};return{ok:true};}
  if(b.unique&&svcCount(b.id))return{ok:false,why:'Déjà construite : un seul exemplaire par ville'};
  if((b.ms||0)>S.ms)return{ok:false,why:`Palier « ${MS[b.ms].name} » requis (${fmt(MS[b.ms].pop)} habitants)`};
  return{ok:true};
}
function placeCheck(b,x,z){
  const x0=x-Math.floor((b.w-1)/2),z0=z-Math.floor((b.d-1)/2);let ok=true,why='';
  for(let zz=z0;zz<z0+b.d;zz++)for(let xx=x0;xx<x0+b.w;xx++){
    if(xx<0||zz<0||xx>=N||zz>=N||!inArea(xx,zz)){ok=false;why='Hors du terrain constructible';continue;}
    const i=zz*N+xx;if(ter[i]){ok=false;why=why||'Impossible sur l’eau';}else if(road[i]){ok=false;why=why||'Il y a une route ici';}else if(svcAt[i]){ok=false;why=why||'Déjà occupé';}else if(mtn[i]){ok=false;why=why||'Impossible sur le relief (Décor → Aplanir)';}else if(hill[i]){ok=false;why=why||'Il y a une colline ici (Décor → Aplanir)';}
  }
  if(ok&&b.needRail&&!touchesRail(x0,z0,b.w,b.d)){ok=false;why='À placer contre des rails de tram';}
  if(ok&&!svcTouchesRoad(x0,z0,b.w,b.d)){ok=false;why='Doit toucher une route';}
  if(ok&&b.needWater&&!touchesWater(x0,z0,b.w,b.d)){ok=false;why='À placer au bord de l’eau';}
  if(ok&&S.money<svcPrice(b)){ok=false;why='Fonds insuffisants';}
  return{ok,why,x0,z0};
}
function ghostFor(b,rot){
  const key=b.id+'|'+rot;let g=E.ghosts.get(key);
  if(!g){
    GB=new Map();CUR=null;TX.x=b.w/2;TX.z=b.d/2;TX.k=rot;(SVB[b.id]||SVB.square)(rng(7),{id:1,t:b.id,x:0,z:0,w:b.w,d:b.d,rot});
    g=new THREE.Group();for(const [,geo] of GB)if(geo.p.length)g.add(new THREE.Mesh(toGeo(geo),E.mat.ghost));GB=null;
    g.renderOrder=6;E.ghosts.set(key,g);
  }
  return g;
}
function showGhost(t){
  const b=BT[TOOL.b];if(!b)return;
  const c=placeCheck(b,t.x,t.z),g=ghostFor(b,svcRot(c.x0,c.z0,b.w,b.d));
  if(E.ghostG!==g){if(E.ghostG)E.gF.remove(E.ghostG);E.ghostG=g;E.gF.add(g);}
  g.position.set(c.x0,0,c.z0);g.visible=true;
  const list=[];for(let z=c.z0;z<c.z0+b.d;z++)for(let x=c.x0;x<c.x0+b.w;x++)if(x>=0&&z>=0&&x<N&&z<N)list.push([x,z,c.ok?'#3ddc84':'#ff4d4d']);
  setPreview(list);
  const r=b.cov?Math.max(...Object.values(b.cov)):0;
  if(r){E.ring.visible=true;E.ring.position.set(c.x0+b.w/2,.06,c.z0+b.d/2);E.ring.scale.setScalar(r);E.ring.children.forEach(m=>m.material.color.set(c.ok?'#2fd17a':'#ff4d4d'));}
  else E.ring.visible=false;
  tip(c.ok?`${b.name} · ${money(b.cost)}${b.upkeep?` · entretien ${money(b.upkeep)}/mois`:''}`:c.why,c.ok?'':'bad');
}
function noMoney(cost){
  toastOnce('nomoney','savings',`Il te manque ${money(cost-S.money)}. Révise pour en gagner : 1 XP = ${XP_MONEY} §.`,0,{label:'Réviser',fn:goStudy});
}
function goStudy(){save();if(typeof startFlash==='function')startFlash();else if(typeof showScreen==='function')showScreen('home');}
function afterAction(){checkTuto();refreshHUD(true);refreshTray();}
let _clrBack=0;   // décor, rails, feux… effacés en construisant par-dessus : remboursés (voir extRefund)
function clearTile(i){rec(i);_clrBack+=extRefund(i);if(road[i]&&mtn[i]&&E)E.mtnDirty=true;dgClear(i);road[i]=0;lane[i]=0;zone[i]=0;lvl[i]=0;st[i]=0;tmr[i]=0;cap[i]=0;rail[i]=0;rx[i]=0;if(deco[i]){deco[i]=0;D.deco=true;}hill[i]=0;if(tree[i]){tree[i]=0;D.trees=true;}}
function commitRoad(d){
  const pts=roadPath(d);let cost=0,bad=0;
  for(const [x,z] of pts){if(!roadValid(x,z))bad++;else cost+=roadCost(x,z);}
  if(bad){toast(TOOL.dg&&pts.some(([x,z])=>ter[z*N+x])?'Une route en diagonale ne peut pas passer sur l’eau : fais le pont en ligne droite.':'Impossible : la route sort du terrain ou traverse un bâtiment.','block');return;}
  if(!cost)return;
  if(S.money<cost){noMoney(cost);return;}
  actBegin();_clrBack=0;
  const rt=TOOL.rt===3?3:1;
  let relief=false;
  for(const [x,z] of pts){const i=z*N+x;if(mtn[i])relief=true;if(road[i]){if(rt===3&&road[i]===1){rec(i);road[i]=3;touch(i,true);}continue;}clearTile(i);road[i]=rt;touch(i,true);}
  for(let k=1;k<pts.length;k++){const [ax,az]=pts[k-1],[bx_,bz]=pts[k],dx=bx_-ax,dz=bz-az;if(!dx||!dz)continue;   /* liaisons en diagonale */
    const d=DIRS8.findIndex((v,q)=>q>=4&&v[0]===dx&&v[1]===dz),a=az*N+ax,b=bz*N+bx_;rec(a);rec(b);dg[a]|=dgBit(d);dg[b]|=dgBit(OPP(d));touch(a,true);touch(b,true);}
  if(relief&&E)E.mtnDirty=true;
  cost-=_clrBack;_clrBack=0;S.money-=cost;actEnd(cost,rt===3?'avenue':'route');
  D.roads=D.lights=D.util=D.pol=D.trees=true;simRefresh();afterAction();floatMoney(-cost);
}
function commitRect(d){
  const id=TOOL.id,tiles=rectTiles(d);let n=0;
  if(id==='zone'){
    actBegin();
    for(const [x,z] of tiles){const i=z*N+x;if(!zoneOk(x,z)||zone[i]===TOOL.z)continue;rec(i);if(lvl[i]){lvl[i]=0;st[i]=0;cap[i]=0;}zone[i]=TOOL.z;tmr[i]=0;touch(i);n++;}
    actEnd(0,'zonage');if(n){D.util=D.pol=true;simRefresh();afterAction();}
  }else if(id==='dezone'){
    actBegin();
    for(const [x,z] of tiles){const i=z*N+x;if(!zone[i])continue;rec(i);zone[i]=0;lvl[i]=0;st[i]=0;tmr[i]=0;cap[i]=0;touch(i);n++;}
    actEnd(0,'dézonage');if(n){D.util=D.pol=true;simRefresh();afterAction();}
  }else if(id==='bulldoze'){
    actBegin();const svcs=new Set();let back=0;_clrBack=0;
    {const ob=ovpDemolish(tiles);if(ob){back+=ob;n++;}}   // v5 : ponts routiers
    for(const [x,z] of tiles){const i=z*N+x;
      if(svcAt[i]){svcs.add(svcAt[i]);continue;}
      if(road[i]===1||road[i]===3||zone[i]||lvl[i]||tree[i]||extRefund(i)){back+=roadRefund(i);clearTile(i);touch(i,true);n++;}}
    back+=_clrBack;_clrBack=0;
    svcs.forEach(sid=>{const s=removeSvc(sid);if(s){back+=svcRefund(s);ACT.del.push({id:s.id,t:s.t,x:s.x,z:s.z,rot:s.rot});n++;}});
    S.money+=back;actEnd(-back,'démolition'); // coût négatif : « Annuler » reprend l'argent rendu
    if(n){D.roads=D.util=D.pol=D.lights=D.cov=true;simRefresh();afterAction();floatMoney(back);if(SEL&&!selValid())hideSelection();}
  }else if(id==='trees'){
    const list=[];for(const [x,z] of tiles){const i=z*N+x;if(zoneOk(x,z)&&!zone[i]&&tree[i]<3)list.push(i);}
    const cost=list.length*5;if(!cost)return;if(S.money<cost){noMoney(cost);return;}
    actBegin();list.forEach(i=>{rec(i);tree[i]=Math.min(3,tree[i]+2);markG(i);});S.money-=cost;actEnd(cost,'arbres');
    D.trees=D.pol=true;afterAction();floatMoney(-cost);
  }
}
function placeAt(x,z){
  const b=BT[TOOL.b];if(!b)return;
  const u=unlocked(b);if(!u.ok){toast(u.why,'lock');return;}
  const c=placeCheck(b,x,z);
  if(!c.ok){if(c.why==='Fonds insuffisants')noMoney(svcPrice(b));else toast(c.why,'block');return;}
  actBegin();_clrBack=0;
  for(let zz=c.z0;zz<c.z0+b.d;zz++)for(let xx=c.x0;xx<c.x0+b.w;xx++)clearTile(zz*N+xx);
  const s=addSvc({t:b.id,x:c.x0,z:c.z0,rot:svcRot(c.x0,c.z0,b.w,b.d)});ACT.add.push(s.id);
  const net=svcPrice(b)-_clrBack;_clrBack=0;S.money-=net;actEnd(net,b.name);
  D.util=D.pol=true;simRefresh();afterAction();floatMoney(-net);extPlaced(b,s);
  if(b.lvl){setTool('inspect');toast(`<b>${esc(b.name)}</b> inauguré(e) ! Tes révisions ont payé.`,'celebration');}
  else if(b.id==='mairie'){setTool('inspect');TRAY=null;refreshToolbar();toast('<b>Mairie inaugurée !</b> Tu peux voter des arrêtés municipaux (bouton « Arrêtés »).','account_balance');}
}
function pickTile(e){
  setRay(e.clientX,e.clientY);
  const meshes=[];for(const ch of E.bc)for(const k in ch.meshes)if(k!=='fire')meshes.push(ch.meshes[k]);
  const h=E.ray.intersectObjects(meshes,false)[0];
  if(h){const p=h.point.clone();if(h.face)p.addScaledVector(h.face.normal,-.03);const x=Math.floor(p.x),z=Math.floor(p.z);if(x>=0&&z>=0&&x<N&&z<N)return{x,z};}
  return tileAt(e);
}
function inspectAt(e){if($('cty')&&$('cty').classList.contains('photo'))return;const t=pickTile(e);if(!t){closePanel();hideSelection();return;}SEL=t;showSelection();openPanel('inspect');}
function selValid(){if(!SEL)return false;const i=SEL.z*N+SEL.x;return true;}
function showSelection(){
  if(!SEL)return hideSelection();
  const i=SEL.z*N+SEL.x,s=svcAt[i]?SV.get(svcAt[i]):null;
  const x0=s?s.x:SEL.x,z0=s?s.z:SEL.z,w=s?s.w:1,d=s?s.d:1,h=Math.max(.6,(TOP[i]||0)+.4);
  E.sel.position.set(x0+w/2,0,z0+d/2);E.sel.scale.set(w,1,d);E.sel.visible=true;
  E.beam.position.set(x0+w/2,0,z0+d/2);E.beam.scale.set(w*.92,h,d*.92);E.beam.visible=false;   /* v15 : plus de cylindre jaune */
}
function hideSelection(){SEL=null;if(E){E.sel.visible=false;E.beam.visible=false;}}

// =========================================================
// Interface (HUD, menus, panneaux)
// =========================================================
let ROOT=null,PANEL=null,TRAY=null;
function $(id){return document.getElementById(id);}
function setText(id,t){const el=$(id);if(el&&el.textContent!==t)el.textContent=t;}
const CATS=[
  {id:'inspect',name:'Explorer',icon:'pan_tool_alt'},
  {id:'roads',name:'Routes',icon:'add_road'},
  {id:'zones',name:'Zones',icon:'grid_view'},
  {id:'energie',name:'Réseaux',icon:'bolt'},
  {id:'services',name:'Services',icon:'local_hospital'},
  {id:'transports',name:'Transports',icon:'directions_bus'},
  {id:'parcs',name:'Parcs',icon:'park'},
  {id:'loisirs',name:'Loisirs',icon:'attractions'},
  {id:'economie',name:'Économie',icon:'agriculture'},
  {id:'monuments',name:'Monuments',icon:'emoji_events'},
  {id:'decor',name:'Décor',icon:'local_florist'},
  {id:'outils',name:'Outils',icon:'handyman'},
  {id:'bulldoze',name:'Démolir',icon:'delete'}
];
// Raccourcis clavier des menus (13 nov. 2026) : chiffres du haut ou du pavé numérique, quelle que soit la disposition du clavier
const KEY_CATS={1:'roads',2:'zones',3:'energie',4:'services',5:'transports',6:'parcs',7:'loisirs',8:'economie',9:'monuments',0:'decor'};
const CAT_KEY={inspect:'I',bulldoze:'B'};for(const n in KEY_CATS)CAT_KEY[KEY_CATS[n]]=n;
function panelKeys(){
  const K=(keys,txt)=>`<div class="cty-keyrow"><span>${keys.map(x=>`<kbd>${x}</kbd>`).join(' ')}</span><em>${txt}</em></div>`;
  return head('keyboard','Raccourcis clavier','Touche K pour ouvrir ou fermer cette fenêtre')
    +`<div class="cty-sec">Construire</div><div class="cty-keys">`
    +CATS.filter(c=>CAT_KEY[c.id]).map(c=>K([CAT_KEY[c.id]],c.name)).join('')
    +K(['Suppr'],'Démolir aussi')+K(['Ctrl','Z'],'Annuler')+K(['T'],'Tourner le motif du tampon')+K(['Échap'],'Fermer / arrêter l’outil')
    +`</div><div class="cty-sec">Caméra</div><div class="cty-keys">`
    +K(['Z','Q','S','D'],'Avancer, gauche, reculer, droite (ou les flèches)')+K(['E'],'Tourner vers la gauche')+K(['A'],'Tourner vers la droite')+K(['+','−'],'Zoomer / dézoomer (ou la molette)')+K(['H'],'Revenir au centre de la ville')+(FS_OK?K(['F'],'Plein écran'):'')+K(['U'],'Mode photo (cacher l’interface)')
    +`</div><div class="cty-sec">Temps et fenêtres</div><div class="cty-keys">`
    +K(['Espace'],'Pause / reprendre')+K(['P'],'Pause aussi')+K(['X'],'Vitesse suivante (×1, ×2, ×4)')+K(['Tab'],'Défi du maire (QCM), ou M')+K(['G'],'Budget')+K(['O'],'Objectifs')+K(['V'],'Vues (électricité, eau, bonheur…)')+K(['Ctrl','S'],'Sauvegarde rapide')
    +`</div>`;
}
const VIEWS=[[null,'Normale','landscape'],['power','Électricité','bolt'],['water','Eau','water_drop'],['lv','Valeur foncière','diamond'],['pol','Pollution','cloud'],
  ['hap','Bonheur','mood'],['health','Santé','accessibility_new'],['edu','École','school'],['police','Sécurité','local_police'],['fire','Pompiers','local_fire_department'],['park','Loisirs','park'],['transport','Transports','directions_bus'],['garbage','Déchets','delete'],['road','Desserte','route'],['trf','Circulation','traffic'],['dist','Quartiers','holiday_village']];
const VIEW_LEGEND={power:'Jaune : alimenté · rouge : sans électricité',water:'Bleu : alimenté · rouge : sans eau',lv:'Du bleu (faible) au orange (forte)',pol:'Plus c’est brun, plus c’est pollué',
  hap:'Du rouge (malheureux) au vert (heureux)',trf:'Vert : ça roule · rouge : bouchons (avenues, tram, métro et ronds-points les réduisent)',dist:'Chaque couleur est un quartier (Outils → Quartiers)',transport:'Vert : quartier desservi · les lignes de métro et de tram sont dessinées',garbage:'Vert : déchets collectés · marron : poubelles qui débordent',road:'Bleu : route reliée · rouge : coupée de l’autoroute',def:'Vert : quartier couvert · rouge : bâtiment non couvert'};

function buildHUD(root){
  ROOT=root;
  root.innerHTML=`<div class="cty" id="cty">
  <div class="cty-stage" id="cty-stage"></div>
  <div class="cty-top">
   <div class="cty-bar">
    <div class="cty-bs cty-idc">
      <button class="cty-name" data-act="panel" data-p="settings" title="Réglages de la ville"><span id="cty-name"></span><span class="ms">edit</span></button>
      <button class="cty-ms" data-act="panel" data-p="goals" title="Paliers"><span class="cty-ms-l"><span id="cty-ms-name"></span><small id="cty-ms-next"></small></span><span class="cty-msbar"><i id="cty-ms-bar"></i></span></button>
    </div>
    <i class="cty-sep"></i>
    <div class="cty-bs cty-kpis">
      <button class="cty-kpi" data-act="panel" data-p="cits" title="Habitants : suis la journée de quelques habitants"><span class="ms">groups</span><b id="cty-pop">0</b></button>
      <button class="cty-kpi cty-kpi-m" data-act="panel" data-p="budget" title="Budget"><span class="ms">account_balance_wallet</span><b id="cty-money">0</b><small id="cty-net"></small></button>
      <div class="cty-kpi cty-kpi-h" title="Bonheur des habitants"><span class="ms" id="cty-hap-ic">sentiment_satisfied</span><b id="cty-hap">–</b></div>
    </div>
    <i class="cty-sep"></i>
    <button class="cty-bs cty-util" data-act="panel" data-p="stats" title="Réseaux : consommation / capacité">
      <span class="cty-u" id="cty-u-p"><span class="ms">bolt</span><i><b></b></i></span>
      <span class="cty-u" id="cty-u-w"><span class="ms">water_drop</span><i><b></b></i></span>
      <span class="cty-u" id="cty-u-g"><span class="ms">delete</span><i><b></b></i></span>
    </button>
    <i class="cty-sep"></i>
    <div class="cty-bs cty-time">
      <span class="cty-wx" id="cty-wx"></span>
      <span class="cty-date" id="cty-date"></span>
      <div class="cty-speed" id="cty-speed">
        <button data-act="speed" data-s="0" title="Pause (espace)" aria-label="Pause"><span class="ms">pause</span></button>
        <button data-act="speed" data-s="1" title="Vitesse normale" aria-label="Vitesse normale"><span class="ms">play_arrow</span></button>
        <button data-act="speed" data-s="2" title="Rapide" aria-label="Rapide"><span class="ms">fast_forward</span></button>
        <button data-act="speed" data-s="3" title="Très rapide" aria-label="Très rapide"><span class="ms">double_arrow</span></button>
      </div>
    </div>
    <i class="cty-sep"></i>
    <div class="cty-bs cty-rci" title="Demande : ce que réclament habitants et entreprises">
      ${[1,2,3,4].map(z=>`<div class="cty-rci-c" id="cty-rcic-${z}"><div class="cty-rci-b"><i id="cty-rci-${z}" style="background:${ZONES[z].col}"></i></div><span>${ZONES[z].short}</span></div>`).join('')}
    </div>
   </div>
   <div class="cty-sp" id="cty-sp" style="display:none"></div>
  </div>
  <div class="cty-side">
    <button class="cty-quiz" data-act="panel" data-p="quiz" title="Défi du maire : des QCM de tes cours contre des primes (touche Tab)"><span class="ms">quiz</span><span class="lbl">Défi</span><i class="cty-badge" id="cty-qbadge"></i></button>
    <button data-act="panel" data-p="exam" title="Examen blanc du maire : 20 QCM chronométrés, une note sur 20 et une prime"><span class="ms">assignment</span><span class="lbl">Examen</span></button>
    <button class="cty-patb" data-act="panel" data-p="patient" title="Cabinet : des habitants viennent consulter avec un cas clinique"><span class="ms">personal_injury</span><span class="lbl">Patients</span><i class="cty-badge" id="cty-pbadge"></i></button>
    <button data-act="panel" data-p="views" title="Vues d’information"><span class="ms">layers</span><span class="lbl">Vues</span></button>
    <button data-act="panel" data-p="budget" title="Budget, impôts et commerce"><span class="ms">account_balance</span><span class="lbl">Budget</span></button>
    <button data-act="panel" data-p="policies" title="Arrêtés municipaux"><span class="ms">gavel</span><span class="lbl">Arrêtés</span></button>
    <button data-act="panel" data-p="journal" title="Le journal de la ville"><span class="ms">newspaper</span><span class="lbl">Journal</span><i class="cty-badge dot" id="cty-jbadge"></i></button>
    <button data-act="panel" data-p="friends" title="Villes de tes amis : visite, classement, jumelage, duel"><span class="ms">diversity_3</span><span class="lbl">Amis</span><i class="cty-badge" id="cty-fbadge"></i></button>
    <button data-act="panel" data-p="ach" title="Succès et badges"><span class="ms">military_tech</span><span class="lbl">Succès</span></button>
    <button data-act="panel" data-p="quests" title="Carnet de quêtes : tutoriel, défis et quêtes de découverte"><span class="ms">auto_stories</span><span class="lbl">Quêtes</span></button>
    <button data-act="panel" data-p="stats" title="Statistiques et timelapse"><span class="ms">monitoring</span><span class="lbl">Stats</span></button>
    <button data-act="panel" data-p="saves" title="Sauvegardes : enregistrer ta ville et reprendre la partie de ton choix (Ctrl+S)"><span class="ms">save</span><span class="lbl">Sauvegardes</span></button>
    <button data-act="panel" data-p="settings" title="Réglages"><span class="ms">settings</span><span class="lbl">Réglages</span></button>
    <button data-act="panel" data-p="help" title="Comment jouer"><span class="ms">help</span><span class="lbl">Aide</span></button>
  </div>
  <div class="cty-cam">
    <button data-act="cam" data-c="left" title="Tourner à gauche" aria-label="Tourner à gauche"><span class="ms">rotate_left</span></button>
    <button data-act="cam" data-c="right" title="Tourner à droite" aria-label="Tourner à droite"><span class="ms">rotate_right</span></button>
    <button data-act="cam" data-c="in" title="Zoomer" aria-label="Zoomer"><span class="ms">add</span></button>
    <button data-act="cam" data-c="out" title="Dézoomer" aria-label="Dézoomer"><span class="ms">remove</span></button>
    <button data-act="cam" data-c="home" title="Vue d’ensemble" aria-label="Vue d’ensemble"><span class="ms">home</span></button>
    ${FS_OK?'<button data-act="fs" id="cty-fs" title="Plein écran (touche F)" aria-label="Plein écran (touche F)"><span class="ms">fullscreen</span></button>':''}
    <button data-act="snd" id="cty-snd" title="Sons d’ambiance" aria-label="Sons d’ambiance"><span class="ms">volume_up</span></button>
  </div>
  <div class="cty-banners" id="cty-banners"></div>
  <div class="cty-follow" id="cty-follow" style="display:none"></div>
  <div class="cty-labels" id="cty-labels"></div>
  <div class="cty-tuto" id="cty-tuto"></div>
  <div class="cty-bottom">
    <div class="cty-tray" id="cty-tray"></div>
    <div class="cty-tools" id="cty-tools"></div>
  </div>
  <div class="cty-tip" id="cty-tip"></div>
  <div class="cty-toasts" id="cty-toasts"></div>
  <div class="cty-event" id="cty-event" style="display:none"></div>
  <div class="cty-photo"><button data-act="snap"><span class="ms">photo_camera</span>Enregistrer la photo</button><button data-act="photo-off"><span class="ms">close</span>Quitter le mode photo</button></div>
  <div class="cty-panel" id="cty-panel"></div>
  <div class="cty-loading" id="cty-loading"><div class="house-spinner"></div>Construction de la ville…</div>
</div>`;
  root.addEventListener('click',onHudClick);
  root.addEventListener('input',onHudInput);
  qzBind($('cty-panel'));new ResizeObserver(()=>{if(PANEL==='quiz')qzApply();}).observe($('cty'));
  root.addEventListener('keydown',e=>{if(e.target&&e.target.id==='cty-rename'&&e.key==='Enter')renameCity();});
}
function onHudClick(e){
  const el=e.target.closest('[data-act]');if(!el||!ROOT||!ROOT.contains(el))return;
  const a=el.dataset.act;
  if(a==='panel')togglePanel(el.dataset.p);
  else if(a==='close')closePanel();
  else if(a==='speed')setSpeed(+el.dataset.s);
  else if(a==='cam')camCmd(el.dataset.c);
  else if(a==='fs')setFS(!isFS());
  else if(a==='cat')pickCat(el.dataset.c);
  else if(a==='item')pickItem(el.dataset.k);
  else if(a==='undo'){undo();refreshToolbar();}
  else if(a==='view')setView(el.dataset.v||null);
  else if(a==='study')goStudy();
  else if(a==='toast'){const t=TOASTS.get(+el.dataset.id);dismissToast(+el.dataset.id);if(t&&t.fn)t.fn();}
  else if(a==='tuto'){S.tutMin=!S.tutMin;renderTuto();}
  else if(a==='demolish')demolishSel();
  else if(a==='rename')renameCity();
  else if(a==='set')toggleSetting(el.dataset.k);
  else if(a==='uic')uiPick(el.dataset.c);
  else if(a==='uimreset'){S.set.uiM={};_uiKey='';extHUD();save();renderPanel();}
  else if(a==='raze')razeCity(el);
  else if(a==='goto')flyTo(+el.dataset.x,+el.dataset.z);
  else if(a==='qa')quizAnswer(+el.dataset.j);
  else if(a==='qnext'){qzPushHist();QZV=null;quizNext();renderPanel();const sc=$('cty-panel').querySelector('.cty-qz-scroll');if(sc)sc.scrollTop=0;}
  else if(a==='qprev')qzView(QZV==null?QZH.length-1:Math.max(0,QZV-1));
  else if(a==='qfwd')qzView(QZV!=null&&QZV<QZH.length-1?QZV+1:null);
  else if(a==='qback')qzView(null);
  else if(a==='qzbig')qzToggleBig();else if(a==='qzfs')qzFont(+el.dataset.d);
  else if(a==='pol')togglePolicy(el.dataset.k);
  else if(a==='choose')chooseEvent(el.dataset.k);
  else if(a==='photo-on')photoMode(true);
  else if(a==='photo-off')photoMode(false);
  else if(a==='snap')savePhoto();
  else if(!v4Click(a,el,e))extClick(a,el,e);
}
function onHudInput(e){
  const t=e.target;if(!t||!t.dataset)return;
  if(extInput(t))return;
  if(t.dataset.qf){const F=quizFilter();if(t.dataset.qf==='f'){F.f=t.value;F.t='';}else F.t=t.value;qzPushHist();QZV=null;QZ=null;quizNext();save();renderPanel();return;}
  if(t.dataset.vol){S.set.vol=clamp(+t.value/100,0,1);const lb=$('cty-vol');if(lb)lb.textContent=Math.round(S.set.vol*100)+' %';sndVolume();return;}
  if(!t.dataset.tax)return;
  const k=t.dataset.tax,v=clamp(+t.value|0,0,25);S.tax[k]=v;
  const lb=$('cty-tax-'+k);if(lb)lb.textContent=v+' %';
}
function setSpeed(s){if(VISIT)return;S.speed=clamp(s|0,0,3);if(S.speed&&E)E.lastSpeed=S.speed;refreshHUD(true);}
function dateStr(){const d=S.day,m=(d/30)|0;return `${(d%30)+1} ${MONTHS[m%12]} ${2026+((m/12)|0)}`;}
let _panelT=0,_month=-1;
function refreshHUD(force){
  if(!ROOT||!S)return;
  setText('cty-name',S.name);
  const m=MS[S.ms],nx=MS[S.ms+1];
  setText('cty-ms-name',m.name);
  setText('cty-ms-next',nx?`${fmt(ST.pop)} / ${fmt(nx.pop)} hab.`:`${fmt(ST.pop)} hab.`);
  const bar=$('cty-ms-bar');if(bar)bar.style.width=(nx?clamp((ST.pop-m.pop)/(nx.pop-m.pop),0,1)*100:100).toFixed(1)+'%';
  setText('cty-pop',fmt(ST.pop));
  const mo=$('cty-money');if(mo){setText('cty-money',VISIT?'Visite':money(S.money));mo.classList.toggle('neg',!VISIT&&S.money<0);}
  const net=S.last?S.last.net:null,ne=$('cty-net');
  if(ne){setText('cty-net',net==null?'':(net>=0?'+':'')+fmt(net)+' / mois');ne.classList.toggle('neg',net!=null&&net<0);}
  setText('cty-hap',ST.pop?ST.hap+' %':'–');
  setText('cty-hap-ic',ST.hap>=70?'sentiment_very_satisfied':ST.hap>=50?'sentiment_satisfied':ST.hap>=30?'sentiment_neutral':'sentiment_dissatisfied');
  setText('cty-date',dateStr());
  ROOT.querySelectorAll('#cty-speed button').forEach(b=>b.classList.toggle('active',+b.dataset.s===S.speed));
  for(const z of[1,2,3,4]){
    const el=$('cty-rci-'+z);if(!el)continue;const d=S.dem[z];
    el.style.height=Math.round(clamp(Math.abs(d),0,1)*100)+'%';el.classList.toggle('neg',d<0);
    const c=$('cty-rcic-'+z);if(c)c.classList.toggle('off',z===4&&S.ms<3);
  }
  const um=(id,u,p,on)=>{const el=$(id);if(!el)return;el.style.display=on===false?'none':'';const r=p>0?u/p:(u>0?2:0),b=el.querySelector('b');
    b.style.width=Math.min(100,r*100).toFixed(0)+'%';el.classList.toggle('warn',r>.85&&r<=1);el.classList.toggle('bad',r>1);el.title=`${fmt(u)} / ${fmt(p)}`;};
  um('cty-u-p',ST.pu,ST.pp);um('cty-u-w',ST.wu,ST.wp);um('cty-u-g',ST.gu,ST.gp,garbageOn());
  const qb=$('cty-qbadge');if(qb){const left=Math.max(0,QZ_CAP-quizToday().n);qb.textContent=left;qb.style.display=left?'':'none';}
  const evb=$('cty-event');if(evb&&(!!S.event&&!PANEL)!==(evb.style.display!=='none'))renderEventBanner();
  extHUD(force);
  const now=performance.now(),mon=(S.day/30)|0;
  if(PANEL==='inspect'&&now-_panelT>1000){_panelT=now;renderPanel();}
  if(PANEL==='budget'&&mon!==_month&&!(document.activeElement&&document.activeElement.type==='range'))renderPanel();
  _month=mon;
  const u=ROOT.querySelector('.cty-undo');if(u)u.disabled=!UNDO.length;
}
function refreshToolbar(){
  const el=$('cty-tools');if(!el)return;
  const active=TOOL.id==='inspect'&&!TRAY?'inspect':TOOL.id==='bulldoze'?'bulldoze':TRAY;
  el.innerHTML=CATS.map(c=>`<button class="cty-tool${c.id===active?' active':''}${c.id==='bulldoze'?' danger':''}" data-act="cat" data-c="${c.id}" title="${esc(c.name)}${CAT_KEY[c.id]?' (touche '+CAT_KEY[c.id]+')':''}"><span class="ms">${c.icon}</span><span class="lbl">${esc(c.name)}</span>${CAT_KEY[c.id]?`<i class="cty-kbd">${CAT_KEY[c.id]}</i>`:''}</button>`).join('')
    +`<button class="cty-tool cty-undo" data-act="undo" title="Annuler (Ctrl+Z)"${UNDO.length?'':' disabled'}><span class="ms">undo</span><span class="lbl">Annuler</span></button>`;
  refreshTray();placeLow();
}
function pickCat(c){
  if(c==='inspect'||c==='bulldoze'){TRAY=null;setTool(c);return;}
  if(TRAY===c){TRAY=null;setTool('inspect');return;}
  TRAY=c;
  if(c==='roads')setTool('road',1);else if(TOOL.id!=='inspect')setTool('inspect');else refreshToolbar();
}
function trayItems(cat){
  if(cat==='roads')return roadTray();   /* v15 : 5 cartes avec des options au lieu de 10 cartes */
  if(cat==='zones')return[1,2,3,4].map(z=>({k:'zone:'+z,icon:ZONES[z].icon,name:ZONES[z].name,cost:'Gratuit',col:ZONES[z].col,lock:z===4&&S.ms<3?MS[3].name:null,desc:ZONES[z].desc}))
    .concat([{k:'dezone',icon:'layers_clear',name:'Dézoner',cost:'Gratuit',desc:'Retire la zone sans toucher aux routes.'}]);
  const list=BLD.filter(b=>b.cat===cat&&(!b.prof||b.prof===(S.prof||'kine'))).map(b=>{const u=unlocked(b);return{k:'place:'+b.id,icon:b.icon,name:b.name,cost:money(b.cost),
    lock:u.ok?null:(svcCount(b.id)&&(b.lvl||b.unique))?'Construit':b.lvl?'Niveau '+b.lvl:b.trophy?'Duel à gagner':MS[b.ms||0].name,desc:b.desc};});   /* 13 nov. 2026 : la statue du duel (sans palier) faisait planter le menu Monuments */
  if(cat==='parcs')list.push({k:'trees',icon:'forest',name:'Arbres',cost:'5 § / case',desc:'Décor qui filtre un peu la pollution.'});
  return extTray(cat,list);
}
// ── Vignettes 3D du menu de construction (13 nov. 2026) : chaque bâtiment est rendu une fois dans un petit moteur à part ──
const THUMBS=new Map();let TH_R=null,THM=false;   /* THM : vignette en cours (Ma maison y dessine sa petite maison) */
function thumbFor(id){const B=BT[id];return B?thumbGen(id,B.w,()=>(SVB[id]||SVB.square)(rng(7),{id:0,t:id,x:-99,z:-99,w:B.w,d:B.w,rot:0})):null;}   /* v14 : passe par thumbGen */
function refreshTray(){
  const el=$('cty-tray');if(!el)return;
  if(!TRAY){el.classList.remove('open');el.innerHTML='';return;}
  const cur=TOOL.id==='place'?'place:'+TOOL.b:TOOL.id==='zone'?'zone:'+TOOL.z:TOOL.id==='road'?'road:'+TOOL.rt+(TOOL.dg?':d':''):EXT_TOOLS[TOOL.id]?'x:'+TOOL.id+':'+(TOOL.k==null?'':TOOL.k):TOOL.id;
  el.innerHTML=(TRAY==='monuments'?`<div class="cty-tray-note"><span class="ms">school</span>Débloqués par ton niveau Kiné+ (niveau ${gamLvl()}) : révise pour les obtenir !</div>`:extTrayNote(TRAY))
    +trayItems(TRAY).map(it=>{const th=trayThumb(it.k),on=it.opts?it.opts.some(o=>o.k===cur):it.k===cur;return `<button class="cty-item${th?' has-th':''}${on?' active':''}${it.lock?' locked':''}${it.opts&&it.opts.length>1?' has-opts':''}" data-act="item" data-k="${it.k}" title="${esc(it.desc||it.name)}">
      ${th?`<img class="cty-item-th" src="${th}" alt="" draggable="false"><span class="cty-item-ic mini"><span class="ms">${it.icon}</span></span>`:`<span class="cty-item-ic"${it.col?` style="background:${it.col};color:#fff"`:''}><span class="ms">${it.icon}</span></span>`}
      <span class="cty-item-name">${esc(it.name)}</span>
      ${it.lock?`<span class="cty-item-lock"><span class="ms">lock</span>${esc(it.lock)}</span>`:`<span class="cty-item-cost">${esc(it.cost)}</span>`}
      ${it.opts&&it.opts.length>1?`<span class="cty-item-opts">${it.opts.map(o=>`<span class="cty-iopt${o.k===it.k?' on':''}" data-act="item" data-k="${o.k}" title="${esc(o.desc||o.l)}">${o.ic?`<span class="ms">${o.ic}</span>`:''}${esc(o.l)}</span>`).join('')}</span>`:''}
    </button>`;}).join('');
  el.classList.add('open');
}
function pickItem(k){
  rdRemember(k);   /* v15 : variante choisie dans le menu des routes */
  const [a,b,c]=k.split(':');
  if(a==='x'){extPick(b,c);return;}
  if(a==='place'){const B=BT[b],u=unlocked(B);if(!u.ok){toast(esc(u.why)+(B.lvl&&!svcCount(B.id)?' : continue tes révisions !':''),'lock');return;}
    setTool('place',b);tip(`${B.name} · ${B.desc}`,'info',3200);}
  else if(a==='road'){setTool('road',+b===3?3:1);TOOL.dg=c==='d';refreshTray();if(TOOL.dg)tip('Glisse en biais : la route part en diagonale, puis continue tout droit.','info',3200);}
  else if(a==='zone'){const z=+b;if(z===4&&S.ms<3){toast(`Les bureaux arrivent au palier « ${MS[3].name} » (${fmt(MS[3].pop)} habitants).`,'lock');return;}setTool('zone',z);}
  else setTool(a);
}
// ── Panneaux ──
function togglePanel(p){if(PANEL===p)closePanel();else openPanel(p);}
const VISIT_BLOCK=['sos','anato','quests','cits','exam','saves','prof','recover','quiz','patient','budget','policies','event','settings','trade','districts','timelapse','ach','journal'];
function openPanel(p){
  if(VISIT&&VISIT_BLOCK.includes(p)){toast('Tu visites la ville d’un ami : reviens dans ta ville pour ça.','visibility');return;}
  if(PANEL==='inspect'&&p!=='inspect')hideSelection();
  v6PanelOpened(p);PANEL=p;renderPanel();const el=$('cty-panel');el.classList.add('open');el.dataset.p=p;el.scrollTop=0;qzApply();
  ROOT.querySelectorAll('.cty-side button').forEach(b=>b.classList.toggle('active',b.dataset.p===p));
}
function closePanel(){
  if(PANEL==='inspect')hideSelection();
  PANEL=null;const el=$('cty-panel');if(el){el.classList.remove('open');el.innerHTML='';}qzApply();
  if(ROOT)ROOT.querySelectorAll('.cty-side button').forEach(b=>b.classList.remove('active'));
}
function renderPanel(){
  const el=$('cty-panel');if(!el||!PANEL)return;
  const f={inspect:panelInspect,budget:panelBudget,goals:panelGoals,views:panelViews,settings:panelSettings,help:panelHelp,ms:panelMilestone,quiz:panelQuiz,policies:panelPolicies,stats:panelStats,event:panelEvent,...EXT_PANELS}[PANEL];
  const top=el.scrollTop,sc=el.querySelector('.cty-qz-scroll'),st=sc?sc.scrollTop:0;
  el.innerHTML=f?f():'';el.scrollTop=top;
  const sc2=el.querySelector('.cty-qz-scroll');if(sc2)sc2.scrollTop=st;   // défilement interne du Défi du maire
  extAfterRender();
}
// ── Fenêtre du Défi du maire : déplaçable et redimensionnable (ajout 10 nov. 2026) ──
// S.qzw = {x,y,w,h} place et taille choisies (null = à droite, comme les autres panneaux) ; S.qzBig = grande
// fenêtre centrée (bouton ⤢ ou double-clic sur l'en-tête). Le texte suit la largeur : --qz de 1 à 1,8.
const QZ_W0=370;
function qzApply(){
  const el=$('cty-panel'),box=$('cty');if(!el||!box)return;
  const st=el.style,fs=S&&S.qzFs?S.qzFs:1,reset=()=>{st.left=st.top=st.width=st.height=st.right=st.bottom=st.maxHeight='';st.removeProperty('--qz');el.classList.remove('cty-qzwin');if(PANEL==='quiz'&&fs!==1)st.setProperty('--qz',fs.toFixed(3));};
  if(PANEL!=='quiz'||!S){reset();return;}
  const W=box.clientWidth,H=box.clientHeight;let g=null;
  if(S.qzBig){const w=Math.min(760,W-32),h=Math.min(860,H-32);g={x:(W-w)/2,y:(H-h)/2,w,h};}
  else if(S.qzw)g=Object.assign({},S.qzw);
  if(!g||!W||!H){reset();return;}
  g.w=clamp(g.w,Math.min(300,W-16),W-16);g.h=clamp(g.h,Math.min(260,H-16),H-16);
  g.x=clamp(g.x,8,W-g.w-8);g.y=clamp(g.y,8,H-g.h-8);
  g={x:Math.round(g.x),y:Math.round(g.y),w:Math.round(g.w),h:Math.round(g.h)}; // recadrée pour l'affichage seulement : S.qzw garde le choix
  Object.assign(st,{left:g.x+'px',top:g.y+'px',width:g.w+'px',height:g.h+'px',right:'auto',bottom:'auto',maxHeight:'none'});
  st.setProperty('--qz',(clamp(g.w/QZ_W0,1,1.8)*fs).toFixed(3));   /* × taille choisie (A− / A+) */
  el.classList.add('cty-qzwin');
}
function qzToggleBig(){S.qzBig=!S.qzBig;renderPanel();qzApply();save();}
// Taille du texte du Défi du maire (13 nov. 2026) : de 50 % à 160 %, en plus de l'agrandissement lié à la fenêtre
function qzFont(d){S.qzFs=d===0?1:clamp(Math.round(((S.qzFs||1)+d)*10)/10,.5,1.6);renderPanel();qzApply();save();}
function qzBind(el){
  el.addEventListener('pointerdown',e=>{
    if(PANEL!=='quiz'||e.button>0)return;
    const rs=e.target.closest('.cty-qz-rs'),hd=!rs&&e.target.closest('.cty-ph');
    if(!rs&&(!hd||e.target.closest('button')))return;
    e.preventDefault();
    // offset* (et non getBoundingClientRect) : pas faussé par l'animation d'ouverture du panneau
    const id=e.pointerId,sx=e.clientX,sy=e.clientY,wasBig=!!S.qzBig;
    const g0={x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight};let moved=false;
    try{el.setPointerCapture(id);}catch(_){}
    el.classList.add(rs?'resizing':'dragging');
    const mv=ev=>{if(ev.pointerId!==id)return;const dx=ev.clientX-sx,dy=ev.clientY-sy;
      if(!moved&&Math.abs(dx)+Math.abs(dy)<3)return;moved=true;
      S.qzBig=false;S.qzw=rs?{x:g0.x,y:g0.y,w:g0.w+dx,h:g0.h+dy}:{x:g0.x+dx,y:g0.y+dy,w:g0.w,h:g0.h};qzApply();};
    const up=ev=>{if(ev.pointerId!==id)return;
      el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);
      try{el.releasePointerCapture(id);}catch(_){}el.classList.remove('dragging','resizing');
      if(moved){S.qzw={x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight};if(wasBig)renderPanel();save();}};
    el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  });
  el.addEventListener('dblclick',e=>{if(PANEL==='quiz'&&e.target.closest('.cty-ph')&&!e.target.closest('button'))qzToggleBig();});
}
function head(icon,title,sub,col,extra){
  const x=`<button class="cty-px" data-act="close" aria-label="Fermer"><span class="ms">close</span></button>`;
  return `<div class="cty-ph"><div class="cty-pt"><span class="cty-pic"${col?` style="background:${col};color:#fff"`:''}><span class="ms">${icon}</span></span><div><b>${title}</b>${sub?`<small>${sub}</small>`:''}</div></div>${extra?`<div class="cty-pxs">${extra}${x}</div>`:x}</div>`;
}
function rows(list){return `<div class="cty-rows">${list.map(([ic,k,v,cl])=>`<div class="cty-row${cl?' '+cl:''}"><span class="ms">${ic}</span><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;}
function chips(i){
  const L=[['health','Santé'],['edu','École'],['police','Police'],['fire','Pompiers'],['park','Loisirs']];
  return `<div class="cty-chips">${L.map(([k,n])=>`<span class="${COV[k][i]?'on':''}"><span class="ms">${COV[k][i]?'check':'close'}</span>${n}</span>`).join('')}</div>`;
}
function panelInspect(){
  if(!SEL)return head('info','Rien de sélectionné');
  const i=SEL.z*N+SEL.x,x=SEL.x,z=SEL.z;
  const xi=extInspectTile(i);if(xi)return xi;
  if(svcAt[i]){
    const s=SV.get(svcAt[i]),b=BT[s.t],ok=svcOK.get(s.id),R=[];
    if(b.power)R.push(['bolt','Électricité produite',s.t==='solar'?(E&&E.night>.5?'0 MW la nuit · les batteries prennent le relais':b.power+' MW au soleil'):s.t==='wind'?Math.round(b.power*Math.min(1.5,windK()))+' MW selon le vent':b.power+' MW']);
    if(b.water)R.push(['water_drop','Eau produite',b.water+' m³']);
    if(b.cov)Object.entries(b.cov).forEach(([k,r])=>R.push(['radar',COV_NAMES[k],`rayon ${r} cases`]));
    if(b.pol)R.push(['cloud','Pollution',`rayon ${b.pol.r} cases`,'bad']);
    R.push(['payments','Entretien',money(b.upkeep)+' / mois']);
    R.push([ok?'check_circle':'error','Accès routier',ok?'Relié à l’autoroute':'Non relié : il ne fonctionne pas',ok?'':'bad']);
    return head(b.icon,esc(b.name),esc(b.desc))+rows(R)+extInspectSvc(s)+`<button class="cty-btn danger" data-act="demolish"><span class="ms">delete</span>Démolir · +${money(svcRefund(s))} remboursés</button>`;
  }
  if(road[i])return head('add_road',road[i]===2?'Autoroute':ter[i]?'Pont':'Route',road[i]===2?'Elle relie ta ville au reste du monde.':'')+
    rows([[conn[i]?'check_circle':'error','Connexion',conn[i]?'Reliée à l’autoroute':'Coupée : rien ne pousse autour',conn[i]?'':'bad']])+extInspectRoad(i);
  if(ter[i])return head('water','Rivière','La vue sur l’eau fait grimper la valeur foncière. Un pont coûte 50 § par case.');
  if(zone[i]){
    const Z=ZONES[zone[i]],l=lvl[i],s=st[i];
    if(!l){
      let why;
      if(!inAreaI(i))why='Hors du terrain constructible : il s’agrandit aux prochains paliers.';
      else if(rdist[i]>2)why='Trop loin d’une route reliée à l’autoroute (2 cases maximum).';
      else if(zone[i]===ZO&&S.ms<3)why=`Les bureaux arrivent au palier « ${MS[3].name} ».`;
      else if(SPARE.p<3)why='Pas assez d’électricité pour un nouveau bâtiment : construis une éolienne ou une centrale.';
      else if(SPARE.w<3)why='Pas assez d’eau pour un nouveau bâtiment : construis un château d’eau.';
      else if(S.dem[zone[i]]<=.03)why=`Pas assez de demande pour l’instant (barre ${Z.short} en haut).`;
      else why='Un bâtiment va bientôt sortir de terre…';
      return head(Z.icon,'Terrain '+Z.name.toLowerCase(),'Libre',Z.col)+`<p class="cty-p">${esc(why)}</p>`;
    }
    const nm=LOT_NAMES[zone[i]][Math.min(l,4)-1];
    const stat=s===BUILD?'En construction':s===ABAND?'Abandonné':s===FIRE?'En feu !':s===RUIN?'En ruines':'Niveau '+l;
    const R=[];
    const capTxt=s===BUILD?'bientôt '+fmt(lotSpec(zone[i],l,vari[i]).cap):fmt(cap[i]);
    R.push([zone[i]===ZR?'groups':'work',zone[i]===ZR?'Habitants':'Emplois',capTxt]);
    if(s===OK||s===FIRE){
      R.push(['bolt','Électricité',pw[i]?'Oui':'Non',pw[i]?'':'bad']);
      R.push(['water_drop','Eau',wt[i]?'Oui':'Non',wt[i]?'':'bad']);
    }
    R.push(['diamond','Valeur foncière',lval[i]+' / 100']);
    if(zone[i]===ZR&&s===OK)R.push(['mood','Bonheur',hap[i]+' %',hap[i]<35?'bad':'']);
    R.push(['cloud','Pollution',pol[i]<10?'Faible':pol[i]<40?'Moyenne':'Forte',pol[i]>=40?'bad':'']);
    let note='';
    if(s===ABAND)note='Les occupants sont partis : vérifie l’électricité, l’eau, l’accès routier, la pollution et la demande. Le terrain se libérera bientôt.';
    else if(s===FIRE)note=COV.fire[i]?'Les pompiers sont en route.':'Aucune caserne ne couvre ce quartier : le bâtiment risque de brûler entièrement.';
    else if(s===OK)note=levelHint(i);
    return head(Z.icon,esc(nm),esc(Z.name+' · '+stat),Z.col)+extInspectLotTop(i)+rows(R)+chips(i)+(note?`<p class="cty-p">${esc(note)}</p>`:'')+extInspectLot(i);
  }
  if(tree[i])return head('forest','Forêt','Les arbres filtrent un peu la pollution. Construire dessus les abat.');
  return head('grass','Terrain libre',inArea(x,z)?'Trace une route puis crée des zones le long.':'Hors du terrain constructible : il s’agrandit avec les paliers.');
}
function demolishSel(){
  if(!SEL)return;const id=svcAt[SEL.z*N+SEL.x];if(!id)return;
  actBegin();const s=removeSvc(id);let back=0;
  if(s){back=svcRefund(s);ACT.del.push({id:s.id,t:s.t,x:s.x,z:s.z,rot:s.rot});}
  S.money+=back;actEnd(-back,'démolition');
  simRefresh();afterAction();closePanel();floatMoney(back);
}
function spark(){
  const h=S.hist.slice(-24);if(h.length<2)return '';
  const v=h.map(a=>a[1]),mn=Math.min(...v,0),mx=Math.max(...v,1),W=260,H=46;
  const pts=v.map((y,k)=>`${(k/(v.length-1)*W).toFixed(1)},${(H-(y-mn)/(mx-mn||1)*H).toFixed(1)}`).join(' ');
  const z=mn<0?(H-(0-mn)/(mx-mn||1)*H).toFixed(1):null;
  return `<svg class="cty-spark" viewBox="-2 -2 ${W+4} ${H+4}" preserveAspectRatio="none">${z?`<line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="#e04f4f" stroke-dasharray="3 3" stroke-width="1"/>`:''}<polyline points="${pts}" fill="none" stroke="#0e8c87" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}
function panelBudget(){
  const L=S.last,inc=L?L.inc:{r:0,c:0,i:0,o:0},up=L?L.up:{},t=S.tax;
  const catN={energie:'Réseaux',services:'Services',parcs:'Parcs',monuments:'Monuments',transports:'Transports',loisirs:'Loisirs'};
  const line=(k,v,neg)=>`<div class="cty-bl"><span>${k}</span><b class="${neg?'neg':''}">${neg?'−':'+'}${money(Math.abs(v))}</b></div>`;
  const tax=(k,z)=>`<label class="cty-tax"><span class="cty-tax-n" style="--c:${ZONES[z].col}">${ZONES[z].name}</span><input type="range" min="0" max="25" step="1" value="${t[k]}" data-tax="${k}"${z===4&&S.ms<3?' disabled':''}><b id="cty-tax-${k}">${t[k]} %</b></label>`;
  return head('account_balance','Budget',`Solde : ${money(S.money)}`)
    +`<div class="cty-study"><div><b>Révise pour financer ta ville</b><small>Chaque XP gagnée sur Kiné+ rapporte ${XP_MONEY} § · déjà reçu : ${money(S.grants||0)}</small></div><button class="cty-btn" data-act="study"><span class="ms">bolt</span>Flash 10 questions</button></div>`
    +`<div class="cty-sec">Le mois dernier</div>`
    +(L?`<div class="cty-blist">${line('Impôts habitants',inc.r)}${line('Impôts commerces',inc.c)}${line('Impôts industrie',inc.i)}${S.ms>=3?line('Impôts bureaux',inc.o):''}${inc.t?line('Tourisme',inc.t):''}${inc.x?line('Commerce avec les villes voisines',inc.x):''}
      ${Object.entries(up).map(([k,v])=>line('Entretien '+(catN[k]||k).toLowerCase(),v,true)).join('')}${line('Entretien des routes',L.rd,true)}${L.pc?line('Arrêtés municipaux',L.pc,true):''}
      <div class="cty-bl tot"><span>Bilan</span><b class="${L.net<0?'neg':''}">${L.net<0?'−':'+'}${money(Math.abs(L.net))}</b></div></div>`
      :`<p class="cty-p">Le premier bilan arrive à la fin du mois.</p>`)
    +spark()+`<button class="cty-btn ghost" data-act="panel" data-p="trade"><span class="ms">local_shipping</span>Commerce avec les villes voisines</button>`
    +`<div class="cty-sec">Impôts</div><p class="cty-p small">Plus d’impôts = plus d’argent, mais moins de demande et des habitants moins heureux. 9 % est un bon équilibre.</p>`
    +tax('r',1)+tax('c',2)+tax('i',3)+tax('o',4);
}
function panelGoals(){
  const L=gamLvl();
  const ms=MS.map((m,k)=>{
    const done=k<=S.ms,cur=k===S.ms+1,unl=BLD.filter(b=>b.ms===k&&k>0).map(b=>b.name);
    if(MS_EXTRA[k])unl.push(MS_EXTRA[k]);if(k&&m.area>MS[k-1].area)unl.push(`terrain ${m.area} × ${m.area}`);
    return `<div class="cty-goal${done?' done':''}${cur?' cur':''}"><span class="ms">${done?'check_circle':cur?'flag':'lock'}</span><div><b>${m.name}</b><small>${fmt(m.pop)} habitants${m.reward?` · prime ${money(m.reward)}`:''}</small>${unl.length?`<small class="u">${esc(unl.join(' · '))}</small>`:''}</div></div>`;
  }).join('');
  const mons=BLD.filter(b=>b.lvl).map(b=>{const built=svcCount(b.id)>0,ok=L>=b.lvl;
    return `<div class="cty-goal${built?' done':ok?' cur':''}"><span class="ms">${built?'check_circle':ok?'lock_open':'lock'}</span><div><b>${esc(b.name)}</b><small>Niveau Kiné+ ${b.lvl} · ${money(b.cost)}${built?' · construit':ok?' · disponible':''}</small></div></div>`;}).join('');
  return head('flag','Paliers & monuments',`${fmt(ST.pop)} habitants · niveau Kiné+ ${L}`)
    +`<div class="cty-sec">Paliers de population</div>${ms}<div class="cty-sec">Monuments Kiné+</div><p class="cty-p small">Ils se débloquent avec ton niveau d’XP : révise pour les obtenir.</p>${mons}`;
}
function panelViews(){
  const lg=VIEW?(VIEW_LEGEND[VIEW]||VIEW_LEGEND.def):'Choisis une vue pour repérer les problèmes de ta ville.';
  return head('layers','Vues d’information',esc(lg))+`<div class="cty-views">${VIEWS.map(([id,n,ic])=>`<button class="cty-view${VIEW===id?' active':''}" data-act="view" data-v="${id||''}"><span class="ms">${ic}</span>${n}</button>`).join('')}</div>`;
}
function setView(v){
  VIEW=v||null;redrawAllGround();for(let ci=0;ci<NCH*NCH;ci++)E.bDirty.add(ci);
  if(PANEL==='views')renderPanel();
}
function panelSettings(){
  const sw=(k,n,d)=>`<button class="cty-sw${S.set[k]?' on':''}" data-act="set" data-k="${k}"><span><b>${n}</b><small>${d}</small></span><i></i></button>`;
  return head('settings','Réglages','')
    +`<div class="cty-sec">Nom de la ville</div><div class="cty-rename"><input id="cty-rename" maxlength="24" value="${esc(S.name)}" aria-label="Nom de la ville"><button class="cty-btn" data-act="rename">OK</button></div>`
    +`<div class="cty-sec">Affichage</div>`+sw('dn','Cycle jour / nuit','Les fenêtres s’allument la nuit.')+sw('sh','Ombres','Plus joli, mais plus gourmand sur téléphone.')+sw('gfx','Halo des lumières la nuit','Les fenêtres et les lampadaires brillent doucement. À couper si le jeu rame.')+(KM_SRC?sw('km','Maisons et immeubles détaillés (essai)','Vrais modèles 3D gratuits (Kenney). Plus beau, un peu plus gourmand.'):'')+sw('acc','Accidents de la route','De temps en temps, un accrochage à un carrefour chargé : dépanneuse et ambulance arrivent.')+sw('sn','Saisons','La neige tombe en hiver.')+sw('wx','Météo','Pluie, orage, brouillard et arc-en-ciel.')+sw('lbl','Noms des quartiers','Affichés au-dessus de la ville.')+`<div class="cty-sec">Heure du ciel</div>`+skyChips()
    +panelUiColor(sw)
    +panelV4Settings(sw)
    +`<div class="cty-sec">Son</div>`+sw('snd','Sons d’ambiance','Oiseaux le jour, grillons la nuit, bruit de la ville quand on zoome.')+(S.set.snd?sw('amb','Sons selon l’endroit','Vagues près de l’eau, circulation en ville, oiseaux dans les parcs, cris de la récré, chantiers, vent en montagne.'):'')+sw('mus','Musique','Une musique calme pendant que tu joues : choisis son style.')+(S.set.mus?musChoice():'')
    +`<label class="cty-tax"><span class="cty-tax-n" style="--c:#0e8c87">Volume</span><input type="range" min="0" max="100" step="5" value="${Math.round((S.set.vol??.6)*100)}" data-vol="1"><b id="cty-vol">${Math.round((S.set.vol??.6)*100)} %</b></label>`
    +`<div class="cty-sec">Catastrophes</div>`+sw('cat','Catastrophes naturelles','Tornades et inondations, de temps en temps. Rien n’est perdu : les bâtiments se reconstruisent gratuitement.')
    +`<button class="cty-btn" data-act="photo-on"><span class="ms">photo_camera</span>Mode photo</button>`
    +`<div class="cty-sec">Statistiques</div>`+rows([['calendar_month','Fondée',new Date(S.created).toLocaleDateString('fr-FR')],['schedule','Jours écoulés',fmt(S.day)],['school','Reçu grâce aux révisions',money(S.grants||0)],['local_fire_department','Incendies',fmt(S.fires||0)]])
    +`<div class="cty-sec">Recommencer à zéro</div><p class="cty-p small">Démolit toutes les routes, zones et bâtiments et te rend <b>tout</b> ce que tu as payé (${money(cityValue().v)}). Ton argent, ton palier et tes défis sont gardés.</p><button class="cty-btn danger" data-act="raze"><span class="ms">restart_alt</span>Tout raser et récupérer l’argent</button>`;
}
function panelHelp(){
  const first=!S.helped;
  return head(first?'waving_hand':'help',first?`Bienvenue, maire de ${esc(S.name)} !`:'Comment jouer','')
    +`<ol class="cty-help">
      <li><b>Routes</b> : pars du bout de l’autoroute (à gauche) et trace des rues. Tout doit y être relié.</li>
      <li><b>Zones</b> : peins du résidentiel (vert), des commerces (bleu) et de l’industrie (jaune) le long des routes. Les bâtiments poussent tout seuls selon la demande (barres R C I B).</li>
      <li><b>Électricité et eau</b> : sans elles, les habitants finissent par partir.</li>
      <li><b>Services et parcs</b> : ils rendent les habitants heureux et font grimper la valeur foncière. Les maisons deviennent alors des immeubles, puis des tours.</li>
      <li><b>Budget</b> : les impôts rapportent chaque mois, l’entretien coûte. <b>Chaque XP gagnée en révisant rapporte ${XP_MONEY} §</b>. Démolir te rend tout ce que tu avais payé.</li>
      <li><b>Paliers</b> : plus de population = terrain agrandi et nouveaux bâtiments. Les monuments kiné se débloquent avec ton niveau.</li>
      <li><b>Défi du maire</b> : le bouton « Défi » te pose des QCM tirés de tes cours. Chaque bonne réponse rapporte une prime (et compte comme une vraie révision).</li>
      <li><b>Mairie</b> : elle débloque les arrêtés municipaux. Le conseil te demandera aussi parfois de trancher.</li>
      <li><b>Déchets</b> : à partir du palier Village, construis une décharge (menu Réseaux).</li>
      <li><b>${P_().side}</b> : ${P_().help}. La bonne réponse les soigne : bonheur et §. Ton métier (kiné, véto, médecin, dentiste) se change dans les Réglages.</li>
      <li><b>Paysage</b> : chaque ville a le sien (montagnes, mer, désert, lacs, île tropicale…). On ne construit pas sur le relief : Décor → Aplanir pour le raser.</li>
      <li><b>Rythme du temps et feux</b> : Réglages → Rythme du temps ralentit ou accélère tout (voitures, météo, jour et nuit). Les grands carrefours ont des feux : les voitures s’arrêtent au rouge.</li>
      <li><b>Réviser pour réparer</b> : un bâtiment marqué d’une clé à molette est lié à une question que tu as oubliée. Touche-le et réponds juste pour le remettre à neuf.</li>
      <li><b>Crise sanitaire</b> : si une épidémie se déclare, 5 bonnes réponses d’affilée au Défi du maire l’arrêtent.</li>
      <li><b>Festival des partiels</b> : quand un examen de ton agenda approche, les primes du Défi sont doublées sur ses matières.</li>
      <li><b>Transports</b> : rails et arrêts de tram, lignes de métro entre deux stations. Ils réduisent les bouchons (vue Circulation).</li>
      <li><b>Décor et Outils</b> : fleurs, bancs, fontaines, collines, lacs… le tampon pour copier un quartier, les quartiers nommés avec leurs règles, les ronds-points et les feux.</li>
      <li><b>Amis</b> : visite la ville de tes amis, classement, jumelage et duel du maire.</li>
    </ol>
    <div class="cty-sec">Commandes</div>
    <p class="cty-p small"><b>Souris</b> : glisser pour te déplacer, clic droit pour tourner, molette pour zoomer.<br><b>Tactile</b> : un doigt pour construire ou te déplacer, deux doigts pour zoomer et tourner.<br><b>Clavier</b> : flèches ou ZQSD, E/R pour tourner, espace pour la pause, Ctrl+Z pour annuler, Ctrl+S pour sauvegarder${FS_OK?', F pour le plein écran (Échap pour sortir)':''}. Chiffres 1 à 0 : les menus.</p>
    <button class="cty-btn ghost" data-act="panel" data-p="keys"><span class="ms">keyboard</span>Tous les raccourcis clavier (K)</button>`
    +(first?`<button class="cty-btn" data-act="close"><span class="ms">rocket_launch</span>C’est parti !</button>`:'');
}
let MS_SHOW=0;
function panelMilestone(){
  const k=MS_SHOW||S.ms,m=MS[k],unl=BLD.filter(b=>b.ms===k).map(b=>b.name);
  if(MS_EXTRA[k])unl.push(MS_EXTRA[k]);if(k&&m.area>MS[k-1].area)unl.push(`Terrain agrandi : ${m.area} × ${m.area} cases`);
  return head('celebration',`Palier atteint : ${m.name} !`,`${fmt(m.pop)} habitants`)
    +`<div class="cty-reward"><span class="ms">payments</span>Prime de la région : <b>+${money(m.reward)}</b></div>`
    +(unl.length?`<div class="cty-sec">Débloqué</div><ul class="cty-list">${unl.map(u=>`<li><span class="ms">lock_open</span>${esc(u)}</li>`).join('')}</ul>`:'')
    +`<button class="cty-btn" data-act="close">Continuer</button>`;
}
function onMilestone(k){
  if(E){rebuildGrid();redrawAllGround();}
  refreshTray();
  if(!ROOT)return;
  MS_SHOW=k;openPanel('ms');
  try{if(typeof gamConfetti==='function')gamConfetti();}catch(e){}
}
function toggleSetting(k){
  S.set[k]=!S.set[k];
  if(k==='gfx'&&S.set.gfx)setupFX();
  if(k==='tl')recomputeSignals();
  if(k==='km'){for(let ci=0;ci<NCH*NCH;ci++)E.bDirty.add(ci);const T=E.trees,g=treeCrown(kmOn());T.geo.rg.dispose();T.geo.rg=g;if(T.round)T.round.geometry=g;}   /* v7 */
  if(k==='sh'){
    E.renderer.shadowMap.enabled=!!S.set.sh;
    E.scene.traverse(o=>{if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true);}});
    for(let ci=0;ci<NCH*NCH;ci++)E.bDirty.add(ci);if(E.trees.trunk)[E.trees.trunk,E.trees.round,E.trees.con,E.trees.palm,E.trees.cactus].forEach(m=>{if(m)m.castShadow=!!S.set.sh;});
  }
  save();renderPanel();
}
function renameCity(){
  const el=$('cty-rename');if(!el)return;const v=el.value.trim().replace(/\s+/g,' ').slice(0,24);
  if(!v){toast('Donne un nom à ta ville.','edit');return;}
  S.name=v;drawSign();save();refreshHUD(true);toast(`Ta ville s’appelle désormais <b>${esc(v)}</b>.`,'edit');
}
// Tout raser (remplace l'ancien « Recommencer une nouvelle ville », qui remettait l'argent à 20 000 §) :
// démolit routes, zones et bâtiments et rend 100 % de ce qui a été payé. Terrain, arbres, autoroute,
// argent, palier (terrain agrandi, bâtiments débloqués), défis et tutoriel sont gardés : les primes de
// palier / défi ne peuvent donc pas être regagnées en boucle. Annulable (Ctrl+Z) si l'argent est encore là.
function razeCity(el){
  const {v,n}=cityValue();
  if(!n){toast('Il n’y a rien à raser : ta ville est déjà vide.','info');return;}
  if(el.dataset.armed!=='1'){el.dataset.armed='1';el.innerHTML=`<span class="ms">warning</span>Confirmer : tout raser (+${money(v)})`;return;}
  if(S.set.asv!==false)slotWrite('Avant « Tout raser »',{auto:'avant'});
  actBegin();ACT.pol=Object.assign({},S.pol);
  for(let i=0;i<NN;i++)if(road[i]===1||road[i]===3||zone[i]||lvl[i]){rec(i);if(road[i]!==2){road[i]=0;lane[i]=0;}zone[i]=0;lvl[i]=0;st[i]=0;tmr[i]=0;cap[i]=0;}
  for(const s of [...SV.values()]){removeSvc(s.id);ACT.del.push({id:s.id,t:s.t,x:s.x,z:s.z,rot:s.rot});}
  S.pol={}; // plus de mairie : les arrêtés tombent (rétablis si on annule)
  S.money+=v;actEnd(-v,'tout raser');
  hideSelection();closePanel();
  Object.keys(D).forEach(k=>D[k]=true);simRefresh();fullRebuild();
  afterAction();save();floatMoney(v);
  toast(`<b>Ville rasée</b> : +${money(v)} récupérés. Ton palier et tes défis sont gardés (Ctrl+Z pour annuler).`,'savings');
}
// ── Défi du maire : QCM tirés des cours de l'étudiant ──
const QZ_CAP=15,QZ_BONUS=250;
// Bonus de série (ajout 10 nov. 2026, relevé le même jour) : dès 3 bonnes réponses d'affilée, +15 § par réponse
// de la série (max 300 §, atteint à 20), en plus de la prime et de l'XP, même primes épuisées. S.qzs = série en cours.
const QZ_STREAK_FROM=3,QZ_STREAK_STEP=15,QZ_STREAK_MAX=300;
function qzStreakBonus(n){return n>=QZ_STREAK_FROM?Math.min(QZ_STREAK_MAX,n*QZ_STREAK_STEP):0;}
// Pas de répétition (ajout 10 nov. 2026) : chaque question du choix (matière / thème) sort une fois par « tour ».
// S.qseen = {clé du choix "f|t": [id des questions répondues dans le tour en cours]} ; 12 choix retenus au plus.
function quizKey(){const F=quizFilter();return (F.f||'')+'|'+(F.t||'');}
function quizSeen(key){
  if(!S.qseen||typeof S.qseen!=='object'||Array.isArray(S.qseen))S.qseen={};
  let a=S.qseen[key];if(!Array.isArray(a))a=[];
  delete S.qseen[key];S.qseen[key]=a;                                  // dernier utilisé = en fin de liste
  const ks=Object.keys(S.qseen);while(ks.length>12)delete S.qseen[ks.shift()];
  return a;
}
let QZ=null;
// Revenir en arrière (ajout 10 nov. 2026) : QZH = questions déjà répondues (30 dernières, en mémoire), revues
// en lecture seule (pas de nouvelle réponse : la prime et la série ne peuvent pas être rejouées). QZV = index revu
// dans QZH (null = question en cours, dont le chrono est mis en pause pendant qu'on regarde l'historique).
let QZH=[],QZV=null;
function qzPushHist(){if(QZ&&QZ.q&&QZ.ans!=null&&QZH[QZH.length-1]!==QZ){QZH.push(QZ);if(QZH.length>30)QZH.shift();}}
function qzView(v){
  if(QZV==null&&v!=null&&QZ&&QZ.q&&QZ.ans==null)QZ.pause=performance.now();
  if(v==null&&QZ&&QZ.pause){QZ.t0+=performance.now()-QZ.pause;QZ.pause=0;}
  QZV=v;renderPanel();const sc=$('cty-panel')&&$('cty-panel').querySelector('.cty-qz-scroll');if(sc)sc.scrollTop=0;
}
function quizToday(){const d=new Date().toDateString();if(!S.quiz||S.quiz.d!==d)S.quiz={d,n:0};return S.quiz;}
// Questions utilisables (4 réponses valides, pas boycottées, pas dans une matière archivée)
function courseMap(){return new Map((typeof courses!=='undefined'&&Array.isArray(courses)?courses:[]).map(c=>[String(c.id),c]));}
function quizBase(cmap){
  if(typeof questions==='undefined'||!Array.isArray(questions))return[];
  const arch=typeof archivedFolders!=='undefined'&&archivedFolders?archivedFolders:{};
  cmap=cmap||courseMap();
  return questions.filter(q=>{
    if(!q||!q.question||!Array.isArray(q.answers)||q.answers.length<2)return false;
    const c=q.correct|0;if(c<0||c>=q.answers.length||!String(q.answers[c]||'').trim())return false;
    if(typeof isBoycotted==='function'&&isBoycotted(q.id))return false;
    const co=cmap.get(String(q.courseId));return !(co&&arch[co.folderId]);
  });
}
// Choix de la matière / du thème : S.qf = {f: id de matière, t: '' | 'sf:<sous-dossier>' | 'c:<cours>'}
function quizFilter(){if(!S.qf||typeof S.qf!=='object')S.qf={f:'',t:''};return S.qf;}
function quizMatch(q,cmap,F){
  if(!F.f)return true;
  const co=cmap.get(String(q.courseId));if(!co||String(co.folderId)!==F.f)return false;
  if(!F.t)return true;
  if(F.t.startsWith('sf:'))return String(co.subFolderId)===F.t.slice(3);
  if(F.t.startsWith('c:'))return String(co.id)===F.t.slice(2);
  return true;
}
function quizNext(){
  const cmap=courseMap(),base=quizBase(cmap);if(!base.length){QZ={empty:true,none:true};return;}
  const F=quizFilter();
  if(F.t&&!base.some(q=>quizMatch(q,cmap,F)))F.t='';          // thème disparu : on revient à toute la matière
  if(F.f&&!base.some(q=>quizMatch(q,cmap,F))){F.f='';F.t='';}  // matière disparue : toutes les matières
  const pool=base.filter(q=>quizMatch(q,cmap,F));if(!pool.length){QZ={empty:true};return;}
  const key=quizKey(),prev=QZ&&QZ.q?String(QZ.q.id):null;let seen=new Set(quizSeen(key)),round=false;
  // seulement les questions pas encore faites dans ce tour ; tout est fait → nouveau tour
  let cand=pool.filter(q=>!seen.has(String(q.id)));
  if(!cand.length){round=seen.size>0;S.qseen[key]=[];seen=new Set();cand=pool.slice();}
  if(cand.length>1&&prev)cand=cand.filter(q=>String(q.id)!==prev);   // jamais deux fois de suite
  // tirage pondéré : les plus difficiles sortent en premier dans le tour
  const W={hard:3,medium:2,new:1.6,easy:1,acquired:.6};
  let tot=0;const ws=cand.map(q=>{const w=W[typeof getDiff==='function'?getDiff(q.id):'new']||1;tot+=w;return w;});
  let r=Math.random()*tot,k=0;while(k<cand.length-1&&r>=ws[k]){r-=ws[k];k++;}
  const q=cand[k],order=q.answers.map((_,j)=>j).filter(j=>String(q.answers[j]||'').trim()).sort(()=>Math.random()-.5);
  QZ={q,order,t0:performance.now(),ans:null,n:pool.length,round};
}
function quizFilterBar(){
  const cmap=courseMap(),base=quizBase(cmap);if(!base.length)return '';
  const F=quizFilter(),cnt=new Map(),inc=k=>cnt.set(k,(cnt.get(k)||0)+1);
  for(const q of base){const co=cmap.get(String(q.courseId));if(!co)continue;inc('f:'+co.folderId);if(co.subFolderId)inc('sf:'+co.subFolderId);inc('c:'+co.id);}
  const fl=(typeof folders!=='undefined'&&Array.isArray(folders)?folders:[]).filter(f=>cnt.get('f:'+f.id));
  const fOpts=`<option value="">Toutes les matières · ${base.length}</option>`+fl.map(f=>`<option value="${esc(String(f.id))}"${String(f.id)===F.f?' selected':''}>${esc(f.name||'Matière')}${f.type==='annales'?' (annales)':''} · ${cnt.get('f:'+f.id)}</option>`).join('');
  let tOpts='';
  if(F.f){
    const cs=(typeof courses!=='undefined'&&Array.isArray(courses)?courses:[]).filter(c=>String(c.folderId)===F.f&&cnt.get('c:'+c.id));
    const sfs=(typeof subFolders!=='undefined'&&Array.isArray(subFolders)?subFolders:[]).filter(sf=>String(sf.folderId)===F.f&&cnt.get('sf:'+sf.id));
    const co=c=>`<option value="c:${esc(String(c.id))}"${F.t==='c:'+c.id?' selected':''}>${esc(c.name||'Cours')} · ${cnt.get('c:'+c.id)}</option>`;
    tOpts=`<option value="">Tous les thèmes</option>`;
    sfs.forEach(sf=>{tOpts+=`<optgroup label="${esc(sf.name||'Dossier')}"><option value="sf:${esc(String(sf.id))}"${F.t==='sf:'+sf.id?' selected':''}>Tout « ${esc(sf.name||'Dossier')} » · ${cnt.get('sf:'+sf.id)}</option>${cs.filter(c=>String(c.subFolderId)===String(sf.id)).map(co).join('')}</optgroup>`;});
    const direct=cs.filter(c=>!c.subFolderId||!sfs.some(sf=>String(sf.id)===String(c.subFolderId)));
    if(direct.length)tOpts+=sfs.length?`<optgroup label="Cours">${direct.map(co).join('')}</optgroup>`:direct.map(co).join('');
  }else tOpts='<option value="">Choisis d’abord une matière</option>';
  const pool=base.filter(q=>quizMatch(q,cmap,F)),n=pool.length;
  const sa=S.qseen&&Array.isArray(S.qseen[quizKey()])?new Set(S.qseen[quizKey()]):new Set(),done=pool.filter(q=>sa.has(String(q.id))).length;
  return `<div class="cty-qf"><label class="cty-qf-l"><span>Matière</span><select data-qf="f" aria-label="Matière">${fOpts}</select></label>`
    +`<label class="cty-qf-l"><span>Thème</span><select data-qf="t" aria-label="Thème"${F.f?'':' disabled'}>${tOpts}</select></label>`
    +`<small>${fmt(n)} question${n>1?'s':''} dans ce choix · ${fmt(done)} / ${fmt(n)} déjà faite${done>1?'s':''} dans ce tour : aucune ne revient avant la fin</small></div>`;
}
function quizAnswer(j){
  if(!QZ||!QZ.q||QZ.ans!=null)return;
  const q=QZ.q,ok=j===(q.correct|0),secs=Math.max(1,Math.round((performance.now()-QZ.t0)/1000)),t=quizToday();
  QZ.ans=j;QZ.ok=ok;QZ.bonus=0;QZ.sb=0;QZ.lost=0;
  {const a=quizSeen(quizKey()),id=String(q.id);if(!a.includes(id))a.push(id);}   // faite : ne revient pas avant la fin du tour
  const fm=festMul(q);QZ.fest=fm>1;
  if(ok){
    S.quizTot=(S.quizTot||0)+1;if(t.n<QZ_CAP){t.n++;S.money+=QZ_BONUS*fm;QZ.bonus=QZ_BONUS*fm;}
    const best0=S.qzBest|0;S.qzs=(S.qzs|0)+1;S.qzBest=Math.max(S.qzBest|0,S.qzs);
    if(S.qzs>best0&&S.qzs>=5&&S.qzs%5===0)fireworks(4,'Record de série : '+S.qzs+' !');
    const sb=qzStreakBonus(S.qzs)*fm;if(sb){S.money+=sb;QZ.sb=sb;}
    if(QZ.bonus+QZ.sb)floatMoney(QZ.bonus+QZ.sb);
  }else{QZ.lost=S.qzs|0;S.qzs=0;}
  QZ.st=S.qzs|0;   // série au moment de la réponse (affichée quand on revient sur la question)
  extQuizAnswer(q,ok);
  _quietGrant=true;
  try{if(typeof recordAnswer==='function'){recordAnswer(q.id,ok,secs);if(typeof saveAll==='function')saveAll();}}catch(e){console.warn('[city] recordAnswer',e);}
  syncGrants();_quietGrant=false;
  checkTuto();save();renderPanel();refreshHUD(true);
  // la correction apparaît sous les réponses : on la fait entrer dans la fenêtre si elle est cachée
  const sc=$('cty-panel')&&$('cty-panel').querySelector('.cty-qz-scroll'),fb=sc&&sc.querySelector('.cty-qfb');
  if(fb){const d=fb.getBoundingClientRect().top-(sc.getBoundingClientRect().bottom-120);if(d>0)sc.scrollTop+=d;}
}
function panelQuiz(){
  if(!QZ||(!QZ.q&&!QZ.empty))quizNext();
  const left=Math.max(0,QZ_CAP-quizToday().n);
  const big=!!S.qzBig,bt=big?'Réduire la fenêtre':'Agrandir la fenêtre';
  // Fenêtre déplaçable (glisser l'en-tête) et redimensionnable (coin en bas à droite) : voir qzApply / qzBind
  const fsP=Math.round((S.qzFs||1)*100);
  const win=`<span class="cty-qz-fs" role="group" aria-label="Taille du texte"><button class="cty-px" data-act="qzfs" data-d="-0.1" title="Texte plus petit"${fsP<=50?' disabled':''}><span class="ms">text_decrease</span></button><button class="cty-qz-pct" data-act="qzfs" data-d="0" title="Revenir à 100 %">${fsP}%</button><button class="cty-px" data-act="qzfs" data-d="0.1" title="Texte plus grand"${fsP>=160?' disabled':''}><span class="ms">text_increase</span></button></span>`
    +`<span class="ms cty-qz-grip" title="Glisse ici pour déplacer la fenêtre">drag_indicator</span>`
    +`<button class="cty-px" data-act="qzbig" title="${bt}" aria-label="${bt}"><span class="ms">${big?'close_fullscreen':'open_in_full'}</span></button>`;
  const h=head('quiz','Défi du maire',left?`Bonne réponse : +${money(QZ_BONUS)} de prime, en plus de l’XP · encore ${left} prime${left>1?'s':''} aujourd’hui`:'Primes du jour épuisées : chaque réponse rapporte encore de l’XP (et donc des §)','#0e8c87',win);
  const wrap=b=>`${h}<div class="cty-qz-scroll">${b}</div><div class="cty-qz-rs" title="Glisse pour agrandir ou réduire la fenêtre"></div>`;
  const bar=quizFilterBar();
  if(QZ.empty)return wrap(bar+`<p class="cty-p">${QZ.none?'Le conseil municipal n’a trouvé aucun QCM dans tes matières. Importe quelques questions dans Kiné+ pour relever le défi !':'Aucune question disponible dans ce choix : sélectionne une autre matière ou un autre thème.'}</p>`);
  if(QZV!=null&&QZH[QZV]){   // revoir une question déjà faite (lecture seule)
    const k=QZH.length-QZV;
    const nav=`<div class="cty-qnav"><button data-act="qprev"${QZV>0?'':' disabled'} title="Question d’avant" aria-label="Question d’avant"><span class="ms">arrow_back</span></button>`
      +`<span>Question déjà faite · ${k===1?'la précédente':`il y a ${k} questions`}</span>`
      +`<button data-act="qfwd" title="Question d’après" aria-label="Question d’après"><span class="ms">arrow_forward</span></button></div>`;
    return wrap(bar+nav+qzCardHTML(QZH[QZV])+`<button class="cty-btn" data-act="qback"><span class="ms">keyboard_return</span>Revenir à la question en cours</button>`);
  }
  const n=S.qzs|0,next=qzStreakBonus(n+1),need=QZ_STREAK_FROM-n;
  const streak=`<div class="cty-qstreak${n>=QZ_STREAK_FROM?' hot':''}"><span class="ms">local_fire_department</span><span>${n?`Série : <b>${n}</b> · `:''}`
    +(next?`prochaine bonne réponse : <b>+${money(next)}</b> de bonus`:`encore ${need} bonne${need>1?'s':''} réponse${need>1?'s':''} d’affilée pour le bonus de série`)+`</span></div>`;
  const back=QZH.length?`<button class="cty-qprev" data-act="qprev"><span class="ms">arrow_back</span>Question précédente</button>`:'';
  const nxt=QZ.ans!=null?`<button class="cty-btn" data-act="qnext"><span class="ms">arrow_forward</span>Question suivante</button>`:'';
  const round=QZ.round?`<div class="cty-qround"><span class="ms">autorenew</span><span>Tu as fait toutes les questions de ce choix : <b>nouveau tour !</b></span></div>`:'';
  return wrap(bar+quizExtBanner()+round+streak+back+qzCardHTML(QZ)+nxt);
}
// Question + réponses (+ correction une fois répondue) : question en cours ou déjà faite (historique)
function qzCardHTML(it){
  const q=it.q,co=courseMap().get(String(q.courseId)),L='ABCDEFGHIJ',done=it.ans!=null;
  const ans=it.order.map((j,k)=>{let cl='';if(done){if(j===(q.correct|0))cl=' ok';else if(j===it.ans)cl=' ko';}
    return `<button class="cty-qa${cl}" data-act="qa" data-j="${j}"${done?' disabled':''}><b>${L[k]||k+1}</b><span>${esc(q.answers[j])}</span></button>`;}).join('');
  let fb='';
  if(done){
    const gains=[];if(it.bonus)gains.push(`+${money(it.bonus)} de prime du maire${it.fest?' (×2 festival)':''}`);if(it.sb)gains.push(`+${money(it.sb)} de bonus de série (×${it.st|0})`);
    fb=`<div class="cty-qfb ${it.ok?'ok':'ko'}"><b>${it.ok?'Bonne réponse !':'Raté…'}</b> ${it.ok?(gains.length?gains.join(' · ')+'.':'Bravo !'):`${it.lost>=QZ_STREAK_FROM?`Série de ${it.lost} perdue. `:''}La bonne réponse : <b>${esc(q.answers[q.correct|0])}</b>`}${q.expl?`<small>${esc(q.expl)}</small>`:''}</div>`;
  }
  return `<div class="cty-qq">${co&&co.name?`<small>${esc(co.name)}</small>`:''}${esc(q.question)}</div><div class="cty-qas">${ans}</div>${fb}`;
}
// ── Arrêtés municipaux ──
function panelPolicies(){
  if(!svcCount('mairie'))return head('gavel','Arrêtés municipaux','Il faut d’abord une mairie (Services, palier Hameau).')
    +`<p class="cty-p">Avec une mairie, tu pourras voter des arrêtés : économies d’énergie, sport pour tous, zone 30, kiné remboursé…</p>`;
  let tot=0;
  const list=POLICIES.map(p=>{const on=PO(p.id),lock=p.ms&&S.ms<p.ms,c=Math.ceil(ST.pop*p.cost);if(on)tot+=c;
    return `<button class="cty-pol${on?' on':''}${lock?' locked':''}" data-act="pol" data-k="${p.id}"${lock?' disabled':''}><span class="ms">${p.icon}</span><span class="cty-pol-t"><b>${esc(p.name)}</b><small>${esc(p.desc)}</small><em>${lock?'Palier '+MS[p.ms].name:p.cost?money(c)+' / mois':'Gratuit'}</em></span><i></i></button>`;}).join('');
  return head('gavel','Arrêtés municipaux',`Coût actuel : ${money(tot)} / mois (selon la population)`)+list;
}
function togglePolicy(id){
  const p=POLICIES.find(x=>x.id===id);if(!p||!svcCount('mairie')||(p.ms&&S.ms<p.ms))return;
  S.pol[id]=!S.pol[id];D.util=D.pol=D.lv=true;simRefresh();renderPanel();refreshHUD(true);save();
  toast(`${S.pol[id]?'Arrêté voté':'Arrêté abrogé'} : <b>${esc(p.name)}</b>`,'gavel');
}
// ── Conseil municipal ──
function modLabel(k,v,d){
  const sg=v>0?'+':'−',a=Math.abs(v),pc=Math.round(a*100)+' %';
  const L={hap:`bonheur ${sg}${a}`,tour:`tourisme ${sg}${a}`,dem1:`demande R ${sg}${pc}`,dem2:`demande C ${sg}${pc}`,dem3:`demande I ${sg}${pc}`,dem4:`demande B ${sg}${pc}`,useW:`eau consommée ${sg}${pc}`,gar:`collecte des déchets ${sg}${pc}`,lv:`valeur foncière ${sg}${a}`}[k]||k;
  return `${L} pendant ${Math.max(1,Math.round(d/30))} mois`;
}
function panelEvent(){
  const e=S.event&&EVENTS.find(x=>x.id===S.event.id);
  if(!e)return head('gavel','Conseil municipal','Aucune décision en attente.');
  const opt=(k,o)=>{if(!o)return '';const c=evCost(o),fx=[];if(c)fx.push('−'+money(c));if(o.g)fx.push('+'+money(o.g));(o.m||[]).forEach(([mk,v,d])=>fx.push(modLabel(mk,v,d)));
    return `<button class="cty-choice" data-act="choose" data-k="${k}"><b>${esc(o.l)}</b>${fx.length?`<small>${esc(fx.join(' · '))}</small>`:''}</button>`;};
  return head(e.icon,esc(e.t),'Le conseil municipal attend ta décision','#1d2b22')+`<p class="cty-p">${esc(e.d)}</p>`+opt('a',e.a)+opt('b',e.b);
}
function renderEventBanner(){
  const el=$('cty-event');if(!el)return;
  const e=S.event&&EVENTS.find(x=>x.id===S.event.id);
  if(!e||PANEL){el.style.display='none';if(!e)el.innerHTML='';const b=$('cty');if(b)b.classList.remove('has-event');return;}
  el.style.display='';$('cty').classList.add('has-event');el.innerHTML=`<span class="ms">gavel</span><span>Le conseil attend ta décision : <b>${esc(e.t)}</b></span><button data-act="panel" data-p="event">Décider</button>`;
}
// ── Statistiques ──
function chartSVG(vals,col,f){
  if(vals.length<2)return '<p class="cty-p small">La courbe apparaîtra après quelques mois de jeu.</p>';
  const W=300,H=64,mn=Math.min(...vals),mx=Math.max(...vals),rg=mx-mn||1;
  const pts=vals.map((v,k)=>`${(k/(vals.length-1)*W).toFixed(1)},${(H-3-(v-mn)/rg*(H-8)).toFixed(1)}`).join(' ');
  return `<div class="cty-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polygon points="0,${H} ${pts} ${W},${H}" fill="${col}" opacity=".13"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><div class="cty-chart-l"><span>${f(mn)}</span><span>${f(mx)}</span></div></div>`;
}
function panelStats(){
  const h=S.hist,P=ST,jobs=P.jc+P.ji+P.jo;
  return head('monitoring','Statistiques',`${fmt(P.pop)} habitants · ${fmt(jobs)} emplois`)
    +`<button class="cty-btn ghost" data-act="panel" data-p="timelapse"><span class="ms">slow_motion_video</span>Timelapse : revoir l’évolution de la ville</button>`
    +`<button class="cty-btn" data-act="panel" data-p="curves"><span class="ms">show_chart</span>Courbes d’évolution en grand</button>`
    +`<div class="cty-sec">Population</div>`+chartSVG(h.map(a=>a[0]),'#0e8c87',fmt)
    +`<div class="cty-sec">Trésorerie</div>`+chartSVG(h.map(a=>a[1]),'#3b8fdc',v=>money(v))
    +`<div class="cty-sec">Bonheur</div>`+chartSVG(h.filter(a=>a[3]!=null).map(a=>a[3]),'#f08c3a',v=>Math.round(v)+' %')
    +`<div class="cty-sec">En ce moment</div>`+rows([
      ['work','Emplois (C · I · B)',`${fmt(P.jc)} · ${fmt(P.ji)} · ${fmt(P.jo)}`],
      ['person_off','Chômage',P.workers?Math.max(0,Math.round(P.unemp*100))+' %':'–'],
      ['bolt','Électricité',`${fmt(P.pu)} / ${fmt(P.pp)} MW`,P.pu>P.pp?'bad':''],
      ['water_drop','Eau',`${fmt(P.wu)} / ${fmt(P.wp)} m³`,P.wu>P.wp?'bad':''],
      ...(garbageOn()?[['delete','Déchets',`${fmt(P.gu)} / ${fmt(P.gp)} t`,P.gu>P.gp?'bad':'']]:[]),
      ['luggage','Tourisme',`${P.tour} points`],
      ['traffic','Rues embouteillées',`${P.jam|0} %`,(P.jam|0)>20?'bad':''],
      ['local_shipping','Commerce',S.tradeLast?money(S.tradeLast.tot)+' / mois':'–'],
      ['commute','Voitures en moins (transports, vélos)',`≈ ${fmt(carsSaved())}`],
      ['healing','Patients guéris',fmt(S.stat.patOk|0)],
      ['domain_disabled','Bâtiments abandonnés',fmt(P.aband),P.aband?'bad':''],
      ['quiz','Questions du maire réussies',fmt(S.quizTot||0)],['local_fire_department','Meilleure série au défi',fmt(S.qzBest||0)]]);
}
// ── Mode photo ──
function photoMode(on){const box=$('cty');if(!box)return;box.classList.toggle('photo',!!on);if(on){hideSelection();closePanel();toolCancel();TRAY=null;setTool('inspect');}}
function savePhoto(){
  try{
    const vis=[E.gF.visible,E.gI.visible];E.gF.visible=E.gI.visible=false;
    renderFrame(0);
    const url=E.renderer.domElement.toDataURL('image/png');
    E.gF.visible=vis[0];E.gI.visible=vis[1];
    const a=document.createElement('a');a.href=url;a.download=(S.name||'ma-ville').replace(/[\\/:*?"<>|]/g,'')+'.png';document.body.appendChild(a);a.click();a.remove();
    toast('Photo enregistrée dans tes téléchargements.','photo_camera');
  }catch(e){console.warn('[city] photo',e);toast('Impossible d’enregistrer la photo sur ce navigateur.','error');}
}
// ── Notifications ──
const TOASTS=new Map();let _tid=0;
function toast(html,icon,opt){
  const box=$('cty-toasts');if(!box)return;
  const id=++_tid,el=document.createElement('div');el.className='cty-toast';el.dataset.id=id;
  el.innerHTML=`<span class="ms">${icon||'info'}</span><span class="cty-toast-t">${html}</span>${opt&&opt.label?`<button data-act="toast" data-id="${id}">${esc(opt.label)}</button>`:''}`;
  box.appendChild(el);TOASTS.set(id,{el,fn:opt&&opt.fn});
  while(box.children.length>3){const f=box.firstChild;TOASTS.delete(+f.dataset.id);f.remove();}
  setTimeout(()=>dismissToast(id),opt&&opt.label?7000:4800);
}
function dismissToast(id){const t=TOASTS.get(id);if(!t)return;TOASTS.delete(id);t.el.classList.add('out');setTimeout(()=>t.el.remove(),260);}
function toastOnce(key,icon,text,gapDays,opt){
  if(!S||!ROOT)return false;const last=S.seen[key];
  if(gapDays&&last!=null&&S.day-last<gapDays)return false;
  S.seen[key]=S.day;toast(esc(text),icon,opt);return true;
}
let _tipT=null;
function tip(text,kind,ms){const el=$('cty-tip');if(!el)return;el.textContent=text;el.className='cty-tip show'+(kind?' '+kind:'');clearTimeout(_tipT);if(ms)_tipT=setTimeout(hideTip,ms);}
function hideTip(){const el=$('cty-tip');if(el)el.classList.remove('show');}
function floatMoney(v){
  const k=ROOT&&ROOT.querySelector('.cty-kpi-m');if(!k||!v)return;
  const f=document.createElement('div');f.className='cty-float'+(v<0?' neg':'');f.textContent=(v>0?'+':'−')+money(Math.abs(v));
  k.appendChild(f);setTimeout(()=>f.remove(),1300);
}
// ── Objectifs guidés ──
function playerRoads(){let n=0;for(let i=0;i<NN;i++)if(road[i]===1&&conn[i])n++;return n;}
const TUTO=[
  {t:'Trace une route reliée à l’autoroute',hint:'Routes, puis glisse depuis le bout de l’autoroute (à gauche du terrain).',ok:()=>playerRoads()>=4},
  {t:'Crée une zone résidentielle',hint:'Zones → Résidentiel, puis glisse le long de ta route.',ok:()=>ST.lots[1]+ST.free[1]>=6},
  {t:'Installe une éolienne',hint:'Les maisons ont besoin d’électricité pour pousser. Énergie & eau → Éolienne, contre une route.',ok:()=>ST.pp>0},
  {t:'Construis un château d’eau',hint:'Et d’eau ! Énergie & eau → Château d’eau. Les premières maisons vont alors sortir de terre.',ok:()=>ST.wp>0},
  {t:'Ajoute des commerces et de l’industrie',hint:'Tes habitants veulent travailler et faire leurs courses (barres C et I).',ok:()=>ST.lots[2]+ST.free[2]>=3&&ST.lots[3]+ST.free[3]>=3},
  {t:'Atteins 60 habitants',hint:'Le palier Hameau débloque l’école, la police et les pompiers.',ok:()=>S.ms>=1}
];
function checkTuto(){
  if(!S)return;if(S.tut>=TUTO.length){checkMissions();return;}
  let done=false;
  while(S.tut<TUTO.length&&TUTO[S.tut].ok()){S.money+=500;toast(`<b>Objectif atteint</b> : ${esc(TUTO[S.tut].t)} · +500 §`,'task_alt');S.tut++;done=true;}
  if(done&&S.tut>=TUTO.length)setTimeout(()=>toast(`<b>Bravo, ta ville est lancée !</b> Chaque XP gagnée en révisant lui rapporte ${XP_MONEY} §.`,'celebration'),1200);
  if(done){floatMoney(500);renderTuto();}
}
function renderTuto(){
  const el=$('cty-tuto');if(!el)return;
  if(S.tut>=TUTO.length){
    const k=S.mis|0;if(k>=MISSIONS.length){el.style.display='none';return;}
    const m=MISSIONS[k];el.style.display='';
    el.innerHTML=`<button class="cty-tuto-h" data-act="tuto"><span class="ms">military_tech</span><b>Défi ${k+1} / ${MISSIONS.length}</b><span class="ms">${S.tutMin?'expand_more':'expand_less'}</span></button>`
      +(S.tutMin?'':`<div class="cty-tuto-b"><b>${esc(m.t)}</b>${m.hint?`<small>${esc(m.hint)}</small>`:''}<small class="cty-tuto-r">Récompense : ${money(m.r)}</small></div>`);
    return;
  }
  el.style.display='';const cur=TUTO[S.tut];
  el.innerHTML=`<button class="cty-tuto-h" data-act="tuto"><span class="ms">school</span><b>Objectif ${S.tut+1} / ${TUTO.length}</b><span class="ms">${S.tutMin?'expand_more':'expand_less'}</span></button>`
    +(S.tutMin?'':`<div class="cty-tuto-b"><b>${esc(cur.t)}</b><small>${esc(cur.hint)}</small><div class="cty-dots">${TUTO.map((_,k)=>`<i class="${k<S.tut?'done':k===S.tut?'cur':''}"></i>`).join('')}</div><small class="cty-tuto-r">+500 § par objectif</small></div>`);
}
// ── Subventions de révision ──
let _quietGrant=false;
function syncGrants(){
  if(!S)return;const xp=gamXP();
  if(S.xpSeen==null){
    S.xpSeen=xp;
    if(!S.welcomed){const bonus=Math.min(20000,Math.round(xp*5));S.welcomed=true;
      if(bonus>0){S.money+=bonus;S.grants=(S.grants||0)+bonus;setTimeout(()=>toast(`<b>Subvention de bienvenue : +${money(bonus)}</b><br>grâce à tes ${fmt(xp)} XP de révisions`,'school'),1500);}}
    save();return;
  }
  if(xp>S.xpSeen){
    const g=(xp-S.xpSeen)*XP_MONEY;S.money+=g;S.grants=(S.grants||0)+g;S.xpSeen=xp;
    if(!_quietGrant)toast(`<b>Subvention de révision : +${money(g)}</b><br>${fmt(g/XP_MONEY)} XP gagnées depuis ta dernière visite`,'school');floatMoney(g);save();
  }else if(xp<S.xpSeen)S.xpSeen=xp;
}
if(typeof gamSubscribe==='function')gamSubscribe(()=>{if(E&&E.running&&S&&!VISIT)syncGrants();});

// #########################################################################################
// v3 — 12 nov. 2026 : toutes les nouveautés (voir docs/ville.md § v3)
//   révisions : patients, crise sanitaire, réparer en révisant, festival des partiels
//   construction : tram & métro, circulation (bouchons, feux, ronds-points), terrain, décor, tampon,
//                  industries spécialisées, gare / port / aéroport (commerce), quartiers nommés
//   ambiance : météo, journal, suivre un habitant, sons, timelapse, feux d'artifice
//   amis (Supabase) : visite, classement, jumelage, duel · succès · catastrophes (désactivées par défaut)
// #########################################################################################
let VISIT=null;      // {name, owner} pendant la visite (lecture seule) de la ville d'un ami
let FOLLOW=null;     // habitant suivi par la caméra
const trf=new Uint8Array(NN),trfN=new Uint8Array(NN),hillLV=new Uint8Array(NN);   // circulation (% de saturation), saturation voisine, vue des collines

// ── Nouveaux bâtiments ──
const NEW_BLD=[
  {id:'tramstop',name:'Arrêt de tram',cat:'transports',w:1,cost:600,upkeep:12,cov:{transport:7},ms:2,needRail:true,icon:'tram',desc:'À placer contre des rails de tram (Transports → Rails de tram). Desserte rapide le long de la ligne.'},
  {id:'ferme',name:'Ferme',cat:'economie',w:3,cost:3500,upkeep:30,jobs:24,goods:{agri:60},ms:1,icon:'agriculture',desc:'Champs, grange et silo : des emplois et des récoltes à vendre aux villes voisines.'},
  {id:'scierie',name:'Scierie',cat:'economie',w:2,cost:3000,upkeep:28,jobs:20,goods:{bois:50},pol:{r:3,s:14},ms:1,icon:'forest',desc:'Transforme le bois des forêts proches : plus il y a d’arbres autour, plus elle produit.'},
  {id:'peche',name:'Port de pêche',cat:'economie',w:2,cost:3200,upkeep:30,jobs:18,goods:{poisson:45},needWater:true,ms:1,icon:'set_meal',desc:'Chalutiers et criée : à placer au bord de l’eau.'},
  {id:'port',name:'Port de commerce',cat:'economie',w:3,cost:12000,upkeep:110,jobs:40,trade:.8,needWater:true,pol:{r:4,s:18},ms:4,icon:'directions_boat',desc:'Grues et conteneurs : multiplie les exportations vers les villes voisines. Au bord de l’eau.'},
  {id:'aeroport',name:'Aéroport',cat:'economie',w:4,cost:30000,upkeep:220,jobs:60,trade:.6,tour:20,pol:{r:6,s:20},ms:5,icon:'flight',desc:'Des avions décollent vers le monde entier : touristes et commerce.'},
  {id:'duelstatue',name:'Statue du duel',cat:'monuments',w:1,cost:0,upkeep:0,cov:{park:5,lv:6},tour:2,trophy:true,icon:'workspace_premium',desc:'Gagnée en battant un ami au duel du maire. Gratuite !'}
];
NEW_BLD.forEach(b=>{b.d=b.w;BLD.push(b);BT[b.id]=b;});
BT.gare.trade=.4;BT.gare.desc+=' Double presque le commerce avec les villes voisines.';
function svcPrice(b){return b.trophy?0:b.cost|0;}
function svcDamaged(id){return !!(S&&S.dmg&&S.dmg[id]>S.day);}

// ── Décor ──
const DECO={
  1:{name:'Massif de fleurs',cost:20,icon:'local_florist',cov:{park:[1,45]},desc:'Des couleurs au coin de la rue.'},
  2:{name:'Banc',cost:30,icon:'chair',cov:{park:[1,40]},desc:'Pour souffler entre deux séances.'},
  3:{name:'Fontaine',cost:250,icon:'water',cov:{park:[2,55],lv:[2,45]},desc:'Le murmure de l’eau fait grimper la valeur foncière.'},
  4:{name:'Lampadaire',cost:40,icon:'light',cov:{police:[2,35]},desc:'Des rues éclairées et plus sûres la nuit.'},
  5:{name:'Petite statue',cost:300,icon:'person',cov:{lv:[2,55]},desc:'Un peu de prestige pour le quartier.'},
  6:{name:'Haie',cost:15,icon:'grass',cov:{},pol:6,desc:'Filtre un peu la pollution.'},
  7:{name:'Kiosque à musique',cost:500,icon:'nightlife',cov:{park:[3,60]},desc:'Des concerts le dimanche.'}
};
const HILL_COST=60,DIG_COST=40;
function extRefund(i){
  if(deco[i]&&Array.isArray(S.gt)&&S.gt.includes(i)&&!rail[i]&&!rx[i]&&!hill[i])return 0;   // un cadeau d'ami ne se revend pas
  let v=0;if(deco[i]&&DECO[deco[i]])v+=DECO[deco[i]].cost;if(rail[i])v+=TRAM_COST;if(rx[i])v+=RX_COST[rx[i]]||0;if(hill[i])v+=hill[i]*HILL_COST;if(lane[i]&&road[i])v+=LANE_COST[lane[i]]||0;
  return v;
}

// ── Chargement d'anciennes sauvegardes ──
function extLoadFix(){
  v6LoadFix();
  if(!S.dists||typeof S.dists!=='object')S.dists={};
  if(!Array.isArray(S.mlines))S.mlines=[];
  if(!Array.isArray(S.news))S.news=[];
  if(!S.ach||typeof S.ach!=='object')S.ach={};
  if(!Array.isArray(S.rep))S.rep=[];
  if(!S.dmg||typeof S.dmg!=='object')S.dmg={};
  if(!Array.isArray(S.lmods))S.lmods=[];
  if(!S.stat||typeof S.stat!=='object')S.stat={};
}

// =========================================================
// Circulation : trajets des habitants et des employés vers les routes, saturation par case
// =========================================================
const RX_COST={1:150,2:300};
function roadCap(i){
  let c=road[i]===2?60:road[i]===3?30:15;
  if(rx[i]===2)c*=1.8;else if(rx[i]===1)c*=1.35;
  if(rail[i])c*=1.1;
  return c;
}
function recomputeTraffic(){
  recomputeSignals();
  const a=new Float32Array(NN),b=new Float32Array(NN);
  for(let i=0;i<NN;i++){
    if(!cap[i]||!lvl[i]||st[i]!==OK)continue;
    const k=cap[i]*(zone[i]===ZR?.2:.13)*(1-Math.min(.6,COV.transport[i]*.006))*(noCar(i)?.35:1);
    const x=i%N;let best=-1;
    for(const j of[i+N,x<N-1?i+1:-1,i-N,x>0?i-1:-1])if(j>=0&&j<NN&&road[j]){best=j;break;}
    if(best<0)for(const j of[i+2*N,x<N-2?i+2:-1,i-2*N,x>1?i-2:-1])if(j>=0&&j<NN&&road[j]){best=j;break;}
    if(best>=0)a[best]+=k;
  }
  for(const s of SV.values()){const B=BT[s.t];if(!svcOK.get(s.id))continue;const k=(B.jobs||0)*.12+(B.tour||0)*.5+(B.cat==='loisirs'||B.cat==='monuments'?2:0);if(!k)continue;
    let done=false;for(let z=s.z-1;z<=s.z+s.d&&!done;z++)for(let x=s.x-1;x<=s.x+s.w&&!done;x++){if(x<0||z<0||x>=N||z>=N)continue;const j=z*N+x;if(road[j]){a[j]+=k;done=true;}}}
  // les trajets se répartissent le long du réseau
  for(let pass=0;pass<6;pass++){
    for(let i=0;i<NN;i++){if(!road[i]){b[i]=0;continue;}const x=i%N;let s=0,n=0;
      for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&road[j]){s+=a[j];n++;}
      b[i]=n?a[i]*.45+s/n*.55+a[i]*.08:a[i];}
    a.set(b);
  }
  let jam=0,nr=0;
  for(let i=0;i<NN;i++){if(!road[i]){trf[i]=0;continue;}nr++;const v=clamp(Math.round(a[i]/roadCap(i)*100),0,255);trf[i]=noCar(i)?Math.min(v,20):v;if(trf[i]>100)jam++;}
  for(let i=0;i<NN;i++){const x=i%N;let m=0;for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&road[j]&&trf[j]>m)m=trf[j];trfN[i]=m;}
  ST.jam=nr?Math.round(jam/nr*100):0;
}
function jamK(i){return clamp(1.15-(trf[i]||0)/140,.22,1.15);}

// =========================================================
// Quartiers nommés et leurs règles
// =========================================================
const DIST_COLS=['#e4572e','#2e86ab','#f2b134','#3fa34d','#a23b72','#ef6f6c','#4f6d7a','#8b6fd6','#14b8a6','#c2410c','#65a30d','#db2777','#0ea5e9','#78716c','#facc15'];
const DIST_NAMES=['Quartier des Tendons','Les Vertèbres','Le Plateau Tibial','Faubourg du Fémur','Les Hauts de la Clavicule','Quartier du Ménisque','Saint-Rachis','La Rotule','Les Jardins du Diaphragme','Cité de l’Omoplate','Le Carpe','Quartier Achille','Les Coteaux du Sternum','Bourg-Malléole','La Coiffe des Rotateurs'];
const DIST_RULES=[
  {id:'nocar',name:'Sans voitures',icon:'no_crash',desc:'Rues piétonnes : plus de bonheur (+4) et de valeur foncière (+3), pas de bouchons. Les voitures font le tour.'},
  {id:'green',name:'Quartier vert',icon:'eco',desc:'Industries moins polluantes (−30 %) et habitants plus heureux (+3).'},
  {id:'calme',name:'Quartier calme',icon:'bedtime',desc:'Zone 30 et silence la nuit : bonheur +3, valeur foncière +2.'},
  {id:'tour',name:'Quartier touristique',icon:'luggage',desc:'Office de tourisme local : +4 tourisme par lieu de loisirs du quartier, plus de commerces.'},
  {id:'tech',name:'Industrie high-tech',icon:'memory',desc:'Usines modernes : pollution des industries du quartier divisée par deux.'}
];
function distCol(id){const d=S.dists[id];return DIST_COLS[((d&&d.c!=null?d.c:id-1)%DIST_COLS.length+DIST_COLS.length)%DIST_COLS.length];}
function distRule(i,r){const id=dist[i];if(!id)return false;const d=S.dists[id];return !!(d&&d.r&&d.r[r]);}
function noCar(i){return lane[i]===2||(dist[i]?distRule(i,'nocar'):false);}
function distPolK(i){let k=1;if(dist[i]){if(distRule(i,'green'))k*=.7;if(distRule(i,'tech'))k*=.5;}return k;}

// =========================================================
// Accroches de la simulation
// =========================================================
function svcCovBonus(s){
  if(s.t==='metro'&&S.mlines&&S.mlines.some(l=>l[0]===s.id||l[1]===s.id))return 5;   // station reliée par une ligne
  return 0;
}
function extCoverage(){
  // décor : petits rayons de loisirs, de prestige ou de sécurité
  for(let i=0;i<NN;i++){
    const t=deco[i];if(!t||!DECO[t])continue;const D_=DECO[t],x=i%N,z=(i/N)|0;
    for(const k in D_.cov){const [r,v]=D_.cov[k],arr=COV[k];
      for(let zz=Math.max(0,z-r);zz<=Math.min(N-1,z+r);zz++)for(let xx=Math.max(0,x-r);xx<=Math.min(N-1,x+r);xx++){
        const d=Math.hypot(xx-x,zz-z);if(d>r+.01)continue;const w=Math.round(v*(1-d/(r+1)*.5)),j=zz*N+xx;if(w>arr[j])arr[j]=w;}}
  }
  // tram : les rails desservent un peu les abords, surtout près des arrêts
  // collines : la vue fait grimper la valeur foncière autour
  hillLV.fill(0);
  for(let i=0;i<NN;i++){if(!hill[i]&&!mtn[i])continue;const x=i%N,z=(i/N)|0,v=hill[i]?hill[i]*2+2:5;   // v4 : vue sur la montagne
    for(let zz=Math.max(0,z-2);zz<=Math.min(N-1,z+2);zz++)for(let xx=Math.max(0,x-2);xx<=Math.min(N-1,x+2);xx++){const j=zz*N+xx;if(v>hillLV[j])hillLV[j]=v;}}
  laneCoverage();   // v6
  recomputeTraffic();
  if(E)E.mlDirty=true;
}
function extPollution(stamp){
  for(let i=0;i<NN;i++)if(deco[i]===6)stamp(i%N+.5,((i/N)|0)+.5,2.2,-DECO[6].pol);   // haies
}
function lmod(i,k){let v=0;if(S.lmods&&S.lmods.length){const x=i%N,z=(i/N)|0;for(const m of S.lmods)if(m.k===k&&m.u>S.day&&Math.hypot(x+.5-m.x,z+.5-m.z)<=m.r)v+=m.v;}return v;}
function extLV(i){
  let v=hillLV[i];
  if(trfN[i]>100)v-=Math.min(8,(trfN[i]-100)/12);
  if(dist[i]){if(distRule(i,'calme'))v+=2;if(distRule(i,'nocar'))v+=3;if(distRule(i,'tour'))v+=2;}
  v+=lmod(i,'lv')+laneLV[i];
  return v;
}
function extHap(i){
  let h=0;
  if(trfN[i]>110)h-=Math.min(6,(trfN[i]-110)/15);
  if(dist[i]){if(distRule(i,'nocar'))h+=4;if(distRule(i,'green'))h+=3;if(distRule(i,'calme'))h+=3;}
  if(S.crisis&&!S.crisis.done&&Math.hypot(i%N+.5-S.crisis.x,((i/N)|0)+.5-S.crisis.z)<=S.crisis.r)h-=8;
  if(isFlooded(i))h-=10;
  h+=lmod(i,'hap')+laneHP[i];
  return h;
}
function extDemand(T){
  let nt=0;for(const id in S.dists)if(S.dists[id]&&S.dists[id].r&&S.dists[id].r.tour)nt++;
  T[2]+=Math.min(.15,nt*.05);
  let tr=0;for(const s of SV.values()){const b=BT[s.t];if(b.trade&&svcOK.get(s.id))tr+=b.trade;}
  T[3]+=Math.min(.25,tr*.12);
  if(ST.jam>25)T[2]-=.05;
}
function extTour(){
  let t=0;
  for(const id in S.dists){const d=S.dists[id];if(!d||!d.r||!d.r.tour)continue;
    for(const s of SV.values()){const b=BT[s.t];if((b.cat==='loisirs'||b.cat==='monuments')&&dist[s.z*N+s.x]===+id)t+=4;}}
  if(S.fest)t+=6;
  return t;
}
function tramTiles(){let n=0;for(let i=0;i<NN;i++)if(rail[i])n++;ST.rail=n;return n;}
function isFlooded(i){return !!(S&&S.flood&&S.flood.u>S.day&&S.flood.set&&S.flood.set.has(i));}

// =========================================================
// Commerce avec les villes voisines (gare, port, aéroport)
// =========================================================
const NEIGHBORS=[
  {id:'femur',name:'Fémurbourg',icon:'location_city'},{id:'rachis',name:'Rachisville',icon:'location_city'},
  {id:'clav',name:'Port-Clavicule',icon:'sailing'},{id:'menisque',name:'Saint-Ménisque',icon:'castle'}
];
const GOODS={ind:'Produits manufacturés',agri:'Récoltes',bois:'Bois',poisson:'Poisson'};
function treesNear(s,r){let n=0;const cx=s.x+s.w/2,cz=s.z+s.d/2;for(let z=Math.max(0,Math.floor(cz-r));z<=Math.min(N-1,Math.ceil(cz+r));z++)for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(N-1,Math.ceil(cx+r));x++)if(tree[z*N+x])n+=tree[z*N+x];return n;}
function tradeGoods(){
  const g={ind:Math.round(ST.ji*.3),agri:0,bois:0,poisson:0};
  for(const s of SV.values()){const b=BT[s.t];if(!b.goods||!svcOK.get(s.id))continue;
    for(const k in b.goods){let v=b.goods[k];if(s.t==='scierie')v=Math.round(v*clamp(.25+treesNear(s,4)/30,.25,1.5));g[k]+=v;}}
  return g;
}
function tradeMult(){let m=.35;for(const s of SV.values()){const b=BT[s.t];if(b.trade&&svcOK.get(s.id))m+=b.trade;}return Math.min(2.6,m);}
function tradeIncome(){
  if(!S)return 0;
  if(!S.trade||S.trade.m!==((S.day/30)|0)){   // chaque mois, une ville voisine réclame un produit (prix ×1,5)
    const ks=Object.keys(GOODS),nb=NEIGHBORS[(Math.random()*NEIGHBORS.length)|0];
    S.trade={m:(S.day/30)|0,city:nb.id,want:ks[(Math.random()*ks.length)|0]};
  }
  const g=tradeGoods(),m=tradeMult();let tot=0;const lines={};
  for(const k in g){const v=g[k]*m*(S.trade.want===k?1.5:1)*3.3;lines[k]=Math.round(v);tot+=v;}
  S.tradeLast={g,m:+m.toFixed(2),lines,tot:Math.round(tot)};
  return tot;
}

// =========================================================
// Rendu 3D des nouveautés
// =========================================================
// Modèles des nouveaux bâtiments (repère local, avant = +z côté rue)
Object.assign(SVB,{
  tramstop(r){
    bx(-.42,-.1,.42,.18,0,.012,'#cfd5da');
    bc(-.36,.02,.015,.015,0,.32,'#4a5058');bc(.36,.02,.015,.015,0,.32,'#4a5058');
    wedge(-.42,-.16,.42,.16,.31,.34,.31,'#2f9e8f');bx(-.3,-.12,.3,-.1,.05,.28,'#bfe6f0','basic');
    bench(0,-.03,true);bc(.4,.3,.012,.012,0,.42,'#4a5058');bc(.4,.3,.07,.012,.36,.46,'#e63946','basic');
    return .36;},
  ferme(r){
    const crop=['#d9c45a','#8bbf4e','#c9a34a','#6fae4a'];
    for(let k=0;k<4;k++){const x0=-1.45+(k%2)*1.05,z0=-1.45+((k/2)|0)*1.05;bx(x0,z0,x0+.95,z0+.95,0,.025,crop[(k+(r()*4|0))%4]);
      for(let j=0;j<5;j++)bx(x0+.05,z0+.08+j*.18,x0+.9,z0+.13+j*.18,.025,.06,'#5d8f3a');}
    bx(.65,-1.2,1.4,-.2,0,.42,'#b23a2e');gable(.62,-1.23,1.43,-.17,.42,.28,'#6b4a3a',false,'#b23a2e');
    bx(.95,-.35,1.1,-.2,.02,.3,'#f3efe6','basic');
    cyl(1.05,.35,0,.95,.2,.2,12,'#d9d4cc','#9aa0a6');cone(1.05,.35,.95,.18,.21,12,'#9aa0a6');
    bc(.75,1.05,.12,.06,.02,.12,'#e63946');bc(.62,1.05,.04,.08,.02,.14,'#3e4a55');
    for(let k=0;k<4;k++)bx(-1.5+k*.75,1.45,-1.45+k*.75,1.5,0,.12,'#8a6a4a');
    return 1.15;},
  scierie(r){
    bx(-.9,-.85,.35,.2,0,.5,'#a57a52',FIn(.5),'#6f513a');gable(-.94,-.89,.39,.24,.5,.25,'#5e4636',true,'#a57a52');
    for(let k=0;k<3;k++)for(let j=0;j<3-k;j++)cyl(.55+j*.16+k*.08,-.6,0+k*.13,.12+k*.13,.065,.065,8,'#b88552','#e0c08a');
    for(let k=0;k<6;k++){bc(.4+(k%3)*.22,.45+((k/3)|0)*.22,.09,.025,0,.05+((k/3)|0)*.05,'#c49a6c');}
    bc(-.55,.55,.11,.06,.02,.13,'#f2b134');bc(-.41,.55,.04,.07,.02,.16,'#3e4a55');
    EMIT('steam',-.6,.72,-.3);return .8;},
  peche(r){
    bx(-.9,-.9,.9,.1,0,.32,'#e8eef2',FRs(),'#3b8fdc');parapet(0,-.4,1.8,1,.32,'#cfd8de');
    bx(-.9,.1,.9,.9,0,.05,'#9a7a55');for(let k=0;k<5;k++)bc(-.8+k*.4,.88,.03,.03,-.3,.08,'#6b5238');
    bc(.3,.6,.1,.25,.05,.15,'#e63946');bc(.3,.55,.06,.08,.15,.27,'#f4f6f8');bc(.3,.55,.008,.008,.27,.5,'#d0d0d0');
    for(let k=0;k<3;k++)bc(-.6+k*.18,.4,.06,.06,.05,.15,['#3b8fdc','#2fa36b','#f2b134'][k]);
    return .55;},
  port(r){
    bx(-1.45,-1.45,1.45,1.45,0,.03,'#a9adb2');
    const C=['#e4572e','#2e86ab','#f2b134','#3fa34d','#a23b72','#4f6d7a'];
    for(let k=0;k<12;k++){const x=-1.2+(k%4)*.42,z=-1.15+((k/4)|0)*.45,h=1+(r()*3|0);for(let j=0;j<h;j++)bc(x,z,.17,.08,.03+j*.13,.15+j*.13,pick(r,C));}
    for(const x of[-.7,.5]){bc(x,.95,.04,.04,0,1.1,'#f2b134');bc(x+.04,.95,.04,.04,0,1.1,'#f2b134');bx(x-.3,.9,x+.8,1,1.08,1.16,'#f2b134');bc(x+.7,.95,.005,.005,.4,1.08,'#333');}
    bx(1,-1.3,1.4,-.6,0,.45,'#dfe5ea',FOf(),'#b9c1c6');
    return 1.25;},
  aeroport(r){
    bx(-1.95,-1.95,1.95,1.95,0,.012,'#9fd57e');
    bx(-1.95,.55,1.95,1.25,0,.02,'#5d646c');for(let k=0;k<9;k++)bx(-1.75+k*.42,.88,-1.55+k*.42,.92,.02,.024,'#f3f1e7','basic');
    bx(-1.95,.52,-1.85,1.28,.02,.024,'#f3f1e7','basic');bx(1.85,.52,1.95,1.28,.02,.024,'#f3f1e7','basic');
    bx(-1.3,-1.75,.9,-.65,0,.5,'#e9eef2',FOf(),'#bcc6cd');wedge(-1.35,-.7,.95,-.35,.38,.5,.42,'#86b9d6');
    bc(1.35,-1.25,.13,.13,0,1.25,'#d6dde3');bc(1.35,-1.25,.22,.22,1.25,1.42,'#86b9d6','basic');bc(1.35,-1.25,.24,.24,1.42,1.47,'#4a5058');
    bx(-1.6,-.3,1.6,.5,0,.015,'#7a8188');
    for(let k=0;k<3;k++)bc(-1+k*.8,.05,.012,.012,0,.4,'#4a5058');
    return 1.5;},
  duelstatue(r){
    bc(0,0,.2,.2,0,.12,'#d9d4cc');bc(0,0,.15,.15,.12,.3,'#cfc8bd');
    bc(0,0,.05,.04,.3,.52,'#c9a227');ico(0,.6,0,.06,'#c9a227');
    bx(.05,-.008,.22,.008,.5,.53,'#d4d4d4');bx(-.22,-.008,-.05,.008,.46,.49,'#d4d4d4');
    tree3(-.35,.35,.08);tree3(.35,.35,.08);return .7;}
});
// Décor, collines, feux et ronds-points (appelé pour chaque case pendant la reconstruction d'un bloc)
function extTile(i){
  const x=i%N,z=(i/N)|0;
  if(lane[i]&&road[i])laneTile(i,x,z);   // v6 : lampions, terrasses, marché
  if(hill[i]&&!road[i]&&!svcAt[i]){
    TX.x=x+.5;TX.z=z+.5;TX.k=0;const h=hill[i],y=h*.28,r=rng(i*31+7);
    const g=['#7fb069','#86b86f','#76a862'][i%3];
    dome(0,0,0,.72,16,g,y/.72);dome((r()-.5)*.3,(r()-.5)*.3,0,.46,14,['#86b86f','#7fb069','#8cbf6f'][(i+1)%3],y*.92/.46);if(h>=3){ico(0,y*.8,0,.22,'#a8a29a',.7);ico(.12,y*.62,.08,.13,'#9a958c',.8);}   /* v13 : collines arrondies */
    if(h>=2&&r()<.7)ico((r()-.5)*.6,y*.4,(r()-.5)*.6,.1,'#9a958c',.7);for(let k=0;k<2;k++)if(r()<.5)ico((r()-.5)*.8,y*.25,(r()-.5)*.8,.06,'#5f9a4a',.8);
    if(h===1&&r()<.5)tree3((r()-.5)*.5,(r()-.5)*.5,.08);
    TOP[i]=Math.max(TOP[i]||0,y+.2);
  }
  if(deco[i]&&!road[i]&&!svcAt[i]){
    TX.x=x+.5;TX.z=z+.5;TX.k=0;const r=rng(i*17+3);
    const t_=decoModel(i,x,z,r);if(t_)TOP[i]=t_;   /* v13 : décors refaits */
  }
  if(lampAt(i))streetLamp(x,z);
  if(road[i])roadDecor3D(i,x,z);   /* v13 : terre-plein des avenues, bornes des pistes cyclables, panneaux stop */   /* v12 : un lampadaire toutes les deux cases, en quinconce, la crosse au-dessus de la chaussée */
  if(road[i]&&!ter[i]&&(rx[i]===2||SIG[i])){
    TX.x=x+.5;TX.z=z+.5;TX.k=0;
    if(rx[i]===2)roundaboutIsland(i);
    else for(let p=0;p<4;p++)sigPole(p);   // feux (v4, détaillés le 13 nov. 2026) : la lampe allumée est à part (stepSignals)
  }
}
// Sol : rails de tram, ronds-points, bords des quartiers, inondations
// Lampadaire de rue (13 nov. 2026) : socle, mât, crosse au-dessus de la chaussée, tête dont la vitre s'allume la nuit (matériau glass)
function streetLamp(x,z){TX.x=x+.5;TX.z=z+.5;TX.k=lampK(z*N+x);const px=-.42,pz=-.42,c='#3c4650',on=lampOn(z*N+x);
  bc(px,pz,.017,.017,0,.03,'#5b6570');cyl(px,pz,.03,.37,.0085,.0065,6,c);
  bx(px-.006,pz-.004,px+.11,pz+.004,.356,.366,c);bx(px+.003,pz-.003,px+.03,pz+.003,.33,.356,c);
  bx(px+.07,pz-.021,px+.142,pz+.021,.343,.36,'#2b3238');bx(px+.076,pz-.016,px+.136,pz+.016,.337,.343,on?'#fff1c9':'#8d8f8c',on?'glass':'plain');}   /* éteint sans électricité */
// Feu tricolore (13 nov. 2026) : mât, potence au-dessus de la route, boîtier à trois feux tourné vers les voitures, feu piéton
const SIG_ARM=[[1,0],[0,1],[-1,0],[0,-1]],SIG_FACE=[[0,-1],[1,0],[0,1],[-1,0]],SIG_Y=[.38,.41,.44];
function sigPole(p){const [sx,sz]=SIG_POLES[p],A=SIG_ARM[p],F=SIG_FACE[p],c='#353a40',hx=sx+A[0]*.2,hz=sz+A[1]*.2;
  bc(sx,sz,.02,.02,0,.03,'#4a5058');bc(sx,sz,.009,.009,.03,.5,c);
  bx(Math.min(sx,hx)-.005,Math.min(sz,hz)-.005,Math.max(sx,hx)+.005,Math.max(sz,hz)+.005,.488,.498,c);bc(hx,hz,.004,.004,.46,.488,c);
  const ha=A[0]?.019:.024,hb=A[0]?.024:.019;bc(hx,hz,ha,hb,.36,.462,'#1f2327');
  bc(hx-F[0]*.004,hz-F[1]*.004,A[0]?.028:.03,A[0]?.03:.028,.355,.467,'#2a2e33');
  for(const y of SIG_Y){const lx=hx+F[0]*.02,lz=hz+F[1]*.02;bc(lx,lz,F[0]?.004:.011,F[1]?.004:.011,y-.011,y+.011,'#3b3f44');bc(lx+F[0]*.006,lz+F[1]*.006,F[0]?.006:.013,F[1]?.006:.013,y+.012,y+.016,'#1f2327');}
  bc(sx+F[0]*.016,sz+F[1]*.016,F[0]?.006:.012,F[1]?.006:.012,.22,.28,'#1f2327');bc(sx+F[0]*.023,sz+F[1]*.023,F[0]?.002:.008,F[1]?.002:.008,.255,.272,'#ff6b5a','basic');
}
function railMask(x,z){let m=0;if(z>0&&rail[(z-1)*N+x])m|=1;if(x<N-1&&rail[z*N+x+1])m|=2;if(z<N-1&&rail[(z+1)*N+x])m|=4;if(x>0&&rail[z*N+x-1])m|=8;return m;}
function extGround(c,i,x,z,px,pz){
  if(lane[i]&&road[i])laneGround(c,i,x,z,px,pz);   // v6 : piste cyclable, rue piétonne
  if(rail[i]&&road[i]){
    let m=railMask(x,z);if(!m)m=roadMask(x,z)&5?5:10;
    const seg=(vert,a,b)=>{c.fillStyle='rgba(90,70,50,.55)';for(let k=a;k<b;k+=4){if(vert)c.fillRect(px+H2-6,pz+k,12,1.6);else c.fillRect(px+k,pz+H2-6,1.6,12);}
      c.fillStyle='#3a3f45';if(vert){c.fillRect(px+H2-4,pz+a,1.6,b-a);c.fillRect(px+H2+2.4,pz+a,1.6,b-a);}else{c.fillRect(px+a,pz+H2-4,b-a,1.6);c.fillRect(px+a,pz+H2+2.4,b-a,1.6);}};
    if(m&1)seg(true,0,H2+4);if(m&4)seg(true,H2-4,PX);if(m&8)seg(false,0,H2+4);if(m&2)seg(false,H2-4,PX);
  }
  if(rx[i]===2&&road[i])roundaboutGround(c,x,z,px,pz);   /* v12 : rond-point refait */
  if(SIG[i]&&road[i]&&rx[i]!==2){c.fillStyle='rgba(245,245,240,.9)';const m=roadMask(x,z);
    if(m&1)c.fillRect(px+H2-.5,pz+6,H2-6,1.5);if(m&4)c.fillRect(px+6,pz+PX-7.5,H2-6,1.5);if(m&8)c.fillRect(px+6,pz+6,1.5,H2-6);if(m&2)c.fillRect(px+PX-7.5,pz+H2,1.5,H2-6);}
  if(hill[i]&&!road[i]){c.fillStyle=`rgba(60,100,40,${.08*hill[i]})`;c.fillRect(px,pz,PX,PX);}
  if(S.ghost)ghostGround(c,i,x,z,px,pz);   // v4.1 : où étaient les bâtiments publics de l'ancienne ville
  if(deco[i]&&!road[i]){c.fillStyle=deco[i]===1||deco[i]===6?'rgba(90,140,60,.25)':'#e3ddd2';c.fillRect(px+3,pz+3,PX-6,PX-6);}
  if(dist[i]){
    const col=distCol(dist[i]),d=dist[i];c.fillStyle=hexA(col,.85);
    if(z===0||dist[i-N]!==d)c.fillRect(px,pz,PX,2.5);if(z===N-1||dist[i+N]!==d)c.fillRect(px,pz+PX-2.5,PX,2.5);
    if(x===0||dist[i-1]!==d)c.fillRect(px,pz,2.5,PX);if(x===N-1||dist[i+1]!==d)c.fillRect(px+PX-2.5,pz,2.5,PX);
    if(TOOL.id==='district'||TOOL.id==='undistrict'){c.fillStyle=hexA(col,.25);c.fillRect(px,pz,PX,PX);}
  }
  if(isFlooded(i)){c.fillStyle='rgba(40,130,220,.42)';c.fillRect(px,pz,PX,PX);}
}

// ── Objets animés ──
function instMesh(build,n,mat){GB=new Map();TX.x=0;TX.z=0;TX.k=0;build();const geo=toGeo(GB.get('plain'));GB=null;
  const m=new THREE.InstancedMesh(geo,mat||new THREE.MeshLambertMaterial({vertexColors:true}),n);m.count=0;m.frustumCulled=false;m.setColorAt(0,new THREE.Color('#fff'));return m;}
function extEngine(){
  // trams (deux voitures articulées)
  const tm=instMesh(()=>{bc(0,0,.06,.24,.02,.15,'#ffffff');bc(0,0,.062,.2,.08,.12,'#3e4a55');bc(0,0,.02,.02,.15,.22,'#4a5058');},40);
  E.gC.add(tm);E.trams={mesh:tm,list:[],m:new THREE.Matrix4(),col:new THREE.Color(),o:[0,0,0]};
  // rames de métro (dans la vue Transports)
  const mt=instMesh(()=>{bc(0,0,.09,.32,.0,.14,'#ffffff');bc(0,0,.092,.26,.06,.1,'#3e4a55');},24);
  mt.renderOrder=8;E.gF.add(mt);E.mtrains={mesh:mt,list:[],m:new THREE.Matrix4(),col:new THREE.Color()};
  E.mlines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.95,depthTest:false}));
  E.mlines.renderOrder=7;E.mlines.frustumCulled=false;E.gF.add(E.mlines);E.mlDirty=true;
  // avions
  const pl=instMesh(()=>{bc(0,0,.05,.32,.0,.08,'#f4f6f8');bc(0,.02,.42,.06,.03,.05,'#e9eef2');bc(0,-.27,.14,.04,.04,.06,'#e9eef2');bc(0,-.28,.01,.05,.06,.2,'#e63946');},4);
  pl.castShadow=true;E.gC.add(pl);E.planes={mesh:pl,list:[],m:new THREE.Matrix4(),q:new THREE.Quaternion(),e:new THREE.Euler(),p:new THREE.Vector3(),s:new THREE.Vector3(1,1,1)};
  // cargo du port
  const cg=instMesh(()=>{bc(0,0,.1,.34,-.06,.03,'#2e3a46');bc(0,-.05,.08,.18,.03,.1,'#e4572e');bc(0,.12,.08,.06,.03,.12,'#2e86ab');bc(0,-.28,.05,.04,.03,.2,'#f4f6f8');},2);
  E.gC.add(cg);E.cargo={mesh:cg,s:0,dir:1};
  // habitant suivi
  // petit piéton : buste, tête, bras et jambes qui se balancent en marchant
  const pm=new THREE.MeshLambertMaterial({vertexColors:true}),part=(fn)=>{GB=new Map();TX.x=0;TX.z=0;TX.k=0;fn();const g=toGeo(GB.get('plain'));GB=null;return new THREE.Mesh(g,pm);};
  E.person=new THREE.Group();
  const body=part(()=>{bc(0,0,.026,.017,.07,.135,'#3b8fdc');bc(0,0,.028,.019,.118,.14,'#2f74b5');ico(0,.162,0,.022,'#f2c9a0');bc(0,-.004,.022,.02,.176,.186,'#4a3426');});
  const leg=()=>part(()=>bc(0,0,.009,.009,-.07,0,'#2e3a46')),arm=()=>part(()=>bc(0,0,.007,.007,-.055,0,'#f2c9a0'));
  const lL=leg(),lR=leg(),aL=arm(),aR=arm();lL.position.set(-.013,.072,0);lR.position.set(.013,.072,0);aL.position.set(-.034,.135,0);aR.position.set(.034,.135,0);
  E.person.add(body,lL,lR,aL,aR);E.person.userData={lL,lR,aL,aR};E.person.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  E.person.visible=false;E.person.scale.setScalar(1.5);E.gC.add(E.person);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.075,.092,32),new THREE.MeshBasicMaterial({color:'#e0a91a',transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide}));
  ring.geometry.dispose();   /* v15 : plus d'anneau jaune sous l'habitant suivi */
  // dôme de la crise sanitaire
  E.dome=new THREE.Mesh(new THREE.SphereGeometry(1,28,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({color:'#b36bff',transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}));
  E.dome.visible=false;E.dome.renderOrder=5;E.gF.add(E.dome);
  // tornade
  const tg=new THREE.Group();for(let k=0;k<7;k++){const c=new THREE.Mesh(new THREE.CylinderGeometry(.35+k*.32,.22+k*.3,.9,14,1,true),new THREE.MeshBasicMaterial({color:'#8a8f96',transparent:true,opacity:.42-k*.035,depthWrite:false,side:THREE.DoubleSide}));c.position.y=.45+k*.85;tg.add(c);}
  tg.visible=false;E.gD.add(tg);E.tornado=tg;
  makeRain();makeRainbow();makeFireworks();makeSky();
}
function makeRain(){
  const n=LOWQ?500:1100,geo=new THREE.BufferGeometry(),pos=new Float32Array(n*6);
  for(let k=0;k<n;k++){const x=(Math.random()-.5)*44,y=Math.random()*14,z=(Math.random()-.5)*44;pos.set([x,y,z,x+.04,y+.35,z+.02],k*6);}
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  E.rain=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#b7cde3',transparent:true,opacity:.5,depthWrite:false}));
  E.rain.frustumCulled=false;E.rain.visible=false;E.gD.add(E.rain);
}
function stepRain(dt,on){
  const R=E.rain;R.visible=on;if(!on)return;
  const a=R.geometry.attributes.position.array,ext=Math.min(70,CAM.dist*1.4)/44,sp=S.wx&&S.wx.k==='storm'?15:10;
  R.position.set(CAM.x,0,CAM.z);R.scale.set(ext,1,ext);
  for(let k=0;k<a.length;k+=6){a[k+1]-=dt*sp;a[k+4]-=dt*sp;a[k]-=dt*.6;a[k+3]-=dt*.6;if(a[k+1]<0){const y=12+Math.random()*3,x=(Math.random()-.5)*44,z=(Math.random()-.5)*44;a[k]=x;a[k+1]=y;a[k+2]=z;a[k+3]=x+.04;a[k+4]=y+.35;a[k+5]=z+.02;}}
  R.geometry.attributes.position.needsUpdate=true;
}
function makeRainbow(){
  const g=new THREE.Group(),C=['#ff4d4d','#ff9f40','#ffe066','#6bd26b','#4fa3ff','#5b5bd6','#a35bd6'];
  C.forEach((c,k)=>{const m=new THREE.Mesh(new THREE.RingGeometry(34+k*1.1,35.1+k*1.1,64,1,0,Math.PI),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,fog:false}));g.add(m);});
  g.visible=false;E.gD.add(g);E.rainbow=g;
}
function makeFireworks(){
  const M=1600,geo=new THREE.BufferGeometry(),pos=new Float32Array(M*3),col=new Float32Array(M*3);
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3).setUsage(THREE.DynamicDrawUsage));
  const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:.32,map:glowTex(),vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
  pts.frustumCulled=false;pts.renderOrder=9;E.gD.add(pts);
  E.fw={pts,geo,pos,col,M,p:[],queue:[]};
}
const FW_COLS=[[1,.35,.35],[1,.8,.3],[.4,1,.5],[.45,.7,1],[1,.5,1],[1,1,1],[.3,1,1]];
function fireworks(n,msg){
  if(!E||!E.fw)return;
  for(let k=0;k<n;k++)E.fw.queue.push(E.t+k*.45+Math.random()*.3);
  if(msg)toast(`<b>${esc(msg)}</b>`,'celebration');
  sndPlay('fw');
}
function stepFireworks(dt){
  const F=E.fw;if(!F)return;
  while(F.queue.length&&F.queue[0]<=E.t){F.queue.shift();
    const x=CAM.x+(Math.random()-.5)*Math.min(18,CAM.dist*.5),z=CAM.z+(Math.random()-.5)*Math.min(18,CAM.dist*.5);
    F.p.push({x,y:.3,z,vx:0,vy:7+Math.random()*2,vz:0,l:0,L:.9+Math.random()*.3,rk:1,c:FW_COLS[(Math.random()*FW_COLS.length)|0]});}
  const add=[];
  for(let j=F.p.length-1;j>=0;j--){const p=F.p[j];p.l+=dt;
    if(p.rk&&p.l>=p.L){const n=70;for(let k=0;k<n;k++){const a=Math.random()*6.283,b=Math.acos(2*Math.random()-1),s=2.4+Math.random()*1.4;
        add.push({x:p.x,y:p.y,z:p.z,vx:Math.sin(b)*Math.cos(a)*s,vy:Math.cos(b)*s,vz:Math.sin(b)*Math.sin(a)*s,l:0,L:1.3+Math.random()*.6,rk:0,c:Math.random()<.2?FW_COLS[5]:p.c});}
      F.p[j]=F.p[F.p.length-1];F.p.pop();sndPlay('pop');continue;}
    if(!p.rk&&p.l>=p.L){F.p[j]=F.p[F.p.length-1];F.p.pop();continue;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(!p.rk){p.vy-=3.2*dt;p.vx*=.985;p.vz*=.985;}}
  for(const a of add)if(F.p.length<F.M)F.p.push(a);
  let n=0;for(const p of F.p){if(n>=F.M)break;const f=p.rk?1:Math.max(0,1-p.l/p.L);F.pos[n*3]=p.x;F.pos[n*3+1]=p.y;F.pos[n*3+2]=p.z;F.col[n*3]=p.c[0]*f;F.col[n*3+1]=p.c[1]*f;F.col[n*3+2]=p.c[2]*f;n++;}
  F.geo.setDrawRange(0,n);F.geo.attributes.position.needsUpdate=true;F.geo.attributes.color.needsUpdate=true;
}
// trams : roulent uniquement sur les rails
function railNb(i,d){const x=i%N,z=(i/N)|0,X=x+DIRS[d][0],Z=z+DIRS[d][1];if(X<0||Z<0||X>=N||Z>=N)return -1;const j=Z*N+X;return rail[j]&&road[j]?j:-1;}
function spawnTram(c){
  const L=E.railList;if(!L||!L.length)return false;
  for(let k=0;k<10;k++){const i=L[(Math.random()*L.length)|0],opts=[0,1,2,3].filter(d=>railNb(i,d)>=0);if(!opts.length)continue;
    const out=opts[(Math.random()*opts.length)|0];c.i=i;c.from=(out+2)%4;c.to=out;c.t=Math.random();c.sp=.9;c.fresh=true;c.tram=1;return true;}
  return false;
}
function stepTrams(dt){
  const C=E.trams,nStops=svcCount('tramstop'),target=Math.min(30,E.railList?Math.floor(E.railList.length/7):0,nStops*3);
  while(C.list.length<target){const c={};if(!spawnTram(c))break;C.list.push(c);}if(C.list.length>target)C.list.length=Math.max(0,target);
  const o=C.o;let n=0;
  for(const c of C.list){
    if(!(rail[c.i]&&road[c.i])&&!spawnTram(c))continue;
    c.t+=dt*c.sp;let g=0;
    while(c.t>=1&&g++<4){const j=railNb(c.i,c.to);if(j<0){c.to=c.from;c.from=(c.to+2)%4;c.t=0;break;}   // terminus : demi-tour
      const from=(c.to+2)%4,opts=[0,1,2,3].filter(d=>d!==from&&railNb(j,d)>=0);
      const to=opts.length?(opts.includes(c.to)?c.to:opts[(Math.random()*opts.length)|0]):from;
      c.i=j;c.from=from;c.to=to;c.t-=1;}
    if(c.t>=1)c.t=.99;
    carPos(c,o);   // pour l'orientation ; la position est recentrée (carPos roule sur la voie de droite)
    const a=DIRS[c.from],b=DIRS[c.to],t=c.t,u=1-t,cx=c.i%N+.5,cz=((c.i/N)|0)+.5;
    const px=u*u*(cx+a[0]*.5)+2*u*t*cx+t*t*(cx+b[0]*.5),pz=u*u*(cz+a[1]*.5)+2*u*t*cz+t*t*(cz+b[1]*.5);
    C.m.makeRotationY(o[2]);C.m.setPosition(px,ter[c.i]?.13:0,pz);C.mesh.setMatrixAt(n,C.m);
    if(c.fresh){C.col.set(['#e63946','#14b8a6','#f2b134'][n%3]);C.mesh.setColorAt(n,C.col);c.fresh=false;C.colDirty=true;}
    n++;
  }
  C.mesh.count=n;C.mesh.instanceMatrix.needsUpdate=true;if(C.colDirty&&C.mesh.instanceColor){C.mesh.instanceColor.needsUpdate=true;C.colDirty=false;}
}
// lignes de métro : visibles dans la vue Transports (et avec l'outil Ligne de métro)
const ML_COLS=['#e63946','#2e86ab','#f2b134','#3fa34d','#a23b72','#14b8a6'];
function rebuildMetroLines(){
  const v=[],c=[],col=new THREE.Color();E.mtrains.list=[];
  (S.mlines||[]).forEach((l,k)=>{const a=SV.get(l[0]),b=SV.get(l[1]);if(!a||!b)return;
    const ax=a.x+a.w/2,az=a.z+a.d/2,bx_=b.x+b.w/2,bz=b.z+b.d/2;col.set(ML_COLS[k%ML_COLS.length]);
    for(const o of[-.06,0,.06]){v.push(ax+o,.12,az+o,bx_+o,.12,bz+o);c.push(col.r,col.g,col.b,col.r,col.g,col.b);}
    E.mtrains.list.push({ax,az,bx:bx_,bz,t:Math.random(),dir:1,len:Math.hypot(bx_-ax,bz-az)||1,col:ML_COLS[k%ML_COLS.length]});});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  E.mlines.geometry.dispose();E.mlines.geometry=g;
  E.mtrains.list.forEach((t,k)=>{E.mtrains.mesh.setColorAt(k,E.mtrains.col.set(t.col));});if(E.mtrains.mesh.instanceColor)E.mtrains.mesh.instanceColor.needsUpdate=true;
  E.mlDirty=false;
}
function stepMetro(dt){
  const show=VIEW==='transport'||TOOL.id==='mline';E.mlines.visible=show;const M=E.mtrains;
  if(!show){M.mesh.count=0;return;}
  let n=0;for(const t of M.list){t.t+=dt*3.2/t.len*t.dir;if(t.t>1){t.t=1;t.dir=-1;}if(t.t<0){t.t=0;t.dir=1;}
    const x=lerp(t.ax,t.bx,t.t),z=lerp(t.az,t.bz,t.t);M.m.makeRotationY(Math.atan2(t.bx-t.ax,t.bz-t.az));M.m.setPosition(x,.12,z);M.mesh.setMatrixAt(n++,M.m);}
  M.mesh.count=n;M.mesh.instanceMatrix.needsUpdate=true;
}
// avions de l'aéroport et cargo du port
function stepPlanes(dt){
  const PL=E.planes,ap=[...SV.values()].find(s=>s.t==='aeroport'&&svcOK.get(s.id));
  if(!ap){PL.mesh.count=0;return;}
  if(!PL.list.length)PL.list=[{t:0,dep:true},{t:.5,dep:false}];
  TX.x=ap.x+ap.w/2;TX.z=ap.z+ap.d/2;TX.k=ap.rot|0;
  const a=P(0,0),b=P(1,0),dx=b[0]-a[0],dz=b[1]-a[1];let n=0;
  for(const p of PL.list){p.t+=dt/26;if(p.t>1)p.t-=1;
    const t=p.dep?p.t:1-p.t;     // les arrivées suivent le même chemin à l'envers
    const s=t<.25?-1.6+t/.25*2.2:.6+(t-.25)/.75*40,h=t<.22?0:Math.pow((t-.22)/.78,1.3)*9;
    const w=P(s,.9);PL.p.set(w[0],.03+h,w[1]);
    PL.e.set(-(t<.22?0:.18)*(p.dep?1:-1),Math.atan2(dx,dz)+(p.dep?0:Math.PI),0,'YXZ');PL.q.setFromEuler(PL.e);
    PL.s.setScalar(t>.9?Math.max(.01,(1-t)*10):1);PL.m.compose(PL.p,PL.q,PL.s);PL.mesh.setMatrixAt(n++,PL.m);}
  PL.mesh.count=n;PL.mesh.instanceMatrix.needsUpdate=true;
}
function stepCargo(dt){
  const C=E.cargo,B=E.boats,has=svcCount('port')>0&&B.path.length>12;
  if(!has){C.mesh.count=0;return;}
  C.s+=C.dir*dt*.22;if(C.s<=0){C.s=0;C.dir=1;}if(C.s>=B.path.length-1.001){C.s=B.path.length-1.001;C.dir=-1;}
  const k=Math.floor(C.s),f=C.s-k,a=B.path[k],c=B.path[k+1],x=lerp(a[0],c[0],f),z=lerp(a[1],c[1],f);
  const m=B.m;m.makeRotationY(Math.atan2((c[0]-a[0])*C.dir,(c[1]-a[1])*C.dir));m.setPosition(x-.2,-.05,z);C.mesh.setMatrixAt(0,m);C.mesh.count=1;C.mesh.instanceMatrix.needsUpdate=true;
}
function extRebuild(){
  E.railList=[];for(let i=0;i<NN;i++)if(rail[i]&&road[i])E.railList.push(i);
  rebuildMetroLines();distLabels(true);
}
function extFrame(dt,sp){
  humBegin();   /* v12 : habitants animés (tous les systèmes y déposent leurs personnes pendant l'image) */
  myHouseFrame();   /* 13 nov. 2026 : Ma maison */
  const run=dt*animK();
  if(D.deco){D.deco=false;rebuildLights();}
  if(D.rail){D.rail=false;E.railList=[];for(let i=0;i<NN;i++)if(rail[i]&&road[i])E.railList.push(i);E.trams.list.length=0;}
  if(E.mlDirty)rebuildMetroLines();
  stepTrams(run);stepMetro(dt);stepPlanes(run);stepCargo(run);stepFireworks(dt);
  stepSignals(run);stepPatFig();autoSaveTick();rewindTick();stepCranes(run);
  stepSeasons(dt,run);stepFauna(dt,run);stepShow(dt,run);stepBoats2(dt,run);stepHeli(dt,run);stepFarm(run);   // v5 · v13 : hélicoptère, ferme
  if(VISIT&&E.t-(VISIT.pollT||0)>20)visitRefresh();   // visite en direct : on recharge la ville de l'ami si elle a changé
  v6Frame(dt,run);
  if(E.mtnDirty){E.mtnDirty=false;rebuildMountains();D.trees=true;}   // v4
  if(E.t-(E.wxT||0)>2){E.wxT=E.t;if(!VISIT)wxDay();}
  stepWeather(dt);stepFollow(dt);stepCrisisFx(dt);stepTornado(dt);v15Frame(dt,run);
  if(E.t-(E.lblT||0)>.15){E.lblT=E.t;distLabels(false);}
  sndFrame(dt);humEnd();
}

// =========================================================
// Patients-habitants : cas cliniques de kiné (la 1re réponse est la bonne, mélangées à l'affichage)
// =========================================================
const PATIENTS=[
  {age:[30,55],p:'a mal au bas du dos depuis 3 semaines, après un déménagement. Pas de fièvre, pas de perte de poids, pas de trouble urinaire ni de déficit neurologique.',q:'Quelle prise en charge privilégier ?',
    a:['Le rassurer, l’encourager à rester actif et lui proposer des exercices','Un repos strict au lit jusqu’à disparition complète de la douleur','Une ceinture lombaire portée en permanence','Uniquement des massages, sans exercice'],ex:'Lombalgie commune sans drapeau rouge : maintien des activités, exercice et éducation (HAS 2019). Le repos au lit est déconseillé.'},
  {age:[18,40],p:'s’est tordu la cheville en dedans au basket hier. Il arrive à faire 4 pas, et la palpation du bord postérieur et de la pointe des malléoles, de la base du 5e métatarsien et du naviculaire est indolore.',q:'Faut-il une radiographie selon les règles d’Ottawa ?',
    a:['Non : les critères d’Ottawa sont négatifs','Oui, toujours après une entorse','Oui, parce que la cheville est gonflée','Oui, dès que le patient a plus de 18 ans'],ex:'Règles d’Ottawa : radiographie seulement s’il y a une douleur osseuse à la palpation des zones clés ou une impossibilité de faire 4 pas.'},
  {age:[35,55],p:'court trois fois par semaine. Il a mal au milieu du tendon d’Achille depuis 2 mois, surtout le matin au réveil.',q:'Quel traitement par l’exercice est le mieux validé ?',
    a:['Un renforcement excentrique progressif des triceps suraux','Une immobilisation plâtrée de 6 semaines','L’arrêt définitif de la course à pied','Des étirements passifs uniquement'],ex:'Tendinopathie corporéale d’Achille : le travail excentrique (protocole d’Alfredson) ou en charge progressive est le traitement de référence.'},
  {age:[65,82],p:'a été opérée d’une prothèse totale de hanche par voie postérieure il y a 5 jours.',q:'Quel mouvement doit-elle éviter pour limiter le risque de luxation ?',
    a:['L’association flexion + adduction + rotation interne de hanche','L’extension de hanche pendant la marche','La contraction isométrique du quadriceps','La marche avec un déambulateur'],ex:'Voie postérieure : on évite la flexion importante associée à l’adduction et à la rotation interne (par exemple croiser les jambes assis sur une chaise basse).'},
  {age:[60,75],p:'a une BPCO stable et s’essouffle dès qu’il monte un étage.',q:'Quel est le cœur de la réhabilitation respiratoire ?',
    a:['Le réentraînement à l’effort en endurance','Le repos pour économiser son souffle','L’oxygène seul, sans activité physique','Des exercices respiratoires uniquement, sans effort'],ex:'Dans la BPCO, le réentraînement à l’effort (surtout des membres inférieurs) améliore la dyspnée et la qualité de vie.'},
  {baby:true,age:[2,8],p:'fait un premier épisode de bronchiolite : il tousse et a le nez bouché, mais il boit bien et respire sans signe de lutte.',q:'Que recommande la HAS (2019) ?',
    a:['Des lavages de nez, des repas fractionnés et la surveillance, sans kiné respiratoire systématique','Des séances quotidiennes de clapping thoracique','Une toux provoquée à chaque séance','Une hospitalisation immédiate'],ex:'HAS 2019 : la kinésithérapie respiratoire n’est pas recommandée en routine dans la bronchiolite du nourrisson. On privilégie la désobstruction nasale et la surveillance des signes de gravité.'},
  {age:[50,75],p:'a de brefs vertiges rotatoires quand il se retourne dans son lit. La manœuvre de Dix-Hallpike à droite déclenche un nystagmus.',q:'Quel traitement proposer ?',
    a:['Une manœuvre libératoire (Epley ou Sémont)','Rester allongé sans bouger pendant une semaine','Un collier cervical','Un renforcement des muscles du cou'],ex:'VPPB du canal postérieur : les manœuvres libératoires (Epley, Sémont) repositionnent les otolithes et sont très efficaces.'},
  {age:[60,82],p:'est hémiplégique depuis un AVC il y a 10 jours. Son bras paralysé pend le long du corps.',q:'Comment prévenir l’épaule douloureuse de l’hémiplégique ?',
    a:['Bien installer et soutenir le membre supérieur, ne jamais tirer sur le bras','Des mobilisations passives forcées au-delà de la douleur','Le laisser pendre sans soutien pour l’étirer','L’aider à se relever en le tirant par ce bras'],ex:'L’épaule hémiplégique est fragile (subluxation) : positionnement, soutien du bras et manipulations douces.'},
  {age:[40,60],p:'se réveille la nuit avec des fourmillements du pouce, de l’index et du majeur.',q:'Quel test évoque un syndrome du canal carpien ?',
    a:['Le test de Phalen (flexion maximale des poignets)','Le test de Lachman','Le test de Thomas','Le signe de Lasègue'],ex:'Les tests de Phalen et de Tinel reproduisent les paresthésies dans le territoire du nerf médian.'},
  {age:[18,35],p:'a entendu un craquement dans son genou au ski, avec un gonflement rapide.',q:'Quel test est le plus sensible pour une rupture du ligament croisé antérieur ?',
    a:['Le test de Lachman','Le tiroir postérieur','Le test de McMurray','Le test de Jobe'],ex:'Lachman = test de référence du LCA. Tiroir postérieur → LCP, McMurray → ménisques, Jobe → supra-épineux.'},
  {age:[65,80],p:'a une maladie de Parkinson : ses pieds « collent » au sol quand il doit passer une porte.',q:'Quelle stratégie aide à débloquer ce freezing ?',
    a:['Des indices externes : rythme sonore, bandes au sol','Marcher plus vite pour forcer le passage','Arrêter de marcher seul et passer au fauteuil','Porter des chaussures très lourdes'],ex:'Les indiçages visuels ou auditifs (métronome, lignes au sol) aident à relancer le pas.'},
  {age:[50,72],p:'s’est cassé le poignet. Depuis le retrait du plâtre, sa main est gonflée, chaude, très douloureuse et raide.',q:'À quoi faut-il penser ?',
    a:['Un syndrome douloureux régional complexe (algodystrophie)','Une tendinopathie du biceps','Une hernie discale lombaire','Une entorse de cheville'],ex:'Douleur disproportionnée, œdème, troubles vasomoteurs et raideur après un traumatisme ou une immobilisation : SDRC de type 1.'},
  {age:[35,55],p:'souffre de fibromyalgie : douleurs diffuses et grande fatigue.',q:'Quelle approche est recommandée ?',
    a:['Une activité physique adaptée et progressive','Le repos complet le plus possible','Éviter tout effort physique','Immobiliser les articulations douloureuses'],ex:'L’activité physique adaptée est le traitement non médicamenteux le mieux validé dans la fibromyalgie.'},
  {f:true,age:[27,38],p:'a des fuites urinaires quand elle tousse, 3 mois après son accouchement.',q:'Quelle rééducation proposer en premier ?',
    a:['La rééducation des muscles du plancher pelvien','Des abdominaux en crunchs intensifs','Boire beaucoup moins pour limiter les fuites','Attendre sans rien faire, ça passera'],ex:'Incontinence urinaire d’effort : renforcement du plancher pelvien en première intention. Les crunchs augmentent la pression abdominale.'},
  {age:[45,60],p:'a l’épaule de plus en plus raide depuis 4 mois, sans traumatisme. Même en passif, le mouvement est bloqué.',q:'Quelle amplitude est typiquement la plus limitée dans la capsulite rétractile ?',
    a:['La rotation externe de l’épaule','La flexion du coude','La pronation de l’avant-bras','L’extension du poignet'],ex:'La capsulite rétractile limite surtout la rotation externe, en actif comme en passif.'},
  {age:[45,65],p:'a mal à l’épaule quand il lève le bras, avec une douleur sur la face latérale du bras.',q:'Quel test explore le muscle supra-épineux ?',
    a:['Le test de Jobe','Le test de Lachman','Le test de Schober','Le signe de Babinski'],ex:'Jobe : bras à 90° d’abduction dans le plan de la scapula, pouce vers le bas, contre résistance.'},
  {age:[30,50],p:'a une douleur qui descend le long de la jambe jusqu’au pied. Lever sa jambe tendue à 40° réveille cette douleur.',q:'Comment s’appelle ce signe ?',
    a:['Le signe de Lasègue','Le signe de Trendelenburg','Le signe de Homans','Le signe de Babinski'],ex:'Lasègue positif : mise en tension radiculaire (L5 ou S1), évocatrice d’une sciatique.'},
  {age:[50,72],p:'marche en se dandinant. En appui sur la jambe droite, son bassin s’abaisse du côté gauche.',q:'Quel muscle est faible ?',
    a:['Le moyen fessier droit','Le moyen fessier gauche','Le quadriceps droit','Les ischio-jambiers gauches'],ex:'Signe de Trendelenburg : le moyen fessier du côté de l’appui ne stabilise plus le bassin.'},
  {age:[8,16],p:'a une mucoviscidose et beaucoup de sécrétions bronchiques.',q:'Que proposer au quotidien ?',
    a:['Du désencombrement bronchique régulier et de l’activité physique','De la kiné seulement pendant les infections','Une dispense de sport','Le repos au lit'],ex:'Dans la mucoviscidose, le drainage bronchique est quotidien et l’activité physique est encouragée.'},
  {f:true,age:[78,90],p:'est tombée deux fois cette année et a peur de sortir de chez elle.',q:'Qu’est-ce qui réduit le plus le risque de chute ?',
    a:['Un programme d’exercices d’équilibre et de renforcement','Rester à la maison pour ne plus tomber','Le repos au fauteuil','Uniquement des massages'],ex:'Les programmes d’équilibre et de renforcement (type Otago) réduisent les chutes ; l’inactivité aggrave le risque.'},
  {age:[30,45],p:'a une sclérose en plaques et se plaint d’une grande fatigue à l’effort.',q:'Quel conseil lui donner ?',
    a:['Un exercice adapté, fractionné avec des pauses, en évitant la chaleur excessive','Un effort maximal jusqu’à l’épuisement','Un bain très chaud avant chaque séance','L’arrêt de toute activité physique'],ex:'Dans la SEP, l’exercice adapté améliore la fatigue ; la chaleur peut aggraver les symptômes pour un temps (phénomène d’Uhthoff).'},
  {age:[16,30],p:'a mal devant le genou en descendant les escaliers et après être resté longtemps assis.',q:'Quelle prise en charge proposer en premier ?',
    a:['Renforcer le quadriceps et les muscles de la hanche','Immobiliser le genou tendu pendant un mois','Une arthroscopie d’emblée','L’arrêt définitif du sport'],ex:'Syndrome fémoro-patellaire : renforcement du quadriceps et des abducteurs et rotateurs externes de hanche.'},
  {f:true,age:[11,15],p:'a une gibbosité visible quand elle se penche en avant.',q:'Comment mesure-t-on la courbure d’une scoliose ?',
    a:['L’angle de Cobb sur une radiographie','Le test de Schober','L’angle Q du genou','L’indice de Tiffeneau'],ex:'L’angle de Cobb mesure la scoliose. Schober = mobilité lombaire, angle Q = genou, Tiffeneau = spirométrie.'},
  {age:[25,40],p:'a des douleurs lombaires la nuit qui s’améliorent en bougeant, avec une raideur le matin.',q:'Quel test mesure la mobilité lombaire en flexion ?',
    a:['Le test de Schober','Le test de Phalen','Le test de Lachman','Le test de Jobe'],ex:'Schober : on marque L5 et 10 cm au-dessus ; en flexion, l’écart doit augmenter d’environ 5 cm.'},
  {age:[50,70],p:'vient d’être amputé sous le genou. Il aime glisser un coussin sous son genou pour être bien installé.',q:'Pourquoi faut-il éviter ce coussin ?',
    a:['Il favorise un flessum (raideur en flexion) du genou','Il fait gonfler le pied opposé','Il empêche de dormir','Il ne faut pas l’éviter, c’est conseillé'],ex:'Après une amputation tibiale, on prévient le flessum du genou : genou en extension, pas de coussin dessous.'},
  {age:[55,70],p:'vient de faire une spirométrie : VEMS / CVF = 0,60.',q:'Que montre ce résultat ?',
    a:['Un trouble ventilatoire obstructif','Un trouble ventilatoire restrictif','Une spirométrie normale','Une insuffisance cardiaque'],ex:'Un rapport VEMS / CVF inférieur à 0,70 définit le trouble ventilatoire obstructif (par exemple une BPCO).'},
  {age:[60,75],p:'a une insuffisance cardiaque stable et a peur de faire du sport.',q:'Que lui conseiller ?',
    a:['Une réadaptation à l’effort encadrée, d’intensité modérée','Le repos strict pour ménager son cœur','Des efforts maximaux d’emblée','Uniquement des étirements'],ex:'La réadaptation cardiaque encadrée améliore la capacité d’effort et la qualité de vie dans l’insuffisance cardiaque stable.'},
  {f:true,age:[65,80],p:'a une ostéoporose et a peur de se casser un os en marchant.',q:'Quelle activité lui conseiller ?',
    a:['Des exercices en charge (marche) et du renforcement musculaire','Rester allongée le plus possible','Éviter toute marche','Des sauts violents dès la première séance'],ex:'Les exercices en charge et le renforcement aident à préserver la masse osseuse et réduisent le risque de chute.'}
];
const FIRST_F=['Léa','Chloé','Manon','Inès','Camille','Sarah','Jade','Louise','Emma','Zoé','Nadia','Yasmine','Lucie','Margaux','Aïcha','Sofia','Claire','Mathilde','Fatou','Julie'];
const FIRST_M=['Lucas','Hugo','Adam','Nathan','Karim','Théo','Mathis','Yanis','Louis','Paul','Omar','Gabriel','Mehdi','Arthur','Samuel','Bastien','Moussa','Julien','Antoine','Ilyes'];
const LAST=['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel','Girard','Benali','Nguyen','Diallo','Rousseau','Blanc','Guerin','Muller','Haddad'];
function rpick(a){return a[(Math.random()*a.length)|0];}
function shuffled(n){return [...Array(n).keys()].sort(()=>Math.random()-.5);}
function residentialLots(){const L=[];for(let i=0;i<NN;i++)if(zone[i]===ZR&&lvl[i]&&st[i]===OK&&cap[i])L.push(i);return L;}
function patientSpawn(fu){   // fu = patient qui revient (consultation de suivi, v5)
  const L=residentialLots();if(!L.length)return;
  const PC=patCases(),P=P_(),vet=S.prof==='veto';
  if(!Array.isArray(S.patSeen))S.patSeen=[];
  let pool=PC.map((_,k)=>k).filter(k=>!S.patSeen.includes(k));if(!pool.length){S.patSeen=[];pool=PC.map((_,k)=>k);}
  // suivi : un cas compatible avec le patient (même espèce, enfant ou adulte…), en priorité un cas raté avant
  const fit=x=>{const c=PC[x];if(!c||!fu)return !!c;if(vet)return (c.sp||'chien')===(fu.pet?fu.pet.sp:'chien');return !!(c.baby||c.kid)===!!fu.baby&&(!c.f||fu.f)&&(!c.m||!fu.f)&&x!==fu.k;};
  if(fu){const miss=(Array.isArray(S.patMiss)?S.patMiss:[]).filter(fit);pool=miss.length?miss:pool.filter(fit);if(!pool.length)pool=PC.map((_,k)=>k).filter(fit);if(!pool.length)return;}
  const k=rpick(pool),c=PC[k],age=c.age[0]+((Math.random()*(c.age[1]-c.age[0]+1))|0);
  let name,first,f,pet=null,owner='';
  if(vet){const A=ANI[c.sp]||ANI.chien;f=c.sex?c.sex==='f':Math.random()<.5;first=rpick(f?A.F:A.M);
    owner=`${rpick(Math.random()<.5?FIRST_F:FIRST_M)} ${rpick(LAST)}`;
    name=`${first}, ${c.br||rpick(A.br)} de ${age} ${c.mo?'mois':age>1?'ans':'an'}`;pet={sp:c.sp||'chien',col:(Math.random()*5)|0};}
  else{f=c.f||(!c.baby&&!c.m&&Math.random()<.5);first=rpick(f?FIRST_F:FIRST_M);const last=rpick(LAST);
    name=c.baby?`${first} ${last}, ${age} mois`:`${first} ${last}, ${age} ans`;}
  if(fu){name=fu.name;first=fu.first;f=fu.f;pet=fu.pet;owner=fu.owner;}
  S.pat={k,name,first,f,i:fu?fu.i:rpick(L),day:S.day,order:shuffled(4),baby:fu?!!fu.baby:!!(c.baby||c.kid),prof:S.prof||'kine',pet,owner,fu:!!fu};
  S.patSeen.push(k);if(S.patSeen.length>18)S.patSeen.shift();
  D.icons=true;
  const x=S.pat.i%N,z=(S.pat.i/N)|0;
  if(fu)toast(`<b>${esc(first)} revient</b> pour une consultation de suivi${vet?` (chez ${esc(owner)})`:''} · prime ×1,75`,P.patIc,{label:'Soigner',fn:()=>{flyTo(x+.5,z+.5);openPanel('patient');}});
  else toast(vet?`<b>Un animal t’attend</b> : ${esc(name)} (chez ${esc(owner)})`:`<b>Un patient t’attend</b> : ${esc(name)}${S.pat.baby?' (amené par ses parents)':''}`,P.patIc,{label:'Soigner',fn:()=>{flyTo(x+.5,z+.5);openPanel('patient');}});
  sndPlay('ding');
}
function patientDay(){
  if(VISIT)return;
  if(S.pat)return;   // le patient attend sans limite : rien n'est perdu
  if(ST.pop<20||S.tut<3)return;
  if(S.patFU&&S.day>=S.patFU.due){const F=S.patFU;S.patFU=null;if(F.prof===(S.prof||'kine')&&zone[F.i]===ZR&&lvl[F.i]&&st[F.i]===OK){patientSpawn(F);if(S.pat)return;}}
  if(S.patNext==null)S.patNext=S.day+15;
  if(S.day>=S.patNext){patientSpawn();S.patNext=S.day+(ST.healthAny?30:45)+((Math.random()*25)|0);}
}
let PATRES=null;   // résultat affiché après la réponse
function patientAnswer(j){
  const p=S.pat;if(!p)return;const c=patCases()[p.k];if(!c)return;const P=P_(),vet=!!p.pet;
  const ok=j===0,home=p.i,inCab=COV.health[home]>0,reward=ok?Math.round((p.fu?700:400)*(inCab?1.5:1)):0;
  S.stat.patTot=(S.stat.patTot|0)+1;
  if(ok){S.stat.patOk=(S.stat.patOk|0)+1;S.money+=reward;floatMoney(reward);
    S.lmods.push({k:'hap',v:6,x:home%N+.5,z:((home/N)|0)+.5,r:4,u:S.day+90});D.lv=true;
    news(P.patIc,vet?`${p.first} est soigné${p.f?'e':''} !`:`${p.first} est guéri${p.f?'e':''} !`,vet?`${p.owner} te remercie : tout le quartier est rassuré (bonheur +6 pendant 3 mois).`:'Grâce à ta prise en charge, tout le quartier va mieux (bonheur +6 pendant 3 mois).');
    sndPlay('coin');}
  else news(P.patIc,`${p.first} reviendra`,'La prise en charge n’était pas la bonne. Révise ce point : un autre cas viendra bientôt.');
  PATRES={ok,c,order:p.order,j,reward,name:p.name,inCab,baby:p.baby,owner:p.owner,vet};
  if(!Array.isArray(S.patMiss))S.patMiss=[];
  if(ok){S.patMiss=S.patMiss.filter(x=>x!==p.k);if(!p.fu)S.patFU={i:p.i,name:p.name,first:p.first,f:p.f,pet:p.pet,owner:p.owner,baby:p.baby,k:p.k,prof:S.prof||'kine',due:S.day+40+((Math.random()*30)|0)};}
  else if(!S.patMiss.includes(p.k)){S.patMiss.push(p.k);if(S.patMiss.length>12)S.patMiss.shift();}
  S.pat=null;S.patNext=S.day+(ok?30:15)+((Math.random()*20)|0);D.icons=true;
  checkAch();save();renderPanel();refreshHUD(true);
}
function panelPatient(){
  const L='ABCD',P=P_();
  if(PATRES){const r=PATRES;
    const ans=r.order.map((j,k)=>`<button class="cty-qa${j===0?' ok':j===r.j?' ko':''}" disabled><b>${L[k]}</b><span>${esc(r.c.a[j])}</span></button>`).join('');
    return head(P.patIc,P.cab,esc(r.name),'#e6397a')
      +`<div class="cty-case"><p>${esc(r.c.p)}</p><b>${esc(r.c.q)}</b></div><div class="cty-qas">${ans}</div>`
      +`<div class="cty-qfb ${r.ok?'ok':'ko'}"><b>${r.ok?P.healed:'Pas tout à fait…'}</b> ${r.ok?`+${money(r.reward)}${r.inCab?` (soigné près d’${P.une} : ×1,5)`:''} et le quartier est plus heureux.`:`${r.vet?'L’animal':'Le patient'} reviendra plus tard, sans pénalité.`}<small>${esc(r.c.ex)}</small></div>`
      +`<button class="cty-btn" data-act="patok"><span class="ms">check</span>Continuer</button>`;}
  const p=S.pat;
  if(!p){const d=S.patNext!=null?Math.max(0,S.patNext-S.day):null;
    return head(P.patIc,P.cab,`Aucun ${P.pat} en attente`,'#e6397a')
      +`<p class="cty-p">${P.intro}</p>`
      +(ST.pop<20||S.tut<3?`<p class="cty-p small">Les premiers ${P.pats} arrivent quand ta ville a quelques habitants.</p>`:d!=null?`<p class="cty-p small">Prochain ${P.pat} dans ${d} jour${d>1?'s':''} environ (le temps de la ville).</p>`:'')
      +rows([['healing',P.healedN,fmt(S.stat.patOk|0)],['groups','Consultations',fmt(S.stat.patTot|0)]]);}
  const c=patCases()[p.k],x=p.i%N,z=(p.i/N)|0;
  if(!c){S.pat=null;return panelPatient();}
  const ans=p.order.map((j,k)=>`<button class="cty-qa" data-act="pata" data-j="${j}"><b>${L[k]}</b><span>${esc(c.a[j])}</span></button>`).join('');
  return head(P.patIc,p.fu?'Consultation de suivi':p.pet?'Un animal t’attend':P.wait,esc(p.name)+(p.pet?` · chez ${esc(p.owner)}`:p.baby?' · amené par ses parents':''),'#e6397a')
    +`<div class="cty-case"><p>${p.fu?'<span class="cty-fu">Suivi</span> ':''}<b>${esc(p.first)}</b> ${p.fu?'revient te voir : ':''}${esc(c.p)}</p><b>${esc(c.q)}</b></div><div class="cty-qas">${ans}</div>`
    +`<button class="cty-qprev" data-act="goto" data-x="${x+.5}" data-z="${z+.5}"><span class="ms">home_pin</span>Voir sa maison</button>`
    +`<p class="cty-p small">Bonne réponse : +${p.fu?700:400} § (×1,5 si ${P.une} couvre sa maison) et un quartier plus heureux. Mauvaise réponse : aucune pénalité.</p>`;
}

// =========================================================
// Crise sanitaire : 5 bonnes réponses d'affilée au Défi du maire l'arrêtent
// =========================================================
const CRISES=[['Épidémie de grippe','coronavirus'],['Vague de gastro-entérite','sick'],['Épidémie de mal de dos','accessibility_new'],['Épidémie de bronchiolite','pulmonology'],['Vague d’entorses de cheville','directions_run']];
function placeName(x,z){const i=clamp(Math.floor(z),0,N-1)*N+clamp(Math.floor(x),0,N-1),d=dist[i]&&S.dists[dist[i]];return d?d.n:'un quartier résidentiel';}
function crisisMonth(){
  if(VISIT||S.crisis||ST.pop<150||S.day<(S.crNext||420)||Math.random()>.4)return;
  const L=residentialLots();if(!L.length)return;
  const i=rpick(L),m=month(),cands=CRISES.filter((c,k)=>k!==3||m>=10||m<=2),c=rpick(cands);
  S.crisis={name:c[0],icon:c[1],x:i%N+.5,z:((i/N)|0)+.5,r:5,day:S.day,t0:Date.now(),n:0};
  D.lv=D.icons=true;sndPlay('alert');
  news('coronavirus',c[0]+' !',`Elle touche ${placeName(S.crisis.x,S.crisis.z)}. Le maire peut l’arrêter en réussissant 5 questions d’affilée au Défi.`,'alert');
  toast(`<b>Crise sanitaire</b> : ${esc(c[0])}. 5 bonnes réponses d’affilée au Défi du maire l’arrêtent !`,'coronavirus',{label:'Agir',fn:()=>{flyTo(S.crisis.x,S.crisis.z,26);openPanel('quiz');}});
}
function crisisDay(){
  const C=S.crisis;if(!C)return;
  if(Date.now()-(C.t0||Date.now())>3*864e5){news('sentiment_neutral','La crise s’est éteinte d’elle-même',`${C.name} est terminée. Le maire n’a pas reçu de prime cette fois.`);S.crisis=null;S.crNext=S.day+300;D.lv=D.icons=true;}
}
function crisisQuiz(ok){
  const C=S.crisis;if(!C)return;
  if(!ok){if(C.n)toast('Série de la crise sanitaire remise à zéro : courage !','coronavirus');C.n=0;return;}
  C.n++;
  if(C.n>=5){
    S.money+=3000;floatMoney(3000);S.stat.crisisOk=(S.stat.crisisOk|0)+1;
    S.lmods.push({k:'hap',v:6,x:C.x,z:C.z,r:C.r+2,u:S.day+180},{k:'lv',v:8,x:C.x,z:C.z,r:C.r+2,u:S.day+180});
    news('verified',`${C.name} : c’est fini !`,`Le maire a réussi 5 questions d’affilée. Le quartier touché reçoit une prime : bonheur +6 et valeur foncière +8 pendant 6 mois.`,'good');
    S.crisis=null;S.crNext=S.day+360+((Math.random()*200)|0);D.lv=D.icons=true;
    fireworks(6,'Crise sanitaire arrêtée ! +3 000 § et un quartier récompensé');
  }
}
function stepCrisisFx(dt){
  const C=S.crisis,d=E.dome;d.visible=!!C&&!VISIT;if(!d.visible)return;
  d.position.set(C.x,0,C.z);d.scale.set(C.r,C.r*.45,C.r);d.material.opacity=.1+Math.sin(E.t*2)*.04;
}

// =========================================================
// Réparer en révisant : les questions oubliées abîment (un peu, et seulement en apparence) des bâtiments
// =========================================================
const REP_MAX=3,REP_GAP=20*60e3;   // 3 bâtiments abîmés au plus, un nouveau toutes les 20 min réelles au plus
function forgottenIds(){
  const base=quizBase();if(!base.length)return [];
  const due=new Set(typeof getSRSDueQuestions==='function'?(()=>{try{return getSRSDueQuestions().map(q=>String(q.id));}catch(e){return [];}})():[]);
  return base.filter(q=>{const d=typeof getDiff==='function'?getDiff(q.id):'new';return d==='hard'||due.has(String(q.id));}).map(q=>String(q.id));
}
function refreshRepairs(){
  if(VISIT||!S)return;
  const ids=forgottenIds(),set=new Set(ids);
  S.rep=S.rep.filter(r=>set.has(String(r.q))&&lvl[r.i]&&zone[r.i]&&st[r.i]===OK);
  const used=new Set(S.rep.map(r=>r.i)),usedQ=new Set(S.rep.map(r=>String(r.q)));
  const lots=[];for(let i=0;i<NN;i++)if(lvl[i]&&zone[i]&&st[i]===OK&&cap[i]&&!used.has(i))lots.push(i);
  const free=ids.filter(id=>!usedQ.has(id));
  if(S.rep.length>REP_MAX)S.rep.length=REP_MAX;
  if(S.rep.length<Math.min(REP_MAX,ids.length)&&lots.length&&free.length&&Date.now()>=(S.repT||0)){
    const li=lots[(Math.random()*lots.length)|0],q=free[(Math.random()*free.length)|0];S.rep.push({i:li,q});S.repT=Date.now()+REP_GAP;}
  D.icons=true;
}
let RQ=null;   // question de réparation affichée dans l'inspecteur {i, q, order, ans}
function repAt(i){return S.rep&&S.rep.find(r=>r.i===i);}
function repQuestion(id){return(typeof questions!=='undefined'&&Array.isArray(questions))?questions.find(q=>String(q.id)===String(id)):null;}
function repCard(i){
  const r=repAt(i);if(!r)return '';
  const q=repQuestion(r.q);if(!q){S.rep=S.rep.filter(x=>x!==r);return '';}
  if(!RQ||RQ.i!==i||String(RQ.q.id)!==String(q.id))RQ={i,q,order:q.answers.map((_,j)=>j).filter(j=>String(q.answers[j]||'').trim()).sort(()=>Math.random()-.5),ans:null};
  const L='ABCDEFGHIJ',done=RQ.ans!=null;
  const ans=RQ.order.map((j,k)=>{let cl='';if(done){if(j===(q.correct|0))cl=' ok';else if(j===RQ.ans)cl=' ko';}return `<button class="cty-qa${cl}" data-act="rpa" data-j="${j}"${done?' disabled':''}><b>${L[k]||k+1}</b><span>${esc(q.answers[j])}</span></button>`;}).join('');
  const co=courseMap().get(String(q.courseId));
  const fb=done?`<div class="cty-qfb ${RQ.ok?'ok':'ko'}"><b>${RQ.ok?'Bâtiment réparé !':'Pas encore…'}</b> ${RQ.ok?'+150 § et une question de moins à revoir.':`La bonne réponse : <b>${esc(q.answers[q.correct|0])}</b>. Le bâtiment attend toujours.`}${q.expl?`<small>${esc(q.expl)}</small>`:''}</div>`:'';
  return `<div class="cty-repair"><div class="cty-repair-h"><span class="ms">build</span><span><b>Ce bâtiment est un peu abîmé</b><small>Il est lié à une question que tu as oubliée : réponds juste pour le remettre à neuf.</small></span></div>`
    +`<div class="cty-qq">${co&&co.name?`<small>${esc(co.name)}</small>`:''}${esc(q.question)}</div><div class="cty-qas">${ans}</div>${fb}</div>`;
}
function repAnswer(j){
  if(!RQ||RQ.ans!=null)return;const q=RQ.q,ok=j===(q.correct|0);RQ.ans=j;RQ.ok=ok;
  _quietGrant=true;try{if(typeof recordAnswer==='function'){recordAnswer(q.id,ok,5);if(typeof saveAll==='function')saveAll();}}catch(e){console.warn('[city] recordAnswer',e);}
  syncGrants();_quietGrant=false;
  if(ok){S.rep=S.rep.filter(r=>r.i!==RQ.i);S.money+=150;floatMoney(150);S.stat.repOk=(S.stat.repOk|0)+1;D.icons=true;touch(RQ.i);sndPlay('coin');checkAch();}
  save();renderPanel();refreshHUD(true);
}

// =========================================================
// Festival des partiels : un examen de l'agenda dans moins de 15 jours → primes ×2 sur ses matières
// =========================================================
function festCheck(){
  if(VISIT||!S)return;
  let ex=[];try{ex=typeof getExamsV2==='function'?getExamsV2():[];}catch(e){ex=[];}
  const t0=new Date().setHours(0,0,0,0);let best=null;
  for(const e of ex||[]){if(!e||!e.date)continue;const d=new Date(e.date).setHours(0,0,0,0);if(isNaN(d))continue;const n=Math.round((d-t0)/864e5);
    if(n>=0&&n<=14&&(!best||n<best.days))best={id:String(e.id||e.name),name:e.name||'Partiel',days:n,folders:(e.folderIds||[]).map(String)};}
  const was=S.fest&&S.fest.id;S.fest=best;
  if(best&&S.festSeen!==best.id){S.festSeen=best.id;S.stat.fest=(S.stat.fest|0)+1;
    news('festival',`Le festival des partiels commence !`,`« ${best.name} » approche (${best.days?`dans ${best.days} jour${best.days>1?'s':''}`:'aujourd’hui'}). Les primes du Défi du maire sont doublées sur ses matières.`,'good');
    setTimeout(()=>fireworks(3,`Festival des partiels : primes ×2 pour « ${best.name} »`),900);}
  if(!!was!==!!best&&E)D.lights=true;
}
function festFolderNames(){
  if(!S.fest)return '';const fl=typeof folders!=='undefined'&&Array.isArray(folders)?folders:[];
  if(!S.fest.folders.length)return 'toutes tes matières';
  return S.fest.folders.map(id=>{const f=fl.find(x=>String(x.id)===id);return f?f.name:null;}).filter(Boolean).join(', ')||'ses matières';
}
function festMul(q){
  if(!S.fest)return 1;if(!S.fest.folders.length)return 2;
  const co=courseMap().get(String(q.courseId));return co&&S.fest.folders.includes(String(co.folderId))?2:1;
}
function quizExtBanner(){
  let h='';
  if(S.fest)h+=`<div class="cty-qfest"><span class="ms">festival</span><span><b>Festival des partiels</b> · « ${esc(S.fest.name)} » ${S.fest.days?`dans ${S.fest.days} j`:'aujourd’hui'} : primes ×2 sur ${esc(festFolderNames())}</span>${S.fest.folders.length&&quizFilter().f!==S.fest.folders[0]?`<button data-act="festgo">Réviser ce partiel</button>`:''}</div>`;
  if(S.crisis){const n=S.crisis.n|0;h+=`<div class="cty-qcrisis"><span class="ms">coronavirus</span><span><b>${esc(S.crisis.name)}</b> · encore ${5-n} bonne${5-n>1?'s':''} réponse${5-n>1?'s':''} d’affilée pour l’arrêter</span><span class="cty-dots5">${[0,1,2,3,4].map(k=>`<i class="${k<n?'on':''}"></i>`).join('')}</span></div>`;}
  return h;
}
function extQuizAnswer(q,ok){
  crisisQuiz(ok);
  if(ok&&S.rep&&S.rep.some(r=>String(r.q)===String(q.id))){const r=S.rep.find(x=>String(x.q)===String(q.id));S.rep=S.rep.filter(x=>x!==r);S.stat.repOk=(S.stat.repOk|0)+1;D.icons=true;toast('Une question oubliée est revue : un bâtiment est réparé !','build');}
  S.lastStudy=new Date().toDateString();
  checkAch();cityPublishSoon();
}

// =========================================================
// Météo : soleil, pluie, orage, brouillard, arc-en-ciel
// =========================================================
const WX={clear:['sunny','Beau temps'],rain:['rainy','Pluie'],storm:['thunderstorm','Orage'],fog:['foggy','Brouillard'],rainbow:['looks','Arc-en-ciel']};
// Météo en temps réel (12 nov. 2026) : beau temps 5 à 12 min, pluie et brouillard 2 à 4 min, orage 1,5 à 3 min, arc-en-ciel 1 min
const WX_MIN=60e3;
function wxDay(){
  // v4 : la météo suit le rythme du temps (S.wx.left = temps restant, décompté × animK ; figée en pause)
  const now=Date.now();
  if(!S.wx)S.wx={k:'clear',left:3*WX_MIN};
  if(S.wx.left==null){S.wx.left=S.wx.end?Math.max(0,S.wx.end-now):3*WX_MIN;delete S.wx.end;}
  const el=Math.min(10000,Math.max(0,now-(S.wx.t||now)));S.wx.t=now;
  if(!S.set.wx){S.wx.k='clear';return;}
  S.wx.left-=el*animK();
  if(S.wx.left>0)return;
  const prev=S.wx.k,m=month(),winter=SNOW_M[m]>.3,autumn=m>=9&&m<=10;
  let k='clear';const r=Math.random();
  if(prev==='rain'&&r<.45&&!winter)k='rainbow';
  else if(winter)k=r<.25?'fog':'clear';
  else if(r<.22)k='rain';else if(r<.3&&m>=4&&m<=8)k='storm';else if(r<(autumn?.48:.36))k='fog';
  const R=(a,b)=>(a+Math.random()*(b-a))*WX_MIN;
  const dur=k==='rainbow'?R(1,1.3):k==='storm'?R(1.5,3):k==='rain'||k==='fog'?R(2,4):R(5,12);
  S.wx={k,left:dur,t:now};
  const gap=k2=>{if(S.seen['wx'+k2]!=null&&S.day-S.seen['wx'+k2]<120)return false;S.seen['wx'+k2]=S.day;return true;};
  if(k==='storm'&&gap('s'))news('thunderstorm','Orage sur la ville','Restez à l’abri ! Les pompiers sont en alerte.');
  else if(k==='rainbow'&&gap('r'))news('looks','Un arc-en-ciel au-dessus de la ville','Les habitants sortent leurs téléphones pour le photographier.');
}
function stepWeather(dt){
  const k=S.set.wx&&S.wx?S.wx.k:'clear',wet=(k==='rain'||k==='storm')&&SNOW.value<.35;
  stepRain(dt,wet);
  // ciel plus sombre sous la pluie, éclairs pendant l'orage
  E.wxDark=lerp(E.wxDark||0,wet?(k==='storm'?.45:.28):0,Math.min(1,dt*.6));
  if(k==='storm'&&Math.random()<dt*.18){E.flash=1;setTimeout(()=>sndPlay('thunder'),400+Math.random()*1200);}
  E.flash=Math.max(0,(E.flash||0)-dt*3.2);
  if(E.wxDark>.005||E.flash>.005){
    const bg=E.scene.background;bg.lerp(_wxGrey,E.wxDark);if(E.flash)bg.lerp(_wxWhite,E.flash*.6);E.scene.fog.color.copy(bg);
    E.hemi.intensity*=1-E.wxDark*.4;E.hemi.intensity+=E.flash*1.2;E.sun.intensity*=1-E.wxDark*.7;}
  const fk=lerp(E.fogK||1,k==='fog'?.62:wet?.8:1,Math.min(1,dt*.5));E.fogK=fk;   // v6.1 : brouillard léger (avant .28 et .35 : on ne voyait plus rien)
  E.scene.fog.near=(CAM.dist*1.1+25)*fk;E.scene.fog.far=(CAM.dist*2.6+120)*fk;
  // arc-en-ciel : face à la caméra, de l'autre côté de la ville
  const rb=E.rainbow,want=k==='rainbow'&&E.night<.4?1:0;rb.userData.o=lerp(rb.userData.o||0,want,Math.min(1,dt*.4));
  rb.visible=rb.userData.o>.01;
  if(rb.visible){rb.children.forEach(m=>m.material.opacity=rb.userData.o*.32);const fx=-Math.sin(CAM.yaw),fz=-Math.cos(CAM.yaw);
    rb.position.set(CAM.x+fx*60,-4,CAM.z+fz*60);rb.rotation.set(0,CAM.yaw,0);}
}
const _wxGrey=new THREE.Color('#7d8794'),_wxWhite=new THREE.Color('#ffffff');

// =========================================================
// Le journal de la ville
// =========================================================
function news(icon,t,d,kind){if(!S||VISIT)return;S.news.push({icon,t,d,kind:kind||'',day:S.day});if(S.news.length>40)S.news.shift();}
const READERS=['Mme Rotule','M. Fémur','Une habitante du centre','Un commerçant','Une étudiante en kiné','M. Lombaire','Un retraité','Une infirmière','Un livreur','Une maman du quartier'];
function readerLetters(){
  const L=[],P=ST,add=(t)=>L.push([rpick(READERS),t]);
  if(P.jam>20)add('« Ça bouchonne tous les matins ! Une avenue, un tram ou un rond-point, monsieur le maire ? »');
  if(!P.healthAny&&P.pop>40)add(P_().noCab);
  if(P.unemp>.2&&P.pop>60)add('« Je cherche du travail depuis des mois : il nous faut des commerces, des bureaux ou des usines. »');
  if(P.pu>P.pp)add('« Encore une coupure de courant pendant mes révisions ! »');
  if(S.tax.r>12)add('« Mes impôts ont encore augmenté… »');
  let polR=0;for(let i=0;i<NN;i++)if(zone[i]===ZR&&lvl[i]&&pol[i]>40)polR++;if(polR>3)add('« On respire mal près des usines. Plantez des arbres ou des haies ! »');
  if(P.hap>=75&&P.pop>100)add('« Il fait bon vivre ici. Merci pour les parcs ! »');
  if(svcCount('kine')>=3)add(P_().many);
  if(S.fest)add(`« Bon courage à tous les étudiants pour « ${S.fest.name} » ! »`);
  if(S.crisis)add(`« ${S.crisis.name} : j’espère que le maire va vite trouver une solution. »`);
  if(ST.rail>10)add('« Le tram est vraiment pratique pour aller au travail. »');
  if(!L.length)add('« Une ville calme où rien ne se passe… c’est peut-être ça, le bonheur. »');
  return L.slice(0,3);
}
function didYouKnow(){
  const base=quizBase();if(!base.length)return null;
  const good=base.filter(q=>{const d=typeof getDiff==='function'?getDiff(q.id):'new';return d==='acquired'||d==='easy';});
  const pool=good.length?good:base,k=Math.floor((S.day/7))%pool.length;
  return pool[(k*2654435761>>>0)%pool.length];
}
function panelJournal(){
  S.newsSeen=S.news.length;
  const items=S.news.slice().reverse(),une=items.find(n=>n.kind)||items[0];
  const nd=n=>`<div class="cty-news"><span class="ms">${n.icon}</span><div><b>${esc(n.t)}</b><small>${esc(n.d)}</small></div></div>`;
  const q=didYouKnow(),wx=WX[(S.wx&&S.wx.k)||'clear'];
  return `<div class="cty-gz-head"><button class="cty-px" data-act="close" aria-label="Fermer"><span class="ms">close</span></button><div class="cty-gz-t">La Gazette de ${esc(S.name)}</div><small>${dateStr()} · ${fmt(ST.pop)} habitants · prix : 0 §</small></div>`
    +gzSection()   // v6 : édition du dimanche
    +(une?`<div class="cty-gz-une"><span class="ms">${une.icon}</span><b>${esc(une.t)}</b><p>${esc(une.d)}</p></div>`:`<div class="cty-gz-une"><b>Bienvenue dans ta gazette !</b><p>Les nouvelles de la ville apparaîtront ici.</p></div>`)
    +`<div class="cty-sec">Dernières nouvelles</div>`+(items.filter(n=>n!==une).slice(0,7).map(nd).join('')||'<p class="cty-p small">Rien de neuf pour l’instant.</p>')
    +`<div class="cty-sec">Courrier des lecteurs</div>`+readerLetters().map(([w,t])=>`<div class="cty-letter"><p>${esc(t)}</p><small>— ${esc(w)}</small></div>`).join('')
    +(q?`<div class="cty-sec">Le saviez-vous ? (tiré de tes cours)</div><div class="cty-dyk"><b>${esc(q.question)}</b><p>→ ${esc(q.answers[q.correct|0])}</p></div>`:'')
    +`<div class="cty-sec">Météo</div>`+rows([[wx[0],'Aujourd’hui',wx[1]],['thermostat','Saison',['Hiver','Hiver','Printemps','Printemps','Printemps','Été','Été','Été','Automne','Automne','Automne','Hiver'][month()]]]);
}

// =========================================================
// Suivre un habitant : maison → travail → parc → maison, caméra à l'épaule
// =========================================================
function roadNear(i){if(road[i])return i;const x=i%N;for(const j of[i+N,x<N-1?i+1:-1,i-N,x>0?i-1:-1,i+2*N,x<N-2?i+2:-1,i-2*N,x>1?i-2:-1])if(j>=0&&j<NN&&road[j])return j;return -1;}
function roadPathBFS(a,b,veh){   /* veh : véhicule, évite les rues piétonnes (14 nov. 2026) */
  if(a<0||b<0)return null;const prev=new Int32Array(NN).fill(-1),q=[a];prev[a]=a;
  for(let h=0;h<q.length;h++){const i=q[h];if(i===b)break;const x=i%N;for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&road[j]&&prev[j]<0&&!(veh&&j!==b&&noCar(j))){prev[j]=i;q.push(j);}}
  if(prev[b]<0)return null;const p=[];for(let i=b;i!==a;i=prev[i])p.push(i);p.push(a);return p.reverse();
}
function followStart(home,cit){   // cit = habitant nommé (panneau Habitants, v5)
  const work=[];for(let i=0;i<NN;i++)if(zone[i]&&zone[i]!==ZR&&lvl[i]&&st[i]===OK&&cap[i])work.push(i);
  for(const s of SV.values())if(BT[s.t].cat==='services'||BT[s.t].cat==='economie')work.push(s.z*N+s.x);
  const parks=[];for(const s of SV.values()){const c=BT[s.t].cat;if(c==='parcs'||c==='loisirs')parks.push(s.z*N+s.x);}for(let i=0;i<NN;i++)if(deco[i]===2||deco[i]===7)parks.push(i);
  if(!work.length){toast('Il n’y a encore aucun lieu de travail dans la ville.','work_off');return;}
  const f=cit?cit.f:Math.random()<.5,age=cit?cit.age:18+((Math.random()*60)|0),w=cit&&cit.work!=null&&(svcAt[cit.work]||(zone[cit.work]&&lvl[cit.work]))?cit.work:rpick(work),pk=parks.length?rpick(parks):null;
  const stops=[{i:home,what:'À la maison',k:'home'},{i:w,what:'Au travail',k:'work'}];if(pk!=null)stops.push({i:pk,what:'Au parc',k:'park'});
  FOLLOW={name:cit?cit.name:`${rpick(f?FIRST_F:FIRST_M)} ${rpick(LAST)}`,f,age,home,stops,leg:0,path:null,pi:0,t:0,wait:2,pos:{x:home%N+.5,z:((home/N)|0)+.5},msg:'Sort de chez '+(f?'elle':'lui'),
    job:jobName(w),thoughts:citizenThoughts(home)};
  if(cit){const h=hourNow();if(h>=8&&h<17){FOLLOW.leg=1;FOLLOW.pos={x:w%N+.5,z:((w/N)|0)+.5};FOLLOW.msg='Au travail';}}
  E.person.visible=true;closePanel();openPanel('citizen');
  tweenCam({dist:8,pitch:.78});
  const fb=$('cty-follow');if(fb)fb.style.display='';
}
function jobName(i){if(svcAt[i]){const s=SV.get(svcAt[i]);return s?BT[s.t].name:'Service public';}const z=zone[i],l=Math.min(4,lvl[i]||1);return LOT_NAMES[z]?LOT_NAMES[z][l-1]:'Entreprise';}
function citizenThoughts(i){
  const T=[];
  if(hap[i]>=70)T.push('J’adore mon quartier !');else if(hap[i]<35)T.push('Je songe à déménager…');
  if(pol[i]>35)T.push('L’air sent l’usine ici.');
  if(!COV.health[i])T.push(P_().thNo);else T.push(P_().thYes);
  if(trfN[i]>100)T.push('Encore des bouchons devant chez moi !');
  if(COV.park[i]>50)T.push('Le parc à côté, c’est parfait pour courir.');
  if(COV.transport[i]>40)T.push('Je prends les transports en commun, c’est rapide.');
  if(S.fest)T.push('Les étudiants révisent jour et nuit en ce moment.');
  return T.slice(0,3);
}
function followStop(){FOLLOW=null;if(E)E.person.visible=false;const fb=$('cty-follow');if(fb){fb.style.display='none';fb.innerHTML='';}if(PANEL==='citizen')closePanel();}
function stepFollow(dt){
  const F=FOLLOW;if(!F)return;
  if(F.wait>0){F.wait-=dt;if(F.wait<=0){const a=F.stops[F.leg],b=F.stops[(F.leg+1)%F.stops.length];F.path=roadPathBFS(roadNear(a.i),roadNear(b.i));F.pi=0;F.t=0;
      if(!F.path){F.msg='Ne trouve pas de chemin… il manque une route ?';F.wait=4;F.leg=(F.leg+1)%F.stops.length;}else F.msg=b.k==='work'?`Va au travail (${F.job})`:b.k==='park'?'Va se promener au parc':'Rentre à la maison';}}
  else if(F.path){F.t+=dt*.55;while(F.t>=1&&F.pi<F.path.length-1){F.t-=1;F.pi++;}   // vitesse de marche (≈ 3 fois moins vite qu'une voiture)
    if(F.pi>=F.path.length-1){F.leg=(F.leg+1)%F.stops.length;F.wait=4;F.msg=F.stops[F.leg].what;F.path=null;}
    else{const a=F.path[F.pi],b=F.path[F.pi+1],ax=a%N+.5,az=((a/N)|0)+.5,bx_=b%N+.5,bz=((b/N)|0)+.5,nx=bz-az,nz=-(bx_-ax);
      F.pos.x=lerp(ax,bx_,F.t)+nx*.41;F.pos.z=lerp(az,bz,F.t)+nz*.41;/* sur le trottoir */E.person.rotation.y=Math.atan2(bx_-ax,bz-az);}}
  E.person.position.set(F.pos.x,ter[clamp(Math.floor(F.pos.z),0,N-1)*N+clamp(Math.floor(F.pos.x),0,N-1)]?.13:0,F.pos.z);
  const walk=F.path&&F.wait<=0,sw=walk?Math.sin(E.t*7.5)*.55:0,U=E.person.userData;
  U.lL.rotation.x=sw;U.lR.rotation.x=-sw;U.aL.rotation.x=-sw*.8;U.aR.rotation.x=sw*.8;
  E.person.position.y+=walk?Math.abs(Math.sin(E.t*7.5))*.006:0;
  if(!E.tw){CAM.x=lerp(CAM.x,F.pos.x,Math.min(1,dt*2.5));CAM.z=lerp(CAM.z,F.pos.z,Math.min(1,dt*2.5));applyCam();}
  const fb=$('cty-follow');if(fb&&E.t-(F.uiT||0)>.4){F.uiT=E.t;fb.innerHTML=`<span class="ms">person_pin_circle</span><span><b>${esc(F.name)}</b>, ${F.age} ans · ${esc(F.msg)}</span><button data-act="followstop">Arrêter</button>`;}
}
function panelCitizen(){
  const F=FOLLOW;if(!F)return head('person','Personne n’est suivi');
  return head('person_pin_circle',esc(F.name),`${F.age} ans · ${F.f?'habitante':'habitant'} de ${esc(S.name)}`,'#3b8fdc')
    +rows([['work','Travail',esc(F.job)],['mood','Bonheur',hap[F.home]+' %'],['home','Quartier',esc(dist[F.home]&&S.dists[dist[F.home]]?S.dists[dist[F.home]].n:'—')]])
    +`<div class="cty-sec">Ce qu’${F.f?'elle':'il'} pense</div>`+F.thoughts.map(t=>`<div class="cty-letter"><p>« ${esc(t)} »</p></div>`).join('')
    +`<button class="cty-btn danger" data-act="followstop"><span class="ms">close</span>Arrêter de suivre</button>`;
}

// =========================================================
// Sons d'ambiance et musique douce (Web Audio, rien à télécharger)
// =========================================================
const SND={ctx:null,master:null,hum:null,rain:null,crick:null,next:0,nextMus:0,muted:false};
function sndInit(){
  if(SND.ctx||!(S.set.snd||S.set.mus))return;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{
    const c=new AC(),m=c.createGain();m.gain.value=0;m.connect(c.destination);SND.ctx=c;SND.master=m;
    // v3.4 : plus aucun son continu (le souffle de la ville, le sifflement de la pluie et la note des grillons
    // faisaient un bruit permanent) : seulement des sons courts et doux, programmés de temps en temps
    const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);for(let k=0;k<d.length;k++)d[k]=Math.random()*2-1;SND.noiseBuf=b;
    // écho léger pour la musique
    const dl=c.createDelay(1);dl.delayTime.value=.38;const fb=c.createGain();fb.gain.value=.32;dl.connect(fb);fb.connect(dl);const mg=c.createGain();mg.gain.value=.5;dl.connect(mg);mg.connect(m);SND.echo=dl;
    sndVolume();
  }catch(e){console.warn('[city] audio',e);SND.ctx=null;}
}
function sndVolume(){if(!SND.ctx)return;const on=(S.set.snd||S.set.mus)&&!SND.muted&&E&&E.running;SND.master.gain.setTargetAtTime(on?(S.set.vol??.6)*.9:0,SND.ctx.currentTime,.3);}
function sndEnv(t,dur,peak,dest){const g=SND.ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);g.connect(dest||SND.master);return g;}
function sndTone(f,t,dur,peak,type,f2,dest){const c=SND.ctx,o=c.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur*.8);o.connect(sndEnv(t,dur,peak,dest));o.start(t);o.stop(t+dur+.05);}
function sndNoise(t,dur,peak,f,type){const c=SND.ctx,s=c.createBufferSource();s.buffer=SND.noiseBuf;const fl=c.createBiquadFilter();fl.type=type||'lowpass';fl.frequency.value=f;s.connect(fl);fl.connect(sndEnv(t,dur,peak));s.start(t,Math.random());s.stop(t+dur+.05);}
function sndPlay(k){
  if(!SND.ctx||!S.set.snd||SND.muted)return;const t=SND.ctx.currentTime+.01;
  if(k==='pop'){sndNoise(t,.5,.35,1800,'bandpass');sndTone(180,t,.4,.2,'sine',60);}
  else if(k==='fw')sndTone(500,t,.9,.05,'sine',1400);
  else if(k==='thunder'){sndNoise(t,2.2,.22,160);sndNoise(t+.1,1.2,.1,500);}
  else if(k==='coin'){sndTone(988,t,.12,.12,'triangle');sndTone(1319,t+.09,.3,.12,'triangle');}
  else if(k==='ding'){sndTone(880,t,.6,.1,'sine');sndTone(1320,t+.12,.7,.07,'sine');}
  else if(k==='alert'){sndTone(440,t,.25,.1,'square');sndTone(330,t+.28,.35,.1,'square');}
  else if(k==='build'){sndNoise(t,.12,.25,900,'bandpass');sndTone(220,t,.15,.1,'triangle',110);}
}
const PENTA=[523.25,587.33,659.25,783.99,880,1046.5,1174.66];
function sndFrame(dt){
  if(!SND.ctx||SND.ctx.state!=='running')return;const c=SND.ctx,t=c.currentTime,zoom=clamp(1-(CAM.dist-6)/60,0,1),day=1-E.night;
  const wet=S.wx&&(S.wx.k==='rain'||S.wx.k==='storm')&&SNOW.value<.35;
  if(S.set.snd&&t>SND.next){SND.next=t+1.5+Math.random()*4;
    if(day>.6&&!wet&&SNOW.value<.5){   // gazouillis d'oiseaux le jour
      const n=2+((Math.random()*3)|0),f=2600+Math.random()*1600,v=.018*(.3+zoom*.7);for(let k=0;k<n;k++)sndTone(f*(1+Math.random()*.2),t+k*.12,.08,v,'sine',f*(1.25+Math.random()*.3));}
    else if(E.night>.65&&!wet&&SNOW.value<.3){   // grillons la nuit : trois petits cri-cri, puis silence
      const v=.006*(.4+zoom*.6);for(let k=0;k<3;k++)sndTone(4400,t+k*.07,.04,v,'sine');}
    else if(wet&&Math.random()<.6){   // quelques gouttes, très doucement
      for(let k=0;k<3;k++)sndNoise(t+Math.random()*.8,.05,.012,3000,'bandpass');}
  }
  if(S.set.snd&&S.set.amb!==false&&!SND.muted)ambFrame(t,zoom,day,wet);   // v6 : sons selon l'endroit regardé
  if(S.set.mus)musicStep(t);   // v5 : musique au choix (douce, piano, lo-fi, nature, rétro)
}
function sndResume(){if(SND.ctx&&SND.ctx.state==='suspended')SND.ctx.resume().catch(()=>{});sndVolume();}
function sndSuspend(){if(SND.ctx){SND.master.gain.value=0;SND.ctx.suspend().catch(()=>{});}}
function sndButton(){const b=$('cty-snd');if(!b)return;const on=(S.set.snd||S.set.mus)&&!SND.muted;b.innerHTML=`<span class="ms">${on?'volume_up':'volume_off'}</span>`;b.classList.toggle('active',!on);b.title=on?'Couper le son':'Activer les sons d’ambiance';}
function sndToggle(){
  if(!(S.set.snd||S.set.mus)){S.set.snd=true;SND.muted=false;}else SND.muted=!SND.muted;
  sndInit();sndResume();sndVolume();sndButton();save();
  if(!SND.muted)toast('Sons d’ambiance activés (Réglages → Son pour la musique et le volume).','volume_up');
}

// =========================================================
// Timelapse : une petite carte de la ville chaque mois, rejouée en accéléré
// =========================================================
const TL_KEY='kcu_city_tl',TL_MAX=96;
const TL_COL=['#9cc97a','#4aa6c8','#8a9097','#5d646c','#7fcf8f','#2f9e63','#5ea8e8','#e2b84a','#a58be0','#e9e4da','#6dbd55','#3e7d47','#b8a98a','#e7a0b8'];
function tlCode(i){
  if(ter[i]&&!road[i])return 1;if(road[i])return road[i]===1?2:3;if(svcAt[i]){const s=SV.get(svcAt[i]),c=s&&BT[s.t].cat;return c==='parcs'||c==='loisirs'?10:9;}
  if(zone[i]&&lvl[i]){if(zone[i]===ZR)return lvl[i]>=3?5:4;return zone[i]===ZC?6:zone[i]===ZI?7:8;}
  if(hill[i]||mtn[i])return 12;if(deco[i])return 13;if(tree[i])return 11;return 0;
}
function tlEncode(){const out=[];let prev=tlCode(0),n=1;for(let i=1;i<NN;i++){const c=tlCode(i);if(c===prev&&n<255)n++;else{out.push(n,prev);prev=c;n=1;}}out.push(n,prev);return b64enc(new Uint8Array(out));}
function tlDecode(str){const u=b64dec(str),a=new Uint8Array(NN);let p=0;for(let k=0;k+1<u.length;k+=2){a.fill(u[k+1],p,Math.min(NN,p+u[k]));p+=u[k];}return a;}
function tlLoad(){try{const o=JSON.parse(localStorage.getItem(TL_KEY)||'null');return o&&Array.isArray(o.f)?o:{f:[]};}catch(e){return{f:[]};}}
function tlMaybeSnap(force){
  if(!S||VISIT)return;const m=(S.day/30)|0;if(!force&&S.tlLast===m)return;
  const o=tlLoad();o.f.push([S.day,ST.pop,tlEncode(),S.biome||'tempere']);
  if(o.f.length>TL_MAX){const keep=o.f.slice(-TL_MAX/2),old=o.f.slice(0,-TL_MAX/2).filter((_,k)=>k%2===0);o.f=old.concat(keep);}
  try{localStorage.setItem(TL_KEY,JSON.stringify(o));S.tlLast=m;}catch(e){/* mémoire pleine : on garde la ville, pas le timelapse */}
}
let TLP=null;   // lecture en cours {k, play, timer}
function panelTimelapse(){
  const o=tlLoad(),n=o.f.length;
  if(!TLP)TLP={k:Math.max(0,n-1),play:false};
  return head('slow_motion_video','Timelapse',n?`${n} image${n>1?'s':''} : une par mois de jeu`:'Les images arrivent au fil des mois','#0e8c87')
    +(n?`<canvas class="cty-tl" id="cty-tl" width="320" height="320"></canvas><div class="cty-tl-l" id="cty-tl-l"></div>
      <input class="cty-tl-r" type="range" min="0" max="${n-1}" value="${TLP.k}" data-tl="1" aria-label="Moment du timelapse">
      <div class="cty-tl-b"><button class="cty-btn" data-act="tlplay"><span class="ms">${TLP.play?'pause':'play_arrow'}</span>${TLP.play?'Pause':'Lecture'}</button><button class="cty-btn ghost" data-act="tlsnap"><span class="ms">add_a_photo</span>Image maintenant</button></div>`
      :`<p class="cty-p">Chaque mois de jeu, une petite carte de ta ville est enregistrée. Reviens dans quelques mois pour voir ta ville grandir en accéléré !</p><button class="cty-btn" data-act="tlsnap"><span class="ms">add_a_photo</span>Prendre la première image</button>`);
}
function tlDraw(){
  const cv=$('cty-tl');if(!cv||!TLP)return;const o=tlLoad(),f=o.f[TLP.k];if(!f)return;
  const a=tlDecode(f[2]),x=cv.getContext('2d'),s=cv.width/N;
  for(let i=0;i<NN;i++){x.fillStyle=TL_COL[a[i]]||TL_COL[0];x.fillRect((i%N)*s,((i/N)|0)*s,s+.5,s+.5);}
  const d=f[0],m=(d/30)|0;const l=$('cty-tl-l');if(l)l.textContent=`${MONTHS[m%12]} ${2026+((m/12)|0)} · ${fmt(f[1])} habitants`;
  const r=ROOT&&ROOT.querySelector('[data-tl]');if(r)r.value=TLP.k;
}
function tlTick(){
  if(PANEL!=='timelapse'||!TLP||!TLP.play){if(TLP)TLP.timer=null;return;}
  const n=tlLoad().f.length;TLP.k=(TLP.k+1)%Math.max(1,n);tlDraw();TLP.timer=setTimeout(tlTick,TLP.k===n-1?1400:220);
}

// =========================================================
// Succès et badges
// =========================================================
function cnt(arr,f){let n=0;for(let i=0;i<NN;i++)if(f?f(arr[i]):arr[i])n++;return n;}
const ACH=[
  {id:'pop100',icon:'groups',n:'Premiers habitants',d:'Atteins 100 habitants',ok:()=>ST.pop>=100,r:500},
  {id:'pop1000',icon:'groups',n:'Un vrai bourg',d:'Atteins 1 000 habitants',ok:()=>ST.pop>=1000,r:2000},
  {id:'pop5000',icon:'location_city',n:'Grande ville',d:'Atteins 5 000 habitants',ok:()=>ST.pop>=5000,r:5000},
  {id:'pop10000',icon:'location_city',n:'10 000 habitants',d:'Une vraie métropole',ok:()=>ST.pop>=10000,r:10000},
  {id:'hap80',icon:'sentiment_very_satisfied',n:'Ville heureuse',d:'80 % de bonheur avec au moins 300 habitants',ok:()=>ST.pop>=300&&ST.hap>=80,r:3000},
  {id:'nopol',icon:'eco',n:'Zéro pollution',d:'500 habitants et aucune maison polluée',ok:()=>{if(ST.pop<500)return false;for(let i=0;i<NN;i++)if(zone[i]===ZR&&lvl[i]&&pol[i]>15)return false;return true;},r:3000},
  {id:'streak7',icon:'local_fire_department',n:'Une semaine de révisions',d:'7 jours de révision d’affilée sur Kiné+',ok:()=>typeof stats!=='undefined'&&(stats.streak|0)>=7,r:1500},
  {id:'streak30',icon:'local_fire_department',n:'30 jours d’affilée',d:'30 jours de révision d’affilée sur Kiné+',ok:()=>typeof stats!=='undefined'&&(stats.streak|0)>=30,r:8000},
  {id:'quiz50',icon:'quiz',n:'Maire studieux',d:'50 bonnes réponses au Défi du maire',ok:()=>(S.quizTot|0)>=50,r:2000},
  {id:'quiz200',icon:'quiz',n:'Maire encyclopédique',d:'200 bonnes réponses au Défi du maire',ok:()=>(S.quizTot|0)>=200,r:6000},
  {id:'qzs10',icon:'bolt',n:'En feu !',d:'Une série de 10 bonnes réponses d’affilée',ok:()=>(S.qzBest|0)>=10,r:2000},
  {id:'pat5',icon:'healing',n:'Kiné de quartier',d:'Guéris 5 patients',ok:()=>(S.stat.patOk|0)>=5,r:2000},
  {id:'pat25',icon:'healing',n:'Kiné de référence',d:'Guéris 25 patients',ok:()=>(S.stat.patOk|0)>=25,r:6000},
  {id:'crisis',icon:'verified',n:'Gestion de crise',d:'Arrête une crise sanitaire',ok:()=>(S.stat.crisisOk|0)>=1,r:2500},
  {id:'rep10',icon:'build',n:'Bricoleur révisant',d:'Répare 10 bâtiments en révisant',ok:()=>(S.stat.repOk|0)>=10,r:2500},
  {id:'fest',icon:'festival',n:'Festivalier',d:'Vis un festival des partiels',ok:()=>(S.stat.fest|0)>=1,r:1000},
  {id:'tram',icon:'tram',n:'Ding ding !',d:'20 cases de rails de tram et un arrêt',ok:()=>(ST.rail|0)>=20&&svcCount('tramstop')>0,r:2000},
  {id:'metro',icon:'subway',n:'Réseau souterrain',d:'Trace 2 lignes de métro',ok:()=>(S.mlines||[]).length>=2,r:3000},
  {id:'rx',icon:'roundabout_right',n:'Rond-point mania',d:'Pose 3 ronds-points',ok:()=>cnt(rx,v=>v===2)>=3,r:1000},
  {id:'dist',icon:'holiday_village',n:'Urbaniste',d:'Crée 3 quartiers nommés',ok:()=>Object.keys(S.dists).length>=3,r:1500},
  {id:'deco',icon:'local_florist',n:'Ville fleurie',d:'Pose 30 éléments de décor',ok:()=>cnt(deco)>=30,r:1500},
  {id:'hill',icon:'landscape',n:'Paysagiste',d:'Modèle 10 collines',ok:()=>cnt(hill)>=10,r:1000},
  {id:'lake',icon:'water',n:'Le lac du maire',d:'Creuse 10 cases d’eau',ok:()=>(S.stat.dug|0)>=10,r:1000},
  {id:'trade',icon:'local_shipping',n:'Exportateur',d:'1 000 § de commerce en un mois',ok:()=>!!S.tradeLast&&S.tradeLast.tot>=1000,r:3000},
  {id:'eco3',icon:'agriculture',n:'Terroir',d:'Une ferme, une scierie et un port de pêche',ok:()=>svcCount('ferme')&&svcCount('scierie')&&svcCount('peche'),r:2500},
  {id:'air',icon:'flight',n:'Décollage !',d:'Construis l’aéroport',ok:()=>svcCount('aeroport')>0,r:5000},
  {id:'mon3',icon:'emoji_events',n:'Ville monumentale',d:'3 monuments Kiné+',ok:()=>BLD.filter(b=>b.lvl&&svcCount(b.id)).length>=3,r:5000},
  {id:'rich',icon:'savings',n:'Caisses pleines',d:'100 000 § en caisse',ok:()=>S.money>=100000,r:0},
  {id:'visit',icon:'travel_explore',n:'Touriste',d:'Visite la ville d’un ami',ok:()=>(S.stat.visits|0)>=1,r:1000},
  {id:'twin',icon:'handshake',n:'Villes jumelles',d:'Jumelle ta ville avec celle d’un ami',ok:()=>!!S.twin,r:1500},
  {id:'duel',icon:'sports_kabaddi',n:'Champion du duel',d:'Gagne un duel du maire',ok:()=>(S.stat.duelWins|0)>=1,r:2000},
  {id:'year',icon:'calendar_month',n:'Un an de mandat',d:'Joue 360 jours',ok:()=>S.day>=360,r:2000}
];
function checkAch(){
  if(!S||VISIT)return;let got=0;
  for(const a of ACH){if(S.ach[a.id])continue;let ok=false;try{ok=!!a.ok();}catch(e){}
    if(ok){S.ach[a.id]=S.day||1;S.money+=a.r;got++;news(a.icon,'Succès débloqué : '+a.n,a.d+(a.r?` · +${money(a.r)}`:''),'good');
      toast(`<b>Succès débloqué</b> : ${esc(a.n)}${a.r?` · +${money(a.r)}`:''}`,'military_tech');if(a.r)floatMoney(a.r);}}
  if(got){fireworks(2+got);refreshHUD(true);}
}
function panelAch(){
  const n=ACH.filter(a=>S.ach[a.id]).length;
  return head('military_tech','Succès',`${n} / ${ACH.length} débloqués`,'#c9a227')
    +`<div class="cty-ach">${ACH.map(a=>{const ok=!!S.ach[a.id];return `<div class="cty-achi${ok?' ok':''}" title="${esc(a.d)}"><span class="ms">${ok?a.icon:'lock'}</span><b>${esc(a.n)}</b><small>${esc(a.d)}${a.r?` · ${money(a.r)}`:''}</small></div>`;}).join('')}</div>`;
}

// =========================================================
// Catastrophes (désactivées par défaut) : rien n'est perdu, tout se reconstruit gratuitement
// =========================================================
let TORN=null;
function catMonth(){
  if(VISIT||!S.set.cat||ST.pop<300||S.day<(S.catNext||600)||TORN||Math.random()>.3)return;
  S.catNext=S.day+300+((Math.random()*300)|0);
  if(Math.random()<.5){
    const a=MS[S.ms].area,o=(N-a)>>1,side=Math.random()<.5;
    const z0=o+Math.random()*a,z1=o+Math.random()*a;
    TORN=side?{x0:o-2,z0,x1:o+a+2,z1,t:0}:{x0:o+Math.random()*a,z0:o-2,x1:o+Math.random()*a,z1:o+a+2,t:0};
    news('cyclone','Une tornade traverse la ville !','Les bâtiments touchés seront reconstruits gratuitement.','alert');
    toast('<b>Tornade !</b> Les bâtiments touchés se reconstruiront gratuitement.','cyclone',{label:'Voir',fn:()=>flyTo((TORN.x0+TORN.x1)/2,(TORN.z0+TORN.z1)/2,40)});sndPlay('alert');sosStart('torn');
  }else{
    const set=[];for(let i=0;i<NN;i++)if(!ter[i]&&wdist[i]<=2&&inAreaI(i))set.push(i);
    if(!set.length)return;
    S.flood={u:S.day+20,tiles:set};S.flood.set=new Set(set);set.forEach(i=>{markG(i);});D.icons=D.lv=true;
    news('flood','Inondation au bord de l’eau','Les bâtiments près de l’eau attendent que la crue redescende (20 jours). Rien n’est détruit.','alert');
    toast('<b>Inondation</b> : la rivière déborde pour quelques jours. Rien n’est détruit.','flood');sndPlay('alert');sosStart('flood');
  }
}
function stepTornado(dt){
  const T=TORN,G=E.tornado;if(!T){G.visible=false;return;}
  T.t+=dt/22;const x=lerp(T.x0,T.x1,T.t)+Math.sin(T.t*20)*1.2,z=lerp(T.z0,T.z1,T.t)+Math.cos(T.t*17)*1.2;
  G.visible=true;G.position.set(x,0,z);G.rotation.y+=dt*6;G.children.forEach((c,k)=>c.rotation.y+=dt*(2+k));
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const X=Math.floor(x)+dx,Z=Math.floor(z)+dz;if(X<0||Z<0||X>=N||Z>=N)continue;const i=Z*N+X;
    if(Math.hypot(X+.5-x,Z+.5-z)>1.3)continue;
    if(lvl[i]&&zone[i]&&st[i]!==RUIN){st[i]=RUIN;tmr[i]=10;cap[i]=0;touch(i);D.util=D.icons=true;}
    if(tree[i]){tree[i]=0;D.trees=true;}
    const id=svcAt[i];if(id&&!svcDamaged(id)){S.dmg[id]=S.day+45;D.roads=true;}}
  if(T.t>=1){TORN=null;G.visible=false;simRefresh();news('cyclone','La tornade est passée','Les équipes réparent les bâtiments publics (45 jours) et les maisons se reconstruisent gratuitement.');}
}
function catDay(){
  if(S.flood&&S.flood.u<=S.day){const t=S.flood.tiles||[];S.flood=null;t.forEach(i=>markG(i));D.icons=D.lv=true;news('flood','La crue est terminée','Les habitants rentrent chez eux.');}
  let ch=false;for(const id in S.dmg)if(S.dmg[id]<=S.day){delete S.dmg[id];ch=true;}
  if(ch){D.roads=true;D.icons=true;}
}

// =========================================================
// Nouveaux outils : tram, métro, décor, terrain, carrefours, tampon, quartiers
// =========================================================
const TRAM_COST=30;
const EXT_TOOLS={
  tram:{msg:'Glisse le long d’une route pour poser des rails de tram (30 § / case)'},
  mline:{msg:'Touche une station de métro, puis une deuxième pour les relier (gratuit)'},
  deco:{msg:'Glisse pour poser du décor sur des cases libres'},
  terra:{msg:'Glisse sur le terrain'},
  rx:{msg:'Glisse sur des carrefours (3 ou 4 routes qui se croisent)'},
  stamp:{msg:'Glisse pour choisir la zone à copier (16 × 16 cases maximum)'},
  paste:{msg:'Touche le terrain pour coller · touche T (ou « Pivoter ») pour tourner'},
  district:{msg:'Glisse pour peindre le quartier'},
  undistrict:{msg:'Glisse pour retirer des cases de leur quartier'},
  lane:{msg:'Glisse le long d’une route'},
  ovp:{msg:'Glisse en ligne droite d’une route à une autre : le pont passe au-dessus de tout ce qui est entre les deux'}
};
const TERRA={hill:'Colline',flat:'Aplanir',dig:'Creuser',fill:'Remblayer'};
let CLIP=null,CLIPROT=0,_lastTool='inspect';
function extToolSet(id){
  const dv=id==='district'||id==='undistrict',was=_lastTool==='district'||_lastTool==='undistrict';
  if(dv!==was)redrawAllGround();
  if(id==='terra'&&TOOL.k)tip({hill:'Glisse pour monter une colline (60 § par niveau, 3 niveaux)',flat:'Glisse pour aplanir les collines (remboursé)',dig:'Glisse pour creuser un lac ou un canal (40 § / case)',fill:'Glisse sur l’eau pour la remblayer (40 § / case)'}[TOOL.k],'info',3000);
  if(id==='deco'&&DECO[TOOL.k])tip(`${DECO[TOOL.k].name} · ${money(DECO[TOOL.k].cost)} · ${DECO[TOOL.k].desc}`,'info',3000);
  _lastTool=id;
}
function decoOk(x,z){const i=z*N+x;return inArea(x,z)&&!ter[i]&&!road[i]&&!svcAt[i]&&!zone[i]&&!hill[i]&&!mtn[i]&&!deco[i];}
function isCross(i){if(!road[i]||road[i]===2||ter[i])return false;const x=i%N,z=(i/N)|0;return((z>0&&road[i-N])?1:0)+((z<N-1&&road[i+N])?1:0)+((x>0&&road[i-1])?1:0)+((x<N-1&&road[i+1])?1:0)>=3;}
function touchesRail(x0,z0,w,d){for(let z=z0-1;z<=z0+d;z++)for(let x=x0-1;x<=x0+w;x++){if(x<0||z<0||x>=N||z>=N)continue;if((x>=x0&&x<x0+w&&z>=z0&&z<z0+d))continue;if(rail[z*N+x])return true;}return false;}
function terraOk(k,i,x,z){
  if(!inArea(x,z))return false;
  if(k==='hill')return !ter[i]&&!road[i]&&!svcAt[i]&&!zone[i]&&!deco[i]&&!mtn[i]&&hill[i]<3;
  if(k==='flat')return hill[i]>0||mtn[i]>0;
  if(k==='dig')return !ter[i]&&!road[i]&&!svcAt[i]&&!zone[i]&&!deco[i]&&!hill[i]&&!mtn[i];
  if(k==='fill')return !!ter[i]&&!road[i];
  return false;
}
// copier-coller : rotation d'un quart de tour (r) d'un motif w × d
function rotXY(dx,dz,w,d,r){switch(r&3){case 1:return[d-1-dz,dx];case 2:return[w-1-dx,d-1-dz];case 3:return[dz,w-1-dx];default:return[dx,dz];}}
function clipDims(){const r=CLIPROT&1;return r?[CLIP.d,CLIP.w]:[CLIP.w,CLIP.d];}
function clipPlan(ax,az){
  const [W,Dd]=clipDims(),x0=ax-Math.floor(W/2),z0=az-Math.floor(Dd/2),T=[];let cost=0,skip=0;
  for(const t of CLIP.t){const [dx,dz]=rotXY(t.dx,t.dz,CLIP.w,CLIP.d,CLIPROT),x=x0+dx,z=z0+dz;
    if(x<0||z<0||x>=N||z>=N||!inArea(x,z)){skip++;continue;}const i=z*N+x;let ok=true,c=0;
    if(t.road){if(svcAt[i]||hill[i]||mtn[i])ok=false;else if(!road[i])c+=roadPrice(t.road===3,ter[i]);else if(t.road===3&&road[i]===1)c+=roadPrice(true,ter[i])-roadPrice(false,ter[i]);
      if(ok&&t.rail&&!rail[i])c+=TRAM_COST;if(ok&&t.rx&&rx[i]!==t.rx)c+=RX_COST[t.rx];}
    else if(t.zone){if(!zoneOk(x,z))ok=false;}
    else if(t.deco){if(!decoOk(x,z))ok=false;else c+=DECO[t.deco].cost;}
    else if(t.hill){if(!terraOk('hill',i,x,z))ok=false;else c+=HILL_COST*Math.max(0,t.hill-hill[i]);}
    else if(t.tree){if(!zoneOk(x,z)||zone[i])ok=false;else c+=5;}
    if(!ok){skip++;continue;}T.push({t,i,x,z,c});cost+=c;}
  const Sv=[];
  for(const s of CLIP.s){const b=BT[s.t];if(!b||!unlocked(b).ok){skip++;continue;}
    // coin du bâtiment après rotation
    const pts=[[s.dx,s.dz],[s.dx+b.w-1,s.dz+b.d-1]].map(([a,c])=>rotXY(a,c,CLIP.w,CLIP.d,CLIPROT));
    const sx=x0+Math.min(pts[0][0],pts[1][0]),sz=z0+Math.min(pts[0][1],pts[1][1]);let ok=true;
    for(let z=sz;z<sz+b.d&&ok;z++)for(let x=sx;x<sx+b.w;x++){if(x<0||z<0||x>=N||z>=N||!inArea(x,z)){ok=false;break;}const i=z*N+x;if(ter[i]||svcAt[i]||hill[i]||mtn[i]||(road[i]&&!T.some(e=>e.i===i&&!e.t.road))){ok=false;break;}
      if(T.some(e=>e.i===i&&e.t.road)){ok=false;break;}}
    if(!ok){skip++;continue;}Sv.push({b,x:sx,z:sz});cost+=svcPrice(b);}
  return{T,Sv,cost,skip,x0,z0,W,Dd};
}
function extPreview(d){
  const id=TOOL.id;if(!EXT_TOOLS[id])return false;
  if(id==='lane')return lanePreview(d);
  const list=[];
  if(id==='ovp'){const P_=ovpPlan(d.x0,d.z0,d.x1,d.z1);setPreview(P_.T.map(t=>[t.X,t.Z,!t.g?'#ff4d4d':(t.k===0||t.k===P_.n)?'#ffd166':'#7cc7ff']));
    tip(P_.ok?`Pont routier · ${P_.n+1} cases · ${money(P_.cost)}`:P_.why,P_.ok&&P_.cost<=S.money?'':'bad');return true;}
  if(id==='tram'){
    const pts=roadPath(d);let cost=0,bad=0;
    for(const [x,z] of pts){const i=z*N+x,ok=(road[i]===1||road[i]===3);if(!ok)bad++;else if(!rail[i])cost+=TRAM_COST;list.push([x,z,!ok?'#ff4d4d':rail[i]?'#9fb4c7':'#ffb347']);}
    setPreview(list);
    if(bad)tip('Les rails se posent sur des routes ou des avenues (pas sur l’autoroute)','bad');else tip(`Rails de tram · ${pts.length} case${pts.length>1?'s':''} · ${money(cost)}`,cost>S.money?'bad':'');
    return true;}
  if(id==='mline'){const i=d.z1*N+d.x1,s=svcAt[i]&&SV.get(svcAt[i]),a=TOOL.a&&SV.get(TOOL.a);
    for(const t of[a,s])if(t&&t.t==='metro')for(let z=t.z;z<t.z+t.d;z++)for(let x=t.x;x<t.x+t.w;x++)list.push([x,z,t===a?'#ffd166':'#3ddc84']);
    setPreview(list);tip(a?(s&&s.t==='metro'&&s!==a?'Relier ces deux stations':'Touche une deuxième station de métro'):s&&s.t==='metro'?'Touche pour choisir cette station':'Touche une station de métro','info');return true;}
  if(id==='paste'){
    if(!CLIP){setPreview([]);tip('Copie d’abord une zone avec le tampon','bad');return true;}
    const P_=clipPlan(d.x1,d.z1);
    for(const e of P_.T){const t=e.t;list.push([e.x,e.z,t.road?(t.rail?'#ffb347':'#9fb4c7'):t.zone?ZONES[t.zone].col:t.deco?'#e6397a':t.hill?'#7fb069':'#2e7d32']);}
    for(const s of P_.Sv)for(let z=s.z;z<s.z+s.b.d;z++)for(let x=s.x;x<s.x+s.b.w;x++)list.push([x,z,'#3ddc84']);
    setPreview(list);tip(`Coller · ${money(P_.cost)}${P_.skip?` · ${P_.skip} élément${P_.skip>1?'s':''} ignoré${P_.skip>1?'s':''} (place prise)`:''} · T pour pivoter`,P_.cost>S.money?'bad':'');return true;}
  let n=0,cost=0;const tiles=rectTiles(d);
  if(id==='stamp'){const w=Math.abs(d.x1-d.x0)+1,h=Math.abs(d.z1-d.z0)+1,big=w>16||h>16;for(const [x,z] of tiles)list.push([x,z,big?'#ff4d4d':'#7cc7ff']);
    setPreview(list);tip(big?'Trop grand : 16 × 16 cases maximum':`Copier ${w} × ${h} cases`,big?'bad':'');return true;}
  for(const [x,z] of tiles){const i=z*N+x;let col=null;
    if(id==='deco'){if(decoOk(x,z)){col='#e6397a';n++;cost+=DECO[TOOL.k].cost;}}
    else if(id==='terra'){if(terraOk(TOOL.k,i,x,z)){col=TOOL.k==='flat'?'#ff8a65':TOOL.k==='dig'?'#4fc3f7':TOOL.k==='fill'?'#c9a77c':'#7fb069';n++;cost+=TOOL.k==='flat'?mtn[i]*MTN_COST-hill[i]*HILL_COST:TOOL.k==='hill'?HILL_COST:DIG_COST;}}
    else if(id==='rx'){if(isCross(i)&&rx[i]!==TOOL.k){col='#ffd166';n++;cost+=RX_COST[TOOL.k]-(rx[i]?RX_COST[rx[i]]:0);}else if(road[i])col='#ffffff';}
    else if(id==='district'){if(inArea(x,z)){col=distCol(TOOL.k);n++;}}
    else if(id==='undistrict'){if(dist[i]){col='#ff8a65';n++;}}
    if(col)list.push([x,z,col]);}
  setPreview(list);
  if(id==='deco')tip(`${DECO[TOOL.k].name} · ${n} case${n>1?'s':''} · ${money(cost)}`,cost>S.money||!n?'bad':'');
  else if(id==='terra')tip(`${TERRA[TOOL.k]} · ${n} case${n>1?'s':''} · ${cost<0?'+'+money(-cost)+' remboursés':money(cost)}`,cost>S.money||!n?'bad':'');
  else if(id==='rx')tip(n?`${TOOL.k===2?'Rond-point':'Feux'} · ${n} carrefour${n>1?'s':''} · ${money(cost)}`:'Glisse sur un carrefour (3 ou 4 routes)',n&&cost<=S.money?'':'bad');
  else if(id==='district'){const q=S.dists[TOOL.k];tip(`${q?q.n:'Quartier'} · ${n} case${n>1?'s':''}`,n?'':'bad');}
  else if(id==='undistrict')tip(`Retirer ${n} case${n>1?'s':''} de leur quartier`,n?'':'bad');
  return true;
}
function extToolUp(d){
  const id=TOOL.id;if(!EXT_TOOLS[id])return false;
  if(id==='lane')return laneToolUp(d);
  if(id==='ovp'){const P_=ovpPlan(d.x0,d.z0,d.x1,d.z1);if(!P_.ok){if(P_.n>0)toast(esc(P_.why),'block');return true;}if(S.money<P_.cost){noMoney(P_.cost);return true;}
    actBegin();ACT.ovs=S.ovs.slice();for(const t of P_.T)if(t.k>0&&t.k<P_.n&&tree[t.i]){rec(t.i);tree[t.i]=0;D.trees=true;}
    S.ovs.push({a:P_.a,b:P_.b,d:P_.d,n:P_.n});S.money-=P_.cost;actEnd(P_.cost,'pont routier');ovpChanged();simRefresh();afterAction();floatMoney(-P_.cost);sndPlay('build');checkAch();
    toast('Pont routier construit : les voitures passent par-dessus !','alt_route');return true;}
  if(id==='tram'){
    const pts=roadPath(d),list=[];let cost=0;for(const [x,z] of pts){const i=z*N+x;if((road[i]===1||road[i]===3)&&!rail[i]){list.push(i);cost+=TRAM_COST;}}
    if(!list.length)return true;if(S.money<cost){noMoney(cost);return true;}
    actBegin();list.forEach(i=>{rec(i);rail[i]=1;touch(i,true);});S.money-=cost;actEnd(cost,'rails de tram');
    D.rail=true;D.cov=true;simRefresh();afterAction();floatMoney(-cost);sndPlay('build');
    if(!svcCount('tramstop'))toast('Rails posés ! Ajoute un <b>arrêt de tram</b> contre les rails (Transports) pour que les trams circulent.','tram');
    return true;}
  if(id==='mline'){
    const i=d.z1*N+d.x1,s=svcAt[i]&&SV.get(svcAt[i]);
    if(!s||s.t!=='metro'){toast('Touche une station de métro (Transports → Station de métro).','subway');return true;}
    if(!TOOL.a||!SV.get(TOOL.a)){TOOL.a=s.id;tip('Station choisie : touche maintenant une autre station','info');return true;}
    if(TOOL.a===s.id){TOOL.a=null;tip('Station désélectionnée','info',1500);return true;}
    const a=TOOL.a;TOOL.a=null;
    if(S.mlines.some(l=>(l[0]===a&&l[1]===s.id)||(l[1]===a&&l[0]===s.id))){toast('Ces deux stations sont déjà reliées.','subway');return true;}
    if(S.mlines.length>=12){toast('12 lignes au maximum.','subway');return true;}
    S.mlines.push([a,s.id]);E.mlDirty=true;D.cov=true;simRefresh();afterAction();sndPlay('build');
    toast(`<b>Ligne de métro ${S.mlines.length}</b> ouverte : les deux stations desservent plus loin.`,'subway');save();checkAch();return true;}
  if(id==='stamp'){
    const w=Math.abs(d.x1-d.x0)+1,h=Math.abs(d.z1-d.z0)+1;if(w>16||h>16){toast('Zone trop grande : 16 × 16 cases maximum.','block');return true;}
    const x0=Math.min(d.x0,d.x1),z0=Math.min(d.z0,d.z1),T=[],Sv=[],seen=new Set();
    for(let z=z0;z<z0+h;z++)for(let x=x0;x<x0+w;x++){const i=z*N+x;
      if(svcAt[i]){const s=SV.get(svcAt[i]);if(s&&!seen.has(s.id)&&s.x>=x0&&s.z>=z0&&s.x+s.w<=x0+w&&s.z+s.d<=z0+h&&!BT[s.t].lvl&&!BT[s.t].unique&&!BT[s.t].trophy){seen.add(s.id);Sv.push({dx:s.x-x0,dz:s.z-z0,t:s.t});}continue;}
      const e={dx:x-x0,dz:z-z0};
      if(road[i]===1||road[i]===3){e.road=road[i];if(rail[i])e.rail=1;if(rx[i])e.rx=rx[i];}else if(zone[i])e.zone=zone[i];else if(deco[i])e.deco=deco[i];else if(hill[i])e.hill=hill[i];else if(tree[i]&&!ter[i])e.tree=1;else continue;
      T.push(e);}
    if(!T.length&&!Sv.length){toast('Rien à copier ici.','content_copy');return true;}
    CLIP={w,d:h,t:T,s:Sv};CLIPROT=0;setTool('paste');refreshTray();
    toast(`Copié (${w} × ${h}) ! Touche le terrain pour coller. Les monuments et bâtiments uniques ne sont pas copiés.`,'content_copy');return true;}
  if(id==='paste'){
    if(!CLIP)return true;const P_=clipPlan(d.x1,d.z1);if(!P_.T.length&&!P_.Sv.length){toast('Rien ne peut être collé ici.','block');return true;}
    if(S.money<P_.cost){noMoney(P_.cost);return true;}
    actBegin();_clrBack=0;
    for(const e of P_.T){const t=e.t,i=e.i;
      if(t.road){if(!road[i]){clearTile(i);road[i]=t.road;}else if(t.road===3&&road[i]===1){rec(i);road[i]=3;}else rec(i);if(t.rail)rail[i]=1;if(t.rx)rx[i]=t.rx;touch(i,true);}
      else if(t.zone){rec(i);zone[i]=t.zone;lvl[i]=0;st[i]=0;tmr[i]=0;touch(i);}
      else if(t.deco){rec(i);deco[i]=t.deco;tree[i]=0;touch(i);}
      else if(t.hill){rec(i);hill[i]=t.hill;tree[i]=0;touch(i);}
      else if(t.tree){rec(i);tree[i]=Math.min(3,tree[i]+2);markG(i);}}
    for(const s of P_.Sv){for(let z=s.z;z<s.z+s.b.d;z++)for(let x=s.x;x<s.x+s.b.w;x++)clearTile(z*N+x);
      const sv=addSvc({t:s.b.id,x:s.x,z:s.z,rot:svcRot(s.x,s.z,s.b.w,s.b.d)});ACT.add.push(sv.id);}
    const net=P_.cost-_clrBack;_clrBack=0;S.money-=net;actEnd(net,'coller');
    D.roads=D.lights=D.util=D.pol=D.trees=D.cov=D.rail=D.deco=true;simRefresh();afterAction();floatMoney(-net);sndPlay('build');
    if(P_.skip)toast(`${P_.skip} élément${P_.skip>1?'s':''} non collé${P_.skip>1?'s':''} : la place était prise.`,'content_paste');
    return true;}
  const tiles=rectTiles(d);
  if(id==='deco'){const list=[];for(const [x,z] of tiles)if(decoOk(x,z))list.push(z*N+x);const cost=list.length*DECO[TOOL.k].cost;if(!list.length)return true;if(S.money<cost){noMoney(cost);return true;}
    actBegin();list.forEach(i=>{rec(i);deco[i]=TOOL.k;if(tree[i]){tree[i]=0;D.trees=true;}touch(i);});S.money-=cost;actEnd(cost,DECO[TOOL.k].name.toLowerCase());
    D.cov=D.deco=true;if(TOOL.k===6)D.pol=true;simRefresh();afterAction();floatMoney(-cost);sndPlay('build');checkAch();return true;}
  if(id==='terra'){const k=TOOL.k,list=[];let cost=0;
    for(const [x,z] of tiles){const i=z*N+x;if(terraOk(k,i,x,z)){list.push(i);cost+=k==='flat'?mtn[i]*MTN_COST-hill[i]*HILL_COST:k==='hill'?HILL_COST:DIG_COST;}}
    if(!list.length)return true;if(cost>0&&S.money<cost){noMoney(cost);return true;}
    actBegin();
    for(const i of list){rec(i);if(k==='hill'){hill[i]++;if(tree[i]){tree[i]=0;D.trees=true;}}else if(k==='flat'){hill[i]=0;mtn[i]=0;}else if(k==='dig'){ter[i]=1;if(tree[i]){tree[i]=0;D.trees=true;}S.stat.dug=(S.stat.dug|0)+1;}else ter[i]=0;touch(i,true);}
    S.money-=cost;actEnd(cost,TERRA[k].toLowerCase());
    if(k==='dig'||k==='fill'||k==='flat')terrainChanged();
    D.cov=D.lv=true;simRefresh();afterAction();floatMoney(-cost);sndPlay('build');checkAch();return true;}
  if(id==='rx'){const list=[];let cost=0;for(const [x,z] of tiles){const i=z*N+x;if(isCross(i)&&rx[i]!==TOOL.k){list.push(i);cost+=RX_COST[TOOL.k]-(rx[i]?RX_COST[rx[i]]:0);}}
    if(!list.length){toast('Pose-le sur un carrefour : 3 ou 4 routes qui se croisent.','roundabout_right');return true;}if(S.money<cost){noMoney(cost);return true;}
    actBegin();list.forEach(i=>{rec(i);rx[i]=TOOL.k;touch(i,true);});S.money-=cost;actEnd(cost,TOOL.k===2?'rond-point':'feux');
    recomputeTraffic();D.lv=true;simRefresh();afterAction();floatMoney(-cost);sndPlay('build');checkAch();if(VIEW==='trf')E.viewStale=true;return true;}
  if(id==='district'||id==='undistrict'){const list=[];for(const [x,z] of tiles){const i=z*N+x;if(id==='district'?inArea(x,z)&&dist[i]!==TOOL.k:dist[i])list.push(i);}
    if(!list.length)return true;actBegin();
    list.forEach(i=>{rec(i);dist[i]=id==='district'?TOOL.k:0;const x=i%N;for(const j of[i,x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN)markG(j);});
    actEnd(0,'quartier');distCleanup();D.lv=D.pol=D.util=true;recomputeTraffic();simRefresh();afterAction();distLabels(true);checkAch();return true;}
  return true;
}
function terrainChanged(){
  wdist.fill(255);const q=[];for(let i=0;i<NN;i++)if(ter[i]){wdist[i]=0;q.push(i);}
  for(let h=0;h<q.length;h++){const i=q[h],d=wdist[i];if(d>=4)continue;const x=i%N;for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&wdist[j]>d+1){wdist[j]=d+1;q.push(j);}}
  if(E){rebuildBoats();rebuildWaterDepth();E.mtnDirty=true;}D.lv=true;
}
function extAfterUndo(){terrainChanged();D.rail=D.deco=true;distCleanup();recomputeTraffic();if(E){E.mlDirty=true;distLabels(true);}}
function distCleanup(){const used=new Set();for(let i=0;i<NN;i++)if(dist[i])used.add(dist[i]);for(const id in S.dists)if(!used.has(+id)&&!(TOOL.id==='district'&&TOOL.k===+id))delete S.dists[id];}
function distNew(){
  let id=1;while(S.dists[id]&&id<15)id++;if(S.dists[id]){toast('15 quartiers au maximum.','holiday_village');return null;}
  const usedN=new Set(Object.values(S.dists).map(d=>d.n)),n=DIST_NAMES.find(x=>!usedN.has(x))||('Quartier '+id);
  S.dists[id]={n,c:id-1,r:{}};return id;
}
// étiquettes flottantes des quartiers (HTML au-dessus de la scène)
function distLabels(force){
  const box=$('cty-labels');if(!box||!E)return;
  if(force||!E.distC||E.t-(E.distCT||0)>3){E.distCT=E.t;const acc={};for(let i=0;i<NN;i++){const d=dist[i];if(!d)continue;const a=acc[d]||(acc[d]=[0,0,0]);a[0]+=i%N+.5;a[1]+=((i/N)|0)+.5;a[2]++;}
    E.distC=Object.entries(acc).filter(([id])=>S.dists[id]).map(([id,a])=>({id:+id,x:a[0]/a[2],z:a[1]/a[2],n:a[2]}));
    box.innerHTML=E.distC.map(c=>`<span data-d="${c.id}" style="--c:${distCol(c.id)}">${esc(S.dists[c.id].n)}</span>`).join('');}
  const show=S.set.lbl&&(CAM.dist>13||TOOL.id==='district'||VIEW==='dist')&&!FOLLOW;box.style.display=show?'':'none';if(!show)return;
  const W=E.stage.clientWidth,H=E.stage.clientHeight,v=_lblV;
  for(const c of E.distC){const el=box.querySelector(`[data-d="${c.id}"]`);if(!el)continue;v.set(c.x,.6,c.z).project(E.camera);
    if(v.z>1||c.n<2){el.style.display='none';continue;}el.style.display='';el.style.transform=`translate(${((v.x+1)/2*W).toFixed(0)}px,${((1-v.y)/2*H).toFixed(0)}px) translate(-50%,-50%)`;}
}
const _lblV=new THREE.Vector3();

// ── Menus du bas ──
function extTray(cat,list){
  if(cat==='transports')return list.concat([
    {k:'x:tram:',icon:'tram',name:'Rails de tram',cost:'30 § / case',lock:S.ms<2?MS[2].name:null,desc:'Glisse le long d’une route. Ajoute ensuite des arrêts de tram : les trams circulent et désengorgent les rues.'},
    {k:'x:mline:',icon:'subway',name:'Ligne de métro',cost:'Gratuit',lock:svcCount('metro')<2?'2 stations':null,desc:'Relie deux stations de métro : elles desservent plus loin. Les rames se voient dans la vue Transports.'}]);
  if(cat==='decor')return Object.entries(DECO).map(([k,d])=>({k:'x:deco:'+k,icon:d.icon,name:d.name,cost:money(d.cost),desc:d.desc}))
    .concat([{k:'x:terra:hill',icon:'landscape',name:'Colline',cost:'60 § / niveau',desc:'Monte une colline (3 niveaux) : belle vue et valeur foncière autour.'},
      {k:'x:terra:flat',icon:'layers_clear',name:'Aplanir',cost:'Remboursé',desc:'Retire les collines (ce que tu as payé t’est rendu).'},
      {k:'x:terra:dig',icon:'water',name:'Creuser',cost:'40 § / case',desc:'Creuse un lac ou un canal : la vue sur l’eau fait grimper la valeur foncière.'},
      {k:'x:terra:fill',icon:'terrain',name:'Remblayer',cost:'40 § / case',desc:'Transforme de l’eau en terrain constructible.'}]);
  if(cat==='outils'){
    const L=[{k:'x:stamp:',icon:'content_copy',name:'Tampon : copier',cost:'Gratuit',desc:'Glisse sur un quartier que tu aimes pour le copier.'},
      {k:'x:paste:',icon:'content_paste',name:'Coller',cost:CLIP?`${CLIP.w} × ${CLIP.d}`:'—',lock:CLIP?null:'Copie d’abord',desc:'Colle la zone copiée (au prix des routes et bâtiments).'},
      {k:'x:rot:',icon:'rotate_90_degrees_ccw',name:'Pivoter',cost:'Touche T',lock:CLIP?null:'—',desc:'Fait tourner le motif à coller d’un quart de tour.'},
      {k:'x:district:new',icon:'add_location_alt',name:'Nouveau quartier',cost:'Gratuit',desc:'Crée un quartier, puis glisse pour le peindre.'}];
    for(const id in S.dists)L.push({k:'x:district:'+id,icon:'holiday_village',name:S.dists[id].n,cost:'Peindre',col:distCol(+id),desc:'Glisse pour agrandir ce quartier.'});
    L.push({k:'x:undistrict:',icon:'wrong_location',name:'Retirer du quartier',cost:'Gratuit',desc:'Glisse pour retirer des cases de leur quartier.'},
      {k:'x:panel:districts',icon:'tune',name:'Gérer les quartiers',cost:'Noms et règles',desc:'Renomme tes quartiers et choisis leurs règles (sans voitures, quartier vert…).'});
    return L;}
  return list;
}
function extTrayNote(cat){
  if(cat==='economie')return `<div class="cty-tray-note"><span class="ms">local_shipping</span>Fermes, scieries et ports vendent leur production aux villes voisines. La gare, le port de commerce et l’aéroport multiplient ces ventes.</div>`;
  if(cat==='decor')return `<div class="cty-tray-note"><span class="ms">local_florist</span>Le décor rend les rues plus agréables (loisirs, prestige). Démolir le décor rembourse tout.</div>`;
  return '';
}
function extPick(b,c){
  if(VISIT){toast('Tu visites la ville d’un ami : impossible d’y construire.','visibility');return;}
  if(b==='panel'){openPanel(c);return;}
  if(b==='rot'){if(!CLIP)return;CLIPROT=(CLIPROT+1)%4;setTool('paste');toast('Motif pivoté d’un quart de tour.','rotate_90_degrees_ccw');return;}
  if(b==='paste'&&!CLIP){toast('Copie d’abord une zone avec « Tampon : copier ».','content_copy');return;}
  if(b==='tram'&&S.ms<2){toast(`Le tram arrive au palier « ${MS[2].name} ».`,'lock');return;}
  if(b==='mline'&&svcCount('metro')<2){toast('Construis au moins deux stations de métro (Transports), puis relie-les.','subway');return;}
  if(b==='district'&&c==='new'){const id=distNew();if(!id)return;setTool('district',id);refreshTray();toast(`Nouveau quartier : <b>${esc(S.dists[id].n)}</b>. Glisse pour le peindre, puis « Gérer les quartiers » pour ses règles.`,'holiday_village');return;}
  setTool(b,c===''||c==null?null:isNaN(+c)?c:+c);
}
function extKey(k){
  if(k==='Escape'&&SPP_OPEN){spPanel(false);return true;}
  if(k==='Escape'&&FOLLOW){followStop();return true;}
  if((k==='t'||k==='T')&&TOOL.id==='paste'&&CLIP){CLIPROT=(CLIPROT+1)%4;tip('Motif pivoté','info',1200);return true;}
  return false;
}
function extInput(t){
  if(t.dataset.uic||t.dataset.uim){uiInput(t);return true;}
  if(t.dataset.spvol){SPV_T=performance.now();if(window.spVolumeInput)window.spVolumeInput(t.value);return true;}
  if(t.dataset.svren){const idx=savesIdx(),m=idx.find(x=>x.id===t.dataset.svren);if(m){m.name=t.value.slice(0,40)||m.name;try{savesPut(idx);}catch(e){}}return true;}
  if(t.dataset.tl){if(!TLP)TLP={k:0,play:false};TLP.k=+t.value|0;tlDraw();return true;}
  if(t.dataset.dname){const d=S.dists[t.dataset.dname];if(d){d.n=t.value.replace(/\s+/g,' ').slice(0,30)||d.n;distLabels(true);save();}return true;}
  return false;
}
function extPlaced(b,s){
  sndPlay('build');if(!S.cons)S.cons={};S.cons[s.id]=S.day+18;   // v5 : une grue pendant le chantier
  if(b.id==='metro'&&svcCount('metro')>=2)toast('Deux stations : relie-les avec <b>Transports → Ligne de métro</b>.','subway');
  if(b.cat==='economie'||b.trade)news(b.icon,`Inauguration : ${b.name}`,b.desc);
  if(b.trophy)fireworks(3,'Statue du duel inaugurée !');
  checkAch();
}

// =========================================================
// Panneaux
// =========================================================
function panelTrade(){
  tradeIncome();const L=S.tradeLast,nb=NEIGHBORS.find(n=>n.id===S.trade.city);
  const tb=[...SV.values()].filter(s=>BT[s.t].trade&&svcOK.get(s.id)).map(s=>[BT[s.t].name,BT[s.t].trade]);
  return head('local_shipping','Commerce avec les villes voisines',`Environ ${money(L.tot)} / mois`,'#0e8c87')
    +`<div class="cty-reward"><span class="ms">campaign</span><span><b>${esc(nb?nb.name:'Une ville voisine')}</b> réclame ce mois-ci : <b>${esc(GOODS[S.trade.want])}</b> (prix ×1,5)</span></div>`
    +`<div class="cty-sec">Ce que ta ville vend</div>`+rows(Object.keys(GOODS).map(k=>[k==='ind'?'factory':k==='agri'?'agriculture':k==='bois'?'forest':'set_meal',GOODS[k],`${fmt(L.g[k])} → ${money(L.lines[k])}`]))
    +`<div class="cty-sec">Transport des marchandises</div>`+rows([['add_road','Autoroute','×0,35'],...tb.map(([n,t])=>['train',n,'+'+String(t).replace('.',',')]),['functions','Multiplicateur total','×'+String(L.m).replace('.',',')]])
    +`<p class="cty-p small">L’industrie, les fermes, la scierie (selon les arbres autour) et le port de pêche produisent. La <b>gare</b> (Transports), le <b>port de commerce</b> et l’<b>aéroport</b> (Économie) font grimper le multiplicateur.</p>`
    +`<div class="cty-sec">Villes voisines</div><div class="cty-chips">${NEIGHBORS.map(n=>`<span class="on"><span class="ms">${n.icon}</span>${esc(n.name)}</span>`).join('')}</div>`;
}
function panelDistricts(){
  const ids=Object.keys(S.dists);
  if(!ids.length)return head('holiday_village','Quartiers','Aucun quartier pour l’instant')+`<p class="cty-p">Outils → <b>Nouveau quartier</b>, puis glisse sur la carte pour le peindre. Tu pourras ensuite le nommer et lui donner des règles.</p>`;
  const cnt={};for(let i=0;i<NN;i++)if(dist[i])cnt[dist[i]]=(cnt[dist[i]]||0)+1;
  return head('holiday_village','Quartiers',`${ids.length} quartier${ids.length>1?'s':''}`)
    +ids.map(id=>{const d=S.dists[id];return `<div class="cty-dist" style="--c:${distCol(+id)}"><div class="cty-dist-h"><button class="cty-dist-c" data-act="distcol" data-k="${id}" title="Changer la couleur"></button>
      <input data-dname="${id}" value="${esc(d.n)}" maxlength="30" aria-label="Nom du quartier"><button class="cty-px" data-act="distgo" data-k="${id}" title="Voir"><span class="ms">my_location</span></button></div>
      <small>${fmt(cnt[id]||0)} cases</small><div class="cty-rules">${DIST_RULES.map(r=>`<button class="cty-rule${d.r&&d.r[r.id]?' on':''}" data-act="distrule" data-k="${id}" data-r="${r.id}" title="${esc(r.desc)}"><span class="ms">${r.icon}</span>${esc(r.name)}</button>`).join('')}</div>
      <button class="cty-link danger" data-act="distdel" data-k="${id}">Supprimer ce quartier</button></div>`;}).join('')
    +`<p class="cty-p small">${DIST_RULES.map(r=>`<b>${esc(r.name)}</b> : ${esc(r.desc)}`).join('<br>')}</p>`;
}
function extInspectTile(i){
  if(road[i]||svcAt[i]||zone[i])return '';
  if(OVT[i]>=0){const o=S.ovs[OVT[i]];return head('alt_route','Pont routier',o?`${o.n+1} cases · ${OVK[i]===1||OVK[i]===(o&&o.n-1)?'rampe':'en hauteur'}`:'','#5d646c')+`<p class="cty-p">Les voitures y montent par un bout et redescendent par l’autre, au-dessus de tout ce qui est en dessous.</p><p class="cty-p small">Outil Démolir sur le pont pour le retirer : tout est remboursé (${money(o?OVP_COST*(o.n-1):0)}).</p>`;}
  {const G_=ghostMap();if(G_&&G_.has(i))return head('history','Ancien bâtiment',G_.get(i)?'Parc ou loisir':'Bâtiment public','#7c4dcc')+`<p class="cty-p">Ici se trouvait un bâtiment de ton ancienne ville (centrale, château d’eau, école, cabinet, parc…). Son prix t’a été rendu au changement de paysage : reconstruis-le avec la barre d’outils.</p><button class="cty-btn ghost" data-act="ghostclear"><span class="ms">layers_clear</span>Effacer tous les repères</button>`;}
  if(deco[i]&&DECO[deco[i]]){const d=DECO[deco[i]];return head(d.icon,esc(d.name),esc(d.desc))+rows([['payments','Prix',money(d.cost)]])+`<p class="cty-p small">Outil Démolir pour le retirer : il t’est remboursé.</p>`+distRow(i);}
  if(mtn[i]){const B=BIO();return head('landscape',B.mtnN||'Montagne',`Altitude ${200+mtn[i]*140} m`)+rows([['diamond','Valeur foncière autour','+5 (la vue)']])+`<p class="cty-p small">On ne peut rien construire ici. Décor → Aplanir pour le raser (${money(mtn[i]*MTN_COST)}).</p>`+distRow(i);}
  if(hill[i])return head('landscape','Colline',`Hauteur ${hill[i]} / 3`)+rows([['diamond','Valeur foncière autour',`+${hill[i]*2+2}`]])+`<p class="cty-p small">Décor → Aplanir pour la retirer (remboursé).</p>`+distRow(i);
  return '';
}
function distRow(i){const d=dist[i]&&S.dists[dist[i]];if(!d)return '';const R=DIST_RULES.filter(r=>d.r&&d.r[r.id]).map(r=>r.name);
  return `<div class="cty-distrow" style="--c:${distCol(dist[i])}"><span class="ms">holiday_village</span><span><b>${esc(d.n)}</b>${R.length?`<small>${esc(R.join(' · '))}</small>`:''}</span><button data-act="panel" data-p="districts">Gérer</button></div>`;}
function extInspectSvc(s){
  const b=BT[s.t];let h='';
  if(svcDamaged(s.id))h+=`<div class="cty-qfb ko"><b>Endommagé par la tornade</b> Réparé gratuitement dans ${S.dmg[s.id]-S.day} jours.</div>`;
  if(b.goods){const g=tradeGoods(),k=Object.keys(b.goods)[0];h+=rows([['inventory_2','Production',`${GOODS[k]} · ${s.t==='scierie'?`${fmt(treesNear(s,4))} arbres autour`:fmt(b.goods[k])+' / mois'}`],['work','Emplois',fmt(b.jobs)]]);void g;}
  else if(b.jobs)h+=rows([['work','Emplois',fmt(b.jobs)]]);
  if(b.trade)h+=rows([['local_shipping','Commerce',`multiplicateur +${String(b.trade).replace('.',',')}`]])+`<button class="cty-btn ghost" data-act="panel" data-p="trade"><span class="ms">local_shipping</span>Voir le commerce</button>`;
  if(s.t==='metro'){const L=(S.mlines||[]).map((l,k)=>[l,k]).filter(([l])=>l[0]===s.id||l[1]===s.id);
    h+=`<div class="cty-sec">Lignes de métro</div>`+(L.length?L.map(([l,k])=>`<div class="cty-row"><span class="ms" style="color:${ML_COLS[k%ML_COLS.length]}">subway</span><span>Ligne ${k+1}</span><button class="cty-link danger" data-act="mldel" data-k="${k}">Fermer</button></div>`).join(''):'<p class="cty-p small">Aucune ligne : relie-la à une autre station (Transports → Ligne de métro).</p>')
      +`<button class="cty-btn ghost" data-act="mlfrom" data-k="${s.id}"><span class="ms">add_link</span>Relier à une autre station</button>`;}
  h+=v6InspectSvc(s);
  return h+distRow(s.z*N+s.x);
}
function extInspectRoad(i){
  const R=[['traffic','Circulation',trf[i]>100?`Bouchons (${trf[i]} %)`:trf[i]>70?`Chargée (${trf[i]} %)`:`Fluide (${trf[i]} %)`,trf[i]>100?'bad':'']];
  if(rx[i])R.push([rx[i]===2?'roundabout_right':'traffic',rx[i]===2?'Rond-point':'Feux tricolores','Carrefour plus fluide']);
  if(rail[i])R.push(['tram','Rails de tram','Oui']);
  if(lane[i])R.push([lane[i]===1?'pedal_bike':'directions_walk',LANE_N[lane[i]],lane[i]===1?'Des vélos y roulent':'Sans voitures']);
  return rows(R)+(isCross(i)&&rx[i]!==2?`<button class="cty-btn ghost" data-act="rxhere" data-k="${i}"><span class="ms">roundabout_right</span>Rond-point ici · ${money(RX_COST[2]-(rx[i]?RX_COST[rx[i]]:0))}</button>`:'')+distRow(i);
}
function extInspectLotTop(i){
  let h='';
  if(isFlooded(i))h+=`<div class="cty-qfb ko"><b>Inondé</b> Les habitants attendent que l’eau redescende (${S.flood.u-S.day} jours). Rien n’est détruit.</div>`;
  if(S.pat&&S.pat.i===i)h+=`<div class="cty-reward"><span class="ms">${P_().patIc}</span><span><b>${esc(S.pat.name)}</b> habite ici et attend une consultation.</span><button class="cty-btn" data-act="panel" data-p="patient">Soigner</button></div>`;
  return h+repCard(i);
}
function extInspectLot(i){
  let h=distRow(i);
  if(zone[i]===ZR&&cap[i]&&st[i]===OK)h+=`<button class="cty-btn ghost" data-act="follow" data-k="${i}"><span class="ms">person_pin_circle</span>Suivre un habitant</button>`;
  if(trfN[i]>100)h+=`<p class="cty-p small">La rue devant est embouteillée : avenue, tram, métro ou rond-point aideraient.</p>`;
  return h;
}
function extIcons(L){
  if(VISIT)return;
  if(S.pat&&lvl[S.pat.i]){const i=S.pat.i;L.patient.push(i%N+.5,(TOP[i]||.5)+.7,((i/N)|0)+.5);}
  for(const r of S.rep||[])if(lvl[r.i]&&st[r.i]===OK)L.repair.push(r.i%N+.5,(TOP[r.i]||.5)+.32,((r.i/N)|0)+.5);
  if(S.crisis)L.crisis.push(S.crisis.x,2.6,S.crisis.z);
  if(S.flood&&S.flood.set){let n=0;for(const i of S.flood.set){if(lvl[i]&&n<60&&(i*7)%3===0){L.flood.push(i%N+.5,(TOP[i]||.5)+.32,((i/N)|0)+.5);n++;}}}
}

// =========================================================
// Interface : badges, bandeaux, météo, clics
// =========================================================
// ── Couleur de l'interface (v3.5, 12 nov. 2026) ──
// Couleur au choix pour la barre du haut, la colonne de droite, la caméra et la barre d'outils (S.set.uiC, '' = classique).
// Mode auto (S.set.uiA) : 4 couleurs tirées de la couleur choisie — matin clair, journée pâle, soir soutenu, nuit foncée —
// modifiables une par une (S.set.uiM), mélangées selon l'heure (E.tod, E.night, E.gold) puis teintées par la météo.
// uiTheme() pose des variables --t-* sur #cty + la classe .thm (city.css, section v3.5) ; les panneaux restent clairs.
const UI_COLS=[['','Classique'],['#c0392b','Rouge'],['#e05a8a','Rose'],['#e67e22','Orange'],['#e2b021','Jaune'],['#2f9e5a','Vert'],['#0e8c87','Turquoise'],['#2f6fd6','Bleu'],['#7c4dcc','Violet'],['#4a5560','Gris']];
const UI_MOM=[['mo','Matin'],['da','Journée'],['ev','Soir'],['ni','Nuit']];
const hx2rgb=h=>{h=String(h||'').replace('#','');if(h.length===3)h=h.replace(/./g,'$&$&');const n=parseInt(h,16)||0;return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};
const rgb2hx=c=>'#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
function rgb2hsl(c){const[r,g,b]=c,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,sa=0;
  if(mx!==mn){const d=mx-mn;sa=l>.5?d/(2-mx-mn):d/(mx+mn);h=(mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4)/6;}return[h,sa,l];}
function hsl2rgb(h,sa,l){sa=clamp(sa,0,1);l=clamp(l,0,1);const q=l<.5?l*(1+sa):l+sa-l*sa,p=2*l-q;
  const f=t=>{t=((t%1)+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};return[f(h+1/3),f(h),f(h-1/3)];}
const mixC=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
const lumC=c=>{const f=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);};
function uiMoments(){
  const[h,sa]=rgb2hsl(hx2rgb(S.set.uiC)),M=S.set.uiM||{};
  const auto={mo:hsl2rgb(h,sa*.9,.76),da:hsl2rgb(h,sa*.75,.87),ev:hsl2rgb(h,sa*.95,.5),ni:hsl2rgb(h,sa*.75,.19)};
  const o={};for(const[k]of UI_MOM)o[k]=M[k]?hx2rgb(M[k]):auto[k];return o;
}
function uiColorNow(){
  if(!S.set.uiA)return hx2rgb(S.set.uiC);
  const m=uiMoments(),n=E?E.night:0,g=E?(E.gold||0):0,morning=E?E.tod<.5:true;
  let c=mixC(m.da,m.ni,n);c=mixC(c,morning?m.mo:m.ev,g*.9);
  const k=S.set.wx&&S.wx?S.wx.k:'clear';
  if(k==='rain')c=mixC(c,[.44,.48,.53],.35);
  else if(k==='storm')c=mixC(c,[.17,.19,.24],.5);
  else if(k==='fog')c=mixC(c,[.85,.87,.89],.45);
  else if(k==='rainbow'){const[h,sa,l]=rgb2hsl(c);c=hsl2rgb(h,Math.min(1,sa*1.25+.05),l);}
  if(SNOW.value>.35)c=mixC(c,[.96,.97,.98],.22*SNOW.value*(1-n));   // neige : un peu plus blanc, le jour seulement
  return c;
}
let _uiKey='',_uiSave=0;
function uiTheme(){
  const box=$('cty');if(!box)return false;
  if(!S.set.uiC){_uiKey='';box.classList.remove('thm');return false;}
  const c=uiColorNow(),key=rgb2hx(c)+(S.set.uiA?1:0);
  if(key===_uiKey)return true;_uiKey=key;
  const dark=lumC(c)<.22,[h0,s0]=rgb2hsl(hx2rgb(S.set.uiC)),grey=s0<.12,h=grey?.49:h0,sa=grey?.8:s0,lc=rgb2hsl(c)[2];   // texte blanc sur couleur foncée, sinon texte foncé
  // accent (libellé du palier, bouton actif…) : toujours bien contrasté avec la couleur du moment — très clair sur fond foncé, foncé sur fond clair
  const acc=dark?hsl2rgb(h,Math.min(.9,sa),clamp(lc+.42,.76,.88)):hsl2rgb(h,Math.max(.5,sa*.8),Math.min(.36,lc-.42));
  const ink=dark?[.97,.97,.97]:hsl2rgb(h,Math.min(.4,s0),.13),rgba=(v,a)=>`rgba(${v.map(x=>Math.round(clamp(x,0,1)*255)).join(',')},${a})`;
  const P={glass:rgba(c,dark?.88:.84),gb:dark?'rgba(255,255,255,.12)':'rgba(255,255,255,.55)',ink:rgb2hx(ink),soft:rgba(ink,dark?.68:.62),
    line:dark?'rgba(255,255,255,.14)':'rgba(0,0,0,.09)',hov:dark?'rgba(255,255,255,.1)':'rgba(0,0,0,.06)',chip:dark?'rgba(255,255,255,.13)':'rgba(0,0,0,.07)',
    teal:rgb2hx(acc),acc:rgba(acc,dark?.24:.18),onacc:dark?rgb2hx(hsl2rgb(h,.5,.16)):'#ffffff',sh:dark?'0 4px 22px rgba(0,0,0,.3)':'0 4px 22px rgba(15,30,25,.12)'};
  for(const k in P)box.style.setProperty('--t-'+k,P[k]);
  box.classList.add('thm');return true;
}
function uiPick(c){
  S.set.uiC=c||'';S.set.uiM={};_uiKey='';extHUD();save();renderPanel();
}
// sélecteurs de couleur : aperçu en direct pendant qu'on choisit, panneau redessiné quand le sélecteur se ferme
function uiInput(t){
  if(t.dataset.uic){S.set.uiC=t.value;S.set.uiM={};}else (S.set.uiM||(S.set.uiM={}))[t.dataset.uim]=t.value;
  _uiKey='';extHUD();
  const pn=$('cty-panel');
  if(pn&&t.dataset.uic){pn.querySelectorAll('.cty-uic .on').forEach(b=>b.classList.remove('on'));const lb=t.closest('label');if(lb){lb.classList.add('on');lb.style.setProperty('--c',t.value);}
    if(S.set.uiA){const m=uiMoments();pn.querySelectorAll('[data-uim]').forEach(x=>{x.value=rgb2hx(m[x.dataset.uim]);x.parentNode.style.setProperty('--c',x.value);});}}
  if(t.dataset.uim)t.parentNode.style.setProperty('--c',t.value);
  if(!t._uiCh){t._uiCh=true;t.addEventListener('change',()=>{if(PANEL==='settings')renderPanel();},{once:true});}
  clearTimeout(_uiSave);_uiSave=setTimeout(save,700);
}
function panelUiColor(sw){
  const cur=S.set.uiC||'',pre=UI_COLS.some(([c])=>c===cur),own=cur&&!pre;
  let h=`<div class="cty-sec">Couleur de l’interface</div><p class="cty-p small">La barre du haut, les boutons de droite, la caméra et la barre d’outils.</p><div class="cty-uic">`
    +UI_COLS.map(([c,n])=>`<button class="${c?'':'cl'}${c===cur?' on':''}" data-act="uic" data-c="${c}" title="${n}" aria-label="${n}" style="--c:${c||'#fff'}"></button>`).join('')
    +`<label class="cty-uic-pk${own?' on':''}" title="Choisir n’importe quelle couleur"${own?` style="--c:${cur}"`:''}><span class="ms">colorize</span><input type="color" data-uic="1" value="${cur||'#c0392b'}" aria-label="Choisir n’importe quelle couleur"></label></div>`;
  if(!cur)return h+`<p class="cty-p small">Classique : verre clair le jour, sombre la nuit.</p>`;
  h+=sw('uiA','Change avec l’heure et la météo','Clair le matin, pâle en journée, plus soutenu le soir, foncé la nuit. Plus gris sous la pluie, sombre pendant l’orage, pâle dans le brouillard.');
  if(!S.set.uiA)return h;
  const m=uiMoments();
  return h+`<div class="cty-uim">`+UI_MOM.map(([k,n])=>`<label title="Changer la couleur : ${n}"><i style="--c:${rgb2hx(m[k])}"><input type="color" data-uim="${k}" value="${rgb2hx(m[k])}" aria-label="Couleur : ${n}"></i><span>${n}</span></label>`).join('')+`</div>`
    +(Object.keys(S.set.uiM||{}).length?`<button class="cty-link" data-act="uimreset">Recalculer les 4 couleurs à partir de la couleur choisie</button>`:`<p class="cty-p small">Touche un moment pour choisir sa couleur toi-même.</p>`);
}

let _hudCache='';
function extHUD(force){
  if(!ROOT||!S)return;
  const pb=$('cty-pbadge');if(pb){pb.textContent=S.pat&&!VISIT?'1':'';pb.style.display=S.pat&&!VISIT?'':'none';}
  const pbtn=ROOT.querySelector('.cty-patb');if(pbtn){const P=P_(),kk=P.patIc+P.side;if(pbtn.dataset.k!==kk){pbtn.dataset.k=kk;const ic=pbtn.querySelector('.ms'),lb=pbtn.querySelector('.lbl');if(ic)ic.textContent=P.patIc;if(lb)lb.textContent=P.side;pbtn.title=`${P.cab} : des ${P.pats} viennent consulter avec un cas clinique`;}}
  const de=$('cty-date');if(de){const t=`Rythme du temps : ${TSP_N[clamp(S.set.tsp??2,0,TSP.length-1)]} (Réglages)${isRush()?' · heure de pointe':''}`;if(de.title!==t)de.title=t;}
  spSync();examTick();
  const jb=$('cty-jbadge');if(jb)jb.style.display=!VISIT&&S.news.length>(S.newsSeen|0)?'':'none';
  const fb=$('cty-fbadge');if(fb){const n=SOC.pending|0;fb.textContent=n||'';fb.style.display=n?'':'none';}
  const wx=$('cty-wx');if(wx){const w=WX[(S.set.wx&&S.wx&&S.wx.k)||'clear'];const t=`<span class="ms">${w[0]}</span>`;if(wx.innerHTML!==t){wx.innerHTML=t;wx.title=w[1];}}
  const box=$('cty');if(box&&E){const th=uiTheme();box.classList.toggle('night',!th&&E.night>.62);}   // couleur choisie, sinon verre sombre la nuit
  let b='';
  if(VISIT)b+=`<div class="cty-bn visit"><span class="ms">travel_explore</span><span>Tu visites <b>${esc(VISIT.name)}</b>, la ville de ${esc(VISIT.owner)} <span class="cty-live">● en direct</span></span><button data-act="flike">${VISIT.liked?'❤️ Aimée':'🤍 J’aime'}</button><button data-act="gift">🎁 Offrir</button><button data-act="fback">Retour à ma ville</button></div>`;
  else{
    if(S.show){const D_=SHOWS[S.show.k];b+=`<div class="cty-bn show"><span class="ms">${D_.ic}</span><span><b>${D_.n}</b> · ${S.show.end-S.day>1?`encore ${S.show.end-S.day} jours`:'dernier jour'}</span><button data-act="showgo">Voir</button></div>`;}
    if(S.fest)b+=`<div class="cty-bn fest"><span class="ms">festival</span><span><b>Festival des partiels</b> · « ${esc(S.fest.name)} » ${S.fest.days?`dans ${S.fest.days} j`:'aujourd’hui'} · primes ×2</span><button data-act="panel" data-p="quiz">Réviser</button></div>`;
    b+=v6Banners();
    if(S.crisis)b+=`<div class="cty-bn crisis"><span class="ms">coronavirus</span><span><b>${esc(S.crisis.name)}</b> · ${S.crisis.n|0} / 5 bonnes réponses d’affilée</span><button data-act="panel" data-p="quiz">Agir</button></div>`;
  }
  if(force||b!==_hudCache){_hudCache=b;const el=$('cty-banners');if(el)el.innerHTML=b;}
  sndButton();
  if(E&&E.lamps)E.lamps.material.color.copy(S.fest?_festC.setHSL((E.t*.08)%1,.85,.66):_lampC);
}
const _festC=new THREE.Color(),_lampC=new THREE.Color('#ffcf87');
function extClick(a,el,e){
  const k=el.dataset.k;
  if(a==='pata')patientAnswer(+el.dataset.j);
  else if(a==='patok'){PATRES=null;renderPanel();}
  else if(a==='rpa')repAnswer(+el.dataset.j);
  else if(a==='festgo'){if(S.fest&&S.fest.folders.length){const F=quizFilter();F.f=S.fest.folders[0];F.t='';qzPushHist();QZV=null;QZ=null;quizNext();save();renderPanel();}}
  else if(a==='follow')followStart(+k);
  else if(a==='followstop')followStop();
  else if(a==='snd')sndToggle();
  else if(a==='tlplay'){if(!TLP)TLP={k:0,play:false};TLP.play=!TLP.play;if(TLP.play&&TLP.k>=tlLoad().f.length-1)TLP.k=-1;renderPanel();if(TLP.play)tlTick();}
  else if(a==='tlsnap'){tlMaybeSnap(true);TLP=null;renderPanel();toast('Image ajoutée au timelapse.','add_a_photo');}
  else if(a==='distrule'){const d=S.dists[k];if(d){d.r=d.r||{};d.r[el.dataset.r]=!d.r[el.dataset.r];D.lv=D.pol=D.util=true;recomputeTraffic();simRefresh();renderPanel();save();}}
  else if(a==='distcol'){const d=S.dists[k];if(d){d.c=((d.c==null?k-1:d.c)+1)%DIST_COLS.length;redrawAllGround();distLabels(true);renderPanel();refreshTray();save();}}
  else if(a==='distgo'){let sx=0,sz=0,n=0;for(let i=0;i<NN;i++)if(dist[i]===+k){sx+=i%N;sz+=(i/N)|0;n++;}if(n)flyTo(sx/n+.5,sz/n+.5,26);}
  else if(a==='distdel'){actBegin();for(let i=0;i<NN;i++)if(dist[i]===+k){rec(i);dist[i]=0;markG(i);}actEnd(0,'quartier');delete S.dists[k];redrawAllGround();D.lv=D.pol=D.util=true;simRefresh();distLabels(true);renderPanel();refreshTray();save();}
  else if(a==='mldel'){S.mlines.splice(+k,1);E.mlDirty=true;D.cov=true;simRefresh();renderPanel();save();}
  else if(a==='mlfrom'){TRAY='transports';setTool('mline');TOOL.a=+k;refreshToolbar();tip('Touche maintenant une autre station de métro','info');}
  else if(a==='rxhere'){const i=+k,c=RX_COST[2]-(rx[i]?RX_COST[rx[i]]:0);if(S.money<c){noMoney(c);return;}actBegin();rec(i);rx[i]=2;touch(i,true);S.money-=c;actEnd(c,'rond-point');recomputeTraffic();simRefresh();afterAction();floatMoney(-c);renderPanel();checkAch();}
  else socialClick(a,el,k);
}
// Panneaux ajoutés à renderPanel
const EXT_PANELS={keys:panelKeys,anato:panelAnato,sos:panelSos,curves:panelCurves,quests:panelQuests,gift:panelGift,cits:panelCits,exam:panelExam,saves:panelSaves,prof:panelProf,recover:panelRecover,patient:panelPatient,journal:panelJournal,citizen:panelCitizen,ach:panelAch,timelapse:panelTimelapse,trade:panelTrade,districts:panelDistricts,friends:panelFriends};
function extAfterRender(){recDraw();svDraw();if(PANEL==='timelapse'){tlDraw();if(TLP&&TLP.play&&!TLP.timer)tlTick();}if(PANEL==='journal')extHUD(true);}

// =========================================================
// Cycle de vie
// =========================================================
function extDay(){if(VISIT)return;patientDay();crisisDay();catDay();seasonDay();showDay();}
function extMonth(){
  if(VISIT)return;
  recomputeTraffic();crisisMonth();catMonth();refreshRepairs();cdCheck();showMonth();
  S.lmods=S.lmods.filter(m=>m.u>S.day);
  const m=(S.day/30)|0;
  if(m%3===0&&ST.pop>0){const L=S.last;news('monitoring','Le bilan du trimestre',`${fmt(ST.pop)} habitants, ${ST.hap} % de bonheur, budget ${L&&L.net>=0?'positif':'négatif'} (${L?(L.net>=0?'+':'')+fmt(L.net):'0'} § le mois dernier).${ST.jam>15?` ${ST.jam} % des rues sont embouteillées.`:''}`);}
  checkAch();
}
let _sndBound=false;
function extMount(){
  if(!S.v3){S.v3=1;news('celebration','Nouveautés dans la ville !','Patients, crise sanitaire, festival des partiels, tram et métro, quartiers, décor, météo, journal, amis… Tout est expliqué dans l’Aide.','good');
    setTimeout(()=>toast('<b>Nouveautés !</b> Patients, tram, métro, quartiers, décor, météo, journal, amis… (bouton Aide)','celebration',{label:'Voir',fn:()=>openPanel('help')}),2200);}
  if(!S.v4){S.v4=1;if(S.day>30)news('celebration','Nouveautés : métiers, paysages et feux rouges !','Choisis ton métier (kiné, véto, médecin, dentiste), change de paysage et règle le rythme du temps dans les Réglages. Les grands carrefours ont maintenant des feux.','good');}
  wxDay();
  festCheck();cdCheck();refreshRepairs();recomputeTraffic();checkAch();if(E){E.asvT=E.t;E.asvDay=S.day;}
  if(S.pat)setTimeout(()=>{if(S.pat&&!VISIT){const x=S.pat.i%N,z=(S.pat.i/N)|0;toast(`<b>${esc(S.pat.name)}</b> attend toujours sa consultation.`,P_().patIc,{label:'Soigner',fn:()=>{flyTo(x+.5,z+.5);openPanel('patient');}});}},3500);
  if(!_sndBound&&ROOT){_sndBound=true;ROOT.addEventListener('pointerdown',()=>{sndInit();sndResume();},{passive:true});}
  sndResume();sndButton();extHUD(true);if(S.set.gfx)setupFX();
  setTimeout(()=>{citySocialSync();},1500);
}
function extUnmount(){followStop();sndSuspend();if(TLP){clearTimeout(TLP.timer);TLP.timer=null;TLP.play=false;}if(VISIT)visitEnd(true);}
function extRefresh(){if(VISIT)return;festCheck();cdCheck();refreshRepairs();}

// =========================================================
// Amis (Supabase, voir supabase/city.sql) : visite, classement, jumelage, duel du maire
// =========================================================
const SOC={pending:0,tab:'board',scope:'friends',metric:'pop',board:null,friends:null,status:null,err:null,loading:false,lastPub:0,pubT:null};
let DUEL=null;   // duel en cours de jeu {mode:'new'|'reply', opp:{id,name}, id, qs, k, score, ans}
function socOK(){try{return typeof socialConfigured==='function'&&socialConfigured()&&typeof socialIsLogged==='function'&&socialIsLogged()&&!(typeof _socialDemo!=='undefined'&&_socialDemo)&&typeof _rpc==='function';}catch(e){return false;}}
function socName(p){return p?(p.display_name||p.username||'?'):'?';}
function localDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function studiedToday(){try{const k=new Date().toISOString().split('T')[0];if(typeof dailyCounts!=='undefined'&&dailyCounts&&(dailyCounts[k]|0)>0)return true;}catch(e){}return S.lastStudy===new Date().toDateString();}
function rleEnc(u8){const o=[];let i=0;while(i<u8.length){const v=u8[i];let n=1;while(i+n<u8.length&&u8[i+n]===v&&n<255)n++;o.push(n,v);i+=n;}return b64enc(new Uint8Array(o));}
function rleDec(str,len){const u=b64dec(str),a=new Uint8Array(len);let p=0;for(let k=0;k+1<u.length&&p<len;k+=2){a.fill(u[k+1],p,Math.min(len,p+u[k]));p+=u[k];}return a;}
function citySnapshot(){
  const buf=new Uint8Array(NN*LAYERS.length);LAYERS.forEach((a,k)=>buf.set(a,k*NN));
  return JSON.stringify({v:3,name:S.name,ms:S.ms,day:S.day,seed:S.seed,biome:S.biome,prof:S.prof,L:LAYERS.length,map:rleEnc(buf),svc:[...SV.values()].map(s=>[s.id,s.t,s.x,s.z,s.rot|0]),dists:S.dists,mlines:S.mlines});
}
async function socInit(){try{if(typeof socialInit==='function')await socialInit();}catch(e){}}
async function cityPublish(force){
  if(VISIT||!socOK())return;const now=Date.now();if(!force&&now-SOC.lastPub<5*60e3)return;SOC.lastPub=now;
  try{await _rpc('city_publish',{p_name:S.name,p_pop:ST.pop|0,p_hap:ST.hap|0,p_ms:S.ms|0,p_study:studiedToday()?localDay():null,p_data:citySnapshot()});}
  catch(e){SOC.err=socErr(e);}
}
function cityPublishSoon(){clearTimeout(SOC.pubT);SOC.pubT=setTimeout(()=>cityPublish(true),4000);}
function socErr(e){const m=(e&&e.message)||String(e);if(/city_|duel_|function .* does not exist|Could not find the function/i.test(m))return 'missing';return m;}
async function citySocialSync(){
  if(VISIT)return;await socInit();if(!socOK()){SOC.pending=0;return;}
  await cityPublish(true);
  giftsFetch();contestCheck();   // v5 : cadeaux reçus, concours de la semaine
  try{SOC.status=await _rpc('city_status',{});SOC.err=null;}catch(e){SOC.err=socErr(e);SOC.status=null;}
  const st=SOC.status;
  if(st){
    SOC.pending=(st.twin_in||[]).length+(st.duels||[]).filter(d=>d.role==='o'&&d.status==='open').length;
    S.twin=st.twin?{id:st.twin.id,name:socName(st.twin)}:null;
    // jumelage : bonus si vous avez révisé tous les deux aujourd'hui (une fois par jour, vérifié par le serveur)
    if(st.twin&&studiedToday()&&st.twin.study_day===st.today&&S.twinDay!==st.today){
      try{const r=await _rpc('city_twin_claim',{});if(r&&r.claimed){S.twinDay=st.today;S.money+=600;floatMoney(600);news('handshake','Bonus de jumelage !',`Toi et ${socName(st.twin)} avez révisé aujourd’hui : +600 §.`,'good');toast(`<b>Bonus de jumelage</b> : toi et ${esc(socName(st.twin))} avez révisé aujourd’hui · +600 §`,'handshake');save();}}catch(e){}
    }
    for(const d of st.duels||[])if(d.status==='done')duelClaim(d);
  }
  checkAch();extHUD(true);if(PANEL==='friends')renderPanel();
}
function duelClaim(d){
  if(!Array.isArray(S.duelClaimed))S.duelClaimed=[];if(S.duelClaimed.includes(d.id))return;
  S.duelClaimed.push(d.id);if(S.duelClaimed.length>60)S.duelClaimed.shift();
  const me=d.role==='c'?d.c_score:d.o_score,them=d.role==='c'?d.o_score:d.c_score,who=socName(d.other);
  if(me>them){S.trophies=(S.trophies|0)+1;S.stat.duelWins=(S.stat.duelWins|0)+1;S.money+=2000;floatMoney(2000);
    news('sports_kabaddi',`Duel gagné contre ${who} !`,`${me} à ${them}. Une statue du duel t’attend dans Monuments (gratuite).`,'good');fireworks(5,`Duel gagné contre ${who} (${me} – ${them}) ! Statue débloquée`);}
  else if(me===them){S.money+=500;floatMoney(500);news('sports_kabaddi',`Égalité contre ${who}`,`${me} partout. +500 § chacun.`);}
  else news('sports_kabaddi',`Duel perdu contre ${who}`,`${me} à ${them}. La revanche t’attend !`);
  save();
}
async function socLoad(){
  if(SOC.loading)return;SOC.loading=true;if(PANEL==='friends')renderPanel();
  await socInit();
  if(socOK()){
    try{const [b,f,s]=await Promise.all([_rpc('city_board',{p_scope:SOC.scope}),_rpc('list_friends',{}),_rpc('city_status',{})]);SOC.board=b||[];SOC.friends=(f&&f.friends)||[];SOC.status=s;SOC.err=null;
      SOC.pending=(s.twin_in||[]).length+(s.duels||[]).filter(d=>d.role==='o'&&d.status==='open').length;S.twin=s.twin?{id:s.twin.id,name:socName(s.twin)}:null;
      for(const d of s.duels||[])if(d.status==='done')duelClaim(d);}
    catch(e){SOC.err=socErr(e);}
  }
  SOC.loading=false;extHUD(true);if(PANEL==='friends')renderPanel();
}
function panelFriends(){
  const H=head('diversity_3','Villes de mes amis','Visite, classement, jumelage et duel','#3b8fdc');
  const conf=typeof socialConfigured==='function'&&socialConfigured();
  if(!conf)return H+`<p class="cty-p">Les comptes ne sont pas encore activés sur ce site. Une fois Supabase branché (voir le guide), tu pourras visiter les villes de tes amis.</p>`;
  if(!socOK())return H+`<p class="cty-p">Connecte-toi à ton compte Kiné+ pour voir les villes de tes amis, te jumeler et lancer des duels.</p><button class="cty-btn" data-act="flogin"><span class="ms">login</span>Se connecter</button>`;
  if(DUEL)return H+duelHTML();
  if(SOC.err==='missing')return H+`<p class="cty-p">Il manque la partie « ville » dans ta base Supabase. Ouvre Supabase → <b>SQL Editor</b>, colle le contenu du fichier <b>supabase/city.sql</b> et clique sur <b>Run</b>. Reviens ensuite ici.</p><button class="cty-btn" data-act="frefresh"><span class="ms">refresh</span>Réessayer</button>`;
  if(!SOC.board&&!SOC.loading){setTimeout(socLoad,0);}
  const tabs=`<div class="cty-tabs">${[['board','Classement'],['contest','Concours'],['friends','Mes amis'],['duels','Duels'+(SOC.pending?` (${SOC.pending})`:'')]].map(([k,n])=>`<button class="${SOC.tab===k?'on':''}" data-act="ftab" data-k="${k}">${n}</button>`).join('')}</div>`;
  if(SOC.loading&&!SOC.board)return H+tabs+`<div class="cty-loading-in"><div class="house-spinner"></div></div>`;
  if(SOC.err)return H+tabs+`<p class="cty-p">${esc(SOC.err)}</p><button class="cty-btn" data-act="frefresh"><span class="ms">refresh</span>Réessayer</button>`;
  const me=typeof socialProfile==='function'?socialProfile():null,myId=me&&me.id,fids=new Set((SOC.friends||[]).map(f=>f.id));
  if(SOC.tab==='contest')return H+tabs+contestHTML(myId);
  if(SOC.tab==='board'){
    const M=SOC.metric,list=(SOC.board||[]).slice().sort((a,b)=>(b[M]|0)-(a[M]|0));
    const top=(SOC.board||[]).slice().sort((a,b)=>(b.likes|0)-(a.likes|0))[0];
    return H+tabs+`<div class="cty-seg">${[['friends','Amis'],['all','Tout le monde']].map(([k,n])=>`<button class="${SOC.scope===k?'on':''}" data-act="fscope" data-k="${k}">${n}</button>`).join('')}</div>`
      +`<div class="cty-seg">${[['pop','Population'],['hap','Bonheur'],['likes','❤️ du mois']].map(([k,n])=>`<button class="${M===k?'on':''}" data-act="fmetric" data-k="${k}">${n}</button>`).join('')}</div>`
      +(top&&(top.likes|0)>0?`<div class="cty-reward"><span class="ms">emoji_events</span><span>Plus belle ville du mois : <b>${esc(top.name)}</b> de ${esc(socName(top))} (${top.likes} ❤️)</span></div>`:'')
      +(list.length?list.map((c,k)=>`<div class="cty-lb${c.user===myId?' me':''}"><b class="rk">${k+1}</b><span class="t"><b>${esc(c.name)}</b><small>${esc(socName(c))}${c.user===myId?' (toi)':''} · ${MS[clamp(c.ms|0,0,MS.length-1)].name}</small></span><span class="v">${M==='pop'?fmt(c.pop)+' hab.':M==='hap'?c.hap+' %':(c.likes|0)+' ❤️'}</span>${c.user!==myId&&fids.has(c.user)?`<button class="cty-px" data-act="fvisit" data-k="${c.user}" title="Visiter"><span class="ms">travel_explore</span></button>`:''}</div>`).join('')
        :`<p class="cty-p small">Aucune ville pour l’instant. Invite tes amis à ouvrir « Ma ville » !</p>`)
      +`<button class="cty-btn ghost" data-act="frefresh"><span class="ms">refresh</span>Actualiser</button>`;
  }
  if(SOC.tab==='friends'){
    const st=SOC.status||{},cities=new Map((SOC.board||[]).map(c=>[c.user,c]));
    let h='';
    if(st.twin)h+=`<div class="cty-twin"><span class="ms">handshake</span><span><b>Ville jumelle : ${esc(st.twin.city||'—')}</b><small>de ${esc(socName(st.twin))} · ${st.twin.study_day===st.today?'a révisé aujourd’hui ✅':'n’a pas encore révisé aujourd’hui'} · toi : ${studiedToday()?'✅':'pas encore'}</small><small>Bonus de 600 § chaque jour où vous révisez tous les deux.</small></span><button class="cty-link danger" data-act="ftwincancel">Rompre</button></div>`;
    for(const p of st.twin_in||[])h+=`<div class="cty-twin in"><span class="ms">handshake</span><span><b>${esc(socName(p))}</b> te propose un jumelage</span><button class="cty-btn" data-act="ftwinok" data-k="${p.id}">Accepter</button><button class="cty-link" data-act="ftwinno" data-k="${p.id}">Refuser</button></div>`;
    for(const p of st.twin_out||[])h+=`<div class="cty-twin out"><span class="ms">schedule</span><span>Demande de jumelage envoyée à <b>${esc(socName(p))}</b></span><button class="cty-link" data-act="ftwincancel">Annuler</button></div>`;
    const fl=SOC.friends||[];
    h+=fl.length?fl.map(f=>{const c=cities.get(f.id);return `<div class="cty-fr"><span class="t"><b>${esc(socName(f))}</b><small>${c?`${esc(c.name)} · ${fmt(c.pop)} hab. · ${c.hap} %`:'n’a pas encore de ville'}</small></span>
      ${c?`<button class="cty-px" data-act="fvisit" data-k="${f.id}" title="Visiter sa ville"><span class="ms">travel_explore</span></button>`:''}
      <button class="cty-px" data-act="fduel" data-k="${f.id}" data-n="${esc(socName(f))}" title="Défier au duel du maire"><span class="ms">sports_kabaddi</span></button>
      ${!st.twin&&!(st.twin_out||[]).length?`<button class="cty-px" data-act="ftwin" data-k="${f.id}" title="Proposer un jumelage"><span class="ms">handshake</span></button>`:''}</div>`;}).join('')
      :`<p class="cty-p small">Tu n’as pas encore d’amis sur Kiné+. Ajoute-les depuis l’écran « Amis & classement ».</p>`;
    return H+tabs+h+`<p class="cty-p small"><span class="ms" style="font-size:14px;vertical-align:-2px">travel_explore</span> visiter · <span class="ms" style="font-size:14px;vertical-align:-2px">sports_kabaddi</span> duel (10 questions de tes cours) · <span class="ms" style="font-size:14px;vertical-align:-2px">handshake</span> jumelage</p>`;
  }
  const ds=(SOC.status&&SOC.status.duels)||[];
  return H+tabs+(ds.length?ds.map(d=>{const who=esc(socName(d.other)),mine=d.role==='c'?d.c_score:d.o_score,them=d.role==='c'?d.o_score:d.c_score;
    let s;if(d.status==='done')s=`<b class="${mine>them?'ok':mine<them?'ko':''}">${mine>them?'Gagné':mine<them?'Perdu':'Égalité'} ${mine} – ${them}</b>`;
    else if(d.role==='o')s=`<button class="cty-btn" data-act="fdplay" data-k="${d.id}">Jouer</button>`;else s=`<small>En attente de ${who} · ton score : ${mine}/${d.n||10}</small>`;
    return `<div class="cty-fr"><span class="ms">sports_kabaddi</span><span class="t"><b>${d.role==='c'?'Tu as défié':'Défi de'} ${who}</b><small>${new Date(d.created_at).toLocaleDateString('fr-FR')}</small></span>${s}</div>`;}).join('')
    :`<p class="cty-p small">Aucun duel. Onglet « Mes amis » → <span class="ms" style="font-size:14px;vertical-align:-2px">sports_kabaddi</span> pour défier un ami sur 10 questions de tes cours. Le gagnant reçoit une statue pour sa ville !</p>`);
}
function duelHTML(){
  const D_=DUEL,L='ABCDEFGHIJ';
  if(D_.loading)return `<div class="cty-loading-in"><div class="house-spinner"></div></div>`;
  if(D_.k>=D_.qs.length)return `<div class="cty-reward"><span class="ms">sports_kabaddi</span><span>Duel terminé : <b>${D_.score} / ${D_.qs.length}</b></span></div>`
    +(D_.sent?`<p class="cty-p">${D_.mode==='new'?`Défi envoyé à <b>${esc(D_.opp.name)}</b> ! Le résultat arrivera quand ${esc(D_.opp.name)} aura joué.`:'Résultat envoyé !'}</p><button class="cty-btn" data-act="fdclose">Terminer</button>`:`<div class="cty-loading-in"><div class="house-spinner"></div></div>`);
  const q=D_.qs[D_.k],done=D_.ans!=null;
  const ans=q.order.map((j,k)=>{let cl='';if(done){if(j===q.c)cl=' ok';else if(j===D_.ans)cl=' ko';}return `<button class="cty-qa${cl}" data-act="fda" data-j="${j}"${done?' disabled':''}><b>${L[k]}</b><span>${esc(q.a[j])}</span></button>`;}).join('');
  return `<div class="cty-qnav"><span>Duel contre <b>${esc(D_.opp.name)}</b> · question ${D_.k+1} / ${D_.qs.length} · score ${D_.score}</span><button class="cty-link danger" data-act="fdcancel">Abandonner</button></div>`
    +`<div class="cty-qq">${esc(q.q)}</div><div class="cty-qas">${ans}</div>`
    +(done?`<div class="cty-qfb ${D_.ans===q.c?'ok':'ko'}"><b>${D_.ans===q.c?'Bonne réponse !':'Raté…'}</b> ${D_.ans===q.c?'':`La bonne réponse : <b>${esc(q.a[q.c])}</b>`}${q.e?`<small>${esc(q.e)}</small>`:''}</div><button class="cty-btn" data-act="fdnext"><span class="ms">arrow_forward</span>${D_.k+1<D_.qs.length?'Question suivante':'Voir le résultat'}</button>`:'');
}
function duelPick(){
  const base=quizBase();if(base.length<3)return null;const pool=base.slice().sort(()=>Math.random()-.5).slice(0,10);
  return pool.map(q=>{const idx=q.answers.map((_,j)=>j).filter(j=>String(q.answers[j]||'').trim());const a=idx.map(j=>String(q.answers[j]).slice(0,300)),c=idx.indexOf(q.correct|0);
    return{id:q.id,q:String(q.question).slice(0,600),a,c:c<0?0:c,e:q.expl?String(q.expl).slice(0,500):''};});
}
async function duelFinish(){
  const D_=DUEL;
  try{if(D_.mode==='new')await _rpc('duel_create',{p_opponent:D_.opp.id,p_questions:D_.qs.map(q=>({q:q.q,a:q.a,c:q.c,e:q.e})),p_score:D_.score});
    else{const r=await _rpc('duel_submit',{p_id:D_.id,p_score:D_.score});if(r&&r.status==='done')duelClaim(r);}
    D_.sent=true;}catch(e){D_.sent=true;toast('Envoi impossible : '+esc(socErr(e)==='missing'?'il manque supabase/city.sql':socErr(e)),'error');}
  if(PANEL==='friends')renderPanel();socLoad();
}
async function visitStart(uid,pre){   // pre = {r, cam} : rafraîchissement de la visite en direct (v5)
  if(VISIT)return;await socInit();if(!socOK())return;
  let r=pre&&pre.r||null;
  if(!r){toast('Chargement de la ville de ton ami…','travel_explore');try{r=await _rpc('city_get',{p_user:uid});}catch(e){toast('Impossible de charger cette ville : '+esc(socErr(e)),'error');return;}}
  if(!r||!r.data){toast('Cette ville n’est pas encore publiée.','info');return;}
  let o=null;try{o=JSON.parse(r.data);}catch(e){o=null;}
  if(!o||!o.map){toast('Ville illisible.','error');return;}
  if(!pre)save();followStop();toolCancel();if(!pre)closePanel();TRAY=null;setTool('inspect');UNDO.length=0;
  VISIT={name:String(o.name||r.name||'Ville').slice(0,40),owner:socName(r.owner),user:uid,liked:!!r.liked,likes:r.likes|0};
  const S0=defaults();S=Object.assign(S0,{name:VISIT.name,ms:clamp(o.ms|0,0,MS.length-1),day:o.day|0,seed:o.seed|0,biome:BIOMES[o.biome]?o.biome:'tempere',prof:PROF[o.prof]?o.prof:'kine',speed:0,dists:{},mlines:[],set:Object.assign({},S0.set,{snd:false,mus:false})});
  extLoadFix();
  if(o.dists&&typeof o.dists==='object')for(const k in o.dists){const d=o.dists[k];if(+k>=1&&+k<=15&&d)S.dists[k]={n:String(d.n||'Quartier').slice(0,30),c:(d.c|0)%DIST_COLS.length,r:Object.fromEntries(DIST_RULES.map(x=>[x.id,!!(d.r&&d.r[x.id])]))};}
  const nl=clamp(o.L|0||8,8,LAYERS.length),buf=rleDec(o.map,NN*nl),MAXV=[1,3,3,4,4,255,4,255,1,2,7,3,15,9,2,15];
  LAYERS.forEach((a,k)=>{a.fill(0);if(k<nl){a.set(buf.subarray(k*NN,(k+1)*NN));const m=MAXV[k];for(let i=0;i<NN;i++)if(a[i]>m)a[i]=0;}});
  SV.clear();svcAt.fill(0);(o.svc||[]).forEach(a=>{if(Array.isArray(a)&&BT[a[1]]&&a[2]>=0&&a[3]>=0&&a[2]<N&&a[3]<N)addSvc({id:a[0]|0,t:a[1],x:a[2]|0,z:a[3]|0,rot:a[4]|0},true);});
  if(Array.isArray(o.mlines))S.mlines=o.mlines.filter(l=>Array.isArray(l)&&SV.get(l[0])&&SV.get(l[1])).slice(0,12);
  NZ=makeNoise(S.seed);E.hold=true;
  initDerived();rebuildGrid();fullRebuild();drawSign();if(pre&&pre.cam){Object.assign(CAM,pre.cam);applyCam();}else camHome();refreshHUD(true);refreshToolbar();extHUD(true);
  VISIT.sig=(r.updated_at||'')+'|'+(r.data||'').length;VISIT.pollT=E.t;
  if(!pre)toast(`Bienvenue à <b>${esc(VISIT.name)}</b>, la ville de ${esc(VISIT.owner)} ! Elle se met à jour en direct.`,'travel_explore');
}
function visitEnd(quiet){
  if(!VISIT)return;VISIT=null;UNDO.length=0;
  load();initDerived();S.stat.visits=(S.stat.visits|0)+1;
  if(E){E.hold=false;if(S.cam)Object.assign(CAM,S.cam);clampCam();applyCam();rebuildGrid();fullRebuild();drawSign();}
  if(!quiet){refreshHUD(true);refreshToolbar();extHUD(true);checkAch();save();toast('De retour dans ta ville.','home');}
}
async function socialClick(a,el,k){
  if(a==='flogin'){if(typeof socialOpenAuth==='function')socialOpenAuth('login');return;}
  if(a==='frefresh'){SOC.board=null;SOC.err=null;socLoad();return;}
  if(a==='ftab'){SOC.tab=k;renderPanel();return;}
  if(a==='fscope'){SOC.scope=k;SOC.board=null;socLoad();return;}
  if(a==='fmetric'){SOC.metric=k;renderPanel();return;}
  if(a==='fvisit'){visitStart(k);return;}
  if(a==='fback'){visitEnd(false);return;}
  if(a==='flike'){if(!VISIT)return;try{const r=await _rpc('city_like',{p_user:VISIT.user});VISIT.liked=!!(r&&r.liked);extHUD(true);toast(VISIT.liked?'Tu aimes cette ville ❤️':'J’aime retiré','favorite');}catch(e){toast(esc(socErr(e)),'error');}return;}
  if(a==='ftwin'||a==='ftwinok'||a==='ftwinno'||a==='ftwincancel'){
    try{if(a==='ftwin'){const r=await _rpc('city_twin_request',{p_user:k});toast(r==='accepted'?'Vos villes sont jumelées ! 🤝':'Demande de jumelage envoyée.','handshake');}
      else if(a==='ftwincancel'){await _rpc('city_twin_cancel',{});S.twin=null;toast('Jumelage annulé.','handshake');}
      else{await _rpc('city_twin_respond',{p_user:k,p_accept:a==='ftwinok'});if(a==='ftwinok')toast('Vos villes sont jumelées ! 🤝','handshake');}}
    catch(e){toast(esc(socErr(e)==='missing'?'Il manque supabase/city.sql dans ta base.':socErr(e)),'error');}
    socLoad();return;}
  if(a==='fduel'){const qs=duelPick();if(!qs){toast('Il te faut au moins 3 QCM dans Kiné+ pour lancer un duel.','quiz');return;}
    DUEL={mode:'new',opp:{id:k,name:el.dataset.n||'ton ami'},qs:qs.map(q=>Object.assign(q,{order:shuffled(q.a.length)})),k:0,score:0,ans:null};renderPanel();return;}
  if(a==='fdplay'){DUEL={loading:true};renderPanel();
    try{const d=await _rpc('duel_get',{p_id:k});if(!d||!Array.isArray(d.questions))throw new Error('Duel introuvable.');
      DUEL={mode:'reply',id:k,opp:{id:d.other&&d.other.id,name:socName(d.other)},qs:d.questions.slice(0,10).map(q=>({q:String(q.q||''),a:(q.a||[]).map(String),c:q.c|0,e:String(q.e||''),order:shuffled((q.a||[]).length)})).filter(q=>q.a.length>=2),k:0,score:0,ans:null};}
    catch(e){DUEL=null;toast(esc(socErr(e)),'error');}
    renderPanel();return;}
  if(a==='fda'){if(!DUEL||DUEL.ans!=null)return;const q=DUEL.qs[DUEL.k],j=+el.dataset.j;DUEL.ans=j;if(j===q.c)DUEL.score++;
    if(DUEL.mode==='new'&&q.id!=null){try{if(typeof recordAnswer==='function'){recordAnswer(q.id,j===q.c,6);if(typeof saveAll==='function')saveAll();}}catch(e){}}
    renderPanel();return;}
  if(a==='fdnext'){if(!DUEL)return;DUEL.k++;DUEL.ans=null;renderPanel();if(DUEL.k>=DUEL.qs.length)duelFinish();return;}
  if(a==='fdcancel'||a==='fdclose'){DUEL=null;renderPanel();return;}
}


// =========================================================
// Graphismes (12 nov. 2026) : ciel en dégradé, occlusion ambiante (SSAO), halo des lumières la nuit
// =========================================================
function makeSky(){
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{uTop:{value:new THREE.Color('#4a8fd6')},uHor:{value:new THREE.Color('#bfe3f5')},uGlow:{value:new THREE.Color('#ff9a5a')},uSun:{value:new THREE.Vector3(0,1,0)},uSunC:{value:new THREE.Color('#fff3df')},
      uSunK:{value:1},uGold:{value:0},uNight:{value:0},uCloud:{value:.35},uDark:{value:0},uTime:{value:0},uMoonPh:{value:.5},uMoonD:{value:new THREE.Vector3(-.68,.085,-.7)}},
    vertexShader:'varying vec3 vD;void main(){vD=(modelMatrix*vec4(position,1.)).xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}',
    fragmentShader:`uniform vec3 uTop,uHor,uGlow,uSunC,uSun,uMoonD;uniform float uSunK,uGold,uNight,uCloud,uDark,uTime,uMoonPh;varying vec3 vD;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<5;k++){v+=vn(p)*a;p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec3 d=normalize(vD),sd=normalize(uSun);float h=d.y,hp=max(h,0.);
  vec3 c=mix(uHor,uTop,pow(hp,.5));
  // lueur orangée vers le soleil au lever et au coucher, et bande rose près de l'horizon
  float az=max(dot(normalize(d.xz+1e-4),normalize(sd.xz+1e-4)),0.);
  c+=uGlow*uGold*pow(az,3.)*pow(1.-hp,5.)*.9;
  c=mix(c,c*vec3(1.,.82,.9),uGold*pow(1.-hp,8.)*.35);
  if(h<0.)c=mix(uHor,uHor*.82,clamp(-h*3.,0.,1.));
  // étoiles et lune la nuit
  if(uNight>.4&&h>0.){float nk=(uNight-.4)*1.6*(1.-uDark);
    vec2 sp=d.xz/(h+.35)*90.;vec2 cel=floor(sp);float hs=h21(cel),fr=length(fract(sp)-.5);
    float tw=.55+.45*sin(uTime*(1.5+hs*3.)+hs*60.);   // v6 : les étoiles scintillent
    float st=step(.9965,hs)*(1.-smoothstep(0.,.3,fr))*tw+step(.993,h21(cel+7.3))*(1.-smoothstep(0.,.22,fr))*.35;
    c+=vec3(1.,.97,.92)*st*nk;
    float band=exp(-pow(dot(d,normalize(vec3(.55,.2,-.8))),2.)*18.);c+=vec3(.55,.6,.85)*band*(fbm(d.xz*9.+d.y*4.)*.5+.15)*nk*.22;   // voie lactée
    float sid=floor(uTime/9.),ph=fract(uTime/9.);   // étoile filante, environ toutes les 9 s
    if(ph<.12&&h21(vec2(sid,3.1))>.35){vec2 a0=vec2(h21(vec2(sid,1.))-.5,h21(vec2(sid,2.))-.5)*1.6;vec2 dv=normalize(vec2(h21(vec2(sid,5.))-.5,-.35-h21(vec2(sid,6.))*.4));
      vec2 q=d.xz/(h+.35)-a0;float tt=ph/.12,hd=tt*.9,al=dot(q,dv),sd2=abs(q.x*dv.y-q.y*dv.x);
      c+=vec3(1.,.95,.85)*step(al,hd)*smoothstep(hd-.25,hd,al)*(1.-smoothstep(0.,.006,sd2))*(1.-tt*.7)*nk*2.5;}
    vec3 mo=normalize(uMoonD);float md=dot(d,mo);   // lune et ses phases
    if(md>.996){vec3 ux=normalize(cross(mo,vec3(0.,1.,0.))),uy=cross(ux,mo);vec2 p=vec2(dot(d,ux),dot(d,uy))/.045;float r2=dot(p,p);
      if(r2<1.){float w=sqrt(max(0.,1.-p.y*p.y)),k=cos(6.2832*uMoonPh);
        float lit=uMoonPh<.5?smoothstep(k*w-.06,k*w+.06,p.x):1.-smoothstep(-k*w-.06,-k*w+.06,p.x);
        vec3 mc=vec3(.93,.94,.98)*(1.-vn(p*3.+4.)*.18),dk=mix(c,vec3(.07,.08,.12),.85);
        c=mix(c,mix(dk,mc,lit),(1.-smoothstep(.85,1.,r2))*uNight*(1.-uDark));}}
    c+=vec3(.25,.3,.45)*pow(max(md,0.),60.)*uNight*.5*(.25+.75*(1.-abs(uMoonPh-.5)*2.));}
  // soleil
  float s=max(dot(d,sd),0.);c+=uSunC*(smoothstep(.9975,.999,s)*2.2+pow(s,28.)*.25+pow(s,6.)*.12*uGold)*uSunK;
  // nuages : couverture selon la météo, éclairés par le soleil (roses au coucher)
  if(h>0.){vec2 cp=d.xz/(h+.12)*1.6+vec2(uTime*.012,uTime*.004);float n=fbm(cp);float cov=smoothstep(1.-uCloud-.18,1.-uCloud+.22,n)*smoothstep(0.,.18,h);
    vec3 lit=mix(vec3(1.),uSunC*1.05+uGlow*uGold*.5,.35+uGold*.4);vec3 cc=mix(lit,vec3(.55,.58,.64),uDark);cc*=mix(1.,.28,uNight);
    cc=mix(cc,cc*.78,smoothstep(.45,.9,n));c=mix(c,cc,cov*.92);}
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`});
  E.sky=new THREE.Mesh(new THREE.SphereGeometry(400,48,24),mat);E.sky.renderOrder=-10;E.sky.frustumCulled=false;E.scene.add(E.sky);
}
const _skyTop=new THREE.Color(),_skyDeep=new THREE.Color('#3f84d0'),_skyNightTop=new THREE.Color('#060b1c'),_skyGoldTop=new THREE.Color('#5a62b8'),_glowC=new THREE.Color('#ff8a4c');
function updateSkyDome(){
  if(!E.sky)return;const U=E.sky.material.uniforms,day=1-E.night,g=E.gold||0,k=S.set.wx&&S.wx?S.wx.k:'clear';
  U.uHor.value.copy(E.scene.background);
  _skyTop.copy(_skyNightTop).lerp(_skyDeep,day).lerp(_skyGoldTop,g*.55);_skyTop.lerp(_wxGrey,(E.wxDark||0)*1.2);U.uTop.value.copy(_skyTop);
  U.uSun.value.copy(E.sun.position).sub(E.sun.target.position).normalize();U.uSunC.value.copy(E.sun.color);U.uGlow.value.copy(_glowC);
  U.uSunK.value=day*(1-(E.wxDark||0)*1.8)*(k==='fog'?.2:1);U.uGold.value=g*(1-(E.wxDark||0));U.uNight.value=E.night;U.uTime.value=E.t;if(U.uMoonPh)U.uMoonPh.value=moonPhase();
  const cw=k==='storm'?.95:k==='rain'?.82:k==='fog'?.7:k==='rainbow'?.45:.32;U.uCloud.value=lerp(U.uCloud.value,cw,.01);U.uDark.value=lerp(U.uDark.value,k==='storm'?.8:k==='rain'?.55:0,.01);
  E.sky.position.copy(E.camera.position);
}
let _fxLoading=null;
// Halo des lumières la nuit (réglage « gfx ») : seulement le bloom, la nuit. Plus d'occlusion SSAO (jugée laide).
function setupFX(){
  if(E.fx||_fxLoading||LOWQ)return _fxLoading;
  const base='https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/';
  _fxLoading=Promise.all(['EffectComposer','RenderPass','UnrealBloomPass','OutputPass'].map(n=>import(base+n+'.js/+esm'))).then(([a,b,d,o])=>{
    const w=Math.max(2,E.stage.clientWidth),h=Math.max(2,E.stage.clientHeight);
    const comp=new a.EffectComposer(E.renderer);comp.addPass(new b.RenderPass(E.scene,E.camera));
    const bloom=new d.UnrealBloomPass(new THREE.Vector2(w/2,h/2),.7,.55,.82);comp.addPass(bloom);comp.addPass(new o.OutputPass());
    E.scene.remove(E.gI);E.ovl=new THREE.Scene();E.ovl.add(E.gI);   // icônes dessinées après le halo
    E.fx={c:comp,bloom,slow:0};resize();
  }).catch(e=>{console.warn('[city] halo indisponible',e);E.fx=null;}).finally(()=>{_fxLoading=null;});
  return _fxLoading;
}
function renderFrame(dt){
  updateSkyDome();adaptRes(dt);shadowGate();
  const F=E.fx,nb=F&&S.set.gfx?clamp((E.night-.45)/.4,0,1):0;
  if(nb>.02){
    F.bloom.strength=(.55-.25*SNOW.value)*nb;F.bloom.threshold=.86;F.c.render(dt);
    if(dt>0&&!document.hidden){F.slow=dt>.05?F.slow+dt:Math.max(0,F.slow-dt*.5);if(F.slow>8){S.set.gfx=false;save();toast('Halo des lumières coupé pour garder le jeu fluide (Réglages pour le remettre).','speed');}}
  }else E.renderer.render(E.scene,E.camera);
  if(E.ovl){E.renderer.autoClear=false;E.renderer.render(E.ovl,E.camera);E.renderer.autoClear=true;}
}
// =========================================================
// Plein écran (ajout 10 nov. 2026) : bouton ⛶ près des commandes de caméra ou touche F, Échap pour sortir.
// Vrai plein écran du navigateur sur #city-root (les panneaux, la fenêtre du défi et les toasts sont dedans) ;
// bouton masqué si le navigateur ne le permet pas (iPhone).
// =========================================================
const FS_OK=!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
function fsEl(){return document.fullscreenElement||document.webkitFullscreenElement||null;}
function isFS(){const f=fsEl();return !!(f&&ROOT&&(f===ROOT||f.contains(ROOT)));}
function setFS(on){
  if(!FS_OK||!ROOT)return;
  try{
    if(on&&!fsEl()){const rq=ROOT.requestFullscreen||ROOT.webkitRequestFullscreen,p=rq.call(ROOT);if(p&&p.catch)p.catch(()=>toast('Le navigateur a refusé le plein écran.','fullscreen'));}
    else if(!on&&fsEl()){const ex=document.exitFullscreen||document.webkitExitFullscreen,p=ex.call(document);if(p&&p.catch)p.catch(()=>{});}
  }catch(e){console.warn('[city] plein écran',e);}
}
function fsSync(){
  const b=$('cty-fs');if(!b)return;const on=isFS(),t=on?'Quitter le plein écran (Échap)':'Plein écran (touche F)';
  b.innerHTML=`<span class="ms">${on?'fullscreen_exit':'fullscreen'}</span>`;b.title=t;b.setAttribute('aria-label',t);b.classList.toggle('active',on);
}
document.addEventListener('fullscreenchange',fsSync);document.addEventListener('webkitfullscreenchange',fsSync);

// Défi en cours (à gauche) et caméra (à droite) : toujours en bas, sur la ligne de la barre d'outils s'il y a
// la place, sinon juste au-dessus — jamais poussés vers le haut par un menu ouvert (ajout 12 nov. 2026)
function placeLow(){
  const box=$('cty'),tools=$('cty-tools'),tuto=$('cty-tuto'),cam=ROOT&&ROOT.querySelector('.cty-cam');if(!box||!tools||!cam)return;
  const bb=box.getBoundingClientRect(),tb=tools.getBoundingClientRect(),th=tools.offsetHeight;if(!th||!bb.width)return;
  const leftFree=tb.left-bb.left-24,rightFree=bb.right-tb.right-24,above=th+12+10;
  box.style.setProperty('--tuto-b',((tuto&&tuto.offsetWidth)||244)<=leftFree?'12px':above+'px');
  const ch=cam.offsetHeight||40;box.style.setProperty('--cam-b',((cam.offsetWidth||250)<=rightFree?12+Math.max(0,(th-ch)/2):above)+'px');
}
// =========================================================
// v4 (12 nov. 2026) : paysages (biomes), rythme du temps, feux tricolores, voitures selon la population,
// métier du joueur (kiné, véto, médecin, dentiste) avec ses cabinets, ses monuments et ses cas cliniques
// =========================================================

// ── Rythme du temps (Réglages) : multiplie la vitesse ▶ de la barre. animK = vitesse de ce qui bouge
// (voitures, bateaux, éoliennes, feux, jour / nuit, météo), un peu moins que proportionnelle pour rester lisible.
const TSP=[.25,.5,1,2,3],TSP_N=['Très lent','Lent','Normal','Rapide','Très rapide'];
function tsp(){return TSP[S&&S.set.tsp!=null?clamp(S.set.tsp|0,0,TSP.length-1):2];}
function timeK(){return(SPEEDS[S.speed]||0)*tsp();}
function animK(){const k=timeK();return k?Math.min(4,Math.pow(k,.8)):0;}

// ── Paysages : un par ville (tiré au hasard à la création, modifiable dans les Réglages) ──
const BIOMES={
  tempere:{n:'Vallée verte',ic:'forest',d:'Une rivière, un lac et des forêts de feuillus.',g:[146,193,108],slab:['#7cb35b','#9b7653','#7a6a5c'],mix:'tempere'},
  montagne:{n:'Montagnes',ic:'landscape',d:'Des sommets enneigés, un torrent et des forêts de sapins.',g:[132,182,104],slab:['#6fa556','#8f7a62','#6d655e'],mtnN:'Montagne',rock:['#8b8f94','#9a9ea3','#7d8186'],snowcap:true,treeLine:4,mtnTrees:.6,mix:'montagne'},
  littoral:{n:'Bord de mer',ic:'beach_access',d:'La mer à l’est, de longues plages et quelques îles.',g:[150,197,112],slab:['#83b95f','#a4825e','#7a6a5c'],beach:true,mix:'littoral'},
  desert:{n:'Désert et oasis',ic:'sunny',d:'Du sable doré, des mesas rouges, un fleuve et une oasis de palmiers.',g:[224,199,146],slab:['#d9b77e','#c08a55','#9a6b45'],mtnN:'Mesa',mesa:true,sandy:true,nosnow:true,mix:'desert'},
  lacs:{n:'Pays des lacs',ic:'kayaking',d:'Des dizaines de lacs, des rochers et la forêt boréale.',g:[126,172,108],slab:['#6c9f58','#8a7560','#6a625c'],mtnN:'Rochers',rock:['#8f9296','#a3a5a2','#7f8486'],treeLine:2,mtnTrees:.45,mix:'lacs'},
  tropical:{n:'Île tropicale',ic:'emoji_nature',d:'Une jungle dense, la mer turquoise et un volcan endormi.',g:[112,188,86],slab:['#6fb24e','#8a6a4a','#5e5248'],mtnN:'Volcan',rock:['#6b5f58','#7a6d63','#5f5550'],volcano:true,beach:true,nosnow:true,treeLine:5,mtnTrees:.7,mtnRound:true,mix:'tropical'}
};
const BIOME_IDS=Object.keys(BIOMES);
function BIO(){return BIOMES[S&&S.biome]||BIOMES.tempere;}
const edgeD=(x,z)=>Math.min(x,z,N-1-x,N-1-z);
function genRiver(R,cx,w0,amp,z0,z1){const p1=R()*6.28,p2=R()*6.28;
  for(let z=z0;z<z1;z++){const xc=cx+Math.sin(z*.11+p1)*amp+Math.sin(z*.29+p2)*amp*.35,w=w0+Math.sin(z*.07+p2)*.6;
    for(let x=Math.floor(xc-w);x<=Math.ceil(xc+w);x++)if(x>=0&&x<N&&Math.abs(x+.5-xc)<=w/2)ter[z*N+x]=1;}}
function genLake(nz,lx,lz,lr,sx){for(let z=0;z<N;z++)for(let x=0;x<N;x++){const d=Math.hypot((x+.5-lx)/(sx||1.3),z+.5-lz)+(nz(x*.3,z*.3)-.5)*2.2;if(d<lr)ter[z*N+x]=1;}}
function genForest(nz,R,th,sp){for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*N+x;if(ter[i]||mtn[i]||Math.hypot(x-27,z-HWZ)<8)continue;
  const n=fbm(nz,x*.09,z*.09);if(n>th)tree[i]=n>th+.12?3:n>th+.06?2:1;else if(R()<sp)tree[i]=1;}}
function nearWater(x,z,r){for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const X=x+dx,Z=z+dz;if(X>=0&&Z>=0&&X<N&&Z<N&&ter[Z*N+X])return true;}return false;}
const GEN={
  montagne(R,nz){
    genRiver(R,39+R()*4,1.7+R()*.5,3.2,0,N);
    genLake(nz,12+R()*4,52+R()*3,2.8+R()*1.2,1.2);
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*N+x,e=edgeD(x,z);if(ter[i]||e>11)continue;
      if(x<27&&Math.abs(z-HWZ)<6)continue;   // col de l'autoroute
      let rv=9;for(let dx=-4;dx<=4;dx++){const X=x+dx;if(X>=0&&X<N&&ter[z*N+X])rv=Math.min(rv,Math.abs(dx));}
      const k=(1-e/11)*1.1+(fbm(nz,x*.08+3,z*.08+9)-.5)*1.6-(rv<4?(4-rv)*.2:0);   // la rivière creuse une vallée
      if(k>.36)mtn[i]=clamp(Math.round(Math.pow(Math.min(k,1.2),1.3)*8),1,9);}
    genForest(nz,R,.5,.03);
  },
  littoral(R,nz){
    const p=R()*6.28;
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const cx=50+Math.sin(z*.12+p)*2.2+(nz(x*.08+7,z*.08+3)-.5)*5;if(x+.5>cx)ter[z*N+x]=1;}
    for(let k=0;k<3;k++){const ix=55+R()*6,iz=6+R()*52,ir=1.4+R()*1.6;   // petites îles
      for(let z=0;z<N;z++)for(let x=46;x<N;x++)if(Math.hypot(x+.5-ix,z+.5-iz)+(nz(x*.4,z*.4)-.5)*1.4<ir)ter[z*N+x]=0;}
    genRiver(R,34+R()*4,1.8+R()*.5,2.4,0,41);
    let xr=36,n=0,s=0;for(let x=26;x<48;x++)if(ter[40*N+x]){s+=x;n++;}if(n)xr=Math.round(s/n);
    for(let x=xr;x<N;x++)for(let z=39;z<=40;z++)ter[z*N+x]=1;   // estuaire jusqu'à la mer
    genForest(nz,R,.6,.02);
  },
  desert(R,nz){
    genRiver(R,40+R()*3,1.6+R()*.5,2.6,0,N);
    genLake(nz,14+R()*3,49+R()*4,2.4+R()*.8,1.1);   // oasis
    for(let k=0,t=0;k<6&&t<80;t++){const cx=2+R()*(N-4),cz=2+R()*(N-4);if(edgeD(cx|0,cz|0)>12||(cx<28&&Math.abs(cz-HWZ)<7))continue;
      const r=2.2+R()*2.4,lv=2+((R()*3)|0);k++;
      for(let z=Math.max(0,(cz-r-2)|0);z<Math.min(N,cz+r+2);z++)for(let x=Math.max(0,(cx-r-2)|0);x<Math.min(N,cx+r+2);x++){const i=z*N+x;
        if(!ter[i]&&Math.hypot(x+.5-cx,z+.5-cz)+(nz(x*.35+k,z*.35)-.5)*1.6<r)mtn[i]=Math.max(mtn[i],lv);}}
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*N+x;if(ter[i]||mtn[i]||Math.hypot(x-27,z-HWZ)<8)continue;
      if(nearWater(x,z,2)){if(R()<.55)tree[i]=R()<.4?2:1;}else if(R()<.025)tree[i]=1;}   // palmiers au bord de l'eau, cactus ailleurs
  },
  lacs(R,nz){
    genRiver(R,40+R()*3,1.9+R()*.5,3,0,N);
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*N+x,c=Math.abs(x-32)<12&&Math.abs(z-32)<12;
      if(x<26&&Math.abs(z-HWZ)<4)continue;
      if(fbm(nz,x*.1+20,z*.1+5)>(c?.72:.62))ter[i]=1;}
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*N+x;if(ter[i]||(Math.abs(x-32)<13&&Math.abs(z-32)<13)||(x<27&&Math.abs(z-HWZ)<5))continue;
      const n2=fbm(nz,x*.13+40,z*.13+17);if(n2>.64)mtn[i]=clamp(1+(((n2-.64)*28)|0),1,3);}
    genForest(nz,R,.47,.035);
  },
  tropical(R,nz){
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const n=(nz(x*.09+5,z*.09+2)-.5)*5;if(x+.5>51+n||z+.5>53+n*.8)ter[z*N+x]=1;}
    genRiver(R,37+R()*3,2+R()*.5,3,0,N);
    const vx=9+R()*4,vz=9+R()*4;   // volcan au nord-ouest, avec son cratère
    for(let z=0;z<22;z++)for(let x=0;x<24;x++){const i=z*N+x,d=Math.hypot(x+.5-vx,z+.5-vz)+(nz(x*.4,z*.4)-.5)*1.1;if(ter[i]||d>=8)continue;
      mtn[i]=d<1.7?5:clamp(Math.round(Math.pow(1-d/8,.8)*10.5),1,9);}
    genForest(nz,R,.42,.05);
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*N+x;if(!ter[i]&&!mtn[i]&&!tree[i]&&nearWater(x,z,1)&&R()<.35&&Math.hypot(x-27,z-HWZ)>=8)tree[i]=1;}
  }
};
function genBiome(seed){
  const R=rng(seed),nz=makeNoise(seed^0x5bd1e995);
  (GEN[S.biome]||GEN.montagne)(R,nz);
  // autoroute et entrée de ville toujours dégagées
  for(let z=HWZ-2;z<=HWZ+2;z++)for(let x=0;x<=HWX+4;x++){const i=z*N+x;mtn[i]=0;if(z===HWZ&&x<=HWX){ter[i]=0;tree[i]=0;road[i]=2;}}
  for(let i=0;i<NN;i++)if(ter[i]||mtn[i])tree[i]=0;
}
// Nouvelle carte (Réglages → Paysage) : tout est rasé et remboursé, comme « Tout raser », puis le terrain change
let BIO_PICK=null;
function newLandscape(b){
  if(VISIT||!BIOMES[b])return;
  if(S.set.asv!==false&&cityValue().n)slotWrite(`Avant le paysage « ${BIOMES[b].n} »`,{auto:'avant'});
  const v=cityValue().v,kept=cityValue().n?prevSave(v):false;   // v4.1 : copie complète de l'ancienne ville (Réglages → Paysage → Récupérer)
  for(const s of [...SV.values()])removeSvc(s.id);
  S.money+=v;S.pol={};S.biome=b;S.seed=(Math.random()*1e9)|0;NZ=makeNoise(S.seed);
  genMap(S.seed);
  UNDO.length=0;S.pat=null;PATRES=null;S.rep=[];S.crisis=null;S.flood=null;S.dists={};S.mlines=[];S.lmods=[];S.dmg={};
  BIO_PICK=null;hideSelection();closePanel();followStop();
  initDerived();terrainChanged();Object.keys(D).forEach(k=>D[k]=true);simRefresh();fullRebuild();camHome();refreshHUD(true);refreshToolbar();
  save();if(v)floatMoney(v);
  toast(`<b>Nouvelle carte : ${BIOMES[b].n}</b>${v?` · +${money(v)} rendus`:''}.${kept?' Ton ancienne ville est gardée : Réglages → Paysage → Récupérer.':''}`,BIOMES[b].ic);
}
// ── Récupérer une ancienne ville (v4.1, 12 nov. 2026) ──
// 1) kcu_city_prev : copie complète gardée avant chaque changement de paysage → retour exact (bâtiments compris)
// 2) sinon, les images mensuelles du timelapse (kcu_city_tl) : terrain, routes, ponts, zones (les maisons reviennent),
//    arbres, collines, décor. Les bâtiments publics (types inconnus, déjà remboursés) sont marqués au sol : S.ghost.
const PREV_KEY='kcu_city_prev';
function prevLoad(){try{return JSON.parse(localStorage.getItem(PREV_KEY)||'null');}catch(e){return null;}}
function prevSave(refund){
  try{const buf=new Uint8Array(NN*LAYERS.length);LAYERS.forEach((a,k)=>buf.set(a,k*NN));
    localStorage.setItem(PREV_KEY,JSON.stringify({t:Date.now(),day:S.day,pop:ST.pop,name:S.name,biome:S.biome||'tempere',seed:S.seed,refund,L:LAYERS.length,map:b64enc(buf),
      svc:[...SV.values()].map(s=>[s.id,s.t,s.x,s.z,s.rot|0]),pol:S.pol,dists:S.dists,mlines:S.mlines}));return true;}
  catch(e){console.warn('[city] copie de l’ancienne ville impossible',e);return false;}
}
// regroupe les images du timelapse par carte (l'eau change d'un coup quand on change de paysage)
let RECOV=null,RECOV_ARM=null;
function tlSegments(){
  const F=tlLoad().f,segs=[];let prev=null,cur=null;
  const water=a=>{const w=new Uint8Array(NN);for(let i=0;i<NN;i++)w[i]=a[i]===1?1:0;return w;};
  for(let k=0;k<F.length;k++){const w=water(tlDecode(F[k][2]));
    if(prev){let d=0;for(let i=0;i<NN;i++)if(w[i]!==prev[i])d++;if(d>120)cur=null;}
    if(!cur){cur={k0:k,k1:k,w};segs.push(cur);}cur.k1=k;cur.w=w;prev=w;}
  const out=[];
  for(const sg of segs){let d=0;for(let i=0;i<NN;i++)if(sg.w[i]!==(ter[i]&&!road[i]?1:0))d++;if(d<=120)continue;   // c'est la carte actuelle
    // l'image la plus récente de cette carte qui contient encore des routes (l'état juste avant le changement)
    for(let k=sg.k1;k>=sg.k0;k--){const a=tlDecode(F[k][2]);let r=0;for(let i=0;i<NN;i++)if(a[i]>=2&&a[i]<=8&&!((i/N|0)===HWZ&&i%N<=HWX))r++;if(r>8){out.push({f:F[k],a,n:r});break;}}}   // l'autoroute ne compte pas
  return out.reverse();
}
function recReset(){
  UNDO.length=0;S.pat=null;PATRES=null;S.rep=[];S.crisis=null;S.flood=null;S.lmods=[];S.dmg={};S.speed=0;
  RECOV=null;RECOV_ARM=null;BIO_PICK=null;hideSelection();closePanel();followStop();
  initDerived();terrainChanged();Object.keys(D).forEach(k=>D[k]=true);simRefresh();fullRebuild();camHome();refreshHUD(true);refreshToolbar();save();
}
function recoverFromFrame(it){
  if(VISIT||!it)return;
  if(S.set.asv!==false)slotWrite('Avant de récupérer une ancienne ville',{auto:'avant'});
  const a=it.a,bio=BIOMES[it.f[3]]?it.f[3]:'tempere',back=cityValue().v,ghost=[];
  for(const s of [...SV.values()])removeSvc(s.id);
  LAYERS.forEach(L=>L.fill(0));
  const isW=i=>a[i]===1;
  for(let i=0;i<NN;i++){const c=a[i],x=i%N,z=(i/N)|0;
    if(c===1)ter[i]=1;
    else if(c===2||c===3){road[i]=c===2?1:(z===HWZ&&x<=HWX?2:3);
      if((z>0&&z<N-1&&isW(i-N)&&isW(i+N))||(x>0&&x<N-1&&isW(i-1)&&isW(i+1)))ter[i]=1;}   // pont au-dessus de l'eau
    else if(c>=4&&c<=8){zone[i]=c<=5?ZR:c===6?ZC:c===7?ZI:ZO;lvl[i]=Math.min(MS[S.ms].maxLvl,c===5?3:2);st[i]=OK;vari[i]=(Math.random()*255)|0;}
    else if(c===9||c===10)ghost.push(i*2+(c===10?1:0));
    else if(c===11)tree[i]=2;
    else if(c===12){if(bio==='tempere')hill[i]=1;else mtn[i]=4;}
    else if(c===13)deco[i]=1;
  }
  for(let x=0;x<=HWX;x++){const i=HWZ*N+x;ter[i]=0;road[i]=2;}
  const cost=cityValue().v;   // les routes reviennent : on reprend ce qui avait été remboursé pour elles
  S.money+=back-cost;S.biome=bio;S.ghost=ghost.length?ghost:null;S.pol={};S.dists={};S.mlines=[];
  recReset();
  toast(`<b>Ville récupérée</b> : terrain, routes et quartiers sont revenus${cost?` (−${money(cost)} pour les routes)`:''}. ${ghost.length?'Les repères violets montrent où reposer tes bâtiments publics (centrales, eau, écoles…). ':''}Le jeu est en pause.`,'history');
}
function restorePrev(){
  const o=prevLoad();if(!o||VISIT)return;
  if(S.set.asv!==false)slotWrite('Avant de récupérer une ancienne ville',{auto:'avant'});
  const back=cityValue().v;
  for(const s of [...SV.values()])removeSvc(s.id);
  const nl=clamp(o.L|0||8,8,LAYERS.length),buf=b64dec(o.map);LAYERS.forEach((a,k)=>{a.fill(0);if(k<nl)a.set(buf.subarray(k*NN,(k+1)*NN));});
  (o.svc||[]).forEach(a=>{if(Array.isArray(a)&&BT[a[1]])addSvc({id:a[0],t:a[1],x:a[2],z:a[3],rot:a[4]},true);});
  S.biome=BIOMES[o.biome]?o.biome:'tempere';if(o.seed)S.seed=o.seed|0;NZ=makeNoise(S.seed);
  S.pol=o.pol&&typeof o.pol==='object'?o.pol:{};S.dists=o.dists&&typeof o.dists==='object'?o.dists:{};S.mlines=Array.isArray(o.mlines)?o.mlines:[];
  S.money+=back-(o.refund|0);S.ghost=null;
  try{localStorage.removeItem(PREV_KEY);}catch(e){}
  recReset();
  toast(`<b>Ville récupérée</b> : tout est revenu, bâtiments compris${o.refund?` (−${money(o.refund)} qui t’avaient été rendus)`:''}. Le jeu est en pause.`,'history');
}
let _ghK=null,_ghM=null;
function ghostMap(){if(!S||!S.ghost)return null;if(_ghK!==S.ghost){_ghK=S.ghost;_ghM=new Map(S.ghost.map(v=>[v>>1,v&1]));}return _ghM;}
function ghostGround(c,i,x,z,px,pz){
  const G_=ghostMap();if(!G_||!G_.has(i)||road[i]||svcAt[i]||zone[i])return;
  const park=G_.get(i),col=park?'47,158,90':'124,77,204',has=j=>G_.has(j);
  c.fillStyle=`rgba(${col},.16)`;c.fillRect(px,pz,PX,PX);c.fillStyle=`rgba(${col},.85)`;
  if(z===0||!has(i-N))c.fillRect(px,pz,PX,2.5);if(z===N-1||!has(i+N))c.fillRect(px,pz+PX-2.5,PX,2.5);
  if(x===0||!has(i-1))c.fillRect(px,pz,2.5,PX);if(x===N-1||!has(i+1))c.fillRect(px+PX-2.5,pz,2.5,PX);
}
function panelRecover(){
  const prev=prevLoad();if(!RECOV)RECOV=tlSegments();
  let h=head('history','Récupérer une ancienne ville','Après un changement de paysage','#7c4dcc');
  if(prev){const m=(prev.day/30)|0;
    h+=`<div class="cty-sec">Ta ville avant le dernier changement</div><div class="cty-recov"><span class="ms">verified</span><div><b>${esc(prev.name)} · ${fmt(prev.pop)} hab.</b><small>${(BIOMES[prev.biome]||BIOMES.tempere).n} · ${MONTHS[m%12]} ${2026+((m/12)|0)} · tout revient, bâtiments compris</small></div>`
      +`<button class="cty-btn${RECOV_ARM==='p'?' danger':''}" data-act="recprev">${RECOV_ARM==='p'?'Confirmer':'Restaurer'}</button></div>`;}
  if(RECOV.length){
    h+=`<div class="cty-sec">D’après le timelapse</div><p class="cty-p small">Le timelapse garde une image de ta ville chaque mois. Elle permet de remettre le terrain, les routes, les zones (les maisons reviennent), les arbres et les collines. Les bâtiments publics, qui t’ont déjà été remboursés, sont marqués au sol en violet pour que tu les reposes.</p>`;
    RECOV.slice(0,5).forEach((it,k)=>{const m=(it.f[0]/30)|0;
      h+=`<div class="cty-recov"><canvas class="cty-recov-cv" data-rcv="${k}" width="64" height="64"></canvas><div><b>${MONTHS[m%12]} ${2026+((m/12)|0)} · ${fmt(it.f[1])} hab.</b><small>${(BIOMES[it.f[3]]||BIOMES.tempere).n} · ${fmt(it.n)} cases de routes et de zones</small></div>`
        +`<button class="cty-btn${RECOV_ARM===k?' danger':''}" data-act="recseg" data-k="${k}">${RECOV_ARM===k?'Confirmer':'Restaurer'}</button></div>`;});}
  if(!prev&&!RECOV.length)h+=`<p class="cty-p">Aucune ancienne ville n’a été trouvée dans ce navigateur (le timelapse ne contient que la carte actuelle).</p>`;
  else h+=`<p class="cty-p small">La carte actuelle est remplacée : ce que tu y as construit t’est remboursé, et tu rends l’argent des routes qui reviennent. Ton palier, tes défis et tes succès ne changent pas. Le jeu se met en pause pour que tu remettes l’électricité et l’eau.</p>`;
  return h;
}
function recDraw(){
  if(PANEL!=='recover'||!RECOV)return;
  ROOT.querySelectorAll('[data-rcv]').forEach(cv=>{const it=RECOV[+cv.dataset.rcv];if(!it)return;const x=cv.getContext('2d'),s=cv.width/N;
    for(let i=0;i<NN;i++){x.fillStyle=TL_COL[it.a[i]]||TL_COL[0];x.fillRect((i%N)*s,((i/N)|0)*s,s+.5,s+.5);}});
}

// ── Sauvegardes de la ville, comme dans un jeu vidéo (v4.2, 12 nov. 2026) ──
// Index kcu_city_saves = [{id,name,t,day,pop,money,biome,ms,city,auto,tl,kb}] (tl = mini-carte codée comme le timelapse).
// Chaque partie : kcu_city_save_<id> = la sauvegarde complète (même texte que kcu_city), compressée lz-string (UTF16).
// Charger une partie garde ce qui est lié à la vraie vie (réglages, métier, défis du jour, questions déjà vues).
// Sauvegardes automatiques (S.set.asv) : toutes les 10 min de jeu et avant les actions risquées ; les SV_AUTO dernières sont gardées.
const SV_IDX='kcu_city_saves',SV_PRE='kcu_city_save_',SV_MAX=12,SV_AUTO=4,SV_AUTO_S=600;
const SV_KEEP=['quiz','qseen','qzBest','quizTot','qf','qzw','qzBig','qzFs','set','prof','helped','v3','v4','twinDay','trophies'];
let SV_ARM=null,SV_EDIT=null;
function savesIdx(){try{const a=JSON.parse(localStorage.getItem(SV_IDX)||'[]');return Array.isArray(a)?a:[];}catch(e){return[];}}
function savesPut(a){localStorage.setItem(SV_IDX,JSON.stringify(a));}
function saveName(){return `${S.name} · ${dateStr()}`;}
function slotWrite(name,opt){
  opt=opt||{};if(VISIT||!S)return null;
  if(typeof LZString==='undefined'){if(!opt.auto)toast('Sauvegarde impossible : recharge la page.','error');return null;}
  save();const raw=localStorage.getItem(KEY);if(!raw)return null;
  const data=LZString.compressToUTF16(raw);let idx=savesIdx();
  const id=opt.id||('s'+Date.now().toString(36)+((Math.random()*1296)|0).toString(36));
  if(opt.auto){const autos=idx.filter(m=>m.auto).sort((a,b)=>a.t-b.t);   // on remplace la plus ancienne sauvegarde automatique
    while(autos.length>=SV_AUTO){const old=autos.shift();idx=idx.filter(m=>m.id!==old.id);try{localStorage.removeItem(SV_PRE+old.id);}catch(e){}}}
  else if(!opt.id&&idx.filter(m=>!m.auto).length>=SV_MAX){toast(`Tu as déjà ${SV_MAX} sauvegardes : supprimes-en une, ou écrase une ancienne.`,'save');return null;}
  const meta={id,name:String(name||'').trim().slice(0,40)||saveName(),t:Date.now(),day:S.day,pop:ST.pop|0,money:Math.round(S.money),biome:S.biome||'tempere',ms:S.ms|0,city:S.name,auto:opt.auto||'',tl:tlEncode(),kb:Math.max(1,Math.round(data.length*2/1024))};
  try{localStorage.setItem(SV_PRE+id,data);idx=idx.filter(m=>m.id!==id);idx.push(meta);savesPut(idx);}
  catch(e){try{if(!opt.id)localStorage.removeItem(SV_PRE+id);}catch(_){}
    if(!opt.auto)toast('Mémoire du navigateur pleine : supprime une ancienne sauvegarde pour en créer une nouvelle.','warning');return null;}
  return meta;
}
function quickSave(){if(VISIT)return;const m=slotWrite(saveName());if(m){toast(`<b>Sauvegarde créée</b> : « ${esc(m.name)} »`,'save');sndPlay('ding');if(PANEL==='saves')renderPanel();}}
function slotData(id){try{const z=localStorage.getItem(SV_PRE+id);if(!z)return null;return JSON.parse(LZString.decompressFromUTF16(z)||'null');}catch(e){return null;}}
function slotLoad(id){
  if(VISIT)return;const m=savesIdx().find(x=>x.id===id);if(!m)return;
  const o=slotData(id);if(!o||!o.map){toast('Cette sauvegarde est illisible : tu peux la supprimer.','error');return;}
  if(S.set.asv!==false)slotWrite(`Avant de charger « ${m.name} »`,{auto:'avant'});   // la ville actuelle n'est jamais perdue
  const keep={};for(const k of SV_KEEP)if(S[k]!==undefined)keep[k]=S[k];
  Object.assign(o,keep);
  try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){toast('Mémoire du navigateur pleine : impossible de charger cette sauvegarde.','warning');return;}
  toolCancel();hideSelection();followStop();UNDO.length=0;PATRES=null;RECOV=null;SV_ARM=null;SV_EDIT=null;
  load();initDerived();
  if(E){if(S.cam)Object.assign(CAM,S.cam);clampCam();applyCam();rebuildGrid();fullRebuild();drawSign();E.asvT=E.t;E.asvDay=S.day;}
  S.speed=0;closePanel();refreshHUD(true);refreshToolbar();extHUD(true);save();
  toast(`<b>Sauvegarde chargée</b> : « ${esc(m.name)} ». Le jeu est en pause (espace pour reprendre).`,'save');
}
function slotDelete(id){let idx=savesIdx();idx=idx.filter(m=>m.id!==id);try{localStorage.removeItem(SV_PRE+id);savesPut(idx);}catch(e){}}
function autoSaveTick(){
  if(VISIT||!E||S.set.asv===false)return;
  if(E.asvT==null){E.asvT=E.t;E.asvDay=S.day;return;}
  if(E.t-E.asvT<SV_AUTO_S)return;E.asvT=E.t;
  if(S.day===E.asvDay)return;E.asvDay=S.day;   // rien n'a bougé (pause) : pas besoin
  slotWrite(`Auto · ${saveName()}`,{auto:'auto'});if(PANEL==='saves')renderPanel();
}
function panelSaves(){
  const idx=savesIdx().sort((a,b)=>b.t-a.t),man=idx.filter(m=>!m.auto),aut=idx.filter(m=>m.auto),kb=idx.reduce((a,m)=>a+(m.kb|0),0);
  let h=head('save','Sauvegardes',`${man.length} / ${SV_MAX} · ${kb>=1024?(kb/1024).toFixed(1).replace('.',',')+' Mo':kb+' Ko'} utilisés`,'#2f6fd6');
  h+=`<div class="cty-svnew"><input id="cty-svname" maxlength="40" placeholder="${esc(saveName())}" aria-label="Nom de la sauvegarde"><button class="cty-btn" data-act="svnew"><span class="ms">save</span>Sauvegarder</button></div>`
    +`<p class="cty-p small">Donne un nom (ou garde celui proposé). Raccourci : Ctrl+S (⌘+S sur Mac) pour une sauvegarde rapide.</p>`;
  const row=m=>{const d=new Date(m.t),when=d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),gm=(m.day/30)|0,arm=x=>SV_ARM===x+m.id;
    return `<div class="cty-svrow"><canvas class="cty-recov-cv" data-svcv="${m.id}" width="64" height="64"></canvas><div class="cty-svinfo">`
      +(SV_EDIT===m.id?`<input class="cty-svren" data-svren="${m.id}" maxlength="40" value="${esc(m.name)}" aria-label="Nouveau nom">`:`<b>${esc(m.name)}</b>`)
      +`<small>${fmt(m.pop)} hab. · ${money(m.money)} · ${(BIOMES[m.biome]||BIOMES.tempere).n}</small><small>${MONTHS[gm%12]} ${2026+((gm/12)|0)} dans le jeu · enregistrée le ${when}</small></div>`
      +`<div class="cty-svbtns"><button class="cty-btn${arm('l')?' danger':''}" data-act="svload" data-k="${m.id}">${arm('l')?'Confirmer':'Charger'}</button><div class="cty-svsmall">`
      +(m.auto?'':`<button data-act="svren" data-k="${m.id}" title="Renommer" aria-label="Renommer"><span class="ms">${SV_EDIT===m.id?'check':'edit'}</span></button><button class="${arm('o')?'arm':''}" data-act="svover" data-k="${m.id}" title="${arm('o')?'Confirmer : remplacer par la ville actuelle':'Écraser avec la ville actuelle'}" aria-label="Écraser"><span class="ms">${arm('o')?'done_all':'sync'}</span></button>`)
      +`<button class="${arm('d')?'arm':''}" data-act="svdel" data-k="${m.id}" title="${arm('d')?'Confirmer la suppression':'Supprimer'}" aria-label="Supprimer"><span class="ms">${arm('d')?'delete_forever':'delete'}</span></button></div></div></div>`;};
  h+=man.length?man.map(row).join(''):`<p class="cty-p">Aucune sauvegarde pour l’instant : clique sur « Sauvegarder » pour garder ta ville telle qu’elle est maintenant.</p>`;
  h+=rewindHTML();
  h+=`<div class="cty-sec">Sauvegardes automatiques</div>`
    +`<button class="cty-sw${S.set.asv!==false?' on':''}" data-act="set" data-k="asv"><span><b>Sauvegarder automatiquement</b><small>Toutes les 10 minutes de jeu et avant chaque action risquée (changer de paysage, tout raser, charger une partie). Les ${SV_AUTO} plus récentes sont gardées.</small></span><i></i></button>`
    +(aut.length?aut.map(row).join(''):'');
  h+=`<p class="cty-p small">Charger une partie remplace la ville en cours (elle est d’abord sauvegardée automatiquement). Tes réglages, ton métier et tes défis du jour ne changent pas.</p>`;
  return h;
}
function svDraw(){
  if(PANEL!=='saves')return;const idx=savesIdx();
  ROOT.querySelectorAll('[data-svcv]').forEach(cv=>{const m=idx.find(x=>x.id===cv.dataset.svcv);if(!m||!m.tl)return;let a;try{a=tlDecode(m.tl);}catch(e){return;}
    const x=cv.getContext('2d'),s_=cv.width/N;for(let i=0;i<NN;i++){x.fillStyle=TL_COL[a[i]]||TL_COL[0];x.fillRect((i%N)*s_,((i/N)|0)*s_,s_+.5,s_+.5);}});
  if(SV_EDIT){const el=ROOT.querySelector('[data-svren]');if(el&&document.activeElement!==el){el.focus();el.select();}}
}
function savesClick(a,k){
  if(a==='svnew'){const el=$('cty-svname'),m=slotWrite(el&&el.value);if(m){toast(`<b>Sauvegarde créée</b> : « ${esc(m.name)} »`,'save');sndPlay('ding');}SV_ARM=null;renderPanel();return true;}
  if(a==='svload'){if(SV_ARM!=='l'+k){SV_ARM='l'+k;renderPanel();}else slotLoad(k);return true;}
  if(a==='svover'){if(SV_ARM!=='o'+k){SV_ARM='o'+k;renderPanel();}else{const m=savesIdx().find(x=>x.id===k);if(m&&slotWrite(m.name,{id:k}))toast(`« ${esc(m.name)} » a été remplacée par ta ville actuelle.`,'sync');SV_ARM=null;renderPanel();}return true;}
  if(a==='svdel'){if(SV_ARM!=='d'+k){SV_ARM='d'+k;renderPanel();}else{slotDelete(k);SV_ARM=null;renderPanel();toast('Sauvegarde supprimée.','delete');}return true;}
  if(a==='svren'){SV_EDIT=SV_EDIT===k?null:k;SV_ARM=null;renderPanel();return true;}
  return false;
}

// =========================================================
// v5 (12 nov. 2026) : lecteur Spotify dans la ville, musiques au choix, remonter le temps, examen blanc,
// compte à rebours des partiels, patients qui reviennent en consultation de suivi
// =========================================================

// ── Lecteur Spotify à droite de la barre du haut (utilise spotify.js : spGetState, spotifyPlayPause…) ──
let _spMode='',_spKey='',SPV_T=0,SP_PREV=50;
const SP_SVG='<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14C9.6 9.9 15 10.56 18.72 12.84c.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z"/></svg>';
const spTime=ms=>{ms=Math.max(0,ms|0);const s=Math.floor(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
/* ── Lecteur Spotify de la ville (refait le 14 nov. 2026) : même présentation que le lecteur de l'appli ──
   Barre : pochette, titre, artiste, précédent / lecture / suivant, flèche « Plus de contrôles ».
   Panneau (survol de la flèche comme dans l'appli, clic = reste ouvert) : moment du morceau, Aléatoire,
   Répéter, appareil, volume, « À suivre ». Couleurs = thème de l'appli (--surface, --on-surface, --on-sv…). */
let SPP_OPEN=false,SPP_PIN=false,SPP_T=0,SPP_BUSY=false,SPP_DRAG=null,SPP_QKEY='',SPP_QN=0;
const SPP_REP={off:['repeat','Répéter','Répéter : désactivé'],context:['repeat','Playlist','Répéter : toute la playlist'],track:['repeat_one','Ce titre','Répéter : ce titre en boucle']};
const spTx=(e,t)=>{if(e&&e.textContent!==t)e.textContent=t;};
function spBarHTML(){
  const cover='<div class="cty-sp-cvw"><img class="cty-sp-cv" alt=""><span class="ms">music_note</span></div>',
        meta='<div class="cty-sp-meta"><b class="cty-sp-t">—</b><small class="cty-sp-a">—</small></div>';
  return `${cover}${meta}
  <div class="cty-sp-ctl">
    <button class="cty-sp-nav" data-act="sp" data-k="prev" title="Morceau précédent"><span class="ms">skip_previous</span></button>
    <button class="pp" data-act="sp" data-k="play" title="Lecture / pause"><span class="ms">play_circle</span></button>
    <button class="cty-sp-nav" data-act="sp" data-k="next" title="Morceau suivant"><span class="ms">skip_next</span></button>
    <button class="cty-sp-more" data-act="sp" data-k="more" title="Plus de contrôles"><span class="ms">expand_more</span></button>
  </div>
  <div class="cty-spp" id="cty-spp">
    <div class="cty-spp-now">${cover}${meta}<button class="cty-spp-nav" data-act="sp" data-k="prev" title="Morceau précédent"><span class="ms">skip_previous</span></button><button class="cty-spp-nav" data-act="sp" data-k="next" title="Morceau suivant"><span class="ms">skip_next</span></button></div>
    <div class="cty-spp-seek"><span class="cty-spp-cur">0:00</span><div class="cty-spp-bar" role="slider" aria-label="Moment du morceau" title="Clique ou glisse pour changer le moment du morceau"><i></i><b></b></div><span class="cty-spp-dur">0:00</span></div>
    <div class="cty-spp-tg">
      <button data-act="sp" data-k="shuf"><span class="ms">shuffle</span><span>Aléatoire</span></button>
      <button data-act="sp" data-k="rep"><span class="ms">repeat</span><span>Répéter</span></button>
      <span class="cty-spp-dev"><span class="ms">devices</span><span>—</span></span>
    </div>
    <div class="cty-spp-vol"><button data-act="sp" data-k="mute" title="Couper / remettre le son"><span class="ms">volume_up</span></button><input type="range" min="0" max="100" step="1" data-spvol="1" aria-label="Volume Spotify" title="Volume"></div>
    <div class="cty-spp-q"><div class="cty-spp-qt">À suivre</div><div class="cty-spp-ql"><div class="cty-spp-qe">Chargement…</div></div></div>
  </div>`;
}
async function spLoadQ(){
  const n=++SPP_QN;let q=[];
  try{if(window.spGetQueue)q=await window.spGetQueue()||[];}catch(e){q=[];}
  const l=document.querySelector('#cty-spp .cty-spp-ql');if(!l||n!==SPP_QN)return;
  l.innerHTML=q.length?q.map((t,i)=>`<div class="cty-spp-qi"><span>${i+1}</span><div><b title="${esc(t.name)}">${esc(t.name)}</b><small>${esc(t.artist)}</small></div></div>`).join('')
    :'<div class="cty-spp-qe">Rien à suivre pour l’instant</div>';
}
function spPanel(open,pin){
  clearTimeout(SPP_T);SPP_OPEN=!!open;SPP_PIN=SPP_OPEN&&!!pin;
  const root=$('cty');if(root)root.classList.toggle('spopen',SPP_OPEN);   /* passe la barre du haut au-dessus des panneaux de la ville */
  const box=$('cty-sp');if(!box)return;
  box.classList.toggle('open',SPP_OPEN);
  if(SPP_OPEN){SPP_QKEY='';spSync();}
}
/* 14 nov. 2026 (demande) : la souris quitte le lecteur → le panneau disparaît tout de suite (pas de délai).
   Le pont invisible .cty-spp::before évite qu'il se ferme en passant de la flèche au panneau. */
const SPP_MOUSE=!!(window.matchMedia&&matchMedia('(hover: hover) and (pointer: fine)').matches);
function spLeaveSoon(){
  clearTimeout(SPP_T);if(!SPP_OPEN||SPP_PIN||SPP_BUSY||SPP_DRAG!=null)return;
  spPanel(false);
}
function spVolUI(box,v){
  const vr=box.querySelector('[data-spvol]');if(vr)vr.style.setProperty('--v',v+'%');
  spTx(box.querySelector('.cty-spp-vol .ms'),v===0?'volume_off':v<40?'volume_down':'volume_up');
}
function spWire(box){
  const more=box.querySelector('.cty-sp-more');
  if(more)more.addEventListener('mouseenter',()=>{clearTimeout(SPP_T);if(!SPP_OPEN)spPanel(true,false);});
  box.addEventListener('mouseenter',()=>clearTimeout(SPP_T));
  box.addEventListener('mouseleave',spLeaveSoon);
  box.addEventListener('keydown',e=>{if(e.key==='Escape'&&SPP_OPEN){e.stopPropagation();spPanel(false);}});
  const pan=box.querySelector('.cty-spp');if(pan)pan.addEventListener('pointerdown',()=>{SPP_BUSY=true;});
  const vr=box.querySelector('[data-spvol]');
  if(vr){vr.addEventListener('input',()=>spVolUI(box,+vr.value));
    vr.addEventListener('change',()=>{SPV_T=performance.now();if(window.spVolumeCommit)window.spVolumeCommit(vr.value);});}
  const bar=box.querySelector('.cty-spp-bar');
  if(bar){
    const at=e=>{const r=bar.getBoundingClientRect();return r.width?clamp((e.clientX-r.left)/r.width,0,1):0;};
    bar.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();try{bar.setPointerCapture(e.pointerId);}catch(_){}
      SPP_DRAG=at(e);bar.classList.add('drag');spSync();});
    bar.addEventListener('pointermove',e=>{if(SPP_DRAG==null)return;SPP_DRAG=at(e);spSync();});
    bar.addEventListener('pointerup',e=>{if(SPP_DRAG==null)return;const f=at(e);SPP_DRAG=null;bar.classList.remove('drag');
      if(window.spSeekTo)window.spSeekTo(f);spSync();});
    bar.addEventListener('pointercancel',()=>{SPP_DRAG=null;bar.classList.remove('drag');spSync();});
  }
  if(!window._sppDoc){window._sppDoc=1;
    document.addEventListener('pointerdown',e=>{const b=$('cty-sp');if(SPP_OPEN&&b&&!b.contains(e.target))spPanel(false);},true);
    document.addEventListener('pointerup',()=>{if(!SPP_BUSY)return;SPP_BUSY=false;const b=$('cty-sp');if(b&&!b.matches(':hover'))spLeaveSoon();},true);
    window.addEventListener('blur',()=>{if(SPP_OPEN&&SPP_DRAG==null){SPP_BUSY=false;spPanel(false);}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&SPP_OPEN){SPP_BUSY=false;SPP_DRAG=null;spPanel(false);}});
  }
}
function spSync(){
  const box=$('cty-sp');if(!box)return;
  const st=typeof window.spGetState==='function'?window.spGetState():null;
  const mode=!st?'none':st.on?'on':'off';
  if(box.dataset.m!==mode){box.dataset.m=mode;_spKey='';SPP_OPEN=SPP_PIN=false;SPP_DRAG=null;clearTimeout(SPP_T);
    {const root=$('cty');if(root)root.classList.remove('spopen');}
    box.className='cty-sp'+(mode==='off'?' off':'');
    box.style.display=mode==='none'?'none':'';
    box.innerHTML=mode==='off'?`<button class="cty-sp-con" data-act="sp" data-k="login" title="Connecter Spotify pour écouter ta musique dans la ville">${SP_SVG}<span>Connecter Spotify</span></button>`
      :mode==='on'?spBarHTML():'';
    if(mode==='on')spWire(box);}
  if(mode!=='on')return;
  const q=s=>box.querySelector(s);
  // place disponible : sans titre sous 260 px (le titre passe en haut du panneau), sans ⏮ ⏭ sous 172 px
  const w=box.clientWidth;
  if(w){const nar=w<260,tiny=w<172;if(box.classList.contains('narrow')!==nar)box.classList.toggle('narrow',nar);if(box.classList.contains('tiny')!==tiny)box.classList.toggle('tiny',tiny);}
  const key=st.track+'|'+st.artist+'|'+st.cover+'|'+st.has;
  if(key!==_spKey){_spKey=key;
    box.querySelectorAll('.cty-sp-t').forEach(e=>{e.textContent=st.has?st.track:'Rien en lecture';e.title=st.has?st.track:'';});
    box.querySelectorAll('.cty-sp-a').forEach(e=>{e.textContent=st.has?st.artist:'Lance une musique sur Spotify';});
    box.querySelectorAll('.cty-sp-cv').forEach(im=>{if(st.cover){if(im.src!==st.cover)im.src=st.cover;im.style.display='';}else im.style.display='none';});
    box.classList.toggle('idle',!st.has);}
  spTx(q('.pp .ms'),st.playing?'pause_circle':'play_circle');
  if(!SPP_OPEN)return;
  if(SPP_QKEY!==_spKey){SPP_QKEY=_spKey;spLoadQ();}
  const dur=st.dur||0,f=SPP_DRAG!=null?SPP_DRAG:dur?clamp(st.pos/dur,0,1):0,pc=(f*100).toFixed(2)+'%';
  q('.cty-spp-bar i').style.width=pc;q('.cty-spp-bar b').style.left=pc;
  spTx(q('.cty-spp-cur'),spTime(SPP_DRAG!=null?f*dur:st.pos));spTx(q('.cty-spp-dur'),spTime(dur));
  const sh=q('[data-k="shuf"]');sh.classList.toggle('on',!!st.shuffle);sh.title=st.shuffle?'Lecture aléatoire : activée':'Lecture aléatoire : désactivée';
  const R=SPP_REP[st.repeat]||SPP_REP.off,rp=q('[data-k="rep"]');
  rp.classList.toggle('on',st.repeat==='context'||st.repeat==='track');spTx(rp.children[0],R[0]);spTx(rp.children[1],R[1]);rp.title=R[2];
  const dv=q('.cty-spp-dev'),dn=st.dev&&st.dev!=='—'?st.dev:'';dv.style.display=dn?'':'none';
  if(dn){spTx(dv.children[0],st.devIc||'devices');spTx(dv.children[1],dn);dv.title='La musique joue sur : '+dn;}
  const vr=q('[data-spvol]');if(performance.now()-SPV_T>1800&&document.activeElement!==vr&&!SPP_BUSY)vr.value=st.vol;
  spVolUI(box,+vr.value);
}
function spClick(a,el,e){
  if(a!=='sp')return false;const k=el.dataset.k;
  if(k==='login'){if(window.spotifyLogin)window.spotifyLogin();return true;}
  if(k==='more'){if(SPP_MOUSE){if(!SPP_OPEN)spPanel(true,false);}else if(SPP_OPEN)spPanel(false);else spPanel(true,true);return true;}
  if(k==='play'){if(window.spotifyPlayPause)window.spotifyPlayPause();}
  else if(k==='next'){if(window.spotifyNext)window.spotifyNext();}
  else if(k==='prev'){if(window.spotifyPrev)window.spotifyPrev();}
  else if(k==='shuf'){if(window.spShuffle)window.spShuffle();}
  else if(k==='rep'){if(window.spRepeat)window.spRepeat();}
  else if(k==='mute'){const st=window.spGetState&&window.spGetState();if(!st)return true;const box=$('cty-sp'),vr=box&&box.querySelector('[data-spvol]');
    let v;if(st.vol>0){SP_PREV=st.vol;v=0;}else v=SP_PREV||50;if(vr){vr.value=v;spVolUI(box,v);}SPV_T=performance.now();if(window.spVolumeCommit)window.spVolumeCommit(v);}
  setTimeout(spSync,60);return true;
}

// ── Musiques au choix (Web Audio, rien à télécharger) ──
const MUSK={douce:'Douce',piano:'Piano',lofi:'Lo-fi',nature:'Nature',retro:'Rétro 8-bit'};
const NOTE=n=>440*Math.pow(2,(n-69)/12);
const PIANO_CH=[[60,64,67,72],[55,62,67,71],[57,60,64,69],[53,57,60,65]],LOFI_CH=[[62,65,69,72],[55,59,62,65],[60,64,67,71],[57,60,64,67]];
function musicStep(t){
  if(t<(SND.musT||0))return;const k=S.set.musk||'douce',m=SND.musS=(SND.musS|0)+1;
  if(k==='piano'){const step=.38;SND.musT=t+step;const ch=PIANO_CH[((m/8)|0)%4],pat=[0,1,2,3,2,1,2,1],n=ch[pat[m%8]];
    sndTone(NOTE(n),t,1.5,.045,'sine');sndTone(NOTE(n+12),t,.6,.008,'triangle');if(m%8===0)sndTone(NOTE(ch[0]-12),t,2.6,.05,'sine');return;}
  if(k==='lofi'){const step=.5;SND.musT=t+step;const b=m%8,ch=LOFI_CH[((m/8)|0)%4];
    if(b===0)ch.forEach((n,j)=>sndTone(NOTE(n),t+j*.03,3.6,.016,'triangle',null,SND.echo));
    if(b%4===0)sndTone(120,t,.22,.07,'sine',45);if(b%4===2)sndNoise(t,.12,.03,1200,'bandpass');
    if(b%2===1)sndNoise(t,.04,.012,7000,'highpass');if(Math.random()<.3)sndNoise(t+Math.random()*.4,.01,.006,4000,'highpass');
    if(b===4&&Math.random()<.6)sndTone(NOTE(rpick(ch)+12),t,1.2,.02,'sine',null,SND.echo);return;}
  if(k==='nature'){SND.musT=t+1.2+Math.random()*1.8;const r=Math.random();
    if(r<.45)sndNoise(t,3.2,.025,380);else if(r<.85){for(let j=0;j<4;j++)sndNoise(t+j*.09+Math.random()*.05,.08,.02,1600+Math.random()*900,'bandpass');}
    else sndTone(rpick([1568,1760,2093,2349]),t,2.6,.02,'sine',null,SND.echo);return;}
  if(k==='retro'){const step=.17;SND.musT=t+step;const sc=[60,62,64,67,69,72,74,76],mel=[0,2,4,5,4,2,3,1,0,2,4,7,6,4,5,3];
    sndTone(NOTE(sc[mel[m%16]]+12),t,.14,.02,'square');if(m%4===0)sndTone(NOTE(sc[mel[(m/4|0)%16]%4]-12),t,.3,.025,'square');if(m%8===4)sndNoise(t,.05,.02,5000,'highpass');return;}
  // douce (d'origine) : petite mélodie pentatonique avec écho
  SND.musT=t+.55+Math.random()*.9;
  const f=rpick(PENTA)*(Math.random()<.3?.5:1);sndTone(f,t,1.6,.035,'triangle',null,SND.echo);sndTone(f,t,1.6,.03,'triangle');
  if(Math.random()<.18){const b=rpick(PENTA)/4;sndTone(b,t,3,.03,'sine');}
}
function musChoice(){
  return `<div class="cty-pchips cty-musk">${Object.entries(MUSK).map(([k,n])=>`<button class="${(S.set.musk||'douce')===k&&S.set.mus?'on':''}" data-act="musk" data-k="${k}"><span class="ms">${{douce:'spa',piano:'piano',lofi:'headphones',nature:'forest',retro:'sports_esports'}[k]}</span>${n}</button>`).join('')}</div>`
    +`<p class="cty-p small">Ou écoute ta propre musique : connecte Spotify, le lecteur apparaît à droite de la barre du haut.</p>`;
}

// ── Remonter le temps : une photo de la ville toutes les 30 s de jeu (en mémoire), jusqu'à 5 min en arrière ──
const REW=[],REW_GAP=30,REW_MAX=11;
function cityRawJSON(){
  if(E&&E.cam)S.cam={x:+CAM.x.toFixed(2),z:+CAM.z.toFixed(2),dist:+CAM.dist.toFixed(2),yaw:+CAM.yaw.toFixed(3),pitch:+CAM.pitch.toFixed(3)};
  const buf=new Uint8Array(NN*LAYERS.length);LAYERS.forEach((a,k)=>buf.set(a,k*NN));
  return JSON.stringify(Object.assign({},S,{map:b64enc(buf),svc:[...SV.values()].map(s=>[s.id,s.t,s.x,s.z,s.rot|0])}));
}
function rewindTick(){
  if(VISIT||!E)return;if(E.rwT==null){E.rwT=E.t;return;}if(E.t-E.rwT<REW_GAP)return;E.rwT=E.t;
  const sig=S.day+'|'+UNDO.length+'|'+Math.round(S.money);if(sig===E.rwSig)return;E.rwSig=sig;
  REW.push({t:Date.now(),day:S.day,pop:ST.pop|0,money:Math.round(S.money),raw:cityRawJSON()});while(REW.length>REW_MAX)REW.shift();
}
function applyCity(o,msg){   // remplace la ville en cours par o (sauvegarde ou photo), en gardant ce qui est lié à la vraie vie
  const keep={};for(const k of SV_KEEP)if(S[k]!==undefined)keep[k]=S[k];Object.assign(o,keep);
  try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){toast('Mémoire du navigateur pleine : impossible de recharger cette ville.','warning');return false;}
  toolCancel();hideSelection();followStop();UNDO.length=0;PATRES=null;RECOV=null;SV_ARM=null;SV_EDIT=null;
  load();initDerived();
  if(E){if(S.cam)Object.assign(CAM,S.cam);clampCam();applyCam();rebuildGrid();fullRebuild();drawSign();E.asvT=E.t;E.asvDay=S.day;E.rwT=E.t;}
  S.speed=0;closePanel();refreshHUD(true);refreshToolbar();extHUD(true);save();
  toast(msg+' Le jeu est en pause (espace pour reprendre).','history');return true;
}
function rewindTo(k){
  const r=REW[k];if(!r||VISIT)return;let o=null;try{o=JSON.parse(r.raw);}catch(e){}if(!o)return;
  if(S.set.asv!==false)slotWrite('Avant de remonter le temps',{auto:'avant'});
  REW.splice(k);applyCity(o,`<b>Retour ${rewAgo(r.t)}</b> : la ville est revenue comme elle était.`);
}
function rewAgo(t){const s=Math.max(1,Math.round((Date.now()-t)/1000));return s<60?`il y a ${s} s`:`il y a ${Math.round(s/60)} min`;}
function rewindHTML(){
  const L=REW.map((r,k)=>({r,k})).reverse();
  return `<div class="cty-sec">Remonter le temps</div>`+(L.length?`<p class="cty-p small">Une photo de ta ville est prise toutes les 30 secondes de jeu : reviens jusqu’à 5 minutes en arrière.</p><div class="cty-rew">`
    +L.map(({r,k})=>`<button class="${SV_ARM==='r'+k?'arm':''}" data-act="rew" data-k="${k}"><b>${SV_ARM==='r'+k?'Confirmer':rewAgo(r.t)}</b><small>${fmt(r.pop)} hab. · ${money(r.money)}</small></button>`).join('')+`</div>`
    :`<p class="cty-p small">Les photos pour remonter le temps arrivent après 30 secondes de jeu.</p>`);
}

// ── Examen blanc du maire : 20 QCM de tes cours, 15 minutes, une note sur 20 et une prime (un par jour) ──
let EXAM=null;const EXAM_N=20,EXAM_S=15*60;
function examStart(){
  if(VISIT)return;const base=quizBase();
  if(base.length<10){toast('Il te faut au moins 10 QCM dans Kiné+ pour passer l’examen blanc.','assignment');return;}
  if(S.examDay===localDay()){toast('Un examen blanc par jour : reviens demain !','event_busy');return;}
  const qs=base.slice().sort(()=>Math.random()-.5).slice(0,Math.min(EXAM_N,base.length)).map(q=>{
    const idx=q.answers.map((_,j)=>j).filter(j=>String(q.answers[j]||'').trim()),ord=idx.slice().sort(()=>Math.random()-.5);
    return{id:q.id,q:String(q.question),a:ord.map(j=>String(q.answers[j])),c:ord.indexOf(q.correct|0),e:q.expl?String(q.expl):''};});
  EXAM={qs,i:0,ans:[],t0:Date.now(),lim:Math.round(EXAM_S*1000*qs.length/EXAM_N)};S.examDay=localDay();save();renderPanel();
}
function examAnswer(j){
  const X=EXAM;if(!X||X.done)return;const q=X.qs[X.i],ok=j===q.c;X.ans.push({j,ok});
  try{if(typeof recordAnswer==='function')recordAnswer(q.id,ok,30);}catch(e){}
  X.i++;if(X.i>=X.qs.length)examFinish(false);else renderPanel();
}
function examFinish(timeout){
  const X=EXAM;if(!X||X.done)return;X.done=true;try{if(typeof saveAll==='function')saveAll();}catch(e){}
  const n=X.qs.length,ok=X.ans.filter(a=>a.ok).length,note=Math.round(ok/n*200)/10,prize=Math.round(ok*2400/n)+(note>=16?1500:note>=12?500:0);
  S.money+=prize;floatMoney(prize);S.examBest=Math.max(S.examBest||0,note);S.stat.exams=(S.stat.exams|0)+1;
  const men=note>=16?'Très bien':note>=14?'Bien':note>=12?'Assez bien':note>=10?'Admis':'À retravailler';
  X.res={ok,n,note,prize,men,timeout:!!timeout};
  news('assignment',`Examen blanc : ${String(note).replace('.',',')}/20 (${men})`,`${ok} bonnes réponses sur ${n}. La mairie verse une prime de ${money(prize)}.`,note>=10?'good':'');
  if(note>=16)fireworks(4,'Mention très bien à l’examen blanc !');sndPlay('coin');save();if(PANEL==='exam')renderPanel();refreshHUD(true);
}
function examTick(){
  const X=EXAM;if(!X||X.done)return;const left=X.lim-(Date.now()-X.t0);
  if(left<=0){examFinish(true);return;}const el=$('cty-exam-t');if(el){el.textContent=spTime(left);el.classList.toggle('low',left<60000);}
}
function panelExam(){
  const X=EXAM,L='ABCDEFGH';
  if(X&&!X.done){const q=X.qs[X.i];
    return head('assignment','Examen blanc du maire',`Question ${X.i+1} / ${X.qs.length}`,'#2f6fd6')
      +`<div class="cty-exam-top"><span class="ms">timer</span><b id="cty-exam-t">${spTime(X.lim-(Date.now()-X.t0))}</b><div class="cty-exam-pg"><i style="width:${(X.i/X.qs.length*100).toFixed(1)}%"></i></div></div>`
      +`<div class="cty-case"><b>${esc(q.q)}</b></div><div class="cty-qas">${q.a.map((a,j)=>`<button class="cty-qa" data-act="exa" data-j="${j}"><b>${L[j]||j+1}</b><span>${esc(a)}</span></button>`).join('')}</div>`
      +`<p class="cty-p small">Pas de correction pendant l’examen : tu verras tout à la fin. Fermer la fenêtre ne met pas le chrono en pause.</p>`;}
  if(X&&X.done&&X.res){const r=X.res,wrong=X.qs.map((q,k)=>({q,a:X.ans[k]})).filter(o=>!o.a||!o.a.ok);
    return head('workspace_premium','Résultats de l’examen blanc',r.timeout?'Temps écoulé':'Examen terminé','#2f6fd6')
      +`<div class="cty-exam-res"><b>${String(r.note).replace('.',',')}<small>/20</small></b><span>${r.men}</span><small>${r.ok} bonnes réponses sur ${r.n} · prime ${money(r.prize)}</small></div>`
      +(wrong.length?`<div class="cty-sec">À revoir (${wrong.length})</div>`+wrong.map(({q,a})=>`<div class="cty-letter"><p><b>${esc(q.q)}</b></p><p>${a?`Ta réponse : ${esc(q.a[a.j])}<br>`:'Pas de réponse<br>'}✅ ${esc(q.a[q.c]||'')}</p>${q.e?`<p class="small">${esc(q.e)}</p>`:''}</div>`).join(''):'<p class="cty-p">Sans faute, bravo !</p>')
      +`<button class="cty-btn" data-act="examclose"><span class="ms">check</span>Terminer</button>`;}
  const done=S.examDay===localDay(),n=quizBase().length;
  return head('assignment','Examen blanc du maire','20 QCM de tes cours · 15 minutes','#2f6fd6')
    +`<p class="cty-p">Comme le jour J : 20 questions tirées de tous tes cours, un chrono de 15 minutes, et la correction seulement à la fin. Chaque réponse compte comme une vraie révision.</p>`
    +rows([['payments','Prime','jusqu’à 3 900 § (mention très bien : +1 500 §)'],['military_tech','Meilleure note',S.examBest?String(S.examBest).replace('.',',')+' / 20':'—'],['quiz','QCM disponibles',fmt(n)]])
    +(done?`<p class="cty-p small">Tu as déjà passé l’examen blanc aujourd’hui : reviens demain !</p>`:`<button class="cty-btn" data-act="examgo"${n<10?' disabled':''}><span class="ms">play_arrow</span>Commencer l’examen</button>`);
}

// ── Compte à rebours des partiels : panneau à l'entrée de la ville, guirlandes de fanions quand l'examen approche ──
function cdCheck(){
  if(VISIT||!S)return;let ex=[];try{ex=typeof getExamsV2==='function'?getExamsV2():[];}catch(e){ex=[];}
  const t0=new Date().setHours(0,0,0,0);let best=null;
  for(const e of ex||[]){if(!e||!e.date)continue;const d=new Date(e.date).setHours(0,0,0,0);if(isNaN(d))continue;const n=Math.round((d-t0)/864e5);if(n>=0&&n<=60&&(!best||n<best.days))best={name:String(e.name||'Partiel'),days:n};}
  S.cd=best;cdSignSync();
  if(best&&best.days===0&&S.cdFw!==best.name+localDay()){S.cdFw=best.name+localDay();setTimeout(()=>fireworks(6,`C’est le jour J : bon courage pour « ${best.name} » !`),1500);}
}
function cdSignSync(){
  if(!E)return;const cd=S.cd,key=cd?cd.name+'|'+cd.days:'';
  if(!E.cdSign){if(!cd)return;
    const cv=cvs(512,256),tex=ctex(cv,false),g=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({map:tex}),pl=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.8),mat);pl.position.y=1.05;g.add(pl);
    const back=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.8),new THREE.MeshLambertMaterial({color:'#2b3a33'}));back.position.y=1.05;back.rotation.y=Math.PI;g.add(back);
    for(const s of[-.65,.65]){const p=new THREE.Mesh(new THREE.BoxGeometry(.05,.65,.05),new THREE.MeshLambertMaterial({color:'#7d858c'}));p.position.set(s,.33,-.01);g.add(p);}
    g.position.set(4.3,0,HWZ+1.25);g.rotation.y=.35;E.gD.add(g);E.cdSign={g,cv,tex,key:''};}
  const C=E.cdSign;C.g.visible=!!cd;if(!cd||C.key===key)return;C.key=key;
  const x=C.cv.getContext('2d');x.fillStyle='#1f5f45';x.fillRect(0,0,512,256);x.strokeStyle='#fff';x.lineWidth=8;x.strokeRect(8,8,496,240);
  x.fillStyle='#ffd166';x.textAlign='center';x.textBaseline='middle';x.font='900 92px Manrope, sans-serif';x.fillText(cd.days?`J-${cd.days}`:'JOUR J',256,92);
  x.fillStyle='#fff';let fs=34;x.font=`800 ${fs}px Manrope, sans-serif`;while(x.measureText(cd.name).width>460&&fs>16){fs-=2;x.font=`800 ${fs}px Manrope, sans-serif`;}
  x.fillText(cd.name,256,168);x.font='600 22px Manrope, sans-serif';x.fillStyle='#cfe8dc';x.fillText(cd.days?'Révise avec le Défi du maire !':'Bon courage !',256,212);C.tex.needsUpdate=true;
}
function rebuildBunting(){
  if(!E)return;const on=!!(S.fest&&!VISIT);
  if(!E.bunt){if(!on)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,0,-.07,0],3));g.computeVertexNormals();
    E.bunt=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:'#fff',side:THREE.DoubleSide}),1400);E.bunt.frustumCulled=false;E.bunt.setColorAt(0,new THREE.Color());E.gC.add(E.bunt);}
  const B=E.bunt;B.visible=on;if(!on)return;
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(1,1,1),c=new THREE.Color(),cols=['#e63946','#f2c14e','#2a9d8f','#3b8fdc','#ffffff','#e05a8a'];let n=0;
  for(let i=0;i<NN&&n<1390;i++){if(!(road[i]===1||road[i]===3)||ter[i])continue;const x=i%N,z=(i/N)|0;if((x*7+z*13)%4)continue;if(!inArea(x,z))continue;
    const mk=roadMask(x,z),across=mk===5||mk===1||mk===4?0:Math.PI/2;   // la guirlande traverse la rue
    for(let k=0;k<7;k++){const u=-.42+k*.14;e.set(0,across,0);q.setFromEuler(e);
      const ox=across?0:u,oz=across?u:0;p.set(x+.5+ox,.42-Math.sin((k/6)*Math.PI)*.05,z+.5+oz);m.compose(p,q,s);B.setMatrixAt(n,m);c.set(cols[(k+x+z)%cols.length]);B.setColorAt(n,c);n++;}}
  B.count=n;B.instanceMatrix.needsUpdate=true;if(B.instanceColor)B.instanceColor.needsUpdate=true;E.buntK=on;
}

// ── Grues animées sur les chantiers : lots en construction et bâtiments posés depuis moins de 18 jours ──
function makeCranes(){
  const mk=fn=>{GB=new Map();TX.x=0;TX.z=0;TX.k=0;fn();const g=toGeo(GB.get('plain'));GB=null;return g;};
  const mast=mk(()=>{bc(0,0,.028,.028,0,1,'#f2b134');for(let k=1;k<8;k++)bc(0,0,.034,.034,k/8-.006,k/8+.006,'#d99a1e');});
  const jib=mk(()=>{bx(-.28,-.02,.78,.02,0,.04,'#f2b134');bx(-.28,-.04,-.14,.04,-.07,.03,'#7d858c');bc(.06,0,.04,.035,-.1,0,'#3b4651');bc(.62,0,.004,.004,-.42,0,'#2e3a46');bc(.62,0,.02,.02,-.46,-.42,'#2e3a46');});
  const mat=new THREE.MeshLambertMaterial({vertexColors:true});
  E.cranes={mast:new THREE.InstancedMesh(mast,mat,48),jib:new THREE.InstancedMesh(jib,mat,48),list:[],chk:-9,ct:0};
  [E.cranes.mast,E.cranes.jib].forEach(m=>{m.count=0;m.frustumCulled=false;m.castShadow=true;E.gC.add(m);});
}
function stepCranes(run){
  if(!E.cranes)makeCranes();const C=E.cranes;C.ct+=run;
  if(E.t-C.chk>.5){C.chk=E.t;const L=[];
    for(let i=0;i<NN&&L.length<40;i++)if(st[i]===BUILD&&lvl[i]&&zone[i]){const sp=lotSpec(zone[i],lvl[i],vari[i]);L.push([i%N+.82,((i/N)|0)+.82,Math.max(.9,sp.f*FH*(zone[i]===ZI?1.2:1)+.45),hash(i*13)*6.28]);}
    if(S.cons)for(const id in S.cons){const s=SV.get(+id);if(!s||S.day>S.cons[id]){delete S.cons[id];continue;}if(L.length<48)L.push([s.x+.3,s.z+.3,Math.max(1.2,(TOP[s.z*N+s.x]||1)+.45),hash(+id)*6.28]);}
    C.list=L;}
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),sc=new THREE.Vector3();let n=0;
  for(const [x,z,h,ph] of C.list){p.set(x,0,z);q.identity();sc.set(1,h,1);m.compose(p,q,sc);C.mast.setMatrixAt(n,m);
    e.set(0,ph+C.ct*.45+Math.sin(C.ct*.3+ph)*.6,0);q.setFromEuler(e);p.set(x,h,z);sc.set(1,1,1);m.compose(p,q,sc);C.jib.setMatrixAt(n,m);n++;}
  C.mast.count=C.jib.count=n;C.mast.instanceMatrix.needsUpdate=C.jib.instanceMatrix.needsUpdate=true;
}

// ── Bâtiments propres à chaque métier (affichés seulement pour le métier choisi) ──
const PROF_BLD=[
  {id:'refuge',prof:'veto',name:'Refuge pour animaux',cat:'services',w:2,cost:3000,upkeep:35,cov:{park:6,lv:3},tour:2,ms:1,icon:'pets',desc:'Chiens et chats attendent une famille : les habitants adorent venir les promener.'},
  {id:'parccanin',prof:'veto',name:'Parc canin',cat:'parcs',w:1,cost:400,upkeep:5,cov:{park:5},ms:0,icon:'sound_detection_dog_barking',desc:'Un enclos avec parcours d’agilité pour les chiens du quartier.'},
  {id:'ferme',prof:'veto',name:'Ferme pédagogique',cat:'loisirs',w:3,cost:5500,upkeep:60,cov:{park:9,edu:5},tour:5,ms:2,icon:'agriculture',desc:'Moutons, poules et chèvres : les écoles viennent en sortie.'},
  {id:'garde',prof:'med',name:'Maison médicale de garde',cat:'services',w:2,cost:4000,upkeep:70,cov:{health:12},ms:1,icon:'emergency',desc:'Des médecins le soir et le week-end : la santé de tout un quartier.'},
  {id:'vaccin',prof:'med',name:'Centre de vaccination',cat:'services',w:1,cost:1200,upkeep:20,cov:{health:7},ms:0,icon:'vaccines',desc:'Les épidémies se propagent moins vite autour.'},
  {id:'pharma',prof:'med',name:'Pharmacie',cat:'services',w:1,cost:700,upkeep:12,cov:{health:4,lv:2},ms:0,icon:'local_pharmacy',desc:'Une croix verte qui clignote au coin de la rue.'},
  {id:'dentenf',prof:'dent',name:'Centre dentaire pour enfants',cat:'services',w:2,cost:3500,upkeep:55,cov:{health:9,edu:3},ms:1,icon:'child_care',desc:'Des soins tout en douceur et une aire de jeux pour les petits.'},
  {id:'labo',prof:'dent',name:'Laboratoire de prothèses',cat:'economie',w:2,cost:3000,upkeep:30,cov:{lv:2},jobs:30,ms:1,icon:'science',desc:'Couronnes et appareils fabriqués sur place : des emplois qualifiés.'},
  {id:'ortho',prof:'dent',name:'Cabinet d’orthodontie',cat:'services',w:1,cost:1500,upkeep:22,cov:{health:6,lv:3},ms:0,icon:'sentiment_very_satisfied',desc:'Des sourires bien alignés dans tout le quartier.'},
  {id:'balneo',prof:'kine',name:'Centre de balnéothérapie',cat:'loisirs',w:2,cost:4500,upkeep:55,cov:{health:8,park:6},tour:3,ms:1,icon:'pool',desc:'Rééducation dans l’eau chaude : santé et détente.'},
  {id:'piste',prof:'kine',name:'Piste d’athlétisme',cat:'parcs',w:3,cost:3500,upkeep:35,cov:{park:10,health:3},ms:1,icon:'sprint',desc:'Les coureurs du quartier s’y entraînent matin et soir.'},
  {id:'sportk',prof:'kine',name:'Cabinet du sport',cat:'services',w:1,cost:1100,upkeep:20,cov:{health:6,park:2},ms:0,icon:'sports_gymnastics',desc:'Le kiné des sportifs : entorses, tendinites et reprise du sport.'}
];
PROF_BLD.forEach(b=>{b.d=b.w;if(!BT[b.id]){BLD.push(b);BT[b.id]=b;}});
function dogFig(x,z,col){const c=col||'#c58b4e',d='#8a5a30';for(const[lx,lz]of[[-.035,-.012],[-.035,.012],[.035,-.012],[.035,.012]])bc(x+lx,z+lz,.006,.006,0,.04,c);
  bc(x,z,.045,.02,.04,.072,c);bc(x+.055,z,.02,.018,.06,.097,c);bc(x+.08,z,.011,.011,.064,.081,d);bc(x+.05,z-.015,.006,.004,.095,.112,d);bc(x+.05,z+.015,.006,.004,.095,.112,d);bc(x-.045,z,.005,.005,.065,.1,c);}
function signPanel(x,z,y,col){bx(x-.11,z-.004,x+.11,z+.004,y,y+.21,col);}
Object.assign(SVB,{
  refuge(r){bx(-.9,-.9,.05,-.15,0,FH*1.4,'#f3ead8',FRs(),'#e2d6bd');gable(-.95,-.95,.1,-.1,FH*1.4,.22,'#b5523b',true,'#f3ead8');
    signPanel(-.42,-.1,FH*1.4-.24,'#3f9b4f');bx(-.47,-.093,-.37,-.085,FH*1.4-.2,FH*1.4-.12,'#ffffff','basic');
    bx(.15,-.9,.92,.9,0,.012,'#8fca6a');for(let k=0;k<9;k++){bc(.15,-.9+k*.225,.012,.012,0,.16,'#8d6e4f');bc(.92,-.9+k*.225,.012,.012,0,.16,'#8d6e4f');}bx(.15,-.9,.92,-.88,.12,.14,'#8d6e4f');bx(.15,.88,.92,.9,.12,.14,'#8d6e4f');
    for(const[x,z]of[[.45,-.55],[.7,.4]]){bc(x,z,.09,.08,0,.11,'#c79a6a');gable(x-.1,z-.09,x+.1,z+.09,.11,.07,'#8a5a30',true,'#c79a6a');}
    dogFig(.4,.1,'#c58b4e');dogFig(.65,-.15,'#3b3029');dogFig(-.4,.4,'#e9dcc3');tree3(-.75,.6,.1);return .8;},
  parccanin(r){bx(-.48,-.48,.48,.48,0,.015,'#86c96a');for(let k=0;k<5;k++){const u=-.46+k*.23;bc(u,-.46,.008,.008,0,.12,'#8d6e4f');bc(u,.46,.008,.008,0,.12,'#8d6e4f');bc(-.46,u,.008,.008,0,.12,'#8d6e4f');bc(.46,u,.008,.008,0,.12,'#8d6e4f');}
    for(let k=0;k<5;k++)bc(-.3+k*.12,-.2,.008,.008,0,.13,k%2?'#e63946':'#ffffff');bc(.15,.2,.008,.008,0,.16,'#f2b134');bc(.35,.2,.008,.008,0,.16,'#f2b134');bx(.15,.19,.35,.21,.15,.17,'#f2b134');
    dogFig(-.1,.15,'#c58b4e');tree3(.32,-.3,.07);return .3;},
  ferme(r){bx(-1.35,-1.25,-.25,-.2,0,.5,'#c0392b');gable(-1.4,-1.3,-.2,-.15,.5,.32,'#5b3a2e',true,'#c0392b');bx(-.9,-.205,-.7,-.19,0,.32,'#f4f1ea');
    cyl(.75,-.85,0,1.05,.27,.27,12,'#d9d4cc','#c9c3b9');cone(.75,-.85,1.05,.25,.29,12,'#8a8f96');
    for(let k=0;k<4;k++)bx(-1.4,.1+k*.32,1.4,.26+k*.32,0,.02,k%2?'#d7c25a':'#7fb85a');
    for(let k=0;k<5;k++)ico(-1+k*.45,.08,1.25-(k%2)*.1,.06,'#f7f6f2',.8);bc(.2,-.6,.03,.04,0,.06,'#4a3426');tree3(1.25,.1,.1);return 1.3;},
  garde(r){bx(-.85,-.85,.85,.25,0,FH*2.2,'#f6f8f8',FRs(),'#e1e6e6');bx(-.86,-.86,.86,.26,FH*2.2,FH*2.2+.05,'#d64545');
    signPanel(0,.255,FH*1.2,'#d64545');bx(-.025,.26,.025,.27,FH*1.2+.03,FH*1.2+.18,'#ffffff','basic');bx(-.07,.26,.07,.27,FH*1.2+.08,FH*1.2+.13,'#ffffff','basic');
    bc(.45,.62,.13,.06,.015,.1,'#ffffff');bx(.32,.555,.58,.565,.05,.07,'#d64545');bc(.4,.62,.02,.02,.1,.12,'#3b8fdc','basic');bc(-.5,.6,.05,.05,0,.3,'#9aa0a6');return .9;},
  vaccin(r){bc(0,-.08,.38,.3,0,FH*1.4,'#ffffff',FRs(),'#e6eef7');bx(-.4,-.4,.4,.24,FH*1.4,FH*1.4+.05,'#3b8fdc');
    bx(-.12,.225,.12,.24,.3,.36,'#3b8fdc','basic');bx(.12,.225,.18,.24,.32,.34,'#9aa0a6','basic');bx(-.16,.225,-.12,.24,.31,.35,'#3b8fdc','basic');tree3(-.38,.38,.07);tree3(.38,.38,.07);return .6;},
  pharma(r){bc(0,-.08,.38,.3,0,FH*1.6,'#eef3ee',FRs(),'#dfe8df');wedge(-.36,.22,.36,.34,.28,.33,.29,'#2f9e5a');
    bc(.32,.36,.012,.012,0,.5,'#4a5058');bx(.305,.34,.335,.38,.5,.64,'#3ddc84','basic');bx(.27,.34,.37,.38,.55,.59,'#3ddc84','basic');return .7;},
  dentenf(r){bx(-.85,-.85,.45,.2,0,FH*2,'#ffd6e0',FRs(),'#f5c2cf');bx(-.86,-.86,.46,.21,FH*2,FH*2+.05,'#7ec8e3');
    signPanel(-.2,.205,FH*1.15,'#7ec8e3');bx(-.26,.21,-.14,.22,FH*1.15+.1,FH*1.15+.18,'#ffffff','basic');bx(-.255,.21,-.215,.22,FH*1.15+.03,FH*1.15+.1,'#ffffff','basic');bx(-.185,.21,-.145,.22,FH*1.15+.03,FH*1.15+.1,'#ffffff','basic');
    wedge(.55,-.4,.85,.3,0,.32,0,'#f2b134');bc(.7,.55,.012,.012,0,.3,'#e63946');bc(.9,.55,.012,.012,0,.3,'#e63946');bx(.7,.54,.9,.56,.29,.31,'#e63946');bx(.77,.545,.83,.555,.12,.14,'#3b8fdc');tree3(-.6,.6,.09);return .8;},
  labo(r){bx(-.85,-.85,.85,.15,0,FH*2,'#cfd6dd',FRs(),'#aeb8c2');bx(-.86,-.86,.86,.16,FH*2,FH*2+.04,'#5c6b78');cyl(.6,-.6,FH*2,FH*2+.45,.07,.06,8,'#8a96a2');
    signPanel(-.3,.155,FH*1.1,'#2aa7d6');bx(-.36,.16,-.24,.17,FH*1.1+.1,FH*1.1+.18,'#ffffff','basic');bx(-.355,.16,-.315,.17,FH*1.1+.03,FH*1.1+.1,'#ffffff','basic');bx(-.285,.16,-.245,.17,FH*1.1+.03,FH*1.1+.1,'#ffffff','basic');
    for(const x of[.2,.55])bc(x,.55,.12,.07,.015,.12,'#e9eef2');return .9;},
  ortho(r){bc(0,-.08,.36,.28,0,FH*2,'#f6f8f8',FRs(),'#e1e6e6');bx(-.37,-.37,.37,.21,FH*2,FH*2+.04,'#2f6fd6');
    signPanel(0,.205,FH*1.1,'#2f6fd6');const y=FH*1.1;for(let k=0;k<7;k++){const a=Math.PI*(k/6),cx=Math.cos(a)*.075,cy=y+.12-Math.sin(a)*.06;bx(-cx-.012,.21,-cx+.012,.22,cy-.01,cy+.01,'#ffffff','basic');}
    for(let k=0;k<4;k++)bx(-.05+k*.033,.215,-.042+k*.033,.222,y+.07,y+.08,'#9aa0a6','basic');tree3(-.38,.38,.07);tree3(.38,.38,.07);return .75;},
  balneo(r){bx(-.85,-.85,.85,-.15,0,FH*1.6,'#f0f7f9',FRs(),'#d9eaef');bx(-.86,-.86,.86,-.14,FH*1.6,FH*1.6+.04,'#0e8c87');
    bx(-.78,0,.78,.82,0,.03,'#e3ddd2');bx(-.66,.1,.66,.72,.03,.036,'#4fc3e8','basic');for(const x of[-.5,-.2,.1,.4])bx(x-.04,-.08,x+.04,-.02,.03,.06,'#ffffff');return .7;},
  piste(r){bx(-1.45,-1.05,1.45,1.05,0,.012,'#c0392b');bx(-1.12,-.72,1.12,.72,0,.016,'#5fae4a');
    for(const d of[.08,.16,.24])bx(-1.12-d,-.72-d,1.12+d,-.72-d+.006,.012,.016,'#ffffff');
    wedge(-1.2,1.1,1.2,1.4,0,.05,.32,'#9aa0a6');bc(.4,0,.02,.02,0,.06,'#f2b134');return .45;},
  sportk(r){bc(0,-.08,.36,.28,0,FH*1.6,'#ffffff',FRs(),'#ececec');bx(-.37,-.37,.37,.21,FH*1.6,FH*1.6+.04,'#f08c3a');
    signPanel(0,.205,FH*.9,'#f08c3a');const y=FH*.9+.1;bx(-.07,.21,.07,.22,y-.008,y+.008,'#ffffff','basic');bx(-.09,.21,-.06,.22,y-.04,y+.04,'#ffffff','basic');bx(.06,.21,.09,.22,y-.04,y+.04,'#ffffff','basic');
    tree3(-.38,.38,.07);bc(.35,.38,.03,.03,0,.25,'#4a5058');return .7;}
});

// ── Virages arrondis : une route qui tourne (deux côtés voisins) est dessinée en quart de cercle ──
function drawCurve(c,m,px,pz){
  const cx=px+(m===3||m===6?PX:0),cy=pz+(m===6||m===12?PX:0),sw=5;
  c.fillStyle='#d3d6d8';c.beginPath();c.arc(cx,cy,PX,0,7);c.fill();
  c.fillStyle='#5d646c';c.beginPath();c.arc(cx,cy,PX-sw,0,7);c.arc(cx,cy,sw,0,7,true);c.fill();
  c.fillStyle=asphPat(c);c.beginPath();c.arc(cx,cy,PX-sw,0,7);c.arc(cx,cy,sw,0,7,true);c.fill();   /* v12 : asphalte grainé */
  c.strokeStyle='rgba(0,0,0,.13)';c.lineWidth=1;c.beginPath();c.arc(cx,cy,PX-sw+.5,0,7);c.stroke();
  c.strokeStyle='#f3f1e7';c.lineWidth=1.2;c.setLineDash([9,7]);c.beginPath();c.arc(cx,cy,H2,0,7);c.stroke();c.setLineDash([]);
}

// ── Ponts routiers : une route en hauteur, en ligne droite, qui passe au-dessus des routes, des rails et de l'eau ──
// S.ovs = [{a, b, d, n}] : a et b = cases de route aux deux bouts, d = direction de a vers b, n = nombre de pas (≥ 4).
// Case k = 1 et k = n-1 : rampes ; 2 … n-2 : tablier à OVP_H. Les voitures y montent par un bout et redescendent par l'autre.
const OVP_H=.42,OVP_COST=120,OVT=new Int16Array(NN).fill(-1),OVK=new Uint8Array(NN);let OVE=new Map();
function ovpIndex(){
  if(!S)return;if(!Array.isArray(S.ovs))S.ovs=[];OVT.fill(-1);OVK.fill(0);OVE=new Map();
  S.ovs.forEach((o,s)=>{const ux=DIRS[o.d][0],uz=DIRS[o.d][1],x0=o.a%N,z0=(o.a/N)|0;
    for(let k=1;k<o.n;k++){const i=(z0+uz*k)*N+x0+ux*k;OVT[i]=s;OVK[i]=k;}
    const add=(t,d,to)=>{let L=OVE.get(t);if(!L)OVE.set(t,L=[]);L.push({s,d,to});};add(o.a,o.d,o.b);add(o.b,(o.d+2)%4,o.a);});
}
function ovpValidate(){   // un pont dont un bout n'est plus une route disparaît (son prix est rendu)
  if(!S||!S.ovs||!S.ovs.length)return;let back=0;
  const keep=S.ovs.filter(o=>{const ok=(road[o.a]===1||road[o.a]===3)&&(road[o.b]===1||road[o.b]===3);if(!ok)back+=OVP_COST*(o.n-1);return ok;});
  if(keep.length!==S.ovs.length){S.ovs=keep;S.money+=back;ovpChanged(true);toast(`Un pont routier n’était plus relié à une route : il a été démoli (+${money(back)}).`,'alt_route');}
}
function ovpChanged(quiet){
  ovpIndex();if(!quiet)D.roads=true;rebuildOvp();
  if(E){const ends=new Set();for(const o of S.ovs||[]){ends.add(o.a);ends.add(o.b);}for(const i of(V15.ovEnds||[]))ends.add(i);for(const i of ends)touch(i,true);V15.ovEnds=[...ends];}   /* v15 : le sol des bouts du pont est redessiné (raccord) */
  if(E)for(const C of[E.cars,E.buses])if(C)for(const c of C.list)if(c.ov!=null){c.ov=null;spawnCar(c,C);}
}
function ovpPlan(x0,z0,x1,z1){
  const dx=x1-x0,dz=z1-z0;let d,n;if(Math.abs(dx)>=Math.abs(dz)){d=dx>=0?1:3;n=Math.abs(dx);}else{d=dz>=0?2:0;n=Math.abs(dz);}
  const ux=DIRS[d][0],uz=DIRS[d][1],T=[];let ok=n>=4,why=n>=4?'':'Un pont routier fait au moins 5 cases : une rampe, au moins une case en hauteur, une rampe';
  for(let k=0;k<=n;k++){const X=x0+ux*k,Z=z0+uz*k;if(X<0||Z<0||X>=N||Z>=N){ok=false;why='Hors de la carte';break;}const i=Z*N+X;let g=true,r='';
    if(!inArea(X,Z)){g=false;r='Hors de ton terrain';}
    else if(k===0||k===n){if(!(road[i]===1||road[i]===3)||ter[i]){g=false;r='Commence et termine le pont sur une route';}}
    else if(OVT[i]>=0){g=false;r='Il y a déjà un pont routier ici';}
    else if(k===1||k===n-1){if(road[i]||zone[i]||svcAt[i]||hill[i]||mtn[i]||deco[i]){g=false;r='Les rampes ont besoin d’une case libre à chaque bout';}}
    else if(svcAt[i]||zone[i]||hill[i]||mtn[i]){g=false;r='Le pont ne passe pas au-dessus des bâtiments ni des zones';}
    T.push({X,Z,i,k,g});if(!g){ok=false;why=why||r;}}
  return{ok,why,T,d,n,a:z0*N+x0,b:(z0+uz*n)*N+x0+ux*n,cost:OVP_COST*Math.max(0,n-1)};
}
function ovpDemolish(tiles){
  if(!S.ovs||!S.ovs.length)return 0;const hit=new Set();for(const [x,z] of tiles){const s=OVT[z*N+x];if(s>=0)hit.add(s);}
  if(!hit.size)return 0;if(ACT&&!ACT.ovs)ACT.ovs=S.ovs.slice();let back=0;
  S.ovs=S.ovs.filter((o,k)=>{if(hit.has(k)){back+=OVP_COST*(o.n-1);return false;}return true;});ovpChanged();return back;
}
function rebuildOvp(){
  if(!E)return;if(E.ovMesh){E.gD.remove(E.ovMesh);E.ovMesh.geometry.dispose();E.ovMesh=null;}
  if(!S.ovs||!S.ovs.length)return;
  GB=new Map();TX.x=0;TX.z=0;TX.k=0;const g=G('plain'),W=.34,TH=.06,cT=CC('#5d646c'),cS=CC('#c4c9ce'),cB=CC('#e3e6e9'),cL=CC('#f3f1e7');
  const Q=(a,b,c_,d_,col)=>quad(g,a,b,c_,d_,col);
  for(const o of S.ovs){const ux=DIRS[o.d][0],uz=DIRS[o.d][1],vx=-uz,vz=ux,x0=o.a%N+.5,z0=((o.a/N)|0)+.5,h=e=>e<=1||e>=o.n?0:OVP_H;
    for(let k=1;k<o.n;k++){const sx=x0+ux*(k-.5),sz=z0+uz*(k-.5),ex=x0+ux*(k+.5),ez=z0+uz*(k+.5),ys=h(k)+.004,ye=h(k+1)+.004;
      const P=(px,pz,y,s)=>[px+vx*W*s,y,pz+vz*W*s];
      Q(P(sx,sz,ys,-1),P(sx,sz,ys,1),P(ex,ez,ye,1),P(ex,ez,ye,-1),cT);   // chaussée
      for(const s of[-.8,.8])Q(P(sx,sz,ys+.002,s-.02),P(sx,sz,ys+.002,s+.02),P(ex,ez,ye+.002,s+.02),P(ex,ez,ye+.002,s-.02),cL);   /* v13 : lignes de rive */
      for(const s of[-1,1]){Q(P(sx,sz,ys-TH,s),P(ex,ez,ye-TH,s),P(ex,ez,ye,s),P(sx,sz,ys,s),cS);   // côtés
        const s2=s*.93;Q(P(sx,sz,ys,s),P(ex,ez,ye,s),P(ex,ez,ye+.05,s),P(sx,sz,ys+.05,s),cB);Q(P(sx,sz,ys+.05,s2),P(ex,ez,ye+.05,s2),P(ex,ez,ye+.05,s),P(sx,sz,ys+.05,s),cB);}   // garde-corps
      Q(P(sx,sz,ys-TH,1),P(sx,sz,ys-TH,-1),P(ex,ez,ye-TH,-1),P(ex,ez,ye-TH,1),cS);   // dessous
      if(ys>.1&&ye>.1){const mx=(sx+ex)/2,mz=(sz+ez)/2;Q([mx-ux*.15+vx*.012,ys+.003,mz-uz*.15+vz*.012],[mx-ux*.15-vx*.012,ys+.003,mz-uz*.15-vz*.012],[mx+ux*.15-vx*.012,ye+.003,mz+uz*.15-vz*.012],[mx+ux*.15+vx*.012,ye+.003,mz+uz*.15+vz*.012],cL);
        if(k>=2&&k<=o.n-2){bc(mx,mz,Math.abs(ux)*.05+Math.abs(vx)*.06,Math.abs(uz)*.05+Math.abs(vz)*.06,0,OVP_H-TH-.035,'#b9bfc5');bc(mx,mz,Math.abs(vx)*.29+Math.abs(ux)*.05,Math.abs(vz)*.29+Math.abs(uz)*.05,OVP_H-TH-.035,OVP_H-TH,'#aeb4ba');}   /* v13 : piles avec chevêtre */
        if(k%2===0){const sd=(k/2)%2?1:-1,lx=mx+vx*W*.94*sd,lz=mz+vz*W*.94*sd;bc(lx,lz,.006,.006,ys+.05,ys+.33,'#4a5058');bc(lx-vx*.045*sd,lz-vz*.045*sd,.022,.022,ys+.31,ys+.325,'#fff1c9');}}}}
  const geo=toGeo(GB.get('plain'));GB=null;
  if(!E.ovMat)E.ovMat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  E.ovMesh=new THREE.Mesh(geo,E.ovMat);E.ovMesh.castShadow=E.ovMesh.receiveShadow=true;E.gD.add(E.ovMesh);
}
function ovpY(c){const s=S.ovs[c.ov];if(!s)return 0;return c.ok===1?OVP_H*c.t:c.ok===s.n-1?OVP_H*(1-c.t):OVP_H;}
// déplacement des voitures : directions possibles en entrant sur une case (routes + entrée d'un pont routier)
function dirsAt(j,from){const o=[];for(let d=0;d<8;d++)if(d!==from&&roadNb(j,d)>=0)o.push(d);const L=OVE.get(j);if(L)for(const e of L)if(e.d!==from&&!o.includes(e.d))o.push(e.d);return o;}
function pickDir(c,j,o){
  if(c.dest!=null&&Math.random()<.72){const dx=c.dest%N,dz=(c.dest/N)|0,x=j%N,z=(j/N)|0;let best=null,bd=1e9;
    for(const d of o){const v=Math.abs(x+DIRS8[d][0]-dx)+Math.abs(z+DIRS8[d][1]-dz);if(v<bd){bd=v;best=d;}}if(best!=null)return best;}
  return o.includes(c.to)&&Math.random()<.6?c.to:o[(Math.random()*o.length)|0];
}
function nextMove(c,C){
  const x=c.i%N,z=(c.i/N)|0,X=x+DIRS8[c.to][0],Z=z+DIRS8[c.to][1];if(X<0||Z<0||X>=N||Z>=N)return null;const j=Z*N+X;
  if(c.ov!=null){const s=S.ovs[c.ov];if(!s)return null;const k=c.ok+1;if(k<s.n)return{j,to:c.to,ov:c.ov,ok:k};
    if(!road[j])return null;const o=dirsAt(j,(c.to+2)%4);if(!o.length)return null;return{j,to:pickDir(c,j,o),ov:null,ok:0};}
  if(!road[j]){const L=OVE.get(c.i),e=L&&L.find(q=>q.d===c.to);if(!e)return null;return{j,to:c.to,ov:e.s,ok:1};}
  if(noCar(j)||showBlocked(j))return null;   /* 14 nov. 2026 : aucun véhicule dans les rues piétonnes · v15 : ni sur le parcours du marathon */
  const o=dirsAt(j,OPP(c.to)).filter(d=>{const k=roadNb(j,d);return k<0||!noCar(k);});if(!o.length)return null;return{j,to:pickDir(c,j,o),ov:null,ok:0};
}

// ── Saisons plus vivantes : feuilles d'automne, arbres en fleurs, illuminations de Noël, feux d'artifice ──
const AUT_PAL=['#e07b39','#d9a441','#c2452d','#e8b04a','#b5651d','#d4572a'],SPR_PAL=['#f4a6c6','#f7c6d9','#ffffff','#e98fb6'];
function seasonKey(){const m=month(),B=BIO();if(B.nosnow)return 'x';return m>=8&&m<=10?'a'+m:m===3?'s':m===11?'w':'x';}
function roundPal(){
  const k=seasonKey();if(k==='s')return TREE_PAL.concat(SPR_PAL,SPR_PAL);
  if(k==='a8')return TREE_PAL.concat(TREE_PAL,AUT_PAL);if(k==='a9')return AUT_PAL.concat(AUT_PAL,['#79b84f']);if(k==='a10')return AUT_PAL.concat(['#8a6a45','#a3793f'],TREE_PAL.slice(0,2));
  return TREE_PAL;
}
function makeLeaves(){
  const n=120,geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3),col=new Float32Array(n*3),c=new THREE.Color();
  const lc=cvs(32),lx=lc.getContext('2d'),gr=lx.createRadialGradient(16,16,0,16,16,15);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.6,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');
  lx.fillStyle=gr;lx.beginPath();lx.ellipse(16,16,15,9,.6,0,7);lx.fill();const ltex=ctex(lc,false);
  for(let k=0;k<n;k++){pos[k*3]=(Math.random()-.5)*36;pos[k*3+1]=Math.random()*8;pos[k*3+2]=(Math.random()-.5)*36;c.set(rpick(AUT_PAL));col[k*3]=c.r;col[k*3+1]=c.g;col[k*3+2]=c.b;}
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  E.leaves=new THREE.Points(geo,new THREE.PointsMaterial({size:.06,map:ltex,vertexColors:true,transparent:true,opacity:.85,alphaTest:.05,depthWrite:false}));E.leaves.frustumCulled=false;E.leaves.visible=false;E.gD.add(E.leaves);
}
function stepSeasons(dt,run){
  if(!E.leaves)makeLeaves();const L=E.leaves,k=seasonKey(),on=k[0]==='a'&&CAM.dist<40&&!VISIT;L.visible=on;
  if(on){const a=L.geometry.attributes.position.array,ext=Math.min(60,CAM.dist*1.3)/36;L.position.set(CAM.x,0,CAM.z);L.scale.set(ext,1,ext);
    for(let j=0;j<a.length;j+=3){a[j+1]-=dt*(.35+(j%5)*.05);a[j]+=Math.sin(E.t*1.3+j)*dt*.35;a[j+2]+=Math.cos(E.t*.9+j*.7)*dt*.25;if(a[j+1]<0)a[j+1]+=8;}
    L.geometry.attributes.position.needsUpdate=true;L.material.size=.045+CAM.dist*.0012;}
  if(E.t-(E.seaT||0)>1){E.seaT=E.t;if(k!==E.seaK){E.seaK=k;D.trees=true;}const xk=k+'|'+(E.roadList?E.roadList.length:0)+'|'+SV.size+'|'+(S.ms|0);if(xk!==E.xmK){E.xmK=xk;xmasBuild();}}   /* v15 : refait aussi quand les routes changent */
  xmasFrame();
}
// ── Noël (v15) : guirlandes d'ampoules tendues au-dessus des rues (elles scintillent la nuit), étoiles et flocons lumineux,
// motifs sur les lampadaires, grand sapin décoré (guirlande en spirale, boules, étoile, cadeaux), chalets du marché de Noël ──
const XM_PAL=[['#ffd27a','#fff0c8','#ffb347','#ffe39a'],['#ff4d4d','#3ddc84','#ffd166','#62a8ff','#ff7ad9'],['#d9f1ff','#ffffff','#8fc7ff','#bfe3ff']];
function xmasHaloMat(){
  return new THREE.ShaderMaterial({uniforms:{uT:{value:0},uK:{value:0},uMap:{value:glowTex()},uS:{value:300}},
    vertexShader:'attribute vec3 col;attribute float ph;attribute float sz;uniform float uT;uniform float uS;varying vec3 vC;varying float vA;'+
      'void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float tw=.5+.5*sin(uT*(1.3+fract(ph*7.31)*2.2)+ph*6.2832);vA=tw;vC=col;gl_PointSize=sz*uS*(.8+.35*tw)/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform sampler2D uMap;uniform float uK;varying vec3 vC;varying float vA;void main(){vec4 t=texture2D(uMap,gl_PointCoord);float a=t.a*uK*(.35+.8*vA);gl_FragColor=vec4(vC*a,a);}',
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
}
function xmasTree(B,H,R0){   // grand sapin dans le repère TX (pied en 0,0)
  if(!E.mat.xmasT)E.mat.xmasT=new THREE.MeshLambertMaterial({vertexColors:true});   /* pas de neige sur le sapin (sinon il devient tout blanc) */
  const g=G('xmasT');cyl(0,0,0,.06,R0*.98,R0*.98,20,'#7a5236','#e9e4da');cyl(0,0,.06,.07,R0*.92,R0*.92,20,'#efeae0');   // bac en bois
  cyl(0,0,.07,.26,.055,.045,8,'#5a3d2b',null,'xmasT');
  const T=7,cD=CC('#173f27'),cM=CC('#21573a'),cT=CC('#3a8a55');
  for(let k=0;k<T;k++){const u=k/T,y0=.2+u*(H-.42),h=(H-.2)/T*1.75,r=R0*(1-u*.84)+.02,n=16,ap=V(0,y0+h,0),ctr=V(0,y0+.06,0);
    for(let j=0;j<n;j++){const a0=(j/n)*6.2832+k*.4,a1=((j+1)/n)*6.2832+k*.4,am=(a0+a1)/2,rr=r*(j%2?1:.86);
      const A=V(Math.cos(a0)*r*.8,y0+.035,Math.sin(a0)*r*.8),Bm=V(Math.cos(am)*rr,y0-.025,Math.sin(am)*rr),C=V(Math.cos(a1)*r*.8,y0+.035,Math.sin(a1)*r*.8);
      triC(g,ap,A,Bm,cM,cD,cT);triC(g,ap,Bm,C,cM,cT,cD);triC(g,ctr,Bm,A,cD,cD,cD);triC(g,ctr,C,Bm,cD,cD,cD);}}
  // étoile dorée à 5 branches, en relief
  const sy=H+.06,gs=G('basic'),cs=CC('#ffd23f'),cs2=CC('#ffb703');const pts=[];for(let j=0;j<10;j++){const a=j/10*6.2832-Math.PI/2,r=j%2?.038:.092;pts.push([Math.cos(a)*r,Math.sin(a)*r]);}
  for(const zz of[-.014,.014]){const c0=V(0,sy,zz*2.2);for(let j=0;j<10;j++){const p0=pts[j],p1=pts[(j+1)%10];tri(gs,c0,V(p0[0],sy+p0[1],zz),V(p1[0],sy+p1[1],zz),zz<0?cs2:cs);tri(gs,c0,V(p1[0],sy+p1[1],zz),V(p0[0],sy+p0[1],zz),zz<0?cs:cs2);}}
  bc(0,0,.006,.006,H-.05,sy-.06,'#c9a227');
  // boules
  const BC=['#d62828','#e9b949','#d9dde3','#2f6fd6','#d62828','#e9b949','#9b2c8a'],R=rng(4711);
  for(let k=0;k<44;k++){const u=.06+R()*.86,y=.2+u*(H-.42),r=(R0*(1-u*.84)+.02)*(.86+R()*.1),a=R()*6.2832;ico(Math.cos(a)*r,y-.012,Math.sin(a)*r,.019+R()*.008,BC[k%BC.length],1,'xmasT');}
  // cadeaux au pied
  const PC=[['#d62828','#ffd23f'],['#2a9d8f','#ffffff'],['#2f6fd6','#ffd23f'],['#f2f2f2','#d62828'],['#e9b949','#d62828'],['#7b2cbf','#ffffff'],['#3fa34d','#ffd23f']];
  for(let k=0;k<9;k++){const a=k/9*6.2832+.3,r=R0*.72+(k%2)*.07,s=.035+(k%3)*.012,h=.05+(k%4)*.014,x=Math.cos(a)*r,z=Math.sin(a)*r,[c1,c2]=PC[k%PC.length];
    bc(x,z,s,s,.07,.07+h,c1);bc(x,z,.007,s+.002,.07,.07+h+.002,c2);bc(x,z,s+.002,.007,.07,.07+h+.002,c2);ico(x,.075+h,z,.012,c2,.6);}
  // guirlande en spirale (ampoules chaudes)
  for(let k=0;k<150;k++){const u=k/150,y=.24+u*(H-.5),r=(R0*(1-((y-.2)/(H-.42))*.84)+.02)*.9+.012,a=u*6.2832*6.5;const p=P(Math.cos(a)*r,Math.sin(a)*r);B.push(p[0],y,p[1],k%9===4?'#ffb347':'#ffe7b0');}
  const st=P(0,0);B.push(st[0],sy,st[1],'*#ffe08a');
}
function xmasChalet(B,lx,lz,k){   // chalet du marché de Noël (façade côté +z local)
  sub(lx,lz,k,()=>{const W='#9a6a43',D='#7a5236';bx(-.15,-.1,.15,.1,0,.15,W,null,D);for(let j=0;j<6;j++)bx(-.151,-.1,.151,.1,.02+j*.022,.024+j*.022,D);
    bx(-.12,.1,.12,.104,.05,.13,'#ffcf8a','basic');bx(-.13,.1,.13,.16,.05,.06,D);gable(-.18,-.14,.18,.14,.15,.1,'#8a5a3b',true,W);
    bx(-.09,.11,.09,.115,.135,.15,'#c62828');
    for(let j=0;j<=10;j++){const p=P(-.17+j*.034,.145);B.push(p[0],.158,p[1],j%2?'#ffd27a':'#ff4d4d');}});
}
function xmasBuild(){
  if(!E)return;
  if(E.xmas){E.gD.remove(E.xmas.g);E.xmas.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&!Object.values(E.mat).includes(o.material)&&o.material.dispose)o.material.dispose();});E.xmas=null;}
  const had=!!E.xmasL;E.xmasL=null;
  if(seasonKey()!=='w'||VISIT){if(had)D.lights=true;return;}
  const g=new THREE.Group(),B=[],W=[],L=[],keep=[GB,TX.x,TX.z,TX.k];GB=new Map();
  // 1) guirlandes au-dessus des rues droites, une case sur deux
  let nG=0;
  for(let i=0;i<NN&&nG<240;i++){
    if(!(road[i]===1||road[i]===3)||ter[i]||dg[i]||rx[i]||SIG[i]||OVT[i]>=0||mtn[i])continue;const x=i%N,z=(i/N)|0;if(!inArea(x,z))continue;
    const m=roadMask(x,z);if((m!==5&&m!==10)||((x+z)&1))continue;nG++;
    const ns=m===5,cx=x+.5,cz=z+.5,H=.52,sag=.06,n=22,av=road[i]===3;
    const pal=XM_PAL[hash(ns?x*131+7:z*131+9)<.62?0:hash(ns?x*17+3:z*17+5)<.6?1:2];
    const e0=ns?[cx-.47,cz]:[cx,cz-.47],e1=ns?[cx+.47,cz]:[cx,cz+.47];
    TX.x=cx;TX.z=cz;TX.k=ns?0:1;for(const s of[-1,1]){bc(s*.47,0,.0032,.0032,0,H+.02,'#4a5058');ico(s*.47,H+.022,0,.006,'#4a5058');}   // mâts fins sur les trottoirs
    let prev=null;
    for(let k=0;k<=n;k++){const u=k/n,px=lerp(e0[0],e1[0],u),pz=lerp(e0[1],e1[1],u),py=H-sag*Math.sin(u*Math.PI);if(prev)W.push(prev[0],prev[1],prev[2],px,py,pz);prev=[px,py,pz];
      if(k>0&&k<n)B.push(px,py-.014,pz,pal[k%pal.length]);
      if(k>2&&k<n-2&&k%3===0&&!(av&&Math.abs(u-.5)<.12)){const dl=.05+((k*7)%3)*.025;W.push(px,py,pz,px,py-dl,pz);B.push(px,py-dl-.01,pz,pal[(k+1)%pal.length]);}}   // pampilles
    // motif au centre : étoile ou flocon
    const mx=cx,mz=cz,my=H-sag-.1,ax=ns?1:0,az=ns?0:1,mc=(x*7+z*3)%2===0;
    const at=(a,r)=>[mx+Math.cos(a)*r*ax,my+Math.sin(a)*r,mz+Math.cos(a)*r*az];
    W.push(mx,H-sag,mz,mx,my+.075,mz);
    if(mc){for(let j=0;j<20;j++){const a0=j/20*6.2832-Math.PI/2,k5=(j%4),r=k5===0?.075:k5===2?.032:.052;const q=at(a0,r);B.push(q[0],q[1],q[2],j%4===0?'#ffffff':'#ffd27a');}}
    else{for(let j=0;j<6;j++){const a=j/6*6.2832;for(const r of[.025,.045,.066]){const q=at(a,r);B.push(q[0],q[1],q[2],'#e8f6ff');}for(const s of[-1,1]){const q=at(a+s*.5,.05);B.push(q[0],q[1],q[2],'#bfe3ff');}}B.push(mx,my,mz,'#ffffff');}
    L.push(cx,cz);
  }
  // 2) un flocon lumineux sur chaque lampadaire allumé
  for(let i=0;i<NN;i++){if(!lampAt(i)||!lampOn(i))continue;const x=i%N,z=(i/N)|0;if(!inArea(x,z))continue;TX.x=x+.5;TX.z=z+.5;TX.k=lampK(i);
    const c=P(-.42,-.405),cy=.24;for(let j=0;j<8;j++){const a=j/8*6.2832;for(const r of[.022,.042]){const lx=Math.cos(a)*r;const p=P(-.42+lx,-.405);B.push(p[0],cy+Math.sin(a)*r,p[1],r>.03?'#dff3ff':'#ffffff');}}B.push(c[0],cy,c[1],'#ffffff');}
  // 3) grand sapin près de la mairie (ou d'une place), chalets autour
  const m=[...SV.values()].find(s=>s.t==='mairie')||[...SV.values()].find(s=>s.t==='plaza'||s.t==='square');let tx=-1,tz=-1;
  const free=i=>!road[i]&&!zone[i]&&!svcAt[i]&&!ter[i]&&!hill[i]&&!mtn[i]&&!deco[i]&&!lvl[i];
  if(m){let bd=99;for(let z=m.z-2;z<=m.z+m.d+1;z++)for(let x=m.x-2;x<=m.x+m.w+1;x++){if(x<1||z<1||x>=N-1||z>=N-1)continue;const i=z*N+x;if(!free(i))continue;let nb=0;for(const j of[i-1,i+1,i-N,i+N])if(road[j])nb++;const dd=Math.hypot(x+.5-(m.x+m.w/2),z+.5-(m.z+m.d/2))-nb*.6;if(dd<bd){bd=dd;tx=x;tz=z;}}}
  if(tx<0){for(let k=0;k<400;k++){const i=(Math.random()*NN)|0,x=i%N,z=(i/N)|0;if(!inArea(x,z)||!free(i))continue;let nb=0;for(const j of[i-1,i+1,i-N,i+N])if(j>=0&&j<NN&&road[j])nb++;if(nb){tx=x;tz=z;break;}}}
  if(tx>=0){TX.x=tx+.5;TX.z=tz+.5;TX.k=0;xmasTree(B,1.7,.46);L.push(tx+.5,tz+.5,tx+.5,tz+.5);
    let nc=0;for(const [dx,dz,k] of[[1,0,3],[-1,0,1],[0,1,2],[0,-1,0]]){if(nc>=2)break;const X=tx+dx,Z=tz+dz,i=Z*N+X;if(X<0||Z<0||X>=N||Z>=N||!free(i))continue;TX.x=X+.5;TX.z=Z+.5;TX.k=0;xmasChalet(B,-.2,0,k);xmasChalet(B,.2,0,k);nc++;L.push(X+.5,Z+.5);}}
  // maillages
  for(const [k,gg] of GB){if(!gg.p.length)continue;const ms=new THREE.Mesh(toGeo(gg),E.mat[k]||E.mat.plain);ms.castShadow=k!=='basic';ms.receiveShadow=true;g.add(ms);}
  [GB,TX.x,TX.z,TX.k]=keep;
  if(W.length){const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(W,3));g.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:'#2a2e33'})));}
  const nb=B.length/4|0;let bulbs=null,halo=null;
  if(nb){const bg=new THREE.IcosahedronGeometry(.0105,1);bulbs=new THREE.InstancedMesh(bg,new THREE.MeshBasicMaterial({color:'#ffffff'}),nb);bulbs.frustumCulled=false;
    const mm=new THREE.Matrix4(),cc=new THREE.Color(),hp=new Float32Array(nb*3),hc=new Float32Array(nb*3),ph=new Float32Array(nb),sz=new Float32Array(nb);let j=0;
    for(let k=0;k<B.length;k+=4){let c=B[k+3];const star=c[0]==='*';if(star)c=c.slice(1);
      const x=B[k],y=B[k+1],z=B[k+2];cc.set(c);mm.makeScale(star?3:1,star?3:1,star?3:1);mm.setPosition(x,y,z);bulbs.setMatrixAt(j,mm);bulbs.setColorAt(j,cc);
      hp[j*3]=x;hp[j*3+1]=y;hp[j*3+2]=z;hc[j*3]=cc.r;hc[j*3+1]=cc.g;hc[j*3+2]=cc.b;ph[j]=hash(j*7919+13);sz[j]=star?.9:.085;j++;}
    bulbs.count=j;g.add(bulbs);
    const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.BufferAttribute(hp.subarray(0,j*3),3));hg.setAttribute('col',new THREE.BufferAttribute(hc.subarray(0,j*3),3));hg.setAttribute('ph',new THREE.BufferAttribute(ph.subarray(0,j),1));hg.setAttribute('sz',new THREE.BufferAttribute(sz.subarray(0,j),1));
    halo=new THREE.Points(hg,xmasHaloMat());halo.frustumCulled=false;halo.renderOrder=3;g.add(halo);}
  E.gD.add(g);E.xmas={g,bulbs,halo};E.xmasL=L;D.lights=true;
}
function xmasFrame(){
  const X_=E.xmas;if(!X_)return;const nk=clamp((E.night-.22)/.4,0,1);
  if(X_.halo){const u=X_.halo.material.uniforms;u.uT.value=E.t;u.uK.value=nk;u.uS.value=E.renderer.domElement.height*.5;X_.halo.visible=nk>.01;}
  if(X_.bulbs)X_.bulbs.material.color.setScalar(.62+.95*nk);
}
function seasonDay(){
  const d=S.day%360,y=(S.day/360)|0;
  if(d===193&&S.fwY!==y){S.fwY=y;fireworks(10,'Feu d’artifice du 14 juillet !');news('celebration','Feu d’artifice du 14 juillet','Toute la ville est sortie admirer le spectacle.','good');}
  if(d===0&&S.day>0&&S.nyY!==y){S.nyY=y;fireworks(10,`Bonne année ${2026+y} !`);}
  if(d===330&&S.xmY!==y&&!BIO().nosnow){S.xmY=y;news('park','Le marché de Noël ouvre','Les rues s’illuminent et un grand sapin se dresse près de la mairie.','good');}
}

// ── Habitants à suivre : quelques habitants nommés et leur journée (travail, loisirs, maison) ──
const HOB=[['park','Promenade au parc','park'],['cab','Rendez-vous au cabinet','medical_services'],['sport','Séance de sport','fitness_center'],['shop','Courses en ville','shopping_bag'],['home','Soirée à la maison','home']];
function hourNow(){return E?((((S&&S.set.dn)||E.ltod==null?E.tod:E.ltod)*24)%24):12;}
function citRefresh(){
  if(!Array.isArray(S.cits))S.cits=[];
  const okHome=i=>zone[i]===ZR&&lvl[i]&&st[i]===OK;S.cits=S.cits.filter(c=>okHome(c.home));
  const homes=residentialLots();if(!homes.length)return;
  const work=[];for(let i=0;i<NN;i++)if(zone[i]&&zone[i]!==ZR&&lvl[i]&&st[i]===OK&&cap[i])work.push(i);for(const s of SV.values())if(BT[s.t].cat==='services'||BT[s.t].cat==='economie')work.push(s.z*N+s.x);
  let guard=0;while(S.cits.length<Math.min(6,homes.length)&&guard++<30){const f=Math.random()<.5;
    S.cits.push({name:`${rpick(f?FIRST_F:FIRST_M)} ${rpick(LAST)}`,f,age:19+((Math.random()*55)|0),home:rpick(homes),work:work.length?rpick(work):null,hob:(Math.random()*HOB.length)|0,dog:Math.random()<(S.prof==='veto'?.6:.3)});}
}
function citStatus(c){
  const h=hourNow(),hb=HOB[c.hob]||HOB[0],old=c.age>=66;
  if(h<6.5||h>=23)return['bedtime','Dort à la maison'];
  if(h<8)return old?['coffee','Prend son petit-déjeuner']:['directions_walk','Part au travail'];
  if(h<17)return old?['park','Se promène'+(c.dog?' avec son chien':'')]:['work',c.work!=null?`Au travail (${jobName(c.work)})`:'Cherche du travail'];
  if(h<18.5)return old?[hb[2],hb[1]]:['directions_walk','Rentre du travail'];
  if(h<21)return c.dog?['pets','Promène son chien']:[hb[2],hb[1]];
  return['home','À la maison'];
}
function panelCits(){
  citRefresh();const h=hourNow(),hh=`${String(Math.floor(h)).padStart(2,'0')} h ${String(Math.floor((h%1)*60)).padStart(2,'0')}`;
  let out=head('groups','Habitants',`${fmt(ST.pop)} habitants · il est ${hh} en ville`,'#3b8fdc');
  if(!S.cits.length)return out+`<p class="cty-p">Construis des maisons (zone résidentielle) : des habitants viendront y vivre et tu pourras suivre leur journée.</p>`;
  out+=`<p class="cty-p small">Le matin ils partent travailler, le soir ils vont au parc, au cabinet ou promener leur chien, la nuit ils dorment. Touche « Suivre » pour les accompagner.</p>`;
  out+=S.cits.map((c,k)=>{const[ic,txt]=citStatus(c),hb=HOB[c.hob]||HOB[0];
    return `<div class="cty-cit"><span class="cty-cit-av" style="--c:${['#3b8fdc','#e05a8a','#2a9d8f','#f08c3a','#7c4dcc','#2f9e5a'][k%6]}">${esc(c.name[0])}</span><div><b>${esc(c.name)}, ${c.age} ans</b><small><span class="ms">${ic}</span>${esc(txt)}</small>`
      +`<small class="cty-cit-day">7 h travail · 18 h ${esc(hb[1].toLowerCase())}${c.dog?' · 20 h promenade du chien':''} · 23 h dodo</small></div><button class="cty-btn" data-act="citgo" data-k="${k}"><span class="ms">visibility</span>Suivre</button></div>`;}).join('');
  return out;
}

// ── Animaux et promeneurs dans les rues, chats sur les toits, oiseaux dans le ciel ──
// v5.1 (13 nov. 2026) : bonhommes refaits — avant ils s'affichaient en noir (couleur d'instance jamais remplie) et
// étaient aussi grands qu'une voiture. 4 tenues (un maillage par tenue, sans teinte d'instance), taille réaliste.
const PPL_SH=['#3b8fdc','#e05a8a','#2a9d8f','#f2b134'],PPL_HAIR=['#4a3426','#1f1a17','#c99a5b','#8a5a30'];
function personGeo(sh,hair){GB=new Map();TX.x=0;TX.z=0;TX.k=0;
  bc(-.011,.004,.008,.011,0,.012,'#2b2b2b');bc(.011,.004,.008,.011,0,.012,'#2b2b2b');   // chaussures
  bc(-.011,0,.0075,.0075,.012,.072,'#34495e');bc(.011,0,.0075,.0075,.012,.072,'#34495e');   // jambes
  bc(0,0,.024,.015,.072,.132,sh);bc(-.031,0,.0065,.0065,.08,.13,sh);bc(.031,0,.0065,.0065,.08,.13,sh);   // buste et bras
  bc(-.031,0,.006,.006,.068,.08,'#f1c7a3');bc(.031,0,.006,.006,.068,.08,'#f1c7a3');   // mains
  ico(0,.153,0,.02,'#f1c7a3');ico(0,.163,-.005,.0195,hair,.72);   // tête et cheveux
  const g=toGeo(GB.get('plain'));GB=null;return g;}
function makeFauna(){
  const mat=new THREE.MeshLambertMaterial({vertexColors:true}),mk=fn=>{GB=new Map();TX.x=0;TX.z=0;TX.k=0;fn();const g=toGeo(GB.get('plain'));GB=null;return g;};
  const dog=mk(()=>{for(const[lx,lz]of[[-.012,-.032],[.012,-.032],[-.012,.03],[.012,.03]])bc(lx,lz,.007,.007,0,.042,'#ffffff');bc(0,0,.02,.046,.04,.076,'#ffffff');bc(0,.056,.018,.021,.062,.1,'#ffffff');bc(0,.083,.011,.012,.066,.084,'#3a2a20');bc(-.015,.05,.005,.006,.092,.114,'#3a2a20');bc(.015,.05,.005,.006,.092,.114,'#3a2a20');bc(0,-.05,.005,.005,.07,.1,'#ffffff');});
  const cat=mk(()=>{bc(0,0,.016,.03,0,.035,'#ffffff');ico(0,.05,.018,.017,'#ffffff');bc(-.009,.018,.004,.004,.062,.075,'#ffffff');bc(.009,.018,.004,.004,.062,.075,'#ffffff');bc(0,-.03,.004,.004,.02,.075,'#ffffff');});
  const bird=new THREE.BufferGeometry();bird.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.02,-.12,.04,-.02,0,0,-.03, 0,0,.02,.12,.04,-.02,0,0,-.03],3));bird.computeVertexNormals();
  const I=(g,n,m_,tint)=>{const x=new THREE.InstancedMesh(g,m_||mat,n);x.count=0;x.frustumCulled=false;x.castShadow=true;if(tint)x.setColorAt(0,new THREE.Color('#fff'));E.gC.add(x);return x;};
  E.fauna={dog:I(dog,40,null,true),cat:I(cat,12,null,true),
    bird:I(bird,6,new THREE.MeshLambertMaterial({color:'#5b6570',side:THREE.DoubleSide})),walk:[],cats:[],chk:-9,birdC:[]};
}
const DOG_C=['#c58b4e','#3b3029','#e9dcc3','#8a5a30','#f2f2f2'],CAT_C=['#d9894a','#6b6b6b','#f2f2f2','#2b2b2b','#c7b299'];
function stepFauna(dt,run){
  if(!E.fauna)makeFauna();const F=E.fauna,m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),sc=new THREE.Vector3(1,1,1),col=new THREE.Color();
  if(E.t-F.chk>1.5){F.chk=E.t;
    walkSpawn(F);   /* v13 : de vrais trajets (maison → commerce, parc, travail), joggeurs, familles */
    if(!F.cats.length||Math.random()<.05){F.cats=[];const L=residentialLots();for(let k=0;k<Math.min(6,Math.floor(L.length/10));k++){const i=rpick(L);F.cats.push([i%N+.3+Math.random()*.4,((i/N)|0)+.3+Math.random()*.4,(TOP[i]||.5),Math.random()*6.28,CAT_C[(Math.random()*5)|0]]);}}
    if(!F.birdC.length){let wx=0,wz=0,wn=0;for(let i=0;i<NN;i+=3)if(ter[i]){wx+=i%N;wz+=(i/N)|0;wn++;}F.birdC=[[wn?wx/wn:N/2,wn?wz/wn:N/2]];}}
  const nd=walkStep(F,run,m,q,e,p,sc,col);beachStep(run);
  F.dog.count=nd;F.dog.instanceMatrix.needsUpdate=true;if(F.dog.instanceColor)F.dog.instanceColor.needsUpdate=true;
  let nc=0;for(const [x,z,y,a,c] of F.cats){e.set(0,a+Math.sin(E.t*.3+a)*.4,0);q.setFromEuler(e);p.set(x,y,z);sc.setScalar(.9);m.compose(p,q,sc);F.cat.setMatrixAt(nc,m);col.set(c);F.cat.setColorAt(nc,col);nc++;}
  F.cat.count=VISIT?0:nc;F.cat.instanceMatrix.needsUpdate=true;if(F.cat.instanceColor)F.cat.instanceColor.needsUpdate=true;
  // un seul petit vol de 5 oiseaux, le jour, seulement quand on regarde la ville d'assez loin
  const fly=E.night<.6&&CAM.dist>14&&!(S.wx&&(S.wx.k==='rain'||S.wx.k==='storm'));let nb=0;
  if(fly)for(const[cx,cz]of F.birdC)for(let k=0;k<5;k++){const a=E.t*.16+k*.42,r=3.6+Math.sin(k*1.7)*.8;
    e.set(0,-a,0);q.setFromEuler(e);p.set(cx+Math.cos(a)*r,3.4+Math.sin(E.t*.7+k)*.2,cz+Math.sin(a)*r);sc.set(.75,.35+Math.abs(Math.sin(E.t*7+k*1.3))*.9,.75);m.compose(p,q,sc);F.bird.setMatrixAt(nb++,m);}
  F.bird.count=nb;F.bird.instanceMatrix.needsUpdate=true;
}

// ── Heures de pointe : beaucoup plus de voitures le matin et le soir, presque rien la nuit, trajets maison ↔ travail ──
function rushK(){const h=hourNow(),g=(c,w)=>Math.exp(-((h-c)*(h-c))/(2*w*w));const day=h>=6.5&&h<22.5?1:.3;return day*(.85+.75*g(8,.9)+.85*g(18,1.1))+(day<1?0:0);}
function isRush(){const h=hourNow();return(h>=7&&h<9.5)||(h>=17&&h<19.5);}
let _cmT=-9,_cmW=[],_cmH=[];
function commuteDest(){
  const h=hourNow();if(!E)return null;
  if(E.t-_cmT>2){_cmT=E.t;_cmW=[];_cmH=[];for(let i=0;i<NN;i++){if(!lvl[i]||!zone[i]||st[i]!==OK)continue;(zone[i]===ZR?_cmH:_cmW).push(i);}}
  if(h>=6.5&&h<9.5&&_cmW.length)return rpick(_cmW);if(h>=16.5&&h<19.5&&_cmH.length)return rpick(_cmH);return null;
}

// ── Événements : match au stade, concert sur la place, marathon dans les rues ──
const SHOWS={match:{n:'Match au stade',ic:'stadium',d:'Les supporters envahissent la ville !',g:1500},concert:{n:'Concert sur la place',ic:'music_note',d:'Une scène, des lumières et toute la ville qui danse.',g:1000},marathon:{n:'Marathon de la ville',ic:'directions_run',d:'Des centaines de coureurs dans tes rues.',g:800}};
const SHOW_T={match:200,concert:200,marathon:330};   /* v15 : durée en secondes réelles (avant : 4 jours de jeu = 5 secondes) */
function showMonth(){
  if(VISIT||S.show||ST.pop<250||Math.random()>.35)return;
  const C=[];const st_=[...SV.values()].find(s=>s.t==='stadium');if(st_)C.push(['match',st_]);
  const pl=[...SV.values()].find(s=>s.t==='plaza'||s.t==='square'||s.t==='mairie');if(pl)C.push(['concert',pl]);
  if((E.roadList||[]).length>=40)C.push(['marathon',null]);if(!C.length)return;
  const[k,s]=rpick(C);showStart(k,s);
}
function showStart(k,s){const D_=SHOWS[k];S.show={k,left:SHOW_T[k],sid:s?s.id:0};
  news(D_.ic,D_.n,D_.d,'good');toast(`<b>${D_.n}</b> : ${D_.d}`,D_.ic,{label:'Voir',fn:()=>showGo()});showBuild();}
function showGo(){const sh=S.show;if(!sh)return;const s=SV.get(sh.sid);if(s)flyTo(s.x+s.w/2,s.z+s.d/2,12);else if(E.show&&E.show.path)flyTo(E.show.path[0]%N+.5,((E.show.path[0]/N)|0)+.5,9);}
function showDay(){
  if(!S.show)return;if(S.show.left==null)S.show.left=120;   // ancienne sauvegarde (fin en jours)
  if(S.show.left>0){if(!E.show)showBuild();return;}
  const D_=SHOWS[S.show.k];S.money+=D_.g;floatMoney(D_.g);S.mods.push({k:'hap',v:4,u:S.day+60});
  news(D_.ic,`${D_.n} : un grand succès !`,`La ville gagne ${money(D_.g)} et les habitants sont ravis (bonheur +4 pendant 2 mois).`,'good');
  if(S.show.k!=='marathon')fireworks(4);S.show=null;showClear();
}
function showClear(){if(E&&E.show){E.gD.remove(E.show.g);E.show.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material.map&&o.material.map!==glowTex.t)o.material.map.dispose();});E.show=null;}}
function bannerTex(txt,bg,fg){const cv=cvs(256,48),x=cv.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,256,48);x.fillStyle=fg;x.font='bold 30px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,128,26);x.fillStyle='rgba(255,255,255,.85)';x.fillRect(0,0,256,3);x.fillRect(0,45,256,3);return ctex(cv,false);}
function showBuild(){
  showClear();const sh=S.show;if(!sh||!E)return;const g=new THREE.Group(),O={g,k:sh.k};
  if(sh.k==='marathon'){   /* v15 : vraie course — départ en peloton sous l'arche, aller-retour sur les rues fermées aux voitures, ravitaillement, public */
    const RL=(E.roadList||[]).filter(i=>(road[i]===1||road[i]===3)&&!ter[i]&&!dg[i]&&OVT[i]<0&&!noCar(i));if(RL.length<6){S.show=null;return;}
    let path=null;for(let t=0;t<6&&(!path||path.length<8);t++){const a=rpick(RL);let best=a,bd=0;const dist_=new Int32Array(NN).fill(-1),q=[a];dist_[a]=0;
      for(let h=0;h<q.length;h++){const i=q[h],x=i%N;for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&(road[j]===1||road[j]===3)&&!ter[j]&&!dg[j]&&dist_[j]<0){dist_[j]=dist_[i]+1;q.push(j);if(dist_[j]>bd&&dist_[j]<=34){bd=dist_[j];best=j;}}}
      const p=roadPathBFS(a,best)||[a];if(!path||p.length>path.length)path=p;}
    O.path=path;const L=path.length,Lc=2*(L-1);O.block=new Set(path);
    const T_=sh.left||SHOW_T.marathon,lead=.6;O.laps=Math.max(1,Math.floor(lead*T_*.78/Math.max(1,Lc)));O.D=O.laps*Lc;
    O.rs=[...Array(72)].map((_,k)=>({s:-(k%8)*.055-Math.floor(k/8)*.07,side:.06+((k*37)%11)/11*.24,sp:.42+((k*53)%17)/17*.2+(k<6?.06:0),L:humLook(k*97+13,{v:5,kid:false}),ph:Math.random()*6,fin:-1}));
    // arche de départ / arrivée, barrières, public, ravitaillement
    const keep=[GB,TX.x,TX.z,TX.k];GB=new Map();const P0=path[0],P1=path[1],dx=(P1%N)-(P0%N),dz=((P1/N)|0)-((P0/N)|0);
    TX.x=P0%N+.5;TX.z=((P0/N)|0)+.5;TX.k=dx?1:0;   // repère : la course part vers +z local
    for(const s of[-1,1]){cyl(s*.42,0,0,.5,.045,.04,10,'#e63946');cyl(s*.42,0,.5,.56,.05,.05,10,'#ffffff');}
    tube(-.42,.56,0,.42,.56,0,.045,10,'#1d4ed8');for(const s of[-1,1])bx(s*.47-.03,-.12,s*.47+.03,.12,0,.02,'#2b2f33');
    const bt=bannerTex('DÉPART · ARRIVÉE','#1d4ed8','#ffffff');for(const s of[-1,1]){const pl=new THREE.Mesh(new THREE.PlaneGeometry(.7,.13),new THREE.MeshBasicMaterial({map:bt,side:THREE.DoubleSide}));const c=P(0,s*.05);pl.position.set(c[0],.47,c[1]);pl.rotation.y=TX.k?Math.PI/2:0;g.add(pl);}
    const fenceAt=(i,k0,k1)=>{const x=i%N,z=(i/N)|0,m=roadMask(x,z);TX.x=x+.5;TX.z=z+.5;TX.k=(m&5)&&!(m&10)?1:0;for(const s of[-1,1]){for(let k=0;k<4;k++){const u=-.42+k*.28;bx(u-.13,s*.35-.004,u+.13,s*.35+.004,.03,.075,k%2?'#e63946':'#ffffff');bc(u-.12,s*.35,.004,.012,0,.075,'#8d949b');}}};
    O.spec=[];
    for(let k=0;k<L;k++){const i=path[k],x=i%N,z=(i/N)|0,m=roadMask(x,z),cnt=(m&1?1:0)+(m&2?1:0)+(m&4?1:0)+(m&8?1:0);if(cnt>2)continue;
      if(k<3||k%4===1)fenceAt(i);
      if(k<3||hash(i*13+5)<.45){const ns=(m&5)&&!(m&10);for(let j=0;j<(k<3?6:3);j++){const s=hash(i*7+j)<.5?-1:1,u=(hash(i*31+j*3)-.5)*.8,px=x+.5+(ns?s*.42:u),pz=z+.5+(ns?u:s*.42);O.spec.push({x:px,z:pz,a:ns?(s>0?-Math.PI/2:Math.PI/2):(s>0?Math.PI:0),L:humLookC(i*11+j*5+300),ph:Math.random()*6});}}}
    {const e=path[L-1],x=e%N,z=(e/N)|0;TX.x=x+.5;TX.z=z+.5;TX.k=0;bx(.3,-.12,.44,.12,0,.06,'#f4f6f8');for(let k=0;k<6;k++)bc(.33+(k%2)*.07,-.09+((k/2)|0)*.09,.008,.008,.06,.09,'#4fb0d8');bc(.42,.18,.03,.03,0,.07,'#3fa34d');O.spec.push({x:x+.9,z:z+.5,a:-Math.PI/2,L:humLookC(e*3+77),ph:0});}
    for(const [k,gg] of GB)if(gg.p.length){const ms=new THREE.Mesh(toGeo(gg),E.mat[k]||E.mat.plain);ms.castShadow=true;g.add(ms);}
    [GB,TX.x,TX.z,TX.k]=keep;
    for(const C of[E.cars,E.buses,E.taxis])if(C)for(const c of C.list)if(O.block.has(c.i))spawnCar(c,C);}   // les voitures quittent le parcours
  else{const s=SV.get(sh.sid);if(!s){S.show=null;return;}const cx=s.x+s.w/2,cz=s.z+s.d/2,P_=[],C=[],cc=new THREE.Color();
    if(sh.k==='match'){for(const[dx,dz]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const x=cx+dx*(s.w/2+.1),z=cz+dz*(s.d/2+.1),pole=new THREE.Mesh(new THREE.BoxGeometry(.05,1.6,.05),new THREE.MeshLambertMaterial({color:'#7d858c'}));pole.position.set(x,.8,z);g.add(pole);
        for(let k=0;k<6;k++){P_.push(x+(k%3-1)*.07,1.62+((k/3)|0)*.07,z);cc.set('#fff6d8');C.push(cc.r,cc.g,cc.b);}}}
    else{const stg=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.5),new THREE.MeshLambertMaterial({color:'#2e3a46'}));stg.position.set(cx,.06,cz);g.add(stg);
      O.cones=[];for(let k=0;k<3;k++){const cn=new THREE.Mesh(new THREE.ConeGeometry(.35,1.6,16,1,true),new THREE.MeshBasicMaterial({color:['#ff4d9a','#4dd2ff','#ffd166'][k],transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
        cn.geometry.translate(0,-.8,0);cn.position.set(cx-.35+k*.35,1.6,cz-.1);g.add(cn);O.cones.push(cn);}
      for(let k=0;k<40;k++){P_.push(cx+(Math.random()-.5)*.8,.2+Math.random()*1.4,cz+(Math.random()-.5)*.5);cc.set(rpick(['#ff4d9a','#4dd2ff','#ffd166','#ffffff']));C.push(cc.r,cc.g,cc.b);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P_,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
    O.pts=new THREE.Points(geo,new THREE.PointsMaterial({size:sh.k==='match'?.5:.14,map:glowTex(),vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));O.pts.frustumCulled=false;g.add(O.pts);O.cx=cx;O.cz=cz;}
  E.gD.add(g);E.show=O;
}
function showBlocked(j){return !!(E&&E.show&&E.show.block&&E.show.block.has(j));}
function stepShow(dt,run){
  const O=E.show;if(!O)return;if(S.show&&S.show.left>0)S.show.left=Math.max(0,S.show.left-run);
  if(O.k==='marathon'){const P_=O.path,L=P_.length,Lc=2*(L-1),f0=P_[0];if(L<2)return;
    for(const r of O.rs){
      if(r.fin<0){r.s+=run*r.sp;if(r.s>=O.D){r.fin=E.t;r.s=O.D;}}
      if(r.s<0){const ax=f0%N+.5,az=((f0/N)|0)+.5,d1=P_[1],ux=(d1%N)-(f0%N),uz=((d1/N)|0)-((f0/N)|0);humPut(r.L,ax+ux*r.s+(-uz)*(r.side-.15)*1.6,0,az+uz*r.s+ux*(r.side-.15)*1.6,Math.atan2(ux,uz),.82,r.ph,0);continue;}   // sur la ligne de départ
      if(r.fin>=0){const k=O.rs.indexOf(r),ax=f0%N+.5,az=((f0/N)|0)+.5,a=k*2.4,rr=.12+(k%5)*.035;humPut(r.L,ax+Math.cos(a)*rr*.6-.0,0,az+Math.sin(a)*rr,a+Math.PI,.82,r.ph,0);continue;}   // arrivés : ils récupèrent près de l'arche
      const u=r.s%Lc,fw=u<L-1,pos=fw?u:Lc-u,k=Math.min(L-2,Math.floor(pos)),f=pos-k;
      const a=P_[k],b=P_[k+1],ax=a%N+.5,az=((a/N)|0)+.5,bx_=b%N+.5,bz=((b/N)|0)+.5,tx=(bx_-ax)*(fw?1:-1),tz=(bz-az)*(fw?1:-1);
      const px=lerp(ax,bx_,f)-tz*r.side,pz=lerp(az,bz,f)+tx*r.side;r.ph+=run*r.sp*HUM_STEP*.75;
      humPut(r.L,px,0,pz,Math.atan2(tx,tz),.82,r.ph,run>0?1:0);}
    for(const sp of O.spec){sp.ph+=run*3;humPut(sp.L,sp.x,0,sp.z,sp.a+Math.sin(E.t*.7+sp.ph)*.25,.8,sp.ph,0);}
    return;}
  if(O.k==='match'){O.pts.material.opacity=.55+E.night*.45;if(S.set.snd&&SND.ctx&&!SND.muted&&Math.random()<dt*.25)sndNoise(SND.ctx.currentTime+.01,1.2,.03*(.3+clamp(1-(CAM.dist-6)/40,0,1)),900,'bandpass');return;}
  if(O.cones)O.cones.forEach((cn,k)=>{cn.rotation.z=Math.sin(E.t*1.3+k*2)*.5;cn.rotation.x=Math.cos(E.t*1.1+k)*.3;});
  const a=O.pts.geometry.attributes.position.array;for(let j=0;j<a.length;j+=3){a[j+1]+=dt*.35;if(a[j+1]>1.8)a[j+1]=.2;}O.pts.geometry.attributes.position.needsUpdate=true;
}

// ── Bateaux plus variés : kayaks sur les lacs, ferry qui traverse, paquebot en mer ──
function rebuildBoats2(){
  if(!E)return;if(!E.boat2){const mat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}),mk=fn=>{GB=new Map();TX.x=0;TX.z=0;TX.k=0;fn();const g=toGeo(GB.get('plain'));GB=null;return g;};
      const kay=mk(()=>{bc(0,0,.022,.11,-.01,.015,'#ffffff');bc(0,-.01,.012,.012,.015,.05,'#3b8fdc');ico(0,.065,-.01,.012,'#f2c9a0');bx(-.08,-.012,.08,-.006,.04,.045,'#7a5236');});
      const fer=mk(()=>{const g=G('plain'),L=.34,B=.16,y0=-.045,y1=.035,top=[[-B,-L*.72],[-B*.8,-L*.95],[-B*.35,-L],[B*.35,-L],[B*.8,-L*.95],[B,-L*.72],[B,L*.72],[B*.8,L*.95],[B*.35,L],[-B*.35,L],[-B*.8,L*.95],[-B,L*.72]],bot=top.map(([x,z])=>[x*.82,z*.94]),ch=CC('#1d3557'),cw=CC('#f4f6f8'),cd=CC('#7d858d');   /* v12 : vrai bac à voitures */
        for(let k=0;k<top.length;k++){const a=top[k],b=top[(k+1)%top.length],a2=bot[k],b2=bot[(k+1)%top.length];quad(g,[a2[0],y0,a2[1]],[b2[0],y0,b2[1]],[b[0],y1-.02,b[1]],[a[0],y1-.02,a[1]],ch);quad(g,[a[0],y1-.02,a[1]],[b[0],y1-.02,b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]],cw);tri(g,[0,y1,0],[b[0],y1,b[1]],[a[0],y1,a[1]],cd);}
        for(const x of[-.05,.05])bx(x-.003,-.26,x+.003,.26,y1,y1+.002,'#f2c14e');bx(-B,-.24,-B+.012,.24,y1,y1+.035,'#f4f6f8');bx(B-.012,-.24,B,.24,y1,y1+.035,'#f4f6f8');
        for(const [x,z,c] of[[-.05,-.15,'#e63946'],[-.05,.0,'#3b8fdc'],[.03,-.08,'#f2c14e'],[.03,.1,'#ffffff'],[-.05,.16,'#2a9d8f']]){bc(x,z,.022,.04,y1,y1+.022,c);bc(x,z-.004,.019,.022,y1+.022,y1+.036,'#2e3a46');}
        bc(.115,0,.04,.2,y1,y1+.09,'#f4f6f8');bx(.074,-.19,.156,.19,y1+.048,y1+.07,'#2e3a46');bc(.115,0,.045,.07,y1+.09,y1+.135,'#ffffff');bx(.069,-.07,.161,.07,y1+.105,y1+.125,'#2e3a46');
        cyl(.115,.11,y1+.09,y1+.17,.018,.016,8,'#d62828','#1f2933');bc(.115,-.11,.003,.003,y1+.09,y1+.21,'#d0d4d8');for(const z of[-.15,.15])cyl(.157,z,y1+.03,y1+.04,.012,.012,8,'#f97316');
        bc(-B,0,.004,.008,y1+.03,y1+.042,'#ff3b30');bc(B,0,.004,.008,y1+.03,y1+.042,'#2ecc71');});
      const cru=mk(()=>{const g=G('plain'),c=CC('#ffffff');bc(0,0,.18,.62,-.06,.08,'#ffffff');tri(g,[-.18,.08,.62],[0,.08,.95],[.18,.08,.62],c);quad(g,[-.18,-.06,.62],[0,-.06,.95],[0,.08,.95],[-.18,.08,.62],c);quad(g,[0,-.06,.95],[.18,-.06,.62],[.18,.08,.62],[0,.08,.95],c);
        bx(-.185,-.63,.185,.63,-.02,.0,'#1d3557');for(let k=0;k<3;k++){bc(0,-.1-k*.04,.15-k*.025,.42-k*.08,.08+k*.08,.16+k*.08,'#f4f6f8');bc(0,-.1-k*.04,.152-k*.025,.422-k*.08,.11+k*.08,.13+k*.08,'#3b8fdc');}cyl(0,-.25,.32,.45,.05,.045,10,'#d64545','#2e3a46');});
      const I=(g,n)=>{const x=new THREE.InstancedMesh(g,mat,n);x.count=0;x.frustumCulled=false;x.castShadow=true;x.setColorAt(0,new THREE.Color('#fff'));E.gC.add(x);return x;};
      E.boat2={kay:I(kay,8),fer:I(fer,1),cru:I(cru,1),ks:[],ferry:null,cruise:null};}
  const B2=E.boat2,P=E.boats?E.boats.path:[];B2.ks=[];B2.ferry=null;B2.cruise=null;
  // lacs : zones d'eau séparées du grand plan d'eau des bateaux
  const comp=new Int32Array(NN).fill(-1),sizes=[];let nc=0;
  for(let i=0;i<NN;i++){if(!ter[i]||comp[i]>=0)continue;const q=[i];comp[i]=nc;for(let h=0;h<q.length;h++){const j=q[h],x=j%N;for(const k of[x>0?j-1:-1,x<N-1?j+1:-1,j-N,j+N])if(k>=0&&k<NN&&ter[k]&&comp[k]<0){comp[k]=nc;q.push(k);}}sizes.push(q);nc++;}
  const mainC=P.length?comp[clamp(Math.floor(P[P.length>>1][1]),0,N-1)*N+clamp(Math.floor(P[P.length>>1][0]),0,N-1)]:-1;
  const kc=['#e63946','#f2c14e','#2a9d8f','#ff7ad9','#7cc35e','#f08c3a'];
  for(let c=0;c<nc&&B2.ks.length<8;c++){if(c===mainC||sizes[c].length<8||sizes[c].length>500)continue;const n=Math.min(2,Math.floor(sizes[c].length/10)+1);
    for(let k=0;k<n&&B2.ks.length<8;k++){const t=rpick(sizes[c]);B2.ks.push({tiles:sizes[c],x:t%N+.5,z:((t/N)|0)+.5,tx:0,tz:0,wait:0,col:rpick(kc)});}}
  B2.ks.forEach(k=>{const t=rpick(k.tiles);k.tx=t%N+.5;k.tz=((t/N)|0)+.5;});
  if(P.length>12){const zr=P[P.length>>1][1],z=Math.floor(zr);let x0=-1,x1=-1;for(let x=30;x<N;x++){if(ter[z*N+x]){if(x0<0)x0=x;x1=x;}else if(x0>=0)break;}
    if(x0>=0&&x1-x0>=1)B2.ferry={z:z+.5,a:x0+.6,b:x1+.4,u:0,dir:1,wait:2};
    let wide=0,run=0;for(let x=0;x<N;x++){if(ter[z*N+x]){run++;if(run>wide)wide=run;}else run=0;}
    if(wide>=8)B2.cruise={s:Math.random()*(P.length-1),dir:1};}   // une vraie étendue d'eau (mer, grand lac) : un paquebot
}
function stepBoats2(dt,run){
  if(!E.boat2)rebuildBoats2();const B2=E.boat2,m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),sc=new THREE.Vector3(),c=new THREE.Color();let n=0;
  for(const k of B2.ks){const dx=k.tx-k.x,dz=k.tz-k.z,l=Math.hypot(dx,dz);
    if(l<.15){k.wait-=run;if(k.wait<=0){const t=rpick(k.tiles);k.tx=t%N+.5;k.tz=((t/N)|0)+.5;k.wait=2+Math.random()*3;}}
    else{const v=Math.min(l,run*.28);k.x+=dx/l*v;k.z+=dz/l*v;k.a=Math.atan2(dx,dz);}
    e.set(0,k.a||0,Math.sin(E.t*2+k.x)*.05);q.setFromEuler(e);p.set(k.x,-.055,k.z);sc.setScalar(1.3);m.compose(p,q,sc);B2.kay.setMatrixAt(n,m);c.set(k.col);B2.kay.setColorAt(n,c);n++;}
  B2.kay.count=VISIT?0:n;B2.kay.instanceMatrix.needsUpdate=true;if(B2.kay.instanceColor)B2.kay.instanceColor.needsUpdate=true;
  const F=B2.ferry;if(F){if(F.wait>0)F.wait-=run;else{F.u+=run*.12/(F.b-F.a)*F.dir;if(F.u>=1||F.u<=0){F.u=clamp(F.u,0,1);F.dir*=-1;F.wait=3;}}
    e.set(0,Math.PI/2,Math.sin(E.t*1.2)*.02);q.setFromEuler(e);p.set(lerp(F.a,F.b,F.u),-.022,F.z);sc.setScalar(1);m.compose(p,q,sc);B2.fer.setMatrixAt(0,m);B2.fer.count=1;}else B2.fer.count=0;
  B2.fer.instanceMatrix.needsUpdate=true;
  const C=B2.cruise,P=E.boats?E.boats.path:[];if(C&&P.length>2){C.s+=C.dir*run*.09;if(C.s<=0){C.s=0;C.dir=1;}if(C.s>=P.length-1.01){C.s=P.length-1.01;C.dir=-1;}
    const k=Math.floor(C.s),f=C.s-k,a=P[k],b=P[k+1],tx=(b[0]-a[0])*C.dir,tz=(b[1]-a[1])*C.dir;e.set(0,Math.atan2(tx,tz),Math.sin(E.t*.8)*.015);q.setFromEuler(e);
    p.set(lerp(a[0],b[0],f)+.6,-.03,lerp(a[1],b[1],f));sc.setScalar(1.6);m.compose(p,q,sc);B2.cru.setMatrixAt(0,m);B2.cru.count=1;}else B2.cru.count=0;
  B2.cru.instanceMatrix.needsUpdate=true;
}

// ── Amis (v5) : visite en direct, cadeaux, concours de la plus belle ville de la semaine (supabase/city.sql, partie v5) ──
async function visitRefresh(){
  if(!VISIT||VISIT.busy)return;VISIT.busy=true;VISIT.pollT=E.t;let r=null;try{r=await _rpc('city_get',{p_user:VISIT.user});}catch(e){}
  if(!VISIT)return;VISIT.busy=false;VISIT.pollT=E.t;if(!r||!r.data)return;
  const sig=(r.updated_at||'')+'|'+r.data.length;if(sig===VISIT.sig)return;
  const cam=Object.assign({},CAM),uid=VISIT.user,liked=VISIT.liked;VISIT=null;await visitStart(uid,{r,cam});if(VISIT)VISIT.liked=liked;
}
const GIFTS={tree:['Un grand arbre','park'],flowers:['Des massifs de fleurs','local_florist'],bench:['Un banc','chair'],fountain:['Une fontaine','water'],statue:['Une statue','emoji_events'],lamp:['Des lampadaires','light']};
let GIFT_K='fountain';
function panelGift(){
  if(!VISIT)return head('redeem','Offrir un cadeau','')+`<p class="cty-p">Visite la ville d’un ami (bouton Amis) pour lui offrir un cadeau.</p>`;
  return head('redeem',`Un cadeau pour ${esc(VISIT.owner)}`,'Il sera installé dans sa ville à sa prochaine visite','#e05a8a')
    +`<div class="cty-bios">${Object.entries(GIFTS).map(([k,[n,ic]])=>`<button class="${GIFT_K===k?'on':''}" data-act="giftk" data-k="${k}"><span class="ms">${ic}</span><b>${n}</b></button>`).join('')}</div>`
    +`<div class="cty-svnew"><input id="cty-giftmsg" maxlength="80" placeholder="Un petit mot (facultatif)" aria-label="Message"><button class="cty-btn" data-act="giftsend"><span class="ms">send</span>Envoyer</button></div>`
    +`<p class="cty-p small">C’est gratuit · 5 cadeaux par jour au maximum.</p>`;
}
async function giftSend(){
  if(!VISIT)return;const el=$('cty-giftmsg'),msg=el?el.value.trim().slice(0,80):'';
  try{await _rpc('city_gift_send',{p_to:VISIT.user,p_kind:GIFT_K,p_msg:msg});toast(`<b>Cadeau envoyé</b> à ${esc(VISIT.owner)} : ${esc(GIFTS[GIFT_K][0].toLowerCase())} 🎁`,'redeem');closePanel();}
  catch(e){const m=socErr(e);toast(m==='missing'?'Il faut relancer supabase/city.sql dans Supabase (partie cadeaux).':/too_many/.test(m)?'Tu as déjà envoyé 5 cadeaux aujourd’hui.':'Envoi impossible : '+esc(m),'error');}
}
function giftPlace(kind){
  const m=[...SV.values()].find(s=>s.t==='mairie'),cx=m?m.x+m.w/2:N/2,cz=m?m.z+m.d/2:N/2;let best=-1,bd=1e9;
  for(let i=0;i<NN;i++){const x=i%N,z=(i/N)|0;if(!decoOk(x,z)||tree[i])continue;const dd=Math.hypot(x+.5-cx,z+.5-cz)+(rdist[i]>2?4:0);if(dd<bd){bd=dd;best=i;}}
  if(best<0)return -1;
  if(kind==='tree'){tree[best]=3;D.trees=true;}else{deco[best]={flowers:1,bench:2,fountain:3,lamp:4,statue:5}[kind]||1;D.deco=D.cov=true;if(!Array.isArray(S.gt))S.gt=[];S.gt.push(best);if(S.gt.length>200)S.gt.shift();}
  touch(best,true);simRefresh();return best;
}
async function giftsFetch(){
  if(VISIT)return;let L=null;try{L=await _rpc('city_gifts_pending',{});}catch(e){return;}if(!Array.isArray(L)||!L.length||VISIT)return;
  const done=[];for(const g of L){const i=giftPlace(g.kind);if(i<0)break;done.push(g.id);const who=socName(g.from),G_=GIFTS[g.kind]||['Un cadeau','redeem'];
    toast(`<b>🎁 ${esc(who)} t’a offert ${esc(G_[0].toLowerCase())}</b>${g.msg?` : « ${esc(g.msg)} »`:''}`,'redeem',{label:'Voir',fn:()=>flyTo(i%N+.5,((i/N)|0)+.5,10)});
    news('redeem',`Un cadeau de ${who}`,g.msg?`« ${g.msg} » · ${G_[0]} installé en ville.`:`${G_[0]} installé en ville.`,'good');}
  if(done.length){try{await _rpc('city_gift_claim',{p_ids:done});}catch(e){}save();}
}
async function contestCheck(){
  if(VISIT)return;let c=null;try{c=await _rpc('city_contest',{});}catch(e){return;}SOC.contest=c;
  const me=typeof socialProfile==='function'?socialProfile():null;
  if(c&&c.last&&me&&c.last.user===me.id&&S.contestWon!==String(c.week)){S.contestWon=String(c.week);S.money+=5000;floatMoney(5000);
    fireworks(6,'Ta ville a gagné le concours de la semaine !');news('emoji_events','Plus belle ville de la semaine !',`Tes amis ont voté pour ${S.name} (${c.last.votes} voix) : +5 000 §.`,'good');save();}
  if(PANEL==='friends')renderPanel();
}
function contestHTML(myId){
  const c=SOC.contest;if(!c){if(!SOC.cload){SOC.cload=true;contestCheck().finally(()=>{SOC.cload=false;if(!SOC.contest)SOC.contest={err:1};if(PANEL==='friends')renderPanel();});}return `<div class="cty-loading-in"><div class="house-spinner"></div></div>`;}
  if(c.err)return `<p class="cty-p">Le concours a besoin de la dernière version de <b>supabase/city.sql</b> : ouvre Supabase → SQL Editor, colle le fichier et clique sur Run.</p><button class="cty-btn ghost" data-act="crefresh"><span class="ms">refresh</span>Réessayer</button>`;
  const L=(c.board||[]).slice().sort((a,b)=>(b.votes|0)-(a.votes|0));
  return `<p class="cty-p small">Vote pour la plus belle ville de tes amis : une voix par semaine (tu peux changer d’avis jusqu’à dimanche). La ville gagnante reçoit 5 000 § la semaine suivante. Visite les villes avant de voter !</p>`
    +(c.last?`<div class="cty-reward"><span class="ms">emoji_events</span><span>Gagnante de la semaine dernière : <b>${esc((L.find(x=>x.user===c.last.user)||{}).name||'une ville')}</b> (${c.last.votes} voix)</span></div>`:'')
    +(L.length?L.map((x,k)=>`<div class="cty-lb${x.user===myId?' me':''}"><b class="rk">${k+1}</b><span class="t"><b>${esc(x.name)}</b><small>${esc(socName(x))}${x.user===myId?' (toi)':''}</small></span><b class="v">${x.votes|0} 🗳️</b>`
      +(x.user===myId?'':`<button class="cty-px" data-act="fvisit" data-k="${x.user}" title="Visiter"><span class="ms">travel_explore</span></button><button class="cty-btn${c.mine===x.user?' ghost':''}" data-act="cvote" data-k="${x.user}">${c.mine===x.user?'Ta voix ✓':'Voter'}</button>`)+`</div>`).join('')
      :`<p class="cty-p small">Aucune ville d’amis pour l’instant.</p>`)
    +`<button class="cty-btn ghost" data-act="crefresh"><span class="ms">refresh</span>Actualiser</button>`;
}
function friendsClick(a,el){
  const k=el.dataset.k;
  if(a==='gift'){openPanel('gift');return true;}
  if(a==='giftk'){GIFT_K=k;renderPanel();return true;}
  if(a==='giftsend'){giftSend();return true;}
  if(a==='cvote'){_rpc('city_vote',{p_user:k}).then(()=>{toast('Vote enregistré !','how_to_vote');SOC.contest=null;renderPanel();}).catch(e=>toast('Vote impossible : '+esc(socErr(e)),'error'));return true;}
  if(a==='crefresh'){SOC.contest=null;renderPanel();return true;}
  return false;
}

// #########################################################################################
// v6 (13 nov. 2026) : idées choisies par l'utilisateur — ciel de nuit (lune et ses phases, étoiles filantes),
// heure préférée, brume du matin, bonshommes de neige, sons selon l'endroit, pistes cyclables, rues piétonnes,
// voyageurs aux arrêts, aéroport plus vivant, ambulances, pompiers, bus scolaires, récré, quiz pour sauver la ville,
// musée d'anatomie, gazette du dimanche, courbes d'évolution, carnet de quêtes.
// #########################################################################################

// ── Ciel : phases de la lune (cycle de 29,5 jours de jeu) ──
function moonPhase(){return S?((S.day%29.53)+29.53)%29.53/29.53:.5;}
function moonFull(){return 1-Math.abs(moonPhase()-.5)*2;}
function moonName(){const p=moonPhase();return p<.03||p>.97?'Nouvelle lune':p<.22?'Premier croissant':p<.28?'Premier quartier':p<.47?'Lune gibbeuse croissante':p<.53?'Pleine lune':p<.72?'Lune gibbeuse décroissante':p<.78?'Dernier quartier':'Dernier croissant';}
// ── Heure préférée : le ciel reste à l'heure choisie, la ville continue de vivre (E.ltod) ──
const SKY_H=[['cycle','Cycle','autorenew',null],['mo','Matin','wb_twilight',.285],['mi','Midi','light_mode',.45],['su','Coucher de soleil','wb_twilight',.738],['ni','Nuit','dark_mode',.015]];
function skyChips(){
  const cur=S.set.dn?'cycle':(SKY_H.find(s=>s[3]!=null&&Math.abs(s[3]-(S.set.skyH??.4))<.002)||['x'])[0];
  return `<div class="cty-skyh">${SKY_H.map(([k,n,ic])=>`<button class="${k===cur?'on':''}" data-act="skyh" data-k="${k}"><span class="ms">${ic}</span>${n}</button>`).join('')}</div>`
    +`<p class="cty-p small">Choisis une heure pour garder ce ciel (le coucher de soleil, par exemple) : les voitures, les habitants et les saisons continuent de vivre. « Cycle » fait tourner le jour et la nuit.</p>`;
}
function skyPick(k){
  const s=SKY_H.find(x=>x[0]===k);if(!s)return;
  if(k==='cycle'){S.set.dn=true;S.set.skyH=null;if(E&&E.ltod!=null)E.tod=E.ltod;}
  else{S.set.dn=false;S.set.skyH=s[3];}
  save();renderPanel();
  if(k==='ni')toast(`Ce soir : <b>${moonName().toLowerCase()}</b>. Incline la caméra pour voir les étoiles.`,'dark_mode',{label:'Regarder le ciel',fn:skyLook});
}
function skyLook(){closePanel();if(E)E.skyLook=true;tweenCam({pitch:.1,yaw:.97,dist:Math.max(CAM.dist,34)});v6Quest('stars');}   // la caméra peut alors s'incliner plus bas

// ── Brume du matin au-dessus de l'eau ──
// v6.1 : la brume n'est plus faite de grosses taches (jugées laides, coupées net contre les rives) :
// c'est un voile doux et irrégulier dessiné directement sur l'eau (uMist dans le shader de l'eau), de la couleur du ciel.
function mistK(){
  if(!S.set.wx&&!S.set.dn&&S.set.skyH==null)return 0;
  const t=E.tod,m=month(),k=Math.exp(-Math.pow((t-.275)/.045,2));   // pic juste après le lever du soleil
  const wx=S.wx&&S.wx.k==='fog'?.35:0,aut=m>=8&&m<=10?1.35:1,dry=BIO().nosnow&&S.biome==='desert'?0:1;
  return clamp((k*aut+wx)*dry,0,1);
}
function stepMist(dt){WATER_U.uMist.value=lerp(WATER_U.uMist.value,mistK(),Math.min(1,dt*.5));}

// ── Bonshommes de neige en hiver (parcs et jardins près des maisons) ──
function makeSnowmen(){
  GB=new Map();TX.x=0;TX.z=0;TX.k=0;
  ico(0,.06,0,.07,'#f7f9fc');ico(0,.155,0,.05,'#f7f9fc');ico(0,.235,0,.036,'#f7f9fc');
  cyl(0,0,.188,.203,.043,.043,10,'#d64545');bc(.025,.03,.008,.006,.19,.2,'#d64545');
  bc(0,.045,.006,.016,.232,.24,'#f07c1f');bc(-.013,.03,.004,.003,.244,.252,'#222222');bc(.013,.03,.004,.003,.244,.252,'#222222');
  for(const y of[.14,.165])bc(0,.05,.004,.003,y,y+.008,'#222222');
  cyl(0,0,.266,.272,.047,.047,10,'#2a2a2a');cyl(0,0,.272,.31,.03,.03,10,'#2a2a2a');
  bc(-.075,0,.03,.004,.165,.171,'#6b4a2e');bc(.075,0,.03,.004,.165,.171,'#6b4a2e');
  const g=toGeo(GB.get('plain'));GB=null;
  const m=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({vertexColors:true}),16);m.count=0;m.frustumCulled=false;m.castShadow=true;E.gC.add(m);
  E.v6.snow={mesh:m,spots:[],key:''};
}
function snowSpots(){
  const L=[],R=rng((S.seed|0)+((S.day/360)|0)*977);
  for(let i=0;i<NN;i++){if(ter[i]||road[i]||zone[i]||svcAt[i]||tree[i]||mtn[i]||hill[i]||OVT[i]>=0||!inAreaI(i))continue;   /* v15 : pas sous un pont routier */
    const x=i%N;let nearHome=false;for(const j of[i-N,i+N,x>0?i-1:-1,x<N-1?i+1:-1])if(j>=0&&j<NN&&zone[j]===ZR&&lvl[j])nearHome=true;
    if(nearHome||deco[i]===2||deco[i]===7)L.push(i);}
  const out=[];for(let k=0;k<16&&L.length;k++){const j=(R()*L.length)|0,i=L.splice(j,1)[0];out.push([i%N+.3+R()*.4,((i/N)|0)+.3+R()*.4,R()*6.28]);}
  return out;
}
function stepSnowmen(){
  const W=E.v6.snow,on=S.set.sn&&!BIO().nosnow&&SNOW.value>.55&&!VISIT,k=clamp((SNOW.value-.55)/.25,0,1);
  if(!on){W.mesh.count=0;return;}
  const key=((S.day/360)|0)+'|'+ST.pop;if(!W.spots.length||W.key.split('|')[0]!==key.split('|')[0]||E.t-(W.t||0)>40){W.key=key;W.t=E.t;W.spots=snowSpots();
    if(W.spots.length&&S.seen&&S.seen.snowman!==((S.day/360)|0)){S.seen.snowman=(S.day/360)|0;news('ac_unit','Les bonshommes de neige sont de sortie',`${W.spots.length} bonshommes de neige ont poussé dans les jardins de ${S.name}.`);}}
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),sc=new THREE.Vector3();let n=0;
  for(const [x,z,a] of W.spots){e.set(0,a,0);q.setFromEuler(e);p.set(x,0,z);sc.setScalar(.95*k);m.compose(p,q,sc);W.mesh.setMatrixAt(n++,m);}
  W.mesh.count=n;W.mesh.instanceMatrix.needsUpdate=true;
}

// ── Sons selon l'endroit regardé : vagues, circulation, oiseaux des parcs, récré, chantier, vent ──
const AMB={w:0,g:0,t:0,m:0,s:false,c:false,at:-9};
function isGreenSvc(id){const s=SV.get(id);if(!s)return false;const c=BT[s.t].cat;return c==='parcs'||c==='loisirs';}
function ambSample(){
  const r=Math.round(clamp(CAM.dist*.3,3,14)),st=Math.max(1,Math.round(r/5)),cx=Math.round(CAM.x),cz=Math.round(CAM.z);let n=0,w=0,g=0,t=0,m=0;
  for(let z=cz-r;z<=cz+r;z+=st)for(let x=cx-r;x<=cx+r;x+=st){if(x<0||z<0||x>=N||z>=N)continue;const i=z*N+x;n++;
    if(ter[i]&&!road[i])w++;else if(mtn[i]>=2)m++;else if(road[i])t+=Math.min(1,.25+(trf[i]||0)/100)*(lane[i]===2?0:1);else if(tree[i]||deco[i]||hill[i]||(svcAt[i]&&isGreenSvc(svcAt[i])))g++;}
  const cars=E.cars&&E.cars.list?E.cars.list.length:0;
  AMB.w=n?w/n:0;AMB.g=n?g/n:0;AMB.t=n?t/n*Math.min(1,cars/20):0;AMB.m=n?m/n:0;
  AMB.s=[...SV.values()].some(s=>s.t==='school'&&Math.hypot(s.x+1-CAM.x,s.z+1-CAM.z)<r+2);
  AMB.c=!!(S.cons&&Object.keys(S.cons).some(id=>{const s=SV.get(+id);return s&&Math.hypot(s.x-CAM.x,s.z-CAM.z)<r+2;}));
  AMB.ap=[...SV.values()].some(s=>s.t==='aeroport'&&Math.hypot(s.x+2-CAM.x,s.z+2-CAM.z)<r+6);
}
function ambPan(){const c=SND.ctx;if(!c.createStereoPanner)return SND.master;const p=c.createStereoPanner();p.pan.value=(Math.random()-.5)*1.2;p.connect(SND.master);return p;}
function ambSwell(t,v,f,dur){
  dur=dur||2.6;const c=SND.ctx,s=c.createBufferSource();s.buffer=SND.noiseBuf;s.loop=true;const fl=c.createBiquadFilter();fl.type='lowpass';
  fl.frequency.setValueAtTime(f*.6,t);fl.frequency.linearRampToValueAtTime(f*1.3,t+dur*.45);fl.frequency.linearRampToValueAtTime(f*.5,t+dur);
  const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+dur*.45);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(fl);fl.connect(g);g.connect(ambPan());s.start(t,Math.random()*.5);s.stop(t+dur+.1);
}
function ambPass(t,v){   // une voiture qui passe : souffle filtré qui descend
  const c=SND.ctx,s=c.createBufferSource();s.buffer=SND.noiseBuf;const fl=c.createBiquadFilter();fl.type='bandpass';fl.Q.value=.9;
  fl.frequency.setValueAtTime(900,t);fl.frequency.exponentialRampToValueAtTime(320,t+1);
  const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.4);g.gain.exponentialRampToValueAtTime(.0001,t+1.1);
  s.connect(fl);fl.connect(g);g.connect(ambPan());s.start(t,Math.random()*.4);s.stop(t+1.2);
}
function ambFrame(t,zoom,day,wet){
  if(E.t-AMB.at>1){AMB.at=E.t;ambSample();}
  const A=AMB,near=.35+zoom*.65;
  if(A.w>.12&&t>(A.nw||0)){A.nw=t+2.8+Math.random()*3;const v=.034*Math.min(1,A.w*1.6)*near*(S.wx&&S.wx.k==='storm'?1.6:1);ambSwell(t,v,S.biome==='littoral'||A.w>.45?520:380);
    if((S.biome==='littoral'||S.biome==='tropical')&&day>.6&&Math.random()<.18){for(let k=0;k<2;k++)sndTone(1500-k*120,t+.7+k*.32,.24,v*.35,'triangle',950);}}
  if(A.t>.04&&t>(A.nt||0)){A.nt=t+.7+Math.random()*Math.max(.6,2.4-A.t*1.8);ambPass(t,.015*Math.min(1,A.t*2.2)*near*(.45+.55*Math.min(1.6,rushK())/1.6));
    if(ST.jam>35&&A.t>.25&&Math.random()<.07){sndTone(392,t+.2,.09,.012*near,'square');sndTone(392,t+.36,.12,.012*near,'square');}}
  if(A.g>.18&&day>.6&&!wet&&SNOW.value<.5&&t>(A.ng||0)){A.ng=t+1.2+Math.random()*2.5;const n=2+((Math.random()*3)|0),f=2200+Math.random()*2200,v=.015*Math.min(1,A.g*1.5)*near;
    for(let k=0;k<n;k++)sndTone(f*(1+Math.random()*.25),t+k*.1,.07,v,'sine',f*(1.3+Math.random()*.3));}
  if(A.s&&isRecess()&&t>(A.ns||0)){A.ns=t+.9+Math.random()*1.4;const v=.007*near;
    for(let k=0;k<3;k++){const f=650+Math.random()*450;sndTone(f,t+k*.13+Math.random()*.08,.11,v,'triangle',f*(Math.random()<.5?1.35:.8));}}
  if(A.c&&day>.5&&t>(A.nc||0)){A.nc=t+.9+Math.random()*1.6;for(let k=0;k<2+((Math.random()*2)|0);k++)sndNoise(t+k*.17,.05,.03*near,1400,'bandpass');}
  if(A.m>.25&&t>(A.nm||0)){A.nm=t+5+Math.random()*5;ambSwell(t,.018*near,260,3.6);}
  if(A.ap&&t>(A.na||0)){A.na=t+9+Math.random()*8;ambSwell(t,.02*near,700,4.5);}
}
function isRecess(){const h=hourNow();return(h>=10&&h<10.6)||(h>=12&&h<13.2)||(h>=15.2&&h<15.8);}

// ── Pistes cyclables (lane = 1) et rues piétonnes (lane = 2) : nouvelle couche de carte, posée sur les routes ──
const LANE_COST={1:15,2:40},LANE_N={1:'Piste cyclable',2:'Rue piétonne'};
const laneLV=new Int8Array(NN),laneHP=new Int8Array(NN);
function laneOk(i){return (road[i]===1||road[i]===3)&&!ter[i];}
function laneCount(k){let n=0;for(let i=0;i<NN;i++)if(lane[i]===k&&road[i])n++;return n;}
function bikeShare(){return Math.min(.08,laneCount(1)/450);}
function laneCoverage(){
  laneLV.fill(0);laneHP.fill(0);
  for(let i=0;i<NN;i++){const k=lane[i];if(!k||!road[i])continue;const x=i%N,z=(i/N)|0,r=2;
    for(let zz=Math.max(0,z-r);zz<=Math.min(N-1,z+r);zz++)for(let xx=Math.max(0,x-r);xx<=Math.min(N-1,x+r);xx++){const j=zz*N+xx,d=Math.abs(xx-x)+Math.abs(zz-z);if(d>r)continue;
      if(k===2){laneLV[j]=Math.max(laneLV[j],d<=1?6:4);laneHP[j]=Math.max(laneHP[j],d<=1?4:2);if(COV.park[j]<30)COV.park[j]=30;}
      else{laneHP[j]=Math.max(laneHP[j],2);if(COV.transport[j]<22)COV.transport[j]=22;}}}
}
function lanePreview(d){
  const k=TOOL.k|0,pts=roadPath(d),list=[];let cost=0,bad=0,n=0;
  for(const [x,z] of pts){const i=z*N+x;
    if(k===0){if(lane[i]){n++;cost-=LANE_COST[lane[i]];list.push([x,z,'#ff8a65']);}else list.push([x,z,'#9fb4c7']);continue;}
    const ok=laneOk(i);if(!ok){bad++;list.push([x,z,'#ff4d4d']);continue;}
    if(lane[i]===k){list.push([x,z,'#9fb4c7']);continue;}
    n++;cost+=LANE_COST[k]-(lane[i]?LANE_COST[lane[i]]:0);list.push([x,z,k===1?'#3ddc84':'#f2b134']);}
  setPreview(list);
  if(k===0)tip(n?`Remettre ${n} case${n>1?'s':''} en route normale · +${money(-cost)} remboursés`:'Glisse sur une piste cyclable ou une rue piétonne',n?'':'bad');
  else if(bad&&!n)tip('Se pose sur une route ou une avenue (pas sur l’autoroute ni sur un pont)','bad');
  else tip(`${LANE_N[k]} · ${n} case${n>1?'s':''} · ${money(Math.max(0,cost))}`,cost>S.money||!n?'bad':'');
  return true;
}
function laneToolUp(d){
  const k=TOOL.k|0,pts=roadPath(d),L=[];let cost=0;
  for(const [x,z] of pts){const i=z*N+x;if(k===0){if(lane[i]){L.push(i);cost-=LANE_COST[lane[i]];}continue;}
    if(laneOk(i)&&lane[i]!==k){L.push(i);cost+=LANE_COST[k]-(lane[i]?LANE_COST[lane[i]]:0);}}
  if(!L.length)return true;if(cost>0&&S.money<cost){noMoney(cost);return true;}
  actBegin();L.forEach(i=>{rec(i);lane[i]=k;touch(i,true);});S.money-=cost;actEnd(cost,k===0?'route normale':LANE_N[k].toLowerCase());
  D.cov=true;if(E.v6)E.v6.laneDirty=true;simRefresh();afterAction();floatMoney(-cost);sndPlay('build');
  if(k===1){toast(`<b>Piste cyclable</b> : les vélos arrivent ! (${laneCount(1)} cases en tout)`,'pedal_bike');if(laneCount(1)>=5)v6Quest('bike');}
  if(k===2){toast('<b>Rue piétonne</b> : plus de voitures, place aux terrasses, au marché et aux lampions.','directions_walk');v6Quest('ped');}
  return true;
}
// sol : bandes vertes des pistes, pavés des rues piétonnes (dessinés sur la route)
function laneGround(c,i,x,z,px,pz){
  const m=roadMask(x,z),k=lane[i];
  if(k===2){c.fillStyle='#d9c8a5';c.fillRect(px,pz,PX,PX);c.fillStyle='rgba(120,92,55,.22)';
    for(let yy=0;yy<PX;yy+=4){c.fillRect(px,pz+yy,PX,.8);for(let xx=(yy/4)%2?2:0;xx<PX;xx+=5)c.fillRect(px+xx,pz+yy,.8,4);}
    c.fillStyle='rgba(176,96,72,.35)';if(m&5&&!(m&10))c.fillRect(px+H2-3,pz,6,PX);else if(m&10&&!(m&5))c.fillRect(px,pz+H2-3,PX,6);else{c.beginPath();c.arc(px+H2,pz+H2,6,0,7);c.fill();}
    return;}
  const sw=5,g='#3fae62',arm=(vert,a,b)=>{c.fillStyle=g;if(vert){c.fillRect(px+sw,pz+a,4,b-a);c.fillRect(px+PX-sw-4,pz+a,4,b-a);}else{c.fillRect(px+a,pz+sw,b-a,4);c.fillRect(px+a,pz+PX-sw-4,b-a,4);}
    c.fillStyle='rgba(255,255,255,.85)';if(vert){for(let yy=a;yy<b;yy+=5){c.fillRect(px+sw+4,pz+yy,.8,3);c.fillRect(px+PX-sw-4.8,pz+yy,.8,3);}}else{for(let xx=a;xx<b;xx+=5){c.fillRect(px+xx,pz+sw+4,3,.8);c.fillRect(px+xx,pz+PX-sw-4.8,3,.8);}}};
  const v=m&5,h=m&10;
  if(v&&!h)arm(true,0,PX);else if(h&&!v)arm(false,0,PX);
  else{if(m&1)arm(true,0,sw);if(m&4)arm(true,PX-sw,PX);if(m&8)arm(false,0,sw);if(m&2)arm(false,PX-sw,PX);}
  if((v&&!h)||(h&&!v)){c.fillStyle='rgba(255,255,255,.9)';const bx_=v?px+sw+2:px+H2-3,by=v?pz+H2-3:pz+sw+2;   // petit vélo peint
    c.beginPath();c.arc(bx_-1.2+(v?0:1),by+(v?1:-1)+3,1.3,0,7);c.arc(bx_+2.2+(v?0:1),by+(v?1:-1)+3,1.3,0,7);c.fill();}
}
// décor 3D des rues piétonnes : lampions, terrasses de café, étals du marché, jardinières
const LAMPI=['#ff5d5d','#ffd166','#5bc0eb','#7ee081','#ff9f40','#c77dff'];
function laneTile(i,x,z){
  if(lane[i]!==2||ter[i])return;
  const m=roadMask(x,z),vert=(m&5)&&!(m&10),horiz=(m&10)&&!(m&5),R=rng(i*13+5),r=R();
  TX.x=x+.5;TX.z=z+.5;TX.k=horiz?1:0;
  if(!vert&&!horiz){ico(0,.05,0,.06,'#9a958c',.6);tree3(0,0,.07);for(let k=0;k<4;k++){const a=k/4*6.283+.6;bench(Math.cos(a)*.3,Math.sin(a)*.3,k%2===0);}TOP[i]=.4;return;}
  // lampions tendus d'un trottoir à l'autre
  if(((x+z)&1)===0){bc(-.44,0,.008,.008,0,.3,'#6b6f75');bc(.44,0,.008,.008,0,.3,'#6b6f75');
    for(let k=0;k<8;k++){const u0=-.44+k*.11,u1=u0+.11,y0=.295-.06*(1-Math.pow(u0/.44,2)),y1=.295-.06*(1-Math.pow(u1/.44,2));bx(u0,-.002,u1,.002,Math.min(y0,y1)-.002,Math.max(y0,y1)+.002,'#3a3a3a');}
    for(let k=0;k<7;k++){const u=-.33+k*.11,y=.27-.06*(1-Math.pow(u/.44,2));ico(u,y,0,.024,LAMPI[(k+i)%LAMPI.length],1.3,'basic');}}
  if(r<.45){for(const [ox,oz] of[[-.22,-.18],[.2,.16]]){cyl(ox,oz,0,.06,.008,.008,6,'#4a4f55');cyl(ox,oz,.06,.065,.05,.05,10,'#f4f1ea');
      for(const s of[-1,1])bc(ox+s*.07,oz,.016,.016,0,.035,'#8a5a3b');cyl(ox,oz,.06,.2,.004,.004,5,'#d0d0d0');cone(ox,oz,.17,.06,.12,8,pick(R,['#e63946','#2a9d8f','#f2b134','#3b8fdc','#ffffff']));}}
  else if(r<.72){const c1=pick(R,['#e63946','#2a9d8f','#3b8fdc','#f2b134']);bx(-.2,-.12,.2,.12,0,.08,'#a0714f');bx(-.2,-.12,.2,.12,.08,.085,'#c99a6a');
    for(let k=0;k<6;k++)ico(-.15+k*.06,.1,-.04+(k%2)*.08,.022,pick(R,['#e63946','#f2b134','#7ee081','#ff9f40','#c77dff']),.8);
    for(const s of[-.19,.19])for(const t of[-.11,.11])bc(s,t,.007,.007,.08,.24,'#6b4a2e');
    for(let k=0;k<4;k++)bx(-.22+k*.11,-.15,-.11+k*.11,.15,.24,.25,k%2?'#ffffff':c1);}
  else{for(const oz of[-.3,.3]){bx(-.08,oz-.05,.08,oz+.05,0,.07,'#9a8f80');for(let k=0;k<4;k++)ico(-.05+k*.033,.09,oz,.025,pick(R,['#e63973','#f2b134','#ffffff','#a23b72','#ef6f6c']),.8);}}
  TOP[i]=.4;
}

// ── Monde vivant v6 : vélos, promeneurs des rues piétonnes, voyageurs aux arrêts, enfants à la récré ──
function riderGeo(sh,hair){GB=new Map();TX.x=0;TX.z=0;TX.k=0;
  for(const oz of[-.045,.045])bc(0,oz,.004,.026,0,.052,'#2b2b2b');   // roues (vues de côté)
  bc(0,0,.004,.05,.03,.036,'#3b8fdc');bc(0,-.02,.004,.004,.036,.06,'#4a4f55');bc(0,.035,.004,.004,.036,.075,'#4a4f55');bc(0,.035,.022,.003,.075,.08,'#4a4f55');
  bc(-.009,-.005,.006,.006,.03,.07,'#34495e');bc(.009,.005,.006,.006,.03,.07,'#34495e');
  bc(0,-.01,.02,.013,.07,.12,sh);bc(-.02,.015,.005,.02,.095,.105,sh);bc(.02,.015,.005,.02,.095,.105,sh);
  ico(0,.14,-.005,.017,'#f1c7a3');ico(0,.149,-.009,.017,hair,.72);
  const g=toGeo(GB.get('plain'));GB=null;return g;}
function v6Make(){
  E.v6={laneDirty:true,bikes:[],strl:[],kids:new Map(),ev:[],evT:0,sb:{},ap:null};
  const mat=new THREE.MeshLambertMaterial({vertexColors:true}),I=(g,n)=>{const x=new THREE.InstancedMesh(g,mat,n);x.count=0;x.frustumCulled=false;x.castShadow=true;E.gC.add(x);return x;};
  E.v6.bike=PPL_SH.map((sh,k)=>I(riderGeo(sh,PPL_HAIR[(k+1)%4]),14));
  makeSnowmen();makeEV();
}
function v6Reset(){if(!E.v6)return;E.v6.laneDirty=true;E.v6.bikes=[];E.v6.strl=[];E.v6.kids=new Map();E.v6.ev=[];E.v6.sb={};E.v6.snow.spots=[];E.v6.ap=null;}
const _m6=new THREE.Matrix4(),_q6=new THREE.Quaternion(),_e6=new THREE.Euler(),_p6=new THREE.Vector3(),_s6=new THREE.Vector3();
let PPLN=[0,0,0,0];
function putP(L,x,y,z,ang,sc,ph,amp){humPut(L,x,y,z,ang,sc,ph||0,amp||0);}
function laneNb(i,d,k){const x=i%N,z=(i/N)|0,X=x+DIRS[d][0],Z=z+DIRS[d][1];if(X<0||Z<0||X>=N||Z>=N)return -1;const j=Z*N+X;return lane[j]===k&&road[j]?j:-1;}
function laneWalk(o,k,run){   // fait avancer o {i,d,t,sp} sur les cases de la couche lane = k
  o.t+=run*o.sp;let g=0;
  while(o.t>=1&&g++<3){o.t-=1;const j=laneNb(o.i,o.d,k);if(j>=0)o.i=j;
    const back=(o.d+2)%4,opts=[0,1,2,3].filter(d=>d!==back&&laneNb(o.i,d,k)>=0);o.d=opts.length?(opts.includes(o.d)&&Math.random()<.7?o.d:rpick(opts)):back;}
}
function v6People(dt,run){
  const V=E.v6;PPLN=[0,0,0,0];
  if(V.laneDirty){V.laneDirty=false;V.L1=[];V.L2=[];for(let i=0;i<NN;i++){if(!road[i])continue;if(lane[i]===1)V.L1.push(i);else if(lane[i]===2)V.L2.push(i);}V.bikes=V.bikes.filter(b=>lane[b.i]===1);V.strl=V.strl.filter(s=>lane[s.i]===2);}
  const day=1-E.night*.75;
  // vélos
  const wantB=Math.min(56,Math.floor(V.L1.length/2.2*day));
  while(V.bikes.length<wantB&&V.L1.length){const i=rpick(V.L1),o=[0,1,2,3].filter(d=>laneNb(i,d,1)>=0);V.bikes.push({i,d:o.length?rpick(o):0,t:Math.random(),sp:.5+Math.random()*.18,v:(Math.random()*4)|0});}
  if(V.bikes.length>wantB)V.bikes.length=wantB;
  const nb=[0,0,0,0];
  for(const b of V.bikes){if(lane[b.i]!==1)continue;laneWalk(b,1,run);const dx=DIRS[b.d][0],dz=DIRS[b.d][1],x=b.i%N+.5+dx*(b.t-.5),zz=((b.i/N)|0)+.5+dz*(b.t-.5);
    if(nb[b.v]>=14)continue;_e6.set(0,Math.atan2(dx,dz),0);_q6.setFromEuler(_e6);_p6.set(x-dz*.33,0,zz+dx*.33);_s6.setScalar(.95);_m6.compose(_p6,_q6,_s6);E.v6.bike[b.v].setMatrixAt(nb[b.v]++,_m6);}
  E.v6.bike.forEach((m,k)=>{m.count=nb[k];m.instanceMatrix.needsUpdate=true;});
  // promeneurs des rues piétonnes
  const wantS=Math.min(120,Math.round(V.L2.length*1.6*day));
  while(V.strl.length<wantS&&V.L2.length){const i=rpick(V.L2),o=[0,1,2,3].filter(d=>laneNb(i,d,2)>=0);V.strl.push({i,d:o.length?rpick(o):0,t:Math.random(),sp:.11+Math.random()*.07,L:humLook((Math.random()*1e9)|0),off:(Math.random()<.5?-1:1)*(.36+Math.random()*.05),pause:0});}
  if(V.strl.length>wantS)V.strl.length=wantS;
  for(const s of V.strl){if(lane[s.i]!==2)continue;
    if(s.pause>0)s.pause-=run;else{const sp0=s.sp;s.sp*=s.L.sp;laneWalk(s,2,run);s.sp=sp0;if(Math.random()<run*.04)s.pause=1+Math.random()*3;}   // on s'arrête devant les vitrines
    const dx=DIRS[s.d][0],dz=DIRS[s.d][1],x=s.i%N+.5+dx*(s.t-.5),zz=((s.i/N)|0)+.5+dz*(s.t-.5),mv=s.pause<=0&&run>0;
    humFollow(s,x-dz*s.off,zz+dx*s.off,run);putP(s.L,s.rx,0,s.rz,s.ra+(s.pause>0?1.2:0),.8,s.ph,mv?.5:0);}
  // voyageurs qui attendent aux arrêts (plus nombreux aux heures de pointe)
  const h=hourNow(),base=h<6||h>=23?0:isRush()?5:h>=9.5&&h<17?2:1;
  if(base)for(const s of SV.values()){if(s.t!=='tramstop'&&s.t!=='metro'&&s.t!=='bus'&&s.t!=='gare')continue;const F=svcFront(s);if(!F)continue;
    const n=Math.min(8,base+(s.t==='metro'||s.t==='gare'?2:0)),R=rng(s.id*7+((E.t/40)|0));
    for(let k=0;k<n;k++){const u=(k-(n-1)/2)*.1+(R()-.5)*.04,w=R()*.06;putP(humLookC(s.id*13+k),F.x+F.lx*u+F.nx*w,F.y,F.z+F.lz*u+F.nz*w,F.ang+(R()-.5)*.8,.8,0,0);}}
  // récré : les enfants courent dans la cour de l'école
  const rec=isRecess()&&E.night<.5;
  for(const s of SV.values()){if(s.t!=='school')continue;let K=V.kids.get(s.id);
    if(!rec){if(K)V.kids.delete(s.id);continue;}
    if(!K){K=[];for(let k=0;k<12;k++)K.push({x:-.2+Math.random()*1,z:-.15+Math.random()*.95,tx:0,tz:0,w:0,L:humLook(s.id*100+k,{kid:true}),ph:0});K.forEach(c=>{c.tx=c.x;c.tz=c.z;});V.kids.set(s.id,K);}
    TX.x=s.x+s.w/2;TX.z=s.z+s.d/2;TX.k=s.rot|0;
    for(const c of K){const ddx=c.tx-c.x,ddz=c.tz-c.z,dd=Math.hypot(ddx,ddz);
      if(dd<.03){c.w-=run;if(c.w<=0){c.tx=-.2+Math.random()*1;c.tz=-.15+Math.random()*.95;c.w=Math.random()*1.5;}}
      else{const st=Math.min(dd,run*.45);c.x+=ddx/dd*st;c.z+=ddz/dd*st;c.a=Math.atan2(ddx,ddz);c.ph+=st*HUM_STEP*1.25;}
      const [wx,wz]=P(c.x,c.z),run_=dd>=.03&&run>0;putP(c.L,wx,0,wz,(c.a||0)+(TX.k|0)*Math.PI/2,.88,c.ph,run_?.95:0);}}
}
// devant d'un bâtiment public : case de route voisine, position sur le trottoir et orientation vers la route
function svcFront(s){
  if(s._f&&s._fr===road[s._f.ri])return s._f;
  for(let z=s.z;z<s.z+s.d;z++)for(let x=s.x;x<s.x+s.w;x++)for(let d=0;d<4;d++){const X=x+DIRS[d][0],Z=z+DIRS[d][1];if(X<0||Z<0||X>=N||Z>=N)continue;const j=Z*N+X;if(!road[j])continue;
    const dx=DIRS[d][0],dz=DIRS[d][1];const f={ri:j,bi:z*N+x,x:x+.5+dx*.62,z:z+.5+dz*.62,y:0,ang:Math.atan2(dx,dz),nx:-dx,nz:-dz,lx:-dz,lz:dx};s._f=f;s._fr=road[j];return f;}
  return null;
}

// ── Aéroport plus vivant : avions au parking, balisage lumineux de la piste la nuit, feux des avions, tableau des vols ──
const AP_DEST=['Lisbonne','Montréal','Marrakech','Rome','Berlin','Dakar','Athènes','Tokyo','Barcelone','Copenhague','Reykjavik','Le Caire','Séville','Dublin','Istanbul','Québec'];
function v6Airport(dt){
  const PL=E.planes,ap=[...SV.values()].find(s=>s.t==='aeroport'&&svcOK.get(s.id)),V=E.v6;
  if(!ap||!PL){if(V.ap){V.ap.pts.visible=false;}return;}
  if(!V.ap){const n=40,geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3),col=new Float32Array(n*3);
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(col,3).setUsage(THREE.DynamicDrawUsage));
    const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:.16,map:glowTex(),vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));pts.frustumCulled=false;pts.renderOrder=9;E.gD.add(pts);
    V.ap={pts,pos,col,n,id:-1};
    const wc=new THREE.Color('#ffffff');for(let k=0;k<4;k++)PL.mesh.setColorAt(k,wc);if(PL.mesh.instanceColor)PL.mesh.instanceColor.needsUpdate=true;}   // avant : 2e avion noir (teinte jamais remplie)
  const A=V.ap;TX.x=ap.x+ap.w/2;TX.z=ap.z+ap.d/2;TX.k=ap.rot|0;
  // deux avions au parking devant l'aérogare
  let n=PL.mesh.count;const a0=P(0,0),a1=P(1,0),ang=Math.atan2(a1[0]-a0[0],a1[1]-a0[1]);
  for(const [lx,lz,rot] of[[-.9,.1,-Math.PI/2],[.35,.1,-Math.PI/2]]){if(n>=4)break;const w=P(lx,lz);PL.p.set(w[0],.03,w[1]);PL.e.set(0,ang+rot,0,'YXZ');PL.q.setFromEuler(PL.e);PL.s.setScalar(1);PL.m.compose(PL.p,PL.q,PL.s);PL.mesh.setMatrixAt(n++,PL.m);}
  PL.mesh.count=n;PL.mesh.instanceMatrix.needsUpdate=true;
  // lumières : balisage de la piste + feux de navigation des avions en vol
  const lit=clamp((E.night-.35)/.3,0,1);A.pts.visible=lit>.02;if(!A.pts.visible)return;
  let k=0;const put=(x,y,z,r,g,b)=>{if(k>=A.n)return;A.pos[k*3]=x;A.pos[k*3+1]=y;A.pos[k*3+2]=z;A.col[k*3]=r*lit;A.col[k*3+1]=g*lit;A.col[k*3+2]=b*lit;k++;};
  for(let j=0;j<10;j++){const u=-1.8+j*.4;for(const lz of[.58,1.22]){const w=P(u,lz);put(w[0],.05,w[1],1,.85,.45);}}
  const seq=(E.t*3)%1;for(let j=0;j<5;j++){const w=P(2.05+j*.3,.9),on=Math.abs(seq-(1-j/5))<.12?1:.08;put(w[0],.06,w[1],on,on,on*1.1);}
  for(let j=0;j<Math.min(2,PL.list.length);j++){PL.mesh.getMatrixAt(j,_m6);_p6.setFromMatrixPosition(_m6);if(_p6.y<.05)continue;const bl=(E.t*1.3+j*.4)%1<.12?1:0;
    put(_p6.x,_p6.y+.03,_p6.z,1,.3,.3);put(_p6.x,_p6.y+.06,_p6.z,bl,bl,bl);}
  while(k<A.n){A.pos[k*3+1]=-50;k++;}
  A.pts.geometry.attributes.position.needsUpdate=true;A.pts.geometry.attributes.color.needsUpdate=true;
}
function airportBoard(){
  const PL=E&&E.planes;if(!PL||!PL.list.length)return '';const L=[];
  const cyc=Math.floor((E.t/26)),R=k=>AP_DEST[(cyc*3+k*5+(S.seed|0))%AP_DEST.length];
  PL.list.forEach((p,k)=>{const left=Math.max(0,Math.round((1-p.t)*26/animK()));L.push(p.dep?[R(k),p.t<.22?'Décollage en cours':'En vol',`départ`]:[R(k+7),p.t>.75?'Atterrissage':'En approche','arrivée']);void left;});
  L.push([R(11),'Embarquement porte 2','départ'],[R(13),'À l’heure','départ']);
  return `<div class="cty-sec">Tableau des vols</div><div class="cty-board">${L.map(([d,s,t])=>`<div><span class="ms">${t==='départ'?'flight_takeoff':'flight_land'}</span><b>${esc(d)}</b><small>${esc(s)}</small></div>`).join('')}</div>`;
}
function carsSaved(){if(!ST.pop)return 0;const pt=Math.min(.38,svcCount('bus')*.02+svcCount('metro')*.05+svcCount('gare')*.06+svcCount('tramstop')*.02+bikeShare());return Math.round(ST.pop*.062*pt);}

// ── Véhicules d'urgence et bus scolaires : ils suivent les routes (roadPathBFS), gyrophares qui clignotent ──
const EVK={
  amb:{sp:2.6,beacon:true,build:()=>{bc(0,0,.045,.1,.02,.115,'#f7f8fa');bx(-.046,-.1,.046,.1,.06,.075,'#e63946');bc(0,.09,.04,.012,.06,.1,'#2e3a46');bx(-.046,-.03,.046,.03,.085,.105,'#e63946');}},
  fire:{sp:2.8,beacon:true,build:()=>{bc(0,0,.05,.15,.02,.115,'#d62828');bc(0,.12,.046,.03,.065,.11,'#2e3a46');bx(-.051,-.15,.051,.15,.05,.06,'#f4f6f8');bc(0,-.03,.012,.12,.115,.125,'#c0c4c8');for(let k=0;k<5;k++)bc(0,-.13+k*.05,.03,.004,.125,.13,'#c0c4c8');}},
  sbus:{sp:1.4,beacon:false,build:()=>{bc(0,0,.05,.17,.02,.13,'#f2b705');bx(-.051,-.15,.051,.15,.075,.11,'#2e3a46');bx(-.052,-.17,.052,.17,.045,.052,'#222222');bc(0,.165,.045,.006,.03,.06,'#222222');}},
  // v10 (13 nov. 2026) : tournées et services de la ville
  garb:{sp:1.3,max:4,build:()=>{bc(0,-.03,.05,.11,.02,.13,'#3f9b4f');bx(-.051,-.14,.051,-.12,.03,.125,'#2c6e37');bc(0,.11,.048,.04,.02,.12,'#f4f6f8');bc(0,.135,.045,.012,.065,.11,'#2e3a46');for(const sx of[-1,1])for(const sz of[-.08,.08])bc(sx*.047,sz,.007,.02,0,.04,'#1d2024');}},
  deliv:{sp:1.6,max:5,build:()=>{bc(0,-.03,.05,.11,.025,.15,'#f2f2f2');bx(-.051,-.12,.051,.06,.08,.1,'#e4572e');bc(0,.11,.046,.04,.02,.11,'#2f6fd6');bc(0,.135,.043,.012,.06,.1,'#2e3a46');for(const sx of[-1,1])for(const sz of[-.08,.08])bc(sx*.047,sz,.007,.02,0,.04,'#1d2024');}},
  police:{sp:1.8,max:3,beacon:true,build:()=>{bc(0,0,.05,.097,.02,.068,'#f4f6f8');bx(-.051,-.097,.051,.097,.035,.05,'#2f5fa8');bc(0,-.014,.044,.05,.068,.106,'#2e3b47');bc(0,-.016,.041,.042,.106,.114,'#f4f6f8');for(const sx of[-1,1])for(const sz of[-.08,.08])bc(sx*.047,sz,.007,.02,0,.04,'#1d2024');}},
  post:{sp:1.4,max:2,build:()=>{bc(0,-.01,.048,.1,.02,.12,'#f6c90e');bc(0,.1,.044,.012,.06,.105,'#2e3a46');bx(-.049,-.04,.049,.02,.07,.09,'#2f5fa8');for(const sx of[-1,1])for(const sz of[-.08,.08])bc(sx*.047,sz,.007,.02,0,.04,'#1d2024');}},
  move:{sp:1.2,max:2,build:()=>{bc(0,-.04,.055,.13,.025,.17,'#f0e6d2');bx(-.056,-.12,.056,.05,.1,.13,'#c8553d');bc(0,.12,.05,.04,.02,.12,'#e9e9e9');bc(0,.145,.046,.012,.065,.11,'#2e3a46');for(const sx of[-1,1])for(const sz of[-.1,.1])bc(sx*.052,sz,.007,.022,0,.044,'#1d2024');}},
  tow:{sp:2.2,max:2,beacon:true,amber:true,build:()=>{bc(0,.06,.048,.05,.02,.12,'#f39c12');bc(0,.09,.045,.012,.065,.11,'#2e3a46');bc(0,-.06,.048,.07,.02,.06,'#5b6770');bx(-.006,-.13,.006,-.02,.06,.16,'#f39c12');bc(0,-.13,.004,.004,.08,.16,'#3b3f44');for(const sx of[-1,1])for(const sz of[-.08,.08])bc(sx*.047,sz,.007,.02,0,.04,'#1d2024');}},
  plow:{sp:1.5,max:3,beacon:true,amber:true,build:()=>{bc(0,0,.05,.11,.02,.12,'#f39c12');bc(0,.08,.046,.012,.065,.11,'#2e3a46');bx(-.08,.12,.08,.145,0,.06,'#d9d9d9');bc(0,-.08,.04,.03,.12,.16,'#7d8a96');for(const sx of[-1,1])for(const sz of[-.08,.08])bc(sx*.047,sz,.007,.02,0,.04,'#1d2024');}}
};
function makeEV(){
  const mat=new THREE.MeshLambertMaterial({vertexColors:true}),M={};
  for(const k in EVK){GB=new Map();TX.x=0;TX.z=0;TX.k=0;EVK[k].build();const g=toGeo(GB.get('plain'));GB=null;const m=new THREE.InstancedMesh(g,mat,12);m.count=0;m.frustumCulled=false;m.castShadow=true;E.gC.add(m);M[k]=m;}
  GB=new Map();TX.x=0;TX.z=0;TX.k=0;bc(0,0,.03,.012,0,.02,'#ffffff');const bg=toGeo(GB.get('plain'));GB=null;
  const bm=new THREE.InstancedMesh(bg,new THREE.MeshBasicMaterial({vertexColors:true}),16);bm.count=0;bm.frustumCulled=false;for(let k=0;k<16;k++)bm.setColorAt(k,new THREE.Color('#ff3030'));E.gC.add(bm);
  const n=160,geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3);geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  const spray=new THREE.Points(geo,new THREE.PointsMaterial({color:'#bfe6ff',map:dotTex(),size:.06,transparent:true,opacity:.8,depthWrite:false}));spray.frustumCulled=false;spray.visible=false;E.gC.add(spray);
  E.v6.evm={M,bm,spray,pos,n};
}
function nearestSvc(types,x,z){let best=null,bd=1e9;for(const s of SV.values()){if(!types.includes(s.t)||svcDamaged(s.id))continue;const d=Math.hypot(s.x+s.w/2-x,s.z+s.d/2-z);if(d<bd){bd=d;best=s;}}return best;}
function evSend(k,from,to,opt){
  const V=E.v6;if(!V||V.ev.length>=40||from<0||to<0||from===to)return false;
  if(V.ev.filter(v=>v.k===k).length>=(EVK[k].max||(k==='sbus'?6:3)))return false;
  const path=roadPathBFS(from,to,true)||(EVK[k].beacon?roadPathBFS(from,to):null);if(!path||path.length<3)return false;   /* seuls pompiers et ambulances traversent une rue piétonne s'il n'y a pas d'autre chemin */
  V.ev.push(Object.assign({k,path,pi:0,t:.5,st:'go',w:0,stay:6,back:true,sp:EVK[k].sp},opt||{}));return true;
}
function v6FireTruck(i){   // appelé par ignite()
  if(!E||!E.v6||VISIT||!COV.fire[i])return;
  const x=i%N,z=(i/N)|0,s=nearestSvc(['fire'],x,z);if(!s)return;const F=svcFront(s),to=roadNear(i);if(!F||to<0)return;
  if(E.v6.ev.some(v=>v.k==='fire'&&v.target===i))return;
  evSend('fire',F.ri,to,{target:i,stay:14});
}
function v6AmbTick(){
  const V=E.v6;if(VISIT||ST.pop<120||E.t<(V.evT||0))return;V.evT=E.t+30+Math.random()*45;
  const L=residentialLots();if(!L.length)return;const h=rpick(L),s=nearestSvc(['hospital','chu','garde','sante','kine','reeduc'],h%N,(h/N)|0);if(!s)return;
  const F=svcFront(s),to=roadNear(h);if(F&&to>=0)evSend('amb',F.ri,to,{stay:4,target:h});
}
function v6SchoolBuses(){
  const V=E.v6,h=hourNow(),day=(E.vday|0);
  for(const s of SV.values()){if(s.t!=='school'||svcDamaged(s.id))continue;const F=svcFront(s);if(!F)continue;
    const key=s.id+(h<12?'m':'s');if(V.sb[key]===day)continue;
    if(!((h>=7.1&&h<8.3)||(h>=16.3&&h<17.3)))continue;V.sb[key]=day;
    const L=residentialLots();if(!L.length)continue;
    for(let k=0;k<2;k++){const r=roadNear(rpick(L));if(r<0)continue;if(h<12)evSend('sbus',r,F.ri,{stay:5,back:false});else evSend('sbus',F.ri,r,{stay:3,back:false});}}
}
function stepEV(dt,run){
  const V=E.v6,EM=V.evm,cnt={};for(const q in EVK)cnt[q]=0;let nb=0,ns=0;
  for(let k=V.ev.length-1;k>=0;k--){const v=V.ev[k];
    if(v.st==='stay'){v.w-=run;const burning=v.k==='fire'&&v.target!=null&&st[v.target]===FIRE;
      if(v.k==='fire'&&burning&&v.w<v.stay-2.5){st[v.target]=OK;tmr[v.target]=0;touch(v.target);D.icons=true;toastOnce('fireout','local_fire_department','Les pompiers ont éteint l’incendie.',30);}
      if(v.w<=0){if(v.k==='tow'&&RL.acc&&v.target===RL.acc.i)accClear();
        if(v.chain&&v.chain.length){const nx=v.chain.shift(),p=roadPathBFS(v.path[v.path.length-1],nx,true);if(p&&p.length>=2){v.path=p;v.pi=0;v.t=.5;v.st='go';}else{V.ev.splice(k,1);continue;}}   /* tournée : arrêt suivant */
        else if(v.home!=null){const p=roadPathBFS(v.path[v.path.length-1],v.home,true)||(EVK[v.k]&&EVK[v.k].beacon?roadPathBFS(v.path[v.path.length-1],v.home):null);v.home=null;if(p&&p.length>=2){v.path=p;v.pi=0;v.t=.5;v.st='ret';}else{V.ev.splice(k,1);continue;}}   /* retour au dépôt */
        else if(v.back){v.path.reverse();v.pi=0;v.t=.5;v.st='ret';}else{V.ev.splice(k,1);continue;}}}
    else{v.t+=run*v.sp;while(v.t>=1&&v.pi<v.path.length-1){v.t-=1;v.pi++;}
      if(v.path.some((j,q)=>q>=v.pi&&q<=v.pi+1&&!road[j])){V.ev.splice(k,1);continue;}   // route démolie en chemin
      if(v.pi>=v.path.length-1&&v.t>=.5){if(v.st==='go'){v.st='stay';v.w=v.stay;v.t=.5;}else{V.ev.splice(k,1);continue;}}}
    const P_=v.path,pi_=Math.min(v.pi,P_.length-1),a=P_[pi_];evPos(P_,pi_,v.st==='stay'?.5:Math.min(1,v.t),_evo);   /* v14 : même courbe que les voitures, plus de virage d'un coup */
    evSmooth(v,_evo,run);const x=v.rx,z=v.rz,ang=v.ra,y=ter[a]?.13:mtn[a]?mtnH(x,z)+.012:0;
    if(v.k==='plow')roadSnowClear(a);
    if(cnt[v.k]>=12)continue;_e6.set(0,ang,0);_q6.setFromEuler(_e6);_p6.set(x,y,z);_s6.setScalar(1);_m6.compose(_p6,_q6,_s6);EM.M[v.k].setMatrixAt(cnt[v.k]++,_m6);
    if((v.beacon!=null?v.beacon:EVK[v.k].beacon)&&v.st!=='ret'&&nb<16){const on=((E.t*6+k)|0)%2;_p6.set(x,y+(v.k==='fire'?.13:v.k==='move'?.18:.12),z);_m6.compose(_p6,_q6,_s6);EM.bm.setMatrixAt(nb,_m6);EM.bm.setColorAt(nb,EVK[v.k].amber?(on?_amb6:_amb6b):on?_red6:_blue6);nb++;}
    if(v.k==='fire'&&v.st==='stay'&&v.target!=null&&st[v.target]===FIRE){const tx=v.target%N+.5,tz=((v.target/N)|0)+.5,th=Math.max(.3,(TOP[v.target]||.6)*.8);
      for(let q=0;q<40&&ns<EM.n;q++){const u=((E.t*1.6+q/40)%1),sp=(q%5-2)*.03;EM.pos[ns*3]=lerp(x,tx,u)+sp;EM.pos[ns*3+1]=y+.13+(th-.13)*u+Math.sin(u*Math.PI)*.35;EM.pos[ns*3+2]=lerp(z,tz,u)+sp;ns++;}}}
  for(const k in EM.M){EM.M[k].count=cnt[k];EM.M[k].instanceMatrix.needsUpdate=true;}
  EM.bm.count=nb;EM.bm.instanceMatrix.needsUpdate=true;if(EM.bm.instanceColor)EM.bm.instanceColor.needsUpdate=true;
  EM.spray.visible=ns>0;EM.spray.geometry.setDrawRange(0,ns);if(ns)EM.spray.geometry.attributes.position.needsUpdate=true;
}
const _evo=[0,0,0];
// lissage : un demi-tour ou un nouveau trajet ne fait plus sauter le véhicule d'un côté à l'autre
function evSmooth(v,o,run){if(v.rx==null||run<=0&&v.rx==null){v.rx=o[0];v.rz=o[1];v.ra=o[2];return;}const jd=Math.hypot(o[0]-v.rx,o[1]-v.rz);
  if(jd>1.5){v.rx=o[0];v.rz=o[1];v.ra=o[2];return;}if(jd>run*v.sp*1.6+.004){const k=Math.min(1,run*4);v.rx+=(o[0]-v.rx)*k;v.rz+=(o[1]-v.rz)*k;}else{v.rx=o[0];v.rz=o[1];}v.ra=angLerp(v.ra,o[2],Math.min(1,run*7));}
function evPos(P_,pi,t,o){const n=P_.length,i=P_[pi],x=i%N+.5,z=((i/N)|0)+.5,dd=(a,b)=>[(b%N)-(a%N),((b/N)|0)-((a/N)|0)];
  let di=pi>0?dd(P_[pi-1],i):null,dout=pi<n-1?dd(i,P_[pi+1]):null;if(!di)di=dout||[0,1];if(!dout)dout=di;if(di[0]===-dout[0]&&di[1]===-dout[1])dout=di;
  const p0x=x-di[0]*.5,p0z=z-di[1]*.5,p2x=x+dout[0]*.5,p2z=z+dout[1]*.5,u=1-t,px=u*u*p0x+2*u*t*x+t*t*p2x,pz=u*u*p0z+2*u*t*z+t*t*p2z;
  let tx=2*u*(x-p0x)+2*t*(p2x-x),tz=2*u*(z-p0z)+2*t*(p2z-z);const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;o[0]=px-tz*.17;o[1]=pz+tx*.17;o[2]=Math.atan2(tx,tz);}
const _red6=new THREE.Color('#ff2a2a'),_blue6=new THREE.Color('#2a6bff'),_amb6=new THREE.Color('#ffb020'),_amb6b=new THREE.Color('#ff7a00');

// =========================================================
// v10 (13 nov. 2026) : réalisme — tournées (poubelles, livraisons, police, poste, chasse-neige, déménagements),
// parkings qui vivent, trains en gare, pylônes, piétons aux feux, accidents, neige et pluie sur les routes
// =========================================================
const RL={garbT:0,delivT:0,polT:0,postT:0,plowT:0,accT:0,acc:null,pylK:'',parkT:0,parkK:-1,trains:new Map(),rsAcc:0,rsAny:false,rsDirty:false,rsT:0};
function lotsWhere(fn){const L=[];for(let i=0;i<NN;i++)if(lvl[i]&&zone[i]&&st[i]===OK&&fn(i))L.push(i);return L;}
function pickN(L,n){const a=L.slice(),o=[];while(a.length&&o.length<n)o.push(a.splice((Math.random()*a.length)|0,1)[0]);return o;}
function evTour(k,from,stops,opt){const R_=stops.map(roadNear).filter(r=>r>=0&&r!==from);if(!R_.length)return false;return evSend(k,from,R_[0],Object.assign({chain:R_.slice(1),home:from,back:false},opt||{}));}
function svcOf(types){return [...SV.values()].filter(s=>types.includes(s.t)&&svcOK.get(s.id)&&!svcDamaged(s.id));}
function edgeRoad(){const L=[];for(const i of E.roadList||[]){const x=i%N,z=(i/N)|0;if((x===0||z===0||x===N-1||z===N-1)&&conn[i])L.push(i);}return L.length?rpick(L):-1;}
function rlMoveIn(i){if(!E||!E.v6||VISIT||Math.random()>.35)return;const e=edgeRoad(),to=roadNear(i);if(e>=0&&to>=0)evSend('move',e,to,{stay:8});}   // nouveaux habitants
function rlTick(){
  if(!E||!E.v6||VISIT)return;const t=E.t,h=hourNow(),shift=[6,14,22].some(x=>Math.abs(h-x)<.6);
  E.busStops=new Set(svcOf(['bus','tramstop','gare']).map(s=>{const F=svcFront(s);return F?F.ri:-1;}).filter(r=>r>=0));
  if(garbageOn()&&t>RL.garbT){RL.garbT=t+10+Math.random()*12;if(h>=5&&h<20){const D_=svcOf(['landfill','incin','recycle']);if(D_.length){const s=rpick(D_),F=svcFront(s),L=lotsWhere(i=>gb[i]&&(zone[i]===ZR||zone[i]===ZC));if(F&&L.length)evTour('garb',F.ri,pickN(L,4),{stay:1.4});}}}
  if(t>RL.delivT){RL.delivT=t+(shift?3:7)+Math.random()*6;if(h>=5&&h<23){const I=lotsWhere(i=>zone[i]===ZI),C=lotsWhere(i=>zone[i]===ZC),hubs=svcOf(['port','gare','aeroport']);
    if(I.length&&C.length&&(Math.random()<.7||!hubs.length)){const a=roadNear(rpick(I));if(a>=0)evTour('deliv',a,pickN(C,2),{stay:1.8});}
    else if(hubs.length&&I.length){const F=svcFront(rpick(hubs));if(F)evTour('deliv',F.ri,pickN(I,1),{stay:2});}}}
  if(t>RL.polT){RL.polT=t+14+Math.random()*12;const P_=svcOf(['police']);if(P_.length){const s=rpick(P_),F=svcFront(s),cx=s.x+s.w/2,cz=s.z+s.d/2,L=lotsWhere(i=>Math.hypot(i%N-cx,((i/N)|0)-cz)<9);if(F&&L.length)evTour('police',F.ri,pickN(L,3),{stay:.6,beacon:false});}}
  if(t>RL.postT){RL.postT=t+18+Math.random()*14;if((h>=8&&h<12)||(h>=14&&h<17)){const P_=svcOf(['poste']);if(P_.length){const F=svcFront(rpick(P_)),L=lotsWhere(i=>zone[i]===ZR);if(F&&L.length)evTour('post',F.ri,pickN(L,5),{stay:1});}}}
  if(SNOW.value>.35&&S.set.sn&&t>RL.plowT){RL.plowT=t+5+Math.random()*5;const P_=svcOf(['mairie','fire','landfill']),F=P_.length?svcFront(rpick(P_)):null,from=F?F.ri:edgeRoad();
    if(from>=0&&(E.roadList||[]).length)evTour('plow',from,pickN(E.roadList,6),{stay:.1});}
  if(!RL.accT)RL.accT=t+90+Math.random()*120;   /* pas d'accident dès l'ouverture */
  if(S.set.acc!==false&&!RL.acc&&t>RL.accT&&ST.pop>400){RL.accT=t+80+Math.random()*140;const L=(E.roadList||[]).filter(i=>trf[i]>55&&!ter[i]&&!mtn[i]);if(L.length&&Math.random()<.6)accStart(rpick(L));}
  if(RL.acc&&E.t-RL.acc.t0>70)accClear();
  const pk=svcOf(Object.keys(BT).filter(k=>BT[k].power)).map(s=>s.id+':'+s.x+','+s.z).join('|')+'#'+(ST.lots[1]+ST.lots[2]+ST.lots[3]+ST.lots[4]>0?1:0);
  if(pk!==RL.pylK){RL.pylK=pk;rebuildPylons();}
}
function rlFrame(dt,run){
  if(!E)return;
  if(E.parkDirty){E.parkDirty=false;collectParked();}
  if(E.t-RL.parkT>1){RL.parkT=E.t;updateParked();}
  stepTrains(run);roadWeather(dt);   /* v13 : plus de piétons qui font des allers-retours sur les passages : les promeneurs traversent au feu */
  if(E.accG&&E.accG.visible){E.accG.userData.hz.visible=((E.t*3)|0)%2===0;
    if(Math.random()<dt*2&&E.smoke.p.length<E.smoke.M)E.smoke.p.push({x:E.accG.position.x+(Math.random()-.5)*.1,y:.08,z:E.accG.position.z,vx:.05,vz:.02,vy:.18,a:0,l:2.2,s0:.08,s1:.35,k:0});}
}
// ── Accident : deux voitures accrochées, triangle, feux de détresse ; la dépanneuse dégage la route ──
function accStart(i){
  RL.acc={i,t0:E.t};E.accI=i;const x=i%N+.5,z=((i/N)|0)+.5;
  if(!E.accG){const g=new THREE.Group(),geo=E.cars.mesh.geometry;
    for(const [c,dx,dz,a] of [['#c0392b',-.06,-.03,.5],['#2f6fd6',.07,.05,2.3]]){const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,color:c}));m.position.set(dx,0,dz);m.rotation.y=a;m.castShadow=true;g.add(m);}
    const tri=new THREE.Mesh(new THREE.ConeGeometry(.025,.05,3),new THREE.MeshBasicMaterial({color:'#ff7a00'}));tri.position.set(-.27,.025,-.22);g.add(tri);
    const hz=new THREE.Mesh(new THREE.BoxGeometry(.03,.014,.03),new THREE.MeshBasicMaterial({color:'#ffb020'}));hz.position.set(-.06,.13,-.03);g.add(hz);g.userData.hz=hz;E.accG=g;E.gC.add(g);}
  E.accG.position.set(x,0,z);E.accG.visible=true;
  const fs=nearestSvc(['fire'],x,z),hs=nearestSvc(['hospital','chu','sante','garde'],x,z),Ff=fs&&svcFront(fs),fr=Ff?Ff.ri:edgeRoad();
  if(!(fr>=0&&evSend('tow',fr,i,{stay:6,target:i}))){const e=edgeRoad();if(e>=0)evSend('tow',e,i,{stay:6,target:i});}   /* sinon depuis l'entrée de la ville */
  if(hs){const F=svcFront(hs);if(F)evSend('amb',F.ri,i,{stay:4,target:i});}
  toastOnce('acc','car_crash','Accident de la route : la dépanneuse et une ambulance arrivent. Ça bouchonne un peu…',30);
}
function accClear(){RL.acc=null;if(E){E.accI=null;if(E.accG)E.accG.visible=false;}}
// ── Parkings qui vivent : voitures garées devant les maisons la nuit, aux bureaux et aux magasins le jour ──
function spot(lx,lz,along,kind){if(!CUR||!CUR.park)return;const p=P(lx,lz);CUR.park.push(p[0],p[1],(along?1:0)^(TX.k&1),kind);}
function collectParked(){const L=[];E.bc.forEach(ch=>{if(ch.park)for(let k=0;k<ch.park.length;k+=4)L.push(ch.park.slice(k,k+4));});E.parkL=L;
  if(!E.parkM||E.parkM.userData.cap<L.length){if(E.parkM){E.gC.remove(E.parkM);E.parkM.dispose();}const cap=Math.max(64,Math.ceil(L.length*1.3));
    E.parkM=new THREE.InstancedMesh(E.cars.mesh.geometry,new THREE.MeshLambertMaterial({vertexColors:true}),cap);E.parkM.userData.cap=cap;E.parkM.frustumCulled=false;E.parkM.castShadow=true;E.parkM.setColorAt(0,new THREE.Color('#ffffff'));E.gC.add(E.parkM);}
  updateParked(true);}
function parkOcc(kind,h,we){
  const sm=(a,b)=>clamp((h-a)/1.2,0,1)*clamp((b-h)/1.2,0,1);
  if(kind===0)return .9-.55*sm(8,18)*(we?.4:1);
  if(kind===1)return we?.08:.06+.88*sm(8,18.5);
  return .08+.72*sm(9,20.5);
}
/* v15 : updateParked est dans le bloc v15 (voitures qui se garent et repartent) */
// ── Trains en gare : arrivée en ralentissant, arrêt à quai, départ (cycle de 42 s, s'arrête en pause) ──
const _trC=new THREE.Color();
function stepTrains(run){
  const G_=svcOf(['gare']);
  if(!E.trainM){GB=new Map();TX.x=0;TX.z=0;TX.k=0;bx(-.39,-.09,.39,.09,.03,.2,'#ffffff');bx(-.39,-.095,.39,.095,.13,.18,'#2e3b47');bx(-.38,-.08,.38,.08,.2,.225,'#c9cfd4');for(const x of[-.28,.28])bc(x,0,.05,.07,0,.04,'#2b2b2b');
    const g=toGeo(GB.get('plain'));GB=null;E.trainM=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({vertexColors:true}),24);E.trainM.count=0;E.trainM.frustumCulled=false;E.trainM.castShadow=true;E.trainM.setColorAt(0,_trC.set('#ffffff'));E.gC.add(E.trainM);}
  const M=E.trainM,m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),sc=new THREE.Vector3(1,1,1);let n=0;
  for(const s of G_){let T=RL.trains.get(s.id);if(T==null)T=Math.random()*42;T=(T+run)%42;RL.trains.set(s.id,T);
    let hx;if(T<7){const u=T/7;hx=-3.4+4.2*(1-(1-u)*(1-u));}else if(T<19)hx=.8;else if(T<26){const u=(T-19)/7;hx=.8+4.4*u*u;}else continue;
    TX.x=s.x+s.w/2;TX.z=s.z+s.d/2;TX.k=s.rot|0;e.set(0,(s.rot|0)*Math.PI/2,0);q.setFromEuler(e);
    for(let c=0;c<3&&n<24;c++){const lx=hx-c*.84;if(Math.abs(lx)>1.08)continue;const P_=P(lx,-.9);p.set(P_[0],0,P_[1]);m.compose(p,q,sc);M.setMatrixAt(n,m);M.setColorAt(n,_trC.set(c===0?'#0e8c87':'#f4f6f8'));n++;}}
  M.count=n;M.instanceMatrix.needsUpdate=true;if(M.instanceColor)M.instanceColor.needsUpdate=true;
}
// ── Pylônes et lignes électriques : de chaque centrale vers le quartier alimenté le plus proche ──
function rebuildPylons(){
  if(E.pyl){E.gD.remove(E.pyl);E.pyl.traverse(o=>{if(o.geometry)o.geometry.dispose();});E.pyl=null;}
  return;   /* v15 : plus de pylônes ni de câbles électriques (jugés laids) */
  const plants=svcOf(Object.keys(BT).filter(k=>BT[k].power));if(!plants.length)return;
  const lots=[];for(let i=0;i<NN;i++)if(lvl[i]&&zone[i]&&pw[i])lots.push(i);if(!lots.length)return;
  const keep=[GB,TX.x,TX.z,TX.k];GB=new Map();TX.k=0;const wires=[],free=i=>!road[i]&&!svcAt[i]&&!lvl[i]&&!ter[i]&&!mtn[i]&&!zone[i]&&!deco[i]&&!hill[i];
  for(const s of plants){const cx=s.x+s.w/2,cz=s.z+s.d/2;let best=null,bd=1e9;for(const i of lots){const d=Math.hypot(i%N+.5-cx,((i/N)|0)+.5-cz);if(d<bd){bd=d;best=i;}}
    if(best==null||bd<s.w*.8+1.5)continue;const tx=best%N+.5,tz=((best/N)|0)+.5,n=Math.floor(bd/2.4);let prev=[cx,cz,.35];
    for(let k=1;k<n;k++){const u=k/n,px=lerp(cx,tx,u),pz=lerp(cz,tz,u),i=Math.floor(pz)*N+Math.floor(px);if(i<0||i>=NN||!free(i))continue;
      TX.x=Math.floor(px)+.5;TX.z=Math.floor(pz)+.5;const H=.62;
      cyl(0,0,0,H,.05,.012,4,'#8d949b');for(const y of[H*.72,H*.9])bx(-.16,-.012,.16,.012,y,y+.018,'#8d949b');bx(-.012,-.012,.012,.012,H,H+.05,'#8d949b');
      for(const sx of[-.15,.15])bc(sx,0,.006,.006,H*.72-.04,H*.72,'#d9dde0');
      const here=[TX.x,TX.z,H*.72-.04];wires.push([prev,here]);prev=here;}
    wires.push([prev,[tx,tz,.3]]);}
  const g=new THREE.Group(),geo=GB.get('plain');[GB,TX.x,TX.z,TX.k]=keep;
  if(geo&&geo.p.length){const m=new THREE.Mesh(toGeo(geo),E.mat.plain);m.castShadow=true;g.add(m);}
  const pts=[];for(const [a,b] of wires){const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;for(const off of[-.15,.15]){const ox=-dz/l*off,oz=dx/l*off,sag=u=>Math.sin(u*Math.PI)*.08;
      for(let k=0;k<10;k++){const u0=k/10,u1=(k+1)/10;pts.push(lerp(a[0],b[0],u0)+ox,lerp(a[2],b[2],u0)-sag(u0),lerp(a[1],b[1],u0)+oz,lerp(a[0],b[0],u1)+ox,lerp(a[2],b[2],u1)-sag(u1),lerp(a[1],b[1],u1)+oz);}}}
  if(pts.length){const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:'#3a3f44'})));}
  E.pyl=g;E.gD.add(g);
}
// ── Piétons aux feux : ils attendent au bord du trottoir et traversent quand les voitures ont le rouge ──
const XING=[[0,-.45,'x',0,1],[0,.45,'x',0,4],[-.45,0,'z',1,8],[.45,0,'z',1,2]];
function stepXing(run){   /* v12 : piétons variés et animés (avant : un seul modèle orange) */
  const L=E.sigList||[],n=L.length*4;
  if(!E.xingP||E.xingP.length<n*2){const o=E.xingP;E.xingP=new Float32Array(Math.ceil(n*1.3)*2+32);if(o)E.xingP.set(o.subarray(0,Math.min(o.length,E.xingP.length)));}
  const P2=E.xingP;let k=0;
  for(const i of L){const x=i%N+.5,z=((i/N)|0)+.5,msk=roadMask(i%N,(i/N)|0);
    for(let w=0;w<4;w++,k++){const X_=XING[w];if(!(msk&X_[4]))continue;
      const red=sigState(i,X_[3])===2;let u=P2[k*2],dir=P2[k*2+1]||1;
      if((u>0&&u<1)||red){u=Math.min(1,u+run/2.4);}
      if(u>=1&&!red){u=0;dir=-dir;}
      P2[k*2]=u;P2[k*2+1]=dir;const v=dir>0?u:1-u,t_=lerp(-.36,.36,v),walking=u>0&&u<1;
      const px=X_[2]==='x'?x+t_:x+X_[0],pz=X_[2]==='x'?z+X_[1]:z+t_,ang=X_[2]==='x'?(dir>0?Math.PI/2:-Math.PI/2):(dir>0?0:Math.PI);
      humPut(humLookC(i*7+w+50000),px,0,pz,ang+(walking?0:Math.PI/2),.8,u*.72*HUM_STEP,walking?.55:0);}}
}
// ── Neige sur les routes (dégagée par les chasse-neige) et routes mouillées quand il pleut ──
function roadSnowClear(i){if(RS_D[i*4]>70){RS_D[i*4]=70;RL.rsDirty=true;}}   /* 14 nov. 2026 : il reste une fine couche (avant : tache noire derrière le chasse-neige) */
function roadWeather(dt){
  const snowing=SNOW.value>.35&&!!S.set.sn;let ch=false;
  if(snowing||RL.rsAny){RL.rsAcc+=snowing?dt*255*.025:-dt*255*.2;
    if(Math.abs(RL.rsAcc)>=4){const d=Math.trunc(RL.rsAcc);RL.rsAcc-=d;let any=false;
      for(let i=0;i<NN;i++){const o=RS_D[i*4];if(!road[i]){if(o){RS_D[i*4]=0;ch=true;}continue;}const v=clamp(o+d,0,255);if(v!==o){RS_D[i*4]=v;ch=true;}if(v)any=true;}RL.rsAny=any;}}
  if((ch||RL.rsDirty)&&E.t-RL.rsT>.4){RL.rsT=E.t;RL.rsDirty=false;RSU.value.needsUpdate=true;}
  const wetT=(S.wx&&(S.wx.k==='rain'||S.wx.k==='storm'))?1:0;WETU.value+=(wetT-WETU.value)*Math.min(1,dt*(wetT?.6:.08));
}
// ── Usines, vent, lumières selon l'heure, coupures de courant ──
function smokeOn(e){const i=Math.floor(e[2])*N+Math.floor(e[0]);if(i>=0&&i<NN&&lvl[i]&&zone[i]===ZI&&(!pw[i]||st[i]!==OK))return false;const h=hourNow();return (h>=6&&h<22)||Math.random()<.25;}
function windK(){const k=S&&S.wx&&S.wx.k;return k==='storm'?2.3:k==='rain'?1.35:k==='fog'?.35:.75+.35*Math.sin((E?E.t:0)*.07)+.15*Math.sin((E?E.t:0)*.31);}
function weekend(){return E?((E.vday|0)%7)>=5:false;}   /* v15 : samedi / dimanche selon les jours vus à l'écran */
function shopOpen(){const h=hourNow();return h>=7&&h<21.5;}
function litRhythm(m){const h=hourNow(),M_=E.mat;
  if(m===M_.res||m===M_.glass)return h>=1&&h<5.5?.42:(h>=23||h<1)?.75:1;   /* v12 : plus de fenêtres allumées la nuit */   // tard dans la nuit, la plupart des fenêtres s'éteignent
  if(m===M_.shop)return shopOpen()?1:.2;                                  // vitrines éteintes à la fermeture
  if(m===M_.off)return h>=7.5&&h<19.5?1:.82;   /* v15 : bureaux éclairés toute la nuit, sans clignoter (avant : le « week-end » changeait toutes les 5 s) */
  return 1;}
function waterOK(){return ST.wp>0&&ST.wp>=ST.wu;}
function lampOn(i){const x=i%N;let lots=0;for(const j of[i-1,i+1,i-N,i+N,i-N-1,i-N+1,i+N-1,i+N+1]){if(j<0||j>=NN||Math.abs((j%N)-x)>1)continue;if(lvl[j]&&zone[j]&&st[j]!==RUIN){lots++;if(pw[j])return true;}}return lots===0&&ST.pp>0;}
function utilChanged(pw0,wt0){
  let ch=false;for(let i=0;i<NN;i++)if(pw0[i]!==pw[i]){ch=true;const x=i%N,z=(i/N)|0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const X_=x+dx,Z_=z+dz;if(X_>=0&&Z_>=0&&X_<N&&Z_<N)markB(Z_*N+X_);}}
  if(ch)D.lights=true;const w=waterOK();if(E.wOK!==undefined&&E.wOK!==w)for(let ci=0;ci<NCH*NCH;ci++)E.bDirty.add(ci);E.wOK=w;
}
// ── Chantier en étapes : terrassement (dalle, fers, pelleteuse), structure (poteaux, planchers), puis échafaudages ──
function siteStage(t,T){const p=1-t/T;return p<.34?0:p<.67?1:2;}
function worker(lx,lz){bc(lx,lz,.012,.009,0,.05,'#34495e');bc(lx,lz,.014,.01,.05,.085,'#ff7a00');ico(lx,.098,lz,.013,'#f2c94c');}
// ── Bureau de poste ──
Object.assign(SVB,{poste(r){
  bc(0,-.06,.36,.3,0,FH*1.6,'#f3efe6',FRs(),'#d9d3c8');bx(-.37,-.37,.37,.25,FH*1.6,FH*1.6+.03,'#f8f5ee');parapet(0,-.06,.74,.62,FH*1.6+.03,'#e6e0d4');
  bx(-.37,.24,.37,.255,FH*1.05,FH*1.25,'#f6c90e');signB(0,.255,.4,FH*1.07,'#2f5fa8',.05);canopy(0,.24,.22,FH*.8,'#2f5fa8');
  bc(.3,.36,.03,.025,0,.1,'#f6c90e');bc(.3,.36,.032,.027,.1,.11,'#2f5fa8');
  bc(-.25,.37,.048,.1,.02,.12,'#f6c90e');bc(-.25,.46,.044,.012,.06,.105,'#2e3a46');roofKit(r,0,-.06,.6,.5,FH*1.6+.03);
  return FH*1.6+.2;}});

// ── Quiz pour sauver la ville : pendant un incendie, une inondation ou après une tornade ──
// 3 bonnes réponses (tes propres questions, comptées comme révision) → les secours arrivent tout de suite
const SOS_N={fire:['Incendie','local_fire_department','envoyer les pompiers tout de suite'],flood:['Inondation','flood','faire baisser l’eau tout de suite'],torn:['Tornade','cyclone','réparer la ville tout de suite']};
let SOSQ=null,SOSWON=null;   // question en cours {q, order, ans, t0} · dernière victoire (message)
function sosStart(k,i){
  if(VISIT||!S||S.sos)return;
  if(k==='fire'&&Date.now()-(S.sosT||0)<4*60e3)return;   // pas plus d'un appel « incendie » toutes les 4 minutes
  S.sos={k,i:i==null?-1:i,n:0,d:S.day};S.sosT=Date.now();SOSQ=null;
  const D_=SOS_N[k];toast(`<b>${D_[0]} !</b> Réponds juste à 3 questions pour ${D_[2]}.`,D_[1],{label:'Aider',fn:()=>openPanel('sos')});
}
function sosActive(){
  const s=S.sos;if(!s)return false;
  if(s.k==='fire'){let any=false;for(let i=0;i<NN;i++)if(st[i]===FIRE){any=true;break;}return any;}
  if(s.k==='flood')return !!(S.flood&&S.flood.u>S.day);
  if(s.k==='torn'){if(TORN)return true;for(const id in S.dmg)if(S.dmg[id]>S.day)return true;for(let i=0;i<NN;i++)if(st[i]===RUIN)return true;return false;}
  return false;
}
function sosPool(){
  const base=quizBase();if(base.length)return base.map(q=>({q,own:true}));
  return patCases().map((c,k)=>({q:{id:'pc'+k,question:c.q,answers:c.a,correct:0,expl:c.ex,ctx:c.p},own:false}));
}
function sosNext(){
  const P=sosPool();if(!P.length){SOSQ={empty:true};return;}
  const W={hard:3,medium:2,new:1.6,easy:1,acquired:.6};let tot=0;const ws=P.map(o=>{const w=o.own&&typeof getDiff==='function'?W[getDiff(o.q.id)]||1:1;tot+=w;return w;});
  let r=Math.random()*tot,k=0;while(k<P.length-1&&r>=ws[k]){r-=ws[k];k++;}
  const o=P[k],order=o.q.answers.map((_,j)=>j).filter(j=>String(o.q.answers[j]||'').trim()).sort(()=>Math.random()-.5);
  SOSQ={q:o.q,own:o.own,order,ans:null,t0:performance.now()};
}
function panelSos(){
  const s=S.sos;
  if(!s&&SOSWON){const w=SOSWON;return head('verified','Ville sauvée !',({fire:'Incendie maîtrisé',flood:'Inondation terminée',torn:'Tornade : tout est réparé'})[w.k],'#2a9d8f')+`<div class="cty-qfb ok"><b>Bravo !</b> Grâce à tes 3 bonnes réponses, les secours sont arrivés tout de suite${w.saved?` et ${w.saved} bâtiment${w.saved>1?'s ont été sauvés':' a été sauvé'}`:''}. +${money(w.r)}.</div><button class="cty-btn" data-act="close"><span class="ms">check</span>Retour à la ville</button>`;}
  if(!s)return head('emergency','Tout va bien','')+`<p class="cty-p">Aucun incendie, aucune inondation, aucune tornade en ce moment. Quand une catastrophe arrive, un bandeau rouge te propose d’aider les secours en répondant à 3 questions.</p>`;
  const D_=SOS_N[s.k];if(!SOSQ)sosNext();
  let h=head(D_[1],`${D_[0]} : aide les secours !`,`${s.n} / 3 bonnes réponses · ${D_[2]}`,'#d62828')
    +`<div class="cty-dots">${[0,1,2].map(k=>`<i class="${k<s.n?'done':k===s.n?'cur':''}"></i>`).join('')}</div>`;
  if(SOSQ.empty)return h+`<p class="cty-p">Ajoute des questions dans Kiné+ pour pouvoir aider la ville.</p>`;
  const q=SOSQ.q,L='ABCDEFGHIJ',done=SOSQ.ans!=null;
  h+=(q.ctx?`<p class="cty-p small">${esc(q.ctx)}</p>`:'')+`<div class="cty-qq">${esc(q.question)}</div>`
    +`<div class="cty-qas">`+SOSQ.order.map((j,k)=>{let cl='';if(done){if(j===(q.correct|0))cl=' ok';else if(j===SOSQ.ans)cl=' ko';}
      return `<button class="cty-qa${cl}" data-act="sosa" data-j="${j}"${done?' disabled':''}><b>${L[k]||k+1}</b><span>${esc(q.answers[j])}</span></button>`;}).join('')+`</div>`;
  if(done){const ok=SOSQ.ans===(q.correct|0);
    h+=`<div class="cty-qfb ${ok?'ok':'ko'}"><b>${ok?'Bonne réponse !':'Raté…'}</b> ${ok?(s.n>=3?'':'Les secours se rapprochent.'):`La bonne réponse : <b>${esc(q.answers[q.correct|0])}</b>.`}${q.expl?`<small>${esc(q.expl)}</small>`:''}</div>`
      +`<button class="cty-btn" data-act="sosnext"><span class="ms">arrow_forward</span>Question suivante</button>`;}
  return h+(SOSQ.own?`<p class="cty-p small">Questions tirées de tes cours : elles comptent comme des révisions.</p>`:'');
}
function sosAnswer(j){
  if(!SOSQ||SOSQ.ans!=null||!S.sos)return;SOSQ.ans=j;const q=SOSQ.q,ok=j===(q.correct|0);
  if(SOSQ.own){try{if(typeof recordAnswer==='function'){recordAnswer(q.id,ok,Math.round((performance.now()-SOSQ.t0)/1000));if(typeof saveAll==='function')saveAll();}}catch(e){}}
  if(ok){S.sos.n++;sndPlay('coin');if(S.sos.n>=3){sosWin();return;}}
  renderPanel();
}
function sosWin(){
  const k=S.sos.k,D_=SOS_N[k];let saved=0;
  for(let i=0;i<NN;i++){if(st[i]===FIRE||(st[i]===RUIN&&k!=='flood')){st[i]=OK;tmr[i]=0;if(lvl[i]&&zone[i])cap[i]=lotSpec(zone[i],lvl[i],vari[i]).cap;touch(i);saved++;}}
  if(k==='flood'&&S.flood){const t=S.flood.tiles||[];S.flood=null;t.forEach(i=>markG(i));}
  if(k==='torn'){S.dmg={};TORN=null;if(E&&E.tornado)E.tornado.visible=false;}
  D.icons=D.util=D.lv=D.roads=true;simRefresh();
  const r=Math.round(600*festMulAll());S.money+=r;floatMoney(r);S.sos=null;SOSQ=null;SOSWON={k,r,saved};
  S.stat.sos=(S.stat.sos|0)+1;v6Quest('sos');
  news(D_[1],'Le maire sauve la ville !',`${D_[0]} : grâce à 3 bonnes réponses, les secours sont arrivés en un temps record${saved?` (${saved} bâtiment${saved>1?'s':''} sauvé${saved>1?'s':''})`:''}.`,'good');
  fireworks(3,'Bravo, tu as sauvé la ville !');toast(`<b>Ville sauvée</b> · +${money(r)}`,'verified');save();renderPanel();refreshHUD(true);
}
function festMulAll(){return S.fest?2:1;}

// ── Musée d'anatomie : un grand squelette sur la place ; on touche une partie du corps → une question ──
const ANAT_BLD={id:'anato',name:'Musée d’anatomie',cat:'loisirs',w:3,cost:7500,upkeep:70,cov:{park:7,lv:5,edu:4},tour:8,ms:2,icon:'skeleton',desc:'Un squelette géant sur la place : touche une partie du corps pour répondre à une question (tes cours en priorité).'};
ANAT_BLD.d=ANAT_BLD.w;BLD.push(ANAT_BLD);BT.anato=ANAT_BLD;
Object.assign(SVB,{
  anato(r){
    bx(-1.45,-1.45,1.45,1.45,0,.012,'#e6dccb');
    bx(-1.35,-1.4,1.35,-.5,0,.58,'#efe9df',FOf(),'#d6cfc2');gable(-1.42,-1.47,1.42,-.43,.58,.3,'#cfc5b4',true,'#efe9df');
    for(let k=0;k<7;k++)cyl(-1.14+k*.38,-.4,0,.56,.045,.045,8,'#f7f4ee');bx(-1.3,-.46,1.3,-.34,.54,.6,'#e0d8ca');
    bx(-.32,-.335,.32,-.325,.38,.5,'#5b4a8b','basic');bx(-.3,-.33,.3,-.32,.4,.48,'#f4f1ea','basic');
    const B='#f3ead2',J='#e2d2ad',cz=.42,p=.13;   // squelette trapu (v6) : os épais, proportions humaines
    cyl(0,cz,0,p,.4,.44,18,'#d9d4cc','#cfc8bd');
    const S_=(x,z,y0,y1,rr)=>cyl(x,cz+z,y0,y1,rr,rr,8,B);
    for(const s of[-1,1]){bc(s*.06,cz+.03,.03,.055,p,p+.03,B);S_(s*.06,0,p+.03,p+.33,.028);ico(s*.06,p+.345,cz,.034,J);S_(s*.066,0,p+.36,p+.63,.033);
      ico(s*.085,p+.69,cz-.005,.07,B,.75);S_(s*.19,0,p+.85,p+1.08,.024);ico(s*.193,p+.84,cz,.028,J);S_(s*.2,0,p+.62,p+.83,.02);bc(s*.2,cz,.026,.016,p+.52,p+.62,B);ico(s*.17,p+1.09,cz,.035,J);}
    bc(0,cz,.11,.05,p+.62,p+.7,B);
    for(let k=0;k<7;k++)bc(0,cz-.035,.028,.026,p+.71+k*.045,p+.745+k*.045,J);
    for(let k=0;k<5;k++){const y=p+.85+k*.045,rr=.125-Math.abs(k-2)*.01;for(let a=0;a<11;a++){const t=-2.6+a/10*5.2;bc(Math.sin(t)*rr,cz+Math.cos(t)*rr*.72-.02,.015,.015,y,y+.022,B);}}
    bc(0,cz+.075,.016,.01,p+.86,p+1.06,B);bc(0,cz+.03,.165,.015,p+1.08,p+1.105,B);
    for(let k=0;k<2;k++)bc(0,cz-.02,.024,.024,p+1.11+k*.03,p+1.135+k*.03,J);
    ico(0,p+1.28,cz,.1,B,1.1);bc(0,cz+.04,.062,.042,p+1.15,p+1.19,B);
    ico(-.036,p+1.29,cz+.084,.023,'#3a3a3a');ico(.036,p+1.29,cz+.084,.023,'#3a3a3a');bc(0,cz+.095,.008,.004,p+1.22,p+1.25,'#3a3a3a');
    bench(-.9,.9,true);bench(.9,.9,true);tree3(-1.2,.2,.11);tree3(1.2,.2,.11);tree3(-1.15,1.2,.09);tree3(1.15,1.2,.09);
    return 1.7;}
});
// =========================================================
// v11 (13 nov. 2026) : tous les autres bâtiments refaits (énergie, eau, déchets, services, parcs, monuments, transports,
// loisirs, économie, bâtiments du métier), dans l'esprit de Cities: Skylines : volumes nets, parkings marqués, verdure, détails
// ── Aides de dessin v11 ──
// face orientée automatiquement vers l'extérieur (ctr = un point à l'intérieur du volume)
function qa(g,a,b,c,d,col,ctr){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  if(nx*(a[0]-ctr[0])+ny*(a[1]-ctr[1])+nz*(a[2]-ctr[2])<0)quad(g,d,c,b,a,col);else quad(g,a,b,c,d,col);}
function ta(g,a,b,c,col,ctr){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  if(nx*(a[0]-ctr[0])+ny*(a[1]-ctr[1])+nz*(a[2]-ctr[2])<0)tri(g,a,c,b,col);else tri(g,a,b,c,col);}
function frame3(A,B){let dx=B[0]-A[0],dy=B[1]-A[1],dz=B[2]-A[2];const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;let ux=0,uy=1;if(Math.abs(dy)>.9){ux=1;uy=0;}
  let sx=-dz*uy,sy=dz*ux,sz=dx*uy-dy*ux;const sl=Math.hypot(sx,sy,sz)||1;sx/=sl;sy/=sl;sz/=sl;
  return[sx,sy,sz,sy*dz-sz*dy,sz*dx-sx*dz,sx*dy-sy*dx];}
// poutre entre deux points (x, y, z locaux) : tapis roulants, flèches de grue, pieds inclinés, passerelles
function beam(x0,y0,z0,x1,y1,z1,w,h,col,bk){const g=G(bk||'plain'),c=CC(col),A=V(x0,y0,z0),B=V(x1,y1,z1),[sx,sy,sz,tx,ty,tz]=frame3(A,B),hw=w/2,hh=h/2;
  const p=(P_,a,b)=>[P_[0]+sx*a*hw+tx*b*hh,P_[1]+sy*a*hw+ty*b*hh,P_[2]+sz*a*hw+tz*b*hh],ctr=[(A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2];
  const a0=p(A,-1,-1),a1=p(A,1,-1),a2=p(A,1,1),a3=p(A,-1,1),b0=p(B,-1,-1),b1=p(B,1,-1),b2=p(B,1,1),b3=p(B,-1,1);
  qa(g,a0,a1,b1,b0,c,ctr);qa(g,a1,a2,b2,b1,c,ctr);qa(g,a2,a3,b3,b2,c,ctr);qa(g,a3,a0,b0,b3,c,ctr);qa(g,a0,a3,a2,a1,c,ctr);qa(g,b0,b1,b2,b3,c,ctr);}
// cylindre d'axe quelconque : tuyaux, rondins, balles de foin, roues, cuves couchées
function tube(x0,y0,z0,x1,y1,z1,r,seg,col,bk){const g=G(bk||'plain'),c=CC(col),A=V(x0,y0,z0),B=V(x1,y1,z1),[sx,sy,sz,tx,ty,tz]=frame3(A,B),ctr=[(A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2];
  const p=(P_,a)=>{const ca=Math.cos(a)*r,sa=Math.sin(a)*r;return[P_[0]+sx*ca+tx*sa,P_[1]+sy*ca+ty*sa,P_[2]+sz*ca+tz*sa];};
  for(let k=0;k<seg;k++){const a0=k/seg*6.28318,a1=(k+1)/seg*6.28318,p0=p(A,a0),p1=p(A,a1),q0=p(B,a0),q1=p(B,a1);qa(g,p0,p1,q1,q0,c,ctr);ta(g,A,p0,p1,c,ctr);ta(g,B,q0,q1,c,ctr);}}
// coupole (demi-sphère en anneaux) ; slit : couleur d'une fente tournée vers la rue (observatoire)
function dome(x,z,y,r,seg,col,sy,slit){sy=sy||1;const g=G('plain'),c=CC(col),cs=slit?CC(slit):c,p=P(x,z),f=P(x,z+1),aw=Math.atan2(f[1]-p[1],f[0]-p[0]),n=5;
  for(let i=0;i<n;i++){const b0=i/n*1.5708,b1=(i+1)/n*1.5708,r0=Math.cos(b0)*r,r1=i===n-1?0:Math.cos(b1)*r,y0=y+Math.sin(b0)*r*sy,y1=y+Math.sin(b1)*r*sy;
    for(let k=0;k<seg;k++){const a0=k/seg*6.28318,a1=(k+1)/seg*6.28318,am=(a0+a1)/2;let da=Math.abs(((am-aw)%6.28318+9.42477)%6.28318-3.14159);const cc=slit&&da<.3?cs:c;
      const A=[p[0]+Math.cos(a0)*r0,y0,p[1]+Math.sin(a0)*r0],B=[p[0]+Math.cos(a1)*r0,y0,p[1]+Math.sin(a1)*r0],C=[p[0]+Math.cos(a1)*r1,y1,p[1]+Math.sin(a1)*r1],D=[p[0]+Math.cos(a0)*r1,y1,p[1]+Math.sin(a0)*r1];
      if(r1>0)quad(g,B,A,D,C,cc);else tri(g,B,A,D,cc);}}}
// toit en berceau (halles, gare, piscine, hangar) : alongX = faîtage parallèle à x
function vault(x0,z0,x1,z1,y0,h,seg,col,alongX,gcol){const g=G('plain'),c=CC(col),cg=CC(gcol||col);
  const pt=(t,e)=>{const a=Math.PI*t,s=(1-Math.cos(a))/2,yy=y0+Math.sin(a)*h;return alongX?V(e?x1:x0,yy,z0+(z1-z0)*s):V(x0+(x1-x0)*s,yy,e?z1:z0);};
  const mid=alongX?[V(x0,y0,(z0+z1)/2),V(x1,y0,(z0+z1)/2)]:[V((x0+x1)/2,y0,z0),V((x0+x1)/2,y0,z1)],ctr=[(mid[0][0]+mid[1][0])/2,y0+h*.3,(mid[0][2]+mid[1][2])/2];
  for(let k=0;k<seg;k++){const t0=k/seg,t1=(k+1)/seg;qa(g,pt(t0,0),pt(t1,0),pt(t1,1),pt(t0,1),c,[ctr[0],y0-h*3,ctr[2]]);ta(g,mid[0],pt(t0,0),pt(t1,0),cg,ctr);ta(g,mid[1],pt(t0,1),pt(t1,1),cg,ctr);}}
// anneau plat (pistes, allées rondes, marquages)
function annulus(cx,cz,r0,r1,a0,a1,seg,y,col,bk){const g=G(bk||'plain'),c=CC(col);for(let k=0;k<seg;k++){const t0=a0+(a1-a0)*k/seg,t1=a0+(a1-a0)*(k+1)/seg;
  const A=V(cx+Math.cos(t0)*r0,y,cz+Math.sin(t0)*r0),B=V(cx+Math.cos(t1)*r0,y,cz+Math.sin(t1)*r0),C=V(cx+Math.cos(t1)*r1,y,cz+Math.sin(t1)*r1),D=V(cx+Math.cos(t0)*r1,y,cz+Math.sin(t0)*r1);qa(g,A,B,C,D,c,[A[0],y-1,A[2]]);}}
function cone2(x,z,y,h,r,seg,c1,c2){const p=P(x,z),g=G('plain'),A=CC(c1),B_=CC(c2);for(let k=0;k<seg;k++){const a0=k/seg*6.28318,a1=(k+1)/seg*6.28318;tri(g,[p[0]+Math.cos(a1)*r,y,p[1]+Math.sin(a1)*r],[p[0]+Math.cos(a0)*r,y,p[1]+Math.sin(a0)*r],[p[0],y+h,p[1]],k%2?A:B_);}}   // toile rayée
function pyr(x,z,y,h,hw,col,bk){const g=G(bk||'plain'),c=CC(col),T=V(x,y+h,z),a=V(x-hw,y,z-hw),b=V(x+hw,y,z-hw),d=V(x+hw,y,z+hw),e=V(x-hw,y,z+hw),ctr=[T[0],y+h*.3,T[2]];
  ta(g,a,b,T,c,ctr);ta(g,b,d,T,c,ctr);ta(g,d,e,T,c,ctr);ta(g,e,a,T,c,ctr);}
// clôture : poteaux + deux lisses ; gap = portail centré côté rue (+z)
function fence(x0,z0,x1,z1,h,col,gap){col=col||'#8d949b';h=h||.1;gap=gap||0;const e=.004;
  const side=(a,b,c,d)=>{const L=Math.hypot(c-a,d-b),n=Math.max(1,Math.round(L/.26));for(let k=0;k<=n;k++){const u=k/n;bc(a+(c-a)*u,b+(d-b)*u,.006,.006,0,h,col);}
    const X0=Math.min(a,c)-e,Z0=Math.min(b,d)-e,X1=Math.max(a,c)+e,Z1=Math.max(b,d)+e;bx(X0,Z0,X1,Z1,h*.45,h*.45+.008,col);bx(X0,Z0,X1,Z1,h-.008,h,col);};
  side(x0,z0,x1,z0);side(x0,z0,x0,z1);side(x1,z0,x1,z1);if(gap>0){side(x0,z1,-gap/2,z1);side(gap/2,z1,x1,z1);}else side(x0,z1,x1,z1);}
// rangée de places de parking : lignes blanches + voitures garées selon l'heure (spot, v10). face = +1 / -1 : sens des places en z
function pkRow(x0,x1,z,face,kind){const w=.13,n=Math.max(1,Math.floor((x1-x0)/w)),d=.2*(face||1),za=Math.min(z,z+d),zb=Math.max(z,z+d);
  for(let k=0;k<=n;k++){const x=x0+k*w;bx(x-.004,za,x+.004,zb,.006,.009,'#f2f2f2');}for(let k=0;k<n;k++)spot(x0+(k+.5)*w,z+d*.5,false,kind==null?2:kind);}
function asph(x0,z0,x1,z1){bx(x0,z0,x1,z1,0,.0075,'#5f656c');}   /* v15 : un peu au-dessus du dallage (avant : même hauteur → rayures qui scintillent) */
function lawnB(w){bx(-w/2+.02,-w/2+.02,w/2-.02,w/2-.02,0,.005,'#8fcf6e');}
function umb(x,z,col){bc(x,z,.005,.005,0,.15,'#d0d0d0');cone(x,z,.13,.05,.1,8,col||'#e4572e');bc(x,z,.035,.035,.06,.068,'#f4f1ea');}   // parasol + table
function treeY(x,z,y,s){bc(x,z,s*.18,s*.18,y,y+s*1.15,'#7a5236');ico(x,y+s*1.75,z,s,'#5aa84a');}   // arbre posé en hauteur (toits-terrasses)
function amb(x,z){bc(x,z,.055,.1,.02,.13,'#f6f7f8');bx(x-.056,z-.07,x+.056,z+.07,.07,.085,'#e63946');bc(x,z+.07,.05,.025,.08,.12,'#2e3b47');bx(x-.03,z-.05,x+.03,z-.03,.13,.14,'#2f7bff','basic');}
function transat(x,z){bx(x-.025,z-.06,x+.025,z+.06,.02,.03,'#ffffff');wedge(x-.025,z-.06,x+.025,z-.02,.03,.08,.03,'#ffffff');}
function hedge(x0,z0,x1,z1,h){bx(x0,z0,x1,z1,0,h||.05,'#4f9a45',null,'#5aa84a');}
// l'avant du modèle (+z) tourné vers l'eau (ports, pompage) : renvoie l'orientation à remettre ensuite
function toWater(s){const dl=waterDirLocal(s),k0=TX.k;let j=0;if(dl[0]>0)j=1;else if(dl[1]<0)j=2;else if(dl[0]<0)j=3;TX.k=(k0+j)&3;return k0;}
// sol des terrains v11 : pelouse unie (le dessin du modèle tourne avec le bâtiment, contrairement à la texture du sol)
const V11G={landfill:'#9b8b6e',funfair:'#ead9c4'},V11T=new Set('wind coal solar wtower pump landfill incin recycle sante biblio gym square garden plaza refuge parccanin garde vaccin pharma dentenf labo ortho balneo piste sportk statue fac reeduc pool stadium tower chu observ arc duelstatue bus metro gare tramstop cinema marina wheel musee funfair ferme scierie peche port aeroport'.split(' '));
Object.assign(SVB,{
  // ── Énergie, eau, déchets ──
  wind(r){   // éolienne : socle, mât en 3 tronçons avec dégradé vert au pied, porte, nacelle, balisage, transformateur
    bc(0,0,.19,.19,0,.025,'#cfcac1');cyl(0,0,.025,.06,.1,.095,14,'#dcd8d1');
    cyl(0,0,.06,.12,.066,.065,14,'#5fa86a');cyl(0,0,.12,.18,.065,.064,14,'#86c08d');cyl(0,0,.18,.24,.064,.063,14,'#b9dcbc');
    cyl(0,0,.24,1.0,.063,.052,14,'#f7f7f5');cyl(0,0,1.0,1.6,.052,.043,14,'#f3f3f1');cyl(0,0,1.6,2.0,.043,.036,14,'#f0f0ee');
    bx(-.022,.058,.022,.07,.06,.2,'#8c969f');bx(-.03,.06,.03,.1,.2,.21,'#cfd3d6');
    bc(0,-.035,.048,.125,1.995,2.115,'#f6f6f4');bc(0,-.035,.05,.127,2.05,2.06,'#dfe3e6');bc(0,-.15,.035,.02,2.0,2.1,'#e9ebed');
    bc(-.025,-.13,.005,.005,2.115,2.16,'#9aa0a6');bc(.025,-.13,.012,.012,2.115,2.13,'#ff3b3b','basic');
    bc(.3,.32,.07,.055,0,.12,'#d6dce1');bx(.23,.375,.37,.38,.015,.1,'#a3acb4');bx(.27,.38,.33,.382,.07,.09,'#f2c14e');
    bx(-.04,.07,.04,.5,0,.007,'#cfc6b2');
    if(CUR){const p=V(0,2.07,.1);CUR.rot.push(p[0],p[1],p[2],TX.k);}return 2.5;},
  coal(r){   // centrale thermique : aéroréfrigérants, chaudière, salle des machines, cheminée rayée, parc à charbon + convoyeur, poste électrique
    bx(-1.48,-1.48,1.48,1.48,0,.006,'#b5b0a6');
    coolTower(-.85,-.85,1.75);coolTower(.4,-.9,1.75);EMIT('steam',-.85,1.85,-.85);EMIT('steam',.4,1.85,-.9);
    bx(-1.42,.15,-.1,1.1,0,.72,'#c3bdb2',FIn(.72),'#8b867f');bx(-1.43,.14,-.09,1.11,.58,.64,'#2f6fa8');gable(-1.45,.12,-.07,1.13,.72,.16,'#6f7c88',true,'#c3bdb2');
    for(const x of[-1.15,-.75,-.35])bx(x-.12,1.1,x+.12,1.106,0,.36,'#5f6b76');
    bx(-1.25,-.22,-.35,.15,0,1.35,'#a9a398',FIn(1.35),'#7d786f');parapet(-.8,-.035,.9,.37,1.35,'#8f8a82');
    for(const x of[-1.05,-.55])cyl(x,-.05,1.35,1.55,.05,.05,8,'#9aa0a6');
    for(let k=0;k<6;k++){const y0=k*.46;cyl(.3,-.02,y0,y0+.46,.15-.012*k,.138-.012*k,12,k>=4?(k%2?'#f2f2f2':'#c94b3a'):'#d2ccc2');}
    for(const k of[3,5])cyl(.3,-.02,k*.46,k*.46+.03,.165-.012*k,.165-.012*k,12,'#6d7378');
    EMIT('smoke',.3,2.8,-.02);
    tube(-.35,.95,-.05,.15,.95,-.02,.045,8,'#8d949b');tube(-.35,.75,.08,-.1,.75,.4,.04,8,'#8d949b');
    bx(.2,.2,1.46,1.46,.006,.01,'#8a857c');
    for(const [x,z,s] of[[.6,.65,.32],[1.1,.75,.28],[.85,1.15,.3]])cone(x,z,.01,s*.75,s,9,'#2f2f33');
    beam(.6,.2,.65,-.4,1.1,.1,.07,.04,'#7d858d');for(const t of[.3,.6])bc(.6-t,.65-.55*t,.012,.012,0,.2+.9*t,'#7d858d');
    bc(1.15,1.2,.06,.04,.01,.07,'#f2b134');bc(1.13,1.2,.025,.03,.07,.11,'#3e4a55');bx(1.21,1.15,1.23,1.25,.01,.06,'#c9a227');
    bx(1.02,-1.42,1.46,.12,.006,.01,'#a7a196');
    for(let k=0;k<3;k++){const z=-1.2+k*.45;bc(1.24,z,.1,.08,.01,.16,'#7d8a96');for(const x of[1.17,1.24,1.31])bc(x,z,.008,.008,.16,.24,'#c9b98f');}
    for(const z of[-1.37,.07])for(const x of[1.06,1.42])bc(x,z,.01,.01,0,.44,'#9aa0a6');
    for(const z of[-1.37,.07])bx(1.05,z-.01,1.43,z+.01,.42,.44,'#9aa0a6');for(const x of[1.17,1.31])bx(x-.003,-1.37,x+.003,.07,.4,.405,'#59616a');
    fence(-1.47,-1.47,1.47,1.47,.12,'#8d949b',.5);return 2.8;},
  solar(r){   // parc solaire : modules inclinés sur pieds, piste, conteneurs de batteries, local technique, clôture
    bx(-1.48,-1.48,1.48,1.48,0,.006,'#c9c0ab');
    for(let k=0;k<6;k++){const z0=-1.38+k*.42;
      for(let j=0;j<5;j++){const x0=-1.36+j*.5;
        for(const x of[x0+.07,x0+.39]){bc(x,z0+.04,.007,.007,0,.18,'#9aa3ab');bc(x,z0+.28,.007,.007,0,.07,'#9aa3ab');}
        for(const h of[0,1])beam(x0+.115+h*.23,.19,z0,x0+.115+h*.23,.07,z0+.31,.222,.014,'#22457a');}}
    bx(-1.46,1.12,1.46,1.3,.006,.01,'#9a948a');
    for(let k=0;k<3;k++){const x=-1.05+k*.42;bc(x,1.39,.17,.06,.006,.15,'#eef1f3');for(let j=0;j<6;j++)bx(x-.15+j*.06,1.45,x-.13+j*.06,1.452,.02,.14,'#d3d9de');bx(x+.12,1.45,x+.15,1.453,.1,.12,'#3ddc84','basic');}
    bc(.75,1.37,.24,.08,.006,.2,'#dfe5ea',FOf(),'#b9c1c6');bc(1.25,1.37,.06,.06,.006,.14,'#8d949b');
    fence(-1.47,-1.47,1.47,1.47,.12,'#8d949b',.3);return .3;},
  wtower(r){   // château d'eau « champignon » : fût, coupe évasée, bandeau bleu, garde-corps, antennes
    lawnB(1);bx(-.05,.08,.05,.48,0,.008,'#d9cfb8');
    cyl(0,0,0,.05,.14,.13,16,'#d6d0c5');cyl(0,0,.05,.95,.1,.075,16,'#ece7de');
    bx(-.012,.078,.012,.1,.25,.85,'#7fa0b8');bx(-.03,.094,.03,.104,.05,.17,'#6d7881');
    cyl(0,0,.95,1.12,.075,.3,16,'#e3ddd2');cyl(0,0,1.12,1.42,.3,.3,16,'#efeae2');cyl(0,0,1.25,1.29,.303,.303,16,'#3b7fc4');
    cyl(0,0,1.42,1.45,.31,.31,16,'#bfb8ad');cyl(0,0,1.45,1.52,.26,.2,16,'#d6d0c5');
    for(let k=0;k<10;k++){const a=k/10*6.283;bc(Math.cos(a)*.3,Math.sin(a)*.3,.005,.005,1.45,1.5,'#8b97a3');}
    bc(0,0,.006,.006,1.52,1.75,'#9aa0a6');bc(.07,0,.025,.004,1.6,1.66,'#cfd3d6');bc(0,0,.01,.01,1.75,1.77,'#ff3b3b','basic');
    tree3(-.32,.3,.07);tree3(.33,-.3,.08);bench(.3,.35,true);return 1.75;},
  pump(r,s){   // station de pompage, tournée vers la rivière : prise d'eau, bâtiment des pompes, décanteur, filtres, cuves
    const k0=toWater(s);
    lawnB(2);bx(-.98,.7,.98,.98,0,.012,'#cfd3d6');
    bx(.15,.72,.75,.98,.012,.12,'#b9c0c6');for(let k=0;k<5;k++)bx(.2+k*.11,.975,.27+k*.11,.985,.03,.1,'#4a5560');
    tube(.45,.07,.8,.45,-.04,1.3,.05,8,'#5f8fb3');
    bx(-.92,-.12,-.08,.62,0,.48,'#b7654a',FRs(),'#8f4d38');bx(-.93,-.13,-.07,.63,.44,.48,'#e9dfd2');gable(-.95,-.15,-.05,.65,.48,.2,'#5e6b78',true,'#b7654a');
    bc(-.25,.0,.03,.03,.6,.72,'#8f4d38');
    cyl(.52,-.42,0,.14,.4,.4,20,'#cfd5da','#cfd5da');cyl(.52,-.42,.14,.145,.36,.36,20,'#3f9fd0','#3f9fd0');cyl(.52,-.42,.14,.2,.05,.05,10,'#9aa3ab');bx(.5,-.82,.54,-.42,.17,.2,'#7d8a96');
    bx(-.92,-.92,-.12,-.25,0,.1,'#cfd5da');bx(-.88,-.88,-.54,-.29,.1,.104,'#4aa8d8');bx(-.5,-.88,-.16,-.29,.1,.104,'#4aa8d8');bx(-.54,-.88,-.5,-.29,.1,.11,'#9aa3ab');
    for(const z of[.2,.45]){tube(.15,.1,z,.55,.1,z,.07,10,'#e9eef2');for(const x of[.2,.5])bc(x,z,.012,.04,0,.05,'#8d949b');}
    tube(-.08,.1,.3,.12,.1,.3,.03,8,'#5f8fb3');tube(.12,.12,-.05,.12,.12,-.42,.03,8,'#5f8fb3');tube(.12,.12,-.42,.16,.12,-.42,.03,8,'#5f8fb3');
    for(const [a,b,c,d] of[[-.97,-.97,.97,-.97],[-.97,-.97,-.97,.7],[.97,-.97,.97,.7]]){const L=Math.hypot(c-a,d-b),n=Math.round(L/.26);for(let k=0;k<=n;k++)bc(a+(c-a)*k/n,b+(d-b)*k/n,.006,.006,0,.1,'#8d949b');bx(Math.min(a,c)-.004,Math.min(b,d)-.004,Math.max(a,c)+.004,Math.max(b,d)+.004,.092,.1,'#8d949b');}
    tree3(.85,.3,.07);tree3(.85,-.05,.06);
    TX.k=k0;return .72;},
  landfill(r){   // décharge : alvéole en cours (déchets colorés), butte recouverte d'herbe + évents, bassin, bascule, bulldozer
    const T=['#e4572e','#2e86ab','#f2b134','#ffffff','#3fa34d','#a23b72','#8d6e4f','#cfd5da'];
    cyl(-.55,-.5,0,.42,.85,.5,8,'#8a7a62','#93836a');
    for(let k=0;k<40;k++){const a=r()*6.283,t=r(),y=t*.42,R=(.85-.35*t)*.97,s=.025+r()*.03;bc(-.55+Math.cos(a)*R*(k<30?1:r()*.5),-.5+Math.sin(a)*R*(k<30?1:r()*.5),s,s*.8,(k<30?y:.42)-.01,(k<30?y:.42)+s*.6,pick(r,T));}
    bc(-.5,-.45,.06,.04,.42,.48,'#f2b134');bc(-.52,-.45,.03,.035,.48,.53,'#3e4a55');for(const z of[-.495,-.405])bc(-.5,z,.07,.012,.42,.445,'#2b2b2b');bx(-.43,-.5,-.42,-.4,.42,.47,'#c9a227');
    cyl(.6,-.75,0,.3,.68,.38,8,'#7fb860','#8fca6a');for(const [x,z] of[[.5,-.8],[.75,-.6],[.6,-.95]])bc(x,z,.012,.012,.28,.42,'#9aa0a6');
    bx(.25,.3,1.0,.85,0,.03,'#6b7d4a');bx(.3,.35,.95,.8,.03,.034,'#5d8a6a');
    bx(-1.45,.75,-.25,1.45,0,.006,'#a39a88');bx(-.25,.95,.95,1.15,0,.006,'#a39a88');
    bc(1.2,1.12,.2,.08,0,.17,'#e9eef2',FRs(),'#b9c1c6');bx(.55,1.2,.95,1.42,0,.02,'#7d858d');bc(.5,1.3,.012,.012,0,.12,'#59616a');beam(.5,.11,1.3,.95,.11,1.3,.012,.012,'#e63946');
    truck(-.75,1.0,true,'#3fa34d');truck(-.05,.62,false,'#3fa34d');
    fence(-1.47,-1.47,1.47,1.47,.13,'#8d949b',.4);return .6;},
  incin(r){   // incinérateur moderne : hall bardé, toit en pente végétalisé, bandeau vitré, fosse à déchets, épuration, cheminée
    bx(-.98,-.98,.98,.98,0,.006,'#b9b4aa');
    bx(-.92,-.7,.45,.55,0,.42,'#c7ced4',FIn(.42),'#9aa3ab');wedge(-.92,-.7,.45,.55,.42,.95,.48,'#aeb7bf');wedge(-.9,-.68,.43,.53,.43,.965,.495,'#6fb35a');
    bx(-.93,.55,.46,.565,.12,.3,'#9fc9de','glass');bx(-.93,.54,.46,.575,.31,.33,'#e4572e');
    bx(.45,-.25,.95,.6,0,.5,'#7d8a96',FIn(.5),'#626d78');for(const x of[.58,.82])bx(x-.08,.6,x+.08,.606,0,.22,'#3d4650');
    bx(.45,-.97,.95,-.3,0,.68,'#a9b2ba',FIn(.68),'#8d969e');
    cyl(.7,-.62,.68,1.9,.1,.075,12,'#e3e6e9');cyl(.7,-.62,1.7,1.78,.087,.086,12,'#c94b3a');cyl(.7,-.62,1.86,1.9,.08,.08,12,'#6d7378');
    EMIT('smoke',.7,1.95,-.62);
    tube(.45,.55,-.4,.2,.55,-.4,.05,8,'#9aa0a6');
    bx(-.85,.6,-.45,.98,0,.006,'#5f656c');pkRow(-.84,-.46,.62,1,1);
    truck(.58,.82,false,'#3fa34d');truck(.82,.88,false,'#3fa34d');tree3(-.25,.8,.09);tree3(-.05,.9,.07);return 1.95;},
  recycle(r){   // centre de tri : hall à sheds, bandeau vert, balles de matières triées, tas de verre, bennes, convoyeur
    bx(-.98,-.98,.98,.98,0,.006,'#c4bfb4');
    bx(-.95,-.92,.4,.15,0,.45,'#e9eef0',FIn(.45),'#c9d1d6');bx(-.96,-.93,.41,.16,.3,.36,'#3fa34d');
    for(let k=0;k<4;k++){const z0=-.92+k*.2675;wedge(-.95,z0,.4,z0+.2675,.45,.62,.46,'#cfd6dc');bx(-.95,z0-.003,.4,z0+.005,.47,.6,'#9fc9de','glass');}
    for(const x of[-.65,-.3])bx(x-.11,.15,x+.11,.156,0,.24,'#3d4650');signB(.15,.15,.36,.27,'#2fa36b',.08);
    const BL=[['#3b7fc4','#5d97d6'],['#f2c14e','#f7d57a'],['#9aa3ab','#b8bfc5'],['#e4572e','#ec7a55']];
    for(let i=0;i<4;i++)for(let j=0;j<2;j++){const n=2+((i+j)%2);for(let h=0;h<n;h++){const c=BL[i];bc(.57+j*.2,-.8+i*.22,.085,.085,.006+h*.13,.13+h*.13,c[h%2],null,c[1]);}}
    cone(.75,.45,.006,.14,.2,8,'#5fae6a');cone(.75,.78,.006,.12,.17,8,'#a9d6c0');
    for(const [x,c] of[[-.8,'#2f6fd6'],[-.55,'#f2b134'],[-.3,'#3fa34d']]){bc(x,.55,.1,.07,0,.09,c);wedge(x-.1,.48,x+.1,.62,.09,.11,.09,c);}
    beam(.57,.3,.0,.38,.4,-.2,.06,.03,'#7d858d');
    bx(-.95,.7,.4,.98,0,.006,'#5f656c');truck(-.1,.42,false,'#3fa34d');tree3(.85,.9,.07);return .7;},
});
Object.assign(SVB,{
  // ── Services ──
  sante(r){   // maison de santé : corps enduit blanc + aile en bois, hall vitré, croix verte, toit planté, parking, vélos
    lawnB(2);
    bx(-.9,-.75,.25,.2,0,FH*2,'#f6f7f4',FRs(),'#e3e6e3');bx(-.91,-.76,.26,.21,FH*2,FH*2+.03,'#e9ece9');bx(-.86,-.71,.21,.16,FH*2+.03,FH*2+.042,'#7fbf5a');
    bx(.25,-.85,.9,.05,0,FH*2.3,'#c99a6b',FRs(),'#a77a52');bx(.24,-.86,.91,.06,FH*2.3,FH*2.3+.03,'#f1ede6');roofKit(r,.57,-.4,.5,.7,FH*2.3+.03);
    bx(-.28,.2,.22,.3,0,FH*.95,'#a9d3e6','glass');canopy(-.03,.3,.62,FH*.95,'#2fa36b');
    cross(.58,FH*1.75,.062,.09,'#2fa36b');bx(-.88,.205,.2,.215,FH*1.55,FH*1.75,'#2fa36b');
    bx(-.1,.3,.1,.98,0,.008,'#e3dccd');
    asph(-.96,.34,-.36,.99);pkRow(-.93,-.39,.36,1,2);pkRow(-.93,-.39,.98,-1,2);
    tree3(.55,.5,.1);tree3(.82,.85,.08);bench(.42,.86,true);for(let k=0;k<5;k++)bc(.2+k*.05,.42,.004,.03,0,.06,'#59616a');lamp(.2,.7);return .85;},
  biblio(r){   // médiathèque : rez-de-chaussée vitré, grande boîte cuivrée en porte-à-faux à lames, toit planté, pile de livres géante
    lawnB(2);bx(-.9,.2,.9,.98,0,.008,'#e6dfd0');
    bx(-.8,-.7,.8,.2,0,FH,'#a9d3e6','glass');for(const x of[-.6,0,.6])bc(x,.17,.02,.02,0,FH,'#59616a');
    bx(-.88,-.8,.88,.32,FH,FH*2.5,'#d08b55',FOf(FH),'#b97a48');
    for(let k=0;k<12;k++){const x=-.84+k*.153;bx(x,.32,x+.025,.35,FH,FH*2.5,'#efe6d6');}
    bx(-.89,-.81,.89,.33,FH*2.5,FH*2.5+.03,'#efe6d6');bx(-.7,-.65,.3,.15,FH*2.53,FH*2.53+.012,'#7fbf5a');
    treeY(-.5,-.35,FH*2.53,.06);treeY(.0,-.2,FH*2.53,.05);treeY(-.25,.0,FH*2.53,.05);roofKit(r,.6,-.4,.4,.5,FH*2.53);
    signB(0,.2,.5,FH*.62,'#2e86ab',.06);
    const BK=['#e4572e','#2e86ab','#f2b134','#3fa34d','#a23b72'];for(let k=0;k<5;k++){const o=k%2?.025:-.02;bc(.55+o,.65,.16-k*.012,.1-k*.006,k*.05,(k+1)*.05,BK[k],null,'#f4efe4');}
    bench(-.55,.62,true);bench(-.2,.75,true);tree3(-.82,.72,.1);tree3(.86,.88,.07);lamp(-.35,.9);lamp(.2,.9);return FH*2.6;},
  gym(r){   // salle de sport : toit en berceau à arcs orange, bandeau lumineux, façade vitrée, aire de street workout, parking
    lawnB(2);
    bx(-.88,-.8,.88,.25,0,.42,'#e9eef2',FOf(),'#c9d3da');vault(-.9,-.82,.9,.27,.42,.24,8,'#dfe5ea',true,'#e9eef2');
    for(let k=0;k<5;k++){const x=-.72+k*.36;vault(x-.015,-.835,x+.015,.285,.42,.25,8,'#ff8c42',true);}
    bx(-.89,.25,.89,.27,.3,.36,'#ff8c42','basic');bx(-.5,.25,.5,.262,0,.26,'#a9d3e6','glass');canopy(0,.262,.4,.27,'#ff8c42');
    bx(-.9,.4,-.15,.95,0,.008,'#c8553d');
    for(const x of[-.75,-.5,-.25])bc(x,.55,.008,.008,0,.24,'#59616a');bx(-.76,.546,-.24,.554,.23,.24,'#59616a');
    for(const z of[.75,.85])bx(-.8,z-.004,-.45,z+.004,.1,.11,'#59616a');for(const x of[-.78,-.47])for(const z of[.75,.85])bc(x,z,.005,.005,0,.1,'#59616a');
    bc(-.3,.8,.05,.05,0,.04,'#3d4650');
    asph(.24,.3,.97,.99);pkRow(.27,.94,.32,1,2);pkRow(.27,.94,.98,-1,2);tree3(.06,.65,.08);return .7;},
  // ── Parcs ──
  square(r){   // square : allées en croix, massif fleuri, arbres variés, bancs, réverbères, haies
    lawnB(1);bx(-.48,-.04,.48,.04,0,.008,'#e8dcc0');bx(-.04,-.48,.04,.48,0,.008,'#e8dcc0');
    cyl(0,0,0,.03,.14,.14,14,'#d9cfb8');cyl(0,0,.03,.055,.1,.1,14,'#8a6a4a','#6b4e36');
    const F=['#f15bb5','#fee440','#ff9f1c','#9b5de5'];for(let k=0;k<8;k++){const a=k/8*6.283;ico(Math.cos(a)*.07,.065,Math.sin(a)*.07,.025,F[k%4]);}
    if(r()<.5)tree3(0,0,.05,true);else ico(0,.08,0,.035,'#f15bb5');
    tree3(-.27,-.27,.13);tree3(.28,.28,.1,r()<.4);tree3(.3,-.3,.08);
    hedge(-.46,.1,-.1,.16,.05);hedge(.1,-.46,.16,-.1,.05);
    bench(-.25,.2,true);bench(.2,-.25,false);lamp(-.1,-.1);lamp(.1,.1);return .6;},
  garden(r){   // jardin public : allée en boucle, étang avec pont de bois, kiosque à musique, massifs, haies, bancs
    lawnB(2);const PA='#e8dcc0';
    bx(-.75,-.75,.75,-.67,0,.008,PA);bx(-.75,.67,.75,.75,0,.008,PA);bx(-.75,-.75,-.67,.75,0,.008,PA);bx(.67,-.75,.75,.75,0,.008,PA);bx(-.04,.75,.04,.98,0,.008,PA);bx(-.67,.06,-.28,.14,0,.008,PA);
    ico(.2,0,.1,.42,'#7a8f5a',.06);ico(.2,.008,.1,.38,'#4fb0d8',.05);
    for(let k=0;k<9;k++){const a=k/9*6.283+.3;ico(.2+Math.cos(a)*.41,.012,.1+Math.sin(a)*.41,.028,'#b9b2a5',.7);}
    beam(-.3,.012,.1,.2,.1,.1,.09,.02,'#a0703f');beam(.2,.1,.1,.7,.012,.1,.09,.02,'#a0703f');
    for(const s of[-1,1]){beam(-.3,.06,.1+s*.04,.2,.15,.1+s*.04,.008,.008,'#7a5236');beam(.2,.15,.1+s*.04,.7,.06,.1+s*.04,.008,.008,'#7a5236');}
    cyl(-.4,-.4,0,.05,.2,.2,8,'#e9e2d4');for(let k=0;k<8;k++){const a=k/8*6.283+.39;bc(-.4+Math.cos(a)*.17,-.4+Math.sin(a)*.17,.008,.008,.05,.26,'#f4f1ea');}
    cyl(-.4,-.4,.26,.28,.22,.22,8,'#f4f1ea');cone(-.4,-.4,.28,.14,.23,8,'#3f7f6a');bc(-.4,-.4,.006,.006,.42,.47,'#c9a227');
    const F=['#f15bb5','#fee440','#ff9f1c','#9b5de5','#e63946'];
    for(let k=0;k<10;k++){bc(-.6+k*.12,.6,.04,.03,0,.04,F[k%5]);bc(-.6+k*.12,-.6,.04,.03,0,.04,F[(k+2)%5]);}
    hedge(-.95,-.95,-.8,.95,.06);hedge(.8,-.95,.95,.95,.06);
    for(const [x,z,c] of[[-.88,-.88,0],[.88,-.88,1],[-.88,.88,0],[.88,.88,0],[.45,-.45,0],[-.5,.4,1],[.55,.5,0]])tree3(x,z,.1+((x*7+z*3)&1)*.03,!!c);
    bench(-.3,.82,true);bench(.3,-.82,true);bench(-.82,.3,false);lamp(-.71,-.71);lamp(.71,.71);lamp(-.71,.71);lamp(.71,-.71);return .5;},
  plaza(r){   // place à fontaine : dallage en damier, fontaine à trois vasques et jets, arbres en bacs, kiosque-café et parasols
    bx(-.98,-.98,.98,.98,0,.006,'#e6dfd2');for(let i=0;i<6;i++)for(let j=0;j<6;j++)if((i+j)%2)bx(-.9+i*.3,-.9+j*.3,-.6+i*.3,-.6+j*.3,.006,.008,'#d9d0c0');
    const wet=waterOK(),W=wet?'#57b9e3':'#b8b0a2';
    cyl(0,0,0,.09,.46,.46,20,'#d4cdc0','#d4cdc0');cyl(0,0,.09,.095,.42,.42,20,W,W,wet?'basic':null);
    cyl(0,0,.09,.3,.07,.06,10,'#e3ddd2');cyl(0,0,.3,.34,.2,.22,14,'#e3ddd2',W);cyl(0,0,.34,.48,.04,.035,8,'#e3ddd2');cyl(0,0,.48,.51,.1,.11,10,'#e3ddd2',W);
    if(wet){cone(0,0,.51,.14,.025,6,'#eaf8ff','basic');for(let k=0;k<8;k++){const a=k/8*6.283;cone(Math.cos(a)*.32,Math.sin(a)*.32,.095,.11,.014,5,'#eaf8ff','basic');}}
    for(const [x,z] of[[-.72,-.72],[.72,-.72],[.72,.72]]){bc(x,z,.09,.09,0,.08,'#bfb6a6');tree3(x,z,.1);}
    bc(-.7,.7,.13,.1,0,.2,'#2f6b5a');wedge(-.85,.6,-.55,.84,.2,.25,.22,'#f4f1ea');bx(-.83,.8,-.57,.802,.04,.16,'#ffd9a0','glass');
    umb(-.35,.75,'#e4572e');umb(-.7,.35,'#2e86ab');umb(-.3,.4,'#f2b134');
    bench(0,.65,true);bench(0,-.65,true);bench(.65,0,false);bench(-.65,0,false);lamp(.5,.5);lamp(-.5,-.5);lamp(.5,-.5);return .55;},
});
Object.assign(SVB,{
  // ── Bâtiments du métier ──
  refuge(r){   // refuge : chalet en bois, enclos à chiens avec niches, rampe d'agilité, allée, arbres
    lawnB(2);
    bx(-.92,-.92,.05,-.2,0,FH*1.4,'#d9b98a',FRs(),'#b8956a');gable(-.96,-.96,.09,-.16,FH*1.4,.24,'#5f7f4a',true,'#d9b98a');
    canopy(-.42,-.2,.36,FH*.85,'#5f7f4a');signB(-.42,-.2,.34,FH*1.05,'#3f9b4f',.06);
    bx(.12,-.92,.94,.92,0,.01,'#9ed37a');fence(.12,-.92,.94,0,.14,'#8d6e4f');fence(.12,0,.94,.92,.14,'#8d6e4f');
    for(const [x,z] of[[.4,-.65],[.75,-.65],[.45,.62]]){bc(x,z,.08,.07,0,.1,'#c79a6a');gable(x-.095,z-.085,x+.095,z+.085,.1,.07,'#b5523b',true,'#c79a6a');bx(x-.03,z+.07,x+.03,z+.074,0,.07,'#3a2a1e');}
    wedge(.5,.2,.8,.33,0,0,.12,'#e63946');wedge(.5,.33,.8,.46,0,.12,0,'#f2b134');
    for(const [x,z] of[[.3,-.3],[.6,.75]])cyl(x,z,0,.02,.03,.025,8,'#3b8fdc');
    dogFig(.4,-.35,'#c58b4e');dogFig(.65,-.15,'#3b3029');dogFig(.3,.3,'#e9dcc3');dogFig(.7,.6,'#8a5a30');
    bx(-.5,-.2,-.34,.98,0,.008,'#e3dccd');tree3(-.75,.4,.11);tree3(-.2,.65,.09);bench(-.72,.8,true);return .75;},
  parccanin(r){   // parc canin : enclos, tunnel, passerelle en A, slalom, obstacle, distributeur de sacs
    bx(-.48,-.48,.48,.48,0,.012,'#86c96a');fence(-.46,-.46,.46,.46,.12,'#59616a',.12);
    tube(-.38,.05,-.25,-.08,.05,-.25,.05,10,'#2e86ab');
    gable(-.05,-.38,.23,-.18,0,.14,'#e63946',false,'#f2b134');
    for(let k=0;k<5;k++)bc(-.3+k*.1,.12,.006,.006,0,.14,k%2?'#e63946':'#ffffff');
    for(const x of[.15,.35])bc(x,.3,.006,.006,0,.12,'#f2b134');bx(.15,.296,.35,.304,.09,.1,'#f2b134');
    bench(-.3,.36,true);bc(.38,.38,.012,.012,0,.12,'#3fa34d');bx(.36,.37,.4,.39,.11,.15,'#3fa34d');cyl(-.38,.0,0,.02,.03,.025,8,'#3b8fdc');
    dogFig(-.05,-.05,'#c58b4e');dogFig(.25,.05,'#3b3029');tree3(.36,-.36,.06);return .3;},
  garde(r){   // maison médicale de garde : façade vitrée, bandeau rouge lumineux, aile basse, ambulances, parking
    lawnB(2);
    bx(-.88,-.85,.6,.2,0,FH*2,'#f6f8f8',FOf(),'#dfe5e8');bx(-.89,-.86,.61,.21,FH*2,FH*2+.03,'#e3e6e8');bx(-.895,-.865,.615,.215,FH*2-.06,FH*2,'#d64545');roofKit(r,-.15,-.32,1.2,.8,FH*2+.03);
    bx(.6,-.7,.92,.1,0,FH*1.2,'#e9edf0',FOf(),'#cfd6dc');bx(.59,-.71,.93,.11,FH*1.2,FH*1.2+.025,'#ffffff');cross(.76,FH*.8,.115,.07,'#d64545');
    bx(-.89,.2,.61,.215,FH*1.2,FH*1.45,'#d64545','basic');bx(-.3,.215,.3,.22,FH*1.26,FH*1.39,'#ffffff','basic');
    bx(-.25,.2,.25,.212,0,FH*.9,'#a9d3e6','glass');canopy(0,.212,.6,FH*.95,'#d64545');
    asph(.2,.25,.95,.97);amb(.45,.6);amb(.72,.62);
    asph(-.96,.3,-.36,.99);pkRow(-.93,-.39,.32,1,2);pkRow(-.93,-.39,.98,-1,2);tree3(.85,-.88,.07);return .8;},
  vaccin(r){   // centre de vaccination : pavillon blanc à bandeau bleu, seringue lumineuse, tente, file d'attente
    lawnB(1);bx(-.45,.08,.45,.48,0,.008,'#e3dccd');
    bc(-.08,-.18,.36,.24,0,FH*1.4,'#ffffff',FOf(),'#e6eef7');bx(-.45,-.43,.29,.07,FH*1.4,FH*1.4+.03,'#e3e6e8');bx(-.452,-.432,.292,.072,FH*1.4-.05,FH*1.4,'#3b8fdc');
    bx(-.3,.06,.1,.072,0,FH*.8,'#a9d3e6','glass');canopy(-.1,.072,.42,FH*.85,'#3b8fdc');
    bx(-.22,.06,.02,.075,FH*1.02,FH*1.17,'#3b8fdc','basic');bx(.02,.06,.08,.075,FH*1.07,FH*1.12,'#9aa0a6','basic');bx(-.26,.06,-.22,.075,FH*1.04,FH*1.15,'#3b8fdc','basic');
    for(const [x,z] of[[.2,-.08],[.44,-.08],[.2,.3],[.44,.3]])bc(x,z,.006,.006,0,.13,'#d0d0d0');gable(.18,-.1,.46,.32,.13,.09,'#ffffff',false,'#f2f4f6');
    for(let k=0;k<4;k++)bc(-.35+k*.1,.32,.006,.006,0,.07,'#59616a');bx(-.35,.317,-.05,.323,.06,.068,'#3b8fdc');
    tree3(-.4,.42,.06);tree3(.42,.43,.05);return .55;},
  pharma(r){   // pharmacie : vitrine verte en rez-de-chaussée, logements au-dessus, store, croix verte en drapeau
    bx(-.48,-.48,.48,.48,0,.005,'#e3dccd');
    bc(0,-.06,.4,.36,0,FH,'#2f9e5a',FSh(FH),'#2f9e5a');bc(0,-.06,.4,.36,FH,FH*2.6,'#efe6da',FRs(FH),'#d9cfc1');cornice(.8,.72,FH*2.6,'#f7f1e7',-.06);
    gable(-.42,-.44,.42,.32,FH*2.62,.18,'#6f6c78',true,'#efe6da');balc(-.25,.25,.3,FH*2,1);
    wedge(-.38,.3,.38,.42,FH*.75,FH*.95,FH*.8,'#3ddc84');
    bx(.38,.32,.4,.36,FH*1.4,FH*1.42,'#59616a');bx(.4,.33,.41,.37,FH*1.15,FH*1.65,'#3ddc84','basic');bx(.4,.29,.41,.41,FH*1.33,FH*1.47,'#3ddc84','basic');
    for(const x of[-.3,-.1])bc(x,.42,.035,.035,0,.05,'#8a6a4a');for(const x of[-.3,-.1])ico(x,.08,.42,.04,'#5aa84a');return FH*2.8;},
  dentenf(r){   // centre dentaire pour enfants : bâtiment pastel, tour ronde, dent géante sur le toit, aire de jeux
    lawnB(2);
    bx(-.88,-.85,.2,.15,0,FH*2,'#ffd6e0',FRs(),'#f5c2cf');bx(-.89,-.86,.21,.16,FH*2,FH*2+.03,'#e3e6e8');bx(-.892,-.862,.212,.162,FH*2-.06,FH*2,'#7ec8e3');
    cyl(.25,-.35,0,FH*2.4,.32,.32,16,'#7ec8e3');cyl(.25,-.35,FH*.9,FH*1.4,.322,.322,16,'#a9d3e6','#7ec8e3','glass');cyl(.25,-.35,FH*2.4,FH*2.4+.03,.34,.34,16,'#ffffff');
    const ty=FH*2+.04;ico(-.35,ty+.15,-.35,.09,'#ffffff');for(const x of[-.39,-.31])bc(x,-.35,.022,.022,ty,ty+.1,'#ffffff');
    canopy(-.5,.15,.36,FH*.85,'#7ec8e3');signB(-.5,.15,.34,FH*1.05,'#f2b134',.06);
    bx(-.9,.35,.3,.95,0,.01,'#f2d08a');fence(-.92,.33,.32,.97,.08,'#f2b134');
    bc(-.7,.45,.06,.05,0,.2,'#e63946');wedge(-.76,.5,-.64,.85,.0,.2,.02,'#f2b134');
    for(const x of[-.42,-.08])bc(x,.6,.008,.008,0,.25,'#3b8fdc');bx(-.42,.596,-.08,.604,.24,.25,'#3b8fdc');
    for(const x of[-.32,-.18]){bc(x,.6,.03,.012,.07,.08,'#e63946');for(const d of[-.025,.025])bc(x+d,.6,.002,.002,.08,.24,'#59616a');}
    bx(.0,.4,.25,.65,0,.03,'#e3c58a');tree3(.65,.65,.1);tree3(.8,.3,.08);return FH*2.6;},
  labo(r){   // laboratoire de prothèses : bâtiment technique à sheds, bande bleue, cheminées d'extraction, quai de livraison, parking
    bx(-.98,-.98,.98,.98,0,.006,'#c4bfb4');
    bx(-.92,-.88,.92,.12,0,FH*1.9,'#e9edf0',FOf(),'#cfd6dc');bx(-.93,-.89,.93,.13,FH*1.2,FH*1.35,'#2aa7d6');
    for(let k=0;k<4;k++){const z0=-.88+k*.25;wedge(-.92,z0,.4,z0+.25,FH*1.9,FH*1.9+.14,FH*1.9,'#d6dde3');bx(-.92,z0-.003,.4,z0+.004,FH*1.9,FH*1.9+.13,'#9fc9de','glass');}
    for(const x of[.55,.7,.85])cyl(x,-.6,FH*1.9,FH*1.9+.4,.045,.04,8,'#b9c1c6');
    bx(-.45,.12,.05,.132,0,FH*.95,'#a9d3e6','glass');canopy(-.2,.132,.5,FH*.95,'#2aa7d6');signB(-.2,.13,.42,FH*1.42,'#2aa7d6',.07);
    bx(.35,.12,.9,.3,0,.08,'#b9b4aa');for(const x of[.5,.75])bx(x-.09,.12,x+.09,.125,.08,.3,'#59616a');bc(.62,.48,.05,.11,.015,.14,'#ffffff');bc(.62,.6,.045,.02,.06,.12,'#2e3b47');
    asph(-.96,.26,-.5,.99);pkRow(-.93,-.52,.28,1,1);pkRow(-.93,-.52,.98,-1,1);return .78;},
  ortho(r){   // cabinet d'orthodontie : volume blanc + volume bois, sourire lumineux, haies, arbres
    lawnB(1);bx(-.08,.12,.08,.48,0,.008,'#e3dccd');
    bc(-.06,-.1,.32,.28,0,FH*2,'#f6f8f8',FOf(),'#e1e6e6');bx(-.39,-.39,.27,.19,FH*2,FH*2+.03,'#e3e6e8');bx(-.392,-.392,.272,.192,FH*2-.05,FH*2,'#2f6fd6');
    bx(.12,-.38,.4,.12,0,FH*2.25,'#c99a6b',FRs(),'#a77a52');
    bx(-.2,.18,.06,.19,0,FH*.85,'#a9d3e6','glass');canopy(-.07,.19,.3,FH*.85,'#2f6fd6');
    const y=FH*1.15;bx(-.3,.18,.0,.19,y,y+.2,'#2f6fd6');for(let k=0;k<7;k++){const a=Math.PI*(k/6),cx=-.15+Math.cos(a)*.08,cy=y+.13-Math.sin(a)*.06;bx(cx-.012,.19,cx+.012,.2,cy-.01,cy+.01,'#ffffff','basic');}
    hedge(-.46,.3,-.14,.36,.05);hedge(.14,.3,.46,.36,.05);tree3(-.38,.42,.06);tree3(.38,.42,.06);return .78;},
  balneo(r){   // balnéothérapie : bâtiment bois, halle vitrée en berceau, bassin extérieur chauffé, transats, parasols
    lawnB(2);
    bx(-.9,-.9,.0,-.1,0,FH*1.8,'#c99a6b',FRs(),'#a77a52');bx(-.91,-.91,.01,-.09,FH*1.8,FH*1.8+.03,'#e3e6e8');bx(-.912,-.912,.012,-.088,FH*1.8-.05,FH*1.8,'#0e8c87');
    bx(0,-.9,.9,-.1,0,.32,'#bfe3ea','glass');vault(0,-.92,.9,-.08,.32,.18,8,'#e8f4f6',false,'#d5ecf0');
    for(let k=0;k<4;k++){const z=-.82+k*.24;vault(-.005,z-.012,.905,z+.012,.32,.185,8,'#0e8c87',false);}
    bx(-.6,.05,.75,.72,0,.04,'#e3ddd2');bx(-.52,.13,.67,.64,.04,.046,'#4fc3e8','basic');
    for(let k=0;k<6;k++)transat(-.45+k*.2,.85);umb(-.75,.6,'#0e8c87');umb(.85,.3,'#f2b134');
    hedge(-.95,.93,.95,.97,.05);tree3(-.82,.2,.09);tree3(.88,.85,.07);return .7;},
  piste(r){   // piste d'athlétisme : ovale rouge à couloirs, terrain central, tribune, sautoir, haies, projecteurs
    lawnB(3);const R0=.68,R1=.95,L=.52,y=.008,RD='#c0392b',PI=Math.PI;
    bx(-L,-R1,L,-R0,0,y,RD);bx(-L,R0,L,R1,0,y,RD);annulus(L,0,R0,R1,-PI/2,PI/2,14,y,RD);annulus(-L,0,R0,R1,PI/2,PI*1.5,14,y,RD);
    bx(-L,-R0,L,R0,0,y,'#5fae4a');annulus(L,0,0,R0,-PI/2,PI/2,12,y,'#5fae4a');annulus(-L,0,0,R0,PI/2,PI*1.5,12,y,'#5fae4a');
    for(const rr of[.75,.82,.89]){bx(-L,-rr-.004,L,-rr+.004,y,y+.002,'#ffffff');bx(-L,rr-.004,L,rr+.004,y,y+.002,'#ffffff');annulus(L,0,rr-.004,rr+.004,-PI/2,PI/2,14,y+.002,'#ffffff');annulus(-L,0,rr-.004,rr+.004,PI/2,PI*1.5,14,y+.002,'#ffffff');}
    for(let k=0;k<3;k++)bx(-.9,1.05+k*.12,.9,1.17+k*.12,0,.06+k*.06,'#cfcac2',null,['#2f6fd6','#e9edf0','#2f6fd6'][k]);
    beam(0,.36,1.42,0,.3,1.02,1.9,.02,'#eef1f3');for(const x of[-.85,0,.85])bc(x,1.4,.012,.012,.2,.36,'#8d949b');
    bx(-.3,-1.38,.4,-1.18,0,.012,'#e3c58a');bx(-1.1,-1.31,-.3,-1.25,0,.011,RD);
    for(let k=0;k<4;k++){const x=-.35+k*.25;for(const z of[-.74,-.9])bc(x,z,.004,.004,y,.06,'#ffffff');bx(x-.004,-.9,x+.004,-.74,.05,.06,'#ffffff');}
    for(const [x,z] of[[-1.38,1.3],[1.38,1.3],[-1.38,-1.3],[1.38,-1.3]]){bc(x,z,.015,.015,0,1.0,'#8d949b');bc(x,z,.07,.03,1.0,1.08,'#fff6d5','basic');}
    return .5;},
  sportk(r){   // cabinet du sport : volume blanc à bandeau orange lumineux, pictogramme, couloir de course, vélos
    lawnB(1);bx(-.08,.12,.08,.48,0,.008,'#e3dccd');
    bc(0,-.1,.38,.28,0,FH*1.7,'#ffffff',FOf(),'#ececec');bx(-.39,-.39,.39,.19,FH*1.7,FH*1.7+.03,'#e3e6e8');bx(-.392,-.392,.392,.192,FH*1.7-.05,FH*1.7,'#f08c3a');bx(-.39,.18,.39,.192,FH*1.05,FH*1.18,'#f08c3a','basic');
    bx(-.2,.18,.1,.19,0,FH*.85,'#a9d3e6','glass');canopy(-.05,.19,.36,FH*.88,'#f08c3a');
    const y=FH*1.5;bx(.18,.18,.32,.19,y-.06,y+.08,'#f08c3a');ico(.25,y+.05,.195,.015,'#ffffff',1,'basic');bx(.24,.19,.26,.196,y-.03,y+.03,'#ffffff','basic');
    bx(.15,.25,.46,.45,0,.009,'#c0392b');for(let k=0;k<3;k++)cone(.2+k*.11,.35,.009,.05,.015,6,'#f08c3a');
    for(let k=0;k<4;k++)bc(-.4+k*.05,.3,.004,.03,0,.06,'#59616a');tree3(-.38,.42,.06);return .65;},
});
Object.assign(SVB,{
  // ── Monuments ──
  statue(r){   // statue du Kiné d'or : allée ronde, massif, socle à gradins avec plaque, statue dorée tenant une étoile
    lawnB(1);annulus(0,0,.22,.3,0,6.283,20,.008,'#e8dcc0');bx(-.05,.28,.05,.48,0,.008,'#e8dcc0');
    const F=['#f15bb5','#fee440','#ff9f1c'];for(let k=0;k<12;k++){const a=k/12*6.283;ico(Math.cos(a)*.18,.025,Math.sin(a)*.18,.025,F[k%3]);}
    bc(0,0,.15,.15,0,.04,'#d9d4cc');bc(0,0,.12,.12,.04,.08,'#e3ded6');bc(0,0,.08,.08,.08,.38,'#cfc8bd');bc(0,0,.095,.095,.38,.41,'#e3ded6');bx(-.045,.08,.045,.084,.17,.27,'#e3b23c');
    const g='#e3b23c',y=.41;
    bc(-.018,0,.012,.014,y,y+.13,g);bc(.018,0,.012,.014,y,y+.13,g);bc(0,0,.034,.02,y+.13,y+.24,g);ico(0,y+.28,0,.03,g);
    beam(-.03,y+.22,0,-.065,y+.37,0,.018,.018,g);beam(.03,y+.22,0,.05,y+.13,.02,.018,.018,g);ico(-.07,y+.4,0,.026,'#ffd34d',1,'basic');
    lamp(-.33,.33);lamp(.33,.33);tree3(-.33,-.33,.09);tree3(.33,-.33,.09);return .85;},
  fac(r){   // faculté : plan en U néoclassique, portique, coupole verte à lanterne, cour d'honneur, vélos
    lawnB(3);const wl='#efe6d6',rf='#5e6b78',H=FH*3;
    bx(-.75,-1.35,.75,-.45,0,H+.06,wl,FRs(),null);gable(-.79,-1.39,.79,-.41,H+.06,.3,rf,true,wl);
    bx(-1.42,-1.42,-.75,.55,0,H,wl,FRs(),null);gable(-1.46,-1.46,-.71,.59,H,.28,rf,false,wl);
    bx(.75,-1.42,1.42,.55,0,H,wl,FRs(),null);gable(.71,-1.46,1.46,.59,H,.28,rf,false,wl);
    for(const x of[-1.085,1.085])bx(x-.34,-1.43,x+.34,.56,FH-.02,FH,'#f7f2e8');
    bx(-.5,-.45,.5,-.15,0,.06,'#e2d9c8');bx(-.46,-.15,.46,-.08,0,.03,'#e2d9c8');for(let k=0;k<6;k++)cyl(-.42+k*.168,-.22,.06,H,.034,.034,10,'#f7f2e8');
    bx(-.52,-.47,.52,-.13,H,H+.06,'#e9e1d2');gable(-.52,-.47,.52,-.13,H+.06,.18,'#e9e1d2',true,'#f3ede2');bx(-.4,-.131,.4,-.125,H+.005,H+.05,'#0e8c87','basic');
    cyl(0,-.9,H+.2,H+.5,.32,.32,16,'#e6dccb');for(let k=0;k<12;k++){const a=k/12*6.283;bc(Math.cos(a)*.325,-.9+Math.sin(a)*.325,.02,.02,H+.26,H+.44,'#9fb3c2');}
    cyl(0,-.9,H+.5,H+.53,.35,.35,16,'#f3ede2');dome(0,-.9,H+.53,.33,16,'#3f9a8a');cyl(0,-.9,H+.85,H+.97,.05,.05,8,'#f3ede2');cone(0,-.9,H+.97,.1,.06,8,'#3f9a8a');
    bx(-.75,-.12,.75,1.0,0,.007,'#7fc46c');bx(-.08,-.12,.08,1.48,0,.009,'#e8dcc0');bx(-.75,.42,.75,.5,0,.009,'#e8dcc0');
    bc(0,.46,.06,.06,0,.12,'#cfc8bd');bc(0,.46,.02,.02,.12,.26,'#e3b23c');ico(0,.29,.46,.03,'#e3b23c');
    for(const z of[0,.3,.7,.95])for(const x of[-.6,.6])tree3(x,z,.08);
    bench(-.35,.62,true);bench(.35,.62,true);for(let k=0;k<6;k++)bc(.95+k*.07,.85,.004,.03,0,.06,'#59616a');
    for(const x of[-1.1,1.1])tree3(x,1.1,.11);lamp(-.2,1.2);lamp(.2,1.2);return H+1.0;},
  reeduc(r){   // centre de rééducation : bâtiment de soins à bandeau bois, balnéo vitrée, bassin extérieur, parcours de marche, parking
    lawnB(3);
    bx(-1.42,-1.42,.25,-.35,0,FH*3,'#f2f5f4',FOf(),'#d7e3e1');bx(-1.43,-1.43,.26,-.34,FH*3,FH*3+.03,'#eef3f2');bx(-1.43,-.352,.26,-.34,FH*1.95,FH*2.05,'#c99a6b');
    bx(-1.2,-1.2,0,-.6,FH*3+.03,FH*3+.045,'#7fbf5a');for(let k=0;k<5;k++)bx(-1.15+k*.25,-1.25,-1.13+k*.25,-.55,FH*3+.25,FH*3+.27,'#c99a6b');for(const [x,z] of[[-1.15,-1.25],[-.15,-1.25],[-1.15,-.55],[-.15,-.55]])bc(x,z,.01,.01,FH*3+.03,FH*3+.25,'#c99a6b');
    bx(.25,-1.42,1.42,-.4,0,.42,'#bfe3ea','glass');vault(.25,-1.44,1.42,-.38,.42,.22,8,'#e8f4f6',true,'#d5ecf0');
    canopy(-.6,-.35,.5,FH*.95,'#14b8a6');cross(-1.1,FH*2.55,-.335,.1,'#14b8a6');signB(-.6,-.34,.46,FH*1.15,'#14b8a6',.07);
    bx(.4,-.25,1.35,.35,0,.04,'#e3ddd2');bx(.47,-.18,1.28,.28,.04,.046,'#4fc3e8','basic');for(let k=0;k<4;k++)transat(.55+k*.22,.43);
    const PA='#e3dccd';bx(-1.35,.05,-.1,.13,0,.008,PA);bx(-1.35,1.25,-.1,1.33,0,.008,PA);bx(-1.35,.05,-1.27,1.33,0,.008,PA);bx(-.18,.05,-.1,1.33,0,.008,PA);
    for(let k=0;k<4;k++)bx(-1.0+k*.06,.02,-.94+k*.06,.16,0,.03+k*.03,'#d9d4cc');for(let k=0;k<4;k++)bx(-.76+k*.06,.02,-.7+k*.06,.16,0,.12-k*.03,'#d9d4cc');
    wedge(-1.38,.4,-1.24,.75,0,.0,.09,'#cfd5da');
    for(const z of[.9,1.0])bx(-.9,z-.004,-.45,z+.004,.1,.11,'#c99a6b');for(const x of[-.88,-.47])for(const z of[.9,1.0])bc(x,z,.005,.005,0,.1,'#c99a6b');
    bench(-.7,.55,true);bench(-.4,.6,true);for(const [x,z] of[[-.55,1.15],[-.95,.6],[-.3,.35]])tree3(x,z,.1);
    asph(.3,.5,1.46,1.46);pkRow(.33,1.43,.52,1,2);pkRow(.33,1.43,1.44,-1,2);bc(.0,.3,.05,.1,.015,.12,'#ffffff');bx(-.05,.3,.05,.32,.12,.13,'#14b8a6','basic');
    return FH*3+.3;},
  pool(r){   // piscine olympique : halle vitrée sous grand toit en berceau à arcs bleus, bassin 50 m à lignes d'eau, plongeoir, plage
    bx(-1.48,-1.48,1.48,1.48,0,.006,'#e9e4da');
    bx(-1.42,-1.42,1.42,-.15,0,.5,'#bcdcea',FOf(),'#a9cfe0');vault(-1.44,-1.44,1.44,-.13,.5,.38,10,'#f2f5f7',true,'#dce9f0');
    for(let k=0;k<7;k++){const x=-1.3+k*.433;vault(x-.02,-1.46,x+.02,-.11,.5,.39,10,'#2e86ab',true);}
    canopy(0,-.15,.8,FH*.95,'#2e86ab');signB(0,-.13,.6,FH*1.15,'#2e86ab',.07);
    bx(-1.3,.1,.95,.95,.006,.05,'#dfe9ee');bx(-1.24,.16,.89,.89,.05,.054,'#3fb7e3','basic');
    for(let k=1;k<6;k++){const z=.16+k*.1217;bx(-1.24,z-.004,.89,z+.004,.054,.058,k%2?'#ffffff':'#f2c14e','basic');}
    bc(1.2,.5,.05,.07,0,.75,'#e9eef2');for(const h of[.3,.5,.72])bx(.96,.47,1.16,.53,h,h+.016,'#2e86ab');bx(1.12,.42,1.15,.58,.75,.8,'#9aa0a6');
    for(let k=0;k<7;k++)transat(-1.15+k*.3,1.15);umb(-1.0,1.35,'#e4572e');umb(-.3,1.35,'#2e86ab');umb(.4,1.35,'#f2b134');
    tree3(1.3,1.3,.1);tree3(1.32,.0,.08);return .95;},
  stadium(r){   // stade : pelouse rayée et tracée, tribunes à gradins colorés, toits suspendus, mâts d'éclairage, écran géant, entrées
    bx(-1.98,-1.98,1.98,1.98,0,.006,'#cfcac2');
    for(let k=0;k<10;k++){const x0=-1.3+k*.26;bx(x0,-.9,x0+.26,.9,.006,.01,k%2?'#5fae4a':'#6cbc55');}
    const L=(a,b,c,d)=>bx(a,b,c,d,.01,.013,'#ffffff');
    L(-1.22,-.84,1.22,-.82);L(-1.22,.82,1.22,.84);L(-1.22,-.84,-1.2,.84);L(1.2,-.84,1.22,.84);L(-.01,-.84,.01,.84);annulus(0,0,.19,.21,0,6.283,20,.013,'#ffffff');
    for(const s of[-1,1]){const x=s*1.21,xi=s*1.0;L(Math.min(x,xi),-.36,Math.max(x,xi),-.34);L(Math.min(x,xi),.34,Math.max(x,xi),.36);L(xi-.01,-.36,xi+.01,.36);
      const xg=s*1.25;bc(xg,-.12,.006,.006,.01,.1,'#ffffff');bc(xg,.12,.006,.006,.01,.1,'#ffffff');bx(xg-.006,-.12,xg+.006,.12,.094,.1,'#ffffff');}
    const SEAT=['#2f6fd6','#e9edf0'],CON='#cfcac2';
    for(const s of[-1,1])for(let k=0;k<6;k++){const z0=s>0?1.0+k*.12:-(1.0+(k+1)*.12);bx(-1.45,z0,1.45,z0+.12,0,.12+k*.11,CON,null,SEAT[(k+(s>0?0:1))%2]);}
    for(const s of[-1,1])for(let k=0;k<4;k++){const x0=s>0?1.42+k*.12:-(1.42+(k+1)*.12);bx(x0,-1.72,x0+.12,1.72,0,.12+k*.11,CON,null,SEAT[k%2]);}
    for(const s of[-1,1]){const zw=s*1.76;bx(-1.5,zw-.04,1.5,zw+.04,0,.8,'#b9b4ab',FOf(),'#a9a49b');bx(-1.51,zw-.05,1.51,zw+.05,.55,.62,'#2f6fd6');
      beam(0,.98,s*1.82,0,.9,s*.95,3.1,.03,'#eef1f3');for(const x of[-1.3,-.45,.45,1.3])bc(x,s*1.79,.015,.015,.8,.97,'#8d949b');}
    for(const s of[-1,1]){bx(s*1.95-.03,-1.75,s*1.95+.03,1.75,0,.5,'#b9b4ab');}
    bx(-1.96,-.4,-1.89,.4,.5,.85,'#1f2933');bx(-1.89,-.36,-1.885,.36,.54,.81,'#2f9bd6','basic');
    for(const [x,z] of[[-1.85,-1.85],[1.85,-1.85],[-1.85,1.85],[1.85,1.85]]){bc(x,z,.03,.03,0,1.55,'#8d949b');bc(x,z,.1,.1,1.55,1.6,'#8d949b');bc(x-Math.sign(x)*.02,z-Math.sign(z)*.02,.09,.09,1.6,1.7,'#fff6d5','basic');}
    for(const x of[-.9,0,.9])bx(x-.12,1.8,x+.12,1.805,0,.22,'#2b3240');for(const x of[-1.4,-.45,.45,1.4])flag(x,1.92,.55);
    return 1.7;},
  tower(r){   // tour Kiné+ : socle commercial, quatre tronçons vitrés à arêtes blanches et bandeaux lumineux, terrasses plantées, couronne, flèche
    bx(-.98,-.98,.98,.98,0,.006,'#e3ddd2');
    bc(0,0,.9,.9,0,FH*2,'#d5dbe0',FSh(FH*2),'#c3cad0');bc(0,0,.92,.92,FH*2,FH*2+.04,'#eef1f3');canopy(0,.9,1.0,FH*.9,'#2b3a46');
    let w=.62,y=FH*2+.04;const segs=[10,9,8,6];
    segs.forEach((n,k)=>{const y1=y+n*FH;bc(0,0,w,w,y,y1,'#7fc6d1',FOf(y),'#6bb8b7');
      for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]])bc(a*(w-.02),b*(w-.02),.035,.035,y,y1,'#eef4f6');
      bx(-w-.012,-w-.012,w+.012,w+.012,y1-.05,y1,'#2dd4bf','basic');
      if(k<segs.length-1){const w2=w*.82;bx(-w,-w,w,w,y1,y1+.012,'#7fbf5a');for(const [a,b] of[[-1,-1],[1,1],[1,-1]])treeY(a*(w2+(w-w2)/2),b*(w2+(w-w2)/2),y1+.012,.045);}
      y=y1;w*=.82;});
    for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]])bc(a*w*.8,b*w*.8,.02,.02,y,y+.55,'#e8f6f6');bx(-w*.8,-w*.8,w*.8,w*.8,y+.5,y+.55,'#2dd4bf','basic');
    bc(0,0,w*.6,w*.6,y,y+.3,'#e8f6f6',FOf(y));bx(-.2,w*.6,.2,w*.6+.01,y+.06,y+.24,'#0e8c87','basic');
    bc(0,0,.025,.025,y+.3,y+1.6,'#c9d6d9');bc(0,0,.04,.04,y+1.6,y+1.68,'#ff4b4b','basic');
    for(const [x,z] of[[-.8,.8],[.8,.8]]){bc(x,z,.07,.07,0,.06,'#bfb6a6');tree3(x,z,.08);}return y+1.7;},
  chu(r){   // CHU : socle des plateaux techniques, deux tours, passerelle vitrée, héliport, hall, urgences et ambulances, grand parking
    lawnB(4);
    bx(-1.9,-1.9,1.9,.3,0,FH*2,'#eef2f5',FOf(),'#d6dde3');bx(-1.91,-1.91,1.91,.31,FH*2,FH*2+.03,'#ffffff');roofKit(r,-1.2,-.3,1,.8,FH*2+.03);
    bx(-1.6,-1.7,-.35,-.5,FH*2,FH*9,'#f6f8fa',FOf(FH*2),'#dce2e7');bx(-1.61,-1.71,-.34,-.49,FH*9,FH*9+.03,'#ffffff');roofKit(r,-.98,-1.1,1.1,1.0,FH*9+.03);
    bx(.2,-1.75,1.65,-.75,FH*2,FH*11,'#f6f8fa',FOf(FH*2),'#dce2e7');bx(.19,-1.76,1.66,-.74,FH*11,FH*11+.03,'#ffffff');
    for(const x of[.42,1.43])bx(x-.06,-.752,x+.06,-.74,FH*2,FH*11,'#3b7fc4');for(const x of[-1.38,-.57])bx(x-.06,-.502,x+.06,-.49,FH*2,FH*9,'#3b7fc4');
    bx(-.35,-1.3,.2,-1.0,FH*6,FH*7,'#a9d3e6','glass');
    const hy=FH*11+.03;cyl(.92,-1.25,hy,hy+.04,.45,.45,20,'#4a5058','#4a5058');bx(.83,-1.37,.87,-1.13,hy+.04,hy+.046,'#ffffff','basic');bx(.97,-1.37,1.01,-1.13,hy+.04,hy+.046,'#ffffff','basic');bx(.87,-1.27,.97,-1.23,hy+.04,hy+.046,'#ffffff','basic');
    for(let k=0;k<10;k++){const a=k/10*6.283;bc(.92+Math.cos(a)*.42,-1.25+Math.sin(a)*.42,.012,.012,hy+.04,hy+.055,'#f2c14e','basic');}
    cross(-.98,FH*8.2,-.49,.16,'#e63946');cross(.92,FH*10.2,-.74,.16,'#e63946');
    bx(-.6,.3,.6,.6,0,FH*1.3,'#a9d3e6','glass');bx(-.65,.3,.65,.65,FH*1.3,FH*1.3+.03,'#ffffff');signB(0,.65,.7,FH*1.36,'#2f6fd6',.09);
    asph(.75,.31,1.95,1.95);bx(.8,.3,1.85,.75,FH,FH+.025,'#e63946');for(const x of[.82,1.83])bc(x,.72,.012,.012,0,FH,'#e3e6e9');signB(1.32,.75,.6,FH*1.05,'#e63946',.07);
    amb(1.05,.95);amb(1.35,.98);amb(1.65,1.4);
    asph(-1.95,.75,.55,1.95);pkRow(-1.9,.5,.77,1,2);pkRow(-1.9,.5,1.35,-1,2);pkRow(-1.9,.5,1.37,1,2);pkRow(-1.9,.5,1.94,-1,2);
    for(const x of[-1.35,-.35])tree3(x,1.36,.07);tree3(1.8,-1.8,.1);tree3(-1.8,.55,.08);return FH*11+.2;},
  observ(r){   // observatoire : butte, coupole à fente, petite coupole, radiotélescope, centre des visiteurs, escalier
    lawnB(3);
    cyl(-.1,-.3,0,.12,1.05,.85,20,'#86c96a','#8fcf6e');
    cyl(-.1,-.3,.12,.7,.5,.5,20,'#f1efe9');cyl(-.1,-.3,.36,.42,.505,.505,20,'#9fc0d6','#f1efe9','glass');cyl(-.1,-.3,.7,.74,.54,.54,20,'#dcd8cf');dome(-.1,-.3,.74,.52,20,'#eef1f4',1,'#2b3240');
    bx(-.22,.55,.02,1.48,0,.008,'#e8dcc0');for(let k=0;k<4;k++)bx(-.22,.2+k*.09,.02,.29+k*.09,0,.12-k*.03,'#d9d4cc');
    cyl(.95,.75,0,.3,.24,.24,16,'#f1efe9');dome(.95,.75,.3,.24,16,'#eef1f4',1,'#2b3240');
    bc(.95,-.85,.08,.08,0,.18,'#d9d4cc');cyl(.95,-.85,.18,.4,.05,.04,8,'#e3e6e9');cyl(.95,-.85,.4,.52,.06,.42,18,'#f6f7f8','#dde2e6');
    for(const a of[0,2.1,4.2])beam(.95+Math.cos(a)*.3,.5,-.85+Math.sin(a)*.3,.95,.85,-.85,.015,.015,'#cfd3d6');ico(.95,.86,-.85,.035,'#cfd3d6');
    bx(-1.42,.55,-.55,1.25,0,.35,'#e3e9ee',FOf(),'#c9d3da');cyl(-.98,.9,.35,.38,.26,.26,14,'#cfd6dc');dome(-.98,.9,.38,.24,14,'#5b4a8b');
    bx(-.55,.8,-.22,1.0,0,.008,'#e8dcc0');
    for(const [x,z] of[[1.3,1.3],[1.3,.1],[-1.3,-1.3],[.6,1.3],[-1.3,1.4]])tree3(x,z,.1,(x+z)>1);lamp(-.3,1.0);lamp(.1,1.0);return 1.4;},
  arc(r){   // arc du Diplôme : arc en plein cintre, arcs latéraux, colonnes, reliefs, corniche, attique doré, diplôme géant, flamme
    bx(-.98,-.98,.98,.98,0,.006,'#e3ddd2');annulus(0,0,.82,.9,0,6.283,28,.008,'#cfc6b4');
    const c='#efe2c6',d='#e2d3b2',H=1.55;
    for(const s of[-1,1]){const a=s<0?-.8:.32,b=s<0?-.32:.8;bx(a,-.32,b,-.12,0,1.0,c,null,d);bx(a,.12,b,.32,0,1.0,c,null,d);bx(a,-.12,b,.12,.55,1.0,c,null,d);}
    bx(-.8,-.32,.8,.32,1.0,H,c,null,d);
    for(let k=0;k<8;k++){const x0=-.32+k*.08,xm=x0+.04,yc=.66+Math.sqrt(Math.max(0,.1024-xm*xm));bx(x0,-.32,x0+.08,.32,yc,1.0,c);}
    for(const zf of[-1,1])for(const x of[-.75,-.37,.37,.75])cyl(x,zf*.335,0,1.12,.026,.026,8,'#f6ecd6');
    for(const zf of[-1,1])for(const s of[-1,1])bx(s>0?.42:-.7,zf>0?.32:-.335,s>0?.7:-.42,zf>0?.335:-.32,.25,.6,'#f6ecd6');
    bx(-.84,-.36,.84,.36,1.12,1.17,'#f6ecd6');bx(-.6,.32,.6,.335,1.25,1.42,'#e3b23c');bx(-.6,-.335,.6,-.32,1.25,1.42,'#e3b23c');
    bx(-.5,-.15,.5,.15,H,H+.03,'#e3b23c');tube(-.45,H+.12,0,.45,H+.12,0,.09,12,'#f7f3ea');tube(-.07,H+.12,0,.07,H+.12,0,.097,12,'#d62828');
    beam(-.03,H+.12,.09,-.06,H+.01,.14,.03,.006,'#d62828');beam(.03,H+.12,.09,.06,H+.01,.14,.03,.006,'#d62828');ico(0,H+.12,.1,.035,'#e3b23c');
    cyl(0,0,0,.05,.08,.08,10,'#8d949b');cone(0,0,.05,.12,.04,6,'#ff9f1c','basic');
    flag(-.9,.75,.9);flag(.9,.75,.9);for(const [x,z] of[[-.7,.75],[.7,.75],[-.7,-.75],[.7,-.75]])lamp(x,z);return H+.3;},
  duelstatue(r){   // statue du duel : socle de marbre, coupe dorée à anses, épées croisées, laurier
    lawnB(1);annulus(0,0,.24,.32,0,6.283,18,.008,'#e8dcc0');bx(-.05,.3,.05,.48,0,.008,'#e8dcc0');
    for(let k=0;k<14;k++){const a=k/14*6.283;ico(Math.cos(a)*.2,.03,Math.sin(a)*.2,.03,'#4f9a45');}
    bc(0,0,.17,.17,0,.05,'#d9d4cc');bc(0,0,.12,.12,.05,.32,'#f2f2f0');bc(0,0,.14,.14,.32,.35,'#d9d4cc');bx(-.05,.12,.05,.124,.15,.24,'#c9a227');
    const g='#d9b13a',y=.35;cyl(0,0,y,y+.03,.07,.07,12,g);cyl(0,0,y+.03,y+.08,.025,.02,8,g);cyl(0,0,y+.08,y+.22,.03,.1,14,g,'#b8921f');
    for(const s of[-1,1])beam(s*.08,y+.19,0,s*.13,y+.12,0,.015,.015,g);
    beam(-.1,.06,.14,.1,.3,.14,.012,.004,'#d4d4d4');beam(.1,.06,.14,-.1,.3,.14,.012,.004,'#d4d4d4');
    lamp(-.36,.36);lamp(.36,.36);tree3(-.36,-.36,.08);tree3(.36,-.36,.08);return .7;},
});
Object.assign(SVB,{
  // ── Transports ──
  bus(r){   // abribus : quai et bande podotactile, abri vitré, panneau publicitaire lumineux, banc, poteau d'arrêt, poubelle
    bx(-.48,-.2,.48,.25,0,.02,'#d6d2ca');bx(-.48,.21,.48,.25,0,.021,'#f2c14e');
    for(const x of[-.28,.28])for(const z of[-.13,.03])bc(x,z,.008,.008,.02,.26,'#3d4650');
    bx(-.28,-.14,.28,-.125,.04,.25,'#bfe3f0');bx(-.285,-.13,-.27,.03,.04,.25,'#bfe3f0');
    bx(.27,-.12,.285,.03,.05,.24,'#ffffff','basic');bx(.285,-.11,.29,.02,.07,.22,'#14b8a6','basic');
    wedge(-.32,-.17,.32,.07,.26,.29,.27,'#4a5560');bench(0,-.08,true);
    bc(.4,.12,.01,.01,.02,.42,'#59616a');bc(.4,.12,.055,.01,.33,.42,'#2f6fd6','basic');bx(.37,.13,.43,.132,.355,.39,'#ffffff','basic');
    bc(-.4,.1,.02,.02,.02,.1,'#3f7f4a');tree3(-.38,-.36,.07);return .42;},
  metro(r){   // station de métro : bâtiment voyageurs vitré, trémie d'escalier, auvent de verre, totem « M », vélos en libre-service
    bx(-.98,-.98,.98,.98,0,.006,'#e3ddd2');
    bx(-.92,-.9,.1,-.15,0,.42,'#eef1f3',FOf(),'#cfd6dc');bx(-.93,-.91,.11,-.14,.42,.45,'#2b3a46');bx(-.75,-.15,-.05,-.138,.02,.36,'#a9d3e6','glass');
    bx(.2,-.35,.62,.45,.006,.01,'#3a4048');for(let k=0;k<8;k++)bx(.24,-.3+k*.09,.58,-.26+k*.09,.01,.012,'#6b737c');
    for(const x of[.2,.62]){bx(x-.006,-.35,x+.006,.45,.01,.12,'#bfe3f0');bx(x-.008,-.35,x+.008,.45,.12,.13,'#59616a');}bx(.2,-.36,.62,-.348,.01,.13,'#bfe3f0');
    for(const [x,z] of[[.16,-.38],[.66,-.38],[.16,.06],[.66,.06]])bc(x,z,.01,.01,0,.35,'#59616a');
    beam(.41,.37,-.42,.41,.35,.08,.58,.02,'#a9d3e6');
    bc(.85,.75,.012,.012,0,.6,'#59616a');bc(.85,.75,.07,.07,.6,.74,'#e63946','basic');
    for(const x of[.8,.885])bx(x,.82,x+.015,.825,.62,.72,'#ffffff','basic');for(const x of[.82,.86])bx(x,.82,x+.02,.825,.67,.71,'#ffffff','basic');
    bx(-.85,.35,-.2,.4,0,.02,'#59616a');for(let k=0;k<6;k++)bc(-.8+k*.11,.46,.006,.06,.02,.07,'#2f9e8f');
    bx(-.85,.65,-.45,.9,0,.02,'#8d949b');tree3(-.25,.75,.09);tree3(.35,.8,.08);bench(-.6,.0,true);return .75;},
  gare(r){   // gare : voies et ballast, deux quais abrités, passerelle, bâtiment voyageurs à verrières en arc, horloge, marquise, parvis
    bx(-1.48,-1.48,1.48,1.48,0,.006,'#cfcac2');const wl='#efe3cc',rf='#5e6b78';
    bx(-1.5,-1.04,1.5,-.76,.006,.014,'#9a948a');for(let k=0;k<14;k++)bx(-1.45+k*.21,-1.02,-1.39+k*.21,-.78,.014,.02,'#7a5f48');
    for(const z of[-.98,-.82])bx(-1.5,z-.012,1.5,z+.012,.02,.035,'#6d6a66');   /* le train arrive et repart (stepTrains, z = -0,9) */
    for(const [z0,z1,ze] of[[-.74,-.6,-.75],[-1.2,-1.06,-1.07]]){bx(-1.45,z0,1.45,z1,0,.06,'#d9d4cc');bx(-1.45,ze,1.45,ze+.02,.06,.062,'#f2c14e');
      const zc=(z0+z1)/2;for(const x of[-1.1,-.4,.3,1.0])bc(x,zc,.012,.012,.06,.4,'#59616a');beam(0,.43,zc-.1,0,.4,zc+.1,2.6,.025,'#e9eef2');}
    bx(1.1,-1.18,1.22,-.62,.62,.66,'#8d949b');bx(1.1,-1.18,1.106,-.62,.66,.73,'#bfe3f0');bx(1.214,-1.18,1.22,-.62,.66,.73,'#bfe3f0');
    for(const z of[-1.15,-.65])bc(1.16,z,.07,.05,.06,.74,'#cfd5da');
    bx(-1.3,-.35,1.3,.5,0,FH*2.2,wl,FRs(),null);gable(-1.34,-.39,1.34,.54,FH*2.2,.3,rf,true,wl);cornice(2.6,.85,FH*2.2-.03,'#f6ecd6',.075);
    for(const x of[-.85,-.45,.45,.85]){bx(x-.12,.5,x+.12,.512,.04,.42,'#9fc9de','glass');for(let k=0;k<5;k++){const xm=x-.1+k*.05,yc=.42+Math.sqrt(Math.max(0,.0144-(xm-x)*(xm-x)));bx(xm-.025,.5,xm+.025,.512,.42,yc,'#9fc9de','glass');}}
    bc(0,.6,.24,.18,0,1.65,wl,FRs());cone(0,.6,1.65,.38,.33,4,rf);bx(-.1,.78,.1,.79,1.25,1.45,'#ffffff','basic');bx(-.004,.79,.004,.795,1.35,1.43,'#2b2b2b');bx(-.004,.79,.05,.795,1.346,1.354,'#2b2b2b');
    bx(-1.2,.5,1.2,.7,FH*.95,FH*.95+.025,'#3b4a56');for(const x of[-1.15,1.15])bc(x,.68,.01,.01,0,FH*.95,'#3b4a56');
    asph(-1.48,.75,1.48,1.48);pkRow(-1.4,-.27,.77,1,2);pkRow(.27,1.4,.77,1,2);for(let k=0;k<8;k++)bx(-1.35+k*.36,1.18,-1.2+k*.36,1.2,.006,.008,'#ffffff');
    car3(-.1,1.32,true,'#f6c90e');car3(.25,1.32,true,'#f6c90e');tree3(-1.38,1.38,.08);tree3(1.38,1.38,.08);return 2.05;},
  tramstop(r){   // arrêt de tram : quai surélevé, abri vitré, distributeur de billets, totem, poteau de caténaire
    bx(-.46,-.12,.46,.2,0,.035,'#d6d2ca');bx(-.46,.16,.46,.2,.035,.037,'#f2c14e');
    for(const x of[-.34,.34])bc(x,-.08,.01,.01,.035,.33,'#3d4650');bx(-.34,-.095,.34,-.085,.06,.3,'#bfe3f0');wedge(-.42,-.16,.42,.14,.32,.35,.33,'#2f9e8f');
    bench(0,-.04,true);bc(.28,.06,.03,.02,.035,.2,'#e9eef2');bx(.255,.08,.305,.082,.13,.18,'#3ddc84','basic');
    bc(-.3,.06,.015,.015,.035,.4,'#59616a');bc(-.3,.06,.04,.012,.33,.43,'#e63946','basic');
    bc(.44,-.18,.012,.012,0,.62,'#59616a');bx(.0,-.19,.44,-.17,.58,.6,'#59616a');return .45;},
  // ── Loisirs ──
  cinema(r){   // multiplexe : boîte sombre à bandes LED, hall vitré, marquise à ampoules, enseigne verticale, affiches, tapis rouge
    bx(-.98,-.98,.98,.98,0,.006,'#e3ddd2');
    bx(-.92,-.92,.92,.15,0,.95,'#3d3550',null,'#2f2940');for(const y of[.22,.5,.78])bx(-.93,-.93,.93,.16,y,y+.02,'#b14aed','basic');
    bx(-.6,.15,.6,.165,.02,.36,'#ffd9a0','glass');
    bx(-.7,.15,.7,.45,.38,.46,'#f4f4f4');bx(-.7,.449,.7,.453,.39,.45,'#ffd23f','basic');for(let k=0;k<14;k++)bx(-.66+k*.1,.44,-.64+k*.1,.452,.37,.38,'#fff3c4','basic');
    for(let k=0;k<6;k++)bx(-.4+k*.14,.453,-.32+k*.14,.457,.405,.435,'#e63946','basic');
    for(const [x,c] of[[-.82,'#2e86ab'],[.82,'#e4572e']])bx(x-.07,.15,x+.07,.162,.08,.32,c,'basic');
    bx(.82,.15,.9,.24,.5,1.22,'#e63946','basic');for(let k=0;k<5;k++)bx(.83,.24,.89,.244,.56+k*.13,.64+k*.13,'#ffffff','basic');
    bx(-.12,.17,.12,.98,0,.009,'#c62828');
    bc(.6,.7,.08,.08,0,.18,'#ffffff');cone2(.6,.7,.18,.1,.12,8,'#e63946','#ffffff');
    asph(-.96,.5,-.28,.99);pkRow(-.93,-.31,.52,1,2);return 1.25;},
  marina(r,s){   // port de plaisance, tourné vers l'eau : promenade, capitainerie à vigie vitrée, pontons et catways, voiliers et vedettes
    const k0=toWater(s);
    bx(-.98,-.98,.98,.98,0,.008,'#e3d6bd');bx(-.98,.9,.98,.98,0,.05,'#b9b2a5');
    bx(-.42,-.8,.32,-.2,0,FH*1.6,'#f4f6f8',FRs(),'#e2e6ea');bx(-.43,-.81,.33,-.19,FH*1.6,FH*1.6+.03,'#3b6fb0');
    bc(.12,-.5,.13,.13,FH*1.6+.03,FH*2.6,'#a9d3e6','glass');cyl(.12,-.5,FH*2.6,FH*2.6+.03,.17,.17,8,'#3b6fb0');cone(.12,-.5,FH*2.6+.03,.1,.15,8,'#3b6fb0');
    bc(-.7,-.6,.006,.006,0,.8,'#d0d0d0');bx(-.694,-.6,-.6,-.596,.7,.78,'#e63946');
    for(const x of[-.6,0,.6]){bx(x-.05,.9,x+.05,1.65,.01,.05,'#a8865e');for(let k=0;k<3;k++){const z=1.05+k*.22;bx(x+.05,z-.02,x+.25,z+.02,.01,.04,'#a8865e');}for(const z of[1.2,1.6])bc(x,z,.012,.012,-.1,.08,'#6b5238');}
    const G0=G('plain'),boat=(x,z,sail,col)=>{bc(x,z,.05,.12,-.05,.03,'#ffffff');bc(x,z,.045,.11,.03,.04,col);bc(x,z-.02,.03,.05,.04,.08,'#f4f6f8');
      if(sail){bc(x,z+.02,.005,.005,.08,.56,'#c9c9c9');const a=V(x,.1,z+.03),b=V(x,.1,z+.13),c=V(x,.52,z+.03),w=CC('#f8f8f8');tri(G0,a,b,c,w);tri(G0,a,c,b,w);bx(x-.004,z+.03,x+.004,z+.15,.09,.1,'#c9c9c9');}
      else bx(x-.035,z-.08,x+.035,z-.06,.04,.1,'#2b3a46');};
    boat(.15,1.1,true,'#2e86ab');boat(.15,1.45,false,'#e4572e');boat(-.45,1.15,true,'#3fa34d');boat(.75,1.3,true,'#f2b134');boat(-.45,1.52,false,'#ffffff');
    bench(-.7,.6,true);bench(.6,.6,true);lamp(-.3,.82);lamp(.3,.82);tree3(-.82,-.85,.08);tree3(.82,-.8,.09);umb(.62,-.4,'#2e86ab');umb(.82,-.15,'#ffffff');
    TX.k=k0;return .9;},
  wheel(r){   // grande roue : plateforme d'embarquement, pieds en A, axe, guichet, files d'attente, parasols
    bx(-.98,-.98,.98,.98,0,.006,'#e3ddd2');
    bc(0,0,.62,.3,0,.08,'#d9d4cc');bx(-.3,.3,.3,.45,0,.04,'#cfc8bd');
    for(const sz of[-1,1]){beam(-.55,0,sz*.15,0,1.2,sz*.15,.05,.05,'#8d949b');beam(.55,0,sz*.15,0,1.2,sz*.15,.05,.05,'#8d949b');beam(-.31,.55,sz*.15,.31,.55,sz*.15,.03,.03,'#8d949b');}
    bc(0,0,.05,.2,1.15,1.25,'#6d7378');
    if(CUR){const p=V(0,1.2,0);CUR.wh.push(p[0],p[1],p[2],TX.k,1);}
    bc(.65,.62,.12,.1,0,.2,'#e63946');wedge(.5,.5,.8,.74,.2,.26,.22,'#ffffff');bx(.6,.72,.7,.722,.08,.16,'#ffd9a0','glass');
    for(const z of[.6,.75]){for(let k=0;k<5;k++)bc(-.6+k*.1,z,.005,.005,0,.08,'#59616a');bx(-.6,z-.002,-.2,z+.002,.07,.08,'#e63946');}
    umb(-.75,-.7,'#f2b134');umb(.75,-.7,'#2e86ab');tree3(-.82,.85,.08);tree3(.85,.3,.07);lamp(.3,.88);lamp(-.3,.88);return 2.3;},
  musee(r){   // musée : palais à portique et attique, bannières, marches, pyramide de verre entre deux bassins, jardin de sculptures
    bx(-1.48,-1.48,1.48,1.48,0,.006,'#e3ddd2');const wl='#efe9df',H=FH*3;
    bx(-1.35,-1.35,1.35,-.2,0,H,wl,FRs(),'#ddd6c8');cornice(2.7,1.15,H,'#f7f3ec',-.775);bx(-1.1,-1.15,1.1,-.4,H+.028,H+.25,'#e6e0d4');
    for(let k=0;k<8;k++)cyl(-1.05+k*.3,-.05,.04,H,.045,.045,10,'#f7f3ec');
    bx(-1.25,-.2,1.25,.1,0,.04,'#e9e2d4');bx(-1.2,-.2,1.2,.16,0,.02,'#e0d8ca');
    bx(-1.25,-.22,1.25,.1,H,H+.06,'#e9e2d4');gable(-1.25,-.22,1.25,.1,H+.06,.2,'#e9e2d4',true,'#f3ede2');
    const BN=['#a23b72','#2e86ab','#f2b134','#a23b72'];[-.9,-.3,.3,.9].forEach((x,k)=>bx(x-.06,-.2,x+.06,-.19,H*.3,H*.85,BN[k],'basic'));
    bx(-.85,.4,.85,1.35,0,.03,'#cfd5da');bx(-.8,.45,-.42,1.3,.03,.034,'#57b9e3','basic');bx(.42,.45,.8,1.3,.03,.034,'#57b9e3','basic');
    pyr(0,.88,.03,.42,.34,'#d4ecf6','glass');for(const [a,b] of[[-1,-1],[1,-1],[1,1],[-1,1]])beam(a*.34,.03,.88+b*.34,0,.45,.88,.014,.014,'#4f5b66');for(const t of[.33,.66])for(const [a,b,c,d] of[[-1,-1,1,-1],[1,-1,1,1],[1,1,-1,1],[-1,1,-1,-1]])beam(a*.34*(1-t),.03+.42*t,.88+b*.34*(1-t),c*.34*(1-t),.03+.42*t,.88+d*.34*(1-t),.008,.008,'#4f5b66');
    for(const x of[-1.15,1.15])pyr(x,.75,0,.15,.12,'#a9d3e6','glass');
    ico(1.15,.12,1.2,.07,'#b87333');bc(1.15,1.2,.05,.05,0,.05,'#cfc8bd');bc(-1.15,1.2,.05,.05,0,.05,'#cfc8bd');tube(-1.22,.08,1.2,-1.08,.2,1.2,.025,8,'#3f9a8a');
    tree3(-1.35,1.35,.1);tree3(1.35,1.35,.1);tree3(-1.35,.3,.09);tree3(1.35,.3,.09);return H+.3;},
  funfair(r){   // parc d'attractions : grande roue, montagnes russes (gare + wagons), carrousel, tour de chute, autos tamponneuses, stands, entrée
    bx(-1.98,-1.98,1.98,1.98,0,.006,'#ead9c4');
    for(const [x0,z0,x1,z1] of[[-1.95,.2,-.45,.55],[.2,-1.95,1.95,-1.05],[-1.95,1.85,-.6,1.97]])bx(x0,z0,x1,z1,0,.008,'#9fd57e');
    for(const sz of[-1,1]){beam(-1.5,0,-1.2+sz*.16,-.95,1.3,-1.2+sz*.16,.05,.05,'#8d949b');beam(-.4,0,-1.2+sz*.16,-.95,1.3,-1.2+sz*.16,.05,.05,'#8d949b');}
    if(CUR){const p=V(-.95,1.3,-1.2);CUR.wh.push(p[0],p[1],p[2],TX.k,1.05);}
    const tp=k=>{const a=k/36*6.2832;return[.75+Math.cos(a),.56+.28*Math.sin(a*3)+.18*Math.cos(a),.35+Math.sin(a)*1.25];};
    for(let k=0;k<36;k++){const a=tp(k),b=tp(k+1),dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,nx=-dz/l*.05,nz=dx/l*.05;
      quad(G('plain'),V(a[0]-nx,a[1],a[2]-nz),V(a[0]+nx,a[1],a[2]+nz),V(b[0]+nx,b[1],b[2]+nz),V(b[0]-nx,b[1],b[2]-nz),CC('#e63946'));
      quad(G('plain'),V(a[0]+nx,a[1]-.03,a[2]+nz),V(a[0]-nx,a[1]-.03,a[2]-nz),V(b[0]-nx,b[1]-.03,b[2]-nz),V(b[0]+nx,b[1]-.03,b[2]+nz),CC('#b52d3a'));
      if(k%2===0){bc(a[0],a[2],.012,.012,0,a[1]-.03,'#9aa0a6');if(k%4===0)beam(a[0],.02,a[2],(a[0]+b[0])/2,a[1]*.6,(a[2]+b[2])/2,.012,.012,'#9aa0a6');}}
    const t0=tp(0);bc(t0[0],t0[2],.16,.12,0,t0[1]-.04,'#f4f6f8');wedge(t0[0]-.2,t0[2]-.15,t0[0]+.2,t0[2]+.15,t0[1]+.12,t0[1]+.16,t0[1]+.13,'#3b8fdc');for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]])bc(t0[0]+a*.18,t0[2]+b*.13,.008,.008,t0[1]-.04,t0[1]+.13,'#59616a');
    for(let j=0;j<3;j++){const a=tp(9+j);bc(a[0],a[2],.045,.045,a[1],a[1]+.055,j?'#f2c14e':'#3b8fdc');}
    cyl(-1.1,1.1,0,.08,.44,.44,16,'#f2c14e');cyl(-1.1,1.1,.08,.42,.05,.05,8,'#e9e9e9');
    for(let k=0;k<12;k++){const a=k/12*6.283,x=-1.1+Math.cos(a)*.35,z=1.1+Math.sin(a)*.35;bc(x,z,.005,.005,.08,.4,'#e3b23c');bc(x,z,.035,.012,.15+(k%2)*.05,.2+(k%2)*.05,['#ffffff','#3b8fdc','#e63946'][k%3]);}
    cyl(-1.1,1.1,.4,.44,.47,.47,16,'#e63946');cone2(-1.1,1.1,.44,.3,.5,16,'#e63946','#ffffff');bc(-1.1,1.1,.01,.01,.74,.86,'#e3b23c');
    bc(1.6,-1.55,.05,.05,0,2.6,'#e9edf0');bc(1.6,-1.55,.09,.09,2.6,2.72,'#e63946');cyl(1.6,-1.55,1.3,1.42,.17,.17,12,'#f2b134');bc(1.6,-1.55,.012,.012,2.72,2.8,'#ff3b3b','basic');
    bx(.25,-1.85,1.15,-1.2,0,.02,'#3d4650');for(const [x,z] of[[.25,-1.85],[1.15,-1.85],[.25,-1.2],[1.15,-1.2]])bc(x,z,.012,.012,.02,.35,'#e9edf0');cone2(.7,-1.52,.35,.12,.62,8,'#2e86ab','#ffffff');
    for(let k=0;k<5;k++)bc(.4+k*.17,-1.6+(k%2)*.2,.04,.03,.02,.06,['#e63946','#f2b134','#3fa34d','#3b8fdc','#a23b72'][k]);
    for(let k=0;k<3;k++){const x=-1.6+k*.35;bc(x,1.72,.14,.1,0,.2,'#f4f6f8');for(let j=0;j<4;j++)wedge(x-.15+j*.075,1.6,x-.075+j*.075,1.86,.2,.27,.22,j%2?'#ffffff':['#e63946','#3b8fdc','#f2b134'][k]);}
    bc(-.42,1.92,.04,.04,0,.72,'#7d5a4a');bc(.42,1.92,.04,.04,0,.72,'#7d5a4a');bx(-.5,1.88,.5,1.96,.6,.78,'#ff6b9d','basic');for(let k=0;k<7;k++)bx(-.36+k*.12,1.96,-.3+k*.12,1.964,.65,.73,'#ffffff','basic');
    bc(.7,1.85,.1,.08,0,.2,'#3b8fdc');wedge(.58,1.74,.82,1.96,.2,.25,.22,'#ffffff');
    for(const [x,z] of[[-1.85,-1.85],[-1.85,1.3],[1.85,1.85],[1.85,-.6],[-.2,-1.85]])tree3(x,z,.1);for(const x of[-.25,.25])lamp(x,1.6);bench(-.3,1.45,true);return 2.8;},
  // ── Économie ──
  ferme(r){   // ferme : champs en sillons, grange rouge à toit mansardé et portes en X, silos, maison, prés avec moutons et vaches, balles de foin, tracteur
    lawnB(3);
    for(let k=0;k<4;k++){const x0=-1.45+(k%2)*.72,z0=-1.45+((k/2)|0)*.72,[c0,c]=farmCrop(k);bx(x0,z0,x0+.68,z0+.68,0,.02,c0);for(let j=0;j<6;j++)bx(x0+.03,z0+.04+j*.11,x0+.65,z0+.1+j*.11,.02,.05,c);}   /* v13 : selon la saison */
    bx(.25,-1.35,1.2,-.55,0,.42,'#b23a2e',null,'#8f2f25');wedge(.22,-1.38,1.23,-1.12,.42,.42,.62,'#7a3328');wedge(.22,-.78,1.23,-.52,.42,.62,.42,'#7a3328');gable(.22,-1.12,1.23,-.78,.62,.14,'#7a3328',true,'#b23a2e');
    bx(.55,-.55,.9,-.542,0,.34,'#9c3328');bx(.55,-.545,.9,-.538,.32,.34,'#f3efe6');bx(.55,-.545,.57,-.538,0,.34,'#f3efe6');bx(.88,-.545,.9,-.538,0,.34,'#f3efe6');
    beam(.57,.02,-.537,.88,.32,-.537,.02,.006,'#f3efe6');beam(.57,.32,-.537,.88,.02,-.537,.02,.006,'#f3efe6');
    cyl(1.32,-1.2,0,.95,.14,.14,14,'#d9d4cc','#cfc9bf');dome(1.32,-1.2,.95,.14,14,'#9aa0a6');cyl(1.32,-.85,0,.8,.12,.12,14,'#c9d1d6');dome(1.32,-.85,.8,.12,14,'#9aa0a6');
    bx(.35,-.25,1.05,.2,0,FH*1.6,'#efe3cc',FRs(),'#d9cdb6');gable(.31,-.29,1.09,.24,FH*1.6,.26,'#b4503a',true,'#efe3cc');bc(.85,-.05,.035,.035,FH*1.6,FH*1.6+.3,'#a89a86');
    bx(.25,.4,1.42,1.42,0,.008,'#9ed37a');fence(.25,.4,1.42,1.42,.1,'#8d6e4f');
    for(const [x,z] of[[.45,.6],[.6,.75],[.4,.95],[.7,.55],[.55,1.1]]){ico(x,.06,z,.05,'#f7f6f2',.8);bc(x+.05,z,.018,.015,.05,.08,'#3a3a3a');}
    for(const [x,z] of[[1.0,.8],[1.2,1.15],[.95,1.25]]){bc(x,z,.08,.04,.05,.11,'#ffffff');bc(x-.02,z,.03,.041,.07,.1,'#2b2b2b');bc(x+.09,z,.025,.025,.08,.12,'#ffffff');for(const [a,b] of[[-.06,-.03],[-.06,.03],[.06,-.03],[.06,.03]])bc(x+a,z+b,.008,.008,0,.05,'#2b2b2b');}
    bx(-1.45,.15,.1,1.45,0,.012,'#d9cf8a');for(const [x,z] of[[-1.2,.4],[-.8,.7],[-1.1,1.1],[-.4,.45],[-.5,1.2]])tube(x,.06,z-.05,x,.06,z+.05,.06,10,'#e3c262');
    bc(-.2,.95,.07,.05,.04,.12,'#3fa34d');bc(-.25,.95,.04,.045,.12,.2,'#a9d3e6');for(const z of[.88,1.02]){tube(-.26,.065,z-.015,-.26,.065,z+.015,.065,10,'#2b2b2b');tube(-.12,.04,z-.012,-.12,.04,z+.012,.04,8,'#2b2b2b');}
    bx(.12,-.5,.22,1.48,0,.008,'#c9b48a');tree3(1.35,.2,.1);tree3(-.1,.05,.09);return 1.1;},
  scierie(r){   // scierie : hangar ouvert sur poteaux, ligne de sciage, grumes empilées, piles de planches, chargeuse, cyclone à sciure
    bx(-.98,-.98,.98,.98,0,.006,'#b9a98c');
    for(const x of[-.9,-.5,-.1,.3])for(const z of[-.85,.1])bc(x,z,.02,.02,0,.42,'#7a5a3e');
    bx(-.92,-.87,.32,-.8,0,.42,'#a57a52');gable(-.96,-.9,.36,.14,.42,.2,'#5e6b78',true,'#a57a52');
    bx(-.85,-.6,.25,-.3,0,.1,'#7d858d');bc(-.3,-.45,.06,.1,.1,.18,'#c94b3a');for(let k=0;k<4;k++)bx(-.8+k*.22,-.15,-.62+k*.22,.05,0,.05+(k%2)*.04,'#e0c08a');
    for(let k=0;k<3;k++)for(let j=0;j<4-k;j++){const x=.45+j*.13+k*.065,y=.065+k*.11;tube(x,y,-.92,x,y,-.25,.06,8,'#8a5a3a');tube(x,y,-.255,x,y,-.245,.056,8,'#e0c08a');}
    for(let k=0;k<3;k++)for(let h=0;h<3;h++){bc(.48+k*.2,.4,.08,.15,h*.065,h*.065+.05,'#e0c08a');bc(.48+k*.2,.4,.082,.012,h*.065+.05,h*.065+.065,'#8a6a4a');}
    bc(-.3,.6,.1,.06,.02,.14,'#f2b134');bc(-.36,.6,.04,.05,.14,.24,'#a9d3e6');beam(-.22,.16,.6,.02,.42,.45,.03,.03,'#f2b134');beam(.02,.42,.45,.12,.2,.35,.025,.025,'#f2b134');
    for(const z of[.54,.66])tube(-.4,.04,z,-.18,.04,z,.04,8,'#2b2b2b');
    cyl(.8,.85,.3,.5,.02,.1,10,'#c9d1d6');cyl(.8,.85,.5,.66,.1,.1,10,'#c9d1d6');for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]])bc(.8+a*.07,.85+b*.07,.008,.008,0,.5,'#8d949b');
    beam(.8,.6,.85,.3,.38,.1,.03,.03,'#b9c1c6');ico(.55,0,.82,.16,'#d9b27a',.6);
    truck(-.7,.75,true,'#8a5a3a');for(const y of[.13,.17])tube(-.82,y,.75,-.62,y,.75,.025,6,'#8a5a3a');return .65;},
  peche(r,s){   // port de pêche, tourné vers l'eau : criée à toit bleu, fabrique de glace, caisses, filets, grue, chalutiers
    const k0=toWater(s);
    bx(-.98,-.98,.98,.98,0,.008,'#cfcac2');bx(-.98,.85,.98,1.0,0,.04,'#a9a395');for(let k=0;k<5;k++)bc(-.8+k*.4,.93,.025,.025,.04,.08,'#3d4650');
    bx(-.92,-.92,.35,-.1,0,.42,'#eef1f3',FRs(),'#3b8fdc');gable(-.95,-.95,.38,-.07,.42,.18,'#3b8fdc',true,'#eef1f3');
    for(const x of[-.7,-.3,.1])bx(x-.12,-.1,x+.12,-.095,0,.28,'#5f7f99');signB(-.3,-.095,.5,.32,'#3b8fdc',.06);
    bx(.45,-.92,.92,-.4,0,.5,'#dfe5ea',FIn(.5),'#b9c1c6');tube(.6,.5,-.65,.6,.62,-.65,.04,8,'#9aa0a6');
    for(let k=0;k<6;k++)bc(-.7+(k%3)*.14,.35+((k/3)|0)*.14,.05,.05,0,.06+(k%2)*.06,['#3b8fdc','#e63946','#2fa36b'][k%3]);
    bc(.25,.5,.006,.006,0,.22,'#8d6e4f');bc(.75,.5,.006,.006,0,.22,'#8d6e4f');bx(.25,.497,.75,.503,.04,.2,'#2f5d4a');
    bc(.7,.75,.04,.04,0,.6,'#f2b134');beam(.7,.6,.75,.7,.55,1.2,.03,.03,'#f2b134');bc(.7,1.2,.003,.003,.3,.55,'#333333');
    const trawl=(x,z,col)=>{bc(x,z,.09,.26,-.05,.06,col);bc(x,z-.02,.085,.24,.06,.075,'#ffffff');bc(x,z-.1,.06,.07,.075,.2,'#ffffff');bx(x-.061,z-.13,x+.061,z-.07,.15,.18,'#2b3a46');
      bc(x,z+.08,.006,.006,.075,.45,'#d0d0d0');beam(x,.42,z+.08,x+.2,.2,z+.12,.01,.01,'#d0d0d0');beam(x,.42,z+.08,x-.2,.2,z+.12,.01,.01,'#d0d0d0');bc(x,z+.17,.07,.05,.075,.1,'#2f5d4a');};
    trawl(-.45,1.3,'#d62828');trawl(.35,1.35,'#2e86ab');
    TX.k=k0;return .6;},
  port(r,s){   // port de commerce, tourné vers l'eau : quai, deux portiques à conteneurs, piles de conteneurs, cavalier, entrepôt, bureaux
    const k0=toWater(s);
    bx(-1.48,-1.48,1.48,1.48,0,.03,'#a9adb2');bx(-1.48,1.38,1.48,1.48,.03,.05,'#d9d4cc');for(let k=0;k<7;k++)bc(-1.35+k*.45,1.44,.025,.025,.05,.09,'#3d4650');
    for(const z of[.7,1.3])bx(-1.48,z-.012,1.48,z+.012,.03,.04,'#6d6a66');
    for(const x of[-.7,.55]){const c='#2e86ab';for(const xx of[x-.22,x+.22])for(const z of[.7,1.3])bc(xx,z,.025,.025,.04,1.15,c);
      bx(x-.25,.65,x-.19,2.3,1.15,1.25,c);bx(x+.19,.65,x+.25,2.3,1.15,1.25,c);bx(x-.25,.65,x+.25,.71,1.15,1.25,c);bx(x-.25,1.27,x+.25,1.33,1.15,1.25,c);
      bx(x-.24,.68,x+.24,.72,.55,.6,c);bx(x-.24,1.28,x+.24,1.32,.55,.6,c);bc(x,1.55,.07,.06,1.02,1.15,'#f4f6f8');bx(x-.06,1.61,x+.06,1.612,1.06,1.12,'#2b3a46');
      for(const s_ of[-1,1])beam(x+s_*.22,1.25,1.0,x+s_*.22,1.6,1.3,.015,.015,c);bc(x,.95,.05,.05,1.25,1.6,c);}
    const C=['#e4572e','#2e86ab','#f2b134','#3fa34d','#a23b72','#4f6d7a','#d9d4cc'];
    for(const z of[-1.25,-1.08,-.91,-.55,-.38,-.21])for(let j=0;j<5;j++){const x=-1.2+j*.45,h=1+(r()*3|0);for(let k=0;k<h;k++){const c=pick(r,C);bc(x,z,.19,.07,.035+k*.135,.16+k*.135,c);}}
    for(const xx of[-.12,.12])for(const zz of[.15,.45])bc(.0+xx,zz,.015,.015,.03,.42,'#f2b134');bx(-.14,.12,.14,.48,.42,.46,'#f2b134');bc(0,.3,.19,.07,.2,.32,'#3fa34d');
    bx(.95,-1.42,1.45,-.35,0,.5,'#cfd5da',FIn(.5),'#9aa3ab');for(const z of[-1.2,-.85,-.55])bx(.94,z-.1,.95,z+.1,.03,.28,'#59616a');
    bx(.95,-.2,1.45,.3,0,FH*2.2,'#e9eef2',FOf(),'#c9d1d6');truck(.6,.25,true,'#e4572e');truck(-1.0,.3,true,'#2e86ab');
    TX.k=k0;return 2.3;},
  aeroport(r){   // aéroport : piste balisée (seuils, bords, axe), taxiway, aire de stationnement, aérogare ondulée, passerelles, tour de contrôle, hangar
    bx(-1.98,-1.98,1.98,1.98,0,.005,'#9fd57e');
    bx(-1.95,.55,1.95,1.25,.005,.02,'#4f565e');for(let k=0;k<9;k++)bx(-1.55+k*.36,.885,-1.4+k*.36,.915,.02,.024,'#f3f1e7','basic');
    for(const s of[-1,1])for(let k=0;k<6;k++){const z=.62+k*.1;bx(s*1.82-.07,z,s*1.82+.07,z+.05,.02,.024,'#f3f1e7');}
    bx(-1.95,.57,1.95,.585,.02,.023,'#f3f1e7');bx(-1.95,1.215,1.95,1.23,.02,.023,'#f3f1e7');for(const s of[-1,1])for(const z of[.7,1.06])bx(s*1.45-.12,z,s*1.45+.12,z+.06,.02,.024,'#f3f1e7');
    bx(-1.7,-.35,1.7,.5,.005,.015,'#9aa0a6');bx(-1.6,.42,1.6,.435,.015,.018,'#f2c14e');for(const x of[-.9,.35])bx(x-.008,-.3,x+.008,.42,.015,.018,'#f2c14e');
    bx(1.45,.45,1.75,.56,.005,.016,'#9aa0a6');
    bx(-1.5,-1.75,.9,-.65,0,.48,'#b9dcea',FOf(),'#d5dde3');vault(-1.55,-1.8,.95,-.55,.48,.16,8,'#f4f6f8',true,'#e3e9ee');bx(-1.51,-.66,.91,-.64,.0,.06,'#d5dde3');
    for(const x of[-.9,.35]){bx(x-.04,-.65,x+.04,-.15,.12,.2,'#d9dde0');bc(x,-.17,.02,.02,0,.12,'#8d949b');}
    cyl(1.35,-1.25,0,1.15,.1,.08,12,'#e3e6e9');cyl(1.35,-1.25,1.15,1.2,.12,.2,12,'#d6dde3');cyl(1.35,-1.25,1.2,1.38,.22,.24,12,'#86b9d6','#86b9d6','glass');
    cyl(1.35,-1.25,1.38,1.44,.25,.2,12,'#4a5058');bc(1.35,-1.25,.006,.006,1.44,1.7,'#9aa0a6');bc(1.35,-1.25,.012,.012,1.7,1.72,'#ff3b3b','basic');
    bx(1.0,-.85,1.85,-.42,0,.3,'#cfd6dc',FIn(.3),'#b9c1c6');vault(1.0,-.85,1.85,-.42,.3,.15,8,'#e3e8ec',true,'#cfd6dc');bx(1.05,-.42,1.8,-.41,0,.28,'#9aa3ab');
    asph(-1.95,-1.95,.9,-1.78);for(let k=0;k<21;k++){bx(-1.9+k*.13-.004,-1.95,-1.9+k*.13+.004,-1.78,.006,.009,'#f2f2f2');if(k<20)spot(-1.9+(k+.5)*.13,-1.865,false,2);}
    for(const z of[-1.45,-1.15])cyl(-1.82,z,0,.18,.1,.1,12,'#e9eef2','#cfd6dc');
    bc(1.8,1.4,.006,.006,0,.25,'#d0d0d0');beam(1.8,.24,1.4,1.92,.22,1.4,.04,.04,'#ff7a1a');return 1.7;},
});
// =========================================================
// v12 (14 nov. 2026) : habitants variés et animés, bateaux réalistes, lumière de nuit, routes et ronds-points refaits
// =========================================================
// ── Habitants : 6 silhouettes (t-shirt, robe, sac à main, casquette + sac à dos, manteau + chapeau + canne, short),
// couleurs de peau, de cheveux et de vêtements tirées pour chaque personne, enfants et personnes âgées, parapluie quand il pleut.
// Les jambes et les bras se balancent dans le shader (attributs iAn = phase, amplitude) : la phase avance avec la distance parcourue,
// donc les pas suivent la vitesse réelle (plus de bonshommes qui glissent).
const HSKIN=['#f6d5b8','#f0c39e','#e0ac80','#c98e5f','#a46b43','#7a4a2c','#5b3620'];
const HTOP=['#e4572e','#2e86ab','#f2b134','#3fa34d','#a23b72','#ef6f6c','#4f6d7a','#f4f4f4','#1d3557','#f4a261','#9b5de5','#2a9d8f','#e9c46a','#d62828','#8ecae6','#ffb4c8','#6b705c','#222831'];
const HBOT=['#2f4b7c','#1f2933','#c9b18a','#6b7178','#3d4f6b','#7a6a4f','#2b2b2b','#4a6fa5','#8d6e63'];
const HHAIR=['#1b1512','#2f2119','#4a3122','#6e4a2e','#a0703f','#d9b06c','#b5502a'];
const HACC=['#7a4b2e','#1f2933','#e63946','#2e86ab','#f2b134','#3fa34d','#f4f4f4','#a23b72'];
const HUM_C=new THREE.Color();
function humGeo(v){
  const P_=[],N_=[],C_=[];
  const push=(t,n,c)=>{P_.push(t[0],t[1],t[2]);N_.push(n[0],n[1],n[2]);C_.push(c[0],c[1],c[2]);};
  const box=(x0,y0,z0,x1,y1,z1,sl,lb)=>{const c=[sl/8,lb/8,0],f=(a,b,d,e,n)=>{for(const t of[a,b,d,a,d,e])push(t,n,c);};
    f([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]);f([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]);
    f([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]);f([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]);
    f([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0]);f([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0]);};
  const ball=(cx,cy,cz,r,sy,sl,lb)=>{const c=[sl/8,lb/8,0];for(let k=0;k<ICO.length;k+=9){const a=[cx+ICO[k]*r,cy+ICO[k+1]*r*sy,cz+ICO[k+2]*r],b=[cx+ICO[k+3]*r,cy+ICO[k+4]*r*sy,cz+ICO[k+5]*r],d=[cx+ICO[k+6]*r,cy+ICO[k+7]*r*sy,cz+ICO[k+8]*r];
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;push(a,[nx,ny,nz],c);push(b,[nx,ny,nz],c);push(d,[nx,ny,nz],c);}};
  // emplacements de couleur : 0 peau, 1 haut, 2 bas, 3 cheveux, 4 chaussures, 5 accessoire · membres : 0 corps, 1-2 jambes, 3-4 bras
  const legs=sl=>{box(-.018,.012,-.007,-.004,.076,.007,sl,1);box(.004,.012,-.007,.018,.076,.007,sl,2);box(-.019,0,-.008,-.003,.012,.016,4,1);box(.003,0,-.008,.019,.012,.016,4,2);};
  const arms=sl=>{box(-.035,.084,-.006,-.025,.13,.006,sl,3);box(.025,.084,-.006,.035,.13,.006,sl,4);box(-.034,.07,-.005,-.026,.084,.005,0,3);box(.026,.07,-.005,.034,.084,.005,0,4);};
  const sleeves=()=>{box(-.036,.115,-.007,-.024,.131,.007,1,3);box(.024,.115,-.007,.036,.131,.007,1,4);};
  const torso=sl=>{box(-.024,.078,-.014,.024,.132,.014,sl,0);box(-.02,.068,-.012,.02,.08,.012,2,0);};
  const head=()=>{box(-.006,.13,-.006,.006,.138,.006,0,0);ball(0,.153,0,.019,1,0,0);};
  switch(v){
    case 0:legs(2);torso(1);arms(1);head();ball(0,.161,-.004,.0198,.72,3,0);break;                                              // t-shirt et pantalon
    case 1:legs(0);box(-.027,.044,-.018,.027,.082,.018,1,0);box(-.024,.078,-.014,.024,.132,.014,1,0);arms(0);sleeves();head();
      ball(0,.157,-.006,.0215,1.05,3,0);box(-.018,.112,-.021,.018,.155,-.008,3,0);break;                                           // robe, cheveux longs
    case 2:legs(2);torso(1);arms(1);head();ball(0,.161,-.004,.0198,.72,3,0);ball(0,.173,-.015,.0105,1,3,0);box(.035,.062,-.012,.043,.094,.01,5,0);break;   // chignon, sac à main
    case 3:legs(2);torso(1);arms(1);head();ball(0,.158,-.004,.0195,.6,3,0);box(-.02,.162,-.018,.02,.173,.018,5,0);box(-.017,.162,.018,.017,.166,.035,5,0);
      box(-.018,.087,-.032,.018,.127,-.014,5,0);break;                                                                               // casquette, sac à dos
    case 4:legs(2);box(-.027,.04,-.018,.027,.134,.018,1,0);arms(1);head();ball(0,.16,-.004,.0195,.7,3,0);box(-.026,.164,-.026,.026,.168,.026,5,0);
      box(-.015,.168,-.015,.015,.186,.015,5,0);box(.037,0,.008,.041,.074,.012,5,4);break;                                          // manteau long, chapeau, canne
    case 5:legs(0);box(-.021,.048,-.011,-.002,.078,.011,2,1);box(.002,.048,-.011,.021,.078,.011,2,2);torso(1);arms(0);sleeves();head();ball(0,.16,-.004,.0198,.68,3,0);break;   // short, t-shirt
    case 6:legs(2);torso(1);arms(1);head();ball(0,.161,-.004,.0198,.66,3,0);box(-.008,.108,.0142,.008,.132,.0158,6,0);box(-.003,.098,.0158,.003,.128,.017,5,0);box(.03,.044,-.013,.044,.074,.013,5,4);break;   // costume, cravate, mallette
    case 7:legs(2);torso(1);arms(1);box(-.0262,.08,-.0162,.0262,.131,.0162,7,0);box(-.0265,.094,-.0165,.0265,.099,.0165,6,0);head();ball(0,.161,0,.0225,.62,5,0);box(-.022,.16,-.024,.022,.163,.026,5,0);break;   // ouvrier : gilet orange, casque
    case 8:legs(2);box(-.027,.044,-.018,.027,.134,.018,6,0);arms(6);head();ball(0,.161,-.004,.0198,.72,3,0);box(-.012,.104,.0182,.012,.108,.0196,5,0);box(-.002,.09,.0182,.002,.106,.0196,5,0);break;   // blouse blanche (soignant)
    case 9:legs(0);box(-.021,.048,-.011,-.002,.078,.011,2,1);box(.002,.048,-.011,.021,.078,.011,2,2);torso(1);arms(0);sleeves();head();box(-.025,.163,-.025,.025,.168,.025,5,0);box(-.017,.168,-.017,.017,.181,.017,5,0);box(-.011,.094,.0145,.011,.11,.026,4,0);break;   // touriste : bob, appareil photo
    case 10:legs(0);box(-.027,.05,-.018,.027,.083,.018,2,0);torso(1);arms(1);head();ball(0,.157,-.006,.0215,1.05,3,0);box(-.018,.112,-.021,.018,.155,-.008,3,0);break;   // jupe, cheveux longs
    default:legs(2);torso(1);arms(1);head();ball(0,.159,-.004,.0198,.66,3,0);box(-.021,.118,-.026,.021,.152,-.012,1,0);box(-.023,.147,-.005,-.018,.163,.007,5,0);box(.018,.147,-.005,.023,.163,.007,5,0);box(-.021,.174,-.003,.021,.178,.003,5,0);   // sweat à capuche, casque audio
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P_,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N_,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C_,3));return g;
}
function humMat(){
  const m=new THREE.MeshLambertMaterial({vertexColors:true});
  m.onBeforeCompile=sh=>{
    sh.vertexShader='attribute vec3 iC0;attribute vec3 iC1;attribute vec3 iC2;attribute vec3 iC3;attribute vec3 iC4;attribute vec2 iAn;\n'+sh.vertexShader
      .replace('#include <color_vertex>','#include <color_vertex>\n{float sl_=floor(color.r*8.+.5);vColor=sl_<.5?iC0:sl_<1.5?iC1:sl_<2.5?iC2:sl_<3.5?iC3:sl_<4.5?vec3(.09,.09,.1):sl_<5.5?iC4:sl_<6.5?vec3(.9,.91,.92):vec3(.98,.42,.06);}')
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat lb_=floor(color.g*8.+.5),sw_=0.;if(lb_>.5&&lb_<2.5)sw_=sin(iAn.x)*iAn.y*(lb_<1.5?1.:-1.);else if(lb_>2.5)sw_=sin(iAn.x)*iAn.y*.8*(lb_<3.5?-1.:1.);float cs_=cos(sw_),sn_=sin(sw_);objectNormal=vec3(objectNormal.x,objectNormal.y*cs_-objectNormal.z*sn_,objectNormal.y*sn_+objectNormal.z*cs_);')
      .replace('#include <begin_vertex>','#include <begin_vertex>\n{float pv_=lb_>2.5?.128:.076,yy_=transformed.y-pv_;transformed=vec3(transformed.x,pv_+yy_*cs_-transformed.z*sn_,yy_*sn_+transformed.z*cs_);}');
  };
  m.customProgramCacheKey=()=>'hum2';return m;
}
function humInit(){
  const H={cap:200,V:12,meshes:[],n:new Array(12).fill(0),nu:0,rain:false,m:new THREE.Matrix4(),q:new THREE.Quaternion(),e:new THREE.Euler(),p:new THREE.Vector3(),s:new THREE.Vector3(),c:new THREE.Color()},mat=humMat();
  for(let v=0;v<H.V;v++){const g=humGeo(v);
    for(let k=0;k<5;k++)g.setAttribute('iC'+k,new THREE.InstancedBufferAttribute(new Float32Array(H.cap*3),3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iAn',new THREE.InstancedBufferAttribute(new Float32Array(H.cap*2),2).setUsage(THREE.DynamicDrawUsage));
    const M=new THREE.InstancedMesh(g,mat,H.cap);M.count=0;M.frustumCulled=false;M.castShadow=false;E.gC.add(M);H.meshes.push(M);}   /* v13 : pas d'ombre portée pour les petits personnages (plus fluide) */
  GB=new Map();TX.x=0;TX.z=0;TX.k=0;bc(.026,0,.0025,.0025,.09,.205,'#555555');cone2(.026,0,.188,.04,.075,8,'#ffffff','#e6e6e6');bc(.026,0,.004,.004,.226,.236,'#555555');
  const ug=toGeo(GB.get('plain'));GB=null;H.umb=new THREE.InstancedMesh(ug,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}),H.cap);H.umb.count=0;H.umb.frustumCulled=false;H.umb.setColorAt(0,new THREE.Color('#fff'));E.gC.add(H.umb);
  E.hum=H;
}
// apparence d'une personne (tirée une fois, d'après une graine) : o.kid, o.v (silhouette), o.top (couleur imposée)
function humLook(seed,o){
  o=o||{};const r=rng(((seed|0)*2654435761+7)|0);let v=o.v!=null?o.v:pick(r,[0,0,1,2,2,3,3,4,5,6,6,7,8,9,10,10,11,11]);
  const kid=o.kid!=null?o.kid:r()<.12,old=!kid&&o.v==null&&(v===4||r()<.07);if(kid&&o.v==null)v=pick(r,[3,5,11,10]);if(old)v=r()<.6?4:v;
  const c=new Float32Array(15),put=(j,hex)=>{HUM_C.set(hex);c[j*3]=HUM_C.r;c[j*3+1]=HUM_C.g;c[j*3+2]=HUM_C.b;};
  put(0,pick(r,HSKIN));put(1,o.top||pick(r,HTOP));put(2,pick(r,HBOT));put(3,old?pick(r,['#d9d9d9','#bdbdbd','#ece6da']):pick(r,HHAIR));put(4,pick(r,HACC));
  if(v===6){const su=pick(r,['#1f2933','#2f3b4a','#3d4f6b','#4a4a4a','#5b4636']);put(1,su);put(2,su);put(4,pick(r,['#7a4b2e','#1f2933']));}else if(v===7){put(4,'#f2c14e');put(2,pick(r,['#3d4f6b','#2f4b7c','#4a4a4a']));}else if(v===8)put(4,'#3d4650');
  return{v,c,kid,old,h:kid?1:.93+r()*.13,k:kid?.62:1,sp:kid?1.2:old?.6:.85+r()*.3,u:r()<.7};
}
function humBegin(){if(!E.hum)humInit();const H=E.hum;H.n.fill(0);H.nu=0;H.rain=!!(S.wx&&(S.wx.k==='rain'||S.wx.k==='storm'))&&!(SNOW.value>.35);}
// une personne : position, cap (ang), échelle, phase de marche (ph) et amplitude (0 debout, ~.55 marche, ~1 course)
function humPut(L,x,y,z,ang,sc,ph,amp,lie){
  const H=E.hum;if(!H||!L)return;const v=L.v,k=H.n[v];if(k>=H.cap)return;H.n[v]=k+1;const M=H.meshes[v];sc*=L.k;
  if(lie)H.e.set(-Math.PI/2,ang,0,'YXZ');else H.e.set(0,ang,0,'XYZ');H.q.setFromEuler(H.e);H.p.set(x,y+(amp>0?Math.abs(Math.cos(ph))*.0045*sc*(amp>.8?2.2:1):0),z);H.s.set(sc,sc*L.h,sc);H.m.compose(H.p,H.q,H.s);M.setMatrixAt(k,H.m);
  const g=M.geometry.attributes;for(let j=0;j<5;j++){const a=g['iC'+j].array;a[k*3]=L.c[j*3];a[k*3+1]=L.c[j*3+1];a[k*3+2]=L.c[j*3+2];}
  g.iAn.array[k*2]=ph||0;g.iAn.array[k*2+1]=amp||0;
  if(H.rain&&L.u&&amp<.8&&H.nu<H.cap){H.umb.setMatrixAt(H.nu,H.m);H.c.setRGB(L.c[12],L.c[13],L.c[14]);H.umb.setColorAt(H.nu,H.c);H.nu++;}
}
function humEnd(){
  const H=E.hum;if(!H)return;
  H.meshes.forEach((M,v)=>{M.count=H.n[v];M.instanceMatrix.needsUpdate=true;const g=M.geometry.attributes;for(let j=0;j<5;j++)g['iC'+j].needsUpdate=true;g.iAn.needsUpdate=true;});
  H.umb.count=H.nu;H.umb.instanceMatrix.needsUpdate=true;if(H.umb.instanceColor)H.umb.instanceColor.needsUpdate=true;
}
const HUM_STEP=62;   // phase de marche par unité de distance (≈ une foulée complète tous les 0,1 case, à l'échelle 0,8)
function angLerp(a,b,t){const d=((b-a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return a+d*t;}
// suit une cible en douceur (plus de sauts aux coins de rue) et fait avancer la phase de marche avec la distance parcourue
function humFollow(o,tx,tz,run){if(o.rx==null||Math.hypot(tx-o.rx,tz-o.rz)>.9){o.rx=tx;o.rz=tz;if(o.ra==null)o.ra=0;o.ph=o.ph||0;return 0;}
  const ox=o.rx,oz=o.rz,k=Math.min(1,run*9);o.rx+=(tx-ox)*k;o.rz+=(tz-oz)*k;const d=Math.hypot(o.rx-ox,o.rz-oz);if(d>1e-4)o.ra=angLerp(o.ra,Math.atan2(o.rx-ox,o.rz-oz),Math.min(1,run*10));o.ph+=d*HUM_STEP;return d;}
const HUM_LC=new Map();function humLookC(seed,o){let L=HUM_LC.get(seed);if(!L){L=humLook(seed,o);if(HUM_LC.size>800)HUM_LC.clear();HUM_LC.set(seed,L);}return L;}
// ── Lumière de nuit (v12) : lampadaires plus nombreux, phares ──
const GS=(navigator.deviceMemory&&navigator.deviceMemory<4)?1:2;   // finesse du sol (routes, marquages) : 2 = double résolution
function lampAt(i){const x=i%N,z=(i/N)|0;return road[i]&&!ter[i]&&!mtn[i]&&!lane[i]&&!rx[i]&&!SIG[i]&&!dg[i]&&((x+z)&1)===0;}
// orientation du lampadaire : sur le trottoir, crosse tournée vers la chaussée, un côté sur deux
function lampK(i){const x=i%N,z=(i/N)|0,m=roadMask(x,z),hz=(m&10)&&!(m&5),alt=((x+z)>>1)&1;return hz?(alt?1:3):(alt?2:0);}
function beamTex(){if(beamTex.t)return beamTex.t;const cv=cvs(64,128),x=cv.getContext('2d'),im=x.createImageData(64,128);
  for(let py=0;py<128;py++)for(let px=0;px<64;px++){const t=py/127,w=.2+t*.8,dx=Math.abs((px+.5)/32-1)/w,a=Math.max(0,1-dx*dx)*Math.pow(1-t,1.5)*(t<.05?t/.05:1),o=(py*64+px)*4;
    im.data[o]=255;im.data[o+1]=238;im.data[o+2]=200;im.data[o+3]=Math.round(a*255);}
  x.putImageData(im,0,0);return beamTex.t=ctex(cv,false);}
function coneMesh(cap,front){const g=new THREE.PlaneGeometry(.2,.46);g.rotateX(-Math.PI/2);g.translate(0,.014,front+.23);
  const M=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({map:beamTex(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}),cap);
  M.count=0;M.frustumCulled=false;M.visible=false;M.renderOrder=2;E.gC.add(M);return M;}
// ── Routes (v12) : asphalte grainé, dalles de trottoir, lignes de rive, pointillés plus longs, coins de trottoir arrondis ──
let ASPH_CV=null;
function asphPat(c){if(!ASPH_CV){const cv=cvs(32),x=cv.getContext('2d'),R=rng(4242);for(let k=0;k<170;k++){const a=R();x.fillStyle=a<.5?`rgba(255,255,255,${.035+R()*.05})`:`rgba(0,0,0,${.05+R()*.07})`;x.fillRect(R()*32,R()*32,.6+R()*.9,.6+R()*.9);}
    for(let k=0;k<5;k++){x.fillStyle='rgba(0,0,0,.05)';x.beginPath();x.ellipse(R()*32,R()*32,2+R()*4,1+R()*2,R()*3,0,7);x.fill();}ASPH_CV=cv;}
  return c._apat||(c._apat=c.createPattern(ASPH_CV,'repeat'));}
function drawRoad(c,i,x,z,px,pz){
  const m=roadMask(x,z)|ovpBits(i),hw=road[i]===2,sw=5,A=hw?'#4f555d':'#5d646c',SWC=hw?'#a9b691':'#d3d6d8';
  if(dg[i]){drawDiagRoad(c,i,m,px,pz);return;}   /* 13 nov. 2026 : case avec une route en diagonale */
  if(road[i]===1&&!ter[i]&&(m===3||m===6||m===12||m===9)&&!rail[i]&&!SIG[i]&&!lane[i]){drawCurve(c,m,px,pz);return;}   // v5 : virage arrondi
  c.fillStyle=SWC;c.fillRect(px,pz,PX,PX);
  if(!hw){c.fillStyle='rgba(0,0,0,.055)';for(let k=4;k<PX;k+=4){c.fillRect(px+k,pz,.35,PX);c.fillRect(px,pz+k,PX,.35);}}   // joints des dalles du trottoir
  const ar=[[px+sw,pz+sw,PX-2*sw,PX-2*sw]];if(m&1)ar.push([px+sw,pz,PX-2*sw,sw]);if(m&4)ar.push([px+sw,pz+PX-sw,PX-2*sw,sw]);if(m&8)ar.push([px,pz+sw,sw,PX-2*sw]);if(m&2)ar.push([px+PX-sw,pz+sw,sw,PX-2*sw]);
  // coins arrondis là où deux branches se rejoignent (carrefours)
  const cn=[[1,2,px+PX,pz,Math.PI/2,Math.PI,px+PX-sw,pz],[1,8,px,pz,0,Math.PI/2,px,pz],[4,2,px+PX,pz+PX,Math.PI,Math.PI*1.5,px+PX-sw,pz+PX-sw],[4,8,px,pz+PX,Math.PI*1.5,Math.PI*2,px,pz+PX-sw]].filter(q=>(m&q[0])&&(m&q[1]));
  for(const q of cn)ar.push([q[6],q[7],sw,sw]);
  c.fillStyle=A;for(const r of ar)c.fillRect(r[0],r[1],r[2],r[3]);
  c.fillStyle=asphPat(c);for(const r of ar)c.fillRect(r[0],r[1],r[2],r[3]);
  c.fillStyle=SWC;for(const q of cn){c.beginPath();c.moveTo(q[2],q[3]);c.arc(q[2],q[3],sw-.6,q[4],q[5]);c.closePath();c.fill();}
  const cnt=(m&1?1:0)+(m&2?1:0)+(m&4?1:0)+(m&8?1:0);
  c.fillStyle=hw?'#f2c14e':'#f3f1e7';
  if(cnt<=2&&road[i]===3&&(m===5||m===10)){   // avenue : terre-plein central planté
    c.fillStyle='#c9cfc3';if(m===5)c.fillRect(px+H2-4,pz,8,PX);else c.fillRect(px,pz+H2-4,PX,8);
    c.fillStyle='#86c46a';if(m===5)c.fillRect(px+H2-3,pz,6,PX);else c.fillRect(px,pz+H2-3,PX,6);
    c.fillStyle='#f3f1e7';
    if(m===5){for(const xx of[8,23])for(const yy of[3,19])c.fillRect(px+xx,pz+yy,1.2,9);}
    else{for(const yy of[8,23])for(const xx of[3,19])c.fillRect(px+xx,pz+yy,9,1.2);}
  }else if(cnt<=2){
    if(m&1)c.fillRect(px+H2-.6,pz+3,1.2,9);if(m&4)c.fillRect(px+H2-.6,pz+19,1.2,9);
    if(m&8)c.fillRect(px+3,pz+H2-.6,9,1.2);if(m&2)c.fillRect(px+19,pz+H2-.6,9,1.2);
    if(!hw&&(m===5||m===10)){c.fillStyle='rgba(243,241,231,.62)';   // lignes de rive
      if(m===5){c.fillRect(px+sw+1.3,pz,.7,PX);c.fillRect(px+PX-sw-2,pz,.7,PX);}else{c.fillRect(px,pz+sw+1.3,PX,.7);c.fillRect(px,pz+PX-sw-2,PX,.7);}}
  }else{
    c.fillStyle='rgba(245,245,240,.9)';
    {const mz=m&~ovpBits(i);if(rx[i]!==2)for(let k=sw+1.5;k<PX-sw-1;k+=3.4){if(mz&1)c.fillRect(px+k,pz+.6,1.7,sw-1.2);if(mz&4)c.fillRect(px+k,pz+PX-sw+.6,1.7,sw-1.2);
      if(mz&8)c.fillRect(px+.6,pz+k,sw-1.2,1.7);if(mz&2)c.fillRect(px+PX-sw+.6,pz+k,sw-1.2,1.7);}}
    if(!rx[i]){c.fillStyle='rgba(245,245,240,.85)';   // lignes d'arrêt, côté droit de chaque arrivée
      if(m&1)c.fillRect(px+sw,pz+sw+.6,H2-sw,1);if(m&4)c.fillRect(px+H2,pz+PX-sw-1.6,H2-sw,1);if(m&8)c.fillRect(px+sw+.6,pz+H2,1,H2-sw);if(m&2)c.fillRect(px+PX-sw-1.6,pz+sw,1,H2-sw);}
  }
  drawZebras(c,i,x,z,px,pz,m);   /* v15 : passages avant les ronds-points et au milieu de certaines rues */
  c.fillStyle='rgba(0,0,0,.16)';
  if(!(m&1))c.fillRect(px+sw,pz+sw-1,PX-2*sw,1);if(!(m&4))c.fillRect(px+sw,pz+PX-sw,PX-2*sw,1);
  if(!(m&8))c.fillRect(px+sw-1,pz+sw,1,PX-2*sw);if(!(m&2))c.fillRect(px+PX-sw,pz+sw,1,PX-2*sw);
  c.fillStyle='rgba(255,255,255,.45)';   // arête claire de la bordure
  if(!(m&1))c.fillRect(px+sw,pz+sw-1.6,PX-2*sw,.6);if(!(m&4))c.fillRect(px+sw,pz+PX-sw+1,PX-2*sw,.6);
  if(!(m&8))c.fillRect(px+sw-1.6,pz+sw,.6,PX-2*sw);if(!(m&2))c.fillRect(px+PX-sw+1,pz+sw,.6,PX-2*sw);
}
// ── Rond-point (v12) : chaussée ronde, îlot central bordé, îlots séparateurs et « dents de requin » à chaque entrée ──
function roundaboutGround(c,x,z,px,pz){
  const cx=px+H2,cy=pz+H2,m=roadMask(x,z);
  c.fillStyle='#5d646c';c.beginPath();c.arc(cx,cy,H2-.4,0,7);c.fill();c.fillStyle=asphPat(c);c.beginPath();c.arc(cx,cy,H2-.4,0,7);c.fill();
  for(const [bit,rot] of[[1,0],[2,Math.PI/2],[4,Math.PI],[8,-Math.PI/2]]){if(!(m&bit))continue;
    c.save();c.translate(cx,cy);c.rotate(rot);
    c.fillStyle='rgba(245,245,240,.92)';for(let k=0;k<4;k++){const x0=-H2+5.6+k*2.45;c.beginPath();c.moveTo(x0,-H2+4.4);c.lineTo(x0+2,-H2+4.4);c.lineTo(x0+1,-H2+2.2);c.closePath();c.fill();}
    c.fillStyle='#f3f1e7';c.beginPath();c.moveTo(-1.7,-H2+8.2);c.lineTo(1.7,-H2+8.2);c.lineTo(0,-H2+1.2);c.closePath();c.fill();
    c.fillStyle='#cfd2d4';c.beginPath();c.moveTo(-1,-H2+7.5);c.lineTo(1,-H2+7.5);c.lineTo(0,-H2+3);c.closePath();c.fill();
    c.restore();}
  c.fillStyle='#ece9e3';c.beginPath();c.arc(cx,cy,8.9,0,7);c.fill();c.fillStyle='#86c46a';c.beginPath();c.arc(cx,cy,7.7,0,7);c.fill();
}
function roundaboutIsland(i){
  const R=rng(i*29+11),v=R(),g=G('plain'),cW=CC('#f2f0ec'),cR=CC('#d64545'),r0=.278,h=.032,n=24;   // bordure rouge et blanche
  for(let k=0;k<n;k++){const a0=k/n*6.28318,a1=(k+1)/n*6.28318,A=V(Math.cos(a0)*r0,0,Math.sin(a0)*r0),B=V(Math.cos(a1)*r0,0,Math.sin(a1)*r0),C=V(Math.cos(a1)*r0,h,Math.sin(a1)*r0),D=V(Math.cos(a0)*r0,h,Math.sin(a0)*r0);quad(g,B,A,D,C,k%2?cR:cW);}
  cyl(0,0,h-.002,h,r0,r0,24,'#ece9e3','#7fbf5a');ico(0,h,0,.23,'#7cc05f',.16);
  const F=['#f15bb5','#fee440','#ff9f1c','#9b5de5','#ffffff','#e63946'];for(let k=0;k<12;k++){const a=k/12*6.283;ico(Math.cos(a)*.205,h+.012,Math.sin(a)*.205,.022,F[(k+(i%3))%F.length],.8);}
  if(v<.34)tree3(0,0,.1,R()<.3);
  else if(v<.58){bc(0,0,.05,.05,h,h+.05,'#cfc8bd');beam(-.03,h+.05,0,.05,h+.36,.02,.028,.028,'#e3b23c');beam(.03,h+.05,.01,-.05,h+.3,-.03,.024,.024,'#0e8c87');beam(0,h+.05,-.02,.01,h+.42,.05,.02,.02,'#f4f1ea');}   // sculpture
  else if(v<.8&&waterOK()){cyl(0,0,h,h+.05,.13,.13,16,'#d4cdc0','#57b9e3');cyl(0,0,h+.05,h+.16,.02,.015,8,'#d4cdc0');cone(0,0,h+.16,.1,.02,6,'#eaf8ff','basic');for(let k=0;k<6;k++){const a=k/6*6.283;cone(Math.cos(a)*.09,Math.sin(a)*.09,h+.05,.06,.01,5,'#eaf8ff','basic');}}
  else{for(const [x,z] of[[-.07,-.05],[.07,-.03],[0,.08]])tree3(x,z,.06,true);}
  TOP[i]=Math.max(TOP[i]||0,.4);
}
// =========================================================
// v13 (14 nov. 2026) : caméra fluide (Z Q S D), touche A = défi du maire, vraie lumière portée, monuments illuminés,
// fluidité (résolution adaptative, ombres, budget de reconstruction), décharge / décors / routes refaits, citoyens logiques,
// nouveaux personnages, joggeurs, familles, plage, bateaux, hélicoptère du CHU, ferme vivante
// =========================================================
// ── Caméra au clavier : vitesse qui monte et descend en douceur ──
const CAM_KEYS={z:1,w:1,arrowup:1,s:1,arrowdown:1,q:1,arrowleft:1,d:1,arrowright:1,e:1,a:1},KEYS=new Set(),KV={f:0,r:0,y:0};
function stepKeys(dt){
  if(!KEYS.size&&Math.abs(KV.f)+Math.abs(KV.r)+Math.abs(KV.y)<.002){KV.f=KV.r=KV.y=0;return;}
  if(document.body.dataset.screen!=='city'||/input|textarea|select/i.test((document.activeElement&&document.activeElement.tagName)||''))KEYS.clear();
  const h=k=>KEYS.has(k)?1:0,tf=Math.max(h('z'),h('w'),h('arrowup'))-Math.max(h('s'),h('arrowdown')),tr=Math.max(h('d'),h('arrowright'))-Math.max(h('q'),h('arrowleft')),ty=h('e')-h('a');
  const a=Math.min(1,dt*(KEYS.size?7:9));KV.f+=(tf-KV.f)*a;KV.r+=(tr-KV.r)*a;KV.y+=(ty-KV.y)*a;
  const sp=CAM.dist*.9*dt,fx=-Math.sin(CAM.yaw),fz=-Math.cos(CAM.yaw),rx=Math.cos(CAM.yaw),rz=-Math.sin(CAM.yaw);
  CAM.x+=(fx*KV.f+rx*KV.r)*sp;CAM.z+=(fz*KV.f+rz*KV.r)*sp;CAM.yaw+=KV.y*dt*1.5;E.tw=null;clampCam();applyCam();
}
// ── Fluidité : résolution qui baisse si les images arrivent trop lentement ; ombres recalculées une image sur deux à l'arrêt ──
function adaptRes(dt){
  if(!E.ar)E.ar={acc:0,n:0,good:0,pr:E.renderer.getPixelRatio(),max:Math.min(window.devicePixelRatio||1,LOWQ?1.25:2),min:LOWQ?.75:1};
  const A=E.ar;if(document.hidden||dt<=0||dt>=.1)return;A.acc+=dt;A.n++;if(A.acc<2)return;const avg=A.acc/A.n;A.acc=0;A.n=0;
  let pr=A.pr;if(avg>.026&&pr>A.min){pr=Math.max(A.min,pr-.25);A.good=0;}else if(avg<.0145&&pr<A.max){if(++A.good>=3){pr=Math.min(A.max,pr+.25);A.good=0;}}else A.good=0;
  if(pr!==A.pr){A.pr=pr;E.renderer.setPixelRatio(pr);resize();}
}
function shadowGate(){const R=E.renderer;if(!R.shadowMap.enabled)return;R.shadowMap.autoUpdate=false;
  const key=CAM.x.toFixed(2)+'|'+CAM.z.toFixed(2)+'|'+CAM.dist.toFixed(1)+'|'+CAM.yaw.toFixed(2);E.shF=(E.shF||0)+1;if(key!==E.shK||E.shF%2===0){R.shadowMap.needsUpdate=true;E.shK=key;}}
// ── Lumière portée (carte de lumière 256 × 256 sur toute la ville) : lampadaires, vitrines, monuments illuminés ──
// rgb = couleur reçue, a = hauteur éclairée (× 12). Ajoutée dans les matériaux du sol, des bâtiments et des arbres (lmInject) la nuit.
const LM_N=256,LM_S=LM_N/N,LM_F=new Float32Array(LM_N*LM_N*4),LM_D=new Uint8Array(LM_N*LM_N*4),LMU={value:null},LMK={value:0};
{const t_=new THREE.DataTexture(LM_D,LM_N,LM_N);t_.magFilter=THREE.LinearFilter;t_.minFilter=THREE.LinearFilter;t_.needsUpdate=true;LMU.value=t_;}
function lmInject(sh){sh.uniforms.uLM=LMU;sh.uniforms.uLMk=LMK;
  sh.vertexShader='varying vec3 vLW;\n'+sh.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n{vec4 lw_=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nlw_=instanceMatrix*lw_;\n#endif\nvLW=(modelMatrix*lw_).xyz;}');
  sh.fragmentShader='uniform sampler2D uLM;\nuniform float uLMk;\nvarying vec3 vLW;\n'+sh.fragmentShader.replace('#include <opaque_fragment>','if(uLMk>.001){vec4 lm_=texture2D(uLM,vLW.xz/64.);float fl_=clamp(1.-vLW.y/max(lm_.a*12.,.05),0.,1.)*(1.-.55*smoothstep(.6,.9,vWN.y)*step(1.6,lm_.a*12.));outgoingLight+=min(diffuseColor.rgb*min(lm_.rgb,vec3(.7))*(uLMk*1.15*fl_*(1.-.6*uSnow)),vec3(.32));}\n#include <opaque_fragment>');}
function lmSplat(x,z,sig,r,g,b,reach){const px=x*LM_S,pz=z*LM_S,sg=sig*LM_S,R=Math.ceil(sg*2.6),k2=1/(2*sg*sg);
  for(let j=Math.max(0,Math.floor(pz-R));j<=Math.min(LM_N-1,Math.ceil(pz+R));j++)for(let i=Math.max(0,Math.floor(px-R));i<=Math.min(LM_N-1,Math.ceil(px+R));i++){
    const dx=i+.5-px,dz=j+.5-pz,w=Math.exp(-(dx*dx+dz*dz)*k2);if(w<.02)continue;const o=(j*LM_N+i)*4;LM_F[o]+=r*w;LM_F[o+1]+=g*w;LM_F[o+2]+=b*w;if(reach>LM_F[o+3])LM_F[o+3]=reach;}}
function lmRect(x0,z0,x1,z1,r,g,b,reach){const f=.3;
  for(let j=Math.max(0,Math.floor((z0-f)*LM_S));j<=Math.min(LM_N-1,Math.ceil((z1+f)*LM_S));j++)for(let i=Math.max(0,Math.floor((x0-f)*LM_S));i<=Math.min(LM_N-1,Math.ceil((x1+f)*LM_S));i++){
    const wx=(i+.5)/LM_S,wz=(j+.5)/LM_S,d=Math.hypot(Math.max(x0-wx,0,wx-x1),Math.max(z0-wz,0,wz-z1)),w=Math.max(0,1-d/f);if(w<=0)continue;const o=(j*LM_N+i)*4;LM_F[o]+=r*w;LM_F[o+1]+=g*w;LM_F[o+2]+=b*w;if(reach>LM_F[o+3])LM_F[o+3]=reach;}}
const LIT_T=new Set(['mairie','musee','gare','cinema','biblio','fac','statue','duelstatue','arc','tower','observ','stadium','chu','pool','reeduc','anato','wheel','funfair','plaza','marina','school','lycee','hospital','poste']);
function lmBuild(PL){
  LM_F.fill(0);
  for(let k=0;k<PL.length;k+=2)lmSplat(PL[k],PL[k+1],.47,1.15,.8,.46,.8);                                            // lampadaires : lumière chaude
  if(E&&E.xmasL)for(let k=0;k<E.xmasL.length;k+=2)lmSplat(E.xmasL[k],E.xmasL[k+1],.34,.55,.38,.2,.75);   /* v15 : guirlandes et sapin de Noël */
  for(let i=0;i<NN;i++)if(zone[i]===ZC&&lvl[i]&&pw[i]&&st[i]!==RUIN)lmSplat(i%N+.5,((i/N)|0)+.5,.36,.32,.27,.2,.55);   // vitrines des commerces
  for(const s of SV.values()){const b=BT[s.t];if(!b||!(b.cat==='monuments'||LIT_T.has(s.t))||svcOK.get(s.id)===false)continue;   // monuments et grands bâtiments mis en lumière
    const top=Math.min(11.5,(TOP[s.z*N+s.x]||1)+.3),cool=s.t==='tower'||s.t==='chu'||s.t==='stadium';lmRect(s.x+.08,s.z+.08,s.x+s.w-.08,s.z+s.d-.08,cool?.42:.6,cool?.5:.52,cool?.6:.42,top);}
  for(let o=0;o<LM_D.length;o+=4){LM_D[o]=Math.min(255,LM_F[o]*170)|0;LM_D[o+1]=Math.min(255,LM_F[o+1]*170)|0;LM_D[o+2]=Math.min(255,LM_F[o+2]*170)|0;LM_D[o+3]=Math.min(255,LM_F[o+3]/12*255)|0;}
  LMU.value.needsUpdate=true;
}
// ── Aides v13 : sous-repère tourné, banc de parc, lampadaire de parc, camion-benne ──
function sub(x,z,k,fn){const s=[TX.x,TX.z,TX.k],p=P(x,z);TX.x=p[0];TX.z=p[1];TX.k=(s[2]+k)&3;fn();[TX.x,TX.z,TX.k]=s;}
function benchM(){const W='#8a5a3b',M='#3d4650';for(const x of[-.068,.068]){bc(x,0,.004,.022,0,.032,M);bc(x,-.021,.004,.004,.032,.074,M);}
  for(let k=0;k<3;k++)bx(-.09,-.019+k*.013,.09,-.009+k*.013,.032,.038,W);for(let k=0;k<2;k++)bx(-.09,-.026,.09,-.021,.046+k*.014,.055+k*.014,W);}
function parkLamp(on){const c='#2f3d36';cyl(0,0,0,.03,.022,.018,8,c);cyl(0,0,.03,.3,.007,.006,8,c);cyl(0,0,.15,.16,.012,.012,8,c);
  bc(0,0,.024,.024,.3,.305,c);bc(0,0,.02,.02,.305,.355,on?'#fff1c9':'#c9c4b8',on?'glass':null);for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]])bc(a*.019,b*.019,.003,.003,.305,.355,c);cone(0,0,.355,.035,.032,8,c);ico(0,.395,0,.008,c);}
function garbTruck(x,z,along){sub(x,z,along?1:0,()=>{bc(0,.07,.045,.035,.015,.11,'#f4f6f8');bx(-.044,.093,.044,.106,.06,.095,'#2e3b47');bc(0,-.035,.05,.075,.02,.13,'#3fa34d');bx(-.051,-.11,.051,-.1,.03,.12,'#2e7d32');
  for(const [a,b] of[[-1,.07],[1,.07],[-1,-.06],[1,-.06]])tube(a*.05,.022,b,a*.042,.022,b,.022,8,'#1d2024');bc(0,.11,.04,.004,.03,.05,'#d9dde0');});}
Object.assign(SVB,{
  landfill(r){   // décharge (v13) : alvéole en exploitation (tas aux formes naturelles, déchets posés sur la surface), compacteur, alvéole fermée enherbée
    // avec évents et torchère, bassin de lixiviats bâché, piste gravillonnée, pont-bascule, bureau, filet anti-envol, haie
    const H=[[-.55,-.45,.62,.5],[-.95,-.2,.42,.36],[-.2,-.85,.45,.38],[-.85,-.9,.38,.3],[-.25,-.15,.4,.32]];   // [x, z, rayon, hauteur]
    const hAt=(x,z)=>{let h=0;for(const [cx,cz,rr,hh] of H){const d=(x-cx)*(x-cx)+(z-cz)*(z-cz);if(d<rr*rr)h=Math.max(h,hh*Math.sqrt(1-d/(rr*rr)));}return h;};
    H.forEach(([cx,cz,rr,hh],k)=>dome(cx,cz,0,rr,14,k%2?'#8a8172':'#7f776a',hh/rr));
    const T=['#c9c4ba','#9aa0a6','#e9e6df','#5f7f99','#4f7d5a','#8d6e4f','#b9a68a','#6b6f75','#d8cfc0','#3b5f8a'];
    for(let k=0;k<70;k++){const a=r()*6.283,dd=Math.sqrt(r()),[cx,cz,rr]=H[k%H.length],x=cx+Math.cos(a)*rr*.85*dd,z=cz+Math.sin(a)*rr*.85*dd,y=hAt(x,z);if(y<.02)continue;const s=.012+r()*.018;bc(x,z,s,s*(.6+r()*.8),y-.006,y+.006+r()*.008,pick(r,T));}
    const by=hAt(-.5,-.4);sub(-.5,-.4,0,()=>{bc(0,0,.055,.04,by,by+.05,'#f2b134');bc(-.012,0,.028,.03,by+.05,by+.1,'#f2b134');bx(-.038,-.029,.016,.029,by+.062,by+.09,'#2e3b47');for(const z of[-.046,.046])bc(0,z,.068,.012,by-.006,by+.026,'#2b2b2b');bx(.06,-.05,.07,.05,by,by+.045,'#c9a227');beam(.035,by+.03,0,.06,by+.02,0,.01,.03,'#c9a227');});
    dome(.62,-.62,0,.62,16,'#7cbb62',.36);dome(.95,-.25,0,.42,14,'#86c46a',.4);
    const C=[[.62,-.62,.62,.223],[.95,-.25,.42,.168]],cAt=(x,z)=>{let h=0;for(const [cx,cz,rr,hh] of C){const d=(x-cx)**2+(z-cz)**2;if(d<rr*rr)h=Math.max(h,hh*Math.sqrt(1-d/(rr*rr)));}return h;};
    for(const [x,z] of[[.5,-.7],[.78,-.45],[.6,-.95],[.95,-.2]]){const y=cAt(x,z);tube(x,y-.03,z,x,y+.09,z,.01,6,'#9aa0a6');bc(x,z,.016,.016,y+.09,y+.1,'#6b7178');}
    cyl(1.25,-1.2,0,.42,.025,.02,8,'#8d949b');cyl(1.25,-1.2,.42,.45,.035,.035,8,'#6d7378');
    bx(.28,.3,1.02,.88,0,.035,'#2b2f33');bx(.33,.35,.97,.83,.035,.038,'#4f6b55');for(const [a,b,c,d] of[[.28,.3,1.02,.3],[.28,.88,1.02,.88],[.28,.3,.28,.88],[1.02,.3,1.02,.88]])bx(Math.min(a,c)-.006,Math.min(b,d)-.006,Math.max(a,c)+.006,Math.max(b,d)+.006,.035,.05,'#1f2327');
    bx(-.2,.5,.2,1.47,0,.007,'#a8a08f');bx(-1.45,.72,-.2,.98,0,.007,'#a8a08f');for(let k=0;k<5;k++)bx(-1.38+k*.24,.83,-1.3+k*.24,.87,.007,.009,'#8f8776');   /* v14 : entrée refaite */
    bx(-.16,.96,.16,1.3,0,.02,'#7d858d');bx(-.14,.98,.14,1.28,.02,.022,'#9aa3ab');
    bc(.25,1.38,.03,.03,0,.12,'#f2f2f2');bc(.25,1.38,.012,.012,.12,.135,'#3d4650');for(let k=0;k<4;k++){const x0=.23-k*.11;beam(x0,.115,1.38,x0-.11,.115,1.38,.014,.014,k%2?'#ffffff':'#e63946');}bc(-.24,1.38,.01,.01,0,.11,'#3d4650');
    bc(.62,1.12,.19,.085,0,.17,'#e9eef2',FRs(),'#c9d1d6');bx(.42,1.02,.82,1.22,.17,.18,'#cfd6dc');bx(.42,1.115,.43,1.2,.06,.14,'#9fc9de','glass');bx(.42,1.04,.425,1.1,0,.12,'#3d4650');
    garbTruck(0,1.13,false);garbTruck(-.85,.85,true);garbTruck(-.3,.42,false);
    for(let k=0;k<9;k++){const x=-1.42+k*.35;bc(x,-1.42,.008,.008,0,.36,'#6b7178');}bx(-1.42,-1.43,1.42,-1.418,.08,.36,'#59616a');
    for(let k=0;k<7;k++)tree3(-1.36,-1.2+k*.27,.06,true);
    fence(-1.47,-1.47,1.47,1.47,.13,'#8d949b',.4);return .7;},
});
// ── Décors (v13) : massifs bordés de pierre, bancs à lattes, fontaine octogonale, lampadaires de parc, statue en bronze,
// haie taillée, kiosque à musique en fonte ──
/* v15 : decoModel est dans le bloc v15 (décors plus détaillés) */
// ── Routes en 3D (v13) : terre-plein central surélevé des avenues, bornes des pistes cyclables, panneaux aux carrefours ──
function roadDecor3D(i,x,z){
  if(ter[i]||mtn[i]||dg[i])return;const m=roadMask(x,z);TX.x=x+.5;TX.z=z+.5;
  if(road[i]===3&&(m===5||m===10)&&!lane[i]&&!rail[i]){TX.k=m===5?0:1;bx(-.09,-.5,.09,.5,0,.024,'#c9cfc3',null,'#78bf5c');for(const zz of[-.32,.32])ico(0,.03,zz,.05,'#4f9a45',.7);for(let k=0;k<4;k++)ico(.04*(k%2?1:-1),.03,-.2+k*.13,.015,['#f15bb5','#fee440','#ffffff','#ff9f1c'][k],.8);}
  if(lane[i]===1&&(m===5||m===10)&&((x+z)&1)===0){TX.k=m===5?0:1;for(const s of[-1,1])for(const zz of[-.3,.1])bc(s*.285,zz,.008,.008,0,.05,'#f4f6f8');}
  if(road[i]===1&&!SIG[i]&&!rx[i]&&!lane[i]){const cnt=(m&1?1:0)+(m&2?1:0)+(m&4?1:0)+(m&8?1:0);
    if(cnt>=3&&((x*5+z*3)&1)===0){TX.k=0;const sp=(px,pz,fx)=>{bc(px,pz,.005,.005,0,.25,'#8d949b');if(fx){bx(px-.004,pz-.032,px+.004,pz+.032,.19,.25,'#ffffff');bx(px-.006,pz-.027,px+.006,pz+.027,.195,.245,'#d62828');}else{bx(px-.032,pz-.004,px+.032,pz+.004,.19,.25,'#ffffff');bx(px-.027,pz-.006,px+.027,pz+.006,.195,.245,'#d62828');}};   // panneau stop pour la route secondaire, à droite de l'arrivée
      if(m&1&&m&4){if(m&8)sp(-.42,.42,true);if(m&2)sp(.42,-.42,true);}else{if(m&1)sp(-.42,-.42,false);if(m&4)sp(.42,.42,false);}}}
  TX.k=0;
}
// ── Citoyens (v13) : de vrais trajets (de chez eux vers un commerce, un parc, un service ou le travail), traversée au feu vert,
// joggeurs le matin et le soir, familles avec poussette le week-end ──
const HSTROL=['#3b8fdc','#e05a8a','#2a9d8f','#f2b134','#6b7178','#9b5de5'];
function strollerMesh(){GB=new Map();TX.x=0;TX.z=0;TX.k=0;
  for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]])tube(a*.017,.009,b*.022,a*.021,.009,b*.022,.009,6,'#2b2b2b');
  bc(0,0,.016,.026,.02,.024,'#3d4650');bc(0,.004,.017,.027,.03,.058,'#ffffff');wedge(-.018,-.022,.018,.006,.058,.082,.058,'#ffffff');bc(0,-.03,.003,.003,.03,.085,'#3d4650');bx(-.016,-.034,.016,-.03,.083,.088,'#3d4650');
  const g=toGeo(GB.get('plain'));GB=null;const M=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({vertexColors:true}),60);M.count=0;M.frustumCulled=false;M.setColorAt(0,new THREE.Color('#fff'));E.gC.add(M);return M;}
function walkSpawn(F){
  const vet=S.prof==='veto',h=hourNow(),we=weekend(),night=h<6||h>=22.5;
  const want=VISIT?0:Math.round(Math.min(64,ST.pop/45*(vet?1.2:1))*(night?.2:1));
  if(F.walk.length>want+6)for(const w of F.walk){if(F.walk.length-F.walk.filter(q=>q.done).length<=want)break;if(w.st==='inside'||w.st==='leave')w.done=true;}if(F.walk.length>=want)return;   /* v15 : on ne fait plus disparaître les piétons en pleine rue */
  const L=residentialLots();if(!L.length)return;for(let k=0;k<4&&F.walk.length<want;k++){const w=walkNew(L,h,we,vet);if(w)F.walk.push(w);}
}
/* v15 : walkDest, doorPt, walkPos, walkNew et walkStep sont dans le bloc v15 (portes, trottoirs, passages piétons) */
// ── Plage animée l'été (juin à août, en journée, sans pluie) : serviettes, parasols, baigneurs allongés, promeneurs, nageurs ──
function beachStep(run){
  const mo=month(),h=hourNow(),wx=S.wx&&S.wx.k,on=!VISIT&&mo>=5&&mo<=7&&h>=9&&h<19.5&&wx!=='rain'&&wx!=='storm'&&SNOW.value<.2;
  if(!E.beach){if(!on)return;GB=new Map();TX.x=0;TX.z=0;TX.k=0;bx(-.026,-.055,.026,.055,.004,.008,'#ffffff');const tg=toGeo(GB.get('plain'));
    GB=new Map();bc(0,0,.003,.003,0,.13,'#d0d0d0');cone2(0,0,.12,.035,.075,8,'#ffffff','#e9e4da');const ug=toGeo(GB.get('plain'));GB=null;
    const mk=(g,n)=>{const M=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({vertexColors:true}),n);M.count=0;M.frustumCulled=false;M.setColorAt(0,new THREE.Color('#fff'));E.gC.add(M);return M;};
    E.beach={tow:mk(tg,60),umb:mk(ug,30),list:null,key:''};}
  const Bc=E.beach;if(!on){Bc.tow.count=Bc.umb.count=0;Bc.list=null;return;}
  const key=(S.day|0)+'|'+(E.roadList?E.roadList.length:0);
  if(Bc.key!==key||!Bc.list){Bc.key=key;const R=rng((S.day|0)*31+7),sand=[],sea=[];
    for(let i=0;i<NN;i++){const x=i%N,z=(i/N)|0;if(!inArea(x,z))continue;if(!ter[i]&&wdist[i]===1&&!road[i]&&!svcAt[i]&&!zone[i]&&!lvl[i]&&!deco[i]&&!hill[i]&&!mtn[i])sand.push(i);else if(ter[i]&&(wdist[i]===0)){for(const j of[i-1,i+1,i-N,i+N])if(j>=0&&j<NN&&!ter[j]&&wdist[j]===1){sea.push(i);break;}}}
    const L=[];const tc=['#e63946','#f2b134','#2e86ab','#3fa34d','#ff7ad9','#ffffff','#9b5de5'];
    const pickT=Math.min(24,sand.length);for(let k=0;k<pickT;k++){const i=sand[(R()*sand.length)|0],x=i%N+.2+R()*.6,z=((i/N)|0)+.2+R()*.6,a=R()*6.28;
      L.push({k:'tow',x,z,a,c:pick(R,tc)});if(R()<.55)L.push({k:'umb',x:x+.05,z:z+.05,c:pick(R,tc)});
      L.push({k:'lie',x,z,a,L:humLook((R()*1e9)|0,{kid:false,v:pick(R,[5,9,10,1,5])})});if(R()<.3)L.push({k:'sit',x:x+.07,z:z-.05,a:a+1.2,L:humLook((R()*1e9)|0,{v:pick(R,[5,9,10,1])})});}
    for(let k=0;k<Math.min(12,sea.length);k++){const i=sea[(R()*sea.length)|0];L.push({k:'swim',x:i%N+.2+R()*.6,z:((i/N)|0)+.2+R()*.6,a:R()*6.28,L:humLook((R()*1e9)|0,{v:5}),ph:R()*6});}
    for(let k=0;k<Math.min(8,sand.length);k++){const i=sand[(R()*sand.length)|0];L.push({k:'stand',x:i%N+.3+R()*.4,z:((i/N)|0)+.3+R()*.4,a:R()*6.28,L:humLook((R()*1e9)|0,{v:pick(R,[5,9,10,1,3])})});}
    Bc.list=L;}
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(1,1,1),c=new THREE.Color();let nt=0,nu=0;
  for(const o of Bc.list){
    if(o.k==='tow'&&nt<60){e.set(0,o.a,0);q.setFromEuler(e);p.set(o.x,0,o.z);m.compose(p,q,s);Bc.tow.setMatrixAt(nt,m);Bc.tow.setColorAt(nt,c.set(o.c));nt++;}
    else if(o.k==='umb'&&nu<30){e.set(0,0,0);q.setFromEuler(e);p.set(o.x,0,o.z);m.compose(p,q,s);Bc.umb.setMatrixAt(nu,m);Bc.umb.setColorAt(nu,c.set(o.c));nu++;}
    else if(o.k==='lie')humPut(o.L,o.x+Math.sin(o.a)*.045,.012,o.z+Math.cos(o.a)*.045,o.a,.8,0,0,true);
    else if(o.k==='sit')humPut(o.L,o.x,-.02,o.z,o.a,.8,0,0);
    else if(o.k==='swim'){o.ph+=run*2;humPut(o.L,o.x+Math.sin(o.ph*.2)*.05,-.165+Math.sin(o.ph)*.004,o.z,o.a+Math.sin(o.ph*.1),.8,o.ph,.35);}
    else if(o.k==='stand')humPut(o.L,o.x,0,o.z,o.a,.8,0,0);
  }
  Bc.tow.count=nt;Bc.umb.count=nu;[Bc.tow,Bc.umb].forEach(M=>{M.instanceMatrix.needsUpdate=true;if(M.instanceColor)M.instanceColor.needsUpdate=true;});
}
// ── Bateaux (v13) : yacht, péniche, chalutier, remorqueur, catamaran en plus des vedettes et voiliers ──
function boatTypes(motor,sail){
  const yacht=boatMesh(()=>{hull(.3,.085,'#ffffff','#ece6dc');bc(0,-.03,.07,.15,.028,.076,'#f6f7f8');bx(-.071,-.17,.071,.1,.046,.064,'#2b3a46');bc(0,-.06,.056,.09,.076,.108,'#f6f7f8');
    bx(-.057,-.13,.057,.0,.084,.1,'#2b3a46');bx(-.056,-.15,.056,-.146,.108,.126,'#d0d4d8');beam(-.05,.108,-.1,0,.16,-.1,.008,.008,'#f6f7f8');beam(.05,.108,-.1,0,.16,-.1,.008,.008,'#f6f7f8');
    bc(0,-.2,.06,.02,-.006,.008,'#c99a6a');bc(-.086,0,.003,.006,.04,.048,'#ff3b30');bc(.086,0,.003,.006,.04,.048,'#2ecc71');},8);
  const barge=boatMesh(()=>{bc(0,0,.075,.4,-.05,.03,'#2b2f33');wedge(-.07,.4,.07,.46,-.04,.03,.03,'#2b2f33');bx(-.077,-.4,.077,.4,.024,.034,'#c0392b');
    bx(-.062,-.17,.062,.38,.03,.04,'#3d4650');bc(0,.1,.055,.25,.04,.052,'#c9a978');ico(0,.052,.1,.06,'#c9a978',.55);ico(0,.052,.26,.05,'#c9a978',.55);
    bc(0,-.32,.06,.06,.03,.1,'#f4f6f8');bx(-.061,-.35,.061,-.26,.068,.088,'#2b3a46');bc(0,-.32,.064,.064,.1,.106,'#c0392b');bc(0,-.39,.003,.003,.03,.16,'#d0d0d0');bx(.003,-.39,.04,-.388,.13,.16,'#2c4fa3');
    bc(0,-.2,.024,.044,.03,.058,'#3b8fdc');bc(0,-.204,.02,.024,.058,.07,'#2e3a46');},6);
  const trawl=boatMesh(()=>{hull(.24,.075,'#c0392b','#9aa0a6');bc(0,.06,.045,.045,.028,.11,'#ffffff');bx(-.046,.06,.046,.106,.074,.094,'#2b3a46');bc(0,.06,.048,.048,.11,.116,'#c0392b');
    bc(0,-.02,.005,.005,.028,.3,'#d0d0d0');for(const s of[-1,1])beam(0,.27,-.02,s*.13,.11,-.05,.006,.006,'#d0d0d0');tube(-.045,.052,-.11,.045,.052,-.11,.026,10,'#2f5d4a');
    for(const s of[-1,1])beam(s*.06,.028,-.15,s*.06,.16,-.15,.008,.008,'#f2b134');bx(-.06,-.155,.06,-.145,.155,.165,'#f2b134');},6);
  const tug=boatMesh(()=>{hull(.17,.08,'#1f2933','#c0392b');bc(0,.02,.055,.07,.028,.085,'#f4f6f8');bc(0,.04,.05,.035,.085,.125,'#f4f6f8');bx(-.051,.008,.051,.076,.1,.116,'#2b3a46');
    cyl(0,-.035,.085,.15,.018,.016,8,'#c0392b','#1f2933');for(let k=0;k<5;k++){const z=-.07+k*.045;for(const s of[-1,1])tube(s*.078,.014,z,s*.09,.014,z,.012,8,'#1d1d1d');}},6);
  const cata=boatMesh(()=>{for(const s of[-1,1]){bc(s*.065,0,.021,.2,-.05,.02,'#ffffff');wedge(s*.065-.015,.2,s*.065+.015,.24,-.04,.02,.02,'#ffffff');}
    bx(-.065,-.14,.065,.08,.015,.03,'#e9e4da');bx(-.06,.08,.06,.18,.018,.022,'#3d4650');bc(0,-.04,.05,.06,.03,.066,'#f4f6f8');bx(-.051,-.03,.051,.02,.044,.06,'#2b3a46');
    bc(0,.05,.005,.005,.03,.56,'#d0d4d8');const g=G('plain'),w=CC('#fbf8f0'),w2=CC('#f1ece0');tri(g,[0,.08,.06],[0,.52,.055],[0,.08,-.12],w);tri(g,[0,.08,-.12],[0,.52,.055],[0,.08,.06],w);
    tri(g,[0,.46,.06],[0,.07,.21],[0,.07,.07],w2);tri(g,[0,.07,.07],[0,.07,.21],[0,.46,.06],w2);},6);
  return{motor,sail,yacht,barge,trawl,tug,cata};
}
const BOAT_SP={motor:[.35,.25],sail:[.22,.1],yacht:[.28,.1],barge:[.12,.04],trawl:[.18,.06],tug:[.2,.06],cata:[.26,.08]},BOAT_WL={motor:.124,sail:.155,yacht:.19,barge:.33,trawl:.15,tug:.13,cata:.17};
// ── Hélicoptère du CHU / de l'hôpital (v13) : décolle de l'héliport, va chercher un patient, revient se poser ──
function heliMake(){GB=new Map();TX.x=0;TX.z=0;TX.k=0;
  bc(0,0,.05,.09,.02,.085,'#e63946');bx(-.051,.03,.051,.09,.045,.08,'#2b3a46');bc(0,-.02,.052,.04,.05,.06,'#ffffff');bc(0,-.15,.012,.08,.05,.07,'#e63946');bc(0,-.225,.004,.02,.05,.105,'#ffffff');
  for(const s of[-1,1])bx(s*.04-.004,-.07,s*.04+.004,.07,0,.008,'#3d4650');for(const s of[-1,1])for(const z of[-.04,.04])bc(s*.04,z,.003,.003,.008,.025,'#3d4650');bc(0,0,.008,.008,.085,.1,'#3d4650');
  const g=toGeo(GB.get('plain'));GB=new Map();bx(-.16,-.007,.16,.007,0,.004,'#2b2b2b');bx(-.007,-.16,.007,.16,0,.004,'#2b2b2b');const rg=toGeo(GB.get('plain'));GB=null;
  const mat=new THREE.MeshLambertMaterial({vertexColors:true}),grp=new THREE.Group(),body=new THREE.Mesh(g,mat),rot=new THREE.Mesh(rg,mat);rot.position.y=.1;body.add(rot);body.castShadow=true;grp.add(body);
  const bl=new THREE.Mesh(new THREE.BoxGeometry(.012,.012,.012),new THREE.MeshBasicMaterial({color:'#ff3030'}));bl.position.set(0,.1,-.23);body.add(bl);grp.visible=false;grp.scale.setScalar(1.6);E.gD.add(grp);
  E.heli={grp,body,rot,bl,st:'idle',t:0,next:30+Math.random()*40,pad:null,tgt:null,x:0,y:0,z:0,a:0};}
function heliPads(){const L=[];for(const s of SV.values()){if((s.t==='chu'||s.t==='hospital')&&svcOK.get(s.id)!==false){TX.x=s.x+s.w/2;TX.z=s.z+s.d/2;TX.k=s.rot|0;const p=s.t==='chu'?P(.92,-1.25):P(-.4,-.55);L.push([p[0],Math.max(.3,(TOP[s.z*N+s.x]||1)-.13),p[1]]);}}return L;}
function stepHeli(dt,run){
  if(VISIT)return;if(!E.heli)heliMake();const H=E.heli;
  if(H.st==='idle'){H.grp.visible=false;H.next-=run;if(H.next>0)return;H.next=60+Math.random()*80;const pads=heliPads();if(!pads.length)return;const L=residentialLots();if(!L.length)return;
    H.pad=rpick(pads);const i=E.accI!=null&&road[E.accI]?E.accI:rpick(L);H.tgt=[i%N+.5,Math.max(.25,(TOP[i]||0)+.15),((i/N)|0)+.5];[H.x,H.y,H.z]=H.pad;H.st='up';H.t=0;}
  const [px,py,pz]=H.pad,[tx,ty,tz]=H.tgt,cr=Math.max(py,ty)+1;H.grp.visible=true;H.t+=run;
  const go=(x,z,sp)=>{const dx=x-H.x,dz=z-H.z,d=Math.hypot(dx,dz);if(d<.05)return true;const v=Math.min(d,run*sp);H.x+=dx/d*v;H.z+=dz/d*v;H.a=angLerp(H.a,Math.atan2(dx,dz),Math.min(1,run*2));return false;};
  if(H.st==='up'){H.y=Math.min(cr,H.y+run*.6);if(H.y>=cr)H.st='out';}
  else if(H.st==='out'){if(go(tx,tz,2.4))H.st='down';}
  else if(H.st==='down'){H.y=Math.max(ty,H.y-run*.5);if(H.y<=ty+.001){H.st='wait';H.t=0;}}
  else if(H.st==='wait'){if(H.t>6)H.st='up2';}
  else if(H.st==='up2'){H.y=Math.min(cr,H.y+run*.6);if(H.y>=cr)H.st='back';}
  else if(H.st==='back'){if(go(px,pz,2.4))H.st='land';}
  else if(H.st==='land'){H.y=Math.max(py,H.y-run*.45);if(H.y<=py+.001){H.st='idle';H.grp.visible=false;}}
  const tilt=H.st==='out'||H.st==='back'?.18:0;H.grp.position.set(H.x,H.y,H.z);H.grp.rotation.set(tilt,H.a,0,'YXZ');H.rot.rotation.y+=run*28;H.bl.visible=((E.t*2)|0)%2===0;
}
// ── Ferme vivante (v13) : champs qui changent avec les saisons, tracteur qui laboure au printemps et moissonne en été ──
function farmCrop(k){const m=month(),ph=(m+(k%2)*1)%12;   // couleurs : labour, pousse, blé mûr, chaume
  return ph<=1||ph>=10?['#7a5a3e','#8a6a4a']:ph<=3?['#7a5a3e','#7fb85a']:ph<=5?['#5d8f3a','#8bbf4e']:ph<=7?['#c9a34a','#e0c25a']:['#9a8358','#b8a46a'];}
function stepFarm(run){
  const farms=VISIT?[]:[...SV.values()].filter(s=>s.t==='ferme');const mo=month();
  if(E.farmM!==mo){E.farmM=mo;farms.forEach(s=>touchSvc(s));}
  if(!E.tract){if(!farms.length)return;GB=new Map();TX.x=0;TX.z=0;TX.k=0;bc(0,.02,.035,.05,.03,.075,'#3fa34d');bc(0,-.02,.03,.03,.075,.13,'#a9d3e6');bc(0,-.02,.033,.033,.13,.136,'#3fa34d');
      for(const s of[-1,1]){tube(s*.035,.04,-.03,s*.05,.04,-.03,.04,10,'#1d2024');tube(s*.03,.022,.055,s*.042,.022,.055,.022,8,'#1d2024');}bc(0,.075,.02,.006,.07,.1,'#555555');bx(-.07,-.13,.07,-.09,.0,.03,'#c9a227');for(let k=0;k<5;k++)bc(-.06+k*.03,-.12,.004,.01,0,.02,'#6b6f75');
      const g=toGeo(GB.get('plain'));GB=null;E.tract=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({vertexColors:true}),8);E.tract.count=0;E.tract.frustumCulled=false;E.tract.castShadow=true;E.gC.add(E.tract);E.tractU={};}
  const T=E.tract,h=hourNow(),work=h>=7&&h<19.5&&(mo>=2&&mo<=4||mo>=6&&mo<=8)&&SNOW.value<.3;let n=0;
  if(work)for(const s of farms){if(n>=8)break;let u=(E.tractU[s.id]||0)+run*.012;E.tractU[s.id]=u;u=u%1;
    const k=(s.id+((S.day/7)|0))%4,x0=-1.45+(k%2)*.72,z0=-1.45+((k/2)|0)*.72,row=Math.floor(u*6),f=(u*6)%1,fwd=row%2===0,lx=x0+.06+(fwd?f:1-f)*.56,lz=z0+.07+row*.11;
    TX.x=s.x+s.w/2;TX.z=s.z+s.d/2;TX.k=s.rot|0;const p=P(lx,lz),q0=P(lx+(fwd?1:-1),lz),ang=Math.atan2(q0[0]-p[0],q0[1]-p[1]);
    _e6.set(0,ang,0);_q6.setFromEuler(_e6);_p6.set(p[0],.02,p[1]);_s6.setScalar(1.1);_m6.compose(_p6,_q6,_s6);T.setMatrixAt(n++,_m6);}
  T.count=n;T.instanceMatrix.needsUpdate=true;
}
// =========================================================
// v14 (14 nov. 2026) : images 3D dans tout le menu (décors, terrain, routes, rond-point, feux), lumière de nuit plus douce,
// camions qui tournent en douceur, entrée de la décharge, piétons qui sortent de chez eux et entrent à destination
// =========================================================
// ── Vignettes 3D génériques : la même petite scène que pour les bâtiments, avec un dessin au choix ──
function thumbGen(key,w,build){
  if(THUMBS.has(key))return THUMBS.get(key);
  if(!E)return null;
  let url=null;const keep=[GB,CUR,TX.x,TX.z,TX.k,OVC,DK],t0=TOP[0];
  try{
    if(!TH_R){const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(1);r.setSize(176,128);r.outputColorSpace=E.renderer.outputColorSpace;
      const sc=new THREE.Scene(),sun=new THREE.DirectionalLight('#fff3df',2.3);sc.add(new THREE.HemisphereLight('#ffffff','#7f9a78',1.5));sun.position.set(4,7,5);sc.add(sun);
      TH_R={r,sc,cam:new THREE.PerspectiveCamera(28,176/128,.05,200),g:new THREE.Group()};sc.add(TH_R.g);}
    GB=new Map();CUR={emit:[],rot:[],wh:[]};TX.x=0;TX.z=0;TX.k=0;OVC=null;DK=0;
    THM=true;try{build();}finally{THM=false;}
    const g=TH_R.g;while(g.children.length){const m=g.children.pop();m.geometry.dispose();}
    const pr=key.startsWith('k:x:deco:')?.52:w*.78,plate=new THREE.Mesh(new THREE.CylinderGeometry(pr,pr,.02,40),new THREE.MeshLambertMaterial({color:'#cfe8c4'}));plate.position.y=-.011;g.add(plate);
    for(const [k,gg] of GB)if(gg.p.length)g.add(new THREE.Mesh(toGeo(gg),E.mat[k]||E.mat.plain));
    const box=new THREE.Box3().setFromObject(g),c=box.getCenter(new THREE.Vector3()),sz=box.getSize(new THREE.Vector3()),rad=Math.max(.35,sz.length()*.5);
    const cam=TH_R.cam,dist=rad/Math.tan(14*Math.PI/180);cam.position.set(c.x+dist*.58,c.y+dist*.5,c.z+dist*.64);cam.lookAt(c);
    TH_R.r.render(TH_R.sc,cam);url=TH_R.r.domElement.toDataURL('image/png');
    plate.geometry.dispose();plate.material.dispose();
  }catch(e){url=null;}
  [GB,CUR,TX.x,TX.z,TX.k,OVC,DK]=keep;TOP[0]=t0;
  THUMBS.set(key,url);return url;
}
function thRoad(av,ln){const L=.9,SW='#d3d6d8';
  bx(-L,-.5,L,-.344,0,.022,SW);bx(-L,.344,L,.5,0,.022,SW);bx(-L,-.344,L,.344,0,.012,ln===2?'#d9c8a5':'#5d646c');
  if(ln===2){for(let k=0;k<9;k++)bx(-L,-.344+k*.086,L,-.342+k*.086,.012,.0135,'#c4b08a');bx(-L,-.04,L,.04,.012,.014,'#c98a6a');umb(.25,.2,'#e63946');umb(-.35,-.18,'#2a9d8f');
    bc(-.65,.25,.07,.05,.012,.06,'#a0714f');for(const x of[-.7,-.6])ico(x,.07,.25,.02,'#f2b134');return;}
  if(av){bx(-L,-.09,L,.09,.012,.035,'#c9cfc3',null,'#78bf5c');for(const x of[-.5,.35])tree3(x,0,.07);for(const s of[-1,1])for(let k=0;k<4;k++)bx(-L+.1+k*.45,s*.22-.008,-L+.32+k*.45,s*.22+.008,.012,.0135,'#f3f1e7');}
  else for(let k=0;k<4;k++)bx(-L+.08+k*.45,-.01,-L+.33+k*.45,.01,.012,.0135,'#f3f1e7');
  if(ln===1)for(const s of[-1,1]){bx(-L,s*.3-.04,L,s*.3+.04,.012,.0135,'#3fae62');for(const x of[-.5,.4])bc(x,s*.3,.02,.012,.0135,.015,'#ffffff');for(const x of[-.7,-.2,.3,.8])bc(x,s*.255,.006,.006,0,.05,'#f4f6f8');}
  bc(-.6,-.42,.008,.008,.022,.37,'#3c4650');bx(-.6,-.426,-.49,-.414,.355,.366,'#3c4650');bx(-.53,-.44,-.47,-.4,.343,.358,'#2b3238');
}
function thDiag(av){const A=[-.6,.6],B=[.6,-.6];beam(A[0],.006,A[1],B[0],.006,B[1],1.0,.012,'#d3d6d8');beam(A[0],.012,A[1],B[0],.012,B[1],av?.86:.68,.012,'#5d646c');
  if(av){beam(A[0],.03,A[1],B[0],.03,B[1],.16,.024,'#78bf5c');tree3(-.2,.2,.07);tree3(.25,-.25,.07);}
  else for(let k=0;k<4;k++){const u0=k/4+.03,u1=u0+.15;beam(lerp(A[0],B[0],u0),.02,lerp(A[1],B[1],u0),lerp(A[0],B[0],u1),.02,lerp(A[1],B[1],u1),.02,.004,'#f3f1e7');}}
function thOvp(){bx(-.17,-.9,.17,.9,0,.012,'#5d646c');bx(-.5,-.9,-.17,.9,0,.02,'#d3d6d8');bx(.17,-.9,.5,.9,0,.02,'#d3d6d8');for(let k=0;k<4;k++)bx(-.01,-.85+k*.45,.01,-.62+k*.45,.012,.014,'#f3f1e7');
  bx(-.9,-.17,.9,.17,.34,.4,'#c4c9ce',null,'#5d646c');for(const s of[-1,1])bx(-.9,s*.17-.012,.9,s*.17+.012,.4,.45,'#e3e6e9');for(let k=0;k<4;k++)bx(-.85+k*.45,-.01,-.62+k*.45,.01,.4,.403,'#f3f1e7');
  for(const x of[-.6,.6]){bc(x,0,.05,.06,0,.31,'#b9bfc5');bc(x,0,.05,.16,.31,.34,'#aeb4ba');}bc(.2,.16,.006,.006,.45,.7,'#4a5058');bc(.2,.12,.02,.02,.68,.695,'#fff1c9');}
function thRx(){cyl(0,0,0,.012,.5,.5,24,'#5d646c','#5d646c');for(const [a,b] of[[1,0],[-1,0],[0,1],[0,-1]])bx(a?Math.min(0,a*.9):-.34,b?Math.min(0,b*.9):-.34,a?Math.max(0,a*.9):.34,b?Math.max(0,b*.9):.34,0,.0115,'#5d646c');
  for(const [x,z] of[[-.62,-.62],[.62,-.62],[.62,.62],[-.62,.62]])bc(x,z,.28,.28,0,.022,'#d3d6d8');roundaboutIsland(0);}
function thSig(){bx(-.9,-.344,.9,.344,0,.012,'#5d646c');bx(-.344,-.9,.344,.9,0,.012,'#5d646c');for(const [x,z] of[[-.62,-.62],[.62,-.62],[.62,.62],[-.62,.62]])bc(x,z,.28,.28,0,.022,'#d3d6d8');
  for(let k=0;k<5;k++){const u=-.28+k*.14;for(const s of[-1,1]){bx(u-.03,s*.42-.06,u+.03,s*.42+.06,.012,.014,'#f3f1e7');bx(s*.42-.06,u-.03,s*.42+.06,u+.03,.012,.014,'#f3f1e7');}}
  for(let p=0;p<4;p++)sigPole(p);for(const [x,z,c] of[[-.22,-.42,'#2ecc71'],[.42,-.22,'#ff3b30'],[.22,.42,'#2ecc71'],[-.42,.22,'#ff3b30']])bc(x,z,.012,.012,.43,.45,c,'basic');}
function thBull(){bx(-.45,-.45,.45,.45,0,.01,'#b8ad96');sub(0,0,0,()=>{bc(0,0,.11,.07,.01,.1,'#f2b134');bc(-.025,0,.05,.055,.1,.19,'#f2b134');bx(-.07,-.05,.02,.05,.12,.17,'#2e3b47');for(const z of[-.08,.08])bc(0,z,.13,.02,0,.05,'#2b2b2b');bx(.12,-.1,.14,.1,0,.08,'#c9a227');});}
const THB={
  'road:1':[1,()=>thRoad(false)],'x:lane:0':[1,()=>thRoad(false)],'road:3':[1,()=>thRoad(true)],'road:1:d':[1,()=>thDiag(false)],'road:3:d':[1,()=>thDiag(true)],
  'x:ovp:':[1,thOvp],'x:lane:1':[1,()=>thRoad(false,1)],'x:lane:2':[1,()=>thRoad(false,2)],'x:rx:2':[1,thRx],'x:rx:1':[1,thSig],
  'x:terra:hill':[1,()=>{dome(0,0,0,.62,16,'#7fb069',.68);dome(.12,-.08,0,.38,14,'#86b86f',1.15);ico(.05,.38,-.03,.12,'#a8a29a',.7);tree3(-.32,.3,.06,true);tree3(.35,.28,.05,true);}],
  'x:terra:flat':[1,thBull],
  'x:terra:dig':[1,()=>{bx(-.46,-.46,.46,.46,0,.014,'#e3d3a2');bx(-.38,-.38,.38,.38,.014,.018,'#4fb0d8');for(let k=0;k<6;k++)ico(-.42+k*.17,.016,-.42,.03,'#b9b2a5',.7);}],
  'x:terra:fill':[1,()=>{bx(-.46,-.46,0,.46,0,.012,'#4fb0d8');bx(0,-.46,.46,.46,0,.05,'#8a6a4a',null,'#9a7a55');ico(.22,.05,.05,.13,'#8a6a4a',.55);}],
};
function trayThumb(k){
  if(k.startsWith('place:'))return thumbFor(k.slice(6));
  if(k.startsWith('x:deco:')){const ty=+k.slice(7);return thumbGen('k:'+k,1,()=>decoModel(0,-.5,-.5,rng(9),ty));}
  const B=THB[k];return B?thumbGen('k:'+k,B[0],B[1]):null;
}
// =========================================================
// v15 (14 nov. 2026) : retours de l'utilisateur avec 20 captures — Noël, ronds-points, distance entre voitures, stationnement visible,
// piétons réalistes (portes, trottoirs, passages piétons), station de métro, parking du cinéma, menu des routes, décors, marathon
// =========================================================
const V15={pedX:new Map(),pk:[]};
// ── Ronds-points (v15) : les voitures tournent autour de l'îlot (sens inverse des aiguilles d'une montre) au lieu de le traverser ──
const RB_R=.375;
function rbPath(f,t){
  const a=DIRS[f],b=DIRS[t],ta=Math.atan2(a[1],a[0]),tb=Math.atan2(b[1],b[0]),fe=ta-Math.PI/4,fx=tb+Math.PI/4;
  let dl=(fe-fx)%(2*Math.PI);if(dl<0)dl+=2*Math.PI;if(dl>2*Math.PI-1e-6)dl=0;
  const E0=[a[0]*.5+a[1]*.17,a[1]*.5-a[0]*.17],X0=[b[0]*.5-b[1]*.17,b[1]*.5+b[0]*.17],cp=f_=>[Math.cos(f_)*RB_R,Math.sin(f_)*RB_R],tg=f_=>[Math.sin(f_),-Math.cos(f_)];
  const isect=(p,u,q,v)=>{const den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)<1e-4)return[(p[0]+q[0])/2,(p[1]+q[1])/2];const s=((q[0]-p[0])*v[1]-(q[1]-p[1])*v[0])/den;return[p[0]+u[0]*s,p[1]+u[1]*s];};
  const pts=[],bez=(p0,c,p1)=>{for(let k=0;k<=8;k++){const u=k/8,w=1-u;pts.push([w*w*p0[0]+2*w*u*c[0]+u*u*p1[0],w*w*p0[1]+2*w*u*c[1]+u*u*p1[1]]);}};
  const Pe=cp(fe),Px=cp(fe-dl);
  bez(E0,isect(E0,[-a[0],-a[1]],Pe,tg(fe)),Pe);
  const n=Math.max(1,Math.ceil(dl/.16));for(let k=1;k<=n;k++)pts.push(cp(fe-dl*k/n));
  const tx=tg(fe-dl);bez(Px,isect(Px,tx,X0,[-b[0],-b[1]]),X0);
  const cum=[0];for(let k=1;k<pts.length;k++)cum.push(cum[k-1]+Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]));
  return{pts,cum,len:cum[cum.length-1],pe:Pe};
}
const RBP=[0,1,2,3].map(f=>[0,1,2,3].map(t=>rbPath(f,t)));
function rbPos(c,o){const R=RBP[c.from][c.to],d=c.t*R.len,P_=R.pts,C_=R.cum;let k=1;while(k<C_.length-1&&C_[k]<d)k++;
  const s=C_[k]-C_[k-1]||1,u=clamp((d-C_[k-1])/s,0,1),ax=P_[k-1][0],az=P_[k-1][1],bx_=P_[k][0],bz=P_[k][1];
  o[0]=c.i%N+.5+lerp(ax,bx_,u);o[1]=((c.i/N)|0)+.5+lerp(az,bz,u);o[2]=Math.atan2(bx_-ax,bz-az);}
function onRb(c){return c.ov==null&&!c.tram&&rx[c.i]===2&&c.from<4&&c.to<4&&!SIG[c.i];}
// une voiture attend avant d'entrer si quelqu'un tourne déjà dans le rond-point juste à sa gauche
function rbBusy(j,f,me){const L=E._cg;if(!L)return false;const a=DIRS[f],fe=Math.atan2(a[1],a[0])-Math.PI/4,cx=j%N+.5,cz=((j/N)|0)+.5;
  const p1=[cx+Math.cos(fe)*RB_R,cz+Math.sin(fe)*RB_R],p2=[cx+Math.cos(fe+.85)*RB_R,cz+Math.sin(fe+.85)*RB_R];
  const A=L.get(j);if(!A)return false;for(const o of A){if(o===me||o.i!==j||o.ov!=null)continue;if(Math.hypot(o.px-p1[0],o.pz-p1[1])<.2||Math.hypot(o.px-p2[0],o.pz-p2[1])<.2)return true;}return false;}
// ── Distance de sécurité réelle (v15) : chaque véhicule regarde devant lui (même file, carrefour, rond-point, voiture qui se gare)
// et s'arrête avant de toucher l'autre. Blocage mutuel : le plus ancien passe ; au-delà de 4 s d'attente, on repart doucement.
function mvConf(f1,t1,f2,t2){if(f1>3||t1>3||f2>3||t2>3||f1===f2)return false;const rt=f=>(OPP(f)+1)%4,st_=f=>OPP(f),lt=f=>(OPP(f)+3)%4;
  if(t1===t2)return true;if(t1===rt(f1)||t2===rt(f2))return false;if(f2===OPP(f1)&&((t1===st_(f1)&&t2===st_(f2))||(t1===lt(f1)&&t2===lt(f2))))return false;return true;}
function boxConflict(j,f1,t1,me){const A=E._cg&&E._cg.get(j);if(!A)return false;for(const o of A){if(o===me||o.i!==j||o.ov!=null||o.t>.82)continue;if(mvConf(f1,t1,o.from,o.to))return true;}return false;}
function boxFull(j,me){if(armCnt(j)<3&&rx[j]!==2)return false;const A=E._cg&&E._cg.get(j);if(!A)return false;let n=0;for(const o of A){if(o===me||o.i!==j||o.ov!=null)continue;n++;if(o.bt>.3||o.by!=null)return true;}return n>=3;}
function carGrid(){const cg=new Map(),add=c=>{if(c.px==null)return;const k=Math.floor(c.pz)*N+Math.floor(c.px);let a=cg.get(k);if(!a)cg.set(k,a=[]);a.push(c);};
  for(const C of[E.cars,E.buses,E.taxis])if(C)for(const c of C.list)add(c);for(const c of V15.pk)add(c);E._cg=cg;}
function carRoom(c){
  if(c.px==null||!E._cg)return 9;const gh=c.ghost&&E.t<c.ghost,hx=Math.sin(c.pa),hz=Math.cos(c.pa),x=c.px,z=c.pz,ti=Math.floor(x),tj=Math.floor(z),myL=c.big?.15:.1;let best=9,by=null;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const A=E._cg.get((tj+dz)*N+ti+dx);if(!A)continue;
    for(const o of A){if(o===c||(o.ov!=null)!==(c.ov!=null))continue;const ox=o.px-x,oz=o.pz-z,ah=ox*hx+oz*hz;if(ah<=0||ah>.8)continue;
      const lat=Math.abs(ox*hz-oz*hx),ohx=Math.sin(o.pa),ohz=Math.cos(o.pa),dt_=ohx*hx+ohz*hz,cs=Math.abs(dt_),sn=Math.sqrt(Math.max(0,1-cs*cs)),oL=o.big?.15:.1;
      if(lat>.05+oL*sn+.05*cs+.01)continue;if(dt_<-.6&&lat>.2)continue;
      if(o.by===c.id&&c.id<o.id)continue;if(gh&&(o.bt>0||o.by!=null))continue;   // blocage en boucle : on ne passe qu'à travers une voiture elle-même bloquée
      const room=ah-(myL+oL*cs+.05*sn+.075);if(room<best){best=room;by=o;}}}
  c.by=best<.02&&by?by.id:null;return best;
}
// ── Portes (v15) : chaque maison, immeuble, commerce et bureau a une porte repérée sur sa façade (modèle 3D ou dessin du code).
// Elle s'ouvre quand un habitant sort ou rentre : battant qui pivote vers l'intérieur (maisons, immeubles), portes vitrées
// coulissantes (commerces, bureaux). On voit l'entrée éclairée la nuit. ──
V15.doors=new Map();V15.doorA=new Map();V15.doorDirty=true;V15.lotI=-1;V15.kmDoor=null;
const KM_DOORC=new Set(['#4a4d5b','#40434f','#3c3e4a']),KMDOOR=new Map();
function kmDoorPos(n,s,ox,oz){let D=KMDOOR.get(n);
  if(D===undefined){D=null;const M=kmGet(n);if(M){let x0=9,x1=-9,zz=-9;const p=M.p,t=M.t,nm=M.nm;
      for(let k=0,nt=t.length/3;k<nt;k++){if(nm[k*3+2]<.9)continue;const tk=t[k*3];if(!KM_DOORC.has(KM_SRC.pal[tk&4095]))continue;const q=k*9;if(Math.min(p[q+1],p[q+4],p[q+7])>.06*M.h)continue;
        x0=Math.min(x0,p[q],p[q+3],p[q+6]);x1=Math.max(x1,p[q],p[q+3],p[q+6]);zz=Math.max(zz,p[q+2],p[q+5],p[q+8]);}
      if(x1>x0)D={x:(x0+x1)/2,z:zz,w:x1-x0};}KMDOOR.set(n,D);}
  return D?{x:D.x*s+ox,z:D.z*s+oz,w:D.w*s}:null;}
function gbLens(){const o=new Map();if(GB)for(const [k,g] of GB)o.set(k,g.p.length);return o;}
function toLocal(wx,wz){const dx=wx-TX.x,dz=wz-TX.z;switch(TX.k){case 1:return[-dz,dx];case 2:return[-dx,-dz];case 3:return[dz,-dx];default:return[dx,dz];}}
function doorScan(i,pre,kind){
  let lx=0,lz=null,w=kind==='house'?.075:kind==='shop'||kind==='off'?.13:.1;
  if(V15.kmDoor){lx=V15.kmDoor.x;lz=V15.kmDoor.z;w=clamp(V15.kmDoor.w,.06,.1);}
  else{const f=P(0,1),o=P(0,0),fx=f[0]-o[0],fz=f[1]-o[1];
    for(const [k,g] of GB){const p=g.p,n=g.n;for(let q=pre.get(k)||0;q<p.length;q+=9){if(n[q]*fx+n[q+2]*fz<.92)continue;
      const ya=Math.min(p[q+1],p[q+4],p[q+7]),yb=Math.max(p[q+1],p[q+4],p[q+7]);if(ya>.05||yb<.13)continue;
      const a=toLocal(p[q],p[q+2]),b=toLocal(p[q+3],p[q+5]),c=toLocal(p[q+6],p[q+8]);if(Math.min(a[0],b[0],c[0])>.012||Math.max(a[0],b[0],c[0])<-.012)continue;const z=a[1];if(z>.44)continue;if(lz==null||z>lz)lz=z;}}}
  if(lz==null){V15.doors.delete(i);return;}
  const p=P(lx,lz+.003),f=P(lx,lz+1),ang=Math.atan2(f[0]-p[0],f[1]-p[1]);
  V15.doors.set(i,{x:p[0],z:p[1],ang,lx,lz,k:TX.k,w,h:kind==='house'?.15:.165,kind,col:kind==='house'?['#6d4c3d','#2f4f6f','#7a2e2e','#3d5c46','#4a4d5b','#8a6a4a'][(i*7)%6]:kind==='res'?'#3b4650':'#a9d3e6'});V15.doorDirty=true;
}
function doorOpen(i,hold){if(!V15.doors.has(i))return;const a=V15.doorA.get(i)||{t:0};a.tgt=1;a.hold=Math.max(a.hold||0,hold||1.1);V15.doorA.set(i,a);}
function doorMake(){
  const mk=fn=>{GB=new Map();TX.x=0;TX.z=0;TX.k=0;fn();const g=toGeo(GB.get('plain'));GB=null;return g;};
  const frame=mk(()=>{bx(-.048,0,-.04,.007,0,.158,'#ece8e1');bx(.04,0,.048,.007,0,.158,'#ece8e1');bx(-.048,0,.048,.007,.15,.162,'#ece8e1');bx(-.05,.0,.05,.012,0,.006,'#cfc9bf');});
  const leaf=mk(()=>{bx(0,.003,.08,.009,0,.15,'#ffffff');bx(.065,.009,.071,.012,.07,.078,'#d9c27a');});   // charnière en x = 0
  const inner=new THREE.PlaneGeometry(.08,.15);inner.translate(0,.075,.0015);
  const I=(g,m,n)=>{const M=new THREE.InstancedMesh(g,m,n);M.count=0;M.frustumCulled=false;M.setColorAt(0,new THREE.Color('#fff'));E.gC.add(M);return M;};
  const lm=new THREE.MeshLambertMaterial({vertexColors:true});
  V15.dm={frame:I(frame,lm,64),leaf:I(leaf,lm,128),inner:I(inner,new THREE.MeshBasicMaterial({color:'#2b2420'}),64),cap:64,list:[],idx:new Map()};
}
const _dm=new THREE.Matrix4(),_dq=new THREE.Quaternion(),_de=new THREE.Euler(),_dp=new THREE.Vector3(),_ds=new THREE.Vector3(),_dc=new THREE.Color();
function doorLeafs(D,j,a,M){   // battant(s) de la porte D (ouverture a de 0 à 1) à partir de l'instance j
  const sx=D.w/.08,sy=D.h/.15,ca=Math.cos(D.ang),sa=Math.sin(D.ang);
  const at=(lx,rot,sxx)=>{const wx=D.x+ca*lx,wz=D.z-sa*lx;_de.set(0,D.ang+rot,0);_dq.setFromEuler(_de);_dp.set(wx,0,wz);_ds.set(sxx,sy,1);_dm.compose(_dp,_dq,_ds);M.setMatrixAt(j,_dm);M.setColorAt(j,_dc.set(D.col));};
  if(D.kind==='shop'||D.kind==='off'){const s2=D.w/2,o=a*s2*.92;at(-s2-o,0,sx*.5);at(o,0,sx*.5);return 2;}   // portes coulissantes
  at(-D.w/2,a*1.75,sx);return 1;   // battant qui pivote vers l'intérieur
}
function doorRebuild(){
  if(!V15.dm)doorMake();const dm=V15.dm,L=[...V15.doors.entries()];
  if(L.length>dm.cap){const cap=Math.ceil(L.length*1.4);for(const k of['frame','inner'])E.gC.remove(dm[k]);E.gC.remove(dm.leaf);const g1=dm.frame.geometry,g2=dm.inner.geometry,g3=dm.leaf.geometry,m1=dm.frame.material,m2=dm.inner.material;
    const I=(g,m,n)=>{const M=new THREE.InstancedMesh(g,m,n);M.count=0;M.frustumCulled=false;M.setColorAt(0,new THREE.Color('#fff'));E.gC.add(M);return M;};dm.frame=I(g1,m1,cap);dm.inner=I(g2,m2,cap);dm.leaf=I(g3,m1,cap*2);dm.cap=cap;}
  dm.list=L;dm.idx=new Map();let nl=0;
  L.forEach(([i,D],j)=>{_de.set(0,D.ang,0);_dq.setFromEuler(_de);_dp.set(D.x,0,D.z);_ds.set(D.w/.08,D.h/.15,1);_dm.compose(_dp,_dq,_ds);dm.frame.setMatrixAt(j,_dm);dm.frame.setColorAt(j,_dc.set(D.kind==='house'?'#ece8e1':'#59616a'));dm.inner.setMatrixAt(j,_dm);
    const a=V15.doorA.get(i);dm.idx.set(i,[j,nl]);nl+=doorLeafs(D,nl,a?a.t:0,dm.leaf);});
  dm.frame.count=dm.inner.count=L.length;dm.leaf.count=nl;for(const M of[dm.frame,dm.inner,dm.leaf]){M.instanceMatrix.needsUpdate=true;if(M.instanceColor)M.instanceColor.needsUpdate=true;}
}
function doorFrame(dt){
  if(V15.doorDirty&&E.t-(V15.doorT||0)>.4){V15.doorDirty=false;V15.doorT=E.t;doorRebuild();}
  const dm=V15.dm;if(!dm)return;dm.inner.material.color.set(E.night>.45?'#ffcf8a':'#4a3f37');
  if(!V15.doorA.size)return;let ch=false;
  for(const [i,a] of V15.doorA){if(a.hold>0){a.hold-=dt;if(a.hold<=0)a.tgt=0;}const t0=a.t;a.t=clamp(a.t+(a.tgt>a.t?1:-1)*dt*2.6,0,1);
    const D=V15.doors.get(i),ix=dm.idx.get(i);if(D&&ix&&a.t!==t0){doorLeafs(D,ix[1],a.t,dm.leaf);ch=true;}if(a.t<=0&&a.tgt===0)V15.doorA.delete(i);}
  if(ch){dm.leaf.instanceMatrix.needsUpdate=true;}
}
// ── Passages piétons (v15) : à tous les carrefours (déjà peints), avant chaque rond-point et au milieu de certaines rues ──
function zebraMid(i){const x=i%N,z=(i/N)|0;if(!(road[i]===1||road[i]===3)||ter[i]||dg[i]||rail[i]||lane[i]||SIG[i]||rx[i]||OVT[i]>=0||mtn[i])return false;
  const m=roadMask(x,z);if(m!==5&&m!==10)return false;if((x*7+z*13)%6!==0)return false;
  const a=m===5?[i-N,i+N]:[i-1,i+1];for(const j of a){if(j<0||j>=NN||!road[j])return false;const mm=roadMask(j%N,(j/N)|0),c=(mm&1?1:0)+(mm&2?1:0)+(mm&4?1:0)+(mm&8?1:0);if(c>2||rx[j])return false;}return true;}
function drawZebras(c,i,x,z,px,pz,m){
  const sw=5;c.fillStyle='rgba(245,245,240,.9)';
  const B=[1,2,4,8];
  for(let d=0;d<4;d++){if(!(m&B[d]))continue;const X=x+DIRS[d][0],Z=z+DIRS[d][1];if(X<0||Z<0||X>=N||Z>=N)continue;const j=Z*N+X;if(rx[j]!==2||!road[j])continue;   // passage avant le rond-point
    for(let k=sw+1.5;k<PX-sw-1;k+=3.4){if(d===0)c.fillRect(px+k,pz+1.2,1.7,4.6);else if(d===2)c.fillRect(px+k,pz+PX-5.8,1.7,4.6);else if(d===3)c.fillRect(px+1.2,pz+k,4.6,1.7);else c.fillRect(px+PX-5.8,pz+k,4.6,1.7);}}
  if(zebraMid(i)){for(let k=sw+1.5;k<PX-sw-1;k+=3.4){if(m===5)c.fillRect(px+k,pz+H2-2.3,1.7,4.6);else c.fillRect(px+H2-2.3,pz+k,4.6,1.7);}}
}
// ── Trajets des piétons (v15) : ils sortent par la porte, suivent les trottoirs (coins des carrefours), ne traversent qu'aux
// passages piétons (au vert s'il y a des feux, sinon quand aucune voiture n'arrive), et les voitures s'arrêtent pour eux. ──
const CPX=[[-1,-1],[1,-1],[1,1],[-1,1]],SWK=.42;
function pedRoad(i){return (road[i]===1||road[i]===3)&&!dg[i];}
function pedBFS(a,b){if(a<0||b<0)return null;if(a===b)return[a];const prev=new Int32Array(NN).fill(-1),q=[a];prev[a]=a;
  for(let h=0;h<q.length;h++){const i=q[h];if(i===b)break;const x=i%N;for(const j of[x>0?i-1:-1,x<N-1?i+1:-1,i-N,i+N])if(j>=0&&j<NN&&pedRoad(j)&&prev[j]<0){prev[j]=i;q.push(j);}if(q.length>2400)break;}
  if(prev[b]<0)return null;const p=[];for(let i=b;i!==a;i=prev[i])p.push(i);p.push(a);return p.reverse();}
function armAt(i,d){const x=i%N,z=(i/N)|0,X=x+DIRS[d][0],Z=z+DIRS[d][1];if(X<0||Z<0||X>=N||Z>=N)return false;return road[Z*N+X]>0;}
function armCnt(i){let c=0;for(let d=0;d<4;d++)if(armAt(i,d))c++;return c;}
// 0 : trottoir continu · 1 : passage piéton · 2 : pas de passage (on évite)
function xKind(i,d){if(!armAt(i,d))return 0;if(rx[i]===2||SIG[i]||armCnt(i)>=3)return 1;const X=i%N+DIRS[d][0],Z=((i/N)|0)+DIRS[d][1],j=Z*N+X;if(rx[j]===2&&road[j])return 1;return 2;}
function dirTo(a,b){const dx=(b%N)-(a%N),dz=((b/N)|0)-((a/N)|0);return dz<0?0:dx>0?1:dz>0?2:3;}
// meilleur chemin d'un coin à l'autre dans la case i : [coût, coins, bras traversés]
function inTile(i,ca,cb){if(ca===cb)return[0,[ca],[]];let best=null;
  for(const dir of[1,-1]){let c=ca,cost=0;const seq=[ca],arms=[];while(c!==cb){const arm=dir>0?c:(c+3)%4,k=xKind(i,arm);cost+=.84+(k===1?3:k===2?40:0);arms.push(k?arm:-1);c=(c+dir+4)%4;seq.push(c);}
    if(!best||cost<best[0])best=[cost,seq,arms];}
  if(zebraMid(i)){const m=roadMask(i%N,(i/N)|0),ns=m===5,sa=ns?(CPX[ca][0]):(CPX[ca][1]),sb=ns?(CPX[cb][0]):(CPX[cb][1]);if(sa!==sb){const cost=.84*2+3;if(cost<best[0])best=[cost,[ca,'m',cb],['m']];}}
  return best;}
function pedRoute(path,dh,dd){   // dh : côté du départ (de la 1re case vers la maison), dd : côté de l'arrivée
  const n=path.length;if(!n)return null;
  const exitC=(k,s)=>{const d=dirTo(path[k],path[k+1]);return s?(d+1)%4:d;},entC=(k,s)=>{const d=dirTo(path[k-1],path[k]);return s?(d+2)%4:(d+3)%4;};
  // DP sur le côté du trottoir à chaque passage de case
  let cur=[],starts=[dh,(dh+1)%4];
  if(n===1){let best=null;for(const a of starts)for(const b of[dd,(dd+1)%4]){const r=inTile(path[0],a,b);if(!best||r[0]<best.c)best={c:r[0],seg:[[path[0],r]]};}return best&&best.seg;}
  for(let s=0;s<2;s++){let b=null;for(const a of starts){const r=inTile(path[0],a,exitC(0,s));if(!b||r[0]<b.c)b={c:r[0],seg:[[path[0],r]]};}cur[s]=b;}
  for(let k=1;k<n-1;k++){const nx=[];for(let s=0;s<2;s++){let b=null;for(let p=0;p<2;p++){if(!cur[p])continue;const r=inTile(path[k],entC(k,p),exitC(k,s));const c=cur[p].c+r[0];if(!b||c<b.c)b={c,seg:cur[p].seg.concat([[path[k],r]])};}nx[s]=b;}cur=nx;}
  let best=null;for(let p=0;p<2;p++){if(!cur[p])continue;for(const b of[dd,(dd+1)%4]){const r=inTile(path[n-1],entC(n-1,p),b);const c=cur[p].c+r[0];if(!best||c<best.c)best={c,seg:cur[p].seg.concat([[path[n-1],r]])};}}
  return best&&best.seg;}
// coin c de la case i (décalé pour les ronds-points et les passages devant un rond-point)
function cornerPt(i,c){const x=i%N+.5,z=((i/N)|0)+.5,q=rx[i]===2?.44:SWK;return[x+CPX[c][0]*q,z+CPX[c][1]*q];}
function routePts(seg,start,end){   // liste de points [x, z, traversée] ; traversée = {key, i, arm, sig, ax, az, bx, bz}
  const W=[];const push=(x,z,cr)=>W.push({x,z,cr:cr||null});
  for(const p of start)push(p[0],p[1]);
  for(const [i,r] of seg){const seq=r[1],arms=r[2],cx=i%N+.5,cz=((i/N)|0)+.5;
    for(let k=0;k<seq.length;k++){const c=seq[k];
      if(c==='m'){const m=roadMask(i%N,(i/N)|0),ns=m===5,a=seq[k-1],b=seq[k+1],sa=ns?CPX[a][0]:CPX[a][1];
        const A=ns?[cx+sa*SWK,cz]:[cx,cz+sa*SWK],B=ns?[cx-sa*SWK,cz]:[cx,cz-sa*SWK];push(A[0],A[1],{key:i*5+4,i,arm:-1,sig:false});push(B[0],B[1]);continue;}
      const P_=cornerPt(i,c);
      const arm=k>0?arms[k-1]:-1;
      if(k>0&&arm>=0&&arm!=='m'){   // traversée du bras « arm » entre le coin précédent et ce coin
        const prev=seq[k-1],D=DIRS[arm],off=rx[i]===2?.61:(()=>{const X=i%N+D[0],Z=((i/N)|0)+D[1],j=Z*N+X;return X>=0&&Z>=0&&X<N&&Z<N&&rx[j]===2?.39:SWK;})();
        const lat=c2=>arm&1?CPX[c2][1]:CPX[c2][0],A=arm&1?[cx+D[0]*off,cz+lat(prev)*SWK]:[cx+lat(prev)*SWK,cz+D[1]*off],B=arm&1?[cx+D[0]*off,cz+lat(c)*SWK]:[cx+lat(c)*SWK,cz+D[1]*off];
        if(Math.hypot(A[0]-W[W.length-1].x,A[1]-W[W.length-1].z)>.02)push(A[0],A[1]);
        W[W.length-1].cr={key:rx[i]===2?(i+D[0]+D[1]*N)*5+((arm+2)%4):i*5+arm,i,arm,sig:!!SIG[i]};
        push(B[0],B[1]);}
      push(P_[0],P_[1]);}}
  for(const p of end)push(p[0],p[1]);
  // supprime les points en double
  const O=[W[0]];for(let k=1;k<W.length;k++){const a=O[O.length-1],b=W[k];if(Math.hypot(a.x-b.x,a.z-b.z)<.015){if(b.cr&&!a.cr)a.cr=b.cr;continue;}O.push(b);}return O;}
// accès d'un terrain : porte → devant la porte → portillon → trottoir (côté du terrain), et la case de route correspondante
function lotAccess(lot){
  const D=V15.doors.get(lot),x=lot%N,z=(lot/N)|0,k=D?D.k:lotDir(lot),o=[[0,1],[1,0],[0,-1],[-1,0]][k];let r=-1;
  {const X=x+o[0],Z=z+o[1];if(X>=0&&Z>=0&&X<N&&Z<N&&pedRoad(Z*N+X))r=Z*N+X;}
  const front=r>=0;if(r<0)for(let d=0;d<4;d++){const X=x+DIRS[d][0],Z=z+DIRS[d][1];if(X>=0&&Z>=0&&X<N&&Z<N&&pedRoad(Z*N+X)){r=Z*N+X;break;}}
  if(r<0)return null;const dh=dirTo(r,lot),ux=DIRS[dh][0],uz=DIRS[dh][1],tx=-uz,tz=ux,rc=[r%N+.5,((r/N)|0)+.5];
  if(D&&front){const fx=Math.sin(D.ang),fz=Math.cos(D.ang),lat=(D.x-rc[0])*tx+(D.z-rc[1])*tz,cl=clamp(lat,-.07,.07),dd=(D.x-rc[0])*ux+(D.z-rc[1])*uz;
    const at=(a,b)=>[rc[0]+ux*a+tx*b,rc[1]+uz*a+tz*b],pts=[[D.x,D.z],[D.x+fx*.05,D.z+fz*.05]];
    if(dd>.7)pts.push(at(.6,cl));pts.push(at(.5,cl),at(SWK,cl));return{r,dh,door:lot,pts};}
  return{r,dh,door:-1,pts:[[rc[0]+ux*.82,rc[1]+uz*.82],[rc[0]+ux*SWK,rc[1]+uz*SWK]]};}
function svcAccess(s){const F=svcFront(s);if(!F)return null;const r=F.ri,dh=dirTo(r,F.bi),ux=DIRS[dh][0],uz=DIRS[dh][1],rx_=r%N+.5,rz=((r/N)|0)+.5;
  const park=BT[s.t]&&(BT[s.t].cat==='parcs');return{r,dh,door:-1,park,s,pts:[[rx_+ux*.78,rz+uz*.78],[rx_+ux*SWK,rz+uz*SWK]]};}
function pedTrip(A,B){   // A, B : accès (départ, arrivée) → points du trajet
  const path=pedBFS(A.r,B.r);if(!path||path.length>70)return null;const seg=pedRoute(path,A.dh,B.dh);if(!seg)return null;
  return routePts(seg,A.pts,B.pts.slice().reverse());}
function walkDest2(){
  if(Math.random()<.35){const L=[...SV.values()].filter(s=>{const c=BT[s.t]&&BT[s.t].cat;return c==='parcs'||c==='loisirs'||c==='services'||c==='monuments';});if(L.length){const a=svcAccess(rpick(L));if(a)return a;}}
  for(let k=0;k<30;k++){const i=(Math.random()*NN)|0;if((zone[i]===ZC||zone[i]===ZO)&&lvl[i]&&st[i]===OK){const a=lotAccess(i);if(a)return a;}}
  return null;}
function walkNew(L,h,we,vet){
  const evening=h>=16.5&&h<19.8,jog=((h>=6&&h<9.2)||(h>=18&&h<20))&&Math.random()<.3,fam=!jog&&we&&h>=10&&h<18.5&&Math.random()<.24;
  let A=null,B=null,back=true;
  if(evening&&!jog&&Math.random()<.45){   // retour du travail : du bureau ou du magasin vers la maison
    for(let k=0;k<20&&!A;k++){const i=(Math.random()*NN)|0;if((zone[i]===ZC||zone[i]===ZO)&&lvl[i]&&st[i]===OK)A=lotAccess(i);}B=lotAccess(rpick(L));back=false;}
  else{A=lotAccess(rpick(L));
    if(jog){const RL=E.roadList||[];for(let k=0;k<10&&!B;k++){const r=RL[(Math.random()*RL.length)|0];if(r!=null&&pedRoad(r)&&(!A||r!==A.r)){const d=[0,1,2,3].find(q=>!armAt(r,q));if(d!=null)B={r,dh:d,door:-1,turn:true,pts:[[r%N+.5+DIRS[d][0]*SWK,((r/N)|0)+.5+DIRS[d][1]*SWK]]};}}}
    else B=walkDest2();}
  if(!A||!B||(A.r===B.r&&!B.turn))return null;
  const pts=pedTrip(A,B);if(!pts||pts.length<3)return null;
  const seed=(Math.random()*1e9)|0,w={pts,k:0,u:0,A,B,back,ph:Math.random()*6,kind:jog?'jog':fam?'fam':'walk',leg:'out',st:'walk',wait:0,in:0};
  w.L=jog?humLook(seed,{v:5,kid:false}):humLook(seed);w.sp=jog?.4+Math.random()*.1:fam?.11:.15+Math.random()*.07;
  if(fam){w.L2=humLook(seed+1,{kid:false});w.L3=humLook(seed+2,{kid:true});w.sc=HSTROL[(seed>>>3)%HSTROL.length];}
  w.dog=!jog&&!fam&&Math.random()<(vet?.35:.22);w.dc=DOG_C[(Math.random()*5)|0];
  if(A.door>=0){doorOpen(A.door,1.3);w.st='leave';w.wait=.5;}   // la porte s'ouvre, puis il sort
  return w;}
function parkStroll(s,from){const R=[],n=2+((Math.random()*2)|0);for(let k=0;k<n;k++)R.push({x:s.x+.25+Math.random()*(s.w-.5),z:s.z+.25+Math.random()*(s.d-.5),cr:null});return[{x:from.x,z:from.z,cr:null}].concat(R,[{x:from.x,z:from.z,cr:null}]);}
function carNear(x,z,r){const G_=E._cg;if(!G_)return false;const ti=Math.floor(x),tj=Math.floor(z);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const A=G_.get((tj+dz)*N+ti+dx);if(!A)continue;for(const c of A){if(c.ov!=null)continue;const ox=x-c.px,oz=z-c.pz,d=Math.hypot(ox,oz);if(d<.2)return true;if(d<r&&(ox*Math.sin(c.pa)+oz*Math.cos(c.pa))>0&&!(c.bt>0))return true;}}return false;}
function walkStep(F,run,m,q,e,p,sc,col){
  if(!E.strol)E.strol=strollerMesh();let nd=0,ns=0;const S_=E.strol,PX_=V15.pedX;PX_.clear();
  for(const w of F.walk){
    const spd=run*w.sp*(w.kind==='walk'?w.L.sp:1);let moving=run>0;
    if(w.st==='leave'){w.wait-=run;if(w.wait>0)continue;w.st='walk';}   // derrière la porte qui s'ouvre
    if(w.st==='enter'){w.wait-=run;if(w.wait>0)continue;   // il est entré
      if(w.leg==='out'&&w.back){w.st='inside';w.in=w.B.turn?0:w.B.park?0:14+Math.random()*36;}else{w.done=true;continue;}}
    if(w.st==='inside'){w.in-=run;if(w.in>0)continue;const bk=pedTrip(w.B,w.A);if(!bk){w.done=true;continue;}
      w.pts=bk;w.k=0;w.u=0;w.leg='home';w.st='walk';if(w.B.door>=0){doorOpen(w.B.door,1.3);w.st='leave';w.wait=.5;continue;}}
    const P_=w.pts,a=P_[w.k],b=P_[w.k+1];if(!b){w.done=true;continue;}
    if(a.cr&&w.u<=.001){   // au bord du passage piéton : on regarde avant de traverser
      const cr=a.cr,mx=(a.x+b.x)/2,mz=(a.z+b.z)/2,go=cr.sig?sigState(cr.i,cr.arm&1)===2:!carNear(mx,mz,.62);
      w.wait=(w.wait||0)+run;if(!go&&w.wait<9)moving=false;else w.wait=0;if(moving)PX_.set(cr.key,1);}
    else if(a.cr)PX_.set(a.cr.key,1);
    if(moving){let L_=Math.hypot(b.x-a.x,b.z-a.z)||.01;w.u+=spd/L_;
      while(w.u>=1&&w.k<P_.length-1){const ex=(w.u-1)*L_;w.k++;w.u=0;if(w.k>=P_.length-1)break;const a2=P_[w.k],b2=P_[w.k+1];if(a2.cr)break;L_=Math.hypot(b2.x-a2.x,b2.z-a2.z)||.01;w.u=ex/L_;}
      if(w.k>=P_.length-1){   // arrivé au bout du trajet
        if(w.leg==='out'){
          if(w.B.park&&!w.strolled){w.strolled=true;w.pts=parkStroll(w.B.s,P_[P_.length-1]);w.k=0;w.u=0;continue;}   // promenade dans le parc
          if(w.B.door>=0)doorOpen(w.B.door,1.2);w.st='enter';w.wait=w.B.door>=0?.3:0;}
        else{if(w.A.door>=0){doorOpen(w.A.door,1.2);w.st='enter';w.wait=.3;}else w.done=true;}
        continue;}}
    const a3=P_[w.k],b3=P_[w.k+1]||a3,x=lerp(a3.x,b3.x,clamp(w.u,0,1)),z=lerp(a3.z,b3.z,clamp(w.u,0,1)),ti=Math.floor(z)*N+Math.floor(x),y=ter[ti]&&road[ti]?.13:0;
    humFollow(w,x,z,run);const mv=moving&&run>0,ra=w.ra,fx=Math.sin(ra),fz=Math.cos(ra),bx_=-fz,bz=fx;
    if(w.kind==='jog')humPut(w.L,w.rx,y,w.rz,ra,.8,w.ph*.8,mv?1:0);else humPut(w.L,w.rx,y,w.rz,ra,.8,w.ph,mv?.55:0);
    if(w.kind==='fam'){humPut(w.L2,w.rx+bx_*.055-fx*.03,y,w.rz+bz*.055-fz*.03,ra,.8,w.ph+1.3,mv?.55:0);humPut(w.L3,w.rx+bx_*.025-fx*.1,y,w.rz+bz*.025-fz*.1,ra,.8,w.ph*1.3+2,mv?.7:0);
      if(ns<60){e.set(0,ra,0);q.setFromEuler(e);p.set(w.rx+fx*.075,y,w.rz+fz*.075);sc.setScalar(1);m.compose(p,q,sc);S_.setMatrixAt(ns,m);col.set(w.sc);S_.setColorAt(ns,col);ns++;}}
    if(w.dog&&nd<40){e.set(0,ra,0);q.setFromEuler(e);p.set(w.rx-fx*.085,y,w.rz-fz*.085);sc.setScalar(.58);m.compose(p,q,sc);F.dog.setMatrixAt(nd,m);col.set(w.dc);F.dog.setColorAt(nd,col);nd++;}
  }
  if(F.walk.some(w=>w.done))F.walk=F.walk.filter(w=>!w.done);
  S_.count=ns;S_.instanceMatrix.needsUpdate=true;if(S_.instanceColor)S_.instanceColor.needsUpdate=true;
  return nd;
}
// ── Stationnement visible (v15) : près de la caméra, une voiture qui arrive quitte la circulation, ralentit, tourne et entre
// dans sa place ; une voiture qui part recule, braque, rejoint la route et repart dans la circulation. Loin : changement direct. ──
V15.occ=null;V15.pkQ=[];V15.pkBusy=new Set();V15.pkT=0;
function parkWant(L,k,h,we){const [x,z,ax,kind]=L[k],hs=hash(Math.floor(x*13)*31+Math.floor(z*17)*7+k*3);return hs<=parkOcc(kind,h,we);}
function parkCol(L,k){const [x,z]=L[k],hs=hash(Math.floor(x*13)*31+Math.floor(z*17)*7+k*3);return CAR_COLS[(hs*977|0)%CAR_COLS.length];}
function parkDraw(){
  const M=E.parkM,L=E.parkL,O=V15.occ;if(!M||!L||!O)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),sc=new THREE.Vector3(1,1,1),c=new THREE.Color();let n=0;
  for(let k=0;k<L.length;k++){if(!O[k]||V15.pkBusy.has(k))continue;const [x,z,ax]=L[k];e.set(0,ax?Math.PI/2:0,0);q.setFromEuler(e);p.set(x,0,z);m.compose(p,q,sc);M.setMatrixAt(n,m);M.setColorAt(n,c.set(parkCol(L,k)));n++;}
  M.count=n;M.instanceMatrix.needsUpdate=true;if(M.instanceColor)M.instanceColor.needsUpdate=true;
}
function updateParked(force){
  const M=E.parkM,L=E.parkL;if(!M||!L)return;const h=hourNow(),we=weekend(),key=Math.round(h*4)+(we?100:0);
  if(!force&&key===RL.parkK)return;RL.parkK=key;
  if(force||!V15.occ||V15.occ.length!==L.length){V15.occ=new Uint8Array(L.length);V15.pkQ=[];V15.pk.length=0;V15.pkBusy.clear();for(let k=0;k<L.length;k++)V15.occ[k]=parkWant(L,k,h,we)?1:0;parkDraw();return;}
  const Q=[];for(let k=0;k<L.length;k++){const w=parkWant(L,k,h,we)?1:0;if(w===V15.occ[k]||V15.pkBusy.has(k))continue;
    if(Math.hypot(L[k][0]-CAM.x,L[k][1]-CAM.z)<Math.max(9,CAM.dist*1.15))Q.push([k,w]);else V15.occ[k]=w;}
  for(let k=Q.length-1;k>0;k--){const j=(Math.random()*(k+1))|0;[Q[k],Q[j]]=[Q[j],Q[k]];}V15.pkQ=Q;parkDraw();
}
function pkRoad(x,z){let best=-1,bd=1.35;const ti=Math.floor(x),tj=Math.floor(z);
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const X=ti+dx,Z=tj+dz;if(X<0||Z<0||X>=N||Z>=N)continue;const i=Z*N+X;if(!(road[i]===1||road[i]===3)||ter[i]||dg[i]||noCar(i)||rx[i]||showBlocked(i))continue;
    const d=Math.hypot(X+.5-x,Z+.5-z);if(d<bd){bd=d;best=i;}}return best;}
function catmull(P_,n){const O=[];for(let k=0;k<P_.length-1;k++){const p0=P_[Math.max(0,k-1)],p1=P_[k],p2=P_[k+1],p3=P_[Math.min(P_.length-1,k+2)];
  for(let j=0;j<n;j++){const t=j/n,t2=t*t,t3=t2*t;O.push([.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]);}}
  O.push(P_[P_.length-1]);return O;}
function pkGeom(k){   // géométrie d'une place : route, sens de circulation, points de la manœuvre
  const L=E.parkL,[x,z,ax]=L[k],r=pkRoad(x,z);if(r<0)return null;const rc=[r%N+.5,((r/N)|0)+.5],m=roadMask(r%N,(r/N)|0),hz=(m&10)&&!(m&5)?true:(m&5)&&!(m&10)?false:Math.abs(z-rc[1])>Math.abs(x-rc[0]);
  let t,dt;if(hz){const north=z<rc[1];t=north?[-1,0]:[1,0];dt=north?3:1;}else{const east=x>rc[0];t=east?[0,-1]:[0,1];dt=east?0:2;}
  const R=[-t[1],t[0]],s0=clamp((x-rc[0])*t[0]+(z-rc[1])*t[1],-.3,.3),lane=(a,o)=>[rc[0]+t[0]*a+R[0]*o,rc[1]+t[1]*a+R[1]*o];
  const curb=lane(s0,.47),A=ax?[1,0]:[0,1],sg=Math.sign((curb[0]-x)*A[0]+(curb[1]-z)*A[1])||1,Ap=[x+A[0]*sg*.26,z+A[1]*sg*.26];
  return{r,rc,t,dt,R,s0,lane,curb,Ap,spot:[x,z],A,sg};}
function pkPoly(P_){const C=[0];for(let k=1;k<P_.length;k++)C.push(C[k-1]+Math.hypot(P_[k][0]-P_[k-1][0],P_[k][1]-P_[k-1][1]));return{pts:P_,cum:C,len:C[C.length-1]};}
function pkStart(k,w){
  const g=pkGeom(k);if(!g)return false;const L=E.parkL;
  if(w){   // arrivée : on prend une voiture de la circulation qui arrive sur cette route, dans le bon sens
    const C=E.cars;let pick_=-1;for(let j=0;j<C.list.length;j++){const c=C.list[j];if(c.ov!=null||c.px==null||c.bt>0)continue;
      if((c.i===g.r&&c.to===g.dt&&c.from===OPP(g.dt)&&c.t<.25)||(roadNb(c.i,c.to)===g.r&&c.to===g.dt&&c.t>.45&&c.from===OPP(g.dt))){pick_=j;break;}}
    if(pick_<0)return false;const c=C.list[pick_];C.list.splice(pick_,1);
    const pts=catmull([[c.px,c.pz],g.lane(g.s0-.22,.17),g.lane(g.s0,.3),g.curb,g.Ap,g.spot],7),P_=pkPoly(pts);
    V15.pkBusy.add(k);V15.pk.push({k,w:1,P:P_,d:0,rev:0,col:c.col,id:c.id,px:c.px,pz:c.pz,pa:c.pa,ov:null,big:false,sp:.42});return true;}
  // départ : la voiture recule hors de la place, braque, rejoint la route et repart
  const tgt=g.lane(.5,.17),j2=roadNb(g.r,g.dt);if(j2<0)return false;
  const back=pkPoly([g.spot,[g.Ap[0]+g.A[0]*g.sg*.04,g.Ap[1]+g.A[1]*g.sg*.04]]),fw=catmull([[g.Ap[0]+g.A[0]*g.sg*.04,g.Ap[1]+g.A[1]*g.sg*.04],g.curb,g.lane(g.s0+.18,.2),tgt],7);
  const all=pkPoly(back.pts.concat(fw.slice(1)));V15.occ[k]=0;
  V15.pk.push({k,w:0,P:all,d:0,rev:back.len,col:parkCol(L,k),id:++_carId,px:g.spot[0],pz:g.spot[1],pa:0,ov:null,big:false,sp:.36,r:g.r,dt:g.dt});return true;}
function pkMesh(){if(V15.pkM)return V15.pkM;const g=E.cars.mesh.geometry,lg=E.cars.lights.geometry;
  const M=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({vertexColors:true}),16),Lm=new THREE.InstancedMesh(lg,new THREE.MeshBasicMaterial({vertexColors:true}),16);
  for(const x of[M,Lm]){x.count=0;x.frustumCulled=false;E.gC.add(x);}M.castShadow=true;M.setColorAt(0,new THREE.Color('#fff'));V15.pkM={M,Lm};return V15.pkM;}
function parkFrame(dt,run){
  if(V15.pkQ.length&&E.t-V15.pkT>.5&&V15.pk.length<10){V15.pkT=E.t;const [k,w]=V15.pkQ.shift();if(!V15.pkBusy.has(k)&&V15.occ&&k<V15.occ.length){if(!pkStart(k,w)){V15.occ[k]=w;}parkDraw();}}
  if(!V15.pk.length&&!(V15.pkM&&V15.pkM.M.count))return;const PM=pkMesh(),m=new THREE.Matrix4(),c=new THREE.Color();let n=0,ch=false;
  for(const v of V15.pk){const rev=v.d<v.rev;v.d+=run*(rev?v.sp*.6:v.sp)*(v.d<.08||v.P.len-v.d<.12?.6:1);
    const P_=v.P.pts,C_=v.P.cum,d=Math.min(v.d,v.P.len-1e-4);let j=1;while(j<C_.length-1&&C_[j]<d)j++;const s=C_[j]-C_[j-1]||1,u=clamp((d-C_[j-1])/s,0,1);
    const ax=P_[j-1][0],az=P_[j-1][1],bx_=P_[j][0],bz=P_[j][1],ang=Math.atan2(bx_-ax,bz-az)+(d<v.rev?Math.PI:0);
    v.px=lerp(ax,bx_,u);v.pz=lerp(az,bz,u);v.pa=v.pa==null?ang:v.pa+Math.atan2(Math.sin(ang-v.pa),Math.cos(ang-v.pa))*Math.min(1,dt*9);
    if(v.d>=v.P.len){v.done=true;ch=true;
      if(v.w){V15.occ[v.k]=1;V15.pkBusy.delete(v.k);}
      else{const C=E.cars;C.list.unshift({i:v.r,from:OPP(v.dt),to:v.dt,t:.98,ov:null,ok:0,sp:1.2+Math.random()*.6,col:v.col,fresh:true,id:v.id,dest:null,px:v.px,pz:v.pz,pa:v.pa});}   // la voiture rejoint la circulation
      continue;}
    m.makeRotationY(v.pa);m.setPosition(v.px,0,v.pz);PM.M.setMatrixAt(n,m);PM.Lm.setMatrixAt(n,m);PM.M.setColorAt(n,c.set(v.col));n++;}
  if(ch){V15.pk=V15.pk.filter(v=>!v.done);parkDraw();}
  PM.M.count=PM.Lm.count=n;PM.M.instanceMatrix.needsUpdate=PM.Lm.instanceMatrix.needsUpdate=true;if(PM.M.instanceColor)PM.M.instanceColor.needsUpdate=true;
}
function v15Frame(dt,run){doorFrame(dt);parkFrame(dt,run);}
// ── Menu des routes (v15) : 5 cartes au lieu de 10 — Route et Avenue (droite / diagonale), Pont routier, Carrefour
// (rond-point / feux), Aménager la rue (vélo / piétonne / normale). La variante choisie est retenue. ──
const RD_GRP={'road:1':'rt','road:1:d':'rt','road:3':'av','road:3:d':'av','x:rx:2':'cx','x:rx:1':'cx','x:lane:1':'ln','x:lane:2':'ln','x:lane:0':'ln'};
function rdRemember(k){const g=RD_GRP[k];if(!g||!S)return;if(!S.set.rdV||typeof S.set.rdV!=='object')S.set.rdV={};S.set.rdV[g]=k;}
function roadTray(){
  const V=(S.set&&S.set.rdV)||{},card=(g,name,opts)=>{const c=opts.find(o=>o.k===V[g])||opts[0];return{k:c.k,icon:c.icon,name,cost:c.cost,desc:c.desc,opts};};
  return[
    card('rt','Route',[{k:'road:1',l:'Droite',ic:'straight',icon:'add_road',cost:'10 § / case',desc:'Glisse pour tracer une route. Les ponts coûtent 50 § par case ; sur les montagnes, la route suit la pente (+'+MTN_ROAD+' § par case).'},
      {k:'road:1:d',l:'Biais',ic:'turn_slight_right',icon:'turn_slight_right',cost:'10 § / case',desc:'Glisse en biais : la route part à 45°, puis continue tout droit.'}]),
    card('av','Avenue',[{k:'road:3',l:'Droite',ic:'straight',icon:'forest',cost:'25 § / case',desc:'Avenue plantée : +8 de valeur foncière autour. Glisse sur une route existante pour l’élargir (15 § / case).'},
      {k:'road:3:d',l:'Biais',ic:'turn_slight_right',icon:'park',cost:'25 § / case',desc:'Avenue en biais (45°), puis tout droit.'}]),
    card('ov','Pont routier',[{k:'x:ovp:',l:'',icon:'alt_route',cost:'120 § / case',desc:'Une route en hauteur qui passe au-dessus des routes, des rails et de l’eau. Glisse en ligne droite d’une route à une autre (5 cases minimum).'}]),
    card('cx','Carrefour',[{k:'x:rx:2',l:'Rond-point',icon:'roundabout_right',cost:money(RX_COST[2]),desc:'Sur un carrefour : les voitures tournent autour, la circulation est bien plus fluide. Passages piétons sur chaque branche.'},
      {k:'x:rx:1',l:'Feux',icon:'traffic',cost:money(RX_COST[1]),desc:'Sur un carrefour : feux tricolores pour les voitures et les piétons.'}]),
    card('ln','Aménager la rue',[{k:'x:lane:1',l:'Vélo',ic:'pedal_bike',icon:'pedal_bike',cost:'15 § / case',desc:'Glisse le long d’une route : une piste cyclable. Un peu moins de voitures, habitants plus heureux.'},
      {k:'x:lane:2',l:'Piétonne',ic:'directions_walk',icon:'directions_walk',cost:'40 § / case',desc:'Glisse sur une route : plus de voitures, mais des terrasses, un marché et des lampions.'},
      {k:'x:lane:0',l:'Normale',ic:'undo',icon:'remove_road',cost:'Remboursé',desc:'Retire une piste cyclable ou une rue piétonne (ce que tu as payé t’est rendu).'}])];
}
// ── Station de métro (v15, refaite) : parvis dallé, bouche de métro avec escalier qui descend dans l'ombre, balustrade en fonte
// verte et lampadaires à globes, totem « M » lumineux, sortie avec escalator sous verrière, pavillon vitré (guichets + ascenseur),
// vélos en libre-service, grille d'aération, bancs, arbres ──
function metroStairs(x0,z0,x1,z1,n){   // escalier vu d'en haut : marches de plus en plus sombres vers le fond (-z)
  for(let k=0;k<n;k++){const u=k/n,za=lerp(z1,z0,u),zb=lerp(z1,z0,(k+1)/n),g=Math.round(lerp(175,22,Math.pow(u,.8))),c='#'+[g,g,Math.min(255,g+6)].map(v=>v.toString(16).padStart(2,'0')).join('');
    bx(x0,zb,x1,za-.004,.0085,.0095,c);bx(x0,za-.006,x1,za,.0085,.0098,k<2?'#e8e2d6':'#'+[g+25,g+25,g+28].map(v=>Math.min(255,v).toString(16).padStart(2,'0')).join(''));}
  bx(x0,z0-.01,x1,z0+.02,.0085,.0099,'#101214');}
function metroM(x,y,z,s){   // « M » blanc sur pastille jaune, face à la rue (+z) et vers l'arrière
  cyl(x,z,y-s,y+s,s*.08,s*.08,6,'#59616a');
  bx(x-s,z-.012,x+s,z+.012,y-s,y+s,'#f2c94c','basic');
  for(const f of[1,-1]){const zz=z+f*.0125;bx(x-s*.62,zz-.002,x-s*.42,zz+.002,y-s*.6,y+s*.6,'#1f2933','basic');bx(x+s*.42,zz-.002,x+s*.62,zz+.002,y-s*.6,y+s*.6,'#1f2933','basic');
    beam(x-s*.5,y+s*.55,zz,x,y-s*.05,zz,s*.18,.004,'#1f2933','basic');beam(x+s*.5,y+s*.55,zz,x,y-s*.05,zz,s*.18,.004,'#1f2933','basic');}}
function guimardLamp(x,z,h){const G_='#2f5d4f';cyl(x,z,0,.03,.016,.012,8,G_);cyl(x,z,.03,h,.007,.0055,8,G_);beam(x,h-.02,z,x+.025,h+.03,z,.008,.008,G_);
  ico(x+.03,h+.045,z,.024,'#ff8a3d','basic');cone(x+.03,z,h+.06,.02,.012,6,G_);}
Object.assign(SVB,{metro(r){
  // parvis dallé (joints) et bordure
  bx(-.99,-.99,.99,.99,0,.007,'#ddd6c9');for(let k=-3;k<=3;k++){bx(k*.28-.003,-.98,k*.28+.003,.98,.007,.0078,'#cbc3b4');bx(-.98,k*.28-.003,.98,k*.28+.003,.007,.0078,'#cbc3b4');}
  bx(-.99,.93,.99,.99,0,.012,'#bfb8aa');
  // bouche de métro principale (avant gauche) : trémie, escalier, muret, balustrade en fonte, lampadaires à globes, enseigne
  const sx0=-.78,sx1=-.36,sz0=-.05,sz1=.62;
  bx(sx0-.03,sz0-.03,sx1+.03,sz1,.0,.0084,'#7d858c');metroStairs(sx0,sz0,sx1,sz1,13);
  for(const [a,b,c,d] of[[sx0-.035,sz0-.035,sx0,sz1],[sx1,sz0-.035,sx1+.035,sz1],[sx0-.035,sz0-.035,sx1+.035,sz0]])bx(a,b,c,d,0,.05,'#b9b2a5',null,'#cfc8bb');
  const G_='#2f5d4f';for(const [a,b,c,d] of[[sx0-.022,sz0-.02,sx0-.014,sz1-.02],[sx1+.014,sz0-.02,sx1+.022,sz1-.02],[sx0-.02,sz0-.022,sx1+.02,sz0-.014]]){bx(a,b,c,d,.115,.124,G_);
    const along=d-b>c-a,L=along?d-b:c-a,n=Math.max(2,Math.round(L/.05));for(let k=0;k<=n;k++){const u=k/n;if(along)bc((a+c)/2,lerp(b,d,u),.004,.004,.05,.12,G_);else bc(lerp(a,c,u),(b+d)/2,.004,.004,.05,.12,G_);}}
  guimardLamp(sx0-.02,sz1-.04,.3);guimardLamp(sx1+.02,sz1-.04,.3);
  bx(sx0-.01,sz1-.05,sx1+.01,sz1-.03,.26,.31,'#2f5d4f');bx(sx0+.03,sz1-.031,sx1-.03,sz1-.028,.27,.3,'#f6e7b4','basic');
  for(let k=0;k<5;k++)bx(sx0+.06+k*.06,sz1-.0275,sx0+.09+k*.06,sz1-.026,.276,.294,'#2f5d4f','basic');   // lettres stylisées
  // sortie avec escalator sous verrière (avant droite)
  const ex0=.32,ex1=.66,ez0=.0,ez1=.6;
  bx(ex0-.03,ez0-.03,ex1+.03,ez1,0,.0084,'#7d858c');metroStairs(ex0,ez0,(ex0+ex1)/2-.01,ez1,11);
  for(let k=0;k<11;k++){const u=k/11,z=lerp(ez1,ez0,u),g=Math.round(lerp(150,30,u));bx((ex0+ex1)/2+.01,z-.05,ex1,z,.0085,.0095,'#'+[g,g+4,g+10].map(v=>v.toString(16).padStart(2,'0')).join(''));}
  bx((ex0+ex1)/2-.01,ez0,(ex0+ex1)/2+.01,ez1,.0085,.03,'#59616a');
  for(const [a,c] of[[ex0-.035,ex0],[ex1,ex1+.035]])bx(a,ez0-.035,c,ez1,0,.05,'#b9b2a5',null,'#cfc8bb');bx(ex0-.035,ez0-.035,ex1+.035,ez0,0,.05,'#b9b2a5',null,'#cfc8bb');
  for(const x of[ex0-.018,ex1+.018])for(const z of[ez0+.02,ez1-.04])bc(x,z,.007,.007,.05,.24,'#59616a');
  vault(ex0-.04,ez0-.02,ex1+.04,ez1-.02,.24,.07,8,'#bfe3f0',false,'#a9d3e6');
  for(const z of[ez0-.02,ez1-.02])bx(ex0-.045,z-.006,ex1+.045,z+.006,.235,.245,'#59616a');
  // totem « M » au coin de la rue
  bc(-.92,.82,.01,.01,0,.56,'#59616a');metroM(-.92,.64,.82,.075);
  // pavillon vitré : guichets, ascenseur, toit débordant
  bx(.05,-.92,.92,-.32,0,.3,'#bfe3f0','glass');for(const x of[.05,.34,.63,.92])bc(x,-.32,.008,.008,0,.3,'#3d4650');for(const x of[.05,.34,.63,.92])bc(x,-.92,.008,.008,0,.3,'#3d4650');
  bx(.0,-.97,.97,-.27,.3,.33,'#f4f6f8');bx(.02,-.95,.95,-.29,.33,.338,'#8fcf6e');
  bx(.08,-.31,.4,-.3,.03,.24,'#2b3238');bx(.12,-.299,.36,-.296,.17,.21,'#3ddc84','basic');   // portes + écran des départs
  bc(.75,-.25,.07,.07,0,.44,'#bfe3f0','glass');bc(.75,-.25,.075,.075,.44,.46,'#3d4650');bc(.75,-.25,.004,.004,.0,.44,'#3d4650');   // ascenseur
  metroM(.5,.4,-.31,.055);
  // vélos en libre-service, grille d'aération, bancs, arbres, plan du quartier
  bx(-.92,-.2,-.88,.0,0,.012,'#59616a');for(let k=0;k<4;k++){const z=-.86+k*.17;bc(-.9,z,.012,.012,0,.07,'#59616a');bc(-.9,z,.013,.006,.06,.075,'#3ddc84','basic');
    tube(-.86,.028,z-.04,-.86,.028,z+.04,.022,8,'#2b2b2b');bx(-.865,z-.05,-.855,z+.05,.03,.05,'#9aa3ab');bc(-.86,z+.035,.006,.006,.05,.075,'#c62828');}
  bx(-.62,-.85,-.28,-.6,.007,.012,'#4a5058');for(let k=0;k<9;k++)bx(-.6+k*.037,-.83,-.585+k*.037,-.62,.012,.014,'#2b3238');
  sub(-.45,-.4,0,benchM);sub(.0,.75,2,benchM);
  for(const [x,z] of[[-.1,-.6],[.92,.55],[-.12,.88]]){cyl(x,z,0,.05,.07,.07,10,'#b9b2a5','#6b4e36');tree3(x,z,.075);}
  bc(.12,.4,.03,.008,0,.18,'#3d4650');bx(.09,.392,.15,.394,.07,.17,'#f4f6f8','basic');
  return .64;},
// ── Cinéma (v15, refait) : salle sombre à bandeaux lumineux, hall vitré, marquise à ampoules, enseigne verticale, affiches,
// parvis avec tapis rouge et poteaux à cordon, kiosque à pop-corn, vrai parking (allée, places marquées, entrée depuis la rue) ──
cinema(r){
  bx(-.99,-.99,.99,.99,0,.007,'#e3ddd2');
  bx(-.92,-.92,.92,.08,0,.95,'#3d3550',null,'#2f2940');for(const y of[.22,.5,.78])bx(-.93,-.93,.93,.09,y,y+.02,'#b14aed','basic');
  bx(-.02,.08,.86,.095,.02,.36,'#ffd9a0','glass');for(const x of[.2,.42,.64])bc(x,.09,.006,.008,.02,.36,'#2b2433');   // hall vitré
  bx(-.06,.08,.9,.4,.38,.46,'#f4f4f4');bx(-.06,.399,.9,.403,.39,.45,'#ffd23f','basic');for(let k=0;k<10;k++)bx(-.02+k*.092,.392,.0+k*.092,.402,.37,.38,'#fff3c4','basic');   // marquise
  for(let k=0;k<5;k++)bx(.08+k*.15,.403,.18+k*.15,.407,.405,.435,'#e63946','basic');
  bx(-.14,.08,-.06,.18,.48,1.24,'#e63946','basic');for(let k=0;k<5;k++)bx(-.13,.18,-.07,.184,.56+k*.13,.64+k*.13,'#ffffff','basic');   // enseigne verticale
  for(const [x,c] of[[-.82,'#2e86ab'],[-.6,'#e4572e'],[-.38,'#3fa34d']])bx(x-.08,.08,x+.08,.092,.08,.34,c,'basic');   // affiches
  // parvis : tapis rouge, poteaux à cordon, kiosque à pop-corn, arbres
  bx(.3,.1,.56,.97,.007,.0095,'#c62828');for(const x of[.27,.59])for(let k=0;k<6;k++){const z=.2+k*.15;bc(x,z,.008,.008,0,.07,'#d4af37');if(k<5)beam(x,.06,z,x,.06,z+.15,.006,.006,'#b3202a');}
  bc(.78,.62,.07,.07,0,.15,'#ffffff');cone2(.78,.62,.15,.09,.11,8,'#e63946','#ffffff');bx(.71,.69,.85,.695,.06,.11,'#ffd23f','basic');
  for(const [x,z] of[[.12,.88],[.93,.9]]){cyl(x,z,0,.05,.07,.07,10,'#b9b2a5','#6b4e36');tree3(x,z,.075);}
  // parking : entrée depuis la rue à gauche, allée, une rangée de places contre le bâtiment et une côté rue
  bx(-.97,.12,-.08,.97,.007,.0075,'#5f656c');bx(-.97,.52,-.08,.66,.0075,.008,'#666c73');
  for(let k=0;k<=6;k++){const x=-.96+k*.13;bx(x-.004,.13,x+.004,.5,.0075,.0098,'#f2f2f2');if(k<6)spot(x+.065,.31,false,2);}
  for(let k=0;k<=5;k++){const x=-.76+k*.13;bx(x-.004,.68,x+.004,.95,.0075,.0098,'#f2f2f2');if(k<5)spot(x+.065,.815,false,2);}
  bx(-.96,.5,-.1,.506,.0075,.0098,'#f2f2f2');bx(-.76,.674,-.1,.68,.0075,.0098,'#f2f2f2');
  for(const x of[-.55,-.3]){bx(x-.06,.585,x+.02,.595,.0075,.0098,'#f2f2f2');const g_=G('plain'),cw=CC('#f2f2f2');tri(g_,V(x+.02,.0099,.57),V(x+.02,.0099,.61),V(x+.06,.0099,.59),cw);}   // flèches au sol
  hedge(-.76,.955,-.08,.985,.05);bc(-.84,.93,.006,.006,0,.22,'#59616a');bx(-.89,.926,-.79,.934,.16,.22,'#2f6fd6','basic');bx(-.855,.935,-.825,.937,.17,.21,'#ffffff','basic');   // panneau « P »
  sub(-.08,.6,0,()=>parkLamp(true));
  return 1.25;}});
// ── Décors (v15, plus détaillés) : massif en étages avec bordure de buis, coin repos (bancs face à face, jardinières),
// fontaine à vasques et jets, candélabre à trois globes, statue sur socle avec plaque, haie taillée avec boules de buis,
// kiosque à musique à escalier et lanternes ──
function flowerTuft(x,y,z,c,r){ico(x,y,z,.022*r,'#4d9a43',.7);for(let k=0;k<3;k++){const a=k*2.1+x*9;ico(x+Math.cos(a)*.012*r,y+.016*r,z+Math.sin(a)*.012*r,.011*r,c,.85);}}
function decoModel(i,x,z,r,ty){
  TX.x=x+.5;TX.z=z+.5;TX.k=0;const F=['#e63973','#f2b134','#ffffff','#a23b72','#ef6f6c','#8b6fd6','#ff9f40','#d62828'];
  switch(ty||deco[i]){
    case 1:{   // massif de fleurs : bordure de pierre, buis, trois couronnes de fleurs, topiaire au centre
      cyl(0,0,0,.05,.44,.44,20,'#cfc8bd','#6b4e36');cyl(0,0,.05,.056,.41,.41,20,'#5a4030');
      for(let k=0;k<26;k++){const a=k/26*6.283;ico(Math.cos(a)*.39,.07,Math.sin(a)*.39,.03,'#3f7d3a',.75);}
      const ring=(rr,n,c,h)=>{for(let k=0;k<n;k++){const a=k/n*6.283+rr*3;flowerTuft(Math.cos(a)*rr,.058+h,Math.sin(a)*rr,c,1.05);}};
      ring(.31,18,pick(r,F),0);ring(.22,13,pick(r,F),.012);ring(.13,8,pick(r,F),.024);
      cyl(0,0,.056,.09,.016,.014,6,'#6b4e36');cone(0,0,.09,.2,.07,10,'#2f6b34');ico(0,.3,0,.02,'#2f6b34');return .32;}
    case 2:{   // coin repos : dallage rond, deux bancs face à face, poubelle, jardinières fleuries, arbre
      cyl(0,0,0,.008,.44,.44,20,'#e3dccd','#e3dccd');for(let k=0;k<12;k++){const a=k/12*6.283;bx(Math.cos(a)*.2-.002,Math.sin(a)*.2-.08,Math.cos(a)*.2+.002,Math.sin(a)*.2+.08,.008,.0088,'#d2c9b6');}
      sub(0,-.2,0,benchM);sub(0,.2,2,benchM);
      bc(.3,0,.022,.022,0,.07,'#3d4650');bc(.3,0,.025,.025,.07,.077,'#2b3238');
      for(const s of[-1,1]){bx(-.38,s*.07-.05,-.28,s*.07+.05,0,.05,'#9a6a43');for(let k=0;k<3;k++)flowerTuft(-.33,.055,s*.07-.03+k*.03,pick(r,F),.8);}
      tree3(.32,.32,.085);return .32;}
    case 3:{   // fontaine : bassin octogonal avec margelle, mosaïque, deux vasques, jets en arc
      const wet=waterOK(),W=wet?'#5bc0eb':'#b8b0a2';
      cyl(0,0,0,.075,.4,.38,8,'#d6cfc2','#d6cfc2');cyl(0,0,.075,.095,.415,.415,8,'#ece6da','#ece6da');cyl(0,0,.085,.09,.35,.35,8,W,W,wet?'basic':null);
      for(let k=0;k<8;k++){const a=k/8*6.283+.39;bx(Math.cos(a)*.37-.02,Math.sin(a)*.37-.02,Math.cos(a)*.37+.02,Math.sin(a)*.37+.02,.02,.06,'#2a7fb0');}
      cyl(0,0,.09,.25,.05,.042,10,'#d6cfc2');cyl(0,0,.25,.29,.17,.19,12,'#ece6da',W);cyl(0,0,.29,.4,.028,.022,8,'#d6cfc2');cyl(0,0,.4,.43,.08,.09,10,'#ece6da',W);
      cyl(0,0,.43,.5,.016,.012,8,'#d6cfc2');ico(0,.52,0,.026,'#c9a227');
      if(wet){cone(0,0,.5,.12,.018,6,'#eaf8ff','basic');cyl(0,0,.1,.28,.19,.18,14,'#dff4ff',null,'basic');
        for(let k=0;k<8;k++){const a=k/8*6.283;beam(Math.cos(a)*.34,.09,Math.sin(a)*.34,Math.cos(a)*.24,.2,Math.sin(a)*.24,.008,.008,'#eaf8ff','basic');beam(Math.cos(a)*.24,.2,Math.sin(a)*.24,Math.cos(a)*.2,.12,Math.sin(a)*.2,.008,.008,'#eaf8ff','basic');}}
      return .52;}
    case 4:{   // candélabre à trois globes + deux lanternes basses, sur un petit dallage
      const on=lampOn(i)||ST.pp>0,C_='#2f3d36',gl=on?'#fff1c9':'#c9c4b8';cyl(0,0,0,.008,.3,.3,16,'#e3dccd','#e3dccd');
      cyl(0,0,.008,.05,.05,.04,8,C_);cyl(0,0,.05,.42,.011,.008,8,C_);cyl(0,0,.2,.215,.018,.018,8,C_);
      for(let k=0;k<3;k++){const a=k/3*6.283+.5,ex=Math.cos(a)*.085,ez=Math.sin(a)*.085;beam(0,.4,0,ex,.43,ez,.007,.007,C_);bc(ex,ez,.006,.006,.43,.445,C_);ico(ex,.47,ez,.028,gl,1,on?'glass':null);}
      ico(0,.47,0,.03,gl,1,on?'glass':null);cone(0,0,.495,.03,.012,6,C_);
      for(const [lx,lz] of[[.24,-.18],[-.24,.18]])sub(lx,lz,0,()=>{bc(0,0,.012,.012,0,.12,C_);bc(0,0,.02,.02,.12,.16,gl,on?'glass':null);cone(0,0,.16,.025,.026,4,C_);});
      return .5;}
    case 5:{   // statue en bronze sur socle mouluré, plaque dorée, couronne de fleurs
      const B='#4f7d6b',S_='#d6cfc2';cyl(0,0,0,.008,.34,.34,18,'#e3dccd');for(let k=0;k<14;k++){const a=k/14*6.283;flowerTuft(Math.cos(a)*.26,.008,Math.sin(a)*.26,k%2?'#f2b134':'#e63973',.9);}
      bc(0,0,.15,.15,0,.035,S_);bc(0,0,.13,.13,.035,.075,'#e3ded6');bc(0,0,.095,.095,.075,.3,S_);bc(0,0,.112,.112,.3,.322,'#e3ded6');bx(-.045,.095,.045,.099,.15,.23,'#c9a227');
      const y=.322;bc(-.017,.005,.012,.013,y,y+.13,B);bc(.017,-.005,.012,.013,y,y+.13,B);bc(0,0,.033,.02,y+.13,y+.24,B);beam(0,y+.13,-.018,0,y+.02,-.07,.05,.006,B);   // cape
      ico(0,y+.275,0,.028,B);beam(-.03,y+.22,0,-.07,y+.34,.015,.017,.017,B);ico(-.072,y+.355,.016,.022,'#7a9a3c');beam(.03,y+.22,0,.05,y+.13,.03,.017,.017,B);bx(.04,.015,.075,.045,y+.1,y+.14,'#3d5a4e');
      return .72;}
    case 6:{   // haie taillée arrondie, boules de buis aux extrémités, fleurs au pied
      bx(-.44,-.1,.44,.1,0,.012,'#6b4e36');bc(0,0,.34,.085,.012,.13,'#3f8a3c',null,'#4f9a45');for(let k=0;k<6;k++)ico(-.28+k*.112,.13,0,.075,'#4f9a45',.38);
      for(const s of[-1,1]){cyl(s*.4,0,0,.05,.06,.055,8,'#b9b2a5','#6b4e36');ico(s*.4,.11,0,.065,'#3f7d3a');}
      for(let k=0;k<10;k++){const x_=-.33+k*.073;flowerTuft(x_,.012,.13,pick(r,F),.7);flowerTuft(x_+.03,.012,-.13,pick(r,F),.7);}return .2;}
    case 7:{   // kiosque à musique : socle octogonal, escalier, garde-corps, colonnes en fonte, toit en dôme festonné, lanternes
      const G_='#2f5d52';cyl(0,0,0,.06,.42,.42,8,'#d6cfc2','#e3ddd2');cyl(0,0,.06,.08,.39,.39,8,'#d6cfc2','#e8e2d6');
      for(let k=0;k<3;k++)bx(-.11,.36+k*.035,.11,.4+k*.035,0,.06-k*.02,'#d6cfc2');
      for(let k=0;k<8;k++){const a=k/8*6.283+.39,px=Math.cos(a)*.35,pz=Math.sin(a)*.35,a2=(k+1)/8*6.283+.39,qx=Math.cos(a2)*.35,qz=Math.sin(a2)*.35;
        bc(px,pz,.011,.011,.08,.38,G_);ico(px,.08,pz,.016,G_,.6);
        if(k!==1){beam(px,.17,pz,qx,.17,qz,.008,.008,G_);beam(px,.1,pz,qx,.1,qz,.006,.006,G_);for(let j=1;j<4;j++){const u=j/4;bc(lerp(px,qx,u),lerp(pz,qz,u),.003,.003,.1,.17,G_);}}
        beam(px,.36,pz,qx,.36,qz,.01,.012,'#c9a227');bc(px*.98,pz*.98,.012,.012,.3,.33,'#fff1c9','glass');}
      cyl(0,0,.38,.41,.43,.43,8,G_,G_);for(let k=0;k<16;k++){const a=k/16*6.283;cone(Math.cos(a)*.42,Math.sin(a)*.42,.355,.03,.03,4,G_);}
      dome(0,0,.41,.42,8,'#3f8f80',.55);cyl(0,0,.63,.68,.035,.025,8,'#c9a227');cone(0,0,.68,.08,.018,6,'#c9a227');ico(0,.77,0,.018,'#c9a227');return .78;}
  }
  return 0;
}
function ovpBits(i){const L=OVE.get(i);if(!L)return 0;let b=0;for(const e of L)b|=[1,2,4,8][e.d];return b;}   /* v15 : la route s'ouvre vers la rampe du pont routier */
const ANAT=[
  {k:'crane',n:'Crâne et mâchoire',re:/crane|occipit|temporal|temporo|mandibul|masseter|sphenoid|pariet|ethmoid|zygomat|machoire|\batm\b/,
    q:[['Quel os du crâne s’articule avec l’atlas (C1) ?',['L’occipital','Le temporal','Le sphénoïde','Le pariétal'],'Les condyles de l’occipital reposent sur les masses latérales de l’atlas : c’est l’articulation atlanto-occipitale.'],
       ['Quel muscle ferme la bouche en élevant la mandibule quand on mâche ?',['Le masséter','Le digastrique','Le platysma','Le sterno-cléido-mastoïdien'],'Le masséter (avec le temporal et le ptérygoïdien médial) élève la mandibule.']]},
  {k:'cou',n:'Cou',re:/cervic|atlas|\baxis\b|odonto|sterno-?cleido|scalene|torticolis|whiplash/,
    q:[['Combien de vertèbres cervicales a-t-on ?',['7','5','8','12'],'7 cervicales, 12 thoraciques et 5 lombaires.'],
       ['Où se fait environ la moitié de la rotation de la tête ?',['Entre l’atlas et l’axis (C1-C2)','Entre l’occipital et l’atlas (C0-C1)','Entre C6 et C7','À la charnière cervico-thoracique'],'L’atlas tourne autour de la dent de l’axis : l’articulation atlanto-axoïdienne assure environ la moitié de la rotation cervicale.']]},
  {k:'epaule',n:'Épaule',re:/epaule|scapul|omoplate|clavicul|acromi|gleno|coiffe|supra-?epineu|infra-?epineu|subscapul|deltoid|capsulite/,
    q:[['Quels muscles forment la coiffe des rotateurs ?',['Supra-épineux, infra-épineux, petit rond, subscapulaire','Deltoïde, grand pectoral, grand dorsal, trapèze','Supra-épineux, deltoïde, biceps, petit rond','Grand rond, petit rond, rhomboïdes, dentelé antérieur'],'Les 4 muscles de la coiffe centrent la tête humérale dans la glène.'],
       ['Quel muscle de la coiffe participe à l’abduction et passe sous l’acromion ?',['Le supra-épineux','Le grand dorsal','Le subscapulaire','Le grand rond'],'Le tendon du supra-épineux passe sous l’acromion : c’est le plus souvent touché dans le conflit sous-acromial.']]},
  {k:'bras',n:'Bras',re:/humer|triceps brach|biceps brach|nerf radial/,
    q:[['Quel nerf longe le sillon du nerf radial, sur la diaphyse de l’humérus ?',['Le nerf radial','Le nerf ulnaire','Le nerf médian','Le nerf musculo-cutané'],'Une fracture de la diaphyse humérale peut léser le nerf radial (main tombante).'],
       ['Quel est le principal extenseur du coude ?',['Le triceps brachial','Le biceps brachial','Le brachial','Le brachio-radial'],'Le triceps brachial, aidé par l’anconé.']]},
  {k:'coude',n:'Coude',re:/coude|olecran|epicondyl|epitrochle|ulna\b|cubital|tennis elbow|brachio-?radial/,
    q:[['Quel muscle fléchit le coude quelle que soit la position de l’avant-bras ?',['Le brachial','Le biceps brachial','Le triceps brachial','L’anconé'],'Le brachial s’insère sur l’ulna : il fléchit le coude en pronation comme en supination. Le biceps est aussi un puissant supinateur.'],
       ['L’épicondylite latérale (« tennis elbow ») touche surtout le tendon de quel muscle ?',['Le court extenseur radial du carpe','Le rond pronateur','Le fléchisseur ulnaire du carpe','Le biceps brachial'],'Elle touche l’insertion des épicondyliens latéraux, en premier le court extenseur radial du carpe.']]},
  {k:'poignet',n:'Avant-bras et poignet',re:/poignet|carpe|carpien|scaphoid|radius|pouteau|avant-?bras|pronat|supinat|quervain/,
    q:[['Quel os du carpe se fracture le plus souvent après une chute sur la main ?',['Le scaphoïde','Le pisiforme','Le trapézoïde','L’hamatum'],'Douleur dans la tabatière anatomique après une chute : on pense au scaphoïde.'],
       ['Quel nerf passe dans le canal carpien ?',['Le nerf médian','Le nerf ulnaire','Le nerf radial','Le nerf musculo-cutané'],'Sa compression donne le syndrome du canal carpien (fourmillements du pouce à l’annulaire).']]},
  {k:'main',n:'Main',re:/\bmains?\b|doigt|phalang|metacarp|pouce|thenar|interosseu|lombrical|dupuytren|rhizarthrose/,
    q:[['Combien d’os forment le carpe ?',['8','5','7','14'],'8 os du carpe, 5 métacarpiens et 14 phalanges par main.'],
       ['Quel nerf innerve les muscles interosseux de la main ?',['Le nerf ulnaire','Le nerf médian','Le nerf radial','Le nerf axillaire'],'Le nerf ulnaire innerve les interosseux, l’hypothénar et les lombricaux 3-4 ; le médian surtout le thénar et les lombricaux 1-2.']]},
  {k:'thorax',n:'Thorax',re:/thorax|thoraciq|costal|sternum|diaphragm|intercost|respirat|poumon|pulmon|bpco|asthm|ventilat|spirom|bronch/,
    q:[['Combien de paires de côtes avons-nous ?',['12','10','11','14'],'7 paires de vraies côtes, 3 de fausses côtes et 2 de côtes flottantes.'],
       ['Quel est le principal muscle de l’inspiration ?',['Le diaphragme','Les intercostaux internes','Le grand droit de l’abdomen','Le grand dorsal'],'En se contractant, le diaphragme descend et agrandit la cage thoracique.']]},
  {k:'lomb',n:'Bas du dos',re:/lomb|lumba|sacr|coccy|hernie discale|discal|sciati|rachis|scoliose|spondyl|multifid|\bdos\b/,
    q:[['Combien de vertèbres lombaires a-t-on ?',['5','4','7','12'],'5 vertèbres lombaires, de L1 à L5, puis le sacrum.'],
       ['Quel muscle profond stabilise le rachis lombaire segment par segment ?',['Le multifide','Le trapèze','Le grand dorsal','Le rhomboïde'],'Le multifide, muscle profond, est souvent travaillé dans la rééducation des lombalgies.']]},
  {k:'bassin',n:'Bassin et hanche',re:/hanche|bassin|pelvi|coxo|cotyl|acetabul|fessier|psoas|piriform|trendelenburg|sacro-?iliaq/,
    q:[['Quel muscle stabilise le bassin quand on est sur une seule jambe ?',['Le moyen fessier','Le grand fessier','Le psoas','Le piriforme'],'S’il est faible, le bassin s’abaisse du côté opposé à l’appui : c’est le signe de Trendelenburg.'],
       ['Quel est le plus puissant fléchisseur de la hanche ?',['L’ilio-psoas','Le grand fessier','Le semi-tendineux','Le grand adducteur'],'L’ilio-psoas (psoas + iliaque) s’insère sur le petit trochanter.']]},
  {k:'cuisse',n:'Cuisse',re:/cuisse|femur|femoral|quadricep|ischio|adducteur|vaste|sartorius|gracile/,
    q:[['Quels muscles forment les ischio-jambiers ?',['Biceps fémoral, semi-tendineux, semi-membraneux','Droit fémoral, vaste latéral, vaste médial','Gracile, sartorius, semi-tendineux','Biceps fémoral, gastrocnémien, soléaire'],'Ils fléchissent le genou et étendent la hanche.'],
       ['Quel chef du quadriceps croise aussi l’articulation de la hanche ?',['Le droit fémoral','Le vaste médial','Le vaste latéral','Le vaste intermédiaire'],'Le droit fémoral s’insère sur l’épine iliaque antéro-inférieure : il fléchit aussi la hanche.']]},
  {k:'genou',n:'Genou',re:/genou|patell|rotul|menisq|croise|\blca\b|\blcp\b|lachman|\bptg\b/,
    q:[['Quel ligament empêche le tibia de glisser vers l’avant sous le fémur ?',['Le ligament croisé antérieur','Le ligament croisé postérieur','Le ligament collatéral médial','Le ligament patellaire'],'Le LCA limite la translation antérieure du tibia.'],
       ['Quel test recherche une rupture du ligament croisé antérieur ?',['Le test de Lachman','Le test de Thompson','Le test de Phalen','Le test de Neer'],'Lachman : tiroir antérieur genou fléchi à environ 20-30°.']]},
  {k:'jambe',n:'Jambe',re:/jambe|tibia|fibula|perone|mollet|triceps sural|gastrocnem|soleaire|achille/,
    q:[['Avec les gastrocnémiens, quel muscle forme le tendon d’Achille ?',['Le soléaire','Le tibial antérieur','Le long fibulaire','Le poplité'],'Gastrocnémiens + soléaire = triceps sural, qui se termine par le tendon calcanéen (d’Achille).'],
       ['Quel nerf contourne le col de la fibula et peut y être comprimé ?',['Le nerf fibulaire commun','Le nerf tibial','Le nerf saphène','Le nerf sural'],'Sa compression donne un pied tombant (steppage).']]},
  {k:'pied',n:'Cheville et pied',re:/cheville|\bpieds?\b|talus|astragal|calcan|tarse|metatars|orteil|hallux|entorse|ottawa|plantaire|voute/,
    q:[['Quel ligament est le plus souvent touché dans une entorse de cheville en inversion ?',['Le talo-fibulaire antérieur','Le ligament deltoïde','Le calcanéo-cuboïdien','Le talo-fibulaire postérieur'],'Le faisceau antérieur du ligament collatéral latéral est le premier à céder.'],
       ['Quel muscle est le principal releveur du pied ?',['Le tibial antérieur','Le long fibulaire','Le soléaire','Le tibial postérieur'],'Le tibial antérieur assure la flexion dorsale de la cheville.']]}
];
const ANAT_DAYMAX=12,ANAT_PRIZE=120,ANAT_ALL=3000;
let ANQ=null;   // question en cours {z, q, order, ans, own, t0}
function anaNorm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}
function anaUserPool(z){
  const A=ANAT.find(a=>a.k===z);if(!A)return[];const cmap=courseMap();
  return quizBase(cmap).filter(q=>{const co=cmap.get(String(q.courseId));return A.re.test(anaNorm(q.question+' '+(co&&co.name||'')));});
}
function anaAsk(z){
  const A=ANAT.find(a=>a.k===z);if(!A)return;const U=anaUserPool(z),seen=new Set(S.anaSeen||[]);let q,own=false;
  const fresh=U.filter(x=>!seen.has(String(x.id)));
  if(U.length&&(fresh.length||Math.random()<.6)){q=rpick(fresh.length?fresh:U);own=true;S.anaSeen=(S.anaSeen||[]).concat(String(q.id)).slice(-200);}
  else{const i=((S.anaB||{})[z]|0)%A.q.length;S.anaB=Object.assign({},S.anaB,{[z]:i+1});const b=A.q[i];q={id:'an:'+z+i,question:b[0],answers:b[1],correct:0,expl:b[2]};}
  const order=q.answers.map((_,j)=>j).filter(j=>String(q.answers[j]||'').trim()).sort(()=>Math.random()-.5);
  ANQ={z,q,order,ans:null,own,t0:performance.now(),n:U.length};renderPanel();
}
function anaAnswer(j){
  if(!ANQ||ANQ.ans!=null)return;ANQ.ans=j;const q=ANQ.q,ok=j===(q.correct|0);
  if(ANQ.own){try{if(typeof recordAnswer==='function'){recordAnswer(q.id,ok,Math.round((performance.now()-ANQ.t0)/1000));if(typeof saveAll==='function')saveAll();}}catch(e){}}
  ANQ.gain=0;
  if(ok){if(!S.ana)S.ana={};const first=!S.ana[ANQ.z];S.ana[ANQ.z]=(S.ana[ANQ.z]|0)+1;
    const td=new Date().toDateString();if(S.anaDay!==td){S.anaDay=td;S.anaN=0;}
    if((S.anaN|0)<ANAT_DAYMAX){S.anaN=(S.anaN|0)+1;ANQ.gain=ANAT_PRIZE;S.money+=ANAT_PRIZE;floatMoney(ANAT_PRIZE);}
    sndPlay('coin');
    const n=ANAT.filter(a=>S.ana[a.k]).length;if(n>=3)v6Quest('anat3');
    if(first&&n===ANAT.length&&!S.anaAll){S.anaAll=S.day||1;S.money+=ANAT_ALL;floatMoney(ANAT_ALL);fireworks(5,'Tu as exploré tout le squelette !');news('skeleton','Le squelette du musée n’a plus de secret pour le maire',`Les ${ANAT.length} parties du corps sont explorées : +${money(ANAT_ALL)}.`,'good');}}
  save();renderPanel();
}
const ANAT_SVG=`<g class="bone">
<ellipse cx="100" cy="38" rx="21" ry="25"/><path d="M86 58 Q100 72 114 58 L112 64 Q100 76 88 64Z"/>
<rect x="95" y="66" width="10" height="5" rx="2"/><rect x="95" y="73" width="10" height="5" rx="2"/><rect x="95" y="80" width="10" height="5" rx="2"/>
<path d="M100 90 L66 88 M100 90 L134 88" stroke-width="5" fill="none"/>
<path d="M72 104 Q100 92 128 104 M70 114 Q100 102 130 114 M70 124 Q100 112 130 124 M72 134 Q100 122 128 134 M75 144 Q100 132 125 144 M80 153 Q100 142 120 153" stroke-width="4" fill="none"/>
<rect x="96" y="92" width="8" height="64" rx="3"/>
${[0,1,2,3,4].map(k=>`<rect x="94" y="${160+k*9}" width="12" height="7" rx="2.5"/>`).join('')}
<path d="M68 214 Q70 200 92 204 L100 210 L108 204 Q130 200 132 214 Q128 232 112 236 L100 230 L88 236 Q72 232 68 214Z"/>
<path d="M66 94 L58 158 M134 94 L142 158" stroke-width="7" fill="none"/><path d="M58 166 L52 226 M142 166 L148 226" stroke-width="5.5" fill="none"/>
<ellipse cx="50" cy="244" rx="8" ry="13"/><ellipse cx="150" cy="244" rx="8" ry="13"/>
<path d="M88 238 L84 296 M112 238 L116 296" stroke-width="8" fill="none"/><circle cx="84" cy="302" r="5.5"/><circle cx="116" cy="302" r="5.5"/>
<path d="M84 310 L82 350 M116 310 L118 350" stroke-width="6.5" fill="none"/>
<ellipse cx="80" cy="358" rx="11" ry="6"/><ellipse cx="120" cy="358" rx="11" ry="6"/></g>
<circle cx="92" cy="36" r="5" fill="#5d4f3f"/><circle cx="108" cy="36" r="5" fill="#5d4f3f"/>`;
const ANAT_HOT={crane:'<ellipse cx="100" cy="42" rx="27" ry="32"/>',cou:'<rect x="88" y="64" width="24" height="24"/>',epaule:'<circle cx="68" cy="94" r="13"/><circle cx="132" cy="94" r="13"/>',
  bras:'<rect x="52" y="106" width="16" height="48"/><rect x="132" y="106" width="16" height="48"/>',coude:'<circle cx="58" cy="162" r="9"/><circle cx="142" cy="162" r="9"/>',
  poignet:'<rect x="44" y="172" width="16" height="56"/><rect x="140" y="172" width="16" height="56"/>',main:'<ellipse cx="50" cy="245" rx="12" ry="16"/><ellipse cx="150" cy="245" rx="12" ry="16"/>',
  thorax:'<ellipse cx="100" cy="124" rx="31" ry="31"/>',lomb:'<rect x="88" y="157" width="24" height="44"/>',bassin:'<ellipse cx="100" cy="219" rx="35" ry="18"/>',
  cuisse:'<rect x="76" y="240" width="18" height="54"/><rect x="106" y="240" width="18" height="54"/>',genou:'<circle cx="84" cy="302" r="10"/><circle cx="116" cy="302" r="10"/>',
  jambe:'<rect x="74" y="312" width="16" height="38"/><rect x="110" y="312" width="16" height="38"/>',pied:'<ellipse cx="80" cy="358" rx="15" ry="9"/><ellipse cx="120" cy="358" rx="15" ry="9"/>'};
function panelAnato(){
  if(!svcCount('anato'))return head('skeleton','Musée d’anatomie','')+`<p class="cty-p">Construis d’abord le musée d’anatomie (Loisirs).</p>`;
  const A=S.ana||{},n=ANAT.filter(a=>A[a.k]).length,td=new Date().toDateString(),left=S.anaDay===td?Math.max(0,ANAT_DAYMAX-(S.anaN|0)):ANAT_DAYMAX;
  let h=head('skeleton','Musée d’anatomie',`${n} / ${ANAT.length} parties explorées · ${left ? `encore ${left} prime${left>1?'s':''} de ${money(ANAT_PRIZE)} aujourd’hui`:'primes du jour épuisées'}`,'#7b61c9');
  if(ANQ){const Z=ANAT.find(a=>a.k===ANQ.z),q=ANQ.q,L='ABCDEFGHIJ',done=ANQ.ans!=null;
    h+=`<div class="cty-anz"><span class="ms">skeleton</span><b>${esc(Z.n)}</b><small>${ANQ.own?'Question tirée de tes cours':'Question du musée'}</small></div>`
      +`<div class="cty-qq">${esc(q.question)}</div><div class="cty-qas">`+ANQ.order.map((j,k)=>{let cl='';if(done){if(j===(q.correct|0))cl=' ok';else if(j===ANQ.ans)cl=' ko';}
        return `<button class="cty-qa${cl}" data-act="ana" data-j="${j}"${done?' disabled':''}><b>${L[k]||k+1}</b><span>${esc(q.answers[j])}</span></button>`;}).join('')+`</div>`;
    if(done){const ok=ANQ.ans===(q.correct|0);h+=`<div class="cty-qfb ${ok?'ok':'ko'}"><b>${ok?'Bonne réponse !':'Raté…'}</b> ${ok?(ANQ.gain?`+${money(ANQ.gain)}.`:'Bravo !'):`La bonne réponse : <b>${esc(q.answers[q.correct|0])}</b>.`}${q.expl?`<small>${esc(q.expl)}</small>`:''}</div>`
      +`<div class="cty-anbt"><button class="cty-btn" data-act="anaz" data-k="${ANQ.z}"><span class="ms">refresh</span>Autre question</button><button class="cty-btn ghost" data-act="anaback"><span class="ms">skeleton</span>Retour au squelette</button></div>`;}
    return h;}
  h+=`<div class="cty-anat"><svg viewBox="0 0 200 370" role="img" aria-label="Squelette">${ANAT_SVG}${ANAT.map(a=>`<g class="hot${A[a.k]?' ok':''}" data-act="anaz" data-k="${a.k}"><title>${esc(a.n)}</title>${ANAT_HOT[a.k]}</g>`).join('')}</svg>`
    +`<div class="cty-anl">${ANAT.map(a=>`<button class="${A[a.k]?'ok':''}" data-act="anaz" data-k="${a.k}">${A[a.k]?'<span class="ms">check_circle</span>':''}${esc(a.n)}</button>`).join('')}</div></div>`
    +`<p class="cty-p small">Touche une partie du squelette. Tes propres questions sur cette partie du corps passent en premier (elles comptent comme des révisions) ; sinon, le musée t’en pose une. Explore les ${ANAT.length} parties : +${money(ANAT_ALL)}.</p>`;
  return h;
}

// ── La Gazette du dimanche : chaque semaine, tes chiffres de révision et des titres amusants ──
function gzDay(k){return new Date(Date.now()-k*864e5).toISOString().split('T')[0];}
// questions par jour (0 = aujourd'hui … 29) : le plus grand des deux compteurs, séances Kiné+ (dailyCounts)
// ou questions dont la dernière réponse date de ce jour (diffData : compte aussi les quiz de la ville)
function gzCounts(){
  const dc=typeof dailyCounts!=='undefined'&&dailyCounts?dailyCounts:{},dd=typeof diffData!=='undefined'&&diffData?diffData:{},by=new Map();
  for(const id in dd){const d=dd[id];if(d&&d.lastDate)by.set(d.lastDate,(by.get(d.lastDate)||0)+1);}
  const out=[];for(let k=0;k<30;k++){const t=new Date(Date.now()-k*864e5);out.push(Math.max(dc[gzDay(k)]|0,by.get(t.toDateString())||0));}
  return out;
}
function gzStats(){
  const dc=gzCounts();
  let q=0,days=0,best=0,bestK=0,qp=0;for(let k=0;k<7;k++){const v=dc[k];q+=v;if(v>0)days++;if(v>best){best=v;bestK=k;}}for(let k=7;k<14;k++)qp+=dc[k];
  const lim=new Set();for(let k=0;k<7;k++)lim.add(new Date(Date.now()-k*864e5).toDateString());
  const cmap=courseMap(),F=new Map(),dd=typeof diffData!=='undefined'&&diffData?diffData:{};
  for(const qq of(typeof questions!=='undefined'&&Array.isArray(questions)?questions:[])){const d=dd[qq.id];if(!d||!lim.has(d.lastDate))continue;
    const co=cmap.get(String(qq.courseId)),fid=co?String(co.folderId):'';const o=F.get(fid)||{n:0,ok:0};o.n++;if(d.lastCorrect)o.ok++;F.set(fid,o);}
  const fl=typeof folders!=='undefined'&&Array.isArray(folders)?folders:[];
  const subj=[...F.entries()].map(([fid,o])=>({name:(fl.find(f=>String(f.id)===fid)||{}).name||'Autres cours',n:o.n,p:Math.round(o.ok/o.n*100)})).sort((a,b)=>b.n-a.n).slice(0,4);
  const streak=typeof stats!=='undefined'&&stats?stats.streak|0:0,bestDay=new Date(Date.now()-bestK*864e5).toLocaleDateString('fr-FR',{weekday:'long'});
  return{q,qp,days,best,bestDay,subj,streak};
}
function gzHeadlines(G){
  const H=[],add=(t,d,ic)=>H.push([t,d,ic||'newspaper']);
  if(!G.q)add('Le maire introuvable','Aucune question cette semaine : les livres de la bibliothèque prennent la poussière. Un petit défi ?','menu_book');
  else if(G.q>=300)add('Semaine record à la bibliothèque !',`${fmt(G.q)} questions en 7 jours : les habitants parlent d’un maire « en mode partiels ».`,'local_library');
  if(G.qp&&G.q>G.qp*1.3)add('Le maire passe la seconde',`+${Math.round((G.q/G.qp-1)*100)} % de questions par rapport à la semaine dernière.`,'trending_up');
  else if(G.qp&&G.q&&G.q<G.qp*.7)add('Petite baisse de régime',`${fmt(G.q)} questions contre ${fmt(G.qp)} la semaine passée. Le café de la mairie est offert pour repartir !`,'coffee');
  if(G.days===7)add('Sept jours sur sept !','Le maire a révisé tous les jours : une statue en chocolat est à l’étude.','emoji_events');
  if(G.streak>=10)add(`${G.streak} jours de série`,'Les habitants n’avaient jamais vu une telle régularité.','local_fire_department');
  const top=G.subj.find(s=>s.n>=5&&s.p>=80),hard=G.subj.find(s=>s.n>=5&&s.p<55);
  if(top)add(`« ${top.name} » : la matière qui cartonne`,`${top.p} % de bonnes réponses sur ${top.n} questions.`,'star');
  if(hard)add(`« ${hard.name} » donne du fil à retordre`,`${hard.p} % de bonnes réponses : un tour au Défi du maire sur cette matière ?`,'psychology');
  const F=[];if(laneCount(1)>8)F.push(['Les vélos plus rapides que les voitures','Aux heures de pointe, les cyclistes arrivent les premiers au travail.','pedal_bike']);
  if(svcCount('anato'))F.push(['Rumeur au musée','Un gardien jure que le squelette a changé de pose pendant la nuit.','skeleton']);
  if(laneCount(2))F.push(['Le marché du dimanche fait le plein','Les fraises de la rue piétonne sont parties avant 10 h.','storefront']);
  if(svcCount('aeroport'))F.push(['Embouteillage… dans le ciel','Trois avions attendaient leur tour au-dessus de la ville.','flight']);
  F.push(['Un pigeon élu mascotte de la mairie','Il assiste à toutes les réunions du conseil municipal.','flutter_dash'],['Concours de tartes au parc','La tarte aux pommes l’emporte de justesse.','bakery_dining']);
  const f=F[(((Date.now()/6048e5)|0)+(S.seed|0))%F.length];add(f[0],f[1],f[2]);
  return H;
}
function gzKey(){const d=new Date();d.setDate(d.getDate()-d.getDay());return d.toDateString();}   // dernier dimanche
function gzSection(){
  const G=gzStats(),H=gzHeadlines(G),wk=['L','M','M','J','V','S','D'],dc=gzCounts();
  const bars=[...Array(7)].map((_,k)=>{const kk=6-k,v=dc[kk],d=new Date(Date.now()-kk*864e5);return{v,l:wk[(d.getDay()+6)%7]};}),mx=Math.max(1,...bars.map(b=>b.v));
  return `<div class="cty-gzs"><div class="cty-gzs-t"><span class="ms">newspaper</span><b>Édition du dimanche</b><small>tes 7 derniers jours de révision</small></div>`
    +`<div class="cty-gzs-k"><div><b>${fmt(G.q)}</b><small>questions</small></div><div><b>${G.days} / 7</b><small>jours révisés</small></div><div><b>${G.streak}</b><small>jours de série</small></div><div><b>${G.best?fmt(G.best):'–'}</b><small>${G.best?'meilleur jour : '+esc(G.bestDay):'meilleur jour'}</small></div></div>`
    +`<div class="cty-gzs-b">${bars.map(b=>`<div title="${b.v} question${b.v>1?'s':''}"><i style="height:${Math.round(b.v/mx*100)}%"></i><small>${b.l}</small></div>`).join('')}</div>`
    +H.map(([t,d,ic])=>`<div class="cty-news"><span class="ms">${ic}</span><div><b>${esc(t)}</b><small>${esc(d)}</small></div></div>`).join('')
    +(G.subj.length?`<div class="cty-gzs-s">${G.subj.map(s=>`<div><span>${esc(s.name)}</span><i><u style="width:${s.p}%"></u></i><b>${s.p} %</b></div>`).join('')}<small>Bonnes réponses par matière (dernière réponse de chaque question de la semaine)</small></div>`:'')
    +`</div>`;
}
function gzTick(){
  if(VISIT||!S)return;const k=gzKey();if(S.gzSeen===k)return;const first=!S.gzSeen;S.gzSeen=k;
  const G=gzStats(),prime=first?0:Math.min(1050,G.days*150);if(prime){S.money+=prime;floatMoney(prime);}
  news('newspaper','La Gazette du dimanche est arrivée',`${fmt(G.q)} questions et ${G.days} jour${G.days>1?'s':''} de révision cette semaine${prime?` · prime de lecture +${money(prime)}`:''}.`,'good');
  toast(`<b>La Gazette du dimanche est arrivée !</b>${prime?` Prime de lecture : +${money(prime)} (${G.days} jour${G.days>1?'s':''} révisé${G.days>1?'s':''}).`:''}`,'newspaper',{label:'Lire',fn:()=>openPanel('journal')});save();
}

// ── Courbes d'évolution en grand : choix de la courbe et de la période, valeur au survol ──
const CURV=[['pop','Habitants',0,'#0e8c87',v=>fmt(v)],['money','Trésorerie',1,'#3b8fdc',v=>money(v)],['net','Bilan du mois',2,'#7b61c9',v=>money(v)],['hap','Bonheur',3,'#f08c3a',v=>Math.round(v)+' %'],
  ['tour','Tourisme',4,'#e05a8a',v=>fmt(v)+' pts'],['jobs','Emplois',5,'#2a9d8f',v=>fmt(v)],['pat','Patients guéris',6,'#d64545',v=>fmt(v)],['quiz','Questions du maire',7,'#c9a227',v=>fmt(v)],['rev','Mes révisions (30 j)',-1,'#3fae62',v=>fmt(v)]];
let CURVS={s:'pop',p:'all'};
function curveSVG(vals,labels,col,f,bars){
  const W=380,H=200,L=40,B=22,T=10,n=vals.length,ax=v=>{const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(1).replace('.',',')+' M':a>=1e4?Math.round(v/1e3)+' k':fmt(v);};if(n<2)return '<p class="cty-p small">La courbe apparaîtra après quelques mois de jeu.</p>';
  let mn=Math.min(...vals),mx=Math.max(...vals);if(bars)mn=0;if(mx===mn){mx+=1;mn=Math.max(0,mn-1);}const X=k=>L+(bars?(k+.5)/n:k/(n-1))*(W-L-8),Y=v=>T+(1-(v-mn)/(mx-mn))*(H-T-B);
  let g='';for(let k=0;k<=3;k++){const v=mn+(mx-mn)*k/3,y=Y(v);g+=`<line x1="${L}" x2="${W-8}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="gl"/><text x="${L-6}" y="${(y+3.5).toFixed(1)}" text-anchor="end">${esc(ax(v))}</text>`;}
  const step=Math.max(1,Math.ceil(n/4));for(let k=0;k<n;k+=step)g+=`<text x="${X(k).toFixed(1)}" y="${H-6}" text-anchor="middle">${esc(labels[k])}</text>`;
  let body='';
  if(bars){const bw=Math.max(2,(W-L-8)/n*.7);vals.forEach((v,k)=>{body+=`<rect x="${(X(k)-bw/2).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(mn)-Y(v)).toFixed(1)}" rx="2" fill="${col}" opacity=".85"><title>${esc(labels[k])} : ${esc(f(v))}</title></rect>`;});}
  else{const pts=vals.map((v,k)=>`${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    body=`<polygon points="${L},${Y(mn).toFixed(1)} ${pts} ${X(n-1).toFixed(1)},${Y(mn).toFixed(1)}" fill="${col}" opacity=".12"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round"/>`;
    const cw=(W-L-8)/(n-1);vals.forEach((v,k)=>{body+=`<g class="pt"><rect x="${(X(k)-cw/2).toFixed(1)}" y="${T}" width="${cw.toFixed(1)}" height="${H-T-B}" fill="transparent"/><circle cx="${X(k).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.4" fill="${col}"/><title>${esc(labels[k])} : ${esc(f(v))}</title></g>`;});}
  return `<div class="cty-curve"><svg viewBox="0 0 ${W} ${H}">${g}${body}</svg></div>`;
}
function panelCurves(){
  const C=CURV.find(c=>c[0]===CURVS.s)||CURV[0];let vals=[],labels=[];
  if(C[2]<0){const dc=gzCounts();for(let k=29;k>=0;k--){vals.push(dc[k]);labels.push(new Date(Date.now()-k*864e5).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}));}}
  else{const H=S.hist||[],per=CURVS.p==='1a'?12:CURVS.p==='3a'?36:H.length,cut=H.slice(-per),now=(S.day/30)|0;
    cut.forEach((a,k)=>{const v=a[C[2]];if(v==null)return;const m=a[8]!=null?((a[8]/30)|0)-1:now-(cut.length-k);vals.push(v);labels.push(`${MONTHS[((m%12)+12)%12]} ${2026+Math.floor(m/12)}`);});}
  const first=vals[0],last=vals[vals.length-1],ch=vals.length>1&&first?Math.round((last/first-1)*100):null;
  return head('show_chart','Courbes d’évolution',C[2]<0?'Questions répondues chaque jour dans Kiné+':`Un point par mois de jeu · ${vals.length} mois`,'#0e8c87')
    +`<div class="cty-pchips">${CURV.map(c=>`<button class="${c[0]===C[0]?'on':''}" data-act="curs" data-k="${c[0]}">${esc(c[1])}</button>`).join('')}</div>`
    +(C[2]<0?'':`<div class="cty-tsp cty-curp">${[['1a','1 an'],['3a','3 ans'],['all','Tout']].map(([k,n])=>`<button class="${CURVS.p===k?'on':''}" data-act="curp" data-k="${k}"><b>${n}</b></button>`).join('')}</div>`)
    +curveSVG(vals,labels,C[3],C[4],C[2]<0)
    +(vals.length?rows([['flag','Au début',C[4](first)],['today','Maintenant',C[4](last)],['trending_up','Évolution',ch==null||!isFinite(ch)?'–':(ch>=0?'+':'')+ch+' %'],['arrow_upward','Maximum',C[4](Math.max(...vals))]]):'')
    +`<p class="cty-p small">Passe la souris sur la courbe pour lire la valeur de chaque mois.${C[2]>=5?' Les nouvelles courbes (emplois, patients, questions) commencent à partir d’aujourd’hui.':''}</p>`;
}

// ── Carnet de quêtes : tutoriel, défis et quêtes de découverte, avec « Montre-moi » ──
const V6Q=[
  {id:'bike',t:'Pose une piste cyclable',d:'Routes → Piste cyclable, sur 5 cases au moins.',r:800,go:{c:'roads',k:'x:lane:1'}},
  {id:'ped',t:'Crée une rue piétonne',d:'Routes → Rue piétonne : terrasses, marché et lampions.',r:1000,go:{c:'roads',k:'x:lane:2'}},
  {id:'anat',t:'Construis le musée d’anatomie',d:'Loisirs → Musée d’anatomie.',r:1500,go:{c:'loisirs',k:'place:anato'},ok:()=>svcCount('anato')>0},
  {id:'anat3',t:'Explore 3 parties du squelette',d:'Touche le musée, puis une partie du corps, et réponds juste.',r:1200,go:{p:'anato'}},
  {id:'sos',t:'Sauve la ville',d:'Pendant un incendie, réponds juste à 3 questions dans le bandeau rouge.',r:1500},
  {id:'stars',t:'Regarde les étoiles',d:'Réglages → Heure du ciel → Nuit, puis « Regarder le ciel ».',r:500,go:{p:'settings'}},
  {id:'gazette',t:'Lis la Gazette du dimanche',d:'Bouton Journal : l’édition du dimanche résume ta semaine de révision.',r:500,go:{p:'journal'}},
  {id:'curves',t:'Regarde tes courbes',d:'Statistiques → Courbes d’évolution en grand.',r:400,go:{p:'curves'}},
  {id:'tram',t:'Fais rouler un tram',d:'Transports → Rails de tram sur une route, puis un arrêt de tram contre les rails.',r:1500,go:{c:'transports',k:'x:tram:'},ok:()=>!!(E&&E.trams&&E.trams.list.length)},
  {id:'school',t:'Construis une école',d:'Les bus scolaires passent le matin, et la cour s’anime à la récré.',r:600,go:{c:'services',k:'place:school'},ok:()=>svcCount('school')>0},
  {id:'save',t:'Fais une sauvegarde',d:'Bouton disquette, ou Ctrl+S.',r:400,go:{p:'saves'},ok:()=>{try{return(JSON.parse(localStorage.getItem('kcu_city_saves')||'[]')||[]).some(x=>!x.auto);}catch(e){return false;}}},
  {id:'airport',t:'Ouvre l’aéroport',d:'Économie → Aéroport (palier Ville).',r:3000,go:{c:'economie',k:'place:aeroport'},ok:()=>svcCount('aeroport')>0}
];
function v6Quest(id){
  if(!S||VISIT)return;if(!S.v6q)S.v6q={};if(S.v6q[id])return;const q=V6Q.find(x=>x.id===id);if(!q)return;
  S.v6q[id]=S.day||1;S.money+=q.r;floatMoney(q.r);toast(`<b>Quête réussie</b> : ${esc(q.t)} · +${money(q.r)}`,'auto_stories',{label:'Carnet',fn:()=>openPanel('quests')});sndPlay('ding');save();
}
function v6QuestCheck(){for(const q of V6Q)if(q.ok&&!(S.v6q&&S.v6q[q.id])){let ok=false;try{ok=q.ok();}catch(e){}if(ok){v6Quest(q.id);return;}}}   // une à la fois
const TUTO_GO=[{c:'roads',k:'road:1'},{c:'zones',k:'zone:1'},{c:'energie',k:'place:wind'},{c:'energie',k:'place:wtower'},{c:'zones',k:'zone:2'},{c:'zones',k:'zone:1'}];
const MIS_GO=[{c:'services',k:'place:school'},{p:'quiz'},{c:'zones',k:'zone:1'},{c:'services',k:'place:mairie'},{c:'roads',k:'road:3'},{c:'parcs'},{c:'services'},{c:'transports',k:'place:bus'},{c:'zones'},{c:'loisirs'},{p:'quiz'},{c:'services'},{c:'zones'},{c:'monuments'},{c:'zones'}];
function questGo(g){
  if(!g)return;closePanel();
  if(g.p){openPanel(g.p);return;}
  if(g.c&&CATS.some(c=>c.id===g.c)){TRAY=null;pickCat(g.c);if(g.k&&trayItems(g.c).some(it=>it.k===g.k||(it.opts&&it.opts.some(o=>o.k===g.k))))pickItem(g.k);refreshToolbar();
    setTimeout(()=>{const el=ROOT&&ROOT.querySelector(g.k?`.cty-item[data-k="${g.k}"]`:`.cty-tool[data-c="${g.c}"]`);if(el){el.classList.add('cty-pulse');setTimeout(()=>el.classList.remove('cty-pulse'),4200);}},60);}
}
function panelQuests(){
  const tut=S.tut|0,mis=S.mis|0,Q=S.v6q||{},nd=V6Q.filter(q=>Q[q.id]).length;
  const row=(st,t,d,r,go)=>`<div class="cty-quest ${st}"><span class="ms">${st==='done'?'check_circle':st==='cur'?'radio_button_checked':'radio_button_unchecked'}</span><div><b>${esc(t)}</b>${d?`<small>${esc(d)}</small>`:''}</div>${r?`<em>${esc(r)}</em>`:''}${go&&st!=='done'?`<button class="cty-btn ghost" data-act="qgo" data-k="${esc(JSON.stringify(go))}"><span class="ms">near_me</span>Montre-moi</button>`:''}</div>`;
  let h=head('auto_stories','Carnet de quêtes',`Découverte ${nd} / ${V6Q.length} · Défis ${Math.min(mis,MISSIONS.length)} / ${MISSIONS.length}`,'#c9a227');
  if(tut<TUTO.length)h+=`<div class="cty-sec">Pour bien démarrer</div>`+TUTO.map((q,k)=>row(k<tut?'done':k===tut?'cur':'',q.t,k===tut?q.hint:'','+500 §',TUTO_GO[k])).join('');
  h+=`<div class="cty-sec">Quêtes de découverte (dans l’ordre que tu veux)</div>`+V6Q.map(q=>row(Q[q.id]?'done':'cur',q.t,Q[q.id]?'':q.d,'+'+money(q.r),q.go)).join('');
  h+=`<div class="cty-sec">Défis du maire</div>`+MISSIONS.map((m,k)=>row(k<mis?'done':k===mis&&tut>=TUTO.length?'cur':'',m.t,k===mis?m.hint:'','+'+money(m.r),k===mis?MIS_GO[k]:null)).join('');
  return h;
}

// ── Branchements v6 ──
function v6LoadFix(){
  if(S.set.amb==null)S.set.amb=true;if(S.set.skyH===undefined)S.set.skyH=null;
  if(!S.v6q||typeof S.v6q!=='object')S.v6q={};if(S.sos&&typeof S.sos!=='object')S.sos=null;
}
function v6Frame(dt,run){
  if(!E.v6)v6Make();
  // horloge de la vie de la ville (continue même quand le ciel est figé à l'heure préférée)
  const h=hourNow();if(h<(E.v6.lastH??h))E.vday=(E.vday|0)+1;E.v6.lastH=h;
  if(E.skyLook&&!E.tw&&CAM.pitch>.34)E.skyLook=false;   // fin de « Regarder le ciel » dès qu'on relève la caméra
  stepMist(dt);stepSnowmen();v6People(dt,run);stepEV(dt,run);v6Airport(dt);rlFrame(dt,run);
  if(E.t-(E.v6.slowT||0)>2){E.v6.slowT=E.t;E.v6.laneDirty=true;if(!VISIT){v6AmbTick();v6SchoolBuses();rlTick();if(S.sos&&!sosActive()){S.sos=null;SOSQ=null;if(PANEL==='sos')renderPanel();}}}
  if(E.t-(E.v6.qT||0)>5){E.v6.qT=E.t;if(!VISIT){v6QuestCheck();gzTick();}}
}
function v6Banners(){
  if(!S.sos)return '';const D_=SOS_N[S.sos.k];
  return `<div class="cty-bn sos"><span class="ms">${D_[1]}</span><span><b>${D_[0]} !</b> Réponds juste à 3 questions pour ${D_[2]} · ${S.sos.n|0} / 3</span><button data-act="panel" data-p="sos">Aider</button></div>`;
}
function v6InspectSvc(s){
  let h='';
  if(s.t==='anato'){const n=ANAT.filter(a=>S.ana&&S.ana[a.k]).length;h+=rows([['skeleton','Parties explorées',`${n} / ${ANAT.length}`]])+`<button class="cty-btn" data-act="panel" data-p="anato"><span class="ms">skeleton</span>Explorer le squelette</button>`;}
  if(s.t==='aeroport')h+=airportBoard();
  if(s.t==='tramstop'||s.t==='metro'||s.t==='bus'||s.t==='gare')h+=rows([['commute','Voitures en moins dans la ville',`≈ ${fmt(carsSaved())}`]]);
  if(s.t==='school')h+=`<p class="cty-p small">Bus scolaires vers 7 h et 16 h 30 · récré à 10 h, à midi et à 15 h.</p>`;
  return h;
}
function v6Click(a,el,e){
  const k=el.dataset.k;
  if(a==='skyh'){skyPick(k);return true;}
  if(a==='sosa'){sosAnswer(+el.dataset.j);return true;}
  if(a==='sosnext'){SOSQ=null;renderPanel();return true;}
  if(a==='anaz'){anaAsk(k);return true;}
  if(a==='ana'){anaAnswer(+el.dataset.j);return true;}
  if(a==='anaback'){ANQ=null;renderPanel();return true;}
  if(a==='curs'){CURVS.s=k;renderPanel();return true;}
  if(a==='curp'){CURVS.p=k;renderPanel();return true;}
  if(a==='qgo'){let g=null;try{g=JSON.parse(k);}catch(err){}questGo(g);return true;}
  return false;
}
function v6PanelOpened(p){if(p==='journal')v6Quest('gazette');if(p==='curves')v6Quest('curves');if(p==='anato')ANQ=null;if(p==='sos'){SOSWON=null;if(SOSQ&&SOSQ.ans!=null)SOSQ=null;}}

// ── Relief naturel (couche mtn, 1 à 9) : maillage continu, couleurs selon l'altitude et la pente ──
const MTN_H=.48,MTN_COST=120,MG=2*N+1;let MH=null;   // MH : hauteurs sur une grille d'une demi-case
function mtnCornerH(cx,cz){let s=0;for(let dz=-1;dz<=0;dz++)for(let dx=-1;dx<=0;dx++){const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=N||z>=N)return 0;const v=mtn[z*N+x];if(!v)return 0;s+=v;}return s/4*MTN_H;}
function computeMH(){
  const W=N+1,C=new Float32Array(W*W);let any=false;
  for(let i=0;i<NN;i++)if(mtn[i]){any=true;break;}
  if(!any){MH=null;return;}
  for(let cz=0;cz<=N;cz++)for(let cx=0;cx<=N;cx++)C[cz*W+cx]=mtnCornerH(cx,cz);
  const c=(X,Z)=>C[Math.min(N,Z)*W+Math.min(N,X)],B=BIO(),nz=NZ||makeNoise(7);
  MH=new Float32Array(MG*MG);
  for(let gz=0;gz<MG;gz++)for(let gx=0;gx<MG;gx++){
    const x0=gx>>1,z0=gz>>1,fx=gx&1,fz=gz&1;let h;
    if(!fx&&!fz)h=c(x0,z0);
    else if(fx&&!fz)h=(c(x0,z0)+c(x0+1,z0))/2;
    else if(!fx&&fz)h=(c(x0,z0)+c(x0,z0+1))/2;
    else{h=(c(x0,z0)+c(x0+1,z0)+c(x0,z0+1)+c(x0+1,z0+1))/4;const t=x0<N&&z0<N?mtn[z0*N+x0]:0;if(t)h=Math.max(h,t*MTN_H*.45);}   // une case seule forme un petit pic
    if(h>0&&!B.mesa)h*=1+(fbm(nz,gx*.37+11,gz*.37+7)-.5)*.5;
    MH[gz*MG+gx]=h;
  }
  // 13 nov. 2026 : routes sur le relief — hauteur lissée le long du réseau (rampe régulière), le terrain se taille autour
  const RT=[];for(let i=0;i<NN;i++)if(road[i]&&mtn[i])RT.push(i);
  if(RT.length){
    const hr=new Float32Array(NN);for(const i of RT){const x=i%N,z=(i/N)|0;hr[i]=MH[(2*z+1)*MG+2*x+1];}
    for(let it=0;it<30;it++)for(const i of RT){let s_=hr[i]*2,n_=2;for(let d=0;d<8;d++){const j=roadNb(i,d);if(j>=0){s_+=mtn[j]?hr[j]:0;n_++;}}hr[i]=s_/n_;}
    for(const i of RT){const x=i%N,z=(i/N)|0;
      for(let sz=0;sz<=2;sz++)for(let sx=0;sx<=2;sx++){let s_=0,n_=0;
        for(let tz=sz===0?z-1:z;tz<=(sz===2?z+1:z);tz++)for(let tx=sx===0?x-1:x;tx<=(sx===2?x+1:x);tx++){
          if(tx<0||tz<0||tx>=N||tz>=N)continue;const j=tz*N+tx;if(!road[j])continue;s_+=mtn[j]?hr[j]:0;n_++;}
        if(n_)MH[(2*z+sz)*MG+2*x+sx]=s_/n_;}}
  }
}
function mtnH(x,z){if(!MH)return 0;const gx=clamp(x*2,0,MG-1.001),gz=clamp(z*2,0,MG-1.001),x0=gx|0,z0=gz|0,fx=gx-x0,fz=gz-z0,h=(a,b)=>MH[b*MG+a];
  return lerp(lerp(h(x0,z0),h(x0+1,z0),fx),lerp(h(x0,z0+1),h(x0+1,z0+1),fx),fz);}
function mtnCol(ha,ny,r,B){
  if(!B.rock)B=Object.assign({},B,{rock:['#8d8a85','#9a968f','#7f7b75']});   /* paysage sans palette de roche (vallée verte) */
  if(B.mesa){if(ny>.93&&ha>.3)return r<.5?'#d9a066':'#d29a5f';return['#c8693c','#dc8b55','#b45b35'][(Math.floor(ha/.3+r*.4))%3];}   // strates rouges
  const gr=`rgb(${Math.round(B.g[0]*.8)},${Math.round(B.g[1]*.82)},${Math.round(B.g[2]*.75)})`,gr2=`rgb(${Math.round(B.g[0]*.68)},${Math.round(B.g[1]*.72)},${Math.round(B.g[2]*.66)})`;
  if(B.volcano){if(ha>MTN_H*6.3)return ny>.8?'#4a3f3c':'#5b4a45';if(ha<MTN_H*3.4&&ny>.5)return r<.5?gr:gr2;return B.rock[(r*B.rock.length)|0];}
  if(B.snowcap&&ha>MTN_H*5.9-r*.35)return ny>.45?(r<.5?'#f3f6f9':'#e8eef4'):'#c9cfd6';
  if(B.mix==='lacs')return ny>.85&&r<.4?gr2:B.rock[(r*B.rock.length)|0];
  if(ha<MTN_H*1.8&&ny>.6)return r<.5?gr:gr2;
  if(ny>.82&&ha<MTN_H*3.6)return gr2;
  return B.rock[(r*B.rock.length)|0];
}
function rebuildMountains(){
  if(!E)return;
  if(E.mtnMesh){E.gD.remove(E.mtnMesh);E.mtnMesh.geometry.dispose();E.mtnMesh=null;}
  if(E.mtnRoad){E.gD.remove(E.mtnRoad);E.mtnRoad.geometry.dispose();E.mtnRoad=null;}
  computeMH();if(!MH)return;
  const pos=[],col=[],B=BIO(),cc=new THREE.Color(),H=(a,b)=>MH[b*MG+a]+.004;
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){
    if(!mtn[z*N+x])continue;
    for(let sz=0;sz<2;sz++)for(let sx=0;sx<2;sx++){
      const gx=x*2+sx,gz=z*2+sz,p=[[gx,gz],[gx+1,gz],[gx+1,gz+1],[gx,gz+1]].map(([a,b])=>[a/2,H(a,b),b/2]);
      const tris=((gx+gz)&1)?[[0,3,2],[0,2,1]]:[[0,3,1],[1,3,2]];
      for(let t=0;t<2;t++){const[A,Bv,Cv]=tris[t].map(k=>p[k]);if(A[1]<.01&&Bv[1]<.01&&Cv[1]<.01)continue;
        const ux=Bv[0]-A[0],uy=Bv[1]-A[1],uz=Bv[2]-A[2],vx=Cv[0]-A[0],vy=Cv[1]-A[1],vz=Cv[2]-A[2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nzz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nzz)||1;
        cc.set(mtnCol((A[1]+Bv[1]+Cv[1])/3,ny/l,hash(gx*131+gz*71+t*17),B));
        pos.push(...A,...Bv,...Cv);for(let k=0;k<3;k++)col.push(cc.r,cc.g,cc.b);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  if(!E.mtnMat){E.mtnMat=new THREE.MeshLambertMaterial({vertexColors:true});snowify(E.mtnMat,false);}
  const m=new THREE.Mesh(g,E.mtnMat);m.castShadow=m.receiveShadow=true;E.gD.add(m);E.mtnMesh=m;
  // 13 nov. 2026 : chaussée des routes de montagne, posée sur la pente (trottoir côté sans route, pointillés sur les lignes droites)
  const rp=[],rc=[],cA=new THREE.Color('#5d646c'),cS=new THREE.Color('#d3d6d8'),cL=new THREE.Color('#f3f1e7');
  const strip=(x0,z0,x1,z1,col,lift,nx,nz)=>{for(let a=0;a<nx;a++)for(let b=0;b<nz;b++){
      const X0=x0+(x1-x0)*a/nx,X1=x0+(x1-x0)*(a+1)/nx,Z0=z0+(z1-z0)*b/nz,Z1=z0+(z1-z0)*(b+1)/nz,Y=(x,z)=>mtnH(x,z)+lift;
      const A=[X0,Y(X0,Z0),Z0],Bq=[X1,Y(X1,Z0),Z0],Cq=[X1,Y(X1,Z1),Z1],Dq=[X0,Y(X0,Z1),Z1];rp.push(...A,...Dq,...Cq,...A,...Cq,...Bq);for(let k=0;k<6;k++)rc.push(col.r,col.g,col.b);}};
  for(let i=0;i<NN;i++){if(!road[i]||!mtn[i])continue;const x=i%N,z=(i/N)|0,mk=roadMask(x,z),w=5/32;
    strip(x,z,x+1,z+1,cA,.016,4,4);
    if(!(mk&1))strip(x,z,x+1,z+w,cS,.024,4,1);if(!(mk&4))strip(x,z+1-w,x+1,z+1,cS,.024,4,1);
    if(!(mk&8))strip(x,z,x+w,z+1,cS,.024,1,4);if(!(mk&2))strip(x+1-w,z,x+1,z+1,cS,.024,1,4);
    if(mk===5)for(const q of[.1,.6])strip(x+.48,z+q,x+.52,z+q+.25,cL,.022,1,2);
    if(mk===10)for(const q of[.1,.6])strip(x+q,z+.48,x+q+.25,z+.52,cL,.022,2,1);}
  if(rp.length){const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));rg.setAttribute('color',new THREE.Float32BufferAttribute(rc,3));rg.computeVertexNormals();
    const rm=new THREE.Mesh(rg,E.mat.plain);rm.receiveShadow=true;E.gD.add(rm);E.mtnRoad=rm;}
}
function rebuildSlab(){if(!E)return;if(E.slab){E.gD.remove(E.slab);E.slab.geometry.dispose();E.slab=null;}makeSlab();}
function v4Rebuild(){
  if(E.slabK!==(S.biome||'')+'|'+S.seed)rebuildSlab();
  rebuildMountains();recomputeSignals();rebuildOvp();if(!E.patFig)makePatFig();
  showClear();if(S.show)showBuild();E.seaK=null;if(E.fauna){E.fauna.walk=[];E.fauna.cats=[];E.fauna.birdC=[];}if(E.v6)v6Reset();E.patFig.key='?';
}

// ── Feux tricolores : posés tout seuls aux grands carrefours (+ ceux posés à la main), les voitures s'arrêtent au rouge ──
const SIG=new Uint8Array(NN),SIG_POLES=[[-.42,-.42],[.42,-.42],[.42,.42],[-.42,.42]];   // poteaux 0 et 2 : axe nord-sud, 1 et 3 : est-ouest
function recomputeSignals(){
  const old=SIG.slice(),auto=!S||S.set.tl!==false;SIG.fill(0);
  for(let i=0;i<NN;i++){
    if(!(road[i]===1||road[i]===3)||ter[i]||rx[i]===2)continue;
    if(rx[i]===1){SIG[i]=1;continue;}
    if(!auto)continue;
    let deg=0,ave=road[i]===3,nb=false;
    for(let d=0;d<4;d++){const j=roadNb(i,d);if(j<0)continue;deg++;if(road[j]===3)ave=true;if(j<i&&SIG[j])nb=true;}
    if(deg<3||(nb&&!ave))continue;   // pas deux carrefours à feux collés dans les petites rues
    if(ave||(deg===4&&hash(i*7919+13)<.6))SIG[i]=1;   // avenues : toujours ; carrefours à 4 rues : un peu plus d'un sur deux
  }
  if(!E)return;
  let ch=!E.sigMesh;for(let i=0;i<NN;i++)if(SIG[i]!==old[i]){ch=true;markB(i);markG(i);}
  if(ch)buildSignalBulbs();
}
function buildSignalBulbs(){
  const L=[];for(let i=0;i<NN;i++)if(SIG[i])L.push(i);E.sigList=L;
  const n=L.length*4;
  if(!E.sigMesh||E.sigMesh.userData.cap<n){
    if(E.sigMesh){E.gC.remove(E.sigMesh);E.sigMesh.dispose();}
    const cap=Math.max(64,Math.ceil(n*1.4));
    E.sigMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.024,.024,.024),new THREE.MeshBasicMaterial({color:'#ffffff'}),cap);
    E.sigMesh.userData.cap=cap;E.sigMesh.frustumCulled=false;E.sigMesh.setColorAt(0,new THREE.Color('#ff4d4d'));E.gC.add(E.sigMesh);
  }
  const m=new THREE.Matrix4();let k=0;
  E.sigPose=new Float32Array(L.length*8);
  for(const i of L){const x=i%N+.5,z=((i/N)|0)+.5;for(let p=0;p<4;p++){const [sx,sz]=SIG_POLES[p],A=SIG_ARM[p],F=SIG_FACE[p],px=x+sx+A[0]*.2+F[0]*.023,pz=z+sz+A[1]*.2+F[1]*.023;
    E.sigPose[k*2]=px;E.sigPose[k*2+1]=pz;m.makeTranslation(px,SIG_Y[0],pz);E.sigMesh.setMatrixAt(k++,m);}}
  E.sigMesh.count=k;E.sigMesh.instanceMatrix.needsUpdate=true;E.sigCol=new Int8Array(k).fill(-1);
}
// cycle de 8 s (temps du jeu) : vert 3,4 s, orange 0,6 s pour chaque axe ; décalé d'un carrefour à l'autre
function sigState(i,axis){const t=((E.sigT||0)+hash(i*31+5)*8)%8;return axis===0?(t<3.4?0:t<4?1:2):(t<4?2:t<7.4?0:1);}
const SIG_COLS=['#3ddc84','#ffb020','#ff4d4d'];
function stepSignals(run){
  if(!E.sigMesh||!E.sigList)return;E.sigT=(E.sigT||0)+run;
  const C=E._sigC||(E._sigC=SIG_COLS.map(h=>new THREE.Color(h)));let k=0,ch=false;
  const M=E._sigM||(E._sigM=new THREE.Matrix4());
  for(const i of E.sigList){const a=sigState(i,0),b=sigState(i,1);for(let p=0;p<4;p++){const s=p&1?b:a;if(E.sigCol[k]!==s){E.sigCol[k]=s;E.sigMesh.setColorAt(k,C[s]);if(E.sigPose){M.makeTranslation(E.sigPose[k*2],SIG_Y[s],E.sigPose[k*2+1]);E.sigMesh.setMatrixAt(k,M);}ch=true;}k++;}}
  if(ch){if(E.sigMesh.instanceColor)E.sigMesh.instanceColor.needsUpdate=true;E.sigMesh.instanceMatrix.needsUpdate=true;}   /* vert en bas, orange au milieu, rouge en haut */
}

// ── Voitures : autant que d'habitants qui se déplacent (≈ 1 voiture visible pour 16 habitants le jour), moins la nuit ──
function carTarget(){
  if(!ST.pop||!E)return 0;
  const pt=Math.min(.38,svcCount('bus')*.02+svcCount('metro')*.05+svcCount('gare')*.06+svcCount('tramstop')*.02+bikeShare());   // v6 : + vélos   // transports en commun
  const t=ST.pop*.062*rushK()*(1-pt)+(ST.tour||0)*.12;   // v5 : heures de pointe
  return Math.max(ST.pop>=10?1:0,Math.min(220,Math.round(t),Math.round(E.roadList.length*.5)));
}

// ── Métier du joueur ──
const PROF={
  kine:{n:'Kiné',full:'Kinésithérapeute',ic:'accessibility_new',d:'Cabinets de kiné et patients en rééducation : dos, entorses, prothèses…',pros:'kinés',studies:'kiné',
    bld:'Cabinet de kiné',une:'un cabinet de kiné',bldD:'Soigne le quartier : plus de bonheur et de valeur foncière.',bldIc:'accessibility_new',
    statue:'Statue du Kiné d’or',statueD:'Hommage aux kinés de la ville.',fac:'Faculté de kiné',facD:'Forme les kinés de demain : éducation sur un grand rayon.',
    centre:'Centre de rééducation',centreD:'Balnéo et plateau technique : santé et bonheur.',centreIc:'self_improvement',
    pol:'Kiné remboursé',polD:'La santé compte presque double dans le bonheur. Les kinés approuvent.',
    tip:'Tes habitants ont mal au dos : construis un cabinet de kiné !',noCab:'« J’ai mal au dos et il n’y a aucun cabinet de kiné près de chez moi. »',many:'« Avec tous ces kinés, plus personne n’a mal au dos dans la rue. »',
    thNo:'Si seulement il y avait un kiné près de chez moi.',thYes:'Mon kiné m’a appris des exercices pour le dos.',
    city:'Kinéville',pat:'patient',pats:'patients',patIc:'personal_injury',side:'Patients',cab:'Cabinet du maire',wait:'Un patient t’attend',healed:'Patient guéri !',healedN:'Patients guéris',
    intro:'Des habitants viennent te consulter de temps en temps avec un cas clinique. Choisis le bon bilan ou le bon traitement pour les guérir : la ville gagne du bonheur et des §.',
    help:'des habitants viennent consulter avec un cas clinique de kiné',
    marathon:['Marathon des kinés','L’école de kiné organise un marathon solidaire dans tes rues.','Échauffements, étirements… et une ville en pleine forme !'],
    startup:'De jeunes kinés veulent lancer une application de rééducation.',congres:['Congrès national de kiné','Des milliers de kinés découvrent ta ville.'],
    crises:[['Épidémie de grippe','coronavirus'],['Vague de gastro-entérite','sick'],['Épidémie de mal de dos','accessibility_new'],['Épidémie de bronchiolite','pulmonology'],['Vague d’entorses de cheville','directions_run']],
    ach:['Kiné de quartier','Kiné de référence'],achV:'Guéris'},
  veto:{n:'Véto',full:'Vétérinaire',ic:'pets',d:'Cliniques vétérinaires : chiens, chats et lapins viennent se faire soigner.',pros:'vétos',studies:'école véto',
    bld:'Clinique vétérinaire',une:'une clinique vétérinaire',bldD:'Soigne les animaux du quartier : des habitants plus heureux.',bldIc:'pets',
    statue:'Statue du Véto d’or',statueD:'Hommage aux vétérinaires de la ville.',fac:'École vétérinaire',facD:'Forme les vétos de demain : éducation sur un grand rayon.',
    centre:'Centre hospitalier vétérinaire',centreD:'Urgences, chirurgie et imagerie pour tous les animaux.',centreIc:'emergency',
    pol:'Soins vétérinaires aidés',polD:'La santé des animaux compte presque double dans le bonheur des habitants.',
    tip:'Les animaux de tes habitants ont besoin de soins : construis une clinique vétérinaire !',noCab:'« Mon chien boite et il n’y a aucune clinique vétérinaire près de chez moi. »',many:'« Avec toutes ces cliniques, les chiens du quartier sont en pleine forme. »',
    thNo:'Si seulement il y avait un véto près de chez moi pour mon chat.',thYes:'Mon véto a vacciné mon chiot hier.',
    city:'Vétoville',pat:'animal',pats:'animaux',patIc:'pets',side:'Animaux',cab:'Clinique du maire',wait:'Un animal t’attend',healed:'Animal soigné !',healedN:'Animaux soignés',
    intro:'Des habitants t’amènent leur chien, leur chat ou leur lapin avec un cas clinique. Choisis le bon diagnostic ou le bon traitement : la ville gagne du bonheur et des §.',
    help:'des habitants t’amènent leur animal avec un cas clinique vétérinaire',
    marathon:['Course canine','L’école vétérinaire organise une course solidaire avec les chiens du quartier.','Des centaines de chiens et leurs maîtres courent dans tes rues !'],
    startup:'De jeunes vétos veulent lancer une application de téléconsultation pour animaux.',congres:['Congrès national vétérinaire','Des milliers de vétérinaires découvrent ta ville.'],
    crises:[['Épidémie de gastro chez les chiens','sick'],['Invasion de puces','pest_control'],['Vague de tiques','bug_report'],['Épidémie de toux du chenil','pets'],['Épidémie de coryza chez les chats','coronavirus']],
    ach:['Véto de quartier','Véto de référence'],achV:'Soigne'},
  med:{n:'Médecin',full:'Médecin',ic:'stethoscope',d:'Cabinets médicaux : fièvre, angines, douleurs, urgences et prévention.',pros:'médecins',studies:'médecine',
    bld:'Cabinet médical',une:'un cabinet médical',bldD:'Un médecin traitant pour le quartier : plus de bonheur et de valeur foncière.',bldIc:'stethoscope',
    statue:'Statue d’Hippocrate',statueD:'Hommage aux médecins de la ville.',fac:'Faculté de médecine',facD:'Forme les médecins de demain : éducation sur un grand rayon.',
    centre:'Pôle de santé',centreD:'Consultations, imagerie et prévention : santé et bonheur.',centreIc:'medical_services',
    pol:'Consultation remboursée',polD:'La santé compte presque double dans le bonheur. Les médecins approuvent.',
    tip:'Tes habitants n’ont pas de médecin traitant : construis un cabinet médical !',noCab:'« Je n’ai pas de médecin traitant près de chez moi. »',many:'« Avec tous ces médecins, plus besoin d’attendre trois semaines pour un rendez-vous. »',
    thNo:'Si seulement il y avait un médecin près de chez moi.',thYes:'Mon médecin m’a enfin trouvé un créneau.',
    city:'Médiville',pat:'patient',pats:'patients',patIc:'stethoscope',side:'Patients',cab:'Cabinet du maire',wait:'Un patient t’attend',healed:'Patient soigné !',healedN:'Patients soignés',
    intro:'Des habitants viennent te consulter de temps en temps avec un cas clinique. Choisis le bon diagnostic ou la bonne conduite à tenir : la ville gagne du bonheur et des §.',
    help:'des habitants viennent consulter avec un cas de médecine générale',
    marathon:['Course du cœur','La faculté de médecine organise une course pour la prévention cardiovasculaire.','Dépistages, conseils… et une ville en pleine forme !'],
    startup:'De jeunes médecins veulent lancer une application de télémédecine.',congres:['Congrès national de médecine générale','Des milliers de médecins découvrent ta ville.'],
    crises:[['Épidémie de grippe','coronavirus'],['Vague de gastro-entérite','sick'],['Épidémie de varicelle','sick'],['Épidémie de bronchiolite','pulmonology'],['Vague d’allergies au pollen','local_florist']],
    ach:['Médecin de quartier','Médecin de référence'],achV:'Soigne'},
  dent:{n:'Dentiste',full:'Chirurgien-dentiste',ic:'dentistry',d:'Cabinets dentaires : rages de dents, caries, gencives et appareils.',pros:'dentistes',studies:'dentaire',
    bld:'Cabinet dentaire',une:'un cabinet dentaire',bldD:'Des sourires éclatants dans tout le quartier : bonheur et valeur foncière.',bldIc:'dentistry',
    statue:'Statue de la Dent d’or',statueD:'Hommage aux dentistes de la ville.',fac:'Faculté d’odontologie',facD:'Forme les dentistes de demain : éducation sur un grand rayon.',
    centre:'Centre dentaire',centreD:'Soins, orthodontie et prévention bucco-dentaire pour toute la ville.',centreIc:'dentistry',
    pol:'Dentiste remboursé',polD:'La santé compte presque double dans le bonheur. Les dentistes approuvent.',
    tip:'Tes habitants ont mal aux dents : construis un cabinet dentaire !',noCab:'« J’ai une rage de dents et aucun dentiste près de chez moi. »',many:'« Avec tous ces dentistes, tout le monde a le sourire en ville. »',
    thNo:'Si seulement il y avait un dentiste près de chez moi.',thYes:'Mon dentiste m’a fait un détartrage, je souris à nouveau.',
    city:'Sourireville',pat:'patient',pats:'patients',patIc:'dentistry',side:'Patients',cab:'Cabinet du maire',wait:'Un patient t’attend',healed:'Patient soigné !',healedN:'Patients soignés',
    intro:'Des habitants viennent te consulter de temps en temps avec un cas clinique. Choisis le bon diagnostic ou le bon soin : la ville gagne du bonheur et des §.',
    help:'des habitants viennent consulter avec un cas clinique dentaire',
    marathon:['Course du sourire','La faculté dentaire organise une course solidaire pour la prévention bucco-dentaire.','Brosses à dents offertes… et une ville tout sourire !'],
    startup:'De jeunes dentistes veulent lancer une application pour apprendre aux enfants à se brosser les dents.',congres:['Congrès national de chirurgie dentaire','Des milliers de dentistes découvrent ta ville.'],
    crises:[['Vague de caries','dentistry'],['Épidémie de rages de dents','sentiment_very_dissatisfied'],['Vague de gingivites','dentistry'],['Caries d’après les fêtes','cake'],['Épidémie d’aphtes','sick']],
    ach:['Dentiste de quartier','Dentiste de référence'],achV:'Soigne'}
};
function P_(){return PROF[S&&S.prof]||PROF.kine;}
// Noms, textes et cas cliniques selon le métier (appelé au chargement et quand on change de métier)
function applyProf(){
  const p=P_();
  Object.assign(BT.kine,{name:p.bld,desc:p.bldD,icon:p.bldIc});
  Object.assign(BT.statue,{name:p.statue,desc:p.statueD});
  Object.assign(BT.fac,{name:p.fac,desc:p.facD});
  Object.assign(BT.reeduc,{name:p.centre,desc:p.centreD,icon:p.centreIc});
  BT.gym.desc=`Renforcement musculaire : les ${p.pros} recommandent.`;
  const po=POLICIES.find(x=>x.id==='kine');if(po)Object.assign(po,{name:p.pol,desc:p.polD,icon:p.bldIc});
  const ev=id=>EVENTS.find(e=>e.id===id)||{a:{}};
  const ma=ev('marathon');ma.t=p.marathon[0];ma.d=p.marathon[1];ma.a.r=p.marathon[2];
  ev('startup').d=p.startup;const co=ev('congres');co.t=p.congres[0];co.a.r=p.congres[1];
  CRISES.length=0;CRISES.push(...p.crises);
  READERS[4]=`Une étudiante en ${p.studies}`;
  const a5=ACH.find(a=>a.id==='pat5'),a25=ACH.find(a=>a.id==='pat25'),w=p.pats;
  if(a5){a5.n=p.ach[0];a5.d=`${p.achV} 5 ${w}`;}if(a25){a25.n=p.ach[1];a25.d=`${p.achV} 25 ${w}`;}
}
function patCases(){const p=S&&S.prof;return p==='veto'?PAT_VETO:p==='med'?PAT_MED:p==='dent'?PAT_DENT:PATIENTS;}
function setProf(k){
  if(!PROF[k]||VISIT)return;
  const was=S.prof;S.prof=k;applyProf();
  if(was!==k){S.pat=null;S.patSeen=[];PATRES=null;S.patNext=S.day+6;S.patFU=null;S.patMiss=[];}
  const p=P_();
  if(S.day<240&&Object.values(PROF).some(q=>q.city===S.name)){S.name=p.city;if(E)drawSign();}   // nom par défaut d'une ville toute neuve
  if(E){for(const s of SV.values())if(s.t==='kine'||s.t==='statue'||s.t==='fac'||s.t==='reeduc')markB(s.z*N+s.x);
    const ic=E.icons&&E.icons.patient;if(ic){if(ic.material.map)ic.material.map.dispose();ic.material.map=iconTex('patient');ic.material.needsUpdate=true;}D.icons=true;}
  refreshTray();refreshToolbar();refreshHUD(true);extHUD(true);save();
}
function panelProf(){
  const cur=S.prof,B=BIO();
  return head('badge','Quel est ton métier ?','Ta ville s’adapte : cabinets, monuments, patients et cas cliniques','#0e8c87')
    +`<div class="cty-profs">${Object.entries(PROF).map(([k,p])=>`<button class="cty-prof${k===cur?' on':''}" data-act="prof" data-k="${k}"><span class="ms">${p.ic}</span><b>${p.full}</b><small>${p.d}</small></button>`).join('')}</div>`
    +`<div class="cty-biocur"><span class="ms">${B.ic}</span><div><b>Ton paysage : ${B.n}</b><small>${B.d}</small></div></div>`
    +`<p class="cty-p small">Tu pourras changer de métier et de paysage à tout moment dans les Réglages.</p>`;
}
function panelV4Settings(sw){
  const B=BIO(),t=clamp(S.set.tsp??2,0,TSP.length-1),cur=S.prof||'kine';
  let h=`<div class="cty-sec">Mon métier</div><div class="cty-pchips">${Object.entries(PROF).map(([k,p])=>`<button class="${k===cur?'on':''}" data-act="prof" data-k="${k}"><span class="ms">${p.ic}</span>${p.n}</button>`).join('')}</div>`
    +`<p class="cty-p small">Change les cabinets, les monuments et les cas cliniques des ${P_().pats}.</p>`;
  h+=`<div class="cty-sec">Rythme du temps</div><div class="cty-tsp">${TSP_N.map((n,k)=>`<button class="${k===t?'on':''}" data-act="tsp" data-k="${k}"><b>${n}</b><small>×${String(TSP[k]).replace('.',',')}</small></button>`).join('')}</div>`
    +`<p class="cty-p small">Les jours, les voitures, les bateaux, le jour et la nuit et la météo suivent ce rythme. Les boutons ▶ de la barre du haut l’accélèrent encore.</p>`;
  h+=sw('tl','Feux tricolores','Aux grands carrefours, les voitures s’arrêtent au rouge.');
  h+=`<div class="cty-sec">Paysage</div><div class="cty-biocur"><span class="ms">${B.ic}</span><div><b>${B.n}</b><small>${B.d}</small></div></div>`;
  const rec=`<button class="cty-btn ghost" data-act="recover"><span class="ms">history</span>Récupérer une ancienne ville…</button>`+(S.ghost?`<button class="cty-link" data-act="ghostclear">Effacer les repères violets des anciens bâtiments</button>`:'');
  if(BIO_PICK==null)return h+`<button class="cty-btn ghost" data-act="biopick" data-k=""><span class="ms">landscape</span>Changer de paysage…</button>`+rec;
  h+=`<div class="cty-bios">${BIOME_IDS.map(k=>{const b=BIOMES[k];return `<button class="${k===BIO_PICK?'on':''}" data-act="biopick" data-k="${k}"><span class="ms">${b.ic}</span><b>${b.n}</b>${k===(S.biome||'tempere')?'<small>actuel</small>':''}</button>`;}).join('')}</div>`;
  if(BIO_PICK)h+=`<p class="cty-p small">Une nouvelle carte « ${BIOMES[BIO_PICK].n} » remplace la tienne : routes, zones et bâtiments sont rasés et <b>tout ce que tu as payé t’est rendu</b> (${money(cityValue().v)}). Ton argent, ton palier, tes défis et tes succès sont gardés. On ne peut pas annuler.</p><button class="cty-btn danger" data-act="bioconf"><span class="ms">landscape</span>Nouvelle carte : ${BIOMES[BIO_PICK].n}</button>`;
  else h+=`<p class="cty-p small">Choisis un paysage.</p>`;
  return h+`<button class="cty-link" data-act="biopick" data-k="x">Annuler</button>`;
}
function v4Click(a,el,e){
  const k=el.dataset.k;
  if(spClick(a,el,e))return true;
  if(friendsClick(a,el))return true;
  if(v6Click(a,el,e))return true;
  if(a==='musk'){S.set.musk=k;S.set.mus=true;SND.musT=0;sndInit();sndResume();sndButton();save();renderPanel();return true;}
  if(a==='rew'){const n=+k;if(SV_ARM!=='r'+n){SV_ARM='r'+n;renderPanel();}else rewindTo(n);return true;}
  if(a==='exa'){examAnswer(+el.dataset.j);return true;}
  if(a==='examgo'){examStart();return true;}
  if(a==='examclose'){EXAM=null;renderPanel();return true;}
  if(a==='citgo'){const c=S.cits&&S.cits[+k];if(c)followStart(c.home,c);return true;}
  if(a==='showgo'){showGo();return true;}
  if(a==='tsp'){S.set.tsp=clamp(+k|0,0,TSP.length-1);save();renderPanel();refreshHUD(true);toast(`Rythme du temps : <b>${TSP_N[S.set.tsp]}</b>`,'schedule');return true;}
  if(a==='prof'){const first=PANEL==='prof';setProf(k);
    if(first){if(!S.helped){S.helped=true;save();openPanel('help');}else closePanel();toast(`Tu es <b>${P_().full.toLowerCase()}</b> : ta ville s’adapte !`,P_().ic);}
    else renderPanel();return true;}
  if(a==='biopick'){BIO_PICK=k==='x'?null:k;renderPanel();return true;}
  if(a==='bioconf'){if(BIO_PICK)newLandscape(BIO_PICK);return true;}
  if(savesClick(a,k))return true;
  if(a==='recover'){RECOV=null;RECOV_ARM=null;openPanel('recover');return true;}
  if(a==='recseg'){const n=+k;if(RECOV_ARM!==n){RECOV_ARM=n;renderPanel();}else recoverFromFrame(RECOV&&RECOV[n]);return true;}
  if(a==='recprev'){if(RECOV_ARM!=='p'){RECOV_ARM='p';renderPanel();}else restorePrev();return true;}
  if(a==='ghostclear'){S.ghost=null;redrawAllGround();save();if(PANEL)renderPanel();toast('Repères effacés.','layers_clear');return true;}
  return false;
}

// ── Patient qui attend devant sa maison : une personne (avec son animal pour le véto, avec son enfant pour un petit) ──
const PET_COL={chien:['#c58b4e','#3b3029','#e9dcc3','#8a5a30','#f2f2f2'],chat:['#d9894a','#6b6b6b','#f2f2f2','#2b2b2b','#c7b299'],lapin:['#f4f1ea','#b08a64','#8a8a8a','#f4f1ea','#d8c3a5']};
function makePatFig(){const g=new THREE.Group();g.visible=false;E.gC.add(g);E.patFig={g,pm:new THREE.MeshLambertMaterial({vertexColors:true}),key:''};}
function figMesh(fn){GB=new Map();TX.x=0;TX.z=0;TX.k=0;fn();const geo=toGeo(GB.get('plain'));GB=null;const m=new THREE.Mesh(geo,E.patFig.pm);m.castShadow=true;return m;}
function personMesh(shirt,hair){return figMesh(()=>{bc(-.012,0,.008,.008,0,.07,'#2e3a46');bc(.012,0,.008,.008,0,.07,'#2e3a46');bc(0,0,.026,.017,.07,.135,shirt);
  bc(-.034,0,.007,.007,.075,.135,'#f2c9a0');bc(.034,0,.007,.007,.075,.135,'#f2c9a0');ico(0,.162,0,.022,'#f2c9a0');bc(0,-.004,.022,.02,.176,.188,hair);});}
function petMesh(sp,col){
  const dk='#3a2a20';
  if(sp==='chat')return{body:figMesh(()=>{for(const[lx,lz]of[[-.025,-.009],[-.025,.009],[.022,-.009],[.022,.009]])bc(lx,lz,.005,.005,0,.03,col);
      bc(0,0,.034,.014,.028,.056,col);ico(.044,.068,0,.019,col);bc(.044,-.01,.004,.004,.08,.097,col);bc(.044,.01,.004,.004,.08,.097,col);bc(.062,0,.003,.003,.064,.07,'#f29fb0');}),
    tail:figMesh(()=>bc(0,0,.004,.004,0,.06,col)),at:[-.034,.05,0],wag:'cat'};
  if(sp==='lapin')return{body:figMesh(()=>{ico(0,.032,0,.032,col,.85);ico(.03,.058,0,.019,col);bc(.026,-.007,.004,.003,.07,.108,col);bc(.026,.007,.004,.003,.07,.108,col);
      bc(.026,-.007,.002,.0035,.075,.104,'#f2b8c6');bc(.026,.007,.002,.0035,.075,.104,'#f2b8c6');}),
    tail:figMesh(()=>ico(0,0,0,.011,'#ffffff')),at:[-.032,.035,0],wag:'bun'};
  return{body:figMesh(()=>{for(const[lx,lz]of[[-.032,-.012],[-.032,.012],[.03,-.012],[.03,.012]])bc(lx,lz,.007,.007,0,.042,col);
      bc(0,0,.046,.02,.04,.076,col);bc(.056,0,.021,.018,.062,.1,col);bc(.083,0,.012,.011,.066,.084,dk);bc(.05,-.015,.006,.005,.092,.114,dk);bc(.05,.015,.006,.005,.092,.114,dk);}),
    tail:figMesh(()=>bc(0,0,.005,.005,0,.038,col)),at:[-.046,.07,0],wag:'dog'};
}
function patFigSync(){
  const F=E.patFig;if(!F)return;
  const p=S&&S.pat,show=!!(p&&!VISIT&&lvl[p.i]);
  const key=show?`${p.i}|${p.name}|${p.pet?p.pet.sp:''}`:'';
  if(key===F.key){F.g.visible=show;return;}
  F.key=key;while(F.g.children.length){const c=F.g.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  F.tail=F.wag=F.pet=null;F.g.visible=show;if(!show)return;
  const r=rng(p.i*7+p.name.length),shirts=['#3b8fdc','#e63946','#2a9d8f','#f4a261','#8e5cd9','#e05a8a'],hairs=['#4a3426','#1f1a17','#c99a5b','#8a5a30'];
  const per=personMesh(pick(r,shirts),pick(r,hairs));per.scale.setScalar(1.5);per.position.set(-.07,0,0);F.g.add(per);
  if(p.pet){const cols=PET_COL[p.pet.sp]||PET_COL.chien,pm=petMesh(p.pet.sp,cols[(p.pet.col|0)%cols.length]),a=new THREE.Group();
    a.add(pm.body);pm.tail.position.set(pm.at[0],pm.at[1],pm.at[2]);pm.tail.rotation.z=pm.wag==='bun'?0:pm.wag==='cat'?.35:.75;a.add(pm.tail);
    a.scale.setScalar(1.6);a.position.set(.07,0,.03);a.rotation.y=-Math.PI/2;F.g.add(a);F.tail=pm.tail;F.wag=pm.wag;F.pet=a;}
  else if(p.baby){const kid=personMesh(pick(r,shirts),pick(r,hairs));kid.scale.setScalar(.95);kid.position.set(.06,0,.02);F.g.add(kid);}
  const x=p.i%N,z=(p.i/N)|0;let d=2;for(let k=0;k<4;k++){const X=x+DIRS[k][0],Z=z+DIRS[k][1];if(X>=0&&Z>=0&&X<N&&Z<N&&road[Z*N+X]){d=k;break;}}
  const fx=DIRS[d][0],fz=DIRS[d][1];F.g.position.set(x+.5+fx*.37,0,z+.5+fz*.37);F.g.rotation.y=Math.atan2(fx,fz);   // devant la maison, tourné vers la rue
}
function stepPatFig(){
  const F=E.patFig;if(!F)return;if(E.t-(F.chk||0)>.5){F.chk=E.t;patFigSync();}
  if(!F.g.visible||!F.tail)return;
  if(F.wag==='dog')F.tail.rotation.x=Math.sin(E.t*13)*.55;else if(F.wag==='cat')F.tail.rotation.x=Math.sin(E.t*1.6)*.35;
  else if(F.wag==='bun'&&F.pet)F.pet.position.y=Math.max(0,Math.sin(E.t*4.5))*.025;
}

// ── Cas cliniques par métier (la 1re réponse est la bonne, mélangées à l'affichage) ──
// Véto : sp = espèce (chien, chat, lapin), br = race imposée, sex = 'm' / 'f', mo = âge en mois
const ANI={
  chien:{M:['Rex','Max','Oscar','Rocky','Milo','Filou','Hugo','Ulysse','Gaston','Pilou'],F:['Lola','Nala','Ruby','Iris','Vanille','Moka','Bella','Praline','Cannelle','Perle'],
    br:['labrador','berger australien','golden retriever','beagle','teckel','border collie','jack russell','chien croisé']},
  chat:{M:['Simba','Tigrou','Félix','Pacha','Grisou','Nougat','Caramel','Oreo'],F:['Luna','Mimi','Chaussette','Noisette','Praline','Cléo','Minette','Plume'],br:['chat européen','maine coon','chartreux','chat croisé','siamois']},
  lapin:{M:['Panpan','Pompon','Caramel','Biscuit'],F:['Flocon','Noisette','Cookie','Biscotte'],br:['lapin nain','lapin bélier']}
};
const PAT_VETO=[
  {sp:'chien',age:[2,9],p:'a mangé une tablette entière de chocolat noir il y a une heure. Il pèse 8 kg et semble encore en forme.',q:'Que faire en priorité ?',
    a:['Consulter vite pour le faire vomir (ingestion récente)','Attendre de voir s’il a des symptômes demain','Lui donner du lait pour neutraliser le chocolat','Rien : le chocolat n’est pas toxique pour le chien'],ex:'La théobromine du chocolat (surtout noir) est toxique pour le chien : vomissements, agitation, troubles du rythme cardiaque. Si l’ingestion est récente, le vétérinaire fait vomir, puis charbon activé et surveillance.'},
  {sp:'chat',sex:'m',age:[3,9],p:'va et vient dans sa litière, pousse sans que rien ne sorte et miaule de douleur depuis ce matin.',q:'Que suspecter ?',
    a:['Une obstruction urétrale : c’est une urgence vitale','Une simple constipation, rien de grave','Il boude sa nouvelle litière','Un excès de croquettes'],ex:'Chez le chat mâle, un bouchon ou des calculs peuvent bloquer l’urètre : l’urine ne sort plus, le potassium monte et peut arrêter le cœur. Il faut lever l’obstacle en urgence (sondage).'},
  {sp:'chien',br:'dogue allemand',age:[3,8],p:'a avalé son repas d’un coup puis a couru. Il a le ventre gonflé et dur, il bave et essaie de vomir sans y arriver.',q:'Quelle urgence évoquer ?',
    a:['Un syndrome dilatation-torsion de l’estomac','Une indigestion sans gravité','Une gastrite de stress','Une simple aérophagie, à revoir demain'],ex:'Le SDTE touche surtout les grands chiens au thorax profond : ventre ballonné, efforts de vomissement improductifs, état de choc. C’est une urgence chirurgicale.'},
  {sp:'chien',mo:true,age:[2,4],p:'n’est pas vacciné. Il vomit, a une diarrhée avec du sang et ne mange plus.',q:'Quelle maladie virale suspecter ?',
    a:['La parvovirose','La rage','La leishmaniose','La maladie de Lyme'],ex:'La parvovirose touche surtout les chiots non vaccinés : gastro-entérite hémorragique grave, déshydratation. La vaccination la prévient.'},
  {sp:'chat',age:[1,12],p:'a mâchouillé les feuilles d’un bouquet de lys.',q:'Pourquoi est-ce une urgence ?',
    a:['Le lys provoque une insuffisance rénale aiguë chez le chat','Le lys irrite seulement les yeux','Ce n’est pas une urgence','Le lys donne juste une allergie passagère'],ex:'Toutes les parties du lys, même le pollen, sont très toxiques pour les reins du chat. Il faut consulter tout de suite : décontamination et perfusion.'},
  {sp:'chat',age:[2,12],p:'a de la fièvre. Sa maîtresse veut lui donner un comprimé de paracétamol.',q:'Que lui répondre ?',
    a:['Surtout pas : le paracétamol est très toxique pour le chat','Oui, un demi-comprimé suffit','Oui, mais avec un peu de nourriture','Oui, ce médicament est sans danger chez l’animal'],ex:'Le chat élimine très mal le paracétamol : atteinte du foie et des globules rouges (méthémoglobinémie), parfois mortelle. Jamais de médicament humain sans avis vétérinaire.'},
  {sp:'chien',age:[1,10],p:'a mangé un paquet de chewing-gums sans sucre.',q:'Quel est le risque principal ?',
    a:['Une hypoglycémie et une atteinte du foie, à cause du xylitol','Aucun : il n’y a pas de sucre','Seulement une mauvaise haleine','Une simple constipation'],ex:'Chez le chien, le xylitol déclenche une forte libération d’insuline : hypoglycémie rapide, parfois insuffisance hépatique. C’est une urgence.'},
  {sp:'lapin',age:[1,7],p:'ne mange plus depuis hier et ne fait plus de crottes.',q:'Pourquoi faut-il consulter sans attendre ?',
    a:['Un arrêt du transit chez le lapin peut devenir grave en quelques heures','Un lapin peut jeûner une semaine sans risque','C’est normal au printemps','Il suffit de lui donner des fruits sucrés'],ex:'La stase digestive du lapin est une urgence : douleur, déshydratation, troubles graves. Le foin à volonté (fibres) aide à la prévenir.'},
  {sp:'lapin',age:[2,8],p:'bave et a les dents qui poussent de travers.',q:'Quel aliment aide à user naturellement ses dents ?',
    a:['Du foin à volonté','Des granulés sucrés','Du pain dur','Des fruits secs'],ex:'Les dents du lapin poussent toute sa vie. Le foin, très fibreux, oblige à mâcher longtemps et use les dents ; une malocclusion doit être corrigée par le vétérinaire.'},
  {sp:'chien',age:[3,9],p:'vit dans le sud de la France. Il a maigri, perd ses poils autour des yeux et ses griffes poussent très vite.',q:'Quelle maladie transmise par un insecte, le phlébotome, évoquer ?',
    a:['La leishmaniose','La parvovirose','La toux du chenil','La teigne'],ex:'La leishmaniose canine est transmise par la piqûre du phlébotome, fréquent dans le Sud. Prévention : colliers ou pipettes répulsifs et vaccin.'},
  {sp:'chien',sex:'f',age:[7,12],p:'n’est pas stérilisée. Six semaines après ses chaleurs, elle boit beaucoup, est abattue et a des pertes vulvaires.',q:'Que suspecter ?',
    a:['Un pyomètre (infection de l’utérus)','Une simple grossesse nerveuse','Une cystite banale','Un coup de chaleur'],ex:'Le pyomètre touche les chiennes non stérilisées quelques semaines après les chaleurs. C’est une urgence chirurgicale (ablation de l’utérus).'},
  {sp:'chien',br:'bouledogue français',age:[2,8],p:'est resté enfermé dans une voiture au soleil. Il halète très fort et titube.',q:'Quel premier geste faire ?',
    a:['Le rafraîchir avec de l’eau fraîche (pas glacée) et filer chez le véto','L’envelopper dans une couverture','Le plonger dans de l’eau glacée','Le laisser se reposer au soleil'],ex:'Coup de chaleur : on refroidit avec de l’eau fraîche ou tiède et on ventile, sans eau glacée (les vaisseaux se resserrent), puis on consulte en urgence.'},
  {sp:'chien',mo:true,age:[2,2],p:'vient d’être adopté.',q:'À quel âge commence en général la vaccination du chiot ?',
    a:['Vers 8 semaines, avec des rappels quelques semaines plus tard','Seulement à l’âge adulte','Dès la naissance','Jamais : ce n’est pas utile'],ex:'La primovaccination du chiot débute vers 7 à 8 semaines, avec des rappels jusqu’à environ 16 semaines, puis des rappels réguliers.'},
  {sp:'chat',age:[12,16],p:'mange énormément mais maigrit. Il est agité et vomit parfois.',q:'Quelle maladie hormonale est la plus probable ?',
    a:['L’hyperthyroïdie','L’hypothyroïdie','La maladie d’Addison','Le diabète insipide'],ex:'L’hyperthyroïdie est fréquente chez le chat âgé : appétit augmenté, amaigrissement, hyperactivité, vomissements. Le diagnostic se fait en dosant la T4.'},
  {sp:'chien',age:[1,10],p:'revient d’une balade en forêt avec une tique accrochée à l’oreille.',q:'Comment la retirer ?',
    a:['Avec un tire-tique, en tournant doucement, sans l’écraser','En la brûlant','En mettant d’abord de l’éther ou de l’alcool','En tirant d’un coup sec avec les doigts'],ex:'Le tire-tique extrait la tique entière. On ne l’endort pas et on ne l’écrase pas : elle pourrait régurgiter des agents infectieux (piroplasmose, maladie de Lyme…).'},
  {sp:'chat',age:[1,10],p:'se gratte beaucoup. On trouve de petits points noirs dans ses poils.',q:'Que sont probablement ces points noirs ?',
    a:['Des déjections de puces','De la terre','Des pellicules','Des grains de beauté'],ex:'Ces « poussières » noires qui deviennent rouges sur un papier humide sont des déjections de puces (du sang digéré). On traite l’animal et la maison.'},
  {sp:'chien',br:'cavalier King Charles',age:[8,12],p:'tousse la nuit et s’essouffle vite en promenade. On entend un souffle au cœur.',q:'Quelle maladie est très fréquente dans cette race ?',
    a:['Une maladie de la valve mitrale','Une fracture de côte','Une otite','Un abcès dentaire'],ex:'L’endocardiose mitrale est très fréquente chez le cavalier King Charles : souffle cardiaque, puis insuffisance cardiaque (toux, essoufflement).'},
  {sp:'chien',br:'bouledogue français',age:[1,6],p:'respire bruyamment, ronfle et se fatigue très vite quand il fait chaud.',q:'Quelle en est la cause ?',
    a:['Le syndrome respiratoire des races à museau court','Il fait semblant','Une allergie aux croquettes','Une otite'],ex:'Narines étroites, voile du palais trop long : les races brachycéphales respirent mal et supportent mal la chaleur. Pas d’effort quand il fait chaud ; une chirurgie peut aider.'},
  {sp:'chat',age:[2,10],p:'a été mordu par un autre chat il y a 3 jours. Une boule chaude et douloureuse est apparue sur sa patte.',q:'Que suspecter ?',
    a:['Un abcès','Une fracture','Une tumeur','Une piqûre de moustique'],ex:'Les morsures de chat s’infectent souvent et forment des abcès : drainage, nettoyage, parfois antibiotiques.'}
];
const PAT_MED=[
  {age:[20,45],p:'a mal à la gorge depuis 2 jours, 38,5 °C, sans toux, avec des ganglions sensibles au cou.',q:'Que faire avant de prescrire un antibiotique ?',
    a:['Un test rapide (TROD) du streptocoque','Un antibiotique pour tout le monde, par précaution','Une radiographie des poumons','Rien : une angine guérit toujours seule'],ex:'Chez l’adulte, si le score de McIsaac est d’au moins 2, on fait un TROD : l’antibiotique n’est utile que s’il est positif (angine à streptocoque).'},
  {m:true,age:[55,72],p:'ressent depuis 20 minutes une douleur dans la poitrine, comme un étau, qui descend dans le bras gauche.',q:'Quel est le bon réflexe ?',
    a:['Appeler le 15 (SAMU) immédiatement','Lui conseiller de se reposer et de revenir demain','Lui donner un antidouleur et attendre','Prévoir une prise de sang la semaine prochaine'],ex:'Une douleur thoracique qui évoque un infarctus impose d’appeler le 15 et de faire un ECG au plus vite. Chaque minute compte.'},
  {age:[40,65],p:'a une tension à 152/96 mmHg mesurée au cabinet, sans aucun symptôme.',q:'Comment confirmer une hypertension ?',
    a:['Par des mesures hors du cabinet (automesure à la maison ou MAPA)','En commençant tout de suite trois médicaments','Inutile : une seule mesure suffit','Par une IRM cérébrale'],ex:'On confirme l’HTA par une automesure tensionnelle ou une MAPA avant de traiter, pour éviter l’effet « blouse blanche ».'},
  {baby:true,age:[8,30],p:'a 39 °C de fièvre depuis hier, mais il joue, boit bien et reste tonique.',q:'Quel médicament contre la fièvre privilégier ?',
    a:['Le paracétamol, à la dose adaptée à son poids','L’aspirine','Un antibiotique systématique','Un bain froid'],ex:'Chez l’enfant, le paracétamol est le traitement de première intention de la fièvre, dosé selon le poids. Pas d’aspirine. Le but est surtout son confort.'},
  {age:[50,68],p:'a un diabète de type 2.',q:'Quel examen de sang suit l’équilibre du diabète sur 3 mois ?',
    a:['L’hémoglobine glyquée (HbA1c)','La glycémie d’un seul matin','Le cholestérol','La créatinine'],ex:'L’HbA1c reflète la glycémie moyenne des 2 à 3 derniers mois. On la dose en général tous les 3 mois.'},
  {age:[18,35],p:'a mangé des cacahuètes : en quelques minutes, ses lèvres gonflent, des plaques le démangent et il a du mal à respirer.',q:'Quel traitement donner en urgence ?',
    a:['Une injection d’adrénaline et un appel au 15','Un antihistaminique et attendre demain','Boire beaucoup d’eau','Une crème à la cortisone'],ex:'Anaphylaxie : l’adrénaline intramusculaire (stylo auto-injecteur) est le traitement de première intention, puis appel du 15. Les antihistaminiques ne suffisent pas.'},
  {m:true,age:[60,78],p:'a depuis 30 minutes la bouche déviée, le bras droit faible et du mal à parler.',q:'Que faire ?',
    a:['Appeler le 15 tout de suite : c’est peut-être un AVC','Attendre que ça passe','Lui faire boire un café','Prévoir un rendez-vous chez le neurologue'],ex:'Visage paralysé, bras faible, trouble de la parole : AVC jusqu’à preuve du contraire. On appelle le 15 : les traitements (thrombolyse) se jouent en heures.'},
  {age:[25,50],p:'tousse depuis 5 jours avec le nez qui coule, sans forte fièvre, en bon état général.',q:'Faut-il un antibiotique ?',
    a:['Non : c’est très probablement viral','Oui, toujours après 3 jours','Oui, pour éviter la contagion','Oui, s’il crache'],ex:'Rhinopharyngite ou bronchite aiguë chez un adulte en bonne santé : origine virale, pas d’antibiotique. On soulage les symptômes.'},
  {f:true,age:[18,40],p:'a des brûlures en urinant et des envies fréquentes, sans fièvre ni douleur dans le dos.',q:'Quel examen simple faire au cabinet ?',
    a:['Une bandelette urinaire','Un scanner de l’abdomen','Une prise de sang en urgence','Une radiographie du bassin'],ex:'Cystite simple : la bandelette urinaire (leucocytes, nitrites) oriente le diagnostic, puis traitement court (par exemple la fosfomycine en une prise).'},
  {age:[60,78],p:'fume depuis 40 ans et s’essouffle de plus en plus.',q:'Quel examen confirme une BPCO ?',
    a:['Une spirométrie','Un électrocardiogramme','Une échographie du foie','Une prise de tension'],ex:'La BPCO se confirme par une spirométrie (VEMS / CVF < 0,7 après bronchodilatateur). L’arrêt du tabac reste le traitement le plus efficace.'},
  {age:[25,50],p:'a mal au bas du dos depuis une semaine, sans aucun signe de gravité.',q:'Faut-il une radiographie ?',
    a:['Non : l’imagerie est inutile sans signe d’alerte','Oui, toujours','Oui, une IRM en urgence','Oui, un scanner pour être sûr'],ex:'Lombalgie aiguë commune : pas d’imagerie les premières semaines en l’absence de drapeau rouge (HAS). On encourage à rester actif.'},
  {baby:true,age:[8,22],p:'a de la fièvre, tire sur son oreille et pleure la nuit. Son tympan est rouge et bombé.',q:'De quoi s’agit-il ?',
    a:['Une otite moyenne aiguë','Une angine','Une conjonctivite','Une bronchiolite'],ex:'Tympan bombé et inflammatoire : otite moyenne aiguë purulente. Avant 2 ans, on la traite par antibiotique (amoxicilline).'},
  {age:[30,60],p:'veut arrêter de fumer.',q:'Qu’est-ce qui augmente le plus ses chances de réussir ?',
    a:['Des substituts nicotiniques avec un accompagnement','Arrêter seul d’un coup, sans aide','Passer à des cigarettes « légères »','Attendre d’avoir des symptômes'],ex:'Les substituts nicotiniques (patchs, gommes) associés à un suivi augmentent nettement les chances d’arrêt. Tabac info service : 39 89.'},
  {f:true,age:[75,88],p:'prend 9 médicaments différents et vient de faire une chute.',q:'Que faire en priorité ?',
    a:['Revoir l’ordonnance pour retirer les médicaments inutiles ou à risque','Ajouter un somnifère','Lui interdire de marcher','Ajouter un dixième médicament'],ex:'La polymédication (somnifères, antihypertenseurs…) favorise les chutes : on réévalue l’ordonnance pour déprescrire ce qui n’est plus utile.'},
  {age:[15,22],p:'a une acné modérée sur le visage.',q:'Quel conseil de base lui donner ?',
    a:['Une toilette douce et un traitement local adapté, sans percer les boutons','Frotter fort avec de l’alcool','S’exposer beaucoup au soleil','Percer tous les boutons'],ex:'Acné : nettoyage doux, traitements locaux (peroxyde de benzoyle, rétinoïdes). Le soleil améliore d’abord, puis l’acné revient de plus belle (effet rebond).'},
  {age:[20,45],p:'s’est fait mordre la main par un chien. La plaie est souillée.',q:'Que vérifier en plus du lavage de la plaie ?',
    a:['Que sa vaccination contre le tétanos est à jour','Son groupe sanguin','Sa vue','Rien d’autre'],ex:'Plaie souillée ou morsure : lavage abondant, vérification du vaccin antitétanique (rappel si besoin), et souvent un antibiotique pour une morsure de la main.'},
  {age:[45,65],p:'a un cholestérol LDL trop élevé.',q:'Quelle mesure est toujours recommandée en premier ?',
    a:['Une alimentation équilibrée et plus d’activité physique','Ne plus manger aucune graisse','Une opération chirurgicale','Rien : ce n’est jamais grave'],ex:'Hypercholestérolémie : alimentation de type méditerranéen, activité physique, arrêt du tabac ; une statine selon le risque cardiovasculaire.'},
  {f:true,age:[25,38],p:'souhaite avoir un enfant dans les prochains mois.',q:'Quelle vitamine lui conseiller dès maintenant ?',
    a:['L’acide folique (vitamine B9)','La vitamine A à forte dose','La vitamine C','Aucune vitamine'],ex:'L’acide folique, commencé avant la conception et poursuivi en début de grossesse, réduit le risque d’anomalies de fermeture du tube neural (spina bifida).'}
];
const PAT_DENT=[
  {age:[25,50],p:'a une douleur dentaire très intense, spontanée, qui pulse la nuit et augmente avec le chaud.',q:'Que suspecter ?',
    a:['Une pulpite irréversible','Une simple sensibilité au froid','Une gingivite','Une dent de sagesse qui pousse normalement'],ex:'Douleur spontanée, lancinante, nocturne, aggravée par le chaud : pulpite irréversible. On traite la pulpe (pulpotomie puis dévitalisation).'},
  {age:[18,40],p:'s’est fait enlever une dent de sagesse il y a 3 jours. La douleur est très forte et le trou est vide, sans caillot.',q:'De quoi s’agit-il ?',
    a:['Une alvéolite sèche','Une carie','Une fracture de la mâchoire','Un aphte'],ex:'L’alvéolite sèche survient quand le caillot se désagrège (tabac, rinçages trop tôt) : douleur intense 2 à 4 jours après l’extraction. On nettoie et on protège l’alvéole.'},
  {age:[18,40],p:'saigne des gencives quand il se brosse les dents.',q:'Quel conseil lui donner ?',
    a:['Continuer à bien se brosser et prévoir un détartrage','Arrêter de se brosser les dents','Se brosser plus fort avec une brosse dure','Se rincer à l’eau très chaude'],ex:'Le saignement traduit une gingivite due à la plaque dentaire. Un brossage doux mais soigneux, le fil ou les brossettes et un détartrage la font disparaître.'},
  {kid:true,age:[8,13],p:'est tombé : une dent définitive de devant est sortie entière.',q:'Que faire ?',
    a:['Tenir la dent par la couronne, la garder dans du lait et consulter en urgence','La laver en frottant bien la racine','La garder au sec dans un mouchoir jusqu’au lendemain','Rien : elle repoussera'],ex:'Dent définitive expulsée : on la tient par la couronne sans toucher la racine, on la remet en place ou on la garde dans du lait, et on consulte en moins d’une heure.'},
  {age:[20,45],p:'a mal quelques secondes quand il boit froid ; la douleur s’arrête dès que le froid disparaît.',q:'Quelle est la cause la plus probable ?',
    a:['Une hypersensibilité dentinaire (collets découverts)','Une pulpite irréversible','Une fracture de la mâchoire','Un abcès'],ex:'Douleur brève, provoquée par le froid et qui cesse avec lui : hypersensibilité dentinaire (ou pulpite réversible). Dentifrice désensibilisant et traitement de la cause.'},
  {kid:true,age:[2,4],p:'boit chaque soir un biberon de jus de fruits pour s’endormir.',q:'Quel risque pour ses dents ?',
    a:['Des caries précoces (« carie du biberon »)','Aucun : le jus est naturel','Des dents plus solides','Une meilleure haleine'],ex:'La nuit, la salive diminue : les sucres restent au contact des dents et provoquent des caries précoces. Au coucher, seulement de l’eau.'},
  {age:[25,55],p:'a la joue gonflée, une dent douloureuse quand on la tapote et de la fièvre.',q:'Que suspecter ?',
    a:['Un abcès dentaire','Une carie débutante','Une gingivite','Un aphte'],ex:'Joue gonflée, douleur à la percussion, fièvre : abcès d’origine dentaire. Drainage, traitement de la dent et antibiotique si besoin ; urgence si la gorge ou l’œil gonflent.'},
  {age:[20,60],p:'demande quel dentifrice choisir.',q:'Quel composant protège le plus contre les caries ?',
    a:['Le fluor','Le menthol','Le bicarbonate','Le colorant'],ex:'Le fluor renforce l’émail et freine les caries : dentifrice fluoré adapté à l’âge (1 450 ppm chez l’adulte), deux fois par jour pendant deux minutes.'},
  {age:[50,72],p:'fume et a sur le bord de la langue une plaie blanche qui ne cicatrise pas depuis 3 semaines.',q:'Que faire ?',
    a:['L’adresser rapidement pour une biopsie','Attendre encore 6 mois','Mettre du sel dessus','Rien : c’est un aphte'],ex:'Toute lésion de la bouche qui ne guérit pas en 2 à 3 semaines, surtout chez un fumeur, doit être examinée et biopsiée : il faut éliminer un cancer.'},
  {kid:true,age:[11,15],p:'porte un appareil orthodontique avec des bagues.',q:'Comment éviter les caries autour des bagues ?',
    a:['Un brossage minutieux après chaque repas, avec des brossettes','Se brosser moins pour ne pas abîmer l’appareil','Manger plus de bonbons collants','Se rincer seulement à l’eau'],ex:'Les bagues retiennent la plaque : brossage soigneux après les repas, brossettes, fluor. On évite les aliments collants et sucrés.'},
  {age:[30,55],p:'se réveille avec des maux de tête et mal à la mâchoire ; ses dents sont usées.',q:'Que suspecter ?',
    a:['Du bruxisme (serrer ou grincer des dents la nuit)','Une carie','Une sinusite seulement','Une otite'],ex:'Bruxisme : usure des dents, douleurs musculaires au réveil. Gouttière de protection la nuit et gestion du stress.'},
  {kid:true,age:[6,8],p:'a ses premières molaires définitives qui viennent de sortir.',q:'Quel geste de prévention proposer ?',
    a:['Le scellement des sillons','Une extraction','Une couronne en or','Un blanchiment'],ex:'Le scellement des sillons protège les molaires définitives des caries. Il est pris en charge chez l’enfant.'},
  {f:true,age:[25,40],p:'est enceinte de 5 mois et a les gencives gonflées qui saignent.',q:'Est-ce fréquent pendant la grossesse ?',
    a:['Oui : c’est une gingivite de grossesse, un bilan dentaire est conseillé','Non : il faut arrêter de se brosser','Non : c’est forcément grave','Oui, et il ne faut surtout pas voir de dentiste'],ex:'Les hormones de la grossesse favorisent la gingivite. Un examen bucco-dentaire est recommandé (pris en charge en France à partir du 4e mois).'},
  {age:[65,85],p:'porte un dentier qui le blesse ; une plaie est apparue sous l’appareil.',q:'Que lui conseiller ?',
    a:['Faire réajuster la prothèse par son dentiste','Le porter jour et nuit pour s’habituer','Le recoller avec de la super-glue','Ignorer la plaie'],ex:'Une prothèse mal adaptée blesse la gencive : il faut la faire retoucher. On la retire et on la nettoie chaque nuit.'},
  {age:[17,28],p:'a la gencive gonflée et douloureuse autour d’une dent de sagesse du bas qui est en train de sortir.',q:'De quoi s’agit-il ?',
    a:['Une péricoronarite','Une pulpite d’une incisive','Une fracture','Un aphte'],ex:'Péricoronarite : inflammation de la gencive autour d’une dent de sagesse en éruption. Nettoyage, bains de bouche, parfois extraction.'},
  {age:[18,40],p:'grignote des sucreries toute la journée.',q:'Pourquoi est-ce mauvais pour les dents ?',
    a:['Chaque prise sucrée acidifie la bouche : la fréquence compte plus que la quantité','Le sucre rend les dents plus dures','Ce n’est pas mauvais si on mange vite','Le sucre n’a aucun lien avec les caries'],ex:'Après chaque prise sucrée, les bactéries produisent des acides pendant 20 à 30 minutes : le grignotage multiplie ces attaques de l’émail.'},
  {age:[30,60],p:'a eu une dévitalisation et sa dent est très abîmée.',q:'Que proposer pour la protéger ?',
    a:['Une couronne','Rien : une dent dévitalisée est indestructible','Un blanchiment','Un détartrage'],ex:'Une dent dévitalisée et délabrée est fragile : une couronne (parfois sur un inlay-core) évite qu’elle se fracture.'},
  {kid:true,age:[2,2],p:'vient d’avoir 2 ans.',q:'Quelle quantité de dentifrice fluoré mettre sur sa brosse ?',
    a:['Une trace, de la taille d’un grain de riz','Une grosse noisette de dentifrice adulte','Aucune : pas de brossage avant 6 ans','Du dentifrice à avaler sans brosse'],ex:'Avant 3 ans : une trace de dentifrice fluoré (taille d’un grain de riz), brossage fait par un adulte, deux fois par jour.'}
];

// =========================================================
// Montage / démontage de l'écran
// =========================================================
function bindOnce(){
  const cv=E.renderer.domElement;
  cv.addEventListener('pointerdown',onDown);cv.addEventListener('pointermove',onMove);cv.addEventListener('pointerup',onUp);
  cv.addEventListener('pointercancel',onCancel);cv.addEventListener('pointerleave',onLeave);
  cv.addEventListener('wheel',onWheel,{passive:false});cv.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',onKey);window.addEventListener('keyup',e=>KEYS.delete((e.key||'').toLowerCase()));window.addEventListener('blur',()=>KEYS.clear());
  new ResizeObserver(resize).observe(E.stage);
  const top=ROOT.querySelector('.cty-top'),bot=ROOT.querySelector('.cty-bottom'),box=$('cty');
  // Défi en cours (à gauche) et caméra (à droite) restent en bas, même quand un menu (Zones, Services…) s'ouvre
  // au-dessus de la barre d'outils : sur la même ligne qu'elle s'il y a la place, sinon juste au-dessus.
  const tools=$('cty-tools');
  window.addEventListener('resize',()=>{if(E&&E.running)placeLow();});
  const ro=new ResizeObserver(()=>{if(top.offsetHeight)box.style.setProperty('--cty-toph',top.offsetHeight+'px');if(bot.offsetHeight)box.style.setProperty('--cty-both',bot.offsetHeight+'px');placeLow();});
  ro.observe(top);ro.observe(bot);ro.observe(tools);ro.observe(box);
  const bye=()=>{if(E&&E.running)save();};
  window.addEventListener('pagehide',bye);document.addEventListener('visibilitychange',()=>{if(document.hidden)bye();});
}
function mount(root){
  if(!S){load();initDerived();}
  if(ROOT!==root||!$('cty-stage'))buildHUD(root);
  const stage=$('cty-stage');
  if(!E){
    createEngine();E.stage=stage;stage.appendChild(E.renderer.domElement);
    if(S.cam)Object.assign(CAM,S.cam);clampCam();resize();applyCam();
    fullRebuild();bindOnce();
  }else if(E.renderer.domElement.parentNode!==stage){E.stage=stage;stage.appendChild(E.renderer.domElement);}
  E.running=true;E.clock.getDelta();resize();applyCam();
  syncGrants();refreshToolbar();refreshHUD(true);renderTuto();checkTuto();renderEventBanner();placeLow();
  const ld=$('cty-loading');if(ld)ld.style.display='none';
  extMount();
  loop();
  // Métier : demandé une seule fois, au tout début d'une nouvelle ville (kiné par défaut, enregistré tout de suite :
  // fermer la fenêtre sans choisir ne la fait plus revenir). Une ville déjà commencée garde kiné, modifiable dans les Réglages.
  if(!S.prof&&!VISIT){S.prof='kine';applyProf();save();if(!S.helped)openPanel('prof');}
  if(PANEL!=='prof'&&!S.helped&&!VISIT){openPanel('help');S.helped=true;save();}
}
function unmount(){
  if(isFS())setFS(false);   // on quitte l'écran de la ville (ex. « Réviser ») : sortir du plein écran
  if(!E)return;E.running=false;cancelAnimationFrame(E.raf);
  toolCancel();PTR.clear();GEST=null;extUnmount();save();
}
function refresh(){if(E&&E.running){if(!VISIT)syncGrants();refreshHUD(true);extRefresh();}}
return {mount,unmount,refresh,_debug:()=>({S,ST,E,CAM,road,zone,lvl,st,ter,tree,svcAt,SV,pw,wt,lval,hap,cap,setTool,simDay,simRefresh,placeAt,commitRoad,commitRect,applyCam,setView,openPanel,SEL:()=>SEL,setSel:t=>{SEL=t;showSelection();openPanel('inspect');},
  X:{placeLow,patientSpawn,patientAnswer,crisisMonth,crisisQuiz,fireworks,followStart,followStop,refreshRepairs,festCheck,tlMaybeSnap,checkAch,catMonth,recomputeTraffic,distNew,visitStart,visitEnd,extToolUp,extPreview,extPick,TOOL:()=>TOOL,trf,rail,rx,deco,hill,dist,renderPanel,TORN:()=>TORN,setTorn:t=>{TORN=t;},tradeIncome,FOLLOW:()=>FOLLOW,SND,sndInit,citySnapshot,SOC,quizAnswer,QZ:()=>QZ,quizNext,PANEL:()=>PANEL,news,SIG,sigState,carTarget,timeK,animK,newLandscape,setProf,BIO,mtnH,mtn,nextMove,ovpY,OVT,REW,patientDay,extToolUp,lane,E6:()=>E.v6,sosStart,sosWin,sosActive,v6Quest,gzStats,gzSection,anaAsk,skyPick,moonPhase,evSend,v6FireTruck,ignite,laneCount,hourNow,svcFront,carsSaved,ANAT,accStart,accClear,RL,setBuilding,siteStage,addSvc,placeCheck,thumbFor,THUMBS,rebuildLights,D,humLook,svcOK,lmBuild,showStart,xmasBuild,V15:()=>V15}})};
})();
