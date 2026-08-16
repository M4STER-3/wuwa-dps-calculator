import type {
  CombatAction,
  CombatEffect,
  MainEcho,
  RecommendedBuildPreset,
  Resonator,
  Sonata,
  SourceMetadata,
  Weapon,
} from "@/domain/models";

const verifiedAt = "2026-08-16";
const reviewedSources =
  "WuWaBuilds; Wuthering Waves Wiki/Fandom; Wuwa Wiki; Prydwen; Wuthering.gg; Game8; WutheringLab; Lootbar";

export const aemeathGameSource: SourceMetadata = {
  kind: "multi-source-verified",
  source: reviewedSources,
  verifiedAt,
  notes:
    "Données de jeu recoupées hors ligne à partir de la collecte fournie. Max Resonance Energy retenu à 125; l’en-tête Wuthering.gg indique encore 140, valeur disputée, tandis que ses autres données et plusieurs sources concordent sur 125.",
};

const communityBuildSource: SourceMetadata = {
  kind: "community-recommendation",
  source: "Prydwen et recommandations communautaires recoupées",
  verifiedAt,
  notes:
    "Objectifs indicatifs S0 endgame, non assimilables à des caps. Energy Regen dépend de l’équipe.",
};

const unknownTiming = () => ({ value: null, confidence: "unknown" as const });
const action = (
  value: Omit<
    CombatAction,
    | "level"
    | "castDurationSeconds"
    | "recoverySeconds"
    | "hitTimingsSeconds"
    | "source"
  >,
): CombatAction => ({
  ...value,
  level: 10,
  castDurationSeconds: unknownTiming(),
  recoverySeconds: unknownTiming(),
  hitTimingsSeconds: unknownTiming(),
  source: aemeathGameSource,
});

