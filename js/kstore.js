/* kstore.js — « grande mémoire » (16 nov. 2026)
   localStorage est limité à ≈ 5 Mo par site. Ici, les grosses valeurs partent dans IndexedDB
   (place = le disque de l'ordinateur), en gardant l'écriture habituelle localStorage.getItem / setItem :
   - valeur ≥ LIMIT caractères, ou refusée par localStorage (plein) → IndexedDB + copie en mémoire (`big`) ;
     localStorage ne garde qu'un marqueur MARK sous la même clé (les boucles sur les clés continuent de marcher) ;
   - getItem rend la copie en mémoire, donc tout reste synchrone ;
   - KBoot(liste) charge les scripts de l'appli APRÈS la lecture d'IndexedDB (voir index.html).
   Voir docs/stockage.md. */
(function(){
'use strict';
var LS=null;try{LS=window.localStorage;}catch(e){}
var P=window.Storage&&Storage.prototype;
var MARK='\u0001IDB',LIMIT=16000,DBN='citywork-store',ST='kv';
var big=Object.create(null),loose=[],db=null,ok=false,pending=0,waiters=[],errAt=0,askedPersist=false;
var _get,_set,_rem,_clear,_key,_len;
document.documentElement.classList.add('kboot');
/* pas d'éclair blanc en mode sombre pendant la lecture des données */
var darkBoot=false;try{darkBoot=LS&&/dark/.test(LS.getItem('kp_theme')||'');}catch(e){}
if(darkBoot)document.documentElement.style.background='#0e0e10';
function unboot(){document.documentElement.classList.remove('kboot');if(darkBoot){document.documentElement.style.background='';darkBoot=false;}}
setTimeout(unboot,7000);

function isQuota(e){return !!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014);}
function dropLoose(k){var i=loose.indexOf(k);if(i>=0)loose.splice(i,1);}
function settle(){pending--;if(pending<=0){pending=0;var w=waiters;waiters=[];w.forEach(function(f){try{f();}catch(e){}});}}
function fail(err){
  window._kineSaveError=err||new Error('IndexedDB');
  console.error('[City Work] grande mémoire :',err);
  if(Date.now()-errAt>20000&&typeof window.showNotif==='function'){errAt=Date.now();
    window.showNotif(isQuota(err)?'Le disque de l’ordinateur est plein : tes dernières modifications ne sont pas enregistrées.':'Erreur d’enregistrement : '+((err&&err.message)||err),'err');}
}
function idb(fn){ // une écriture = une transaction, validée tout de suite
  if(!db)return;
  pending++;
  try{
    var t=db.transaction(ST,'readwrite');fn(t.objectStore(ST));
    t.oncomplete=settle;
    t.onerror=t.onabort=function(){fail(t.error);settle();};
    if(t.commit)try{t.commit();}catch(e){}
  }catch(e){fail(e);settle();}
}
function persist(){
  if(askedPersist)return;askedPersist=true;
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){});}catch(e){}
}
function putBig(k,v){
  if(big[k]===v){try{if(_get.call(LS,k)!==MARK)_set.call(LS,k,MARK);}catch(e){}return;}   /* inchangé : rien à réécrire sur le disque */
  big[k]=v;
  idb(function(s){s.put(v,k);});
  persist();
  try{if(_get.call(LS,k)!==MARK)_set.call(LS,k,MARK);dropLoose(k);}
  catch(e){try{_rem.call(LS,k);}catch(_){ }if(loose.indexOf(k)<0)loose.push(k);}
}

