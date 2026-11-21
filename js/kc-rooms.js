/* =========================================================
   kc-rooms.js — v85 (21 nov. 2026) : SALLES D'ÉTUDE EN DIRECT (« study with me »)
   Supabase Realtime (présence + diffusion), AUCUNE table : rien n'est enregistré sur le serveur.
   - Hall : canal 'kc-lobby' → qui révise en ce moment, dans quelle salle (présence {r, n, a, f, s}).
   - Salles : commune, une par filière (kp_prof), celle de mon école (kp_school), salles privées par code (6 lettres).
   - Dans une salle (canal 'kc-room-<id>') : membres (avatar, statut révise / pause, questions du jour),
     Pomodoro PARTAGÉ calculé à partir d'un état commun {start, focus, brk, paused, left, rev} (le plus récent gagne) :
     tout le monde est en pause en même temps ; petit carillon et bulle au changement. Discussion éphémère + bravos.
   - Mini-fenêtre #krm-mini quand on quitte la fenêtre sans quitter la salle.
   Entrées : kcRoomsOpen() (bannière de l'écran Amis, fenêtre Pomodoro, visite guidée).
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const notify=(m,t)=>{if(typeof showNotif==='function')showNotif(m,t||'ok');};
function G(n,d){try{const v=eval(n);return v===undefined?d:v;}catch(e){return d;}}
const R={lobby:null,lobbyState:{},room:null,ch:null,members:{},pomo:null,chat:[],me:null,tick:0,lastPhase:'',dlg:null,err:'',joining:false};
const myId=(()=>{let v=LS('kp_rt_id','');if(!v){v='u'+Math.random().toString(36).slice(2,10);try{localStorage.setItem('kp_rt_id',v);}catch(e){}}return v;})();
const prof=()=>LS('kp_prof','').replace(/"/g,'');
const P=()=>window.KC_PROFS||{};
function rooms(){
  const out=[{id:'all',n:'Salle commune',ic:'groups',d:'Tous les étudiants City Work'}];
  const f=prof();if(f&&P()[f]&&f!=='autre')out.push({id:'f-'+f,n:'Salle '+P()[f].n,ic:P()[f].ic,d:'Les étudiants de ta filière'});
  const e=LS('kp_school','').trim(),ek=typeof kcSchoolKey==='function'?kcSchoolKey(e):'';
  if(ek)out.push({id:'e-'+ek.slice(0,24),n:e.slice(0,34),ic:'apartment',d:'Ton école / ta fac'});
  Object.keys(P()).filter(k=>k!==f&&k!=='autre').forEach(k=>out.push({id:'f-'+k,n:'Salle '+P()[k].n,ic:P()[k].ic,d:'',other:true}));
  return out;
}
function roomName(id){if(/^p-/.test(id))return 'Salle privée '+id.slice(2).toUpperCase();const r=rooms().find(x=>x.id===id);return r?r.n:'Salle';}
function myName(){try{const p=G('_sbProfile',null);if(p&&(p.display_name||p.username))return p.display_name||p.username;}catch(e){}return LS('kp_firstname','')||'Étudiant';}
function myAv(){const c=Object.assign({},(G('gam',{})||{}).char||{});['_f','_e','_y','_v'].forEach(k=>delete c[k]);return c;}
function todayQ(){try{return typeof getTodayQ==='function'?getTodayQ():0;}catch(e){return 0;}}

async function client(){
  if(typeof socialConfigured!=='function'||!socialConfigured())throw new Error('Les salles d’étude ont besoin des comptes City Work.');
  if(typeof socialInit==='function')await socialInit();
  const sb=G('_sb',null);if(!sb)throw new Error('Pas de connexion internet.');
  return sb;
}
/* ───────── Hall ───────── */
async function joinLobby(){
  if(R.lobby)return;
  const sb=await client();
  R.lobby=sb.channel('kc-lobby',{config:{presence:{key:myId}}});
  R.lobby.on('presence',{event:'sync'},()=>{R.lobbyState=R.lobby.presenceState();render();mini();});
  R.lobby.subscribe(st=>{if(st==='SUBSCRIBED'){if(R.room)trackLobby();}else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){R.err='Connexion en direct impossible pour l’instant.';render();}});
}
function trackLobby(){if(R.lobby)R.lobby.track({r:R.room||'',n:myName().slice(0,30),a:myAv(),f:prof(),s:phase().ph==='focus'?'focus':'pause',t:Date.now()}).catch(()=>{});}
function lobbyCounts(){
  const c={},people=[];
  Object.values(R.lobbyState||{}).forEach(arr=>{const p=arr&&arr[arr.length-1];if(!p||!p.r)return;c[p.r]=(c[p.r]||0)+1;people.push(p);});
  return {c,people,total:people.length};
}
/* ───────── Pomodoro partagé ───────── */
function phase(now){
  const p=R.pomo;now=now||Date.now();
  if(!p)return {ph:'idle',left:0,cyc:0};
  const F=p.focus*60e3,B=p.brk*60e3;
  if(p.paused)return {ph:p.pph||'focus',left:p.left||F,paused:true,cyc:p.cyc||0};
  const el=now-p.start;if(el<0)return {ph:'focus',left:F,cyc:0};
  const cyc=Math.floor(el/(F+B)),r=el%(F+B);
  return r<F?{ph:'focus',left:F-r,cyc}:{ph:'break',left:F+B-r,cyc};
}
function setPomo(o){
  R.pomo=Object.assign({focus:25,brk:5,start:Date.now(),paused:false,left:0,pph:'focus'},R.pomo||{},o,{rev:Date.now(),by:myName().slice(0,30)});
  if(R.ch)R.ch.send({type:'broadcast',event:'pomo',payload:R.pomo});
  R.lastPhase=phase().ph;render();mini();trackRoom();trackLobby();
}
function pomoCmd(a){
  const ph=phase();
  if(a==='start'){if(R.pomo&&R.pomo.paused){const p=R.pomo,F=p.focus*60e3,B=p.brk*60e3;
      /* reprise : on recale « start » pour retrouver la même position dans le cycle */
      const pos=(p.pph==='break'?F+(B-p.left):F-p.left)+(p.cyc||0)*(F+B);setPomo({paused:false,start:Date.now()-pos});}
    else setPomo({start:Date.now(),paused:false});}
  else if(a==='pause'){if(!R.pomo)return;setPomo({paused:true,left:ph.left,pph:ph.ph,cyc:ph.cyc});}
  else if(a==='reset'){setPomo({start:Date.now(),paused:true,left:(R.pomo?R.pomo.focus:25)*60e3,pph:'focus',cyc:0});}
  else if(a==='skip'){if(!R.pomo)return;const p=R.pomo,F=p.focus*60e3,B=p.brk*60e3,c=ph.cyc||0;
    /* passe au début de la phase suivante (pause → concentration du cycle suivant) */
    if(ph.paused)setPomo(ph.ph==='focus'?{paused:true,pph:'break',left:B,cyc:c}:{paused:true,pph:'focus',left:F,cyc:c+1});
    else setPomo({paused:false,start:Date.now()-(ph.ph==='focus'?c*(F+B)+F:(c+1)*(F+B))});}
}
function setDur(f,b){setPomo({focus:f,brk:b,start:Date.now(),paused:!!(R.pomo&&R.pomo.paused),left:f*60e3,pph:'focus',cyc:0});}
function chime(up){
  try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const ac=R.ac||(R.ac=new A());if(ac.state==='suspended')ac.resume();
    const notes=up?[523.25,659.25,783.99]:[783.99,659.25,523.25];
    notes.forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;const t=ac.currentTime+i*.18;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.18,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.9);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+1);});}catch(e){}
}
function loop(){
  clearInterval(R.tick);
  R.tick=setInterval(()=>{
    if(!R.room){clearInterval(R.tick);return;}
    const ph=phase();
    if(R.lastPhase&&ph.ph!==R.lastPhase&&!ph.paused){chime(ph.ph==='focus');
      notify(ph.ph==='break'?'Pause ensemble ! Lève-toi, bois de l’eau':'C’est reparti : concentration','ok');trackRoom();trackLobby();
      try{if(document.hidden&&'Notification' in window&&Notification.permission==='granted')new Notification(ph.ph==='break'?'Pause !':'Au travail !',{body:roomName(R.room)});}catch(e){}}
    R.lastPhase=ph.ph;
    const t=$('krm-time');if(t)t.textContent=fmt(ph.left);
    const ring=$('krm-ring');if(ring&&R.pomo){const tot=(ph.ph==='focus'?R.pomo.focus:R.pomo.brk)*60e3;ring.style.setProperty('--p',Math.round((1-ph.left/tot)*100));}
    mini();
  },500);
}
const fmt=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};