const aemeathActions: readonly CombatAction[] = [
  action({ id: "aemeath-basic-1", name: "Infinity Calibration: Basic Attack Stage 1", talent: "basicAttack", variant: "Stage 1", requiredForm: "Aemeath", damageType: "basicAttack", multipliers: [{ percent: 46.35, hits: 1 }] }),
  action({ id: "aemeath-basic-2", name: "Infinity Calibration: Basic Attack Stage 2", talent: "basicAttack", variant: "Stage 2", requiredForm: "Aemeath", damageType: "basicAttack", multipliers: [{ percent: 13.89, hits: 1 }, { percent: 20.84, hits: 1 }, { percent: 34.73, hits: 1 }] }),
  action({ id: "aemeath-basic-3", name: "Infinity Calibration: Basic Attack Stage 3", talent: "basicAttack", variant: "Stage 3", requiredForm: "Aemeath", damageType: "basicAttack", multipliers: [{ percent: 9.32, hits: 3 }, { percent: 18.63, hits: 1 }, { percent: 46.56, hits: 1 }] }),
  action({ id: "aemeath-basic-4", name: "Infinity Calibration: Basic Attack Stage 4", talent: "basicAttack", variant: "Stage 4", requiredForm: "Aemeath", damageType: "basicAttack", multipliers: [{ percent: 6.73, hits: 5 }, { percent: 100.94, hits: 1 }] }),
  action({ id: "aemeath-heavy-1", name: "Heavy Attack Charged I", talent: "basicAttack", variant: "Charged I", requiredForm: "Aemeath", damageType: "heavyAttack", multipliers: [{ percent: 18.57, hits: 1 }, { percent: 74.26, hits: 1 }], costs: [{ resource: "stamina", amount: 20 }] }),
  action({ id: "aemeath-heavy-2", name: "Heavy Attack Charged II", talent: "basicAttack", variant: "Charged II", requiredForm: "Aemeath", damageType: "heavyAttack", conditionalDamageType: { damageType: "resonanceLiberation", condition: "Instant Response et Heavenfall Edict: Unbound" }, multipliers: [{ percent: 11.6, hits: 4 }, { percent: 185.6, hits: 1 }], costs: [{ resource: "stamina", amount: 20 }], notes: ["Sous Instant Response et Heavenfall Edict: Unbound, restaure 200 Synchronization Rate."] }),
  action({ id: "aemeath-midair", name: "Mid-air Attack", talent: "basicAttack", requiredForm: "Aemeath", damageType: "basicAttack", multipliers: [{ percent: 86.29, hits: 1 }], costs: [{ resource: "stamina", amount: 30 }] }),
  action({ id: "aemeath-dodge-counter", name: "Dodge Counter", talent: "basicAttack", requiredForm: "Aemeath", damageType: "basicAttack", multipliers: [{ percent: 26.02, hits: 3 }, { percent: 52.03, hits: 1 }, { percent: 130.06, hits: 1 }] }),
  action({ id: "armament-merge", name: "Sync Strike: Armament Merge", talent: "resonanceSkill", requiredForm: "Aemeath", damageType: "resonanceSkill", multipliers: [{ percent: 26.92, hits: 1 }, { percent: 40.38, hits: 1 }, { percent: 67.29, hits: 1 }] }),
  action({ id: "call-of-dawn", name: "Sync Strike: Call of Dawn", talent: "resonanceSkill", requiredForm: "Mech", damageType: "resonanceSkill", multipliers: [{ percent: 16.33, hits: 3 }, { percent: 114.28, hits: 1 }] }),
  action({ id: "mech-basic-1", name: "Mech Basic Attack Stage 1", talent: "resonanceSkill", variant: "Stage 1", requiredForm: "Mech", damageType: "basicAttack", multipliers: [{ percent: 23.2, hits: 3 }] }),
  action({ id: "mech-basic-2", name: "Mech Basic Attack Stage 2", talent: "resonanceSkill", variant: "Stage 2", requiredForm: "Mech", damageType: "basicAttack", multipliers: [{ percent: 18.57, hits: 1 }, { percent: 74.26, hits: 1 }] }),
  action({ id: "mech-basic-3", name: "Mech Basic Attack Stage 3", talent: "resonanceSkill", variant: "Stage 3", requiredForm: "Mech", damageType: "basicAttack", multipliers: [{ percent: 3.89, hits: 6 }, { percent: 81.54, hits: 1 }, { percent: 11.65, hits: 1 }] }),
  action({ id: "mech-basic-4", name: "Mech Basic Attack Stage 4", talent: "resonanceSkill", variant: "Stage 4", requiredForm: "Mech", damageType: "basicAttack", multipliers: [{ percent: 40.38, hits: 1 }, { percent: 94.21, hits: 1 }], cancel: { into: ["Heavenfall Edict: Overdrive", "Shared Voyage"], timing: unknownTiming() } }),
  action({ id: "mech-heavy-1", name: "Mech Heavy Charged I", talent: "resonanceSkill", variant: "Charged I", requiredForm: "Mech", damageType: "heavyAttack", multipliers: [{ percent: 92.83, hits: 1 }], costs: [{ resource: "stamina", amount: 20 }] }),
  action({ id: "mech-heavy-2", name: "Mech Heavy Charged II", talent: "resonanceSkill", variant: "Charged II", requiredForm: "Mech", damageType: "heavyAttack", conditionalDamageType: { damageType: "resonanceLiberation", condition: "Conditions d’Instant Response pertinentes" }, multipliers: [{ percent: 232, hits: 1 }], costs: [{ resource: "stamina", amount: 20 }], cancel: { into: ["Heavenfall Edict: Finale"], timing: unknownTiming() } }),
  action({ id: "mech-midair", name: "Mech Mid-air Attack", talent: "resonanceSkill", requiredForm: "Mech", damageType: "basicAttack", multipliers: [{ percent: 73.35, hits: 1 }, { percent: 4.32, hits: 3 }], costs: [{ resource: "stamina", amount: 30 }] }),
  action({ id: "mech-dodge-counter", name: "Mech Dodge Counter", talent: "resonanceSkill", requiredForm: "Mech", damageType: "basicAttack", multipliers: [{ percent: 9.45, hits: 6 }, { percent: 198.44, hits: 1 }, { percent: 28.35, hits: 1 }] }),
  action({ id: "form-switch", name: "Shared Voyage: Form Switch", talent: "resonanceSkill", multipliers: [], cooldownSeconds: 1, notes: ["Alterne entre Aemeath et Mech; Mech hérite des statistiques d’Aemeath."] }),
  action({ id: "overdrive", name: "Heavenfall Edict: Overdrive", talent: "resonanceLiberation", damageType: "resonanceLiberation", multipliers: [{ percent: 200.8, hits: 1 }, { percent: 267.74, hits: 3 }], costs: [{ resource: "resonance-energy", amount: 125 }], gains: [{ resource: "concerto", amount: 20 }, { resource: "synchronization-rate", amount: 30 }, { resource: "resonance-rate", amount: 1 }], cooldownSeconds: 25 }),
  action({ id: "finale", name: "Heavenfall Edict: Finale", talent: "resonanceLiberation", requiredState: ["Heavenfall Edict: Unbound", "Synchronization Rate = 200", "Resonance Rate = 4"], damageType: "resonanceLiberation", multipliers: [{ percent: 1789.29, hits: 1 }], costs: [{ resource: "synchronization-rate", amount: 200 }, { resource: "resonance-rate", amount: 4 }], gains: [{ resource: "concerto", amount: 20 }], cooldownSeconds: 25, notes: ["Termine Unbound et Seraphic Duo, puis remet Aemeath en forme normale."] }),
  action({ id: "intro-normal", name: "Songs Across the Universe", talent: "introSkill", requiredForm: "Aemeath", damageType: "introSkill", multipliers: [{ percent: 13.46, hits: 2 }, { percent: 107.66, hits: 1 }], gains: [{ resource: "concerto", amount: 10 }, { resource: "synchronization-rate", amount: 40 }] }),
  action({ id: "intro-mech", name: "Debut of Meteoric Radiance", talent: "introSkill", requiredForm: "Mech", damageType: "introSkill", multipliers: [{ percent: 65.3, hits: 1 }, { percent: 97.95, hits: 1 }], gains: [{ resource: "concerto", amount: 10 }, { resource: "synchronization-rate", amount: 40 }] }),
  action({ id: "seraphic-encore", name: "Seraphic Duet: Encore", talent: "forteCircuit", damageType: "resonanceLiberation", multipliers: [{ percent: 17.9, hits: 4 }, { percent: 35.79, hits: 3 }, { percent: 178.93, hits: 1 }], costs: [{ resource: "synchronization-rate", amount: 100 }], gains: [{ resource: "resonance-rate", amount: 1 }] }),
  action({ id: "seraphic-overture", name: "Seraphic Duet: Overture", talent: "forteCircuit", damageType: "resonanceLiberation", multipliers: [{ percent: 17.9, hits: 1 }, { percent: 14.92, hits: 6 }, { percent: 23.86, hits: 3 }, { percent: 59.65, hits: 3 }], costs: [{ resource: "synchronization-rate", amount: 100 }], gains: [{ resource: "resonance-rate", amount: 1 }] }),
  action({ id: "starburst", name: "Tune Rupture Response: Starburst", talent: "forteCircuit", damageType: "tuneRupture", scaling: "tuneAmp", multipliers: [{ percent: 596.43, hits: 1 }], notes: ["Internal cooldown de 8 s par cible."] }),
  action({ id: "seraphic-bonus", name: "Seraphic Duet Bonus DMG", talent: "forteCircuit", damageType: "tuneRupture", scaling: "tuneAmp", multipliers: [{ percent: 109.35, hits: 1 }] }),
];

