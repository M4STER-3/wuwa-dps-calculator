import type { PersonalRotationScenario, RotationSpecialEventPreset } from "./personal-rotation-presets";
import type { TemporalRotationDefinition } from "@/domain/temporal-engine";
import type { CombatAction, SourceMetadata } from "@/domain/models";
import { HIYUKI, HIYUKI_GLACIO_BITE_STATUS } from "./precise-dps-hiyuki";

export type TimedHiyukiScenario = PersonalRotationScenario & {
  targetDuration?: TemporalRotationDefinition["targetDuration"];
};

const source: SourceMetadata = {
  kind: "community-calculation",
  source: "Prydwen Hiyuki standard rotation / Arab Wuwa tested field-time / WutheringTools formula cross-check",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
  notes:
    "11.67s is the reviewed total field-time target. Individual action windows stay theoretical and are calibrated to the total; no frame-exact attack timing is claimed.",
};

const unknownTiming = (note: string) => ({
  value: null,
  confidence: "unknown" as const,
  sourceNote: note,
});

const virtualStatusAction = (
  id: string,
  name: string,
): CombatAction => ({
  id,
  name,
  talent: "forteCircuit",
  level: 10,
  multipliers: [],
  castDurationSeconds: unknownTiming("Formula-only Negative Status event; not an animation."),
  recoverySeconds: unknownTiming("Formula-only Negative Status event; not an animation."),
  hitTimingsSeconds: unknownTiming("Anchored to the theoretical end of the Chafe-applying action."),
  source,
});

const extraActions: readonly CombatAction[] = [
  virtualStatusAction(HIYUKI.glacioBiteStatusAction, "Glacio Bite · converted Glacio Chafe stack"),
  virtualStatusAction(HIYUKI.fineSnowBiteAction, "Fine Snow · additional 102% Glacio Bite"),
];

const steps: PersonalRotationScenario["rotation"]["steps"] = [
  { actionId: HIYUKI.intro },
  { actionId: HIYUKI.presentBasic3 },
  { actionId: HIYUKI.frostSplinter },
  { actionId: HIYUKI.inwardVision },
  { actionId: HIYUKI.foreclaimedBasic1 },
  { actionId: HIYUKI.foreclaimedBasic2 },
  { actionId: HIYUKI.foreclaimedBasic3 },
  { actionId: HIYUKI.jadeCleave },
  { actionId: HIYUKI.petalfall },
  { actionId: HIYUKI.foreclaimedBasic1 },
  { actionId: HIYUKI.foreclaimedBasic2 },
  { actionId: HIYUKI.foreclaimedBasic3 },
  { label: "Dodge · enter Iai Stance", profileId: "very-short" },
  { actionId: HIYUKI.iai },
  { actionId: HIYUKI.iai },
  { actionId: HIYUKI.iai },
  { actionId: HIYUKI.bitterfrost },
  { actionId: HIYUKI.bladeLiberation },
  { actionId: HIYUKI.presentSkill },
  { label: "Outro · Snowlight Blessing / handoff", profileId: "outro" },
];

const statusPayload = {
  negativeStatusKind: "glacioChafe",
  negativeStatusStacksFromStatusId: HIYUKI_GLACIO_BITE_STATUS,
  attribution: "status",
  damageOwnerId: "hiyuki",
  scalingOwnerId: "hiyuki",
} as const;

const applicationEvent = (
  id: string,
  stepIndex: number,
  repeat = 1,
  minimumSequence?: 1 | 2 | 3 | 4 | 5 | 6,
): RotationSpecialEventPreset => ({
  id,
  kind: "status-applied",
  actionId: HIYUKI.glacioBiteStatusAction,
  anchor: { stepIndex, at: "end", offsetSeconds: 0.0001 },
  ...(repeat > 1 ? { repeat } : {}),
  ...(minimumSequence ? { minimumSequence } : {}),
  payload: statusPayload,
});

const fineSnowEvent = (
  id: string,
  stepIndex: number,
  minimumSequence: 3 | 4 | 5 | 6 = 3,
): RotationSpecialEventPreset => ({
  id,
  kind: "custom",
  actionId: HIYUKI.fineSnowBiteAction,
  anchor: { stepIndex, at: "end", offsetSeconds: 0.0005 },
  minimumSequence,
  payload: {
    negativeStatusKind: "glacioChafe",
    stacks: 1,
    motionValueBasisPointsOverride: 10200,
    multiplierIncreasePercent: 488,
    attribution: "status",
    damageOwnerId: "hiyuki",
    scalingOwnerId: "hiyuki",
    sourceEffectId: "precise-hiyuki-fine-snow",
  },
});

const baseApplications: readonly RotationSpecialEventPreset[] = [
  applicationEvent("hiyuki-chafe-intro", 0),
  applicationEvent("hiyuki-chafe-present-basic3", 1),
  applicationEvent("hiyuki-chafe-frost-splinter", 2),
  applicationEvent("hiyuki-chafe-inward", 3, 4),
  applicationEvent("hiyuki-chafe-foreclaimed-basic3-a", 6),
  applicationEvent("hiyuki-chafe-foreclaimed-basic3-b", 11),
  applicationEvent("hiyuki-chafe-iai-a", 13, 3),
  applicationEvent("hiyuki-chafe-iai-b", 14, 3),
  applicationEvent("hiyuki-chafe-iai-c", 15, 3),
  applicationEvent("hiyuki-chafe-bitterfrost", 16),
  applicationEvent("hiyuki-s1-chafe-foreclaimed-basic1", 4, 1, 1),
  applicationEvent("hiyuki-s1-chafe-foreclaimed-basic2", 5, 1, 1),
];

