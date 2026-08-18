import { aemeath } from "./aemeath";
import type {
  CombatAction,
  MotionValueGroup,
  SourceMetadata,
} from "@/domain/models";
import type {
  PersonalDpsProfileV1,
  PersonalDpsRotationV1,
} from "@/domain/personal-dps-engine";

const wutheringToolsRevision = "b1d5a1b62e0587d3d8a1a770849a1fa7893eda74";
const verifiedAt = "2026-08-19";

const source = (path: string): SourceMetadata => ({
  kind: "multi-source-verified",
  source: `WutheringTools · ryanbenson/wuthering-waves-optimizer @ ${wutheringToolsRevision} · ${path}`,
  verifiedAt,
  notes:
    "Static transcription into WUWA LAB's generic combat model. Source code is not copied; only reviewed game-data values and rotation identifiers are represented.",
});

const unknownTiming = () => ({ value: null, confidence: "unknown" as const });

function atkAction(input: {
  id: string;
  name: string;
  talent: CombatAction["talent"];
  damageType?: NonNullable<CombatAction["damageType"]>;
  multipliers: readonly MotionValueGroup[];
  path: string;
}): CombatAction {
  return {
    id: input.id,
    name: input.name,
    talent: input.talent,
    ...(input.damageType !== undefined ? { damageType: input.damageType } : {}),
    level: 10,
    multipliers: input.multipliers,
    castDurationSeconds: unknownTiming(),
    recoverySeconds: unknownTiming(),
    hitTimingsSeconds: unknownTiming(),
    source: source(input.path),
  };
}

function rotation(
  value: PersonalDpsRotationV1,
): PersonalDpsRotationV1 {
  return value;
}

const aemeathActions = aemeath.combat?.actions;
if (!aemeathActions) {
  throw new Error("Aemeath combat actions must exist for the DPS pilot profile.");
}

/**
 * The existing 11.69 s no-quickswap source rotation contains non-damaging form
 * switches/cancels as prose. This projection lists only its unambiguous damaging
 * actions; timing remains the reviewed total rotation duration.
 */
export const aemeathPersonalDpsProfile10R1: PersonalDpsProfileV1 = {
  resonatorId: "aemeath",
  element: "fusion",
  actions: aemeathActions,
  defaultScalingAttribute: "attack",
  rotations: [
    rotation({
      id: "aemeath-s0-standard-no-quickswap-damage-v1",
      name: "Aemeath S0 standard · damaging actions",
      durationSeconds: 11.69,
      sourceNote:
        "Damage-only projection of the existing Prydwen no-quickswap rotation. Non-damaging form switches/cancels remain owned by the Temporal layer.",
      steps: [
        { actionId: "intro-mech" },
        { actionId: "mech-basic-3" },
        { actionId: "mech-basic-4" },
        { actionId: "overdrive" },
        { actionId: "mech-basic-2" },
        { actionId: "mech-basic-3" },
        { actionId: "mech-basic-4" },
        { actionId: "seraphic-encore" },
        { actionId: "aemeath-basic-2" },
        { actionId: "aemeath-basic-3" },
        { actionId: "aemeath-basic-4" },
        { actionId: "seraphic-overture" },
        { actionId: "mech-heavy-2" },
        { actionId: "finale" },
      ],
    }),
  ],
};