const effect = (value: Omit<CombatEffect, "source">): CombatEffect => ({ ...value, source: aemeathGameSource });
const aemeathEffects: readonly CombatEffect[] = [
  effect({ id: "stardust-resonance", name: "Stardust Resonance", sourceId: "overdrive", trigger: "Heavenfall Edict: Overdrive", target: "self", effect: "Le prochain Seraphic Duet ne consomme pas les Trail concernés.", durationSeconds: 30, endCondition: "Expire après 2 utilisations de Seraphic Duet ou après 30 s." }),
  effect({ id: "unbound", name: "Heavenfall Edict: Unbound", sourceId: "overdrive", trigger: "Heavenfall Edict: Overdrive", target: "self", effect: "Remplace Overdrive par Finale; Resonance Rate au maximum déclenche Instant Response.", durationSeconds: 60, endCondition: "Finale termine l’état, ou expiration après 60 s." }),
  effect({ id: "starlume", name: "Starlume Acceleration", sourceId: "intro-normal", trigger: "Intro Skill", target: "self", effect: "Overdrive restaure 1 Resonance Rate supplémentaire.", durationSeconds: 15, endCondition: "Overdrive termine l’état avant son expiration." }),
  effect({ id: "seraphic-duo", name: "Seraphic Duo", sourceId: "aemeath-basic-4", trigger: "Basic Attack Stage 4 normal ou Mech", target: "self", effect: "Autorise Seraphic Duet.", durationSeconds: 5, endCondition: "Finale termine également cet état." }),
  effect({ id: "starburst-icd", name: "Starburst target ICD", sourceId: "starburst", trigger: "Tune Rupture Response: Starburst touche une cible", target: "enemy", effect: "Empêche une nouvelle réponse Starburst sur cette cible.", internalCooldown: { seconds: 8, scope: "target" } }),
  effect({ id: "rupturous-trail", name: "Rupturous Trail", sourceId: "to-sculpt-the-silence", trigger: "Tune Rupture - Interfered approprié", target: "enemy", effect: "Applique 10 Rupturous Trail.", maxStacks: 30, stackRule: "10 stacks par application S0.", durationSeconds: 30, refreshRule: "Selon l’application du kit." }),
  effect({ id: "fusion-trail", name: "Fusion Trail", sourceId: "to-sculpt-the-silence", trigger: "Conditions Fusion Burst appropriées", target: "enemy", effect: "Applique Fusion Trail.", maxStacks: 30, durationSeconds: 30, refreshRule: "Selon l’application du kit." }),
  effect({ id: "trail-application-icd", name: "Trail application ICD", sourceId: "to-sculpt-the-silence", trigger: "Une compétence listée applique Tune Rupture - Shifting ou Fusion Burst", target: "enemy", effect: "Limite le déclenchement de l’effet.", internalCooldown: { seconds: 3, scope: "action-and-target" } }),
  effect({ id: "before-all-sounds", name: "Before All Sounds", sourceId: "before-all-sounds", trigger: "Heavy Attack normal ou Mech sous Instant Response", target: "self", effect: "Heavy Attack gagne 200 % DMG Amplification.", value: 200, valueType: "damage-amplification" }),
  effect({ id: "between-stars-tune", name: "Between the Stars — Tune Rupture", sourceId: "between-the-stars", trigger: "Un Resonator distinct applique Tune Rupture - Shifting ou les dégâts Tune Rupture appropriés", target: "self", effect: "+20 % Crit DMG par contributeur; à 3 stacks Finale gagne 25 % DMG Amplification.", value: 20, valueType: "crit-damage", maxStacks: 3, stackRule: "Chaque Resonator ne contribue qu’une fois.", durationSeconds: null, resetRule: "Un Resonator rejoint l’équipe ou changement de Resonance Mode." }),
  effect({ id: "between-stars-fusion", name: "Between the Stars — Fusion Burst", sourceId: "between-the-stars", trigger: "Chaque membre pertinent contribue", target: "self", effect: "+30 % Crit DMG par contributeur; à 2 stacks Finale gagne 25 % DMG Amplification.", value: 30, valueType: "crit-damage", maxStacks: 2, stackRule: "Chaque Resonator ne contribue qu’une fois.", durationSeconds: null, resetRule: "Un Resonator rejoint l’équipe ou changement de Resonance Mode." }),
  effect({ id: "silent-protection-tune", name: "Silent Protection — Tune Rupture", sourceId: "outro", trigger: "Outro Skill", target: "other-team-members", effect: "10 % All-DMG Amplification, porté à 20 % pour un Resonator capable de Tune Rupture - Shifting.", value: 10, valueType: "damage-amplification", durationSeconds: 20, refreshRule: "Une nouvelle utilisation remplace/réinitialise l’effet." }),
  effect({ id: "silent-protection-fusion", name: "Silent Protection — Fusion Burst", sourceId: "outro", trigger: "Outro Skill", target: "other-team-members", effect: "10 % All-DMG Amplification, porté à 20 % pour un Resonator capable de Fusion Burst.", value: 10, valueType: "damage-amplification", durationSeconds: 20, refreshRule: "Une nouvelle utilisation remplace/réinitialise l’effet." }),
];

