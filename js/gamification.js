'use strict';

/* =========================================================
   gamification.js — XP, niveaux, personnage, maison 3D
   Données locales : localStorage 'kcu_gam'.
   La synchro avec le serveur (comptes, classement) est faite
   par social.js via gamSealOutbox() / gamAckOutbox().
   ========================================================= */

// ── Barème d'XP ──
const GAM_XP={correct:5,wrong:1,session:10,perfect:15,goal:25,streakDay:3,streakCap:10,fcKnew:2,fcAgain:1};
const GAM_RETRO_CAP_LEVEL=10;   // le bonus d'ancienneté ne dépasse pas le niveau 10

// ── Pièces de la maison (coordonnées en cases de 1 m) ──
const GAM_ROOMS=[
  {id:'chambre', name:'Chambre',        level:1,  x:0,  z:0,  w:6,  d:6,  indoor:true,  icon:'bed'},
  {id:'salon',   name:'Salon',          level:3,  x:6,  z:0,  w:7,  d:6,  indoor:true,  icon:'weekend'},
  {id:'jardin',  name:'Jardin',         level:5,  x:0,  z:11, w:9,  d:6,  indoor:false, icon:'yard'},
  {id:'cuisine', name:'Cuisine',        level:7,  x:13, z:0,  w:6,  d:6,  indoor:true,  icon:'kitchen'},
  {id:'sdb',     name:'Salle de bain',  level:10, x:5,  z:6,  w:4,  d:5,  indoor:true,  icon:'bathtub'},
  {id:'bureau',  name:'Bureau',         level:13, x:0,  z:6,  w:5,  d:5,  indoor:true,  icon:'desk'},
  {id:'sport',   name:'Salle de sport', level:16, x:9,  z:6,  w:5,  d:5,  indoor:true,  icon:'fitness_center'},
  {id:'cabinet', name:'Cabinet de kiné',level:20, x:14, z:6,  w:5,  d:5,  indoor:true,  icon:'accessibility_new'},
  {id:'piscine', name:'Piscine',        level:24, x:9,  z:11, w:10, d:6,  indoor:false, icon:'pool'},
  {id:'terrasse',name:'Terrasse',       level:28, x:19, z:0,  w:5,  d:11, indoor:false, icon:'deck'}
];
// Bassin de la piscine (cases non constructibles)
const GAM_POOL={x:11,z:12,w:6,d:3};

// ── Personnages ── (v75, 20 nov. 2026 : 22 nouveaux animaux, tenues, expressions, plus de chapeaux / visages / couleurs)
const GAM_SPECIES=[
  {id:'blob',name:'Pilou',level:1},
  {id:'ours',name:'Nounours',level:1},
  {id:'chat',name:'Minou',level:1},
  {id:'lapin',name:'Lapinou',level:1},
  {id:'grenouille',name:'Rainette',level:1},
  {id:'souris',name:'Souris',level:1},
  {id:'renard',name:'Renard',level:1},
  {id:'panda',name:'Panda',level:1},
  {id:'koala',name:'Koala',level:1},
  {id:'chien',name:'Toutou',level:1},
  {id:'pingouin',name:'Pingouin',level:1},
  {id:'hamster',name:'Hamster',level:1},
  {id:'cochon',name:'Cochon',level:1},
  {id:'poussin',name:'Poussin',level:1},
  {id:'mouton',name:'Mouton',level:1},
  {id:'hibou',name:'Hibou',level:3},
  {id:'tigre',name:'Tigre',level:5},
  {id:'vache',name:'Vache',level:7},
  {id:'raton',name:'Raton laveur',level:9},
  {id:'robot',name:'Robot',level:10},
  {id:'axolotl',name:'Axolotl',level:13},
  {id:'herisson',name:'Hérisson',level:15},
  {id:'requin',name:'Requin',level:17},
  {id:'abeille',name:'Abeille',level:19},
  {id:'dragon',name:'Dragon',level:20},
  {id:'elephant',name:'Éléphant',level:21},
  {id:'lion',name:'Lion',level:24},
  {id:'dino',name:'Dino',level:27},
  {id:'licorne',name:'Licorne',level:30},
  {id:'fantome',name:'Fantôme',level:32},
  {id:'alien',name:'Alien',level:35}
];
const GAM_COLORS=[
  {id:'corail',name:'Corail',hex:'#ef7d6d',level:1},
  {id:'moutarde',name:'Moutarde',hex:'#f2c14e',level:1},
  {id:'menthe',name:'Menthe',hex:'#7dcfa0',level:1},
  {id:'ciel',name:'Ciel',hex:'#6cb4ee',level:1},
  {id:'lilas',name:'Lilas',hex:'#b79ce8',level:1},
  {id:'rose',name:'Rose',hex:'#f5a3c7',level:1},
  {id:'framboise',name:'Framboise',hex:'#e5487a',level:1},
  {id:'peche',name:'Pêche',hex:'#ffbf9b',level:1},
  {id:'pistache',name:'Pistache',hex:'#b5d98a',level:1},
  {id:'sapin',name:'Sapin',hex:'#3d8b5f',level:1},
  {id:'ocean',name:'Océan',hex:'#2f6fb3',level:2},
  {id:'turquoise',name:'Turquoise',hex:'#3fc9c0',level:3},
  {id:'lavande',name:'Lavande',hex:'#9c8ff0',level:4},
  {id:'blanc',name:'Blanc',hex:'#f7f7f2',level:5},
  {id:'orange',name:'Orange',hex:'#ff9447',level:6},
  {id:'perle',name:'Gris perle',hex:'#cfd6de',level:7},
  {id:'chocolat',name:'Chocolat',hex:'#9c7360',level:9},
  {id:'cerise',name:'Cerise',hex:'#d23b3b',level:10},
  {id:'creme',name:'Crème',hex:'#f3ead8',level:12},
  {id:'nuit',name:'Nuit',hex:'#4a5a86',level:15},
  {id:'charbon',name:'Charbon',hex:'#3b3f4a',level:18},
  {id:'or',name:'Or',hex:'#e3b23c',level:25}
];
const GAM_HATS=[
  {id:'noeud',name:'Nœud',level:1},
  {id:'fleurs',name:'Couronne de fleurs',level:1},
  {id:'bandeau',name:'Bandeau de sport',level:2},
  {id:'bob',name:'Bob',level:3},
  {id:'casquette',name:'Casquette',level:4},
  {id:'diplome',name:'Toque de diplômé',level:5},
  {id:'noel',name:'Bonnet de Noël',level:7},
  {id:'beret',name:'Béret',level:8},
  {id:'fete',name:'Chapeau de fête',level:9},
  {id:'chantier',name:'Casque de chantier',level:10},
  {id:'bonnet',name:'Bonnet',level:11},
  {id:'sorcier',name:'Chapeau de sorcier',level:13},
  {id:'paille',name:'Chapeau de paille',level:14},
  {id:'pirate',name:'Chapeau de pirate',level:17},
  {id:'toque',name:'Toque',level:18},
  {id:'viking',name:'Casque viking',level:21},
  {id:'casque',name:'Casque audio',level:22},
  {id:'cowboy',name:'Chapeau de cowboy',level:24},
  {id:'hautdeforme',name:'Haut-de-forme',level:26},
  {id:'aureole',name:'Auréole',level:28},
  {id:'couronne',name:'Couronne',level:30}
];
const GAM_FACES=[
  {id:'rousseur',name:'Taches de rousseur',level:1},
  {id:'masque',name:'Masque médical',level:2},
  {id:'coeur',name:'Lunettes cœur',level:3},
  {id:'pansement',name:'Pansement',level:4},
  {id:'lunettes',name:'Lunettes rondes',level:6},
  {id:'monocle',name:'Monocle',level:9},
  {id:'soleil',name:'Lunettes de soleil',level:12},
  {id:'moustache',name:'Moustache',level:16},
  {id:'barbe',name:'Barbe',level:18},
  {id:'cache',name:'Cache-œil',level:20}
];
const GAM_OUTFITS=[
  {id:'papillon',name:'Nœud papillon',level:1},
  {id:'echarpe',name:'Écharpe',level:1},
  {id:'stetho',name:'Stéthoscope',level:3},
  {id:'blouse',name:'Blouse blanche',level:5},
  {id:'cravate',name:'Cravate',level:8},
  {id:'collier',name:'Collier de fleurs',level:11},
  {id:'medaille',name:'Médaille d’or',level:14},
  {id:'sacados',name:'Sac à dos',level:16},
  {id:'cape',name:'Cape de héros',level:20}
];
const GAM_MOODS=[
  {id:'joie',name:'Joyeux',level:1},
  {id:'clin',name:'Clin d’œil',level:1},
  {id:'langue',name:'Langue tirée',level:2},
  {id:'surpris',name:'Surpris',level:5},
  {id:'amour',name:'Amoureux',level:8},
  {id:'etoiles',name:'Émerveillé',level:12},
  {id:'dodo',name:'Endormi',level:15}
];