const calcharoActions: readonly CombatAction[] = [
  atkAction({
    id: "calcharo-wanted-outlaw",
    name: "Wanted Outlaw DMG",
    talent: "introSkill",
    damageType: "introSkill",
    multipliers: [{ percent: 39.77, hits: 2 }, { percent: 59.65, hits: 2 }],
    path: "src/characters/Calcharo/introAttacks.ts",
  }),
  atkAction({
    id: "calcharo-phantom-etching",
    name: "Phantom Etching DMG",
    talent: "resonanceLiberation",
    damageType: "resonanceLiberation",
    multipliers: [{ percent: 596.43, hits: 1 }],
    path: "src/characters/Calcharo/liberationAttacks.ts",
  }),
  atkAction({
    id: "calcharo-death-messenger",
    name: "Death Messenger DMG",
    talent: "forteCircuit",
    damageType: "resonanceLiberation",
    multipliers: [{ percent: 97.77, hits: 8 }, { percent: 195.53, hits: 1 }],
    path: "src/characters/Calcharo/forteCircuitAttacks.ts",
  }),
  atkAction({
    id: "calcharo-hounds-roar-1",
    name: "Hounds Roar Part 1 DMG",
    talent: "resonanceLiberation",
    damageType: "basicAttack",
    multipliers: [{ percent: 88.07, hits: 1 }],
    path: "src/characters/Calcharo/liberationAttacks.ts",
  }),
  atkAction({
    id: "calcharo-hounds-roar-2",
    name: "Hounds Roar Part 2 DMG",
    talent: "resonanceLiberation",
    damageType: "basicAttack",
    multipliers: [{ percent: 35.23, hits: 2 }, { percent: 52.84, hits: 2 }],
    path: "src/characters/Calcharo/liberationAttacks.ts",
  }),
  atkAction({
    id: "calcharo-hounds-roar-3",
    name: "Hounds Roar Part 3 DMG",
    talent: "resonanceLiberation",
    damageType: "basicAttack",
    multipliers: [{ percent: 163.84, hits: 1 }],
    path: "src/characters/Calcharo/liberationAttacks.ts",
  }),
  atkAction({
    id: "calcharo-extermination-order-1",
    name: "Extermination Order Part 1 DMG",
    talent: "resonanceSkill",
    damageType: "resonanceSkill",
    multipliers: [{ percent: 51.57, hits: 2 }, { percent: 68.76, hits: 1 }],
    path: "src/characters/Calcharo/skillAttacks.ts",
  }),
  atkAction({
    id: "calcharo-extermination-order-2",
    name: "Extermination Order Part 2 DMG",
    talent: "resonanceSkill",
    damageType: "resonanceSkill",
    multipliers: [{ percent: 77.36, hits: 2 }, { percent: 103.14, hits: 1 }],
    path: "src/characters/Calcharo/skillAttacks.ts",
  }),
  atkAction({
    id: "calcharo-shadowy-raid",
    name: "Shadowy Raid DMG",
    talent: "outroSkill",
    multipliers: [{ percent: 195.98, hits: 1 }, { percent: 391.96, hits: 1 }],
    path: "src/characters/Calcharo/outroAttacks.ts",
  }),
];

export const calcharoPersonalDpsProfile10R1: PersonalDpsProfileV1 = {
  resonatorId: "calcharo",
  element: "electro",
  actions: calcharoActions,
  defaultScalingAttribute: "attack",
  rotations: [
    rotation({
      id: "calcharo-prydwen-dmx3-v1",
      name: "Calcharo · Prydwen DMx3",
      sourceNote:
        "Exact WutheringTools Prydwen DMx3 action counts. Shadowy Raid uses the generic uncategorized damage path, so no Basic/Heavy/Skill/Liberation/Intro panel bonus is fabricated. Source provides no trusted duration here.",
      steps: [
        { actionId: "calcharo-wanted-outlaw" },
        { actionId: "calcharo-phantom-etching" },
        { actionId: "calcharo-death-messenger", count: 3 },
        { actionId: "calcharo-hounds-roar-1", count: 4 },
        { actionId: "calcharo-hounds-roar-2", count: 4 },
        { actionId: "calcharo-hounds-roar-3", count: 2 },
        { actionId: "calcharo-extermination-order-1" },
        { actionId: "calcharo-extermination-order-2" },
        { actionId: "calcharo-shadowy-raid", damageCategory: "uncategorized" },
      ],
    }),
  ],
};

