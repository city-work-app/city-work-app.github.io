'use strict';
/* =========================================================
   city.js — « Ma ville » : point d'entrée léger, chargé avec la page.
   Le jeu lui-même (js/city-game.js + Three.js depuis le CDN) n'est
   chargé qu'à la première ouverture de l'écran, comme la maison 3D.
   ========================================================= */
const CITY_XP_MONEY=20;   // doit rester égal à XP_MONEY dans city-game.js
let _cityMod=null,_cityLoading=null,_cityMounted=false;

function _cityLoad(){
  if(_cityMod)return Promise.resolve(_cityMod);
  if(!_cityLoading){
    _cityLoading=new Promise((res,rej)=>{
      if(window.KineCityReady)return res(window.KineCityReady);
      const s=document.createElement('script');s.src='js/city-game.js?v=38';
      s.onload=()=>window.KineCityReady?res(window.KineCityReady):rej(new Error('city-game.js chargé mais vide'));
      s.onerror=()=>rej(new Error('fichier js/city-game.js introuvable'));
      document.head.appendChild(s);
    }).then(m=>{_cityMod=m;return m;})
      .catch(e=>{_cityLoading=null;window.KineCityReady=null;throw e;});
  }
  return _cityLoading;
}

function renderCity(){
  const root=document.getElementById('city-root');if(!root)return;
  if(_cityMounted&&_cityMod){_cityMod.refresh();return;}
  if(!root.querySelector('.cty'))root.innerHTML='<div class="cty-boot"><div class="house-spinner"></div>Construction de la ville…</div>';
  else{const ld=document.getElementById('cty-loading');if(ld)ld.style.display='flex';}
  _cityLoad().then(mod=>{
    if(document.body.dataset.screen!=='city'||_cityMounted)return;
    mod.mount(root);_cityMounted=true;
  }).catch(err=>{
    console.error('[city]',err);
    const msg=String(err&&err.message||err).replace(/[<>&"]/g,''),webgl=/WebGL/i.test(msg);
    root.innerHTML=`<div class="cty-boot"><span class="ms" style="font-size:30px">${webgl?'videocam_off':'wifi_off'}</span>Impossible de charger la ville.`
      +`<small>${webgl?'Ton navigateur bloque la 3D (WebGL) : active l’accélération matérielle dans ses réglages.':'Vérifie ta connexion internet puis réessaie.'}</small>`
      +`<small class="house-err">Détail : ${msg}</small><button class="btn btn-sm btn-g" onclick="renderCity()">Réessayer</button></div>`;
  });
}
function citySleep(){if(_cityMod&&_cityMounted){_cityMod.unmount();_cityMounted=false;}}

// Argent en attente pour la ville (XP gagnées depuis la dernière visite), sans charger le jeu
function cityPendingFunds(){
  try{
    const m=JSON.parse(localStorage.getItem('kcu_city_meta')||'null');
    if(!m||m.xpSeen==null||typeof gam==='undefined'||!gam)return null;
    return{name:m.name||'Ma ville',money:Math.max(0,(gam.xp|0)-(m.xpSeen|0))*CITY_XP_MONEY,pop:m.pop|0};
  }catch(e){return null;}
}