export const aemeath: Resonator = {
  id: "aemeath",
  name: "Aemeath",
  element: "fusion",
  weaponType: "sword",
  rarity: 5,
  role: "Main DPS / burst DPS orienté Resonance Liberation",
  baseStats: [
    { level: 1, hp: 882, attack: 34, defense: 94 },
    { level: 90, hp: 11025, attack: 425, defense: 1148.87, displayDefense: 1149, critRate: 5, critDamage: 150, energyRegen: 100 },
  ],
  minorFortes: ["+8 % Crit Rate", "+12 % ATK"],
  skillNames: {
    basicAttack: "Infinity Calibration",
    resonanceSkill: "Shared Voyage",
    forteCircuit: "To Sculpt the Silence",
    resonanceLiberation: "Towards the Daybreak",
    introSkill: "Overture of Departure",
  },
  resonanceChain: [
    { sequence: 1, name: "Gilded Glimmer of the First Dawn", description: "Instant Response: Heavy normal/Mech +300 % Crit DMG et attraction. Brilliance après plus de 4 s hors combat; Heavy Charged II restaure 100 Synchronization Rate hors Unbound. Sealed Trail dure 10 s puis impose 1 s avant une nouvelle entrée." },
    { sequence: 2, name: "Downy Notes of Snowfluff", description: "Overture et Encore: DMG Multiplier +100 %. Tune Rupture peut gagner 20 % par instance supplémentaire, 5 stacks pendant 1 s. Renforce aussi Fusion Burst sous Stardust Resonance et les Fusion Trail retirés." },
    { sequence: 3, name: "Fervor Sightly Burns Bright as New", description: "Finale DMG Multiplier +100 %, Overdrive +40 %. Heavy sous Instant Response applique l’effet du mode. Between the Stars devient +60 % Crit DMG et Finale +25 % DMG Amplification, reset au changement d’équipe ou de mode." },
    { sequence: 4, name: "Ethereal Waltz on Binary Tides", description: "Intro, Sync Strike ou Seraphic Duet donne à l’équipe +20 % All-Attribute DMG Bonus pendant 30 s." },
    { sequence: 5, name: "Voyage to the Astral Shore", description: "Kill direct: Starflux à 100 %. Dégâts mortels: Digital Ghost 5 s, shield équipe de 360 % ATK pendant 5 s, retour à 100 % HP et +30 Energy; cooldown 10 min." },
    { sequence: 6, name: "A Zephyr-Kissed Journey to You", description: "Les cibles subissent +40 % Resonance Liberation DMG d’Aemeath. Réponses de mode: Crit Rate 80 % / Crit DMG 275 %. Applications Forte doublées, cap Trail 60, Seraphic Duet ajoute 10 Trail pendant 30 s." },
  ],
  combat: {
    level10Only: true,
    forms: ["Aemeath", "Mech"],
    modes: ["Tune Rupture", "Fusion Burst"],
    resources: [
      { id: "synchronization-rate", name: "Synchronization Rate", cap: 200, notes: ["Intro +40; Overdrive +30; Heavy Charged II sous Instant Response + Unbound restaure 200.", "Gains individuels des Basics, Mid-air, Dodge Counters et Sync Strikes: inconnus."] },
      { id: "resonance-rate", name: "Resonance Rate", cap: 4, notes: ["Seraphic Duet +1; Overdrive +1; Starlume Acceleration ajoute +1 à Overdrive."] },
      { id: "starflux", name: "Starflux", cap: 600, naturalRegeneration: { value: null, confidence: "unknown", sourceNote: "Taux non vérifié." }, notes: ["Starflux Thrust est disponible en Mech au-dessus de 200 puis consomme continuellement Starflux; débit inconnu."] },
      { id: "resonance-energy", name: "Resonance Energy", cap: 125, notes: ["125 retenu comme valeur multi-source. Wuthering.gg affiche aussi 140 dans un en-tête contradictoire; divergence documentée dans la source."] },
    ],
    actions: aemeathActions,
    effects: aemeathEffects,
    rotations: [{
      id: "aemeath-s0-standard-no-quickswap",
      name: "Rotation standard Aemeath S0",
      sequence: 0,
      policy: "no-quickswap",
      steps: [
        "Intro en Mech form", "Basic Mech 3", "Basic Mech 4", "Cancel de fin via Heavenfall Edict: Overdrive",
        "Basic Mech 2", "Basic Mech 3", "Basic Mech 4", "Cancel approprié via Skill",
        "Seraphic Duet: Encore", "Basic Aemeath 2", "Basic Aemeath 3", "Basic Aemeath 4",
        "Cancel via Skill", "Seraphic Duet: Overture", "Heavy Mech Charged II", "Cancel de fin via Finale",
        "Heavenfall Edict: Finale", "Form Switch vers Mech si utilisé dans la boucle standard", "Outro",
      ],
      totalDurationSeconds: { value: 11.69, confidence: "community-calculation", sourceNote: "Calcul communautaire Prydwen." },
      notes: ["Rotation lisible sans swap cancel vers un autre Resonator.", "Sigillum, Summon Echo, peut être placé sans interruption forte.", "Les cancels restent déclaratifs; aucune timeline n’est exécutée."],
      source: { kind: "community-recommendation", source: "Prydwen", verifiedAt },
    }],
    unknowns: [
      "Vitesse exacte de régénération naturelle de Starflux",
      "Consommation exacte de Starflux Thrust par seconde",
      "Gains exacts de Synchronization Rate de chaque Basic/hit individuel",
      "Durée de cast et recovery/endlag de chaque action",
      "Timestamps individuels des hits",
      "Fenêtres exactes de cancel en secondes ou frames",
    ],
    source: aemeathGameSource,
  },
  source: aemeathGameSource,
};