const changliActions: readonly CombatAction[] = [
  atkAction({
    id: "changli-obedience-of-rules",
    name: "Obedience of Rules DMG",
    talent: "introSkill",
    damageType: "introSkill",
    multipliers: [{ percent: 44.5, hits: 1 }, { percent: 25.96, hits: 4 }],
    path: "src/characters/Changli/introAttacks.ts",
  }),
  atkAction({
    id: "changli-true-sight-charge",
    name: "True Sight - Charge DMG",
    talent: "resonanceSkill",
    damageType: "resonanceSkill",
    multipliers: [{ percent: 72.68, hits: 1 }, { percent: 109.02, hits: 1 }],
    path: "src/characters/Changli/skillAttacks.ts",
  }),
  atkAction({
    id: "changli-heavy-attack",
    name: "Heavy Attack DMG",
    talent: "basicAttack",
    damageType: "heavyAttack",
    multipliers: [{ percent: 28.99, hits: 3 }, { percent: 37.27, hits: 1 }],
    path: "src/characters/Changli/basicAttacks.ts",
  }),
  atkAction({
    id: "changli-basic-3",
    name: "Basic Attack 3 DMG",
    talent: "basicAttack",
    damageType: "basicAttack",
    multipliers: [{ percent: 36.45, hits: 3 }],
    path: "src/characters/Changli/basicAttacks.ts",
  }),
  atkAction({
    id: "changli-basic-4",
    name: "Basic Attack 4 DMG",
    talent: "basicAttack",
    damageType: "basicAttack",
    multipliers: [{ percent: 50.7, hits: 1 }, { percent: 29.58, hits: 4 }],
    path: "src/characters/Changli/basicAttacks.ts",
  }),
  atkAction({
    id: "changli-true-sight-conquest",
    name: "True Sight - Conquest DMG",
    talent: "resonanceSkill",
    damageType: "resonanceSkill",
    multipliers: [
      { percent: 58.95, hits: 2 },
      { percent: 82.52, hits: 1 },
      { percent: 94.31, hits: 1 },
    ],
    path: "src/characters/Changli/skillAttacks.ts",
  }),
  atkAction({
    id: "changli-true-sight-capture",
    name: "True Sight - Capture DMG",
    talent: "resonanceSkill",
    damageType: "resonanceSkill",
    multipliers: [{ percent: 81.88, hits: 3 }, { percent: 163.76, hits: 1 }],
    path: "src/characters/Changli/skillAttacks.ts",
  }),
  atkAction({
    id: "changli-flaming-sacrifice",
    name: "Flaming Sacrifice DMG",
    talent: "forteCircuit",
    damageType: "resonanceSkill",
    multipliers: [{ percent: 39.25, hits: 5 }, { percent: 457.85, hits: 1 }],
    path: "src/characters/Changli/forteCircuitAttacks.ts",
  }),
  atkAction({
    id: "changli-radiance-of-fealty",
    name: "Radiance of Fealty DMG",
    talent: "resonanceLiberation",
    damageType: "resonanceLiberation",
    multipliers: [{ percent: 1212.75, hits: 1 }],
    path: "src/characters/Changli/liberationAttacks.ts",
  }),
];

export const changliPersonalDpsProfile10R1: PersonalDpsProfileV1 = {
  resonatorId: "changli",
  element: "fusion",
  actions: changliActions,
  defaultScalingAttribute: "attack",
  rotations: [
    rotation({
      id: "changli-prydwen-no-buffs-v1",
      name: "Changli · Prydwen Rotation (No buffs)",
      sourceNote:
        "Exact action order/counts from WutheringTools' Prydwen Rotation preset. Source does not provide a trusted total duration, so the engine reports rotation damage but no DPS until duration is supplied by a verified temporal source.",
      steps: [
        { actionId: "changli-obedience-of-rules" },
        { actionId: "changli-true-sight-charge" },
        { actionId: "changli-heavy-attack" },
        { actionId: "changli-basic-3" },
        { actionId: "changli-basic-4" },
        { actionId: "changli-true-sight-conquest" },
        { actionId: "changli-true-sight-capture" },
        { actionId: "changli-true-sight-conquest" },
        { actionId: "changli-true-sight-capture" },
        { actionId: "changli-true-sight-conquest" },
        { actionId: "changli-flaming-sacrifice" },
        { actionId: "changli-radiance-of-fealty" },
        { actionId: "changli-flaming-sacrifice" },
      ],
    }),
  ],
};

export const personalDpsPilotProfiles10R1: readonly PersonalDpsProfileV1[] = [
  aemeathPersonalDpsProfile10R1,
  calcharoPersonalDpsProfile10R1,
  changliPersonalDpsProfile10R1,
];
