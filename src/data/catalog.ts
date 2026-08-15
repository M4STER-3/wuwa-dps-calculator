import type {
  MainEcho,
  RecommendedBuildPreset,
  Resonator,
  Sonata,
  Weapon,
} from "@/domain/models";

const fixtureSource = {
  kind: "technical-fixture" as const,
  source: "Fixture locale de développement",
  notes:
    "Donnée fictive, uniquement destinée à valider l'architecture. Ne représente pas une recommandation Wuthering Waves.",
};

const skillNames = {
  basicAttack: "Basic Attack",
  resonanceSkill: "Resonance Skill",
  forteCircuit: "Forte Circuit",
  resonanceLiberation: "Resonance Liberation",
  introSkill: "Intro Skill",
} as const;

export const resonators: readonly Resonator[] = [
  {
    id: "fixture-aero-sword",
    name: "Resonator démo · Aero",
    element: "aero",
    weaponType: "sword",
    rarity: 5,
    skillNames,
    resonanceChain: [],
    source: fixtureSource,
  },
  {
    id: "fixture-fusion-pistols",
    name: "Resonator démo · Fusion",
    element: "fusion",
    weaponType: "pistols",
    rarity: 4,
    skillNames,
    resonanceChain: [],
    source: fixtureSource,
  },
];

export const weapons: readonly Weapon[] = [
  {
    id: "fixture-sword",
    name: "Épée de démonstration",
    type: "sword",
    rarity: 4,
    source: fixtureSource,
  },
  {
    id: "fixture-pistols",
    name: "Pistolets de démonstration",
    type: "pistols",
    rarity: 4,
    source: fixtureSource,
  },
];

export const sonatas: readonly Sonata[] = [
  { id: "fixture-sonata", name: "Sonata à renseigner", source: fixtureSource },
];

export const mainEchoes: readonly MainEcho[] = [
  {
    id: "fixture-main-echo",
    name: "Main Echo à renseigner",
    sonataIds: ["fixture-sonata"],
    source: fixtureSource,
  },
];

const emptyFinalStats = () => ({
  hp: 0,
  attack: 0,
  defense: 0,
  critRate: 0,
  critDamage: 0,
  energyRegen: 0,
  healingBonus: 0,
  elementalDamageBonus: {
    aero: 0,
    glacio: 0,
    electro: 0,
    fusion: 0,
    havoc: 0,
    spectro: 0,
  },
  damageTypeBonus: {
    basicAttack: 0,
    heavyAttack: 0,
    resonanceSkill: 0,
    resonanceLiberation: 0,
    introSkill: 0,
    echoSkill: 0,
  },
});

export const presets: readonly RecommendedBuildPreset[] = resonators.map(
  (resonator) => ({
    id: `preset-${resonator.id}`,
    resonatorId: resonator.id,
    label: "Fixture technique (non recommandée)",
    characterLevel: 1,
    sequence: 0,
    skillLevels: {
      basicAttack: 1,
      resonanceSkill: 1,
      forteCircuit: 1,
      resonanceLiberation: 1,
      introSkill: 1,
    },
    weapon: {
      weaponId:
        resonator.weaponType === "sword" ? "fixture-sword" : "fixture-pistols",
      level: 1,
      rank: 1,
    },
    finalStats: emptyFinalStats(),
    sonataId: "fixture-sonata",
    mainEchoId: "fixture-main-echo",
    notes: [
      "Remplacez cette fixture par un preset sourcé avant de la présenter comme recommandation.",
    ],
    source: fixtureSource,
  }),
);