/* ───────── Salle ───────── */
function trackRoom(){if(R.ch)R.ch.track({n:myName().slice(0,30),a:myAv(),f:prof(),e:LS('kp_school','').slice(0,40),s:phase().ph==='break'?'pause':'focus',q:todayQ(),t:R.joinedAt||Date.now()}).catch(()=>{});}
async function enter(id){
  if(R.joining)return;R.joining=true;R.err='';
  try{
    const sb=await client();await joinLobby();
    if(R.ch){try{await R.ch.unsubscribe();sb.removeChannel(R.ch);}catch(e){}R.ch=null;}
    R.room=id;R.members={};R.chat=[];R.pomo=null;R.joinedAt=Date.now();R.lastPhase='';
    const ch=sb.channel('kc-room-'+id,{config:{presence:{key:myId},broadcast:{self:false}}});R.ch=ch;
    ch.on('presence',{event:'sync'},()=>{R.members=ch.presenceState();render();mini();});
    ch.on('presence',{event:'join'},({key,newPresences})=>{if(key!==myId&&newPresences&&newPresences[0])addChat({sys:1,t:(newPresences[0].n||'Quelqu’un')+' arrive dans la salle'});});
    ch.on('broadcast',{event:'pomo'},({payload})=>{if(payload&&(!R.pomo||payload.rev>R.pomo.rev)){R.pomo=payload;R.lastPhase=phase().ph;render();mini();trackRoom();}});
    ch.on('broadcast',{event:'hello'},()=>{if(R.pomo)ch.send({type:'broadcast',event:'pomo',payload:R.pomo});});
    ch.on('broadcast',{event:'chat'},({payload})=>{if(payload&&payload.t)addChat(payload);});
    ch.subscribe(st=>{
      if(st==='SUBSCRIBED'){trackRoom();trackLobby();ch.send({type:'broadcast',event:'hello',payload:{}});
        setTimeout(()=>{if(!R.pomo&&R.ch===ch){R.pomo={focus:25,brk:5,start:Date.now(),paused:true,left:25*60e3,pph:'focus',cyc:0,rev:1,by:''};render();}},1600);}
      else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){R.err='Impossible de rejoindre la salle (connexion en direct indisponible).';render();}
    });
    loop();
    try{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();}catch(e){}
  }catch(e){R.err=e.message||String(e);R.room=null;}
  R.joining=false;render();mini();
}
async function leave(){
  const sb=G('_sb',null);
  if(R.ch){try{await R.ch.untrack();await R.ch.unsubscribe();if(sb)sb.removeChannel(R.ch);}catch(e){}}
  R.ch=null;R.room=null;R.members={};R.pomo=null;clearInterval(R.tick);
  if(R.lobby)R.lobby.track({r:'',n:myName(),a:myAv(),f:prof(),s:'',t:Date.now()}).catch(()=>{});
  render();mini();
}
let lastSend=0;
function sendChat(txt){
  txt=String(txt||'').trim().slice(0,200);if(!txt||!R.ch)return;
  if(Date.now()-lastSend<1500){notify('Doucement : un message toutes les 2 secondes','err');return;}lastSend=Date.now();
  const m={id:Math.random().toString(36).slice(2),n:myName().slice(0,30),a:myAv(),t:txt,at:Date.now(),me:myId};
  R.ch.send({type:'broadcast',event:'chat',payload:m});addChat(Object.assign({mine:1},m));
}
function addChat(m){R.chat.push(m);if(R.chat.length>60)R.chat.shift();const box=$('krm-chat-l');if(box){box.insertAdjacentHTML('beforeend',chatRow(m));box.scrollTop=box.scrollHeight;}}
function chatRow(m){
  if(m.sys)return `<div class="krm-sys">${esc(m.t)}</div>`;
  return `<div class="krm-msg${m.mine?' me':''}"><span class="krm-mav">${typeof gamAvatarSVG==='function'?gamAvatarSVG(m.a||{},26):''}</span><div><b>${esc(m.n)}</b><span>${esc(m.t)}</span></div></div>`;
}