// ── Meubles (w × d = emprise au sol en cases ; flat = tapis, superposable) ──
const GAM_FURNITURE=[
  {id:'lit',name:'Lit',cat:'chambre',level:1,w:2,d:3,icon:'bed'},
  {id:'chevet',name:'Table de chevet',cat:'chambre',level:1,w:1,d:1,icon:'nightlight'},
  {id:'plante',name:'Plante en pot',cat:'chambre',level:1,w:1,d:1,icon:'potted_plant'},
  {id:'tapis_rond',name:'Tapis rond',cat:'chambre',level:1,w:2,d:2,icon:'circle',flat:true},
  {id:'armoire',name:'Armoire',cat:'chambre',level:2,w:2,d:1,icon:'door_sliding'},
  {id:'bureau_etude',name:'Bureau d’étude',cat:'chambre',level:2,w:2,d:1,icon:'desk'},
  {id:'chaise',name:'Chaise',cat:'chambre',level:2,w:1,d:1,icon:'chair_alt'},
  {id:'etagere',name:'Étagère à livres',cat:'chambre',level:4,w:2,d:1,icon:'shelves'},
  {id:'lampadaire',name:'Lampadaire',cat:'chambre',level:4,w:1,d:1,icon:'floor_lamp'},
  {id:'pouf',name:'Pouf',cat:'chambre',level:5,w:1,d:1,icon:'radio_button_unchecked'},
  {id:'canape',name:'Canapé',cat:'salon',level:3,w:3,d:1,icon:'weekend'},
  {id:'table_basse',name:'Table basse',cat:'salon',level:3,w:2,d:1,icon:'table_bar'},
  {id:'tv',name:'Meuble TV',cat:'salon',level:3,w:2,d:1,icon:'tv'},
  {id:'tapis_rect',name:'Grand tapis',cat:'salon',level:3,w:3,d:2,icon:'rectangle',flat:true},
  {id:'fauteuil',name:'Fauteuil',cat:'salon',level:4,w:1,d:1,icon:'chair'},
  {id:'plante_haute',name:'Grande plante',cat:'salon',level:5,w:1,d:1,icon:'psychiatry'},
  {id:'bibliotheque',name:'Bibliothèque',cat:'salon',level:6,w:2,d:1,icon:'menu_book'},
  {id:'piano',name:'Piano',cat:'salon',level:12,w:2,d:1,icon:'piano'},
  {id:'arbre',name:'Arbre',cat:'jardin',level:5,w:1,d:1,icon:'park'},
  {id:'buisson',name:'Buisson',cat:'jardin',level:5,w:1,d:1,icon:'grass'},
  {id:'fleurs',name:'Massif de fleurs',cat:'jardin',level:5,w:2,d:1,icon:'local_florist'},
  {id:'banc',name:'Banc',cat:'jardin',level:6,w:2,d:1,icon:'chair'},
  {id:'reverbere',name:'Réverbère',cat:'jardin',level:7,w:1,d:1,icon:'light'},
  {id:'fontaine',name:'Fontaine',cat:'jardin',level:9,w:2,d:2,icon:'water_drop'},
  {id:'balancoire',name:'Balançoire',cat:'jardin',level:11,w:2,d:1,icon:'toys'},
  {id:'frigo',name:'Frigo',cat:'cuisine',level:7,w:1,d:1,icon:'kitchen'},
  {id:'plan_travail',name:'Plan de travail',cat:'cuisine',level:7,w:3,d:1,icon:'countertops'},
  {id:'table_cuisine',name:'Table & chaises',cat:'cuisine',level:7,w:2,d:2,icon:'table_restaurant'},
  {id:'four',name:'Cuisinière',cat:'cuisine',level:8,w:1,d:1,icon:'microwave'},
  {id:'tabouret',name:'Tabouret',cat:'cuisine',level:8,w:1,d:1,icon:'chair_alt'},
  {id:'baignoire',name:'Baignoire',cat:'sdb',level:10,w:2,d:1,icon:'bathtub'},
  {id:'lavabo',name:'Lavabo',cat:'sdb',level:10,w:1,d:1,icon:'wash'},
  {id:'tapis_bain',name:'Tapis de bain',cat:'sdb',level:10,w:1,d:1,icon:'rectangle',flat:true},
  {id:'douche',name:'Douche',cat:'sdb',level:11,w:1,d:1,icon:'shower'},
  {id:'bureau_pc',name:'Bureau & ordinateur',cat:'bureau',level:13,w:2,d:1,icon:'computer'},
  {id:'chaise_bureau',name:'Chaise de bureau',cat:'bureau',level:13,w:1,d:1,icon:'chair_alt'},
  {id:'classeur',name:'Classeur',cat:'bureau',level:13,w:1,d:1,icon:'inventory_2'},
  {id:'tableau_blanc',name:'Tableau blanc',cat:'bureau',level:14,w:2,d:1,icon:'developer_board'},
  {id:'tapis_yoga',name:'Tapis de yoga',cat:'sport',level:16,w:1,d:2,icon:'self_improvement',flat:true},
  {id:'halteres',name:'Haltères',cat:'sport',level:16,w:1,d:1,icon:'fitness_center'},
  {id:'swiss_ball',name:'Swiss ball',cat:'sport',level:16,w:1,d:1,icon:'sports_volleyball'},
  {id:'velo',name:'Vélo d’appartement',cat:'sport',level:17,w:1,d:2,icon:'pedal_bike'},
  {id:'banc_muscu',name:'Banc de muscu',cat:'sport',level:18,w:1,d:2,icon:'fitness_center'},
  {id:'table_massage',name:'Table de massage',cat:'cabinet',level:20,w:1,d:2,icon:'massage'},
  {id:'squelette',name:'Squelette anatomique',cat:'cabinet',level:20,w:1,d:1,icon:'skeleton'},
  {id:'espalier',name:'Espalier',cat:'cabinet',level:20,w:2,d:1,icon:'view_week'},
  {id:'barres',name:'Barres parallèles',cat:'cabinet',level:21,w:1,d:3,icon:'drag_handle'},
  {id:'plateau',name:'Plateau de Freeman',cat:'cabinet',level:22,w:1,d:1,icon:'adjust'},
  {id:'transat',name:'Transat',cat:'piscine',level:24,w:1,d:2,icon:'beach_access'},
  {id:'parasol',name:'Parasol',cat:'piscine',level:24,w:1,d:1,icon:'beach_access'},
  {id:'bouee',name:'Bouée',cat:'piscine',level:25,w:1,d:1,icon:'trip_origin'},
  {id:'salon_jardin',name:'Salon de jardin',cat:'terrasse',level:28,w:2,d:2,icon:'deck'},
  {id:'barbecue',name:'Barbecue',cat:'terrasse',level:28,w:1,d:1,icon:'outdoor_grill'},
  {id:'hamac',name:'Hamac',cat:'terrasse',level:29,w:1,d:3,icon:'airline_seat_flat'},
  {id:'lanternes',name:'Guirlande lumineuse',cat:'terrasse',level:30,w:1,d:1,icon:'emoji_objects'},
  // Décorations ajoutées en v2 (nv:2 → badge « Nouveau » tant qu'on ne les a pas posées)
  {id:'peluche',name:'Ours en peluche',cat:'chambre',level:2,w:1,d:1,icon:'toys',nv:2},
  {id:'pile_livres',name:'Pile de livres',cat:'chambre',level:2,w:1,d:1,icon:'auto_stories',nv:2},
  {id:'bougies',name:'Bougies',cat:'chambre',level:3,w:1,d:1,icon:'local_fire_department',nv:2},
  {id:'pouf_poire',name:'Pouf poire',cat:'chambre',level:4,w:1,d:1,icon:'chair',nv:2},
  {id:'miroir',name:'Miroir sur pied',cat:'chambre',level:5,w:1,d:1,icon:'crop_portrait',nv:2},
  {id:'globe',name:'Globe terrestre',cat:'chambre',level:6,w:1,d:1,icon:'public',nv:2},
  {id:'guitare',name:'Guitare',cat:'chambre',level:7,w:1,d:1,icon:'music_note',nv:2},
  {id:'horloge',name:'Horloge comtoise',cat:'chambre',level:9,w:1,d:1,icon:'schedule',nv:2},
  {id:'lit_double',name:'Lit double',cat:'chambre',level:10,w:3,d:3,icon:'king_bed',nv:2},
  {id:'cactus',name:'Cactus',cat:'salon',level:3,w:1,d:1,icon:'nature',nv:2},
  {id:'lampe_arc',name:'Lampe arc',cat:'salon',level:5,w:1,d:1,icon:'light',nv:2},
  {id:'etagere_cubes',name:'Étagère cubes',cat:'salon',level:6,w:2,d:1,icon:'grid_view',nv:2},
  {id:'cheminee',name:'Cheminée',cat:'salon',level:8,w:2,d:1,icon:'fireplace',nv:2},
  {id:'platine',name:'Platine vinyle',cat:'salon',level:9,w:1,d:1,icon:'album',nv:2},
  {id:'aquarium',name:'Aquarium',cat:'salon',level:10,w:2,d:1,icon:'set_meal',nv:2},
  {id:'canape_angle',name:'Canapé d’angle',cat:'salon',level:11,w:3,d:2,icon:'weekend',nv:2},
  {id:'rochers',name:'Rochers',cat:'jardin',level:5,w:1,d:1,icon:'landscape',nv:2},
  {id:'nain_jardin',name:'Nain de jardin',cat:'jardin',level:6,w:1,d:1,icon:'person',nv:2},
  {id:'nichoir',name:'Nichoir à oiseaux',cat:'jardin',level:7,w:1,d:1,icon:'cottage',nv:2},
  {id:'bac_potager',name:'Bac potager',cat:'jardin',level:8,w:2,d:1,icon:'eco',nv:2},
  {id:'brouette',name:'Brouette',cat:'jardin',level:9,w:1,d:1,icon:'agriculture',nv:2},
  {id:'tente',name:'Tente',cat:'jardin',level:10,w:2,d:2,icon:'camping',nv:2},
  {id:'trampoline',name:'Trampoline',cat:'jardin',level:12,w:2,d:2,icon:'sports_gymnastics',nv:2},
  {id:'palmier',name:'Palmier',cat:'jardin',level:14,w:1,d:1,icon:'park',nv:2},
  {id:'corbeille_fruits',name:'Corbeille de fruits',cat:'cuisine',level:7,w:1,d:1,icon:'nutrition',nv:2},
  {id:'machine_cafe',name:'Machine à café',cat:'cuisine',level:8,w:1,d:1,icon:'coffee_maker',nv:2},
  {id:'ilot',name:'Îlot central',cat:'cuisine',level:9,w:2,d:1,icon:'kitchen',nv:2},
  {id:'lave_linge',name:'Lave-linge',cat:'sdb',level:10,w:1,d:1,icon:'local_laundry_service',nv:2},
  {id:'porte_serviettes',name:'Porte-serviettes',cat:'sdb',level:10,w:1,d:1,icon:'dry_cleaning',nv:2},
  {id:'plante_bambou',name:'Bambou',cat:'sdb',level:11,w:1,d:1,icon:'spa',nv:2},
  {id:'imprimante',name:'Imprimante',cat:'bureau',level:13,w:1,d:1,icon:'print',nv:2},
  {id:'fauteuil_lecture',name:'Fauteuil de lecture',cat:'bureau',level:14,w:1,d:1,icon:'chair',nv:2},
  {id:'vitrine_trophees',name:'Vitrine à trophées',cat:'bureau',level:15,w:2,d:1,icon:'emoji_events',nv:2},
  {id:'kettlebells',name:'Kettlebells',cat:'sport',level:16,w:1,d:1,icon:'fitness_center',nv:2},
  {id:'tapis_course',name:'Tapis de course',cat:'sport',level:17,w:1,d:2,icon:'directions_run',nv:2},
  {id:'sac_frappe',name:'Sac de frappe',cat:'sport',level:18,w:1,d:1,icon:'sports_mma',nv:2},
  {id:'electro',name:'Électrothérapie',cat:'cabinet',level:20,w:1,d:1,icon:'electric_bolt',nv:2},
  {id:'rack_elastiques',name:'Rack d’élastiques',cat:'cabinet',level:21,w:1,d:1,icon:'linear_scale',nv:2},
  {id:'affiche_anatomie',name:'Planche anatomique',cat:'cabinet',level:21,w:1,d:1,icon:'accessibility',nv:2},
  {id:'escalier_reeduc',name:'Escalier de rééducation',cat:'cabinet',level:22,w:2,d:1,icon:'stairs',nv:2},
  {id:'canard_geant',name:'Canard géant',cat:'piscine',level:24,w:1,d:1,icon:'flutter_dash',nv:2},
  {id:'plongeoir',name:'Plongeoir',cat:'piscine',level:25,w:1,d:2,icon:'pool',nv:2},
  {id:'ping_pong',name:'Table de ping-pong',cat:'piscine',level:26,w:2,d:2,icon:'sports_tennis',nv:2},
  {id:'brasero',name:'Brasero',cat:'terrasse',level:28,w:1,d:1,icon:'local_fire_department',nv:2},
  {id:'jacuzzi',name:'Jacuzzi',cat:'terrasse',level:29,w:2,d:2,icon:'hot_tub',nv:2},
  {id:'pergola',name:'Pergola',cat:'terrasse',level:30,w:2,d:2,icon:'roofing',nv:2}
];
// Meubles posés automatiquement quand une pièce se débloque : [id, dx, dz, rot]
const GAM_DEFAULT_ITEMS={
  chambre:[['lit',0,0,0],['chevet',2,0,0],['plante',5,0,0],['tapis_rond',2,3,0]],
  salon:[['tv',2,0,0],['tapis_rect',2,2,0],['table_basse',2,2,0],['canape',2,4,2]],
  jardin:[['arbre',1,1,0],['buisson',7,1,0],['fleurs',3,4,0],['banc',5,2,0]],
  cuisine:[['frigo',0,0,0],['plan_travail',1,0,0],['four',4,0,0],['table_cuisine',2,3,0]],
  sdb:[['baignoire',0,0,0],['lavabo',3,0,0],['tapis_bain',1,2,0]],
  bureau:[['bureau_pc',1,0,0],['chaise_bureau',1,1,2],['classeur',4,0,0]],
  sport:[['tapis_yoga',1,1,0],['halteres',4,0,0],['swiss_ball',3,3,0]],
  cabinet:[['espalier',2,0,0],['squelette',4,0,0],['table_massage',1,2,0]],
  piscine:[['transat',0,1,0],['transat',9,1,0],['parasol',0,4,0]],
  terrasse:[['salon_jardin',1,2,0],['barbecue',3,7,0]]
};

// ── Paliers de la semaine (questions répondues du lundi au dimanche) ──
const GAM_MILESTONES=[
  {id:'echauffement',name:'Échauffement',q:50,xp:50,icon:'directions_walk'},
  {id:'etirements',name:'Étirements',q:150,xp:100,icon:'self_improvement'},
  {id:'renfo',name:'Renforcement',q:300,xp:200,icon:'fitness_center'},
  {id:'endurance',name:'Endurance',q:500,xp:300,icon:'directions_run'},
  {id:'marathon',name:'Marathon',q:800,xp:500,icon:'sprint'},
  {id:'olympien',name:'Olympien',q:1200,xp:800,icon:'emoji_events'}
];
// Récompenses du podium hebdomadaire (1er, 2e, 3e)
const GAM_PODIUM=[500,300,150];

// =========================================================
// Niveaux
// =========================================================
// XP pour passer du niveau L au niveau L+1 : 60, 100, 140, 180…
function gamStepXP(level){return 60+40*(level-1);}
// XP cumulée nécessaire pour atteindre le niveau L
function gamCumXP(level){const n=level-1;return 60*n+20*n*(n-1);}
function gamLevelFromXP(xp){
  xp=Math.max(0,xp||0);
  let L=Math.floor((Math.sqrt(1600+80*xp)-40)/40)+1;
  while(L>1&&gamCumXP(L)>xp)L--;
  while(gamCumXP(L+1)<=xp)L++;
  return L;
}
function gamLevelInfo(xp){
  xp=Math.max(0,Math.round(xp||0));
  const level=gamLevelFromXP(xp),base=gamCumXP(level),next=gamCumXP(level+1);
  return {level,xp,into:xp-base,need:next-base,toNext:next-xp,pct:(xp-base)/(next-base)};
}

// =========================================================
// État
// =========================================================
const KGam='kcu_gam';
let gam=null;

function _gamDefault(){
  return {
    v:1, xp:0, created:Date.now(),
    today:{date:'',xp:0},
    week:{start:'',xp:0,q:0,c:0,s:0},
    lastWeek:null,
    unsynced:{},          // { 'YYYY-MM-DD'(lundi): {xp,bonus,q,c,s,retro} }
    outbox:[],            // lots scellés en attente d'envoi
    milestones:{},        // { lundi: ['echauffement',…] }
    goalDays:{}, streakDay:'',
    char:{species:'blob',color:'#ef7d6d',hat:null,face:null,outfit:null,mood:null},
    charChosen:false,
    house:{items:[],furnished:{}},
    seenLevel:1, pendingLevelUp:null,
    serverWeek:null
  };
}
function gamLoad(){
  let raw=null;
  try{raw=JSON.parse(localStorage.getItem(KGam)||'null');}catch(e){raw=null;}
  const fresh=!raw;
  gam=Object.assign(_gamDefault(),raw||{});
  gam.char=Object.assign(_gamDefault().char,gam.char||{});
  gam.house=Object.assign({items:[],furnished:{}},gam.house||{});
  if(!Array.isArray(gam.outbox))gam.outbox=[];
  if(!gam.unsynced||typeof gam.unsynced!=='object')gam.unsynced={};
  return fresh;
}
function gamSave(){try{localStorage.setItem(KGam,JSON.stringify(gam));}catch(e){console.warn('[gam] save',e);}}