if(LS&&P){
  _get=P.getItem;_set=P.setItem;_rem=P.removeItem;_clear=P.clear;_key=P.key;
  _len=Object.getOwnPropertyDescriptor(P,'length');
  P.getItem=function(k){
    if(this!==LS)return _get.call(this,k);
    k=String(k);if(k in big)return big[k];
    var v=_get.call(LS,k);return v===MARK?null:v;
  };
  P.setItem=function(k,v){
    if(this!==LS||!ok)return _set.call(this,k,v);
    k=String(k);v=String(v);
    if(v.length>=LIMIT){putBig(k,v);return;}
    try{
      _set.call(LS,k,v);
      if(k in big){delete big[k];idb(function(s){s.delete(k);});}
      dropLoose(k);
    }catch(e){if(!isQuota(e))throw e;putBig(k,v);}
  };
  P.removeItem=function(k){
    if(this!==LS)return _rem.call(this,k);
    k=String(k);
    if(k in big){delete big[k];idb(function(s){s.delete(k);});}
    dropLoose(k);
    return _rem.call(LS,k);
  };
  P.clear=function(){
    if(this!==LS)return _clear.call(this);
    big=Object.create(null);loose=[];idb(function(s){s.clear();});
    return _clear.call(LS);
  };
  P.key=function(i){
    if(this!==LS)return _key.call(this,i);
    var n=_len.get.call(LS);return i<n?_key.call(LS,i):(loose[i-n]||null);
  };
  try{Object.defineProperty(P,'length',{configurable:true,enumerable:true,get:function(){var n=_len.get.call(this);return this===LS?n+loose.length:n;}});}catch(e){}
}

function hasMarkers(){
  if(!LS||!_get)return false;
  try{for(var i=0,n=_len.get.call(LS);i<n;i++){if(_get.call(LS,_key.call(LS,i))===MARK)return true;}}catch(e){}
  return false;
}
function open(){
  return new Promise(function(res){
    if(!LS||!P||!window.indexedDB){res(false);return;}
    var done=false,to=setTimeout(function(){if(!done){done=true;res(false);}},6000),r;
    try{r=indexedDB.open(DBN,1);}catch(e){clearTimeout(to);res(false);return;}
    r.onupgradeneeded=function(){if(!r.result.objectStoreNames.contains(ST))r.result.createObjectStore(ST);};
    r.onerror=r.onblocked=function(){if(!done){done=true;clearTimeout(to);res(false);}};
    r.onsuccess=function(){
      var d=r.result;
      if(done){try{d.close();}catch(e){}return;}
      try{
        var t=d.transaction(ST,'readonly'),s=t.objectStore(ST),keys=null,vals=null;
        var rk=s.getAllKeys(),rv=s.getAll();
        rk.onsuccess=function(){keys=rk.result;};rv.onsuccess=function(){vals=rv.result;};
        t.oncomplete=function(){
          if(done)return;done=true;clearTimeout(to);
          db=d;ok=true;var stale=[];
          for(var i=0;i<keys.length;i++){
            var k=String(keys[i]),cur=null;try{cur=_get.call(LS,k);}catch(e){}
            if(cur!=null&&cur!==MARK){stale.push(k);continue;}   // localStorage a une valeur plus récente
            big[k]=String(vals[i]);if(cur==null)loose.push(k);
          }
          stale.forEach(function(k){idb(function(s2){s2.delete(k);});});
          d.onversionchange=function(){try{d.close();}catch(e){}};
          res(true);
        };
        t.onerror=t.onabort=function(){if(!done){done=true;clearTimeout(to);res(false);}};
      }catch(e){if(!done){done=true;clearTimeout(to);res(false);}}
    };
  });
}
var ready=open();

/* Déménagement : les grosses valeurs déjà dans localStorage partent dans IndexedDB (une fois, en douceur). */
function migrate(){
  if(!ok)return;
  var todo=[];
  try{for(var i=0,n=_len.get.call(LS);i<n;i++){var k=_key.call(LS,i),v=_get.call(LS,k);if(v&&v!==MARK&&v.length>=LIMIT&&!/^sb-/.test(k))todo.push(k);}}catch(e){}
  (function next(){
    var k=todo.shift();if(k==null)return;
    var v=null;try{v=_get.call(LS,k);}catch(e){}
    if(!v||v===MARK||v.length<LIMIT){next();return;}
    try{
      var t=db.transaction(ST,'readwrite');t.objectStore(ST).put(v,k);
      t.oncomplete=function(){
        try{if(_get.call(LS,k)===v){big[k]=v;_set.call(LS,k,MARK);}else if(!(k in big)){var t2=db.transaction(ST,'readwrite');t2.objectStore(ST).delete(k);}}catch(e){}
        setTimeout(next,30);
      };
      t.onerror=t.onabort=function(){};
    }catch(e){}
  })();
}

