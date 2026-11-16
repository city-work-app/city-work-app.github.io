'use strict';

/* =========================================================
   social.js — Comptes (Supabase), amis, classement de la semaine,
   cours partagés.
   • Sans configuration (js/config.js vide) : l'app reste 100 % locale et
     l'écran « Amis & classement » propose un aperçu avec des données d'exemple.
   • Le schéma SQL et le guide d'installation sont dans le dossier supabase/.
   ========================================================= */

const SOCIAL_LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.min.js';
const SOCIAL_METRICS=[
  {id:'xp',name:'XP',icon:'bolt'},
  {id:'questions',name:'Questions',icon:'quiz'},
  {id:'time',name:'Temps de révision',icon:'schedule'},
  {id:'accuracy',name:'Précision',icon:'my_location'},
  {id:'streak',name:'Série',icon:'local_fire_department'}
];
const SOCIAL_VIS={private:{name:'Privé',icon:'lock',desc:'Seulement les amis à qui tu l’envoies'},friends:{name:'Amis',icon:'group',desc:'Tous tes amis le voient'},public:{name:'Public',icon:'public',desc:'Visible sur ton profil par tout le monde'}};

let _sb=null,_sbSession=null,_sbProfile=null,_sbInit=null,_sbAfterFor=null,_socialDemo=false;
const _soc={scope:'all',metric:'xp',lb:null,champs:null,friends:null,courses:null,inbox:null,mine:null,ctab:'amis',loading:false,err:null};

// Adresse de retour pour les e-mails (inutilisable si la page est ouverte en file://)
function _socRedirect(){return /^https?:$/.test(location.protocol)?location.origin+location.pathname:undefined;}
function socialConfigured(){const c=window.KINE_CONFIG||{};return !!(c.supabaseUrl&&c.supabaseAnonKey);}
function socialIsLogged(){return !!(_sbSession&&_sbProfile);}
function socialProfile(){return _socialDemo?_demoMe():_sbProfile;}
function _socEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function _socName(p){return (p&&(p.display_name||p.username))||'?';}
function _socDur(s){s=Math.round(s||0);const h=Math.floor(s/3600),m=Math.round((s%3600)/60);return h?`${h} h ${String(m).padStart(2,'0')}`:`${s>0?Math.max(1,m):0} min`;}
function _socFmt(metric,v){
  if(v==null)return '—';v=Number(v);
  if(metric==='time')return _socDur(v);
  if(metric==='accuracy')return (Math.round(v*10)/10).toString().replace('.',',')+' %';
  if(metric==='streak')return Math.round(v)+' j';
  if(metric==='questions')return Math.round(v)+' q.';
  return Math.round(v).toLocaleString('fr-FR')+' XP';
}

// =========================================================
// Accès au serveur (Supabase RPC) — ou à la démo locale
// =========================================================
async function _rpc(fn,args){
  if(_socialDemo)return _demoRpc(fn,args||{});
  if(!_sb)throw new Error('Comptes non configurés.');
  const {data,error}=await _sb.rpc(fn,args||{});
  if(error)throw _socialErr(error);
  return data;
}
function _socialErr(e){
  const m=(e&&e.message)||String(e);
  const map={not_authenticated:'Connecte-toi d’abord.',username_taken:'Ce pseudo est déjà pris.',invalid_username:'Pseudo : 3 à 20 caractères (minuscules, chiffres, _ ou .).',
    not_found:'Introuvable (ou plus partagé).',too_many_requests:'Trop de demandes en attente.',payload_too_large:'Ce cours est trop volumineux pour être partagé.',
    invalid_target:'Action impossible.',too_many_courses:'Tu as déjà partagé 500 cours.',
    'Invalid login credentials':'E-mail ou mot de passe incorrect.','Email not confirmed':'Confirme d’abord ton adresse e-mail (regarde tes mails).',
    'User already registered':'Un compte existe déjà avec cet e-mail.','Password should be at least':'Mot de passe trop court (6 caractères minimum).',
    'rate limit':'Trop de tentatives, réessaie dans quelques minutes.'};
  for(const k in map)if(m.includes(k))return new Error(map[k]);
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return new Error('Pas de connexion internet.');
  return new Error(m);
}

function _socialLoadLib(){
  if(window.supabase&&window.supabase.createClient)return Promise.resolve();
  return new Promise((res,rej)=>{
    const s=document.createElement('script');s.src=SOCIAL_LIB;s.async=true;
    s.onload=()=>res();s.onerror=()=>rej(new Error('Impossible de charger Supabase (connexion ?)'));
    document.head.appendChild(s);
  });
}

function socialInit(){
  _socialReadInvite();
  if(!socialConfigured()){_socialUpdateBadges();return Promise.resolve();}
  if(_sbInit)return _sbInit;
  _sbInit=_socialLoadLib().then(async()=>{
    const c=window.KINE_CONFIG;
    _sb=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'kineplus-auth'}});
    _sb.auth.onAuthStateChange((ev,session)=>{
      // Ne jamais attendre une requête Supabase dans ce callback : on diffère
      setTimeout(()=>{
        if(ev==='PASSWORD_RECOVERY'){_sbSession=session;socialOpenAuth('newpass');return;}
        _sbSession=session;
        if(session)_socialAfterLogin();
        else if(_sbAfterFor){_sbAfterFor=null;_sbProfile=null;_socialOnLogout();}
      },0);
    });
    const {data}=await _sb.auth.getSession();
    _sbSession=data.session;
    if(_sbSession)await _socialAfterLogin();
    else if(sessionStorage.getItem('kcu_invite'))setTimeout(()=>socialOpenAuth('signup'),1200);
  }).catch(e=>{console.warn('[social]',e);_sbInit=null;});
  return _sbInit;
}

async function _socialAfterLogin(){
  const user=_sbSession&&_sbSession.user;if(!user||_sbAfterFor===user.id)return;
  _sbAfterFor=user.id;
  try{
    let p=await _rpc('get_my_profile');
    if(!p){const meta=user.user_metadata||{};p=await _rpc('ensure_profile',{p_username:meta.username||null,p_display_name:meta.display_name||null});}
    _sbProfile=p;
    _socialMergeProfile(p);
    await socialFlush(true);
    await _socialClaimReward();
    _socialHandleInvite();
  }catch(e){console.warn('[social] connexion',e);_sbAfterFor=null;}
  if(typeof gamRefreshUI==='function')gamRefreshUI();
  _socialUpdateBadges();
  if(document.body.dataset.screen==='social')renderSocial();
}
function _socialOnLogout(){
  Object.assign(_soc,{lb:null,champs:null,friends:null,courses:null,inbox:null,mine:null});
  if(typeof gamRefreshUI==='function')gamRefreshUI();
  _socialUpdateBadges();
  if(document.body.dataset.screen==='social')renderSocial();
}

// Au premier login sur un appareil : on reprend le personnage / la maison du compte si rien n'a été personnalisé ici
function _socialMergeProfile(p){
  if(typeof gam==='undefined'||!gam)return;
  let changed=false;
  if(p.avatar&&p.avatar.species&&!gam.charChosen){gam.char=gamNormChar(p.avatar);gam.charChosen=true;changed=true;}
  if(Array.isArray(p.house)&&p.house.length&&!gam.house.modified){
    gam.house.items=p.house.filter(i=>i&&i.type).map(i=>({uid:i.uid||gamUUID().slice(0,8),type:i.type,x:i.x|0,z:i.z|0,rot:(i.rot|0)%4}));
    changed=true;
  }
  if(changed)gamSave();
  if(!localStorage.getItem('kp_firstname')&&p.display_name){localStorage.setItem('kp_firstname',p.display_name);if(typeof updateIdentityPreview==='function')updateIdentityPreview();}
  socialPushProfile(true);
}