/* ───────── Rendu ───────── */
function membersList(){return Object.entries(R.members||{}).map(([k,arr])=>Object.assign({key:k},arr[arr.length-1]||{})).sort((a,b)=>(a.t||0)-(b.t||0));}
function lobbyHTML(){
  const {c,people,total}=lobbyCounts(),rs=rooms();
  const mine=rs.filter(r=>!r.other),others=rs.filter(r=>r.other&&c[r.id]);
  const card=r=>`<button type="button" class="krm-rc${R.room===r.id?' on':''}" data-r="join" data-id="${esc(r.id)}"><span class="krm-ric"><span class="ms">${r.ic}</span></span><span class="krm-rt"><b>${esc(r.n)}</b><small>${esc(r.d||'')}</small></span><span class="krm-cnt${c[r.id]?' live':''}"><i></i>${c[r.id]||0}</span></button>`;
  return `<div class="krm-live"><span class="krm-dot"></span><b>${total}</b> étudiant${total>1?'s':''} révise${total>1?'nt':''} en ce moment${people.length?`<span class="krm-faces">${people.slice(0,8).map(p=>`<span title="${esc(p.n||'')}">${typeof gamAvatarSVG==='function'?gamAvatarSVG(p.a||{},24):''}</span>`).join('')}</span>`:''}</div>
    <div class="krm-rl">${mine.map(card).join('')}</div>
    ${others.length?`<div class="krm-sec">Autres salles ouvertes</div><div class="krm-rl">${others.map(card).join('')}</div>`:''}
    <div class="krm-sec">Salle privée (avec tes amis)</div>
    <form class="krm-priv" data-r="priv"><input class="fi" id="krm-code" maxlength="6" placeholder="Code (ex : K2NEURO)" autocomplete="off" spellcheck="false"><button class="btn btn-g btn-sm" type="submit">Rejoindre</button><button class="btn btn-p btn-sm" type="button" data-r="newpriv">Créer</button></form>
    <small class="krm-note"><span class="ms">lock</span>Rien n’est enregistré : on voit seulement qui est là, le minuteur commun et les messages du moment.</small>`;
}
function roomHTML(){
  const ph=phase(),mem=membersList(),p=R.pomo||{focus:25,brk:5};
  const tot=(ph.ph==='break'?p.brk:p.focus)*60e3,pct=Math.round((1-(ph.left||tot)/tot)*100);
  const DUR=[[25,5],[50,10],[45,15],[90,20]];
  return `<div class="krm-room">
    <div class="krm-rh"><button type="button" class="krm-back" data-r="lobby" title="Toutes les salles"><span class="ms">arrow_back</span></button><div><b>${esc(roomName(R.room))}</b><small>${mem.length} présent${mem.length>1?'s':''}${/^p-/.test(R.room)?' · code <b>'+esc(R.room.slice(2).toUpperCase())+'</b>':''}</small></div>
      ${/^p-/.test(R.room)?`<button type="button" class="btn btn-g btn-sm" data-r="copy"><span class="ms" style="font-size:16px">content_copy</span>Inviter</button>`:''}
      <button type="button" class="btn btn-g btn-sm krm-leave" data-r="leave"><span class="ms" style="font-size:16px">logout</span>Quitter</button></div>
    <div class="krm-grid">
      <div class="krm-pomo ${ph.ph}${ph.paused?' paused':''}">
        <div class="krm-ring" id="krm-ring" style="--p:${pct}"><div><span class="krm-ph">${ph.ph==='break'?'Pause ensemble':ph.paused?'En attente':'Concentration'}</span><b id="krm-time">${fmt(ph.left||tot)}</b><small>${R.pomo&&R.pomo.by?'lancé par '+esc(R.pomo.by):'minuteur commun'}</small></div></div>
        <div class="krm-pc">${ph.paused||!R.pomo?'<button type="button" class="btn btn-p" data-r="start"><span class="ms">play_arrow</span>Lancer pour tous</button>':'<button type="button" class="btn btn-g" data-r="pause"><span class="ms">pause</span>Pause</button>'}
          <button type="button" class="btn btn-g" data-r="skip" title="Passer à la suite"><span class="ms">skip_next</span></button><button type="button" class="btn btn-g" data-r="reset" title="Recommencer"><span class="ms">restart_alt</span></button></div>
        <div class="krm-durs">${DUR.map(([f,b])=>`<button type="button" class="${p.focus===f&&p.brk===b?'on':''}" data-r="dur" data-f="${f}" data-b="${b}">${f} / ${b}</button>`).join('')}</div>
        <small class="krm-hint">Tout le monde voit le même minuteur et fait la pause en même temps.</small>
      </div>
      <div class="krm-side">
        <div class="krm-sec">Dans la salle</div>
        <div class="krm-mem">${mem.map(m=>`<div class="krm-m${m.key===myId?' me':''} ${m.s==='pause'?'pz':''}" title="${esc(m.n||'')}"><span class="krm-mav">${typeof gamAvatarSVG==='function'?gamAvatarSVG(m.a||{},40):''}</span><b>${esc(m.n||'')}${m.key===myId?' (toi)':''}</b><small>${m.s==='pause'?'en pause':'révise'}${m.q?' · '+m.q+' q. auj.':''}${m.f&&P()[m.f]?' · '+esc(P()[m.f].n):''}</small></div>`).join('')||'<div class="krm-empty">Personne pour l’instant… invite tes amis !</div>'}</div>
        <div class="krm-sec">Discussion</div>
        <div class="krm-chat"><div class="krm-chat-l" id="krm-chat-l">${R.chat.map(chatRow).join('')}</div>
          <div class="krm-quick">${['Bon courage !','Pause ?','J’ai fini mon chapitre','👏'].map(t=>`<button type="button" data-r="say" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          <form class="krm-send" data-r="send"><input class="fi" id="krm-in" maxlength="200" placeholder="Écris à la salle…" autocomplete="off"><button class="btn btn-p btn-sm" type="submit"><span class="ms" style="font-size:16px">send</span></button></form></div>
      </div>
    </div></div>`;
}
function render(){
  const b=R.dlg&&R.dlg.el.querySelector('.kc-dlg-b');if(!b)return;
  const f=document.activeElement&&document.activeElement.id==='krm-in',val=f?document.activeElement.value:'';
  const sc=$('krm-chat-l')?$('krm-chat-l').scrollTop:null;
  b.innerHTML=(R.err?`<div class="soc-note err">${esc(R.err)}</div>`:'')+(R.room&&R.view!=='lobby'?roomHTML():lobbyHTML());
  const cl=$('krm-chat-l');if(cl)cl.scrollTop=sc==null?cl.scrollHeight:cl.scrollHeight;
  if(f){const i=$('krm-in');if(i){i.value=val;i.focus();}}
}
function mini(){
  let m=$('krm-mini');
  if(!R.room||R.dlg){if(m)m.remove();return;}
  if(!m){m=document.createElement('button');m.id='krm-mini';m.type='button';m.className='krm-mini';m.onclick=()=>window.kcRoomsOpen();document.body.appendChild(m);}
  const ph=phase(),n=membersList().length;
  m.className='krm-mini '+ph.ph+(ph.paused?' paused':'');
  m.innerHTML=`<span class="krm-dot"></span><b>${fmt(ph.left||25*60e3)}</b><span>${ph.ph==='break'?'pause':ph.paused?'en attente':'révision'} · ${n} pers.</span>`;
}
window.kcRoomsOpen=function(){
  if(typeof window.kcDlg!=='function')return;
  R.view=R.room?'room':'lobby';
  R.dlg=window.kcDlg({title:'Salles d’étude en direct',sub:'Révise avec d’autres étudiants, en même temps',icon:'meeting_room',body:'<div class="krm-load"><div class="house-spinner"></div></div>',foot:false,
    onOpen:bg=>{bg.classList.add('krm-dlg');
      bg.addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(!b||b.tagName==='FORM')return;const a=b.dataset.r;
        if(a==='join'){R.view='room';if(R.room!==b.dataset.id)enter(b.dataset.id);else render();}
        else if(a==='lobby'){R.view='lobby';render();}
        else if(a==='leave'){leave();R.view='lobby';}
        else if(a==='newpriv'){const code=Math.random().toString(36).slice(2,8).toUpperCase();R.view='room';enter('p-'+code.toLowerCase());}
        else if(a==='copy'){const t='Rejoins ma salle d’étude City Work : code '+R.room.slice(2).toUpperCase()+' (Amis → Salles d’étude)';try{navigator.clipboard.writeText(t);notify('Invitation copiée','ok');}catch(_){notify(t,'ok');}}
        else if(a==='say')sendChat(b.dataset.t);
        else if(a==='dur')setDur(+b.dataset.f,+b.dataset.b);
        else if(['start','pause','reset','skip'].includes(a))pomoCmd(a);
      });
      bg.addEventListener('submit',e=>{e.preventDefault();const f=e.target.dataset.r;
        if(f==='send'){const i=$('krm-in');sendChat(i.value);i.value='';}
        else if(f==='priv'){const c=($('krm-code').value||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');if(c.length<4){notify('Le code fait au moins 4 lettres','err');return;}R.view='room';enter('p-'+c);}});
      joinLobby().then(render).catch(e=>{R.err=e.message||String(e);render();});
      render();
    },onClose:()=>{R.dlg=null;mini();if(!R.room&&R.lobby){/* on garde le hall ouvert pour les compteurs */}}});
};
window.kcRoomsLive=function(){return lobbyCounts().total;};

/* ───────── Bannière sur l'écran Amis ───────── */
function banner(){
  if(document.body.dataset.screen!=='social')return;
  const root=$('social-root');if(!root||$('krm-ban'))return;
  const top=root.querySelector('.soc-top');if(!top)return;
  const b=document.createElement('button');b.type='button';b.id='krm-ban';b.className='krm-ban';b.onclick=()=>window.kcRoomsOpen();
  b.innerHTML=`<span class="krm-ban-ic"><span class="ms">meeting_room</span></span><span class="krm-ban-t"><b>Salles d’étude en direct</b><small>Pomodoro partagé, pauses ensemble, on voit qui révise en ce moment</small></span><span class="krm-ban-c" id="krm-ban-c"><span class="krm-dot"></span>En direct</span><span class="ms">arrow_forward</span>`;
  top.after(b);
  joinLobby().then(()=>{const c=$('krm-ban-c');if(c)c.innerHTML=`<span class="krm-dot"></span>${lobbyCounts().total} en ligne`;}).catch(()=>{});
}
new MutationObserver(()=>setTimeout(banner,50)).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
document.addEventListener('click',()=>setTimeout(banner,300),true);
/* lien dans la fenêtre Pomodoro */
function pomoLink(){
  const m=document.querySelector('.kpm');if(!m||m.querySelector('.krm-pl'))return;
  const b=document.createElement('button');b.type='button';b.className='krm-pl';b.innerHTML='<span class="ms">groups</span>Réviser à plusieurs (salle d’étude)';
  b.onclick=()=>{try{if(window.Pomodoro&&Pomodoro.hide)Pomodoro.hide();}catch(e){}window.kcRoomsOpen();};m.appendChild(b);
}
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-tb="pomo"]'))setTimeout(pomoLink,200);},true);
addEventListener('beforeunload',()=>{try{if(R.ch)R.ch.untrack();}catch(e){}});
/* le compteur « questions aujourd'hui » se met à jour toutes les 2 minutes */
setInterval(()=>{if(R.room)trackRoom();},120e3);
})();