const polestarEffects: readonly CombatEffect[] = [
  effect({ id: "everbright-r1-base", name: "Everbright Polestar R1", sourceId: "everbright-polestar", trigger: "Équipée", target: "self", effect: "+12 % All-Attribute DMG Bonus.", value: 12, valueType: "damage-bonus" }),
  effect({ id: "everbright-r1-liberation", name: "Everbright Polestar R1 — Polestar", sourceId: "everbright-polestar", trigger: "Le porteur inflige Tune Rupture - Shifting ou Fusion Burst", target: "self", effect: "Resonance Liberation DMG ignore 32 % DEF et 10 % Fusion RES.", durationSeconds: 8, refreshRule: "Nouveau déclenchement selon le passif." }),
];
export const everbrightPolestar: Weapon = {
  id: "everbright-polestar", name: "Everbright Polestar", type: "sword", rarity: 5,
  level90Stats: { baseAttack: 587.5, displayBaseAttack: 588, critRate: 24.3 },
  passiveDescription: "R1: +12 % All-Attribute DMG Bonus. Après Tune Rupture - Shifting ou Fusion Burst, Resonance Liberation DMG ignore 32 % DEF et 10 % Fusion RES pendant 8 s.",
  effects: polestarEffects, source: aemeathGameSource,
};