// ── Dates locales ──
function gamDayKey(d){
  d=d||new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function gamWeekKey(d){
  d=d?new Date(d):new Date();
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  return gamDayKey(d);
}
function _gamRoll(){
  const today=gamDayKey(),wk=gamWeekKey();
  if(gam.today.date!==today)gam.today={date:today,xp:0};
  if(gam.week.start!==wk){
    if(gam.week.start&&(gam.week.q||gam.week.xp))gam.lastWeek=Object.assign({},gam.week);
    gam.week={start:wk,xp:0,q:0,c:0,s:0};
    gam.serverWeek=null;
  }
}

function gamUUID(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  const b=new Uint8Array(16);(window.crypto||window.msCrypto).getRandomValues(b);
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}

// =========================================================
// Gain d'XP
// =========================================================
// kind : 'activity' (compte dans le classement) ou 'bonus' (paliers, podium, ancienneté)
// counters : {q, c, s} questions, bonnes réponses, secondes de révision
const _gamListeners=[];
function gamSubscribe(fn){_gamListeners.push(fn);}

function gamAward(xp,kind,counters,opts){
  if(!gam)gamLoad();
  _gamRoll();
  opts=opts||{};counters=counters||{};
  xp=Math.max(0,Math.round(xp||0));
  const before=gamLevelFromXP(gam.xp);
  gam.xp+=xp;
  gam.today.xp+=xp;
  const wk=gam.week.start;
  const u=gam.unsynced[wk]||(gam.unsynced[wk]={xp:0,bonus:0,q:0,c:0,s:0});
  if(kind==='bonus'){u.bonus+=xp;if(opts.retro)u.retro=true;}
  else{u.xp+=xp;gam.week.xp+=xp;}
  ['q','c','s'].forEach(k=>{const n=Math.max(0,Math.round(counters[k]||0));u[k]+=n;gam.week[k]+=n;});
  const after=gamLevelFromXP(gam.xp);
  if(after>before)_gamQueueLevelUp(before,after);
  _gamCheckMilestones();
  _gamFurnishUnlocked();
  gamSave();
  if(xp&&!opts.silent)_gamFloat('+'+xp+' XP');
  gamRefreshUI();
  _gamListeners.forEach(fn=>{try{fn();}catch(e){}});
  return xp;
}

function _gamCheckMilestones(){
  const wk=gam.week.start;
  const done=gam.milestones[wk]||(gam.milestones[wk]=[]);
  const q=gamWeekQuestions();
  GAM_MILESTONES.forEach(m=>{
    if(q>=m.q&&!done.includes(m.id)){
      done.push(m.id);
      // Différé pour ne pas imbriquer les gains
      setTimeout(()=>{
        gamAward(m.xp,'bonus',null,{silent:true});
        _gamToast(`<span class="ms f">${m.icon}</span> Palier « ${m.name} » atteint : +${m.xp} XP`);
      },400);
    }
  });
  // Ne garde que les 8 dernières semaines
  const keys=Object.keys(gam.milestones).sort();
  while(keys.length>8)delete gam.milestones[keys.shift()];
}
function gamWeekQuestions(){
  const sw=gam.serverWeek&&gam.serverWeek.start===gam.week.start?gam.serverWeek.q||0:0;
  return Math.max(gam.week.q||0,sw);
}

// ── Branchements sur le moteur de quiz ──
function gamOnAnswer(correct){
  gamAward(correct?GAM_XP.correct:GAM_XP.wrong,'activity',{q:1,c:correct?1:0},{silent:true});
  _gamFloat((correct?'+'+GAM_XP.correct:'+'+GAM_XP.wrong)+' XP',correct);
}

let _gamLastSession=null;
function gamOnSessionEnd(snap){
  _gamRoll();
  const lines=[];
  const answerXP=snap.correct*GAM_XP.correct+(snap.answered-snap.correct)*GAM_XP.wrong;
  if(snap.answered)lines.push({label:`${snap.answered} réponse${snap.answered>1?'s':''} (${snap.correct} bonne${snap.correct>1?'s':''})`,xp:answerXP,already:true});
  let bonus=0;
  if(snap.answered>=5){bonus+=GAM_XP.session;lines.push({label:'Session terminée',xp:GAM_XP.session});}
  if(snap.answered>=10&&snap.correct===snap.answered){bonus+=GAM_XP.perfect;lines.push({label:'Sans faute !',xp:GAM_XP.perfect});}
  const today=gamDayKey();
  if(gam.streakDay!==today&&typeof stats!=='undefined'&&stats.streak>0){
    gam.streakDay=today;
    const sx=Math.min(stats.streak,GAM_XP.streakCap)*GAM_XP.streakDay;
    bonus+=sx;lines.push({label:`Série de ${stats.streak} jour${stats.streak>1?'s':''}`,xp:sx});
  }
  const goal=typeof dailyGoal!=='undefined'?dailyGoal:10;
  const todayQ=typeof getTodayQ==='function'?getTodayQ():0;
  if(!gam.goalDays[today]&&todayQ>=goal){
    gam.goalDays[today]=true;
    const keys=Object.keys(gam.goalDays).sort();while(keys.length>40)delete gam.goalDays[keys.shift()];
    bonus+=GAM_XP.goal;lines.push({label:'Objectif du jour atteint',xp:GAM_XP.goal});
  }
  const levelBefore=gamLevelFromXP(gam.xp-answerXP);
  gamAward(bonus,'activity',{s:snap.duration||0},{silent:true});
  _gamLastSession={lines,total:answerXP+bonus,levelBefore,levelAfter:gamLevelFromXP(gam.xp)};
  _gamRenderResultsCard();
  setTimeout(_gamShowPendingLevelUp,900);
}

function _gamRenderResultsCard(){
  const s=_gamLastSession;if(!s)return;
  const wrap=document.querySelector('#screen-results>.wrap');if(!wrap)return;
  let el=document.getElementById('gam-results');
  if(!el){
    el=document.createElement('div');el.id='gam-results';el.className='gam-results';
    const strip=wrap.querySelector('.sstrip');
    if(strip&&strip.nextSibling)wrap.insertBefore(el,strip.nextSibling);else wrap.appendChild(el);
  }
  const info=gamLevelInfo(gam.xp);
  el.innerHTML=`
    <div class="gam-results-head">
      <div class="gam-results-av">${gamAvatarSVG(gam.char,52)}</div>
      <div style="flex:1;min-width:0">
        <div class="gam-results-total">+${s.total} XP</div>
        <div class="gam-results-sub">Niveau ${info.level} · ${info.into} / ${info.need} XP</div>
        <div class="gam-bar"><div class="gam-bar-fill" style="width:${Math.round(info.pct*100)}%"></div></div>
      </div>
      <button class="btn btn-sm btn-g" onclick="showScreen('house')"><span class="ms" style="font-size:15px">cottage</span> Ma maison</button>
    </div>
    <div class="gam-results-lines">${s.lines.map(l=>`<div class="gam-results-line"><span>${_gamEsc(l.label)}</span><b>+${l.xp}</b></div>`).join('')}</div>`;
  const cf=typeof cityPendingFunds==='function'?cityPendingFunds():null;
  if(cf&&cf.money>0)el.insertAdjacentHTML('beforeend',`<button class="gam-results-city" onclick="showScreen('city')"><span class="ms">location_city</span><span>+${cf.money.toLocaleString('fr-FR')} § à récupérer pour <b>${_gamEsc(cf.name)}</b></span><span class="ms">arrow_forward</span></button>`);
}

function gamOnSurvivalEnd(snap){
  gamOnSessionEnd(snap);
  if(_gamLastSession)_gamToast(`<span class="ms f">bolt</span> Survie terminée : +${_gamLastSession.total} XP`);
  _gamLastSession=null;
}

// =========================================================
// Montée de niveau & récompenses
// =========================================================
function gamRewardsAt(level){
  const out=[];
  GAM_ROOMS.forEach(r=>{if(r.level===level&&level>1)out.push({type:'room',icon:r.icon,name:r.name,label:'Nouvelle pièce'});});
  GAM_SPECIES.forEach(s=>{if(s.level===level&&level>1)out.push({type:'species',icon:'pets',name:s.name,label:'Personnage'});});
  GAM_HATS.forEach(h=>{if(h.level===level&&level>1)out.push({type:'hat',icon:'styler',name:h.name,label:'Accessoire'});});
  GAM_FACES.forEach(h=>{if(h.level===level&&level>1)out.push({type:'face',icon:'eyeglasses',name:h.name,label:'Accessoire'});});
  GAM_OUTFITS.forEach(h=>{if(h.level===level&&level>1)out.push({type:'outfit',icon:'checkroom',name:h.name,label:'Tenue'});});
  GAM_MOODS.forEach(h=>{if(h.level===level&&level>1)out.push({type:'mood',icon:'mood',name:h.name,label:'Expression'});});
  GAM_COLORS.forEach(c=>{if(c.level===level&&level>1)out.push({type:'color',icon:'palette',name:'Couleur '+c.name,label:'Couleur',hex:c.hex});});
  GAM_FURNITURE.forEach(f=>{if(f.level===level&&level>1&&!GAM_ROOMS.some(r=>r.id===f.cat&&r.level===level))out.push({type:'furniture',icon:f.icon,name:f.name,label:'Meuble'});});
  return out;
}
function gamNextReward(level){
  for(let L=level+1;L<=level+40;L++){const r=gamRewardsAt(L);if(r.length)return {level:L,reward:r[0]};}
  return null;
}
function _gamQueueLevelUp(from,to){
  const p=gam.pendingLevelUp;
  gam.pendingLevelUp={from:p?Math.min(p.from,from):from,to};
  _gamChipBump(to);
  // Pas d'interruption pendant un quiz : affiché à la fin de la session
  if(document.body.dataset.screen!=='quiz')setTimeout(_gamShowPendingLevelUp,300);
}
function _gamShowPendingLevelUp(){
  const p=gam&&gam.pendingLevelUp;if(!p)return;
  if(document.body.dataset.screen==='quiz')return;
  gam.pendingLevelUp=null;gam.seenLevel=p.to;gamSave();
  const rewards=[];for(let L=p.from+1;L<=p.to;L++)rewards.push(...gamRewardsAt(L));
  const room=rewards.find(r=>r.type==='room');
  const body=document.getElementById('modal-gam-levelup-body');if(!body)return;
  body.innerHTML=`
    <div class="gam-lu">
      <div class="gam-lu-rays"></div>
      <div class="gam-lu-av">${gamAvatarSVG(gam.char,120)}</div>
      <div class="gam-lu-kicker">Niveau supérieur !</div>
      <div class="gam-lu-level">Niveau ${p.to}</div>
      ${rewards.length?`<div class="gam-lu-list">${rewards.slice(0,6).map(r=>`
        <div class="gam-lu-item">
          <span class="gam-lu-ic" ${r.hex?`style="background:${r.hex}"`:''}><span class="ms">${r.icon}</span></span>
          <span><small>${r.label}</small>${_gamEsc(r.name)}</span>
        </div>`).join('')}</div>`:`<p class="gam-lu-none">Continue comme ça, la prochaine récompense arrive vite !</p>`}
      <div class="fr" style="justify-content:center;gap:8px;margin-top:18px">
        ${room?`<button class="btn btn-p" onclick="closeModal('modal-gam-levelup');showScreen('house')"><span class="ms" style="font-size:16px">cottage</span> Voir ma maison</button>`:''}
        <button class="btn ${room?'btn-g':'btn-p'}" onclick="closeModal('modal-gam-levelup')">Super !</button>
      </div>
    </div>`;
  openModal('modal-gam-levelup');
  gamConfetti();
}

// Petit feu d'artifice de confettis (canvas plein écran)
function gamConfetti(){
  let cv=document.getElementById('gam-confetti');
  if(!cv){cv=document.createElement('canvas');cv.id='gam-confetti';document.body.appendChild(cv);}
  const ctx=cv.getContext('2d');const W=cv.width=innerWidth,H=cv.height=innerHeight;
  const cols=['#f2c14e','#ef7d6d','#7dcfa0','#6cb4ee','#b79ce8','#f5a3c7'];
  const parts=Array.from({length:140},()=>({x:W/2+(Math.random()-.5)*120,y:H*.42,vx:(Math.random()-.5)*14,vy:-Math.random()*14-4,r:Math.random()*6+3,c:cols[Math.random()*cols.length|0],a:Math.random()*6,va:(Math.random()-.5)*.3}));
  let t=0;cv.style.display='block';
  (function frame(){
    ctx.clearRect(0,0,W,H);t++;
    parts.forEach(p=>{p.vy+=.35;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.a+=p.va;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle=p.c;ctx.fillRect(-p.r/2,-p.r/4,p.r,p.r/2);ctx.restore();});
    if(t<140)requestAnimationFrame(frame);else{ctx.clearRect(0,0,W,H);cv.style.display='none';}
  })();
}

// =========================================================
// Avatar (SVG paramétrique)
// =========================================================
function gamNormChar(ch){
  const d=_gamDefault().char;ch=Object.assign({},d,ch||{});
  if(!GAM_SPECIES.some(s=>s.id===ch.species))ch.species='blob';
  if(!/^#[0-9a-f]{6}$/i.test(ch.color||''))ch.color=d.color;
  if(ch.hat&&!GAM_HATS.some(h=>h.id===ch.hat))ch.hat=null;
  if(ch.face&&!GAM_FACES.some(h=>h.id===ch.face))ch.face=null;
  if(ch.outfit&&!GAM_OUTFITS.some(h=>h.id===ch.outfit))ch.outfit=null;
  if(ch.mood&&!GAM_MOODS.some(h=>h.id===ch.mood))ch.mood=null;
  if(ch.outfit===undefined)ch.outfit=null;if(ch.mood===undefined)ch.mood=null;
  return ch;
}
function gamShade(hex,amt){
  const n=parseInt(hex.slice(1),16);let r=n>>16,g=(n>>8)&255,b=n&255;
  const t=amt<0?0:255,p=Math.abs(amt);
  r=Math.round((t-r)*p+r);g=Math.round((t-g)*p+g);b=Math.round((t-b)*p+b);
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
function gamAvatarSVG(ch,size){
  ch=gamNormChar(ch);size=size||48;
  const c=ch.color,dk=gamShade(c,-.28),dk2=gamShade(c,-.45),lt=gamShade(c,.45),pink='#f7b6c8',ink='#2b2b2b',white='#fffaf2';
  const sp=ch.species,frog=sp==='grenouille',robot=sp==='robot',ghost=sp==='fantome';
  const ex1=frog?36:40,ex2=frog?64:60,ey=frog?38:56;
  let back='',top='',mouthY=65,mouthKind=frog||sp==='axolotl'?'wide':'smile',eyeC=ink,eyeHi='#fff',eyeBig=false,feetC=dk,noBelly=false;
  const ears=(r,rIn,y,x1,x2,cIn)=>`<circle cx="${x1}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${c}"/>`+(rIn?`<circle cx="${x1}" cy="${y}" r="${rIn}" fill="${cIn||lt}"/><circle cx="${x2}" cy="${y}" r="${rIn}" fill="${cIn||lt}"/>`:'');
  const nose=(y,col,rx,ry)=>`<ellipse cx="50" cy="${y}" rx="${rx||3.2}" ry="${ry||2.4}" fill="${col||ink}"/>`;
  const beak=y=>`<path d="M45 ${y} L55 ${y} L50 ${y+7} Z" fill="#ffa62b" stroke="#e8891a" stroke-width=".8" stroke-linejoin="round"/>`;
  switch(sp){
    case 'ours':back=ears(10,5,37,27,73);break;
    case 'souris':back=ears(14,8,40,21,79,pink);break;
    case 'chat':back=`<path d="M23 47 L27 19 L46 35 Z" fill="${c}"/><path d="M77 47 L73 19 L54 35 Z" fill="${c}"/><path d="M28.5 40 L30.5 27 L40 34.5 Z" fill="${pink}"/><path d="M71.5 40 L69.5 27 L60 34.5 Z" fill="${pink}"/>`;break;
    case 'lapin':back=`<ellipse cx="37" cy="21" rx="7.5" ry="19" fill="${c}" transform="rotate(-10 37 21)"/><ellipse cx="63" cy="21" rx="7.5" ry="19" fill="${c}" transform="rotate(10 63 21)"/><ellipse cx="37" cy="22" rx="3.5" ry="13" fill="${pink}" transform="rotate(-10 37 22)"/><ellipse cx="63" cy="22" rx="3.5" ry="13" fill="${pink}" transform="rotate(10 63 22)"/>`;break;
    case 'grenouille':back=`<circle cx="36" cy="38" r="12" fill="${c}"/><circle cx="64" cy="38" r="12" fill="${c}"/>`;break;
    case 'robot':back=`<line x1="50" y1="34" x2="50" y2="18" stroke="${dk}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="15" r="5" fill="#ffd166"/><rect x="13" y="53" width="7" height="16" rx="3.5" fill="${dk}"/><rect x="80" y="53" width="7" height="16" rx="3.5" fill="${dk}"/>`;break;
    case 'dragon':back=`<path d="M14 62 Q4 44 18 40 Q16 52 24 58 Z" fill="${dk}"/><path d="M86 62 Q96 44 82 40 Q84 52 76 58 Z" fill="${dk}"/>`;
      top=`<path d="M34 39 Q27 23 38 19 Q35 30 42 36 Z" fill="#fff3d6"/><path d="M66 39 Q73 23 62 19 Q65 30 58 36 Z" fill="#fff3d6"/>`;break;
    case 'licorne':back=`<path d="M30 40 Q22 50 26 66 Q30 52 38 44 Z" fill="#b79ce8"/>`;
      top=`<path d="M45 35 L50 7 L55 35 Z" fill="#ffd166"/><path d="M46.5 28 L53.5 25 M47.5 21 L52.5 18.5" stroke="#e0a800" stroke-width="1.6"/><path d="M42 34 Q48 26 58 33 Q52 31 46 37 Z" fill="#f5a3c7"/>`;break;
    case 'renard':back=`<path d="M23 47 L21 13 L46 34 Z" fill="${c}"/><path d="M77 47 L79 13 L54 34 Z" fill="${c}"/><path d="M27 40 L26 23 L38 33 Z" fill="${pink}"/><path d="M73 40 L74 23 L62 33 Z" fill="${pink}"/><path d="M21.6 24 L21 13 L29.5 20 Z" fill="#3a2a22"/><path d="M78.4 24 L79 13 L70.5 20 Z" fill="#3a2a22"/>`;
      top=`<path d="M22 62 Q34 56 50 66 Q66 56 78 62 Q72 84 50 85 Q28 84 22 62 Z" fill="${white}"/>`+nose(62.5);mouthY=67;noBelly=true;break;
    case 'panda':back=ears(10,0,38,28,72).replace(new RegExp(c,'g'),ink);
      top=`<ellipse cx="39" cy="57" rx="8" ry="10" fill="${ink}" transform="rotate(25 39 57)"/><ellipse cx="61" cy="57" rx="8" ry="10" fill="${ink}" transform="rotate(-25 61 57)"/>`+nose(63.5);eyeC='#fff';eyeHi=ink;mouthY=67;break;
    case 'koala':back=`<circle cx="22" cy="42" r="15" fill="${c}"/><circle cx="78" cy="42" r="15" fill="${c}"/><circle cx="23" cy="43" r="9" fill="${lt}"/><circle cx="77" cy="43" r="9" fill="${lt}"/>`;
      top=`<ellipse cx="50" cy="63" rx="6.5" ry="8" fill="#3b3b44"/><ellipse cx="48" cy="60" rx="1.8" ry="2.4" fill="#fff" opacity=".35"/>`;mouthY=74;break;
    case 'chien':top=`<ellipse cx="23" cy="53" rx="9" ry="17" fill="${dk}" transform="rotate(18 23 53)"/><ellipse cx="77" cy="53" rx="9" ry="17" fill="${dk}" transform="rotate(-18 77 53)"/><ellipse cx="50" cy="67" rx="12" ry="8.5" fill="${lt}"/>`+nose(62.5,ink,4.2,3.2);mouthY=69;break;
    case 'pingouin':back=`<ellipse cx="18" cy="65" rx="6" ry="14" fill="${dk}" transform="rotate(22 18 65)"/><ellipse cx="82" cy="65" rx="6" ry="14" fill="${dk}" transform="rotate(-22 82 65)"/>`;
      top=`<ellipse cx="41" cy="57" rx="11.5" ry="13" fill="#fff"/><ellipse cx="59" cy="57" rx="11.5" ry="13" fill="#fff"/><ellipse cx="50" cy="74" rx="19" ry="14" fill="#fff"/>`+beak(62);mouthKind='none';feetC='#ffa62b';noBelly=true;break;
    case 'hamster':back=ears(7,4,36,30,70,pink);
      top=`<ellipse cx="29" cy="67" rx="10" ry="8" fill="${lt}"/><ellipse cx="71" cy="67" rx="10" ry="8" fill="${lt}"/>`+nose(62,'#e8737f',2.6,2);mouthY=66;break;
    case 'cochon':back=`<path d="M25 44 L28 22 L44 35 Z" fill="${dk}"/><path d="M75 44 L72 22 L56 35 Z" fill="${dk}"/>`;
      top=`<ellipse cx="50" cy="66" rx="9.5" ry="7" fill="${dk}"/><ellipse cx="46.5" cy="66" rx="1.7" ry="2.6" fill="#7a3b4b"/><ellipse cx="53.5" cy="66" rx="1.7" ry="2.6" fill="#7a3b4b"/>`;mouthY=76;break;
    case 'poussin':back=`<ellipse cx="20" cy="63" rx="5" ry="11" fill="${dk}" transform="rotate(25 20 63)"/><ellipse cx="80" cy="63" rx="5" ry="11" fill="${dk}" transform="rotate(-25 80 63)"/>`;
      top=`<path d="M50 34 C47 25 43 22 40 25 M50 34 C51 24 56 21 59 24 M50 34 C50 26 50 22 50 20" stroke="${dk}" stroke-width="3" fill="none" stroke-linecap="round"/>`+beak(62);mouthKind='none';feetC='#ffa62b';break;
    case 'mouton':back=`<ellipse cx="18" cy="52" rx="10" ry="5" fill="${dk}" transform="rotate(-25 18 52)"/><ellipse cx="82" cy="52" rx="10" ry="5" fill="${dk}" transform="rotate(25 82 52)"/>`;
      top=[[30,42,9],[38,34,10],[50,31,11],[62,34,10],[70,42,9],[24,52,7],[76,52,7]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#fbf7ef" stroke="#ece5d6" stroke-width="1"/>`).join('');break;
    case 'hibou':back=`<path d="M25 46 L22 22 L41 36 Z" fill="${dk}"/><path d="M75 46 L78 22 L59 36 Z" fill="${dk}"/><ellipse cx="20" cy="66" rx="7" ry="15" fill="${dk}" transform="rotate(14 20 66)"/><ellipse cx="80" cy="66" rx="7" ry="15" fill="${dk}" transform="rotate(-14 80 66)"/>`;
      top=`<circle cx="39" cy="55" r="11.5" fill="${lt}"/><circle cx="61" cy="55" r="11.5" fill="${lt}"/>`+beak(62);mouthKind='none';break;
    case 'tigre':back=ears(9,4.5,38,28,72);
      top=`<path d="M50 33 L50 42 M42 34.5 L44 41 M58 34.5 L56 41 M20 57 L28 59 M20 65 L28 65 M80 57 L72 59 M80 65 L72 65" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="50" cy="67" rx="11.5" ry="8" fill="${white}"/><path d="M46.5 61.8 L53.5 61.8 L50 65.5 Z" fill="#e8737f"/>`;mouthY=69;break;
    case 'vache':back=`<path d="M30 38 Q22 26 30 21 Q30 30 37 34 Z" fill="#f3ead8" stroke="#d8ccb2" stroke-width=".8"/><path d="M70 38 Q78 26 70 21 Q70 30 63 34 Z" fill="#f3ead8" stroke="#d8ccb2" stroke-width=".8"/><ellipse cx="19" cy="46" rx="10" ry="5" fill="${c}" transform="rotate(-20 19 46)"/><ellipse cx="81" cy="46" rx="10" ry="5" fill="${c}" transform="rotate(20 81 46)"/>`;
      top=`<ellipse cx="33" cy="44" rx="7" ry="5" fill="${ink}" opacity=".85"/><ellipse cx="70" cy="80" rx="7" ry="4.5" fill="${ink}" opacity=".85"/><ellipse cx="26" cy="74" rx="4" ry="3" fill="${ink}" opacity=".85"/><ellipse cx="50" cy="69" rx="14" ry="9" fill="${pink}"/><ellipse cx="45" cy="68" rx="1.8" ry="2.6" fill="#b46a7c"/><ellipse cx="55" cy="68" rx="1.8" ry="2.6" fill="#b46a7c"/>`;mouthKind='none';noBelly=true;break;
    case 'raton':back=`<path d="M24 46 L27 22 L44 35 Z" fill="${dk}"/><path d="M76 46 L73 22 L56 35 Z" fill="${dk}"/><path d="M28.5 41 L30 28 L39 35 Z" fill="${lt}"/><path d="M71.5 41 L70 28 L61 35 Z" fill="${lt}"/>`;
      top=`<path d="M22 55 Q30 45 41 50 Q50 54 59 50 Q70 45 78 55 Q70 65 59 61 Q50 58 41 61 Q30 65 22 55 Z" fill="${ink}"/><ellipse cx="50" cy="67" rx="10" ry="7" fill="${white}"/>`+nose(63);eyeC='#fff';eyeHi=ink;mouthY=69;break;
    case 'axolotl':back=[[-25,44],[0,53],[25,62]].map(([a,y])=>`<ellipse cx="16" cy="${y}" rx="10" ry="3.6" fill="#f58fb5" transform="rotate(${a} 16 ${y})"/><ellipse cx="84" cy="${y}" rx="10" ry="3.6" fill="#f58fb5" transform="rotate(${-a} 84 ${y})"/>`).join('');mouthY=66;break;
    case 'herisson':{let pts='';for(let k=0;k<=14;k++){const a=Math.PI*(1.06+k*.064),r=k%2?32:43;pts+=`${(50+Math.cos(a)*r).toFixed(1)},${(60+Math.sin(a)*r).toFixed(1)} `;}
      back=`<polygon points="${pts}" fill="${dk2}" stroke="${dk2}" stroke-linejoin="round" stroke-width="3"/>`;top=`<ellipse cx="50" cy="67" rx="10" ry="7" fill="${lt}"/>`+nose(63);mouthY=69;break;}
    case 'requin':back=`<path d="M42 34 L58 9 L61 35 Z" fill="${dk}"/><ellipse cx="17" cy="70" rx="6" ry="13" fill="${dk}" transform="rotate(35 17 70)"/><ellipse cx="83" cy="70" rx="6" ry="13" fill="${dk}" transform="rotate(-35 83 70)"/>`;
      top=`<path d="M22 64 Q50 56 78 64 Q72 87 50 88 Q28 87 22 64 Z" fill="#f4f7fa"/>`;mouthKind='teeth';mouthY=70;noBelly=true;break;
    case 'abeille':back=`<ellipse cx="22" cy="44" rx="13" ry="8" fill="#dff3ff" stroke="#b6dbf2" stroke-width="1" opacity=".95" transform="rotate(-30 22 44)"/><ellipse cx="78" cy="44" rx="13" ry="8" fill="#dff3ff" stroke="#b6dbf2" stroke-width="1" opacity=".95" transform="rotate(30 78 44)"/>`;
      top=`<path d="M42 35 Q38 23 33 20 M58 35 Q62 23 67 20" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="33" cy="20" r="3.2" fill="${ink}"/><circle cx="67" cy="20" r="3.2" fill="${ink}"/><path d="M21 72 Q50 79 79 72 L77 79 Q50 86 23 79 Z" fill="${ink}"/><path d="M27 84 Q50 89 73 84 L68 88 Q50 92 32 88 Z" fill="${ink}"/>`;noBelly=true;break;
    case 'elephant':back=`<ellipse cx="17" cy="57" rx="16" ry="20" fill="${dk}"/><ellipse cx="83" cy="57" rx="16" ry="20" fill="${dk}"/><ellipse cx="19" cy="58" rx="9" ry="13" fill="${pink}" opacity=".8"/><ellipse cx="81" cy="58" rx="9" ry="13" fill="${pink}" opacity=".8"/>`;
      top=`<path d="M44.5 60 Q44 77 37 82 Q40 87 46 84 Q55 76 55.5 60 Z" fill="${c}" stroke="${dk}" stroke-width="1.2" stroke-linejoin="round"/><path d="M45.5 70 L54.5 70 M44.5 76 L52 76" stroke="${dk}" stroke-width="1" opacity=".6"/>`;mouthKind='none';break;
    case 'lion':{let m='';for(let k=0;k<14;k++){const a=k/14*Math.PI*2;m+=`<circle cx="${(50+Math.cos(a)*32).toFixed(1)}" cy="${(59+Math.sin(a)*30).toFixed(1)}" r="10" fill="${dk2}"/>`;}
      back=m+ears(7,3.5,33,33,67);top=`<ellipse cx="50" cy="67" rx="11.5" ry="8" fill="${white}"/><path d="M46.5 61.8 L53.5 61.8 L50 65.5 Z" fill="#7a4a3a"/>`;mouthY=69;break;}
    case 'dino':back=`<path d="M36 36 L40 22 L46 33 Z M46 32 L51 16 L56 32 Z M56 33 L62 22 L65 37 Z" fill="${dk}" stroke="${dk}" stroke-width="1.5" stroke-linejoin="round"/>`;top=`<circle cx="45" cy="63" r="1.4" fill="${ink}"/><circle cx="55" cy="63" r="1.4" fill="${ink}"/>`;mouthY=68;mouthKind='wide';break;
    case 'fantome':noBelly=true;break;
    case 'alien':back=`<path d="M38 36 L29 17 M62 36 L71 17" stroke="${dk}" stroke-width="2.6" stroke-linecap="round"/><circle cx="29" cy="16" r="4.5" fill="#9dfc8b"/><circle cx="71" cy="16" r="4.5" fill="#9dfc8b"/>`;eyeBig=true;break;
    default:top=`<path d="M50 33 C48 24 42 22 39 24 C44 25 47 28 50 33 Z" fill="#7cc576"/><path d="M50 33 C52 23 59 21 62 23 C57 24 53 28 50 33 Z" fill="#62b05c"/>`;
  }
  /* tenue portée dans le dos (cape, sac) */
  let backO='';
  if(ch.outfit==='cape')backO=`<path d="M26 44 Q12 70 16 94 Q50 86 84 94 Q88 70 74 44 Z" fill="#d62839"/><path d="M26 44 Q20 62 22 80" stroke="#a51d2c" stroke-width="2" fill="none"/>`;
  if(ch.outfit==='sacados')backO=`<rect x="13" y="50" width="16" height="30" rx="6" fill="#2a6fdb"/><rect x="71" y="50" width="16" height="30" rx="6" fill="#2a6fdb"/>`;
  const body=robot?`<rect x="20" y="33" width="60" height="56" rx="18" fill="${c}"/>`
    :ghost?`<path d="M19 60 C19 37 32 30 50 30 C68 30 81 37 81 60 L81 88 Q75.7 82 70.3 88 Q65 82 59.7 88 Q54.3 82 49 88 Q43.7 82 38.3 88 Q33 82 27.7 88 Q23 82 19 88 Z" fill="${c}" opacity=".96"/>`
    :`<ellipse cx="50" cy="61" rx="31" ry="29" fill="${c}"/>`;
  const belly=noBelly||ghost?'':robot?`<rect x="36" y="64" width="28" height="16" rx="6" fill="${lt}" opacity=".6"/><circle cx="44" cy="72" r="2.5" fill="#ff7a8a"/><circle cx="52" cy="72" r="2.5" fill="#ffd166"/>`:`<ellipse cx="50" cy="72" rx="17" ry="12.5" fill="${lt}" opacity=".55"/>`;
  const feet=ghost?'':`<ellipse cx="38" cy="89" rx="8" ry="4.5" fill="${feetC}"/><ellipse cx="62" cy="89" rx="8" ry="4.5" fill="${feetC}"/>`;
  /* yeux : selon l'expression choisie */
  const mood=ch.mood,arc=(x,up)=>`<path d="M${x-5} ${ey+(up?2:-1)} Q${x} ${ey+(up?-5:4)} ${x+5} ${ey+(up?2:-1)}" stroke="${eyeC}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const dot=x=>robot?`<rect x="${x-5}" y="${ey-5}" width="10" height="10" rx="3" fill="#1f2937"/><rect x="${x-2.5}" y="${ey-2.5}" width="5" height="5" rx="1.5" fill="#5eead4"/>`
    :eyeBig?`<ellipse cx="${x}" cy="${ey}" rx="6.5" ry="8.5" fill="${eyeC}"/><circle cx="${x+2}" cy="${ey-3}" r="2.2" fill="${eyeHi}"/>`
    :`<ellipse cx="${x}" cy="${ey}" rx="4.2" ry="5.2" fill="${eyeC}"/><circle cx="${x+1.4}" cy="${ey-1.8}" r="1.6" fill="${eyeHi}"/>`;
  const heart=x=>`<path d="M${x} ${ey+5} C${x-9} ${ey-1} ${x-5} ${ey-8} ${x} ${ey-3} C${x+5} ${ey-8} ${x+9} ${ey-1} ${x} ${ey+5} Z" fill="#ff4d6d"/>`;
  const star=x=>{let p='';for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,r=k%2?2.6:6.2;p+=`${(x+Math.cos(a)*r).toFixed(1)},${(ey+Math.sin(a)*r).toFixed(1)} `;}return `<polygon points="${p}" fill="#ffd166" stroke="#e0a800" stroke-width=".8"/>`;};
  let eyes;
  if(mood==='joie')eyes=arc(ex1,true)+arc(ex2,true);
  else if(mood==='clin')eyes=arc(ex1,true)+dot(ex2);
  else if(mood==='amour')eyes=heart(ex1)+heart(ex2);
  else if(mood==='etoiles')eyes=star(ex1)+star(ex2);
  else if(mood==='dodo')eyes=arc(ex1,false)+arc(ex2,false)+`<text x="70" y="36" font-family="sans-serif" font-weight="800" font-size="11" fill="#6c7bd8">z</text><text x="77" y="27" font-family="sans-serif" font-weight="800" font-size="8" fill="#6c7bd8">z</text>`;
  else if(mood==='surpris')eyes=dot(ex1)+dot(ex2)+`<path d="M${ex1-5} ${ey-9} Q${ex1} ${ey-12} ${ex1+5} ${ey-9} M${ex2-5} ${ey-9} Q${ex2} ${ey-12} ${ex2+5} ${ey-9}" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  else eyes=dot(ex1)+dot(ex2);
  const cheeks=`<ellipse cx="31" cy="66" rx="5" ry="3" fill="#ff7a8a" opacity="${mood==='amour'||mood==='joie'?.7:.45}"/><ellipse cx="69" cy="66" rx="5" ry="3" fill="#ff7a8a" opacity="${mood==='amour'||mood==='joie'?.7:.45}"/>`;
  const my=mouthY;let mouth='';
  if(mood==='surpris')mouth=`<ellipse cx="50" cy="${my+1}" rx="3.6" ry="4.4" fill="#5a2a2a"/>`;
  else if(mood==='langue')mouth=`<path d="M44 ${my} Q50 ${my+5} 56 ${my}" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M47 ${my+2} Q47 ${my+9} 50.5 ${my+9} Q54 ${my+9} 54 ${my+2} Z" fill="#ff7a8a"/>`;
  else if(mood==='dodo')mouth=`<ellipse cx="50" cy="${my+1}" rx="2.4" ry="1.8" fill="#5a2a2a"/>`;
  else if(mouthKind==='none')mouth='';
  else if(mouthKind==='teeth')mouth=`<path d="M38 ${my} Q50 ${my+8} 62 ${my} Z" fill="#5a2a2a"/><path d="M40 ${my+.6} L42.5 ${my+3.5} L45 ${my+1.4} L47.5 ${my+4.2} L50 ${my+1.6} L52.5 ${my+4.2} L55 ${my+1.4} L57.5 ${my+3.5} L60 ${my+.6} Z" fill="#fff"/>`;
  else if(mouthKind==='wide')mouth=`<path d="M38 ${my-2} Q50 ${my+8} 62 ${my-2}" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  else mouth=`<path d="M45 ${my} Q50 ${my+(mood==='joie'||mood==='amour'?7:5)} 55 ${my}" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  /* tenue (devant) */
  let outfit='';
  switch(ch.outfit){
    case 'papillon':outfit=`<path d="M50 80 L39 74 L39 86 Z M50 80 L61 74 L61 86 Z" fill="#d62839" stroke="#a51d2c" stroke-width="1" stroke-linejoin="round"/><circle cx="50" cy="80" r="3" fill="#a51d2c"/>`;break;
    case 'echarpe':outfit=`<path d="M22 74 Q50 84 78 74 L77 82 Q50 92 23 82 Z" fill="#e63946"/><path d="M28 76 L30 84 M38 79 L39 87 M62 79 L61 87 M72 76 L70 84" stroke="#fff" stroke-width="2" opacity=".55"/><path d="M60 82 L66 99 L74 96 L68 80 Z" fill="#c92c39"/>`;break;
    case 'stetho':outfit=`<path d="M28 70 Q34 86 50 86 Q66 86 72 70" stroke="#4a5568" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M62 84 Q64 92 59 94" stroke="#4a5568" stroke-width="2.2" fill="none"/><circle cx="58" cy="94" r="4" fill="#cbd5e0" stroke="#4a5568" stroke-width="1.6"/>`;break;
    case 'blouse':outfit=`<path d="M20 70 Q22 88 34 94 L50 94 L50 80 L36 68 Q27 66 20 70 Z" fill="#fff" stroke="#d9dee5" stroke-width="1"/><path d="M80 70 Q78 88 66 94 L50 94 L50 80 L64 68 Q73 66 80 70 Z" fill="#fff" stroke="#d9dee5" stroke-width="1"/><rect x="60" y="82" width="9" height="7" rx="1.5" fill="#eef2f7" stroke="#d9dee5" stroke-width=".8"/><path d="M63 80 L63 85" stroke="#2a6fdb" stroke-width="1.6"/>`;break;
    case 'cravate':outfit=`<path d="M46 75 L54 75 L52 79 L56 93 L50 98 L44 93 L48 79 Z" fill="#2a6fdb" stroke="#1f56ad" stroke-width="1" stroke-linejoin="round"/><path d="M47 86 L53 83 M46 91 L54 87" stroke="#9cc3ff" stroke-width="1.4"/>`;break;
    case 'collier':{let f='';const C_=['#ff6b9a','#ffd166','#6ee7b7','#7cc4ff','#c39bff'];for(let k=0;k<9;k++){const t=k/8,x=26+t*48,y=73+Math.sin(t*Math.PI)*12;f+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="${C_[k%5]}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="#fff8d6"/>`;}outfit=f;break;}
    case 'medaille':outfit=`<path d="M38 72 L46 86 L50 84 L42 70 Z" fill="#2a6fdb"/><path d="M62 72 L54 86 L50 84 L58 70 Z" fill="#e63946"/><circle cx="50" cy="88" r="7" fill="#ffd166" stroke="#e0a800" stroke-width="1.6"/><path d="M50 84.5 L51.3 87.2 L54.2 87.4 L52 89.3 L52.7 92.2 L50 90.6 L47.3 92.2 L48 89.3 L45.8 87.4 L48.7 87.2 Z" fill="#e0a800"/>`;break;
    case 'sacados':outfit=`<path d="M30 52 Q27 70 31 88 M70 52 Q73 70 69 88" stroke="#1f56ad" stroke-width="4" fill="none" stroke-linecap="round"/>`;break;
    case 'cape':outfit=`<path d="M30 70 Q50 78 70 70" stroke="#a51d2c" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="75" r="3.4" fill="#ffd166" stroke="#e0a800" stroke-width="1"/>`;break;
  }
  let face='';
  switch(ch.face){
    case 'lunettes':face=`<g fill="none" stroke="#3a2f2a" stroke-width="2.2"><circle cx="${ex1}" cy="${ey}" r="8"/><circle cx="${ex2}" cy="${ey}" r="8"/><path d="M${ex1+8} ${ey} H${ex2-8}"/></g>`;break;
    case 'soleil':face=`<g fill="#1f1f1f"><rect x="${ex1-9}" y="${ey-6}" width="18" height="12" rx="5"/><rect x="${ex2-9}" y="${ey-6}" width="18" height="12" rx="5"/></g><path d="M${ex1+9} ${ey-1} H${ex2-9}" stroke="#1f1f1f" stroke-width="2.4"/><path d="M${ex1-5} ${ey-3} l4 0" stroke="#fff" stroke-width="1.5" opacity=".6"/>`;break;
    case 'moustache':face=`<path d="M50 ${my-3} C45 ${my-6.5} 38 ${my-5} 35.5 ${my-.5} C40.5 ${my-2} 45 ${my-1} 50 ${my-2.4} C55 ${my-1} 59.5 ${my-2} 64.5 ${my-.5} C62 ${my-5} 55 ${my-6.5} 50 ${my-3} Z" fill="#5a3b2e"/>`;break;
    case 'coeur':face=`<g fill="#ff4d6d" opacity=".92">${[ex1,ex2].map(x=>`<path d="M${x} ${ey+7} C${x-12} ${ey-1} ${x-7} ${ey-11} ${x} ${ey-4} C${x+7} ${ey-11} ${x+12} ${ey-1} ${x} ${ey+7} Z"/>`).join('')}</g><path d="M${ex1+7} ${ey-2} H${ex2-7}" stroke="#d6335a" stroke-width="2.2"/>`;break;
    case 'monocle':face=`<circle cx="${ex2}" cy="${ey}" r="8" fill="#dff3ff" fill-opacity=".35" stroke="#c9a227" stroke-width="2.2"/><path d="M${ex2+7} ${ey+4} Q${ex2+12} ${ey+16} ${ex2+6} ${ey+26}" stroke="#c9a227" stroke-width="1.3" fill="none"/>`;break;
    case 'masque':face=`<path d="M30 ${my-6} Q50 ${my-10} 70 ${my-6} L68 ${my+7} Q50 ${my+13} 32 ${my+7} Z" fill="#cfe9ff" stroke="#9cc9ec" stroke-width="1"/><path d="M34 ${my-1} Q50 ${my-4} 66 ${my-1} M35 ${my+4} Q50 ${my+1} 65 ${my+4}" stroke="#9cc9ec" stroke-width="1.2" fill="none"/><path d="M30 ${my-6} L20 ${my-10} M70 ${my-6} L80 ${my-10}" stroke="#9cc9ec" stroke-width="1.4"/>`;break;
    case 'barbe':face=`<path d="M27 ${my-4} Q30 ${my+20} 50 ${my+22} Q70 ${my+20} 73 ${my-4} Q66 ${my+4} 58 ${my+1} Q50 ${my+6} 42 ${my+1} Q34 ${my+4} 27 ${my-4} Z" fill="#6b4532"/>`;break;
    case 'rousseur':face=[[33,62],[37,64],[34.5,66.5],[67,62],[63,64],[65.5,66.5]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.1" fill="#b5653f" opacity=".8"/>`).join('');break;
    case 'pansement':face=`<g transform="rotate(-25 68 64)"><rect x="60" y="61" width="16" height="6" rx="3" fill="#f2c7a5" stroke="#d9a982" stroke-width=".8"/><rect x="65.5" y="61" width="5" height="6" fill="#e6b28d"/></g>`;break;
    case 'cache':face=`<path d="M22 ${ey-12} L78 ${ey+2}" stroke="${ink}" stroke-width="1.6"/><ellipse cx="${ex1}" cy="${ey}" rx="8" ry="7" fill="${ink}"/>`;break;
  }
  let hat='';
  switch(ch.hat){
    case 'bandeau':hat=`<rect x="21" y="39" width="58" height="8" rx="4" fill="#e63946"/><rect x="21" y="42" width="58" height="2" fill="#fff" opacity=".85"/>`;break;
    case 'casquette':hat=`<path d="M25 42 C25 23 75 23 75 42 Z" fill="#2a6fdb"/><path d="M60 40.5 C72 39.5 86 41.5 90 45.5 C80 46.5 68 45.5 58 44.5 Z" fill="#1f56ad"/><circle cx="50" cy="26.5" r="2.5" fill="#1f56ad"/>`;break;
    case 'beret':hat=`<ellipse cx="46" cy="33" rx="25" ry="8" fill="#b23a48" transform="rotate(-10 46 33)"/><rect x="45" y="21.5" width="3" height="6" rx="1.5" fill="#8d2c38"/>`;break;
    case 'bonnet':hat=`<path d="M25 44 C25 17 75 17 75 44 Z" fill="#3fa7a0"/><rect x="23" y="40" width="54" height="8" rx="4" fill="#2f8a84"/><circle cx="50" cy="17" r="6" fill="#f4f1de"/>`;break;
    case 'paille':hat=`<ellipse cx="50" cy="37" rx="38" ry="8" fill="#e9c46a"/><path d="M32 37 C32 19 68 19 68 37 Z" fill="#f2d283"/><rect x="32" y="31" width="36" height="5" fill="#d1495b"/>`;break;
    case 'toque':hat=`<rect x="34" y="27" width="32" height="13" rx="2" fill="#fff" stroke="#ddd"/><circle cx="38" cy="22" r="9" fill="#fff" stroke="#ddd"/><circle cx="62" cy="22" r="9" fill="#fff" stroke="#ddd"/><circle cx="50" cy="17" r="10.5" fill="#fff" stroke="#ddd"/>`;break;
    case 'casque':hat=`<path d="M22 56 C22 21 78 21 78 56" fill="none" stroke="#333" stroke-width="5" stroke-linecap="round"/><rect x="14" y="49" width="12" height="19" rx="6" fill="#e63946"/><rect x="74" y="49" width="12" height="19" rx="6" fill="#e63946"/>`;break;
    case 'hautdeforme':hat=`<ellipse cx="50" cy="35" rx="26" ry="6" fill="#222"/><rect x="34" y="11" width="32" height="24" rx="3" fill="#2b2b2b"/><rect x="34" y="27" width="32" height="5" fill="#c1121f"/>`;break;
    case 'couronne':hat=`<path d="M30 38 L30 21 L40 29 L50 15 L60 29 L70 21 L70 38 Z" fill="#ffd166" stroke="#e0a800" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="29" r="2.6" fill="#e63946"/><circle cx="38" cy="33" r="1.8" fill="#4dabf7"/><circle cx="62" cy="33" r="1.8" fill="#4dabf7"/>`;break;
    case 'noeud':hat=`<path d="M64 31 L52 23 L53 39 Z M64 31 L76 23 L75 39 Z" fill="#ff5c8a" stroke="#e03e6f" stroke-width="1.2" stroke-linejoin="round"/><circle cx="64" cy="31" r="3.6" fill="#e03e6f"/>`;break;
    case 'fleurs':{let f='';const C_=['#ff6b9a','#ffd166','#ffffff','#c39bff','#ff9f68'];for(let k=0;k<7;k++){const t=k/6,x=27+t*46,y=38-Math.sin(t*Math.PI)*9;f+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.2" fill="${C_[k%5]}" stroke="rgba(0,0,0,.08)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="#f2a900"/>`;}hat=`<path d="M25 40 Q50 24 75 40" stroke="#5fae5a" stroke-width="2.4" fill="none"/>`+f;break;}
    case 'bob':hat=`<path d="M18 41 Q50 30 82 41 Q76 47 50 45 Q24 47 18 41 Z" fill="#f4a261"/><path d="M30 39 C30 21 70 21 70 39 Z" fill="#f6b37a"/><path d="M30 36 Q50 33 70 36" stroke="#e07a33" stroke-width="2" fill="none"/>`;break;
    case 'diplome':hat=`<path d="M34 30 L34 38 Q50 44 66 38 L66 30 Z" fill="#26323f"/><path d="M50 16 L84 27 L50 38 L16 27 Z" fill="#2f3d4d"/><path d="M50 27 L74 33 L74 44" stroke="#ffd166" stroke-width="1.8" fill="none"/><circle cx="74" cy="45" r="2.6" fill="#ffd166"/>`;break;
    case 'noel':hat=`<path d="M27 40 Q40 12 62 14 Q76 18 82 34 L72 30 Q66 22 60 24 Q72 36 73 40 Z" fill="#d62839"/><rect x="24" y="37" width="52" height="8" rx="4" fill="#fff"/><circle cx="83" cy="35" r="5" fill="#fff"/>`;break;
    case 'fete':hat=`<path d="M38 39 L52 8 L64 37 Z" fill="#7c5cff"/><path d="M42 30 L58 24 M45 22 L56 18 M40.5 35 L61.5 30" stroke="#ffd166" stroke-width="2.4" stroke-linecap="round"/><circle cx="52" cy="8" r="4" fill="#ff5c8a"/>`;break;
    case 'chantier':hat=`<path d="M25 42 C25 20 75 20 75 42 Z" fill="#ffc107"/><rect x="19" y="39" width="62" height="6" rx="3" fill="#f0ad00"/><rect x="47" y="21" width="6" height="19" rx="2" fill="#f0ad00"/>`;break;
    case 'sorcier':hat=`<ellipse cx="50" cy="38" rx="34" ry="7" fill="#3a2a6a"/><path d="M33 37 Q44 26 47 4 Q58 18 67 37 Z" fill="#4b3a8c"/><rect x="34" y="31" width="32" height="5" fill="#ffd166"/><path d="M50 18 l1.4 2.8 3 .4 -2.2 2.1 .6 3 -2.8 -1.5 -2.8 1.5 .6 -3 -2.2 -2.1 3 -.4 Z" fill="#ffd166"/>`;break;
    case 'pirate':hat=`<path d="M18 38 Q50 30 82 38 Q74 22 50 20 Q26 22 18 38 Z" fill="#222"/><path d="M18 38 Q50 30 82 38" stroke="#c9a227" stroke-width="2" fill="none"/><circle cx="50" cy="28" r="4" fill="#fff"/><path d="M46 32 L54 36 M54 32 L46 36" stroke="#fff" stroke-width="1.6"/>`;break;
    case 'viking':hat=`<path d="M26 42 C26 22 74 22 74 42 Z" fill="#8d99ae"/><rect x="24" y="38" width="52" height="6" rx="3" fill="#6c7689"/><path d="M27 34 Q12 30 14 14 Q20 26 30 28 Z" fill="#f3ead8" stroke="#d8ccb2" stroke-width="1"/><path d="M73 34 Q88 30 86 14 Q80 26 70 28 Z" fill="#f3ead8" stroke="#d8ccb2" stroke-width="1"/>`;break;
    case 'cowboy':hat=`<path d="M12 37 Q20 46 50 44 Q80 46 88 37 Q84 33 76 37 Q50 41 24 37 Q16 33 12 37 Z" fill="#8b5a2b"/><path d="M30 38 Q28 20 38 18 Q50 24 62 18 Q72 20 70 38 Z" fill="#a0693a"/><path d="M30.5 33 Q50 37 69.5 33" stroke="#5e3b1c" stroke-width="2.4" fill="none"/>`;break;
    case 'aureole':hat=`<ellipse cx="50" cy="17" rx="19" ry="5.5" fill="none" stroke="#ffd166" stroke-width="3.5"/><ellipse cx="50" cy="17" rx="19" ry="5.5" fill="none" stroke="#fff3c4" stroke-width="1.2"/>`;break;
  }
  return `<svg class="gam-av-svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${backO}${back}${body}${belly}${feet}${top}${eyes}${cheeks}${mouth}${outfit}${face}${hat}</svg>`;
}

// =========================================================
// Interface : puce topbar, menu profil, carte accueil, sidebar
// =========================================================
function _gamEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function gamDisplayName(){
  const acc=typeof socialProfile==='function'?socialProfile():null;
  return (acc&&acc.display_name)||localStorage.getItem('kp_firstname')||'Étudiant';
}

function gamRefreshUI(){
  if(!gam)return;
  const info=gamLevelInfo(gam.xp);
  const chipAv=document.getElementById('gam-chip-av');
  if(chipAv)chipAv.innerHTML=gamAvatarSVG(gam.char,30);
  const chipLvl=document.getElementById('gam-chip-lvl');
  if(chipLvl)chipLvl.textContent='Niv. '+info.level;
  const chipRing=document.getElementById('gam-chip-ring');
  if(chipRing)chipRing.style.setProperty('--p',Math.round(info.pct*100));
  // Sidebar desktop
  const dl=document.getElementById('dl-xp');
  if(dl){
    dl.innerHTML=`<div class="dl-xp-row"><span>Niv. ${info.level}</span><span>${info.into}/${info.need} XP</span></div><div class="gam-bar gam-bar-sm"><div class="gam-bar-fill" style="width:${Math.round(info.pct*100)}%"></div></div>`;
  }
  _gamRenderHomeCard(info);
  const menu=document.getElementById('gam-menu');
  if(menu&&menu.classList.contains('open'))_gamRenderMenu();
  const lc=document.getElementById('house-level-card');
  if(lc&&!_houseVisit)lc.innerHTML=_gamLevelCardHTML(info);
}

function _gamLevelCardHTML(info){
  const nx=gamNextReward(info.level);
  return `<div class="hlc-av">${gamAvatarSVG(gam.char,44)}</div>
    <div class="hlc-body">
      <div class="hlc-title">Niveau ${info.level}</div>
      <div class="gam-bar gam-bar-sm"><div class="gam-bar-fill" style="width:${Math.round(info.pct*100)}%"></div></div>
      <div class="hlc-sub">${info.into} / ${info.need} XP${nx?` · niv. ${nx.level} : ${_gamEsc(nx.reward.name)}`:''}</div>
    </div>`;
}

function _gamRenderHomeCard(info){
  const el=document.getElementById('gam-home-card');if(!el)return;
  const nx=gamNextReward(info.level);
  const unlockedRooms=GAM_ROOMS.filter(r=>r.level<=info.level).length;
  el.innerHTML=`
    <div class="ghc-av" onclick="gamOpenCharacter()" title="Personnaliser mon personnage">${gamAvatarSVG(gam.char,64)}<span class="ghc-lvl">${info.level}</span></div>
    <div class="ghc-body">
      <div class="ghc-kicker">Niveau ${info.level} · ${unlockedRooms}/${GAM_ROOMS.length} pièces</div>
      <div class="ghc-title">${info.toNext} XP avant le niveau ${info.level+1}</div>
      <div class="gam-bar"><div class="gam-bar-fill" style="width:${Math.round(info.pct*100)}%"></div></div>
      <div class="ghc-sub">${gam.today.date===gamDayKey()?gam.today.xp:0} XP aujourd’hui${nx?` · <span class="ghc-next"><span class="ms">lock_open</span>Niv. ${nx.level} : ${_gamEsc(nx.reward.name)}</span>`:''}</div>
    </div>
    <div class="ghc-actions">
      <button class="btn btn-sm btn-p" onclick="showScreen('house')"><span class="ms" style="font-size:15px">cottage</span> Ma maison</button>
      <button class="btn btn-sm btn-g" onclick="showScreen('city')"><span class="ms" style="font-size:15px">location_city</span> Ma ville</button>
      <button class="btn btn-sm btn-g" onclick="showScreen('social')"><span class="ms" style="font-size:15px">emoji_events</span> Classement</button>
    </div>`;
}

// Animation "+5 XP" près de la puce
function _gamFloat(txt,good){
  const chip=document.getElementById('gam-chip');
  if(!chip||!chip.offsetParent)return;
  const r=chip.getBoundingClientRect();
  const f=document.createElement('div');
  f.className='gam-float'+(good===false?' gam-float-dim':'');
  f.textContent=txt;
  f.style.left=(r.left+r.width/2)+'px';f.style.top=(r.bottom+4)+'px';
  document.body.appendChild(f);
  setTimeout(()=>f.remove(),1300);
}
function _gamChipBump(level){
  const chip=document.getElementById('gam-chip');if(!chip)return;
  chip.classList.remove('gam-chip-bump');void chip.offsetWidth;chip.classList.add('gam-chip-bump');
}
let _gamToastT=null;
function _gamToast(html){
  let t=document.getElementById('gam-toast');
  if(!t){t=document.createElement('div');t.id='gam-toast';t.className='gam-toast';document.body.appendChild(t);}
  t.innerHTML=html;t.classList.add('show');
  clearTimeout(_gamToastT);_gamToastT=setTimeout(()=>t.classList.remove('show'),3800);
}

// ── Menu profil (déroulant depuis la puce) ──
function gamToggleProfileMenu(e){
  if(e)e.stopPropagation();
  const m=document.getElementById('gam-menu');if(!m)return;
  if(m.classList.contains('open')){m.classList.remove('open');return;}
  _gamRenderMenu();m.classList.add('open');
}
function _gamCloseMenu(){const m=document.getElementById('gam-menu');if(m)m.classList.remove('open');}
document.addEventListener('click',e=>{
  const m=document.getElementById('gam-menu');
  if(m&&m.classList.contains('open')&&!m.contains(e.target)&&!e.target.closest('#gam-chip'))m.classList.remove('open');
});
function _gamExamDays(){
  try{
    const ex=(typeof getExamsV2==='function'?getExamsV2():[]).map(e=>e.date).filter(Boolean).sort();
    const today=new Date();today.setHours(0,0,0,0);
    for(const d of ex){const n=Math.round((new Date(d+'T00:00:00')-today)/864e5);if(n>=0)return n;}
  }catch(e){}
  return null;
}
function _gamRenderMenu(){
  const m=document.getElementById('gam-menu');if(!m)return;
  const info=gamLevelInfo(gam.xp),nx=gamNextReward(info.level);
  const streak=typeof stats!=='undefined'?stats.streak||0:0;
  const exam=_gamExamDays();
  const logged=typeof socialIsLogged==='function'&&socialIsLogged();
  const acc=typeof socialProfile==='function'?socialProfile():null;
  m.innerHTML=`
    <div class="gm-head">
      <div class="gm-av" onclick="gamOpenCharacter();_gamCloseMenu()" title="Personnaliser">${gamAvatarSVG(gam.char,76)}<span class="gm-edit"><span class="ms">edit</span></span></div>
      <div style="min-width:0">
        <div class="gm-name">${_gamEsc(gamDisplayName())}</div>
        ${acc&&acc.username?`<div class="gm-user">@${_gamEsc(acc.username)}</div>`:''}
        <div class="gm-level">Niveau <b>${info.level}</b></div>
        <div class="gm-xp">${info.into} / ${info.need} XP · encore ${info.toNext}</div>
      </div>
    </div>
    <div class="gam-bar"><div class="gam-bar-fill" style="width:${Math.round(info.pct*100)}%"></div></div>
    <div class="gm-stats">
      <div><b><span class="ms f" style="font-size:15px;color:#f97316">local_fire_department</span>${streak}</b><span>j de suite</span></div>
      <div><b>${gam.today.date===gamDayKey()?gam.today.xp:0}</b><span>XP aujourd’hui</span></div>
      <div><b>${exam==null?'—':'J-'+exam}</b><span>avant l’examen</span></div>
    </div>
    ${nx?`<div class="gm-next"><span class="gm-next-ic">${nx.reward.hex?`<span style="background:${nx.reward.hex}"></span>`:`<span class="ms">${nx.reward.icon}</span>`}</span><span>Au niveau ${nx.level}, tu débloques <b>${_gamEsc(nx.reward.name)}</b></span></div>`:''}
    <div class="gm-links">
      <button onclick="_gamCloseMenu();showScreen('house')"><span class="ms">cottage</span><span><b>Ma maison</b><small>personnage, meubles, récompenses</small></span></button>
      <button onclick="_gamCloseMenu();showScreen('city')"><span class="ms">location_city</span><span><b>Ma ville</b><small>construis ta ville grâce à tes XP</small></span></button>
      <button onclick="_gamCloseMenu();showScreen('social')"><span class="ms">emoji_events</span><span><b>Amis & classement</b><small>défie ta promo, partage tes cours</small></span></button>
      <button onclick="_gamCloseMenu();showScreen('agenda')"><span class="ms">calendar_month</span><span><b>Agenda</b><small>révisions, examens, évènements</small></span></button>
      <button onclick="_gamCloseMenu();showScreen('profil-hub')"><span class="ms">person</span><span><b>Mon profil</b><small>statistiques, activité, réglages</small></span></button>
      ${logged
        ?`<button onclick="_gamCloseMenu();socialSignOut()"><span class="ms">logout</span><span><b>Se déconnecter</b></span></button>`
        :`<button onclick="_gamCloseMenu();socialOpenAuth('signup')"><span class="ms">login</span><span><b>Créer un compte / se connecter</b><small>pour ajouter des amis et entrer au classement</small></span></button>`}
    </div>`;
}

// =========================================================
// Personnage (modal)
// =========================================================
let _gamDraftChar=null,_gamChTab='species';
const GCH_TABS=[['species','Animal','pets'],['hat','Chapeau','styler'],['face','Visage','sentiment_satisfied'],['outfit','Tenue','checkroom']];
/* tire un personnage au hasard parmi ce qui est débloqué */
function _gamRandomChar(){
  const L=gamLevelFromXP(gam.xp),pk=(A,none)=>{const o=A.filter(x=>x.level<=L);if(none&&Math.random()<.35)return null;return o.length?o[(Math.random()*o.length)|0]:null;};
  const s=pk(GAM_SPECIES),c=pk(GAM_COLORS),h=pk(GAM_HATS,1),f=pk(GAM_FACES,1),o=pk(GAM_OUTFITS,1),m=pk(GAM_MOODS,1);
  Object.assign(_gamDraftChar,{species:s?s.id:_gamDraftChar.species,color:c?c.hex:_gamDraftChar.color,hat:h&&h.id,face:f&&f.id,outfit:o&&o.id,mood:m&&m.id});
  _gamRenderCharacter();
}
function gamOpenCharacter(){
  _gamDraftChar=Object.assign({},gamNormChar(gam.char));
  _gamRenderCharacter();
  openModal('modal-gam-char');
}
function _gamRenderCharacter(){
  const body=document.getElementById('modal-gam-char-body');if(!body)return;
  const L=gamLevelFromXP(gam.xp),d=_gamDraftChar;
  const lock=lv=>lv>L?`<span class="gch-lock"><span class="ms">lock</span>${lv}</span>`:'';
  const opt=(kind,id,inner,lv,title)=>`<button class="gch-opt${d[kind]===id?' sel':''}${lv>L?' locked':''}" ${lv>L?'disabled':''} onclick="_gamPick('${kind}',${id===null?'null':`'${id}'`})" title="${_gamEsc(title)}${lv>L?' — niveau '+lv:''}">${inner}${lock(lv)}</button>`;
  body.innerHTML=`
    <div class="mdttl">Mon personnage</div>
    <div class="mddesc">Il vit dans ta maison et apparaît à côté de ton nom dans le classement.</div>
    <div class="gch-layout">
      <div class="gch-preview">${gamAvatarSVG(d,150)}<div class="gch-preview-name">${_gamEsc((GAM_SPECIES.find(s=>s.id===d.species)||{}).name||'')}</div></div>
      <div class="gch-sections">
        <div class="gch-tabs" role="tablist">${GCH_TABS.map(([k,n,ic])=>`<button class="${_gamChTab===k?'on':''}" onclick="_gamChTab='${k}';_gamRenderCharacter()" role="tab" aria-selected="${_gamChTab===k}"><span class="ms">${ic}</span>${n}</button>`).join('')}</div>
        ${_gamChTab==='species'?`<div class="fl">Espèce <em class="gch-n">${GAM_SPECIES.filter(s=>s.level<=L).length} / ${GAM_SPECIES.length}</em></div>
        <div class="gch-grid">${GAM_SPECIES.map(s=>opt('species',s.id,gamAvatarSVG(Object.assign({},d,{species:s.id,hat:null,face:null,outfit:null,mood:null}),46),s.level,s.name)).join('')}</div>
        <div class="fl">Couleur</div>
        <div class="gch-grid gch-colors">${GAM_COLORS.map(c=>opt('color',c.hex,`<span class="gch-swatch" style="background:${c.hex}"></span>`,c.level,c.name)).join('')}</div>`:''}
        ${_gamChTab==='hat'?`<div class="fl">Chapeau</div>
        <div class="gch-grid">${opt('hat',null,'<span class="ms gch-none">block</span>',1,'Aucun')}${GAM_HATS.map(h=>opt('hat',h.id,gamAvatarSVG(Object.assign({},d,{hat:h.id,face:null,outfit:null}),46),h.level,h.name)).join('')}</div>`:''}
        ${_gamChTab==='face'?`<div class="fl">Visage</div>
        <div class="gch-grid">${opt('face',null,'<span class="ms gch-none">block</span>',1,'Aucun')}${GAM_FACES.map(h=>opt('face',h.id,gamAvatarSVG(Object.assign({},d,{face:h.id,hat:null,outfit:null}),46),h.level,h.name)).join('')}</div>
        <div class="fl">Expression</div>
        <div class="gch-grid">${opt('mood',null,gamAvatarSVG(Object.assign({},d,{mood:null,hat:null,outfit:null}),46),1,'Normal')}${GAM_MOODS.map(h=>opt('mood',h.id,gamAvatarSVG(Object.assign({},d,{mood:h.id,hat:null,outfit:null}),46),h.level,h.name)).join('')}</div>`:''}
        ${_gamChTab==='outfit'?`<div class="fl">Tenue</div>
        <div class="gch-grid">${opt('outfit',null,'<span class="ms gch-none">block</span>',1,'Aucune')}${GAM_OUTFITS.map(h=>opt('outfit',h.id,gamAvatarSVG(Object.assign({},d,{outfit:h.id,hat:null}),46),h.level,h.name)).join('')}</div>`:''}
        <button class="gch-rand" onclick="_gamRandomChar()"><span class="ms">casino</span>Au hasard</button>
      </div>
    </div>
    <div class="fr" style="margin-top:18px;gap:8px">
      <button class="btn btn-p" onclick="gamSaveCharacter()">Enregistrer</button>
      <button class="btn btn-g" onclick="closeModal('modal-gam-char')">Annuler</button>
    </div>`;
}
function _gamPick(kind,val){_gamDraftChar[kind]=val;_gamRenderCharacter();}
function gamSaveCharacter(){
  gam.char=gamNormChar(_gamDraftChar);gam.charChosen=true;gamSave();
  closeModal('modal-gam-char');gamRefreshUI();
  if(_houseMod&&!_houseVisit)_houseMod.update({char:gam.char});
  if(typeof socialPushProfile==='function')socialPushProfile();
  showNotif('Personnage enregistré !','ok');
}

// =========================================================
// Récompenses (modal) — tout ce qui se débloque, niveau par niveau
// =========================================================
function gamOpenRewards(){
  const body=document.getElementById('modal-gam-rewards-body');if(!body)return;
  const L=gamLevelFromXP(gam.xp);
  const levels=[];
  for(let lv=2;lv<=30;lv++){const r=gamRewardsAt(lv);if(r.length)levels.push({lv,r});}
  body.innerHTML=`
    <div class="mdttl">Récompenses</div>
    <div class="mddesc">Chaque niveau débloque quelque chose : pièces, meubles, accessoires… Tu es <b>niveau ${L}</b>.</div>
    <div class="grw-list">${levels.map(({lv,r})=>`
      <div class="grw-row${lv<=L?' done':''}${lv===L+1?' next':''}">
        <div class="grw-lv">${lv<=L?'<span class="ms f">check_circle</span>':'<span class="ms">lock</span>'}<span>Niv. ${lv}</span></div>
        <div class="grw-items">${r.map(x=>`<span class="grw-item grw-${x.type}">${x.hex?`<i style="background:${x.hex}"></i>`:`<span class="ms">${x.icon}</span>`}${_gamEsc(x.name)}</span>`).join('')}</div>
      </div>`).join('')}</div>
    <div class="grw-howto">
      <div class="fl" style="margin-top:6px">Comment gagner de l’XP</div>
      <ul>
        <li>Bonne réponse : <b>+${GAM_XP.correct} XP</b> · mauvaise réponse : <b>+${GAM_XP.wrong} XP</b> (l’effort compte !)</li>
        <li>Session terminée (5 questions min.) : <b>+${GAM_XP.session} XP</b> · sans faute (10 min.) : <b>+${GAM_XP.perfect} XP</b></li>
        <li>Objectif du jour atteint : <b>+${GAM_XP.goal} XP</b> · série : <b>+${GAM_XP.streakDay} XP</b> par jour de série (max ${GAM_XP.streakCap*GAM_XP.streakDay})</li>
        <li>Flashcards : <b>+${GAM_XP.fcKnew} XP</b> si tu savais, <b>+${GAM_XP.fcAgain}</b> sinon</li>
        <li>Paliers de la semaine et podium du classement : jusqu’à <b>+${GAM_PODIUM[0]} XP</b></li>
      </ul>
    </div>
    <div class="fr" style="margin-top:16px"><button class="btn btn-p" onclick="closeModal('modal-gam-rewards')">Fermer</button></div>`;
  openModal('modal-gam-rewards');
}

// =========================================================
// Maison 3D — contrôleur (le rendu est dans js/house.js, module chargé à la demande)
// =========================================================
let _houseMod=null,_houseLoading=null,_houseMounted=false,_houseDeco=false,_houseVisit=null,_houseCat='all',_houseSel=null,_houseGrid=false;

function _gamRoomsUnlocked(level){return GAM_ROOMS.filter(r=>r.level<=level).map(r=>r.id);}
function gamItemFits(items,it,ignoreUid,level){
  const f=GAM_FURNITURE.find(x=>x.id===it.type);if(!f)return false;
  const rot=it.rot||0,w=rot%2?f.d:f.w,d=rot%2?f.w:f.d;
  const room=GAM_ROOMS.find(r=>it.x>=r.x&&it.z>=r.z&&it.x+w<=r.x+r.w&&it.z+d<=r.z+r.d);
  if(!room||room.level>level)return false;
  if(room.id==='piscine'&&it.x<GAM_POOL.x+GAM_POOL.w&&it.x+w>GAM_POOL.x&&it.z<GAM_POOL.z+GAM_POOL.d&&it.z+d>GAM_POOL.z)return false;
  return !items.some(o=>{
    if(o.uid===ignoreUid)return false;
    const g=GAM_FURNITURE.find(x=>x.id===o.type);if(!g)return false;
    if(!!g.flat!==!!f.flat)return false;
    const ow=(o.rot||0)%2?g.d:g.w,od=(o.rot||0)%2?g.w:g.d;
    return it.x<o.x+ow&&it.x+w>o.x&&it.z<o.z+od&&it.z+d>o.z;
  });
}
// Meuble chaque pièce débloquée une seule fois (meubles par défaut)
function _gamFurnishUnlocked(){
  const L=gamLevelFromXP(gam.xp);let changed=false;
  GAM_ROOMS.forEach(r=>{
    if(r.level>L||gam.house.furnished[r.id])return;
    gam.house.furnished[r.id]=true;changed=true;
    (GAM_DEFAULT_ITEMS[r.id]||[]).forEach(([type,dx,dz,rot])=>{
      const it={uid:gamUUID().slice(0,8),type,x:r.x+dx,z:r.z+dz,rot};
      if(gamItemFits(gam.house.items,it,null,L))gam.house.items.push(it);
    });
  });
  if(changed&&_houseMod&&_houseMounted&&!_houseVisit)_houseMod.update({items:gam.house.items,level:L});
  return changed;
}

// house.js est un script classique (marche aussi en file://) qui expose window.KineHouseReady
function _houseLoad(){
  if(_houseMod)return Promise.resolve(_houseMod);
  if(!_houseLoading){
    _houseLoading=new Promise((res,rej)=>{
      if(window.KineHouseReady)return res(window.KineHouseReady);
      const s=document.createElement('script');s.src='js/house.js?v=7';
      s.onload=()=>window.KineHouseReady?res(window.KineHouseReady):rej(new Error('house.js chargé mais vide'));
      s.onerror=()=>rej(new Error('fichier js/house.js introuvable'));
      document.head.appendChild(s);
    }).then(m=>{_houseMod=m;return m;})
      .catch(e=>{_houseLoading=null;window.KineHouseReady=null;throw e;});
  }
  return _houseLoading;
}

function renderHouse(){
  const stage=document.getElementById('house-stage');if(!stage)return;
  const loading=document.getElementById('house-loading');
  const owner=_houseVisit;
  const L=owner?owner.level:gamLevelFromXP(gam.xp);
  // HUD
  const lc=document.getElementById('house-level-card');
  if(lc)lc.innerHTML=owner
    ?`<div class="hlc-av">${gamAvatarSVG(owner.char,44)}</div><div class="hlc-body"><div class="hlc-title">Maison de ${_gamEsc(owner.name)}</div><div class="hlc-sub">Niveau ${owner.level} · ${GAM_ROOMS.filter(r=>r.level<=owner.level).length} pièces</div></div>`
    :_gamLevelCardHTML(gamLevelInfo(gam.xp));
  document.getElementById('house-screen-wrap').classList.toggle('visiting',!!owner);
  const vn=document.getElementById('house-visit-name');if(vn&&owner)vn.textContent='Tu visites la maison de '+owner.name;
  if(owner&&_houseDeco)houseToggleDecorate(false);
  if(loading){loading.style.display='flex';loading.innerHTML='<div class="house-spinner"></div>Construction de la maison…';}
  _houseLoad().then(mod=>{
    const opts={
      rooms:GAM_ROOMS,pool:GAM_POOL,furniture:GAM_FURNITURE,
      items:owner?owner.items:gam.house.items,char:owner?owner.char:gam.char,level:L,
      readOnly:!!owner,labelsEl:document.getElementById('house-labels'),
      fits:(items,it,ign)=>gamItemFits(items,it,ign,L),
      onItemsChange:items=>{if(_houseVisit)return;gam.house.items=items;gam.house.modified=true;gamSave();_houseDropNewBadges();if(typeof socialPushProfile==='function')socialPushProfile();},
      onSelect:sel=>{_houseSel=sel;_houseRenderSelBar();},
      onArmEnd:()=>{_houseRenderDeco();},
      onCharClick:()=>_houseCharSay()
    };
    if(_houseMounted)mod.update(opts);else{mod.mount(stage,opts);_houseMounted=true;}
    if(loading)loading.style.display='none';
    if(!owner&&!gam.decoV2Seen){
      gam.decoV2Seen=true;gamSave();
      const nv=GAM_FURNITURE.filter(f=>f.nv===2),ok=nv.filter(f=>f.level<=L).length;
      setTimeout(()=>_gamToast(`<span class="ms f">redeem</span> ${nv.length} nouvelles décorations${ok?`, dont ${ok} déjà débloquées`:''} : ouvre « Décorer » !`),800);
    }
  }).catch(err=>{
    console.error('[house]',err);
    if(loading){
      const webgl=/WebGL/i.test(String(err&&err.message));
      loading.style.display='flex';
      loading.innerHTML=`<span class="ms" style="font-size:28px">${webgl?'videocam_off':'wifi_off'}</span>Impossible de charger la 3D.<br>`
        +`<small>${webgl?'Ton navigateur bloque la 3D (WebGL) : active l’accélération matérielle dans ses réglages.':'Vérifie ta connexion internet puis réessaie.'}</small>`
        +`<small class="house-err">Détail : ${_gamEsc(err&&err.message||err)}</small>`
        +`<button class="btn btn-sm btn-g" style="margin-top:10px" onclick="renderHouse()">Réessayer</button>`;
    }
  });
}
function houseSleep(){
  if(_houseMod&&_houseMounted){_houseMod.unmount();_houseMounted=false;}
  clearInterval(_spinT);_spinT=null;const ha=document.getElementById('house-armed');if(ha)ha.style.display='none';
  if(_houseDeco){_houseDeco=false;const p=document.getElementById('house-deco');if(p)p.style.display='none';const b=document.getElementById('house-deco-btn');if(b)b.classList.remove('active');const w=document.getElementById('house-screen-wrap');if(w)w.classList.remove('deco');}
}
function gamVisitHouse(owner){
  // owner : {name, level, char, items}
  _houseVisit=owner;
  if(document.body.dataset.screen==='house')renderHouse();else showScreen('house');
}
function houseBackHome(){_houseVisit=null;renderHouse();}

function houseToggleDecorate(force){
  if(_houseVisit)return;
  _houseDeco=typeof force==='boolean'?force:!_houseDeco;
  const p=document.getElementById('house-deco'),b=document.getElementById('house-deco-btn');
  if(p)p.style.display=_houseDeco?'flex':'none';
  if(b)b.classList.toggle('active',_houseDeco);
  const w=document.getElementById('house-screen-wrap');if(w)w.classList.toggle('deco',_houseDeco);
  if(_houseMod&&_houseMounted)_houseMod.setDecorate(_houseDeco);
  if(_houseDeco)_houseRenderDeco();else{_houseSel=null;_houseRenderSelBar();_houseRenderArmed();}
}
function _houseRenderDeco(){
  const p=document.getElementById('house-deco');if(!p||!_houseDeco)return;
  const L=gamLevelFromXP(gam.xp);
  const cats=GAM_ROOMS.map(r=>({id:r.id,name:r.name,locked:r.level>L,level:r.level}));
  const armed=_houseMod&&_houseMod.armedType?_houseMod.armedType():null;
  const order=Object.fromEntries(GAM_ROOMS.map((r,i)=>[r.id,i]));
  const placed=new Set(gam.house.items.map(i=>i.type));
  // Débloqués d'abord (par pièce puis niveau), puis les verrouillés par niveau
  const list=GAM_FURNITURE.filter(f=>_houseCat==='all'||f.cat===_houseCat).sort((a,b)=>{
    const la=a.level>L,lb=b.level>L;if(la!==lb)return la?1:-1;
    if(la||_houseCat!=='all')return a.level-b.level;
    return (order[a.cat]-order[b.cat])||(a.level-b.level);
  });
  p.innerHTML=`
    <div class="hd-head">
      <div class="hd-title"><span class="ms">brush</span> Décorer <small>Choisis un meuble puis clique sur le sol d’une pièce débloquée.</small></div>
      <button class="hd-close" onclick="houseToggleDecorate(false)" aria-label="Terminer"><span class="ms">check</span> Terminer</button>
    </div>
    <div class="hd-cats">
      <button class="hd-cat${_houseCat==='all'?' active':''}" onclick="_houseSetCat('all')">Tout</button>
      ${cats.map(c=>`<button class="hd-cat${_houseCat===c.id?' active':''}${c.locked?' locked':''}" onclick="_houseSetCat('${c.id}')">${c.locked?'<span class="ms">lock</span>':''}${_gamEsc(c.name)}</button>`).join('')}
    </div>
    <div class="hd-items">${list.map(f=>{
      const locked=f.level>L;
      const th=_houseMod&&_houseMod.thumbCached?_houseMod.thumbCached(f.id,128):null;
      return `<button class="hd-item${locked?' locked':''}${armed===f.id?' armed':''}" data-type="${f.id}" ${locked?'disabled':''} onclick="_houseArm('${f.id}')" title="${_gamEsc(f.name)} (${f.w}×${f.d})">
        ${f.nv===2&&!locked&&!placed.has(f.id)?'<span class="hd-new">Nouveau</span>':''}
        <span class="hd-thumb">${th?`<img src="${th}" alt="">`:`<span class="ms">${f.icon}</span>`}</span><span class="hd-item-name">${_gamEsc(f.name)}</span>
        ${locked?`<span class="hd-item-lock"><span class="ms">lock</span>Niv. ${f.level}</span>`:`<span class="hd-item-size">${f.w}×${f.d}</span>`}
      </button>`;}).join('')}</div>`;
  _houseFillThumbs();
  _houseRenderArmed();
}
// Retire le badge « Nouveau » des objets qu'on vient de poser (sans redessiner le catalogue)
function _houseDropNewBadges(){
  const placed=new Set(gam.house.items.map(i=>i.type));
  document.querySelectorAll('#house-deco .hd-item[data-type] .hd-new').forEach(b=>{if(placed.has(b.parentElement.dataset.type))b.remove();});
}
// Vignettes 3D générées petit à petit (quelques-unes par image) pour garder l'écran fluide
let _thumbT=null;
function _houseFillThumbs(){
  if(!_houseMod||!_houseMod.thumb||_thumbT)return;
  const step=()=>{
    _thumbT=null;if(!_houseDeco)return;
    const todo=[...document.querySelectorAll('#house-deco .hd-item[data-type]')].filter(el=>!el.querySelector('.hd-thumb img'));
    if(!todo.length)return;
    todo.slice(0,4).forEach(el=>{
      try{const url=_houseMod.thumb(el.dataset.type,128);el.querySelector('.hd-thumb').innerHTML=`<img src="${url}" alt="">`;}
      catch(e){console.warn('[house] vignette',el.dataset.type,e);el.removeAttribute('data-type');}
    });
    _thumbT=setTimeout(step,16);
  };
  _thumbT=setTimeout(step,30);
}
// Aperçu 3D qui tourne de l'objet choisi, avant de le poser
let _spinT=null;
function _houseRenderArmed(){
  const el=document.getElementById('house-armed');if(!el)return;
  clearInterval(_spinT);_spinT=null;
  const type=_houseDeco&&_houseMod&&_houseMod.armedType?_houseMod.armedType():null;
  const f=type&&GAM_FURNITURE.find(x=>x.id===type);
  if(!f){el.style.display='none';return;}
  const room=GAM_ROOMS.find(r=>r.id===f.cat);
  el.style.display='flex';
  el.innerHTML=`<div class="ha-spin"><img id="ha-img" alt="${_gamEsc(f.name)}"></div>
    <div class="ha-txt"><small>${_gamEsc(room?room.name:'')} · ${f.w}×${f.d} case${f.w*f.d>1?'s':''}</small><b>${_gamEsc(f.name)}</b><span>Clique sur le sol d’une pièce débloquée pour le poser.</span></div>
    <div class="ha-btns"><button onclick="_houseMod.rotateSelected()"><span class="ms">rotate_right</span>Tourner</button><button class="ghost" onclick="_houseMod.disarm()"><span class="ms">close</span>Annuler</button></div>`;
  let frames=null;try{frames=_houseMod.spin(type,16,220);}catch(e){console.warn('[house] aperçu',e);}
  const img=document.getElementById('ha-img');
  if(frames&&frames.length&&img){
    let i=0;img.src=frames[0];
    _spinT=setInterval(()=>{const im=document.getElementById('ha-img');if(!im){clearInterval(_spinT);_spinT=null;return;}i=(i+1)%frames.length;im.src=frames[i];},110);
  }
}
function _houseSetCat(c){_houseCat=c;_houseRenderDeco();}
function _houseArm(type){
  if(!_houseMod)return;
  if(_houseMod.armedType()===type)_houseMod.disarm();else _houseMod.arm(type);
  _houseRenderDeco();
}
function _houseRenderSelBar(){
  const bar=document.getElementById('house-sel-bar');if(!bar)return;
  if(!_houseSel||!_houseDeco){bar.style.display='none';return;}
  const f=GAM_FURNITURE.find(x=>x.id===_houseSel.type);
  bar.style.display='flex';
  const th=f&&_houseMod&&_houseMod.thumbCached?_houseMod.thumbCached(f.id,128):null;
  bar.innerHTML=`<span class="hsb-name">${th?`<img src="${th}" alt="">`:`<span class="ms">${f?f.icon:'chair'}</span>`}${_gamEsc(f?f.name:'Meuble')}</span>
    <button onclick="_houseMod.rotateSelected()"><span class="ms">rotate_right</span>Tourner</button>
    <button onclick="_houseMod.moveSelected();_houseRenderDeco()"><span class="ms">open_with</span>Déplacer</button>
    <button class="danger" onclick="_houseMod.deleteSelected()"><span class="ms">delete</span>Retirer</button>
    <button class="ghost" onclick="_houseMod.select(null)" aria-label="Fermer"><span class="ms">close</span></button>`;
}
function houseCam(a){
  if(a==='grid'){_houseGrid=!_houseGrid;const b=document.getElementById('house-grid-btn');if(b)b.classList.toggle('active',_houseGrid);}
  if(_houseMod&&_houseMounted){if(a==='grid')_houseMod.setGrid(_houseGrid);else _houseMod.cam(a);}
}
const _HOUSE_LINES=[
  n=>`Encore ${n} XP et on passe au niveau suivant !`,
  ()=>'Une petite session Flash ? 10 questions, 5 minutes.',
  ()=>'Les questions dures rapportent autant… mais on les retient mieux !',
  ()=>'La régularité bat l’intensité. On fait un peu chaque jour ?',
  ()=>'Psst… le classement de la semaine se termine dimanche soir.'
];
function _houseCharSay(){
  const info=gamLevelInfo(gam.xp);
  const line=_houseVisit?`Coucou ! Bienvenue chez ${_gamEsc(_houseVisit.name)} 👋`:_HOUSE_LINES[Math.random()*_HOUSE_LINES.length|0](info.toNext);
  if(_houseMod)_houseMod.say(line);
}

// =========================================================
// Synchro serveur (utilisé par social.js)
// =========================================================
// Scelle les compteurs non envoyés en lots avec un identifiant unique (idempotence côté serveur)
function gamSealOutbox(){
  if(!gam)gamLoad();
  Object.entries(gam.unsynced).forEach(([wk,u])=>{
    if(!(u.xp||u.bonus||u.q||u.s))return;
    gam.outbox.push({id:gamUUID(),wk,xp:u.xp,bonus:u.bonus,q:u.q,c:u.c,s:u.s,retro:!!u.retro});
  });
  gam.unsynced={};gamSave();
  return gam.outbox.slice();
}
function gamPendingXP(){
  if(!gam)return 0;
  let n=0;
  gam.outbox.forEach(b=>n+=b.xp+b.bonus);
  Object.values(gam.unsynced).forEach(u=>n+=(u.xp||0)+(u.bonus||0));
  return n;
}
// Après envoi réussi : retire les lots acceptés et aligne l'XP sur le total serveur
function gamAckOutbox(ids,serverTotal,serverWeek){
  if(!gam)return;
  gam.outbox=gam.outbox.filter(b=>!ids.includes(b.id));
  if(typeof serverTotal==='number'){
    const before=gamLevelFromXP(gam.xp);
    gam.xp=Math.max(0,serverTotal+gamPendingXP());
    const after=gamLevelFromXP(gam.xp);
    if(after>before)_gamQueueLevelUp(before,after);
    _gamFurnishUnlocked();
  }
  if(serverWeek)gam.serverWeek=Object.assign({start:gam.week.start},serverWeek);
  gamSave();gamRefreshUI();
}
function gamGrantBonus(xp,label){
  gamAward(xp,'bonus',null,{silent:true});
  if(label)_gamToast(label);
}

// =========================================================
// Initialisation + branchements
// =========================================================
function _gamRetroBonus(){
  // Bonus d'ancienneté : récompense les questions déjà travaillées avant l'arrivée de l'XP
  let attempts=0,errors=0;
  try{Object.values(typeof diffData!=='undefined'?diffData:{}).forEach(d=>{attempts+=d.attempts||0;errors+=d.errors||0;});}catch(e){}
  const correct=Math.max(0,attempts-errors);
  const xp=Math.min(Math.round(correct*2+(attempts-correct)*.5),gamCumXP(GAM_RETRO_CAP_LEVEL));
  return {attempts,xp};
}

function gamInit(){
  const fresh=gamLoad();
  _gamRoll();
  if(fresh){
    const r=_gamRetroBonus();
    if(r.xp>0){
      gamAward(r.xp,'bonus',null,{silent:true,retro:true});
      gam.seenLevel=gamLevelFromXP(gam.xp);gam.pendingLevelUp=null;
      setTimeout(()=>{
        const body=document.getElementById('modal-gam-levelup-body');if(!body)return;
        body.innerHTML=`<div class="gam-lu">
          <div class="gam-lu-rays"></div>
          <div class="gam-lu-av">${gamAvatarSVG(gam.char,120)}</div>
          <div class="gam-lu-kicker">Nouveau : l’XP et ta maison</div>
          <div class="gam-lu-level">Niveau ${gamLevelFromXP(gam.xp)}</div>
          <p class="gam-lu-none">Tu as déjà répondu à <b>${r.attempts.toLocaleString('fr-FR')}</b> questions : on t’offre <b>${r.xp} XP</b> de bonus d’ancienneté.<br>Chaque réponse te fait maintenant gagner de l’XP pour agrandir ta maison.</p>
          <div class="fr" style="justify-content:center;gap:8px;margin-top:18px">
            <button class="btn btn-p" onclick="closeModal('modal-gam-levelup');gamOpenCharacter()">Choisir mon personnage</button>
            <button class="btn btn-g" onclick="closeModal('modal-gam-levelup')">Plus tard</button>
          </div></div>`;
        openModal('modal-gam-levelup');
      },1200);
    }
  }
  _gamFurnishUnlocked();
  gamSave();
  _gamHook();
  gamRefreshUI();
}

function _gamWrap(name,after,before){
  const orig=window[name];if(typeof orig!=='function')return;
  window[name]=function(){
    let snap;
    try{if(before)snap=before.apply(this,arguments);}catch(e){console.warn('[gam]',name,e);}
    const r=orig.apply(this,arguments);
    try{if(after)after(snap,arguments);}catch(e){console.warn('[gam]',name,e);}
    return r;
  };
}
function _gamSessionSnap(){
  if(typeof session==='undefined'||!session||!session.qs)return null;
  const answered=(session.answers||[]).filter(a=>!a.skipped).length;
  return {answered,correct:session.correct||0,mode:session.mode,duration:typeof sessionStart!=='undefined'&&sessionStart?Math.floor((Date.now()-sessionStart)/1000):0};
}
function _gamHook(){
  _gamWrap('recordAnswer',(s,args)=>gamOnAnswer(!!args[1]));
  _gamWrap('endSession',snap=>{if(snap)gamOnSessionEnd(snap);},_gamSessionSnap);
  _gamWrap('showSurvivalGameOver',snap=>{if(snap)gamOnSurvivalEnd(snap);},_gamSessionSnap);
  _gamWrap('updateFCSpaced',(s,args)=>gamAward(args[1]?GAM_XP.fcKnew:GAM_XP.fcAgain,'activity',{q:0},{silent:true}));
}

document.addEventListener('DOMContentLoaded',gamInit);
