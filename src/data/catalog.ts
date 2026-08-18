import {
  aemeath,
  aemeathPreset,
  everbrightPolestar,
  sigillum,
  trailblazingStar,
} from "./aemeath";
import type {
  MainEcho,
  RecommendedBuildPreset,
  Resonator,
  Sonata,
  Weapon,
} from "@/domain/models";
import { chisa, chisaPreset, kumokiri, threadOfSeveredFate, threnodianLeviathan } from "./chisa";
import { fallacyOfNoReturn, rejuvenatingGlow, variation, verina, verinaPreset } from "./verina";
import { requireResonatorUiPortraitPath } from "@/game-data/resonator-ui-asset-ids";

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

const withLocalUiPortrait = (resonator: Resonator): Resonator => ({
  ...resonator,
  portrait: {
    src: requireResonatorUiPortraitPath(resonator.id),
    alt: `Portrait de ${resonator.name}`,
  },
});

const promotedResonators = [aemeath, chisa, verina].map(withLocalUiPortrait);

export const resonators: readonly Resonator[] = [
  ...promotedResonators,
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
  everbrightPolestar,
  kumokiri,
  variation,
  {
    id: "fixture-pistols",
    name: "Pistolets de démonstration",
    type: "pistols",
    rarity: 4,
    source: fixtureSource,
  },
];

export const sonatas: readonly Sonata[] = [
  trailblazingStar,
  threadOfSeveredFate,
  rejuvenatingGlow,
  { id: "fixture-sonata", name: "Sonata à renseigner", source: fixtureSource },
];

export const mainEchoes: readonly MainEcho[] = [
  sigillum,
  threnodianLeviathan,
  fallacyOfNoReturn,
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
  tuneBreakBoost: 0,
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

const fixtureResonator = resonators.find(
  (resonator) => resonator.source.kind === "technical-fixture",
)!;

const fixturePreset: RecommendedBuildPreset = {
  id: `preset-${fixtureResonator.id}`,
  resonatorId: fixtureResonator.id,
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
  weapon: { weaponId: "fixture-pistols", level: 1, rank: 1 },
  finalStats: emptyFinalStats(),
  sonataId: "fixture-sonata",
  mainEchoId: "fixture-main-echo",
  notes: [
    "Remplacez cette fixture par un preset sourcé avant de la présenter comme recommandation.",
  ],
  source: fixtureSource,
};

export const presets: readonly RecommendedBuildPreset[] = [
  aemeathPreset,
  chisaPreset,
  verinaPreset,
  fixturePreset,
];