// ── Envoi de l'XP gagnée (lots idempotents, cf. gamSealOutbox) ──
let _socialFlushT=null,_socialFlushing=null;
function _socialScheduleFlush(){clearTimeout(_socialFlushT);_socialFlushT=setTimeout(()=>socialFlush(),8000);}
function socialFlush(force){
  if(!socialIsLogged())return Promise.resolve();
  if(_socialFlushing)return _socialFlushing;
  _socialFlushing=(async()=>{
    try{
      const box=gamSealOutbox();
      if(!box.length){
        if(force){const p=await _rpc('get_my_profile');if(p){_sbProfile=p;gamAckOutbox([],p.xp_total,p.week);}}
        return;
      }
      for(let i=0;i<box.length;i+=50){
        const r=await _rpc('submit_activity',{p_batches:box.slice(i,i+50)});
        _sbProfile=r.profile;gamAckOutbox(r.accepted||[],r.profile.xp_total,r.profile.week);
      }
    }catch(e){console.warn('[social] envoi XP',e);}
    finally{_socialFlushing=null;}
  })();
  return _socialFlushing;
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')socialFlush();});

let _socialPushT=null;
function socialPushProfile(now){
  if(!socialIsLogged()||typeof gam==='undefined')return;
  clearTimeout(_socialPushT);
  _socialPushT=setTimeout(async()=>{
    try{
      _sbProfile=await _rpc('update_my_profile',{p:{
        avatar:gam.char,
        house:(gam.house.items||[]).map(i=>({uid:i.uid,type:i.type,x:i.x,z:i.z,rot:i.rot||0})),
        streak:typeof stats!=='undefined'?stats.streak||0:0
      }});
    }catch(e){console.warn('[social] profil',e);}
  },now?0:2500);
}

async function _socialClaimReward(){
  const key='kcu_reward_'+gamWeekKey();
  if(localStorage.getItem(key)===(_sbProfile&&_sbProfile.id))return;
  try{
    const r=await _rpc('claim_weekly_reward');
    localStorage.setItem(key,_sbProfile.id);
    if(r&&r.xp){
      gamAckOutbox([],r.profile.xp_total,r.profile.week);
      setTimeout(()=>{
        _gamToast(`<span class="ms f">emoji_events</span> ${r.rank===1?'1re':r.rank+'e'} place la semaine dernière : +${r.xp} XP !`);
        gamConfetti();
      },1500);
    }
  }catch(e){console.warn('[social] récompense',e);}
}

// ── Liens d'invitation : …?ami=pseudo ──
function socialInviteLink(){
  const p=socialProfile();
  return location.origin+location.pathname+'?ami='+encodeURIComponent(p?p.username:'');
}
function _socialReadInvite(){
  try{
    const u=new URLSearchParams(location.search).get('ami');
    if(u){sessionStorage.setItem('kcu_invite',u.slice(0,30));history.replaceState(null,'',location.pathname+location.hash);}
  }catch(e){}
}
async function _socialHandleInvite(){
  const u=sessionStorage.getItem('kcu_invite');
  if(!u||!socialIsLogged())return;
  sessionStorage.removeItem('kcu_invite');
  if(_sbProfile&&u===_sbProfile.username)return;
  try{
    const r=await _rpc('send_friend_request_by_username',{p_username:u});
    showNotif(r.relation==='friends'?`Tu es maintenant ami·e avec ${_socName(r)} !`:`Demande d’ami envoyée à ${_socName(r)}`,'ok');
  }catch(e){showNotif(e.message,'err');}
}

// =========================================================
// Authentification (modal)
// =========================================================
let _authMode='signup';
function socialOpenAuth(mode){
  if(!socialConfigured()){showScreen('social');return;}
  _authMode=mode||'login';
  socialInit().then(()=>{_socialRenderAuth();openModal('modal-soc-auth');});
}
function _socialRenderAuth(msg,isErr){
  const body=document.getElementById('modal-soc-auth-body');if(!body)return;
  const invite=sessionStorage.getItem('kcu_invite');
  const fn=_socEsc(localStorage.getItem('kp_firstname')||''),promo=_socEsc(localStorage.getItem('kp_promo')||'');
  const note=msg?`<div class="soc-note${isErr?' err':''}">${msg}</div>`:'';
  let form='';
  if(_authMode==='signup')form=`
    <div class="fg2"><label class="fl" for="au-email">E-mail</label><input class="fi" id="au-email" type="email" autocomplete="email" placeholder="toi@exemple.fr"></div>
    <div class="fg2"><label class="fl" for="au-pass">Mot de passe</label><input class="fi" id="au-pass" type="password" autocomplete="new-password" placeholder="6 caractères minimum"></div>
    <div class="soc-row2">
      <div class="fg2"><label class="fl" for="au-user">Pseudo</label><input class="fi" id="au-user" maxlength="20" autocomplete="username" placeholder="ex : elie.k2" oninput="_socialCheckUser(this)"><small class="soc-hint" id="au-user-hint">Tes amis te trouveront avec.</small></div>
      <div class="fg2"><label class="fl" for="au-name">Prénom</label><input class="fi" id="au-name" maxlength="40" value="${fn}" placeholder="Prénom"></div>
    </div>
    <div class="soc-row2">
      ${typeof kcProfSelectHTML==='function'?kcProfSelectHTML():''}
      <div class="fg2"><label class="fl" for="au-promo">Promo (facultatif)</label><input class="fi" id="au-promo" maxlength="24" value="${promo}" placeholder="ex : K2"></div>
    </div>
    <button class="btn btn-p soc-wide" id="au-go" onclick="_socialDoSignup()">Créer mon compte</button>
    <p class="soc-small">Ton XP, ton personnage et ta maison seront sauvegardés sur ton compte. Tes cours restent sur ton appareil, sauf ceux que tu choisis de partager.</p>`;
  else if(_authMode==='login')form=`
    <div class="fg2"><label class="fl" for="au-email">E-mail</label><input class="fi" id="au-email" type="email" autocomplete="email" placeholder="toi@exemple.fr"></div>
    <div class="fg2"><label class="fl" for="au-pass">Mot de passe</label><input class="fi" id="au-pass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')_socialDoLogin()"></div>
    <button class="btn btn-p soc-wide" id="au-go" onclick="_socialDoLogin()">Se connecter</button>
    <button class="soc-link" onclick="_authMode='reset';_socialRenderAuth()">Mot de passe oublié ?</button>`;
  else if(_authMode==='reset')form=`
    <div class="fg2"><label class="fl" for="au-email">E-mail du compte</label><input class="fi" id="au-email" type="email" autocomplete="email"></div>
    <button class="btn btn-p soc-wide" id="au-go" onclick="_socialDoReset()">Recevoir un lien</button>
    <button class="soc-link" onclick="_authMode='login';_socialRenderAuth()">← Retour</button>`;
  else if(_authMode==='newpass')form=`
    <div class="fg2"><label class="fl" for="au-pass">Nouveau mot de passe</label><input class="fi" id="au-pass" type="password" autocomplete="new-password"></div>
    <button class="btn btn-p soc-wide" id="au-go" onclick="_socialDoNewPass()">Enregistrer</button>`;
  body.innerHTML=`
    <div class="soc-auth-head">
      <div class="soc-auth-av">${gamAvatarSVG(gam.char,64)}</div>
      <div><div class="mdttl">${_authMode==='newpass'?'Nouveau mot de passe':_authMode==='reset'?'Mot de passe oublié':'Rejoins ta promo'}</div>
      <div class="mddesc" style="margin:0">${invite?`<b>@${_socEsc(invite)}</b> t’invite à devenir ami·e sur City Work !`:'Ajoute tes amis, compare vos révisions et partagez vos cours.'}</div></div>
    </div>
    ${_authMode==='signup'||_authMode==='login'?`<div class="soc-tabs"><button class="${_authMode==='login'?'on':''}" onclick="_authMode='login';_socialRenderAuth()">Se connecter</button><button class="${_authMode==='signup'?'on':''}" onclick="_authMode='signup';_socialRenderAuth()">Créer un compte</button></div>`:''}
    ${note}${form}`;
}
let _socialUserT=null;
function _socialCheckUser(inp){
  const v=inp.value=inp.value.toLowerCase().replace(/[^a-z0-9_.]/g,'');
  const hint=document.getElementById('au-user-hint');
  clearTimeout(_socialUserT);
  if(v.length<3){hint.textContent='3 caractères minimum (minuscules, chiffres, _ ou .)';hint.className='soc-hint';return;}
  _socialUserT=setTimeout(async()=>{
    try{const ok=await _rpc('username_available',{p_username:v});hint.textContent=ok?'✓ Disponible':'Déjà pris';hint.className='soc-hint '+(ok?'ok':'err');}catch(e){}
  },350);
}
function _authBusy(on){const b=document.getElementById('au-go');if(b){b.disabled=on;b.style.opacity=on?.6:1;}}
async function _socialDoSignup(){
  const email=document.getElementById('au-email').value.trim(),password=document.getElementById('au-pass').value;
  const username=document.getElementById('au-user').value.trim(),display_name=document.getElementById('au-name').value.trim();
  const promo=document.getElementById('au-promo').value.trim();
  if(!email||!password||!username){_socialRenderAuthKeep('Remplis l’e-mail, le mot de passe et le pseudo.',true);return;}
  if(!/^[a-z0-9_.]{3,20}$/.test(username)){_socialRenderAuthKeep('Pseudo : 3 à 20 caractères (minuscules, chiffres, _ ou .).',true);return;}
  _authBusy(true);
  try{
    if(!(await _rpc('username_available',{p_username:username})))throw new Error('Ce pseudo est déjà pris.');
    const {data,error}=await _sb.auth.signUp({email,password,options:{data:{username,display_name:display_name||username,promo,avatar:gam.char},emailRedirectTo:_socRedirect()}});
    if(error)throw _socialErr(error);
    if(display_name)localStorage.setItem('kp_firstname',display_name);
    if(promo)localStorage.setItem('kp_promo',promo);
    if(data.session){closeModal('modal-soc-auth');showNotif('Compte créé, bienvenue !','ok');}
    else{_authMode='login';_socialRenderAuth('Presque fini : clique sur le lien reçu par e-mail pour confirmer ton compte, puis connecte-toi.');}
  }catch(e){_socialRenderAuthKeep(e.message,true);}
  _authBusy(false);
}
// Réaffiche un message sans effacer ce qui a été tapé
function _socialRenderAuthKeep(msg,isErr){
  const vals={};['au-email','au-pass','au-user','au-name','au-promo'].forEach(id=>{const el=document.getElementById(id);if(el)vals[id]=el.value;});
  _socialRenderAuth(_socEsc(msg),isErr);
  Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
}
async function _socialDoLogin(){
  const email=document.getElementById('au-email').value.trim(),password=document.getElementById('au-pass').value;
  if(!email||!password){_socialRenderAuthKeep('E-mail et mot de passe requis.',true);return;}
  _authBusy(true);
  try{const {error}=await _sb.auth.signInWithPassword({email,password});if(error)throw _socialErr(error);closeModal('modal-soc-auth');showNotif('Connecté·e !','ok');}
  catch(e){_socialRenderAuthKeep(e.message,true);}
  _authBusy(false);
}
async function _socialDoReset(){
  const email=document.getElementById('au-email').value.trim();if(!email)return;
  _authBusy(true);
  try{const {error}=await _sb.auth.resetPasswordForEmail(email,{redirectTo:_socRedirect()});if(error)throw _socialErr(error);
    _socialRenderAuth('Si un compte existe pour cette adresse, un lien vient d’être envoyé.');}
  catch(e){_socialRenderAuthKeep(e.message,true);}
  _authBusy(false);
}
async function _socialDoNewPass(){
  const password=document.getElementById('au-pass').value;
  _authBusy(true);
  try{const {error}=await _sb.auth.updateUser({password});if(error)throw _socialErr(error);closeModal('modal-soc-auth');showNotif('Mot de passe modifié','ok');}
  catch(e){_socialRenderAuthKeep(e.message,true);}
  _authBusy(false);
}
async function socialSignOut(){
  if(_socialDemo){_socialDemo=false;renderSocial();return;}
  if(!_sb)return;
  await socialFlush();
  await _sb.auth.signOut();
  showNotif('Déconnecté·e','ok');
}

// =========================================================
// Écran « Amis & classement »
// =========================================================
function renderSocial(){
  const root=document.getElementById('social-root');if(!root)return;
  if(!socialConfigured()&&!_socialDemo){root.innerHTML=_socialSetupHTML();return;}
  if(socialConfigured()&&!_socialDemo&&!socialIsLogged()){
    root.innerHTML=_socialLoggedOutHTML();
    if(!_sbInit)socialInit();
    return;
  }
  root.innerHTML=`
    ${_socialDemo?`<div class="soc-demo-bar"><span class="ms">visibility</span><span><b>Aperçu avec des données d’exemple.</b> Pour jouer avec tes vrais amis, active les comptes (voir le guide dans le dossier <code>supabase</code>).</span><button onclick="socialSignOut()">Quitter l’aperçu</button></div>`:''}
    <div class="soc-top">
      <h1 class="soc-h1">Amis &amp; classement</h1>
      <div class="soc-top-actions">
        <button class="btn btn-sm btn-g" onclick="socialOpenShare()"><span class="ms" style="font-size:16px">share</span> Partager un cours</button>
        <button class="btn btn-sm btn-p" onclick="socialOpenAdd()"><span class="ms" style="font-size:16px">person_add</span> Ajouter des amis</button>
      </div>
    </div>
    <div class="soc-layout">
      <div class="soc-main"><div id="soc-lb"></div><div id="soc-courses"></div></div>
      <aside class="soc-side" id="soc-side"></aside>
    </div>`;
  _socialRenderLB();_socialRenderSide();_socialRenderCourses();
  _socialLoadAll();
}

function _socialSetupHTML(){
  return `
    <div class="soc-setup">
      <div class="soc-setup-art">${['blob','chat','lapin','ours','grenouille','souris'].map((s,i)=>gamAvatarSVG({species:s,color:GAM_COLORS[i].hex},58)).join('')}</div>
      <h1 class="soc-h1">Amis &amp; classement</h1>
      <p>Ajoute tes camarades, compare qui révise le plus chaque semaine, envoie-leur tes cours et visite leur maison.</p>
      <div class="soc-setup-card">
        <div class="fl">Pour l’activer (5 minutes, gratuit)</div>
        <ol>
          <li>Crée un projet sur <b>supabase.com</b>.</li>
          <li>Colle le fichier <code>supabase/schema.sql</code> dans <i>SQL Editor</i> puis clique <i>Run</i>.</li>
          <li>Copie l’URL du projet et la clé <i>publishable</i> (bouton <i>Connect</i>) dans <code>js/config.js</code>.</li>
        </ol>
        <small>Le guide détaillé est dans <code>supabase/GUIDE.md</code>. Tout le reste de l’app continue de marcher sans compte.</small>
      </div>
      <div class="fr" style="justify-content:center;gap:8px;margin-top:16px">
        <button class="btn btn-p" onclick="socialStartDemo()"><span class="ms" style="font-size:17px">visibility</span> Voir un aperçu</button>
        <button class="btn btn-g" onclick="showScreen('friends')">Partage par code (ancien)</button>
      </div>
    </div>`;
}
function _socialLoggedOutHTML(){
  return `
    <div class="soc-setup">
      <div class="soc-setup-art">${gamAvatarSVG(gam.char,96)}</div>
      <h1 class="soc-h1">Rejoins le classement</h1>
      <p>Crée ton compte (ou connecte-toi) pour ajouter tes amis, voir qui révise le plus cette semaine et partager tes cours.</p>
      <div class="fr" style="justify-content:center;gap:8px;margin-top:8px">
        <button class="btn btn-p" onclick="socialOpenAuth('signup')">Créer un compte</button>
        <button class="btn btn-g" onclick="socialOpenAuth('login')">Se connecter</button>
      </div>
      <p class="soc-small" style="margin-top:14px">Ton XP déjà gagnée (${gam.xp.toLocaleString('fr-FR')} XP, niveau ${gamLevelFromXP(gam.xp)}) sera ajoutée à ton compte.</p>
    </div>`;
}
function socialStartDemo(){_socialDemo=true;_demoInit();renderSocial();}

async function _socialLoadAll(){
  if(_soc.loading)return;_soc.loading=true;
  try{
    await socialFlush();
    const [lb,champs,friends,courses,inbox,mine]=await Promise.all([
      _rpc('get_leaderboard',{p_scope:_soc.scope,p_metric:_soc.metric,p_week_offset:0}),
      _rpc('get_champions',{p_week_offset:-1}),
      _rpc('list_friends'),
      _rpc('list_friend_courses',{p_user:null}),
      _rpc('list_inbox'),
      _rpc('list_my_shared_courses')
    ]);
    Object.assign(_soc,{lb,champs,friends,courses,inbox,mine,err:null});
  }catch(e){_soc.err=e.message;}
  _soc.loading=false;
  if(document.body.dataset.screen==='social'){_socialRenderLB();_socialRenderSide();_socialRenderCourses();}
  _socialUpdateBadges();
}
async function _socialReloadLB(){
  try{_soc.lb=await _rpc('get_leaderboard',{p_scope:_soc.scope,p_metric:_soc.metric,p_week_offset:0});_soc.err=null;}catch(e){_soc.err=e.message;}
  _socialRenderLB();
}
function socialSetScope(s){_soc.scope=s;_soc.lb=null;_socialRenderLB();_socialReloadLB();}
function socialSetMetric(m){_soc.metric=m;_soc.lb=null;_socialRenderLB();_socialReloadLB();}

function _socialWeekInfo(){
  const now=new Date(),mon=new Date(now);mon.setHours(0,0,0,0);mon.setDate(mon.getDate()-((mon.getDay()+6)%7));
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  const end=new Date(mon);end.setDate(mon.getDate()+7);
  const left=Math.max(0,end-now),d=Math.floor(left/864e5),h=Math.floor((left%864e5)/36e5);
  const M=typeof AG_MON_SHORT!=='undefined'?AG_MON_SHORT:['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  const label=mon.getMonth()===sun.getMonth()?`Semaine du ${mon.getDate()} au ${sun.getDate()} ${M[sun.getMonth()]}`:`Semaine du ${mon.getDate()} ${M[mon.getMonth()]} au ${sun.getDate()} ${M[sun.getMonth()]}`;
  return {label,left:d?`${d} j ${h} h`:`${h} h ${Math.floor((left%36e5)/6e4)} min`};
}

function _socialRenderLB(){
  const el=document.getElementById('soc-lb');if(!el)return;
  const wi=_socialWeekInfo();
  const rows=(_soc.lb&&_soc.lb.rows)||[];
  const ranked=rows.filter(r=>r.value!=null&&Number(r.value)>0);
  const prizes=_soc.metric==='xp'&&_soc.scope==='all';
  const slot=(r,place)=>`
    <div class="pd pd-${place}${r&&r.is_me?' me':''}" ${r&&!r.is_me?`onclick="socialOpenFriend('${r.id}')"`:''}>
      <div class="pd-av">${r?gamAvatarSVG(r.avatar,place===1?78:64):'<span class="pd-q">?</span>'}</div>
      <div class="pd-name">${r?_socEsc(_socName(r))+(r.is_me?' <small>(toi)</small>':''):'Libre'}</div>
      <div class="pd-val">${r?_socFmt(_soc.metric,r.value):'à prendre !'}</div>
      <div class="pd-block"><span class="pd-rank">${place}</span>${prizes?`<span class="pd-prize"><span class="ms">${place===1?'trophy':'workspace_premium'}</span>+${GAM_PODIUM[place-1]} XP</span>`:''}</div>
    </div>`;
  const podiumIds=new Set(ranked.slice(0,3).map(r=>r.id));
  const rest=rows.filter(r=>!podiumIds.has(r.id));
  const q=gamWeekQuestions(),next=GAM_MILESTONES.find(m=>q<m.q),prev=[...GAM_MILESTONES].reverse().find(m=>q>=m.q);
  const pct=next?Math.round((q-(prev?prev.q:0))*100/(next.q-(prev?prev.q:0))):100;
  const champs=(_soc.champs&&_soc.champs.rows)||[];
  el.innerHTML=`
    <section class="lb-card">
      <div class="lb-rays"></div>
      <div class="lb-head">
        <div>
          <div class="lb-kicker"><span class="ms f">emoji_events</span> Classement de la semaine</div>
          <h2 class="lb-title">Le podium de la promo</h2>
          <div class="lb-sub">${wi.label} · <b>fin dans ${wi.left}</b></div>
        </div>
        <div class="lb-scope" role="tablist">
          <button class="${_soc.scope==='all'?'on':''}" onclick="socialSetScope('all')" role="tab" aria-selected="${_soc.scope==='all'}">Tout le monde</button>
          <button class="${_soc.scope==='friends'?'on':''}" onclick="socialSetScope('friends')" role="tab" aria-selected="${_soc.scope==='friends'}">Mes amis</button>
        </div>
      </div>
      <div class="lb-metrics">${SOCIAL_METRICS.map(m=>`<button class="lb-metric${m.id===_soc.metric?' on':''}" onclick="socialSetMetric('${m.id}')"><span class="ms">${m.icon}</span>${m.name}</button>`).join('')}</div>
      ${_soc.err?`<div class="soc-note err">${_socEsc(_soc.err)} <button class="soc-link" onclick="_socialLoadAll()">Réessayer</button></div>`:''}
      ${!_soc.lb&&!_soc.err?`<div class="lb-loading"><div class="house-spinner"></div></div>`:`
      <div class="lb-podium">${slot(ranked[1],2)}${slot(ranked[0],1)}${slot(ranked[2],3)}</div>
      ${!ranked.length?`<div class="lb-empty">${_soc.metric==='accuracy'?'Il faut au moins 20 questions dans la semaine pour être classé en précision.':'Personne n’a encore révisé cette semaine : à toi l’honneur !'}</div>`:''}
      ${rest.length?`<div class="lb-list">${rest.map(r=>`
        <button class="lb-row${r.is_me?' me':''}" ${r.is_me?'':`onclick="socialOpenFriend('${r.id}')"`}>
          <span class="lb-rank">${r.value==null||Number(r.value)<=0?'–':r.rank}</span>
          <span class="lb-av">${gamAvatarSVG(r.avatar,34)}</span>
          <span class="lb-name"><b>${_socEsc(_socName(r))}${r.is_me?' <small>toi</small>':''}</b><small>Niv. ${r.level}${r.promo?' · '+_socEsc(r.promo):''}</small></span>
          <span class="lb-val">${_socFmt(_soc.metric,r.value)}</span>
        </button>`).join('')}</div>`:''}`}
      <div class="lb-ms-wrap">
        <div class="lb-section">Les paliers de la semaine <small>${q} question${q>1?'s':''} répondue${q>1?'s':''}</small></div>
        <div class="lb-ms">${GAM_MILESTONES.map(m=>`<span class="lb-ms-chip${q>=m.q?' done':''}" title="${m.q} questions dans la semaine"><span class="ms">${q>=m.q?'check_circle':m.icon}</span>${m.name} <b>+${m.xp} XP</b></span>`).join('')}</div>
        ${next?`<div class="lb-ms-next"><span>Encore <b>${next.q-q}</b> questions pour « ${next.name} »</span><div class="gam-bar"><div class="gam-bar-fill" style="width:${pct}%"></div></div></div>`:'<div class="lb-ms-next">Tous les paliers sont atteints cette semaine, bravo !</div>'}
      </div>
      ${champs.length?`<div class="lb-champs"><span>Champions de la semaine dernière :</span>${champs.map((c,i)=>`<span class="lb-champ"><span class="lb-medal m${i+1}">${i+1}</span>${gamAvatarSVG(c.avatar,28)}<b>${_socEsc(_socName(c))}</b><small>${(c.week_xp||0).toLocaleString('fr-FR')} XP</small></span>`).join('')}</div>`:''}
      <details class="lb-how"><summary>Comment ça marche ?</summary>
        <p>Le classement repart à zéro chaque lundi. Chaque réponse rapporte de l’XP (<b>+${GAM_XP.correct}</b> si juste, <b>+${GAM_XP.wrong}</b> sinon), plus des bonus de session, d’objectif du jour et de série. Les bonus (paliers, podium) font monter ton niveau mais ne comptent pas dans le classement.</p>
        <p>Dimanche soir, le podium « Tout le monde » en XP gagne <b>+${GAM_PODIUM[0]}</b>, <b>+${GAM_PODIUM[1]}</b> et <b>+${GAM_PODIUM[2]} XP</b> (versés à la prochaine ouverture de l’app). La précision n’est calculée qu’à partir de 20 questions dans la semaine.</p>
      </details>
    </section>`;
}

function _socialRenderSide(){
  const el=document.getElementById('soc-side');if(!el)return;
  const me=socialProfile();
  const fr=_soc.friends||{friends:[],incoming:[],outgoing:[]};
  const info=gamLevelInfo(gam.xp);
  el.innerHTML=`
    <div class="soc-card soc-me">
      <div class="soc-me-av" onclick="gamOpenCharacter()" title="Personnaliser">${gamAvatarSVG(gam.char,60)}</div>
      <div class="soc-me-txt"><b>${_socEsc(_socName(me))}</b><small>@${_socEsc(me?me.username:'')}${me&&me.promo?' · '+_socEsc(me.promo):''}</small><span>Niveau ${info.level} · ${gam.xp.toLocaleString('fr-FR')} XP</span></div>
      <button class="soc-icon" onclick="socialOpenEdit()" aria-label="Modifier mon profil" title="Modifier mon profil"><span class="ms">edit</span></button>
    </div>
    <button class="soc-invite" onclick="socialCopyInvite()"><span class="ms">link</span><span><b>Mon lien d’invitation</b><small>Envoie-le à ta promo : ils t’ajoutent en un clic</small></span><span class="ms">content_copy</span></button>
    ${fr.incoming.length?`<div class="soc-card"><div class="soc-card-title">Demandes reçues <span class="soc-pill">${fr.incoming.length}</span></div>
      ${fr.incoming.map(p=>`<div class="soc-friend">
        <span class="soc-friend-av">${gamAvatarSVG(p.avatar,38)}</span>
        <span class="soc-friend-txt"><b>${_socEsc(_socName(p))}</b><small>@${_socEsc(p.username)} · niv. ${p.level}</small></span>
        <button class="soc-ok" onclick="socialRespond('${p.id}',true)" aria-label="Accepter"><span class="ms">check</span></button>
        <button class="soc-no" onclick="socialRespond('${p.id}',false)" aria-label="Refuser"><span class="ms">close</span></button>
      </div>`).join('')}</div>`:''}
    <div class="soc-card">
      <div class="soc-card-title">Amis <span class="soc-pill">${fr.friends.length}</span><button class="soc-link" onclick="socialOpenAdd()">+ Ajouter</button></div>
      ${!_soc.friends?'<div class="lb-loading small"><div class="house-spinner"></div></div>':fr.friends.length?fr.friends.map(p=>`
        <button class="soc-friend" onclick="socialOpenFriend('${p.id}')">
          <span class="soc-friend-av">${gamAvatarSVG(p.avatar,38)}</span>
          <span class="soc-friend-txt"><b>${_socEsc(_socName(p))}</b><small>Niv. ${p.level} · ${(p.week&&p.week.xp||0).toLocaleString('fr-FR')} XP cette semaine</small></span>
          <span class="ms soc-chev">chevron_right</span>
        </button>`).join(''):`<p class="soc-empty">Pas encore d’amis. Ajoute tes camarades pour les défier !</p><button class="btn btn-sm btn-g soc-wide" onclick="socialOpenAdd()"><span class="ms" style="font-size:16px">person_add</span> Ajouter des amis</button>`}
    </div>
    ${fr.outgoing.length?`<div class="soc-card"><div class="soc-card-title">Demandes envoyées</div>
      ${fr.outgoing.map(p=>`<div class="soc-friend">
        <span class="soc-friend-av">${gamAvatarSVG(p.avatar,32)}</span>
        <span class="soc-friend-txt"><b>${_socEsc(_socName(p))}</b><small>en attente</small></span>
        <button class="soc-no" onclick="socialRemove('${p.id}')" aria-label="Annuler" title="Annuler la demande"><span class="ms">close</span></button>
      </div>`).join('')}</div>`:''}
    ${_socialDemo?'':`<button class="soc-logout" onclick="socialSignOut()"><span class="ms">logout</span> Se déconnecter</button>`}`;
}

function _socialRenderCourses(){
  const el=document.getElementById('soc-courses');if(!el)return;
  const unseen=(_soc.inbox||[]).filter(x=>!x.seen).length;
  const tab=_soc.ctab;
  let list='';
  const card=(c,extra,from)=>`
    <div class="sc-card">
      <div class="sc-ic"><span class="ms">menu_book</span></div>
      <div class="sc-txt">
        <b>${_socEsc(c.title)}</b>
        <small>${c.subject?_socEsc(c.subject)+' · ':''}${c.question_count} question${c.question_count>1?'s':''}${c.has_fiche?' · fiche':''}</small>
        ${from?`<span class="sc-from">${gamAvatarSVG(from.avatar,20)}${_socEsc(_socName(from))}</span>`:''}
      </div>
      <div class="sc-actions">${extra}</div>
    </div>`;
  if(tab==='amis'){
    const cs=_soc.courses;
    list=!cs?'<div class="lb-loading small"><div class="house-spinner"></div></div>':cs.length?cs.map(c=>card(c,`<button class="btn btn-sm btn-p" onclick="socialOpenCourse('${c.id}')">Voir</button>`,c.owner)).join('')
      :`<p class="soc-empty">Tes amis n’ont pas encore partagé de cours. Montre l’exemple avec « Partager un cours » !</p>`;
  }else if(tab==='recus'){
    const ib=_soc.inbox;
    list=!ib?'<div class="lb-loading small"><div class="house-spinner"></div></div>':ib.length?ib.map(x=>`
      <div class="sc-inbox${x.seen?'':' new'}">
        ${card(x.course,`<button class="btn btn-sm btn-p" onclick="socialOpenCourse('${x.course.id}','${x.id}')">Voir</button><button class="soc-icon" onclick="socialDeleteInbox('${x.id}')" aria-label="Supprimer"><span class="ms">delete</span></button>`,x.sender)}
        ${x.message?`<div class="sc-msg"><span class="ms">chat_bubble</span>${_socEsc(x.message)}</div>`:''}
      </div>`).join(''):`<p class="soc-empty">Aucun cours reçu pour l’instant.</p>`;
  }else{
    const mine=_soc.mine;
    list=!mine?'<div class="lb-loading small"><div class="house-spinner"></div></div>':mine.length?mine.map(c=>card(c,`
      <select class="fi sc-vis" onchange="socialSetVisibility('${c.id}',this.value)" aria-label="Visibilité">${Object.entries(SOCIAL_VIS).map(([k,v])=>`<option value="${k}" ${c.visibility===k?'selected':''}>${v.name}</option>`).join('')}</select>
      <button class="soc-icon" onclick="socialUnshare('${c.id}')" aria-label="Ne plus partager" title="Ne plus partager"><span class="ms">delete</span></button>`)).join('')
      :`<p class="soc-empty">Tu n’as encore partagé aucun cours.</p>`;
  }
  el.innerHTML=`
    <section class="soc-card sc-wrap">
      <div class="sc-head">
        <h2 class="sc-title">Cours partagés</h2>
        <button class="btn btn-sm btn-g" onclick="socialOpenShare()"><span class="ms" style="font-size:16px">share</span> Partager un cours</button>
      </div>
      <div class="soc-tabs">
        <button class="${tab==='amis'?'on':''}" onclick="_soc.ctab='amis';_socialRenderCourses()">De mes amis</button>
        <button class="${tab==='recus'?'on':''}" onclick="_soc.ctab='recus';_socialRenderCourses();_socialMarkSeen()">Reçus${unseen?` <span class="soc-pill hot">${unseen}</span>`:''}</button>
        <button class="${tab==='mine'?'on':''}" onclick="_soc.ctab='mine';_socialRenderCourses()">Mes partages</button>
      </div>
      <div class="sc-list">${list}</div>
    </section>`;
}
async function _socialMarkSeen(){
  const ids=(_soc.inbox||[]).filter(x=>!x.seen).map(x=>x.id);if(!ids.length)return;
  try{await _rpc('mark_inbox_seen',{p_ids:ids});_soc.inbox.forEach(x=>x.seen=true);_socialUpdateBadges();}catch(e){}
}
function _socialUpdateBadges(){
  const n=((_soc.friends&&_soc.friends.incoming.length)||0)+((_soc.inbox||[]).filter(x=>!x.seen).length);
  const b=document.getElementById('dl-social-badge');
  if(b){b.style.display=n&&!_socialDemo?'':'none';b.textContent=n;}
}

// ── Actions amis ──
async function socialRespond(id,accept){
  try{await _rpc('respond_friend_request',{p_requester:id,p_accept:accept});showNotif(accept?'Vous êtes maintenant amis !':'Demande refusée','ok');}catch(e){showNotif(e.message,'err');}
  _socialLoadAll();
}
async function socialRemove(id){
  try{await _rpc('remove_friend',{p_other:id});}catch(e){showNotif(e.message,'err');}
  closeModal('modal-soc-friend');_socialLoadAll();
}
function socialCopyInvite(){
  const link=socialInviteLink();
  const done=()=>showNotif('Lien copié ! Colle-le dans le groupe de ta promo.','ok');
  if(navigator.share&&/Mobi|Android|iPhone/i.test(navigator.userAgent)){navigator.share({title:'City Work',text:'Ajoute-moi sur City Work !',url:link}).catch(()=>{});return;}
  if(navigator.clipboard)navigator.clipboard.writeText(link).then(done,()=>kcPrompt('Copie ce lien',link));else kcPrompt('Copie ce lien',link);
}

// ── Modal : ajouter des amis ──
let _socialSearchT=null;
function socialOpenAdd(){
  const body=document.getElementById('modal-soc-add-body');if(!body)return;
  body.innerHTML=`
    <div class="mdttl">Ajouter des amis</div>
    <div class="mddesc">Cherche un pseudo ou un prénom, ou envoie ton lien d’invitation.</div>
    <div class="soc-search"><span class="ms">search</span><input class="fi" id="soc-q" placeholder="ex : lea, @hugo.k2…" oninput="_socialSearch(this.value)" autocomplete="off"></div>
    <div id="soc-results" class="soc-results"><p class="soc-empty">Tape au moins 2 lettres.</p></div>
    <div class="soc-invite-box">
      <div class="fl">Ton lien d’invitation</div>
      <div class="soc-invite-row"><input class="fi" readonly value="${_socEsc(socialInviteLink())}" onclick="this.select()"><button class="btn btn-sm btn-p" onclick="socialCopyInvite()">Copier</button></div>
    </div>
    <div class="fr" style="margin-top:14px"><button class="btn btn-g" onclick="closeModal('modal-soc-add')">Fermer</button></div>`;
  openModal('modal-soc-add');
  setTimeout(()=>{const q=document.getElementById('soc-q');if(q)q.focus();},80);
}
function _socialSearch(v){
  clearTimeout(_socialSearchT);
  const box=document.getElementById('soc-results');
  if(v.trim().replace('@','').length<2){box.innerHTML='<p class="soc-empty">Tape au moins 2 lettres.</p>';return;}
  _socialSearchT=setTimeout(async()=>{
    try{
      const res=await _rpc('search_profiles',{p_query:v});
      box.innerHTML=res.length?res.map(p=>`
        <div class="soc-friend">
          <span class="soc-friend-av">${gamAvatarSVG(p.avatar,38)}</span>
          <span class="soc-friend-txt"><b>${_socEsc(_socName(p))}</b><small>@${_socEsc(p.username)} · niv. ${p.level}${p.promo?' · '+_socEsc(p.promo):''}</small></span>
          ${_socialRelBtn(p)}
        </div>`).join(''):'<p class="soc-empty">Personne trouvé. Vérifie le pseudo, ou envoie ton lien d’invitation.</p>';
    }catch(e){box.innerHTML=`<p class="soc-empty">${_socEsc(e.message)}</p>`;}
  },300);
}
function _socialRelBtn(p){
  if(p.relation==='friends')return '<span class="soc-rel ok"><span class="ms">check</span>Amis</span>';
  if(p.relation==='outgoing')return '<span class="soc-rel">Demande envoyée</span>';
  if(p.relation==='incoming')return `<button class="btn btn-sm btn-p" onclick="socialRespond('${p.id}',true);this.outerHTML='<span class=&quot;soc-rel ok&quot;>Amis</span>'">Accepter</button>`;
  return `<button class="btn btn-sm btn-p" onclick="socialAdd('${p.id}',this)"><span class="ms" style="font-size:15px">person_add</span>Ajouter</button>`;
}
async function socialAdd(id,btn){
  if(btn)btn.disabled=true;
  try{
    const rel=await _rpc('send_friend_request',{p_target:id});
    if(btn)btn.outerHTML=rel==='friends'?'<span class="soc-rel ok"><span class="ms">check</span>Amis</span>':'<span class="soc-rel">Demande envoyée</span>';
    _socialLoadAll();
  }catch(e){showNotif(e.message,'err');if(btn)btn.disabled=false;}
}

// ── Modal : profil d'un ami ──
async function socialOpenFriend(id){
  const body=document.getElementById('modal-soc-friend-body');if(!body)return;
  body.innerHTML='<div class="lb-loading"><div class="house-spinner"></div></div>';
  openModal('modal-soc-friend');
  try{
    const [p,courses]=await Promise.all([_rpc('get_user_profile',{p_user:id}),_rpc('list_friend_courses',{p_user:id})]);
    if(!p)throw new Error('Profil introuvable.');
    const w=p.week||{};
    body.innerHTML=`
      <div class="sf-head">
        <div class="sf-av">${gamAvatarSVG(p.avatar,96)}</div>
        <div>
          <div class="mdttl" style="margin:0">${_socEsc(_socName(p))}</div>
          <div class="sf-user">@${_socEsc(p.username)}${p.promo?' · '+_socEsc(p.promo):''}</div>
          <div class="sf-level">Niveau <b>${p.level}</b> · <span class="ms f" style="font-size:15px;color:#f97316;vertical-align:-2px">local_fire_department</span> ${p.streak||0} j</div>
        </div>
      </div>
      <div class="gm-stats">
        <div><b>${(w.xp||0).toLocaleString('fr-FR')}</b><span>XP cette semaine</span></div>
        <div><b>${w.q||0}</b><span>questions</span></div>
        <div><b>${_socDur(w.s||0)}</b><span>de révision</span></div>
      </div>
      <div class="fr" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
        ${p.is_friend&&Array.isArray(p.house)?`<button class="btn btn-sm btn-p" onclick="socialVisit('${p.id}')"><span class="ms" style="font-size:16px">cottage</span> Visiter sa maison</button>`:''}
        ${p.is_friend?`<button class="btn btn-sm btn-g" onclick="closeModal('modal-soc-friend');socialOpenShare(null,'${p.id}')"><span class="ms" style="font-size:16px">send</span> Envoyer un cours</button>`
          :`<button class="btn btn-sm btn-p" onclick="socialAdd('${p.id}',this)"><span class="ms" style="font-size:16px">person_add</span> Ajouter</button>`}
      </div>
      <div class="fl">Ses cours partagés</div>
      <div class="sc-list">${courses.length?courses.map(c=>`
        <div class="sc-card"><div class="sc-ic"><span class="ms">menu_book</span></div>
          <div class="sc-txt"><b>${_socEsc(c.title)}</b><small>${c.subject?_socEsc(c.subject)+' · ':''}${c.question_count} questions${c.has_fiche?' · fiche':''}</small></div>
          <div class="sc-actions"><button class="btn btn-sm btn-p" onclick="socialOpenCourse('${c.id}')">Voir</button></div></div>`).join('')
        :'<p class="soc-empty">Aucun cours partagé.</p>'}</div>
      <div class="fr" style="margin-top:16px;justify-content:space-between">
        ${p.is_friend?`<button class="soc-link danger" onclick="kcConfirm('Retirer ${_socEsc(_socName(p).replace(/'/g,'’'))} de tes amis ?',{ok:'Retirer',danger:true}).then(ok=>{if(ok)socialRemove('${p.id}')})">Retirer de mes amis</button>`:'<span></span>'}
        <button class="btn btn-g" onclick="closeModal('modal-soc-friend')">Fermer</button>
      </div>`;
    body.dataset.house=JSON.stringify({name:_socName(p),level:p.level,char:p.avatar,items:p.house||[]});
  }catch(e){body.innerHTML=`<p class="soc-empty">${_socEsc(e.message)}</p><div class="fr"><button class="btn btn-g" onclick="closeModal('modal-soc-friend')">Fermer</button></div>`;}
}
function socialVisit(){
  const body=document.getElementById('modal-soc-friend-body');
  let o=null;try{o=JSON.parse(body.dataset.house||'null');}catch(e){}
  if(!o)return;
  closeModal('modal-soc-friend');
  o.char=gamNormChar(o.char);
  o.items=(o.items||[]).filter(i=>i&&GAM_FURNITURE.some(f=>f.id===i.type)).map(i=>({uid:i.uid||Math.random().toString(36).slice(2,10),type:i.type,x:i.x|0,z:i.z|0,rot:(i.rot|0)%4}));
  gamVisitHouse(o);
}

// ── Modal : profil (pseudo, prénom, promo) ──
function socialOpenEdit(){
  const me=socialProfile();if(!me)return;
  const body=document.getElementById('modal-soc-friend-body');
  body.innerHTML=`
    <div class="mdttl">Mon profil public</div>
    <div class="mddesc">C’est ce que voient tes amis et la promo dans le classement.</div>
    <div class="fg2"><label class="fl" for="pe-user">Pseudo</label><input class="fi" id="pe-user" maxlength="20" value="${_socEsc(me.username)}" oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9_.]/g,'')"></div>
    <div class="fg2"><label class="fl" for="pe-name">Prénom</label><input class="fi" id="pe-name" maxlength="40" value="${_socEsc(me.display_name)}"></div>
    <div class="fg2"><label class="fl" for="pe-promo">Promo</label><input class="fi" id="pe-promo" maxlength="24" value="${_socEsc(me.promo||'')}"></div>
    <div class="fr" style="gap:8px;margin-top:8px"><button class="btn btn-p" onclick="_socialSaveEdit()">Enregistrer</button><button class="btn btn-g" onclick="closeModal('modal-soc-friend')">Annuler</button></div>`;
  openModal('modal-soc-friend');
}
async function _socialSaveEdit(){
  const p={username:document.getElementById('pe-user').value.trim(),display_name:document.getElementById('pe-name').value.trim(),promo:document.getElementById('pe-promo').value.trim()};
  try{
    const r=await _rpc('update_my_profile',{p});
    if(!_socialDemo)_sbProfile=r;
    if(p.display_name){localStorage.setItem('kp_firstname',p.display_name);if(typeof loadIdentity==='function')loadIdentity();}
    localStorage.setItem('kp_promo',p.promo);
    closeModal('modal-soc-friend');showNotif('Profil mis à jour','ok');
    _socialRenderSide();if(typeof gamRefreshUI==='function')gamRefreshUI();
  }catch(e){showNotif(e.message,'err');}
}

// =========================================================
// Partage de cours
// =========================================================
function _socialCoursePayload(courseId){
  const c=courses.find(x=>x.id===courseId);if(!c)return null;
  const f=folders.find(x=>x.id===c.folderId);
  const qs=questions.filter(q=>q.courseId===courseId&&!(typeof isBoycotted==='function'&&isBoycotted(q.id)))
    .map(q=>({question:q.question,answers:q.answers,correct:q.correct,expl:q.expl||''}));
  const fiche=(typeof getFiche==='function'&&getFiche(courseId)||{}).content||'';
  const fcs=(typeof getFlashcardsForCourse==='function'?getFlashcardsForCourse(courseId):[]).map(x=>({term:x.term,definition:x.definition,keywords:x.keywords||[]}));
  return {v:1,course:{name:c.name},subject:{name:f?f.name:'',color:f?f.color:null},questions:qs,fiche,flashcards:fcs};
}
let _shareSel=null;
function socialOpenShare(courseId,toFriend){
  if(!socialIsLogged()&&!_socialDemo){
    if(socialConfigured())socialOpenAuth('signup');
    else{showScreen('social');showNotif('Active d’abord les comptes pour partager tes cours.','err');}
    return;
  }
  _shareSel={courseId:courseId||(typeof curC!=='undefined'&&document.body.dataset.screen==='course'?curC:null),vis:'friends',to:new Set(toFriend?[toFriend]:[])};
  _socialRenderShare();
  openModal('modal-soc-share');
  if(!_soc.friends)_rpc('list_friends').then(fr=>{_soc.friends=fr;_socialRenderShare();}).catch(()=>{});
  if(!_soc.mine)_rpc('list_my_shared_courses').then(m=>{_soc.mine=m;_socialRenderShare();}).catch(()=>{});
}
/* 15 nov. 2026 : partager un DOSSIER entier (tous ses cours) — même table shared_courses, payload {v:2, kind:'folder', courses:[…]} */
function socialOpenShareFolder(sfId){
  if(!socialIsLogged()&&!_socialDemo){
    if(socialConfigured())socialOpenAuth('signup');
    else{showScreen('social');showNotif('Active d’abord les comptes pour partager tes dossiers.','err');}
    return;
  }
  if(String(sfId||'').startsWith('mat:')){
    const fid=sfId.slice(4);
    if(!folders.some(x=>x.id===fid)){showNotif('Matière introuvable','err');return;}
    _shareSel={matId:fid,vis:'friends',to:new Set()};
  }else{
    if(!sfId||!subFolders.some(x=>x.id===sfId)){showNotif('Dossier introuvable','err');return;}
    _shareSel={sfId,vis:'friends',to:new Set()};
  }
  _socialRenderShare();
  openModal('modal-soc-share');
  if(!_soc.friends)_rpc('list_friends').then(fr=>{_soc.friends=fr;_socialRenderShare();}).catch(()=>{});
  if(!_soc.mine)_rpc('list_my_shared_courses').then(m=>{_soc.mine=m;_socialRenderShare();}).catch(()=>{});
}
function _socialFolderPayload(sfId){
  const sf=subFolders.find(x=>x.id===sfId);if(!sf)return null;
  const f=folders.find(x=>x.id===sf.folderId);
  const all=[],cs=[];
  courses.filter(c=>c.subFolderId===sfId).forEach(c=>{
    const p=_socialCoursePayload(c.id);if(!p)return;
    const start=all.length;all.push(...p.questions);
    cs.push({name:c.name,q:[start,all.length],fiche:p.fiche,flashcards:p.flashcards});
  });
  return {v:2,kind:'folder',folder:{name:sf.name},course:{name:sf.name},subject:{name:f?f.name:'',color:f?f.color:null},questions:all,fiche:'',flashcards:[],courses:cs};
}
/* v63 : partager une MATIÈRE entière (ses dossiers + cours) — payload {v:3, kind:'subject', courses:[{name, sub, q, fiche, flashcards}]} */
function _socialSubjectPayload(fid){
  const f=folders.find(x=>x.id===fid);if(!f)return null;
  const all=[],cs=[];
  courses.filter(c=>c.folderId===fid).forEach(c=>{
    const p=_socialCoursePayload(c.id);if(!p)return;
    const sf=c.subFolderId?subFolders.find(x=>x.id===c.subFolderId):null;
    const start=all.length;all.push(...p.questions);
    cs.push({name:c.name,sub:sf?sf.name:null,q:[start,all.length],fiche:p.fiche,flashcards:p.flashcards});
  });
  return {v:3,kind:'subject',folder:{name:f.name},course:{name:f.name},subject:{name:f.name,color:f.color||null},questions:all,fiche:'',flashcards:[],courses:cs};
}
function _socialShareTarget(s){
  if(s.matId){const f=folders.find(x=>x.id===s.matId);if(!f)return null;
    const cs=courses.filter(c=>c.folderId===f.id);
    return {kind:'subject',id:'mt_'+f.id,name:f.name,cs,nsf:subFolders.filter(x=>x.folderId===f.id).length};}
  const sf=subFolders.find(x=>x.id===s.sfId);if(!sf)return null;
  return {kind:'folder',id:'sf_'+sf.id,name:sf.name,cs:courses.filter(c=>c.subFolderId===sf.id),nsf:0};
}
function _socialRenderShareFolder(body,s){
  const T=_socialShareTarget(s),isM=T&&T.kind==='subject';
  const cs=T?T.cs:[];
  const ids=new Set(cs.map(c=>c.id));
  const nq=questions.filter(q=>ids.has(q.courseId)).length;
  const already=T&&(_soc.mine||[]).find(m=>m.client_id===T.id);
  const friends=(_soc.friends&&_soc.friends.friends)||[];
  body.innerHTML=`
    <div class="mdttl">Partager ${isM?'une matière':'un dossier'}</div>
    <div class="mddesc">Tes amis pourront importer ${isM?'toute la matière : ses dossiers, ':'tout le dossier : '}ses ${cs.length} cours, leurs questions, fiches et flashcards.</div>
    <div class="sh-folder"><span class="ms">${isM?'school':'folder'}</span><div><b>${_socEsc(T?T.name:'')}</b><small>${isM&&T.nsf?T.nsf+' dossier'+(T.nsf>1?'s':'')+' · ':''}${cs.length} cours · ${nq} question${nq!==1?'s':''}</small></div></div>
    ${already?`<small class="soc-hint ok">Déjà partagé : il sera mis à jour avec ta dernière version.</small>`:''}
    <div class="fl">Qui peut le voir ?</div>
    <div class="sh-vis">${Object.entries(SOCIAL_VIS).map(([k,v])=>`<button class="sh-vis-opt${s.vis===k?' on':''}" onclick="_shareSel.vis='${k}';_socialRenderShare()"><span class="ms">${v.icon}</span><b>${v.name}</b><small>${v.desc}</small></button>`).join('')}</div>
    <div class="fl" style="margin-top:14px">Envoyer directement à…</div>
    <div class="sh-friends">${friends.length?friends.map(f=>`<button class="sh-friend${s.to.has(f.id)?' on':''}" onclick="_shareToggle('${f.id}')">${gamAvatarSVG(f.avatar,28)}${_socEsc(_socName(f))}${s.to.has(f.id)?'<span class="ms">check</span>':''}</button>`).join(''):'<span class="soc-empty">Ajoute des amis pour leur envoyer tes dossiers.</span>'}</div>
    ${s.to.size?`<input class="fi" id="sh-msg" maxlength="280" placeholder="Petit message (facultatif)" style="margin-top:10px">`:''}
    <div class="fr" style="gap:8px;margin-top:18px">
      <button class="btn btn-p" id="sh-go" ${nq?'':'disabled'} onclick="socialDoShare()"><span class="ms" style="font-size:16px">${s.to.size?'send':'share'}</span> ${s.to.size?'Partager et envoyer':already?'Mettre à jour':isM?'Partager la matière':'Partager le dossier'}</button>
      <button class="btn btn-g" onclick="closeModal('modal-soc-share')">Annuler</button>
    </div>
    ${!nq?`<small class="soc-hint err">${isM?'Cette matière':'Ce dossier'} n’a pas encore de questions.</small>`:''}`;
}
function _socialRenderShare(){
  const body=document.getElementById('modal-soc-share-body');if(!body||!_shareSel)return;
  const s=_shareSel;
  if(s.sfId||s.matId)return _socialRenderShareFolder(body,s);
  const regular=folders.filter(f=>f.type!=='annales'&&!(typeof isFolderArchived==='function'&&isFolderArchived(f.id)));
  const c=s.courseId?courses.find(x=>x.id===s.courseId):null;
  const already=c&&(_soc.mine||[]).find(m=>m.client_id===c.id);
  const friends=(_soc.friends&&_soc.friends.friends)||[];
  const nq=c?questions.filter(q=>q.courseId===c.id).length:0;
  body.innerHTML=`
    <div class="mdttl">Partager un cours</div>
    <div class="mddesc">Tes amis pourront l’importer dans leurs matières (questions, fiche et flashcards).</div>
    <div class="fg2"><label class="fl" for="sh-course">Cours</label>
      <select class="fi" id="sh-course" onchange="_shareSel.courseId=this.value;_socialRenderShare()">
        <option value="">— Choisis un cours —</option>
        ${regular.map(f=>{const cs=courses.filter(x=>x.folderId===f.id);return cs.length?`<optgroup label="${_socEsc(f.name)}">${cs.map(x=>`<option value="${x.id}" ${x.id===s.courseId?'selected':''}>${_socEsc(x.name)} (${questions.filter(q=>q.courseId===x.id).length} q.)</option>`).join('')}</optgroup>`:'';}).join('')}
      </select>
      ${already?`<small class="soc-hint ok">Déjà partagé — il sera mis à jour avec ta dernière version.</small>`:''}
    </div>
    <div class="fl">Qui peut le voir ?</div>
    <div class="sh-vis">${Object.entries(SOCIAL_VIS).map(([k,v])=>`<button class="sh-vis-opt${s.vis===k?' on':''}" onclick="_shareSel.vis='${k}';_socialRenderShare()"><span class="ms">${v.icon}</span><b>${v.name}</b><small>${v.desc}</small></button>`).join('')}</div>
    <div class="fl" style="margin-top:14px">Envoyer directement à…</div>
    <div class="sh-friends">${friends.length?friends.map(f=>`<button class="sh-friend${s.to.has(f.id)?' on':''}" onclick="_shareToggle('${f.id}')">${gamAvatarSVG(f.avatar,28)}${_socEsc(_socName(f))}${s.to.has(f.id)?'<span class="ms">check</span>':''}</button>`).join(''):'<span class="soc-empty">Ajoute des amis pour leur envoyer tes cours.</span>'}</div>
    ${s.to.size?`<input class="fi" id="sh-msg" maxlength="280" placeholder="Petit message (facultatif)" style="margin-top:10px">`:''}
    <div class="fr" style="gap:8px;margin-top:18px">
      <button class="btn btn-p" id="sh-go" ${c&&nq?'':'disabled'} onclick="socialDoShare()"><span class="ms" style="font-size:16px">${s.to.size?'send':'share'}</span> ${s.to.size?'Partager et envoyer':already?'Mettre à jour':'Partager'}</button>
      <button class="btn btn-g" onclick="closeModal('modal-soc-share')">Annuler</button>
    </div>
    ${c&&!nq?'<small class="soc-hint err">Ce cours n’a pas encore de questions.</small>':''}`;
}
function _shareToggle(id){const msg=document.getElementById('sh-msg');const keep=msg?msg.value:'';if(_shareSel.to.has(id))_shareSel.to.delete(id);else _shareSel.to.add(id);_socialRenderShare();const m2=document.getElementById('sh-msg');if(m2)m2.value=keep;}
async function socialDoShare(){
  const s=_shareSel;if(!s||(!s.courseId&&!s.sfId&&!s.matId))return;
  const isF=!!(s.sfId||s.matId),T=isF?_socialShareTarget(s):null;
  if(isF&&!T)return;
  const c=isF?{id:T.id,name:T.name}:courses.find(x=>x.id===s.courseId),payload=s.matId?_socialSubjectPayload(s.matId):isF?_socialFolderPayload(s.sfId):_socialCoursePayload(s.courseId);
  if(!c||!payload)return;
  const btn=document.getElementById('sh-go');if(btn)btn.disabled=true;
  try{
    if(JSON.stringify(payload).length>1900000)throw new Error('Ce dossier est trop gros pour être partagé d’un coup (images ou très nombreuses questions) : partage ses cours un par un.');
    const card=await _rpc('publish_course',{p_client_id:c.id,p_title:c.name,p_subject:payload.subject.name,p_visibility:s.vis,p_payload:payload});
    let sent=0;
    if(s.to.size){const msg=document.getElementById('sh-msg');sent=await _rpc('send_course',{p_course_id:card.id,p_recipients:[...s.to],p_message:msg?msg.value.trim():''});}
    closeModal('modal-soc-share');
    const what=s.matId?'Matière partagée':isF?'Dossier partagé':'Cours partagé';
    showNotif(sent?`${what} et envoyé à ${sent} ami${sent>1?'s':''} !`:what+' !','ok');
    _soc.mine=null;if(document.body.dataset.screen==='social')_socialLoadAll();
  }catch(e){showNotif(e.message,'err');if(btn)btn.disabled=false;}
}
async function socialSetVisibility(id,v){
  try{await _rpc('set_course_visibility',{p_id:id,p_visibility:v});showNotif('Visibilité : '+SOCIAL_VIS[v].name,'ok');}catch(e){showNotif(e.message,'err');}
}
async function socialUnshare(id){
  if(!(await kcConfirm('Ne plus partager ce cours ? Tes amis qui l’ont déjà importé le gardent.')))return;
  try{await _rpc('delete_shared_course',{p_id:id});_soc.mine=(_soc.mine||[]).filter(c=>c.id!==id);_socialRenderCourses();}catch(e){showNotif(e.message,'err');}
}
async function socialDeleteInbox(id){
  try{await _rpc('delete_inbox_item',{p_id:id});_soc.inbox=(_soc.inbox||[]).filter(x=>x.id!==id);_socialRenderCourses();_socialUpdateBadges();}catch(e){showNotif(e.message,'err');}
}

// ── Aperçu d'un cours partagé + import ──
let _socCourse=null;
async function socialOpenCourse(id,inboxId){
  const body=document.getElementById('modal-soc-course-body');if(!body)return;
  body.innerHTML='<div class="lb-loading"><div class="house-spinner"></div></div>';
  openModal('modal-soc-course');
  if(inboxId)_rpc('mark_inbox_seen',{p_ids:[inboxId]}).then(()=>{const x=(_soc.inbox||[]).find(i=>i.id===inboxId);if(x)x.seen=true;_socialUpdateBadges();}).catch(()=>{});
  try{
    const c=await _rpc('get_shared_course',{p_id:id});_socCourse=c;
    const p=c.payload||{},qs=p.questions||[];
    const already=courses.some(x=>x.sharedFrom===c.id)||subFolders.some(x=>x.sharedFrom===c.id)||folders.some(x=>x.sharedFrom===c.id);
    body.innerHTML=`
      <div class="scm-head">
        <div class="sc-ic big"><span class="ms">${p.kind==='subject'?'school':p.kind==='folder'?'folder':'menu_book'}</span></div>
        <div style="min-width:0"><div class="mdttl" style="margin:0">${_socEsc(c.title)}</div>
          <div class="sc-from">${gamAvatarSVG(c.owner&&c.owner.avatar,22)}Partagé par ${_socEsc(_socName(c.owner))}${c.subject?' · '+_socEsc(c.subject):''}</div></div>
      </div>
      <div class="scm-stats">
        ${Array.isArray(p.courses)?`<span><b>${p.courses.length}</b> cours</span>`:''}<span><b>${qs.length}</b> questions</span>
        <span><b>${Array.isArray(p.courses)?p.courses.reduce((n,x)=>n+((x.flashcards||[]).length),0):(p.flashcards||[]).length}</b> flashcards</span>
        <span>${p.fiche?'<b>Fiche</b> incluse':'Pas de fiche'}</span>
      </div>
      ${qs.length?`<div class="fl">Aperçu</div><div class="scm-qs">${qs.slice(0,3).map((q,i)=>`<div class="scm-q"><b>${i+1}. ${_socEsc(String(q.question).slice(0,180))}</b><small>✓ ${_socEsc(String((q.answers||[])[q.correct]||'').slice(0,120))}</small></div>`).join('')}${qs.length>3?`<div class="soc-empty">… et ${qs.length-3} autres</div>`:''}</div>`:''}
      ${already?'<div class="soc-note">Tu as déjà importé ce cours : l’importer à nouveau mettra à jour ta copie.</div>':''}
      <div class="fr" style="gap:8px;margin-top:16px">
        <button class="btn btn-p" onclick="socialImportCourse()"><span class="ms" style="font-size:16px">download</span> ${already?'Mettre à jour ma copie':p.kind==='subject'?'Importer la matière':p.kind==='folder'?'Importer le dossier':'Importer dans mes cours'}</button>
        <button class="btn btn-g" onclick="closeModal('modal-soc-course')">Fermer</button>
      </div>`;
  }catch(e){body.innerHTML=`<p class="soc-empty">${_socEsc(e.message)}</p><div class="fr"><button class="btn btn-g" onclick="closeModal('modal-soc-course')">Fermer</button></div>`;}
}
function _socialAddQs(courseId,list){
  (list||[]).forEach(q=>{
    if(!q||!Array.isArray(q.answers))return;
    questions.push({id:uid(),courseId,question:String(q.question||''),answers:q.answers.map(a=>String(a)),correct:Math.max(0,Math.min(q.answers.length-1,q.correct|0)),expl:String(q.expl||'')});
  });
}
function _socialImportFolder(c,p,folder){
  let sf=subFolders.find(x=>x.sharedFrom===c.id);
  if(sf){
    // mise à jour : on remplace les cours importés de ce dossier
    const old=courses.filter(x=>x.subFolderId===sf.id&&x.sharedFrom===c.id).map(x=>x.id);
    questions=questions.filter(q=>!old.includes(q.courseId));
    flashcards=flashcards.filter(x=>!old.includes(x.courseId));
    courses=courses.filter(x=>!old.includes(x.id));
  }else{
    const nm=(p.folder&&p.folder.name)||c.title;
    const taken=subFolders.some(x=>x.folderId===folder.id&&x.name===nm);
    sf={id:uid(),folderId:folder.id,name:taken?`${nm} (${_socName(c.owner)})`:nm,sharedFrom:c.id,sharedBy:c.owner&&c.owner.username};
    subFolders.push(sf);
  }
  const all=p.questions||[];
  (p.courses||[]).forEach(x=>{
    const course={id:uid(),folderId:folder.id,subFolderId:sf.id,name:String(x.name||'Cours'),sharedFrom:c.id,sharedBy:c.owner&&c.owner.username};
    courses.push(course);
    const r=Array.isArray(x.q)?x.q:[0,0];
    _socialAddQs(course.id,all.slice(r[0],r[1]));
    if(x.fiche&&typeof saveFiche==='function')saveFiche(course.id,String(x.fiche));
    if(Array.isArray(x.flashcards)&&x.flashcards.length&&typeof addFlashcards==='function')
      addFlashcards(course.id,x.flashcards.filter(y=>y&&y.term&&y.definition).map(y=>({term:String(y.term),definition:String(y.definition),keywords:Array.isArray(y.keywords)?y.keywords:[]})));
  });
  saveAll();
  closeModal('modal-soc-course');
  showNotif(`Dossier « ${sf.name} » ajouté dans ${folder.name}`,'ok');
  if(typeof renderHome==='function')renderHome();
}
function _socialImportSubject(c,p){
  const nm=(p.folder&&p.folder.name)||c.title;
  let folder=folders.find(x=>x.sharedFrom===c.id);
  if(folder){
    const old=courses.filter(x=>x.folderId===folder.id&&x.sharedFrom===c.id).map(x=>x.id);
    questions=questions.filter(q=>!old.includes(q.courseId));
    flashcards=flashcards.filter(x=>!old.includes(x.courseId));
    courses=courses.filter(x=>!old.includes(x.id));
  }else{
    const taken=folders.some(x=>x.name.toLowerCase()===nm.toLowerCase()&&x.type!=='annales');
    folder={id:uid(),name:taken?`${nm} (${_socName(c.owner)})`:nm,color:(p.subject&&p.subject.color)||PAL[0],sharedFrom:c.id,sharedBy:c.owner&&c.owner.username};
    folders.push(folder);
  }
  const all=p.questions||[];
  (p.courses||[]).forEach(x=>{
    let sfId=null;
    if(x.sub){
      let sf=subFolders.find(y=>y.folderId===folder.id&&y.name===String(x.sub));
      if(!sf){sf={id:uid(),folderId:folder.id,name:String(x.sub),sharedFrom:c.id};subFolders.push(sf);}
      sfId=sf.id;
    }
    const course={id:uid(),folderId:folder.id,subFolderId:sfId,name:String(x.name||'Cours'),sharedFrom:c.id,sharedBy:c.owner&&c.owner.username};
    courses.push(course);
    const r=Array.isArray(x.q)?x.q:[0,0];
    _socialAddQs(course.id,all.slice(r[0],r[1]));
    if(x.fiche&&typeof saveFiche==='function')saveFiche(course.id,String(x.fiche));
    if(Array.isArray(x.flashcards)&&x.flashcards.length&&typeof addFlashcards==='function')
      addFlashcards(course.id,x.flashcards.filter(y=>y&&y.term&&y.definition).map(y=>({term:String(y.term),definition:String(y.definition),keywords:Array.isArray(y.keywords)?y.keywords:[]})));
  });
  saveAll();
  closeModal('modal-soc-course');
  showNotif(`Matière « ${folder.name} » ajoutée`,'ok');
  if(typeof renderHome==='function')renderHome();
}
function socialImportCourse(){
  const c=_socCourse;if(!c)return;
  const p=c.payload||{};
  if(p.kind==='subject'&&Array.isArray(p.courses))return _socialImportSubject(c,p);
  const subject=(p.subject&&p.subject.name)||c.subject||'Cours partagés';
  let folder=folders.find(f=>f.name.toLowerCase()===subject.toLowerCase()&&f.type!=='annales');
  if(!folder){folder={id:uid(),name:subject,color:(p.subject&&p.subject.color)||PAL[0]};folders.push(folder);}
  if(p.kind==='folder'&&Array.isArray(p.courses))return _socialImportFolder(c,p,folder);
  let course=courses.find(x=>x.sharedFrom===c.id);
  if(course){
    // Mise à jour : on remplace les questions importées (la progression des anciennes est perdue)
    questions=questions.filter(q=>q.courseId!==course.id);
    flashcards=flashcards.filter(x=>x.courseId!==course.id);
  }else{
    const taken=courses.some(x=>x.folderId===folder.id&&x.name===c.title);
    course={id:uid(),folderId:folder.id,name:taken?`${c.title} (${_socName(c.owner)})`:c.title,sharedFrom:c.id,sharedBy:c.owner&&c.owner.username};
    courses.push(course);
  }
  (p.questions||[]).forEach(q=>{
    if(!q||!Array.isArray(q.answers))return;
    questions.push({id:uid(),courseId:course.id,question:String(q.question||''),answers:q.answers.map(a=>String(a)),correct:Math.max(0,Math.min(q.answers.length-1,q.correct|0)),expl:String(q.expl||'')});
  });
  if(p.fiche&&typeof saveFiche==='function')saveFiche(course.id,String(p.fiche));
  if(Array.isArray(p.flashcards)&&p.flashcards.length&&typeof addFlashcards==='function')
    addFlashcards(course.id,p.flashcards.filter(x=>x&&x.term&&x.definition).map(x=>({term:String(x.term),definition:String(x.definition),keywords:Array.isArray(x.keywords)?x.keywords:[]})));
  saveAll();
  closeModal('modal-soc-course');
  showNotif(`« ${course.name} » ajouté dans ${folder.name}`,'ok');
  if(typeof renderHome==='function')renderHome();
}

// =========================================================
// Mode aperçu (données d'exemple, rien n'est envoyé nulle part)
// =========================================================
let _demo=null;
function _demoMe(){
  return {id:'me',username:(localStorage.getItem('kp_firstname')||'moi').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g,'')||'moi',
    display_name:localStorage.getItem('kp_firstname')||'Moi',promo:localStorage.getItem('kp_promo')||'',avatar:gam.char,
    level:gamLevelFromXP(gam.xp),xp_total:gam.xp,streak:typeof stats!=='undefined'?stats.streak||0:0,
    week:{xp:gam.week.xp,q:gam.week.q,c:gam.week.c,s:gam.week.s},house:gam.house.items};
}
function _demoInit(){
  if(_demo)return;
  const U=(id,username,display_name,promo,avatar,xp_total,streak,week,house)=>({id,username,display_name,promo,avatar,xp_total,level:gamLevelFromXP(xp_total),streak,week,house:house||[]});
  const H=(lvl)=>{const items=[];GAM_ROOMS.filter(r=>r.level<=lvl).forEach(r=>(GAM_DEFAULT_ITEMS[r.id]||[]).forEach(([type,dx,dz,rot])=>items.push({uid:r.id+type+dx,type,x:r.x+dx,z:r.z+dz,rot})));return items;};
  const users=[
    U('d1','lea.k2','Léa','K2',{species:'chat',color:'#b79ce8',hat:'beret'},2400,12,{xp:540,q:128,c:101,s:6200},H(8)),
    U('d2','hugo','Hugo','K2',{species:'robot',color:'#6cb4ee',hat:'casquette'},4100,21,{xp:830,q:186,c:150,s:9100},H(12)),
    U('d3','ines.bzh','Inès','K1',{species:'lapin',color:'#f5a3c7',face:'lunettes'},1300,5,{xp:310,q:72,c:52,s:3400},H(5)),
    U('d4','yanis','Yanis','K2',{species:'ours',color:'#9c7360'},640,2,{xp:120,q:31,c:20,s:1500},H(3)),
    U('d5','chloe.kine','Chloé','K3',{species:'grenouille',color:'#7dcfa0',hat:'bandeau'},5600,34,{xp:960,q:230,c:201,s:11800},H(14)),
    U('d6','sacha','Sacha','K1',{species:'souris',color:'#f2c14e'},220,1,{xp:45,q:12,c:7,s:600},H(2))
  ];
  const qz=(n,t)=>Array.from({length:n},(_, i)=>({question:`${t} — question ${i+1} ?`,answers:['Réponse A','Réponse B','Réponse C','Réponse D'],correct:i%4,expl:''}));
  _demo={users,friends:new Set(['d1','d2','d3']),incoming:new Set(['d4']),outgoing:new Set(),
    courses:[
      {id:'c1',owner:'d1',client_id:'x1',title:'Genou — ligaments croisés',subject:'Anatomie',visibility:'friends',question_count:24,has_fiche:true,updated_at:new Date().toISOString(),payload:{v:1,course:{name:'Genou — ligaments croisés'},subject:{name:'Anatomie',color:'#2D5A3D'},questions:qz(24,'LCA'),fiche:'# Genou\n\n- LCA : antéro-latéral\n- LCP : postéro-médial',flashcards:[]}},
      {id:'c2',owner:'d2',client_id:'x2',title:'AVC — rééducation',subject:'Neurologie',visibility:'public',question_count:40,has_fiche:false,updated_at:new Date(Date.now()-864e5).toISOString(),payload:{v:1,course:{name:'AVC — rééducation'},subject:{name:'Neurologie',color:'#004d75'},questions:qz(40,'AVC'),fiche:'',flashcards:[]}},
      {id:'c3',owner:'d3',client_id:'x3',title:'Bilan articulaire de l’épaule',subject:'Bilans',visibility:'friends',question_count:15,has_fiche:true,updated_at:new Date(Date.now()-3*864e5).toISOString(),payload:{v:1,course:{name:'Bilan articulaire de l’épaule'},subject:{name:'Bilans',color:'#7A3A8B'},questions:qz(15,'Épaule'),fiche:'# Épaule',flashcards:[]}}
    ],
    inbox:[{id:'i1',course:'c1',sender:'d1',message:'Pour le partiel de jeudi 💪',seen:false,created_at:new Date().toISOString()}],
    mine:[]};
}
function _demoUser(id){return id==='me'?_demoMe():_demo.users.find(u=>u.id===id);}
function _demoCard(u){return {id:u.id,username:u.username,display_name:u.display_name,promo:u.promo,avatar:u.avatar,level:u.level,xp_total:u.xp_total,streak:u.streak};}
function _demoRel(id){return _demo.friends.has(id)?'friends':_demo.outgoing.has(id)?'outgoing':_demo.incoming.has(id)?'incoming':'none';}
function _demoCourseCard(c){return {id:c.id,client_id:c.client_id,title:c.title,subject:c.subject,visibility:c.visibility,question_count:c.question_count,has_fiche:c.has_fiche,updated_at:c.updated_at,owner:_demoCard(_demoUser(c.owner))};}
async function _demoRpc(fn,a){
  _demoInit();
  await new Promise(r=>setTimeout(r,120));
  const me=_demoMe(),all=[me].concat(_demo.users);
  switch(fn){
    case 'get_leaderboard':{
      const pool=a.p_scope==='friends'?all.filter(u=>u.id==='me'||_demo.friends.has(u.id)):all;
      const val=u=>{const w=u.week||{};switch(a.p_metric){case 'questions':return w.q;case 'time':return w.s;case 'accuracy':return w.q>=20?Math.round(w.c*1000/w.q)/10:null;case 'streak':return u.streak;default:return w.xp;}};
      const rows=pool.map(u=>({..._demoCard(u),value:val(u),xp:u.week.xp,questions:u.week.q,correct:u.week.c,seconds:u.week.s,is_me:u.id==='me',is_friend:_demo.friends.has(u.id)}))
        .sort((x,y)=>(y.value==null?-1:y.value)-(x.value==null?-1:x.value));
      rows.forEach((r,i)=>r.rank=i&&rows[i-1].value===r.value?rows[i-1].rank:i+1);
      return {week_start:gamWeekKey(),rows};
    }
    case 'get_champions':return {rows:['d5','d2','d1'].map((id,i)=>({..._demoCard(_demoUser(id)),week_xp:[1120,980,610][i]}))};
    case 'list_friends':return {
      friends:_demo.users.filter(u=>_demo.friends.has(u.id)).map(u=>({..._demoCard(u),week:u.week})).sort((x,y)=>y.week.xp-x.week.xp),
      incoming:_demo.users.filter(u=>_demo.incoming.has(u.id)).map(_demoCard),
      outgoing:_demo.users.filter(u=>_demo.outgoing.has(u.id)).map(_demoCard)};
    case 'search_profiles':{const q=String(a.p_query||'').toLowerCase().replace('@','').trim();
      return _demo.users.filter(u=>u.username.startsWith(q)||u.display_name.toLowerCase().includes(q)).map(u=>({..._demoCard(u),relation:_demoRel(u.id)}));}
    case 'send_friend_request':{const id=a.p_target;if(_demo.incoming.has(id)){_demo.incoming.delete(id);_demo.friends.add(id);return 'friends';}
      _demo.outgoing.add(id);setTimeout(()=>{_demo.outgoing.delete(id);_demo.friends.add(id);if(document.body.dataset.screen==='social')_socialLoadAll();showNotif(`${_socName(_demoUser(id))} a accepté ta demande !`,'ok');},2500);return 'outgoing';}
    case 'respond_friend_request':_demo.incoming.delete(a.p_requester);if(a.p_accept)_demo.friends.add(a.p_requester);return a.p_accept?'friends':'none';
    case 'remove_friend':_demo.friends.delete(a.p_other);_demo.outgoing.delete(a.p_other);return 'none';
    case 'get_user_profile':{const u=_demoUser(a.p_user);if(!u)throw new Error('Introuvable.');const fr=_demo.friends.has(u.id);return {..._demoCard(u),is_friend:fr,house:fr?u.house:null,week:u.week};}
    case 'list_friend_courses':return _demo.courses.filter(c=>a.p_user?c.owner===a.p_user&&(c.visibility==='public'||_demo.friends.has(c.owner)):_demo.friends.has(c.owner)&&c.visibility!=='private').map(_demoCourseCard);
    case 'get_shared_course':{const c=_demo.courses.find(x=>x.id===a.p_id)||_demo.mine.find(x=>x.id===a.p_id);if(!c)throw new Error('Introuvable.');return {..._demoCourseCard(c),payload:c.payload};}
    case 'list_inbox':return _demo.inbox.map(x=>({id:x.id,message:x.message,seen:x.seen,created_at:x.created_at,sender:_demoCard(_demoUser(x.sender)),course:_demoCourseCard(_demo.courses.find(c=>c.id===x.course))}));
    case 'mark_inbox_seen':_demo.inbox.forEach(x=>{if(a.p_ids.includes(x.id))x.seen=true;});return a.p_ids.length;
    case 'delete_inbox_item':_demo.inbox=_demo.inbox.filter(x=>x.id!==a.p_id);return true;
    case 'list_my_shared_courses':return _demo.mine.map(_demoCourseCard);
    case 'publish_course':{let c=_demo.mine.find(x=>x.client_id===a.p_client_id);
      const data={client_id:a.p_client_id,title:a.p_title,subject:a.p_subject,visibility:a.p_visibility,question_count:(a.p_payload.questions||[]).length,has_fiche:!!a.p_payload.fiche,updated_at:new Date().toISOString(),payload:a.p_payload,owner:'me'};
      if(c)Object.assign(c,data);else{c=Object.assign({id:'m'+Date.now()},data);_demo.mine.unshift(c);}return _demoCourseCard(c);}
    case 'set_course_visibility':{const c=_demo.mine.find(x=>x.id===a.p_id);if(c)c.visibility=a.p_visibility;return c?_demoCourseCard(c):null;}
    case 'delete_shared_course':_demo.mine=_demo.mine.filter(x=>x.id!==a.p_id);return true;
    case 'send_course':return (a.p_recipients||[]).filter(id=>_demo.friends.has(id)).length;
    case 'update_my_profile':{if(a.p.display_name)localStorage.setItem('kp_firstname',a.p.display_name);return _demoMe();}
    case 'claim_weekly_reward':return null;
    default:return null;
  }
}

// =========================================================
// Démarrage
// =========================================================
document.addEventListener('DOMContentLoaded',()=>{
  if(typeof gamSubscribe==='function')gamSubscribe(_socialScheduleFlush);
  setTimeout(socialInit,400);
});