export const trailblazingStar: Sonata = {
  id: "trailblazing-star", name: "Trailblazing Star (5-piece)",
  effectDescription: "2-piece: +10 % Fusion DMG. 5-piece: après Fusion Burst ou Tune Rupture - Shifting, +20 % Crit Rate et +20 % Fusion DMG pendant 8 s.",
  effects: [
    effect({ id: "trailblazing-2pc", name: "Trailblazing Star 2-piece", sourceId: "trailblazing-star", trigger: "2 pièces équipées", target: "self", effect: "+10 % Fusion DMG.", value: 10, valueType: "damage-bonus" }),
    effect({ id: "trailblazing-5pc", name: "Trailblazing Star 5-piece", sourceId: "trailblazing-star", trigger: "Applique Fusion Burst ou Tune Rupture - Shifting", target: "self", effect: "+20 % Crit Rate et +20 % Fusion DMG.", durationSeconds: 8 }),
  ],
  source: aemeathGameSource,
};

export const sigillum: MainEcho = {
  id: "sigillum", name: "Sigillum", sonataIds: ["trailblazing-star"],
  skillDescription: "Summon Echo: 68.40 % puis 205.20 % Fusion DMG; cooldown 20 s. Main Echo d’Aemeath: +25 % Resonance Liberation DMG Bonus.",
  action: action({ id: "sigillum-skill", name: "Sigillum Echo Skill", talent: "echoSkill", damageType: "echoSkill", multipliers: [{ percent: 68.4, hits: 1 }, { percent: 205.2, hits: 1 }], cooldownSeconds: 20 }),
  effects: [effect({ id: "sigillum-main-aemeath", name: "Sigillum Main Echo — Aemeath", sourceId: "sigillum", trigger: "Sigillum équipé en Main Echo par Aemeath", target: "self", effect: "+25 % Resonance Liberation DMG Bonus.", value: 25, valueType: "damage-bonus" })],
  source: aemeathGameSource,
};

