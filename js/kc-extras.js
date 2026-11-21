/* =========================================================
   kc-extras.js — v63 (15 nov. 2026)
   1. Citation de personnes connues sur l'accueil (carte #kh-quote, en bas) selon la filière (kp_prof = kine | med | dent | veto),
      mélangée à des citations sur l'apprentissage. Change toutes les 6 heures (sans compte à rebours) ; bouton ↻ = une autre.
      Filière : kp_prof (inscription, Paramètres, accueil) ; à défaut, celle de « Ma ville » (kcu_city.prof).
   2. Sons de l'interface (Paramètres > Sons) : touches du clavier (4 sons) et clics (4 sons),
      chacun activable ; volume commun. Sons fabriqués avec Web Audio (aucun fichier à charger).
      Clés : kp_snd_keys / kp_snd_keys_t / kp_snd_click / kp_snd_click_t / kp_snd_vol.
   ========================================================= */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const SS=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};

/* ───────── 1. Phrases ───────── */
/* v85 (21 nov. 2026) : toutes les filières (santé + droit, prépa, éco, lettres, sciences, info, lycée…).
   Registre partagé window.KCF (kc-onboard.js s'en sert pour adapter les textes, le Drive, la ville…). */
const PROFS={
  kine:{n:'Kiné',ic:'accessibility_new',g:'sante'},med:{n:'Médecine',ic:'stethoscope',g:'sante'},dent:{n:'Dentaire',ic:'dentistry',g:'sante'},
  veto:{n:'Vétérinaire',ic:'pets',g:'sante'},inf:{n:'Infirmier',ic:'vaccines',g:'sante'},pharma:{n:'Pharmacie',ic:'medication',g:'sante'},
  sf:{n:'Sage-femme',ic:'pregnant_woman',g:'sante'},psy:{n:'Psychologie',ic:'psychology',g:'sante'},
  droit:{n:'Droit',ic:'gavel',g:'autre'},prepa:{n:'Prépa / ingénieur',ic:'engineering',g:'autre'},eco:{n:'Éco / commerce',ic:'trending_up',g:'autre'},
  lettres:{n:'Lettres / langues',ic:'translate',g:'autre'},sciences:{n:'Sciences',ic:'science',g:'autre'},info:{n:'Informatique',ic:'computer',g:'autre'},
  lycee:{n:'Lycée / bac',ic:'school',g:'autre'},autre:{n:'Autre',ic:'auto_stories',g:'autre'}
};
window.KC_PROFS=PROFS;
/* Citations de personnes connues (16 nov. 2026, à la demande de l'utilisateur) : [texte, auteur, source facultative] */
const Q={
kine:[
['Le mouvement peut remplacer bien des remèdes, mais tous les remèdes du monde ne peuvent remplacer le mouvement.','Clément-Joseph Tissot','Gymnastique médicinale, 1780'],
['On n’est jeune qu’autant que sa colonne vertébrale est souple.','Joseph Pilates'],
['La bonne forme physique est la première condition du bonheur.','Joseph Pilates','Return to Life, 1945'],
['Le pied humain est un chef-d’œuvre d’ingénierie et une œuvre d’art.','Léonard de Vinci'],
['Le mouvement est la cause de toute vie.','Léonard de Vinci','Carnets'],
['La marche est le meilleur remède de l’homme.','Hippocrate','attribué'],
['Manger seul ne suffit pas à garder la santé : il faut aussi faire de l’exercice.','Hippocrate','Du régime'],
['Le manque d’activité détruit la bonne condition de tout être humain, alors que le mouvement et l’exercice méthodique la préservent.','Platon'],
['Le médecin du futur ne donnera plus de médicaments : il intéressera ses patients au soin du corps humain et à la prévention des maladies.','Thomas Edison'],
['Trouver la santé devrait être le but du soignant. N’importe qui peut trouver la maladie.','Andrew Taylor Still'],
['La vie, c’est comme une bicyclette : il faut avancer pour ne pas perdre l’équilibre.','Albert Einstein','lettre à son fils, 1930'],
['Le corps humain est la meilleure image de l’âme humaine.','Ludwig Wittgenstein'],
['J’ai détesté chaque minute d’entraînement, mais je me disais : n’abandonne pas, souffre maintenant et vis le reste de ta vie en champion.','Muhammad Ali'],
['Le succès n’est pas un accident : c’est du travail, de la persévérance, de l’apprentissage et surtout l’amour de ce que l’on fait.','Pelé']
],
med:[
['La vie est courte, l’art est long, l’occasion fugitive, l’expérience trompeuse, le jugement difficile.','Hippocrate','Aphorismes'],
['Dans les maladies, avoir deux choses en vue : être utile, ou du moins ne pas nuire.','Hippocrate','Épidémies'],
['Écoutez votre patient : il vous donne le diagnostic.','William Osler'],
['La médecine est une science de l’incertitude et un art de la probabilité.','William Osler'],
['Le bon médecin soigne la maladie ; le grand médecin soigne le patient qui a la maladie.','William Osler'],
['Je le pansai, Dieu le guérit.','Ambroise Paré'],
['Guérir parfois, soulager souvent, consoler toujours.','Ambroise Paré','attribué'],
['Science sans conscience n’est que ruine de l’âme.','François Rabelais, médecin','Pantagruel'],
['C’est ce que nous pensons déjà connaître qui nous empêche souvent d’apprendre.','Claude Bernard'],
['Dans les champs de l’observation, le hasard ne favorise que les esprits préparés.','Louis Pasteur'],
['Dans la vie, rien n’est à craindre, tout est à comprendre.','Marie Curie'],
['Ce n’est pas le stress qui nous tue, c’est notre réaction au stress.','Hans Selye'],
['J’attribue mon succès à ceci : je n’ai jamais donné ni accepté d’excuse.','Florence Nightingale']
],
dent:[
['Le sourire est la plus courte distance entre deux personnes.','Victor Borge'],
['Parfois, votre joie est la source de votre sourire ; mais parfois, votre sourire peut être la source de votre joie.','Thich Nhat Hanh'],
['La paix commence par un sourire.','Mère Teresa'],
['Dans les maladies, avoir deux choses en vue : être utile, ou du moins ne pas nuire.','Hippocrate','Épidémies'],
['Écoutez votre patient : il vous donne le diagnostic.','William Osler'],
['La vie est courte, l’art est long, l’occasion fugitive, l’expérience trompeuse, le jugement difficile.','Hippocrate','Aphorismes'],
['Dans les champs de l’observation, le hasard ne favorise que les esprits préparés.','Louis Pasteur'],
['Science sans conscience n’est que ruine de l’âme.','François Rabelais','Pantagruel'],
['Dans la vie, rien n’est à craindre, tout est à comprendre.','Marie Curie']
],
veto:[
['On n’a pas deux cœurs, un pour les animaux et un pour les humains. On a un cœur ou on n’en a pas.','Alphonse de Lamartine'],
['Tant que l’on n’a pas aimé un animal, une partie de notre âme reste endormie.','Anatole France'],
['L’amour pour toutes les créatures vivantes est le plus noble attribut de l’homme.','Charles Darwin','La Filiation de l’homme'],
['Tant que l’homme n’étendra pas le cercle de sa compassion à tous les êtres vivants, il ne trouvera pas la paix.','Albert Schweitzer'],
['Dans les champs de l’observation, le hasard ne favorise que les esprits préparés.','Louis Pasteur'],
['Un homme qui ose perdre une heure n’a pas découvert la valeur de la vie.','Charles Darwin','lettre à sa sœur, 1836'],
['Dans la vie, rien n’est à craindre, tout est à comprendre.','Marie Curie'],
['Écoutez votre patient : il vous donne le diagnostic.','William Osler']
],
inf:[
['Guérir parfois, soulager souvent, consoler toujours.','Ambroise Paré','attribué'],
['J’attribue mon succès à ceci : je n’ai jamais donné ni accepté d’excuse.','Florence Nightingale'],
['Les gens oublieront ce que vous avez dit, ce que vous avez fait, mais jamais ce que vous leur avez fait ressentir.','Maya Angelou','attribué'],
['Dans les maladies, avoir deux choses en vue : être utile, ou du moins ne pas nuire.','Hippocrate','Épidémies'],
['Écoutez votre patient : il vous donne le diagnostic.','William Osler'],
['Le bon médecin soigne la maladie ; le grand médecin soigne le patient qui a la maladie.','William Osler']
],
pharma:[
['Tout est poison, rien n’est sans poison : seule la dose fait qu’une chose n’est pas un poison.','Paracelse'],
['Parfois, on trouve ce que l’on ne cherchait pas.','Alexander Fleming'],
['Dans les champs de l’observation, le hasard ne favorise que les esprits préparés.','Louis Pasteur'],
['C’est ce que nous pensons déjà connaître qui nous empêche souvent d’apprendre.','Claude Bernard'],
['Dans la vie, rien n’est à craindre, tout est à comprendre.','Marie Curie'],
['Dans les maladies, avoir deux choses en vue : être utile, ou du moins ne pas nuire.','Hippocrate','Épidémies']
],
psy:[
['Tout peut être enlevé à l’homme, sauf une chose : la dernière des libertés humaines, choisir son attitude face aux circonstances.','Viktor Frankl','Découvrir un sens à sa vie'],
['Le curieux paradoxe, c’est que lorsque je m’accepte tel que je suis, alors je peux changer.','Carl Rogers'],
['Celui qui regarde à l’extérieur rêve ; celui qui regarde à l’intérieur s’éveille.','Carl Gustav Jung'],
['Connais-toi toi-même.','Socrate','inscription de Delphes'],
['Ce n’est pas le stress qui nous tue, c’est notre réaction au stress.','Hans Selye'],
['Dans la vie, rien n’est à craindre, tout est à comprendre.','Marie Curie']
],
droit:[
['Il faut que, par la disposition des choses, le pouvoir arrête le pouvoir.','Montesquieu','De l’esprit des lois'],
['Les lois inutiles affaiblissent les lois nécessaires.','Montesquieu'],
['Les lois sont faites pour les hommes, et non les hommes pour les lois.','Jean-Étienne-Marie Portalis','Discours préliminaire du Code civil'],
['Nous sommes esclaves des lois pour pouvoir être libres.','Cicéron','Pro Cluentio'],
['La justice sans la force est impuissante ; la force sans la justice est tyrannique.','Blaise Pascal','Pensées'],
['L’obéissance à la loi qu’on s’est prescrite est liberté.','Jean-Jacques Rousseau','Du contrat social'],
['L’injustice, où qu’elle se trouve, est une menace pour la justice partout ailleurs.','Martin Luther King','Lettre de la prison de Birmingham'],
['Ne vous résignez jamais.','Gisèle Halimi']
],
prepa:[
['C’est par la logique qu’on démontre, c’est par l’intuition qu’on invente.','Henri Poincaré'],
['Donnez-moi un point d’appui et je soulèverai le monde.','Archimède'],
['Diviser chacune des difficultés en autant de parcelles qu’il se pourrait pour mieux les résoudre.','René Descartes','Discours de la méthode'],
['Ce que je ne peux pas créer, je ne le comprends pas.','Richard Feynman'],
['La simplicité est la sophistication suprême.','Léonard de Vinci','attribué'],
['Si j’ai vu plus loin, c’est en me tenant sur les épaules de géants.','Isaac Newton']
],
eco:[
['Ce n’est pas de la bienveillance du boucher, du brasseur ou du boulanger que nous attendons notre dîner, mais du soin qu’ils apportent à leurs intérêts.','Adam Smith','La Richesse des nations'],
['À long terme, nous serons tous morts.','John Maynard Keynes'],
['Le prix, c’est ce que vous payez ; la valeur, c’est ce que vous obtenez.','Warren Buffett'],
['Investir dans le savoir rapporte les meilleurs intérêts.','Benjamin Franklin'],
['La meilleure façon de prédire l’avenir, c’est de le créer.','Peter Drucker','attribué'],
['Restez affamés, restez fous.','Steve Jobs','discours de Stanford, 2005']
],
lettres:[
['Les limites de mon langage signifient les limites de mon propre monde.','Ludwig Wittgenstein','Tractatus'],
['Celui qui ne connaît pas les langues étrangères ne connaît rien de sa propre langue.','Goethe'],
['Je n’ai jamais eu de chagrin qu’une heure de lecture ne m’ait ôté.','Montesquieu'],
['Lisez pour vivre.','Gustave Flaubert','lettre, 1857'],
['Si vous parlez à un homme dans une langue qu’il comprend, vous parlez à sa tête. Si vous lui parlez dans sa langue, vous parlez à son cœur.','Nelson Mandela'],
['Fonder des bibliothèques, c’est encore construire des greniers publics.','Marguerite Yourcenar','Mémoires d’Hadrien']
],
sciences:[
['Si j’ai vu plus loin, c’est en me tenant sur les épaules de géants.','Isaac Newton'],
['Rien ne se perd, rien ne se crée, tout se transforme.','Antoine Lavoisier','d’après le Traité élémentaire de chimie'],
['Dans les champs de l’observation, le hasard ne favorise que les esprits préparés.','Louis Pasteur'],
['Dans la vie, rien n’est à craindre, tout est à comprendre.','Marie Curie'],
['La science et la vie de tous les jours ne peuvent pas et ne doivent pas être séparées.','Rosalind Franklin','lettre à son père'],
['L’important est de ne jamais cesser de se poser des questions.','Albert Einstein']
],
info:[
['La phrase la plus dangereuse du langage est : « On a toujours fait comme ça. »','Grace Hopper'],
['La meilleure façon de prédire l’avenir, c’est de l’inventer.','Alan Kay'],
['L’optimisation prématurée est la source de tous les maux.','Donald Knuth'],
['N’importe quel idiot peut écrire du code qu’un ordinateur comprend. Les bons programmeurs écrivent du code que les humains comprennent.','Martin Fowler'],
['La machine analytique tisse des motifs algébriques comme le métier Jacquard tisse des fleurs et des feuilles.','Ada Lovelace'],
['Parler ne coûte rien. Montre-moi le code.','Linus Torvalds']
],
lycee:[
['Un enfant, un professeur, un livre et un stylo peuvent changer le monde.','Malala Yousafzai','discours à l’ONU, 2013'],
['L’éducation est l’arme la plus puissante qu’on puisse utiliser pour changer le monde.','Nelson Mandela'],
['Rien ne sert de courir ; il faut partir à point.','Jean de La Fontaine','Le Lièvre et la Tortue'],
['Un voyage de mille lieues commence toujours par un premier pas.','Lao Tseu'],
['Ce n’est pas parce que les choses sont difficiles que nous n’osons pas, c’est parce que nous n’osons pas qu’elles sont difficiles.','Sénèque','Lettres à Lucilius']
],
learn:[
['L’éducation est l’arme la plus puissante qu’on puisse utiliser pour changer le monde.','Nelson Mandela'],
['Le génie, c’est un pour cent d’inspiration et quatre-vingt-dix-neuf pour cent de transpiration.','Thomas Edison'],
['Ce que l’on conçoit bien s’énonce clairement.','Nicolas Boileau','L’Art poétique'],
['Vingt fois sur le métier remettez votre ouvrage.','Nicolas Boileau','L’Art poétique'],
['Rien ne sert de courir ; il faut partir à point.','Jean de La Fontaine','Le Lièvre et la Tortue'],
['Patience et longueur de temps font plus que force ni que rage.','Jean de La Fontaine','Le Lion et le Rat'],
['Le travail éloigne de nous trois grands maux : l’ennui, le vice et le besoin.','Voltaire','Candide'],
['Mieux vaut une tête bien faite que bien pleine.','Michel de Montaigne','Essais'],
['Apprendre sans réfléchir est vain ; réfléchir sans apprendre est dangereux.','Confucius','Entretiens'],
['Savoir que l’on sait ce que l’on sait, et que l’on ne sait pas ce que l’on ne sait pas : voilà la véritable science.','Confucius','Entretiens'],
['Ce n’est pas parce que les choses sont difficiles que nous n’osons pas, c’est parce que nous n’osons pas qu’elles sont difficiles.','Sénèque','Lettres à Lucilius'],
['Pendant qu’on la remet à plus tard, la vie passe.','Sénèque','Lettres à Lucilius'],
['Les racines de l’éducation sont amères, mais ses fruits sont doux.','Aristote'],
['Ce qu’il faut avoir appris pour le faire, c’est en le faisant que nous l’apprenons.','Aristote','Éthique à Nicomaque'],
['Nous sommes ce que nous faisons de manière répétée. L’excellence n’est donc pas un acte, mais une habitude.','Will Durant'],
['Un voyage de mille lieues commence toujours par un premier pas.','Lao Tseu'],
['On ne fait jamais attention à ce qui a été fait ; on ne voit que ce qui reste à faire.','Marie Curie'],
['Il faut faire de la vie un rêve et faire d’un rêve une réalité.','Pierre Curie'],
['L’important est de ne jamais cesser de se poser des questions.','Albert Einstein'],
['Le premier principe est de ne pas se tromper soi-même, et on est la personne la plus facile à tromper.','Richard Feynman'],
['Ce que je ne peux pas créer, je ne le comprends pas.','Richard Feynman'],
['Je ne crains pas l’homme qui a pratiqué 10 000 coups une fois, mais celui qui a pratiqué un coup 10 000 fois.','Bruce Lee'],
['J’ai raté plus de 9 000 tirs dans ma carrière. J’ai échoué encore et encore. C’est pour ça que je réussis.','Michael Jordan'],
['L’expérience, c’est le nom que chacun donne à ses erreurs.','Oscar Wilde'],
['Ceux qui vivent, ce sont ceux qui luttent.','Victor Hugo','Les Châtiments'],
['Ce qui embellit le désert, c’est qu’il cache un puits quelque part.','Antoine de Saint-Exupéry','Le Petit Prince'],
['Il faut imaginer Sisyphe heureux.','Albert Camus'],
['La patience est amère, mais son fruit est doux.','Jean-Jacques Rousseau']
]};
const SLOT=6*3600*1000;
function getProf(){
  const p=LS('kp_prof','');
  if(PROFS[p])return p;
  try{const c=typeof ls==='function'?ls('kcu_city',null):null;if(c&&PROFS[c.prof]&&c.prof!=='kine')return c.prof;}catch(e){}
  return '';
}
let qShift=0;
function pickQuote(){
  const prof=getProf();
  const own=prof==='sf'?Q.med:prof==='autre'?[]:(prof?Q[prof]:Q.kine)||[];
  const pool=own.map(x=>[x,prof||'kine']).concat(Q.learn.map(x=>[x,'learn']));
  const slot=Math.floor(Date.now()/SLOT)+qShift;
  const i=((slot*7919)%pool.length+pool.length)%pool.length;
  return {q:pool[i][0],cat:pool[i][1],prof};
}
function renderQuote(){
  const el=$('kh-quote');if(!el)return;
  const r=pickQuote(),[text,who,src]=r.q;
  const tag=r.cat==='learn'?'Apprendre':(PROFS[r.cat]||PROFS.kine).n;
  el.innerHTML=`<span class="kh-quote-mark" aria-hidden="true">“</span>
    <blockquote class="kh-quote-t">${esc(text)}</blockquote>
    <div class="kh-quote-m"><span class="kh-quote-who">${esc(who)}</span>${src?`<span class="kh-quote-src">${esc(src)}</span>`:''}
      <span class="kh-quote-tag">${esc(tag)}</span>
      ${r.prof?'':`<a class="kh-link" onclick="event.stopPropagation();kcPickProf()">Choisir ma filière</a>`}
      <button class="kh-quote-next" type="button" title="Une autre citation" onclick="event.stopPropagation();kcNextQuote()"><span class="ms">refresh</span></button></div>`;
}
window.kcNextQuote=function(){qShift++;const el=$('kh-quote');if(el){el.classList.remove('kh-q-in');void el.offsetWidth;el.classList.add('kh-q-in');}renderQuote();};
window.kcSetProf=function(p){
  if(!PROFS[p])return;
  SS('kp_prof',p);
  renderQuote();renderProfCard();
  try{document.dispatchEvent(new CustomEvent('kc-prof',{detail:p}));}catch(e){}
  const m=$('kc-prof-modal');if(m)m.remove();
  if(typeof showNotif==='function')showNotif('Filière : '+PROFS[p].n,'ok');
};
window.kcPickProf=function(){
  let m=$('kc-prof-modal');if(m)m.remove();
  m=document.createElement('div');m.id='kc-prof-modal';m.className='kc-prof-modal';
  m.innerHTML=`<div class="kc-prof-box" role="dialog" aria-label="Ta filière"><h3>Tu étudies…</h3><p>Pour des phrases qui te parlent sur l’accueil.</p>
    <div class="kc-prof-grid">${Object.entries(PROFS).map(([k,v])=>`<button class="kc-prof-opt${getProf()===k?' on':''}" onclick="kcSetProf('${k}')"><span class="ms">${v.ic}</span>${v.n}</button>`).join('')}</div>
    <button class="btn btn-g" onclick="this.closest('.kc-prof-modal').remove()">Plus tard</button></div>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
  document.body.appendChild(m);
};
function renderProfCard(){
  const box=$('kp-prof-grid');if(!box)return;
  const cur=getProf();
  box.innerHTML=Object.entries(PROFS).map(([k,v])=>`<button class="kc-prof-opt${cur===k?' on':''}" onclick="kcSetProf('${k}')"><span class="ms">${v.ic}</span>${v.n}</button>`).join('');
}
window.kcProfSelectHTML=function(){
  const cur=getProf();
  return `<div class="fg2"><label class="fl" for="au-prof">Tu étudies…</label><select class="fi" id="au-prof" onchange="if(this.value)kcSetProf(this.value)"><option value="">Choisir ma filière</option>${Object.entries(PROFS).map(([k,v])=>`<option value="${k}"${cur===k?' selected':''}>${v.n}</option>`).join('')}</select></div>`;
};

/* ───────── 2. Sons ───────── */
/* v84 (21 nov. 2026) : 6 nouveaux sons de clavier et 8 nouveaux clics, plus « satisfaisants » (thock grave, clicky, gouttes,
   carillon qui joue une petite mélodie, crayon, rétro…) */
const KEY_SOUNDS=[['Mécanique','keyboard'],['Doux','cloud'],['Machine à écrire','history_edu'],['Bulle','bubble_chart'],
  ['Thock grave','graphic_eq'],['Clicky','keyboard_alt'],['Gouttes d’eau','water_drop'],['Carillon','music_note'],['Crayon','edit'],['Rétro 8-bit','sports_esports']];
const CLICK_SOUNDS=[['Tic','touch_app'],['Pop','radio_button_checked'],['Cristal','diamond'],['Bois','forest'],
  ['Bulle','bubble_chart'],['Interrupteur','toggle_on'],['Goutte','water_drop'],['Marimba','piano'],['Arcade','sports_esports'],['Feutré','cloud'],['Carillon','notifications'],['Déclic photo','photo_camera']];
const cfg=()=>({keys:LS('kp_snd_keys','0')==='1',kt:Math.min(KEY_SOUNDS.length-1,+LS('kp_snd_keys_t','0')||0),click:LS('kp_snd_click','0')==='1',ct:Math.min(CLICK_SOUNDS.length-1,+LS('kp_snd_click_t','0')||0),vol:Math.max(0,Math.min(100,+LS('kp_snd_vol','60'))) /100});
let AC=null,noiseBuf=null;
function ac(){
  if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}}
  if(AC.state==='suspended')AC.resume().catch(()=>{});
  if(!noiseBuf){noiseBuf=AC.createBuffer(1,AC.sampleRate*.25|0,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  return AC;
}
function env(c,g,t,a,peak,dur){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);}
function tone(c,out,{type='sine',f=440,f2=null,t=0,a=.002,dur=.08,gain=.3}){
  const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  env(c,g,t,a,gain,dur);o.connect(g);g.connect(out);o.start(t);o.stop(t+dur+.02);
}
function noise(c,out,{t=0,dur=.04,gain=.3,type='highpass',f=2000,q=.8,a=.001}){
  const s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();
  s.buffer=noiseBuf;fl.type=type;fl.frequency.value=f;fl.Q.value=q;
  env(c,g,t,a,gain,dur);s.connect(fl);fl.connect(g);g.connect(out);s.start(t,Math.random()*.15);s.stop(t+dur+.02);
}
const vary=(x,p)=>x*(1+(Math.random()*2-1)*p);
function play(kind,idx,special){
  const c=ac();if(!c)return;
  const v=cfg().vol;if(v<=0)return;
  const out=c.createGain();out.gain.value=v*.9;
  /* v84 : petite pièce (réverbération très courte) + léger placement gauche / droite → son plus plein, plus « satisfaisant » */
  if(!c._kv){try{const L=c.sampleRate*.22|0,ir=c.createBuffer(2,L,c.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<L;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/L,3.2);}
    const cv=c.createConvolver();cv.buffer=ir;const rg=c.createGain();rg.gain.value=.16;cv.connect(rg);rg.connect(c.destination);c._kv=cv;}catch(e){c._kv=null;}}
  let pn=null;if(c.createStereoPanner){pn=c.createStereoPanner();pn.pan.value=(Math.random()*2-1)*.18;out.connect(pn);pn.connect(c.destination);}else out.connect(c.destination);
  if(c._kv)out.connect(c._kv);
  const t=c.currentTime+.001;
  if(kind==='key'){
    if(idx===0){ // Mécanique : clic sec + petit « clac »
      noise(c,out,{t,dur:.025,gain:.5,f:vary(3200,.1),q:1.2});
      tone(c,out,{type:'square',f:vary(special?1400:1900,.06),t,dur:.018,gain:.06});
      noise(c,out,{t:t+.028,dur:.03,gain:.22,type:'bandpass',f:vary(900,.1),q:2});
    }else if(idx===1){ // Doux : « toc » feutré
      tone(c,out,{f:vary(special?150:210,.08),f2:90,t,a:.003,dur:.07,gain:.5});
      noise(c,out,{t,dur:.035,gain:.12,type:'lowpass',f:1200,q:.5});
    }else if(idx===2){ // Machine à écrire : frappe métallique, sonnette sur Entrée
      noise(c,out,{t,dur:.035,gain:.55,type:'bandpass',f:vary(2400,.12),q:3});
      tone(c,out,{type:'triangle',f:vary(130,.05),t,dur:.04,gain:.25});
      if(special==='enter'){tone(c,out,{f:2093,t:t+.05,a:.002,dur:.6,gain:.18});tone(c,out,{f:4186,t:t+.05,dur:.35,gain:.05});}
    }else if(idx===3){ // Bulle
      const f=vary(special?520:760,.12);tone(c,out,{f,f2:f*.45,t,a:.002,dur:.06,gain:.35});
    }else if(idx===4){ // Thock grave : touche lubrifiée, gros « thock » profond
      tone(c,out,{f:vary(special?92:128,.07),f2:58,t,a:.0015,dur:.1,gain:.6});
      noise(c,out,{t,dur:.018,gain:.32,type:'lowpass',f:vary(2000,.1),q:.7});
      noise(c,out,{t:t+.004,dur:.05,gain:.14,type:'bandpass',f:vary(520,.1),q:1.6});
    }else if(idx===5){ // Clicky : double clic sec du ressort + fond de course
      noise(c,out,{t,dur:.006,gain:.62,f:vary(4800,.08),q:1});
      noise(c,out,{t:t+.011,dur:.007,gain:.42,f:vary(3900,.08),q:1});
      tone(c,out,{type:'square',f:vary(3300,.04),t,dur:.008,gain:.045});
      tone(c,out,{f:vary(special?120:165,.06),f2:80,t:t+.018,dur:.05,gain:.3});
    }else if(idx===6){ // Gouttes d'eau : « bloup » qui remonte
      const f=vary(special?520:820,.18);tone(c,out,{f,f2:f*2.3,t,a:.002,dur:.05,gain:.32});tone(c,out,{f:f*2.3,t:t+.03,a:.002,dur:.09,gain:.07});
    }else if(idx===7){ // Carillon : chaque touche joue la note suivante d'une gamme (petite mélodie)
      const P=[523.3,587.3,659.3,784,880,1046.5,1174.7,1318.5,1568,1760];
      if(special==='enter'){[0,2,4,7].forEach((k,j)=>tone(c,out,{f:P[k],t:t+j*.07,a:.003,dur:.5,gain:.14}));}
      else{play.ci=Math.max(0,Math.min(P.length-1,(play.ci==null?4:play.ci)+(special==='big'?-2:[-1,1,1,2,-2,0][(Math.random()*6)|0])));
        const f=P[play.ci];tone(c,out,{f,t,a:.003,dur:.42,gain:.16});tone(c,out,{f:f*2,t,a:.003,dur:.2,gain:.04});tone(c,out,{type:'triangle',f:f*3,t,dur:.06,gain:.02});}
    }else if(idx===8){ // Crayon : petit grattement sur le papier
      noise(c,out,{t,a:.006,dur:vary(.055,.3),gain:.3,type:'bandpass',f:vary(3600,.25),q:.9});
      noise(c,out,{t:t+.01,dur:.03,gain:.1,type:'bandpass',f:vary(6000,.2),q:1.5});
    }else{ // Rétro 8-bit
      const P=[880,987.8,1046.5,1174.7,1318.5,1568];const f=special?440:P[(Math.random()*P.length)|0];
      tone(c,out,{type:'square',f,t,a:.001,dur:.045,gain:.07});if(special==='enter')tone(c,out,{type:'square',f:f*1.5,t:t+.05,a:.001,dur:.08,gain:.06});
    }
  }else{
    if(idx===0){ // Tic
      tone(c,out,{type:'triangle',f:vary(2200,.03),t,dur:.025,gain:.3});
      noise(c,out,{t,dur:.012,gain:.18,f:5000});
    }else if(idx===1){ // Pop
      tone(c,out,{f:vary(880,.04),f2:280,t,a:.002,dur:.09,gain:.42});
    }else if(idx===2){ // Cristal
      const f=vary(1568,.02);tone(c,out,{f,t,a:.002,dur:.35,gain:.16});tone(c,out,{f:f*1.5,t,a:.002,dur:.22,gain:.07});tone(c,out,{f:f*2.01,t,dur:.12,gain:.04});
    }else if(idx===3){ // Bois
      noise(c,out,{t,dur:.05,gain:.35,type:'bandpass',f:vary(1100,.05),q:6});
      tone(c,out,{type:'triangle',f:vary(620,.03),f2:520,t,dur:.06,gain:.3});
    }else if(idx===4){ // Bulle qui éclate
      const f=vary(420,.1);tone(c,out,{f,f2:f*3,t,a:.002,dur:.055,gain:.38});noise(c,out,{t:t+.045,dur:.012,gain:.12,f:3500});
    }else if(idx===5){ // Interrupteur : clic-clac
      noise(c,out,{t,dur:.014,gain:.5,type:'bandpass',f:vary(2600,.05),q:4});tone(c,out,{f:vary(240,.05),f2:150,t,dur:.03,gain:.2});
      noise(c,out,{t:t+.04,dur:.012,gain:.3,type:'bandpass',f:vary(1900,.05),q:4});
    }else if(idx===6){ // Goutte d'eau
      const f=vary(700,.1);tone(c,out,{f,f2:f*2.6,t,a:.002,dur:.035,gain:.36});tone(c,out,{f:f*2.6,t:t+.03,a:.002,dur:.14,gain:.08});
    }else if(idx===7){ // Marimba : note ronde et boisée
      const P=[523.3,587.3,659.3,784,880];const f=P[(Math.random()*P.length)|0];
      tone(c,out,{f,t,a:.002,dur:.32,gain:.38});tone(c,out,{f:f*3.93,t,a:.001,dur:.05,gain:.1});noise(c,out,{t,dur:.01,gain:.08,type:'bandpass',f:f*2,q:3});
    }else if(idx===8){ // Arcade : petite montée de 3 notes
      [659.3,830.6,987.8].forEach((f,j)=>tone(c,out,{type:'square',f,t:t+j*.035,a:.001,dur:.04,gain:.06}));
    }else if(idx===9){ // Feutré : « tomp » doux
      tone(c,out,{f:vary(190,.05),f2:105,t,a:.003,dur:.07,gain:.5});noise(c,out,{t,dur:.025,gain:.1,type:'lowpass',f:900,q:.5});
    }else if(idx===10){ // Carillon : petite cloche claire
      const P=[1318.5,1568,1760,2093,2349];const f=P[(Math.random()*P.length)|0];
      tone(c,out,{type:'triangle',f,t,a:.002,dur:.5,gain:.12});tone(c,out,{f:f*2.76,t,a:.002,dur:.18,gain:.035});
    }else{ // Déclic photo
      noise(c,out,{t,dur:.02,gain:.5,f:vary(1800,.05),q:.7});noise(c,out,{t:t+.055,dur:.03,gain:.32,type:'bandpass',f:vary(1200,.05),q:1.2});
    }
  }
  setTimeout(()=>{try{out.disconnect();}catch(e){}try{pn&&pn.disconnect();}catch(e){}},1200);
}
window.kcPlaySound=play;
const isTyping=el=>el&&(el.isContentEditable||(el.tagName==='TEXTAREA')||(el.tagName==='INPUT'&&!/^(checkbox|radio|range|button|submit|color|file)$/i.test(el.type)));
let lastKey=0;
document.addEventListener('keydown',e=>{
  const s=cfg();if(!s.keys||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  if(!isTyping(e.target))return;
  if(e.key.length!==1&&!/^(Backspace|Enter|Delete|Tab)$/.test(e.key))return;
  const now=performance.now();if(now-lastKey<18)return;lastKey=now;
  play('key',s.kt,e.key==='Enter'?'enter':(e.key===' '||e.key==='Backspace')?'big':null);
},true);
const CLICKABLE='button,a,[onclick],[role="button"],[role="tab"],select,label,input[type="checkbox"],input[type="radio"],summary,.ni,.kh-mode,.matiere-hub-item,.ci';
let lastClick=0;
document.addEventListener('pointerdown',e=>{
  const s=cfg();if(!s.click||e.button!==0)return;
  const t=e.target;if(!t||!t.closest||t.tagName==='CANVAS'||t.closest('canvas,.km-app'))return;
  const el=t.closest(CLICKABLE);if(!el||el.disabled)return;
  const now=performance.now();if(now-lastClick<40)return;lastClick=now;
  play('click',s.ct);
},{capture:true,passive:true});

function renderSoundCard(){
  const box=$('kp-sound-body');if(!box)return;
  const s=cfg();
  const row=(id,title,desc,on,list,cur,kind)=>`
    <div class="kc-snd-row">
      <div class="kc-snd-h"><div><b>${title}</b><small>${desc}</small></div>
        <label class="kp-switch"><input type="checkbox" ${on?'checked':''} onchange="kcSnd('${id}',this.checked?'1':'0')"><span></span></label></div>
      <div class="kc-snd-opts${on?'':' off'}">${list.map(([n,ic],i)=>`<button class="kc-snd-opt${cur===i?' on':''}" onclick="kcSnd('${id}_t',${i});kcPlaySound('${kind}',${i})" title="Écouter et choisir"><span class="ms">${ic}</span>${n}</button>`).join('')}</div>
    </div>`;
  box.innerHTML=row('kp_snd_keys','Touches du clavier','Un son quand tu écris dans un champ',s.keys,KEY_SOUNDS,s.kt,'key')+
    row('kp_snd_click','Clics','Un son quand tu cliques sur un bouton ou une fonctionnalité',s.click,CLICK_SOUNDS,s.ct,'click')+
    `<div class="kc-snd-vol"><span class="ms">volume_down</span><input type="range" min="0" max="100" value="${Math.round(s.vol*100)}" data-no-step aria-label="Volume des sons"
      oninput="kcSnd('kp_snd_vol',this.value,true)" onchange="kcPlaySound('click',${s.ct})"><span class="ms">volume_up</span></div>`;
}
window.kcSnd=function(k,v,quiet){
  SS(k,String(v));
  if(!quiet)renderSoundCard();
  if(k==='kp_snd_keys'&&v==='1')play('key',cfg().kt);
  if(k==='kp_snd_click'&&v==='1')play('click',cfg().ct);
};

/* ───────── Démarrage ───────── */
function start(){
  renderQuote();renderSoundCard();renderProfCard();
  setInterval(renderQuote,10*60*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderQuote();});
  const orig=window.showScreen;
  if(typeof orig==='function'&&!orig._kcx){
    const w=function(id){const r=orig.apply(this,arguments);if(id==='home')renderQuote();if(id==='parametres'||id==='settings'){renderSoundCard();renderProfCard();}return r;};
    w._kcx=true;Object.keys(orig).forEach(k=>{try{w[k]=orig[k];}catch(e){}});window.showScreen=w;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