const baseFineSnowApplications: readonly RotationSpecialEventPreset[] = [
  fineSnowEvent("hiyuki-fine-snow-intro", 0),
  fineSnowEvent("hiyuki-fine-snow-present-basic3", 1),
  fineSnowEvent("hiyuki-fine-snow-frost-splinter", 2),
  fineSnowEvent("hiyuki-fine-snow-inward", 3),
  fineSnowEvent("hiyuki-fine-snow-foreclaimed-basic3-a", 6),
  fineSnowEvent("hiyuki-fine-snow-foreclaimed-basic3-b", 11),
  fineSnowEvent("hiyuki-fine-snow-iai-a", 13),
  fineSnowEvent("hiyuki-fine-snow-iai-b", 14),
  fineSnowEvent("hiyuki-fine-snow-iai-c", 15),
  fineSnowEvent("hiyuki-fine-snow-bitterfrost", 16),
  {
    ...fineSnowEvent("hiyuki-s3-s1-fine-snow-basic1", 4),
    minimumSequence: 3,
  },
  {
    ...fineSnowEvent("hiyuki-s3-s1-fine-snow-basic2", 5),
    minimumSequence: 3,
  },
];

const scenarioEvents: readonly RotationSpecialEventPreset[] = [
  ...baseApplications,
  ...baseFineSnowApplications,
  {
    id: "hiyuki-reviewed-frostheart-full",
    kind: "custom",
    actionId: HIYUKI.frostheartCheckpoint,
    anchor: { stepIndex: 11, at: "end", offsetSeconds: 0.0009 },
    payload: {
      scenarioCheckpoint: "reviewed-full-frostheart-after-two-skills-and-foreclaimed-basics",
    },
  },
];

const sharedNotes = [
  "Reference sequence follows Prydwen Standard Rotation: Intro → Present B3 → Frost Splinter → Inward Vision → Foreclaimed B1/B2/B3 → Jade → Petalfall → B1/B2/B3 → Dodge → Iai×3 → Bitterfrost → Blade Liberation → optional Present Skill swap → Outro.",
  "11.67s is a reviewed whole-rotation field-time target. Individual action durations/hit timestamps remain theoretical and are calibrated to the total by design.",
  "The public kit does not expose trustworthy numeric Frostheart gains for each Foreclaimed Basic/Skill. The scenario therefore sets one exact reviewed full-Frostheart checkpoint after the stated preparation route instead of fabricating per-hit gains.",
  "Glacio Chafe applications are represented as target-status events. The engine only emits Glacio Bite damage when a new stack is actually added; the 10-stack cap and Iai/Inward Frostbind consumption are state-driven rather than averaged.",
  "Fine Snow team stacks from allies remain Team Cycle-owned. Personal DPS earns Hiyuki's own Snow Rust; S3's pre-combat self stack is explicit, and the additional 102% Bite is emitted once per Chafe-applying action when that personal S3 condition is satisfied.",
  "Hiyuki's Outro +20% Glacio amplification is for other Resonators only and is never added to Hiyuki's Personal DPS.",
] as const;

export const hiyukiOpenerScenario: TimedHiyukiScenario = {
  id: "hiyuki-opener",
  resonatorId: "hiyuki",
  name: "Hiyuki · Opener · 2 Snowforged Blade finisher",
  rotation: { id: "hiyuki-opener", name: "Hiyuki · Standard Opener", steps },
  targetDuration: {
    seconds: 11.67,
    confidence: "community-calculation",
    source: "Prydwen Standard Rotation + independently published 11.67s tested Hiyuki field time · reviewed 2026-08-20",
  },
  initialResources: {
    dedication: 0,
    frostheart: 0,
    "frostharden-iai": 0,
    "whiteout-bitterfrost": 0,
    "snowforged-blade": 1,
  },
  specialEvents: scenarioEvents,
  extraActions,
  assumeLegacyRequirementsSatisfied: true,
  notes: [
    ...sharedNotes,
    "Opener starts with 1 Snowforged Blade from Ephemeral Realm and gains 1 from Bitterfrost, so Blade Liberation consumes a 2-stack bank at S0-S1. S2 explicitly overrides the out-of-combat bootstrap to 3 stacks.",
  ],
};

export const hiyukiLoopScenario: TimedHiyukiScenario = {
  id: "hiyuki-loop",
  resonatorId: "hiyuki",
  name: "Hiyuki · Loop · banked 3 Snowforged Blade finisher",
  rotation: { id: "hiyuki-loop", name: "Hiyuki · Standard Loop · banked finisher", steps },
  targetDuration: {
    seconds: 11.67,
    confidence: "community-calculation",
    source: "Prydwen Standard Rotation + independently published 11.67s tested Hiyuki field time · reviewed 2026-08-20",
  },
  initialResources: {
    dedication: 0,
    frostheart: 0,
    "frostharden-iai": 0,
    "whiteout-bitterfrost": 0,
    "snowforged-blade": 2,
  },
  specialEvents: scenarioEvents,
  extraActions,
  assumeLegacyRequirementsSatisfied: true,
  notes: [
    ...sharedNotes,
    "Banked loop starts with 2 retained Snowforged Blade and gains 1 from Bitterfrost, so Blade Liberation consumes the capped 3-stack bank. This is an explicit banking scenario, not an average across waves.",
  ],
};

export const hiyukiPreciseScenarios: readonly TimedHiyukiScenario[] = [
  hiyukiOpenerScenario,
  hiyukiLoopScenario,
];