function allKeys(){
  var out=[],i,n;
  if(!LS)return out;
  try{for(i=0,n=_len?_len.get.call(LS):LS.length;i<n;i++)out.push(_key?_key.call(LS,i):LS.key(i));}catch(e){}
  loose.forEach(function(k){if(out.indexOf(k)<0)out.push(k);});
  return out;
}
function flush(){return new Promise(function(res){if(pending<=0)res();else{waiters.push(res);setTimeout(res,15000);}});}

window.KStore={
  ready:ready,
  get ok(){return ok;},
  keys:allKeys,
  flush:flush,
  reload:function(){flush().then(function(){location.reload();});},
  isBig:function(k){return k in big;},
  /* {ls: caractères dans localStorage, big: caractères dans IndexedDB, quota/usage: octets (estimation du navigateur)} */
  usage:function(){
    var a=0,b=0,k;
    try{for(var i=0,n=_len.get.call(LS);i<n;i++){k=_key.call(LS,i);a+=k.length+(_get.call(LS,k)||'').length;}}catch(e){}
    for(k in big)b+=k.length+big[k].length;
    var est=(navigator.storage&&navigator.storage.estimate)?navigator.storage.estimate().catch(function(){return {};}):Promise.resolve({});
    return est.then(function(e){return {ls:a,big:b,quota:e.quota||0,usage:e.usage||0};});
  }
};

/* ── Démarrage de l'appli : KBoot([... scripts ...]) ──
   Les scripts sont chargés une fois IndexedDB lue. Pour eux rien ne change : la page est annoncée « en cours de
   chargement », et leurs écouteurs DOMContentLoaded / load sont appelés à la fin, dans l'ordre. */
window.KBoot=function(list){
  var dcl=[],ld=[],done=false,dAdd=document.addEventListener,wAdd=window.addEventListener;
  document.addEventListener=function(t,fn,o){if(!done&&t==='DOMContentLoaded'){dcl.push(fn);return;}return dAdd.call(document,t,fn,o);};
  window.addEventListener=function(t,fn,o){if(!done&&(t==='load'||t==='DOMContentLoaded')){(t==='load'?ld:dcl).push(fn);return;}return wAdd.call(window,t,fn,o);};
  try{Object.defineProperty(document,'readyState',{configurable:true,get:function(){return 'loading';}});}catch(e){}
  function run(arr,target,type){arr.forEach(function(fn){try{var ev=new Event(type);if(typeof fn==='function')fn.call(target,ev);else if(fn&&fn.handleEvent)fn.handleEvent(ev);}catch(e){console.error(e);}});}
  function finish(){
    if(done)return;done=true;
    try{delete document.readyState;}catch(e){}
    document.addEventListener=dAdd;window.addEventListener=wAdd;
    run(dcl,document,'DOMContentLoaded');
    var fire=function(){setTimeout(function(){run(ld,window,'load');unboot();},0);};
    if(document.readyState==='complete')fire();else wAdd.call(window,'load',fire);
    setTimeout(migrate,2500);
  }
  function fatal(){
    unboot();
    var d=document.createElement('div');
    d.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#111;color:#fff;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center';
    d.innerHTML='<div style="max-width:420px"><b style="font-size:20px">Impossible de lire tes données</b><p style="opacity:.8">La mémoire du navigateur ne répond pas. Tes données ne sont pas perdues : ferme les autres onglets du site puis recharge la page.</p><button onclick="location.reload()" style="margin-top:8px;padding:10px 22px;border-radius:10px;border:0;font:inherit;font-weight:600;cursor:pointer">Recharger</button></div>';
    document.body.appendChild(d);
  }
  function load(){
    if(!ok&&hasMarkers()){fatal();return;}
    var left=list.length;
    if(!left){finish();return;}
    list.forEach(function(src){
      var s=document.createElement('script');s.src=src;s.async=false;
      s.onload=s.onerror=function(){if(--left<=0)finish();};
      document.body.appendChild(s);
    });
  }
  ready.then(load,load);
};
})();