const minimumFinalStats = {
  hp: 15000, attack: 2000, defense: 1100, critRate: 65, critDamage: 210, energyRegen: 115, healingBonus: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 40, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

export const aemeathPreset: RecommendedBuildPreset = {
  id: "aemeath-s0-endgame-v0.1", resonatorId: "aemeath", label: "Aemeath S0 endgame · V0.1",
  role: "Main DPS / burst DPS Resonance Liberation", characterLevel: 90, sequence: 0,
  skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
  progression: { inherentSkillsUnlocked: true, minorFortesUnlocked: true },
  weapon: { weaponId: "everbright-polestar", level: 90, rank: 1 },
  finalStats: minimumFinalStats,
  recommendedTargets: {
    hp: { minimum: 15000 }, defense: { minimum: 1100 }, attack: { minimum: 2000, maximum: 2400 },
    critRate: { minimum: 65 }, critDamage: { minimum: 210, maximum: 260 }, energyRegen: { minimum: 115, maximum: 125 },
    elementalDamageBonus: { fusion: { minimum: 40, maximum: 70 } },
  },
  sonataId: "trailblazing-star", mainEchoId: "sigillum",
  notes: [
    "finalStats initialise explicitement les seuils inférieurs communautaires, jamais le milieu arbitraire d’une plage.",
    "Les plages restent dans recommendedTargets et ne sont ni des caps ni des statistiques recalculées.",
    "Minor Fortes, arme, Sonata et Echo sont documentés mais ne sont jamais additionnés automatiquement à finalStats.",
  ],
  source: communityBuildSource,
};
