import {
  aemeath,
  aemeathPreset,
  everbrightPolestar,
  sigillum,
  trailblazingStar,
} from "./aemeath";
import {
  calcharo,
  calcharoPreset,
  lustrousRazor,
  nightmareThunderingMephis,
  voidThunder,
} from "./calcharo-runtime";
import type {
  MainEcho,
  RecommendedBuildPreset,
  Resonator,
  Sonata,
  Weapon,
} from "@/domain/models";
import { chisa, chisaPreset, kumokiri, threadOfSeveredFate, threnodianLeviathan } from "./chisa";
import { roster10R1BaselinePresets } from "./roster-10r1-presets";
import {
  roster10R1PromotedResonators,
  roster10R1PromotedWeapons,
} from "./roster-10r1-promoted";
import { fallacyOfNoReturn, rejuvenatingGlow, variation, verina, verinaPreset } from "./verina-runtime";
import { getResonatorUiPortraitPath } from "@/game-data/resonator-ui-asset-ids";

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

const withOptionalLocalUiPortrait = (resonator: Resonator): Resonator => {
  const portraitPath = getResonatorUiPortraitPath(resonator.id);
  return portraitPath
    ? {
        ...resonator,
        portrait: {
          src: portraitPath,
          alt: `Portrait de ${resonator.name}`,
        },
      }
    : resonator;
};

const rich10R1Ids = new Set(["aemeath", "calcharo", "chisa"]);
const generated10R1Resonators = roster10R1PromotedResonators.filter(
  (resonator) => !rich10R1Ids.has(resonator.id),
);
const promotedResonators = [
  aemeath,
  calcharo,
  ...generated10R1Resonators,
  chisa,
  verina,
].map(withOptionalLocalUiPortrait);

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

const richWeaponIds = new Set(["everbright-polestar", "lustrous-razor", "kumokiri"]);
const generated10R1Weapons = roster10R1PromotedWeapons.filter(
  (weapon) => !richWeaponIds.has(weapon.id),
);

export const weapons: readonly Weapon[] = [
  everbrightPolestar,
  lustrousRazor,
  ...generated10R1Weapons,
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
  voidThunder,
  threadOfSeveredFate,
  rejuvenatingGlow,
  { id: "fixture-sonata", name: "Sonata à renseigner", source: fixtureSource },
];

export const mainEchoes: readonly MainEcho[] = [
  sigillum,
  nightmareThunderingMephis,
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
  calcharoPreset,
  ...roster10R1BaselinePresets,
  chisaPreset,
  verinaPreset,
  fixturePreset,
];
